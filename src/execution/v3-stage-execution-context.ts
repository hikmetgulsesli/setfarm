import { createHash } from "node:crypto";
import path from "node:path";

import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import {
  AgentToolPolicyV1Schema,
  StageOutputTransportV1Schema,
  claimBoundStepCompleteStdinTransportV1,
  createAgentToolPolicyV1,
  type AgentToolPolicyProfile,
  type AgentToolPolicyV1,
  type StageOutputTransportV1,
} from "./agent-tool-policy.js";
import {
  ClaimEnvelopeV1Schema,
  type ClaimEnvelopeV1,
} from "./schemas/claim-envelope-v1.js";
import {
  createV3StageRetryDirectiveV1,
  V3_STAGE_PREVIOUS_OUTPUT_MAX_BYTES,
  V3StageRetryDirectiveV1Schema,
  V3StageRetrySourceV1Schema,
  type V3StageRetrySourceV1,
} from "./v3-stage-retry-authority.js";

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
  outputFileAuthority: z.literal("legacy_compatibility_only"),
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

const STAGE_TOOL_POLICY_PROFILE_BY_AUTHORITY = {
  "bug-fix/triage/triager": "artifact-only",
  "bug-fix/investigate/investigator": "artifact-only",
  "bug-fix/setup/setup": "workspace-bootstrap",
  "bug-fix/fix/fixer": "source-scoped",
  "bug-fix/verify/verifier": "verification",
  "bug-fix/pr/pr": "repository-operator",
  "daily-standup/collect/collector": "artifact-only",
  "daily-standup/report/reporter": "artifact-only",
  "feature-dev/plan/planner": "artifact-only",
  "feature-dev/design/designer": "artifact-only",
  "feature-dev/stories/planner": "artifact-only",
  "feature-dev/setup-repo/setup-repo": "workspace-bootstrap",
  "feature-dev/setup-build/setup-build": "workspace-bootstrap",
  "feature-dev/implement/developer": "source-scoped",
  "feature-dev/verify/reviewer": "verification",
  "feature-dev/supervise/supervisor": "source-scoped",
  "feature-dev/security-gate/security-gate": "scanner",
  "feature-dev/qa-test/qa-tester": "browser-verification",
  "feature-dev/final-test/tester": "browser-verification",
  "feature-dev/deploy/deployer": "platform-operator",
  "security-audit/scan/scanner": "scanner",
  "security-audit/prioritize/prioritizer": "artifact-only",
  "security-audit/setup/setup": "workspace-bootstrap",
  "security-audit/fix/fixer": "source-scoped",
  "security-audit/verify/verifier": "verification",
  "security-audit/test/tester": "browser-verification",
  "security-audit/pr/pr": "repository-operator",
  "ui-refactor/plan/planner": "artifact-only",
  "ui-refactor/setup/setup": "workspace-bootstrap",
  "ui-refactor/implement/developer": "source-scoped",
  "ui-refactor/verify/verifier": "verification",
  "ui-refactor/final-test/tester": "browser-verification",
} as const satisfies Record<string, AgentToolPolicyProfile>;

