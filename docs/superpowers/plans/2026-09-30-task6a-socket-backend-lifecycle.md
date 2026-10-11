# Task6A Single Socket Backend Lifecycle Implementation Plan

> **For agentic workers:** Root implements inline with TDD and verification-before-completion; agents investigate/review read-only, no delivery. Explicit root-only authorization overrides implementation delegation; executing-plans unavailable.

**Goal:** Prevent hidden or replacement backend creation before protected runtime wiring.

**Architecture:** Import-inert single-attempt Unix socket factory with synchronous revocation and fixed persistent one-backend options. Actual reserved LISTEN/notification and connection-loss proof in the existing private peer fixture.

**Tech Stack:** Node >=22, TypeScript ESM, macOS, Postgres.js3.4.8, PostgreSQL17, node:test, existing esbuild.

**Spec:** `docs/superpowers/specs/2026-09-30-task6a-socket-backend-lifecycle-design.md`

## Global Constraints

- Root sole writer, one PR branch; preserve all worktrees/branches/changes.
- No live namespace, DB/schema, account, service, selector, archive or dependency mutation.
- Exact explicit Unix transport; one native socket attempt, no hidden replacement backend.
- Synchronous revoke/destroy before async close; retain effect uncertainty.
- Transport/lifecycle data is not descriptor/grant/readiness/owner/admission authority.
- Existing private fixture root lifecycle/cleanup remain unchanged; no root Node.

## File Map

Create `src/internal-production/task6a-single-backend-socket-client-v1.ts`,
`tests/internal-production/task6a-single-backend-socket-client-v1.test.ts`,
and `tests/execution-attempts/task6a-protected-cluster-client-entry.ts`
(test-only exports of unchanged source factories). Extend only client proof and
esbuild entry in `tests/execution-attempts/task6a-private-protected-cluster.integration.test.ts`;
no root fixture lifecycle/policy changes. Register focused normal discovery in
`package.json`. Create this plan/spec; causal scope is the captured-SQL/reconnect
gap found while reviewing the next protected initializer.

## Task 1: Single-attempt primitive and real peer lifecycle

**Interface:** `createTask6aSingleBackendSocketClientV1(transport: unknown,
onNotification?: (channel: string, payload: string) => void)` returns frozen
`{sql, revoke():void, close():Promise<void>, observe():Readonly<{nativeSocketCreations:number,revoked:boolean}>}`.

- [x] Write lazy options and preconnect-revoke/hidden-listen/wrong UID/environment
  tests. Example: `assert.equal(client.sql.options.max, 1)` and after revoke
  `await assert.rejects(captured.unsafe('SELECT 1'))`, `nativeSocketCreations===0`.
- [x] Watch intended failures against missing single-backend guards/options;
  do not connect to an ambient DB. Implement the internal one-attempt factory,
  native socket lifecycle, notification gate and frozen resolved options.
- [x] Run focused GREEN, strict TS source/actual tests. Add unchanged-source
  fixture entry and scoped real backend proof; obtain read-only review before
  privileged fixture execution.
- [x] Private child reserves the actual backend, checks exact role/session/db/
  null address and PID, executes `LISTEN task6a_single_backend_fixture`, sends
  pg_notify on that same reserved SQL and rechecks identical PID. Close then
  captured SQL denies; no driver listen() invocation for the successful path.
- [x] In another scoped client, terminate only its own backend with pending
  queued fixture writes. All promises settle rejected, native creation stays1,
  state revoked, and admin SELECT proves no forbidden note rows. Repeat before
  and after the exact private cluster restart; existing root cleanup unchanged.
- [ ] Run actual private fixture, default/focused tests, descriptor5/default
  skip, transport4, existing pure372, strict TS/contracts/diff. Independent
  exact-head review and cloud/security/no-open-thread gates precede SHA-bound
  merge. Preserve all branches; normal clean standby main build follows.

## Evidence

PR244 exact reviewed225ca45 merged mainf149f136; ordinary clean standby build
exit0, BUILD_INFO fullf149/main/dirtyfalse. Selected deployment untouched.
- Intended RED4 failures: max50 instead of1, revoke remained false, hidden LISTEN
  reached the private nonexistent socket (ENOENT instead of guard refusal),
  invalid callback accepted. No ambient DB connection. GREEN4/4, zero skips.
- Source strict TS passed; actual tests/helper/fixture strict TS passed after
  using Reflect.get for the driver runtime field absent from declarations.
  Default combined discovery6pass/1explicit private skip before two extra tests.
