#!/usr/bin/env node

import postgres from "postgres";

import {
  planContractSpineMigrations,
  verifyContractSpineMigrations,
} from "../src/db/contract-spine-migrations.js";
import { createArtifactInventoryStoreV1 } from "../src/product-compiler/artifact-inventory-store.js";
import { createArtifactIndex } from "../src/product-compiler/artifact-index.js";
import {
  bootstrapArtifactIndex,
  recoverExpiredArtifactPublicationBatches,
  recoverExpiredArtifactPublications,
  scanArtifactInventory,
  verifyArtifactIndexInventory,
} from "../src/product-compiler/indexed-artifact-publisher.js";
import {
  resolveArtifactStorePublicationAuthorityMode,
  resolveProductArtifactCapacity,
  resolveProductArtifactDir,
  runtimeConfig,
} from "../src/runtime-config.js";

type Mode = "plan" | "bootstrap" | "verify" | "recover";

function optionalValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function positiveInteger(value: string | undefined, fallback: number, flag: string): number {
  if (value === undefined) return fallback;
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error(`${flag} requires a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${flag} exceeds the safe integer range`);
  return parsed;
}

function parseArgs(argv: string[]): Readonly<{
  mode: Mode;
  databaseUrl: string;
  artifactRoot: string;
  quotaBytes: number;
  maxPayloadBytes: number;
}> {
  const mode = argv[0];
  if (mode !== "plan" && mode !== "bootstrap" && mode !== "verify" && mode !== "recover") {
    throw new Error(
      "Usage: product-artifact-index.ts <plan|bootstrap|verify|recover> "
      + "[--database <postgres-url>] [--root <artifact-dir>] [--quota-bytes <n>] [--max-payload-bytes <n>]",
    );
  }
  const limits = resolveProductArtifactCapacity();
  return {
    mode,
    databaseUrl: optionalValue(argv, "--database") ?? runtimeConfig.setfarmPgUrl,
    artifactRoot: optionalValue(argv, "--root") ?? resolveProductArtifactDir(),
    quotaBytes: positiveInteger(
      optionalValue(argv, "--quota-bytes"),
      limits.rootQuotaBytes,
      "--quota-bytes",
    ),
    maxPayloadBytes: positiveInteger(
      optionalValue(argv, "--max-payload-bytes"),
      limits.maxPayloadBytes,
      "--max-payload-bytes",
    ),
  };
}

async function assertBootstrapIdle(sql: postgres.Sql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    active_runs: number;
    open_claims: number;
    active_attempts: number;
  }>>(
    `SELECT
       (SELECT COUNT(*)::integer FROM runs
         WHERE status IN ('running', 'resuming')) AS active_runs,
       (SELECT COUNT(*)::integer FROM claim_log
         WHERE outcome IS NULL) AS open_claims,
       (SELECT COUNT(*)::integer FROM execution_attempts
         WHERE disposition IN ('claimed', 'running')) AS active_attempts`,
  );
  const activity = rows[0];
  if (
    !activity
    || activity.active_runs !== 0
    || activity.open_claims !== 0
    || activity.active_attempts !== 0
  ) {
    throw new Error("ARTIFACT_BOOTSTRAP_ACTIVITY_CONFLICT");
  }
}

async function main(): Promise<void> {
  const input = parseArgs(process.argv.slice(2));
  const publicationAuthority = resolveArtifactStorePublicationAuthorityMode();
  const sql = postgres(input.databaseUrl, {
    max: 4,
    connect_timeout: 10,
    idle_timeout: 2,
    onnotice: () => {},
  });
  const store = createArtifactInventoryStoreV1({
    sql,
    artifactRoot: input.artifactRoot,
    artifactLimits: {
      maxPayloadBytes: input.maxPayloadBytes,
      rootQuotaBytes: input.quotaBytes,
      minFreeBytes: resolveProductArtifactCapacity().minFreeBytes,
    },
    purpose: input.mode === "bootstrap"
      ? "inventory-adoption"
      : "inventory-verify",
    publicationAuthorityMode: publicationAuthority,
  }).store;
  const index = createArtifactIndex(sql);
  try {
    if (input.mode === "plan") {
      const migrations = await planContractSpineMigrations(sql);
      let capacity: unknown = null;
      let verification: "verified" | "unavailable" = "unavailable";
      let artifacts: Awaited<ReturnType<typeof scanArtifactInventory>> = [];
      const tables = await sql.unsafe<Array<{ installed: boolean }>>(
        "SELECT to_regclass('public.artifact_capacity') IS NOT NULL AS installed",
      );
      if (tables[0]?.installed) {
        try {
          const verified = await verifyArtifactIndexInventory({ index, store });
          artifacts = verified.artifacts;
          capacity = verified.capacity;
          verification = "verified";
        } catch (error) {
          capacity = {
            state: (await index.getCapacity()).state,
            error: error instanceof Error && "code" in error
              ? String(error.code)
              : "ARTIFACT_INDEX_VERIFICATION_FAILED",
          };
        }
      } else if (publicationAuthority === "standalone") {
        artifacts = await scanArtifactInventory(store);
      }
      process.stdout.write(`${JSON.stringify({
        mode: "plan",
        migrations,
        inventory: {
          count: artifacts.length,
          bytes: artifacts.reduce((sum, artifact) => sum + artifact.byteLength, 0),
          hashes: artifacts.map((artifact) => artifact.hash),
        },
        verification,
        capacity,
      }, null, 2)}\n`);
      return;
    }

    await verifyContractSpineMigrations(sql);
    if (input.mode === "bootstrap") {
      await assertBootstrapIdle(sql);
      const bootstrapped = await bootstrapArtifactIndex({
        index,
        store,
        quotaBytes: input.quotaBytes,
        maxPayloadBytes: input.maxPayloadBytes,
      });
      process.stdout.write(`${JSON.stringify({
        mode: "bootstrap",
        artifactCount: bootstrapped.artifacts.length,
        capacity: bootstrapped.capacity,
      }, null, 2)}\n`);
      return;
    }
    if (input.mode === "recover") {
      const batches = await recoverExpiredArtifactPublicationBatches({ index, store });
      const afterBatches = await index.getCapacity();
      const reservationRecovery = afterBatches.state === "ready"
        ? "executed" as const
        : "skipped_capacity_not_ready" as const;
      const reservations = reservationRecovery === "executed"
        ? await recoverExpiredArtifactPublications({ index, store })
        : [];
      const observed = reservationRecovery === "executed"
        ? await index.getCapacity()
        : afterBatches;
      const capacity = observed.state === "ready"
        ? (await verifyArtifactIndexInventory({ index, store })).capacity
        : observed;
      process.stdout.write(`${JSON.stringify({
        mode: "recover",
        batches,
        reservations,
        reservationRecovery,
        capacity,
      }, null, 2)}\n`);
      return;
    }
    const verified = await verifyArtifactIndexInventory({ index, store });
    process.stdout.write(`${JSON.stringify({
      mode: "verify",
      artifactCount: verified.artifacts.length,
      capacity: verified.capacity,
    }, null, 2)}\n`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const code = error instanceof Error && "code" in error
    ? String(error.code)
    : "ARTIFACT_INDEX_OPERATION_FAILED";
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${code}: ${message.replace(/[\r\n\t]+/g, " ").slice(0, 1_000)}\n`);
  process.exitCode = 1;
});
