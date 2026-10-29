import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeArtifactReaderError,
  type RuntimeArtifactReaderErrorCode,
} from "../src/product-compiler/runtime-artifact-reader.js";
import { ProductBuildAuthorityV2Error } from "../src/server/product-build-authority.js";
import {
  ProductBuildAuthoritySchemaUnsupportedError,
  mapProductBuildAuthorityHttpError,
  readProductBuildAuthorityHttp,
  resolveProductBuildAuthoritySchema,
} from "../src/server/product-build-authority-http.js";
import { createSyntheticAuthorityFixture } from "./product-compiler/fixtures/product-authority-v3-synthetic.js";

// Stage B coverage only: Root already retained causal RED at the existing
// dispatcher. This module exists before any of these tests may be executed.
for (const [query, expected] of [
  ["", "v2"], ["other=value", "v2"], ["schema=v1", "v1"],
  ["schema=v2&other=value", "v2"], ["schema=v3", "v3"],
] as const) {
  test(`HTTP negotiation ${JSON.stringify(query)} selects ${expected}`, () => {
    assert.equal(resolveProductBuildAuthoritySchema(new URLSearchParams(query)), expected);
  });
}

for (const query of [
  "schema=v99", "schema=", "schema", "schema=V3", "schema=%20v3",
  "schema=v3&schema=v3", "schema=v1&schema=v2", "schema=&schema=v3",
]) {
  test(`HTTP rejects ${JSON.stringify(query)} with literal 400 before read-context creation`, async () => {
    assert.throws(() => resolveProductBuildAuthoritySchema(new URLSearchParams(query)), (error: unknown) => {
      assert.ok(error instanceof ProductBuildAuthoritySchemaUnsupportedError);
      assert.equal(error.code, "PRODUCT_BUILD_AUTHORITY_SCHEMA_UNSUPPORTED");
      return true;
    });
    let created = 0;
    const result = await readProductBuildAuthorityHttp({
      query: new URLSearchParams(query), runId: "synthetic-unread-run",
      createReadContext: () => { created += 1; throw new Error("INVALID_NEGOTIATION_CREATED_READER"); },
    });
    assert.deepEqual(result, {
      statusCode: 400,
      body: { schema: "setfarm.product-build-authority-error.v2", runId: "synthetic-unread-run", code: "PRODUCT_BUILD_AUTHORITY_SCHEMA_UNSUPPORTED" },
    });
    assert.equal(created, 0, "Invalid requests cannot acquire SQL, storage or a reader through this callback");
  });
}

// Independent literal v2 hashes over the authored legacy corpus, calculated
// without a production authority producer or the HTTP adapter.
const LEGACY_V2_HASH = {
  legacy1: "7ea9a747271813fa381f235b8bd511331c01b91f022dcafcff855d8041dcf360",
  legacy2: "d049d599b54a0d8230602aec360ecee36a3add8c866e8f14af28283c0d15d76d",
};
for (const kind of ["legacy1", "legacy2"] as const) {
  for (const status of ["running", "cancelled"] as const) {
    for (const schema of [undefined, "v1", "v2"] as const) {
      test(`HTTP ${schema ?? "default"} preserves complete ${kind} ${status} legacy body`, async () => {
        const f = await createSyntheticAuthorityFixture({ kind, status });
        try {
          const result = await readProductBuildAuthorityHttp({
            query: new URLSearchParams(schema ? `schema=${schema}&other=value` : "other=value"), runId: f.runId,
            createReadContext: () => ({ reader: f.reader, refusalOptions: f.refusalOptions }),
          });
          const body = schema === "v1" ? f.expectedWire.packetAuthority : {
            schema: "setfarm.product-build-authority.v2", runId: f.runId, disposition: "sealed_packet",
            packetAuthority: f.expectedWire.packetAuthority, refusal: null, authorityHash: LEGACY_V2_HASH[kind],
          };
          assert.deepEqual(result, { statusCode: 200, body });
          f.assertUnusedConfiguration("HTTP retained legacy/default body");
        } finally { await f.close(); }
      });
    }
  }
}

for (const kind of ["none", "stitch", "legacy1", "legacy2"] as const) {
  for (const status of ["running", "cancelled"] as const) {
    test(`HTTP explicit v3 returns exact ${kind} ${status} corpus including terminal audit`, async () => {
      const f = await createSyntheticAuthorityFixture({ kind, status });
      try {
        const result = await readProductBuildAuthorityHttp({
          query: new URLSearchParams("schema=v3"), runId: f.runId,
          createReadContext: () => ({ reader: f.reader, refusalOptions: f.refusalOptions }),
        });
        assert.deepEqual(result, { statusCode: 200, body: f.expectedWire });
        f.assertUnusedConfiguration("HTTP exact active/terminal v3 body");
      } finally { await f.close(); }
    });
  }
}

