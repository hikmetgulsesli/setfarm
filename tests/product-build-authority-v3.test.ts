import assert from "node:assert/strict";
import test from "node:test";

import { readVersionedProductBuildAuthority } from "../src/server/product-build-authority.js";
import { createSyntheticAuthorityFixture } from "./product-compiler/fixtures/product-authority-v3-synthetic.js";

for (const status of ["running", "cancelled"] as const) {
  test(`Stage A native graphless ${status}: exact-reader control then existing explicit-v3 dispatcher`, async (t) => {
    const fixture = await createSyntheticAuthorityFixture({ kind: "none", status });
    try {
      const exact = status === "running"
        ? await fixture.reader.readExactSealedPacket(fixture.runId)
        : await fixture.reader.auditExactTerminalPacket(fixture.runId);
      assert.equal(exact.packet.schema, "setfarm.product-build-packet.v3", "Stage A exact-reader control: native packet schema");
      assert.deepEqual(exact.productSpec, fixture.expectedWire.packetAuthority.productSpec, "Stage A exact-reader control: real ProductSpec payload identity");
      const { schema: _schema, authorityHash: _hash, ...expectedExact } = fixture.expectedWire.packetAuthority;
      assert.deepEqual(exact, expectedExact, "Stage A exact-reader control: complete exact CAS result identity");
      fixture.assertUnusedConfiguration(`real exact-reader ${status} control complete`);
      t.diagnostic(`Stage A exact-reader control PASS: ${status}; next assertion is the retained compatibility seam`);
      try {
        await assert.doesNotReject(async () => {
          // Reflect passes the proposed version to the existing export without
          // widening any native payload to a legacy packet type.
          const actual = await Reflect.apply(readVersionedProductBuildAuthority, undefined, [{
            schema: "v3", reader: fixture.reader, runId: fixture.runId, refusalOptions: fixture.refusalOptions,
          }]);
          assert.equal(actual.schema, "setfarm.product-build-authority.v3", "Stage A explicit-v3 wire selection");
          assert.deepEqual(actual, fixture.expectedWire, "Stage A exact native authority wire identity");
        }, "Stage A existing dispatcher must accept exact native authority after exact-reader control PASS");
      } finally { fixture.assertUnusedConfiguration(`existing explicit-v3 dispatcher ${status} settled`); }
    } finally { await fixture.close(); }
  });
}

// Stage B regressions follow Root-qualified original Stage A RED. The original
// assertions above remain unchanged and exercise the same existing dispatcher.
import { hashCanonicalJson } from "../src/product-compiler/canonical-json.js";
import { RuntimeArtifactReaderError } from "../src/product-compiler/runtime-artifact-reader.js";
import { readProductBuildAuthorityV3, produceSealedProductBuildAuthorityV3 } from "../src/server/product-build-authority-v3.js";
import { ProductBuildAuthorityV3Schema } from "../src/server/schemas/product-build-authority-v3.js";
import type { SyntheticAuthorityFixture } from "./product-compiler/fixtures/product-authority-v3-synthetic.js";

for (const kind of ["none", "stitch"] as const) {
  for (const status of ["running", "cancelled", "failed"] as const) {
    test(`Stage B ${kind} ${status}: exact reader produces the complete golden v3 authority`, async () => {
      const fixture = await createSyntheticAuthorityFixture({ kind, status });
      try {
        const actual = await readProductBuildAuthorityV3(fixture.reader, fixture.runId, fixture.refusalOptions);
        assert.deepEqual(actual, fixture.expectedWire);
        assert.equal(actual.disposition, "sealed_packet");
        if (actual.disposition !== "sealed_packet" || actual.packetAuthority.schema !== "setfarm.product-build-packet-authority.v3") throw new Error("Expected exact native branch");
        if (kind === "none") {
          assert.equal(actual.packetAuthority.designGraph, null);
          assert.equal(actual.packetAuthority.refs.designGraph, null);
          assert.deepEqual(actual.packetAuthority.implementationSourceMap.screens, []);
        } else {
          assert.equal(actual.packetAuthority.designSources?.responseBindings.schema, "setfarm.stitch-target-response-bindings.v3");
          const records = fixture.records();
          assert.notDeepEqual(records.nested.generationTargets.producer, actual.packetAuthority.producer, "Distinct nested producers are valid exact authority");
        }
        await assert.rejects(fixture.reader.readSealedPacket(fixture.runId), (error: unknown) => error instanceof RuntimeArtifactReaderError && error.code === (status === "running" ? "RUNTIME_ARTIFACT_TYPE_MISMATCH" : "RUNTIME_PACKET_NOT_ACTIVE"));
        fixture.assertUnusedConfiguration("Stage B golden native authority");
      } finally { await fixture.close(); }
    });
  }
}

