import { constants as fsConstants } from "node:fs";
import { lstat, mkdir, open, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import {
  ConvergenceEvalResultV1Schema,
  ConvergenceEvalRunResultV1Schema,
  type ConvergenceEvalResultV1,
} from "./result-schema.js";
import {
  ConvergenceEvalResultV2Schema,
  ConvergenceEvalResultVersionedSchema,
  ConvergenceEvalRunResultV2Schema,
  type ConvergenceEvalResultV2,
  type ConvergenceEvalResultVersioned,
} from "./result-schema-v2.js";
import { ConvergenceReleaseGateV1Schema, type ConvergenceReleaseGateV1 } from "./release-gate.js";

const PersistableSchema = z.union([
  ConvergenceEvalRunResultV1Schema,
  ConvergenceEvalResultV1Schema,
  ConvergenceEvalRunResultV2Schema,
  ConvergenceEvalResultV2Schema,
  ConvergenceReleaseGateV1Schema,
]);
type Persistable = z.infer<typeof PersistableSchema>;

const MAX_EVAL_ARTIFACT_BYTES = 16 * 1024 * 1024;

export type StoredConvergenceArtifact = Readonly<{
  hash: string;
  locator: string;
  created: boolean;
}>;

async function requirePlainDirectory(directory: string): Promise<void> {
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("EVAL_RESULT_DIRECTORY_UNSAFE");
}

export class ContentAddressedEvalResultStore {
  private readonly root: string;

  constructor(root: string) {
    if (!String(root || "").trim()) throw new Error("EVAL_RESULT_ROOT_REQUIRED");
    this.root = path.resolve(root);
  }

  async prepare(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await requirePlainDirectory(this.root);
    await realpath(this.root);
  }

  async put(value: Persistable): Promise<StoredConvergenceArtifact> {
    const parsed = PersistableSchema.parse(value);
    const hash = Sha256Schema.parse(
      parsed.schema === "setfarm.product-convergence-release-gate.v1"
        ? parsed.gateHash
        : parsed.resultHash,
    );
    const bytes = `${JSON.stringify(parsed, null, 2)}\n`;
    await this.prepare();
    const shaRoot = path.join(this.root, "sha256");
    const bucket = path.join(shaRoot, hash.slice(0, 2));
    await mkdir(bucket, { recursive: true, mode: 0o700 });
    await requirePlainDirectory(shaRoot);
    await requirePlainDirectory(bucket);
    const target = path.join(bucket, `${hash}.json`);
    const locator = `sha256/${hash.slice(0, 2)}/${hash}.json`;
    try {
      await writeFile(target, bytes, { encoding: "utf8", flag: "wx", mode: 0o600 });
      return Object.freeze({ hash, locator, created: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error("EVAL_RESULT_ARTIFACT_UNSAFE");
      if (await readFile(target, "utf8") !== bytes) throw new Error("EVAL_RESULT_HASH_COLLISION");
      return Object.freeze({ hash, locator, created: false });
    }
  }

  async get(hashValue: string): Promise<Persistable> {
    const hash = Sha256Schema.parse(hashValue);
    await this.prepare();
    const shaRoot = path.join(this.root, "sha256");
    const bucket = path.join(shaRoot, hash.slice(0, 2));
    await requirePlainDirectory(shaRoot);
    await requirePlainDirectory(bucket);
    const target = path.join(bucket, `${hash}.json`);
    const handle = await open(target, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size <= 0 || info.size > MAX_EVAL_ARTIFACT_BYTES) {
        throw new Error("EVAL_RESULT_ARTIFACT_UNSAFE");
      }
      const parsed = PersistableSchema.parse(JSON.parse(await handle.readFile("utf8")));
      const actualHash = parsed.schema === "setfarm.product-convergence-release-gate.v1"
        ? parsed.gateHash
        : parsed.resultHash;
      if (actualHash !== hash) throw new Error("EVAL_RESULT_ARTIFACT_HASH_MISMATCH");
      return parsed;
    } finally {
      await handle.close();
    }
  }

  async getResult(hash: string): Promise<ConvergenceEvalResultV1> {
    return ConvergenceEvalResultV1Schema.parse(await this.get(hash));
  }

  async getResultV2(hash: string): Promise<ConvergenceEvalResultV2> {
    return ConvergenceEvalResultV2Schema.parse(await this.get(hash));
  }

  async getVersionedResult(hash: string): Promise<ConvergenceEvalResultVersioned> {
    return ConvergenceEvalResultVersionedSchema.parse(await this.get(hash));
  }

  async getReleaseGate(hash: string): Promise<ConvergenceReleaseGateV1> {
    return ConvergenceReleaseGateV1Schema.parse(await this.get(hash));
  }
}

export function stableConvergenceResultJson(value: ConvergenceEvalResultV1): string {
  return `${JSON.stringify(ConvergenceEvalResultV1Schema.parse(value), null, 2)}\n`;
}

export function stableConvergenceResultJsonV2(value: ConvergenceEvalResultV2): string {
  return `${JSON.stringify(ConvergenceEvalResultV2Schema.parse(value), null, 2)}\n`;
}

export function convergenceResultTable(value: ConvergenceEvalResultV1): string {
  const result = ConvergenceEvalResultV1Schema.parse(value);
  const rows = result.runs.map((run) => [
    run.caseId,
    String(run.repetition),
    run.productClass,
    run.disposition,
    run.passed ? "PASS" : "FAIL",
    run.rootCauseHash?.slice(0, 12) ?? "-",
  ]);
  const headings = ["CASE", "REP", "CLASS", "DISPOSITION", "RESULT", "ROOT_CAUSE"];
  const widths = headings.map((heading, index) => Math.max(
    heading.length,
    ...rows.map((row) => row[index]!.length),
  ));
  const format = (row: string[]) => row.map((cell, index) => cell.padEnd(widths[index]!)).join("  ").trimEnd();
  return [
    format(headings),
    format(widths.map((width) => "-".repeat(width))),
    ...rows.map(format),
    `${result.status.toUpperCase()} ${result.runs.filter((item) => item.passed).length}/${result.plannedRuns} HASH ${result.resultHash}`,
  ].join("\n") + "\n";
}

export function convergenceResultTableV2(value: ConvergenceEvalResultV2): string {
  const result = ConvergenceEvalResultV2Schema.parse(value);
  const rows = result.runs.map((run) => [
    run.caseId,
    String(run.repetition),
    run.productClass,
    run.disposition,
    run.passed ? "PASS" : "FAIL",
    run.rootCauseHash?.slice(0, 12) ?? "-",
  ]);
  const headings = ["CASE", "REP", "CLASS", "DISPOSITION", "RESULT", "ROOT_CAUSE"];
  const widths = headings.map((heading, index) => Math.max(
    heading.length,
    ...rows.map((row) => row[index]!.length),
  ));
  const format = (row: string[]) => row.map((cell, index) => cell.padEnd(widths[index]!)).join("  ").trimEnd();
  return [
    format(headings),
    format(widths.map((width) => "-".repeat(width))),
    ...rows.map(format),
    `${result.status.toUpperCase()} ${result.runs.filter((item) => item.passed).length}/${result.plannedRuns} HASH ${result.resultHash}`,
  ].join("\n") + "\n";
}
