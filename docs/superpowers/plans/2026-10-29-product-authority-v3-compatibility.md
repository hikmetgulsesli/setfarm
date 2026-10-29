# Native v3 Product Build Authority Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development task-by-task only under Root's explicit assignments. Root has already selected serialized implementation with independent reviews; do not ask for an execution-choice or repeat permission. No implementation is authorized by this unadopted private draft.

**Goal:** Display exact native-v3 sealed authority and verified refusal while preserving legacy API meaning and all integrity failures.

**Architecture:** Explicit schema=v3 traverses browser, MC route/client and SF endpoint. A new v3 wrapper nests either unchanged legacy authority or exact native authority. Separate native parser/render helpers preserve native graph/source-map semantics.

**Tech Stack:** TypeScript ESM, existing SF Zod/canonical JSON, existing MC handwritten validators and React, node:test/tsx. No dependencies.

**Spec:** compatibility-design.md beside this private draft; proposed tracked location after adoption: SF/docs/superpowers/specs/2026-10-29-product-authority-v3-compatibility-design.md. Proposed tracked plan: SF/docs/superpowers/plans/2026-10-29-product-authority-v3-compatibility.md.

## Global constraints

- Missing schema means v2; schema=v1 and schema=v2 retain exact existing successful bodies and reader semantics; schema=v3 explicitly opts in.
- Do not change runtime-artifact-reader.ts, its legacy contract or storage mode defaults for this fix.
- No runtime authority from a compiler packet, cancellation, agent prose or metadata-only evidence.
- No tests/builds by authors; Root-only original RED/GREEN and guarded stock builds. No runtime database/HTTP/browser/native/provider paths in focused tests.
- No nested envelope reconstruction with parent producer. No native-to-legacy packet-shape casts.
- Preserve Full8 UNKNOWN/reservation, annual pending, NEWworker CANCELLED_NOT_PASSED, startup refusals, overall/startup false.
- Existing sole writers only; one author at a time globally for simplicity. Root alone stages/commits/pushes/delivers.

## File Map (paths relative to the identified sole writer)

| Repo/path | Action and responsibility | Task |
|---|---|---|
| SF src/server/schemas/product-build-authority-v3.ts | Create strict native packet and outer v3 schemas, pure integrity refinements | 1 |
| SF src/server/product-build-authority-v3.ts | Create exact reader port, sealed/refusal producers and read orchestration | 1 |
| SF src/server/product-build-authority.ts | Task1 minimal explicit-v3 dispatcher branch and input typing, retaining legacy producers/readers/refusal validation; required to GREEN retained Stage A | 1 |
| SF src/server/product-build-authority-http.ts | Create pure negotiation, request execution and typed status/error response mapping | 2 |
| SF src/server/dashboard.ts | Wire pure versioned HTTP adapter to existing reader/store/refusal options | 2 |
| SF tests/fixtures/product-build-authority-v3-payloads.json | Create inert synthetic native Stitch/none and legacy/refusal payload corpus, distinct nested producers | 1 |
| SF tests/product-compiler/fixtures/product-authority-v3-synthetic.ts | Create pure fixture assembly, hash/index/ref/run maps, test-owned temporary store and rejecting SQL read adapter; no browser/compiler/runtime fixture imports | 1 |
| SF tests/product-build-authority-v3.test.ts | Create real reader/schema/orchestration closure and terminal/refusal regressions | 1 |
| SF tests/product-build-authority-http.test.ts | Create direct pure request tests with injected readers/refusal data; no dashboard import/server listener | 2 |
| SF tests/fixtures/product-build-authority-v3-wire.json | Create versioned golden authority corpus from synthetic data, validated against real reader/schema | 1 |
| MC tests/fixtures/product-build-authority-v3-wire.json | Create identical consumer copy, byte identity reviewed by Root | 3 |
| MC/shared/product-build-authority-v3-wire.d.ts | Task3B neutral declaration-only native wire/generic legacy-refusal wrapper; type-only consumers, no runtime module | 3B |
| MC src/lib/product-build-authority-v3.ts | Create native wire/render types and render-shape predicate | 3 |
| MC server/services/product-build-authority-v3-parser.ts | Create pure native/wrapper parser accepting existing legacy/refusal callbacks | 3 |
| MC server/services/setfarm-product-build-authority.ts | Retain production configuration/defaults/singleton in compatibility facade, re-export pure parser/types and configured client | 3 |
| MC server/services/setfarm-product-build-authority-core.ts | Create behavior-preserving extraction of parser/client with explicit baseUrl and pure canonical hash import, then add native dispatch/version option | 3 |
| MC server/services/setfarm-canonical-json-v1.ts | Read-only existing pure canonical hash dependency used directly by core/native parser/tests | 3 |
| MC tests/fixtures/product-authority-inert-import-guard.mjs | Create test-only pre-import resolver guard excluding config/facade/operational snapshot before evaluation | Stage A / 3 |
| MC tests/product-build-authority-v3-stage-a.test.ts | Create existing pure browser-response causal RED using SF exact-reader-validated synthetic corpus | Stage A / 3 |
| MC tests/product-authority-import-isolation.test.ts | Create guard activation and pre-evaluation rejection proof for every selected MC command | Stage A / 3 |
| MC server/services/setfarm-product-build-authority.test.ts | Change imports to pure core/direct canonical hash, preserve legacy tests, add injected-fetch native/error coverage; never import configured facade | 3 |
| MC server/services/product-build-authority-v3-parser.test.ts | Create pure native hash/type/closure parser mutation tests | 3 |
| MC src/lib/product-build-authority.ts | Extend discriminated union/response dispatch; retain literal error states | 3 |
| MC server/services/product-build-authority-http.ts | Create pure MC schema query validation/result mapping to keep focused tests away from operational route imports | 4 |
| MC server/routes/setfarm-operational.ts | Forward selected version; re-export moved existing result mapping for compatibility | 4 |
| MC src/lib/api.ts | Explicit ?schema=v3 browser request; factor a pure injectable request function if needed into next file | 4 |
| MC src/lib/product-build-authority-request.ts | Create pure fetchProductBuildAuthority(runId, fetchImpl, baseUrl, headers) helper, no env/config imports | 4 |
| MC src/components/run-detail/ProductBuildAuthority.tsx | Dispatch native vs legacy/refusal without downcast, preserve legacy layout | 4 |
| MC src/components/run-detail/NativeProductBuildAuthority.tsx | Create native graph/actions/observables/source-map display, honest none branch | 4 |
| MC tests/product-build-authority-v3-http.test.ts | Create pure route/result/request tests without importing operational router | 4 |
| MC tests/product-build-authority-render.test.tsx | Extend actual render/parser regression suite for native/none/refusal/old versions | 4 |
| SF package.json | Scripts-only isolated PBA package entrypoint; preserve exact existing downstream chain | 2 follow-up |
| SF scripts/run-product-authority-test-groups.mjs | Built-in-only required group partition, guarded child and fail-closed results | 2 follow-up |
| SF scripts/__tests__/product-authority-test-runner.test.mjs | Inert runner inventory, isolation and result propagation tests | 2 follow-up |
| MC package.json | Scripts-only isolated PBA package entrypoint after all pure/native tests exist | 4 follow-up |
| MC scripts/run-product-authority-test-groups.mjs | Built-in-only required group partition, guarded child and fail-closed results | 4 follow-up |
| MC scripts/__tests__/product-authority-test-runner.test.mjs | Inert runner inventory, isolation and result propagation tests | 4 follow-up |
| SF docs/superpowers/specs/2026-10-29-product-authority-v3-compatibility-design.md | Root promotes independently reviewed exact design | 0 |
| SF docs/superpowers/plans/2026-10-29-product-authority-v3-compatibility.md | Root promotes independently reviewed exact plan | 0 |