const BAD_HASH = "0".repeat(64);
type Mutation = { name: string; kind?: "none" | "stitch"; code: string; change(fixture: SyntheticAuthorityFixture): void | Promise<void>; refusalQueries?: number };
const mutations: Mutation[] = [
  { name: "missing run", code: "RUNTIME_PACKET_RUN_NOT_FOUND", change: f => f.mutate("run", { __missing: true }) },
  { name: "unknown protocol", code: "RUNTIME_PACKET_RUN_NOT_V3", change: f => f.mutate("run", { protocol: "v99" }) },
  { name: "unknown status is neither active nor terminal", code: "RUNTIME_PACKET_NOT_TERMINAL", change: f => f.mutate("run", { status: "unrecognized" }) },
  { name: "null packet hash with no refusal", code: "RUNTIME_PACKET_NOT_SEALED", refusalQueries: 1, change: f => f.mutate("run", { packet_hash: null }) },
  { name: "missing canonical ref", code: "RUNTIME_ARTIFACT_REF_MISSING", change: f => f.mutate("refs", { BUILD_TOPOLOGY: null }) },
  { name: "missing immutable index", code: "RUNTIME_ARTIFACT_INDEX_MISMATCH", change: f => f.mutate("index", { [f.records().refs.BUILD_TOPOLOGY.artifact_hash]: null }) },
  { name: "unknown packet type", code: "RUNTIME_ARTIFACT_TYPE_MISMATCH", change: f => { const r = f.records().refs; f.mutate("refs", { PRODUCT_BUILD_PACKET: { ...r.PRODUCT_BUILD_PACKET, artifact_type: "setfarm.product-build-packet.v99" } }); } },
  { name: "wrong child type", code: "RUNTIME_ARTIFACT_TYPE_MISMATCH", change: f => { const r = f.records().refs; f.mutate("refs", { PRODUCT_SPEC: { ...r.PRODUCT_SPEC, artifact_type: "setfarm.product-spec.v1" } }); } },
  { name: "packet column differs from exact ref", code: "RUNTIME_PACKET_NOT_SEALED", refusalQueries: 1, change: f => f.mutate("run", { packet_hash: BAD_HASH }) },
  { name: "corrupt CAS bytes", code: "RUNTIME_ARTIFACT_INDEX_MISMATCH", change: f => f.corruptBytes("STORY_PLAN") },
  { name: "wrong indexed byte length", code: "RUNTIME_ARTIFACT_INDEX_MISMATCH", change: f => { const r = f.records(); const key = r.refs.STORY_PLAN.artifact_hash; f.mutate("index", { [key]: { ...r.index[key], byte_length: r.index[key].byte_length + 1 } }); } },
  { name: "different top-level producer", code: "RUNTIME_PACKET_CHILD_HASH_MISMATCH", change: f => f.replaceArtifact("BUILD_TOPOLOGY", { producer: { ...f.records().envelopes.BUILD_TOPOLOGY.producer, pass: "synthetic-wrong-top-level" } }) },
  { name: "compiler release differs", code: "RUNTIME_PACKET_RELEASE_MISMATCH", change: f => f.mutate("run", { compiler_release_sha: "d".repeat(40) }) },
  { name: "report differs after valid envelope rehash", code: "RUNTIME_PACKET_REPORT_MISMATCH", change: f => { const report = f.records().envelopes.COMPILATION_REPORT.payload; report.artifactHashes.productSpecV2 = BAD_HASH; return f.replaceArtifact("COMPILATION_REPORT", { payload: report }); } },
  { name: "source-map payload authority differs after envelope rehash", code: "RUNTIME_PACKET_IMPLEMENTATION_SOURCE_MAP_MISMATCH", change: f => { const map = f.records().envelopes.IMPLEMENTATION_SOURCE_MAP.payload; map.productSpecV2PayloadHash = BAD_HASH; return f.replaceArtifact("IMPLEMENTATION_SOURCE_MAP", { payload: map }); } },
  ...(["targetHash", "responseBindingHash"] as const).map(field => ({ name: `native screen ${field} differs after envelope rehash`, kind: "stitch" as const, code: "RUNTIME_PACKET_IMPLEMENTATION_SOURCE_MAP_MISMATCH", change: (f: SyntheticAuthorityFixture) => { const map = f.records().envelopes.IMPLEMENTATION_SOURCE_MAP.payload; map.screens[0][field] = BAD_HASH; return f.replaceArtifact("IMPLEMENTATION_SOURCE_MAP", { payload: map }); } })),
  { name: "closure child payload differs from exact typed payload hash", kind: "stitch", code: "RUNTIME_ARTIFACT_INDEX_MISMATCH", change: async f => {
    const records = f.records();
    const child = records.nested.generationTargets;
    child.payload.productSpecHash = BAD_HASH;
    const hash = await f.publishNested("generationTargets", child);
    const closure = records.envelopes.DESIGN_SOURCE_CLOSURE.payload;
    closure.generationTargets.envelopeHash = hash;
    // Preserve the wrong child payloadHash while explicitly satisfying the
    // earlier source-map/closure check, so the real nested read is reached.
    assert.notEqual(closure.generationTargets.payloadHash, hashCanonicalJson(child.payload));
    await f.replaceArtifact("DESIGN_SOURCE_CLOSURE", { payload: closure });
    const sourceMap = f.records().envelopes.IMPLEMENTATION_SOURCE_MAP.payload;
    sourceMap.designSourceClosureV2PayloadHash = hashCanonicalJson(closure);
    await f.replaceArtifact("IMPLEMENTATION_SOURCE_MAP", { payload: sourceMap });
  } },
];
for (const mutation of mutations) {
  test(`Stage B real reader refuses ${mutation.name}`, async () => {
    const fixture = await createSyntheticAuthorityFixture({ kind: mutation.kind ?? "none" });
    try {
      await mutation.change(fixture);
      await assert.rejects(readProductBuildAuthorityV3(fixture.reader, fixture.runId, fixture.refusalOptions), (error: unknown) => {
        assert.ok(error instanceof RuntimeArtifactReaderError, "Expected existing real-reader error, not fixture/setup failure");
        assert.equal(error.code, mutation.code);
        return true;
      });
      assert.equal(fixture.refusalQueryCount(), mutation.refusalQueries ?? 0, "Only the reader's not-sealed code may inspect refusal rows");
      fixture.assertUnusedConfiguration("real-reader mutation settled");
    } finally { await fixture.close(); }
  });
}

