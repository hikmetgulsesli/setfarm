import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { resolveSetfarmCli } from "./installer/paths.js";
import { classifyError } from "./installer/error-taxonomy.js";

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function buildClaimBootstrapScript(claimFile: string, outputFile: string): string {
  return buildResolvedClaimBootstrapScript({
    claimFile,
    outputFile,
    claimSummaryFile: "",
    stepId: "",
    workdir: defaultAgentScratch,
    taskPreview: "",
  });
}

export function claimTaskPreview(input: unknown): string {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const record = input as Record<string, unknown>;
    return String(record["task"] || record["current_story_title"] || record["story_title"] || "").slice(0, 1200);
  }
  return String(input || "").slice(0, 1200);
}

function extractTaskBrief(input: string, rawInput: unknown): string {
  const lines = String(input || "").split(/\r?\n/);
  const commandLabel = /^(?:REPO|MAIN_REPO|BRANCH|RUN_BRANCH|STORY_BRANCH|WORKDIR|BUILD_CMD|TEST_CMD|LINT_CMD|SUPERVISOR_SCOPE|CURRENT_STORY|PREVIOUS FAILURE)\s*:/i;

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^\s*TASK\s*:\s*(.*)$/i);
    if (!match) continue;

    const sameLine = (match[1] || "").trim();
    if (sameLine && !sameLine.startsWith("#") && !commandLabel.test(sameLine)) return sameLine.slice(0, 700);

    for (let j = i + 1; j < Math.min(lines.length, i + 20); j += 1) {
      const candidate = lines[j].trim();
      if (!candidate || candidate.startsWith("#")) continue;
      if (commandLabel.test(candidate)) break;
      if (/^(?:you are|treat this|after story|do not|use supervisor_memory_append)\b/i.test(candidate)) continue;
      return candidate.slice(0, 700);
    }
  }

  return claimTaskPreview(rawInput).split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("#"))?.slice(0, 700) || "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineValue(input: string, label: string): string {
  const match = input.match(new RegExp("^[ \\t]*" + escapeRegExp(label) + ":[ \\t]*(.*)$", "m"));
  return (match?.[1] || "").trim();
}

function isPlaceholderValue(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed ||
    /^\[[^\]]+\]$/.test(trimmed) ||
    /^<[^>]+>$/.test(trimmed) ||
    /\b(?:your-|placeholder|missing)\b/i.test(trimmed);
}

function firstMeaningfulLineValue(input: string, label: string): string {
  const re = new RegExp("^[ \\t]*" + escapeRegExp(label) + ":[ \\t]*(.*)$", "gm");
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    const value = (match[1] || "").trim();
    if (!isPlaceholderValue(value)) return value;
  }
  return "";
}

function extractBacktickedValue(input: string, pattern: RegExp): string {
  const match = pattern.exec(input);
  const value = (match?.[1] || "").trim();
  return isPlaceholderValue(value) ? "" : value;
}

function existingDirectory(value: string): string {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() ? candidate : "";
  } catch {
    return "";
  }
}

function deriveStoryBranch(input: string, runId: string, storyId?: string): string {
  const explicit = firstMeaningfulLineValue(input, "STORY_BRANCH");
  if (explicit) return explicit.toLowerCase();

  const fromBranchInstruction = extractBacktickedValue(
    input,
    /Branch:\s*This story uses exactly\s*`([^`]+)`/i,
  );
  if (fromBranchInstruction) return fromBranchInstruction.toLowerCase();

  const fromPushInstruction = extractBacktickedValue(
    input,
    /Setfarm commits[\s\S]{0,180}pushes\s*`([^`]+)`/i,
  );
  if (fromPushInstruction) return fromPushInstruction.toLowerCase();

  const normalizedStoryId = String(storyId || "").trim().toLowerCase();
  const runPrefix = String(runId || "").trim().slice(0, 8).toLowerCase();
  return runPrefix && normalizedStoryId ? `${runPrefix}-${normalizedStoryId}` : "";
}

function discoverStoryWorktreeByBranch(wfId: string, branch: string): string {
  const normalizedBranch = String(branch || "").trim().toLowerCase();
  if (!normalizedBranch || normalizedBranch.includes(path.sep) || normalizedBranch.includes("..")) return "";
  const agentsRoot = path.join(os.homedir(), ".openclaw", "workspaces", "workflows", wfId, "agents");
  try {
    for (const agentDir of fs.readdirSync(agentsRoot, { withFileTypes: true })) {
      if (!agentDir.isDirectory()) continue;
      const candidate = path.join(agentsRoot, agentDir.name, "story-worktrees", normalizedBranch);
      const existing = existingDirectory(candidate);
      if (existing) return existing;
    }
  } catch {
    // Workflow worktree roots are optional; fall back to explicit handoff paths.
  }
  return "";
}

