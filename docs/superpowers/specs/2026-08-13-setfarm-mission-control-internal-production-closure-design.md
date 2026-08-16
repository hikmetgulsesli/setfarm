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

Pre-full-rebind authority deliberately separates the new Task 0 `controllerSourceSha/tree/build` from `loadedRuntimeServiceAuthority`. The latter records the delivered pre-Task0 service source/build/process/listener identities still running. Each authority is independently current for its own scope; equality is neither required nor inferred. After Task 6A records its immutable current-entry operation but before schema or manifest mutation, it performs one disjoint `SETFARM-SPAWNER-ONLY` rebind to the clean Task 0 build. An immutable pre-dispatch token alone boots the replacement into `pre-manifest-bootstrap-sealed`; the old spawner must be authentically terminal, and a separate sealed admission binds the new generation plus a post-termination legacy observation proving all 36 owner counters zero. The sealed process exposes no normal DB-ready state, listener, producer loop, or owner byte. Task 6A then applies migration 32 through a sealed-status-bound pre-manifest authorization, activates A, and transitions that same spawner generation once to normal Task 0 admission after ordinary full verification and normal DB initialization—without another restart. Dashboard and Mission Control remain delivered. Only then may the fresh canary run. Task 7 later rebuilds/rebinds all three scoped background services.

Focused Authority-V3 runtime/migration/rollback/terminal-preclaim tests prove the three mutually exclusive setup-packet failure codes. One fresh clean canary separately proves only the exact one-code lifecycle it actually observes: exactly one terminal claim, exactly one termination request, and zero redispatch after terminalization. Polluted pre-fix run 2075 is historical evidence only and is never resumed as the canary. The canary controller internally acquires Task 0's dedicated source-run launch owner-admission fence and exact typed source-run/run target reservations, reobserves zero unrelated owners, starts or adopts the one run, closes both targets only against its terminal settlement, and releases that fence; the current-entry authority binds the fence, both targets, compound close, and release pairs. No caller or shell supplies a guard, root, run, reservation, or identity.

The current-entry pair is deliberately the pre-full-rebind predecessor. Zero-input `prepare-current-entry` records one immutable operation after read-only PBA/v31/pending/source prerequisites and before any live mutation. Zero-input `resume-current-entry` is the sole production coordinator for the token/restart/termination/postzero/sealed chain, pre-manifest migration authorization/application/current audit, A activation, same-generation admission-ready transition, and canary settlement. The applied migration receipt carries the exact v31 audit pair and pre-apply pending-successor pair as its four causal fields plus the acyclic pre-schema authorization chain. Generic full migration verification remains invalid while 32 is pending; the operation-bound sealed startup uses only targeted v31/pending inspection and never reports normal DB ready. Task 7 consumes the already-applied/current receipt and current-entry pair, performs no schema mutation, rebuilds/rebinds all scoped services, and seals the post-rebind successor. Task 8 and every B/C/D/E authority consume only that successor.

Immediately before prepare, Step 1 records one exact four-service census. Prepare creates a strict code-owned `InternalProductionPreMutationLoadedRuntimeServiceAuthorityV1` after the operation exists, binds that operation plus the census hash and ordered spawner/dashboard/Mission-Control/OpenClaw process, generation, source/build, and listener identities, and publishes its canonical-hash-derived pair through a no-replace store. Step 1 equality-checks the adjacent census against the resolved body. The status ABI carries direct ref/hash scalars plus the pair-resolved body, never a structural pair wrapper. `operation_prepared`, every later nonblocked status, and final current-entry authority preserve the byte-identical pair and body; Step 2 pair-resolves it before resume and after ready. A caller body, clone, PID/path/identity override, store scan, or observed drift blocks.

Current-entry keeps exactly twelve top states while four strict nested phase unions make every required durable crash boundary visible. `migration_applying` is `prepared | consumed | receipt_published | current_audited`, with consumption, receipt, and current-audit pairs becoming non-null in that order. `spawner_admission_transitioning` is `sealed | admission_ready | runtime_observed`, with admission-ready then mixed runtime authority appearing in order. `canary_running` is `running | terminal_settlement_published`, and close remains null in both. `settled` is `target_closed | fence_released`, and final entry remains null in both. Each phase repeats the fixed predecessor pairs and has exact null/non-null members; only the terminal nested member may advance to the next top state. `blocked` preserves the exact last-valid status pair and one finite reason code. Missing, extra, crossed, skipped, cloned, or impossible members fail closed.

The successor is registry ordinal 32 and the sole guarded migration class member; one ordered migration creates both bootstrap-main-claim handoff schema and the PostgreSQL owner-reservation sidecar/singleton owner-admission-head schema. Generic plan exposes pending, generic apply skips, and generic verify fails until the prepared Task 6A controller consumes `InternalProductionPreManifestMigration32AuthorizationV1`. That one-use authorization requires the post-termination sealed admission, its all-36-zero legacy observation, and a later fresh equal reobservation; a pre-dispatch snapshot or normal manifest-backed complete-zero guard is invalid. If an owner/child appears at any observation/dispatch/termination/seal boundary, the replacement remains sealed and migration is unavailable. Default spawner startup still fails pending 32; only the fixed operation-bound token enables the minimal sealed startup path, with no environment/caller mode or generic bypass. The isolated test lifecycle remains automatic apply → fixed test-only guarded capability → full verify. The import-inert owner core exports only types/ports/primitives. Its repository includes same-transaction `resolveReservation` and `resolveClose`; `src/db-pg.ts` alone composes the production repository/controller and fixed non-exported category-to-authenticated-terminal-resolver table. Callers cannot supply a registry, repository, factory, or structural terminal authority. Public close remains pair-only, and top-level pair resolvers use the code-owned composition. This is database atomicity only.

