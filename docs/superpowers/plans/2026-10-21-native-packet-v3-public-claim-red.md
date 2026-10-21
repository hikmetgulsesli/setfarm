# Native PacketV3 public claim regression implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this bounded test task. Steps use checkbox syntax.

**Goal:** Reproduce the current native PacketV3 implementation refusal through real public claimStep, with a valid isolated fixture and proof that refusal creates no authoritative owner.

**Architecture:** Extend the existing allowlisted public-claim integration test and its compiler-admission fixture. Use real PostgreSQL, native compiler/index/CAS, canonical admission/completion APIs and default public reader composition. The test expects a claim; current production must fail at the exact observed native reader mismatch.

**Tech Stack:** TypeScript ESM, node:test, PostgreSQL, existing P3 isolated projection launcher.

**Spec:** ../specs/2026-10-21-native-packet-v3-production-composition-design.md

## Global Constraints

- One sole writer: this worktree on fix/native-v3-production-composition-20261021, based on161297ffca6adf2851918a93d492e1c9a77ce59d.
- Root alone executes tests, DB/native/process actions and delivery; task worker authors only the two named Source test files and its report.
- No production implementation, launcher/allowlist change, runtime guard bypass, mock packet reader/compiler/publication, provider/network call, old run conversion or live database access.
- Keep legacy packet readers and native SourceMap/producer/release/sealed-report validation intact.
- Keep all fixture filesystem/log/CAS effects inside the disposable test-owned root; preserve/restore environment in finally. Cleanup applies only to fixtures created by this test, never retained records.
- Bootstrap refusal, missing import, empty native story list or invalid predecessor/admission state is not causal RED.
- This plan proves a regression reproduction only. Native story completion, downstream acceptance, build, rollout, workflow and full8 remain unqualified.

## File Map

| File | Responsibility |
|---|---|
| tests/execution-attempts/v3-platform-preclaim-claim.integration.test.ts | Add one real native positive public-claim regression with exact failure diagnostics and zero-new-owner oracle. Preserve all three existing tests and their behavior. |
| tests/execution-attempts/helpers/compiler-story-admission-fixture.ts | Add isolated native implementation fixture using existing canonical admission/completion helpers and native runtime packet compiler; preserve existing fixture exports/default behavior. |

Both files are already P3_TRACKED_SCOPE members. A new untracked test path is unnecessary and forbidden for this phase. No launcher policy change is justified.

### Task 1: Author the real native public-claim regression

**Interfaces:**
- Consume existing createIsolatedTestDatabase, pgConfigureIsolatedTestDatabase, seedCanonicalSetupBuildCompilerStoryAdmissionFixture, createRuntimePacketCompiler, createRuntimeArtifactReader/readExactSealedPacket and public claimStep.
- Add helper seedNativePacketV3ImplementationClaimFixture(database, {runId, repo, releaseSha}) returning {runId, stepDbId, storyDbId, agentId, runtimeIntent, packetHash, compilationReportHash, storyId}. Exact readonly types should use existing RuntimeClaimIntentV1 and TestDatabase types.
- The helper must leave a running protocolV3 run, completed and accepted predecessor authority, an indexed sealed PacketV3/ReportV3, and at least one pending admitted StoryPlanV2 story with valid clean Git base SHA/tree. Use real canonical APIs; no status-only completion forgery or injected default-reader replacement.

- [ ] Read the named existing tests/helpers and strict native reader fixture at tests/product-compiler/runtime-artifact-reader.test.ts:124. Use those as composition references, not a mock production seam.
- [ ] Add the bounded fixture helper. Pin its native packet/story/source identity with the strict exact reader before calling public claimStep. Assert predecessor completion requests are accepted with effects committed and pending story matches native StoryPlanV2/admission authority.
- [ ] Add one test named `claimStep claims a sealed native PacketV3 implementation story`. Capture only test-owned workflow log/warnings for this exact run. Take SQL snapshots of relevant run/story/step rows, claim sequence, claims, attempts, runtime sessions and owner reservations immediately before and after the claim.
- [ ] Use the following oracle structure, with genuine fixture APIs and snapshots implemented in the two named files:

```ts
const fixture = await seedNativePacketV3ImplementationClaimFixture(database, {
  runId: "run-native-v3-public-claim", repo, releaseSha: "7".repeat(40),
});
const before = await readScopedClaimAuthoritySnapshot(database, fixture);
const result = await claimStep(fixture.agentId, "native-v3-public-claim-test", fixture.runtimeIntent);
if (!result.found) {
  assert.match(readScopedFixtureWarnings(fixture.runId), /V3_NORMAL_PRECLAIM_PACKET_UNAVAILABLE/);
  assert.match(readScopedFixtureWarnings(fixture.runId), /setfarm\.product-build-packet\.v3/);
  assert.deepEqual(await readScopedClaimAuthoritySnapshot(database, fixture), before);
}
assert.equal(result.found, true,
  "An indexed sealed native PacketV3 with an admitted pending story must publish a real implementation claim");
```

The two read helpers in this skeleton are test-local functions to implement. They are not claimed existing exports. Derive the expected no-new-owner state from actual pre-call snapshots, not the production compiler. A correct GREEN implementation later earns further handoff/authority assertions under the full composition plan; this first phase must prove current failure causality.

- [ ] Self-review that no forbidden imports, source hooks, registration mocks, setup errors or non-native artifacts can satisfy the oracle. Preserve existing tests and cleanup semantics. Write a report with exact diff paths, environment mutations, fixture-owned effects and expected RED.
- [ ] Root independently reviews the diff and executes the unchanged guarded command:

```sh
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 tests/execution-attempts/v3-platform-preclaim-claim.integration.test.ts
```

Use pinned physical Node for the outer process and existing code-owned PATH recipe; unset inherited live DB URLs. All docs/new files must first be tracked and clean under ordinary branch commits, because the P3 launcher rejects untracked files and non-allowlisted dirty bytes. Do not change the command grammar or launcher to obtain a run.

- [ ] Root reads original capture/exit/stream facts and the exact failed assertion/diagnostic. Only a valid precise mismatch is recorded as causal RED. Fix fixture problems and rerun as needed; never call those failures a project regression.

## Root execution and next phase

This is the bounded regression-first subplan. After genuine RED, amend the full production implementation plan with concrete interfaces for native plan/handoff/context, atomic publication, durable reload, evidence and fenced completion before production edits. Separately finish reviewed orphan retirement and latency diagnostics; do not manually alter the cancelled current job. Independent review and clean committed build remain mandatory before any runtime delivery.
