# Private PostgreSQL Test Cluster Implementation Plan

> **For agentic workers:** Root executes inline with TDD. Existing agents perform
> independent read-only investigation/review only; no implementation/delivery delegation.

**Goal:** Supply a genuine owned ordinary private cluster for the unchanged
findings and full npm verification graphs without touching live PostgreSQL.

**Architecture:** Inert MJS fixed-command planner, streaming secret redactor and
owned-child lifecycle witnesses wrap fresh ordinary PostgreSQL17 initialization,
identity preflight, normal test dispatch and definite fast shutdown.

**Tech Stack:** Node26 ESM, installed PG17, existing postgres driver/npm tests.

**Spec:** docs/superpowers/specs/2026-10-01-private-postgres-test-cluster-v1-design.md

## Global constraints and File Map

Sole writer existing linked task6a-protected-origin-bootstrap-v2 tree,
branchfix/private-postgres-test-cluster-v1, base0185aaee631341d057c79e855e5ab9b51e9d402a
(PR256). Exactly six spec-mapped paths. No src/migration/P3 scope/finding preflight
change. Preserve all prior dirty/failed fixtures/DBs/branches/trees/archives;
no reset/revert/maincommit/forcepush/existing/live/global role or credential
changes/sudo/guard bypass/secret logging. Fresh isolated bootstrap role/credential
is expressly covered by scoped authorization, not a live policy change.
Explicit isolated credential authority does not prove protected admission.
No standby modification while execution14018 runs. Every new cluster footprint
is retained0700, never deleted. No native/privileged/genuine-host-fixture overlap.

## Task1: Fixed commands, output privacy and owned closure

- [x] Create scripts/__tests__/private-postgres-test-cluster.test.js with missing
  wrapper import assertion. Run node --test on this exact file and observe RED
  for missing implementation, not syntax/tool error. Each expectation is literal.
- [x] Specify actual normal planner vectors:
  ```js
  const root='/tmp/setfarm-task6a-pg.Abc123';
  const plan=planPrivatePostgresTestsV1({root,port:55439,mode:'findings'});
  assert.deepEqual(plan.test,['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
    'run','test:findings']);
  assert.deepEqual(planPrivatePostgresTestsV1({root,port:55439,mode:'all'}).test,
    ['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js','test']);
  ```
  Invalid roots including retained/system/relative/symlink-shaped names, port5432/
  zero/noninteger/65536, unknown modes refuse. Exact argv must keep SCRAM, normal
  sync, loopback and private sockets with no pg_ctl/trust/fsync-off fallback.
- [x] Test real incremental output redactor with secret literal split at every
  byte boundary, full URL plus password, no-secret normal text, binary Buffers,
  flush once and all truncated suffix prefixes; forced termination cannot flush
  credential prefixes raw. Expected '[REDACTED]' derived without redactor helpers.
- [x] Test owned lifecycle consumer using EventEmitter ChildProcess boundary:
  normal SIGINT then exit0+close0 true; exit0 alone false; nonzero/signal/error/
  timeout/killfalse false; already definitely closed does not signal. Assert
  actual returned closure verdict and exact signals at this external boundary.
- [x] Implement smallest inert exports with immutable vectors, bounded retained
  redactor suffix and event-bound close witnesses. No production state effects
  from imports/default unit tests. Run focused suite GREEN and coherent command/
  close/redaction mutants in memory; no source-byte-only success assertions.
- [x] Commit only mapped tests/module before live projection or source checks.

## Task2: Real ordinary constructor and unchanged graph dispatch

- [x] Implement CLI's strictfindings/all parse before effects and preconditions:
  macOS/UIDeUID501/GIDeGID20, Node26+, free disk>=4GiB, clean source,
  fixed tools version17 and regular npm-cli. Refuse original ambient PG* keys
  before effects; the in-process driver reads those settings. Child environment
  is an explicit ordinary whitelist, no loader/PG/Task6A/provider secrets.
- [x] mkdtemp literal /tmp/setfarm-task6a-pg.; chmod0700 and lstat/fstat pins;
  reserve127.0.0.1 ephemeralport, close reservation before spawn (no retry).
  Exclusive O_CREAT|O_EXCL|O_NOFOLLOW0600 passwordfile and random32-byte hex.
  No recursive cleanup/delete or credential text in output/errors.