function resolveStageToolPolicyProfile(
  workflow: string,
  workflowStepId: string,
  role: string,
): AgentToolPolicyProfile | undefined {
  const authorityKey = `${workflow}/${workflowStepId}/${role}`;
  return STAGE_TOOL_POLICY_PROFILE_BY_AUTHORITY[
    authorityKey as keyof typeof STAGE_TOOL_POLICY_PROFILE_BY_AUTHORITY
  ];
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
  retry: V3StageRetryDirectiveV1Schema.optional(),
  toolPolicy: AgentToolPolicyV1Schema,
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
    const expectedToolPolicyProfile = resolveStageToolPolicyProfile(
      value.workflow,
      value.workflowStepId,
      value.role,
    );
    if (!expectedToolPolicyProfile) {
      context.addIssue({
        code: "custom",
        path: ["toolPolicy", "profile"],
        message: "Stage execution authority has no canonical tool policy mapping",
      });
    } else if (value.toolPolicy.profile !== expectedToolPolicyProfile) {
      context.addIssue({
        code: "custom",
        path: ["toolPolicy", "profile"],
        message: "Stage tool policy profile must match the exact workflow stage authority",
      });
    }
    const outputTransport = value.toolPolicy.artifactSubmission.transport;
    if (
      outputTransport.kind === "legacy-output-file"
      && outputTransport.outputFile !== value.completion.outputFile
    ) {
      context.addIssue({
        code: "custom",
        path: ["toolPolicy", "artifactSubmission", "transport", "outputFile"],
        message: "Legacy output transport must bind the exact compatibility output file",
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
    if (value.retry) {
      const expectedPreviousOutputPath = path.join(
        value.workdir,
        ".setfarm",
        "stage-executions",
        `claim-${value.claim.claimId}`,
        "previous-output.txt",
      );
      if (path.resolve(value.retry.previousOutput.path) !== path.resolve(expectedPreviousOutputPath)) {
        context.addIssue({
          code: "custom",
          path: ["retry", "previousOutput", "path"],
          message: "Stage retry output path must be owned by the exact claim execution directory",
        });
      }
      if (value.retry.sourceState.currentInstructionHash !== value.instruction.artifactHash) {
        context.addIssue({
          code: "custom",
          path: ["retry", "sourceState", "currentInstructionHash"],
          message: "Stage retry must bind the current instruction artifact hash",
        });
      }
      if (value.retry.failure.workflowStepId !== value.workflowStepId) {
        context.addIssue({
          code: "custom",
          path: ["retry", "failure", "workflowStepId"],
          message: "Stage retry failure must belong to the exact workflow step",
        });
      }
      if (value.retry.previousClaimId >= value.claim.claimId) {
        context.addIssue({
          code: "custom",
          path: ["retry", "previousClaimId"],
          message: "Stage retry must refer to an earlier claim authority",
        });
      }
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
  previousOutputContent: z.string().min(1).max(V3_STAGE_PREVIOUS_OUTPUT_MAX_BYTES).optional(),
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
  if (Boolean(value.context.retry) !== Boolean(value.previousOutputContent)) {
    context.addIssue({
      code: "custom",
      path: ["previousOutputContent"],
      message: "Stage retry context and previous output artifact must be present together",
    });
  }
  if (value.context.retry && value.previousOutputContent) {
    const previousOutputBytes = Buffer.from(value.previousOutputContent, "utf8");
    if (previousOutputBytes.length !== value.context.retry.previousOutput.byteLength) {
      context.addIssue({
        code: "custom",
        path: ["context", "retry", "previousOutput", "byteLength"],
        message: "Previous stage output byte length differs from the exact handoff artifact",
      });
    }
    if (exactInstructionHash(value.previousOutputContent) !== value.context.retry.previousOutput.artifactHash) {
      context.addIssue({
        code: "custom",
        path: ["context", "retry", "previousOutput", "artifactHash"],
        message: "Previous stage output hash differs from the exact handoff artifact bytes",
      });
    }
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
  retrySource?: V3StageRetrySourceV1;
  outputTransport?: StageOutputTransportV1;
  toolPolicy?: AgentToolPolicyV1;
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
  const toolPolicyProfile = resolveStageToolPolicyProfile(
    input.workflow,
    envelope.workflowStepId,
    input.role,
  );
  if (!toolPolicyProfile) {
    throw new Error("V3_STAGE_TOOL_POLICY_MAPPING_MISSING");
  }
  const outputFile = path.resolve(input.outputFile);
  const outputTransport = input.outputTransport
    ? StageOutputTransportV1Schema.parse(input.outputTransport)
    : claimBoundStepCompleteStdinTransportV1();
  if (
    outputTransport.kind === "legacy-output-file"
    && outputTransport.outputFile !== outputFile
  ) {
    throw new Error("V3_STAGE_LEGACY_OUTPUT_FILE_MISMATCH");
  }
  const expectedToolPolicy = createAgentToolPolicyV1({
    profile: toolPolicyProfile,
    outputTransport,
  });
  const suppliedToolPolicy = input.toolPolicy
    ? AgentToolPolicyV1Schema.safeParse(input.toolPolicy)
    : undefined;
  if (suppliedToolPolicy && !suppliedToolPolicy.success) {
    throw new Error("V3_STAGE_TOOL_POLICY_INVALID");
  }
  if (
    suppliedToolPolicy?.success
    && suppliedToolPolicy.data.policyHash !== expectedToolPolicy.policyHash
  ) {
    throw new Error("V3_STAGE_TOOL_POLICY_MISMATCH");
  }
  const toolPolicy = suppliedToolPolicy?.success
    ? suppliedToolPolicy.data
    : expectedToolPolicy;
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
  const retrySource = input.retrySource
    ? V3StageRetrySourceV1Schema.parse(input.retrySource)
    : undefined;
  const retry = retrySource
    ? createV3StageRetryDirectiveV1({
        source: retrySource,
        currentInstructionContent: instructionContent,
        workdir,
        currentClaimId: envelope.claimId,
      })
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
    ...(retry ? { retry } : {}),
    toolPolicy,
    completion: {
      schema: "setfarm.v3-stage-completion-contract.v1" as const,
      outputFile,
      outputFileAuthority: "legacy_compatibility_only" as const,
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
    ...(retrySource ? { previousOutputContent: retrySource.previousOutput.content } : {}),
  });
}
