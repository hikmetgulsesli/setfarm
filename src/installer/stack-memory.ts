import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StackPackId } from "./stack-contract/types.js";

export interface StackMemoryInput {
  repoRoot?: string;
  stackPackId?: string;
  failureCategory?: string;
  runNotes?: string;
  maxChars?: number;
}

export interface StackMemoryResult {
  text: string;
  files: string[];
}

const DEFAULT_MAX_CHARS = 9000;

const STACK_MEMORY_FILES: Partial<Record<StackPackId, string>> = {
  "static-html-site": "static-html-site.md",
  "vite-react-web-app": "vite-react-web-app.md",
  "nextjs-web-app": "nextjs-web-app.md",
  "browser-game-canvas": "browser-game-canvas.md",
  "node-express-api": "node-express-api.md",
  "node-cli": "node-cli.md",
  "python-cli": "python-cli.md",
  "python-web": "python-web.md",
  "react-native-expo": "react-native-expo.md",
  "ios-app": "ios-app.md",
  "android-app": "android-app.md",
  "desktop-electron": "desktop-electron.md",
};

const FAILURE_MEMORY_FILES: Record<string, string> = {
  XSS_INNER_HTML: "xss-inner-html.md",
  xss_inner_html: "xss-inner-html.md",
  semantic_action_id_equivalence: "semantic-action-id-equivalence.md",
  APP_INTEGRATION_SEMANTIC_REGRESSION: "semantic-action-id-equivalence.md",
  GENERATED_ICON_FALLBACK: "missing-icon-asset.md",
  UNKNOWN_MATERIAL_ICONS: "missing-icon-asset.md",
  DESIGN_ICON_FALLBACK_WARNING: "missing-icon-asset.md",
  missing_icon_asset: "missing-icon-asset.md",
  POST_MERGE_QUALITY_REGRESSION: "post-merge-quality-regression.md",
  post_merge_quality_regression: "post-merge-quality-regression.md",
  SCOPE_WRITE_VIOLATION: "scope-write-violation.md",
  scope_write_violation: "scope-write-violation.md",
};

export function buildStackMemory(input: StackMemoryInput = {}): StackMemoryResult {
  const root = input.repoRoot || findSetfarmRoot();
  const memoryRoot = path.join(root, "memory");
  const files: string[] = [];
  const sections: string[] = [];

  const globalPath = path.join(memoryRoot, "global.md");
  const globalMemory = readMemoryFile(globalPath);
  if (globalMemory) {
    files.push(path.relative(root, globalPath));
    sections.push(["## Global Memory", globalMemory].join("\n"));
  }

  const packId = normalizeStackPackId(input.stackPackId);
  const stackFile = packId ? STACK_MEMORY_FILES[packId] : undefined;
  if (stackFile) {
    const stackPath = path.join(memoryRoot, "stacks", stackFile);
    const stackMemory = readMemoryFile(stackPath);
    if (stackMemory) {
      files.push(path.relative(root, stackPath));
      sections.push([`## Stack Memory: ${packId}`, stackMemory].join("\n"));
    }
  }

  const failureFile = failureMemoryFile(input.failureCategory || "");
  if (failureFile) {
    const failurePath = path.join(memoryRoot, "failures", failureFile);
    const failureMemory = readMemoryFile(failurePath);
    if (failureMemory) {
      files.push(path.relative(root, failurePath));
      sections.push([`## Failure Memory: ${normalizeFailureCategory(input.failureCategory || "")}`, failureMemory].join("\n"));
    }
  }

  const runNotes = cleanRunNotes(input.runNotes || "");
  if (runNotes) {
    sections.push(["## Run Memory", truncate(runNotes, 2200)].join("\n"));
  }

  const body = sections.join("\n\n").trim();
  if (!body) return { text: "(no stack memory resolved)", files };
  return {
    text: truncate(["# Setfarm Memory", body].join("\n\n"), input.maxChars || DEFAULT_MAX_CHARS),
    files,
  };
}

function normalizeStackPackId(value: string | undefined): StackPackId | "" {
  const raw = String(value || "").trim();
  if (!raw || raw === "unknown" || raw === "needs-reconcile") return "";
  return raw as StackPackId;
}

function normalizeFailureCategory(value: string): string {
  return String(value || "").trim() || "unknown";
}

function failureMemoryFile(category: string): string {
  const raw = normalizeFailureCategory(category);
  if (FAILURE_MEMORY_FILES[raw]) return FAILURE_MEMORY_FILES[raw];
  const compact = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return FAILURE_MEMORY_FILES[compact] || "";
}

function readMemoryFile(filePath: string): string {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return "";
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return "";
  }
}

function cleanRunNotes(value: string): string {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return !/^\((?:no supervisor memory yet|no project memory yet|no supervisor state|no supervisor interventions|no supervisor visual qa report|no supervisor checklist|no supervisor run metadata)\)$/i.test(trimmed);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 80)).trimEnd()}\n\n[stack memory truncated: ${value.length - maxChars} chars omitted]`;
}

function findSetfarmRoot(): string {
  let current = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(current, "package.json")) && fs.existsSync(path.join(current, "src", "installer"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  const fromModule = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  if (fs.existsSync(path.join(fromModule, "package.json"))) return fromModule;
  return process.cwd();
}
