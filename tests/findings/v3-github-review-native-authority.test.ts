import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, it } from "node:test";
import ts from "typescript";

import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createRuntimeArtifactReader } from "../../src/product-compiler/runtime-artifact-reader.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { LegacyImplementationSliceV2Schema } from "../../src/product-compiler/schemas/implementation-slice-v2-legacy.js";
import { compileProductBuildPacket } from "../../src/product-compiler/packet-compiler.js";
import { compileImplementationSlice } from "../../src/product-compiler/slice-compiler.js";
import { compileLegacyImplementationSliceV2 } from "../../src/product-compiler/slice-compiler-v2-legacy.js";
import { buildMinimalValidV3Contracts, buildMinimalValidV3PacketV2Contracts } from "../product-compiler/fixtures/minimal-valid-contract.js";
import { nativeJoinPacket, nativeJoinEnvelope, NATIVE_JOIN_LIMITS, NATIVE_JOIN_PRODUCER } from "../execution-attempts/helpers/native-implementation-join-fixture.js";

// Execute the actual private loader without importing the router's live DB and
// service composition. Only its real imports are bound; no authority logic is
// reproduced. The reader below is the real reader, index, and filesystem CAS.
const location = new URL("../../src/findings/v3-github-review-router.ts", import.meta.url);
const source = readFileSync(location, "utf8");
const tree = ts.createSourceFile(location.pathname, source, ts.ScriptTarget.ESNext, true);
const declarations = ["V3GithubReviewRouterError", "loadDefaultImplementationAuthority"].map(name => {
  const declaration = tree.statements.find(statement =>
    (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name?.text === name);
  assert.ok(declaration, `missing production declaration ${name}`);
  return declaration.getText(tree).replace(/^export /, "");
}).join("\n");
const ports = { canonicalJsonStringify, ImplementationSliceV1Schema, LegacyImplementationSliceV2Schema };
const loadAuthority = new Function(...Object.keys(ports), ts.transpileModule(declarations, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText + "; return loadDefaultImplementationAuthority;")(...Object.values(ports));

const RUN = "native-review-authority-test";
const BASE = { sha: "1".repeat(40), treeHash: "2".repeat(40) };
const ACCEPTED = { sha: "3".repeat(40), treeHash: "4".repeat(40) };
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

async function fixture(family: "native" | "legacy-v1" | "legacy-v2" = "native", shared?: "read" | "write") {
  const root = await mkdtemp(path.join(tmpdir(), "setfarm-review-authority-"));
  roots.push(root);
  const store = new ContentAddressedArtifactStore(root, { limits: NATIVE_JOIN_LIMITS });
  const artifacts = new Map<string, any>();
  const refs = new Map<string, string>();
  const put = async (envelope: any) => {
    const result = await store.put(envelope);
    const stored = await store.get(result.hash);
    artifacts.set(result.hash, { artifact_hash: result.hash, artifact_type: envelope.artifactType,
      byte_length: stored.bytes.length, producer_metadata: envelope.producer, created_at: new Date(0) });
    return result;
  };
  let packet: any, compiled: any;
  const storyId = shared ? "US-002" : "US-001";
  if (family === "native") {
    packet = nativeJoinPacket(RUN, Boolean(shared), false, false, undefined, shared === "write");
    const names: Record<string, string> = { productSpec: "PRODUCT_SPEC", buildTopology: "BUILD_TOPOLOGY",
      storyPlan: "STORY_PLAN", designSourceClosure: "DESIGN_SOURCE_CLOSURE", implementationSourceMap: "IMPLEMENTATION_SOURCE_MAP",
      packet: "PRODUCT_BUILD_PACKET", compilationReport: "COMPILATION_REPORT" };
    for (const [key, ref] of Object.entries(names)) {
      const payload = packet[key];
      refs.set(ref, (await put(nativeJoinEnvelope(payload.schema, payload))).hash);
    }
    const input = { packetHash: packet.packetHash, packet: packet.packet, productSpec: packet.productSpec,
      designGraph: packet.designGraph, buildTopology: packet.buildTopology, storyPlan: packet.storyPlan,
      designSourceClosure: packet.designSourceClosure, implementationSourceMap: packet.implementationSourceMap,
      sourceRevision: BASE, producer: packet.producer, currentFiles: packet.buildTopology.pathBindings.map((file: any) => ({
        pathRef: file.id, presence: file.presence, contentHash: file.knownContentHash })), dependencyOutputs: [] };
    let dependencyOutputs: any[] = [];
    if (shared) {
      const first = compileLegacyImplementationSliceV2({ ...input, storyId: "US-001",
        currentFiles: input.currentFiles.filter((file: any) => file.pathRef === "PATH_APP") });
      assert.equal(first.status, "compiled", JSON.stringify(first));
      if (first.status !== "compiled") assert.fail("native dependency fixture rejected");
      dependencyOutputs = [{ storyId: "US-001", sliceHash: first.sliceHash, outputHash: hashCanonicalJson(first.slice.files),
        sourceAfter: BASE, fileSignatures: first.slice.files.filter(file => file.role === "owned").map(({ role, ...file }) => file) }];
    }
    compiled = compileLegacyImplementationSliceV2({ ...input, storyId, dependencyOutputs });
  } else {
    const values = family === "legacy-v2" ? buildMinimalValidV3PacketV2Contracts() : buildMinimalValidV3Contracts();
    const compilation = await compileProductBuildPacket({ ...values, compiler: { version: "3.0.0", codeSha: NATIVE_JOIN_PRODUCER.codeSha },
      producer: NATIVE_JOIN_PRODUCER, protocol: "v3", artifactStore: { put } });
    assert.equal(compilation.status, "sealed", JSON.stringify(compilation.diagnostics));
    packet = { ...values, packet: compilation.packet, packetHash: compilation.packetHash, producer: NATIVE_JOIN_PRODUCER };
    for (const [key, ref] of Object.entries({ productSpec: "PRODUCT_SPEC", designGraph: "DESIGN_GRAPH", buildTopology: "BUILD_TOPOLOGY",
      storyPlan: "STORY_PLAN", designSourceClosure: "DESIGN_SOURCE_CLOSURE" })) {
      const hash = compilation.artifactHashes[key as keyof typeof compilation.artifactHashes];
      if (hash) refs.set(ref, hash);
    }
    refs.set("PRODUCT_BUILD_PACKET", compilation.packetHash!);
    refs.set("COMPILATION_REPORT", compilation.reportHash);
    compiled = compileImplementationSlice({ packetHash: packet.packetHash, packet: packet.packet, productSpec: values.productSpec,
      designGraph: values.designGraph, buildTopology: values.buildTopology, storyPlan: values.storyPlan, storyId,
      sourceRevision: BASE, producer: packet.producer,
      fileSnapshots: { PATH_APP: { presence: "present", contentHash: values.hashes.HASH_A } }, dependencySignatures: {} });
  }
  assert.equal(compiled.status, "compiled", JSON.stringify(compiled.diagnostics));
  const sliceHash = (await put(compiled.envelope)).hash;
  const row = { story_db_id: "story-db-test", story_status: "done", attempt_id: "attempt-test", packet_hash: packet.packetHash,
    slice_hash: sliceHash, source_after_sha: ACCEPTED.sha, source_after_tree_hash: ACCEPTED.treeHash,
    disposition: "verified", claim_outcome: "completed" };
  let rows = [row];
  // This port serves only SELECTs. Unexpected queries (including mutations) fail.
  const sql = { async unsafe(query: string, args: any[]) {
    if (query.includes("FROM runs WHERE")) return [{ protocol: "v3", status: "running", compiler_release_sha: NATIVE_JOIN_PRODUCER.codeSha, packet_hash: packet.packetHash }];
    if (query.includes("FROM run_artifact_refs r")) {
      const hash = refs.get(args[1]); const artifact = hash && artifacts.get(hash);
      return artifact ? [{ run_id: RUN, ref_key: args[1], artifact_hash: hash, artifact_type: artifact.artifact_type, created_at: new Date(0) }] : [];
    }
    if (query === "SELECT * FROM semantic_artifacts WHERE artifact_hash = $1") return artifacts.has(args[0]) ? [artifacts.get(args[0])] : [];
    if (query.includes("FROM stories story")) {
      assert.deepEqual(args, [RUN, storyId, packet.packetHash, ACCEPTED.sha]);
      assert.match(query, /attempt\.step_id = 'implement'/);
      assert.match(query, /attempt\.attempt_class IN \('product_implementation', 'supervisor_repair'\)/);
      assert.match(query, /attempt\.disposition IN \('produced_delta', 'already_satisfied', 'verified'\)/);
      assert.match(query, /attempt\.source_after_sha = \$4/);
      assert.match(query, /LIMIT 2/);
      return rows;
    }
    throw Error(`unexpected SQL: ${query}`);
  } };
  const reader = createRuntimeArtifactReader({ sql: sql as any, artifactRoot: root, artifactLimits: NATIVE_JOIN_LIMITS, publicationAuthorityMode: "standalone" });
  const invoke = (paths = [shared ? "src/notes.ts" : compiled.slice.files[0].path], overrides = {}) =>
    loadAuthority({ sql, reader, runId: RUN, storyId, headSha: ACCEPTED.sha, paths, ...overrides });
  return { invoke, reader, packet, slice: compiled.slice, row, artifacts, sliceHash, store, put,
    setRows(value: typeof rows) { rows = value; } };
}

it("loads native terminal authority at accepted head while the sealed slice retains its initial base", async () => {
  const value = await fixture();
  assert.deepEqual(value.slice.sourceRevision, BASE);
  assert.notEqual(BASE.sha, ACCEPTED.sha);
  assert.equal((await value.reader.readExactSealedPacket(RUN)).packet.packetVersion, 3);
  const authority = await value.invoke();
  assert.deepEqual(authority, { packetHash: value.packet.packetHash, producer: NATIVE_JOIN_PRODUCER,
    storyDbId: "story-db-test", attemptId: "attempt-test", contractSliceHash: value.sliceHash,
    sourceRevision: ACCEPTED, evidencePlan: [
      "EVID_INVOCATION_4860CC797DED4B82BCB3F584692A9A3056C5D7577F21E8560CCD8EFCD13C5781", "EVID_TASK_ADDED",
    ].sort() });
});

it("accepts the native slice family after an exact packet has already been authenticated", async () => {
  const value = await fixture();
  // Isolate the second historical refusal using the real exact reader at the
  // old reader port. Both methods still execute real schema/index/CAS checks.
  const reader = { ...value.reader, readSealedPacket: value.reader.readExactSealedPacket };
  assert.equal((await value.invoke(undefined, { reader })).contractSliceHash, value.sliceHash);
});

for (const family of ["legacy-v1", "legacy-v2"] as const) it(`preserves ${family} slice authority and required evidence`, async () => {
  const value = await fixture(family);
  const authority = await value.invoke();
  assert.deepEqual(authority.evidencePlan, ["EVID_SAVE_CONFIRMATION", "EVID_SAVE_RELOAD"]);
  assert.deepEqual(authority.sourceRevision, ACCEPTED);
  assert.equal(authority.contractSliceHash, value.sliceHash);
});

for (const shared of ["read", "write"] as const) it(`honors schema-validated native shared ${shared} ownership`, async () => {
  const value = await fixture("native", shared);
  assert.equal(value.slice.files.find((file: any) => file.path === "src/index.ts").role, shared === "write" ? "shared_writable" : "shared_readonly");
  assert.ok(await value.invoke(["src/notes.ts"]));
  if (shared === "write") assert.ok(await value.invoke(["src/index.ts"]));
  else await assert.rejects(value.invoke(["src/index.ts"]), { code: "V3_GITHUB_REVIEW_PATH_OUTSIDE_OWNERSHIP" });
  await assert.rejects(value.invoke(["src/unknown.ts"]), { code: "V3_GITHUB_REVIEW_PATH_OUTSIDE_OWNERSHIP" });
});

for (const family of ["native", "legacy-v1"] as const) {
  it(`refuses ${family} crossed slice families before granting authority`, async () => {
    const value = await fixture(family);
    const other = await fixture(family === "native" ? "legacy-v1" : "native");
    value.row.slice_hash = (await value.put(await other.store.get(other.sliceHash).then(stored => stored.envelope))).hash;
    await assert.rejects(value.invoke(), { code: "V3_GITHUB_REVIEW_SLICE_ARTIFACT_MISMATCH" });
  });
  for (const control of ["missing", "duplicate", "story", "packet", "head", "tree", "claim"] as const) it(`refuses ${family} ${control} terminal authority drift`, async () => {
    const value = await fixture(family);
    if (control === "missing") value.setRows([]);
    if (control === "duplicate") value.setRows([value.row, { ...value.row, attempt_id: "another-attempt" }]);
    if (control === "story") value.row.story_status = "running";
    if (control === "packet") value.row.packet_hash = "f".repeat(64);
    if (control === "head") value.row.source_after_sha = BASE.sha;
    if (control === "tree") value.row.source_after_tree_hash = "";
    if (control === "claim") value.row.claim_outcome = "failed";
    await assert.rejects(value.invoke(), { code: "V3_GITHUB_REVIEW_IMPLEMENTATION_AUTHORITY_MISSING" });
  });
  for (const control of ["index-missing", "index-type", "index-bytes", "index-producer", "cas-producer", "identity", "cas-corrupt"] as const) it(`refuses ${family} ${control} slice provenance drift`, async () => {
    const value = await fixture(family);
    const indexed = value.artifacts.get(value.sliceHash);
    if (control === "index-missing") value.artifacts.delete(value.sliceHash);
    if (control === "index-type") indexed.artifact_type = "setfarm.implementation-slice.v9";
    if (control === "index-bytes") indexed.byte_length++;
    if (control === "index-producer") indexed.producer_metadata = { ...NATIVE_JOIN_PRODUCER, pass: "another-producer" };
    if (control === "cas-producer" || control === "identity") {
      const stored = await value.store.get(value.sliceHash);
      const envelope = structuredClone(stored.envelope);
      if (control === "cas-producer") envelope.producer.pass = "another-producer";
      else envelope.payload.packetHash = "f".repeat(64);
      value.row.slice_hash = (await value.put(envelope)).hash;
      if (control === "cas-producer") value.artifacts.get(value.row.slice_hash).producer_metadata = NATIVE_JOIN_PRODUCER;
    }
    if (control === "cas-corrupt") await writeFile(value.store.pathFor(value.sliceHash), "{}");
    await assert.rejects(value.invoke());
  });
}
