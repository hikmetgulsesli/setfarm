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

CLI accepts exactly findings orall. Before effects require macOS, real/effective
UID501 and GID20 (this approved ordinary host account), Node26+, fourGiB free,
clean current source worktree,
fixed installed PostgreSQL17 tools and fixed npm-cli script. Reuse linked writer
and existing dependencies; no install, sudo, OS/grant/global credential change.
Actual execution follows reviewed committed source, never a dirty-source bypass.

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
commands/version/initdb bounded60s; readiness absolute30s. Confirm exact existing
finding preflight identity plus actual password_encryption and listen_addresses
and exact socket directory/0700 setting before the unchanged test command.
Initdb timeout/uncertain closure retains/refuses with no server start. Use existing postgres driver, no
new dependency. Only read-only identity SQL occurs before test dispatch.

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
classified; client-address-bearing/walsender/unknown types deny.
This verifies actual private DB cleanup/quiescence, not a continuous writer fence
or all non-DB descendant absence. Normal nonzero test result remains nonzero even
if this private cleanup gate passes. End wrapper SQL then fast-shutdown only
the captured server, requiring definite successful close. On unknown, signal,
error, cancel, retained test DB or foreign backend, do NOT stop the cluster under
potentially running descendants. Before tests start, a constructor refusal may
settle only its actual captured server. Preserve
0700 footprint, refuse, unref only owned handles/streams after explicit uncertainty;
never infer all test descendants closed from one child. Test graph errors do not
prove P3/global filesystem cleanup. Server shutdown does not prove live admission.
No restart/port retry/root/SIGKILL/process-group/pidfile fallback.

## File map and verification

Six paths only: new wrapper; new scripts/__tests__/private-postgres-test-cluster.test.js;
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
