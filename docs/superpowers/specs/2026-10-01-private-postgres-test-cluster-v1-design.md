# Ordinary private PostgreSQL verification cluster

## Evidence, authority and selected approach

PR256 delivered the stale evidence fixture repair. Default findings still
refuses FINDING_OWNER_TEST_PRIVATE_CLUSTER_UNVERIFIED before DB access: its ten
owner-backed tests require an actual distinct /tmp/setfarm-task6a-pg.<alnum>/data
cluster on127.0.0.1/non5432, with exact data_directory/port/socket verification.
No ordinary code-owned constructor is delivered. Closing this broad test gate
is causally necessary to Task6A; it is NOT protected admission or a live fence.
The2026-09-27 explicit Task6A isolated-role/credential rehearsal authorization
is recorded in logs/2026-09-26-task6a-live-writer-fence-plan.md. Root is sole writer.

Select one opt-in ordinary cluster wrapper for two closed commands: findings
or the existing complete npm test graph. Do not change either existing default
test command. Alternatives: reusing an old manually started cluster loses
fresh ownership/lifecycle proof; disabling the findings preflight violates its
contract. Preserve every prior DB footprint, tree, archive and selected service.

## Interfaces and effects

scripts/run-private-postgres-tests.mjs is inert on import. It exports:

- planPrivatePostgresTestsV1({root,port,mode}): immutable fixed initdb/server/test
  argv for modefindings orall; strict exact temporary prefix, integerport1024..
  65535 excluding5432, and no arbitrary commands/URLs/paths.
- createPrivateTestOutputRedactorV1(secrets): bounded incremental byte redactor,
  write(Buffer)->Buffer and end()->Buffer. Both actual password and full admin
  URL are replaced across all chunk boundaries before stdout/stderr forwarding.
  On end/error/cancel, a suffix matching any nonempty credential prefix is
  suppressed too; truncated secret output is never flushed raw.
- observeOwnedPrivateTestChildV1(child): event-bound witness distinguishing exit
  from close/error; no pidfile, process search, foreign PID or fabricated reap.
- settleOwnedPrivatePostgresV1(witness,timeoutMs): one SIGINT to only the owned
  still-running server ChildProcess; definite close/code0/no signal required.
  Exit-only, kill failure, error, timeout or signal are refusal, not cleanup proof.
- verifyPrivateTestClusterQuiescenceV1(databases,backends,pid): exact original
  catalog and sole wrapper external/unknown backend observed, not a writer fence.
- watchPrivateTestCancellationV1(emitter): scoped SIGINT/SIGTERM observer races
  waits; cancellation does not itself signal test/server children. Remove only
  owned listeners on return, retain/refuse uncertain test chain.
- racePrivateTestDeadlineV1(promise,timeoutMs): monotonic absolute awaited-result
  deadline, not merely connect/idle timeout; timeout refuses and own SQL is ended.

CLI accepts exactly findings orall. Before effects require macOS, real/effective
UID501 and GID20 (this approved ordinary host account), Node26+, fourGiB free,
clean current source worktree,
fixed installed PostgreSQL17 tools and fixed npm-cli script. Reuse linked writer
and existing dependencies; no install, sudo, OS/grant/global credential change.
Actual execution follows reviewed committed source, never a dirty-source bypass.
Before any subprocess/filesystem creation, refuse every ambient PG* key in the
wrapper itself: the in-process driver reads original process.env defaults. Child
whitelisting alone is not that proof. Refusal prints only a fixed reason enum,
never the setting value/raw exception.

Create a fresh mkdtemp /tmp/setfarm-task6a-pg. directory0700, verify ordinary
owner/mode/no symlink and pin inode/device. A locally reserved loopback ephemeral
port is released immediately before owned server spawn; a competing binder
causes startup refusal, never fallback or connection to an unverified cluster.
Create random32-byte hex credential in a0600 exclusive/no-follow owned password
file; initdb uses explicit scram-sha-256 host/local, UTF8/C, no-clean, no-instructions,
normal sync, fixed bootstrap userpostgres. Initdb never inherits PG*, SETFARM*,
NODE_OPTIONS or loader overrides. No trust, fsync-off or pg_ctl/pidfile control.
Retain the entire fresh0700 footprint including password file for evidence;
never unlink/drop/delete it or expose credentials in source/logs/error objects.

