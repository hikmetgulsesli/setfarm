/**
 * Top-level Antfarm installer.
 * Installs the orchestrator cron + all default workflows from a repo.
 */

import { installWorkflow } from "./install.js";
import { ensureOrchestratorCron } from "./gateway-api.js";
import { updateMainAgentGuidance } from "./main-agent-guidance.js";

interface InstallResult {
  cronCreated: boolean;
  cronExists: boolean;
  cronError?: string;
  workflows: Array<{ id: string; ok: boolean; error?: string }>;
}

// Default workflows included in the Antfarm repo
const DEFAULT_WORKFLOWS = ["feature-dev"];

function parseGitHubUrl(url: string): { repoUrl: string; branch: string } | null {
  // Handle formats:
  // - https://github.com/user/repo
  // - https://github.com/user/repo/tree/main
  // - github:user/repo
  const patterns = [
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/,
    /^github:([^\/]+)\/([^\/]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const [, owner, repo, branch] = match;
      return {
        repoUrl: `https://github.com/${owner}/${repo.replace(/\.git$/, "")}`,
        branch: branch ?? "main",
      };
    }
  }
  return null;
}

export async function installAntfarm(repoUrl: string): Promise<InstallResult> {
  const result: InstallResult = {
    cronCreated: false,
    cronExists: false,
    workflows: [],
  };

  // Parse the repo URL
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new Error(`Invalid GitHub URL: ${repoUrl}`);
  }

  // Step 1: Set up the orchestrator cron
  console.log("Setting up orchestrator cron...");
  const cronResult = await ensureOrchestratorCron();
  if (cronResult.ok) {
    result.cronCreated = cronResult.created;
    result.cronExists = !cronResult.created;
    if (cronResult.created) {
      console.log("Created antfarm-orchestrator cron job (runs every 30s)");
    } else {
      console.log("Orchestrator cron already exists");
    }
  } else {
    result.cronError = cronResult.error;
    console.log(`Warning: Could not create cron: ${cronResult.error}`);
    console.log("Run 'antfarm setup' for manual instructions.");
  }

  // Step 2: Install default workflows
  console.log("\nInstalling default workflows...");
  for (const workflowId of DEFAULT_WORKFLOWS) {
    const workflowUrl = `${parsed.repoUrl}/tree/${parsed.branch}/workflows/${workflowId}`;
    console.log(`  Installing ${workflowId}...`);
    try {
      const installResult = await installWorkflow({ source: workflowUrl });
      result.workflows.push({ id: installResult.workflowId, ok: true });
      console.log(`  ✓ ${installResult.workflowId}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      result.workflows.push({ id: workflowId, ok: false, error });
      console.log(`  ✗ ${workflowId}: ${error}`);
    }
  }

  // Step 3: Update main agent guidance
  await updateMainAgentGuidance();

  return result;
}
