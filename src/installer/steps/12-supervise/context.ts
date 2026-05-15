import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { ClaimContext } from "../types.js";
import {
  expandTilde,
  getApiRoutes,
  getComponentRegistry,
  getInstalledPackages,
  getProjectTree,
  getSharedCode,
  readProgressFile,
  readProjectMemory,
} from "../../context-ops.js";
import { readSupervisorMemory } from "../../product-supervisor.js";

function safeExec(cwd: string, cmd: string, args: string[], maxChars = 8000): string {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    }).slice(0, maxChars);
  } catch {
    return "";
  }
}

function readIfExists(filePath: string, maxChars: number): string {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return "";
    return fs.readFileSync(filePath, "utf-8").slice(0, maxChars);
  } catch {
    return "";
  }
}

function supervisorGitSummary(repo: string, branch: string): string {
  if (!repo || !fs.existsSync(repo)) return "(repo not available)";
  const parts = [
    ["branch", safeExec(repo, "git", ["branch", "--show-current"], 1000)],
    ["status", safeExec(repo, "git", ["status", "--short"], 4000)],
    ["recent_commits", safeExec(repo, "git", ["log", "--oneline", "--decorate", "-8"], 3000)],
    ["changed_vs_main", safeExec(repo, "git", ["diff", "--name-status", "main...HEAD"], 4000)],
  ];
  if (branch) parts.push(["remote_branch", safeExec(repo, "git", ["ls-remote", "--heads", "origin", branch], 1000)]);
  return parts
    .map(([label, value]) => `## ${label}\n${String(value || "(none)").trim()}`)
    .join("\n\n");
}

export async function injectContext(ctx: ClaimContext): Promise<void> {
  const mainRepo = expandTilde(ctx.context["repo"] || "");
  const storyWorkdir = expandTilde(ctx.context["story_workdir"] || "");
  const repo = storyWorkdir || mainRepo;
  const branch = storyWorkdir ? (ctx.context["story_branch"] || ctx.context["branch"] || "main") : (ctx.context["branch"] || "main");

  ctx.context["supervisor_memory"] = readSupervisorMemory(ctx.context);
  ctx.context["project_memory"] = readProjectMemory(ctx.context);
  ctx.context["progress"] = await readProgressFile(ctx.runId);

  if (!repo || !fs.existsSync(repo)) {
    ctx.context["supervisor_git_summary"] = "(repo not available)";
    return;
  }

  ctx.context["project_tree"] = getProjectTree(repo);
  ctx.context["installed_packages"] = getInstalledPackages(repo);
  ctx.context["component_registry"] = getComponentRegistry(repo);
  ctx.context["api_routes"] = getApiRoutes(repo);
  ctx.context["shared_code"] = getSharedCode(repo).slice(0, 8000);
  ctx.context["supervisor_git_summary"] = supervisorGitSummary(repo, branch);
  ctx.context["design_md_excerpt"] = readIfExists(path.join(repo, "DESIGN.md"), 12000) || "(no DESIGN.md)";
  ctx.context["package_json_excerpt"] = readIfExists(path.join(repo, "package.json"), 5000) || "(no package.json)";
}