Directly spawn fixed ordinary postgres17 foreground child with -D exactdata,
-h127.0.0.1, -p selectedport, -k exactparent, explicit socket0700 and modest
shared_buffers/max_connections. Register event witnesses immediately. Initial
commands/version/initdb bounded60s; readiness absolute30s.
Identity operation including connected SQL is externally deadline-bound30s;
port reservation and complete DB-quiescence operation bounded10s each.
Confirm exact existing finding preflight identity plus actual password_encryption and listen_addresses
and exact socket directory/0700 setting before the unchanged test command.
Initdb timeout/uncertain closure retains/refuses with no server start. Use existing
postgres driver, no new dependency. Only read-only identity SQL before dispatch.

Pass the actual private admin URL and data directory to the normal test child;
remove ambient SETFARM_PG_URL/PG*/NODE_OPTIONS and all Task6A privileged opt-ins.
Keep ordinary PATH/HOME/browser prerequisites, never mutate system environment.
Existing P3 projection/FD3/template/primary/clone cleanup stays authoritative.
Observe the test child through close; normal nonzero is retained, not converted
to success. Redact both output streams before forwarding. Print only fixed stage,
owned non-secret root/port/PIDs/counts/result fields, never raw exceptions/URLs.

Test exit and close must both be observed with agreeing integercode/no signal
and no child error. They are not descendant settlement. Before ordinary shutdown,
read-only pg_database must contain only originalpostgres/template0/template1 and
two pg_stat_activity observations100ms apart must show no external/unknown
backend other than the wrapper. Known ordinary PG worker types are explicitly
classified; client-address-bearing/walsender/unknown or NULL types deny.
This verifies actual private DB cleanup/quiescence, not a continuous writer fence
or all non-DB descendant absence. Normal nonzero test result remains nonzero even
if this private cleanup gate passes. Await own driver.end API settlement (not
independent socket/backend absence), then fast-shutdown only
the captured server, requiring definite successful close. On unknown, signal,
error, cancel, retained test DB or foreign backend, do NOT stop the cluster under
potentially running descendants. Before tests start, a constructor refusal may
settle only its actual captured server. Preserve
0700 footprint, refuse, unref only owned handles/streams after explicit uncertainty;
never infer all test descendants closed from one child. Test graph errors do not
prove P3/global filesystem cleanup. Server shutdown does not prove live admission.
No restart/port retry/root/SIGKILL/process-group/pidfile fallback.

## File map and verification

Original six paths: new wrapper; new scripts/__tests__/private-postgres-test-cluster.test.js;
package.json adds test:findings:private and test:private-postgres entries; existing
tests/evals/package-scripts.test.ts verifies actual wrapper dispatch; this spec;
docs/superpowers/plans/2026-10-01-private-postgres-test-cluster-v1.md.
No src/migration/P3-scope or existing finding-preflight changes.

TDD: missing module RED; hand-derived exact vectors and invalid root/port/mode
refusals; actual multi-chunk secret redaction; fake owned event boundary tests
for real lifecycle consumer (exit alone, nonzero, errors, timeout, kill failure,
already-closed and normal fast shutdown). Import/default script tests never
create PG. Before genuine invocation independent exact-source/lifecycle review,
clean committed head and contracts/noemit/diff/security gates. Then actual
findings-only wrapper run, all18 tests files through unchanged routing, record
each stage/count/close and retained root. Only after actual findings success may
the same delivered wrapper execute the whole fresh npm graph; partial passes
cannot be combined into a fullnpm claim. Standby14018 remains immutable until
its current execution graph definitely closes. Reviewed SHA-bound PR delivery,
ordinary unselected clean-main build and merged wrapper proof follow.

## Durable diagnostic journal refinement (2026-10-01)