function rehashWire(wire: any): void {
  const { authorityHash: _native, ...packetIdentity } = wire.packetAuthority;
  wire.packetAuthority.authorityHash = hashCanonicalJson(packetIdentity);
  const { authorityHash: _outer, ...identity } = wire;
  wire.authorityHash = hashCanonicalJson(identity);
}
for (const tamper of [
  { name: "incomplete Stitch sources", kind: "stitch" as const, change: (wire: any) => { delete wire.packetAuthority.designSources.candidateSelection; } },
  { name: "graphless packet with a contradictory graph ref", kind: "none" as const, change: (wire: any) => { wire.packetAuthority.refs.designGraph = BAD_HASH; } },
  { name: "top-level producer mismatch despite wrapper rehash", kind: "none" as const, change: (wire: any) => { wire.packetAuthority.producer.pass = "synthetic-tampered-producer"; } },
  { name: "payload hash mismatch despite wrapper rehash", kind: "none" as const, change: (wire: any) => { wire.packetAuthority.productSpec.product.name = "Changed synthetic product"; } },
  { name: "run identity mismatch despite wrapper rehash", kind: "none" as const, change: (wire: any) => { wire.runId = "different-synthetic-run"; } },
]) {
  test(`Stage B v3 wire rejects ${tamper.name}`, async () => {
    const fixture = await createSyntheticAuthorityFixture({ kind: tamper.kind });
    try {
      const wire = structuredClone(fixture.expectedWire);
      assert.equal(ProductBuildAuthorityV3Schema.safeParse(wire).success, true, "Unmodified native wire must pass before testing its specific tamper");
      tamper.change(wire);
      rehashWire(wire);
      assert.equal(ProductBuildAuthorityV3Schema.safeParse(wire).success, false);
    } finally { await fixture.close(); }
  });
}

