import type postgres from "postgres";

import {
  AcceptedCandidateV1Schema,
  type AcceptedCandidateV1,
} from "../evidence/accepted-candidate-v1.js";
import {
  V3DeployAuthorityEvidenceV1Schema,
  type V3DeployAuthorityEvidenceV1,
} from "./schemas/v3-deploy-authority-evidence-v1.js";
import { captureShadowSourceRevision } from "./shadow-attempt-recorder.js";
import type { SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";

type Sql = postgres.Sql | postgres.TransactionSql;

export type V3DeployAuthorityErrorCode =
  | "V3_DEPLOY_RUN_NOT_FOUND"
  | "V3_DEPLOY_ACCEPTED_CANDIDATE_MISSING"
  | "V3_DEPLOY_ACCEPTED_CANDIDATE_INVALID"
  | "V3_DEPLOY_ACCEPTED_CANDIDATE_POINTER_MISMATCH"
  | "V3_DEPLOY_SOURCE_UNAVAILABLE"
  | "V3_DEPLOY_SOURCE_REVISION_MISMATCH"
  | "V3_DEPLOY_PACKET_INVALID"
  | "V3_DEPLOY_RUNTIME_ENV_MISSING"
  | "V3_DEPLOY_TARGET_UNSUPPORTED"
  | "V3_DEPLOY_PLATFORM_FAILED"
  | "V3_DEPLOY_HEALTH_FAILED"
  | "V3_DEPLOY_ROLLBACK_FAILED";

export class V3DeployAuthorityError extends Error {
  readonly code: V3DeployAuthorityErrorCode;
  readonly hardPreClaim = true;
  readonly evidence: Readonly<V3DeployAuthorityEvidenceV1>;

  constructor(
    code: V3DeployAuthorityErrorCode,
    message: string,
    evidence: Readonly<Record<string, string | null>> = {},
  ) {
    super(`${code}:${message}`);
    this.name = "V3DeployAuthorityError";
    this.code = code;
    this.evidence = Object.freeze(V3DeployAuthorityEvidenceV1Schema.parse(evidence));
  }
}

function fail(
  code: V3DeployAuthorityErrorCode,
  message: string,
  evidence?: Readonly<Record<string, string | null>>,
): never {
  throw new V3DeployAuthorityError(code, message, evidence);
}

export type V3DeployAuthorityResult =
  | Readonly<{ status: "not_v3"; protocol: string }>
  | Readonly<{
    status: "authorized";
    candidate: AcceptedCandidateV1;
    observedSource: SourceRevisionV1;
  }>;

export function evaluateV3DeployAuthority(input: Readonly<{
  runId: string;
  protocol: string;
  acceptedCandidateHash: string | null;
  candidatePayload: unknown;
  observedSource: SourceRevisionV1;
}>): V3DeployAuthorityResult {
  if (input.protocol !== "v3") return { status: "not_v3", protocol: input.protocol };
  if (!input.acceptedCandidateHash || input.candidatePayload === null || input.candidatePayload === undefined) {
    fail("V3_DEPLOY_ACCEPTED_CANDIDATE_MISSING", "deploy requires the immutable final-tree acceptance pointer", {
      runId: input.runId,
      acceptedCandidateHash: input.acceptedCandidateHash || null,
    });
  }
  const parsed = AcceptedCandidateV1Schema.safeParse(input.candidatePayload);
  if (!parsed.success || parsed.data.runId !== input.runId) {
    fail("V3_DEPLOY_ACCEPTED_CANDIDATE_INVALID", "accepted candidate payload is invalid or belongs to another run", {
      runId: input.runId,
      acceptedCandidateHash: input.acceptedCandidateHash,
    });
  }
  const candidate = parsed.data;
  if (candidate.candidateHash !== input.acceptedCandidateHash) {
    fail("V3_DEPLOY_ACCEPTED_CANDIDATE_POINTER_MISMATCH", "run pointer does not bind the canonical candidate hash", {
      runId: input.runId,
      acceptedCandidateHash: input.acceptedCandidateHash,
      candidateHash: candidate.candidateHash,
    });
  }
  if (
    candidate.sourceRevision.sha !== input.observedSource.sha
    || candidate.sourceRevision.treeHash !== input.observedSource.treeHash
  ) {
    fail("V3_DEPLOY_SOURCE_REVISION_MISMATCH", "deploy source changed after final-tree acceptance", {
      runId: input.runId,
      candidateHash: candidate.candidateHash,
      expectedSha: candidate.sourceRevision.sha,
      expectedTreeHash: candidate.sourceRevision.treeHash,
      observedSha: input.observedSource.sha,
      observedTreeHash: input.observedSource.treeHash,
    });
  }
  return { status: "authorized", candidate, observedSource: input.observedSource };
}

export async function assertV3DeployAuthority(input: Readonly<{
  sql: Sql;
  runId: string;
  worktree: string;
  captureSource?: (worktree: string) => Promise<SourceRevisionV1>;
}>): Promise<V3DeployAuthorityResult> {
  const runRows = await input.sql.unsafe<Array<{ protocol: string }>>(
    "SELECT protocol FROM runs WHERE id = $1 LIMIT 1",
    [input.runId],
  );
  const run = runRows[0];
  if (!run) fail("V3_DEPLOY_RUN_NOT_FOUND", "run does not exist", { runId: input.runId });
  if (run.protocol !== "v3") return { status: "not_v3", protocol: run.protocol };

  const candidateRows = await input.sql.unsafe<Array<{
    accepted_candidate_hash: string | null;
    payload: unknown;
  }>>(
    `SELECT run.accepted_candidate_hash, candidate.payload
       FROM runs run
       LEFT JOIN accepted_candidates candidate
         ON candidate.candidate_hash = run.accepted_candidate_hash
        AND candidate.run_id = run.id
      WHERE run.id = $1
      LIMIT 1`,
    [input.runId],
  );
  const row = candidateRows[0];
  let observedSource: SourceRevisionV1;
  try {
    observedSource = await (input.captureSource ?? captureShadowSourceRevision)(input.worktree);
  } catch (error) {
    fail("V3_DEPLOY_SOURCE_UNAVAILABLE", `cannot fingerprint deploy source: ${String(error).slice(0, 300)}`, {
      runId: input.runId,
    });
  }
  return evaluateV3DeployAuthority({
    runId: input.runId,
    protocol: run.protocol,
    acceptedCandidateHash: row?.accepted_candidate_hash ?? null,
    candidatePayload: row?.payload ?? null,
    observedSource,
  });
}
