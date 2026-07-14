#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertContractSpineSemanticMigrationSourceIntegrity,
  computeContractSpineSemanticMigrationDigests,
  createContractSpineMigrationSourceReader,
  renderContractSpineSemanticMigrationDigests,
} from "../src/db/contract-spine-migration-source-integrity.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readSource = createContractSpineMigrationSourceReader(repoRoot);
const mode = process.argv[2] ?? "--check";

if (mode === "--print") {
  process.stdout.write(`${JSON.stringify(computeContractSpineSemanticMigrationDigests(readSource), null, 2)}\n`);
} else if (mode === "--write") {
  const digests = computeContractSpineSemanticMigrationDigests(readSource);
  writeFileSync(
    path.join(repoRoot, "src/db/contract-spine-migration-digests.generated.ts"),
    renderContractSpineSemanticMigrationDigests(digests),
    "utf8",
  );
  process.stdout.write("Updated contract-spine semantic migration digests.\n");
} else if (mode === "--check") {
  assertContractSpineSemanticMigrationSourceIntegrity(readSource);
  process.stdout.write("Contract-spine semantic migration digests are current.\n");
} else {
  throw new Error("Usage: check-contract-spine-migration-digests.ts [--check|--print|--write]");
}