The one reviewed findings invocation began at2b6b3031, verified a new private
cluster, and yielded genuine partial groups. A daemon restart then lost both
managed sessions: constructor58980 disappeared and its captured postgres59089
survives orphanPPID1. No final graph/result/quiescence/server-close was observed.
Cause/signal/EPIPE is unknown. Retain that tree, cluster, credentials and every
old footprint; never adopt its PID, query its private DB or repeat consumed
clearance. This evidence loss makes persistence causally necessary for the same
unfinished constructor verification, not a new service or admission mechanism.

Select one journal over separate transcript/status files (ordering ambiguity)
or a detached launcher/watchdog (unjustified ownership expansion). It cannot
guarantee survival of process/machine death. No final observation stays unknown.
Current source/main/native/runtime/SQL/cancellation/shutdown policies remain.

Add inert builtin-only scripts/private-postgres-test-journal-v1.mjs plus actual
file/stream consumer tests in scripts/__tests__/private-postgres-test-journal.test.js.
Keep orchestration wiring in existing wrapper/tests. This refinement modifies
six paths: those two new files, existing wrapper/test and this spec/plan.
Cumulative delivery has eight paths including the unchanged v1 package/eval
dispatch additions. No src/migration/P3/preflight/default graph changes.

### Interfaces and storage

- createPrivateTestJournalV1(root,directoryFd): validates the internally created
  /tmp/setfarm-task6a-pg.<alnum> root against its already-held directory FD,
  ordinaryUID501/mode0700/no-symlink/inode/device. Exclusively open fixed
  transcript.journal with nofollow0600/nlink1, retain exact FD/path identity;
  fsync file and parent entry before password or child effects. Creation throws
  only PRIVATE_TEST_JOURNAL_REFUSED, never raw exceptions. No reopening,
  truncating, deleting, reusing or recovery of old paths.
- Returned object has output(role,channel,redactedBuffer), control(stage,fields),
  finish(observations), burn(reason), close() and read-only healthy. Roles are
  initdb/server/test, channels stdout/stderr; controls admit only fixed stages
  and bounded known non-secret fields. No arbitrary errors/env/URL/password.
  Post-creation methods return false on sticky failure rather than throwing
  from asynchronous child callbacks. Diagnostic inputs never authorize effects.
- createPrivateTestJournalReaderV1(): write(Buffer) incrementally returns bounded
  validated records; end() reports validated-prefix/terminal-observed/incomplete
  and fixed reason. It owns no FD/PID/process/SQL authority and cannot resume or
  repair a damaged tail. Input chunks maximum128KiB, retained line maximum128KiB.
- createPrivateTestTerminalMirrorV1(stream,onUnavailable): register terminal
  error handling BEFORE writes. write(Buffer) mirrors best-effort; sync throw,
  async error/close or backpressure disables that mirror once. Callback receives
  only a fixed reason enum, not raw error; it cannot signal/cancel children.
  No unbounded queue and no journal recursion through an unavailable mirror.

Framing is exact compact JSON+LF with exactly these ordered keys:
{version:1,sequence,kind,role,channel,byteLength,sha256,payloadBase64}.
Sequence1..1000000; kind is output/control/terminal. Output role/channel use the
literal enums above; other kinds require both null. SHA256 is64lowercasehex.
Payload is bytes,
not assumed UTF8; control payloads are bounded JSON with known literal fields.
Maximum encoded frame128KiB; maximum output payload64KiB (split chunks).
Encoded output records cap256MiB; reserve1MiB for controls, total257MiB. These
limits are fixed policy, not runtime/test options. Digests detect framing damage,
not tamper-proofing. Same-UID local journals are ordinary diagnostics, never
protected origin/admission or serialized execution/cleanup capabilities.

Control payload is {stage,...fields,productionAuthority:false}. Stages are
journal-opened,port-reservation,password-create,private-root-retained,initdb,
server-start,identity,identity-verified,test-graph,child-exit,child-close,
child-error,stream-end,stream-error,private-db-quiescence,quiescence-sample,
direct-test-child-closed,admin-close,admin-ended,server-close,
server-definitely-closed,terminal-unavailable,refused. Field names are limited to
root,port,serverPid,testPid,childRole,channel,pid,code,signal,sample,passed,
testsStarted,reason,serverClosed,retained,productionAuthority. Root uses the
fixed prefix; role/channel their enums; IDs positive safe integers; port1024..
65535 except5432; code null or integer0..255; signal null or a known OS SIG name;
sample0/1; flag fields actual booleans. Reason is a fixed journal/cluster/mirror
reason enum, never raw exception text. Unknown fields/types burn. Reader keeps
bounded per-role exit/close/error/stream-end state and two sample flags, not all
transcript records. Terminal observations must agree with that retained prefix.

