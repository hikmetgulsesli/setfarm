# Setfarm and Mission Control Internal Production Closure Design

Date: 2026-08-13
Status: Approved for implementation planning and execution
Scope: Internal operational acceptance for Setfarm V3 and Mission Control on the canonical Mac mini host

## Executive Decision

Finish Setfarm and Mission Control as an internally reliable software factory before pursuing external distribution.

This program does not include Developer ID enrollment, notarization submission, signed PKG production, installer receipt authority, authenticated helper installation, or external customer distribution. Those remain a separate follow-on program. The existing production-admission preflight must continue to report those missing external authorities honestly and must not be weakened to make internal acceptance pass.

Internal completion requires evidence that current clean-main Setfarm code can create, implement, verify, transfer, and operate multiple representative products through V3, and that Mission Control renders the same canonical operational truth as PostgreSQL and Setfarm. A healthy HTTP endpoint or a green unit-test suite is necessary but not sufficient.

## Current Baseline

The following list is historical evidence observed on 2026-08-13. In particular, SHA `865a7157ba5dacd24283af03c00400499aac6de7` and contract-spine migrations 1 through 29 are not the execution baseline for the remaining closure work:

- Setfarm `main` equals `origin/main` at `865a7157ba5dacd24283af03c00400499aac6de7`.
- Setfarm version `2.3.79` has a clean-main build whose `BUILD_INFO.json` binds that exact SHA and reports `dirty:false`.
- Contract-spine migrations 1 through 29 are current in the live PostgreSQL database.
- Setfarm dashboard, Mission Control, and OpenClaw health endpoints return HTTP 200.
- The live database has zero active runs, zero open claims, and zero active runtime sessions.
- The live database contains 32 V3 runs, all terminally failed, and no completed V3 run.
- Those historical failures predate part or all of the current authority, recovery, and publication closure work and cannot prove or disprove the current build by themselves.
- Historical Mission Control observation: one local commit on `feat/product-build-authority-v2` was once one commit ahead of `origin/main` and had not yet been delivered. That observation is superseded by reviewed PR #19 merge `240e779d78804843a1202cbf0440fe423b806b1a`, which current clean synchronized Mission Control `main` must retain as an ancestor.
- Mission Control reports 112 projects as `active` while PostgreSQL reports zero active runs. The meaning and derivation of that mismatch must be resolved before Mission Control acceptance.
- The platform-release preflight correctly remains non-authoritative and blocked because external signing, notarization, installation, trust, and activation evidence is absent.

### Current-State Rebaseline

Mission Control Product Build Authority V2 behavior and Setfarm's `setfarm.run-operational-snapshot.v3` producer/consumer path are already delivered. Repository truth contains only per-run PBA V2 `authorityHash`, not a global delivery receipt pair, so Task 1 adds one strict read-only `ProductBuildAuthorityV2DeliveryEvidenceV1` projection/endpoint on the fresh reconciliation branch. That projection deterministically binds PR #19 ancestry, the delivered schema/parser/server/UI/test path blobs, current clean Mission Control source/tree/build, focused tests, and the exact vendor lock; it does not redefine per-run authority. Reviewed Setfarm PR #86 delivered Authority V3 at merge `1d691c89760339ea905dfe17f8e9188e62603c1c`, and migrations 1 through 31/current-authority remain delivered evidence to reopen. Task 0 additionally registers exactly one byte/source-bound guarded bootstrap-handoff successor for Task 6A; it remains pending until Task 6A's purpose-bound pre-entry application. The accepted controller source is an execution-time exact clean descendant and is never permanently pinned to `1d691c89` or substituted with the historical `865a7157`/migrations-1-through-29 baseline.

Pre-full-rebind authority deliberately separates the new Task 0 `controllerSourceSha/tree/build` from `loadedRuntimeServiceAuthority`. The latter records source/tree/build plus process/generation/listener identities for the Setfarm spawner/dashboard and Mission Control. OpenClaw is independently authenticated only by process/generation/listener and owner-count identity; its source/tree/build fields are exactly null. Each authority is independently current for its own scope; equality is required only between Task 0 controller and rebound spawner. After Task 6A records its immutable current-entry operation but before schema or manifest mutation, it performs one disjoint `SETFARM-SPAWNER-ONLY` rebind to the clean Task 0 build. An immutable pre-dispatch token alone boots the replacement into `pre-manifest-bootstrap-sealed`; the old spawner must be authentically terminal, and a separate sealed admission binds the new generation plus a post-termination legacy observation proving all 36 owner counters zero. The sealed process exposes no normal DB-ready state, listener, producer loop, or owner byte. Task 6A then applies migration 32 through a sealed-status-bound pre-manifest authorization, activates A, and transitions that same spawner generation once to normal Task 0 admission after ordinary full verification and normal DB initialization—without another restart. Dashboard and Mission Control remain delivered. Only then may the fresh canary run. Task 7 later rebuilds/rebinds all three scoped background services.

Focused Authority-V3 runtime/migration/rollback/terminal-preclaim tests prove the three mutually exclusive setup-packet failure codes. One fresh clean canary separately proves only the exact one-code lifecycle it actually observes: exactly one terminal claim, exactly one termination request, and zero redispatch after terminalization. Polluted pre-fix run 2075 is historical evidence only and is never resumed as the canary. The canary controller internally acquires Task 0's dedicated source-run launch owner-admission fence and exact typed source-run/run target reservations, reobserves zero unrelated owners, starts or adopts the one run, closes both targets only against its terminal settlement, and releases that fence; the current-entry authority binds the fence, both targets, compound close, and release pairs. No caller or shell supplies a guard, root, run, reservation, or identity.

The current-entry pair is deliberately the pre-full-rebind predecessor. Zero-input `prepare-current-entry` records one immutable operation after read-only PBA/v31/pending/source prerequisites and before any live mutation. Zero-input `resume-current-entry` is the sole production coordinator for the token/restart/termination/postzero/sealed chain, pre-manifest migration authorization/application/current audit, A activation, same-generation admission-ready transition, and canary settlement. The applied migration receipt carries the exact v31 audit pair and pre-apply pending-successor pair as its four causal fields plus the acyclic pre-schema authorization chain. Generic full migration verification remains invalid while 32 is pending; the operation-bound sealed startup uses only targeted v31/pending inspection and never reports normal DB ready. Task 7 consumes the already-applied/current receipt and current-entry pair, performs no schema mutation, rebuilds/rebinds all scoped services, and seals the post-rebind successor. Task 8 and every B/C/D/E authority consume only that successor.

Immediately before prepare, Step 1 records the sole strict service census wire body `{schema,spawner,dashboard,missionControl,openClaw,censusHash}`; there is no array or alternate hash alias. Each named projection includes PID, process/service/generation identity, and `processOwnerCount`; dashboard, Mission Control, and OpenClaw additionally include listener identity and `listenerOwnerCount`. Spawner/dashboard and Mission Control include source/tree/build, while OpenClaw's source/tree/build fields are null. `censusHash` is exactly `hashCanonicalJson({schema,spawner,dashboard,missionControl,openClaw})` in that fixed member order and excludes only itself. Prepare creates a strict code-owned `InternalProductionPreMutationLoadedRuntimeServiceAuthorityV1` after the operation exists and publishes its canonical-hash-derived pair through a no-replace store. Its four named projections include the same count fields. `serviceProjectionSetHash` is exactly `hashCanonicalJson({schema,currentEntryOperationRef,currentEntryOperationHash,observedServiceCensusHash,spawner,dashboard,missionControl,openClaw})` in that order and excludes the authority ref/hash plus itself. Step 1 requires `observedServiceCensusHash === census.censusHash` and compares each shared named field rather than whole-object structural equality. The status ABI carries direct pre-mutation ref/hash scalars plus the pair-resolved body, never a structural pair wrapper. `operation_prepared`, every later nonblocked status, and final current-entry authority preserve the byte-identical pair and body; Step 2 pair-resolves it before resume and after ready. A caller body, clone, PID/path/identity override, store scan, reordered projection, or observed drift blocks.

`InternalProductionCurrentEntryAuthorityStatusV1` is the sole current-entry status wire body. Its non-absent fixed prefix contains the operation, controller-source authority, nested PBA-v2 pair, nested v31-audit pair, nested pending-32 projection pair, and direct pre-mutation pair plus resolved body. It has no flattened lifecycle mirrors. Current-entry keeps exactly twelve top states while four strict nested phase unions make every required durable crash boundary visible. `migration_applying` is `prepared | consumed | receipt_published | current_audited`, with consumption, receipt, and current-audit pairs becoming non-null in that order. `spawner_admission_transitioning` is `sealed | admission_ready | runtime_observed`, with admission-ready then mixed runtime authority appearing in order. `canary_running` is `running | terminal_settlement_published`, and close remains null in both. `settled` is `target_closed | fence_released`, and final entry remains null in both; only ready adds nested `.entryAuthority.entryAuthorityRef/Hash`. Each phase repeats the fixed predecessor pairs and has exact null/non-null members; only the terminal nested member may advance to the next top state. `blocked` preserves the exact last-valid status pair and one finite reason code. Missing, extra, crossed, skipped, cloned, flattened, or impossible members fail closed.

Zero-input `verify-current-entry` resolves every deep predecessor subchain in exact lifecycle order: `productBuildAuthorityV2DeliveryEvidence`, `authorityV3Migration31Audit`, `pendingBootstrapHandoffMigration`, `authorityV3FocusedTestReceipt`, `currentEntryOperation`, `preMutationLoadedRuntimeServiceAuthority`, `preSchemaSpawnerRebindAuthorization`, `preSchemaSpawnerStartupToken`, `preSchemaSpawnerRestartAuthority`, `predecessorTerminationObservation`, `replacementProcessObservation`, `postPredecessorTerminationLegacyZeroOwnerObservation`, `preSchemaSpawnerSealedAdmission`, `freshLegacyZeroOwnerObservation`, `preManifestMigration32Authorization`, `preManifestMigration32AuthorizationConsumption`, `bootstrapHandoffMigrationReceipt`, `bootstrapHandoffCurrentAudit`, `ownerProducerManifestActivation`, `ownerProducerManifestHead`, `task0SpawnerAdmissionReady`, `preSchemaSpawnerRebindStatus`, `loadedRuntimeServiceAuthority`, `ownerAdmissionFence`, `sourceRunTargetReservation`, `runTargetReservation`, `terminalSettlement`, `targetClose`, `ownerAdmissionFenceRelease`, `currentEntryAuthority`, and `currentEntryStatus`. After publishing the fresh observation below, it appends `completeZeroOwnerCensusObservation` and `freshRuntimeAndOwnerObservation` as positions 32 and 33. `resolvedAuthoritySetHash` is canonical JSON of exactly this 33-member `{name,pair}` tuple in this order; an unordered map, sort, omitted/extra/duplicate member, body clone, or latest scan is invalid.

