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

### Task4f.4 whole-reader owned HTTP qualification nomination

This is the next bounded qualification, not another authority helper. File Map:
tests/internal-production/dashboard-core-http-composition-v2.test.ts,
tests/helpers/dashboard-core-http-fixture-v2.ts and package.json normal pure suite.
No production change initially; failures require paired fault nomination before
the smallest corrective source change. Current source delivery0404c766/PR280
exact-head GitGuardianSUCCESS04:23:35UTC, OPEN DRAFT; no review approval inferred.

Run actual handler/public facade/private reader/profile/qualification/response/
projection, actual pre32 journal and census validators. Only fixed exact
runtime-config, intent observer and postgres package are test-loader substitutions.
Intent is explicitly inert OPEN, not a real account/root/exclusion qualification;
configuration is an explicit public test identity, not installed launcher material.
No other import replacement. Source-derived journal identities are actual source
contract inputs; independent metadata fixture remains the prior hand-written
104 columns/5 relations/5 builtin PK indexes, never production-derived catalog.

Data must agree with zero active-owner census: populated historical failed/
completed runs, parent-matched steps/stories/observations/custom rules only.
Default active run list may be genuinely empty; include_terminal=1 reveals
preserved failed cards. Never combine running rows with activeRunCount zero.
Actual census thirteen normalized zeros and source journal1..31/applied26..31/
cold32 checks remain real. Any unknown SQL/fresh port refuses the fixture.
Trace literal statements/parameters, receiver and original transaction identities.
Preparation24 statements; each read24 qualification/utility plus closed data
budget; BEGIN/COMMIT/end counted separately. No migration/schema/runtime writer.

One fresh child per sticky scenario. Fresh child owns at most one server on
127.0.0.1 with OS-assigned ephemeral port; never3333/3080/18789 or startDashboard.
Server is fixture transport only, no production startup proof. Own/register every
accepted socket, handler promise and original inert provider promise before
await. At most2 simultaneous clients for BUSY; otherwise one one-shot client.
No retry/queue. Capture whole HTTP bytes with fixed4MiB-plus-error/header bound,
complete client framing and closed status/content-length/DTO expectations.

Qualify populated routes/rules/export and honest empty data; preparation and
original read callback/qual/commit/end must settle before200. Separate original
query/finalqualification/commit/end barriers; BUSY503 must add zero provider
clients or statements and not burn original success. Client disconnect/error
does not pgClose/cancel/reconstruct/release pending reader; settle actual modeled
originals afterward, then later request succeeds only if lifecycle still valid.
Provider failure/end rejection gives fixed503/sticky future refusal, no retry.
Early outer BEGIN loss may complete HTTP503 while callback/query stays privately
occupied; fixture retains and settles them before claiming its own closure.
No HTTP-finish-as-provider/backend-death inference.

Finally release only owned barriers, await every original callback/query/begin/
end/handler, close original client/server sockets and await server close. A
bounded watchdog may fail the fixture, not certify cancellation/settlement.
Do not kill other processes, signal live services or delete preserved resources.
Unexpected unresolved work is unqualified; output only public fixture traces.
Real installed PostgreSQL, source/build/schema-writer exclusion, full adapter/
controller/authenticated entry and live checkpoint remain independent required
gates. Ordinary OPEN startup/spawner guards stay unchanged.

Exact first invocation recipe: eight serialized fresh child scenarios success,
query, final-qualification, commit, end, disconnect, end-rejection, early-loss.
One new ephemeral loopback server per child; separate original client/server
socket groups assert peaks<=2, each completed request waits its own socket close.
HTTP capture4MiB+16384 bytes, child stdout/stderr1MiB;12s unref watchdog and20s
spawn timeout are unqualified failure only. Real res.complete and Content-Length
must match whole JSON. No accepted native recipe or host launcher invocation.
Preparation/listen acquisition lives inside cleanup custody. Cleanup attempts
independent stages despite earlier failure; original-provider ledger drains to
stable settlement (100 rounds/10000 retained originals ceiling), waits original
handlers/clients and rechecks provider ledger before claiming closure. Fixture
guard errors remain separately sticky outside actual reader503 translation;
all scenarios assert none. End-rejection additionally requires26 statements,
two qualification cycles and successful original callback/commit before its
intentional end failure. Required fresh actual255 gate precedes first invocation.

### Task4f.5 installed private reader / held-launcher diagnostic

Causal prerequisite: the whole-reader owned HTTP fixture uses inert PostgreSQL;
actual provider decoding/lazy Query/BEGIN/end compatibility is still unqualified.
File Map: baseline-deployment-cutover-launcher-observation-v1.ts, existing
baseline-dashboard-cutover-launcher-material-v2.test.ts and normal pure suite.
Add one closed qualifyHeldDashboardCutoverCoreReaderV2(genuineMaterialHandle)
operation. No caller URL/request/SQL/callback/provider/configuration/report.
Private agreed URL from both original held plists goes directly to actual private
reader constructor. This qualifies held-launcher target only, NOT runtimeConfig
or public facade target equality. Do not import runtime-config/env-file loader.

Acquire existing material under unchanged account/FD/loaded-idle predicates;
never stop a launcher to obtain a diagnostic. Consume one lifetime attempt and
reserve active material before import/await. Register original deferred work
before invocation; retain actual import/reader/prepare/read originals privately.
Existing reentry/close/other material operations burn the active original. Check
account/material/PG overrides at each boundary. Actual private reader prepare,
then fixed {kind:rules} only. Two sequential max1 clients, existing RR READ ONLY,
ACCESS SHARE five tables and timeout/end semantics: planned24+25 application
statements. Provider-internal traffic is not relabelled as counted. No outer
36-SHARE nesting: queued ACCESS EXCLUSIVE writer can introduce a wait cycle.
This diagnostic does not supply continuous schema-writer exclusion.

Success requires both actual reader operations and final material checks, then
once-only idle-reader refusal and a frozen count-only diagnostic: schema,
authority diagnostic-only, target held-launcher, plannedApplicationStatements49,
preparation/read transaction budget1 each and rules rowCount0..4096. No rows,
URL, credentials, provider errors or parameters escape. Caller closes original
material normally only after success. Any failure burns and conservatively keeps
material occupied, even after the public prepare/read promise rejects: private
callback/query settlement is unknown. No automatic close/replacement/retry.
Retain owner and once-only refusal; natural child exit/OS descriptor cleanup is
not a callback/backend-death certificate.

Before actual PG invocation, missing-export/fault tests use owned private FS and
inert OS/private-reader boundary only; do not invoke installed PG or live
launchers from tests. Qualify success/zero ports/once consumption, private target,
reentry, drift, import/preparation/read/refusal failure and pending-original
retention. Fresh exact source/loader/provider pins, bounded child/output/time
recipe and actual255 preservation plus independent reviews must precede the
one actual installed-PG invocation. Failure is sanitized/unqualified, no timeout
retry, PID/listener/start/migration/schema/role/credential or service mutation.
Task5 adapter/controller/authenticated entry and later actual3333 remain open.

Revised host recipe (actual qualification recorded below): private local child script
2026-10-07-dashboard-cutover-v2-private-reader-host-qualification.mjs and
parent collector2026-10-07-dashboard-cutover-v2-private-reader-host-parent.mjs,
both outside Git/PR. Child sourcea51cdabd pins seven selected source and eleven
installed provider/loader files, not a complete build/loader authenticity grant.
Actual node26.4.0 --import existing tsx loader, fresh child cwd writer; preserve
inherited environment except TSX_DISABLE_CACHE=1 (no cache artifact). Refuse
PG*, TSX_*, ESBUILD_* and NODE_OPTIONS/NODE_PATH/NODE_V8_COVERAGE inputs before spawning.
No runtime env loader, provider substitution or native/passive recipe.
Native launchctl/plutil and FS are real; delegate-only observers count seven
original account-home launcher/material FDs, require reverse close and EBADF,
then retire observers before final source rereads can reuse numeric FDs.
Publish diagnostic only after original material close and final pins. Thirty-
second unref watchdog marks unqualified only, never signals/cancels/certifies
closure. Existing statement/lock/connect/end bounds stay unchanged. Parent
waits child close plus pipe EOF, retains at most4KiB stdout, hashes/discards raw
stderr, validates a closed public JSON schema and emits only validated fields;
any stderr/overflow/signal/nonzero/unknown shape is unqualified. One child, no
retry/PID/listener/launcher mutation; natural child exit is not backend death.
558 affected and strict908-file noemit0 precede fresh255 and exact recipe review.
Normal loader ancillary scope is explicit: installed tsx may start its ESM
worker and installed esbuild0.28.1 --service helper while compiling source.
Do not assume a cache hit or call one Node child the whole process set. Disable
tsx FileCache (in-memory Map) before --import so no cache rotation/removal;
parent also pins listed loader/esbuild entries and native binary before spawn.
No esbuild stop()/signal, package installation or download. Actual child close
is not a complete loader-descendant/backend resource certificate. Receipt18
selected file pins and seven material FDs are scoped evidence only; full
authenticated source/build/producer/exclusion custody stays Task5.

First child05:06:38UTC refused during initial pins, before source import or
material/PG acquisition, opened0; natural exit1, stderr0, no startup. Read-only
metadata audit: all17 hashes match; installed native esbuild has two links,
not the assumed one. Both @esbuild/darwin-arm64/bin/esbuild and esbuild/bin/esbuild
are actual dev16777231/ino201752772/nlink2/10573778B regular files with identical
expected content. Preserve both; no relink/install/change to dependencies.
Revised recipe positively requires EXACT two links on these two paths, matching
dev/inode, original pre/post metadata/hash; all other file paths retain nlink1.
One separately reviewed invocation after this causal pin repair is nominated,
not blind same-recipe retry or actual-PG passing credit for the first refusal.

Revised invocation actual05:09:42UTC: real installedpostgres3.4.8/private reader
prepare+fixed rules read succeeds(ruleCount0), planned49 app statements/two
sequentialRR clients; eighteen selected path pins/seventeen physical files,
seven original material reverse closes+EBADF. Child41705 natural exit0, no signal,
stderr0, closed public receipt valid, watchdog false. No listener/startup,
backend/ancillary-death or whole facade/exclusion/Task5 claim. Preserve the failed
first pin receipt and separately reviewed successful revision; do not replay.

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

### Task4a.4 absent-only atomic ROOT publication

