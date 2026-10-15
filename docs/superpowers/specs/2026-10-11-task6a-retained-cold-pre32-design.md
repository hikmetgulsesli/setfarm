# Retained cold-pre32 phase verification

## Objective and intentional phase scope

Require the closed pre-cutover probe's retained backend to have actual canonical
source1-through31 journal identities and no32/33 journal/catalog remnants. The
current restricted access/base/owner baseline alone can accept checksum drift or
later phase remnants. This is phase authentication, NOT owner/admission authority.
The probe remains zero-input, void-returning, finite, and closes its custody. It
cannot be reused as a capability. A later full33 runtime needs its distinct genuine
current-head producer; this cold-pre32 operation intentionally refuses that state.

## Alternatives and chosen architecture

1. Retained lazy import of unchanged canonical journal owner after the three
   existing restricted checks, plus one inert cold-absence leaf (chosen). One
   manifest/checksum/error producer, no frozen semantic-region change.
2. New generated31 manifest: introduces another synchronization/provenance
   contract and is unnecessary for this bounded phase.
3. Eager import: reaches factory registrations and source scans before fixed
   acquisition and was already rejected by independent review.

The canonical migration module is NOT inert: it registers six error factories,
asserts semantic definitions, and in TypeScript-source mode reads source digests.
This newly reachable initialization graph must be nominated and reviewed. Capture
the genuine import Promise before await; retain custody and prohibit rollback,
release or FD close until that same import settles. Recheck before and after;
rejection or custody drift fails while independent rollback/native close still join.
No race, deadline-based release, retry, generated manifest or fake transaction.
Verify the actual emitted lazy boundary in addition to modeled import controls.

## File Map and exact interfaces

Integration prerequisite (2026-10-12): the existing launcher's static adapter
import and census's adapter-to-retention edge must be included in the finite
bootstrap/fixture source closure. `scripts/deployment-cutover.mjs` authenticates
ONLY the added `scripts/deployment-dashboard-cutover-adapter-v2.mjs` through its
existing tracked-blob, held-file, mode and owned-byte checks. The bootstrap
fixture copies this unchanged script before source pinning and accepts exactly
this and `scripts/build-generation-retention.mjs` as non-TypeScript census
inputs. Every other script/foreign/noncanonical input remains rejected; scripts
never enter the TS-to-dist output loop. Existing host tests must witness actual
fault intervention, not pass on an earlier import refusal. A fixture-only input
`scripts/__tests__/deployment-cutover-bootstrap-inputs.test.js` owns
finite-membership negatives. No adapter initializer, frozen
migration, loader safety gate, services or database authority are modified.
The shared `tests/internal-production/cutover-feature-branch-bootstrap-fixture-v1.ts`
copies the same adapter and existing process-event `.mjs`/`.py` DATA owners. Its
four existing bootstrap consumers retain feature-branch source-authentication
and genuine clean-main source-build refusal companions, exact native1/null and
no spawn error. A wrong earlier stage never qualifies these controls.

- New `src/internal-production/task6a-cold-pre32-catalog-readonly-v1.ts` owns ONLY
  existing census absence SQL and five-field guard/error. It consumes structural
  `ReadOnlyCatalogTransactionV1`; export
  `requireColdPre32CatalogAbsenceInTransactionV1(transaction):Promise<void>`.
  It returns no facts/authority, owns no client/transaction, has no value imports.
- `baseline-legacy-database-census-v1.ts` retains its ordinary helper/callers and
  delegates to this same body through genuine connection.unsafe. SQL/zero counts,
  exact keys, public scope,63-byte names and fixed error stay unchanged.
- `task6a-protected-postgres-backend-probe-v1.ts` composes the leaf and unchanged
  `verifyHeldPre32ContractSpineJournalIdentityV1` inside its existing transaction,
  AFTER access/base/public-owner checks. Its callback copies readonly numeric
  parameters into the bracket's native parameter array; no PendingQuery cast.
- `contract-spine-migrations.ts` remains byte-identical. Existing verifier queries
  versions<=31, so the absence producer is mandatory: it detects later journal
  rows and relation/function/type/trigger remnants independently.
- Existing probe/producer/census tests: exact cold row guard, lazy import lifetime,
  rejection/reentry/drift controls; preserve real ordinary callers and lock order.
  Copied census tests bind the new real leaf explicitly, not a fake census body.
- Native entry/private fixture: canonical31 healthy; exact checksum and32/33 row
  or owner-qualified catalog-remnant perturbations. RowDescription distinguishes
  real journal and five cold-count rows. Snapshot includes sampled rows/ACLs and
  targeted remnants; restore only under certain original child termination.
- New `tests/execution-attempts/task6a-cold-native-emission-v1.ts` and its test
  own the finite genuine esbuild split-output validator; interface
  `emitTask6aColdNativeV1(outputDirectory)` returns validated in-memory outputs,
  entry/canonical paths and metadata, without publication. Fixed holder-only
  importer alias never aliases canonical. Require exact dynamic probe-to-owner
  input edge, unique positive canonical contribution, complete output-byte and
  metadata bijection, and reconciliation of actual relative emitted imports.
  Canonical must be outside the entire static entry closure, including shared
  chunks/reexports. Genuine lazy healthy and eager/shared-chunk counterexample
  controls are compiler-graph evidence only; seal every validated chunk before
  native use. Keep the previous sealed capsule unchanged.
  The same test utility exports pure DATA validator
  `validateTask6aColdEmissionV1(result,nomination)`; nomination contains absolute
  outputDirectory/entrySource/probeSource/canonicalSource for tiny genuine
  compiler controls. This never changes the fixed emitter's paths or plugin.
  This validator proves split-graph separation, not dynamic-import timing;
  actual native before/after-baseline load observations remain mandatory.
