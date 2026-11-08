# DESIGN MCP failure record implementation plan

**Goal:** Record the observed sealed DESIGN MCP retrieval failure through ordinary termination without changing its cause or admitting sibling tuples.

**Architecture:** Append authority V4 with exactly one producer tuple; append automatic migration 34 for the matching SQL CHECK. Point current termination, snapshot and convergence readers at V4 and join current fresh-installation registration/readiness to migration 34. Preserve historical V1–V3 evaluators, migration definitions, checksums and audits.

**Tech Stack:** TypeScript, Zod, PostgreSQL CHECK/catalog verification, Node test runner.

**Spec:** Inline Design below, adopted by Root under Standing Owner Authorization v1 for this actual-run root cause. Root owns execution, review, delivery and production effects.

## Inline Design and causal authority

Actual run `9a16` has a sealed `STITCH_MCP_ARTIFACT_RETRIEVAL_FAILED` infrastructure failure. `design-source-runtime-v2.ts` produces the exact constant, and design runtime passes it only with its exact hash and one reason code. `step-fail.single` calls real `requestRunTerminationInTransaction`, whose V3 authority rejects the tuple before SQL; its SQL CHECK also lacks the tuple. The enclosing preclaim execution catch can subsequently mask this recording error. Later successful provider HTML retrieval does not establish the original provider/parser cause and does not justify changing the Stitch parser.

Only this additional tuple is authorized:
`(setfarm.step-fail.single, design, product_compiler.design_source.artifact_download, infrastructure_failure, STITCH_MCP_ARTIFACT_RETRIEVAL_FAILED)`.

## Global constraints

- No sibling causes, provider/parser changes, retries, caps, owner/grant/role changes, new production repair API or historical data rewrites.
- Preserve historical V1–V3 modules, migrations 1–33 definitions/checksums and explicitly historical through31/through33/rollback APIs. Add current-head V34 dispatch outside their frozen semantic regions.
- Current fresh initialization must actually apply migration 34, journal/checksum it, and verify the resulting V4 constraint and complete source-bound origin/catalog. Keep existing 33-entry origin parsing compatible; new origins have exactly the registered 34-entry chain. Unknown or partial chains still refuse.
- Keep the existing MCP source constant and sealed failure artifact unchanged. Never replace the infrastructure cause with a generic success or product failure.
- Source changes serialized in the existing writer. Phase A writes only this plan and the pure test below; no tests, SQL, builds or effects by this author.

## File Map

Required production additions/changes after captured RED:

- Add `src/execution/operational-failure-cause-authority-v4.ts`: append exactly the observed tuple, V4 evaluator/evidence delegation and SQL predicate; V1–V3 unchanged.
- Add `src/db/operational-failure-cause-authority-v4-migration.ts`: exact V3 predecessor detection, V4 constraint statements, identity/catalog/behavior verification with no row rewrite.
- Modify `src/db/contract-spine-migrations.ts`: migration `034_operational_failure_cause_authority_v4`, current-head detection/verification/readiness and fresh initialization/journal. Historical authority seal verifiers remain historical; latest dispatch must account for the changed shared CHECK for migrations 21/30/31 while verifying all other object guards.
- Modify `src/db/contract-spine-migration-source-integrity.ts`: V34 source regions/dependencies and generated renderer entry only; do not change any earlier region/dependency list.
- Regenerate `src/db/contract-spine-migration-digests.generated.ts`: add 34 through the maintained generator; assert all earlier values unchanged.
- Modify `src/execution/run-termination.ts`, `src/server/schemas/run-operational-snapshot-v1.ts`, `src/evals/convergence-runner.ts`: latest V4 consumers; original evidence shape/hashing/authority checks retained.
- Modify `src/installation/fresh-installation-origin-v1.ts` and `src/installation/fresh-installation-owner-source-v1.ts`: exact current 34-entry chain and backward-compatible data parsing of existing 33-entry origins, with source/catalog/connected-journal equality still strict. Existing Task6A db-pg through31/through33 observations remain unchanged.
- `src/installer/steps/02-design/preclaim.ts` remains unchanged: the optional mask-catch move is deferred without a cheap genuine behavioral RED; authorizing the exact recorded cause addresses the observed failure path.

Tests and plan:

- Add `tests/execution-attempts/design-mcp-failure-record.test.ts`: real termination API with an inert first-SQL boundary, crossed tuple refusals, existing tuple compatibility, real public termination-schema projection.
- Existing V1–V3 authority tests remain unchanged. The new focused test additionally checks historical V3 refusal and unchanged sibling refusals under V4.
- Extend `tests/installation/fresh-installation-origin.test.ts` for archived33 byte compatibility, current34 and unknown/partial refusal. Existing owner-source tests remain unchanged; actual connected current34 acceptance is later verified by Root fresh bootstrap.
- Any preclaim mask regression belongs in the new focused test only if it executes the real surrounding preclaim behavior; no source-string assertions or new framework.
- This plan records causal scope and exact validation evidence.

