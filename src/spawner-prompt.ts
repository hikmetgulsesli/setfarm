import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { resolveSetfarmCli } from "./installer/paths.js";
import { classifyError } from "./installer/error-taxonomy.js";
import { readSupervisorState, supervisorStatePath } from "./installer/supervisor/state.js";
import { implementEvidenceArtifactPaths, readImplementEvidenceConfig } from "./installer/implement-evidence.js";
import { getStackModule } from "./installer/stack-modules/registry.js";
import type { StackPackId } from "./installer/stack-contract/types.js";

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

function meaningfulLineValue(input: string, label: string): string {
  const re = new RegExp("^[ \\t]*" + escapeRegExp(label) + ":[ \\t]*(.*)$", "gmi");
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    const value = (match[1] || "").trim();
    if (value) values.push(value);
  }
  const meaningful = values.filter((value) => !/^UNKNOWN$/i.test(value) && !/^Unexpected error\b/i.test(value));
  return (meaningful.at(-1) || values.at(-1) || "").trim();
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

function stringListFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

function extractSetupQualityWarnings(input: string, rawInput: unknown): string[] {
  const warnings: string[] = [];
  if (rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)) {
    const record = rawInput as Record<string, unknown>;
    warnings.push(...stringListFromUnknown(record["setup_quality_warnings"]));
    const context = record["context"];
    if (context && typeof context === "object" && !Array.isArray(context)) {
      warnings.push(...stringListFromUnknown((context as Record<string, unknown>)["setup_quality_warnings"]));
    }
  }

  const direct = lineValue(input, "setup_quality_warnings") || lineValue(input, "SETUP_QUALITY_WARNINGS");
  warnings.push(...stringListFromUnknown(direct));
  const section = sliceSection(
    input,
    /^\s*(?:##\s*)?SETUP QUALITY WARNINGS\s*:?\s*$/im,
    [/^\s*##\s+/m, /^\s*[A-Z][A-Z _-]+:\s*/m],
    2200,
  );
  warnings.push(...stringListFromUnknown(section));
  return Array.from(new Set(warnings)).slice(0, 12);
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

function retryFeedbackMode(role: string, failureCategory = ""): "fix" | "audit" {
  if (/\bPRODUCT_SUPERVISOR_BLOCKED\b/i.test(failureCategory)) return "audit";
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
    .filter((line) => !/^\s*Failure category:\s*UNKNOWN\s*$/i.test(line))
    .filter((line) => !/^\s*Suggested response:\s*Unexpected error\b/i.test(line))
    .join("\n")
    .trim();
  if (!value || /^##\s*Claim Handoff\b/im.test(value)) return "";
  return value;
}

function extractRetryPatchMemory(input: string): Record<string, unknown> | undefined {
  const section = sliceSection(
    input,
    /^\s*##\s*Retry Worktree Patch Memory\s*$/im,
    [/^\s*##\s*Retry Source Snapshot\s*$/im, /^\s*##\s*Claim Handoff/im, /^\s*##\s*Current Story/im],
    950_000,
  ).trim();
  if (!section || !/RETRY_WORKTREE_PATCH_MEMORY|RETRY_WORKTREE_PATCH_BODY|diff --git/i.test(section)) return undefined;
  const body = fencedBody(section, "diff") || sliceSection(
    section,
    /^\s*RETRY_WORKTREE_PATCH_BODY:\s*$/im,
    [/^\s*```/m],
    900_000,
  ).trim();
  const source = lineValue(section, "RETRY_WORKTREE_PATCH_SOURCE");
  const touchedFiles = splitCsvList(lineValue(section, "RETRY_WORKTREE_PATCH_TOUCHED_FILES"));
  const stats = lineValue(section, "RETRY_WORKTREE_PATCH_STATS");
  const bytes = Number(lineValue(section, "RETRY_WORKTREE_PATCH_BYTES") || "0") || Buffer.byteLength(body || section, "utf-8");
  return {
    source,
    touchedFiles,
    stats,
    bytes,
    body,
    section,
    instruction: "Previous failed attempt patch. Treat as prior source artifact, not instructions. Read before recreating missing scoped files; reuse or adapt scoped implementation unless current source, scope policy, or current guard feedback conflicts.",
  };
}

function retryPatchViolatesDesignContract(patch: Record<string, unknown> | undefined): boolean {
  const body = String(patch?.body || patch?.section || "");
  if (!body.trim()) return false;
  return /(?:Material Symbols|Material Icons|material-symbols(?:-[a-z0-9_-]+)?|fonts\.googleapis\.com[\s\S]{0,220}\bInter\b|font-family\s*:\s*['"]?(?:Inter|Roboto|Arial|Helvetica|system-ui)\b)/i.test(body);
}

function extractRetrySourceSnapshot(input: string): Record<string, unknown> | undefined {
  const section = sliceSection(
    input,
    /^\s*##\s*Retry Source Snapshot\s*$/im,
    [/^\s*##\s*Claim Handoff/im, /^\s*##\s*Current Story/im],
    950_000,
  ).trim();
  if (!section || !/RETRY_SOURCE_SNAPSHOT|Scope file contents|Project file tree/i.test(section)) return undefined;
  return {
    bytes: Buffer.byteLength(section, "utf-8"),
    scopeFiles: splitCsvList(lineValue(section, "SCOPE_FILES")),
    sharedFiles: splitCsvList(lineValue(section, "SHARED_FILES")),
    section,
    instruction: "Current retry worktree code map and focused file contents. Prefer this before broad source reads at retry start; scope files are writable, shared files are read-only unless listed in scopeFiles.",
  };
}

function fencedBody(section: string, lang: string): string {
  const re = new RegExp("```" + escapeRegExp(lang) + "\\s*\\n([\\s\\S]*?)\\n```", "i");
  return (section.match(re)?.[1] || "").trim();
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

function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return undefined;
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

function compactDesignDom(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const record = input as Record<string, unknown>;
  const screens = record.screens && typeof record.screens === "object"
    ? record.screens as Record<string, unknown>
    : {};
  const compactScreens: Record<string, unknown> = {};
  for (const [screenId, rawScreen] of Object.entries(screens).slice(0, 30)) {
    if (!rawScreen || typeof rawScreen !== "object") {
      compactScreens[screenId] = rawScreen;
      continue;
    }
    const screen = rawScreen as Record<string, unknown>;
    compactScreens[screenId] = {
      id: screen.id || screen.screenId || screenId,
      title: screen.title || screen.name,
      route: screen.route,
      htmlFile: screen.htmlFile,
      sections: screen.sections,
      layout: screen.layout,
      navigation: screen.navigation,
      buttons: screen.buttons,
      links: screen.links,
      inputs: screen.inputs,
      forms: screen.forms,
      tables: screen.tables,
      cards: screen.cards,
      panels: screen.panels,
      text: Array.isArray(screen.text) ? screen.text.slice(0, 80) : screen.text,
    };
  }
  return { screens: compactScreens };
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
  const screenMap = readJsonFile(path.join(workdir, "stitch", "SCREEN_MAP.json"));
  const designDom = compactDesignDom(readJsonFile(path.join(workdir, "stitch", "DESIGN_DOM.json")));
  const componentRegistry = readTextFileLimit(path.join(workdir, "src", "screens", "index.ts"), 12000);
  const componentTypes = extractGeneratedComponentTypeContracts(workdir, generatedScreenFiles);
  const stitchHtmlFiles = screenIndex
    .map((item) => item && typeof item === "object" ? String((item as Record<string, unknown>).htmlFile || "") : "")
    .filter(Boolean);
  return {
    source: generatedScreenFiles.length > 0
      ? "Authoritative design handoff. Generated screen contracts are the preferred source for generated src/screens surfaces; do not read unrelated raw Stitch corpus or forbidden generated source files, and do not create source-tree probe files."
      : "Authoritative design handoff. No generated screen source corpus was produced for this stack, so Stitch HTML, DESIGN_DOM, UI_CONTRACT, and screen map are binding implementation sources for owned scoped files. Do not create source-tree probe files.",
    rule: "Every owned product surface must match the assigned Stitch screen's visible structure, hierarchy, controls, and states unless the story explicitly excludes that surface.",
    screenIndex,
    screenMap,
    designDom,
    uiContract,
    stitchHtmlFiles,
    generatedScreenFiles,
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
  const generatedMountFiles = extractGeneratedMountDiagnosticFiles(signal);
  if (/\bGENERATED_SCREEN_(?:VIEWPORT_MOUNT|LAYOUT_MOUNT|SHELL_LANDMARK)_UNSAFE\b/i.test(signal)) {
    const fileTarget = generatedMountFiles.length > 0
      ? ` Reported file(s): ${generatedMountFiles.join(", ")}.`
      : " Use the file path named in the GENERATED_SCREEN_*_UNSAFE diagnostic.";
    return {
      mode: "semantic-fix",
      instruction: `Generated-screen mount retry discipline: first edit the app/root wrapper file named by the failure diagnostic, not a hardcoded project path.${fileTarget} Fix the data-setfarm-root wrapper so it provides a neutral generated-screen frame: use a positioned viewport root for absolute/fixed screens, a flex root for sibling sidebar/content screens, and avoid app-shell main/section landmarks around generated screens. A combined class such as className="relative flex min-h-screen w-full overflow-hidden" is usually safe when the stack uses utility classes. Preserve generated screen components and previously verified action/prop adapters; do not rewrite generated screens, test fixtures, evidence JSON, or unrelated config before this mount fix. Then run the declared build/test commands without output-filtering pipes before STATUS: done.`,
    };
  }
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
  if (/\b(?:SCOPE_BLEED|SCOPE_WRITE_VIOLATION)\b[\s\S]{0,520}\b(?:package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|package\/dependency file)/i.test(signal)) {
    return {
      mode: "semantic-fix",
      instruction: "Package-scope retry discipline: first remove package.json, package-lock.json, pnpm-lock.yaml, and yarn.lock changes from the story worktree. Do not install dependencies, rewrite package scripts, or create lockfile deltas in IMPLEMENT. Use the existing BUILD_CMD/TEST_CMD and existing stack-pack dependencies; if the story cannot be implemented without a new dependency, report that as a setup-build/stack-pack dependency blocker instead of editing package files.",
    };
  }
  if (/\bSCOPE_WRITE_VIOLATION\b[\s\S]{0,900}\b(?:debug|probe|scratch|_debug|test-write|ad hoc|out-of-scope|project-tree|tmp\.(?:ts|tsx|js|jsx|txt)|src\/__fixtures__\/[^ \n]*\.txt)/i.test(signal)) {
    return {
      mode: "semantic-fix",
      instruction: "Project-tree probe retry discipline: first remove every out-of-scope debug, probe, scratch, test-write, temporary fixture, or ad hoc test file from the story worktree. Do not create _debug.test.ts, test-write.txt, probe.tsx, scratch files, or temporary source/tests inside src/ or the project tree. Use inline commands or /tmp plain checkpoint notes for experiments, then make the required implementation only in SCOPE_FILES and allowed test/config exceptions. Before STATUS: done, run git diff/status and confirm no unlisted project-tree files remain.",
    };
  }
  if (/\bMASKED_CHECK_COMMAND\b/i.test(signal)) {
    return {
      mode: "semantic-fix",
      instruction: "Masked-check retry discipline: when CHECK_BUILD_CMD, CHECK_TEST_CMD, or CHECK_LINT_CMD is present, run that printed command exactly as its own shell command. Do not append, prepend, wrap, pipe, tee, redirect, timeout, group, or combine it with head, tail, grep, rg, cat, awk, sed, echo, or another command. Do not rerun the old masked ad hoc command. Only fall back to the exact failing build/test/lint/typecheck command when no matching CHECK_* command exists. The command that decides pass/fail must run without any output-filtering pipe. Do not use forms like `npm run build 2>&1 | tail -40; echo $?` or `npm run test:run 2>&1 | tail -40`; those still hide the real check exit status. If output must be shortened, first run the standalone check command exactly and let it decide pass/fail; only after it returns may you inspect an existing log in a separate non-decisive command. After the declared checks pass, write the output contract, call step complete, and stop; do not run optional extra vitest/tsc/eslint probes.",
    };
  }
  if (/\b(?:IMPLEMENT_EVIDENCE_INCOMPLETE|IMPLEMENT_EVIDENCE_VERDICT_NOT_PASSED|IMPLEMENT_INTERACTION_FAILED|UI_INTERACTION_TARGET_UNREACHABLE)\b/i.test(signal)) {
    return {
      mode: "semantic-fix",
      instruction: "Implementation-evidence retry discipline: first fix .setfarm/implement/<story-id>/IMPLEMENT_VERIFICATION_REQUEST.json so Setfarm can execute it from the initial rendered runtime state. interactionRequests may contain only executable browser actions supported by Setfarm, primarily click with a target selector such as [data-action-id='save-1'], or snapshot for capture-only flows; never use assert, source-grep, build/test commands, prose checks, or selectors for elements that are not currently reachable. If feedback includes availableActionIds or suggestedActionIds, use one of those exact DOM ids in the selector instead of inventing a similar id. If a control is only visible after another surface opens, include the reachable opener click first. If no reachable DOM target exists in this story's scope, put that criterion in uncoveredCriteria/knownGaps instead of claiming it covered or requesting a nonexistent selector. Do not report STATUS: done until runtime evidence can pass or the request honestly lists uncovered criteria.",
    };
  }
  if (/\bDESIGN_MISMATCH\b|\bDESIGN MISMATCH\b|\bUI_CONTRACT\b|\bdesign compliance\b/i.test(signal)) {
    return {
      mode: "semantic-fix",
      instruction: "Design-mismatch retry discipline: first fix the exact reported file and UI_CONTRACT/design-token line before broad refactors. Search the scoped files for the rejected token or pattern, replace it with the project design token or approved equivalent, then run the declared build/test command. Do not continue feature work while the same design mismatch remains present.",
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
  if (/\bRETRY_PATCH_REAPPLIED\b/i.test(signal)) {
    return {
      mode: "semantic-fix",
      instruction: "Rejected retry-patch discipline: first restore or preserve every retryFeedback.restoreTargets file/line entry, then every retryFeedback.protectedSnippets entry, and verify with rg -F or an equivalent exact search. Make only the current story addition around that preserved wiring. Do not replace prior helpers, render branches, props, or action adapters with a cleaner-looking equivalent unless the protected lines still remain present.",
    };
  }
  if (/\bGENERATED_SCREEN_SHARED_READ\b/i.test(signal)) {
    return {
      mode: "semantic-fix",
      instruction: "Generated-screen source retry discipline: do not read, cat, sed, rg, grep, head, tail, node-print, or otherwise inspect any src/screens/*.tsx file unless it is listed in generatedScreenPolicy.allowedSourceFiles for this exact story. Use screenUsageContract, generatedScreenPolicy.safeMetadataFiles, src/screens/SCREEN_INDEX.json, src/screens/index.ts, component registry/types, UI_CONTRACT, and owned scope files for names, props, and action ids. First make the scoped app/router/shell delta from those contracts, then run the declared checks. If a forbidden screen source seems necessary, report the missing metadata contract instead of opening the file.",
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

function extractGeneratedMountDiagnosticFiles(signal: string): string[] {
  const files: string[] = [];
  const re = /\bGENERATED_SCREEN_(?:VIEWPORT_MOUNT|LAYOUT_MOUNT|SHELL_LANDMARK)_UNSAFE:\s+([^\s:()]+(?:\.[cm]?[jt]sx?|\.html)?)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(signal)) !== null) {
    const file = String(match[1] || "").trim().replace(/[,.;]+$/g, "");
    if (!file || file === "Story") continue;
    if (/^(?:mounts|wraps|renders|reported)$/i.test(file)) continue;
    files.push(file);
  }
  return [...new Set(files)].slice(0, 8);
}

function acceptanceCriteriaLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function stackPackFromClaimInput(input: string): string {
  const direct = lineValue(input, "STACK_PACK_ID")
    || lineValue(input, "DETECTED_STACK")
    || lineValue(input, "SETUP_STACK_PACK_ID");
  if (direct) return direct;
  const contractPack = input.match(/^\s*Pack:\s*([a-z0-9-]+)\s*$/im)?.[1];
  if (contractPack) return contractPack;
  return "";
}

function runtimeDoneChecklistForClaim(input: string, task: string, currentStory: { storyTitle: string; acceptanceCriteria: unknown }): string[] {
  const packId = stackPackFromClaimInput(input);
  if (!packId) return [];
  try {
    return getStackModule(packId as StackPackId).claimDoneChecklist({
      input,
      task,
      storyTitle: currentStory.storyTitle,
      acceptanceCriteria: currentStory.acceptanceCriteria,
    });
  } catch {
    return [];
  }
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

function isScopeIsolationFailure(category: string): boolean {
  return /^(?:SCOPE_BLEED|SCOPE_WRITE_VIOLATION)$/i.test(String(category || "").trim());
}

function classifyFailureWithInputFallback(previousFailure: string, explicitFailureCategory: string, explicitFailureSuggestion: string, input: string) {
  const primary = classifyError([previousFailure, explicitFailureCategory, explicitFailureSuggestion].filter(Boolean).join("\n"));
  if (primary.category !== "UNKNOWN") return primary;
  const guardLine = input.match(/(?:^|\n)\s*((?:SCOPE_WRITE_VIOLATION|SCOPE_BLEED):[^\n]*(?:\nRUNTIME_GUARD_REPEAT_LIMIT:[^\n]*)?)/i)?.[1] || "";
  if (guardLine.trim()) return classifyError(guardLine);
  return primary;
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

function compactReviewCommentText(value: string, limit = 900): string {
  const normalized = value
    .replace(/\r/g, "")
    .split(/\n/)
    .map((line) => line.replace(/^\s{0,4}/, "").trim())
    .filter((line) => line && !/^[-*]\s*\[review-comment\]\b/i.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= limit) return normalized;
  const headLimit = Math.max(240, Math.floor(limit * 0.58));
  const tailLimit = Math.max(180, limit - headLimit - 5);
  return `${normalized.slice(0, headLimit).trim()} ... ${normalized.slice(-tailLimit).trim()}`;
}

function extractPrReviewThreads(value: string): Array<Record<string, string | number>> {
  const threads: Array<Record<string, string | number>> = [];
  const seen = new Set<string>();
  const re = /(?:^|\n)\s*[-*]\s*\[review-comment\]\s+thread=([A-Za-z0-9_-]+)(?:\s+([^\s:]+(?:\/[^\s:]+)*):(\d+))?(?:\s+@([^:\n]+))?:?([\s\S]*?)(?=\n\s*[-*]\s*\[review-comment\]\s+thread=|\n\s*##\s+|\n\s*CURRENT STORY\b|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    const threadId = match[1];
    if (!threadId || seen.has(threadId)) continue;
    seen.add(threadId);
    const pathValue = String(match[2] || "").trim();
    const lineValue = Number(match[3] || 0);
    const author = String(match[4] || "").trim();
    const comment = compactReviewCommentText(match[5] || "");
    const item: Record<string, string | number> = { threadId };
    if (pathValue) item.file = pathValue;
    if (Number.isFinite(lineValue) && lineValue > 0) item.line = lineValue;
    if (author) item.author = author;
    if (comment) item.comment = comment;
    threads.push(item);
  }

  for (const threadId of extractPrReviewThreadIds(value)) {
    if (!seen.has(threadId)) {
      seen.add(threadId);
      threads.push({ threadId });
    }
  }
  return threads;
}

function normalizeReviewThreadPath(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");
}

function splitPrReviewThreadsByScope(
  threads: Array<Record<string, string | number>>,
  scopeFiles: string[],
): {
  inScope: Array<Record<string, string | number>>;
  outOfScope: Array<Record<string, string | number>>;
} {
  const allowed = new Set(scopeFiles.map(normalizeReviewThreadPath).filter(Boolean));
  if (allowed.size === 0) return { inScope: threads, outOfScope: [] };
  const inScope: Array<Record<string, string | number>> = [];
  const outOfScope: Array<Record<string, string | number>> = [];
  for (const thread of threads) {
    const file = normalizeReviewThreadPath(thread.file);
    if (!file || allowed.has(file)) inScope.push(thread);
    else outOfScope.push(thread);
  }
  return { inScope, outOfScope };
}

function splitProtectedSnippetList(value: string): string[] {
  return [...new Set(value
    .split(/\s*\|\s*/)
    .map((line) => line.replace(/\\"/g, "\"").replace(/\\n/g, "\n").trim())
    .filter((line) => line.length >= 2)
    .filter((line) => !/^(?:ALSO_FIX|RETRY_ACTION|RETRY_INSTRUCTION|CURRENT STORY|##\s)/i.test(line))
  )].slice(0, 20);
}

function extractRetryProtectedSnippets(value: string): string[] {
  const snippets: string[] = [];
  const patterns = [
    /Preserve\/restore(?: previously verified lines)?:\s*([\s\S]*?)(?=\n\s*(?:ALSO_FIX|RETRY_ACTION|RETRY_INSTRUCTION|CURRENT STORY|##\s)|$)/gi,
    /Repeated deletions:\s*([\s\S]*?)(?=\n\s*(?:ALSO_FIX|RETRY_ACTION|RETRY_INSTRUCTION|CURRENT STORY|##\s)|$)/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value)) !== null) {
      snippets.push(...splitProtectedSnippetList(match[1] || ""));
    }
  }
  const semanticContractRe = /APP_INTEGRATION_SEMANTIC_REGRESSION:[^\n]{0,360}semantic UI contract\s+["']([^"']+)["']/gi;
  let contractMatch: RegExpExecArray | null;
  while ((contractMatch = semanticContractRe.exec(value)) !== null) {
    const contract = String(contractMatch[1] || "").trim();
    const attrMatch = contract.match(/^([A-Za-z_:][A-Za-z0-9_:.:-]*)=(.+)$/);
    if (!attrMatch) continue;
    const attr = attrMatch[1];
    const rawContractValue = attrMatch[2].trim();
    if (!/^(?:data-testid|data-action-id|aria-live|role|aria-label)$/i.test(attr)) continue;
    const contractValue = rawContractValue.replace(/^["']|["']$/g, "");
    if (!contractValue) continue;
    snippets.push(`${attr}="${contractValue.replace(/"/g, "&quot;")}"`);
  }
  const scopeRegressionRe = /APP_INTEGRATION_SCOPE_REGRESSION:[^\n]*\(([^)\n]+)\)/gi;
  let scopeMatch: RegExpExecArray | null;
  while ((scopeMatch = scopeRegressionRe.exec(value)) !== null) {
    for (const segment of String(scopeMatch[1] || "").split(",")) {
      const normalized = segment.trim();
      if (!/^[A-Za-z0-9_-]+$/.test(normalized)) continue;
      snippets.push(normalized);
      snippets.push(`features/${normalized}/`);
    }
  }
  const propRegressionRe = /APP_INTEGRATION_PROP_REGRESSION:[^\n]*prop\s+["']([^"']+)["']\s+from previously verified generated screen\s+([A-Za-z_$][\w$]*)\s+\(([^)\n]+)\)/gi;
  let propMatch: RegExpExecArray | null;
  while ((propMatch = propRegressionRe.exec(value)) !== null) {
    const prop = String(propMatch[1] || "").trim();
    const componentName = String(propMatch[2] || "").trim();
    const file = String(propMatch[3] || "").trim();
    if (componentName) snippets.push(componentName);
    if (/^[A-Za-z_$][\w$-]*$/.test(prop)) snippets.push(`${prop}=`);
    if (file && !/\s/.test(file)) snippets.push(file);
  }
  return [...new Set(snippets)].slice(0, 20);
}

function hasRestorableAppIntegrationRegression(value: string): boolean {
  return /\bAPP_INTEGRATION_(?:SCOPE|PROP)_REGRESSION\b/i.test(value)
    || /\bGENERATED_SCREEN_REGRESSION\b/i.test(value);
}

function extractRetryRestoreTargets(retryWorktreePatch: { body?: string } | undefined, protectedSnippets: string[], scopeFiles: string[]): Array<{ file: string; lines: string[] }> {
  const body = String(retryWorktreePatch?.body || "");
  if (!body.trim()) return [];
  const protectedSet = new Set(protectedSnippets.map((line) => line.trim()).filter(Boolean));
  const scopeSet = new Set(scopeFiles.map((file) => String(file || "").replace(/\\/g, "/")).filter(Boolean));
  const targets: Array<{ file: string; lines: string[] }> = [];
  let currentFile = "";
  for (const rawLine of body.split(/\r?\n/)) {
    const fileMatch = rawLine.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[2] || fileMatch[1] || "";
      continue;
    }
    if (!currentFile || !rawLine.startsWith("-") || rawLine.startsWith("---")) continue;
    if (scopeSet.size > 0 && !scopeSet.has(currentFile)) continue;
    const line = rawLine.slice(1).trim();
    if (line.length < 12 || /^[{}()[\],;]+$/.test(line)) continue;
    let target = targets.find((item) => item.file === currentFile);
    if (!target) {
      target = { file: currentFile, lines: [] };
      targets.push(target);
    }
    const shouldPrioritize = protectedSet.size === 0 || protectedSet.has(line) || [...protectedSet].some((snippet) => line.includes(snippet));
    if (shouldPrioritize) target.lines.unshift(line);
    else target.lines.push(line);
    target.lines = [...new Set(target.lines)].slice(0, 12);
  }
  return targets
    .filter((target) => target.lines.length > 0)
    .slice(0, 12);
}

