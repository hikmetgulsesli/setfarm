import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  ARTIFACT_CLOSURE_EVIDENCE_SCHEMA_V1,
  ARTIFACT_CLOSURE_REGISTRY_V1,
  ArtifactClosureEvidenceV1Schema,
  ArtifactClosureEvidenceError,
  evaluateArtifactClosureV1,
  prepareArtifactClosureEvidenceSetV1,
} from "../../src/product-compiler/artifact-closure.js";
import type { ArtifactGetResult } from "../../src/product-compiler/artifact-store.js";
import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
import {
  BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  BYTE_BUNDLE_RAW_MAX_BYTES_V1,
  BYTE_CHUNK_ARTIFACT_TYPE_V1,
  BYTE_CHUNK_RAW_MAX_BYTES_V1,
  createByteBundleV1,
  type ByteBundleBuildResultV1,
} from "../../src/product-compiler/schemas/byte-bundle-v1.js";

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function producer() {
  return {
    pass: "artifact-closure-test",
    codeSha: "a".repeat(40),
    toolVersions: { node: process.versions.node },
  };
}

function leafEnvelope(id: string) {
  return {
    schema: "setfarm.semantic-artifact-envelope.v1" as const,
    artifactType: "setfarm.artifact-closure-leaf.v1",
    producer: producer(),
    payload: { id },
  };
}

function artifact(envelope: any): ArtifactGetResult {
  const bytes = canonicalJsonBytes(envelope);
  const hash = sha256(bytes);
  return {
    hash,
    path: `/artifact/${hash}.json`,
    envelope,
    bytes,
  };
}

function identity(value: ArtifactGetResult) {
  return {
    hash: value.hash,
    artifactType: value.envelope.artifactType,
    byteLength: value.bytes.length,
    producer: value.envelope.producer,
  };
}

type ProducedBundle = Extract<ByteBundleBuildResultV1, { status: "produced" }>;

function mustProduce(bytes: Uint8Array): ProducedBundle {
  const result = createByteBundleV1({ bytes, producer: producer() });
  assert.equal(
    result.status,
    "produced",
    result.status === "rejected" ? JSON.stringify(result) : undefined,
  );
  if (result.status !== "produced") throw new Error("Expected ByteBundleV1");
  return result;
}

function bundleArtifacts(bundle: ProducedBundle): ArtifactGetResult[] {
  return [
    ...bundle.chunks.map((chunk) => artifact(chunk.envelope)),
    artifact(bundle.bundle.envelope),
  ];
}

function evaluateBundle(
  root: ArtifactGetResult,
  artifacts: readonly ArtifactGetResult[],
) {
  return evaluateArtifactClosureV1({
    evidence: prepareArtifactClosureEvidenceSetV1(artifacts),
    root: identity(root),
    role: "dependency-root",
  });
}