Read-only boundaries: SF runtime-artifact-reader.ts, product compiler schemas and artifact-index/store; SF PBA v1/v2 schemas; MC useProductBuildAuthority.ts, RunDetail.tsx, existing technical tabs and render-smoke-product-authority.mjs remain unchanged. Do not edit P3, runtime artifacts, guards, generated operational vendor contracts, service/startup code or package dependencies. PBA is not presently in sync-setfarm-contract.mjs; do not pretend its existing operational-snapshot vendor check covers this new wire. The golden corpus provides the focused cross-repo check. Root-required release/version metadata, if a stock version check requires it, is a separately recorded minimal File Map addition before any edit, not permission to bypass the check.

## Task 0 — independent adoption gate (Root)

- [ ] Review this draft independently for schema version semantics, source-map/producer closure, test isolation and File Map completeness.
- [ ] Reconcile clean sole-writer branches and exact source hashes; preserve other work. Root reads relevant instructions before source editing.
- [ ] Record accepted exact design/plan identities and promote tracked docs. User's existing bounded fix/continue authority applies; no repeated permission question.
- [ ] Create a task ledger with the order 1 -> review -> 2 -> review -> 3 -> review -> 4 -> review -> 5. No concurrent source writers. Every review may reject a task independently.

## Required Stage A — causal compatibility RED (Root)

Stage A precedes production implementation and imports only existing production exports. New synthetic fixture data/helper may be authored under Task1 after adoption, but it must not import any planned new v3 schema/producer/helper export. Build expected native wire independently from the authored synthetic payloads and canonical hash primitive. Root first reviews fixture/import isolation, then executes the exact-reader control and existing-boundary assertions. A fixture/schema/setup/import failure is a blocked test preparation, not the compatibility RED.

The real exact-reader control must accept the same synthetic native packet used by each failing boundary. For a cancelled fixture use existing auditExactTerminalPacket; for a running fixture use existing readExactSealedPacket. Compare the exact packet schema and payload identity, not only absence of an exception. Record control completion before the boundary assertion. Tests may fail with assert.doesNotReject or semantic assert.equal/deepEqual, making old rejection a behavioral failure with a named phase.

```ts
// Existing production exports only; helper is new synthetic test-only setup.
import { readVersionedProductBuildAuthority } from "../src/server/product-build-authority.js";
const f = await createSyntheticAuthorityFixture({ kind: "stitch", status: "running" });
try {
  const exact = await f.reader.readExactSealedPacket(f.runId);
  assert.equal(exact.packet.schema, "setfarm.product-build-packet.v3", "Stage A exact-reader control");
  assert.deepEqual(exact.productSpec, f.expectedWire.packetAuthority.productSpec);
  await assert.doesNotReject(async () => {
    // Reflect.apply passes the new protocol input to the old existing function
    // without casting a native packet into a legacy authority type.
    const actual = await Reflect.apply(readVersionedProductBuildAuthority, undefined, [{
      schema: "v3", reader: f.reader, runId: f.runId, refusalOptions: f.refusalOptions,
    }]);
    assert.equal(actual.schema, "setfarm.product-build-authority.v3", "Stage A explicit-v3 wire selection");
    assert.deepEqual(actual, f.expectedWire);
  }, "Stage A existing dispatcher must accept exact native authority");
} finally { await f.close(); }
```

At the current SF baseline this reaches the existing legacy reader and rejects native packet type; that RuntimeArtifactReaderError inside the assertion is the causal RED. A legacy fixture with an explicit-v3 request can also expose old v2 wire selection, but does not replace the native exact-reader control. Keep the cancelled native control/boundary case to prove terminal handling separately.

MC Stage A uses only the already-existing pure browser export `parseProductBuildAuthorityResponse` from src/lib/product-build-authority.ts. It does not import the current service, configured client singleton or operational-snapshot hash re-export. These eagerly load config.ts, which reads environment files and may read OpenClaw credentials; injected fetch/baseUrl cannot prevent module evaluation. The same SF exact-reader-validated synthetic native wire must yield a semantic failed assertion against current unsupported_schema behavior:

```ts
import { parseProductBuildAuthorityResponse } from "../src/lib/product-build-authority.js";
assert.equal(
  parseProductBuildAuthorityResponse(200, nativeWire, nativeWire.runId).status,
  "ok", "Stage A existing browser response parser must support native wire",
);
```

Root first verifies the paired corpus digest and records the passing SF exact-reader control; this browser assertion is then the original MC compatibility RED before any production extraction/change. The dedicated test file imports only this existing production lib, node:test/assert, and synthetic JSON. Run:
`node --import ./tests/fixtures/product-authority-inert-import-guard.mjs --import tsx --test tests/product-authority-import-isolation.test.ts tests/product-build-authority-v3-stage-a.test.ts`.

### Concrete MC inert-import prerequisite (applies to every selected MC command)

Create the test-owned guard before Stage A. It uses node:module registerHooks (supported by the repository’s Node floor), installs a synchronous resolve hook before tsx/test modules, and registers a global marker. The hook calls nextResolve, then rejects file URLs whose decoded absolute paths identify MC server/config.ts or .js, server/services/setfarm-operational-snapshot.ts or .js, or server/services/setfarm-product-build-authority.ts or .js. Reject before returning the resolved module, so none of those module bodies can evaluate. The guard has only node:module and node:url imports; it does not load config, read environment values, fetch, or inspect credential files. Do not change any production module-resolution behavior.

```js
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
const blocked = /\/server\/(?:config|services\/(?:setfarm-operational-snapshot|setfarm-product-build-authority))\.(?:ts|js)$/;
registerHooks({ resolve(specifier, context, nextResolve) {
  const result = nextResolve(specifier, context);
  if (result.url.startsWith("file:") && blocked.test(fileURLToPath(result.url))) {
    const error = new Error("PBA_TEST_OPERATIONAL_IMPORT_FORBIDDEN");
    error.code = "PBA_TEST_OPERATIONAL_IMPORT_FORBIDDEN";
    throw error;
  }
  return result;
} });
globalThis[Symbol.for("setfarm.pba.inert-import-guard.v1")] = true;
```

The isolation test asserts that marker and intentionally attempts dynamic import of each exact blocked module, requiring the guard’s exact code. Resolution fails before evaluation; no module body or .env/token read is allowed. A missing/inactive guard or another import/setup error is not a passing isolation proof and not causal RED. Guarded commands must include this isolation test each time. Root records its PASS independently of expected Stage A semantic FAIL. The guard makes a mistaken direct/transitive import fail closed before configuration executes.

