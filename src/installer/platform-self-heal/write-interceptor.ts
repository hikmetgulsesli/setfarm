import fs from "node:fs";
import path from "node:path";
import type { PatchPlan } from "./types.js";

function normalizeRel(file: string): string {
  return file.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function matchesAllowed(file: string, allowed: string): boolean {
  const normalizedFile = normalizeRel(file);
  const normalizedAllowed = normalizeRel(allowed);
  if (normalizedAllowed.endsWith("/**")) return normalizedFile.startsWith(normalizedAllowed.slice(0, -3));
  return normalizedFile === normalizedAllowed;
}

export function assertSelfHealWriteAllowed(plan: PatchPlan, file: string): void {
  const normalized = normalizeRel(file);
  if (normalized.includes("tests/platform-invariants/") || normalized.includes("tests/immutable/")) {
    throw new Error(`SELF_HEAL_WRITE_FORBIDDEN_IMMUTABLE: ${file}`);
  }
  if (!plan.targetFiles.some((allowed) => matchesAllowed(normalized, allowed))) {
    throw new Error(`SELF_HEAL_WRITE_OUTSIDE_TARGET_FILES: ${file}`);
  }
}

export function writeSelfHealFile(plan: PatchPlan, file: string, content: string): void {
  assertSelfHealWriteAllowed(plan, file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf-8");
}
