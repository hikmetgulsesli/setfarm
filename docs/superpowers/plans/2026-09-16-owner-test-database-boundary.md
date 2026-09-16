# Owner Test Database Boundary Implementation Plan

> **Execution:** Primary-owner serialized test-first change with independent review.

**Goal:** Prevent direct PostgreSQL owner fixtures from touching an unqualified
database when invoked outside the real P3 runner.

**Architecture:** Require the existing one-shot P3 test capability before each
of the four direct database fixtures imports its DB port or prepares a repository.
Reject missing authority instead of returning early or trusting URL presence.
Preserve every authenticated positive assertion and the runner's exact command.

**Tech Stack:** TypeScript AST callback extraction, fresh Node child processes,
existing test-database capability authentication.

**Spec:** Existing P3 isolation boundary, required by the approved deployment
cutover verification in `2026-09-16-preserved-deployment-cutover-design.md`.

## Evidence and file map

An incorrectly launched raw owner suite reached the historical-source fixture's
first INSERT, which failed because the production schema lacked the target
table. No insert succeeded. The adjacent two corruption fixtures and activation
fixture trust URL presence; activation includes DROP SCHEMA on its test DB.
This is the same missing test-authority boundary, not a runtime product change.

- Modify `tests/internal-production/owner-admission-v1.test.ts`: the historical
  source, source TEXT spelling, activation TEXT spelling and initial activation
  callbacks. Import `../execution-attempts/test-database.js` and call
  `authenticateP3ProjectedReadinessTestCapabilityV1()` before any DB/fixture work.
- Create `tests/internal-production/owner-admission-database-boundary-v1.test.ts`:
  execute original callback AST in fresh processes with absent and production-
  shaped URLs. Replace only the direct DB import with a connection-free trap;
  keep real capability authentication. Trap fixture preparation separately.

## Task

- [x] Run eight negative cases RED. Historical-source must reach the DB trap
  before the fix; absent-URL early returns must also fail the refusal assertion.
- [x] Add the four existing capability checks; remove three weak URL returns.
  No test skipping, registration change, runner allowlist or runtime guard edit.

```ts
const isolation = await import("../execution-attempts/test-database.js");
isolation.authenticateP3ProjectedReadinessTestCapabilityV1();
```

- [x] Rerun negative cases GREEN, noemit/contracts and independent review.
- [x] Rerun the complete owner file through the unchanged isolated runner alone.
  Genuine P3 authority and original PostgreSQL assertions are the positive witness.

The earlier raw-suite failures remain failed evidence. Current isolated source
8845d2df run must finish before its result is assessed; its early global-inventory
failure may be concurrent-test interference. Do not hide or relabel it.

Eight negative cases pass after authentication was moved before effects;
root9698.307209ms and independent reviewer8.63s, zero skips. The activation
regression traps repository preparation before its try/finally; a fake repository
would let unrelated cleanup globals mask the intended RED boundary. Existing
positive database bodies remain unchanged. Combined focused76/76 pass.

Original isolated8845d2df run finished104/105,1842123.239917ms. Sole failure:
FD3 early-close fixture global inventory at2873 lost unrelated template
setfarm_p3_26af60255092c7e4dcf84e29_template while raw nested work overlapped.
Its own primary/template stayed present and were subsequently cleaned by runner.
No other test failed; revised-checkpoint solitary full P3 remains required.

Superseding solitary verification at22b93b61 finished105/105,zero failures/skips,
1703344.576708ms. All four authenticated positive PostgreSQL fixtures passed.
Runner cleaned its primary/template prefix49009c195e6e66514069d3ee; no other DB
suite ran concurrently. Durable log: workspace logs/2026-09-16-owner-admission-22b93b61.log.
This supersedes the rerun requirement, not the historical failed evidence.
