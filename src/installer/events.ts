import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getDb } from "../db.js";
import { pgGet } from "../db-pg.js";

const USE_PG = process.env.DB_BACKEND === "postgres";

function getEventsDir(): string {
  return process.env.SETFARM_DB_PATH
    ? path.dirname(process.env.SETFARM_DB_PATH)
    : path.join(os.homedir(), ".openclaw", "setfarm");
}
function getEventsFile(): string {
  return path.join(getEventsDir(), "events.jsonl");
}
const MAX_EVENTS_SIZE = 10 * 1024 * 1024; // 10MB

export type EventType =
  | "run.started" | "run.completed" | "run.failed"
  | "step.pending" | "step.running" | "step.done" | "step.failed" | "step.timeout" | "step.skipped"
  | "story.started" | "story.done" | "story.verified" | "story.retry" | "story.failed" | "story.skipped"
  | "pipeline.advanced";

export interface SetfarmEvent {
  ts: string;
  event: EventType;
  runId: string;
  workflowId?: string;
  /** Human-readable step name (e.g. "plan", "implement"), NOT the internal UUID. */
  stepId?: string;
  agentId?: string;
  storyId?: string;
  storyTitle?: string;
  detail?: string;
}

export function emitEvent(evt: SetfarmEvent): void {
  try {
    fs.mkdirSync(getEventsDir(), { recursive: true });
    // Rotate if too large
    try {
      const stats = fs.statSync(getEventsFile());
      if (stats.size > MAX_EVENTS_SIZE) {
        const rotated = getEventsFile() + "." + Date.now();
        try { fs.renameSync(getEventsFile(), rotated); } catch { /* another process already rotated */ }
      }
    } catch { /* events file may not exist yet */ }
    fs.appendFileSync(getEventsFile(), JSON.stringify(evt) + "\n");
  } catch {
    // best-effort, never throw
  }
  fireWebhook(evt);
}

// In-memory cache: runId -> notify_url | null
const notifyUrlCache = new Map<string, string | null>();

async function getNotifyUrl(runId: string): Promise<string | null> {
  if (notifyUrlCache.has(runId)) return notifyUrlCache.get(runId)!;
  try {
    if (USE_PG) {
      const row = await pgGet<{ notify_url: string | null }>("SELECT notify_url FROM runs WHERE id = $1", [runId]);
      const url = row?.notify_url ?? null;
      notifyUrlCache.set(runId, url);
      return url;
    } else {
      const db = getDb();
      const row = db.prepare("SELECT notify_url FROM runs WHERE id = ?").get(runId) as { notify_url: string | null } | undefined;
      const url = row?.notify_url ?? null;
      notifyUrlCache.set(runId, url);
      return url;
    }
  } catch {
    return null;
  }
}

function fireWebhook(evt: SetfarmEvent): void {
  getNotifyUrl(evt.runId).then((raw) => {
    if (!raw) return;
    try {
      let url = raw;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const hashIdx = url.indexOf("#auth=");
      if (hashIdx !== -1) {
        headers["Authorization"] = decodeURIComponent(url.slice(hashIdx + 6));
        url = url.slice(0, hashIdx);
      }
      fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(evt),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    } catch {
      // fire-and-forget
    }
  }).catch(() => {});
}

// Read recent events (last N)
export function getRecentEvents(limit = 50): SetfarmEvent[] {
  try {
    const content = fs.readFileSync(getEventsFile(), "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const events: SetfarmEvent[] = [];
    for (const line of lines) {
      try { events.push(JSON.parse(line) as SetfarmEvent); } catch { /* malformed JSONL line — skip */ }
    }
    return events.slice(-limit);
  } catch {
    return [];
  }
}

// Read events for a specific run (supports prefix match)
export function getRunEvents(runId: string, limit = 200): SetfarmEvent[] {
  try {
    const content = fs.readFileSync(getEventsFile(), "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const events: SetfarmEvent[] = [];
    for (const line of lines) {
      try {
        const evt = JSON.parse(line) as SetfarmEvent;
        if (evt.runId === runId || evt.runId.startsWith(runId)) events.push(evt);
      } catch { /* malformed JSONL line — skip */ }
    }
    return events.slice(-limit);
  } catch {
    return [];
  }
}