Task3 then extracts unchanged current service parsing/client behavior into the pure core. Existing service-test imports move to that core and setfarm-canonical-json-v1.ts. Production facade retains config import, default baseUrl, timeout/fetch defaults and singleton behavior; it is never loaded by focused tests. With the guard active, run legacy service cases and add pre-v3 baseline cases that expect existing native rejection, while retained Stage A still fails. Only afterward implement native parser/client behavior and update those baseline expectations to required success. This supplementary parser/client RED is real unsupported-model behavior from already-created, evaluated pure code, not a missing-export failure. For explicit-v3 negotiation capture the injected-fetch URL and assert it after the request settles; do not throw assertions inside fetch and mistake caught network failures for negotiation evidence. All HTTP responses remain synthetic; no real listener/request.

Root records each exact-reader control and original failing boundary output/natural exit separately. Missing exports, imports, types, modules, malformed fixture, setup errors, test isolation failures or guard failures never satisfy Stage A. Only after those causal RED results may implementation proceed and later Task1–4 new-export tests be added. Keep Stage A cases through GREEN; do not replace them with mocks or only new helper tests.

## Task 1 — exact v3 authority, isolated corpus and real-reader proof

**Interfaces:** Own the minimal explicit-v3 branch and discriminated input typing in existing readVersionedProductBuildAuthority in this task, so retained Stage A can reach GREEN before Task1 review/commit. v3 requires the exact reader port; v1/v2/default continue accepting legacy-only ports. HTTP query negotiation/dashboard wiring remains Task2. Define ProductBuildPacketAuthorityV3Schema/Type and ProductBuildAuthorityV3Schema/Type. Define ExactProductBuildAuthorityReader with readExactSealedPacket(runId): Promise<ExactSealedRuntimePacket> and auditExactTerminalPacket(runId): Promise<ExactSealedRuntimePacket>. Export produceSealedProductBuildAuthorityV3(packet: ExactSealedRuntimePacket): ProductBuildAuthorityV3, produceRefusedProductBuildAuthorityV3(runId: string, refusal: ProductBuildRefusalV2): ProductBuildAuthorityV3, and readProductBuildAuthorityV3(reader, runId, options: VerifiedDesignCandidateRefusalReadOptions): Promise<ProductBuildAuthorityV3>.

**Fixture contract:** New synthetic helper exports createSyntheticAuthorityFixture(options: {kind: "stitch"|"none"|"legacy1"|"legacy2"; status?: string}): Promise<SyntheticAuthorityFixture>. Fixture exposes runId, reader (real createRuntimeArtifactReader return), refusalOptions, expectedWire, close(): Promise<void>, and mutate(layer, patch): void for its own in-memory records. layers are run, index, refs and envelopes; fixture serialization recreates canonical hashes only when explicitly requested. Keep fixture mutation separate from code under test. Payload JSON consists only of authored synthetic schema-conformant data and distinct synthetic producers; no copied runtime records. Fixture supplies the few SELECT queries used by actual reader/index/refusal lookup and rejects every unknown query, transaction or write. Use real test-owned ContentAddressedArtifactStore rooted in mkdtemp; explicit standalone publication mode is fixture-only and must never reach dashboard. No real SQL connection is created. Temporary files are removed only by fixture.close, beneath the freshly created fixture root.

- [ ] Author and run the existing-entrypoint Stage A assertions above before production implementation, after the exact-reader fixture control passes. Root reviews transitive imports before execution: no existing runtime-artifact-reader.test.ts, product-build-packet-v3 fixture, browser capture, isolated PG helper, env reader or operational entrypoint may execute. Do not rely on test-name filtering to prevent module side effects. The following new-export assertions are later Stage B regression coverage, added after those exports exist; they are not evidence of the original causal RED.

```ts
for (const status of ["running", "cancelled", "failed"]) {
  const f = await createSyntheticAuthorityFixture({ kind: "stitch", status });
  try {
    const actual = await readProductBuildAuthorityV3(f.reader, f.runId, f.refusalOptions);
    assert.equal(actual.schema, "setfarm.product-build-authority.v3");
    assert.deepEqual(actual, f.expectedWire);
    await assert.rejects(f.reader.readSealedPacket(f.runId));
  } finally { await f.close(); }
}
const f = await createSyntheticAuthorityFixture({ kind: "none" });
try {
  const result = await readProductBuildAuthorityV3(f.reader, f.runId, f.refusalOptions);
  assert.equal(result.disposition, "sealed_packet");
  if (result.disposition !== "sealed_packet" || result.packetAuthority.schema !== "setfarm.product-build-packet-authority.v3") throw new Error("wrong fixture branch");
  assert.equal(result.packetAuthority.designGraph, null);
  assert.equal(result.packetAuthority.refs.designGraph, null);
  assert.deepEqual(result.packetAuthority.implementationSourceMap.screens, []);
} finally { await f.close(); }
```

- [ ] Root runs original Stage A RED: `node --import tsx --test --test-concurrency=1 tests/product-build-authority-v3.test.ts` from SF after import-isolation review. At this stage the file contains only existing-production-export assertions plus the synthetic helper and exact-reader control. Require actual legacy type rejection or old wire behavior after the control passes. Missing export/import/type/module/setup failure is not RED. Add the Stage B new-export cases only when implementation exports exist. No run of old reader suite.
- [ ] Implement the two pure v3 files and the Task1-owned minimal branch in existing readVersionedProductBuildAuthority. Schema reuses exact source schema imports, outer legacy union and refusal validation semantics; no changes to v1/v2 schemas. To avoid SF circular imports, the new v3 module imports existing legacy producers/refusal reader, and the existing dispatcher dynamically imports the v3 module only when input.schema is v3. Preserve its existing exports and legacy/default branches. Do not move this branch to Task2, skip Stage A, or claim Task1 GREEN before retained Stage A passes. Do not use `as SealedRuntimePacket` for native.

```ts
const identity = { schema: "setfarm.product-build-packet-authority.v3", ...packet };
const native = ProductBuildPacketAuthorityV3Schema.parse({
  ...identity, authorityHash: hashCanonicalJson(identity),
});
// Native narrowing is packet.packet.schema === native literal plus a typed
// type guard on ExactSealedRuntimePacket, not a forced legacy conversion.
```

- [ ] Add real-reader mutation cases: missing run; unknown protocol/status; null packet hash with no refusal; missing ref/index; unknown packet type; wrong child type; packet/run ref mismatch; corrupt byte/index length; top-level producer mismatch; release mismatch; report mismatch; source-map payload mismatch; native screen targetHash or responseBindingHash mismatch; closure child payload mismatch; valid distinct nested producer; incomplete Stitch sources; graphless contradictory graph. Assert exact RuntimeArtifactReaderError code where the real reader defines one; schema validation errors remain failures, never converted to success/refusal.
- [ ] Add refusal tests with synthetic SQL and actual test-owned failure envelope: terminal canonical failed + not-sealed yields exact refusal; no row preserves not-sealed; ambiguous/wrong requester/ref/hash/fingerprint/producer/index byte length refuses. Type/integrity failures never invoke refusal lookup. Reuse the existing refusal reader and validate through v3, without importing the broad old test file.
- [ ] Validate golden corpus: real reader -> v3 producer equals native golden cases; legacy1/legacy2 v3 wrappers nest byte-identical v1 authorities; default v2 later remains untouched. Store golden JSON only from synthetic authored inputs. Root verifies original GREEN and records stdout/stderr/natural exit and corpus digest.
- [ ] Independent spec then quality review. Root commits scoped source/tests when approved; author relinquishes writer.

