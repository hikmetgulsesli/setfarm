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
- [ ] Commit canonical refined design/plan before implementation. Request exact
  independent source-only design review; resolve contradictions explicitly.
- [ ] Write actual-file missing-module AssertionRED. Test-owned mkdtemp under
  the fixed prefix,0700 and held directoryFD; retain files. No PG/root effect:
  ```js
  assert.ok(existsSync(MODULE),'private test journal implementation missing');
  const {createPrivateTestJournalV1,createPrivateTestJournalReaderV1}=await import(MODULE.href);
  const root=mkdtempSync('/tmp/setfarm-task6a-pg.');chmodSync(root,0o700);
  const rootFd=openSync(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
  const journal=createPrivateTestJournalV1(root,rootFd);
  assert.equal(journal.control('journal-opened',{root}),true);
  assert.equal(journal.output('test','stdout',Buffer.from([0,255,10])),true);
  const reader=createPrivateTestJournalReaderV1();
  const records=reader.write(readFileSync(root+'/transcript.journal'));
  assert.deepEqual(records.find(r=>r.kind==='output').payload,Buffer.from([0,255,10]));
  assert.equal(reader.end().incomplete,true); // No terminal observation.
  ```
  Derive wire/digest expectations independently with literal JSON and node:crypto,
  not the journal's encoder. Test exclusive existing file/symlink refusal before
  any write; exactfile0600/nlink1; root/file drift burns. No cleanup of old data.
- [ ] Add every-byte split/truncated-terminal/after-terminal consumers, coherent
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
- [ ] Add actual fs boundary fault subprocess tests. Wrap builtin write/fsync/
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
- [ ] Implement minimal inert framing/file writer/reader/mirror only after RED.
  No subprocess,SQL or password access from module. Full-write requirement,
  fixed caps, private FD identity, separate I/O and completeness burn, fsync
  checkpoints, per-call bounded reader record results. Run every earlier RED
  GREEN; coherent missing digest/terminal/size/sticky-state mutants must reach
  forbidden consumer results, not merely pass source-text assertions.
- [ ] Real Writable/EventEmitter mirror tests: sync throw, async EPIPE/close,
  first backpressure disables mirroring exactly once; journal persists first,
  no child signal/cancellation callback and no unbounded display queue.

### Task5: Wire observed constructor lifecycle without relaxing ownership

- [ ] Extend existing actual wrapper-entry test harness with forbidden subprocess
  sentinel: journal creation/fsync failure refuses before password/child effects.
  Keep imports inert and CLI/default/ambientPG guards unchanged. The harness
  replaces only actual slow effects, not precondition/cleanup/ownership checks.
- [ ] Capture actual child exit/close into durable controls immediately; raw
  child results/stream error are observed, not fabricated caller receipts. Test
  exit-only/nonzero/signal/unknown close and cancellation on real lifecycle
  consumers. Existing observe/settle/quiescence/deadline functions remain gates.
- [ ] Wire output redaction BEFORE persistence BEFORE terminal mirroring. Every
  real per-stream split/full URL/password/truncated-prefix/binary consumer passes
  through persistence and strict reader; no assertion on a redactor mock.
  Input/journal failure burns completeness yet drains already-owned children;
  do not throw out of stream callbacks or infer descendants from directclose.
- [ ] Journal each quiescence sample and actual admin-end API settlement; only
  existing complete test-close/private-catalog/backend gate may grant own
  shutdown. Final observed terminal after known server close; test nonzero
  preserved, journal close uncertainty prevents wrapper success. Reader never
  equates terminal observations with the writer's future process exit.
- [ ] Fresh journal+cluster+package/default-discovery tests, full evals/noemit/
  contracts/check-only digests/MC/diff/credential scan. Commit scoped clean source;
  independent exact eight-path source/test/spec/plan review before any invocation.

### Task6: New actual ordinary verification and delivery

- [ ] Obtain exact reviewed pre-effect clearance for ONE fresh ordinary findings
  invocation at clean committed source. Current plan does NOT invoke anything,
  adopt old PID, read old private password/SQL or signal/clean old fixtures.
- [ ] Observe freshidentity, unchanged complete finding graph, exit AND close,
  both actual catalog/backend samples, driver-end API, captured server normal
  shutdown/close; inspect entire redacted journal and managed result. A daemon
  loss with missing final result stays incomplete; no test restart/adoption.
- [ ] Only actual complete findings success permits reviewed whole npm graph;
  all default stages and actual closure required, never combine partial runs.
  Disk/memory/livePG31/zero-owner/HTTP checks before and after; stop at resource
  safety/new-authority boundary, not at a stale historical blocked flag.
- [ ] Reviewed normal scoped PR/security/full paginated comments/exacthead
  delivery; separate fresh clean-main build/merged proof without modifying
  uncertain old trees. No full npm/Task6A claim until respective outcomes proven.