The pre-schema authorization directly binds the already durable current-entry operation ref/hash. Its zero-input prepare succeeds only by resolving that fixed head in `operation_prepared`; pair-only execute/recover reopens both records and requires equality before dispatch. The pre-dispatch token binds the operation/authorization, authenticated predecessor process/service/generation, and target source/tree/build but contains no predicted replacement generation. Actual generation first appears in a strict replacement-process observation after the strict restart authority and code-owned predecessor-termination observation. The complete acyclic chain—startup token, restart authority, termination observation, replacement observation, sealed admission, and admission-ready—has a strict full record, exact pair, no-replace store, and pair-only resolver at every edge; termination is never a hash-only assertion, structural bodies and latest scans are invalid. Rebind status is an exact discriminated `absent → prepared → startup_token_published → dispatching → pre_manifest_bootstrap_sealed → normal_task0_admission_ready` chain, with a last-valid-pair `blocked` branch. Migration authorization likewise has exact `absent → prepared → consumed → terminal` branches, an immutable consumption pair, and a last-valid-pair `blocked` branch. Current-entry's twelve phases preserve those same pairs and reject every impossible nullability/cross-operation combination.

The ordinary `run` producer lives at the first durable run byte in `src/execution/run-persistence.ts`, not later in `src/spawner.ts`. Inside one passed PostgreSQL transaction callback, `runWorkflow → persistWorkflowRun` resolves admission, begins/adopts the typed run reservation, inserts/adopts the run row, binds the sidecar, and constructs the authenticated row/pair result. That tentative callback value remains private: the public promise does not resolve and its result is neither returned through nor observable by installer or spawner until commit succeeds. Rollback, callback failure, commit rejection, or connection loss before commit acknowledgement exposes neither row nor pair; response loss after an acknowledged commit is recovered as the byte-identical row/pair. Before the final pre-manifest reobservation, the current-entry controller takes a fixed non-advisory PostgreSQL run-admission fence on the existing migration-journal head. Every run insertion takes the conflicting lock. Migration 32 atomically converts that protection into the owner-admission-head fence, so an unrelated CLI insert cannot race observation-to-apply. Only the same operation's typed canary target may proceed after migration/current audit, A activation, full verification, and admission-ready. The exact Task 0 literal File Map therefore contains 68 paths, including `src/installer/run.ts`, `src/execution/run-persistence.ts`, and every direct affected run-protocol, release-admission, and convergence test.

Task 0 remains source-only. It may produce reviewed source/tests and deterministic checked-in contract/digest artifacts, and its focused tests may use the isolated private migration-32 lifecycle above. Task 6A is the first live use; Task 0 must not apply 32, create live authorities, run a canary, or restart a service. The local PBA wire parser remains strict and inventory remains 10 → 12 → 14. `producerCommit`, `deliveryMergeSha`, `currentSource.sha`, `currentSource.treeHash`, and `currentSource.originMainSha` accept only 40- or 64-character lowercase Git object hashes; every content/blob/build/receipt/lock/evidence hash is exactly 64 lowercase hexadecimal characters, with 39/40/41/63/64/65, uppercase, and non-hex boundary fixtures. The one pre-schema spawner action is disjoint and current-entry-controller-only. Normal post-activation restarts retain the closed service preparation/pair-only consume API; both paths use only literal launchd labels and code-owned UID/argv. A's seven-entry forward D registry remains import-free.

Every operational command uses a receipt-authenticated root contract rather than a host checkout literal. The owning resolver exports `SETFARM_ROOT` and `SETFARM_ROOT_EXPECTED_SHA` as one read-only binding, and the same shell performs this validation before any package command, observation with acceptance effect, or mutation:

```bash
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
- Deliver one import-inert owner-admission core with exactly 35 categories, 35 census-map keys, and 36 covered scalar counters; add same-transaction reservation/close resolution, keep production repository/controller/fixed terminal-resolver composition solely in `src/db-pg.ts`, and expose only pair-input idempotent close/resolution.
- Run Mission Control tests, build, Setfarm contract compatibility, and rendering smoke checks against the current vendored contract set.
- Reopen PR #86 merge `1d691c89760339ea905dfe17f8e9188e62603c1c` as an ancestor; separately verify migrations 1 through 31 applied/current and the one exact Task 6A successor pending, with no other pending/drifted migration.
- Bind current Task 0 controller source/tree/build separately from delivered runtime authority; prepare current-entry before mutation, rebind only the spawner into operation-bound sealed mode, apply 32/activate A, transition that generation to normal admission, then run the fenced canary while dashboard/Mission Control remain delivered.
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
