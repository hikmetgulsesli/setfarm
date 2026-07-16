import path from "node:path";

import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";

export const AgentToolPolicyProfileSchema = z.enum([
  "artifact-only",
  "verification",
  "browser-verification",
  "source-scoped",
  "workspace-bootstrap",
  "repository-operator",
  "platform-operator",
  "scanner",
]);

export type AgentToolPolicyProfile = z.infer<typeof AgentToolPolicyProfileSchema>;

export const FilesystemMutationScopeSchema = z.enum([
  "none",
  "claim-source",
  "workspace-bootstrap",
  "platform-authorized",
]);

export type FilesystemMutationScope = z.infer<typeof FilesystemMutationScopeSchema>;

export const RepositoryAuthoritySchema = z.enum(["none", "read", "mutate"]);

export type RepositoryAuthority = z.infer<typeof RepositoryAuthoritySchema>;

export const AgentToolAuthorityV1Schema = z.object({
  read: z.boolean(),
  exec: z.boolean(),
  browser: z.boolean(),
  web: z.boolean(),
  repository: RepositoryAuthoritySchema,
  filesystemMutation: z.object({
    scope: FilesystemMutationScopeSchema,
    genericWrite: z.boolean(),
    edit: z.boolean(),
    applyPatch: z.boolean(),
  }).strict(),
}).strict().superRefine((value, context) => {
  const mutationEnabled = value.filesystemMutation.genericWrite
    || value.filesystemMutation.edit
    || value.filesystemMutation.applyPatch;
  if (value.filesystemMutation.scope === "none" && mutationEnabled) {
    context.addIssue({
      code: "custom",
      path: ["filesystemMutation", "scope"],
      message: "Filesystem mutation tools require an explicit non-none mutation scope",
    });
  }
  if (value.filesystemMutation.scope !== "none" && !mutationEnabled) {
    context.addIssue({
      code: "custom",
      path: ["filesystemMutation"],
      message: "A non-none mutation scope must grant at least one filesystem mutation tool",
    });
  }
});

export type AgentToolAuthorityV1 = z.infer<typeof AgentToolAuthorityV1Schema>;

const AbsolutePathSchema = z.string().min(1).max(4_000).refine(
  (value) => path.isAbsolute(value),
  "Legacy output files must use an absolute path",
).refine(
  (value) => path.normalize(value) === value,
  "Legacy output files must use a normalized absolute path",
);

export const ClaimBoundStepCompleteStdinTransportV1Schema = z.object({
  schema: z.literal("setfarm.stage-output-transport.v1"),
  kind: z.literal("claim-bound-step-complete-stdin"),
  claimBinding: z.literal("setfarm.claim-envelope.v1"),
}).strict();

export const LegacyOutputFileTransportV1Schema = z.object({
  schema: z.literal("setfarm.stage-output-transport.v1"),
  kind: z.literal("legacy-output-file"),
  outputFile: AbsolutePathSchema,
  pathAuthority: z.literal("exact-output-file"),
}).strict();

export const StageOutputTransportV1Schema = z.discriminatedUnion("kind", [
  ClaimBoundStepCompleteStdinTransportV1Schema,
  LegacyOutputFileTransportV1Schema,
]);

export type StageOutputTransportV1 = z.infer<typeof StageOutputTransportV1Schema>;

export const ArtifactSubmissionAuthorityV1Schema = z.object({
  schema: z.literal("setfarm.artifact-submission-authority.v1"),
  allowed: z.literal(true),
  transport: StageOutputTransportV1Schema,
}).strict();

export type ArtifactSubmissionAuthorityV1 = z.infer<typeof ArtifactSubmissionAuthorityV1Schema>;

const noMutation = {
  scope: "none",
  genericWrite: false,
  edit: false,
  applyPatch: false,
} as const;

const scopedMutation = (scope: Exclude<FilesystemMutationScope, "none">) => ({
  scope,
  genericWrite: true,
  edit: true,
  applyPatch: true,
} as const);

