#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import { constants as fsConstants, lstatSync, mkdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import postgres from "postgres";
import YAML from "yaml";
import { z } from "zod";

import { readV3AdmissionMigrationStateV1 } from "../installation/fresh-installation-v3-admission-v1.js";
import { readSelectedFreshCodexExecutionProfileV1 } from "../installation/fresh-installation-v3-profile-v1.js";
import { assertFreshInstallationSelectionUnchangedV1, freshInstallationSelectionV1 } from "../installation/fresh-installation-selection-v1.js";
import {
  EvidenceBundleV2Schema,
  computeEvidenceBundleHash,
  type EvidenceBundleV2,
} from "../evidence/evidence-bundle-v2.js";
import { AcceptedCandidateV1Schema } from "../evidence/accepted-candidate-v1.js";
import { createArtifactIndex } from "../product-compiler/artifact-index.js";
import { createArtifactInventoryStoreV1 } from "../product-compiler/artifact-inventory-store.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { verifyArtifactIndexInventory } from "../product-compiler/indexed-artifact-publisher.js";
import {
  RuntimeArtifactReaderError,
  createRuntimeArtifactReader,
} from "../product-compiler/runtime-artifact-reader.js";
import { GitObjectHashSchema, Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import type { ArtifactCapacityLimits } from "../product-compiler/artifact-capacity.js";
import {
  resolveProductArtifactCapacity,
  resolveProductArtifactDir,
  resolveConvergenceEvalResultDir,
  runtimeConfig,
  type ArtifactStorePublicationAuthorityMode,
} from "../runtime-config.js";
import { readOpenClawConfig } from "../installer/openclaw-config.js";
import { computeRunOperationalSnapshotHash } from "../server/run-operational-snapshot.js";
import { RunOperationalSnapshotV2Schema } from "../server/schemas/run-operational-snapshot-v2.js";
import type { ConvergenceCaseV1 } from "./suite-schema.js";
import {
  ConvergenceStackPackV1Schema,
  convergenceCaseHash,
} from "./suite-schema.js";
import {
  convergenceCaseHashV2,
  loadConvergenceSuiteVersioned,
  type ConvergenceCaseV2,
  type LoadedConvergenceSuiteVersioned,
  type ProductConvergenceSuiteVersioned,
} from "./suite-schema-v2.js";
import {
  ConvergenceCanonicalEvidenceV1Schema,
  ConvergenceGitHubEvidenceV1Schema,
  ConvergenceOwnershipEvidenceV1Schema,
  ConvergenceProjectionEvidenceV1Schema,
  createConvergencePreflight,
  createConvergenceResult,
  createConvergenceRunResult,
  type ConvergenceEvalResultV1,
  type ConvergenceEvalRunResultV1,
} from "./result-schema.js";
import {
  ConvergenceCanonicalEvidenceV2Schema,
  createConvergenceResultV2,
  createConvergenceRunResultV2,
  type ConvergenceEvalResultV2,
  type ConvergenceEvalResultVersioned,
  type ConvergenceEvalRunResultV2,
  type ConvergenceEvalRunResultVersioned,
} from "./result-schema-v2.js";
import {
  ContentAddressedEvalResultStore,
  convergenceResultTable,
  convergenceResultTableV2,
  stableConvergenceResultJson,
  stableConvergenceResultJsonV2,
  type StoredConvergenceArtifact,
} from "./report.js";
import {
  evaluateConvergenceReleaseGate,
  type ConvergenceReleaseGateV1,
} from "./release-gate.js";
import {
  evaluateTaskIntentOracleV1,
  taskIntentOracleHashV1,
  type TaskIntentOracleV1,
} from "./task-intent-oracle.js";
import {
  evaluateTaskIntentOracleV2,
  taskIntentOracleHashV2,
  type TaskIntentOracleActualV2,
  type TaskIntentOracleV2,
  type TaskIntentOracleVersioned,
} from "./task-intent-oracle-v2.js";
import { createV3ReleaseAdmissionRepository } from "../execution/v3-release-admission-repository.js";
import { evaluateOperationalFailureCauseEvidenceAuthorityV3 } from "../execution/operational-failure-cause-authority-v3.js";
import {
  OperationalFailureCauseV1Schema,
  operationalFailureCauseHashV1,
  type OperationalFailureCauseV1,
} from "../execution/schemas/operational-failure-cause-v1.js";
import {
  serializeInternalCanaryAdmissionContext,
  type InternalCanaryAdmissionContextV1,
} from "../execution/v3-release-admission.js";

import { ControlWorkerFatalErrorV1, isControlWorkerFatalErrorV1 } from "../execution/schemas/manual-control-worker-channel-v1.js";

export type BoundCaseIdentityV1 = Readonly<{caseId:string;caseHash:string;taskHash:string;repetition:number}>;
export interface ConvergenceJobControlV1 {
  beforeCase(value:BoundCaseIdentityV1):Promise<void>;
  onRunStarted(value:BoundCaseIdentityV1 & {admissionHash:string;slotHash:string;runId:string}):Promise<void>;
  onRunResult(value:BoundCaseIdentityV1 & {runId:string;resultHash:string}):Promise<void>;
  cancellationRequested():Promise<boolean>;
  requestOwnedRunStop(value:BoundCaseIdentityV1 & {runId:string}):Promise<"requested"|"already_terminal"|"refused">;
  onPhase(value:{phase:"preflight"|"admission"|"case_start"|"case_running"|"case_collect"|"publishing"|"finalizing"|"settling";currentCaseId:string|null;completedCases:number}):Promise<void>;
  onPublication(value:{stage:"candidate"|"cancelled_final"|"promotion_confirmed"|"final_without_promotion";resultHash:string;gateHash:string;resultStatus:"planned"|"pass"|"fail"|"blocked";gateDecision:"go"|"no_go"}):Promise<void>;
  beforeFinalization(value:{resultHash:string;gateHash:string;gateDecision:"go"|"no_go"}):Promise<"cancel"|"continue">;
}

const execFileAsync = promisify(execFile);
const TERMINAL_RUN_STATUSES = new Set(["completed", "done", "failed", "cancelled", "canceled", "error", "blocked"]);
const REQUIRED_CAPABILITIES = [
  "attempts",
  "claimBinding",
  "runtimeOwnership",
  "managerCompletion",
  "effectLedger",
  "findingRecovery",
  "evidenceLedger",
  "acceptedCandidate",
  "deploymentReceipt",
  "projectTransferAck",
] as const;
const REQUIRED_PACKET_ARTIFACT_TYPES_V1: Readonly<Record<string, string>> = Object.freeze({
  PRODUCT_SPEC: "setfarm.product-spec.v1",
  DESIGN_GRAPH: "setfarm.design-interaction-graph.v1",
  BUILD_TOPOLOGY: "setfarm.build-topology.v1",
  STORY_PLAN: "setfarm.story-plan.v1",
  PRODUCT_BUILD_PACKET: "setfarm.product-build-packet.v1",
  COMPILATION_REPORT: "setfarm.product-compilation-report.v1",
});
const REQUIRED_PACKET_ARTIFACT_TYPES_V2: Readonly<Record<string, string>> = Object.freeze({
  PRODUCT_SPEC: "setfarm.product-spec.v1",
  DESIGN_GRAPH: "setfarm.design-interaction-graph.v1",
  BUILD_TOPOLOGY: "setfarm.build-topology.v1",
  STORY_PLAN: "setfarm.story-plan.v1",
  DESIGN_SOURCE_CLOSURE: "setfarm.design-source-closure.v1",
  PRODUCT_BUILD_PACKET: "setfarm.product-build-packet.v2",
  COMPILATION_REPORT: "setfarm.product-compilation-report.v2",
});

const RunnerOptionsSchema = z.object({
  releaseSha: GitObjectHashSchema,
  execute: z.boolean(),
}).strict();

export type ConvergenceReleaseInspection = Readonly<{
  headSha: string;
  clean: boolean;
  runnerHash: string;
  environmentHash: string;
  providerId: string;
  modelId: string;
  cliReady: boolean;
  v3ActivationEnabled: boolean;
}>;

export type ConvergencePlatformInspection = Readonly<{
  migrationVerified: boolean;
  attestedReleaseSha: string | null;
  artifactIndexReady: boolean;
  activeRuns: number;
  openClaims: number;
  activeAttempts: number;
  activeRuntimes: number;
  activeRecoveryDeliveries: number;
}>;

export type ConvergenceRunPoll = Readonly<{
  runId: string;
  runNumber: number;
  status: string;
  terminal: boolean;
  protocol: string;
  compilerReleaseSha: string | null;
  actualStackPackId: string | null;
  projectLocator: string | null;
  ownership: Readonly<{
    openClaims: number;
    activeAttempts: number;
    activeRuntimes: number;
    activeRecoveryDeliveries: number;
  }>;
}>;

export type ConvergencePullRequestRef = Readonly<{
  url: string;
  mergeStatus: string | null;
}>;

export type ConvergenceScopedFailureV1 = Readonly<{
  workflowStepId: string;
  phase: string | null;
  kind: "step" | "story";
}>;

type ConvergenceCaseVersioned = ConvergenceCaseV1 | ConvergenceCaseV2;
type ConvergenceCanonicalEvidenceVersioned =
  | z.infer<typeof ConvergenceCanonicalEvidenceV1Schema>
  | z.infer<typeof ConvergenceCanonicalEvidenceV2Schema>;

export type ConvergenceRunCollection = Readonly<{
  canonical: ConvergenceCanonicalEvidenceVersioned;
  operationalFailureCause: OperationalFailureCauseV1 | null;
  scopedFailure: ConvergenceScopedFailureV1 | null;
  pullRequests: readonly ConvergencePullRequestRef[];
}>;

export interface ConvergenceSqlPort {
  inspectPlatform(): Promise<ConvergencePlatformInspection>;
  readRun(runId: string): Promise<ConvergenceRunPoll>;
  collectRun(
    runId: string,
    input: Readonly<{
      task: string;
      oracle: TaskIntentOracleVersioned;
    }>,
  ): Promise<ConvergenceRunCollection>;
  close?(): Promise<void>;
}

export interface ConvergenceHttpPort {
  health(service: "setfarm" | "mission_control"): Promise<Readonly<{ ok: boolean; evidenceHash: string }>>;
  operationalSnapshot(service: "setfarm" | "mission_control", runId: string): Promise<unknown>;
  syncProject(runId: string): Promise<Readonly<{ ok: boolean; evidenceHash: string }>>;
}

import type { ManualStartChildDescriptorV1 } from "../execution/manual-test-admission-v1.js";

export interface ConvergenceProcessPort {
  inspectRelease(): Promise<ConvergenceReleaseInspection>;
  startRun(input: Readonly<{
    workflowId: string;
    task: string;
    releaseSha: string;
    admission: InternalCanaryAdmissionContextV1;
    startChild?: ManualStartChildDescriptorV1;
  }>): Promise<Readonly<{ runId: string; runNumber: number }>>;
  inspectProject(input: Readonly<{
    projectLocator: string | null;
    canonicalSourceRevision: Readonly<{ sha: string; treeHash: string }> | null;
  }>): Promise<Readonly<{
    projectIdentityState: "not_applicable" | "provisional" | "verified" | "invalid";
    workingTreeDirty: boolean;
    manualProjectMutationDetected: boolean;
    sourceHeadMatchesCanonical: boolean;
    projectHeadSha: string | null;
    projectTreeHash: string | null;
    canonicalHeadSha: string | null;
    canonicalTreeHash: string | null;
  }>>;
  inspectGitHub(pullRequests: readonly ConvergencePullRequestRef[]): Promise<z.infer<typeof ConvergenceGitHubEvidenceV1Schema>>;
}

export interface ConvergenceArtifactPort {
  prepare(): Promise<void>;
  put(value:
    | ConvergenceEvalRunResultV1
    | ConvergenceEvalResultV1
    | ConvergenceEvalRunResultV2
    | ConvergenceEvalResultV2
    | ConvergenceReleaseGateV1
  ): Promise<StoredConvergenceArtifact>;
}

export interface ConvergenceAdmissionPort {
  createCanary(input: Readonly<{
    releaseSha: string;
    suiteHash: string;
    preflightHash: string;
    ttlMs: number;
    slots: readonly Readonly<{
      caseHash: string;
      taskHash: string;
      repetition: number;
      slotToken: string;
    }>[];
  }>): Promise<Readonly<{ contexts: readonly InternalCanaryAdmissionContextV1[] }>>;
  promoteReleaseGo(input: Readonly<{
    releaseSha: string;
    suiteHash: string;
    resultHash: string;
    resultRef: string;
    gateHash: string;
    gateRef: string;
  }>): Promise<unknown>;
}

export interface ConvergenceClock {
  now(): Date;
  sleep(milliseconds: number): Promise<void>;
}

export type ConvergenceRunnerPorts = Readonly<{
  sql: ConvergenceSqlPort;
  http: ConvergenceHttpPort;
  process: ConvergenceProcessPort;
  artifacts: ConvergenceArtifactPort;
  admissions: ConvergenceAdmissionPort;
  clock: ConvergenceClock;
}>;

export type ConvergenceSuiteRun = Readonly<{
  result: ConvergenceEvalResultVersioned;
  artifact: StoredConvergenceArtifact;
  gate: ConvergenceReleaseGateV1;
  gateArtifact: StoredConvergenceArtifact;
}>;

function safeHash(value: unknown): string {
  return hashCanonicalJson(value);
}

function convergenceCaseHashVersioned(value: ConvergenceCaseVersioned): string {
  return value.oracle.schema === "setfarm.task-intent-oracle.v2"
    ? convergenceCaseHashV2(value as ConvergenceCaseV2)
    : convergenceCaseHash(value as ConvergenceCaseV1);
}

export function taskIntentOracleHashVersioned(task: string, oracle: TaskIntentOracleVersioned): string {
  return oracle.schema === "setfarm.task-intent-oracle.v2"
    ? taskIntentOracleHashV2(task, oracle)
    : taskIntentOracleHashV1(task, oracle);
}

export function evaluateTaskIntentOracleVersioned(input: Readonly<{
  task: string;
  oracle: TaskIntentOracleVersioned;
  actual: TaskIntentOracleActualV2;
}>) {
  return input.oracle.schema === "setfarm.task-intent-oracle.v2"
    ? evaluateTaskIntentOracleV2(input as Readonly<{
        task: string;
        oracle: TaskIntentOracleV2;
        actual: TaskIntentOracleActualV2;
      }>)
    : evaluateTaskIntentOracleV1(input as Readonly<{
        task: string;
        oracle: TaskIntentOracleV1;
        actual: TaskIntentOracleActualV2;
      }>);
}

function createCanonicalEvidenceVersioned(
  oracle: TaskIntentOracleVersioned,
  payload: Readonly<Record<string, unknown>>,
): ConvergenceCanonicalEvidenceVersioned {
  const value = { ...payload, stateHash: safeHash(payload) };
  return oracle.schema === "setfarm.task-intent-oracle.v2"
    ? ConvergenceCanonicalEvidenceV2Schema.parse(value)
    : ConvergenceCanonicalEvidenceV1Schema.parse(value);
}

function createConvergenceRunResultVersioned(
  suite: ProductConvergenceSuiteVersioned,
  input: Readonly<Record<string, unknown>>,
): ConvergenceEvalRunResultVersioned {
  return suite.schema === "setfarm.product-convergence-suite.v2"
    ? createConvergenceRunResultV2({
        ...input,
        schema: "setfarm.product-convergence-run-result.v2",
        suiteVersion: 2,
      })
    : createConvergenceRunResult({
        ...input,
        schema: "setfarm.product-convergence-run-result.v1",
        suiteVersion: 1,
      });
}

function createConvergenceResultVersioned(
  suite: ProductConvergenceSuiteVersioned,
  input: Readonly<Record<string, unknown>>,
): ConvergenceEvalResultVersioned {
  return suite.schema === "setfarm.product-convergence-suite.v2"
    ? createConvergenceResultV2({
        ...input,
        schema: "setfarm.product-convergence-result.v2",
        suiteVersion: 2,
      })
    : createConvergenceResult({
        ...input,
        schema: "setfarm.product-convergence-result.v1",
        suiteVersion: 1,
      });
}

function iso(clock: ConvergenceClock): string {
  return clock.now().toISOString();
}

function reasonCode(value: string): string {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.includes("_") ? normalized.slice(0, 160) : `EVAL_${normalized || "UNKNOWN"}`;
}

function preflightCheck(
  id: z.infer<Awaited<typeof import("./result-schema.js")>["ConvergencePreflightCheckIdV1Schema"]>,
  ok: boolean,
  passCode: string,
  failCode: string,
  evidence: unknown,
) {
  return {
    id,
    status: ok ? "pass" as const : "fail" as const,
    code: reasonCode(ok ? passCode : failCode),
    evidenceHash: safeHash(evidence),
  };
}

async function settle<T>(work: () => Promise<T>): Promise<Readonly<{ ok: true; value: T } | { ok: false }>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    if (isControlWorkerFatalErrorV1(error)) throw error;
    return { ok: false };
  }
}