The verifier then publishes and pair-resolves a strict `InternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1` before publishing its verification receipt. The observation body is exactly `{schema,currentEntryStatus,entryAuthority,serviceCensus,completeZeroOwnerCensusObservation,completeZeroOwnerCensusObservationBody,controllerRuntimeSourceRelations,observedAt,freshRuntimeAndOwnerObservationRef,freshRuntimeAndOwnerObservationHash}`. It binds the fresh canonical named service census, a fresh post-manifest complete-zero observation pair plus its exact body/hash, controller-to-runtime source relations, and a strict millisecond UTC RFC 3339 time. The spawner relation must equal controller source/tree/build; dashboard and Mission Control retain their authenticated delivered-runtime relation; OpenClaw remains process/generation/listener-only with null source/tree/build. The observation hash is canonical JSON of the first eight fields in their declared order, excluding only its derived ref/hash. Its no-replace store and pair-only resolver reject structural bodies, crossed pairs, manifest/runtime/owner drift, and latest scans.

`InternalProductionCurrentEntryVerificationV1` is exactly `{schema,currentStatus,currentEntryStatus,entryAuthority,resolvedAuthoritySetHash,freshRuntimeAndOwnerObservation,currentEntryVerificationRef,currentEntryVerificationHash}`. The fresh member is the strict `{freshRuntimeAndOwnerObservationRef,freshRuntimeAndOwnerObservationHash}` pair, never an orphan hash. The receipt hash is canonical JSON of `{schema,currentStatus,currentEntryStatus,entryAuthority,resolvedAuthoritySetHash,freshRuntimeAndOwnerObservation}` in that order and excludes only its derived ref/hash. Its resolver reopens all 33 pairs, freshly reobserves the named service census and complete owner census, and requires equality before returning current. This keeps the graph acyclic—observation first, verification receipt second—and any noncurrent or failed equality emits no success body or alternate status shape.

The successor is registry ordinal 32 and the sole guarded migration class member; one ordered migration creates bootstrap-main-claim handoff schema, the PostgreSQL owner-reservation sidecar/singleton owner-admission-head schema, and the manifest/source-build activation authority. The activation family is exactly immutable `internal_production_owner_producer_source_build_authorities_v1`, immutable `internal_production_owner_producer_manifest_set_activations_v1`, immutable `internal_production_owner_producer_manifest_activation_heads_v1`, and singleton `internal_production_owner_producer_manifest_set_current_v1`. Their ordered columns are exact: source is `(source_build_authority_ref text NOT NULL, source_build_authority_hash char(64) NOT NULL, plan text NOT NULL, manifest_hash char(64) NOT NULL, owner_category_registry_hash char(64) NOT NULL, owner_category_census_map_hash char(64) NOT NULL, canonical_body text NOT NULL, created_at timestamptz NOT NULL DEFAULT transaction_timestamp())`; activation is `(activation_ref text NOT NULL, activation_hash char(64) NOT NULL, phase text NOT NULL, manifest_set_hash char(64) NOT NULL, owner_category_registry_hash char(64) NOT NULL, owner_category_census_map_hash char(64) NOT NULL, predecessor_activation_ref text, predecessor_activation_hash char(64), predecessor_head_ref text, predecessor_head_hash char(64), canonical_body text NOT NULL, created_at timestamptz NOT NULL DEFAULT transaction_timestamp())`; head is `(head_ref text NOT NULL, head_hash char(64) NOT NULL, phase text NOT NULL, activation_ref text NOT NULL, activation_hash char(64) NOT NULL, predecessor_head_ref text, predecessor_head_hash char(64), canonical_body text NOT NULL, created_at timestamptz NOT NULL DEFAULT transaction_timestamp())`; and current is `(singleton_key boolean NOT NULL DEFAULT TRUE, current_revision bigint NOT NULL DEFAULT 0, phase text, activation_ref text, activation_hash char(64), head_ref text, head_hash char(64), updated_at timestamptz NOT NULL DEFAULT transaction_timestamp())`. The head relation name is exactly 63 bytes; tests reject the impossible 67-byte variant that retains `_set_` before `activation_heads` and any PostgreSQL-truncated alias.

All three immutable bodies are canonical JSON TEXT. Their CHECK is exactly `jsonb_typeof(canonical_body::jsonb) = 'object' AND octet_length(canonical_body) BETWEEN 2 AND 65536`; application INSERT/adopt/resolve reparses strictly and requires exact `hashCanonicalJson` canonical byte equality before hashing. JSONB rendering, whitespace/key-order/numeric normalization, and duplicate-key drift never define authority.

Literal source metadata names are `ip_op_sba_v1_pkey|hash_uq|pair_uq|plan_ck|ref_ck|hash_ck|body_ck|plan_manifest_idx`; activation names are `ip_op_msa_v1_pkey|hash_uq|pair_uq|phase_ck|refs_ck|hashes_ck|body_ck|pred_activation_pair_ck|pred_head_pair_ck|phase_pred_ck|pred_activation_fk|pred_head_fk|phase_manifest_idx|pred_activation_idx|pred_head_idx`; head names are `ip_op_mah_v1_pkey|hash_uq|pair_uq|activation_pair_uq|phase_ck|refs_ck|hashes_ck|body_ck|pred_pair_ck|phase_pred_ck|activation_fk|pred_head_fk|phase_activation_idx|pred_head_idx`; current names are `ip_op_msc_v1_pkey|singleton_ck|revision_ck|phase_ck|shape_ck|refs_ck|hashes_ck|activation_fk|head_activation_fk`. The `|suffix` notation expands each suffix against the exact prefix before the first bar; no catalog name contains a bar. Exact CHECKs use 1–512 ref octets, lowercase `^[0-9a-f]{64}$` hashes, JSON object/2–65536 canonical octets, plan `A|B|C|D|E`, exact cumulative phases, equality-based predecessor pair nullability, all predecessors null exactly for A, `singleton_key IS TRUE`, nonnegative revision, and the exact revision-zero-all-null versus positive-all-present disjunction. PK/unique/additional indexes and columns are those declared above; every FK is `MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE`. The current head FK uses the unique head/ref/activation quartet. Seed is exactly `(TRUE,0,NULL,NULL,NULL,NULL,NULL,transaction_timestamp())`.

DDL creation order is exact: `ip_op_reject_immutable_v1()`; source/index; activation without head FK/indexes; 63-byte-named head/indexes; activation head FK; current; seed; `ip_op_enforce_current_update_v1()`; then triggers `ip_op_sba_v1_immutable_trg`, `ip_op_msa_v1_immutable_trg`, `ip_op_mah_v1_immutable_trg`, `ip_op_msc_v1_delete_truncate_trg`, and `ip_op_msc_v1_update_trg`. The plan's literal SQL block is normative and duplicated byte-for-byte into migration statements: both functions are `LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = pg_catalog, public`; immutable mutation is SQLSTATE/message `55000/IP_OWNER_PRODUCER_IMMUTABLE_MUTATION`; invalid current transition is `23514/IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID`; missing/nonunique target is `23503/IP_OWNER_PRODUCER_CURRENT_TARGET_MISSING` or `21000/IP_OWNER_PRODUCER_CURRENT_TARGET_NONUNIQUE`. The three immutable triggers are statement-level `BEFORE UPDATE OR DELETE OR TRUNCATE`; current delete/truncate is statement-level; current update is row-level `BEFORE UPDATE`. The current function validates exact OLD/NEW revision/phase/pairs, uses `SELECT ... INTO STRICT ... FOR KEY SHARE` on exact activation/head rows, validates predecessor relations, sets transaction timestamp, and returns NEW; arbitrary/no-op/skipped UPDATE fails independently of the activator CAS.

No other activation-family topology, function, trigger, index, policy, RLS, ownership, or ACL exists. Input `CREATE` text is never compared to `pg_get_functiondef`/`pg_get_triggerdef`. Byte-frozen source statement/token regions and separate expected normalized catalog-rendering constants have distinct source-integrity/digest coverage; the latter are captured from installing the literal SQL and include PostgreSQL `CREATE OR REPLACE`/configuration canonicalization. Projector compares actual normalized catalog output only to those catalog-rendered constants.

It additionally projects exact `pg_proc` facts for both trigger functions: public namespace/name, `prokind='f'`, `pronargs=0`, empty `proargtypes`, null all-arg/mode/name arrays, zero defaults, `provariadic=0`, trigger return, plpgsql, `provolatile='v'`, `prosecdef=false`, exact `proconfig ARRAY['search_path=pg_catalog, public']`, and null ACL. Its exact dependency predicate is `classid='pg_proc'::regclass, objid=function_oid, objsubid=0`; referenced-class joins must yield exactly two normal/refobjsubid-zero rows: language `plpgsql` and namespace `public`. Extra, missing, extension, pinned, return-type, or body-relation dependencies fail. Body relation names remain proven by source digest plus expected catalog-rendered function definition, not `pg_depend`. Exact `pg_trigger` facts include name/relation/function OIDs, `tgenabled='O'`, noninternal, zero parent/constraint, nondeferrable/nondeferred, empty attributes/arguments, null WHEN/transition tables, and `tgtype` 58 for the three statement-before-update/delete/truncate blockers, 42 for current statement-before-delete/truncate, and 19 for current row-before-update. An isolated migrated-catalog regression freezes both functions' exact two-row sets and fails on dependency addition/removal/reclassification; migration source tests independently verify input bytes/tokens.

Internal `existingRelations` is exact original four followed by source, activation, `internal_production_owner_producer_manifest_activation_heads_v1`, and current. Returned `BootstrapMainClaimHandoffV1SchemaProjection` stays the byte-identical nine-member object and `hashCanonicalJson(expectedProjection)` stays byte-identical. Activation metadata is a prerequisite for projector success; there is no public activation projection field or hash. Generic migration remains guarded/pending until Task 6A and is not applied during Task 0.

The pre-schema authorization directly binds the already durable current-entry operation ref/hash. Its zero-input prepare succeeds only by resolving that fixed head in `operation_prepared`; pair-only execute/recover reopens both records and requires equality before dispatch. The pre-dispatch token binds the operation/authorization, authenticated predecessor process/service/generation, and target source/tree/build but contains no predicted replacement generation. Actual generation first appears in a strict replacement-process observation after the strict restart authority and code-owned predecessor-termination observation. The complete acyclic chain—startup token, restart authority, termination observation, replacement observation, sealed admission, and admission-ready—has a strict full record, exact pair, no-replace store, and pair-only resolver at every edge; termination is never a hash-only assertion, structural bodies and latest scans are invalid. Rebind status is an exact discriminated `absent → prepared → startup_token_published → dispatching → pre_manifest_bootstrap_sealed → normal_task0_admission_ready` chain, with a last-valid-pair `blocked` branch. Migration authorization likewise has exact `absent → prepared → consumed → terminal` branches, an immutable consumption pair, and a last-valid-pair `blocked` branch. Current-entry's twelve phases preserve those same pairs and reject every impossible nullability/cross-operation combination.

Activation authority is PostgreSQL-atomic, never a filesystem read-then-rename current locator. Stable PairV1 remains exact `{plan:A|B|C|D|E,ref,hash}`, and store/receipt/resolver/activator V1 signatures never change. Task 0's strict source body union and private body-resolver registry contain only A. Before a later B–E task registers its phase, it must define/version its actual source/tree/build/delivery-evidence body, widen only that body union/registry, and add separate new-versus-historical resolution; empty bodies are forbidden.

The activation transaction order is exact: validate manifest/pair shapes, order, and counts; resolve every source through its fixed new-versus-historical resolver; derive the complete target; then lock and fully resolve singleton current `FOR UPDATE`. Exact target rows named by current adopt. Exact target rows contained in a fully resolved strict current descendant's authenticated predecessor chain throw typed `INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_SUPERSEDED` without mutation. One target row, target byte mismatch, or exact targets with unrelated/broken current is corruption. Only when both target rows are absent may the transaction independently insert an absent resolved source or adopt a byte-identical shared/prior-phase source, then validate the locked predecessor, insert activation/head, and CAS current. Source-row presence is never partial-target classification. Response-loss replay adopts before stale-predecessor rejection; conflict and rollback expose no orphan branch.