The installed cooperative producer inventory supports a narrower alternative to
sampled UID coverage: ROOT is monotonic within authenticated producer versions.
Successful no-replace publication of a complete first-generation ROOT then
excludes an older canonical-lock validator: its prior ROOT could not disappear.
This is conditional namespace exclusion, not process quiescence. Unknown external
namespace mutation remains outside contract. Bind every admitted producer to its
actual module/root; configurable recursive cleanup roots must be positively
disjoint or their entry routes excluded. Current absence alone does not certify
this premise. Old repository-relative installs and private fixtures must never
be projected onto the canonical ROOT by labels.

File Map: add scripts/deployment-dashboard-cutover-atomic-root-v2.py and builtin
script test. This is a filesystem publication leaf, NOT owner/startup authority.
Invoke only /usr/bin/python3 -I -S -B with fixed sanitized environment and cwd/;
FD3 is one inherited duplicate of the parent's held baseline-directory original,
never the parent's original or an opaque ownership capability. Exactly one argv
stage leaf: .dashboard-cutover-root.<lowercase UUIDv4>.stage. Fixed destination
restart-authority-retirement-v1. No caller destination/path/provider/flags.

Before native publication, derive the parent's bounded absolute named path only
from public fcntl F_GETPATH(50) on FD3 (1024-byte buffer, terminated result), and
recheck nofollow named/held parent identity. This is not an ancestor/source grant;
the consuming parent supplies that retained closure. Authenticate staged
directory0700, exactly one regular nofollow/nonblocking0600/nlink1 lock (FIFO
cannot suspend type validation), canonical bounded
V2 reservation wire/hash and same filesystem. Fsync file and staged directory.
Use typed public libSystem renameatx_np with RENAME_EXCL|RENAME_NOFOLLOW_ANY|
RENAME_RESOLVE_BENEATH (0x34), one attempt; unsupported flags/filesystems refuse
without fallback. Every existing destination, including empty/symlink, refuses.
After return, recheck original directory/lock against canonical named originals,
stage absence and held baseline; fsync baseline. Directory immutable identity is
dev/ino/type/mode/uid/gid/birthtime; own rename may change directory ctime and
parent mtime/ctime. Lock FULL identity/bytes remain unchanged; never repin an
arbitrary poststate. Register every returned child FD before its first fstat,
including inherited FD3. Unsealed or unknown originals are not blindly closed.
Premark each checked-once reverse close, stop at an uncertain/unsealed original;
premark close-observation too: failed identity query/mismatch permanently latches
unknown before failure disposal, with no second query or close attempt.
fixed success wire requires all three originals known close-settled. Failure
disposal closes only sealed originals under original immutable identity and
never repeats an attempted close. Natural child exit does not certify uncertain
cleanup. Failed/unknown publication never retries, repairs, removes or replaces any
path. Parent retains its independent originals across child settlement and burns
on any child/transport/post-observation uncertainty; no natural-exit rollback
claim. Successful close preserves ROOT and V2 lock permanently. Reuse/release and
live adapter admission require their own qualification; existing V2 API unchanged.

Qualification is limited to newly owned retained private filesystem fixtures,
including independent wire/hash expectations, existing-ROOT and source-alias
refusal, both legacy-mkdir race orders, original FD survival and exact native
error/failure custody. No canonical ROOT, listener, launchd or PostgreSQL effect.

### Task4a.5 retained first-generation reservation custody

File Map: scripts/deployment-dashboard-cutover-first-generation-v2.mjs and
scripts/__tests__/deployment-dashboard-cutover-first-generation-v2.test.js.
Keep old serialization exports unchanged. New exports:
acquireFirstGenerationDashboardCutoverReservationV2(input):Promise<object>,
assertFirstGenerationDashboardCutoverReservationV2(handle):void,
closeFirstGenerationDashboardCutoverReservationV2(handle):void.
Input is the existing strict plain-record two-hash snapshot. Invalid idle input
consumes nothing; any active reentry burns before inspecting arguments.
All three exports require exactly1 argument; fixed error
DASHBOARD_FIRST_GENERATION_RESERVATION_REFUSED. Consume one valid acquisition
before account/FS ports: idle→acquiring→held→closing→closed, selected failure→burned;
never reset to idle. Closed/burned acquisition always refuses even if ROOT is
externally removed. Foreign inactive handles refuse zero ports without burning
the authentic held reservation.
Returned empty frozen null-prototype WeakMap handle proves reservation custody only;
labels never replace the consuming adapter's genuine owner/build authority.

Account-derived ROOT and lock are fixed. Every existing canonical ROOT refuses
before staging. Retain nofollow ancestors/baseline, exactly one stage-to-ROOT
directory original, one lock original, and original fixed helper/interpreter file
inputs. Canonical account path has9 filesystem originals plus2 provider inputs;
bound the entire ledger to128. Interpreter is the fixed root-owned regular
/usr/bin/python3 OS input, not nlink1 (installed hardlinks are not rewritten).
Interpreter byte witness is capped16MiB, read in bounded1MiB chunks; total
provider-input budget16MiB+65536. Reject overflow/short/changed originals.
Helper is regular/nonblocking/nofollow/nlink1, bounded65536 bytes, and must match
reviewed e65e3f49ac0ee41d52c82cfe9491ff631f3180c2311ef9424ce9849256436b38.
Retained inputs are named/held/byte witnesses, not full Python/OS loader authority.
Its consuming finalized source/build/OS profile must supply that closure.

Create one exclusive UUID stage0700 and complete canonical lock0600, pin original
FULL lock identity only after owned write, fsync file/directory, then reserve the
sole Python attempt before spawning. Register returned child, original natural
close settlement and both drain/EOF/error observers before the post-spawn burn
check. Fixed isolated Python argv/env/cwd and FD3 baseline duplicate.
Literal executable /usr/bin/python3, argv[-I,-S,-B,<fixed helper>,<stage leaf>],
cwd/, env{PATH:/usr/bin:/bin:/usr/sbin:/sbin,LANG:C,LC_ALL:C,TZ:UTC}.
Total output bounded16384 bytes with continued discard/drain, no signal/timeout/retry. Retain
original settlement while failing; response/capture loss never drops child work.
Drain remains allowed after burn; no later normal FS/process/effect port.

Accept only exact fixed success wire, empty stderr, both EOF, natural status0/no
signal. Recheck original stage inode under canonical ROOT, original lock FULL
bytes, stage absence, held provider inputs, account and original owner; final
publication-state fence precedes handle return. Never open/repin a replacement.
Maintenance process observation remains its existing four-query composite with
existing timeout semantics; the no-signal promise concerns the Python child.
Failure retains ALL parent originals, no rollback/unlink/automatic close. Normal
close consumes genuine held handle, checks/premarks identity and each reverse
once-close; unknown stops, never repeats observation/close. ROOT and V2 lock stay
durable after successful close, so this is intentionally one-generation only.
Finite producer/root-history/cleanup proof, full adapter/entry and live admission
remain separate. New qualification touches only owned retained private fixtures.

### Task4a.6 future cleanup namespace protection

Causal source gap: run.ts cleans agent workspaces before publishing its running
row; step-advance.ts cleans after terminal transition; uninstall.ts captures
configured paths before awaits. None acquires the retirement ROOT. Current ROOT
absence or current configuration cannot prove those earlier callbacks settled.
The consuming adapter must drain these finite cooperative legacy families before
using current config disjointness; no universal UID roster or nativeS10 condition.

File Map: src/installer/platform-cleanup-protection-v2.ts;
tests/platform-cleanup-protection-v2.test.ts; worktree-ops.ts cleanAgentWorkspace;
uninstall.ts recursive-delete sites; src/cli/cli.ts uninstall caller ordering.
Add assertCleanupTargetOutsideBaselineV2(target:string):void. This is an ordinary
filesystem safety assertion, NOT an owner/exclusion/retained-capability grant.
Fixed protected namespace is actual account home/ai/setrox/data/
internal-production-baseline, whether present or not. No caller protected roots,
callbacks or disable flags. Require primitive absolute UTF8-roundtripping strings
of1..16384 UTF8 bytes and at most128 components. Reject literal dot/dot-dot
components before ports: lexical normalization of symlink/.. is NOT physical
resolution of the consumer's original deletion path. Invalid/nonabsolute/NUL/
oversized/proxy inputs refuse before account/FS ports.
Error is SETFARM_PROTECTED_BASELINE_CLEANUP_REFUSED.

Resolve existing target/protected ancestry physically with lstat/readlink; only
definite ENOENT permits unresolved suffixes. Existing broken links, inaccessible
or nondirectory ancestry refuse. Bound both walks to128 components. Reject target
equal to, inside or an ancestor of the protected namespace, including symlink,
existing inode aliases and Darwin ASCII case aliases of absent reserved names.
Compare component-prefix overlap in BOTH directions at ANY shared directory
dev/ino anchor, not merely equal deepest prefixes. Protect both reserved-name
ancestry before a link and the resolved destination; retain/recheck each observed
link occurrence and each first-missing component after the final account bracket.
Resolve every indirect link hop explicitly, including relative link-target dots
against the already resolved physical parent, never lexical symlink/.. collapse.
At most128 resolution steps per path; link targets are bounded16384 UTF8 bytes.
Protect removal of each protected-route link or its ancestor (one direction),
without classifying every disjoint descendant of an account link as baseline.
Allow disjoint file leaves, not nondirectory intermediate ancestors. Limit each
path to16 observed link occurrences and total matching-anchor projection
comparisons to65536; unknown/budget overflow refuses. Never treat a missing
canonical ROOT as permission to erase its parent. Normal physically disjoint
generated workspaces remain permitted.

Call before stale-file removal, process-kill or recursive directory deletion in
cleanAgentWorkspace; recheck each target immediately before its mutation boundary.
Uninstaller materializes/freezes its at most128 deletion-target strings once:
workflow/workspace roots, configured agent parent directories, fixed runtime
children and runtime root, own dist and node_modules. Validate the entire set
before config/DB/daemon
effects, then rechecks at every recursive-delete dispatch, including after awaits.
The CLI uninstall branch must not call isRunning or stopDaemon before this
preflight: isRunning can unlink stale PID state and stopDaemon can signal a
process. Remove the redundant caller pre-stop; retain ordinary admission,
noninteractive force and active-run checks. The callee remains the sole stop
site, after complete preflight. Tests execute the actual AST-selected CLI branch
composed with the actual uninstaller body and real private-path guard. A rejected
protected target reaches neither PID inspection nor stop; a disjoint preflight
reaches exactly one callee stop after config read. This fixture does not qualify
the full CLI import/runtime/source-build closure or permit ordinary admission.
Unknown guard state aborts that deletion; no catch/fallback may retry it. Keep
ordinary logging/error behavior without claiming the broader workflow succeeded.
No actual uninstaller/cleaner is invoked against user paths during qualification.
Private owned tests exercise real physical paths and consumer boundaries, with
guard refusal preserving files and zero process/delete ports. Source is future
hardening only: it does not retroactively protect old loaded cleanup code or
establish continuous namespace/actor exclusion across an await.

