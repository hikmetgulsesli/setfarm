# Active Owner Row Snapshot V2 Implementation Plan

> **For agentic workers:** Root is the only writer and delivery owner. Review/research agents are read-only. Execute this plan inline with RED→GREEN cycles; do not delegate implementation writes.

**Goal:** Capture bounded active PostgreSQL owner rows in one read-only snapshot without granting physical ownership or cutover authority.

**Architecture:** A small internal-production module accepts a diagnostic fixture transaction port and executes fixed SQL plus strict canonical validation. The only production entry point lives in `db-pg.ts` and supplies the existing lazy connection under one `REPEATABLE READ READ ONLY` transaction. No V1 census or projection is changed.

**Tech Stack:** TypeScript ESM, postgres.js, Node `node:test`, canonical JSON hashing.

**Spec:** `docs/superpowers/specs/2026-09-23-active-owner-row-snapshot-v2-design.md`

## Global Constraints

- Preserve all current worktrees, dirty files, selected CLI/dist, services, database schema, and runtime data. No reset/revert/prune, DB writes, migrations, or guard bypass.
- All SQL tables are explicitly `public` qualified. A first same-snapshot aggregate query counts active rows and oversized selected text fields before any raw row SELECT.
- Maximum 256 rows per set; each row query uses `LIMIT 257`. Scalar text response limit 256 bytes, nullable worktree path limit 2,048 bytes. No latency-bound claim.
- Verify `COLLATE "C"` text order with `Buffer.compare` on UTF-8, BIGINT claim IDs with canonical decimal strings and `BigInt` comparison.
- Normalize postgres.js `Result extends Array` metadata only at the DB adapter boundary; retain strict plain-array and exact-row validation. Independent review found that passing raw `Result` would refuse every real query despite passing plain-array fixtures.
- Output is always `authority: "diagnostic-only"`, `physicalIdentityProvenance: "unverified"`; neither empty rows nor nullable worktree paths grant owner or cutover authority.

---

### Task 1: Fixed SQL and empty diagnostic snapshot

**Files:**
- Create: `tests/internal-production/baseline-positive-worktree-active-row-snapshot-v2.test.ts`
- Create: `src/internal-production/baseline-positive-worktree-active-row-snapshot-v2.ts`
- Modify: `package.json` (`test:internal-production:pure`)

**Interfaces:**
- Produce `observePositiveWorktreeActiveRowSnapshotInTransactionV2(query: (statement: string) => Promise<readonly Record<string, unknown>[]>): Promise<ActiveOwnerRowSnapshotV2>`.
- Produce `observePositiveWorktreeActiveRowSnapshotWithTransactionV2(begin)` which passes exactly `"isolation level repeatable read read only"` to the fixture transaction port.

- [ ] Write a fake transaction returning one literal aggregate row with eight zero decimal-string fields and four empty row arrays. Assert exact schema, diagnostic labels, frozen arrays/body, and a 64-hex snapshot hash. Capture five fixed SQL calls and assert each names its `public` table, active predicate, `ORDER BY` and `LIMIT 257`; aggregate must precede raw rows.
  ```ts
  const calls: string[] = [];
  const result = await observePositiveWorktreeActiveRowSnapshotWithTransactionV2(async (mode, operation) => {
    assert.equal(mode, "isolation level repeatable read read only");
    return operation(async (statement) => {
      calls.push(statement);
      if (calls.length === 1) return [{ runCount: "0", claimCount: "0",
        attemptCount: "0", sessionCount: "0", oversizedRunCount: "0",
        oversizedClaimCount: "0", oversizedAttemptCount: "0", oversizedSessionCount: "0" }];
      return [];
    });
  });
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.physicalIdentityProvenance, "unverified");
  assert.deepEqual(result.activeAttempts, []);
  assert.equal(calls.length, 5);
  ```