import { readFile } from "node:fs/promises";
import { produceProductBuildAuthorityV1, ProductBuildAuthorityV2Error } from "../src/server/product-build-authority.js";
import { produceRefusedProductBuildAuthorityV3 } from "../src/server/product-build-authority-v3.js";
import { ProductBuildRefusalV2Schema } from "../src/server/schemas/product-build-authority-v2.js";

for (const kind of ["legacy1", "legacy2"] as const) {
  for (const status of ["running", "cancelled"] as const) {
    test(`Stage B ${kind} ${status}: v3 nests unchanged real-reader v1 authority and defaults remain v2`, async () => {
      const fixture = await createSyntheticAuthorityFixture({ kind, status });
      try {
        const exact = status === "running" ? await fixture.reader.readExactSealedPacket(fixture.runId) : await fixture.reader.auditExactTerminalPacket(fixture.runId);
        if (exact.packet.schema === "setfarm.product-build-packet.v3") throw new Error("Expected actual legacy packet");
        // A typed legacy read avoids any native-to-legacy conversion.
        const legacy = status === "running" ? await fixture.reader.readSealedPacket(fixture.runId) : await fixture.reader.auditTerminalPacket(fixture.runId);
        assert.deepEqual(produceProductBuildAuthorityV1(legacy), fixture.expectedWire.packetAuthority);
        assert.deepEqual(produceSealedProductBuildAuthorityV3(exact), fixture.expectedWire);
        assert.deepEqual(await readVersionedProductBuildAuthority({ schema: "v3", reader: fixture.reader, runId: fixture.runId, refusalOptions: fixture.refusalOptions }), fixture.expectedWire);
        const v1 = await readVersionedProductBuildAuthority({ schema: "v1", reader: fixture.reader, runId: fixture.runId, refusalOptions: fixture.refusalOptions });
        assert.deepEqual(v1, fixture.expectedWire.packetAuthority);
        for (const schema of [undefined, "v2"] as const) {
          const v2 = await readVersionedProductBuildAuthority({ schema, reader: fixture.reader, runId: fixture.runId, refusalOptions: fixture.refusalOptions });
          assert.equal(v2.schema, "setfarm.product-build-authority.v2");
          if (v2.schema !== "setfarm.product-build-authority.v2") throw new Error("Expected retained default/explicit v2");
          assert.deepEqual(v2.packetAuthority, fixture.expectedWire.packetAuthority);
        }
        fixture.assertUnusedConfiguration("legacy/default compatibility settled");
      } finally { await fixture.close(); }
    });
  }
}

async function authoredRefusalWire() {
  const corpus = JSON.parse(await readFile(new URL("./fixtures/product-build-authority-v3-wire.json", import.meta.url), "utf8"));
  return structuredClone(corpus.cases.find((entry: { name: string }) => entry.name === "refused_before_packet").wire);
}