### Task4a.7 central future configuration mutation refusal

Configuration publication is a separate causal prerequisite of the same
first-generation cooperative namespace closure. CLI-only admission does not
cover exported writeOpenClawConfig/atomicWriteSync or Medic install/uninstall;
an async caller may carry a previously read config to a later publication.
Use a central refusal-only zero-argument assertion over the existing authentic
deployment-cutover intent observer. Refuse permanently on OPEN, unknown or
swallowed reentry, with fixed DASHBOARD_CUTOVER_ORDINARY_CONFIGURATION_REFUSED.
No caller observer/root/config/grant, no reset, no ownership token. Invalid
idle arity refuses before ports; an active reentrant call burns before input.
Known absent retains ordinary behavior, subject to a fresh check on every call.
An absence observation is never retained exclusion or startup authority.

File Map: new baseline-dashboard-cutover-configuration-refusal-v2.ts and matching
internal-production test; openclaw-config.ts, config-schema.ts and medic-cron.ts.
Call before central config validation/serialization and immediately before
atomic write's first mutation. This catches a late OPEN published by serialization
without relying on an earlier absent snapshot. Medic public install/uninstall
check before legacy cron entry, before config cleanup after its original await,
and before timer entry after config cleanup's original await. Keep original
promise settlement and existing helper behavior; no retry/rollback or caller
guard override. A refusal swallowed by best-effort config cleanup cannot permit
the next timer entry. Internal already-entered helper effects remain part of
the legacy invocation drain, not retroactively excluded by these checks.

Private fixtures use real held-observation source and real owned paths, with
only external write/cron/unit ports trapped. Execute actual AST-selected source
bodies; no whole import/runtime-loader admission is inferred. Qualify genuine
missing-module and consumer REDs, positive absent first-port controls, zero
caller-proxy traps on denied writer entry, permanent refusal, swallowed reentry
and late serialization OPEN. Preserve all fixture and user originals.
This is future source hardening only. It does not authenticate historical
loaded writers, continuous async path stability, ROOT/intent genesis, the full
controller, native peer transport, clean-main build or real-host startup.

### Task4b.2 retain ordinary CLI process contenders

The legacy-invocation audit found that the V1 process observer drops workflow
run/uninstall, top-level uninstall, step peek/claim/complete/fail and Medic run.
Those invocations can reach cleanup or config effects even with no running DB
row. A blank diagnostic inventory therefore cannot even establish sampled
absence of these recognizable CLI processes. Existing token-wide group matching
also calls incidental task/output words spawner or dashboard starters.

Choose compatible V1 hardening over a disconnected V2 diagnostic or a new
authority catalog. File Map is the existing process-observation-v1.ts, its
existing test and paired docs. Keep the public zero-input function, wire schema,
daemon checks, two complete process/listener samples and sanitized output.
Every recognized Setfarm CLI entry stays visible (bare process-title metadata
is refined by Task4b.2.1 below). Only a unique CLI token at
the direct executable position or immediately after a Node executable, with
the group immediately following it, may keep the existing starter label.
Unsupported loader/options placement, no group, ordinary groups, duplicated
entry tokens and incidental later group words remain ambiguous-contender.
Never echo ordinary task/output arguments or claim authentic argv, loaded
source, original generation death or continuous exclusion from flattened ps.

Execute the real exported observer with only external ps/lsof commands supplied
as finite inert fixtures. RED dropped ordinary CLI processes and wrong starter
labels before production changes. Preserve existing daemon/alias controls;
test late ordinary contenders and identity drift cause whole-bracket refusal,
with fixed errors and no raw argument disclosure. No live process signal,
service, selector, launcher, database or ROOT mutation is part of this slice.

### Task4a.7.1 real configuration consumer module imports

Supplement the existing AST-selected consumer tests with full source-module
imports of openclaw-config, config-schema and Medic exports in private owned
children. Keep the actual assertion, authentic observer, private OPEN/unknown
paths, static imports and module cache. Redirect only the bare JSON5 dependency
to the existing installed package; never replace source or observer imports.
Trap filesystem mutation/cron reads below the owned OpenClaw/unit paths, child
command and network ports. Denied entry must touch none of those ports or caller
proxy traps. Positive absent writer/atomic cases really create only new owned
private files with hand-derived bytes and preserve the files. Real serialization
publishing OPEN must reach no atomic write or rename. These are supplemental
qualification of existing behavior, not new RED or full CLI/import-closure,
source/build, actor exclusion, private PG, transport or startup authority.
File Map: existing configuration-refusal-v2.test.ts and paired docs only.

### Task4b.2.1 distinguish bare aliases from process-title metadata

Fresh read-only host evidence found a PostgreSQL backend title containing the
database name setfarm. The V1 matcher mistakes this bare metadata word for a
CLI entry. No process, database, user, PID or executable-specific exemption is
permitted. This is a causal correction to Task4b.2, not a new owner contract.

Keep slash-qualified aliases and dedicated src/dist CLI paths visible anywhere.
Keep bare setfarm/js/mjs/cjs aliases at position0 and under every non-title
prefix, including unknown wrappers. For later bare aliases only, a first token
matching the finite title-label grammar /^[A-Za-z0-9_.+-]+:$/ is treated as title
metadata by this diagnostic unless
a preceding token has basename node, nodejs, env, sh, bash, zsh, dash, ksh or fish.
Scan once with cumulative execution-prefix state; do not repeatedly slice argv.
Title-prefixed strong paths and execution-prefixed bare aliases stay ambiguous.
Existing unique/direct starter labels, daemon checks, bracket hashes, wire schema
and public zero-input observer are unchanged. Do not broadly allowlist wrappers:
unknown non-title wrappers must remain visible rather than silently disappear.

A colon-ending token is not kernel-reserved syntax and can name an executable.
This finite flattened-ps diagnostic does not authenticate argv, exclude actors,
prove loaded-source settlement or grant startup, even if its result is empty.
The existing continuous exclusion/authenticated transport obligations remain.
File Map: existing process-observation-v1.ts, existing test and paired docs.
RED literal observed/generic title mentions, preserve direct/Node/options/env/
shell/unknown-wrapper candidates, strong paths and title-to-CLI bracket refusal.
Only external ps/lsof fixture ports are inert; actual classifier/hash is tested.
No live signal, PostgreSQL query, selector, launcher, ROOT or service mutation.

### Task4g.0 closed control-message data grammar

The pending authenticated foreground startup needs a finite payload grammar,
independent of native peer identity and effect capability. Choose a closed pure
codec over generic JSON dispatch or using a received GRANT as a permission flag.
Create baseline-dashboard-cutover-control-wire-v2.ts; extend the existing
baseline-dashboard-cutover-records-v2.test.ts; paired docs. Actual normal-command
inspection found records/store tests absent from the explicit pure suite. Add
these two existing files to package.json test:internal-production:pure, retaining
all existing entries. This closes a causal qualification-enrollment gap; no
native code, CLI/startup/controller wiring or build-profile change in this slice.

Two exports take exactly one unknown argument:
encodeDashboardCutoverControlMessageV2(message): Buffer and
decodeDashboardCutoverControlMessageV2(bytes): DashboardCutoverControlMessageV2.
Schema is setfarm.internal-production-dashboard-cutover-control-message.v2.
Kinds are exactly HELLO, CHALLENGE, ACK, GRANT. Every kind has exactly schema,
kind, exchangeNonce, childSourceHash, childBuildHash. HELLO has no further fields;
the other three additionally require challengeNonce, phase6IntentHash,
ownerClaimHash. Every nonce/hash is exactly64 lowercase hex characters.
No PID, URL, path, SQL, mode, permission, result or callback field is accepted.

Encode accepts only an actual nonproxy plain Object-prototype record, exact own
enumerable data descriptors and primitive strings; no getters, symbols or caller
serialization. Decode accepts actual nonproxy Buffer ancestry only, bounds its
intrinsic byte length1..1024 before copying or parsing, permits at most128
nonproxy intermediate prototypes before Buffer.prototype, uses original typed-array
intrinsics rather than caller length/iterator/toString properties, and requires
exact canonical UTF8 JSON plus one LF. Refuse duplicate keys, extra whitespace,
CRLF, invalid UTF8, concatenated frames, unknown/missing fields and overcapacity.
Return a freshly copied frozen inert record; encode returns new owned bytes.
All refusal paths expose only DASHBOARD_CUTOVER_CONTROL_MESSAGE_INVALID.

Codec success is DATA ONLY, including decoded GRANT. It cannot authenticate
peers, compare exchange/phase/birth freshness, generate entropy, reserve rights,
prove endpoint publication, authorize effects or mint a startup capability.
The future actual transport must authenticate kernel audit trailers, bind both
original births/source/builds, maintain once-only challenge/replay state and
consume genuine owner/phase originals before a child-local nonforgeable grant.
HELLO can arrive while phase5 restoration is pending and grants nothing. Parent
must complete observed phase5 restoration and publish phase6 intent before its
CHALLENGE/GRANT; phase6 completion requires the same authenticated CLI listener.

Public rendezvous research found ambient bootstrap_register/create_service can
reuse inactive same-job services; a private subset alone is not reachable by an
independent unchanged launchd CLI. A separately owned controller MachServices job
plus public bootstrap_check_in is a supported alternative, NOT nominated for
live creation here. Job bootstrap success alone cannot certify service binding;
partial/collision/recycled-port custody and the actual provider/profile need
independent qualification. Keep original dashboard/spawner plists unchanged.
The existing V1 idle diagnostic is not the positive foreground listener profile.
This is a transport data prerequisite, not a new universal native/S10 barrier.

### Task4g.1a closed local Mach audit diagnostic

File Map: scripts/dashboard-cutover-mach-audit-v2.c; matching builtin JS test;
paired design/plan. This is a public C11 Node-API8 local mechanics diagnostic,
not the endpoint/provider authenticator. No production loader, sidecar builder,
package build change, bootstrap registration/lookup/check-in or CLI admission.
The separately opt-in Darwin test compiles only a fresh private test artifact.
Default portable script tests do not need CLT. Existing dist/archives stay intact.