- [x] Invoke initdb with fixed plan/SCRAM/UTF8/C/no-clean/normal sync and60s
  bound; route its output to private owned files or secret-redacted streams.
  Spawn actual foreground server with immediate owned witness. Identity SQL:
  ```sql
  SELECT current_setting('data_directory') AS data_directory,
    current_setting('port') AS port,
    current_setting('unix_socket_directories') AS socket_directories,
    current_setting('listen_addresses') AS listen_addresses,
    current_setting('password_encryption') AS password_encryption,
    current_setting('unix_socket_permissions') AS socket_permissions;
  ```
  Existing verifyFindingPrivateClusterIdentityV1 plus exact127.0.0.1/SCRAM must
  pass within absolute30s including awaited SQL, not just connect_timeout;
  whole quiescence separately bounded10s. Exact socket parent/0700 too, no trust/
  mismatch fallback. Initdb uncertain close/timeout forbids server startup.
- [x] Spawn process.execPath with exact planner npm-cli args, private adminURL+
  data directory, ambient PGurl/PG*/loaders/privileged Task6A flags removed.
  Incrementally redact both output streams, keep all test diagnostics/counts.
  Require agreeing exit+close integercode/no signal/error, then exactprivate
  pg_database baseline three and two no-other-external/unknown-backend observations100ms
  apart. Only after this DB cleanup/quiescence gate, SQL end and captured
  serverSIGINT/30sclose. No all-nonDB-descendant or continuousfence inference.
  Nonzero preserved. Uncertain test/server closure/retainedDB/backend retains
  directory/refuses; constructor failure before tests may settle onlyownserver;
  unref only owned handles, no foreign kill or fabricated cleanup witness.
- [x] Add package entries:
  ```json
  "test:findings:private":"node scripts/run-private-postgres-tests.mjs findings",
  "test:private-postgres":"node scripts/run-private-postgres-tests.mjs all"
  ```
  Existing npm test/test:findings graphs unchanged. Extend package coverage with
  actual test-local child boundary interception that proves selected fixed npm
  command, unknown mode refuses before PG; no actual PG started by unit tests.
- [ ] Run focused unit/package/evals/noemit/contracts/check-onlydigests/diff and
  credential scan; commit clean source. Request independent exact source/owned
  lifecycle/privacy/pre-effect review. Fix important findings through RED/GREEN.
- [ ] Only after exact review: one genuine findings-only cluster invocation;
  capture actual identity/result/full suite summaries/owned PostgreSQL exit0+
  close/retained directory. Test failure is new evidence, not grounds to waive
  private-preflight/owner/production guards. Recheck disk and livePG/HTTP.

## Task3: Delivery and full proof

- [ ] Independent full exact committed six-file review and scoped push/PR;
  available exact-head cloud/security/full paginated findings audit and normal
  SHA-bound merge. Preserve source branches/trees, no admin bypass.
- [ ] Wait standby14018 definite closure before ff-only clean-main build and
  merged findings wrapper verification. A raw-stage summary is not whole closure.
- [ ] Run whole fresh npm graph on the same reviewed ordinary wrapper only
  after findings actually passes, serially relative to genuine host fixtures.
  Classify any real failures and apply smallest root fix on one writer branch.
- [ ] Record exact complete outputs/exit/retained private root/server close/live
  PG31/HTTP; no whole npm green or Task6A success until actual respective proof.

## Pre-effect verification ledger (2026-09-30 23:03 UTC)

Docs-first9757cb59; clean implementation7d3b166a3550e812ee826a09a84241afab6292d8.
Six mapped paths only, no production src/migration/P3/preflight change.

- Fresh unchanged defaultfinding command RED before DB: exact
  FINDING_OWNER_TEST_PRIVATE_CLUSTER_UNVERIFIED. Missing module20 assertionREDs;
  main missing mode refusal3 actualREDs; missing package edges2 actualREDs;
  private cleanup and cancellation each1 missing-export assertionRED.
- Independent design review found end-flush credential-prefix leak: actual
  consumer1RED, then minimal suffix suppression and every-prefix/every-split
  checks GREEN. Closure design clarified directchild versus descendant scope,
  exact501/20, external/unknown backend classification and exact0700 sockets.
- Fresh complete focused26PASS/0FAIL/0SKIP332.18425ms. Actual package suite4PASS,
  including both npm edges intercepted at wrapper entry BEFORE imports/effects.
