#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import postgres from "postgres";

import {
  applyContractSpineMigrations,
  auditCurrentArtifactPublicationAuthorityLedgerData,
  planContractSpineMigrations,
  readContractSpineMigrationAttestation,
  rollbackProductCompilationAttemptLedgerToV21,
  rollbackOperationalFailureCauseSealToV20,
  rollbackArtifactPublicationBatchLedgerToV22,
  rollbackArtifactPublicationBatchPlanLedgerToV25,
  rollbackArtifactStoreAuthorityLedgerToV23,
  rollbackPreparationAuthorityV2LedgerToV24,
  rollbackRecoveryTerminalLeaseIdentityToV19,
  verifyContractSpineMigrations,
} from "../src/db/contract-spine-migrations.js";
import { runtimeConfig } from "../src/runtime-config.js";

type Mode =
  | "plan"
  | "apply"
  | "verify"
  | "audit-artifact-publication-batches"
  | "audit-artifact-store-authority-ledger"
  | "rollback-26-to-25"
  | "rollback-25-to-24"
  | "rollback-24-to-23"
  | "rollback-23-to-22"
  | "rollback-22-to-21"
  | "rollback-21-to-20"
  | "rollback-20-to-19";

function resolveReleaseSha(env: NodeJS.ProcessEnv = process.env): string {
  const configured = String(env.SETFARM_RELEASE_SHA || "").trim().toLowerCase();
  if (configured) {
    if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(configured)) {
      throw new Error("SETFARM_RELEASE_SHA must be a full Git object hash");
    }
    return configured;
  }
  const status = execFileSync("git", ["status", "--porcelain"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5_000,
  }).trim();
  if (status) {
    throw new Error("Migration apply requires a clean release worktree");
  }
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5_000,
  }).trim().toLowerCase();
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(sha)) {
    throw new Error("Cannot resolve migration release SHA from Git");
  }
  return sha;
}

function parseArgs(argv: string[]): Readonly<{
  mode: Mode;
  databaseUrl: string;
  targetReleaseSha?: string;
}> {
  const mode = argv[0];
  if (!["plan", "apply", "verify", "audit-artifact-publication-batches", "audit-artifact-store-authority-ledger", "rollback-26-to-25", "rollback-25-to-24", "rollback-24-to-23", "rollback-23-to-22", "rollback-22-to-21", "rollback-21-to-20", "rollback-20-to-19"].includes(mode ?? "")) {
    throw new Error("Usage: contract-spine-migrate.ts <plan|apply|verify|audit-artifact-publication-batches|audit-artifact-store-authority-ledger|rollback-26-to-25|rollback-25-to-24|rollback-24-to-23|rollback-23-to-22|rollback-22-to-21|rollback-21-to-20|rollback-20-to-19> [--database <postgres-url>] [--target-release <git-sha>]");
  }
  const databaseIndex = argv.indexOf("--database");
  if (databaseIndex >= 0 && !argv[databaseIndex + 1]) {
    throw new Error("--database requires a PostgreSQL URL");
  }
  const targetReleaseIndex = argv.indexOf("--target-release");
  if (targetReleaseIndex >= 0 && !argv[targetReleaseIndex + 1]) {
    throw new Error("--target-release requires a Git SHA");
  }
  const targetReleaseSha = targetReleaseIndex >= 0 ? argv[targetReleaseIndex + 1] : undefined;
  if (mode.startsWith("rollback-") && !targetReleaseSha) {
    throw new Error(`${mode} requires --target-release <git-sha>`);
  }
  return {
    mode: mode as Mode,
    databaseUrl: databaseIndex >= 0
      ? argv[databaseIndex + 1]!
      : runtimeConfig.setfarmPgUrl,
    ...(targetReleaseSha ? { targetReleaseSha } : {}),
  };
}

async function main(): Promise<void> {
  const { mode, databaseUrl, targetReleaseSha } = parseArgs(process.argv.slice(2));
  const sql = postgres(databaseUrl, {
    max: 4,
    connect_timeout: 10,
    idle_timeout: 2,
    onnotice: () => {},
  });
  try {
    if (mode === "plan") {
      process.stdout.write(`${JSON.stringify(await planContractSpineMigrations(sql), null, 2)}\n`);
      return;
    }
    if (mode === "verify") {
      process.stdout.write(`${JSON.stringify(await verifyContractSpineMigrations(sql), null, 2)}\n`);
      return;
    }
    if (mode === "audit-artifact-publication-batches") {
      process.stdout.write(`${JSON.stringify(
        await auditCurrentArtifactPublicationAuthorityLedgerData(sql),
        null,
        2,
      )}\n`);
      return;
    }
    if (mode === "rollback-26-to-25") {
      process.stdout.write(`${JSON.stringify(
        await rollbackArtifactPublicationBatchPlanLedgerToV25(sql, {
          targetReleaseSha: targetReleaseSha!,
        }),
        null,
        2,
      )}\n`);
      return;
    }
    if (mode === "audit-artifact-store-authority-ledger") {
      process.stdout.write(`${JSON.stringify(
        await auditCurrentArtifactPublicationAuthorityLedgerData(sql),
        null,
        2,
      )}\n`);
      return;
    }
    if (mode === "rollback-25-to-24") {
      process.stdout.write(`${JSON.stringify(
        await rollbackPreparationAuthorityV2LedgerToV24(sql, {
          targetReleaseSha: targetReleaseSha!,
        }),
        null,
        2,
      )}\n`);
      return;
    }
    if (mode === "rollback-24-to-23") {
      process.stdout.write(`${JSON.stringify(
        await rollbackArtifactStoreAuthorityLedgerToV23(sql, {
          targetReleaseSha: targetReleaseSha!,
        }),
        null,
        2,
      )}\n`);
      return;
    }
    if (mode === "rollback-23-to-22") {
      process.stdout.write(`${JSON.stringify(
        await rollbackArtifactPublicationBatchLedgerToV22(sql, {
          targetReleaseSha: targetReleaseSha!,
        }),
        null,
        2,
      )}\n`);
      return;
    }
    if (mode === "rollback-20-to-19") {
      process.stdout.write(`${JSON.stringify(
        await rollbackRecoveryTerminalLeaseIdentityToV19(sql, {
          targetReleaseSha: targetReleaseSha!,
        }),
        null,
        2,
      )}\n`);
      return;
    }
    if (mode === "rollback-22-to-21") {
      process.stdout.write(`${JSON.stringify(
        await rollbackProductCompilationAttemptLedgerToV21(sql, {
          targetReleaseSha: targetReleaseSha!,
        }),
        null,
        2,
      )}\n`);
      return;
    }
    if (mode === "rollback-21-to-20") {
      process.stdout.write(`${JSON.stringify(
        await rollbackOperationalFailureCauseSealToV20(sql, {
          targetReleaseSha: targetReleaseSha!,
        }),
        null,
        2,
      )}\n`);
      return;
    }
    const applied = await applyContractSpineMigrations(sql, {
      releaseSha: resolveReleaseSha(),
    });
    const verified = await verifyContractSpineMigrations(sql);
    const attestation = await readContractSpineMigrationAttestation(sql);
    process.stdout.write(`${JSON.stringify({ applied, verified, attestation }, null, 2)}\n`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const code = error instanceof Error && "code" in error ? String(error.code) : "MIGRATION_FAILED";
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${code}: ${message.replace(/[\r\n\t]+/g, " ").slice(0, 1_000)}\n`);
  process.exitCode = 1;
});