Pair resolvers reopen exact immutable rows. Store, public, and transaction-pinned current resolvers all return `InternalProductionOwnerProducerManifestSetActivationCurrentV1 | null`: only the unique seeded revision-zero/all-null row returns `null`; a missing/duplicate row, any other all-null revision, or any half-null/count-invalid row is typed corruption. The transaction-pinned resolver uses the caller's `PgTransactionSql`, holds the singleton lock, and reopens the complete source/activation/head/predecessor chain before owner admission; the public current resolver owns its own read-only transaction and never performs a second unpinned read.

The strict A source authority splits creation from history. New A creation is zero-input and freshly observes current Setfarm, PBA response, and immutable operation; requires Setfarm SHA equal origin-main SHA and controller SHA/tree/build equal Setfarm; reads `vendorProducerCommit` only from `pba.response.evidence.vendorLock.producerCommit`; and proves it is an ancestor, not equal. The bounded canonical authority stores Setfarm Git objects/tree/build, exact immutable operation pair, exact PBA pair plus embedded bounded PBA observation, and immutable ancestor proof; vendor artifacts/authentication remain PBA-bound. Historical pair resolution rehashes that immutable DB body, authenticates its embedded/bound PBA observation and immutable operation, verifies stored Git objects/ancestor proof, and never requires current Setfarm or Mission Control HEAD/tree/build/PBA equality. Existing A and cumulative source rows therefore remain resolvable after main advances. Registry hash uses the literal registry array; census hash uses exactly the registry-order array `INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1.map(category => ({category,censusKeys:INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1[category]}))`, preserving each census-key array order and never hashing the census object. The zero-input A wrapper supplies only the derived A pair and exact manifest; its status derives from committed PostgreSQL rows.

OA17 first makes the source/build/history claims above constructible. Its base freeze expands the exact Task 0 tuple from 101 to 105 with `scripts/__tests__/build-info-version.test.js`, `scripts/write-build-info.mjs`, `src/execution/v3-git-revision.ts`, and `tests/execution-attempts/v3-git-revision.test.ts`; its direct-caller regression correction then expands 105 to 107 with `tests/execution-attempts/v3-implementation-attempt-v2.test.ts` and `tests/execution-attempts/v3-normal-implementation-preclaim.test.ts`. The baseline receipt source/test remain existing tuple members. Before OA17, `controllerBuildHash` was a required but undefined consumer field, not an existing authority. OA17 still does not define or publish the current-entry operation, v31 audit wrapper, pending-successor wrapper, activator/store, or A-only wrapper.

OA17 pins `HEAD^{commit}`/`HEAD^{tree}` before prepare and finalize and derives `InternalProductionPinnedBuildInputSetV1` from exact `git ls-tree -r -z --full-tree HEAD`, never a live glob. Its strict body is `{schema:"setfarm.internal-production-pinned-build-input-set.v1",sourceSha,sourceTreeHash,entries,buildInputSetHash}`; ordered entries are exact `{locator,gitMode:"100644"|"100755",gitBlobHash}` and the hash excludes only itself. Every tracked regular blob is in the tuple, so it includes emitted/copied inputs, package/package-lock/tsconfig, exact prebuild/build/postbuild scripts, their local closure, and every migration/contract/source file inspected by the checks. Each live path is no-follow regular/link-count-one, its mode must equal pinned Git mode, and its bytes must equal `git cat-file blob <gitBlobHash>` before and after; parent plus `{dev,ino,mode,size}` validate-read-reopen identity rejects path/parent swaps. Tracked symlink/gitlink/special modes fail. This direct comparison catches hidden `assume-unchanged`/`skip-worktree` drift even when porcelain is empty. Directory identity is exact `{realpath,devDecimal,inoDecimal,mode}` with unsigned canonical decimal device/inode strings. Strict `PlatformBuildPrepareV2` is exactly `{schema:"setfarm.platform-build-prepare.v2",buildId,sourceSha,sourceTreeHash,buildInputSetHash,branch:"main",dirty:false,porcelainV2Hash,repositoryDirectoryIdentity,distDirectoryIdentity}` in that order; finalize requires the same tuple and prepared directory identities and does not rewrite BUILD_INFO.

Every pinned-input, pre-rotation-dist, retained-archive, fresh-dist output, and observer traversal shares exact caps: `MAX_BUILD_TREE_DEPTH_V1=64`; `MAX_BUILD_INPUT_ENTRIES_V1=10_000`; `MAX_BUILD_OUTPUT_ENTRIES_V1=10_000`; `MAX_BUILD_LOCATOR_UTF8_OCTETS_V1=1_024`; `MAX_BUILD_FILE_BYTES_V1=33_554_432`; and `MAX_BUILD_TOTAL_BYTES_V1=536_870_912`; archive count adds `MAX_BUILD_ARCHIVE_GENERATIONS_V1=8`. Each pre-rotation dist and each retained archive generation resets its own output-entry/byte counters at depth zero and is independently limited to 10,000 dirents and 536,870,912 regular-file bytes. Every traversed-generation dirent counts before classification, including directories, authority files, recognized temporaries, symlinks, and specials; regular-file sizes enter totals before exclusion. At 10,000 a wide unexpected empty directory is valid bounded pre-rotation/archive storage but fails finalize/observer terminal topology; 10,001 fails the cap first.

Build topology is an exact code-owned parity contract. `package.json` must retain byte-identical current `prebuild`, `build`, `postbuild`, `check:migration-digests`, and `check:mission-control-contracts` strings: prepare plus version/English/path/migration/Mission-Control checks; exact build prefix `umask 077 && ` followed by `tsc -p tsconfig.json`, exact server HTML and compat-rules copies, nonrecursive direct prompt Markdown copy, recursive relative-path-preserving step Markdown copy, sole CLI chmod and version injection; then finalize. The build value contains that prefix once at byte zero and no mask reset, so its shell-local mask covers every tsc/cp/mkdir/copy-step/chmod/inject command even under parent umask `0o000`. `tsconfig` must retain exact `{target:"ES2022",module:"NodeNext",moduleResolution:"NodeNext",outDir:"dist",rootDir:"src",strict:true,esModuleInterop:true,forceConsistentCasingInFileNames:true,skipLibCheck:true,types:["node"],include:["src/**/*.ts"]}` without an output-affecting extra. Expected locators are derived only after these literal package/config/copy/prompt/step projections match; drift fails until the contract is deliberately updated.

The five package script bytes are exactly `prebuild = node scripts/write-build-info.mjs --prepare && node scripts/check-version-contract.mjs && node scripts/check-english-contract.mjs && node scripts/check-path-contract.mjs && npm run check:migration-digests && npm run check:mission-control-contracts`; `build = umask 077 && tsc -p tsconfig.json && cp src/server/index.html dist/server/index.html && cp src/installer/compat-rules.json dist/installer/compat-rules.json && mkdir -p dist/installer/prompts && cp src/installer/prompts/*.md dist/installer/prompts/ && node scripts/copy-step-assets.mjs && chmod +x dist/cli/cli.js && node scripts/inject-version.js`; `postbuild = node scripts/write-build-info.mjs --finalize`; `check:migration-digests = node --import tsx scripts/check-contract-spine-migration-digests.ts --check`; and `check:mission-control-contracts = node --import tsx scripts/mission-control-contract-artifacts.ts --check`.

OA17 uses only standard Node `lstat`/`realpath`/`rename`/`mkdir`/`chmod`/`fsync`; it adds no native helper and claims neither `openat` nor `renameat2`. Pinned topology requires exact `.gitignore` rule `.setfarm/`; the exact fixed-policy `check-ignore --no-index -q` archive probe must pass. Prepare validates real same-device `.setfarm` plus exact-`0o700` `.setfarm/build-generations-v1`. Adopting the archive root first requires every direct entry to be an exact lowercase UUID-v4 `<uuid>.dist` real same-device mode-`0o755` identity-stable directory; an unknown/ninth/wrong-name/type/mode/device entry, collision, or drift fails. It then recursively read-only traverses every generation with independently reset common caps. Descendants may be only canonical identity-stable real same-device mode-`0o755` directories or same-device no-follow link-count-one regular files; every dirent counts before classification, and a symlink, hard link, special, collision, swap, or cap overflow fails. Retained storage is not terminal build authority: a generation may be empty, incomplete, a subset, or contain bounded extra canonical directories/files; no exact expected topology, source provenance, ordinary-file mode, or retained-byte hash is claimed. Existing archives remain read-only and are never normalized, mutated, reused as current output, deleted, or pruned.

One fresh UUID-v4 `buildId` names the absent candidate. Prepare finishes the full read-only traversal of all retained generations before classifying the count. If eight valid archives and root `dist` coexist, it throws typed `BUILD_GENERATION_RETENTION_REQUIRED` before reading/mutating dist or writing authority. Otherwise an existing real same-device exact-`0o755` dist first receives a complete bounded no-follow inventory under the common caps. It accepts same-device regular files plus canonical real same-device directories only when `(mode & 0o022) === 0`, checking before opening/descending; `0o700|0o750|0o755` are traversable, while `0o777|0o775` and every group/world-writable directory fail before descendant read, sanitation, or mutation. It provisionally recognizes only the three root publisher families; symlink, special, nonpublisher hard link, collision, escape, drift, or cap overflow also fails before cleanup.

Exact ordered sanitation tuple is `PREVIOUS_BUILD_PUBLISHER_BASENAMES_V1 = ["BUILD_INFO.json","PLATFORM_BUILD_OUTPUT_TREE.json","PLATFORM_RELEASE_MANIFEST.json"]`. Per basename, fixed-only is admissible only as no-follow same-device regular `0o444`/link-count one; both names absent is admissible. Fixed plus one grammar `.<basename>.<lowercase-uuid-v4>.tmp` is recoverable only when both are same-device no-follow regular links to the same inode, link count two, mode `0o444`, and bounded stable bytes identical; prepare rechecks identity, unlinks only the temp, fsyncs dist, then reopens fixed at the same inode/bytes/`0o444`/one link. Fixed absent plus one stable same-device no-follow regular one-link temp at `0o600|0o444` is uncommitted: prepare rechecks/unlinks it, fsyncs, requires both names absent, and never completes the old generation. Unknown publisher-like name, multiple candidates, different inode/bytes, wrong type/device/link/mode, instability, or any other combination fails without cleanup.

