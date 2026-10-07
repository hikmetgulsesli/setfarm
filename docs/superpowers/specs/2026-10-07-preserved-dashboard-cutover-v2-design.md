# Preserved dashboard cutover V2 design

## Causal correction and approved boundary

Implements September16 preserved-deployment-cutover steps1–5. Dashboard recovery
is an intermediate checkpoint, not Task6A readiness or whole-cutover completion.
The existing CLI/dashboard path does not invoke experimental S10 native code.
Its universal retained-terminal research is NOT a prerequisite for this ordinary
dashboard transition. The previous private master plan conflated these domains.

Use standing owner authorization and the already-approved preserved route.
Root alone writes; independent reviewers stay read-only. Preserve both original
dirty files, selected bootstrap source/build/CLI until a qualified transition,
all archives, candidate ae5 build and native fixtures. No runtime/test bypass,
secret/access change, erased source, archive disposal or direct main commit.

Alternatives: rebuild/copy into the frozen selected checkout violates preservation;
direct daemon start skips the required cutover ownership/journal; the selected
path is a complete, durable, capability-bound controller through dashboard step5.

## Scope / ordered operations

### Capability-bound owner labels before the consuming adapter

Add observeDashboardCutoverOwnerBindingsV2(capability) to the existing
scripts/deployment-cutover-owner.mjs; extend its existing builtin owner test.
It consumes ONLY the original private WeakMap owner handle and returns exactly
frozen fields schema,authority,maintenanceIntentHash,ownerClaimHash,
controllerSourceHash,cutoverPlanHash. Schema is
setfarm.internal-production-dashboard-cutover-owner-bindings.v2; authority is
binding-only. Four hashes are taken from ORIGINAL held maintenance/claim, never
caller JSON, reloaded history or a new source observation. Hashes are labels,
not ownership/effect/recovery authority; the adapter retains the original handle.

Authenticate that same handle with existing assertDeploymentCutoverOwnerV1 both
before projection and immediately before return. Foreign/proxy/serialized copies
refuse without caller traps and without burning a valid idle handle. No new
owner, history publication, service or SQL effect is introduced. No new acquisition
code/resource class beyond the two existing bounded read-only assertions; their
actual filesystem/process operations and sticky cleanup uncertainty remain.
Keep existing owner acquisition/assertion behavior unchanged. New projection
sets its active guard before the first trusted composite assertion; nested
projection (even swallowed) burns the original owner/module before further
projection ports. Check active/original/burn state after each composite returns;
no per-query abort inside existing assertions is claimed. Failure is sticky;
restoring source/history/process evidence never revives that owner.

Tests pin exact returned labels to real on-disk fixture claim/maintenance, frozen
copy/no capability serialization authority, hostile handles zero traps, source
and history/process drift with sticky refusal, and swallowed projection reentry.
Existing compiled private owner fixtures mock clean-main BUILD observation;
they exercise actual FS/current-process owner binding only, NOT production build
qualification, loaded code, complete freeze or service admission.

### Retained launcher material / private pre32 bridge V2

Add four exports to baseline-deployment-cutover-launcher-observation-v1.ts:
holdDashboardCutoverLauncherMaterialV2() (zero arguments, one lifetime attempt),
assertHeldDashboardCutoverLauncherMaterialV2(handle),
withHeldDashboardCutoverLauncherPre32V2(handle, trustedContinuation), and
closeHeldDashboardCutoverLauncherMaterialV2(handle). Dedicated source-fault test.
Original V1 diagnostic/default idle/qualification guards stay unchanged.

Acquisition privately reuses the existing strict default-mode configuration
holder: both fixed plists and nofollow original ancestor/file descriptors, exact
parsed contents and matching loaded-idle configuration before/after acquisition.
It mints an empty frozen null-prototype WeakMap handle only after final material
and actual account checks. No credentials, secret-derived configuration hashes,
raw SQL, mutable resource or observation method is exposed by this handle.

Material assertions recheck the ORIGINAL plist/ancestor identities and bytes,
actual original account UID/GID/home/name/shell, and matching privately validated
launcher DB URL. They do NOT call launchctl or require loaded/idle jobs after
acquisition. Unloaded/loaded/running state does NOT become an authorization flag;
separate future typed phase observations remain required before any effect.
This slice holds plist material ONLY, not Node-path/passive-home resources,
family/process drain, absence, loaded code or service authority.

Private pre32 bridge accepts only a genuine handle and same-process nonproxy
function. It consumes the unchanged, agreed local/setfarm URL privately through
the already-qualified withHeldDashboardCutoverPre32DatabaseV2. Bracket dynamic
import, callback entry, callback settlement and original bridge settlement with
material/account checks; the caller receives only the existing opaque PG scope
and immutable census, never the URL. Callback is trusted composition, not effect
permission. Existing pre32 scope controls detached reads/driver-close lifetime.
Launcher wrapper separately retains its OWN original trusted-callback promise.
Outer PG/import/bridge rejection burns/revokes before escape but is NOT callback
settlement. No activity release or plist FD cleanup while that original callback
is unresolved; immediate close refuses without close ports. Retain custody and
observe its eventual rejection without converting it into success/retry. Only
when BOTH original callback and outer bridge genuinely settle may activity clear
for a later idle checked-once close. If either remains unknown, retain resources.
Use private material-only checks for the agreed URL; existing V1 URL getter's
loaded recheck is not suitable and stays unchanged for its original callers.

Reserve module activity before the first assertion/import; active reentry on any
of the four exports burns original custody even if swallowed. Idle foreign/proxy
handles refuse without caller traps or burning a valid owner. New assertion,
admitted bridge or acquisition failure is permanent; restoring bytes never
revives. Idle pre-admission invalid arity/foreign handle/proxy callback refuses
without ports or valid-custody burn; active reentry still burns before lookup.
Close reserves closed state BEFORE reverse once-only original-resource cleanup;
idle duplicate close is inert. Failed close retains sticky unknown, never
retries, unlinks or reacquires. Active close burns but does not close descriptors
under an outstanding assertion/bridge; a later idle close may settle original
resources once. Source fixture ports mock launchctl/PG only, real private plist
FS; no actual launchd or PG qualification. Bounded recipe never mutates host jobs.
Deferred callback plus early PG connection-loss recipe must prove close refusal
with zero original closes, followed by genuine callback settlement and exactly
one reverse cleanup. No settlement is inferred from timeout or process death.

### Causal core-reader checkpoint decision and pending provider nomination

Select a restricted, truthful core-reader dashboard checkpoint while the OPEN
cutover intent continues to refuse the ordinary spawner. This is the smallest
causal recovery of useful existing UI data under the retained pre32 transaction;
it is NOT a whole dashboard/Task6A completion or permanent feature reduction.
Implement six named data-only reads backed by seven source-owned literal SELECT
shapes: listRuns(workflowId?), runById(id), stepsForRun(id), storiesForRun(id),
customRules(), observationsForRun(id). No statement text, generic query callback,
raw driver, query/result control object, connection options or transaction
commands are accepted/exposed by this interface. The exact current SQL inventory
is dashboard.ts110–138,389,747; operational model adds another observations
projection and is NOT silently included. There is no actual settings route.

Code-owned fixed-root OPEN-intent observation selects an irreversible restriction
BEFORE the first await/acquisition; it grants NO startup/effect authority.
Known absent preserves ordinary behavior. Unknown intent/freshness refuses.
Generic getSql/pgQuery/pgGet/pgRun/pgExec/pgBegin, migration/admin/configuration
entrypoints are fenced before ports when restricted; named reader functions do
not run ensureSchemaReady/pgMigrate or fake their readiness variables. pgClose
cannot reset restriction into ordinary mode. Existing Task6A/full-head/base-owner
verifiers are unchanged. A new structural read profile must be separately
nominated; ownerReachable=false cannot be falsified or weakened for reuse.

Select a NEW private READ ONLY REPEATABLE READ transaction per COMPLETE HTTP
data operation, not a persistent cross-request session. Task4c/4e scope does not
transfer its ended backend. Runs list includes runs+ALL selected step reads in
ONE transaction; run detail includes run+steps in ONE transaction. The seven SQL
fragments are private building blocks, not independently exported transaction
callbacks/methods. Exact journal1..31, cold catalog and required ordinary structure
are checked before reads and finally on that SAME original transaction. Return
copied inert rows only after its original callback/transaction/client settlement.
Loss retains original pending custody; another request cannot replace it until
genuine settlement. No application queue/retry; initially one active request,
explicit busy refusal. Process restriction stays permanent between requests.
Provider connection loss/reconnect/queue behavior still needs exact source-port
qualification for EACH invocation; max1/session defaults/onclose alone do not
prove successful snapshot settlement. NO continuous backend/owner claim between
requests is needed or permitted for inert UI data. The controller independently
retains its Task4c READ COMMITTED/36 SHARE locks; their semantics stay unchanged.
Installed driver initial-close and queued-reconnect paths remain explicit review
obligations. Keep provider startup/internal traffic separate from application
port counts; never claim per-internal-query abort or natural backend death from
end(timeout:1). Returned data are copied inert row snapshots, not a physical
freeze, owner, phase or effect capability. A fully qualified live entry/adapter
must independently grant the eventual daemon start; reader-ready is not that
grant. Do not wire a public OPEN-intent daemon start on reader-ready alone.

Before daemon PID publication/listen, the eventual authenticated startup must
prepare the restricted profile. Direct unqualified start under OPEN refuses.
Restricted HTTP dispatch is exact METHOD+PATH before body/token/legacy handlers:
GET root/static assets/workflows and the exact existing data routes below only:
GET /api/runs (runs+all selected steps in one transaction), GET /api/runs/:id
(run+steps in one transaction), GET /api/runs/:id/stories,
GET /api/runs/:id/observations, GET /api/rules and GET /api/rules/export.
Select export as the same existing rules/filter closure, not a new SQL shape.
No standalone steps endpoint is introduced. Mutations,
SCRAPE, deployment-observation GET (external probes), raw-driver advanced reads,
operational model/snapshot, artifact authority, transfer acknowledgements, shadow
parity, supervisor/events/medic and all other unqualified routes return explicit
unavailable status without downstream calls. Never let run-ID catch-all or HTML
fallback convert an unknown API into200. Existing medic table helper is a NO-OP,
not DDL; its actual hazards here are generic migration and unawaited/swallowed
errors. Unavailable UI panels must display truthful status, not empty success:
existing frontend fetchJSON ignores HTTP status, so this causal UI correction
belongs in the same root fix. No failed projects are hidden or deleted.

