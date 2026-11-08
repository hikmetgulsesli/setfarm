# V4 migration probe binding implementation plan

**Goal:** Make the existing V4 migration behavior probe send serialized cause JSON as text before PostgreSQL parses it as JSONB.

**Architecture:** Change only the probe's `$2::jsonb` binding to `$2::text::jsonb`; keep `JSON.stringify(item.cause)`, the complete V4 CHECK, seven cases and every expectation unchanged. Regenerate only the migration34 semantic digest after captured RED.

**Tech Stack:** TypeScript, postgres.js, PostgreSQL, existing TypeScript AST component-test pattern.

**Spec:** Inline Design below. Root adopted this causal root fix under Standing Owner Authorization v1 and owns test/build/database/delivery execution.

## Inline Design and evidence

Normal fresh bootstrap99578 failed in a rolled-back, never-activated schema transaction. Unmodified normal-bootstrap inspector2841 identified `OPERATIONAL_FAILURE_CAUSE_V4_BEHAVIOR_MISMATCH`. Root's actual read-only driver comparison4820 proved the exact original seven AST cases: direct `$2::jsonb` with `JSON.stringify` reaches PostgreSQL as JSON type STRING and rejects the canonical positive; only `$2::text::jsonb` reaches type OBJECT and matches all seven expectations (one positive, six negatives). Private proof `root-design-mcp-v4-probe-parameter-readonly-v1.stdout` SHA256 `f178ce9e1302886968a930c2568fe56d69ad6d528ef15a234bfd4074fe38afe9`.

## Global constraints

- No cause/producer tuple, CHECK semantics, catalog identity, seal, cases, expectations, privileges, provider/parser, retry or runtime guard changes.
- Preserve all migration1–33 semantic digests and historical definitions. Only migration34 metadata may change for the actual one-line probe implementation fix.
- Preserve the failed bootstrap and rollback evidence. No manual initialization, live DDL, new test database or credential changes by this author.
- The component test executes actual case declarations and SQL-emitting/result-checking loop; only external SQL transport/results are controlled. It does not claim PostgreSQL qualification. Root's actual read-only comparison and later normal fresh bootstrap provide that qualification.

## File Map

- `src/db/operational-failure-cause-authority-v4-migration.ts`: one SQL parameter cast in the behavior probe.
- `src/db/contract-spine-migration-digests.generated.ts`: maintained generator updates migration34 only.
- `tests/execution-attempts/operational-failure-cause-v4-probe-binding.test.ts`: real AST behavior-loop execution and exact seven-case emitted driver contract.
- This plan: causal evidence, bounded implementation and validation.

## Task 1: Correct serialized JSON transport without changing authority

- [x] Add the behavior-loop driver-contract regression with literal seven external rows; do not stub catalog/auth authority or export a production test hook.
- [x] Root captures RED: `node --import tsx --test tests/execution-attempts/operational-failure-cause-v4-probe-binding.test.ts`.
- [x] After RED authorization, change only `$2::jsonb` to `$2::text::jsonb` in the production loop and run the maintained `node --import tsx scripts/check-contract-spine-migration-digests.ts --write`; verify only34 changes.
- [x] Root runs the focused regression, proportional existing tests/noEmit/digest/diff checks and independent review.
- [ ] Root performs any later clean build and normal fresh bootstrap. No component result claims live schema activation or production completion.

**Validation:** Root genuine deterministic RED original6512 exited1 at the intended emitted JSON-text transport assertion. Actual read-only PostgreSQL contrast4820 separately proves the original canonical false negative and all seven corrected outcomes. Phase B changes only the one query cast; the maintained digest generator updates34 only. The test uses the identical regex condition via `assert.ok(regex.test(statement))` to avoid logging the full CHECK on failure. No author test, build, DB or operational execution; focused GREEN and all later implementation qualification remain pending Root.

Root verification: genuine component RED6512 exited1 on the original emitted JSON transport contract. GREEN7275 passed10/10 without skips; noEmit7277 and semantic digest7276 exited0. Independent exact four-file review CLEAR. The PostgreSQL binding contrast4820 remains valid because only the identical observed text cast changed; CHECK/cases/expectations are unchanged. A new clean main build and normal fresh bootstrap remain required before rollout.
