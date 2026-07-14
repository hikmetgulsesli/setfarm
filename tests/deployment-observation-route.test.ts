import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { afterEach, describe, it } from "node:test";

import { startDashboard } from "../src/server/dashboard.js";
import type { V3DeployReceiptV1 } from "../src/execution/schemas/v3-deploy-receipt-v1.js";
import type { V3DeploymentObservationV1 } from "../src/execution/schemas/v3-deployment-observation-v1.js";

const servers: ReturnType<typeof startDashboard>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function listen(server: ReturnType<typeof startDashboard>): Promise<string> {
  if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe("deployment observation dashboard route", () => {
  it("returns 503 before lookup when operational observation authority is unavailable", async () => {
    let lookups = 0;
    const server = startDashboard(0, {
      deploymentObservation: {
        operationalToken: "",
        findReceipt: async () => { lookups += 1; return undefined; },
        observe: async () => { throw new Error("unreachable"); },
      },
    });
    servers.push(server);
    const origin = await listen(server);
    const response = await fetch(
      `${origin}/api/runs/run-route/deployment-observation?receiptHash=${"a".repeat(64)}`,
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "operational observation authority unavailable" });
    assert.equal(lookups, 0);
  });

  it("requires exact authentication and receipt identity without exposing authority", async () => {
    const token = "t".repeat(64);
    const receiptHash = "a".repeat(64);
    const receipt = { receiptHash } as V3DeployReceiptV1;
    const observation = {
      schema: "setfarm.v3-deployment-observation.v1",
      observationHash: "b".repeat(64),
    } as V3DeploymentObservationV1;
    let observes = 0;
    const server = startDashboard(0, {
      deploymentObservation: {
        operationalToken: token,
        findReceipt: async (runId) => runId === "run-route" ? receipt : undefined,
        observe: async () => { observes += 1; return observation; },
      },
    });
    servers.push(server);
    const origin = await listen(server);
    const endpoint = `${origin}/api/runs/run-route/deployment-observation?receiptHash=${receiptHash}`;

    const unauthorized = await fetch(endpoint);
    assert.equal(unauthorized.status, 401);
    assert.equal((await unauthorized.text()).includes(token), false);

    for (const injected of [
      "file:///Users/setrox/.ssh/id_ed25519",
      "/Users/setrox/secret",
      "/home/runner/secret",
      `${receiptHash}00`,
    ]) {
      const response = await fetch(`${origin}/api/runs/run-route/deployment-observation?receiptHash=${encodeURIComponent(injected)}`, {
        headers: { "x-setfarm-operational-token": token },
      });
      assert.equal(response.status, 400);
      assert.equal((await response.text()).includes(token), false);
    }

    const extra = await fetch(`${endpoint}&siblingToken=secret`, {
      headers: { "x-setfarm-operational-token": token },
    });
    assert.equal(extra.status, 400);

    const accepted = await fetch(endpoint, {
      headers: { "x-setfarm-operational-token": token },
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), observation);
    assert.equal(observes, 1);
  });

  it("returns 409 when the canonical receipt pointer changes during a fresh probe", async () => {
    const token = "v".repeat(64);
    const receiptHash = "d".repeat(64);
    const receipt = { receiptHash } as V3DeployReceiptV1;
    const drifted = { receiptHash, completedAt: "2026-07-14T20:00:00.000Z" } as V3DeployReceiptV1;
    const observation = { schema: "setfarm.v3-deployment-observation.v1" } as V3DeploymentObservationV1;
    let lookups = 0;
    let observes = 0;
    const server = startDashboard(0, {
      deploymentObservation: {
        operationalToken: token,
        findReceipt: async () => {
          lookups += 1;
          return lookups === 1 ? receipt : drifted;
        },
        observe: async () => { observes += 1; return observation; },
      },
    });
    servers.push(server);
    const origin = await listen(server);
    const response = await fetch(
      `${origin}/api/runs/run-route/deployment-observation?receiptHash=${receiptHash}`,
      { headers: { "x-setfarm-operational-token": token } },
    );
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "deployment receipt authority changed" });
    assert.equal(lookups, 2);
    assert.equal(observes, 1);
  });

  it("bounds concurrent fresh observations", async () => {
    const token = "u".repeat(64);
    const receiptHash = "c".repeat(64);
    const receipt = { receiptHash } as V3DeployReceiptV1;
    const observation = { schema: "setfarm.v3-deployment-observation.v1" } as V3DeploymentObservationV1;
    let release!: () => void;
    let entered = 0;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const server = startDashboard(0, {
      deploymentObservation: {
        operationalToken: token,
        findReceipt: async () => receipt,
        observe: async () => { entered += 1; await blocked; return observation; },
      },
    });
    servers.push(server);
    const origin = await listen(server);
    const endpoint = `${origin}/api/runs/run-route/deployment-observation?receiptHash=${receiptHash}`;
    const headers = { "x-setfarm-operational-token": token };
    const firstFour = Array.from({ length: 4 }, () => fetch(endpoint, { headers }));
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (entered === 4) break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(entered, 4);
    const fifth = await fetch(endpoint, { headers });
    assert.equal(fifth.status, 429);
    release();
    assert.deepEqual((await Promise.all(firstFour)).map((response) => response.status), [200, 200, 200, 200]);
  });
});