test("Stage B pure refusal producer preserves exact failure authority and canonical v3 outer hash", async () => {
  const wire = await authoredRefusalWire();
  const refusal = ProductBuildRefusalV2Schema.parse(wire.refusal);
  assert.deepEqual(produceRefusedProductBuildAuthorityV3(wire.runId, refusal), wire);
  assert.deepEqual(ProductBuildAuthorityV3Schema.parse(wire), wire);
  assert.equal(wire.packetAuthority, null);
});

for (const tamper of [
  { name: "exact failure fingerprint differs", change: (wire: any) => { wire.refusal.failureIdentity.exactFailure.failureFingerprint = BAD_HASH; } },
  { name: "exact candidate authority differs", change: (wire: any) => { wire.refusal.failureIdentity.exactFailure.candidateSelectionHash = BAD_HASH; } },
  { name: "failure envelope hash differs", change: (wire: any) => { wire.refusal.failureArtifact.artifactHash = BAD_HASH; wire.refusal.failureIdentity.exactFailure.failureArtifactHash = BAD_HASH; } },
  { name: "inner fingerprint invalid despite envelope and outer rehash", change: (wire: any) => { const artifact = wire.refusal.failureArtifact; artifact.envelope.payload.fingerprint = BAD_HASH; artifact.artifactHash = hashCanonicalJson(artifact.envelope); wire.refusal.failureIdentity.exactFailure.failureArtifactHash = artifact.artifactHash; wire.refusal.failureIdentity.exactFailure.failureFingerprint = BAD_HASH; } },
  { name: "invalid envelope producer", change: (wire: any) => { wire.refusal.failureArtifact.envelope.producer.codeSha = "invalid"; } },
  { name: "refusal/packet exclusivity violated", change: (wire: any) => { wire.packetAuthority = {}; } },
  { name: "noncanonical termination ref", change: (wire: any) => { wire.refusal.terminationRequestRef = "https://synthetic.invalid/refusal"; } },
]) {
  test(`Stage B pure refusal rejects ${tamper.name}`, async () => {
    const wire = await authoredRefusalWire();
    tamper.change(wire);
    const { authorityHash: _outer, ...identity } = wire;
    wire.authorityHash = hashCanonicalJson(identity);
    assert.equal(ProductBuildAuthorityV3Schema.safeParse(wire).success, false, "Inner refusal refinements must still fail after valid outer rehash");
  });
}