- Full evals53PASS/0FAIL/0SKIP18453.04625ms; all three exact testDBs definitely
  owner-dropped. Noemit/version2.3.79/English1907/paths961/check-onlydigests/MC12/
  diff0, credential-pattern scan0. Wrapper source not genuinely invoked.
- Coherent public-listener and truncated-secret mutants fail actual literal
  command/output consumers; coherent exit-without-close mutant fails actual
  lifecycle consumer, originals pass. Initial throwaway harness failed import
  resolution/anchor counting; those are not mutation evidence. No disk mutation.
- All ordinary PG constructor/server/test children remain NOTstarted. Exact
  independent full source/privacy/lifecycle pre-effect review requested at7d3b.
  Real findings/fullnpm and delivery/build checks remain unchecked, not implied.
- Standby14018 continues immutablecleanmain4cdb88dd: raw1104PASS56opt-inSKIP,
  P3claimpublication46PASS0FAIL1472028ms, its exactDBs owner-dropped; subsequent
  P3files in flight. Full execution/npm not claimed. Disk14GiB/freepages~179k;
  no resource health boundary observed, no unrelated OS process intervention.

Remedy follow-up23:09UTC: exact full source review found connected SQL could
outlive a loop-only30s check and the in-process driver still reads ambientPG*.
Root added never-settling query consumer RED1→absolute awaited-result deadline;
readiness30s and quiescence/port10s include complete async waits. BackendNULL
is unknown/denied. Actual CLI ambientPGsetting consumer RED1→pre-subprocess
refusal with fixed reason enum/no value exposure. Focused28PASS232.464166ms,
package4PASS1137.513792ms; both commands definitively exit0, no cluster effects.
Driver.end fulfillment is API settlement, not backend/socket-absence authority;
only captured ordinary server close is claimed. New exact remedy review pending.

## Durable journal refinement plan (2026-10-01)

**Goal:** Preserve bounded redacted observations across terminal loss, without
claiming survival/recovery/authority or changing owned lifecycle gates.
**Architecture:** One inert builtin-only journal module, strict incremental
reader and best-effort mirror; constructor owns ordering, captured children and
SQL. Root executes inline; existing agents only source-review.
**Spec:** Durable diagnostic journal section of the existing linked spec.

### Global constraints and exact File Map

Root sole writer now at .worktrees/setfarm-task6a-private-test-journal-v1,
branchfix/private-postgres-test-journal-v1. Base immutable2b6b3031, normally merged
deliveredmain95c557d5 via65e1dc87; no history rewrite. Old private tree remains
clean2b6b3031 and orphan59089/old footprint untouched. Interrupted findings and
standby execution results are UNVERIFIED; consumed one-invocation clearance
cannot be reused. Delivered physical PR257 independently reviewed; new separate
clean-main clone at95c557d5 built and bootstrap382/0/0 passed49454.189ms.
No live selector, old standby update, native/root/privileged/role/grant effects.

Modify existing wrapper, its existing test and existing spec/plan. Create
scripts/private-postgres-test-journal-v1.mjs and
scripts/__tests__/private-postgres-test-journal.test.js. Six refinement paths;
cumulative PR includes v1 package.json/tests/evals/package-scripts.test.ts for
eight total, unchanged by journal work. No production test knobs/dependencies.

Fixed bounds: frame128KiB, output payload64KiB, encoded output256MiB plus
reserved control1MiB, total257MiB, output checkpoint256KiB, frames1000000.
Only fresh internally selected fixed journal; ordinaryUID501/root0700/journal
0600/nlink1/exclusive/nofollow, held root and file identity checks. No raw secret
or error/ENV serialization, no repair/reopen/adoption/detach/signal fallback.

### Task4: Actual durable framing and strict prefix consumers

- [x] Preserve old trees; create new isolated branch and normal merge. Existing
  dependencies reused only through ignored symlink; no install. Baseline
  `node --test scripts/__tests__/private-postgres-test-cluster.test.js`
  actual28PASS0FAIL0SKIP233.287ms. Package baseline also selected unchanged edges.
  Actual complete package4PASS0FAIL0SKIP1403.487ms, definiteexit0.
- [x] Commit canonical refined design/plan before implementation. Request exact
  independent source-only design review; resolve contradictions explicitly.