One export observeLocalMachAuditV2(bytes) accepts exactly one actual Uint8Array
(including Buffer) backed by a nonshared, nondetached ArrayBuffer, intrinsic
length1..1024. Copy before acquisition; never read caller properties, iterators
or serializers. Invalid idle input does not consume the one module-wide attempt.
The pre-claim copy is bounded per-invocation storage. Only the winning atomic
owner may copy it into the shared retained vault; no pre-claim vault writes.
Return exactly frozen inert {bytes,euid,pid,pidversion}, with newly copied Buffer
bytes. No raw names, handles, callbacks, labels, modes or permission fields.
Every failure exposes only DASHBOARD_CUTOVER_LOCAL_MACH_AUDIT_REFUSED.

The module-retained bounded C vault precedes all acquisition. A C11 atomic FSM
allows one acquisition owner across addon environments; another attempt burns
the module without touching its vault or issuing native calls.
Any call entering while ACTIVE burns before argument/typed-array inspection.
The first owner checks the latch after every port and before publication. A
fresh ACTIVE atomic load immediately before each premarked operation is its
admission linearization. If another environment burns AFTER that admission,
the already-admitted one call may finish and seal its result; no new operation
may be admitted after a witnessed burn. This is not instantaneous OS revocation.
Every returned name/buffer and status remains retained after uncertainty.
Record each returned status/name and seal every proven acquisition/disposal
effect BEFORE checking a concurrently burned latch. Successful allocate then
burn retains held R, not only pending; successful close then burn stays settled.
No finalizer, GC, process-exit cleanup or generic finally is settlement credit.

Allocate one RECEIVE occurrence R, insert one MAKE_SEND reference S (same name,
distinct obligations). Premark each acquisition/send/receive/disposal; success
seals its occurrence, uncertain return remains unknown. Send a simple inline
frame with COPY_SEND, null reply/voucher, fixed message ID, uint32 payload length
and zero4-byte padding. No complex/OOL/descriptor producer exists. Receive once,
request FORMAT_0 AUDIT, use finite timeout plus SEND/RCV_INTERRUPT (no automatic
wrapper restart). Bound and validate header, size, padding and rounded trailer
offset/type/exact audit size before public BSM pid/euid/pidversion accessors.
Require current getpid/geteuid and positive pidversion for this local diagnostic.
Payload/PID claims cannot replace the received kernel trailer.

Unexpected headers/complex messages, receive errors or trailer faults burn and
retain the original receive buffer and right obligations; no blind destroy,
retry, reacquire or cleanup is attempted. Inline capacity is NOT an OOL-resource
bound for a future public inbox. This inbox's name is never published/returned;
the threat model is the closed cooperative source, not hostile task-space access.
General remote/public-resource qualification remains a separate obligation.

On the sole successful path, premark S disposal then mach_port_deallocate once;
only settled S permits premarked mach_port_mod_refs(RECEIVE,-1) once. Any disposal
failure stops later native calls and retains unknown custody. No mach_port_destroy.
Build output objects only after both occurrences settle; object allocation/freeze
failure burns but cannot erase the vault.
Output construction ends with an ACTIVE-to-COMPLETED atomic compare/exchange;
failure refuses publication. A contender after that linearization may burn future
entry but cannot retroactively invalidate the already returned inert DATA.
Success proves only local audit mechanics, not remote birth, rendezvous,
replay/source/build binding, owner/phase or startup.

Tests name payload boundary/copy faults, pre-acquisition validation, duplicate
attempt, receive/header/trailer faults and unknown disposal/reentry. Test-owned
instrumented copies wrap actual native calls first, then inject closed faults;
production exports no probe or fixture flag. Compile/link use installed public
Node headers and SDK, -lbsm and per-symbol NAPI dynamic imports, never blanket
undefined dynamic_lookup or a replayed Task6A private compiler recipe. Retain
fresh artifact/input hashes and originals; compiler/link/import/setup failures
are unqualified, not authenticated transport RED.
The fixture runner keeps original child/pipe custody until actual close, uses a
mark-only20s watchdog and bounded capture/drain, and never signals/retries a
timed-out fixture. Timeout/overflow/signal/natural death cannot count as Mach
right settlement. Inspect exact libSystem/libbsm dependency paths before load.
Postcompile dependency hashes are diagnostic records, not a pre-held complete
compiler/provider certificate. Injected burns qualify the nominated operation
boundary only; no general concurrent-domain/worker exclusion claim follows.

### Task4g.1b retain the executing generation's existing build proof

The optional native sidecar cannot authenticate its generation by following the
ambient selected CLI: that is intentionally an older preserved installation.
A transient current-build observation releases originals before a later
compile/load boundary. Reuse the existing finalized-build holder rather than
duplicating its verifier or accepting BUILD_INFO alone. This is a causal
prerequisite of the same native/startup channel, not a universal OS certificate.

File Map: scripts/build-generation-retention.mjs; its existing builtin test;
paired design/plan. Add holdCurrentFinalizedSetfarmSourceBuildV1(), exactly zero
arguments, deriving the root exclusively from its own import.meta.url. Supplied
arguments, including undefined/proxies, refuse before filesystem/Git ports and
do not consume the existing uncertainty latch. No caller root/provider/options,
environment, cwd or selected-CLI lookup may select the generation.

Return the existing frozen {observation,recheck,close} context from the private
holdFinalizedSetfarmSourceBuildAtRootV1(root,true), unchanged. Its existing source
and full finalized-output hashes, synchronized clean main/origin, retained
physical files/ancestry and4096 descriptor bound remain scoped filesystem proof.
Observation is frozen {checkoutSource,buildSource}. Recheck across awaits detects
source/output identity/metadata/hash drift; failed recheck burns existing module
uncertainty while originals remain held until explicit close. Explicit close is
once-only, duplicate close inert; close-result loss permanently refuses
reacquisition and must not close a reused descriptor.

Do not strengthen or misrepresent the legacy holder: acquisition failure drains
its own originals once, explicit close consumes attempted descriptors even when
results are unknown, and it has no new construction/recheck reentry fence.
This context is trusted composition, not a nonforgeable owner/native/startup
capability, loaded-code or whole compiler/OS-loader qualification. A future
sidecar owner must supply its own activity/custody contract and pin providers.
No production builder/loader, default build, CLI, service, selector, PostgreSQL,
ROOT, accepted native artifact or deployment change is part of this slice.

Tests use real new private Git/finalized-output fixtures and actual production
verifier. Assert independently derived hashes, original held descriptors through
an await, cwd/environment/selected-link independence, no writes/dist evaluation/
non-Git processes, zero ports for invalid arity, sticky drift refusal, and
close-loss/reused-descriptor safety. New fixtures are retained as evidence.

### Task4g.1c closed two-birth Mach mechanics

Replace the self-only diagnostic gap with a separately opt-in, closed echo
exchange between two new owned Node processes. This is remote audit/right
mechanics DATA, not the full authenticated cutover transport or startup authority.
File Map: scripts/dashboard-cutover-mach-peer-v2.c and matching builtin test;
paired docs. Existing local diagnostic/default build/runtime remain unchanged.

Export observeControllerMachPeerV2(bytes) and observeClientMachPeerV2(bytes),
each exactly one intrinsic nonshared/nondetached Uint8Array1..1024, no caller
properties/label/root/expectedPID/provider. One module-wide atomic attempt, active
contender burns before input. Copied input and volatile occurrence/status vault
precede native acquisition; admit each public operation once, seal returned
effects before burn checks, never retry/auto-cleanup after uncertainty. Return
frozen copied DATA{bytes,euid,pid,pidversion}, observed from the received AUDIT
trailer, same euid, positive pid/version and different PID from this process.
This filter is not original-source/build, peer-lifetime or ownership proof.

Production C has one fixed service string. Controller checks in that declared
service with public bootstrap_check_in(bootstrap_port,...); client looks up its
private SEND occurrence S with public bootstrap_look_up. Controller owns checked-in
RECEIVE R; client owns private reply RECEIVE Q. Request is SIMPLE COPY_SEND to S
plus header MAKE_SEND_ONCE from Q; controller receives distinct reply SEND_ONCE T.
Validate request header dispositions/names/ID, exact size/length/payload/padding,
rounded FORMAT_0 AUDIT trailer before echo via MOVE_SEND_ONCE T. Known successful
reply consumes T; unknown send retains it. Client validates reply/null remote and
PORT_SEND_ONCE local, exact frame and kernel audit before disposing Q then S.
Controller surrenders R only after settled T. R returns to launchd: this does
NOT remove advertisement, dispose the job or prove endpoint-generation continuity.
No generic port destroy, bootstrap register/subset/create-service, task-for-pid,
native callbacks/threads or raw right names. Public bootstrap APIs are nominated
provider composites, not a claim about every internal MIG/kernel attempt.

The 1024-byte inline cap is not protection against arbitrary public OOL imports.
Scope is exclusively these closed cooperative test producers; unexpected complex
or malformed received state burns and retains original buffers/names, without
blind disposal. Full provider resource/freeze/peer-source binding stays separate.

Actual fixture profile: Darwin arm64, installed Node26.4.0/public Node-API8 and
CLT/MacOSX26.5 SDK, warning-as-error C11/per-symbol NAPI imports, exact libSystem/
libbsm dependencies. Normal script tests skip without compiling or job effects.
Test-owned copies replace ONLY the fixed service literal with a bounded unique
UUID service and optionally wrap genuine native calls before closed header faults.
Pristine production C must also compile/load and reject invalid input zero ports;
no fixed production-service lookup/check-in is invoked by qualification.

At most three new individually named launchd fixture jobs per opt-in invocation,
one successful pair plus server/client received-header faults. Job and service
names derive root-owned UUIDs, <128 bytes, own actual uid GUI domain, plist700
parent/600 file, fixed Node/script/cwd and sanitized compiler/child/job environment.
Job ProgramArguments uses /usr/bin/env -i with literal PATH/LANG/LC_ALL and
fixed Node/script, preserving the job's exec identity/bootstrap context while
clearing inherited Node environment; plist EnvironmentVariables alone is only
an overlay. Trust the nominated system launcher/env provider, not a universal
hostile-loader environment claim. Retain every command intent/result before
assertions and bootstrap outcome immediately; setup/capture/receipt failure burns
the qualification invocation and forbids subsequent attempts/jobs. Bound to40
commands. A malformed-header oracle must witness injection AFTER actual receive
SUCCESS; timeout/refusal alone earns no fault credit.
Set RunAtLoad=true, KeepAlive=false, LaunchOnlyOnce=true, ResetAtClose=true.
No caller label, existing job replacement/unload/enable/disable/kickstart, signal,
retry or bootout. All new job/plist/binary/receipt artifacts remain visible and
retained; they are not a clean launchd resource-settlement certificate. Receive
uses5000ms and SEND/RCV_INTERRUPT; mark-only watchdog/capture-loss is unqualified,
natural process exit never proves unknown-right disposal. Pair acceptance requires
both actual native result receipts, crossed original process PIDs/euid and copied
bytes plus expected literal call trace. Fault acceptance requires fixed refusal
and no later native call, not cleanup credit. MC3080/gateway18789 stay unchanged.

