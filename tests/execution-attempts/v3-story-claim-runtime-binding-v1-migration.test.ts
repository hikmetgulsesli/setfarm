import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";

import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  auditCurrentContractSpineAuthorityLedgersAtV31Data,
  planContractSpineMigrations,
  rollbackOperationalFailureCauseAuthorityV2ToV29,
  rollbackOperationalFailureCauseAuthorityV3ToV30,
  rollbackV3StoryClaimRuntimeBindingToV28,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import {
  V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE,
  V3_STORY_CLAIM_RUNTIME_BINDING_V1_SCOPE_INDEX,
  V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE,
  applyV3StoryClaimRuntimeBindingV1,
  auditV3StoryClaimRuntimeBindingV1Data,
  detectV3StoryClaimRuntimeBindingV1,
  verifyV3StoryClaimRuntimeBindingV1,
} from "../../src/db/v3-story-claim-runtime-binding-v1-migration.js";
import {
  createRuntimeCompletionPlanV1,
  createSingleEffectCompletionPlanDescriptorV1,
} from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

type SubjectKind = "story_member" | "final_product";

async function rollbackCurrentToV28(database: TestDatabase): Promise<void> {
  await rollbackOperationalFailureCauseAuthorityV3ToV30(database.sql, {
    targetReleaseSha: "6".repeat(40),
  });
  await rollbackOperationalFailureCauseAuthorityV2ToV29(database.sql, {
    targetReleaseSha: "7".repeat(40),
  });
  await rollbackV3StoryClaimRuntimeBindingToV28(database.sql, {
    targetReleaseSha: "8".repeat(40),
  });
}

async function seedV3RunAndStep(
  database: TestDatabase,
  input: Readonly<{ runId: string; workflowStepId: "implement" | "supervise" }>,
): Promise<string> {
  const stepDbId = `${input.runId}-${input.workflowStepId}`;
  const releaseSha = "d".repeat(40);
  const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
  await database.sql.unsafe(
    `INSERT INTO runs (
       id, workflow_id, task, status, protocol, compiler_release_sha,
       activation_preflight_hash, release_admission_hash
     ) VALUES ($1, 'feature-dev', 'migration 29 binding fixture', 'running',
               'v3', $2, $3, $4)`,
    [input.runId, releaseSha, "e".repeat(64), releaseAdmissionHash],
  );
  await database.sql.unsafe(
    `INSERT INTO steps (
       id, run_id, step_id, agent_id, step_index, input_template, expects, status
     ) VALUES ($1, $2, $3, 'feature-dev_developer', 1, '', '', 'running')`,
    [stepDbId, input.runId, input.workflowStepId],
  );
  return stepDbId;
}

async function seedBindingOwner(
  database: TestDatabase,
  input: Readonly<{
    suffix: string;
    workflowStepId: "implement" | "supervise";
    subjectKind: SubjectKind;
  }>,
): Promise<Readonly<{
  claimId: number;
  runtimeSessionId: string;
  runId: string;
  stepDbId: string;
  storyDbId: string | null;
  storyId: string | null;
  storyIndex: number | null;
  storyClaimGeneration: number | null;
  claimedAt: Date;
}>> {
  const runId = `v29-${input.suffix}`;
  const stepDbId = await seedV3RunAndStep(database, {
    runId,
    workflowStepId: input.workflowStepId,
  });
  const storyDbId = input.subjectKind === "story_member"
    ? `${runId}-story-db`
    : null;
  const storyId = input.subjectKind === "story_member"
    ? `US-${input.suffix.toUpperCase()}`
    : null;
  const storyIndex = input.subjectKind === "story_member" ? 1 : null;
  const storyClaimGeneration = input.subjectKind === "story_member" ? 1 : null;
  if (storyDbId && storyId) {
    await database.sql.unsafe(
      `INSERT INTO stories (
         id, run_id, story_index, story_id, title, status, claim_generation
       ) VALUES ($1, $2, $3, $4, 'Bound story', $5, $6)`,
      [
        storyDbId,
        runId,
        storyIndex,
        storyId,
        input.workflowStepId === "supervise" ? "done" : "running",
        storyClaimGeneration,
      ],
    );
  }
  const claimRows = await database.sql.unsafe<Array<{
    id: number;
    claimed_at: Date;
  }>>(
    `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
     VALUES ($1, $2, $3, 'feature-dev_developer', $4)
     RETURNING id::integer AS id, claimed_at`,
    [
      runId,
      input.workflowStepId,
      input.workflowStepId === "implement" ? storyId : null,
      new Date("2026-08-12T00:00:00.000Z"),
    ],
  );
  const claim = claimRows[0]!;
  const runtimeSessionId = `RTS_${input.suffix}`;
  await database.sql.unsafe(
    `INSERT INTO runtime_sessions (
       session_id, run_id, step_db_id, workflow_step_id, story_db_id, story_id,
       claim_id, claim_agent_id, runtime_agent_id, runtime_kind, state,
       owner_instance_id, heartbeat_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7,
               'feature-dev_developer', 'prism', 'external_session', 'reserved',
               'v29-test-owner', $8)`,
    [
      runtimeSessionId,
      runId,
      stepDbId,
      input.workflowStepId,
      input.workflowStepId === "implement" ? storyDbId : null,
      input.workflowStepId === "implement" ? storyId : null,
      claim.id,
      claim.claimed_at,
    ],
  );
  return Object.freeze({
    claimId: claim.id,
    runtimeSessionId,
    runId,
    stepDbId,
    storyDbId,
    storyId,
    storyIndex,
    storyClaimGeneration,
    claimedAt: new Date(claim.claimed_at),
  });
}