- Pre-execution review found permanent native error revocation and accidental
  async callback returns missing. Intended new RED4pass/2fail (unhandled native
  error, non-revoked async callback/unhandled rejection); permanent error hook,
  allocation refusal and strict sync callback/drained return corrected both.
  GREEN6/6. Independent reviewer cleared unchanged-root private fixture.
- First actual peer run failed its loss timeout (2policy pass/1private fail).
  Gate refused replacement native sockets but driver queue never fully settled.
  Exact UX8GhG fixture/postmaster69832 still stopped/removed and independently
  absent. This is meaningful backend lifecycle RED, not a missing-module failure.
  Revoke now fences/destroys synchronously THEN retains one end(timeout0) promise
  to drain pending driver work; no increased timeout or guard bypass.
- Actual GREEN3/3, zero skips/failures, exit0 (4.610s), exact private
  `/private/tmp/setfarm-task6a-protected-pg.3ecvfx`, postmasters70311/70493 stopped,
  exact tree removed, independently absent. Same reserved PID/peer role/session/
  DB/null address covered LISTEN/notify; self-backend loss rejected all four
  queued effects, native creation stayed1, old handles denied and parent actual
  SQL note count stayed0, repeated after restart. No live path/role/schema effect.
- Final pure6/6, existing descriptor5+explicit private skip and transport4/4;
  existing internal-production pure372/372 zero skips/failures, exit0 (23.987s).
  Source/actualtests strict TS, English1858/path946/version2.3.79/digests/12MC
  artifacts and diff checks passed. Independent final staged review no blockers.
  No full application-suite or live cutover claim. Exact-head PR/cloud/security
  and ordinary clean-main standby build remain delivery gates.
- PR245 exact385a536 cloud review found the pure fixture's hardcoded
  /private/tmp would fail before discovery on Linux. Intended regression
  RED6pass/1fail confirms the home ignores the platform temp directory.
  Use canonical os.tmpdir() and a short sf-sb. prefix to retain the 103-byte
  Unix socket bound on Darwin too. This changes only unprivileged test data,
  not the opt-in protected PG fixture or production transport paths.
  GREEN7/7 with the native Darwin temp directory and again with TMPDIR=/tmp;
  source and actual-test strict TS plus all five source contracts passed.
  This is path portability coverage, not an actual Linux-host execution claim.

## Native-close conjunction correction (2026-10-11)

Causal scope: the planned dashboard native ingress needs this existing owner to
retain real native close as well as driver end. Installed Postgres.js end() races
terminate(), whose reserved ended callback need not await socket.close. This
implements the existing spec's "Never trust async end() alone", not startup
admission or an unrelated feature. End-only is unsound; destroyed-state polling
does not prove native close. Chosen design joins both originals in this owner.

File Map: modify existing source and actual unit test above, plus this existing
plan and paired spec. No new public hook/provider, dependency, runtime artifact,
daemon/listener/bootstrap, live DB or account mutation. Root sole writer; agents
read/review only. Spec self-review: fixed responsibility, exact join and failure
ordering, no placeholders or conflicting admission claim.

- [x] Add a real native Unix-socket test that delays its actual destroy callback,
  calls the unchanged client.close(), observes it remains pending across native
  event-loop turns, then releases the original destroy and joins actual close.
  Assert same close promise, sticky refusal and exactly one native allocation.
- [x] Run actual test source against original owner; expected RED is early close
  fulfillment while native close is still pending, not a fixture/import error.
- [x] Enroll native close before revocation/driver listeners. Join it with the
  retained original driver end using allSettled, then propagate ending failure.
  Native-absent close remains valid only after the one-attempt fence is revoked.
- [x] Focused GREEN, relevant transport/default tests and strict source/test
  types; independent review. Existing real-PG fixture remains separate evidence;
  this unit fixture does not establish reserved backend death or global zero-owner.
- [ ] Record exact results, source/contracts/diff gates and qualified delivery
  on the same sole PR branch; no direct-main/dirty-build or live-start shortcut.

Correction evidence (2026-10-11): fresh retained actual receipts in
`logs/setfarm-native-close-verification-jI0KMd` outside the worktree. Bundled
unchanged-source focused/default discovery joined 0/null: native client9,
transport4 and descriptor5 passed; protected descriptor1 explicitly skipped.
This is not stock npm/full-suite or protected-PG execution credit. Actual original
owner RED joined1/null,7pass/1fail: native close remained pending but owner close
fulfilled. End-only mutant joined1/null,7pass/2fail; valid early-reject Promise.all
mutant joined1/null,8pass/1fail. Both fail the native-pending assertion.