Installed launch(3) documents receive-right return/recycling; launchd.plist(5)
documents ResetAtClose/LaunchOnlyOnce. Published Apple launchd842.1.4 core.c
(d448a1c8f70a61202f8705f94337f686b87c30c4) demonstrates service-name collision can
skip attachment despite job import success, and non-strict missing-name check-in
can create a service. Do not treat this old source as current implementation or
probe arbitrary undeclared names. Actual paired kernel receipts, not bootstrap
status or launchctl print text, qualify this closed exchange.

### Task4g.1d retained direct native inputs before sidecar compilation

The optional sidecar needs original provider custody before it can compile or
load. Current clang is290,664,032 bytes, larger than the existing33MiB reader;
its resource directory21 is physical,21.0.0 is an alias. Select a bounded
streaming direct-input holder rather than allocating a whole compiler buffer or
claiming an unimplemented whole compiler/OS closure. This is a causal prerequisite
of the already approved sidecar path, not a new universal admission gate.

File Map: new scripts/dashboard-cutover-native-inputs-v2.mjs; its builtin test;
new scripts/__tests__/helpers/dashboard-cutover-finalized-fixture-v2.js for real
new owned Git/finalized output fixtures; paired design/plan. Default build,
package commands, C source, dist and all existing installations stay unchanged.

Export only holdDashboardCutoverNativeInputsV2(), exactly zero arguments,
returning frozen{observation,recheck,close}. Derive checkout from import.meta.url;
use the genuine holdCurrentFinalizedSetfarmSourceBuildV1() and keep that original
context through explicit close. Profile before FS/Git ports: Darwin arm64,
Node26.4.0 at /opt/homebrew/Cellar/node/26.4.0/bin/node, public Node-API>=8,
nonroot actual UID. No cwd/environment/provider/options/root overrides. Invalid
idle arity/profile refuses without ports; active reentry burns before inspection.

Fixed direct files: own scripts/dashboard-cutover-mach-peer-v2.c; the Node binary;
CLT usr/bin/clang and usr/bin/ld; physical CLT usr/bin/llvm-nm and llvm-otool;
four public Node
headers node_api.h,node_api_types.h,js_native_api.h,js_native_api_types.h under
the fixed Node include/node directory. Physical anchors include those ancestors,
CLT MacOSX26.5.sdk and physical usr/lib/clang/21. Own source files must belong to
actual UID; provider files and ancestors AT/BELOW the fixed Node generation or
CLT root must belong to root or that UID, non-group/other-writable, with physical
nofollow identity. SDKs/usr/lib/clang intermediates are inside CLT protection;
upgrade and revalidate an already-held directory if it later becomes protected.
Ancestors above own checkout/Node generation/CLT root are identity-bound ambient
anchors, NOT owner-private or mode-qualified (Homebrew Cellar is0775). Reject aliases/hardlinks,
nonregular inputs, empty/oversized files and metadata/content drift including ABA.

Hash via positional64KiB readSync blocks,512MiB/file,1GiB aggregate,256 extra
descriptors. Hash originals again on recheck; check pathname and FD identities
before/after each stream and all original ancestors. Files retain mode,size,
links,dev/ino,birth,mtime,ctime,uid/gid; protected directories retain identity and
timestamps, outer ambient ancestors identity only. This is not continuous outer
directory exclusion or a whole descendant inventory.
Preallocate each occurrence before open; seal returned FD before further checks.
One lifetime acquisition and module activity/burn guard. Unknown acquisition or
recheck retains original vault and refuses later acquisition; no auto-cleanup.
The legacy source/build holder retains its unchanged internal failure semantics.

Explicit idle close reserves closed state before ports, disposes extra original
FDs in reverse order once, then invokes original source/build close once. Check
each original FD dev/ino/birth/type immediately before close; identity mismatch
or lookup uncertainty refuses without closing a reused number. Named-path or
content drift does not forbid settling a still-proven original object. First
unknown extra close stops all later close calls and retains remaining originals;
never retry a consumed/reused descriptor. Active close burns without close ports;
after actual synchronous activity unwinds, explicit close may settle originals.
Count each new activity revocation separately: reentry while closing an already
burned context must still stop later disposal. The original source/build close
is a trusted unchanged composite, not a new per-internal-FS-call abort guarantee.
Invalid method arity while idle refuses without burning healthy custody; active
reentry burns even if swallowed. Failure messages are the fixed secret-free
DASHBOARD_CUTOVER_NATIVE_INPUTS_REFUSED.

Frozen observation is inert DATA: schema,authority='direct-inputs-only',profile,
sourceBuild and files{role,locator,byteLength,sha256}. No FDs/raw handles, compiler
execution, directory creation, native load, Mach service or startup authority.
The Node executable hash does NOT prove current loaded executable identity or
its @rpath libnode/Homebrew dependencies. SDK/resource directory pins do NOT pin
all descendants; ld has non-system dependencies not pinned by this slice.
Existing pristine dependency evidence has269 paths including one declared public
SDK bootstrap.h alias; that include closure and alias custody must be separately
nominated before actual production compilation, not silently realpathed here.
Future builder also needs own ignored-parent bootstrap BEFORE retained root pin,
exclusive generation, compiler/pipe custody, exact link inspection and manifest;
future loader needs actual private load/cache contract and guarded native calls.

Portable tests use the genuine source/build verifier and real private files;
test-owned copies relocate only fixed provider literals to a NEW sibling provider
root OUTSIDE own checkout, so ROOT protections do not mask provider ancestry.
They nominate a closed
process profile. This earns no actual Darwin/compiler qualification. Separately
opt-in actual fixed-profile acquisition uses a NEW retained genuine own fixture,
streams real tool bytes and rechecks/once-closes, without compiler/native/job
invocation. Never edit/delete historical fixtures or infer process-exit cleanup.
Fixed fixture Git calls suppress system/global config, hooks and fsmonitor;
finalize's binary listing uses the same finite environment. /usr/bin/nm/otool
were found to share a nlink78 Apple shim; do not weaken nlink1 or follow CLT
symlinks. The nominated physical llvm tools are nlink1 root0755,33,125,008 and
138,208 bytes respectively. All actual-direct tool/header inputs total about329MB.

### Task4g.1e closed compiler dependency discovery and retained headers

Choose a separately bounded clang-M data preparation rather than a whole
compiler/linker/loaded-Node certificate or a filename-only build. The direct
holder is already delivered; the remaining headers are causally required by the
approved sidecar. clang's observed direct dylib dependencies are system-only;
the already-running Node controller remains trusted, NOT certified loaded code.
No compilation/link/load, native/Mach/launchd/PG, output directory, .setfarm or
startup effect belongs to this slice. Preserve existing inputs and services.

File Map: new scripts/dashboard-cutover-native-build-inputs-v2.mjs and its
builtin test; paired design/plan. Existing direct holder and its256FD budget,
genuine source holder, C, package/default build and dist remain unchanged.
Export only zero-arg async prepareDashboardCutoverNativeBuildInputsV2(), returning
frozen{observation,recheck,close}. No caller context, root, provider, environment
or cwd selection. Privately retain genuine holdDashboardCutoverNativeInputsV2().
Copy own C with64KiB cap from own import.meta checkout and bind its observed hash
before effects. One lifetime preparation, active-reentry revocation, sticky burn,
secret-free DASHBOARD_CUTOVER_NATIVE_BUILD_INPUTS_REFUSED. Invalid idle arity
refuses without ports; active reentry burns, including method calls during await.

Fixed physical clang uses --no-default-config, -nostdinc, -std=c11,
-DNAPI_VERSION=8, -arch arm64, -mmacosx-version-min=14.0, explicit SDK26.5 and
resource21, explicit Node/resource/include/SDK/usr/include search roots, explicit
SDK System/Library/Frameworks search, -M -MT setfarm-cutover-inputs -x c -.
Finite environment PATH=/usr/bin:/bin, LANG/LC_ALL=C, TMPDIR=/private/tmp;
cwd=/private/tmp, no shell. Source goes to stdin; dependencies to stdout.
LLVM command-line reference documents -M includes system headers, implies -E,
defaults stdout; -MT fixes target; --no-default-config suppresses config files,
-nostdinc suppresses implicit search. These upstream facts do not certify this
Apple compiler's version; one reviewed actual fixture invocation is required.
Primary source: https://clang.llvm.org/docs/ClangCommandLineReference.html .

Exactly two PLANNED successful discovery phases: first provisional lexical
graph, then the identical recipe while every discovered original is held.
The second must return exactly the same sorted lexical set. Neither phase
retries an unsuccessful or unknown child. At most2children,256KiB stdout,
64KiB stderr,30s mark-only watchdog per phase. No kill/destroy/cancellation or
later spawn after burn. Record original child and stdin/stdout/stderr occurrence
before writing C; preallocate each child occurrence BEFORE spawn admission, seal
the returned child and all three pipes BEFORE any post-spawn burn check. Keep
buffers/events private. Require actual stdin finish and
close, output end and close, zero stderr, child close status0/no signal and
successful write callback. Error/overflow/timeout/unknown burns and retains
original resources; later events only record state, never authorize recovery.
No closure while an original child has not actually closed, even after promise
rejection. Watchdog refusal is not evidence of child cancellation or settlement.

Strict bounded Make depfile parsing accepts the fixed single target, line
continuations and escaped printable path whitespace, no raw control/NUL,
comments/variables/extra rules or malformed escapes. Ignore only one nominated
stdin sentinel ('-' or '<stdin>'); require nonempty unique canonical absolute
paths under the three fixed roots: Node include/node, resource21/include, SDK.
At most384 headers,4MiB/header,32MiB aggregate,512 extra include FDs. Own separate
header vault keeps direct cap unchanged. Hold nofollow original regular nlink1
root/actualUID non-group/other-writable files and physical parent directories;
protected timestamps at/below Node generation/CLT, outer ambient identity only.
Premark pin before opening; seal returnedFD before burn check; hash in64KiB
positional blocks; name+FD identities checked around reads and on every recheck.
Only declared SDK usr/include/servers/bootstrap.h symlink with raw target
../bootstrap.h is allowed. Retain its lstat/readlink identity and physical target
usr/include/bootstrap.h plus parents; no generic realpath aliases. Reject other
symlinks, hardlinks, repeated physical files, escapes, foreign roots and drift.
Historical269-path diagnostic is not an acceptance count for stdin discovery.

