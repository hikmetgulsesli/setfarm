# Task6A Physical Socket Evidence Implementation Plan

> **For agentic workers:** Root implements inline; user explicitly requires sole writer. Agents only research/review read-only; executing-plans unavailable. Use TDD and verification-before-completion.

**Goal:** Authenticate fixed descriptor-derived physical Unix socket facts without publishing pools or admission.

**Architecture:** Generic diagnostic socket pin/recheck leaf; zero-input fixed descriptor/root-ancestor composition. Real source proof in existing isolated peer fixture.

**Tech Stack:** Node >=22, TypeScript ESM, macOS, Postgres.js3.4.8, PostgreSQL17, existing esbuild/node:test.

**Spec:** `docs/superpowers/specs/2026-09-30-task6a-physical-socket-evidence-design.md`

## Global Constraints

- Root sole writer; all old worktrees/branches preserved.
- No live namespace, DB/schema, account/service/selector/dependency mutation.
- Directory0710/socket0777, exact identities, no ACL/symlink, no permission widening.
- Generic data is not production/grant/schema/readiness/owner/admission authority.
- Zero-input loader has no path/env/URL override; close uncertainty remains fenced.
- Root fixture policy/lifecycle/cleanup unchanged; no root Node execution.

## File Map

Create `src/internal-production/task6a-socket-physical-evidence-v1.ts` for both
bounded diagnostic leaf and fixed protected composition, plus
`tests/internal-production/task6a-socket-physical-evidence-v1.test.ts`.
Extend existing `tests/execution-attempts/task6a-protected-cluster-client-entry.ts`
and only scoped proof in `task6a-private-protected-cluster.integration.test.ts`.
Register focused/default discovery in `package.json`; create spec/plan.
Causal relation: protected initializer cannot rely on a descriptor/caller
transport without proving physical socket and immutable ancestry.

## Task 1: Physical evidence and fixed loader

**Interface:** Generic three-argument holder `{observe,recheck,close}`, fixed
zero-argument holder `{read,recheck,close}`; frozen observations carry dev/ino/
uid/gid/mode/birthtime strings and schema. All refusal errors fixed.

- [x] Write assertions for extra args, server==runtime/wrong UID/GID and ordinary
  unprivileged directory/fake socket refusal. `assert.throws(() => hold(...),
  /TASK6A_SOCKET_PHYSICAL_REFUSED/)`; fixed holder rejects caller override.
- [x] Add minimal permissive stub, observe tests' intended missing physical
  ownership behavior before implementation; never use ambient DB. Positive
  unprivileged socket is not enough to pass the server UID separation contract.
- [x] Implement strict runtime/data checks, actual0710 directory/0777 socket
  and sticky rechecks. Implement fixed root755 FD ancestry/descriptor hold
  composition, all-resource close and sticky uncertainty. Source strict TS.
- [x] Add actual private child hold/recheck/frozen metadata proof around
  connection facts and LISTEN; assert wrong peer identity/GID/missing port
  refused. Extend export-only test entry; keep root lifecycle unchanged.
  Additional bounded scoped child must refuse after exact root-admin0710→0700
  tightening and remain refused after original0710 restoration. End stdin,
  actual close-event confirmation, retain on uncertain child completion.
- [x] Read-only independent pre-execution review, then opt-in actual private
  fixture; prove stopped/removed exact roots and captured PIDs independently.
  Existing socket lifecycle loss test and parent forbidden-note0 stay intact.
- [x] Run new pure/default, transport4, lifecycle7, descriptor5/defaultskip,
  existing pure372, source/actual-test strict TS and all contracts/diff checks.
- [ ] Scoped commit/push/PR, independent exact SHA plus completed cloud/security/
  no-unresolved-thread gates, SHA-bound merge, preserve branches/worktrees,
  ordinary clean standby main build and actualBUILDINFO check.

## Current evidence

PR245 reviewed654e4cb0 mergedmain69fa6a130565dfc108ffee08ca0d3444477c6534;
standby normal build running at start of this plan. No source readiness claim.
Standby build subsequently completedexit0, actualBUILDINFO full69fa6a13/main/
dirtyfalse/version2.3.79 confirmed. New intendedRED1pass/4fail from missing
physical owner/argument/identity checks, GREEN5/5. Review caught intermediate
protectedread observe errors bypassing immediate all-FD cleanup; wrap entire
read in sticky invalid/close/protectedRefused path. Production wrapper positive
path deliberately unexecuted: fixed production namespace stays absent.
- Source/actualtest strict TS passed; focused5/7/4/descriptor5+default private
  skip, defaultprotected2policy+1skip and existingpure372/372 zero failures/skips
  (24.154s), English1862/path947/version/digests/12MC green.
- Pre-execution review caught restore failure could skip child shutdown. Separate
  lifecycle uncertainty burns before spawn and clears only actual CLOSE; mode
  uncertainty burns before chmod and clears only exact pinned0710 restoration
  plus server identity. Nested finally always attempts bounded child close,
  cleanup refuses any unknown flag. Reviewer cleared isolated execution.
- First actual RED2policy pass/1private fail: driving UID cannot lstat the
  socket through0710, correctly excluded. Exact nEvn3W/postmaster85728 stopped,
  removed and independently absent. No permission widening: parent now uses
  exactHome-guarded system root stat metadata, never root Node. Strict seven
  numeric fields, octal mode, exact six field comparison and birthtime seconds
  comparison in the child; actual holder still pins full birthtimeNs. Source
  and test strict TS/diff green; independent delta review cleared rerun.
- Actual GREEN3/3, zero skips/failures, exit0 (4.988s): exact
  `/private/tmp/setfarm-task6a-protected-pg.iDTTDy`, postmasters86892/87114
  stopped/removed and independently absent. Physical metadata matched parent
  system stat; valid scoped identity held/rechecked actual directory/socket;
  thirdUID owner mismatch and missing socket refused. Actual same-backend
  LISTEN, queued-loss fence and forbidden-note0 remained valid. Both held
  permission-tightening/restoration sticky-refusal tests and actual child-close
  proof completed, repeated before/after restart. No live namespace/DB effects.
  Final source TS, English1862/path947 and diff passed. Fixed production
  wrapper positive path remains deliberately unexecuted, no readiness claim.
Next protected startup also requires unchanged authentic V1 receipt semantics
or a fully reviewed immutable V2 promoted closure, never phase/hash-only SQL.
