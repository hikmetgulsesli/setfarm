import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const APPROVED_PLAN_PATH = fileURLToPath(new URL(
  "../../docs/superpowers/plans/2026-08-13-internal-production-baseline-mc-handoff-plan.md",
  import.meta.url,
));

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

const P3_EXACT_SOURCE_PATHS_V1 = [
  "scripts/run-isolated-postgres-tests.ts",
  "src/db-pg.ts",
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
  "src/execution/run-terminal-transition.ts",
  "src/execution/run-termination.ts",
  "src/execution/runtime-completion-effect-repository.ts",
  "src/execution/runtime-completion-effect-runner.ts",
  "src/execution/runtime-completion.ts",
  "src/execution/runtime-session-repository.ts",
  "src/installer/cleanup-ops.ts",
  "src/installer/step-fail.ts",
  "src/installer/step-ops.ts",
  "src/internal-production/owner-admission-v1.ts",
  "src/medic/checks.ts",
  "src/medic/medic.ts",
  "src/recovery/finding-recovery-repository.ts",
  "src/recovery/v3-downstream-evidence-publication.ts",
  "src/recovery/v3-evidence-only-publication.ts",
  "src/recovery/v3-evidence-only-worker.ts",
  "src/recovery/v3-recovery-lifecycle-reconciler.ts",
  "tests/claim-log-lifecycle.test.ts",
  "tests/cleanup-ops.test.ts",
  "tests/execution-attempts/attempt-reconciler.test.ts",
  "tests/execution-attempts/claim-attempt-transition.test.ts",
  "tests/execution-attempts/claim-runtime-publication.test.ts",
  "tests/execution-attempts/migration-source-digests.test.ts",
  "tests/execution-attempts/migrations.test.ts",
  "tests/execution-attempts/operational-event-delivery.test.ts",
  "tests/execution-attempts/operational-outbox-repository.test.ts",
  "tests/execution-attempts/run-terminal-transition.test.ts",
  "tests/execution-attempts/run-termination.test.ts",
  "tests/execution-attempts/runtime-completion-effect-runner.test.ts",
  "tests/execution-attempts/runtime-completion.test.ts",
  "tests/execution-attempts/runtime-hooks.test.ts",
  "tests/execution-attempts/runtime-session-repository.test.ts",
  "tests/execution-attempts/test-database.ts",
  "tests/execution-attempts/v3-downstream-evidence-publication.test.ts",
  "tests/findings/repository.test.ts",
  "tests/findings/v3-evidence-only-worker.test.ts",
  "tests/findings/v3-recovery-lifecycle-reconciler.test.ts",
  "tests/internal-production/owner-admission-v1.test.ts",
  "tests/internal-production/task-0-source-manifest.test.ts",
] as const;

const P3_DATABASE_EXECUTABLE_TEST_PATHS_V1 = [
  "tests/claim-log-lifecycle.test.ts",
  "tests/cleanup-ops.test.ts",
  "tests/execution-attempts/attempt-reconciler.test.ts",
  "tests/execution-attempts/claim-attempt-transition.test.ts",
  "tests/execution-attempts/claim-runtime-publication.test.ts",
  "tests/execution-attempts/migration-source-digests.test.ts",
  "tests/execution-attempts/migrations.test.ts",
  "tests/execution-attempts/operational-event-delivery.test.ts",
  "tests/execution-attempts/operational-outbox-repository.test.ts",
  "tests/execution-attempts/run-terminal-transition.test.ts",
  "tests/execution-attempts/run-termination.test.ts",
  "tests/execution-attempts/runtime-completion-effect-runner.test.ts",
  "tests/execution-attempts/runtime-completion.test.ts",
  "tests/execution-attempts/runtime-hooks.test.ts",
  "tests/execution-attempts/runtime-session-repository.test.ts",
  "tests/execution-attempts/v3-downstream-evidence-publication.test.ts",
  "tests/findings/repository.test.ts",
  "tests/findings/v3-evidence-only-worker.test.ts",
  "tests/findings/v3-recovery-lifecycle-reconciler.test.ts",
  "tests/internal-production/owner-admission-v1.test.ts",
] as const;

const P3_SOURCE_ONLY_EXECUTABLE_TEST_PATH_V1 =
  "tests/internal-production/task-0-source-manifest.test.ts";
const P3_ROLE_ONLY_TEST_HELPER_PATH_V1 = "tests/execution-attempts/test-database.ts";

function assertExactTask0SourcePathsV1(actual: readonly string[]): void {
  assert.equal(actual.length, TASK_0_EXACT_SOURCE_PATHS_V1.length, "Task 0 source path cardinality differs");
  assert.equal(new Set(actual).size, actual.length, "Task 0 source paths contain a duplicate");
  for (let ordinal = 0; ordinal < TASK_0_EXACT_SOURCE_PATHS_V1.length; ordinal += 1) {
    assert.equal(actual[ordinal], TASK_0_EXACT_SOURCE_PATHS_V1[ordinal], `Task 0 source path differs at ordinal ${ordinal}`);
  }
}