type EarlyRefusal = { name: string; code?: string; syntaxError?: boolean; change(f: SyntheticAuthorityFixture): void };
const earlyRefusals: EarlyRefusal[] = [
  { name: "ambiguous terminations", code: "PRODUCT_BUILD_REFUSAL_TERMINATION_AMBIGUOUS", change: f => { const row = f.authoredRefusal.termination; f.setTerminations([row, { ...row, request_id: "synthetic-second-request" }]); } },
  { name: "wrong canonical requester", code: "PRODUCT_BUILD_REFUSAL_TERMINATION_INVALID", change: f => f.setTerminations([{ ...f.authoredRefusal.termination, requested_by: "synthetic-wrong-requester" }]) },
  { name: "nonfailed termination target", code: "PRODUCT_BUILD_REFUSAL_TERMINATION_INVALID", change: f => f.setTerminations([{ ...f.authoredRefusal.termination, target_status: "cancelled" }]) },
  { name: "nonterminalized termination", code: "PRODUCT_BUILD_REFUSAL_TERMINATION_INVALID", change: f => f.setTerminations([{ ...f.authoredRefusal.termination, state: "pending" }]) },
  { name: "malformed raw evidence JSON propagates SyntaxError", syntaxError: true, change: f => f.setTerminations([{ ...f.authoredRefusal.termination, evidence: "{broken" }]) },
  { name: "invalid evidence object", code: "PRODUCT_BUILD_REFUSAL_TERMINATION_INVALID", change: f => f.setTerminations([{ ...f.authoredRefusal.termination, evidence: [] }]) },
  { name: "missing immutable failure ref", code: "PRODUCT_BUILD_REFUSAL_ARTIFACT_REF_MISSING", change: f => f.mutate("refs", { STITCH_TARGET_CANDIDATE_SELECTION_FAILURE: null }) },
  { name: "wrong failure ref hash", code: "PRODUCT_BUILD_REFUSAL_ARTIFACT_REF_INVALID", change: f => { const r = f.records(); const key = r.refs.STITCH_TARGET_CANDIDATE_SELECTION_FAILURE.artifact_hash; const row = { ...r.index[key], artifact_hash: BAD_HASH }; f.mutate("refs", { STITCH_TARGET_CANDIDATE_SELECTION_FAILURE: [row] }); } },
  { name: "ambiguous immutable failure refs", code: "PRODUCT_BUILD_REFUSAL_ARTIFACT_REF_INVALID", change: f => { const r = f.records(); const key = r.refs.STITCH_TARGET_CANDIDATE_SELECTION_FAILURE.artifact_hash; f.mutate("refs", { STITCH_TARGET_CANDIDATE_SELECTION_FAILURE: [r.index[key], r.index[key]] }); } },
  { name: "invalid index producer metadata", code: "PRODUCT_BUILD_REFUSAL_ARTIFACT_INDEX_INVALID", change: f => { const r = f.records(); const key = r.refs.STITCH_TARGET_CANDIDATE_SELECTION_FAILURE.artifact_hash; f.mutate("index", { [key]: { ...r.index[key], producer_metadata: { invalid: true } } }); } },
  { name: "nonpositive indexed length", code: "PRODUCT_BUILD_REFUSAL_ARTIFACT_INDEX_INVALID", change: f => { const r = f.records(); const key = r.refs.STITCH_TARGET_CANDIDATE_SELECTION_FAILURE.artifact_hash; f.mutate("index", { [key]: { ...r.index[key], byte_length: 0 } }); } },
  { name: "nonnumeric indexed length", code: "PRODUCT_BUILD_REFUSAL_ARTIFACT_INDEX_INVALID", change: f => { const r = f.records(); const key = r.refs.STITCH_TARGET_CANDIDATE_SELECTION_FAILURE.artifact_hash; f.mutate("index", { [key]: { ...r.index[key], byte_length: "not-a-number" } }); } },
];
for (const early of earlyRefusals) {
  test(`Stage B actual refusal delegation stops before mode resolution: ${early.name}`, async () => {
    const fixture = await createSyntheticAuthorityFixture({ kind: "none" });
    try {
      await fixture.installSyntheticRefusal();
      early.change(fixture);
      await assert.rejects(readProductBuildAuthorityV3(fixture.reader, fixture.runId, fixture.refusalOptions), (error: unknown) => {
        if (early.syntaxError) assert.ok(error instanceof SyntaxError);
        else { assert.ok(error instanceof ProductBuildAuthorityV2Error); assert.equal(error.code, early.code); }
        return true;
      });
      assert.equal(fixture.refusalQueryCount(), 1, "Actual NOT_SEALED orchestration must inspect unchanged refusal reader rows");
      fixture.assertUnusedConfiguration("safe early refusal failure");
    } finally { await fixture.close(); }
  });
}
// Selected campaign deliberately does not execute successful configured refusal,
// hybrid/default selection, store.get mapping, post-mode CAS/index/provenance or
// runtime fingerprint/candidate equality. Root's adopted refinement keeps those
// later integration checks UNVERIFIED/PENDING; this file never relaxes the guard.

for (const status of ["cancelled", "failed"] as const) {
  test(`Stage B ${status} unsealed run with no refusal preserves not-sealed`, async () => {
    const fixture = await createSyntheticAuthorityFixture({ kind: "none", status });
    try {
      fixture.mutate("run", { packet_hash: null });
      await assert.rejects(readProductBuildAuthorityV3(fixture.reader, fixture.runId, fixture.refusalOptions), (error: unknown) => error instanceof RuntimeArtifactReaderError && error.code === "RUNTIME_PACKET_NOT_SEALED");
      assert.equal(fixture.refusalQueryCount(), 1);
      fixture.assertUnusedConfiguration("terminal no-refusal result");
    } finally { await fixture.close(); }
  });
}