- Native baseline observation is test-only and cannot manufacture a producer
  refusal. New `tests/execution-attempts/task6a-native-baseline-observer-v1.ts`
  and its `.test.ts` own `createTask6aNativeBaselineObserverV1(options)`:
  options are private `contextIsCurrent():boolean`, `checkpoint():void` and
  `event(name:string):void`; result has nonthrowing
  `observe(role,original,transaction,owner?):void`,
  `canonicalRequested():void`, `joinOriginals():Promise<void>` and diagnostic
  `snapshot()`. Enroll each SAME genuine original before validation/reactions;
  attach safe reactions before returning to consumer; preserve undefined failure
  presence. Snapshot is diagnostic data, never owner/readiness/admission facts.
  Unit checkpoint/producer ports are explicitly modeled, not native evidence.
- New `tests/execution-attempts/task6a-native-baseline-observer-bridge-v1.ts`
  and its `.test.ts` own three non-async wrappers returning the SAME genuine
  verifier Promise, receiver and complete arguments through `Reflect.apply`.
  They invoke entry-exported `observeTask6aNativeBaselineOriginalV1` without
  substituting errors/results. The fixed emitter aliases only exact probe
  importer and literals `../db/contract-spine-runtime-access-readonly-verifier-v1.js`,
  `../db/base-schema-readonly-verifier-v1.js`, and
  `../db/public-object-owner-readonly-verifier-v1.js` to this physical bridge.
  Bridge imports the corresponding genuine owners normally; canonical is never
  aliased. Require actual positive bridge/observer/three-owner contributions and
  exact route metadata, not only filenames. Generic DATA nomination stays four
  fields; extra fixed-route authentication belongs to the fixed emitter.
- Entry installs genuine named `registerHooks` BEFORE probe import. Entry-owned
  pure callback factory
  `createTask6aNativeCanonicalLoadObserverV1(canonicalURL,checkpoint,event)` has
  a `load` callback and diagnostic requested/returned/failed/failures snapshot.
  New `tests/execution-attempts/task6a-native-canonical-load-observer-v1.test.ts`
  uses explicitly modeled hook/checkpoint/event ports to prove unchanged
  delegation/result/context/error identity, exact URL matching and sticky
  duplicate/timing failure. It does not claim actual native module loading or
  evaluation. The native runner later receives only the freshly sealed fixture's
  exact canonical URL; callback tests grant no production namespace authority.
  Marker only
  after handle acquisition. Exact sealed canonical URL load request requires
  ACCESS->BASE->OWNER fulfilled, identical transaction and setfarm_owner argument,
  latest native ready state T, one BEGIN/no ROLLBACK, five live original FDs and
  no native close. Wrong timing is sticky observer failure; delegate
  `nextLoad(url,context)` unchanged even on failure and preserve its genuine error.
  Load request/nextLoad return/probe import settlement/actual journal query use
  are distinct; no invented direct canonical-import-Promise observation.
  Missing/replaced context also retains and observes the original without
  throwing back into production. Join probe import/result/native close plus all
  baseline and observation originals before deregistration/context restoration.
  Native phase-only canaries require all three fulfilled and canonical load1;
  existing wrong-tuple/access/base/owner refusals require exact baseline prefixes
  0/1/2/3 and canonical load0. Previous sealed native capsule remains unchanged.
- `package.json`: include new focused coverage in ordinary test entry if needed.
  Paired plan and external evidence ledger nominate all changed/captured owners.

## Tests and limits

Witness RED against the current baseline by making phase-only perturbations while
the three baseline gates remain healthy. GREEN requires real healthy companion,
precise intended refusal rows, actual rollback/transaction/native close and five
FDs before/after restart. Source/control tests never authenticate fixed namespace.
Capture source/tools and natural child close, preserve8GiB disk reserve. Keep all
existing worktrees, live services, protected pair and historical failed receipts.
Do not change accounts/grants/security policy on live host, install fixed authority,
weaken full33/guarded32, claim stock build/noEmit equivalence or select live3333.


## Exact native phase companions, 2026-10-13

The eight phase-only native modes are phase-checksum, phase-journal32,
phase-journal33, phase-table, phase-index, phase-function, phase-type and
phase-trigger. Each retains fulfilled ACCESS/BASE/OWNER and load1. Record
actual31 journal DataRows even for checksum drift; checksum refusal has no
cold row, all other phase modes have their exact nonzero cold-count row.
Catalog objects belong to setfarm_owner so refusal cannot borrow the earlier
owner gate. Snapshot public function/type and qualified trigger state before,
during and after each private intervention, and restore only under certain
original child termination. No later journal identities are copied from source.


## Verification boundary, 2026-10-13

The paired plan now records actual32 before/after-restart phase cases with their
wire rows and natural terminal custody,58 compiler/observer controls, strict
861-root noEmit and156 adjacent source cases plus4 changed JS census controls.
Two independent current-source reviews and full capture/copy audits passed.
No stock build, fixed production namespace, genuine genesis/controller admission,
full native dependency freeze, privatePG quota or live3333 qualification follows.
