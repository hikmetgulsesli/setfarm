import { buildDesignMismatchSuggestion, sanitizeDesignMismatchFeedback } from "./error-taxonomy.js";
import { runProjectContractChecks } from "./static-analysis.js";

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
  const sanitized = sanitizeDesignMismatchFeedback(feedback);
  const repoPath = options.repoPath?.trim();
  if (!repoPath || !/\bUI_CONTRACT\b/i.test(sanitized)) return sanitized;

  const files = extractUiContractFiles(sanitized);
  if (files.length === 0) return sanitized;

  const currentErrors = runProjectContractChecks(repoPath, files).trim();
  if (!currentErrors) return "";
  return formatDesignMismatch(currentErrors);
}
