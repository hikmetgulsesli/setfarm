/**
 * Direct OpenClaw Gateway API calls from the CLI.
 * This allows the installer to create cron jobs without needing agent context.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

interface GatewayConfig {
  url: string;
  token?: string;
}

async function readOpenClawConfig(): Promise<{ port?: number; token?: string }> {
  const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
  try {
    const content = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(content);
    return {
      port: config.gateway?.port,
      token: config.gateway?.auth?.token,
    };
  } catch {
    return {};
  }
}

async function getGatewayConfig(): Promise<GatewayConfig> {
  const config = await readOpenClawConfig();
  const port = config.port ?? 18789;
  return {
    url: `http://127.0.0.1:${port}`,
    token: config.token,
  };
}

export async function createCronJob(job: {
  name: string;
  schedule: { kind: string; everyMs?: number };
  payload: { kind: string; message: string };
  sessionTarget: string;
  delivery?: { mode: string };
  enabled: boolean;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const gateway = await getGatewayConfig();
  
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (gateway.token) {
      headers["Authorization"] = `Bearer ${gateway.token}`;
    }

    // Use /tools/invoke endpoint to call the cron tool
    const response = await fetch(`${gateway.url}/tools/invoke`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tool: "cron",
        args: { action: "add", job },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `Gateway returned ${response.status}: ${text}` };
    }

    const result = await response.json();
    if (!result.ok) {
      return { ok: false, error: result.error?.message ?? "Unknown error" };
    }
    return { ok: true, id: result.result?.id };
  } catch (err) {
    return { ok: false, error: `Failed to call gateway: ${err}` };
  }
}

export async function listCronJobs(): Promise<{ ok: boolean; jobs?: Array<{ id: string; name: string }>; error?: string }> {
  const gateway = await getGatewayConfig();
  
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (gateway.token) {
      headers["Authorization"] = `Bearer ${gateway.token}`;
    }

    // Use /tools/invoke endpoint to call the cron tool
    const response = await fetch(`${gateway.url}/tools/invoke`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tool: "cron",
        args: { action: "list" },
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `Gateway returned ${response.status}` };
    }

    const result = await response.json();
    if (!result.ok) {
      return { ok: false, error: result.error?.message ?? "Unknown error" };
    }
    // Handle both { result: { jobs } } and { jobs } formats
    const jobs = result.result?.jobs ?? result.jobs ?? [];
    return { ok: true, jobs };
  } catch (err) {
    return { ok: false, error: `Failed to call gateway: ${err}` };
  }
}

export async function ensureOrchestratorCron(): Promise<{ ok: boolean; created: boolean; error?: string }> {
  // Check if cron already exists
  const listResult = await listCronJobs();
  if (!listResult.ok) {
    return { ok: false, created: false, error: listResult.error };
  }

  const existing = listResult.jobs?.find((j) => j.name === "antfarm-orchestrator");
  if (existing) {
    return { ok: true, created: false };
  }

  // Create the cron job
  const cronJob = {
    name: "antfarm-orchestrator",
    schedule: { kind: "every", everyMs: 30000 },
    payload: {
      kind: "agentTurn",
      message: `Antfarm workflow orchestrator.

Step 1: Run check to detect completions and queue spawns
\`\`\`
cd ~/.openclaw/workspace/antfarm && node dist/cli/cli.js check 2>&1
\`\`\`

Step 2: List pending spawns
\`\`\`
cd ~/.openclaw/workspace/antfarm && node dist/cli/cli.js queue
\`\`\`

Step 3: For each file listed, read it with cat ~/.openclaw/antfarm/spawn-queue/<filename>, then call sessions_spawn with the agentId, task, and label (sessionLabel field)

Step 4: After successful spawn, run: node dist/cli/cli.js dequeue <filename>

If no active runs and no spawn files, reply: HEARTBEAT_OK`,
    },
    sessionTarget: "isolated",
    delivery: { mode: "none" },
    enabled: true,
  };

  const createResult = await createCronJob(cronJob);
  if (!createResult.ok) {
    return { ok: false, created: false, error: createResult.error };
  }

  return { ok: true, created: true };
}