- [x] Write actual-file missing-module AssertionRED. Test-owned mkdtemp under
  the fixed prefix,0700 and held directoryFD; retain files. No PG/root effect:
  ```js
  assert.ok(existsSync(MODULE),'private test journal implementation missing');
  const {createPrivateTestJournalV1,createPrivateTestJournalReaderV1}=await import(MODULE.href);
  const root=mkdtempSync('/tmp/setfarm-task6a-pg.');chmodSync(root,0o700);
  const rootFd=openSync(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
  const journal=createPrivateTestJournalV1(root,rootFd);
  assert.equal(journal.control('journal-opened',{root}),true);
  assert.equal(journal.control('initdb'),true);
  assert.equal(journal.output('initdb','stdout',Buffer.from([0,255,10])),true);
  const reader=createPrivateTestJournalReaderV1();
  const records=reader.write(readFileSync(root+'/transcript.journal'));
  assert.deepEqual(records.find(r=>r.kind==='output').payload,Buffer.from([0,255,10]));
  assert.equal(reader.end().incomplete,true); // No terminal observation.
  ```
  Derive wire/digest expectations independently with literal JSON and node:crypto,
  not the journal's encoder. Test exclusive existing file/symlink refusal before
  any write; exactfile0600/nlink1; root/file drift burns. No cleanup of old data.
- [x] Add every-byte split/truncated-terminal/after-terminal consumers, coherent
  bad sequence/length/digest/base64/key/size/unknown kind/channel, contradictory
  actual result flags, zero-output prefix and nonzero test result. No whole
  transcript accumulation: reader chunks at most128KiB; scaled IN-MEMORY limit
  mutants exercise branch consumers without allocating257MiB and are labelled
  scaled, not actual full-cap proof.
  Positive literal prefix supplies the exact causal intent/observation sequence
  from the spec, all initdb/test/server exit/close0 controls, all six role/channel
  stream ends, quiescence-sample0/1 passedtrue and admin-ended
  before finish({outcome:'observed',testCode:0,privateDbQuiescent:true,
  adminEnded:true,serverClosed:true,productionAuthority:false}). Nonzero test
  prefix/terminal use7 and must report7; omitted exit/close/EOF/sample/admin
  controls and reordered sample/admin/server events refuse the same real
  finish/reader consumer. Duplicates, disagreeing PID/code, output after EOF and
  early server exit remain known diagnostics but cannot revive eligibility.
  Exact fields/enums and
  framing keys are fixed in spec, not configurable test limits.
- [x] Add actual fs boundary fault subprocess tests. Wrap builtin write/fsync/
  close IN MEMORY before import, preserve actual owned files and complete
  observable writes where claimed. Short write/EINTR uncertainty retains the
  torn tail and reader reports incomplete. Fsync/close failure makes writer
  healthy/close false, prevents future positive terminal and cannot revive.
  Complete bytes (including an earlier terminal) may still be readable after
  failed fsync or subsequent close: reader cannot infer an undelivered fault or
  prove future writer FD/process closure. Assert that distinction, not a
  fictional partial tail. Check immediate journal FD ownership/once-only close
  on partial construction and identity drift; borrowed directory FD remains
  usable, and ambiguous close is never retried.
- [x] Implement minimal inert framing/file writer/reader/mirror only after RED.
  No subprocess,SQL or password access from module. Full-write requirement,
  fixed caps, private FD identity, separate I/O and completeness burn, fsync
  checkpoints, per-call bounded reader record results. Run every earlier RED
  GREEN; coherent missing digest/terminal/size/sticky-state mutants must reach
  forbidden consumer results, not merely pass source-text assertions.
- [x] Real Writable/EventEmitter mirror tests: sync throw, async EPIPE/close,
  first backpressure disables mirroring exactly once; journal persists first,
  no child signal/cancellation callback and no unbounded display queue.

### Task4 evidence ledger (2026-10-01, ordinary unit effects only)

Docs-first00d29854 refined to1d815114. Independent source-only design review
cleared causal order, owned/borrowed FD distinction and complete bytes versus
fsync/future-close after the explicit completeness-burn/FD clarification.
No implementation/invocation authority inferred from that design review.

