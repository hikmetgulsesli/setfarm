# Task6A V2 Writer Topology Preflight Implementation Plan

> **For agentic workers:** Root is the sole writer. Execute the tasks inline with RED/GREEN; independent agents may review read-only. Steps use checkbox (`- [ ]`) tracking.

**Goal:** Add a fail-closed, diagnostic-only topology preflight that exposes why the current superuser runtime role cannot be a mechanical Task6A writer fence.

**Architecture:** A pure, import-inert V2 leaf validates a fixed launcher/database-role snapshot and returns a frozen canonical-hashed blocker projection. It never grants admission, authenticates host evidence, or changes V1/migrations. A later independently reviewed adapter must obtain authenticated host facts.

**Tech Stack:** TypeScript ESM, Node test runner, existing canonical JSON hash.

**Spec:** `docs/superpowers/specs/2026-09-26-task6a-v2-writer-topology-preflight-design.md`

## Global Constraints

- Root alone writes. Keep all preserved worktrees, selected historical dist and CLI link visible and unchanged.
- No live DB, role, credential, plist, process, service, migration, owner-admission, or cutover mutation.
- Preserve V1 source/semantics and frozen migration 32/33 digests.
- Output is always diagnostic-only and never a zero-owner lease or cutover admission.

## File Map

- Create `src/internal-production/baseline-task6a-writer-topology-preflight-v2.ts`: strict pure input capture, blocker derivation and canonical hash.
- Create `tests/internal-production/baseline-task6a-writer-topology-preflight-v2.test.ts`: real leaf RED/GREEN behavior, crossed/malformed refusal and no-authority serialization.
- Modify `package.json`: register the test in `test:internal-production:pure`.
- Update this plan's checkboxes and the external cutover status ledger with exact evidence.

---

### Task 1: Strict blocked/unverified projection

**Files:** Create the source/test pair above.

**Interfaces:** Export `projectTask6aWriterTopologyPreflightV2(input: unknown)`. Input exact keys: `schema,databaseName,databaseOwnerRole,controllerRole,runtimeRole,launcherRoles`. Runtime role exact keys: `name,login,superuser,bypassRls,createRole,createDatabase,activeSessionCount`. Launcher row exact keys: `label,role`; three rows appear in fixed order `com.setrox.setfarm-spawner`, `com.setrox.setfarm-dashboard`, `com.setrox.mission-control`. Input schema is `setfarm.internal-production-task6a-writer-topology-input.v2`. Result exact fields are `schema,authority,evidenceProvenance,cutoverAdmission,status,blockers,sourceSnapshotHash,topologyHash`; sourceSnapshotHash binds the normalized validated input and topologyHash hashes the prior result fields. Role grammar: `^[a-z][a-z0-9_]{0,62}$`.

- [x] **Step 1: Write RED tests.** Use the current-host-shaped literal `setrox` fixture (`superuser:true`, database owner `setrox`, all three launchers `setrox`, one active session) and assert exact sorted blockers. Use a separate least-privilege-shaped fixture and assert only `status:"unverified"`, `cutoverAdmission:"not-granted"`, `evidenceProvenance:"caller-supplied"`. Assert frozen output, no URL/token/secret field, and SHA-256 shape; later assert a changed validated role identity changes the topology hash. The production changes caught are falsely treating a superuser as fenced or promoting a caller-shaped safe profile to authority.

```ts
const current = {
  schema: "setfarm.internal-production-task6a-writer-topology-input.v2",
  databaseName: "setfarm", databaseOwnerRole: "setrox", controllerRole: "postgres",
  runtimeRole: { name: "setrox", login: true, superuser: true, bypassRls: false,
    createRole: false, createDatabase: false, activeSessionCount: 1 },
  launcherRoles: [
    { label: "com.setrox.setfarm-spawner", role: "setrox" },
    { label: "com.setrox.setfarm-dashboard", role: "setrox" },
    { label: "com.setrox.mission-control", role: "setrox" },
  ],
};
assert.deepEqual(projectTask6aWriterTopologyPreflightV2(current).blockers,
  ["runtime-database-owner", "runtime-session-present", "runtime-superuser"]);
```