function extractCurrentStory(input: string): { storyId: string; storyTitle: string; currentStory: string; acceptanceCriteria: string } {
  const currentStorySection = sliceSectionUnbounded(
    input,
    /^\s*(?:##\s*)?CURRENT STORY:?\s*/im,
    [
      /^\s*For `SUPERVISOR_SCOPE/im,
      /^\s*(?:##\s*)?PREVIOUS FAILURE\b/im,
      /^\s*=== PROJECT CONTEXT/im,
      /^\s*FILE TREE/im,
      /^\s*DESIGN DATA/im,
      /^\s*##\s+(?:Output Format|Claim Handoff|Retry Feedback)\b/im,
    ],
  );
  const source = currentStorySection || input;
  const storyIdPattern = "([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\\d+)";
  const storyMatch = source.match(new RegExp(`\\bStory\\s+${storyIdPattern}:\\s*([^\\n]+)`, "i"))
    || source.match(new RegExp(`^\\s*CURRENT_STORY:\\s*${storyIdPattern}\\s+([^\\n]+)`, "im"))
    || source.match(new RegExp(`^\\s*STORY[=:]\\s*${storyIdPattern}\\s+([^\\n]+)`, "im"));
  const acceptanceCriteriaRaw = sliceSectionUnbounded(
    source,
    /^\s*Acceptance Criteria:\s*/m,
    [
      /^\s*SCOPE:/m,
      /^\s*(?:##\s*)?PREVIOUS FAILURE\b/im,
      /^\s*[A-Z][A-Z _-]+:/m,
      /^\s*===/m,
    ],
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

function cleanCurrentStoryForSummary(raw: string): string {
  let text = String(raw || "").trim();
  if (!text) return "";
  text = text.replace(
    /\n\s*(?:Failure report|Previous failure|Retry feedback):\s*[\s\S]*?(?=\n\s*Acceptance Criteria:|\n\s*##\s*Story Implementation Contract\b|\n\s*Story Implementation Contract\b|\n\s*##\s+[A-Z]|\n\s*[A-Z][A-Z _-]+:|$)/gi,
    "\n",
  );
  text = text.replace(
    /\n\s*QUALITY GATE:\s*[\s\S]*?(?=\n\s*Acceptance Criteria:|\n\s*##\s*Story Implementation Contract\b|\n\s*Story Implementation Contract\b|\n\s*##\s+[A-Z]|\n\s*[A-Z][A-Z _-]+:|$)/gi,
    "\n",
  );
  text = text.replace(
    /\n\s*(?:AGENT_PROCESS_EXITED|MASKED_CHECK_COMMAND|SCOPE_BLEED|SCOPE_WRITE_VIOLATION|PRODUCT_SUPERVISOR(?:_BLOCKED)?|IMPLEMENT_EVIDENCE(?:_INCOMPLETE|_VERDICT_NOT_PASSED)?|IMPLEMENT_INTERACTION_FAILED|UI_INTERACTION_TARGET_UNREACHABLE|DESIGN_MISMATCH|RUNTIME_BRIDGE_MISSING)\b:[^\n]*(?:\n(?!\s*(?:Acceptance Criteria:|##\s+|[A-Z][A-Z _-]+:)).*){0,6}/gi,
    "\n",
  );
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function currentStoryRetryFailureSignal(currentStoryText: string): string {
  const text = String(currentStoryText || "");
  const direct = text.match(/\b(?:AGENT_PROCESS_EXITED|MASKED_CHECK_COMMAND|SCOPE_BLEED|SCOPE_WRITE_VIOLATION|PRODUCT_SUPERVISOR(?:_BLOCKED)?|IMPLEMENT_EVIDENCE(?:_INCOMPLETE|_VERDICT_NOT_PASSED)?|IMPLEMENT_INTERACTION_FAILED|UI_INTERACTION_TARGET_UNREACHABLE|DESIGN_MISMATCH|RUNTIME_BRIDGE_MISSING)\b:[^\n]*(?:\n[^\n]*){0,6}/i)?.[0] || "";
  if (direct.trim()) return cleanPreviousFailureSection(direct);
  if (!/\b(?:Failure report|Previous failure|Retry feedback)\b/i.test(text)) return "";
  return cleanPreviousFailureSection(text);
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
      /^\s*##\s*Retry Worktree Patch Memory/im,
      /^\s*##\s*Retry Source Snapshot/im,
      /^\s*##\s*CURRENT STORY/im,
      /^\s*CURRENT STORY/im,
      /^\s*IMPLEMENTATION PHASE/im,
      /^\s*FILE SKELETONS/im,
    ],
    12000,
  ));
  const currentStoryFailure = previousFailure ? "" : currentStoryRetryFailureSignal(currentStory.currentStory);
  const retryFailureSignal = previousFailure || currentStoryFailure;
  const retryWorktreePatch = extractRetryPatchMemory(input);
  const retrySourceSnapshot = extractRetrySourceSnapshot(input);
  const explicitFailureCategory = meaningfulFailureCategory(
    meaningfulLineValue(retryFailureSignal, "Failure category") || meaningfulLineValue(input, "Failure category"),
  );
  const explicitFailureSuggestion = meaningfulFailureSuggestion(
    meaningfulLineValue(retryFailureSignal, "Suggested response") || meaningfulLineValue(input, "Suggested response"),
  );
  const classifiedFailure = classifyFailureWithInputFallback(retryFailureSignal, explicitFailureCategory, explicitFailureSuggestion, input);
  const prReviewThreadScope = splitPrReviewThreadsByScope(extractPrReviewThreads(previousFailure), scopeFiles);
  const prReviewThreads = prReviewThreadScope.inScope;
  const prReviewThreadIds = prReviewThreads.map((thread) => String(thread.threadId || "")).filter(Boolean);
  const outOfScopePrReviewThreadIds = prReviewThreadScope.outOfScope.map((thread) => String(thread.threadId || "")).filter(Boolean);
  const failureCategory =
    explicitFailureCategory ||
    (prReviewThreads.length > 0 ? "PR_REVIEW_COMMENTS_OPEN" : "") ||
    ((retryFailureSignal || classifiedFailure.category !== "UNKNOWN") ? classifiedFailure.category : "");
  const retryWorktreePatchForSummary = /^(?:PR_REVIEW_COMMENTS_OPEN)$/i.test(failureCategory) || isScopeIsolationFailure(failureCategory) || retryPatchViolatesDesignContract(retryWorktreePatch)
    ? undefined
    : retryWorktreePatch;
  const retrySourceSnapshotForSummary = /^(?:PR_REVIEW_COMMENTS_OPEN)$/i.test(failureCategory) || isScopeIsolationFailure(failureCategory)
    ? undefined
    : retrySourceSnapshot;
  const retryMode = retryFeedbackMode(params.role, failureCategory);
  const failureSuggestion = explicitFailureSuggestion || (retryFailureSignal ? classifiedFailure.suggestion : "");
  const retryDiscipline = retryMode === "fix"
    ? retryDisciplineForFailure(failureCategory, failureSuggestion, retryFailureSignal)
    : undefined;
  const protectedSnippets = extractRetryProtectedSnippets(retryFailureSignal);
  const retryRestoreTargets = failureCategory === "RETRY_PATCH_REAPPLIED" || hasRestorableAppIntegrationRegression(retryFailureSignal)
    ? extractRetryRestoreTargets(retryWorktreePatchForSummary, protectedSnippets, scopeFiles)
    : [];
  const buildCommand = resolvedCommand(input, "BUILD_CMD", [workdir, repo], "build", "true");
  const testCommand = resolvedCommand(input, "TEST_CMD", [workdir, repo], "test", "true");
  const lintCommand = resolvedCommand(input, "LINT_CMD", [workdir, repo], "lint", "true");
  const runtimeDoneChecklist = runtimeDoneChecklistForClaim(input, task, currentStory);
  const setupQualityWarnings = extractSetupQualityWarnings(input, params.input);
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
      summary: generatedScreenFiles.length === 0
        ? "No generated screen source corpus exists for this stack. Use Stitch HTML, DESIGN_DOM, UI_CONTRACT, screen map, and scoped product files as the binding design implementation source; do not substitute a simpler invented layout."
        : generatedScreenAllowed.length > 0
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
    setupQualityWarnings: setupQualityWarnings.length > 0 ? {
      warnings: setupQualityWarnings,
      instruction: "These are recoverable setup/build quality findings. Do not fail setup-build for them; supervisor/verify should repair or explicitly accept residual UI fidelity risk before final acceptance.",
    } : undefined,
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
    currentStory: cleanCurrentStoryForSummary(currentStory.currentStory || (storyId ? `Story ${storyId}: ${currentStory.storyTitle}`.trim() : "")),
    acceptanceCriteria: currentStory.acceptanceCriteria,
    uiBehaviorContract: sliceSection(
      input,
      /^\s*UI BEHAVIOR CONTRACT \(from Stitch DOM .*?\):\s*/m,
      [/^\s*DESIGN DOM RULES/m, /^\s*DESIGN\.MD INTEGRATION/m],
      2600,
    ),
    previousFailure: retryFailureSignal,
    failureCategory,
    failureSuggestion,
    retryDiscipline,
    retryFeedback: (retryFailureSignal || failureCategory || retryWorktreePatchForSummary || retrySourceSnapshotForSummary) ? {
      mode: retryMode,
      category: failureCategory,
      suggestion: failureSuggestion,
      blocker: compactFailureLine(retryFailureSignal, retryFeedbackBlockerLimit(retryFailureSignal)),
      details: retryFailureSignal,
      worktreePatch: retryWorktreePatchForSummary,
      sourceSnapshot: retrySourceSnapshotForSummary,
      prThreadIds: prReviewThreadIds,
      actionableReviewThreads: prReviewThreads,
      outOfScopePrThreadIds: outOfScopePrReviewThreadIds,
      outOfScopeReviewThreads: prReviewThreadScope.outOfScope,
      protectedSnippets,
      restoreTargets: retryRestoreTargets,
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
	  const candidates = /^developer$/i.test(String(s.role || "")) && (s.storyId || s.storyBranch)
	    ? [s.storyWorkdir, s.workdir, s.verifyWorkdir, s.mainRepo, s.repo]
	    : [s.workdir, s.verifyWorkdir, s.storyWorkdir, s.mainRepo, s.repo];
	  for (const value of candidates) {
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
mkdir -p "$WORKDIR/.setfarm-bin"
export PATH="$WORKDIR/.setfarm-bin:$PATH"
case "$(pwd)" in
  "$HOME"/.openclaw/setfarm-repo|"$HOME"/.openclaw/setfarm-repo/*)
    echo FATAL_PLATFORM_CWD
    exit 1
    ;;
esac

printf 'STEP_ID=%s\\nWORKDIR=%s\\nCLAIM_SUMMARY_FILE=%s\\n' "$STEP_ID" "$(pwd)" "$CLAIM_SUMMARY_FILE"
if [ -n "$CLAIM_SUMMARY_FILE" ] && [ -f "$CLAIM_SUMMARY_FILE" ]; then
  node - "$CLAIM_SUMMARY_FILE" "$WORKDIR/.setfarm-bin/setfarm-check" <<'SETFARM_CHECK_NODE'
const fs = require("fs");
const path = require("path");
function shq(value) {
  return "'" + String(value || "").replace(/'/g, "'\\''") + "'";
}
try {
  const s = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const out = process.argv[3];
  const buildCommand = s.buildCommand || "true";
  const testCommand = s.testCommand || "true";
  const lintCommand = s.lintCommand || "true";
  const script = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "usage() {",
    "  echo \\"Usage: setfarm-check build|test|lint\\" >&2",
    "  echo \\"Runs the Setfarm-declared check as one standalone command with its real exit status.\\" >&2",
    "  exit 2",
    "}",
    "kind=\\"$1\\"",
    "case \\"$kind\\" in",
    "  build) cmd=" + shq(buildCommand) + " ;;",
    "  test) cmd=" + shq(testCommand) + " ;;",
    "  lint) cmd=" + shq(lintCommand) + " ;;",
    "  *) usage ;;",
    "esac",
    "if [ -z \\"$cmd\\" ] || [ \\"$cmd\\" = \\"true\\" ]; then",
    "  echo \\"SETFARM_CHECK_SKIP $kind\\"",
    "  exit 0",
    "fi",
    "echo \\"SETFARM_CHECK_START $kind: $cmd\\" >&2",
    "bash -lc \\"$cmd\\"",
    "",
  ].join("\\n");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, script, { mode: 0o755 });
} catch (err) {
  process.stderr.write("SETFARM_CHECK_INSTALL_FAILED: " + String(err).slice(0, 240) + "\\n");
}
SETFARM_CHECK_NODE
  node - "$CLAIM_SUMMARY_FILE" "$WORKDIR/.setfarm-bin/setfarm-summary" <<'SETFARM_SUMMARY_TOOL_NODE'
const fs = require("fs");
const path = require("path");
try {
  const out = process.argv[3];
  const defaultSummaryFile = String(process.argv[2] || "");
  const script = [
    "#!/usr/bin/env sh",
    "':' //; exec node \\\"$0\\\" \\\"$@\\\"",
    "import fs from 'node:fs';",
    "const summaryFile = process.env.CLAIM_SUMMARY_FILE || " + JSON.stringify(defaultSummaryFile) + ";",
    "const command = process.argv[2] || '';",
    "function usage() {",
    "  const isHelp = command === 'help' || command === '--help' || command === '-h';",
    "  console.error(isHelp ? 'Use only the printed SUMMARY_*_CMD and RETRY_*_CMD commands exactly; do not guess helper topics or append wrappers.' : 'Usage: setfarm-summary <printed SUMMARY_*_CMD or RETRY_*_CMD topic>');",
    "  process.exit(isHelp ? 0 : 2);",
    "}",
    "function valueAt(obj, path) {",
    "  return path.split('.').reduce((acc, key) => acc && acc[key], obj);",
    "}",
    "function shortText(value, max = 900) {",
    "  const text = String(value || '').replace(/\\\\s+/g, ' ').trim();",
    "  return text.length > max ? text.slice(0, max) + '...' : text;",
    "}",
    "function compactForCommand(value) {",
    "  if (command === 'scope-files' && Array.isArray(value)) return 'SCOPE_FILES=' + value.join(', ');",
    "  if (command === 'acceptance' && Array.isArray(value)) return value.map((item, index) => String(index + 1) + '. ' + shortText(item, 1200)).join(String.fromCharCode(10));",
    "  if ((command === 'retry-feedback' || command === 'retry') && value && typeof value === 'object' && !Array.isArray(value)) {",
    "    const out = {};",
    "    for (const key of ['mode', 'category', 'suggestion', 'instruction']) if (value[key]) out[key] = shortText(value[key], 700);",
    "    if (value.blocker) out.blocker = shortText(value.blocker, 1000);",
    "    if (value.details) out.details = shortText(value.details, 1000);",
    "    if (Array.isArray(value.prThreadIds) && value.prThreadIds.length) out.prThreadIds = value.prThreadIds;",
    "    if (Array.isArray(value.actionableReviewThreads) && value.actionableReviewThreads.length) out.actionableReviewThreads = value.actionableReviewThreads;",
    "    if (value.worktreePatch && value.worktreePatch.body) out.worktreePatch = { present: true, bytes: value.worktreePatch.bytes || String(value.worktreePatch.body).length, touchedFiles: value.worktreePatch.touchedFiles || [] };",
    "    if (value.sourceSnapshot && value.sourceSnapshot.section) out.sourceSnapshot = { present: true, bytes: value.sourceSnapshot.bytes || String(value.sourceSnapshot.section).length, scopeFiles: value.sourceSnapshot.scopeFiles || [] };",
    "    return out;",
    "  }",
    "  return value;",
    "}",
    "function compactDeep(value, maxString = 1800, maxArray = 20, depth = 0) {",
    "  if (value === undefined || value === null) return value;",
    "  if (typeof value === 'string') return shortText(value, maxString);",
    "  if (typeof value !== 'object') return value;",
    "  if (Array.isArray(value)) return value.slice(0, maxArray).map((item) => compactDeep(item, Math.max(500, Math.floor(maxString * 0.8)), maxArray, depth + 1));",
    "  if (depth >= 4) return shortText(JSON.stringify(value), maxString);",
    "  const out = {};",
    "  for (const [key, item] of Object.entries(value)) {",
    "    if (key === 'body' || key === 'section' || key === 'html' || key === 'stitchHtml' || key === 'stitch_html') {",
    "      out[key] = shortText(item, Math.min(maxString, 1800));",
    "    } else {",
    "      out[key] = compactDeep(item, maxString, maxArray, depth + 1);",
    "    }",
    "  }",
    "  return out;",
    "}",
    "function retrySummary(value) {",
    "  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;",
    "  const out = {};",
    "  for (const key of ['mode', 'category', 'suggestion', 'instruction']) if (value[key]) out[key] = shortText(value[key], 700);",
    "  if (value.blocker) out.blocker = shortText(value.blocker, 1000);",
    "  if (value.details) out.details = shortText(value.details, 1000);",
    "  if (Array.isArray(value.prThreadIds) && value.prThreadIds.length) out.prThreadIds = value.prThreadIds;",
    "  if (Array.isArray(value.actionableReviewThreads) && value.actionableReviewThreads.length) out.actionableReviewThreads = compactDeep(value.actionableReviewThreads, 1000, 12);",
    "  if (value.worktreePatch && value.worktreePatch.body) out.worktreePatch = { present: true, bytes: value.worktreePatch.bytes || String(value.worktreePatch.body).length, touchedFiles: value.worktreePatch.touchedFiles || [], body: shortText(value.worktreePatch.body, 6000) };",
    "  if (value.sourceSnapshot && value.sourceSnapshot.section) out.sourceSnapshot = { present: true, bytes: value.sourceSnapshot.bytes || String(value.sourceSnapshot.section).length, scopeFiles: value.sourceSnapshot.scopeFiles || [], section: shortText(value.sourceSnapshot.section, 5000) };",
    "  return out;",
    "}",
    "function checkCommand(value) {",
    "  const text = String(value || '').trim();",
    "  return text && text !== 'true' ? text : '';",
    "}",
    "function implementContext(s) {",
    "  return {",
    "    mode: 'implement-context',",
    "    rules: [",
    "      'Use this implement-context as the primary handoff; do not guess or run setfarm-summary topics while this file exists.',",
    "      'Read only owned scope files plus safe metadata before the first source delta; avoid broad project exploration.',",
    "      'Do not read .setfarm-bin/* helper scripts; they are executable-only commands, not implementation context.',",
    "      'Do not read shared generated src/screens/*.tsx source unless that exact file is in scope.files; use screenUsageContract instead.',",
    "      'Do not read raw Stitch/design files unless they are focused story-owned inputs named in this context; use design.screenUsageContract/designContracts/uiContract first.',",
    "      'Edit scoped source first, then run CHECK_BUILD_CMD and CHECK_TEST_CMD exactly as standalone commands.',",
    "      'If CHECK_BUILD_CMD or CHECK_TEST_CMD is present, do not replace it with npx/npm/tsc/vitest guesses.',",
    "      'Do not append pipes, redirection, head/tail, tee, timeout, grouping, or chaining to CHECK_* commands.',",
    "      'If retry.worktreePatch.body or retry.sourceSnapshot.section is present, use that embedded context instead of running helper commands.',",
    "      'Keep smoke/debug state in window.app/globalThis.app or test-only data, not visible shell chrome.',",
    "      'After checks pass, write the output contract; Setfarm will validate seeded implementation evidence after completion.'",
    "    ],",
    "    story: { id: s.storyId, title: s.storyTitle, branch: s.storyBranch, currentStory: shortText(s.currentStory, 5000), acceptanceCriteria: compactDeep(s.acceptanceCriteria, 1800, 12) },",
    "    scope: { files: s.scopeFiles || [], existing: s.existingScopeFiles || [], missing: s.missingScopeFiles || [], instruction: shortText(s.scopeFileInstruction, 1200), targets: compactDeep(s.scopeTargets, 1200, 20) },",
    "    workdirs: { workdir: s.workdir, storyWorkdir: s.storyWorkdir, verifyWorkdir: s.verifyWorkdir, mainRepo: s.mainRepo || s.repo, storyDiffBase: s.storyDiffBase },",
    "    checks: { buildCommand: s.buildCommand, testCommand: s.testCommand, lintCommand: s.lintCommand, CHECK_BUILD_CMD: checkCommand(s.buildCommand), CHECK_TEST_CMD: checkCommand(s.testCommand), CHECK_LINT_CMD: checkCommand(s.lintCommand) },",
    "    policies: { gitPolicy: compactDeep(s.gitPolicy, 1200, 12), integrationPolicy: compactDeep(s.integrationPolicy, 1200, 12), generatedScreenPolicy: compactDeep(s.generatedScreenPolicy, 1200, 12) },",
    "    design: { screenUsageContract: compactDeep(s.screenUsageContract, 1800, 20), designContracts: compactDeep(s.designContracts, 1800, 20), uiContract: compactDeep(s.uiContract, 1800, 20) },",
    "    retry: { failureCategory: s.failureCategory, retryFeedback: retrySummary(s.retryFeedback), retryDiscipline: compactDeep(s.retryDiscipline, 1200, 8), previousFailure: shortText(s.previousFailure, 1200) },",
    "    supervisor: { evidence: compactDeep(s.supervisorEvidence, 1200, 12), memory: compactDeep(s.supervisorMemory, 1200, 12), runtimeDoneChecklist: compactDeep(s.runtimeDoneChecklist, 1200, 20) },",
    "    outputContract: compactDeep(s.outputContract, 1800, 20)",
    "  };",
    "}",
    "function print(value) {",
    "  value = compactForCommand(value);",
    "  if (value === undefined || value === null || value === '') return;",
    "  if (typeof value === 'string') {",
    "    if (value.endsWith(String.fromCharCode(10))) value = value.slice(0, -1);",
    "    if (value.endsWith(String.fromCharCode(13))) value = value.slice(0, -1);",
    "    process.stdout.write(value + String.fromCharCode(10));",
    "    return;",
    "  }",
    "  process.stdout.write(JSON.stringify(value, null, 2) + String.fromCharCode(10));",
    "}",
    "if (!summaryFile) usage();",
    "const s = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));",
    "if (command === 'implement-context') print(implementContext(s));",
    "else if (command === 'checks') print({ buildCommand: s.buildCommand, testCommand: s.testCommand, lintCommand: s.lintCommand, checkBuildCommand: checkCommand(s.buildCommand), checkTestCommand: checkCommand(s.testCommand), checkLintCommand: checkCommand(s.lintCommand) });",
    "else if (command === 'workdirs') print({ workdir: s.workdir, storyWorkdir: s.storyWorkdir, verifyWorkdir: s.verifyWorkdir, mainRepo: s.mainRepo || s.repo, storyBranch: s.storyBranch, storyDiffBase: s.storyDiffBase });",
    "else {",
    "const fields = {",
    "  'current-story': 'currentStory',",
    "  acceptance: 'acceptanceCriteria',",
    "  'scope-files': 'scopeFiles',",
    "  'git-policy': 'gitPolicy',",
    "  'screen-usage-contract': 'screenUsageContract',",
    "  'design-contracts': 'designContracts',",
    "  retry: 'retryFeedback',",
    "  'retry-feedback': 'retryFeedback',",
    "  'retry-patch': 'retryFeedback.worktreePatch.body',",
    "  'source-snapshot': 'retryFeedback.sourceSnapshot.section',",
    "  'supervisor-memory': 'supervisorMemory',",
    "  'output-contract': 'outputContract',",
    "};",
    "if (!fields[command]) usage();",
    "print(valueAt(s, fields[command]));",
    "}",
    "",
  ].join("\\n");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, script, { mode: 0o755 });
} catch (err) {
  process.stderr.write("SETFARM_SUMMARY_INSTALL_FAILED: " + String(err).slice(0, 240) + "\\n");
}
SETFARM_SUMMARY_TOOL_NODE
  IMPLEMENT_CONTEXT_FILE="$WORKDIR/.setfarm/implement-context.json"
  mkdir -p "$WORKDIR/.setfarm"
  if CLAIM_SUMMARY_FILE="$CLAIM_SUMMARY_FILE" node "$WORKDIR/.setfarm-bin/setfarm-summary" implement-context > "$IMPLEMENT_CONTEXT_FILE"; then
    echo "IMPLEMENT_CONTEXT_FILE=$IMPLEMENT_CONTEXT_FILE"
    echo "SUMMARY_HELPER_RULE=IMPLEMENT_CONTEXT_FILE is ready; do not run setfarm-summary or retry helper commands for this claim."
  else
    rm -f "$IMPLEMENT_CONTEXT_FILE"
    echo "IMPLEMENT_CONTEXT_FILE_UNAVAILABLE=run SUMMARY_IMPLEMENT_CONTEXT_CMD exactly once without redirection"
    echo "SUMMARY_IMPLEMENT_CONTEXT_CMD=CLAIM_SUMMARY_FILE='$CLAIM_SUMMARY_FILE' node '$WORKDIR/.setfarm-bin/setfarm-summary' implement-context"
    echo "SUMMARY_HELPER_RULE=Use SUMMARY_IMPLEMENT_CONTEXT_CMD only because IMPLEMENT_CONTEXT_FILE is unavailable. Do not guess setfarm-summary topics, append pipes/redirection/chaining, cat helper scripts, or parse raw /tmp/claim JSON."
  fi
  node - "$CLAIM_SUMMARY_FILE" "$WORKDIR/.setfarm-bin/setfarm-evidence" <<'SETFARM_EVIDENCE_TOOL_NODE'
const fs = require("fs");
const path = require("path");
try {
  const out = process.argv[3];
  const defaultSummaryFile = String(process.argv[2] || "");
  const script = [
    "#!/usr/bin/env sh",
    "':' //; exec node \\\"$0\\\" \\\"$@\\\"",
    "import fs from 'node:fs';",
    "import path from 'node:path';",
    "const summaryFile = process.env.CLAIM_SUMMARY_FILE || " + JSON.stringify(defaultSummaryFile) + ";",
    "const command = process.argv[2] || '';",
    "const args = process.argv.slice(3);",
    "const supported = new Set(['click', 'fill', 'press', 'wait', 'navigate', 'snapshot']);",
    "function usage() {",
    "  console.error('Usage: setfarm-evidence init [--min-flow-count N] | snapshot [--id ID] [--target window.app] | action --action-id ID [--id FLOW_ID] | validate');",
    "  process.exit(2);",
    "}",
    "function arg(name, fallback = '') {",
    "  const i = args.indexOf(name);",
    "  if (i >= 0 && i + 1 < args.length) return args[i + 1];",
    "  return fallback;",
    "}",
    "function positional() { return args.find((value) => !String(value).startsWith('--')) || ''; }",
    "function readSummary() {",
    "  if (!summaryFile) usage();",
    "  return JSON.parse(fs.readFileSync(summaryFile, 'utf8'));",
    "}",
    "function evidenceDir(s) {",
    "  const p = s.implementEvidenceContract || {};",
    "  if (p.intentPath) {",
    "    const marker = path.sep + '.setfarm' + path.sep;",
    "    const text = String(p.intentPath);",
    "    const index = text.indexOf(marker);",
    "    const root = index >= 0 ? text.slice(0, index) : '';",
    "    if (!root || fs.existsSync(root)) return path.dirname(text);",
    "  }",
    "  const storyId = String(s.storyId || 'US-001').replace(/[^a-zA-Z0-9._-]/g, '_');",
    "  return path.join(process.cwd(), '.setfarm', 'implement', storyId);",
    "}",
    "function writeJson(file, value) {",
    "  fs.mkdirSync(path.dirname(file), { recursive: true });",
    "  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\\\\n');",
    "  console.log(file);",
    "}",
    "function paths(s) {",
    "  const c = s.implementEvidenceContract || {};",
    "  const dir = evidenceDir(s);",
    "  const intentPath = c.intentPath && path.dirname(String(c.intentPath)) === dir ? String(c.intentPath) : path.join(dir, 'IMPLEMENT_INTENT.json');",
    "  const requestPath = c.verificationRequestPath && path.dirname(String(c.verificationRequestPath)) === dir ? String(c.verificationRequestPath) : path.join(dir, 'IMPLEMENT_VERIFICATION_REQUEST.json');",
    "  return {",
    "    intent: intentPath,",
    "    request: requestPath,",
    "  };",
    "}",
    "function acceptance(s) {",
    "  const text = String(s.acceptanceCriteria || s.currentStory || s.storyTitle || 'Story acceptance criterion implemented').replace(/\\\\s+/g, ' ').trim();",
    "  return text.slice(0, 500) || 'Story acceptance criterion implemented';",
    "}",
    "function init() {",
    "  const s = readSummary();",
    "  const min = Number(arg('--min-flow-count', '1'));",
    "  if (!Number.isFinite(min) || min < 0) throw new Error('--min-flow-count must be a non-negative number');",
    "  writeJson(paths(s).intent, {",
    "    schema: 'setfarm.implement-intent.v1',",
    "    storyId: s.storyId || 'US-001',",
    "    storyType: 'ui_interactive',",
    "    acceptanceCriteria: [{ id: 'AC-001', description: acceptance(s) }],",
    "    runtimeEvidenceRequired: { minFlowCount: min },",
    "  });",
    "}",
    "function writeRequest(kind) {",
    "  const s = readSummary();",
    "  let interaction;",
    "  if (kind === 'snapshot') {",
    "    interaction = { id: arg('--id', 'flow-1'), action: 'snapshot', target: arg('--target', positional() || 'window.app'), waitCondition: 'dom_idle', timeoutMs: 1000 };",
    "  } else if (kind === 'action') {",
    "    const actionId = arg('--action-id', positional());",
    "    if (!actionId) throw new Error('action requires --action-id ID');",
    "    const target = '[data-action-id=' + JSON.stringify(actionId) + ']';",
    "    interaction = { id: arg('--id', actionId), action: 'click', actionId, target, waitCondition: 'dom_idle', timeoutMs: 1000 };",
    "  } else usage();",
    "  writeJson(paths(s).request, {",
    "    schema: 'setfarm.implement-verification-request.v1',",
    "    storyId: s.storyId || 'US-001',",
    "    status: 'ready_for_orchestrator_verification',",
    "    interactionRequests: [interaction],",
    "    uncoveredCriteria: [],",
    "    knownGaps: [],",
    "  });",
    "}",
    "function validate() {",
    "  const s = readSummary();",
    "  const p = paths(s);",
    "  const issues = [];",
    "  for (const [name, file] of Object.entries(p)) {",
    "    if (!fs.existsSync(file)) { issues.push(name + ' missing: ' + file); continue; }",
    "    try { JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { issues.push(name + ' JSON invalid: ' + String(err.message || err)); }",
    "  }",
    "  if (fs.existsSync(p.request)) {",
    "    const request = JSON.parse(fs.readFileSync(p.request, 'utf8'));",
    "    if (request.schema !== 'setfarm.implement-verification-request.v1') issues.push('request.schema invalid');",
    "    if (request.status !== 'ready_for_orchestrator_verification') issues.push('request.status invalid');",
    "    if (!Array.isArray(request.interactionRequests)) issues.push('request.interactionRequests must be an array');",
    "    for (const [index, interaction] of (Array.isArray(request.interactionRequests) ? request.interactionRequests : []).entries()) {",
    "      if (!interaction || typeof interaction !== 'object' || Array.isArray(interaction)) { issues.push('interactionRequests[' + index + '] must be an object'); continue; }",
    "      const action = String(interaction.action || '').trim();",
    "      const actionId = String(interaction.actionId || '').trim();",
    "      if (!action && !actionId) issues.push('interactionRequests[' + index + '] needs action or actionId');",
    "      if (action && !supported.has(action)) issues.push('interactionRequests[' + index + '].action unsupported: ' + action);",
    "      if (['click', 'fill', 'press'].includes(action) && !interaction.target && !actionId) issues.push('interactionRequests[' + index + '] ' + action + ' needs target or actionId');",
    "      if (action === 'navigate' && !interaction.value) issues.push('interactionRequests[' + index + '] navigate needs value');",
    "    }",
    "  }",
    "  if (issues.length) { console.error(issues.join('\\\\n')); process.exit(1); }",
    "  console.log('SETFARM_EVIDENCE_OK');",
    "}",
    "try {",
    "  if (command === 'init') init();",
    "  else if (command === 'snapshot') writeRequest('snapshot');",
    "  else if (command === 'action') writeRequest('action');",
    "  else if (command === 'validate') validate();",
    "  else usage();",
    "} catch (err) {",
    "  console.error('SETFARM_EVIDENCE_ERROR: ' + String(err.message || err).slice(0, 500));",
    "  process.exit(1);",
    "}",
    "",
  ].join("\\n");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, script, { mode: 0o755 });
} catch (err) {
  process.stderr.write("SETFARM_EVIDENCE_INSTALL_FAILED: " + String(err).slice(0, 240) + "\\n");
}
SETFARM_EVIDENCE_TOOL_NODE
  if node "$WORKDIR/.setfarm-bin/setfarm-evidence" init >/dev/null && node "$WORKDIR/.setfarm-bin/setfarm-evidence" snapshot --target window.app >/dev/null && node "$WORKDIR/.setfarm-bin/setfarm-evidence" validate >/dev/null; then
    echo "IMPLEMENT_EVIDENCE_SEEDED=default snapshot request ready; Setfarm will validate evidence after completion. Do not run or inspect setfarm-evidence unless retryFeedback explicitly requires a different request."
  else
    echo "IMPLEMENT_EVIDENCE_SEED_FAILED=Setfarm could not seed default evidence request; create valid IMPLEMENT_INTENT.json and IMPLEMENT_VERIFICATION_REQUEST.json before STATUS: done"
  fi
fi
SUMMARY_PRINTED=0
if [ -n "$CLAIM_SUMMARY_FILE" ] && [ -f "$CLAIM_SUMMARY_FILE" ]; then
  node - "$CLAIM_SUMMARY_FILE" <<'SETFARM_SUMMARY_NODE'
	const fs = require("fs");
	const s = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
	const lines = [];
	function shq(value) {
	  return "'" + String(value || "").replace(/'/g, "'\\''") + "'";
	}
	const activeWorkdir = String(process.env.WORKDIR || s.workdir || s.storyWorkdir || s.verifyWorkdir || s.mainRepo || s.repo || "").replace(/\\/+$/, "");
	const helperPath = (activeWorkdir ? activeWorkdir + "/" : "") + ".setfarm-bin/setfarm-summary";
const summaryCommandPrefix = "CLAIM_SUMMARY_FILE=" + shq(process.argv[2]) + " node " + shq(helperPath) + " ";
if (s.storyId || s.storyTitle) lines.push(("STORY=" + (s.storyId || "") + " " + (s.storyTitle || "")).trim());
if (s.storyBranch) lines.push("STORY_BRANCH=" + String(s.storyBranch));
if (s.storyDiffBase) lines.push("STORY_DIFF_BASE=" + String(s.storyDiffBase));
if (s.storyWorkdir) lines.push("STORY_WORKDIR=" + String(s.storyWorkdir));
if (s.verifyWorkdir) lines.push("VERIFY_WORKDIR=" + String(s.verifyWorkdir));
if (s.repo) lines.push("MAIN_REPO=" + String(s.repo));
if (s.buildCommand) lines.push("BUILD_CMD=" + String(s.buildCommand));
if (s.testCommand) lines.push("TEST_CMD=" + String(s.testCommand));
if (s.lintCommand) lines.push("LINT_CMD=" + String(s.lintCommand));
	if (/^developer$/i.test(String(s.role || ""))) {
	  const implementContextFile = activeWorkdir ? activeWorkdir + "/.setfarm/implement-context.json" : "";
  const implementContextReady = !!(implementContextFile && fs.existsSync(implementContextFile));
  lines.push("IMPLEMENT_LOOP=Edit scoped source, run CHECK_BUILD_CMD exactly, run CHECK_TEST_CMD exactly, then write required output. Setfarm validates seeded implementation evidence after completion. Once declared build/test pass, do not add optional new tests or probes; finish the claim.");
  lines.push("IMPLEMENT_DONE_FAST_PATH=After CHECK_BUILD_CMD and CHECK_TEST_CMD pass as exact standalone commands, write OUTPUT_CONTRACT fields, call step complete, then stop. Setfarm will validate seeded implementation evidence after completion.");
  const checkCommand = (value) => {
    const text = String(value || "").trim();
    return text && text !== "true" ? text : "";
  };
  const checkBuildCommand = checkCommand(s.buildCommand);
  const checkTestCommand = checkCommand(s.testCommand);
  const checkLintCommand = checkCommand(s.lintCommand);
  if (checkBuildCommand) lines.push("CHECK_BUILD_CMD=" + checkBuildCommand);
  if (checkTestCommand) lines.push("CHECK_TEST_CMD=" + checkTestCommand);
  if (checkLintCommand) lines.push("CHECK_LINT_CMD=" + checkLintCommand);
  lines.push("CHECK_CMD_ATOMIC_RULE=Run each CHECK_*_CMD value exactly as printed, as its own command. Do not append 2>&1, | head, | tail, tee, cat, echo, timeout, parentheses, &&, ||, ;, or any other suffix/prefix/wrapper to a CHECK_*_CMD command.");
  if (implementContextFile) lines.push("IMPLEMENT_CONTEXT_FILE=" + implementContextFile);
  if (implementContextReady) {
    lines.push("SUMMARY_HELPER_RULE=IMPLEMENT_CONTEXT_FILE is ready; do not run setfarm-summary or retry helper commands for this claim.");
  } else {
    lines.push("SUMMARY_IMPLEMENT_CONTEXT_CMD=" + summaryCommandPrefix + "implement-context");
    lines.push("SUMMARY_HELPER_RULE=Use SUMMARY_IMPLEMENT_CONTEXT_CMD only because IMPLEMENT_CONTEXT_FILE is unavailable. Do not guess setfarm-summary topics, append pipes/redirection/chaining, cat helper scripts, or parse raw /tmp/claim JSON.");
  }
}
if (Array.isArray(s.scopeFiles)) lines.push("SCOPE_FILES=" + s.scopeFiles.join(", "));
if (Array.isArray(s.existingScopeFiles) && s.existingScopeFiles.length) lines.push("EXISTING_SCOPE_FILES=" + s.existingScopeFiles.join(", "));
if (Array.isArray(s.missingScopeFiles) && s.missingScopeFiles.length) lines.push("MISSING_SCOPE_FILES=" + s.missingScopeFiles.join(", "));
if (s.scopeFileInstruction) lines.push("SCOPE_FILE_POLICY=" + String(s.scopeFileInstruction).slice(0, 500));
const sc = s.screenUsageContract || {};
if (sc.summary) lines.push("SCREEN_USAGE=" + String(sc.summary).slice(0, 500));
if (Array.isArray(sc.components)) {
  for (const c of sc.components.slice(0, 12)) {
    lines.push("SCREEN_COMPONENT=" + [c.componentName, c.file, c.sourceRead, "actions=" + (Array.isArray(c.actionIds) ? c.actionIds.join("|") : "")].filter(Boolean).join(" "));
  }
}
lines.push("DETAILS_RULE=Initial bootstrap output intentionally omits long story, retry, PR, and supervisor text. Read IMPLEMENT_CONTEXT_FILE for the complete compact implement handoff. Use SUMMARY_IMPLEMENT_CONTEXT_CMD only if the file is unavailable; do not request all/full/story-brief helper topics.");
const rf = s.retryFeedback || {};
const implementContextReadyForCommands = !!(s.workdir && fs.existsSync(String(s.workdir).replace(/\\/+$/, "") + "/.setfarm/implement-context.json"));
const checkRuleSignal = [
  s.role,
  s.failureCategory,
  rf.category,
  rf.blocker,
  rf.details,
  s.previousFailure,
  s.retryDiscipline && s.retryDiscipline.instruction,
].filter(Boolean).join("\\n");
if (/^developer$/i.test(String(s.role || "")) || /\\bMASKED_CHECK_COMMAND\\b/i.test(checkRuleSignal)) {
  lines.push("MASKED_CHECK_RULE=Use CHECK_BUILD_CMD/CHECK_TEST_CMD when present, exactly as printed and as standalone commands. Otherwise rerun the exact build/test/lint/typecheck command as a standalone command without output-filtering pipes.");
  if (s.buildCommand) lines.push("MASKED_CHECK_EXACT_BUILD_CMD=" + String(s.buildCommand));
  if (s.testCommand) lines.push("MASKED_CHECK_EXACT_TEST_CMD=" + String(s.testCommand));
  if (s.lintCommand && String(s.lintCommand) !== "true") lines.push("MASKED_CHECK_EXACT_LINT_CMD=" + String(s.lintCommand));
  lines.push("MASKED_CHECK_DONE_GATE=Before STATUS: done, run CHECK_BUILD_CMD/CHECK_TEST_CMD when present exactly as printed, with no suffix, prefix, pipe, tee, redirect, timeout, grouping, or command chaining. If you need shorter output, inspect logs only after the exact standalone check command has returned.");
}
if (/^DESIGN_MISMATCH$/i.test(String(s.failureCategory || ""))) {
  lines.push("DESIGN_RETRY_RULE=Fix the exact UI_CONTRACT/design-token file and line first; search scoped files for the rejected token or pattern and replace it before broad feature work.");
}
if (/^(?:SCOPE_BLEED|SCOPE_WRITE_VIOLATION)$/i.test(String(s.failureCategory || ""))) {
  lines.push("SCOPE_RETRY_RULE=First remove/rework out-of-scope files or shell-created project artifacts. Do not read retry source snapshots, do not read retry worktree patches, and do not recreate shared/debug/scratch files, including /tmp probe scripts via OpenClaw write/edit; use inline node -e or existing scoped tests instead. Keep the fix inside SCOPE_FILES, then run build/test.");
}
if (rf.worktreePatch && rf.worktreePatch.body) {
  const patchFiles = Array.isArray(rf.worktreePatch.touchedFiles) ? rf.worktreePatch.touchedFiles.join(", ") : "";
  lines.push("RETRY_WORKTREE_PATCH=present " + String(rf.worktreePatch.bytes || String(rf.worktreePatch.body).length) + " bytes");
  if (patchFiles) lines.push("RETRY_WORKTREE_PATCH_FILES=" + patchFiles.slice(0, 500));
  if (!implementContextReadyForCommands) lines.push("RETRY_WORKTREE_PATCH_CMD=node .setfarm-bin/setfarm-summary retry-patch");
}
if (rf.sourceSnapshot && rf.sourceSnapshot.section) {
  lines.push("RETRY_SOURCE_SNAPSHOT=present " + String(rf.sourceSnapshot.bytes || String(rf.sourceSnapshot.section).length) + " bytes");
  if (!implementContextReadyForCommands) lines.push("RETRY_SOURCE_SNAPSHOT_CMD=node .setfarm-bin/setfarm-summary source-snapshot");
}
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
  lines.push("IMPLEMENT_EVIDENCE_HELPER=Default valid intent/request are already seeded. Do not run or inspect setfarm-evidence in the normal implement loop; Setfarm validates evidence after completion. Only edit IMPLEMENT_VERIFICATION_REQUEST.json if retryFeedback explicitly requires a different runtime request. Do not hand-write evaluate/assert/source-grep interaction requests.");
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

First exec command (copy exactly; do not append redirection, pipes, head/tail, tee, timeout, chaining, or any wrapper):
bash ${shellQuote(params.bootstrapFile)}

Do ${params.wfId}/${params.role} work in WORKDIR only. The bootstrap command prints the authoritative quick handoff plus IMPLEMENT_CONTEXT_FILE. After the exact bootstrap exec, read IMPLEMENT_CONTEXT_FILE with the file read tool and implement from that context. If IMPLEMENT_CONTEXT_FILE is unavailable, run SUMMARY_IMPLEMENT_CONTEXT_CMD exactly once as its own command with no redirection or wrapper. The bootstrap file is executable-only handoff plumbing: do not cat/read/inspect/rerun/redirect it after the first exact exec, even if tool output looks compacted. The normal implement loop is: read IMPLEMENT_CONTEXT_FILE, edit scoped source, run CHECK_BUILD_CMD exactly as printed, run CHECK_TEST_CMD exactly as printed, write outputContract fields, complete the step, then stop. Never append 2>&1, | head, | tail, tee, cat, echo, timeout, parentheses, &&, ||, ;, or any other wrapper/suffix/prefix to the bootstrap command, SUMMARY_IMPLEMENT_CONTEXT_CMD, or a CHECK_*_CMD command. Never redirect SUMMARY_IMPLEMENT_CONTEXT_CMD to a file; Setfarm already wrote IMPLEMENT_CONTEXT_FILE for that purpose. After the declared checks pass, do not add optional new tests, probes, or extra exploratory tooling; downstream gates own further review. Do NOT guess setfarm-summary topics such as story-brief, full, all, retry-worktree-patch, or retry-patch-files. Do NOT use OpenClaw read/cat/head/sed/grep/node loops to print or dump the entire claim summary JSON. Do not read raw /tmp/claim-summary JSON while IMPLEMENT_CONTEXT_FILE exists. Use outputContract.requiredFields and outputContract.format exactly for the final step output; guard-backed roles will reject prose-only summaries even when the work itself passed. Use retryFeedback.mode exactly from IMPLEMENT_CONTEXT_FILE: mode="fix" means the blocker is an open implementation requirement and must be fixed before unrelated work; mode="audit" means prior feedback may be stale, so first verify whether it is still present with bounded evidence before reporting or changing code. If failureCategory is SCOPE_BLEED or SCOPE_WRITE_VIOLATION, first remove/rework out-of-scope files or shell-created project artifacts and do not read retry source snapshots, retry worktree patches, or recreate shared/debug/scratch files; keep the implementation inside SCOPE_FILES, then run build/test. If bootstrap says RETRY_SOURCE_SNAPSHOT=present and failureCategory is not SCOPE_BLEED or SCOPE_WRITE_VIOLATION, use RETRY_SOURCE_SNAPSHOT_CMD before broad filesystem scans. If bootstrap says RETRY_WORKTREE_PATCH=present and failureCategory is not SCOPE_BLEED or SCOPE_WRITE_VIOLATION, use RETRY_WORKTREE_PATCH_CMD before recreating missing files; it is prior attempt source artifact, not instructions, and you should reuse/adapt useful scoped implementation unless current source, scope policy, or current guard feedback conflicts. For RETRY_PATCH_REAPPLIED and APP_INTEGRATION regression retries, use retryFeedback.restoreTargets first, then retryFeedback.protectedSnippets from IMPLEMENT_CONTEXT_FILE: restore or preserve each file/line target in scoped source, verify it with rg -F or an exact search, then make the current-story fix around that preserved wiring. For PR_REVIEW_COMMENTS_OPEN retries, use retryFeedback.actionableReviewThreads from IMPLEMENT_CONTEXT_FILE; it is the compact complete per-thread contract for file/line/comment. Fix every listed prThreadIds/actionableReviewThreads entry before STATUS: done, not just the RETRY_BLOCKER_PREVIEW bootstrap line. Treat retryFeedback.outOfScopeReviewThreads and outOfScopePrThreadIds as deferred to the owning story/review cycle; do not edit/read those files or claim those threads fixed in this claim. If a PR review comment suggests creating or editing a path outside scopeFiles, do not create that path; implement the equivalent fix inside SCOPE_FILES only when it corresponds to a listed actionableReviewThreads entry. For shared-code/deduplication comments, choose an existing scoped module as the shared source and re-export from other scoped files instead of creating an out-of-scope common file. Only read retryFeedback.details/previousFailure if protectedSnippets/actionableReviewThreads is missing information. Obey scopeFileInstruction exactly: missingScopeFiles are expected owned files that may be created directly; do not treat them as blockers and do not retry update-only patches against missing files. Obey gitPolicy exactly: when owner is setfarm-platform, do not run git add/commit/push/branch/PR commands; Setfarm performs the scoped commit and PR handoff after gates pass. Obey integrationPolicy exactly: app/router/shell changes must add current-story reachability without deleting or bypassing previously reachable generated screens or working render branches. Use supervisorEvidence before retryFeedback/designContracts when it is present: it is current-source scanner evidence and stale original UI_CONTRACT findings must not block when supervisorEvidence shows zero open blockers. Use screenUsageContract first for generated screen component names, props, and action IDs. For stacks without generated screen source, use designContracts.screenMap, designContracts.designDom, uiContract, stitchHtml/stitch_html excerpts, and focused story-owned Stitch files from IMPLEMENT_CONTEXT_FILE as binding implementation sources. Do not read unrelated raw Stitch files, shared generated screen source, or create TypeScript probe files. The full claim at ${params.claimFile} is an audit fallback only for non-input metadata such as stepId. Do NOT parse or dump claim.input with jq/sed/head/node loops. Obey generatedScreenPolicy exactly: if you accidentally read a forbidden src/screens/*.tsx file, stop broad reading and return to implement context; supervisor records that as a correction signal.
For retryFeedback.mode="fix", treat retryDiscipline.mode as a hard implementation instruction. For retryDiscipline.mode="first-delta", after bootstrap and summary, inspect only the owned scope files plus safe metadata needed for the first edit, then make a small scoped source delta before broad analysis/build/test. For retryDiscipline.mode="semantic-fix", implement the named blocker first, then run the relevant checks. For retryFeedback.mode="audit", do not convert prior feedback into a source-edit mandate unless the role-specific prompt explicitly owns that fix.
If claimSummary.runtimeDoneChecklist is present, it is a hard done checklist, not optional guidance. Preserve every listed invariant while fixing the current blocker; a retry that fixes one item but regresses another must not report STATUS: done.
Do NOT create scratch/progress/todo/note/probe/test-write files inside WORKDIR unless they are explicitly listed in scopeFiles. Files like src/_probe.tsx, src/probe.tsx, src/features/test-write.ts, tmp.ts, scratch.tsx, TODO.md, and progress.txt are forbidden in the project worktree. Never create a project file just to verify that writes persist; use the owned scope file directly or a /tmp-only experiment. Use ${params.outputFile} for final output and /tmp/setfarm-progress-<run-id>.txt for checkpoints only.
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
