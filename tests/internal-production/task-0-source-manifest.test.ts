import assert from "node:assert/strict";
import { describe, it } from "node:test";

const TASK_0_EXACT_SOURCE_PATHS_V1 = [
  "contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json",
  "contracts/generated/mission-control/operational-active-run-status.v1.schema.json",
  "package.json",
  "scripts/__tests__/build-generation-retention.test.js",
  "scripts/__tests__/build-info-version.test.js",
  "scripts/build-generation-retention.mjs",
  "scripts/run-isolated-postgres-tests.ts",
  "scripts/write-build-info.mjs",
  "src/contracts/mission-control-contract-artifacts.ts",
  "src/contracts/operational-active-run-status-v1-cli.ts",
  "src/contracts/operational-active-run-status-v1.ts",
  "src/db-pg.ts",
  "src/db/bootstrap-main-claim-handoff-v1-migration.ts",
  "src/db/contract-spine-migration-digests.generated.ts",
  "src/db/contract-spine-migration-source-integrity.ts",
  "src/db/contract-spine-migrations.ts",
  "src/execution/attempt-reconciler.ts",
  "src/execution/attempt-repository.ts",
  "src/execution/claim-attempt-transition.ts",
  "src/execution/claim-runtime-publication.ts",
  "src/execution/operational-event-delivery-repository.ts",
  "src/execution/operational-outbox-repository.ts",
  "src/execution/pre-dispatch-withdrawal-authority.ts",
  "src/execution/run-persistence.ts",
  "src/execution/run-terminal-transition.ts",
  "src/execution/run-termination.ts",
  "src/execution/runtime-completion-effect-repository.ts",
  "src/execution/runtime-completion-effect-runner.ts",
  "src/execution/runtime-completion.ts",
  "src/execution/runtime-session-repository.ts",
  "src/execution/v3-git-revision.ts",
  "src/installer/cleanup-ops.ts",
  "src/installer/run.ts",
  "src/installer/step-fail.ts",
  "src/installer/step-ops.ts",
  "src/internal-production/baseline-owner-producer-manifest-activation-controller-v1.ts",
  "src/internal-production/baseline-post-handoff-cli.ts",
  "src/internal-production/baseline-post-handoff-receipt-v1.ts",
  "src/internal-production/baseline-restart-authority-retirement-v1.ts",
  "src/internal-production/baseline-service-restart-helper-v1.ts",
  "src/internal-production/baseline-service-restart-sequence-v1.ts",
  "src/internal-production/baseline-spawner-startup-admission-v1.ts",
  "src/internal-production/owner-admission-v1.ts",
  "src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts",
  "src/medic/checks.ts",
  "src/medic/medic.ts",
  "src/recovery/finding-recovery-repository.ts",
  "src/recovery/v3-downstream-evidence-publication.ts",
  "src/recovery/v3-evidence-only-publication.ts",
  "src/recovery/v3-evidence-only-worker.ts",
  "src/recovery/v3-recovery-lifecycle-reconciler.ts",
  "src/server/dashboard.ts",
  "src/server/index.html",
  "src/spawner.ts",
  "tests/claim-log-lifecycle.test.ts",
  "tests/cleanup-ops.test.ts",
  "tests/evals/convergence-eval.test.ts",
  "tests/execution-attempts/activation-preflight.test.ts",
  "tests/execution-attempts/artifact-publication-batch-migration.test.ts",
  "tests/execution-attempts/artifact-publication-batch-plan-migration.test.ts",
  "tests/execution-attempts/artifact-store-authority-migration.test.ts",
  "tests/execution-attempts/attempt-reconciler.test.ts",
  "tests/execution-attempts/claim-attempt-transition.test.ts",
  "tests/execution-attempts/claim-runtime-publication.test.ts",
  "tests/execution-attempts/migration-source-digests.test.ts",
  "tests/execution-attempts/migrations.test.ts",
  "tests/execution-attempts/operational-event-delivery.test.ts",
  "tests/execution-attempts/operational-event-migration.test.ts",
  "tests/execution-attempts/operational-failure-cause-migration.test.ts",
  "tests/execution-attempts/operational-outbox-repository.test.ts",
  "tests/execution-attempts/platform-release-store-record-ledger-v3-contract-integration.test.ts",
  "tests/execution-attempts/preparation-authority-v2-migration.test.ts",
  "tests/execution-attempts/product-compilation-attempt-migration.test.ts",
  "tests/execution-attempts/run-protocol.test.ts",
  "tests/execution-attempts/run-terminal-transition.test.ts",
  "tests/execution-attempts/run-termination.test.ts",
  "tests/execution-attempts/runtime-completion-effect-runner.test.ts",
  "tests/execution-attempts/runtime-completion-manifest-authority-migration.test.ts",
  "tests/execution-attempts/runtime-completion.test.ts",
  "tests/execution-attempts/runtime-hooks.test.ts",
  "tests/execution-attempts/runtime-session-repository.test.ts",
  "tests/execution-attempts/test-database.ts",
  "tests/execution-attempts/v3-downstream-evidence-publication.test.ts",
  "tests/execution-attempts/v3-git-revision.test.ts",
  "tests/execution-attempts/v3-implementation-attempt-v2.test.ts",
  "tests/execution-attempts/v3-normal-implementation-preclaim.test.ts",
  "tests/execution-attempts/v3-preparation-block-repository.test.ts",
  "tests/execution-attempts/v3-release-admission.test.ts",
  "tests/execution-attempts/v3-story-claim-runtime-binding-v1-migration.test.ts",
  "tests/findings/migration-recovery-compatibility.test.ts",
  "tests/findings/migration.test.ts",
  "tests/findings/repository.test.ts",
  "tests/findings/v3-evidence-only-worker.test.ts",
  "tests/findings/v3-recovery-lifecycle-reconciler.test.ts",
  "tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts",
  "tests/internal-production/baseline-post-handoff-cli.test.ts",
  "tests/internal-production/baseline-post-handoff-receipt-v1.test.ts",
  "tests/internal-production/baseline-restart-authority-retirement-v1.test.ts",
  "tests/internal-production/baseline-service-restart-helper-v1.test.ts",
  "tests/internal-production/baseline-service-restart-sequence-v1.test.ts",
  "tests/internal-production/baseline-spawner-startup-admission-v1.test.ts",
  "tests/internal-production/owner-admission-v1.test.ts",
  "tests/internal-production/product-build-authority-v2-delivery-evidence-v1.test.ts",
  "tests/internal-production/task-0-source-manifest.test.ts",
  "tests/mission-control-contract-artifacts.test.ts",
  "tests/mission-control-terminal-filter.test.ts",
  "tests/operational-active-run-status-v1.test.ts",
  "tests/product-compiler/artifact-store-authority.test.ts",
  "tests/product-compiler/artifact-store-staging.test.ts",
] as const;