function deriveStoryWorkdir(input: string, fallbackWorkdir: string, wfId: string, storyBranch: string): string {
  const explicit = firstMeaningfulLineValue(input, "STORY_WORKDIR")
    || firstMeaningfulLineValue(input, "story_workdir")
    || firstMeaningfulLineValue(input, "VERIFY_WORKDIR")
    || firstMeaningfulLineValue(input, "verify_workdir");
  if (explicit) return existingDirectory(explicit);

  const prepared = extractBacktickedValue(input, /prepared story worktree:\s*`?([^`\n]+)`?/i);
  if (prepared) return existingDirectory(prepared);

  const mentioned = extractBacktickedValue(input, /`?([^\s"'<>`]+\/story-worktrees\/[A-Za-z0-9._-]+)`?/);
  if (mentioned) return existingDirectory(mentioned);

  const discovered = discoverStoryWorktreeByBranch(wfId, storyBranch);
  if (discovered) return discovered;

  return String(fallbackWorkdir || "").includes(`${path.sep}story-worktrees${path.sep}`)
    ? existingDirectory(fallbackWorkdir)
    : "";
}

function retryFeedbackMode(role: string): "fix" | "audit" {
  return role === "developer" ? "fix" : "audit";
}

function retryFeedbackInstruction(mode: "fix" | "audit"): string {
  return mode === "fix"
    ? "Previous feedback is an open implementation blocker. Fix it first in scoped source before unrelated analysis or broad checks."
    : "Previous feedback is prior review context, not proof of a current failure. First verify whether it is already resolved with bounded evidence; if still present, report a concise retry/finding or make a scoped fix only when the role prompt explicitly owns edits.";
}

function packageScriptCommand(workdirs: string[], script: string): string {
  const candidates = [...new Set(workdirs.map(existingDirectory).filter(Boolean))];
  for (const workdir of candidates) {
    const command = packageScriptCommandInDirectory(workdir, script);
    if (command) return command;
  }
  return "";
}

function packageScriptCommandInDirectory(workdir: string, script: string): string {
  try {
    const packageJsonPath = path.join(workdir, "package.json");
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const scripts = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>)["scripts"] : undefined;
    if (!scripts || typeof scripts !== "object") return "";
    const scriptMap = scripts as Record<string, unknown>;
    if (script === "test" && typeof scriptMap["test:run"] === "string") {
      return "npm run test:run";
    }
    const value = scriptMap[script];
    if (typeof value === "string") {
      if (script === "test" && /\bvitest\b/i.test(value) && !/\brun\b/i.test(value)) {
        return "npx vitest run";
      }
      return `npm run ${script}`;
    }
  } catch {
    // Missing package metadata is fine for non-Node projects.
  }
  return "";
}

function isNoopCommand(value: string): boolean {
  return /^(?:true|:|noop|none|n\/a)$/i.test(value.trim());
}

function resolvedCommand(input: string, label: string, workdirs: string[], script: string, fallback: string): string {
  const fromInput = lineValue(input, label);
  if (fromInput && !isNoopCommand(fromInput)) return fromInput;
  return packageScriptCommand(workdirs, script) || fromInput || fallback;
}

function sliceSection(input: string, start: RegExp, ends: RegExp[], limit: number): string {
  const match = start.exec(input);
  if (!match || match.index === undefined) return "";
  const startIndex = match.index + match[0].length;
  let endIndex = input.length;
  const rest = input.slice(startIndex);
  for (const end of ends) {
    const endMatch = end.exec(rest);
    if (endMatch && endMatch.index !== undefined) endIndex = Math.min(endIndex, startIndex + endMatch.index);
  }
  return input.slice(startIndex, endIndex).trim().slice(0, limit);
}

function cleanPreviousFailureSection(raw: string): string {
  let value = String(raw || "").trim();
  const claimHandoff = value.search(/^\s*##\s*Claim Handoff\b/im);
  if (claimHandoff >= 0) value = value.slice(0, claimHandoff).trim();
  value = value
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:Failure category|Suggested response):\s*$/i.test(line))
    .join("\n")
    .trim();
  if (!value || /^##\s*Claim Handoff\b/im.test(value)) return "";
  return value;
}