Current basic lists are unbounded except observations250. Any row/byte capacity
or narrowed SELECT projection must be explicitly nominated with refusal (not
silent truncation/absence), and return-data caps must not be mislabeled provider
transport/backend memory bounds. No new cap or SQL implementation is approved
by this decision paragraph. Exact whole-request provider API, structure validators,
closed statement/parameter/result contract and private PG/HTTP recipe are the
next nomination before production. No universal/native S10 prerequisite.

### Task4f.0 ordinary database and unqualified dashboard refusal nomination

Deliver the ordinary-path fence before the private reader provider. This fixes
the demonstrated generic migration/admin route; it does not grant reader-ready
or startup. Reuse the existing fixed-root intent observer, not caller mode/env.
Reserve its own activity/burn state before the observer, then perform a pure
post-observer burn check even when nested refusal was swallowed. Synchronous
observation precedes caller options/URL/control inspection, ordinary state mutation,
await and driver acquisition. OPEN or unknown permanently refuses the ordinary
DB path, including after pgClose; a later absent observation cannot reopen it.
Nested observation burns before lookup/ports, even if the nested error is
swallowed. Known absent retains existing ordinary and Task6A behavior. Remember
ordinary use without reset for the eventual fresh-only reader preparation.

File Map: db-pg.ts ordinary getter/schema/config/Task6A/migration and all 22 exported
borrowed-transaction entrypoints; baseline-deployment-cutover-v1.ts a distinct
dashboard refusal assertion; daemonctl.ts startDaemon before isRunning (including
its stale-PID unlink), log open and spawn; daemon.ts before mkdir/PID and dashboard.ts before
server creation/listen; package.json normal pure-suite entries and paired
source-fault tests. Migration32 abort and pgClose
remain original-resource cleanup, not new acquisition or admission. Pure record
validators/now remain unaffected. Earlier returned raw handles are NOT revoked
by this latch; Task5 still must drain/authenticate existing processes.
Migration32 stage and commit are new work and refuse before original-handle lookup;
abort remains the original settlement path. This slice records the warm marker;
functional fresh-reader admission tests belong to the following provider slice,
not an invented proof from a private boolean.

Review-found causal entry refinement: src/cli/cli.ts dashboard start currently
calls isRunning before startDaemon; install's auto-dashboard path has the same
status fast path after awaited installation. Add the distinct dashboard refusal
before these two status calls (ordinary stop/status remain unchanged). Existing
runtime-integrity and ordinary-spawner gates remain in place, not bypassed.
Startup test additionally evaluates the actual AST-extracted/transpiled dashboard
branch and auto-dashboard block with the real owned-intent assertion and inert
status/start ports; validate the named import. This qualifies source-component
ordering, not full CLI loader/build/runtime authentication. RED must reproduce
the running/stale status fast path before this additional production edit.

Fixed errors: DASHBOARD_CUTOVER_ORDINARY_DATABASE_REFUSED and
DEPLOYMENT_CUTOVER_UNQUALIFIED_DASHBOARD_START_REFUSED. DB entry inventory:
getSql, ensureSchemaReady, pgConfigureIsolatedTestDatabase, pgQuery/Get/Run/Exec/
Begin, pgMigrate, prepareTask6aRestrictedSpawnerDatabaseV1; migration32 stage and
commit. Borrowed-SQL exports (exact current source names):
resolveCurrentInternalProductionOwnerProducerManifestSetActivationInTransactionV1;
lockInternalProductionBaselineCompletionOwnerBootstrapTargetInTransactionV1;
lockInternalProductionBaselineCompletionOwnerBootstrapReleaseInTransactionV1;
beginOrAdoptInternalProductionOwnerReservationV1;
bindInternalProductionOwnerReservationV1; closeInternalProductionOwnerReservationV1;
lockInternalProductionRecoverySourceBootstrapRunInsertionFenceV1;
bindInternalProductionRecoverySourceBootstrapRunInTransactionV1;
classifyInternalProductionRecoverySourceBootstrapRunPersistenceInTransactionV1;
assertInternalProductionRecoverySourceBootstrapRunDeliveryPendingInTransactionV1;
resolveInternalProductionRecoverySourceBootstrapActualRunTerminalInTransactionV1;
resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1;
resolveInternalProduction{Claim,ExecutionAttempt,RuntimeSession,CompletionOwner,
MandatoryEffect,Termination,Finding,OperationalDelivery}TerminalAuthorityPairInTransactionV1;
resolveInternalProductionOwnerReservationCloseInTransactionV1;
lockInternalProductionWorkflowRunInsertionFenceV1.

Ports: existing fixed-root observation is a trusted composite read-only port;
failure details become fixed refusal codes. No per-inner-filesystem-call abort
claim. No new resources beyond that observer; initially OPEN/unknown causes no
driver/SQL, PID, listener or mutating filesystem port. Each admission boundary
prevents subsequent ports only: if ordinary absent startup has already published
PID state before another boundary sees OPEN, this slice does not claim continuous
absence, revocation or undo of that earlier write. Retain that negative drift
oracle separately; authenticated Task5 startup/settlement is still required.
DB source fixtures mock the observer and driver. Startup fixtures use the real
observer with fresh owned intent files and mock service/effect ports and unused
advanced import providers. They are not canonical OPEN filesystem, complete
loader/runtime closure or qualified live entry evidence. The late-OPEN negative
oracle witnesses a prior mocked PID-write port, not an actual PID publication.
RED: open/unknown/observation reentry, malformed/proxy controls with zero traps,
generic/admin/borrowed SQL zero ports, sticky after close/absent, no PID/listen
for unqualified OPEN startup; ordinary absent smoke and pure validators unchanged.

### Task4f.1 private whole-response reader nomination

Implement the actual runtime data path next, not another admission label.
Public db-pg exports: prepareDashboardCutoverCoreReaderV2():Promise<void> (zero
arguments), readDashboardCoreResponseV2(request):Promise<closed response below>. Preparation
is one-shot, cold-only and selects the permanent ordinary fence synchronously
before import/await/driver ports. Refuse any prior ordinary attempt, configured
URL, driver/schema/migration/verification/Task6A state or earlier restriction
failure. No caller URL, SQL, transaction callback, options or startup grant.
Use only the private runtime-config URL, matching the independently authenticated
launcher target at Task5; reject PG* environment overrides and anything outside
local localhost/127.0.0.1:5432/setfarm with exact driver-option target agreement.
Reader-ready proves data preparation only; existing public OPEN startup guards
stay closed until Task5 supplies its separately authenticated consuming entry.
Preparation requires fixed-root intent OPEN; absent/unknown refuses permanently.
Select the restriction and copy runtimeConfig.setfarmPgUrl synchronously before
the first await. Capture the original raw SETFARM_PG_URL too: if present, require
exact equality (no whitespace suffix/normalization); if absent require the exact
source default. Later requests use only captured bytes, never mutable config.
Duplicate preparation refuses without new ports; preparation reentry burns the
original attempt. Readiness resolves only after a qualification-only original
RR transaction, its callback and original client cleanup all succeed.

Closed requests, copied from nonproxy exact plain own-data records without
getters/extra/symbol keys: {kind:'runs',workflowId?:string,includeTerminal?:boolean},
{kind:'run',id:string}, {kind:'stories',id:string},
{kind:'observations',id:string}, {kind:'rules'}. Rules/export share the rules
operation; no sixth SQL response shape or steps endpoint. IDs/workflow are
nonempty primitive UTF8-roundtripping strings, no NUL, at most1024 UTF8 bytes.
Absent workflow is normalized explicitly by the router, not through coercion.
Keep the existing terminal filter/projection and observations250 semantics.
includeTerminal defaults false. Exact results: runs is the existing projected
array (selected steps included); run is the original column row plus steps or
null, with no list terminal filter; stories is the original column array;
observations is the existing camelCase/JSON-fallback projection; rules is custom
rows only. HTTP retains system-rule merge/filter/export. Malformed requests and
busy refuse only that request, zero driver ports, without burning readiness.
Capacity overflow refuses that complete response after original settlement;
unknown/malformed provider rows and qualification/provider failures burn readiness.
Seven private SQL fragments use explicit public table qualification, with
unchanged selected fields/order/filter. Runs plus every included step read and
run detail plus steps stay on one original READ ONLY REPEATABLE READ transaction.
No raw driver or subquery callback crosses the public interface.

Select one active operation, no application queue/retry. Busy requests produce
explicit unavailability and zero additional driver ports; ordinary simultaneous
HTTP requests do not invalidate the original successful snapshot. Preparation
reentry/unknown or original connection/transaction/callback/cleanup failure is
sticky refusal. Track callback and query promises separately from begin's outer
race; retain original occupied custody after early outer loss. Cleanup consumes
the original client once, never opens a replacement; end(timeout:1) is provider
settlement, not backend-death certification. Never return rows until original
callback, transaction and end all successfully settle. Swallowed failures and
pending original work cannot publish rows or restore ordinary mode. pgClose
must not clear the reader slot, restriction or preparation history.

Before and finally on the same transaction: exact source journal1..31, existing
applied26..31 tail, cold catalog/complete legacy zero-owner census and separately
nominated structural reader checks. Controller Task4c/4e READ COMMITTED/36 SHARE
transaction remains independent, unchanged and not transferred. Installed
provider reconnect/internal-startup traffic is not application retry or a new
continuity proof; detect loss/rejection and never publish a failed snapshot.
No per-inner-query abort claim for existing trusted census composite ports.

Nominate publication caps: fetched runs256, steps1024 per included run,
stories/rules4096, existing observations250, aggregate rows4096, inert PG response
UTF8 JSON4MiB. Overflow refuses the WHOLE response, not truncation or empty
success. Runs data SELECT budget257; detail2; others1. Qualification/transaction/
driver startup traffic is separately counted, not hidden inside these data
budgets. These limits bound publication/application calls, NOT transport/backend
allocation. Later restricted HTTP adds the SAME4MiB complete-envelope budget
after system-rule merge/filter/export; it cannot silently relax this limit.
Copy/freeze exact source-column rows; built-in Date timestamps become ISO strings
using intrinsic Date operations, preserving ordinary JSON output. Reject proxy,
accessor, foreign type, duplicate/missing identity or malformed/crossed rows.