const PROFILE_TOOL_AUTHORITIES = {
  "artifact-only": {
    read: true,
    exec: true,
    browser: false,
    web: false,
    repository: "none",
    filesystemMutation: noMutation,
  },
  verification: {
    read: true,
    exec: true,
    browser: false,
    web: false,
    repository: "read",
    filesystemMutation: noMutation,
  },
  "browser-verification": {
    read: true,
    exec: true,
    browser: true,
    web: true,
    repository: "read",
    filesystemMutation: noMutation,
  },
  "source-scoped": {
    read: true,
    exec: true,
    browser: false,
    web: false,
    repository: "read",
    filesystemMutation: scopedMutation("claim-source"),
  },
  "workspace-bootstrap": {
    read: true,
    exec: true,
    browser: false,
    web: false,
    repository: "mutate",
    filesystemMutation: scopedMutation("workspace-bootstrap"),
  },
  "repository-operator": {
    read: true,
    exec: true,
    browser: false,
    web: false,
    repository: "mutate",
    filesystemMutation: noMutation,
  },
  "platform-operator": {
    read: true,
    exec: true,
    browser: false,
    web: true,
    repository: "mutate",
    filesystemMutation: scopedMutation("platform-authorized"),
  },
  scanner: {
    read: true,
    exec: true,
    browser: false,
    web: true,
    repository: "read",
    filesystemMutation: noMutation,
  },
} as const satisfies Record<AgentToolPolicyProfile, AgentToolAuthorityV1>;

const AgentToolPolicyPayloadV1Schema = z.object({
  schema: z.literal("setfarm.agent-tool-policy.v1"),
  profile: AgentToolPolicyProfileSchema,
  toolAuthority: AgentToolAuthorityV1Schema,
  artifactSubmission: ArtifactSubmissionAuthorityV1Schema,
}).strict();

type AgentToolPolicyPayloadV1 = z.infer<typeof AgentToolPolicyPayloadV1Schema>;

const AgentToolPolicyShapeV1Schema = AgentToolPolicyPayloadV1Schema.extend({
  policyHash: Sha256Schema,
}).strict();

function policyPayload(value: z.infer<typeof AgentToolPolicyShapeV1Schema>): AgentToolPolicyPayloadV1 {
  const { policyHash: _policyHash, ...payload } = value;
  return payload;
}

export const AgentToolPolicyV1Schema = AgentToolPolicyShapeV1Schema.superRefine((value, context) => {
  const expectedAuthority = PROFILE_TOOL_AUTHORITIES[value.profile];
  if (canonicalJsonStringify(value.toolAuthority) !== canonicalJsonStringify(expectedAuthority)) {
    context.addIssue({
      code: "custom",
      path: ["toolAuthority"],
      message: `Tool authority does not match the canonical ${value.profile} profile`,
    });
  }
  if (hashCanonicalJson(policyPayload(value)) !== value.policyHash) {
    context.addIssue({
      code: "custom",
      path: ["policyHash"],
      message: "Policy hash does not bind the exact canonical policy payload",
    });
  }
});

export type AgentToolPolicyV1 = z.infer<typeof AgentToolPolicyV1Schema>;

export function claimBoundStepCompleteStdinTransportV1(): StageOutputTransportV1 {
  return ClaimBoundStepCompleteStdinTransportV1Schema.parse({
    schema: "setfarm.stage-output-transport.v1",
    kind: "claim-bound-step-complete-stdin",
    claimBinding: "setfarm.claim-envelope.v1",
  });
}

export function legacyOutputFileTransportV1(outputFile: string): StageOutputTransportV1 {
  return LegacyOutputFileTransportV1Schema.parse({
    schema: "setfarm.stage-output-transport.v1",
    kind: "legacy-output-file",
    outputFile,
    pathAuthority: "exact-output-file",
  });
}

export function createAgentToolPolicyV1(input: Readonly<{
  profile: AgentToolPolicyProfile;
  outputTransport: StageOutputTransportV1;
}>): AgentToolPolicyV1 {
  const profile = AgentToolPolicyProfileSchema.parse(input.profile);
  const outputTransport = StageOutputTransportV1Schema.parse(input.outputTransport);
  const payload = AgentToolPolicyPayloadV1Schema.parse({
    schema: "setfarm.agent-tool-policy.v1",
    profile,
    toolAuthority: PROFILE_TOOL_AUTHORITIES[profile],
    artifactSubmission: {
      schema: "setfarm.artifact-submission-authority.v1",
      allowed: true,
      transport: outputTransport,
    },
  });
  return AgentToolPolicyV1Schema.parse({
    ...payload,
    policyHash: hashCanonicalJson(payload),
  });
}

export type AgentToolPolicyDenialCode =
  | "AGENT_TOOL_POLICY_INVALID"
  | "AGENT_TOOL_POLICY_ESCALATION"
  | "AGENT_TOOL_POLICY_MUTATION_SCOPE_MISMATCH"
  | "AGENT_TOOL_POLICY_OUTPUT_TRANSPORT_MISMATCH";

export type AgentToolPolicyComparison = Readonly<
  | {
      allowed: true;
      requestedPolicyHash: string;
      authorityPolicyHash: string;
    }
  | {
      allowed: false;
      code: AgentToolPolicyDenialCode;
      reasons: string[];
      requestedPolicyHash: string | null;
      authorityPolicyHash: string | null;
    }
