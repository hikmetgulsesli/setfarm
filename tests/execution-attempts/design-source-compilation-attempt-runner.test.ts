import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { canonicalJsonBytes, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  createInitialDesignSourceGenerationRequestV2,
  DesignSourceMaterializationFailureV2,
  runDesignSourceCompilationAttemptsV2,
  type DesignSourceAcceptedArtifactSetV2,
  type DesignSourceCompilationAttemptRepositoryPortV2,
  type DesignSourceGenerationDispatchResultV2,
  type DesignSourceGenerationStagePromptV2,
} from "../../src/product-compiler/design-source-compilation-attempt-runner.js";
import type { ProductCompilationAttemptReservationResult } from "../../src/product-compiler/product-compilation-attempt-repository.js";
import {
  DesignSourceGenerationRequestV1Schema,
  DesignSourceGenerationRequestV2Schema,
  type DesignSourceGenerationAuthorityV1,
  type DesignSourceGenerationRequestV2,
} from "../../src/product-compiler/schemas/design-source-generation-authority-v1.js";
import {
  ProductCompilationAttemptV1Schema,
  type ProductCompilationAttemptFailureV1,
  type ProductCompilationAttemptV1,
} from "../../src/product-compiler/schemas/product-compilation-attempt-v1.js";

const roots: string[] = [];
const timestamp = "2026-07-16T20:00:00.000Z";
const expiresAt = "2026-07-16T20:10:00.000Z";

