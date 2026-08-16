# Internal Production Golden-Run Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fail-closed Setfarm acceptance harness that starts either admitted V3 feature-development canaries or canonical existing-repository workflows through the compiled CLI, remains serial for standard/matrix campaigns, permits the exact gated two-run fleet window only under authenticated capacity, collects authoritative platform and product evidence, assigns one of the seven approved terminal classifications, privately finalizes a bounded review packet only after the complete campaign has settled, and later materializes those immutable bytes through a Setfarm-owned docs claim.

**Architecture:** A strict, separately versioned campaign and result contract defines an explicit start-strategy union, immutable template/case identities, fresh intent-bound fixture-attempt receipts, product-assertion boundary, cleanup census, and classification output without widening the existing convergence-suite schemas. The orchestrator composes the V3 feature-development canary admission path and the canonical existing-repository workflow path with the compiled CLI, a read-only PostgreSQL collector, a profile-owned assertion port, versioned Setfarm/Mission Control comparison, bounded Mission Control render observation, and exact host cleanup observation. Full receipts and previews remain in the shared symlink-safe private data root. Zero-owner finalization seals content-addressed canonical Markdown bytes and all authorities privately; a later narrow Setfarm-owned docs claim materializes only those verified bytes to the fixed tracked path.

**Tech Stack:** TypeScript ESM, Node.js 22 or newer, Zod 4, PostgreSQL via `postgres`, Playwright 1.60, `node:test`, `tsx`, canonical JSON/SHA-256 helpers, existing Setfarm V3 release admission and runtime-artifact APIs

**Spec:** `docs/superpowers/specs/2026-08-13-setfarm-mission-control-internal-production-closure-design.md`

## Global Constraints

- This plan implements Subproject B only. Subproject C supplies the ordered matrix, immutable existing-repository templates, one fresh attempt repository/remote per persisted intent, and concrete `GoldenProductAssertionPort` adapters against the interfaces defined here.
- Delivery has two serialized Setfarm-owned claims. Prerequisite Task P0 alone creates, reviews, and merges the completion-owner receipt authority using the already-existing Setfarm claim/PR/GitHub proof path; that bootstrap PR cannot consume or cite its own new receipt API. Only after canonical `main` is synchronized to the proven bootstrap merge SHA does Task 0 acquire the separate main B implementation claim for Tasks 1–7. The main claim treats the merged bootstrap module as immutable prior authority, and Task 8 consumes it to deliver the main B payload. Main-claim base, PR-head, merge, source/build, preflight, and finalization tests require the recorded bootstrap merge to remain an ancestor of every later Setfarm source SHA; a missing, replaced, or nonancestor bootstrap identity blocks before acceptance.
- P0 consumes A's bootstrap-handoff migration as immutable historical authority, not as a demand that the current Setfarm commit still equal A's application commit. `InternalProductionBaselineBootstrapHandoffMigrationReceiptV1.migrationSourceSha` remains the exact clean A SHA at which that migration was initially applied. Every P0 claim/build/restart boundary requires that SHA to be an ancestor of the current clean Setfarm SHA and requires A's dedicated `src/db/bootstrap-main-claim-handoff-v1-migration.ts` blob, ordered statements, named digest entry, digest, and freshly verified schema projection to remain byte-identical to A's receipt while unrelated append-only registry/digest entries may differ; divergence, reverse ancestry, or a merely recomputed lookalike blocks.
- Do not modify `src/evals/suite-schema.ts`, `src/evals/suite-schema-v2.ts`, `src/evals/result-schema.ts`, or `src/evals/result-schema-v2.ts` to represent golden products; those schemas retain their current eight-case convergence meaning.
- The harness coordinates existing Setfarm commands and authority surfaces. It must not introduce another workflow engine, mutate lifecycle rows, infer success from logs, or call `runWorkflow()` directly.
- A `v3-feature-dev-canary` starts only through `node dist/cli/cli.js workflow run feature-dev "$GOLDEN_TASK" --protocol v3` and a one-use `SETFARM_INTERNAL_CONVERGENCE_ADMISSION` context produced by `createV3ReleaseAdmissionRepository(sql, resultStore).createCanary(input)`.
- A `canonical-existing-repository-workflow` starts only through `node dist/cli/cli.js workflow run "$VERIFIED_WORKFLOW_ID" "$GOLDEN_TASK --repo $VERIFIED_ATTEMPT_PATH --branch main"`, where `VERIFIED_WORKFLOW_ID` has already parsed as exactly `bug-fix` or `security-audit` and `VERIFIED_ATTEMPT_PATH` belongs to the one authenticated fresh attempt provisioned only after the durable launch intent; it has no canary admission environment and no `--protocol` override. Its actual stored protocol and protocol version are read from PostgreSQL and reported unchanged; the harness never labels that run V3 unless PostgreSQL says it is V3. The immutable catalog template is never passed to a workflow.
- Exactly one selected case may start per CLI invocation. There is no campaign-wide execute mode and no concurrency flag.
- Preflight is fully read-only and allocation-free. It must first consume Subproject A's exact `resolveHistoricalBaselinePostHandoffReceiptV1()` result, including the parser-owned tracked marker, fixed canonical ref, receipt hash, and Setfarm/Mission Control ancestry proof; it never substitutes A's current-service verifier or a B-local baseline observer. Every fixed-root store, admission store, fixture resolver, verifier-runtime registry, browser, and phase journal is constructed lazily: `preflight` may inspect an already existing root but must not create a root, file, admission, lease, browser, process, socket, or DB row. Collection uses reads plus the existing bounded Mission Control project-sync POST; it never writes Setfarm lifecycle rows. `resolveInternalProductionDataRootV1()` derives the sole production-private root as ``${runtimeConfig.setfarmDir}/internal-production``; it accepts no CLI/environment/caller override beyond the repository's already trusted runtime configuration. Fixtures live below `fixtures/` and settled results, launch/phase journals, verifier leases, assertion artifacts, and previews live below `golden-results/`, so Setfarm-owned story/docs claims share durable state across isolated worktrees. `execute` and `collect` never touch `docs/review-packets/`.
- Every production-private root traversal is real-path contained below the resolved Setfarm directory, rejects a symlink/hardlink/non-directory ancestor, uses directories `0700`, files `0600`, and `O_NOFOLLOW` reads. Read-only resolution of an absent root creates nothing. Only explicitly mutating operations lazily create validated descendants. Production factories accept no root parameter; tests may use an unexported test-only data-root port.
- `finalize-report` is the zero-owner authority phase. After the campaign settlement policy passes or the exact three-repeat systemic blocked condition, every run subject has a terminal effective result (including one exact immutable supersession for any timeout), and global ownership is zero, it validates Setfarm/Mission Control builds against unchanged clean SHAs, seals one supporting content-addressed source/build-root authority, renders canonical Markdown, and writes one content-addressed `GoldenFinalizedCampaignReportV1` plus exact Markdown bytes below the shared private root. It never writes tracked docs.
- `materialize-finalized-report --finalization-hash HASH` is the standalone later Setfarm-docs-claim action and sole one-report CLI writer. It accepts no campaign/path/bytes/source override, reopens the private receipt/Markdown with `O_NOFOLLOW`, recomputes every receipt/report hash, requires the clean docs-claim base SHA to equal the recorded Setfarm SHA, requires the current clean Mission Control SHA to equal its recorded SHA, read-only rehashes the recorded build artifacts, and writes those exact bytes to ``docs/review-packets/${campaignDate}-${campaignId}-golden-run-report.md``. It reruns neither builds nor global-zero-owner settlement while the docs claim owns a worktree. In the full A-E program, Subproject E instead calls the authenticated in-process six-entry materialization-session API once; there is no second composable CLI or caller-selected path. Setfarm owns the resulting commit/push/PR.
- Every execute requires an explicit Setfarm release SHA. Setfarm and Mission Control must both be clean, their exact SHAs and package versions must be recorded, the compiled CLI must bind the requested Setfarm SHA, contract-spine migrations and artifact index must be current, and both HTTP services must be healthy. Standard and matrix stage require total active ownership zero. The exact fleet-threshold campaign may stage with authenticated same-campaign/same-epoch ownership only when unrelated, prior-epoch, and unattributed ownership are all zero and `activeSameCampaignCount < eligibleMaximum`; no other path weakens zero ownership. Settlement, source build, finalization, final cleanup, and final acceptance always require total active ownership zero for every campaign, including a double-fenced docs lifecycle census with `registryMutationPending === false`, `activeLeaseCount === 0`, `pendingRetirementCount === 0`, `reservedTerminalSlotCount === 0`, and authenticated `observedZero:true`. A live-session `completed|abandoned` event remains pending owner disposal until its mandatory `retired(no-active-lease)` successor; terminal retirement receipts remain immutable non-active history.
- The Task 2 golden-launch-operation contract-spine migration is source-only until the main B owner merge has landed and synchronized canonical `main` has built cleanly. Before any B preflight, repository construction against the production database, internal starter claim, Subproject C runtime, or real golden run, Task 8 must durably prepare and recover the one guarded migration-release operation, one-use consume A's exact complete-zero-owner guard, apply through the compiled contract-spine migrator, freshly verify the schema, and reopen the terminal receipt. A naked `psql`, SQL string, migration-ID override, database override, or unreceipted generic migration command is forbidden.
- Do not use `SETFARM_ALLOW_DIRTY_BUILD=1`, `SETFARM_SKIP_RUNTIME_GUARD=1`, `--force-quota`, direct DB lifecycle writes, arbitrary service restarts, or manual generated-project repair.
- PostgreSQL rows, exact GitHub state, canonical Setfarm operational snapshots, compiler artifacts, authority receipts, and Setfarm-owned runtime evidence outrank Mission Control projections, rendered UI, and agent prose.
- Parse current `setfarm.run-operational-snapshot.v3` receipts and the historical V2 compatibility shape explicitly. Never downgrade or discard V3 `operationalFailure` authority.
- A screenshot is supplemental evidence. Browser acceptance requires admitted DOM/state assertions and a clean console in addition to a screenshot hash.
- Deployment or project transfer must be proved by exact receipt identity or explicitly excluded by the case contract. For the Node CLI contract, successful `add --title` and `list` invocations emit canonical JSON Lines on stdout with empty stderr and exit `0`; missing or blank `--title` emits exactly `TITLE_REQUIRED\n` on stderr, empty stdout, and exit `2`. Only the compiler-owned `setfarm-v3-not-deployable` result with its typed reason satisfies that profile's delivery exclusion.
- Reports contain prompt hashes, evidence hashes, canonical refs, PR URLs, bounded status/count summaries, and typed failure identities only. They must not contain raw prompts, selector tokens, secrets, environment values, absolute host paths, raw agent output, runtime artifact bodies, screenshots, logs, or DB dumps.
- The local result store uses directories with mode `0700`, files with mode `0600`, exclusive creation, `O_NOFOLLOW` reads, a `4 MiB` canonical receipt cap, at most `64` results per campaign, and no caller-selected output root.
- Both the private preview and final Markdown report are at most `256 KiB`, contain at most `64` result rows, and are derived only from validated local receipts. Runtime artifacts stay in their canonical stores and are referenced by identity.
- Any non-accepted run ends the current invocation after evidence capture. A new case begins only in a separate invocation after review.
- The same trusted systemic root-cause identity selected by three distinct effective mapping subjects for one campaign blocks further execution. Each pre-run mapping contributes its one stable attempt subject, each run mapping contributes its one selected effective run subject, and a timeout original plus its terminal replacement remains two raw report rows but contributes only the replacement once for that subject.
- External distribution remains incomplete. This harness must continue to report `productionAuthority:false` and `productionAdmission:"blocked"`; it must not change the production-admission preflight or its blockers.
- `GoldenProductAssertionPort` is mandatory in `GoldenHarnessPorts`; collection calls it after canonical/project evidence collection and before classification. Subproject B supplies only the interface and a fail-closed unavailable adapter for CLI wiring; Subproject C supplies the concrete CLI, HTTP, browser, state, filesystem, accessibility, visual, and console adapters.
- Product adapters receive one internal-only `GoldenAssertionSubjectV1` capability assembled by the B collector, fixture resolver, and project observer from verified repository, accepted-source, invocation, and runtime authorities. Absolute paths exist only inside that in-memory capability; they are excluded from `GoldenRunResultV1`, assertion sets, stores, CLI output, previews, and final reports.
- B owns the complete verifier-runtime lifecycle. For an HTTP/browser case, collection obtains one authenticated lease from the sealed stack runtime contract, waits for readiness, evaluates product assertions while that exact loopback runtime is live, then stops and releases that exact process/port lease in `finally`. Only after release does it re-collect canonical evidence and exact cleanup, then classify. C adapters may consume the authenticated subject origin but may not allocate a port, start/stop a process, or release a lease.
- Every started run has one symlink-safe, hash-chained private phase journal. `collect` resumes only the exact persisted phase for the same campaign/case/release/run identities; a missing predecessor, invalid hash, phase regression, ambiguous live lease, or receipt drift fails closed. An interrupted live verifier lease is reconciled through its exact persisted process/listener identity before any assertion retry; assertions are never replayed after an authenticated assertion-set phase already exists.
- Before either compiled-CLI starter is invoked, `execute` durably writes one unique path-free logical launch intent. Only its WeakMap-authenticated persisted capability may provision the fresh existing-repository attempt. After provisioning and strict path resolution make the exact CLI task knowable, B captures the pre-start row set and atomically fsyncs `GoldenLaunchExecutionBindingV1` with the full task/set hashes, then persists authorization and the exact V3 admission or attempt authority. Immediately before launch, B derives the operation hash and fsyncs an immutable `GoldenStarterInvocationIssuedV1 { issued:true }` plus its private authenticated launch-operation outbox containing the exact start request and a random claim secret. The compiled CLI receives that outbox only over a private inherited descriptor; its PostgreSQL transaction claims the exact operation hash and creates or reopens the one run atomically. Recovery before issue continues the missing transition; recovery after issue may idempotently resume only that same outbox operation, while read-only collect may only adopt its exact row. Promotion to `run-bound` equality-binds the logical intent, execution, issued operation, and authoritative row; zero/multiple or mismatched operation rows fail without inference.
- For a V3 start, launch preparation is crash-safe before admission creation: one atomic private envelope contains the immutable intent, preparation identity, and selector secret record before `createCanary`. The selector capability is WeakMap-authenticated, the raw token never leaves the admission adapter, and recovery reopens the same preparation and idempotently reuses its intent-bound admission. No recovery path generates a second selector or creates an orphan second admission.
- After intent persistence and before either admission use or starter invocation, B calls one authenticated `GoldenPreStartAuthorizationPort` with the exact intent/hash and selected case/result context. The code-owned default returns only `not_required` when no repair authorization is needed and otherwise denies; C may supply the exact repair-CAS implementation. No authorization input, receipt, phase, error, or report contains the raw intent nonce or selector token.
- A verifier launch becomes durable immediately after the spawned group-leader identity is observed and before readiness or listener discovery. The private provisional record owns the exact process identity and allocated port; interruption recovery must authenticate and either finish promotion to one lease or stop and release that exact provisional process/port before another launch. No readiness wait can precede the provisional write.
- A nonterminal run that reaches its case deadline follows a separate timeout-observed branch. It receives only bounded canonical DB/snapshot, project, and cleanup observations; it never receives a product assertion, browser/render session, verifier runtime, GitHub mutation, or a synthetic terminal/zero-leak claim. Its typed infrastructure/platform timeout result cannot finalize a campaign while the underlying run or any owner remains active.
- A timeout result is immutable. A later explicit reconciliation may append one content-addressed supersession receipt only after the exact same run becomes terminal, receives the normal full terminal evidence path, and proves exact zero cleanup. Settlement uses that terminal replacement as the effective result without deleting or rewriting the original timeout evidence; both raw receipts and their root-cause fields remain reportable, while policy occurrence counting selects only the mapping's one effective result.
- Every cross-plan canonical evidence reference parses through prerequisite P0's `canonical-ref-v1.ts` export, which Task 1 imports and identity-re-exports as B's `CanonicalRefSchema`/`CanonicalRef`. Its sole URI family is the existing Setfarm-compatible `setfarm://` grammar; C, D, and E import the Task 1 re-export rather than creating local reference regexes.
- `executeGoldenCaseV1` accepts an optional one-shot B-owned lifecycle checkpoint. The fixed C post-review adapter may install its reviewed port directly. Every external recovery action, including Subproject D's Mission Control or dashboard restart, supplies only B's narrow service-restart action adapter, is wrapped first by `createGoldenRegisteredExternalLifecycleCheckpointV1()`, and then by B as an opaque authenticated `GoldenExternalLifecycleCheckpointCapabilityV1` bound to the exact full release epoch and finite code-owned semantic implementation/predicate identity. C accepts that capability only through its recovery-executor factory and never accepts or exposes the raw action or lifecycle port. The B default is a no-op; the harness never starts a second run, and terminal collection begins only after any matched action has returned its validated receipt.
- Tests use fake ports or isolated PostgreSQL through `scripts/run-isolated-postgres-tests.ts`. They must not contact live services, start real runs, create GitHub state, or mutate the live database.
- Every operational shell fence that can mutate durable state, build installed output, or invoke real preflight begins with `set -euo pipefail`. In that same fence, immediately before each build or operational command, require branch `main`, an empty tracked/untracked status, and `HEAD === origin/main`; repeat those guards after a build before preflight. Guard, command, and any redirect remain in one shell control flow, so a failed command, substitution, or pipeline terminates the fence and no later mutation runs. When the invoked operation requires one-use authority, its code-owned boundary resolves and CAS-consumes the exact canonical ref/hash pair before the side effect; a shell flag, receipt body, or hash without its ref is never authority. Focused fake/isolated tests on scoped story worktrees are not operational mutation fences and never receive a false clean-main assertion.
- Developer, reviewer, supervisor, QA, and final-test agents never stage, commit, push, merge, switch/create canonical branches, or open/update/merge PRs. Setfarm owns the active claim, isolated worktree/branch, commits, publication, integration, and clean-main synchronization. Each task records only read-only status/diff/test evidence and returns a scoped handoff to Setfarm.
- Stop and report rather than weaken a gate when the same systemic failure repeats three times after attempted fixes.

---

## File Map

- Create `src/internal-production/golden-run-contract-v1.ts`: strict campaign, case, start-strategy, prepared launch intent, authoritative start receipt, fixture identity, assertion, evidence, result, settlement, classification, preflight, and canonical-hash contracts shared by every harness component.
- Create `src/internal-production/golden-run-owner-producer-manifest-activation-controller-v1.ts`: B-only, import-inert, path-free controller that wraps the exact A11-to-A+B21 activation in a durable predecessor/successor receipt and status.
- Bootstrap-create in prerequisite Task P0 `src/internal-production/canonical-ref-v1.ts`: the sole bounded `setfarm://` reference grammar and nominal shared type needed by bootstrap receipts and later B/C/D/E contracts.
- Bootstrap-create in prerequisite Task P0 `src/internal-production/internal-production-data-root-v1.ts`: trusted runtime-config-derived private data root resolver and contained, symlink-safe child/store primitives shared by the bootstrap receipt store and all later B stores.
- Create `src/internal-production/golden-run-snapshot.ts`: V3-first/V2-compatible operational-snapshot parsing and stable snapshot comparison.
- Create `src/internal-production/golden-run-repository.ts`: read-only PostgreSQL and runtime-artifact collection for exact run, step, story, ownership, effect, artifact, delivery, and worktree identities.
- Create `src/internal-production/golden-launch-operation-migration-release-v1.ts`: fixed-root durable source/tree/migration-bound release operation, pair-only resolvers, one-use zero-owner apply/recovery coordinator, terminal receipt, fixed locator, and fresh schema verifier for the Task 2 contract-spine migration.
- Create `src/db/golden-launch-operation-v1-migration.ts`: the sole SQL/schema projection owner for the launch-operation/run reciprocal binding and its terminal migration-release-receipt hash.
- Create `src/internal-production/golden-run-observers.ts`: clean-release inspection, verified fixture resolution, typed compiled-CLI delegation, Mission Control API/render evidence, GitHub evidence delegation, and exact process/port/worktree cleanup checks.
- Create `src/internal-production/golden-verifier-runtime.ts`: sealed-contract verifier runtime allocation, authenticated durable lease/rejoin, exact readiness, canonical stop/release, and path-free release evidence.
- Create `src/internal-production/golden-run-classifier.ts`: pure precedence-ordered acceptance and failure classification with exact root-cause identities.
- Create `src/internal-production/golden-run-harness.ts`: start-strategy dispatch, V3 one-slot admission, canonical existing-repository start, one-run poll/collect orchestration, internal assertion-subject assembly, optional one-shot lifecycle checkpoint, assertion-port invocation, interruption-safe collection, settlement evaluation, and repeated-systemic-cause stop.
- Create `src/internal-production/golden-run-phase-store.ts`: fixed-root symlink-safe prepared-launch-intent store plus hash-chained execution/collection phase journal used for exact interruption recovery.
- Create `src/internal-production/golden-run-store.ts`: fixed-root, symlink-safe, content-addressed result storage and bounded campaign index.
- Create `src/internal-production/golden-run-report.ts`: deterministic bounded Markdown renderer, private-preview writer, matrix-settlement verifier, content-addressed private finalization authority, and narrow verified tracked materializer.
- Create `src/internal-production/golden-docs-claim-owner-terminal-disposal.ts`: Setfarm claim-owner-only terminal-disposal hook that privately consumes the disposed-claim capability, retires the exact docs lease through the lifecycle registry, and returns only a durable retirement receipt ref/hash.
- Create `src/internal-production/golden-source-build-authority.ts`: code-owned live-service source/build root observer independent of `cwd`, content-addressed private authority seal/reopen, active-claim source resolver, deterministic Mission Control build manifest, and read-only artifact verifier used by finalization/materialization.
- Bootstrap-create in prerequisite Task P0 `src/internal-production/setfarm-completion-owner-receipts-v1.ts`: fixed-root content-addressed store, Setfarm-completion-owner-only committed-PR-head/merge and post-activation bootstrap-main-claim handoff receipt producers, strict receipt contracts, and pair-only public resolvers.
- Bootstrap-create in prerequisite Task P0 `src/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.ts`: new-spawner A-startup-capability join, self-registration, activation finalizer/status, per-generation admission, and polling barrier authority.
- Bootstrap-create in prerequisite Task P0 `src/internal-production/setfarm-bootstrap-main-claim-handoff-repository-v1.ts`: durable operation repository joining atomic DB claim allocation, idempotent worktree adoption, receipt publication, and terminal pair settlement.
- Bootstrap-modify in prerequisite Task P0 `src/spawner.ts`: exact existing Setfarm completion-owner composition root; self-register, wait on the exact activation barrier, and only then accept completion work.
- Bootstrap-modify in prerequisite Task P0 `src/server/spawnerctl.ts`: expose only the fixed bounded self-registration/status observation used by the authenticated activation controller.
- Bootstrap-modify in prerequisite Task P0 `src/execution/runtime-completion.ts`: authenticated owner-only P0 activation and post-activation bootstrap-main-claim allocation call sites.
- Create `src/internal-production/golden-run-cli.ts`: exact guarded migration prepare/resume, read-only migration status/verify, `preflight`, `execute`, `collect`, `reconcile-timeout`, `finalize-report`, and `materialize-finalized-report` command surface plus default port wiring.
- Create `tests/fixtures/internal-production/golden-campaign-v1.json`: harmless deterministic Node CLI schema fixture; tests never execute it as a live run.
- Create `tests/internal-production/golden-run-contract-v1.test.ts`: strict schema, hash, bound, and hostile-input tests.
- Create `tests/internal-production/golden-run-owner-producer-manifest-activation-controller-v1.test.ts`: B controller receipt/status, CLI, interruption/replay, import-inertness, and no-B-producer-before-activation tests.
- Create `tests/internal-production/golden-run-snapshot.test.ts`: V3/V2 parsing and projection-equivalence tests.
- Create `tests/internal-production/golden-run-repository.test.ts`: isolated-PostgreSQL canonical collection and settlement tests.
- Create `tests/internal-production/golden-launch-operation-migration-release-v1.test.ts`: release operation durability, exact source/tree/digest/schema binding, guard consumption, apply/verify, crash/race/response-loss adoption, and consumer-gate tests.
- Create `tests/internal-production/golden-run-observers.test.ts`: fake HTTP/browser/process tests and source-boundary checks around compiled-CLI execution.
- Create `tests/internal-production/golden-verifier-runtime.test.ts`: sealed launcher, one-lease, live assertion window, exact stop/release, crash-rejoin, and no-path-leak tests.
- Create `tests/internal-production/golden-run-classifier.test.ts`: all seven classifications, acceptance precedence, and exact systemic-cause tests.
- Create `tests/internal-production/golden-run-harness.test.ts`: fake-port preflight, execution, collection, stop, timeout, drift, and interruption tests.
- Create `tests/internal-production/golden-run-phase-store.test.ts`: phase ordering, hash chain, idempotence, corruption, wrong-run, and symlink-safety tests.
- Create `tests/internal-production/golden-run-store.test.ts`: filesystem safety, content-addressing, campaign indexing, and bounds tests.
- Create `tests/internal-production/golden-run-report.test.ts`: deterministic report, redaction, size, identity, and external-authority tests.
- Create `tests/internal-production/golden-docs-claim-owner-terminal-disposal.test.ts`: claim-owner capability confinement, lease-lifecycle registry, crash recovery, and path-free retirement-reference tests.
- Create `tests/internal-production/golden-source-build-authority.test.ts`: non-sibling worktree, no-local-`dist`, source-authority, deterministic-manifest, and artifact-drift tests.
- Bootstrap-create in prerequisite Task P0 `tests/internal-production/setfarm-completion-owner-receipts-v1.test.ts`: owner-only PR/merge/bootstrap-main-claim handoff receipt production, strict schema/hash/ref/relation, no-follow storage, and resolver/clone/replay rejection tests.
- Bootstrap-create in prerequisite Task P0 `tests/internal-production/canonical-ref-v1.test.ts`: sole-reference grammar, bounds, and no-redeclaration tests.
- Bootstrap-create in prerequisite Task P0 `tests/internal-production/internal-production-data-root-v1.test.ts`: fixed-root containment, absent-root read, and symlink/hardlink/mode tests.
- Bootstrap-create in prerequisite Task P0 `tests/internal-production/setfarm-completion-owner-receipts-activation-v1.test.ts`: spawner composition, generation activation, isolated producer/resolver smoke, and restart/status failure tests.
- Bootstrap-create in prerequisite Task P0 `tests/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.test.ts`: pair response-loss, self-registration, finalizer/status, and zero-claim barrier crash tests.
- Bootstrap-create in prerequisite Task P0 `tests/internal-production/setfarm-bootstrap-main-claim-handoff-repository-v1.test.ts`: DB/FS operation phases, worktree adoption, receipt settlement, crash/race, and one-writer tests.
- Create `tests/internal-production/golden-run-cli.test.ts`: exact argv, exit-code, no-mutation preflight, explicit-SHA, and single-case tests.
- Modify `src/evals/convergence-runner.ts`: use the shared V3-first snapshot parser while preserving existing convergence behavior and exports.
- Modify `src/execution/v3-release-admission-repository.ts`: bind canary creation idempotently to the authenticated golden launch-intent/preparation identity without exposing the selector.
- Modify `tests/execution-attempts/v3-release-admission.test.ts`: prove same-intent admission reuse and reject changed-intent, changed-selector, and duplicate-admission recovery.
- Modify `tests/evals/convergence-eval.test.ts`: prove current V3 snapshots no longer fail the convergence projection parser.
- Bootstrap-modify `package.json`: add read-only `acceptance:completion-owner-receipts`; later Task 7's exact command table adds `internal:golden` with B's `activate-owner-producer-manifest --json` and read-only `owner-producer-manifest-status --json` verbs, adds `test:internal-production`, then includes the focused suite in `npm test`.

---

### Prerequisite Task P0: Bootstrap completion-owner receipt authority in its own merged claim

**Files:**
- Create in this bootstrap claim only: `src/internal-production/canonical-ref-v1.ts`
- Create in this bootstrap claim only: `src/internal-production/internal-production-data-root-v1.ts`
- Create in this bootstrap claim only: `src/internal-production/setfarm-completion-owner-receipts-v1.ts`
- Create in this bootstrap claim only: `src/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.ts`
- Create in this bootstrap claim only: `src/internal-production/setfarm-bootstrap-main-claim-handoff-repository-v1.ts`
- Modify in this bootstrap claim only: `src/spawner.ts`
- Modify in this bootstrap claim only: `src/server/spawnerctl.ts`
- Modify in this bootstrap claim only: `src/execution/runtime-completion.ts`
- Modify in this bootstrap claim only: `package.json`
- Create in this bootstrap claim only: `tests/internal-production/canonical-ref-v1.test.ts`
- Create in this bootstrap claim only: `tests/internal-production/internal-production-data-root-v1.test.ts`
- Create in this bootstrap claim only: `tests/internal-production/setfarm-completion-owner-receipts-v1.test.ts`
- Create in this bootstrap claim only: `tests/internal-production/setfarm-completion-owner-receipts-activation-v1.test.ts`
- Create in this bootstrap claim only: `tests/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.test.ts`
- Create in this bootstrap claim only: `tests/internal-production/setfarm-bootstrap-main-claim-handoff-repository-v1.test.ts`

**Interfaces:**
- Consumes: A's already merged exact `InternalProductionBaselineServiceRestartAuthorityV1`, `resolveInternalProductionBaselineServiceRestartAuthorityV1({receiptRef,receiptHash})`, `InternalProductionBaselineBootstrapHandoffMigrationReceiptV1`, `resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1({migrationReceiptRef,migrationReceiptHash})`, `resolveHistoricalBaselinePostHandoffReceiptV1()`, `InternalProductionBaselineSpawnerStartupAdmissionV1`, `resolveActiveInternalProductionBaselineSpawnerStartupAdmissionV1()`, `claimInternalProductionBaselineSpawnerStartupAdmissionV1({admission})`, `awaitInternalProductionBaselineSpawnerRestartAuthorityV1({admission,startupClaimHash})`, `InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1`, `InternalProductionBaselineSpawnerBootstrapRestartOperationV1`, `InternalProductionBaselineSpawnerBootstrapContinuationGrantV1`, `InternalProductionBaselineSpawnerBootstrapRestartSequenceReceiptV1`, `prepareInternalProductionBaselineSpawnerBootstrapRestartV1({targetGuard,postSettlementContinuationKind:"setfarm-bootstrap-main-claim-allocation-v1"})`, `executeOrRecoverInternalProductionBaselineSpawnerBootstrapRestartV1({operationRef,operationHash})`, `resolveInternalProductionBaselineSpawnerBootstrapRestartOperationV1({operationRef,operationHash})`, `resolveInternalProductionBaselineSpawnerBootstrapContinuationGrantV1({continuationGrantRef,continuationGrantHash})`, `finalizeInternalProductionBaselineSpawnerBootstrapRestartSequenceV1({operationRef,operationHash})`, and `resolveInternalProductionBaselineSpawnerBootstrapRestartSequenceV1({sequenceRef,sequenceHash})`; `runtimeConfig.setfarmDir`; `hashCanonicalJson`; existing `GitObjectHashSchema`/`Sha256Schema`; exact existing Setfarm completion-owner composition in `src/spawner.ts`; exact existing spawner-generation observer in `src/server/spawnerctl.ts`; and the read-only GitHub PR/check/review/merge proof that exists before this plan. Before P0 claim allocation, the existing owner freshly resolves A's historical baseline receipt and nested guarded bootstrap-handoff migration pair, requires its digest/schema/apply/verify relations, and passes only that authenticated authority into the claim. The current authenticated runtime-completion owner reopens the same historical/migration pair again before any spawner restart, mints A's opaque target guard, asks already-delivered A to prepare the durable bootstrap operation plus fixed one-use continuation grant, and durably binds the operation pair before execute may interrupt that exact owner; no old-build B code is required and B never applies schema or calls a raw guard/restart service command. The replacement spawner consumes A's exact operation-bound startup admission, and after targeted recovery/release B persists and resolves A's terminal bootstrap-sequence pair plus its nested discriminated restart-authority and continuation-grant pairs. It explicitly cannot consume any receipt, store, activation, canonical-ref, or internal-production-root symbol created by this task to authorize its own initial PR/merge.
- Consumes from A's already delivered old-generation runtime-completion boundary: exact `InternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1`, `createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1()`, and `continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1({verification})`. Step 6b uses only those A exports; it cannot load a new P0 function before the spawner replacement.
- Produces after its separate PR is reviewed, merged, built, reloaded through A's prepared bootstrap operation, targeted recovery is settled, and Task 0 handoff is terminal: `CanonicalRefSchema`/`CanonicalRef`; exact ordered `P0_BOOTSTRAP_PATHS`; `resolveInternalProductionDataRootV1()` and internal contained child/store primitives; exact `SetfarmCompletionOwnerCommittedPrHeadReceiptV1`, `resolveSetfarmCompletionOwnerCommittedPrHeadReceiptV1({receiptRef,receiptHash})`, `SetfarmCompletionOwnerMergeReceiptV1`, `resolveSetfarmCompletionOwnerMergeReceiptV1({receiptRef,receiptHash})`; activation, startup-admission, bootstrap-settlement, and bootstrap-main-claim-handoff types/pair-only resolvers; the owner-only DB/FS handoff repository; and their fixed stores/composition. P0 adds no public restart command, flag, raw `launchctl`, generic mutation port, target request selector, or claim allocator outside the continuation-grant consumer.
- Claim boundary: before this bootstrap scope is even claimed, the pre-existing owner freshly resolves A's historical baseline receipt and its nested exact applied bootstrap-handoff migration authority. It retains `migrationSourceSha` as A's exact initial application SHA, proves `git merge-base --is-ancestor migrationSourceSha currentCleanSetfarmSha`, reads the A-application and current Git trees without checkout, and requires A's dedicated implementation blob, canonical ordered statements, exact named digest entry/hash, digest, and freshly verified schema projection to remain equal. The aggregate registry/digest files may contain additional unrelated append-only entries and are never compared as whole blobs. Missing/corrupt/unapplied authority, equality of the wrong SHAs, reverse/nonancestor history, changed blob, regenerated-but-different digest bytes, or schema drift allocates no claim. This bootstrap scope is then claimed, committed, pushed, reviewed, merged, synchronized, built, activated, and released before the main B claim exists. Neither the bootstrap PR nor its merge may be authorized by the receipt implementation it contains. Only the post-merge activation/smoke may consume it, and P0 never applies a migration.

Private activation integration: `createOrResumeSetfarmCompletionOwnerReceiptActivationV1()` is called only by the replacement spawner's authenticated startup path after A admission claim, returns the activation pair, and accepts no caller restart/receipt body. Zero-argument `observeSetfarmCompletionOwnerReceiptActivationStatusV1()` is read-only and returns the strict path-free phase union shown below with exact states `prepared|restarting|waiting-for-registration|waiting-for-activation|waiting-for-owner-release|active|blocked`. Every branch carries the exact A historical-baseline and bootstrap-handoff-migration pairs plus its operation pair and only phase-valid later pairs; all unavailable later members are literal `null`. The active branch alone carries non-null operation, fenced restart authority, activation, startup admission, target-owner release, terminal sequence/global-zero, settlement, and bootstrap-handoff pairs. Its resolver freshly reopens and equality-binds the historical receipt, its nested applied migration authority, A's continuation grant, and exact claim/worktree/writer census before the active CAS and normal-poll release. The controller never accepts a shell-local pair/body, migration scalar/body, or registration-supplied A field.

- [ ] **Step 1: Write the failing primitive, receipt-store, composition, and activation tests**

The current P0 completion owner first calls A's already-delivered `prepareInternalProductionBaselineSpawnerBootstrapRestartV1({targetGuard,postSettlementContinuationKind:"setfarm-bootstrap-main-claim-allocation-v1"})` and persists the exact operation pair into its durable request before execute. A itself publishes the one-use `InternalProductionBaselineSpawnerBootstrapContinuationGrantV1`; no old-build B call is needed. The grant is bound to target guard, operation, bootstrap source/tree, and fixed continuation purpose, has literal `disposition:"authorized-no-claim"`, and proves both claim/worktree fields `null`; it creates no claim, worktree, or writer. Only then may execute interrupt the owner. Crash and replay tests cover every boundary around operation/grant publication, operation-pair request binding, execute dispatch, old-build-to-new-build handoff, and response loss; neither a new operation nor a second/cross-purpose grant may appear.

After activation, targeted recovery, owner release, and A terminal global-zero settlement, the bootstrap-handoff repository consumes that exact one-use grant and adds a strict unique `bootstrapHandoffOperationId` row with states `reserved|claim_allocated|worktree_ready|receipt_published|terminal|failed_released`. In one database transaction it consumes the grant, inserts the operation, and allocates the deterministic claim identity under the existing serialized writer lock; a uniqueness conflict reopens that exact operation/claim. The operation is the only bridge across database and filesystem: DB reserved/claim allocated precedes exact contained worktree create-or-adopt, then operation-indexed canonical receipt publication/reopen precedes an expected-predecessor DB CAS that stores the receipt pair and marks terminal. If the filesystem receipt is durable but DB settlement is absent, recovery opens only the operation-indexed expected ref and adopts byte-identical authority; it never scans. Tests crash before/after grant consumption, DB reservation, claim allocation, worktree create/adopt, every receipt temp/link/fsync/reopen boundary, FS-before-DB receipt settlement, terminal pair CAS, response return, and terminal failure/release. Recovery authenticates the same grant, operation, claim, contained worktree identity, census, settlement, and operation-indexed receipt; it never allocates a second claim/worktree/writer or selects by scan/newest. Race two callers and require one operation/claim/pair. Partial, mismatched, foreign, ambiguous, consumed-by-another-operation, or released state blocks.

Per-generation startup-admission tests lock the strict finite branch relation: `bootstrap-a-restart|a-managed-restart` each require an exact A composite pair. Every admission binds the one immutable bootstrap activation, exact self-registration/generation/module/source/build, expected predecessor, and content-addressed ref/hash. Publish through one expected-predecessor CAS head and test crashes before/after candidate, head, response, and polling release; stale activation/source/build/generation, fork, replay, manual/unknown/ambiguous start, a start without an active A operation, or D hook substitution blocks. Before D's later explicit integration, an ordinary authenticated LaunchAgent restart/reboot with no active A operation remains health-capable but completion-poll-disabled with typed `activation-required`; it cannot mint an admission. The bootstrap activation remains immutable and is never reminted by a later admission.

P0's post-settlement claim-handoff ABI consumes A's exact `InternalProductionBaselineSpawnerBootstrapContinuationGrantV1` and produces exact `SetfarmCompletionOwnerBootstrapSettlementReceiptV1`, `SetfarmBootstrapMainClaimHandoffReceiptV1`, owner-only `allocateAndRecordSetfarmBootstrapMainClaimHandoffV1()`, and their pair-only resolvers. Allocation is forbidden on activation alone: it requires the exact preauthorized unconsumed A grant plus the freshly resolved settlement that binds activation, startup admission, A operation/composite/terminal sequence, target-request release, terminal global zero, and source/build/generation. Task 0 starts only from the terminal database operation's returned receipt pair.

Bootstrap-main-claim handoff tests call the owner-only allocator only after exact settlement is `active`, consume the preauthorized grant once, atomically allocate one serialized claim, publish its strict receipt with the existing durable no-replace store protocol, settle the DB operation, and reopen it from a fresh resolver using only its canonical pair. Recompute the acyclic receipt body hash (excluding ref/hash), derived ref, nested settlement/activation/grant, exact ordered `P0_BOOTSTRAP_PATHS` mode/blob identity set, bootstrap merge/tree, origin/base equality, exact fixed canonical root, contained real claim root, branch, worktree/writer census, and one-writer relations. Reject pre-activation or pre-settlement use, use during P0's own delivery/activation, an unbound/consumed grant, a second allocation, structural clone, caller field/root/branch/census, wrong/omitted/reordered file set, corrupt/missing nested authority, symlinked/out-of-root claim, fork/collision, or response-loss duplication.

The activation controller accepts no public handoff object or scalar input. Before execute, the authenticated current completion owner closes over the verified P0 merge/source/build proof, asks A prepare to publish the operation plus no-claim continuation grant, and durably binds the exact operation pair to that same completion request. After process replacement, the new-spawner path consumes only A's operation-bound startup admission. Activation is deliberately pre-settlement: it releases only the narrow targeted-recovery path, not normal polling. `recoverTargetedSetfarmCompletionOwnerBootstrapV1({startupAdmission})` resolves the operation/target capability from A, processes no unrelated request, recovers the interrupted P0 request, and records/releases that exact owner. The controller then finalizes A's operation into the terminal global-zero sequence and publishes a separate `SetfarmCompletionOwnerBootstrapSettlementReceiptV1`. Only that settlement plus the freshly resolved unconsumed A continuation grant may call `allocateAndRecordSetfarmBootstrapMainClaimHandoffV1()`. The handoff receipt cannot authorize P0's own PR, merge, build, restart, or activation, so the dependency is acyclic.

`setfarm-completion-owner-receipt-activation-controller-v1.test.ts` crashes before/after target-guard mint, A prepare, completion-request operation binding, allocation-grant publication, execute/dispatch, new registration, A composite reopen, activation finalizer/receipt, targeted request effect/recovery/release, A sequence finalization/global zero, settlement publication, grant consumption/allocation, status advance, and response boundaries. It proves an execute response loss adopts one exact operation, operation-bound startup admission, and registration without a new guard/restart. Spawner tests require normal completion poll and claim call counts exactly zero through registration and activation; activation releases only one targeted recovery of the authenticated interrupted request. Normal polling starts once only after the target owner is released, A's terminal global-zero sequence and B settlement resolve, the grant has produced one terminal handoff, and active status is durable. Missing/corrupt/stale/blocked operation, activation, release, sequence, settlement, grant, or handoff never releases the normal barrier.

`canonical-ref-v1.test.ts` locks the sole `setfarm://` grammar and `4_000`-byte bound. `internal-production-data-root-v1.test.ts` proves one runtime-config-derived, real contained, shared root; absent-root reads; `0700` directories/`0600` files; and symlink/hardlink/non-directory/mode/traversal rejection. `setfarm-completion-owner-receipts-v1.test.ts` drives the private owner producer with authenticated completion-controller observations, persists one committed-PR-head receipt and its later merge receipt, then resolves each only by canonical ref/hash in a fresh store instance. Prove the producer derives schema, canonical hash/ref, repository literal, PR URL, P0 activation pair, bootstrap merge/tree, and all equality/ancestry-bound fields rather than accepting a receipt body; it refuses a committed/head/merge observation whose activation does not resolve or whose base/head/merge is not descended from the activated bootstrap. Cover no-follow, regular-file/mode/size, no-replace, file/parent `fsync`, reopen, collision, unknown member, structural clone, wrong ref/hash, replay, and every crash boundary. Accept lowercase 40- and 64-hex Git object IDs, require exact lowercase 64-hex evidence identities, and reject uppercase, nonhex, or wrong-width values without claiming semantic provenance from a valid 64-hex value's width alone.

`setfarm-completion-owner-receipts-activation-v1.test.ts` proves `src/spawner.ts` is the exact composition root, imports the producer/barrier and A startup admission plus historical/migration resolver symbols directly, self-registers before any completion work, and exposes no generic registry, raw producer, caller root, environment-selected module, dynamic import, public restart option, raw service mutator, schema writer, request selector, or unrelated poll port. Before the P0 claim is allocated, the owner resolves the exact A historical receipt and nested guarded migration authority. The exact old completion owner freshly reopens those same pairs, preserves A's exact initial `migrationSourceSha`, proves it is an ancestor of the current clean bootstrap SHA, requires A's dedicated implementation/ordered-statements/named-entry/digest/schema projection plus apply/verify relation to remain byte-identical while unrelated appended entries are accepted, then prepares/binds A's operation and allocation grant before execute. It never requires current source SHA to equal `migrationSourceSha`. The new spawner repeats that descendant-and-byte-identity proof, narrows the resolved service authority to `guardKind:"fenced-completion-owner-bootstrap"`, checks its operation/target request/claim/run/owner/drain/fence/unrelated-zero relations, joins it to the independently self-observed distinct new-generation registration, performs the activation-independent probe, and publishes/resolves activation with the same historical/migration pairs. Activation enables only `recoverTargetedSetfarmCompletionOwnerBootstrapV1()`; ordinary polling remains zero until exact owner release, terminal A global-zero sequence, settlement, and handoff. Response loss repeats only the same A operation and adopts the exact historical/migration/restart/registration/activation/recovery/settlement/handoff chain. An equality-only current-source check, reversed/nonancestor relation, changed A implementation, ordered statements, named digest entry, or schema projection, a `complete-zero-owner` member, missing/corrupt/swapped migration pair, structural clone, zero/multiple generations, stale locator, same generation, corrupt authority, source/build mismatch, second restart, registration containing caller A/prior fields, unrelated targeted work, early normal polling, a B migration mutation, a bare diagnostic runtime-source observation, or probe mismatch fails without Task 0 authority.

- [ ] **Step 2: Implement the bootstrap-owned shared primitives and receipt store**

`canonical-ref-v1.ts` owns the exact schema/type declared in this step and later identity-re-exported by Task 1; no receipt module defines a local regex. `internal-production-data-root-v1.ts` owns the sole trusted data-root/contained-child/store mechanics needed before Task 1. `P0_BOOTSTRAP_PATHS` is the one frozen ordered fifteen-path manifest; the claim scope, focused suite, clean-main build/activation source identity, receipt producer/resolver, `p0FileSetHash`, Task 0 tree observer, and delivery proof import or project that exact export rather than maintaining another list. The read-only `p0-tree-projection --source-sha GitObjectHash --json` subcommand imports that export, runs fixed `execFile("git",["ls-tree",sourceSha,"--",...P0_BOOTSTRAP_PATHS],{shell:false,...})`, requires exactly one regular blob entry per manifest path in the same order, and returns only the strict source/path-count/ordered path-mode-blob projection plus its canonical hash; it accepts no path list or root. The receipt module imports both exact P0 primitives, owns the strict receipt/settlement schemas and fixed private store, and never imports the future `golden-run-contract-v1.ts`. Its producer receives only authenticated controller observations, derives and atomically publishes each strict receipt with unpredictable same-directory temporaries, mode `0600`, file and parent `fsync`, no-replace publication, and `O_NOFOLLOW` reopen/rehash, returning only canonical pairs. Its public worker-facing surface is limited to frozen types and pair-only resolvers. The bootstrap-handoff repository imports no migration writer; it requires the already applied A schema through the freshly resolved historical/migration authority before any DB operation.

A's already merged `contract-spine-migrations.ts` and generated digest own the unique continuation-grant/`bootstrapHandoffOperationId` key, deterministic claim identity, finite phase, expected-predecessor, terminal receipt ref/hash, and failure/release columns without a second writer table. P0 neither lists nor edits that migration. `setfarm-bootstrap-main-claim-handoff-repository-v1.ts` first freshly resolves A's historical baseline receipt and exact nested migration authority, then resolves the A continuation grant and B settlement, consumes the grant, and inserts the operation plus deterministic claim allocation in one database transaction against the already verified schema. It idempotently creates or authenticates the exact contained worktree, publishes/reopens the operation-indexed filesystem receipt, and CAS-sets the same DB row terminal. Recovery starts from the unique operation/grant key: a durable FS receipt with a preterminal DB row is adopted only at its exact derived ref with byte-identical operation/claim/worktree/settlement/grant/migration relations, then the DB CAS completes. No phase deletes/resets/reuses a worktree or allocates another writer. A terminal failure durably releases exactly its own partial claim/worktree and grant reservation before `failed_released`; ambiguity retains the blocker and never guesses cleanup.

```typescript
import {
  type InternalProductionBaselineBootstrapHandoffMigrationReceiptV1,
  type InternalProductionBaselineServiceRestartAuthorityV1,
  resolveHistoricalBaselinePostHandoffReceiptV1,
  resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1,
  resolveInternalProductionBaselineServiceRestartAuthorityV1,
} from "./baseline-post-handoff-receipt-v1.js";
import {
  type InternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1,
  type InternalProductionBaselineCompletionOwnerBootstrapTargetGuardV1,
  type InternalProductionBaselineSpawnerBootstrapContinuationGrantV1,
  type InternalProductionBaselineSpawnerBootstrapRestartOperationV1,
  type InternalProductionBaselineSpawnerBootstrapRestartSequenceReceiptV1,
  type InternalProductionBaselineSpawnerStartupAdmissionV1,
  awaitInternalProductionBaselineSpawnerRestartAuthorityV1,
  claimInternalProductionBaselineSpawnerStartupAdmissionV1,
  continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1,
  createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1,
  executeOrRecoverInternalProductionBaselineSpawnerBootstrapRestartV1,
  finalizeInternalProductionBaselineSpawnerBootstrapRestartSequenceV1,
  prepareInternalProductionBaselineSpawnerBootstrapRestartV1,
  resolveActiveInternalProductionBaselineSpawnerStartupAdmissionV1,
  resolveInternalProductionBaselineSpawnerBootstrapRestartOperationV1,
  resolveInternalProductionBaselineSpawnerBootstrapRestartSequenceV1,
  resolveInternalProductionBaselineSpawnerBootstrapContinuationGrantV1,
} from "./baseline-spawner-startup-admission-v1.js";

export const CanonicalRefSchema = z.string()
  .max(4_000)
  .regex(
    /^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%-]+(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%-]+)*$/u,
  );
export type CanonicalRef = z.infer<typeof CanonicalRefSchema>;

export const P0_BOOTSTRAP_PATHS = [
  "package.json",
  "src/execution/runtime-completion.ts",
  "src/internal-production/canonical-ref-v1.ts",
  "src/internal-production/internal-production-data-root-v1.ts",
  "src/internal-production/setfarm-bootstrap-main-claim-handoff-repository-v1.ts",
  "src/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.ts",
  "src/internal-production/setfarm-completion-owner-receipts-v1.ts",
  "src/server/spawnerctl.ts",
  "src/spawner.ts",
  "tests/internal-production/canonical-ref-v1.test.ts",
  "tests/internal-production/internal-production-data-root-v1.test.ts",
  "tests/internal-production/setfarm-bootstrap-main-claim-handoff-repository-v1.test.ts",
  "tests/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.test.ts",
  "tests/internal-production/setfarm-completion-owner-receipts-activation-v1.test.ts",
  "tests/internal-production/setfarm-completion-owner-receipts-v1.test.ts",
] as const;

export type SetfarmCompletionOwnerReceiptActivationReceiptV1 = Readonly<{
  schema: "setfarm.completion-owner-receipt-activation.v1";
  repository: "hikmetgulsesli/setfarm";
  baselineHistoricalReceiptRef: CanonicalRef;
  baselineHistoricalReceiptHash: string;
  bootstrapHandoffMigrationReceiptRef: CanonicalRef;
  bootstrapHandoffMigrationReceiptHash: string;
  restartActionId: "a-restart-service-setfarm-spawner-v1";
  restartOperationId: string;
  bootstrapMergeSha: string;
  bootstrapTreeHash: string;
  canonicalRefModuleHash: string;
  dataRootModuleHash: string;
  receiptModuleSourceHash: string;
  receiptModuleBuildHash: string;
  spawnerCompositionSourceHash: string;
  spawnerCompositionBuildHash: string;
  registrationHash: string;
  baselineServiceRestartAuthorityRef: CanonicalRef;
  baselineServiceRestartAuthorityHash: string;
  postRuntimeSourceProjectionHash: string;
  priorSpawnerGenerationHash: string;
  activatedSpawnerGenerationHash: string;
  isolatedSmokeHash: string;
  activationReceiptRef: CanonicalRef;
  activationReceiptHash: string;
}>;

export type SetfarmCompletionOwnerBootstrapSettlementReceiptV1 = Readonly<{
  schema: "setfarm.completion-owner-bootstrap-settlement-receipt.v1";
  baselineHistoricalReceiptRef: CanonicalRef;
  baselineHistoricalReceiptHash: string;
  bootstrapHandoffMigrationReceiptRef: CanonicalRef;
  bootstrapHandoffMigrationReceiptHash: string;
  activationReceiptRef: CanonicalRef;
  activationReceiptHash: string;
  startupAdmissionRef: CanonicalRef;
  startupAdmissionHash: string;
  bootstrapOperationRef: CanonicalRef;
  bootstrapOperationHash: string;
  continuationGrantRef: CanonicalRef;
  continuationGrantHash: string;
  baselineServiceRestartAuthorityRef: CanonicalRef;
  baselineServiceRestartAuthorityHash: string;
  bootstrapSequenceRef: CanonicalRef;
  bootstrapSequenceHash: string;
  targetRequestOperationBindingHash: string;
  targetRequestReleaseAuthorityHash: string;
  terminalCompleteZeroOwnerCensusHash: string;
  setfarmSha: string;
  spawnerBuildHash: string;
  activatedSpawnerGenerationHash: string;
  recoveredOwnerGenerationHash: string;
  settlementReceiptRef: CanonicalRef;
  settlementReceiptHash: string;
}>;

type SetfarmCompletionOwnerReceiptActivationStatusPairV1 = Readonly<{
  ref: CanonicalRef;
  hash: string;
}>;

type SetfarmCompletionOwnerReceiptActivationStatusV1 =
  | Readonly<{
    schema: "setfarm.completion-owner-receipt-activation-status.v1";
    state: "prepared" | "restarting";
    activationOperationHash: string;
    statusRef: CanonicalRef;
    statusHash: string;
    baselineHistorical: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    bootstrapHandoffMigration: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    bootstrapOperation: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    restartAuthority: null;
    startupRegistration: null;
    activationReceiptRef: null;
    activationReceiptHash: null;
    startupAdmission: null;
    terminalSequence: null;
    ownerReleaseAuthorityHash: null;
    terminalCompleteZeroOwnerCensusHash: null;
    settlement: null;
    bootstrapHandoff: null;
  }>
  | Readonly<{
    schema: "setfarm.completion-owner-receipt-activation-status.v1";
    state: "waiting-for-registration";
    activationOperationHash: string;
    statusRef: CanonicalRef;
    statusHash: string;
    baselineHistorical: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    bootstrapHandoffMigration: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    bootstrapOperation: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    restartAuthority: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    startupRegistration: null;
    activationReceiptRef: null;
    activationReceiptHash: null;
    startupAdmission: null;
    terminalSequence: null;
    ownerReleaseAuthorityHash: null;
    terminalCompleteZeroOwnerCensusHash: null;
    settlement: null;
    bootstrapHandoff: null;
  }>
  | Readonly<{
    schema: "setfarm.completion-owner-receipt-activation-status.v1";
    state: "waiting-for-activation";
    activationOperationHash: string;
    statusRef: CanonicalRef;
    statusHash: string;
    baselineHistorical: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    bootstrapHandoffMigration: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    bootstrapOperation: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    restartAuthority: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    startupRegistration: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    activationReceiptRef: null;
    activationReceiptHash: null;
    startupAdmission: null;
    terminalSequence: null;
    ownerReleaseAuthorityHash: null;
    terminalCompleteZeroOwnerCensusHash: null;
    settlement: null;
    bootstrapHandoff: null;
  }>
  | Readonly<{
    schema: "setfarm.completion-owner-receipt-activation-status.v1";
    state: "waiting-for-owner-release";
    activationOperationHash: string;
    statusRef: CanonicalRef;
    statusHash: string;
    baselineHistorical: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    bootstrapHandoffMigration: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    bootstrapOperation: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    restartAuthority: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    startupRegistration: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    activationReceiptRef: CanonicalRef;
    activationReceiptHash: string;
    startupAdmission: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    terminalSequence: null;
    ownerReleaseAuthorityHash: null;
    terminalCompleteZeroOwnerCensusHash: null;
    settlement: null;
    bootstrapHandoff: null;
  }>
  | Readonly<{
    schema: "setfarm.completion-owner-receipt-activation-status.v1";
    state: "blocked";
    activationOperationHash: string;
    statusRef: CanonicalRef;
    statusHash: string;
    baselineHistorical: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    bootstrapHandoffMigration: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    bootstrapOperation: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    blockerCode: "BOOTSTRAP_RESTART_BLOCKED" |
      "BOOTSTRAP_REGISTRATION_BLOCKED" |
      "BOOTSTRAP_ACTIVATION_BLOCKED" |
      "BOOTSTRAP_TARGET_RECOVERY_BLOCKED" |
      "BOOTSTRAP_SETTLEMENT_BLOCKED" |
      "BOOTSTRAP_HANDOFF_BLOCKED";
    lastStableStatus: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    restartAuthority: null;
    startupRegistration: null;
    activationReceiptRef: null;
    activationReceiptHash: null;
    startupAdmission: null;
    terminalSequence: null;
    ownerReleaseAuthorityHash: null;
    terminalCompleteZeroOwnerCensusHash: null;
    settlement: null;
    bootstrapHandoff: null;
  }>
  | Readonly<{
    schema: "setfarm.completion-owner-receipt-activation-status.v1";
    state: "active";
    activationOperationHash: string;
    statusRef: CanonicalRef;
    statusHash: string;
    baselineHistorical: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    bootstrapHandoffMigration: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    bootstrapOperation: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    restartAuthority: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    startupRegistration: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    activationReceiptRef: CanonicalRef;
    activationReceiptHash: string;
    startupAdmission: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    terminalSequence: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    ownerReleaseAuthorityHash: string;
    terminalCompleteZeroOwnerCensusHash: string;
    settlement: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
    bootstrapHandoff: SetfarmCompletionOwnerReceiptActivationStatusPairV1;
  }>;

export type SetfarmCompletionOwnerReceiptProducerStartupAdmissionV1 = Readonly<{
  schema: "setfarm.completion-owner-receipt-producer-startup-admission.v1";
  branch: "bootstrap-a-restart" | "a-managed-restart";
  activationReceiptRef: CanonicalRef;
  activationReceiptHash: string;
  generationHash: string;
  registrationHash: string;
  setfarmSha: string;
  spawnerBuildHash: string;
  producerModuleHash: string;
  predecessorAdmissionHash: string | null;
  aRestartAuthorityRef: CanonicalRef;
  aRestartAuthorityHash: string;
  admissionRef: CanonicalRef;
  admissionHash: string;
}>;

declare function createOrResumeSetfarmCompletionOwnerReceiptProducerStartupAdmissionV1(
): Promise<Readonly<{ admissionRef: CanonicalRef; admissionHash: string }>>;

export function resolveSetfarmCompletionOwnerReceiptProducerStartupAdmissionV1(
  input: Readonly<{ admissionRef: CanonicalRef; admissionHash: string }>,
): Promise<SetfarmCompletionOwnerReceiptProducerStartupAdmissionV1>;

declare function createOrResumeSetfarmCompletionOwnerReceiptActivationV1(
): Promise<Readonly<{
  activationReceiptRef: CanonicalRef;
  activationReceiptHash: string;
}>>;

declare function recoverTargetedSetfarmCompletionOwnerBootstrapV1(
  input: Readonly<{
    startupAdmission: InternalProductionBaselineSpawnerStartupAdmissionV1;
  }>,
): Promise<Readonly<{ targetRequestReleaseAuthorityHash: string }>>;

export function resolveSetfarmCompletionOwnerBootstrapSettlementReceiptV1(
  input: Readonly<{
    settlementReceiptRef: CanonicalRef;
    settlementReceiptHash: string;
  }>,
): Promise<SetfarmCompletionOwnerBootstrapSettlementReceiptV1>;

declare function observeSetfarmCompletionOwnerReceiptActivationStatusV1(
): Promise<SetfarmCompletionOwnerReceiptActivationStatusV1>;

export type SetfarmBootstrapMainClaimHandoffReceiptV1 = Readonly<{
  schema: "setfarm.bootstrap-main-claim-handoff-receipt.v1";
  repository: "hikmetgulsesli/setfarm";
  activationReceiptRef: CanonicalRef;
  activationReceiptHash: string;
  bootstrapSettlementReceiptRef: CanonicalRef;
  bootstrapSettlementReceiptHash: string;
  continuationGrantRef: CanonicalRef;
  continuationGrantHash: string;
  bootstrapMergeSha: string;
  bootstrapTreeHash: string;
  p0FileSetHash: string;
  bootstrapHandoffOperationId: string;
  observedOriginMainSha: string;
  claimBaseSha: string;
  claimId: string;
  canonicalRoot: "/Users/setrox/ai/setrox/setfarm";
  claimWorktreeRoot: string;
  canonicalBranch: "main";
  claimBranch: string;
  gitWorktreeCensusHash: string;
  setfarmWriterCensusHash: string;
  activeWriterCount: 1;
  activeWriterClaimId: string;
  unattributedWriterCount: 0;
  priorEpochWriterCount: 0;
  receiptRef: CanonicalRef;
  receiptHash: string;
}>;

declare function allocateAndRecordSetfarmBootstrapMainClaimHandoffV1(
): Promise<Readonly<{ receiptRef: CanonicalRef; receiptHash: string }>>;

export function resolveSetfarmBootstrapMainClaimHandoffReceiptV1(
  input: Readonly<{ receiptRef: CanonicalRef; receiptHash: string }>,
): Promise<SetfarmBootstrapMainClaimHandoffReceiptV1>;

export function resolveSetfarmCompletionOwnerReceiptActivationReceiptV1(
  input: Readonly<{
    activationReceiptRef: CanonicalRef;
    activationReceiptHash: string;
  }>,
): Promise<SetfarmCompletionOwnerReceiptActivationReceiptV1>;
```

All Git identities use `GitObjectHashSchema`; all module/build/registration/generation/smoke/receipt identities use `Sha256Schema`; all refs use the exact P0 `CanonicalRefSchema`. The activation receipt first freshly resolves A's historical baseline receipt and its nested guarded bootstrap-handoff migration pair, rechecks exact pair equality plus digest/schema/apply/verify relations, and binds both pairs into its hash. It then freshly resolves A's exact composite pair, narrows it to `guardKind:"fenced-completion-owner-bootstrap"`, requires `service:"setfarm-spawner"` and `actionId:"a-restart-service-setfarm-spawner-v1"`, copies `restartOperationId` from its authenticated operation, derives `postRuntimeSourceProjectionHash` only from `after.projectionHash`, and equality-binds the complete `after` source/build/service projection to the exact bootstrap Setfarm build and clean Mission Control identity. It derives every other member from running compiled source/build, A operation/target authorization, self-registration, and the fixed registry and accepts no caller SHA/tree/hash/PID/path, migration body, diagnostic observation, guard pair, or nested restart body. It requires the prior/activated generation hashes to equal A's exact before/after spawner generation hashes, requires them to differ, revalidates target-guard consumption plus retained-target/zero-unrelated cleanup, and binds the isolated smoke. Activation intentionally contains no terminal sequence, owner-release, global-zero, settlement, grant-consumption, or handoff member; those are bound only by the later settlement/status chain.

- [ ] **Step 3: Wire the exact existing composition and activation operation**

`src/spawner.ts` is the named composition root. It statically imports the P0 receipt/activation module and A's exact operation-bound startup-admission resolver/claim/waiter. On startup it resolves only A's fixed unique active spawner-operation locator. When the capability exists, it authenticates/claims it against its own process/generation/source/build and exact `bootstrapOperationRef`/`bootstrapOperationHash`, self-observes and durably publishes/reopens one registration containing only the current generation and exact loaded identities, remains health-capable but normal-completion-poll-blocked, waits for and freshly resolves A's composite authority for that same operation, runs the activation-independent probe/finalizer, publishes the one immutable bootstrap activation, and publishes the bootstrap generation's startup-admission successor. Activation opens only the exact pre-barrier targeted recovery function. After that function releases the interrupted owner, the controller finalizes/reopens A's sequence/global-zero, publishes/reopens settlement, consumes the grant through the handoff repository, and finally advances status to `active`; only then may `runRuntimeCompletionProcessor()` begin an unrelated poll or claim. Crash/restart repeats the same operation, registration, activation, admission, targeted recovery, settlement, grant, and handoff; missing/corrupt/stale/ambiguous evidence keeps normal completion unavailable.

`src/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.ts` is the new-spawner self-bootstrap controller called only from that startup path; it never starts/restarts a service and accepts no shell pair, external handoff, raw port, request ID, environment, plist, PID, or structural A body. It joins the authenticated A startup capability, exact operation pair, self-registration, and freshly resolved same-operation bootstrap authority, deriving prior generation only from A and current generation only from self-observation. `src/server/spawnerctl.ts` exposes the resulting read-only strict phase status for Steps 6b–6c. Before D is delivered, only `bootstrap-a-restart|a-managed-restart` can append a B startup admission; no active A operation means typed `activation-required` and normal polling remains disabled. D's reviewed source task explicitly modifies this module/test and the exported discriminated union to add only `d-ordinary-start` and `d-managed-restart`. It owns exact internal `createOrResumeSetfarmCompletionOwnerReceiptProducerDOrdinaryStartAdmissionV1({settlement,ownerPublication})` and `createOrResumeSetfarmCompletionOwnerReceiptProducerDManagedRestartAdmissionV1({operation,startupAdmission,terminalReservation,completion,occurrence,namespaceHead,serviceStartSlotHead})`. The first accepts only D's freshly resolved successful ordinary settlement/publication. The second accepts only D's freshly resolved successful setfarm-spawner restart operation/startup-admission plus settled reservation, completion, occurrence, namespace head, and service-start-slot head for one of D's four finite namespaces. Both use the same expected-predecessor B admission CAS and bind exact source/build/generation. No generic port, caller parent hash/namespace, structural object, failed/in-progress D result, A fallback, or ordinary fallback is accepted. The exact D type members and null relations are owned and delivered in D, not predeclared as constructible P0 branches.

The activation finalizer performs a bounded isolated-store smoke using a distinct private `setfarm.completion-owner-receipt-registration-probe.v1` schema. The probe binds only fixed registration/module/build identities, contains no activation ref/hash and no committed/merge receipt fields, is written through the same low-level durable store protocol below a fresh temporary root, and is reopened through a fresh private probe resolver before `isolatedSmokeHash` is computed. Only after that independent probe passes may the finalizer publish/reopen the activation receipt. Only after activation publication may the public committed/merge producer accept that exact activation pair. Tests reject either public producer call before activation, any probe containing an activation/public-receipt member, activation computed before probe reopen, or a public receipt used to derive its own activation.

The receipt module stores immutable per-generation admission records and immutable CAS head versions through its existing temp/fsync/no-replace/reopen protocol; one fixed replaceable current-head locator is updated only under its private CAS lock after predecessor equality. Fresh startup reconstructs the bounded head chain, requires exactly one successor per generation, and rejects a fork, gap, duplicate generation, unknown branch, stale activation, or partial candidate/head. The bootstrap admission may point to the bootstrap activation, but no successor changes that activation or gains bootstrap delivery authority.

- [ ] **Step 4: Verify and independently review the bootstrap claim**

The P0/Task 0/Task 8 source test rejects `$(` anywhere in a `test`, `[`, or `[[` predicate, a `readonly`, `export`, `local`, or `declare` invocation, another outer command's argv, or a redirection in an operational Bash fence. Command substitution is allowed only in a standalone simple assignment or the enumerated status-aware `if VAR="$(negative scan)"` captures. Transcript cases inject a nonzero exit into every inner producer and separately produce nonempty dirt, proving no modifier, predicate, outer command, build, activation, delivery, or acceptance command follows.

The adjacent A set includes `tests/internal-production/baseline-service-restart-helper-v1.test.ts` in addition to A's receipt and CLI tests.

Run all six P0 focused tests named in `P0_BOOTSTRAP_PATHS`, A's adjacent `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`, `tests/internal-production/baseline-service-restart-helper-v1.test.ts`, `tests/internal-production/baseline-spawner-startup-admission-v1.test.ts`, `tests/internal-production/baseline-service-restart-sequence-v1.test.ts`, `tests/internal-production/baseline-restart-authority-retirement-v1.test.ts`, `tests/internal-production/baseline-post-handoff-cli.test.ts`, `tests/execution-attempts/migrations.test.ts`, and `tests/execution-attempts/migration-source-digests.test.ts`, plus `tests/execution-attempts/runtime-completion.test.ts`, `tests/spawner-gateway-recovery.test.ts`, `npx tsc -p tsconfig.json --noEmit`, `npm run check:english`, `npm run check:paths`, `npm run check:migration-digests`, and `git diff --check`. This uncommitted bootstrap claim must not run `npm run build`, any build alias, or any command that writes `dist`; Step 6a's post-owner-merge, synchronized, clean-`main` fence is the first build authority. Source/transcript tests inject every Task P0 Step 4 command outcome and fail if a build starts before the exact owner merge/synchronization handoff, literal `main`, empty full porcelain, and `HEAD == refs/remotes/origin/main == bootstrapMergeSha` all pass in the same Step 6a fence. Separate A-to-P0 migration fixtures set the current clean SHA to a strict descendant of A's exact receipt `migrationSourceSha` and pass only while A's dedicated implementation blob, ordered statements, named digest entry, digest, and fresh schema projection remain identical; an unrelated append-only registry/digest entry remains valid; equal-current-source-only logic, a changed byte with a recomputed downstream hash, reverse/nonancestor history, or rewriting the receipt's original application SHA fails. A source identity test requires the File Map, P0 claim, focused suite, first clean-main build receipt, owner activation, receipt `p0FileSetHash`, Task 0 tree projection, and delivery receipt to consume the same exact ordered `P0_BOOTSTRAP_PATHS` export with all fifteen path/mode/blob identities and no duplicate local list. An independent reviewer verifies the exact P0 scope, primitive ownership, direct composition wiring, A historical/migration and discriminated bootstrap-authority consumption, producer confinement, durable stores, strict schemas, activation/settlement relation, activation-independent probe, absence of a B diagnostic runtime-source dependency, absence of a B migration mutation, and absence of any dependency on the new resolver for this bootstrap's own delivery.

- [ ] **Step 5: Deliver the bootstrap through the pre-existing owner path**

Return the uncommitted P0 claim evidence to Setfarm. The already-existing completion owner alone commits/pushes its bootstrap PR. Inspect that PR read-only through the pre-existing GitHub authority, require its exact repository/base/head/tree, successful required checks, approved review, complete resolved review threads, and Setfarm-owner merge/synchronization evidence. Do not call any new P0 resolver during this initial delivery. A failed or incomplete proof leaves activation and Task 0 unavailable.

- [ ] **Step 6a: Build and verify the clean merged bootstrap**

After the already-existing completion owner merges the P0 PR and synchronizes canonical `main`, Step 6a derives bootstrap SHA/tree/file identities directly from that clean canonical checkout and the already inspected GitHub proof; it creates no external handoff or pre-P0 controller API. This strict fence performs the first build and focused verification, then returns success to the still-live authenticated runtime-completion owner. It does not wait for activation, call a B mutation command, or assume the replacement process already exists.

```bash
set -euo pipefail
p0_preinstall_branch="$(git branch --show-current)"
test "$p0_preinstall_branch" = "main"
p0_preinstall_status="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$p0_preinstall_status"
head_sha="$(git rev-parse HEAD)"
origin_main_sha="$(git rev-parse refs/remotes/origin/main)"
head_tree_hash="$(git rev-parse 'HEAD^{tree}')"
test "$head_sha" = "$origin_main_sha"
test "$head_sha" = "$SETFARM_P0_OWNER_PROOF_MERGE_SHA"
test "$head_tree_hash" = "$SETFARM_P0_OWNER_PROOF_TREE_HASH"
npm ci
p0_prebuild_branch="$(git branch --show-current)"
test "$p0_prebuild_branch" = "main"
p0_prebuild_status="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$p0_prebuild_status"
p0_prebuild_head="$(git rev-parse HEAD)"
p0_prebuild_origin_main="$(git rev-parse refs/remotes/origin/main)"
test "$p0_prebuild_head" = "$p0_prebuild_origin_main"
p0_prebuild_handoff_head="$(git rev-parse HEAD)"
test "$p0_prebuild_handoff_head" = "$SETFARM_P0_OWNER_PROOF_MERGE_SHA"
npm run build
node --import tsx --test \
  tests/internal-production/canonical-ref-v1.test.ts \
  tests/internal-production/internal-production-data-root-v1.test.ts \
  tests/internal-production/setfarm-completion-owner-receipts-v1.test.ts \
  tests/internal-production/setfarm-completion-owner-receipts-activation-v1.test.ts \
  tests/internal-production/setfarm-completion-owner-receipt-activation-controller-v1.test.ts \
  tests/internal-production/setfarm-bootstrap-main-claim-handoff-repository-v1.test.ts \
  tests/internal-production/baseline-post-handoff-receipt-v1.test.ts \
  tests/internal-production/baseline-service-restart-helper-v1.test.ts \
  tests/internal-production/baseline-spawner-startup-admission-v1.test.ts \
  tests/internal-production/baseline-service-restart-sequence-v1.test.ts \
  tests/internal-production/baseline-restart-authority-retirement-v1.test.ts \
  tests/internal-production/baseline-post-handoff-cli.test.ts \
  tests/execution-attempts/migrations.test.ts \
  tests/execution-attempts/migration-source-digests.test.ts \
  tests/execution-attempts/runtime-completion.test.ts \
  tests/spawner-gateway-recovery.test.ts
npm run check:migration-digests
p0_posttest_branch="$(git branch --show-current)"
test "$p0_posttest_branch" = "main"
p0_posttest_status="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$p0_posttest_status"
p0_posttest_head="$(git rev-parse HEAD)"
p0_posttest_origin_main="$(git rev-parse refs/remotes/origin/main)"
test "$p0_posttest_head" = "$p0_posttest_origin_main"
p0_posttest_handoff_head="$(git rev-parse HEAD)"
test "$p0_posttest_handoff_head" = "$SETFARM_P0_OWNER_PROOF_MERGE_SHA"
```

- [ ] **Step 6b: Resume the authenticated owner through the in-process A-only continuation**

After Step 6a returns success, the same live runtime-completion owner calls A's already delivered `createInternalProductionBaselineCompletionOwnerBootstrapCleanBuildVerificationV1()` and then exactly `continueInternalProductionBaselineCompletionOwnerBootstrapAfterCleanBuildV1({verification})` in process. The verification capability binds the clean bootstrap merge/tree, the exact `P0_BOOTSTRAP_PATHS` projection, built module identities, focused-test hash, and freshly reopened A historical/migration pairs; it is WeakMap-authenticated and never enters shell, argv, environment, JSON, or a worker. The A continuation authenticates that exact current P0 completion request/claim/run owner, mints A's target guard, calls A prepare, persists the returned operation pair and one fixed status locator in the same request before execute, reopens both, and only then calls `executeOrRecoverInternalProductionBaselineSpawnerBootstrapRestartV1(...)`. It may replace its own process and therefore no caller relies on a return value. Reentry before dispatch adopts the same request-bound operation/status locator; reentry after dispatch performs lookup/recovery only. The old process imports no newly built P0/B module. There is no B shell mutation command, target selector, operation input, or alternate continuation.

- [ ] **Step 6c: Poll the persisted activation status from a fresh process**

Start a separate fresh operator process after Step 6b may have replaced the owner. The zero-input read-only command resolves the one exact request-bound current status locator and its operation pair internally; the shell never supplies either. Poll a bounded sixty observations, accept only the strict finite pre-active states, fail immediately on `blocked` or malformed/drifted locator evidence, and require terminal `active` before timeout:

```bash
set -euo pipefail
p0_poll_attempt=0
p0_bootstrap_state=""
while test "$p0_poll_attempt" -lt 60; do
  p0_bootstrap_status="$(npm run --silent acceptance:completion-owner-receipts -- activation-status --json)"
  p0_bootstrap_state="$(printf '%s\n' "$p0_bootstrap_status" | jq -er '.state')"
  p0_status_ref="$(printf '%s\n' "$p0_bootstrap_status" | jq -er '.statusRef')"
  p0_status_hash="$(printf '%s\n' "$p0_bootstrap_status" | jq -er '.statusHash')"
  p0_operation_ref="$(printf '%s\n' "$p0_bootstrap_status" | jq -er '.bootstrapOperation.ref')"
  p0_operation_hash="$(printf '%s\n' "$p0_bootstrap_status" | jq -er '.bootstrapOperation.hash')"
  test -n "$p0_status_ref"
  test -n "$p0_operation_ref"
  printf '%s\n' "$p0_status_hash" | jq -Re 'test("^[0-9a-f]{64}$")' >/dev/null
  printf '%s\n' "$p0_operation_hash" | jq -Re 'test("^[0-9a-f]{64}$")' >/dev/null
  case "$p0_bootstrap_state" in
    active)
      break
      ;;
    prepared|restarting|waiting-for-registration|waiting-for-activation|waiting-for-owner-release)
      sleep 1
      ;;
    blocked)
      printf 'P0 bootstrap activation blocked\n' >&2
      exit 1
      ;;
    *)
      printf 'P0 bootstrap activation returned an invalid state\n' >&2
      exit 1
      ;;
  esac
  p0_poll_attempt=$((p0_poll_attempt + 1))
done
test "$p0_bootstrap_state" = "active"
printf '%s\n' "$p0_bootstrap_status" | jq -e '
  (.baselineHistorical.ref | type == "string") and
  (.baselineHistorical.hash | test("^[0-9a-f]{64}$")) and
  (.bootstrapHandoffMigration.ref | type == "string") and
  (.bootstrapHandoffMigration.hash | test("^[0-9a-f]{64}$")) and
  (.restartAuthority.ref | type == "string") and
  (.restartAuthority.hash | test("^[0-9a-f]{64}$")) and
  (.startupRegistration.ref | type == "string") and
  (.startupRegistration.hash | test("^[0-9a-f]{64}$")) and
  (.activationReceiptRef | type == "string") and
  (.activationReceiptHash | test("^[0-9a-f]{64}$")) and
  (.startupAdmission.ref | type == "string") and
  (.startupAdmission.hash | test("^[0-9a-f]{64}$")) and
  (.terminalSequence.ref | type == "string") and
  (.terminalSequence.hash | test("^[0-9a-f]{64}$")) and
  (.settlement.ref | type == "string") and
  (.settlement.hash | test("^[0-9a-f]{64}$")) and
  (.bootstrapHandoff.ref | type == "string") and
  (.bootstrapHandoff.hash | test("^[0-9a-f]{64}$"))
' >/dev/null
p0_poststatus_branch="$(git branch --show-current)"
test "$p0_poststatus_branch" = "main"
p0_poststatus_porcelain="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$p0_poststatus_porcelain"
p0_poststatus_head="$(git rev-parse HEAD)"
p0_poststatus_origin_main="$(git rev-parse refs/remotes/origin/main)"
test "$p0_poststatus_head" = "$p0_poststatus_origin_main"
test "$p0_poststatus_head" = "$SETFARM_P0_OWNER_PROOF_MERGE_SHA"
```

The replacement spawner resolves the operation-bound A admission, narrows the composite authority to `guardKind:"fenced-completion-owner-bootstrap"`, self-registers, publishes activation, and opens only targeted recovery. It recovers/releases the exact interrupted request, finalizes/reopens A's terminal sequence/global zero, publishes/reopens `SetfarmCompletionOwnerBootstrapSettlementReceiptV1`, resolves and one-use consumes A's continuation grant, completes the DB/FS handoff operation, and advances active status only after freshly reopening the handoff. The active status resolver equality-binds the historical/migration authority, operation, composite authority, activation, startup admission, owner-release authority, terminal sequence/global-zero, settlement, continuation grant, claim/worktree/writer census, and handoff. No shell/CLI accepts mutation input or exposes a target capability/finalizer; `activation-status --json` is read-only and emits the exact strict phase union.

Source/transcript tests fail every Step 6a command, substitution, pipeline, test, build and each Step 6c status/poll/predicate/final-cleanliness boundary in turn. They separately crash Step 6b before/after build-capability mint, historical/migration reopen, A target/prepare, request operation/status-locator binding, execute, and every replacement-process boundary. A Step 6a failure never calls the continuation; Step 6b response loss never creates a second operation/locator; Step 6c tolerates only the five exact pre-active states, times out after sixty observations without mutation, and never treats a one-shot pre-active result as failure or success. Every blocked/timeout/malformed/dirty failure proves no unrelated poll or main B edit follows. Tests also prove B never invokes or accepts diagnostic `runtime-source` output. Crash recovery adopts only the same historical/migration/operation/request/admission/registration/activation/recovery/settlement/grant/handoff chain; partial, stale, duplicate, same-generation, cross-purpose, or mismatched state blocks. Only after the active status freshly resolves its handoff pair may Task 0 begin.

---

### Task 0: Acquire one Setfarm-owned clean implementation claim

**Files:**
- Verify only: Setfarm repository status and remote identity

**Interfaces:**
- Consumes: only the terminal bootstrap-handoff database operation's returned `{receiptRef,receiptHash}` and exact `resolveSetfarmBootstrapMainClaimHandoffReceiptV1({receiptRef,receiptHash})`. The freshly resolved receipt indivisibly binds and freshly resolves activation, bootstrap settlement, A continuation grant, bootstrap operation/terminal sequence/global zero, target-owner release, bootstrap merge SHA/tree, canonical `origin/main`, the exact ordered `P0_BOOTSTRAP_PATHS` mode/blob identity-set hash, main-claim base SHA, claim ID, exact real roots/branches, full Git worktree census, Setfarm writer census, and exactly one active writer equal to that claim ID. Its `bootstrapHandoffOperationId` must reopen as terminal with the same pair. A shell argument, environment override, separate SHA, structural receipt, activation-only pair, or caller JSON object is never authority.
- Produces: one Setfarm-issued active claim and isolated worktree whose recorded base equals the read-only observed `origin/main`; agents receive the worktree path but do not create/switch its branch.

- [ ] **Step 1: Resolve the indivisible owner handoff and prove its canonical base**

The Setfarm controller accepts only the pair returned by the terminal handoff operation, freshly calls `resolveSetfarmBootstrapMainClaimHandoffReceiptV1()`, rehashes its complete body, freshly resolves every nested activation/settlement/A operation/continuation/sequence authority, requires all source/tree/manifest/claim/root/branch/census/terminal-operation relations, and only then injects one frozen read-only `SETFARM_BOOTSTRAP_HANDOFF_*` environment derived field-for-field from that receipt. No worker/caller may populate or override any member. Run:

```bash
set -euo pipefail
canonical_root="$(git rev-parse --show-toplevel)"
canonical_real_root="$(cd "$canonical_root" && pwd -P)"
test "$canonical_real_root" = "$SETFARM_BOOTSTRAP_HANDOFF_CANONICAL_ROOT"
canonical_branch="$(git branch --show-current)"
test "$canonical_branch" = "main"
test "$SETFARM_BOOTSTRAP_HANDOFF_CANONICAL_BRANCH" = "main"
canonical_status="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$canonical_status"
head_sha="$(git rev-parse HEAD)"
origin_main_sha="$(git rev-parse refs/remotes/origin/main)"
head_tree_hash="$(git rev-parse 'HEAD^{tree}')"
test "$head_sha" = "$origin_main_sha"
test "$head_sha" = "$SETFARM_BOOTSTRAP_HANDOFF_ORIGIN_MAIN_SHA"
test "$head_sha" = "$SETFARM_BOOTSTRAP_HANDOFF_BASE_SHA"
test "$head_sha" = "$SETFARM_BOOTSTRAP_HANDOFF_MERGE_SHA"
test "$head_tree_hash" = "$SETFARM_BOOTSTRAP_HANDOFF_TREE_HASH"
test -n "$SETFARM_BOOTSTRAP_HANDOFF_ACTIVATION_REF"
printf '%s\n' "$SETFARM_BOOTSTRAP_HANDOFF_ACTIVATION_HASH" | rg -x '[0-9a-f]{64}'
test -n "$SETFARM_BOOTSTRAP_HANDOFF_SETTLEMENT_REF"
printf '%s\n' "$SETFARM_BOOTSTRAP_HANDOFF_SETTLEMENT_HASH" | rg -x '[0-9a-f]{64}'
test -n "$SETFARM_BOOTSTRAP_HANDOFF_CONTINUATION_GRANT_REF"
printf '%s\n' "$SETFARM_BOOTSTRAP_HANDOFF_CONTINUATION_GRANT_HASH" | rg -x '[0-9a-f]{64}'
p0_tree_projection="$(npm run --silent acceptance:completion-owner-receipts -- p0-tree-projection --source-sha "$head_sha" --json)"
jq -e '
  .schema == "setfarm.p0-bootstrap-tree-projection.v1" and
  .sourceSha == $sourceSha and
  .pathCount == 15 and
  (.orderedEntries | length == 15) and
  ([.orderedEntries[].path] == ([.orderedEntries[].path] | sort | unique)) and
  ([.orderedEntries[].mode] | all(. == "100644")) and
  ([.orderedEntries[].blob] | all(test("^[0-9a-f]{40}([0-9a-f]{24})?$")))
' --arg sourceSha "$head_sha" <<<"$p0_tree_projection"
p0_file_set_hash="$(printf '%s\n' "$p0_tree_projection" | jq -er '.p0FileSetHash')"
test "$p0_file_set_hash" = "$SETFARM_BOOTSTRAP_HANDOFF_P0_FILE_SET_HASH"
test "$SETFARM_BOOTSTRAP_HANDOFF_ACTIVE_WRITER_COUNT" = "1"
test "$SETFARM_BOOTSTRAP_HANDOFF_ACTIVE_WRITER_CLAIM_ID" = "$SETFARM_BOOTSTRAP_HANDOFF_CLAIM_ID"
test "$SETFARM_BOOTSTRAP_HANDOFF_UNATTRIBUTED_WRITER_COUNT" = "0"
test "$SETFARM_BOOTSTRAP_HANDOFF_PRIOR_EPOCH_WRITER_COUNT" = "0"
printf '%s\n' "$head_sha"
printf '%s\n' "$origin_main_sha"
```

Expected: every command exits `0`; the literal clean canonical `main`, exact current remote-tracking head, handoff base, bootstrap merge/tree, activation pair, full P0 file identity projection, and sole writer all agree. Because `HEAD === bootstrapMergeSha`, the `git ls-tree` projection checks the exact bootstrap-tree bytes/modes/blobs rather than merely checking current-path existence. Missing/malformed/unresolved activation, wrong tree/file set/root/base/origin/claim/writer relation, dirt, or another/unattributed writer blocks before claim-worktree acceptance or any edit.

The P0 source-identity regression imports the one frozen `P0_BOOTSTRAP_PATHS` export, requires its length to be exactly `15`, and derives both `pathCount` and the expected `orderedEntries.length` from that export. It rejects a hard-coded `16`, any other duplicated count/list, an omitted or extra manifest path, or a producer/receipt/Task 0 projection whose count differs from `P0_BOOTSTRAP_PATHS.length`.

- [ ] **Step 2: Receive and validate the Setfarm-owned claim/worktree**

Run:

```bash
set -euo pipefail
claim_root="$(git rev-parse --show-toplevel)"
claim_real_root="$(cd "$claim_root" && pwd -P)"
test "$claim_real_root" = "$SETFARM_BOOTSTRAP_HANDOFF_CLAIM_WORKTREE_ROOT"
claim_branch="$(git branch --show-current)"
test "$claim_branch" = "$SETFARM_BOOTSTRAP_HANDOFF_CLAIM_BRANCH"
claim_base_head="$(git rev-parse HEAD)"
test "$claim_base_head" = "$SETFARM_BOOTSTRAP_HANDOFF_BASE_SHA"
claim_origin_main_head="$(git rev-parse HEAD)"
test "$claim_origin_main_head" = "$SETFARM_BOOTSTRAP_HANDOFF_ORIGIN_MAIN_SHA"
claim_status="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$claim_status"
worktree_census_hash="$(
  git worktree list --porcelain \
    | shasum -a 256 \
    | awk '{print $1}'
)"
test "$worktree_census_hash" = "$SETFARM_BOOTSTRAP_HANDOFF_WORKTREE_CENSUS_HASH"
test "$SETFARM_BOOTSTRAP_HANDOFF_ACTIVE_WRITER_COUNT" = "1"
test "$SETFARM_BOOTSTRAP_HANDOFF_ACTIVE_WRITER_CLAIM_ID" = "$SETFARM_BOOTSTRAP_HANDOFF_CLAIM_ID"
test "$SETFARM_BOOTSTRAP_HANDOFF_UNATTRIBUTED_WRITER_COUNT" = "0"
test "$SETFARM_BOOTSTRAP_HANDOFF_PRIOR_EPOCH_WRITER_COUNT" = "0"
```

Expected: Setfarm has supplied the exact isolated real worktree, branch, claim, clean base, worktree census, and sole-writer projection bound by the authenticated handoff. All following Task 1–7 edits occur only inside that claim. Claim/worktree/branch creation, switching, rebasing, committing, publication, and teardown remain Setfarm-owned.

Task 0 transcript tests replace each command substitution, pipeline member, and command in both fences with a nonzero or mismatched result. They cover dirty tracked/untracked status, missing remote ref, wrong literal branch, unequal HEAD/origin/handoff/base/bootstrap/activation/settlement/continuation-grant/tree/file-set identities, a nonterminal `bootstrapHandoffOperationId`, missing P0 manifest entry, changed mode/blob, wrong canonical or claim real root, wrong claim branch/ID/base, stale/different worktree census, zero/two/unattributed/prior-epoch writers, and claim-status failure. Literal strict mode must be the first nonblank command; every injected failure proves no later command runs and no main-claim acceptance or Task 1 edit begins. Tests also prove no standalone environment scalar, activation-only pair, or structural handoff clone authenticates and the main claim never edits any P0 file.

---

### Task 1: Lock the immutable campaign and result contracts

**Files:**
- Verify/import only from prerequisite P0: `src/internal-production/canonical-ref-v1.ts`
- Verify/import only from prerequisite P0: `src/internal-production/internal-production-data-root-v1.ts`
- Create: `src/internal-production/golden-run-contract-v1.ts`
- Create: `tests/fixtures/internal-production/golden-campaign-v1.json`
- Create: `tests/internal-production/golden-run-contract-v1.test.ts`

**Interfaces:**
- Consumes: prerequisite P0's exact `CanonicalRefSchema`/`CanonicalRef`, `resolveInternalProductionDataRootV1()`, and contained child/store primitives; `hashCanonicalJson(value)` from `src/product-compiler/canonical-json.ts`; `GitObjectHashSchema`, `Sha256Schema`, and `hasUniqueStrings` from `src/product-compiler/schemas/common-v1.ts`.
- Produces: identity-preserving imports/re-exports of P0's `CanonicalRefSchema`/`CanonicalRef` and data-root resolver; `GoldenCampaignV1Schema`, `GoldenCaseV1Schema`, `GoldenStartStrategyV1Schema`, `GoldenFixtureVerificationCommandIdV1Schema`, `GoldenFixtureVerificationCommandV1Schema`, `GoldenLaunchIntentV1Schema`, nominal `GoldenPersistedLaunchIntentV1`, `GoldenLaunchExecutionBindingV1Schema`, `GoldenStarterInvocationIssuedV1Schema`, `GoldenPreStartAuthorizationReceiptV1Schema`, `GoldenRunStartReceiptV1Schema`, `GoldenStartedRunStartV1Schema`, `GoldenTimeoutTerminalSupersessionV1Schema`, exact nominal `GoldenCommittedTimeoutReconciliationPairAuthorityV1Schema`/type/authenticator, `GoldenFinalReleaseEpochV1Schema`, `createGoldenFinalReleaseEpochV1(input)`, `GoldenExistingRepositoryFixtureManifestV1Schema`, `GoldenExistingRepositoryFixtureTemplateV1Schema`, `GoldenExistingRepositoryFixtureIdentityV1Schema`, `GoldenExistingRepositoryFixtureAttemptV1Schema`, `GoldenProductAssertionContractV1Schema`, `GoldenProductAssertionSetV1Schema`, `GoldenCampaignSettlementPolicyV1Schema`, exact finite `GoldenReasonCodeV1Schema`/`GoldenReasonCodeV1`, `GoldenCampaignExecutionCapacityV1Schema`/`GoldenCampaignExecutionCapacityV1`, `GoldenPreflightResultV1Schema`/`GoldenPreflightResultV1`, `GoldenCampaignSettlementV1Schema`, `GoldenRunEvidenceV1Schema`, the strict `GoldenPreRunResultV1 | GoldenStartedRunResultV1` union exported as `GoldenRunResultV1Schema`/`GoldenRunResultV1`, `GoldenClassificationV1Schema`, `GoldenEffectiveRunResultProjectionV1`, `deriveEffectiveGoldenRunResultsV1(input)`, `loadGoldenCampaignV1(file)`, `authenticateLoadedGoldenCampaignV1(value)`, `goldenCaseHashV1(value)`, `goldenPromptHashV1(task)`, `goldenAdmissionTaskHashV1(task)`, `createGoldenRunResultV1(payload)`, and their inferred TypeScript types.
- Contract boundary: no public receipt/result contains an admission selector token, environment map, raw prompt, absolute path, raw subprocess output, raw artifact payload, or screenshot bytes. The sole raw-task persistence exception is the private content-addressed `GoldenPreparedRecoveryContextV1` capability in Task 3A; its public ref/hash and prepared-state boundary never expose those bytes through CLI, status, result, or report.

- [ ] **Step 1: Write the failing strict campaign and identity tests**

Create tests that load the fixture, assert its immutable hashes, require `authenticateLoadedGoldenCampaignV1(loaded)` to return only that exact frozen loader-owned object, reject its structural clone before downstream activity, and reject duplicate cases, a root-cause limit other than three, absolute paths, secrets, prompt-authored `--repo`, `--branch`, or `--port`, more than sixteen cases, and unknown fields. Assert the fixture uses `all-cases-required-accepted-v1` with `maximumConcurrency:1`; reject `2` for that policy and every value outside the finite `1 | 2` set. Add one valid ten-case `fleet-threshold-v1` campaign with `maximumConcurrency:2` and reject `1`, any changed terminal count, minimum accepted count, allowed-classification tuple/order, cleanup literal, systemic literal, case count, duplicate case/result subject, or per-case accepted count. Add one valid `canonical-existing-repository-workflow` value and reject an unsupported workflow, caller-selected protocol, non-main branch, mismatched campaign/template hash/ref, or missing template identity. Parse a complete fixture manifest and reject campaign/fixture/seed/hash/baseline/remote drift, noncanonical GitHub URL, and every unsafe path form including `.`, `..`, `a/../b`, `a//b`, absolute/backslash/NUL, prefix-confusion, non-final `**`, duplicate, or unsorted values. Commands accept only the four code-owned phase/seed command IDs; reject a wrong-phase ID, executable/argv field, Node eval/preload/import/loader option, npm prefix/cwd/workspace/config option, empty phase, nonzero expected exit, or manifest hash mismatch. Assert that the two start strategies cannot be structurally mixed. Mutate each Node CLI ABI literal and prove the schema rejects text/table success output, nonempty success stderr, success exit other than `0`, nonempty invalid stdout, `TITLE_REQUIRED` without its newline, invalid exit other than `2`, or disabled durable state. Construct all four finite product variants—inventory `/items`, appointments `/appointments`, reading queue `/queue`, and volunteer shifts `/shifts`—and reject every swapped route, selector ID, valid/invalid payload ID, expected response/state ID, required assertion tuple, profile, case, or extra field. Assert a `pass` product assertion is rejected with zero evidence refs, while `fail` and `unavailable` remain valid with an empty ref list.

Exercise the loader against the exact opened descriptor rather than a path precheck. A regular one-link finite campaign file in one approved non-writable mode parses. A final-component symlink fails at `open(O_RDONLY | O_NOFOLLOW)`; a directory, FIFO/device/socket, hardlink, executable/group-writable/world-writable file, empty file, and a file above `256 KiB` fail from the first `fstat` before parsing. Inject a rename/replacement and size/inode/mode change between the descriptor read and post-read `fstat`: the already opened bytes may never be substituted by the new pathname, and any descriptor identity/size/mode drift fails. Source-boundary tests reject `lstat`, `realpath`, path-based `readFile`, or a second open in `loadGoldenCampaignV1`.

Construct both valid path-free launch-intent members, their post-provision launch-execution bindings, durable starter-invocation-issued receipts, and authoritative start receipts. Each intent contains the code-owned positive `launchAttemptOrdinal`, complete `GoldenFinalReleaseEpochV1`, requires `releaseSha === finalReleaseEpoch.setfarmSha` and `releaseEpochHash === finalReleaseEpoch.epochHash`, and binds A's exact historical-baseline receipt hash plus Task 3A's canonical `recoveryContextRef/recoveryContextHash`; its start receipt repeats and equality-binds the ordinal and context pair. Recompute and assert every hash, then reject a changed/caller-skipped ordinal, changed/malformed epoch object/hash/release relation, changed historical-baseline receipt hash, changed/missing context pair, a full launch-task hash or pre-start set in the intent, unsorted/duplicate/more-than-64 binding IDs, changed logical correlation/context/full task/pre-start set/execution/issued/operation hash, strategy/preparation mismatch, changed canary-preparation/admission/fixture authority, start receipt not bound to the exact intent+context+execution+issued chain, mismatched run/workflow/protocol/release, and any selector token, raw task, absolute path, command, output, timestamp, or unknown field. The public issued/start receipts expose only path-free content identities and the operation hash; the raw task, fixture path, inherited-descriptor payload, and random claim secret are valid only inside the private mode-`0600` recovery-context or launch-operation stores and never parse through the launch/start schemas. Construct one valid path-free `GoldenExistingRepositoryFixtureAttemptV1` and require its attempt ordinal to equal the enclosing generic launch-attempt ordinal; reject a mismatched campaign/case/repetition/ordinal/epoch/intent/key/template/fixture/remote identity, a noncanonical repository URL or receipt ref, a changed provision hash, a local path, or an extra repository/template ref. Parse representative existing Setfarm refs including `setfarm://run/RUN_1`, `setfarm://run/RUN_1/step/final-test`, `setfarm://artifact/${"a".repeat(64)}`, and `setfarm://claim-log/17` through the exported `CanonicalRefSchema`; reject `http:`, `https:`, `file:`, bare paths, query/fragment syntax, whitespace, empty segments, and every non-`setfarm://` URI family. B's own source-boundary assertion proves this is the sole canonical-ref grammar in B and permits zero downstream consumers at B delivery time. Each later C/D/E suite must independently assert that its modules import this exact export, define no local regex, and use no second URI family; B never requires a future source file to exist before its own source PR can pass.

Construct a valid `GoldenFinalReleaseEpochV1`, require Git-object hashes for Setfarm and Mission Control, and recompute `epochHash = hashCanonicalJson({ schema, setfarmSha, missionControlSha })`. Reject a changed SHA/hash, extra field, timestamp, branch, version, dirty flag, or caller-authored epoch hash. Prove a result matches an epoch only when both exact release SHAs match; version strings or one matching SHA are insufficient.

Construct both strict `GoldenStartedRunStartV1` branches. Assert the V3 branch retains exact `feature-dev`/`v3` requested and actual identities, a numeric positive actual protocol version, null requested version/template/attempt, and a non-null admission binding. Assert the existing-repository branch retains equal bug-fix or security-audit requested/actual workflow identities, `workflow-default`, the stored actual protocol and numeric version, null requested version/admission, the immutable template hash, and the complete fresh attempt whose canonical full-object hash is `fixtureAttemptHash`. Mutate every common chain hash and strategy field; reject swapped requested/actual workflows, V3 actual protocol drift, a caller protocol version, partial/structurally cloned attempt, reused template identity, mixed admission/attempt authorities, nullability drift, string/fraction/zero actual versions, and unknown fields. Construct terminal and timeout `GoldenStartedRunResultV1` values from each branch, store/reopen/render them, and require byte-identical nested start authority and a changed start identity to change `resultHash`.

Construct one valid immutable timeout supersession from an original `kind:"run"`/`nonterminal-timeout` result and a later `kind:"run"`/`terminal-settlement` result for the exact same campaign, case, repetition, run ID/number, launch-attempt ordinal, release epoch, and complete `GoldenStartedRunStartV1`. Recompute its hash and reject either `pre_run` branch, a non-timeout original, nonterminal replacement, changed run/case/ordinal/epoch/start identity, a replacement without exact cleanup settlement, self-supersession, a second receipt for either result, unknown fields, or a rewritten original hash. The bare supersession is never mapper authority. Construct one strict `GoldenCommittedTimeoutReconciliationPairAuthorityV1` only from Task 6's fresh-read committed-pair resolver and require its campaign/supersession/original/terminal hashes, canonical `pairRef`/`pairHash`, exact result/supersession index successors, committed-pair index hash, and recomputed `authorityHash` to match. The contract module authenticates only producer/resolver-minted recursively frozen objects through a private nominal registry; a structural clone, schema-valid caller object, JSON round-trip, pair receipt without final index visibility, duplicate authority, or mismatched index cannot authenticate. Assert the effective mapper emits `reconciliation_required` for only the original, `terminal_replacement_selected` only for the exact original/terminal plus authenticated committed authority, and rejects a bare supersession/replacement, third result, conflicting pair, or uncommitted/forged authority. The raw supersession and both result bodies remain independently content-addressed report history, while policy consumes only the committed authority.

Construct strict standard and fleet `GoldenCampaignExecutionCapacityV1` values. Recompute `capacityHash` over every member except itself; require `configuredMaximum === campaign.maximumConcurrency`, `eligibleMaximum <= configuredMaximum`, no more than five sorted execution-order effective-result hashes, and `activeSameCampaignCount <= configuredMaximum`. Reject a hash drift, duplicate/reordered hash, a standard value configured/eligible at `2`, a fleet value configured above `2`, a negative/third active owner, epoch/campaign mismatch, timestamp, reason prose, caller capacity override, or unknown field. Task 1 defines only the immutable projection shape; Task 5 alone derives whether a fleet is eligible for two.

Task 1 source/type-identity tests require direct static imports from P0's two primitive modules, exact identity-preserving re-exports, and no local canonical-ref regex, root resolver, root override, or competing contained-store helper. They rerun P0's primitive tests but do not edit those files.

```typescript
const loaded = await loadGoldenCampaignV1(fixturePath);
assert.equal(loaded.campaign.schema, "setfarm.internal-production-golden-campaign.v1");
assert.equal(loaded.campaign.maximumConcurrency, 1);
assert.equal(loaded.campaign.rootCauseRepeatLimit, 3);
assert.deepEqual(loaded.campaign.settlementPolicy, {
  kind: "all-cases-required-accepted-v1",
});
assert.equal(loaded.campaign.cases.length, 1);
assert.equal(loaded.campaign.cases[0]?.profileId, "node-cli");
assert.deepEqual(loaded.campaign.cases[0]?.startStrategy, {
  kind: "v3-feature-dev-canary",
  workflowId: "feature-dev",
  requestedProtocol: "v3",
});
assert.equal(loaded.campaign.cases[0]?.requiredAcceptedResults, 1);
assert.equal(loaded.campaignHash, hashCanonicalJson(loaded.campaign));
assert.equal(
  loaded.caseHashes["node-cli-contract-fixture"],
  goldenCaseHashV1(loaded.campaign.cases[0]!),
);
assert.match(loaded.promptHashes["node-cli-contract-fixture"]!, /^[a-f0-9]{64}$/u);
assert.equal(
  loaded.admissionTaskHashes["node-cli-contract-fixture"],
  hashCanonicalJson(loaded.campaign.cases[0]!.task),
);
```

Construct every `GoldenPreflightResultV1` branch and both `GoldenRunResultV1` branches. Reject a blocked-before-authority value whose finite authority stage does not exactly match its null/non-null historical receipt, release, epoch, and capacity fields; reject an admitted result with any missing authority or blocker and a blocked-after-authority result with a missing authority or empty blockers. The release authority, admitted preflight, launch intent, start receipt, and started-run projection must carry one identical canonical Task 2 migration-release ref/hash, and the release authority additionally carries its exact schema-projection hash; omission, null, pair swap, source mismatch, or structural stand-in fails before hashing. A pre-run result must carry one exact blocked preflight, its code-owned positive launch-attempt ordinal, stable subject hash, primary finite preflight failure code, `campaign_configuration_failure`, a strict observed-zero ownership receipt, and literal null start/run/terminal/lifecycle/workflow-evidence members. Reject a fake run ID, start hash, epoch, capacity, cleanup packet, lifecycle receipt, assertion/workflow evidence, timestamp, PR, or nonzero/unavailable owner observation. A started-run result must carry `kind:"run"`, a positive launch-attempt ordinal, strict run ID/number and the existing complete run/evidence authority; it rejects every pre-run-only member. For each of the four API/Vite variants, change only one nested contract literal after subject assembly and prove the case hash, subject binding, assertion-contract hash, terminal evidence, and final result hash can no longer form an authentic chain. Rehash mutations to prove the `.strict()` union and constructor relations, and assert recursively parsed objects are frozen before crossing the contract boundary.

Pass an unknown, empty, malformed, or duplicate-resolving case selector through each public preflight/stage/execute CLI boundary. It must fail as `GOLDEN_ARGUMENT_CASE_UNKNOWN` during argument resolution, before constructing `GoldenPreflightResultCommonV1`, calling A/history/release/health/ownership ports, deriving repetition/ordinal, or performing any mutation. No unknown-case execution can emit a preflight/result hash or synthesize case ID/hash/profile/prompt fields.

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-contract-v1.test.ts
```

Expected: FAIL because `src/internal-production/golden-run-contract-v1.ts` does not exist.

- [ ] **Step 2A: Implement the shared private data-root resolver**

`resolveInternalProductionDataRootV1()` reads only `runtimeConfig.setfarmDir`, requires an absolute canonical Setfarm directory, opens/lstats each existing ancestor without following symlinks, and derives its `internal-production` child. When the child exists it must be a real mode-`0700` directory whose `realpath` is contained under the real Setfarm directory. When absent, read-only callers receive the derived path and an `exists:false` authority without allocation. Internal mutating helpers create one child at a time with mode `0700`, reopen/revalidate it, and never chmod or adopt an unsafe existing node. `resolveInternalProductionChildV1()` accepts only code-owned finite normalized segments. No exported production function accepts a root/config/cwd parameter; a test-only factory is neither exported nor wired by CLI.

- [ ] **Step 3: Add the exact test fixture**

Create `tests/fixtures/internal-production/golden-campaign-v1.json` with this content:

```json
{
  "schema": "setfarm.internal-production-golden-campaign.v1",
  "campaignId": "internal-production-contract-fixture",
  "campaignDate": "2026-08-13",
  "maximumConcurrency": 1,
  "rootCauseRepeatLimit": 3,
  "settlementPolicy": {
    "kind": "all-cases-required-accepted-v1"
  },
  "cases": [
    {
      "schema": "setfarm.internal-production-golden-case.v1",
      "caseId": "node-cli-contract-fixture",
      "profileId": "node-cli",
      "startStrategy": {
        "kind": "v3-feature-dev-canary",
        "workflowId": "feature-dev",
        "requestedProtocol": "v3"
      },
      "requiredAcceptedResults": 1,
      "task": "cli: Build an English local task register with add --title and list commands. Reject a missing or blank title with empty stdout, exit code 2, and stderr containing exactly TITLE_REQUIRED followed by one newline. For successful add and list invocations, emit one canonical JSON object per stdout line, emit no stderr, and exit 0. Persist records in the stack-contract-provided state location so a second list invocation can read the added task. Do not add a browser UI, network listener, fixed port, authentication, or external service.",
      "assertionContract": {
        "kind": "node-cli-task-register-v1",
        "successStdoutEncoding": "canonical-jsonl",
        "successStderr": "",
        "successExitCode": 0,
        "invalidTitleStdout": "",
        "invalidTitleStderr": "TITLE_REQUIRED\n",
        "invalidTitleExitCode": 2,
        "durableStateRequired": true,
        "requiredAssertionIds": [
          "cli-add-canonical-jsonl",
          "cli-list-canonical-jsonl",
          "cli-state-persists",
          "cli-title-required"
        ]
      },
      "expected": {
        "stackPackId": "node-cli",
        "designPolicy": "compiler-owned-none",
        "minimumStories": 1,
        "requiresStoryDependency": false,
        "terminalDelivery": "explicit-not-deployable",
        "requiredEvidenceKinds": ["build", "cli", "filesystem", "state", "test"]
      },
      "timeouts": {
        "runMs": 3600000,
        "pollMs": 5000,
        "projectionMs": 60000,
        "renderMs": 30000
      }
    }
  ]
}
```

- [ ] **Step 4: Implement the strict schemas, caps, and canonical constructors**

Define the finite public literals exactly:

```typescript
export const GoldenProfileIdV1Schema = z.enum([
  "node-cli",
  "node-express-api",
  "vite-react-web",
  "stateful-multipage-web",
  "interactive-browser-game",
  "existing-repository-bug-fix",
  "existing-repository-security-audit",
]);

export const GoldenClassificationV1Schema = z.enum([
  "accepted",
  "generated_product_failure",
  "setfarm_core_failure",
  "mission_control_failure",
  "provider_or_quota_failure",
  "infrastructure_failure",
  "campaign_configuration_failure",
]);

export const GoldenEvidenceKindV1Schema = z.enum([
  "accessibility",
  "build",
  "cli",
  "console",
  "dom",
  "filesystem",
  "http",
  "state",
  "test",
  "visual",
]);
```

Define the start-strategy union and fixture binding exactly:

```typescript
const GoldenFixtureMutablePathV1Schema = z.string().min(1).max(240).refine(
  (value) => {
    if (
      value.startsWith("/")
      || value.includes("\\")
      || value.includes("\0")
      || path.posix.normalize(value) !== value
    ) return false;
    const segments = value.split("/");
    return segments.every((segment, index) => (
      (
        segment !== "."
        && segment !== ".."
        && /^[A-Za-z0-9._-]+$/u.test(segment)
      )
      || (segment === "**" && index === segments.length - 1 && index > 0)
    ));
  },
  "fixture mutable paths must be normalized repository-relative POSIX paths or globs",
);

export const GoldenFixtureVerificationCommandIdV1Schema = z.enum([
  "bug-baseline-verifier-v1",
  "bug-post-verifier-v1",
  "security-baseline-verifier-v1",
  "security-post-verifier-v1",
]);

export const GoldenFixtureVerificationCommandV1Schema = z.object({
  commandId: GoldenFixtureVerificationCommandIdV1Schema,
  timeoutMs: z.number().int().min(1_000).max(600_000),
  expectedExitCode: z.literal(0),
}).strict();

export type GoldenFixtureVerificationCommandV1 = z.infer<
  typeof GoldenFixtureVerificationCommandV1Schema
>;

export const GoldenExistingRepositoryFixtureManifestV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-existing-repository-fixture-manifest.v1"),
  campaignId: SlugSchema,
  fixtureId: SlugSchema,
  seed: z.object({
    kind: z.enum(["bug-fix", "security-audit"]),
    seedHash: Sha256Schema,
  }).strict(),
  baselineSha: GitObjectHashSchema,
  baselineTreeHash: GitObjectHashSchema,
  branch: z.literal("main"),
  repositoryUrl: z.string().regex(
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
  ).refine((value) => !value.endsWith(".git"), "canonical GitHub URL omits .git"),
  remoteMainSha: GitObjectHashSchema,
  allowedMutablePaths: z.array(GoldenFixtureMutablePathV1Schema).min(1).max(64),
  preVerificationCommands: z.array(GoldenFixtureVerificationCommandV1Schema).min(1).max(8),
  postVerificationCommands: z.array(GoldenFixtureVerificationCommandV1Schema).min(1).max(8),
}).strict();

export type GoldenExistingRepositoryFixtureManifestV1 = z.infer<
  typeof GoldenExistingRepositoryFixtureManifestV1Schema
>;

export const GoldenExistingRepositoryFixtureIdentityV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-existing-repository-fixture.v1"),
  campaignId: SlugSchema,
  fixtureId: SlugSchema,
  fixtureHash: Sha256Schema,
  repositoryRef: z.string().regex(
    /^setfarm:\/\/internal-production-fixtures\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-f0-9]{64}$/u,
  ),
  baselineSha: GitObjectHashSchema,
  baselineTreeHash: GitObjectHashSchema,
  manifestHash: Sha256Schema,
  branch: z.literal("main"),
}).strict();

export const GoldenExistingRepositoryFixtureTemplateV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-existing-repository-fixture-template.v1"),
  campaignId: SlugSchema,
  templateId: z.enum([
    "internal-production-bug-fix",
    "internal-production-security-audit",
  ]),
  seedKind: z.enum(["bug-fix", "security-audit"]),
  seedHash: Sha256Schema,
  allowedMutablePathSetHash: Sha256Schema,
  preVerificationSetHash: Sha256Schema,
  postVerificationSetHash: Sha256Schema,
  templateRef: CanonicalRefSchema,
  templateHash: Sha256Schema,
}).strict();
export type GoldenExistingRepositoryFixtureTemplateV1 = z.infer<
  typeof GoldenExistingRepositoryFixtureTemplateV1Schema
>;

export const GoldenStartStrategyV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("v3-feature-dev-canary"),
    workflowId: z.literal("feature-dev"),
    requestedProtocol: z.literal("v3"),
  }).strict(),
  z.object({
    kind: z.literal("canonical-existing-repository-workflow"),
    workflowId: z.enum(["bug-fix", "security-audit"]),
    protocolRequest: z.literal("workflow-default"),
    fixtureTemplate: GoldenExistingRepositoryFixtureTemplateV1Schema,
  }).strict(),
]);
export type GoldenStartStrategyV1 = z.infer<typeof GoldenStartStrategyV1Schema>;
```

`GoldenExistingRepositoryFixtureManifestV1Schema.superRefine` requires sorted unique `allowedMutablePaths`, requires every path to equal its `path.posix.normalize` result, and rejects empty, `.`, `..`, absolute, backslash, NUL, repeated-separator, traversal, and non-final-glob segments before containment matching. A mutable entry is either one exact normalized file/directory path or one directory prefix ending in the final segment `/**`; no other wildcard syntax exists. The matcher accepts `candidate === entry` for exact entries and `candidate.startsWith(entry.slice(0, -2))` for `/**` entries only after the candidate passes the same strict schema and its `realpath` remains contained by the authenticated fixture root. Require `remoteMainSha === baselineSha`. `seedHash` is the SHA-256 of C's canonical seed-input bytes before materialization; B treats it as an opaque immutable identity and never infers it from repository changes. Commands contain no executable or argv: the observers module maps each `commandId` to one exact code-owned `node` invocation of the corresponding immutable contained `golden/verify-*.mjs` regular file. The map rejects a command ID for the wrong seed kind/phase and has no `node -e`, `--eval`, `-r`, `--require`, `--import`, `--loader`, or `NODE_OPTIONS` form and no npm `--prefix`, `--cwd`, `--workspace`, `--workspaces`, or `--config` form. No manifest/caller can select a command, argument, working directory, config, preload, or environment. The fixture port/harness binding requires `workflowId === manifest.seed.kind` when the manifest is resolved.

`fixture-manifest.json` is not tracked repository content. C first writes and commits the seeded baseline with the exact tracked `.gitignore` line `/fixture-manifest.json`, computes `baselineSha`, `baselineTreeHash`, and `remoteMainSha`, and only then writes the canonical manifest bytes as the mode-`0600` ignored sidecar `${repositoryPath}/fixture-manifest.json`. This order removes any self-referential commit/hash cycle.

P0's `CanonicalRefSchema` is the one public golden-harness reference grammar. Task 1 identity-re-exports that exact object/type without redeclaration. It preserves the `setfarm://` character family and `4_000`-byte bound already used by current Setfarm operational snapshot schemas; it admits no second scheme, query, fragment, whitespace, or empty segment. C assertion evidence, D lifecycle evidence, and E fleet/report eligibility import Task 1's exact identity re-export. They may add value-specific equality checks after parsing but may not widen it or define another canonical-ref schema. In particular, C must replace draft `artifact://internal-production/...` values with `setfarm://internal-production/artifacts/...`, D must emit `setfarm://internal-production/lifecycle-actions/...`, and E must emit `setfarm://internal-production/fleet-evidence/...`; no compatibility alias accepts `artifact://`.

`GoldenExistingRepositoryFixtureTemplateV1Schema.superRefine` recomputes the immutable template hash from every field except `templateHash` and requires `templateRef` to equal `setfarm://internal-production/fixture-templates/${campaignId}/${templateId}/${templateHash}`. The template identifies only C's checked-in immutable seed and bounded verification/scope sets; it contains no baseline commit/tree, manifest, repository URL, local path, Git directory, remote, or mutable sidecar. `seedKind` must correspond exactly to `templateId`. `GoldenCampaignV1Schema.superRefine` requires every template's `campaignId` to equal its containing campaign ID, preventing cross-campaign reuse. V3 feature development has no fixture-template member; existing-repository workflow has no requested-protocol or admission member. After the launch intent is durably persisted, the authenticated attempt-provisioning port creates one fresh attempt repository/remote and its manifest from the immutable template, and only the existing-repository launcher resolves that attempt capability to a local path and appends exact `--repo` and `--branch main` bytes. A used attempt repository is never reset, reused, deleted, or treated as the template.

Task 1 owns the exact shared schemas and nominal TypeScript types for `GoldenLaunchIntentV1`, `GoldenPersistedLaunchIntentV1`, `GoldenLaunchExecutionBindingV1`, `GoldenStarterInvocationIssuedV1`, and `GoldenRunStartReceiptV1`; Tasks 3/3A and every C consumer import those exact exports and never redeclare a competing shape. The launch intent is deliberately path-free and pre-provision: it persists the complete `finalReleaseEpoch`, requires `releaseSha === finalReleaseEpoch.setfarmSha` and `releaseEpochHash === finalReleaseEpoch.epochHash`, binds A's `historicalBaselineReceiptHash`, binds the freshly reopened Task 2 `goldenLaunchMigrationReceiptRef/goldenLaunchMigrationReceiptHash`, immutable application source SHA, current-verification hash, and schema-projection hash, binds Task 3A's exact `recoveryContextRef/recoveryContextHash`, binds `promptHash`, and binds one strategy-matching preparation. It computes `preparationAuthorityHash = hashCanonicalJson(preparation)` and `logicalLaunchCorrelationHash = hashCanonicalJson({ campaignHash, caseId, caseHash, repetition, releaseSha, finalReleaseEpoch, releaseEpochHash, preflightHash, historicalBaselineReceiptHash, goldenLaunchMigrationReceiptRef, goldenLaunchMigrationReceiptHash, goldenLaunchMigrationApplicationSourceSha, goldenLaunchMigrationCurrentVerificationHash, goldenLaunchMigrationSchemaProjectionHash, recoveryContextRef, recoveryContextHash, strategyKind, promptHash, preparationAuthorityHash })`, then recomputes `intentHash` over every member except itself. It contains no full launch-task hash and no pre-start run set because an existing-repository path does not exist yet. The private authenticated launch envelope stores this complete intent, not a mutable current-release lookup key. After provisioning, `GoldenLaunchExecutionBindingV1Schema.superRefine` requires sorted unique `preStartMatchingRunIds` capped at `64`, recomputes `preStartRunSetHash`, equality-binds the intent/logical correlation/context/strategy, requires `fixtureAttemptHash` exactly null for V3 and exactly `hashCanonicalJson(boundAttempt)` for existing-repository, and recomputes `executionBindingHash`. Every pre-start authorization receipt repeats `recoveryContextHash` and derives `caseContextHash` from the authenticated context's campaign/case/profile/repetition/full epoch/prior-result projection plus the execution binding. `GoldenStarterInvocationIssuedV1Schema.superRefine` requires exactly one strategy-matching admission/attempt hash, requires `fixturePreVerificationHash` null for V3 and equal to the authenticated baseline-verification receipt for existing-repository, equality-binds the recovery context, persisted authorization, and execution binding, derives `starterOperationHash` from that complete path-free operation projection, requires `issued:true`, and recomputes `issuedReceiptHash`. The private outbox at the fixed operation-hash path additionally binds those receipt bytes to the exact internal start request, request hash, random claim-secret hash, and terminal migration-release pair. The start receipt recomputes its hash; requires its complete `finalReleaseEpoch`, `historicalBaselineReceiptHash`, golden-launch terminal pair/application SHA/current-verification/schema hashes, and recovery-context pair to equal the intent; and equality-binds logical correlation, context, execution binding, issued receipt/operation, full task, pre-start set, strategy/workflow/preparation, authorization, admission-or-attempt, fixture-preverification, and atomically claimed run-row authorities. None of these strict public receipts contains a selector, path, raw task, claim secret, descriptor, command, output, environment, timestamp, or prose.

Task 1 also owns the sole policy-free `deriveEffectiveGoldenRunResultsV1()` implementation because Task 5 preflight must use it before Task 6 exists. It validates the strict result union and nominal committed timeout-pair authorities; it never accepts a raw supersession array. A `pre_run` value emits one immutable `kind:"pre_run"` mapping keyed by its exact stable subject/launch-attempt ordinal and can never appear in a timeout pair. A terminal run without a timeout emits `timeoutReconciliation:{kind:"not_required",...null}`. One stored nonterminal-timeout original with no authenticated committed authority is a legal immutable `timeoutReconciliation.kind:"reconciliation_required"` mapping: its original remains the report-visible effective row, but it cannot satisfy a terminal, acceptance, cleanup, first-five, or capacity threshold. One exact same-subject terminal result plus its unique authenticated committed authority emits `kind:"terminal_replacement_selected"` and selects only that terminal result for policy; the authority's private authenticated resolver binding supplies the exact raw supersession relation. The mapper rejects a bare second same-subject result, raw or structural supersession, terminal replacement not joined by the final committed index, third result, two authorities for either result, cross-subject use, and conflicting original/replacement use. It never counts a timeout original and replacement as two policy occurrences. The projection partitions pre-run history from current/historical effective started runs so acceptance, terminal counts, and capacity cannot accidentally consume pre-run values. Task 6 imports and re-exports this exact function/type identity and uses the contract module's restricted internal mint boundary; it does not redeclare or reimplement the mapper/authority.

Define the assertion contract union:

```typescript
export const GoldenProductAssertionContractV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("node-cli-task-register-v1"),
    successStdoutEncoding: z.literal("canonical-jsonl"),
    successStderr: z.literal(""),
    successExitCode: z.literal(0),
    invalidTitleStdout: z.literal(""),
    invalidTitleStderr: z.literal("TITLE_REQUIRED\n"),
    invalidTitleExitCode: z.literal(2),
    durableStateRequired: z.literal(true),
    requiredAssertionIds: z.tuple([
      z.literal("cli-add-canonical-jsonl"),
      z.literal("cli-list-canonical-jsonl"),
      z.literal("cli-state-persists"),
      z.literal("cli-title-required"),
    ]),
  }).strict(),
  z.object({
    kind: z.literal("node-api-resource-crud-v1"),
    resource: z.discriminatedUnion("contractId", [
      z.object({
        contractId: z.literal("inventory-items-v1"),
        collectionPath: z.literal("/items"),
        validPayloadId: z.literal("inventory-item-title-v1"),
        invalidPayloadId: z.literal("inventory-item-blank-title-v1"),
        expectedResponseId: z.literal("inventory-item-crud-response-v1"),
      }).strict(),
      z.object({
        contractId: z.literal("appointments-v1"),
        collectionPath: z.literal("/appointments"),
        validPayloadId: z.literal("appointment-scheduled-at-v1"),
        invalidPayloadId: z.literal("appointment-missing-scheduled-at-v1"),
        expectedResponseId: z.literal("appointment-crud-response-v1"),
      }).strict(),
    ]),
    requiredAssertionIds: z.tuple([
      z.literal("api-health-json"),
      z.literal("api-crud-roundtrip"),
      z.literal("api-validation-json"),
      z.literal("api-state-persists"),
    ]),
  }).strict(),
  z.object({
    kind: z.literal("vite-react-workflow-v1"),
    workflow: z.discriminatedUnion("contractId", [
      z.object({
        contractId: z.literal("reading-queue-v1"),
        routePath: z.literal("/queue"),
        inputSelectorId: z.literal("reading-queue-title-input-v1"),
        submitSelectorId: z.literal("reading-queue-add-button-v1"),
        stateSelectorId: z.literal("reading-queue-list-v1"),
        validPayloadId: z.literal("reading-queue-entry-v1"),
        expectedStateId: z.literal("reading-queue-persisted-entry-v1"),
      }).strict(),
      z.object({
        contractId: z.literal("volunteer-shifts-v1"),
        routePath: z.literal("/shifts"),
        inputSelectorId: z.literal("volunteer-shift-name-input-v1"),
        submitSelectorId: z.literal("volunteer-shift-add-button-v1"),
        stateSelectorId: z.literal("volunteer-shift-list-v1"),
        validPayloadId: z.literal("volunteer-shift-entry-v1"),
        expectedStateId: z.literal("volunteer-shift-persisted-entry-v1"),
      }).strict(),
    ]),
    requiredAssertionIds: z.tuple([
      z.literal("web-route-navigation"),
      z.literal("web-form-validation"),
      z.literal("web-keyboard-accessible"),
      z.literal("web-state-persists"),
      z.literal("web-console-clean"),
    ]),
  }).strict(),
  z.object({
    kind: z.literal("profile-owned-v1"),
    adapterId: SlugSchema,
    requiredAssertionIds: z.array(SlugSchema).min(1).max(64).refine(hasUniqueStrings),
  }).strict(),
]);

export const GoldenProductAssertionV1Schema = z.object({
  assertionId: SlugSchema,
  evidenceKind: GoldenEvidenceKindV1Schema,
  verdict: z.enum(["pass", "fail", "unavailable"]),
  evidenceRefs: z.array(CanonicalRefSchema).max(64).refine(hasUniqueStrings),
}).strict();

export const GoldenProductAssertionSetV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-product-assertion-set.v1"),
  adapterId: SlugSchema,
  adapterHash: Sha256Schema,
  assertionContractHash: Sha256Schema,
  assertions: z.array(GoldenProductAssertionV1Schema).min(1).max(64),
  assertionSetHash: Sha256Schema,
}).strict();

const GoldenCaseCountV1Schema = z.object({
  caseId: SlugSchema,
  count: z.number().int().min(0).max(64),
}).strict();

export const GoldenFinalReleaseEpochV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-final-release-epoch.v1"),
  setfarmSha: GitObjectHashSchema,
  missionControlSha: GitObjectHashSchema,
  epochHash: Sha256Schema,
}).strict();

export function createGoldenFinalReleaseEpochV1(input: Readonly<{
  setfarmSha: string;
  missionControlSha: string;
}>): GoldenFinalReleaseEpochV1;

export const GoldenExistingRepositoryFixtureAttemptV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-existing-repository-fixture-attempt.v1"),
  campaignHash: Sha256Schema,
  caseId: SlugSchema,
  repetition: z.union([z.literal(1), z.literal(2)]),
  attemptOrdinal: z.number().int().min(1).max(64),
  finalReleaseEpoch: GoldenFinalReleaseEpochV1Schema,
  intentHash: Sha256Schema,
  attemptKeyHash: Sha256Schema,
  templateHash: Sha256Schema,
  fixture: GoldenExistingRepositoryFixtureIdentityV1Schema,
  repositoryUrl: z.string().regex(
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
  ).refine((value) => !value.endsWith(".git"), "canonical GitHub URL omits .git"),
  remoteMainSha: GitObjectHashSchema,
  receiptRef: CanonicalRefSchema,
  provisionHash: Sha256Schema,
}).strict();

export type GoldenExistingRepositoryFixtureAttemptV1 = z.infer<
  typeof GoldenExistingRepositoryFixtureAttemptV1Schema
>;

const GoldenLaunchPreparationV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("v3-canary-launch-preparation"),
    preparationIdHash: Sha256Schema,
    selectorSecretRecordHash: Sha256Schema,
    selectorTokenHash: Sha256Schema,
    admissionRequestHash: Sha256Schema,
  }).strict(),
  z.object({
    kind: z.literal("existing-repository-fixture-attempt"),
    templateHash: Sha256Schema,
    templateRef: CanonicalRefSchema,
    attemptOrdinal: z.number().int().min(1).max(64),
    attemptKeyHash: Sha256Schema,
  }).strict(),
]);

export const GoldenLaunchIntentV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-golden-launch-intent.v1"),
  campaignHash: Sha256Schema,
  caseId: SlugSchema,
  caseHash: Sha256Schema,
  repetition: z.union([z.literal(1), z.literal(2)]),
  launchAttemptOrdinal: z.number().int().min(1).max(64),
  releaseSha: GitObjectHashSchema,
  finalReleaseEpoch: GoldenFinalReleaseEpochV1Schema,
  releaseEpochHash: Sha256Schema,
  preflightHash: Sha256Schema,
  historicalBaselineReceiptHash: Sha256Schema,
  goldenLaunchMigrationReceiptRef: CanonicalRefSchema,
  goldenLaunchMigrationReceiptHash: Sha256Schema,
  goldenLaunchMigrationApplicationSourceSha: GitObjectHashSchema,
  goldenLaunchMigrationCurrentVerificationHash: Sha256Schema,
  goldenLaunchMigrationSchemaProjectionHash: Sha256Schema,
  recoveryContextRef: CanonicalRefSchema,
  recoveryContextHash: Sha256Schema,
  strategyKind: z.enum([
    "v3-feature-dev-canary",
    "canonical-existing-repository-workflow",
  ]),
  promptHash: Sha256Schema,
  preparation: GoldenLaunchPreparationV1Schema,
  preparationAuthorityHash: Sha256Schema,
  logicalLaunchCorrelationHash: Sha256Schema,
  nonceHash: Sha256Schema,
  intentHash: Sha256Schema,
}).strict();
export type GoldenLaunchIntentV1 = z.infer<typeof GoldenLaunchIntentV1Schema>;

export type GoldenPersistedLaunchIntentV1 = Readonly<{
  kind: "authenticated-persisted-golden-launch-intent";
  intent: GoldenLaunchIntentV1;
  persistedEnvelopeHash: string;
}>;

export const GoldenLaunchExecutionBindingV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-golden-launch-execution-binding.v1"),
  intentHash: Sha256Schema,
  logicalLaunchCorrelationHash: Sha256Schema,
  recoveryContextHash: Sha256Schema,
  strategyKind: z.enum([
    "v3-feature-dev-canary",
    "canonical-existing-repository-workflow",
  ]),
  fullLaunchTaskHash: Sha256Schema,
  preStartMatchingRunIds: z.array(z.string().min(1).max(160)).max(64),
  preStartRunSetHash: Sha256Schema,
  fixtureAttemptHash: Sha256Schema.nullable(),
  executionBindingHash: Sha256Schema,
}).strict();
export type GoldenLaunchExecutionBindingV1 = z.infer<
  typeof GoldenLaunchExecutionBindingV1Schema
>;

export const GoldenStarterInvocationIssuedV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-golden-starter-invocation-issued.v1"),
  intentHash: Sha256Schema,
  recoveryContextHash: Sha256Schema,
  capacityReservationHash: Sha256Schema,
  executionBindingHash: Sha256Schema,
  strategyKind: z.enum([
    "v3-feature-dev-canary",
    "canonical-existing-repository-workflow",
  ]),
  fullLaunchTaskHash: Sha256Schema,
  preStartAuthorizationReceiptHash: Sha256Schema,
  admissionBindingHash: Sha256Schema.nullable(),
  fixtureAttemptHash: Sha256Schema.nullable(),
  fixturePreVerificationHash: Sha256Schema.nullable(),
  starterOperationHash: Sha256Schema,
  issued: z.literal(true),
  issuedReceiptHash: Sha256Schema,
}).strict();
export type GoldenStarterInvocationIssuedV1 = z.infer<
  typeof GoldenStarterInvocationIssuedV1Schema
>;

export const GoldenRunStartReceiptV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-golden-run-start-receipt.v1"),
  intentHash: Sha256Schema,
  logicalLaunchCorrelationHash: Sha256Schema,
  launchAttemptOrdinal: z.number().int().min(1).max(64),
  finalReleaseEpoch: GoldenFinalReleaseEpochV1Schema,
  historicalBaselineReceiptHash: Sha256Schema,
  goldenLaunchMigrationReceiptRef: CanonicalRefSchema,
  goldenLaunchMigrationReceiptHash: Sha256Schema,
  goldenLaunchMigrationApplicationSourceSha: GitObjectHashSchema,
  goldenLaunchMigrationCurrentVerificationHash: Sha256Schema,
  goldenLaunchMigrationSchemaProjectionHash: Sha256Schema,
  recoveryContextRef: CanonicalRefSchema,
  recoveryContextHash: Sha256Schema,
  capacityReservationHash: Sha256Schema,
  executionBindingHash: Sha256Schema,
  starterInvocationIssuedReceiptHash: Sha256Schema,
  starterOperationHash: Sha256Schema,
  strategyKind: z.enum([
    "v3-feature-dev-canary",
    "canonical-existing-repository-workflow",
  ]),
  runId: z.string().min(1).max(160),
  runNumber: z.number().int().positive(),
  workflowId: z.enum(["feature-dev", "bug-fix", "security-audit"]),
  actualProtocol: z.string().min(1).max(80),
  actualProtocolVersion: z.number().int().positive(),
  fullLaunchTaskHash: Sha256Schema,
  preStartRunSetHash: Sha256Schema,
  preparationAuthorityHash: Sha256Schema,
  preStartAuthorizationReceiptHash: Sha256Schema,
  admissionBindingHash: Sha256Schema.nullable(),
  fixtureAttemptHash: Sha256Schema.nullable(),
  fixturePreVerificationHash: Sha256Schema.nullable(),
  authoritativeRunRowHash: Sha256Schema,
  invocationReceiptHash: Sha256Schema.nullable(),
  startReceiptHash: Sha256Schema,
}).strict();
export type GoldenRunStartReceiptV1 = z.infer<typeof GoldenRunStartReceiptV1Schema>;

export const GoldenTimeoutTerminalSupersessionV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-timeout-terminal-supersession.v1"),
  campaignHash: Sha256Schema,
  caseId: SlugSchema,
  repetition: z.union([z.literal(1), z.literal(2)]),
  launchAttemptOrdinal: z.number().int().min(1).max(64),
  runId: z.string().min(1).max(160),
  runNumber: z.number().int().positive(),
  releaseEpochHash: Sha256Schema,
  originalTimeoutResultHash: Sha256Schema,
  terminalResultHash: Sha256Schema,
  sameRunIdentity: z.literal(true),
  terminalCleanupExactlySettled: z.literal(true),
  reconciliationEvidenceHash: Sha256Schema,
  supersessionHash: Sha256Schema,
}).strict();

export type GoldenTimeoutTerminalSupersessionV1 = z.infer<
  typeof GoldenTimeoutTerminalSupersessionV1Schema
>;

export const GoldenCommittedTimeoutReconciliationPairAuthorityV1Schema = z.object({
  schema: z.literal(
    "setfarm.internal-production-committed-timeout-reconciliation-pair-authority.v1",
  ),
  campaignHash: Sha256Schema,
  supersessionHash: Sha256Schema,
  originalTimeoutResultHash: Sha256Schema,
  terminalResultHash: Sha256Schema,
  pairRef: CanonicalRefSchema,
  pairHash: Sha256Schema,
  resultIndexHash: Sha256Schema,
  supersessionIndexHash: Sha256Schema,
  committedPairIndexHash: Sha256Schema,
  authorityHash: Sha256Schema,
}).strict();

export type GoldenCommittedTimeoutReconciliationPairAuthorityV1 = z.infer<
  typeof GoldenCommittedTimeoutReconciliationPairAuthorityV1Schema
>;

export function authenticateGoldenCommittedTimeoutReconciliationPairAuthorityV1(
  value: unknown,
): GoldenCommittedTimeoutReconciliationPairAuthorityV1;

export type GoldenTimeoutReconciliationSelectionV1 =
  | Readonly<{
      kind: "not_required";
      originalTimeoutResultHash: null;
      terminalReplacementResultHash: null;
      supersessionHash: null;
      committedPairAuthorityHash: null;
      pairRef: null;
      pairHash: null;
    }>
  | Readonly<{
      kind: "reconciliation_required";
      originalTimeoutResultHash: string;
      terminalReplacementResultHash: null;
      supersessionHash: null;
      committedPairAuthorityHash: null;
      pairRef: null;
      pairHash: null;
    }>
  | Readonly<{
      kind: "terminal_replacement_selected";
      originalTimeoutResultHash: string;
      terminalReplacementResultHash: string;
      supersessionHash: string;
      committedPairAuthorityHash: string;
      pairRef: CanonicalRef;
      pairHash: string;
    }>;

export type GoldenEffectiveResultMappingV1 =
  | Readonly<{
      kind: "pre_run";
      caseId: string;
      repetition: 1 | 2;
      subject: Readonly<{
        kind: "pre_run";
        stableSubjectHash: string;
        launchAttemptOrdinal: number;
      }>;
      originalResultHash: string;
      effectiveResultHash: string;
      mappingHash: string;
    }>
  | Readonly<{
      kind: "run";
      caseId: string;
      repetition: 1 | 2;
      subject: Readonly<{
        kind: "run";
        runId: string;
        runNumber: number;
      }>;
      originalResultHash: string;
      terminalReplacementResultHash: string | null;
      effectiveResultHash: string;
      timeoutReconciliation: GoldenTimeoutReconciliationSelectionV1;
      epochPartition: "current" | "historical";
      mappingHash: string;
    }>;

export type GoldenEffectiveRunResultProjectionV1 = Readonly<{
  schema: "setfarm.internal-production-effective-golden-run-results.v1";
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  mappings: readonly GoldenEffectiveResultMappingV1[];
  preRunResults: readonly GoldenPreRunResultV1[];
  currentEpochEffectiveResults: readonly GoldenStartedRunResultV1[];
  historicalEffectiveResults: readonly GoldenStartedRunResultV1[];
  projectionHash: string;
}>;

export function deriveEffectiveGoldenRunResultsV1(input: Readonly<{
  campaign: GoldenCampaignV1;
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  results: readonly GoldenRunResultV1[];
  timeoutReconciliations:
    readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[];
}>): GoldenEffectiveRunResultProjectionV1;

export type GoldenCampaignExecutionCapacityV1 = Readonly<{
  schema: "setfarm.internal-production-golden-campaign-execution-capacity.v1";
  campaignHash: string;
  epochHash: string;
  configuredMaximum: 1 | 2;
  eligibleMaximum: 1 | 2;
  activeSameCampaignCount: number;
  firstFiveEffectiveResultHashes: readonly string[];
  capacityHash: string;
}>;

export const GoldenCampaignExecutionCapacityV1Schema:
  z.ZodType<GoldenCampaignExecutionCapacityV1> = z.object({
  schema: z.literal("setfarm.internal-production-golden-campaign-execution-capacity.v1"),
  campaignHash: Sha256Schema,
  epochHash: Sha256Schema,
  configuredMaximum: z.union([z.literal(1), z.literal(2)]),
  eligibleMaximum: z.union([z.literal(1), z.literal(2)]),
  activeSameCampaignCount: z.number().int().min(0).max(2),
  firstFiveEffectiveResultHashes: z.array(Sha256Schema).max(5).refine(hasUniqueStrings),
  capacityHash: Sha256Schema,
}).strict();

export type GoldenPreflightCheckV1 = Readonly<{
  checkId:
    | "historical-baseline"
    | "release-authority"
    | "final-release-epoch"
    | "source-cleanliness"
    | "compiler-build"
    | "workflow"
    | "migration"
    | "artifact-index"
    | "service-health"
    | "active-ownership"
    | "execution-capacity"
    | "systemic-repeat-limit";
  verdict: "pass" | "blocked" | "unavailable";
  reasonCode: GoldenPreflightFailureCodeV1 | null;
  evidenceHash: string | null;
}>;

export type GoldenPreflightHistoricalBaselineAuthorityV1 = Readonly<{
  canonicalRef: "setfarm://internal-production/baseline/post-handoff";
  receiptHash: string;
  operationalSourceSha: string;
  finalDocumentationSha: string;
  missionControlSourceSha: string;
}>;

export type GoldenPreflightReleaseAuthorityV1 = Readonly<{
  setfarmSha: string;
  missionControlSha: string;
  setfarmVersion: string;
  missionControlVersion: string;
  workflowHash: string;
  compilerSha: string;
  runnerHash: string;
  environmentHash: string;
  goldenLaunchMigrationReceiptRef: CanonicalRef;
  goldenLaunchMigrationReceiptHash: string;
  goldenLaunchMigrationApplicationSourceSha: string;
  goldenLaunchMigrationCurrentVerificationHash: string;
  goldenLaunchMigrationSchemaProjectionHash: string;
  releaseAuthorityHash: string;
}>;

export type GoldenPreflightOwnershipObservationV1 = Readonly<{
  activeSameCampaignCount: number;
  unrelatedActiveOwnerCount: number;
  unattributedActiveOwnerCount: number;
  globalOwnerCount: number;
  observedZero: boolean;
  observationHash: string;
}>;

type GoldenPreflightResultCommonV1 = Readonly<{
  schema: "setfarm.internal-production-golden-preflight-result.v1";
  campaignHash: string;
  caseId: string;
  caseHash: string;
  repetition: 1 | 2;
  launchAttemptOrdinal: number;
  checks: readonly GoldenPreflightCheckV1[];
  ownershipObservation: GoldenPreflightOwnershipObservationV1;
  preflightHash: string;
}>;

export type GoldenPreflightResultV1 =
  | (GoldenPreflightResultCommonV1 & Readonly<{
      kind: "blocked-before-authority";
      authorityStage: "historical-baseline" | "release" | "epoch" | "capacity";
      historicalBaseline: GoldenPreflightHistoricalBaselineAuthorityV1 | null;
      releaseAuthority: GoldenPreflightReleaseAuthorityV1 | null;
      finalReleaseEpoch: GoldenFinalReleaseEpochV1 | null;
      executionCapacity: GoldenCampaignExecutionCapacityV1 | null;
      blockerCodes: readonly GoldenPreflightFailureCodeV1[];
    }>)
  | (GoldenPreflightResultCommonV1 & Readonly<{
      kind: "blocked-after-authority";
      authorityStage: "complete";
      historicalBaseline: GoldenPreflightHistoricalBaselineAuthorityV1;
      releaseAuthority: GoldenPreflightReleaseAuthorityV1;
      finalReleaseEpoch: GoldenFinalReleaseEpochV1;
      executionCapacity: GoldenCampaignExecutionCapacityV1;
      blockerCodes: readonly GoldenPreflightFailureCodeV1[];
    }>)
  | (GoldenPreflightResultCommonV1 & Readonly<{
      kind: "admitted";
      authorityStage: "complete";
      historicalBaseline: GoldenPreflightHistoricalBaselineAuthorityV1;
      releaseAuthority: GoldenPreflightReleaseAuthorityV1;
      finalReleaseEpoch: GoldenFinalReleaseEpochV1;
      executionCapacity: GoldenCampaignExecutionCapacityV1;
      blockerCodes: readonly [];
    }>);

export const GoldenPreflightResultV1Schema:
  z.ZodType<GoldenPreflightResultV1>;

export const GoldenPreStartAuthorizationReceiptV1Schema = z.discriminatedUnion(
  "decision",
  [
    z.object({
      schema: z.literal("setfarm.internal-production-pre-start-authorization.v1"),
      intentHash: Sha256Schema,
      recoveryContextHash: Sha256Schema,
      caseContextHash: Sha256Schema,
      authorizerId: z.literal("default-golden-pre-start-authorizer"),
      authorizerHash: Sha256Schema,
      decision: z.literal("not_required"),
      reason: z.literal("no-prior-repair-candidate"),
      receiptHash: Sha256Schema,
    }).strict(),
    z.object({
      schema: z.literal("setfarm.internal-production-pre-start-authorization.v1"),
      intentHash: Sha256Schema,
      recoveryContextHash: Sha256Schema,
      caseContextHash: Sha256Schema,
      authorizerId: z.literal("golden-repair-cas-v1"),
      authorizerHash: Sha256Schema,
      decision: z.literal("authorized"),
      authorizationEvidenceHash: Sha256Schema,
      receiptHash: Sha256Schema,
    }).strict(),
    z.object({
      schema: z.literal("setfarm.internal-production-pre-start-authorization.v1"),
      intentHash: Sha256Schema,
      recoveryContextHash: Sha256Schema,
      caseContextHash: Sha256Schema,
      authorizerId: z.enum([
        "default-golden-pre-start-authorizer",
        "golden-repair-cas-v1",
      ]),
      authorizerHash: Sha256Schema,
      decision: z.literal("denied"),
      reasonCode: z.enum([
        "GOLDEN_REPAIR_AUTHORIZATION_REQUIRED",
        "GOLDEN_PRESTART_AUTHORIZATION_DENIED",
      ]),
      receiptHash: Sha256Schema,
    }).strict(),
  ],
);

export type GoldenPreStartAuthorizationReceiptV1 = z.infer<
  typeof GoldenPreStartAuthorizationReceiptV1Schema
>;

export const GoldenCampaignSettlementPolicyV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("all-cases-required-accepted-v1"),
  }).strict(),
  z.object({
    kind: z.literal("fleet-threshold-v1"),
    requiredTerminalResults: z.literal(10),
    minimumAcceptedResults: z.literal(8),
    allowedNonAcceptedClassifications: z.tuple([
      z.literal("generated_product_failure"),
      z.literal("provider_or_quota_failure"),
      z.literal("infrastructure_failure"),
    ]),
    requireEveryResultCleanupSettled: z.literal(true),
    rejectSystemicClassifications: z.literal(true),
  }).strict(),
]);

export const GoldenReasonCodeV1Schema = ReasonCodeSchema;
export type GoldenReasonCodeV1 = z.infer<typeof GoldenReasonCodeV1Schema>;

export const GoldenCampaignSettlementV1Schema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("in_progress"),
    finalReleaseEpoch: GoldenFinalReleaseEpochV1Schema,
    policyKind: z.enum([
      "all-cases-required-accepted-v1",
      "fleet-threshold-v1",
    ]),
    missingAcceptedByCase: z.array(GoldenCaseCountV1Schema).max(16),
    blockerCodes: z.array(GoldenReasonCodeV1Schema).max(64).refine(hasUniqueStrings),
  }).strict(),
  z.object({
    status: z.literal("complete"),
    finalReleaseEpoch: GoldenFinalReleaseEpochV1Schema,
    policy: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("all-cases-required-accepted-v1"),
        acceptedByCase: z.array(GoldenCaseCountV1Schema).min(1).max(16),
      }).strict(),
      z.object({
        kind: z.literal("fleet-threshold-v1"),
        terminalResultCount: z.literal(10),
        acceptedResultCount: z.number().int().min(8).max(10),
        nonAcceptedByClassification: z.tuple([
          z.object({ classification: z.literal("generated_product_failure"), count: z.number().int().min(0).max(2) }).strict(),
          z.object({ classification: z.literal("provider_or_quota_failure"), count: z.number().int().min(0).max(2) }).strict(),
          z.object({ classification: z.literal("infrastructure_failure"), count: z.number().int().min(0).max(2) }).strict(),
        ]),
        everyResultCleanupSettled: z.literal(true),
        systemicResultCount: z.literal(0),
      }).strict(),
    ]),
    settlementHash: Sha256Schema,
  }).strict(),
  z.object({
    status: z.literal("blocked"),
    finalReleaseEpoch: GoldenFinalReleaseEpochV1Schema,
    policyKind: z.enum([
      "all-cases-required-accepted-v1",
      "fleet-threshold-v1",
    ]),
    repeatedSystemicRootCauseHash: Sha256Schema,
    occurrenceCount: z.literal(3),
    settlementHash: Sha256Schema,
  }).strict(),
]);
```

`GoldenReasonCodeV1Schema` exports the existing finite code-owned `ReasonCodeSchema` identity and Task 1 adds exact member `GOLDEN_PRE_RUN_CONFIGURATION_FAILURE_RECORDED`; no result, CLI, C adapter, or report can supply an arbitrary B blocker string. `GoldenCampaignSettlementV1Schema.superRefine` recomputes `finalReleaseEpoch.epochHash`, requires the fleet non-accepted tuple counts to sum to `10 - acceptedResultCount`, and binds every settlement hash to the full epoch object. A current-epoch fleet result outside the three allowed non-accepted classifications cannot form `complete`; historical-epoch results cannot satisfy or obstruct the current acceptance threshold except through one selected effective result per mapping in cumulative exact-root blocking and mandatory cleanup validation. Standard completion has no fleet aggregate fields, and fleet completion has no per-case accepted-count substitute.

`GoldenPreflightResultV1Schema` implements each branch as a `.strict()` object and recomputes `preflightHash` over every member except itself. Checks appear once in the fixed `checkId` order and use code-owned reason precedence. `pass` requires `reasonCode:null` plus one authentic evidence hash; `blocked|unavailable` requires a finite reason and retains an authentic evidence hash only when an observation actually exists. The ownership observation is always real: `observedZero` is true exactly when all four bounded counts are zero, and its hash is recomputed. `blocked-before-authority` requires one or more blocker codes and these exact prefix relations: `historical-baseline` has all four authorities null; `release` has only historical baseline non-null; `epoch` has historical baseline and release non-null; `capacity` additionally has the full epoch non-null. `blocked-after-authority` requires every authority non-null plus one or more blockers. `admitted` requires every authority non-null, no blocker, all required checks passing, campaign/case/repetition/ordinal equality, `releaseAuthority.setfarmSha === finalReleaseEpoch.setfarmSha`, `releaseAuthority.missionControlSha === finalReleaseEpoch.missionControlSha`, the release authority's golden-launch migration pair and schema projection to equal the freshly reopened Task 2 terminal receipt, and the capacity campaign/epoch hashes equal to that exact authority. No branch invents a zero hash, placeholder epoch, placeholder capacity, empty A receipt, migration pair, or release identity after the responsible observation was unavailable.

`GoldenExistingRepositoryFixtureAttemptV1Schema.superRefine` recomputes the final epoch hash, requires `fixture.baselineSha === remoteMainSha`, recomputes `provisionHash` over every member except `receiptRef` and `provisionHash`, and requires `receiptRef` to equal `setfarm://internal-production/fixture-attempts/${campaignHash}/${attemptKeyHash}/${provisionHash}`. The nested fixture is the sole repository-ref identity; the attempt adds no duplicate `repositoryRef`, no `templateRef`, no provisioning-operation receipt, and no local path. The harness equality-binds `templateHash` to the intent preparation and catalog template, requires `fixture.campaignId` to match that template's campaign, and binds intent/campaign/case/repetition/attempt ordinal/key/final epoch before the receipt can enter the phase store or result. C's pre-create provisioning operation remains a private producer authority and equality-binds this public receipt without widening B's stable attempt ABI.

`GoldenPreStartAuthorizationReceiptV1Schema.superRefine` recomputes `authorizerHash` from its finite code-owned authorizer identity and `receiptHash` from every field except itself. The harness recomputes `caseContextHash` from campaign/case/repetition/final-release-epoch, `executionBindingHash`, and ordered prior result hashes and requires `intentHash` to equal the already fsynced path-free intent. It has no nonce, selector, admission context, raw task, path, timestamp, prose, or caller-authored token.

`GoldenProductAssertionSetV1Schema.superRefine` requires unique assertion IDs, sorted unique refs, `assertionContractHash === hashCanonicalJson(goldenCase.assertionContract)` at the harness binding boundary, and `assertionSetHash === hashCanonicalJson(payloadWithoutAssertionSetHash)`. Adapter identity is code-owned; an adapter cannot claim another adapter's hash.
`GoldenProductAssertionV1Schema.superRefine` additionally requires every `pass` assertion to contain at least one canonical evidence ref. A `fail` or `unavailable` assertion may contain zero refs. This prevents an adapter from satisfying a required behavior with an evidence-free pass while still permitting a deterministic complete unavailable set after an adapter boundary error.

`GoldenCaseV1Schema.superRefine` permits `node-api-resource-crud-v1` only for the `node-express-api` profile and `vite-react-workflow-v1` only for `vite-react-web`; those profiles may not fall back to `profile-owned-v1`. The four nested contracts are closed code-owned bundles: no caller supplies a route, selector, request body, expected response, or state key outside the exact literal IDs above. Matrix C uses `inventory-items-v1` and `reading-queue-v1`; Subproject E's fleet variants may use `appointments-v1` and `volunteer-shifts-v1` through the same B schema and C adapters. `goldenCaseHashV1` hashes the complete assertion contract. The prepared recovery context preserves that exact case/hash, `GoldenAssertionSubjectV1` binding covers `assertionContractHash`, and the assertion set, terminal evidence, and started-result hash retain the same contract hash. A swapped route/selector/payload/expected ID therefore fails before HTTP/browser activity and cannot be repaired by recomputing only a downstream result hash.

The Node CLI ABI is one exact contract everywhere: each successful `add --title` or `list` invocation writes canonical JSON Lines to stdout, writes no stderr, and exits `0`; missing or blank title writes no stdout, writes the exact UTF-8 bytes `TITLE_REQUIRED\n` to stderr, and exits `2`; a successful add must be visible to a later list invocation through durable state.

Use a `SafeTaskSchema` of `40..8000` UTF-8 characters. Copy the existing convergence secret/path rejection behavior and reject prompt-authored `--repo`, `--branch`, and `--port`; those flags may only be appended internally after fixture verification. `GoldenCaseV1Schema` is strict and contains `startStrategy`, `requiredAcceptedResults`, `task`, `assertionContract`, `expected`, and `timeouts`. Require `requiredAcceptedResults` in `1..2`. The stack-pack enum is `node-cli | node-express-api | vite-react-web-app | browser-game-canvas`; `designPolicy` is `required | compiler-owned-none`; terminal delivery is `project-transfer | explicit-not-deployable`. Require sorted unique evidence kinds, `minimumStories` in `1..32`, `runMs` in `60_000..43_200_000`, `pollMs` in `1_000..60_000`, `projectionMs` in `5_000..300_000`, and `renderMs` in `5_000..120_000`.

Define a strict campaign with `1..16` cases, unique case IDs, unique task hashes, `maximumConcurrency: z.union([z.literal(1),z.literal(2)])`, `rootCauseRepeatLimit: z.literal(3)`, and one `settlementPolicy: GoldenCampaignSettlementPolicyV1Schema`. The schema relation is exact: `all-cases-required-accepted-v1` requires `maximumConcurrency:1`; `fleet-threshold-v1` requires `maximumConcurrency:2`, exactly ten distinct case IDs, and `requiredAcceptedResults:1` for each. The fleet field is a ceiling, not immediate permission for two launches; Task 5 derives the effective capacity. The three allowed non-accepted classifications and all cleanup/systemic literals are immutable. Reject a fleet campaign with `maximumConcurrency:1`, a standard/matrix campaign with `2`, fewer or more than ten fleet cases, duplicate result subjects, a systemic classification allowance, configurable thresholds, or any extra policy field. Load only bytes from one verified open descriptor:

```typescript
export async function loadGoldenCampaignV1(file: string): Promise<LoadedGoldenCampaignV1> {
  const absolute = path.resolve(file);
  const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    const mode = before.mode & 0o777;
    if (
      !before.isFile()
      || before.nlink !== 1
      || ![0o600, 0o640, 0o644].includes(mode)
      || before.size < 1
      || before.size > 256 * 1024
    ) throw new Error("GOLDEN_CAMPAIGN_FILE_NOT_REGULAR");

    const bytes = await handle.readFile({ encoding: "utf8" });
    const after = await handle.stat();
    if (
      after.dev !== before.dev
      || after.ino !== before.ino
      || after.size !== before.size
      || after.mode !== before.mode
      || after.nlink !== before.nlink
      || after.mtimeMs !== before.mtimeMs
    ) throw new Error("GOLDEN_CAMPAIGN_FILE_CHANGED_DURING_READ");

    const campaign = GoldenCampaignV1Schema.parse(JSON.parse(bytes));
    return deepFreezeGoldenValue({
      campaign,
      campaignHash: hashCanonicalJson(campaign),
      caseHashes: Object.fromEntries(campaign.cases.map((item) => [item.caseId, goldenCaseHashV1(item)])),
      promptHashes: Object.fromEntries(campaign.cases.map((item) => [item.caseId, goldenPromptHashV1(item.task)])),
      admissionTaskHashes: Object.fromEntries(
        campaign.cases.map((item) => [item.caseId, goldenAdmissionTaskHashV1(item.task)]),
      ),
    });
  } finally {
    await handle.close();
  }
}

export function goldenCaseHashV1(value: GoldenCaseV1): string {
  return hashCanonicalJson(GoldenCaseV1Schema.parse(value));
}

export function goldenPromptHashV1(task: string): string {
  return createHash("sha256").update(Buffer.from(SafeTaskSchema.parse(task), "utf8")).digest("hex");
}

export function goldenAdmissionTaskHashV1(task: string): string {
  return hashCanonicalJson(SafeTaskSchema.parse(task));
}

export function authenticateLoadedGoldenCampaignV1(
  value: unknown,
): LoadedGoldenCampaignV1;
```

Normalize `ENOENT`, `ELOOP`, and every unsupported descriptor kind to finite loader errors without including the path. The loader never calls `lstat`, `stat(path)`, `realpath`, path-based `readFile`, or reopens the name after its first `open`; both identity observations and the read use the same `FileHandle`. The contract module registers only the deeply frozen object returned after that descriptor-verified bounded read, strict parse, and recomputed campaign/case/prompt/admission hashes in a private `WeakMap<object, string>` keyed by object identity. `authenticateLoadedGoldenCampaignV1()` requires that membership plus equality with the recomputed `campaignHash`; a structural clone, reparsed caller JSON, mutable object, or same fields from another loader cannot authenticate. It reveals no source path and is the only nominal boundary used by C's programmatic repair observer.

`promptHash` is the immutable SHA-256 of the UTF-8 prompt bytes used in reports. `admissionTaskHash` is the existing V3 release-admission identity computed by `hashCanonicalJson(task)` and used only for V3 slot creation/verification. Store both under distinct names and never substitute one for the other.

Define the full result fields as strict bounded schemas:

- campaign identity: campaign ID/hash, case ID/hash, profile ID, prompt hash, and target accepted-result repetition `1 | 2`;
- preflight identity: one strict `GoldenPreflightResultV1`; the admitted run branch has every authority, while the pre-run branch preserves exact unavailable/null relations and never fabricates A, release, epoch, or capacity hashes;
- start identity: present only for `kind:"run"`; the exact typed start strategy; path-free intent/envelope/capacity/execution/starter/start/full-task/pre-start-set hashes from the authenticated phase/start chain; the complete launch `GoldenFinalReleaseEpochV1` and A `historicalBaselineReceiptHash`; the immutable template identity plus complete path-free fresh `GoldenExistingRepositoryFixtureAttemptV1` when applicable, with both exactly null for V3; requested workflow/protocol plus the exact null requested-version relation; and actual workflow/protocol/numeric non-null protocol-version values read from the stored run;
- workflow-evidence identity: the strict top-level `workflowEvidenceHash: string | null`; a terminal existing-repository result requires one SHA-256 equal to the authenticated collector wrapper carried through subject assembly, a terminal V3 result requires `null`, and a nonterminal-timeout result permits only `null` because terminal workflow evidence was not attempted. The result schema, constructor payload, canonical result hash, store, report, and timeout-supersession mapping all retain this field, but never serialize the opaque capability;
- release identity: for `kind:"run"`, exact Setfarm SHA/version, Mission Control SHA/version, workflow hash, compiler SHA, runner hash, and environment hash; for `kind:"pre_run"`, only the blocked preflight's honestly available release/epoch fields exist;
- run identity: `kind:"run"` requires an exact ID, positive run number, start timestamp, nullable finish timestamp, observed status, repository identity, and PR identities; `kind:"pre_run"` has the separate stable attempt subject and literal `run:null` rather than nullable fields inside a run-shaped object;
- observation disposition: either `terminal-settlement` with one terminal status/finish identity and the complete evidence below, or `nonterminal-timeout` with an exact deadline/poll hash, current nonterminal status, `finishedAt:null`, and typed `not_attempted:run_nonterminal_timeout` members for product assertions, verifier runtime, render/projection, terminal delivery, and any terminal-only authority;
- terminal steps: step ID/index/status, retry count, and output hash only;
- terminal stories: story ID/index/status, dependency IDs, branch, PR URL, merge status, source SHA/tree hash, and evidence refs;
- exact census: total/open claims, total/active attempts, total/active runtime sessions, total/accepted completion requests, committed completion requests, total/unsettled effects, open terminations, unsettled outbox, open findings, open recovery owners, active preparation owners, active artifact reservations, active publication batches, active operational deliveries, active compilation leases, process leaks, port leaks, worktree leaks, and dirty generated worktree count;
- artifact identities: PLAN/ProductSpec, DESIGN/DesignGraph when applicable, STORIES/StoryPlan, BuildTopology, design closure, implementation source map, Product Build Packet, Compilation Report, setup-build output hash, evidence bundles, accepted candidate, deploy receipt, release admission, and project-transfer acknowledgement;
- product assertions: assertion adapter ID/hash, assertion-contract hash, stable assertion ID, one finite evidence kind, `pass | fail | unavailable`, and sorted canonical evidence refs; the Node CLI set contains exactly `cli-add-canonical-jsonl`, `cli-list-canonical-jsonl`, `cli-state-persists`, and `cli-title-required` with the ABI above;
- verifier runtime: either `not_applicable` for CLI/non-runtime authority or the sealed contract hash, path-free initial/final lease hashes, optional one-shot durability-restart receipt, path-free final release hash, `exactProcessAbsent:true`, and `exactPortReleased:true`; the restart member is required for the Node Express API durability assertion and forbidden for every other profile, and no member contains origin, host, port, PID, process group, token, command, cwd, environment, or output;
- projection evidence: Setfarm snapshot schema/hash, Mission Control snapshot schema/hash, equality flag, rendered route, rendered status/schema, operational panel hash, Product Build Authority panel hash, screenshot hash, and bounded console error hashes;
- terminal delivery: either exact project-transfer refs or exact non-deployable reason/candidate/source identities;
- trusted failure: canonical operational cause and cause hash, or a finite harness failure code and its hash;
- classification, classification reason code, `productionAuthority:false`, `productionAdmission:"blocked"`, and `resultHash`.

Make the public result discriminant and unavailable relations explicit rather than representing a not-started execution with nullable run-shaped data:

```typescript
export type GoldenPreflightFailureCodeV1 =
  | "GOLDEN_HISTORICAL_BASELINE_UNAVAILABLE"
  | "GOLDEN_RELEASE_AUTHORITY_UNAVAILABLE"
  | "GOLDEN_RELEASE_IDENTITY_DRIFT"
  | "GOLDEN_SOURCE_NOT_CLEAN"
  | "GOLDEN_FINAL_RELEASE_EPOCH_UNAVAILABLE"
  | "GOLDEN_COMPILER_BUILD_MISMATCH"
  | "GOLDEN_MIGRATION_ATTESTATION_UNAVAILABLE"
  | "GOLDEN_ARTIFACT_INDEX_UNAVAILABLE"
  | "GOLDEN_SERVICE_HEALTH_UNAVAILABLE"
  | "GOLDEN_ACTIVE_OWNERSHIP_BLOCKED"
  | "GOLDEN_EXECUTION_CAPACITY_UNAVAILABLE"
  | "GOLDEN_SYSTEMIC_CAUSE_REPEAT_LIMIT";

export type GoldenPreRunZeroOwnerObservationV1 = Readonly<{
  schema: "setfarm.internal-production-golden-pre-run-zero-owner-observation.v1";
  activeGoldenOwnershipCount: 0;
  unrelatedActiveOwnerCount: 0;
  unattributedActiveOwnerCount: 0;
  globalOwnerCount: 0;
  allObservedZero: true;
  observationHash: string;
}>;

type GoldenRunResultCommonV1 = Readonly<{
  schema: "setfarm.internal-production-golden-run-result.v1";
  campaignId: string;
  campaignHash: string;
  caseId: string;
  caseHash: string;
  profileId: GoldenProfileIdV1;
  promptHash: string;
  repetition: 1 | 2;
  launchAttemptOrdinal: number;
  productionAuthority: false;
  productionAdmission: "blocked";
  resultHash: string;
}>;

export type GoldenPreRunResultV1 = GoldenRunResultCommonV1 & Readonly<{
  kind: "pre_run";
  subject: Readonly<{
    kind: "pre_run";
    stableSubjectHash: string;
    launchAttemptOrdinal: number;
  }>;
  stableSubjectHash: string;
  preflightFailureCode: GoldenPreflightFailureCodeV1;
  preflight: Extract<GoldenPreflightResultV1, {
    kind: "blocked-before-authority" | "blocked-after-authority";
  }>;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1 | null;
  start: null;
  run: null;
  observationDisposition: null;
  terminalEvidence: null;
  lifecycleEvidenceHash: null;
  workflowEvidenceHash: null;
  zeroOwnerObservation: GoldenPreRunZeroOwnerObservationV1;
  classification: "campaign_configuration_failure";
  classificationReasonCode: GoldenPreflightFailureCodeV1;
  rootCauseHash: string;
}>;

type GoldenStartedRunStartCommonV1 = Readonly<{
  intentHash: string;
  persistedEnvelopeHash: string;
  capacityReservationHash: string;
  executionBindingHash: string;
  starterOperationHash: string;
  startReceiptHash: string;
  fullLaunchTaskHash: string;
  preStartRunSetHash: string;
  historicalBaselineReceiptHash: string;
  goldenLaunchMigrationReceiptRef: CanonicalRef;
  goldenLaunchMigrationReceiptHash: string;
  goldenLaunchMigrationApplicationSourceSha: string;
  goldenLaunchMigrationCurrentVerificationHash: string;
  goldenLaunchMigrationSchemaProjectionHash: string;
  requestedProtocolVersion: null;
  actualProtocolVersion: number;
}>;

export type GoldenStartedRunStartV1 = GoldenStartedRunStartCommonV1 & (
  | Readonly<{
      strategyKind: "v3-feature-dev-canary";
      requestedWorkflowId: "feature-dev";
      requestedProtocol: "v3";
      actualWorkflowId: "feature-dev";
      actualProtocol: "v3";
      templateHash: null;
      fixtureAttempt: null;
      fixtureAttemptHash: null;
      admissionBindingHash: string;
    }>
  | Readonly<{
      strategyKind: "canonical-existing-repository-workflow";
      requestedWorkflowId: "bug-fix" | "security-audit";
      requestedProtocol: "workflow-default";
      actualWorkflowId: "bug-fix" | "security-audit";
      actualProtocol: string;
      templateHash: string;
      fixtureAttempt: GoldenExistingRepositoryFixtureAttemptV1;
      fixtureAttemptHash: string;
      admissionBindingHash: null;
    }>
);

export const GoldenStartedRunStartV1Schema:
  z.ZodType<GoldenStartedRunStartV1>;

export type GoldenStartedRunResultV1 = GoldenRunResultCommonV1 & Readonly<{
  kind: "run";
  subject: Readonly<{
    kind: "run";
    runId: string;
    runNumber: number;
  }>;
  preflight: Extract<GoldenPreflightResultV1, { kind: "admitted" }>;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  start: GoldenStartedRunStartV1;
  run: Readonly<{ runId: string; runNumber: number }>;
  observationDisposition: "terminal-settlement" | "nonterminal-timeout";
  terminalEvidence: GoldenRunEvidenceV1;
  lifecycleEvidenceHash: string | null;
  workflowEvidenceHash: string | null;
  zeroOwnerObservation: null;
  classification: Exclude<GoldenClassificationV1, "campaign_configuration_failure">;
  classificationReasonCode: string;
  rootCauseHash: string;
}>;

export type GoldenRunResultV1 =
  | GoldenPreRunResultV1
  | GoldenStartedRunResultV1;

export const GoldenRunResultV1Schema: z.ZodType<GoldenRunResultV1>;
```

`GoldenRunResultV1Schema` is a `.strict()` discriminated union on `kind`. The `pre_run` schema contains no timestamp and recomputes `stableSubjectHash` solely from `{schema:"setfarm.internal-production-golden-pre-run-subject.v1",campaignHash,caseId,repetition,launchAttemptOrdinal}`. It requires the common and nested ordinals to be equal, `preflightFailureCode === classificationReasonCode` and to be the code-owned primary blocker selected from the exact blocked preflight checks, `finalReleaseEpoch === preflight.finalReleaseEpoch`, all start/run/evidence fields to be literal null, and every owner count to be an observed literal zero before hashing `zeroOwnerObservation` and the result. `rootCauseHash` hashes only the finite failure code, failed check ID, and nullable authentic check-evidence hash; it never hashes exception prose. An identical unresolved blocked attempt reopens the same result. A changed primary failure or an intervening closed/result subject advances the code-owned launch-attempt ordinal and therefore the stable subject; callers cannot select either value.

`GoldenStartedRunStartV1Schema` is a strict discriminated union on `strategyKind`, and `GoldenRunResultV1Schema` retains that complete nested value in the canonical `resultHash`. Both branches equality-bind their requested workflow/protocol identity to the selected campaign strategy and their actual workflow/protocol/numeric positive protocol version to `GoldenRunStartReceiptV1` plus the stored run row; `requestedProtocolVersion` is exactly `null` because neither strategy accepts a caller-selected protocol version. The V3 branch requires the exact `feature-dev`/`v3` requested and actual identities, one non-null admission binding, and literal-null template/attempt fields. The existing-repository branch requires `requestedWorkflowId === actualWorkflowId`, the code-owned `workflow-default` request marker, no admission binding, and the complete fresh `GoldenExistingRepositoryFixtureAttemptV1`; it recomputes that attempt, requires `fixtureAttemptHash === hashCanonicalJson(fixtureAttempt)` exactly as the established execution/start chain does, and requires both `templateHash` and the attempt workflow to equal the selected immutable template/strategy. Both branches bind the same intent, persisted envelope, capacity reservation, execution, starter operation, full-task, pre-start set, historical-baseline, golden-launch migration-release pair, and start-receipt hashes. No constructor accepts a partial attempt projection, caller protocol/version default, or nullable strategy identity.

The `run` schema is the former complete run-result schema with nullable-before-start removed. It requires its nested run pair to equal `subject`, its complete strategy-discriminated start chain and admitted preflight to bind the same campaign/case/repetition/ordinal/full epoch, and retains that start value byte-for-byte through timeout collection, terminal reconciliation, store reopen, effective mapping, preview, and final report. It retains all existing terminal/timeout, workflow-evidence, classification, cleanup, artifact, projection, and hash relations. It forbids `campaign_configuration_failure`, every pre-run-only field/value, and a nullable run identity. `createGoldenRunResultV1()` dispatches on `kind`, computes every derived subject/evidence/root/result hash internally, and accepts neither a caller stable subject nor a run-shaped payload with null authority.

`GoldenRunEvidenceV1Schema` is a discriminated union on that observation disposition. The nonterminal-timeout member admits only bounded DB/operational-snapshot, project, and cleanup observations. Its cleanup counts remain their observed nonzero or `null` values and its terminal-only census fields remain unavailable; the schema forbids an all-zero synthesized cleanup, assertion set, verifier lease/release, browser/render evidence, terminal packet, delivery receipt, or accepted classification. It may classify only as `infrastructure_failure` with `GOLDEN_RUN_TIMEOUT_NONTERMINAL` when the observations are internally valid, or `setfarm_core_failure` with a finite canonical-authority/census reason when they are not. `isGoldenRunCleanupExactlySettledV1()` always returns false for this immutable member. Campaign settlement remains unsettled unless a separate validated `GoldenTimeoutTerminalSupersessionV1` names the exact original and a later full terminal result for the same run with exact cleanup; the timeout result itself is never rewritten or relabeled accepted.

Use these constructors so hashes cannot be caller-authored:

`GoldenRunResultPayloadV1Schema` is the matching strict payload union without any derived subject/root/result hash. Its repetition is `z.number().int().min(1).max(2)` and must be no greater than the selected case's `requiredAcceptedResults`. The harness derives repetition and launch-attempt ordinal from canonical history; no CLI flag or external constructor caller may select either. Multiple reviewed failed run attempts may retain the same target repetition but have increasing launch-attempt ordinals and distinct exact run subjects. Replaying one unresolved pre-run failure adopts its existing stable subject/result instead of incrementing the ordinal.

```typescript
export function createGoldenRunResultV1(
  payload: GoldenRunResultPayloadV1,
): GoldenRunResultV1 {
  const parsed = GoldenRunResultPayloadV1Schema.parse(payload);
  const withDerivedSubjectAndRoot = parsed.kind === "pre_run"
    ? deriveGoldenPreRunResultFieldsV1(parsed)
    : deriveGoldenStartedRunResultFieldsV1(parsed);
  return deepFreezeGoldenValue(GoldenRunResultV1Schema.parse(
    Object.assign({}, withDerivedSubjectAndRoot, {
      resultHash: hashCanonicalJson(withDerivedSubjectAndRoot),
    }),
  ));
}
```

The two `deriveGolden*ResultFieldsV1` helpers are unexported pure functions in the same contract module. They accept only the parsed discriminated payload, enumerate every output member, and compute the branch-specific subject/root hashes above; they never read a path, clock, environment value, or caller-provided derived hash.

- [ ] **Step 5: Run schema tests and static checks**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-contract-v1.test.ts
npx tsc -p tsconfig.json --noEmit
npm run check:english
git diff --check
```

Expected: all commands exit `0`; the fixture is parsed, every mutation without rehashing is rejected, and no sensitive field exists in the public schemas.

- [ ] **Step 6: Record the Task 1 Setfarm handoff checkpoint**

Run `git status --short` and `git diff --check`, verify only Task 1 files plus this plan are changed, and return the exact file list plus focused-test evidence to the active Setfarm claim. Do not stage or commit; Setfarm owns the scoped commit decision.

---

### Task 2: Collect canonical snapshots, lifecycle rows, and compiler identities

**Files:**
- Create: `src/internal-production/golden-run-snapshot.ts`
- Create: `src/internal-production/golden-run-repository.ts`
- Create: `src/internal-production/golden-launch-operation-migration-release-v1.ts`
- Create: `src/db/golden-launch-operation-v1-migration.ts`
- Create: `tests/internal-production/golden-run-snapshot.test.ts`
- Create: `tests/internal-production/golden-run-repository.test.ts`
- Create: `tests/internal-production/golden-launch-operation-migration-release-v1.test.ts`
- Modify: `src/db/contract-spine-migrations.ts`
- Modify: `src/db/contract-spine-migration-digests.generated.ts`
- Modify: `src/evals/convergence-runner.ts:43,600-630`
- Modify: `tests/evals/convergence-eval.test.ts`

**Interfaces:**
- Consumes: Task 1 evidence types; P0's exact `CanonicalRef`, `SetfarmCompletionOwnerMergeReceiptV1`, and `resolveSetfarmCompletionOwnerMergeReceiptV1({receiptRef,receiptHash})`; A's exact `InternalProductionBaselineZeroOwnerMutationGuardV1`, `InternalProductionBaselineBootstrapHandoffMigrationReceiptV1`, `resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1({migrationReceiptRef,migrationReceiptHash})`, purpose-bound `bindInternalProductionBaselineGoldenLaunchMigrationZeroOwnerGuardV1(...)`, `consumeInternalProductionBaselineGoldenLaunchMigrationZeroOwnerGuardV1(...)`, and their pair-only authorization/consumption resolvers; `RunOperationalSnapshotV2Schema`; `RunOperationalSnapshotV3Schema`; `buildRunOperationalSnapshot(sql, runId)`; `computeRunOperationalSnapshotHash(snapshot)`; `computeRunOperationalSnapshotHashV3(snapshot)`; `RuntimeEvidenceContractV1Schema`; `createRuntimeArtifactReader({ sql, artifactRoot, artifactLimits }).auditExactTerminalPacket(runId)`; exact contract-spine plan/apply/verify functions and artifact-index verification used by `createPostgresConvergencePort(sql, options)`.
- Produces: `RunOperationalSnapshotVersionedSchema`, `parseRunOperationalSnapshotVersioned(value)`, `sameCanonicalOperationalState(left, right)`, exact `GoldenLaunchOperationMigrationPendingInputV1`, `GoldenLaunchOperationMigrationReleaseOperationV1`, `GoldenLaunchOperationMigrationReleaseReceiptV1`, `GoldenLaunchOperationMigrationCurrentVerificationV1`, `GoldenLaunchOperationMigrationReleaseStatusV1`, `prepareGoldenLaunchOperationMigrationReleaseV1({sourceMergeReceiptRef,sourceMergeReceiptHash,zeroOwnerGuardRef,zeroOwnerGuardHash})`, `executeOrRecoverGoldenLaunchOperationMigrationReleaseV1({operationRef,operationHash})`, zero-argument `resumeActiveGoldenLaunchOperationMigrationReleaseV1()`, read-only zero-argument `observeGoldenLaunchOperationMigrationReleaseStatusV1()`, `resolveGoldenLaunchOperationMigrationReleaseOperationV1({operationRef,operationHash})`, `resolveGoldenLaunchOperationMigrationReleaseReceiptV1({receiptRef,receiptHash})`, zero-argument immutable-terminal `verifyActiveGoldenLaunchOperationMigrationReleaseV1()`, zero-argument fresh-current `verifyCurrentGoldenLaunchOperationMigrationV1()`, `GoldenActiveRunGenerationV1`, opaque internal `GoldenWorkflowEvidenceV1`, `GoldenWorkflowEvidenceCollectorPort`, `GoldenCollectedAssertionAuthorityV1`, `GoldenRunRepositoryOptionsV1`, `GoldenRunRepository`, and `createPostgresGoldenRunRepository(sql, options)`. The release module imports A's exact unaliased fence acquire/reobserve/release/resolver plus `InternalProductionOwnerReservationV1`, `beginOrAdoptInternalProductionOwnerReservationV1`, and `closeInternalProductionOwnerReservationV1`; it neither redeclares nor wraps them.

`golden-run-contract-v1.ts` imports only A's exact `InternalProductionOwnerProducerRowV1`, `InternalProductionOwnerProducerManifestV1`, durable manifest-set activation/resolver ABI, reservation APIs, category/census schema, and canonical hash helper. It exports these literal B-owned values; a prose list, generated row, category-only row, or partial row is not the registry authority:

```typescript
export const INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_B_V1 = [
  { plan: "B", module: "src/internal-production/golden-run-phase-store.ts", function: "reserveGoldenLaunchPreparationOwnerV1", implementationId: "b-launch-preparation-v1", category: "launch-preparation", ownerKeyDerivationId: "golden-recovery-context-launch-attempt-v1", censusKeys: ["launchPreparationCount"] },
  { plan: "B", module: "src/internal-production/golden-run-phase-store.ts", function: "reserveGoldenPreparedLaunchOwnerV1", implementationId: "b-prepared-launch-v1", category: "prepared-launch", ownerKeyDerivationId: "golden-recovery-context-persisted-intent-v1", censusKeys: ["preparedLaunchCount"] },
  { plan: "B", module: "src/internal-production/golden-run-harness.ts", function: "reserveGoldenFixtureAttemptOwnerV1", implementationId: "b-fixture-attempt-v1", category: "fixture-attempt", ownerKeyDerivationId: "golden-intent-attempt-ordinal-v1", censusKeys: ["fixtureAttemptCount"] },
  { plan: "B", module: "src/internal-production/golden-run-report.ts", function: "reserveGoldenArtifactReservationOwnerV1", implementationId: "b-artifact-reservation-v1", category: "artifact-reservation", ownerKeyDerivationId: "golden-artifact-content-reservation-v1", censusKeys: ["artifactReservationCount"] },
  { plan: "B", module: "src/internal-production/golden-run-report.ts", function: "reserveGoldenArtifactPublicationOwnerV1", implementationId: "b-artifact-publication-v1", category: "artifact-publication", ownerKeyDerivationId: "golden-artifact-content-publication-v1", censusKeys: ["publicationBatchCount", "artifactPublicationCount"] },
  { plan: "B", module: "src/internal-production/golden-run-report.ts", function: "reserveGoldenDocsSessionOwnerV1", implementationId: "b-docs-session-v1", category: "docs-session", ownerKeyDerivationId: "golden-docs-claim-generation-v1", censusKeys: ["docsSessionCount"] },
  { plan: "B", module: "src/internal-production/golden-run-report.ts", function: "reserveGoldenDocsLeaseOwnerV1", implementationId: "b-docs-lease-v1", category: "docs-lease", ownerKeyDerivationId: "golden-docs-claim-worktree-v1", censusKeys: ["docsLeaseCount"] },
  { plan: "B", module: "src/internal-production/golden-run-phase-store.ts", function: "reserveGoldenLaunchOutboxOwnerV1", implementationId: "b-launch-outbox-v1", category: "launch-outbox", ownerKeyDerivationId: "golden-starter-operation-outbox-v1", censusKeys: ["launchOutboxCount"] },
  { plan: "B", module: "src/internal-production/golden-verifier-runtime.ts", function: "reserveGoldenCompilationLeaseOwnerV1", implementationId: "b-compilation-lease-v1", category: "compilation-lease", ownerKeyDerivationId: "golden-verifier-contract-generation-v1", censusKeys: ["compilationLeaseCount"] },
  { plan: "B", module: "src/internal-production/golden-verifier-runtime.ts", function: "reserveGoldenExecutionLeaseOwnerV1", implementationId: "b-execution-lease-v1", category: "execution-lease", ownerKeyDerivationId: "golden-verifier-runtime-generation-v1", censusKeys: ["executionLeaseCount"] },
] as const satisfies readonly InternalProductionOwnerProducerRowV1[];

export const INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_B_V1 = {
  schema: "setfarm.internal-production-owner-producer-manifest.v1",
  plan: "B",
  rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_B_V1,
  manifestHash: hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-manifest.v1",
    plan: "B",
    rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_B_V1,
  }),
} as const satisfies InternalProductionOwnerProducerManifestV1;
```

The literal B manifest module is import-inert: it performs no `void` activation, constructor-time registration, mutable global insertion, or import-order-dependent trust. `golden-run-owner-producer-manifest-activation-controller-v1.ts` is B's sole executable A11-to-A+B21 wrapper. Its zero-input mutator code-owns precisely `INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1`, `INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_B_V1`, phase `A+B`, and B's freshly resolved clean source/build authority; no caller supplies a plan, manifest, row, predecessor, receipt/head pair, path, root, source/build body, environment, or test port. It first publishes/reopens one fixed-private content-addressed operation binding that authority and the freshly re-hashed current A `{head,receipt}` quartet. The controller requires phase `A`, ordered plans `["A"]`, eleven rows, exact A manifest/source-build hashes, and head-to-receipt equality before it calls `activateInternalProductionOwnerProducerManifestSetV1({expectedPredecessor:{activationRef:receipt.activationRef,activationHash:receipt.activationHash,headRef:head.headRef,headHash:head.headHash},manifests:[INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_B_V1]})`. It freshly resolves the returned activation pair and zero-input current tuple, requires the newly re-hashed head to name that receipt and phase `A+B`, ordered plans `["A","B"]`, exactly 21 rows across A's 11 and B's 10, both exact manifest/source-build hashes, A's registry/map hashes, and the exact predecessor activation-and-head quartet, then content-addresses the strict path-free wrapper receipt and updates its fixed status locator last. `GoldenRunOwnerProducerManifestActivationReceiptV1` binds the predecessor activation/head quartet, successor activation/head quartet, exact A/B manifest hashes, and B source/build authority, omitting only its own receipt ref/hash; the status union repeats those pairs in its active state and is read-only. Crash recovery reopens only the fixed operation/receipt/status locators: before the generic call it resumes the same operation, after the generic call it adopts only the exact A+B successor, and after wrapper publication it completes only the matching status locator. A stale, head/receipt-mixed, missing/changed source/build, wrong 21-row, forked, duplicate, or future-plan result is `blocked` and never invokes another activation. B neither scans nor activates future plans.

`golden-run-owner-producer-manifest-activation-controller-v1.test.ts` parses the File Map and package command table, requires the two exact zero-input `internal:golden` verbs, and proves both the manifest and controller import without a store/CLI side effect. It tests strict receipt/status schemas, canonical hashes/refs, exact `A` predecessor and `A+B` successor rows/manifests/source-build pairs, all predecessor/successor quartet relations, no caller-shaped controller input, and a status read with zero mutations. It injects a crash before/after operation publication, generic activation, receipt publication, status-locator CAS, and response; races two controller invocations; and restarts in a fresh process. Recovery may return only one byte-identical wrapper receipt/status after re-hashing both successor records. A changed predecessor/head, stale or foreign current tuple, changed B build, partial receipt, wrong/missing status locator, source import side effect, or response loss may not reach a B producer. Source/transcript tests put this controller immediately after B's reviewed clean merge/build and before every B reservation, migration release, SQL/write, launch intent, outbox, run, process, worktree, or delivery byte.

Delegated run and execution-attempt publication uses A's active A rows and never copies them into B's manifest. Multiple producer rows may share a category across plans, but every implementation ID, module/function, and owner-key derivation is globally unique. Every B function begins/adopts before its first store/SQL/process/worktree byte, embeds the pair in its strict authority, and closes it against the exact terminal receipt. Task 1's `golden-run-contract-v1.test.ts` AST-parses B's literal ten-row table immediately, proves every object has exactly the seven `InternalProductionOwnerProducerRowV1` fields and its manifest hash is the canonical `{schema,plan,rows}` projection, and rejects a prose/generated/partial row, duplicate implementation/module-function/owner-key, wrong category/census mapping, nonliteral spread, computed key, cast, or activation side effect. Task 7 extends that same B-owned test only after Tasks 1–6 have delivered every B module: it resolves every listed module/function against B's complete File Map, imports no C/D/E file, asserts no future source exists, and performs no aggregate A–E scan. Runtime races execute each B producer against B migration fence acquire/apply and A cutover fence acquire/CAS. A pending B reservation makes both fences nonzero; a held fence makes every producer return typed unavailable with zero local writes.
- Read boundary: after the guarded release has created and freshly verified the launch-operation table/unique nullable run binding, every golden repository query is a `SELECT` or an existing read-only authority call. Before opening SQL and again before returning each ownership/start lookup, the repository calls `verifyCurrentGoldenLaunchOperationMigrationV1()`, equality-binds its immutable terminal receipt pair/current verification/schema projection to the row and current release projection, and exports no lifecycle or migration mutation method.

The migration-release ABI is exact and path-free:

```typescript
export type GoldenLaunchOperationMigrationPendingInputV1 = Readonly<{
  schema: "setfarm.internal-production-golden-launch-operation-migration-pending-input.v1";
  purpose: "golden-launch-operation-migration-release-v1";
  sourceMergeReceiptRef: CanonicalRef;
  sourceMergeReceiptHash: string;
  zeroOwnerGuardRef: CanonicalRef;
  zeroOwnerGuardHash: string;
  ownerAdmissionFenceRef: null;
  ownerAdmissionFenceHash: null;
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
}>;

export type GoldenLaunchOperationMigrationReleaseOperationV1 = Readonly<{
  schema: "setfarm.internal-production-golden-launch-operation-migration-release-operation.v1";
  migrationId: "internal-production-golden-launch-operation-v1";
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
  ownerAdmissionFenceRef: CanonicalRef;
  ownerAdmissionFenceHash: string;
  sourceMergeReceiptRef: CanonicalRef;
  sourceMergeReceiptHash: string;
  applicationSourceSha: string;
  applicationSourceTreeHash: string;
  migrationModuleBlobHash: string;
  migrationStatementsHash: string;
  namedMigrationDigestEntryHash: string;
  migrationDigest: string;
  plannedSchemaProjectionHash: string;
  baselineMigrationReceiptRef: CanonicalRef;
  baselineMigrationReceiptHash: string;
  baselineMigrationSourceSha: string;
  zeroOwnerAuthorizationRef: CanonicalRef;
  zeroOwnerAuthorizationHash: string;
  operationRef: CanonicalRef;
  operationHash: string;
}>;

export type GoldenLaunchOperationMigrationReleaseReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-golden-launch-operation-migration-release-receipt.v1";
  operationRef: CanonicalRef;
  operationHash: string;
  pendingInputRef: CanonicalRef;
  pendingInputHash: string;
  ownerAdmissionFenceRef: CanonicalRef;
  ownerAdmissionFenceHash: string;
  sourceMergeReceiptRef: CanonicalRef;
  sourceMergeReceiptHash: string;
  applicationSourceSha: string;
  applicationSourceTreeHash: string;
  migrationId: "internal-production-golden-launch-operation-v1";
  migrationModuleBlobHash: string;
  migrationStatementsHash: string;
  namedMigrationDigestEntryHash: string;
  migrationDigest: string;
  schemaProjectionHash: string;
  baselineMigrationReceiptRef: CanonicalRef;
  baselineMigrationReceiptHash: string;
  baselineMigrationSourceSha: string;
  zeroOwnerAuthorizationRef: CanonicalRef;
  zeroOwnerAuthorizationHash: string;
  zeroOwnerConsumptionRef: CanonicalRef;
  zeroOwnerConsumptionHash: string;
  guardConsumed: true;
  planStatus: "exact-pending-migration";
  applyStatus: "applied";
  verifyStatus: "verified";
  reciprocalRunBindingPresent: true;
  operationRunUniquenessPresent: true;
  migrationReleaseReceiptHashRequired: true;
  receiptRef: CanonicalRef;
  receiptHash: string;
}>;

export type GoldenLaunchOperationMigrationCurrentVerificationV1 = Readonly<{
  schema: "setfarm.internal-production-golden-launch-operation-migration-current-verification.v1";
  receiptRef: CanonicalRef;
  receiptHash: string;
  applicationSourceSha: string;
  applicationSourceTreeHash: string;
  currentSourceSha: string;
  currentSourceTreeHash: string;
  ancestryObservationHash: string;
  migrationModuleBlobHash: string;
  migrationStatementsHash: string;
  namedMigrationDigestEntryHash: string;
  migrationDigest: string;
  schemaProjectionHash: string;
  verificationHash: string;
}>;

export type GoldenLaunchOperationMigrationReleaseStatusV1 =
  | Readonly<{ state: "absent"; pendingInputRef: null; pendingInputHash: null; ownerAdmissionFenceRef: null; ownerAdmissionFenceHash: null; ownerAdmissionFenceReleaseRef: null; ownerAdmissionFenceReleaseHash: null; operationRef: null; operationHash: null; receiptRef: null; receiptHash: null; statusHash: string }>
  | Readonly<{ state: "pending-input"; pendingInputRef: CanonicalRef; pendingInputHash: string; ownerAdmissionFenceRef: CanonicalRef | null; ownerAdmissionFenceHash: string | null; ownerAdmissionFenceReleaseRef: null; ownerAdmissionFenceReleaseHash: null; operationRef: null; operationHash: null; receiptRef: null; receiptHash: null; statusHash: string }>
  | Readonly<{ state: "prepared" | "applying"; pendingInputRef: CanonicalRef; pendingInputHash: string; ownerAdmissionFenceRef: CanonicalRef; ownerAdmissionFenceHash: string; ownerAdmissionFenceReleaseRef: null; ownerAdmissionFenceReleaseHash: null; operationRef: CanonicalRef; operationHash: string; receiptRef: null; receiptHash: null; statusHash: string }>
  | Readonly<{ state: "terminal"; pendingInputRef: CanonicalRef; pendingInputHash: string; ownerAdmissionFenceRef: CanonicalRef; ownerAdmissionFenceHash: string; ownerAdmissionFenceReleaseRef: CanonicalRef; ownerAdmissionFenceReleaseHash: string; operationRef: CanonicalRef; operationHash: string; receiptRef: CanonicalRef; receiptHash: string; statusHash: string }>;

export function prepareGoldenLaunchOperationMigrationReleaseV1(input: Readonly<{
  sourceMergeReceiptRef: CanonicalRef;
  sourceMergeReceiptHash: string;
  zeroOwnerGuardRef: CanonicalRef;
  zeroOwnerGuardHash: string;
}>): Promise<Readonly<{ operationRef: CanonicalRef; operationHash: string }>>;

export function executeOrRecoverGoldenLaunchOperationMigrationReleaseV1(input: Readonly<{
  operationRef: CanonicalRef;
  operationHash: string;
}>): Promise<Readonly<{ receiptRef: CanonicalRef; receiptHash: string }>>;

export function resumeActiveGoldenLaunchOperationMigrationReleaseV1():
  Promise<Readonly<{ receiptRef: CanonicalRef; receiptHash: string }>>;

export function observeGoldenLaunchOperationMigrationReleaseStatusV1():
  Promise<GoldenLaunchOperationMigrationReleaseStatusV1>;

export function resolveGoldenLaunchOperationMigrationReleaseOperationV1(input: Readonly<{
  operationRef: CanonicalRef;
  operationHash: string;
}>): Promise<GoldenLaunchOperationMigrationReleaseOperationV1>;

export function resolveGoldenLaunchOperationMigrationReleaseReceiptV1(input: Readonly<{
  receiptRef: CanonicalRef;
  receiptHash: string;
}>): Promise<GoldenLaunchOperationMigrationReleaseReceiptV1>;

export function verifyActiveGoldenLaunchOperationMigrationReleaseV1():
  Promise<GoldenLaunchOperationMigrationReleaseReceiptV1>;

export function verifyCurrentGoldenLaunchOperationMigrationV1():
  Promise<GoldenLaunchOperationMigrationCurrentVerificationV1>;
```

- [ ] **Step 1: Write failing V3-first snapshot tests**

Construct valid V2 and V3 snapshots using the existing test fixtures. Assert both parse, V3 retains `operationalFailure`, observation-clock differences do not change canonical equivalence, a hash mismatch fails, and V2/V3 schemas are never coerced into one another.

```typescript
const parsed = parseRunOperationalSnapshotVersioned(v3Snapshot);
assert.equal(parsed.schema, "setfarm.run-operational-snapshot.v3");
assert.deepEqual(parsed.operationalFailure, v3Snapshot.operationalFailure);
assert.equal(sameCanonicalOperationalState(v3Snapshot, structuredClone(v3Snapshot)), true);
assert.throws(
  () => parseRunOperationalSnapshotVersioned(
    Object.assign({}, v3Snapshot, { snapshotHash: "0".repeat(64) }),
  ),
  /snapshot/u,
);
```

Add a convergence regression whose Setfarm and Mission Control ports return the same valid V3 snapshot. Expected projection parity is true rather than `EVAL_OPERATIONAL_SNAPSHOT_INVALID`.

- [ ] **Step 2: Run snapshot tests and confirm failure**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-snapshot.test.ts
node --import tsx --test tests/evals/convergence-eval.test.ts
```

Expected: the new test fails because the versioned parser is absent; the convergence regression fails because the runner accepts only V2.

- [ ] **Step 3: Implement exact V3/V2 parsing and update convergence**

Implement a discriminated parser, verifying the embedded hash with the schema-specific hash function:

```typescript
export const RunOperationalSnapshotVersionedSchema = z.union([
  RunOperationalSnapshotV3Schema,
  RunOperationalSnapshotV2Schema,
]);

export function parseRunOperationalSnapshotVersioned(
  value: unknown,
): RunOperationalSnapshotVersioned {
  const parsed = RunOperationalSnapshotVersionedSchema.parse(value);
  const actual = parsed.schema === "setfarm.run-operational-snapshot.v3"
    ? computeRunOperationalSnapshotHashV3(parsed)
    : computeRunOperationalSnapshotHash(parsed);
  if (actual !== parsed.snapshotHash) throw new Error("GOLDEN_OPERATIONAL_SNAPSHOT_HASH_INVALID");
  return parsed;
}
```

`sameCanonicalOperationalState(left, right)` parses both values and compares their `snapshotHash`; it returns false across schema versions even if common fields look alike. Replace the two `RunOperationalSnapshotV2Schema.safeParse(snapshot)` calls in `convergence-runner.ts` with safe calls around this parser and preserve every existing exported convergence interface and error code.

- [ ] **Step 4: Write failing isolated-PostgreSQL collector tests**

Use `tests/execution-attempts/test-database.ts` patterns through the isolated runner. Seed one fully settled V3 fixture containing:

- a terminal run with exact compiler/release/admission pointers;
- ordered terminal steps and stories, including a dependency edge;
- claim, attempt, runtime, completion request/effect, finding, recovery, outbox, and termination rows;
- exact semantic artifact refs and a sealed V3 runtime packet;
- an accepted candidate, deployment receipt, and project-transfer acknowledgement;
- attempt worktree locators and story PR identities.

Assert `inspectPlatform()` reports migration attestation, artifact-index readiness, service-independent ownership totals, and strict sorted active golden run identities from the durable launch-operation/run relation. Each bound run identity contains exact operation/run pairs and `ownershipHash`; unrelated global owners remain in `unattributedActiveOwnerCount`. Task 5 equality-joins those rows to Task 3A's authenticated active-preparation identities to construct the complete `GoldenPlatformInspectionV1.activeGoldenOwnerships`; Task 2 does not import the later phase-store module or infer campaign/epoch from task, time, workflow, repository, or status prose. Assert `readRun()` returns terminal status plus exact stored workflow ID, protocol, numeric protocol version, compiler identity, release-admission identity, run task, and at most one active story generation selected by ordered workflow-step/story identity. Seed the unchanged `runs.protocol_version INTEGER NOT NULL` column with `1` and prove every `GoldenRunStartReceiptV1.actualProtocolVersion` and canonical run projection preserves the exact number `1`; strict schemas reject `"1"`, `null`, fractions, and absent values. Keep the launch/campaign `requestedProtocol` discriminator separate: it remains the exact request literal and never supplies, defaults, stringifies, or overwrites the actual database protocol/version. Assert `collectRun()` returns hashes and refs but no artifact bodies, step output, prompt, fixture path, or admission selector token. Assert `collectAssertionAuthority()` returns internal accepted-source, invocation, runtime, and optional opaque workflow-evidence authorities only for the same run and canonical collection, and that serializing the public result cannot expose paths or the workflow capability. With no collector port the member is exactly `null`. With a fake code-owned collector, require a frozen object capability plus one SHA-256 `workflowEvidenceHash`; structural clone, mutable capability, missing/mismatched hash, wrong run/workflow, or a serializer/store receiving the wrapper fails closed. Add an existing-repository fixture whose stored protocol is `legacy` or `shadow` and prove the collector preserves that literal rather than converting it to V3.

Seed preexisting and newly inserted matching runs for both strategies. Assert `findLaunchCandidates()` returns sorted path-free row authorities for exact workflow/full-launch-task hash/release plus V3 admission-slot binding when applicable. The harness captures the before-set only after the full task is knowable, persists it with the logical correlation in `GoldenLaunchExecutionBindingV1`, and later selects one new row whose unique `golden_launch_operation_hash` equals the issued `starterOperationHash`. Querying the exact operation hash returns zero or one run only; duplicate rows, an operation row without its atomically bound run, a run with another request/claim-secret hash, or a task/release/admission/attempt mismatch is an explicit ambiguity rather than an adoptable candidate. Reject a pre-provision full-task query, protocol/compiler/admission drift, more than `64` candidates, raw task output, or time/log/proximity inference.

Add separate fixtures proving:

- a completion request in `accepted` without `apply_phase = 'effects_committed'` is unsettled;
- an effect in `pending`, `leased`, or `quarantined` is unsettled;
- one open claim, runtime, termination, recovery delivery, preparation owner, artifact reservation, publication batch, operational delivery, or compilation attempt appears in the exact census;
- a V3 packet audit failure remains explicit and cannot be converted to empty accepted evidence;
- `explicit-not-deployable` recognizes only `STATUS: skip`, `DEPLOY_TYPE: setfarm-v3-not-deployable`, one enumerated `V3DeployNotDeployableReason`, and exact accepted candidate/source bindings.

In `golden-launch-operation-migration-release-v1.test.ts`, use only an isolated PostgreSQL database and a test-only private root. Start from the exact pending migration and a fake freshly resolved complete-zero-owner guard. Require prepare to freshly resolve the B owner merge receipt, literal clean `main`, `HEAD === origin/main === sourceMergeReceipt.mergeSha`, exact tree/build identity, A's historical/bootstrap migration pair, the Git blob and canonical ordered statements for `src/db/golden-launch-operation-v1-migration.ts`, the exact named `(migrationId,migrationDigest)` entry hash, the digest, and the deterministic planned schema projection. Prepare's first and sole durable creation is the complete fixed `pending-input.json` record; only after reopening it may prepare acquire A's exact `golden-launch-operation-migration-release-v1` global owner-admission fence, call A's purpose-bound bind seam, and publish/reopen the operation plus fixed active-operation locator. The caller supplies none of those source, tree, blob, digest, schema, migration, database, path, build, census, category, or fence fields.

Crash immediately before and after pending-input temporary creation, file fsync, no-replace publication/reopen, global owner-fence acquisition/reobservation, A purpose authorization binding, operation temporary creation/publication, active-operation locator CAS, A purpose-bound guard consumption, plan, each migration transaction boundary, apply commit, fresh verification, receipt publication/reopen, terminal-locator CAS, fence release, and response. A crash before `pending-input.json` is durable is side-effect-free and the same exact caller may retry prepare. Once that fixed record is durable, zero-input `resumeActiveGoldenLaunchOperationMigrationReleaseV1()` reopens it and creates/adopts the same fence, A purpose authorization, operation, and active locator as needed; it never needs shell-local merge/guard values. The fence covers every run, claim, runtime, completion, preparation, artifact/publication, execution lease, matrix inflight, fleet stage/inflight/review, docs lease, process, listener, and worktree owner producer. Immediately before A guard consumption and immediately before PostgreSQL apply, resume reobserves the held fence and requires exactly zero unrelated owners. A nonzero census leaves the same operation pending, consumes no guard, makes no PostgreSQL call, and admits no competing owner. The fence remains held through terminal receipt publication/reopen and is released only afterward; terminal visibility requires its release record. No A authorization, fence, or B operation may exist before the fixed pending record, and no guard consumption or PostgreSQL call may occur before the active-operation locator. Race B migration and A cutover prepares plus every enumerated owner producer and require one fence holder, no admitted owner while held, one apply, and one byte-identical adopted receipt. `verifyActiveGoldenLaunchOperationMigrationReleaseV1()` is valid only after terminal visibility and is read-only verification, never recovery. Reject a missing/replayed/wrong-purpose/nonzero guard or fence; source branch/dirt/SHA/tree/build drift; merge-receipt mismatch; migration-module, ordered-statements, or named-digest-entry drift; digest drift; A historical/migration drift; partial/wider schema; unknown fields; wrong ref/hash; symlink/hardlink/mode drift; caller SQL/ID/database/root; and a second release operation. Assert every failure before terminal verification leaves repository, starter, preflight, admission, fixture, process, browser, HTTP, and real-run counters zero. Exercise distinct strict descendant source fixtures representing C, D, and E: each passes only while the dedicated B module blob, ordered statements, named digest entry, digest, and schema projection remain exact; an unrelated append-only aggregate registry/digest entry remains valid, while a nonancestor or changed B named projection fails before any downstream counter.

- [ ] **Step 5: Run the collector test and confirm the missing repository failure**

Run:

```bash
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test tests/internal-production/golden-run-repository.test.ts
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test tests/internal-production/golden-launch-operation-migration-release-v1.test.ts
```

Expected: FAIL because `createPostgresGoldenRunRepository` and the migration-release operation are not defined.

- [ ] **Step 6: Implement the read-only repository**

`src/db/golden-launch-operation-v1-migration.ts` is the sole SQL and schema-projection owner. Register its strict contract-spine migration, which creates `internal_production_golden_launch_operations(operation_hash PRIMARY KEY, issued_receipt_hash, execution_binding_hash, request_hash, claim_secret_hash, migration_release_receipt_hash NOT NULL, run_id UNIQUE NOT NULL)` and adds nullable unique `runs.golden_launch_operation_hash`. Add unique composite keys for `(operation_hash,run_id)` and `(golden_launch_operation_hash,id)` plus reciprocal composite foreign keys between those exact pairs, both `DEFERRABLE INITIALLY DEFERRED`, so only one transaction may insert the mutually equality-bound operation/run pair and commit cannot leave either side dangling or cross-paired. Historical runs retain null and require no operation row; there is no backfill or inferred operation. The module exports the fixed migration ID, ordered statements, and exact read-only schema projector; `contract-spine-migrations.ts` only appends its registration and `contract-spine-migration-digests.generated.ts` only appends the exact named digest entry; neither aggregate file is wholly pinned. No other module contains SQL for this schema. Refresh the exact named migration digest and add isolated migration tests for idempotence, required terminal release-receipt hash, unique operation/run binding, cross-pair rejection, deferred atomic commit, rollback at every insert boundary, and historical null compatibility. Task 2 only reads this relation after the terminal release; Task 3 is the sole operation-claim writer.

Implement the migration-release module with one fixed private namespace below `golden-results/migration-releases/internal-production-golden-launch-operation-v1/`: the sole fixed full `pending-input.json`, content-addressed `operations/` and `receipts/`, plus exact `active-operation.json` and `terminal-receipt.json` locators. There is no `pending-inputs/` store and no second pending locator. The pending ref is the constant canonical namespace ref; its hash is over the strict body with only derived `pendingInputRef/pendingInputHash` omitted, making the projection acyclic. Every directory/file uses the shared real-contained `0700`/`0600`, unpredictable sibling temporary, file-fsync, no-replace, parent-fsync, and `O_NOFOLLOW` reopen protocol. Prepare writes and reopens the supplied merge and raw A guard pairs inside that one fixed record as its first durable action. It then acquires A's exact shared owner-admission fence, calls only A's purpose-bound bind seam, derives every operation field from current clean canonical source, its authenticated build, A's historical migration receipt, the dedicated migration module/ordered statements, named digest entry, and planned projection, and publishes the immutable operation plus active locator before returning. B never opens or consumes A's generic guard/fence stores. Only `executeOrRecoverGoldenLaunchOperationMigrationReleaseV1()` or zero-input resume may call A's exact fence reobserver and purpose-bound consumer for that operation and then invoke fixed plan/apply/verify; neither accepts SQL, database URL, migration ID, source, digest, schema, census, fence, or a new guard.

Before the fixed pending record is durable, only same-input prepare retry is legal and no A/B side effect is orphanable. After it is durable, zero-input recovery reopens `pending-input.json`, acquires or reopens A's exact fence, and reopens A's authorization plus `active-operation.json` when present, never a directory scan; it creates only the first absent member in that order. Guard consumption is delegated only to A after the active locator is durable and a fresh fence reobservation is zero. A pending exact plan is applied once only after a second adjacent zero reobservation; an already committed transaction is adopted only when fresh verification yields the operation's byte-identical planned projection and registered digest. It then publishes and reopens the terminal receipt, CAS-publishes `terminal-receipt.json`, releases the fence, and only then exposes terminal status. A terminal locator makes prepare typed-idempotent only for the same source/merge/tree/migration identity and makes another source or operation fail closed. `verifyActiveGoldenLaunchOperationMigrationReleaseV1()` accepts no input and is callable only after `terminal-receipt.json` and the matching fence-release record are durable; it reopens the fixed records and nested A/merge/fence/authorization/consumption authorities, reruns the read-only contract-spine verifier, and recomputes the immutable application-source/tree/dedicated-module/ordered-statements/named-entry/digest/schema/operation/receipt chain. It never requires current HEAD to equal the application SHA. `verifyCurrentGoldenLaunchOperationMigrationV1()` first calls that immutable verifier, then freshly observes literal clean `main`, `HEAD === refs/remotes/origin/main ===` fresh remote main, proves current HEAD descends from `applicationSourceSha`, and requires the current dedicated migration module blob, ordered statements, named digest entry, digest, and fresh schema projection to equal the receipt; unrelated append-only registry/digest entries are allowed. It returns the strict current verification with separate current SHA/tree and hash. Both verifiers are read-only and never recover, repair, apply, allocate, start, or write. The repository invokes the fresh current verifier before opening its read transaction and requires every nonhistorical launch-operation row's `migration_release_receipt_hash` to equal the returned `receiptHash`; an absent, stale, partial, or foreign pair blocks all reads that could authorize a start.

Define the port exactly:

```typescript
export interface GoldenRunRepository {
  inspectPlatform(): Promise<GoldenPlatformInspectionV1>;
  readRun(runId: string): Promise<GoldenRunPollV1>;
  findLaunchCandidates(
    input: GoldenLaunchCandidateQueryV1,
  ): Promise<readonly GoldenLaunchCandidateAuthorityV1[]>;
  collectRun(runId: string, goldenCase: GoldenCaseV1): Promise<GoldenCanonicalCollectionV1>;
  collectAssertionAuthority(
    runId: string,
    goldenCase: GoldenCaseV1,
  ): Promise<GoldenCollectedAssertionAuthorityV1>;
  close?(): Promise<void>;
}

export type GoldenRunRepositoryOptionsV1 = Readonly<{
  artifactRoot?: string;
  artifactLimits?: ArtifactCapacityLimits;
  publicationAuthorityMode?: ArtifactStorePublicationAuthorityMode;
  workflowEvidence?: GoldenWorkflowEvidenceCollectorPort;
}>;

export function createPostgresGoldenRunRepository(
  sql: postgres.Sql,
  options: GoldenRunRepositoryOptionsV1 = {},
): GoldenRunRepository;
```

`GoldenLaunchCandidateQueryV1` contains only the strategy/workflow, post-provision full internal task hash, requested release/compiler constraint, nullable V3 admission/slot hashes, and either `starterOperationHash:null` for the before-set capture or one exact issued operation hash for recovery/adoption. The repository hashes `runs.task` in memory and discards it, validates strategy joins, sorts by opaque run ID, and caps at `64`. For an issued query it joins the strict launch-operation row and requires its operation/request/claim-secret/issued-receipt hashes plus unique run ID to be internally consistent. The returned authority contains exact run/workflow/protocol/compiler/release/admission/full-task/operation/row hashes but no raw task, path, selector, claim secret, time, or output. Read `runs.protocol_version` as its existing PostgreSQL integer and require a non-null positive TypeScript number; do not cast it to text, coalesce it, infer it from `requestedProtocol`, or alter/backfill the database column or its existing constraint. The request discriminator and actual run protocol/version remain independently equality-bound in launch and start receipts. The lookup port separately authenticates and equality-binds Task 1's logical correlation, execution binding, issued operation, and existing-repository attempt before and after this read; the repository never claims to derive a nonexistent path/full task from the pre-provision intent.

Define the internal collector handoff exactly:

```typescript
export type GoldenActiveRunGenerationV1 =
  | Readonly<{
      kind: "story-claim-generation";
      storyDbId: string;
      storyId: string;
      workflowStepId: string;
      claimId: number;
      runtimeSessionId: string;
      claimGeneration: number;
      generationHash: string;
    }>
  | Readonly<{
      kind: "workflow-step-claim-generation";
      stepDbId: string;
      workflowStepId: string;
      claimId: number;
      runtimeSessionId: string;
      claimGeneration: number;
      generationHash: string;
    }>;

export type GoldenCollectedAssertionAuthorityV1 = Readonly<{
  runId: string;
  source: Readonly<{
    checkoutPath: string;
    acceptedSha: string;
    acceptedTreeHash: string;
    sourceRef: string;
  }>;
  invocation:
    | Readonly<{
        kind: "node-cli";
        executablePath: string;
        argvPrefix: readonly string[];
        workingDirectory: string;
        stateDirectory: string;
        timeoutMs: number;
      }>
    | Readonly<{ kind: "not_applicable"; reason: "runtime_only" | "profile_owned" }>;
  runtime:
    | Readonly<{
        kind: "sealed-verifier-contract";
        adapter: "http" | "browser";
        contract: RuntimeEvidenceContractV1;
        contractHash: string;
        stackPackId: string;
        authorityRef: string;
      }>
    | Readonly<{ kind: "not_applicable"; reason: "cli_only" | "not_deployed" }>;
  workflowEvidence: GoldenWorkflowEvidenceV1 | null;
}>;

export type GoldenWorkflowEvidenceV1 = Readonly<{
  kind: "authenticated-opaque-workflow-evidence";
  workflowEvidenceHash: string;
  capability: unknown;
}>;

export interface GoldenWorkflowEvidenceCollectorPort {
  collect(input: Readonly<{
    runId: string;
    workflowId: "feature-dev" | "bug-fix" | "security-audit";
    sourceRef: string;
    acceptedSha: string;
    acceptedTreeHash: string;
  }>): Promise<GoldenWorkflowEvidenceV1 | null>;
}
```

`GoldenRunPollV1.activeGeneration` is `GoldenActiveRunGenerationV1 | null`. The story member is selected only from one open story claim and its one nonreleased runtime session with matching run/step/story and positive persisted `stories.claim_generation`. The workflow-step member is selected only from one open `claim_log` row with `story_id IS NULL`, its exact running `steps.id`, and its one nonreleased `runtime_sessions` row; its positive `claimGeneration` is the stable one-based ordinal `COUNT(claim_log.id <= activeClaimId)` for the exact `(run_id, step_id, story_id IS NULL)` coordinate. Compute `generationHash` from every member field plus `runId`. Fail closed if the join is incomplete, stale, has multiple active candidates, has multiple nonreleased runtime sessions, or a later read changes any coordinate. This deliberately supports canonical legacy/shadow `post-pr-review` while retaining story-generation authority for V3. `collectAssertionAuthority()` validates absolute regular paths under the collected project root, validates the accepted source SHA/tree and code-owned invocation/runtime receipt bindings, and returns no arbitrary command, environment map, or caller-chosen origin. For HTTP/browser profiles it parses the exact sealed `RuntimeEvidenceContractV1` referenced by the accepted evidence plan, verifies `contractHash`, stack-pack binding, and canonical authority ref, and returns it only through this internal type; it never trusts `package.json` scripts chosen after acceptance. For CLI it returns the exact accepted invocation authority.

`GoldenRunRepositoryOptionsV1` is the sole exported options identity. It contains every existing inline factory option exactly once, including `workflowEvidence`; the factory signature imports/uses that type directly and defines no second inline object. Source-boundary and declaration tests prove a consumer such as Subproject D can import the exact symbol, that assigning each existing option compiles, and that removing, renaming, widening, or locally redeclaring `workflowEvidence` fails the identity check. `createPostgresGoldenRunRepository(..., { workflowEvidence })` defaults to a code-owned null collector and accepts no runtime/CLI-selected provider. After source/run/workflow authority is exact, `collectAssertionAuthority()` calls the injected collector once. A non-null response must have the exact literal kind, a `Sha256Schema` hash, a non-null object capability whose complete graph is already deeply frozen, and no enumerable wrapper key other than the three shown. B deliberately treats `capability` as opaque and never imports, clones, traverses for hashing, serializes, stores, or authenticates C's concrete type—including `GoldenPostPrReviewEvidenceV1`; its only binding input is the supplied `workflowEvidenceHash`. The C collector mints/authenticates the inner value through its own private WeakMap, and the C repository adapter authenticates the exact same reference before use. This hook is called only inside Task 5 and neither internal authority type is accepted by a public schema.

Reuse `verifyContractSpineMigrations`, `readContractSpineMigrationAttestation`, `verifyArtifactIndexInventory`, and `createRuntimeArtifactReader`. Build the authoritative snapshot through `buildRunOperationalSnapshot(sql, runId)`. Require V3 only when `goldenCase.startStrategy.kind === "v3-feature-dev-canary"`; for a canonical existing-repository workflow, retain the actual `runs.protocol` and `runs.protocol_version` and collect only the authorities that protocol genuinely produced. Read ordered step/story identity with:

```sql
SELECT step_id, step_index, status, retry_count, output
  FROM steps
 WHERE run_id = $1
 ORDER BY step_index, step_id;

SELECT story_id, story_index, status, depends_on, story_branch, pr_url, merge_status,
       retry_count
  FROM stories
 WHERE run_id = $1
 ORDER BY story_index, story_id;

SELECT attempt_id, story_id, branch, worktree, disposition,
       source_after_sha, source_after_tree_hash
  FROM execution_attempts
 WHERE run_id = $1
 ORDER BY created_at, attempt_id;
```

Hash raw step output immediately and discard it, except for parsing the finite deploy non-deployable fields. Parse `depends_on` as its existing JSON/string representation, canonicalize it to sorted story IDs, and never publish the raw DB value. Use the operational snapshot for claim/runtime/completion/effect/outbox/finding/recovery/deploy/transfer evidence; direct counts are cross-checks and a mismatch becomes `GOLDEN_CANONICAL_CENSUS_MISMATCH`.

For a V3 feature-development canary, audit the packet with `auditExactTerminalPacket(runId)` and expose only its canonical refs, packet hash, producer code SHA, stack-pack ID, story IDs/dependency edges, required evidence-predicate IDs, and compilation status. For a canonical existing-repository workflow, set V3-only packet/admission/deploy/transfer identities to `not_applicable`, retain its actual workflow/protocol/version plus exact final source/PR/test identities, and never synthesize V3 authority. Preserve exact accepted candidate, deploy receipt, release admission, project transfer, source revision, and PR identities only when actually present. Return attempt worktree paths, verified fixture path, deploy process/listener identities, and `GoldenCollectedAssertionAuthorityV1` only through internal methods consumed by the fixture, assertion-subject assembler, and cleanup ports; exclude those absolute paths from `GoldenRunEvidenceV1`.

- [ ] **Step 7: Run focused and adjacent tests**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-snapshot.test.ts
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test tests/internal-production/golden-run-repository.test.ts
node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test tests/internal-production/golden-launch-operation-migration-release-v1.test.ts
npm run test:evals
node --import tsx --test tests/run-operational-snapshot.test.ts
npx tsc -p tsconfig.json --noEmit
npm run check:migration-digests
git diff --check
```

Expected: all commands exit `0`; both V2 and V3 snapshots parse, V3 failure identity is retained, the launch-operation migration is exact/idempotent, its guarded release is crash-adoptable and freshly verified, and all golden repository runtime writes remain absent.

- [ ] **Step 8: Record the Task 2 Setfarm handoff checkpoint**

Run `git status --short` and `git diff --check`, verify the exact Task 2 scope, and return the file list plus focused/adjacent evidence to the active Setfarm claim. Do not stage or commit.

---

### Task 3: Observe release identity, Mission Control rendering, GitHub state, and host cleanup

**Files:**
- Create: `src/internal-production/golden-run-observers.ts`
- Create: `src/internal-production/golden-source-build-authority.ts`
- Create: `tests/internal-production/golden-run-observers.test.ts`
- Create: `tests/internal-production/golden-source-build-authority.test.ts`
- Create: `tests/execution-attempts/golden-launch-operation-v1.test.ts`
- Modify: `src/cli/cli.ts`
- Modify: `src/execution/run-persistence.ts`

**Interfaces:**
- Consumes: Task 1 contracts and private data-root resolver; Task 2's exact `GoldenLaunchOperationMigrationReleaseReceiptV1`, `GoldenLaunchOperationMigrationCurrentVerificationV1`, and zero-argument `verifyCurrentGoldenLaunchOperationMigrationV1()`; `createNodeConvergenceProcessPort()` and its `inspectRelease`, V3 `startRun`, `inspectProject`, and `inspectGitHub` methods; Task 2 snapshot parser; `observeProcessIdentity(pid)` and `sameProcessIdentity(expected, observed)`; Playwright `chromium`; fixed service URLs `http://127.0.0.1:3333` and `http://127.0.0.1:3080`.
- Produces: `GoldenCanonicalSourceBuildRootsV1`, `resolveCanonicalInternalProductionSourceBuildRootsV1()`, `sealCanonicalInternalProductionSourceBuildRootsV1(roots)`, `reopenCanonicalInternalProductionSourceBuildRootsV1(authorityHash)`, `resolveActiveSetfarmClaimRootV1()`, `GoldenMissionControlBuildManifestV1`, `computeMissionControlBuildManifestV1(roots)`, `GoldenFinalizationSourceBuildV1`, `buildCanonicalInternalProductionSourcesV1()`, `GoldenReleaseObserver`, `GoldenExistingRepositoryFixturePort`, `GoldenAuthenticatedFixtureTemplateV1`, `inspectGoldenFixtureTemplateV1(template)`, `authenticateGoldenFixtureTemplateV1(value)`, `GoldenAuthenticatedFixtureWorkflowV1`, `authenticateGoldenFixtureWorkflowV1(value)`, `executeAuthenticatedGoldenFixtureVerificationV1(input)`, `GoldenFixtureVerificationExecutionV1`, `GoldenRunStarter`, `GoldenRunLaunchLookupPort`, `GoldenProjectAssertionAuthorityV1`, `GoldenProjectObserver`, `GoldenProjectionObserver`, `GoldenHostCleanupObserver`, `createNodeGoldenReleaseObserver()`, `createGoldenExistingRepositoryFixturePort()`, `createCompiledCliGoldenRunStarter()`, `createCanonicalGoldenRunLaunchLookupPort()`, `createNodeGoldenProjectObserver()`, `createLiveGoldenProjectionObserver()`, and `createNodeGoldenHostCleanupObserver()`.
- Mutation boundary: observers perform reads, HTTP GETs, one Mission Control project-sync POST already used by convergence, browser navigation, and the explicitly authorized idempotent compiled-CLI launch-operation claim. Only the run-creation transaction may atomically bind one operation row to one new or already bound run. Observers do not terminate processes, remove worktrees, release leases, change ports, or restart services.

- [ ] **Step 1: Write failing observer contract tests**

Use local fake HTTP servers and a fake Playwright page adapter. Assert:

- Setfarm `/` and Mission Control `/api/health` are each bounded by `30_000 ms`;
- snapshots come from `/api/runs/:id/operational-snapshot` and `/api/setfarm/runs/:id/operational-snapshot`;
- project sync uses only `POST /api/setfarm/sync-projects?runId=:id`;
- render navigation uses only `http://127.0.0.1:3080/setfarm/runs/:id`;
- render waits for `[aria-label="Canonical operational evidence"]` and `[aria-label="Canonical Product Build authority"]`;
- render records `.rd-status[title="Canonical operational snapshot status"]`, `[title="Operational status source"]`, both panel text hashes, screenshot hash, and console-error hashes without storing text or screenshot bytes;
- cleanup checks only exact process identities, receipt ports, project roots, and attempt worktrees supplied by the canonical collector;
- fixture resolution accepts only the `resolveInternalProductionDataRootV1()` child `fixtures/`, shared across Setfarm-managed worktrees, and verifies a regular non-symlink repository, `main` branch, clean worktree, manifest hash, baseline commit/tree, fixture hash, and canonical fixture ref while returning no path in public evidence;
- pre-start fixture resolution opens the ignored mode-`0600` `fixture-manifest.json` sidecar with `O_NOFOLLOW`, parses it with `GoldenExistingRepositoryFixtureManifestV1Schema`, verifies the tracked `.gitignore` contains the exact standalone `/fixture-manifest.json` rule, and requires the exact origin URL and current `refs/remotes/origin/main` SHA to equal the immutable baseline without fetching; post-run inspection preserves and rehashes that immutable baseline manifest but does not miscompare the advanced remote to the baseline;
- `inspectWorkflow` returns one deeply frozen WeakMap-authenticated internal capability containing the resolved path, finite mutable paths, exact verification commands, and manifest/origin/baseline hashes; a structural clone, JSON round-trip, post-mint mutation, wrong workflow, or wrong fixture cannot authenticate, and its path/commands never enter a result, CLI line, store, preview, or report;
- B source-boundary inspection finds only its own pre-start/subject-assembly consumers and permits the downstream consumer count to be zero at B delivery time. C's later source-boundary suite must extend the closed program audit to the exact repository assertion and one fixed catalog/materializer module, authenticate then discard the capability, persist only fixture/attempt identities, and reject any fifth total consumer or serialization. B never imports or requires an absent future C file.
- the authenticated verification executor resolves only the manifest's exact code-owned command IDs to fixed contained verifier files, uses `shell:false`, the authenticated repository cwd, normalized environment, and bounded output; pre requires local HEAD/tree and current remote main to equal the immutable baseline, while post preserves that baseline identity, requires local HEAD/tree to equal the accepted source and every baseline-to-source changed path to match an allowed mutable path, and accepts current remote-main equality only from C's authenticated Setfarm-owned integration evidence;
- V3 start calls the existing convergence process adapter with one admission context and exact `--protocol v3`;
- existing-repository start calls only `bug-fix` or `security-audit`, appends the verified `--repo`/`--branch main` suffix internally, supplies no canary environment, and supplies no protocol override;
- before both starts, the path-free intent is already fsynced, the launch lookup captures an authoritative bounded set against the post-provision full task, and the phase store fsyncs one `GoldenLaunchExecutionBindingV1`; after the durable starter-issued/outbox boundary, the compiled CLI atomically claims the operation while creating or reopening its run, and exact DB/admission/fixture predicates yield one and only one operation-bound run plus a path-free start receipt bound to the intent, execution binding, issued receipt, and operation hashes; zero or multiple candidates fail without inference;
- interruption before outbox fsync starts nothing; interruption after outbox fsync but before subprocess entry, after child entry but before the transaction, during transaction response loss, after commit before stdout, and before `run-bound` is idempotently resumed with the same operation. Every retry either creates the one operation-bound run or returns that exact run; a changed request/claim secret, an operation bound to another run, two rows, or an unbound committed operation fails closed;
- an observation error produces `unavailable` evidence instead of zero leaks or a passing result.
- source/build authority resolution is independent of `cwd` and sibling layout, validates one unique current listener/process for each stable service role against the semantic role/root/Git-common-dir/package/remote/source-SHA/installed-output projection, and for both Setfarm and Mission Control requires the observed source root's branch exactly `main` plus `sourceSha === HEAD === refs/remotes/origin/main === fresh remote refs/heads/main`. The sole remote reader is one private code-owned bounded `execFile` call with `shell:false`, the authenticated canonical remote, and exact argv `git ls-remote --refs REMOTE refs/heads/main`. It always uses one fixed real empty mode-`0700` non-symlink directory outside both repositories as `cwd`, plus a replacement rather than inherited environment containing only a fixed trusted `PATH`, isolated empty `HOME` and `XDG_CONFIG_HOME`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_TERMINAL_PROMPT=0`, `LANG=C`, and `LC_ALL=C`. It permits no inherited `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_*`, `GIT_CONFIG_VALUE_*`, other `GIT_CONFIG*`, `url.*.insteadOf`, credential helper, `GIT_SSH*`, `SSH_*`, askpass, upper/lowercase proxy, `NO_PROXY`, or locale member. The call has an exact `15_000 ms` timeout and `4096`-byte stdout/stderr caps; it accepts exactly one lowercase forty-hex `<sha>\trefs/heads/main\n` record with empty stderr and rejects zero, duplicate, symref, extra-ref, malformed, stderr, oversized, signal, timeout, or nonzero output. It fetches, writes, or updates no local ref. The authority binds literal branch plus `sourceSha`, `headSha`, local `originMainSha`, and fresh `remoteMainSha`, all equal, and seals/reopens the same content-addressed authority after a same-SHA rebuild or cold service PID restart. Resolution, pre-build, post-each-build, seal, reopen, and materialization tests poison caller cwd/HOME/XDG, system/global/repository Git config, `GIT_CONFIG_COUNT/KEY/VALUE`, URL rewrites, credential helper, SSH/askpass, proxies, and locale at every remote-read boundary and prove they cannot alter the exact observation. They reject a nonempty/symlink/wrong-mode safe cwd, detached/feature branch, local-ahead or local-behind `HEAD`, stale/missing/noncommit local tracking main, a fresh remote move with stale local tracking, local movement without remote equality, ambiguous remote output, dirty state, and drift before the next build/read/write. Semantic installed-output manifests exclude only the schema-declared volatile `builtAt` field and reject every other artifact drift without containing absolute paths, PIDs, listener hashes, or timestamps.

For the sidecar regression, construct the seed baseline in this exact order: commit `.gitignore` with `/fixture-manifest.json`, compute commit/tree, set remote main to that commit, then write the mode-`0600` manifest. Assert `git status --porcelain --untracked-files=all` is empty. Reject a manifest committed into Git, written before baseline identity, mode `0644`, symlinked, outside the fixed fixture root, lacking the exact ignore line, hidden by a broad rule without the exact line, negated later, hash-mismatched, origin-mismatched, or remote-main-mismatched.

Add a source-boundary test that reads `golden-run-observers.ts` and asserts it contains `createNodeConvergenceProcessPort`, does not import `../installer/run.js`, does not contain `runWorkflow(`, and does not reference `SETFARM_SKIP_RUNTIME_GUARD`, `SETFARM_ALLOW_DIRTY_BUILD`, or `--force-quota`. Inspect the recorded ordinary workflow argv for both strategies and prove the existing-repository request has no `--protocol` element and its environment has no `SETFARM_INTERNAL_CONVERGENCE_ADMISSION` key. Prove the internal launch mode receives only the code-owned descriptor number, rejects a closed/writable/non-pipe descriptor and every public argv/environment operation hash or secret, and that an ordinary CLI caller cannot enter it.

- [ ] **Step 2: Run the observer tests and confirm failure**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-observers.test.ts tests/internal-production/golden-source-build-authority.test.ts tests/execution-attempts/golden-launch-operation-v1.test.ts
```

Expected: FAIL because the observer module does not exist.

- [ ] **Step 3: Implement release and compiled-CLI observers**

First implement the trusted source/build boundary with the exact ABI below; Task 6 reuses it unchanged:

```typescript
export type GoldenCanonicalSourceBuildRootsV1 = Readonly<{
  schema: "setfarm.internal-production-source-build-roots.v1";
  authorityHash: string;
}>;

export async function resolveCanonicalInternalProductionSourceBuildRootsV1():
  Promise<GoldenCanonicalSourceBuildRootsV1>;

export async function sealCanonicalInternalProductionSourceBuildRootsV1(
  roots: GoldenCanonicalSourceBuildRootsV1,
): Promise<Readonly<{ authorityHash: string; authorityRef: CanonicalRef }>>;

export async function reopenCanonicalInternalProductionSourceBuildRootsV1(
  authorityHash: string,
): Promise<GoldenCanonicalSourceBuildRootsV1>;

export async function resolveActiveSetfarmClaimRootV1(): Promise<Readonly<{
  sourceRoot: string;
  headSha: string;
  clean: true;
  identityHash: string;
}>>;

export type GoldenMissionControlBuildManifestV1 = Readonly<{
  schema: "setfarm.internal-production-mission-control-build-manifest.v1";
  sourceSha: string;
  files: readonly Readonly<{
    path: string;
    mode: number;
    semanticSizeBytes: number;
    semanticContentHash: string;
  }>[];
  totalSemanticSizeBytes: number;
  manifestHash: string;
}>;

export async function computeMissionControlBuildManifestV1(
  roots: GoldenCanonicalSourceBuildRootsV1,
): Promise<GoldenMissionControlBuildManifestV1>;

export type GoldenFinalizationSourceBuildV1 = Readonly<{
  sourceBuildAuthorityHash: string;
  sourceBuildAuthorityRef: CanonicalRef;
  setfarm: Readonly<{
    command: "npm run build";
    branch: "main";
    sourceSha: string;
    headSha: string;
    originMainSha: string;
    remoteMainSha: string;
    semanticBuildInfoHash: string;
  }>;
  missionControl: Readonly<{
    command: "npm run build";
    branch: "main";
    sourceSha: string;
    headSha: string;
    originMainSha: string;
    remoteMainSha: string;
    buildManifest: GoldenMissionControlBuildManifestV1;
  }>;
  buildReceiptHash: string;
}>;

export async function buildCanonicalInternalProductionSourcesV1():
  Promise<GoldenFinalizationSourceBuildV1>;
```

Then define these observer ports:

`GoldenLaunchIntentV1`, `GoldenLaunchExecutionBindingV1`, `GoldenStarterInvocationIssuedV1`, and `GoldenRunStartReceiptV1` are imported directly from Task 1's contract module. Task 3 does not redeclare, alias, structurally restate, or re-export a local lookalike. Its compile-time boundary test assigns the imported Task 1 symbol through the starter/lookup interfaces and fails if another declaration named `GoldenRunStartReceiptV1` appears in `golden-run-observers.ts`.

```typescript
export interface GoldenReleaseObserver {
  inspect(input: Readonly<{ workflowId: string }>): Promise<GoldenReleaseInspectionV1>;
}

export interface GoldenRunStarter {
  start(input: Readonly<{
    issued: GoldenStarterInvocationIssuedV1;
  }>): Promise<Readonly<{
    intentHash: string;
    starterOperationHash: string;
    runId: string;
    runNumber: number;
    invocationReceiptHash: string;
  }>>;
}

export interface GoldenRunLaunchLookupPort {
  capturePreStartSet(input: Readonly<{
    intent: GoldenLaunchIntentV1;
    goldenCase: GoldenCaseV1;
    releaseSha: string;
    fullLaunchTaskHash: string;
    fixtureAttempt: GoldenExistingRepositoryFixtureAttemptV1 | null;
  }>): Promise<Readonly<{
    matchingRunIds: readonly string[];
    preStartRunSetHash: string;
  }>>;
  resolve(input: Readonly<{
    intent: GoldenLaunchIntentV1;
    executionBinding: GoldenLaunchExecutionBindingV1;
    starterInvocationIssued: GoldenStarterInvocationIssuedV1;
    authorization: GoldenPreStartAuthorizationReceiptV1;
    admissionBinding: GoldenCanaryIntentAdmissionReceiptV1 | null;
    fixtureAttempt: GoldenExistingRepositoryFixtureAttemptV1 | null;
    invocationReceipt?: Readonly<{
      intentHash: string;
      starterOperationHash: string;
      runId: string;
      runNumber: number;
      invocationReceiptHash: string;
    }>;
  }>): Promise<readonly GoldenRunStartReceiptV1[]>;
}

export interface GoldenProjectObserver {
  inspectProject(input: GoldenProjectInspectionInputV1): Promise<GoldenProjectInspectionV1>;
  inspectAssertionAuthority(
    input: GoldenProjectInspectionInputV1,
  ): Promise<GoldenProjectAssertionAuthorityV1>;
  inspectGitHub(pullRequests: readonly GoldenPullRequestIdentityV1[]): Promise<GoldenGitHubInspectionV1>;
}

export type GoldenProjectAssertionAuthorityV1 = Readonly<{
  repositoryPath: string;
  repositoryRef: string;
  headSha: string;
  treeHash: string;
  clean: true;
}>;

export type GoldenRunStartRequestV1 =
  | Readonly<{
      kind: "v3-feature-dev-canary";
      intentHash: string;
      recoveryContextHash: string;
      executionBindingHash: string;
      workflowId: "feature-dev";
      task: string;
      releaseSha: string;
      admission: InternalCanaryAdmissionContextV1;
    }>
  | Readonly<{
      kind: "canonical-existing-repository-workflow";
      intentHash: string;
      recoveryContextHash: string;
      executionBindingHash: string;
      workflowId: "bug-fix" | "security-audit";
      task: string;
      fixtureAttempt: GoldenExistingRepositoryFixtureAttemptV1;
      fixture: GoldenResolvedExistingRepositoryFixtureV1;
    }>;

export interface GoldenExistingRepositoryFixturePort {
  resolve(
    identity: GoldenExistingRepositoryFixtureIdentityV1,
  ): Promise<GoldenResolvedExistingRepositoryFixtureV1>;
  verifyWorkflow(
    identity: GoldenExistingRepositoryFixtureIdentityV1,
    workflowId: "bug-fix" | "security-audit",
  ): Promise<void>;
  inspectWorkflow(
    identity: GoldenExistingRepositoryFixtureIdentityV1,
    workflowId: "bug-fix" | "security-audit",
  ): Promise<GoldenAuthenticatedFixtureWorkflowV1>;
}

export type GoldenAuthenticatedFixtureTemplateV1 = Readonly<{
  schema: "setfarm.internal-production-authenticated-fixture-template.v1";
  template: GoldenExistingRepositoryFixtureTemplateV1;
  templatePath: string;
  allowedMutablePaths: readonly string[];
  preVerificationCommands: readonly GoldenFixtureVerificationCommandV1[];
  postVerificationCommands: readonly GoldenFixtureVerificationCommandV1[];
  authenticationHash: string;
}>;

export function inspectGoldenFixtureTemplateV1(
  template: GoldenExistingRepositoryFixtureTemplateV1,
): Promise<GoldenAuthenticatedFixtureTemplateV1>;

export function authenticateGoldenFixtureTemplateV1(
  value: unknown,
): GoldenAuthenticatedFixtureTemplateV1;

export type GoldenResolvedExistingRepositoryFixtureV1 = Readonly<{
  identity: GoldenExistingRepositoryFixtureIdentityV1;
  repositoryPath: string;
  headSha: string;
  treeHash: string;
}>;

export type GoldenAuthenticatedFixtureWorkflowV1 = Readonly<{
  schema: "setfarm.internal-production-authenticated-fixture-workflow.v1";
  workflowId: "bug-fix" | "security-audit";
  identity: GoldenExistingRepositoryFixtureIdentityV1;
  repositoryPath: string;
  repositoryUrl: string;
  seedHash: string;
  baselineSha: string;
  baselineTreeHash: string;
  remoteMainSha: string;
  manifestHash: string;
  allowedMutablePaths: readonly string[];
  preVerificationCommands: readonly GoldenFixtureVerificationCommandV1[];
  postVerificationCommands: readonly GoldenFixtureVerificationCommandV1[];
  authenticationHash: string;
}>;

export function authenticateGoldenFixtureWorkflowV1(
  value: unknown,
): GoldenAuthenticatedFixtureWorkflowV1;

export type GoldenFixtureVerificationExecutionV1 = Readonly<{
  schema: "setfarm.internal-production-fixture-verification-execution.v1";
  workflowId: "bug-fix" | "security-audit";
  fixtureHash: string;
  phase: "pre" | "post";
  expectedSourceSha: string;
  expectedSourceTreeHash: string;
  commandReceiptHashes: readonly string[];
  changedPathSetHash: string;
  verificationHash: string;
}>;

export function executeAuthenticatedGoldenFixtureVerificationV1(input: Readonly<{
  capability: GoldenAuthenticatedFixtureWorkflowV1;
  phase: "pre" | "post";
  expectedSource: Readonly<{
    sha: string;
    treeHash: string;
    repositoryRef: string;
  }>;
}>): Promise<GoldenFixtureVerificationExecutionV1>;
```

`inspectGoldenFixtureTemplateV1(template)` accepts only the strict public template identity and derives the one checked-in source directory from the code-owned template-ID map; it accepts no path, root, manifest, command, environment, or remote. It opens only regular one-link files without following symlinks, rejects `.git`, remotes, sidecars, special files, and unexpected executable bits, recomputes the canonical seed bytes/hash plus code-owned allowed-path and pre/post-command-ID set hashes, and equality-binds all of them to the template. It returns a deeply frozen `GoldenAuthenticatedFixtureTemplateV1` registered in the observers module's private `WeakMap`; `authenticateGoldenFixtureTemplateV1()` requires exact identity and recomputed authentication hash. Its absolute `templatePath`, mutable paths, and command-ID objects never enter a catalog, attempt receipt, CLI output, store, result, or report. B's source-boundary test permits zero downstream C consumers at B delivery time; C later permits only `existing-repository-fixture-catalog.ts`, authenticates the capability there, and returns only public identities.

`GoldenResolvedExistingRepositoryFixtureV1` is an internal-only object containing the unchanged identity, `repositoryPath`, verified `headSha`, and verified `treeHash`. `createGoldenExistingRepositoryFixturePort()` derives the only allowed path from `resolveInternalProductionChildV1(["fixtures", campaignId, fixtureId, fixtureHash])`, never from package root or `cwd`; rejects `.`, `..`, normalization changes, symlink/hardlink traversal, and realpath escape at every segment; opens the sidecar `${repositoryPath}/fixture-manifest.json` with `O_RDONLY | O_NOFOLLOW`; requires every private ancestor real/contained/mode `0700` and the manifest a regular one-link file with mode exactly `0600`; parses it with `GoldenExistingRepositoryFixtureManifestV1Schema`; and recomputes `manifestHash`. It opens tracked `${repositoryPath}/.gitignore` without following symlinks, requires exactly one standalone `/fixture-manifest.json` line, and rejects a negating rule for that path. It verifies manifest/identity equality and runs bounded `git` argv reads for `HEAD`, `HEAD^{tree}`, branch `main`, `status --porcelain --untracked-files=all`, `remote get-url origin`, and `rev-parse refs/remotes/origin/main`. The status must be empty with the ignored sidecar present. The pre-start `resolve()`/`verifyWorkflow()` boundary requires the origin output to equal `manifest.repositoryUrl` byte-for-byte after one trailing-newline trim and the current remote ref to equal the immutable `manifest.remoteMainSha === manifest.baselineSha`; it never fetches or rewrites remotes. Preflight never resolves or verifies an attempt because none may exist yet for that launch.

`inspectWorkflow()` repeats the immutable sidecar/mode/ignore/hash/origin/identity/workflow-kind checks and returns `GoldenAuthenticatedFixtureWorkflowV1`, but deliberately preserves `remoteMainSha` as the manifest's immutable baseline field and does not require the current local HEAD or current remote main to remain at baseline. This permits safe reminting after an orchestrator restart when a canonical workflow has produced an accepted source without weakening the pre-start boundary. The observers module owns a private `WeakMap<object, string>`; it stores only the deeply frozen object graph it minted. `authenticationHash` binds the path-free immutable manifest/identity projection, workflow ID, ordered mutable paths, and exact command IDs. `authenticateGoldenFixtureWorkflowV1()` requires WeakMap object identity, deep frozen state, and a recomputed matching hash. The closed consumer allowlist is: B's pre-start verifier, B's subject assembler, C's repository assertion adapter, and C's fixed catalog/materializer boundary, which authenticates identities before tracked catalog generation and immediately discards the capability. No other source file, Zod/public receipt, serializer, CLI output, store, preview, report, or generated catalog value may accept it. Source-boundary tests enumerate these exact consumers and fail on any additional import/call site or capability serialization. `resolve()` and `verifyWorkflow()` retain the stricter clean-baseline local/remote requirement for pre-start callers. No resolver method creates the fixed fixture root when it is absent.

`executeAuthenticatedGoldenFixtureVerificationV1()` first authenticates the exact capability. It re-observes origin/branch/repository ref and strict containment. `pre` requires `expectedSource.sha/treeHash` and current local HEAD/tree/current remote main to equal the manifest baseline plus an empty status. `post` preserves and rehashes the immutable baseline/manifest, requires local HEAD/tree to equal the canonical accepted source, an empty status, and the sorted `git diff --name-only baselineSha..expectedSource.sha` set to be nonempty and fully matched by the strict repository-relative allowed-path matcher; it rejects renames/copies or paths outside that set. Post-run current remote-main equality is not inferred from the immutable manifest or a local fetch: before acceptance the C repository adapter must authenticate Setfarm's integration evidence proving `reviewedHeadSha === acceptedSha === remoteMainSha` and equal trees for this exact attempt. Resolve each command ID through the code-owned phase/seed map to one contained regular one-link verifier and execute only that fixed argv via `execFile("node", [verifiedContainedFile], { cwd:repositoryPath, shell:false, env:NORMALIZED_GOLDEN_VERIFICATION_ENV, timeout:command.timeoutMs, maxBuffer:1 MiB })`; require the declared zero exit and hash/discard stdout/stderr. `commandReceiptHashes`, changed-path-set hash, source identities, phase, and manifest/fixture hashes form `verificationHash`. The receipt contains no command ID, argv, path, output, environment, or process identity.

`inspectAssertionAuthority()` repeats the same Git head/tree/clean verification as `inspectProject()` but returns the verified absolute repository path only on this internal method. Its `repositoryRef` is collector-owned and path-free. It must match the canonical accepted source identity before Task 5 can construct a subject. Neither `GoldenProjectInspectionV1` nor any public evidence type gains a path field.

`createNodeGoldenProjectObserver()` delegates the public `inspectProject` and `inspectGitHub` reads to the convergence adapter and implements only the additional internal path/head/tree/clean verification required by `inspectAssertionAuthority`. `createCompiledCliGoldenRunStarter()` exposes only `start({ issued })`. It parses the Task 1 receipt, derives the sole fixed outbox path from `issued.starterOperationHash`, opens it with `O_RDONLY | O_NOFOLLOW`, requires a regular one-link mode-`0600` file below real mode-`0700` ancestors, rehashes its exact issued receipt, private start request, request hash, and random 32-byte claim secret, and rejects any mismatch before subprocess entry. The caller cannot supply or reconstruct the task, fixture path, admission, executable, argv, environment, descriptor, or claim secret. The starter passes one canonical operation-claim envelope through an inherited read-only descriptor that the compiled CLI alone accepts in internal golden-launch mode; it never places the secret or private request in argv, environment, output, logs, or a public receipt. The V3 request then follows the same code-owned convergence start path. The existing-repository request first requires its fixture identity to equal its attempt fixture, rehashes the attempt/intent/epoch/binding/operation relation, and then selects this exact bounded ordinary workflow argv with `shell:false`, a `120_000 ms` timeout, and the ordinary environment after deleting `SETFARM_INTERNAL_CONVERGENCE_ADMISSION` from a private copy:

```typescript
[
  path.join(packageRoot(), "dist", "cli", "cli.js"),
  "workflow",
  "run",
  operation.request.workflowId,
  `${operation.request.task} --repo ${operation.request.fixture.repositoryPath} --branch main`,
]
```

Consume the Task 2 strict contract-spine migration for `internal_production_golden_launch_operations` and the nullable unique `runs.golden_launch_operation_hash`; Task 3 neither registers nor applies it. The operation row contains only `operation_hash`, `issued_receipt_hash`, `execution_binding_hash`, `request_hash`, `claim_secret_hash`, the exact `migration_release_receipt_hash`, and its unique `run_id`; no raw task, path, selector, or secret is stored there. Its reciprocal deferred composite foreign keys require the operation and run rows to name each other exactly at commit. The internal CLI first calls zero-argument `verifyCurrentGoldenLaunchOperationMigrationV1()`, requires `currentSourceSha`—not immutable `applicationSourceSha`—to equal the issued intent/final epoch/release SHA, and binds the exact terminal ref/hash plus current-verification/schema hashes into the private request. It then parses the inherited envelope, derives and independently reopens the same fixed no-follow outbox by operation hash, requires its request/secret/issued/migration-release bytes to match exactly, recomputes all hashes, and only then calls the run-persistence transaction. Under one transaction and one operation-row lock it returns an existing exact binding or creates the run with `runs.golden_launch_operation_hash`, inserts/binds the operation row with `migration_release_receipt_hash`, and commits them together. A replay freshly reopens the same terminal migration receipt and returns the same run ID/number only for byte-identical request/claim/release authority; missing/stale/corrupt release authority, changed schema projection, a dangling operation, a cross-paired operation/run, another run, or more than one candidate yields `GOLDEN_LAUNCH_OPERATION_AMBIGUOUS` and performs no new insertion. The ordinary public `workflow run` grammar remains unchanged and cannot accept an operation hash/secret/migration flag.

Parse only `/Run:\s*#([1-9][0-9]*)\s*\(([^)]+)\)/u`; hash and discard the bounded output, and return the exact intent/starter-operation/run/number/invocation-receipt binding. A lost subprocess response is recovered by reopening the same outbox and invoking the idempotent claim again, not by guessing from output. Protocol is deliberately absent from this immediate return and is read afterward from PostgreSQL.

`createCanonicalGoldenRunLaunchLookupPort()` reads PostgreSQL through the Task 2 repository's read-only launch query. Before both the before-set query and issued-operation query it freshly calls `verifyCurrentGoldenLaunchOperationMigrationV1()` and requires its terminal pair/current verification hash/current source SHA to equal the admitted preflight, persisted intent, and current clean release SHA while its immutable application SHA may be an ancestor. The initial intent carries only `logicalLaunchCorrelationHash`; it never pretends to know the existing-repository path or full task. After B has provisioned and bound the attempt and resolved its contained path, `capturePreStartSet()` authenticates the intent, equality-binds the exact attempt or V3-null relation, selects and sorts matching run IDs by full task/release authority with `starterOperationHash:null`, and caps the set at `64`. The phase store fsyncs that task/set as one execution binding. `resolve()` authenticates authorization, execution, issued receipt, terminal migration-release pair, and the strategy-matching admission or attempt, then queries the exact non-null `starterOperationHash`. For existing-repository it reopens the immutable attempt/manifest and contained path without requiring current remote main to remain at baseline, equality-binds the stored pre-verification hash that was issued before start, and checks the complete task. It subtracts only the execution binding's explicit IDs and requires the sole remaining row plus operation table to match logical correlation, execution, request, claim-secret hash, migration-release receipt hash, admission/attempt, and issued authority. The returned imported Task 1 start receipt binds the complete chain including `fixturePreVerificationHash` and the exact migration pair. The immediate invocation receipt, an adopted committed row, and every resumed outbox call must identify that same operation/run/release receipt. Zero stays pending for read-only collect, one exact row is adoptable, and multiple/conflicting rows fail as `GOLDEN_LAUNCH_OPERATION_AMBIGUOUS`; no query uses time/log/proximity inference.

`golden-source-build-authority.ts` defines the exact source/build observer, private fresh canonical-remote-main resolver, content-addressed seal/reopen, and semantic-manifest signatures restated in Task 6. Its production resolver accepts no path, rejects `cwd`/new environment/CLI/root input, and authenticates the code-owned live Setfarm and Mission Control service roles through a unique current listener/process whose cwd, health/build SHA, Git common directory, package, remote, source root, installed-build root, literal main branch, and equality-bound source/HEAD/local-origin-main/fresh-remote-main SHAs equal the stable semantic projection. Only its private fixed-cwd/replacement-environment `execFile("git", ["ls-remote","--refs",canonicalRemoteUrl,"refs/heads/main"], {cwd:fixedSafeObserverDirectory,env:normalizedObserverEnvironment,shell:false,timeout:15_000,maxBuffer:4096,encoding:"utf8"})` helper may observe the remote; no public port, dependency, argv, environment, remote, ref, parser, cwd, timeout, or runner override exists. The fixed empty observer cwd and isolated HOME/XDG directories are code-owned, real, mode `0700`, non-symlink, empty, and outside both repositories; failure of any property blocks before `execFile`. The environment is constructed from an empty object with only fixed trusted `PATH`, those isolated `HOME`/`XDG_CONFIG_HOME`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_TERMINAL_PROMPT=0`, `LANG=C`, and `LC_ALL=C`; it never spreads `process.env`. The WeakMap controller may hold the current observed PID/listener identities for immediate checks, but neither those volatile identities nor build `builtAt` enter `authorityHash`. A same-SHA rebuild or cold process restart therefore remints the same authority only when one fresh current process and one fresh exact remote-main observation satisfy the sealed role/root/main/ref/SHA/semantic-build projection. Task 6 consumes this finished module; it does not redefine the resolver.

`createNodeGoldenReleaseObserver()` combines the convergence port's `inspectRelease()` with `resolveCanonicalInternalProductionSourceBuildRootsV1()` and bounded `git rev-parse HEAD`, `git status --porcelain --untracked-files=all`, `package.json`, authenticated Setfarm `dist/BUILD_INFO.json`, and the template path ``workflows/${workflowId}/workflow.yml`` reads under the separately recorded canonical roots. It never derives Mission Control from a Setfarm sibling or `cwd`. It returns exact SHAs, versions, workflow hash, compiler build SHA/dirty bit, runner hash, environment hash, provider/model hashes, CLI readability, and V3 activation status. No absolute path is returned.

- [ ] **Step 4: Implement API and render observation**

Define:

```typescript
export interface GoldenProjectionObserver {
  health(service: "setfarm" | "mission_control"): Promise<GoldenHealthEvidenceV1>;
  syncProject(runId: string): Promise<GoldenSyncEvidenceV1>;
  snapshots(runId: string): Promise<Readonly<{
    setfarm: RunOperationalSnapshotVersioned;
    missionControl: RunOperationalSnapshotVersioned;
  }>>;
  renderRun(runId: string, timeoutMs: number): Promise<GoldenRenderedStateV1>;
}
```

Collect console messages with `message.type() === "error"`, hash each bounded `message.text().slice(0, 4_096)`, and retain at most `32` hashes. Capture one in-memory full-page PNG and retain only its SHA-256. Extract the visible status and schema with the exact selectors above. Hash normalized panel `innerText` separately and close the context/browser in `finally`. A missing selector, navigation failure, console error overflow, or screenshot failure returns a typed unavailable observation; it never produces a passing empty value.

- [ ] **Step 5: Implement exact cleanup observation**

Define:

```typescript
export interface GoldenHostCleanupObserver {
  inspect(input: GoldenCleanupInspectionInputV1): Promise<GoldenCleanupEvidenceV1>;
}
```

For every receipt `ProcessIdentityV1`, call `observeProcessIdentity(pid)` and count a leak only when `sameProcessIdentity(expected, observed)` is true; PID reuse is not a leak for the old identity. For every receipt port, use a bounded TCP connect to `127.0.0.1` and count a leak when the listener remains reachable after terminal settlement. For each attempt worktree, run bounded `git -C "$PROJECT_ROOT" worktree list --porcelain`, compare resolved exact paths, and count retained run-owned entries. Run `git status --porcelain --untracked-files=all` only in the generated project root and return a dirty count of zero or one. Hash the internal observation projection, publish counts and the hash, and discard raw paths and command output.

Observation failures set the corresponding count to `null` and add `GOLDEN_CLEANUP_OBSERVATION_UNAVAILABLE`; null is never interpreted as zero.

- [ ] **Step 6: Run focused and adjacent tests**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-observers.test.ts tests/execution-attempts/golden-launch-operation-v1.test.ts
npm run test:evals
npx tsc -p tsconfig.json --noEmit
npm run check:migration-digests
npm run check:paths
git diff --check
```

Expected: all commands exit `0`; both typed strategies use the compiled CLI, only feature-dev receives V3 admission/protocol flags, and existing-repository protocol remains unknown until the DB read.

- [ ] **Step 7: Record the Task 3 Setfarm handoff checkpoint**

Run `git status --short` and `git diff --check`, verify the exact Task 3 scope, and return the file list plus focused/adjacent evidence to the active Setfarm claim. Do not stage or commit.

---

### Task 3A: Own the verifier-runtime lease and persisted collection phases

**Files:**
- Create: `src/internal-production/golden-verifier-runtime.ts`
- Create: `src/internal-production/golden-run-phase-store.ts`
- Create: `tests/internal-production/golden-verifier-runtime.test.ts`
- Create: `tests/internal-production/golden-run-phase-store.test.ts`

**Interfaces:**
- Consumes: Task 1 hashes and finite contracts; Task 2 `GoldenCollectedAssertionAuthorityV1`; `RuntimeEvidenceContractV1Schema`; `allocateRuntimePort(input)` and `isFetchSafeRuntimePort(port)`; Node `spawn`; `observeProcessIdentity(pid)`; `sameProcessIdentity(expected, observed)`; Task 3 project authority.
- Produces: `GoldenVerifierRuntimeProvisionalReceiptV1`, `GoldenVerifierRuntimeLeaseReceiptV1`, `GoldenVerifierRuntimeDurabilityRestartReceiptV1`, `GoldenVerifierRuntimeReleaseReceiptV1`, `GoldenVerifierLogicalLeaseReconciliationV1`, authenticated `GoldenVerifierRuntimeLeaseV1`, `GoldenVerifierRuntimePort`, `createCanonicalGoldenVerifierRuntimePort()`, authenticators for Task 1's nominal `GoldenPersistedLaunchIntentV1`, `GoldenLaunchExecutionBindingV1`, and `GoldenStarterInvocationIssuedV1`, strict content-addressed `GoldenPreparedRecoveryContextV1`, `createGoldenPreparedRecoveryContextV1(input)`, `resolveGoldenPreparedRecoveryContextV1({recoveryContextRef,recoveryContextHash})`, `authenticateGoldenPreparedRecoveryContextV1(value)`, strict `GoldenLaunchCapacityReservationV1`, authenticated `GoldenPreparedLaunchStateV1` plus `authenticateGoldenPreparedLaunchStateV1(value)`, explicit `GoldenExistingRepositoryAttemptProvisioningPortV1`, `createUnavailableGoldenExistingRepositoryAttemptProvisioningPortV1()`, `GoldenCollectionPhaseV1`, `GoldenCollectionPhaseStore` with the exact `recoverGoldenCanaryLaunchPreparationV1(intent)` recovery operation, and `createGoldenCollectionPhaseStore()`.
- Ownership boundary: this module is the only B component allowed to allocate a verifier port or start, stop, signal, or release a verifier process. It never mutates a Setfarm run/runtime row and never exposes a path, command, PID, port, origin, environment, or lease token through a public golden result.

- [ ] **Step 1: Write failing verifier-runtime lifecycle tests**

Use a temporary accepted project and a sealed HTTP/browser contract. With injected fake driver, process observer, signaler, TCP probe, clock, and fixed-root filesystem adapter, assert this exact order:

```typescript
assert.deepEqual(events, [
  "allocate",
  "launcher.spawn",
  "launcher.observeProcessIdentity",
  "provisional.persist",
  "launcher.waitReady",
  "launcher.observeListenerIdentity",
  "lease.promote.persist",
  "assertion.begin",
  "assertion.end",
  "launcher.stop",
  "process.absent",
  "port.free",
  "lease.release.persist",
]);
```

Assert one lease is bound to the exact run ID/number, repository ref, accepted source SHA/tree, sealed contract hash, loopback origin, observed process-group leader identity, and exact listener process identity in that group. Reject non-loopback origins, a CLI-only authority, changed contract/source/run, occupied mismatched listener, second active lease, structural clone, JSON round-trip, changed frozen field, or unobserved process/listener identity. Assert `stopAndRelease()` authenticates the exact object, signals only the verified process group created by this launcher, verifies both leader/listener identities are absent and port is exclusively bindable, and writes a path-free release receipt.

Simulate interruption at every boundary after spawn. Immediately after the group leader is observed, require a mode-`0600`, `O_NOFOLLOW`, fsynced provisional registry record before the first readiness probe or listener lookup. A new port instance's `recoverProvisional()` must authenticate the exact run/source/contract/group-leader/port record and either (a) rejoin the exact process, prove readiness and its sole listener, and atomically promote that same record to one lease, or (b) identity-gate stop of that exact process, prove process absence and exclusive port rebind, and persist `abandoned_released` before returning `null`; only then may the caller acquire afresh. It must never delete, signal, or adopt a mismatched process, and more than one provisional candidate fails closed.

Also simulate process interruption after the lease receipt is persisted. A new port instance must `rejoin()` only when the private receipt, source/contract authority, OS process identity, and listener identity all match; `stopAndRelease()` then sends `SIGTERM` only through `signalProcessIfIdentityMatches`, waits at most `5_000 ms`, sends `SIGKILL` through the same identity gate only if still exact, proves process absence and exclusive port rebind, and marks the registry released. PID reuse, an unknown listener, corrupt registry, or failure to prove cleanup returns `GOLDEN_VERIFIER_RUNTIME_RELEASE_UNPROVEN` and cannot be accepted.

Before every acquire/recover/rejoin/restart/release transition, assert `reconcileLogicalLease()` inspects the exact tuple and returns one finite state. Exercise registry `none`, one `launching` provisional, one live generation-one lease, one live generation-two lease with its durability-restart receipt, and one released current generation. If a registry promotion or release succeeded but the matching phase append crashed, the harness must append the exact missing `verifier-runtime-leased` or `verifier-runtime-released` receipt before continuing and must not spawn, restart, or signal again. A phase-only lease, two registry candidates, a changed tuple, a broken generation-one-to-two restart chain, or conflicting phase/registry hashes returns `ambiguous`/fails closed and can never classify accepted.

For a `node-express-api` case only, test one durability restart within the assertion window. Require the existing exact generation to stop with process absence and port release, durably record the restart transition, launch the exact same sealed contract/source on the exact same loopback origin and logical lease registry, persist provisional identity before readiness, promote one replacement generation, and return a path/PID/port/command-free receipt. The final harness release must stop that replacement generation. Reject browser, game, Vite, CLI, non-HTTP, wrong case/source/contract, a second restart, changed expected-state hash, cloned lease, or origin drift. Simulate interruption before old stop, after old release, after replacement spawn, and after replacement promotion; recovery either resumes the one restart or releases the exact owned process, never launches two replacements, never replays a completed restart, and never adopts an unrelated listener.

- [ ] **Step 2: Run verifier tests and confirm failure**

Run:

```bash
node --import tsx --test tests/internal-production/golden-verifier-runtime.test.ts
```

Expected: FAIL because `golden-verifier-runtime.ts` is absent.

- [ ] **Step 3: Define and implement the exact runtime lease API**

```typescript
export type GoldenVerifierRuntimeProvisionalReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-verifier-runtime-provisional.v1";
  campaignHash: string;
  caseId: string;
  runId: string;
  runNumber: number;
  repositoryRef: string;
  acceptedSha: string;
  acceptedTreeHash: string;
  runtimeContractHash: string;
  processIdentityHash: string;
  provisionalTokenHash: string;
  state: "launching";
  provisionalHash: string;
}>;

export type GoldenVerifierRuntimeLeaseReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-verifier-runtime-lease.v1";
  campaignHash: string;
  caseId: string;
  runId: string;
  runNumber: number;
  repositoryRef: string;
  acceptedSha: string;
  acceptedTreeHash: string;
  runtimeContractHash: string;
  processIdentityHash: string;
  listenerIdentityHash: string;
  leaseTokenHash: string;
  leaseHash: string;
}>;

export type GoldenVerifierRuntimeReleaseReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-verifier-runtime-release.v1";
  leaseHash: string;
  stopDisposition: "owned-launcher-stop" | "exact-identity-rejoin-stop";
  exactProcessAbsent: true;
  exactPortReleased: true;
  registryState: "released";
  releasedAt: string;
  releaseHash: string;
}>;

export type GoldenVerifierRuntimeDurabilityRestartReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-verifier-runtime-durability-restart.v1";
  runId: string;
  runNumber: number;
  repositoryRef: string;
  acceptedSha: string;
  acceptedTreeHash: string;
  runtimeContractHash: string;
  logicalLeaseTokenHash: string;
  previousLeaseHash: string;
  previousGenerationReleaseHash: string;
  replacementLeaseHash: string;
  replacementProcessIdentityHash: string;
  replacementListenerIdentityHash: string;
  expectedStateHash: string;
  restartOrdinal: 1;
  sameOrigin: true;
  authorityRef: string;
  restartHash: string;
}>;

export type GoldenVerifierRuntimeLeaseV1 = Readonly<{
  receipt: GoldenVerifierRuntimeLeaseReceiptV1;
  origin: string;
}>;

export type GoldenVerifierLogicalLeaseReconciliationV1 =
  | Readonly<{ state: "none" }>
  | Readonly<{
      state: "launching";
      provisional: GoldenVerifierRuntimeProvisionalReceiptV1;
    }>
  | Readonly<{
      state: "live";
      generation: 1 | 2;
      lease: GoldenVerifierRuntimeLeaseReceiptV1;
      durabilityRestart: GoldenVerifierRuntimeDurabilityRestartReceiptV1 | null;
    }>
  | Readonly<{
      state: "released";
      generation: 1 | 2;
      lease: GoldenVerifierRuntimeLeaseReceiptV1;
      durabilityRestart: GoldenVerifierRuntimeDurabilityRestartReceiptV1 | null;
      release: GoldenVerifierRuntimeReleaseReceiptV1;
    }>
  | Readonly<{
      state: "ambiguous";
      candidateReceiptHashes: readonly string[];
    }>;

export interface GoldenVerifierRuntimePort {
  reconcileLogicalLease(input: Readonly<{
    campaignHash: string;
    goldenCase: GoldenCaseV1;
    run: GoldenRunPollV1;
    canonical: GoldenCanonicalCollectionV1;
    authority: Extract<GoldenCollectedAssertionAuthorityV1["runtime"], {
      kind: "sealed-verifier-contract";
    }>;
  }>): Promise<GoldenVerifierLogicalLeaseReconciliationV1>;
  recoverProvisional(input: Readonly<{
    campaignHash: string;
    goldenCase: GoldenCaseV1;
    run: GoldenRunPollV1;
    canonical: GoldenCanonicalCollectionV1;
    authority: Extract<GoldenCollectedAssertionAuthorityV1["runtime"], {
      kind: "sealed-verifier-contract";
    }>;
  }>): Promise<GoldenVerifierRuntimeLeaseV1 | null>;
  acquire(input: Readonly<{
    campaignHash: string;
    goldenCase: GoldenCaseV1;
    run: GoldenRunPollV1;
    canonical: GoldenCanonicalCollectionV1;
    authority: Extract<GoldenCollectedAssertionAuthorityV1["runtime"], {
      kind: "sealed-verifier-contract";
    }>;
  }>): Promise<GoldenVerifierRuntimeLeaseV1>;
  rejoin(input: Readonly<{
    receipt: GoldenVerifierRuntimeLeaseReceiptV1;
    goldenCase: GoldenCaseV1;
    run: GoldenRunPollV1;
    canonical: GoldenCanonicalCollectionV1;
    authority: Extract<GoldenCollectedAssertionAuthorityV1["runtime"], {
      kind: "sealed-verifier-contract";
    }>;
  }>): Promise<GoldenVerifierRuntimeLeaseV1>;
  restartForDurability(input: Readonly<{
    lease: GoldenVerifierRuntimeLeaseV1;
    goldenCase: GoldenCaseV1;
    expectedStateHash: string;
  }>): Promise<Readonly<{
    lease: GoldenVerifierRuntimeLeaseV1;
    receipt: GoldenVerifierRuntimeDurabilityRestartReceiptV1;
  }>>;
  stopAndRelease(
    lease: GoldenVerifierRuntimeLeaseV1,
  ): Promise<GoldenVerifierRuntimeReleaseReceiptV1>;
}

export function createCanonicalGoldenVerifierRuntimePort(): GoldenVerifierRuntimePort;
```

The implementation owns private WeakMaps for newly acquired, provisionally recovered, and rejoined leases. It deep-freezes returned objects, uses independent random 32-byte provisional and lease tokens only in its fixed mode-`0600` private registry, and publishes only their hashes. `provisionalHash`, `leaseHash`, and `releaseHash` are constructors over payloads without their hash field. The fixed registry root is `resolveInternalProductionChildV1(["golden-results", "runtime-leases"])`; its constructor and read methods never create the root. `reconcileLogicalLease()` uses the exact `(campaignHash,caseId,runId,runNumber,repositoryRef,acceptedSha,acceptedTreeHash,runtimeContractHash)` tuple, validates every registry transition and receipt hash, follows the durability-restart chain to the current generation, and returns only `none | launching | live | released | ambiguous`. It never chooses a candidate by timestamp/PID/port proximity. Every harness path calls it before acquire, provisional recovery, rejoin, restart, or release; `ambiguous` fails closed. `acquire()` is legal only for reconciled `none` with no lease phase and creates validated descendants lazily only after a terminal run and verified sealed contract reach the runtime-required phase.

For `http-service | browser-service`, parse the accepted sealed contract, resolve its repository-relative server cwd under the authenticated accepted checkout, allocate only `127.0.0.1` in the contract stack's existing `backend | frontend | preview` band, substitute only `{{HOST}}`, `{{PORT}}`, and `{{RUNTIME_URL}}`, and spawn the exact declared argv with `shell:false`, `detached:true`, stdio pipes, bounded buffers, and the code-owned normalized environment plus the contract's schema-validated env. Observe the spawned group leader and immediately write/fsync the exact leader identity, private allocated port, contract/source/run bindings, origin, and provisional token to the registry. Only after that durable write may it run the sealed readiness method/path/status, then use bounded `lsof -nP -iTCP:<port> -sTCP:LISTEN -Fp` followed by `observeProcessIdentity` to require exactly one listener whose observed process group equals the verified leader group. Atomically promote the same provisional record to a lease containing the exact listener identity before returning the capability. If an unrelated process wins the port race, do not signal it: terminate only the verified spawned group, prove its absence and port release, persist the provisional record as `abandoned_released`, and try the next deterministic band port up to eight attempts. Raw stdout/stderr is bounded, hashed on failure, and discarded.

`recoverProvisional()` is callable only after reconciliation returns the same one `launching` receipt. It re-observes the exact group leader, then either completes readiness/listener checks and promotes that record or guardedly cleans it and persists `abandoned_released`. Reconcile again before any acquire. If reconciliation returns `live` while `verifier-runtime-leased` is missing, the harness appends that exact lease receipt before rejoining; if it returns `released`, it appends any missing exact lease and release phases without spawning or signalling. A phase receipt with registry `none`, a registry receipt conflicting with a phase, or an invalid generation/restart chain fails closed. This same algorithm covers interruption before/after durability replacement promotion: generation two and its restart receipt are recovered together and become the sole lease used by assertions/final release.

`restartForDurability()` authenticates the exact current lease and parses `expectedStateHash` with `Sha256Schema`. It accepts exactly `goldenCase.expected.stackPackId === "node-express-api"`, `authority.adapter === "http"`, and restart ordinal zero. Under the registry lock it writes a `restart_prepared` transition, stops/releases the exact current generation with the guarded identity path, records its generation-release hash without marking the logical lease finally released, and launches the same contract/source/cwd/env on the same private loopback port/origin. Replacement launch uses the same provisional-before-readiness discipline and atomically promotes the logical registry to generation two. `logicalLeaseTokenHash` stays fixed; process/listener and generation lease hashes change. `authorityRef` is exactly ``setfarm://internal-production/verifier-restarts/${restartHash}``. The receipt and any public result contain no origin, port, PID, process group, token, path, argv, command, cwd, environment, or output. `stopAndRelease()` authenticates and stops whichever promoted generation the logical lease registry currently owns, so final cleanup always targets the replacement. A second restart, changed input on retry, ambiguous transition, or failure to prove either release remains fail-closed.

`stopAndRelease()` first reconciles the tuple and requires `live` for the exact authenticated current generation, re-observes the leader/listener and group binding, sends `SIGTERM` to the negative process-group ID only after that check, waits at most `5_000 ms`, then conditionally sends `SIGKILL` through the same repeated identity check. It proves both identities absent and exclusive loopback bind succeeds before persisting release. The harness reconciles again and appends the exact registry release receipt if its phase write was interrupted. `rejoin()` is likewise allowed only after `live` reconciliation, opens the registry with `O_NOFOLLOW`, validates mode/hash/token hash and all source/run/contract identities, and authenticates only the exact current generation. No caller chooses a command, cwd, environment, host, port, signal, or output root. The generic workflow runtime drivers remain unchanged.

- [ ] **Step 4: Write failing phase-journal tests**

Add a two-worker barrier test around the active-ownership CAS. A standard or matrix campaign with configured/eligible capacity one requires total active ownership zero, permits exactly one durable prepared/issued/run-bound intent and rejects the second until the first is classified. A fleet projection with configured two but eligible one behaves identically. After supplying one authentic eligible-two capacity projection, two concurrent distinct fleet intents for the same campaign and epoch both persist with distinct `GoldenLaunchCapacityReservationV1` receipts and can proceed through issue, while a third concurrent contender deterministically loses before intent/outbox creation. Fleet permits only authenticated same-campaign/same-epoch ownership below eligible capacity; any unrelated campaign, prior epoch, unattributed owner, stale capacity hash/count, duplicate logical intent, forked active index, or mismatched reservation blocks all new reservations. Inject crashes before/after lock publication, intent publication, active-index successor publication, reservation publication, promotion, classified release, and response; phase-store recovery reopens the same one or two reservation/intent/operation identities without calling the reservation CAS again and never creates a third. This test is specific to golden fleet policy and does not change convergence, ordinary Setfarm, matrix, or CLI concurrency. Task 5 separately proves both full-capacity prepared continuations can execute/recover while a fresh stage loses, without making this earlier task depend on Task 5 symbols.

Lock this finite order:

```typescript
const GoldenCollectionPhaseNameV1Schema = z.enum([
  "run-bound",
  "timeout-reconciliation-bound",
  "lifecycle-action-recorded",
  "terminal-observed",
  "timeout-observed",
  "canonical-collected",
  "verifier-runtime-leased",
  "assertions-collected",
  "verifier-runtime-released",
  "post-release-collected",
  "timeout-evidence-collected",
  "classified",
]);
```

Assert prepared launch intent creation is exclusive and durable before a starter call. The path-free intent binds campaign/case/hash/repetition, `releaseSha`, the complete schema-valid `finalReleaseEpoch`, its equal `releaseEpochHash`, A's `historicalBaselineReceiptHash`, Task 2's exact terminal pair plus application source SHA/current-verification/schema-projection hashes, preflight/strategy/prompt/logical-correlation hashes, and exactly one preparation member: a V3 preparation ID/selector-secret-record hash/selector-token hash/admission-request hash before any admission exists, or an existing-repository template hash/ref plus attempt ordinal/key hash before any attempt exists. In the same CAS publication, persist one strict `GoldenLaunchCapacityReservationV1` binding campaign/epoch/intent/capacity/ownership hashes and its one-based same-campaign ordinal. Require the migration terminal pair/current verification to equal the admitted preflight's freshly reopened release authority and `releaseSha` to equal the verification's current SHA rather than its application SHA, require `releaseSha === finalReleaseEpoch.setfarmSha`, recompute `finalReleaseEpoch.epochHash`, and reject any partial epoch or mutable current-release lookup. It contains neither the not-yet-known repository path/full task hash nor a pre-start run set. For V3, one atomic fsynced mode-`0600` envelope persists the complete public intent plus the private raw selector secret before `createCanary`; the exported intent contains the selector hash but no raw selector token. A second unresolved intent for the same campaign/case/repetition/release/epoch is rejected. Any prepared-state reopen must freshly verify and rehash that same migration pair and reservation, and prove its active-index ownership is still the same logical launch; it never reacquires capacity.

Assert `authenticateGoldenCanaryLaunchPreparationV1()` accepts only the deeply frozen object identity minted with that atomic envelope. For both strategies, `prepareLaunch()` and `readPreparedLaunches()` return B's exact deeply frozen `GoldenPersistedLaunchIntentV1`; `persistedEnvelopeHash` binds the canonical fsynced envelope bytes, and `authenticateGoldenPersistedLaunchIntentV1()` requires private WeakMap identity plus equality with its nested intent/hash. A structural clone or an object minted before fsync is rejected before any admission, attempt-provisioning, filesystem, or GitHub side effect. `recoverGoldenCanaryLaunchPreparationV1(intent)` reopens the one exact envelope and remints a capability for the same selector; it never generates a token. After V3 task determination or existing-repository provision+contained-path resolution, `bindLaunchExecution()` atomically fsyncs the exact full task hash and bounded pre-start set/hash; its authenticator rejects structural clones. `recordPreStartAuthorization()` accepts exactly one schema-valid receipt for that intent+execution context and persists it before any admission or starter action. `bindCanaryAdmission()` accepts only the exact intent, authenticated preparation, execution-bound authorization receipt, and repository admission/slot identities, then persists one immutable binding receipt. Repeating any binding with identical bytes is idempotent; changed intent, task, set, attempt, preparation, selector, admission, slot, or authorization fails closed. A crash before `createCanary`, during `createCanary`, or before binding recovers the same capability and calls the repository idempotently; no path creates a second selector or admission.

Assert `recordStarterInvocationIssued()` is the last durable transition before the idempotent launch-operation starter. It validates the exact private `GoldenRunStartRequestV1`, authenticates the matching `GoldenLaunchCapacityReservationV1`, computes the code-owned operation/request hashes from the reservation+intent+execution+authorization+admission-or-attempt chain, generates one random 32-byte claim secret, and exclusively writes/fsyncs the immutable mode-`0600` launch-operation outbox before atomically recording `issued:true` in the prepared envelope. A crash before outbox fsync permits no starter call; a crash after outbox fsync but before issued binding reopens only identical bytes and completes the binding. After issue, prepared continuation may repeatedly resolve/resume only `starter.start({issued})`, but every call reopens the same authenticated outbox and the compiled CLI transaction creates or returns exactly one operation-bound run. Read-only collect never calls the starter and only adopts an exact committed operation row. Simulate crashes before outbox write, after file fsync, after parent fsync, before/after issued-envelope fsync, before subprocess entry, before DB transaction, after run+operation commit, after child response loss, after invocation receipt, and before `run-bound`; counters prove one reservation/run/operation, while changed/zero/multiple lookup bindings remain durably pending or ambiguous without another operation.

Construct one `GoldenPreparedRecoveryContextV1` from an authentic loaded campaign, exact selected case, admitted preflight, and bounded strict result history before `prepareLaunch()`. Assert it carries the frozen path-free loaded-campaign projection, exact case hash/profile/start strategy/raw task, distinct prompt/admission hashes, repetition/attempt ordinal, full observed release authority/epoch/baseline/preflight identities, and the sorted unique started-run-only authorization projection. Its hash covers every field except its ref/hash; its ref is exactly ``setfarm://internal-production/golden-prepared-recovery-contexts/sha256/${recoveryContextHash}``. Reject a structural loaded clone, unknown case, blocked preflight, caller projection/hash/ref/path, pre-run member in the authorization projection, more than `64` prior started results, duplicate/reordered result hashes, campaign/case/task/prompt/admission/release/ordinal drift, and any raw selector, repository path, environment, or current-service lookup. Kill the process before/after unpredictable-temp write, file fsync, atomic no-replace publication, parent fsync, final no-follow reopen, intent-envelope binding, and response. `resolveGoldenPreparedRecoveryContextV1({recoveryContextRef,recoveryContextHash})` in a fresh process must reopen/reparse/rehash the one exact context, remint its context capability, and permit only that same launch preparation; a missing/corrupt/symlink/hardlink/unsafe-mode/colliding context blocks before provisioning, admission, authorization, outbox, or starter activity. Response loss returns the same ref/hash and never creates a second logical context or fabricates campaign/task/prior-result bytes.

Assert `promoteLaunchToRunBound()` accepts only that exact prepared intent, launch-execution binding, persisted pre-start authorization, required V3 admission binding or existing-repository bound attempt, durable starter-issued receipt, plus one schema-validated authoritative `GoldenRunStartReceiptV1`; it atomically replaces the prepared-intent file with the run journal at the same nonce-derived private filename and makes `run-bound` its first hash-chained entry. Promotion binds every correlation/execution/issued/operation/preparation/authorization/admission-or-attempt hash, exact run ID/number, stored workflow/protocol/version, and start-receipt hash. Identical promotion is idempotent; a different run, receipt, task/set, operation, admission, authorization, attempt, strategy, or release fails closed. Simulate a crash after issue/start but before promotion: recovery reads exactly one unresolved intent and its complete stored chain, requires `GoldenRunLaunchLookupPort.resolve({ intent, executionBinding, starterInvocationIssued, authorization, admissionBinding, fixtureAttempt })` to return exactly one authoritative start receipt, and promotes only that receipt without recalling the starter. Zero or multiple matches remain unresolved and produce `GOLDEN_LAUNCH_RECOVERY_AMBIGUOUS`; logs, task text, creation times, nearest run numbers, and process output are never inputs.

Assert later append is exclusive and hash-chained, identical append is idempotent, and only a transition in this exact graph is allowed. The optional nonterminal action edge is `run-bound -> lifecycle-action-recorded -> terminal-observed|timeout-observed`; without an action, either observation follows `run-bound` directly. The action payload contains the exact validated lifecycle receipt hash/action/nullable-operation/generation/predicate/evidence-ref projection. An actionable-review receipt requires non-null `actionOperationHash`; service restart receipts require null. If the action side effect succeeds but append crashes, the same C/D `tryAction()` call must reconcile and return the identical durable operation/receipt; B appends it once before any terminal collection and never posts/restarts blindly. Exercise interruption before action-operation fsync, after fsync/before external call, after the external call before response, after exact remote adoption, after receipt fsync, and before phase append. The ordinary terminal branch then reaches `canonical-collected`; the separate timeout-reconciliation journal starts `timeout-reconciliation-bound -> terminal-observed -> canonical-collected`. CLI/not-applicable runtime uses `canonical-collected -> assertions-collected -> post-release-collected -> classified`, while HTTP/browser uses `canonical-collected -> verifier-runtime-leased -> assertions-collected -> verifier-runtime-released -> post-release-collected -> classified`. The nonterminal deadline branch reaches only `timeout-observed -> timeout-evidence-collected -> classified`; it cannot enter canonical assertions, runtime, projection render, or terminal phases. A classified timeout journal can never transform into reconciliation. Reject a missing predecessor, skipped/regressed phase, changed campaign/case/release/run identity, conflicting duplicate, invalid predecessor hash, corrupt bytes, more than twelve entries, symlink/hardlink, mode other than `0600`, or caller-selected root. Assert an `assertions-collected` payload always contains a complete schema-validated assertion set plus either one validated durability-restart receipt or `null`. Only the Node Express API/live-HTTP contract may carry the restart receipt, and its replacement lease must equal the generation finally released. `verifier-runtime-leased` and `verifier-runtime-released` may be appended from exact registry reconciliation receipts after an interruption; `timeout-evidence-collected` retains explicit unavailable/active fields, and other phases contain only canonical hashes/finite identities. Reading absent roots returns `[]` and creates nothing.

- [ ] **Step 5: Run phase tests and confirm failure**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-phase-store.test.ts
```

Expected: FAIL because `golden-run-phase-store.ts` is absent.

- [ ] **Step 6: Implement the exact phase store**

Task 1 owns and exports the shared launch-intent, persisted-intent nominal type, execution-binding, starter-issued, and start-receipt schemas/types. The phase store imports those exact names, owns their durable transitions and capability authenticators, and does not redeclare any shared shape.

```typescript
export type GoldenCanaryLaunchPreparationV1 = Readonly<{
  kind: "authenticated-v3-canary-launch-preparation";
  intentHash: string;
  preparationIdHash: string;
  selectorSecretRecordHash: string;
}>;

export function authenticateGoldenPersistedLaunchIntentV1(
  value: unknown,
): GoldenPersistedLaunchIntentV1;

export function authenticateGoldenLaunchExecutionBindingV1(
  value: unknown,
): GoldenLaunchExecutionBindingV1;

export function authenticateGoldenStarterInvocationIssuedV1(
  value: unknown,
): GoldenStarterInvocationIssuedV1;

export interface GoldenExistingRepositoryAttemptProvisioningPortV1 {
  provision(input: Readonly<{
    persistedIntent: GoldenPersistedLaunchIntentV1;
    template: GoldenExistingRepositoryFixtureTemplateV1;
  }>): Promise<GoldenExistingRepositoryFixtureAttemptV1>;
}

export function createUnavailableGoldenExistingRepositoryAttemptProvisioningPortV1():
  GoldenExistingRepositoryAttemptProvisioningPortV1;

export function authenticateGoldenCanaryLaunchPreparationV1(
  value: unknown,
): GoldenCanaryLaunchPreparationV1;

export type GoldenCanaryIntentAdmissionReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-canary-intent-admission.v1";
  intentHash: string;
  preparationIdHash: string;
  selectorSecretRecordHash: string;
  admissionAuthorityHash: string;
  slotAuthorityHash: string;
  repositoryAdmissionReceiptHash: string;
  admissionBindingHash: string;
}>;

export type GoldenPreparedAuthorizationPriorResultV1 = Readonly<{
  resultHash: string;
  repetition: 1 | 2;
  releaseEpochHash: string;
  classification: GoldenClassificationV1;
  rootCauseHash: string | null;
  observationDisposition: "terminal-settlement" | "nonterminal-timeout";
}>;

export type GoldenPreparedRecoveryContextV1 = Readonly<{
  schema: "setfarm.internal-production-golden-prepared-recovery-context.v1";
  loadedCampaignAuthority: LoadedGoldenCampaignV1;
  campaignHash: string;
  caseId: string;
  caseHash: string;
  profileId: GoldenProfileIdV1;
  startStrategy: GoldenStartStrategyV1;
  task: string;
  promptHash: string;
  admissionTaskHash: string;
  repetition: 1 | 2;
  launchAttemptOrdinal: number;
  releaseSha: string;
  releaseAuthorityHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  releaseEpochHash: string;
  preflightHash: string;
  historicalBaselineReceiptHash: string;
  goldenLaunchMigrationReceiptRef: CanonicalRef;
  goldenLaunchMigrationReceiptHash: string;
  goldenLaunchMigrationApplicationSourceSha: string;
  goldenLaunchMigrationCurrentVerificationHash: string;
  goldenLaunchMigrationSchemaProjectionHash: string;
  priorResults: readonly GoldenPreparedAuthorizationPriorResultV1[];
  priorResultProjectionHash: string;
  recoveryContextRef: CanonicalRef;
  recoveryContextHash: string;
}>;

export const GoldenPreparedRecoveryContextV1Schema:
  z.ZodType<GoldenPreparedRecoveryContextV1>;

export function createGoldenPreparedRecoveryContextV1(input: Readonly<{
  loaded: LoadedGoldenCampaignV1;
  caseId: string;
  preflight: Extract<GoldenPreflightResultV1, { kind: "admitted" }>;
  results: readonly GoldenRunResultV1[];
}>): Promise<GoldenPreparedRecoveryContextV1>;

export function resolveGoldenPreparedRecoveryContextV1(input: Readonly<{
  recoveryContextRef: CanonicalRef;
  recoveryContextHash: string;
}>): Promise<GoldenPreparedRecoveryContextV1>;

export function authenticateGoldenPreparedRecoveryContextV1(
  value: unknown,
): GoldenPreparedRecoveryContextV1;

export type GoldenLaunchCapacityReservationV1 = Readonly<{
  schema: "setfarm.internal-production-golden-launch-capacity-reservation.v1";
  campaignHash: string;
  epochHash: string;
  intentHash: string;
  capacityHash: string;
  reservedSameCampaignOrdinal: 1 | 2;
  ownershipHash: string;
  reservationHash: string;
}>;

export const GoldenLaunchCapacityReservationV1Schema:
  z.ZodType<GoldenLaunchCapacityReservationV1>;

export type GoldenPreparedLaunchStateV1 = Readonly<{
  recoveryContext: GoldenPreparedRecoveryContextV1;
  recoveryContextRef: CanonicalRef;
  recoveryContextHash: string;
  intent: GoldenLaunchIntentV1;
  persistedIntent: GoldenPersistedLaunchIntentV1;
  capacityReservation: GoldenLaunchCapacityReservationV1;
  executionBinding: GoldenLaunchExecutionBindingV1 | null;
  authorization: GoldenPreStartAuthorizationReceiptV1 | null;
  admissionBinding: GoldenCanaryIntentAdmissionReceiptV1 | null;
  fixtureAttempt: GoldenExistingRepositoryFixtureAttemptV1 | null;
  starterInvocationIssued: GoldenStarterInvocationIssuedV1 | null;
}>;

export function authenticateGoldenPreparedLaunchStateV1(
  value: unknown,
): GoldenPreparedLaunchStateV1;

export type GoldenCollectionPhaseV1 = Readonly<{
  schema: "setfarm.internal-production-golden-collection-phase.v1";
  campaignHash: string;
  caseId: string;
  caseHash: string;
  repetition: 1 | 2;
  launchAttemptOrdinal: number;
  releaseSha: string;
  releaseEpochHash: string;
  runId: string;
  runNumber: number;
  ordinal: number;
  phase: z.infer<typeof GoldenCollectionPhaseNameV1Schema>;
  predecessorPhaseHash: string | null;
  payload: GoldenCollectionPhasePayloadV1;
  phaseHash: string;
}>;

export interface GoldenCollectionPhaseStore {
  inspectActiveGoldenOwnerships(): Promise<readonly Readonly<{
    campaignHash: string;
    epochHash: string;
    launchAttemptOrdinal: number;
    intentHash: string;
    starterOperationHash: string | null;
    runId: string | null;
    runNumber: number | null;
    state: "prepared" | "issued" | "run-bound";
    ownershipHash: string;
  }>[]>;
  prepareLaunch(input:
    | Readonly<{
        kind: "v3-feature-dev-canary";
        executionCapacity: GoldenCampaignExecutionCapacityV1;
        recoveryContext: GoldenPreparedRecoveryContextV1;
        intent: Omit<GoldenLaunchIntentV1,
          "preparation" | "preparationAuthorityHash" | "logicalLaunchCorrelationHash" |
          "nonceHash" | "intentHash">;
        admissionRequestHash: string;
        selectorToken: string;
      }>
    | Readonly<{
        kind: "canonical-existing-repository-workflow";
        executionCapacity: GoldenCampaignExecutionCapacityV1;
        recoveryContext: GoldenPreparedRecoveryContextV1;
        intent: Omit<GoldenLaunchIntentV1,
          "preparation" | "preparationAuthorityHash" | "logicalLaunchCorrelationHash" |
          "nonceHash" | "intentHash">;
        template: GoldenExistingRepositoryFixtureTemplateV1;
      }>,
  ): Promise<Readonly<{
    intent: GoldenLaunchIntentV1;
    persistedIntent: GoldenPersistedLaunchIntentV1;
    capacityReservation: GoldenLaunchCapacityReservationV1;
    canaryPreparation: GoldenCanaryLaunchPreparationV1 | null;
  }>>;
  readPreparedLaunches(input: Readonly<{
    campaignHash: string;
    caseId: string;
    repetition: 1 | 2;
    launchAttemptOrdinal: number;
    releaseSha: string;
    finalReleaseEpoch: GoldenFinalReleaseEpochV1;
    releaseEpochHash: string;
    historicalBaselineReceiptHash: string;
    goldenLaunchMigrationReceiptRef: CanonicalRef;
    goldenLaunchMigrationReceiptHash: string;
    goldenLaunchMigrationApplicationSourceSha: string;
    goldenLaunchMigrationCurrentVerificationHash: string;
    goldenLaunchMigrationSchemaProjectionHash: string;
  }>): Promise<readonly GoldenPreparedLaunchStateV1[]>;
  recoverGoldenCanaryLaunchPreparationV1(
    intent: GoldenLaunchIntentV1,
  ): Promise<GoldenCanaryLaunchPreparationV1>;
  bindExistingRepositoryAttempt(input: Readonly<{
    intent: GoldenLaunchIntentV1;
    attempt: GoldenExistingRepositoryFixtureAttemptV1;
  }>): Promise<GoldenExistingRepositoryFixtureAttemptV1>;
  bindLaunchExecution(input: Readonly<{
    intent: GoldenLaunchIntentV1;
    fullLaunchTaskHash: string;
    matchingRunIds: readonly string[];
    fixtureAttempt: GoldenExistingRepositoryFixtureAttemptV1 | null;
  }>): Promise<GoldenLaunchExecutionBindingV1>;
  recordPreStartAuthorization(input: Readonly<{
    intent: GoldenLaunchIntentV1;
    executionBinding: GoldenLaunchExecutionBindingV1;
    receipt: GoldenPreStartAuthorizationReceiptV1;
  }>): Promise<GoldenPreStartAuthorizationReceiptV1>;
  bindCanaryAdmission(input: Readonly<{
    intent: GoldenLaunchIntentV1;
    preparation: GoldenCanaryLaunchPreparationV1;
    authorization: GoldenPreStartAuthorizationReceiptV1;
    admission: Omit<GoldenCanaryIntentAdmissionReceiptV1, "admissionBindingHash">;
  }>): Promise<GoldenCanaryIntentAdmissionReceiptV1>;
  recordStarterInvocationIssued(input: Readonly<{
    intent: GoldenLaunchIntentV1;
    capacityReservation: GoldenLaunchCapacityReservationV1;
    executionBinding: GoldenLaunchExecutionBindingV1;
    authorization: GoldenPreStartAuthorizationReceiptV1;
    admissionBinding: GoldenCanaryIntentAdmissionReceiptV1 | null;
    fixtureAttempt: GoldenExistingRepositoryFixtureAttemptV1 | null;
    fixturePreVerification: GoldenFixtureVerificationExecutionV1 | null;
    startRequest: GoldenRunStartRequestV1;
  }>): Promise<GoldenStarterInvocationIssuedV1>;
  promoteLaunchToRunBound(input: Readonly<{
    intent: GoldenLaunchIntentV1;
    startReceipt: GoldenRunStartReceiptV1;
  }>): Promise<GoldenCollectionPhaseV1>;
  read(input: Readonly<{
    campaignHash: string;
    caseId: string;
    releaseSha: string;
    releaseEpochHash: string;
    runId: string;
  }>): Promise<readonly GoldenCollectionPhaseV1[]>;
  append(
    phase: Omit<GoldenCollectionPhaseV1, "ordinal" | "predecessorPhaseHash" | "phaseHash">,
  ): Promise<GoldenCollectionPhaseV1>;
  beginTimeoutTerminalReconciliation(input: Readonly<{
    originalTimeoutResult: GoldenStartedRunResultV1;
    terminalObservationHash: string;
  }>): Promise<GoldenCollectionPhaseV1>;
  readTimeoutTerminalReconciliation(input: Readonly<{
    originalTimeoutResultHash: string;
  }>): Promise<readonly GoldenCollectionPhaseV1[]>;
  appendTimeoutTerminalReconciliation(
    phase: Omit<GoldenCollectionPhaseV1, "ordinal" | "predecessorPhaseHash" | "phaseHash">,
  ): Promise<GoldenCollectionPhaseV1>;
}

export function createGoldenCollectionPhaseStore(): GoldenCollectionPhaseStore;
```

`createUnavailableGoldenExistingRepositoryAttemptProvisioningPortV1()` creates no root, file, process, socket, Git state, or GitHub state. Its sole `provision()` method rejects deterministically with `GOLDEN_EXISTING_REPOSITORY_ATTEMPT_PROVISIONER_UNAVAILABLE`. B's default CLI can therefore execute V3 cases and read-only preflight before C exists, while an existing-repository execute fails before provisioning or start. C's production matrix factory replaces only this exact Task 3A port with `createGoldenExistingRepositoryAttemptProvisioningPortV1()`; no CLI or caller may supply a root, repository, remote, path, command, environment, or receipt. Task 1 owns the shared nominal persisted-intent type, while Task 3A owns its authenticator and the explicit consumer port, so earlier tasks compile without a future C source file.

Use `resolveInternalProductionChildV1(["golden-results", "phases", campaignHash])` as the one fixed directory per campaign and one filename derived only from the launch intent's random nonce hash; never place raw run/case input in a path. A separate fixed, bounded active-golden-ownership index and recoverable global CAS lock serialize only golden launch reservations. `inspectActiveGoldenOwnerships()` read-only reopens that index and each equality-bound envelope/journal, deduplicates by `intentHash`, and returns the exact most-advanced path-free state. Under the same global lock, `prepareLaunch()` strictly reopens and rehashes its supplied `GoldenCampaignExecutionCapacityV1`. Standard/matrix require total indexed active ownership zero. Fleet requires zero unrelated/prior-epoch/unattributed ownership, requires the indexed same-campaign/same-epoch count to equal `activeSameCampaignCount` and be less than `eligibleMaximum`, and rejects a third reservation. The one CAS atomically publishes the new intent, `GoldenLaunchCapacityReservationV1`, and ownership entry before returning. Promotion advances the same entry; the exact terminal `classified` append releases it. `readPreparedLaunches()` reopens the existing reservation and remints the authenticated prepared state without invoking `prepareLaunch` or changing any count. Crash recovery may complete only the same index transition; a fork, missing envelope/reservation, stale capacity hash, unrelated owner, or third fleet reservation fails closed. Standard/matrix capacity remains one. Finalization independently requires the total index and platform ownership census to be zero. This is not a generic run-limit change and exposes no concurrency CLI/environment option.

`createGoldenPreparedRecoveryContextV1()` first authenticates the exact loader-owned `LoadedGoldenCampaignV1`, resolves one case, authenticates the admitted preflight, and derives every context member itself. It copies the complete loaded-campaign projection and selected case task into a recursively frozen private receipt, equality-checks all case/hash/profile/strategy/prompt/admission/repetition/ordinal/release fields, filters strict history to the started-run authorization projection, sorts it by repetition, release-epoch hash, and result hash, caps it at `64`, and computes `priorResultProjectionHash`. It accepts no projection, task, hash, ref, root, or path from the caller. It publishes below the fixed real mode-`0700` recovery-context root by unpredictable same-directory mode-`0600` temporary, file fsync, atomic no-replace link, parent fsync, inode proof, cleanup, and `O_NOFOLLOW` final reopen. `resolveGoldenPreparedRecoveryContextV1()` accepts only its canonical pair, reopens at the hash-derived fixed path, requires one regular one-link mode-`0600` file capped at `512 KiB`, reparses/recomputes the complete loaded campaign/case/hash projection and receipt hash, deeply freezes it, and registers only that exact object in the context WeakMap. `authenticateGoldenPreparedRecoveryContextV1()` requires that object identity, recursively frozen graph, and recomputed canonical equality; structural values never authenticate. Neither function consults a campaign pathname, current service, mutable release registry, or caller bytes. The nested `loadedCampaignAuthority` is authoritative only through its enclosing authenticated context; a caller that has an independently live loader-owned `loaded` object must pass normal loaded authentication and complete canonical equality before it may replace that nested projection.

The context constructor copies the Task 2 terminal migration ref/hash and current-verification hash only from the admitted preflight, calls `verifyCurrentGoldenLaunchOperationMigrationV1()` before publication, and requires exact terminal pair, `currentSourceSha === finalReleaseEpoch.setfarmSha`, application-ancestor, current-verification, and schema-projection equality. `prepareLaunch()`, `readPreparedLaunches()`, `recordStarterInvocationIssued()`, and `promoteLaunchToRunBound()` each reopen the fixed terminal locator and recompute the fresh current verification before their first lock/read/write; they equality-bind the terminal pair, current source SHA, and verification hash through context, intent, outbox, and start receipt. Thus a release receipt cannot disappear, drift, or be replaced between preflight and starter claim; failure advances neither phase nor run state.

`prepareLaunch()` also requires the admitted preflight's code-owned `launchAttemptOrdinal`, complete `GoldenFinalReleaseEpochV1`, equal `releaseEpochHash`, `releaseSha === finalReleaseEpoch.setfarmSha`, and A's exact `historicalBaselineReceiptHash`, and stores all of them in the authenticated envelope; no reopen consults current services or a current-release map to reconstruct authority bytes. Before its lock or allocation it authenticates `recoveryContext`, requires every campaign/case/profile/strategy/task-hash/repetition/ordinal/release/preflight/prior-result identity to equal the proposed intent, and requires the intent's canonical context ref/hash to equal it. Under its lock, the phase store derives the same next ordinal from strict closed/pre-run/run history and rejects a skipped, reused, caller-authored, or stale value. For V3, it validates a 32-byte base64url selector, computes its hash and a random preparation identity, and exclusively writes/fsyncs one canonical private envelope containing the complete path-free intent projection, context pair, and selector before returning the public intent/capabilities. For existing-repository, it authenticates the immutable template, requires its preparation `attemptOrdinal` to equal the generic launch-attempt ordinal, derives `attemptKeyHash` itself, and writes the same envelope shape without a secret and before any repository path exists; the caller supplies no preparation, ordinal, key, repository, remote, or path. A new ordinal is legal only after the preceding persisted launch intent has an explicit terminal/classified close transition or one exact pre-run result closed that attempted boundary; retrying or reopening the same intent/pre-run subject retains its exact ordinal and never allocates another attempt. Only after file and parent-directory fsync does the phase store compute `persistedEnvelopeHash` and register the deeply frozen capability; reopen resolves and authenticates the exact recovery-context pair before reminting it. Separate private WeakMaps back recovery contexts, persisted intents, capacity reservations, complete prepared states, execution bindings, starter-issued receipts, and canary-preparation objects. `authenticateGoldenPreparedLaunchStateV1()` requires object identity, a recursively frozen graph, exact context/ref/hash/reservation/active-index/envelope equality, and the complete strategy null relations; a structural clone, missing context, or stale reservation fails before continuation. `bindLaunchExecution()` occurs only after the full task is derived from that context and atomically persists its context/task/set binding. Authorization input is reconstructed only from context fields and its frozen prior-result projection; every receipt repeats the context hash. Authorization, attempt, execution, and admission updates use the same exclusive lock, sibling temporary file, fsync, rename, and directory-fsync protocol. `recordStarterInvocationIssued()` derives rather than accepts the operation/request hashes, validates the exact context-derived start request against the stored chain, and writes its outbox first at `resolveInternalProductionChildV1(["golden-results","launch-operations","sha256",starterOperationHash.slice(0,2),`${starterOperationHash}.json`])`; it then records the identical context-bound issued receipt in the launch envelope. Equal bytes are idempotent, collisions or any alternate request fail, and an orphan outbox without issued envelope authority is inert. Once issued, no API may clear it or create another operation, but prepared continuation may safely resolve/resume only that exact outbox until its unique run is observed. `promoteLaunchToRunBound()` validates the exact imported Task 1 start receipt, including equal launch-attempt ordinal, full epoch, historical-baseline receipt hash, recovery-context pair, capacity-reservation hash, and the complete stored intent/execution/issued/operation/preparation/authorization/admission-or-attempt chain, atomically replaces the prepared-intent file with the first `run-bound` journal entry, and fsyncs the directory. Every phase and result repeats that ordinal. `read()` fails on duplicate run journals. Timeout reconciliation uses only its hash-derived fixed path. Each append uses the same durable protocol with mode `0600`; every ancestor is real, contained, and mode `0700`. Cap each intent/journal/outbox at `256 KiB`, each recovery context at `512 KiB`, the campaign at `64` nonce files, ordinary journals at twelve entries, and reconciliation at one journal per timeout result. `GoldenCollectionPhasePayloadV1` has exact keys for the run binding chain; optional lifecycle action receipt; timeout reconciliation; terminal/timeout poll; canonical/project/authority; runtime lease; assertion set; runtime release; post-release evidence; timeout evidence; or final result hash. Constructors compute hashes; callers cannot author selectors, nonces, ordinals, operation hashes, claim secrets, context projections, or chain hashes.

- [ ] **Step 7: Run focused runtime/phase verification**

Run:

```bash
node --import tsx --test tests/internal-production/golden-verifier-runtime.test.ts tests/internal-production/golden-run-phase-store.test.ts
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
git diff --check
```

Expected: all commands exit `0`; a live runtime exists only inside the authenticated assertion window, exact release is proven, and absent-root reads remain allocation-free.

- [ ] **Step 8: Record the Task 3A Setfarm handoff checkpoint**

Run `git status --short` and `git diff --check`, verify the exact Task 3A scope, and return the file list plus focused/static evidence to the active Setfarm claim. Do not stage or commit.

---

### Task 4: Classify results with fail-closed precedence

**Files:**
- Create: `src/internal-production/golden-run-classifier.ts`
- Create: `tests/internal-production/golden-run-classifier.test.ts`

**Interfaces:**
- Consumes: Task 1 `GoldenCaseV1`, `GoldenStartedRunResultV1`, `GoldenPreRunResultV1`, `GoldenRunEvidenceV1`, `GoldenClassificationV1`, and trusted V3 operational failure identity.
- Produces: `classifyGoldenRunV1(input): GoldenClassificationDecisionV1`, `isSystemicGoldenClassificationV1(classification)`, and the stable cross-plan ABI `isGoldenRunCleanupExactlySettledV1(result: GoldenRunResultV1): boolean`.
- Trust boundary: only schema-validated evidence, exact hashes, finite reason codes, and V3 canonical operational failure identity affect classification. Summaries, labels, logs, and agent prose are absent from the input.

- [ ] **Step 1: Write failing tests for all seven classifications and precedence**

Build one fully accepted evidence fixture, then mutate one authoritative field at a time and reconstruct the schema-valid receipt. Lock these decisions:

```typescript
assert.equal(classifyGoldenRunV1(accepted).classification, "accepted");
assert.equal(classifyGoldenRunV1(productAssertionFailed).classification, "generated_product_failure");
assert.equal(classifyGoldenRunV1(platformInvariantFailed).classification, "setfarm_core_failure");
assert.equal(classifyGoldenRunV1(missionControlHashMismatch).classification, "mission_control_failure");
assert.equal(classifyGoldenRunV1(trustedQuotaFailure).classification, "provider_or_quota_failure");
assert.equal(classifyGoldenRunV1(trustedInfrastructureFailure).classification, "infrastructure_failure");
assert.equal(classifyGoldenRunV1(nonterminalTimeout).classification, "infrastructure_failure");
assert.equal(preRunResult.classification, "campaign_configuration_failure");
```

Assert `classifyGoldenRunV1` accepts only the started-run evidence branch and never manufactures a pre-run classification. Campaign/case/preflight authority failure is constructed only by Task 5's strict pre-run path with its finite primary blocker. Started-run precedence is: post-admission/start-chain failure; trusted terminal Setfarm cause; Setfarm canonical gate failure; Mission Control projection/render failure; missing/unavailable/failing `GoldenProductAssertionPort` evidence; accepted. An MC mismatch must not mask an earlier trusted Setfarm failure. A product assertion failure must not mask an ownership leak. Unknown or untrusted cause input must fail closed as `setfarm_core_failure`, not be guessed from text. Assert an actual legacy/shadow existing-repository run remains eligible against its own canonical workflow gates and is never failed merely for not being V3; a feature-dev canary with any actual protocol other than V3 fails closed.

Test `isGoldenRunCleanupExactlySettledV1()` independently against both result branches. A started run returns true only when every B-owned canonical cleanup/ownership observation is present, schema-valid, terminally observed, and exactly zero/released/clean as applicable, including verifier process/port release for runtime profiles. A strict pre-run returns true only for its schema-authenticated literal-null side-effect fields and exact hashed all-zero owner observation; it performs no terminal cleanup inference. A null, unavailable, active owner, nonterminal-timeout result, missing release receipt, process/port/worktree leak, dirty generated worktree, or unknown future cleanup member returns false. The helper reads no Mission Control projection, classification label, summary, or caller-supplied count.

- [ ] **Step 2: Run the classifier tests and confirm failure**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-classifier.test.ts
```

Expected: FAIL because `classifyGoldenRunV1` is not defined.

- [ ] **Step 3: Implement exact accepted gates**

Return `accepted` only when all of these conditions hold:

- run is terminal `completed` or `done`, actual workflow matches the selected strategy, compiler SHA equals the requested Setfarm release when the stored protocol carries that identity, and release identity remained pinned;
- a `v3-feature-dev-canary` has actual protocol V3, the requested compiler SHA, exact one-use admission binding, expected stack pack, design policy, minimum story count, required dependency edge, and exact compiler packet;
- a `canonical-existing-repository-workflow` has the actual stored protocol/version reported unchanged, its exact immutable campaign-template plus intent-bound fresh-attempt baseline/final source/integrated-remote-main identity, its canonical workflow-specific steps/PR/reviewed merge/tests, and no fabricated V3 packet/admission/deploy/transfer evidence;
- every required step and story is terminally successful and all story/final revisions bind the accepted candidate;
- `GoldenProductAssertionPort` returned the exact adapter/contract binding and every assertion ID required by `assertionContract` exactly once with `pass`; every applicable compiler predicate passes, build/test/runtime evidence is exact, and no severe console error exists;
- for `node-cli-task-register-v1`, `cli-add-canonical-jsonl` and `cli-list-canonical-jsonl` prove canonical JSONL stdout, empty stderr, and exit `0`; `cli-title-required` proves empty stdout, exact `TITLE_REQUIRED\n` stderr, and exit `2`; `cli-state-persists` proves an added record is visible to a later list invocation;
- for `node-express-api`, the durability assertion binds one successful write-state hash to exactly one `GoldenVerifierRuntimeDurabilityRestartReceiptV1`, then proves the same state through the reminted subject after a same-origin fresh process generation; absent/duplicate/replayed restart, source/contract/origin drift, or a read before replacement readiness cannot pass;
- every completion request is `accepted` with `applyPhase:"effects_committed"`, all mandatory effects are `applied` or `reconciled`, and claims have terminal outcomes consistent with their completion evidence;
- no open claim, attempt, runtime, termination, recovery, preparation, artifact, publication, operational-delivery, or compilation owner remains;
- exact required PRs exist, recorded head/source identities match, and actionable review state is settled;
- generated repository head/tree equals the accepted source and the root is clean;
- every HTTP/browser assertion set is bound to one sealed verifier contract and one authenticated lease whose exact release proves process absence and port release before cleanup collection; CLI/non-runtime cases carry only the typed not-applicable member;
- terminal delivery matches the case: exact transfer acknowledgement for `project-transfer`, or exact `setfarm-v3-not-deployable` evidence for `explicit-not-deployable`;
- Setfarm and Mission Control snapshot schema/hash match, render status/schema match the canonical run, both authority panels rendered, and all cleanup counts are zero.

- [ ] **Step 4: Implement typed failure mapping and root identity**

Use this exact mapping for V3 canonical `operationalFailure.failureIdentity.operationalCause`:

```typescript
function classifyTrustedCause(cause: OperationalFailureCauseV1): GoldenClassificationV1 {
  if (
    cause.failureClass === "infrastructure_failure"
    && (
      /(?:^|[._-])(?:provider|model)(?:[._-]|$)/u.test(cause.boundary)
      || /(?:QUOTA|RATE_LIMIT|RESOURCE_EXHAUSTED|ENGINE_OVERLOADED|PROVIDER_UNAVAILABLE|MODEL_UNAVAILABLE)/u.test(cause.failureCode)
    )
  ) return "provider_or_quota_failure";
  if (cause.failureClass === "infrastructure_failure") return "infrastructure_failure";
  if (
    cause.failureClass === "platform_authority_invalid"
    || cause.failureClass === "platform_invariant_failed"
  ) return "setfarm_core_failure";
  return "generated_product_failure";
}
```

Preflight/campaign/case/release/epoch/capacity failure never enters `classifyGoldenRunV1`; Task 5 maps its finite primary blocker directly to the strict `pre_run`/`campaign_configuration_failure` constructor before any start authority exists. Once an admitted launch begins, admission creation, fixture identity/resolution, or malformed start output is a started-run boundary failure and maps by its schema-valid finite Setfarm authority evidence rather than backdating a pre-run result. Snapshot invalidity, census disagreement, missing required canonical authority, ownership leak, release drift, protocol relabeling, and untrusted failure evidence classify as `setfarm_core_failure`. A schema-valid nonterminal-timeout observation with internally consistent DB/snapshot/project/cleanup reads uses `infrastructure_failure/GOLDEN_RUN_TIMEOUT_NONTERMINAL`; any canonical authority/census defect in that branch takes the earlier `setfarm_core_failure` precedence. Setfarm-valid Mission Control API hash, schema, render, or console mismatches classify as `mission_control_failure`. Missing, unavailable, duplicate, or failing assertion-port results and product predicate, source, PR, build, test, runtime, delivery behavior, or generated-worktree dirtiness failures classify as `generated_product_failure` only after platform ownership and authority are valid.

For canonical operational failures, use `operationalFailureCauseHashV1(cause)` as `rootCauseHash`. For harness-owned failures, hash this strict payload:

```typescript
const rootCauseHash = hashCanonicalJson({
  schema: "setfarm.internal-production-golden-harness-failure.v1",
  classification,
  reasonCode,
  boundary,
});
```

`isSystemicGoldenClassificationV1` returns true only for `setfarm_core_failure` and `mission_control_failure`.

Export this exact stable signature for Subproject E:

```typescript
export function isGoldenRunCleanupExactlySettledV1(
  result: GoldenRunResultV1,
): boolean;
```

Its implementation derives solely from B's schema-validated canonical terminal census, post-release cleanup evidence, and typed verifier-runtime release/not-applicable member. For a durability-restarted API runtime it additionally requires the restart receipt's replacement lease to be the exact generation named by the final release authority; the previous generation release and final replacement release must both be proven. It enumerates every current field explicitly and defaults false for an absent, null, unavailable, active, leaked, dirty, nonterminal, or unrecognized member. Standard and fleet settlement call this same helper; reports may show its boolean but may not reimplement it.

- [ ] **Step 5: Run focused tests and static checks**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-classifier.test.ts
npx tsc -p tsconfig.json --noEmit
npm run check:english
git diff --check
```

Expected: all commands exit `0`; all seven classifications are reachable only through typed evidence.

- [ ] **Step 6: Record the Task 4 Setfarm handoff checkpoint**

Run `git status --short` and `git diff --check`, verify the exact Task 4 scope, and return the file list plus focused/static evidence to the active Setfarm claim. Do not stage or commit.

---

### Task 5: Orchestrate typed starts, V3 admission, execution, assertions, and resumed collection

**Files:**
- Create: `src/internal-production/golden-run-harness.ts`
- Create: `tests/internal-production/golden-run-harness.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 and Task 3A; Subproject A's exact `InternalProductionBaselinePostHandoffReceiptV1` and fixed no-argument `resolveHistoricalBaselinePostHandoffReceiptV1()` export; Task 2's exact `GoldenLaunchOperationMigrationReleaseReceiptV1`, `GoldenLaunchOperationMigrationCurrentVerificationV1`, and zero-argument `verifyCurrentGoldenLaunchOperationMigrationV1()`; `createV3ReleaseAdmissionRepository(sql, resultStore).createCanary(input)`; `randomBytes(32)`; `InternalCanaryAdmissionContextV1`; repository/template/fixture-attempt/observer/assertion/verifier-runtime/phase ports; a read-only result-and-timeout-supersession history port. B defines no baseline or migration-release receipt schema, resolver path, marker parser, current-service verifier, or fallback observer.
- Produces: `GoldenAssertionSubjectV1`, `assembleGoldenAssertionSubjectV1(input)`, `authenticateGoldenAssertionSubjectV1(value)`, `restartGoldenVerifierRuntimeForDurabilityV1(input)`, `GoldenProductAssertionPort`, `createUnavailableGoldenProductAssertionPort()`, `createGoldenAssertionBoundaryErrorSetV1(goldenCase, finiteBoundaryCode)`, `GoldenPreStartAuthorizationPort`, `createDefaultGoldenPreStartAuthorizationPort()`, `createGoldenRepairCasPreStartAuthorizationPortV1(authorize)`, `authenticateGoldenPreStartAuthorizationPortV1(value)`, `GoldenLifecycleCheckpointPort`, `createNoopGoldenLifecycleCheckpointPort()`, exact narrow `GoldenServiceRestartActionPortV1`, strict `GoldenServiceRestartActionReceiptV1Schema`/`GoldenServiceRestartActionReceiptV1`, B-branded `GoldenRegisteredExternalLifecycleCheckpointV1`, `createGoldenRegisteredExternalLifecycleCheckpointV1({implementationId,actions})`, opaque `GoldenExternalLifecycleCheckpointCapabilityV1`, `createGoldenExternalLifecycleCheckpointCapabilityV1({campaignHash,caseId,namespace,finalReleaseEpoch,checkpoint})`, `authenticateGoldenExternalLifecycleCheckpointCapabilityV1(value)`, `GoldenPreflightPorts`, `GoldenCollectionPorts`, `GoldenHarnessPorts`, `GoldenStageLaunchOutcomeV1`, the exact outer `GoldenCaseExecutionOutcomeV1`, `GoldenPreparedExecutionOutcomeV1`, narrow `GoldenPreparedExecutionPorts`, `createGoldenPreRunResultV1(input)`, exact `deriveGoldenCampaignExecutionCapacityV1({campaign,campaignHash,finalReleaseEpoch,results,timeoutReconciliations,platform}): GoldenCampaignExecutionCapacityV1`, `preflightGoldenCaseV1(loaded, caseId, releaseSha, ports): Promise<GoldenPreflightResultV1>`, `stageGoldenCaseLaunchV1(loaded, caseId, releaseSha, ports): Promise<GoldenStageLaunchOutcomeV1>`, `executePreparedGoldenCaseV1({prepared,loaded?,ports}): Promise<GoldenPreparedExecutionOutcomeV1>`, `recoverPreparedGoldenCaseV1({prepared,loaded?,ports}): Promise<GoldenPreparedExecutionOutcomeV1>`, `executeGoldenCaseV1(loaded, caseId, releaseSha, ports): Promise<GoldenCaseExecutionOutcomeV1>`, `collectGoldenCaseV1(loaded, caseId, releaseSha, runId, ports): Promise<GoldenStartedRunResultV1>`, and exact `reconcileTimedOutGoldenRunV1(input): Promise<Readonly<{ terminalResult: GoldenStartedRunResultV1; supersession: GoldenTimeoutTerminalSupersessionV1 }>>`.
- Start boundary: only a fresh `stageGoldenCaseLaunchV1` may create/reopen a recovery context and call `phases.prepareLaunch`, and it reserves capacity exactly once. After that reservation, stage or `recoverPreparedGoldenCaseV1` may idempotently finish only the same context-bound persisted intent's missing attempt/admission/authorization/issued transitions; their authenticators forbid a different logical launch or reconstructed task/result context. Only `executePreparedGoldenCaseV1` may make the initial call of the already issued `starter.start`; `recoverPreparedGoldenCaseV1` may resolve/adopt/resume only that same issued operation under its recovery contract. Attempt provisioning occurs only for `canonical-existing-repository-workflow`, and admission creation occurs only for `v3-feature-dev-canary`. Successful staging ends immediately after the authenticated recovery context, launch-operation outbox, `starterInvocationIssued` authority, and capacity reservation are durable, before the starter side effect. `GoldenPreparedExecutionPorts` exposes only exact same-intent continuation methods plus an optional B-authenticated external lifecycle capability and contains no A/history/preflight/capacity derivation or `prepareLaunch`; it cannot acquire a new context, slot, or intent. Preflight receives only `GoldenPreflightPorts`; collection receives only `GoldenCollectionPorts`, which has distinct read/action members and contains no admission, starter, attempt provisioner, pre-start authorizer, lifecycle checkpoint, or unused mutation capability.

- [ ] **Step 1: Write failing fake-port orchestration tests**

Create deterministic fake ports and verify:

- an unknown, empty, or malformed case selector fails with `GOLDEN_ARGUMENT_CASE_UNKNOWN` before preflight construction and before the first A/history/release/health/ownership read; preflight/stage/execute return no preflight/result object and create no case-derived hash, ordinal, intent, reservation, admission, attempt, outbox, run, or store record;
- preflight calls A's exact historical resolver once and then Task 2's zero-argument active migration-release verifier once, and performs no attempt provision, fixture resolution, admission, run start, lifecycle checkpoint, result-store write, project sync, source build, or report write. Missing/corrupt/mode-invalid A or migration-release receipt bytes, a missing/duplicate/malformed tracked marker, wrong fixed canonical ref/hash, a recorded Setfarm/Mission Control commit that is not an ancestor of current clean main, source/schema/digest drift, or a migration-release SHA unequal to the requested clean release blocks before every mutation without consulting A's current-service verifier or applying/repairing schema;
- preflight returns the exact `GoldenPreflightResultV1` branch at every authority boundary: missing A receipt has null historical/release/epoch/capacity; missing clean release retains only historical authority; requested-release mismatch retains observed historical/release but has null epoch/capacity; capacity derivation failure retains historical/release/epoch but null capacity; a later policy/ownership block and an admission have all four authorities. Tests reject zero-hash stand-ins, structural omission, wrong authority-stage/null relation, unsorted/duplicate blockers, and a preflight hash that did not cover the nulls;
- blocked execute/stage with an exact all-zero ownership observation creates or reopens one `kind:"pre_run"` result and performs zero intent, attempt, admission, authorization, outbox, starter, lifecycle, workflow-evidence, assertion, project, or result-cleanup action. The first primary failure gets launch-attempt ordinal one; response loss after result storage reopens the same stable subject/result; a changed primary failure or intervening closed result receives the next ordinal. A blocked preflight with any active/unavailable owner returns its exact blocked outcome without constructing or storing a pre-run result. No path produces a run-shaped result with null run authority;
- V3 execute creates exactly one admission containing exactly one slot and starts exactly one feature-dev run;
- V3 execute first content-addresses one authenticated `GoldenPreparedRecoveryContextV1`, then atomically persists the path-free context-bound intent/preparation/selector secret, captures/binds the context-derived full task and pre-start set, authorizes that exact context/execution binding from the frozen prior-result projection, and only then calls the idempotent admission adapter; injected crashes recover/reuse exactly one context/selector/admission and never create an orphan second context or admission;
- a structural/cloned/unregistered pre-start authorization port is rejected before its callback; B default and B-wrapped C repair-CAS ports authenticate by WeakMap object identity, and a wrong intent/context receipt, throw, denial, or replay starts neither admission nor run;
- V3 execute passes the exact case hash, context-owned `goldenAdmissionTaskHashV1(task)`, the derived target accepted-result repetition `1 | 2`, release SHA, campaign hash as suite hash, and preflight hash; the distinct context-owned UTF-8 `promptHash` remains report evidence, while the launch/start chain binds the recovery-context pair, A's historical baseline receipt hash, and the complete current final-release epoch;
- existing-repository execute validates one immutable template, fsyncs one path-free intent, provisions/binds one fresh attempt, resolves its strictly contained private path, atomically binds the resulting full task/pre-start set, authorizes that exact execution, creates zero admissions, and starts exactly one bug-fix/security-audit run without a protocol request;
- the exact existing-repository order is `create/reopen recovery context -> prepareLaunch(context)/fsync -> provision({persistedIntent,template}) -> bindExistingRepositoryAttempt/fsync -> resolve-contained-attempt -> context-task capturePreStartSet -> bindLaunchExecution/fsync -> context-prior-results preStartAuthorization/fsync -> preVerification -> recordStarterInvocationIssued/outbox-fsync -> idempotent starter operation`; recovery before issue reopens rather than fabricates the campaign/case/task/release/ordinal/result context and completes the same operation, execute recovery after issue may resume only that authenticated outbox until the one transaction-bound run exists, read-only collect only adopts it, and only a prior terminal/classified intent permits a separately authorized new intent/ordinal/remote;
- release drift, dirty Setfarm, dirty Mission Control, compiler build mismatch, migration mismatch, artifact-index failure, unhealthy service, an unattributed/unrelated-campaign/prior-epoch active owner, same-campaign ownership already at eligible capacity, or three prior identical systemic causes blocks before admission creation;
- `deriveGoldenCampaignExecutionCapacityV1(...)` calls the one canonical effective-result mapper, ignores its `preRunResults` partition for terminal/accepted/ramp counting, returns configured/eligible `1/1` for standard/matrix, returns fleet `2/1` before the ramp, and returns `2/2` only after the first five execution-ordered current-epoch effective `kind:"run"` results are terminal, cleanup-exact, accepted (therefore neither systemic nor pending review), with no unresolved timeout; one or many immutable pre-run configuration failures never advance the first-five list. Any later systemic/nonaccepted started result, cleanup drift, pending timeout/review, epoch drift, or unrelated owner lowers eligibility to one. Two barrier-synchronized same-campaign/same-epoch fresh stage calls succeed only at `2/2`, each publishes one distinct authenticated reservation, and a third/every unrelated owner loses before intent/outbox creation. With both reservations still active and the fleet at full capacity, `executePreparedGoldenCaseV1` continues the first staged launch and `recoverPreparedGoldenCaseV1` continues/adopts the second without calling preflight, capacity derivation, `prepareLaunch`, provisioning, admission creation, or authorization; counters remain two reservations and never three;
- polling rejects strategy/workflow/protocol/compiler drift and stops at the exact case timeout; only V3 strategy requires actual protocol V3;
- compile-time/source-boundary tests prove `GoldenPreflightPorts` contains only its five declared read-only members and cannot accept a phase mutator, admission, starter, provisioner, authorizer, lifecycle action, assertion adapter, verifier runtime, or write-enabled result store. `GoldenCollectionPorts` contains only its declared `read` and `actions` members; it has no admission, starter, attempt provisioner, pre-start authorizer, lifecycle checkpoint, full `GoldenHarnessPorts`, or structurally retained unused mutation member. `GoldenPreparedExecutionPorts` contains only exact same-intent missing-transition, issued-operation, collection, fixed internal-checkpoint, and opaque external-capability members: it deliberately permits idempotent provision/admission/authorization binding for its already reserved persisted intent, but exposes no historical/A preflight reader, capacity derivation, active-slot mutator, or `prepareLaunch`. Source tests reject a prepared-continuation call to any fresh-stage symbol, a different context/reservation/intent, both checkpoint members, or a raw external lifecycle port;
- collect accepts an existing run ID through `GoldenCollectionPorts`, never provisions an attempt or starts a run, cannot even receive those capabilities, and produces the same result as uninterrupted execute;
- the optional fixed lifecycle checkpoint or B-authenticated external capability receives only the exact started run ID/number and current active story generation; a matched action returns/reopens one durable operation-bound receipt, which B binds to null-or-exact `externalCapabilityHash` and persists as `lifecycle-action-recorded` before terminal/timeout observation, and every interruption from pre-operation fsync through phase append reconciles the identical receipt without blind action replay;
- `createGoldenRegisteredExternalLifecycleCheckpointV1({implementationId,actions})` is the only constructible external restart checkpoint. Each finite implementation ID selects B's exact code-owned predicate/wrapper and accepts only the narrow `GoldenServiceRestartActionPortV1`; D supplies that adapter and never implements `GoldenLifecycleCheckpointPort`. The wrapper strictly parses and rehashes the action receipt and equality-binds implementation/campaign/case/run/full epoch/generation/operation/service-state/evidence before returning B's lifecycle receipt. `createGoldenExternalLifecycleCheckpointCapabilityV1()` then accepts only this exact WeakMap-branded object plus `recovery-active-run` and the complete current final-release epoch. Prepared execution rejects clone/JSON round-trip/wrong namespace/campaign/case/epoch/implementation/source digest/predicate/status/action, arbitrary function/raw lifecycle port/unbranded D adapter, use by ordinary matrix/E, or simultaneous fixed checkpoint before starter/action. A fresh-process reconstruction through both B factories for the same implementation, action authority, and byte-identical epoch has the same public hashes and a new authentic object identity; a source, registry-entry, action receipt, predicate, or epoch substitution fails. B source tests contain no C/D import or future-file existence dependency;
- a checkpoint receipt with another run, number, generation, predicate hash, action ID, action-operation null relation/hash, or action receipt hash fails closed; a checkpoint error still proceeds to terminal evidence collection and cannot produce acceptance;
- the no-op checkpoint changes no service, GitHub, run, admission, database, process, or report state, and lifecycle checkpoint injection never causes a second start;
- after terminal detection, project sync happens once, bounded projection polling waits for equal canonical hashes, final canonical/project evidence is collected, an internal assertion subject is assembled, `GoldenProductAssertionPort.evaluate` is called exactly once with that subject, and classification happens strictly after that call;
- for HTTP/browser authority the exact event order is terminal canonical collection, authenticated verifier lease/readiness, subject assembly, assertion evaluation while the listener is live, exact stop/release in `finally`, post-release canonical and cleanup re-collection, then classification; no product adapter receives process/port lifecycle authority;
- for Node Express API only, an authenticated adapter may call `restartGoldenVerifierRuntimeForDurabilityV1({ subject, expectedStateHash })` exactly once after its successful write; the helper—not C—performs exact stop/absence/same-origin fresh start, returns a reminted authenticated subject plus receipt for the later read, and the harness finally releases the replacement generation;
- interruption after every persisted phase or runtime-registry transition first runs tuple-keyed `reconcileLogicalLease`; exact live/released registry receipts repair missing lease/release phases, including generation-two durability restart, while phase/registry conflict or ambiguity fails closed without another process action;
- interruption before launch-outbox fsync permits no start; after `issued:true`, execute recovery reopens and idempotently resumes only the exact execution/issued/operation outbox, while collect remains read-only; exact operation-hash lookup adopts one row, zero stays pending, and multiple/conflicting candidates remain durably ambiguous;
- three-repeat regression constructs one timeout original and its same-subject terminal replacement with the same systemic root plus two other effective subjects: the raw report contains four rows, but the canonical mappings select exactly three effective occurrences and block at three; the timeout/replacement pair alone never counts twice;
- subject assembly rejects repository/source mismatch, dirty source, unverified invocation/runtime authority, fixture mismatch, or any absolute path escaping the verified project/fixture roots; the public result and serialized assertion set contain no absolute path;
- subject assembly carries an optional opaque `workflowEvidence` wrapper only by exact collector reference, includes only its `workflowEvidenceHash` in `bindingHash`, and rejects mutable/forged/wrong-run evidence; public results, assertion sets, phases, stores, previews, reports, and CLI output never serialize the wrapper or inner capability;
- started-run result construction copies exactly `collectedAuthority.workflowEvidence?.workflowEvidenceHash ?? null` into `GoldenStartedRunResultV1.workflowEvidenceHash`, requires the terminal existing-repository/V3 and nonterminal-timeout null relations above, and rejects a missing field, caller-authored hash, or a hash inconsistent with the authenticated subject before computing `resultHash`; pre-run construction always emits literal null and cannot invoke the collector;
- an unavailable assertion adapter returns every required assertion as `unavailable` and makes acceptance impossible without throwing away the rest of the evidence;
- a non-accepted result returns immediately and no second case exists in the API;
- adapter throws, rejected promises, timeouts, or schema-invalid returns are converted to one deterministic complete assertion set containing every required assertion exactly once as `unavailable`; HTTP/browser release still runs in `finally`, only a valid release receipt may advance the phase graph, and the typed result cannot pass;
- durability restart rejects a structural/cloned/stale subject, non-API profile, non-HTTP runtime, state-hash drift, second call, replay after completion, replacement origin/source/contract drift, or final release not bound to the replacement; crash recovery never double-starts or skips cleanup;
- a nonterminal deadline takes only the timeout phase branch, performs bounded DB/snapshot/project/cleanup reads, marks terminal-only evidence not attempted, never allocates a verifier/browser/assertion session or render/GitHub action, and cannot claim zero cleanup while the run remains active.
- reconciliation of an immutable timeout result refuses a still-active or different run; once the exact run becomes terminal it performs the normal terminal assertion/runtime/release/post-cleanup path, stores one terminal result and one content-addressed supersession receipt, and is byte-idempotent without altering the original timeout result.

- [ ] **Step 2: Run the harness test and confirm failure**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-harness.test.ts
```

Expected: FAIL because the harness module does not exist.

- [ ] **Step 3: Define the exact dependency ports**

```typescript
export interface GoldenAdmissionPort {
  createCanary(input: Readonly<{
    intent: GoldenLaunchIntentV1;
    preparation: GoldenCanaryLaunchPreparationV1;
    authorization: GoldenPreStartAuthorizationReceiptV1;
    releaseSha: string;
    suiteHash: string;
    preflightHash: string;
    ttlMs: number;
    slots: readonly Readonly<{
      caseHash: string;
      taskHash: string;
      repetition: number;
    }>[];
  }>): Promise<Readonly<{
    contexts: readonly InternalCanaryAdmissionContextV1[];
    admission: Omit<GoldenCanaryIntentAdmissionReceiptV1, "admissionBindingHash">;
  }>>;
}

export function createV3GoldenAdmissionPortV1(
  repository: ReturnType<typeof createV3ReleaseAdmissionRepository>,
): GoldenAdmissionPort;

export interface GoldenResultHistoryPort {
  listCampaign(campaignHash: string): Promise<readonly GoldenRunResultV1[]>;
  listCommittedTimeoutReconciliationPairAuthorities(
    campaignHash: string,
  ): Promise<readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[]>;
}

export interface GoldenClock {
  now(): Date;
  sleep(milliseconds: number): Promise<void>;
}

export type GoldenAssertionSubjectV1 = Readonly<{
  schema: "setfarm.internal-production-golden-assertion-subject.v1";
  repository: Readonly<{
    kind: "generated-project" | "campaign-existing-repository";
    repositoryPath: string;
    repositoryRef: string;
    headSha: string;
    treeHash: string;
    clean: true;
  }>;
  source: GoldenCollectedAssertionAuthorityV1["source"];
  invocation: GoldenCollectedAssertionAuthorityV1["invocation"];
  runtime:
    | Readonly<{
        kind: "live-verifier-runtime";
        adapter: "http" | "browser";
        origin: string;
        runtimeContractHash: string;
        leaseHash: string;
        processIdentityHash: string;
        listenerIdentityHash: string;
        durabilityRestart:
          | Readonly<{
              kind: "one-shot-node-express-api-restart";
              capabilityHash: string;
            }>
          | Readonly<{
              kind: "not_applicable";
              reason: "not_node_express_api";
            }>;
      }>
    | Readonly<{ kind: "not_applicable"; reason: "cli_only" | "not_deployed" }>;
  fixture: GoldenResolvedExistingRepositoryFixtureV1 | null;
  fixtureWorkflow: GoldenAuthenticatedFixtureWorkflowV1 | null;
  workflowEvidence: GoldenWorkflowEvidenceV1 | null;
  bindingHash: string;
}>;

export function assembleGoldenAssertionSubjectV1(input: Readonly<{
  goldenCase: GoldenCaseV1;
  run: GoldenRunPollV1;
  canonical: GoldenCanonicalCollectionV1;
  collectedAuthority: GoldenCollectedAssertionAuthorityV1;
  projectAuthority: GoldenProjectAssertionAuthorityV1;
  fixture: GoldenResolvedExistingRepositoryFixtureV1 | null;
  fixtureWorkflow: GoldenAuthenticatedFixtureWorkflowV1 | null;
  verifierRuntime: GoldenVerifierRuntimeLeaseV1 | null;
}>): GoldenAssertionSubjectV1;

export function authenticateGoldenAssertionSubjectV1(
  value: unknown,
): GoldenAssertionSubjectV1;

export async function restartGoldenVerifierRuntimeForDurabilityV1(input: Readonly<{
  subject: GoldenAssertionSubjectV1;
  expectedStateHash: string;
}>): Promise<Readonly<{
  subject: GoldenAssertionSubjectV1;
  receipt: GoldenVerifierRuntimeDurabilityRestartReceiptV1;
}>>;

export interface GoldenProductAssertionPort {
  evaluate(input: Readonly<{
    campaignHash: string;
    goldenCase: GoldenCaseV1;
    run: GoldenRunPollV1;
    canonical: GoldenCanonicalCollectionV1;
    project: GoldenProjectInspectionV1;
    subject: GoldenAssertionSubjectV1;
  }>): Promise<GoldenProductAssertionSetV1>;
}

export function createUnavailableGoldenProductAssertionPort(): GoldenProductAssertionPort;

export function createGoldenAssertionBoundaryErrorSetV1(
  goldenCase: GoldenCaseV1,
  finiteBoundaryCode:
    | "GOLDEN_ASSERTION_ADAPTER_THROW"
    | "GOLDEN_ASSERTION_ADAPTER_TIMEOUT"
    | "GOLDEN_ASSERTION_ADAPTER_INVALID",
): GoldenProductAssertionSetV1;

export interface GoldenPreStartAuthorizationPort {
  authorize(input: Readonly<{
    intent: GoldenLaunchIntentV1;
    intentHash: string;
    recoveryContextHash: string;
    campaignHash: string;
    caseId: string;
    caseHash: string;
    profileId: GoldenProfileIdV1;
    repetition: 1 | 2;
    finalReleaseEpoch: GoldenFinalReleaseEpochV1;
    executionBindingHash: string;
    priorResults: readonly Readonly<{
      resultHash: string;
      repetition: 1 | 2;
      releaseEpochHash: string;
      classification: GoldenClassificationV1;
      rootCauseHash: string | null;
      observationDisposition: "terminal-settlement" | "nonterminal-timeout";
    }>[];
    caseContextHash: string;
  }>): Promise<GoldenPreStartAuthorizationReceiptV1>;
}

export function createDefaultGoldenPreStartAuthorizationPort():
  GoldenPreStartAuthorizationPort;

export function createGoldenRepairCasPreStartAuthorizationPortV1(
  authorize: GoldenPreStartAuthorizationPort["authorize"],
): GoldenPreStartAuthorizationPort;

export function authenticateGoldenPreStartAuthorizationPortV1(
  value: unknown,
): GoldenPreStartAuthorizationPort;

export type GoldenLifecycleCheckpointPredicateV1 =
  | Readonly<{ kind: "disabled"; actionId: "none" }>
  | Readonly<{
      kind: "active-run-generation";
      actionId: "restart-mission-control" | "restart-setfarm-dashboard";
      requiredRunStatuses: readonly ["running", "resuming"];
    }>
  | Readonly<{
      kind: "actionable-post-pr-review-generation";
      actionId: "publish-golden-actionable-post-pr-review";
      requiredRunStatuses: readonly ["running", "resuming"];
      requiredWorkflowStepId: "post-pr-review";
      requiredGenerationKind: "workflow-step-claim-generation";
    }>;

export type GoldenLifecycleGenerationV1 = GoldenActiveRunGenerationV1;

export type GoldenLifecycleCheckpointReceiptV1 = Readonly<{
  runId: string;
  runNumber: number;
  generation: GoldenLifecycleGenerationV1;
  predicateHash: string;
  externalCapabilityHash: string | null;
  actionId: GoldenLifecycleCheckpointPredicateV1["actionId"];
  actionOperationHash: string | null;
  actionReceiptHash: string;
  evidenceRefs: readonly string[];
}>;

export interface GoldenLifecycleCheckpointPort {
  readonly predicate: GoldenLifecycleCheckpointPredicateV1;
  tryAction(input: Readonly<{
    campaignHash: string;
    caseId: string;
    runId: string;
    runNumber: number;
    generation: GoldenLifecycleGenerationV1;
    poll: GoldenRunPollV1;
  }>): Promise<GoldenLifecycleCheckpointReceiptV1 | null>;
}

export function createNoopGoldenLifecycleCheckpointPort(): GoldenLifecycleCheckpointPort;

export type GoldenExternalLifecycleCheckpointImplementationIdV1 =
  | "mission-control-active-run-restart-v1"
  | "setfarm-dashboard-active-run-restart-v1";

export type GoldenServiceRestartActionReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-golden-service-restart-action-receipt.v1";
  implementationId: GoldenExternalLifecycleCheckpointImplementationIdV1;
  campaignHash: string;
  caseId: string;
  runId: string;
  runNumber: number;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  generationHash: string;
  restartOperationHash: string;
  beforeServiceAuthorityHash: string;
  afterServiceAuthorityHash: string;
  restartCompleted: true;
  evidenceRefs: readonly CanonicalRef[];
  receiptHash: string;
}>;

export const GoldenServiceRestartActionReceiptV1Schema:
  z.ZodType<GoldenServiceRestartActionReceiptV1>;

export interface GoldenServiceRestartActionPortV1 {
  restart(input: Readonly<{
    implementationId: GoldenExternalLifecycleCheckpointImplementationIdV1;
    campaignHash: string;
    caseId: string;
    runId: string;
    runNumber: number;
    finalReleaseEpoch: GoldenFinalReleaseEpochV1;
    generation: GoldenLifecycleGenerationV1;
  }>): Promise<GoldenServiceRestartActionReceiptV1>;
}

export interface GoldenRegisteredExternalLifecycleCheckpointV1 {
  readonly kind: "registered-external-lifecycle-checkpoint";
  readonly implementationId: GoldenExternalLifecycleCheckpointImplementationIdV1;
  readonly registrationHash: string;
}

export function createGoldenRegisteredExternalLifecycleCheckpointV1(input: Readonly<{
  implementationId: GoldenExternalLifecycleCheckpointImplementationIdV1;
  actions: GoldenServiceRestartActionPortV1;
}>): GoldenRegisteredExternalLifecycleCheckpointV1;

export type GoldenExternalLifecycleCheckpointCapabilityV1 = Readonly<{
  kind: "authenticated-external-lifecycle-checkpoint";
  campaignHash: string;
  caseId: string;
  namespace: "recovery-active-run";
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  epochHash: string;
  checkpointImplementationId: GoldenExternalLifecycleCheckpointImplementationIdV1;
  checkpointImplementationHash: string;
  predicateHash: string;
  capabilityHash: string;
}>;

export function createGoldenExternalLifecycleCheckpointCapabilityV1(input: Readonly<{
  campaignHash: string;
  caseId: string;
  namespace: "recovery-active-run";
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  checkpoint: GoldenRegisteredExternalLifecycleCheckpointV1;
}>): GoldenExternalLifecycleCheckpointCapabilityV1;

export function authenticateGoldenExternalLifecycleCheckpointCapabilityV1(
  value: unknown,
): GoldenExternalLifecycleCheckpointCapabilityV1;

export type GoldenPreflightPorts = Readonly<{
  repository: Pick<GoldenRunRepository, "inspectPlatform">;
  release: GoldenReleaseObserver;
  health: Pick<GoldenProjectionObserver, "health">;
  history: GoldenResultHistoryPort;
  phases: Pick<GoldenCollectionPhaseStore, "inspectActiveGoldenOwnerships">;
}>;

export type GoldenCollectionPorts = Readonly<{
  read: Readonly<{
    repository: Pick<GoldenRunRepository,
      "readRun" | "collectRun" | "collectAssertionAuthority">;
    release: GoldenReleaseObserver;
    fixtures: Pick<GoldenExistingRepositoryFixturePort, "resolve" | "inspectWorkflow">;
    launchLookup: Pick<GoldenRunLaunchLookupPort, "resolve">;
    projects: GoldenProjectObserver;
    projections: Pick<GoldenProjectionObserver, "health" | "snapshots" | "renderRun">;
    cleanup: GoldenHostCleanupObserver;
    phases: Pick<GoldenCollectionPhaseStore, "readPreparedLaunches" | "read">;
  }>;
  actions: Readonly<{
    fixtureVerification: Pick<GoldenExistingRepositoryFixturePort, "verifyWorkflow">;
    projectSync: Pick<GoldenProjectionObserver, "syncProject">;
    verifierRuntime: GoldenVerifierRuntimePort;
    phases: Pick<GoldenCollectionPhaseStore, "promoteLaunchToRunBound" | "append">;
    productAssertions: GoldenProductAssertionPort;
    clock: GoldenClock;
  }>;
}>;

export function deriveGoldenCampaignExecutionCapacityV1(input: Readonly<{
  campaign: GoldenCampaignV1;
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  results: readonly GoldenRunResultV1[];
  timeoutReconciliations:
    readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[];
  platform: GoldenPlatformInspectionV1;
}>): GoldenCampaignExecutionCapacityV1;

export type GoldenHarnessPorts = Readonly<{
  repository: GoldenRunRepository;
  release: GoldenReleaseObserver;
  fixtures: GoldenExistingRepositoryFixturePort;
  existingRepositoryAttempts: GoldenExistingRepositoryAttemptProvisioningPortV1;
  starter: GoldenRunStarter;
  launchLookup: GoldenRunLaunchLookupPort;
  projects: GoldenProjectObserver;
  projections: GoldenProjectionObserver;
  cleanup: GoldenHostCleanupObserver;
  verifierRuntime: GoldenVerifierRuntimePort;
  phases: GoldenCollectionPhaseStore;
  preStartAuthorization: GoldenPreStartAuthorizationPort;
  productAssertions: GoldenProductAssertionPort;
  admissions: GoldenAdmissionPort;
  history: GoldenResultHistoryPort;
  clock: GoldenClock;
  lifecycleCheckpoint?: GoldenLifecycleCheckpointPort;
}>;

export async function reconcileTimedOutGoldenRunV1(input: Readonly<{
  loaded: LoadedGoldenCampaignV1;
  originalTimeoutResult: GoldenStartedRunResultV1;
  ports: Omit<GoldenHarnessPorts,
    "admissions" | "starter" | "existingRepositoryAttempts" |
    "preStartAuthorization" | "lifecycleCheckpoint">;
}>): Promise<Readonly<{
  terminalResult: GoldenStartedRunResultV1;
  supersession: GoldenTimeoutTerminalSupersessionV1;
}>>;
```

`GoldenPreStartAuthorizationPort` is an in-memory authenticated hook invoked exactly once after both the context-bound path-free intent and post-provision launch-execution binding are fsynced and before `createCanary` or `starter.start`. B owns a private `WeakMap` of the exact deeply frozen default and repair-CAS wrapper objects; structural clones fail before callback. B accepts only input derived from the authenticated `GoldenPreparedRecoveryContextV1`, requires `recoveryContextHash` to equal the intent/execution chain, and recomputes `caseContextHash` from that context's campaign/case/profile/repetition/final epoch and sorted bounded validated prior-result projection plus exact `executionBindingHash`. B never rereads history during recovery. `createDefaultGoldenPreStartAuthorizationPort()` returns `not_required` only with no prior non-accepted result in the frozen context projection for the slot; otherwise it denies. C supplies only its CAS callback to `createGoldenRepairCasPreStartAuthorizationPortV1()` and may authorize only after its own authenticated comparison. Neither implementation receives a raw selector, nonce, admission context, repository path, full task bytes, mutable result body, or caller-authored prior-result projection.

Extend the existing repository's `createCanary` input compatibly with optional `goldenLaunchBinding?: { intentHash; preparationIdHash; selectorTokenHash; admissionRequestHash }`; all four fields parse as `Sha256Schema`, enter its existing canonical creation-lock/artifact identity, and are equality-bound to the one created admission and slot. Existing convergence callers omit the field and retain byte-identical behavior. `createV3GoldenAdmissionPortV1()` is the sole production caller that supplies it: it authenticates the exact preparation capability, obtains the selector only within its private controller, calls the repository, and verifies a replay returns the same admission/slot receipt. The repository rejects the same intent with different preparation/selector/request, a different intent attempting to reuse the selector, multiple matching admissions, or any returned context not bound to the stored artifact. Tests crash before repository call, after the DB commit, and before phase binding; every retry reuses one admission and never allocates an orphan second slot.

`GoldenAssertionSubjectV1` is an in-memory capability, not a Zod receipt. The module owns a private `WeakMap<object, GoldenAssertionSubjectControllerV1>` and records only deeply frozen object graphs returned by `assembleGoldenAssertionSubjectV1()` with their binding hash, immutable assembly authorities, current verifier lease, verifier-runtime port, and one-shot restart state; callers cannot create an authenticated subject by matching its structural TypeScript shape or recomputing a public hash. `authenticateGoldenAssertionSubjectV1()` requires object identity membership, frozen graph, and recomputed binding equality; every concrete Subproject C adapter calls it before side effects. Tests attempt post-mint mutation of repository path, invocation argv/path, runtime origin, lease identity, restart capability, source identity, fixture identity, authenticated fixture-workflow capability, opaque workflow-evidence reference/hash, and binding hash and prove mutation is impossible or authentication fails without an adapter side effect. `assembleGoldenAssertionSubjectV1()` requires collector, project, fixture, run, canonical, and lease authorities to agree. It copies `collectedAuthority.workflowEvidence` by exact wrapper and inner capability reference, never clones it. Its binding hash covers the path-free identity projection, durability capability kind/hash, and `workflowEvidence?.workflowEvidenceHash ?? null`, never the opaque capability, private paths, or origin. A structural clone with the same hash does not authenticate because the subject WeakMap and C's inner capability WeakMap both require original identity.

For a Node Express API/live-HTTP case, assembly mints `durabilityRestart.kind:"one-shot-node-express-api-restart"` and a capability hash bound to run/case/source/contract/logical lease; every other subject gets typed `not_applicable`. `restartGoldenVerifierRuntimeForDurabilityV1()` authenticates the subject, reconciles the logical lease as live generation one, then invokes only B's runtime port. On success it reconciles generation two plus the exact restart receipt before reminting the subject. Interruption/error is recoverable only through the durable registry; no blind replacement is allowed. After evaluation, the harness reconciles again, persists the exact optional restart receipt with assertions, and finally releases only the reconciled current generation. No C adapter receives process authority.

The harness substitutes `createNoopGoldenLifecycleCheckpointPort()` when absent. A non-no-op port receives only nonterminal exact active generations. C/D production `tryAction()` implementations are durable/idempotent by `(runId,runNumber,generationHash,predicateHash,actionId)`. Restart actions set `actionOperationHash:null` and rely on D's durable service operation. The actionable GitHub review sets a non-null C operation hash that was generation-scoped and fsynced before mutation. While its journal is only `issued`, zero exact/conflicting comments permits fsyncing `post-attempted` and making the sole POST; one exact author/head/path/right-line/body match is adopted. Once `post-attempted` exists, recovery is reconciliation-only: one exact match is adopted, while zero after the bounded visibility window, multiple exact matches, any partial conflict, or an uncertain query is durable ambiguity and never causes another POST. After the side effect each implementation content-addresses its receipt; a repeated identical call reopens/revalidates the operation and receipt rather than blindly acting again. B validates the complete receipt, operation null relation, and canonical refs and appends `lifecycle-action-recorded` before another poll or terminal/timeout observation; only the phase then suppresses future calls. Wrong/conflicting reopen or remote ambiguity fails closed. `actionable-post-pr-review-generation` still matches only exact `post-pr-review`; the port cannot start/resume a run, and collect never invokes it.

`createGoldenRegisteredExternalLifecycleCheckpointV1({implementationId,actions})` makes the registry constructible without granting downstream code a raw lifecycle hook. B owns the finite implementation registry and the complete `GoldenLifecycleCheckpointPort` wrapper; D may implement only `GoldenServiceRestartActionPortV1.restart`. The registry maps `mission-control-active-run-restart-v1` and `setfarm-dashboard-active-run-restart-v1` to respectively `restart-mission-control` and `restart-setfarm-dashboard`, one fixed semantic B module/export identity and expected semantic installed-output/source digest, and the exact `kind:"active-run-generation"` predicate with the fixed `running,resuming` status tuple. The returned `GoldenRegisteredExternalLifecycleCheckpointV1` is deeply frozen and B WeakMap-branded; its public interface exposes only `kind`, the selected implementation ID, and `registrationHash`, which hashes that public pair plus the B registry implementation/predicate hashes. It exposes no `predicate`, `tryAction`, function, path, command, action adapter, or lifecycle port; the private controller retains `actions` and B's wrapper.

On a matching generation the B wrapper calls `actions.restart()` with only the registry-selected implementation ID and authenticated campaign/case/run/full epoch/generation identities. It strictly parses `GoldenServiceRestartActionReceiptV1`, recomputes its full epoch and `receiptHash`, requires sorted unique bounded canonical evidence refs, positive run number, distinct before/after service authority hashes, `restartCompleted:true`, and exact equality to the call. A wrong service implementation, campaign/case/run/epoch/generation, duplicate/unsafe evidence, unchanged authority, missing operation, malformed/extra field, thrown action, or receipt/hash drift returns no lifecycle receipt and advances no phase. B then returns its established lifecycle receipt with `actionOperationHash:null`, `actionReceiptHash` equal to the strict restart receipt hash, and the validated evidence refs; the D receipt's `restartOperationHash` remains the durable service-operation authority behind that hash. There is no public registration API, registry mutation, raw predicate factory, or arbitrary `GoldenLifecycleCheckpointPort` constructor.

`createGoldenExternalLifecycleCheckpointCapabilityV1()` is B's only capability ingress. It accepts the exact finite namespace `recovery-active-run`, a strict campaign hash/case ID, the full strict `GoldenFinalReleaseEpochV1`, and only one exact `GoldenRegisteredExternalLifecycleCheckpointV1` authenticated by B's registry WeakMap. B derives `checkpointImplementationId`, `checkpointImplementationHash`, and `predicateHash` from that registered controller and the reopened semantic source projection; the factory accepts none of those hashes/IDs, no module/path/export selector, no actions port, and no arbitrary callback. A structurally compatible port, a direct D action adapter, or an object returned by another factory cannot pass.

The factory recomputes `finalReleaseEpoch.epochHash`, requires `epochHash === finalReleaseEpoch.epochHash`, recursively freezes the path-free capability, and stores the exact registry entry plus checkpoint only in a private WeakMap keyed by that object. `capabilityHash` hashes every public member except itself, including the complete epoch object, redundant epoch hash, implementation ID/hash, and predicate hash. No public member, serializer, result, status output, or CLI can recover the port, closure, generation object, module path, command, service origin, or action implementation. `authenticateGoldenExternalLifecycleCheckpointCapabilityV1()` requires WeakMap identity, frozen bytes, a fresh registry/source authentication, exact object identity, and recomputed epoch/implementation/predicate/capability hashes. A structural clone, JSON round-trip, no-op/post-review predicate, changed campaign/case/namespace/epoch/action/status tuple, stale or alternate semantic build, another registry entry, or raw lifecycle port at the C/D boundary fails before stage or action. A cold-process remint may wrap a newly constructed object only when the same code-owned registry entry, semantic module/source digest, predicate, full epoch, campaign, and case all authenticate; it produces the same public `capabilityHash` but only the newly registered object authenticates in that process. Tests prove a lookalike function with identical source text, a remint after implementation-source substitution, and a remint with either epoch SHA or `epochHash` changed cannot substitute.

During prepared execution B additionally requires the active generation to satisfy the private checkpoint predicate and the loaded/reopened recovery context's campaign, case, and complete final-release epoch to equal the capability before dereferencing the hidden port. The exact generation and `externalCapabilityHash` are bound at `tryAction()`/`lifecycle-action-recorded`; external restart receipts require that non-null hash, while no-op and C's fixed post-review receipt require literal null. The capability never guesses a generation before the run exposes one. The registry contains descriptors and semantic identities only, so B has no static C/D import and does not require a future file to exist until that specific production implementation is requested.

`createUnavailableGoldenProductAssertionPort()` is deterministic and never inspects the product. It uses `adapterId:"unavailable"`, hashes `{ schema:"setfarm.internal-production-product-assertion-adapter.v1", adapterId:"unavailable" }` as `adapterHash`, hashes the complete `goldenCase.assertionContract` as `assertionContractHash`, and returns each required assertion ID exactly once with `verdict:"unavailable"` and no evidence refs. For `node-cli-task-register-v1`, the evidence-kind mapping is `cli-add-canonical-jsonl:cli`, `cli-list-canonical-jsonl:cli`, `cli-state-persists:state`, and `cli-title-required:cli`; the two API variants map their fixed tuple to `http,http,http,state`, the two Vite variants map their fixed tuple to `browser,browser,accessibility,state,console`, and `profile-owned-v1` uses deterministic unavailable evidence kind `test`. Construct and validate `assertionSetHash` through the Task 1 schema. This default makes live acceptance impossible until Subproject C injects the real adapter, while retaining a complete classified receipt.

`createGoldenAssertionBoundaryErrorSetV1()` uses the same exact required-ID/evidence-kind expansion but binds `adapterId:"assertion-boundary-error"` and hashes the finite boundary code into its code-owned adapter identity. Every verdict is `unavailable`, every evidence-ref list is empty, and the error object/message/stack are discarded rather than serialized. It is the only replacement accepted when a configured adapter throws, times out, rejects, or returns a schema-invalid set; partial adapter output is discarded in full. Therefore `assertions-collected` is always complete and deterministic, and runtime release remains a structurally valid successor even when evaluation fails.

- [ ] **Step 4: Implement read-only preflight**

```typescript
export async function preflightGoldenCaseV1(
  loaded: LoadedGoldenCampaignV1,
  caseId: string,
  releaseSha: string,
  ports: GoldenPreflightPorts,
): Promise<GoldenPreflightResultV1>;
```

Before entering preflight, strictly resolve `caseId` against the already authenticated loaded campaign and require exactly one case. Unknown, empty, malformed, or ambiguous selectors throw the finite argument error `GOLDEN_ARGUMENT_CASE_UNKNOWN`; they do not create a `GoldenPreflightResultV1`, run the fixed check list, derive case/hash/profile/repetition/ordinal fields, or call any port. Case selection has no preflight check ID or preflight failure code. With that exact case resolved, first call only A's imported `resolveHistoricalBaselinePostHandoffReceiptV1()` and accept only its exact returned `InternalProductionBaselinePostHandoffReceiptV1` after recomputing the canonical receipt hash from that interface projection. Require the literal `canonicalRef === "setfarm://internal-production/baseline/post-handoff"`; A's resolver remains the sole owner that opens the fixed receipt and tracked packet, parses the exact marker, and proves the recorded Setfarm-final-documentation and Mission Control commits are ancestors of current clean main. This is historical authority: B must not call `verifyCurrentBaselinePostHandoffReceiptV1()`, compare A's old build/service identities to currently loaded services, duplicate A's receipt schema/path/marker/ancestry observer, or accept a port/caller/CLI replacement. A missing, corrupt, wrong-ref/hash/marker, divergent, or nonancestor receipt emits `kind:"blocked-before-authority", authorityStage:"historical-baseline"` with every authority field null; it never substitutes the requested SHA, a zero hash, or current-service observation for A.

Only after A resolves, call Task 2's exact zero-argument `verifyCurrentGoldenLaunchOperationMigrationV1()`. It is a read-only immutable-terminal reopen plus fresh database/schema/current-source verification and is not supplied through `GoldenPreflightPorts`, CLI dependencies, argv, environment, or a caller object. Require `currentSourceSha` to equal the explicit `releaseSha`; require `applicationSourceSha` only as an ancestor; resolve the owner merge pair; require the dedicated module/ordered-statements/named-entry/digest/schema chain and nested A bootstrap migration pair to remain exact; and recompute the terminal ref/hash plus current verification hash. Copy its terminal ref/hash, application source SHA, current verification hash, and schema-projection hash into `GoldenPreflightReleaseAuthorityV1`; the release-authority hash covers them. Missing/partial/corrupt/stale authority, a pending operation, source drift, or fresh schema-verification failure emits `kind:"blocked-before-authority", authorityStage:"release"` with only `historicalBaseline` non-null. Preflight never prepares, resumes, applies, repairs, publishes, or advances migration state.

Regardless of A success, use only the read-only history and ownership members of `GoldenPreflightPorts` to derive the code-owned target repetition/launch-attempt ordinal and one real ownership observation; this is needed to return an honest blocked result and permits no allocation. An internal bounded history helper validates every strict result, derives the next ordinal from exact `(caseId,repetition,launchAttemptOrdinal)` subjects, and adopts the latest identical unresolved pre-run failure; it does not choose timeout replacements, epoch partitions, classifications, or policy counts. If A authenticated, run release and Setfarm/Mission Control health reads as well. Equality-join repository run ownership to phase-store preparation ownership by exact operation/intent hash, producing one strict `GoldenPlatformInspectionV1.activeGoldenOwnerships` entry per logical intent; preserve unmatched global ownership as `unattributedActiveOwnerCount`. For an existing-repository strategy, strictly validate only its public immutable template/campaign/workflow/hash/ref identity; do not call the attempt-provisioning port, template inspector, fixture resolver, workflow verifier, or GitHub. For V3 strategy, no template/fixture member exists. Emit the fixed ordered checks and stop authority derivation at the first unavailable prefix, returning the exact blocked-before-authority relation. After all four authorities exist, return either `blocked-after-authority` or `admitted`. Every branch includes only its real ownership observation and content-derived `preflightHash`. Do not call any phase mutator, attempt provisioner, verifier runtime, admission, browser factory, write-enabled store, or `mkdir` path; those types are absent from the port. The result-history adapter treats an absent fixed root as empty raw result and supersession arrays. Tests snapshot all candidate fixed roots before/after passing and every blocked preflight and require byte-for-byte absence/equality.

Derive the current preflight epoch with `createGoldenFinalReleaseEpochV1({ setfarmSha:releaseSha, missionControlSha:releaseInspection.missionControlSha })` only after both clean identities are verified, and require `releaseSha === finalReleaseEpoch.setfarmSha`. Then call `deriveGoldenCampaignExecutionCapacityV1({campaign:loaded.campaign,campaignHash:loaded.campaignHash,finalReleaseEpoch,results,timeoutReconciliations,platform})` exactly once. That function validates the campaign/hash/epoch/platform, authenticates every committed-pair authority, calls Task 1's `deriveEffectiveGoldenRunResultsV1(...)` exactly once, and retains the authenticated projection only in a private WeakMap controller for the returned frozen capacity object; it never reimplements timeout replacement, classification, cleanup, or epoch partitioning. Preflight uses that internal projection to count systemic roots once per strict mapping subject: every pre-run mapping contributes its one immutable configuration root, and every run mapping contributes only its selected effective run root, so a timeout original/replacement is never double-counted. When any exact root has count `3`, emit `GOLDEN_SYSTEMIC_CAUSE_REPEAT_LIMIT` and fail. A count of one or two is reported but does not itself bypass the required operator review boundary between invocations.

Capacity derivation is finite. Standard/matrix requires configured and eligible maximum `1` and admits fresh stage only when the complete platform/phase ownership census is observed and totals zero. Fleet requires configured maximum `2` but starts eligible at `1`. Read only `currentEpochEffectiveResults`, whose type is `readonly GoldenStartedRunResultV1[]`; never read `preRunResults` for capacity. Sort current-epoch effective terminal runs by run number, campaign case ordinal, repetition, and result hash; expose at most the first five hashes in that order. Fleet becomes eligible `2` only with five such runs, all five `terminal-settlement`, all cleanup exact through `isGoldenRunCleanupExactlySettledV1`, and every current-epoch effective run accepted with no systemic classification or unresolved timeout/nonaccepted review. Any drift lowers eligibility to `1`. For fleet fresh stage, require unrelated, prior-epoch, and unattributed ownership all observed zero, authenticate every remaining owner as the same campaign+epoch, and permit the reservation only when that exact count is below eligible capacity. A prepared continuation authenticates its already counted `GoldenLaunchCapacityReservationV1` and does not apply the fresh-slot comparison again. Settlement/finalization use neither exception and require the total observed census zero. Hash the exact public projection, and never accept a caller capacity, concurrency flag, generic semaphore, or locally repeated classification list.

Count accepted results for the selected case only from the projection's current-epoch effective results, then derive `min(requiredAcceptedResults, currentEpochAcceptedCount + 1)`. The value is exactly `1 | 2` and fits the existing V3 admission contract. A non-accepted attempt does not consume a slot; after a validated repair-review boundary the next attempt reuses the same target repetition under a fresh one-use admission and distinct run ID. Historical accepted results at another epoch never emit `GOLDEN_CASE_ALREADY_SATISFIED`; once current-epoch accepted count reaches the requirement, preflight does. Exact systemic-root counting remains cumulative across effective mappings from every validated epoch. The complete epoch, its hash, A's historical receipt hash, and repetition enter preflight/start/result/phase hashes and cannot be selected by CLI.

- [ ] **Step 5: Implement one-run execute and interruption-safe collect**

```typescript
export type GoldenBlockedPreflightResultV1 = Extract<GoldenPreflightResultV1, {
  kind: "blocked-before-authority" | "blocked-after-authority";
}>;

export type GoldenStageLaunchOutcomeV1 =
  | Readonly<{ kind: "prepared"; prepared: GoldenPreparedLaunchStateV1 }>
  | Readonly<{ kind: "pre_run"; result: GoldenPreRunResultV1 }>
  | Readonly<{ kind: "blocked"; preflight: GoldenBlockedPreflightResultV1 }>;

export type GoldenCaseExecutionOutcomeV1 =
  | Readonly<{ kind: "pre_run"; result: GoldenPreRunResultV1 }>
  | Readonly<{ kind: "run"; result: GoldenStartedRunResultV1 }>
  | Readonly<{ kind: "blocked"; preflight: GoldenBlockedPreflightResultV1 }>;

export type GoldenPreparedExecutionOutcomeV1 = Extract<
  GoldenCaseExecutionOutcomeV1,
  { kind: "pre_run" | "run" }
>;

export type GoldenPreparedExecutionPorts = Readonly<{
  existingRepositoryAttempts: GoldenExistingRepositoryAttemptProvisioningPortV1;
  admissions: GoldenAdmissionPort;
  preStartAuthorization: GoldenPreStartAuthorizationPort;
  fixtures: Pick<GoldenExistingRepositoryFixturePort,
    "resolve" | "inspectWorkflow" | "verifyWorkflow">;
  starter: GoldenRunStarter;
  launchLookup: Pick<GoldenRunLaunchLookupPort, "capturePreStartSet" | "resolve">;
  phases: Pick<GoldenCollectionPhaseStore,
    "readPreparedLaunches" | "recoverGoldenCanaryLaunchPreparationV1" |
    "bindExistingRepositoryAttempt" | "bindLaunchExecution" |
    "recordPreStartAuthorization" | "bindCanaryAdmission" |
    "recordStarterInvocationIssued" | "promoteLaunchToRunBound">;
  collection: GoldenCollectionPorts;
  lifecycleCheckpoint?: GoldenLifecycleCheckpointPort;
  externalLifecycleCheckpointCapability?: GoldenExternalLifecycleCheckpointCapabilityV1;
}>;

export async function stageGoldenCaseLaunchV1(
  loaded: LoadedGoldenCampaignV1,
  caseId: string,
  releaseSha: string,
  ports: Omit<GoldenHarnessPorts, "starter">,
): Promise<GoldenStageLaunchOutcomeV1>;

export async function executeGoldenCaseV1(
  loaded: LoadedGoldenCampaignV1,
  caseId: string,
  releaseSha: string,
  ports: GoldenHarnessPorts,
): Promise<GoldenCaseExecutionOutcomeV1>;

export async function executePreparedGoldenCaseV1(input: Readonly<{
  prepared: GoldenPreparedLaunchStateV1;
  loaded?: LoadedGoldenCampaignV1;
  ports: GoldenPreparedExecutionPorts;
}>): Promise<GoldenPreparedExecutionOutcomeV1>;

export async function recoverPreparedGoldenCaseV1(input: Readonly<{
  prepared: GoldenPreparedLaunchStateV1;
  loaded?: LoadedGoldenCampaignV1;
  ports: GoldenPreparedExecutionPorts;
}>): Promise<GoldenPreparedExecutionOutcomeV1>;

export async function collectGoldenCaseV1(
  loaded: LoadedGoldenCampaignV1,
  caseId: string,
  releaseSha: string,
  runId: string,
  ports: GoldenCollectionPorts,
): Promise<GoldenStartedRunResultV1>;
```

`stageGoldenCaseLaunchV1()` first performs the separate exact-case argument validation and then runs preflight. An admitted branch creates/reopens one authenticated recovery context, commits one capacity reservation through `prepareLaunch()`, continues through Step 6's successful `recordStarterInvocationIssued()` return, authenticates the complete `GoldenPreparedLaunchStateV1`, and returns `kind:"prepared"` with its context pair, non-null reservation, execution, authorization, strategy-matching admission-or-attempt, and `starterInvocationIssued`, with no run binding. A blocked branch with exact all-zero ownership calls `createGoldenPreRunResultV1(...)` and returns `kind:"pre_run"`; a nonzero/unavailable ownership branch returns `kind:"blocked"` and no result. Neither blocked branch creates a recovery context, intent, reservation, admission, attempt, outbox, or run. Stage never calls a starter, launch lookup that could adopt a run, poller, collector, result store, lifecycle action, assertion, or report.

`executeGoldenCaseV1()` is a convenience composition only: it calls `stageGoldenCaseLaunchV1()` once, maps its `pre_run` and `blocked` members byte-for-byte into the exact outer `GoldenCaseExecutionOutcomeV1`, and passes only `prepared`, the already authenticated `loaded`, and narrow prepared ports to `executePreparedGoldenCaseV1({prepared,loaded,ports:narrowPreparedPorts})`. It exhaustively returns the prepared continuation's `pre_run` or `run` branch unchanged; it never returns bare `GoldenRunResultV1` or a bare before/after-authority preflight. The only public execution outcome discriminants are exactly `pre_run | run | blocked`; the nested `preflight.kind` retains `blocked-before-authority | blocked-after-authority`.

`executePreparedGoldenCaseV1({prepared,loaded?,ports})` authenticates the exact frozen complete prepared-state identity and every context/reservation/intent/envelope/execution/authorization/admission-or-attempt/issued hash before continuing the already reserved launch. It always reopens `prepared.recoveryContextRef/recoveryContextHash` through the fixed resolver and requires byte-identical equality with the prepared capability. When `loaded` is supplied, it authenticates that loader-owned object and requires complete campaign/case/hash/task/prompt/admission equality with the reopened context; when omitted, it uses only the reopened context's authenticated `loadedCampaignAuthority`. It never fabricates or reloads campaign/task/prior-result context from the current campaign file, caller case ID, result store, current services, or intent fragments. It never calls the case resolver, A baseline resolver, preflight, history/capacity derivation, active-owner fresh-slot check, or `prepareLaunch`. Because initial execution requires every pre-start transition non-null and authenticated, it calls no attempt provisioner, admission creator, or pre-start authorizer; it may invoke only the exact already-issued starter operation, bind/adopt its unique run, execute the lifecycle checkpoint, and use `ports.collection` for the normal evidence path. Full current fleet capacity does not block this continuation because its reservation is already present and equality-bound.

`recoverPreparedGoldenCaseV1({prepared,loaded?,ports})` has the same signature and reopens/authenticates the same context/prepared/reservation chain under the exact supplied-or-reopened relation above. It is the idempotent lookup-only recovery entry: the persisted intent, context, and reservation select one chain, never a fresh case/preflight/capacity search. If interruption occurred before issue, it may finish only that intent's first absent provision/binding/authorization/admission/outbox transition through the narrow ports, deriving the task, prompt/admission hashes, case/profile, release, attempt ordinal, and prior-result authorization input exclusively from the context; every call is equality-bound and idempotent. Once issued, lookup is keyed only by `starterOperationHash`; it adopts or resumes only that existing outbox operation and then resumes persisted collection phases. It cannot allocate or bind a new context, reservation, intent, attempt identity, admission identity, authorization scope, outbox, or operation. Zero candidates before the already issued operation is safely resumable remain tied to that operation; one exact committed row is adopted; multiple/conflicting rows fail closed. Both prepared functions share one private continuation implementation, return only the outer `GoldenPreparedExecutionOutcomeV1`, and never rerun fresh-slot preflight/capacity when C presents a previously staged content-addressed inflight receipt.

`GoldenPreparedExecutionPorts` permits at most one checkpoint source. The fixed internal `lifecycleCheckpoint` member remains available only to B's no-op and C's code-owned post-review composition. An `externalLifecycleCheckpointCapability` must authenticate through B, match the reopened context's exact campaign/case/full final-release epoch and namespace `recovery-active-run`, and privately resolve to the registry-authenticated implementation only inside the B continuation; supplying both members, supplying the external capability to ordinary matrix/E composition, passing a structural clone, a different semantic implementation/predicate/epoch, or a raw external checkpoint fails before starter lookup/action. The lifecycle receipt and phase bind the capability hash in addition to predicate/generation/action identities, so a fresh-process retry can remint an equal capability around the same code-owned semantic implementation and byte-identical epoch but cannot substitute another action or build.

`createGoldenPreRunResultV1({loaded,preflight,results})` authenticates the exact loaded campaign, strict blocked preflight, bounded strict history, code-owned target repetition/ordinal, primary blocker precedence, and exact `ownershipObservation.observedZero:true`. It reopens the last identical unresolved pre-run result for response-loss idempotency; otherwise it requires the ordinal to be exactly one greater than the highest closed/result subject for that case/repetition. It projects the all-zero ownership receipt, invokes Task 1's branch constructor, and returns one frozen result. It accepts no clock, timestamp, result/stable/root hash, run/start/lifecycle/workflow evidence, cleanup body, or caller ordinal. If ownership is not exactly observed zero, it returns no result and the caller preserves the blocked preflight outcome.

Fresh stage flow:

1. Resolve the selected case as an argument before preflight. Run preflight only for that case. On a block, return the exact outer `{kind:"pre_run",result}` or `{kind:"blocked",preflight}` outcome above without starting; never pass a missing authority into launch preparation or synthesize a run-shaped configuration result.
2. Reinspect release, raw history/supersessions, repository ownership, and active preparation ownership immediately before strategy dispatch. Require the release pair to equal preflight's complete `finalReleaseEpoch`, rederive the exact capacity, and require the capacity hash to equal preflight unless only `activeSameCampaignCount` advanced by a concurrently committed same-campaign/same-epoch reservation still below the same eligible maximum. An unrelated/prior-epoch/unattributed owner, capacity downgrade, equal-at-capacity count, or third fleet contender blocks before another context or intent. Create/reopen `GoldenPreparedRecoveryContextV1` from that exact authenticated loaded campaign, case, admitted preflight, and the already read strict result history. Then read prepared launch intents for the exact context/case/repetition/release/epoch/A-historical-receipt hash. If exactly one unresolved intent exists, require its context pair and every duplicated identity to match, and recover its complete persisted intent/attempt/execution/authorization/admission/issued chain without consuming a new capacity slot. Continue only from the first absent transition. If `starterInvocationIssued` exists, call neither attempt nor admission again: query the exact operation hash, adopt one exact committed row, or idempotently resume only the same authenticated outbox when no row exists. Multiple contexts/intents, multiple/conflicting operation rows, or a gap/conflict in the durable chain fails closed.
3. Prepare strategy identities without starting. For `v3-feature-dev-canary`, create one random 32-byte base64url selector in memory and compute the exact one-slot admission request projection with context repetition, `suiteHash = context.campaignHash`, exact context case hash, `taskHash = context.admissionTaskHash`, and TTL from the context-selected case's timeout plus `3_600_000` capped by nine days, but do not call `createCanary`. For `canonical-existing-repository-workflow`, strictly parse only the context-selected immutable template identity/workflow kind; do not compute or accept an attempt ordinal/key and do not create, clone, push, inspect, or authenticate an attempt repository yet. A context/template identity failure starts no run.
4. Call `phases.prepareLaunch()` with that authenticated `recoveryContext` and strict `executionCapacity` before any attempt, full-task computation, pre-start query, authorization, admission, or start. Its active-ownership CAS is the atomic capacity commit: it reopens current ownership under the global golden-only lock, permits only same campaign+epoch below eligible maximum, and fsyncs the path-free context-bound logical intent plus active index successor together. It includes the complete context/preflight `finalReleaseEpoch`, equal release/hash relations, A historical receipt hash, and recovery-context pair, plus the V3 selector envelope or, for existing-repository, the next code-owned ordinal/key derived from the authenticated template and closed prior-intent state. Only then may C provision from the exact `persistedIntent`; B validates and fsyncs the returned path-free attempt receipt, requiring its complete epoch to equal the persisted intent rather than a current release lookup. Repeated provision for the same reminted persisted intent must reopen only that attempt. Resolve the fresh fixture through B's strict contained resolver, but perform no verification command yet. V3 needs no provision/fixture and already has its exact task bytes only through the context.
5. Construct the exact task bytes now: `recoveryContext.task` for V3, or `${recoveryContext.task} --repo ${fixture.repositoryPath} --branch main` for existing-repository. Compute `fullLaunchTaskHash`, call `launchLookup.capturePreStartSet({ intent, goldenCase:contextSelectedCase, releaseSha:recoveryContext.releaseSha, fullLaunchTaskHash, fixtureAttempt })`, and immediately call `phases.bindLaunchExecution()` with that exact context/task/set. The phase store recomputes the set hash and fsyncs one context-bound `GoldenLaunchExecutionBindingV1`; a crash recaptures/reuses only canonically identical bytes, and a different context/path/task/set fails. Call the authenticated pre-start authorizer only with context-derived campaign/case/profile/repetition/epoch/prior results plus intent and `executionBindingHash` in `caseContextHash`, validate its context-bound receipt, and fsync it. For existing-repository, only now authenticate the workflow capability and run the baseline pre-verifier, which requires immutable local/remote baseline. For V3, create/reuse and fsync the one canary admission after authorization. Both strategies now have exactly one admission-or-attempt authority.
6. Construct the exact internal start request only from the authenticated context plus stored strategy authority, then call `phases.recordStarterInvocationIssued({ intent, capacityReservation, executionBinding, authorization, admissionBinding, fixtureAttempt, fixturePreVerification, startRequest })`, using null preverification only for V3. It derives the context-bound operation/request hashes and claim secret with the reservation hash included, writes/fsyncs the authenticated launch outbox, then records immutable `issued:true`. Assemble and authenticate `GoldenPreparedLaunchStateV1` with the recovery context/pair, issued receipt, and capacity reservation returned by the one `prepareLaunch()` CAS, then return `kind:"prepared"`. Fresh stage stops here: it does not call `starter.start`, launch lookup, promotion, polling, lifecycle, or collection.

Prepared continuation flow shared by `executePreparedGoldenCaseV1` and `recoverPreparedGoldenCaseV1`:

1. Reopen/authenticate the prepared recovery context and its existing capacity reservation. If a live `loaded` object was supplied, equality-check it as described above; otherwise retain the reopened context authority. Do not inspect current available capacity or invoke any fresh-stage/campaign-loader operation. Initial execution may call `starter.start({issued:starterInvocationIssued})` for the exact context-bound issued outbox; recovery first resolves that exact operation and may only idempotently resume the same issued outbox when its durable operation state proves no different run/action can exist. After the operation returns or is adopted, call `launchLookup.resolve({ intent, executionBinding, starterInvocationIssued, authorization, admissionBinding, fixtureAttempt, invocationReceipt })`, require one matching imported Task 1 start receipt with the exact context pair, and promote. One exact row is adopted, an exactly issued unresolved operation remains resumable, and multiple/conflicting bindings fail; no timestamp/log/task-similarity inference or replacement operation is allowed.
2. Bind actual workflow, protocol, and protocol version from the start receipt and a fresh authoritative run read. Require V3 only for the V3 strategy; preserve any valid actual protocol for the existing-repository strategy.
3. Poll `readRun()` until terminal, deadline, or strategy/workflow/protocol/compiler identity drift. On each nonterminal poll with a non-null `activeGeneration`, call the configured fixed checkpoint or privately dereferenced B-authenticated external capability only while `lifecycle-action-recorded` is absent. Validate the returned receipt's exact operation null relation/hash, generation, and null-or-equal `externalCapabilityHash`, and append that phase before the next poll/observation. If the action or remote adoption occurred but append was interrupted, C/D `tryAction()` must reopen the identical durable operation/receipt and B appends it without blindly replaying the external action. A terminal poll then appends `terminal-observed`; a still-active deadline appends `timeout-observed`.
4. Wait for the matched checkpoint action to return before calling the same phase-driven collector used by `collectGoldenCaseV1`. Checkpoint absence, no-op, timeout, or typed failure never starts or resumes another run. Return the exact outer `{kind:"run",result}`; any already persisted exact pre-run closure is returned only as `{kind:"pre_run",result}` under `GoldenPreparedExecutionOutcomeV1`, never as a bare result.

Collection flow:

1. Read and validate the complete phase journal before any side effect. If `run-bound` is absent, require exactly one unresolved envelope with the complete path-free intent, post-provision execution binding, authorization, strategy-matching admission-or-attempt, and `starterInvocationIssued.issued:true`. Call only `launchLookup.resolve({ intent, executionBinding, starterInvocationIssued, authorization, admissionBinding, fixtureAttempt })`, require one receipt for the CLI `runId`, and promote it. An envelope without issued authority proves no run exists; collection returns a finite typed collection error and no `GoldenRunResultV1`, and never calls a starter. Zero/multiple intents/rows or any binding mismatch remain unresolved without log/time/task inference. `collectGoldenCaseV1` can return only `GoldenStartedRunResultV1`; it never converts a missing run into `pre_run` because collection is already keyed by an asserted run ID.
2. Validate the existing run belongs to the selected strategy. V3 requires feature-dev, actual V3, compiler SHA, release-admission slot binding, task hash, and run number. Existing-repository requires bug-fix/security-audit, the selected workflow, the one bound fresh `GoldenExistingRepositoryFixtureAttemptV1`, its authenticated resolved path in internal run context, exact template/baseline/remote identity, and `runs.task` byte equality with `${goldenCase.task} --repo ${fixture.repositoryPath} --branch main`; it accepts and records the actual protocol/version without relabeling. The public prompt hash still binds only `goldenCase.task`, while the private launch-task hash binds those exact internal bytes and the attempt hash. No attempt from another intent, repetition, or epoch can be recovered.
3. If neither terminal nor timeout observation exists, wait within the remaining deadline. `GoldenCollectionPorts` contains no lifecycle port. Collection preserves/revalidates an existing `lifecycle-action-recorded` phase when present, then appends the terminal/timeout observation; if the selected case contract requires an action but the execute path never durably recorded one, later acceptance fails rather than collection synthesizing or replaying it.
4. If `timeout-observed` exists, take no terminal-collection step. Perform only bounded Task 2 DB/operational-snapshot reads, `projects.inspectProject()`, and `cleanup.inspect()` against the exact currently known identities. Preserve active counts and null/unavailable observations, append `timeout-evidence-collected`, construct the discriminated nonterminal-timeout result, and append `classified`. Do not call project sync, GitHub inspection, projection/render/browser, assertion subject assembly, product assertions, fixture post-verification, verifier runtime, deploy/transfer collection, or lifecycle checkpoint. Internally valid timeout evidence classifies `infrastructure_failure/GOLDEN_RUN_TIMEOUT_NONTERMINAL`; a canonical authority/census violation uses its finite `setfarm_core_failure` reason. Return without claiming terminal settlement or cleanup success.
5. On the terminal branch, collect canonical DB/artifact/GitHub/project/fresh-attempt authority and remint the workflow capability from its unchanged immutable baseline manifest. Do not require the manifest's baseline `remoteMainSha` to equal the now-advanced remote. For both bug-fix and security-audit, only C's authenticated Setfarm integration evidence may prove current `reviewedHeadSha === acceptedSha === remoteMainSha` with equal trees for the exact attempt; stale/unreviewed/wrong-head or baseline-still-current remote fails. Then sync projections/render and persist exact hashes.
6. For `runtime.kind === "sealed-verifier-contract"`, call `reconcileLogicalLease()` before every registry/phase action. `none` permits acquire only when no lease phase exists; `launching` permits recovery then mandatory reconciliation; `live` supplies the exact current generation/restart chain, causes any missing lease phase to be appended, then permits rejoin; `released` causes missing exact lease/release phases to be appended without process action; `ambiguous` or phase conflict blocks. Reconcile again after acquire, durability restart, and release. This repairs crashes between registry persistence and phase append, including generation two, without double spawn/restart/stop. Reuse persisted assertions; otherwise evaluate once with deterministic unavailable conversion on boundary errors. In `finally`, release only the reconciled current generation and persist/reconcile its exact receipt before post-release/classification.
7. For `runtime.kind === "not_applicable"`, require the CLI invocation authority, assemble a subject with `verifierRuntime:null`, and evaluate only when `assertions-collected` is absent. Convert the same adapter boundary errors to the deterministic complete unavailable set and persist it; never call the verifier-runtime port.
8. After exact valid release, or directly after CLI assertions, re-read canonical DB/artifact/project/projection evidence, inspect host cleanup, require every canonical identity that should be immutable to match the `canonical-collected` phase, and append `post-release-collected`. HTTP/browser cleanup is observed only here, after assertion completion and lease release. Any open verifier process/listener, unavailable cleanup field, release drift, or changed accepted source fails closed.
9. Reinspect release identity, classify only from the post-release collection plus the persisted assertion set/release evidence, construct the hashed result, append `classified`, and require its result hash to match before returning. A resumed `classified` phase returns only after reconstructing and validating the same result hash.

Keep the selector token only in the atomic private mode-`0600` preparation envelope and B's authenticated in-memory preparation controller, clear the initial local buffer after `prepareLaunch()` returns, and delete the stored secret only after `run-bound` promotion has durably retained the nonsecret admission binding. Never create a token for existing-repository strategy or put one in an exception, public receipt, phase payload, report, history index, test snapshot, or console output.

`reconcileTimedOutGoldenRunV1()` first validates and reopens the original started-run result by hash and requires the exact scalar comparison `originalTimeoutResult.observationDisposition === "nonterminal-timeout"`; `observationDisposition` has no nested `.kind`. It reads only that result's exact persisted run identity and fails without writing when the run is still nonterminal or any strategy/release/case identity drifts. Once terminal, it uses a separate hash-chained reconciliation journal and the same terminal collection steps, including assertions, verifier runtime/release when required, post-release reobservation, and exact cleanup. It creates a new terminal result for the same run and byte-identically retains the original's complete `GoldenStartedRunStartV1`, requires `isGoldenRunCleanupExactlySettledV1(terminalResult)`, then creates one `GoldenTimeoutTerminalSupersessionV1` binding both hashes and the reconciliation evidence hash. It returns the terminal result plus supersession to the caller but does not publish either through the generic result/supersession stores; only `GoldenRunResultStore.putTimeoutReconciliationPair()` may commit them. It never modifies the original phase journal/result or calls an admission, starter, pre-start authorizer, lifecycle checkpoint, or run mutation.

- [ ] **Step 6: Add timeout and partial-evidence regressions**

Assert a timed-out still-active run with a known run ID receives only bounded DB, operational snapshot, project, and cleanup observations. Assert it receives zero GitHub, project-sync, render/browser, product-assertion, verifier-runtime, fixture-post-verification, deploy/transfer, or checkpoint calls; active/null cleanup values remain explicit and `isGoldenRunCleanupExactlySettledV1()` returns false. Assert missing evidence cannot pass and the only eligible classifications are the typed infrastructure timeout or a higher-precedence finite platform-authority failure. Assert `collectGoldenCaseV1` rejects a run from another case/admission/release/fixture instead of attaching it to the requested result. Assert collection cannot call a Setfarm start/admission/provision/authorization/lifecycle mutation because none is present in `GoldenCollectionPorts`; source and type-identity tests reject a cast/spread from `GoldenHarnessPorts`. Add one exact Node CLI assertion set: success stdout is canonical JSONL, success stderr is empty, success exit is `0`, invalid-title stdout is empty, invalid-title stderr is `TITLE_REQUIRED\n`, invalid-title exit is `2`, and durable state is observed by a later list invocation.

- [ ] **Step 7: Run focused and adjacent tests**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-harness.test.ts
npm run test:evals
npm run test:execution-attempts
npm run test:evidence
npx tsc -p tsconfig.json --noEmit
git diff --check
```

Expected: all commands exit `0`; fake port counters prove a maximum of one start, admission count one for V3 and zero for existing-repository, exactly one assertion-port call before uninterrupted classification, and zero replay calls when the authenticated assertion-set phase already exists.

- [ ] **Step 8: Record the Task 5 Setfarm handoff checkpoint**

Run `git status --short` and `git diff --check`, verify the exact Task 5 scope, and return the file list plus focused/adjacent evidence to the active Setfarm claim. Do not stage or commit.

---

### Task 6: Persist immutable receipts, privately finalize, and narrowly materialize the campaign packet

**Files:**
- Create: `src/internal-production/golden-run-store.ts`
- Create: `src/internal-production/golden-run-report.ts`
- Create: `src/internal-production/golden-docs-claim-owner-terminal-disposal.ts`
- Create: `tests/internal-production/golden-run-store.test.ts`
- Create: `tests/internal-production/golden-run-report.test.ts`
- Create: `tests/internal-production/golden-docs-claim-owner-terminal-disposal.test.ts`

**Interfaces:**
- Consumes: Task 1 validated campaign/result contracts, canonical JSON helpers, and the exact `GoldenEffectiveRunResultProjectionV1`/`deriveEffectiveGoldenRunResultsV1(input)` exports; Task 3's exact authenticated source/build authority, `GoldenFinalizationSourceBuildV1`, `buildCanonicalInternalProductionSourcesV1()`, and deterministic manifest APIs. `golden-run-report.ts` re-exports Task 1's effective projection symbols by identity for downstream C/E compatibility and defines no local mapper.
- Produces: `GoldenRunResultStore`, `createGoldenRunResultStore()`, exact `GoldenTimeoutReconciliationPairV1Schema`/`GoldenTimeoutReconciliationPairV1`, `GoldenCommittedTimeoutReconciliationPairIndexV1Schema`/type, bounded list/locator/resolver APIs that mint Task 1's nominal `GoldenCommittedTimeoutReconciliationPairAuthorityV1`, exact `GoldenIndexCasOperationV1`/`GoldenIndexVersionV1`/`GoldenIndexCasReceiptV1` schemas and inferred types, `GoldenFinalizationSourceCleanlinessV1`, `GoldenFinalizedCampaignReportV1`, `evaluateGoldenCampaignSettlementV1(input)`, `renderGoldenCampaignReportV1(input)`, `writePrivateGoldenCampaignPreviewV1(input)`, `finalizeGoldenCampaignReportV1(input)`, exact reminting `resolveGoldenFinalizedCampaignReportV1(finalizationHash)`, `materializeFinalizedGoldenCampaignReportV1(finalizationHash)`, the in-process `GoldenDocsMaterializationSessionV1` composition boundary, exact owner-scoped `commitNextGoldenDocsMaterializationEntryV1(input)`, live `abandonGoldenDocsMaterializationSessionV1(session)`, claim-owner-only `completeGoldenDocsClaimOwnerTerminalDisposalV1(input)` returning exact `GoldenDocsClaimOwnerTerminalDisposalResultV1`, strict `GoldenDocsLeaseRetirementReceiptV1` and resolver, append-only `GoldenDocsLeaseLifecycleEventV1`/head registry, `GoldenDocsMaterializationLeaseCensusV1` and observer, `GoldenDocsMaterializationEntryCommitReceiptV1`, and the strict content-addressed `GoldenDocsMaterializationCompletionReceiptV1` plus its fixed resolver used by Subproject E's final six-file writer. The disposed capability, retirement mutator, and owner hook operation are confined to `golden-docs-claim-owner-terminal-disposal.ts`; E imports none of them and receives only the returned receipt ref/hash.
- Fixed roots: `resolveInternalProductionChildV1(["golden-results"])` for private JSON, previews, canonical finalized Markdown bytes, and finalization receipts shared across Setfarm worktrees; `docs/review-packets` only for verified materialization in an active Setfarm docs claim. No public factory accepts a root or tracked path.

- [ ] **Step 1: Write failing content-addressed store tests**

Use `mkdtemp` only through an internal test-only factory that is not exported from production. Assert:

- result bytes are canonical and stored at the template path ``sha256/${resultHash.slice(0, 2)}/${resultHash}.json``;
- the store parses the exact result discriminant before publication and indexing. A pre-run record is indexed by its stable subject/launch-attempt ordinal and may contain no run/start/epoch placeholder; a started-run record is indexed by its exact run subject and ordinal. Equal bytes are idempotent. One nonterminal-timeout original is a legal single subject state marked reconciliation-required; every other different result claiming the same pre-run or run subject/ordinal is a fork unless the terminal replacement enters through the exact compound timeout-reconciliation operation below;
- construction plus `listCampaign()`/`get()` against an absent fixed root creates no root and returns an empty list or typed not-found error; only `put()`, private-preview write, or private finalization may lazily create required validated data-root directories;
- directories are `0700`, files are `0600`, and every result, timeout-supersession, and immutable index-version publication uses an unpredictable same-directory temporary, file fsync, atomic link-with-no-replace, parent fsync, exact inode/content proof, owned-temporary cleanup plus another parent fsync, and a final `O_NOFOLLOW` regular one-link reopen; equal content is idempotent;
- a symlinked root, bucket, result, or campaign index is rejected;
- an existing file with different bytes is `GOLDEN_RESULT_HASH_COLLISION`;
- reads use `O_NOFOLLOW`, validate schema/hash, and reject empty or larger-than-`4 MiB` files;
- each append-only campaign index version contains only campaign hash, its expected predecessor index hash, and ordered unique result hashes, never result bodies; its timeout-supersession counterpart follows the same rule, while the third committed-pair index binds the expected predecessor plus exact supersession/pair/result/supersession-index locator projection;
- timeout reconciliation is one content-addressed compound publication, requires both named results to be `kind:"run"` with equal run subject/launch-attempt ordinal and byte-identical complete start authority, allows at most one terminal/supersession pair per original, rejects every pre-run hash and every generic same-subject terminal `put()` before a write, and never rewrites either result or an existing index entry. A content-addressed pair receipt is necessary but insufficient: only the final campaign+supersession-keyed committed locator/index makes the pair visible and allows minting `GoldenCommittedTimeoutReconciliationPairAuthorityV1`;
- concurrent index writers serialize through a recoverable expected-predecessor CAS operation/lock; a fresh process can prove lock ownership and either finish the exact pending version, adopt an already-published version, or fail on a fork, but can never delete an unknown lock or lose an accepted record;
- the index derivation test snapshots the exact three schemas and order: `operationIdHash` covers only schema/token/campaign/index-name/predecessor/record, `indexHash` then covers the index payload containing that operation ID, and the separate `GoldenIndexCasReceiptV1.receiptHash` finally covers operation ID/index hash/campaign/index-name/predecessor/record. Mutating any projection fails, and static tests forbid `indexHash|receiptHash` in the operation-ID projection, `receiptHash` in the index projection, or any self-hash field in its own projection;
- crash injection before and after temporary creation/write/fsync, no-replace link, both parent fsyncs, inode proof, temporary cleanup, final reopen, CAS-lock fsync, operation publication, separate receipt publication, immutable index-version publication, compound timeout-operation publication, terminal/supersession physical publication, each private index successor, pair receipt publication, committed-pair index successor, per-supersession locator publication/reopen, authority mint, response, and lock cleanup always recovers one record or one exact legal pair and unique index successors without overwrite, duplication, prematurely visible replacement, stranded visible state, or a fork;
- fresh-read tests prove `listCommittedTimeoutReconciliationPairAuthorities(campaignHash)` follows only the bounded authenticated campaign chain, `locateCommittedTimeoutReconciliationPairAuthority({campaignHash,supersessionHash})` opens only the exact fixed key, and `resolveCommittedTimeoutReconciliationPair({authority})` reopens every named member. No method scans, returns a bare supersession, trusts a structural pair/authority, or exposes terminal/supersession before final locator visibility;
- a campaign cannot exceed `64` results and cannot index a result from another campaign;
- putting a result, writing a preview, and privately finalizing change only the global private data root and leave `git status --porcelain -- docs/review-packets` empty.

- [ ] **Step 2: Run the store test and confirm failure**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-store.test.ts
```

Expected: FAIL because `createGoldenRunResultStore` is absent.

- [ ] **Step 3: Implement the fixed-root store and atomic index**

```typescript
export interface GoldenRunResultStore extends GoldenResultHistoryPort {
  put(result: GoldenRunResultV1): Promise<Readonly<{
    hash: string;
    ref: string;
    created: boolean;
  }>>;
  get(resultHash: string): Promise<GoldenRunResultV1>;
  putTimeoutReconciliationPair(input: Readonly<{
    originalTimeoutResultHash: string;
    terminalResult: GoldenStartedRunResultV1;
    supersession: GoldenTimeoutTerminalSupersessionV1;
  }>): Promise<Readonly<{
    pair: GoldenTimeoutReconciliationPairV1;
    authority: GoldenCommittedTimeoutReconciliationPairAuthorityV1;
    ref: CanonicalRef;
    created: boolean;
  }>>;
  listCommittedTimeoutReconciliationPairAuthorities(
    campaignHash: string,
  ): Promise<readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[]>;
  locateCommittedTimeoutReconciliationPairAuthority(input: Readonly<{
    campaignHash: string;
    supersessionHash: string;
  }>): Promise<GoldenCommittedTimeoutReconciliationPairAuthorityV1>;
  resolveCommittedTimeoutReconciliationPair(input: Readonly<{
    authority: GoldenCommittedTimeoutReconciliationPairAuthorityV1;
  }>): Promise<Readonly<{
    authority: GoldenCommittedTimeoutReconciliationPairAuthorityV1;
    pair: GoldenTimeoutReconciliationPairV1;
    terminalResult: GoldenStartedRunResultV1;
    supersession: GoldenTimeoutTerminalSupersessionV1;
  }>>;
}

export function createGoldenRunResultStore(): GoldenRunResultStore;

export const GoldenTimeoutReconciliationPairV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-golden-timeout-reconciliation-pair.v1"),
  campaignHash: Sha256Schema,
  caseId: SlugSchema,
  repetition: z.union([z.literal(1), z.literal(2)]),
  launchAttemptOrdinal: z.number().int().min(1).max(64),
  runId: z.string().min(1).max(160),
  runNumber: z.number().int().positive(),
  releaseEpochHash: Sha256Schema,
  originalTimeoutResultHash: Sha256Schema,
  terminalResultHash: Sha256Schema,
  supersessionHash: Sha256Schema,
  expectedResultIndexPredecessorHash: Sha256Schema.nullable(),
  expectedSupersessionIndexPredecessorHash: Sha256Schema.nullable(),
  pairRef: CanonicalRefSchema,
  pairHash: Sha256Schema,
}).strict();

export type GoldenTimeoutReconciliationPairV1 = z.infer<
  typeof GoldenTimeoutReconciliationPairV1Schema
>;

export const GoldenCommittedTimeoutReconciliationPairIndexV1Schema = z.object({
  schema: z.literal(
    "setfarm.internal-production-committed-timeout-reconciliation-pair-index.v1",
  ),
  campaignHash: Sha256Schema,
  expectedPredecessorHash: Sha256Schema.nullable(),
  supersessionHash: Sha256Schema,
  originalTimeoutResultHash: Sha256Schema,
  terminalResultHash: Sha256Schema,
  pairRef: CanonicalRefSchema,
  pairHash: Sha256Schema,
  resultIndexHash: Sha256Schema,
  supersessionIndexHash: Sha256Schema,
  orderedSupersessionHashes: z.array(Sha256Schema).min(1).max(64),
  indexHash: Sha256Schema,
}).strict();

export type GoldenCommittedTimeoutReconciliationPairIndexV1 = z.infer<
  typeof GoldenCommittedTimeoutReconciliationPairIndexV1Schema
>;

export const GoldenIndexNameV1Schema = z.enum([
  "golden-run-results",
  "golden-timeout-supersessions",
  "golden-committed-timeout-reconciliations",
]);

export const GoldenIndexCasOperationV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-golden-index-cas-operation.v1"),
  tokenHash: Sha256Schema,
  campaignHash: Sha256Schema,
  indexName: GoldenIndexNameV1Schema,
  expectedPredecessorHash: Sha256Schema.nullable(),
  recordHash: Sha256Schema,
  operationIdHash: Sha256Schema,
}).strict();

export const GoldenIndexVersionV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-golden-index-version.v1"),
  campaignHash: Sha256Schema,
  indexName: GoldenIndexNameV1Schema,
  expectedPredecessorHash: Sha256Schema.nullable(),
  operationIdHash: Sha256Schema,
  orderedRecordHashes: z.array(Sha256Schema).min(1).max(64),
  recordHash: Sha256Schema,
  indexHash: Sha256Schema,
}).strict();

export const GoldenIndexCasReceiptV1Schema = z.object({
  schema: z.literal("setfarm.internal-production-golden-index-cas-receipt.v1"),
  operationIdHash: Sha256Schema,
  indexHash: Sha256Schema,
  campaignHash: Sha256Schema,
  indexName: GoldenIndexNameV1Schema,
  expectedPredecessorHash: Sha256Schema.nullable(),
  recordHash: Sha256Schema,
  receiptHash: Sha256Schema,
}).strict();

export type GoldenIndexCasOperationV1 = z.infer<
  typeof GoldenIndexCasOperationV1Schema
>;
export type GoldenIndexVersionV1 = z.infer<typeof GoldenIndexVersionV1Schema>;
export type GoldenIndexCasReceiptV1 = z.infer<
  typeof GoldenIndexCasReceiptV1Schema
>;
```

The three `.superRefine` implementations recompute only their explicitly stated projections below: the operation omits `operationIdHash`, the index omits `indexHash`, and the receipt omits `receiptHash`. They enforce the exact schema literal, `indexName`, campaign, predecessor, record, and cross-object equality before any file or lock action.

Resolve the production root only through `resolveInternalProductionChildV1(["golden-results"])`, which is independent of the current package worktree and accepts no `cwd`, CLI, environment, or caller override. The factory performs path derivation only. Read methods validate/lstat the expected real contained ancestors; an absent ancestor is an empty history/typed missing result and must not call `mkdir`. Only `put()` or `putTimeoutReconciliationPair()` invokes the resolver's mutating child helper to create/revalidate each mode-`0700` descendant. Store results at ``sha256/${resultHash.slice(0, 2)}/${resultHash}.json``, supersessions at ``timeout-supersessions/sha256/${supersessionHash.slice(0, 2)}/${supersessionHash}.json``, and committed reconciliation pairs at ``timeout-reconciliations/sha256/${pairHash.slice(0, 2)}/${pairHash}.json``. Before opening a record temporary, publish/fsync through the identical no-replace protocol one immutable private publication operation binding record kind/hash/final path, canonical byte hash/length, and the unpredictable same-directory ``.${recordHash}.${randomBytes(32).toString("hex")}.tmp`` basename. Open that operation-bound temporary exclusive/no-follow mode `0600`, write bounded bytes, fsync, atomically `link(temp, final)` without replacement, fsync the parent, prove both names are the same regular inode and exact canonical content, unlink only that owned temporary, fsync the parent again, and reopen the final with `O_NOFOLLOW` to require one link, mode `0600`, strict schema, and the exact content hash. An existing final is adopted only after that complete reopen. A crash-left exact two-link publication is cleaned only after the inode/content proof. When final is absent, exactly one operation-authenticated temporary may be completed or, if it is a strict prefix of the intended bytes, removed and recreated by its owner; zero permits a new operation and multiple, unknown, non-prefix, or mismatched candidates fail closed.

Campaign and supersession indexes are append-only immutable `GoldenIndexVersionV1` records, not replaceable fixed files. Store them respectively at ``campaigns/${campaignHash}/sha256/${indexHash}.json`` and ``timeout-supersessions/campaigns/${campaignHash}/sha256/${indexHash}.json`` through the identical temporary/fsync/link-no-replace/parent-fsync/no-follow-reopen protocol. Derivation is deliberately acyclic and occurs in this exact order. First generate a private random token, hash it as `tokenHash`, and compute `operationIdHash = hashCanonicalJson({ schema:"setfarm.internal-production-golden-index-cas-operation.v1", tokenHash, campaignHash, indexName, expectedPredecessorHash, recordHash })`; neither `indexHash` nor any receipt field is an input. Strictly parse the resulting `GoldenIndexCasOperationV1`. Second construct the index payload `{ schema:"setfarm.internal-production-golden-index-version.v1", campaignHash, indexName, expectedPredecessorHash, operationIdHash, orderedRecordHashes, recordHash }` and only then derive `indexHash = hashCanonicalJson(indexPayload)`; the payload contains the already-final operation ID but no CAS receipt/hash. Require `recordHash` to be the unique newly added member and the predecessor array plus that member, deterministically reordered by the existing result/supersession ordering rule, to equal `orderedRecordHashes`. Third construct the separate receipt payload `{ schema:"setfarm.internal-production-golden-index-cas-receipt.v1", operationIdHash, indexHash, campaignHash, indexName, expectedPredecessorHash, recordHash }`, derive `receiptHash = hashCanonicalJson(receiptPayload)`, and strictly parse `GoldenIndexCasReceiptV1`. No derivation includes its own hash, no earlier object includes a later hash, and the receipt—not the operation ID—is the first authority that jointly binds the operation and proposed index.

After deriving all three objects in memory, exclusively publish/fsync the fixed private mode-`0600` campaign lock before publishing any operation or receipt file. The lock contains the random `ownershipToken`, the complete operation/index/receipt projections, and their `operationIdHash`, `indexHash`, and `receiptHash`; the token is never returned, indexed, or included directly in any authority hash. Only that lock owner publishes/fsyncs the immutable CAS operation and then its separate CAS receipt through the no-replace protocol. Thus a losing concurrent writer or crash before lock acquisition leaves no CAS artifact. Fresh-process recovery reopens the lock and any published operation/receipt, requires `hash(ownershipToken) === tokenHash`, and recomputes all three authority projections from the lock in the exact order above before completing a missing publication. The lock owner may publish the record/index only when the unique current head still equals `expectedPredecessorHash`. Each strict index version contains `campaignHash`, `indexName`, that predecessor, the complete ordered unique record-hash array capped at `64`, the new `recordHash`, `operationIdHash`, and derived `indexHash`; readers reconstruct the one bounded chain from the null predecessor and reject a fork, gap, cycle, or unindexed record. If a process dies, recovery assumes only the exact authenticated receipt: an already-published proposed index is adopted; an exact durable record with the unchanged predecessor finishes that index; no durable record permits owned-lock cleanup and retry; and a current head equal to `indexHash` is adoption. Any other changed predecessor, projection mismatch, missing authority, second successor, or unknown lock is durable ambiguity. Lock removal is allowed only after exact token/operation/receipt proof and successful record-plus-index reopen, followed by parent fsync; a process never removes an unowned or malformed stale lock.

`put()` may publish the first nonterminal-timeout result for a run subject, and that one visible original is the durable `reconciliation_required` state. It rejects a terminal or third result for an already indexed run subject even if the caller also holds a supersession. `putTimeoutReconciliationPair({originalTimeoutResultHash,terminalResult,supersession})` is the sole exception and sole supersession writer. It reopens the visible original, requires the exact timeout/terminal/start/subject/ordinal/epoch/cleanup/supersession relations, and acquires one campaign-scoped compound lock that binds the current result, supersession, and committed-pair index predecessors plus all three record hashes. Before any child record or index write, it publishes/fsyncs one immutable private reconciliation operation containing that complete projection plus an ownership-token hash. Under that lock it uses this fixed recoverable order: publish/reopen the terminal result bytes; publish its otherwise-hidden result-index successor; publish/reopen the supersession bytes; publish its otherwise-hidden supersession-index successor; construct the pair payload with both predecessor hashes; derive `pairHash` over the payload before `pairRef`/`pairHash`; derive `pairRef` exactly as ``setfarm://internal-production/golden-timeout-reconciliations/sha256/${pairHash}``; strict-parse and publish/reopen the content-addressed `GoldenTimeoutReconciliationPairV1`; construct the next `GoldenCommittedTimeoutReconciliationPairIndexV1` from the expected committed-pair predecessor plus the exact pair/result/supersession successor hashes; publish/reopen that index; publish/fsync the exact per-supersession no-replace locator last as the sole visibility commit; reopen all records, three index successors, pair, and locator; mint the nominal committed authority; then release/fsync the owned lock. The pair receipt alone is never visibility authority.

The committed-pair campaign index lives only at the fixed content-addressed child ``timeout-reconciliations/committed/campaigns/${campaignHash}/sha256/${indexHash}.json`` and contains a bounded unique ordered supersession-hash set capped at `64`; its code-owned fixed campaign-head resolver supplies the sole current head without a directory scan. Derivation is acyclic: construct the strict index payload without `indexHash`, derive `indexHash`, then construct the committed authority from the pair/result/supersession identities plus that final index hash and derive `authorityHash` with only itself omitted. The index never contains `authorityHash`. Its exact locator lives at ``timeout-reconciliations/committed/by-campaign/${campaignHash}/by-supersession/${supersessionHash}.json``; it repeats the campaign/supersession/original/terminal hashes, `pairRef`/`pairHash`, exact result/supersession successor hashes, committed index hash, and derived authority hash, so it can be published last without a digest cycle. Neither `listCommittedTimeoutReconciliationPairAuthorities(campaignHash)` nor `locateCommittedTimeoutReconciliationPairAuthority({campaignHash,supersessionHash})` scans a directory: list follows the exact authenticated bounded campaign head/predecessor chain, while locate opens that one fixed supersession key. Both reopen and rehash the locator, committed index, pair receipt, terminal result, supersession, and both hidden index successors before minting a recursively frozen `GoldenCommittedTimeoutReconciliationPairAuthorityV1`; `authorityHash` covers every public field except itself, including `committedPairIndexHash`. `resolveCommittedTimeoutReconciliationPair({authority})` first authenticates nominal object identity, then repeats those exact reads and returns the raw terminal/supersession only inside the resolved tuple. No public loader returns a bare supersession. Schema/source tests prove the restricted authority mint entry point is consumed only by `golden-run-store.ts`; every worker/C/D/E source may import only the public type/schema/authenticator.

Before the final locator commit, `listCampaign()` hides the pending terminal, the committed-authority list/locator reports no pair, and the original remains the only visible `reconciliation_required` result; only after locator durability do terminal and committed authority become visible together. A pair receipt, raw supersession file, or either hidden successor without the final locator remains private incomplete state. A fresh process finding the authenticated operation resumes only that exact sequence and returns the byte-identical pair/authority. An exact replay adopts it. A different terminal, supersession, predecessor, operation, locator, third same-subject result, second pair naming either result, generic same-subject `put()`, duplicate/forked committed-pair index successor, or multiple/malformed pending operations is durable ambiguity and writes nothing further. Reject duplicate visible campaign entries, duplicate supersession locators, cross-campaign results, more than `64` visible results/pairs, an unknown original/terminal result, mismatched pair/ref/index/authority binding, or a second pair naming either result; putting an already-indexed byte-identical non-pair result remains idempotent. Crash tests stop before/after pair publication, committed-index publication, locator link/fsync/reopen, authority mint, and response: no reader selects a replacement until the locator is exact, and afterwards every fresh reader returns one exact authority without scanning.

- [ ] **Step 4: Write failing deterministic report tests**

Build accepted and failed validated results and assert the rendered report contains:

- campaign ID/date/hash and exact Setfarm/Mission Control SHAs and versions;
- one table row per result, discriminated visibly as `pre_run|run`: pre-run rows contain case/repetition/launch-attempt ordinal/stable subject, primary preflight failure, honestly available authority hashes, zero-owner observation, classification, cleanup-exact boolean, and root-cause hash while rendering run/repository/PR/timestamp/snapshot/render fields as `unavailable`; run rows contain the established case/run/ordinal/classification/repository/PR/timestamp/snapshot/render/cleanup/root fields;
- one `cleanupExactlySettled` value per row computed only by the imported stable `isGoldenRunCleanupExactlySettledV1(result)` ABI, with no report-local cleanup predicate;
- a per-result artifact identity section for PLAN, DESIGN, STORIES, setup-build, attempts, candidate, deploy, release admission, transfer, tests, runtime assertions, and canonical evidence refs;
- an explicit `External distribution: incomplete` section with `productionAuthority:false` and `productionAdmission:blocked`;
- no prompt, selector token, absolute path, raw output, environment value, screenshot bytes, or artifact body;
- deterministic bytes independent of input result ordering;
- no more than `64` rows and `256 KiB` UTF-8 bytes.

Add settlement/finalization tests proving:

- `resolveCanonicalInternalProductionSourceBuildRootsV1()` ignores `cwd`, rejects every CLI/environment/root override, and observes one authenticated authority from stable Setfarm/MC role, real source/build root, Git common directory, package, canonical remote, literal main branch, equal source/HEAD/local-origin-main/fresh-remote-main SHA, and semantic installed-output identities; `sealCanonicalInternalProductionSourceBuildRootsV1(roots)` freshly reobserves the remote plus local state and persists that exact projection content-addressed, and `reopenCanonicalInternalProductionSourceBuildRootsV1(authorityHash)` resolves the same roots later from that exact private receipt plus a fresh unique current role process and fresh remote-main observation in a non-sibling Setfarm docs worktree with no local `dist`;
- sealing returns the exact `setfarm://internal-production/source-build-authorities/${authorityHash}` ref; a same-SHA exact-main rebuild whose only metadata difference is the exact schema-declared `builtAt` value and a cold service restart with a new PID/listener identity both reopen the same authority hash. Detached/feature branch, local ahead/behind, absent/noncommit/stale local origin-main, fresh remote-main movement before build, between Setfarm and Mission Control builds, after either build, before seal, or before reopen, zero/multiple/malformed/extra `ls-remote` rows, timeout/oversized/nonzero remote observation, zero/multiple role processes, wrong process cwd/role, corrupt/private-mode-invalid receipt, health/build SHA drift, Git common-dir/root/package/remote drift, semantic output drift, or source/build-root symlink fails before the next command, receipt publication, or tracked byte;
- `resolveActiveSetfarmClaimRootV1()` derives only the Setfarm package containing the executing module, not `cwd` or the private canonical source root, and materialization requires this active claim's clean base SHA to equal the finalization SHA;
- `computeMissionControlBuildManifestV1(roots)` walks only the authenticated installed Mission Control build root, rejects symlink/hardlink/device/path escape and more than `20_000` files or `512 MiB`, sorts normalized relative POSIX paths by UTF-8 byte order, and hashes each regular file's semantic bytes/mode/semantic size. For the one code-owned build metadata schema it parses and equality-binds the source SHA, removes only `builtAt`, canonicalizes the remaining object, and hashes that semantic projection; every other file uses exact bytes. Same-SHA rebuilds with only a new `builtAt` produce the same manifest, while any other changed/missing/extra field/file fails receipt revalidation;
- final release epoch is derived from the exact current clean Setfarm/Mission Control SHAs; one or more accepted results at an older Setfarm or Mission Control SHA remain historical and cannot satisfy standard or fleet acceptance;
- `deriveEffectiveGoldenRunResultsV1()` emits strict pre-run mappings separately from run mappings. Pre-run mappings preserve immutable policy/report history, have no epoch partition or timeout replacement, never enter current/historical effective run arrays, accepted counts, terminal counts, first-five capacity hashes, or fleet classification aggregates. Any attempted pre-run supersession, fake run projection, or array cross-contamination fails parsing;
- after a source repair changes either SHA, current-epoch reruns are required while all historical results remain stored/reported, must still have exact cleanup settlement, and contribute to the cumulative three-repeat counter only through one selected effective result per historical mapping/subject;
- three identical systemic root hashes selected by three distinct effective mappings across two release epochs still form `blocked`, while one historical systemic result cannot by itself obstruct an otherwise complete current epoch;
- one missing required accepted result returns `in_progress` and private finalization throws `GOLDEN_CAMPAIGN_NOT_SETTLED`; any selected pre-run `campaign_configuration_failure` adds the finite `GOLDEN_PRE_RUN_CONFIGURATION_FAILURE_RECORDED` blocker and also keeps settlement `in_progress` unless three distinct effective mapping subjects reach the exact systemic-root blocked rule;
- `all-cases-required-accepted-v1` returns `complete` only when every case reaches `requiredAcceptedResults` from current-epoch effective results, every counted current result is terminal, every current and historical effective started-run result has `isGoldenRunCleanupExactlySettledV1(result) === true`, every timeout in either partition has one valid same-run terminal supersession whose replacement is exactly settled, and every global owner census is observed zero;
- `fleet-threshold-v1` returns `complete` only for exactly ten distinct current-epoch effective case/result subjects, ten current-epoch terminal runs, at least eight current-epoch `accepted`, at most two current-epoch effective results classified only as `generated_product_failure | provider_or_quota_failure | infrastructure_failure`, exact cleanup settlement for every current and historical effective result after applying authenticated committed timeout pairs, no current-epoch systemic classification, and observed-zero global ownership;
- a fleet with seven current-epoch accepted, nine or eleven current-epoch effective started-run results, an unpaired duplicate case/result subject, one open/unavailable cleanup field in either the current or historical partition, one pre-run `campaign_configuration_failure`, a current-epoch started-run `setfarm_core_failure` or `mission_control_failure`, or a run subject without an effective terminal result remains `in_progress` and cannot finalize; pre-run and historical counts never help the fleet reach ten;
- regression matrices prove a fully accepted clean current epoch remains `in_progress` when one historical effective result has unavailable cleanup, a leak, dirty worktree, or unresolved timeout. Making only that historical cleanup exact permits completion without changing current-epoch accepted/terminal/classification aggregates; changing a historical classification never changes those aggregates, while every historical cleanup hash changes the settlement hash;
- the same exact systemic root hash appearing in three distinct mapping subjects—pre-run and/or selected effective run—with every pre-run zero-owner receipt exact, every run subject effectively terminal/cleanup-settled, and global owner census zero returns `blocked` even when accepted counts are incomplete; repeated storage/replay of one stable pre-run subject counts once;
- two occurrences, mixed root hashes, any run subject lacking a terminal effective result, any open owner, or any unavailable owner observation cannot finalize;
- an original timeout without supersession is the explicit `reconciliation_required` mapping and remains `in_progress`; a bare same-subject terminal row, forged/cross-run/nonterminal/not-clean/duplicate supersession, third result, or pair lacking the store's exact final commit marker is rejected; one exact committed pair makes only its terminal replacement effective for acceptance/cleanup/policy occurrence counting, while the original timeout and both raw root-cause fields remain immutable report history;
- a regression with a timeout original and replacement carrying the same systemic root plus two other effective subjects produces four raw report rows but exactly three counted mapping occurrences; the pair alone contributes one, and changing either raw non-selected root field cannot create a fourth policy occurrence;
- `deriveEffectiveGoldenRunResultsV1()` returns byte-identical sorted mappings/pre-run/current-run/historical-run arrays across input order, binds every pre-run stable subject once and every timeout original/replacement/effective run hash once, emits each of the three exact timeout-reconciliation selection branches with all null relations enforced, and rejects duplicate subjects, a bare replacement, a third result, or conflicting original/replacement use before preflight, evaluator, or finalizer policy code runs; B's source-boundary tests prove only Task 5 preflight and Task 6 evaluator/preview/finalizer consume the exact Task 1 helper, while C/E independently assert that their later composition imports the re-exported exact symbol instead of defining another effective-result selector;
- private preview writes below the resolved private template child ``golden-results/campaigns/${campaignHash}/preview.md`` and never touches `docs/review-packets`;
- private results/previews/finalizations live outside every package worktree under the validated runtime-config data root, so no repository ignore rule is required for their invisibility;
- `finalizeGoldenCampaignReportV1` completes code-owned Setfarm and Mission Control builds against the same clean SHAs, requires zero global owners and exact `complete | blocked` settlement, then writes canonical Markdown below ``golden-results/finalizations/sha256`` and its content-addressed receipt below ``golden-results/finalizations/receipts``; `docs/review-packets` remains absent/unchanged;
- `GoldenFinalizedCampaignReportV1` binds schema, campaign ID/date/hash, ordered result hashes, settlement/platform/source-cleanliness/build hashes, report hash/size/private ref, exact derived repository-relative target path, external-authority literals, and `finalizationHash`; it contains no absolute private path or report bytes;
- `GoldenFinalizedCampaignReportV1` also binds the complete ordered committed-pair authority identity snapshots, including every pair/result/supersession/committed-index field, canonical `effectiveProjectionHash`, and deterministic Mission Control manifest hash, so adding/removing/rebinding a timeout reconciliation, changing committed-index visibility, changing the derived replacement/epoch partition, or changing an installed build file invalidates finalization/materialization. Fresh-process tests prove parsed snapshots never authenticate: `resolveGoldenFinalizedCampaignReportV1` must freshly bounded-list, exact-locate, same-position full-canonical-compare, authenticate, and resolve newly minted authorities before returning; materializers consume only those fresh objects and reject a snapshot/list length, order, index, ref, or hash mismatch;
- corrupt receipt, wrong hash, absent/different Markdown bytes, unsafe target, source/build drift, or dirty source prevents materialization without writing tracked bytes;
- `materializeFinalizedGoldenCampaignReportV1(finalizationHash)` accepts only one SHA-256, opens the receipt/Markdown by content address, rehashes all authorities, read-only reobserves the exact source SHAs and recorded build artifacts without querying global owner settlement or running a build, and writes exactly the recorded bytes to the fixed tracked target; it refuses an existing different file and is idempotent for identical bytes;
- tests simulate an active Setfarm docs claim: private finalization would fail its zero-owner gate, but materialization succeeds because it consumes the already sealed authority and deliberately performs no platform/global-owner read; the tracked report is its sole worktree change.
- materialization from a non-sibling docs worktree with no local `dist` succeeds by reading the authenticated canonical installed-build roots, including after a same-SHA exact-main rebuild and cold service restart; a missing source-authority receipt, changed semantic root/role/package/remote/branch/source/HEAD/local-origin-main/fresh-remote-main SHA/output projection, stale local tracking ref, fresh remote move, ambiguous remote output, zero/multiple current role processes, local-worktree `dist` decoy, or undeclared build drift writes nothing.
- session begin accepts only a clean exact-base docs claim with all six B-derived generation targets absent, a complete `GoldenFinalReleaseEpochV1`, the exact sealed operational `sourceBuildAuthorityRef`/`sourceBuildAuthorityHash` pair, the exact role-bound C matrix/D recovery/E fleet finalization hashes, the independently supplied later `closureFinalizationHash`, the exact derived `closureGenerationHash`, and six ordered expected content hashes supplied after E's dry verification; it performs zero B/C/D/E finalization-receipt reads and rejects an exact prefix from an earlier process. It requires `operationalSetfarmSha === finalReleaseEpoch.setfarmSha` and recomputes exactly `closureGenerationHash = hashCanonicalJson({epochHash:finalReleaseEpoch.epochHash,matrixFinalizationHash,recoveryFinalizationHash,fleetFinalizationHash})`; neither `closureFinalizationHash`, `operationalSetfarmSha`, nor the full epoch object is an extra member of that canonical generation projection. It derives the only six entries beneath the single combined directory segment ``docs/review-packets/internal-production/epoch-${finalReleaseEpoch.epochHash}-closure-${closureGenerationHash}`` with fixed basenames `golden-matrix-report.md`, `recovery-matrix.md`, `recovery-reconciliation.md`, `golden-fleet-report.md`, `final-closure.json`, and `final-closure.md` in that order. Reject an invalid full epoch/hash relation, wrong source-authority ref/hash relation, a swapped or substituted role-specific finalization hash, changed generation hash, old nested `${epochHash}/${closureGenerationHash}` layout, unsafe or non-normalized derived path, caller path/kind/entry, missing or extra content hash, duplicate target, or any non-SHA-256 content hash. After all input/path/claim checks and after atomically acquiring the generation lease, B reopens the sealed source/build authority, then immediately repeats both repositories' clean literal-main `sourceSha === HEAD === refs/remotes/origin/main === fresh refs/heads/main` observations through the same code-owned bounded remote resolver and requires them to equal the sealed authority and complete final epoch. No further await, callback, filesystem mutation, or owner observation intervenes before the synchronous session mint; any stale local tracking ref, fresh remote move, ambiguous remote output, authority drift, or epoch mismatch releases only B's just-acquired lease and returns no session. A later `closureFinalizationHash` substitution cannot alter or stand in for the three-hash generation projection: with the same exact C/D/E tuple the generation hash and directory remain equal, but the distinct closure hash changes the session/completion authority and cannot replay or adopt the reviewed session. Only `commitNextGoldenDocsMaterializationEntryV1()` authenticates and advances the live controller. Exercise all six entries through the exact owner map: B report owner for matrix/fleet, D owner for its two recovery entries, and E closure owner for JSON/Markdown. Each callback reopens its own receipt at write time and receives no path/controller. Reject a fourth owner, widened owner/kind string, every cross-owner or out-of-order kind, wrong callback/content/registered hash, mutable callback bytes, extra callback member, callback reuse for another entry, structural session clone, raw path/ordinal/hash override, or direct WeakMap access before opening a tracked target. The B report wrapper authorizes generation solely from the live capability's exact next entry kind, safe target path, and expected content hash: its reopened finalization must yield the matching report bytes/hash and report kind, but its legacy private `GoldenFinalizedCampaignReportV1.targetPath` is neither compared with nor copied into the tracked target. Tests accept the B-derived generation target different from that legacy path and reject any attempt to write the legacy path before the same live session advances its prefix.
- entry-commit concurrency and crash tests cover same-owner and cross-owner races at claim/worktree lease acquisition, callback resolution, copied-byte hashing, unpredictable temporary creation/write/fsync, no-replace link, parent fsync, inode/content proof, owned-temporary cleanup, final no-follow reopen, controller compare-and-swap advance, and response. `begin` derives the private lease key exactly as `hashCanonicalJson({schema:"setfarm.internal-production-docs-session-lease-key.v1",claimReceiptHash,claimWorktreeIdentityHash})`; generation, finalization, epoch, source authority, session hash, and content hashes are forbidden from the key. The strict private lease payload separately binds that key, complete `closureGenerationHash`, `sessionHash`, all path-free begin authorities, and a fresh random owner-token hash. It is published exclusively before minting the session, and the raw token remains only in the frozen session's private WeakMap controller. A second identical or differently parameterized begin for that same authenticated claim/worktree fails on the extant lease before any owner callback, including a different generation, epoch, finalization tuple, or deterministic session hash. A private per-session mutex serializes calls within the sole leased session; reentrant use of the same session from its active callback is refused instead of waiting. After acquisition every caller re-evaluates replay or the exact next entry and captures the expected `sessionHash` plus ordinal; before callback, publication, adoption, final reopen, and advance it must reopen the lease and authenticate the exact owner token plus lease-bound generation/session, then compare-and-swap only the unchanged controller state. Before exact final reopen the ordinal cannot advance; after reopen it advances exactly once. A waiting same-owner replay returns the byte-identical path-free `GoldenDocsMaterializationEntryCommitReceiptV1` without a second callback or advance, while a wrong cross-owner selector fails against the re-evaluated next entry. Same-live-session response loss returns the byte-identical receipt; final-published/pre-advance retry adopts only identical registered bytes while a different final or ambiguous temporary fails. A physically published and reopened file before controller advancement is uncommitted: it is never returned, included in the accepted prefix, or eligible for completion, and only that same authenticated lease owner and live session under its mutex may adopt it for the same expected session hash and ordinal. `completeGoldenDocsMaterializationSessionV1()` retains the lease until its completion receipt is durably reopened, then authenticates/unlinks only its own lease and leaves completed-session replay authority in the live controller. `abandonGoldenDocsMaterializationSessionV1(session)` authenticates and invalidates the controller, removes only its token-matching lease, returns no path or token, and never deletes a published generation file; if any prefix or pre-advance publication exists the isolated claim must still be discarded before another begin can pass target-absence checks. Killing the process leaves an unauthenticatable stale lease, so another begin for the same claim/worktree at either the same or another generation fails and no fresh process adopts its file or prefix. Test exact lease release after durable completion, clean explicit abandon, abandon after publish-before-advance, concurrent same-generation begins, concurrent different-generation begins, response loss, and crashes before/after every lease temporary/link/fsync/reopen, session mint, callback, target publication, prefix advance, completion publication, live release, retirement transition, and retirement response.
- terminal-discard tests enter only the Setfarm claim-owner operation `completeGoldenDocsClaimOwnerTerminalDisposalV1({disposedClaim})` after that owner has terminally disposed the exact isolated worktree. Its module-private `GoldenDocsDisposedClaimAuthorityV1` is a frozen WeakMap-authenticated capability minted and consumed inside `golden-docs-claim-owner-terminal-disposal.ts` only after the owner reopens its immutable claim receipt, records a content-addressed disposal receipt, proves the exact real worktree identity no longer exists and has no live claim owner, and terminalizes the claim. No report/store/session API exports that capability or a retirement mutator. Retirement reauthenticates the capability/disposal receipt and may precompute only independent random values and input-only data. Without reading the lifecycle head, it first acquires/fsyncs/reopens the fixed global mutation lock. Only under that lock does it read/reopen the current locator/head, validate capacity, disposition, and the exact lease-or-absence state, and derive the complete retirement receipt, event, successor head/locator, side-effect set, operation, and pending hashes. It publishes/reopens pending before the first durable receipt/event/head/locator/lease-removal side effect. Recovery publishes/reopens the content-addressed receipt, appends/reopens the exact `retired` lifecycle event through the registry CAS, removes only the operation-bound lease when present, fsyncs/reopens lease absence, and finally clears/fsyncs lock then pending. The terminal registry event is one-use, but neither it nor the receipt is resolvable authority while the lock, pending operation, or lease remains. A crash after lock but before pending is pre-head and side-effect-free; recovery authenticates token/action inputs and candidate absence/non-removal without a head equality check, clears the lock, and retries. Exact pending recovery resumes that same order and `completeGoldenDocsClaimOwnerTerminalDisposalV1` returns only `{schema:"setfarm.internal-production-docs-claim-owner-terminal-disposal-result.v1",receiptRef,receiptHash}`; it never returns the capability, mutator, receipt body, lease/session/generation hash, path, token, or controller. A second disposal, changed claim/worktree, changed lease, or conflicting receipt fails. The retirement receipt's null relations are exact: `active-lease-retired` requires all three retired hashes non-null and equal to the reopened lease; `no-active-lease` requires all three null. Its `receiptHash` hashes every field except `receiptRef`/`receiptHash`, and `receiptRef` is exactly ``setfarm://internal-production/docs-materialization-lease-retirements/sha256/${receiptHash}``. Every crash boundary exposes a lifecycle lock or pending retirement until the exact receipt/event/head, lease absence, and lock/pending removal are all durable; only then does the terminal receipt resolve. Reject a worker-built structural clone, live or merely renamed worktree, wrong claim receipt/worktree identity, missing/corrupt disposal receipt, nonterminal claim, active claim owner, reused authority, token-based worker attempt, and retirement of another lease. Owner discard plus retirement leaves no active/pending residual but retains immutable registry/receipt history; a new authenticated claim/worktree may then begin normally.
- every successful lease create, durable live-session completion, explicit live abandon, and owner-only disposal retirement appends exactly one strict `GoldenDocsLeaseLifecycleEventV1` and advances one immutable `GoldenDocsLeaseLifecycleHeadV1` through expected-predecessor CAS. The only legal per-lease grammar is: `absent -> created -> completed -> retired(no-active-lease)`; `absent -> created -> abandoned -> retired(no-active-lease)`; process-loss `absent -> created -> retired(active-lease-retired)`; or an unused terminally disposed claim `absent -> retired(no-active-lease)`. `completed` and `abandoned` mean only that the live session released its lease; neither is owner-disposal terminal evidence, and exactly one later owner-disposal `retired(no-active-lease)` is mandatory. No event follows `retired`. The `retired` event's `retirementDisposition` must equal its reopened receipt and requires all lease/session/generation hashes non-null only for `active-lease-retired`, otherwise all three are null for `no-active-lease`. An absent-to-retired transition is legal only when the claim-owner capability proves this claim/worktree never had a registry event or lease and is now terminally disposed; it cannot erase a missing/corrupt history. A second terminal action, reopened lease after completion/abandon/retire, wrong disposition, claim/worktree/key mismatch, unknown action/schema/member, fork, gap, cycle, changed predecessor, or unindexed event is permanent ambiguity and blocks zero.
- the fixed real mode-`0700` registry root is ``golden-results/docs-materialization-lease-lifecycle``; event records live content-addressed below `events/sha256`, immutable head pages below `heads/sha256`, and one fixed private current-head locator is only the CAS locator, never evidence. One fixed mutation lock and one separately published fixed pending-operation locator serialize create/complete/abandon/retire. Before reading any registry head or locator, a caller precomputes only independent random values and input-only candidate data, atomically publishes the no-replace lock, fsyncs its parent, and `O_NOFOLLOW` reopens it as the sole census visibility barrier. The lock contains no registry head/locator identity or derived member. Under that acquired lock, it first rejects or recovers any extant pending operation; only with pending absent does it read/reopen the current locator and immutable head, validate the current capacity/reservation plus lease or absence state, and bind that observed predecessor into the mutation operation, pending locator, event, successor head, and successor-locator projections. Only after deriving all complete receipt/lease/session/event/successor-head/successor-locator/side-effect hashes does it publish/fsync/reopen pending; only after pending durability may the first action record, lease, completion/retirement receipt, tracked byte, event, head, current-locator replacement, or lease-removal side effect occur. Because no other writer can advance the locator while this lock is held, stale lock acquisition is impossible. A crash leaving lock without pending is therefore provably before any head read, predecessor binding, or side effect. Recovery validates only the raw token/hash, finite action inputs, candidate-creation absence, and unchanged removal targets, without reading or equality-checking a registry head, then clears/fsyncs the lock and retries. Successful mutation cleanup reopens every side effect, clears/fsyncs the lock first, then clears/fsyncs pending; a crash in that cleanup gap leaves pending without lock, never lock without pending. A later caller atomically acquires its own lock, detects that orphan pending before a fresh head read, requires its complete predecessor/successor/side-effect/removal state to be byte-exact, adopts it, clears its recovery lock first and pending last, then retries from a new lock acquisition. Partial, mismatched, unowned, malformed, or noncommitted orphan pending is ambiguity.
- immutable event, immutable head, lock, pending, action, lease, completion/retirement receipt, and tracked-byte records use unpredictable-temporary write/fsync, atomic no-replace publication, parent fsync, and `O_NOFOLLOW` reopen. The fixed current-head locator is the sole replacement exception. Its canonical `GoldenDocsLeaseLifecycleCurrentHeadLocatorV1` bytes bind the immutable successor `headRef`/`headHash`, event ordinal/count, reservation count, and `locatorHash`, where `locatorHash` hashes every member except itself. Under the already acquired global lock, the writer reads/reopens and byte/hash-equality-checks the current locator plus its immutable predecessor head (or twice proves both absent for the initial append), writes/fsyncs an unpredictable same-directory successor-locator temporary, then immediately repeats the predecessor-locator/head equality check before atomically renaming the temporary over the fixed locator. It fsyncs the parent and `O_NOFOLLOW` reopens/strict-parses/rehashes the fixed locator and named immutable successor head before continuing. A crash before replacement observes the exact predecessor and resumes from pending; a crash after replacement but before parent fsync/reopen observes either exact predecessor or exact successor and completes/adopts only that pending-bound branch; any third bytes, missing named head, duplicate successor, or mismatch is ambiguity. No other lifecycle file may use replace. Event and head hashes omit only their own ref/hash fields. The lock contains only the raw ownership token, its hash, the action and lease key, and the complete bounded action-specific input-candidate snapshot; it contains no registry head/locator, receipt, lease, session, event, successor, side-effect-set, mutation-operation, or pending member or hash. Only after lock acquisition and pending-absence proof does B read the current locator/head and construct `GoldenDocsLeaseLifecycleMutationV1`; `operationHash` hashes that strict under-lock mutation without itself. Only after that complete derivation does `pendingHash` hash the pending locator containing the already-derived operation/token/predecessor/successor-head/successor-locator hashes without itself. The lock is never a hash input to either, so derivation is acyclic and constructible. Each append requires `eventOrdinal === predecessor.eventOrdinal + 1`, `eventCount === eventOrdinal`, and exact predecessor hashes. One immutable head page names one event, traversal begins only at the no-follow fixed locator, follows exactly the predecessor chain, permits at most `4096` events/pages, and visits them in strictly descending ordinal then reverses to canonical ascending order; it never scans a directory. Before a new begin publishes any lease, its locked pending operation must reserve the entire three-event suffix: `created`, exactly one `completed|abandoned`, and mandatory owner-disposal `retired`. Represent this as `reservedTerminalSlotCountAfter:2` on `created`, `1` on `completed|abandoned`, and `0` on `retired`, with the head repeating the sum of all live reservations. Begin is legal only when `eventCount + reservedTerminalSlotCount + 3 <= 4096`; unrelated appends may use only unreserved capacity. Process-loss retirement consumes the two-slot reservation in one event and releases the unused live-release slot; completion/abandon consumes one, and its later retirement consumes the last. Legal absent unused-claim retirement reserves/consumes one unreserved slot and requires `eventCount + reservedTerminalSlotCount + 1 <= 4096`. At count `4093` with zero reservations one final begin may complete/abandon and retire at exactly `4096`; at `4094` a new begin fails before lease, while an already reserved transition remains legal; at `4095` only its exact reserved retirement or one legal unused-claim retirement can fill `4096`; at `4096` no append is legal. Boundary and concurrent tests prove no lifecycle can be stranded by another claim consuming its suffix. The locator, head, events, reservations, lock, and pending operation must all rehash. A two-writer race proves writer two observes writer one's lock and waits without reading the head; after writer one commits and clears lock/pending, writer two atomically acquires a fresh lock, reads the new current head only under that lock, and derives the next successor. Crash tests at lock-before-head, head read, pending, action/lease/receipt/event/head/locator temporary, predecessor recheck, atomic replacement, parent fsync, successor reopen, physical lease removal, lock cleanup, pending cleanup, and response prove either the exact predecessor remains authoritative or the unique pending-bound successor is adopted, never an unregistered mutation, lost update, overwrite of an immutable record, or false zero.
- `inspectGoldenDocsMaterializationLeaseCensusV1()` derives state from that authenticated registry chain only, never by scanning lease/retirement directories or trusting an unindexed file. Before reading the head it no-follow reads the fixed mutation lock/pending locator: either being present, changing, unknown, or malformed causes a bounded retry and then typed unavailable rather than a census. With both absent it captures the current-head locator, traverses/reopens the exact registry and named durable state, then rereads the lock/pending locator as still absent and the head locator as byte-identical before returning. `registryMutationPending` is therefore strictly `false`; `registryMutationFenceHash` hashes the two identical absent-state/head-locator observations and all fixed locator identities. No mutation can read the current registry head, derive a successor, or perform a durable side effect without first publishing the lock; pending is published later but still before the first side effect. The double fence therefore blocks the pre-head lock gap, every lock-plus-pending mutation, and the post-commit lock-cleared/pending-held cleanup gap, preventing false zero. It returns `lifecycleHeadHash`, bounded `lifecycleEventCount`, exact `reservedTerminalSlotCount`, exact counts, and a sorted unique `terminalRetirementReceipts` array of at most `4096` exact `{receiptRef,receiptHash}` identities ordered by lowercase `receiptHash`. `activeLeaseCount` counts only latest `created`; `completed|abandoned` count as live-session released but remain disposal-incomplete, so they contribute to `pendingRetirementCount` until exact later `retired(no-active-lease)`; a census-visible registry mutation also prevents return rather than being counted. Compute `terminalRetirementSetHash = hashCanonicalJson({schema:"setfarm.internal-production-docs-terminal-retirement-set.v1",receipts:terminalRetirementReceipts})`, then compute `observationHash = hashCanonicalJson({schema,registryMutationPending,registryMutationFenceHash,lifecycleHeadHash,lifecycleEventCount,reservedTerminalSlotCount,activeLeaseCount,pendingRetirementCount,terminalRetirementCount,terminalRetirementReceipts,terminalRetirementSetHash,observedZero})` over every strict census member except `observationHash`; neither projection includes itself or a later hash. Require `reservedTerminalSlotCount` to equal the grammar-derived outstanding reservation sum, `terminalRetirementCount === terminalRetirementReceipts.length`, and `observedZero === (activeLeaseCount === 0 && pendingRetirementCount === 0 && reservedTerminalSlotCount === 0)`. The final cleanup/global-zero-owner observer imports this exact census and cannot report zero, settle, build/finalize, or produce final acceptance while a lock/pending mutation exists; a registry head/event is unavailable, unknown, malformed, forked, over bound, or inconsistent; or any created/completed/abandoned claim lacks owner disposal retirement. Terminal retirement history is non-active but must rehash. Tests inject each action, legal grammar, illegal missing/double retirement, active-vs-no-active disposition swap, crash immediately after lock-before-head, immediately after the under-lock head read, immediately after pending-before-first-side-effect, and immediately after lock is durably cleared but before pending is cleared for each of create/complete/abandon/retire, every locator replacement boundary, every later side-effect boundary, head movement between census fences, corruption, fork/gap/cycle, unknown member/action, duplicate retirement, the `4093..4096` reservation boundary, process-death stale lease, completed live release, owner disposal transition, and rejected `4097th`. Lock-without-pending recovery checks no head: exact token/action/input authentication plus no candidate creation or removal change clears/retries. Pending-without-lock recovery first acquires a new lock and adopts only the complete byte-exact successor/removal state before clearing lock then pending; a partial/mismatched combination fails closed. A two-writer race asserts that writer two performs zero head reads while writer one holds the lock, then reads writer one's committed successor as its predecessor only after acquiring the next lock. E compatibility tests require final acceptance to use the same new zero relation and never treat completion/abandon alone as disposal. Compile/source-boundary tests prove E imports only the B retirement resolver/census, never the disposed capability, claim-owner operation, or mutator; no worker module defines a session/lease/retirement authenticator/controller/advance/retire helper or obtains a target path or owner token from an API or receipt.
- callback-contract tests require an exact strict `{bytes,contentHash}` object whose `bytes` value has exactly `Uint8Array.prototype`, is not a Node `Buffer`, subclass, `DataView`, other typed view, or a view over `SharedArrayBuffer`, and is within the fixed byte bound. Immediately and synchronously after the awaited callback resolves—and before any further `await`, filesystem action, controller read/mutation, hook, hash, or other side effect—B validates the return shell and copies the bytes into a new private `Uint8Array` backed by a private `ArrayBuffer`; every subsequent hash and write uses only that copy. A regression mutates the owner's original array immediately after return and proves the committed hash/bytes remain unchanged; an accessor, extra member, mutable hash claim, shared backing store, or post-copy mismatch fails closed.
- session begin requires the `closureFinalizationHash` that E has already equality-checked against its strict private closure finalization, parses it and each C matrix/D recovery/E fleet finalization hash as one SHA-256 without opening any owner receipt, preserves the role-bound three-hash tuple, `operationalSetfarmSha`, complete final epoch, derived closure-generation hash, six B-derived entries, and `sessionHash` inside the authenticated capability, and rejects a missing, malformed, swapped, substituted, or changed value before the first tracked write;
- completion recomputes the six actual content and materialization hashes, persists one strict `GoldenDocsMaterializationCompletionReceiptV1` before returning, and returns exactly `{receiptRef,receiptHash,sessionHash,orderedMaterializationHashes}`; its canonical projection binds the operational SHA, sealed source-build authority ref/hash pair, independently later closure finalization hash, complete final epoch, exact role-bound matrix/recovery/fleet finalization hashes, closure-generation hash, session hash, exact six B-derived ordered entries, six content hashes, and six materialization hashes, with every `orderedEntries[i].expectedContentHash === orderedContentHashes[i]` and the fixed kind order;
- `resolveGoldenDocsMaterializationCompletionReceiptV1({receiptRef,receiptHash})` accepts no path, root, entry, body, operational SHA, closure hash, or session override and, in a fresh process, derives the fixed private child solely from the exact canonical ref/hash, opens it no-follow, strictly parses and rehashes it, and rejects a wrong ref/hash relation, corrupt bytes, wrong mode/link/type, reordered entry, or changed content/materialization hash.
- interruption tests cover before/after unpredictable same-directory temporary creation, bounded write, temporary fsync, atomic no-replace publication, parent-directory fsync, `O_NOFOLLOW` final reopen/hash adoption, temporary cleanup, and response return; the deterministic final path is always absent or complete, a retry never returns authority before durability, equal sealed bytes resolve once, and a collision or ambiguous differing receipt remains fail-closed.

- [ ] **Step 5: Run the report test and confirm failure**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-report.test.ts
```

Expected: FAIL because the report renderer is absent.

- [ ] **Step 6: Implement settlement, private preview, private finalization, and narrow materialization**

```typescript
import {
  deriveEffectiveGoldenRunResultsV1,
} from "./golden-run-contract-v1.js";
import type {
  GoldenEffectiveRunResultProjectionV1,
} from "./golden-run-contract-v1.js";
import {
  buildCanonicalInternalProductionSourcesV1,
  computeMissionControlBuildManifestV1,
  reopenCanonicalInternalProductionSourceBuildRootsV1,
  resolveActiveSetfarmClaimRootV1,
} from "./golden-source-build-authority.js";
import type {
  GoldenFinalizationSourceBuildV1,
} from "./golden-source-build-authority.js";

export {
  deriveEffectiveGoldenRunResultsV1,
} from "./golden-run-contract-v1.js";
export type {
  GoldenEffectiveRunResultProjectionV1,
} from "./golden-run-contract-v1.js";

export function renderGoldenCampaignReportV1(input: Readonly<{
  campaign: GoldenCampaignV1;
  campaignHash: string;
  results: readonly GoldenRunResultV1[];
  timeoutReconciliations:
    readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[];
  settlement: GoldenCampaignSettlementV1;
}>): string;

export function evaluateGoldenCampaignSettlementV1(input: Readonly<{
  campaign: GoldenCampaignV1;
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  results: readonly GoldenRunResultV1[];
  timeoutReconciliations:
    readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[];
  platform: GoldenPlatformInspectionV1;
}>): GoldenCampaignSettlementV1;

export async function writePrivateGoldenCampaignPreviewV1(input: Readonly<{
  campaign: GoldenCampaignV1;
  campaignHash: string;
  results: readonly GoldenRunResultV1[];
  timeoutReconciliations:
    readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[];
  settlement: GoldenCampaignSettlementV1;
}>): Promise<Readonly<{ ref: string; reportHash: string }>>;

export type GoldenFinalizationSourceCleanlinessV1 = Readonly<{
  setfarmSha: string;
  missionControlSha: string;
  setfarmClean: true;
  missionControlClean: true;
  sourceBuild: GoldenFinalizationSourceBuildV1;
  observationHash: string;
}>;

export type GoldenFinalizedCampaignReportV1 = Readonly<{
  schema: "setfarm.internal-production-finalized-campaign-report.v1";
  campaignId: string;
  campaignDate: string;
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  resultHashes: readonly string[];
  timeoutReconciliationAuthorities:
    readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[];
  effectiveProjectionHash: string;
  settlementHash: string;
  platformInspectionHash: string;
  sourceBuildAuthorityHash: string;
  sourceBuildAuthorityRef: CanonicalRef;
  sourceCleanliness: GoldenFinalizationSourceCleanlinessV1;
  reportHash: string;
  reportSizeBytes: number;
  privateReportRef: string;
  targetPath: string;
  productionAuthority: false;
  productionAdmission: "blocked";
  finalizationHash: string;
}>;

export const GoldenFinalizedCampaignReportV1Schema: z.ZodType<GoldenFinalizedCampaignReportV1>;

export async function finalizeGoldenCampaignReportV1(input: Readonly<{
  campaign: GoldenCampaignV1;
  campaignHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  results: readonly GoldenRunResultV1[];
  timeoutReconciliations:
    readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[];
  settlement: Extract<GoldenCampaignSettlementV1, { status: "complete" | "blocked" }>;
  platform: GoldenPlatformInspectionV1;
  sourceCleanliness: GoldenFinalizationSourceCleanlinessV1;
}>): Promise<GoldenFinalizedCampaignReportV1>;

export async function resolveGoldenFinalizedCampaignReportV1(
  finalizationHash: string,
): Promise<GoldenFinalizedCampaignReportV1>;

export async function materializeFinalizedGoldenCampaignReportV1(
  finalizationHash: string,
): Promise<Readonly<{
  finalizationHash: string;
  targetPath: string;
  reportHash: string;
  materializationHash: string;
}>>;

export type GoldenDocsMaterializationEntryV1 = Readonly<{
  kind:
    | "golden-matrix-report"
    | "recovery-matrix"
    | "recovery-reconciliation"
    | "golden-fleet-report"
    | "final-closure-json"
    | "final-closure-markdown";
  targetPath: string;
  expectedContentHash: string;
}>;

export interface GoldenDocsMaterializationSessionV1 {
  readonly kind: "authenticated-in-process-docs-materialization-session";
  readonly sessionHash: string;
}

export type GoldenDocsMaterializationExpectedContentHashesV1 = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
];

export function beginGoldenDocsMaterializationSessionV1(input: Readonly<{
  operationalSetfarmSha: string;
  closureFinalizationHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  sourceBuildAuthorityRef: CanonicalRef;
  sourceBuildAuthorityHash: string;
  matrixFinalizationHash: string;
  recoveryFinalizationHash: string;
  fleetFinalizationHash: string;
  closureGenerationHash: string;
  orderedExpectedContentHashes:
    GoldenDocsMaterializationExpectedContentHashesV1;
}>): Promise<GoldenDocsMaterializationSessionV1>;

export function abandonGoldenDocsMaterializationSessionV1(
  session: GoldenDocsMaterializationSessionV1,
): Promise<void>;

// golden-docs-claim-owner-terminal-disposal.ts only; never re-exported.
interface GoldenDocsDisposedClaimAuthorityV1 {
  readonly kind: "authenticated-setfarm-disposed-docs-claim";
  readonly claimReceiptHash: string;
  readonly claimWorktreeIdentityHash: string;
  readonly disposalReceiptHash: string;
}

export type GoldenDocsClaimOwnerTerminalDisposalResultV1 = Readonly<{
  schema: "setfarm.internal-production-docs-claim-owner-terminal-disposal-result.v1";
  receiptRef: CanonicalRef;
  receiptHash: string;
}>;

type GoldenDocsLeaseRetirementReceiptCommonV1 = Readonly<{
  schema: "setfarm.internal-production-docs-lease-retirement-receipt.v1";
  claimReceiptHash: string;
  claimWorktreeIdentityHash: string;
  disposalReceiptHash: string;
  leaseKeyHash: string;
  receiptRef: CanonicalRef;
  receiptHash: string;
}>;

export type GoldenDocsLeaseRetirementReceiptV1 =
  GoldenDocsLeaseRetirementReceiptCommonV1 & (
    | Readonly<{
        disposition: "active-lease-retired";
        retiredLeaseHash: string;
        retiredSessionHash: string;
        retiredClosureGenerationHash: string;
      }>
    | Readonly<{
        disposition: "no-active-lease";
        retiredLeaseHash: null;
        retiredSessionHash: null;
        retiredClosureGenerationHash: null;
      }>
  );

// Source-boundary restricted to Setfarm's claim-owner terminal-disposal hook.
export function completeGoldenDocsClaimOwnerTerminalDisposalV1(input: Readonly<{
  disposedClaim: GoldenDocsDisposedClaimAuthorityV1;
}>): Promise<GoldenDocsClaimOwnerTerminalDisposalResultV1>;

export function resolveGoldenDocsLeaseRetirementReceiptV1(input: Readonly<{
  receiptRef: CanonicalRef;
  receiptHash: string;
}>): Promise<GoldenDocsLeaseRetirementReceiptV1>;

type GoldenDocsLeaseLifecycleEventCommonV1 = Readonly<{
  schema: "setfarm.internal-production-docs-lease-lifecycle-event.v1";
  eventOrdinal: number;
  expectedPredecessorEventHash: string | null;
  reservedTerminalSlotCountAfter: number;
  leaseKeyHash: string;
  claimReceiptHash: string;
  claimWorktreeIdentityHash: string;
  eventRef: CanonicalRef;
  eventHash: string;
}>;

export type GoldenDocsLeaseLifecycleEventV1 =
  GoldenDocsLeaseLifecycleEventCommonV1 & (
    | Readonly<{
        action: "created";
        leaseHash: string;
        sessionHash: string;
        closureGenerationHash: string;
        completionReceiptHash: null;
        retirementReceiptHash: null;
      }>
    | Readonly<{
        action: "completed";
        leaseHash: string;
        sessionHash: string;
        closureGenerationHash: string;
        completionReceiptHash: string;
        retirementReceiptHash: null;
      }>
    | Readonly<{
        action: "abandoned";
        leaseHash: string;
        sessionHash: string;
        closureGenerationHash: string;
        completionReceiptHash: null;
        retirementReceiptHash: null;
      }>
    | Readonly<{
        action: "retired";
        leaseHash: string | null;
        sessionHash: string | null;
        closureGenerationHash: string | null;
        completionReceiptHash: null;
        retirementReceiptHash: string;
        retirementDisposition:
          | "active-lease-retired"
          | "no-active-lease";
      }>
  );

export type GoldenDocsLeaseLifecycleHeadV1 = Readonly<{
  schema: "setfarm.internal-production-docs-lease-lifecycle-head.v1";
  expectedPredecessorHeadHash: string | null;
  eventRef: CanonicalRef;
  eventHash: string;
  eventOrdinal: number;
  eventCount: number;
  reservedTerminalSlotCount: number;
  headRef: CanonicalRef;
  headHash: string;
}>;

type GoldenDocsLeaseLifecycleCurrentHeadLocatorV1 = Readonly<{
  schema: "setfarm.internal-production-docs-lease-lifecycle-current-head-locator.v1";
  headRef: CanonicalRef;
  headHash: string;
  eventOrdinal: number;
  eventCount: number;
  reservedTerminalSlotCount: number;
  locatorHash: string;
}>;

type GoldenDocsLeaseLifecycleMutationActionV1 =
  | "create"
  | "complete"
  | "abandon"
  | "retire";

type GoldenDocsLeaseLifecycleMutationV1 = Readonly<{
  schema: "setfarm.internal-production-docs-lease-lifecycle-mutation.v1";
  action: GoldenDocsLeaseLifecycleMutationActionV1;
  ownershipTokenHash: string;
  leaseKeyHash: string;
  predecessorHeadHash: string | null;
  predecessorHeadLocatorHash: string | null;
  predecessorEventCount: number;
  predecessorReservedTerminalSlotCount: number;
  intendedEventHash: string;
  intendedHeadHash: string;
  intendedHeadLocatorHash: string;
  intendedSideEffectSetHash: string;
  operationHash: string;
}>;

type GoldenDocsLeaseLifecyclePendingLocatorV1 = Readonly<{
  schema: "setfarm.internal-production-docs-lease-lifecycle-pending-locator.v1";
  operationHash: string;
  ownershipTokenHash: string;
  predecessorHeadHash: string | null;
  predecessorHeadLocatorHash: string | null;
  intendedHeadHash: string;
  intendedHeadLocatorHash: string;
  pendingHash: string;
}>;

export type GoldenDocsLeaseRetirementIdentityV1 = Readonly<{
  receiptRef: CanonicalRef;
  receiptHash: string;
}>;

export type GoldenDocsMaterializationLeaseCensusV1 = Readonly<{
  schema: "setfarm.internal-production-docs-materialization-lease-census.v1";
  registryMutationPending: false;
  registryMutationFenceHash: string;
  lifecycleHeadHash: string | null;
  lifecycleEventCount: number;
  reservedTerminalSlotCount: number;
  activeLeaseCount: number;
  pendingRetirementCount: number;
  terminalRetirementCount: number;
  terminalRetirementReceipts:
    readonly GoldenDocsLeaseRetirementIdentityV1[];
  terminalRetirementSetHash: string;
  observedZero: boolean;
  observationHash: string;
}>;

export function inspectGoldenDocsMaterializationLeaseCensusV1():
  Promise<GoldenDocsMaterializationLeaseCensusV1>;

export type GoldenDocsMaterializationOwnerEntrySelectorV1 =
  | Readonly<{
      ownerId: "b-golden-report-v1";
      expectedKind: "golden-matrix-report" | "golden-fleet-report";
    }>
  | Readonly<{
      ownerId: "d-recovery-reports-v1";
      expectedKind: "recovery-matrix" | "recovery-reconciliation";
    }>
  | Readonly<{
      ownerId: "e-final-closure-v1";
      expectedKind: "final-closure-json" | "final-closure-markdown";
    }>;

export type GoldenDocsMaterializationEntryCommitReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-docs-materialization-entry-commit-receipt.v1";
  sessionHash: string;
  entryOrdinal: 1 | 2 | 3 | 4 | 5 | 6;
  ownerId: GoldenDocsMaterializationOwnerEntrySelectorV1["ownerId"];
  kind: GoldenDocsMaterializationEntryV1["kind"];
  contentHash: string;
  materializationHash: string;
}>;

export const GoldenDocsMaterializationEntryCommitReceiptV1Schema:
  z.ZodType<GoldenDocsMaterializationEntryCommitReceiptV1>;

export function commitNextGoldenDocsMaterializationEntryV1(
  input: GoldenDocsMaterializationOwnerEntrySelectorV1 & Readonly<{
    session: GoldenDocsMaterializationSessionV1;
    reopenOwnerContent(): Promise<Readonly<{
      bytes: Uint8Array;
      contentHash: string;
    }>>;
  }>,
): Promise<GoldenDocsMaterializationEntryCommitReceiptV1>;

export function materializeFinalizedGoldenCampaignReportInSessionV1(input: Readonly<{
  finalizationHash: string;
  expectedKind: "golden-matrix-report" | "golden-fleet-report";
  session: GoldenDocsMaterializationSessionV1;
}>): Promise<GoldenDocsMaterializationEntryCommitReceiptV1>;

export function completeGoldenDocsMaterializationSessionV1(
  session: GoldenDocsMaterializationSessionV1,
): Promise<Readonly<{
  receiptRef: CanonicalRef;
  receiptHash: string;
  sessionHash: string;
  orderedMaterializationHashes: readonly string[];
}>>;

export type GoldenDocsMaterializationCompletionReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-docs-materialization-completion-receipt.v1";
  operationalSetfarmSha: string;
  closureFinalizationHash: string;
  finalReleaseEpoch: GoldenFinalReleaseEpochV1;
  sourceBuildAuthorityRef: CanonicalRef;
  sourceBuildAuthorityHash: string;
  matrixFinalizationHash: string;
  recoveryFinalizationHash: string;
  fleetFinalizationHash: string;
  closureGenerationHash: string;
  sessionHash: string;
  orderedEntries: readonly [
    GoldenDocsMaterializationEntryV1,
    GoldenDocsMaterializationEntryV1,
    GoldenDocsMaterializationEntryV1,
    GoldenDocsMaterializationEntryV1,
    GoldenDocsMaterializationEntryV1,
    GoldenDocsMaterializationEntryV1,
  ];
  orderedContentHashes: readonly [string, string, string, string, string, string];
  orderedMaterializationHashes: readonly [string, string, string, string, string, string];
  receiptRef: CanonicalRef;
  receiptHash: string;
}>;

export const GoldenDocsMaterializationCompletionReceiptV1Schema:
  z.ZodType<GoldenDocsMaterializationCompletionReceiptV1>;

export function resolveGoldenDocsMaterializationCompletionReceiptV1(input: Readonly<{
  receiptRef: CanonicalRef;
  receiptHash: string;
}>): Promise<GoldenDocsMaterializationCompletionReceiptV1>;
```

Use the exact `GoldenCampaignSettlementV1Schema` and inferred `GoldenCampaignSettlementV1` defined in Task 1; do not create a report-local settlement shape.

`resolveCanonicalInternalProductionSourceBuildRootsV1()` is self-contained in B. It accepts no argument and reads no new source-root environment variable or caller path. It validates the trusted loopback origins, queries bounded health/build identities, and requires exactly one current listener/process for each code-owned service role. That observation must map to the stable semantic identity `(role,realSourceRoot,realInstalledBuildRoot,gitCommonDir,packageName,canonicalRemote,branch:"main",sourceSha,headSha,originMainSha,remoteMainSha,semanticInstalledOutputHash)`. For each of Setfarm and Mission Control it reads the branch, `HEAD`, and local `refs/remotes/origin/main` from the authenticated real source root. It separately invokes the sole private remote resolver as exact `execFile("git", ["ls-remote","--refs",canonicalRemoteUrl,"refs/heads/main"], {cwd:fixedSafeObserverDirectory,env:normalizedObserverEnvironment,shell:false,timeout:15_000,maxBuffer:4096,encoding:"utf8"})`. The code-owned fixed observer directory and isolated HOME/XDG directories are freshly reopened before every call as empty real non-symlink mode-`0700` directories outside either repository and outside any Git worktree. `normalizedObserverEnvironment` is a replacement object, never a merge: it contains only fixed trusted `PATH`, those isolated `HOME`/`XDG_CONFIG_HOME`, `GIT_CONFIG_NOSYSTEM:"1"`, `GIT_CONFIG_GLOBAL:"/dev/null"`, `GIT_TERMINAL_PROMPT:"0"`, `LANG:"C"`, and `LC_ALL:"C"`. It contains no inherited `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_*`, `GIT_CONFIG_VALUE_*`, other `GIT_CONFIG*`, system/global/repository config, URL rewrite, credential helper, `GIT_SSH*`, `SSH_*`, askpass, upper/lowercase proxy, `NO_PROXY`, or locale field. The parser accepts exactly one complete lowercase forty-hex `<sha>\trefs/heads/main\n` record with empty stderr; it rejects zero/multiple/duplicate/extra/symref/malformed records, whitespace variants, timeout, overflow, signal, or nonzero exit and never fetches or writes a ref. Require branch literal `main` plus `sourceSha === headSha === originMainSha === remoteMainSha`; missing, symbolic-to-wrong-ref, noncommit, detached, local-ahead/behind, stale local tracking, or fresh remote-drift state fails. It requires two distinct real non-symlink roots, clean Git worktrees, health/build SHAs equal to that exact source SHA, and semantic installed output equal to that SHA. Current PID, listener, process-start time, and observation hash remain transient controller checks and never become authority identity. The active docs-claim module root is separate and checked only by `resolveActiveSetfarmClaimRootV1()`; neither `cwd`, sibling layout, docs worktree, nor local `dist` chooses production roots. Poisoned-environment tests repeat this exact boundary during initial resolve, pre/post each build, seal, reopen, final cleanliness, standalone materialization, session begin, and completion; any caller cwd/config/rewrite/helper/SSH/askpass/proxy/locale influence or unsafe fixed directory fails before remote execution or the next mutation.

The private controller behind `GoldenCanonicalSourceBuildRootsV1` holds absolute paths and current observations, but its public object contains only schema plus `authorityHash`. The sealed hash projection contains only stable service roles, real source/build roots, Git common-directory identities, package/remotes, literal `branch:"main"`, equality-bound source/HEAD/local-origin-main/fresh-remote-main SHAs, and semantic installed-output hashes; it excludes PID, listener/process identity, process start, observation time, and raw `builtAt`. `sealCanonicalInternalProductionSourceBuildRootsV1()` authenticates WeakMap identity, rereads both local Git triples, performs two new remote-main resolutions, and checks cleanliness immediately before publication; it requires byte equality with the controller and writes that stable projection content-addressed only while both remain exact clean main at the fresh remote head. `reopenCanonicalInternalProductionSourceBuildRootsV1(authorityHash)` opens/recomputes the receipt, observes a fresh unique current process for each sealed role, rereads both local triples, performs new remote-main resolutions, and remints only when its cwd/health/build/Git/package/remote/root/branch/source/HEAD/local-origin-main/fresh-remote-main/semantic output equals the receipt and both worktrees remain clean. Thus a cold restart or same-SHA rebuild does not change authority, but a wrong/ambiguous service, branch drift, local-ahead/behind state, stale local tracking ref, fresh remote movement, or ambiguous remote observation fails closed. `buildCanonicalInternalProductionSourcesV1()` runs only the code-owned Setfarm then Mission Control build argv, constructs semantic build identities, seals the authority, and accepts no root/cwd/argv/environment override. `resolveActiveSetfarmClaimRootV1()` remains separate and derives the executing package root, not `cwd`.

`computeMissionControlBuildManifestV1(roots)` authenticates the capability, reads only the recorded installed Mission Control build root, walks sorted normalized relative POSIX paths, accepts regular one-link files only, rejects escapes, and caps `20_000` files/`512 MiB`. Ordinary files contribute exact bytes/mode/size. The sole code-owned build-metadata file is schema-parsed, source-SHA-bound, stripped only of `builtAt`, canonically re-encoded, and contributes those semantic bytes/mode/size; an unknown volatile key is rejected. The manifest hashes the ordered semantic projection and contains no timestamp, PID, listener, or absolute path. Setfarm `dist/BUILD_INFO.json` is normalized by the identical rule into `semanticBuildInfoHash`. Materialization reads only authenticated installed roots, so same-SHA rebuilds and service restarts remain valid while real artifact drift fails.

Task 1's `deriveEffectiveGoldenRunResultsV1()` is the sole canonical original-to-effective mapping in B and the only mapping C/E may import through Task 6's identity-preserving re-export. It strictly validates campaign/hash/epoch, every strict result branch, and every supersession; rejects duplicate result hashes, duplicate discriminated subjects, duplicate original or replacement use, unknown/cross-campaign/cross-case/cross-run/cross-ordinal/cross-epoch links, self-links, non-timeout originals, nonterminal or not-exactly-clean replacements, and any second supersession for either side. Each `kind:"pre_run"` value emits one immutable mapping that binds its stable attempt subject and uses its own hash as both original and effective hash; it has no replacement or epoch partition and may never appear in a supersession. Each `kind:"run"` ordinary result or timeout original emits the established mapping, binding original and nullable replacement hashes, selected effective hash, exact run subject, and `current|historical` from equality of both result release SHAs to the final epoch. A terminal timeout replacement is never emitted as a second ordinary mapping. The projection returns pre-run results separately from immutable current/historical effective started-run arrays and recomputes every `mappingHash` plus `projectionHash`. It performs no settlement-policy dispatch, classification threshold, blocker, or root-cause counting.

`evaluateGoldenCampaignSettlementV1` first calls `deriveEffectiveGoldenRunResultsV1()` and consumes its three partitions without rebuilding the mapping. It requires all platform active-owner counts to be observed and zero. Only `currentEpochEffectiveResults` may satisfy accepted counts, terminal-result counts, per-classification aggregates, required repetitions, or fleet threshold policy. Cleanup is deliberately broader: concatenate `currentEpochEffectiveResults` and `historicalEffectiveResults` in their canonical partition/order, and require `isGoldenRunCleanupExactlySettledV1(result) === true` for every selected effective started-run result before either policy may complete. A historical result never contributes acceptance or classification count, but any historical effective timeout without a valid terminal replacement, unavailable cleanup authority, nonzero owner/process/port/worktree count, dirty generated root, or other cleanup failure blocks `complete`. Every raw pre-run/original/replacement/historical result remains unchanged in the immutable store/report. Cumulative systemic occurrence counting iterates mappings once: a pre-run mapping contributes its one stable attempt subject, a run mapping contributes its one selected effective run subject, and a superseded timeout original is never a second occurrence. Repeated reopening of the same pre-run result or timeout pair therefore cannot inflate the three-repeat threshold. It must not duplicate cleanup-field or effective-selection logic inside the report module. Dispatch only on the campaign's schema-validated `settlementPolicy`:

- `all-cases-required-accepted-v1`: `complete` requires each case's current-epoch accepted count to be at least its `requiredAcceptedResults`, plus exact cleanup across every current and historical effective started-run result.
- `fleet-threshold-v1`: `complete` requires exactly ten current-epoch terminal distinct effective results for the ten declared cases, at least eight accepted, no current-epoch effective classification outside accepted plus the three finite allowed non-accepted classifications, zero current-epoch systemic classifications, and exact cleanup settlement across every current and historical effective started-run result. It emits the fixed ordered current-epoch classification-count tuple and never treats a historical classification or cleanup/platform observation as a product failure allowance.
- either policy: `blocked` requires the same exact systemic root hash in at least three distinct selected mapping subjects across the strict pre-run and effective-run mappings; record the canonical capped count as `3`. A `campaign_configuration_failure` pre-run result is immutable policy history and supplies an explicit configuration blocker, but fewer than three distinct stable subjects keeps settlement `in_progress` and never advances acceptance, terminal, cleanup, or fleet capacity. Raw duplicate reads and timeout original/replacement rows cannot inflate the count.

Otherwise return `in_progress` with finite policy-specific blockers, including `GOLDEN_PRE_RUN_CONFIGURATION_FAILURE_RECORDED` when pre-run history exists, `GOLDEN_FINAL_RELEASE_EPOCH_ACCEPTANCE_INCOMPLETE` when only historical acceptance exists, and `GOLDEN_TIMEOUT_RECONCILIATION_REQUIRED` when an original timeout in either epoch partition has no authenticated committed pair. The settlement hash binds campaign hash, the exact settlement-policy object, the full final epoch object/hash, ordered pre-run/current/historical result hashes, ordered committed-pair authority/pair/supersession hashes and effective-result mapping, current-epoch run-only accepted/per-classification counts or cumulative repeated cause, and a cleanup projection containing every current result cleanup hash followed by every historical result cleanup hash plus the all-exact boolean and zero-owner platform inspection. The private finalizer recomputes settlement from `campaign + finalReleaseEpoch + results + timeoutReconciliations + platform` and requires canonical byte equality with the supplied settlement; callers cannot hand-author an epoch, bare supersession, pair authority, cleanup projection, or threshold-complete receipt.

Sort history first by campaign case order and repetition, then by `kind`, using `launchAttemptOrdinal` for pre-run subjects and `runNumber` plus result hash for run subjects; no nullable timestamp is a policy key. Escape Markdown table cells, allow only validated HTTPS GitHub PR URLs and canonical refs, render every pre-run run/start/terminal/lifecycle/workflow field as `unavailable`, and never render the case task. Bind the rendered header to the validated settlement status/hash or blocker set. `writePrivateGoldenCampaignPreviewV1` writes atomically with mode `0600` below the validated shared campaign directory and may run after every stored pre-run or terminal result regardless of whether settlement is `in_progress`, `complete`, or `blocked`.

Task 3's `GoldenFinalizationSourceBuildV1` and `buildCanonicalInternalProductionSourcesV1()` are one code-owned source/build-authority ABI in the same module and compile together before Task 6 imports them. The function obtains/authenticates the canonical roots and, immediately before each command, rereads both repositories, performs a new remote-main resolution for each, and requires clean literal `main` with `sourceSha === HEAD === refs/remotes/origin/main === fresh refs/heads/main` equal to the authenticated authority. It runs exact `npm run build` with `shell:false` in Setfarm then Mission Control roots. Immediately after each build, and again before seal, it repeats both-repository branch/clean/local-ref/fresh-remote equality checks; any movement stops before the next command or publication. After both commands finish, it discards every pre-build installed-output observation and recomputes both semantic installed-output projections from the built roots before sealing. It computes Setfarm `semanticBuildInfoHash` and the semantic Mission Control manifest, then seals the stable authority and stores its exact hash/ref. Each `GoldenFinalizationSourceBuildV1` repository member repeats `branch:"main"`, `sourceSha`, `headSha`, `originMainSha`, and `remoteMainSha` and requires all four SHAs equal; `buildReceiptHash` covers those values plus the semantic payload. Repeating a build at the same exact remote main SHAs with only a new `builtAt` yields the same receipt; any other source/local-ref/remote-head/installed-output change invalidates it. Finalization equality-binds the hash/ref/receipt. Missing or ambiguous current service role, build failure, branch/root/SHA/local-ref/fresh-remote/semantic-output mismatch, seal failure, or undeclared manifest drift returns before finalization.

`GoldenFinalizationSourceCleanlinessV1` is built only after those builds and a second release inspection plus fresh remote-main observations. It parses both SHAs with `GitObjectHashSchema`, requires them to equal each build member's `sourceSha === headSha === originMainSha === remoteMainSha`, the sealed authenticated source authority, and pre-build inspection, requires both branches still literal `main` and both canonical source worktrees still clean, and requires `observationHash === hashCanonicalJson({ setfarmSha, missionControlSha, setfarmClean:true, missionControlClean:true, sourceBuild })`. Construct `finalReleaseEpoch = createGoldenFinalReleaseEpochV1({ setfarmSha:sourceCleanliness.setfarmSha, missionControlSha:sourceCleanliness.missionControlSha })`; no caller or CLI flag may select it. `finalizeGoldenCampaignReportV1` accepts only the `complete | blocked` union members, requires its explicit epoch to equal both the settlement epoch and clean-source/build SHAs, receives the final observed zero-owner `GoldenPlatformInspectionV1`, first derives the exact `GoldenEffectiveRunResultProjectionV1`, then reruns `evaluateGoldenCampaignSettlementV1({ campaign, campaignHash, finalReleaseEpoch, results, timeoutReconciliations, platform })` and requires that evaluator to have used the byte-identical projection. It requires exact canonical equality with the supplied policy-bound settlement and derives the tracked filename exactly as:

```typescript
const fileName = `${campaign.campaignDate}-${campaign.campaignId}-golden-run-report.md`;
```

Require `campaignDate` and `campaignId` to have passed Task 1 schemas before joining and set `targetPath` to the repository-relative `docs/review-packets/${fileName}`. Equality-bind `effectiveProjectionHash` to the just-derived projection and render raw history plus its canonical effective mapping once. `GoldenFinalizedCampaignReportV1.timeoutReconciliationAuthorities` is exactly `readonly GoldenCommittedTimeoutReconciliationPairAuthorityV1[]`, not a six-field summary. Sort it by `supersessionHash`, require unique campaign/supersession/original/terminal/pair identities, authenticate every nominal object immediately before serialization, and strict-parse and hash every authority member: schema, campaign, supersession/original/terminal hashes, `pairRef`, `pairHash`, result/supersession/committed-pair index hashes, and `authorityHash`. Persistence records the complete canonical fields only as identity snapshots; JSON bytes, Zod parsing, or structural freezing never preserve or mint nominal authority. A projection that drops an index hash, rebuilds a structural authority, or changes any member fails. Reject report bytes over `256 * 1024`, compute `reportHash`, and write the canonical bytes content-addressed at the fixed private child ``golden-results/finalizations/sha256/${reportHash.slice(0, 2)}/${reportHash}.md`` with mode `0600`. Set `privateReportRef` to the exact path-free canonical value ``setfarm://internal-production/finalized-reports/sha256/${reportHash}``. Construct and strictly parse `GoldenFinalizedCampaignReportV1`, compute `finalizationHash` over the complete payload without that field, and store it content-addressed at ``golden-results/finalizations/receipts/${finalizationHash.slice(0, 2)}/${finalizationHash}.json``. Equal bytes are idempotent; collisions fail. This function never resolves or writes `docs/review-packets`.

`resolveGoldenFinalizedCampaignReportV1(finalizationHash)` is the only finalization reopen boundary. It parses the hash, no-follow reopens and strict-parses the persisted receipt/report and its complete timeout authority snapshots, but never calls the nominal authenticator on those parsed objects. It asks `GoldenRunResultStore.listCommittedTimeoutReconciliationPairAuthorities(campaignHash)` for a fresh bounded sorted nominal list, then for every position requires full canonical byte equality between the fresh authority and persisted snapshot, including every schema/campaign/pair/result/supersession/committed-index/authority field. It rejects length/order changes, missing/extra/duplicate authorities, structural clones, and any same-hash field drift. For each equal fresh member it calls `authenticateGoldenCommittedTimeoutReconciliationPairAuthorityV1(fresh)`, `locateCommittedTimeoutReconciliationPairAuthority({campaignHash,supersessionHash})`, and `resolveCommittedTimeoutReconciliationPair({authority:fresh})`, requiring byte-identical authority and all reopened members. Only then does it construct the returned frozen `GoldenFinalizedCampaignReportV1` with its `timeoutReconciliationAuthorities` array populated by those fresh nominal objects in the persisted positions and recompute the finalization hash/report relation. Thus persistence is identity evidence, never live capability.

`materializeFinalizedGoldenCampaignReportV1(finalizationHash)` first calls only `resolveGoldenFinalizedCampaignReportV1(finalizationHash)` and consumes its freshly reminted nominal timeout authorities; it never authenticates or selects from persisted structural snapshots. It then requires exact campaign/settlement/platform/supersession/source/build/target bindings. Before writing, it requires the active Setfarm docs claim clean at the recorded base, reopens the stable source/build authority through fresh unique service-role observations and fresh canonical-remote-main reads, requires both canonical repositories still clean literal `main` with `sourceSha === HEAD === refs/remotes/origin/main === fresh refs/heads/main` equal to the receipt, and recomputes Setfarm/Mission Control semantic installed-output projections and `buildReceiptHash`. A changed PID/listener or same-SHA exact-main `builtAt` alone is valid; any wrong role/root/common-dir/package/remote/branch/source/HEAD/local-origin-main/fresh-remote-main SHA or nonvolatile artifact drift fails. It never consults local claim `dist`, runs a build, reevaluates settlement, fetches, or accepts caller content/path/root authority. Only after all checks pass does it atomically write the exact receipt-derived target under the contained docs directory. The in-session B report owner callback uses the same resolver/remint boundary before returning bytes. No execute/collect/store/finalize function calls this materializer.

The standalone materializer keeps that one-file clean-worktree contract and continues to consume the legacy finalized-report `targetPath` for its one-file CLI behavior. That private-finalizer path is not tracked authority for the composable path. Subproject E first dry-verifies each B/C/D/E owner receipt through that owner's read-only verifier and equality-checks `closureFinalizationHash` against its own strict private closure finalization. It supplies the sealed operational source/build authority pair, exact C matrix, D recovery, and E fleet finalization hashes in their fixed roles, the six exact ordered expected content hashes, the equality-checked full final epoch, the independently later closure-finalization hash, and the derived generation hash to `beginGoldenDocsMaterializationSessionV1({ operationalSetfarmSha, closureFinalizationHash, finalReleaseEpoch, sourceBuildAuthorityRef, sourceBuildAuthorityHash, matrixFinalizationHash, recoveryFinalizationHash, fleetFinalizationHash, closureGenerationHash, orderedExpectedContentHashes })`; D/E never receive a target path, entry/controller/lease authority, owner token, or path-generation input. B does not import, open, authenticate, or make claims about the C/D/E owner receipts or future bytes. It authenticates the active Setfarm docs claim and clean `operationalSetfarmSha`, requires `operationalSetfarmSha === finalReleaseEpoch.setfarmSha`, parses every supplied identity strictly, and recomputes exactly `closureGenerationHash = hashCanonicalJson({ epochHash:finalReleaseEpoch.epochHash, matrixFinalizationHash, recoveryFinalizationHash, fleetFinalizationHash })`. The separately bound `closureFinalizationHash` is deliberately not an input to that generation hash. From only the validated epoch/generation pair B derives the exact single combined directory segment ``docs/review-packets/internal-production/epoch-${finalReleaseEpoch.epochHash}-closure-${closureGenerationHash}`` and the fixed ordered basenames `golden-matrix-report.md`, `recovery-matrix.md`, `recovery-reconciliation.md`, `golden-fleet-report.md`, `final-closure.json`, and `final-closure.md`, associates the six ordered expected content hashes, then proves all six normalized distinct paths remain contained under `docs/review-packets`. It rejects the former nested `${epochHash}/${closureGenerationHash}` shape and requires every derived target absent with an empty materialization prefix.

After those validations, B derives `docsLeaseKeyHash = hashCanonicalJson({schema:"setfarm.internal-production-docs-session-lease-key.v1",claimReceiptHash,claimWorktreeIdentityHash})` solely from the authenticated active claim's immutable receipt identity and real worktree identity. Closure generation, epoch, finalization/content/source authorities, and session hash are forbidden from that key. Begin may mint its random 32-byte owner token and input-only candidate values in volatile memory, then—without reading a registry head or locator—acquires/fsyncs/reopens the one fixed lifecycle mutation lock before any durable side effect. Only under that lock and after proving pending absent does it read/reopen the current locator/head, validate exact claim/worktree absence and `eventCount + reservedTerminalSlotCount + 3 <= 4096`, and bind that current predecessor into the operation/pending/event projections; insufficient capacity rejects before pending or a lease. Still under lock it derives the complete session, lease, `created` event, new head, canonical successor locator, side-effect set, mutation operation, and pending-locator payloads/hashes, including the full suffix reservation and `reservedTerminalSlotCountAfter:2`. It then publishes/fsyncs/reopens pending, and only after that durability publishes the strict lease as the first side effect, followed by the immutable event/head and the sole-exception fixed-locator replacement protocol. It clears/fsyncs the lock then pending only after reopening every exact side effect. If a crash leaves lock without pending, no predecessor was read or bound and no side effect occurred; recovery authenticates the token/action/input snapshot and proves candidate absence/non-removal without consulting the head, clears the lock, and retries. If a crash leaves pending without lock, a later recovery lock adopts only the complete pending-bound successor/side-effect state, clears that recovery lock then pending, and retries. Any partial or crossed state is ambiguity. The lease payload binds `docsLeaseKeyHash`, claim/worktree identities, complete closure generation and session projection, every path-free begin authority, and `ownerTokenHash`; the raw token remains only in a private WeakMap. An existing, malformed, partial, ambiguous, same-input, same-generation, or different-generation lease at that claim/worktree key blocks before a session or owner callback; no caller can select a lease key/path/token or clear another owner. With its exact registered lease held, `begin` reopens `sourceBuildAuthorityRef`/`sourceBuildAuthorityHash` through `reopenCanonicalInternalProductionSourceBuildRootsV1(sourceBuildAuthorityHash)`, requires the canonical ref relation and sealed Setfarm/Mission Control source SHAs to equal the complete final epoch, and then immediately performs a final new local branch/HEAD/origin-main/clean read plus the bounded code-owned fresh remote-main read for each repository. Both must remain literal clean `main` with sealed `sourceSha === HEAD === refs/remotes/origin/main === fresh refs/heads/main`; no further await, callback, filesystem mutation, or owner observation occurs before the synchronous session mint. Failure performs the same constructible abandon sequence: precompute independent values, acquire/reopen the lock without a head read, then under lock read/reopen the current created locator/head and lease, derive the complete abandoned event/head/successor-locator/side-effect/pending hashes, publish/reopen pending, remove the lease, publish the transition, and clear lock then pending. Its reserved retirement slot remains mandatory for later claim-owner disposal and no session is returned. The factory preserves the complete source authority pair, epoch, exact role-bound three-finalization tuple, independent closure finalization hash, generation, B-owned entries, lease-key hash, and private owner token in one frozen WeakMap-authenticated live session; `sessionHash` binds every path-free authority except the random raw token, while the private lease equality-binds both its generation/session values and token hash. An exact one-to-five-entry prefix from an earlier process is not resumable and is rejected like a conflicting target.

No B/C/D/E owner authenticates, reads, selects, or advances the session `WeakMap` controller or lease directly. Every owner uses only `commitNextGoldenDocsMaterializationEntryV1(...)`. Its strict correlated selector has exactly three code-owned owner scopes: `b-golden-report-v1` may select only `golden-matrix-report | golden-fleet-report`, `d-recovery-reports-v1` only `recovery-matrix | recovery-reconciliation`, and `e-final-closure-v1` only `final-closure-json | final-closure-markdown`. No fourth owner, string widening, alias, dynamic registration, raw target path, entry ordinal, expected content hash, write callback with a path, generic advance API, lease path, or token parameter exists. B authenticates the exact live session object, reopens the generation lease no-follow, and requires the controller's private owner token to hash to that lease before entering its private per-session mutex. A private reentrancy marker refuses a callback that tries to commit through the same session instead of deadlocking. Only after acquiring the mutex does B re-evaluate completed replay versus the exact next entry, reauthenticate the same lease/token, derive the ordinal and registered entry from its private controller, bind the expected `{sessionHash,entryOrdinal}` compare-and-swap state, and require the selector's owner/kind to match that entry's fixed allowlist relation. The owner callback independently reopens and rehashes only its own private receipt/content/source authority and returns an exact bounded `{bytes,contentHash}` object; it receives no target path or session controller. Its `bytes` must have exactly `Uint8Array.prototype` and an ordinary private `ArrayBuffer`; reject `Buffer`, subclasses, `DataView`, every other typed view, `SharedArrayBuffer`, and every shared-buffer-backed view. Immediately and synchronously after the awaited callback resolves, before any further `await`, filesystem operation, controller read/mutation, hook, hash, or other side effect, B validates the return shell and copies those bytes into a new private `Uint8Array`. It recomputes SHA-256 and writes only from that private copy, requires equality with the captured callback hash and registered `expectedContentHash`, and never treats the callback's claim or later-mutable memory as hash authority.

`commitNextGoldenDocsMaterializationEntryV1(...)` uses only the controller's already validated contained `targetPath`. Under the same mutex it rechecks the token-authenticated lease, current exact live-session prefix, and absence of unrelated tracked/untracked/staged changes, opens an unpredictable same-directory mode-`0600` temporary with no-follow/exclusive flags, writes the bounded private copy, fsyncs, reauthenticates the lease immediately before publication, publishes by atomic link-with-no-replace, fsyncs the parent, proves the temporary/final inode and bytes, removes only its owned temporary, fsyncs again, and reopens both lease and final no-follow as the exact token-owned lease plus a regular one-link exact-hash file. Only after those reopens and only if the controller still equals the captured `sessionHash` plus ordinal does it compare-and-swap advance once and construct the strict path-free `GoldenDocsMaterializationEntryCommitReceiptV1`. Its schema enforces the owner/kind relation and controller-derived ordinal, and derives `materializationHash = hashCanonicalJson({schema,sessionHash,entryOrdinal,ownerId,kind,contentHash})`; `sessionHash` already binds the complete ordered entry including its safe target and source authority. If response loss occurs after advance, a same-owner call waits for the mutex, re-evaluates replay, authenticates the same lease, reopens the exact final, and returns the byte-identical receipt without invoking the callback or advancing. A mismatched cross-owner caller re-evaluates against the now-current entry and fails before its callback. If interruption occurs after exact final publication and reopen but before advance, the physical file is an uncommitted claim: it is never returned, accepted as part of the prefix, or visible to completion. Only the same owner-token-authenticated live session under its mutex may adopt that exact registered file for the same captured session hash and ordinal and then advance once; a second begin cannot mint a controller while the lease exists. A partial/different final, wrong/multiple temporary, changed prefix, wrong owner/kind/hash, absent/different lease token, stale compare-and-swap state, or non-next call fails closed. Process loss leaves the exclusive lease without an available raw token and leaves the isolated claim unusable; no fresh process or structurally equal session adopts a file or prefix. Setfarm discards that entire claim/worktree and starts from a new authenticated claim identity at the unchanged operational base.

`materializeFinalizedGoldenCampaignReportInSessionV1()` is B's closed wrapper over that API with `ownerId:"b-golden-report-v1"`. Its owner callback reopens the exact B finalization receipt and report bytes and ignores `GoldenFinalizedCampaignReportV1.targetPath` after validating the private receipt schema/hash; it neither requires equality to the registered entry nor treats the legacy path as a fallback. D's two writers and E's final JSON/Markdown writers call the same B commit API with their exact owner/kind selector and code-owned reopen callback; E's fleet-report writer calls the B report wrapper. B never vouches for a C/D/E receipt, and E's dry verification cannot substitute for the owner's write-time reopen.

`completeGoldenDocsMaterializationSessionV1(session)` accepts no caller path, entry, content hash, operational SHA, source authority, closure hash, owner-finalization hash, epoch, generation, lease, or token override. It authenticates the live owner token and may precompute independent entry/content data in volatile memory, then acquires/fsyncs/reopens the fixed lifecycle mutation lock without reading or binding a registry head. Under that lock and after pending-absence proof it reads/reopens the current locator/head, validates lease/session/generation, the exact six-entry prefix, reservation, and capacity; recomputes the ordered content/materialization hashes; and binds that predecessor into the complete completion receipt, `completed` event, new head, canonical successor locator, side-effect set, mutation operation, and pending-locator hashes. The event consumes one reserved suffix slot and binds `reservedTerminalSlotCountAfter:1`. Only after publishing/fsyncing/reopening that pending locator may it publish the completion receipt as the first side effect. The strict completion payload binds the session's operational SHA, sealed source-build authority pair, independent closure-finalization hash, full epoch, exact matrix/recovery/fleet hashes, generation, entries, content hashes, and materialization hashes. Derive `receiptRef` exactly as ``setfarm://internal-production/docs-materialization-completions/sha256/${receiptHash}`` and publish the mode-`0600` receipt by unpredictable temporary, fsync, atomic no-replace link, parent fsync, inode/content proof, owned-temporary cleanup, and `O_NOFOLLOW` reopen; an existing receipt is adopted only after byte identity. Then publish/reopen the immutable event/head, replace/reopen the fixed locator through its sole-exception predecessor-CAS protocol, mark the session completed, reopen/authenticate and unlink only the token-owned lease, fsync absence, and clear/fsync lock then pending before returning `{receiptRef,receiptHash,sessionHash,orderedMaterializationHashes}`. A crash leaving lock without pending is pre-head and side-effect-free; recovery checks token/action/input plus candidate absence/non-removal without any head read, clears the lock, and retries. A crash with lock and pending resumes the exact projection and never derives new values. A crash after lock is cleared but before pending is cleared is adopted by a later recovery lock only if the successor locator/head, completion receipt, event, reservation, controller disposition where still live, and lease removal are all exact; any partial or mismatched state is ambiguity. Until both cleanup records are absent, census returns no projection. `completed` is only live-session release and remains pending owner retirement. An identical repeat reopens the same receipt/event after response loss. `abandonGoldenDocsMaterializationSessionV1(session)` likewise precomputes only independent volatile values, acquires/reopens the lock without reading a head, then under it reads/reopens the current locator/head and validates session/lease/prefix/reservation before deriving the complete predecessor-bound `abandoned` event/head/successor-locator/side-effect/operation/pending hashes. It publishes/reopens pending before the first controller, lease, event, or locator side effect, publishes/reopens the immutable event/head, replaces/reopens the fixed locator through the same CAS protocol, marks the controller abandoned, unlinks/fsyncs only the exact lease, reopens absence, and clears lock then pending last before returning `void`; `reservedTerminalSlotCountAfter:1` remains for mandatory owner retirement. Its lock-without-pending recovery is always the pre-head/no-side-effect case; post-commit recovery is represented only by pending-without-lock and requires the fully committed successor. Neither complete nor abandon deletes or blesses unrelated files, and a structural clone, changed lease/token, changed under-lock predecessor, or duplicate terminal live-session action fails closed.

Process-death retirement is a separate claim-owner-only terminal path implemented wholly in `golden-docs-claim-owner-terminal-disposal.ts`. The Setfarm claim lifecycle owns its sole non-worker hook. Only after terminalizing the exact claim, content-addressing its disposal proof, verifying the isolated real worktree no longer exists, and observing no live owner does that module mint one frozen WeakMap-authenticated private `GoldenDocsDisposedClaimAuthorityV1` and immediately pass it to `completeGoldenDocsClaimOwnerTerminalDisposalV1({disposedClaim})`. No report/store/session module exports that capability, authenticator, or mutator, and E never imports this owner operation. The operation authenticates the capability/disposal receipt, computes input-only lease-key data and fresh random token material in memory, then acquires/fsyncs/reopens the fixed lifecycle mutation lock without reading or binding a registry head. Only under that lock and after pending-absence proof does it read/reopen the current locator/head, validate capacity/reservation, and prove the exact legal state: latest `created` requires `retired(active-lease-retired)`; latest `completed|abandoned` requires `retired(no-active-lease)`; absent history permits `retired(no-active-lease)` only for a proven never-used disposed claim. It then binds that predecessor into the complete retirement receipt, `retired` event, new head, canonical successor locator, side-effect set, operation, and pending-locator hashes, with the exact active/null relations and `reservedTerminalSlotCountAfter:0`. Only after pending publication/fsync/reopen does it publish the receipt as the first side effect, followed by immutable event/head, the sole-exception fixed-locator replacement, and equality-bound lease removal when applicable. It reopens all results and clears/fsyncs lock then pending last. A crash leaving lock without pending is pre-head and side-effect-free; recovery authenticates token/action/input plus candidate absence/non-removal without a head equality check, clears the lock, and retries. A crash with lock and pending resumes that exact operation without choosing new values. A crash after lock is cleared but before pending is cleared is adopted by a later recovery lock only when the unique successor locator/head, receipt, event, zero reservation, and exact applicable lease removal are all byte-for-byte complete. Any partial removal or mismatch is ambiguity. Census returns no projection and the resolver refuses the terminal receipt throughout. No event may follow retirement. The owner hook returns only the frozen strict `GoldenDocsClaimOwnerTerminalDisposalResultV1` carrying schema plus `receiptRef`/`receiptHash`; it exposes no other field.

`GoldenDocsLeaseRetirementReceiptV1` enforces `disposition:"active-lease-retired"` iff `retiredLeaseHash`, `retiredSessionHash`, and `retiredClosureGenerationHash` are all non-null and equal to the reopened lease, otherwise `disposition:"no-active-lease"` requires all three null. `receiptHash` covers every member except `receiptRef` and itself, and `receiptRef` is exactly ``setfarm://internal-production/docs-materialization-lease-retirements/sha256/${receiptHash}``. The unique terminal lifecycle event per lease key makes retirement one-use; an exact owner retry reopens the same receipt/result pair, while another disposal authority, receipt, event, or projection is a collision. `resolveGoldenDocsLeaseRetirementReceiptV1({receiptRef,receiptHash})` derives only the fixed content address, opens no-follow, strict-parses, recomputes all hash/ref/null/event/head relations, and returns a recursively frozen receipt only after the registry is terminal and no pending operation/lease remains. A live/renamed/mismatched worktree, active claim owner, nonterminal claim, forged structural capability, corrupt disposal receipt, wrong claim/worktree, or worker token cannot retire a lease.

The append-only lease lifecycle registry is the sole census authority. Under fixed ``golden-results/docs-materialization-lease-lifecycle``, every content-addressed event and immutable head page is mode `0600`, no-follow reopened, and linked to the exact predecessor; a fixed current-head locator advances only under predecessor CAS and is never itself evidence. One fixed mutation lock and one separately published pending-operation locator serialize every registry mutation globally, not merely per lease. The constructible sequence is identical for create, complete, abandon, and retire: precompute only independent randomness/input data; without a head/locator read, acquire/fsync/reopen the no-replace lock as the sole census barrier; reject or recover extant pending before a fresh mutation; only then under lock read/reopen the current locator/head, validate capacity/reservation/state, and bind that predecessor into all complete receipt/lease/session/event/head/successor-locator/side-effect/operation/pending payloads and hashes; publish/fsync/reopen pending no-replace; perform the first durable side effect; publish/reopen all immutable exact results; update only the fixed current-head locator by predecessor-locator equality check, unpredictable temporary/fsync, second equality check, atomic replacement, parent fsync, and successor reopen/rehash; finish exact removals; clear/fsync lock, then clear/fsync pending last. The lock contains no head identity. Lock-without-pending is therefore only the pre-head/pre-side-effect state and is cleared/retried after token/action/input authentication plus candidate absence/non-removal proof, without any head comparison. Pending-without-lock is only the post-commit cleanup gap; a later recovery lock may adopt it only after complete exact successor/side-effect/removal proof, then clears recovery lock before pending and retries. Anything partial, crossed, extra, unowned, or malformed is blocking ambiguity. Immutable event/head/lock/pending/receipt/action/lease files remain no-replace; the fixed current-head locator is the sole mutable replacement target.

The exact grammar is `absent -> created -> completed|abandoned -> retired(no-active-lease)`, `absent -> created -> retired(active-lease-retired)` after process loss, or `absent -> retired(no-active-lease)` for a proven never-used disposed claim. Completion and abandon release the live session/lease but are not owner-disposal terminal states. Every such event must have exactly one later retired successor, and no event follows retired. Event/head hashes omit their own ref/hash fields, the head names the already-derived event, and the locator names the already-derived head, so no cycle exists. One head page represents one event; `eventOrdinal`/`eventCount` start at one, increase exactly by one, and cap the predecessor traversal at `4096`. Each created event reserves two more terminal suffix slots, completion/abandon leaves one, and retirement leaves zero; the head's `reservedTerminalSlotCount` is the exact sum for all non-retired histories. Begin checks under the global lock that count plus current reservations plus three is at most `4096` before any lease. Unused-claim retirement requires one free unreserved slot. Reserved transitions always retain their slots against unrelated claims. Census opens only the fixed locator and follows the exact bounded head/event chain, reversing descending traversal to canonical ascending order; it never lists a directory or trusts an unindexed lease/receipt. Unknown schema/action/member, malformed ref/hash, wrong active/no-active relation, missing mandatory retirement, event after retired, reservation mismatch, fork, gap, cycle, duplicate terminal action, missing named durable record, a `4097th` event, or locator/head mismatch makes the census unavailable and blocks zero.

`inspectGoldenDocsMaterializationLeaseCensusV1()` first no-follow observes the fixed lock and pending locator as absent, captures the current-head locator, derives active/pending/terminal/reserved state from the authenticated chain and equality-reopens named records, then rereads lock/pending as absent and head as byte-identical. A pre-head lock-only gap, a lock-plus-pending operation, or a post-commit lock-cleared/pending-held gap causes bounded retry then typed unavailable, never a projection; no false zero is possible because lock is acquired before a head read and pending remains until every side effect and cleanup proof is durable. The returned strict census records `registryMutationPending:false`, a `registryMutationFenceHash` over both equal absence/head observations, lifecycle head/count, reservation total, exact state counts, sorted unique bounded retirement identities, terminal set hash, and observed zero. `activeLeaseCount` counts latest created only; latest completed/abandoned contributes to `pendingRetirementCount` until owner retirement. `terminalRetirementSetHash` hashes exactly `{schema:"setfarm.internal-production-docs-terminal-retirement-set.v1",receipts:terminalRetirementReceipts}`. `observationHash` hashes every strict census member except itself, including mutation fence and reservation count. Require `terminalRetirementCount === terminalRetirementReceipts.length`, reservation equality to grammar, and `observedZero === (activeLeaseCount === 0 && pendingRetirementCount === 0 && reservedTerminalSlotCount === 0)`. Terminal history remains immutable non-active evidence. Invalid mutation/registry state blocks zero ownership, settlement, source build/finalization, and final acceptance. Tests cover create/complete/abandon/retire crashes immediately after lock-before-head, immediately after the under-lock head read, immediately after pending-before-first-side-effect, at every later action/lease/receipt/event/head/current-locator temporary/recheck/replace/fsync/reopen/removal boundary, and immediately after lock-cleared-before-pending-cleared. For each action, lock-only recovery performs no head read and proves only token/action/input plus absence/non-removal before release/retry; orphan-pending recovery acquires a new lock and proves the unique fully committed successor/removal state before clearing recovery lock then pending. A two-writer race holds writer one after lock acquisition, proves writer two performs zero head reads, then permits writer one to commit/clean up and proves writer two's later lock acquisition reads the new head and creates the next successor. Current-locator crash tests observe only exact predecessor or exact successor. Tests also cover head movement between census fences, both retired dispositions, missing/double retirement, illegal event after retired, and exact capacity cases: zero-reservation count `4093` permits one final three-event lifecycle; `4094` rejects begin before lease; reserved histories at `4094|4095` finish their exact suffix; a legal unused retirement may consume the sole unreserved `4096th` slot; no `4097th` action exists. Source-boundary tests preserve the existing E-facing resolver/census-only contract, and E final acceptance requires this exact new zero relation. `resolveGoldenDocsMaterializationCompletionReceiptV1({receiptRef,receiptHash})` continues to accept only that path-free pair and to recompute source authority, owner-finalization tuple, epoch, generation, and content/materialization bindings. A completion/abandon without owner retirement is never final acceptance.

- [ ] **Step 7: Run store/report tests and static checks**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-store.test.ts tests/internal-production/golden-run-report.test.ts tests/internal-production/golden-source-build-authority.test.ts
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
git diff --check
```

Expected: all commands exit `0`; results/previews/private finalizations are shared content-addressed state, private finalization leaves tracked docs unchanged, and only verified materialization writes exact tracked bytes.

- [ ] **Step 8: Record the Task 6 Setfarm handoff checkpoint**

Run `git status --short` and `git diff --check`, verify the exact Task 6 scope, and return the file list plus focused/static evidence to the active Setfarm claim. Do not stage or commit.

---

### Task 7: Expose the exact CLI and wire repository verification

**Files:**
- Create: `src/internal-production/golden-run-cli.ts`
- Create: `tests/internal-production/golden-run-cli.test.ts`
- Modify: `tests/internal-production/golden-run-contract-v1.test.ts`
- Modify: `package.json:14-23`

**Interfaces:**
- Consumes: prerequisite Task P0's already merged and immutable completion-owner receipt module; Tasks 1–6; `runtimeConfig.setfarmPgUrl`; `postgres`; `ContentAddressedEvalResultStore` only as the required V3 admission repository store dependency; `createV3ReleaseAdmissionRepository`; default repository and observers.
- Produces: `GoldenRunCliDependencies`; `runGoldenRunCli(argv, dependencies): Promise<number>`; `GoldenRunOwnerProducerManifestActivationReceiptV1`; `GoldenRunOwnerProducerManifestActivationStatusV1`; zero-input `activateGoldenRunOwnerProducerManifestV1()`; zero-input read-only `observeGoldenRunOwnerProducerManifestActivationStatusV1()`; package scripts `internal:golden` and `test:internal-production`; exact operational commands `prepare-launch-operation-migration`, `resume-launch-operation-migration`, `launch-operation-migration-status`, `verify-launch-operation-migration`, `activate-owner-producer-manifest`, and `owner-producer-manifest-status`; and exact harness commands `preflight`, `execute`, `collect`, `reconcile-timeout`, `finalize-report`, and `materialize-finalized-report`. It does not recreate or modify the prerequisite receipt module.
- CLI boundary: there is no root override, concurrency option, all-cases execution, force option, lifecycle mutation option, service restart, or release-SHA inference in execute/collect mode. The sole database mutation surface is the fixed Task 2 migration release plus the zero-input B manifest activation wrapper: `activate-owner-producer-manifest --json` owns only `[A,B]` and the code-owned current clean source/build authority, while `owner-producer-manifest-status --json` is read-only and accepts no identity. Prepare accepts only one B owner-merge pair plus one A complete-zero-owner pair, resume accepts no identity, while status and verify are read-only and accept no identity. None accepts SQL, database URL, migration ID, digest, schema, plan, manifest, predecessor, receipt/head pair, path, source, tree, force, or generic migration arguments. `finalize-report` writes only private content-addressed state. Only `materialize-finalized-report` may write tracked bytes, and it accepts only one finalization hash.

- [ ] **Step 1: Write failing argv, exit-code, and no-mutation tests**

Call `runGoldenRunCli(argv, dependencies)` with finite fake dependencies owned by the test module; do not add environment-selected executable/path overrides. Lock these commands:

```text
node --import tsx src/internal-production/golden-run-cli.ts preflight --campaign tests/fixtures/internal-production/golden-campaign-v1.json --case node-cli-contract-fixture --release-sha 865a7157ba5dacd24283af03c00400499aac6de7 --json
node --import tsx src/internal-production/golden-run-cli.ts execute --campaign tests/fixtures/internal-production/golden-campaign-v1.json --case node-cli-contract-fixture --release-sha 865a7157ba5dacd24283af03c00400499aac6de7 --json
node --import tsx src/internal-production/golden-run-cli.ts collect --campaign tests/fixtures/internal-production/golden-campaign-v1.json --case node-cli-contract-fixture --release-sha 865a7157ba5dacd24283af03c00400499aac6de7 --run-id run-test-1 --json
node --import tsx src/internal-production/golden-run-cli.ts reconcile-timeout --campaign tests/fixtures/internal-production/golden-campaign-v1.json --original-result-hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --json
node --import tsx src/internal-production/golden-run-cli.ts finalize-report --campaign tests/fixtures/internal-production/golden-campaign-v1.json --json
node --import tsx src/internal-production/golden-run-cli.ts materialize-finalized-report --finalization-hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --json
node --import tsx src/internal-production/golden-run-cli.ts prepare-launch-operation-migration --source-merge-ref setfarm://internal-production/completion-owner/merge/example --source-merge-hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --zero-owner-guard-ref setfarm://internal-production/baseline/zero-owner/example --zero-owner-guard-hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb --json
node --import tsx src/internal-production/golden-run-cli.ts resume-launch-operation-migration --json
node --import tsx src/internal-production/golden-run-cli.ts launch-operation-migration-status --json
node --import tsx src/internal-production/golden-run-cli.ts verify-launch-operation-migration --json
```

Assert duplicate flags, missing values, unknown flags, unknown subcommands, a missing/unknown/malformed case, and release SHA omission for preflight/execute/collect exit `1` with one stable `GOLDEN_ARGUMENT_*` code on stderr; an unknown selector is exactly `GOLDEN_ARGUMENT_CASE_UNKNOWN`, invokes no preflight port, and emits no JSON authority. `prepare-launch-operation-migration` requires each of its four pair fields exactly once; `resume-launch-operation-migration`, `launch-operation-migration-status`, and `verify-launch-operation-migration` accept only optional `--json`. All four reject campaign/case/run/release/root/path/source/tree/SQL/database/migration/digest/schema/force fields. Prepare emits only `{operationRef,operationHash}`, resume emits only `{receiptRef,receiptHash}`, status emits only the strict `GoldenLaunchOperationMigrationReleaseStatusV1` without advancing a locator, and verify emits only the strict `GoldenLaunchOperationMigrationCurrentVerificationV1`, including the immutable terminal pair plus fresh current source/tree/ancestry and dedicated-migration equality proof. `reconcile-timeout` requires exactly one campaign and one valid `--original-result-hash`, rejecting case/run/release/root/path/force flags; `finalize-report` rejects `--case`, `--run-id`, `--release-sha`, and `--finalization-hash`; `materialize-finalized-report` requires only one valid `--finalization-hash` and optional `--json`, rejecting campaign/case/run/release/path/root/content flags. Assert preflight admitted exits `0` and either nested blocked preflight branch exits `2`. Execute exits `2` after storing an honest outer `kind:"pre_run"` result only when its blocked preflight has an authenticated exact zero-owner observation; outer `kind:"blocked"` with unavailable or nonzero ownership exits `2` without storing a result. Outer `kind:"run"` accepted execute/collect exits `0`, every other started-run result exits `2`, a still-active timeout reconciliation exits `2` without a write, a valid terminal reconciliation exits `0`, privately finalized complete/blocked exits `0`, in-progress finalization exits `2`, verified materialization exits `0`, and receipt/source/build/report drift exits `2` with no tracked change. JSON output is one canonical migration operation/receipt/status/current-verification, outer execution outcome, preflight, timeout-supersession receipt, private-preview receipt, private finalization receipt, or materialization receipt followed by a newline; stderr never contains the prompt, admission token, fixture path, private root, env, or absolute path.

Verify preflight calls A's exact `resolveHistoricalBaselinePostHandoffReceiptV1()` once, then Task 2's exact zero-argument fresh-current migration verifier once, and leaves migration-prepare/resume plus fake admission/start/store/private-preview/source-build/private-finalization/materialization counters at zero. An unknown case fails before either call and every counter. A missing/corrupt/wrong-marker/ref/hash/nonancestor historical receipt returns the exact historical `blocked-before-authority` null-prefix branch; a missing/pending/corrupt/source- or schema-drifted migration release returns the exact release-stage branch with only historical authority. Neither can be replaced through dependencies or CLI flags. Verify execute dispatches its exact outer `GoldenCaseExecutionOutcomeV1`: store and preview `pre_run.result`, print `blocked.preflight` without a result-store write when ownership is nonzero/unavailable, or store and preview `run.result`. Collect may store only `GoldenStartedRunResultV1`, and repository/starter fakes reject a migration pair different from preflight/intent/start. Source-build/finalization/materialization counters remain zero. Verify `reconcile-timeout` rejects a `pre_run` original before mutation; for a run original it requires `originalTimeoutResult.observationDisposition === "nonterminal-timeout"`, calls only the bounded terminal reconciliation path, and passes the returned terminal run result plus immutable run-only supersession to one `putTimeoutReconciliationPair()` call. It then reloads atomically visible results and nominal committed-pair authorities for preview, with zero admission/start/authorization/lifecycle calls. Crash injection at every compound boundary either leaves only the original visible as `reconciliation_required` or exposes the terminal plus exact committed authority after final locator durability; pair/supersession files before that locator remain hidden. Retry returns the same pair/authority and a bare terminal `put()` or structural authority fails. Immediately run another preflight and prove no worktree dirtiness exists. Verify `finalize-report` reads both result branches plus bounded committed-pair authorities, resolves every pair/index/terminal/supersession relation, evaluates settlement and total global ownership, performs one Setfarm build followed by one Mission Control build, reinspects identical clean SHAs/total zero owners, and calls the private finalizer once only for `complete | blocked`; a lone configuration-failure pre-run result remains `in_progress`, advances no capacity/acceptance/terminal count, and causes no build. It never calls materialization and leaves `docs/review-packets` unchanged. Verify `materialize-finalized-report` loads only by hash, performs read-only source/build-artifact/report revalidation without constructing repository/platform/settlement/run ports or invoking `buildSource`, and calls the tracked materializer once. Claim-base SHA drift, Mission Control SHA drift, dirty source, build-artifact hash drift, migration-release drift, report-byte drift, unsafe target, or existing-different tracked bytes leaves the worktree unchanged.

Also run passing and blocked `preflight` with the trusted ``${runtimeConfig.setfarmDir}/internal-production`` data root and `.setfarm/evals/results` admission root absent. Assert default dependency construction plus command execution leaves every root absent, fixture/runtime/phase write counters zero, browser/process/socket counters zero, and `git status --porcelain --untracked-files=all` unchanged. Then run one execute and prove only the strategy-required validated data-root/admission descendants are created lazily. A test-only data-root port keeps this regression isolated from the live Setfarm directory; no production CLI flag can inject it.

- [ ] **Step 2: Run the CLI test and confirm failure**

Run:

```bash
node --import tsx --test tests/internal-production/golden-run-cli.test.ts
```

Expected: FAIL because the CLI module does not exist.

- [ ] **Step 3: Implement strict argv parsing and default port wiring**

Export this injection boundary for ordinary unit tests:

```typescript
export type GoldenRunCliDependencies = Readonly<{
  loadCampaign(file: string): Promise<LoadedGoldenCampaignV1>;
  createPorts(): Promise<GoldenHarnessPorts & Readonly<{ close(): Promise<void> }>>;
  prepareLaunchOperationMigration:
    typeof prepareGoldenLaunchOperationMigrationReleaseV1;
  resumeLaunchOperationMigration:
    typeof resumeActiveGoldenLaunchOperationMigrationReleaseV1;
  observeLaunchOperationMigrationStatus:
    typeof observeGoldenLaunchOperationMigrationReleaseStatusV1;
  verifyLaunchOperationMigration:
    typeof verifyCurrentGoldenLaunchOperationMigrationV1;
  store: GoldenRunResultStore;
  writePrivatePreview: typeof writePrivateGoldenCampaignPreviewV1;
  reconcileTimeout: typeof reconcileTimedOutGoldenRunV1;
  buildSource(): Promise<GoldenFinalizationSourceBuildV1>;
  finalizeReport: typeof finalizeGoldenCampaignReportV1;
  materializeFinalizedReport: typeof materializeFinalizedGoldenCampaignReportV1;
  stdout: Readonly<{ write(text: string): void }>;
  stderr: Readonly<{ write(text: string): void }>;
}>;

export async function runGoldenRunCli(
  argv: readonly string[],
  dependencies: GoldenRunCliDependencies,
): Promise<number>;
```

Use a strict parser that allows each required option once and `--json` once. Resolve the campaign through `loadGoldenCampaignV1`; never expose its task after hashing except to the starter. Create PostgreSQL with the same bounded settings as convergence:

```typescript
const sql = postgres(runtimeConfig.setfarmPgUrl, {
  max: 4,
  idle_timeout: 2,
  connect_timeout: 10,
  onnotice: () => {},
});
```

The four migration commands dispatch before any campaign load or harness-port construction. Production dependencies are the exact Task 2 exports without wrappers. Prepare first publishes/reopens the one fixed full pending record, then acquires A's shared owner-admission fence and creates the purpose authorization, operation, and active locator; it returns before guard consumption or apply. A lost response before pending visibility repeats prepare with the same exact input; every later loss uses zero-input resume, which reopens the fixed record and creates/adopts only the first absent fence/authorization/operation/active/consumption/apply/terminal/fence-release member. Resume receives no merge, guard, census, or fence argv/environment and never depends on shell-local state. Read-only status opens only fixed records and never advances them. Verify calls only zero-argument `verifyCurrentGoldenLaunchOperationMigrationV1()` after terminal visibility, proves the current descendant/source-specific migration invariants, and never performs recovery. No command constructs a generic migration repository or exposes the SQL connection.

Import the already-merged completion-owner receipt types/resolvers from prerequisite Task P0 only where the Setfarm-owned final handoff composes them; Task 7 neither shadows their types nor constructs a second store/producer/resolver.

Create only lazy factory objects for the runtime-artifact result store required by `createV3ReleaseAdmissionRepository` at the existing fixed `.setfarm/evals/results` root; do not initialize that root until V3 execute actually calls `createCanary`. Use the new lazy golden store only for strict golden result-union members and run-only timeout reconciliation pairs. Before constructing the production repository for preflight/execute/collect/reconciliation/finalization, call Task 2's zero-argument fresh current migration verifier and retain only its frozen terminal pair/current-verification projection; the repository and starter independently recompute it rather than trusting that retained object. Wire the fixed non-creating fixture resolver, `createUnavailableGoldenExistingRepositoryAttemptProvisioningPortV1()`, `createCanonicalGoldenRunLaunchLookupPort(repository, fixtures)`, `createCanonicalGoldenVerifierRuntimePort()`, `createGoldenCollectionPhaseStore()`, `createDefaultGoldenPreStartAuthorizationPort()`, `createUnavailableGoldenProductAssertionPort()`, and `createNoopGoldenLifecycleCheckpointPort()` in the B-only default ports; their factories derive fixed paths and create no files/directories/processes/sockets. The harness imports and calls A's exact fixed `resolveHistoricalBaselinePostHandoffReceiptV1()` and Task 2's exact fixed `verifyCurrentGoldenLaunchOperationMigrationV1()` directly; `GoldenRunCliDependencies`, `GoldenHarnessPorts`, argv, and environment expose no baseline or migration verifier/receipt/path/current-service override outside the four exact migration commands. Subproject C replaces the unavailable assertion port, the unavailable existing-repository attempt port, and, only for repair retries, the pre-start authorization port with its authenticated profile, fresh-attempt, and repair-CAS adapters; it consumes B's unchanged authenticated live-runtime, persisted-intent, template, and fixture-capability signatures only after the terminal release verifier passes. No B CLI/dependency object accepts a D lifecycle port or capability; D wraps its enumerated recovery action through B's capability factory and passes only that opaque value to C's recovery executor. Wire `repository.close()` in `finally`. All harness commands resolve the case argument before constructing a preflight port. `preflight` then constructs exactly `GoldenPreflightPorts`; `execute` calls `executeGoldenCaseV1` and exhaustively dispatches the exact outer `pre_run | run | blocked`, accessing results only through `.result` and preflight only through `.preflight`; `collect` constructs exactly the nested read/action `GoldenCollectionPorts` object and calls `collectGoldenCaseV1` without a spread/cast/full harness object, receiving only a started-run result. `reconcile-timeout` first requires a stored started-run timeout with the exact scalar disposition, calls `reconcileTimedOutGoldenRunV1`, passes its terminal result and supersession to exactly one `putTimeoutReconciliationPair()` call, and cannot construct start/authorization/lifecycle ports. After any stored execute/collect/reconcile result, read all atomically visible indexed campaign results and call `listCommittedTimeoutReconciliationPairAuthorities(campaignHash)`; authenticate and resolve those authorities rather than loading a bare supersession array, inspect platform ownership read-only, evaluate `evaluateGoldenCampaignSettlementV1`, and call only `writePrivateGoldenCampaignPreviewV1` with results plus `timeoutReconciliations` and that settlement. Outer `blocked` prints its strict nested preflight and performs neither store nor preview mutation.

`finalize-report` performs no run start, admission creation, fixture mutation, project sync, lifecycle checkpoint, product assertion, verifier-runtime action, browser action, or tracked write. It accepts no epoch flag. It loads the campaign/results plus bounded committed timeout-pair authorities through the store's exact index and resolver, calls `repository.inspectPlatform()`, and calls `release.inspect({ workflowId })` once for each distinct campaign workflow ID. Derive a provisional epoch from the exact clean pre-build Setfarm/Mission Control SHAs and evaluate the policy; exit `2` for `in_progress` before building. For `complete | blocked`, call `buildSource()` once, then repeat release/platform inspection, require unchanged clean SHAs/build identities/zero owners, derive the authoritative final epoch from those post-build SHAs, and reevaluate settlement with that exact epoch. Construct `GoldenFinalizationSourceCleanlinessV1` and call `finalizeGoldenCampaignReportV1({ campaign, campaignHash, finalReleaseEpoch, results, timeoutReconciliations, settlement, platform:postBuildPlatform, sourceCleanliness })` only when the two epoch hashes and settlement bytes agree. It prints the content-addressed finalization hash/ref and leaves every worktree unchanged.

`materialize-finalized-report` constructs no database, repository, admission, fixture, harness, project, projection, cleanup, lifecycle, assertion, runtime, result-store, preview, settlement, or source-build runner port. It parses the sole hash, calls `materializeFinalizedGoldenCampaignReportV1(hash)`, and outputs the bounded materialization receipt. The materializer internally performs only private-receipt/report reads, read-only source/build-artifact verification, and the one exact tracked write described in Task 6. This is the sole production call site for tracked report creation.

The production `buildSource()` dependency is exactly Task 3's `buildCanonicalInternalProductionSourcesV1()` and returns Task 3's `GoldenFinalizationSourceBuildV1`; Task 7 defines no second builder or lookalike type. It has no caller-selected cwd, executable, args, environment, or output path. Its bounded stdout/stderr are hashed and discarded; neither enters the receipt or report.

Print a bounded non-JSON summary with campaign/case, run identity when present, actual workflow/protocol/version, classification, result hash/ref, private-preview ref/hash, private finalization hash/ref, or materialized repository-relative target/hash, and exact external-distribution blocked state. Never print the raw task, fixture path, or private root.

- [ ] **Step 4: Add package scripts and full-test inclusion**

Add:

```json
"internal:golden": "node --import tsx src/internal-production/golden-run-cli.ts",
"test:internal-production": "node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test tests/internal-production/*.test.ts"
```

The `internal:golden` command table additionally routes exactly these B controller forms, both with no option other than `--json`:

```text
activate-owner-producer-manifest --json
owner-producer-manifest-status --json
```

The first delegates only to `activateGoldenRunOwnerProducerManifestV1()` and returns its strict wrapper receipt; the second delegates only to `observeGoldenRunOwnerProducerManifestActivationStatusV1()` and returns its strict status. Unknown argv, a plan/manifest/predecessor/pair/root/path/source/build override, or a second command after `--json` fails before any controller read or mutation.

Append `&& npm run test:internal-production` to the existing `test` script after `npm run test:evals`. Do not reorder or remove existing suites.

- [ ] **Step 5: Run focused CLI and package verification**

Run:

```bash
set -euo pipefail
npm run test:internal-production
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
git diff --check
```

Expected: tests and static checks exit `0`. Do not run a real preflight from the implementation claim: Task 8 runs it only inside a Setfarm-issued synchronized clean-main verification claim with the fail-fast guards below.

- [ ] **Step 6: Record the Task 7 Setfarm handoff checkpoint**

Run `git status --short` and `git diff --check`, verify the exact Task 7 scope, and return the file list plus focused/static/preflight evidence to the active Setfarm claim. Do not stage or commit.

---

### Task 8: Verify the completed harness and perform the clean-main handoff

**Files:**
- Verify only: every file in the File Map
- Generated only later by a Setfarm-owned docs claim consuming a private finalization hash: the template path ``docs/review-packets/${campaignDate}-${campaignId}-golden-run-report.md``

**Interfaces:**
- Consumes: all prior task outputs.
- Consumes from prerequisite Task P0's separately reviewed, already merged, and canonical-main-built `src/internal-production/setfarm-completion-owner-receipts-v1.ts`: `SetfarmCompletionOwnerCommittedPrHeadReceiptV1`, `resolveSetfarmCompletionOwnerCommittedPrHeadReceiptV1({receiptRef,receiptHash})`, `SetfarmCompletionOwnerMergeReceiptV1`, and `resolveSetfarmCompletionOwnerMergeReceiptV1({receiptRef,receiptHash})` exactly as repeated below. The orchestration layer passes only resolver-returned immutable fields into the Step 6/7 command environment; a caller JSON object or individual scalar override is never accepted. Step 5 is unavailable unless the current main B claim's base contains the exact existing-owner-proven bootstrap merge SHA and the Task P0 module/test remained unchanged through Tasks 1–7.
- Produces: one reviewed, clean Setfarm change whose source tests pass, followed only after its merge/build and before any B producer by B's durable path-free `A+B` controller wrapper receipt/status binding the A predecessor and A+B successor activation/head pairs; no live golden run is part of this implementation-plan verification.
- Handoff boundary: the agent returns verified source evidence to Setfarm. Setfarm alone may commit the scoped change, publish/update the PR, merge it, synchronize clean main, and issue a separate clean-main verification claim.

```ts
export type SetfarmCompletionOwnerCommittedPrHeadReceiptV1 = Readonly<{
  schema: "setfarm.completion-owner-committed-pr-head-receipt.v1";
  bootstrapActivationReceiptRef: CanonicalRef;
  bootstrapActivationReceiptHash: string;
  bootstrapMergeSha: string;
  bootstrapTreeHash: string;
  claimId: string;
  claimWorktreeIdentityHash: string;
  repository: "hikmetgulsesli/setfarm";
  prNumber: number;
  prUrl: string;
  baseRefName: "main";
  baseSha: string;
  headRefName: string;
  committedPrHeadSha: string;
  committedTreeHash: string;
  changedPathSetHash: string;
  binaryDiffHash: string;
  claimContentHash: string;
  receiptRef: CanonicalRef;
  receiptHash: string;
}>;

export function resolveSetfarmCompletionOwnerCommittedPrHeadReceiptV1(
  input: Readonly<{ receiptRef: CanonicalRef; receiptHash: string }>,
): Promise<SetfarmCompletionOwnerCommittedPrHeadReceiptV1>;

export type SetfarmCompletionOwnerMergeReceiptV1 = Readonly<{
  schema: "setfarm.completion-owner-merge-receipt.v1";
  bootstrapActivationReceiptRef: CanonicalRef;
  bootstrapActivationReceiptHash: string;
  bootstrapMergeSha: string;
  bootstrapTreeHash: string;
  repository: "hikmetgulsesli/setfarm";
  prNumber: number;
  prHeadSha: string;
  prHeadTreeHash: string;
  baseRefName: "main";
  baseSha: string;
  mergeMethod: "merge" | "squash" | "rebase";
  mergeSha: string;
  mergeTreeHash: string;
  receiptRef: CanonicalRef;
  receiptHash: string;
}>;

export function resolveSetfarmCompletionOwnerMergeReceiptV1(
  input: Readonly<{ receiptRef: CanonicalRef; receiptHash: string }>,
): Promise<SetfarmCompletionOwnerMergeReceiptV1>;
```

Both resolvers accept only their canonical ref/hash pair, open the fixed completion-owner content-addressed store with the existing no-follow bounded receipt protocol, strict-parse every member, recompute the hash over every field except `receiptRef`/`receiptHash`, require the canonical ref derived from that hash, recursively freeze the result, and reject caller bodies, paths, roots, environments, field overrides, unknown members, or structural clones. Each resolver freshly reopens P0's exact activation ref/hash, requires both receipts to repeat it byte-for-byte, requires their bootstrap merge/tree to equal that activation, and proves `bootstrapMergeSha` is an ancestor of `baseSha`, PR head, and merge SHA through the same fresh Git-object authority used for the receipt. Require positive safe-integer `prNumber`; one literal repository; normalized bounded `headRefName`; and exact PR URL derivation. Parse every Git commit/tree identity—`bootstrapMergeSha`, `bootstrapTreeHash`, `baseSha`, `committedPrHeadSha`, `committedTreeHash`, `prHeadSha`, `prHeadTreeHash`, `mergeSha`, and `mergeTreeHash`—through the existing `GitObjectHashSchema`, which accepts only lowercase 40- or 64-hex Git object IDs. Parse activation/claim/worktree/changed-path/binary-diff/content/receipt hashes through `Sha256Schema`, which accepts only lowercase 64-hex evidence identities. Require `baseSha` equal to the Step 4 base and the merge receipt's bootstrap/activation/PR/head/tree fields equal to the accepted committed-PR-head receipt. Schema tests accept both Git widths and the exact evidence width; reject uppercase, nonhex, or every width other than 40/64 for Git identities and 64 for evidence identities; and prove that changing any field invalidates its canonical receipt hash or required source/equality relation. They do not claim that two otherwise valid 64-hex values carry distinguishable provenance merely because they occupy Git-object versus evidence fields. These are the only new public handoff contracts.

- [ ] **Step 1: Run focused and adjacent suites**

Run:

```bash
set -euo pipefail
npm run test:internal-production
npm run test:evals
npm run test:evidence
npm run test:execution-attempts
npm run test:product-compiler
npm run test:steps
node --import tsx --test tests/run-operational-snapshot.test.ts
```

Expected: every command exits `0` with no live-service or live-DB access.

- [ ] **Step 2: Run repository static contracts and the full suite**

Run:

```bash
set -euo pipefail
npx tsc -p tsconfig.json --noEmit
npm run check:english
npm run check:paths
npm run check:migration-digests
npm run check:mission-control-contracts
npm test
git diff --check
```

Expected: every command exits `0`.

The Task 8 source/transcript test enumerates every Task 8 Bash fence and requires literal `set -euo pipefail` as its first nonblank command. It injects nonzero exit into each Step 1 and Step 2 command at the first, middle, and last positions and proves the next suite/static command is never invoked; focused/full success is emitted only after every enumerated command ran once and returned zero, so a later success cannot mask an earlier failure. It requires the exact `main`, empty-full-porcelain, and `HEAD === refs/remotes/origin/main` guards contiguously before every post-merge build or operational migration command, then repeats them after the build, before prepare, before resume, after apply, and immediately before preflight. The uncommitted Step 4 handoff is read-only claim/diff evidence and returns only the claim's base SHA, never a new source SHA. The transcript must order: uncommitted evidence handoff; strict Setfarm completion-owner receipt resolution and commit/push; exact receipt-bound PR JSON/tree/check/review-thread assertions; strict owner merge-receipt resolution plus canonical-main synchronization; clean-main source snapshot and build; fresh A zero-owner guard; durable B fixed full pending record; A global owner-admission fence; A purpose authorization; durable application-source/tree/migration-bound operation/active locator; fresh zero fence reobservation; zero-input resume and A-owned consumption; second adjacent zero fence reobservation and apply; terminal reopen; fence release; independent fresh terminal plus current-descendant/schema verification; repository gate; only then preflight. It rejects any pre-merge clean-main equality assertion, build, migration prepare/resume, repository construction, preflight, C/runtime use, or claim that the uncommitted `HEAD` is the PR head. Fail each Step 4/6/7/8 command, command substitution, `jq` predicate, `gh` call, review-thread completeness/resolution check, branch/status/ref/SHA/tree/build/guard/fence/operation/receipt/schema guard, and pipeline in turn and prove no later receipt acceptance, merge authorization, build, database apply, repository/start/preflight construction, redirect, receipt publication, or mutation counter advances. Crash and response-loss fixtures at every release boundary use the fixed pending record, adopt only its fence/authorization/operation/consumption/terminal/release chain, and never require a shell-local guard, mint another guard/operation, or accept a structural receipt. Where a compiled operation owns a one-use capability, tests pass only its exact canonical ref/hash to the internal resolver and prove CAS consumption precedes the first side effect; ref-only, hash-only, replayed, or mismatched pairs mutate nothing.

- [ ] **Step 3: Perform an independent review before integration**

Use `superpowers:requesting-code-review`. The reviewer must inspect these specific boundaries:

- no direct `runWorkflow()` call or runtime/dirty guard bypass;
- one selected case and one start per execute invocation; exactly one admission slot for V3 and no admission for existing-repository workflow;
- one path-free fsynced logical intent, one post-provision full-task/pre-start execution binding, and one fsynced authenticated starter outbox operation; every execute recovery resumes only that idempotent operation, while collect remains lookup-only;
- strict start-strategy dispatch: feature-dev is exact admitted V3, while bug-fix/security-audit starts from an immutable campaign template through one persisted-intent-bound fresh fixture attempt and records its actual DB protocol/version without relabeling;
- V3 operational failure identity retained and trusted over prose;
- the launch-operation schema has one SQL/projection owner; its named digest entry and durable release chain bind the reviewed owner merge/application source/tree/dedicated migration projection, exact A baseline migration, and A-purpose authorization/consumption; crash recovery starts from one fixed pending input and adopts one operation; and repository, starter, preflight, and C runtime are impossible before the freshly verified terminal receipt;
- read-only collector with no lifecycle mutation SQL;
- no selector token, raw prompt, path, artifact body, screenshot, log, env, or secret in receipts/reports/CLI output;
- the fixture manifest hash binds seed kind/hash, immutable baseline origin/remote main, strict contained mutable paths, and exact code-owned pre/post command IDs; pre-start checks current remote equals baseline without fetching, while post-run remote equality comes only from authenticated integration evidence;
- the internal `GoldenAssertionSubjectV1` binds verified repository/source/invocation/runtime authority, is passed to `GoldenProductAssertionPort` after canonical collection and before classification, and no absolute capability path reaches public evidence;
- HTTP/browser product assertions execute only inside B's authenticated live verifier lease; B proves exact stop/release and re-collects cleanup before classification, and adapters own no process/port lifecycle;
- verifier process identity is durably provisional before readiness/listener observation, and tuple-keyed `reconcileLogicalLease` repairs exact missing lease/release phases—including durability generation two—before any acquire/rejoin/restart/release;
- the phase journal resumes only its exact hash-chained run/release/action phase, never replays a persisted assertion set, and fails closed on registry/phase conflict or corrupt, ambiguous, stale, cross-run state;
- adapter errors produce a complete typed unavailable assertion set and a valid release successor; every passing assertion has at least one evidence ref;
- a nonterminal deadline uses only the timeout-evidence branch, never product/runtime/render actions or fabricated zero cleanup, and cannot settle a campaign;
- preflight constructs no root, file, admission, phase, lease, browser, process, socket, or DB row when all fixed roots are absent;
- private result/phase/preview/finalization/fixture state resolves only below the real contained mode-`0700` `runtimeConfig.setfarmDir/internal-production` root shared across Setfarm worktrees;
- private finalization dispatches on the immutable standard/fleet settlement policy; fleet acceptance/classification counts come only from exactly ten current-epoch terminal distinct results with at least eight accepted and only enumerated non-accepted outcomes, while cleanup must be exact for every current and historical effective started-run result, with zero current-epoch systemic classifications and zero global owners;
- optional lifecycle action is run/generation/predicate/nullable-operation bound, durably reconcilable by C/D, and persisted as `lifecycle-action-recorded` before observation; it never runs from `collect` or causes another start;
- Node CLI assertions use only canonical JSONL success with empty stderr/exit `0` and exact `TITLE_REQUIRED\n` stderr with empty stdout/exit `2`;
- exact settlement and cleanup gates before `accepted`;
- Mission Control mismatch cannot mask a Setfarm failure;
- three-repeat systemic stop counts one exact hash per selected effective mapping/subject, never both timeout and replacement;
- source/build authority hashes only stable role/root/common-dir/package/remote/literal-main/equal source-HEAD-local-origin-main-fresh-remote-main SHA/semantic-output identity, survives a fresh unique same-role process and same-SHA exact-remote-main `builtAt` rebuild, and rejects every branch, stale local tracking ref, fresh remote-head, ambiguous remote-output, or nonvolatile drift;
- docs-session begin requires the clean base, exact order/safe path/hash entries, and an empty six-target prefix; only its live WeakMap capability advances, while a fresh process or second begin cannot adopt even an exact prefix. E dry-verifies entries and each B/D/E owner reopens its own receipt at write time. Standalone materialization remains the sole one-file CLI tracked writer;
- external production authority remains false and blocked.

Resolve every Critical, High, and Medium finding with a focused regression and rerun the affected focused plus adjacent suites. Do not weaken a gate to satisfy review.

- [ ] **Step 4: Return uncommitted claim and diff evidence to Setfarm**

Run:

```bash
set -euo pipefail
git status --short --branch
git diff --check
git diff --stat
git rev-parse HEAD
git diff --binary --no-ext-diff | shasum -a 256
git status --porcelain=v1 --untracked-files=all
```

Return the exact claim ID, claim-worktree identity hash, `baseSha` from `git rev-parse HEAD`, sorted changed-file list, diff stat, exact binary-diff SHA-256, Setfarm's bounded regular-file/mode `claimContentHash`, verification commands/results, and independent-review disposition. This is evidence for an uncommitted claim: `baseSha` remains the pre-change Git commit and is not a source-handoff, commit, or PR-head SHA. Do not stage, commit, push, switch branches, or create/update a PR. Setfarm validates the scoped content and its claim authority before owning every Git mutation.

- [ ] **Step 5: Accept Setfarm's completion-owner committed PR-head receipt**

Setfarm's completion owner alone stages the exact Step 4 changed-file/content projection, commits it, pushes one PR branch, and returns only `{receiptRef,receiptHash}`. Call `resolveSetfarmCompletionOwnerCommittedPrHeadReceiptV1({receiptRef,receiptHash})`; accept only its strict recursively frozen `SetfarmCompletionOwnerCommittedPrHeadReceiptV1` binding P0's activation ref/hash and bootstrap merge/tree, the original claim ID/worktree identity, literal repository, positive PR number, exact PR URL, literal `main` base ref, `baseSha`, normalized head ref, `committedPrHeadSha`, committed tree hash, changed-path-set hash, binary-diff hash, and `claimContentHash`. Require the activation receipt to reopen, the bootstrap merge to be an ancestor of base/head, and the committed tree to reproduce the Step 4 path/mode/content projection exactly. A missing/corrupt/wrong-ref/hash/activation receipt, structural clone, changed bootstrap/ancestry/path/mode/byte/base/tree/claim/repository/branch/PR/SHA relation, unknown member, or noncanonical URL blocks before any Step 6 command.

Expected: the receipt resolves to one exact committed PR head. This step performs no `main === origin/main` assertion, canonical source snapshot, build, preflight, service check, merge, push, or PR mutation. The committed PR-head SHA is authority only for Steps 5–6; it becomes canonical source authority only after Setfarm's later merge receipt and synchronized-main claim.

- [ ] **Step 6: Inspect the Setfarm-published source PR read-only**

The completion-owner controller must freshly resolve Step 5's same ref/hash immediately before this fence and populate the read-only `SETFARM_RECEIPT_*` variables from that frozen object as one indivisible environment; shell/caller overrides are forbidden. Inspect without mutation:

```bash
set -euo pipefail
test "$SETFARM_RECEIPT_REPOSITORY" = "hikmetgulsesli/setfarm"
test "$SETFARM_RECEIPT_BASE_REF_NAME" = "main"
receipt_owner="${SETFARM_RECEIPT_REPOSITORY%%/*}"
receipt_name="${SETFARM_RECEIPT_REPOSITORY#*/}"
test "$receipt_owner/$receipt_name" = "$SETFARM_RECEIPT_REPOSITORY"
pr_json="$(
  gh pr view "$SETFARM_RECEIPT_PR_NUMBER" \
    --repo "$SETFARM_RECEIPT_REPOSITORY" \
    --json number,url,state,isDraft,mergeable,reviewDecision,statusCheckRollup,headRefName,headRefOid,baseRefName,baseRefOid
)"
jq -e \
  --argjson prNumber "$SETFARM_RECEIPT_PR_NUMBER" \
  --arg prUrl "$SETFARM_RECEIPT_PR_URL" \
  --arg baseRefName "$SETFARM_RECEIPT_BASE_REF_NAME" \
  --arg baseSha "$SETFARM_RECEIPT_BASE_SHA" \
  --arg headRefName "$SETFARM_RECEIPT_HEAD_REF_NAME" \
  --arg headSha "$SETFARM_RECEIPT_HEAD_SHA" \
  '.number == $prNumber
   and .url == $prUrl
   and .state == "OPEN"
   and .isDraft == false
   and .mergeable == "MERGEABLE"
   and .reviewDecision == "APPROVED"
   and .baseRefName == $baseRefName
   and .baseRefOid == $baseSha
   and .headRefName == $headRefName
   and .headRefOid == $headSha' <<<"$pr_json"
gh pr checks "$SETFARM_RECEIPT_PR_NUMBER" \
  --repo "$SETFARM_RECEIPT_REPOSITORY" \
  --required
observed_tree_sha="$(
  gh api "repos/$SETFARM_RECEIPT_REPOSITORY/git/commits/$SETFARM_RECEIPT_HEAD_SHA" \
    --jq '.tree.sha'
)"
test "$observed_tree_sha" = "$SETFARM_RECEIPT_HEAD_TREE_HASH"
threads_json="$(
  gh api graphql \
    -f 'query=query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){nodes{id isResolved isOutdated}pageInfo{hasNextPage}}}}}' \
    -F owner="$receipt_owner" \
    -F name="$receipt_name" \
    -F number="$SETFARM_RECEIPT_PR_NUMBER"
)"
jq -e \
  '.data.repository.pullRequest != null
   and .data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage == false
   and all(.data.repository.pullRequest.reviewThreads.nodes[];
     .isResolved == true or .isOutdated == true)' <<<"$threads_json"
```

Expected: every command and predicate exits `0`; the repository, PR number/URL, literal base ref and `baseRefOid`, head ref and `headRefOid`, and Git commit tree equal the exact resolver-returned receipt; the PR is open, non-draft, mergeable, approved; every required check is successful rather than pending; the review-thread query is complete and has no unresolved non-outdated thread. A failed/empty/malformed `gh` response, failed/pending/missing required check, paginated thread set, unresolved thread, receipt mismatch, or any `jq`/`test` failure stops this fence immediately and authorizes no merge or later acceptance. Do not infer resolution from flat comments. If a source change is needed, return findings to Setfarm for a new scoped claim and repeat Steps 4–6 with a new completion-owner receipt. Do not publish, push, mark ready, merge, build, preflight, or claim clean canonical main from an agent.

- [ ] **Step 7: Accept Setfarm's merge receipt and verify clean main read-only**

After Setfarm supplies only the merge receipt's canonical `{receiptRef,receiptHash}` pair and a new clean-main verification claim, call `resolveSetfarmCompletionOwnerMergeReceiptV1({receiptRef,receiptHash})`. Require its strict frozen bootstrap activation pair, bootstrap merge/tree, repository, PR, head, and tree fields to equal the exact accepted Step 5 receipt and require that bootstrap merge to remain an ancestor of the merge SHA before the orchestration layer populates one indivisible read-only `SETFARM_MERGE_RECEIPT_*` environment. Then run only:

```bash
set -euo pipefail
test -n "$SETFARM_MERGE_RECEIPT_REF"
printf '%s\n' "$SETFARM_MERGE_RECEIPT_HASH" | rg -x '[0-9a-f]{64}'
test "$SETFARM_MERGE_RECEIPT_REPOSITORY" = "hikmetgulsesli/setfarm"
test "$SETFARM_MERGE_RECEIPT_BASE_REF_NAME" = "main"
task8_merge_branch="$(git branch --show-current)"
test "$task8_merge_branch" = "main"
task8_pr_head_status="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$task8_pr_head_status"
head_sha="$(git rev-parse HEAD)"
origin_main_sha="$(git rev-parse refs/remotes/origin/main)"
head_tree_hash="$(git rev-parse 'HEAD^{tree}')"
test "$head_sha" = "$origin_main_sha"
test "$head_sha" = "$SETFARM_MERGE_RECEIPT_MERGE_SHA"
test "$head_tree_hash" = "$SETFARM_MERGE_RECEIPT_MERGE_TREE_HASH"
printf '%s\n' "$head_sha"
```

Expected: every command exits `0`; in this single fail-fast fence the branch is literal `main`, full porcelain including untracked files is empty, and `HEAD === refs/remotes/origin/main === mergeSha` with the exact merge tree from the resolved owner receipt. A missing/corrupt/wrong-ref/hash/PR/head/tree receipt, caller scalar override, branch/dirt/remote/SHA/tree mismatch, or failed command blocks Step 8 and every acceptance claim. If blocked, return the mismatch to Setfarm; do not switch, fetch, pull, reset, merge, build, or preflight locally.

- [ ] **Step 8: Guardedly release the launch-operation migration, then prove clean-main preflight without starting a run**

On synchronized clean `main`, after Subproject A is confirmed complete, first run B's executable zero-input A11-to-A+B21 controller—not the generic store directly. The shell below runs it immediately after the reviewed merge's clean build and before any B migration release, guard, SQL/write, launch intent, outbox, run, process, worktree, or delivery producer. It accepts only its code-owned A/B literal manifests, current clean source/build authority, and freshly re-hashed A predecessor tuple; it returns a strict B wrapper receipt, then read-only status proves the same predecessor activation/head quartet and successor activation/head quartet. This is the first time B activation is legal: the reviewed B merge/source from Step 7 now exists. It is not an import side effect, a `void` call, a mutable registration, or a scan for C/D/E source. Equal response-loss replay adopts the same durable wrapper receipt; a stale/forked or receipt/head-mixed current tuple, missing B call site, wrong cardinality, or projection/source drift blocks before the release coordinator. The only database mutation after this gate is inside `resume-launch-operation-migration`; no shell command runs SQL or a generic migration apply:

```bash
set -euo pipefail
task8_postsync_branch="$(git branch --show-current)"
test "$task8_postsync_branch" = "main"
task8_postsync_status="$(git status --porcelain --untracked-files=all)"
test -z "$task8_postsync_status"
task8_postsync_head="$(git rev-parse HEAD)"
task8_postsync_origin_main="$(git rev-parse refs/remotes/origin/main)"
test "$task8_postsync_head" = "$task8_postsync_origin_main"
npm run build
task8_posttest_branch="$(git branch --show-current)"
test "$task8_posttest_branch" = "main"
task8_posttest_status="$(git status --porcelain --untracked-files=all)"
test -z "$task8_posttest_status"
task8_posttest_head="$(git rev-parse HEAD)"
task8_posttest_origin_main="$(git rev-parse refs/remotes/origin/main)"
test "$task8_posttest_head" = "$task8_posttest_origin_main"
test "$task8_posttest_head" = "$SETFARM_MERGE_RECEIPT_MERGE_SHA"
task8_posttest_tree="$(git rev-parse 'HEAD^{tree}')"
test "$task8_posttest_tree" = "$SETFARM_MERGE_RECEIPT_MERGE_TREE_HASH"
task8_posttest_build_sha="$(jq -er '.sha' dist/BUILD_INFO.json)"
test "$task8_posttest_build_sha" = "$task8_posttest_head"
task8_manifest_activation_json="$(npm run --silent internal:golden -- \
  activate-owner-producer-manifest --json)"
task8_manifest_receipt_ref="$(printf '%s\n' "$task8_manifest_activation_json" | jq -er '.receiptRef')"
task8_manifest_receipt_hash="$(printf '%s\n' "$task8_manifest_activation_json" | jq -er '.receiptHash')"
task8_manifest_predecessor_activation_ref="$(printf '%s\n' "$task8_manifest_activation_json" | jq -er '.predecessorActivationRef')"
task8_manifest_predecessor_activation_hash="$(printf '%s\n' "$task8_manifest_activation_json" | jq -er '.predecessorActivationHash')"
task8_manifest_predecessor_head_ref="$(printf '%s\n' "$task8_manifest_activation_json" | jq -er '.predecessorHeadRef')"
task8_manifest_predecessor_head_hash="$(printf '%s\n' "$task8_manifest_activation_json" | jq -er '.predecessorHeadHash')"
task8_manifest_successor_activation_ref="$(printf '%s\n' "$task8_manifest_activation_json" | jq -er '.successorActivationRef')"
task8_manifest_successor_activation_hash="$(printf '%s\n' "$task8_manifest_activation_json" | jq -er '.successorActivationHash')"
task8_manifest_successor_head_ref="$(printf '%s\n' "$task8_manifest_activation_json" | jq -er '.successorHeadRef')"
task8_manifest_successor_head_hash="$(printf '%s\n' "$task8_manifest_activation_json" | jq -er '.successorHeadHash')"
printf '%s\n' "$task8_manifest_activation_json" | jq -e '
  .schema == "setfarm.internal-production-golden-run-owner-producer-manifest-activation.v1" and
  .plan == "B" and
  (.manifestHashes | type == "array" and length == 2) and
  (.sourceBuildAuthorityRef | type == "string") and
  (.sourceBuildAuthorityHash | test("^[0-9a-f]{64}$"))
' >/dev/null
task8_manifest_status_json="$(npm run --silent internal:golden -- \
  owner-producer-manifest-status --json)"
task8_manifest_status_receipt_ref="$(printf '%s\n' "$task8_manifest_status_json" | jq -er '.receiptRef')"
task8_manifest_status_receipt_hash="$(printf '%s\n' "$task8_manifest_status_json" | jq -er '.receiptHash')"
task8_manifest_status_predecessor_activation_ref="$(printf '%s\n' "$task8_manifest_status_json" | jq -er '.predecessorActivationRef')"
task8_manifest_status_predecessor_activation_hash="$(printf '%s\n' "$task8_manifest_status_json" | jq -er '.predecessorActivationHash')"
task8_manifest_status_predecessor_head_ref="$(printf '%s\n' "$task8_manifest_status_json" | jq -er '.predecessorHeadRef')"
task8_manifest_status_predecessor_head_hash="$(printf '%s\n' "$task8_manifest_status_json" | jq -er '.predecessorHeadHash')"
task8_manifest_status_successor_activation_ref="$(printf '%s\n' "$task8_manifest_status_json" | jq -er '.successorActivationRef')"
task8_manifest_status_successor_activation_hash="$(printf '%s\n' "$task8_manifest_status_json" | jq -er '.successorActivationHash')"
task8_manifest_status_successor_head_ref="$(printf '%s\n' "$task8_manifest_status_json" | jq -er '.successorHeadRef')"
task8_manifest_status_successor_head_hash="$(printf '%s\n' "$task8_manifest_status_json" | jq -er '.successorHeadHash')"
test "$task8_manifest_status_receipt_ref" = "$task8_manifest_receipt_ref"
test "$task8_manifest_status_receipt_hash" = "$task8_manifest_receipt_hash"
test "$task8_manifest_status_predecessor_activation_ref" = "$task8_manifest_predecessor_activation_ref"
test "$task8_manifest_status_predecessor_activation_hash" = "$task8_manifest_predecessor_activation_hash"
test "$task8_manifest_status_predecessor_head_ref" = "$task8_manifest_predecessor_head_ref"
test "$task8_manifest_status_predecessor_head_hash" = "$task8_manifest_predecessor_head_hash"
test "$task8_manifest_status_successor_activation_ref" = "$task8_manifest_successor_activation_ref"
test "$task8_manifest_status_successor_activation_hash" = "$task8_manifest_successor_activation_hash"
test "$task8_manifest_status_successor_head_ref" = "$task8_manifest_successor_head_ref"
test "$task8_manifest_status_successor_head_hash" = "$task8_manifest_successor_head_hash"
printf '%s\n' "$task8_manifest_status_json" | jq -e '
  .schema == "setfarm.internal-production-golden-run-owner-producer-manifest-activation-status.v1" and
  .state == "active" and
  (.statusHash | test("^[0-9a-f]{64}$"))
' >/dev/null
task8_migration_guard_json="$(npm run --silent acceptance:baseline-post-handoff -- zero-owner --json)"
task8_migration_guard_ref="$(printf '%s\n' "$task8_migration_guard_json" | jq -er '.guardRef')"
task8_migration_guard_hash="$(printf '%s\n' "$task8_migration_guard_json" | jq -er '.guardHash')"
task8_preprepare_branch="$(git branch --show-current)"
test "$task8_preprepare_branch" = "main"
task8_preprepare_status="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$task8_preprepare_status"
task8_preprepare_head="$(git rev-parse HEAD)"
task8_preprepare_origin="$(git rev-parse refs/remotes/origin/main)"
test "$task8_preprepare_head" = "$task8_preprepare_origin"
test "$task8_preprepare_head" = "$SETFARM_MERGE_RECEIPT_MERGE_SHA"
task8_migration_operation_json="$(node dist/internal-production/golden-run-cli.js \
  prepare-launch-operation-migration \
  --source-merge-ref "$SETFARM_MERGE_RECEIPT_REF" \
  --source-merge-hash "$SETFARM_MERGE_RECEIPT_HASH" \
  --zero-owner-guard-ref "$task8_migration_guard_ref" \
  --zero-owner-guard-hash "$task8_migration_guard_hash" \
  --json)"
task8_migration_operation_keys="$(printf '%s\n' "$task8_migration_operation_json" | jq -cer 'keys')"
test "$task8_migration_operation_keys" = '["operationHash","operationRef"]'
task8_migration_operation_ref="$(printf '%s\n' "$task8_migration_operation_json" | jq -er '.operationRef')"
task8_migration_operation_hash="$(printf '%s\n' "$task8_migration_operation_json" | jq -er '.operationHash')"
task8_migration_pre_resume_status="$(node dist/internal-production/golden-run-cli.js \
  launch-operation-migration-status --json)"
printf '%s\n' "$task8_migration_pre_resume_status" | jq -e \
  --arg operationRef "$task8_migration_operation_ref" \
  --arg operationHash "$task8_migration_operation_hash" '
  .state == "prepared" and
  .operationRef == $operationRef and .operationHash == $operationHash and
  .receiptRef == null and .receiptHash == null
' >/dev/null
task8_preresume_branch="$(git branch --show-current)"
test "$task8_preresume_branch" = "main"
task8_preresume_status="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$task8_preresume_status"
task8_preresume_head="$(git rev-parse HEAD)"
task8_preresume_origin="$(git rev-parse refs/remotes/origin/main)"
test "$task8_preresume_head" = "$task8_preresume_origin"
test "$task8_preresume_head" = "$SETFARM_MERGE_RECEIPT_MERGE_SHA"
task8_migration_receipt_pair_json="$(node dist/internal-production/golden-run-cli.js \
  resume-launch-operation-migration --json)"
task8_migration_receipt_pair_keys="$(printf '%s\n' "$task8_migration_receipt_pair_json" | jq -cer 'keys')"
test "$task8_migration_receipt_pair_keys" = '["receiptHash","receiptRef"]'
task8_migration_receipt_ref="$(printf '%s\n' "$task8_migration_receipt_pair_json" | jq -er '.receiptRef')"
task8_migration_receipt_hash="$(printf '%s\n' "$task8_migration_receipt_pair_json" | jq -er '.receiptHash')"
task8_postmigration_branch="$(git branch --show-current)"
test "$task8_postmigration_branch" = "main"
task8_postmigration_status="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$task8_postmigration_status"
task8_postmigration_head="$(git rev-parse HEAD)"
task8_postmigration_origin="$(git rev-parse refs/remotes/origin/main)"
test "$task8_postmigration_head" = "$task8_postmigration_origin"
test "$task8_postmigration_head" = "$SETFARM_MERGE_RECEIPT_MERGE_SHA"
task8_migration_verified_json="$(node dist/internal-production/golden-run-cli.js \
  verify-launch-operation-migration --json)"
printf '%s\n' "$task8_migration_verified_json" | jq -e \
  --arg receiptRef "$task8_migration_receipt_ref" \
  --arg receiptHash "$task8_migration_receipt_hash" \
  --arg sourceSha "$task8_postmigration_head" \
  --arg sourceTree "$task8_posttest_tree" \
  '.schema == "setfarm.internal-production-golden-launch-operation-migration-current-verification.v1" and
   .receiptRef == $receiptRef and .receiptHash == $receiptHash and
   .applicationSourceSha == $sourceSha and
   .applicationSourceTreeHash == $sourceTree and
   .currentSourceSha == $sourceSha and .currentSourceTreeHash == $sourceTree and
   (.ancestryObservationHash | test("^[0-9a-f]{64}$")) and
   (.migrationModuleBlobHash | test("^[0-9a-f]{40}([0-9a-f]{24})?$")) and
   (.migrationStatementsHash | test("^[0-9a-f]{64}$")) and
   (.namedMigrationDigestEntryHash | test("^[0-9a-f]{64}$")) and
   (.migrationDigest | test("^[0-9a-f]{64}$")) and
   (.schemaProjectionHash | test("^[0-9a-f]{64}$")) and
   (.verificationHash | test("^[0-9a-f]{64}$"))' >/dev/null
task8_preflight_branch="$(git branch --show-current)"
test "$task8_preflight_branch" = "main"
task8_preflight_status="$(git status --porcelain=v1 --untracked-files=all)"
test -z "$task8_preflight_status"
task8_preflight_head="$(git rev-parse HEAD)"
task8_preflight_origin="$(git rev-parse refs/remotes/origin/main)"
test "$task8_preflight_head" = "$task8_preflight_origin"
test "$task8_preflight_head" = "$SETFARM_MERGE_RECEIPT_MERGE_SHA"
task8_preflight_release_sha="$task8_preflight_head"
node dist/internal-production/golden-run-cli.js preflight --campaign tests/fixtures/internal-production/golden-campaign-v1.json --case node-cli-contract-fixture --release-sha "$task8_preflight_release_sha" --json
task8_final_status="$(git status --porcelain --untracked-files=all)"
test -z "$task8_final_status"
```

Expected: build, guarded prepare/resume, independent fresh verify, and preflight exit `0`; the source owner merge/application tree, compiled build, durable pending input, A purpose authorization/consumption, operation, dedicated migration module/ordered statements/named digest entry/schema projection, immutable terminal receipt, fresh current verification, repository gate, preflight release authority, and explicit current release SHA form one chain. Both repositories are recorded clean, no run starts, no admission is created, no local golden result is written, no review packet is created, and Setfarm's existing external production-admission command remains blocked honestly. Only after this receipt is terminal may the accepted harness contract pass to the separate Subproject C plan for the ordered product matrix.
