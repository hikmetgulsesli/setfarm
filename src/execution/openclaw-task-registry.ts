import { execFileSync } from "node:child_process";
import fs from "node:fs";

import { z } from "zod";

const OpenClawTaskRegistryRowSchema = z.object({
  taskId: z.string().min(1),
  status: z.string().min(1),
  error: z.string().nullable().optional(),
  endedAt: z.number().int().nonnegative().nullable().optional(),
  requesterSessionKey: z.string().nullable().optional(),
  ownerKey: z.string().nullable().optional(),
  childSessionKey: z.string().nullable().optional(),
}).strict();

const OpenClawTaskRegistryRowsSchema = z.array(OpenClawTaskRegistryRowSchema);

export type OpenClawTaskRegistryRow = z.infer<typeof OpenClawTaskRegistryRowSchema>;

export type OpenClawTaskRegistryProbe =
  | Readonly<{
      kind: "unavailable";
      code:
        | "OPENCLAW_TASK_REGISTRY_MISSING"
        | "OPENCLAW_TASK_REGISTRY_READ_FAILED"
        | "OPENCLAW_TASK_REGISTRY_PAYLOAD_INVALID"
        | "OPENCLAW_TASK_REGISTRY_STATUS_UNSUPPORTED";
      diagnostic: string;
    }>
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "ambiguous"; taskIds: readonly string[] }>
  | Readonly<{ kind: "active"; taskId: string; status: "queued" | "running" }>
  | Readonly<{ kind: "settling"; taskId: string; status: string; endedAt: number | null }>
  | Readonly<{
      kind: "terminal";
      task: Readonly<{
        taskId: string;
        status: "succeeded" | "failed" | "timed_out" | "cancelled" | "lost";
        error: string | null;
        endedAt: number;
      }>;
    }>;

const ACTIVE_STATUSES = new Set(["queued", "running"]);
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "timed_out", "cancelled", "lost"]);

function normalizeStatus(value: string): string {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function belongsToSession(row: OpenClawTaskRegistryRow, sessionKey: string): boolean {
  return row.requesterSessionKey === sessionKey
    || row.ownerKey === sessionKey
    || row.childSessionKey === sessionKey;
}

export function classifyOpenClawTaskRegistryRows(
  rows: readonly OpenClawTaskRegistryRow[],
  sessionKey: string,
  nowMs: number,
  settleMs: number,
): OpenClawTaskRegistryProbe {
  const exact = rows.filter((row) => belongsToSession(row, sessionKey));
  if (exact.length === 0) return { kind: "absent" };
  if (exact.length !== 1) {
    return {
      kind: "ambiguous",
      taskIds: exact.map((row) => row.taskId).sort(),
    };
  }

  const row = exact[0]!;
  const status = normalizeStatus(row.status);
  if (ACTIVE_STATUSES.has(status)) {
    return {
      kind: "active",
      taskId: row.taskId,
      status: status as "queued" | "running",
    };
  }
  if (!TERMINAL_STATUSES.has(status)) {
    return {
      kind: "unavailable",
      code: "OPENCLAW_TASK_REGISTRY_STATUS_UNSUPPORTED",
      diagnostic: `Unsupported OpenClaw task registry status: ${status || "empty"}`,
    };
  }

  const endedAt = row.endedAt ?? null;
  const terminalAgeMs = endedAt === null ? -1 : nowMs - endedAt;
  if (endedAt === null || terminalAgeMs < Math.max(0, settleMs)) {
    return { kind: "settling", taskId: row.taskId, status, endedAt };
  }
  return {
    kind: "terminal",
    task: {
      taskId: row.taskId,
      status: status as "succeeded" | "failed" | "timed_out" | "cancelled" | "lost",
      error: row.error ?? null,
      endedAt,
    },
  };
}

function sqliteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function readOpenClawTaskRegistryProbe(input: Readonly<{
  databasePath: string;
  sessionKey: string;
  nowMs: number;
  settleMs: number;
}>): OpenClawTaskRegistryProbe {
  if (!input.databasePath || !fs.existsSync(input.databasePath)) {
    return {
      kind: "unavailable",
      code: "OPENCLAW_TASK_REGISTRY_MISSING",
      diagnostic: "OpenClaw task registry database is unavailable",
    };
  }
  const key = sqliteString(input.sessionKey);
  const sql = [
    "SELECT task_id AS taskId, status, error, ended_at AS endedAt,",
    "requester_session_key AS requesterSessionKey, owner_key AS ownerKey,",
    "child_session_key AS childSessionKey",
    "FROM task_runs",
    "WHERE runtime = 'cli'",
    `AND (requester_session_key = ${key} OR owner_key = ${key} OR child_session_key = ${key})`,
    "ORDER BY created_at DESC;",
  ].join(" ");
  let parsed: unknown;
  try {
    const stdout = execFileSync("sqlite3", ["-json", input.databasePath, sql], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 2_000,
      maxBuffer: 512 * 1024,
    });
    parsed = JSON.parse(stdout || "[]");
  } catch {
    return {
      kind: "unavailable",
      code: "OPENCLAW_TASK_REGISTRY_READ_FAILED",
      diagnostic: "OpenClaw task registry could not be read",
    };
  }
  const decoded = OpenClawTaskRegistryRowsSchema.safeParse(parsed);
  if (!decoded.success) {
    return {
      kind: "unavailable",
      code: "OPENCLAW_TASK_REGISTRY_PAYLOAD_INVALID",
      diagnostic: "OpenClaw task registry returned an invalid task projection",
    };
  }
  return classifyOpenClawTaskRegistryRows(
    decoded.data,
    input.sessionKey,
    input.nowMs,
    input.settleMs,
  );
}