Structural File Map: new db/dashboard-core-readonly-profile-v2.ts plus focused
tests, private per-response reader module and tests, db-pg.ts facade/latch,
shared pure dashboard run/observation projection only if needed to avoid source
duplication; dashboard.ts retains its existing public projection export.
Extract the existing value semantics into server/dashboard-core-projection-v2.ts
with tests/dashboard-core-projection-v2.test.ts first. It has no DB/server/HTTP
imports and does not claim hostile-row validation: legacy run spread/steps
reference and safeJson object identity/fallback behavior remain unchanged. Reader
validation/inert copying is separate. This pure extraction may proceed before
the still-open structural/provider gate; it supplies no reader/startup authority.
Five fixed public relations: runs20 columns (11 ordinary+5 protocol+4 pre32
pointers), steps18, stories33 including quality_failure_fingerprint, rules13,
run_observations20. Freeze complete names/types/nullability from ordinary DDL
and migrations2/13/14/15/18, not base-only constants. SELECT* tables refuse extra
columns; explicit observations projection does not export other fields.
Require permanent plain heap, no view/foreign/partition/inheritance/RLS/rewrite,
built-in column types/typmods/generated/identity state and SELECT privilege.
Require valid unique id primary key and source-compatible builtin index/operator/
collation paths, rejecting expression/custom-code substitutions. Exact catalog
statements/result tuple contract must be independently reviewed before production.
The concrete three statements and104-column/index tuple nomination are in
2026-10-07-dashboard-core-readonly-profile-v2.md; its explicitly open predicate/
dependency gates are not cleared by merely writing that document.
Do NOT alter existing ownerReachable=false/base/full-head verifiers; read
compatibility is not owner, admission, migration or physical freeze authority.

Source-fault RED covers all closed requests, one whole-response transaction,
no generic migration/driver escape, fresh/warm selection, zero-port hostile input,
busy/loss/pending callback/query/end custody, final qualification failure, exact
private SQL/parameters, overflow/no partial rows, inert copied output and no
startup grant. Structural fake-row tests complement, not replace, source-port
tests. Actual metadata/data characterization uses the agreed private host URL
only through the qualified facade and emits counts/hashes, never URLs or row
payloads. It remains read-only characterization, not live startup authority.
Any private writable PG fixture/concurrent-writer test needs its own exact
resource/target/cleanup nomination; a five-table-only fixture cannot satisfy the
full existing legacy census and must not be mislabeled migration31 application.

### Pending causal dashboard-reader startup root fix

#### Task4f.1b closed data operation on the caller's original transaction

File Map: db/dashboard-core-response-v2.ts, its focused internal-production
test and package.json's normal pure-suite entry. Internal readDashboardCoreResponseInTransactionV2(originalTransaction,
request) never begins/ends a transaction, opens a client or executes qualification;
the private lifecycle composer owns initial/final qualification, RR/locks and
settlement. No raw SQL/query callback crosses the public db-pg reader facade.
copyDashboardCoreRequestV2(request) copies one exact own-data record; permit
Object.prototype/null prototype only, reject proxy/accessor/symbol/extra keys
before any transaction property/port. Absent includeTerminal becomes false;
present undefined controls refuse. Empty workflow is normalized by HTTP before
this module, never by coercion. IDs/workflow use the nominated1024-byte bound.

The seven fixed data statements are the current SELECTs with explicit public
qualification: runs with workflow predicate; all runs; run by id; steps by run
ordered step_index; stories by run ordered story_index; custom rules ordered
sort_order/created_at; explicit20 observation columns by run ordered created_at
DESC LIMIT250. No standalone steps operation or alternate SQL input. All included
run/step statements use exactly the supplied original transaction. Validate
source-manifest columns/nullability, primitive text/int4/bool and original builtin
Date timestamps (intrinsic conversion to ISO, no caller hooks). Preserve raw TEXT
value semantics, including status/protocol; projection's legacy TypeScript type
is not an additional protocol-enum authority. Reject extra/missing/crossed rows,
duplicate identities per relation, and requested ID/workflow mismatch.

Keep expected parent IDs private before the data port; hand it only a fresh
parameter array, never use its retained mutable array as result identity. Before
await assimilation, reject synchronously returned object/function proxies without
traps. Promise/provider settlement itself remains a trusted installed-driver
boundary: provider-internal assimilation cannot be retroactively prevented by a
consumer. Validate outer Result density/own-data indices/no symbols before a
nonburning row-count capacity refusal; malformed outer batches remain sticky
even over-cap. Oversized dense batches are refused before decoding row values;
this is no claim that over-cap values are source-qualified. Nonenumerable driver
metadata is ignored without access. Neither validation nor response caps bound
driver allocation or provider-internal execution.

Count fetched rows before subsequent data ports: runs≤256, steps≤1024/run,
stories/rules≤4096, observations≤250, aggregate≤4096. Whole final projected inert
JSON≤4MiB. Inert response root depth0; each own field/index traversal adds1;
depth64 accepted,65 whole-response capacity refusal. This is a newly nominated
reader publication restriction, not legacy projection equivalence or provider
allocation bound. Preserve observation JSON fallbacks/scalars before deep inert
copy; no subtree replacement, truncation, empty success or partial publication.

Four fixed privately WeakMap-branded failure categories:
DASHBOARD_CORE_REQUEST_REFUSED / DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED are
operation refusals; DASHBOARD_CORE_ROWS_REFUSED / DASHBOARD_CORE_QUERY_REFUSED
require caller sticky refusal. classifyDashboardCoreResponseFailureV2(error)
inspects original identity without caller traps and returns an inert private
category or null; error messages alone cannot classify provider failures.
The lifecycle composer must convert only authentic source capacity failure into
an internal no-data outcome, still perform final qualification, original callback/
transaction/end settlement, and emit refusal afterward. Any qualification/provider/
cleanup failure overrides capacity and burns; no replacement while original work
is pending. Invalid request is rejected before acquisition. This helper/profile
supplies no reader-ready, schema-writer exclusion, backend-death or startup grant.

### Task4f.1c retained original-transaction qualification snapshot nomination

File Map: db/dashboard-core-readonly-qualification-v2.ts and focused paired test;
normal pure-suite entry after verification. Internal
observeDashboardCoreReadonlyQualificationV2(originalTransaction, previous?)
composes only retained source observers, never client/BEGIN/locks/end/listener.
The lifecycle owner must already hold the nominated RR READ ONLY snapshot,
utility settings, five ACCESS SHARE locks and cooperative schema-writer exclusion.
This helper does not establish those conditions or authenticate an arbitrary
transaction. No public query/callback/URL/options are introduced.

Run exact3 metadata observations, source ordinal/name/checksum/state1..31
verification1, exact26..31 APPLIED tail1, retained cold-catalog/aggregate/finding
publication observation5, in that order:10 application statements, separate from
driver startup/transaction/utility traffic. Earlier ordinal identities may be
adopted; the six tail entries must be applied; later32 refuses. Reuse existing
checks without changing their predicates or acquiring the Task4c36 SHARE backend.
Before the old journal verifier receives its batch, require dense own-data
indices and exact primitive row descriptors; never let Array.every skip holes.
Tail rows are independently decoded similarly, never Array.some over sparse
driver rows. Ignore nonenumerable Result metadata without executing it.

The source-returned census has exact13 canonical normalized zero counts plus
validated complete legacyFindingPublicationInventory. Preserve terminal finding
memberships: normalized findingOwnerCount0 does not require raw finding emptiness.
Hash only this closed normalized projection using existing canonical JSON;
inventoryHash is independently verified. The inherited source observer/installed
driver tuple decoding is trusted here, not a new universal hostile-provider
certificate. Return frozen schema/profile/censusHash, privately branded originals
only; copied/proxy/foreign previous snapshots refuse before any transaction port.
Final recheck retains original OIDs/catalogHash and the closed censusHash without
repinning. Cross-request comparison of inert hashes is not backend/capability
transfer. Any malformed row, provider, census or continuity failure yields fixed
DASHBOARD_CORE_READONLY_QUALIFICATION_REFUSED and requires lifecycle sticky refusal.
No partial snapshot, automatic retry, row repair or source gate relaxation.
Source fixtures must exercise sparse/malformed journals, early-adopted acceptance,
tail-adopted/later32 refusal, nonzero counts, profile drift, retained publication
membership and port failures. Actual provider/lifecycle/startup remain pending.

### Task4f.1d private reader lifecycle nomination

File Map: db/dashboard-core-readonly-reader-v2.ts and paired source-fault test;
package pure-suite entry after qualification. The internal source-only constructor
createDashboardCoreReadonlyReaderV2(capturedPrivateUrl) returns frozen prepare/read/
refuse functions, never a driver, SQL callback, transaction or startup grant. It
may be created only once per process, consuming that selection before validation.
The future db-pg public facade remains zero-argument preparation plus closed
request reads; it owns cold-state/intent/config capture and its own reservation
before imports/awaits. The internal URL argument is not a new public URL input.

Require a primitive UTF8-roundtripping URL≤65536 bytes, no NUL/whitespace,
exact lower-case postgres/postgresql syntax, nonempty user, only localhost or
127.0.0.1, omitted/5432 port, exact /setfarm, no query/hash/multihost/socket.
Privately decode credentials without hooks; decoded username is nonempty and both
decoded credentials UTF8-roundtrip without NUL. Legitimate encoded password
whitespace is preserved, not blanket-rejected. No URL/credential in errors/results.
Reject uppercase PG* environment controls before each actual factory. Capture
target bytes permanently. One trusted installed postgres client per complete
operation, fixed max1/idle_timeout1/connect_timeout5/debugfalse/inert notice and
source-owned close observer. Register original client custody immediately on
return, before inspecting its actual options host/port/database/user/pass/path/
ssl/socket agreement; mismatch consumes its original end once and burns.
Provider startup/internal traffic remains separate from application statements.