- [ ] Run `node --import tsx --test tests/internal-production/baseline-positive-worktree-active-row-snapshot-v2.test.ts` and verify RED because the module/API is absent.
- [ ] Implement the fixed aggregate and four SELECT statements, count/shape parser, frozen empty response, and hash. Reject nonzero oversized counts before raw SELECTs. Register the test file in `package.json`.
- [ ] Run the focused test and TypeScript check; verify GREEN before proceeding.

### Task 2: Active rows and refusal matrix

**Files:**
- Modify: `tests/internal-production/baseline-positive-worktree-active-row-snapshot-v2.test.ts`
- Modify: `src/internal-production/baseline-positive-worktree-active-row-snapshot-v2.ts`

**Interfaces:**
- Consume the Task 1 transaction/row-query seam.
- Produce frozen active runs, claims, attempts, and sessions with exact raw nullable worktree evidence and canonical `claimId` strings; no physical identity hash.

- [ ] Add literal fixtures for one row of each active set, including a nullable attempt worktree and a non-null session worktree. Include a BIGINT claim ID above `Number.MAX_SAFE_INTEGER`; assert its string survives exactly, and that run/claim rows remain visible even without attempt/session matches. Verify RED against the empty-only Task 1 implementation.
- [ ] Add refusal fixtures: `LIMIT 257` overflow; aggregate/row mismatch; oversized-field aggregate nonzero before raw SELECT; malformed/extra keys; duplicate or unsorted IDs; unpaired surrogate; and a `COLLATE "C"` UTF-8 order pair (`"\uE000"` before `"\u{10000}"`) that differs from JavaScript UTF-16 order. Each test must name the production break it catches and fail for the expected reason before its guard is added.
  ```ts
  assert.equal(Buffer.compare(Buffer.from("\uE000"), Buffer.from("\u{10000}")) < 0, true);
  ```
- [ ] Implement exact-row validation, UTF-8 byte ordering, decimal BIGINT validation, independent count comparison, and 256/2,048-byte field limits. Keep path strings raw; do not normalize or convert to physical identities.
- [ ] Run focused tests, `npm run test:internal-production:pure`, `npm run test:internal-production:cutover`, `npx tsc --noEmit`, and `git diff --check`; verify all outputs before committing.

### Task 3: Code-owned wrapper and delivery

**Files:**
- Modify: `src/db-pg.ts`
- Modify: `tests/internal-production/baseline-positive-worktree-active-row-snapshot-v2.test.ts` if wrapper behavior needs an additional test.

**Interfaces:**
- Produce zero-input `observeCodeOwnedPositiveWorktreeActiveRowSnapshotV2()` by passing `getSql()` to the tested helper, which invokes `begin` with the exact `"isolation level repeatable read read only"` mode; no caller-supplied URL, SQL, zero assertion, or owner projection.

- [ ] Extend the Task 1 transaction-seam test so the fake `begin` is called exactly once and a rejected transaction propagates as refusal. Keep SQL port mocking only at the external PostgreSQL boundary.
- [ ] Add the minimal `db-pg.ts` wrapper that passes `getSql()` into the tested read-only transaction helper and adapts `sql.unsafe(statement)` to its row-query seam. Do not create a new connection or query path.
- [ ] Cover a postgres.js-shaped `Result` container, preflight count 256 with a 257-row raw response, exact predicates/aliases, and every selected-field byte preflight. These close independent review gaps that could otherwise produce false or unobservable row evidence.
- [ ] Run focused/pure/cutover tests, TypeScript, migration/path/English checks as applicable, and diff checks. Request independent read-only code review; reproduce any Important/Critical finding RED before fixing it.
- [ ] Commit conventionally, push one scoped branch, open PR, inspect exact-head GitGuardian/cloud review, and SHA-condition the squash merge. Do not delete worktrees.
- [ ] Fast-forward the independent clean-main deployment clone and run normal `npm run build`; fast-forward only the selected source checkout while preserving selected dist/CLI physical identity. Run a read-only host DB probe only if an existing credential context is available, and report any connection refusal or unresolved rows without cutover claims.
