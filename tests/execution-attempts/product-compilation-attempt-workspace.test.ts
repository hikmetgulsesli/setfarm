import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { canonicalJsonBytes, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  ProductCompilationProjectionReceiptV1Schema,
  createProductCompilationArtifactManifestV1,
  prepareProductCompilationAttemptWorkspaceV1,
  projectAcceptedProductCompilationAttemptV1,
  writeProductCompilationArtifactManifestV1,
  writeProductCompilationAttemptEvidenceV1,
  writeProductCompilationPromptV1,
  writeProductCompilationRequestV1,
} from "../../src/product-compiler/product-compilation-attempt-workspace.js";
import {
  ProductCompilationAttemptV1Schema,
  type ProductCompilationAttemptV1,
} from "../../src/product-compiler/schemas/product-compilation-attempt-v1.js";

const roots: string[] = [];
const timestamp = "2026-07-16T10:00:00.000Z";

function sha(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function attemptId(label: string): string {
  return `PCA_${sha(label)}`;
}

function acceptedOutputSealHash(
  id: string,
  outputRefs: NonNullable<ProductCompilationAttemptV1["outputRefs"]>,
): string {
  return hashCanonicalJson({
    schema: "setfarm.product-compilation-output-seal.v1",
    attemptRef: id,
    disposition: "accepted",
    outputRefs,
  });
}

function failureOutputSealHash(
  id: string,
  disposition: "rejected" | "infrastructure_failure" | "dispatch_ambiguous",
  failure: NonNullable<ProductCompilationAttemptV1["failure"]>,
): string {
  return hashCanonicalJson({
    schema: "setfarm.product-compilation-output-seal.v1",
    attemptRef: id,
    disposition,
    failure,
  });
}

function baseAttempt(label: string, requestHash: string): Record<string, unknown> {
  const id = attemptId(label);
  return {
    schema: "setfarm.product-compilation-attempt.v1",
    attemptId: id,
    runId: `run-${label}`,
    originClaimId: 11,
    ownerClaimId: 11,
    passKind: "design_source_generation",
    authorityHash: sha(`authority:${label}`),
    requestHash,
    ordinal: 1,
    retryAuthority: null,
    generation: 1,
    fenceToken: sha(`fence:${label}`),
    attemptLocator: `.setfarm/product-compilation-attempts/${id}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function reservedAttempt(label: string, request: unknown): ProductCompilationAttemptV1 {
  return ProductCompilationAttemptV1Schema.parse({
    ...baseAttempt(label, hashCanonicalJson(request)),
    state: "reserved",
    disposition: null,
    lease: {
      ownerInstanceId: "workspace-test",
      acquiredAt: timestamp,
      expiresAt: "2026-07-16T10:05:00.000Z",
      heartbeatAt: timestamp,
    },
    dispatch: null,
    outputRefs: null,
    outputSealHash: null,
    failure: null,
  });
}

function acceptedAttempt(
  label: string,
  request: unknown,
  outputRefs: NonNullable<ProductCompilationAttemptV1["outputRefs"]>,
): ProductCompilationAttemptV1 {
  const base = baseAttempt(label, hashCanonicalJson(request));
  const id = String(base.attemptId);
  return ProductCompilationAttemptV1Schema.parse({
    ...base,
    state: "sealed",
    disposition: "accepted",
    lease: null,
    dispatch: {
      intentCommittedAt: timestamp,
      startedAt: timestamp,
      finishedAt: timestamp,
      externalOperationId: null,
    },
    outputRefs,
    outputSealHash: acceptedOutputSealHash(id, outputRefs),
    failure: null,
  });
}

function failedAttempt(
  label: string,
  request: unknown,
  disposition: "rejected" | "infrastructure_failure" | "dispatch_ambiguous",
): ProductCompilationAttemptV1 {
  const base = baseAttempt(label, hashCanonicalJson(request));
  const id = String(base.attemptId);
  const failure = {
    failureArtifactHash: sha(`failure-artifact:${label}`),
    failureFingerprint: sha(`failure-fingerprint:${label}`),
    operationalCauseHash: sha(`failure-cause:${label}`),
    reasonCodes: ["DESIGN_SOURCE_GENERATION_FAILED"],
  };
  return ProductCompilationAttemptV1Schema.parse({
    ...base,
    state: disposition === "dispatch_ambiguous" ? "quarantined" : "sealed",
    disposition,
    lease: null,
    dispatch: {
      intentCommittedAt: timestamp,
      startedAt: timestamp,
      finishedAt: timestamp,
      externalOperationId: null,
    },
    outputRefs: null,
    outputSealHash: failureOutputSealHash(id, disposition, failure),
    failure,
  });
}

async function repo(name: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), `setfarm-attempt-workspace-${name}-`));
  roots.push(root);
  return root;
}

type ProjectionFixture = Awaited<ReturnType<typeof acceptedProjectionFixture>>;

async function acceptedProjectionFixture(
  root: string,
  label: string,
  html = `<main data-attempt="${label}">accepted</main>`,
) {
  const request = { schema: "setfarm.design-request.v1", label };
  const authorityBytes = canonicalJsonBytes({
    schema: "setfarm.design-source-closure.v1",
    label,
  });
  const outputRefs = { designSourceClosureHash: sha(authorityBytes) };
  const attempt = acceptedAttempt(label, request, outputRefs);
  const authority = await writeProductCompilationAttemptEvidenceV1({
    repo: root,
    attempt,
    area: "selection",
    locator: "design-source-closure.json",
    content: authorityBytes,
    expectedHash: outputRefs.designSourceClosureHash,
  });
  const htmlArtifact = await writeProductCompilationAttemptEvidenceV1({
    repo: root,
    attempt,
    area: "download",
    locator: "screens/play.html",
    content: html,
  });
  const screenMapBytes = canonicalJsonBytes([{
    screenId: "play",
    name: "Play Page",
    htmlFile: "stitch/play.html",
  }]);
  const screenMap = await writeProductCompilationAttemptEvidenceV1({
    repo: root,
    attempt,
    area: "selection",
    locator: "SCREEN_MAP.json",
    content: screenMapBytes,
  });
  const manifest = createProductCompilationArtifactManifestV1({
    attempt,
    authorityArtifacts: [{
      outputRef: "designSourceClosureHash",
      source: {
        area: "selection",
        locator: "design-source-closure.json",
        contentHash: authority.contentHash,
        byteLength: authority.byteLength,
      },
    }],
    projectionArtifacts: [
      {
        source: {
          area: "download",
          locator: "screens/play.html",
          contentHash: htmlArtifact.contentHash,
          byteLength: htmlArtifact.byteLength,
        },
        targetPath: "play.html",
      },
      {
        source: {
          area: "selection",
          locator: "SCREEN_MAP.json",
          contentHash: screenMap.contentHash,
          byteLength: screenMap.byteLength,
        },
        targetPath: "SCREEN_MAP.json",
      },
    ],
  });
  await writeProductCompilationArtifactManifestV1({ repo: root, attempt, manifest });
  return { attempt, request, authority, htmlArtifact, screenMap, manifest, html };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("immutable product compilation attempt workspace", () => {
  it("keeps prompt, request, and raw evidence isolated and immutable across two attempts", async () => {
    const root = await repo("two-attempts");
    const requestOne = { schema: "setfarm.design-request.v1", ordinal: 1 };
    const requestTwo = { schema: "setfarm.design-request.v1", ordinal: 2 };
    const first = reservedAttempt("evidence-one", requestOne);
    const second = reservedAttempt("evidence-two", requestTwo);
    const firstPaths = await prepareProductCompilationAttemptWorkspaceV1({ repo: root, attempt: first });
    const secondPaths = await prepareProductCompilationAttemptWorkspaceV1({ repo: root, attempt: second });

    assert.notEqual(firstPaths.root, secondPaths.root);
    assert.equal(firstPaths.root.endsWith(first.attemptId), true);
    assert.equal(secondPaths.root.endsWith(second.attemptId), true);
    const firstPrompt = await writeProductCompilationPromptV1({
      repo: root,
      attempt: first,
      prompt: "Generate design\r\nwithout mutation.  \r\n",
    });
    const firstRequest = await writeProductCompilationRequestV1({ repo: root, attempt: first, request: requestOne });
    await assert.rejects(
      () => writeProductCompilationRequestV1({
        repo: root,
        attempt: second,
        request: { schema: "setfarm.design-request.v1", ordinal: "tampered" },
      }),
      /PRODUCT_COMPILATION_REQUEST_HASH_MISMATCH/,
    );
    assert.equal(await readFile(secondPaths.requestPath, "utf8").catch(() => "missing"), "missing");
    const secondRequest = await writeProductCompilationRequestV1({ repo: root, attempt: second, request: requestTwo });
    await writeProductCompilationAttemptEvidenceV1({
      repo: root,
      attempt: first,
      area: "raw",
      locator: "response.json",
      content: "first-response",
    });
    await writeProductCompilationAttemptEvidenceV1({
      repo: root,
      attempt: second,
      area: "raw",
      locator: "response.json",
      content: "second-response",
    });

    assert.equal(await readFile(firstPrompt.path, "utf8"), "Generate design\nwithout mutation.\n");
    assert.equal(firstPrompt.contentHash, sha("Generate design\nwithout mutation.\n"));
    assert.equal(await readFile(firstRequest.path, "utf8"), canonicalJsonBytes(requestOne).toString("utf8"));
    assert.equal(firstRequest.contentHash, first.requestHash);
    assert.equal(secondRequest.contentHash, second.requestHash);
    assert.equal(await readFile(path.join(firstPaths.raw, "response.json"), "utf8"), "first-response");
    assert.equal(await readFile(path.join(secondPaths.raw, "response.json"), "utf8"), "second-response");

    await assert.rejects(() => writeProductCompilationAttemptEvidenceV1({
      repo: root,
      attempt: first,
      area: "raw",
      locator: "response.json",
      content: "mutated-response",
    }), /PRODUCT_COMPILATION_ATTEMPT_ARTIFACT_IMMUTABLE/);
    assert.equal(await readFile(path.join(firstPaths.raw, "response.json"), "utf8"), "first-response");
  });

  it("projects an accepted exact manifest and emits a hash-verifiable canonical receipt", async () => {
    const root = await repo("accepted");
    const fixture = await acceptedProjectionFixture(root, "accepted-exact");
    const receipt = await projectAcceptedProductCompilationAttemptV1({
      repo: root,
      attempt: fixture.attempt,
    });

    assert.equal(await readFile(path.join(root, "stitch", "play.html"), "utf8"), fixture.html);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(root, "stitch", "SCREEN_MAP.json"), "utf8")),
      [{ screenId: "play", name: "Play Page", htmlFile: "stitch/play.html" }],
    );
    const persistedReceipt = ProductCompilationProjectionReceiptV1Schema.parse(JSON.parse(
      await readFile(
        path.join(root, "stitch", "PRODUCT_COMPILATION_PROJECTION_RECEIPT.json"),
        "utf8",
      ),
    ));
    assert.deepEqual(persistedReceipt, receipt);
    assert.equal(receipt.attemptId, fixture.attempt.attemptId);
    assert.equal(receipt.manifestHash, fixture.manifest.manifestHash);
    assert.equal(receipt.artifacts.length, 2);
    assert.match(receipt.projectionHash, /^[a-f0-9]{64}$/);
    assert.match(receipt.receiptHash, /^[a-f0-9]{64}$/);

    const replay = await projectAcceptedProductCompilationAttemptV1({
      repo: root,
      attempt: fixture.attempt,
    });
    assert.deepEqual(replay, receipt);
  });

  it("repairs tampered, missing, and symlinked projection artifacts from the immutable accepted attempt", async () => {
    const root = await repo("projection-repair");
    const fixture = await acceptedProjectionFixture(root, "projection-repair");
    const receipt = await projectAcceptedProductCompilationAttemptV1({
      repo: root,
      attempt: fixture.attempt,
    });
    const stitchHtml = path.join(root, "stitch", "play.html");
    const receiptPath = path.join(root, "stitch", "PRODUCT_COMPILATION_PROJECTION_RECEIPT.json");

    await writeFile(stitchHtml, "tampered-projection");
    const afterTamper = await projectAcceptedProductCompilationAttemptV1({
      repo: root,
      attempt: fixture.attempt,
    });
    assert.deepEqual(afterTamper, receipt);
    assert.equal(await readFile(stitchHtml, "utf8"), fixture.html);

    await rm(stitchHtml);
    const afterMissing = await projectAcceptedProductCompilationAttemptV1({
      repo: root,
      attempt: fixture.attempt,
    });
    assert.deepEqual(afterMissing, receipt);
    assert.equal(await readFile(stitchHtml, "utf8"), fixture.html);

    const outside = path.join(root, "outside-projection.html");
    await writeFile(outside, "outside-must-remain-unchanged");
    await rm(stitchHtml);
    await symlink(outside, stitchHtml);
    const afterSymlink = await projectAcceptedProductCompilationAttemptV1({
      repo: root,
      attempt: fixture.attempt,
    });
    assert.deepEqual(afterSymlink, receipt);
    assert.equal(await readFile(stitchHtml, "utf8"), fixture.html);
    assert.equal(await readFile(outside, "utf8"), "outside-must-remain-unchanged");
    assert.deepEqual(
      ProductCompilationProjectionReceiptV1Schema.parse(JSON.parse(await readFile(receiptPath, "utf8"))),
      receipt,
    );
  });

  it("never lets failed, quarantined, or active attempts replace a prior canonical projection", async () => {
    const root = await repo("non-projectable");
    const accepted = await acceptedProjectionFixture(root, "accepted-parent", "<main>parent</main>");
    const baseline = await projectAcceptedProductCompilationAttemptV1({ repo: root, attempt: accepted.attempt });
    const failedParent = failedAttempt("failed-parent", { retry: false }, "rejected");
    const failed = ProductCompilationAttemptV1Schema.parse({
      ...failedAttempt("failed-retry", { retry: true }, "rejected"),
      ordinal: 2,
      generation: 2,
      retryAuthority: {
        parentAttemptRef: failedParent.attemptId,
        parentFailureArtifactHash: failedParent.failure!.failureArtifactHash,
        parentFailureFingerprint: failedParent.failure!.failureFingerprint,
        retryDeltaHash: sha("failed-retry-delta"),
      },
    });
    const quarantined = failedAttempt("quarantined-retry", { retry: true }, "dispatch_ambiguous");
    const active = reservedAttempt("active-retry", { retry: true });

    await writeProductCompilationAttemptEvidenceV1({
      repo: root,
      attempt: failed,
      area: "download",
      locator: "play.html",
      content: "<main>failed retry</main>",
    });
    for (const attempt of [failed, quarantined, active]) {
      await assert.rejects(
        () => projectAcceptedProductCompilationAttemptV1({ repo: root, attempt }),
        /PRODUCT_COMPILATION_ATTEMPT_NOT_PROJECTABLE/,
      );
    }

    assert.equal(await readFile(path.join(root, "stitch", "play.html"), "utf8"), "<main>parent</main>");
    const receipt = ProductCompilationProjectionReceiptV1Schema.parse(JSON.parse(
      await readFile(path.join(root, "stitch", "PRODUCT_COMPILATION_PROJECTION_RECEIPT.json"), "utf8"),
    ));
    assert.equal(receipt.receiptHash, baseline.receiptHash);
  });

  it("blocks tamper, symlink escape, and traversal while leaving prior stitch content intact", async () => {
    const root = await repo("safety");
    await mkdir(path.join(root, "stitch"));
    await writeFile(path.join(root, "stitch", "prior.html"), "prior-canonical");
    const fixture: ProjectionFixture = await acceptedProjectionFixture(root, "tampered");
    const workspace = await prepareProductCompilationAttemptWorkspaceV1({
      repo: root,
      attempt: fixture.attempt,
    });

    await assert.rejects(() => writeProductCompilationAttemptEvidenceV1({
      repo: root,
      attempt: fixture.attempt,
      area: "raw",
      locator: "../escape.txt",
      content: "escape",
    }), /traversal|normalized relative locator/i);
    assert.equal(await readFile(path.join(root, "escape.txt"), "utf8").catch(() => "missing"), "missing");

    const outside = path.join(root, "outside.txt");
    await writeFile(outside, "outside");
    await symlink(outside, path.join(workspace.raw, "linked.txt"));
    await assert.rejects(() => writeProductCompilationAttemptEvidenceV1({
      repo: root,
      attempt: fixture.attempt,
      area: "raw",
      locator: "linked.txt",
      content: "overwrite",
    }), /PRODUCT_COMPILATION_SYMLINK_ESCAPE/);
    assert.equal(await readFile(outside, "utf8"), "outside");

    assert.throws(() => createProductCompilationArtifactManifestV1({
      attempt: fixture.attempt,
      authorityArtifacts: fixture.manifest.authorityArtifacts,
      projectionArtifacts: [{
        ...fixture.manifest.projectionArtifacts[0]!,
        targetPath: "../escape.html",
      }],
    }), /traversal|normalized relative locator/i);

    await assert.rejects(() => writeProductCompilationArtifactManifestV1({
      repo: root,
      attempt: fixture.attempt,
      manifest: {
        ...fixture.manifest,
        manifestHash: "0".repeat(64),
      },
    }), /Artifact manifest hash must bind/);

    await writeFile(fixture.htmlArtifact.path, "tampered-after-manifest");
    await assert.rejects(
      () => projectAcceptedProductCompilationAttemptV1({ repo: root, attempt: fixture.attempt }),
      /PRODUCT_COMPILATION_ARTIFACT_SOURCE_TAMPERED/,
    );
    assert.equal(await readFile(path.join(root, "stitch", "prior.html"), "utf8"), "prior-canonical");
    assert.equal(await readFile(path.join(root, "stitch", "play.html"), "utf8").catch(() => "missing"), "missing");
  });
});
