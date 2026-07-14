import { createHash } from "node:crypto";
import path from "node:path";

import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import {
  ClaimEnvelopeV1Schema,
  type ClaimEnvelopeV1,
} from "./schemas/claim-envelope-v1.js";

export const V3_STAGE_INSTRUCTION_MAX_BYTES = 192 * 1024;
export const V3_STAGE_EXECUTION_CONTEXT_MAX_BYTES = 64 * 1024;

const BoundedIdentitySchema = z.string().min(1).max(500);
const AbsolutePathSchema = z.string().min(1).max(4_000).refine(
  (value) => path.isAbsolute(value),
  "Stage execution paths must be absolute",
);

const V3StageInstructionRefV1Schema = z.object({
  schema: z.literal("setfarm.v3-stage-instruction-ref.v1"),
  artifactHash: Sha256Schema,
  byteLength: z.number().int().positive().max(V3_STAGE_INSTRUCTION_MAX_BYTES),
  mediaType: z.literal("text/markdown; charset=utf-8"),
  path: AbsolutePathSchema,
}).strict();

const V3StageCompletionContractV1Schema = z.object({
  schema: z.literal("setfarm.v3-stage-completion-contract.v1"),
  outputFile: AbsolutePathSchema,
  responseAuthority: z.literal("stage_instruction"),
  normalOutcome: z.literal("step_complete"),
  infrastructureOutcome: z.literal("step_fail"),
}).strict();

const V3StageStoryIdentityV1Schema = z.object({
  storyId: BoundedIdentitySchema,
  storyDbId: BoundedIdentitySchema,
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
  attemptGeneration: z.number().int().positive(),
}).strict();

function exactInstructionHash(content: string): string {
  return createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex");
}

const V3StageExecutionContextShapeV1Schema = z.object({
  schema: z.literal("setfarm.v3-stage-execution-context.v1"),
  protocol: z.literal("v3"),
  contextVersion: z.literal(1),
  workflow: BoundedIdentitySchema,
  role: BoundedIdentitySchema,
  runId: BoundedIdentitySchema,
  stepId: BoundedIdentitySchema,
  workflowStepId: BoundedIdentitySchema,
  workdir: AbsolutePathSchema,
  claim: z.object({
    claimId: z.number().int().positive(),
    claimGeneration: z.number().int().nonnegative().optional(),
    claimAgentId: BoundedIdentitySchema,
    runtimeAgentId: BoundedIdentitySchema,
    issuedAt: z.string().datetime({ offset: true }),
  }).strict(),
  story: V3StageStoryIdentityV1Schema.optional(),
  instruction: V3StageInstructionRefV1Schema,
  completion: V3StageCompletionContractV1Schema,
  contextHash: Sha256Schema,
}).strict();

function executionContextPayload(value: z.infer<typeof V3StageExecutionContextShapeV1Schema>): Record<string, unknown> {
  const { contextHash: _contextHash, ...payload } = value;
  return payload;
}

export const V3StageExecutionContextV1Schema = V3StageExecutionContextShapeV1Schema.superRefine(
  (value, context) => {
    if (value.claim.claimAgentId !== `${value.workflow}_${value.role}`) {
      context.addIssue({
        code: "custom",
        path: ["claim", "claimAgentId"],
        message: "Stage execution role must match the exact claim authority",
      });
    }
    const expectedInstructionPath = path.join(
      value.workdir,
      ".setfarm",
      "stage-executions",
      `claim-${value.claim.claimId}`,
      "stage-instruction.md",
    );
    if (path.resolve(value.instruction.path) !== path.resolve(expectedInstructionPath)) {
      context.addIssue({
        code: "custom",
        path: ["instruction", "path"],
        message: "Stage instruction path must be owned by the exact execution workdir",
      });
    }
    if (hashCanonicalJson(executionContextPayload(value)) !== value.contextHash) {
      context.addIssue({
        code: "custom",
        path: ["contextHash"],
        message: "Stage execution context hash must bind the exact canonical manifest",
      });
    }
    if (Buffer.byteLength(JSON.stringify(value, null, 2), "utf8") > V3_STAGE_EXECUTION_CONTEXT_MAX_BYTES) {
      context.addIssue({
        code: "custom",
        path: [],
        message: "Stage execution context exceeds its bounded handoff capacity",
      });
    }
  },
);