function sha(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function outputSealHash(
  attemptId: string,
  disposition: "accepted" | "rejected" | "infrastructure_failure" | "dispatch_ambiguous",
  evidence: { outputRefs: NonNullable<ProductCompilationAttemptV1["outputRefs"]> }
    | { failure: ProductCompilationAttemptFailureV1 },
): string {
  return hashCanonicalJson({
    schema: "setfarm.product-compilation-output-seal.v1",
    attemptRef: attemptId,
    disposition,
    ...evidence,
  });
}

type Reservation = {
  runId: string;
  originClaimId: number;
  ownerClaimId: number;
  passKind: "design_source_generation";
  authorityHash: string;
  requestHash: string;
  ordinal: 1 | 2;
  retryAuthority: ProductCompilationAttemptV1["retryAuthority"];
  ownerInstanceId: string;
};

class FakeAttemptRepository implements DesignSourceCompilationAttemptRepositoryPortV2 {
  readonly attempts = new Map<string, ProductCompilationAttemptV1>();
  readonly reservations: Reservation[] = [];
  readonly events: string[] = [];
  readonly recoverableAttemptIds = new Set<string>();

  async reserve(inputValue: unknown): Promise<ProductCompilationAttemptReservationResult> {
    const input = inputValue as Reservation;
    this.reservations.push(structuredClone(input));
    this.events.push(`reserve:${input.ordinal}`);
    const accepted = [...this.attempts.values()].find((attempt) =>
      attempt.runId === input.runId
      && attempt.authorityHash === input.authorityHash
      && attempt.disposition === "accepted"
    );
    if (accepted) return { status: "already_accepted", attempt: accepted };

    const id = `PCA_${hashCanonicalJson({
      schema: "setfarm.product-compilation-attempt-identity.v1",
      runId: input.runId,
      passKind: input.passKind,
      authorityHash: input.authorityHash,
      requestHash: input.requestHash,
      ordinal: input.ordinal,
    })}`;
    const duplicate = this.attempts.get(id);
    if (duplicate) return { status: "duplicate", attempt: duplicate };
    const active = [...this.attempts.values()].find((attempt) =>
      attempt.runId === input.runId
      && attempt.authorityHash === input.authorityHash
      && ["reserved", "dispatching"].includes(attempt.state)
    );
    if (active) return { status: "active_conflict", attempt: active };

    if (input.ordinal === 2) {
      const retry = input.retryAuthority;
      const parent = retry ? this.attempts.get(retry.parentAttemptRef) : undefined;
      if (
        !parent
        || parent.ordinal !== 1
        || parent.state !== "sealed"
        || !parent.failure
        || parent.authorityHash !== input.authorityHash
        || parent.failure.failureArtifactHash !== retry?.parentFailureArtifactHash
        || parent.failure.failureFingerprint !== retry?.parentFailureFingerprint
      ) {
        throw new Error("PRODUCT_COMPILATION_RETRY_AUTHORITY_INVALID");
      }
    }

    const attempt = ProductCompilationAttemptV1Schema.parse({
      schema: "setfarm.product-compilation-attempt.v1",
      attemptId: id,
      runId: input.runId,
      originClaimId: input.originClaimId,
      ownerClaimId: input.ownerClaimId,
      passKind: input.passKind,
      authorityHash: input.authorityHash,
      requestHash: input.requestHash,
      ordinal: input.ordinal,
      retryAuthority: input.retryAuthority,
      generation: input.ordinal,
      fenceToken: sha(`fence:${id}`),
      state: "reserved",
      disposition: null,
      lease: {
        ownerInstanceId: input.ownerInstanceId,
        acquiredAt: timestamp,
        expiresAt,
        heartbeatAt: timestamp,
      },
      dispatch: null,
      outputRefs: null,
      outputSealHash: null,
      failure: null,
      attemptLocator: `.setfarm/product-compilation-attempts/${id}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    this.attempts.set(id, attempt);
    return { status: "reserved", attempt };
  }

  async recoverExpired(inputValue: unknown) {
    const input = inputValue as {
      attemptId: string;
      ownerClaimId: number;
      ownerInstanceId: string;
    };
    const current = this.require(input.attemptId);
    if (!this.recoverableAttemptIds.has(input.attemptId)) {
      throw new Error("PRODUCT_COMPILATION_RECOVERY_LEASE_NOT_EXPIRED");
    }
    this.recoverableAttemptIds.delete(input.attemptId);
    const attempt = this.store({
      ...current,
      ownerClaimId: input.ownerClaimId,
      generation: current.generation + 1,
      fenceToken: sha(`recovered-fence:${current.attemptId}:${current.generation + 1}`),
      lease: {
        ownerInstanceId: input.ownerInstanceId,
        acquiredAt: timestamp,
        expiresAt,
        heartbeatAt: timestamp,
      },
      updatedAt: timestamp,
    });
    this.events.push(`recover:${current.state}`);
    return current.state === "reserved"
      ? { status: "reserved_safe_to_resume" as const, attempt }
      : { status: "dispatching_must_quarantine" as const, attempt };
  }

  async commitDispatchIntent(inputValue: unknown): Promise<ProductCompilationAttemptV1> {
    const input = inputValue as { attemptId: string; externalOperationId: string };
    const current = this.require(input.attemptId);
    if (current.state !== "reserved") throw new Error("PRODUCT_COMPILATION_DISPATCH_STATE_INVALID");
    this.events.push(`commit:${current.ordinal}`);
    return this.store({
      ...current,
      state: "dispatching",
      dispatch: {
        intentCommittedAt: timestamp,
        startedAt: timestamp,
        finishedAt: null,
        externalOperationId: input.externalOperationId,
      },
      updatedAt: timestamp,
    });
  }

  async sealAccepted(inputValue: unknown): Promise<ProductCompilationAttemptV1> {
    const input = inputValue as {
      attemptId: string;
      outputRefs: NonNullable<ProductCompilationAttemptV1["outputRefs"]>;
    };
    const current = this.require(input.attemptId);
    if (current.state !== "dispatching") throw new Error("PRODUCT_COMPILATION_SEAL_STATE_INVALID");
    this.events.push(`accepted:${current.ordinal}`);
    return this.store({
      ...current,
      state: "sealed",
      disposition: "accepted",
      lease: null,
      dispatch: { ...current.dispatch!, finishedAt: timestamp },
      outputRefs: input.outputRefs,
      outputSealHash: outputSealHash(current.attemptId, "accepted", { outputRefs: input.outputRefs }),
      failure: null,
      updatedAt: timestamp,
    });
  }

  async sealFailure(inputValue: unknown): Promise<ProductCompilationAttemptV1> {
    const input = inputValue as {
      attemptId: string;
      disposition: "rejected" | "infrastructure_failure" | "dispatch_ambiguous";
      failure: ProductCompilationAttemptFailureV1;
    };
    const current = this.require(input.attemptId);
    if (current.state !== "dispatching") throw new Error("PRODUCT_COMPILATION_SEAL_STATE_INVALID");
    this.events.push(`${input.disposition}:${current.ordinal}`);
    return this.store({
      ...current,
      state: input.disposition === "dispatch_ambiguous" ? "quarantined" : "sealed",
      disposition: input.disposition,
      lease: null,
      dispatch: { ...current.dispatch!, finishedAt: timestamp },
      outputRefs: null,
      outputSealHash: outputSealHash(current.attemptId, input.disposition, { failure: input.failure }),
      failure: input.failure,
      updatedAt: timestamp,
    });
  }

  async heartbeat(inputValue: unknown): Promise<ProductCompilationAttemptV1> {
    const input = inputValue as { attemptId: string };
    this.events.push(`heartbeat:${input.attemptId}`);
    return this.require(input.attemptId);
  }

  async get(attemptId: string): Promise<ProductCompilationAttemptV1 | undefined> {
    return this.attempts.get(attemptId);
  }

  private require(attemptId: string): ProductCompilationAttemptV1 {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) throw new Error("ATTEMPT_NOT_FOUND");
    return attempt;
  }

  private store(value: unknown): ProductCompilationAttemptV1 {
    const attempt = ProductCompilationAttemptV1Schema.parse(value);
    this.attempts.set(attempt.attemptId, attempt);
    return attempt;
  }
}

type Fixture = ReturnType<typeof fixture>;

function fixture(targetCount = 6, suffix = "one") {
  const targetRefs = Array.from({ length: targetCount }, (_, index) => `TARGET_SCREEN_${index + 1}`);
  const authority: DesignSourceGenerationAuthorityV1 = {
    schema: "setfarm.design-source-generation-authority.v1",
    runId: "run-design-runner",
    originClaimId: 41,
    productSpecHash: sha("product-spec"),
    generationTargetsHash: sha("generation-targets"),
    promptContractHash: sha("prompt-contract"),
    renderPolicyHash: sha("render-policy"),
    selectionPolicyHash: sha("selection-policy"),
    producerReleaseSha: "a".repeat(40),
    provider: "stitch",
    model: "gemini-design",
    deviceType: "DESKTOP",
    targetRefs,
    maximumAttempts: 2,
  };
  const stages = targetRefs.length > 5
    ? [
        { stageId: "DSGS_001", targetRefs: targetRefs.slice(0, 5), prompt: `stage one ${suffix}` },
        { stageId: "DSGS_002", targetRefs: targetRefs.slice(5), prompt: `stage two ${suffix}` },
      ]
    : [{ stageId: "DSGS_001", targetRefs, prompt: `stage one ${suffix}` }];
  const request = createInitialDesignSourceGenerationRequestV2({ authority, stages });
  const stagePrompts = stages.map(({ stageId, prompt }) => ({ stageId, prompt }));
  return { authority, request, stagePrompts };
}

async function repoRoot(name: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), `setfarm-design-runner-${name}-`));
  roots.push(root);
  return root;
}

function acceptedMaterializer(): (
  input: Parameters<Parameters<typeof runDesignSourceCompilationAttemptsV2>[1]["materializeAccepted"]>[0],
) => Promise<DesignSourceAcceptedArtifactSetV2> {
  return async ({ stageResults, writeEvidence }) => {
    const closureBytes = canonicalJsonBytes({
      schema: "setfarm.test-design-source-closure.v1",
      stages: stageResults.map((stage) => ({
        stageId: stage.stageId,
        targetRefs: stage.targetRefs,
        rawEvidenceHash: stage.rawEvidence.contentHash,
      })),
    });
    const closure = await writeEvidence({
      area: "selection",
      locator: "design-source-closure.json",
      content: closureBytes,
    });
    const html = await writeEvidence({
      area: "download",
      locator: "screens/index.html",
      content: "<main data-action-id=\"ready\">ready</main>",
    });
    return {
      outputRefs: { designSourceClosureHash: closure.contentHash },
      authorityArtifacts: [{
        outputRef: "designSourceClosureHash",
        source: {
          area: "selection",
          locator: "design-source-closure.json",
          contentHash: closure.contentHash,
          byteLength: closure.byteLength,
        },
      }],
      projectionArtifacts: [{
        source: {
          area: "download",
          locator: "screens/index.html",
          contentHash: html.contentHash,
          byteLength: html.byteLength,
        },
        targetPath: "index.html",
      }],
    };
  };
}

function acceptedDispatch(raw = "provider response") {
  return async (): Promise<DesignSourceGenerationDispatchResultV2> => ({
    disposition: "accepted",
    response: { ok: true },
    rawEvidence: raw,
  });
}

function rejectedDispatch(fingerprint = sha("failure-fingerprint")) {
  return async (): Promise<DesignSourceGenerationDispatchResultV2> => ({
    disposition: "rejected",
    rawEvidence: "typed provider rejection",
    failure: {
      failureFingerprint: fingerprint,
      operationalCauseHash: sha("operational-cause"),
      reasonCodes: ["DESIGN_TARGET_EVIDENCE_INCOMPLETE"],
      evidence: { missingTargetRefs: ["TARGET_SCREEN_1"] },
    },
  });
}

function runnerInput(root: string, value: Fixture) {
  return {
    repo: root,
    authority: value.authority,
    request: value.request,
    stagePrompts: value.stagePrompts,
    ownerClaimId: 41,
    ownerInstanceId: "design-runner-test",
    leaseMs: 5_000,
    heartbeatIntervalMs: 1_000,
    duplicateWaitMs: 1_000,
    duplicatePollMs: 5,
  } as const;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("design-source product compilation attempt runner", () => {
  it("keeps V1 readable but rejects it as runnable and requires an exact multistage target partition", async () => {
    const root = await repoRoot("v1-cycle");
    const value = fixture(6);
    assert.equal(value.request.stages.length, 2);
    assert.equal(value.request.stages[0]!.targetRefs.length, 5);
    assert.deepEqual(value.request.stages.flatMap((stage) => stage.targetRefs), value.authority.targetRefs);
    assert.equal(DesignSourceGenerationRequestV2Schema.safeParse({
      ...value.request,
      stages: value.request.stages.map((stage, index) => ({
        ...stage,
        stageId: index === 0 ? "DSGS_002" : "DSGS_001",
      })),
    }).success, false);
    assert.equal(DesignSourceGenerationRequestV2Schema.safeParse({
      ...value.request,
      stages: value.request.stages.map((stage, index) => index === 0
        ? { ...stage, targetRefs: [...stage.targetRefs].reverse() }
        : stage),
    }).success, false);

    const v1 = DesignSourceGenerationRequestV1Schema.parse({
      schema: "setfarm.design-source-generation-request.v1",
      attemptRef: `PCA_${sha("provisional-attempt")}`,
      authorityHash: hashCanonicalJson(value.authority),
      ordinal: 1,
      retryAuthority: null,
      promptHash: sha("legacy-prompt"),
      targetRefs: value.authority.targetRefs,
      attemptLocator: `.setfarm/product-compilation-attempts/PCA_${sha("provisional-attempt")}`,
    });
    const repository = new FakeAttemptRepository();
    const result = await runDesignSourceCompilationAttemptsV2(
      { ...runnerInput(root, value), request: v1 },
      {
        repository,
        dispatchStage: acceptedDispatch(),
        materializeAccepted: acceptedMaterializer(),
      },
    );
    assert.equal(result.status, "runner_failure");
    if (result.status === "runner_failure") assert.equal(result.code, "DESIGN_SOURCE_RUNNER_INPUT_INVALID");
    assert.equal(repository.reservations.length, 0);

    const incomplete = DesignSourceGenerationRequestV2Schema.parse({
      ...value.request,
      stages: value.request.stages.slice(0, 1),
    });
    const incompleteResult = await runDesignSourceCompilationAttemptsV2(
      { ...runnerInput(root, value), request: incomplete, stagePrompts: value.stagePrompts.slice(0, 1) },
      {
        repository,
        dispatchStage: acceptedDispatch(),
        materializeAccepted: acceptedMaterializer(),
      },
    );
    assert.equal(incompleteResult.status, "runner_failure");
    assert.equal(repository.reservations.length, 0);
  });

  it("commits one attempt intent before dispatching every stage once, seals artifacts, then projects", async () => {
    const root = await repoRoot("success");
    const value = fixture(6);
    const repository = new FakeAttemptRepository();
    const dispatches: string[] = [];
    const result = await runDesignSourceCompilationAttemptsV2(
      { ...runnerInput(root, value), heartbeatIntervalMs: 5 },
      {
        repository,
        dispatchStage: async ({ stage }) => {
          repository.events.push(`dispatch:${stage.stageId}`);
          dispatches.push(stage.stageId);
          await new Promise((resolve) => setTimeout(resolve, 12));
          return { disposition: "accepted", response: { stageId: stage.stageId }, rawEvidence: `raw:${stage.stageId}` };
        },
        materializeAccepted: acceptedMaterializer(),
      },
    );
    assert.equal(result.status, "accepted");
    if (result.status !== "accepted") return;
    assert.equal(result.replayed, false);
    assert.deepEqual(dispatches, ["DSGS_001", "DSGS_002"]);
    assert.ok(repository.events.indexOf("commit:1") < repository.events.indexOf("dispatch:DSGS_001"));
    assert.ok(repository.events.indexOf("dispatch:DSGS_001") < repository.events.indexOf("dispatch:DSGS_002"));
    assert.ok(repository.events.some((event) => event.startsWith("heartbeat:")));
    assert.equal(await readFile(path.join(root, "stitch", "index.html"), "utf8"), "<main data-action-id=\"ready\">ready</main>");
    assert.equal(
      await readFile(path.join(root, result.attempt.attemptLocator, "request", "stages", "DSGS_002", "prompt.md"), "utf8"),
      "stage two one\n",
    );
    assert.equal(
      await readFile(path.join(root, result.attempt.attemptLocator, "raw", "stages", "DSGS_001", "response.bin"), "utf8"),
      "raw:DSGS_001",
    );
  });

  it("creates ordinal two only from the exact parent failure and a mechanically proven changed stage prompt", async () => {
    const root = await repoRoot("retry");
    const value = fixture(1);
    const repository = new FakeAttemptRepository();
    let dispatchCount = 0;
    const result = await runDesignSourceCompilationAttemptsV2(
      runnerInput(root, value),
      {
        repository,
        dispatchStage: async () => {
          dispatchCount += 1;
          return dispatchCount === 1 ? rejectedDispatch()() : acceptedDispatch("retry accepted")();
        },
        materializeAccepted: acceptedMaterializer(),
        planRetry: async ({ stagePrompts }) => ({
          stagePrompts: stagePrompts.map((stage) => ({ ...stage, prompt: `${stage.prompt}\nexact typed repair` })),
        }),
      },
    );
    assert.equal(result.status, "accepted");
    if (result.status !== "accepted") return;
    assert.equal(dispatchCount, 2);
    assert.equal(result.attempts.length, 2);
    const parent = result.attempts[0]!;
    const retry = result.attempts[1]!;
    assert.equal(retry.ordinal, 2);
    assert.equal(retry.retryAuthority?.parentAttemptRef, parent.attemptId);
    assert.equal(retry.retryAuthority?.parentFailureArtifactHash, parent.failure?.failureArtifactHash);
    assert.equal(retry.retryAuthority?.parentFailureFingerprint, parent.failure?.failureFingerprint);
    const deltaPath = path.join(root, retry.attemptLocator, "request", "retry-delta.json");
    const delta = JSON.parse(await readFile(deltaPath, "utf8"));
    assert.equal(hashCanonicalJson(delta), retry.retryAuthority?.retryDeltaHash);
    assert.equal(delta.previousRequestHash, parent.requestHash);
    assert.equal(delta.changes.length, 1);
    assert.notEqual(delta.changes[0].previousHash, delta.changes[0].nextHash);
  });

  it("forbids unchanged retry input and stops the same fingerprint after the bounded second attempt", async () => {
    const unchangedRoot = await repoRoot("unchanged-retry");
    const unchangedValue = fixture(1);
    const unchangedRepository = new FakeAttemptRepository();
    let unchangedDispatches = 0;
    const unchanged = await runDesignSourceCompilationAttemptsV2(
      runnerInput(unchangedRoot, unchangedValue),
      {
        repository: unchangedRepository,
        dispatchStage: async () => {
          unchangedDispatches += 1;
          return rejectedDispatch()();
        },
        materializeAccepted: acceptedMaterializer(),
        planRetry: async ({ stagePrompts }) => ({ stagePrompts }),
      },
    );
    assert.equal(unchanged.status, "rejected");
    if (unchanged.status === "rejected") assert.equal(unchanged.stopReason, "unchanged_retry");
    assert.equal(unchangedDispatches, 1);
    assert.equal(unchangedRepository.reservations.length, 1);

    const repeatedRoot = await repoRoot("repeated-fingerprint");
    const repeatedValue = fixture(1);
    const repeatedRepository = new FakeAttemptRepository();
    let repeatedDispatches = 0;
    const repeated = await runDesignSourceCompilationAttemptsV2(
      runnerInput(repeatedRoot, repeatedValue),
      {
        repository: repeatedRepository,
        dispatchStage: async () => {
          repeatedDispatches += 1;
          return rejectedDispatch(sha("unchanged-fingerprint"))();
        },
        materializeAccepted: acceptedMaterializer(),
        planRetry: async ({ stagePrompts }) => ({
          stagePrompts: stagePrompts.map((stage) => ({ ...stage, prompt: `${stage.prompt}\nchanged` })),
        }),
      },
    );
    assert.equal(repeated.status, "rejected");
    if (repeated.status === "rejected") assert.equal(repeated.stopReason, "repeated_failure");
    assert.equal(repeatedDispatches, 2);
    assert.equal(repeatedRepository.reservations.length, 2);
  });

  it("quarantines a partial-stage crash and never blindly resumes or projects it", async () => {
    const root = await repoRoot("ambiguous");
    const value = fixture(6);
    const repository = new FakeAttemptRepository();
    let materializations = 0;
    let projections = 0;
    const result = await runDesignSourceCompilationAttemptsV2(
      runnerInput(root, value),
      {
        repository,
        dispatchStage: async ({ stage }) => {
          if (stage.stageId === "DSGS_002") throw Object.assign(new Error("socket closed"), { code: "ECONNRESET" });
          return { disposition: "accepted", response: {}, rawEvidence: "stage one durable" };
        },
        materializeAccepted: async (input) => {
          materializations += 1;
          return acceptedMaterializer()(input);
        },
        planRetry: async () => ({ stagePrompts: value.stagePrompts.map((stage) => ({ ...stage, prompt: `${stage.prompt} retry` })) }),
        projectAccepted: async () => {
          projections += 1;
          throw new Error("must not project");
        },
      },
    );
    assert.equal(result.status, "dispatch_ambiguous");
    if (result.status !== "dispatch_ambiguous") return;
    assert.equal(result.attempt.state, "quarantined");
    assert.equal(result.attempt.disposition, "dispatch_ambiguous");
    assert.equal(materializations, 0);
    assert.equal(projections, 0);
    assert.equal(
      await readFile(path.join(root, result.attempt.attemptLocator, "raw", "stages", "DSGS_001", "response.bin"), "utf8"),
      "stage one durable",
    );
  });

  it("recovers only expired reserved work and quarantines expired dispatch intent without replay", async () => {
    const reservedRoot = await repoRoot("expired-reserved");
    const reservedValue = fixture(1, "expired-reserved");
    const reservedRepository = new FakeAttemptRepository();
    const staleReserved = await reservedRepository.reserve({
      runId: reservedValue.authority.runId,
      originClaimId: reservedValue.authority.originClaimId,
      ownerClaimId: 40,
      passKind: "design_source_generation",
      authorityHash: reservedValue.request.authorityHash,
      requestHash: hashCanonicalJson(reservedValue.request),
      ordinal: 1,
      retryAuthority: null,
      ownerInstanceId: "expired-reserved-owner",
    });
    assert.equal(staleReserved.status, "reserved");
    reservedRepository.recoverableAttemptIds.add(staleReserved.attempt.attemptId);
    let reservedDispatches = 0;
    const resumed = await runDesignSourceCompilationAttemptsV2(
      runnerInput(reservedRoot, reservedValue),
      {
        repository: reservedRepository,
        dispatchStage: async () => {
          reservedDispatches += 1;
          return acceptedDispatch("recovered reserved response")();
        },
        materializeAccepted: acceptedMaterializer(),
      },
    );
    assert.equal(resumed.status, "accepted");
    assert.equal(reservedDispatches, 1);
    assert.ok(reservedRepository.events.includes("recover:reserved"));

    const dispatchRoot = await repoRoot("expired-dispatching");
    const dispatchValue = fixture(1, "expired-dispatching");
    const dispatchRepository = new FakeAttemptRepository();
    const stale = await dispatchRepository.reserve({
      runId: dispatchValue.authority.runId,
      originClaimId: dispatchValue.authority.originClaimId,
      ownerClaimId: 40,
      passKind: "design_source_generation",
      authorityHash: dispatchValue.request.authorityHash,
      requestHash: hashCanonicalJson(dispatchValue.request),
      ordinal: 1,
      retryAuthority: null,
      ownerInstanceId: "expired-dispatch-owner",
    });
    assert.equal(stale.status, "reserved");
    const staleDispatch = await dispatchRepository.commitDispatchIntent({
      attemptId: stale.attempt.attemptId,
      externalOperationId: "external-operation-before-crash",
    });
    dispatchRepository.recoverableAttemptIds.add(staleDispatch.attemptId);
    let forbiddenDispatches = 0;
    const quarantined = await runDesignSourceCompilationAttemptsV2(
      runnerInput(dispatchRoot, dispatchValue),
      {
        repository: dispatchRepository,
        dispatchStage: async () => {
          forbiddenDispatches += 1;
          return acceptedDispatch()();
        },
        materializeAccepted: acceptedMaterializer(),
      },
    );
    assert.equal(quarantined.status, "dispatch_ambiguous");
    if (quarantined.status === "dispatch_ambiguous") {
      assert.equal(quarantined.attempt.state, "quarantined");
      assert.deepEqual(quarantined.failure.reasonCodes, ["DESIGN_SOURCE_DISPATCH_LEASE_EXPIRED"]);
      assert.equal(
        quarantined.attempt.dispatch?.externalOperationId,
        "external-operation-before-crash",
      );
    }
    assert.equal(forbiddenDispatches, 0);
    assert.ok(dispatchRepository.events.includes("recover:dispatching"));
  });

  it("separates stable operational cause from request-bound failure fingerprint", async () => {
    const execute = async (suffix: string) => {
      const root = await repoRoot(`cause-${suffix}`);
      const value = fixture(1, suffix);
      const result = await runDesignSourceCompilationAttemptsV2(
        runnerInput(root, value),
        {
          repository: new FakeAttemptRepository(),
          dispatchStage: async () => {
            throw Object.assign(new Error(`socket closed ${suffix}`), { code: "ECONNRESET" });
          },
          materializeAccepted: acceptedMaterializer(),
        },
      );
      assert.equal(result.status, "dispatch_ambiguous");
      if (result.status !== "dispatch_ambiguous") throw new Error("expected ambiguous result");
      return result.failure;
    };
    const left = await execute("left");
    const right = await execute("right");
    assert.equal(left.operationalCauseHash, right.operationalCauseHash);
    assert.notEqual(left.failureFingerprint, right.failureFingerprint);
  });

  it("deduplicates concurrent callers to one provider dispatch and deterministically replays immutable artifacts", async () => {
    const root = await repoRoot("concurrent");
    const value = fixture(1);
    const repository = new FakeAttemptRepository();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let dispatches = 0;
    const dependencies = {
      repository,
      dispatchStage: async (): Promise<DesignSourceGenerationDispatchResultV2> => {
        dispatches += 1;
        await gate;
        return { disposition: "accepted", response: {}, rawEvidence: "one call" };
      },
      materializeAccepted: acceptedMaterializer(),
    };
    const first = runDesignSourceCompilationAttemptsV2(runnerInput(root, value), dependencies);
    while (dispatches === 0) await new Promise((resolve) => setTimeout(resolve, 1));
    const second = runDesignSourceCompilationAttemptsV2(runnerInput(root, value), dependencies);
    release();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.equal(firstResult.status, "accepted");
    assert.equal(secondResult.status, "accepted");
    assert.equal(dispatches, 1);
    if (firstResult.status === "accepted" && secondResult.status === "accepted") {
      assert.equal(firstResult.attempt.attemptId, secondResult.attempt.attemptId);
      assert.equal([firstResult.replayed, secondResult.replayed].filter(Boolean).length, 1);
    }

    const third = await runDesignSourceCompilationAttemptsV2(runnerInput(root, value), dependencies);
    assert.equal(third.status, "accepted");
    if (third.status === "accepted") assert.equal(third.replayed, true);
    assert.equal(dispatches, 1);

    if (third.status !== "accepted") return;
    await writeFile(path.join(root, third.attempt.attemptLocator, "request", "request.json"), "{}", "utf8");
    const tamperedReplay = await runDesignSourceCompilationAttemptsV2(runnerInput(root, value), dependencies);
    assert.equal(tamperedReplay.status, "runner_failure");
    if (tamperedReplay.status === "runner_failure") {
      assert.equal(tamperedReplay.code, "DESIGN_SOURCE_RUNNER_REPLAY_INVALID");
    }
    assert.equal(dispatches, 1);
  });

  it("preserves rejected evidence and cannot replace an existing canonical Stitch projection", async () => {
    const root = await repoRoot("rejected-no-project");
    await mkdir(path.join(root, "stitch"));
    await writeFile(path.join(root, "stitch", "sentinel.txt"), "canonical-before-rejection");
    const value = fixture(1);
    const repository = new FakeAttemptRepository();
    let projections = 0;
    const result = await runDesignSourceCompilationAttemptsV2(
      runnerInput(root, value),
      {
        repository,
        dispatchStage: rejectedDispatch(),
        materializeAccepted: acceptedMaterializer(),
        projectAccepted: async () => {
          projections += 1;
          throw new Error("rejected attempt must never project");
        },
      },
    );
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(projections, 0);
    assert.equal(await readFile(path.join(root, "stitch", "sentinel.txt"), "utf8"), "canonical-before-rejection");
    assert.ok((await readFile(path.join(root, result.attempt.attemptLocator, "raw", "failure.json"))).length > 0);
    assert.equal(
      await readFile(path.join(root, result.attempt.attemptLocator, "raw", "stages", "DSGS_001", "response.bin"), "utf8"),
      "typed provider rejection",
    );
  });

  it("preserves typed materialization rejection instead of flattening it into infrastructure prose", async () => {
    const root = await repoRoot("typed-materialization-rejection");
    const value = fixture(1);
    const rejectionFingerprint = sha("typed-selection-rejection");
    const operationalCauseHash = sha("typed-selection-cause");
    const result = await runDesignSourceCompilationAttemptsV2(
      runnerInput(root, value),
      {
        repository: new FakeAttemptRepository(),
        dispatchStage: acceptedDispatch("direct provider evidence"),
        materializeAccepted: async () => {
          throw new DesignSourceMaterializationFailureV2({
            disposition: "rejected",
            failure: {
              failureFingerprint: rejectionFingerprint,
              operationalCauseHash,
              reasonCodes: ["DESIGN_CANDIDATE_SELECTION_V2_UNRESOLVED"],
              evidence: { targetRefs: ["TARGET_SCREEN_1"] },
            },
          });
        },
      },
    );
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.failure.failureFingerprint, rejectionFingerprint);
    assert.equal(result.failure.operationalCauseHash, operationalCauseHash);
    assert.deepEqual(result.failure.reasonCodes, ["DESIGN_CANDIDATE_SELECTION_V2_UNRESOLVED"]);
    assert.equal(result.stopReason, "no_retry");
  });

  it("redispatches only proven changed stages and carries unchanged parent evidence forward", async () => {
    const root = await repoRoot("stage-scoped-retry");
    const value = fixture(6);
    const repository = new FakeAttemptRepository();
    const externalDispatches: string[] = [];
    const reusedStages: string[] = [];
    const result = await runDesignSourceCompilationAttemptsV2(
      runnerInput(root, value),
      {
        repository,
        dispatchStage: async ({ stage, attempt }) => {
          externalDispatches.push(`${attempt.ordinal}:${stage.stageId}`);
          if (attempt.ordinal === 1 && stage.stageId === "DSGS_002") {
            return {
              disposition: "rejected",
              rawEvidence: "typed stage two rejection",
              failure: {
                failureFingerprint: sha("stage-two-failure"),
                operationalCauseHash: sha("stage-two-cause"),
                reasonCodes: ["DESIGN_TARGET_EVIDENCE_INCOMPLETE"],
                evidence: { failedStageIds: ["DSGS_002"], failedTargetRefs: ["TARGET_SCREEN_6"] },
              },
            };
          }
          return {
            disposition: "accepted",
            response: { stageId: stage.stageId, ordinal: attempt.ordinal },
            rawEvidence: `external:${attempt.ordinal}:${stage.stageId}`,
          };
        },
        reuseStage: async ({ stage, parentAttemptRef }) => {
          reusedStages.push(stage.stageId);
          assert.equal(parentAttemptRef, [...repository.attempts.values()]
            .find((attempt) => attempt.ordinal === 1)?.attemptId);
          return {
            disposition: "accepted",
            response: { stageId: stage.stageId, ordinal: 1 },
            rawEvidence: `reused:${stage.stageId}`,
          };
        },
        materializeAccepted: acceptedMaterializer(),
        planRetry: async ({ stagePrompts, failureEvidence }) => {
          assert.equal((failureEvidence as { stageId?: string }).stageId, "DSGS_002");
          assert.deepEqual((failureEvidence as { providerEvidence?: unknown }).providerEvidence, {
            failedStageIds: ["DSGS_002"],
            failedTargetRefs: ["TARGET_SCREEN_6"],
          });
          return {
            stagePrompts: stagePrompts.map((stage) => stage.stageId === "DSGS_002"
              ? { ...stage, prompt: `${stage.prompt}\nexact stage two repair` }
              : stage),
          };
        },
      },
    );
    assert.equal(result.status, "accepted", JSON.stringify(result));
    if (result.status !== "accepted") return;
    assert.deepEqual(externalDispatches, ["1:DSGS_001", "1:DSGS_002", "2:DSGS_002"]);
    assert.deepEqual(reusedStages, ["DSGS_001"]);
    assert.equal(result.attempt.ordinal, 2);
    assert.equal(
      await readFile(path.join(
        root,
        result.attempt.attemptLocator,
        "raw",
        "stages",
        "DSGS_001",
        "response.bin",
      ), "utf8"),
      "reused:DSGS_001",
    );
  });
});
