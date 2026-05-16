import path from "node:path";
import { readStackContract } from "../stack-contract/ledger.js";
import type { StackContract, StackPackId } from "../stack-contract/types.js";
import { writeLibraryPackSelection } from "./ledger.js";
import { selectLibraryPacks } from "./select.js";
import type { LibraryPackSelection } from "./types.js";

export interface LibraryPackContextOptions {
  repoPath?: string;
  taskText?: string;
  designText?: string;
  stackContract?: StackContract | null;
  persist?: boolean;
}

export function applyLibraryPackContext(
  context: Record<string, string>,
  options: LibraryPackContextOptions = {},
): LibraryPackSelection {
  const repoPath = normalizeRepoPath(options.repoPath || context["story_workdir"] || context["repo"] || context["REPO"] || "");
  const stackContract = options.stackContract
    || (repoPath ? readStackContract(repoPath) : null)
    || stackContractFromContext(context);
  const selection = selectLibraryPacks({
    stackContract,
    taskText: options.taskText || context["prd"] || context["task"] || context["TASK"] || "",
    designText: options.designText || buildDesignText(context),
  });

  if (options.persist !== false && repoPath) {
    writeLibraryPackSelection(repoPath, selection);
  }

  context["library_pack_ids"] = selection.selected.map((pack) => pack.id).join(", ");
  context["library_packs"] = formatLibraryPackSelection(selection);
  context["library_prompt"] = formatLibraryPackPrompt(selection);

  return selection;
}

export function formatLibraryPackSelection(selection: LibraryPackSelection): string {
  const selected = selection.selected.length > 0
    ? selection.selected.map((pack) => {
      const evidence = pack.evidence.slice(0, 5).map((item) => `${item.type}:${item.value}`).join(", ");
      return `- ${pack.id}: ${pack.label}${evidence ? ` (${evidence})` : ""}`;
    }).join("\n")
    : "- none";
  return [
    `Schema: ${selection.schema}`,
    `Status: ${selection.status}`,
    `Stack: ${selection.stackPackId || "unknown"}`,
    `Authority: ${selection.authority}`,
    "Selected:",
    selected,
  ].join("\n");
}

export function formatLibraryPackPrompt(selection: LibraryPackSelection): string {
  if (selection.selected.length === 0) {
    return "No library packs are selected. Use stack-native implementation and do not add UI, motion, chart, or canvas libraries unless the stack/design contract is reconciled first.";
  }
  return selection.selected.map((pack) => pack.prompt).join("\n\n");
}

function stackContractFromContext(context: Record<string, string>): StackContract | null {
  const packId = context["stack_pack_id"] || context["detected_stack"];
  if (!isStackPackId(packId)) return null;
  return {
    schema: "setfarm.stack-contract.v1",
    status: "resolved",
    packId,
    confidence: "low",
    reason: "Derived from current pipeline context.",
    taskHints: [],
    evidence: [],
    setup: {},
    fileContract: { entrypoints: [], routes: [], assets: [], generated: [], notes: [] },
    routeContract: { router: "unknown", routeFiles: [], requiredRoutes: [] },
    verification: { build: [], smoke: [], dom: [], visual: [], tests: [] },
    prompt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildDesignText(context: Record<string, string>): string {
  return [
    context["design_rules"],
    context["design_tokens"],
    context["design_system"],
    context["story_screens"],
    context["ui_behavior_contract"],
    context["screen_map"],
  ].filter(Boolean).join("\n");
}

function isStackPackId(value: string | undefined): value is StackPackId {
  return Boolean(value && [
    "nextjs-web-app",
    "vite-react-web-app",
    "static-html-site",
    "browser-game-canvas",
    "python-cli",
    "python-web",
    "android-app",
    "ios-app",
  ].includes(value));
}

function normalizeRepoPath(value: string): string {
  if (!value) return "";
  return path.resolve(value.replace(/^~/, process.env.HOME || "~"));
}
