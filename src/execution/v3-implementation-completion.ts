import type postgres from "postgres";

import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import { assertClaimAuthority } from "./claim-authority.js";
import {
  createV3ImplementationAttemptHandoffV1,
  loadV3ImplementationAttemptContext,
} from "./v3-implementation-attempt.js";
import { createV3ImplementationContextV1 } from "./v3-implementation-handoff.js";
import { compileV3ImplementationAgentOutputV1 } from "./v3-implementation-output.js";
import type { ClaimEnvelopeV1 } from "./schemas/claim-envelope-v1.js";
import type { RuntimeCompletionSubmissionEvidenceV1 } from "./schemas/runtime-completion-submission-evidence-v1.js";

type Sql = postgres.Sql;

export type CompiledV3ImplementationCompletionProposal = Readonly<{
  output: string;
  sourceProposal: string;
  submissionEvidence: RuntimeCompletionSubmissionEvidenceV1;
}>;

/**
 * Recompile the untrusted model proposal at the durable publication boundary.
 * A caller cannot assert compiler provenance: this function reloads the sealed
 * attempt context and derives both canonical output and its immutable receipt.
 */
export async function compileV3ImplementationCompletionProposal(input: Readonly<{
  sql: Sql;
  envelope: ClaimEnvelopeV1;
  rawProposal: string;
}>): Promise<CompiledV3ImplementationCompletionProposal> {
  const claimEnvelope = input.envelope;
  if (
    claimEnvelope.protocol !== "v3"
    || claimEnvelope.workflowStepId !== "implement"
    || !claimEnvelope.storyId
    || !claimEnvelope.storyDbId
    || !claimEnvelope.attempt?.attemptId
  ) {
    throw new Error("V3_IMPLEMENTATION_COMPLETION_IDENTITY_REQUIRED");
  }
  const rows = await input.sql.unsafe<Array<{
    id: string;
    step_id: string;
    type: string;
  }>>(
    "SELECT id, step_id, type FROM steps WHERE id = $1 LIMIT 1",
    [claimEnvelope.stepId],
  );
  const step = rows[0];
  if (!step || step.step_id !== "implement" || step.type !== "loop") {
    throw new Error("V3_IMPLEMENTATION_COMPLETION_STEP_IDENTITY_INVALID");
  }
  const authority = await assertClaimAuthority(input.sql, claimEnvelope, step.id);
  const envelope = authority.envelope;
  if (!envelope.storyId || !envelope.storyDbId || !envelope.attempt?.attemptId) {
    throw new Error("V3_IMPLEMENTATION_COMPLETION_IDENTITY_REQUIRED");
  }
  const compiled = await loadV3ImplementationAttemptContext({
    runId: envelope.runId,
    storyId: envelope.storyId,
    attemptId: envelope.attempt.attemptId,
  });
  if (!compiled.attempt.branch || !compiled.attempt.worktree) {
    throw new Error("V3_IMPLEMENTATION_ATTEMPT_WORKSPACE_IDENTITY_REQUIRED");
  }
  const handoff = createV3ImplementationAttemptHandoffV1({
    stepDbId: step.id,
    storyDbId: envelope.storyDbId,
    claimId: envelope.claimId,
    branch: compiled.attempt.branch,
    workdir: compiled.attempt.worktree,
    compiled,
  });
  const compilation = compileV3ImplementationAgentOutputV1(
    input.rawProposal,
    createV3ImplementationContextV1({ handoff }),
  );
  return Object.freeze({
    output: canonicalJsonStringify(compilation.output),
    sourceProposal: input.rawProposal.trim(),
    submissionEvidence: Object.freeze({
      schema: "setfarm.runtime-completion-submission-evidence.v1",
      compiler: compilation.schema,
      sourceSchema: compilation.sourceSchema,
      sourceProposalHash: compilation.sourceProposalHash,
      canonicalOutputHash: compilation.canonicalOutputHash,
      ignoredFieldPaths: [...compilation.ignoredFieldPaths],
    }),
  });
}
