import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { createCanonicalOperationalEventV1 } from "../src/execution/schemas/operational-event-v1.js";
import {
  getRecentEvents,
  projectOperationalEventToJsonl,
} from "../src/installer/events.js";

describe("non-authoritative operational JSONL projection", () => {
  it("deduplicates crash replay by canonical eventKey and labels the authority boundary", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-operational-jsonl-"));
    const previousDbPath = process.env.SETFARM_DB_PATH;
    process.env.SETFARM_DB_PATH = path.join(directory, "setfarm.db");
    try {
      const event = createCanonicalOperationalEventV1({
        eventKey: "jsonl-crash-replay",
        outboxId: "OBX_jsonl-crash-replay",
        eventType: "run.terminal",
        aggregateType: "run",
        aggregateId: "RUN_jsonl-crash-replay",
        payload: {
          schema: "setfarm.operational-outbox-event.v1",
          status: "failed",
        },
        sourceCreatedAt: "2026-07-13T15:00:00.000Z",
        committedAt: "2026-07-13T15:00:01.000Z",
      });

      assert.deepEqual(projectOperationalEventToJsonl(event), {
        schema: "setfarm.operational-jsonl-projection-result.v1",
        deduplicated: false,
      });
      // This is the replay after a process died after append but before its DB
      // delivery receipt. The append is not repeated.
      assert.deepEqual(projectOperationalEventToJsonl(event), {
        schema: "setfarm.operational-jsonl-projection-result.v1",
        deduplicated: true,
      });

      const lines = fs.readFileSync(path.join(directory, "events.jsonl"), "utf8")
        .trim()
        .split("\n");
      assert.equal(lines.length, 1);
      const projected = JSON.parse(lines[0]!) as Record<string, unknown>;
      assert.equal(projected.eventKey, event.eventKey);
      assert.equal(projected.eventHash, event.eventHash);
      assert.equal(projected.projectionAuthority, "non_authoritative");
      assert.equal(getRecentEvents(10).length, 1);
    } finally {
      if (previousDbPath === undefined) delete process.env.SETFARM_DB_PATH;
      else process.env.SETFARM_DB_PATH = previousDbPath;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