## Task 2 — SF explicit negotiation and pure HTTP adapter

**Interfaces:** `ProductBuildAuthorityRequestSchema = "v1"|"v2"|"v3"`; `resolveProductBuildAuthoritySchema(params: URLSearchParams): ProductBuildAuthorityRequestSchema` throws a pure typed unsupported-version error for unknown/empty/duplicate schema. `readProductBuildAuthorityHttp(input: {query: URLSearchParams; runId: string; createReadContext: () => {reader: ProductBuildAuthorityReader & ExactProductBuildAuthorityReader; refusalOptions: VerifiedDesignCandidateRefusalReadOptions}}): Promise<{statusCode:number; body:unknown}>`. Callback is invoked only after valid negotiation. Export error mapping helper for focused assertions; unrecognized exceptions rethrow. Consume the discriminated readVersionedProductBuildAuthority input and minimal v3 branch already completed and GREEN in Task1; this task does not own or defer that change.

- [ ] Add behavioral request cases: absent schema ->v2 legacy body; v1/v2 explicit unchanged; v3 ->native body; terminal cancelled ->exact audit; unknown/repeated/empty ->400 before reader creation. Assert body/status, not source text.

```ts
const result = await readProductBuildAuthorityHttp({
  query: new URLSearchParams("schema=v3"), runId: f.runId,
  createReadContext: () => ({ reader: f.reader, refusalOptions: f.refusalOptions }),
});
assert.equal(result.statusCode, 200);
assert.deepEqual(result.body, f.expectedWire);
```

- [ ] Stage A existing dispatcher already supplies causal SF RED. The new HTTP adapter tests are Stage B coverage and must not be counted RED merely because its module/export does not yet exist. Root runs `node --import tsx --test --test-concurrency=1 tests/product-build-authority-http.test.ts` after the adapter boundary exists; require behavioral assertions for negotiation, response body and status mapping.
- [ ] Implement adapter; dashboard provides its existing createRuntimeArtifactReader and the same reader.store as refusal artifactReadPort. No alternate store/runtime mode. Default v2 and legacy migration v1 still call their current reader functions. V3 dispatch uses the existing Task1-completed lazy branch; add only HTTP adapter/dashboard negotiation here.
- [ ] Check 404 run-not-found, 409 not-ready family, 503 integrity/refusal errors with schema-appropriate literal error bodies, and unknown thrown errors do not get converted to authority. Ensure malformed native Zod output produces a failed request, not a generic success.
- [ ] Root GREEN runs Task1+Task2 focused files together. Independent spec/quality review and Root scoped commit. Dashboard source wiring is reviewed statically; do not import/start dashboard in focused tests.

## Task 3 — MC native server/browser validation and explicit client version

**Interfaces:** In src/lib/product-build-authority-v3.ts define ProductBuildPacketAuthorityV3 and ProductBuildAuthorityV3 native types and `isRenderableProductBuildAuthorityV3(value: unknown, expectedRunId: string): value is ProductBuildAuthorityV3`. Keep legacy/refusal types in existing lib; use type-only imports to avoid cycles. New server parser exports `parseProductBuildAuthorityV3(value: unknown, expectedRunId: string|undefined, legacy: {packet(value:unknown, runId?:string):ProductBuildAuthorityV1; refusal(value:unknown):ProductBuildRefusalV2}): ProductBuildAuthorityV3`. It imports hashCanonicalJson directly from existing pure setfarm-canonical-json-v1.ts; callbacks prevent importing the client/config module into the pure parser. New setfarm-product-build-authority-core.ts contains the existing parser/types/client algorithm, importing only pure hash/native parser and type-only wire declarations. Its client constructor requires an explicit baseUrl; timeoutMs/fetchImpl retain current defaults. Existing configured facade imports config as before, re-exports core parsers/types and defines its exported client class by passing options.baseUrl ?? config.setfarmUrl into the core constructor; its exported singleton is created as before. Keep all public constructor behavior and configuration sources unchanged. Core parseProductBuildAuthority then adds v3 and forwards unchanged legacy/refusal validators. Core Client.get(runId: string, schema: "v1"|"v2"|"v3" = "v2") performs one request with ?schema=<value>.

- [ ] Copy exact SF synthetic wire corpus into the MC test path; record SHA256 equality. This is fixture transfer under Root, never operational authority. Complete guarded Stage A browser causal RED before any production edit in MC.
- [ ] Perform the behavior-preserving pure extraction first: copy existing parser/types/client algorithms into the new core, replace the indirect hash import with direct setfarm-canonical-json-v1.ts, require explicit core baseUrl, and leave configured defaults/singleton in the old facade. Move all imports in the selected existing service test to core/direct canonical hash. No config/facade/operational-snapshot imports in test code, including helpers. Root runs the guard/isolation proof plus legacy behavior and explicit unsupported-native baseline before v3 changes; independent review verifies production facade default equivalence from source. Stage A remains RED until native browser support is added.
- [ ] Write parser and injected-fetch tests before implementation. Native fixtures pass through actual parser; rehash the outer/native wrapper after each tamper to prove inner relationship validation, rather than merely detecting an old outer digest. Cover top-level envelope hash, source-map payload/screen hashes, null graph agreement, source labels, known schema with unknown nested type, run mismatch, bad compiler/producer, closure missing source, nested producer difference case and refusal exclusivity.

```ts
const result = await new SetfarmProductBuildAuthorityClient({
  baseUrl: "http://synthetic.invalid", fetchImpl: async (url) => {
    assert.equal(String(url), "http://synthetic.invalid/api/runs/synthetic-native/product-build-authority?schema=v3");
    return new Response(JSON.stringify(nativeWire), { status: 200 });
  },
}).get("synthetic-native", "v3");
assert.equal(result.status, "ok");
if (result.status !== "ok") throw new Error("expected synthetic native response");
assert.deepEqual(result.authority, nativeWire);
```