function splitCsvList(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitScopeFileList(raw: string): string[] {
  return [...new Set(raw
    .split(/[\n,]+/)
    .map((item) => item.trim().replace(/^[-*]\s*/, "").replace(/^`|`$/g, ""))
    .map((item) => item.replace(/^["']|["']$/g, ""))
    .filter((item) => item.length > 0)
    .filter((item) => !path.isAbsolute(item) && !item.includes(".."))
    .filter((item) => /^[A-Za-z0-9_./@+-]+$/.test(item))
    .filter((item) => /[./]/.test(item))
  )];
}

function readLinesFile(filePath: string): string[] {
  try {
    return fs.readFileSync(filePath, "utf-8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parseJsonArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readJsonArrayFile(filePath: string): unknown[] {
  try {
    return parseJsonArray(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

function extractScopeFiles(input: string, workdir: string): string[] {
  const fromScopeFile = readLinesFile(path.join(workdir, ".story-scope-files"));
  if (fromScopeFile.length > 0) return fromScopeFile;

  const scopeRule = lineValue(input, "SCOPE ENFORCEMENT") || lineValue(input, "STORY SCOPE RULE");
  const bracket = scopeRule.match(/ONLY write files in \[([^\]]+)\]/i);
  if (bracket?.[1]) return splitScopeFileList(bracket[1]);

  const declaredFiles = sliceSection(input, /^\s*## YOUR FILES[^\n]*\n/m, [/^\s*SCOPE ENFORCEMENT:/m, /^\s*## /m], 3000);
  if (declaredFiles) return splitScopeFileList(declaredFiles);

  return splitScopeFileList(lineValue(input, "story_scope_files") || lineValue(input, "SCOPE_FILES"));
}

function isGeneratedScreenFile(filePath: string): boolean {
  return /^src\/screens\/[^/]+\.tsx$/.test(filePath);
}

function readGeneratedScreenFiles(workdir: string): string[] {
  const indexPath = path.join(workdir, "src", "screens", "SCREEN_INDEX.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    if (Array.isArray(parsed)) {
      const files = parsed
        .map((item) => typeof item?.file === "string" ? item.file.trim() : "")
        .filter((file) => isGeneratedScreenFile(file));
      if (files.length > 0) return [...new Set(files)].sort();
    }
  } catch {
    // fall through to directory scan
  }

  try {
    const screensDir = path.join(workdir, "src", "screens");
    return fs.readdirSync(screensDir)
      .filter((name) => /^[^/]+\.tsx$/.test(name))
      .map((name) => `src/screens/${name}`)
      .sort();
  } catch {
    return [];
  }
}

function readTextFileLimit(filePath: string, limit: number): string {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return "";
    return fs.readFileSync(filePath, "utf-8").trim().slice(0, limit);
  } catch {
    return "";
  }
}

function compactUiContract(input: unknown[]): unknown[] {
  return input.slice(0, 40).map((item) => {
    if (!item || typeof item !== "object") return item;
    const record = item as Record<string, unknown>;
    return {
      screenId: record["screenId"],
      screenTitle: record["screenTitle"],
      deviceType: record["deviceType"],
      buttons: record["buttons"],
      navigation: record["navigation"],
      inputs: record["inputs"],
      totalInteractive: record["totalInteractive"],
      requiresRouter: record["requiresRouter"],
      requiresDragDrop: record["requiresDragDrop"],
    };
  });
}

function extractGeneratedComponentTypeContracts(workdir: string, files: string[]): Array<Record<string, string>> {
  const contracts: Array<Record<string, string>> = [];
  for (const file of files.slice(0, 80)) {
    const absolute = path.join(workdir, file);
    const source = readTextFileLimit(absolute, 20000);
    if (!source) continue;
    const actionType = source.match(/export\s+type\s+\w+ActionId\s*=\s*[\s\S]*?;/)?.[0] || "";
    const propsInterface = source.match(/export\s+interface\s+\w+Props\s*\{[\s\S]*?\n\}/)?.[0] || "";
    const componentSignature = source.match(/export\s+function\s+\w+\s*\([^)]{0,500}\)/)?.[0] || "";
    if (!actionType && !propsInterface && !componentSignature) continue;
    contracts.push({
      file,
      actionType,
      propsInterface,
      componentSignature,
    });
  }
  return contracts;
}

function readDesignContractSummary(workdir: string): Record<string, unknown> {
  const screenIndex = readJsonArrayFile(path.join(workdir, "src", "screens", "SCREEN_INDEX.json"));
  const generatedScreenFiles = readGeneratedScreenFiles(workdir);
  const uiContract = compactUiContract(readJsonArrayFile(path.join(workdir, "stitch", "UI_CONTRACT.json")));
  const componentRegistry = readTextFileLimit(path.join(workdir, "src", "screens", "index.ts"), 12000);
  const componentTypes = extractGeneratedComponentTypeContracts(workdir, generatedScreenFiles);
  return {
    source: "Authoritative safe design handoff. Use this summary instead of reading raw stitch/*.html, .stitch-screens*.json, stitch/DESIGN_DOM.json, shared src/screens/*.tsx files, or creating source-tree probe files.",
    screenIndex,
    uiContract,
    componentRegistry,
    componentTypes,
  };
}

function generatedComponentName(contract: Record<string, string>): string {
  const signature = contract.componentSignature || "";
  const fromSignature = signature.match(/export\s+function\s+(\w+)/)?.[1];
  if (fromSignature) return fromSignature;
  const fromAction = (contract.actionType || "").match(/export\s+type\s+(\w+)ActionId/)?.[1];
  if (fromAction) return fromAction;
  return path.basename(contract.file || "", path.extname(contract.file || ""));
}

function generatedActionIds(contract: Record<string, string>): string[] {
  return [...(contract.actionType || "").matchAll(/"([^"]+)"/g)]
    .map((match) => match[1])
    .filter(Boolean)
    .slice(0, 40);
}

function buildScreenUsageContract(
  designContracts: Record<string, unknown>,
  allowedSourceFiles: string[],
  forbiddenSourceFiles: string[],
): Record<string, unknown> {
  const componentTypes = Array.isArray(designContracts.componentTypes)
    ? designContracts.componentTypes as Array<Record<string, string>>
    : [];
  const allowed = new Set(allowedSourceFiles);
  const forbidden = new Set(forbiddenSourceFiles);
  return {
    summary: "Use this compact contract before designContracts. Import generated screens from src/screens and wire only listed action IDs through actions props. Do not read forbidden src/screens/*.tsx source files.",
    importFrom: "src/screens",
    fatalSourceReadRule: "Forbidden generated screen source reads are killed and retried by Setfarm.",
    components: componentTypes.map((contract) => ({
      componentName: generatedComponentName(contract),
      file: contract.file,
      sourceRead: allowed.has(contract.file) ? "allowed" : (forbidden.has(contract.file) ? "forbidden" : "metadata-only"),
      actionIds: generatedActionIds(contract),
      propsInterface: contract.propsInterface,
      componentSignature: contract.componentSignature,
    })),
  };
}

function readSupervisorMemoryFile(workdir: string, repo: string): string {
  const candidates = [...new Set([repo, workdir].filter(Boolean))]
    .map((root) => path.join(root, "SUPERVISOR_MEMORY.md"));
  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;
      return fs.readFileSync(filePath, "utf-8").trim().slice(-6000);
    } catch {
      // try the next candidate
    }
  }
  return "";
}

function retryDisciplineForFailure(
  failureCategory: string,
  failureSuggestion: string,
  previousFailure: string,
): Record<string, unknown> | undefined {
  const signal = `${failureCategory}\n${failureSuggestion}\n${previousFailure}`;
  if (/\bRUNTIME_BRIDGE_MISSING\b/i.test(signal)) {
    return {
      mode: "semantic-fix",
      instruction: "Hard manager retry discipline: before adding or polishing unrelated features, expose the required window.app/globalThis.app bridge from live runtime state in a scoped React effect or equivalent update point, then run build/tests. Do not report STATUS: done until the blocker is implemented in source.",
    };
  }
  if (!/(AGENT_STALL|IMPLEMENT_NO_DELTA_STALL|CLAIM_SUMMARY_IGNORED|CLAIM_PARSE_LOOP|GENERATED_SCREEN_SHARED_READ|RAW_STITCH_CONTEXT_READ|IRRELEVANT_REFERENCE_CONTEXT|FULL_REFERENCE_CONTEXT_READ|SCOPE_WRITE_VIOLATION)/i.test(signal)) {
    return undefined;
  }
  return {
    mode: "first-delta",
    maxPreDeltaContextReads: 10,
    instruction: "Hard manager retry discipline: after bootstrap and the claim summary, inspect only the owned scope files plus safe metadata needed for the first edit, then make a small scoped source delta before broad analysis/build/test. Do not read raw stitch files, forbidden generated screens, full claims, or unrelated shared source to re-learn the project.",
  };
}

function meaningfulFailureCategory(value: string): string {
  const trimmed = value.trim();
  return trimmed && !/^UNKNOWN$/i.test(trimmed) ? trimmed : "";
}

function meaningfulFailureSuggestion(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^Unexpected error\b/i.test(trimmed)) return "";
  return trimmed;
}

function compactFailureLine(value: string, limit = 1200): string {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function extractCurrentStory(input: string): { storyId: string; storyTitle: string; currentStory: string; acceptanceCriteria: string } {
  const currentStory = sliceSection(
    input,
    /^\s*CURRENT STORY:\s*/m,
    [/^\s*=== PROJECT CONTEXT/m, /^\s*FILE TREE/m, /^\s*DESIGN DATA/m],
    2600,
  );
  const source = currentStory || input;
  const storyMatch = source.match(/\bStory\s+([A-Z]+-\d+):\s*([^\n]+)/i)
    || source.match(/^\s*CURRENT_STORY:\s*([A-Z]+-\d+)\s+([^\n]+)/im);
  const acceptanceCriteria = sliceSection(
    source,
    /^\s*Acceptance Criteria:\s*/m,
    [/^\s*SCOPE:/m, /^\s*[A-Z][A-Z _-]+:/m, /^\s*===/m],
    1800,
  );
  return {
    storyId: (storyMatch?.[1] || "").trim(),
    storyTitle: (storyMatch?.[2] || "").trim(),
    currentStory,
    acceptanceCriteria,
  };
}

export function buildClaimSummary(params: {
  wfId: string;
  role: string;
  claimFile: string;
  outputFile: string;
  bootstrapFile: string;
  stepId: string;
  runId: string;
  workdir: string;
  repo: string;
  storyId?: string;
  input: unknown;
}): Record<string, unknown> {
  const input = String(params.input || "");
  const currentStory = extractCurrentStory(input);
  const rawWorkdir = existingDirectory(params.workdir)
    || existingDirectory(lineValue(input, "WORKDIR"))
    || params.workdir
    || lineValue(input, "WORKDIR")
    || defaultAgentScratch;
  const storyId = params.storyId || currentStory.storyId;
  const storyBranch = deriveStoryBranch(input, params.runId, storyId);
  const storyWorkdir = deriveStoryWorkdir(input, rawWorkdir, params.wfId, storyBranch);
  const workdir = storyWorkdir || rawWorkdir;
  const repo = firstMeaningfulLineValue(input, "MAIN_REPO")
    || firstMeaningfulLineValue(input, "REPO")
    || params.repo
    || workdir;
  const storyScreensRaw = lineValue(input, "STORY_SCREENS");
  const task = lineValue(input, "TASK") || claimTaskPreview(params.input);
  const taskBrief = extractTaskBrief(input, params.input);
  const scopeFiles = extractScopeFiles(input, workdir);
  const scopeFileSet = new Set(scopeFiles);
  const isDeveloperStoryClaim = params.role === "developer" && Boolean(params.storyId || currentStory.storyId);
  const generatedScreenFiles = readGeneratedScreenFiles(workdir);
  const generatedScreenAllowed = generatedScreenFiles.filter((file) => scopeFileSet.has(file));
  const generatedScreenReadOnly = generatedScreenFiles.filter((file) => !scopeFileSet.has(file));
  const designContracts = readDesignContractSummary(workdir);
  const supervisorMemoryFromInput = sliceSection(
    input,
    /^\s*SUPERVISOR MEMORY.*?:\s*/m,
    [/^\s*CURRENT STORY/m, /^\s*STORY ROADMAP/m, /^\s*===/m],
    6000,
  );
  const supervisorMemory = supervisorMemoryFromInput || readSupervisorMemoryFile(workdir, repo);
  const previousFailure = cleanPreviousFailureSection(sliceSection(
    input,
    /^\s*(?:##\s*)?PREVIOUS FAILURE.*(?:\n|:\s*)/im,
    [
      /^\s*##\s*Claim Handoff/im,
      /^\s*##\s*CURRENT STORY/im,
      /^\s*CURRENT STORY/im,
      /^\s*IMPLEMENTATION PHASE/im,
      /^\s*FILE SKELETONS/im,
    ],
    2200,
  ));
  const explicitFailureCategory = meaningfulFailureCategory(
    lineValue(previousFailure, "Failure category") || lineValue(input, "Failure category"),
  );
  const explicitFailureSuggestion = meaningfulFailureSuggestion(
    lineValue(previousFailure, "Suggested response") || lineValue(input, "Suggested response"),
  );
  const classifiedFailure = classifyError([previousFailure, explicitFailureCategory, explicitFailureSuggestion].filter(Boolean).join("\n"));
  const failureCategory = explicitFailureCategory || (previousFailure ? classifiedFailure.category : "");
  const retryMode = retryFeedbackMode(params.role);
  const failureSuggestion = explicitFailureSuggestion || (previousFailure ? classifiedFailure.suggestion : "");
  const retryDiscipline = retryMode === "fix"
    ? retryDisciplineForFailure(failureCategory, failureSuggestion, previousFailure)
    : undefined;
  return {
    schema: "setfarm.claim-summary.v1",
    workflow: params.wfId,
    role: params.role,
    stepId: params.stepId,
    runId: params.runId,
    storyId,
    storyTitle: currentStory.storyTitle,
    screenUsageContract: buildScreenUsageContract(designContracts, generatedScreenAllowed, generatedScreenReadOnly),
    task,
    taskBrief,
    workdir,
    repo,
    mainRepo: repo,
    storyWorkdir,
    verifyWorkdir: storyWorkdir || workdir,
    storyBranch,
    runBranch: lineValue(input, "RUN_BRANCH"),
    buildCommand: resolvedCommand(input, "BUILD_CMD", [workdir, repo], "build", "true"),
    testCommand: resolvedCommand(input, "TEST_CMD", [workdir, repo], "test", "true"),
    lintCommand: resolvedCommand(input, "LINT_CMD", [workdir, repo], "lint", "true"),
    gitPolicy: isDeveloperStoryClaim ? {
      owner: "setfarm-platform",
      summary: "Developer story agents write code only. Do not stage, commit, push, create branches, or open PRs; Setfarm commits allowed scopeFiles after build/scope/supervisor gates pass.",
      allowedForAgent: ["git status", "git diff", "git log"],
      forbiddenForAgent: ["git add", "git commit", "git push", "git checkout", "git branch", "git switch", "gh pr create", "gh pr merge"],
      completion: "Run local checks, write STATUS output, and stop. Do not use git to save progress.",
    } : {
      owner: "role-prompt",
      summary: "Follow the role prompt for git ownership. Developer story claims are platform-owned; other roles may have their own explicit git permissions.",
      allowedForAgent: [],
      forbiddenForAgent: [],
      completion: "Follow the role-specific output contract.",
    },
    scopeFiles,
    sharedFiles: splitCsvList(lineValue(input, "story_shared_files")),
    storyScreens: parseJsonArray(storyScreensRaw),
    generatedScreenPolicy: {
      summary: generatedScreenAllowed.length > 0
        ? `May use OpenClaw read/edit only on these generated screen source files: ${generatedScreenAllowed.join(", ")}. Other src/screens/*.tsx files are forbidden to read or edit; use SCREEN_INDEX.json, src/screens/index.ts, component registry, component types, and UI_CONTRACT.`
        : "No generated screen source file is in scope. Do not use OpenClaw read tool, cat, sed, head, grep, rg, node, or python on any src/screens/*.tsx file; use SCREEN_INDEX.json, src/screens/index.ts, component registry, component types, and UI_CONTRACT only.",
      allowedSourceFiles: generatedScreenAllowed,
      forbiddenSourceFiles: generatedScreenReadOnly,
      safeMetadataFiles: ["src/screens/SCREEN_INDEX.json", "src/screens/index.ts"],
    },
    designContracts,
    currentStory: currentStory.currentStory,
    acceptanceCriteria: currentStory.acceptanceCriteria,
    uiBehaviorContract: sliceSection(
      input,
      /^\s*UI BEHAVIOR CONTRACT \(from Stitch DOM .*?\):\s*/m,
      [/^\s*DESIGN DOM RULES/m, /^\s*DESIGN\.MD INTEGRATION/m],
      2600,
    ),
    previousFailure,
    failureCategory,
    failureSuggestion,
    retryDiscipline,
    retryFeedback: previousFailure ? {
      mode: retryMode,
      category: failureCategory,
      suggestion: failureSuggestion,
      blocker: compactFailureLine(previousFailure),
      discipline: retryDiscipline,
      instruction: retryFeedbackInstruction(retryMode),
    } : undefined,
    supervisorMemory,
    handoff: {
      claimFile: params.claimFile,
      outputFile: params.outputFile,
      bootstrapFile: params.bootstrapFile,
      fullClaimUsage: "Audit fallback only. Read this summary first; do not jq/sed/head/node-loop over claim.input.",
    },
  };
}

export function buildResolvedClaimBootstrapScript(params: {
  claimFile: string;
  outputFile: string;
  claimSummaryFile?: string;
  stepId: string;
  workdir: string;
  taskPreview?: string;
}): string {
  const claimSummaryFile = params.claimSummaryFile || "";
  return `#!/usr/bin/env bash
set -euo pipefail

CLAIM_FILE=${shellQuote(params.claimFile)}
CLAIM_SUMMARY_FILE=${shellQuote(claimSummaryFile)}
OUTPUT_FILE=${shellQuote(params.outputFile)}
STEP_ID=${shellQuote(params.stepId)}
WORKDIR=${shellQuote(params.workdir || defaultAgentScratch)}
TASK_PREVIEW=${shellQuote(String(params.taskPreview || "").slice(0, 1200))}
export CLAIM_FILE CLAIM_SUMMARY_FILE OUTPUT_FILE STEP_ID WORKDIR

mkdir -p "$WORKDIR"
cd "$WORKDIR"
case "$(pwd)" in
  "$HOME"/.openclaw/setfarm-repo|"$HOME"/.openclaw/setfarm-repo/*)
    echo FATAL_PLATFORM_CWD
    exit 1
    ;;
esac

printf 'STEP_ID=%s\\nWORKDIR=%s\\nCLAIM_SUMMARY_FILE=%s\\n' "$STEP_ID" "$(pwd)" "$CLAIM_SUMMARY_FILE"
SUMMARY_PRINTED=0
if [ -n "$CLAIM_SUMMARY_FILE" ] && [ -f "$CLAIM_SUMMARY_FILE" ]; then
  node - "$CLAIM_SUMMARY_FILE" <<'SETFARM_SUMMARY_NODE'
const fs = require("fs");
const s = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const lines = [];
if (s.storyId || s.storyTitle) lines.push(("STORY=" + (s.storyId || "") + " " + (s.storyTitle || "")).trim());
if (s.storyBranch) lines.push("STORY_BRANCH=" + String(s.storyBranch));
if (s.storyWorkdir) lines.push("STORY_WORKDIR=" + String(s.storyWorkdir));
if (s.verifyWorkdir) lines.push("VERIFY_WORKDIR=" + String(s.verifyWorkdir));
if (s.repo) lines.push("MAIN_REPO=" + String(s.repo));
if (s.buildCommand) lines.push("BUILD_CMD=" + String(s.buildCommand));
if (s.testCommand) lines.push("TEST_CMD=" + String(s.testCommand));
if (s.lintCommand) lines.push("LINT_CMD=" + String(s.lintCommand));
if (Array.isArray(s.scopeFiles)) lines.push("SCOPE_FILES=" + s.scopeFiles.join(", "));
if (s.gitPolicy && s.gitPolicy.summary) lines.push("GIT_POLICY=" + s.gitPolicy.summary);
if (Array.isArray(s.gitPolicy && s.gitPolicy.forbiddenForAgent) && s.gitPolicy.forbiddenForAgent.length) lines.push("FORBIDDEN_GIT=" + s.gitPolicy.forbiddenForAgent.join(", "));
const sc = s.screenUsageContract || {};
if (sc.summary) lines.push("SCREEN_USAGE=" + String(sc.summary).slice(0, 500));
if (Array.isArray(sc.components)) {
  for (const c of sc.components.slice(0, 12)) {
    lines.push("SCREEN_COMPONENT=" + [c.componentName, c.file, c.sourceRead, "actions=" + (Array.isArray(c.actionIds) ? c.actionIds.join("|") : "")].filter(Boolean).join(" "));
  }
}
if (s.failureCategory) lines.push("FAILURE_CATEGORY=" + String(s.failureCategory).slice(0, 160));
if (s.failureSuggestion) lines.push("FAILURE_SUGGESTION=" + String(s.failureSuggestion).slice(0, 240));
const rf = s.retryFeedback || {};
if (rf.mode) lines.push("RETRY_MODE=" + String(rf.mode));
if (rf.blocker) lines.push("RETRY_BLOCKER=" + String(rf.blocker).slice(0, 700));
if (rf.suggestion) lines.push("RETRY_ACTION=" + String(rf.suggestion).slice(0, 300));
if (rf.instruction) lines.push("RETRY_INSTRUCTION=" + String(rf.instruction).slice(0, 300));
if (s.retryDiscipline && s.retryDiscipline.mode) lines.push("RETRY_DISCIPLINE=" + String(s.retryDiscipline.mode) + ": " + String(s.retryDiscipline.instruction || "").slice(0, 240));
if (s.previousFailure) lines.push("PREVIOUS_FAILURE=present " + String(s.previousFailure).length + " chars");
if (s.generatedScreenPolicy && s.generatedScreenPolicy.summary) lines.push("GENERATED_SCREEN_POLICY=" + s.generatedScreenPolicy.summary);
const dc = s.designContracts || {};
if (Array.isArray(dc.screenIndex)) lines.push("SCREEN_INDEX_CONTRACTS=" + dc.screenIndex.length);
if (Array.isArray(dc.uiContract)) lines.push("UI_CONTRACTS=" + dc.uiContract.length);
if (dc.componentRegistry) lines.push("COMPONENT_REGISTRY=present " + String(dc.componentRegistry).length + " chars");
if (Array.isArray(dc.componentTypes)) lines.push("COMPONENT_TYPE_CONTRACTS=" + dc.componentTypes.length);
if (s.supervisorMemory) lines.push("SUPERVISOR_MEMORY=present " + String(s.supervisorMemory).length + " chars");
if (s.taskBrief) lines.push("TASK_BRIEF=" + String(s.taskBrief).slice(0, 500));
process.stdout.write(lines.join("\\n") + "\\n");
SETFARM_SUMMARY_NODE
  SUMMARY_PRINTED=1
fi
if [ "$SUMMARY_PRINTED" = "0" ]; then
  printf '%s' "$TASK_PREVIEW" | head -c 1200
  echo
fi
`;
}

export function buildPreclaimedPrompt(params: {
  wfId: string;
  role: string;
  outputFile: string;
  claimFile: string;
  claimSummaryFile: string;
  bootstrapFile: string;
}): string {
  const cli = resolveSetfarmCli();
  const cliCommand = "/usr/bin/node " + cli;
  const stepIdCommand = `STEP_ID=$(node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1],"utf8")).stepId||"")' ${shellQuote(params.claimFile)})`;
  return `Setfarm claim ready. First action MUST be exec. No prose or HEARTBEAT before exec.

CLAIM_FILE=${params.claimFile}
CLAIM_SUMMARY_FILE=${params.claimSummaryFile}
OUTPUT_FILE=${params.outputFile}
BOOTSTRAP_FILE=${params.bootstrapFile}

First exec command:
bash ${shellQuote(params.bootstrapFile)}

Do ${params.wfId}/${params.role} work in WORKDIR only. Read the structured claim summary at ${params.claimSummaryFile} first; it is the authoritative handoff for story id/title, workdir, mainRepo, storyWorkdir, verifyWorkdir, build/test/lint commands, scope files, gitPolicy, screenUsageContract, generatedScreenPolicy, designContracts, supervisorMemory, screen refs, retry feedback, and output paths. Use retryFeedback.mode exactly: mode="fix" means the blocker is an open implementation requirement and must be fixed before unrelated work; mode="audit" means prior feedback may be stale, so first verify whether it is still present with bounded evidence before reporting or changing code. Obey gitPolicy exactly: when owner is setfarm-platform, do not run git add/commit/push/branch/PR commands; Setfarm performs the scoped commit and PR handoff after gates pass. Use screenUsageContract first for generated screen component names, props, and action IDs; use designContracts.screenIndex, designContracts.uiContract, designContracts.componentRegistry, and designContracts.componentTypes as fallback instead of reading raw Stitch files, shared generated screen source, or creating TypeScript probe files. The full claim at ${params.claimFile} is an audit fallback only. Do NOT parse or dump claim.input with jq/sed/head/node loops; use the summary fields and only fall back to the full claim for a missing focused field. Obey generatedScreenPolicy exactly: reading a forbidden src/screens/*.tsx file kills and retries the claim.
For retryFeedback.mode="fix", treat retryDiscipline.mode as a hard implementation instruction. For retryDiscipline.mode="first-delta", after bootstrap and summary, inspect only the owned scope files plus safe metadata needed for the first edit, then make a small scoped source delta before broad analysis/build/test. For retryDiscipline.mode="semantic-fix", implement the named blocker first, then run the relevant checks. For retryFeedback.mode="audit", do not convert prior feedback into a source-edit mandate unless the role-specific prompt explicitly owns that fix.
Do NOT create scratch/progress/todo/note/probe files inside WORKDIR unless they are explicitly listed in scopeFiles. Files like src/_probe.tsx, src/probe.tsx, tmp.ts, scratch.tsx, TODO.md, and progress.txt are forbidden in the project worktree. Use ${params.outputFile} for final output and /tmp/setfarm-progress-<run-id>.txt for checkpoints only.
Important: OpenClaw read/edit/write tools resolve relative paths against the configured agent workspace, not the shell cwd. When using read/edit/write tools for project files, use absolute paths under WORKDIR, for example "$WORKDIR/src/App.tsx". For exec commands, rerun the bootstrap command above or pass workdir="$WORKDIR" after resolving it.
Do not rely on CLAIM_FILE, CLAIM_SUMMARY_FILE, OUTPUT_FILE, STEP_ID, or WORKDIR shell variables persisting across separate exec calls; each exec starts a fresh shell. If you need claim context again, use the literal summary path ${params.claimSummaryFile}. Write final output to the literal path ${params.outputFile}. Do NOT run step peek/claim. No subagents/background delegation. No PR actions unless claim explicitly owns PR work.
For normal quality findings in verify/review/QA/final-test, do NOT use step fail. Write STATUS: retry with concise findings and call step complete so the platform can route the batched fix back to implement. Use step fail only for infrastructure/unrecoverable execution failures.

Complete with:
cat > ${shellQuote(params.outputFile)} <<'SETFARM_EOF'
STATUS: done
<required claim output keys>
SETFARM_EOF
${stepIdCommand}; ${cliCommand} step complete "$STEP_ID" --file ${shellQuote(params.outputFile)}

Fail with: ${stepIdCommand}; ${cliCommand} step fail "$STEP_ID" "specific reason"
After complete/fail, reply HEARTBEAT_OK and stop.`;
}

export const defaultAgentScratch = path.join(os.homedir(), ".openclaw", "workspace", "agent-scratch");
