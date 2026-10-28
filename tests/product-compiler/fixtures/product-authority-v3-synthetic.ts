import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type postgres from "postgres";

import { canonicalJsonBytes, hashCanonicalJson } from "../../../src/product-compiler/canonical-json.js";
import { createRuntimeArtifactReader } from "../../../src/product-compiler/runtime-artifact-reader.js";
import type { VerifiedDesignCandidateRefusalReadOptions } from "../../../src/server/product-build-authority.js";

// Authored inert payloads only. Never import the active reader suite/browser fixture.
const REF_KEYS = {
  productSpec: "PRODUCT_SPEC", designGraph: "DESIGN_GRAPH", buildTopology: "BUILD_TOPOLOGY", storyPlan: "STORY_PLAN",
  designSourceClosure: "DESIGN_SOURCE_CLOSURE", implementationSourceMap: "IMPLEMENTATION_SOURCE_MAP",
  packet: "PRODUCT_BUILD_PACKET", compilationReport: "COMPILATION_REPORT",
} as const;
const CHILD_FIELDS = {
  PRODUCT_SPEC: ["productSpecV2Hash", "productSpecV2"], DESIGN_GRAPH: ["designGraphV2Hash", "designGraphV2"],
  BUILD_TOPOLOGY: ["buildTopologyV1Hash", "buildTopologyV1"], STORY_PLAN: ["storyPlanV2Hash", "storyPlanV2"],
  DESIGN_SOURCE_CLOSURE: ["designSourceClosureV2Hash", "designSourceClosureV2"], IMPLEMENTATION_SOURCE_MAP: ["implementationSourceMapV1Hash", "implementationSourceMapV1"],
} as const;
const STAMP = "2026-01-01T00:00:00.000Z";
const LIMITS = { maxPayloadBytes: 4 * 1024 * 1024, rootQuotaBytes: 32 * 1024 * 1024, minFreeBytes: 0 };
const RUN_QUERY = "SELECT protocol, status, compiler_release_sha, packet_hash FROM runs WHERE id = $1 LIMIT 1";
const REF_QUERY = "SELECT r.run_id, r.ref_key, r.artifact_hash, a.artifact_type, r.created_at FROM run_artifact_refs r JOIN semantic_artifacts a ON a.artifact_hash = r.artifact_hash WHERE r.run_id = $1 AND r.ref_key = $2";
const INDEX_QUERY = "SELECT * FROM semantic_artifacts WHERE artifact_hash = $1";
const TERMINATION_QUERY = "SELECT request_id, target_status, state, requested_by, evidence FROM run_termination_requests WHERE run_id = $1 AND requested_by = $2 ORDER BY request_id";
const FAILURE_REF_QUERY = "SELECT r.artifact_hash, a.artifact_type, a.byte_length, a.producer_metadata FROM run_artifact_refs r JOIN semantic_artifacts a ON a.artifact_hash = r.artifact_hash WHERE r.run_id = $1 AND r.ref_key = $2";

