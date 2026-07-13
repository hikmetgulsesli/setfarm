#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import postgres from "postgres";

import {
  applyContractSpineMigrations,
  planContractSpineMigrations,
  verifyContractSpineMigrations,
} from "../src/db/contract-spine-migrations.js";
import { runtimeConfig } from "../src/runtime-config.js";

type Mode = "plan" | "apply" | "verify";

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

function parseArgs(argv: string[]): Readonly<{ mode: Mode; databaseUrl: string }> {
  const mode = argv[0];
  if (mode !== "plan" && mode !== "apply" && mode !== "verify") {
    throw new Error("Usage: contract-spine-migrate.ts <plan|apply|verify> [--database <postgres-url>]");
  }
  const databaseIndex = argv.indexOf("--database");
  if (databaseIndex >= 0 && !argv[databaseIndex + 1]) {
    throw new Error("--database requires a PostgreSQL URL");
  }
  return {
    mode,
    databaseUrl: databaseIndex >= 0
      ? argv[databaseIndex + 1]!
      : runtimeConfig.setfarmPgUrl,
  };
}

async function main(): Promise<void> {
  const { mode, databaseUrl } = parseArgs(process.argv.slice(2));
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
    const applied = await applyContractSpineMigrations(sql, {
      releaseSha: resolveReleaseSha(),
    });
    const verified = await verifyContractSpineMigrations(sql);
    process.stdout.write(`${JSON.stringify({ applied, verified }, null, 2)}\n`);
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
