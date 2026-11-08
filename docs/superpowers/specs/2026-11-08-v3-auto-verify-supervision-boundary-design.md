# V3 auto-verification supervision boundary

## Goal and current evidence

Keep legacy background PR verification from changing V3 verification state before the authenticated supervisor route permits it. This is a necessary root fix for the existing Setfarm software-production objective, not a new feature.

Actual run `5540cf28-5698-476d-8afd-a0577dd16ceb`, Source `e3d3b88dcabd641bfaead0d5d5521f7b2c79221f`, installation `bd39e794-3022-4519-9d08-6b7a3962ea85`: the first implementation passed 8/8 authoritative predicates. Supervisor claim 7 returned a valid retry/block output. Completion `RCR_0263e62a-4a7b-41d4-b22e-dfb35e482fb6` and runtime `RTS_badaf24b-d53c-4c16-b521-797cba5ee1f3` quarantined with `V3_SUPERVISE_STORY_RETRY_STEP_TOPOLOGY_INVALID`.

The three locked rows are exactly implement/loop/running, supervise/single/running, verify/single/pending. Only the guard's requirement that verify be waiting fails. The background `autoVerifyMergedPrEachStories` selects V3 runs, receives the unverified OPEN-PR story from `autoVerifyDoneStories`, then updates verify to pending. The exact verifier claim correctly refuses the still-unsupervised story. V3 implementation completion already queues supervision; supervisor acceptance owns the later verification transition.

The supervisor separately requested missing build/smoke/browser/persistence evidence. Its actual handoff is under read-only investigation. This spec does not infer a second defect from model prose or change that projection.

## Design and alternatives

Use the existing protocol boundary: add `AND r.protocol <> 'v3'` to the background selector in `src/spawner.ts`. The runs protocol column is NOT NULL with legacy default. Preserve all non-V3 behavior, including pending-verification retries after stale review delay.

Reject relaxing retry topology to permit pending verification: it treats the wrong producer's mutation as valid and could admit concurrent review. Reject serializing the entire polling loop: it adds unrelated scheduling behavior and does not establish ownership.

## Invariants and limits

- Leave topology, retry-budget, claim-generation, exact binding, CAS, and completion/termination guards unchanged.
- No model, quota, provider, workflow, schema, role, credential, or runtime policy changes.
- No live DB mutation, quarantined-completion replay, generated-project edits, manual PR merge/thread resolution, or rescue.
- Existing current-run evidence and GitHub finding remain preserved.
- Root is sole delivery owner; implementer/reviewer cannot stage, commit, push, operate services, or call providers.
- Keep the existing sole writer and scoped branch; stock build only after clean reviewed delivery.

## Verification

Exercise the actual production selector/caller using AST extraction without importing the spawner entry. Run its SQL against disposable PostgreSQL tables through the maintained test database helper with migrations disabled; do not connect to installations. Replace only the two dynamic effect imports with explicit inert test ports so no GitHub or service call occurs. Preserve production query and UPDATE text.

RED must demonstrate V3 verify changing from waiting to pending under the old function. GREEN must leave V3 waiting and avoid background effect ports, including a mixed-protocol census. Legacy positive controls must still queue verification and support already-pending stale-review cases. Run the focused new test, the existing spawner gateway recovery control, and TypeScript no-emit. The existing gateway extraction fixture needs the actual production isSubscriptionRuntimePathV1 import; its clean-release baseline fails without that dependency. Add only that test binding and preserve its expected assertions. Then reviewed PR, exact clean-main stock build, and normal guarded rollout after old-run ownership is safely closed.

## File map

- `src/spawner.ts`: one protocol exclusion in the legacy background selector.
- `tests/spawner-auto-verify-protocol-boundary.test.ts`: genuine extracted function + real SQL regression and legacy controls.
- `tests/spawner-gateway-recovery.test.ts`: restore the missing actual helper dependency and empty required drainEvidence record in its existing extracted-function fixture.
- This spec and its matching implementation plan: scope, evidence, execution records.
