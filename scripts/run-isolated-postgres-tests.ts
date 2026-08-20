#!/usr/bin/env node

import { spawn } from "node:child_process";

import { createIsolatedTestDatabase } from "../tests/execution-attempts/test-database.js";

function commandArguments(): string[] {
  const separator = process.argv.indexOf("--");
  const command = separator >= 0 ? process.argv.slice(separator + 1) : [];
  if (
    command.length !== 6
    || command[0] !== "node"
    || command[1] !== "--import"
    || command[2] !== "tsx"
    || command[3] !== "--test"
    || command[4] !== "--test-concurrency=1"
    || !command[5]
    || command[5].startsWith("-")
  ) {
    throw new Error("ISOLATED_TEST_COMMAND_MUST_BE_ONE_NODE_TEST_FILE");
  }
  return command;
}

async function runChild(command: string[], databaseUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, command.slice(1), {
      cwd: process.cwd(),
      env: {
        PATH: "/usr/bin:/bin",
        LANG: "C",
        LC_ALL: "C",
        SETFARM_PG_URL: databaseUrl,
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
  if (process.env.SETFARM_PG_URL !== undefined) {
    throw new Error("ISOLATED_TEST_AMBIENT_PG_URL_FORBIDDEN");
  }
  if (!process.env.SETFARM_TEST_PG_ADMIN_URL) {
    throw new Error("ISOLATED_TEST_PG_ADMIN_URL_REQUIRED");
  }
  const command = commandArguments();
  const database = await createIsolatedTestDatabase();
  try {
    process.stderr.write(`[isolated-test-db] created and migrated ${database.database}\n`);

    const exitCode = await runChild(command, database.url);
    if (exitCode !== 0) process.exitCode = exitCode;
  } finally {
    await database.cleanup();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
