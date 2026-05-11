import { buildDesignMismatchSuggestion, sanitizeDesignMismatchFeedback } from "./error-taxonomy.js";
import { runProjectContractChecks } from "./static-analysis.js";
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
    .map(suggestion => `• ${suggestion}`)
    .join("\n");
  return `DESIGN UYUMSUZLUK:\n${lines.map(line => `• ${line}`).join("\n")}\nDÜZELT:\n${fixes}`;
}

function readScopeFiles(repoPath: string): Set<string> {
  try {
    const raw = fs.readFileSync(path.join(repoPath, ".story-scope-files"), "utf-8");
    return new Set(raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
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
  options: { repoPath?: string } = {},
): string {
  const sanitized = sanitizeSharedTypeRetryFeedback(
    sanitizeDesignMismatchFeedback(feedback),
    options.repoPath,
  );
  const repoPath = options.repoPath?.trim();
  if (!repoPath || !/\bUI_CONTRACT\b/i.test(sanitized)) return sanitized;

  const files = extractUiContractFiles(sanitized);
  if (files.length === 0) return sanitized;

  const currentErrors = runProjectContractChecks(repoPath, files).trim();
  if (!currentErrors) return "";
  return formatDesignMismatch(currentErrors);
}