function suiteProfilesMatch(suite: ProductConvergenceSuiteVersioned, release: ConvergenceReleaseInspection): boolean {
  return suite.cases.every((item) =>
    item.executionProfile.providerId === release.providerId
    && item.executionProfile.modelId === release.modelId);
}

async function buildPreflight(
  suite: ProductConvergenceSuiteVersioned,
  releaseSha: string,
  execute: boolean,
  ports: ConvergenceRunnerPorts,
): Promise<Readonly<{
  preflight: ReturnType<typeof createConvergencePreflight>;
  release: ConvergenceReleaseInspection;
}>> {
  const [releaseRead, platformRead, setfarmRead, missionControlRead, storeRead] = await Promise.all([
    settle(() => ports.process.inspectRelease()),
    settle(() => ports.sql.inspectPlatform()),
    settle(() => ports.http.health("setfarm")),
    settle(() => ports.http.health("mission_control")),
    settle(async () => { await ports.artifacts.prepare(); return true; }),
  ]);
  const unavailableHash = safeHash({ status: "unavailable" });
  const release: ConvergenceReleaseInspection = releaseRead.ok
    ? releaseRead.value
    : {
        headSha: releaseSha,
        clean: false,
        runnerHash: unavailableHash,
        environmentHash: unavailableHash,
        providerId: "unavailable",
        modelId: "unavailable",
        cliReady: false,
        v3ActivationEnabled: false,
      };
  const platform: ConvergencePlatformInspection = platformRead.ok
    ? platformRead.value
    : {
        migrationVerified: false,
        attestedReleaseSha: null,
        artifactIndexReady: false,
        activeRuns: 1,
        openClaims: 1,
        activeAttempts: 1,
        activeRuntimes: 1,
        activeRecoveryDeliveries: 1,
      };
  const idle = platform.activeRuns === 0
    && platform.openClaims === 0
    && platform.activeAttempts === 0
    && platform.activeRuntimes === 0
    && platform.activeRecoveryDeliveries === 0;
  const profileMatches = releaseRead.ok
    && suiteProfilesMatch(suite, release)
    && release.cliReady
    && (!execute || release.v3ActivationEnabled);
  const checks = [
    preflightCheck(
      "release_identity",
      releaseRead.ok && release.headSha === releaseSha,
      "EVAL_RELEASE_IDENTITY_EXACT",
      "EVAL_RELEASE_IDENTITY_MISMATCH",
      { expected: releaseSha, actual: release.headSha },
    ),
    preflightCheck(
      "release_cleanliness",
      releaseRead.ok && release.clean,
      "EVAL_RELEASE_WORKTREE_CLEAN",
      "EVAL_RELEASE_WORKTREE_DIRTY",
      { clean: release.clean },
    ),
    preflightCheck(
      "migration_attestation",
      platformRead.ok && platform.migrationVerified && platform.attestedReleaseSha === releaseSha,
      "EVAL_MIGRATIONS_RELEASE_ATTESTED",
      "EVAL_MIGRATIONS_RELEASE_UNATTESTED",
      { verified: platform.migrationVerified, exact: platform.attestedReleaseSha === releaseSha },
    ),
    preflightCheck(
      "database_ownership",
      platformRead.ok && idle,
      "EVAL_DATABASE_OWNERSHIP_IDLE",
      "EVAL_DATABASE_OWNERSHIP_ACTIVE",
      {
        activeRuns: platform.activeRuns,
        openClaims: platform.openClaims,
        activeAttempts: platform.activeAttempts,
        activeRuntimes: platform.activeRuntimes,
        activeRecoveryDeliveries: platform.activeRecoveryDeliveries,
      },
    ),
    preflightCheck(
      "setfarm_health",
      setfarmRead.ok && setfarmRead.value.ok,
      "EVAL_SETFARM_HEALTHY",
      "EVAL_SETFARM_UNAVAILABLE",
      setfarmRead.ok ? setfarmRead.value.evidenceHash : unavailableHash,
    ),
    preflightCheck(
      "mission_control_health",
      missionControlRead.ok && missionControlRead.value.ok,
      "EVAL_MISSION_CONTROL_HEALTHY",
      "EVAL_MISSION_CONTROL_UNAVAILABLE",
      missionControlRead.ok ? missionControlRead.value.evidenceHash : unavailableHash,
    ),
    preflightCheck(
      "execution_profile",
      profileMatches,
      "EVAL_EXECUTION_PROFILE_PINNED",
      "EVAL_EXECUTION_PROFILE_UNPINNED",
      {
        profileMatches,
        cliReady: release.cliReady,
        activationReady: !execute || release.v3ActivationEnabled,
      },
    ),
    preflightCheck(
      "result_store",
      storeRead.ok && platformRead.ok && platform.artifactIndexReady,
      "EVAL_RESULT_STORES_READY",
      !storeRead.ok
        ? "EVAL_RESULT_STORE_UNAVAILABLE"
        : "EVAL_PRODUCT_ARTIFACT_INDEX_UNREADY",
      {
        evalResultStoreReady: storeRead.ok,
        productArtifactIndexReady: platformRead.ok && platform.artifactIndexReady,
      },
    ),
  ];
  return { preflight: createConvergencePreflight({ checks }), release };
}

function emptyCanonical(
  code: string,
  input: Readonly<{ task: string; oracle: TaskIntentOracleVersioned }>,
): ConvergenceCanonicalEvidenceVersioned {
  const packet = {
    stateHash: safeHash({ packet: "unavailable" }), packetHash: null,
    casAuditHash: safeHash({ cas: "unavailable" }), casDeepVerified: false,
    sealedStackPackId: null, packetRows: 0,
    artifactRefs: 0, missingRequiredRefs: 1, missingArtifacts: 1, invalidBindings: 1,
  };
  const attempts = {
    stateHash: safeHash({ attempts: "unavailable" }), attempts: 0, active: 0,
    duplicateActiveTuples: 0, staleOwnership: 1, incompleteBindings: 1,
  };
  const findings = {
    stateHash: safeHash({ findings: "unavailable" }), findingSets: 0, openFindings: 0, invalidBindings: 1,
  };
  const recovery = {
    stateHash: safeHash({ recovery: "unavailable" }), cases: 0, activeCases: 0,
    activeDeliveries: 0, overBudget: 0, invalidBindings: 1,
  };
  const evidence = {
    stateHash: safeHash({ evidence: "unavailable" }),
    predicateCoverageHash: safeHash({ predicates: "unavailable" }),
    bundles: 0, passing: 0,
    nonPassing: 0, missingAttemptEvidence: 1, invalidBindings: 1,
    missingExpectedPredicates: 1, unexpectedProductPredicates: 0,
    missingInvariantRefs: 1, nonPassingRequiredPredicates: 1,
  };
  const acceptance = {
    stateHash: safeHash({ acceptance: "unavailable" }), candidateHash: null,
    candidates: 0, storyEvidence: 0, sourceSha: null, sourceTreeHash: null,
    invalidBindings: 1,
  };
  const oracle = evaluateTaskIntentOracleVersioned({ ...input, actual: { kind: "unavailable" } });
  const payload = { packet, attempts, findings, recovery, evidence, acceptance, oracle, invariantCodes: [reasonCode(code)] };
  return createCanonicalEvidenceVersioned(input.oracle, payload);
}

function unavailableProjection(): z.infer<typeof ConvergenceProjectionEvidenceV1Schema> {
  const hash = safeHash({ projection: "unavailable" });
  return ConvergenceProjectionEvidenceV1Schema.parse({
    setfarmSnapshotHash: hash,
    missionControlSnapshotHash: hash,
    exactHashMatch: false,
    setfarmProjection: "unavailable",
    missionControlProjection: "unavailable",
    capabilities: Object.fromEntries(REQUIRED_CAPABILITIES.map((key) => [key, false])),
    operationalSettled: false,
    transferAcknowledged: false,
    projectTransferAckHash: null,
    projectRecordHash: null,
  });
}

async function collectProjection(
  ports: ConvergenceRunnerPorts,
  runId: string,
): Promise<{ projection: z.infer<typeof ConvergenceProjectionEvidenceV1Schema>; ordinaryPending: boolean }> {
  const [setfarmRead, missionControlRead] = await Promise.all([
    settle(() => ports.http.operationalSnapshot("setfarm", runId)),
    settle(() => ports.http.operationalSnapshot("mission_control", runId)),
  ]);
  if (!setfarmRead.ok || !missionControlRead.ok) return { projection: unavailableProjection(), ordinaryPending: false };
  const setfarm = RunOperationalSnapshotV2Schema.safeParse(setfarmRead.value);
  const missionControl = RunOperationalSnapshotV2Schema.safeParse(missionControlRead.value);
  if (!setfarm.success || !missionControl.success) return { projection: unavailableProjection(), ordinaryPending: false };
  const { snapshotHash: setfarmSnapshotHash, ...setfarmHashable } = setfarm.data;
  const { snapshotHash: missionControlSnapshotHash, ...missionControlHashable } = missionControl.data;
  if (
    setfarm.data.run.id !== runId
    || missionControl.data.run.id !== runId
    || computeRunOperationalSnapshotHash(setfarmHashable) !== setfarmSnapshotHash
    || computeRunOperationalSnapshotHash(missionControlHashable) !== missionControlSnapshotHash
    || !setfarm.data.source.capabilities.implementationSubmissionEvidence
    || !missionControl.data.source.capabilities.implementationSubmissionEvidence
  ) return { projection: unavailableProjection(), ordinaryPending: false };
  const capabilities = Object.fromEntries(REQUIRED_CAPABILITIES.map((key) => [
    key,
    setfarm.data.source.capabilities[key] === true
      && missionControl.data.source.capabilities[key] === true,
  ]));
  const setfarmAck = setfarm.data.projectTransferAck?.acknowledgement ?? null;
  const missionControlAck = missionControl.data.projectTransferAck?.acknowledgement ?? null;
  const transferAcknowledged = Boolean(
    setfarmAck
    && missionControlAck
    && setfarmAck.ackHash === missionControlAck.ackHash
    && setfarmAck.projectRecordHash === missionControlAck.projectRecordHash
    && setfarmAck.sourceSnapshotHash === missionControlAck.sourceSnapshotHash,
  );
  const snapshots = [setfarm.data, missionControl.data];
  const knownTerminal = snapshots.every(snapshot => snapshot.run.terminal
    && snapshot.summary.lifecycleState === "terminal" && snapshot.summary.health === "ok"
    && snapshot.summary.invariantViolations === 0 && snapshot.invariants.length === 0
    && snapshot.source.projection === "complete"
    && snapshot.outbox.every(item => ["pending", "leased", "published"].includes(item.state))
    && snapshot.summary.unpublishedOutbox === snapshot.outbox.filter(item => item.state !== "published").length);
  const pendingOwners = (snapshot: typeof setfarm.data) => snapshot.summary.activeClaims + snapshot.summary.activeAttempts
    + snapshot.summary.activeRuntimes + snapshot.summary.openCompletions + snapshot.summary.mandatoryEffectsPending
    + snapshot.summary.unpublishedOutbox;
  const ordinaryPending = knownTerminal && snapshots.some(snapshot => pendingOwners(snapshot) > 0);
  const operationalSettled = knownTerminal && snapshots.every((snapshot) =>
    snapshot.summary.lifecycleState === "terminal"
    && snapshot.summary.health === "ok"
    && snapshot.summary.invariantViolations === 0
    && pendingOwners(snapshot) === 0
    && snapshot.invariants.length === 0
    && snapshot.outbox.every((item) => item.state === "published"));
  return { ordinaryPending, projection: ConvergenceProjectionEvidenceV1Schema.parse({
    setfarmSnapshotHash: setfarm.data.snapshotHash,
    missionControlSnapshotHash: missionControl.data.snapshotHash,
    exactHashMatch: setfarm.data.snapshotHash === missionControl.data.snapshotHash,
    setfarmProjection: setfarm.data.source.projection,
    missionControlProjection: missionControl.data.source.projection,
    capabilities,
    operationalSettled,
    transferAcknowledged,
    projectTransferAckHash: transferAcknowledged ? setfarmAck!.ackHash : null,
    projectRecordHash: transferAcknowledged ? setfarmAck!.projectRecordHash : null,
  }) };
}