Prepare repeats the bounded storage traversal after sanitation. Arbitrary canonical same-device no-follow regular one-link files plus arbitrary real same-device directories—including empty, incomplete, subset, or extra storage—are allowed without terminal topology/byte/mode claims, but every directory must again satisfy `(mode & 0o022) === 0` before descent and have its identity captured. A writable directory or swap fails before descendant read and before any normalization. Only after that whole pass succeeds are captured directories descriptor-normalized in canonical order to `0o755`, fsynced, and identity-reopened. The generation is then renamed unchanged-file to the archive; both parents are fsynced and archived identities/modes rechecked. Lost response adopts only source-absent/exact-candidate. With absent dist, even eight archives permit fresh creation without a ninth. Prepare creates/fsyncs fresh exact-`0o755` dist, derives the exact expected nested closure from pinned ordinary outputs, and precreates the full exact closure parent-first before BUILD_INFO/prepare publication; every directory is descriptor-set to `0o755`, fsynced, parent-fsynced, reopened, and the final closure re-enumerated exact. Thus `tsc`, mkdir/copy/assets under build-script umask `0o077`, including when npm's parent umask is `0o000`, reuse fixed directories. Crashes rotate sanitized incomplete storage rather than finishing it. Per-invocation archive validation keeps at most eight generations and `4_294_967_296` bytes without provenance/hash claims. The malicious same-UID limitation remains explicit.

OA17 has no retention mutation, override, environment switch, or cleanup instruction. OA18 is required before permanent rollout to define separately reviewed operator-owned maintenance-window retention authority with exact inventory, inactive-reference proof, bounded oldest-generation disposition, durable evidence, and crash recovery. Until then `BUILD_GENERATION_RETENTION_REQUIRED` is terminal and no build path silently prunes or bypasses it.

OA17 adds terminal-pre-release `dist/PLATFORM_BUILD_OUTPUT_TREE.json`, strict schema `setfarm.platform-build-output-tree.v1`, fields `{schema,sourceSha,sourceTreeHash,entries,outputTreeHash}`, and entry fields `{locator,mode,byteLength,sha256}`. The exact expected locator set derives from pinned paths: `src/**/*.ts` except `*.d.ts|*.mts|*.cts` maps to the same relative `dist/**/*.js`; `src/server/index.html` and `src/installer/compat-rules.json` map to their same relative `dist` locators; direct `src/installer/prompts/*.md` and recursive `src/installer/steps/**/*.md` map to the same relative Markdown locators below `dist`. No live glob or other ordinary output is permitted. Observed entries must equal that tuple in unsigned UTF-8 canonical POSIX locator order, excluding exactly `BUILD_INFO.json`, `PLATFORM_BUILD_PREPARE.json`, `PLATFORM_BUILD_OUTPUT_TREE.json`, and `PLATFORM_RELEASE_MANIFEST.json`; locators are repository-relative `dist/...`, NFC, bounded to 1,024 UTF-8 octets, unique under raw/NFC/case-fold identity, and contain no absolute/empty/dot/dot-dot/backslash/control segment.

Exact `EXPECTED_BUILD_OUTPUT_DIRECTORY_LOCATORS_V1` is the unsigned-UTF-8-ordered unique proper-directory-ancestor closure below `dist` of those code-owned ordinary output locators; `dist` itself is excluded and root-only authority files add nothing. Prepare precreates/verifies that closure but claims no output file. Finalize and the zero-input observer alone require the combined exact directory/file topology; pre-rotation and archived-storage validation do not. Finalize requires no missing/extra/empty directory, requires every real same-device member to satisfy `(mode & 0o022) === 0`, descriptor-normalizes it to `0o755`, fsyncs, and identity-reopens it. Before ordinary-file normalization it likewise requires every intermediate mode non-group/world-writable; it then normalizes only `dist/cli/cli.js` to `0o755` and every other ordinary output to `0o644`, fsyncs, and identity-reopens. The build prefix keeps intermediates non-group/world-writable even under parent umask `0o000`. Final enumeration under shared caps proves exact file and directory tuples/modes and rereads BUILD_INFO/prepare. Missing/extra/empty, stale, symlinked, hard-linked, collided, group/world-writable, wrong-mode, directory-swapped, or changed output fails. `outputTreeHash` is exactly `hashCanonicalJson({schema,sourceSha,sourceTreeHash,entries})`; directory locators/modes are required non-hash invariants.

BUILD_INFO, output tree, and release manifest share one private non-exported JavaScript publication primitive. BUILD_INFO supplies exact pretty bytes below; output/release supply UTF-8 `JSON.stringify(declaredOrderBody) + "\n"`; temporary grammar is `.<fixed-basename>.<uuid-v4>.tmp`. Fresh publication uses exclusive no-follow `0o600`, write/fsync, chmod/fsync to `0o444`, hard-link no-replace, parent fsync, temporary unlink, parent fsync, then strict reopen of exact bytes/mode/link-count one.

Recovery counts all dirents before classification. Fixed absent plus exactly one grammar-matching stable no-follow regular same-device link-count-one temp at mode `0o600|0o444` treats it as uncommitted. Exact candidate bytes continue through needed chmod, descriptor fsync, and link. Unequal/partial stable bytes cause identity-rechecked temp unlink, parent fsync, then fresh publication. Unknown/multiple/type/device/link/mode-invalid candidates fail without cleanup. Fixed-only adoption requires exact bytes at `0o444`/link-count one. Fixed plus one same-inode `0o444` sibling requires link count two, exact bytes, sibling unlink, and fsync; other fixed/temp combinations conflict. Every recovery/adopt path, including fixed-only, parent-fsyncs then strictly reopens/rechecks fixed bytes/mode/link/parent before return.

All three artifacts own single- and double-crash matrices. The latter crashes recovery before/after unequal-temp unlink and cleanup fsync, recovered chmod/descriptor-fsync/link, sibling cleanup, final parent fsync, and reopen; second retry reaches the same exact terminal or stays fail-closed without overwrite. Prepare remains until output-tree terminal, then is removed before release-manifest terminal publication. Receipt-absent retry rederives and reopens BUILD_INFO/output tree and deterministic manifest without rebuilding or rewriting. Final success rereads all authority bytes/modes/links and identities.

The deterministic manifest is derived from pinned entry `scripts/stitch-to-jsx.mjs`, never from existing manifest bytes. That entry must be Git mode `100644`; its raw pinned blob must be strict UTF-8 and 1 through `16_777_216` bytes. The exact declared-order body is `{schema:"setfarm.platform-release-manifest.v1",releaseSha:sourceSha,branch:"main",dirty:false,stitchConverter:{converterId:"setfarm.stitch-to-jsx",source:{schema:"setfarm.source-artifact-ref.v1",hash:sha256(pinnedBytes),mediaType:"text/javascript",locator:"scripts/stitch-to-jsx.mjs",byteLength:pinnedBytes.byteLength}}}`. The terminal file must equal its canonical artifact bytes. A valid schema with any different outer/nested field, extra member, key order, whitespace, or trailing byte is not adoptable.

`BUILD_INFO.json` is strict declared-order seven-field `{sha,shortSha,branch,dirty,packageVersion,displayVersion,builtAt}` with exact UTF-8 bytes `JSON.stringify(value, null, 2) + "\n"`. Prepare publishes those bytes in fresh `dist` through the shared primitive; the fixed file is no-follow regular, mode `0o444`, link-count one, parent-fsynced and strictly reopened, and finalize never rewrites it. The observer reconstructs the exact pretty bytes and verifies raw bytes/mode/link count plus the source fields; compact, reordered, reindented, BOM, trailing-byte, wrong-mode, and extra-link variants fail, while a restrictive umask cannot alter authority. The first six fields form `stableBuildInfo` after adding leading schema `setfarm.internal-production-stable-setfarm-build-info.v1`; `builtAt` is strict millisecond UTC RFC 3339 metadata and is excluded. `releaseManifestHash` is canonical hash of the complete strict release manifest. `controllerBuildHash` is exactly `hashCanonicalJson({schema:"setfarm.internal-production-controller-build.v1",stableBuildInfo,buildInputSetHash,outputTreeHash,releaseManifestHash})` in that order. Equal pinned inputs/stable metadata/output/release bytes with different valid `builtAt` values therefore produce equal authority; any pinned input, included output byte/mode/locator, or stable/release value changes it.

The baseline receipt's zero-input clean-source observer derives only its real code-relative Setfarm root, uses literal `/usr/bin/git` with replacement locale/PATH and no system/global config, hooks, replacement objects, optional locks, prompt, fetch, or mutation, and has no root/tool/env/ref/SHA/body/fake or packaged fallback. The fixed environment includes `GIT_NO_REPLACE_OBJECTS=1`; clean state is exact empty `git status --porcelain=v2 --untracked-files=all`. Exact `/usr/bin/git -c core.hooksPath=/dev/null -c core.fsmonitor=false config --local --no-includes --name-only --get-regexp '^include'` must return status 1 with empty output, rejecting local include/includeIf; exact `/usr/bin/git -c core.hooksPath=/dev/null -c core.fsmonitor=false config --local --no-includes --get-all remote.origin.url` must return status 0, empty stderr, and exactly one stdout line `https://github.com/hikmetgulsesli/setfarm.git\n`. Empty/multiple/padded/noncanonical origin fails.

Before any artifact read the observer repeatedly snapshots/reopens repository/fresh-dist `{realpath,devDecimal,inoDecimal,mode}`, derives the complete pinned input set anew from HEAD under shared caps, validates every live tracked locator's Git-mode/bytes against its pinned blob with parent plus `{dev,ino,mode,size}` validate-read-reopen identity, and derives the exact expected release-manifest body/canonical bytes from the pinned Stitch converter. This finalized-current observer leaves archives outside its read set; prepare-time archive-root adoption solely owns retained-generation traversal. It then reads through revalidated fresh-dist paths, counts each dirent before classification, reopens each authority/ordinary output, rederives `EXPECTED_BUILD_OUTPUT_DIRECTORY_LOCATORS_V1`, requires the actual nested-directory tuple to equal it, and requires every member to remain real same-device mode `0o755` across identity reopen. It recomputes exact output enumeration/hash and rereads all three authority files. An empty/extra/missing/wrong-mode/swapped nested directory fails even though directories are not hashed. Release manifest must be both strict schema and byte-equal to the pinned-source candidate; shape-only or self-consistent tamper is insufficient. After artifact reads it repeats Git state, pinned-set derivation, all live byte/mode comparisons, expected-manifest construction, authority rereads, and repository/dist/nested-directory identities/modes. Hidden-index drift, any manifest field/byte drift, observable path swap, or cap overflow fails. The standard-Node same-UID limitation applies equally to observer checkpoints. It returns only clean `{branch,clean,sha,treeHash,buildHash,originMainSha}` and derives controller source/tree/build from it.

The low-level `v3-git-revision` historical replay is `replayV3HistoricalGitCommitAncestryV1(...)`; it accepts one caller-owned repository boundary, exactly two full commit SHAs, and their stored ancestor-tree/descendant-tree/merge-base proof values. It reopens exact commit/tree objects with replacement objects disabled, rejects blob/tree/tag/missing objects, requires stored tree equality, accepts only `merge-base --is-ancestor` status 0, requires singleton merge base equal to the ancestor SHA and stored proof, and repeats object/tree reads to reject drift. The baseline wrapper—not the primitive—owns the zero-input fixed-root boundary. Historical replay never requires current HEAD/build/PBA equality.