Recheck holds original direct context before/after include checks and across
await. Explicit idle close first proves original child closure, premarks closed,
then reversely validates dev/ino/birth/type and once-closes own include FDs,
then trusted direct context once. Stop at first unknown/reentry; consumed FD
numbers never retried. Named/content drift need not prevent disposal of a
still-proven original FD. Existing source/direct composite semantics unchanged.
Frozen observation reports authority='compiler-dependencies-only', direct DATA,
header lexical/physical locators, byteLength/hash, optional declared raw alias
and two completed discovery receipts; never handles, a grant or compile proof.

Portable tests execute actual production code in new genuine owned fixtures;
test copies only relocate fixed provider literals and nominate runtime profile.
Double ONLY async external compiler spawn with original stream event mechanics,
keeping genuine Git/verifier/files/FD/hash/parser/guards. Default runs make no
actual compiler calls. Separately opt-in fresh actual fixed Node26.4 fixture,
review recipe before invocation, retain whole outputs/roots/results. Any actual
setup failure remains visible and earns no qualification/retry credit.
The outer test-owned Node runner has no killing timeout or maxBuffer stop;
trusted fixture printing is bounded by the production data/count/path limits.
Actual child command intents, original source/stdout/stderr bytes and original
pipe/child events are retained in the sibling result receipt, before assertions
can misstate success. Natural fixture exit is not unknown-child settlement.

### Task4g.1f optional closed native sidecar build, without loading

Choose an optional code-owned compile/link/inspection preparation. The delivered
direct/header holders are prerequisites; a default npm native build would change
normal installation and a filename-only loader would overclaim identity. This
new slice produces a terminal sidecar DATA context; loading and startup remain
separately required. No existing deployment, dist, selector, native artifact,
service, launchd job, runtime ROOT, PG record or archive is edited or discarded.

File Map: new scripts/dashboard-cutover-native-sidecar-v2.mjs, matching builtin
test, paired design/plan. Existing holders/C/default package/build unchanged.
Only export zero-arg async prepareDashboardCutoverNativeSidecarV2() returning
frozen{observation,recheck,close}. Import alone has no module-owned FS/child/effect
ports; normal trusted interpreter reads of its four code modules are not input
retention or build authority. No
caller context/root/provider/flags/paths, env or cwd selection, no provider
download/fallback. Actual Darwin arm64 fixed Node26.4.0/NAPI>=8/nonroot profile
before ports. One lifetime preparation, activity/revocation burn and fixed
DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED; invalid idle arity zero ports, active
reentry burns. Root is import.meta-derived.

Before retained ROOT acquisition, use genuine transient
observeCurrentFinalizedSetfarmSourceBuildV1() and require fixed Git check-ignore
for own .setfarm/dashboard-cutover-native-v2 path with no system/global config,
hooks/fsmonitor/replacements. Validate/create ONLY physical actualUID0700 own
.setfarm and dashboard-cutover-native-v2 directory, at most two mkdir occurrences.
Never chmod/adopt a preexisting unsafe path. Premark intent before each mkdir,
seal returned physical original before burn checks; failed/unknown effects stay
visible, never removed or retried. This intentional ignored-parent bootstrap
must precede genuine prepareDashboardCutoverNativeBuildInputsV2() because its
ROOT mtime pin must stay unchanged. Fresh source SHA/tree/build must equal
preflight tuple; dirty/nonmain/stale source fails before parent creation.
After the asynchronous Git settles, repeat genuine transient preflight and
compare the same tuple BEFORE bootstrap; source drift during that await refuses
without mkdir. Retain safe/created bootstrap directory originals before header
await, compare the same originals afterward; never adopt replacement parents.

Git check-ignore is ONE separate own asynchronous preflight child, not one of
the four compile/inspection children. Fixed /usr/bin/git argv: -c
core.hooksPath=/dev/null -c core.fsmonitor=false check-ignore -q --
.setfarm/dashboard-cutover-native-v2/; cwd own ROOT. Fixed env PATH=/usr/bin:/bin,
LANG=C,LC_ALL=C,GIT_CONFIG_NOSYSTEM=1,GIT_CONFIG_GLOBAL=/dev/null,
GIT_NO_REPLACE_OBJECTS=1,GIT_OPTIONAL_LOCKS=0,GIT_TERMINAL_PROMPT=0. Premark its
original occurrence before spawn; seal returned child/three pipes before burn
checks, retain original argv/env/pipe events and close0/null with empty outputs.
No retry/kill/destroy; unknown prevents bootstrap. Existing genuine source/header
Git composites retain their unchanged semantics; this adds no per-internal-call
custody or Git-loaded-image certificate.

Hold own additional physical link originals: CLT usr/lib/libtapi.dylib,
libcodedirectory.dylib,libLTO.dylib,libswiftDemangle.dylib; SDK usr/lib/
libSystem.B.tbd and libbsm.0.tbd. All observed regular nlink1 root-owned and
non-group/other-writable; physical targets avoid unversioned .tbd aliases.
Guard ownership is root OR actual UID, matching the delivered closed physical
input policy; ROOT/output parents and files require actual UID. Observed installed
six link files are root-owned, not a requirement that test-fixture files be root.
These are direct link/provider inputs, not a complete loaded-image/OS certificate.
Already-running Node and installed system runtimes remain the declared trusted
cooperative provider. Original ancestors/files, identity/timestamps/hash checked
across awaits;64KiB positional streaming,512MiB/file,1GiB additional aggregate,
128 additional FDs. Existing direct256/include512 caps unchanged. Copy own
9673B C with64KiB bound and compare genuine retained input hash, no cwd path.

Exclusive mkdir0700 generation basename <sourceSha>.<buildHash> under the own
ignored parent. Never adopt, overwrite, resume, remove or retry a colliding or
partial generation. Parent/gen directory originals retained. Own planned-effect
directory ledger checks identity/owner/mode before each nominated creation and
records expected post-effect timestamps; immutable provider guards are never
relaxed to accommodate output. Gen is initially empty; then create exclusive
physical actualUID0700 provider-tmp inside it and set own TMPDIR there for all
compile/inspection commands. After compile exactly provider-tmp, peer.node and
inputs.d; after terminal manifest exactly those plus manifest.json. Successful
provider-tmp must be the same physical original and empty; never delete/adopt
unexpected contents. Directory inventory is checked at each terminal boundary.
Directory timestamps may evolve only at explicitly nominated effects; unexpected
entries or identity/metadata drift burn. This is a closed cooperative builder,
not continuous hostile same-UID exclusion or a general syscall transaction.

Use delivered explicit include/config/profile flags plus -Wall -Wextra -Werror
-O2, -bundle, -nostdlib, --ld-path=<physical CLT usr/bin/ld>; per-symbol
-Wl,-U,_napi_ for exactly create_buffer_copy,define_properties,create_object,
create_uint32,get_cb_info,get_typedarray_info,is_typedarray,is_arraybuffer,
is_detached_arraybuffer,object_freeze,throw_error,is_exception_pending,
get_and_clear_last_exception. No blanket undefined dynamic_lookup. Instead of
-M, use -MD -MF <generation>/inputs.d -MT setfarm-cutover-inputs; stdin via
-x c -, then reset -x none BEFORE physical SDK libSystem.B.tbd/libbsm.0.tbd;
fixed -o <generation>/peer.node. argv/env/cwd are fixed code-owned values,
same finite environment as discovery except own generation/provider-tmp TMPDIR.
LLVM primary reference documents the
flags; prior pristine build is diagnostic only, NOT qualification of this new
explicit-link recipe. Installed CLT token presence not parser qualification.

Four own PLANNED successful children: compile, physical llvm-nm -u peer.node,
llvm-nm -gU peer.node, llvm-otool -L peer.node.
For fixed Mach-O -u inspection parse strict name-only lines, NOT an assumed
address/type table; exports retain exact sixteen-hex-address/type/name lines.
Previous shim-provider receipts are diagnostic evidence, not qualification of
this new physical LLVM provider recipe. The actual reviewed invocation remains
required and cannot silently switch tool/output format.
Header preparation's two discovery children are separate qualified composition.
Premark original child occurrence
before spawn, seal returned child/three pipes before post-spawn checks; no shell.
Copy C to compile stdin; inspection stdin empty. Retain actual stdin write
callback/finish/close, both output end/close, original child close0/null, zero
stderr.256KiB stdout/64KiB stderr/30s mark-only watchdog per child,4children
maximum plus the separate Git preflight; composed NEW child occurrences are one
Git, two header discovery, four builder/inspection (seven total). No signals/
destroy/retry/cancellation. Unknown retains admitted originals, original children,
pipes/buffers/generation and all still-present partial artifacts, prevents later
commands and performs no cleanup. The compiler driver is an explicitly trusted
cooperative composite: it may delegate frontend/linker children, create/remove
temporary files, and remove failed results before builder admission. Driver close
is not universal descendant settlement or custody of already-removed results.
No per-delegated-child FD/syscall proof is claimed. LLVM DriverInternals documents
these boundaries; current Apple recipe still requires actual qualification:
https://clang.llvm.org/docs/DriverInternals.html. Existing source/
header composites keep their unchanged internal failure semantics.

After compile actual close, validate/hold output originals nofollow regular
actualUID/nlink1/non-group-other-writable; bundle <=4MiB, depfile <=256KiB. Compare
strict single-target canonical escaped depfile lexicalset exactly with retained
header observation; ignore only nominated stdin sentinel. Independently check
64-bit Mach-O little-endian magic0xfeedfacf,cputype0x0100000c,
CPU_SUBTYPE_ARM64_ALL=0 (reject arm64e/subtype2/high bits), filetype8. Require
ncmds1..128, sizeofcmds<=file bytes minus32, every aligned command size>=8 wholly
inside the command region/file, and traversal ending exactly32+sizeofcmds before
LLVM inspection. No native require/dlopen evaluation.
nm export set exactly _napi_register_module_v1 and
_node_api_module_get_api_version_v1. Undefined imports only the thirteen declared
NAPI names and known libSystem/libbsm C ABI: audit_token_to_euid/pid/pidversion,
bootstrap_check_in/look_up/port,mach_port_allocate/deallocate/mod_refs,mach_msg,
mach_task_self_,getpid/geteuid,memcpy/memcmp/memset,bzero,__memcpy_chk,
__stack_chk_fail/__stack_chk_guard (Mach-O underscore prefix), and exact raw
dyld_stub_binder without that prefix. No arbitrary bare or _dyld_stub_binder alias.
Require every declared NAPI import. Exact dylib set /usr/lib/libSystem.B.dylib
and /usr/lib/libbsm.0.dylib. Reject extra symbols/deps, wrong architecture/type,
malformed bounded output, mismatched dependency graph or source drift.