Private phases UNPREPARED/PREPARING/READY/REFUSED and one occupied operation,
no queue/retry/replacement. Preparing duplication burns the original; READY
duplication refuses only that preparation, even during an active read. READY
busy/invalid request refuse only that operation before factory/target ports.
Precedence is fixed: REFUSED first; PREPARING duplication burns before arguments;
READY prepare is nonburning duplicate before arguments/active-read inspection;
only fresh UNPREPARED preparation checks arity and burns on misuse. Thus READY
prepare(extraArg) cannot cancel a valid response. Reads check refusal/readiness,
then active-slot BUSY before arity/request inspection; only idle READY validates
closed request controls and rejects invalid ones without burning.
Constructor arity is exactly1; prepare/refuse exactly0. Bad preparation arity or
unprepared reading is misuse, permanent refusal. Fixed errors are
DASHBOARD_CUTOVER_CORE_READER_REFUSED,
DASHBOARD_CUTOVER_CORE_READER_DUPLICATE_PREPARATION_REFUSED and
DASHBOARD_CUTOVER_CORE_READER_BUSY; messages carry no provider details.
read copy validation uses the actual closed-data helper before acquisition;
extra read arguments are request refusal. refuse is source-owned synchronous
burn; if an original client exists, initiate checked-once original cleanup
without waiting first for stuck callback/query work. No reset/reopen via pgClose.

Begin exactly isolation level repeatable read read only. Before first snapshot
SELECT, run fixed SET LOCAL statement_timeout='5s', lock_timeout='1s',
search_path=pg_catalog and one fixed five-relation LOCK TABLE ONLY public.runs,
ONLY public.steps, ONLY public.stories, ONLY public.rules, ONLY
public.run_observations IN ACCESS SHARE MODE. This does not implement the
independent cooperative schema-writer/old-helper drain or Task5 startup grant.
Reuse qualification10, optional closed data operation, final qualification10
against the initial snapshot. Preparation has no data query; retain its inert
baseline hashes, never repin them on later responses.
Later-read first qualification explicitly receives the retained preparation
baseline BEFORE any data port; final qualification receives that read's initial
snapshot. Prior OID/catalog/census drift must refuse with zero data statements.
No controller backend or36 SHARE lock transfer. No SQL-prefix authorization or
provider option input.

Register callback work before its first source port (defer body until its original
promise is retained). Capture original query promises before attaching any lazy
then/catch/finally observer. After retention, attach intrinsic Promise settlement
observation without calling Query.then/handle (installed Query species is plain
Promise); already-rejecting returned originals remain observed even if burnt.
Retain then recheck burn after the source invocation
and after original then lookup, before synchronously initiating the known
original observer; do not queue unguarded Promise.resolve(Query) assimilation.
Already initiated driver-internal dispatch remains original pending custody,
not a cancellation/backend-death claim. Guarded source-owned callable/unsafe forwarding must
keep the real original transaction receiver. Only original installed-driver
Promises/Query promises, not arbitrary thenables, supply these ports. Every
query rejection burns even if a nested consumer swallows it; after loss, prevent
late new source ports/publication. Observe callback/query settlement separately
from begin's outer connection-loss race. Successful begin must carry the exact
original callback outcome after its settlement, not an early/copied success.
Pin a fresh frozen private outcome envelope for every callback, including
preparation, missing/null data and capacity. At begin fulfillment, the original
callback must already have settled successfully and the returned envelope must
be that exact identity; eventual equality after waiting cannot repair early loss.
Keep original pending identities and occupied custody after loss; cleanup is not
callback settlement or physical backend-death proof.

Premark endStarted before any end-method lookup/invocation, retain its original
promise and call once with timeout1. Expected onclose after cleanup initiation
does not itself burn; unexpected close does. Publication/readiness requires
callback, every tracked query, original begin/commit and original end to settle
successfully, with no burn. Only an authentic source-branded capacity error is
converted inside callback to private no-data outcome; still final qualify and
commit/end, then emit capacity outside afterward without burning READY. Any
provider/qualification/cleanup failure overrides capacity and permanently refuses.
Recheck permanent refusal after execute fulfillment and immediately before
public data/capacity publication, even if original successful custody was cleared.
Busy refusal cannot clear or replace pending work. Fixed reader/duplicate/busy
errors hide provider details; data request/capacity errors retain source branding.
Source-fault tests must cover pre-port misuse, target/options/PG overrides,
all utility/qualification/data failures, swallowed/detached query rejection,
early outer loss with pending callback/query, commit/end faults, cleanup reentry,
normal onclose, pending end publication barrier, capacity recovery only after
settlement, and permanent no-reacquisition. Actual PG/facade/HTTP/entry remain open.

### Task4f.1e cold public facade nomination

File Map: db-pg.ts, tests/internal-production/dashboard-core-reader-facade-v2.test.ts
and its normal package pure-suite entry. No startup/router/UI file changes in
this unit. Reuse the already nominated zero-argument
prepareDashboardCutoverCoreReaderV2():Promise<void> and
readDashboardCoreResponseV2(request):Promise<unknown>; no new caller authority,
URL, SQL, callback, grant or driver controls. Alternatives of ordinary getSql/
pgMigrate reuse or calling the private constructor directly from routes are
rejected: the former requires absent intent and warms/migrates, the latter loses
db-pg cold history and captured configuration. Select one private facade control
record in db-pg around the existing lifecycle, not a replacement resource ledger.

Facade phases UNPREPARED/PREPARING/READY/REFUSED persist for this process. Apply
REFUSED first, PREPARING duplicate burns, READY duplicate nonburning before arity
or active-read inspection. Fresh selection snapshots prior ordinary refusal/use/
active observation and all DB state, then reserves PREPARING and the permanent
ordinary fence BEFORE arity, observer/configuration/import or await. Reject any
prior _sql, schema ready/promise, migration/verification, isolated URL or Task6A
latch/closing/nonzero epoch. Do not invoke ordinary assert or resolvePgUrl.
Require the existing fixed-root intent observer's exact OPEN state; recheck facade
revocation after this trusted composite. These labels do not prove writer drain
or a startup authority. Existing ordinary and public OPEN startup guards stay
byte-identical; readiness must never affect their decision.

Before the first await capture primitive raw process.env.SETFARM_PG_URL and an
own data runtimeConfig.setfarmPgUrl descriptor; reject proxy/accessor configuration
without traps/getters. Present raw URL must equal configured bytes exactly;
absent requires the literal existing source default
postgresql://postgres@localhost:5432/setfarm. Empty or whitespace-normalized raw
configuration does not qualify. Capture is permanent; future reads never revisit
mutable runtime configuration. The private lifecycle still validates the complete
target/PG environment and options; do not add another permissive URL parser.

Only after capture may a lazy private lifecycle import occur. Retain original
import/preparation promises, recheck revocation before constructor/preparation
and after their settlement. Register the exact returned owner immediately after
construction, BEFORE post-construction checks, so constructor reentry into close
revokes that returned owner without a new acquisition. Its source-owned refuse
port is premarked consumed BEFORE lookup/invocation, including throw/reentrant
pgClose, and is consumed at most once; original lifecycle owns end-once.
Unknown import/construction/preparation failure permanently refuses with fixed
DASHBOARD_CUTOVER_CORE_READER_REFUSED and retains occupied history; never
reacquire/reinitialize. Duplicate preparation uses the exact existing
DASHBOARD_CUTOVER_CORE_READER_DUPLICATE_PREPARATION_REFUSED error.

Public read in UNPREPARED selects permanent ordinary fence/refusal without caller
inspection/import. A PREPARING read burns that original reservation, retains
pending work and once-refuses any returned owner. REFUSED always uses the fixed
zero-port refusal. READY then checks DASHBOARD_CUTOVER_CORE_READER_BUSY BEFORE
caller controls.
Use actual closed request copy before idle-read reservation and pass only that
inert copy to the retained private owner. Extra public arguments are REQUEST
operation refusal. Retain its original read promise and recheck facade revocation
before any data/capacity escape. Only authentic source-branded REQUEST/CAPACITY
operation refusal remains nonburning; no queue/replacement. Unknown/lifecycle
failure (including any unexpected private BUSY) burns. Successful or nonburning
operation settlement releases only facade activity, never preparation history.

pgClose revokes a selected facade synchronously before existing ordinary/Task6A
cleanup, including when import or preparation is pending. It must not reset
selection, capture, pending originals or permanent fence. An untouched cold
process's no-resource pgClose does not itself select/warm a reader. Prior ordinary
attempt/configuration stays warm even after successful/failed close. The private
refuse port is synchronous void; pgClose completion does NOT attest its original
query/callback/BEGIN/end settlement or backend death. Existing original _sql.end
and migration-abort cleanup retain their original semantics.

RED before runtime authoring: absent/unknown/observer reentry; all independent
cold flags/warm history, original configuration/default/raw disagreement and
zero traps for accessor/proxy capture; no import/owner creation after refusal;
close during import/constructor/preparation/read, permanent after ordinary close;
duplicate/busy precedence, immutable captured bytes, original pending work and
post-await publication refusal. Source fixtures use inert lifecycle/config/
intent/provider ports, actual request/failure branding and no real database.
No actual PG, facade-consuming HTTP, schema-writer exclusion, build or startup
grant follows from this unit. Task5 and the existing startup refusal gates remain.

### Task4f.2 truthful UI failure nomination

File Map: server/index.html, tests/dashboard-http-availability-v2.test.ts and
the normal pure-suite entry. Current actual UI ignores HTTP status; observations
failure becomes [], failed import announces zero-count success and export downloads
the error body. These are causal presentation bugs for the approved restricted
reader, not permission to reopen any denied route. No daemon/CLI/DB guard changes.

Choose a checked transport plus explicit per-section unavailable state. A
transport-only throw leaves unhandled/swallowed failures and stale caches; replacing
failed responses with [] hides failed projects. Keep previously displayed data,
mark it unavailable/potentially stale using a textContent-only status element and
role=status, and clear that mark only on a successful fresh load. Rule filtering
must keep the unavailable marker when repainting cached rows. No server/private
error body is presented or parsed as a non-2xx successful DTO. Network and invalid
JSON failures use fixed messages. Successful empty data retains ordinary semantics.

Check HTTP status before JSON/blob/download and before mutation-success paths.
Catch workflow/runs/detail/stories/history/medic failures at their display owner;
startup, poll and onclick calls cannot leave rejected load promises unhandled.
Medic failure explicitly says unavailable, not unknown/not-installed. Preserve
existing successful payload/rendering/filter/terminal semantics and request methods.
Await save confirmation before closing its editor; rejected save/delete/import
must not reload or announce success. Rejected export has zero blob/objectURL/click
ports. Do not introduce retries or server queues. Explicit editor/download behavior
belongs to this UI unit, not an external signing/distribution action.