- [ ] Implement browser integration in this task, before the final guarded Task3 GREEN command: extend existing src/lib/product-build-authority.ts parseProductBuildAuthorityResponse dispatch to call isRenderableProductBuildAuthorityV3 from src/lib/product-build-authority-v3.ts for schema setfarm.product-build-authority.v3. Valid native wire returns ok; a known v3 envelope with missing/malformed native fields returns upstream_error/invalid_payload; unknown schema v99 remains unsupported_schema. Preserve v1/v2 paths and literal error codes. Add these semantic cases to the retained Stage A test file, keeping its original native success assertion unchanged. The native predicate alone is insufficient: the existing response function must actually dispatch to it. This File Map responsibility is Task3 and must not be deferred to Task4.
- [ ] Original MC Stage A command is the guarded pure-browser command above; do not run the current configured service test before extraction. After extraction, Root runs `node --import ./tests/fixtures/product-authority-inert-import-guard.mjs --import tsx --test tests/product-authority-import-isolation.test.ts server/services/setfarm-product-build-authority.test.ts` for legacy equivalence and unsupported-native baseline; every service-test import now targets core/direct canonical hash. Once the dedicated native parser exists, add Stage B cases and run `node --import ./tests/fixtures/product-authority-inert-import-guard.mjs --import tsx --test tests/product-authority-import-isolation.test.ts tests/product-build-authority-v3-stage-a.test.ts server/services/product-build-authority-v3-parser.test.ts server/services/setfarm-product-build-authority.test.ts`. Require retained browser Stage A and all parser/client cases GREEN; no operational service module evaluates.
- [ ] Implement native parser in dedicated file with small functions for native packet identity, refs/report, source-map, native graph, and nested source payload closure. Validate every rendered native field before type narrowing. Strict outer/native/ref/source-set keys; no arbitrary record casts accepted as proof. Preserve full exact native objects rather than rebuilding old control bindings. Do not reconstruct nested envelopes using parent producer.
- [ ] Old-backend cases: valid v1/v2 after requested v3 stays literal legacy success; 503 mismatch remains exact upstream error; 404/409 stay unavailable; malformed JSON ->invalid_json; malformed known v3 ->invalid_payload; unknown outer schema ->unsupported_schema; timeout/network same existing behavior. Change existing test's future-schema sentinel from v3 to v99 while adding malformed-v3 expectation, not deleting unknown coverage.
- [ ] Root GREEN; independent spec/quality review; Root scoped commit.

## Task 4 — MC request path and native rendering

**Interfaces:** New pure MC http module exports `resolveProductBuildAuthoritySchema(query: unknown): "v1"|"v2"|"v3"` and existing `toProductBuildAuthorityHttpResult` moved without semantic changes. Invalid query returns 400 with status=unsupported_schema and code=SETFARM_PRODUCT_BUILD_AUTHORITY_UNSUPPORTED_SCHEMA; duplicate array query is invalid. Route passes resolved version to client.get; old imports retain re-export. New pure browser request helper exports `fetchProductBuildAuthority(runId: string, fetchImpl: typeof fetch, baseUrl: string, headers: Record<string,string>): Promise<Exclude<ProductBuildAuthorityState,{status:"loading"}>>`; existing api.ts supplies its current fetch/base/auth headers and no-store behavior. Native component props `{authority: ProductBuildPacketAuthorityV3; outerAuthorityHash: string; outerSchema: "setfarm.product-build-authority.v3"}`; wrapper handles refusals before selecting legacy/native.

- [ ] Write request tests proving ?schema=v3 with runId encoding and no-store; parse complete response; absent route schema remains v2; explicit v3 forwards v3; duplicate/unknown fail before client call. Run through pure adapter, not imported operational router or HTTP listener.
- [ ] Write actual renderToStaticMarkup cases from golden corpus. Native Stitch shows exact actionRef/controlSlotRef/surfaceRef/elementRef and source-map target/path/hash; graphless renders honest no-design text; refusal displays exact cause/fingerprint/termination; legacy v1/v2 rendering persists; invalid/unknown responses render unavailable/error without native collections. Assert absence of deployment/final-acceptance claims. Add >200 item synthetic render-only collection to prove bounded output plus omitted count; never treat this renderer-only object as authority.
- [ ] Preserve MC Stage A browser-response/parser RED from existing exports. The new request/HTTP/component export tests are Stage B behavior coverage, not missing-module RED. Once these boundaries exist, Root runs `node --import ./tests/fixtures/product-authority-inert-import-guard.mjs --import tsx --test tests/product-authority-import-isolation.test.ts tests/product-build-authority-v3-stage-a.test.ts tests/product-build-authority-v3-http.test.ts tests/product-build-authority-render.test.tsx` (the package test glob does not cover .tsx, so this explicit command is required).
- [ ] Implement native renderer using graph.controls/action/observable collections, not graph.bindings. Preserve full source references in code titles/details, use independent native source-map subsection. Handle nullable refs explicitly. Refusal branch accepts v2/v3. Do not modify technical tabs, run filters, polling, CSS contrast or acceptance/status derivation.
- [ ] Re-verify the browser parser already implemented and GREEN in Task3: valid native remains ok, known malformed v3 remains invalid_payload, unknown v99 remains unsupported_schema, and literal error status strings persist through the new request/render path. Task4 changes fetch opt-in, route negotiation and rendering; it does not defer or newly own the Task3 parser integration.
- [ ] Root GREEN; independent spec/quality review; Root scoped commit.

## Task 5 — whole-branch contract and delivery gates (Root only)

- [ ] Compare both checked-in golden corpus files byte-for-byte; SF tests validate corpus through actual exact reader/schema; MC tests validate and render the same wire. Review every modified/new file against File Map and scope.
- [ ] Run focused original GREEN commands from Tasks1–4 after final changes, recording natural process exits. Every selected MC command must include the pre-import guard and isolation test; selected service tests import only pure core/native parser/direct canonical hash, never configured facade, config or operational-snapshot. Do not run unguarded package-wide MC tests. Do not substitute an agent's claimed results. Avoid broad suite reruns that activate PG/browser/provider/import paths. Any necessary broader test requires a new Root isolation audit; no old225/139/full8/newworker replay.
- [ ] Independent whole-branch review follows task spec/quality reviews. Correct findings serially, rerun only affected focused tests.
- [ ] Root delivers reviewed scoped branches/PRs. Setfarm and MC stock `npm run build` require their exact clean build prerequisites and current guards; do not run builds on dirty SF and do not bypass runtime/test guards. Record actual build results; a blocked guard is not a passing build. Root alone decides exact source commit/build order under repository requirements.
- [ ] Prefer SF producer delivery first and MC consumer delivery second. Actual guarded runtime rollout is a separate new phase after final merged builds and current eligibility checks. Default-v2 compatibility protects old MC; old-server literal fallback protects new MC during skew, but does not solve native authority until SF v3 is actually loaded.
- [ ] Update current handoff at verified phase boundaries, with exact unresolved runtime gates and no fabricated completion. P3 contrast-only proposal remains deferred NOT_CLEAR/reference. Never reuse its old/spent scopes or candidate identity.

## Coverage matrix and acceptance

