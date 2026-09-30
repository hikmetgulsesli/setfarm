# Evidence owner-backed fixture repair

## Evidence and decision

Fresh clean-main evidence stage has104tests/103PASS/1FAIL. The accepted-candidate
repository fixture inserts a run and verified attempt without positive owner
sidecars. Genuine terminalization correctly refuses at
INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_OWNER_UNAVAILABLE; the run also needs its
source-backed owner. The current raw evidence glob lacks an activated P3 template.
This is stale test setup/dispatch, not a production guard bug. Repairing this
same broad-verification gate is causally necessary to the approved Task6A goal.
Root is sole writer; the owner delegated bounded design decisions and continuation.

Choose a small closed-catalog evidence dispatcher using the existing P3 runner
only for accepted-candidate-repository.test.ts, with all17 other evidence files
raw exactly once. Alternatives: all evidence through P3 needlessly creates
isolated templates for pure files; inline shell glob exclusions obscure discovery
and can duplicate/omit files. No direct terminal status update, legacy downgrade,
mocked owner authority, fabricated reservation, migration or guard relaxation.

## Contract

scripts/run-evidence-tests.mjs exports planEvidenceTestsV1(entries,requested=[]).
Each entry is {name,source}; the closed catalog contains18 actual evidence files,
one owner-backed and17 pure. Missing/duplicate/unknown files, pure source directly
importing the test database, and unknown requested locators refuse before spawning.
An empty request selects all; relative tests/evidence/ prefixes normalize only
exact known names; duplicates are deduplicated. Sorted raw files run as one
node --import tsx --test group, then the owner file runs through the unchanged
one-file scripts/run-isolated-postgres-tests.ts command. Import is inert.
The main path discovers actual regular .test.ts files, reads their source,
plans every command before effects, deletes SETFARM_PG_URL from child environments
and executes serially with inherited output. Errors/signals/nonzero stop the chain.
No production test-only overrides or new private-cluster policy exemptions.

The accepted fixture creates source-backed a-runtime-run-v1 and
a-execution-attempt-v1 begin/insert/bind transactions using actual canonical owner
identities. The latter is already verified: do not add unnecessary claims or
runtime sessions. Positive test completion/replay requires both sidecars closed.
Controlled fixture omission of either owner proves real terminal refusal and
rollback to byte-identical run/attempt/owner-head/projection state; no assertion
uses a fake owner resolver. Only the exact evidence test enters P3_TRACKED_SCOPE.
Production source, migration files/digests, live PG31 and selected services stay
unchanged. Existing test-only P3 activation does not prove protected admission.

## File map and gates

- New scripts/run-evidence-tests.mjs: inert planner/closed dispatch/main.
- New scripts/__tests__/evidence-test-runner.test.js: hand-derived command
  vectors/refusals and bounded actual npm edge with test-local child-process
  boundary interception (never starts PG). Default raw-owner path must fail.
- package.json: default test:evidence points to the dispatcher.
- tests/evals/package-scripts.test.ts: coverage reflects the actual new dispatcher,
  without removing the default npm evidence edge or other suite assertions.
- scripts/run-isolated-postgres-tests.ts: add only the exact evidence fixture
  path to the existing explicit changed-byte projection inventory.
- tests/evidence/accepted-candidate-repository.test.ts: genuine owner births,
  exact closed-owner positive and missing-owner rollback negatives.
- This spec and docs/superpowers/plans/2026-10-01-evidence-owner-fixture-v1.md.

TDD precedes implementation, including actual current failure, planner missing
implementation and default npm raw-owner dispatch RED. Run focused dispatch,
genuine P3 evidence, all evidence, eval/package coverage, contract/noemit and
proportional affected ownership regressions. Commit mapped source before genuine
P3 projection so untracked/dirty unrelated files never require a bypass. Then
independent read-only exact-head review, available cloud/security audits,
SHA-bound PR merge and ordinary clean-main build. Standby currently runs merged
execution tests: no synchronization/build there until its children settle.
