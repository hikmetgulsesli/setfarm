#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

import postgres from "postgres";

const DATABASE_PREFIX = "setfarm_contract_spine_test_";
const DATABASE_PATTERN = /^setfarm_contract_spine_test_[0-9]+_[a-f0-9]{12}$/;
const ADMIN_URL = process.env.SETFARM_TEST_PG_ADMIN_URL
  || "postgresql://postgres@localhost:5432/postgres";

function testDatabaseUrl(database: string): string {
  const target = new URL(ADMIN_URL);
  target.pathname = `/${database}`;
  return target.toString();
}

function commandArguments(): string[] {
  const separator = process.argv.indexOf("--");
  const command = separator >= 0 ? process.argv.slice(separator + 1) : [];
  if (command.length === 0) {
    throw new Error("Usage: run-isolated-postgres-tests.ts -- <command> [args...]");
  }
  return command;
}

async function runChild(command: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0]!, command.slice(1), {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SETFARM_PG_URL: process.env.SETFARM_PG_URL,
      },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`ISOLATED_TEST_COMMAND_SIGNAL:${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

async function main(): Promise<void> {
  const command = commandArguments();
  const database = `${DATABASE_PREFIX}${process.pid}_${randomBytes(6).toString("hex")}`;
  if (!DATABASE_PATTERN.test(database)) throw new Error("ISOLATED_TEST_DATABASE_NAME_INVALID");

  const adminUrl = new URL(ADMIN_URL);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), {
    max: 2,
    connect_timeout: 5,
    idle_timeout: 1,
    onnotice: () => {},
  });
  let created = false;
  try {
    await admin`SELECT 1`;
    await admin.unsafe(`CREATE DATABASE "${database}"`);
    created = true;
    const url = testDatabaseUrl(database);
    process.env.SETFARM_PG_URL = url;
    const db = await import(`../src/db-pg.ts?isolated-runner=${database}`);
    db.pgConfigureIsolatedTestDatabase(url);
    await db.pgMigrate({ contractSpineMode: "apply" });
    await db.pgClose();
    process.stderr.write(`[isolated-test-db] created and migrated ${database}\n`);

    const exitCode = await runChild(command);
    if (exitCode !== 0) process.exitCode = exitCode;
  } finally {
    if (created) {
      await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${database} AND pid <> pg_backend_pid()`;
      await admin.unsafe(`DROP DATABASE "${database}"`);
      process.stderr.write(`[isolated-test-db] dropped ${database}\n`);
    }
    await admin.end({ timeout: 5 });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