- [x] **Step 2: Run RED.** `env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx --test tests/internal-production/baseline-task6a-writer-topology-preflight-v2.test.ts`. Expected failure: new source export/module missing, not a fixture error.
- [x] **Step 3: Implement GREEN.** Capture only exact own enumerable data properties of plain records/arrays; reject proxies, accessors, symbols, inherited or extra keys, wrong fixed labels/order, invalid role grammar, wrong schema/database, non-boolean flags, negative/non-safe session counts. Derive exactly `launcher-role-mismatch`, `runtime-bypass-rls`, `runtime-can-create-database`, `runtime-can-create-role`, `runtime-database-owner`, `runtime-matches-controller`, `runtime-no-login`, `runtime-session-present`, and `runtime-superuser`; sort and freeze them. Return `blocked` when nonempty and `unverified` otherwise, always with diagnostic-only/not-granted/caller-supplied literals. Hash the normalized validated input into `sourceSnapshotHash`, then the output body into `topologyHash` using `hashCanonicalJson`.
- [x] **Step 4: Run GREEN.** Rerun the focused command; require all tests pass and `npx tsc --noEmit` exit 0.

### Task 2: Adversarial refusal and suite integration

**Files:** Extend the source/test pair; modify `package.json` only at the pure-suite script.

**Interfaces:** The same export and exact schema; no host adapter or new authority flag.

- [x] **Step 1: Write RED negatives.** Mutate each fixture independently: launcher role mismatch, controller/runtime equality, bypass-RLS, CREATE ROLE, CREATE DATABASE and no-login must yield their literal blocker; malformed role, extra key, wrong label/order, duplicate label, proxy, accessor and negative session count must throw `INTERNAL_PRODUCTION_TASK6A_WRITER_TOPOLOGY_INVALID`. The production changes caught are omitting a privileged path, accepting ambiguous input, or evaluating attacker-supplied getters.
- [x] **Step 2: Run RED.** Use the focused command above; verify each new expectation fails on the missing validation/branch, not on a test setup error.
- [x] **Step 3: Implement minimal GREEN.** Add only missing blocker branches and strict checks. Do not add a ready/eligible state or any I/O.
- [x] **Step 4: Verify.** Focused tests, `npm run test:internal-production:pure`, `node --import tsx --test tests/execution-attempts/migration-source-digests.test.ts`, `npx tsc --noEmit`, `npm run check:version`, `npm run check:english`, `npm run check:paths`, and `git diff --check` must exit 0. If script names differ, inspect `package.json` and run the exact existing equivalent; record what actually ran.

### Task 3: Independent review and delivery

**Files:** This plan and external `logs/2026-09-25-cutover-status.md` evidence ledger.

- [ ] Request independent read-only review against the spec and `origin/main..HEAD`, including false-authority and malformed-input paths; resolve Critical/Important findings with RED/GREEN.
- [ ] Freshly verify focused/pure/migration tests, TypeScript/source contracts and diff; stage scoped files and make a conventional commit.
- [ ] Push the branch; open a PR against `main`; inspect exact-head checks, review comments, GitGuardian/Codex/Copilot/Gemini state without claiming an unseen review; merge only reviewed exact head under branch protection.
- [ ] Fast-forward a separate clean-main deployment clone and run its normal guarded build. Do not delete retained build generations or alter the selected historical dist/link.
- [ ] Record the current sanitized role/launcher/session observation and HTTP health. The deliverable remains diagnostic-only; live V2 authority/DB role transition/cutover are separate reviewed work.

## Self-review

Every spec requirement in this slice maps to Task 1 or 2, and delivery evidence maps to Task 3. No task edits V1/migration bytes or pretends the caller-supplied projection is a host-attested writer fence. The next task after this PR is a separate source-authenticated read-only topology adapter, not live access-control mutation.

## Execution evidence

- Initial RED: missing V2 source module, exit 1. Initial GREEN: focused 2/2, exit 0.
- Adversarial RED: focused 4/20 pass, 16/20 fail for missing hash binding, blocker branches and strict input validation. GREEN: focused 20/20, exit 0.
- Pure suite 195/195, cutover suite 424/424, Task 0 source manifest 18/18, migration source digests 15/15, TypeScript no-emit and version/English/path contracts all exited 0. `git diff --check` exited 0. These runs preceded Task 3 independent review and any final commit. Full `npm test` requires the absent isolated PostgreSQL admin URL; the changed leaf has no database I/O and these are the scoped pure/cutover/migration/source checks.