Actual missing-module AssertionRED31/0PASS52.501ms; minimal implementation
then31PASS433.170ms after correcting the real Writable fixture: synchronous
draining does not create backpressure, deferred completion does. New reserved
stage/authority override and getter consumers produced four semantic REDs.
Independent review found coercible stage/signal and checkpoint overrun; actual
three coercion REDs and encoded unsynced326104bytes versus262144 bound were
reproduced. Strict literal fields/snapshot/catches and PRE-frame fsync fixed them.
Filesystem fault harness first required two test-only fixes: post-close FD reuse
by readFileSync is not a second journal-owned close, and restoring all builtin
fs properties fails on a getter-only property. Restore only wrapped functions
before diagnostic read; these harness errors are NOT production defect proofs.
Seven actual FS consumers now cover constructor fstat/fsync, creation mode drift,
short write/EINTR, completed-frame fsync and post-terminal ambiguous close.
Creation mode drift had its own semanticRED1 before full final identity recheck.

Combined journal45 plus unchanged cluster28:73PASS0FAIL0SKIP853.757ms.
Expanded journal51 plus cluster28:79PASS0FAIL0SKIP943.518ms. Latest journal-only
54PASS0FAIL0SKIP968.909ms, definiteexit0, complete test output read. Actual files
and roots retained, borrowed directory FDs usable, no PostgreSQL constructor,
password, SQL, subprocess server or live/native effect. Child-boundary fault
subprocesses are ordinary Node-only and tests own only their new journal files.
Scaled IN-MEMORY cap consumers and coherent output-cap bypass are explicitly
NOT an actual257MiB proof. Final Task4 source-only review found no Critical or
Important issue at moduleSHA
7efd83d45636d0f3970aff81637e3832ec73907acf7ef9dcbef509dee24f32df and testSHA
0445e4001f313a9a841041fd0c96824896bed47c0f524804deffe957d5100d88.
That54-test candidate's one Minor gap (every terminal-prefix truncation) was
subsequently closed, source unchanged, new testSHA
73cbb502c386adff99936a35a93206aa0d032ee1b24ee5656c88f94b502a6329.
Fresh combined54journal+28cluster82PASS0FAIL0SKIP1005.479ms, definiteexit0,
complete output read. Noemit0; version2.3.79, English1909/path963, check-only
migration digests and Mission Control12 contracts each definiteexit0. Final
Minor-delta read-only check confirmed exactly the five-line addition, no remaining
finding; source-only Task4 commit readiness cleared. Task5 wiring and Task6 invocation remain
unimplemented/unverified.

### Task5: Wire observed constructor lifecycle without relaxing ownership

**Interfaces:** Existing wrapper exports inert
attachPrivateTestChildJournalV1(child,role,secrets,journal,mirrors), event/stream
binding only. Actual unknown child PID is null and ineligible, never fabricated.
No extra files beyond mapped eight cumulative paths. Module schema normal PID
requirement retains nullable failure diagnostics only. Pre-dispatch health
gates forbid password/new children, not already-owned draining or observation.

**First RED consumers:** Actual wrapper entry receives in-memory fsync failure
only on its exclusive new journal FD; forbidden password-open/spawn sentinel
must remain absent. Stub only external version/Git commands, remove test loader
environment before host guard, retain actual filesystem/ordinary UID checks.
No actual PG/version subprocess or password creation. Separate binding consumer
starts an actual new journal and event/Readable child boundary; every actual
password/URL split traverses real redactor→writer→reader before mirror. EPIPE/
backpressure/throw affect only display; no callback kill/cancel. Null PID failed
spawn observations are retained, no invented exit/EOF; coherent terminal cannot
turn them positive. These tests do not authorize genuine dirty-source execution.
Full wrapper-entry unit fixtures additionally replace only external process/SQL
boundaries IN MEMORY: fixed ChildProcess event/PassThrough streams (not real PG),
an inert postgres tagged-query driver, and virtual password file IO/metadata
(no password file/credential created). Real new root/journal IO and guards stay.
Strict fake fixed-tool dispatch refuses every unexpected subprocess; source/Git
version boundary literals are unit inputs, never clean-source/origin proof.
Assert control order/actual callback arguments before fake captured SIGINT;
normal0/nonzero7, displayEPIPE, journal loss and final journal-close fault use
real wrapper consumers. Such unit runs are NOT finding graph or host invocation
clearance, and their fabricated child PIDs/results are never production evidence.
Early source review found a causal partial-ownership gap: binding can throw
after spawn but before the caller receives its owned record. Fix only existing
wrapper/test: assign captured ChildProcess record in main before witness/binding
setup, keep unavailable witness/stream unknown, and route that original record
through unchanged stop/retain gates. Server/test attach-fault consumers must
fail before fix; missing stream records error, never synthetic EOF. No PID
search/adoption/new signal permission. This is not the lost invocation's cause.