// A native packet must never silently change the meaning of a legacy request.
for (const query of ["", "schema=v1", "schema=v2"]) {
  test(`HTTP native packet on legacy request ${JSON.stringify(query)} retains literal type-mismatch 503`, async () => {
    const f = await createSyntheticAuthorityFixture({ kind: "none" });
    try {
      const result = await readProductBuildAuthorityHttp({
        query: new URLSearchParams(query), runId: f.runId,
        createReadContext: () => ({ reader: f.reader, refusalOptions: f.refusalOptions }),
      });
      assert.deepEqual(result, {
        statusCode: 503,
        body: { schema: query === "schema=v1" ? "setfarm.product-build-authority-error.v1" : "setfarm.product-build-authority-error.v2", runId: f.runId, code: "RUNTIME_ARTIFACT_TYPE_MISMATCH" },
      });
      assert.equal(f.refusalQueryCount(), 0, "Type mismatch must not inspect design refusal rows");
    } finally { await f.close(); }
  });
}

const RUNTIME_ERRORS: ReadonlyArray<readonly [RuntimeArtifactReaderErrorCode, number]> = [
  ["RUNTIME_PACKET_RUN_NOT_FOUND", 404],
  ["RUNTIME_PACKET_RUN_NOT_V3", 409], ["RUNTIME_PACKET_NOT_ACTIVE", 409],
  ["RUNTIME_PACKET_NOT_TERMINAL", 409], ["RUNTIME_PACKET_NOT_SEALED", 409],
  ["RUNTIME_ARTIFACT_REF_MISSING", 503], ["RUNTIME_ARTIFACT_TYPE_MISMATCH", 503],
  ["RUNTIME_ARTIFACT_INDEX_MISMATCH", 503], ["RUNTIME_PACKET_RELEASE_MISMATCH", 503],
  ["RUNTIME_PACKET_CHILD_HASH_MISMATCH", 503], ["RUNTIME_PACKET_IMPLEMENTATION_SOURCE_MAP_MISMATCH", 503],
  ["RUNTIME_PACKET_RUNTIME_DATA_MISMATCH", 503], ["RUNTIME_PACKET_RUNTIME_EVIDENCE_MISMATCH", 503],
  ["RUNTIME_PACKET_REPORT_MISMATCH", 503],
];
const REFUSAL_ERRORS = [
  "PRODUCT_BUILD_REFUSAL_TERMINATION_AMBIGUOUS", "PRODUCT_BUILD_REFUSAL_TERMINATION_INVALID",
  "PRODUCT_BUILD_REFUSAL_ARTIFACT_REF_MISSING", "PRODUCT_BUILD_REFUSAL_ARTIFACT_REF_INVALID",
  "PRODUCT_BUILD_REFUSAL_ARTIFACT_INDEX_INVALID", "PRODUCT_BUILD_REFUSAL_ARTIFACT_AUTHORITY_REQUIRED",
  "PRODUCT_BUILD_REFUSAL_ARTIFACT_STORE_INVALID",
] as const;
for (const schema of ["v1", "v2", "v3"] as const) {
  test(`HTTP ${schema} mapping preserves every literal reader/refusal code and selected error namespace`, () => {
    for (const [code, statusCode] of RUNTIME_ERRORS) {
      assert.deepEqual(mapProductBuildAuthorityHttpError(new RuntimeArtifactReaderError(code, "synthetic failure"), schema, "synthetic-run"), {
        statusCode, body: { schema: `setfarm.product-build-authority-error.${schema}`, runId: "synthetic-run", code },
      });
    }
    // Mapping-only coverage includes post-mode codes. It does not verify the
    // successful configured refusal path or call its mode/selection boundary.
    for (const code of REFUSAL_ERRORS) {
      assert.deepEqual(mapProductBuildAuthorityHttpError(new ProductBuildAuthorityV2Error(code, "synthetic refusal"), schema, "synthetic-run"), {
        statusCode: 503, body: { schema: `setfarm.product-build-authority-error.${schema}`, runId: "synthetic-run", code },
      });
    }
  });
}