type JsonRecord = Record<string, any>;
function assertUnusedConfiguration(phase: string): void {
  const state = Reflect.get(globalThis, Symbol.for("setfarm.pba.sf-inert-import-guard.v1"));
  assert.equal(state?.active, true, `SF configuration isolation guard inactive: ${phase}`);
  assert.equal(state.schema, "setfarm.pba.sf-inert-import-guard.v1", `SF guard identity: ${phase}`);
  assert.deepEqual(state.loads, { "runtime-config": 1, "fresh-installation-selection-v1": 1 }, `Exact inert modules must already be loaded: ${phase}`);
  assert.deepEqual(state.calls, { resolveArtifactStorePublicationAuthorityMode: 0, selectedFreshInstallationRootV1: 0 }, `Unused configuration boundaries must have ZERO calls: ${phase}`);
}
export async function createSyntheticAuthorityFixture(options: {
  kind: "stitch" | "none" | "legacy1" | "legacy2"; status?: string;
}) {
  assertUnusedConfiguration("fixture entry; separate from deliberate isolation probes");
  const authoredRoot = JSON.parse(await readFile(new URL("../../fixtures/product-build-authority-v3-payloads.json", import.meta.url), "utf8"));
  const authored = options.kind === "none" ? authoredRoot : authoredRoot.cases[options.kind];
  if (!authored) throw new Error(`Synthetic fixture case not authored: ${options.kind}`);
  const corpus = JSON.parse(await readFile(new URL("../../fixtures/product-build-authority-v3-wire.json", import.meta.url), "utf8"));
  const caseName = options.kind.startsWith("legacy") ? options.kind : `native_${options.kind}`;
  const expectedWire = structuredClone(corpus.cases.find((entry: JsonRecord) => entry.name === caseName).wire);
  const runId: string = authored.runId;
  const envelopes: JsonRecord = {};
  const index: JsonRecord = {};
  const refs: JsonRecord = {};
  const nested: JsonRecord = structuredClone(authored.nestedEnvelopes ?? {});
  const terminations: JsonRecord[] = [];
  let refusalQueries = 0;
  function indexEnvelope(envelope: JsonRecord) {
    const hash = hashCanonicalJson(envelope);
    index[hash] = { artifact_hash: hash, artifact_type: envelope.artifactType, byte_length: canonicalJsonBytes(envelope).byteLength, producer_metadata: envelope.producer, created_at: STAMP };
    return hash;
  }
  for (const envelope of Object.values(nested) as JsonRecord[]) indexEnvelope(envelope);
  for (const [payloadKey, refKey] of Object.entries(REF_KEYS)) {
    const payload = authored.payloads[payloadKey];
    if (payload === undefined || payload === null) continue;
    const envelope = { schema: "setfarm.semantic-artifact-envelope.v1", artifactType: payload.schema, producer: authored.producer, payload };
    const hash = indexEnvelope(envelope);
    if (expectedWire.packetAuthority.refs[payloadKey] !== hash) throw new Error(`Synthetic corpus envelope mismatch: ${payloadKey}`);
    envelopes[refKey] = envelope;
    refs[refKey] = { run_id: runId, ref_key: refKey, artifact_hash: hash, artifact_type: payload.schema, created_at: STAMP };
  }
  const run: JsonRecord = { protocol: "v3", status: options.status ?? "running", compiler_release_sha: authored.producer.codeSha, packet_hash: refs.PRODUCT_BUILD_PACKET.artifact_hash };
  const sqlPort = new Proxy(function deniedSqlCall() { throw new Error("SYNTHETIC_SQL_CALL_FORBIDDEN"); }, {
    get(_target, property) {
      if (property !== "unsafe") throw new Error(`SYNTHETIC_SQL_PROPERTY_FORBIDDEN: ${String(property)}`);
      return async (query: string, parameters: unknown[] = []) => {
        const normalized = query.replace(/\s+/g, " ").trim();
        if (normalized === RUN_QUERY && parameters.length === 1 && parameters[0] === runId) return run.__missing ? [] : [structuredClone(run)];
        if (normalized === REF_QUERY && parameters.length === 2 && parameters[0] === runId && typeof parameters[1] === "string") {
          const row = refs[parameters[1]];
          return row ? [structuredClone(row)] : [];
        }
        if (normalized === INDEX_QUERY && parameters.length === 1 && typeof parameters[0] === "string") {
          const row = index[parameters[0]];
          return row ? [structuredClone(row)] : [];
        }
        if (normalized === TERMINATION_QUERY && parameters.length === 2 && parameters[0] === runId && parameters[1] === "setfarm.product-compiler.design-refusal") {
          refusalQueries += 1;
          return structuredClone(terminations);
        }
        if (normalized === FAILURE_REF_QUERY && parameters.length === 2 && parameters[0] === runId && parameters[1] === "STITCH_TARGET_CANDIDATE_SELECTION_FAILURE") {
          const ref = refs.STITCH_TARGET_CANDIDATE_SELECTION_FAILURE;
          if (Array.isArray(ref)) return structuredClone(ref);
          return ref && index[ref.artifact_hash] ? [{ ...structuredClone(index[ref.artifact_hash]), artifact_hash: ref.artifact_hash }] : [];
        }
        throw new Error(`SYNTHETIC_SQL_QUERY_FORBIDDEN: ${normalized}`);
      };
    },
  }) as unknown as postgres.Sql;
  const root = await mkdtemp(join(tmpdir(), "setfarm-pba-v3-stage-a-"));
  const close = async (): Promise<void> => {
    try { await rm(root, { recursive: true, force: true }); }
    finally { assertUnusedConfiguration("fixture close after cleanup"); }
  };
  try {
    const reader = createRuntimeArtifactReader({ sql: sqlPort, artifactRoot: root, artifactLimits: LIMITS, publicationAuthorityMode: "standalone" });
    assertUnusedConfiguration("real standalone reader/index/CAS construction");
    for (const envelope of [...Object.values(nested), ...Object.values(envelopes)]) await reader.store.put(envelope);
    assertUnusedConfiguration("real standalone CAS publication");
    const refusalOptions: VerifiedDesignCandidateRefusalReadOptions = { sql: sqlPort, artifactRoot: root, artifactLimits: LIMITS, artifactReadPort: reader.store };
    async function publish(refKey: string): Promise<string> {
      const envelope = envelopes[refKey];
      await reader.store.put(envelope);
      const hash = indexEnvelope(envelope);
      refs[refKey] = { run_id: runId, ref_key: refKey, artifact_hash: hash, artifact_type: envelope.artifactType, created_at: STAMP };
      assertUnusedConfiguration(`explicit synthetic artifact publication: ${refKey}`);
      return hash;
    }
    return {
      runId, reader, refusalOptions, expectedWire, assertUnusedConfiguration,
      authoredRefusal: structuredClone(authoredRoot.refusal),
      records: () => structuredClone({ run, index, refs, envelopes, nested }),
      refusalQueryCount: () => refusalQueries,
      setTerminations(rows: JsonRecord[]): void { terminations.splice(0, terminations.length, ...structuredClone(rows)); },
      async installSyntheticRefusal(): Promise<void> {
        const envelope = structuredClone(authoredRoot.refusal.envelope);
        await reader.store.put(envelope);
        const hash = indexEnvelope(envelope);
        refs.STITCH_TARGET_CANDIDATE_SELECTION_FAILURE = { run_id: runId, ref_key: "STITCH_TARGET_CANDIDATE_SELECTION_FAILURE", artifact_hash: hash, artifact_type: envelope.artifactType, created_at: STAMP };
        terminations.splice(0, terminations.length, structuredClone(authoredRoot.refusal.termination));
        run.status = "failed";
        run.packet_hash = null;
        assertUnusedConfiguration("synthetic refusal publication only; configured reader success is not qualified");
      },
      // Record mutation never silently repairs hashes or rewrites published CAS.
      mutate(layer: "run" | "index" | "refs" | "envelopes", patch: JsonRecord): void {
        Object.assign({ run, index, refs, envelopes }[layer], structuredClone(patch));
      },
      // Explicit republishing rebinds only packet/report envelope refs. Payload
      // semantic relationships stay unchanged so reader corruption tests are real.
      async replaceArtifact(refKey: string, patch: JsonRecord): Promise<void> {
        if (!Object.hasOwn(envelopes, refKey)) throw new Error(`Unknown synthetic ref: ${refKey}`);
        Object.assign(envelopes[refKey], structuredClone(patch));
        const hash = await publish(refKey);
        if (refKey === "COMPILATION_REPORT") return;
        const fields = CHILD_FIELDS[refKey as keyof typeof CHILD_FIELDS];
        if (fields) {
          envelopes.PRODUCT_BUILD_PACKET.payload[fields[0]] = hash;
          envelopes.COMPILATION_REPORT.payload.artifactHashes[fields[1]] = hash;
        }
        const packetHash = refKey === "PRODUCT_BUILD_PACKET" ? hash : await publish("PRODUCT_BUILD_PACKET");
        run.packet_hash = packetHash;
        envelopes.COMPILATION_REPORT.payload.packetHash = packetHash;
        await publish("COMPILATION_REPORT");
      },
      async publishNested(key: string, envelope: JsonRecord): Promise<string> {
        if (!Object.hasOwn(nested, key)) throw new Error(`Unknown synthetic nested source: ${key}`);
        nested[key] = structuredClone(envelope);
        await reader.store.put(nested[key]);
        assertUnusedConfiguration(`explicit nested publication: ${key}`);
        return indexEnvelope(nested[key]);
      },
      async corruptBytes(refKey: string): Promise<void> {
        if (!Object.hasOwn(refs, refKey)) throw new Error(`Unknown synthetic ref: ${refKey}`);
        await writeFile(reader.store.pathFor(refs[refKey].artifact_hash), "corrupt synthetic artifact bytes");
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
export type SyntheticAuthorityFixture = Awaited<ReturnType<typeof createSyntheticAuthorityFixture>>;