- [x] Extend existing actual wrapper-entry test harness with forbidden subprocess
  sentinel: journal creation/fsync failure refuses before password/child effects.
  Keep imports inert and CLI/default/ambientPG guards unchanged. The harness
  replaces only actual slow effects, not precondition/cleanup/ownership checks.
- [x] Capture actual child exit/close into durable controls immediately; raw
  child results/stream error are observed, not fabricated caller receipts. Test
  exit-only/nonzero/signal/unknown close and cancellation on real lifecycle
  consumers. Existing observe/settle/quiescence/deadline functions remain gates.
- [x] Wire output redaction BEFORE persistence BEFORE terminal mirroring. Every
  real per-stream split/full URL/password/truncated-prefix/binary consumer passes
  through persistence and strict reader; no assertion on a redactor mock.
  Input/journal failure burns completeness yet drains already-owned children;
  do not throw out of stream callbacks or infer descendants from directclose.
- [x] Journal each quiescence sample and actual admin-end API settlement; only
  existing complete test-close/private-catalog/backend gate may grant own
  shutdown. Final observed terminal after known server close; test nonzero
  preserved, journal close uncertainty prevents wrapper success. Reader never
  equates terminal observations with the writer's future process exit.
- [x] Fresh journal+cluster+package/default-discovery tests, full evals/noemit/
  contracts/check-only digests/MC/diff/credential scan. Commit scoped clean source;
  independent exact eight-path source/test/spec/plan review before any invocation.

### Task5 evidence ledger (2026-10-01 01:29 UTC)

Docs-first44d6ee42 precedes binding changes. Journal construction/opened fsync
faults each produced actual semantic RED before the password/spawn sentinel;
binding export and nullable-PID consumers also failed before implementation.
The first entry harness had a loader newline SyntaxError: corrected before
semantic RED claims, not treated as a production defect. The seven-mode entry
matrix produced seven semantic failures before minimal wiring. Journal-loss
coverage was strengthened to fault during test observations BEFORE quiescence,
not at final close. Additional before-server/before-test faults prevent new
dispatch. A test-only missing-root trace required wrapping actual mkdtemp;
that harness correction is not production defect evidence.

Independent review found partial capture could be lost if binding threw after
spawn. Recorded the causal refinement before code. Three semantic REDs for
server attachment, test attachment and missing stream (245.676ms) became three
GREEN (270.736ms) after main assigned captured records before fallible witness/
binding. Missing witness cannot signal; missing stream records error, not EOF.
No PID search/adoption/new signal permission or incident-cause inference.

Full entry fixtures cover normal0, nonzero7, display EPIPE, journal loss,
post-terminal close fault, retained DB, cancellation, before-server/before-test,
server/test attachment faults and stream input error. All are Node-only external
process/SQL/virtual-password boundary replacements, not a real private cluster,
credential file or findings graph. Actual new ordinary journal roots retained.
Credential/full-URL/binary and partial-prefix consumers persist actual redactor
output before mirrors; no fabricated EOF on error/close.

Fresh complete focused journal55+cluster47:102PASS0FAIL0SKIP2814.651667ms,
definiteexit0 and all output read. Full evals53PASS0FAIL0SKIP16030.52625ms,
definiteexit0; its own three ordinary DBs definitely owner-dropped:
setfarm_contract_spine_test_5480_8773bff23bbb,
setfarm_contract_spine_test_5481_b7f9bfc82024,
setfarm_contract_spine_test_5481_7d9b0974023a. No manual DB cleanup.
Noemit0, version2.3.79, English1909, paths963, check-only migration digests/MC12
and diff0; four code/test files credential-pattern scan has zero matches.
Exact cumulative eight-path source-only review found no Critical/Important;
minor reservation-gap description corrected to match actual release before
password/initdb. Reviewer did not run tests/effects or grant invocation clearance.
Broader script/default-discovery verification, clean source commit, exact
committed-head/pre-effect review and genuine graph outcomes remain unverified.

Fresh live read-only PG audit01:29:23UTC: database setfarm/user setrox/port5432,
data_directory /opt/homebrew/var/postgresql@17; schema31/adopted1+applied30,
openclaims0, active attempts0 (inconclusive7/produced_delta2), unreleasedsessions0.
HTTP3080/api/projects and18789/root200 at01:28. Ordinary tests do not prove
protected admission/native closure/live handoff; Task6A remains unfinished.

