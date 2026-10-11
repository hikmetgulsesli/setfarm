# Task6A Closed Protected Backend Probe Implementation Plan

> Root implements inline with TDD; agents investigate/review read-only. User's
> root-only/autonomous protocol overrides implementation delegation and repeated
> approval prompts; executing-plans skill is unavailable.

**Goal:** Consume fixed protected socket custody without publishing runtime authority.

**Architecture:** Zero-input closed owner retains reserve/query originals and
joins driver/native close before descriptor release; cleanup uncertainty is sticky.

**Tech Stack:** Node >=22, TypeScript ESM, Postgres.js3.4.8, node:test.

**Spec:** `docs/superpowers/specs/2026-10-11-task6a-protected-backend-probe-design.md`

## Global Constraints

- Root sole writer on fix/cutover-dashboard-reviewed-delivery-v6; preserve worktrees.
- No live namespace, account, DB/schema, dependency, service or selector change.
- No caller SQL/transport/callback, injected production API or returned capability.
- Complete original settlement before physical FD release; no timer race.
- Modeled composition is not fixed-source positive authority or startup clearance.

## File Map

Create `src/internal-production/task6a-protected-postgres-backend-probe-v1.ts`
and `tests/internal-production/task6a-protected-postgres-backend-probe-v1.test.ts`;
register focused/default discovery in package.json. This paired plan/spec carries
the causal missing-consumer scope; do not alter existing socket/file/client owners.

## Task 1: Closed consumer

**Interface:** `probeTask6aProtectedPostgresBackendV1(): Promise<void>` consumes
existing zero-input socket holder and one-attempt client; returns no data/authority.

- [ ] Write missing-interface test plus functional healthy, pending reserve/query/
  close, source refusal, tuple drift, after-query recheck failure and undefined
  ending-failure controls. Use full real module translation with ONLY two exact
  imported dependency ports; source import must remain inert. Initial assertion:
  `assert.equal(typeof fixture.probe, 'function', 'missing closed backend consumer')`.
- [ ] Run actual test artifact. Expected RED is missing consumer, not an import
  or dependency setup exception. Retain actual raw and original child close.
- [ ] Implement zero-input owner: fixed holder before client, exact two literal
  SELECTs on reserved unsafe, full-tuple checks with holder rechecks around awaits;
  `finally { client.revoke(); reserved?.release(); await client.close(); held.close(); }`
  with independently attempted cleanup and explicit failure-presence flags. Keep
  held resources if client construction throws or close fails before returning
  its original; refuse future entry. Revoke/release throws cannot skip close.
- [ ] Run focused GREEN and adjacent descriptor/transport/socket controls. Strict
  source/actual-test types, version/English/path/migration/MC/diff checks; stock
  dirty build is forbidden. Independent source and complete raw review precede
  ordinary same-branch commit/push; PR remains draft until full integration gates.
- [ ] Record original results and unknown-cleanup limits. Positive fixed anchored
  proof stays pending until actual approved deployment provides that namespace;
  no private fixture path or modeled success may substitute for it.

Self-review: bounded one-consumer scope, exact signature/fields/cleanup and input
refusal consistent with spec; no grant/readiness/result claim or placeholder.
