# Task6A Single Socket Backend Lifecycle Design

## Causal scope

Protected startup cannot publish a pool whose verified backend can be silently
replaced. Local Postgres.js3.4.8 source creates a second internal client in
listen(), automatically reLISTENs on loss, and reconnects queued work from
onclose before asynchronous end() finishes. This root fix is necessary for the
approved Task6A cutover; it does not select a live runtime or change old defaults.

## Chosen boundary

Create import-inert `createTask6aSingleBackendSocketClientV1(transport,
onNotification?)`, a transport/lifecycle primitive, NOT descriptor, role/grant,
readiness, worktree-owner or admission authority. Consume the existing exact
transport parser and actual UID/environment guard; use explicit literal socket
path. No URL, TCP, password, caller socket factory, profile override or external
connection hook. One physical native socket creation at most per client.

The internal socket factory synchronously checks permanent revocation, exact
resolved-options identity, actual real/effective UID and ambient PG/URL absence,
then burns the single attempt BEFORE any native Socket allocation or await.
It connects only the captured Unix filename and resolves after connect, with
temporary error handlers. Error, close or explicit revoke is irreversible;
destroy any known native socket synchronously before asynchronous driver close.
Revocation also starts one retained zero-timeout driver end() promise to drain
queued queries; rejecting a replacement custom socket alone leaves some queued
driver promises unsettled. This drain is cleanup, not the mechanical fence.
Recheck identity/environment at connect completion. Reconnection and duplicate
hidden clients refuse before native allocation. Never trust async end() alone.

Fix max1, max_pipeline1, idle_timeoutnull, max_lifetimenull, sslfalse and bounded
connect timeout. Freeze resolved top-level options so its internal factory and
endpoint fields cannot be replaced on the returned SQL object. Driver-owned
mutable parser/shared/parameter structures remain mutable for compatibility;
this is not a sandbox against arbitrary code holding the same OS/PG identity.
Generated agents must still receive a different nonprivileged UID/broker.

Return a frozen object with `sql`, synchronous `revoke()`, idempotent async
`close()` and frozen `observe()` lifecycle facts. Captured raw sql cannot create
a second native socket after loss/revocation. Pending work is not assumed rolled
back merely because a socket is closed; callers must preserve effect uncertainty.
No inference of continuous writer exclusion against the trusted root driver.

LISTEN must use the actual reserved connection via fixed channel SQL and the
internal onnotify callback; do not use driver listen()/subscribe() hidden pools.
Notifications after revoke or identity/environment drift must not dispatch.
Callbacks must be synchronous and return undefined. Throws or any other return
revoke; accidental returned promises are drained to avoid unhandled rejection,
not accepted as asynchronous dispatch. The primitive does not authenticate notification
payloads or grant callbacks runtime authority. Driver reserved SQL lacks many
methods its declared ReservedSql type suggests: use its actual unsafe/release
surface, not assumed begin/end/listen methods.

## Proof

Pure lazy tests show exact options, denied ambient/wrong UID input, no native
allocation after preconnect close/revoke, and hidden-client refusal. Actual
existing private peer fixture imports unchanged source under `_www`, verifies
the same reserved backend PID/session_user/current_user/database/null client
address before LISTEN and notification, and exercises loss with queued writes.
Native creation stays one; old handles cannot reconnect; forbidden queued
effects remain absent in actual private PG rows. Repeat across fixture restart.
No production Setfarm directory/path override, root Node, new host account,
live DB/schema/service/selector/archive or dependency change.

## Follow-on gate

Only the later zero-input protected initializer can compose this primitive with
the held fixed descriptor, physical socket facts, actual restricted role/grants,
current journal/base catalog/owner/manifest and initialization epoch. Publication
and legacy URL/default DDL refusal, spawner pre-effect admission and agent UID
separation remain unimplemented gates. This primitive alone is not cutover.