Fresh preparation01:41–01:47UTC: actual noemit0 and all above contracts0 rerun;
remote main remains95c557d5 and open PRs0. Broad managed39840 still running
serially, so no commit/invocation clearance claimed. Its actual runner uses
Node26.4.0; login-shell default Node22 is NOT sufficient for the constructor.
Future fixed command uses /opt/homebrew/Cellar/node/26.4.0/bin/node directly,
without changing global PATH/loader/guards. PG tools both17.10. Dependency
symlink still targets the retained old private tree's existing node_modules;
both package-lock SHA256s equal
a7619de7cab700d96ce2c8073f842f9f02f480ff704d0ac689914f0f3e9267fc.
Actual TypeScript5.9.3/tsx4.22.4/postgres3.4.8 versions match that lock.
No install/repoint or full protected dependency-closure claim. One initial
version read tried an unexported package.json subpath; corrected to read that
ordinary local metadata file, not counted as a source defect or test failure.
An additional broad credential expression matches four static URL constructors
(concatenated variables/synthetic test secret), not persisted real credentials;
the earlier exact-pattern zero-match result is separate, not a universal scan.

Broad verification completed01:55UTC: exact full npm run test:scripts,
managed39840 definitiveexit0 and ALL output read without truncation.
Unit1644PASS0FAIL0SKIP1181898.7595ms plus serial genuine-integration
43PASS0FAIL0SKIP110301.662875ms; all five fixed integration files reached.
This is the whole scripts graph, NOT the complete npm/finding graph or protected
host admission. No source/test change since the four frozen reviewed hashes.
Root will commit the six refinement files, then obtain exact committed eight-
path review and fresh host/resource pre-effect audit before any NEW invocation.

### Task6: New actual ordinary verification and delivery

- [x] Obtain exact reviewed pre-effect clearance for ONE fresh ordinary findings
  invocation at clean committed source. Current plan does NOT invoke anything,
  adopt old PID, read old private password/SQL or signal/clean old fixtures.
- [x] Observe freshidentity, unchanged complete finding graph, exit AND close,
  both actual catalog/backend samples, driver-end API, captured server normal
  shutdown/close; inspect entire redacted journal and managed result. A daemon
  loss with missing final result stays incomplete; no test restart/adoption.
- [ ] After actual findings success and reviewed docs refinement, deliver the
  scoped source PR with fullnpm explicitly UNVERIFIED. Preserve normal exact-head
  source/cloud/security/full-paginated-comments gates and normal SHA-bound merge.
  Never claim the source delivery itself proves complete npm or Task6A.
- [ ] Create a NEW separate clean-main tree at the delivered reviewed merge;
  verify HEAD equals origin/main, branch main and clean source. Run guarded
  npm run build normally, no copied dist/bare compilation/branch disguise.
  Preserve every old tree/standby and uncertain build. Freeze exact merged
  source/build/dependencies; obtain independent exact all-mode pre-effect review.
