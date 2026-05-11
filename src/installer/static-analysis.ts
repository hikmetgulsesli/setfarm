/**
 * Static Analysis — Pre-flight checks for verify step speedup.
 * Runs ESLint + TypeScript compiler on changed files only.
 * Results injected into verify agent context to avoid full codebase review.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { logger } from "../lib/logger.js";

export interface PreFlightReport {
  changedFiles: string[];
  diffSummary: string;
  eslintErrors: string;
  tscErrors: string;
  contractErrors: string;
  totalIssues: number;
}

function diffRange(baseRef: string, headRef = "HEAD"): string {
  return `${baseRef}...${headRef}`;
}

export function getChangedFiles(repoPath: string, baseBranch: string, headRef = "HEAD"): string[] {
  try {
    const output = execFileSync("git", ["diff", "--name-only", diffRange(baseBranch, headRef)], {
      cwd: repoPath, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return output ? output.split("\n").filter(f => /\.(ts|tsx|js|jsx|css|html)$/.test(f)) : [];
  } catch {
    return [];
  }
}

export function getDiffSummary(repoPath: string, baseBranch: string, headRef = "HEAD"): string {
  try {
    return execFileSync("git", ["diff", "--stat", diffRange(baseBranch, headRef)], {
      cwd: repoPath, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"]
    }).trim().slice(0, 3000);
  } catch {
    return "";
  }
}

export function runEslint(repoPath: string, files: string[]): string {
  if (files.length === 0) return "";
  try {
    const result = execFileSync("npx", ["eslint", "--format", "compact", ...files.slice(0, 20)], {
      cwd: repoPath, encoding: "utf-8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"]
    });
    return result.trim().slice(0, 2000);
  } catch (err: any) {
    // ESLint exits with 1 on lint errors — that's expected
    const output = `${err.stdout || ""}\n${err.stderr || ""}\n${err.message || ""}`;
    if (/couldn't find an eslint\.config/i.test(output) || /no eslint configuration found/i.test(output)) {
      logger.info("[preflight] ESLint skipped: no config file found", {});
      return "";
    }
    return output.trim().slice(0, 2000);
  }
}

export function runTscCheck(repoPath: string): string {
  try {
    execFileSync("npx", ["tsc", "--noEmit", "--pretty", "false", "--skipLibCheck"], {
      cwd: repoPath, encoding: "utf-8", timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return "";
  } catch (err: any) {
    return (err.stdout || err.message || "").split("\n").slice(0, 30).join("\n");
  }
}

function lineFor(content: string, pattern: RegExp): number {
  const match = pattern.exec(content);
  if (!match || match.index < 0) return 1;
  return content.slice(0, match.index).split("\n").length;
}

function primaryFontFamily(value: string): string {
  const [first] = value.split(",");
  return (first || "")
    .replace(/["']/g, "")
    .trim()
    .toLowerCase();
}

export function runProjectContractChecks(repoPath: string, files: string[]): string {
  const issues: string[] = [];
  const sourceFiles = files
    .filter(f => /\.(ts|tsx|js|jsx|css|html)$/.test(f))
    .slice(0, 80);

  for (const rel of sourceFiles) {
    const abs = path.join(repoPath, rel);
    let content = "";
    try {
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
      content = fs.readFileSync(abs, "utf-8");
    } catch {
      continue;
    }

    const materialPattern = /\bmaterial-symbols(?:-outlined)?\b|\bmaterial-icons\b|Material\+Symbols|Material Symbols/i;
    if (materialPattern.test(content)) {
      issues.push(`${rel}:${lineFor(content, materialPattern)} — UI_CONTRACT: Material Symbols/icon fonts are not allowed; replace with inline SVG components or an already-installed SVG icon library.`);
    }

    const transitionAllPattern = /\btransition-all\b|transition\s*:\s*all\b/i;
    if (transitionAllPattern.test(content)) {
      issues.push(`${rel}:${lineFor(content, transitionAllPattern)} — UI_CONTRACT: blanket transition-all is not allowed; use transition-colors, transition-transform, transition-opacity, or explicit CSS properties.`);
    }

    const emojiPattern = /[\u{1F300}-\u{1FAFF}]/u;
    if (emojiPattern.test(content)) {
      issues.push(`${rel}:${lineFor(content, emojiPattern)} — UI_CONTRACT: emoji icons are not allowed in source UI; replace with inline SVG components or an already-installed SVG icon library.`);
    }

    const fontDecl = /(?:^|[;{]\s*)font-family\s*:\s*([^;]+);/gim;
    let match: RegExpExecArray | null;
    while ((match = fontDecl.exec(content)) !== null) {
      const primary = primaryFontFamily(match[1] || "");
      if (/^(inter|roboto|arial|helvetica|system-ui)$/.test(primary)) {
        const line = content.slice(0, match.index).split("\n").length;
        issues.push(`${rel}:${line} — UI_CONTRACT: banned primary font "${primary}" in font-family; use project design tokens or a distinctive approved font first.`);
      }
    }
  }

  return issues.slice(0, 30).join("\n");
}

export function buildPreFlightReport(repoPath: string, baseBranch: string, headRef = "HEAD"): PreFlightReport {
  const changedFiles = getChangedFiles(repoPath, baseBranch, headRef);
  const diffSummary = getDiffSummary(repoPath, baseBranch, headRef);
  const lintFiles = changedFiles.filter(f => /\.(ts|tsx|js|jsx)$/.test(f));
  const eslintErrors = runEslint(repoPath, lintFiles);
  const tscErrors = runTscCheck(repoPath);
  const contractErrors = runProjectContractChecks(repoPath, changedFiles);

  const totalIssues = (eslintErrors ? 1 : 0) + (tscErrors ? 1 : 0) + (contractErrors ? 1 : 0);

  return { changedFiles, diffSummary, eslintErrors, tscErrors, contractErrors, totalIssues };
}

export function formatPreFlightForAgent(report: PreFlightReport): string {
  const parts: string[] = [];

  parts.push(`=== PRE-FLIGHT ANALYSIS (${report.changedFiles.length} files changed) ===`);
  parts.push(`\nCHANGED FILES:\n${report.changedFiles.join("\n")}`);
  parts.push(`\nDIFF SUMMARY:\n${report.diffSummary}`);

  if (report.eslintErrors) {
    parts.push(`\nESLINT ERRORS:\n${report.eslintErrors}`);
  } else {
    parts.push(`\nESLINT: PASS (no errors)`);
  }

  if (report.tscErrors) {
    parts.push(`\nTYPESCRIPT ERRORS:\n${report.tscErrors}`);
  } else {
    parts.push(`\nTYPESCRIPT: PASS (no errors)`);
  }

  if (report.contractErrors) {
    parts.push(`\nUI CONTRACT ERRORS:\n${report.contractErrors}`);
  } else {
    parts.push(`\nUI CONTRACT: PASS (no deterministic violations)`);
  }

  return parts.join("\n");
}