Events and observations are independent sources: denied events must not prevent
the allowed observations read. If either fails, show which source is unavailable;
do not silently promote legacy events to authoritative observations. Both failed
keeps prior activity with an unavailable marker, not an empty success. Successful
observation/event projection and superseded-observation semantics remain unchanged.
Capture current workflow/selected run and subpanel ownership before asynchronous
loads so an old response/error cannot repaint a newer selection. This narrow
display freshness check supplies no backend continuity or runtime ownership.
Keep per-section latest-issued token identity, not just selection equality:
older success must not clear a newer failure, and older failure must not mark
a newer successful snapshot unavailable. Capture workflow plus terminal-filter
state. Retained successful snapshots keep their original visible workflow/run/
filter label; if a different selection fails, the unavailable text names both
the requested view and the last displayed view. Cached A data must not appear
as B even with a generic stale warning. Tokens are presentation-only, no queue.
Recheck auto-selection tokens before/after every awaited workflow run probe.
New detail selection invalidates old stories/activity immediately, not only after
replacement detail succeeds. Expected top-level array DTOs must reject null/object
success-shaped JSON before empty/cache/paint. Rules rendering rejection restores
the prior cache and its display; this is client display validation, not backend
schema qualification. Qualify these exact reviewer-fault oracles before fixes.
Give save/delete/import/export separate action-outcome status owners, independent
of cached-rule GET tokens; a successful newer data refresh must not mask a denied
pending action. Successful action clears only its own warning. Scraper HTTP200
application failure uses a fixed message, not arbitrary result.error. Qualify
pending action -> successful rule GET -> action503 and application-error canaries.

Before production authoring, paired Node VM fixtures evaluate the actual entire
inline script with inert DOM/fetch/timer/download ports. RED exercises HTTP503
JSON/non-JSON without parsing, network/invalid JSON, each section's visible state,
success-empty recovery, both mixed activity outcomes, stale rules filtering,
mutation denial/editor preservation, zero failed-export download ports and delayed
selection mismatch. No live browser, database, listener or startup grant. Existing
reader and startup/source tests plus strict no-emit/contracts/material255 remain
the proportional source-delivery verification; actual HTTP/browser/Task5 stay open.

Actual listener startup does not initialize PG; DB HTTP paths use generic
pgMigrate and therefore are not qualified pre32 read-only reads. Before live
adapter admission, independently nominate a code-owned dashboard-only restrictive
pre32 reader: original per-complete-HTTP READ ONLY REPEATABLE READ transaction,
exact journal/cold catalog/required
structure, permanent latch and closed source-qualified read statement inventory.
No default-migration, role/credential changes, raw getSql/driver controls, SQL
prefix permission filter or Task6A rehearsal helper may supply this route.
Existing base verifier requires ownerReachable=false and full-head verifier is
not pre32; neither predicate may silently be relaxed. Any separate structural
reader profile must be explicitly source-qualified, never called owner proof.
Daemon prepares before PID/listen; unknown/mutation/unqualified read effects
refuse. Absent-intent ordinary behavior stays unchanged. The complete lifecycle,
actual-PG recipe and consuming-entry qualification remain pending. The explicitly
nominated internal source components above may be authored and reviewed; none
alone supplies reader-ready or startup authority.

### Retained ordinary-dashboard pre32 bridge nomination

Additional exports in baseline-legacy-database-census-v1.ts:
withHeldDashboardCutoverPre32DatabaseV2(databaseUrl, continuation) and
assertHeldDashboardCutoverPre32DatabaseV2(scope). This is a narrow read-only
transaction composition primitive, NOT adapter/owner/dispatch authority.
databaseUrl is consumed only by the privately agreed launcher provider in the
future authenticated bootstrap; no ambient URL, raw connection or caller SQL is
exposed. Existing public snapshot methods and V1 behavior stay unchanged.

Continuation is a trusted same-process nonproxy function, called once with an
empty frozen null-prototype WeakMap scope and frozen initial zero-owner census.
The original private READ COMMITTED READ ONLY transaction holds its fixed36
SHARE locks and exact source journal1..31 through the awaited callback. The
scope is valid only inside that callback. Assertion privately repeats exact
source journal and cold pre32 zero-owner census on the ORIGINAL connection;
at most32 explicit assertions. No later driver connection may replace it.
Exact asynchronous signatures: withHeld...(string|undefined,
(scope:object,census:LegacyDatabaseCensusV1)=>Promise<T>):Promise<T>;
assertHeld...(scope:object):Promise<void>. Assertion count is reserved before
await; assertion33 burns/refuses before query. Final internal recheck is separate.

One occupied invocation per module: reserve BEFORE first import/await/driver
acquisition, and retain through callback, transaction and client settlement.
Starting another during acquisition/live/settlement burns the original before
input handling. Reentrant assertions burn before any later query.
Foreign/stale scope at idle refuses without touching caller properties; query,
drift, callback failure or swallowed reentry makes the valid scope sticky-invalid.
Every resumed trusted composite read checks burn before another component read.
No claim of per-query abort inside unchanged legacy census/verifier helpers.
Scope revokes before callback return/throw escapes the transaction; no leaked
scope or returned census survives as live authority. The outer promise succeeds
only after existing sql.begin and sql.end settle. Existing end({timeout:1}) may
terminate local transport and is NOT backend-death or natural EOF certification;
unknown/failure never grants service authority or allows a later dispatch.
Track every admitted asynchronous assertion with a retained original promise.
If callback returns/throws with one still pending, revoke first, burn/refuse and
await that original work before callback may leave the transaction. Every resumed
trusted composite boundary checks live AND unburned before a further read. Never
retry a failed/pending query. On outer begin/transport rejection revoke before
awaiting end, even while callback is suspended (driver races callback vs close).
Retain unresolved callback/assertion custody in the burned module; no new entry.
No callback-return value or timeout discharges that pending custody. Fixtures
cover acquiring/settling nested entry, detached assertion return/throw/late
rejection, outer connection loss with suspended callback and late resumed check.

Source fault fixtures qualify callback-before-release, exact lock/journal order,
revoked/foreign handles, zero-owner drift, swallowed reentry, callback failure,
connection failure and transaction/end failure. They do not qualify an actual
PG backend or launcher credential. Actual private-PG and phase-V2 qualification
must precede consuming adapter admission. Original launcher idle predicates
remain unchanged; successful dashboard restoration needs a separately nominated
positive exact dashboard phase profile, not an idle exception or nativeS10.

A new V2 history namespace records these exact operations in order:

1. bootout-spawner
2. bootout-dashboard
3. drain-old-dashboard
4. select-new-cli
5. restore-dashboard-launcher
6. authenticate-new-dashboard

Each operation has a durable intent before dispatch, at most one dispatch attempt
in the live controller, and completion only after authoritative post-observation.
A pending intent stops later steps. Do not retry a possibly completed operation.
Recovery authenticates a new current owner and the exact physical partial state;
unknown/alive/reused prior owner refuses takeover. A recovery completion may bind
a different current completion owner, but must retain the original dispatch owner
and exact intent hash. History is NEVER ownership, exclusion or dispatch authority.
Later intents may name a different owner after the prior completion; all intents
share one cutoverIntentHash. This grammar permits historical recovery linkage,
not takeover authority. The live adapter separately proves the new owner and
prior-owner death; a completion's original owner must equal its original intent.

Legal completed outcomes: operations1/2 launcher-unloaded; operation3
original-process-exited OR already-absent; operation4 selector-selected;
operation5 launcher-restored; operation6 dashboard-authenticated.
Already-absent is NOT a death certificate and is allowed only from a positively
qualified held absence profile, not a caller boolean.

## Units and interfaces

V2 records module exports create/encode intent, create/encode completion and
parse history. Intent input:
`{cutoverIntentHash, ownerClaimHash, ordinal, previousCompletionHash,
beforeObservationHash}`. It derives fixed action, maximumDispatchCount1, schema,
purpose, self hash/ref. Ordinal1 requires previousCompletionHash null;2..6 SHA256.
Completion input:
`{intent, completionOwnerClaimHash, afterObservationHash, outcome}`.
It retains the original ownerClaimHash and binds the completion owner separately.
Strict canonical UTF8 bytes, exact own data fields, no proxies/accessors/symbols,
no sparse/oversized arrays, self hashes/refs and ordered linked prefixes required.
Empty, settled-prefix, unsettled and dashboard-recorded history are distinct.
Dashboard-recorded remains history-only, never READY or cutover completion.

### Exact Task1 wire

Purpose literal for both records: preserved-dashboard-cutover.
Intent schema: setfarm.internal-production-dashboard-cutover-effect-intent.v2.
Intent body has exactly schema,purpose,cutoverIntentHash,ownerClaimHash,ordinal,
previousCompletionHash,beforeObservationHash,action,maximumDispatchCount.
Append only effectIntentHash and effectIntentRef. Ref prefix:
setfarm://internal-production/dashboard-cutover-effect-intent/sha256/.
Completion schema:
setfarm.internal-production-dashboard-cutover-effect-completion.v2.
Completion body has exactly schema,purpose,effectIntentHash,cutoverIntentHash,
ownerClaimHash,completionOwnerClaimHash,ordinal,action,afterObservationHash,outcome.
Append only effectCompletionHash and effectCompletionRef. Ref prefix:
setfarm://internal-production/dashboard-cutover-effect-completion/sha256/.
Every hash is64 lowercase hex; maximumDispatchCount is the literal number1.
Self hash is SHA256 of canonical UTF8 body WITHOUT newline and WITHOUT self pair.
Wire is canonical UTF8 entire record followed by exactly one LF;1..65536 bytes.
Use the existing canonical-json primitive's UTF16 key order and scalar semantics.
Input arrays are dense ordinary arrays of canonical Buffer records, length0..6;
copy Buffer bytes without invoking overridden methods. Reject proxies/accessors,
symbol/extra/nonenumerable fields and sparse arrays before consuming their values.
Those field rules apply to records and array containers. Byte containers must be
genuine nonproxy bounded Buffers; extra Buffer properties are ignored, never read
or invoked. Intrinsic TypedArray operations supply their length and owned copy.
Buffer ancestry is checked without invoking proxy traps, with at most128
nonproxy intermediate prototypes; unknown/proxy/unbounded ancestry refuses.
Parser output has exactly schema,authority,historicalState,intents,completions.
Schema: setfarm.internal-production-dashboard-cutover-history.v2.
Authority: history-only. State: empty for0/0; unsettled for one unmatched final
intent; recorded-prefix for1..5 complete pairs; dashboard-recorded for6 pairs.
No other unmatched/successor ordering is legal. Output records/arrays/tree frozen.

