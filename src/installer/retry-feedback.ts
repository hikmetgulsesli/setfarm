import { buildDesignMismatchSuggestion, sanitizeDesignMismatchFeedback } from "./error-taxonomy.js";
import { runProjectContractChecks } from "./static-analysis.js";
import { findGeneratedRuntimeSemanticIssues } from "./steps/06-implement/guards.js";
import { sanitizeStackRetryFeedback } from "./stack-modules/registry.js";
import fs from "node:fs";
import path from "node:path";

const UI_CONTRACT_LINE_RE = /^([^\s:]+):\d+\s+—\s+UI_CONTRACT:\s+(.+)$/gm;

function extractUiContractFiles(text: string): string[] {
  const files = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = UI_CONTRACT_LINE_RE.exec(text)) !== null) {
    files.add(match[1]);
  }
  return [...files];
}

function formatDesignMismatch(errors: string): string {
  const lines = errors.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const fixes = buildDesignMismatchSuggestion(errors)
    .split("; ")
    .map(suggestion => `- ${suggestion}`)
    .join("\n");
  return `DESIGN MISMATCH:\n${lines.map(line => `- ${line}`).join("\n")}\nFIX:\n${fixes}`;
}

function readScopeFiles(repoPath: string): Set<string> {
  try {
    const raw = fs.readFileSync(path.join(repoPath, ".story-scope-files"), "utf-8");
    return new Set(raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function repoTaskExcludesSettingsFlow(repoPath: string): boolean {
  if (!repoPath) return false;
  const chunks: string[] = [];
  for (const rel of [path.join(".setfarm", "RUN_CONTRACT.json"), "PROJECT_MEMORY.md"]) {
    try {
      const raw = fs.readFileSync(path.join(repoPath, rel), "utf-8");
      if (rel.endsWith(".json")) {
        try {
          const parsed = JSON.parse(raw);
          chunks.push(String(parsed.task || ""), String(parsed.prd || ""));
        } catch {
          chunks.push(raw);
        }
      } else {
        chunks.push(raw);
      }
    } catch {}
  }
  const text = chunks.join("\n").toLowerCase();
  return /\b(?:do not add|don't add|without|no)\b[^.\n]{0,120}\bsettings?\b/.test(text);
}

function removeExcludedSettingsFlowFeedback(feedback: string, repoPath?: string, contractRepoPath?: string): string {
  const candidateRepos = [...new Set([contractRepoPath, repoPath].map((item) => String(item || "").trim()).filter(Boolean))];
  if (candidateRepos.length === 0 || !candidateRepos.some((repo) => repoTaskExcludesSettingsFlow(repo))) return feedback;
  if (!/\bSettings expected settings flow\b/i.test(feedback)) return feedback;
  return feedback
    .split(/\n\s*ALSO_FIX:\s*\n/i)
    .filter((block) => !/\bSettings expected settings flow\b/i.test(block))
    .join("\n\nALSO_FIX:\n")
    .trim();
}

function sanitizeSharedTypeRetryFeedback(feedback: string, repoPath?: string): string {
  const repo = repoPath?.trim();
  if (!repo) return feedback;
  const scope = readScopeFiles(repo);
  if (scope.size === 0) return feedback;

  const typeFilesScoped = [...scope].some(file =>
    /^src\/types(?:\/|\.|$)/.test(file) || /(?:^|\/)(domain|types)\.(tsx?|d\.ts)$/.test(file),
  );
  if (typeFilesScoped) return feedback;

  const sharedTypeHint = /\b(?:src\/types|domain\.ts|types\.ts|as\s+[A-Z][A-Za-z0-9_]*|update\s+(?:the\s+)?[A-Z][A-Za-z0-9_]*\s+type|widen\s+(?:the\s+)?(?:shared\s+)?type|include\s+ghost\s+variants?)\b/i;
  if (!sharedTypeHint.test(feedback)) return feedback;

  const rewritten = feedback
    .replace(/update\s+(?:the\s+)?([A-Z][A-Za-z0-9_]*)\s+type\s+to\s+include\s+ghost\s+variants?/gi, "keep the shared $1 type unchanged; use a local render/display type in the owned screen")
    .replace(/update\s+(?:the\s+)?([A-Z][A-Za-z0-9_]*)\s+type\b/gi, "avoid changing the shared $1 type");

  const note = [
    "SCOPE NOTE:",
    "- Do not edit shared domain/type files (`src/types/*`, domain model files) unless they are listed in SCOPE_FILES.",
    "- For screen-only render variants, keep shared exported types compatible and define a local display/render type or adapter inside the owned screen; narrow before calling shared helpers.",
  ].join("\n");
  return `${rewritten.trim()}\n\n${note}`;
}

/**
 * Retry feedback can outlive the analyzer version that produced it. Before a
 * developer retry sees old UI_CONTRACT diagnostics, re-run the current
 * deterministic checker on the reported files. If the issue no longer
 * reproduces, drop it instead of steering the agent into pointless edits.
 */
export function sanitizeRetryFeedbackForCurrentSource(
  feedback: string,
  options: { repoPath?: string; workdir?: string; contractRepoPath?: string } = {},
): string {
  const repoPath = options.repoPath?.trim();
  let sanitized = removeExcludedSettingsFlowFeedback(
    sanitizeStackRetryFeedback(
      sanitizeSharedTypeRetryFeedback(
        sanitizeDesignMismatchFeedback(feedback),
        repoPath,
      ),
      { repoPath, contractRepoPath: options.contractRepoPath },
    ),
    repoPath,
    options.contractRepoPath,
  );
  const workdir = options.workdir?.trim() || repoPath || "";
  if (workdir && /\b(?:GENERATED_RUNTIME_|ACTION_SEMANTIC_NOOP)\b/i.test(sanitized)) {
    const currentRuntimeIssues = findGeneratedRuntimeSemanticIssues(workdir, repoPath || "");
    if (currentRuntimeIssues.length === 0) {
      sanitized = sanitized
        .split(/\n\s*ALSO_FIX:\s*\n/i)
        .filter((block) => !/\b(?:GENERATED_RUNTIME_|ACTION_SEMANTIC_NOOP)\b/i.test(block))
        .join("\n\nALSO_FIX:\n")
        .trim();
    }
  }
  if (!repoPath || !/\bUI_CONTRACT\b/i.test(sanitized)) return sanitized;

  const files = extractUiContractFiles(sanitized);
  if (files.length === 0) return sanitized;

  const currentErrors = runProjectContractChecks(repoPath, files).trim();
  if (!currentErrors) return "";
  return formatDesignMismatch(currentErrors);
}