OA17 RED/GREEN covers bounded whole-dist rotation, pre-rotation publisher sanitation, prepare-time exact-directory precreation, terminal file/directory authority, and the explicit no-native/openat/renameat2 plus same-UID limitation. Pre-rotation accepts arbitrary bounded canonical one-link regular files and real directories at `0o700|0o750|0o755`, completes validation before normalizing them to `0o755`, and rejects `0o777|0o775` or any group/world-writable directory before descent/sanitation/mutation. It also rejects cap/type/link/collision/escape/drift without imposing terminal topology. Per-basename sanitation tests accept absent, exact fixed-only, fixed plus same-inode two-link `0o444` exact bytes cleaned to fixed-only, and fixed-absent one-link stable `0o600|0o444` temp removed as uncommitted; they reject unknown/multiple/different-inode-or-bytes/type/device/link/mode/drift and prove no unrelated file is touched. Archive fixtures recursively read-only traverse every generation under independent caps, accept bounded empty/incomplete/subset/extra storage, reject invalid direct entries plus descendant symlink/hardlink/special/wrong-directory-mode/cap/drift, enforce eight-generation retention, and make no provenance/hash claim.

Disposable-repository restart fixtures execute literal full `npm run build` under each parent umask `0o077` and `0o000`. One interrupts after exact directory precreation but before the first file (`mkdir-before-file`); three interrupt immediately after the fixed hard link for BUILD_INFO, output tree, and release manifest. Faults are fixture-only committed source transformations removed in a new disposable-repository commit before restart; production gains no fault flag/env/root/filesystem/callback seam. The second full build must sanitize rather than finish the old generation, archive it without temp siblings, preseed a new exact-`0o755` closure, and finish terminal authority. Under parent `0o000`, finalize's pre-normalization checks prove every tsc/cp/copy-step/chmod/inject intermediate and directory satisfies `(mode & 0o022) === 0`; terminal ordinary files are `0o644`, sole CLI is `0o755`, and all directories are `0o755`. Finalize/observer alone reject every missing/extra/empty/group-or-world-writable/wrong-mode/symlinked/swapped directory and file/output tamper; prepare/archive accept bounded storage instead. Package parity/source-token tests require exact raw build prefix `umask 077 && ` once at byte zero, the frozen suffix, and no later reset; deletion, move, duplicate, or reset fails. Remaining fixtures cover rotation crash/response loss, 10,000/10,001 and byte/depth/locator caps, tsconfig/prompt/copy parity, builtAt identity equivalence, dirty/origin/ref drift, hidden-index drift in writer/both observer passes, BUILD_INFO exact bytes/mode/link, every shared-publisher single/double-crash state, deterministic manifest tamper, Git ancestry/object cases, both direct callers, the `4_294_967_296` bound, and OA18 dependency. Exact focused gates remain `node --test scripts/__tests__/build-info-version.test.js`; `node --import tsx --test tests/execution-attempts/v3-git-revision.test.ts`; `node --import tsx --test tests/execution-attempts/v3-implementation-attempt-v2.test.ts`; `node --import tsx --test tests/execution-attempts/v3-normal-implementation-preclaim.test.ts`; `node --import tsx --test tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`; `npx tsc -p tsconfig.json --noEmit`; `npm run check:english`; `npm run check:paths`; and `git diff --check`. Fixture subprocesses never build in this worktree; no DB, current-entry/store, service, or live authority mutation occurs.

OA16 adds no path: its exact nine generic paths and separate two wrapper paths are members of the now-107-path File Map. RED/GREEN covers literal identifier/name/length and truncation rejection, exact CHECK/FK/index/function/trigger metadata, arbitrary current UPDATE, source-before-target ordering, shared source reuse, every target classification, response loss, PostgreSQL rollback/commit/CAS/lock/reopen, historical resolution after either main/build advances, embedded evidence/Git-object/ancestor tamper, empty-future-body rejection, registry/census drift, and pinned-current equality. Activation tests use PostgreSQL only; no activation test uses a temp file, fsync, link, rename, filesystem receipt/head, or filesystem current locator.

The ordinary `run` producer lives at the first durable run byte in `src/execution/run-persistence.ts`, not later in `src/spawner.ts`. The two-layer ABI is exact: manifest birth function `persistWorkflowRunInTransaction(sql,input)` resolves admission, begins/adopts the typed run reservation, inserts/adopts the run row, binds the sidecar, and returns its tentative authenticated row/pair only to the enclosing transaction callback; public `persistWorkflowRun(input)` owns and awaits `pgBegin`, is the only production caller surface, and exposes the committed result only after commit acknowledgement. The installer calls that wrapper directly. Rollback, callback failure, commit rejection, or connection loss before acknowledgement exposes neither row nor pair; response loss after an acknowledged commit is recovered as the byte-identical row/pair. Tests hold callback-return and commit-acknowledgement latches to prove no precommit result is externally observable. Before the final pre-manifest reobservation, the current-entry controller takes a fixed non-advisory PostgreSQL run-admission fence on the existing migration-journal head. Every run insertion takes the conflicting lock. Migration 32 atomically converts that protection into the owner-admission-head fence, so an unrelated CLI insert cannot race observation-to-apply. Only the same operation's typed canary target may proceed after migration/current audit, A activation, full verification, and admission-ready.

Manifest A contains exactly sixteen real producer rows. Claim birth is split across `publishSingleClaimRuntime`, `publishLoopClaimRuntime`, `createV3DownstreamEvidencePublication.reserve`, and `createV3EvidenceOnlyPublication.reserve`; finding birth is split across `createFindingRecoveryRepository.putFindingSet` and the private downstream/evidence-only set writers. The other repository births are `persistWorkflowRunInTransaction`, `reserveAttemptInTransaction`, `reserveRuntimeSessionInTransaction`, `createRuntimeCompletionRepository.claim` at `requested → draining`, `markRuntimeCompletionOwnerCommittedInTransaction` in `src/execution/runtime-completion.ts`, `requestRunTerminationInTransaction`, and `createOperationalOutboxRepository.publish`, plus the two fixed source-bootstrap rows. Cumulative activation counts are exactly `A=16`, `A+B=26`, `A+B+C=32`, `A+B+C+D=48`, and `A+B+C+D+E=57`; the 35 categories, 35 census keys, and 36 scalars remain unchanged.

Owner keys are fixed to durable identities rather than retry generations. Run identity is exact `run.id`; retry/reobservation of the same persisted run adopts the same reservation, and only `transitionRunToTerminalInTransaction` closes it when status becomes exactly `completed | failed | cancelled`, with terminal UPDATE and typed close in the same transaction. An already-terminal byte-identical replay adopts the close without advancing the head. Execution-attempt identity is exact `attempt_id`; each `reserveAttemptInTransaction` new generation allocates a new ID/reservation, while retry/reobservation of the same `attempt_id`, generation, and fence adopts. Any CAS from `claimed | running` to exact `TerminalAttemptDispositionV1` member `produced_delta | already_satisfied | no_progress | inconclusive | failed | verified` closes in the same transaction.

The execution-attempt terminal state fixture owns exactly this module/function inventory: `src/execution/attempt-repository.ts#createAttemptRepository.complete`; `src/execution/attempt-reconciler.ts#completeTerminalAttemptForRecovery`; `src/execution/claim-attempt-transition.ts#closeClaimAndBoundAttemptInTransaction`; `src/execution/claim-attempt-transition.ts#completeStoryClaimAndBoundAttempt`; `src/execution/pre-dispatch-withdrawal-authority.ts#withdrawPreDispatchClaimInTransaction`; `src/execution/run-terminal-transition.ts#transitionRunToTerminalInTransaction`; `src/recovery/v3-downstream-evidence-publication.ts#createV3DownstreamEvidencePublication.complete`; `src/recovery/v3-evidence-only-publication.ts#createV3EvidenceOnlyPublication.completeAttempt`; `src/recovery/v3-evidence-only-worker.ts#quarantineDelivery`; `src/recovery/v3-recovery-lifecycle-reconciler.ts#blockExpiredEvidenceAttempt`; and `src/recovery/v3-recovery-lifecycle-reconciler.ts#blockExpiredModelAttempt`. Its AST/runtime scan rejects a terminal UPDATE outside this list, a missing listed writer, or a writer without the authenticated typed close in the same transaction.

Claim identity is `claim_log.id`. Before each of the four claim births, the transaction preallocates the exact BIGINT ID with `SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint AS id`, begins/adopts against it, explicitly supplies it to INSERT, and binds in that transaction. Sequence allocation is not owner birth; rollback may consume an unused value but exposes no owner/pair. Retry/reobservation of the same committed `claim_log.id` adopts; a new story `claim_generation` that inserts a new claim row/ID is a distinct reservation and requires the prior claim terminal close. Runtime session identity is `session_id`; completion and termination use `request_id`; mandatory effect uses `(request_id,effect_key)`; finding uses `finding_set_hash`; operational delivery uses `(event_key,consumer)`. Completion owner-attempt rotation, effect attempt/lease rotation, draining reclaim, and delivery retry do not close or reopen a reservation. Close occurs only after the category's authenticated terminal transition in the same transaction: exact claim close or run terminal; reserved/drained runtime release; completion accept/reject/quarantine; effect settle or terminal effect application, with retry release nonterminal and unreconciled quarantine remaining nonzero; termination request-to-terminalized; exact finding set plus child reread; or delivery settle/quarantine/expired-final-lease sweep. The exact Task 0 literal File Map therefore contains 107 unique sorted paths, including the OA17 build/Git authority paths and direct-caller regressions, `src/execution/attempt-reconciler.ts`, every production owner INSERT/birth, terminal UPDATE, direct SQL/bypass path, and focused regression. A fail-closed AST inventory rejects any undeclared mutation and enforces admission resolution → begin/adopt → birth → sidecar bind → authenticated terminal → close ordering inside one passed transaction. `runtime-completion-effect-runner.ts` is audited only as a terminal/apply caller, never named as the mandatory-effect producer.

Task 0 remains source-only. It may produce reviewed source/tests and deterministic checked-in contract/digest artifacts, and its focused tests may use the isolated private migration-32 lifecycle above. Task 6A is the first live use; Task 0 must not apply 32, create live authorities, run a canary, or restart a service. The local PBA wire parser remains strict and inventory remains 10 → 12 → 14. `producerCommit`, `deliveryMergeSha`, `currentSource.sha`, `currentSource.treeHash`, and `currentSource.originMainSha` accept only 40- or 64-character lowercase Git object hashes; every content/blob/build/receipt/lock/evidence hash is exactly 64 lowercase hexadecimal characters, with 39/40/41/63/64/65, uppercase, and non-hex boundary fixtures. The one pre-schema spawner action is disjoint and current-entry-controller-only. Normal post-activation restarts retain the closed service preparation/pair-only consume API; both paths use only literal launchd labels and code-owned UID/argv. A's seven-entry forward D registry remains import-free.

Every operational command uses a receipt-authenticated root contract rather than a host checkout literal. The owning resolver exports `SETFARM_ROOT` and `SETFARM_ROOT_EXPECTED_SHA` as one read-only binding, and the same shell performs this validation before any package command, observation with acceptance effect, or mutation:

