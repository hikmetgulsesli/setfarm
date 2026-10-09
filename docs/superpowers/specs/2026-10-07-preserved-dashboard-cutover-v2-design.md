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

## Task4h.1: settle original gateway CLI caller failures

Causal scope refinement: admitted Medic removal and workflow uninstall await
gateway cron calls. The private runCli currently uses an async Promise executor;
binary-lookup rejection or synchronous execFile throw rejects its discarded
executor Promise, leaving the original public caller pending. A retained local
invocation cannot terminate on that path. Correct this root bug without claiming
child, pipe, remote-effect, legacy-cohort or global freeze settlement.

Prefer async runCli with awaited binary lookup followed by a synchronous Promise
executor around execFile. An explicit catch in the async executor could forward
the two failures but retains the unnecessary discarded Promise; a new process
manager would broaden scope. Preserve configured binary preference/cache, PATH
then npx fallback, literal arguments, 30,000ms timeout, callback stderr precedence,
HTTP-first behavior and disabled-fallback error. No credentials or guards change.

Full-module public deleteCronJob regression consumers trap HTTP, filesystem
config reads and subprocess ports before import. Lookup and invocation throws
must yield the existing soft failure, no unhandled rejection, and actual caller
settlement at bounded event-loop checkpoints. Unsettled RED promises are never
awaited indefinitely, canceled or killed. Consumer children end naturally with
both pipe EOF and close retained. Fresh module state isolates cached binary and
disabled-fallback state. Add unchanged configured/PATH/npx forwarding, callback
error, disabled zero binary-discovery/CLI-port and HTTP success controls. Replace the existing model
test's real-CLI fallback/cleanup with the same inert fixture and exact --model
argument assertions; no real cron or provider action is a test prerequisite.

## Task4h.2: retain the actual deferred run-cron teardown queue

Causal scope refinement: terminal step transitions call scheduleRunCronTeardown.
Its outer lookup chain currently loses the nested teardown Promise; teardown
can wait five minutes and then dispatch gateway deletion after terminal DB state.
Neither the terminal row nor public void return proves this queue has ended.

Extend the closed local kind vocabulary by `run-cron-teardown`. Register the
actual schedule body before getWorkflowId, adopt lookup plus the entire nested
teardown Promise into that independently retained record, and preserve public
void/fire-and-forget return. Keep separate teardown-error and scheduling-error
logging; observe wrapper rejection outside the body so closed admission cannot
produce an unhandled rejection. Denied scheduling reaches zero lookup, grace,
teardown or gateway work ports; refusal logging is permitted. Existing grace
duration, active-run checks, gateway policy and deletion behavior are unchanged.

Preferred implementation is the existing trusted async wrapper with awaited
lookup and teardown. Merely returning the inner Promise repairs one lost chain
but supplies no admission/drain retention; changing public return to Promise
would unnecessarily change callers. No cancellation, polling, shortened grace,
terminal-row inference or remote-effect settlement claim is introduced.

Regressions select the exact full schedule function AST and bind the genuine
local registry plus inert lookup/teardown/logger ports. Do not import the real
PG-bearing cleanup module. A pending lookup and independently pending teardown
must each prevent a local handle; closure denies new scheduling before lookup.
Include natural no-work, known failure/logging and detached-parent controls.
This supplies only current-instance registered JS queue termination. Legacy
other-process cohorts, original gateway/Medic children, remote effects and the
complete six-effect adapter remain separate required outcomes.

## Task4i: approved dashboard-job endpoint revision

The user's continuation on 2026-10-09 approves the previously asked narrow
revision: add ONE fixed dashboard-owned MachServices entry. Original launcher
files, deployments and worktrees remain held, immutable provenance. The new
definition is a separately identified approved derivative, never described as
byte-identical original restoration. Keep the original seven dashboard fields
and all spawner material unchanged; add only
`com.setrox.setfarm.dashboard-cutover.job.v4` with `ResetAtClose: true`.
V1/V2 material validation and the qualified V3 transport remain unchanged.
This supersedes only the earlier prohibition on this single addition.

### Task4i.0: closed job-routed four-frame mechanics

Create a distinct V4 C consumer. Fixed controller service is
`com.setrox.setfarm.dashboard-cutover.control.v4`; the dashboard service is
`com.setrox.setfarm.dashboard-cutover.job.v4`. No service-name argument,
anonymous receive-port allocation, caller callback, retry, relookup or reset.
The five frozen native methods are receiveControllerHelloV4(),
challengeControllerAndReceiveAckV4(bytes), sendControllerGrantV4(bytes),
helloClientAndReceiveChallengeV4(bytes), ackClientAndReceiveGrantV4(bytes).
Input is intrinsic non-detached Uint8Array over ArrayBuffer, 1..1024 bytes,
copied before any kernel port. The outputs remain frozen DATA-only byte and
kernel audit-tuple records, or a frozen empty terminal record. Retain the V3
atomic single-lifetime/environment and sticky uncertainty rules.

Client checks in the fixed dashboard receive endpoint BEFORE looking up the
controller. Controller checks in its own endpoint and receives HELLO. Only the
second controller method looks up the fixed dashboard endpoint, exactly once.
Use that original send occurrence for BOTH CHALLENGE and GRANT. Never deliver
the challenge through a HELLO-supplied port. The four exact send profiles are:

| Frame | Destination occurrence | Local disposition |
| --- | --- | --- |
| HELLO | original controller lookup, COPY_SEND | none |
| CHALLENGE | original dashboard lookup, COPY_SEND | MAKE_SEND_ONCE from controller receive endpoint |
| ACK | original CHALLENGE reply, MOVE_SEND_ONCE | none |
| GRANT | original dashboard lookup, COPY_SEND | none |

The client retains the incoming CHALLENGE reply occurrence before validation;
only its successful ACK send settles it. All other received frames require no
remote right. Validate exact header/dispositions, id, length, zero padding,
voucher, audit trailer, and original HELLO/ACK or CHALLENGE/GRANT tuple equality.
Each frame has distinct immutable storage. Unknown acquisition, send, receive,
publication, disposal or reentry burns, retaining uncertain originals without
blind destruction. Successful terminal mechanics dispose each owned receive
and original lookup send occurrence once; this is not later listener liveness.

The intended proof is fresh challenge access through the declared endpoint and
original sender-birth continuity UNDER reviewed nonforwarding receiver code and
retained declaring-job/source/build material. It is NOT universal receiver-birth
attestation: receive rights are transferable and audit trailers identify the
sender. The actual adapter must create and compare private unpredictable nonce
and complete transcript, retain genuine owner/pre32/phase capabilities, observe
phase5 restoration, publish phase6 intent before challenge/grant, and admit the
same foreground CLI listener. Decoded bytes and successful transport never mint
those capabilities. Existing safety guards and zero-owner conditions stay.

Task4i.0 qualification compiles the actual C translation unit with doubled
external Mach/BSM ports and calls its actual internal mechanics. These tests
establish routing/disposition and post-burn port denial, NOT production step()
failure-to-burn orchestration, kernel/job/domain/source AUTH or Node-API
publication qualification. The harness sets private lifecycle for direct
mechanics calls; that assignment earns no production burn credit.
One separately enabled campaign retains
all original compiler/consumer receipts, natural exit and both pipe EOF/close;
no launchd jobs, provider, DB, ROOT, CLI or old native campaigns are exercised.

Production composition additionally requires separate current-host negative
check-in/collision/domain/reset qualification, held derivative material, exact
sidecar build-input qualification and actual adapter/foreground consumer tests.
Missing declarations must never be probed in ordinary production. Those remain
required; no full cutover or completion follows from Task4i.0 alone.