V2 store exports observe, publish intent and publish completion with mandatory
expected store-observation hash. Fixed account-derived workspace authority:
data/internal-production-baseline/deployment-dashboard-cutover-v2.
Hold/recheck nofollow ancestors/files; owner/mode/device/count/size constraints,
exclusive temporary publication, fsync file and containing directories, immutable
committed links, checked-once closes. Preserve stages; unknown sync/close burns
future access. V1 grammar/store and every historical receipt remain unchanged.

### Exact Task2 storage nomination

Export observeDashboardCutoverStoreV2(), publishDashboardCutoverIntentV2(record,
expectedObservationHash), publishDashboardCutoverCompletionV2(record,
expectedObservationHash). The expected hash is mandatory64 lowercase hex, never
an authority grant. Namespace is deployment-dashboard-cutover-v2 under the fixed
account-derived baseline root. Ordered names alternate intent-0001.json,
completion-0001.json through intent-0006.json,completion-0006.json; no gaps.
Committed bytes use Task1 encoders. Every committed inode retains exactly one
same-inode UUIDv4 temporary alias and nlink2. Stages use
.<fixed-name>.<lowercase-UUIDv4>.tmp; no stage unlink or replacement publication.
Unknown names, more than32 names or more than8 inert stages refuse. An inert
stage is observational needs-reconciliation and blocks every publication.

Return exact frozen observation fields: schema,authority,storageState,
rootIdentityHash,ancestorIdentityHash,pendingStageCount,files,history,
storeObservationHash. Schema: setfarm.internal-production-dashboard-cutover-store.v2;
authority history-only; storageState settled or needs-reconciliation. Missing
root is observed without creation and has rootIdentityHash null. History is the
Task1 frozen parser output. Sorted frozen file entries contain exactly name,
identityHash,bytesHash,byteLength,kind. Kind: committed for fixed names;
inert-stage for nlink1 temporaries; committed-alias for qualified nlink2 aliases.
Identity projections match the existing V1 store: directory dev,ino,mode,uid,gid,
birthtimeNs; file adds size,nlink,mtimeNs,ctimeNs. SHA256 bytesHash hashes raw bytes;
other hashes use canonical-json bodies without self hash. Ancestor hash binds
every held ancestor path/identity, including the baseline parent but not root.
Unknown sync/close makes access sticky-invalid in that module instance. A fresh
instance must reobserve exact physical evidence; no automatic physical-effect
retry. Exact existing record publication may durably resync without changing its
inode. Storage has no dispatch/exclusion/recovery-owner authority.
Reuse the existing baseline-deployment-cutover-service-effect-store-v1.ts entire
physical guard and bracket/recheck profile, except namespace, grammar, order and
counts: at most128 lexical ancestor segments; existing workspace/data/baseline
required, same owner UID/device and no group/other writable scope directories;
root0700, regular files0600, nofollow, bounded0..65536 byte stages and1..65536
canonical committed records; same original ancestor/file descriptors/identities
through publication and checked-once closes. Missing baseline is invalid, not an
instruction to create the workspace. A missing V2 root alone may be created only
for first intent with the matching observed missing-root hash.

Controller exports a run/reconcile operation consuming a LIVE opaque capability
from the qualified adapter, not inspection JSON or permission booleans. It owns
serial state, intent-before-dispatch, exact action selection, once-only attempts,
post-observation-before-completion and rechecks through all await boundaries.
No port/result/hash alone grants authority. Reentry/failed owner recheck burns
the controller and stops later operations while preserving journal evidence.
Its exact capability-authentication contract must be independently nominated
before Task3 production authoring. Fixture ports cannot supply that proof.

Production adapter composes existing authenticated source/build, selector,
launcher, passive process, helper/phase and positive physical+DB observations.
It must hold cross-process direct/cold producer serialization in addition to
ordinary-spawner refusal; ordinary refusal does not cover authenticated routes.
Drain every exact loaded old family and queued contender. Reboot requiesces and
reauthenticates launchers; bootout alone is not reboot-persistent exclusion.
The threat model is cooperative platform entrypoints, explicitly NOT a same-user
actor deliberately launching retired executables. Do not import the broader
archive-erasure adversary into this approved preserved route.

Phase V2 separately enumerates controller/fence/journal resources and permitted
exact dashboard targets; unrelated runtime owners stay zero. Authenticate
delivered producer presence; do not turn old absence profiles or total-owner-zero
claims into exceptions. A preflight snapshot is not the live exclusion capability.

### Task4a prospective serialization primitive (not complete effect admission)

Add scripts/deployment-dashboard-cutover-serialization-v2.mjs and matching
scripts/__tests__/deployment-dashboard-cutover-serialization-v2.test.js.
This primitive supplies only an authentic original-process-owned reservation
against FUTURE cooperating direct/cold acquisitions, never owner-claim, DB,
stale-contender quiescence, service-effect or READY authority. The complete adapter
must separately authenticate the existing owner handle, physical+DB inventory,
already-entered stale cleanup/helper/queued-contender drain and source/build.
Do not begin Task3 authoring or any live call from this component alone.

Proposed exports acquireDashboardCutoverSerializationV2(input),
assertDashboardCutoverSerializationV2(handle), releaseDashboardCutoverSerializationV2(handle).
Input exactly {cutoverIntentHash,ownerClaimHash}, both64 lowercase hex; those
labels alone grant nothing. Input is copied from a nonproxy Object.prototype
plain record with exactly those own enumerable data properties. Reject proxies,
accessors, symbols, nonenumerable/extra fields and malformed hashes before any
observer/FS work or acquisition-attempt consumption. Invalid idle input does not
consume the attempt. An already-active operation always detects and burns reentry
before further caller-input handling. Handle is a frozen empty null-prototype object in a
private WeakMap. Copy/proxy/foreign/released handles refuse without caller code.
At most one acquisition attempt per module instance; EEXIST always refuses,
including dead/malformed locks. No V1 repair/reclaim/genesis/epoch APIs are used.

Account-derived path is the existing data/internal-production-baseline/
restart-authority-retirement-v1/physical-service-restart-authority.transition.lock.
Existing workspace/data/baseline required; at most128 held nofollow ancestors,
same owner UID/device for scope directories, no group/other writable scope.
Retirement parent0700 may be exclusively created and parent-fsynced; existing
parent must authenticate. Do not create an epoch, genesis, helper or service.
Original lock is exclusively created nofollow0600/nlink1, held in an immediate
resource ledger, written/readback/fsynced with original ancestry brackets and
parent directory sync BEFORE minting a handle. Setup failure preserves the lock;
there is no repair unlink. Retained original-resource state must remain reachable
after unknown results; never retry uncertain close or begin another acquisition.

Wire body exactly schema,purpose,cutoverIntentHash,ownerClaimHash,owner;
schema setfarm.internal-production-dashboard-cutover-serialization-lock.v2;
purpose preserved-dashboard-cutover. Owner is the existing authentic maintenance
observer tuple uid,pid,processLstart,processGroupId,bootSessionHash,reservationNonce,
observed for the actual current process, with code-minted UUIDv4 nonce. Append
only lockHash = existing canonical-json-compatible SHA256 body without LF.
Wire canonical UTF8 entire record plus one LF, bounded1..65536 bytes. Reuse actual
build-generation-maintenance-owner-observer.mjs and its journal normalizer; both
belong to the eventual authenticated entry closure. No injected observer ports.

Assertion rechecks original owner live_match, same account, original ancestor
descriptors/paths and complete original lock bytes/identity. Any failed held
assertion permanently burns this handle/module. Release is a reservation-resource
operation only: live original owner and exact original lock must still match;
premark unlink, parent-sync and each close attempt, check original unlinked inode
transition, and never retry an unknown result. It grants no effect settlement;
the future complete adapter must not release it while any effect/owner remains
unsettled or stale cleanup is unqualified. No generic finally release in controller.

Operation FSM: idle -> acquiring -> held -> releasing -> released; any uncertain
operation or held-assertion drift -> burned. active is set before all external
observations/ports; nested acquire/assert/release burns the current operation,
even when a test fault boundary swallows the nested exception. Every resumed
operation checks the original FSM/active owner before its next port. Foreign
idle handle lookup refuses without touching caller fields or burning an unrelated
valid held handle. Burned/unsealed handles cannot enter normal release.

The existing synchronous maintenance-observer call is one read-only component
port: its internal four OS queries finish as a bracket; this primitive checks
burn on its return, not between those trusted helper queries. No later component
port or mutation is allowed after a swallowed reentry. Per-query helper abort is
not claimed by these tests or this reservation contract.

Acquisition brackets actual owner observation with full physical rechecks once
originals exist. Immediately before handle mint, repeat actual owner live_match
and original physical checks; no pending sync/close may remain. Release similarly
performs owner+physical+owner+physical checks before its FIRST unlink. After an
owned unlink, only the retained original inode may explain nlink1 -> nlink0;
never authenticate or remove a later pathname owner as cleanup.

Resource slots are registered immediately upon each returned FD, BEFORE first
fallible fstat. States unsealed -> sealed -> close-attempted -> close-settled;
throwing close consumes its attempt and remains close-unknown. Store original
identity, returned FD and close-state in a retained module-owned vault even when
no handle was minted. Unsealed identity cannot authorize unlink or close. On
setup failure preserve every created pathname and prohibit repair unlink; once-
close only definitely owned sealed untouched FD slots, checking retained-original
descriptor identity, not mutable pathname. Unknown/unsealed slots remain reachable.

