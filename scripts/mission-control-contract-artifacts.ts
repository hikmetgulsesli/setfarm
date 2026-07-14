#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { canonicalJsonStringify } from "../src/product-compiler/canonical-json.js";
import { createMissionControlContractArtifacts } from "../src/contracts/mission-control-contract-artifacts.js";

const mode = process.argv[2];
if (mode !== "--write" && mode !== "--check") {
  throw new Error("MISSION_CONTROL_CONTRACT_ARTIFACT_MODE_REQUIRED");
}

const root = path.resolve(import.meta.dirname, "..");
const artifacts = createMissionControlContractArtifacts();

for (const artifact of artifacts) {
  const destination = path.join(root, artifact.relativePath);
  const expected = Buffer.from(`${canonicalJsonStringify(artifact.value)}\n`, "utf8");
  if (mode === "--write") {
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, expected);
    continue;
  }
  let actual: Buffer;
  try {
    actual = await readFile(destination);
  } catch {
    throw new Error(`MISSION_CONTROL_CONTRACT_ARTIFACT_MISSING:${artifact.relativePath}`);
  }
  if (!actual.equals(expected)) {
    throw new Error(`MISSION_CONTROL_CONTRACT_ARTIFACT_DRIFT:${artifact.relativePath}`);
  }
}

console.log(`Mission Control contract artifacts ${mode === "--write" ? "written" : "verified"}: ${artifacts.length}`);