async function waitForCanonicalProjection(
  ports: ConvergenceRunnerPorts,
  runId: string,
  accepted: boolean,
  pollMs: number,
  cancellationRequested?: () => Promise<boolean>,
): Promise<z.infer<typeof ConvergenceProjectionEvidenceV1Schema>> {
  if (accepted && !await cancellationRequested?.()) await settle(() => ports.http.syncProject(runId));
  let observed = await collectProjection(ports, runId);
  let projection = observed.projection;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const complete = projection.exactHashMatch
      && projection.setfarmProjection === "complete"
      && projection.missionControlProjection === "complete"
      && projection.operationalSettled
      && Object.values(projection.capabilities).every(Boolean)
      && (accepted ? projection.transferAcknowledged : !projection.transferAcknowledged);
    const cancelled = await cancellationRequested?.();
    if (cancelled) {
      const trustworthy = projection.exactHashMatch && projection.setfarmProjection === "complete"
        && projection.missionControlProjection === "complete" && Object.values(projection.capabilities).every(Boolean);
      if (!trustworthy || (!projection.operationalSettled && !observed.ordinaryPending))
        throw new ControlWorkerFatalErrorV1("CONTROL_SETTLEMENT_UNCERTAIN");
      if (projection.operationalSettled) return projection;
    } else if (complete) return projection;
    if (!cancelled && accepted && attempt > 0 && attempt % 3 === 0) {
      await settle(() => ports.http.syncProject(runId));
    }
    await ports.clock.sleep(Math.min(5_000, Math.max(250, pollMs)));
    observed = await collectProjection(ports, runId);
    projection = observed.projection;
  }
  if (await cancellationRequested?.() && (!projection.operationalSettled || !projection.exactHashMatch
    || projection.setfarmProjection !== "complete" || projection.missionControlProjection !== "complete"
    || !Object.values(projection.capabilities).every(Boolean)))
    throw new ControlWorkerFatalErrorV1("CONTROL_SETTLEMENT_UNCERTAIN");
  return projection;
}

function runDisposition(status: string, timedOut: boolean, invalidated: boolean) {
  if (timedOut) return "timeout" as const;
  if (invalidated) return "invalidated" as const;
  const normalized = status.toLowerCase();
  if (["completed", "done"].includes(normalized)) return "completed" as const;
  if (["cancelled", "canceled"].includes(normalized)) return "cancelled" as const;
  return "failed" as const;
}

function parsedEvidence(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function canonicalConvergenceScopedFailureV1(
  rows: readonly Readonly<Record<string, unknown>>[],
): ConvergenceScopedFailureV1 | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]!;
    const workflowStepId = String(row["step_id"] ?? "").trim();
    if (!workflowStepId || workflowStepId === "run") continue;
    const storyId = String(row["story_id"] ?? "").trim();
    const phase = String(row["phase"] ?? "").trim();
    return Object.freeze({
      workflowStepId,
      phase: phase || null,
      kind: storyId ? "story" : "step",
    });
  }
  return null;
}

export function trustedOperationalFailureCauseV1(input: Readonly<{
  requestedBy: string;
  evidence: unknown;
  failedWorkflowStepIds: ReadonlySet<string>;
}>): OperationalFailureCauseV1 | null {
  const evidence = parsedEvidence(input.evidence);
  const authority = evaluateOperationalFailureCauseEvidenceAuthorityV3({
    requestedBy: input.requestedBy,
    cause: evidence["operationalFailureCause"],
    evidence,
  });
  if (!authority.trusted
    || !input.failedWorkflowStepIds.has(authority.cause.workflowStepId)) {
    return null;
  }
  return authority.cause;
}

function rootCauseForFailure(input: Readonly<{
  runId: string;
  collected: ConvergenceRunCollection;
  disposition: string;
}>): Readonly<{ hash: string; repeatable: boolean }> {
  if (input.collected.operationalFailureCause) {
    return Object.freeze({
      hash: operationalFailureCauseHashV1(input.collected.operationalFailureCause),
      repeatable: true,
    });
  }
  if (input.collected.scopedFailure) {
    return Object.freeze({
      hash: safeHash({
        schema: "setfarm.convergence-nonrepeatable-root.v1",
        runId: input.runId,
        source: "scoped_failure",
        scope: input.collected.scopedFailure,
      }),
      repeatable: false,
    });
  }
  return Object.freeze({
    hash: safeHash({
      schema: "setfarm.convergence-nonrepeatable-root.v1",
      runId: input.runId,
      source: "unattributed",
      disposition: input.disposition,
    }),
    repeatable: false,
  });
}

async function verifyReleaseStillPinned(
  releaseSha: string,
  runnerHash: string,
  ports: ConvergenceRunnerPorts,
): Promise<boolean> {
  const read = await settle(() => ports.process.inspectRelease());
  return read.ok
    && read.value.headSha === releaseSha
    && read.value.runnerHash === runnerHash
    && read.value.clean;
}

async function waitForTerminal(
  runId: string,
  suite: ProductConvergenceSuiteVersioned,
  releaseSha: string,
  ports: ConvergenceRunnerPorts,
  control?: ConvergenceJobControlV1,
  identity?: BoundCaseIdentityV1,
): Promise<Readonly<{ poll: ConvergenceRunPoll; timedOut: boolean; invalidated: boolean }>> {
  const deadline = ports.clock.now().getTime() + suite.timeout.runMs;
  let latest = await ports.sql.readRun(runId);
  let invalidated = latest.protocol !== "v3" || latest.compilerReleaseSha !== releaseSha;
  let stopRequested = false;
  const checkCancellation = async () => {
    if (control && identity && await control.cancellationRequested() && !stopRequested) {
      stopRequested = true;
      const result = await control.requestOwnedRunStop({...identity, runId});
      if (result === "refused") throw new ControlWorkerFatalErrorV1("CONTROL_SETTLEMENT_UNCERTAIN");
    }
  };
  await checkCancellation();
  while (!latest.terminal && ports.clock.now().getTime() < deadline) {
    await ports.clock.sleep(suite.timeout.pollMs);
    latest = await ports.sql.readRun(runId);
    invalidated ||= latest.protocol !== "v3" || latest.compilerReleaseSha !== releaseSha;
    await checkCancellation();
  }
  return { poll: latest, timedOut: !latest.terminal, invalidated };
}

function plannedCases(suite: ProductConvergenceSuiteVersioned): Array<Readonly<{
  value: ConvergenceCaseVersioned;
  repetition: number;
}>> {
  const planned: Array<Readonly<{ value: ConvergenceCaseVersioned; repetition: number }>> = [];
  for (const value of suite.cases) {
    for (let repetition = 1; repetition <= suite.repetitionsPerCase; repetition += 1) {
      planned.push({ value, repetition });
    }
  }
  return planned;
}