Release ordering: premark unlink -> unlink -> original inode transition check ->
premark parent-sync -> fsync parent -> once-close lock then ancestors in reverse.
An unlink/sync/close error marks its attempt unknown, stops later release ports,
burns the module and never publishes released state. A separate bounded failure
cleanup may once-close OTHER definitely-owned sealed untouched originals only;
it never repeats an attempted/unknown slot, unlinks, syncs or reacquires. A failed
cleanup identity check preserves that original without a close. Continue checking
other distinct owned originals; never convert uncertainty into release authority.
Normal successful release retires WeakMap custody only after ALL original slots
are definitely settled. No unknown result reopens release/acquisition admission.

The V2 schema blocks newly entered V1 reclaim before owner observation/unlink,
including after V2 owner death/reboot. It cannot stop an already-entered V1
reclaimer paused after final lstat and before unlink. Fixture tests must preserve
that interleaving as a negative admission case; O_EXCL/schema alone never proves
the complete frozen-owner contract. Separately authenticated old-family drain is
still a prerequisite for live adapter admission and release.

### Task4a.1 held empty-retirement-history assertion

The old absent-helper holder rejects the retirement root itself; it cannot
coexist with our original reservation. For the initially empty-history route,
add assertDashboardCutoverEmptyRetirementHistoryV2(handle) to the same V2 module.
It consumes ONLY its authentic privately held serialization handle and returns
void. No caller paths, labels, ports, snapshot object or separate authority token.
It reuses original root/lock/ancestry custody; no additional component-owned
returned FD is acquired. Read-only observer/readdir provider internals may own
encapsulated resources; this leaf adds no fs.openSync acquisition or ledger slot.

Operation sequence: authentic lookup/active entry; actual owner + physical;
capture original-held and named root FULL metadata (CORE plus size,nlink,mtimeNs,
ctimeNs); root readdir; exact single member physical-service-restart-authority.transition.lock;
physical + actual owner; second exact readdir + physical; require original-held
and named root FULL metadata still equal that same first witness. No repinning
across the owner/metadata bracket. Existing directory CORE checks alone do not
prove membership continuity. Enumeration must be an exact nonproxy dense plain
array with only its one string element and length; no accessor/proxy traps.
Each component port
uses the same post-return burn check. Success leaves the original handle held;
any unknown/malformed/drifting member result or observer/physical fault burns
and once-drains only known original sealed descriptors, preserving path evidence.
Reentry and foreign handles have the existing strict disposition.

Any other retirement-root child, including symlinks, unheaded registry artifacts,
partial stages, cold/direct history or epoch metadata, refuses without parsing,
following, deleting or repairing it. This route does NOT accept settled history:
a later retained settled-history graph requires its own nomination. The exact
one-member graph proves only absent subordinate helper/retirement history at
these live assertion boundaries, not process absence or freedom from a paused
old unlinker. Already-entered stale helpers/no-FD queued callers, physical+DB
owners, delivered source/phase graph and effect admission remain separate gates.
Do not call the old census or introduce a wrapper around its absent-root guard.

Owned real-FS tests must assert successful void/no-new-FD behavior and continued
held reservation, refusal/preservation for unheaded registry/cold/direct/staging/
unknown/symlink entries, actual owner-boundary member drift, swallowed readdir
reentry, transient add/remove detected by FULL metadata, malformed enumeration,
and foreign-handle no-burn. Genuine missing-export RED precedes source.
This is a causal refinement of Task4a, not the complete Task4b contender holder.

### Task4b.0 direct per-process root-FD diagnostic provider

Create scripts/deployment-dashboard-cutover-root-fds-v2.py and matching builtin
script test. This is a bounded read-only provider, NOT the complete contender
holder, process enumeration, quiescence, alias/fileport census or permission to
operate services. Do not add a live entry or Task3 capability from this unit.

The Apple published proc_listpidspath wrapper skips per-process errors as well
as nonmatches; parent/self positive witnesses cannot cure that omission. Avoid
that wrapper. Use direct typed libproc proc_pidinfo/PROC_PIDLISTFDS and
proc_pidfdinfo/PROC_PIDFDVNODEINFO, propagating EVERY query error or short result.
Reference: https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/libsyscall/wrappers/libproc/proc_listpidspath.c
Published source is not a verified version match to this installed26.5.2 host.
Installed SDK labels these private/version-sensitive APIs; fixture qualification
does not confer account-wide completeness or atomicity.

Fresh provider runs only via trusted /usr/bin/python3 -I -S -B, cwd/, sanitized
environment, no compile/build/deployment or library substitution. Maximum wire
size65536 bytes; read at most65537 bytes for overflow detection and require EOF
before ANY native query. Require exact canonical JSON+LF; request exactly schema,rootDev,
rootIno,pids. Schema setfarm.dashboard-cutover-root-fd-request.v2. Device/inode
are canonical positive decimal strings fitting uint32/uint64. PIDs are a dense
sorted unique list1..64 of positive int32 PIDs, including the ACTUAL parent PID.
Account UID/GID, observer/parent PIDs are OS-derived, never requested labels.
Root labels grant nothing; parent must itself supply at least one matching
directory FD as an actual positive fixture/provider witness.

Fixed-width SDK-derived ctypes structures: BSD136 (start offset120), FD8,
fileinfo24, vinfo_stat136, vnode_info152, vnode_fdinfo176. Assert sizes/alignment/
critical offsets before querying. Load ONLY /usr/lib/libSystem.B.dylib using
ctypes.CDLL(use_errno=True). proc_pidinfo argtypes are c_int,c_int,c_uint64,
c_void_p,c_int; proc_pidfdinfo argtypes c_int,c_int,c_int,c_void_p,c_int;
both restype c_int. Flavors: BSD3, FD list1, vnode FD1. BSD UID/GID offsets20/24,
PGID100/start120; FD type4; stat dev0/mode4/nlink6/ino8/uid16/gid20;
vnode type136/fsid144; vnode_fdinfo pvi24. Alignment BSD/stat/vnode/fileinfo8,
FD4. Clear/read errno at every typed call. Max4096
FD slots per requested PID; reject zero/short/misaligned/saturated results,
duplicate/negative FD numbers, unsupported descriptor types and ambiguous/dead/
foreign-account process metadata. Accept only BSD status2/3/4 (runnable,
sleeping/stopped), no INEXIT flag4, positive PID/PPID/PGID/startSeconds,
startMicroseconds<1000000; effective/real/saved UID and GID must all equal actual
observer UID/GID. BSD xstatus must be0. Descriptor types exactly vnode1 or
known nonvnode {0,2,3,4,5,6,7,9,10,11}; unknown8/other refuse. Max16384 aggregate
FD entries across requested PIDs, canonical output at most1048576 bytes, checked
before stdout. Known nonvnode FD types are outside this
explicit FD-only report; fileports/CWD/mappings/deleted-path coverage is NOT
claimed. Vnode records must be exact-sized; used dev/ino must be positive,
vnode types1..7 must agree with stat file-kind bits (regular,directory,block,
character,symlink,socket,FIFO respectively). Unused reserved fields confer no
proof. Never silently
drop a revoked/vanished/inaccessible vnode or process.

For each requested PID: actual BSD identity -> FD list -> every vnode detail ->
repeat all matched-root vnode details -> second FD list -> second BSD identity.
Repeated matches must retain exactly {fd,dev,ino,mode,uid,gid,nlink}; no union of
historical matches. Require unchanged PID/account/parent/group/
start tuple and unchanged FD-number/type vector. Root matches bind dev/inode and
directory mode from those actual vnode records, including directory vnode type2
and actual account UID. This supplies two bracketed samples, not mutation-free global
continuity. No signal, close of another process's FD, repair, acquire or service
call. The provider owns no extra returned root FD; requested processes keep their
originals. Fresh child must exit naturally with exact stdout/stderr dispositions.

Return exact canonical JSON+LF with schema,authority,coverage,uid,gid,observerPid,
parentPid,rootDev,rootIno,processes. Schema setfarm.dashboard-cutover-root-fd-diagnostic.v2;
authority diagnostic-only; coverage requested-process-vnode-fds. Process entries
exactly pid,ppid,uid,gid,pgid,startSeconds,startMicroseconds,fds,rootFds. fds is the
sorted list of {fd,type}; rootFds sorted {fd,dev,ino,mode,uid,gid,nlink}, dev/ino
decimal strings. No zero-owner, complete, permission or authority-derived flag.
On any input/query/validation uncertainty stdout empty/nonzero natural exit and
fixed refusal stderr. Publication/transport failure may leave bytes but must
refuse; a parent may accept ONLY full canonical bounded stdout, empty stderr,
zero natural exit and both error-free EOFs. Never accept a partial usable report.
Parent transport/future capability remains
separately nominated and must deeply freeze/recheck this diagnostic.

Real owned fixtures qualify actual parent/root FD, foreign child root FD,
inherited/duplicated FD, neighbour inode, renamed-but-held original and natural
holder exit. Include strict wire/field/count refusal and actual exited-PID query
refusal. No backend/OS policy stubs or live authority roots. Missing-provider
RED precedes production; native read-only recipe is new, not a replay of any S10
sample. Unsupported platform/provider behavior refuses; platform skips outside
Darwin are not host qualification. Keep all private fixtures/evidence retained.

Exact new fixture recipe: env-i PATH=/usr/bin:/bin LANG=C LC_ALL=C fixed installed
Node26.4.0 --test scripts/__tests__/deployment-dashboard-cutover-root-fds-v2.test.js.
Nine sequential retained private mkdtemp roots, one parent original/root; six
actual holders across cases (five Node, one isolated Python), at most one
concurrently. One case inherits FD3 and uses actual os.dup(3) as a second
descriptor; a failed /dev/fd/3 setup attempt is retained, not qualified as RED.
Use bigint inode/device witnesses.
Each Python query receives closed bounded stdin; capture at most1MiB total output
and require natural process close, explicit stdout/stderr EOF and no stream
errors within10s. No signal/retry on timeout; preserve unknown original custody.
Each holder receives stdin EOF once, memoized natural close/EOF settlement;
parent original closes checked-once only after all holder observations settle.
Incremental holder output parsing is bounded before buffering complete lines.
Register every returned original before first fallible fstat; failed sealing
retains it. Root/fixture paths remain intact. RED has source absent, hence zero
libproc calls; separately review exact source bytes before native-query GREEN.

The bootstrap authenticates the complete delivered source/build/loader closure
before constructing the adapter. Closed explicit modes; no ambient opt-in that
grants authority. Existing inspection entry remains diagnostic. A new real
activation command requires all adapter and crash qualifications first.

