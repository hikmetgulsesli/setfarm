import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { allocateRuntimePort, portBandRange, runtimeUrl, writeRunRuntimeArtifact } from "../src/installer/runtime-ports.js";
import {
  allocateRuntimePort as allocateRuntimePortFromSource,
  isFetchSafeRuntimePort,
} from "../src/installer/runtime-ports.js";

test("runtime port bands use separate deterministic local ranges", () => {
  assert.deepEqual(portBandRange("backend"), { base: 4100, max: 4999, size: 900 });
  assert.deepEqual(portBandRange("frontend"), { base: 5100, max: 5999, size: 900 });
  assert.deepEqual(portBandRange("preview"), { base: 6100, max: 6999, size: 900 });
});

test("runtime URL is stable and path-aware", () => {
  assert.equal(runtimeUrl("127.0.0.1", 6123), "http://127.0.0.1:6123");
  assert.equal(runtimeUrl("127.0.0.1", 6123, "/health"), "http://127.0.0.1:6123/health");
});

test("runtime allocator honors an available preferred port in band", async () => {
  const allocation = await allocateRuntimePort({
    runId: "runtime-test",
    runNumber: 42,
    band: "preview",
    preferredPort: 6999,
  });
  assert.equal(allocation.port, 6999);
  assert.equal(allocation.url, "http://127.0.0.1:6999");
});

test("runtime artifact records the local URL operators should open", () => {
  const repo = mkdtempSync(join(tmpdir(), "setfarm-runtime-artifact-"));
  const rel = writeRunRuntimeArtifact({
    repo,
    runId: "run-1",
    runNumber: 12,
    stepId: "final-test",
    runtime: {
      band: "preview",
      host: "127.0.0.1",
      port: 6123,
      url: "http://127.0.0.1:6123",
      preferred: false,
    },
    status: "passed",
  });
  assert.equal(rel, ".setfarm/run-runtime.json");
  const json = JSON.parse(readFileSync(join(repo, rel), "utf-8"));
  assert.equal(json.schema, "setfarm.run-runtime.v1");
  assert.equal(json.localUrl, "http://127.0.0.1:6123");
  assert.equal(json.port, 6123);
  assert.equal(json.status, "passed");
});

test("runtime allocator rejects TCP-free ports that Fetch and Chromium forbid", () => {
  for (const port of [4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697]) {
    assert.equal(isFetchSafeRuntimePort(port), false, `${port} must never back runtime evidence`);
  }
  assert.equal(isFetchSafeRuntimePort(6567), true);
});

test("runtime allocator skips a forbidden preferred and deterministic preview port", async () => {
  const allocation = await allocateRuntimePortFromSource({
    runId: "run-fetch-bad-port-regression",
    runNumber: 466,
    band: "preview",
    preferredPort: 6566,
  });

  assert.ok(allocation.port >= 6100 && allocation.port <= 6999);
  assert.equal(isFetchSafeRuntimePort(allocation.port), true);
  assert.notEqual(allocation.port, 6566);
  assert.equal(allocation.preferred, false);
});
