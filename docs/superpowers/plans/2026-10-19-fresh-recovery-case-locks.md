# Fresh recovery case locks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permit genuine ordinary terminal recovery row locking without permitting runtime recovery mutation.

**Architecture:** Extend the existing fixed fresh-installation runtime grants with one owner-only ALWAYS statement guard and exact catalog validation. Keep all terminal SQL and mutable locks unchanged. Genuine restricted PostgreSQL component tests and later activated runtime qualification provide different evidence, labelled separately.

**Tech Stack:** Existing TypeScript/postgres/node:test/tsx; Node26.4.0, source-owned isolated PG fixtures.

**Spec:** `docs/superpowers/specs/2026-10-19-fresh-recovery-case-locks-design.md`

## Global Constraints

- Root alone stages, commits, pushes and delivers; only one implementation agent at a time.
- Preserve mutable FOR UPDATE, lock order/CAS/owner/admission and all runtime guards.
- Only new fresh `UPDATE(updated_at)` on recovery_cases, guarded before grant; no business mutation authority.
- Preserve exact published migration17 baseline pointer trigger and all published migration bodies/digests.
- No live DB/provider/service/ACL effects; Root supplies isolated harness and captures real RED/GREEN.
- Preserve failed I1/I2/I3 records, eight retained writer builds, worktrees and scratch; 8GiB test floor.

---

### Task 1: Fixed guarded case lock and genuine restricted-role regressions

**Files:** Modify `src/installation/fresh-installation-runtime-grants-v1.ts`, `tests/installation/fresh-installation-operational-schema.integration.test.ts`, `docs/superpowers/plans/2026-10-18-fresh-installation-operational-activation.md`; create `tests/installation/fresh-installation-terminal-recovery-locks.integration.test.ts`. Use only existing helpers unless a small shared fixture extraction materially avoids duplicate setup; report expanded FileMap before any such edit.

**Interfaces:** Existing `installFreshInstallationRuntimeBusinessGrantsV1(sql,role)` and `verifyFreshInstallationRuntimeBusinessGrantsV1(sql,role)` unchanged. Consume actual exported `lockV3TerminalRecoveryChainInTransaction` / `settleV3TerminalRecoveryChainInTransaction` and genuine `createFreshInstallationTestFixtureV1`. Produce exact fresh guard catalog/ACL extension, not a new public authority API.

- [ ] Read the spec and full read-only blueprint `/Users/setrox/ai/setrox/logs/2026-10-19-ui-implementation/recovery-lock-design.md`; inspect current delivery precedent, baseline migration17 and schema-valid owner recovery seed. Write decisive failing actual helper test on genuine restricted connection after run lock; assert frozen snapshot with empty case/delivery arrays after correction. Add tests below before source changes where feasible. Tell Root to freeze/commit RED fixtures for the unchanged existing harness source guard; do not bypass it.

```ts
await runtime.begin(async tx => {
  await tx`SELECT id FROM runs WHERE id=${runId} FOR UPDATE`;
  const chain = await lockV3TerminalRecoveryChainInTransaction(tx as never, runId);
  assert.equal(Object.isFrozen(chain), true);
  assert.equal(chain.deliveries.length, 0);
  assert.equal(chain.cases.length, 0);
});
```

- [ ] Root runs repository-owned isolated PG harness for exact new module using protected input/sanitized env, retains full process/terminal capture. Expected decisive RED42501 for recovery_cases, not an unrelated setup/assertion error. Worker waits for valid RED before production edit.
- [ ] Add the fixed case descriptor and private guard install/verify, atomically before grant and read-only after. Preserve baseline ROW/O trigger; verify its actual column/function identity alongside new statement/A trigger. Reject any unknown user trigger, extension collision, bad body/ACL/owner/OID/WHEN/args/deferrability/mode/column-grant drift without repair. No arbitrary table API; no refactor beyond this source cause.

```sql
CREATE TRIGGER trg_setfarm_fresh_recovery_case_lock_v1
BEFORE UPDATE ON public.recovery_cases FOR EACH STATEMENT
EXECUTE FUNCTION public.setfarm_fresh_recovery_case_lock_guard_v1();
ALTER TABLE public.recovery_cases ENABLE ALWAYS TRIGGER trg_setfarm_fresh_recovery_case_lock_v1;
-- Only after exact guard verification, within the owned install transaction:
GRANT UPDATE(updated_at) ON public.recovery_cases TO <validated_runtime_role>;
```

- [ ] Complete behavioral regressions: (a) exact empty helper+failed/cancelled/completed empty settle; (b) complete actual normal lock/projection SQL arguments under restricted PG including nonempty completion branch, transparently delegated or AST-extracted production SQL; (c) only updated_at column privilege and every actual runtime UPDATE denied, including WHEREfalse, equal and changed matched timestamp, business fields, trigger/function tamper/direct execution; (d) real case-only and delivery+case contention55P03 then success, referenced terminal case and mismatch; (e) rollback-only admin sets replica then SETLOCALROLEruntime and guard still denies; (f) exact drift/collision/atomic rollback with baseline pointer trigger intact; (g) populated settlement denied and transaction unchanged; (h) schema-only public terminal guard still refuses. Do not fake activation or owner authority to satisfy h.

```ts
await assert.rejects(runtime`UPDATE recovery_cases SET updated_at=updated_at WHERE FALSE`, {code:'42501'});
await assert.rejects(contendingLock, {code:'55P03'});
assert.equal((await catalog()).baselineTriggerEnabled, 'O');
assert.equal((await catalog()).freshTriggerEnabled, 'A');
```

- [ ] Freeze source for Root commit and actual PG GREEN captures. Run affected schema/provenance and terminal helper regressions with the existing isolated prerequisites, non-emitting TypeScript and semantic migration integrity checks. Record commands, exact outcomes, all warnings and component/public-close limits. Update activation plan FileMap/causal scope. Root obtains task+whole-branch review, normal PR merge, and stock build in a clean immutable release checkout, preserving retained writer builds. Later genuine activated close/full8 remain Root-owned operational gates.