### Task4b.1 sampled account-cohort diagnostic nomination

Create scripts/deployment-dashboard-cutover-account-cohort-v2.py and matching
builtin test. Causally needed because actual read-only ps sampled432 own-account
rows; the qualified64-request FD interface must never truncate a producer roster
or be silently widened/batched into an absence certificate. This unit discovers
sampled account metadata only, NOT complete producer membership, root-reference
absence, ownership classification, death authority or live admission.

Use the same literal Python isolation/environment/cwd and bounded stdin/EOF,
canonical-output/natural-exit/full-EOF transport contract as Task4b.0. Request
exactly {schema}, schema setfarm.dashboard-cutover-account-cohort-request.v2;
no caller UID/PIDs/flavor/cap/path/policy. Import the adjacent literal
deployment-dashboard-cutover-root-fds-v2.py via importlib.util only after strict
request validation, reusing its immutable canonical codec, typed ABI/native
provider and direct-query wrapper. This source dependency belongs to eventual
authenticated loader closure; an ordinary diagnostic import grants no authority.
Do not modify its qualified64-request source/test or any source inventory yet.

OS-derived real/effective UID/GID must agree for the observer. Fixed libSystem
proc_listpids argtypes c_uint32,c_uint32,c_void_p,c_int, restype c_int; flavor4
PROC_UID_ONLY, actual UID, fixed1025-slot int32 buffer. Return is BYTES, not PID
count. Clear/read errno, refuse zero/error/nonmultiple/overflow, accept1..1024
positive unique int32 PIDs sorted. Require actual observer and parent present.
No NULL-buffer count estimate, retry, dynamic growth, caller scope or truncation.
Published Apple kernel source filters current effective UID, skips shadow/NOCRED
rows, includes zombie list and can stop at internal capacity. This is NOT an
installed-host equivalence proof or completeness guarantee. Report sampled only.
Reference: https://raw.githubusercontent.com/apple-oss-distributions/xnu/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/bsd/kern/proc_info.c

Exact sequence: first UID PID list -> first BSD metadata for EVERY listed PID ->
second UID PID list -> second BSD metadata for EVERY same PID. Sorted PID sets
must equal; all direct BSD queries exact136 bytes/error-free. Require actual PID,
effective UID equals observer account, positive startSeconds at most2^53-1 and
startMicroseconds<1000000, known status2/3/4/5. Live-status2/3/4 requires positive
PPID/PGID; status5 may have0. Every effective/real/saved UID/GID is reported from
actual uint32 fields, not a label; do not silently discard foreign saved/real
identities, zombie or exiting metadata as a nonmatch. Source predicates preserve
uncertainty rather than turn those values into permissions. Pair identity tuple
pid,ppid,uid,gid,ruid,rgid,savedUid,savedGid,pgid,startSeconds,startMicroseconds must
equal. Status/inExit/exitStatus may change and both samples are reported, never
converted into death/owner evidence. Any PID loss/reuse/account/birth change,
unknown metadata or query uncertainty refuses WHOLE report before publication.
Recheck observer UID/GID and parent after the final sample.

Output exact schema,authority,coverage,uid,gid,observerPid,parentPid,processes.
Schema setfarm.dashboard-cutover-account-cohort-diagnostic.v2; authority
diagnostic-only; coverage sampled-effective-uid-process-metadata. Each sorted
process entry exactly {first,last}; each metadata sample exactly the eleven
identity fields above plus status,inExit,exitStatus. inExit is actual flags bit4
as a boolean; all other fields integers. No complete/quiescent/alive/dead/owner/
permission field. Max1024 process pairs/2050 native queries/1MiB output, checked
before stdout. No FD/vnode query, returned original FD, signal, service, PG or
filesystem mutation from this provider. Equal samples do not prove continuity;
different-state samples remain diagnostic. Actual entry/exclusion composition
with source/ROOT/FS+PG holders must be separately nominated and reviewed.

New fixture recipe, separately actual-byte reviewed before execution: fixedNode
env-i --test matching test file, fresh naturally settled Node holder(s) with
closed bounded inputs. A successful actual UID-query report must include real
observer/parent/owned-holder identities, exact canonical fields/counts and two
account/birth samples. Invalid/oversized wire must refuse before native queries;
natural holder exit may only be compared diagnostically, not certify death.
Queries read the actual observer's UID cohort (potentially unrelated own-account
process metadata), not only fixture PIDs; no target state is mutated. Churn,
unavailable provider or setup/transport failure is unqualified, never an accepted
substitute for expected success. No mocks of OS/backend policy and no accepted
S10 recipe replay. Genuine missing-provider RED precedes this source.

### Task4f.3 terminal restricted HTTP dispatcher nomination

File Map: new server/dashboard-core-readonly-http-v2.ts, shared
server/dashboard-core-static-v2.ts, tests/dashboard-core-readonly-http-v2.test.ts,
package.json normal pure-suite registration;
dashboard.ts imports the shared ordinary loaders and pure rule merge/filter.
No daemon, CLI, public startup guard, preparation, listener or SQL changes.

Choose a terminal all-request handler with a literal actual facade import, not
a legacy-handler mode or caller-supplied reader. Every request is handled without
an unhandled/next/fallback return; end/destroy is attempted at most once each.
Pending reads retain custody without a completion guarantee. End invocation is
not transport finish or client receipt. Only GET:
root, exact logo and GeistPixel font, workflows, runs, single literal-segment run,
stories, observations, rules and rules/export. All other methods/paths are503
with fixed unavailable JSON, zero body/token/legacy/reader/material ports.
No absolute-form target, fragment, backslash, whitespace/control, malformed
percent/UTF8 or dot-segment alias. Target limit16384 UTF8 bytes before parsing.
Classify raw pathname without URL normalization; validate percent sequences but
keep IDs percent-encoded, preserving ordinary literal lookup. Raw whitespace and
backslash refuse; decoded query spaces remain legal (normal rule search).
Decoded NUL/control/invalidUTF8 and encoded dot-segment aliases refuse. Query uses
URLSearchParams first values; empty workflow is omitted; include_terminal accepts
case-insensitive1/true/yes/on. IDs/workflow remain bounded by actual facade copy.

Share existing category/scope/workflow projection and rule merge/filter, retaining
ordinary best-effort loader semantics through separate ordinary exports.
Restricted required loaders require source-owned membership: five workflow files
bug-fix/daily-standup/feature-dev/security-audit/ui-refactor workflow.yml, and all
current20 fragment plus12 reference markdown basenames listed literally in the
shared module. Directories may include extra material but cannot omit that set;
_fragments is not a workflow. Missing directory/file/required member or corruption
refuses the whole response; no partial/empty substitution. Validate workflow id/name and
step id/agent as strings. Required markdown reads are fixed bundled directories.
Rules: system before custom, enabled boolean coercion, readonly false for custom,
existing five filters. Export ignores query filters, wraps version1/exportedAt/
rules with indent2 and existing attachment name. Missing run is404 fixed JSON.

Serialize the complete final JSON once, enforce4MiB UTF8 after merge/filter/export
and before headers; static bytes obey same cap and must be nonempty; HTML must
UTF8-roundtrip without replacement. Binary asset authenticity remains Task5's
source inventory obligation, not a MIME-signature inference. Publish exact staged bytes with
Content-Length and fixed Content-Type/CORS, never raw error detail. Any source,
facade, capacity or serialization failure is503 unavailable, no partial success.
Install nonthrowing response error/close observers before first await; normal
IncomingMessage close is not a client-loss signal. Async transport error/client
loss retains original pending work. Transport already unusable gets no publication;
post-header synchronous failure
destroys original response, never second JSON. Original facade promise remains
awaited after client loss; no cancel/close/replacement/retry or custody release.
No atomic-network-delivery or client-receipt claim.

First qualification executes actual handler/catalog with inert loader facade and
filesystem/transport boundaries only: exact mapping, denied zero ports, populated
and empty success, missing404, filters/export, required material fault, UTF8 caps,
late read/client loss, framing and write failure. This is source-adapter evidence,
not integrated facade/PG, actual socket/browser/startup or Task5 authority. Later
qualified composition and authenticated entry remain mandatory.

## Verification / delivery / deployment

TDD covers real record parsing, real private filesystem publication, actual
controller ordering and preserved unknown states. Mock only OS/launchd effect
boundaries for finite unit tests; they cannot qualify a live adapter. Qualification
uses owned fixtures, never invokes live launchers through tests and never replays
accepted native recipes. Compile/noemit, old affected suites, source inventories,
English/path/version and independent review precede delivery.

New deployment for a NEW delivered controller revision may follow approved
September16 step1 after separate preservation/budget review. This is not another
build of accepted eight-cap ae5 candidate and not a failed-build retry shortcut.
All old deployments/archives remain intact. No build/candidate rotation is
authorized merely by this development document.

Live step5 requires actual new process birth/executable/source/build, listener3333
and HTTP identity. Preserve MC3080/gateway18789. Leave durable ordinary-spawner
refusal open; do NOT publish final completion or claim Task6A/P2/full recovery.

## File Map

Create paired spec/plan2026-10-07-preserved-dashboard-cutover-v2.
Create src/internal-production/baseline-dashboard-cutover-records-v2.ts and test.
Create baseline-dashboard-cutover-store-v2.ts and test in those same directories.
Create baseline-dashboard-cutover-controller-v2.ts and test.
Create scripts/deployment-dashboard-cutover-adapter-v2.mjs and builtin script test.
Create scripts/deployment-dashboard-cutover-serialization-v2.mjs and builtin test
as the separately reviewed Task4a reservation primitive; include both existing
maintenance observer/normalizer scripts in the eventual authenticated closure.
Create scripts/deployment-dashboard-cutover-root-fds-v2.py and matching builtin
script test as a separately qualified diagnostic-only provider; not an entry gate.
Create scripts/deployment-dashboard-cutover-account-cohort-v2.py and matching
builtin test as sampled UID metadata only; no full roster/exclusion authority.
Create scripts/deployment-dashboard-cutover-v2.mjs and builtin entry test.
Update applicable approved source inventories/manifest tests and affected package
test commands only when adding the actual consuming production unit. Record those
exact updates before that task; do not weaken source authentication.
No changes to PR275, native modules or existing accepted recipes.
