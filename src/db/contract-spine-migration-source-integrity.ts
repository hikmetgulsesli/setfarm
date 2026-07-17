import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS,
  type ContractSpineSemanticMigrationVersion,
} from "./contract-spine-migration-digests.generated.js";

type SourceRegion = Readonly<{
  file: string;
  region: string;
}>;

type SemanticMigrationSourceManifest = Readonly<{
  regions: readonly SourceRegion[];
  dependencyFiles: readonly string[];
}>;

export type ContractSpineSemanticMigrationDigestMap = Readonly<
  Record<ContractSpineSemanticMigrationVersion, string>
>;

export type ContractSpineMigrationSourceReader = (relativePath: string) => string;

const MIGRATION_SOURCE_FILE = "src/db/contract-spine-migrations.ts";

export const CONTRACT_SPINE_SEMANTIC_MIGRATION_SOURCE_MANIFEST = Object.freeze({
  8: Object.freeze({
    regions: Object.freeze([
      Object.freeze({ file: MIGRATION_SOURCE_FILE, region: "migration-error-contract" }),
      Object.freeze({ file: MIGRATION_SOURCE_FILE, region: "migration-v8-semantic-apply" }),
    ]),
    dependencyFiles: Object.freeze([
      "src/execution/schemas/process-identity-v1.ts",
      "src/execution/schemas/runtime-completion-plan-v1.ts",
      "src/product-compiler/canonical-json.ts",
    ]),
  }),
  11: Object.freeze({
    regions: Object.freeze([
      Object.freeze({ file: MIGRATION_SOURCE_FILE, region: "migration-v11-semantic-apply" }),
    ]),
    dependencyFiles: Object.freeze([
      "src/execution/schemas/execution-attempt-v1.ts",
      "src/product-compiler/canonical-json.ts",
      "src/product-compiler/schemas/common-v1.ts",
      "src/recovery/recovery-case.ts",
      "src/recovery/recovery-delivery.ts",
    ]),
  }),
  12: Object.freeze({
    regions: Object.freeze([
      Object.freeze({ file: MIGRATION_SOURCE_FILE, region: "migration-error-contract" }),
      Object.freeze({ file: MIGRATION_SOURCE_FILE, region: "migration-object-helper" }),
      Object.freeze({ file: MIGRATION_SOURCE_FILE, region: "migration-v12-semantic-apply" }),
    ]),
    dependencyFiles: Object.freeze([
      "src/execution/schemas/operational-event-v1.ts",
      "src/product-compiler/canonical-json.ts",
    ]),
  }),
  23: Object.freeze({
    regions: Object.freeze([
      Object.freeze({
        file: MIGRATION_SOURCE_FILE,
        region: "sql-definition-normalization-v1",
      }),
      Object.freeze({ file: MIGRATION_SOURCE_FILE, region: "migration-v23-batch-ledger" }),
      Object.freeze({
        file: MIGRATION_SOURCE_FILE,
        region: "migration-v23-shared-ownership",
      }),
      Object.freeze({ file: MIGRATION_SOURCE_FILE, region: "migration-v23-rollback" }),
      Object.freeze({ file: MIGRATION_SOURCE_FILE, region: "migration-v23-registration" }),
      Object.freeze({
        file: "src/product-compiler/artifact-publication-batch-identity.ts",
        region: "artifact-publication-batch-v1",
      }),
    ]),
    dependencyFiles: Object.freeze([
      "src/product-compiler/canonical-json.ts",
    ]),
  }),
  24: Object.freeze({
    regions: Object.freeze([
      Object.freeze({
        file: MIGRATION_SOURCE_FILE,
        region: "sql-definition-normalization-v1",
      }),
      Object.freeze({
        file: MIGRATION_SOURCE_FILE,
        region: "migration-v24-artifact-store-authority",
      }),
      Object.freeze({
        file: MIGRATION_SOURCE_FILE,
        region: "migration-journal-operational-authority-v1",
      }),
      Object.freeze({ file: MIGRATION_SOURCE_FILE, region: "migration-v24-registration" }),
      Object.freeze({ file: MIGRATION_SOURCE_FILE, region: "migration-v24-rollback" }),
    ]),
    dependencyFiles: Object.freeze([
      "src/product-compiler/canonical-json.ts",
    ]),
  }),
} satisfies Readonly<Record<ContractSpineSemanticMigrationVersion, SemanticMigrationSourceManifest>>);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedSource(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function marker(region: string, edge: "BEGIN" | "END"): string {
  return `// SETFARM_SEMANTIC_MIGRATION_REGION:${region}:${edge}`;
}

function countOccurrences(source: string, value: string): number {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = source.indexOf(value, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + value.length;
  }
}

export function extractContractSpineSemanticMigrationRegion(
  source: string,
  relativePath: string,
  region: string,
): string {
  const normalized = normalizedSource(source);
  const begin = marker(region, "BEGIN");
  const end = marker(region, "END");
  if (countOccurrences(normalized, begin) !== 1 || countOccurrences(normalized, end) !== 1) {
    throw new Error(
      `CONTRACT_SPINE_MIGRATION_REGION_MARKER_INVALID:${relativePath}:${region}`,
    );
  }
  const start = normalized.indexOf(begin) + begin.length;
  const finish = normalized.indexOf(end, start);
  if (finish < start) {
    throw new Error(
      `CONTRACT_SPINE_MIGRATION_REGION_ORDER_INVALID:${relativePath}:${region}`,
    );
  }
  const body = normalized.slice(start, finish).replace(/^\n/, "").replace(/\s+$/, "");
  if (!body.trim()) {
    throw new Error(
      `CONTRACT_SPINE_MIGRATION_REGION_EMPTY:${relativePath}:${region}`,
    );
  }
  return `${body}\n`;
}

export function createContractSpineMigrationSourceReader(
  repoRoot: string,
): ContractSpineMigrationSourceReader {
  return (relativePath) => readFileSync(path.join(repoRoot, relativePath), "utf8");
}

export function computeContractSpineSemanticMigrationDigests(
  readSource: ContractSpineMigrationSourceReader,
): ContractSpineSemanticMigrationDigestMap {
  const computed = {} as Record<ContractSpineSemanticMigrationVersion, string>;
  for (const version of [8, 11, 12, 23, 24] as const) {
    const manifest = CONTRACT_SPINE_SEMANTIC_MIGRATION_SOURCE_MANIFEST[version];
    const regions = manifest.regions.map((item) => ({
      file: item.file,
      region: item.region,
      digest: sha256(extractContractSpineSemanticMigrationRegion(
        readSource(item.file),
        item.file,
        item.region,
      )),
    }));
    const dependencies = [...manifest.dependencyFiles]
      .sort()
      .map((file) => ({ file, digest: sha256(normalizedSource(readSource(file))) }));
    computed[version] = sha256(JSON.stringify({
      schema: "setfarm.semantic-migration-source-manifest.v1",
      version,
      regions,
      dependencies,
    }));
  }
  return Object.freeze(computed);
}

export function assertContractSpineSemanticMigrationSourceIntegrity(
  readSource: ContractSpineMigrationSourceReader,
): ContractSpineSemanticMigrationDigestMap {
  const actual = computeContractSpineSemanticMigrationDigests(readSource);
  for (const version of [8, 11, 12, 23, 24] as const) {
    const expected = CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[version];
    if (actual[version] !== expected) {
      throw new Error(
        `CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGEST_STALE:v${version}:expected=${expected}:actual=${actual[version]}`,
      );
    }
  }
  return actual;
}

export function assertContractSpineSemanticMigrationSourceIntegrityWhenAvailable(): void {
  const modulePath = fileURLToPath(import.meta.url);
  if (!modulePath.endsWith(".ts")) return;
  const repoRoot = path.resolve(path.dirname(modulePath), "../..");
  assertContractSpineSemanticMigrationSourceIntegrity(
    createContractSpineMigrationSourceReader(repoRoot),
  );
}

export function renderContractSpineSemanticMigrationDigests(
  digests: ContractSpineSemanticMigrationDigestMap,
): string {
  return [
    "// Generated by scripts/check-contract-spine-migration-digests.ts --write.",
    "// Do not hand-edit. Source-mode migration commands and prebuild verify these",
    "// values against exact semantic regions and declared helper dependency files.",
    "export const CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS = Object.freeze({",
    `  8: \"${digests[8]}\",`,
    `  11: \"${digests[11]}\",`,
    `  12: \"${digests[12]}\",`,
    `  23: \"${digests[23]}\",`,
    `  24: \"${digests[24]}\",`,
    "} as const);",
    "",
    "export type ContractSpineSemanticMigrationVersion =",
    "  keyof typeof CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS;",
    "",
  ].join("\n");
}