```bash
set -euo pipefail
require_authenticated_clean_main_setfarm_root_v1() {
  : "${SETFARM_ROOT:?authenticated clean-main Setfarm root is required}"
  : "${SETFARM_ROOT_EXPECTED_SHA:?authenticated clean-main Setfarm SHA is required}"
  case "$SETFARM_ROOT" in
    /*) ;;
    *) printf 'SETFARM_ROOT must be absolute\n' >&2; return 1 ;;
  esac
  test -d "$SETFARM_ROOT"
  test ! -L "$SETFARM_ROOT"
  readonly SETFARM_ROOT SETFARM_ROOT_EXPECTED_SHA
  SETFARM_ROOT_TOP="$(git -C "$SETFARM_ROOT" rev-parse --show-toplevel)"
  SETFARM_ROOT_BRANCH="$(git -C "$SETFARM_ROOT" branch --show-current)"
  SETFARM_ROOT_HEAD="$(git -C "$SETFARM_ROOT" rev-parse HEAD)"
  SETFARM_ROOT_ORIGIN="$(git -C "$SETFARM_ROOT" rev-parse refs/remotes/origin/main)"
  SETFARM_ROOT_STATUS="$(git -C "$SETFARM_ROOT" status --porcelain=v1 --untracked-files=all)"
  test "$SETFARM_ROOT_TOP" = "$SETFARM_ROOT"
  test "$SETFARM_ROOT_BRANCH" = "main"
  test -z "$SETFARM_ROOT_STATUS"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_ORIGIN"
  test "$SETFARM_ROOT_HEAD" = "$SETFARM_ROOT_EXPECTED_SHA"
}
```

The expected SHA comes only from the freshly resolved merge/current-build authority. Each standalone operational fence defines this exact function and calls it immediately before every Setfarm package command or mutation; it does not add separate presence/directory checks. A caller-selected root or SHA, fixed workstation path, nonabsolute/symlink/wrong top level, detached/wrong branch, dirty tree, stale tracking ref, or mismatch fails closed before the operational command.

## Completion Claim

The program may claim internal completion only when all of the following are true:

1. Current clean-main Setfarm completes representative V3 products from a new run through the required terminal product state.
2. The completed products actually run and satisfy product-specific behavioral assertions generated and executed by Setfarm-owned verifiers.
3. Mission Control displays the same run, step, story, claim, runtime, failure-owner, retry, evidence, and terminal state as the canonical Setfarm operational model.
4. Controlled crash, restart, retry, PR-review, and provider-failure scenarios settle without duplicate ownership, lost work, leaked processes, or invented success.
5. A bounded multi-project fleet completes without an unresolved Setfarm-core or Mission Control systemic failure.
6. Both repositories end on reviewed, clean, synchronized `main` branches with green builds and tests.
7. The live host has a tested backup, restart, verification, and incident procedure.

Internal completion does not mean external distribution authority exists. The existing `setfarm platform-release preflight --json` command remains the exact readiness-v2 contract and must continue to emit `productionAuthority:false` and `productionAdmission:"blocked"` until the later external-distribution program supplies real authority. E's separate code-owned recorder parses that exact readiness-v2 value, joins fixed host observations, and seals closure evidence; the public readiness CLI does not emit `ExternalDistributionPreflightEvidenceV1` directly.

That closure evidence is strict, not a prose note or arbitrary hash. It contains one content-addressed `ExternalDistributionPreflightEvidenceV1` with its derived canonical ref/hash and an exact five-member authority-observation census in this fixed order: Developer ID identities, notarization authority, signed-and-stapled package, installer receipt/payload authority, and authenticated install-helper authority. Every observation remains present with status `blocked | unverifiable | satisfied`, bounded readiness reason codes, sorted details, fixed-family `CanonicalRef` evidence, and a recomputed observation hash. `blockers` is exactly the ordered projection of non-`satisfied` observations; no observation may be omitted or represented by an unrelated blocker. For this closure, external distribution is deferred, so all five observations are `blocked | unverifiable` and the blocker projection has exactly five entries. Caller refs, paths, URLs, logs, secrets, generic strings, cross-code evidence, and incomplete/reordered censuses are invalid. The cold receipt, independent pre-packet review, final input, tracked JSON and Markdown, and private post-handoff/final-acceptance receipt all bind the exact same readiness hash, census, blocker projection, ref, hash, and false/blocked literals. Each trust boundary fresh-resolves and rehashes the evidence and requires byte equality.

### Operational Epoch and Documentation-Only Descendant

Internal acceptance distinguishes two Setfarm identities and never conflates them. The accepted operational epoch is the exact `GoldenFinalReleaseEpochV1` pair `{operationalSetfarmSha, operationalMissionControlSha}` on which C's final matrix, D's recovery acceptance, E's fleet settlement, and the cold rehearsal ran. After those authorities are private and immutable, one later Setfarm documentation-only squash merge may create `documentationSha`. That commit must have `operationalSetfarmSha` as its sole parent, Mission Control must remain at `operationalMissionControlSha`, and its complete Git delta must be exactly the six registered acceptance-packet files for one closure generation.

The closure generation is derived before E renders either final-closure document or seals its later closure finalization. Its exact identity is `closureGenerationHash = hashCanonicalJson({epochHash: finalReleaseEpoch.epochHash, matrixFinalizationHash, recoveryFinalizationHash, fleetFinalizationHash})`; there is no schema member, operational SHA, full epoch, E closure-finalization hash, output content hash, path, or timestamp in that pre-render hash input. Its only combined directory is `docs/review-packets/internal-production/epoch-<full-epoch-sha256>-closure-<full-closure-generation-sha256>`, and its six fixed basenames are `golden-matrix-report.md`, `recovery-matrix.md`, `recovery-reconciliation.md`, `golden-fleet-report.md`, `final-closure.json`, and `final-closure.md`. The pre-render input and packet bind the same four-member generation input tuple, generation hash, directory suffix, ordered paths, and immutable owner identities needed to reopen C matrix, D recovery-matrix Markdown, D recovery-reconciliation Markdown, B fleet, and E renderer inputs; they do not claim either E output hash or the completed six-content-hash tuple. Only the later E finalization, docs-session completion, and post-handoff receipt bind the six actual content hashes after both E outputs exist, alongside that unchanged generation identity. The independent `closureFinalizationHash` is bound beside the generation and never feeds it. A new operational epoch derives six distinct initially absent targets; all prior generation files remain tracked and byte-identical. No new session overwrites, deletes, renames, or adopts a partial prefix from any generation.

The documentation descendant is never a second accepted operational epoch. It is eligible for final clean-main acceptance only when a fresh, private, non-circular post-handoff receipt resolves the tracked pre-handoff packet and its pre-packet review/finalization, authenticates the docs PR/base/head/squash/sole-parent lineage, independent review history with zero unresolved Critical/High/Medium findings, the exact successful check set, six paths and content hashes, and proves executable/source/build semantic projection equality to `operationalSetfarmSha`. The receipt also rebinds the three services, authority audits, and complete zero-owner census. The final internal-production acceptance authority is the tracked packet plus that exact private post-handoff receipt; neither alone is sufficient. Its current/final resolver additionally requires clean synchronized Setfarm `main` with `HEAD === documentationSha` and clean synchronized Mission Control `main` with `HEAD === operationalMissionControlSha`. A historical ancestry resolver is archival inspection only and can never establish current or final acceptance.

When every relation above holds, the documentation SHA is a metadata-only descendant and C/D/E need not rerun. If docs-PR review finds a byte-affecting defect in any of the six generated files, the documentation owner abandons the entire isolated claim; it never edits those immutable materialized bytes in place. A packet/evidence-only correction creates a corrected pre-packet review, input, private finalization, fresh exact-operational-base six-entry session, and new docs claim. A source or generator correction instead creates a new operational epoch and reruns C through D through E before another docs claim. If the commit is not the sole-parent squash, its delta is not exactly the registered six files, any executable/build semantic projection differs, Mission Control moves, either current HEAD differs from its required SHA, or the receipt/review/check/service/audit/zero-owner chain cannot be freshly resolved, the documentation exception does not apply. The changed Setfarm SHA then requires a new operational epoch and a new C/D/E acceptance sequence.

## Source-of-Truth Hierarchy

Every acceptance decision uses this hierarchy:

1. PostgreSQL rows, claim logs, completion requests/effects, migration journals, run observations, and exact GitHub PR state.
2. Setfarm's canonical operational model, compiler artifacts, authority receipts, and runtime evidence.
3. Mission Control API projections of that model.
4. Mission Control rendering.
5. Agent or supervisor prose.

Lower levels may explain higher-level evidence but may never override it. A card that says `active`, an agent that says `tests passed`, or a generated project's own status file cannot prove acceptance when the database or Setfarm-owned evidence disagrees.

## Program Decomposition

This is a multi-system program and must be executed as five independently reviewable subprojects. Each subproject receives its own implementation plan after this design is approved.

### Subproject A: Canonical Baseline and Mission Control Handoff

Treat the delivered Mission Control Product Build Authority V2 behavior and operational-snapshot-v3 work as immutable baseline inputs, add only the constructible read-only PBA V2 delivery-evidence projection, reopen the delivered v31 authority, then have one prepared Task 6A operation perform pre-schema spawner sealing, guarded-32 application, A activation, same-generation admission readiness, and the canary before Task 7's read-only schema validation/full rebind.

Required outcomes:

- Produce and pair-resolve the exact read-only `ProductBuildAuthorityV2DeliveryEvidenceV1`; bind PR #19/current source/tree/build, eight ordered path blobs, focused tests, and twelve vendor-lock identities without inventing a global PBA authority receipt.
- Deliver the exact guarded-migration-32 class/API, v31 targeted audit, sole pending-successor inspector, source-integrity/digest binding, and fixed private isolated-test lifecycle; generic apply never consumes guarded work, generic verify remains pending until Task 6A applies 32, and Task 7 has no apply seam.
- Deliver one import-inert owner-admission core with exactly 35 categories, 35 census-map keys, and 36 covered scalar counters; freeze the exact sixteen-row A manifest and `16/26/32/48/57` cumulative phase counts; enumerate every production birth/terminal/direct-SQL path through the literal 107-path File Map and fail-closed AST inventory; add OA17's terminal build-output tree, stable controller-build projection, zero-input clean-source observer, and historical Git replay; add the exact four-relation PostgreSQL activation authority, strict A source-build/PBA/vendor cross-binding, delivered-phase registry, same-transaction predecessor/source/activation/head/current CAS, and transaction-pinned current resolver; keep production repository/controller/fixed resolver composition solely in `src/db-pg.ts`, and expose only pair-input idempotent resolution/close.
- Run Mission Control tests, build, Setfarm contract compatibility, and rendering smoke checks against the current vendored contract set.
- Reopen PR #86 merge `1d691c89760339ea905dfe17f8e9188e62603c1c` as an ancestor; separately verify migrations 1 through 31 applied/current and the one exact Task 6A successor pending, with no other pending/drifted migration.
- Bind current Task 0 controller source/tree/build separately from delivered runtime authority; prepare current-entry before mutation, rebind only the spawner into operation-bound sealed mode, apply 32/activate A, transition that generation to normal admission, then run the fenced canary while dashboard/Mission Control remain delivered.
- Freeze one named-field service census, one strict nested current-entry status wire body, one pair-resolved fresh runtime/owner observation, and one strict current-entry verification receipt; freeze all five canonical hash projections and reject service arrays, flattened lifecycle mirrors, undeclared status fields, structural clones, orphan observation hashes, reordered authority tuples, and OpenClaw source/build claims.
- Record exact Setfarm and Mission Control SHAs, package versions, contract hashes, service PIDs, listening ports, and health responses.
- Take a fresh PostgreSQL backup and prove it can be listed and inspected with matching PostgreSQL tooling.
- Reopen the exact v31/pending pairs before preparation; require token → restart → termination/postzero → sealed admission plus fresh legacy reobservation before guarded apply, then current audit/A activation/full verify/admission-ready before canary.
- Use focused tests to prove all three mutually exclusive failure codes; use one new clean canary to prove only its one exact observed terminal-preclaim lifecycle before any golden run.
- Run the canary only through Task 0's dedicated source-run/run target-reservation fence lifecycle and bind its acquire, target-close, and release authorities into the pre-rebind receipt.
- Require Task 7 to consume the already-applied/current migration receipt and current-entry pair without schema mutation, rebind all scoped services to current controller/build authority, equality-check the loaded PBA delivery-evidence HTTP pair, and publish one crash-idempotent post-rebind pair; Task 8 and B/C/D/E consume only that successor as current entry authority.
- Reconcile Mission Control's `active` project classification with the zero-active-run database census. Historical runnable projects may remain visible, but they must not be labeled as active Setfarm execution unless the canonical operational model says they are active.
- Verify there is exactly one intended daemon for each long-lived Setfarm/MC service and no stale test or agent process.

