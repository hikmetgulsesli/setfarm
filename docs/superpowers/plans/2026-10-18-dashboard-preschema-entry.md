# Dashboard Pre-schema Entry Implementation Plan

> **For agentic workers:** Root remains the sole writer in the existing isolated
> worktree. Delegate only independent read-only reviews.

**Goal:** Refuse an unqualified Task6A ordinary dashboard before its startup
effects while preserving the synchronous API for absent-operation callers.

**Architecture:** Reuse the existing asynchronous read-only guard at ordinary
entry boundaries. Add an absent-only synchronous guard and a safe asynchronous
server entry sharing a private HTTP constructor. Preserve all other guards.

**Tech Stack:** TypeScript ESM, Node test runner, controlled source fixtures.

**Spec:** `docs/superpowers/specs/2026-10-18-dashboard-preschema-entry-design.md`

## Global Constraints

- Root is the sole writer; no direct main commit or dirty build.
- No new dependency, guard-bypass flag, mutable admission latch or proof option.
- Do not guard `getSql` recursively or change migration32/33 apply/verify fences.
- Preserve synchronous API compatibility and separate restricted/core readers.
- No native/40-DATA execution or protected service/OS/DB transition admission.

## Task 1: Enforce entry ordering

**Files:** The specification's twelve-path File Map defines the complete scope.

**Interfaces:** Keep `startDashboard(...): http.Server`. Add
`startDashboardWithPreSchemaAdmissionV3(...): Promise<http.Server>` and
`assertTask6aPreSchemaSynchronousOrdinaryStartupV3(): void`. Existing asynchronous
`assertTask6aPreSchemaOrdinaryStartupV2(): Promise<void>` remains authoritative
for the additional refusal only; it grants no broader startup authority.

- [x] Extend the maintained dashboard fixture with a controlled pre-schema
  refusal for direct synchronous/asynchronous server, parent, daemon, explicit/
  implicit/legacy CLI start and auto-start. Assert zero status, mutation,
  create/listen and child effects. Add genuine synchronous-body cases for
  out-of-scope workspace, absent operation and present operation.
- [x] Run the new cases before production edits:
  `node --import tsx --test --test-name-pattern='Task6A V3'
  tests/internal-production/baseline-dashboard-cutover-startup-refusal-v2.test.ts
  tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`.
  Confirm actual RED comes from a missing guard/entry or effects preceding the
  forced refusal, rather than an unqualified fixture resolution.
- [x] Add the synchronous absent-only helper using the existing private
  workspace scope/observer/failure routines. Guard both public server entries;
  move unchanged HTTP implementation into a private constructor. Insert the
  asynchronous guard and post-await cutover recheck at CLI, parent and daemon.
- [x] Give HTTP route tests an explicit temporary ordinary workspace for the
  synchronous constructor. Keep their real HTTP response/effect assertions and
  cleanup. Do not invoke the live operation or use a runtime-bypass flag.
- [x] Update the v4 CLI body pin with an exact mechanical comparison allowing
  only the added guards. Run the new cases to GREEN, then the full maintained
  dashboard fixture, four HTTP route tests, full v4 entry tests and selected
  synchronous plus claim/peek invariants. Capture original terminal results.
- [x] Run TypeScript no-emit and version/English/path contracts. Review the whole
  diff independently, including unchanged HTTP-body preservation and all prior
  refusal assertions. Resolve concrete findings.
- [ ] Commit/push only the File Map paths on this scoped branch. Obtain the
  current-head GitHub review/checks and use normal SHA-bound PR delivery. Sync
  this same writer to clean main with ff-only and run the default build; qualify
  artifacts/retention before any separately admitted actual startup check.
- [ ] Update continuity with exact tests, builds, current native/model limits and
  the next permitted action. Do not mark a missing through33 proof, protected
  transition, native test or real run complete.

## PR284 lifecycle correction

- [x] Record genuine delayed/failing-preflight RED before production edits.
- [x] Replace fixed PID delay with bounded child IPC readiness after listening;
  preserve initial refusal ordering and remove only the child's own PID record.
- [x] Verify delayed success, post-PID failure, listener failure, maintained
  entry/HTTP/CLI regressions, TypeScript and contracts. Independently review the
  correction, including write-then-throw and confirmed forced termination.
- [ ] Obtain a fresh exact-head GitHub review before delivery.
