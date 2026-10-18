# Fresh Completion Finalization Implementation Plan

> **For agentic workers:** Use subagent-driven development for independent preparation and review. Root is the sole repository writer and delivery owner.

**Goal:** Finalize fresh runtime completions through their real owner and defer successors until predecessor acceptance.

**Architecture:** Preserve accepted-only authority readers. Add a fresh operational-entry branch to bootstrap selection, retain owner context through finalization, and share a causal SQL readiness predicate between selection and atomic publication.

**Tech Stack:** TypeScript ESM, Node.js, PostgreSQL, existing Node test and isolated database harnesses.

**Spec:** `docs/superpowers/specs/2026-10-18-fresh-completion-finalization-design.md`

## Global constraints

- Root alone edits the existing writer; the running release remains immutable.
- Keep legacy bootstrap, English authority, owner, lease, runtime and source guards.
- Keep all eight convergence cases, oracles, model bindings and timeouts.
- Preserve original failed installation, run and receipts; never manually rewrite their authority.
- Commit through a scoped branch and reviewed PR; build only a clean checkout.

## File Map

- `src/execution/runtime-completion.ts`: selected fresh operational admission before the legacy bootstrap body, with the existing owner context requirement.
- `src/spawner.ts`: keep owner capability active across bootstrap selection and accept-or-continue; preserve outer continuation return.
- `src/execution/v3-predecessor-completion-claim-barrier-v1.ts`: fixed causal predecessor SQL and transaction-time pending-target readiness.
- `src/installer/step-ops.ts`: filter blocked pending candidates while allowing other ready runs and existing running claims.
- `src/execution/claim-runtime-publication.ts`: recheck pending publication after committed replay under the existing run lock.
- `tests/installation/fresh-installation-completion-finalizer.test.ts`: actual finalizer-body behavior and refusal cases.
- `tests/installation/fresh-installation-completion-exit-retention.test.ts`: process-exit cleanup retains sessions owned by active completion requests.
- `tests/execution-attempts/runtime-completion.test.ts`: existing extracted legacy harness supplies fixed legacy selection bindings.
- `tests/execution-attempts/v3-predecessor-completion-claim.integration.test.ts`: isolated PostgreSQL readiness and publication regressions.
- `scripts/run-execution-attempt-tests.ts`: register the regression with the existing owner-backed isolated database test group.

## Task 1: Reproduce and correct finalization

- [ ] Adopt the reviewed new component tests without implementation changes.
- [ ] Record RED from:

```sh
node --import tsx --test tests/installation/fresh-installation-completion-finalizer.test.ts
```

- [ ] Implement the fresh branch using actual `selectedFreshInstallationRootV1()` and `assertFreshInstallationOperationalEntryV1()` after the existing owner-context check; selected success returns `null`.
- [ ] Wrap the existing spawner create/accept-or-continue block in `withRuntimeCompletionOwnerCapability(request, async () => ...)`. Return a private continuation indicator and preserve the outer early return before cleanup/event publication.
- [ ] Supply fixed legacy-null selection and admission bindings in the existing P4 extracted harness; retain its assertions.
- [ ] Add the exit-retention regression and record RED. After physical drain proof, lock the exact run and captured session/claim tuple; return without release when its requested/draining/processing completion still owns finalization. Preserve existing release and recovery guards otherwise.
- [ ] Record GREEN for the new component tests and relevant existing runtime completion tests.

## Task 2: Reproduce and correct successor publication

- [ ] Adopt the reviewed isolated PostgreSQL tests, recording RED before Source changes.
- [ ] Add the fixed shared predicate: same run, lower-index single predecessor, non-story completed claim, exactly bound completion, and completion state requested/draining/processing/quarantined.
- [ ] Apply it to pending candidate selection and recheck new publication under the run lock before sequence allocation or state mutation. Preserve existing replay and authority authentication.
- [ ] Cover accepted predecessor, no-birth waiting, other ready runs, unrelated/current/later/loop/story completions and existing replay. Record GREEN with the isolated database harness.

```sh
node --import tsx scripts/run-execution-attempt-tests.ts tests/execution-attempts/v3-predecessor-completion-claim.integration.test.ts
```

## Task 3: Verify, review and exercise the maintained system

PR #293 review found that quarantine is another legal unaccepted state after committed completion effects. The minimal correction adds it only to the shared barrier. First record RED with the existing candidate SQL plus a real recovery-quarantine API fixture and public single/loop no-birth checks. The isolated fixture expires its exact mutable lease using the maintained database-clock pattern; it does not claim elapsed production recovery. Preserve accepted-only readers, exit active-owner states, recovery guards and replay ordering.

At `afc1cd5c`, the finalizer/exit component tests passed 25/25, predecessor PostgreSQL regressions passed 24/24, and existing completion, publication and terminal-reconciler modules passed 55/55, 46/46 and 3/3. These remain source-bound evidence; the quarantine correction needs its own RED/GREEN and current type/contracts checks.

The installation, builder and evaluator layers are unchanged. After reviewed delivery, use an actual clean-main stock build, new release-bound installation/activation, maintained service admission and the evaluator's complete fresh preflight/canary/eight-case run. The earlier release's QA7 and standalone preflight remain historical component evidence and receive no new-release credit.

- [ ] Run the focused completion/publication/preclaim lifecycle tests and TypeScript/maintained contract checks.
- [ ] Obtain independent review of the complete diff and resolve findings without weakening gates.
- [ ] Commit and push the scoped branch; obtain exact-head GitHub review and merge normally.
- [ ] Stock-build a clean canonical release; initialize and activate its actual release-bound installation using maintained APIs.
- [ ] Retire the previous runtime only through observed custody and existing service controls. Preserve any unresolved original state explicitly.
- [ ] Verify the services and run the tracked, unchanged `evals/suites/product-convergence-codex-v1.json` with the compiled evaluator. Claim completion only after all eight actual results and genuine release gate prove it.