No golden run starts until this subproject passes.

### Subproject B: Golden-Run Harness and Evidence Packet

Create a repeatable acceptance harness around existing Setfarm commands and authority surfaces. The harness coordinates runs and captures evidence; it must not introduce a second workflow engine or derive success from logs.

For every canary, the harness records:

- immutable case ID and prompt hash;
- Setfarm SHA, Mission Control SHA, package versions, workflow ID/version, and protocol;
- run ID and run number;
- generated repository and GitHub PR identities;
- start and terminal timestamps;
- every step and story terminal state;
- claim, runtime-session, runtime-completion, and effect settlement censuses;
- compiler PLAN, DESIGN, STORIES, setup-build, attempt, candidate, deploy, release-admission, and project-transfer identities when applicable;
- test/build/runtime command evidence;
- HTTP, CLI, filesystem, state, and visual assertions required by the product profile;
- Mission Control API snapshot hash and rendered-state assertions;
- process, port, worktree, and owner leak censuses after settlement;
- failure classification and canonical root-cause identity when the run does not pass.

The harness writes a bounded, reviewable campaign report under `docs/review-packets/` after the run has settled. Runtime artifacts remain in their canonical stores and are referenced by identity; they are not copied into Git.

The harness must support these terminal classifications:

- `accepted`: all required product and platform evidence passed;
- `generated_product_failure`: the product implementation failed while platform ownership and reporting remained correct;
- `setfarm_core_failure`;
- `mission_control_failure`;
- `provider_or_quota_failure`;
- `infrastructure_failure`;
- `campaign_configuration_failure`.

Only `accepted` counts toward the completion matrix. Every non-accepted result retains evidence and is reviewed before another case of the same class starts.

### Subproject C: Ordered Golden Product Matrix

Run one case at a time. Do not launch a wider fleet until the preceding profile has produced the required accepted result. Each case starts from a new run and, unless explicitly testing existing-repository behavior, a new generated repository.

Profiles 1 through 5 use the V3 feature-development path. Profiles 6 and 7 use their dedicated canonical workflows and must report their actual protocol honestly; they may not be relabeled as V3 if those workflows have not acquired V3 authority.

#### Profile 1: Node CLI

Purpose: prove the no-design Product Semantics V2 path, exact invocation ABI, build, execution, output, and exit-status evidence.

Required behavior:

- at least two commands;
- one validated argument and one invalid-input path;
- deterministic stdout/stderr and exit codes;
- one file-backed or otherwise durable state transition if supported by the canonical CLI product contract;
- generated tests and Setfarm-owned execution evidence;
- successful terminal transfer without browser or Stitch authority.

#### Profile 2: Node Express API

Purpose: prove HTTP route, parameter, JSON-body, persistence, error, process, port, and restart behavior.

Required behavior:

- health endpoint;
- create, read, update, and validation-error paths;
- exact JSON response assertions;
- durable data survives one controlled application restart;
- no externally reachable listener beyond the admitted loopback/runtime contract;
- clean process and port release after test settlement.

#### Profile 3: Vite/React Web Application

Purpose: prove PLAN, Stitch/DESIGN, story partition, browser runtime, state, accessibility, visual evidence, story PR, verification, and final-product supervision.

Required behavior:

- at least three screens or meaningful UI states;
- routing and one persistent state transition;
- at least one form with validation;
- keyboard-accessible primary flow;
- Setfarm-owned browser interactions, DOM/state assertions, screenshots, and console-error checks;
- exact story-scoped supervisor evidence for every required story;
- final-product acceptance after the current generation has settled.

#### Profile 4: Stateful Multi-Page Web Application

Purpose: stress cross-story ownership, shared state, direct dependencies, and multi-page product behavior.

Required behavior:

- at least four canonical stories with an explicit dependency edge;
- shared persistent entity used across two pages;
- list, detail, edit, and failure/empty-state behavior;
- story sequencing and retry fences preserve generation identity;
- all merged source is verified from the final main revision.

#### Profile 5: Interactive Browser or Game Product

Purpose: prove deterministic interaction/state evidence for a timing- or canvas-sensitive product without trusting a screenshot alone.

Required behavior:

- explicit start, active, paused or terminal states;
- deterministic input sequence;
- state transition assertions through an admitted bridge or DOM surface;
- screenshot evidence as supplemental proof;
- no fixed-port collision and no background runtime leak.

#### Profile 6: Existing-Repository Bug Fix

Purpose: prove a bounded repair workflow against a controlled seeded defect.

Required behavior:

- reproducible failing test before the run;
- scoped fix through the bug-fix workflow;
- passing regression and adjacent tests;
- no unrelated file mutation;
- GitHub review feedback, when injected by the campaign, is routed through the canonical retry path.

#### Profile 7: Existing-Repository Security Audit

Purpose: prove typed security findings, repair, verification, and honest residual-risk reporting.

Required behavior:

- controlled vulnerable fixture with at least two distinct finding classes;
- findings cite exact source evidence;
- repair remains inside declared scope;
- post-fix security checks pass;
- intentionally unfixable or out-of-scope risk remains visible rather than being marked resolved.

### Subproject D: Recovery and Mission Control Reconciliation

Prove that accepted ownership survives the supported crash and restart boundaries, and prove that Mission Control renders the same canonical state before, during, and after those transitions.

Required outcomes:

- complete the recovery and restart matrix in this design;
- reconcile PostgreSQL, Setfarm operational snapshots, Mission Control API responses, and rendered UI state for the same run IDs;
- correct or precisely relabel the current Mission Control active-project mismatch;
- prove failure owner, retryability, Product Build Authority, and operational evidence render without local re-derivation;
- prove service restarts do not lose or invent run authority;
- retain exact recovery evidence and finish with zero ownership or process leak.

### Subproject E: Fleet and Operational Closure

Run the bounded 10-project fleet only after the ordered golden matrix and recovery work pass, then finish the operator runbook and final acceptance packet.

Required outcomes:

- complete the controlled fleet within the concurrency and stop rules in this design;
- classify every terminal case and repair every systemic platform defect through a reviewed PR;
- rehearse backup, service restart, health verification, and incident-stop procedures;
- run final full tests, clean-main builds, migration verification, authority audits, leak censuses, and independent review;
- deliver the reviewed tracked pre-handoff packet, then record the private non-circular final post-handoff authority for its exact one-commit docs-only descendant;
- leave Setfarm clean synchronized `main` at the authenticated documentation SHA and Mission Control clean synchronized `main` at the accepted operational Mission Control SHA, without relabeling the documentation SHA as the operational epoch.

## Per-Run Acceptance Gates

Every accepted V3 product run must satisfy all applicable gates below.

### Authority and Lifecycle

- `runs.protocol = 'v3'` and the expected protocol version is recorded.
- PLAN, DESIGN when required, and STORIES English admission receipts are exact and durable.
- Every implementation and supervision claim/runtime pair has one exact Migration 29 binding.
- Runtime-completion requests reach `accepted` with `apply_phase = 'effects_committed'`.
- Claims have terminal outcomes consistent with completion evidence.
- Runtime sessions are released or drained.
- No mandatory effect remains pending, retryable, processing, or quarantined.
- No open termination, recovery, preparation, or claim owner remains after terminal settlement.

### Source and GitHub Delivery

- Story and final source revisions are exact and current.
- Required story PRs exist, match their recorded head branches, and have no unresolved actionable review thread.
- Review retries use the canonical claim/runtime and generation path.
- Final main contains the accepted changes.
- Generated repository worktree is clean after terminal settlement unless a retained failure artifact is explicitly part of the evidence.

### Product Behavior

- Build and product-specific tests pass from the accepted source revision.
- Runtime starts through the admitted driver and reaches bounded readiness.
- The required CLI, HTTP, DOM, state, accessibility, and visual assertions pass.
- No severe console error, uncaught exception, wrong-app response, or stale runtime is accepted.
- Deployment or internal project transfer is either completed with exact evidence or explicitly excluded by the profile contract. It may not be silently skipped.

### Cleanup

- no active claim or runtime session remains for the run;
- no owned child process or listener remains;
- no orphaned story or runtime worktree remains;
- no capacity, artifact, or preparation lease remains active;
- Mission Control no longer presents the terminal run as actively executing.

## Failure Triage and Repair Loop

Every failed campaign case follows one bounded loop:

1. Freeze new campaign starts.
2. Capture canonical DB, observation, GitHub, process, port, and service evidence.
3. Classify the owner before editing code.
4. If the product alone is wrong and platform behavior is correct, allow the canonical bounded implementation or supervisor recovery path to act.
5. If Setfarm or Mission Control is systemic, create one small PR branch in the owning repository.
6. Add a regression that fails for the observed root cause.
7. Apply the smallest root fix without weakening an invariant.
8. Run focused and adjacent tests, reviewed PR delivery, and clean-main build.
9. Start a new clean canary rather than reviving a run polluted by pre-fix platform behavior.

The campaign stops and reports when the same canonical systemic cause is observed three times after attempted fixes. Provider quota, an upstream outage, or a deliberately injected infrastructure failure is not a Setfarm product regression unless fallback or classification behavior is itself wrong.

## Recovery and Restart Matrix

After Profiles 1 through 3 each pass once, execute the following controlled scenarios. Fault injection must use existing test or operational seams; do not kill arbitrary processes while an unrelated run is active.

1. Restart the spawner after claim publication and before agent transfer.
2. Restart the spawner after runtime completion owner commit and before effect settlement.
3. Restart Mission Control during an active run and verify the same canonical snapshot after recovery.
4. Restart the Setfarm dashboard without mutating run state.
5. Inject one transient provider or quota failure and verify typed infrastructure classification plus bounded retry/fallback behavior.
6. Inject one actionable GitHub review comment and verify exact retry, resolution evidence, and re-verification.
7. Inject one runtime crash and verify process, port, and ownership cleanup.
8. Exercise one supervisor block followed by a generation-safe implementation retry carrying the exact authenticated feedback.
9. Exercise a post-owner completion recovery and prove effect mutation happens exactly once.
10. Restart an accepted API product and prove its declared durable state remains available.

Scenarios 1–4 and 7–10 must end with `accepted_continuation`, their positive scenario-specific proof, and zero leaked ownership. Only scenario 5 (`provider_quota_failure`) and scenario 6 (`github_review_retry`) may instead end in one of their exact finite registry-backed `typed_terminal` outcomes. A restart refusal, runtime failure, source-product failure, missing positive proof, or typed-terminal claim for any other scenario is a nonselectable attempt failure and cannot satisfy the matrix.