for (const scenario of [
  { name: "missing run", statusCode: 404, code: "RUNTIME_PACKET_RUN_NOT_FOUND", change: { __missing: true } },
  { name: "non-v3 run", statusCode: 409, code: "RUNTIME_PACKET_RUN_NOT_V3", change: { protocol: "v99" } },
  { name: "unknown terminal state", statusCode: 409, code: "RUNTIME_PACKET_NOT_TERMINAL", change: { status: "unknown" } },
  { name: "not sealed without refusal", statusCode: 409, code: "RUNTIME_PACKET_NOT_SEALED", change: { packet_hash: null } },
  { name: "release integrity mismatch", statusCode: 503, code: "RUNTIME_PACKET_RELEASE_MISMATCH", change: { compiler_release_sha: "d".repeat(40) } },
]) {
  test(`HTTP v3 real reader maps ${scenario.name} to ${scenario.statusCode}`, async () => {
    const f = await createSyntheticAuthorityFixture({ kind: "none" });
    try {
      f.mutate("run", scenario.change);
      const result = await readProductBuildAuthorityHttp({
        query: new URLSearchParams("schema=v3"), runId: f.runId,
        createReadContext: () => ({ reader: f.reader, refusalOptions: f.refusalOptions }),
      });
      assert.deepEqual(result, { statusCode: scenario.statusCode, body: { schema: "setfarm.product-build-authority-error.v3", runId: f.runId, code: scenario.code } });
      assert.equal(f.refusalQueryCount(), scenario.code === "RUNTIME_PACKET_NOT_SEALED" ? 1 : 0);
    } finally { await f.close(); }
  });
}

test("HTTP v3 real early refusal integrity failure stays literal 503 before mode lookup", async () => {
  const f = await createSyntheticAuthorityFixture({ kind: "none" });
  try {
    f.mutate("run", { packet_hash: null });
    f.setTerminations([{ ...f.authoredRefusal.termination, target_status: "cancelled" }]);
    const result = await readProductBuildAuthorityHttp({
      query: new URLSearchParams("schema=v3"), runId: f.runId,
      createReadContext: () => ({ reader: f.reader, refusalOptions: f.refusalOptions }),
    });
    assert.deepEqual(result, { statusCode: 503, body: { schema: "setfarm.product-build-authority-error.v3", runId: f.runId, code: "PRODUCT_BUILD_REFUSAL_TERMINATION_INVALID" } });
    assert.equal(f.refusalQueryCount(), 1);
    f.assertUnusedConfiguration("HTTP early refusal failure");
  } finally { await f.close(); }
});

test("HTTP unknown read-context exception rethrows the same failure", async () => {
  const failure = new Error("synthetic unknown context failure");
  assert.throws(() => mapProductBuildAuthorityHttpError(failure, "v3", "synthetic-run"), error => error === failure);
  await assert.rejects(readProductBuildAuthorityHttp({
    query: new URLSearchParams("schema=v3"), runId: "synthetic-run",
    createReadContext: () => { throw failure; },
  }), error => error === failure);
});

test("HTTP unknown reader exception cannot become authority or a typed response", async () => {
  const f = await createSyntheticAuthorityFixture({ kind: "none" });
  try {
    const failure = new Error("synthetic unknown reader failure");
    await assert.rejects(readProductBuildAuthorityHttp({
      query: new URLSearchParams("schema=v3"), runId: f.runId,
      createReadContext: () => ({
        reader: { ...f.reader, readExactSealedPacket: async () => { throw failure; } }, refusalOptions: f.refusalOptions,
      }),
    }), error => error === failure);
    assert.equal(f.refusalQueryCount(), 0);
  } finally { await f.close(); }
});

test("HTTP malformed native authority output rejects with Zod failure instead of status 200", async () => {
  const f = await createSyntheticAuthorityFixture({ kind: "none" });
  try {
    const malformed = structuredClone(await f.reader.readExactSealedPacket(f.runId));
    malformed.refs.productSpec = "0".repeat(64);
    await assert.rejects(readProductBuildAuthorityHttp({
      query: new URLSearchParams("schema=v3"), runId: f.runId,
      createReadContext: () => ({
        reader: { ...f.reader, readExactSealedPacket: async () => malformed }, refusalOptions: f.refusalOptions,
      }),
    }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "ZodError", "Native output validation remains a failed request");
      return true;
    });
    assert.equal(f.refusalQueryCount(), 0);
    f.assertUnusedConfiguration("HTTP malformed native output failure");
  } finally { await f.close(); }
});