| Required behavior | Independent evidence |
|---|---|
| Native active/terminal-cancelled/failed | Task1 actual reader with synthetic status records + Task2 response |
| Native graphless | Task1 null/type/hash invariants + Task3 parser + Task4 render |
| Legacy v1/v2 meaning | Task1 exact legacy nesting + Task2 default/explicit + Tasks3/4 old backend/render |
| Verified prepacket refusal | Partial selected evidence: pure V3 refusal composition + actual no-row/early-error delegation + unchanged reader source; Tasks3/4 parser/render. Successful configured refusal and post-mode integration remain UNVERIFIED/PENDING. |
| Missing/unsealed/unknown status | Task1 exact reader failures + Task2 HTTP classification |
| Wrong type/hash/release/producer/closure/source map | Task1 real reader and rehashed schema mutations + Task3 rehashed wire mutations |
| Unknown/incompatible backend | Task3 injected fetch + Task4 response rendering |
| No operational execution during tests | Root transitive import review, rejecting injected SQL/fetch, test-owned storage |
| No invented deploy/final acceptance | Schema absence, renderer assertions, whole-branch review |

Static plan acceptance is independent review plus Root adoption. Source fix acceptance requires reviewed source and original focused tests/build results. Runtime success is not a claim available to this phase; historical packet closure may still legitimately fail after compatibility is implemented.


## Root Stage A SF isolation refinement

Actual Task1 static import audit found eager runtime-config.ts/fresh-installation-selection-v1.ts evaluation. Add test-only `tests/fixtures/product-authority-sf-inert-import-guard.mjs` and `tests/product-authority-sf-import-isolation.test.ts` to Task1. Before production imports, exact resolver/load interception supplies only otherwise-unused `resolveArtifactStorePublicationAuthorityMode` and `selectedFreshInstallationRootV1` exports which throw on any invocation; they never return mode/selection/authority. Prove actual module bodies do not evaluate and selected standalone controls make zero calls. No production guard/validator/hash is replaced; hybrid/refusal/selection behavior is not qualified. Independent source/import review precedes execution.

The Stage A SF command is `node --import ./tests/fixtures/product-authority-sf-inert-import-guard.mjs --import tsx --test --test-concurrency=1 tests/product-authority-sf-import-isolation.test.ts tests/product-build-authority-v3.test.ts`. Isolation PASS and actual exact-reader control PASS remain separate prerequisites for expected old-dispatcher semantic FAIL; setup/import/control errors never count RED. Later branches require a fresh flow review if either otherwise-unused function is needed. Detailed Root coordination amendment is retained privately; no source/runtime/input action follows from the plan alone.

## Root Task1 selected-verification refinement: unchanged refusal boundary

Status: ADOPTED by Root after independent scoped review C0/I0/M0; see root-task-1-refusal-verification-adoption-v1.json. This section supersedes only Task1's selected-campaign promise of a successful runtime-dependent refusal-reader test and its post-mode CAS mutation cases. It does not change product behavior, authority semantics, runtime guards or the existing refusal reader API/body.

The existing readVerifiedDesignCandidateRefusal always resolves actual runtime publication mode after termination/ref/index validation. Current admitted isolation throws on that call and must continue doing so. Passing an artifact port does not bypass that mode check. Do not add a mode override, injectable successful refusal resolver, skip flag, alternative default, or short-circuit to satisfy tests.

Selected Task1 acceptance is:
- Actual pure V3 refusal producer/schema preserve the complete authored synthetic refusal, exclusivity and canonical outer hash. Rehashed inner mutations must exercise existing refusal refinements, not merely an obsolete outer digest.
- Actual V3 dispatcher/exact-reader orchestration delegates NOT_SEALED into the unchanged refusal reader. No termination row rethrows the original NOT_SEALED; real early malformed/ambiguous termination/ref/index cases retain exact errors before mode resolution. Runtime-mode and installation-selection calls remain zero.
- Packet type/hash/release/closure/source-map failures retain their errors and never invoke refusal lookup. Existing native/legacy real-reader regressions and original StageA assertions remain required.
- Source review must establish the existing refusal reader body is unchanged, default/hybrid/store/provenance enforcement remains, and V3 delegates only NOT_SEALED, preserves null/errors, and produces refused authority only from that verified result.

Explicitly UNVERIFIED by this selected campaign: successful configured refusal reading; default/hybrid-required store selection and brand acceptance/rejection; store.get failure mapping; post-mode stored/index byte length, producer and envelope hash comparison; runtime reader fingerprint/candidate equality. Pure wire tests do not establish those facts. Existing test source is not historical PASS evidence. Keep these as later runtime-capable verification work before any broad claim of full refusal/runtime readiness. Do not count intentional guard throws as successful refusal tests.

No production File Map additions are needed. Author test changes stay in current Task1 paths. Root alone runs the exact independently reviewed selector; Task1 completion may mean only reviewed native-compatibility source and selected tests, with the above integration limits carried to Task5/final delivery and continuity. Overall/startup completion remains false.

Ruling: keep the unchanged configured refusal reader and the throw-only test boundary; replace the selected success/post-mode test promise with pure V3 composition, real safe delegation/early errors and source conservation, and retain the unavailable integration coverage explicitly — the causal fix is native type compatibility and a test-driven production authority override would expand scope without establishing runtime truth — cost if wrong: a configuration-dependent successful refusal regression can remain undetected until later eligible integration verification; no full refusal/runtime readiness claim is allowed meanwhile.

Task5/final claim constraint: carry successful configured refusal and post-mode integration as UNVERIFIED/PENDING; no full refusal or runtime readiness claim until separately eligible actual integration evidence.

# Root proposed refinement: package integration of isolated PBA tests — fix1

Status: ADOPTED by Root after independent fix1 C0/I0/M0 review; see root-package-test-integration-adoption-v1.json. Explicit Root follow-up dispatch still governs source ownership. Product/API/native/refusal/guard semantics and existing selected commands are unchanged. Static evidence is guarded-test-package-integration-assessment-v1.md (27216B SHA25605d60fa32e396037afd72b8dccfbe1cda8f8d9663af8838a01178b6514448b03), Root fullread f61fff. No ordinary npm test was run or claimed failed.

Causal issue: current package globs include new guard-dependent PBA files without their required pre-import. A global guard would break legitimate ordinary tests. Before source delivery, connect a separate mandatory guarded group while preserving ordinary membership and SF's downstream chain. Neither skipping tests, test-name filters, moving already-frozen files, global configuration patches, guard-return values nor running the unsafe broad suite to demonstrate the mismatch is permitted.

## Ownership and File Map additions

SF follow-up to Task2, after its HTTP files exist: the same sole Task2 author may implement the SF harness only after this refinement is adopted and Root explicitly dispatches the follow-up. Root can first execute/review the HTTP-only candidate. MC follow-up to Task4, after Task3's pure service-test migration and all final native/render tests exist: the sole Task4 author implements the MC harness. No second code writer, premature MC guarded group or concurrent package mutation. Task5 remains Root verification/delivery.

Add exactly these source/test paths per repo:
- package.json: scripts only; dependencies/engines/production entrypoints unchanged.
- scripts/run-product-authority-test-groups.mjs: built-in-only shell-free planner/result interpreter/entrypoint.
- scripts/__tests__/product-authority-test-runner.test.mjs: built-in-only planner/custody tests, excluded from old .test.js script glob and selected once by its own script.
Document the test-toolchain prerequisite and verification limits in the existing tracked SF compatibility plan, an already mapped Root document. No new production config/API/guard/dependency surface.

