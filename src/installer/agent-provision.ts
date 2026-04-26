import fs from "node:fs/promises";
import path from "node:path";
import type { WorkflowAgent, WorkflowSpec } from "./types.js";
import { resolveOpenClawStateDir, resolveWorkflowWorkspaceRoot } from "./paths.js";
import { writeWorkflowFile } from "./workspace-files.js";

import { logger } from "../lib/logger.js";
export type ProvisionedAgent = {
  id: string;
  name?: string;
  model?: string;
  timeoutSeconds?: number;
  workspaceDir: string;
  agentDir: string;
};

function resolveAgentWorkspaceRoot(): string {
  return resolveWorkflowWorkspaceRoot();
}

function resolveAgentDir(agentId: string): string {
  const safeId = agentId.replace(/[^a-zA-Z0-9_-]/g, "__");
  return path.join(resolveOpenClawStateDir(), "agents", safeId, "agent");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function isWithinDir(parent: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveBundledRoot(bundledSourceDir?: string): string | null {
  return bundledSourceDir ? path.resolve(bundledSourceDir, "..", "..") : null;
}

async function resolveBootstrapSource(params: {
  agentId: string;
  relativePath: string;
  workflowDir: string;
  bundledSourceDir?: string;
}): Promise<string> {
  const candidates: Array<{ source: string; allowedRoot: string }> = [
    {
      source: path.resolve(params.workflowDir, params.relativePath),
      allowedRoot: path.resolve(params.workflowDir),
    },
  ];

  const bundledRoot = resolveBundledRoot(params.bundledSourceDir);
  if (params.bundledSourceDir && bundledRoot) {
    candidates.push({
      source: path.resolve(params.bundledSourceDir, params.relativePath),
      allowedRoot: bundledRoot,
    });
  }

  let blocked = false;
  for (const candidate of candidates) {
    if (!isWithinDir(candidate.allowedRoot, candidate.source)) {
      blocked = true;
      continue;
    }
    if (await pathExists(candidate.source)) {
      return candidate.source;
    }
  }

  if (blocked) {
    logger.warn(`[agent-provision] Path traversal blocked: ${params.relativePath}`, {});
  }
  throw new Error(`Missing bootstrap file for agent "${params.agentId}": ${params.relativePath}`);
}

async function ensureReferencesLink(params: {
  workflowDir: string;
  bundledSourceDir?: string;
  workspaceDir: string;
}): Promise<void> {
  const candidates = [
    params.bundledSourceDir ? path.join(resolveBundledRoot(params.bundledSourceDir) || "", "references") : "",
    path.resolve(params.workflowDir, "..", "..", "references"),
  ].filter(Boolean);

  let resolvedSource = "";
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      resolvedSource = candidate;
      break;
    }
  }
  if (!resolvedSource) return;

  const destination = path.join(params.workspaceDir, "references");
  try {
    const current = await fs.lstat(destination);
    if (current.isSymbolicLink()) {
      const target = await fs.readlink(destination);
      const absoluteTarget = path.resolve(path.dirname(destination), target);
      if (absoluteTarget === path.resolve(resolvedSource)) return;
      await fs.rm(destination, { force: true });
    } else {
      return;
    }
  } catch {
    // Missing link is expected on first install.
  }

  try {
    await fs.symlink(resolvedSource, destination, "dir");
    logger.info(`[agent-provision] Linked references/ into ${params.workspaceDir}`, {});
  } catch (e) {
    logger.warn(`[agent-provision] Failed to link references/: ${String(e).slice(0, 120)}`, {});
  }
}

function resolveWorkspaceDir(params: {
  workflowId: string;
  agent: WorkflowAgent;
}): string {
  const baseDir = params.agent.workspace.baseDir?.trim() || params.agent.id;
  return path.join(resolveAgentWorkspaceRoot(), params.workflowId, baseDir);
}