function assertExactP3SourcePathsV1(actual: readonly string[]): void {
  assert.equal(actual.length, 51, "P3 source path cardinality differs");
  assert.equal(new Set(actual).size, actual.length, "P3 source paths contain a duplicate");
  assert.deepEqual(actual, P3_EXACT_SOURCE_PATHS_V1, "P3 source paths differ");
  const frozenOrdinals = actual.map((relativePath) => TASK_0_EXACT_SOURCE_PATHS_V1.indexOf(
    relativePath as (typeof TASK_0_EXACT_SOURCE_PATHS_V1)[number],
  ));
  assert.equal(frozenOrdinals.every((ordinal) => ordinal >= 0), true, "P3 path is absent from frozen109");
  assert.deepEqual(frozenOrdinals, [...frozenOrdinals].sort((left, right) => left - right),
    "P3 source paths do not preserve frozen109 order");
}

function assertExactP3MarkdownSourcePathsV1(actual: readonly string[]): void {
  assert.equal(actual.length, 51, "Markdown P3 source path cardinality differs");
  assert.equal(new Set(actual).size, actual.length, "Markdown P3 source paths contain a duplicate");
  assert.deepEqual([...actual].sort(), [...P3_EXACT_SOURCE_PATHS_V1].sort(),
    "Markdown P3 source path membership differs");
}

function assertExactP3ExecutableInventoryV1(input: Readonly<{
  database: readonly string[];
  sourceOnly: readonly string[];
  helperOnly: readonly string[];
}>): void {
  assert.deepEqual(input.database, P3_DATABASE_EXECUTABLE_TEST_PATHS_V1,
    "P3 database executable inventory differs");
  assert.deepEqual(input.sourceOnly, [P3_SOURCE_ONLY_EXECUTABLE_TEST_PATH_V1],
    "P3 source-only executable inventory differs");
  assert.deepEqual(input.helperOnly, [P3_ROLE_ONLY_TEST_HELPER_PATH_V1],
    "P3 helper-only inventory differs");
  assert.equal(input.database.length, 20);
  assert.equal(input.sourceOnly.length, 1);
  assert.equal(input.helperOnly.length, 1);
  const executable = [...input.database, ...input.sourceOnly];
  assert.equal(executable.length, 21);
  assert.equal(executable.includes(P3_ROLE_ONLY_TEST_HELPER_PATH_V1), false,
    "role-only helper must never be executable");
  assert.deepEqual([...executable, ...input.helperOnly].sort(),
    P3_EXACT_SOURCE_PATHS_V1.filter((relativePath) => relativePath.startsWith("tests/")).sort());
}

function extractApprovedTask0SourcePathsV1(plan: string): readonly string[] {
  const marker = "export const TASK_0_EXACT_SOURCE_PATHS_V1 = [";
  const start = plan.indexOf(marker);
  assert.notEqual(start, -1, "approved plan has no Task 0 source tuple");
  const end = plan.indexOf("] as const;", start);
  assert.notEqual(end, -1, "approved plan Task 0 source tuple is unterminated");
  const block = plan.slice(start + marker.length, end);
  return [...block.matchAll(/^  "([^"]+)",$/gm)].map((match) => match[1]!);
}