## Task 1: Preserve and authorize the exact original DESIGN infrastructure cause

- [x] Write pure behavioral RED using the current exported request function and exact production cause constant; no nonexistent V4 import. Positive must reach `SELECT status FROM runs WHERE id = $1 FOR UPDATE` and the literal external SQL sentinel. Crossed requester/step/boundary/class/code must fail before SQL. Test the real public snapshot termination schema too.
- [x] Root captures genuine RED: `node --import tsx --test tests/execution-attempts/design-mcp-failure-record.test.ts`.
- [x] After RED approval, append the one-tuple V4 authority/migration and current registered consumers above. Prove earlier binding identities/checksums unchanged. The preclaim catch move is deferred.
- [x] Root runs the focused pure tests, existing V1–V3 authority tests and existing origin/owner-source tests; `node node_modules/typescript/bin/tsc --noEmit`; `node --import tsx scripts/check-contract-spine-migration-digests.ts`; `git diff --check`.
- [x] Root evaluates the actual generated V4 SQL CHECK expression with read-only PostgreSQL SELECT literal inputs (positive exact tuple and crossed negatives), no test database, DML or live constraint change. An inert boundary test is not proof of database acceptance.
- [ ] Freeze for independent review; Root later performs a clean stock build and ordinary fresh bootstrap that actually applies/verifies migration 34 before any production selection or new game. No stock/live success is claimed by pure tests.

**Validation:** Root genuine REDv2 original PID82429 exited1: exact writer and public-schema positives failed on producer authority; crossed-tuple and existing-compatibility controls passed (4 cases, no skips). Phase B adds one V4 tuple and migration34/current joins. The maintained generator ran with `--write`; final generated metadata adds only34 and leaves every prior digest value unchanged. Full imported semantic keys are checked against an explicit closed list before a through33 view reaches historical registrations; the new current registry checks the full metadata and all34 definitions. No old semantic region was intentionally edited; Root will verify source integrity and focused behavior. No tests, build, DB or live effects executed by the author; GREEN and production qualification remain pending Root.

## Root verification checkpoint

Root captured focused GREEN original PID3348 exit0 (5/5) and existing V1–V3/origin/owner-source compatibility PID16848 exit0 (24/24, zero skips). noEmit PID3347, semantic digest check PID3349 and diff checks all exit0. Actual frozen full V4 CHECK expression passed10 literal-input cases on existing PostgreSQL using read-only SELECT (Node21993/psql22004 exit0, zero DML/DDL); JavaScript authority agreed. Independent review matched the 13-file freeze and returned CLEAR for exact one-tuple scope, historical digests, normal migration34/current consumers and strict origin compatibility. Root later added this validation paragraph only. Clean stock build, actual automatic migration34/fresh runtime verification and any production selection remain pending; the live game continues on immutable Source7ad.

## PR361 current-owner reconciliation correction

GitHub review `discussion_r4506784666` found that the final current34 apply guard used a raw plan, whereas public planning and verification reconcile the authenticated current owner-admission head. An advanced or fresh head can therefore leave historical migration32 marked `adoption_mismatch` despite valid current provenance. Wrap this final raw plan in the existing `reconcileCurrentOwnerAdmissionHeadMigrationPlanV1` before checking status; retain all provenance, journal and unrelated-drift refusals.

File Map refinement: `tests/execution-attempts/migration34-owner-plan-reconciliation.test.ts` executes the complete real apply wrapper, reconciler and status helper through existing AST extraction, controlling only SQL/catalog/provenance I/O. It does not qualify an actual database owner-head proof. Production changes only the final current34 plan join in `contract-spine-migrations.ts`; regenerate digest34 and keep every earlier digest unchanged.

Root captured genuine RED original PID83488, exit1: the positive failed at the actual current34 `MIGRATION_ADOPTION_MISMATCH` guard, while all three invalid-provenance/journal-drift controls passed. The regression remains byte-identical. After the correction Root runs `node --import tsx --test tests/execution-attempts/migration34-owner-plan-reconciliation.test.ts`, proportional existing tests/noEmit/digest/diff verification and independent review. GREEN and later build/live qualification are pending; no author test or operational execution.

Root review-fix verification: regression plus authority/origin compatibility PID84612 exit0 (33/33, zero skips); noEmit PID84321 and semantic digest PID84332 exit0; independent delta review CLEAR. Original PID84310 ran18 discovered cases because three authority test paths were misspelled; the corrected explicit33-case command above supplies the full compatibility result. Production qualification remains pending clean build and normal fresh34 initialization.