## Required runner behavior

Parent imports only node builtins, never any product/test/fixture/guard/config module. Export pure planning/result functions; main executes only as the entry script, not on import. Derive repo root from import.meta.url, not caller cwd. Discover original immediate directories using only non-dot-prefixed names ending in the literal .test.ts suffix, with deterministic ordering; do not recurse or pass globs through shell/Node. Exclude .hidden.test.ts and every other dot-prefixed name from B, preserving the old shell glob membership. Apply regular/confined checks to genuinely matching entries, and fail on matching nonregular/unsupported entries instead of silently losing a previous glob member. Explicit MC render .tsx inclusion remains separate from B.

SF original directories: tests. Guarded required manifest:
- tests/product-authority-sf-import-isolation.test.ts
- tests/product-build-authority-v3.test.ts
- tests/product-build-authority-http.test.ts
Guard path tests/fixtures/product-authority-sf-inert-import-guard.mjs.

MC original directories: server/routes, server/services, server/utils, tests. Guarded required manifest:
- tests/product-authority-import-isolation.test.ts
- tests/product-build-authority-v3-stage-a.test.ts
- server/services/setfarm-product-build-authority.test.ts
- server/services/product-build-authority-v3-parser.test.ts
- tests/product-build-authority-v3-http.test.ts
- tests/product-build-authority-render.test.tsx
Guard path tests/fixtures/product-authority-inert-import-guard.mjs. MC service file cannot be admitted before its Task3 pure-core/direct-hash migration. The render .tsx is an explicit added member, previously omitted by the package glob.

All required test paths must be unique regular files confined to the repo and present; no existsSync filtering. The selected guard file is itself a required pre-spawn input in every mode, not merely a later --import string. Before any child, validate it without importing it: require presence, regular-file type, no symlink at the file or any path component below the established repository root, and physical confinement under that root. Resolve the repository root and candidate physical path and compare on path-component boundaries; a string-prefix collision is not confinement. Missing guard, directory/nonregular guard, any guard-path symlink (including one targeting another file inside the repo), or physical escape is a nonzero pre-spawn error with zero children. Apply the same regular/non-symlink/physical-confinement policy to required test paths. Never validate a guard by evaluating/importing it. Explicit MC ordinary family exception: server/services/product-build-authority-v2-delivery-evidence-v1.test.ts. Reject discovered product-authority/product-build-authority basename drift not in guarded manifest/explicit exception. Let B be old glob membership, G guarded manifest, A the MC extra .tsx. O=B minus G; require disjoint O/G and O union G=B union A. Every ordinary old test remains and runs once, new unrelated ordinary files are discovered automatically; no hardcoded stale ordinary list.

Validate mode and complete inventory before constructing executable child plans or launching any child. G must be required and nonempty in every mode. In default mode, O must also be nonempty: empty O is a nonzero pre-spawn inventory error, with zero children, even if conservation otherwise holds. No guarded child may run first and discover this error later. Optional own --group=pba may run nonempty G when O is empty; it schedules only G and does not claim an ordinary group ran or passed. Unknown arguments fail. No child in any mode may receive an empty explicit test-file list; never emit a bare --test invocation that triggers automatic discovery. After all preflight passes, default runs guarded then ordinary sequentially; --group=pba runs only required G. Guarded argv: --import <absolute guard> --import tsx --test, then SF --test-concurrency=1, then explicit G paths. Ordinary argv: --import tsx --test then explicit O paths, no inherited guard execArgv. process.execPath, argv array, shell:false, fixed repo cwd and inherited stdio; do not inject guard through NODE_OPTIONS. Deterministic diagnostic records planned argv before spawning. Parent checks typeof node:module namespace registerHooks before scheduling guard; absence is a clear nonzero prerequisite failure before test/product imports or any child. Keep production engines unchanged; this campaign does not promise test support on older >=22 nodes lacking the existing guard API. Already-qualified physicalNode26.4.0 remains Root's actual test runtime; Node22-line test prerequisite is22.18+ or an equivalent verified capability.

Only natural status0 advances. Preserve numeric nonzero child code; signal/null status/spawn error is non-success and stops. Never force termination and count success, swallow a failure, continue later groups after failure, or report omitted/unrun groups as passing. Parent runner success requires all selected groups naturally0; ordinary package suite is not authorized by this design alone.

## Exact package script changes

