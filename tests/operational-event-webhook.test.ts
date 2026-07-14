import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pgClose, pgConfigureIsolatedTestDatabase } from "../src/db-pg.js";
import { createCanonicalOperationalEventV1 } from "../src/execution/schemas/operational-event-v1.js";
import { deliverOperationalEventWebhook } from "../src/installer/events.js";
import { createIsolatedTestDatabase } from "./execution-attempts/test-database.js";

describe("canonical operational webhook transport", () => {
  it("sends the canonical eventKey as the bounded retry idempotency key", async () => {
    const database = await createIsolatedTestDatabase();
    const originalFetch = globalThis.fetch;
    try {
      pgConfigureIsolatedTestDatabase(database.url);
      const runId = "RUN_operational-webhook-idempotency";
      await database.insertRun(runId);
      await database.sql`
        UPDATE runs
           SET notify_url = 'https://hooks.example.test/setfarm#auth=Bearer%20fixture-token'
         WHERE id = ${runId}
      `;
      const event = createCanonicalOperationalEventV1({
        eventKey: "webhook-idempotency-event",
        outboxId: "OBX_webhook-idempotency-event",
        eventType: "run.terminal",
        aggregateType: "run",
        aggregateId: runId,
        payload: { schema: "setfarm.operational-outbox-event.v1", status: "failed" },
        sourceCreatedAt: "2026-07-13T15:00:00.000Z",
        committedAt: "2026-07-13T15:00:01.000Z",
      });
      let capturedUrl = "";
      let capturedHeaders = new Headers();
      let capturedBody: Record<string, unknown> = {};
      globalThis.fetch = (async (input, init) => {
        capturedUrl = String(input);
        capturedHeaders = new Headers(init?.headers);
        capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(null, { status: 204 });
      }) as typeof fetch;

      const result = await deliverOperationalEventWebhook(event);

      assert.equal(result.outcome, "delivered");
      assert.equal(capturedUrl, "https://hooks.example.test/setfarm");
      assert.equal(capturedHeaders.get("Idempotency-Key"), event.eventKey);
      assert.equal(capturedHeaders.get("X-Setfarm-Event-Key"), event.eventKey);
      assert.equal(capturedHeaders.get("X-Setfarm-Event-Hash"), event.eventHash);
      assert.equal(capturedHeaders.get("Authorization"), "Bearer fixture-token");
      assert.equal(capturedBody.eventKey, event.eventKey);
      assert.equal(capturedBody.eventHash, event.eventHash);
      assert.equal(capturedBody.projectionAuthority, "canonical_db");
    } finally {
      globalThis.fetch = originalFetch;
      await pgClose();
      await database.cleanup();
    }
  });
});
