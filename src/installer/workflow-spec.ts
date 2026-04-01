import fs from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { LoopConfig, PollingConfig, WorkflowAgent, WorkflowSpec, WorkflowStep } from "./types.js";

import { logger } from "../lib/logger.js";
/**
 * Resolve !include directives in raw YAML content.
 * Replaces lines matching `!include <filename>` with the content of the
 * referenced file from the _fragments directory, preserving indentation.
 * Runs before YAML.parse() — pure text-level replacement.
 */
function resolveIncludes(raw: string, workflowDir: string): string {
  const fragmentsDir = path.join(workflowDir, "..", "_fragments");
  if (!existsSync(fragmentsDir)) {
    if (raw.includes("!include ")) {
      logger.warn(`[workflow-spec] _fragments directory missing at ${fragmentsDir} — !include directives will be passed as raw text to agents`);
    }
    return raw;
  }

  const lines = raw.split("\n");
  const resolved: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(\s*)!include\s+(\S+)\s*$/);
    if (match) {
      const indent = match[1];
      const fragmentName = match[2];
      const fragmentPath = path.resolve(fragmentsDir, fragmentName);
      if (existsSync(fragmentPath)) {
        const content = readFileSync(fragmentPath, "utf-8").trimEnd();
        for (const fLine of content.split("\n")) {
          resolved.push(fLine.length > 0 ? indent + fLine : "");
        }
      } else {
        logger.warn(`[workflow-spec] Fragment not found: ${fragmentPath} — include directive will be passed as raw text`);
        resolved.push(line);
      }
    } else {
      resolved.push(line);
    }
  }

  return resolved.join("\n");
}

export async function loadWorkflowSpec(workflowDir: string): Promise<WorkflowSpec> {
  const filePath = path.join(workflowDir, "workflow.yml");
  const raw = await fs.readFile(filePath, "utf-8");
  const resolved = resolveIncludes(raw, workflowDir);
  const parsed = YAML.parse(resolved) as WorkflowSpec;
  if (!parsed?.id) {
    throw new Error(`workflow.yml missing id in ${workflowDir}`);
  }
  if (parsed.id.includes("_")) {
    throw new Error(`workflow.yml id "${parsed.id}" must not contain underscores`);
  }
  if (!Array.isArray(parsed.agents) || parsed.agents.length === 0) {
    throw new Error(`workflow.yml missing agents list in ${workflowDir}`);
  }
  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error(`workflow.yml missing steps list in ${workflowDir}`);
  }
  if (parsed.polling) {
    validatePollingConfig(parsed.polling, workflowDir);
  }
  validateAgents(parsed.agents, workflowDir);
  // Parse type/loop from raw YAML before validation
  for (const step of parsed.steps) {
    const rawStep = step as any;
    if (rawStep.type) {
      step.type = rawStep.type;
    }
    if (rawStep.loop) {
      step.loop = parseLoopConfig(rawStep.loop);
    }
  }
  validateSteps(parsed.steps, workflowDir);
  return parsed;
}

function validatePollingConfig(polling: PollingConfig, workflowDir: string) {
  if (polling.timeoutSeconds !== undefined && polling.timeoutSeconds <= 0) {
    throw new Error(`workflow.yml polling.timeoutSeconds must be positive in ${workflowDir}`);
  }
}

function validateAgents(agents: WorkflowAgent[], workflowDir: string) {
  const ids = new Set<string>();
  for (const agent of agents) {
    if (!agent.id?.trim()) {
      throw new Error(`workflow.yml missing agent id in ${workflowDir}`);
    }
    if (agent.id.includes("_")) {
      throw new Error(`workflow.yml agent "${agent.id}" must not contain underscores (reserved as namespace separator)`);
    }
    if (ids.has(agent.id)) {
      throw new Error(`workflow.yml has duplicate agent id "${agent.id}" in ${workflowDir}`);
    }
    ids.add(agent.id);
    if (!agent.workspace?.baseDir?.trim()) {
      throw new Error(`workflow.yml missing workspace.baseDir for agent "${agent.id}"`);
    }
    if (!agent.workspace?.files || Object.keys(agent.workspace.files).length === 0) {
      throw new Error(`workflow.yml missing workspace.files for agent "${agent.id}"`);
    }
    if (agent.workspace.skills && !Array.isArray(agent.workspace.skills)) {
      throw new Error(`workflow.yml workspace.skills must be a list for agent "${agent.id}"`);
    }
    if (agent.timeoutSeconds !== undefined && agent.timeoutSeconds <= 0) {
      throw new Error(`workflow.yml agent "${agent.id}" timeoutSeconds must be positive`);
    }
  }
}

function parseLoopConfig(raw: any): LoopConfig {
  return {
    over: raw.over,
    completion: raw.completion,
    freshSession: raw.fresh_session ?? raw.freshSession,
    verifyEach: raw.verify_each ?? raw.verifyEach,
    verifyStep: raw.verify_step ?? raw.verifyStep,
    parallelCount: raw.parallel_count ?? raw.parallelCount,
    mergeStrategy: raw.merge_strategy ?? raw.mergeStrategy,
  };
}

function validateSteps(steps: WorkflowStep[], workflowDir: string) {
  const ids = new Set<string>();
  for (const step of steps) {
    if (!step.id?.trim()) {
      throw new Error(`workflow.yml missing step id in ${workflowDir}`);
    }
    if (ids.has(step.id)) {
      throw new Error(`workflow.yml has duplicate step id "${step.id}" in ${workflowDir}`);
    }
    ids.add(step.id);
    if (!step.agent?.trim()) {
      throw new Error(`workflow.yml missing step.agent for step "${step.id}"`);
    }
    if (!step.input?.trim()) {
      throw new Error(`workflow.yml missing step.input for step "${step.id}"`);
    }
    if (!step.expects?.trim()) {
      throw new Error(`workflow.yml missing step.expects for step "${step.id}"`);
    }
  }

  // Validate loop config references
  for (const step of steps) {
    if (step.type === "loop") {
      if (!step.loop) {
        throw new Error(`workflow.yml step "${step.id}" has type=loop but no loop config`);
      }
      if (step.loop.over !== "stories") {
        throw new Error(`workflow.yml step "${step.id}" loop.over must be "stories"`);
      }
      if (step.loop.completion !== "all_done") {
        throw new Error(`workflow.yml step "${step.id}" loop.completion must be "all_done"`);
      }
      if (step.loop.verifyEach && step.loop.verifyStep) {
        if (!ids.has(step.loop.verifyStep)) {
          throw new Error(`workflow.yml step "${step.id}" loop.verify_step references unknown step "${step.loop.verifyStep}"`);
        }
      }
    }
  }
}
