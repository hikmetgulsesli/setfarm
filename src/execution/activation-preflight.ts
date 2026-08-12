import { z } from "zod";
import type postgres from "postgres";

import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import {
  measureArtifactCapacity,
  type ArtifactCapacityLimits,
} from "../product-compiler/artifact-capacity.js";
import {
  ArtifactStoreError,
  ContentAddressedArtifactStore,
} from "../product-compiler/artifact-store.js";
import { createArtifactInventoryStoreV1 } from "../product-compiler/artifact-inventory-store.js";
import {
  createHybridArtifactStoreCapacityLeaseProviderV1,
  ArtifactStoreAuthorityError,
} from "../product-compiler/artifact-store-authority.js";
import {
  ArtifactIndexError,
  createArtifactIndex,
} from "../product-compiler/artifact-index.js";
import {
  IndexedArtifactPublisher,
  IndexedArtifactPublisherError,
  verifyArtifactIndexInventory,
} from "../product-compiler/indexed-artifact-publisher.js";
import {
  readContractSpineMigrationAttestation,
  verifyContractSpineMigrations,
} from "../db/contract-spine-migrations.js";
import {
  resolveArtifactStorePublicationAuthorityMode,
  type ArtifactStorePublicationAuthorityMode,
} from "../runtime-config.js";

const PreflightCheckV1Schema = z.object({
  id: z.enum([
    "migration_shape",
    "migration_attestation",
    "database",
    "artifact_capacity",
    "activity",
    "protocol_activation",
  ]),
  status: z.enum(["pass", "fail", "advisory"]),
  blocking: z.boolean(),
  code: z.string().regex(/^[A-Z][A-Z0-9_]{2,100}$/),
  metrics: z.record(z.string(), z.number().int().nonnegative()).optional(),
}).strict();

export const ActivationPreflightReportV1Schema = z.object({
  schema: z.literal("setfarm.activation-preflight.v1"),
  status: z.enum(["pass", "fail"]),
  protocol: z.enum(["shadow", "v3"]),
  compilerReleaseSha: z.string().regex(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/),
  checks: z.array(PreflightCheckV1Schema).length(6),
}).strict();

export type ActivationPreflightReportV1 = z.infer<typeof ActivationPreflightReportV1Schema>;

export type ActivationPreflightDependencies = Readonly<{
  verifyMigrations(): Promise<Readonly<{
    status: "verified" | "drift";
    versions: number[];
    verifiedReleaseSha: string | null;
  }>>;
  probeDatabase(): Promise<Readonly<{ ok: boolean }>>;
  inspectArtifactCapacity(): Promise<Readonly<{
    rootBytes: number;
    rootQuotaBytes: number;
    freeBytes: number;
    minFreeBytes: number;
    indexState: "bootstrap_required" | "ready" | "quarantined";
    indexedBytes: number;
    reservedBytes: number;
  }>>;
  readActivity(): Promise<Readonly<{
    activeRuns: number;
    openClaims: number;
    activeAttempts: number;
    activeAttemptBindingConflicts?: number;
    activeRuntimes?: number;
    activeRuntimeCompletions?: number;
    activeRecoveryCases?: number;
    activeRecoveryDeliveries?: number;
    activeTerminationRequests?: number;
  }>>;
  storeReport(report: ActivationPreflightReportV1): Promise<Readonly<{ hash: string }>>;
}>;

export type ActivationPreflightErrorCode = "ACTIVATION_PREFLIGHT_STORE_FAILED";

export class ActivationPreflightError extends Error {
  readonly code: ActivationPreflightErrorCode;
  override readonly cause?: unknown;

  constructor(code: ActivationPreflightErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ActivationPreflightError";
    this.code = code;
    this.cause = cause;
  }
}

type Check = z.infer<typeof PreflightCheckV1Schema>;

function check(
  id: Check["id"],
  status: Check["status"],
  code: string,
  metrics?: Record<string, number>,
): Check {
  return PreflightCheckV1Schema.parse({
    id,
    status,
    blocking: status === "fail",
    code,
    ...(metrics ? { metrics } : {}),
  });
}

function nonNegativeMetrics(values: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [
    key,
    Number.isSafeInteger(value) && value >= 0 ? value : 0,
  ]));
}

function artifactCapacityFailureCode(error: unknown): string {
  if (error instanceof IndexedArtifactPublisherError) return error.code;
  if (error instanceof ArtifactIndexError) {
    if (error.code === "ARTIFACT_BOOTSTRAP_MISMATCH") {
      return "ARTIFACT_INDEX_FILESYSTEM_DRIFT";
    }
    return error.code;
  }
  if (error instanceof ArtifactStoreAuthorityError) return error.code;
  if (error instanceof ArtifactStoreError) return error.code;
  return "ARTIFACT_CAPACITY_UNAVAILABLE";
}