// Final I1 regression: SF permits omitted outcome metadata. MC must accept the
// same exact authority without filling absent fields or dropping hash checks.
type OutcomeSide = "success" | "failure";
type OptionalOutcomeField = "persistenceRefs" | "userVisible";
const outcomeOmissions: Array<{ name: string; sides: OutcomeSide[]; fields: OptionalOutcomeField[] }> = [
  { name: "success persistenceRefs", sides: ["success"], fields: ["persistenceRefs"] },
  { name: "success userVisible", sides: ["success"], fields: ["userVisible"] },
  { name: "success both optional fields", sides: ["success"], fields: ["persistenceRefs", "userVisible"] },
  { name: "failure persistenceRefs", sides: ["failure"], fields: ["persistenceRefs"] },
  { name: "failure userVisible", sides: ["failure"], fields: ["userVisible"] },
  { name: "failure both optional fields", sides: ["failure"], fields: ["persistenceRefs", "userVisible"] },
  { name: "both outcomes both optional fields", sides: ["success", "failure"], fields: ["persistenceRefs", "userVisible"] },
];

// Only the graphless/no-persistence fixture is eligible for this construction:
// empty persistence refs do not affect the deterministic story partition, and
// userVisible is not a partition input. No closure/source/producer is rebuilt.
function rebindOutcomeWire(wire: any): void {
  const native = wire.packetAuthority;
  assert.equal(native.designGraph, null);
  assert.equal(native.refs.designGraph, null);
  assert.deepEqual(native.productSpec.persistencePolicies, []);
  assert.deepEqual(native.implementationSourceMap.screens, []);
  const specHash = hashCanonicalJson(native.productSpec);
  native.storyPlan.productSpecHash = specHash;
  native.implementationSourceMap.productSpecV2PayloadHash = specHash;
  native.implementationSourceMap.storyPlanV2PayloadHash = hashCanonicalJson(native.storyPlan);
  // This authored fixture's sole report input is the spec payload, not an
  // unrelated task/source identity. Rebind it explicitly with the changed spec.
  native.compilationReport.inputHashes = [specHash];
  const envelopeHash = (payload: any) => payload === null ? null : hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1", artifactType: payload.schema,
    producer: native.producer, payload,
  });
  for (const [field, packetField, reportField] of [
    ["productSpec", "productSpecV2Hash", "productSpecV2"],
    ["designGraph", "designGraphV2Hash", "designGraphV2"],
    ["buildTopology", "buildTopologyV1Hash", "buildTopologyV1"],
    ["storyPlan", "storyPlanV2Hash", "storyPlanV2"],
    ["designSourceClosure", "designSourceClosureV2Hash", "designSourceClosureV2"],
    ["implementationSourceMap", "implementationSourceMapV1Hash", "implementationSourceMapV1"],
  ] as const) {
    native.refs[field] = envelopeHash(native[field]);
    native.packet[packetField] = native.refs[field];
    native.compilationReport.artifactHashes[reportField] = native.refs[field];
  }
  native.packetHash = native.refs.packet = envelopeHash(native.packet);
  native.compilationReport.packetHash = native.packetHash;
  native.refs.compilationReport = envelopeHash(native.compilationReport);
  rehashWire(wire);
}