export const V3StageClaimHandoffV1Schema = z.object({
  schema: z.literal("setfarm.v3-stage-claim-handoff.v1"),
  context: V3StageExecutionContextV1Schema,
  instructionContent: z.string().min(1).max(V3_STAGE_INSTRUCTION_MAX_BYTES),
}).strict().superRefine((value, context) => {
  const byteLength = Buffer.byteLength(value.instructionContent, "utf8");
  if (byteLength > V3_STAGE_INSTRUCTION_MAX_BYTES) {
    context.addIssue({
      code: "custom",
      path: ["instructionContent"],
      message: "Stage instruction exceeds its bounded handoff capacity",
    });
  }
  if (byteLength !== value.context.instruction.byteLength) {
    context.addIssue({
      code: "custom",
      path: ["context", "instruction", "byteLength"],
      message: "Stage instruction byte length differs from the exact artifact",
    });
  }
  if (exactInstructionHash(value.instructionContent) !== value.context.instruction.artifactHash) {
    context.addIssue({
      code: "custom",
      path: ["context", "instruction", "artifactHash"],
      message: "Stage instruction hash differs from the exact artifact bytes",
    });
  }
});

export type V3StageExecutionContextV1 = z.infer<typeof V3StageExecutionContextV1Schema>;
export type V3StageClaimHandoffV1 = z.infer<typeof V3StageClaimHandoffV1Schema>;

export function createV3StageClaimHandoffV1(input: Readonly<{
  claimEnvelope: ClaimEnvelopeV1;
  workflow: string;
  role: string;
  workdir: string;
  outputFile: string;
  instructionContent: string;
}>): V3StageClaimHandoffV1 {
  const envelope = ClaimEnvelopeV1Schema.parse(input.claimEnvelope);
  if (envelope.protocol !== "v3") throw new Error("V3_STAGE_CLAIM_ENVELOPE_REQUIRED");
  const instructionContent = String(input.instructionContent || "");
  const byteLength = Buffer.byteLength(instructionContent, "utf8");
  if (byteLength < 1 || byteLength > V3_STAGE_INSTRUCTION_MAX_BYTES) {
    throw new Error("V3_STAGE_INSTRUCTION_CAPACITY_INVALID");
  }
  const workdir = path.resolve(input.workdir);
  if (envelope.workdir && path.resolve(envelope.workdir) !== workdir) {
    throw new Error("V3_STAGE_CONTEXT_WORKDIR_MISMATCH");
  }
  if (envelope.claimAgentId !== `${input.workflow}_${input.role}`) {
    throw new Error("V3_STAGE_CONTEXT_CLAIM_ROLE_MISMATCH");
  }
  const instructionPath = path.join(
    workdir,
    ".setfarm",
    "stage-executions",
    `claim-${envelope.claimId}`,
    "stage-instruction.md",
  );
  const story = envelope.storyId && envelope.storyDbId && envelope.attempt
    ? {
        storyId: envelope.storyId,
        storyDbId: envelope.storyDbId,
        attemptId: envelope.attempt.attemptId,
        attemptGeneration: envelope.attempt.generation,
      }
    : undefined;
  const payload = {
    schema: "setfarm.v3-stage-execution-context.v1" as const,
    protocol: "v3" as const,
    contextVersion: 1 as const,
    workflow: input.workflow,
    role: input.role,
    runId: envelope.runId,
    stepId: envelope.stepId,
    workflowStepId: envelope.workflowStepId,
    workdir,
    claim: {
      claimId: envelope.claimId,
      ...(envelope.claimGeneration !== undefined
        ? { claimGeneration: envelope.claimGeneration }
        : {}),
      claimAgentId: envelope.claimAgentId,
      runtimeAgentId: envelope.runtimeAgentId,
      issuedAt: envelope.issuedAt,
    },
    ...(story ? { story } : {}),
    instruction: {
      schema: "setfarm.v3-stage-instruction-ref.v1" as const,
      artifactHash: exactInstructionHash(instructionContent),
      byteLength,
      mediaType: "text/markdown; charset=utf-8" as const,
      path: instructionPath,
    },
    completion: {
      schema: "setfarm.v3-stage-completion-contract.v1" as const,
      outputFile: path.resolve(input.outputFile),
      responseAuthority: "stage_instruction" as const,
      normalOutcome: "step_complete" as const,
      infrastructureOutcome: "step_fail" as const,
    },
  };
  return V3StageClaimHandoffV1Schema.parse({
    schema: "setfarm.v3-stage-claim-handoff.v1",
    context: {
      ...payload,
      contextHash: hashCanonicalJson(payload),
    },
    instructionContent,
  });
}