>;

const REPOSITORY_AUTHORITY_RANK: Record<RepositoryAuthority, number> = {
  none: 0,
  read: 1,
  mutate: 2,
};

function transportMatches(
  requested: StageOutputTransportV1,
  authority: StageOutputTransportV1,
): boolean {
  if (requested.kind !== authority.kind) return false;
  if (requested.kind === "legacy-output-file" && authority.kind === "legacy-output-file") {
    return requested.outputFile === authority.outputFile;
  }
  return true;
}

export function compareAgentToolPolicies(
  requestedInput: unknown,
  authorityInput: unknown,
): AgentToolPolicyComparison {
  const requestedResult = AgentToolPolicyV1Schema.safeParse(requestedInput);
  const authorityResult = AgentToolPolicyV1Schema.safeParse(authorityInput);
  if (!requestedResult.success || !authorityResult.success) {
    const reasons = [
      ...(!requestedResult.success ? ["requested policy is invalid"] : []),
      ...(!authorityResult.success ? ["authority policy is invalid"] : []),
    ];
    return {
      allowed: false,
      code: "AGENT_TOOL_POLICY_INVALID",
      reasons,
      requestedPolicyHash: requestedResult.success ? requestedResult.data.policyHash : null,
      authorityPolicyHash: authorityResult.success ? authorityResult.data.policyHash : null,
    };
  }

  const requested = requestedResult.data;
  const authority = authorityResult.data;
  if (!transportMatches(
    requested.artifactSubmission.transport,
    authority.artifactSubmission.transport,
  )) {
    return {
      allowed: false,
      code: "AGENT_TOOL_POLICY_OUTPUT_TRANSPORT_MISMATCH",
      reasons: ["requested artifact output transport differs from the exact authority transport"],
      requestedPolicyHash: requested.policyHash,
      authorityPolicyHash: authority.policyHash,
    };
  }

  const requestedMutation = requested.toolAuthority.filesystemMutation;
  const authorityMutation = authority.toolAuthority.filesystemMutation;
  if (
    requestedMutation.scope !== "none"
    && requestedMutation.scope !== authorityMutation.scope
  ) {
    return {
      allowed: false,
      code: "AGENT_TOOL_POLICY_MUTATION_SCOPE_MISMATCH",
      reasons: [`requested mutation scope ${requestedMutation.scope} is not exactly authorized`],
      requestedPolicyHash: requested.policyHash,
      authorityPolicyHash: authority.policyHash,
    };
  }

  const escalations: string[] = [];
  for (const key of ["read", "exec", "browser", "web"] as const) {
    if (requested.toolAuthority[key] && !authority.toolAuthority[key]) {
      escalations.push(key);
    }
  }
  if (
    REPOSITORY_AUTHORITY_RANK[requested.toolAuthority.repository]
    > REPOSITORY_AUTHORITY_RANK[authority.toolAuthority.repository]
  ) {
    escalations.push(`repository:${requested.toolAuthority.repository}`);
  }
  for (const key of ["genericWrite", "edit", "applyPatch"] as const) {
    if (requestedMutation[key] && !authorityMutation[key]) {
      escalations.push(`filesystemMutation.${key}`);
    }
  }
  if (escalations.length > 0) {
    return {
      allowed: false,
      code: "AGENT_TOOL_POLICY_ESCALATION",
      reasons: escalations.map((capability) => `requested capability is not authorized: ${capability}`),
      requestedPolicyHash: requested.policyHash,
      authorityPolicyHash: authority.policyHash,
    };
  }

  return {
    allowed: true,
    requestedPolicyHash: requested.policyHash,
    authorityPolicyHash: authority.policyHash,
  };
}

export class AgentToolPolicyDeniedError extends Error {
  readonly code: AgentToolPolicyDenialCode;
  readonly comparison: Extract<AgentToolPolicyComparison, { allowed: false }>;

  constructor(comparison: Extract<AgentToolPolicyComparison, { allowed: false }>) {
    super(`${comparison.code}: ${comparison.reasons.join("; ")}`);
    this.name = "AgentToolPolicyDeniedError";
    this.code = comparison.code;
    this.comparison = comparison;
  }
}

export function requireAgentToolPolicySubset(
  requestedInput: unknown,
  authorityInput: unknown,
): AgentToolPolicyV1 {
  const comparison = compareAgentToolPolicies(requestedInput, authorityInput);
  if (!comparison.allowed) throw new AgentToolPolicyDeniedError(comparison);
  return AgentToolPolicyV1Schema.parse(requestedInput);
}