for (const omission of outcomeOmissions) {
  test(`Final I1 SF actual schema and exact-reader accept omitted ${omission.name}`, async () => {
    const fixture = await createSyntheticAuthorityFixture({ kind: "none" });
    try {
      assert.deepEqual(ProductBuildAuthorityV3Schema.parse(fixture.expectedWire), fixture.expectedWire, "Unchanged SF baseline remains valid");
      const wire = structuredClone(fixture.expectedWire);
      const native = wire.packetAuthority;
      const action = native.productSpec.actions[0];
      assert.deepEqual(native.compilationReport.inputHashes, [hashCanonicalJson(native.productSpec)], "Confirm authored report input identity before rebinding");
      for (const side of omission.sides) {
        assert.deepEqual(action[side].persistenceRefs, [], "Only empty, unused persistence refs may be omitted");
        for (const field of omission.fields) delete action[side][field];
      }
      rebindOutcomeWire(wire);
      assert.notEqual(wire.authorityHash, fixture.expectedWire.authorityHash);
      const parsed = ProductBuildAuthorityV3Schema.parse(wire);
      assert.deepEqual(parsed, wire, "Actual SF schema accepts exact omissions without defaults");
      if (parsed.disposition !== "sealed_packet" || parsed.packetAuthority.schema !== "setfarm.product-build-packet-authority.v3") throw new Error("Expected native omission control");
      for (const side of omission.sides) for (const field of omission.fields) {
        assert.equal(Object.hasOwn(parsed.packetAuthority.productSpec.actions[0]![side], field), false);
      }
      await fixture.replaceArtifact("PRODUCT_SPEC", { payload: native.productSpec });
      await fixture.replaceArtifact("STORY_PLAN", { payload: native.storyPlan });
      await fixture.replaceArtifact("IMPLEMENTATION_SOURCE_MAP", { payload: native.implementationSourceMap });
      await fixture.replaceArtifact("COMPILATION_REPORT", { payload: native.compilationReport });
      const records = fixture.records();
      assert.equal(records.run.packet_hash, native.packetHash, "Synthetic run points to the new exact packet");
      assert.equal(records.refs.PRODUCT_SPEC.artifact_hash, native.refs.productSpec);
      assert.equal(records.refs.STORY_PLAN.artifact_hash, native.refs.storyPlan);
      assert.equal(records.refs.IMPLEMENTATION_SOURCE_MAP.artifact_hash, native.refs.implementationSourceMap);
      assert.equal(records.refs.COMPILATION_REPORT.artifact_hash, native.refs.compilationReport);
      const exact = await fixture.reader.readExactSealedPacket(fixture.runId);
      const { schema: _schema, authorityHash: _hash, ...expectedExact } = native;
      assert.deepEqual(exact, expectedExact, "Unchanged real reader reproduces the story and reads the exact reindexed CAS payloads");
      assert.deepEqual(produceSealedProductBuildAuthorityV3(exact), wire, "Existing native producer preserves every omitted key and rebound hash");
      fixture.assertUnusedConfiguration("Final I1 native omission control");
    } finally { await fixture.close(); }
  });
}

for (const side of ["success", "failure"] as const) {
  for (const control of [
    { name: "wrong persistenceRefs type", change: (outcome: any) => { outcome.persistenceRefs = "invalid-list"; } },
    { name: "wrong userVisible type", change: (outcome: any) => { outcome.userVisible = "true"; } },
    { name: "missing required stateRefs", change: (outcome: any) => { delete outcome.stateRefs; } },
    { name: "missing required evidenceRefs", change: (outcome: any) => { delete outcome.evidenceRefs; } },
    { name: "unknown outcome key", change: (outcome: any) => { outcome.futureOutcome = true; } },
  ]) {
    test(`Final I1 SF actual schema rejects ${side} ${control.name} with all hashes rebound`, async () => {
      const fixture = await createSyntheticAuthorityFixture({ kind: "none" });
      try {
        const wire = structuredClone(fixture.expectedWire);
        assert.equal(ProductBuildAuthorityV3Schema.safeParse(wire).success, true);
        control.change(wire.packetAuthority.productSpec.actions[0][side]);
        rebindOutcomeWire(wire);
        const result = ProductBuildAuthorityV3Schema.safeParse(wire);
        assert.equal(result.success, false);
        if (result.success) throw new Error("Expected invalid native outcome");
        assert.ok(result.error.issues.some(issue => issue.path.includes(side)), "Failure must concern the changed outcome, not a stale hash");
        fixture.assertUnusedConfiguration("Final I1 native invalid-outcome control");
      } finally { await fixture.close(); }
    });
  }
}