describe("artifact closure registry v1", () => {
  it("treats an explicitly ordinary artifact as one publishable tier-zero leaf", () => {
    const root = artifact(leafEnvelope("ordinary"));
    const result = evaluateArtifactClosureV1({
      evidence: prepareArtifactClosureEvidenceSetV1([root]),
      root: identity(root),
      role: "leaf",
    });

    assert.equal(result.schema, ARTIFACT_CLOSURE_EVIDENCE_SCHEMA_V1);
    assert.equal(ArtifactClosureEvidenceV1Schema.safeParse(result).success, true);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.members), true);
    assert.equal(Object.isFrozen(result.members[0]?.observed?.producer.toolVersions), true);
    assert.equal(result.status, "verified");
    assert.equal(result.classification, "ARTIFACT_CLOSURE_VERIFIED");
    assert.deepEqual(result.members.map((member) => ({
      hash: member.expected.hash,
      tier: member.durabilityTier,
      role: member.role,
      evidence: member.evidence,
      publishable: member.publishable,
    })), [{
      hash: root.hash,
      tier: 0,
      role: "root",
      evidence: "exact",
      publishable: true,
    }]);
  });

  it("does not apply the narrower ByteChunk envelope limit to a generic CAS leaf", () => {
    const root = artifact({
      ...leafEnvelope("large-ordinary"),
      payload: { padding: "x".repeat((3 * 1024 * 1024) + 1) },
    });
    const result = evaluateArtifactClosureV1({
      evidence: prepareArtifactClosureEvidenceSetV1([root]),
      root: identity(root),
      role: "leaf",
    });
    assert.equal(result.status, "verified");
    assert.equal(result.members[0]?.publishable, true);
  });

  it("requires every exact ByteChunk identity before making a ByteBundle root publishable", () => {
    const produced = mustProduce(Buffer.alloc(BYTE_CHUNK_RAW_MAX_BYTES_V1 + 1, 0x31));
    const all = bundleArtifacts(produced);
    const root = all.at(-1)!;
    const verified = evaluateBundle(root, all);

    assert.equal(verified.status, "verified");
    assert.deepEqual(
      verified.members.map((member) => [
        member.durabilityTier,
        member.role,
        member.expected.hash,
        member.publishable,
      ]),
      [
        ...produced.chunks
          .map((chunk) => chunk.envelopeHash)
          .sort()
          .map((hash) => [0, "dependency", hash, true]),
        [1, "root", root.hash, true],
      ],
    );

    const missing = evaluateBundle(root, [all[0]!, root]);
    assert.equal(missing.status, "rejected");
    assert.equal(missing.classification, "ARTIFACT_CLOSURE_DEPENDENCY_MISSING");
    assert.equal(missing.members.at(-1)?.publishable, false);
    assert.equal(
      missing.members.filter((member) => member.role === "dependency")
        .some((member) => member.evidence === "missing" && !member.publishable),
      true,
    );
  });

  it("returns one deterministic typed classification for every bundle mismatch class", () => {
    const one = mustProduce(Buffer.from([0x41]));
    const exactChunk = artifact(one.chunks[0]!.envelope);

    const cases: Array<Readonly<{
      name: string;
      rootEnvelope: any;
      members: readonly ArtifactGetResult[];
      classification: string;
    }>> = [];

    const wrongType = artifact(leafEnvelope("wrong-type"));
    const wrongTypeRoot = structuredClone(one.bundle.envelope) as any;
    wrongTypeRoot.payload.chunks[0].chunkEnvelopeHash = wrongType.hash;
    wrongTypeRoot.payload.chunks[0].chunkEnvelopeByteLength = wrongType.bytes.length;
    cases.push({
      name: "type",
      rootEnvelope: wrongTypeRoot,
      members: [wrongType],
      classification: "ARTIFACT_CLOSURE_DEPENDENCY_TYPE_MISMATCH",
    });

    const wrongEnvelopeLength = structuredClone(one.bundle.envelope) as any;
    wrongEnvelopeLength.payload.chunks[0].chunkEnvelopeByteLength += 1;
    cases.push({
      name: "envelope-length",
      rootEnvelope: wrongEnvelopeLength,
      members: [exactChunk],
      classification: "ARTIFACT_CLOSURE_DEPENDENCY_ENVELOPE_LENGTH_MISMATCH",
    });

    const wrongRawHash = structuredClone(one.bundle.envelope) as any;
    wrongRawHash.payload.chunks[0].chunkRawHash = sha256("wrong-raw");
    cases.push({
      name: "raw-hash",
      rootEnvelope: wrongRawHash,
      members: [exactChunk],
      classification: "ARTIFACT_CLOSURE_DEPENDENCY_RAW_HASH_MISMATCH",
    });

    const wrongRawLength = structuredClone(one.bundle.envelope) as any;
    wrongRawLength.payload.rawByteLength = 2;
    wrongRawLength.payload.chunks[0].rawByteLength = 2;
    cases.push({
      name: "raw-length",
      rootEnvelope: wrongRawLength,
      members: [exactChunk],
      classification: "ARTIFACT_CLOSURE_DEPENDENCY_RAW_LENGTH_MISMATCH",
    });

    const wrongBundleRawHash = structuredClone(one.bundle.envelope) as any;
    wrongBundleRawHash.payload.rawHash = sha256("wrong-bundle");
    cases.push({
      name: "bundle-raw-hash",
      rootEnvelope: wrongBundleRawHash,
      members: [exactChunk],
      classification: "ARTIFACT_CLOSURE_BUNDLE_RAW_HASH_MISMATCH",
    });

    for (const fixture of cases) {
      const root = artifact(fixture.rootEnvelope);
      const result = evaluateBundle(root, [...fixture.members, root]);
      assert.equal(result.status, "rejected", fixture.name);
      assert.equal(result.classification, fixture.classification, fixture.name);
      assert.equal(result.members.at(-1)?.publishable, false, fixture.name);
    }

    const two = mustProduce(Buffer.alloc(BYTE_CHUNK_RAW_MAX_BYTES_V1 + 1, 0x42));
    const wrongOrdinalEnvelope = structuredClone(two.bundle.envelope) as any;
    wrongOrdinalEnvelope.payload.chunks[0].ordinal = 1;
    wrongOrdinalEnvelope.payload.chunks[1].ordinal = 0;
    const wrongOrdinalRoot = artifact(wrongOrdinalEnvelope);
    const ordinal = evaluateBundle(wrongOrdinalRoot, [
      ...two.chunks.map((chunk) => artifact(chunk.envelope)),
      wrongOrdinalRoot,
    ]);
    assert.equal(ordinal.status, "rejected");
    assert.equal(ordinal.classification, "ARTIFACT_CLOSURE_DEPENDENCY_ORDINAL_MISMATCH");
  });

  it("rejects non-fresh hash evidence and duplicate evidence with typed codes", () => {
    const value = artifact(leafEnvelope("freshness"));
    const wrongHash = { ...value, hash: sha256("wrong") };
    assert.throws(
      () => prepareArtifactClosureEvidenceSetV1([wrongHash]),
      (error: unknown) =>
        error instanceof ArtifactClosureEvidenceError
        && error.code === "ARTIFACT_CLOSURE_EVIDENCE_HASH_MISMATCH",
    );
    assert.throws(
      () => prepareArtifactClosureEvidenceSetV1([value, value]),
      (error: unknown) =>
        error instanceof ArtifactClosureEvidenceError
        && error.code === "ARTIFACT_CLOSURE_EVIDENCE_DUPLICATE",
    );
  });

  it("owns parsed evidence after preparation instead of retaining caller bytes", () => {
    const value = artifact(leafEnvelope("immutable-preparation"));
    const expected = identity(value);
    const evidence = prepareArtifactClosureEvidenceSetV1([value]);
    value.bytes.fill(0);
    (value.envelope.payload as { id: string }).id = "mutated";

    const result = evaluateArtifactClosureV1({
      evidence,
      root: expected,
      role: "leaf",
    });

    assert.equal(result.status, "verified");
    assert.equal(result.members[0]?.expected.hash, expected.hash);
  });

  it("allows repeated manifest occurrences to share one exact physical chunk", () => {
    const raw = Buffer.alloc(BYTE_CHUNK_RAW_MAX_BYTES_V1 * 2, 0x5a);
    const produced = mustProduce(raw);
    assert.equal(produced.chunks[0]!.envelopeHash, produced.chunks[1]!.envelopeHash);
    const uniqueChunk = artifact(produced.chunks[0]!.envelope);
    const root = artifact(produced.bundle.envelope);

    const result = evaluateBundle(root, [uniqueChunk, root]);

    assert.equal(result.status, "verified");
    assert.equal(result.members.length, 2);
    assert.deepEqual(result.members.map((member) => member.durabilityTier), [0, 1]);
  });

  it("rejects conflicting metadata for one repeated physical chunk identity", () => {
    const raw = Buffer.alloc(BYTE_CHUNK_RAW_MAX_BYTES_V1 * 2, 0x5b);
    const produced = mustProduce(raw);
    assert.equal(produced.chunks[0]!.envelopeHash, produced.chunks[1]!.envelopeHash);
    const conflictingEnvelope = structuredClone(produced.bundle.envelope) as any;
    conflictingEnvelope.payload.chunks[1].chunkRawHash = sha256("conflicting-repeat");
    const root = artifact(conflictingEnvelope);
    const chunk = artifact(produced.chunks[0]!.envelope);

    const result = evaluateBundle(root, [chunk, root]);

    assert.equal(result.status, "rejected");
    assert.equal(
      result.classification,
      "ARTIFACT_CLOSURE_DEPENDENCY_DUPLICATE_CONFLICT",
    );
    assert.equal(result.members.filter((member) => member.role === "dependency").length, 1);
    assert.equal(result.members.at(-1)?.publishable, false);
  });

  it("requires a registered validator for an explicitly dependency-bearing type", () => {
    const unknown = artifact(leafEnvelope("unknown-dependency-root"));
    const evidence = prepareArtifactClosureEvidenceSetV1([unknown]);
    const rejected = evaluateArtifactClosureV1({
      evidence,
      root: identity(unknown),
      role: "dependency-root",
    });
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.classification, "ARTIFACT_CLOSURE_VALIDATOR_REQUIRED");

    const leaf = evaluateArtifactClosureV1({
      evidence,
      root: identity(unknown),
      role: "leaf",
    });
    assert.equal(leaf.status, "verified");
  });

  it("classifies an empty fresh inventory and expected-root drift without guessing", () => {
    const root = artifact(leafEnvelope("missing-root"));
    const empty = evaluateArtifactClosureV1({
      evidence: prepareArtifactClosureEvidenceSetV1([]),
      root: identity(root),
      role: "leaf",
    });
    assert.equal(empty.status, "rejected");
    assert.equal(empty.classification, "ARTIFACT_CLOSURE_ROOT_MISSING");
    assert.equal(empty.members[0]?.evidence, "missing");

    const expected = identity(root);
    const drifted = evaluateArtifactClosureV1({
      evidence: prepareArtifactClosureEvidenceSetV1([root]),
      root: { ...expected, byteLength: expected.byteLength + 1 },
      role: "leaf",
    });
    assert.equal(drifted.status, "rejected");
    assert.equal(drifted.classification, "ARTIFACT_CLOSURE_ROOT_IDENTITY_MISMATCH");
    assert.equal(drifted.members[0]?.observed?.hash, root.hash);
  });

  it("rejects declaring the registered ByteBundle dependency root as a leaf", () => {
    const produced = mustProduce(Buffer.from([0x61]));
    const root = artifact(produced.bundle.envelope);
    const result = evaluateArtifactClosureV1({
      evidence: prepareArtifactClosureEvidenceSetV1([root]),
      root: identity(root),
      role: "leaf",
    });
    assert.equal(result.status, "rejected");
    assert.equal(result.classification, "ARTIFACT_CLOSURE_ROLE_MISMATCH");
  });

  it("emits a stable hash-ordered maximum nine-member registry result", () => {
    const raw = Buffer.alloc(BYTE_BUNDLE_RAW_MAX_BYTES_V1);
    for (let index = 0; index < 8; index += 1) {
      raw.fill(index + 1, index * BYTE_CHUNK_RAW_MAX_BYTES_V1,
        (index + 1) * BYTE_CHUNK_RAW_MAX_BYTES_V1);
    }
    const produced = mustProduce(raw);
    const all = bundleArtifacts(produced);
    const root = all.at(-1)!;
    const evidence = prepareArtifactClosureEvidenceSetV1([...all].reverse());
    const first = evaluateArtifactClosureV1({
      evidence,
      root: identity(root),
      role: "dependency-root",
    });
    const second = evaluateArtifactClosureV1({
      evidence,
      root: identity(root),
      role: "dependency-root",
    });

    assert.equal(ARTIFACT_CLOSURE_REGISTRY_V1.maxClosureMembers, 9);
    assert.equal(first.status, "verified");
    assert.equal(first.members.length, 9);
    assert.deepEqual(first, second);
    assert.deepEqual(
      first.members.slice(0, 8).map((member) => member.expected.hash),
      produced.chunks.map((chunk) => chunk.envelopeHash).sort(),
    );
    assert.equal(first.members[8]?.expected.hash, root.hash);
  });
});