export async function runConvergenceSuite(
  loaded: LoadedConvergenceSuiteVersioned,
  rawOptions: Readonly<{ releaseSha: string; execute?: boolean; control?: ConvergenceJobControlV1 }>,
  ports: ConvergenceRunnerPorts,
): Promise<ConvergenceSuiteRun> {
  const options = RunnerOptionsSchema.parse({
    releaseSha: rawOptions.releaseSha,
    execute: rawOptions.execute === true,
  });
  const control = rawOptions.control;
  let cancelled = false;
  const checkCancellation = async () => {
    if (control && await control.cancellationRequested()) cancelled = true;
    return cancelled;
  };
  const startedAt = iso(ports.clock);
  await control?.onPhase({phase:"preflight",currentCaseId:null,completedCases:0});
  await checkCancellation();
  const { preflight, release } = await buildPreflight(
    loaded.suite,
    options.releaseSha,
    options.execute,
    ports,
  );
  const planned = plannedCases(loaded.suite);
  const runs: ConvergenceEvalRunResultVersioned[] = [];
  const rootCounts = new Map<string, number>();
  const repeatableRootCounts = new Map<string, number>();
  const blockers = new Set<string>();
  let repeatedRootCause: string | null = null;
  let canaryContexts = new Map<string, InternalCanaryAdmissionContextV1>();

  if (preflight.status !== "pass") blockers.add("EVAL_PREFLIGHT_BLOCKED");

  await control?.onPhase({phase:"admission",currentCaseId:null,completedCases:0});
  if (await checkCancellation()) blockers.add("EVAL_CANCEL_REQUESTED");
  if (options.execute && preflight.status === "pass" && !cancelled) {
    const ttlMs = (planned.length * loaded.suite.timeout.runMs) + 60 * 60 * 1_000;
    const creation = await settle(() => ports.admissions.createCanary({
      releaseSha: options.releaseSha,
      suiteHash: loaded.suiteHash,
      preflightHash: preflight.preflightHash,
      ttlMs,
      slots: planned.map((item) => ({
        caseHash: convergenceCaseHashVersioned(item.value),
        taskHash: safeHash(item.value.task),
        repetition: item.repetition,
        slotToken: randomBytes(32).toString("base64url"),
      })),
    }));
    if (!creation.ok) {
      blockers.add("EVAL_CANARY_ADMISSION_FAILED");
    } else {
      canaryContexts = new Map(creation.value.contexts.map((context) => [
        `${context.caseHash}:${context.taskHash}:${context.repetition}`,
        context,
      ]));
      if (canaryContexts.size !== planned.length) {
        blockers.add("EVAL_CANARY_ADMISSION_INCOMPLETE");
      }
    }
  }

  if (options.execute && preflight.status === "pass" && blockers.size === 0) {
    for (const item of planned) {
      const identity: BoundCaseIdentityV1 = {caseId:item.value.caseId,caseHash:convergenceCaseHashVersioned(item.value),taskHash:safeHash(item.value.task),repetition:item.repetition};
      if (await checkCancellation()) { blockers.add("EVAL_CANCEL_REQUESTED"); break; }
      await control?.onPhase({phase:"case_start",currentCaseId:item.value.caseId,completedCases:runs.length});
      await control?.beforeCase(identity);
      if (await checkCancellation()) { blockers.add("EVAL_CANCEL_REQUESTED"); break; }
      if (!await verifyReleaseStillPinned(options.releaseSha, release.runnerHash, ports)) {
        blockers.add("EVAL_RELEASE_IDENTITY_DRIFT");
        break;
      }
      const platformRead = await settle(() => ports.sql.inspectPlatform());
      if (!platformRead.ok || !platformRead.value.artifactIndexReady) {
        blockers.add("EVAL_PRODUCT_ARTIFACT_INDEX_UNREADY");
        break;
      }
      const idle = platformRead.ok
        && platformRead.value.activeRuns === 0
        && platformRead.value.openClaims === 0
        && platformRead.value.activeAttempts === 0
        && platformRead.value.activeRuntimes === 0
        && platformRead.value.activeRecoveryDeliveries === 0;
      if (!idle) {
        blockers.add("EVAL_ACTIVE_OWNERSHIP_CONFLICT");
        break;
      }

      const runStartedAt = iso(ports.clock);
      const caseHash = convergenceCaseHashVersioned(item.value);
      const taskHash = safeHash(item.value.task);
      const admission = canaryContexts.get(`${caseHash}:${taskHash}:${item.repetition}`);
      if (!admission) {
        blockers.add("EVAL_CANARY_ADMISSION_INCOMPLETE");
        break;
      }
      if (await checkCancellation()) { blockers.add("EVAL_CANCEL_REQUESTED"); break; }
      const startRead = await settle(() => ports.process.startRun({
        workflowId: loaded.suite.workflowId,
        task: item.value.task,
        releaseSha: options.releaseSha,
        admission,
      }));
      if (!startRead.ok) {
        blockers.add("EVAL_RUN_START_FAILED");
        break;
      }
      await control?.onRunStarted({...identity,admissionHash:admission.admissionHash,slotHash:admission.slotHash,runId:startRead.value.runId});
      await control?.onPhase({phase:"case_running",currentCaseId:item.value.caseId,completedCases:runs.length});
      const terminal = await waitForTerminal(
        startRead.value.runId,
        loaded.suite,
        options.releaseSha,
        ports,
        control,
        identity,
      );
      await checkCancellation();
      await control?.onPhase({phase:"case_collect",currentCaseId:item.value.caseId,completedCases:runs.length});
      const collectionRead = await settle(() => ports.sql.collectRun(startRead.value.runId, {
        task: item.value.task,
        oracle: item.value.oracle,
      }));
      const collected: ConvergenceRunCollection = collectionRead.ok
        ? collectionRead.value
        : {
            canonical: emptyCanonical("EVAL_CANONICAL_COLLECTION_UNAVAILABLE", {
              task: item.value.task,
              oracle: item.value.oracle,
            }),
            operationalFailureCause: null,
            scopedFailure: null,
            pullRequests: [],
          };
      const expectedDecision = item.value.oracle.expectedDecision;
      const projection = await waitForCanonicalProjection(
        ports,
        startRead.value.runId,
        expectedDecision.kind === "accepted_candidate",
        loaded.suite.timeout.pollMs,
        checkCancellation,
      );
      const projectRead = expectedDecision.kind === "typed_rejection"
          ? { ok: true as const, value: {
            projectIdentityState: "not_applicable" as const,
            workingTreeDirty: false,
            manualProjectMutationDetected: false,
            sourceHeadMatchesCanonical: true,
            projectHeadSha: null,
            projectTreeHash: null,
            canonicalHeadSha: null,
            canonicalTreeHash: null,
          } }
        : await settle(() => ports.process.inspectProject({
            projectLocator: terminal.poll.projectLocator,
            canonicalSourceRevision: collected.canonical.acceptance.sourceSha
              && collected.canonical.acceptance.sourceTreeHash
              ? {
                  sha: collected.canonical.acceptance.sourceSha,
                  treeHash: collected.canonical.acceptance.sourceTreeHash,
                }
              : null,
          }));
      const project = projectRead.ok
        ? projectRead.value
        : {
            projectIdentityState: "invalid" as const,
            workingTreeDirty: false,
            manualProjectMutationDetected: false,
            sourceHeadMatchesCanonical: false,
            projectHeadSha: null,
            projectTreeHash: null,
            canonicalHeadSha: null,
            canonicalTreeHash: null,
          };
      const ownershipPayload = {
        ...terminal.poll.ownership,
        projectIdentityState: project.projectIdentityState,
        workingTreeDirty: project.workingTreeDirty,
        manualProjectMutationDetected: project.manualProjectMutationDetected,
        sourceHeadMatchesCanonical: project.sourceHeadMatchesCanonical,
        projectHeadSha: project.projectHeadSha,
        projectTreeHash: project.projectTreeHash,
        canonicalHeadSha: project.canonicalHeadSha,
        canonicalTreeHash: project.canonicalTreeHash,
      };
      const ownership = ConvergenceOwnershipEvidenceV1Schema.parse({
        ...ownershipPayload,
        stateHash: safeHash(ownershipPayload),
      });
      const githubRead = await settle(() => ports.process.inspectGitHub(collected.pullRequests));
      const github = githubRead.ok
        ? githubRead.value
        : ConvergenceGitHubEvidenceV1Schema.parse({
            stateHash: safeHash({ github: "unavailable" }),
            pullRequests: Math.max(1, collected.pullRequests.length),
            unverified: Math.max(1, collected.pullRequests.length),
            open: 0,
          });
      const identityInvalidated = terminal.invalidated || terminal.poll.runNumber !== startRead.value.runNumber;
      const disposition = runDisposition(terminal.poll.status, terminal.timedOut, identityInvalidated);
      const actualStack = ConvergenceStackPackV1Schema.safeParse(
        collected.canonical.packet.sealedStackPackId,
      );
      const runPayload = {
        schema: "setfarm.product-convergence-run-result.v1" as const,
        suiteId: loaded.suite.suiteId,
        suiteVersion: loaded.suite.suiteVersion,
        suiteHash: loaded.suiteHash,
        caseId: item.value.caseId,
        caseHash,
        productClass: item.value.productClass,
        repetition: item.repetition,
        runId: startRead.value.runId,
        runNumber: terminal.poll.runNumber,
        protocol: "v3" as const,
        releaseSha: options.releaseSha,
        taskHash,
        oracleHash: taskIntentOracleHashVersioned(item.value.task, item.value.oracle),
        expectedDecision: expectedDecision.kind,
        expectedProviderHash: safeHash(item.value.executionProfile.providerId),
        expectedModelHash: safeHash(item.value.executionProfile.modelId),
        expectedStackHash: safeHash(expectedDecision.kind === "accepted_candidate" ? expectedDecision.stackPackId : null),
        runnerHash: release.runnerHash,
        environmentHash: release.environmentHash,
        expectedStackPackId: expectedDecision.kind === "accepted_candidate" ? expectedDecision.stackPackId : null,
        actualStackPackId: actualStack.success ? actualStack.data : null,
        runtimeAdapter: expectedDecision.kind === "accepted_candidate" ? expectedDecision.runtimeAdapter : null,
        startedAt: runStartedAt,
        finishedAt: iso(ports.clock),
        disposition,
        passed: false,
        rootCauseHash: null,
        canonical: collected.canonical,
        projection,
        ownership,
        github,
      };
      let passed = false;
      try {
        createConvergenceRunResultVersioned(loaded.suite, { ...runPayload, passed: true, rootCauseHash: null });
        passed = true;
      } catch {
        passed = false;
      }
      const stableRunIdentity = !terminal.timedOut
        && !identityInvalidated
        && project.projectIdentityState !== "invalid";
      const releaseStillPinned = stableRunIdentity
        ? await verifyReleaseStillPinned(options.releaseSha, release.runnerHash, ports)
        : false;
      const rootCause = passed ? null : rootCauseForFailure({
        runId: startRead.value.runId,
        collected,
        disposition,
      });
      const rootCauseHash = rootCause?.hash ?? null;
      const runResult = createConvergenceRunResultVersioned(loaded.suite, { ...runPayload, passed, rootCauseHash });
      await ports.artifacts.put(runResult);
      runs.push(runResult);
      await control?.onRunResult({...identity,runId:startRead.value.runId,resultHash:runResult.resultHash});
      if (rootCauseHash) {
        rootCounts.set(rootCauseHash, (rootCounts.get(rootCauseHash) ?? 0) + 1);
      }
      if (await checkCancellation()) { blockers.add("EVAL_CANCEL_REQUESTED"); break; }
      if (terminal.timedOut) {
        blockers.add("EVAL_RUN_TIMEOUT_ACTIVE_OWNERSHIP");
        break;
      }
      if (identityInvalidated || project.projectIdentityState === "invalid") {
        blockers.add("EVAL_RUN_IDENTITY_INVALIDATED");
        break;
      }
      if (!releaseStillPinned) {
        blockers.add("EVAL_RELEASE_IDENTITY_DRIFT");
        break;
      }
      // A cause becomes repeatable only after the run, project, source and
      // release identities that define "unchanged" have all survived the
      // execution. Never let a stale or timed-out observation stop the suite.
      if (rootCauseHash && rootCause?.repeatable === true) {
        const count = (repeatableRootCounts.get(rootCauseHash) ?? 0) + 1;
        repeatableRootCounts.set(rootCauseHash, count);
        if (count >= loaded.suite.rootCauseRepeatLimit) {
          repeatedRootCause = rootCauseHash;
          blockers.add("EVAL_REPEATED_ROOT_CAUSE_STOP");
          break;
        }
      }
    }
  }

  await control?.onPhase({phase:"publishing",currentCaseId:null,completedCases:runs.length});
  if (await checkCancellation()) blockers.add("EVAL_CANCEL_REQUESTED");
  const complete = runs.length === planned.length;
  const allPassed = complete && runs.every((item) => item.passed);
  const status = cancelled ? "blocked" as const : !options.execute
    ? preflight.status === "pass" ? "planned" as const : "blocked" as const
    : allPassed
      ? "pass" as const
      : complete && repeatedRootCause === null
        ? "fail" as const
        : "blocked" as const;
  let result = createConvergenceResultVersioned(loaded.suite, {
    suiteId: loaded.suite.suiteId,
    suiteHash: loaded.suiteHash,
    releaseSha: options.releaseSha,
    runnerHash: release.runnerHash,
    environmentHash: release.environmentHash,
    executionMode: options.execute ? "execute" : "preflight",
    startedAt,
    finishedAt: iso(ports.clock),
    plannedRuns: planned.length,
    status,
    preflight,
    runs,
    rootCauseCounts: [...rootCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([rootCauseHash, count]) => ({ rootCauseHash, count })),
    stoppedOnRepeatedRootCause: repeatedRootCause,
    blockerCodes: [...blockers].sort(),
  });
  let artifact = await ports.artifacts.put(result);
  let gate = evaluateConvergenceReleaseGate(result);
  let gateArtifact = await ports.artifacts.put(gate);
  const publish = async (stage: Parameters<ConvergenceJobControlV1["onPublication"]>[0]["stage"]) => {
    await control?.onPublication({stage,resultHash:result.resultHash,gateHash:gate.gateHash,resultStatus:result.status,gateDecision:gate.decision});
  };
  await publish("candidate");
  await control?.onPhase({phase:"finalizing",currentCaseId:null,completedCases:runs.length});
  const decision = control ? await control.beforeFinalization({resultHash:result.resultHash,gateHash:gate.gateHash,gateDecision:gate.decision}) : "continue";
  if (decision === "cancel") {
    if (!result.blockerCodes.includes("EVAL_CANCEL_REQUESTED")) {
      const {resultHash:_hash,schema:_schema,suiteVersion:_version,...payload}=result;
      result=createConvergenceResultVersioned(loaded.suite,{...payload,status:"blocked",blockerCodes:[...payload.blockerCodes,"EVAL_CANCEL_REQUESTED"].sort()});
      artifact=await ports.artifacts.put(result);
      gate=evaluateConvergenceReleaseGate(result);
      gateArtifact=await ports.artifacts.put(gate);
    }
    await publish("cancelled_final");
  } else if (gate.decision === "go") {
    await ports.admissions.promoteReleaseGo({
      releaseSha: options.releaseSha,
      suiteHash: loaded.suiteHash,
      resultHash: artifact.hash,
      resultRef: artifact.locator,
      gateHash: gateArtifact.hash,
      gateRef: gateArtifact.locator,
    });
    await publish("promotion_confirmed");
  } else {
    await publish("final_without_promotion");
  }
  return Object.freeze({ result, artifact, gate, gateArtifact });
}

type UnsafeSql = ReturnType<typeof postgres>;

function integer(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeSqlValue(value: unknown): unknown {
  if (value instanceof Date) {
    return { $sqlType: "timestamp", value: value.toISOString() };
  }
  if (typeof value === "bigint") {
    return { $sqlType: "bigint", value: value.toString(10) };
  }
  if (value instanceof Uint8Array) {
    return { $sqlType: "bytes", value: Buffer.from(value).toString("hex") };
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeSqlValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalizeSqlValue(item)]));
  }
  return value;
}