export async function runActivationPreflight(
  input: Readonly<{
    protocol: "shadow" | "v3";
    compilerReleaseSha: string;
    v3ActivationEnabled: boolean;
  }>,
  dependencies: ActivationPreflightDependencies,
): Promise<Readonly<{
  status: "pass" | "fail";
  hash: string;
  stored: true;
  report: ActivationPreflightReportV1;
}>> {
  const checks: Check[] = [];
  let migration: Awaited<ReturnType<ActivationPreflightDependencies["verifyMigrations"]>> | undefined;
  try {
    migration = await dependencies.verifyMigrations();
    checks.push(check(
      "migration_shape",
      migration.status === "verified" ? "pass" : "fail",
      migration.status === "verified" ? "MIGRATION_SHAPE_VERIFIED" : "MIGRATION_SHAPE_DRIFT",
      { migrationVersions: migration.versions.length },
    ));
  } catch {
    checks.push(check("migration_shape", "fail", "MIGRATION_SHAPE_UNAVAILABLE"));
  }

  const attested = migration?.verifiedReleaseSha === input.compilerReleaseSha;
  checks.push(check(
    "migration_attestation",
    attested ? "pass" : input.protocol === "shadow" ? "advisory" : "fail",
    attested ? "MIGRATION_RELEASE_ATTESTED" : "MIGRATION_RELEASE_UNATTESTED",
  ));

  try {
    const database = await dependencies.probeDatabase();
    checks.push(check(
      "database",
      database.ok ? "pass" : "fail",
      database.ok ? "DATABASE_REACHABLE" : "DATABASE_PROBE_FAILED",
    ));
  } catch {
    checks.push(check("database", "fail", "DATABASE_PROBE_FAILED"));
  }

  try {
    const capacity = await dependencies.inspectArtifactCapacity();
    const withinQuota = capacity.rootBytes <= capacity.rootQuotaBytes;
    const enoughFree = capacity.freeBytes >= capacity.minFreeBytes;
    const indexReady = capacity.indexState === "ready";
    const indexExact = capacity.rootBytes === capacity.indexedBytes;
    const reservationsIdle = capacity.reservedBytes === 0;
    checks.push(check(
      "artifact_capacity",
      withinQuota && enoughFree && indexReady && indexExact && reservationsIdle ? "pass" : "fail",
      capacity.indexState === "bootstrap_required"
        ? "ARTIFACT_INDEX_BOOTSTRAP_REQUIRED"
        : capacity.indexState === "quarantined"
          ? "ARTIFACT_INDEX_QUARANTINED"
          : !indexExact
            ? "ARTIFACT_INDEX_FILESYSTEM_DRIFT"
            : !reservationsIdle
              ? "ARTIFACT_PUBLICATION_ACTIVE"
              : !withinQuota
        ? "ARTIFACT_ROOT_QUOTA_EXCEEDED"
        : !enoughFree
          ? "ARTIFACT_FREE_SPACE_LOW"
          : "ARTIFACT_CAPACITY_READY",
      nonNegativeMetrics({
        rootBytes: capacity.rootBytes,
        rootQuotaBytes: capacity.rootQuotaBytes,
        freeBytes: capacity.freeBytes,
        minFreeBytes: capacity.minFreeBytes,
        indexedBytes: capacity.indexedBytes,
        reservedBytes: capacity.reservedBytes,
        artifactIndexReady: indexReady ? 1 : 0,
      }),
    ));
  } catch (error) {
    checks.push(check("artifact_capacity", "fail", artifactCapacityFailureCode(error)));
  }

  try {
    const activity = await dependencies.readActivity();
    const activeAttemptBindingConflicts = activity.activeAttemptBindingConflicts ?? 0;
    const activeRuntimes = activity.activeRuntimes ?? 0;
    const activeRuntimeCompletions = activity.activeRuntimeCompletions ?? 0;
    const activeRecoveryCases = activity.activeRecoveryCases ?? 0;
    const activeRecoveryDeliveries = activity.activeRecoveryDeliveries ?? 0;
    const activeTerminationRequests = activity.activeTerminationRequests ?? 0;
    const idle = activity.activeRuns === 0
      && activity.openClaims === 0
      && activity.activeAttempts === 0
      && activeAttemptBindingConflicts === 0
      && activeRuntimes === 0
      && activeRuntimeCompletions === 0
      && activeRecoveryCases === 0
      && activeRecoveryDeliveries === 0
      && activeTerminationRequests === 0;
    checks.push(check(
      "activity",
      idle ? "pass" : "fail",
      idle
        ? "ACTIVATION_ACTIVITY_IDLE"
        : activeAttemptBindingConflicts > 0
          ? "ACTIVATION_ATTEMPT_CLAIM_BINDING_CONFLICT"
          : "ACTIVATION_ACTIVITY_CONFLICT",
      nonNegativeMetrics({
        activeRuns: activity.activeRuns,
        openClaims: activity.openClaims,
        activeAttempts: activity.activeAttempts,
        activeAttemptBindingConflicts,
        activeRuntimes,
        activeRuntimeCompletions,
        activeRecoveryCases,
        activeRecoveryDeliveries,
        activeTerminationRequests,
      }),
    ));
  } catch {
    checks.push(check("activity", "fail", "ACTIVATION_ACTIVITY_UNAVAILABLE"));
  }

  const protocolEnabled = input.protocol === "shadow" || input.v3ActivationEnabled;
  checks.push(check(
    "protocol_activation",
    protocolEnabled ? "pass" : "fail",
    input.protocol === "shadow"
      ? "SHADOW_PROTOCOL_ENABLED"
      : protocolEnabled
        ? "V3_PROTOCOL_ENABLED"
        : "V3_PROTOCOL_DISABLED",
  ));

  const report = ActivationPreflightReportV1Schema.parse({
    schema: "setfarm.activation-preflight.v1",
    status: checks.some((item) => item.status === "fail") ? "fail" : "pass",
    protocol: input.protocol,
    compilerReleaseSha: input.compilerReleaseSha,
    checks,
  });
  try {
    const stored = await dependencies.storeReport(report);
    const hash = Sha256Schema.parse(stored.hash);
    return Object.freeze({ status: report.status, hash, stored: true, report });
  } catch (error) {
    throw new ActivationPreflightError(
      "ACTIVATION_PREFLIGHT_STORE_FAILED",
      "Activation preflight report could not be stored",
      error,
    );
  }
}

