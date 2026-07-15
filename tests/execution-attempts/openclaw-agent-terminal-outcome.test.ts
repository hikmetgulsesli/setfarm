import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OpenClawAgentTerminalError,
  decodeOpenClawAgentTerminalTranscript,
} from "../../src/execution/openclaw-agent-terminal-outcome.js";

function transcript(value: unknown): string {
  return [
    "[spawner] runtime=openclaw",
    JSON.stringify(value, null, 2),
    "--- EXIT code=0 signal= ---",
  ].join("\n");
}

describe("OpenClaw machine-readable terminal outcome", () => {
  it("classifies the #2024 timeout envelope as typed transient infrastructure", () => {
    const outcome = decodeOpenClawAgentTerminalTranscript(transcript({
      runId: "provider-run",
      status: "timeout",
      summary: "aborted",
      stopReason: "aborted",
      result: {
        payloads: [{ text: "LLM request timed out." }],
        meta: { aborted: true, stopReason: "aborted" },
      },
    }));

    assert.deepEqual(outcome, {
      schema: "setfarm.openclaw-agent-terminal-outcome.v1",
      kind: "transient_failure",
      code: "OPENCLAW_AGENT_TIMEOUT",
      status: "timeout",
      diagnostic: "LLM request timed out.",
      retryable: true,
    });
    if (outcome.kind !== "transient_failure") assert.fail("expected transient failure");
    assert.equal(new OpenClawAgentTerminalError(outcome).message, "OPENCLAW_AGENT_TIMEOUT: LLM request timed out.");
  });

  it("uses the last valid envelope and preserves braces inside JSON strings", () => {
    const value = [
      "diagnostic {not-json}",
      JSON.stringify({ status: "unknown-intermediate" }),
      JSON.stringify({
        runId: "provider-run",
        status: "completed",
        result: { payloads: [{ text: "Rendered {one} contract" }] },
      }),
      "--- FINISHED ---",
    ].join("\n");

    assert.deepEqual(decodeOpenClawAgentTerminalTranscript(value), {
      schema: "setfarm.openclaw-agent-terminal-outcome.v1",
      kind: "completed",
      status: "completed",
    });
  });

  it("keeps explicit failed and unknown statuses terminal instead of trusting process code zero", () => {
    const failed = decodeOpenClawAgentTerminalTranscript(transcript({
      runId: "provider-run",
      status: "failed",
      result: { payloads: [{ text: "provider rejected request" }] },
    }));
    assert.equal(failed.kind, "terminal_failure");
    if (failed.kind !== "terminal_failure") assert.fail("expected terminal failure");
    assert.equal(failed.code, "OPENCLAW_AGENT_FAILED");
    assert.equal(failed.retryable, false);

    const unknown = decodeOpenClawAgentTerminalTranscript(transcript({
      runId: "provider-run",
      status: "new-provider-state",
    }));
    assert.equal(unknown.kind, "terminal_failure");
    if (unknown.kind !== "terminal_failure") assert.fail("expected terminal failure");
    assert.equal(unknown.code, "OPENCLAW_AGENT_STATUS_UNSUPPORTED");
  });

  it("keeps ambiguous abort and cancellation terminal without prose classifiers", () => {
    const aborted = decodeOpenClawAgentTerminalTranscript(transcript({
      runId: "provider-run",
      status: "running",
      result: { meta: { aborted: true } },
    }));
    assert.equal(aborted.kind, "terminal_failure");
    if (aborted.kind !== "terminal_failure") assert.fail("expected terminal failure");
    assert.equal(aborted.code, "OPENCLAW_AGENT_ABORTED");
    assert.equal(aborted.retryable, false);

    const cancelled = decodeOpenClawAgentTerminalTranscript(transcript({
      runId: "provider-run",
      status: "cancelled",
    }));
    assert.equal(cancelled.kind, "terminal_failure");
    if (cancelled.kind !== "terminal_failure") assert.fail("expected terminal failure");
    assert.equal(cancelled.code, "OPENCLAW_AGENT_CANCELLED");
    assert.equal(cancelled.retryable, false);
  });

  it("fails closed for absent or oversized envelopes and redacts diagnostic credentials", () => {
    const absent = decodeOpenClawAgentTerminalTranscript("plain process output");
    assert.equal(absent.kind, "unavailable");
    assert.equal(absent.code, "OPENCLAW_AGENT_ENVELOPE_UNAVAILABLE");

    const oversized = decodeOpenClawAgentTerminalTranscript(transcript({
      runId: "provider-run",
      status: "completed",
    }), 10);
    assert.equal(oversized.kind, "unavailable");
    assert.equal(oversized.code, "OPENCLAW_AGENT_TRANSCRIPT_OVERSIZED");

    const redacted = decodeOpenClawAgentTerminalTranscript(transcript({
      runId: "provider-run",
      status: "failed",
      result: { payloads: [{ text: "Authorization: Bearer secret-token and sk-sensitive123" }] },
    }));
    assert.equal(redacted.kind, "terminal_failure");
    if (redacted.kind !== "terminal_failure") assert.fail("expected terminal failure");
    assert.doesNotMatch(redacted.diagnostic, /secret-token|sk-sensitive123/);
  });
});