Positive terminal payload has exactly outcome:'observed',testCode (0..255),
privateDbQuiescent:true,adminEnded:true,serverClosed:true,productionAuthority:false;
require prefix initdb exit/close0, test agreeing normal exit/close/testCode,
server exit/close0, no child/input errors, all six stream ends, both passing
quiescence samples and admin-ended. Refused terminal has exactly
outcome:'refused',reason,productionAuthority:false; it reports incomplete
verification, not cleanup permission. Both are fsynced and seal further writes.
No terminal can report the future wrapper exit or future journal close.

Write each frame once and require the exact synchronous write length. A short
write/EINTR/exception refuses and retains the partial tail; no guessed retry or
repair. Check exact held root/journal identities, owner/mode/nlink and expected
size before/after writes. Fsync every control transition and at most256KiB of
accepted output between checkpoints; output EOF/final require all prior output
durable. Fsync uncertainty burns; do not fall back to terminal-only success.
Output limit/input error burns evidence completeness but reserved control space
may still record refusal if I/O identity remains healthy. Actual I/O uncertainty
forbids further writes. No whole-transcript allocation or unbounded buffering.

### Orchestration and observed outcomes

First durable observation records fresh root/journal creation. Subsequent stage
intent precedes port reservation, password creation, initdb/server dispatch,
identity SQL, test dispatch, quiescence, admin end and server shutdown. The
journal cannot precede its own creation and does not invent that observation.
Persist redacted child bytes before any terminal mirror. Reuse the existing
per-stream exact password/full-URL redactor, including partial-prefix suppression
at end/error; do not claim protection against arbitrary transformed secrets.

Record actual initdb/test/server exit and close separately from captured
ChildProcess events. Record each actual quiescence sample and own driver-end API
settlement. Unknown lifecycle, child/input/journal error, cancellation or retained
DB/backend remains refusal. Continue bounded draining/observation of already
owned children despite display/journal loss; only the existing actual
test-close/quiescence gates permit captured-server shutdown. Journal health is
not a substitute for those gates, and journal loss never grants a new signal.

finish records only observations already made: agreeing normal test exit/close,
both passing quiescence samples, admin API end and agreeing server exit0/close0
without child error. Normal nonzero test code stays nonzero. No positive terminal
after a completeness burn. A refused terminal may describe observed failure;
missing terminal, torn tail, bad sequence/length/digest, contradictory observations
or any suffix after terminal reports unknown/incomplete. Passing TAP alone is
insufficient. Reader must distinguish observed test/server outcomes from future
wrapper/journal-close/outer managed-session exit: a record cannot prove its
writer's future termination. Journal close uncertainty keeps wrapper exit
nonzero; never rewrite already-recorded observations as future closure proof.

No recovered journal/PID authorizes adoption, signalling, private SQL/password
read, cleanup/deletion or production selection. Exact reviewed source and fresh
pre-effect clearance are required for a NEW ordinary invocation. Read every
complete output and actual result before delivery/full npm claims; missing
evidence remains missing. All old uncertain runs remain historical, unverified.

## Primary-source basis

PostgreSQL17 documents ordinary-user cluster initialization, explicit host/local
authentication and private default permissions:
https://www.postgresql.org/docs/17/app-initdb.html . Foreground postgres and
distinct data/ports are documented at
https://www.postgresql.org/docs/17/app-postgres.html . SIGINT fast shutdown waits
for server children and avoids unsafe SIGKILL:
https://www.postgresql.org/docs/17/server-shutdown.html . SCRAM authority:
https://www.postgresql.org/docs/17/auth-password.html . Installed tools17.10 and
Node26.4.0 were checked read-only; none imply protected vendor/native authenticity.