Serialize and reject manifest bytes exceeding256KiB BEFORE exclusive open/write.
Publish own manifest.json via exclusive nofollow original FD, bounded write/fsync,
no rename-overwrite. Record source/tree/build, C/input/header hashes,
profile/argv, original successful command receipts, observed imports/exports/
deps and actual bundle/dependency bytes/hash; schema
setfarm.internal-production-dashboard-native-sidecar-build.v2. Explicit terminal
fchmod0444 output/depfile/manifest and fsync generation must be ledgered effects,
then reseal and rehash those same originals and recheck genuine inputs. Fixed
manifest/directory inventory and bytes remain original across later awaits.
Every original file/directory fsync has a phase/FD intent recorded before the
call and returned/unknown disposition before the post-call revocation check.
This terminal DATA is not signed distribution, public release or startup grant.

Observation authority='native-sidecar-build-only', manifest and own generation
locator; no raw FDs/child/native handles. Recheck validates actual immutable
terminal outputs/manifest plus original input context and physical link files.
Explicit idle close allowed only after every admitted original child has closed;
reverse own FD dev/ino/birth/type admission and once-close, stop on first unknown
or revocation, never retry a consumed/reused number, then trusted header context
once. Active close burns without disposal ports; duplicate completed close inert.
Partial output absence never authorizes cleanup. Output file read-only flags
are integrity hygiene, not hostile same-UID access-control exclusion.

Portable consumer tests use NEW genuine own finalized fixtures, only relocated
fixed provider literals in test copies; real FS/Git/FD/hash/ledger/parser/Mach-O
validation, only external async children doubled. Test-created bundle bytes are
diagnostic and never evaluated. Before production code, missing-source cases
fail before fixture/effects. Cover bootstrap ordering/unsafe parent/collision,
dirty/nonmain/stale zero-effect refusal, link alias/hardlink/mode/bounds/drift,
input tuple/graph mismatch, output/header mutation, child unknown/stderr/output
caps/watchdog/reentry, wrong Mach-O subtype/load commands, provider-temp inventory,
preflight child custody, partial publication and once-close/reused FD. Assert
manifest contents independently, not only a digest of whatever was published.
Default
tests never invoke real compiler/inspection/native. Separately reviewed SINGLE
actual fixed-profile new-fixture preparation produces new private output only,
retains all original command bytes/events, never loads it or creates a Mach job.
No killing outer timeout/maxBuffer; preserve failure receipts before assertions.
Inner finally writes one exclusive nofollow600/fsynced bounded5MiB original-command
snapshot to a new sibling OUTSIDE pinned fixture, BEFORE relying on interpreter
exit. Parent full result receipt remains separate. Unknown child can remain
retained without suppressing this durable failure snapshot; no kill/drain/retry.

Task4g.1f qualification: missing-source RED29fail before fixture/effects; genuine
source drift across Git await and original parent replacement across header await
RED preceded their source fixes. Narrow rawdyld and name-only Mach-O nm REDs
preceded those parser fixes. Test-only setup/spy/oracle failures give no transport
RED credit. Frozen portable64PASS/0FAIL/1SKIP299.072s and SINGLE fixed opt-in
65PASS/0FAIL/0SKIP311.197s (actual15.537s); affected direct/header/build suites
337PASS/0FAIL/2SKIP475.199s. Syntax/version/English/path/diff checks pass.
Original actual7child/pipe dispositions are close0/null/zeroerrors/stderr,
9673BC stdin matches source228be6c7; discovery and compiledgraph match268headers.
Actual bundle35784B,depfile24243B,manifest91932B are original0444 hashes,
exact generation inventory and original0700empty provider-tmp. Independently
parsed actual receipts and all284manifest input rows;2454opens/closes include
source verifier transients, not2454retained native inputs. The fixture's own
source/tree/build identities are not production main. Provider recipe is now
qualified for this fixed private fixture, not native evaluation, loaded-image,
owner/phase capability, authenticated transport, freeze, CLI or live3333 startup.

### Task4g.1g bounded four-frame native mechanics DATA

Causal root gap: the delivered two-birth source accepts only equal echo bytes,
disposes endpoints before return and cannot carry HELLO/CHALLENGE/ACK/GRANT.
Choose evolution of its fixed C anchor rather than a caller-selectable parallel
provider/source fork or another load-only DATA helper. Keep all historical
artifacts/receipts unchanged, explicitly supersede the two-method echo API with
V3 methods and service. This changes native diagnostic mechanics, not default
installation/build, launcher, CLI, owner/phase authority or startup admission.
File Map: scripts/dashboard-cutover-mach-peer-v2.c, matching builtin test, paired
spec/plan. Existing direct/header/sidecar holders keep their closed C path and
dynamic byte/hash binding; old qualification does not qualify the new bytes.

Exact frozen native exports, no configuration/role/name/handle/callback inputs:
receiveControllerHelloV3(); challengeControllerAndReceiveAckV3(bytes);
sendControllerGrantV3(bytes); helloClientAndReceiveChallengeV3(bytes);
ackClientAndReceiveGrantV3(bytes). Argument-taking methods accept exactly one
actual Uint8Array/Buffer backed by nonshared/nondetached ArrayBuffer, intrinsic
length1..1024; copy before acquisition. receiveControllerHelloV3 has zero args.
Initial invalid arity/data and wrong initial continuation admit no kernel calls
and preserve the initial attempt. ACTIVE reentry burns before inspecting args.
After session reservation, wrong role/stage/environment burns before new ports;
invalid idle payload/arity at the correct stage preserves original custody.
One module-wide atomic session, original napi_env bound at first winning claim.
All errors exactly DASHBOARD_CUTOVER_MACH_CONTROL_REFUSED.

Fixed service com.setrox.setfarm.dashboard-cutover.control.v3 prevents reuse of
historical v2 diagnostic service names. No production job created by this slice.
Controller first checks in original RECEIVE R and receives HELLO, then returns
copied frozen {bytes,euid,pid,pidversion} DATA while retaining R/T_HELLO. This
intentional JS boundary allows observed phase5 restoration and phase6-intent
work before CHALLENGE. challengeControllerAndReceiveAckV3 sends CHALLENGE via
T_HELLO once, receives ACK on original R, and returns copied DATA retaining
R/T_ACK. sendControllerGrantV3 sends GRANT via T_ACK once; only successful send
permits original R surrender, then returns frozen empty terminal DATA.
Client first looks up original SEND S, allocates original RECEIVE Q, sends HELLO
and receives CHALLENGE, returning copied DATA while retaining S/Q. Its final
method sends ACK and receives GRANT, then disposes Q followed by S once and
returns copied frozen {bytes,euid,pid,pidversion} DATA. No reacquisition.

HELLO and ACK each COPY_SEND S plus MAKE_SEND_ONCE Q. Controller receives distinct
T_HELLO/T_ACK occurrences (numeric names may recycle after settled transfer);
CHALLENGE and GRANT MOVE_SEND_ONCE the respective original, null local/voucher.
Message IDs exactly0x53463331/32/33/34 in order. Controller received header bits
PORT_SEND_ONCE/PORT_SEND, local original R; client received bits0/PORT_SEND_ONCE,
remote null, local original Q. Four fixed immutable frame slots preserve each
original send/receive buffer, length, status/header/trailer and right occurrence.
Never overwrite earlier frame originals to prepare a later message. Premark all
acquisition/send/receive/disposal intents and seal returned names/status/buffers
BEFORE post-port burn checks. Every kernel/BSM port and normal post-reservation
Node-API DATA-publication port checks ACTIVE immediately before admission;
already admitted calls may seal after concurrent burn but no later normal port
is admitted. Preclaim intrinsic Node-API argument checks are an explicit
exception, guarded by initial-stage/original-environment eligibility and zero
kernel calls. The bounded fixed refusal publisher may check/clear pending
exceptions and throw the fixed error after BURNED; it authorizes no acquisition,
protocol continuation, success publication or disposal. No kernel-name
inequality as an occurrence identity shortcut.

Validate received opaque length independently1..1024, exact bounded header/body
size/zero padding/simple bits/messageID/voucher/names and rounded FORMAT_0 AUDIT
trailer/type/exact size before public BSM accessors. No JSON or echo equality in
C. First received euid equals current nonroot uid, pid is positive/nonself and
pidversion positive; each role's second original kernel tuple must equal its
first. That is peer continuity DATA, not source/build/owner authentication.
Native publication checks ACTIVE after every Node-API port and atomically
advances only after copied/frozen result construction. Unknown native/NAPI/
header/tuple/disposal result burns and retains all originals; no destroy,
retry, resend, close-after-unknown, finalizer or generic cleanup. Inline bounds
are not a public hostile OOL-resource certificate; only closed cooperative
admitted producers are nominated. No new NAPI imports beyond the existing13.

Functional RED precedes C changes: ONE new private pristine compile/inspection
and real Node consumer calls the absent V3 methods with invalid inputs, before
any Mach/job effects. Missing method, not source-text matching, is the expected
failure. Compiler/link/load/capture failures are unqualified. Existing fixed
diagnostic compile recipe may be used with original receipts; no old artifact
reuse or whole compiler/loaded-image authority. Default portable suite skips
native diagnostics; no package/hardware enrollment change.

Then test-owned C copies double only external Mach/BSM boundary ports, exercising
the actual compiled C/Node-API state/header/parser/copy/publication logic. Literal
different hello/challenge/ack/grant payloads, exact call traces, distinct buffer
storage and original once-only right occurrences; malformed frames, second-peer
tuple drift, wrong role/stage, active reentry and every unknown port stop later
calls. Test-only doubles must be in the test prefix, never production knobs.
Fresh real campaign separately reviewed: at most3new private owned jobs, success,
controller ACK successful-receive header fault, client GRANT successful-receive
header fault. All artifacts/jobs/original intent/results retained. No bootout,
signals, killing timeout, retries or process-death settlement inference.
New C/ABI/provider recipe must be requalified with ONE fresh genuine sidecar
fixture; retain1f historical receipt but never borrow it for changed source.