## Mission Control Acceptance

Mission Control is accepted only when its API and UI are verified against the same live run fixtures used for Setfarm acceptance.

### API Requirements

- `/api/health` remains healthy when optional OpenClaw-dependent features degrade.
- `/api/projects` exposes failed, cancelled, completed, and truly active projects without hiding terminal records.
- Project `active` status is derived from canonical run/runtime evidence, not the mere existence of a runnable repository or stale process metadata.
- Run-detail endpoints expose canonical protocol, step, story, claim/runtime ownership, Product Build Authority, operational evidence, retryability, failure owner, and terminal state.
- Contract hashes and compatibility failures are explicit.
- Mutation endpoints use Setfarm-owned action authority and do not directly rewrite canonical run state.

### UI Requirements

- Overview counts agree with the API and database census.
- Active-run and run-detail pages update during the golden runs without requiring a browser reload.
- Terminal failed and cancelled runs remain discoverable.
- Step and story progress match Setfarm's operational snapshot.
- Product Build Authority and operational evidence distinguish `pass`, `blocked`, `unavailable`, and `disabled` without promoting agent prose.
- Retry and failure-owner labels match the canonical classifier.
- Restarting Mission Control preserves the same visible state after reconnection.
- Browser console remains free of uncaught application errors during the acceptance flows.
- Essential pages remain usable at the supported desktop viewport and keyboard navigation covers primary operator controls.

Mission Control acceptance includes automated API and render tests plus a Setfarm-owned or campaign-owned browser smoke against the live server.

## Controlled Fleet

Only after Profiles 1 through 3 pass twice and Profiles 4 through 7 pass once may the campaign start a broader fleet.

Fleet rules:

- exactly 10 new project prompts;
- prompts span CLI, API, web, stateful web, interactive browser, bug-fix, and security-audit behavior;
- the fleet campaign's B-owned configured `maximumConcurrency` is exactly `2`, while standard/matrix campaigns remain `1`;
- every scheduling decision consumes B's exact `GoldenCampaignExecutionCapacityV1`: `eligibleMaximum` starts at `1`, may become `2` only after B's first-five current-epoch effective-result/cleanup/systemic gate, and can never become `3`;
- two distinct same-campaign/same-epoch cases may be coordinated/staged concurrently only when that B authority reports `2`; a third is refused before staging, and historical-epoch results never unlock capacity;
- no more than two live V3 runs at any time;
- every prompt, source identity, result, and classification is recorded;
- a failed generated product may use its bounded canonical recovery path, but operators do not patch the generated repository manually;
- a systemic failure freezes new starts until its reviewed fix is on clean main;
- the same systemic cause observed three times stops the fleet and the program reports blocked; for accepted-product runtime recovery, that cause is a code-normalized finite semantic tuple stable across attempts and epochs, while attempt-specific receipt/action/cleanup hashes remain evidence but never fragment the root identity.

Fleet acceptance requires:

- 10 terminal campaign records;
- zero unresolved `setfarm_core_failure`;
- zero unresolved `mission_control_failure`;
- zero leaked run ownership, process, port, or worktree;
- at least 8 accepted products;
- any remaining two results are only `generated_product_failure`, `provider_or_quota_failure`, or `infrastructure_failure`, with platform classification and cleanup proven correct.

This threshold measures factory reliability without pretending that every model-generated product must be correct on its first bounded campaign.

## Operational Runbook and Host Acceptance

The internal-production runbook must be executable by an operator who did not implement the program. It includes:

- canonical repository locations and branch discipline;
- environment and secret locations without secret values;
- PostgreSQL backup, inspection, and restore rehearsal procedure;
- clean build commands for Setfarm and Mission Control;
- contract-spine plan, verify, and authority audit commands;
- LaunchAgent status, restart, and log commands;
- HTTP health and project/run smoke commands;
- active run, claim, runtime-session, completion, and effect censuses;
- safe rules for restarting services with or without active work;
- process, port, and worktree leak diagnostics;
- GitHub authentication and review-settlement checks;
- provider/quota classification procedure;
- incident stop conditions and evidence capture;
- how to start one clean canary and how to stop the campaign.

The runbook is accepted only after one cold operator rehearsal on the Mac mini: services are stopped or restarted in the documented safe order, rebuilt artifacts are loaded, endpoints recover, the database remains current, and no run authority is lost. Every code-owned restart dispatch is fenced by an operation-specific helper that durably claims before spawning the one fixed launchctl child, owns its bounded output/exit/termination/reaping, and prevents recovery from re-kicking. Uncertain or dead-generation settlement cannot authorize a reviewed new attempt until exact helper, launchctl child, and service-process absence or termination authority resolves; a dead claimed marker may prove its PID/process absence without fabricating a live PID receipt.

## Repository and Delivery Discipline

- Setfarm and Mission Control each use at most one active writing branch.
- Cross-repository work is serialized at integration boundaries. A Mission Control consumer change may be prepared only after its Setfarm contract is committed and available for compatibility checking.
- Every systemic fix uses a focused branch, tests, independent review, reviewed PR, and clean-main build.
- No implementation agent bypasses runtime guards, dirty-build guards, migration verification, or evidence gates.
- No secret, live DB dump, generated runtime artifact, screenshot cache, or local log is committed.
- Historical failed runs remain visible; they are not deleted to improve metrics.
- Campaign reports reference durable evidence identities and bounded summaries rather than copying sensitive runtime payloads.

## Verification Layers

Each subproject uses the cheapest valid progression and stops at the first failure:

1. focused unit or integration test;
2. adjacent package or subsystem tests;
3. repository build and static contracts;
4. repository full test suite when shared runtime behavior changes;
5. reviewed PR;
6. clean-main build;
7. live service smoke;
8. one ordered canary;
9. recovery or fleet expansion only after the prior layer passes.

Setfarm verification includes, as applicable:

- TypeScript compilation;
- English, path, migration-digest, and Mission Control contract checks;
- focused execution-attempt, product-compiler, step, script, evidence, recovery, and eval suites;
- full `npm test`;
- clean-main guarded `npm run build`;
- migration plan, verify, and current-authority audits.

Mission Control verification includes:

- focused service, route, API, and render tests;
- Setfarm contract compatibility check;
- full `npm test`;
- clean `npm run build`;
- render smoke;
- live `/api/health`, `/api/projects`, run-detail, and browser checks.

## Completion Evidence

Final internal-production completion evidence is the tracked pre-handoff packet plus the later private post-handoff authority. Across that composite it contains:

- the exact accepted operational Setfarm/Mission Control epoch SHAs and the distinct one-parent documentation-only Setfarm descendant SHA;
- docs PR URL, base/head/squash merge/sole-parent SHAs, immutable independent-review history ref/hash with zero unresolved Critical/High/Medium findings, and the complete successful check-name/conclusion set hash;
- the tracked packet's exact closure-generation input tuple/hash/suffix, six ordered paths, immutable pre-render owner identities, and pre-packet review ref/hash, without an E-output or completed six-content tuple;
- the later private finalization/docs-session/post-handoff chain's exact six-file delta/content hashes and receipt refs/hashes, which become authoritative only after both E outputs exist and preserve every prior generation;
- build identities and contract hashes;
- backup and restore-rehearsal evidence;
- migration plan, verification, and authority-audit summaries;
- golden profile campaign table with run IDs, repositories, PRs, states, and evidence refs;
- recovery matrix table;
- controlled fleet table and systemic-failure census;
- Mission Control DB/API/UI reconciliation results;
- service restart and health results;
- process, port, worktree, claim, runtime, completion, and effect leak censuses;
- independent final review findings and their resolution;
- exact remaining external-distribution blockers from the production-admission preflight.

## Internal Definition of Done

Setfarm and Mission Control are internally complete when all conditions below hold simultaneously:

1. Subprojects A through E are delivered through reviewed PRs.
2. Node CLI, Node API, and Vite/React profiles each produce two accepted runs from clean starts on the final Setfarm build.
3. Stateful web, interactive browser/game, bug-fix, and security-audit profiles each produce at least one accepted run.
4. The complete recovery and restart matrix passes.
5. The controlled 10-project fleet meets its acceptance threshold.
6. Mission Control DB/API/UI reconciliation has zero unresolved mismatch.
7. No active or leaked claim, runtime, completion effect, process, port, lease, or worktree remains after the campaign.
8. Setfarm and Mission Control full tests and clean-main builds pass at the accepted operational SHA pair, and the later Setfarm docs-only SHA has an exact semantic-build-equality proof rather than being treated as a new operational build.
9. Contract-spine migrations remain current and all current-authority audits pass.
10. The operator runbook passes one cold rehearsal.
11. Setfarm is clean and synchronized with `origin/main` and its current `HEAD` equals the authenticated docs-only descendant; Mission Control is clean and synchronized with `origin/main` and its current `HEAD` equals the accepted operational Mission Control SHA. The private current/final post-handoff resolver proves these exact current identities; historical ancestry resolution is not acceptance.
12. Independent pre-packet and docs-PR review histories report no unresolved Critical, High, or Medium finding, all required checks conclude successfully, and the final private post-handoff receipt resolves byte-identically without any in-place edit to its six immutable materialized files.
13. The strict external-distribution receipt fresh-resolves the exact five-member observation census and its exact five-member non-satisfied blocker projection through the cold, review, final JSON/Markdown, and post-handoff chain; every projection remains `productionAuthority:false` and `productionAdmission:"blocked"`.

External distribution remains explicitly incomplete and must be reported as such. It becomes a separate design and implementation program after internal completion.

## Out of Scope

- Developer ID acquisition or keychain provisioning;
- Apple notarization submission;
- signed or stapled PKG production;
- installer/helper installation or mutation;
- public customer onboarding, licensing, billing, or support;
- Linux or Windows host support;
- arbitrary high-concurrency load testing;
- rescue or manual patching of historical generated projects;
- deleting failed history to improve completion metrics;
- weakening any authority, runtime, migration, evidence, review, or dirty-build gate.

## Risks and Controls

### Model and provider variability

Use exact prompts, record provider/model/quota observations, classify infrastructure separately, and require repeated profile acceptance instead of one lucky run.

### Long campaign duration and cost

Run profiles sequentially, stop at the first systemic failure, reuse focused deterministic fixtures for regression, and expand to the fleet only after the first three profiles are stable.

### Historical-state confusion

Never reuse old failed runs as current acceptance. Keep them visible but clearly separate the new campaign by campaign ID, Setfarm SHA, and start timestamp.

### Mission Control inventing activity

Reconcile every displayed active state to the canonical operational snapshot and database census. Treat the current 112-active versus zero-active-run observation as an explicit acceptance blocker until its semantics are corrected or precisely relabeled.

### Cross-repository drift

Pin contract artifacts and exact SHAs in every campaign record. Deliver Setfarm producer changes before Mission Control consumer changes.

### Operational mutation during evidence collection

Take read-only snapshots by default. Any restart or fault injection is an explicit campaign step with preconditions, zero unrelated active work, and post-settlement leak checks.

## Follow-On Program

After internal completion, create a separate external-distribution design covering Developer ID identities, public trust configuration, notarization credentials, signed native catalog, PKG composition, installer receipt and helper authority, AMFI join, upgrade/rollback/uninstall, clean-host acceptance, and public release operations. The current production-admission preflight provides the entry census for that future program.
