import fs from "node:fs/promises";
import path from "node:path";
import { readOpenClawConfig } from "./openclaw-config.js";

const WORKFLOW_BLOCK_START = "<!-- antfarm:workflows -->";
const WORKFLOW_BLOCK_END = "<!-- /antfarm:workflows -->";

const CLI = "node ~/.openclaw/workspace/antfarm/dist/cli/cli.js";

const TOOLS_BLOCK = `${WORKFLOW_BLOCK_START}
# Antfarm Workflows

Antfarm CLI (always use full path to avoid PATH issues):
\`${CLI}\`

Commands:
- Install: \`${CLI} workflow install <name>\`
- Run: \`${CLI} workflow run <workflow-id> "<task>"\`
- Status: \`${CLI} workflow status "<task title>"\`
- Logs: \`${CLI} logs\`

Workflows are self-advancing via per-agent cron jobs. No manual orchestration needed.

## DELEGATION RULE (CRITICAL)
- When a user asks for a new project/feature/app: DO NOT code it yourself. You are the orchestrator, not the developer.
- ALWAYS delegate to antfarm workflow: \`${CLI} workflow run feature-dev "<task>"\`
- Get next available port: \`curl -s http://127.0.0.1:3080/api/projects/next-port\`
- ALWAYS specify the repo directory explicitly in the task description:
  - Format: REPO: /home/setrox/<project-name>
  - The project name should be kebab-case (lowercase, hyphens)
- ALWAYS include the port in the task description: Frontend port: <port>
- After starting the workflow, monitor progress and report to the user
${WORKFLOW_BLOCK_END}
`;

const AGENTS_BLOCK = `${WORKFLOW_BLOCK_START}
# Antfarm Workflow Policy

## Installing Workflows
Run: \`${CLI} workflow install <name>\`
Agent cron jobs are created automatically during install.

## Running Workflows
- Start: \`${CLI} workflow run <workflow-id> "<task>"\`
- Status: \`${CLI} workflow status "<task title>"\`
- Workflows self-advance via agent cron jobs polling SQLite for pending steps.

## DELEGATION RULE (CRITICAL)
- When a user asks for a new project/feature/app: DO NOT code it yourself. You are the orchestrator, not the developer.
- ALWAYS delegate to antfarm workflow: \`${CLI} workflow run feature-dev "<task>"\`
- Get next available port: \`curl -s http://127.0.0.1:3080/api/projects/next-port\`
- ALWAYS specify the repo directory explicitly in the task description:
  - Format: REPO: /home/setrox/<project-name>
  - The project name should be kebab-case (lowercase, hyphens)
- ALWAYS include the port in the task description: Frontend port: <port>
- After starting the workflow, monitor progress and report to the user
${WORKFLOW_BLOCK_END}
`;

function removeBlock(content: string): string {
  const start = content.indexOf(WORKFLOW_BLOCK_START);
  const end = content.indexOf(WORKFLOW_BLOCK_END);
  if (start === -1 || end === -1) return content;
  const after = end + WORKFLOW_BLOCK_END.length;
  const beforeText = content.slice(0, start).trimEnd();
  const afterText = content.slice(after).trimStart();
  if (!beforeText) return afterText ? `${afterText}\n` : "";
  if (!afterText) return `${beforeText}\n`;
  return `${beforeText}\n\n${afterText}\n`;
}

function upsertBlock(content: string, block: string): string {
  const cleaned = removeBlock(content);
  if (!cleaned.trim()) return `${block}\n`;
  return `${cleaned.trimEnd()}\n\n${block}\n`;
}

async function readFileOrEmpty(filePath: string): Promise<string> {
  try { return await fs.readFile(filePath, "utf-8"); } catch { return ""; }
}

function resolveMainAgentWorkspacePath(cfg: { agents?: { defaults?: { workspace?: string } } }) {
  const workspace = cfg.agents?.defaults?.workspace?.trim();
  if (workspace) return workspace;
  return path.join(process.env.HOME ?? "", ".openclaw", "workspace");
}

export async function updateMainAgentGuidance(): Promise<void> {
  const { config } = await readOpenClawConfig();
  const workspaceDir = resolveMainAgentWorkspacePath(config as { agents?: { defaults?: { workspace?: string } } });
  const toolsPath = path.join(workspaceDir, "TOOLS.md");
  const agentsPath = path.join(workspaceDir, "AGENTS.md");

  const toolsContent = await readFileOrEmpty(toolsPath);
  const agentsContent = await readFileOrEmpty(agentsPath);

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(toolsPath, upsertBlock(toolsContent, TOOLS_BLOCK), "utf-8");
  await fs.writeFile(agentsPath, upsertBlock(agentsContent, AGENTS_BLOCK), "utf-8");
}

export async function removeMainAgentGuidance(): Promise<void> {
  const { config } = await readOpenClawConfig();
  const workspaceDir = resolveMainAgentWorkspacePath(config as { agents?: { defaults?: { workspace?: string } } });
  const toolsPath = path.join(workspaceDir, "TOOLS.md");
  const agentsPath = path.join(workspaceDir, "AGENTS.md");

  const toolsContent = await readFileOrEmpty(toolsPath);
  const agentsContent = await readFileOrEmpty(agentsPath);

  if (toolsContent) await fs.writeFile(toolsPath, removeBlock(toolsContent), "utf-8");
  if (agentsContent) await fs.writeFile(agentsPath, removeBlock(agentsContent), "utf-8");
}
