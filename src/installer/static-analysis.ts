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
  totalIssues: number;
}

export function getChangedFiles(repoPath: string, baseBranch: string): string[] {
  try {
    const output = execFileSync("git", ["diff", "--name-only", `${baseBranch}...HEAD`], {
      cwd: repoPath, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return output ? output.split("\n").filter(f => f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".js") || f.endsWith(".jsx") || f.endsWith(".css")) : [];
  } catch {
    return [];
  }
}

export function getDiffSummary(repoPath: string, baseBranch: string): string {
  try {
    return execFileSync("git", ["diff", "--stat", `${baseBranch}...HEAD`], {
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
    return (err.stdout || err.message || "").slice(0, 2000);
  }
}

export function runTscCheck(repoPath: string): string {
  try {
    execFileSync("npx", ["tsc", "--noEmit", "--pretty", "false"], {
      cwd: repoPath, encoding: "utf-8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"]
    });
    return ""; // No errors
  } catch (err: any) {
    return (err.stdout || err.message || "").split("\n").slice(0, 30).join("\n");
  }
}

export function buildPreFlightReport(repoPath: string, baseBranch: string): PreFlightReport {
  const changedFiles = getChangedFiles(repoPath, baseBranch);
  const diffSummary = getDiffSummary(repoPath, baseBranch);
  const eslintErrors = runEslint(repoPath, changedFiles);
  const tscErrors = runTscCheck(repoPath);

  const totalIssues = (eslintErrors.match(/\d+ problem/)?.[0] ? 1 : 0) + (tscErrors ? 1 : 0);

  return { changedFiles, diffSummary, eslintErrors, tscErrors, totalIssues };
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

  return parts.join("\n");
}
