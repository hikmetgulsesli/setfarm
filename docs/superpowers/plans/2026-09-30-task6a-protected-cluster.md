# Task6A Protected Cluster Implementation Plan

> **For agentic workers:** Root executes inline as the sole writer. Parallel agents perform read-only investigation and independent review only; this explicit owner constraint overrides implementation delegation. The executing-plans skill is unavailable; use this checked plan with TDD and verification-before-completion.

**Goal:** Prove the private OS/HBA identity boundary before the authorized live Task6A fence.

**Architecture:** Standalone opt-in real PG17 fixture, root-protected ancestor/configuration and distinct existing OS identities. Explicit socket-only transport and captured lifecycle identities; no ambient or live database dependencies.

**Tech Stack:** Node >=22, TypeScript ESM, node:test, macOS sudo, PostgreSQL 17.

**Spec:** `docs/superpowers/specs/2026-09-30-task6a-protected-cluster-design.md`

## Global Constraints

- macOS only; PostgreSQL 17; Node >=22; no new dependencies.
- Explicit opt-in `SETFARM_TASK6A_TEST_PROTECTED_PG_FIXTURE=1`.
- Root sole writer; no live cluster/roles/services/archives/selector mutation.
- No ambient DB imports or PG environment, TCP listener, live 5432, host account/group changes, credentials or trust override in delivered code.
- Exact root/device/inode/process identity; ambiguous cleanup fails and retains evidence.
- Fixture success never opens production Task6A or operator-discard gates.

## File Map

Create test `tests/execution-attempts/task6a-private-protected-cluster.integration.test.ts`, test-only `task6a-protected-cluster-policy.ts` and `.test.ts`, and the spec above. Modify `package.json` only for one explicit test command. No production source edits. Independent review found private trust could expose the existing server UID; a pre-startup guard regression replaces the unsafe planned live trust RED.

## Task 1: Real private protected PostgreSQL boundary

**Interfaces:** No exported runtime API; command consumes only explicit fixture opt-in. Produces node:test pass/fail and safe cleanup evidence, never host authority.

- [x] Inspect current host identities/tools and isolation; default existing OS fixture skips without effects. Merged-main standby build `6a5cb884` passed.
- [x] Write a test that bootstraps an isolated cluster and asserts scoped client admin impersonation fails:

```ts
const denied = sqlAs("_www", "task6a_admin", "SELECT current_user");
assert.notEqual(denied.status, 0, "scoped client must not impersonate admin");
assert.match(denied.stderr, /peer authentication failed/i);
```

- [x] Do not execute the controlled trust-HBA predecessor on this shared host. Write the launch-policy test first: `assert.throws(() => assertProtectedClusterPolicyV1({...safe, hba:'local all all trust\\n'}), /TASK6A_PROTECTED_CLUSTER_POLICY_REFUSAL/)`. With the empty guard, observe intended RED `Missing expected exception`, then implement the strict peer/ident/private-path/port/settings whitelist and observe 2/2 GREEN. This is policy RED/GREEN, not an asserted real database trust RED.
- [x] Replace private fixture HBA with peer/ident mappings and reject remainder; no test bypass flag:

```text
local all task6a_admin peer map=task6a_fixture
local all task6a_runtime peer map=task6a_fixture
local all all reject
local replication all reject
host all all 0.0.0.0/0 reject
host all all ::0/0 reject
```

- [x] Add protected file/ancestor checks, non-login owner and scoped probe grants. Observe actual catalog/settings, allowed runtime INSERT/SELECT and forbidden SET ROLE/DDL/UPDATE/DELETE/TRUNCATE/CREATE ROLE/ALTER SYSTEM, old access and effective root-audited sudo-policy denials. Prove data uid/mode 0700 and read/traversal denial after initialization and restart.
- [x] Restart exact captured postmaster using the same protected files; rerun positive and negative probes. Verify stopped state before exact bounded cleanup.
- [x] Run default discovery (explicit skip), script without opt-in (refusal before effects), and `SETFARM_TASK6A_TEST_PROTECTED_PG_FIXTURE=1 npm run test:task6a-protected-cluster:isolated` (no skips, real pass).
- [x] Run TypeScript/source contracts, diff check and affected opt-in fixture suites. Independently read-only review all lifecycle/cleanup risks; fix findings and rerun.
- [ ] Commit/push scoped branch; exact-head GitHub review/security green; reviewed PR merge without deleting branch/worktrees.
- [ ] Fast-forward clean standby main and ordinary guarded build, verify BUILD_INFO and unchanged selected deployment/HTTP. Record evidence and proceed to next causally required boundary, not live rollout by fixture success.

## Evidence

Root records exact observed RED/GREEN, cleanup, head and delivery results here. Full app tests are not inferred from this focused test-only deliverable.

- Independent pre-execution review blocked the unexecuted trust fixture and the
  path-based root chown cleanup. Both were removed. Root cleanup uses only system
  find/stat/rm after exact stopped/root/no-symlink/device checks; Homebrew Node is
  never elevated. `_postgres` sudo denial and trusted-driver limits are explicit.
- Default new integration test skipped without effects; package command without
  opt-in refused with `TASK6A_PROTECTED_PG_FIXTURE_REQUIRED` before test execution.
- First actual protected fixture run: 3/3 pass, zero skips, exit 0 (4.394s).
  Root `/private/tmp/setfarm-task6a-protected-pg.cMLJZu`, verified postmasters
  42944 and 43093; exact stops and temporary-tree removal passed. Read-only
  reviewer independently found root absent and both PIDs gone.
- Expanded effective-sudo/data-read/UPDATE proof run: 3/3 pass, zero skips,
  exit 0 (4.226s), root `/private/tmp/setfarm-task6a-protected-pg.FwNP2M`, verified
  postmasters 43836 and 44000 stopped and temporary tree removed. Actual settings,
  HBA/ident no-error/no-trust, root lsof no TCP, SQL/OS denials passed before and
  after restart. Default suite discovery also passed the two pure tests and
  explicitly skipped privileged integration.
- TypeScript no-emit, English 1843 files, path 942, version 2.3.79, migration
  digest and 12 Mission Control contract checks passed. No complete app-suite
  claim. Ambiguous lifecycle and malformed cleanup refusal paths were checked
  in source review, not exercised with process fault injections.
- New test/helper files also passed explicit strict standalone TypeScript
  no-emit (the normal project tsconfig covers only `src`). Independent final
  review found no remaining test-only code/safety blocker after the rerun.
- Fresh live read-only sample: migration 31, unreleased runtime sessions 0,
  unclosed claim_log rows 0; MC/gateway still HTTP 200. This is not a held fence
  and does not open Task6A or restore the currently stopped dashboard.
