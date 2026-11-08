# V3 auto-verification supervision boundary

## Goal and current evidence

Keep legacy background PR verification from changing V3 verification state before the authenticated supervisor route permits it. This is a necessary root fix for the existing Setfarm software-production objective, not a new feature.

Actual run `5540cf28-5698-476d-8afd-a0577dd16ceb`, Source `e3d3b88dcabd641bfaead0d5d5521f7b2c79221f`, installation `bd39e794-3022-4519-9d08-6b7a3962ea85`: the first implementation passed 8/8 authoritative predicates. Supervisor claim 7 returned a valid retry/block output. Completion `RCR_0263e62a-4a7b-41d4-b22e-dfb35e482fb6` and runtime `RTS_badaf24b-d53c-4c16-b521-797cba5ee1f3` quarantined with `V3_SUPERVISE_STORY_RETRY_STEP_TOPOLOGY_INVALID`.

The three locked rows are exactly implement/loop/running, supervise/single/running, verify/single/pending. Only the guard's requirement that verify be waiting fails. The background `autoVerifyMergedPrEachStories` selects V3 runs, receives the unverified OPEN-PR story from `autoVerifyDoneStories`, then updates verify to pending. The exact verifier claim correctly refuses the still-unsupervised story. V3 implementation completion already queues supervision; supervisor acceptance owns the later verification transition.

The supervisor separately requested missing build/smoke/browser/persistence evidence. The follow-up audit below demonstrates an actual accepted-evidence input omission, rather than inferring it from model prose.

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

RED must demonstrate V3 verify changing from waiting to pending under the old function. GREEN must leave V3 waiting and avoid background effect ports, including a mixed-protocol census. Legacy positive controls must still queue verification and support already-pending stale-review cases. Run the focused new test, the existing spawner gateway recovery control, and TypeScript no-emit. The existing gateway extraction fixture needs the actual production isSubscriptionRuntimePathV1 import; its clean-release baseline fails without that dependency. Add only that test binding and preserve its expected assertions. Then reviewed PR, exact clean-main stock build, and normal guarded rollout after actual maintained physical service/worker closure and a separately reviewed truthful retained-unresolved handoff.

## File map

- `src/spawner.ts`: one protocol exclusion in the legacy background selector.
- `tests/spawner-auto-verify-protocol-boundary.test.ts`: genuine extracted function + real SQL regression and legacy controls.
- `tests/spawner-gateway-recovery.test.ts`: restore the missing actual helper dependency and empty required drainEvidence record in its existing extracted-function fixture.
- This spec and its matching implementation plan: scope, evidence, execution records.

## Follow-up: authenticated supervisor evidence input

The independent audit `root-nearest-surface-supervisor-evidence-handoff-audit-v1.json` (SHA256 `1342f0b37df1870257d9d7114aed261da13c6bec76d2c3cf5e8dc2b001c0473d`) proves a second causal defect. Accepted implementation bundle `6a50567ce694ee7b470fad617ddce8373a686e1430d66b46d567fb790ea3610b` and RCR `RCR_ded1853e-87e9-4214-9137-dad58be6b087` existed before supervisor claim 7. The candidate SHA reached its canonical input, but the accepted bundle/RCR/result binding did not. All canonical and instruction fragments were read; the claimed ledger directory was absent. Some expected predicate/artifact references were present, so this is not a claim that every reference was missing.

Add a separate authenticated evidence DATA reader in `src/execution/subscription-supervise-contracts-v1.ts`; keep `readAuthenticatedSubscriptionSuperviseContractsV1` and its return/write-scope seal unchanged. Reuse its authenticated subject/story-generation/attempt membership, compiled implementation context, existing native accepted-model source reader, and existing native evidence-only success authority for that already-supported lane. Source custody alone is not PASS.

For each already-authenticated subject member, validate the actual evidence row/payload/schema/canonical hash against run, story, generation, attempt, packet/slice, and accepted candidate SHA/tree. Retain actual aggregate and predicate verdicts, exact required coverage, observation ownership, and command/runtime/control/artifact hashes or normalized locators. Bind model-backed evidence to the actual accepted effects-committed RCR; do not invent a model RCR for a native evidence-only verifier. Return frozen own JSON data, never grant/lease/decision authority. Missing, duplicate, crossed, tampered, or inconsistent material refuses; fail/inconclusive never becomes pass.

In `src/installer/step-ops.ts`, append this Source-owned bounded evidence section to the subscription V3 supervisor's final `resolvedInput` after module prompt replacement and English policy, before input hashing/claim-summary sealing. Require its actual claim envelope/runtime pair. Use the existing subscription runtime selection, not model names; preserve other runtime modes, legacy/non-supervisor input bytes, all tools/permissions and acceptance rules. Apply the same existing authenticated-subject model to story-member and final-product supervision, with exact membership and existing capacity limits. Existing transport then materializes readable protected fragments without a new schema, artifact directory or tool grant.

The section explains that these are prior Setfarm-owned checks for precisely the listed candidate and predicates; it does not instruct the model to pass, claim unperformed tests, or ignore new findings. No raw stdout, prompts, model reasoning, HTML/PNG bodies or credentials enter the summary. No silent truncation.

### Additional File Map

- `src/execution/subscription-supervise-contracts-v1.ts`: separate authenticated evidence data reader; unchanged existing contract API/seal.
- `src/installer/step-ops.ts`: final owned input append before its existing hash/seal.
- `tests/execution-attempts/subscription-supervise-scope-v1.test.ts`: actual reader/projection integrity, authority-binding and negative controls.
- `tests/execution-attempts/subscription-workflow-transport-v1.test.ts`: actual final-input assembly and existing canonical/readable transport integration.

Verification must first fail on the existing input assembly omitting accepted evidence, not on a missing new symbol. Exercise genuine production reader/schema/hash/source-authority code with inert external store/effect boundaries; never stub a positive authority oracle. Be explicit that component fixtures are not live DB authority qualification. The next real run supplies that qualification.