Primary interface evidence: [Apple bootstrap interface](https://raw.githubusercontent.com/apple-oss-distributions/launchd/main/liblaunch/bootstrap.h)
documents receive-right check-in and send-right lookup; [Apple Mach overview](https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/KernelProgramming/Mach/Mach.html)
documents transferable rights. These are interface/trust-boundary evidence,
not current-host qualification receipts.

### Task4i.0b: actual five-method Node consumer qualification

Compile the same V4 source as a real Node addon with doubled Mach/BSM ports.
Use a distinct opt-in campaign, mutually exclusive with direct mechanics and
baseline modes. Remove the fixture-only static module override/main; preserve
real exports, step(), input intrinsics and Node-API publication. Each case is a
fresh original Node process, never a reset of private state. Derive fixture role
only from the first fixed check-in; fault selection is fixture-only getenv.
Keep original immutable frame checks and pin the changed fixture separately.

Require exact five frozen exports, input/proxy/detached/shared-buffer refusal
before any doubled kernel port, actual copied output bytes, exact frozen record
keys/tuples, original peer continuity and empty controller terminal record.
Exercise both success paths, all sixteen nominated external-port failures, six
malformed/tuple cases, plus client tuple/header/reply-disposition controls.
After success or failure invoke every real method again: fixed refusal and no
additional doubled kernel dispatch. This qualifies externally sticky refusal
through actual step() and successful Node-API publication ONLY with doubled
external ports. Exact private failure-to-BURNED transition remains a source
review claim, not a black-box private-state oracle. It does
not qualify injected Node-API failures/reentry, real kernel/job/domain identity,
loaded sidecar inputs, owner/phase/nonces or startup/listener authority.

Closed recipe: one compilation, nm undefined/export audit and otool dependency
audit, twenty-eight fresh consumers; maximum32commands, zerojobs. Each original
command retains natural exit, both EOF/close and fixed20s mark-only watchdog.
No kill, cleanup, retry, prior campaign replay or live fixture adoption.

## Task4h.3: source-owned nominated child custody

Causal need: gateway and Medic can settle their ordinary callback/promise while
the originally dispatched child or output pipes remain unresolved. The current
V2 JS handle must remain JS-only. Add a distinct V3 child-custody handle in the
SAME private ALS registry, integrating the two gateway callback launch ports
and two Medic promisified helpers. No public attach(child), caller-provided
child/PID/birth, provider injection, permit, settlement boolean or reset.

Trusted callback integration has exactly these typed overloads:

```ts
type LocalChildCallbackV3 = (error: ExecFileException | null,
  stdout: string, stderr: string) => void;
function execFileDashboardCutoverLocalChildV3(file: string,
  args: readonly string[], callback: LocalChildCallbackV3): void;
function execFileDashboardCutoverLocalChildV3(file: string,
  args: readonly string[], options: ExecFileOptionsWithStringEncoding,
  callback: LocalChildCallbackV3): void;
function execFileDashboardCutoverLocalChildAsyncV3(file: string,
  args: readonly string[], options: ExecFileOptionsWithStringEncoding):
  Promise<{ stdout: string; stderr: string }>;
```

Preserve actual UTF-8/default encoding options; consumers ignore the original
ChildProcess return. Async uses the captured builtin promisified result/rejection
and options but never exposes its private original promise.child. Acquisition is
acquireDashboardCutoverLocalChildDrainV3(jsDrainHandle):Promise<object>;
assertDashboardCutoverLocalChildDrainV3(childDrainHandle):void. Only the genuine
same-instance V2 JS handle is accepted, not a caller closure/count or brand.

Reserve a child occurrence for EVERY dispatch through these four source ports,
including ordinary roots while admission is open, BEFORE dispatch. Invoke the
actual captured Node execFile primitive,
or its builtin promisified implementation, and seal the original returned
ChildProcess and original stdout/stderr synchronously before yielding. Retain
owned stdin if supplied by the builtin and require its original close, but no
input EOF for this writable stream. Original promises, children, streams,
dispatch attempts and observer outcomes remain private. No child is returned
to callers. Duplicate/missing/fake originals or observer/dispatch uncertainty
burn ONLY child authority and retain the attempted/returned originals.

Settlement requires the same original child's natural exit and close with
integer exit status/null signal, both original output end AND close events,
consistent observations and no child/stream errors. Nonzero natural exit may
settle custody while ordinary business rejection remains. Callback/promise
completion, killed flags, timeout, exit alone, destroyed pipes or close without
EOF never settle custody. Use captured intrinsic prependOnceListener before
existing business/error listeners; a throwing callback must not prevent prior
custody observation. Observers burn without throwing into ordinary dispatch.
No added kill, cancellation, timeout, retry or cleanup.
Review assumes pinned closed Node/loaded consumer code; public EventEmitter
observations do not establish universal resistance to hostile same-process
prototype/event synthesis. No grandchildren/remote-effect closure is claimed.

Preserve ordinary callback arguments/errors and promisified result/rejection
without waiting for custody or replacing failures with a drain error. Child
burn must not prevent ordinary pre-closure fallback (e.g. failed which→npx).
Continue recording still-permitted admitted dispatches even after child burn.
Keep uncertainty per occurrence: independently known later originals may leave
custody after complete natural settlement even though authority stays permanently
burned. Retain genuinely uncertain records; no global-burn memory leak of every
future ordinary child/result. A never-spawned constructed ChildProcess is refused;
positive original PID is sanity data only, not birth/owner authority.
Existing timeouts/maxBuffer/arguments/environment/cached binary remain unchanged.
An inert execFile double returning undefined or a fake child preserves ordinary
business results but can never mint child authority. JS authority is unchanged.

Coverage is all original children dispatched through the four source ports in
this authenticated module instance, NOT every gateway JS/HTTP root. Before local
closure, ordinary and ended-ancestry roots preserve business behavior and record
their child attempts. Once JS admission closes, only genuine still-live
registered ALS ancestry may finish/nest; fresh roots, outside-ancestry Medic
status and ended queued ancestry refuse BEFORE execFile. This four-port launch
fence is causally necessary: ignoring fresh status/gateway launches leaves child
closure unstable. No new JS kind or whole JS/HTTP lifetime claim. Independent
HTTP roots, legacy actors, remote effects, descendants and other module/process
instances still require separately qualified profiles.

V3 acquisition is once-only, rejects self-acquisition, requires the actual V2
handle and waits for its private admitted-child occurrences to settle. A known
burn wakes a pending acquire with a fixed secret-free refusal, retaining unknown
originals. Retain the SAME original V2 handle privately; validate it at entry,
after every wait, immediately before V3 mint and on every V3 assertion. Existing
JS burn must also notify a pending child wait so it promptly refuses, without
releasing child/JS originals. A previously minted child handle fails when that
prerequisite burns. Child burn does not conversely invalidate the JS handle.
Successful publication is an empty frozen null-prototype WeakMap
handle. Wrong arity/foreign/proxy/wrong-instance/V2-as-V3 handles refuse; repeated
acquisition burns child authority without affecting existing JS authority.

Qualification is actual source consumer behavior and fresh bounded one-shot
Node children with natural close/EOF. No real cron, systemctl, gateway, PG,
provider, signal-driven timeout campaign, live job or old fixture replay.
Synthetic missing/error/timeout samples earn refusal credit only. The capability
is NOT global/legacy/remote/descendant/source/owner/phase/startup authority.

## Task4i.1: opaque held approved dashboard definition V4

Causal need: the approved job-owned V4 endpoint requires a declaring dashboard
definition. Keep original home plists, worktrees, deployments and seven values.
Alternatives: controller rendering exports secret-bearing originals/accepts
caller material; editing the home plist violates preservation. Select a separate
opaque derivative inside the EXISTING launcher material provider, borrowing
genuine same-instance V2 material. No public renderer/bytes/hash/path getter,
caller path/account/options, callback, effect permit or bootstrap API.

```ts
declare const approvedDefinitionBrandV4: unique symbol;
export type HeldDashboardCutoverApprovedDefinitionV4 = object & {
  readonly [approvedDefinitionBrandV4]: never;
};
export function holdDashboardCutoverApprovedDefinitionV4(originalMaterial: object):
  HeldDashboardCutoverApprovedDefinitionV4;
export function assertHeldDashboardCutoverApprovedDefinitionV4(
  definition: HeldDashboardCutoverApprovedDefinitionV4): void;
export function closeHeldDashboardCutoverApprovedDefinitionV4(
  definition: HeldDashboardCutoverApprovedDefinitionV4): void;
```

Runtime handles are empty frozen null-prototype WeakMap objects, not compile-
time brand authority. Exact one argument. Idle foreign/proxy/copied/wrong-instance
or extra arguments refuse before caller traps/artifact ports without burning a
valid idle original. Fixed secret-free error:
DASHBOARD_CUTOVER_APPROVED_DEFINITION_REFUSED. Active nested V2/V4 operations
burn the ORIGINAL active material before further ports/publication, even if
swallowed. Never bypass assertLauncherMaterialIdleV2 during pre32.

Privately render only the validated dashboard tree: exact original seven values
plus MachServices:{"com.setrox.setfarm.dashboard-cutover.job.v4":{ResetAtClose:true}}.
V1/V2 seven-key input validation remains unchanged, rejecting MachServices and
Sockets. Deterministic UTF8 XML escapes string/key characters; malformed
surrogates/XML1.0 unsupported controls refuse BEFORE artifact publication.
CR uses numeric &#13; so XML newline normalization cannot change the original
value. Supplemental private-renderer mechanics may cover CR/LF/TAB/entities and
supplementary Unicode separately; values rejected by unchanged original loaded
material parsing cannot become a genuine V2 input through test instrumentation.
Rendered bytes are bounded by existing1MiB launcher limit. Final read-back must
equal private rendered bytes/identity; independent plutil parse in tests checks
the semantic oracle. No secret-derived public hashes/values/errors or new
launchctl call after original acquisition; no PG/provider/DB operation.

Fixed account-home sibling namespace (NEVER inside exact cutover history ROOT):
home/ai/setrox/data/internal-production-baseline/dashboard-cutover-approved-definitions-v4.
Workspace/data/baseline MUST exist. Pin every original physical nofollow ancestor,
actual owner UID/device and no group/other-writable account-owned scope. Existing
collection is0700; missing collection alone may be created once0700 after genuine
baseline pins. One fresh private lowercaseUUIDv4 attempt directory0700, fixed
com.setrox.setfarm-dashboard.plist basename0600. No caller names, collision retry,
overwrite/link/chmod of old parents/unlink/delete/historical adoption/history
mutation. All artifacts remain visible. This is preflight material preparation,
NOT any of the six service/selector dispatches or owner authority.

Reserve the one derivation attempt on ORIGINAL V2 state before render/FS ports.
The configuration closure retains its derivative attempt object BEFORE factory
render/FS work, including when the factory throws before returning a lease.
Register every returned original FD before fallible sealing; retain original
attempt/resources on uncertainty. Bracket every non-cleanup admitted port with original
material/account and ancestor/file checks; swallowed reentry/drift stops the
NEXT port and publication. Full bounded write, file fsync and attempt/collection/
baseline directory fsync precede handle publication. Final nlink1/mode0600/owner/
device/file/byte identity is pinned. Derived descriptors remain separate from
borrowed material. Acquisition has explicit precreation, partial-write and final
sealed checks: its own permitted writes change size/timestamps, but never refresh
immutable identity after unexpected drift. Once sealed, full final identity and
bytes remain original and unchanged. Derived descriptors remain separate from
borrowed V2 descriptors. Partial write/sync/sealing/unknown close cannot mint
or reacquire; failed acquisition retains its privately registered originals and
created artifacts. No cleanup retry of possibly consumed descriptors.

Assertions revalidate SAME original V2 state and derivative pins/bytes without
loaded-job sampling. Original V2 close/invalidation invalidates derivative.
Public V4 calls during outstanding original pre32 callback/driver refuse with
zero FD closes, keeping original callback custody. Future source-owned executor
checks must compose privately with that SAME active original; not supplied here.

Checked-once derivative close reserves closed state before reverse consumption
of only its own original FDs; no borrowed V2 close or artifact deletion. Genuine
idle derivative may close its known originals once even after borrowed material
invalidates, never restoring authority. Duplicate idle close has zero ports;
This cleanup-only exception authenticates original derivative identity, idle
activity and once-only disposition, not validity of the already-burned borrower.
consume before each close, response loss burns and cannot retry reused FDs.
Active reentry cannot close another operation's resources.

Qualification: actual source, retained real private FS, inert exact launchctl-
print/pre32 ports. Independent parsed XML/unchanged original bytes/inodes/spawner,
opaque secret-free interfaces, XML escaping, sticky original/ancestor/derivative
drift, foreign/once-only handles, partial write/sync/close loss, swallowed active
and pending-pre32 reentry. No host job/bootstrap/systemctl/PG/provider/native
campaign/selected deployment mutation. Material/FD success is NOT job/source/
build/owner/phase/control/startup/foreground authority. Current-host negatives,
sidecar build inputs, six-effect adapter and legacy closure remain required.

Task4i.1 source qualification receipt: initial missing-export0P3Fdfce18 before
production. Four causal source-port/stage/mode negatives3cb989 actually RED,
then7GREEN258e94/37295e after smallest guarded corrections. Final197P0F0SKIP
d61142/1fa9c8,29249.032125ms (32V4/47materialV2/118launcherV1), original private
FS/plutil + inert job/pre32 ports only. Copied private-renderer mechanics for
malformed surrogates and CR do NOT assert those are genuine V2 loaded inputs.
Strictf7b28a/35ab8d1193files0diagnostics after explicit refusal-branch return;
old V1/V2 test changes loader/owned fixture retention only. Earlier failed
fixture expansions are recorded separately, not claimed as production REDs.
Opaque data/FD behavior credit ONLY; no full build, current-host endpoint/source,
owner/phase/control/adapter/foreground/clean-main/live3333 authority follows.

## Task4i.2: retained fixed V4 native build binding

Extend the existing direct-input, dependency and sidecar providers with exactly
three zero-input V4 entries, not caller-selected inputs or raw addon access:
holdDashboardCutoverNativeInputsV4(), prepareDashboardCutoverNativeBuildInputsV4(),
prepareDashboardCutoverNativeSidecarV4(). They return the same frozen DATA-only
holder shape with recheck()/close(). Existing V2 functions remain fixed to V3
scripts/dashboard-cutover-mach-peer-v2.c with unchanged V2 schema and namespace.
V4 functions fix scripts/dashboard-cutover-mach-job-peer-v4.c in their private
original chain. One shared attempt/activity/uncertainty vault within each existing
provider prevents simultaneous or replacement V2/V4 acquisition; profile choice
is made internally once before admitted provider work, never switched thereafter.
Wrong arity/proxy arguments have zero ports and do not consume an idle original;
active cross-profile reentry burns that same original before the next port.
Fixed secret-free existing refusal literals and once-only cleanup remain.

Exact V4 schemas:
setfarm.internal-production-dashboard-native-direct-inputs.v4 (direct-inputs-only),
setfarm.internal-production-dashboard-native-build-inputs.v4 (compiler-dependencies-only),
setfarm.internal-production-dashboard-native-sidecar-build.v4 (native-sidecar-build-only).
Exact namespace ROOT/.setfarm/dashboard-cutover-native-v4/<sourceSha>.<buildHash>,
same fixed four-entry terminal layout/modes/count/collision rules as V2. Prior
V2/V4 generations stay visible; no overwrite/retry/adoption/cleanup/deletion.

V4 direct source is the retained reviewed source byte occurrence. V4 dependency
provider selects its genuine fixed V4 direct provider; exact direct schema,
authority and source locator/hash/length agree before compiler discovery. Its
provisional and held-validation graphs still match exactly; aliases, SDK/tool/
headers/runtime/source-build pins and original children/pipes remain held.
V4 sidecar selects genuine fixed V4 build-input provider and verifies expected
schemas/authority, fixed source identity, graph and source-build crossbinding
before the compile/publication ports. Its immutable manifest uses the V4 schema
and records the actual same retained V4 input, terminal outputs, native imports/
exports/dylibs and original child/pipe dispositions. Do not use data parsed from
another holder or public transcript as compile/load/endpoint/startup permission.

Private literal V2/V4 bindings may share checked mechanics; no public factory,
source argument, profile selector, addon path/bytes getter, evaluation function
or callback. Preserve all current clean-main/source-build guards; feature-source
fixtures earn source-fault/private-FS credit only. Separate fresh genuine V4
compiler qualification is later nominated; no old native campaign replay here.
Nothing in this slice evaluates .node, calls bootstrap/Mach methods, dispatches
service/selector effects, authenticates job/birth/foreground or completes cutover.

Qualification refinement: TEST-ONLY source-fault copies may replace the single
private V4 downstream call with the genuine fixed V2 provider before the final
private source commit/finalization. Assert exact replacement occurrence; no fake
holder, public source/profile option or production guard change. These two
negatives prove crossed schema rejection before downstream discovery/compile.
The genuine dependency provider binds canonical parsed graph equality, not raw
discovery ordering/formatting. Test reversed equivalent output remains accepted.
Two further TEST-ONLY consumer-binding literal faults select a distinct retained
private fixture file containing identical V4 bytes. The genuine upstream remains
V4; hashes/lengths match, only the independently nominated locator differs.
Finalize that modified private source normally; no public selector or fake holder.

Frozen Task4i.2 qualification: Node22 mechanical178P0F3SKIP and explicit fixed
Node26.4.0 focused45P0F0SKIP, same six frozen source/test byte occurrences.
Root independently read all223 retained result originals with0faults. Actual
source-fault C input/FS/graph/manifest/custody behavior only; process/provider
relocation and simulated commands remain disclosed. No genuine fixed-native
campaign or production-build/job/endpoint/startup authority is inferred.

## Task4i.3: opaque original V4 sidecar lifetime

Causal necessity: Task4i.2 publishes DATA-only generation/manifest observations.
One attempt and fixed generation collision prohibit later adopting a path or
receipt after closing its original holder. Preserve original lifetime BEFORE
spending any genuine clean-main compiler qualification. This slice does not
spend that campaign or implement loader/job/controller/startup authority.

Exactly three new public entries in the existing sidecar provider:
holdDashboardCutoverNativeSidecarLeaseV4(): Promise<object>,
assertHeldDashboardCutoverNativeSidecarLeaseV4(original: object): void,
closeHeldDashboardCutoverNativeSidecarLeaseV4(original: object): void.
Acquisition zero arity; assert/close exactly one. A minted object is empty,
frozen, null-prototype and genuine only by private WeakMap identity referring
to the SAME original V4 sidecar vault and retained upstream chain. It is not a
wrapper around caller DATA, a transcript, another instance or a reopened path.
Mint privately at the original terminal publication boundary before returning;
never take an externally supplied holder or release a successful private DATA
holder to the caller as part of lease creation. V2/V4 DATA interfaces unchanged.

All three APIs share existing original activity/one-attempt/burn/closed state.
Activity guard BEFORE arity/handle checks: acquisition/assert/close reentry
burns that original before its next admitted port. Wrong arity/foreign/copied/
proxy/prototype/observation/path handles have zero traps/ports and preserve an
otherwise idle healthy original. Assert performs the existing full original
source/build/profile/FD/file/dependency/terminal checks; public DATA does not
select originals or grant authority. No observation, locator, bytes, addon,
callback or executable getter is exported from the opaque lease.

Close authenticates SAME lease and invokes existing checked-once original
reverse cleanup. Idle genuine cleanup remains allowed after validity burns;
duplicate close has zero ports, response loss stops later disposals and never
retries a reused number. Pending acquisition/unknown child/pipe cannot mint;
active reentry cannot dispose its originals. Partial/uncertain creation keeps
originals and visible artifacts, with no replacement/adoption/delete/cancel.

Private fixed return-mode mechanics are allowed, not a public caller-selected
mode/source/profile factory. Lease authenticity means original retained build
DATA only, NOT compiler permission, addon evaluation, Mach job/peer/endpoint,
owner/phase/control/startup grant, any service effect or completed foreground.
Approved-definition private composition is a later separately nominated slice.
Qualify through actual source in retained real private FS and inert command
ports; no actual:true fixture/campaign, synth-build-to-production authority,
old native replay or clean-main guard bypass. Existing generations stay visible.

Task4i.3 frozen source-fault qualification: focused24+16 new opaque cases GREEN;
full122tests121P0F1SKIP includes repeated new40, not three disjoint selections.
Fixed Node26.4.0, all native opt-in flags removed; root read all161 retained
program/result/command originals with zero faults. Earlier18P22F expanded run
is test-oracle attribution failure, not production RED; preserved originals and
truncated tool-display limit are recorded. Private pending identity is retained
before freeze and authenticates only after publication, which follows alive.
No genuine compiler/build/native loading/transport/job/startup authority follows.

## Task4i.4: private functional loading of the SAME held V4 bundle

Causal necessity: the six-effect adapter eventually needs the genuine native
five-method provider, not another DATA-only conjunction. Task4i.3 preserves its
original generation lifetime but deliberately exposes no executable or locator.
Nominate private loading INSIDE the existing sidecar vault first. This is only
the sidecar's own fence: separately retained approved-definition/owner/phase/
ordinal/controller authority and genuine clean-main loading remain required.
A before/after conjunction is NOT a joint operation fence; do not add one here.

Interfaces in existing scripts/dashboard-cutover-native-sidecar-v2.mjs:
holdDashboardCutoverLoadedJobPeerV4(originalSidecarLease: object): Promise<object>;
assertHeldDashboardCutoverLoadedJobPeerV4(originalLoaded: object): void;
closeHeldDashboardCutoverLoadedJobPeerV4(originalLoaded: object): void.
All exactly one input. Only original opaque sidecar lease can select its SAME
private V4 terminal bundle; no DATA/path/manifest/profile/source/callback input.
Output empty frozen null-prototype, WeakMap-original identity only. No methods,
exports, module/cache, locator, bytes, getter or load callback leaves the vault.
Existing five DATA/lease APIs retain their behavior and shared original state.

Activity guard precedes arity/identity for all three new APIs. Authenticate
original lease, then full original finalized source/build/profile/dependency/
FD/terminal checks before loading. Idle invalid arity/foreign/proxy/copy inputs
have zero caller traps/load/FS ports and preserve healthy original custody.
Retain one private load attempt BEFORE fallible createRequire/cache/require work;
failure/response loss may never retry, adopt an existing cache entry, or replace
the original. Private fixed createRequire(import.meta.url) selects ONLY the
held generation's peer.node. Reject any preexisting own cache occurrence, even
correctly shaped frozen exports. No environmental or caller loader selection.
After the final pre-load terminal filesystem pass, revalidate the retained
require/cache descriptor and SAME cache binding and repeat own-entry absence
immediately before the trusted require occurrence. Cache arrival or binding
drift during that pass refuses before loading, never adopts a shaped entry.

Retain exact require function/cache object, original cache-entry/module, exports
and all five method occurrences. Inspect own DATA descriptors; reject proxies,
accessors, missing/extra methods or malformed module evidence without getters.
Module evidence: own DATA id and filename equal the held bundle locator, loaded
strictly true, exports identical to the synchronous require return. These fields
are consistency only, not provenance authority. Cache entry is own DATA binding
that locator to SAME module. Require's own DATA cache is SAME retained non-proxy
null-prototype cache. Exports is frozen ordinary Object-prototype object with
exactly five own string keys/no symbols, enumerable true/writable false/
configurable false DATA function fields; each function is non-proxy. Subsequent
assertion compares original references and original descriptor flags, not shape
alone; trap-free proxy detection precedes all candidate property inspection.
Names/lengths/native-code strings are not authority. Native exports are frozen
ordinary module exports, NOT null-prototype public handles. Exact methods:
receiveControllerHelloV4, challengeControllerAndReceiveAckV4,
sendControllerGrantV4, helloClientAndReceiveChallengeV4,
ackClientAndReceiveGrantV4. Loading invokes NONE of these methods. The reviewed
C initializer only defines/freezes methods; transport occurs inside invocation.

Register each owned load/inspection occurrence before admission and recheck
original liveness afterward. Treat require as ONE trusted builtin operation;
before/after checks do NOT prove inhibition of Node-internal ports or undo
native image execution after a refused response. No speculative unload/cache
deletion/export restoration. Retain uncertain effects/module/cache evidence.
Publish loaded original only after full source/build/terminal and exact cache/
module/exports/method checks, pending identity registered before handle sealing,
then final liveness. Captured unpublished keys never authenticate.
Retain minted handle identity before checking creation liveness, and check
liveness BEFORE sealing. After sealing, full terminal and loaded-identity checks
gate publication. Assertion's final terminal filesystem pass is followed by
loaded-identity validation so cache drift there cannot escape a successful return.

Assertion rechecks SAME originals and exact cache/module/exports/functions; drift
burns permanently. Loaded close and original sidecar-lease close share SAME
checked-once reverse FD cleanup, including genuine idle cleanup after burn.
Duplicate/cross-API close zero ports; response loss/reused numbers stop later
disposals. Native image/cache stays retained; closed loaded handle confers no
future use. Active reentry burns before next provider-owned port, cannot dispose
active originals or mint replacement handles.

Scope: existing provider/test + paired spec/plan only; no C, package, launcher,
PG, CLI, native transport, service effects or controller changes. Qualification
uses retained private real FS/source with inert require/cache/export doubles;
no native image is evaluated in those source-fault fixtures. Actual native
compiler/loading qualification is separately nominated after reviewed delivery
and genuine synchronized clean-main finalization, not actual:true synth builds.
This is functional loading custody only, NOT joint approved-definition fence,
executing-job/controller/owner/phase/ordinal/grant/startup or live3333 authority.

## Task4i.5: fixed functional bilateral original-operation custody

Existing Task4 causal refinement, NOT Task3/controller or six-effect capability.
Task4i.4 is delivered a1ae81a2. Its private provider remains inaccessible to a
caller. This source-qualified increment executes a fixed original-resource qualification while
BOTH existing provider activities are held, rather than returning another DATA
conjunction. No native method, launchctl/PG/selector/service effect is admitted.

Selected coordinator is the already planned
scripts/deployment-dashboard-cutover-adapter-v2.mjs. Its top-level imports are
builtins and existing build-generation-retention only; no top-level provider
import or source preparation. Fixed imports inside preparation are the SAME ROOT
sidecar and ROOT/dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js.
No src/query/root/env/loader fallback. TS provider imports only fixed coordinator
token helpers via the adjacent declaration file. Lazy provider imports avoid
evaluation cycles and cannot substitute another instance's WeakMaps.

Qualification interface:
qualifyHeldDashboardCutoverJointOriginalOperationV4(originalLoaded: object,
originalDefinition: object): Promise<void>, exactly two inputs. No DATA/capability
result, caller continuation, path, getter, loader or public token factory.

Coordinator activity guard is FIRST, before arity/type/proxy parsing. During
pending preparation/import or joint work, any nested qualifier call burns the
current original preparation/token and refuses with zero caller traps/new ports;
it never settles pending imports or disposes participant FDs. Only while idle,
private preparation first validates arity and non-proxy object inputs
without caller traps. Ordinary foreign object identity cannot be authenticated
before the fixed compiled provider is loaded: explicitly allow bounded owned
readonly source/build preparation and fixed trusted module-import occurrences
at that stage, NOT any participant scope, native method or effect dispatch.
Do NOT claim all foreign inputs have zero filesystem ports. Invalid identities
must preserve both existing healthy participant originals and cannot consume the
joint operation attempt. Preparation is separate, retained once-only source
custody and fixed imports, with no retry after uncertainty. Native/source
preflight and post-import checks bracket each trusted import; pending original
Promise must be registered before observation and retained until actual settlement.
The existing source holder pins the whole synchronized checkout and finalized
dist inventory. This is source-fault qualification until genuine clean-main
compilation/loading; fixtures cannot turn it into real runtime authority.

Authenticate both original participant identities through their fixed private
WeakMaps before minting/enrollment, specifically by calling the fixed module exports
assertHeldDashboardCutoverLoadedJobPeerV4(originalLoaded), followed by
assertHeldDashboardCutoverApprovedDefinitionV4(originalDefinition), while both
participant activities are idle. Those exports perform their own WeakMap checks
before original-resource ports; the coordinator never inspects another module's
private WeakMap. Failed idle identity authentication mints/enrolls no token/scope.
Both complete original assertions and source proof must pass before enrollment.
A private token record binds SAME two originals, original operation, stage,
sticky revocation, pending imports and scopes. Empty
frozen null-prototype token, never public output. Retain mint/registration before
sealing and check liveness before/after fallible creation/sealing. Scope identities
are also opaque originals, never returned by the qualification to the caller.

Exact fixed helper/provider interfaces, no optional inputs:
assertDashboardCutoverJointNativeTokenV4(token: object, originalLoaded: object): void;
assertDashboardCutoverJointDefinitionTokenV4(token: object, originalDefinition: object): void;
assertDashboardCutoverJointNativeSettlementTokenV4(token: object, originalLoaded: object): void;
assertDashboardCutoverJointDefinitionSettlementTokenV4(token: object, originalDefinition: object): void;
assertDashboardCutoverJointNativeReleaseTokenV4(token: object, originalLoaded: object): void;
assertDashboardCutoverJointDefinitionReleaseTokenV4(token: object, originalDefinition: object): void;
revokeDashboardCutoverJointTokenV4(token: object): void;
beginHeldDashboardCutoverLoadedJobOperationV4(originalLoaded: object, token: object): object;
assertHeldDashboardCutoverLoadedJobOperationV4(scope: object): void;
assertHeldDashboardCutoverLoadedJobOperationCacheV4(scope: object): void;
settleHeldDashboardCutoverLoadedJobOperationV4(scope: object): void;
beginHeldDashboardCutoverApprovedDefinitionOperationV4(originalDefinition: object, token: object): object;
assertHeldDashboardCutoverApprovedDefinitionOperationV4(scope: object): void;
settleHeldDashboardCutoverApprovedDefinitionOperationV4(scope: object): void.

Token helpers authenticate WeakMap-original identity, exact bound participant and
coordinator stage. They inspect only private state: no callbacks, resource reads,
full recursive assertion, caller properties or future effect permission.
Genuine revocation is sticky and RETURNS VOID, even after already revoked;
foreign/wrong-arity helper calls refuse without traps. Never throw notification
inside sidecar burn(): existing child-error/Promise settlement must still complete.
Each local burn first notifies the shared token, then follows its existing refusal.
Returned scope must be retained before post-entry checks; partial enrollment stays
retained/quarantined on uncertainty, not disposed via generic finally.
Immediately authenticate/check each returned scope through its fixed provider's
existing scope assertion BEFORE admitting the next enrollment. Record successful
original authentication separately from a returned non-null value. A response
whose original published identity cannot be recovered remains unknown and cannot
admit another participant or qualify settlement. Authentication checks during
enrollment are distinct from the later checks while BOTH scopes are held.

Both scopes hold their original activities across the fixed operation. Public
idle assert/close/acquire while enrolled burns/refuses before arity/identity and
cannot dispose participant FDs. Scope asserts use private checkOriginal paths,
NOT the idle-only public assertions. A separate internal checking flag prevents
nested scope assertion/settlement. Lightweight shared liveness around admitted
provider ports prevents an opposite participant burn from authorizing a later
outer port. Changing original cache/definition/material/source/terminal state
burns the token and operation. Final validation precedes successful scope
settlement and return. Caller Promise loss does not settle original work.
Settlement is only accepted in the coordinator's genuine settling stage after
all original pending work is actually settled; no replacement/retry after burn.
Separate settlement-token helpers authenticate SAME token/participant and genuine
settling stage with pending0, permitting checked-once scope release after revocation
without restoring validity or granting a port/effect. Normal liveness helpers
still reject revoked tokens. Successful local settlement only marks the scope
settled; terminal release clears activity, never participant FDs. Later genuine
idle close retains its existing once-only rules.
Lost enrollment response with an unrecovered scope remains quarantined, not
silently settled with a guessed token or missing handle.
Eligibility also requires separately retained enrollment intent/return/publication
records: every admitted scope response is recovered as the genuine published
original, and no unknown enrollment or settlement occurrence exists. Synchronous
call settlement does not prove its returned scope was recovered. A failed second
begin that might have activated an unreturned scope cannot reach SETTLING through
finally. If a settlement loses its response, later settlement attempts stop.
Serial settlement does not release a participant's public-idle fence immediately.
Retain its local settled scope and original activity until a release-token helper
authenticates the SAME terminal coordinator record: both genuine scope settlement
responses are recovered, pending0, no unknown occurrence. The next public idle
entry may then clear its local activity without resource ports. During the gap,
including a lost second settlement response, idle entry burns/refuses and cannot
dispose the already locally settled participant. Separate exact-two-input release
helpers return void; no caller stage, boolean getter or effect permission. They
allow genuine revoked terminal custody solely for later existing idle cleanup.
RO source review found raw module/cache drift in the last definition FD pass does
not itself notify the shared token. After the final definition/source/FS composite,
the fixed cache-only native scope assertion rechecks SAME retained require/cache/
module/exports/method identities with existing checking-first scope custody and
sticky burn, then settlement follows. This assertion invokes NO FS/upstream or
native method. It establishes a final cache validation cutpoint under trusted
intrinsics; sequential full checks are NOT a simultaneous atomic filesystem/cache
snapshot against arbitrary replacement of the interpreter's global intrinsics.
Token helpers remain resource-free. No further resource operation follows the
cache cutpoint before the purely private settlement/release bookkeeping.

Explicit trusted composite boundary: existing retained-source/build, native
upstream and launcher configuration checks remain their reviewed composite calls
unless their internal guards are explicitly enrolled in an additional File Map.
Bracketing such a call is NOT inhibition of its internal ports. Cross-direction
tests must distinguish direct participant ports from those trusted composites;
there is no claim of complete per-port Task4 freeze or six-effect authority.
Any need to inhibit their internal ports must be separately mapped and tested
before effect admission, never hidden by aggregate counters or a passing wrapper.

Finite legacy/queued/stale ROOT-unlink exclusion, current owner/reservation/history,
genuine pre32 and changing-phase predicates, durable ordinal intent, qualified
selector/restoration/new birth/control declaring-job/foreground CLI/listener,
genuine clean-main build and live3333 remain existing whole-cutover obligations.
This qualifier cannot authenticate or dispatch any of those effects.

File Map: new adapter-v2.mjs + adapter-v2.d.mts + builtin adapter test; existing
sidecar source/test; existing launcher-observation TS and approved-definition V4
test; package.json enrollment; paired spec/plan. No controller/C/service/config
changes. Any source-closure/native-input enrollment dependency must be recorded
before production edits rather than widening imports silently.

Concrete source enrollment: retention pins all Git inputs and complete dist
inventory; adapter .mjs/.d.mts join existing input hashing automatically. No
tsconfig/asset-copy/header-provider change is required. Do not import adapter
back into retention: its own executing-source closure forbids dynamic imports.
This disk inventory is NOT authentication of previously cached ESM code; genuine
executing-entry/image qualification remains a complete Task4 prerequisite.

Source-only fixture bridge is LOCAL to the new adapter builtin test. The shared
finalized helper's four forbidden-evaluation outputs stay unchanged. A local finite
manifest builder records complete output inventory/hashes for those outputs plus
literal source-to-compiled mappings:
src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts -> dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js;
src/internal-production/baseline-deployment-cutover-node-path-v1.ts -> dist/internal-production/baseline-deployment-cutover-node-path-v1.js;
src/internal-production/baseline-deployment-cutover-process-observation-v1.ts -> dist/internal-production/baseline-deployment-cutover-process-observation-v1.js;
src/product-compiler/canonical-json.ts -> dist/product-compiler/canonical-json.js.
Preserve .js relative imports and fixed ../../scripts/adapter import; caller and
coordinator must mint/use the same canonical compiled-path namespace. Record each
original TS/translated JS hash and actual import URL. Exact finite translation and
manual finalized fixture metadata earn source mechanics only, never actual build,
compiler/runtime authentication or clean-main credit. No static third-party/PG
dependency is needed in this graph; lazy PG operations stay forbidden.

2026-10-09 source-only qualification checkpoint:24 distinct actual-provider
fixture cases passed at adapter96a3d441/nativee50a2a26/launchera1f3bb0c, plus one
API dependency-resolution repeat,13 native controls and32 approved-definition
controls. Final tests distinguish enrollment authentication from both-held work,
direct owned ports from trusted composites, pre-local settlement loss from actual
post-local checking-release response loss, and unpublished scope/token identities
from fabricated handles. Preparation rechecks after record allocation and scope
liveness rechecks after stage includes prevent swallowed nested revocation from
admitting the next direct port. Scope responses authenticate before the next begin.
Root original receipts, exact source/translation/provider hashes and four earlier
append-only test-pin reconstructions are retained in canonical logs' joint-original
final/controls indices and joint-original-operation ledger. Strict1194/0 noEmit
uses explicit shared tools, NOT writer dependency or production build authority.
Final reviewed delivery is a separate plan gate. Six-effect adapter/controller,
complete trusted-composite freeze, executing-entry/image, owner/legacy/pre32/
phase/ordinal, foreground/clean-main/live3333 obligations remain unqualified.

## Task4i.6 nomination: fixed original pre32 transaction composition

Causal prerequisite of the approved Task4 adapter: original locked database
custody must remain live during jointly held original checks. Existing public
withHeldDashboardCutoverLauncherPre32V2 is idle-only and therefore burns/refuses
under the Task4i.5 definition scope. Do NOT relax that guard or substitute a
snapshot/census DATA object. Selected approach extends SAME coordinator and
launcher provider with a literal source-owned pre32 route. Existing no-PG route
stays unchanged; both share once-only preparation and joint attempt.

Exact fixed interfaces, no optional arguments:
qualifyHeldDashboardCutoverJointPre32OperationV4(originalLoaded:object,originalDefinition:object):Promise<void>;
runHeldDashboardCutoverApprovedDefinitionOperationPre32V4(originalDefinitionScope:object):Promise<void>;
executeDashboardCutoverJointPre32AssertionsV4(originalToken:object,originalDefinition:object,originalPre32Scope:object):Promise<void>.
First/third are coordinator exports; second is launcher provider export. None
returns a token/path/query/callback/permission/capability. No caller continuation,
URL, SQL, connection, census, selected mode or provider is accepted. The existing
private configuration's agreedDatabaseUrl(check) and withPre32Database consume
the SAME material originals; they are never exposed by the scope function.

Coordinator preparation for this fixed route lazily imports SAME ROOT/dist/
internal-production/baseline-legacy-database-census-v1.js with retained original
import custody and source checks. No src/query namespace/fallback/loader input.
Existing configuration imports that SAME canonical module. Its existing
assertHeldDashboardCutoverPre32DatabaseV2 authenticates genuine scope through
its OWN WeakMap before queries; empty/frozen DATA copies, query-instance scopes,
unknown scopes and proxies cannot manufacture that authentication.

The actual trusted provider uses READ COMMITTED READ ONLY with36 SHARE table
locks, exact migration26..31 journal and cold zero-owner census. This excludes
its nominated write surface only, NOT all producers/processes/physical owners
or backend-death/global freeze. Explicit rechecks retain the existing32 budget;
this slice cannot increase it. Existing driver/journal/census helpers are declared
trusted composites, not retroactive joint-token inhibition of their internal ports.

Active-first guard precedes arity/type/proxy parsing on the coordinator fixed
route, including pending imports/PG work. The fixed assertion helper has a private
checking-first guard before input parsing; nested helper calls burn shared
original custody and refuse with zero new query/FS ports and traps. Authenticate
SAME token/operation/definition/fixed route/stage, then retain the original callback
scope response before fallible checks. Only the actual canonical pre32 assertion
can authenticate it. Original query promises are registered/retained before await
and are never replaced by a fulfilled boolean, timeout or consumer promise.

The definition scope's callback is literal source-owned code invoking the fixed
coordinator helper. Privately retain original callback and outer bridge promises
SEPARATELY, with intent/returned/actual-settled/unknown records before observation.
Native promises are required; no caller thenable or generic continuation. Retain
callback work before invoking its asynchronous body. The coordinator separately
retains its original provider invocation and explicit scope-query occurrences.
Response loss or an unrecovered original is irrevocable unknown custody.

The new definition pre32 entry also guards its retained original occurrence
BEFORE parsing arity/scope during pending work. This lifetime fence is distinct
from short synchronous scope checking: fixed coordinator-owned bilateral checks
must still run within its source-owned callback. Never add a caller bypass flag
or temporarily release material/native activity to make that possible.

Outer driver rejection or sql.end({timeout:1}) is NOT callback/query settlement
and NOT backend-death proof. Burn/notify shared token before any further normal
ports. While an original callback/query remains pending or unknown, keep BOTH
participant activities held; no scope release/participant FD disposal/retry or
replacement. The source-owned postlude may await actual retained callbacks,
never synthesize completion. Definition settlement additionally refuses any
unsettled/unknown pre32 local occurrence, even if its outer function's returned
promise has already rejected. This makes the terminal coordinator release gate
fail closed rather than inferring resource death from an exception.

Important existing composite boundary: the actual census provider performs an
internal final read AFTER our source-owned continuation has returned. Its driver
begin/end may reject while that private final query/transaction callback remains
pending. Our callback + explicit query + outer promise settlement cannot prove
that hidden original settled. No public genuine provider-internal witness exists
within this File Map. Therefore ANY rejection/lost response of the invoked pre32
bridge is sticky UNKNOWN at both local definition occurrence and coordinator;
do NOT enter SETTLING or release either scope, even after visible callbacks or
test-controlled queries eventually settle. The original attempt is not retried.
Only successful returned outer bridge with trusted provider completion may prove
this composite settled. Known-revoked cleanup applies only when that successful
completion was actually recovered, never to an outer driver rejection.

Healthy fixed work: authenticate actual pre32 scope, perform literal bilateral
source/native/definition checks while that ORIGINAL transaction continuation is
live, recheck original pre32 scope before callback return. Register and await every
original query. After actual callback and outer bridge settlement, run existing
final source/definition/resource-free native cache cutpoint. Only then can the
existing known-scope settlement/terminal-release bookkeeping run. Known revoked
settled custody with recovered successful composite completion may use existing
cleanup; validity/effect authority never returns.

File Map: existing adapter.mjs/.d.mts/builtin test, launcher-observation TS, paired
spec/plan only. No native C/provider, PG provider, package, controller or service
change. The local test adds precisely one literal mapping:
src/internal-production/baseline-legacy-database-census-v1.ts -> dist/internal-production/baseline-legacy-database-census-v1.js.
Record original TS/translated JS hash/canonical URL and complete finalized manual
inventory. Actual compiled census scope owner is NOT doubled; only explicit
driver/journal/finding boundaries are inert. Existing shared finalized helper
and historical receipts stay untouched. New cases use bounded selected event/
counter/hash receipts instead of repeated huge FS traces. This remains source-only
fixture translation, not genuine compiler/backend/native/clean-main execution.

Fault qualification must distinguish two timing windows: pending explicit query
inside our callback, and pending actual provider FINAL read after our callback
has returned. In each, lose original outer driver response and prove both fences/
no participant disposal/no retry. Release that SAME test query and observe its
actual settlement, but never promote the failed composite to known custody.
If shared route factoring relocates allocation to a private fixed routine, update
the existing Set-construction causal oracle to the actual source-owned frame and
rerun it; behavior preservation is required, not fictional byte preservation.
No-PG route must not import census/openPG even after ordinary-foreign preparation.

2026-10-09 source-only qualification checkpoint: seven final cases7P0F at
adaptere0685287/launcher32384f38/declaration950de098/testdea600da. Actual
canonical census module owns its genuine scope; explicit driver/journal/finding
boundaries are doubled. Healthy36 SHARE locks/four journal reads; loss windows
retain both participants after same original queries settle, with FDdisposals0,
proxytraps0 and all six nominated direct counters unchanged. Final provider-query
window follows exact source ordering, not a fabricated private helper witness.
Synchronous checking covers initial/configuration-callback/final validation
without spanning awaits. Append-only private history retains three original
native promises after pending removal. Genuine causal REDs OpRfMf/lMYBFm/
81xjdp preceded correction;11JaIf never armed and has NO causal credit.
Root rereads final7 and old-route6 original program/intent/result/snapshots,
byte-exact provider relocation, translated bridges and complete manual outputs,
plus32 approved child receipts. Old-route fixtures have no census bridge;
six old-route tests and20 pre32 harness controls pass. The latter have normal
harness output, not invented retained child receipts. Strict1194/0/noEmit and
syntax/contracts pass through explicit readonly shared tools, not actual build.
Bounded final resource snapshots and stdout differ only by one diagnostic
trusted-composite close count. Counters qualify the nominated direct windows,
not every interior composite port. Final evidence and controls indices are in
canonical logs; final exact-six-file delivery reviews still pending.

No new Task4 capability is created here. Full current-owner/reservation, finite
legacy exclusion, changing phase/durable intents, six effects, controller,
authenticated foreground grant/birth/job/control/listener and final genuine
clean-main/live3333 verification remain mandatory.

## Task4i.7 nomination: owner-bound original ROOT reservation

Task4i.6 delivered826ff24e after two exact-six-file C0/I0/M0 reviews and
7+6+52 focused passing cases. Next functional step is the existing absent-only
atomic first-generation ROOT publication under original pre32 custody. This
is reservation custody, not any of the six service/native effects or full freeze.
Root alone writes; readers review nomination and retained originals. No live
entry/CLI wiring or host ROOT mutation is authorized by this partial producer.

Alternatives: merely conjoining owner/lock DATA leaves the publisher ungated;
wrapping acquire before/after leaves subsequent parent ports admitted after
shared revocation. Selected design extends the actual parent's per-port check
with a fixed, resource-free, owner-bound coordinator fence. No generic callback
or caller permission injection. Preserve all old V1/V2 semantics when no joint
operation exists, including census-free old routes and strict EEXIST/no reclaim.

Fixed interfaces, exact arity:
reserveHeldDashboardCutoverJointFirstGenerationV4(loaded:object,definition:object,owner:object):Promise<void>;
assertDashboardCutoverJointOwnerTokenV4(token:object,owner:object):void;
reserveDeploymentCutoverFirstGenerationWithOwnerV4(owner:object,token:object):Promise<void>;
assertDeploymentCutoverJointReservationMetadataV4(token:object,input:object):void;
acquireFirstGenerationDashboardCutoverJointReservationV4(input:object,token:object):Promise<object>;
assertFirstGenerationDashboardCutoverJointReservationV4(token:object):void.
The first two are adapter exports; next two owner exports; last two atomic
reservation provider exports. Only its existing private original opaque handle
is returned internally. No public reservation getter, callback/path/URL/SQL/
optional mode, token mint, returned controller capability or release port.

The new fixed adapter entry adds a literal reservation route to its existing
shared once-only preparation/enrollment/attempt. Retain canonical owner and
first-generation imports before await; no query namespace or fallback. Validate
the actual owner through the same canonical module/WeakMap, not binding DATA.
The fixed pre32 helper authenticates the same actual census scope as before;
between its two explicit scope assertions it invokes the owner-owned fixed
operation, retaining that native original promise before await. Existing launcher
continuation and private URL remain unchanged. The coordinator record retains
originalOwner and reservation invocation intent. Its new token assertion checks
same token/owner/fixed route/live working stage and prior actual pre32 scope
authentication, with no resources or recursive owner/PG reads.

The owner operation retains a provisional private token/owner/held record BEFORE
its first original import or trusted owner/source/OPEN composite. Public legacy
reentry can therefore burn even during preflight. Attach immutable hash input
only after the actual relation validates; an unpublished/lost record or import
response stays unknown and cannot be replaced. The operation authenticates its
original handle, reads its held
modules.observation actual OPEN intent, canonicalizes it with existing records,
and applies assertDeploymentCutoverMaintenanceRelationV1 against SAME held
maintenance and current sourceAuthority. It must not publish/overwrite OPEN.
Only then derive actual observed.intent.cutoverIntentHash and held.claim.
ownerClaimHash. Never substitute maintenanceIntentHash, cutoverPlanHash, caller
labels or a fabricated observer. Preserve a copy of the actual canonical intent
bytes and recheck them plus owner before/after reservation acquisition. The
claim's process birth and the provider's fresh reservation nonce remain distinct
occurrences; don't claim identical nonce records. Existing source/build/process/
history/OPEN observers are trusted composites, not universal interior guards.
They still require genuine clean-main BUILD outside source fixtures.

Before first acquisition, retain an owner-private original operation record with
token/original owner, immutable two-hash input and native import/acquisition
promises. Metadata assertion authenticates SAME private input object identity
and token/owner operation, plus held validity/uncertainty and shared token fence;
it is resource-free. It cannot accept a copied DATA object even with same hashes.
Authenticate that ORIGINAL input separately from the atomic provider's existing
snapshot() value copy; using the copy as identity would reject healthy work.
Metadata may call adapter token assertion, never a recursive reverse call.
Actual reservation WeakMap handle, promise, and result remain private and
retained after settlement. No response/promise/constructor/publication exception
may discard a returned original or refresh unknown custody into acceptance.

Owner public legacy entry points must guard the retained joint lifetime BEFORE
input parsing/imports/normal resource ports. During genuine joint work reentry
burns/refuses immediately and notifies the shared token synchronously when the
canonical adapter import has returned. Before that original response, the
coordinator denies BOTH participant live-token ports throughout the admitted
owner composite; only its original successful promise return removes that
embargo. Rejection or an unknown response never does. The owner-specific token
guard remains usable for source-owned owner/reservation checks, not participant
ports. This closes the provisional import window without an extra callback,
static legacy import or invented synchronous-import notification. Split its trusted internal owner
checker from public wrappers so source-owned checks don't self-burn. New fixed
metadata checks need a separate short synchronous checking guard, not a flag
held across awaits. Original legacy routes must not resolve new adapter/provider
imports or acquire joint resources. Fixed canonical imports in the new route
are original preparation work, not falsely counted as zero loader activity.

Actual first-generation publisher parent uses its original check/port/open/
child machinery. New fixed joint entry binds the actual private metadata and
token BEFORE first parent resource port. Every nominated parent check consults
the canonical owner metadata assertion, which authenticates original input
identity and invokes the canonical adapter owner-token assertion: both guards
are resource-free, with no reverse metadata recursion. Its private joint lifetime survives v.active
finally, acquired-handle return, outer PG loss and actual child settlement.
Public V2 acquire/assert/close during this lifetime burn/refuse before parsing,
proxy traps or parent FS/process ports; existing no-joint behavior stays unchanged.
No new FD close, pathname unlink, rollback/reclaim or retry is permitted by this
slice. Existing atomic V2 close continues to leave ROOT+lock unchanged.

Add exact one-member ROOT validation to actual physical() using two bracketed
readdir observations, original root descriptor/path identities, lock byte and
physical checks. Extra sibling artifacts cause sticky refusal; a source file's
absence or sampled empty history is not a producer freeze. Preserve root original
identity through its one admitted stage-to-canonical rename; no arbitrary root
or lock replacement/mtime adoption. This integrity check is not namespace-wide
monotonicity or protection against already-entered stale unlink.

The fixed Python atomic publisher is ONE admitted original child composite;
parent guards cannot inhibit its already-running syscalls. Register original
child and settlement before fallible observation, retain/drain it after burn;
never cancel/signal/replace/retry it or call completion a backend-death proof.
Publication may complete after joint failure: preserve ROOT/lock/FD originals
as evidence and permanently refuse subsequent parent ports and cleanup. Any
invoked bridge/acquisition rejection, lost response or unobserved original stays
UNKNOWN. Eventual child/query settlement does not release the joint lifetime.
Healthy source-owned checks may finish original native/definition bookkeeping,
but reservation originals remain privately held; the root is never erased.
No half-complete live rollout is wired: final controller will incorporate this
same fixed operation and its retained record in the complete qualified route.

Exact File Map: adapter.mjs/.d.mts and builtin test; owner.mjs and owner test;
first-generation.mjs and first-generation test; this paired spec and plan. Nine
files only; no launcher/PG/Python/native/CLI/service/package/Task6A change. Existing
owner fixture cleanup cannot destroy new RED/qualification receipts: new cases
must use owned retained fixtures with original program/intent/result/EOF+close.
Local finite bridges add EXACT five pairs to the existing five pre32 pairs:
src/internal-production/baseline-deployment-cutover-records-v1.ts -> dist/internal-production/baseline-deployment-cutover-records-v1.js;
src/internal-production/baseline-deployment-cutover-owner-store-v1.ts -> dist/internal-production/baseline-deployment-cutover-owner-store-v1.js;
src/internal-production/baseline-deployment-cutover-publication-v1.ts -> dist/internal-production/baseline-deployment-cutover-publication-v1.js;
src/internal-production/baseline-deployment-cutover-v1.ts -> dist/internal-production/baseline-deployment-cutover-v1.js;
src/internal-production/baseline-workspace-authority-path-v1.ts -> dist/internal-production/baseline-workspace-authority-path-v1.js.
Canonical-json is already in the old four-pair bridge. Owner's original six
source files must exist unchanged in fixture: build-generation-maintenance-
journal.mjs, build-generation-maintenance-owner-observer.mjs, build-generation-
retention.mjs, deployment-cutover-owner.mjs, deployment-cutover.mjs,
deployment-cutover-dependencies.mjs. Copy actual first-generation.mjs and pinned
atomic-root-v2.py (helper SHAe65e3f49), retaining original hashes. No glob or
invented build graph. Build/process/driver
double boundaries are labeled. Actual Python in an owned fixture earns only
that original leaf receipt; a doubled Python earns parent custody only, never
fresh native atomic proof. Use bounded counters/events, no huge duplicate traces.

Qualification: missing fixed interfaces before owner/PG/ROOT ports; genuine old
atomic-provider sibling acceptance RED; healthy actual owner/OPEN/claim and
reservation WeakMaps with exact wire hashes under live canonical pre32 scope;
suspended SAME original child followed by PG loss or shared owner burn, no next
parent ports/FD disposal/proxy traps/retry and preserved late publication; wrong
owner namespace/copy/proxy or mismatched actual OPEN maintenance before dispatch.
At an actual owner OPEN/source preflight boundary, swallow a legacy wrong-arity/
proxy call; prove it burns before traps and no reservation dispatch follows the
trusted composite's return. Do not claim inhibition of its internal source reads.
Missing-interface evidence excludes existing owner module initialization/source
reads from owner acquisition/PG/ROOT attempts; no universal import-time FS0 claim.
Healthy wire expectations come from independently retained actual OPEN bytes and
durable claim, not input/projection. Fixture cutover/maintenance/plan hashes must
be distinct. Add a narrowly recorded source-fault substituting a spread copy at
the actual owner-to-provider call, with SAME original owner/token/private input;
refuse before first reservation parent resource port, without inspection exports.
This counterfactual source graph is explicit, not healthy production-graph credit.
Hold SAME child BEFORE publication, lose PG response or burn shared owner, then
let it publish: suspending only exit after an earlier rename is insufficient.
Externally read late fixture ROOT evidence outside parent counters. A process
double explicitly models publication and natural stream events, labeled parent-
source-only rather than OS atomic/child-execution qualification. Also exercise
the complementary order: child acquisition succeeds, actual provider FINAL PG
query suspends and loses response; even after SAME final query settles, retained
reservation/legacy close/retry stay quarantined, with no traps/ports/disposal.
Full positive execution-worktree DB+FS owner coupling, finite legacy exclusion,
selected source/selector, changing phase/durable intents, six effects/controller/
authenticated foreground/current host and genuine clean-main build remain open.

## Task4i.8 nomination: canonical local JS/child drain before PG locks

The next bounded gate belongs to the same owner-bound reservation route. It
must stop admitting this canonical application's registered producers and await
their actual original native promises, then separately await nominated execFile
children's original exit/close and streams BEFORE entering pre32 PG locks.
Uninstall/teardown originals may require PG writes: waiting under the SHARE
locks can deadlock. A diagnostic/DATA conjunction lacks actual producer freeze;
draining inside the held transaction has the wrong ordering. Select the existing
canonical source-owned registry before the transaction, without registry edits.

Only reservation preparation lazily imports the fixed compiled module
ROOT+'/dist/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.js'.
Retain that original import exactly like existing canonical imports. Old original
and pre32 routes must not import or acquire it. After authentic bilateral scope
enrollment set private stage='draining'; genuine participant live-token ports
deny that stage. Acquire fixed zero-arg acquireDashboardCutoverLocalProducerDrainV2,
then acquireDashboardCutoverLocalChildDrainV3 using SAME returned JS handle.
Private occurrence records retain intent, original native promises and actual
fulfilled handles BEFORE fallible post-await checks. Losing a response never
permits replacing handles, retrying acquisition or treating eventual settlement
as a fresh authority. Keep originals in unknown custody even on refusal.

Canonical assertDashboardCutoverLocalProducerDrainV2 and
assertDashboardCutoverLocalChildDrainV3 authenticate both WeakMap handles before
marking ready/working and invoking definition pre32. Subsequent checkOperation
cuts assert retained ready handles resource-free; no reverse PG/owner/FS reads,
caller callbacks or caller handles. Pending drain reentry burns shared lifetime
before parsing and cannot dispatch PG/ROOT or dispose bilateral originals.
The existing owner-invocation embargo remains distinct and unchanged.

Exact four-file map: adapter.mjs, adapter builtin test, paired plan/spec. Owner
fixture adds exactly one finite TS bridge from actual registry .ts to canonical
dist/internal-production .js before fixture source finalization. Manual outputs
and PG/native/Python doubles remain explicit. No new exported production API,
declaration/registry/owner/provider/native/Python/launcher/CLI/live wiring edit.

Qualification must reproduce actual missing ordering, not an API-existence RED:
hold SAME registered producer native promise; observe actual first PG open or
monotonic fresh-producer refusal; snapshot PG/ROOT BEFORE releasing original;
then naturally settle original and evaluate literal zero-before expectations.
Unknown original child return must block before PG/ROOT even with settled JS.
Complementary owned real Node child earns only that child leaf's natural
exit/close/stream receipt, not whole native or host qualification. A timeout is
test failure/unknown, never accepted drainage. Preserve all original programs,
envelopes, pins and source-only/double boundaries. No reset/revert of user bytes.

This canonical registry covers only nominated current-process source consumers.
It is not finite old-loaded-process exclusion, queued legacy contender freeze,
positive execution-owner PG+physical binding, final-lstat-to-unlink monotonicity,
six-effect/controller/foreground/native build or live port3333 qualification.

Task4i.8 bounded qualification refinement after independent source review:
capture SAME genuine published bilateral scopes diagnostically, attempt actual
provider assertions during pending JS drainage, and compare all direct counters
before/after and after SAME original settles. Separately inject response loss
only AFTER actual Reflect.apply installs the original intrinsic native-promise
observer; no legacy/reentry call supplies the burn. Verify later genuine native
promise fulfillment and SAME canonical authenticated JS handle remain privately
retained; child intent false, ready false, unknown true and PG/ROOT0. No caller
authority or production inspection API is added. Supplementary oracle REDs use
two explicitly labeled finalized fixture source faults: one literal working-stage
substitution and one literal dropped fulfilled-value/returned assignment. Root
production bytes stay unchanged; these graphs never earn healthy qualification.
Only current graph with source fault disabled counts as the two additional GREENs.

## Task4i.9 nomination: census-owned retained physical/binding bracket

The existing physical V2 observer is diagnostic: first-pass callback runs with
blockers, later Git-admin churn is appended, marker FDs close internally, and
outer finally closes directories/files. Released V7 and separate snapshot PG
transactions cannot furnish SAME pre32 custody. Select an additive literal
retained profile owned by the genuine census scope. Never infer this capability
from status/hash/partition DATA, sampled process absence or old receipt objects.

Bounded cold-zero contract: keep pre32 aggregate nonzero-owner rejection intact;
query canonical active/binding rows through the SAME privately held connection,
normalize actual postgres Result containers, reconcile counts/identity, require
all active rows zero. Physical retained/development/deployment Git candidates
stay visible and are not owners merely because present. Positive runtime owner
admission and complete DB/FS identity proof remain subsequent work; no Task6A.

Adapter sets private physical invocation intent before one fixed census call:
runHeldDashboardCutoverPre32PhysicalReservationV4(scope,originalOwner,token).
Separate physical-pending participant embargo covers imports, FS discovery and
binding queries; the existing owner invocation embargo stays intact. Fixed
assertDashboardCutoverJointPhysicalTokenV4(token,owner,scope) authenticates SAME
coordinator WeakMap record/route/working phase/local drain/pre32 scope/owner and
physical intent; it performs only resource-free checks. It accepts no caller
ports or flags. Recovery of the actual complete physical operation alone ends
the physical-pending embargo; rejection/response loss stays UNKNOWN.

Census owns physical occurrence intent, SAME scope/owner/token, original import,
canonical module, original native invocation Promise and recovered return. The
physical module has its own private single occurrence and retained holder; no
holder is returned publicly. Its fixed run(scope,owner,token) derives canonical
home/workspace internally, invokes a private version of existing physical
discovery, and refuses the full first-pass blocker set INCLUDING Git-admin churn
BEFORE fixed census binding read and canonical owner reservation dispatch. After
owner return, unchanged second-pass Git/lsof/identity comparisons must complete.
No mode, callback, path, query, URL, module locator, DATA snapshot or hash is an
input to either fixed public operation. Existing diagnostic callback and cleanup
semantics stay unchanged; the retained profile is private and additive.

All nominated retained open occurrences register path/kind/intent BEFORE open;
retain returned descriptor before subsequent fstat/reads/fallible checks. Keep
directories, incidental files AND linked .git marker originals in private
records. No finally cleanup, pop/discard, retry, reopening or replacing an
original after uncertainty. Healthy return also retains originals in this slice:
bounded single-attempt custody avoids inventing an unqualified close protocol.
Existing diagnostic cleanup remains separate. No broad timestamp adoption,
compareMutation disabling or generic ignored paths. ROOT publication changes its
already-existing baseline parent, not held workspace/home ancestors; fixtures
must create all layout and durable OPEN/claim before first hold. A newly pinned
baseline-parent transition would need separate exact source-owned proof.

Resource-free census assertHeldDashboardCutoverPre32PhysicalMetadataV4 authenticates
SAME census WeakMap record/scope/owner/token and burn without FS/SQL or reverse
adapter calls. Physical ports use this plus fixed adapter fence; they do NOT call
the PG-reading assertHeldDashboardCutoverPre32DatabaseV2. Explicit physical
assertHeldDashboardCutoverJointPhysicalReservationV4 checks actual original FDs,
paths and absence/churn without SQL. Census state.read brackets journal/census
queries with that physical assertion, including the hidden final read after
callback return. Thus burn in a driver/query invalidates physical ports without
an FS→PG→FS assertion recursion.

Track actual successful begin RETURN before finally revoke/end. On begin rejection
mark census burned and synchronously notify the canonical shared token BEFORE
the potentially suspended end await. Retain actual callback/query/physical
promises; late settlement never converts rejection into recovered begin success.
Ordinary PG scope assertions still require current+live and remain unchanged.
After callback finally sets live=false, the only physical-check phase is genuine
begin-success, end-success, callback settled, pending-null, not-burned outer
success, checked BEFORE current is cleared. It permits physical reassertion,
never a DB read or reuse of the closed transaction. Retained physical metadata
may remain authentic after healthy outer completion; burned state cannot.
Outer final failure/source/local-registry burn keeps originals and shared UNKNOWN.

Exact nine-file map: adapter.mjs/.d.mts/builtin test; census.ts/census test;
physical catalog.ts/physical test; paired plan/spec. Four additional finite TS
bridges in owner fixtures: physical catalog, active-binding snapshot, active-row
snapshot and binding rows. Manual outputs are not a production build. Explicit
inert lsof command receipts cannot establish host process absence. Real private
Git/FS controls do not establish real PostgreSQL, backend-death, native effect,
full legacy/root monotonicity, six-effect/entry or live3333 clearance.

Task4i.9 independent nomination refinements: import canonical physical and
active/binding modules during reservation-only prepare under original source
retention BEFORE locks; fixed census resolves those SAME URLs. Public PG-reading
scope assertions refuse active-FIRST while the physical original is pending;
internal metadata and single fixed binding operation do not use that assertion.
`complete` catalog is not physical zero-owner proof: runtime-zone candidates
and referenced retained-zone candidates refuse in this no-positive-exception
profile, even absent ordinary blockers. Do not silently turn existing dirty
retained development trees into owners or remove them. The existing finite
legacy exclusion/source/selector policies remain distinct live prerequisites.

Owner dispatch remains coordinated by fixed adapter
executeDashboardCutoverJointPhysicalOwnerReservationV4(token,owner,scope), not
an injected callback. It authenticates the SAME tuple and canonical private
physical owner-ready state through assertHeldDashboardCutoverJointPhysicalOwnerEntryV4
before setting reservation.invocationIntent. Physical ready is set only after
fresh complete first-pass policy and SAME connection binding validation; early
calls cannot set owner intent. Dispatcher retains actual owner Promise and sets
returned only after recovered return and canonical reservation assertion.
Participant embargo spans physical and owner occurrences independently. Neither
marker closure nor late DB/child/driver settlement releases any original.

The first-pass gate is reasserted AFTER the awaited SAME binding read and BEFORE
setting owner-ready or entering the dispatcher: original FD/path/absence/churn,
parent/candidate Git lists/identity and lsof references, plus cold-zero policy.
Do not inherit V2's before-callback/after-whole-callback-only placement. A real
private directory change during a suspended binding query must refuse ROOT even
if the earlier first pass and DB row snapshots were complete. This source-owned
fresh check is still a trusted observer composite, not universal syscall fencing.