Both repos add test:pba-runner = node --test scripts/__tests__/product-authority-test-runner.test.mjs and test:pba = node scripts/run-product-authority-test-groups.mjs --group=pba.
SF test replaces only its initial node --import tsx --test tests/*.test.ts with npm run test:pba-runner && node scripts/run-product-authority-test-groups.mjs; preserve its entire existing following && npm run test:cleanup-ops ... test:internal-production chain byte-for-byte. MC test becomes npm run test:pba-runner && node scripts/run-product-authority-test-groups.mjs. No other scripts change except these named additions/replacement.

## Focused acceptance and evidence limits

Author writes tests first where safe pure interfaces permit, no author execution. Unit imports only runner pure code; inject synthetic file inventories/spawn results. Require membership conservation/extra render once, missing/duplicate/outside/nonregular/unknown-family pre-spawn failure, spaces as single argv, guard-first and no ordinary preload, fixed cwd, focused/default args, capability failure, statuses0/1/7/errors/signals/null and no subsequent child after failure. Add these exact synthetic acceptance cases:
- An all-guarded discovered inventory satisfies union/disjointness but has O empty: default planning fails nonzero before spawning either group; no argv with a bare --test is emitted.
- The same O-empty inventory with --group=pba and a valid nonempty G schedules exactly one guarded child. Empty G fails before any child in both default and focused modes. Assert every successful child plan has at least one explicit test-file argument.
- For each mode, guard missing, guard directory, another nonregular guard, final guard symlink to an in-repo file, parent-component symlink, and guard physical escape all fail before any child. Include a repository-prefix collision path to prove path-component confinement. A valid regular non-symlink confined guard passes preflight without import.
- A synthetic .hidden.test.ts alongside a visible ordinary test is excluded from B and all scheduled files; the visible file remains ordinary. A hidden PBA-looking filename is also excluded, while a genuinely matching visible unclassified family file still fails. MC render .tsx remains included exactly once.
 One harmless temp-owned built-in .mjs child/preload proof may establish separate preload state and natural exit propagation after exact review; never invoke real ordinary tests or actual product guard in the runner unit suite. Fake signal results suffice; no actual forced child kill.

Read package JSON as data to assert exact script integration/SF chain preservation, supplementing behavioral tests. Root audits full selected source/import/effect flow, independently reviews task scope, runs original built-in-only runner tests, and may run actual test:pba only after that repo's complete guarded group is reviewed eligible. These do not establish ordinary full npm test PASS; broad ordinary suites retain separate eligibility requirements. Do not claim full configured refusal, build, rollout or overall readiness.

Ruling: partition new PBA files into a required separately preloaded child within ordinary package test entrypoints — new tests otherwise lack their admitted isolation boundary, so this root fix is causally required for the same native compatibility delivery — cost if wrong: membership or exit-propagation regressions could omit ordinary coverage or misreport success; explicit conservation/failure tests and final review are mandatory. Unsupported older test Node versions fail visibly; no runtime engine floor or guard is weakened.

## Fix1 dispositions and conservation

I1 addressed by Root’s explicit empty-group rule: default requires nonempty O/G before any spawn; focused mode requires nonempty G and permits empty O; every child must have explicit nonempty files. M1 addressed by guard-file required presence, regular/non-symlink type and physical repository confinement preflight in every mode, with synthetic failure scenarios. M2 addressed by excluding dot-prefixed immediate names from B while retaining matching visible-entry validation, with a synthetic regression.

Original draft is preserved unchanged: guarded-test-package-integration-amendment-draft-v1.md,8068 bytes,SHA2566ca92f88ae4308f48edbd87e536f7dad589d41675b79b6c7a1d27056a7962e01. Independent review is preserved unchanged: guarded-test-package-integration-independent-review-v1.md,9635 bytes,SHA256413f0f868264b28bbaad84cb1cc709d3cb0ac74b2f211d370b9e7aabe6becbd4. This is a new exclusive private full-draft artifact; no tracked plan/brief/source/test/package/guard change or execution occurred. All other File Map, ownership, toolchain, guards, selected-command and verification limitations remain unchanged. Root scoped re-review and adoption are still required.

# Root proposed Task3 compiler-boundary and phase-accounting amendment

Status: ADOPTED by Root after independentC0/I0/M0 review; see root-task3-compiler-boundary-adoption-v1.json. Task3 source still requires separate Root dispatch. Concrete static source proof/API detail is task-3-compiler-boundary-preflight-v1.md19334B SHA256b3d798d746675acb5be70d5f9a34fae9a36db0e8c680828e5b227637486e3bb1, Root fullread cc689f. No compiler failure or success was observed by the planner. This amends type sharing and phase evidence only; product/wire/runtime/polling/guard/API behavior stays under the adopted design.

## Minimum extra source and interfaces

Add exactly one File Map path: MC/shared/product-build-authority-v3-wire.d.ts, owned by Task3B. It contains exported type/interface declarations only; no imports from src/server/SF/another project, executable values, ambient globals, augmentation or dependencies. Declare complete native wire fields/substructures with exact source schema labels and graph nullability, preserving the full native model. Types describe data, never validate authority. No any/native-to-legacy mapping or invented old bindings.

Export ProductBuildPacketAuthorityV3Wire and ProductBuildAuthorityV3Wire<TLegacyPacket,TRefusal>. The generic legacy parameter is constrained to the unchanged v1 authority schema literal+runId; sealed branch holds TLegacyPacket|ProductBuildPacketAuthorityV3Wire and refusal:null; refused branch packetAuthority:null and refusal:TRefusal. Outer schema/runId/hash/disposition stay exactly v3. Use the exact interface pattern in the bound assessment.

Both consumers import/re-export these declarations with import type/export type only, using the .js-shaped neutral specifier resolved by the installed compiler to .d.ts. Browser src/lib/product-build-authority-v3.ts still owns the runtime renderable predicate and public aliases ProductBuildPacketAuthorityV3 and ProductBuildAuthorityV3, parameterized by its existing same-side legacy/refusal types. Server parser/core use neutral types plus their own existing local legacy/refusal types/callbacks; no server import of src runtime/type implementation .ts, no browser import of configured server/core runtime. Same-side type-only cycles are permitted only when no runtime cycle is created and compiler verifies them. Validators/canonical hashing stay in their existing pure runtime modules; no runtime import of a nonexistent neutral JS file.

All existing Task3/4 public interfaces/behavior and files remain assigned as before except this one extra neutral declaration path. Do not change tsconfig rootDir/include/outDir/skipLibCheck, package build commands/output paths, runtime loaders/guards/vendor contracts or production dependencies. Server dist-server/index.js identity/path contract remains intact. No declaration-package distribution promise or copying a type-only file into runtime is introduced.

## Phase and review gates

Task3A remains behavior-preserving pure core/facade extraction + guarded legacy/unsupported-native baseline, frozen/reviewed/actually run by Root before explicit Task3B author dispatch. New neutral/native types belong to3B. Existing pure-browser StageA success assertion remains unchanged and knownRED through3A.

Task3B must implement actual existing browser response dispatch as well as pure server native parsing/client. Do not defer that dispatch to4. Adding v3 to browser union necessarily exposes the current renderer's v2-only refusal/unwrap/property assumptions, so Task3 can be selected parser/server source progress, not a deployable/whole-browser-build-complete MC release. No intermediate MC service reload/delivery, temporary native-unavailable branch, dropped originalassertion or cast should manufacture whole-appGREEN. Root may retain reviewed scoped source commits with the explicit Task4 dependency.

Task4 retains proper v2/v3 refusal handling, sealed native/legacy branching and exact native renderer before accessing nullable graph/actions/source map. After Task4, actual full browser type verification and render/request/parser tests must pass before final source/build delivery. No false-empty graph or deployment/accepted-final claims.

## Root-only verification, not performed here

Static review confirms declaration-only neutral file and type-only consumers, no forbidden project import, and byte-identical real configs/output commands. Explicit standalone neutral-declaration checking must enable declaration checking (skipLibCheck false) so existing skipLibCheck true cannot hide errors inside the new sharedfile. Root qualifies exact installed-compiler invocation; any ambient/baseline diagnostic is evidence to classify, never a fabricatedPASS or reason to weaken actual configs.

Use unchanged server project resolution for Task3 boundary/source typecheck with --noEmit and a Root-owned private tsBuildInfoFile, preserving retained actual server buildinfo and emitting no JS. This checks real composite/rootDir/filelist relationships; it is not a stockbuild or emitted-artifact claim. Preserve actual original compiler output/exits, including independent baseline errors. Installed-compiler flags must be qualified, not assumed from this proposal.

Do not run a knowingly incomplete browser check simply to rediscover the declared Task4 dependency. After4, use the actual unchanged browser tsconfig noEmit check, satisfying genuine project-reference output prerequisites through the normal eligible server/stockbuild phase if required. Do not replace it with relaxed file-only checks excluding the renderer, fake declarations or rootDir/includes overrides. Final clean stock build and emitted-server runtime-path/no-neutral-or-src-JS-import inspection remain mandatory and independent from noEmit, Vite transpilation or focused tests.

All actual test commands preserve MC pre-import guard+separate isolation, injected synthetic data/fetch and no real env/credentials/PG/browser/provider/runtime inputs. Successful configured refusal/default-hybrid/post-mode integration remains UNVERIFIED_PENDING. CurrentSFharness work is unaffected; no new execution or source admission from this draft.

Ruling: share native wire declarations in a neutral declaration-only generic module and reserve full browser readiness for completed Task4 — existing server composite/rootDir forbids treating a src runtime implementation as harmless merely because imported with type, and existing renderer consumes the expanded union — cost if wrong: declaration drift or compiler-resolution work may require revision; real strict declaration/project/final-browser checks and no intermediate MC rollout are required. No compiler guard/configuration is weakened.