export async function provisionAgents(params: {
  workflow: WorkflowSpec;
  workflowDir: string;
  bundledSourceDir?: string;
  overwriteFiles?: boolean;
  installSkill?: boolean;
}): Promise<ProvisionedAgent[]> {
  const overwrite = params.overwriteFiles ?? false;
  const workflowRoot = resolveAgentWorkspaceRoot();
  await ensureDir(workflowRoot);

  const results: ProvisionedAgent[] = [];
  for (const agent of params.workflow.agents) {
    const workspaceDir = resolveWorkspaceDir({
      workflowId: params.workflow.id,
      agent,
    });
    await ensureDir(workspaceDir);

    for (const [fileName, relativePath] of Object.entries(agent.workspace.files)) {
      const source = await resolveBootstrapSource({
        agentId: agent.id,
        relativePath,
        workflowDir: params.workflowDir,
        bundledSourceDir: params.bundledSourceDir,
      });
      const destination = path.join(workspaceDir, fileName);
      await writeWorkflowFile({ destination, source, overwrite });
    }

    await ensureReferencesLink({
      workflowDir: params.workflowDir,
      bundledSourceDir: params.bundledSourceDir,
      workspaceDir,
    });

    if (agent.workspace.skills?.length) {
      const skillsDir = path.join(workspaceDir, "skills");
      await ensureDir(skillsDir);
    }

    const agentDir = resolveAgentDir(`${params.workflow.id}_${agent.id}`);
    await ensureDir(agentDir);

    results.push({
      id: `${params.workflow.id}_${agent.id}`,
      name: agent.name,
      model: agent.model,
      timeoutSeconds: agent.timeoutSeconds,
      workspaceDir,
      agentDir,
    });
  }

  if (params.installSkill !== false) {
    await installWorkflowSkill(params.workflow, params.workflowDir);
    await installExternalSkills(params.workflow);
  }

  return results;
}

/**
 * Resolve the source directory for an external skill by checking user skill directories.
 * Returns the path if found, or null if not found.
 */
async function resolveExternalSkillSource(skillName: string): Promise<string | null> {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const candidates = [
    path.join(home, ".openclaw", "workspace", "skills", skillName),
    path.join(home, ".openclaw", "skills", skillName),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (e) {
      logger.debug(`[agent-provision] Skill candidate not found: ${candidate}`, {});
    }
  }
  return null;
}

/**
 * Install external skills (non-bundled) from user skill directories into agent workspaces.
 * Skips bundled skills like "setfarm-workflows" which are handled separately.
 */
async function installExternalSkills(workflow: WorkflowSpec): Promise<void> {
  const bundledSkills = new Set(["setfarm-workflows"]);

  for (const agent of workflow.agents) {
    if (!agent.workspace.skills?.length) continue;

    const externalSkills = agent.workspace.skills.filter(s => !bundledSkills.has(s));
    if (externalSkills.length === 0) continue;

    const workspaceDir = resolveWorkspaceDir({ workflowId: workflow.id, agent });
    const skillsDir = path.join(workspaceDir, "skills");
    await ensureDir(skillsDir);

    for (const skillName of externalSkills) {
      const source = await resolveExternalSkillSource(skillName);
      if (!source) {
        // Warn but don't fail — skill may be optional or installed later
        console.warn(`[setfarm] Skill "${skillName}" not found for agent "${agent.id}", skipping`);
        continue;
      }
      const destination = path.join(skillsDir, skillName);
      await fs.rm(destination, { recursive: true, force: true });
      await fs.cp(source, destination, { recursive: true });
    }
  }
}

async function installWorkflowSkill(workflow: WorkflowSpec, workflowDir: string) {
  const skillSource = path.join(workflowDir, "skills", "setfarm-workflows");
  try {
    await fs.access(skillSource);
  } catch (e) {
    logger.debug(`[agent-provision] Bundled skills directory not found, skipping`, {});
    return;
  }
  for (const agent of workflow.agents) {
    if (!agent.workspace.skills?.includes("setfarm-workflows")) {
      continue;
    }
    const workspaceDir = resolveWorkspaceDir({ workflowId: workflow.id, agent });
    const targetDir = path.join(workspaceDir, "skills");
    await ensureDir(targetDir);
    const destination = path.join(targetDir, "setfarm-workflows");
    await fs.rm(destination, { recursive: true, force: true });
    await fs.cp(skillSource, destination, { recursive: true });
  }
}
