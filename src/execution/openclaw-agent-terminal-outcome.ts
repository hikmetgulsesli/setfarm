import fs from "node:fs";

import { z } from "zod";

const DEFAULT_MAX_TRANSCRIPT_BYTES = 8 * 1024 * 1024;

const OpenClawAgentEnvelopeSchema = z
  .object({
    runId: z.string().min(1),
    status: z.string().min(1).max(160),
    summary: z.string().optional(),
    stopReason: z.string().optional(),
    result: z
      .object({
        payloads: z
          .array(z.object({ text: z.string().optional() }).passthrough())
          .optional(),
        meta: z
          .object({
            aborted: z.boolean().optional(),
            stopReason: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

type OpenClawAgentEnvelope = z.infer<typeof OpenClawAgentEnvelopeSchema>;

export type OpenClawAgentTerminalOutcomeV1 =
  | Readonly<{
      schema: "setfarm.openclaw-agent-terminal-outcome.v1";
      kind: "completed";
      status: string;
    }>
  | Readonly<{
      schema: "setfarm.openclaw-agent-terminal-outcome.v1";
      kind: "transient_failure" | "terminal_failure";
      code:
        | "OPENCLAW_AGENT_TIMEOUT"
        | "OPENCLAW_AGENT_ABORTED"
        | "OPENCLAW_AGENT_CANCELLED"
        | "OPENCLAW_AGENT_FAILED"
        | "OPENCLAW_AGENT_STATUS_UNSUPPORTED";
      status: string;
      diagnostic: string;
      retryable: boolean;
    }>
  | Readonly<{
      schema: "setfarm.openclaw-agent-terminal-outcome.v1";
      kind: "unavailable";
      code: "OPENCLAW_AGENT_ENVELOPE_UNAVAILABLE" | "OPENCLAW_AGENT_TRANSCRIPT_OVERSIZED";
      diagnostic: string;
    }>;

function balancedObjectEnd(text: string, start: number): number | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
      if (depth < 0) return null;
    }
  }
  return null;
}

function envelopeFromTranscript(text: string): OpenClawAgentEnvelope | null {
  let cursor = 0;
  let attempts = 0;
  let latest: OpenClawAgentEnvelope | null = null;
  while (cursor < text.length && attempts < 64) {
    const start = text.indexOf("{", cursor);
    if (start === -1) break;
    attempts += 1;
    const end = balancedObjectEnd(text, start);
    if (end === null) {
      cursor = start + 1;
      continue;
    }
    try {
      const decoded = OpenClawAgentEnvelopeSchema.safeParse(JSON.parse(text.slice(start, end)));
      if (decoded.success) latest = decoded.data;
    } catch {
      // The transcript may contain non-JSON braces in diagnostics before the
      // one machine-readable OpenClaw terminal envelope.
    }
    cursor = end;
  }
  return latest;
}

function normalizeStatus(value: string): string {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function safeDiagnostic(value: unknown): string {
  return String(value || "")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function envelopeDiagnostic(envelope: OpenClawAgentEnvelope, fallback: string): string {
  const payload = envelope.result?.payloads
    ?.map((item) => safeDiagnostic(item.text))
    .find(Boolean);
  return payload || safeDiagnostic(envelope.stopReason) || safeDiagnostic(envelope.summary) || fallback;
}

function normalizeEnvelope(envelope: OpenClawAgentEnvelope): OpenClawAgentTerminalOutcomeV1 {
  const status = normalizeStatus(envelope.status);
  const stopReason = normalizeStatus(envelope.result?.meta?.stopReason || envelope.stopReason || "");
  if (["completed", "success", "succeeded", "ok"].includes(status)) {
    return {
      schema: "setfarm.openclaw-agent-terminal-outcome.v1",
      kind: "completed",
      status,
    };
  }
  if (["timeout", "timed_out"].includes(status)) {
    return {
      schema: "setfarm.openclaw-agent-terminal-outcome.v1",
      kind: "transient_failure",
      code: "OPENCLAW_AGENT_TIMEOUT",
      status,
      diagnostic: envelopeDiagnostic(envelope, "OpenClaw agent request timed out"),
      retryable: true,
    };
  }
  if (status === "aborted" || stopReason === "aborted" || envelope.result?.meta?.aborted === true) {
    return {
      schema: "setfarm.openclaw-agent-terminal-outcome.v1",
      kind: "terminal_failure",
      code: "OPENCLAW_AGENT_ABORTED",
      status,
      diagnostic: envelopeDiagnostic(envelope, "OpenClaw agent request was aborted"),
      retryable: false,
    };
  }
  if (["cancelled", "canceled"].includes(status)) {
    return {
      schema: "setfarm.openclaw-agent-terminal-outcome.v1",
      kind: "terminal_failure",
      code: "OPENCLAW_AGENT_CANCELLED",
      status,
      diagnostic: envelopeDiagnostic(envelope, "OpenClaw agent request was cancelled"),
      retryable: false,
    };
  }
  if (["failed", "failure", "error"].includes(status)) {
    return {
      schema: "setfarm.openclaw-agent-terminal-outcome.v1",
      kind: "terminal_failure",
      code: "OPENCLAW_AGENT_FAILED",
      status,
      diagnostic: envelopeDiagnostic(envelope, "OpenClaw agent request failed"),
      retryable: false,
    };
  }
  return {
    schema: "setfarm.openclaw-agent-terminal-outcome.v1",
    kind: "terminal_failure",
    code: "OPENCLAW_AGENT_STATUS_UNSUPPORTED",
    status,
    diagnostic: `Unsupported OpenClaw terminal status: ${safeDiagnostic(status) || "empty"}`,
    retryable: false,
  };
}

export function decodeOpenClawAgentTerminalTranscript(
  transcript: string,
  maxBytes = DEFAULT_MAX_TRANSCRIPT_BYTES,
): OpenClawAgentTerminalOutcomeV1 {
  if (Buffer.byteLength(transcript, "utf8") > maxBytes) {
    return {
      schema: "setfarm.openclaw-agent-terminal-outcome.v1",
      kind: "unavailable",
      code: "OPENCLAW_AGENT_TRANSCRIPT_OVERSIZED",
      diagnostic: `OpenClaw transcript exceeds the ${maxBytes}-byte terminal envelope boundary`,
    };
  }
  const envelope = envelopeFromTranscript(transcript);
  if (!envelope) {
    return {
      schema: "setfarm.openclaw-agent-terminal-outcome.v1",
      kind: "unavailable",
      code: "OPENCLAW_AGENT_ENVELOPE_UNAVAILABLE",
      diagnostic: "OpenClaw transcript contains no valid terminal envelope",
    };
  }
  return normalizeEnvelope(envelope);
}

export function readOpenClawAgentTerminalOutcome(
  transcriptPath: string,
  maxBytes = DEFAULT_MAX_TRANSCRIPT_BYTES,
): OpenClawAgentTerminalOutcomeV1 {
  try {
    const stat = fs.statSync(transcriptPath);
    if (!stat.isFile() || stat.size > maxBytes) {
      return {
        schema: "setfarm.openclaw-agent-terminal-outcome.v1",
        kind: "unavailable",
        code: stat.size > maxBytes
          ? "OPENCLAW_AGENT_TRANSCRIPT_OVERSIZED"
          : "OPENCLAW_AGENT_ENVELOPE_UNAVAILABLE",
        diagnostic: stat.size > maxBytes
          ? `OpenClaw transcript exceeds the ${maxBytes}-byte terminal envelope boundary`
          : "OpenClaw terminal transcript is not a regular file",
      };
    }
    return decodeOpenClawAgentTerminalTranscript(fs.readFileSync(transcriptPath, "utf8"), maxBytes);
  } catch {
    return {
      schema: "setfarm.openclaw-agent-terminal-outcome.v1",
      kind: "unavailable",
      code: "OPENCLAW_AGENT_ENVELOPE_UNAVAILABLE",
      diagnostic: "OpenClaw terminal transcript could not be read",
    };
  }
}

export class OpenClawAgentTerminalError extends Error {
  readonly outcome: Extract<
    OpenClawAgentTerminalOutcomeV1,
    { kind: "transient_failure" | "terminal_failure" }
  >;

  constructor(outcome: Extract<
    OpenClawAgentTerminalOutcomeV1,
    { kind: "transient_failure" | "terminal_failure" }
  >) {
    super(`${outcome.code}: ${outcome.diagnostic}`);
    this.name = "OpenClawAgentTerminalError";
    this.outcome = outcome;
  }
}