async function insertBinding(
  database: TestDatabase,
  owner: Awaited<ReturnType<typeof seedBindingOwner>>,
  subjectKind: SubjectKind,
  hashes: Readonly<{ receipt?: string; subject?: string }> = {},
): Promise<void> {
  await database.sql.unsafe(
    `INSERT INTO public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE} (
       claim_id, runtime_session_id, run_id, step_db_id, workflow_step_id,
       subject_kind, story_db_id, story_id, story_index,
       story_claim_generation, story_admission_receipt_hash,
       story_admission_subject_hash, bound_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      owner.claimId,
      owner.runtimeSessionId,
      owner.runId,
      owner.stepDbId,
      owner.stepDbId.endsWith("-implement") ? "implement" : "supervise",
      subjectKind,
      owner.storyDbId,
      owner.storyId,
      owner.storyIndex,
      owner.storyClaimGeneration,
      hashes.receipt ?? "a".repeat(64),
      hashes.subject ?? "b".repeat(64),
      owner.claimedAt,
    ],
  );
}

async function settleHistoricalOwner(
  database: TestDatabase,
  owner: Awaited<ReturnType<typeof seedBindingOwner>>,
  options: Readonly<{
    runTerminal?: boolean;
    claimTerminal?: boolean;
    runtimeReleased?: boolean;
  }> = {},
): Promise<void> {
  if (options.runTerminal !== false) {
    await database.sql.unsafe(
      "UPDATE runs SET status = 'completed', updated_at = NOW() WHERE id = $1",
      [owner.runId],
    );
  }
  if (options.claimTerminal !== false) {
    await database.sql.unsafe(
      "UPDATE claim_log SET outcome = 'completed' WHERE id = $1",
      [owner.claimId],
    );
  }
  if (options.runtimeReleased !== false) {
    await database.sql.unsafe(
      `UPDATE runtime_sessions
          SET state = 'released', drained_at = NOW(), released_at = NOW(),
              updated_at = NOW()
        WHERE session_id = $1`,
      [owner.runtimeSessionId],
    );
  }
}

async function insertUnsettledCompletion(
  database: TestDatabase,
  owner: Awaited<ReturnType<typeof seedBindingOwner>>,
): Promise<void> {
  await database.sql.unsafe(
    `INSERT INTO runtime_completion_requests (
       request_id, runtime_session_id, claim_id, run_id, step_db_id,
       workflow_step_id, story_db_id, story_id, claim_envelope, output,
       output_hash, state, requested_by, requested_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               '{"protocol":"shadow"}'::jsonb, 'STATUS: done', $9,
               'requested', 'v29-cutover-test', NOW())`,
    [
      `RCR_${owner.claimId}-${"a".repeat(20)}`,
      owner.runtimeSessionId,
      owner.claimId,
      owner.runId,
      owner.stepDbId,
      owner.stepDbId.endsWith("-implement") ? "implement" : "supervise",
      owner.storyDbId,
      owner.storyId,
      "a".repeat(64),
    ],
  );
}

async function insertOwnerCommittedCompletion(
  database: TestDatabase,
  owner: Awaited<ReturnType<typeof seedBindingOwner>>,
  options: Readonly<{
    finalState?: "accepted" | "quarantined";
    claimOutcome?: string;
    settleMandatoryEffect?: boolean;
  }> = {},
): Promise<void> {
  const requestId = `RCR_${owner.claimId}-${"b".repeat(20)}`;
  const outputHash = "b".repeat(64);
  const preparedAt = new Date("2026-08-12T01:00:00.000Z");
  const prepared = createRuntimeCompletionPlanV1({
    requestId,
    claimId: owner.claimId,
    runId: owner.runId,
    stepDbId: owner.stepDbId,
    workflowStepId: owner.stepDbId.endsWith("-implement") ? "implement" : "supervise",
    outputHash,
    descriptor: createSingleEffectCompletionPlanDescriptorV1({
      kind: "single_completion",
      continuation: { type: "single_pipeline_advance", targetStepId: "verify" },
      effectType: "single.pipeline.advance",
      effectPayload: { source: "v29-cutover-test" },
    }),
    preparedAt,
  });
  const effect = prepared.plan.effects[0]!;
  const effectPayload = {
    schema: "setfarm.runtime-completion-effect-input.v1" as const,
    planHash: prepared.planHash,
    plan: prepared.plan,
    effect: effect.payload,
  };
  const finalState = options.finalState ?? "quarantined";
  const claimOutcome = options.claimOutcome ?? "completed";
  await database.sql.begin(async (transaction) => {
    await transaction.unsafe(
      `INSERT INTO runtime_completion_requests (
         request_id, runtime_session_id, claim_id, run_id, step_db_id,
         workflow_step_id, story_db_id, story_id, claim_envelope, output,
         output_hash, apply_phase, state, requested_by, owner_instance_id,
         lease_expires_at, requested_at, drained_at, processing_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                 '{"protocol":"shadow"}'::jsonb, 'STATUS: done', $9,
                 'executing', 'processing', 'v29-cutover-test',
                 'v29-cutover-owner', NOW() + INTERVAL '5 minutes',
                 NOW(), NOW(), NOW())`,
      [
        requestId,
        owner.runtimeSessionId,
        owner.claimId,
        owner.runId,
        owner.stepDbId,
        owner.stepDbId.endsWith("-implement") ? "implement" : "supervise",
        owner.storyDbId,
        owner.storyId,
        outputHash,
      ],
    );
    await transaction.unsafe(
      `UPDATE runtime_completion_requests
          SET apply_phase = 'owner_committed', claim_outcome = $2,
              claim_committed_at = $3, completion_plan = $4::text::jsonb,
              completion_plan_hash = $5, prepared_at = $3
        WHERE request_id = $1`,
      [requestId, claimOutcome, preparedAt, JSON.stringify(prepared.plan), prepared.planHash],
    );
    await transaction.unsafe(
      `INSERT INTO runtime_completion_effects (
         request_id, effect_key, ordinal, effect_type, input_hash,
         payload, mandatory, state
       ) VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7, 'pending')`,
      [
        requestId,
        effect.effectKey,
        effect.ordinal,
        effect.effectType,
        hashCanonicalJson(effectPayload),
        JSON.stringify(effectPayload),
        effect.mandatory,
      ],
    );
    await transaction.unsafe(
      `UPDATE runtime_completion_requests
          SET state = $2,
              apply_phase = CASE WHEN $2 = 'accepted'
                THEN 'effects_committed' ELSE apply_phase END,
              effects_committed_at = CASE WHEN $2 = 'accepted' THEN $3 ELSE NULL END,
              accepted_at = CASE WHEN $2 = 'accepted' THEN $3 ELSE NULL END,
              diagnostic = CASE WHEN $2 = 'quarantined'
                THEN 'effects remain unsettled' ELSE NULL END,
              owner_instance_id = NULL, lease_expires_at = NULL
        WHERE request_id = $1`,
      [requestId, finalState, preparedAt],
    );
    if (finalState === "accepted" && options.settleMandatoryEffect !== false) {
      await transaction.unsafe(
        `UPDATE runtime_completion_effects
            SET state = 'applied', applied_at = $2, updated_at = $2
          WHERE request_id = $1`,
        [requestId, preparedAt],
      );
    }
  });
}

describe("v3 story claim/runtime binding migration 29", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  it("applies an exact empty topology and remains idempotent through pgMigrate", async () => {
    assert.equal(await detectV3StoryClaimRuntimeBindingV1(database.sql), "present");
    await verifyV3StoryClaimRuntimeBindingV1(database.sql);
    await database.db.pgMigrate({ contractSpineMode: "apply" });
    await verifyContractSpineMigrations(database.sql);
    const rows = await database.sql.unsafe<Array<{
      relation: string | null;
      quality_column: boolean;
    }>>(
      `SELECT to_regclass('public.steps')::text AS relation,
              EXISTS (
                SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND table_name = 'stories'
                   AND column_name = 'quality_failure_fingerprint'
              ) AS quality_column`,
    );
    assert.equal(rows[0]?.relation, "steps");
    assert.equal(rows[0]?.quality_column, true);
  });

  it("records a terminal historical-owner cutover without fabricating bindings", async () => {
    const isolated = await createIsolatedTestDatabase();
    try {
      await rollbackCurrentToV28(isolated);
      const historical = await seedBindingOwner(isolated, {
        suffix: "historical-terminal",
        workflowStepId: "implement",
        subjectKind: "story_member",
      });
      await settleHistoricalOwner(isolated, historical);
      await applyContractSpineMigrations(isolated.sql);
      await verifyContractSpineMigrations(isolated.sql);
      const authority = await isolated.sql.unsafe<Array<{
        cutover_id: string;
        historical_owner_count: string;
        digest_valid: boolean;
        cutover_exact: boolean;
        binding_count: string;
      }>>(
        `SELECT cutover.cutover_id,
                cutover.historical_owner_count::text AS historical_owner_count,
                cutover.historical_owner_digest ~ '^[a-f0-9]{64}$' AS digest_valid,
                to_char(
                  cutover.cutover_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                ) ~ '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{6}Z$'
                  AS cutover_exact,
                (SELECT COUNT(*)::text
                   FROM public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE})
                  AS binding_count
           FROM public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE} cutover`,
      );
      assert.deepEqual({ ...authority[0] }, {
        cutover_id: "v1",
        historical_owner_count: "1",
        digest_valid: true,
        cutover_exact: true,
        binding_count: "0",
      });
      await assert.rejects(
        insertBinding(isolated, historical, "story_member"),
        /V3_STORY_CLAIM_RUNTIME_BINDING_HISTORICAL_OWNER_FORBIDDEN/,
      );
      await assert.rejects(
        isolated.sql.unsafe(
          `UPDATE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE}
              SET historical_owner_count = 0`,
        ),
        /V3_STORY_CLAIM_RUNTIME_BINDING_UPDATE_FORBIDDEN/,
      );
      await assert.rejects(
        isolated.sql.unsafe(
          `DELETE FROM public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE}`,
        ),
        /V3_STORY_CLAIM_RUNTIME_BINDING_DELETE_FORBIDDEN/,
      );
      await assert.rejects(
        isolated.sql.unsafe(
          `TRUNCATE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE}`,
        ),
        /V3_STORY_CLAIM_RUNTIME_BINDING_TRUNCATE_FORBIDDEN/,
      );
    } finally {
      await isolated.cleanup();
    }
  });

  it("atomically rejects active, open, unreleased, or unsettled historical owners", async () => {
    const scenarios = [
      {
        suffix: "historical-active-run",
        settle: { runTerminal: false },
        completion: "none",
      },
      {
        suffix: "historical-open-claim",
        settle: { claimTerminal: false },
        completion: "none",
      },
      {
        suffix: "historical-unreleased-runtime",
        settle: { runtimeReleased: false },
        completion: "none",
      },
      {
        suffix: "historical-unsettled-completion",
        settle: {},
        completion: "requested",
      },
      {
        suffix: "historical-owner-committed-completion",
        settle: {},
        completion: "owner_committed",
      },
      {
        suffix: "historical-completion-outcome-mismatch",
        settle: {},
        completion: "outcome_mismatch",
      },
      {
        suffix: "historical-mandatory-effect-pending",
        settle: {},
        completion: "pending_effect",
      },
    ] as const;
    for (const scenario of scenarios) {
      const isolated = await createIsolatedTestDatabase();
      try {
        await rollbackCurrentToV28(isolated);
        const owner = await seedBindingOwner(isolated, {
          suffix: scenario.suffix,
          workflowStepId: "implement",
          subjectKind: "story_member",
        });
        await settleHistoricalOwner(isolated, owner, scenario.settle);
        if (scenario.completion === "requested") {
          await insertUnsettledCompletion(isolated, owner);
        } else if (scenario.completion === "owner_committed") {
          await insertOwnerCommittedCompletion(isolated, owner);
        } else if (scenario.completion === "outcome_mismatch") {
          await insertOwnerCommittedCompletion(isolated, owner, {
            finalState: "accepted",
            claimOutcome: "failed",
          });
        } else if (scenario.completion === "pending_effect") {
          await insertOwnerCommittedCompletion(isolated, owner, {
            finalState: "accepted",
            settleMandatoryEffect: false,
          });
        }
        await assert.rejects(
          applyContractSpineMigrations(isolated.sql),
          /cutover requires bounded fully terminal historical v3 owners/,
        );
        const state = await isolated.sql.unsafe<Array<{
          journaled: boolean;
          cutover_present: boolean;
          binding_present: boolean;
        }>>(
          `SELECT EXISTS (
                    SELECT 1 FROM setfarm_schema_migrations WHERE version = 29
                  ) AS journaled,
                  to_regclass('public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE}')
                    IS NOT NULL AS cutover_present,
                  to_regclass('public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}')
                    IS NOT NULL AS binding_present`,
        );
        assert.deepEqual(state[0], {
          journaled: false,
          cutover_present: false,
          binding_present: false,
        });
      } finally {
        await isolated.cleanup();
      }
    }
  });

  it("atomically rejects open claims without runtimes and mismatched runtime owners", async () => {
    for (const scenario of ["missing-runtime", "mismatched-runtime"] as const) {
      const isolated = await createIsolatedTestDatabase();
      try {
        await rollbackCurrentToV28(isolated);
        const owner = await seedBindingOwner(isolated, {
          suffix: scenario,
          workflowStepId: "implement",
          subjectKind: "story_member",
        });
        if (scenario === "missing-runtime") {
          await isolated.sql.unsafe(
            "DELETE FROM runtime_sessions WHERE session_id = $1",
            [owner.runtimeSessionId],
          );
        } else {
          await isolated.sql.unsafe(
            `UPDATE runtime_sessions
                SET workflow_step_id = 'verify'
              WHERE session_id = $1`,
            [owner.runtimeSessionId],
          );
        }
        await assert.rejects(
          applyContractSpineMigrations(isolated.sql),
          /refuses an open or malformed v3 claim\/runtime owner/,
        );
        const state = await isolated.sql.unsafe<Array<{
          journaled: boolean;
          cutover_present: boolean;
        }>>(
          `SELECT EXISTS (
                    SELECT 1 FROM setfarm_schema_migrations WHERE version = 29
                  ) AS journaled,
                  to_regclass('public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE}')
                    IS NOT NULL AS cutover_present`,
        );
        assert.deepEqual(state[0], { journaled: false, cutover_present: false });
      } finally {
        await isolated.cleanup();
      }
    }
  });

  it("requires an exact binding for every post-cutover owner", async () => {
    const isolated = await createIsolatedTestDatabase();
    try {
      const owner = await seedBindingOwner(isolated, {
        suffix: "post-cutover-required",
        workflowStepId: "implement",
        subjectKind: "story_member",
      });
      await assert.rejects(
        auditV3StoryClaimRuntimeBindingV1Data(isolated.sql),
        /binding census is incomplete, ambiguous, or invalid/,
      );
      await insertBinding(isolated, owner, "story_member");
      assert.deepEqual(
        await auditV3StoryClaimRuntimeBindingV1Data(isolated.sql),
        { bindingCount: 1, requiredOwnerCount: 1 },
      );
    } finally {
      await isolated.cleanup();
    }
  });

  it("cuts over more than one exact historical owner page", async () => {
    const isolated = await createIsolatedTestDatabase();
    try {
      await rollbackCurrentToV28(isolated);
      const runId = "v29-historical-multipage";
      const stepDbId = await seedV3RunAndStep(isolated, {
        runId,
        workflowStepId: "implement",
      });
      await isolated.sql.unsafe(
        `INSERT INTO stories (
           id, run_id, story_index, story_id, title, status, claim_generation
         )
         SELECT $1 || '-story-' || lpad(ordinal::text, 3, '0'),
                $1, ordinal, 'US-HIST-' || lpad(ordinal::text, 3, '0'),
                'Historical page story ' || ordinal::text, 'done', 1
           FROM generate_series(1, 65) ordinal`,
        [runId],
      );
      await isolated.sql.unsafe(
        `INSERT INTO claim_log (
           run_id, step_id, story_id, agent_id, outcome, claimed_at
         )
         SELECT $1, 'implement', story_id, 'feature-dev_developer', 'completed',
                '2026-08-12T00:00:00.123456Z'::timestamptz
           FROM stories
          WHERE run_id = $1`,
        [runId],
      );
      await isolated.sql.unsafe(
        `INSERT INTO runtime_sessions (
           session_id, run_id, step_db_id, workflow_step_id, story_db_id, story_id,
           claim_id, claim_agent_id, runtime_agent_id, runtime_kind, state,
           owner_instance_id, heartbeat_at, drained_at, released_at, created_at
         )
         SELECT 'RTS_v29-historical-' || lpad(story.story_index::text, 4, '0'),
                $1, $2, 'implement', story.id, story.story_id, claim.id,
                'feature-dev_developer', 'prism', 'external_session', 'released',
                'v29-test-owner', '2026-08-12T00:00:00.123457Z'::timestamptz,
                '2026-08-12T00:00:00.123458Z'::timestamptz,
                '2026-08-12T00:00:00.123459Z'::timestamptz,
                '2026-08-12T00:00:00.123457Z'::timestamptz
           FROM stories story
           JOIN claim_log claim
             ON claim.run_id = story.run_id
            AND claim.step_id = 'implement'
            AND claim.story_id = story.story_id
          WHERE story.run_id = $1`,
        [runId, stepDbId],
      );
      await isolated.sql.unsafe(
        "UPDATE runs SET status = 'completed', updated_at = NOW() WHERE id = $1",
        [runId],
      );
      await applyContractSpineMigrations(isolated.sql);
      await verifyContractSpineMigrations(isolated.sql);
      const rows = await isolated.sql.unsafe<Array<{
        historical_owner_count: string;
        binding_count: string;
      }>>(
        `SELECT historical_owner_count::text AS historical_owner_count,
                (SELECT COUNT(*)::text
                   FROM public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}) AS binding_count
           FROM public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE}`,
      );
      assert.deepEqual(rows[0], {
        historical_owner_count: "65",
        binding_count: "0",
      });
      await assert.rejects(
        isolated.sql.begin(async (transaction) => {
          await transaction.unsafe(
            `UPDATE runtime_sessions
                SET created_at = created_at + INTERVAL '1 microsecond'
              WHERE session_id = 'RTS_v29-historical-0001'`,
          );
          await verifyV3StoryClaimRuntimeBindingV1(transaction);
        }),
        /historical owner cutover census changed/,
      );
    } finally {
      await isolated.cleanup();
    }
  });

  it("rejects oversized historical owner identity before cutover allocation", async () => {
    const isolated = await createIsolatedTestDatabase();
    try {
      await rollbackCurrentToV28(isolated);
      const owner = await seedBindingOwner(isolated, {
        suffix: "oversized-history",
        workflowStepId: "implement",
        subjectKind: "story_member",
      });
      await settleHistoricalOwner(isolated, owner);
      await isolated.sql.unsafe(
        "UPDATE runtime_sessions SET session_id = repeat('x', 165) WHERE session_id = $1",
        [owner.runtimeSessionId],
      );
      await assert.rejects(
        applyContractSpineMigrations(isolated.sql),
        /cutover requires bounded fully terminal historical v3 owners/,
      );
    } finally {
      await isolated.cleanup();
    }
  });

  it("publishes exact implement, supervise-story, and final-product bindings", async () => {
    const implement = await seedBindingOwner(database, {
      suffix: "implement-success",
      workflowStepId: "implement",
      subjectKind: "story_member",
    });
    await insertBinding(database, implement, "story_member");
    const supervise = await seedBindingOwner(database, {
      suffix: "supervise-success",
      workflowStepId: "supervise",
      subjectKind: "story_member",
    });
    await insertBinding(database, supervise, "story_member");
    const finalProduct = await seedBindingOwner(database, {
      suffix: "final-product-success",
      workflowStepId: "supervise",
      subjectKind: "final_product",
    });
    await insertBinding(database, finalProduct, "final_product");
    const audit = await auditV3StoryClaimRuntimeBindingV1Data(database.sql);
    assert.deepEqual(audit, { bindingCount: 3, requiredOwnerCount: 3 });
  });

  it("rejects update, delete, truncate, stale generation, and bound-at drift", async () => {
    const owner = await seedBindingOwner(database, {
      suffix: "append-only",
      workflowStepId: "implement",
      subjectKind: "story_member",
    });
    await insertBinding(database, owner, "story_member");
    await assert.rejects(
      database.sql.unsafe(
        `UPDATE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
            SET story_admission_receipt_hash = $2 WHERE claim_id = $1`,
        [owner.claimId, "c".repeat(64)],
      ),
      /V3_STORY_CLAIM_RUNTIME_BINDING_UPDATE_FORBIDDEN/,
    );
    await assert.rejects(
      database.sql.unsafe(
        `DELETE FROM public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
          WHERE claim_id = $1`,
        [owner.claimId],
      ),
      /V3_STORY_CLAIM_RUNTIME_BINDING_DELETE_FORBIDDEN/,
    );
    await assert.rejects(
      database.sql.unsafe(`TRUNCATE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}`),
      /V3_STORY_CLAIM_RUNTIME_BINDING_TRUNCATE_FORBIDDEN/,
    );
    const stale = await seedBindingOwner(database, {
      suffix: "stale-generation",
      workflowStepId: "implement",
      subjectKind: "story_member",
    });
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE} (
           claim_id, runtime_session_id, run_id, step_db_id, workflow_step_id,
           subject_kind, story_db_id, story_id, story_index,
           story_claim_generation, story_admission_receipt_hash,
           story_admission_subject_hash, bound_at
         ) VALUES ($1, $2, $3, $4, 'implement', 'story_member',
                   $5, $6, $7, 2, $8, $9, $10)`,
        [
          stale.claimId,
          stale.runtimeSessionId,
          stale.runId,
          stale.stepDbId,
          stale.storyDbId,
          stale.storyId,
          stale.storyIndex,
          "a".repeat(64),
          "b".repeat(64),
          stale.claimedAt,
        ],
      ),
      /V3_STORY_CLAIM_RUNTIME_BINDING_IMPLEMENT_SUBJECT_INVALID/,
    );
    const clockDrift = await seedBindingOwner(database, {
      suffix: "clock-drift",
      workflowStepId: "supervise",
      subjectKind: "final_product",
    });
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE} (
           claim_id, runtime_session_id, run_id, step_db_id, workflow_step_id,
           subject_kind, story_admission_receipt_hash,
           story_admission_subject_hash, bound_at
         ) VALUES ($1, $2, $3, $4, 'supervise', 'final_product', $5, $6,
                   $7::timestamptz + INTERVAL '1 millisecond')`,
        [
          clockDrift.claimId,
          clockDrift.runtimeSessionId,
          clockDrift.runId,
          clockDrift.stepDbId,
          "a".repeat(64),
          "b".repeat(64),
          clockDrift.claimedAt,
        ],
      ),
      /V3_STORY_CLAIM_RUNTIME_BINDING_PARENT_INVALID/,
    );
    await database.sql.unsafe(
      `DELETE FROM runs WHERE id = ANY($1::text[])`,
      [[stale.runId, clockDrift.runId]],
    );
  });

  it("rejects mutable runtime step identity drift after binding", async () => {
    const owner = await seedBindingOwner(database, {
      suffix: "runtime-step-drift",
      workflowStepId: "implement",
      subjectKind: "story_member",
    });
    await insertBinding(database, owner, "story_member");
    await assert.rejects(
      database.sql.begin(async (transaction) => {
        await transaction.unsafe(
          `UPDATE runtime_sessions
              SET workflow_step_id = 'verify'
            WHERE session_id = $1`,
          [owner.runtimeSessionId],
        );
        await verifyV3StoryClaimRuntimeBindingV1(transaction);
      }),
      /refuses an open or malformed v3 claim\/runtime owner/,
    );
  });

  it("audits more than one legacy page through scalar censuses", async () => {
    const runId = "v29-bounded-census";
    const stepDbId = await seedV3RunAndStep(database, {
      runId,
      workflowStepId: "implement",
    });
    await database.sql.unsafe(
      `INSERT INTO stories (
         id, run_id, story_index, story_id, title, status, claim_generation
       )
       SELECT 'v29-bounded-story-' || ordinal::text,
              $1,
              ordinal,
              'US-BOUND-' || ordinal::text,
              'Bounded story ' || ordinal::text,
              'running',
              1
         FROM generate_series(1, 160) ordinal`,
      [runId],
    );
    await database.sql.unsafe(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, outcome)
       SELECT $1, 'implement', story_id, 'feature-dev_developer', 'completed'
         FROM stories
        WHERE run_id = $1`,
      [runId],
    );
    await database.sql.unsafe(
      `INSERT INTO runtime_sessions (
         session_id, run_id, step_db_id, workflow_step_id, story_db_id, story_id,
         claim_id, claim_agent_id, runtime_agent_id, runtime_kind, state,
         owner_instance_id, heartbeat_at
       )
       SELECT 'RTS_v29-bounded-' || story.story_index::text,
              $1, $2, 'implement', story.id, story.story_id, claim.id,
              'feature-dev_developer', 'prism', 'external_session', 'reserved',
              'v29-test-owner', claim.claimed_at
         FROM stories story
         JOIN claim_log claim
           ON claim.run_id = story.run_id
          AND claim.step_id = 'implement'
          AND claim.story_id = story.story_id
        WHERE story.run_id = $1`,
      [runId, stepDbId],
    );
    await database.sql.unsafe(
      `INSERT INTO public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE} (
         claim_id, runtime_session_id, run_id, step_db_id, workflow_step_id,
         subject_kind, story_db_id, story_id, story_index,
         story_claim_generation, story_admission_receipt_hash,
         story_admission_subject_hash, bound_at
       )
       SELECT claim.id, runtime.session_id, $1, $2, 'implement',
              'story_member', story.id, story.story_id, story.story_index,
              story.claim_generation, $3, $4, claim.claimed_at
         FROM stories story
         JOIN claim_log claim
           ON claim.run_id = story.run_id
          AND claim.step_id = 'implement'
          AND claim.story_id = story.story_id
         JOIN runtime_sessions runtime
           ON runtime.claim_id = claim.id
          AND runtime.run_id = claim.run_id
        WHERE story.run_id = $1`,
      [runId, stepDbId, "a".repeat(64), "b".repeat(64)],
    );
    const audit = await auditV3StoryClaimRuntimeBindingV1Data(database.sql);
    assert.equal(audit.bindingCount >= 160, true);
    assert.equal(audit.bindingCount, audit.requiredOwnerCount);
  });

  it("keeps adoption and data audits on bounded scalar and paged projections", () => {
    const source = readFileSync(
      new URL("../../src/db/v3-story-claim-runtime-binding-v1-migration.ts", import.meta.url),
      "utf8",
    );
    const start = source.indexOf("export async function auditV3StoryClaimRuntimeBindingV1Data");
    const finish = source.indexOf("export async function verifyV3StoryClaimRuntimeBindingV1", start);
    assert.notEqual(start, -1);
    assert.notEqual(finish, -1);
    const auditSource = source.slice(start, finish);
    assert.match(auditSource, /COUNT\(\*\)::text[\s\S]*AS binding_count/);
    assert.match(auditSource, /COUNT\(\*\)::text FROM required_owners/);
    assert.match(source, /HISTORICAL_OWNER_PAGE_SIZE/);
    assert.match(source, /LIMIT \$5/);
    assert.doesNotMatch(auditSource, /SELECT\s+\*/iu);
    assert.doesNotMatch(auditSource, /RETURNING\s+\*/iu);
  });

  it("keeps live head-31 callers off the deprecated historical current-head aliases", () => {
    const liveCallerSources = [
      readFileSync(
        new URL("../../scripts/contract-spine-migrate.ts", import.meta.url),
        "utf8",
      ),
      readFileSync(
        new URL(
          "./platform-release-store-record-ledger-v3-contract-integration.test.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ];
    for (const source of liveCallerSources) {
      assert.doesNotMatch(source, /AtCurrentHeadData/u);
      assert.match(source, /AtV31Data/u);
    }
    const historicalV28ContractSource = readFileSync(
      new URL(
        "./runtime-completion-manifest-authority-migration.test.ts",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(historicalV28ContractSource, /AtCurrentHeadData/u);
  });

  it("rejects constraint catalog drift including validation and inheritance flags", async () => {
    const mutations = [
      `ALTER TABLE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
         DROP CONSTRAINT v3_story_claim_runtime_bindings_v1_workflow_step_check,
         ADD CONSTRAINT v3_story_claim_runtime_bindings_v1_workflow_step_check
         CHECK (workflow_step_id IN ('implement', 'supervise')) NOT VALID`,
      `ALTER TABLE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
         DROP CONSTRAINT v3_story_claim_runtime_bindings_v1_run_fkey,
         ADD CONSTRAINT v3_story_claim_runtime_bindings_v1_run_fkey
         FOREIGN KEY (run_id) REFERENCES public.runs(id)
         ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED`,
      `ALTER TABLE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
         DROP CONSTRAINT v3_story_claim_runtime_bindings_v1_receipt_hash_check,
         ADD CONSTRAINT v3_story_claim_runtime_bindings_v1_receipt_hash_check
         CHECK (story_admission_receipt_hash ~ '^[a-f0-9]{64}$') NO INHERIT`,
      `ALTER TABLE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
         DROP CONSTRAINT v3_story_claim_runtime_bindings_v1_subject_hash_check,
         ADD CONSTRAINT v3_story_claim_runtime_bindings_v1_subject_hash_check
         CHECK (story_admission_subject_hash ~ '^[a-f0-9]{64}$'
                AND story_admission_subject_hash <> repeat('0', 64))`,
    ];
    for (const mutation of mutations) {
      await assert.rejects(
        database.sql.begin(async (transaction) => {
          await transaction.unsafe(mutation);
          await verifyV3StoryClaimRuntimeBindingV1(transaction);
        }),
        /constraint mismatch/,
      );
    }
  });

  it("rejects owner, ACL, index, trigger, and relation-shape drift", async () => {
    const mutations = [
      `GRANT SELECT ON public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE} TO PUBLIC`,
      `GRANT SELECT ON public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE} TO PUBLIC`,
      `DROP INDEX public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_SCOPE_INDEX}`,
      `CREATE TRIGGER trg_v3_story_binding_external_drift
         BEFORE INSERT ON public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
         FOR EACH ROW EXECUTE FUNCTION public.setfarm_guard_v3_story_claim_runtime_binding_v1()`,
      `ALTER TABLE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
         ENABLE ROW LEVEL SECURITY`,
    ];
    for (const mutation of mutations) {
      await assert.rejects(
        database.sql.begin(async (transaction) => {
          await transaction.unsafe(mutation);
          await verifyV3StoryClaimRuntimeBindingV1(transaction);
        }),
        /mismatch/,
      );
    }
  });

  it("keeps plan, apply, and verify fail-closed on damaged journaled v29 objects", async () => {
    await database.sql.unsafe(`DROP INDEX public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_SCOPE_INDEX}`);
    try {
      const plan = await planContractSpineMigrations(database.sql);
      assert.equal(plan.status, "drift");
      assert.equal(plan.migrations.find((entry) => entry.version === 29)?.state, "adoption_mismatch");
      await assert.rejects(
        applyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    } finally {
      await database.sql.unsafe(
        `CREATE INDEX ${V3_STORY_CLAIM_RUNTIME_BINDING_V1_SCOPE_INDEX}
           ON public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
             (run_id, workflow_step_id, subject_kind, story_db_id)`,
      );
    }
  });

  it("audits current head 31 without granting production authority", async () => {
    const audit = await auditCurrentContractSpineAuthorityLedgersAtV31Data(database.sql);
    assert.equal(audit.schema, "setfarm.contract-spine-current-authority-ledgers-audit.v2");
    assert.equal(audit.productionAuthority, false);
    assert.equal(audit.productionAdmission, "forbidden");
    assert.equal(audit.v3StoryClaimRuntimeBinding.bindingCount,
      audit.v3StoryClaimRuntimeBinding.requiredOwnerCount);
  });

  it("refuses nonempty preinstalled adoption including forged hashes and wrong members", async () => {
    const isolated = await createIsolatedTestDatabase();
    try {
      await rollbackCurrentToV28(isolated);
      await isolated.sql.begin(async (transaction) =>
        applyV3StoryClaimRuntimeBindingV1(transaction));
      const forged = await seedBindingOwner(isolated, {
        suffix: "forged-adoption",
        workflowStepId: "implement",
        subjectKind: "story_member",
      });
      await insertBinding(isolated, forged, "story_member", {
        receipt: "f".repeat(64),
        subject: "e".repeat(64),
      });
      const wrongMember = await seedBindingOwner(isolated, {
        suffix: "wrong-member-adoption",
        workflowStepId: "implement",
        subjectKind: "story_member",
      });
      await isolated.sql.unsafe(
        `INSERT INTO stories (
           id, run_id, story_index, story_id, title, status, claim_generation
         ) VALUES ($1, $2, 2, 'US-WRONG-MEMBER', 'Wrong member', 'running', 1)`,
        [`${wrongMember.runId}-wrong-story-db`, wrongMember.runId],
      );
      await isolated.sql.begin(async (transaction) => {
        await transaction.unsafe(
          `ALTER TABLE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
             DISABLE TRIGGER trg_v3_story_claim_runtime_binding_guard_v1`,
        );
        await transaction.unsafe(
          `INSERT INTO public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE} (
             claim_id, runtime_session_id, run_id, step_db_id, workflow_step_id,
             subject_kind, story_db_id, story_id, story_index,
             story_claim_generation, story_admission_receipt_hash,
             story_admission_subject_hash, bound_at
           ) VALUES ($1, $2, $3, $4, 'implement', 'story_member',
                     $5, 'US-WRONG-MEMBER', 2, 1, $6, $7, $8)`,
          [
            wrongMember.claimId,
            wrongMember.runtimeSessionId,
            wrongMember.runId,
            wrongMember.stepDbId,
            `${wrongMember.runId}-wrong-story-db`,
            "a".repeat(64),
            "b".repeat(64),
            wrongMember.claimedAt,
          ],
        );
        await transaction.unsafe(
          `ALTER TABLE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
             ENABLE TRIGGER trg_v3_story_claim_runtime_binding_guard_v1`,
        );
      });
      await assert.rejects(
        applyContractSpineMigrations(isolated.sql),
        /Migration 29 is partially present/,
      );
      const journal = await isolated.sql.unsafe<Array<{ present: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM setfarm_schema_migrations WHERE version = 29
         ) AS present`,
      );
      assert.equal(journal[0]?.present, false);
    } finally {
      await isolated.cleanup();
    }
  });

  it("plans and rejects exact unjournaled cutover topology instead of adopting it", async () => {
    const isolated = await createIsolatedTestDatabase();
    try {
      await rollbackCurrentToV28(isolated);
      await isolated.sql.begin(async (transaction) =>
        applyV3StoryClaimRuntimeBindingV1(transaction));
      const plan = await planContractSpineMigrations(isolated.sql);
      assert.equal(
        plan.migrations.find((entry) => entry.version === 29)?.state,
        "adoption_mismatch",
      );
      await assert.rejects(
        applyContractSpineMigrations(isolated.sql),
        /Migration 29 is partially present/,
      );
      const journal = await isolated.sql.unsafe<Array<{ present: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM setfarm_schema_migrations WHERE version = 29
         ) AS present`,
      );
      assert.equal(journal[0]?.present, false);
    } finally {
      await isolated.cleanup();
    }
  });

  it("refuses impossible adopted journal state for migration 29", async () => {
    await rollbackOperationalFailureCauseAuthorityV3ToV30(database.sql, {
      targetReleaseSha: "6".repeat(40),
    });
    await rollbackOperationalFailureCauseAuthorityV2ToV29(database.sql, {
      targetReleaseSha: "7".repeat(40),
    });
    await database.sql.unsafe(
      "UPDATE setfarm_schema_migrations SET state = 'adopted' WHERE version = 29",
    );
    try {
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        /Migration 29 existing relation does not match the expected shape/,
      );
      await assert.rejects(
        auditCurrentContractSpineAuthorityLedgersAtV31Data(database.sql),
        /current authority audit requires the exact 26, 27, 28, 29, 30, 31 head/,
      );
      await assert.rejects(
        rollbackV3StoryClaimRuntimeBindingToV28(database.sql, {
          targetReleaseSha: "8".repeat(40),
        }),
        /Migration 29 is absent or differs from the rollback source contract/,
      );
    } finally {
      await database.sql.unsafe(
        "UPDATE setfarm_schema_migrations SET state = 'applied' WHERE version = 29",
      );
      await applyContractSpineMigrations(database.sql);
    }
  });

  it("rolls back only while empty, retains base relations, and refuses provenance", async () => {
    const isolated = await createIsolatedTestDatabase();
    try {
      await isolated.sql.unsafe(
        `INSERT INTO setfarm_schema_migrations (
           version, name, checksum, state, applied_at
         ) VALUES (32, '032_future_fixture', $1, 'applied', NOW())`,
        ["f".repeat(64)],
      );
      await assert.rejects(
        rollbackOperationalFailureCauseAuthorityV3ToV30(isolated.sql, {
          targetReleaseSha: "7".repeat(40),
        }),
        /Migration 32 must be rolled back before migration 31/,
      );
      await isolated.sql.unsafe("DELETE FROM setfarm_schema_migrations WHERE version = 32");
      await rollbackOperationalFailureCauseAuthorityV3ToV30(isolated.sql, {
        targetReleaseSha: "6".repeat(40),
      });
      await rollbackOperationalFailureCauseAuthorityV2ToV29(isolated.sql, {
        targetReleaseSha: "7".repeat(40),
      });
      const result = await rollbackV3StoryClaimRuntimeBindingToV28(isolated.sql, {
        targetReleaseSha: "8".repeat(40),
      });
      assert.equal(result.fromVersion, 29);
      assert.equal(result.targetVersion, 28);
      const retained = await isolated.sql.unsafe<Array<{
        steps: boolean;
        stories: boolean;
        cutover: boolean;
        binding: boolean;
      }>>(
        `SELECT to_regclass('public.steps') IS NOT NULL AS steps,
                to_regclass('public.stories') IS NOT NULL AS stories,
                to_regclass('public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE}')
                  IS NOT NULL AS cutover,
                to_regclass('public.v3_story_claim_runtime_bindings_v1') IS NOT NULL
                  AS binding`,
      );
      assert.deepEqual(retained[0], {
        steps: true,
        stories: true,
        cutover: false,
        binding: false,
      });
      await applyContractSpineMigrations(isolated.sql);
      const owner = await seedBindingOwner(isolated, {
        suffix: "rollback-provenance",
        workflowStepId: "supervise",
        subjectKind: "final_product",
      });
      await insertBinding(isolated, owner, "final_product");
      await rollbackOperationalFailureCauseAuthorityV3ToV30(isolated.sql, {
        targetReleaseSha: "7".repeat(40),
      });
      await rollbackOperationalFailureCauseAuthorityV2ToV29(isolated.sql, {
        targetReleaseSha: "8".repeat(40),
      });
      await assert.rejects(
        rollbackV3StoryClaimRuntimeBindingToV28(isolated.sql, {
          targetReleaseSha: "9".repeat(40),
        }),
        /rollback refuses to remove v3 story claim\/runtime binding provenance/,
      );
      assert.equal(await detectV3StoryClaimRuntimeBindingV1(isolated.sql), "present");
    } finally {
      await isolated.cleanup();
    }
  });

  it("refuses partial or wrong preexisting base relations atomically", async () => {
    for (const setup of [
      "CREATE TABLE steps (id TEXT PRIMARY KEY)",
      "CREATE TABLE steps (id TEXT PRIMARY KEY); CREATE TABLE stories (id TEXT PRIMARY KEY)",
    ]) {
      const isolated = await createIsolatedTestDatabase({ migrate: false });
      try {
        for (const statement of setup.split("; ")) {
          await isolated.sql.unsafe(statement);
        }
        await assert.rejects(
          applyContractSpineMigrations(isolated.sql),
          /canonical steps and stories relations|canonical steps column census mismatch/,
        );
        const rows = await isolated.sql.unsafe<Array<{ journal: boolean; binding: boolean }>>(
          `SELECT to_regclass('public.setfarm_schema_migrations') IS NOT NULL AS journal,
                  to_regclass('public.v3_story_claim_runtime_bindings_v1') IS NOT NULL
                    AS binding`,
        );
        assert.deepEqual(rows[0], { journal: false, binding: false });
      } finally {
        await isolated.cleanup();
      }
    }
  });
});
