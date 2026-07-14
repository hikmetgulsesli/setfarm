import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { exactProductReservation } from "./fixtures.js";
import { createIsolatedTestDatabase } from "./test-database.js";

describe("runtime migration ownership preservation", () => {
  it("does not rewrite a terminal shadow story claim while its exact attempt fence is active", async () => {
    const database = await createIsolatedTestDatabase();
    let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
    try {
      const runId = "run-migrate-shadow-owner";
      await database.insertRun(runId);
      await database.sql`
        INSERT INTO steps
          (id, run_id, step_id, agent_id, step_index, input_template, expects, status, current_story_id)
        VALUES
          ('run-migrate-shadow-owner-step', ${runId}, 'implement', 'feature-dev_developer', 1, '', '', 'running', 'run-migrate-shadow-owner-story')
      `;
      await database.sql`
        INSERT INTO stories
          (id, run_id, story_index, story_id, title, status, claimed_by, claim_generation)
        VALUES
          ('run-migrate-shadow-owner-story', ${runId}, 1, 'US-002', 'Story', 'running', 'feature-dev_developer', 1)
      `;
      const claims = await database.sql<Array<{ id: number }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
        VALUES (${runId}, 'implement', 'US-002', 'feature-dev_developer', NOW())
        RETURNING id::integer AS id
      `;
      const claimId = claims[0]!.id;
      const repository = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_migration-preserve1",
        fenceToken: () => "f".repeat(64),
      });
      await repository.reserve(exactProductReservation({
        claimId,
        runId,
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      await database.sql`UPDATE runs SET status = 'cancelled' WHERE id = ${runId}`;

      runtimeDb = await import(`../../src/db-pg.ts?runtime-preservation=${Date.now()}`);
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      await runtimeDb.pgMigrate();

      const state = await database.sql<Array<{
        claim_outcome: string | null;
        claim_diagnostic: string | null;
        attempt_disposition: string;
        story_status: string;
        step_status: string;
      }>>`
        SELECT cl.outcome AS claim_outcome,
               cl.diagnostic AS claim_diagnostic,
               ea.disposition AS attempt_disposition,
               st.status AS story_status,
               s.status AS step_status
          FROM claim_log cl
          JOIN execution_attempts ea ON ea.run_id = cl.run_id AND ea.story_id = cl.story_id
          JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
          JOIN steps s ON s.run_id = cl.run_id AND s.step_id = cl.step_id
         WHERE cl.id = ${claimId}
      `;
      assert.deepEqual({ ...state[0] }, {
        claim_outcome: null,
        claim_diagnostic: null,
        attempt_disposition: "claimed",
        story_status: "running",
        step_status: "running",
      });
    } finally {
      await runtimeDb?.pgClose().catch(() => {});
      await database.cleanup();
    }
  });
});