export function createActivationPreflightDependencies(input: Readonly<{
  sql: postgres.Sql;
  artifactRoot: string;
  artifactLimits: ArtifactCapacityLimits;
  compilerReleaseSha: string;
  publicationAuthorityMode?: ArtifactStorePublicationAuthorityMode;
}>): ActivationPreflightDependencies {
  const publicationAuthority = input.publicationAuthorityMode
    ?? resolveArtifactStorePublicationAuthorityMode();
  const reportProvider = publicationAuthority === "hybrid-required"
    ? createHybridArtifactStoreCapacityLeaseProviderV1({
        sql: input.sql,
        artifactRoot: input.artifactRoot,
        purpose: "existing-writer",
      })
    : undefined;
  const inventoryStore = createArtifactInventoryStoreV1({
    sql: input.sql,
    artifactRoot: input.artifactRoot,
    artifactLimits: input.artifactLimits,
    purpose: "inventory-verify",
    publicationAuthorityMode: publicationAuthority,
  }).store;
  const reportStore = new ContentAddressedArtifactStore(input.artifactRoot, {
    limits: input.artifactLimits,
    ...(reportProvider ? { capacityLeaseProvider: reportProvider } : {}),
  });
  const index = createArtifactIndex(input.sql);
  const publisher = new IndexedArtifactPublisher({
    index,
    store: reportStore,
    ownerInstanceId: `activation-preflight:${process.pid}`,
    publicationAuthority,
  });
  return Object.freeze({
    verifyMigrations: async () => {
      const verified = await verifyContractSpineMigrations(input.sql);
      const attestation = await readContractSpineMigrationAttestation(input.sql);
      return {
        status: "verified" as const,
        versions: verified.migrations.map((migration) => migration.version),
        verifiedReleaseSha: attestation.status === "attested"
          ? attestation.verifiedReleaseSha
          : null,
      };
    },
    probeDatabase: async () => {
      const rows = await input.sql.unsafe<Array<{ ok: number }>>("SELECT 1::integer AS ok");
      return { ok: rows[0]?.ok === 1 };
    },
    inspectArtifactCapacity: async () => {
      const current = await index.getCapacity();
      if (current.state !== "ready") {
        const snapshot = await measureArtifactCapacity(input.artifactRoot);
        return {
          rootBytes: snapshot.rootBytes,
          rootQuotaBytes: input.artifactLimits.rootQuotaBytes,
          freeBytes: snapshot.freeBytes,
          minFreeBytes: input.artifactLimits.minFreeBytes,
          indexState: current.state,
          indexedBytes: current.totalBytes,
          reservedBytes: current.reservedBytes,
        };
      }
      const verified = await verifyArtifactIndexInventory({
        index,
        store: inventoryStore,
      });
      const snapshot = await measureArtifactCapacity(input.artifactRoot);
      return {
        rootBytes: verified.inventory.totalBytes,
        rootQuotaBytes: input.artifactLimits.rootQuotaBytes,
        freeBytes: snapshot.freeBytes,
        minFreeBytes: input.artifactLimits.minFreeBytes,
        indexState: verified.capacity.state,
        indexedBytes: verified.capacity.totalBytes,
        reservedBytes: verified.capacity.reservedBytes,
      };
    },
    readActivity: async () => {
      const rows = await input.sql.unsafe<Array<{
        active_runs: number;
        open_claims: number;
        active_attempts: number;
        active_attempt_binding_conflicts: number;
        active_runtimes: number;
        active_runtime_completions: number;
        active_recovery_cases: number;
        active_recovery_deliveries: number;
        active_termination_requests: number;
      }>>(
        `SELECT
           (SELECT COUNT(*)::integer FROM runs
             WHERE status IN ('running', 'resuming')) AS active_runs,
           (SELECT COUNT(*)::integer FROM claim_log WHERE outcome IS NULL) AS open_claims,
           (SELECT COUNT(*)::integer FROM execution_attempts
             WHERE disposition IN ('claimed', 'running')) AS active_attempts,
           (SELECT COUNT(*)::integer
              FROM execution_attempts ea
              LEFT JOIN claim_log cl
                ON cl.id = ea.claim_id
               AND cl.run_id = ea.run_id
               AND cl.step_id = ea.step_id
               AND COALESCE(cl.story_id, '') = ea.story_id
               AND (ea.agent_id IS NULL OR cl.agent_id = ea.agent_id)
               AND cl.outcome IS NULL
             WHERE ea.disposition IN ('claimed', 'running')
               AND cl.id IS NULL) AS active_attempt_binding_conflicts,
           (SELECT COUNT(*)::integer FROM runtime_sessions
             WHERE state NOT IN ('released', 'quarantined')) AS active_runtimes,
           (SELECT COUNT(*)::integer FROM runtime_completion_requests
             WHERE state NOT IN ('accepted', 'rejected', 'quarantined')) AS active_runtime_completions,
           (SELECT COUNT(*)::integer FROM recovery_cases
             WHERE status IN ('open', 'repairing', 'evidencing')) AS active_recovery_cases,
           (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries
             WHERE state IN ('authorized', 'leased', 'attempt_reserved', 'running')) AS active_recovery_deliveries,
           (SELECT COUNT(*)::integer FROM run_termination_requests
             WHERE state <> 'terminalized') AS active_termination_requests`,
      );
      return {
        activeRuns: rows[0]?.active_runs ?? 0,
        openClaims: rows[0]?.open_claims ?? 0,
        activeAttempts: rows[0]?.active_attempts ?? 0,
        activeAttemptBindingConflicts: rows[0]?.active_attempt_binding_conflicts ?? 0,
        activeRuntimes: rows[0]?.active_runtimes ?? 0,
        activeRuntimeCompletions: rows[0]?.active_runtime_completions ?? 0,
        activeRecoveryCases: rows[0]?.active_recovery_cases ?? 0,
        activeRecoveryDeliveries: rows[0]?.active_recovery_deliveries ?? 0,
        activeTerminationRequests: rows[0]?.active_termination_requests ?? 0,
      };
    },
    storeReport: async (report) => {
      const stored = await publisher.put({
        schema: "setfarm.semantic-artifact-envelope.v1",
        artifactType: "setfarm.activation-preflight.v1",
        producer: {
          pass: "activation-preflight",
          codeSha: input.compilerReleaseSha,
          toolVersions: { node: process.versions.node },
        },
        payload: report,
      });
      return { hash: stored.hash };
    },
  });
}

export async function runDefaultActivationPreflight(input: Readonly<{
  protocol: "shadow" | "v3";
  compilerReleaseSha: string;
  env?: NodeJS.ProcessEnv;
}>): Promise<Awaited<ReturnType<typeof runActivationPreflight>>> {
  const [db, config] = await Promise.all([
    import("../db-pg.js"),
    import("../runtime-config.js"),
  ]);
  const env = input.env ?? process.env;
  const root = config.resolveProductArtifactDir(env);
  const limits = config.resolveProductArtifactCapacity(env);
  const sql = db.getSql();
  return runActivationPreflight({
    protocol: input.protocol,
    compilerReleaseSha: input.compilerReleaseSha,
    v3ActivationEnabled: env.SETFARM_V3_ACTIVATION === "enabled",
  }, createActivationPreflightDependencies({
    sql,
    artifactRoot: root,
    artifactLimits: limits,
    compilerReleaseSha: input.compilerReleaseSha,
    publicationAuthorityMode: config.resolveArtifactStorePublicationAuthorityMode(env),
  }));
}
