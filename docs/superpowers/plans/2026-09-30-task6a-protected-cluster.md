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

Create test `tests/execution-attempts/task6a-private-protected-cluster.integration.test.ts` and the spec above. Modify `package.json` only for one explicit test command. No production source edits.

## Task 1: Real private protected PostgreSQL boundary

**Interfaces:** No exported runtime API; command consumes only explicit fixture opt-in. Produces node:test pass/fail and safe cleanup evidence, never host authority.

- [x] Inspect current host identities/tools and isolation; default existing OS fixture skips without effects. Merged-main standby build `6a5cb884` passed.
- [ ] Write a test that bootstraps an isolated cluster and asserts scoped client admin impersonation fails:

```ts
const denied = sqlAs("_www", "task6a_admin", "SELECT current_user");
assert.notEqual(denied.status, 0, "scoped client must not impersonate admin");
assert.match(denied.stderr, /peer authentication failed/i);
```

- [ ] Run the controlled private trust-HBA predecessor once. Expected RED: the exact admin impersonation assertion receives exit 0, after positive bootstrap succeeds. No live cluster is reachable.
- [ ] Replace private fixture HBA with peer/ident mappings and reject remainder; no test bypass flag:

```text
local all task6a_admin peer map=task6a_fixture
local all task6a_runtime peer map=task6a_fixture
local all all reject
local replication all reject
host all all 0.0.0.0/0 reject
host all all ::0/0 reject
```

- [ ] Add protected file/ancestor checks, non-login owner and scoped probe grants. Observe actual catalog/settings, allowed runtime INSERT/SELECT and forbidden SET ROLE/DDL/DELETE/TRUNCATE/CREATE ROLE/ALTER SYSTEM, old access and sudo denials.
- [ ] Restart exact captured postmaster using the same protected files; rerun positive and negative probes. Verify stopped state before exact bounded cleanup.
- [ ] Run default discovery (explicit skip), script without opt-in (refusal before effects), and `SETFARM_TASK6A_TEST_PROTECTED_PG_FIXTURE=1 npm run test:task6a-protected-cluster:isolated` (no skips, real pass).
- [ ] Run TypeScript/source contracts, diff check and affected opt-in fixture suites. Independently read-only review all lifecycle/cleanup risks; fix findings and rerun.
- [ ] Commit/push scoped branch; exact-head GitHub review/security green; reviewed PR merge without deleting branch/worktrees.
- [ ] Fast-forward clean standby main and ordinary guarded build, verify BUILD_INFO and unchanged selected deployment/HTTP. Record evidence and proceed to next causally required boundary, not live rollout by fixture success.

## Evidence

Root records exact observed RED/GREEN, cleanup, head and delivery results here. Full app tests are not inferred from this focused test-only deliverable.
