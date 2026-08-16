#!/usr/bin/env node

import { spawn } from "node:child_process";

import { createIsolatedTestDatabase } from "../tests/execution-attempts/test-database.js";

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
  const database = await createIsolatedTestDatabase();
  try {
    process.stderr.write(`[isolated-test-db] created and migrated ${database.database}\n`);

    const exitCode = await runChild(command);
    if (exitCode !== 0) process.exitCode = exitCode;
  } finally {
    await database.cleanup();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