Native methods/decoded GRANT remain DATA ONLY. Genuine private loader with
original cache/exports and guarded calls, executing-source/build authentication,
finite already-entered producer drain, genuine owner+branded restored-phase6,
child-local nonforgeable startup grant, actual foreground CLI and clean-main
build/live3333 acceptance remain required. No universal native/S10 barrier.

Campaign selection is test-owned and closed: initial/pristine API consumer only
SETFARM_DASHBOARD_MACH_PEER_TEST=1 with its exact test-name pattern (5commands,
0jobs); compiled kernel-double matrix only SETFARM_DASHBOARD_MACH_CONTROL_PORT_TEST=1
(one4-command artifact and at most36fresh Node consumers,40commands,0jobs);
real3-job campaign only SETFARM_DASHBOARD_MACH_CONTROL_REAL_TEST=1 (at most
31commands including one5-command pristine consumer,3jobs). Reject mixed enabled
selectors before effects. Preserve existing40command ceiling, per-child20s
mark-only watchdog and2MiB capture; never combine all campaigns under one flag.
Kernel/BSM doubles and one explicitly nominated post-success Node-API freeze
burn cover those boundaries, not every possible Node-API failure. Production
native send/receive uses fixed5s interrupted/non-retrying timeout; future phase5
integration must fit its independently qualified finite budget or nominate a
causal timeout change, never waive restoration or infer a grant on expiry.

The test prefix retains four bounded independent original frame-memory copies
and checks them before every later kernel port. BSM calls have separate literal
traces, including early tuple-drift refusal. Test-only forwarding wrappers of
existing get_cb_info/get_typedarray_info retain the current synchronous caller
buffer only until result freeze/new callback entry; fake boundary calls overwrite
that caller buffer, while real production copied wire bytes must remain correct.
No production debug export/knob or extra Node-API imports. Successful-return burn
cases now actually reenter the real controller entry with null callback info
while ACTIVE, observe/clear its pending exception in the trusted prefix, then return
the original successful provider result. That tests reentry before argument
inspection, not merely assigning a private lifecycle value. The nominated
post-success freeze wrapper similarly reenters after real successful freeze.
Foreign napi_env actor and exhaustive Node-API error injection remain unqualified.
One additional nominated intrinsic get_cb_info unknown-status witness is admitted
only after successful controller HELLO publication, once in the existing36consumer
matrix. Valid invalid-input checks are folded into positive consumers. Unknown
Node-API status burns even in preclaim validation; only successfully observed
invalid shape/arity preserves custody. The next same-stage valid continuation
must refuse before any new kernel port, tested before any wrong-stage call can
mask revival. The test wrapper forwards the real intrinsic call before returning
its one-shot generic-failure status. No new actor/import or job/budget expansion.

Task4g.1g qualification: pristine old-source functional RED1c6c23 and compiled
matrix API RED e80b2a preceded C implementation. Test-prefix indentation failure
d0de5f is setup only, no RED credit. Independent review found intrinsic-unknown
held-stage revival; functionalREDd945f8 observed actual next send/receive after
generic Node-API status before the causal ARG_PORT fix. All failed originals
retained, never replayed. Final C2d5698bd13573B/teste1fbed5b freezes V3 mechanics.

Compiled kernel-double matrix d7df7a→850307:36fresh consumers/40originalcommands,
1PASS/0FAIL1758.308ms, no jobs. Separately nominated SINGLE real campaign
a9dbfb→5075c1:4PASS/0FAIL/1SKIP3344.763ms,31originalcommands/3new private retained
jobs. Actual positive33166↔33167/uid501/versions62811296,62811298 exchanges literal
hello/challenge/ack/grant; complete native traces and own terminal disposal.
Controller ACK and client GRANT header mutations occur only after successful
second receives, with no later native ports on faulted roles. All original
intents/results independently read: complete0/null/EOF/close, no capture unknown,
overflow or watchdog. Natural process exit/job bootstrap is not resource closure.

Changed C independently requalified ONE unchanged genuine sidecar recipe:
1a9202→e8f1f4 ROOTZUoeY7,1PASS/0FAIL14979.014ms (actual14935.531). Seven original
commands close0/null/fullpipeevents/error0/stderr0; three original13573B stdin
copies bind C2d5698bd;268headers. Actual0444 bundle36008B/1a98fa8e,depfile24243B/
11ceabfb, manifest91935B/b2d9f576, exact inventory and0700emptytemp. Parent receipt
16a038bc/innerdbd82caf retained;2454opens/closes include verifier transients.
Fixture source9a1bd8cf/tree307f9f0d/build57689289 is NOT production main identity.
Direct/header focused8PASS/0FAIL4997.507ms; pure control-wire29PASS/0FAIL438.671ms
uses existing canonical tsx4.22.4 loader explicitly, no install or repo mutation.
Initial missing-local-tsx setup error is not a product regression or passing run.
Syntax/version2.3.79/English1981/path995/diff pass. This qualifies mechanics and
private compile/inspection DATA only; private actual load/authentication, finite
drain, genuine owner/phase6, child startup grant, controller/foregroundCLI and
clean-main/live3333 remain open. No default-build, live-service or full-goal claim.

### Task4h.0 genuine source-integrated local invocation gate

The retained original invocation problem is causal to the approved cutover, but
a new registry cannot enroll historical loaded actors. Implement a narrowly
qualified new-version local gate, not a global freeze certificate. Alternatives
are a sampled empty count (insufficient) or full cross-process/child authentication
in one unit (not yet nominated). Choose the real local gate with explicit limits.

New internal module baseline-dashboard-cutover-local-producer-drain-v2.ts owns
one ESM-instance lifetime. Trusted source helpers
withDashboardCutoverLocalProducerSyncV2(kind,body) and
withDashboardCutoverLocalProducerAsyncV2(kind,body) use exactly these primitive
string kinds: `configuration-write`, `atomic-configuration-write`,
`medic-install`, `medic-uninstall`, `workflow-uninstall`, `all-workflows-uninstall`,
`workspace-cleanup`. They are internal source integrations, not user callback
endpoints or controller/owner grants. No injected observation, original promise
list, child, process identifier, root, settled flag, reset or release exists.

Register the original invocation synchronously before calling its body. Retain
its actual returned native Promise until fulfillment or rejection, and retain
each independently registered nested invocation separately. AsyncLocalStorage
provides private original ancestry, never a caller continuation token. Ordinary
behavior before closure stays unchanged: a delayed ended ancestry may enter as
a new root while admission is still open. After closure it cannot enter. An
already registered, still-live descendant may complete and register its own
nested local calls even if its parent body has ended. A sync body returning a
Promise is protocol uncertainty and burns rather than falsely declaring drain.
Retain that mistaken original and observe its eventual rejection when observation
is known; burn is not permission to discard it. Use the retained intrinsic native
then for settlement accounting, not await adoption or an own `then` method. If
constructor/species metadata makes observer registration unknown, burn and retain
the original with fixed refusal; do not claim its future rejection was observed.
Never finish a record merely because adoption/observer setup threw.

Zero-argument acquireDashboardCutoverLocalProducerDrainV2 permanently closes
fresh roots synchronously, before its first await. It waits for all admitted
original bodies/promises and registered descendants to terminate. No timeout,
polling, signal, cancellation, cleanup or automatic reopening. Calling acquire
inside a live local producer refuses before waiting on itself and does not
consume the outside acquisition. Invalid idle arity refuses before caller code
or closure. A second valid acquisition attempt burns the first/held generation;
swallowing that refusal cannot produce a handle. Unknown accounting also burns.
Burn notifies an already-pending acquisition to publish fixed refusal, while
retaining every unknown record/original. Do not leave a known-burned acquisition
waiting for a Set that deliberately cannot become empty; no operation is canceled.

Mint only when closed admission and the actual live Set is empty, with no burn:
an empty frozen null-prototype object held in a private WeakMap. The synchronous
assertDashboardCutoverLocalProducerDrainV2 validates this original handle plus
closed/empty/unburned state. Foreign, copied, proxied or wrong-instance handles
refuse without caller traps; invalid assertion does not mint or replace anything.
Fixed error: DASHBOARD_CUTOVER_LOCAL_PRODUCER_DRAIN_REFUSED.

Wrap writeOpenClawConfig, atomicWriteSync, installMedicCron, uninstallMedicCron,
uninstallWorkflow, uninstallAllWorkflows and cleanAgentWorkspace around their
entire existing bodies. The wrapper precedes consumer parameter inspection and
first await/port. Existing OPEN refusal, path protection, rechecks and caller
return/error behavior remain. Admitted nesting stays possible during drain,
but cannot bypass those existing guards. Return adoption must include Medic's
original returned installSystemdMedicTimer Promise. The sync cleaner's wrapper
is outside its best-effort catches, so fresh denial cannot be swallowed inside
the body and followed by later deletion attempts.

The capability proves ONLY this module instance's nominated registered
JavaScript invocation termination and denial of fresh local entry. Rejection is
observed body termination, NOT effect settlement. It proves neither original
child/pipe exit, remote response/effect settlement, daemon death, old-module or
other-process drain, all queues, Worker instances, direct guidance/gateway/Medic
runtime entrypoints, transition-helper exclusion, ROOT preservation nor startup
authority. An unregistered queued callback is denied at the wrapped boundary;
its earlier unwrapped effects are not covered. The existing lost teardown chain,
discarded timed execFile children and stale ROOT-unlink counterexample remain
separate obligations. Full adapter composition must authenticate/settle those
originals independently; a fresh empty registry is never legacy closure.

Qualification uses genuine module handles and actual selected/imported consumer
bodies with inert external ports. Natural test children retain exit/EOF/close;
no provider, launchd, native campaign, PG, real cleanup or user configuration
mutation. The amended nineteen missing-module cases precede the initial source;
three native-metadata functional REDs precede the intrinsic-accounting fix and a
pending-descendant-burn functional RED precedes waiter notification. Additional
held/wrong-instance, business-error/non-native and full-imported consumer cases
are supplemental coverage after implementation, not pre-source RED. The final
matrix has nineteen lifecycle cases, seven AST-selected fresh-consumer denials
and one Medic original-return control; four full-imported configuration/Medic
closed-gate controls and prior guard suites also pass. No live effect follows
from this local handle alone.
