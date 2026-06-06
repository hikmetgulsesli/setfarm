import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { resolveSetfarmCli } from "./installer/paths.js";
import { classifyError } from "./installer/error-taxonomy.js";
import { readSupervisorState, supervisorStatePath } from "./installer/supervisor/state.js";
import { implementEvidenceArtifactPaths, readImplementEvidenceConfig } from "./installer/implement-evidence.js";

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

function safePathSegment(value: string): string {
  return String(value || "unknown").replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 120) || "unknown";
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

function isAgentScratchPath(value: string): boolean {
  const candidate = String(value || "").trim();
  if (!candidate) return false;
  const resolved = path.resolve(candidate);
  return resolved === path.resolve(defaultAgentScratch) || path.basename(resolved) === "agent-scratch";
}

function projectRootFromClaimText(input: string): string {
  const projectRootLine = /(?:^|[\r\n])\s*(?:[-*]\s*)?`?([^`\r\n]+?)`?\s*:\s*project root\b/gi;
  let lineMatch: RegExpExecArray | null;
  while ((lineMatch = projectRootLine.exec(input)) !== null) {
    const candidate = existingDirectory((lineMatch[1] || "").trim());
    if (candidate) return candidate;
  }

  const projectRootLabel = /(?:^|[\r\n])\s*project root\s*[:=]\s*`?([^`\r\n]+?)`?\s*$/gi;
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = projectRootLabel.exec(input)) !== null) {
    const candidate = existingDirectory((labelMatch[1] || "").trim());
    if (candidate) return candidate;
  }

  return "";
}

function compactTaskSummary(input: string, rawInput: unknown): string {
  const brief = extractTaskBrief(input, rawInput).trim();
  if (brief) return brief.slice(0, 700);

  const direct = lineValue(input, "TASK").trim();
  if (direct) return direct.slice(0, 700);

  return claimTaskPreview(rawInput)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"))?.slice(0, 700) || "";
}

function extractOutputContract(input: string): { format: string; requiredFields: string[] } | undefined {
  const section = sliceSection(
    input,
    /^\s*##\s*Output (?:Format|Contract)\s*$/im,
    [/^\s*##\s+/m],
    2200,
  );
  if (!section) return undefined;
  const fenced = section.match(/```(?:[A-Za-z0-9_-]+)?\s*\n([\s\S]*?)```/);
  const format = (fenced?.[1] || section)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .slice(0, 24)
    .join("\n")
    .slice(0, 1800);
  if (!format) return undefined;
  const requiredFields = outputContractRequiredFields(format);
  return { format, requiredFields };
}

function outputContractRequiredFields(format: string): string[] {
  const lines = format.split(/\r?\n/);
  const hasConditionalBranches = lines.some((line) => /^\s*If\b/i.test(line));
  if (!hasConditionalBranches) {
    return Array.from(new Set(
      lines
        .map((line) => line.match(/^\s*([A-Z][A-Z0-9_]+)\s*:/)?.[1])
        .filter((value): value is string => Boolean(value)),
    ));
  }

  const positiveFields: string[] = [];
  const neutralFields: string[] = [];
  let branch: "neutral" | "positive" | "blocked" = "neutral";
  for (const line of lines) {
    if (/^\s*If\b/i.test(line)) {
      branch = /\b(clean|fixed|you fixed|success|passes?)\b/i.test(line)
        ? "positive"
        : "blocked";
      continue;
    }
    const field = line.match(/^\s*([A-Z][A-Z0-9_]+)\s*:/)?.[1];
    if (!field) continue;
    if (branch === "positive") positiveFields.push(field);
    else if (branch === "neutral") neutralFields.push(field);
  }

  const fields = positiveFields.length ? [...neutralFields, ...positiveFields] : [...neutralFields];
  if (!fields.length) {
    return Array.from(new Set(
      lines
        .map((line) => line.match(/^\s*([A-Z][A-Z0-9_]+)\s*:/)?.[1])
        .filter((value): value is string => Boolean(value)),
    ));
  }
  const requiredFields = Array.from(new Set(
    fields,
  ));
  return requiredFields;
}

function defaultOutputContract(role: string): { source: string; format: string; requiredFields: string[]; instruction: string } {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "reviewer" || normalized === "verifier") {
    return {
      source: "role-default",
      format: [
        "STATUS: done|retry|fail",
        "STORY: <story id and title>",
        "ROLE: reviewer",
        "RESULT: <concise verification result>",
        "FINDINGS: <numbered defects when STATUS is retry; none when clean>",
        "CHECKS: <commands and evidence>",
        "SCOPE: <files changed/read or none>",
      ].join("\n"),
      requiredFields: ["STATUS", "STORY", "ROLE", "RESULT", "FINDINGS", "CHECKS", "SCOPE"],
      instruction: "Final step output must include these fields. Use STATUS: retry for real defects, STATUS: fail only for unrecoverable infrastructure, and STATUS: done only after the role prompt's pass requirements are met. After proving the first real blocker with one primary check and, for missing behavior, one narrower confirmation check, return STATUS: retry immediately instead of continuing source hunting.",
    };
  }
  if (normalized === "supervisor") {
    return {
      source: "role-default",
      format: [
        "STATUS: done|retry|fail",
        "SUPERVISOR_DECISION: pass|block",
        "AC_COVERAGE: <acceptance criteria coverage summary>",
        "SUPERVISOR_MEMORY_APPEND: <durable manager memory update>",
        "CHECKS: <commands and evidence>",
        "CHANGES: <none or scoped changes>",
        "RISKS: <remaining risks or none>",
        "ISSUES: <blocking issues or none>",
      ].join("\n"),
      requiredFields: ["STATUS", "SUPERVISOR_DECISION", "AC_COVERAGE", "SUPERVISOR_MEMORY_APPEND", "CHECKS", "CHANGES", "RISKS"],
      instruction: "Final step output must include these fields. Use SUPERVISOR_DECISION: block when implementation must retry.",
    };
  }
  if (normalized === "developer") {
    return {
      source: "role-default",
      format: [
        "STATUS: done|fail",
        "STORY_BRANCH: <story branch>",
        "CHANGES: <summary of implemented scope>",
        "PR_URL: <empty; Setfarm creates the PR>",
        "REASON: <only when STATUS is fail>",
      ].join("\n"),
      requiredFields: ["STATUS", "STORY_BRANCH", "CHANGES", "PR_URL", "REASON"],
      instruction: "Final step output must include these fields. Do not stage, commit, push, or create a PR from the agent.",
    };
  }
  return {
    source: "role-default",
    format: [
      "STATUS: done|retry|skip|fail",
      "SUMMARY: <concise result>",
      "CHECKS: <commands and evidence>",
    ].join("\n"),
    requiredFields: ["STATUS", "SUMMARY", "CHECKS"],
    instruction: "Final step output must include these fields before calling step complete.",
  };
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

function sliceSectionUnbounded(input: string, start: RegExp, ends: RegExp[]): string {
  const match = start.exec(input);
  if (!match || match.index === undefined) return "";
  const startIndex = match.index + match[0].length;
  let endIndex = input.length;
  const rest = input.slice(startIndex);
  for (const end of ends) {
    const endMatch = end.exec(rest);
    if (endMatch && endMatch.index !== undefined) endIndex = Math.min(endIndex, startIndex + endMatch.index);
  }
  return input.slice(startIndex, endIndex).trim();
}

function summarizeArrayItems(value: unknown, limit = 6): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => typeof item === "string" ? item : JSON.stringify(item))
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function compactStoryImplementationContract(raw: string): string {
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) return "";
  try {
    const contract = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    const lines: string[] = [];
    lines.push("Story implementation contract summary (full JSON omitted from bootstrap to avoid unsafe truncation):");
    const ownedActions = Array.isArray(contract.owned_actions) ? contract.owned_actions : [];
    if (ownedActions.length) {
      lines.push(`- owned_actions: ${ownedActions.slice(0, 8).map((action: any) => {
        const id = String(action?.id || "").trim();
        const trigger = String(action?.trigger || action?.state_change || "").replace(/\s+/g, " ").trim();
        return trigger ? `${id} (${trigger.slice(0, 120)})` : id;
      }).filter(Boolean).join("; ")}`);
    }
    for (const [label, key] of [
      ["state_contract", "state_contract"],
      ["persistence_contract", "persistence_contract"],
      ["navigation_contract", "navigation_contract"],
      ["test_contract", "test_contract"],
    ] as const) {
      const items = summarizeArrayItems(contract[key], 4);
      if (items.length) lines.push(`- ${label}: ${items.join("; ")}`);
    }
    const scopeRoles = Array.isArray(contract.resolved_scope_roles) ? contract.resolved_scope_roles : [];
    if (scopeRoles.length) {
      lines.push(`- resolved_scope_roles: ${scopeRoles.slice(0, 12).map((role: any) => {
        const roleName = String(role?.role || "").trim();
        const rolePath = String(role?.path || "").trim();
        return roleName && rolePath ? `${roleName}:${rolePath}` : roleName || rolePath;
      }).filter(Boolean).join("; ")}`);
    }
    return lines.join("\n").slice(0, 2400);
  } catch {
    return "";
  }
}