function sortedRows(rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return rows
    .map((row) => normalizeSqlValue(row) as Record<string, unknown>)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function exactStrings(left: readonly string[], right: readonly string[]): boolean {
  const first = [...left].sort();
  const second = [...right].sort();
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function parseContext(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

const PlanClarificationRecordV1Schema = z.object({
  schema: z.literal("setfarm.v3-plan-clarification-record.v1"),
  disposition: z.literal("clarification_required"),
  owner: z.literal("compiler"),
  runId: z.string().min(1).max(500),
  stepDbId: z.string().min(1).max(500),
  claimId: z.union([z.string().min(1).max(500), z.number().int().positive()]),
  sourceTaskHash: Sha256Schema,
  rejectionHash: Sha256Schema,
  rejection: z.unknown(),
  terminal: z.object({
    outcome: z.literal("blocked"),
    reasonCode: z.literal("product_spec_clarification_required"),
    modelRedispatchBudget: z.literal(0),
  }).strict(),
}).strict();

async function collectTypedRejectionRun(
  sql: UnsafeSql,
  runId: string,
  run: Readonly<Record<string, unknown>>,
  input: Readonly<{ task: string; oracle: TaskIntentOracleVersioned }>,
): Promise<ConvergenceRunCollection> {
  const [planRows, planClaimRows, terminationRows, countRows, pullRequestRows] = await Promise.all([
    sql.unsafe<Array<Record<string, unknown>>>(
      `SELECT id, status, output, retry_count
         FROM steps WHERE run_id = $1 AND step_id = 'plan'
         ORDER BY id`,
      [runId],
    ),
    sql.unsafe<Array<Record<string, unknown>>>(
      `SELECT id, outcome, diagnostic
         FROM claim_log WHERE run_id = $1 AND step_id = 'plan' AND story_id IS NULL
         ORDER BY claimed_at, id`,
      [runId],
    ),
    sql.unsafe<Array<Record<string, unknown>>>(
      `SELECT request_id, target_status, state, requested_by, evidence
         FROM run_termination_requests WHERE run_id = $1
         ORDER BY requested_at, request_id`,
      [runId],
    ),
    sql.unsafe<Array<Record<string, unknown>>>(
      `SELECT
         (SELECT COUNT(*)::integer FROM product_packets WHERE run_id = $1) AS packet_rows,
         (SELECT COUNT(*)::integer FROM run_artifact_refs WHERE run_id = $1) AS artifact_refs,
         (SELECT COUNT(*)::integer FROM execution_attempts WHERE run_id = $1) AS attempts,
         (SELECT COUNT(*)::integer FROM execution_attempts WHERE run_id = $1 AND disposition IN ('claimed', 'running')) AS active_attempts,
         (SELECT COUNT(*)::integer FROM finding_sets WHERE run_id = $1) AS finding_sets,
         (SELECT COUNT(*)::integer FROM findings f JOIN finding_sets fs ON fs.finding_set_hash = f.finding_set_hash WHERE fs.run_id = $1 AND f.status = 'open') AS open_findings,
         (SELECT COUNT(*)::integer FROM recovery_cases WHERE run_id = $1) AS recovery_cases,
         (SELECT COUNT(*)::integer FROM recovery_cases WHERE run_id = $1 AND status IN ('open', 'repairing', 'evidencing')) AS active_recovery_cases,
         (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries WHERE run_id = $1) AS recovery_deliveries,
         (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries WHERE run_id = $1 AND state IN ('authorized', 'leased', 'attempt_reserved', 'running')) AS active_recovery_deliveries,
         (SELECT COUNT(*)::integer FROM evidence_bundles WHERE run_id = $1) AS evidence_bundles,
         (SELECT COUNT(*)::integer FROM stories WHERE run_id = $1) AS stories,
         (SELECT COUNT(*)::integer FROM accepted_candidates WHERE run_id = $1) AS accepted_candidates,
         (SELECT COUNT(*)::integer FROM accepted_candidate_story_evidence child JOIN accepted_candidates candidate ON candidate.candidate_hash = child.candidate_hash WHERE candidate.run_id = $1) AS accepted_story_evidence`,
      [runId],
    ),
    sql.unsafe<Array<Record<string, unknown>>>(
      `SELECT pr_url, merge_status FROM stories
        WHERE run_id = $1 AND NULLIF(pr_url, '') IS NOT NULL
        ORDER BY story_id, pr_url`,
      [runId],
    ),
  ]);
  const counts = countRows[0] ?? {};
  let rawRecord: unknown;
  try {
    rawRecord = JSON.parse(String(planRows[0]?.["output"] ?? ""));
  } catch {
    rawRecord = undefined;
  }
  const record = PlanClarificationRecordV1Schema.safeParse(rawRecord);
  const terminationEvidence = parseContext(terminationRows[0]?.["evidence"]);
  const terminationCause = OperationalFailureCauseV1Schema.safeParse(
    terminationEvidence["operationalFailureCause"],
  );
  const recordValid = planRows.length === 1
    && planRows[0]?.["status"] === "failed"
    && integer(planRows[0]?.["retry_count"]) === 0
    && record.success
    && record.data.runId === runId
    && planClaimRows.length === 1
    && String(planClaimRows[0]?.["id"] ?? "") === String(record.data.claimId)
    && planClaimRows[0]?.["outcome"] === "completed"
    && record.data.sourceTaskHash === createHash("sha256").update(Buffer.from(input.task, "utf8")).digest("hex")
    && record.data.rejectionHash === hashCanonicalJson(record.data.rejection);
  const terminationValid = terminationRows.length === 1
    && terminationRows[0]?.["target_status"] === "failed"
    && terminationRows[0]?.["state"] === "terminalized"
    && terminationRows[0]?.["requested_by"] === "setfarm.product-compiler.plan-refusal"
    && terminationEvidence["owner"] === "compiler"
    && terminationEvidence["modelRedispatchBudget"] === 0
    && terminationCause.success
    && terminationCause.data.workflowStepId === "plan"
    && terminationCause.data.boundary === "product_compiler.plan_refusal"
    && terminationCause.data.failureClass === "contract_invalid"
    && terminationCause.data.failureCode === "V3_PLAN_CLARIFICATION_REQUIRED"
    && record.success
    && terminationEvidence["sourceTaskHash"] === record.data.sourceTaskHash
    && terminationEvidence["rejectionHash"] === record.data.rejectionHash;
  const oracle = record.success
    ? evaluateTaskIntentOracleVersioned({
        ...input,
        actual: {
          kind: "typed_rejection",
          rejection: record.data.rejection,
          owner: record.data.owner,
          modelRedispatchBudget: record.data.terminal.modelRedispatchBudget,
        },
      })
    : evaluateTaskIntentOracleVersioned({ ...input, actual: { kind: "unavailable" } });
  const packetRows = integer(counts["packet_rows"]);
  const artifactRefs = integer(counts["artifact_refs"]);
  const attemptCount = integer(counts["attempts"]);
  const activeAttempts = integer(counts["active_attempts"]);
  const findingSets = integer(counts["finding_sets"]);
  const openFindings = integer(counts["open_findings"]);
  const recoveryCases = integer(counts["recovery_cases"]);
  const activeRecoveryCases = integer(counts["active_recovery_cases"]);
  const recoveryDeliveries = integer(counts["recovery_deliveries"]);
  const activeRecoveryDeliveries = integer(counts["active_recovery_deliveries"]);
  const evidenceBundles = integer(counts["evidence_bundles"]);
  const storyCount = integer(counts["stories"]);
  const acceptedCandidates = integer(counts["accepted_candidates"]);
  const acceptedStoryEvidence = integer(counts["accepted_story_evidence"]);
  const runPacketRef = Boolean(run["packet_hash"]);
  const runAcceptedCandidateRef = Boolean(run["accepted_candidate_hash"]);
  const runContext = parseContext(run["context"]);
  const contextSideEffects = ["stack_pack_id", "detected_stack", "repo"]
    .filter((key) => Boolean(runContext[key])).length;
  const packet = {
    stateHash: safeHash({ packetRows, artifactRefs }),
    packetHash: null,
    casAuditHash: safeHash({ expectedDecision: "typed_rejection", recordValid }),
    casDeepVerified: false,
    sealedStackPackId: null,
    packetRows,
    artifactRefs,
    missingRequiredRefs: 0,
    missingArtifacts: 0,
    invalidBindings: packetRows + artifactRefs + (runPacketRef ? 1 : 0) + contextSideEffects,
  };
  const attempts = {
    stateHash: safeHash({ attemptCount, activeAttempts }),
    attempts: attemptCount,
    active: activeAttempts,
    duplicateActiveTuples: 0,
    staleOwnership: 0,
    incompleteBindings: attemptCount,
  };
  const findings = {
    stateHash: safeHash({ findingSets, openFindings }),
    findingSets,
    openFindings,
    invalidBindings: findingSets,
  };
  const recovery = {
    stateHash: safeHash({ recoveryCases, recoveryDeliveries }),
    cases: recoveryCases,
    activeCases: activeRecoveryCases,
    activeDeliveries: activeRecoveryDeliveries,
    overBudget: 0,
    invalidBindings: recoveryCases + recoveryDeliveries,
  };
  const evidence = {
    stateHash: safeHash({ evidenceBundles }),
    predicateCoverageHash: safeHash({ predicates: [] }),
    bundles: evidenceBundles,
    passing: 0,
    nonPassing: evidenceBundles,
    missingAttemptEvidence: 0,
    invalidBindings: evidenceBundles,
    missingExpectedPredicates: 0,
    unexpectedProductPredicates: 0,
    missingInvariantRefs: 0,
    nonPassingRequiredPredicates: 0,
  };
  const acceptance = {
    stateHash: safeHash({ acceptedCandidates, acceptedStoryEvidence }),
    candidateHash: null,
    candidates: acceptedCandidates,
    storyEvidence: acceptedStoryEvidence,
    sourceSha: null,
    sourceTreeHash: null,
    invalidBindings: acceptedCandidates + acceptedStoryEvidence + (runAcceptedCandidateRef ? 1 : 0),
  };
  const invariantCodes = new Set<string>();
  if (!recordValid) invariantCodes.add("EVAL_TYPED_REJECTION_RECORD_INVALID");
  if (!terminationValid) invariantCodes.add("EVAL_TYPED_REJECTION_TERMINATION_INVALID");
  if (planClaimRows.length > 1) invariantCodes.add("EVAL_TYPED_REJECTION_REDISPATCH_DETECTED");
  if (oracle.mismatchCodes.length > 0) invariantCodes.add("EVAL_TASK_INTENT_ORACLE_MISMATCH");
  if (packetRows + artifactRefs + attemptCount + findingSets + recoveryCases + recoveryDeliveries
    + evidenceBundles + storyCount + acceptedCandidates + acceptedStoryEvidence + pullRequestRows.length
    + (runPacketRef ? 1 : 0) + (runAcceptedCandidateRef ? 1 : 0) + contextSideEffects > 0) {
    invariantCodes.add("EVAL_TYPED_REJECTION_DOWNSTREAM_SIDE_EFFECT");
  }
  const canonicalPayload = {
    packet,
    attempts,
    findings,
    recovery,
    evidence,
    acceptance,
    oracle,
    invariantCodes: [...invariantCodes].sort(),
  };
  const canonical = createCanonicalEvidenceVersioned(input.oracle, canonicalPayload);
  return {
    canonical,
    operationalFailureCause: null,
    scopedFailure: null,
    pullRequests: pullRequestRows.map((row) => ({
      url: String(row["pr_url"]),
      mergeStatus: row["merge_status"] ? String(row["merge_status"]) : null,
    })),
  };
}

function validatedEvidenceBundle(row: Readonly<Record<string, unknown>>): EvidenceBundleV2 | undefined {
  const parsed = EvidenceBundleV2Schema.safeParse(row["payload"]);
  if (!parsed.success) return undefined;
  const bundle = parsed.data;
  if (
    computeEvidenceBundleHash(bundle) !== String(row["evidence_bundle_hash"] ?? "")
    || bundle.evidenceId !== String(row["evidence_id"] ?? "")
    || bundle.runId !== String(row["run_id"] ?? "")
    || bundle.storyId !== String(row["story_id"] ?? "")
    || bundle.packetHash !== String(row["packet_hash"] ?? "")
    || bundle.sliceHash !== String(row["slice_hash"] ?? "")
    || bundle.sourceRevision.sha !== String(row["source_sha"] ?? "")
    || bundle.sourceRevision.treeHash !== String(row["source_tree_hash"] ?? "")
    || (bundle.attemptId ?? "") !== String(row["attempt_id"] ?? "")
    || bundle.aggregateVerdict !== String(row["aggregate_verdict"] ?? "")
  ) return undefined;
  return bundle;
}

export type ConvergencePredicateObservation = Readonly<{
  predicateRef: string;
  invariantRef: string;
  required: boolean;
  verdict: string;
}>;

export function evaluateConvergencePredicateCoverage(input: Readonly<{
  predicates: readonly ConvergencePredicateObservation[];
  requiredPredicateRefs: readonly string[];
  invariantRefs: readonly string[];
}>): Readonly<{
  predicateCoverageHash: string;
  missingExpectedPredicates: number;
  unexpectedProductPredicates: number;
  missingInvariantRefs: number;
  nonPassingRequiredPredicates: number;
}> {
  const requiredPredicates = input.predicates.filter((predicate) => predicate.required);
  const passingPredicates = requiredPredicates.filter((predicate) => predicate.verdict === "pass");
  const passingPredicateRefs = new Set(passingPredicates.map((predicate) => predicate.predicateRef));
  const passingInvariantRefs = new Set(passingPredicates.map((predicate) => predicate.invariantRef));
  const actualProductPredicateRefs = new Set(passingPredicates
    .map((predicate) => predicate.predicateRef)
    .filter((reference) => !reference.startsWith("EVID_COMMAND_")));
  const expectedPredicateRefs = new Set(input.requiredPredicateRefs);
  return Object.freeze({
    predicateCoverageHash: safeHash(sortedRows(input.predicates.map((predicate) => ({ ...predicate })))),
    missingExpectedPredicates: [...expectedPredicateRefs].filter((reference) => !passingPredicateRefs.has(reference)).length,
    unexpectedProductPredicates: [...actualProductPredicateRefs].filter((reference) => !expectedPredicateRefs.has(reference)).length,
    missingInvariantRefs: input.invariantRefs.filter((reference) => !passingInvariantRefs.has(reference)).length,
    nonPassingRequiredPredicates: requiredPredicates.filter((predicate) => predicate.verdict !== "pass").length,
  });
}

export function createPostgresConvergencePort(
  sql: UnsafeSql,
  options: Readonly<{
    artifactRoot?: string;
    artifactLimits?: ArtifactCapacityLimits;
    publicationAuthorityMode?: ArtifactStorePublicationAuthorityMode;
  }> = {},
): ConvergenceSqlPort {
  const artifactRoot = options.artifactRoot ?? resolveProductArtifactDir();
  const artifactLimits = options.artifactLimits ?? resolveProductArtifactCapacity();
  const artifactReader = createRuntimeArtifactReader({
    sql,
    artifactRoot,
    artifactLimits,
    ...(options.publicationAuthorityMode
      ? { publicationAuthorityMode: options.publicationAuthorityMode }
      : {}),
  });
  const artifactStore = artifactReader.store;
  const artifactIndex = createArtifactIndex(sql);
  const artifactInventoryStore = createArtifactInventoryStoreV1({
    sql,
    artifactRoot,
    artifactLimits,
    purpose: "inventory-verify",
    publicationAuthorityMode: artifactReader.publicationAuthority,
  }).store;
  return {
    async inspectPlatform() {
      let migrationVerified = false;
      let attestedReleaseSha: string | null = null;
      let artifactIndexReady = false;
      try {
        const verified = await readV3AdmissionMigrationStateV1(sql);
        migrationVerified = verified.status === "verified";
        attestedReleaseSha = verified.verifiedReleaseSha;
      } catch {
        migrationVerified = false;
      }
      try {
        const verified = await verifyArtifactIndexInventory({
          index: artifactIndex,
          store: artifactInventoryStore,
        });
        artifactIndexReady = verified.capacity.state === "ready";
      } catch {
        artifactIndexReady = false;
      }
      const rows = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT
           (SELECT COUNT(*)::integer FROM runs WHERE status IN ('running', 'resuming')) AS active_runs,
           (SELECT COUNT(*)::integer FROM claim_log WHERE outcome IS NULL) AS open_claims,
           (SELECT COUNT(*)::integer FROM execution_attempts WHERE disposition IN ('claimed', 'running')) AS active_attempts,
           (SELECT COUNT(*)::integer FROM runtime_sessions WHERE state IN ('reserved', 'starting', 'running', 'drain_requested')) AS active_runtimes,
           (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries WHERE state IN ('authorized', 'leased', 'attempt_reserved', 'running')) AS active_recovery_deliveries`,
      );
      const row = rows[0] ?? {};
      return {
        migrationVerified,
        attestedReleaseSha,
        artifactIndexReady,
        activeRuns: integer(row["active_runs"]),
        openClaims: integer(row["open_claims"]),
        activeAttempts: integer(row["active_attempts"]),
        activeRuntimes: integer(row["active_runtimes"]),
        activeRecoveryDeliveries: integer(row["active_recovery_deliveries"]),
      };
    },

    async readRun(runId) {
      const rows = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT r.id, r.run_number, r.status, r.protocol, r.compiler_release_sha, r.context,
                (SELECT COUNT(*)::integer FROM claim_log cl WHERE cl.run_id = r.id AND cl.outcome IS NULL) AS open_claims,
                (SELECT COUNT(*)::integer FROM execution_attempts ea WHERE ea.run_id = r.id AND ea.disposition IN ('claimed', 'running')) AS active_attempts,
                (SELECT COUNT(*)::integer FROM runtime_sessions rs WHERE rs.run_id = r.id AND rs.state IN ('reserved', 'starting', 'running', 'drain_requested')) AS active_runtimes,
                (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries rd WHERE rd.run_id = r.id AND rd.state IN ('authorized', 'leased', 'attempt_reserved', 'running')) AS active_recovery_deliveries
           FROM runs r WHERE r.id = $1 LIMIT 1`,
        [runId],
      );
      const row = rows[0];
      if (!row) throw new Error("EVAL_RUN_NOT_FOUND");
      const context = parseContext(row["context"]);
      const status = String(row["status"] ?? "unknown");
      return {
        runId: String(row["id"]),
        runNumber: integer(row["run_number"]),
        status,
        terminal: TERMINAL_RUN_STATUSES.has(status.toLowerCase()),
        protocol: String(row["protocol"] ?? ""),
        compilerReleaseSha: row["compiler_release_sha"] ? String(row["compiler_release_sha"]) : null,
        actualStackPackId: context["stack_pack_id"] ? String(context["stack_pack_id"]) : context["detected_stack"] ? String(context["detected_stack"]) : null,
        projectLocator: context["repo"] ? String(context["repo"]) : null,
        ownership: {
          openClaims: integer(row["open_claims"]),
          activeAttempts: integer(row["active_attempts"]),
          activeRuntimes: integer(row["active_runtimes"]),
          activeRecoveryDeliveries: integer(row["active_recovery_deliveries"]),
        },
      };
    },

    async collectRun(runId, input) {
      const runRows = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT id, status, protocol, compiler_release_sha, packet_hash,
                accepted_candidate_hash, context
           FROM runs WHERE id = $1 LIMIT 1`,
        [runId],
      );
      const run = runRows[0];
      if (!run) throw new Error("EVAL_RUN_NOT_FOUND");
      if (input.oracle.expectedDecision.kind === "typed_rejection") {
        return collectTypedRejectionRun(sql, runId, run, input);
      }
      let casDeepVerified = false;
      let sealedStackPackId: string | null = null;
      let sealedStoryPlanHash: string | null = null;
      let sealedStoryIds: string[] = [];
      let auditedProductSpec: unknown;
      let auditedDesignGraph: unknown;
      let requiredPredicateRefs: string[] = [];
      let invariantRefs: string[] = [];
      let casAuditHash: string;
      try {
        const audited = await artifactReader.auditTerminalPacket(runId);
        casDeepVerified = true;
        sealedStackPackId = audited.buildTopology.stackPack.id;
        sealedStoryPlanHash = audited.refs.storyPlan;
        sealedStoryIds = audited.storyPlan.stories.map((story) => story.id).sort();
        auditedProductSpec = audited.productSpec;
        auditedDesignGraph = audited.designGraph;
        requiredPredicateRefs = audited.productSpec.evidencePredicates
          .filter((predicate) => predicate.required)
          .map((predicate) => predicate.id)
          .sort();
        invariantRefs = [...new Set([
          ...audited.productSpec.evidencePredicates
            .filter((predicate) => predicate.required)
            .map((predicate) => `INV_${predicate.kind.toUpperCase()}`),
          ...audited.buildTopology.commands
            .filter((command) => command.kind === "build" || command.kind === "test")
            .map((command) => `INV_COMMAND_${command.kind.toUpperCase()}`),
        ])].sort();
        casAuditHash = safeHash({
          packetHash: audited.packetHash,
          producer: audited.producer,
          refs: audited.refs,
          stackPack: audited.buildTopology.stackPack,
        });
      } catch (error) {
        casAuditHash = safeHash({
          status: "failed",
          code: error instanceof RuntimeArtifactReaderError
            ? error.code
            : "RUNTIME_PACKET_AUDIT_UNAVAILABLE",
        });
      }
      const packetRows = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT packet_hash, compiler_metadata->>'codeSha' AS compiler_code_sha
           FROM product_packets WHERE run_id = $1 ORDER BY packet_hash`,
        [runId],
      );
      const refs = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT rr.ref_key, rr.artifact_hash, (a.artifact_hash IS NOT NULL) AS artifact_exists,
                a.artifact_type, a.producer_metadata->>'codeSha' AS producer_code_sha
           FROM run_artifact_refs rr
           LEFT JOIN semantic_artifacts a ON a.artifact_hash = rr.artifact_hash
          WHERE rr.run_id = $1 ORDER BY rr.ref_key, rr.artifact_hash`,
        [runId],
      );
      const packetHash = run["packet_hash"] ? String(run["packet_hash"]) : null;
      const refKeys = refs.map((row) => String(row["ref_key"]));
      const packetRefType = refs.find((row) => row["ref_key"] === "PRODUCT_BUILD_PACKET")?.["artifact_type"];
      const requiredPacketArtifactTypes = packetRefType === "setfarm.product-build-packet.v2"
        ? REQUIRED_PACKET_ARTIFACT_TYPES_V2
        : REQUIRED_PACKET_ARTIFACT_TYPES_V1;
      const missingRequiredRefs = Object.keys(requiredPacketArtifactTypes)
        .filter((ref) => !refKeys.includes(ref)).length;
      const missingArtifacts = refs.filter((row) => row["artifact_exists"] !== true).length;
      const packetInvalid = packetRows.filter((row) =>
        String(row["packet_hash"]) !== packetHash
        || String(row["compiler_code_sha"]) !== String(run["compiler_release_sha"])).length;
      const requiredRefInvalid = refs.filter((row) => {
        const expectedType = requiredPacketArtifactTypes[String(row["ref_key"])] ?? null;
        if (!expectedType) return false;
        return row["artifact_type"] !== expectedType
          || row["producer_code_sha"] !== run["compiler_release_sha"]
          || (row["ref_key"] === "PRODUCT_BUILD_PACKET" && row["artifact_hash"] !== packetHash);
      }).length;
      const packetPayload = {
        packetHash,
        casAuditHash,
        casDeepVerified,
        sealedStackPackId,
        packetRows: packetRows.length,
        artifactRefs: refs.length,
        missingRequiredRefs,
        missingArtifacts,
        invalidBindings: packetInvalid + requiredRefInvalid + (casDeepVerified ? 0 : 1),
      };
      const packet = {
        ...packetPayload,
        stateHash: safeHash({
          packetRows: sortedRows(packetRows),
          refs: sortedRows(refs),
          casAuditHash,
          casDeepVerified,
          sealedStackPackId,
        }),
      };

      const attemptsRaw = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT ea.attempt_id, ea.claim_id, ea.step_id, ea.story_id, ea.generation,
                ea.attempt_class, ea.packet_hash, ea.slice_hash, ea.finding_set_hash,
                ea.source_before_sha, ea.source_before_tree_hash, ea.source_after_sha,
                ea.source_after_tree_hash, ea.disposition,
                (cl.id IS NOT NULL AND cl.outcome IS NULL) AS claim_open
           FROM execution_attempts ea
           LEFT JOIN claim_log cl ON cl.id = ea.claim_id AND cl.run_id = ea.run_id
          WHERE ea.run_id = $1 ORDER BY ea.created_at, ea.attempt_id`,
        [runId],
      );
      const activeAttempts = attemptsRaw.filter((row) => ["claimed", "running"].includes(String(row["disposition"])));
      const activeTuples = new Map<string, number>();
      activeAttempts.forEach((row) => {
        const key = `${row["step_id"]}\0${row["story_id"]}`;
        activeTuples.set(key, (activeTuples.get(key) ?? 0) + 1);
      });
      const attemptsPayload = {
        attempts: attemptsRaw.length,
        active: activeAttempts.length,
        duplicateActiveTuples: [...activeTuples.values()].filter((count) => count > 1).length,
        staleOwnership: activeAttempts.filter((row) => row["claim_open"] !== true).length,
        incompleteBindings: attemptsRaw.filter((row) =>
          String(row["attempt_class"]) !== "infrastructure_retry"
          && (
            !row["packet_hash"]
            || !row["slice_hash"]
            || String(row["packet_hash"]) !== packetHash
            || (casDeepVerified && !sealedStoryIds.includes(String(row["story_id"])))
          )).length,
      };
      const attempts = { ...attemptsPayload, stateHash: safeHash(sortedRows(attemptsRaw)) };

      const findingRows = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT fs.finding_set_hash, fs.story_id, fs.packet_hash, fs.slice_hash,
                fs.source_sha, fs.source_tree_hash, f.finding_id, f.status, f.invariant_ref
           FROM finding_sets fs
           LEFT JOIN findings f ON f.finding_set_hash = fs.finding_set_hash
          WHERE fs.run_id = $1 ORDER BY fs.finding_set_hash, f.finding_id`,
        [runId],
      );
      const findingSetHashes = new Set(findingRows.map((row) => String(row["finding_set_hash"])));
      const findingsPayload = {
        findingSets: findingSetHashes.size,
        openFindings: findingRows.filter((row) => row["status"] === "open").length,
        invalidBindings: findingRows.filter((row) => String(row["packet_hash"]) !== packetHash).length,
      };
      const findings = { ...findingsPayload, stateHash: safeHash(sortedRows(findingRows)) };

      const recoveryCases = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT recovery_case_id, current_revision_id, story_id, packet_hash, slice_hash,
                finding_set_hash, status, max_implement, max_supervisor_repair,
                max_evidence_only, used_implement, used_supervisor_repair, used_evidence_only
           FROM recovery_cases WHERE run_id = $1 ORDER BY recovery_case_id`,
        [runId],
      );
      const deliveries = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT dispatch_id, recovery_case_id, revision_id, story_id, state,
                attempt_id, claim_id, execution_slice_hash
           FROM recovery_dispatch_deliveries WHERE run_id = $1 ORDER BY dispatch_id`,
        [runId],
      );
      const caseIds = new Set(recoveryCases.map((row) => String(row["recovery_case_id"])));
      const recoveryPayload = {
        cases: recoveryCases.length,
        activeCases: recoveryCases.filter((row) => ["open", "repairing", "evidencing"].includes(String(row["status"]))).length,
        activeDeliveries: deliveries.filter((row) => ["authorized", "leased", "attempt_reserved", "running"].includes(String(row["state"]))).length,
        overBudget: recoveryCases.filter((row) =>
          integer(row["used_implement"]) > integer(row["max_implement"])
          || integer(row["used_supervisor_repair"]) > integer(row["max_supervisor_repair"])
          || integer(row["used_evidence_only"]) > integer(row["max_evidence_only"])).length,
        invalidBindings: recoveryCases.filter((row) =>
          String(row["packet_hash"]) !== packetHash || !row["current_revision_id"]).length
          + deliveries.filter((row) => !caseIds.has(String(row["recovery_case_id"]))).length,
      };
      const recovery = {
        ...recoveryPayload,
        stateHash: safeHash({ cases: sortedRows(recoveryCases), deliveries: sortedRows(deliveries) }),
      };

      const evidenceRows = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT evidence_bundle_hash, evidence_id, run_id, story_id, packet_hash, slice_hash, source_sha,
                source_tree_hash, attempt_id, aggregate_verdict, payload, created_at
           FROM evidence_bundles WHERE run_id = $1 ORDER BY created_at, evidence_bundle_hash`,
        [runId],
      );
      const latestAttemptByStory = new Map<string, Record<string, unknown>>();
      attemptsRaw.forEach((row) => {
        if (
          ["product_implementation", "supervisor_repair", "evidence_only"].includes(String(row["attempt_class"]))
          && ["produced_delta", "already_satisfied", "verified"].includes(String(row["disposition"]))
        ) latestAttemptByStory.set(String(row["story_id"]), row);
      });
      const evidenceRequiredAttempts = [...latestAttemptByStory.values()];
      const currentEvidenceRows = evidenceRequiredAttempts.flatMap((attempt) => {
        const expectedTree = String(attempt["source_after_tree_hash"] ?? attempt["source_before_tree_hash"] ?? "");
        const exact = evidenceRows.filter((row) =>
          String(row["story_id"]) === String(attempt["story_id"])
          && String(row["attempt_id"] ?? "") === String(attempt["attempt_id"])
          && String(row["source_tree_hash"]) === expectedTree
          && String(row["packet_hash"]) === String(attempt["packet_hash"])
          && String(row["slice_hash"]) === String(attempt["slice_hash"]));
        return exact.length > 0 ? [exact.at(-1)!] : [];
      });
      const currentEvidence = currentEvidenceRows.map((row) => ({
        row,
        bundle: validatedEvidenceBundle(row),
      }));
      const predicateRows = currentEvidence.flatMap(({ bundle }) => bundle
        ? bundle.predicates.map((predicate) => ({
            predicateRef: predicate.predicateRef,
            invariantRef: predicate.invariantRef,
            required: predicate.required,
            verdict: predicate.verdict,
          }))
        : []);
      const predicateCoverage = evaluateConvergencePredicateCoverage({
        predicates: predicateRows,
        requiredPredicateRefs,
        invariantRefs,
      });
      const knownAttempts = new Set(attemptsRaw.map((row) => String(row["attempt_id"])));
      const passingAttemptIds = new Set(currentEvidence
        .filter(({ bundle }) => bundle?.aggregateVerdict === "pass" && bundle.attemptId)
        .map(({ bundle }) => bundle!.attemptId!));
      const validCurrentBundles = currentEvidence
        .map(({ bundle }) => bundle)
        .filter((bundle): bundle is EvidenceBundleV2 => bundle !== undefined);
      const evidencePayload = {
        predicateCoverageHash: predicateCoverage.predicateCoverageHash,
        bundles: validCurrentBundles.length,
        passing: validCurrentBundles.filter((bundle) => bundle.aggregateVerdict === "pass").length,
        nonPassing: validCurrentBundles.filter((bundle) => bundle.aggregateVerdict !== "pass").length,
        missingAttemptEvidence: evidenceRequiredAttempts.filter((row) => !passingAttemptIds.has(String(row["attempt_id"]))).length,
        invalidBindings: currentEvidence.filter(({ row, bundle }) =>
          !bundle
          || bundle.packetHash !== packetHash
          || (casDeepVerified && !sealedStoryIds.includes(bundle.storyId))
          || (bundle.attemptId && !knownAttempts.has(bundle.attemptId))
          || String(row["packet_hash"]) !== packetHash).length,
        missingExpectedPredicates: predicateCoverage.missingExpectedPredicates,
        unexpectedProductPredicates: predicateCoverage.unexpectedProductPredicates,
        missingInvariantRefs: predicateCoverage.missingInvariantRefs,
        nonPassingRequiredPredicates: predicateCoverage.nonPassingRequiredPredicates,
      };
      const evidence = { ...evidencePayload, stateHash: safeHash(sortedRows(currentEvidenceRows)) };

      const candidateRows = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT candidate_hash, candidate_id, run_id, packet_hash, story_plan_hash,
                source_sha, source_tree_hash, integration_evidence_hash, payload, created_at
           FROM accepted_candidates WHERE run_id = $1 ORDER BY created_at, candidate_hash`,
        [runId],
      );
      const acceptedStoryRows = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT candidate_hash, story_id, attempt_id, slice_hash,
                evidence_plan_hash, evidence_plan_artifact_hash,
                evidence_bundle_hash, evidence_id, predicate_refs, created_at
           FROM accepted_candidate_story_evidence
          WHERE candidate_hash IN (
            SELECT candidate_hash FROM accepted_candidates WHERE run_id = $1
          ) ORDER BY story_id, evidence_bundle_hash`,
        [runId],
      );
      const candidateParse = candidateRows.length === 1
        ? AcceptedCandidateV1Schema.safeParse(candidateRows[0]!["payload"])
        : undefined;
      const acceptedCandidate = candidateParse?.success ? candidateParse.data : undefined;
      let acceptanceInvalidBindings = candidateRows.length === 1 && acceptedCandidate ? 0 : 1;
      if (acceptedCandidate) {
        const candidateRow = candidateRows[0]!;
        if (
          String(run["accepted_candidate_hash"] ?? "") !== acceptedCandidate.candidateHash
          || String(candidateRow["candidate_hash"] ?? "") !== acceptedCandidate.candidateHash
          || String(candidateRow["candidate_id"] ?? "") !== acceptedCandidate.candidateId
          || String(candidateRow["source_sha"] ?? "") !== acceptedCandidate.sourceRevision.sha
          || String(candidateRow["source_tree_hash"] ?? "") !== acceptedCandidate.sourceRevision.treeHash
          || String(candidateRow["integration_evidence_hash"] ?? "") !== acceptedCandidate.integrationEvidenceHash
          || acceptedCandidate.packetHash !== packetHash
          || acceptedCandidate.storyPlanHash !== sealedStoryPlanHash
          || !exactStrings(
            acceptedCandidate.storyEvidence.map((story) => story.storyId),
            sealedStoryIds,
          )
          || acceptedStoryRows.length !== acceptedCandidate.storyEvidence.length
        ) acceptanceInvalidBindings += 1;
        for (const story of acceptedCandidate.storyEvidence) {
          const child = acceptedStoryRows.find((row) =>
            String(row["candidate_hash"] ?? "") === acceptedCandidate.candidateHash
            && String(row["story_id"] ?? "") === story.storyId);
          const bundleRow = evidenceRows.find((row) =>
            String(row["evidence_bundle_hash"] ?? "") === story.evidenceBundleHash);
          const bundle = bundleRow ? validatedEvidenceBundle(bundleRow) : undefined;
          const latestAttempt = latestAttemptByStory.get(story.storyId);
          if (
            !child
            || String(child["attempt_id"] ?? "") !== story.attemptId
            || String(child["slice_hash"] ?? "") !== story.sliceHash
            || String(child["evidence_plan_hash"] ?? "") !== story.evidencePlanHash
            || String(child["evidence_plan_artifact_hash"] ?? "") !== story.evidencePlanArtifactHash
            || String(child["evidence_bundle_hash"] ?? "") !== story.evidenceBundleHash
            || String(child["evidence_id"] ?? "") !== story.evidenceId
            || safeHash(child["predicate_refs"]) !== safeHash(story.predicateRefs)
            || !bundle
            || bundle.aggregateVerdict !== "pass"
            || bundle.sourceRevision.sha !== acceptedCandidate.sourceRevision.sha
            || bundle.sourceRevision.treeHash !== acceptedCandidate.sourceRevision.treeHash
            || bundle.attemptId !== story.attemptId
            || String(latestAttempt?.["attempt_id"] ?? "") !== story.attemptId
          ) acceptanceInvalidBindings += 1;
        }
      }
      const acceptancePayload = {
        candidateHash: acceptedCandidate?.candidateHash ?? null,
        candidates: candidateRows.length,
        storyEvidence: acceptedStoryRows.length,
        sourceSha: acceptedCandidate?.sourceRevision.sha ?? null,
        sourceTreeHash: acceptedCandidate?.sourceRevision.treeHash ?? null,
        invalidBindings: acceptanceInvalidBindings,
      };
      const acceptance = {
        ...acceptancePayload,
        stateHash: safeHash({
          candidates: sortedRows(candidateRows),
          stories: sortedRows(acceptedStoryRows),
        }),
      };

      const oracle = auditedProductSpec && auditedDesignGraph && acceptedCandidate
        ? evaluateTaskIntentOracleVersioned({
            ...input,
            actual: {
              kind: "accepted_candidate",
              productSpec: auditedProductSpec,
              designGraph: auditedDesignGraph,
              sealedStackPackId,
              acceptedCandidate,
              passingPredicateRefs: predicateRows
                .filter((predicate) => predicate.verdict === "pass")
                .map((predicate) => predicate.predicateRef),
            },
          })
        : evaluateTaskIntentOracleVersioned({ ...input, actual: { kind: "unavailable" } });

      const invariantCodes = new Set<string>();
      if (packet.packetRows !== 1) invariantCodes.add("EVAL_PACKET_CARDINALITY_INVALID");
      if (!packet.packetHash) invariantCodes.add("EVAL_PACKET_HASH_MISSING");
      if (!packet.casDeepVerified || !packet.sealedStackPackId) invariantCodes.add("EVAL_PACKET_CAS_AUDIT_FAILED");
      if (packet.missingRequiredRefs > 0) invariantCodes.add("EVAL_PACKET_REFS_INCOMPLETE");
      if (packet.missingArtifacts > 0 || packet.invalidBindings > 0) invariantCodes.add("EVAL_PACKET_BINDING_INVALID");
      if (attempts.attempts === 0) invariantCodes.add("EVAL_ATTEMPTS_MISSING");
      if (attempts.active > 0 || attempts.duplicateActiveTuples > 0 || attempts.staleOwnership > 0 || attempts.incompleteBindings > 0) {
        invariantCodes.add("EVAL_ATTEMPT_OWNERSHIP_INVALID");
      }
      if (findings.openFindings > 0 || findings.invalidBindings > 0) invariantCodes.add("EVAL_FINDING_LEDGER_UNSETTLED");
      if (recovery.activeCases > 0 || recovery.activeDeliveries > 0 || recovery.overBudget > 0 || recovery.invalidBindings > 0) {
        invariantCodes.add("EVAL_RECOVERY_LEDGER_UNSETTLED");
      }
      if (evidence.bundles < Math.max(1, sealedStoryIds.length) || evidence.passing === 0
        || evidence.nonPassing > 0 || evidence.missingAttemptEvidence > 0 || evidence.invalidBindings > 0
        || evidence.missingExpectedPredicates > 0 || evidence.unexpectedProductPredicates > 0
        || evidence.missingInvariantRefs > 0 || evidence.nonPassingRequiredPredicates > 0) {
        invariantCodes.add("EVAL_EVIDENCE_LEDGER_INCOMPLETE");
      }
      if (
        acceptance.candidates !== 1
        || !acceptance.candidateHash
        || acceptance.storyEvidence === 0
        || !acceptance.sourceSha
        || !acceptance.sourceTreeHash
        || acceptance.invalidBindings > 0
      ) invariantCodes.add("EVAL_ACCEPTED_CANDIDATE_INVALID");
      if (oracle.mismatchCodes.length > 0 || !oracle.contractComplete || !oracle.decisionEvidenceVerified) {
        invariantCodes.add("EVAL_TASK_INTENT_ORACLE_MISMATCH");
      }
      const canonicalPayload = {
        packet,
        attempts,
        findings,
        recovery,
        evidence,
        acceptance,
        oracle,
        invariantCodes: [...invariantCodes].sort(),
      };
      const canonical = createCanonicalEvidenceVersioned(input.oracle, canonicalPayload);

      const failureRows = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT step_id, story_id, phase, status, evidence, event_type FROM run_observations
          WHERE run_id = $1 AND status IN ('fail', 'blocked')
          ORDER BY created_at, id`,
        [runId],
      );
      const terminationRows = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT requested_by, evidence
           FROM run_termination_requests
          WHERE run_id = $1
            AND target_status = 'failed'
            AND state = 'terminalized'
          ORDER BY terminalized_at DESC NULLS LAST, requested_at DESC, request_id DESC
          LIMIT 1`,
        [runId],
      );
      const failedStepRows = await sql.unsafe<Array<{ step_id: string }>>(
        "SELECT step_id FROM steps WHERE run_id = $1 AND status = 'failed' ORDER BY step_id",
        [runId],
      );
      const operationalFailureCause = terminationRows[0]
        ? trustedOperationalFailureCauseV1({
            requestedBy: String(terminationRows[0]["requested_by"] ?? ""),
            evidence: terminationRows[0]["evidence"],
            failedWorkflowStepIds: new Set(failedStepRows.map((row) => row.step_id)),
          })
        : null;
      const pullRequests = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT pr_url, merge_status FROM stories
          WHERE run_id = $1 AND NULLIF(pr_url, '') IS NOT NULL
          ORDER BY story_id, pr_url`,
        [runId],
      );
      return {
        canonical,
        operationalFailureCause,
        scopedFailure: canonicalConvergenceScopedFailureV1(failureRows),
        pullRequests: pullRequests.map((row) => ({
          url: String(row["pr_url"]),
          mergeStatus: row["merge_status"] ? String(row["merge_status"]) : null,
        })),
      };
    },
  };
}

function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

async function command(
  file: string,
  args: readonly string[],
  options: Readonly<{ cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv }> = {},
): Promise<string> {
  const result = await execFileAsync(file, [...args], {
    cwd: options.cwd,
    timeout: options.timeout ?? 30_000,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    env: options.env ?? process.env,
  });
  return String(result.stdout).trim();
}

async function evaluationCodeHash(root: string): Promise<string> {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const entries = (await readdir(directory))
    .filter((entry) => /^(?:suite-schema|result-schema|convergence-runner|release-gate|report|task-intent-oracle)(?:-v2)?\.(?:ts|js)$/.test(entry))
    .sort();
  const hashes: Record<string, string> = {};
  for (const entry of entries) {
    hashes[entry.replace(/\.(?:ts|js)$/, "")] = createHash("sha256")
      .update(await readFile(path.join(directory, entry)))
      .digest("hex");
  }
  const workflow = await readFile(path.join(root, "workflows", "feature-dev", "workflow.yml"));
  hashes["workflow"] = createHash("sha256").update(workflow).digest("hex");
  return safeHash(hashes);
}

async function readConvergenceExecutionProfileV1(workflowText: string): Promise<Readonly<{
  providerId: string; modelId: string; agentCount: number;
}>> {
  const selected = readSelectedFreshCodexExecutionProfileV1();
  const workflow = YAML.parse(workflowText) as Record<string, unknown>;
  const mapping = workflow["agent_mapping"] && typeof workflow["agent_mapping"] === "object"
    ? workflow["agent_mapping"] as Record<string, unknown>
    : {};
  const expectedAgentIds = [...new Set(Object.values(mapping).flatMap((value) =>
    Array.isArray(value) ? value.map(String) : value ? [String(value)] : []))].sort();
  if (selected) return { providerId: selected.providerId, modelId: selected.modelId,
    agentCount: expectedAgentIds.length };
  const openClaw = await readOpenClawConfig();
  const installedAgents = Array.isArray(openClaw.config.agents?.list) ? openClaw.config.agents.list : [];
  const installedById = new Map(installedAgents.map((agent) => [String(agent["id"] ?? ""), agent]));
  const configuredModels = expectedAgentIds.map((agentId) => {
    const configured = installedById.get(agentId)?.["model"];
    if (typeof configured === "string") return configured;
    if (configured && typeof configured === "object" && !Array.isArray(configured)) {
      return String((configured as Record<string, unknown>)["primary"] ?? "");
    }
    return "";
  });
  const uniqueModels = [...new Set(configuredModels.filter(Boolean))];
  const modelId = expectedAgentIds.length > 0
    && configuredModels.length === expectedAgentIds.length
    && configuredModels.every(Boolean)
    && uniqueModels.length === 1
    ? uniqueModels[0]!
    : "unavailable";
  const providerId = modelId.includes("/") ? modelId.split("/", 1)[0]! : "default";
  return { providerId, modelId, agentCount: expectedAgentIds.length };
}

export function createNodeConvergenceProcessPort(root = packageRoot()): ConvergenceProcessPort {
  const cli = path.join(root, "dist", "cli", "cli.js");
  return {
    async inspectRelease() {
      const [headSha, status, workflowText, runnerHash] = await Promise.all([
        command("git", ["rev-parse", "HEAD"], { cwd: root }),
        command("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root }),
        readFile(path.join(root, "workflows", "feature-dev", "workflow.yml"), "utf8"),
        evaluationCodeHash(root),
      ]);
      let cliReady = true;
      try { await access(cli, fsConstants.R_OK); } catch { cliReady = false; }
      const { providerId, modelId, agentCount } = await readConvergenceExecutionProfileV1(workflowText);
      const environmentHash = safeHash({
        node: process.versions.node,
        platform: process.platform,
        architecture: process.arch,
        database: "postgresql",
        setfarmTransport: "loopback-http",
        missionControlTransport: "loopback-http",
        workflowHash: createHash("sha256").update(workflowText).digest("hex"),
        executionProfileHash: safeHash({ providerId, modelId, agentCount }),
      });
      return {
        headSha: GitObjectHashSchema.parse(headSha.toLowerCase()),
        clean: status.length === 0,
        runnerHash,
        environmentHash,
        providerId,
        modelId,
        cliReady,
        v3ActivationEnabled: process.env.SETFARM_V3_ACTIVATION === "enabled",
      };
    },

    async startRun(input) {
      const executable = realpathSync(process.execPath);
      const args = [cli, "workflow", "run", input.workflowId, input.task, "--protocol", "v3"];
      // Load before spawning: the original promise/handle has an owner from birth.
      const publish = input.startChild
        ? (await import("../execution/manual-test-admission-v1.js")).publishSelectedManualStartChildV1 : null;
      const pending = execFileAsync(executable, args, {
        cwd: root, timeout: 120_000, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, SETFARM_INTERNAL_CONVERGENCE_ADMISSION: serializeInternalCanaryAdmissionContext(input.admission) },
      });
      // Attach rejection handling before synchronous proof publication. Always
      // await this one original handle, even if publication/observation refuses.
      const outcome = pending.then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error }));
      let publicationError: unknown, assertPublished: (() => void) | undefined;
      try { if (publish) assertPublished = publish(input.startChild!, input, pending.child); }
      catch (error) { publicationError = error; }
      const result = await outcome;
      if (publicationError) throw new ControlWorkerFatalErrorV1("CONTROL_START_UNRESOLVED");
      try { assertPublished?.(); } catch { throw new ControlWorkerFatalErrorV1("CONTROL_START_UNRESOLVED"); }
      if (!result.ok) throw result.error;
      const output = String(result.value.stdout).trim();
      const match = output.match(/Run:\s*#([1-9][0-9]*)\s*\(([^)]+)\)/);
      if (!match) throw new Error("EVAL_RUN_START_OUTPUT_INVALID");
      return { runId: match[2]!, runNumber: Number(match[1]) };
    },

    async inspectProject(input) {
      const canonicalHeadSha = input.canonicalSourceRevision?.sha ?? null;
      const canonicalTreeHash = input.canonicalSourceRevision?.treeHash ?? null;
      const unresolved = () => ({
        projectIdentityState: canonicalHeadSha && canonicalTreeHash
          ? "invalid" as const
          : "provisional" as const,
        workingTreeDirty: false,
        manualProjectMutationDetected: false,
        sourceHeadMatchesCanonical: false,
        projectHeadSha: null,
        projectTreeHash: null,
        canonicalHeadSha,
        canonicalTreeHash,
      });
      if (!input.projectLocator || !path.isAbsolute(input.projectLocator)) {
        return unresolved();
      }
      let status: string;
      let projectHeadSha: string;
      let projectTreeHash: string;
      try {
        [status, projectHeadSha, projectTreeHash] = await Promise.all([
          command("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: input.projectLocator }),
          command("git", ["rev-parse", "HEAD"], { cwd: input.projectLocator }),
          command("git", ["rev-parse", "HEAD^{tree}"], { cwd: input.projectLocator }),
        ]);
      } catch {
        // Before setup/acceptance a generated project locator may be an empty
        // directory rather than a Git repository. With no canonical candidate
        // there is no source identity to invalidate; keep measuring the typed
        // platform failure as provisional. Once canonical source exists, the
        // same absence remains a fail-closed invalid identity.
        return unresolved();
      }
      let upstreamHeadSha: string | null = null;
      let upstreamTreeHash: string | null = null;
      try {
        [upstreamHeadSha, upstreamTreeHash] = await Promise.all([
          command("git", ["rev-parse", "@{upstream}"], { cwd: input.projectLocator }),
          command("git", ["rev-parse", "@{upstream}^{tree}"], { cwd: input.projectLocator }),
        ]);
      } catch {
        // A generated project without a configured upstream has no independent
        // canonical delivery revision and must fail closed.
      }
      const workingTreeDirty = status.length > 0;
      const sourceHeadMatchesCanonical = Boolean(
        canonicalHeadSha
        && canonicalTreeHash
        && upstreamHeadSha
        && upstreamTreeHash
        && projectHeadSha.toLowerCase() === canonicalHeadSha.toLowerCase()
        && projectTreeHash.toLowerCase() === canonicalTreeHash.toLowerCase()
        && upstreamHeadSha.toLowerCase() === canonicalHeadSha.toLowerCase()
        && upstreamTreeHash.toLowerCase() === canonicalTreeHash.toLowerCase()
      );
      return {
        projectIdentityState: canonicalHeadSha && canonicalTreeHash
          ? sourceHeadMatchesCanonical && !workingTreeDirty ? "verified" as const : "invalid" as const
          : "provisional" as const,
        workingTreeDirty,
        manualProjectMutationDetected: Boolean(canonicalHeadSha && canonicalTreeHash && workingTreeDirty),
        sourceHeadMatchesCanonical,
        projectHeadSha: GitObjectHashSchema.parse(projectHeadSha.toLowerCase()),
        projectTreeHash: GitObjectHashSchema.parse(projectTreeHash.toLowerCase()),
        canonicalHeadSha: canonicalHeadSha ? GitObjectHashSchema.parse(canonicalHeadSha.toLowerCase()) : null,
        canonicalTreeHash: canonicalTreeHash ? GitObjectHashSchema.parse(canonicalTreeHash.toLowerCase()) : null,
      };
    },

    async inspectGitHub(pullRequests) {
      const states: Array<Record<string, unknown>> = [];
      let unverified = 0;
      let open = 0;
      for (const pullRequest of pullRequests) {
        const match = pullRequest.url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/([1-9][0-9]*)\/?$/);
        if (!match) {
          unverified += 1;
          states.push({ urlHash: safeHash(pullRequest.url), status: "invalid_url" });
          continue;
        }
        try {
          const output = await command("gh", [
            "api",
            `repos/${match[1]}/${match[2]}/pulls/${match[3]}`,
            "--jq",
            "{state:.state,mergedAt:.merged_at}",
          ], { timeout: 20_000 });
          const state = JSON.parse(output) as { state?: unknown; mergedAt?: unknown };
          if (state.state === "open") open += 1;
          const verifiedMerged = state.state === "closed" && typeof state.mergedAt === "string";
          if (!verifiedMerged) unverified += 1;
          states.push({ urlHash: safeHash(pullRequest.url), state: state.state, merged: Boolean(state.mergedAt) });
        } catch {
          unverified += 1;
          states.push({ urlHash: safeHash(pullRequest.url), status: "unavailable" });
        }
      }
      return ConvergenceGitHubEvidenceV1Schema.parse({
        stateHash: safeHash(states),
        pullRequests: pullRequests.length,
        unverified,
        open,
      });
    },
  };
}

function endpoint(service: "setfarm" | "mission_control", pathname: string): string {
  const base = service === "setfarm"
    ? String(process.env.SETFARM_DASHBOARD_URL || "http://127.0.0.1:3333").replace(/\/+$/, "")
    : runtimeConfig.missionControlInternalUrl;
  return `${base}${pathname}`;
}

async function fetchResponse(url: string, missionControlToken?: string): Promise<Response> {
  return fetch(url, {
    headers: {
      accept: "application/json",
      ...(missionControlToken ? { "x-mc-token": missionControlToken } : {}),
    },
    signal: AbortSignal.timeout(10_000),
    ...(missionControlToken ? { redirect: "error" as const } : {}),
  });
}

export function createFetchConvergenceHttpPort(): ConvergenceHttpPort {
  // Explicit evaluator input for MC's AUTH_TOKEN. Never borrow generic AUTH_TOKEN
  // or attach this credential to Setfarm, health checks, URLs or evidence.
  const missionControlToken = String(process.env.MC_AUTH_TOKEN || "");
  return {
    async health(service) {
      const response = await fetchResponse(endpoint(service, service === "setfarm" ? "/" : "/api/health"));
      return { ok: response.ok, evidenceHash: safeHash({ service, status: response.status }) };
    },
    async operationalSnapshot(service, runId) {
      const pathname = service === "setfarm"
        ? `/api/runs/${encodeURIComponent(runId)}/operational-snapshot`
        : `/api/setfarm/runs/${encodeURIComponent(runId)}/operational-snapshot`;
      const response = await fetchResponse(
        endpoint(service, pathname),
        service === "mission_control" ? missionControlToken : undefined,
      );
      if (!response.ok) throw new Error("EVAL_OPERATIONAL_SNAPSHOT_UNAVAILABLE");
      return response.json();
    },
    async syncProject(runId) {
      const url = endpoint(
        "mission_control",
        `/api/setfarm/sync-projects?runId=${encodeURIComponent(runId)}`,
      );
      const response = await fetch(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          ...(missionControlToken ? { "x-mc-token": missionControlToken } : {}),
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const payload = await response.json().catch(() => null) as null | {
        synced?: unknown[];
        skipped?: unknown[];
      };
      const skipped = Array.isArray(payload?.skipped)
        ? payload.skipped.map((item) => String(item))
        : [];
      const ok = response.ok && !skipped.some((item) => item.startsWith(`${runId}:`));
      return {
        ok,
        evidenceHash: safeHash({ runId, status: response.status, payload }),
      };
    },
  };
}

export function createSystemClock(): ConvergenceClock {
  return {
    now: () => new Date(),
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  };
}

function assertSelectedConvergenceDirectoryV1(directory: string) {
  assertFreshInstallationSelectionUnchangedV1();
  const info = lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid!()
    || (info.mode & 0o7777) !== 0o700 || realpathSync(directory) !== directory) {
    throw new Error("FRESH_V3_EVAL_DIRECTORY_REFUSED");
  }
  return info;
}

/** Fixed private selected store; no caller-supplied filesystem/authority port. */
class SelectedConvergenceResultStoreV1 extends ContentAddressedEvalResultStore {
  private readonly pins: readonly { path: string; dev: number; ino: number }[];
  constructor(root: string) {
    super(root);
    assertFreshInstallationSelectionUnchangedV1();
    const selected = freshInstallationSelectionV1;
    if (!selected || root !== selected.paths.evals) throw new Error("FRESH_V3_EVAL_OUTPUT_ROOT_REFUSED");
    this.pins = [selected.directory, selected.paths.root, path.join(selected.paths.root, "evals"), root].map(directory => {
      const info = assertSelectedConvergenceDirectoryV1(directory);
      return { path: directory, dev: info.dev, ino: info.ino };
    });
  }
  private check(): void {
    for (const pin of this.pins) {
      const current = assertSelectedConvergenceDirectoryV1(pin.path);
      if (current.dev !== pin.dev || current.ino !== pin.ino) throw new Error("FRESH_V3_EVAL_DIRECTORY_REFUSED");
    }
  }
  private bucket(hashValue: string, create: boolean): void {
    this.check();
    const hash = Sha256Schema.parse(hashValue);
    for (const directory of [path.join(this.pins[3]!.path, "sha256"), path.join(this.pins[3]!.path, "sha256", hash.slice(0, 2))]) {
      if (create) {
        try { assertSelectedConvergenceDirectoryV1(directory); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          mkdirSync(directory, { mode: 0o700 }); // No recursive path traversal/adoption.
        }
      }
      assertSelectedConvergenceDirectoryV1(directory);
    }
    this.check();
  }
  override async prepare(): Promise<void> { this.check(); }
  override async put(value: Parameters<ContentAddressedEvalResultStore["put"]>[0]): ReturnType<ContentAddressedEvalResultStore["put"]> {
    const hash = value.schema === "setfarm.product-convergence-release-gate.v1" ? value.gateHash : value.resultHash;
    this.bucket(hash, true);
    const result = await super.put(value);
    this.bucket(hash, false);
    return result;
  }
  override async get(hash: string): ReturnType<ContentAddressedEvalResultStore["get"]> {
    this.bucket(hash, false);
    const result = await super.get(hash);
    this.bucket(hash, false);
    return result;
  }
}

export async function createDefaultConvergencePorts(outputRoot: string): Promise<ConvergenceRunnerPorts> {
  assertFreshInstallationSelectionUnchangedV1();
  const selected = freshInstallationSelectionV1;
  let closeSelected: (() => Promise<void>) | undefined;
  try {
    let sql: UnsafeSql;
    if (selected) {
      if (!fileURLToPath(import.meta.url).endsWith(".js")) throw new Error("FRESH_V3_EVAL_COMPILED_ENTRY_REQUIRED");
      if (outputRoot !== selected.paths.evals) throw new Error("FRESH_V3_EVAL_OUTPUT_ROOT_REFUSED");
      const entry = await import("../installation/fresh-installation-entry-v1.js");
      const db = await import("../db-pg.js");
      // Enroll cleanup before actual preparation can open its privately owned pool.
      closeSelected = async () => { await db.pgClose(); };
      await entry.prepareFreshInstallationOperationalEntryV1();
      entry.assertFreshInstallationOperationalEntryV1();
      assertFreshInstallationSelectionUnchangedV1();
      selected.assertUnchanged();
      sql = db.getSql();
    } else {
      sql = postgres(runtimeConfig.setfarmPgUrl, {
        max: 4,
        idle_timeout: 2,
        connect_timeout: 10,
        onnotice: () => {},
      });
    }
    const sqlPort = createPostgresConvergencePort(sql);
    const artifacts = selected ? new SelectedConvergenceResultStoreV1(outputRoot) : new ContentAddressedEvalResultStore(outputRoot);
    const admissions = createV3ReleaseAdmissionRepository(sql, artifacts);
    sqlPort.close = closeSelected ?? (async () => { await sql.end({ timeout: 5 }); });
    return {
      sql: sqlPort,
      http: createFetchConvergenceHttpPort(),
      process: createNodeConvergenceProcessPort(),
      artifacts,
      admissions,
      clock: createSystemClock(),
    };
  } catch (error) {
    if (closeSelected) {
      try { await closeSelected(); }
      catch (cleanup) { throw new AggregateError([error, cleanup], "FRESH_V3_EVAL_PREPARATION_AND_CLOSE_FAILED"); }
    }
    throw error;
  }
}

type CliOptions = Readonly<{
  suiteFile: string;
  outputRoot: string;
  releaseSha?: string;
  execute: boolean;
  json: boolean;
}>;

function parseCli(argv: readonly string[]): CliOptions {
  const root = packageRoot();
  const selectedSuite = freshInstallationSelectionV1
    ? path.join(freshInstallationSelectionV1.paths.repository, "evals", "suites", "product-convergence-codex-v1.json")
    : null;
  let suiteFile = selectedSuite ?? path.join(root, "evals", "suites", "product-convergence-v1.json");
  let outputRoot = resolveConvergenceEvalResultDir();
  let releaseSha: string | undefined;
  let execute = false;
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--execute") execute = true;
    else if (argument === "--json") json = true;
    else if (argument === "--suite" && argv[index + 1]) {
      suiteFile = argv[++index]!;
      if (selectedSuite && suiteFile !== selectedSuite) throw new Error("MANUAL_EVALUATION_RECIPE_REFUSED");
    }
    else if (argument === "--output-root" && argv[index + 1]) outputRoot = argv[++index]!;
    else if (argument === "--release-sha" && argv[index + 1]) releaseSha = argv[++index]!;
    else throw new Error(`EVAL_ARGUMENT_INVALID:${argument}`);
  }
  return { suiteFile, outputRoot, ...(releaseSha ? { releaseSha } : {}), execute, json };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const ports = await createDefaultConvergencePorts(options.outputRoot);
  try {
    const inspected = await ports.process.inspectRelease();
    const releaseSha = GitObjectHashSchema.parse(options.releaseSha ?? inspected.headSha);
    if (options.execute && !options.releaseSha) throw new Error("EVAL_EXECUTE_RELEASE_SHA_REQUIRED");
    const loaded = await loadConvergenceSuiteVersioned(options.suiteFile);
    const completed = freshInstallationSelectionV1
      ? await (await import("../execution/manual-test-worker-v1.js")).runSelectedDirectConvergenceV1(loaded, {
          releaseSha, execute: options.execute,
        }, ports)
      : await runConvergenceSuite(loaded, { releaseSha, execute: options.execute }, ports);
    process.stdout.write(completed.result.schema === "setfarm.product-convergence-result.v2"
      ? options.json
        ? stableConvergenceResultJsonV2(completed.result)
        : convergenceResultTableV2(completed.result)
      : options.json
        ? stableConvergenceResultJson(completed.result)
        : convergenceResultTable(completed.result));
    process.stdout.write(`ARTIFACT ${completed.artifact.locator}\n`);
    process.stdout.write(`RELEASE_GATE ${completed.gate.decision.toUpperCase()} ${completed.gateArtifact.locator} ${completed.gate.gateHash}\n`);
    if (completed.result.status === "blocked" || completed.result.status === "fail") process.exitCode = 2;
  } finally {
    await ports.sql.close?.();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
