import path from "node:path";
import { resolveStackContract } from "./reconcile.js";
import { writeStackContract } from "./ledger.js";
import type { StackCommandSet, StackContract } from "./types.js";

export interface StackContractContextOptions {
  repoPath?: string;
  taskText?: string;
  projectSlug?: string;
  persist?: boolean;
}

export function applyStackContractContext(
  context: Record<string, string>,
  options: StackContractContextOptions = {},
): StackContract {
  const repoPath = normalizeRepoPath(options.repoPath || context["story_workdir"] || context["repo"] || context["REPO"] || "");
  const taskText = options.taskText || context["prd"] || context["task"] || context["TASK"] || "";
  const contract = resolveStackContract({
    repoPath: repoPath || undefined,
    taskText,
    projectSlug: options.projectSlug || context["project_slug"] || context["PROJECT_SLUG"] || undefined,
  });

  if (options.persist !== false && repoPath) {
    writeStackContract(repoPath, contract);
  }

  context["stack_contract"] = formatStackContractForPrompt(contract);
  context["stack_pack_id"] = contract.packId || "needs-reconcile";
  context["stack_prompt"] = contract.prompt;
  context["stack_setup_contract"] = formatCommandContract(contract.setup);
  context["stack_verification_contract"] = formatVerificationContract(contract.verification);
  context["stack_runtime_contract"] = formatRuntimeContract(contract);
  context["stack_tool_preflight_contract"] = formatToolPreflightContract(contract);

  // Compatibility aliases for the current prompt/guard migration.
  context["detected_stack"] = contract.packId || "unknown";
  context["stack_rules"] = contract.prompt;

  return contract;
}

export function formatStackContractForPrompt(contract: StackContract): string {
  const evidence = contract.evidence
    .slice(0, 8)
    .map((item) => `- ${item.type}: ${item.path || item.value} (${item.weight})`)
    .join("\n") || "- none";
  return [
    `Schema: ${contract.schema}`,
    `Status: ${contract.status}`,
    `Pack: ${contract.packId || "needs-reconcile"}`,
    `Confidence: ${contract.confidence}`,
    `Reason: ${contract.reason}`,
    "Evidence:",
    evidence,
  ].join("\n");
}

function formatCommandContract(commands: StackCommandSet): string {
  const lines = Object.entries(commands)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `- ${key}: ${value}`);
  return lines.length > 0 ? lines.join("\n") : "- no stack-specific commands resolved";
}

function formatVerificationContract(verification: StackContract["verification"]): string {
  const lines: string[] = [];
  for (const [key, values] of Object.entries(verification)) {
    if (Array.isArray(values) && values.length > 0) {
      lines.push(`- ${key}: ${values.join("; ")}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : "- no stack-specific verification resolved";
}

function formatRuntimeContract(contract: StackContract): string {
  const runtime = contract.runtime;
  if (!runtime || runtime.service === "none") return "- no runtime required";
  return [
    `- service: ${runtime.service}`,
    `- host: ${runtime.host}`,
    `- port_policy: ${runtime.portPolicy}`,
    runtime.portBand ? `- port_band: ${runtime.portBand}` : "",
    runtime.previewCommand ? `- preview: ${runtime.previewCommand}` : "",
    runtime.devCommand ? `- dev: ${runtime.devCommand}` : "",
    `- readiness: ${runtime.readinessProbe}`,
    `- smoke_runner: ${runtime.smokeRunner}`,
  ].filter(Boolean).join("\n");
}

function formatToolPreflightContract(contract: StackContract): string {
  const tools = contract.toolPreflight || [];
  if (tools.length === 0) return "- no stack-specific tool preflight required";
  return tools.map((tool) => `- ${tool.tool}: ${tool.command} (${tool.required ? "required" : "optional"})`).join("\n");
}

function normalizeRepoPath(value: string): string {
  if (!value) return "";
  return path.resolve(value.replace(/^~/, process.env.HOME || "~"));
}
