# Evidence owner fixture implementation plan

> **For agentic workers:** Root executes inline with TDD; independent agents
> investigate/review read-only. No implementation or delivery delegation.

**Goal:** Restore the genuine evidence terminalization/replay verification gate
using authenticated owners and existing isolated P3 activation.

**Architecture:** Closed evidence catalog separates17 raw files and1 P3 owner
file; real fixture births use canonical reserve/insert/bind transactions.

**Tech Stack:** Node ESM tests, existing TypeScript/PostgreSQL/P3 runner.

**Spec:** docs/superpowers/specs/2026-10-01-evidence-owner-fixture-v1-design.md

## Global constraints and file map

Root sole writer in existing linked worktree, branchfix/evidence-owner-fixture-v1,
base4cdb88ddd3c88f9a926cd07632c075271ce1615c (PR255). Preserve all old branches,
trees, dirty files, archives, failed fixture, selector, live PG31/roles/services.
No reset/revert/maincommit/forcepush, credentials, privileged/native probes,
guard bypass or production migration/code change. No genuine host fixture overlap.
Map exactly the eight paths listed in the spec. Existing dependencies reused;
normal feature builds obey unchanged clean/main guards.

## Task1: Honest closed-catalog default evidence dispatch

- [x] Write script tests exercising planEvidenceTestsV1(entries,requested=[]),
  with hand-derived18 filename literals; assert17 raw selectors excluding owner
  and exact second command:
  ['--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node',
  '--import','tsx','--test','--test-concurrency=1',
  'tests/evidence/accepted-candidate-repository.test.ts'].
  Unknown/missing/duplicate/pure-directDB/requested-unknown refuse before spawn.
- [x] Observe missing-script assertion RED. Test actual default npm edge with a
  test-local builtin spawnSync interception and scrubbed environment; prevent
  any raw --test invocation including the owner file BEFORE imports/DB effects.
  Old package command must give observable raw-owner refusal, not launch DB.
- [x] Implement inert MJS planner and main using fixed catalog/actual source
  discovery, serial spawnSync(process.execPath,command,{cwd:ROOT,env,stdio:'inherit'}).
  Delete child SETFARM_PG_URL; nonzero/signal/error stops, no extra selection API.
- [x] Set package test:evidence='node scripts/run-evidence-tests.mjs'. Update
  existing package coverage expectation to this dispatcher; real npm-edge test
  proves actual selected commands, with no grep-only authority claim.
- [x] Run focused dispatch/package tests GREEN and coherent omitted-owner/raw
  route mutants in memory; only real wrong consumer outcomes count as failures.

## Task2: Positive fixture ownership and genuine failure controls

- [x] Fresh old clean-main test:evidence RED104/103PASS/1FAIL with exact owner
  unavailable stack, own test DB definitely dropped; independent diagnosis.
- [x] Add the exact fixture path to P3_TRACKED_SCOPE, no glob/source bypass.
- [x] Import actual reserve/bind/run identity/PgTransactionSql from db-pg and
  attempt canonical identity from internal-production/owner-admission-v1.
  For run and attempt use database.sql.begin: beginOrAdopt with exact producer,
  insert the unchanged original row, then bind with returned reservation pair
  and canonical identity; no fabricated SQL reservation rows.
- [x] Add positive query expecting [{category:'execution-attempt',state:'closed'},
  {category:'run',state:'closed'}] ordered by category after true terminalization.
  Keep all existing candidate/replay/source-mismatch/immutability assertions.
- [x] Add test-only missing-owner modes (attempt or run). Snapshot full run,
  attempt, admission-head and owner rows before terminal call; assert actual
  specific unavailable error, and unchanged snapshot after transaction rollback.
  Use only real production close logic; no alternate resolver/DB triggers.
- [x] Commit mapped current bytes to a clean feature before genuine P3 run;
  execute npm run test:evidence with existing isolated local test admin endpoint
  and privileged opt-ins unset. No source/projection guard overrides.
- [x] Review/fix any fresh root cause via RED/GREEN, then affected ownership,
  full evidence/evals, contracts/noemit/check-only digests/diff verification.

## Task3: Reviewed delivery and continued broad proof

- [x] Independent read-only exact committed review; fix important findings.
- [ ] Conventional root commit/push/PR; inspect exact-head available cloud,
  security and fully paginated comments/reviews/threads; normal SHA-bound merge.
- [ ] After standby execution graph definitively closes, ff-only clean main,
  ordinary guarded build/compiled CLI/merged evidence and read-only PG/HTTP.
- [ ] Keep private findings cluster/protected native/fence/genesis/32/33/live
  admission separate; no whole npm or Task6A completion inferred from this slice.

## Verification ledger (2026-09-30 22:38 UTC)

Implementation HEADa7aaf4dc8078d2a10c0616eaf10528168415d677 is clean and contains
only the eight mapped paths. Independent dispatcher and fixture reviews found
no blocking issue; the fixture review pins this exact committed head.

- Missing dispatcher assertions gave eight genuine REDs. The corrected actual
  old npm edge refused raw owner import before effects; the initial two attempted
  edge tests instead timed out because their preload checked a Node flag in
  process.argv. Those timeouts are NOT valid RED/no-effect evidence. Root kept
  five read-only-discovered unowned-provenance contract-spine test DB footprints;
  none were manually dropped or modified. Two names fit the timeout PIDs, but
  exact creation provenance is not established. See external checkpoint.
- Genuine P3 fixture RED: six tests/four passes/two owner-unavailable failures.
  Real owner births fixed the positive; the next genuine run had five passes and
  one incorrect hand-derived missing-run error expectation. Root checked db-pg
  and corrected it to INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE, without
  production changes. Every P3 DB created by these runs was owner-dropped.
- Fresh full default evidence command at committeda7aaf4dc, session42685, exit0:
  raw100PASS/0FAIL/0SKIP8122.757458ms, genuine P3 owner6PASS/0FAIL/0SKIP42043.46525ms.
  Clone/primary/template prefix6a06bfaa512f13a6e7d8ab9f all definitely dropped.
- Fresh dispatcher10PASS/0FAIL/0SKIP539.957458ms. Full evals51PASS/0FAIL/0SKIP
  18716.404292ms, all three exact temporary DBs owner-dropped.
- Both coherent in-memory omitted-owner and raw-owner-route mutants fail the
  hand-derived real command consumer assertions; original succeeds, exit0.
  First throwaway mutation harness had a local entries() typo and is not proof.
- TypeScript noemit, version2.3.79, English1903, paths959, check-only migration
  digests, Mission Control12 artifacts and diff checks all exit0. No production
  source, migration or generated digest changed.

The independent standby execution stage on cleanmain4cdb88dd is still running:
raw1160tests/1104PASS/0FAIL/56opt-in SKIP is only its first stage; the P3 files
remain in flight. No full execution, full npm, private finding fixture, protected
native/admission or live cutover completion claim follows from this ledger.
