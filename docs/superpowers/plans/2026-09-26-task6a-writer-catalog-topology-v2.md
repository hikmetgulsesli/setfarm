# Task6A writer catalog topology V2 implementation plan

**Goal:** Deliver a source-authenticated, no-write, held three-launcher PostgreSQL catalog topology diagnostic for least-privilege transition planning, without claiming writer exclusion or cutover authority.

**Architecture:** Fixed read-only SQL and strict projection; private held-launcher URL binding; separate hashed host diagnostic; additive authenticated bootstrap verb. All existing authority, migrations, launcher behavior, and selected runtime bytes remain unchanged.

**Tech stack:** TypeScript ESM, PostgreSQL 16+, Node.js test runner, existing deployment-cutover bootstrap.

**Spec:** `docs/superpowers/specs/2026-09-26-task6a-writer-catalog-topology-v2-design.md`

## Task 1: Fixed SQL and strict diagnostic projection

1. Add RED tests in `tests/internal-production/baseline-task6a-writer-catalog-topology-v2.test.ts` for one fixed SQL statement, direct-membership and application-object counts, safe integer/text validation, role/version checks, canonical hash and diagnostic-only fields. Require SQL errors and malformed/proxy/accessor rows to sanitize.
2. Implement `src/internal-production/baseline-task6a-writer-catalog-topology-v2.ts` with an import-inert URL adapter, exact local target, bounded repeatable-read/read-only transaction, strict cleanup and no ambient `PG*` variables.
3. Run focused RED then GREEN tests and TypeScript no-emit.

## Task 2: Held three-launcher composition

1. Add RED tests for the holder's private qualified method and new host composer's call order, role equality, holder drift, cleanup and no-admission behavior.
2. Add one qualified method to `baseline-deployment-cutover-launcher-observation-v1.ts`; create `baseline-task6a-writer-catalog-host-v2.ts` using the existing V2 held host and a separate catalog observation while both holders remain held. It must not reinterpret the prior V2 output.
3. Run focused tests and the complete internal-production pure/cutover suites.

## Task 3: Authenticated read-only host entry and delivery

1. Add RED bootstrap tests for unsupported/failed source, malformed result and sanitized refusal, then add one fixed `inspect-task6a-writer-catalog-host-v2 --json` verb with exact public validation.
2. Run focused tests, script suite, TypeScript, version/English/path/migration/contract checks and diff check. Do not bypass the clean-main build guard on the feature branch.
3. Obtain independent read-only review; root stages, commits, pushes and delivers one reviewed PR. Preserve all worktrees.
4. On clean synchronized `main`, run normal guarded build and one authenticated no-write host observation; record its exact outcome, selected old CLI hashes and HTTP health. Never infer cutover authority from the result.

## 2026-09-26 implementation evidence before delivery

- RED established missing topology module, missing held catalog method, missing host composer and missing bootstrap verb. GREEN focused topology/host/bootstrap tests passed, including import inertness, bounded adapter, URL/role equality, no-secret redaction, callback order, cleanup and authenticated fixture refusal.
- Independent read-only SQL review found that PostgreSQL 16+ allows multiple grants for one direct role membership and that column/type/database ACL rows were omitted. The fixed SQL now uses `COUNT(DISTINCT roleid)` for four direct-membership metrics, includes the selected ACL row surfaces and explicitly names the count as non-exhaustive. The revised exact query executed on local PostgreSQL 17.10 in an explicit repeatable-read/read-only transaction; its strict projector returned one 20-column row, 16 count fields and `diagnostic-only/not-granted`.
- Independent read-only security review found no blocking issue. Its bootstrap test gap was closed with genuine authenticated fixture cases for valid output, tampered hash, self-consistent cutover label, crossed role, malformed nested writer flag and sanitized observer failure; focused 6/6 passed.
- `npm run test:internal-production:pure` 276/276 and `npm run test:internal-production:cutover` 433/433 passed on the final source. `npm run test:scripts` passed 863/863 script tests plus 43/43 genuine integration tests; the final extra malformed-writer fixture case was run separately because it was added while the broad suite was already in flight. TypeScript no-emit, version/English/path/migration-digest/Mission Control contract checks, manifest 18/18 and `git diff --check` passed.
- This slice remains a diagnostic-only inventory. It neither supplies continuous writer exclusion nor authorizes Task6A, migration32/33, role/grant/plist changes, CLI switch, worktree cleanup or golden runs.
