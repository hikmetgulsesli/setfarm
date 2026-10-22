import test from "node:test";
import { Buffer } from "node:buffer";
import { runManualOrphanBootstrapIntegrationV1 } from "./helpers/manual-control-orphan-bootstrap-fixture-v1.js";

// Inert until the actual test binds its original output channels. Once set,
// output uncertainty dominates even a later fixed fixture refusal.
let integrationOutputFaultV1 = false;

function retainManualOrphanIntegrationMarkerWriterV1() {
  let unknown = integrationOutputFaultV1;
  let writeAttempted = false, callbackPending = false, callbackSeen = false;
  let stdout: typeof process.stdout;
  let stderr: typeof process.stderr;
  const mark = (): void => {
    unknown = true;
    integrationOutputFaultV1 = true;
    try { process.exitCode = 1; } catch { /* Both sticky flags survive assignment failure. */ }
  };
  try {
    stdout = process.stdout;
    stdout.on("error", mark);
    stderr = process.stderr;
    stderr.on("error", mark);
  } catch {
    mark();
    throw new Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
  }

  return async (data: unknown): Promise<void> => {
    if (writeAttempted || unknown || integrationOutputFaultV1) {
      mark();
      throw new Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
    }
    writeAttempted = true;
    let bytes: Buffer;
    let method: typeof process.stdout.write;
    try {
      // DATA is the actual fixture's codec-normalized result. Preserve its
      // order and values; the parent collector remains the acceptance gate.
      const payload = JSON.stringify(data);
      if (typeof payload !== "string") throw new Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
      bytes = Buffer.from("MANUAL_ORPHAN_INTEGRATION_RESULT " + payload + "\n", "utf8");
      if (bytes.length > 16384) throw new Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
      method = stdout.write.bind(stdout);
      if (unknown || integrationOutputFaultV1) throw new Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
    } catch {
      mark();
      throw new Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
    }
    callbackPending = true;
    const originalWrite = new Promise<void>((resolve, reject) => {
      const done = (error?: Error | null): void => {
        if (callbackSeen || !callbackPending) { mark(); return; }
        callbackSeen = true;
        callbackPending = false;
        if (error) mark();
        if (unknown || integrationOutputFaultV1) reject(new Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN"));
        else resolve();
      };
      // Invocation acquires the original callback obligation. Neither a throw
      // nor a channel error can invent its arrival or authorize a retry.
      try { method(bytes, done); } catch { mark(); }
    });
    await originalWrite;
    if (unknown || integrationOutputFaultV1) throw new Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
    // Listeners and the original callback remain retained after fulfillment;
    // late faults signal exitCode1 for the parent's original exit observation.
  };
}

test("manual orphan bootstrap v1 preserves old entry and refuses maintenance source", { concurrency: false }, async () => {
  try {
    const write = retainManualOrphanIntegrationMarkerWriterV1();
    const result = await runManualOrphanBootstrapIntegrationV1();
    await write(result);
  } catch (error) {
    let code = "MANUAL_ORPHAN_CLEANUP_UNKNOWN";
    try {
      if (!integrationOutputFaultV1 && error instanceof Error) {
        const message = Object.getOwnPropertyDescriptor(error, "message");
        if (message && Object.hasOwn(message, "value") && typeof message.value === "string" && [
          "MANUAL_ORPHAN_OWNER_REFUSED",
          "MANUAL_ORPHAN_FRAME_REFUSED",
          "MANUAL_ORPHAN_CASE_REFUSED",
          "MANUAL_ORPHAN_CLEANUP_UNKNOWN",
        ].includes(message.value)) code = message.value;
      }
    } catch { /* Descriptor/proxy uncertainty preserves the fixed default. */ }
    if (integrationOutputFaultV1) code = "MANUAL_ORPHAN_CLEANUP_UNKNOWN";
    throw new Error(code);
  }
});
