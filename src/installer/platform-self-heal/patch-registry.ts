import fs from "node:fs";
import path from "node:path";

export interface PlatformPatchRegistryEntry {
  selfHealId: string;
  createdAt: string;
  category: string;
  targetFiles: string[];
  testsRun: string[];
  status: "planned" | "applied" | "reverted" | "blocked";
  artifactDir: string;
}

export function patchRegistryPath(root = process.cwd()): string {
  return path.join(root, ".setfarm", "platform-self-heal", "PATCH_REGISTRY.json");
}

export function readPatchRegistry(root = process.cwd()): PlatformPatchRegistryEntry[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(patchRegistryPath(root), "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendPatchRegistryEntry(entry: PlatformPatchRegistryEntry, root = process.cwd()): void {
  const file = patchRegistryPath(root);
  const entries = readPatchRegistry(root).filter((existing) => existing.selfHealId !== entry.selfHealId);
  entries.push(entry);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(entries, null, 2) + "\n", "utf-8");
}
