import fs from "node:fs";
import path from "node:path";
import { readStackContract } from "./ledger.js";
import { parseStackPrefix } from "./prefix.js";
import type { StackPackId } from "./types.js";

const WEB_PREFIXES = new Set(["web", "frontend", "spa", "react", "reactjs", "react-spa", "vite", "vite-react", "dashboard"]);

export function stackPackFromContext(context: Record<string, unknown> | undefined | null): StackPackId | "" {
  if (!context) return "";
  const value = String(context["stack_pack_id"] || context["detected_stack"] || context["setup_stack_pack_id"] || "").trim();
  return value as StackPackId | "";
}

export function explicitWebStackPrefix(value: string | undefined | null): boolean {
  const prefix = parseStackPrefix(value)?.prefix;
  return Boolean(prefix && WEB_PREFIXES.has(prefix));
}

export function stackPackFromRepo(repoPath: string | undefined | null): StackPackId | "" {
  const repo = String(repoPath || "").trim();
  if (!repo || !fs.existsSync(repo)) return "";
  const contract = readStackContract(repo);
  if (contract?.packId) return contract.packId;
  try {
    const raw = fs.readFileSync(path.join(repo, ".setfarm", "ledger", "stack-contract.json"), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = String(parsed["packId"] || parsed["stack_pack_id"] || parsed["detected_stack"] || parsed["setup_stack_pack_id"] || "").trim();
    if (value) return value as StackPackId;
  } catch {}
  try {
    const raw = fs.readFileSync(path.join(repo, ".setfarm", "RUN_CONTRACT.json"), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return stackPackFromContext(parsed);
  } catch {
    return "";
  }
}

export function isBrowserGameStackPack(packId: string | undefined | null): boolean {
  return String(packId || "").trim() === "browser-game-canvas";
}
