import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pgGet } from "../db-pg.js";
import type { CanonicalOperationalEventV1 } from "../execution/schemas/operational-event-v1.js";
import { recordEventObservation } from "./observations.js";

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
  | "operational.event"
  | "run.started" | "run.completed" | "run.failed" | "run.cancel_requested" | "run.cancelled"
  | "runtime.drain_requested" | "runtime.drained" | "runtime.released" | "runtime.quarantined"
  | "runtime.completion_requested" | "runtime.completion_accepted" | "runtime.completion_rejected"
  | "step.pending" | "step.running" | "step.progress" | "step.done" | "step.failed" | "step.timeout" | "step.skipped"
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
  /** Stable operational-outbox idempotency key when publication is durable. */
  eventKey?: string;
  /** Hash of the immutable PostgreSQL event envelope when publication is durable. */
  eventHash?: string;
  /** JSONL is explicitly a cache/projection; PostgreSQL remains authority. */
  projectionAuthority?: "canonical_db" | "non_authoritative";
}

export function emitEvent(evt: SetfarmEvent): void {
  recordEventObservation(evt);
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
    const row = await pgGet<{ notify_url: string | null }>("SELECT notify_url FROM runs WHERE id = $1", [runId]);
    const url = row?.notify_url ?? null;
    notifyUrlCache.set(runId, url);
    return url;
  } catch {
    return null;
  }
}

// Security audit S-5: block SSRF via notify_url targeting private/internal IPs
function isPrivateUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
    if (host === "0.0.0.0" || host.endsWith(".local")) return true;
    // Cloud metadata
    if (host === "169.254.169.254" || host === "metadata.google.internal") return true;
    // RFC 1918 private ranges
    const parts = host.split(".").map(Number);
    if (parts.length === 4 && !parts.some(isNaN)) {
      if (parts[0] === 10) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // Tailscale CGNAT
    }
    return false;
  } catch { return true; } // malformed URL → block
}

function fireWebhook(evt: SetfarmEvent): void {
  getNotifyUrl(evt.runId).then((raw) => {
    if (!raw) return;
    try {
      let url = raw;
      if (isPrivateUrl(url)) {
        console.warn(`[webhook] Blocked private/internal URL: ${url.slice(0, 80)}`);
        return;
      }
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

function projectedOperationalEvent(
  event: CanonicalOperationalEventV1,
  projectionAuthority: "canonical_db" | "non_authoritative",
): SetfarmEvent {
  return {
    ts: event.sourceCreatedAt,
    event: "operational.event",
    eventKey: event.eventKey,
    eventHash: event.eventHash,
    projectionAuthority,
    runId: event.runId,
    detail: event.eventType,
  };
}

function eventProjectionFiles(): string[] {
  try {
    const directory = getEventsDir();
    const base = path.basename(getEventsFile());
    return fs.readdirSync(directory)
      .filter((entry) => entry === base || entry.startsWith(`${base}.`))
      .map((entry) => path.join(directory, entry));
  } catch {
    return [];
  }
}

function jsonlAlreadyProjects(eventKey: string): boolean {
  for (const file of eventProjectionFiles()) {
    try {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      for (const line of lines) {
        if (!line.includes(eventKey)) continue;
        try {
          const parsed = JSON.parse(line) as { eventKey?: unknown };
          if (parsed.eventKey === eventKey) return true;
        } catch {
          // A malformed non-authoritative line never blocks a canonical replay.
        }
      }
    } catch {
      // Rotation can move a file during this scan; the current file is retried on
      // the next durable delivery attempt.
    }
  }
  return false;
}

/**
 * Append-only compatibility projection for CLI readers. This file is never an
 * authority source. A retry scans current and rotated files by eventKey, so a
 * crash after append but before delivery settlement does not append it again.
 */
export function projectOperationalEventToJsonl(event: CanonicalOperationalEventV1): Readonly<{
  schema: "setfarm.operational-jsonl-projection-result.v1";
  deduplicated: boolean;
}> {
  if (jsonlAlreadyProjects(event.eventKey)) {
    return { schema: "setfarm.operational-jsonl-projection-result.v1", deduplicated: true };
  }
  fs.mkdirSync(getEventsDir(), { recursive: true });
  try {
    const stats = fs.statSync(getEventsFile());
    if (stats.size > MAX_EVENTS_SIZE) {
      try {
        fs.renameSync(getEventsFile(), `${getEventsFile()}.${Date.now()}`);
      } catch {
        // Another projection owner may have completed rotation first.
      }
    }
  } catch {
    // First projection has no file yet.
  }
  fs.appendFileSync(
    getEventsFile(),
    `${JSON.stringify(projectedOperationalEvent(event, "non_authoritative"))}\n`,
  );
  return { schema: "setfarm.operational-jsonl-projection-result.v1", deduplicated: false };
}

/**
 * Durable webhook consumer transport. Delivery is at-least-once, bounded by the
 * PostgreSQL delivery owner. Receivers get the stable eventKey in both standard
 * and Setfarm-specific idempotency headers and must deduplicate on that key.
 */
export async function deliverOperationalEventWebhook(
  event: CanonicalOperationalEventV1,
): Promise<Readonly<{
  outcome: "delivered" | "skipped";
  result: Readonly<Record<string, unknown>>;
}>> {
  const raw = await getNotifyUrl(event.runId);
  if (!raw) {
    return {
      outcome: "skipped",
      result: { schema: "setfarm.operational-webhook-delivery-result.v1", reason: "notify_url_absent" },
    };
  }
  let url = raw;
  if (isPrivateUrl(url)) {
    return {
      outcome: "skipped",
      result: { schema: "setfarm.operational-webhook-delivery-result.v1", reason: "private_url_blocked" },
    };
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Idempotency-Key": event.eventKey,
    "X-Setfarm-Event-Key": event.eventKey,
    "X-Setfarm-Event-Hash": event.eventHash,
  };
  const hashIdx = url.indexOf("#auth=");
  if (hashIdx !== -1) {
    headers.Authorization = decodeURIComponent(url.slice(hashIdx + 6));
    url = url.slice(0, hashIdx);
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(projectedOperationalEvent(event, "canonical_db")),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("OPERATIONAL_WEBHOOK_NON_SUCCESS_RESPONSE");
  return {
    outcome: "delivered",
    result: {
      schema: "setfarm.operational-webhook-delivery-result.v1",
      status: response.status,
      idempotencyKey: event.eventKey,
    },
  };
}

function deduplicateDurableEvents(events: SetfarmEvent[]): SetfarmEvent[] {
  const seen = new Set<string>();
  const retained: SetfarmEvent[] = [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]!;
    if (event.eventKey) {
      if (seen.has(event.eventKey)) continue;
      seen.add(event.eventKey);
    }
    retained.push(event);
  }
  return retained.reverse();
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
    return deduplicateDurableEvents(events).slice(-limit);
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
    return deduplicateDurableEvents(events).slice(-limit);
  } catch {
    return [];
  }
}
