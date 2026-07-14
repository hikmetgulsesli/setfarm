import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseObservedProcessIdentityRow,
  signalProcessIfIdentityMatches,
} from "../../src/execution/process-identity.js";
import type { ProcessIdentityV1 } from "../../src/execution/schemas/process-identity-v1.js";

function identity(overrides: Partial<ProcessIdentityV1> = {}): ProcessIdentityV1 {
  return {
    schema: "setfarm.process-identity.v1",
    pid: 4242,
    processStartedAt: "2026-07-13T12:00:00.000Z",
    processGroupId: 4242,
    source: "observed_os",
    ...overrides,
  };
}

describe("runtime process identity fencing", () => {
  it("parses the single-snapshot ps identity used for runtime publication", () => {
    assert.deepEqual(
      parseObservedProcessIdentityRow(4242, "4242 Mon Jul 13 15:00:00 2026  4000\n"),
      identity({
        processStartedAt: new Date("Mon Jul 13 15:00:00 2026").toISOString(),
        processGroupId: 4000,
      }),
    );
    assert.equal(
      parseObservedProcessIdentityRow(4242, "9999 Mon Jul 13 15:00:00 2026  4000\n"),
      undefined,
    );
  });

  it("does not signal a reused PID whose start identity changed", () => {
    const signals: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    const sent = signalProcessIfIdentityMatches(identity(), "SIGKILL", {
      observe: () => identity({ processStartedAt: "2026-07-13T12:05:00.000Z" }),
      signalProcess: (pid, signal) => signals.push({ pid, signal }),
    });
    assert.equal(sent, false);
    assert.deepEqual(signals, []);
  });

  it("signals only the exact observed process and never signals legacy backfill", () => {
    const signals: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    assert.equal(signalProcessIfIdentityMatches(identity(), "SIGTERM", {
      observe: () => identity(),
      signalProcess: (pid, signal) => signals.push({ pid, signal }),
    }), true);
    assert.deepEqual(signals, [{ pid: 4242, signal: "SIGTERM" }]);

    assert.equal(signalProcessIfIdentityMatches(identity({ source: "legacy-backfill" }), "SIGKILL", {
      observe: () => identity({ source: "legacy-backfill" }),
      signalProcess: (pid, signal) => signals.push({ pid, signal }),
    }), false);
    assert.equal(signals.length, 1);
  });
});