function assertExactTask0SourcePathsV1(actual: readonly string[]): void {
  assert.equal(actual.length, TASK_0_EXACT_SOURCE_PATHS_V1.length, "Task 0 source path cardinality differs");
  assert.equal(new Set(actual).size, actual.length, "Task 0 source paths contain a duplicate");
  for (let ordinal = 0; ordinal < TASK_0_EXACT_SOURCE_PATHS_V1.length; ordinal += 1) {
    assert.equal(actual[ordinal], TASK_0_EXACT_SOURCE_PATHS_V1[ordinal], `Task 0 source path differs at ordinal ${ordinal}`);
  }
}

describe("Task 0 exact source manifest", () => {
  it("accepts the literal 109-path tuple byte-for-byte and in order", () => {
    assert.equal(TASK_0_EXACT_SOURCE_PATHS_V1.length, 109);
    assert.doesNotThrow(() => assertExactTask0SourcePathsV1(TASK_0_EXACT_SOURCE_PATHS_V1));
  });

  it("rejects an omission, extra path, duplicate, and reorder", () => {
    const exact = [...TASK_0_EXACT_SOURCE_PATHS_V1];
    assert.throws(() => assertExactTask0SourcePathsV1(exact.slice(1)));
    assert.throws(() => assertExactTask0SourcePathsV1([...exact, "tests/internal-production/unexpected.test.ts"]));
    assert.throws(() => assertExactTask0SourcePathsV1([...exact.slice(0, -1), exact[0]!]));
    [exact[0], exact[1]] = [exact[1]!, exact[0]!];
    assert.throws(() => assertExactTask0SourcePathsV1(exact));
  });
});
