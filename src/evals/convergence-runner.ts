#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import postgres from "postgres";
import YAML from "yaml";
import { z } from "zod";

import {
  readContractSpineMigrationAttestation,
  verifyContractSpineMigrations,
} from "../db/contract-spine-migrations.js";
import {
  EvidenceBundleV2Schema,
  computeEvidenceBundleHash,
  type EvidenceBundleV2,
} from "../evidence/evidence-bundle-v2.js";
import { AcceptedCandidateV1Schema } from "../evidence/accepted-candidate-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  RuntimeArtifactReaderError,
  createRuntimeArtifactReader,
} from "../product-compiler/runtime-artifact-reader.js";
import { GitObjectHashSchema, Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import type { ArtifactCapacityLimits } from "../product-compiler/artifact-capacity.js";
import {
  resolveProductArtifactCapacity,
  resolveProductArtifactDir,
  runtimeConfig,
} from "../runtime-config.js";
import { readOpenClawConfig } from "../installer/openclaw-config.js";
import { computeRunOperationalSnapshotHash } from "../server/run-operational-snapshot.js";
import { RunOperationalSnapshotV1Schema } from "../server/schemas/run-operational-snapshot-v1.js";
import type { ConvergenceCaseV1, ProductConvergenceSuiteV1 } from "./suite-schema.js";
import {
  ConvergenceStackPackV1Schema,
  convergenceCaseHash,
  loadConvergenceSuite,
} from "./suite-schema.js";
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
  ContentAddressedEvalResultStore,
  convergenceResultTable,
  stableConvergenceResultJson,
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
import { createV3ReleaseAdmissionRepository } from "../execution/v3-release-admission-repository.js";
import {
  serializeInternalCanaryAdmissionContext,
  type InternalCanaryAdmissionContextV1,
} from "../execution/v3-release-admission.js";

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
const REQUIRED_PACKET_ARTIFACT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  PRODUCT_SPEC: "setfarm.product-spec.v1",
  DESIGN_GRAPH: "setfarm.design-interaction-graph.v1",
  BUILD_TOPOLOGY: "setfarm.build-topology.v1",
  STORY_PLAN: "setfarm.story-plan.v1",
  PRODUCT_BUILD_PACKET: "setfarm.product-build-packet.v1",
  COMPILATION_REPORT: "setfarm.product-compilation-report.v1",
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

export type ConvergenceRunCollection = Readonly<{
  canonical: z.infer<typeof ConvergenceCanonicalEvidenceV1Schema>;
  rootCauseHash: string | null;
  pullRequests: readonly ConvergencePullRequestRef[];
}>;

export interface ConvergenceSqlPort {
  inspectPlatform(): Promise<ConvergencePlatformInspection>;
  readRun(runId: string): Promise<ConvergenceRunPoll>;
  collectRun(
    runId: string,
    input: Readonly<{
      task: string;
      oracle: TaskIntentOracleV1;
    }>,
  ): Promise<ConvergenceRunCollection>;
  close?(): Promise<void>;
}

export interface ConvergenceHttpPort {
  health(service: "setfarm" | "mission_control"): Promise<Readonly<{ ok: boolean; evidenceHash: string }>>;
  operationalSnapshot(service: "setfarm" | "mission_control", runId: string): Promise<unknown>;
  syncProject(runId: string): Promise<Readonly<{ ok: boolean; evidenceHash: string }>>;
}

export interface ConvergenceProcessPort {
  inspectRelease(): Promise<ConvergenceReleaseInspection>;
  startRun(input: Readonly<{
    workflowId: string;
    task: string;
    releaseSha: string;
    admission: InternalCanaryAdmissionContextV1;
  }>): Promise<Readonly<{ runId: string; runNumber: number }>>;
  inspectProject(input: Readonly<{
    projectLocator: string | null;
    canonicalSourceRevision: Readonly<{ sha: string; treeHash: string }> | null;
  }>): Promise<Readonly<{
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
  put(value: ConvergenceEvalRunResultV1 | ConvergenceEvalResultV1 | ConvergenceReleaseGateV1): Promise<StoredConvergenceArtifact>;
}

export interface ConvergenceAdmissionPort {
  createCanary(input: Readonly<{
    releaseSha: string;
    suiteHash: string;
    preflightHash: string;
    issuedAt: string;
    expiresAt: string;
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
  result: ConvergenceEvalResultV1;
  artifact: StoredConvergenceArtifact;
  gate: ConvergenceReleaseGateV1;
  gateArtifact: StoredConvergenceArtifact;
}>;

function safeHash(value: unknown): string {
  return hashCanonicalJson(value);
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
  } catch {
    return { ok: false };
  }
}

function suiteProfilesMatch(suite: ProductConvergenceSuiteV1, release: ConvergenceReleaseInspection): boolean {
  return suite.cases.every((item) =>
    item.executionProfile.providerId === release.providerId
    && item.executionProfile.modelId === release.modelId);
}

async function buildPreflight(
  suite: ProductConvergenceSuiteV1,
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
      storeRead.ok,
      "EVAL_RESULT_STORE_APPEND_ONLY_READY",
      "EVAL_RESULT_STORE_UNAVAILABLE",
      { ready: storeRead.ok },
    ),
  ];
  return { preflight: createConvergencePreflight({ checks }), release };
}

function emptyCanonical(
  code: string,
  input: Readonly<{ task: string; oracle: TaskIntentOracleV1 }>,
): z.infer<typeof ConvergenceCanonicalEvidenceV1Schema> {
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
  const oracle = evaluateTaskIntentOracleV1({ ...input, actual: { kind: "unavailable" } });
  const payload = { packet, attempts, findings, recovery, evidence, acceptance, oracle, invariantCodes: [reasonCode(code)] };
  return ConvergenceCanonicalEvidenceV1Schema.parse({ ...payload, stateHash: safeHash(payload) });
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
): Promise<z.infer<typeof ConvergenceProjectionEvidenceV1Schema>> {
  const [setfarmRead, missionControlRead] = await Promise.all([
    settle(() => ports.http.operationalSnapshot("setfarm", runId)),
    settle(() => ports.http.operationalSnapshot("mission_control", runId)),
  ]);
  if (!setfarmRead.ok || !missionControlRead.ok) return unavailableProjection();
  const setfarm = RunOperationalSnapshotV1Schema.safeParse(setfarmRead.value);
  const missionControl = RunOperationalSnapshotV1Schema.safeParse(missionControlRead.value);
  if (!setfarm.success || !missionControl.success) return unavailableProjection();
  const { snapshotHash: setfarmSnapshotHash, ...setfarmHashable } = setfarm.data;
  const { snapshotHash: missionControlSnapshotHash, ...missionControlHashable } = missionControl.data;
  if (
    setfarm.data.run.id !== runId
    || missionControl.data.run.id !== runId
    || computeRunOperationalSnapshotHash(setfarmHashable) !== setfarmSnapshotHash
    || computeRunOperationalSnapshotHash(missionControlHashable) !== missionControlSnapshotHash
  ) return unavailableProjection();
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
  const operationalSettled = [setfarm.data, missionControl.data].every((snapshot) =>
    snapshot.summary.lifecycleState === "terminal"
    && snapshot.summary.health === "ok"
    && snapshot.summary.invariantViolations === 0
    && snapshot.summary.unpublishedOutbox === 0
    && snapshot.invariants.length === 0
    && snapshot.outbox.every((item) => item.state === "published"));
  return ConvergenceProjectionEvidenceV1Schema.parse({
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
  });
}

async function waitForCanonicalProjection(
  ports: ConvergenceRunnerPorts,
  runId: string,
  accepted: boolean,
  pollMs: number,
): Promise<z.infer<typeof ConvergenceProjectionEvidenceV1Schema>> {
  if (accepted) await settle(() => ports.http.syncProject(runId));
  let projection = await collectProjection(ports, runId);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const complete = projection.exactHashMatch
      && projection.setfarmProjection === "complete"
      && projection.missionControlProjection === "complete"
      && projection.operationalSettled
      && Object.values(projection.capabilities).every(Boolean)
      && (accepted ? projection.transferAcknowledged : !projection.transferAcknowledged);
    if (complete) return projection;
    if (accepted && attempt > 0 && attempt % 3 === 0) {
      await settle(() => ports.http.syncProject(runId));
    }
    await ports.clock.sleep(Math.min(5_000, Math.max(250, pollMs)));
    projection = await collectProjection(ports, runId);
  }
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

function rootCauseForFailure(input: Readonly<{
  collected: ConvergenceRunCollection;
  canonical: z.infer<typeof ConvergenceCanonicalEvidenceV1Schema>;
  projection: z.infer<typeof ConvergenceProjectionEvidenceV1Schema>;
  ownership: z.infer<typeof ConvergenceOwnershipEvidenceV1Schema>;
  github: z.infer<typeof ConvergenceGitHubEvidenceV1Schema>;
  disposition: string;
  actualStackPackId: string | null;
  expectedStackPackId: string | null;
}>): string {
  if (input.collected.rootCauseHash) return Sha256Schema.parse(input.collected.rootCauseHash);
  return safeHash({
    disposition: input.disposition,
    canonical: input.canonical.stateHash,
    projection: input.projection,
    ownership: input.ownership,
    github: input.github,
    actualStackPackId: input.actualStackPackId,
    expectedStackPackId: input.expectedStackPackId,
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
  suite: ProductConvergenceSuiteV1,
  releaseSha: string,
  ports: ConvergenceRunnerPorts,
): Promise<Readonly<{ poll: ConvergenceRunPoll; timedOut: boolean; invalidated: boolean }>> {
  const deadline = ports.clock.now().getTime() + suite.timeout.runMs;
  let latest = await ports.sql.readRun(runId);
  let invalidated = latest.protocol !== "v3" || latest.compilerReleaseSha !== releaseSha;
  while (!latest.terminal && ports.clock.now().getTime() < deadline) {
    await ports.clock.sleep(suite.timeout.pollMs);
    latest = await ports.sql.readRun(runId);
    invalidated ||= latest.protocol !== "v3" || latest.compilerReleaseSha !== releaseSha;
  }
  return { poll: latest, timedOut: !latest.terminal, invalidated };
}

function plannedCases(suite: ProductConvergenceSuiteV1): Array<Readonly<{
  value: ConvergenceCaseV1;
  repetition: number;
}>> {
  const planned: Array<Readonly<{ value: ConvergenceCaseV1; repetition: number }>> = [];
  for (const value of suite.cases) {
    for (let repetition = 1; repetition <= suite.repetitionsPerCase; repetition += 1) {
      planned.push({ value, repetition });
    }
  }
  return planned;
}

export async function runConvergenceSuite(
  loaded: Readonly<{ suite: ProductConvergenceSuiteV1; suiteHash: string }>,
  rawOptions: Readonly<{ releaseSha: string; execute?: boolean }>,
  ports: ConvergenceRunnerPorts,
): Promise<ConvergenceSuiteRun> {
  const options = RunnerOptionsSchema.parse({
    releaseSha: rawOptions.releaseSha,
    execute: rawOptions.execute === true,
  });
  const startedAt = iso(ports.clock);
  const { preflight, release } = await buildPreflight(
    loaded.suite,
    options.releaseSha,
    options.execute,
    ports,
  );
  const planned = plannedCases(loaded.suite);
  const runs: ConvergenceEvalRunResultV1[] = [];
  const rootCounts = new Map<string, number>();
  const blockers = new Set<string>();
  let repeatedRootCause: string | null = null;
  let canaryContexts = new Map<string, InternalCanaryAdmissionContextV1>();

  if (preflight.status !== "pass") blockers.add("EVAL_PREFLIGHT_BLOCKED");

  if (options.execute && preflight.status === "pass") {
    const issuedAt = iso(ports.clock);
    const expiresAt = new Date(
      new Date(issuedAt).getTime()
      + (planned.length * loaded.suite.timeout.runMs)
      + 60 * 60 * 1_000,
    ).toISOString();
    const creation = await settle(() => ports.admissions.createCanary({
      releaseSha: options.releaseSha,
      suiteHash: loaded.suiteHash,
      preflightHash: preflight.preflightHash,
      issuedAt,
      expiresAt,
      slots: planned.map((item) => ({
        caseHash: convergenceCaseHash(item.value),
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
      if (!await verifyReleaseStillPinned(options.releaseSha, release.runnerHash, ports)) {
        blockers.add("EVAL_RELEASE_IDENTITY_DRIFT");
        break;
      }
      const platformRead = await settle(() => ports.sql.inspectPlatform());
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
      const caseHash = convergenceCaseHash(item.value);
      const taskHash = safeHash(item.value.task);
      const admission = canaryContexts.get(`${caseHash}:${taskHash}:${item.repetition}`);
      if (!admission) {
        blockers.add("EVAL_CANARY_ADMISSION_INCOMPLETE");
        break;
      }
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
      const terminal = await waitForTerminal(
        startRead.value.runId,
        loaded.suite,
        options.releaseSha,
        ports,
      );
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
            rootCauseHash: null,
            pullRequests: [],
          };
      const expectedDecision = item.value.oracle.expectedDecision;
      const projection = await waitForCanonicalProjection(
        ports,
        startRead.value.runId,
        expectedDecision.kind === "accepted_candidate",
        loaded.suite.timeout.pollMs,
      );
      const projectRead = expectedDecision.kind === "typed_rejection"
        ? { ok: true as const, value: {
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
            manualProjectMutationDetected: true,
            sourceHeadMatchesCanonical: false,
            projectHeadSha: null,
            projectTreeHash: null,
            canonicalHeadSha: null,
            canonicalTreeHash: null,
          };
      const ownershipPayload = {
        ...terminal.poll.ownership,
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
        oracleHash: taskIntentOracleHashV1(item.value.task, item.value.oracle),
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
        createConvergenceRunResult({ ...runPayload, passed: true, rootCauseHash: null });
        passed = true;
      } catch {
        passed = false;
      }
      const rootCauseHash = passed ? null : rootCauseForFailure({
        collected,
        canonical: collected.canonical,
        projection,
        ownership,
        github,
        disposition,
        actualStackPackId: actualStack.success ? actualStack.data : null,
        expectedStackPackId: expectedDecision.kind === "accepted_candidate" ? expectedDecision.stackPackId : null,
      });
      const runResult = createConvergenceRunResult({ ...runPayload, passed, rootCauseHash });
      await ports.artifacts.put(runResult);
      runs.push(runResult);
      if (rootCauseHash) {
        const count = (rootCounts.get(rootCauseHash) ?? 0) + 1;
        rootCounts.set(rootCauseHash, count);
        if (count >= loaded.suite.rootCauseRepeatLimit) {
          repeatedRootCause = rootCauseHash;
          blockers.add("EVAL_REPEATED_ROOT_CAUSE_STOP");
          break;
        }
      }
      if (terminal.timedOut) {
        blockers.add("EVAL_RUN_TIMEOUT_ACTIVE_OWNERSHIP");
        break;
      }
      if (identityInvalidated || project.manualProjectMutationDetected || !project.sourceHeadMatchesCanonical) {
        blockers.add("EVAL_RUN_IDENTITY_INVALIDATED");
        break;
      }
    }
  }

  const complete = runs.length === planned.length;
  const allPassed = complete && runs.every((item) => item.passed);
  const status = !options.execute
    ? preflight.status === "pass" ? "planned" as const : "blocked" as const
    : allPassed
      ? "pass" as const
      : complete && repeatedRootCause === null
        ? "fail" as const
        : "blocked" as const;
  const result = createConvergenceResult({
    schema: "setfarm.product-convergence-result.v1",
    suiteId: loaded.suite.suiteId,
    suiteVersion: loaded.suite.suiteVersion,
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
  const artifact = await ports.artifacts.put(result);
  const gate = evaluateConvergenceReleaseGate(result);
  const gateArtifact = await ports.artifacts.put(gate);
  if (gate.decision === "go") {
    await ports.admissions.promoteReleaseGo({
      releaseSha: options.releaseSha,
      suiteHash: loaded.suiteHash,
      resultHash: artifact.hash,
      resultRef: artifact.locator,
      gateHash: gateArtifact.hash,
      gateRef: gateArtifact.locator,
    });
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
  input: Readonly<{ task: string; oracle: TaskIntentOracleV1 }>,
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
    && record.success
    && terminationEvidence["sourceTaskHash"] === record.data.sourceTaskHash
    && terminationEvidence["rejectionHash"] === record.data.rejectionHash;
  const oracle = record.success
    ? evaluateTaskIntentOracleV1({
        ...input,
        actual: {
          kind: "typed_rejection",
          rejection: record.data.rejection,
          owner: record.data.owner,
          modelRedispatchBudget: record.data.terminal.modelRedispatchBudget,
        },
      })
    : evaluateTaskIntentOracleV1({ ...input, actual: { kind: "unavailable" } });
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
  const canonical = ConvergenceCanonicalEvidenceV1Schema.parse({
    ...canonicalPayload,
    stateHash: safeHash(canonicalPayload),
  });
  const failed = String(run["status"] ?? "").toLowerCase() !== "failed"
    || canonical.invariantCodes.length > 0;
  return {
    canonical,
    rootCauseHash: failed
      ? safeHash({ runStatus: run["status"], invariantCodes: canonical.invariantCodes, oracle: oracle.evaluationHash })
      : null,
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
  }> = {},
): ConvergenceSqlPort {
  const artifactReader = createRuntimeArtifactReader({
    sql,
    artifactRoot: options.artifactRoot ?? resolveProductArtifactDir(),
    artifactLimits: options.artifactLimits ?? resolveProductArtifactCapacity(),
  });
  return {
    async inspectPlatform() {
      let migrationVerified = false;
      let attestedReleaseSha: string | null = null;
      try {
        await verifyContractSpineMigrations(sql);
        migrationVerified = true;
        const attestation = await readContractSpineMigrationAttestation(sql);
        attestedReleaseSha = attestation.status === "attested" ? attestation.verifiedReleaseSha : null;
      } catch {
        migrationVerified = false;
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
      const missingRequiredRefs = Object.keys(REQUIRED_PACKET_ARTIFACT_TYPES)
        .filter((ref) => !refKeys.includes(ref)).length;
      const missingArtifacts = refs.filter((row) => row["artifact_exists"] !== true).length;
      const packetInvalid = packetRows.filter((row) =>
        String(row["packet_hash"]) !== packetHash
        || String(row["compiler_code_sha"]) !== String(run["compiler_release_sha"])).length;
      const requiredRefInvalid = refs.filter((row) => {
        const expectedType = REQUIRED_PACKET_ARTIFACT_TYPES[String(row["ref_key"])] ?? null;
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
        ? evaluateTaskIntentOracleV1({
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
        : evaluateTaskIntentOracleV1({ ...input, actual: { kind: "unavailable" } });

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
      const canonical = ConvergenceCanonicalEvidenceV1Schema.parse({
        ...canonicalPayload,
        stateHash: safeHash(canonicalPayload),
      });

      const failureRows = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT check_id, status FROM run_observations
          WHERE run_id = $1 AND status IN ('fail', 'blocked')
          ORDER BY created_at, id`,
        [runId],
      );
      const storyFailures = await sql.unsafe<Array<Record<string, unknown>>>(
        `SELECT story_id, quality_failure_fingerprint
           FROM stories WHERE run_id = $1 AND quality_failure_fingerprint IS NOT NULL
          ORDER BY story_id`,
        [runId],
      );
      const failed = !["completed", "done"].includes(String(run["status"]).toLowerCase())
        || canonical.invariantCodes.length > 0;
      const rootCauseHash = failed
        ? safeHash({
            runStatus: run["status"],
            invariantCodes: canonical.invariantCodes,
            openFindingRefs: findingRows
              .filter((row) => row["status"] === "open")
              .map((row) => row["invariant_ref"]),
            failureRows: sortedRows(failureRows),
            storyFailures: sortedRows(storyFailures),
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
        rootCauseHash,
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
    .filter((entry) => /^(?:suite-schema|result-schema|convergence-runner|release-gate|report|task-intent-oracle)\.(?:ts|js)$/.test(entry))
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

export function createNodeConvergenceProcessPort(root = packageRoot()): ConvergenceProcessPort {
  const cli = path.join(root, "dist", "cli", "cli.js");
  return {
    async inspectRelease() {
      const [headSha, status, workflowText, runnerHash, openClaw] = await Promise.all([
        command("git", ["rev-parse", "HEAD"], { cwd: root }),
        command("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root }),
        readFile(path.join(root, "workflows", "feature-dev", "workflow.yml"), "utf8"),
        evaluationCodeHash(root),
        readOpenClawConfig(),
      ]);
      let cliReady = true;
      try { await access(cli, fsConstants.R_OK); } catch { cliReady = false; }
      const workflow = YAML.parse(workflowText) as Record<string, unknown>;
      const mapping = workflow["agent_mapping"] && typeof workflow["agent_mapping"] === "object"
        ? workflow["agent_mapping"] as Record<string, unknown>
        : {};
      const expectedAgentIds = [...new Set(Object.values(mapping).flatMap((value) =>
        Array.isArray(value) ? value.map(String) : value ? [String(value)] : []))].sort();
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
      const environmentHash = safeHash({
        node: process.versions.node,
        platform: process.platform,
        architecture: process.arch,
        database: "postgresql",
        setfarmTransport: "loopback-http",
        missionControlTransport: "loopback-http",
        workflowHash: createHash("sha256").update(workflowText).digest("hex"),
        executionProfileHash: safeHash({ providerId, modelId, agentCount: expectedAgentIds.length }),
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
      const output = await command(process.execPath, [
        cli,
        "workflow",
        "run",
        input.workflowId,
        input.task,
        "--protocol",
        "v3",
      ], {
        cwd: root,
        timeout: 120_000,
        env: {
          ...process.env,
          SETFARM_INTERNAL_CONVERGENCE_ADMISSION:
            serializeInternalCanaryAdmissionContext(input.admission),
        },
      });
      const match = output.match(/Run:\s*#([1-9][0-9]*)\s*\(([^)]+)\)/);
      if (!match) throw new Error("EVAL_RUN_START_OUTPUT_INVALID");
      return { runId: match[2]!, runNumber: Number(match[1]) };
    },

    async inspectProject(input) {
      if (!input.projectLocator || !path.isAbsolute(input.projectLocator)) {
        return {
          manualProjectMutationDetected: true,
          sourceHeadMatchesCanonical: false,
          projectHeadSha: null,
          projectTreeHash: null,
          canonicalHeadSha: null,
          canonicalTreeHash: null,
        };
      }
      const [status, projectHeadSha, projectTreeHash] = await Promise.all([
        command("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: input.projectLocator }),
        command("git", ["rev-parse", "HEAD"], { cwd: input.projectLocator }),
        command("git", ["rev-parse", "HEAD^{tree}"], { cwd: input.projectLocator }),
      ]);
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
      const canonicalHeadSha = input.canonicalSourceRevision?.sha ?? null;
      const canonicalTreeHash = input.canonicalSourceRevision?.treeHash ?? null;
      return {
        manualProjectMutationDetected: status.length > 0,
        sourceHeadMatchesCanonical: Boolean(
          canonicalHeadSha
          && canonicalTreeHash
          && upstreamHeadSha
          && upstreamTreeHash
          && projectHeadSha.toLowerCase() === canonicalHeadSha.toLowerCase()
          && projectTreeHash.toLowerCase() === canonicalTreeHash.toLowerCase()
          && upstreamHeadSha.toLowerCase() === canonicalHeadSha.toLowerCase()
          && upstreamTreeHash.toLowerCase() === canonicalTreeHash.toLowerCase()
        ),
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

async function fetchResponse(url: string): Promise<Response> {
  return fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
}

export function createFetchConvergenceHttpPort(): ConvergenceHttpPort {
  return {
    async health(service) {
      const response = await fetchResponse(endpoint(service, service === "setfarm" ? "/" : "/api/health"));
      return { ok: response.ok, evidenceHash: safeHash({ service, status: response.status }) };
    },
    async operationalSnapshot(service, runId) {
      const pathname = service === "setfarm"
        ? `/api/runs/${encodeURIComponent(runId)}/operational-snapshot`
        : `/api/setfarm/runs/${encodeURIComponent(runId)}/operational-snapshot`;
      const response = await fetchResponse(endpoint(service, pathname));
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
        headers: { accept: "application/json" },
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

export function createDefaultConvergencePorts(outputRoot: string): ConvergenceRunnerPorts {
  const sql = postgres(runtimeConfig.setfarmPgUrl, {
    max: 4,
    idle_timeout: 2,
    connect_timeout: 10,
    onnotice: () => {},
  });
  const sqlPort = createPostgresConvergencePort(sql);
  const artifacts = new ContentAddressedEvalResultStore(outputRoot);
  const admissions = createV3ReleaseAdmissionRepository(sql, artifacts);
  sqlPort.close = async () => { await sql.end({ timeout: 5 }); };
  return {
    sql: sqlPort,
    http: createFetchConvergenceHttpPort(),
    process: createNodeConvergenceProcessPort(),
    artifacts,
    admissions,
    clock: createSystemClock(),
  };
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
  let suiteFile = path.join(root, "evals", "suites", "product-convergence-v1.json");
  let outputRoot = path.join(root, ".setfarm", "evals", "results");
  let releaseSha: string | undefined;
  let execute = false;
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--execute") execute = true;
    else if (argument === "--json") json = true;
    else if (argument === "--suite" && argv[index + 1]) suiteFile = argv[++index]!;
    else if (argument === "--output-root" && argv[index + 1]) outputRoot = argv[++index]!;
    else if (argument === "--release-sha" && argv[index + 1]) releaseSha = argv[++index]!;
    else throw new Error(`EVAL_ARGUMENT_INVALID:${argument}`);
  }
  return { suiteFile, outputRoot, ...(releaseSha ? { releaseSha } : {}), execute, json };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const ports = createDefaultConvergencePorts(options.outputRoot);
  try {
    const inspected = await ports.process.inspectRelease();
    const releaseSha = GitObjectHashSchema.parse(options.releaseSha ?? inspected.headSha);
    if (options.execute && !options.releaseSha) throw new Error("EVAL_EXECUTE_RELEASE_SHA_REQUIRED");
    const loaded = await loadConvergenceSuite(options.suiteFile);
    const completed = await runConvergenceSuite(loaded, {
      releaseSha,
      execute: options.execute,
    }, ports);
    process.stdout.write(options.json
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