function safeAcceptanceCriteria(raw: string, limit = 1800): string {
  const value = raw.trim();
  if (!value || value.length <= limit) return value;
  const contractSummary = compactStoryImplementationContract(value);
  if (contractSummary) {
    const beforeJson = value.slice(0, Math.max(0, value.indexOf("{")))
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.trim())
      .slice(0, 10)
      .join("\n");
    return [beforeJson, contractSummary].filter(Boolean).join("\n\n").slice(0, 3000);
  }
  const safeCut = value.lastIndexOf("\n", limit);
  const head = value.slice(0, safeCut > 200 ? safeCut : limit).trimEnd();
  return `${head}\n...(truncated at safe boundary; use claim summary fields and scope files, not partial JSON)`;
}

function cleanPreviousFailureSection(raw: string): string {
  let value = String(raw || "").trim();
  const claimHandoff = value.search(/^\s*##\s*Claim Handoff\b/im);
  if (claimHandoff >= 0) value = value.slice(0, claimHandoff).trim();
  value = value.replace(
    /(?:\n\s*)?ALSO_FIX:\s*\n\s*RETRY_WORKTREE_PATCH:\s*[\s\S]*?(?=\n\s*(?:Failure category|Suggested response|RETRY_ACTION|RETRY_INSTRUCTION|##\s|CURRENT STORY|IMPLEMENTATION PHASE)\b|$)/gi,
    "\nALSO_FIX:\nRETRY_WORKTREE_PATCH: omitted from retry feedback because raw diffs are not safe claim context. Use the compact retryFeedback category/suggestion plus scopeFiles and current source state.",
  );
  value = value.replace(
    /```diff[\s\S]*?```/gi,
    "[raw diff omitted from retry feedback]",
  );
  value = value.replace(
    /^diff --git [\s\S]*$/gim,
    "[raw diff omitted from retry feedback]",
  );
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

function fileExistsInWorkdir(workdir: string, filePath: string): boolean {
  try {
    return fs.existsSync(path.join(workdir, filePath));
  } catch {
    return false;
  }
}

function buildScopeFileStates(workdir: string, scopeFiles: string[]): Array<Record<string, unknown>> {
  return scopeFiles.map((file) => {
    const exists = fileExistsInWorkdir(workdir, file);
    return {
      path: file,
      exists,
      kind: exists ? "existing" : "missing",
      instruction: exists
        ? "Update this owned file when the story requires it."
        : "Create this owned file directly if the story requires it; do not treat the missing file as a blocker.",
    };
  });
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
    sourceReadRule: "Forbidden generated screen source reads are supervisor signals. The worker must switch back to SCREEN_INDEX, component registry, component types, and UI_CONTRACT instead of continuing broad source reads.",
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
  const roots = [...new Set([repo, workdir].filter(Boolean))];
  const candidates = roots.flatMap((root) => [
    path.join(root, ".setfarm", "SUPERVISOR_MEMORY.md"),
    path.join(root, "SUPERVISOR_MEMORY.md"),
  ]);
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

function readCurrentSupervisorEvidenceSummary(params: {
  workdir: string;
  repo: string;
  runId: string;
  storyId?: string;
  storyBranch?: string;
  role?: string;
}): Record<string, unknown> | undefined {
  const { workdir, repo, runId, storyId, storyBranch, role } = params;
  if (!workdir || !runId) return undefined;
  const summaries = supervisorEvidenceRoots(workdir, repo, storyBranch)
    .map((root) => readSupervisorEvidenceSummaryFromRoot(root, runId, storyId, role))
    .filter((summary): summary is Record<string, unknown> => Boolean(summary));
  if (!summaries.length) return undefined;

  return summaries
    .sort((a, b) => supervisorEvidenceScore(b) - supervisorEvidenceScore(a))[0];
}

function readSupervisorEvidenceSummaryFromRoot(
  root: string,
  runId: string,
  storyId?: string,
  role?: string,
): Record<string, unknown> | undefined {
  const stateFile = supervisorStatePath(root, runId);
  if (!fs.existsSync(stateFile)) return undefined;
  const state = readSupervisorState(root, runId);
  const story = storyId ? state.stories[storyId] : undefined;
  const scopedIds = new Set<string>([
    ...(story?.openBlockers || []),
    ...(story?.warnings || []),
    ...(story?.resolved || []),
  ]);
  const evidenceEntries = Object.entries(state.evidence)
    .filter(([itemId, evidence]) => scopedIds.has(itemId) || (!!storyId && (evidence as any).storyId === storyId));
  const resolvedIds = new Set(story?.resolved || []);
  const isActiveFinding = (itemId: string): boolean => {
    const evidence = state.evidence[itemId];
    if (!evidence) return false;
    if (resolvedIds.has(itemId)) return false;
    return evidence.status !== "passed";
  };
  const activeBlockerIds = (story?.openBlockers || []).filter(isActiveFinding);
  const activeWarningIds = (story?.warnings || []).filter(isActiveFinding);
  const derivedStoryStatus = activeBlockerIds.length > 0
    ? "blocked"
    : activeWarningIds.length > 0
      ? "warning"
      : story
        ? "passed"
        : "unknown";

  const blockers = activeBlockerIds
    .map((itemId) => state.evidence[itemId])
    .filter(Boolean)
    .map((evidence) => compactSupervisorEvidence(evidence, role))
    .slice(0, 8);
  const warnings = activeWarningIds
    .map((itemId) => state.evidence[itemId])
    .filter(Boolean)
    .map((evidence) => compactSupervisorEvidence(evidence, role))
    .slice(0, 8);
  const resolved = (story?.resolved || [])
    .map((itemId) => state.evidence[itemId])
    .filter(Boolean)
    .sort((a, b) => String(b.checkedAt || "").localeCompare(String(a.checkedAt || "")))
    .map((evidence) => compactSupervisorEvidence(evidence, role))
    .slice(0, 12);

  return {
    source: "current-supervisor-state",
    instruction: role === "reviewer"
      ? "Current-source scanner evidence is system-owned. If open visual blockers exist, report them concisely from this summary; do not open screenshot/image artifacts or run broad browser rechecks."
      : "Current-source scanner evidence is newer than initial Stitch/UI_CONTRACT data. For audit-mode retries, trust openBlockers/warnings here over stale retryFeedback or original designContracts when they conflict.",
    path: stateFile,
    workdir: root,
    projectStatus: state.projectStatus,
    updatedAt: state.updatedAt,
    storyId,
    storyStatus: derivedStoryStatus,
    counts: {
      blockers: activeBlockerIds.length,
      warnings: activeWarningIds.length,
      resolved: story?.resolved.length || 0,
      evidence: evidenceEntries.length,
      passed: evidenceEntries.filter(([, evidence]) => evidence.status === "passed").length,
    },
    blockers,
    warnings,
    recentlyResolved: resolved,
  };
}

function supervisorEvidenceScore(summary: Record<string, unknown>): number {
  const counts = (summary.counts && typeof summary.counts === "object" ? summary.counts : {}) as Record<string, unknown>;
  const numeric = (key: string): number => {
    const value = counts[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  const storyStatus = String(summary.storyStatus || "");
  const updatedAt = Date.parse(String(summary.updatedAt || ""));
  const recencyScore = Number.isFinite(updatedAt) ? updatedAt : 0;
  return (
    (storyStatus && storyStatus !== "unknown" ? 1_000_000_000_000_000 : 0) +
    recencyScore +
    numeric("blockers") * 1_000 +
    numeric("warnings") * 400 +
    numeric("resolved") * 120 +
    numeric("passed") * 80 +
    numeric("evidence") * 50
  );
}

function supervisorEvidenceRoots(workdir: string, repo: string, storyBranch?: string): string[] {
  const roots = [workdir, repo].filter(Boolean);
  const branch = String(storyBranch || "").trim();
  if (branch) {
    const normalized = workdir.replace(/\\/g, "/");
    const match = normalized.match(/^(.*\/workflows\/[^/]+\/agents)\/[^/]+\/story-worktrees\/[^/]+$/);
    if (match) {
      const agentsRoot = match[1];
      try {
        for (const agentDir of fs.readdirSync(agentsRoot)) {
          const candidate = path.join(agentsRoot, agentDir, "story-worktrees", branch);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) roots.push(candidate);
        }
      } catch {
        // Keep the direct workdir/repo candidates.
      }
    }
  }
  return [...new Set(roots.map((item) => path.resolve(item)))];
}

function compactSupervisorEvidence(evidence: any, role?: string): Record<string, unknown> {
  const reviewerVisual = role === "reviewer" && (String(evidence.itemId || "").startsWith("visual:") || evidence.lastScan === "visual-qa");
  return {
    itemId: evidence.itemId,
    status: evidence.status,
    severity: evidence.severity,
    file: reviewerVisual ? undefined : (Array.isArray(evidence.files) ? evidence.files[0] : undefined),
    line: evidence.line,
    message: reviewerVisual
      ? String(evidence.message || "").replace(/\s+/g, " ").slice(0, 180)
      : String(evidence.message || "").slice(0, 240),
    observed: reviewerVisual ? [] : (Array.isArray(evidence.observed) ? evidence.observed.slice(0, 4) : []),
    checkedAt: evidence.checkedAt,
  };
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
      instruction: "Hard manager retry discipline: first add a literal runtime assignment in scoped source, for example window.app = { state, actions } or globalThis.app = { state, actions }, from a React effect or equivalent live update point. Type declarations, comments, docs, window.game, or prose about a bridge do not count. After the assignment exists, run build/tests. Do not report STATUS: done until the source contains the assignment.",
    };
  }
  if (/\bSCOPE_FILE_MISSING\b/i.test(signal)) {
    return {
      mode: "semantic-fix",
      instruction: "Scope-file retry discipline: first create meaningful non-empty code in the declared scope_files that belong to this story, especially app shell, context, hooks, domain types, storage helpers, and CSS files when listed. Do not collapse the implementation into one file and do not report STATUS: done until the owned scope files exist.",
    };
  }
  if (/\bSCOPE_BLEED\b[\s\S]{0,520}\b(?:package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)\b/i.test(signal)) {
    return {
      mode: "semantic-fix",
      instruction: "Package-scope retry discipline: first remove package.json, package-lock.json, pnpm-lock.yaml, and yarn.lock changes from the story worktree. Do not install dependencies, rewrite package scripts, or create lockfile deltas in IMPLEMENT. Use the existing BUILD_CMD/TEST_CMD and existing stack-pack dependencies; if the story cannot be implemented without a new dependency, report that as a setup-build/stack-pack dependency blocker instead of editing package files.",
    };
  }
  if (/\bSUPERVISOR_BLOCKERS_OPEN\b/i.test(signal)) {
    return {
      mode: "semantic-fix",
      instruction: "Supervisor checklist discipline: fix the exact reported blocker ids in scoped files first. Missing controls, dead links, and static active controls are blockers; labeled icon/label drift is warning-level unless the checklist marks it blocker. Do not read raw Stitch files or broaden scope.",
    };
  }
  if (/\bAPP_INTEGRATION_REGRESSION\b|\bAPP_INTEGRATION_(?:SCOPE|SEMANTIC|PROP)_REGRESSION\b/i.test(signal)) {
    return {
      mode: "semantic-fix",
      instruction: "App integration regression discipline: first restore the previously accepted app/router wiring from the story branch base, including prior story action helper imports, keyboard/control bridges, data-testid values, ARIA/live-region/status contracts, and generated screen props. Then apply only this story's scoped additions. Do not remove or simplify previous story branches to make the current story pass.",
    };
  }
  if (!/(AGENT_STALL|IMPLEMENT_NO_DELTA_STALL|IMPLEMENT_PRE_DELTA_CHECK_VIOLATION|NO_WORK_DETECTED|CLAIM_SUMMARY_IGNORED|CLAIM_PARSE_LOOP|GENERATED_SCREEN_SHARED_READ|RAW_STITCH_CONTEXT_READ|IRRELEVANT_REFERENCE_CONTEXT|FULL_REFERENCE_CONTEXT_READ|SCOPE_WRITE_VIOLATION|LLM_SUPERVISOR_BLOCKED|SUPERVISOR_VISUAL_QA_BLOCKED|layout_overflow)/i.test(signal)) {
    return undefined;
  }
  return {
    mode: "first-delta",
    maxPreDeltaContextReads: 10,
    instruction: "Hard manager retry discipline: after bootstrap and the claim summary, inspect only the owned scope files plus safe metadata needed for the first edit, then make a small scoped source delta that addresses the reported blocker before broad analysis/build/test. Do not read raw stitch files, forbidden generated screens, full claims, or unrelated shared source to re-learn the project.",
  };
}

function acceptanceCriteriaLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function looksLikeBrowserGameClaim(input: string, task: string, currentStory: { storyTitle: string; acceptanceCriteria: unknown }): boolean {
  const signal = [
    input,
    task,
    currentStory.storyTitle,
    ...acceptanceCriteriaLines(currentStory.acceptanceCriteria),
  ].join("\n").toLowerCase();
  return /\b(browser-game|browser game|canvas-game|arcade|gameplay|game settings|playfield|score|high score|level|lives|paused|game over|paddle|runner|flappy|breakout|tetris|pong)\b/.test(signal);
}

function runtimeDoneChecklistForClaim(input: string, task: string, currentStory: { storyTitle: string; acceptanceCriteria: unknown }): string[] {
  if (!looksLikeBrowserGameClaim(input, task, currentStory)) return [];
  return [
    "Browser-game interactive stories must keep every data-setfarm-root wrapper as a neutral viewport frame: className includes relative, min-h-screen or h-screen, w-full or w-screen, and overflow-hidden.",
    "Browser-game runtime must contain a visible scheduled loop using setInterval or requestAnimationFrame that dispatches or calls a tick/advance/step/update action; reducer definitions without a timer do not count.",
    "Interactive runtime state must be exposed from live source through window.app or globalThis.app with state and actions; window.game, comments, and type declarations do not count.",
    "Generated Stitch screens must remain imported/reachable and wired through their declared actions prop IDs; do not replace generated gameplay/settings screens with custom shells.",
    "Before STATUS: done, run build/test and search scoped source for the runtime loop primitive plus window.app/globalThis.app assignment.",
  ];
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

function retryFeedbackBlockerLimit(value: string): number {
  return /\bPR_REVIEW_COMMENTS_OPEN\b|##\s*PR Comments\b/i.test(value) ? 6000 : 1200;
}

function extractPrReviewThreadIds(value: string): string[] {
  const ids = new Set<string>();
  const re = /\bthread=([A-Za-z0-9_-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    if (match[1]) ids.add(match[1]);
  }
  return Array.from(ids);
}

function extractCurrentStory(input: string): { storyId: string; storyTitle: string; currentStory: string; acceptanceCriteria: string } {
  const currentStorySection = sliceSectionUnbounded(
    input,
    /^\s*CURRENT STORY:\s*/m,
    [/^\s*For `SUPERVISOR_SCOPE/m, /^\s*PREVIOUS FAILURE:/m, /^\s*=== PROJECT CONTEXT/m, /^\s*FILE TREE/m, /^\s*DESIGN DATA/m],
  );
  const source = currentStorySection || input;
  const storyIdPattern = "([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\\d+)";
  const storyMatch = source.match(new RegExp(`\\bStory\\s+${storyIdPattern}:\\s*([^\\n]+)`, "i"))
    || source.match(new RegExp(`^\\s*CURRENT_STORY:\\s*${storyIdPattern}\\s+([^\\n]+)`, "im"))
    || source.match(new RegExp(`^\\s*STORY[=:]\\s*${storyIdPattern}\\s+([^\\n]+)`, "im"));
  const acceptanceCriteriaRaw = sliceSectionUnbounded(
    source,
    /^\s*Acceptance Criteria:\s*/m,
    [/^\s*SCOPE:/m, /^\s*[A-Z][A-Z _-]+:/m, /^\s*===/m],
  );
  const acceptanceCriteria = safeAcceptanceCriteria(acceptanceCriteriaRaw, 1800);
  const storyId = (storyMatch?.[1] || "").trim();
  const storyTitle = (storyMatch?.[2] || "").trim();
  return {
    storyId,
    storyTitle,
    currentStory: (currentStorySection || (storyId ? `Story ${storyId}: ${storyTitle}`.trim() : "")).slice(0, 3000),
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
  const projectRoot = projectRootFromClaimText(input);
  const currentStory = extractCurrentStory(input);
  const paramWorkdir = existingDirectory(params.workdir);
  const rawWorkdir = (paramWorkdir && !isAgentScratchPath(paramWorkdir) ? paramWorkdir : "")
    || existingDirectory(lineValue(input, "WORKDIR"))
    || projectRoot
    || paramWorkdir
    || params.workdir
    || lineValue(input, "WORKDIR")
    || defaultAgentScratch;
  const storyId = params.storyId || currentStory.storyId;
  const storyBranch = deriveStoryBranch(input, params.runId, storyId);
  const storyWorkdir = deriveStoryWorkdir(input, rawWorkdir, params.wfId, storyBranch);
  const workdir = storyWorkdir || rawWorkdir;
  const repo = firstMeaningfulLineValue(input, "MAIN_REPO")
    || firstMeaningfulLineValue(input, "REPO")
    || projectRoot
    || params.repo
    || workdir;
  const storyScreensRaw = lineValue(input, "STORY_SCREENS");
  const taskBrief = extractTaskBrief(input, params.input);
  const task = compactTaskSummary(input, params.input);
  const outputContract = extractOutputContract(input);
  const resolvedOutputContract = outputContract ? {
    source: "role-prompt-output-format",
    format: outputContract.format,
    requiredFields: outputContract.requiredFields,
    instruction: "Final step output must include these exact fields before calling step complete. Do not replace them with prose-only summaries.",
  } : defaultOutputContract(params.role);
  const scopeFiles = extractScopeFiles(input, workdir);
  const scopeFileStates = buildScopeFileStates(workdir, scopeFiles);
  const missingScopeFiles = scopeFileStates
    .filter((file) => file.kind === "missing")
    .map((file) => String(file.path));
  const existingScopeFiles = scopeFileStates
    .filter((file) => file.kind === "existing")
    .map((file) => String(file.path));
  const scopeFileInstruction = missingScopeFiles.length > 0
    ? "scopeFiles is the owned write set for this story. Existing scope files may be updated. Missing scope files are expected new owned files; create them directly with add-file/create-file semantics when needed instead of retrying update-only patches. Do not treat missing owned files as blockers."
    : "scopeFiles is the owned write set for this story. Existing scope files may be updated. Do not edit files outside this write set unless the role prompt explicitly allows it.";
  const scopeFileSet = new Set(scopeFiles);
  const isDeveloperStoryClaim = params.role === "developer" && Boolean(params.storyId || currentStory.storyId);
  const generatedScreenFiles = readGeneratedScreenFiles(workdir);
  const generatedScreenAllowed = generatedScreenFiles.filter((file) => scopeFileSet.has(file));
  const generatedScreenReadOnly = generatedScreenFiles.filter((file) => !scopeFileSet.has(file));
  const touchesAppIntegration = scopeFiles.some((file) =>
    /(^|\/)(App|main|router|routes|Navigation|ContentView|MainActivity|RootView)\.(tsx?|jsx?|swift|kt|java)$/i.test(file)
    || /(^|\/)(app|router|routes|navigation|content-view|main-activity|root-view)\//i.test(file)
  );
  const designContracts = readDesignContractSummary(workdir);
  const supervisorMemoryFromInput = sliceSection(
    input,
    /^\s*SUPERVISOR MEMORY.*?:\s*/m,
    [/^\s*CURRENT STORY/m, /^\s*STORY ROADMAP/m, /^\s*===/m],
    6000,
  );
  const supervisorMemory = supervisorMemoryFromInput || readSupervisorMemoryFile(workdir, repo);
  const supervisorStateRoot = path.join(workdir, ".setfarm", "supervisor", safePathSegment(params.runId || "unknown-run"));
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
    12000,
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
  const buildCommand = resolvedCommand(input, "BUILD_CMD", [workdir, repo], "build", "true");
  const testCommand = resolvedCommand(input, "TEST_CMD", [workdir, repo], "test", "true");
  const lintCommand = resolvedCommand(input, "LINT_CMD", [workdir, repo], "lint", "true");
  const runtimeDoneChecklist = runtimeDoneChecklistForClaim(input, task, currentStory);
  const implementEvidenceConfig = readImplementEvidenceConfig();
  const implementEvidencePaths = storyId ? implementEvidenceArtifactPaths(workdir, storyId) : null;
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
    outputContract: resolvedOutputContract,
    workdir,
    repo,
    mainRepo: repo,
    storyWorkdir,
    verifyWorkdir: storyWorkdir || workdir,
    storyBranch,
    storyDiffBase: lineValue(input, "STORY_DIFF_BASE"),
    runBranch: lineValue(input, "RUN_BRANCH"),
    buildCommand,
    testCommand,
    lintCommand,
    buildCmd: buildCommand,
    testCmd: testCommand,
    lintCmd: lintCommand,
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
    scopeFileStates,
    existingScopeFiles,
    missingScopeFiles,
    scopeFileInstruction,
    supervisor: {
      stateRoot: supervisorStateRoot,
      checklistPath: path.join(supervisorStateRoot, "SUPERVISOR_CHECKLIST.json"),
      statePath: path.join(supervisorStateRoot, "SUPERVISOR_STATE.json"),
      eventsPath: path.join(supervisorStateRoot, "SUPERVISOR_EVENTS.jsonl"),
      instruction: "Close all blocker items assigned to this story before STATUS: done. Warnings should be addressed when practical but do not justify broad redesign.",
    },
    supervisorEvidence: readCurrentSupervisorEvidenceSummary({
      workdir,
      repo,
      runId: params.runId,
      storyId,
      storyBranch,
      role: params.role,
    }),
    sharedFiles: splitCsvList(lineValue(input, "story_shared_files")),
    storyScreens: parseJsonArray(storyScreensRaw),
    generatedScreenPolicy: {
      summary: generatedScreenAllowed.length > 0
        ? `May inspect or edit only these generated screen source files: ${generatedScreenAllowed.join(", ")}. Keep inspection focused to owned scope files. Other src/screens/*.tsx files are forbidden to read or edit; use SCREEN_INDEX.json, src/screens/index.ts, component registry, component types, and UI_CONTRACT.`
        : "No generated screen source file is in scope. Do not use OpenClaw read tool, cat, sed, head, grep, rg, node, or python on any src/screens/*.tsx file; use SCREEN_INDEX.json, src/screens/index.ts, component registry, component types, and UI_CONTRACT only.",
      allowedSourceFiles: generatedScreenAllowed,
      forbiddenSourceFiles: generatedScreenReadOnly,
      safeMetadataFiles: ["src/screens/SCREEN_INDEX.json", "src/screens/index.ts"],
    },
    integrationPolicy: {
      applies: touchesAppIntegration,
      summary: touchesAppIntegration
        ? "This story may touch app/router/shell integration, so preserve existing reachable render paths before adding the current story. Do not replace, delete, or stop rendering previously integrated generated screens/components. Add the new screen through an explicit state/route/branch using declared contracts and keep prior branches intact."
        : "This story does not own app/router/shell integration. Do not add or remove app-level render paths.",
      requiredCheck: touchesAppIntegration
        ? "Before STATUS: done, compare the app/router diff and confirm previous generated screen imports/render branches remain reachable while the current story screen is added."
        : "Before STATUS: done, confirm no app/router/shell integration file was changed outside scope.",
    },
    runtimeDoneChecklist,
    implementEvidenceContract: storyId ? {
      mode: implementEvidenceConfig.mode,
      visualGate: implementEvidenceConfig.visualGate,
      visualProvider: implementEvidenceConfig.visualProvider,
      intentPath: implementEvidencePaths?.intent,
      verificationRequestPath: implementEvidencePaths?.request,
      evidencePath: implementEvidencePaths?.evidence,
      instruction: "For runtime/UI stories, write IMPLEMENT_INTENT.json before broad coding and IMPLEMENT_VERIFICATION_REQUEST.json before STATUS: done. Setfarm owns IMPLEMENT_EVIDENCE.json and executes the runtime evidence. Use the top-level JSON key named schema; do not use $schema.",
      intentSchema: "top-level schema key, not $schema. Required exact JSON for interactive criteria: {\"schema\":\"setfarm.implement-intent.v1\",\"storyId\":\"<storyId>\",\"storyType\":\"ui_interactive\",\"acceptanceCriteria\":[{\"id\":\"AC-001\",\"description\":\"...\"}],\"runtimeEvidenceRequired\":{\"minFlowCount\":1}}. Use minFlowCount:0 only when acceptance criteria require no user/runtime interaction.",
      verificationRequestSchema: "top-level schema key, not $schema. Required exact JSON: {\"schema\":\"setfarm.implement-verification-request.v1\",\"storyId\":\"<storyId>\",\"status\":\"ready_for_orchestrator_verification\",\"interactionRequests\":[{\"id\":\"flow-1\",\"action\":\"click\",\"target\":\"[data-action-id='<action-id>']\",\"waitCondition\":\"dom_idle\",\"timeoutMs\":1000}],\"uncoveredCriteria\":[],\"knownGaps\":[]}. interactionRequests may be [] only when criteria require no interaction; otherwise request executable actions or list criteria in uncoveredCriteria. Interactions start from the app's initial loaded state and run in order; if the target is on a later surface, first include or implement a reachable opener action, then request the target action.",
    } : undefined,
    designContracts,
    currentStory: currentStory.currentStory || (storyId ? `Story ${storyId}: ${currentStory.storyTitle}`.trim() : ""),
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
      blocker: compactFailureLine(previousFailure, retryFeedbackBlockerLimit(previousFailure)),
      details: previousFailure,
      prThreadIds: extractPrReviewThreadIds(previousFailure),
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

if [ -n "$CLAIM_SUMMARY_FILE" ] && [ -f "$CLAIM_SUMMARY_FILE" ]; then
  SUMMARY_WORKDIR="$(node - "$CLAIM_SUMMARY_FILE" <<'SETFARM_WORKDIR_NODE'
const fs = require("fs");
try {
  const s = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  for (const value of [s.workdir, s.verifyWorkdir, s.mainRepo, s.repo]) {
    if (!value) continue;
    try {
      if (fs.existsSync(String(value)) && fs.statSync(String(value)).isDirectory()) {
        process.stdout.write(String(value));
        break;
      }
    } catch {}
  }
} catch {}
SETFARM_WORKDIR_NODE
)"
  if [ -n "$SUMMARY_WORKDIR" ]; then
    WORKDIR="$SUMMARY_WORKDIR"
    export WORKDIR
  fi
fi

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
if (s.storyDiffBase) lines.push("STORY_DIFF_BASE=" + String(s.storyDiffBase));
if (s.storyWorkdir) lines.push("STORY_WORKDIR=" + String(s.storyWorkdir));
if (s.verifyWorkdir) lines.push("VERIFY_WORKDIR=" + String(s.verifyWorkdir));
if (s.repo) lines.push("MAIN_REPO=" + String(s.repo));
if (s.buildCommand) lines.push("BUILD_CMD=" + String(s.buildCommand));
if (s.testCommand) lines.push("TEST_CMD=" + String(s.testCommand));
if (s.lintCommand) lines.push("LINT_CMD=" + String(s.lintCommand));
if (Array.isArray(s.scopeFiles)) lines.push("SCOPE_FILES=" + s.scopeFiles.join(", "));
if (Array.isArray(s.existingScopeFiles) && s.existingScopeFiles.length) lines.push("EXISTING_SCOPE_FILES=" + s.existingScopeFiles.join(", "));
if (Array.isArray(s.missingScopeFiles) && s.missingScopeFiles.length) lines.push("MISSING_SCOPE_FILES=" + s.missingScopeFiles.join(", "));
if (s.scopeFileInstruction) lines.push("SCOPE_FILE_POLICY=" + String(s.scopeFileInstruction).slice(0, 500));
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
if (rf.blocker) lines.push("RETRY_BLOCKER_PREVIEW=" + String(rf.blocker).slice(0, 700));
if (Array.isArray(rf.prThreadIds) && rf.prThreadIds.length) lines.push("PR_REVIEW_THREADS=" + rf.prThreadIds.join(", "));
if (rf.details) lines.push("RETRY_DETAIL=full retry detail is in claimSummary.retryFeedback.details and claimSummary.previousFailure; do not rely on RETRY_BLOCKER_PREVIEW alone");
if (rf.suggestion) lines.push("RETRY_ACTION=" + String(rf.suggestion).slice(0, 300));
if (rf.instruction) lines.push("RETRY_INSTRUCTION=" + String(rf.instruction).slice(0, 300));
if (s.retryDiscipline && s.retryDiscipline.mode) lines.push("RETRY_DISCIPLINE=" + String(s.retryDiscipline.mode) + ": " + String(s.retryDiscipline.instruction || "").slice(0, 240));
if (s.previousFailure) lines.push("PREVIOUS_FAILURE=present " + String(s.previousFailure).length + " chars");
if (s.generatedScreenPolicy && s.generatedScreenPolicy.summary) lines.push("GENERATED_SCREEN_POLICY=" + s.generatedScreenPolicy.summary);
if (s.integrationPolicy && s.integrationPolicy.summary) lines.push("INTEGRATION_POLICY=" + String(s.integrationPolicy.summary).slice(0, 700));
if (s.integrationPolicy && s.integrationPolicy.requiredCheck) lines.push("INTEGRATION_CHECK=" + String(s.integrationPolicy.requiredCheck).slice(0, 500));
if (Array.isArray(s.runtimeDoneChecklist) && s.runtimeDoneChecklist.length) {
  lines.push("RUNTIME_DONE_CHECKLIST=" + s.runtimeDoneChecklist.length + " required invariant(s)");
  for (const item of s.runtimeDoneChecklist.slice(0, 8)) {
    lines.push("RUNTIME_DONE_CHECK=" + String(item).slice(0, 360));
  }
}
const ie = s.implementEvidenceContract || {};
if (ie.mode) {
  lines.push("IMPLEMENT_EVIDENCE_GATE=" + [
    "mode=" + ie.mode,
    "visual=" + (ie.visualGate || "off"),
    "provider=" + (ie.visualProvider || "none"),
  ].join(" "));
  if (ie.intentPath) lines.push("IMPLEMENT_INTENT_PATH=" + ie.intentPath);
  if (ie.verificationRequestPath) lines.push("IMPLEMENT_VERIFICATION_REQUEST_PATH=" + ie.verificationRequestPath);
  if (ie.evidencePath) lines.push("IMPLEMENT_EVIDENCE_PATH_SETFARM_OWNS=" + ie.evidencePath);
  if (ie.instruction) lines.push("IMPLEMENT_EVIDENCE_RULE=" + String(ie.instruction).slice(0, 420));
  if (ie.intentSchema) lines.push("IMPLEMENT_INTENT_SCHEMA=" + String(ie.intentSchema).slice(0, 500));
  if (ie.verificationRequestSchema) lines.push("IMPLEMENT_VERIFICATION_REQUEST_SCHEMA=" + String(ie.verificationRequestSchema).slice(0, 600));
}
const se = s.supervisorEvidence || {};
if (se.source) {
  const counts = se.counts || {};
  lines.push("SUPERVISOR_EVIDENCE=" + [
    "source=" + se.source,
    se.storyId ? "story=" + se.storyId : "",
    se.storyStatus ? "status=" + se.storyStatus : "",
    "blockers=" + (counts.blockers ?? 0),
    "warnings=" + (counts.warnings ?? 0),
    "resolved=" + (counts.resolved ?? 0),
  ].filter(Boolean).join(" "));
  if (se.instruction) lines.push("SUPERVISOR_EVIDENCE_RULE=" + String(se.instruction).slice(0, 400));
  if (Array.isArray(se.blockers) && se.blockers.length) {
    lines.push("SUPERVISOR_OPEN_BLOCKER=" + String(se.blockers[0].message || "").slice(0, 300));
  }
}
const dc = s.designContracts || {};
if (Array.isArray(dc.screenIndex)) lines.push("SCREEN_INDEX_CONTRACTS=" + dc.screenIndex.length);
if (Array.isArray(dc.uiContract)) lines.push("UI_CONTRACTS=" + dc.uiContract.length);
if (dc.componentRegistry) lines.push("COMPONENT_REGISTRY=present " + String(dc.componentRegistry).length + " chars");
if (Array.isArray(dc.componentTypes)) lines.push("COMPONENT_TYPE_CONTRACTS=" + dc.componentTypes.length);
if (s.supervisorMemory) lines.push("SUPERVISOR_MEMORY=present " + String(s.supervisorMemory).length + " chars");
if (s.taskBrief) lines.push("TASK_BRIEF=" + String(s.taskBrief).slice(0, 500));
const oc = s.outputContract || {};
if (Array.isArray(oc.requiredFields) && oc.requiredFields.length) lines.push("OUTPUT_REQUIRED_FIELDS=" + oc.requiredFields.join(", "));
if (oc.format) {
  lines.push("OUTPUT_CONTRACT_BEGIN");
  for (const line of String(oc.format).split(/\\r?\\n/).slice(0, 24)) {
    if (line.trim()) lines.push("OUTPUT_CONTRACT " + line.slice(0, 240));
  }
  lines.push("OUTPUT_CONTRACT_END");
}
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
  const cliCommand = "node " + shellQuote(cli);
  const stepIdCommand = `STEP_ID=$(node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1],"utf8")).stepId||"")' ${shellQuote(params.claimFile)})`;
  return `Setfarm claim ready. The project planning, design, and story approval gates already happened inside Setfarm. Do not invoke separate brainstorming, design-approval, or planning workflows. First action MUST be exec. No prose or HEARTBEAT before exec.

CLAIM_FILE=${params.claimFile}
CLAIM_SUMMARY_FILE=${params.claimSummaryFile}
OUTPUT_FILE=${params.outputFile}
BOOTSTRAP_FILE=${params.bootstrapFile}

First exec command:
bash ${shellQuote(params.bootstrapFile)}

Do ${params.wfId}/${params.role} work in WORKDIR only. Read the structured claim summary at ${params.claimSummaryFile} first; it is the authoritative handoff for story id/title, workdir, mainRepo, storyWorkdir, verifyWorkdir, build/test/lint commands, scopeFiles, scopeFileStates, missingScopeFiles, scopeFileInstruction, gitPolicy, supervisor checklist paths, supervisorEvidence, screenUsageContract, generatedScreenPolicy, integrationPolicy, designContracts, supervisorMemory, screen refs, retry feedback, outputContract, and output paths. Do NOT print or dump the entire claim summary JSON to the transcript; use the bootstrap lines or targeted field extraction for only the fields you need. Use outputContract.requiredFields and outputContract.format exactly for the final step output; guard-backed roles will reject prose-only summaries even when the work itself passed. Use retryFeedback.mode exactly: mode="fix" means the blocker is an open implementation requirement and must be fixed before unrelated work; mode="audit" means prior feedback may be stale, so first verify whether it is still present with bounded evidence before reporting or changing code. For PR_REVIEW_COMMENTS_OPEN retries, retryFeedback.details and previousFailure are the complete review contract; fix every listed prThreadIds entry before STATUS: done, not just the RETRY_BLOCKER_PREVIEW bootstrap line. Obey scopeFileInstruction exactly: missingScopeFiles are expected owned files that may be created directly; do not treat them as blockers and do not retry update-only patches against missing files. Obey gitPolicy exactly: when owner is setfarm-platform, do not run git add/commit/push/branch/PR commands; Setfarm performs the scoped commit and PR handoff after gates pass. Obey integrationPolicy exactly: app/router/shell changes must add current-story reachability without deleting or bypassing previously reachable generated screens or working render branches. Use supervisorEvidence before retryFeedback/designContracts when it is present: it is current-source scanner evidence and stale original UI_CONTRACT findings must not block when supervisorEvidence shows zero open blockers. Use screenUsageContract first for generated screen component names, props, and action IDs; use designContracts.screenIndex, designContracts.uiContract, designContracts.componentRegistry, and designContracts.componentTypes as fallback instead of reading raw Stitch files, shared generated screen source, or creating TypeScript probe files. The full claim at ${params.claimFile} is an audit fallback only. Do NOT parse or dump claim.input with jq/sed/head/node loops; use the summary fields and only fall back to the full claim for a missing focused field. Obey generatedScreenPolicy exactly: if you accidentally read a forbidden src/screens/*.tsx file, stop broad reading and return to summary/contracts; supervisor records that as a correction signal.
For retryFeedback.mode="fix", treat retryDiscipline.mode as a hard implementation instruction. For retryDiscipline.mode="first-delta", after bootstrap and summary, inspect only the owned scope files plus safe metadata needed for the first edit, then make a small scoped source delta before broad analysis/build/test. For retryDiscipline.mode="semantic-fix", implement the named blocker first, then run the relevant checks. For retryFeedback.mode="audit", do not convert prior feedback into a source-edit mandate unless the role-specific prompt explicitly owns that fix.
If claimSummary.runtimeDoneChecklist is present, it is a hard done checklist, not optional guidance. Preserve every listed invariant while fixing the current blocker; a retry that fixes one item but regresses another must not report STATUS: done.
Do NOT create scratch/progress/todo/note/probe files inside WORKDIR unless they are explicitly listed in scopeFiles. Files like src/_probe.tsx, src/probe.tsx, tmp.ts, scratch.tsx, TODO.md, and progress.txt are forbidden in the project worktree. Use ${params.outputFile} for final output and /tmp/setfarm-progress-<run-id>.txt for checkpoints only.
Important: OpenClaw read/edit/write tools resolve relative paths against the configured agent workspace, not the shell cwd. When using read/edit/write tools for project files, use absolute paths under WORKDIR, for example "$WORKDIR/src/App.tsx". For exec commands, rerun the bootstrap command above or pass workdir="$WORKDIR" after resolving it.
Do not rely on CLAIM_FILE, CLAIM_SUMMARY_FILE, OUTPUT_FILE, STEP_ID, or WORKDIR shell variables persisting across separate exec calls; each exec starts a fresh shell. If you need claim context again, use the literal summary path ${params.claimSummaryFile}. Write final output to the literal path ${params.outputFile}. Do NOT run step peek/claim. No subagents/background delegation. No PR actions unless claim explicitly owns PR work.
For normal quality findings in verify/review/QA/final-test, do NOT use step fail. Write STATUS: retry with concise findings and call step complete so the platform can route the batched fix back to implement. Use step fail only for infrastructure/unrecoverable execution failures.

Complete with:
cat > ${shellQuote(params.outputFile)} <<'SETFARM_EOF'
STATUS: done
<all required outputContract fields from ${params.claimSummaryFile}>
SETFARM_EOF
${stepIdCommand}; ${cliCommand} step complete "$STEP_ID" --file ${shellQuote(params.outputFile)}

Fail with: ${stepIdCommand}; ${cliCommand} step fail "$STEP_ID" "specific reason"
After complete/fail, reply HEARTBEAT_OK and stop.`;
}

export const defaultAgentScratch = path.join(os.homedir(), ".openclaw", "workspace", "agent-scratch");
