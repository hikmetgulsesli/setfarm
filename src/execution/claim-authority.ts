import fs from "node:fs";

import type postgres from "postgres";

import {
  ClaimEnvelopeV1Schema,
  type ClaimEnvelopeV1,
} from "./schemas/claim-envelope-v1.js";

type AuthorityRow = {
  claim_id: string;
  claim_run_id: string;
  claim_step_id: string;
  claim_story_id: string | null;
  claim_agent_id: string;
  claim_outcome: string | null;
  protocol: string;
  run_status: string;
  step_db_id: string;
  step_status: string;
  current_story_id: string | null;
  story_db_id: string | null;
  story_status: string | null;
  story_claimed_by: string | null;
  story_claim_generation: number | null;
  attempt_id: string | null;
  attempt_claim_id: string | null;
  attempt_generation: number | null;
  attempt_fence_token: string | null;
  attempt_agent_id: string | null;
  attempt_disposition: string | null;
  run_packet_hash: string | null;
  attempt_packet_hash: string | null;
  attempt_compilation_report_hash: string | null;
  attempt_slice_hash: string | null;
};

export type ClaimAuthoritySnapshot = Readonly<{
  envelope: ClaimEnvelopeV1;
  protocol: "legacy" | "shadow" | "v3";
  runStatus: "running" | "resuming";
  storyDbId?: string;
  storyId?: string;
}>;

export function parseClaimEnvelope(input: unknown): ClaimEnvelopeV1 {
  return ClaimEnvelopeV1Schema.parse(input);
}

export function readClaimEnvelopeFile(filePath: string): ClaimEnvelopeV1 {
  if (!filePath || !filePath.trim()) throw new Error("CLAIM_ENVELOPE_FILE_REQUIRED");
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size <= 0 || stat.size > 16 * 1024 * 1024) {
    throw new Error("CLAIM_ENVELOPE_FILE_INVALID");
  }
  return parseClaimEnvelope(JSON.parse(fs.readFileSync(filePath, "utf8")));
}

/**
 * Read-only proof used before long-running completion gates.
 *
 * The terminal transition repeats these checks under row locks. This early
 * check keeps stale/mismatched workers from performing PR, git, or context
 * side effects against a story they no longer own.
 */
export async function assertClaimAuthority(
  sql: postgres.Sql,
  rawEnvelope: unknown,
  expectedStepDbId: string,
): Promise<ClaimAuthoritySnapshot> {
  const envelope = parseClaimEnvelope(rawEnvelope);
  if (envelope.stepId !== expectedStepDbId) throw new Error("CLAIM_AUTHORITY_STEP_DB_ID_MISMATCH");

  const rows = await sql.unsafe<AuthorityRow[]>(
    `SELECT cl.id::text AS claim_id,
            cl.run_id AS claim_run_id,
            cl.step_id AS claim_step_id,
            cl.story_id AS claim_story_id,
            cl.agent_id AS claim_agent_id,
            cl.outcome AS claim_outcome,
            r.protocol,
            r.status AS run_status,
            s.id AS step_db_id,
            s.status AS step_status,
            s.current_story_id,
            st.id AS story_db_id,
            st.status AS story_status,
            st.claimed_by AS story_claimed_by,
            st.claim_generation AS story_claim_generation,
            ea.attempt_id,
            ea.claim_id::text AS attempt_claim_id,
            ea.generation AS attempt_generation,
            ea.fence_token AS attempt_fence_token,
            ea.agent_id AS attempt_agent_id,
            ea.disposition AS attempt_disposition,
            r.packet_hash AS run_packet_hash,
            ea.packet_hash AS attempt_packet_hash,
            ea.compilation_report_hash AS attempt_compilation_report_hash,
            ea.slice_hash AS attempt_slice_hash
       FROM claim_log cl
       JOIN runs r ON r.id = cl.run_id
       JOIN steps s ON s.id = $2 AND s.run_id = cl.run_id AND s.step_id = cl.step_id
       LEFT JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
       LEFT JOIN execution_attempts ea ON ea.attempt_id = $3
      WHERE cl.id = $1
      LIMIT 1`,
    [envelope.claimId, expectedStepDbId, envelope.attempt?.attemptId ?? null],
  );
  const row = rows[0];
  if (!row) throw new Error("CLAIM_AUTHORITY_NOT_FOUND");
  if (
    row.claim_run_id !== envelope.runId
    || row.claim_step_id !== envelope.workflowStepId
    || (row.claim_story_id ?? undefined) !== envelope.storyId
    || row.claim_agent_id !== envelope.claimAgentId
  ) {
    throw new Error("CLAIM_AUTHORITY_IDENTITY_MISMATCH");
  }
  if (row.claim_outcome !== null) throw new Error("CLAIM_AUTHORITY_ALREADY_TERMINAL");
  if (row.protocol !== envelope.protocol) throw new Error("CLAIM_AUTHORITY_PROTOCOL_MISMATCH");
  if (!["running", "resuming"].includes(row.run_status)) throw new Error("CLAIM_AUTHORITY_RUN_NOT_ACTIVE");
  if (row.step_status !== "running") throw new Error("CLAIM_AUTHORITY_STEP_NOT_RUNNING");

  if (envelope.storyId) {
    if (
      row.story_db_id !== envelope.storyDbId
      || row.current_story_id !== envelope.storyDbId
      || row.story_status !== "running"
      || (row.story_claimed_by !== null && row.story_claimed_by !== envelope.claimAgentId)
    ) {
      throw new Error("CLAIM_AUTHORITY_STORY_OWNERSHIP_MISMATCH");
    }
    if (
      envelope.claimGeneration !== undefined
      && row.story_claim_generation !== envelope.claimGeneration
    ) {
      throw new Error("CLAIM_AUTHORITY_GENERATION_MISMATCH");
    }
  }

  if (envelope.protocol !== "legacy" && envelope.storyId) {
    const attempt = envelope.attempt;
    if (!attempt) throw new Error("CLAIM_AUTHORITY_ATTEMPT_REQUIRED");
    if (
      row.attempt_id !== attempt.attemptId
      || row.attempt_claim_id !== String(envelope.claimId)
      || row.attempt_generation !== attempt.generation
      || row.attempt_fence_token !== attempt.fenceToken
      || !["claimed", "running"].includes(row.attempt_disposition || "")
      || (row.attempt_agent_id !== null && row.attempt_agent_id !== envelope.claimAgentId)
    ) {
      throw new Error("CLAIM_AUTHORITY_ATTEMPT_FENCE_MISMATCH");
    }
    if (
      envelope.protocol === "v3"
      && (
        !row.run_packet_hash
        || row.attempt_packet_hash !== row.run_packet_hash
        || !row.attempt_compilation_report_hash
        || !row.attempt_slice_hash
      )
    ) {
      throw new Error("CLAIM_AUTHORITY_V3_ATTEMPT_CONTRACT_MISMATCH");
    }
  }

  return {
    envelope,
    protocol: envelope.protocol,
    runStatus: row.run_status as "running" | "resuming",
    ...(envelope.storyDbId ? { storyDbId: envelope.storyDbId } : {}),
    ...(envelope.storyId ? { storyId: envelope.storyId } : {}),
  };
}