- [ ] Only actual complete findings success and the reviewed genuine merged
  build permit ONE fresh all-mode invocation at that exact clean source;
  all thirteen unchanged top-level stages and actual closure required, never
  combine partial runs. Count derives from package.json's actual && graph,
  including its initial tests/*.test.ts stage, not a historical fourteen estimate.
  Disk/memory/livePG31/zero-owner/HTTP checks before and after; stop at resource
  safety/new-authority boundary, not at a stale historical blocked flag.
- [ ] Record complete merged full graph/journal/outer result and post-run host
  checks. No full npm/Task6A claim until respective outcomes proven. Protected
  bootstrap/native/compiler/fence/genesis/32/33/live handoff remain separate.

### Task6 actual findings and causal build prerequisite (2026-10-01 02:56 UTC)

Independent exact eight-path pre-effect review at clean
1cbef5c65ddfd10e245771d421649cf289e1f0cc returned Critical0/Important0/Minor0
for ONE ordinary findings invocation. Root rechecked resources and fresh live
READ ONLY schema31/zero-owner state; clearance consumed by managed53743 at
01:58:45UTC. Source/HEAD/dependencies stayed frozen throughout, four reviewed
code/test hashes unchanged. No old PID/password/SQL/adoption/signal/cleanup.

Exact fixed Node26 invocation completed with observed outer exit0 at02:56UTC.
New retained root /tmp/setfarm-task6a-pg.cbNKyN, port53615; actual initdb20095,
test20114 and captured foreground server20105 each emitted agreeing exit0 AND
close0, signalnull, both actual stream EOFs. Two private catalog/backend samples
passed in order0/1; own admin-end API settled before captured-server shutdown.
Actual server fast shutdown and definite close0 observed; whole footprint retained.
This is direct owned-child/private DB quiescence proof, not every non-DB descendant
absence, continuous writer exclusion or protected origin/admission.

All18 unchanged finding files reached through13 genuine group summaries:
pass counts41/7/1/5/16/17/9/6/9/10/10/9/8, each fail0/cancelled0/todo0.
Total148PASS, not an anticipated149: final work-router actually contains8.
Three authenticated lifecycle shards0/3,1/3,2/3 passed10/10/9 with19/19/20
partitionSKIPs. Root independently compared actual reconstructed stdout against
all29 literal source test titles: each passed exactly once and skipped exactly
its two other partitions. Total58partitionSKIPs, no missing lifecycle coverage.
Complete group durations_ms1133.3905/38812.373/2324.985708/8272.508167/
65283.837708/132100.801042/413996.446541/65400.674708/412804.636667/
799020.217417/554985.970292/470642.883708/45042.614667.

Root consumed ALL managed output without truncation and audited the whole
stable journal in bounded65536-byte reads through the production strict reader:
207281bytes/520validatedrecords, SHA256
a7e5048b58a64d02f51ced08bd343ccd9fd81895782de11a7ee6551b5a6948e2.
Root0700/inode203867655 and journal0600/nlink1/inode203867656/UID501 stayed
unchanged across read. All causal controls, frame digests/order and complete
per-channel decoded lines validated; no refusal/child/input/mirror-unavailable
controls. Terminal observed testCode0/privateDbQuiescent/adminEnded/serverClosed
alltrue, productionAuthorityfalse; strict reader incompletefalse/reasonnull.
Future writer closure is NOT inferred from terminal: outer actual exit0 was
separately observed. No private password or SQL was read by the diagnostic audit.

Independent all-mode preparation found Important execution prerequisite:
feature tree lacks dist/cli/cli.js, required by tests/ant.test.ts:12,24 in the
first unchanged npm stage. scripts/write-build-info.mjs:925–929 requires clean
main equalorigin/main for a genuine guarded build. Root independently read those
consumers. Smallest causal refinement is the above delivery→NEW guarded build→
fresh exact merged-head review→all sequence, consistent with earlier Task3.
File Map remains the same eight paths; this follow-up modifies only this plan
and linked spec, no source/tests/default graph/guard change. Existing actual
CLI consumer and build guard supply the dependency evidence; no new behavior
requires a new test. No all-mode invocation clearance or whole npm result yet.

Fresh post-run live READ ONLY transaction: setfarm/setrox/5432, data_directory
/opt/homebrew/var/postgresql@17, schema31, openclaims0, activeattempts0
(inconclusive7/produced_delta2), unreleasedsessions0. Last pre-close HTTP sample
02:51:39UTC was3080projects/18789root200 and3333connectionrefused000. A separate
fresh POST-close HTTP check03:02:28UTC also returned3080projects/18789root200
(each curl exit0),3333connectionrefused000 (actual curl exit7). Fresh disk17GiB,
freepages162614/inactive252873/throttled0/swapout4192; no resource health boundary.
No selector/standby/role/grant/native/protected/runtime transition performed.
Source-only PR delivery readiness requires exact reviewed docs delta and normal
security/GitHub checks; fullnpm and Task6A/project completion remain UNVERIFIED.

Docs-only refinement verification03:02UTC: fresh full focused journal55+cluster47
102PASS0FAIL0SKIP3016.406042ms, dedicated actualexit0/all output read. Package
dispatch suite4PASS0FAIL0SKIP1185.33ms; separate dedicated noemit actualexit0.
Version2.3.79/English1909/path963/check-onlydigests/MC12 returned their success
outputs; diff0, frozen four code/test hashes still exact. Independent docs-delta
review Critical0/Important0 and one Minor timestamp ambiguity, corrected above
with a genuine post-close HTTP check. No new graph/invocation/protected authority.
