import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { resolveSetfarmCli } from "./installer/paths.js";

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineValue(input: string, label: string): string {
  const match = input.match(new RegExp("^\\s*" + escapeRegExp(label) + ":\\s*(.*)$", "m"));
  return (match?.[1] || "").trim();
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

function splitCsvList(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function extractScopeFiles(input: string, workdir: string): string[] {
  const fromScopeFile = readLinesFile(path.join(workdir, ".story-scope-files"));
  if (fromScopeFile.length > 0) return fromScopeFile;

  const scopeRule = lineValue(input, "STORY SCOPE RULE");
  const bracket = scopeRule.match(/ONLY write files in \[([^\]]+)\]/i);
  if (bracket?.[1]) return splitCsvList(bracket[1]);
  return splitCsvList(lineValue(input, "story_scope_files"));
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

function extractCurrentStory(input: string): { storyId: string; storyTitle: string; currentStory: string; acceptanceCriteria: string } {
  const currentStory = sliceSection(
    input,
    /^\s*CURRENT STORY:\s*/m,
    [/^\s*=== PROJECT CONTEXT/m, /^\s*FILE TREE/m, /^\s*DESIGN DATA/m],
    2600,
  );
  const source = currentStory || input;
  const storyMatch = source.match(/\bStory\s+([A-Z]+-\d+):\s*([^\n]+)/i);
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
  const workdir = params.workdir || lineValue(input, "WORKDIR") || defaultAgentScratch;
  const repo = params.repo || lineValue(input, "MAIN_REPO") || workdir;
  const storyScreensRaw = lineValue(input, "STORY_SCREENS");
  const task = lineValue(input, "TASK") || claimTaskPreview(params.input);
  const scopeFiles = extractScopeFiles(input, workdir);
  const scopeFileSet = new Set(scopeFiles);
  const generatedScreenFiles = readGeneratedScreenFiles(workdir);
  const generatedScreenAllowed = generatedScreenFiles.filter((file) => scopeFileSet.has(file));
  const generatedScreenReadOnly = generatedScreenFiles.filter((file) => !scopeFileSet.has(file));
  const supervisorMemoryFromInput = sliceSection(
    input,
    /^\s*SUPERVISOR MEMORY.*?:\s*/m,
    [/^\s*CURRENT STORY/m, /^\s*STORY ROADMAP/m, /^\s*===/m],
    6000,
  );
  const supervisorMemory = supervisorMemoryFromInput || readSupervisorMemoryFile(workdir, repo);
  return {
    schema: "setfarm.claim-summary.v1",
    workflow: params.wfId,
    role: params.role,
    stepId: params.stepId,
    runId: params.runId,
    storyId: params.storyId || currentStory.storyId,
    storyTitle: currentStory.storyTitle,
    task,
    workdir,
    repo,
    storyBranch: lineValue(input, "STORY_BRANCH"),
    runBranch: lineValue(input, "RUN_BRANCH"),
    buildCommand: lineValue(input, "BUILD_CMD"),
    testCommand: lineValue(input, "TEST_CMD"),
    lintCommand: lineValue(input, "LINT_CMD"),
    scopeFiles,
    sharedFiles: splitCsvList(lineValue(input, "story_shared_files")),
    storyScreens: parseJsonArray(storyScreensRaw),
    generatedScreenPolicy: {
      summary: generatedScreenAllowed.length > 0
        ? `May read/edit only these generated screen source files: ${generatedScreenAllowed.join(", ")}. Other src/screens/*.tsx files are forbidden; use SCREEN_INDEX.json and src/screens/index.ts.`
        : "No generated screen source file is in scope. Do not read/cat/sed/head/grep/rg/node/python any src/screens/*.tsx file; use SCREEN_INDEX.json and src/screens/index.ts only.",
      allowedSourceFiles: generatedScreenAllowed,
      forbiddenSourceFiles: generatedScreenReadOnly,
      safeMetadataFiles: ["src/screens/SCREEN_INDEX.json", "src/screens/index.ts"],
    },
    currentStory: currentStory.currentStory,
    acceptanceCriteria: currentStory.acceptanceCriteria,
    uiBehaviorContract: sliceSection(
      input,
      /^\s*UI BEHAVIOR CONTRACT \(from Stitch DOM .*?\):\s*/m,
      [/^\s*DESIGN DOM RULES/m, /^\s*DESIGN\.MD INTEGRATION/m],
      2600,
    ),
    previousFailure: sliceSection(
      input,
      /^\s*PREVIOUS FAILURE.*?:\s*/m,
      [/^\s*IMPLEMENTATION PHASE/m, /^\s*FILE SKELETONS/m],
      2200,
    ),
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
if [ -n "$CLAIM_SUMMARY_FILE" ] && [ -f "$CLAIM_SUMMARY_FILE" ]; then
  node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const lines=[]; if (s.storyId || s.storyTitle) lines.push(("STORY=" + (s.storyId || "") + " " + (s.storyTitle || "")).trim()); if (Array.isArray(s.scopeFiles)) lines.push("SCOPE_FILES=" + s.scopeFiles.join(", ")); if (s.generatedScreenPolicy && s.generatedScreenPolicy.summary) lines.push("GENERATED_SCREEN_POLICY=" + s.generatedScreenPolicy.summary); if (s.supervisorMemory) lines.push("SUPERVISOR_MEMORY=present " + String(s.supervisorMemory).length + " chars"); if (s.task) lines.push("TASK=" + String(s.task).slice(0, 500)); process.stdout.write(lines.join("\\n") + "\\n");' "$CLAIM_SUMMARY_FILE"
fi
printf '%s' "$TASK_PREVIEW" | head -c 1200
echo
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

Do ${params.wfId}/${params.role} work in WORKDIR only. Read the structured claim summary at ${params.claimSummaryFile} first; it is the authoritative handoff for story id/title, workdir, scope files, generatedScreenPolicy, supervisorMemory, screen refs, retry feedback, and output paths. The full claim at ${params.claimFile} is an audit fallback only. Do NOT parse or dump claim.input with jq/sed/head/node loops; use the summary fields and only fall back to the full claim for a missing focused field. Obey generatedScreenPolicy exactly: reading a forbidden src/screens/*.tsx file kills and retries the claim.
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