The initial early-reject mutant retained the allSettled result decoder and caused
unrelated TypeErrors and a stuck test child. No causal mutation credit: root
identified and stopped only that exact task child; its parent joined1/null and
the failed evidence remains visible. The valid replacement changes the complete
conjunction expression and closes naturally. Cleanup now retains the actual
driver ending and destroys peers/closes the server even after assertions fail.

TypeScript5.9.3 strict noEmit:843 actual roots (all source plus four actual tests),
1192 transitive files,0 diagnostics. Read-only canonical dependency resolution;
not a stock build or provisioned candidate dependency image. An initial harness
attempt omitted the exact node_modules directory mapping and kept rootDir=src;
its failed raw is retained, not a source regression or successful verification.
Version2.3.79/English1996/path1002, migration digests, all12 Mission Control
contract artifacts and diff check passed. The latter two ordinary source scripts
ran in --check mode with a process-local declared-dependency resolve fallback;
no load/source rewriting, worktree symlink or dependency installation. Node's
documented registerHooks resolve chain is used only by this verification process.
Independent
four-path source review found C0/I0/M0; native/driver originals, sticky one-attempt
fence and failure ordering retained. Exact raw audit, remaining source contracts,
fresh protected backend integration and qualified PR delivery remain distinct
gates; no backend extinction, positive startup authority or live cutover claim.
Fresh final receipts also retain launcher code/signal, source/bundle/Node/harness
hashes and strict result in `logs/setfarm-native-close-verification-jUNJ6s/receipt.json`
(SHA8764600650b544becb0f21f4748efd2f7b9e01f13ec56522639bc1284bdfca2d).
Independent raw review confirms all expected counts and causal pending-close
failures; OS joins are recorded by the actual root launcher, not inferred from TAP.

Fresh protected-PG setup remains pending: absolute tsx+NODE_PATH alone cannot
resolve the eagerly imported TypeScript package. A process-local read-only
dependency resolver enabled default2policy/1explicit private skip, but the
fixture's nested unchanged esbuild API still cannot find postgres via NODE_PATH.
That read-only pre-effect bundle diagnostic failed, not the backend fixture;
no opted-in fixture/root ownership/server birth occurred. Do not patch/wrap
esbuild, widen permissions or count default skip as actual-PG proof. A fresh
owned exact-byte source verification capsule with ordinary local dependency
resolution may resolve this setup without mutating candidate/live dependencies;
nominate/review that finite capture before privileged fixture execution.

Protected backend follow-through: fresh owned verification capsule
`logs/setfarm-protected-pg-source-capsule-OlZyXC` retains14 exact-byte source/test/
package members147911B, independently matched to clean c3d76237. Its only
dependency symlink is inside that NEW capsule to the unchanged existing canonical
node_modules; candidate/live dependencies are untouched. This is a copied-source
verification image, NOT a commit archive, full dependency freeze or candidate build.
Normal tsx source discovery passed2policy/1explicit skip; unchanged nested esbuild
preflight compiled1 actual83954B client bundle, no source aliases/API wrapping.

Reviewed base-only opt-in then joined0/null5845ms,3PASS/0FAIL/0SKIP; native and
held-PG31 opt-ins absent. Owner `protected-dDj39T` retains actual launcher receipt,
raw676B SHAfc7b7c722eb1b4e5f23820dc587fbdaf228ab0af649888fce2f177014d34ec5a.
Private `/private/tmp/setfarm-task6a-protected-pg.WSGHck`, postmasters36021/36241,
reported stopped/removed. Genuine same reserved PID/session/role/database/null
address plus literal LISTEN/notification, own-backend loss/four queued effects
refused and admin zero forbidden rows passed before/after restart. Native creation
stayed1. All14 source/copy hashes rechecked; sampled free minimum9262968832B,
final9304199168B, no8GiB-floor breach. No backend_start, protected native image,
historical family, controller admission, full suite/build or live activation credit.
Exact cleanup absence/receipt audit and remaining qualified delivery gates stay
separate from the successful finite backend test.

Independent post-close audit confirms the entire raw/receipt and all14 members;
exact WSGHck path is absent and ps36021/36241 returns no rows. Reserved backend
PID equality was asserted in the genuine child but its numerical value was not
emitted/retained; raw retains only the postmaster IDs. Never promote this to a
retained backend-start identity witness. Capture hardening advisory: launcher
writeSync return/fsync are not checked; actual received676B equals complete raw676B,
so no observed loss in this receipt. Retain v1 unchanged; future capture owners
must join complete writes/durability without retroactively changing its pin.
Source correction c3d762379dcd093bf8600d46f15d3012423c9f22 pushed to the existing
sole PR280 branch; current GitGuardian succeeded. PR remains draft with no
qualified exact-head cloud review or live cutover/clean-main delivery claim.