function extractApprovedP3SourcePathsV1(plan: string): readonly string[] {
  const startMarker = "The corrected P3 sub-File-Map is exactly 51 existing members";
  const endMarker = "This is 29 + 22 = 51";
  const start = plan.indexOf(startMarker);
  assert.notEqual(start, -1, "approved plan has no P3 source inventory");
  const end = plan.indexOf(endMarker, start);
  assert.notEqual(end, -1, "approved plan P3 source inventory is unterminated");
  return [...plan.slice(start, end).matchAll(/`([^`]+\.ts)`/g)].map((match) => match[1]!);
}

function assertExactInventory<Result extends string>(
  actual: readonly Result[],
  expected: readonly Result[],
  label: string,
): void {
  assert.equal(new Set(actual).size, actual.length, `${label} contains a duplicate`);
  assert.deepEqual(actual, expected, `${label} differs`);
}

const P3_OWNER_BIRTH_INVENTORY_V1 = [
  ["src/execution/claim-runtime-publication.ts", "publishSingleClaimRuntime", "a-claim-single-runtime-v1", "claim"],
  ["src/execution/claim-runtime-publication.ts", "publishLoopClaimRuntime", "a-claim-loop-runtime-v1", "claim"],
  ["src/recovery/v3-downstream-evidence-publication.ts", "createV3DownstreamEvidencePublication.reserve", "a-claim-v3-downstream-evidence-v1", "claim"],
  ["src/recovery/v3-evidence-only-publication.ts", "createV3EvidenceOnlyPublication.reserve", "a-claim-v3-evidence-only-v1", "claim"],
  ["src/execution/attempt-repository.ts", "reserveAttemptInTransaction", "a-execution-attempt-v1", "execution-attempt"],
  ["src/execution/runtime-session-repository.ts", "reserveRuntimeSessionInTransaction", "a-runtime-session-v1", "runtime-session"],
  ["src/execution/runtime-completion.ts", "createRuntimeCompletionRepository.claim", "a-completion-owner-v1", "completion-owner"],
  ["src/execution/runtime-completion.ts", "markRuntimeCompletionOwnerCommittedInTransaction", "a-mandatory-effect-v1", "mandatory-effect"],
  ["src/execution/run-termination.ts", "requestRunTerminationInTransaction", "a-termination-v1", "termination"],
  ["src/recovery/finding-recovery-repository.ts", "createFindingRecoveryRepository.putFindingSet", "a-finding-recovery-repository-v1", "finding"],
  ["src/recovery/v3-downstream-evidence-publication.ts", "putFindingSet", "a-finding-v3-downstream-evidence-v1", "finding"],
  ["src/recovery/v3-evidence-only-publication.ts", "putFindingSetInTransaction", "a-finding-v3-evidence-only-v1", "finding"],
  ["src/execution/operational-outbox-repository.ts", "createOperationalOutboxRepository.publish", "a-operational-delivery-v1", "operational-delivery"],
] as const;

const P3_ATTEMPT_TERMINAL_WRITER_INVENTORY_V1 = [
  ["src/execution/attempt-repository.ts", "async complete(input:"],
  ["src/execution/attempt-reconciler.ts", "async function completeTerminalAttemptForRecovery("],
  ["src/execution/claim-attempt-transition.ts", "export async function closeClaimAndBoundAttemptInTransaction("],
  ["src/execution/claim-attempt-transition.ts", "export async function completeStoryClaimAndBoundAttempt("],
  ["src/execution/pre-dispatch-withdrawal-authority.ts", "export async function withdrawPreDispatchClaimInTransaction("],
  ["src/execution/run-terminal-transition.ts", "export async function transitionRunToTerminalInTransaction("],
  ["src/recovery/v3-downstream-evidence-publication.ts", "async complete(input:"],
  ["src/recovery/v3-evidence-only-publication.ts", "async completeAttempt(input:"],
  ["src/recovery/v3-evidence-only-worker.ts", "async function quarantineDelivery("],
  ["src/recovery/v3-recovery-lifecycle-reconciler.ts", "async function blockExpiredEvidenceAttempt("],
  ["src/recovery/v3-recovery-lifecycle-reconciler.ts", "async function blockExpiredModelAttempt("],
] as const;

const GUARDED_MIGRATION_32_APPLY_SYMBOL_V1 = [
  "applyBootstrapMainClaimHandoff",
  "GuardedMigration32V1",
].join("");

const P4_TRANSACTION_ABI_SYMBOLS_V1 = [
  ["InternalProductionCurrentEntry", "Migration32TransactionV1"],
  ["openInternalProductionCurrentEntry", "Migration32TransactionV1"],
  ["stageInternalProductionCurrentEntry", "Migration32InTransactionV1"],
  ["commitInternalProductionCurrentEntry", "Migration32TransactionV1"],
  ["abortInternalProductionCurrentEntry", "Migration32TransactionV1"],
].map((fragments) => fragments.join(""));

type P3ProductionSourcesV1 = Readonly<Record<string, string>>;

function countMatches(source: string, expression: RegExp): number {
  return source.match(expression)?.length ?? 0;
}

function p3FunctionBody(source: string, marker: string): string {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing source marker: ${marker}`);
  assert.equal(source.indexOf(marker, start + marker.length), -1, `ambiguous source marker: ${marker}`);
  const sourceFile = ts.createSourceFile(
    "task8-static-authority.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const candidates: ts.FunctionLikeDeclaration[] = [];
  const visit = (node: ts.Node): void => {
    const functionLike = ts.isFunctionDeclaration(node)
      || ts.isMethodDeclaration(node)
      || ts.isFunctionExpression(node)
      || ts.isArrowFunction(node);
    if (
      functionLike
      && node.body
      && node.getStart(sourceFile) <= start
      && node.end >= start + marker.length
    ) candidates.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  candidates.sort((left, right) => (left.end - left.getStart(sourceFile))
    - (right.end - right.getStart(sourceFile)));
  const exact = candidates[0];
  assert.ok(exact, `source marker is not inside one exact function: ${marker}`);
  return source.slice(exact.getStart(sourceFile), exact.end);
}

function assertP3Task8StaticAuthorityV1(sources: P3ProductionSourcesV1): void {
  const productionPaths = P3_EXACT_SOURCE_PATHS_V1.filter((relativePath) => !relativePath.startsWith("tests/"));
  assert.deepEqual(Object.keys(sources).sort(), [...productionPaths].sort(),
    "Task 8 must parse all exact29 production/package paths");

  const ownerCore = sources["src/internal-production/owner-admission-v1.ts"]!;
  assert.equal(countMatches(ownerCore, /BigInt\(value\) > 9_007_199_254_740_991n/g), 1,
    "owner-core claim cap differs");
  assert.equal(ownerCore.includes("9_007_199_254_740_992n"), false, "owner-core claim cap widened");

  const categories = new Set(P3_OWNER_BIRTH_INVENTORY_V1.map((row) => row[3]));
  assert.deepEqual([...categories].sort(), [
    "claim", "completion-owner", "execution-attempt", "finding", "mandatory-effect",
    "operational-delivery", "runtime-session", "termination",
  ]);
  for (const [modulePath, functionName, implementationId, category] of P3_OWNER_BIRTH_INVENTORY_V1) {
    const rowPattern = new RegExp(
      `module: ${JSON.stringify(modulePath)}[^\\n]+function: ${JSON.stringify(functionName)}[^\\n]+implementationId: ${JSON.stringify(implementationId)}[^\\n]+category: ${JSON.stringify(category)}`,
    );
    assert.equal(countMatches(ownerCore, rowPattern), 1, `owner birth row differs: ${implementationId}`);
    assert.match(sources[modulePath]!, new RegExp(implementationId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `owner birth implementation is absent: ${implementationId}`);
  }

  const terminalSources = productionPaths.map((relativePath) => sources[relativePath]!);
  const terminalUpdate = /UPDATE execution_attempts[\s\S]{0,250}?SET disposition = (?:\$\d+|'(?:produced_delta|already_satisfied|verified|no_progress|failed|inconclusive)')/g;
  const terminalResolver = /await resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1\(/g;
  assert.equal(terminalSources.reduce((total, source) => total + countMatches(source, terminalUpdate), 0), 11,
    "attempt terminal UPDATE inventory differs");
  assert.equal(terminalSources.reduce((total, source) => total + countMatches(source, terminalResolver), 0), 11,
    "attempt terminal resolver inventory differs");
  for (const [relativePath, marker] of P3_ATTEMPT_TERMINAL_WRITER_INVENTORY_V1) {
    const body = p3FunctionBody(sources[relativePath]!, marker);
    assert.match(body, /await resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1\(/,
      `${relativePath}:${marker} has no authenticated terminal resolver`);
    assert.match(body, /await closeInternalProductionOwnerReservationV1\(/,
      `${relativePath}:${marker} has no direct generic owner close`);
  }

  const claimProducerSource = [
    sources["src/execution/claim-runtime-publication.ts"]!,
    sources["src/recovery/v3-downstream-evidence-publication.ts"]!,
    sources["src/recovery/v3-evidence-only-publication.ts"]!,
  ].join("\n");
  assert.equal(countMatches(
    claimProducerSource,
    /SELECT nextval\(pg_get_serial_sequence\('claim_log','id'\)\)::bigint::text AS id/g,
  ), 4, "claim births must preallocate exact canonical text");

  const attemptRepository = sources["src/execution/attempt-repository.ts"]!;
  const evidenceOnly = sources["src/recovery/v3-evidence-only-publication.ts"]!;
  const ordinary = sources["src/recovery/v3-downstream-evidence-publication.ts"]!;
  const worker = sources["src/recovery/v3-evidence-only-worker.ts"]!;
  const lifecycle = sources["src/recovery/v3-recovery-lifecycle-reconciler.ts"]!;
  assert.equal(productionPaths.filter((relativePath) => sources[relativePath]!.includes("INSERT INTO execution_attempts"))
    .join("\n"), "src/execution/attempt-repository.ts", "attempt birth owner differs");
  assert.equal(productionPaths.reduce((total, relativePath) => total + countMatches(
    sources[relativePath]!, /SET state = 'attempt_reserved',\s*claim_id =/g,
  ), 0), 1, "recovery-delivery binder inventory differs");
  assert.match(attemptRepository, /claim_id IS NULL[\s\S]{0,120}?attempt_id IS NULL[\s\S]{0,120}?execution_slice_hash IS NULL/);
  assert.match(attemptRepository, /delivery\.claim_id !== String\(reservation\.claimId\)[\s\S]{0,200}?delivery\.attempt_id !== inserted\.attempt_id[\s\S]{0,200}?delivery\.execution_slice_hash !== reservation\.sliceHash/);
  assert.match(attemptRepository, /internal_production_v3_recovery_claim_publications_v1/);
  assert.match(attemptRepository, /canonicalJsonStringify\(handoff\)/);
  assert.match(attemptRepository, /hashCanonicalJson\(handoff\)/);

  const negativeCheck = p3FunctionBody(evidenceOnly,
    "async function assertNoModelPublicationForEvidenceOnlyClaimInTransaction(");
  assert.equal(countMatches(negativeCheck, /FROM runtime_sessions runtime/g), 1);
  assert.equal(countMatches(negativeCheck, /FROM internal_production_v3_recovery_claim_publications_v1 publication/g), 1);
  assert.equal(countMatches(negativeCheck, /COUNT\(\*\)::integer/g), 2);
  assert.match(negativeCheck, /runtime\.claim_id = \$1::bigint[\s\S]*publication\.claim_id = \$1::bigint[\s\S]*publication\.dispatch_id = \$4/);
  assert.doesNotMatch(negativeCheck, /ORDER BY|LIMIT\s+1|latest|SELECT\s+\*[\s\S]*internal_production_v3_recovery_claim_publications/i);
  assert.equal(countMatches(evidenceOnly, /assertNoModelPublicationForEvidenceOnlyClaimInTransaction\(/g), 2,
    "evidence-only negative checker must have one declaration and one call");
  for (const forbidden of [
    "recoveryDispatchId", "recoveryCaseRevisionId", "recoveryDeliveryLease",
    "recovery_dispatch_deliveries", "internal_production_v3_recovery_claim_publications_v1",
  ]) assert.equal(ordinary.includes(forbidden), false, `ordinary birth carries forbidden recovery seam: ${forbidden}`);
  assert.equal(worker.includes("reserveAttemptInTransaction"), false);
  assert.equal(lifecycle.includes("reserveAttemptInTransaction"), false);

  const expiry = p3FunctionBody(lifecycle, "async function rollbackUnreservedPublication(");
  assert.equal(countMatches(expiry, /await closeInternalProductionOwnerReservationV1\(/g), 2,
    "prebirth expiry must close claim and runtime owners");
  assert.match(expiry, /resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1/);
  assert.match(expiry, /resolveInternalProductionRuntimeSessionTerminalAuthorityPairInTransactionV1/);
  assert.match(expiry, /SET state = 'blocked'/);
  assert.match(expiry, /attempt_id IS NULL[\s\S]{0,120}?claim_id IS NULL[\s\S]{0,120}?execution_slice_hash IS NULL/);
  assert.doesNotMatch(expiry, /DELETE FROM internal_production_v3_recovery_claim_publications_v1|UPDATE internal_production_v3_recovery_claim_publications_v1/);
  assert.doesNotMatch(expiry, /state\s*=\s*'authorized'/);

  const compound = sources["src/execution/run-terminal-transition.ts"]!;
  const normalization = compound.indexOf("await normalizeTask5TerminalCompletionContractInTransactionV1");
  const effectAuthentication = compound.indexOf("await authenticateTask5ClosedMandatoryEffectReplayInTransactionV1");
  const firstTask6Mutation = compound.indexOf("// Mutate all in fixed category order.");
  const claimResolver = compound.indexOf("resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(ownerSql");
  const attemptResolver = compound.indexOf("resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(ownerSql");
  const runtimeResolver = compound.indexOf("resolveInternalProductionRuntimeSessionTerminalAuthorityPairInTransactionV1(ownerSql");
  const completionResolver = compound.indexOf("resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1(ownerSql");
  const terminationResolver = compound.indexOf("resolveInternalProductionTerminationTerminalAuthorityPairInTransactionV1(ownerSql");
  const runResolver = compound.indexOf("resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(");
  assert.equal([normalization, effectAuthentication, firstTask6Mutation, claimResolver, attemptResolver,
    runtimeResolver, completionResolver, terminationResolver, runResolver].every((value) => value >= 0), true);
  assert.equal(normalization < effectAuthentication && effectAuthentication < firstTask6Mutation, true,
    "Task 6 read-only preflight must precede mutation");
  assert.equal(claimResolver < attemptResolver && attemptResolver < runtimeResolver
    && runtimeResolver < completionResolver && completionResolver < terminationResolver
    && terminationResolver < runResolver, true, "Task 6 resolver category order differs");
  assert.match(compound, /closeInternalProductionOwnerReservationV1\(ownerSql, \{\s*reservationRef: terminalPair\.runOwnerReservationRef,\s*reservationHash: terminalPair\.runOwnerReservationHash,\s*terminalAuthorityRef: terminalPair\.terminalAuthorityRef,\s*terminalAuthorityHash: terminalPair\.terminalAuthorityHash,\s*\}\)/);

  for (const findingSource of [
    sources["src/recovery/finding-recovery-repository.ts"]!, ordinary, evidenceOnly,
  ]) {
    assert.match(findingSource, /SELECT \* FROM finding_sets WHERE finding_set_hash=\$1 FOR UPDATE/);
    assert.match(findingSource, /ORDER BY array_position\(\$2::text\[\],finding_id\),finding_id[\s\S]{0,30}?FOR UPDATE/);
    assert.match(findingSource, /bindInternalProductionOwnerReservationV1/);
    assert.match(findingSource, /resolveInternalProductionFindingTerminalAuthorityPairInTransactionV1/);
    assert.match(findingSource, /closeInternalProductionOwnerReservationV1/);
  }
  const outbox = sources["src/execution/operational-outbox-repository.ts"]!;
  const delivery = sources["src/execution/operational-event-delivery-repository.ts"]!;
  assert.match(outbox, /for \(const consumer of deliveryConsumers\(\)\)/);
  assert.match(outbox, /WHERE event_key=\$1 AND consumer=\$2[\s\S]{0,40}?FOR UPDATE/);
  assert.match(outbox, /bindInternalProductionOwnerReservationV1/);
  assert.match(delivery, /lockExactDeliveryWithEventInTransactionV1/);
  assert.match(delivery, /resolveInternalProductionOperationalDeliveryTerminalAuthorityPairInTransactionV1/);
  assert.match(delivery, /closeInternalProductionOwnerReservationV1/);
  assert.match(delivery, /expiredEvents[\s\S]*closeOperationalDeliveryInTransactionV1/);

  for (const symbol of P4_TRANSACTION_ABI_SYMBOLS_V1) {
    const exactSymbol = new RegExp(`(?:^|[^A-Za-z0-9_$])${symbol}(?:[^A-Za-z0-9_$]|$)`);
    assert.equal(productionPaths.some((relativePath) => exactSymbol.test(sources[relativePath]!)), false,
      `P4 ABI appeared during P3: ${symbol}`);
  }

  const runner = sources["scripts/run-isolated-postgres-tests.ts"]!;
  const helper = readFileSync(`${REPOSITORY_ROOT}${P3_ROLE_ONLY_TEST_HELPER_PATH_V1}`, "utf8");
  assert.match(runner, /new URL\("\.\.\/", import\.meta\.url\)/);
  assert.match(runner, /SETFARM_P3_PROJECTION_CAPABILITY_V1:\$\{role\}:/);
  assert.equal(countMatches(runner, /capabilityFrameV1\("setup"/g), 1);
  assert.equal(countMatches(runner, /capabilityFrameV1\("test"/g), 1);
  assert.match(helper, /setfarm\.p3-isolated-projection-marker\.v1/);
  const activationBody = p3FunctionBody(helper, "async function activateP3TemplateAndWriteReadinessV1(");
  const guarded32 = activationBody.indexOf(`await ${GUARDED_MIGRATION_32_APPLY_SYMBOL_V1}`);
  const ordinary33 = activationBody.indexOf("await applyAndVerifyP3GenericSuccessorV1");
  const activation = activationBody.indexOf("await fixtureDb.activateInternalProductionOwnerProducerManifestSetV1");
  assert.equal(guarded32 >= 0 && ordinary33 > guarded32 && activation > ordinary33, true,
    "fixture order must remain guarded32 -> ordinary33 -> A readiness");
}

describe("Task 0 exact source manifest", () => {
  it("freezes P3 as an ordered exact51 subset of frozen109", () => {
    assert.equal(P3_EXACT_SOURCE_PATHS_V1.length, 51);
    assert.doesNotThrow(() => assertExactP3SourcePathsV1(P3_EXACT_SOURCE_PATHS_V1));

    const production = P3_EXACT_SOURCE_PATHS_V1.filter((relativePath) => !relativePath.startsWith("tests/"));
    const tests = P3_EXACT_SOURCE_PATHS_V1.filter((relativePath) => relativePath.startsWith("tests/"));
    assert.equal(production.length, 29);
    assert.equal(tests.length, 22);
    assert.equal(new Set(P3_EXACT_SOURCE_PATHS_V1).size, 51);
    assert.deepEqual(P3_EXACT_SOURCE_PATHS_V1.filter((relativePath) => !existsSync(
      `${REPOSITORY_ROOT}${relativePath}`,
    )), []);
    for (const required of [
      "scripts/run-isolated-postgres-tests.ts",
      "tests/execution-attempts/test-database.ts",
      "src/internal-production/owner-admission-v1.ts",
      "src/execution/runtime-completion-effect-runner.ts",
      "src/db/contract-spine-migrations.ts",
      "src/db/contract-spine-migration-digests.generated.ts",
      "src/db/contract-spine-migration-source-integrity.ts",
      "tests/execution-attempts/migration-source-digests.test.ts",
      "tests/execution-attempts/migrations.test.ts",
    ]) assert.equal(P3_EXACT_SOURCE_PATHS_V1.includes(required as never), true, required);
    assert.equal(P3_EXACT_SOURCE_PATHS_V1.includes("tests/evals/convergence-eval.test.ts" as never), false);
    assert.equal(TASK_0_EXACT_SOURCE_PATHS_V1.includes("tests/evals/convergence-eval.test.ts"), true);
  });

  it("matches the independent Markdown P3 inventory and rejects every candidate inventory drift", () => {
    const approved = extractApprovedP3SourcePathsV1(readFileSync(APPROVED_PLAN_PATH, "utf8"));
    assertExactP3MarkdownSourcePathsV1(approved);
    const exact = [...P3_EXACT_SOURCE_PATHS_V1];
    assert.throws(() => assertExactP3SourcePathsV1(exact.slice(1)), /cardinality/);
    assert.throws(() => assertExactP3SourcePathsV1([...exact, "src/spawner.ts"]), /cardinality/);
    assert.throws(() => assertExactP3SourcePathsV1([...exact.slice(0, -1), exact[0]!]), /duplicate/);
    [exact[0], exact[1]] = [exact[1]!, exact[0]!];
    assert.throws(() => assertExactP3SourcePathsV1(exact), /differ|order/);
    const countOnly = [...P3_EXACT_SOURCE_PATHS_V1];
    countOnly[0] = "src/spawner.ts" as (typeof countOnly)[number];
    assert.equal(countOnly.length, 51);
    assert.throws(() => assertExactP3SourcePathsV1(countOnly), /differ|absent/);
  });

  it("covers exact22 tests through 20 isolated DB files, one source file, and one helper-only path", () => {
    const exactTests = P3_EXACT_SOURCE_PATHS_V1.filter((relativePath) => relativePath.startsWith("tests/"));
    assert.equal(exactTests.length, 22);
    assert.equal(P3_DATABASE_EXECUTABLE_TEST_PATHS_V1.length, 20);
    assert.equal(new Set(P3_DATABASE_EXECUTABLE_TEST_PATHS_V1).size, 20);
    assert.equal(P3_DATABASE_EXECUTABLE_TEST_PATHS_V1.includes(P3_ROLE_ONLY_TEST_HELPER_PATH_V1 as never), false);
    assert.equal(P3_DATABASE_EXECUTABLE_TEST_PATHS_V1.includes(P3_SOURCE_ONLY_EXECUTABLE_TEST_PATH_V1 as never), false);
    assert.deepEqual(
      [...P3_DATABASE_EXECUTABLE_TEST_PATHS_V1, P3_SOURCE_ONLY_EXECUTABLE_TEST_PATH_V1,
        P3_ROLE_ONLY_TEST_HELPER_PATH_V1].sort(),
      [...exactTests].sort(),
    );
    assert.equal(P3_DATABASE_EXECUTABLE_TEST_PATHS_V1.length + 1, 21);
    const exactInventory = {
      database: P3_DATABASE_EXECUTABLE_TEST_PATHS_V1,
      sourceOnly: [P3_SOURCE_ONLY_EXECUTABLE_TEST_PATH_V1],
      helperOnly: [P3_ROLE_ONLY_TEST_HELPER_PATH_V1],
    } as const;
    assert.doesNotThrow(() => assertExactP3ExecutableInventoryV1(exactInventory));
    assert.throws(() => assertExactP3ExecutableInventoryV1({
      ...exactInventory,
      database: [...exactInventory.database, P3_ROLE_ONLY_TEST_HELPER_PATH_V1],
    }), /database executable|role-only helper/);
    assert.throws(() => assertExactP3ExecutableInventoryV1({
      ...exactInventory,
      database: exactInventory.database.slice(1),
      sourceOnly: [exactInventory.database[0]!, ...exactInventory.sourceOnly],
    }), /database executable|source-only executable/);
  });

  it("source-grounds exact29 births, terminals, A-prime, expiry, Task 6, Task 7, and deferred P4", () => {
    const productionPaths = P3_EXACT_SOURCE_PATHS_V1.filter((relativePath) => !relativePath.startsWith("tests/"));
    const sources = Object.fromEntries(productionPaths.map((relativePath) => [
      relativePath,
      readFileSync(`${REPOSITORY_ROOT}${relativePath}`, "utf8"),
    ]));
    assert.doesNotThrow(() => assertP3Task8StaticAuthorityV1(sources));
  });

  it("rejects every required in-memory authority mutation without changing production bytes", () => {
    const productionPaths = P3_EXACT_SOURCE_PATHS_V1.filter((relativePath) => !relativePath.startsWith("tests/"));
    const sources = Object.fromEntries(productionPaths.map((relativePath) => [
      relativePath,
      readFileSync(`${REPOSITORY_ROOT}${relativePath}`, "utf8"),
    ]));
    const mutate = (relativePath: string, mutation: (source: string) => string): P3ProductionSourcesV1 => ({
      ...sources,
      [relativePath]: mutation(sources[relativePath]!),
    });

    assert.throws(() => assertP3Task8StaticAuthorityV1(mutate(
      "src/internal-production/owner-admission-v1.ts",
      (source) => source.replace("9_007_199_254_740_991n", "9_007_199_254_740_992n"),
    )), /claim cap/);
    assert.throws(() => assertP3Task8StaticAuthorityV1(mutate(
      "src/execution/claim-runtime-publication.ts",
      (source) => source.replace("::bigint::text AS id", "::integer AS id"),
    )), /claim births/);
    assert.throws(() => assertP3Task8StaticAuthorityV1(mutate(
      "src/execution/attempt-repository.ts",
      (source) => `${source}\nconst task8SecondBinder = \"SET state = 'attempt_reserved', claim_id =\";\n`,
    )), /binder inventory/);
    assert.throws(() => assertP3Task8StaticAuthorityV1(mutate(
      "src/recovery/v3-evidence-only-publication.ts",
      (source) => source.replace(
        "AS publication_count`,",
        "ORDER BY publication.bound_at DESC LIMIT 1 AS publication_count`,",
      ),
    )), /must not match|does not match|ORDER BY|latest/i);
    assert.throws(() => assertP3Task8StaticAuthorityV1(mutate(
      "src/recovery/v3-recovery-lifecycle-reconciler.ts",
      (source) => source.replace(
        "await closeInternalProductionOwnerReservationV1(sql as PgTransactionSql, runtimeClose);",
        "void runtimeClose;",
      ),
    )), /must close claim and runtime owners/);
    assert.throws(() => assertP3Task8StaticAuthorityV1(mutate(
      "src/db-pg.ts",
      (source) => `${source}\nconst task8UndeclaredTerminalWriter = \`UPDATE execution_attempts SET disposition = 'failed'\`;\n`,
    )), /attempt terminal UPDATE inventory differs/);
    assert.throws(() => assertP3Task8StaticAuthorityV1(mutate(
      "src/db-pg.ts",
      (source) => `${source}\nasync function task8UndeclaredTerminalResolver() { await resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(); }\n`,
    )), /attempt terminal resolver inventory differs/);
    assert.throws(() => assertP3Task8StaticAuthorityV1(mutate(
      "src/execution/attempt-repository.ts",
      (source) => {
        const terminalAuthorityBlock = source.match(
          /        const terminalClose = await resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1\([\s\S]*?        \);\n/,
        )?.[0];
        assert.ok(terminalAuthorityBlock, "Task 8 terminal authority mutation fixture is missing");
        return `${source.replace(terminalAuthorityBlock, "")}\nconst task8LaterTerminalAuthorityDecoy = { async close() {\n${terminalAuthorityBlock}} };\n`;
      },
    )), /has no authenticated terminal resolver|has no direct generic owner close/);
    for (const symbol of P4_TRANSACTION_ABI_SYMBOLS_V1) {
      assert.throws(() => assertP3Task8StaticAuthorityV1(mutate(
        "src/internal-production/owner-admission-v1.ts",
        (source) => `${source}\ntype ${symbol} = never;\n`,
      )), new RegExp(symbol));
    }
  });

  it("accepts the literal 109-path tuple byte-for-byte and in order", () => {
    assert.equal(TASK_0_EXACT_SOURCE_PATHS_V1.length, 109);
    assert.doesNotThrow(() => assertExactTask0SourcePathsV1(TASK_0_EXACT_SOURCE_PATHS_V1));
  });

  it("matches frozen109 and every approved exact51 member exists", () => {
    const approved = extractApprovedTask0SourcePathsV1(readFileSync(APPROVED_PLAN_PATH, "utf8"));
    assertExactInventory(approved, TASK_0_EXACT_SOURCE_PATHS_V1, "approved Task 0 source paths");
    const p3Approved = new Set(P3_EXACT_SOURCE_PATHS_V1);
    const missingP3 = approved.filter((relativePath) => p3Approved.has(relativePath as never))
      .filter((relativePath) => !existsSync(`${REPOSITORY_ROOT}${relativePath}`));
    assert.deepEqual(missingP3, [], "approved P3 source paths are missing from the repository");
  });

  it("rejects an omission, extra path, duplicate, and reorder", () => {
    const exact = [...TASK_0_EXACT_SOURCE_PATHS_V1];
    assert.throws(() => assertExactTask0SourcePathsV1(exact.slice(1)));
    assert.throws(() => assertExactTask0SourcePathsV1([...exact, "tests/internal-production/unexpected.test.ts"]));
    assert.throws(() => assertExactTask0SourcePathsV1([...exact.slice(0, -1), exact[0]!]));
    [exact[0], exact[1]] = [exact[1]!, exact[0]!];
    assert.throws(() => assertExactTask0SourcePathsV1(exact));
  });

  it("review inventory rejects an omission, extra path, duplicate, and reorder", () => {
    const exact = ["birth:a", "terminal:a", "birth:b"] as const;
    assert.doesNotThrow(() => assertExactInventory(exact, exact, "owner mutation inventory"));
    assert.throws(() => assertExactInventory(exact.slice(1), exact, "owner mutation inventory"));
    assert.throws(() => assertExactInventory([...exact, "birth:c"], exact, "owner mutation inventory"));
    assert.throws(() => assertExactInventory([...exact, exact[0]], exact, "owner mutation inventory"));
    assert.throws(() => assertExactInventory([exact[1], exact[0], exact[2]], exact, "owner mutation inventory"));
  });

  it("package test surface runs internal-production database files one at a time and pure boundaries without database URLs", () => {
    const packageJson = JSON.parse(readFileSync(`${REPOSITORY_ROOT}package.json`, "utf8")) as {
      scripts: Record<string, string>;
    };
    assert.match(packageJson.scripts.test, /npm run test:internal-production/);
    const isolated = packageJson.scripts["test:internal-production:isolated"];
    assert.equal(typeof isolated, "string");
    for (const file of [
      "tests/internal-production/owner-admission-v1.test.ts",
      "tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts",
      "tests/internal-production/baseline-post-handoff-receipt-v1.test.ts",
    ]) {
      assert.equal(isolated.split(file).length - 1, 1, `${file} must have one isolated invocation`);
    }
    assert.equal(isolated.split("scripts/run-isolated-postgres-tests.ts").length - 1, 3);
    assert.doesNotMatch(isolated, /\*\.test|--test[^&]*tests\/internal-production\/[^ ]+\.test\.ts [^&]*tests\/internal-production\//);
    const anchored = packageJson.scripts["test:internal-production:anchored"];
    assert.equal(typeof anchored, "string");
    assert.equal(anchored.split("env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL").length - 1, 3);
    const pure = packageJson.scripts["test:internal-production:pure"];
    assert.equal(typeof pure, "string");
    assert.equal(
      pure.split("tests/internal-production/product-build-authority-v2-delivery-evidence-v1.test.ts").length - 1,
      1,
    );
    assert.match(pure, /^env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL /);
    const aggregate = [isolated, anchored, pure, packageJson.scripts["test:internal-production:manifest"]].join("\n");
    for (const file of [
      "tests/internal-production/owner-admission-v1.test.ts",
      "tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts",
      "tests/internal-production/baseline-post-handoff-receipt-v1.test.ts",
      "tests/internal-production/product-build-authority-v2-delivery-evidence-v1.test.ts",
      "tests/internal-production/task-0-source-manifest.test.ts",
    ]) {
      assert.match(aggregate, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(packageJson.scripts["test:internal-production"], /test:internal-production:manifest/);
    assert.match(packageJson.scripts["test:internal-production"], /test:internal-production:pure/);
  });
});
