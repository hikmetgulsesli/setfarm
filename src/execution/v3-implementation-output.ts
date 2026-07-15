import { createHash } from "node:crypto";

import { z } from "zod";

import type { V3ImplementationContextV1 } from "./v3-implementation-handoff.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  GitObjectHashSchema,
  NormalizedRelativeLocatorSchema,
  PathBindingIdSchema,
  Sha256Schema,
} from "../product-compiler/schemas/common-v1.js";

const V3_IMPLEMENTATION_AGENT_PROPOSAL_SCHEMA = "setfarm.v3-implementation-agent-proposal.v1" as const;
const LEGACY_V3_IMPLEMENTATION_AGENT_OUTPUT_SCHEMA = "setfarm.v3-implementation-agent-output.v1" as const;
export const V3_IMPLEMENTATION_PROPOSAL_MAX_BYTES = 512 * 1024;

const V3ImplementationOutputIdentityShape = {
  handoffHash: Sha256Schema,
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
  packetHash: Sha256Schema,
  sliceHash: Sha256Schema,
  sourceBefore: z.object({
    sha: GitObjectHashSchema,
    treeHash: GitObjectHashSchema,
  }).strict(),
};

const V3ImplementationOutputIdentityV1Schema = z.object(V3ImplementationOutputIdentityShape).strict();

const V3ImplementationChangeV1Schema = z.object({
  path: NormalizedRelativeLocatorSchema,
  summary: z.string().min(1).max(1_000),
}).strict();

const V3ImplementationReadyOutputV1Schema = V3ImplementationOutputIdentityV1Schema.extend({
  schema: z.literal(V3_IMPLEMENTATION_AGENT_PROPOSAL_SCHEMA),
  disposition: z.literal("ready_for_evidence"),
  summary: z.string().min(1).max(8_000),
  changes: z.array(V3ImplementationChangeV1Schema).max(20_000),
}).strict();

const SourceSnapshotMismatchRefusalV1Schema = z.object({
  code: z.literal("SOURCE_SNAPSHOT_MISMATCH"),
  summary: z.string().min(1).max(8_000),
  mismatchedPathRefs: z.array(PathBindingIdSchema).max(20_000).optional(),
}).strict();

const ContractScopeConflictRefusalV1Schema = z.object({
  code: z.literal("CONTRACT_SCOPE_CONFLICT"),
  summary: z.string().min(1).max(8_000),
  requiredPaths: z.array(NormalizedRelativeLocatorSchema).min(1).max(20_000),
}).strict();

const V3ImplementationRefusalOutputV1Schema = V3ImplementationOutputIdentityV1Schema.extend({
  schema: z.literal(V3_IMPLEMENTATION_AGENT_PROPOSAL_SCHEMA),
  disposition: z.literal("refused"),
  refusal: z.discriminatedUnion("code", [
    SourceSnapshotMismatchRefusalV1Schema,
    ContractScopeConflictRefusalV1Schema,
  ]),
}).strict();

/**
 * Canonical Setfarm-owned projection. The model reports only its source delta
 * or a typed refusal; command execution and every evidence verdict remain
 * platform-owned artifacts and therefore do not appear in this schema.
 */
export const V3ImplementationAgentOutputV1Schema = z.discriminatedUnion("disposition", [
  V3ImplementationReadyOutputV1Schema,
  V3ImplementationRefusalOutputV1Schema,
]);

export type V3ImplementationAgentOutputV1 = z.infer<typeof V3ImplementationAgentOutputV1Schema>;
export type V3ImplementationRefusalOutputV1 = z.infer<typeof V3ImplementationRefusalOutputV1Schema>;

const ProposalIdentityShape = {
  handoffHash: Sha256Schema,
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
  packetHash: Sha256Schema,
  sliceHash: Sha256Schema,
  sourceBefore: z.object({
    sha: GitObjectHashSchema,
    treeHash: GitObjectHashSchema,
  }).passthrough(),
};

const ProposalChangeSchema = z.object({
  path: NormalizedRelativeLocatorSchema,
  summary: z.string().min(1).max(1_000),
}).passthrough();

const ProposalSourceRefusalSchema = z.object({
  code: z.literal("SOURCE_SNAPSHOT_MISMATCH"),
  summary: z.string().min(1).max(8_000),
  mismatchedPathRefs: z.array(PathBindingIdSchema).max(20_000).optional(),
}).passthrough();

const ProposalScopeRefusalSchema = z.object({
  code: z.literal("CONTRACT_SCOPE_CONFLICT"),
  summary: z.string().min(1).max(8_000),
  requiredPaths: z.array(NormalizedRelativeLocatorSchema).min(1).max(20_000),
}).passthrough();

function readyProposalSchema(schema: typeof V3_IMPLEMENTATION_AGENT_PROPOSAL_SCHEMA | typeof LEGACY_V3_IMPLEMENTATION_AGENT_OUTPUT_SCHEMA) {
  return z.object({
    schema: z.literal(schema),
    disposition: z.literal("ready_for_evidence"),
    ...ProposalIdentityShape,
    summary: z.string().min(1).max(8_000),
    changes: z.array(ProposalChangeSchema).max(20_000),
  }).passthrough();
}

function refusalProposalSchema(schema: typeof V3_IMPLEMENTATION_AGENT_PROPOSAL_SCHEMA | typeof LEGACY_V3_IMPLEMENTATION_AGENT_OUTPUT_SCHEMA) {
  return z.object({
    schema: z.literal(schema),
    disposition: z.literal("refused"),
    ...ProposalIdentityShape,
    refusal: z.discriminatedUnion("code", [
      ProposalSourceRefusalSchema,
      ProposalScopeRefusalSchema,
    ]),
  }).passthrough();
}

/**
 * The transport proposal is deliberately open to inert annotations. Setfarm
 * never expands this schema when a provider invents prose fields: it projects
 * only the fixed semantic fields above into the strict canonical schema.
 */
const V3ImplementationAgentProposalV1Schema = z.union([
  readyProposalSchema(V3_IMPLEMENTATION_AGENT_PROPOSAL_SCHEMA),
  refusalProposalSchema(V3_IMPLEMENTATION_AGENT_PROPOSAL_SCHEMA),
  readyProposalSchema(LEGACY_V3_IMPLEMENTATION_AGENT_OUTPUT_SCHEMA),
  refusalProposalSchema(LEGACY_V3_IMPLEMENTATION_AGENT_OUTPUT_SCHEMA),
]);

export const V3ImplementationOutputCompilationV1Schema = z.object({
  schema: z.literal("setfarm.v3-implementation-output-compilation.v1"),
  sourceSchema: z.enum([
    V3_IMPLEMENTATION_AGENT_PROPOSAL_SCHEMA,
    LEGACY_V3_IMPLEMENTATION_AGENT_OUTPUT_SCHEMA,
  ]),
  sourceProposalHash: Sha256Schema,
  canonicalOutputHash: Sha256Schema,
  ignoredFieldPaths: z.array(z.string().min(1).max(2_000)).max(20_000),
  output: V3ImplementationAgentOutputV1Schema,
}).strict().superRefine((value, context) => {
  const expectedPaths = canonical(value.ignoredFieldPaths);
  if (
    expectedPaths.length !== value.ignoredFieldPaths.length
    || expectedPaths.some((path, index) => path !== value.ignoredFieldPaths[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["ignoredFieldPaths"],
      message: "Ignored proposal fields must be unique and canonical",
    });
  }
  if (
    value.ignoredFieldPaths.reduce(
      (total, path) => total + Buffer.byteLength(path, "utf8"),
      0,
    ) > 128 * 1024
  ) {
    context.addIssue({
      code: "custom",
      path: ["ignoredFieldPaths"],
      message: "Ignored proposal field paths exceed the aggregate byte capacity",
    });
  }
  const expectedOutputHash = createHash("sha256")
    .update(canonicalJsonStringify(value.output), "utf8")
    .digest("hex");
  if (value.canonicalOutputHash !== expectedOutputHash) {
    context.addIssue({
      code: "custom",
      path: ["canonicalOutputHash"],
      message: "Canonical output hash must bind the exact compiled output",
    });
  }
});

export type V3ImplementationOutputCompilationV1 = z.infer<typeof V3ImplementationOutputCompilationV1Schema>;

function canonical(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")));
}

function requireUnique(values: readonly string[], code: string): void {
  if (values.length !== new Set(values).size) {
    throw new Error(code);
  }
}

function pointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function unknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  prefix = "",
): string[] {
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) => `${prefix}/${pointerSegment(key)}`);
}

function ignoredFieldPaths(proposal: z.infer<typeof V3ImplementationAgentProposalV1Schema>): string[] {
  const common = new Set([
    "schema",
    "disposition",
    "handoffHash",
    "attemptId",
    "packetHash",
    "sliceHash",
    "sourceBefore",
  ]);
  const paths = [
    ...unknownKeys(proposal, new Set([
      ...common,
      ...(proposal.disposition === "ready_for_evidence" ? ["summary", "changes"] : ["refusal"]),
    ])),
    ...unknownKeys(proposal.sourceBefore, new Set(["sha", "treeHash"]), "/sourceBefore"),
  ];
  if (proposal.disposition === "ready_for_evidence") {
    proposal.changes.forEach((change, index) => {
      paths.push(...unknownKeys(change, new Set(["path", "summary"]), `/changes/${index}`));
    });
  } else {
    paths.push(...unknownKeys(
      proposal.refusal,
      new Set(proposal.refusal.code === "SOURCE_SNAPSHOT_MISMATCH"
        ? ["code", "summary", "mismatchedPathRefs"]
        : ["code", "summary", "requiredPaths"]),
      "/refusal",
    ));
  }
  return canonical(paths);
}

function projectProposal(
  proposal: z.infer<typeof V3ImplementationAgentProposalV1Schema>,
): V3ImplementationAgentOutputV1 {
  const identity = {
    schema: V3_IMPLEMENTATION_AGENT_PROPOSAL_SCHEMA,
    handoffHash: proposal.handoffHash,
    attemptId: proposal.attemptId,
    packetHash: proposal.packetHash,
    sliceHash: proposal.sliceHash,
    sourceBefore: {
      sha: proposal.sourceBefore.sha,
      treeHash: proposal.sourceBefore.treeHash,
    },
  };
  if (proposal.disposition === "ready_for_evidence") {
    return V3ImplementationAgentOutputV1Schema.parse({
      ...identity,
      disposition: proposal.disposition,
      summary: proposal.summary,
      changes: proposal.changes
        .map((change) => ({
          path: change.path,
          summary: change.summary,
        }))
        .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
    });
  }
  return V3ImplementationAgentOutputV1Schema.parse({
    ...identity,
    disposition: proposal.disposition,
    refusal: proposal.refusal.code === "SOURCE_SNAPSHOT_MISMATCH"
      ? {
          code: proposal.refusal.code,
          summary: proposal.refusal.summary,
          ...(proposal.refusal.mismatchedPathRefs
            ? { mismatchedPathRefs: canonical(proposal.refusal.mismatchedPathRefs) }
            : {}),
        }
      : {
          code: proposal.refusal.code,
          summary: proposal.refusal.summary,
          requiredPaths: canonical(proposal.refusal.requiredPaths),
        },
  });
}

/**
 * Compile an untrusted model proposal into the only object downstream code is
 * allowed to consume. Unknown prose is hash-visible but has zero authority.
 */
export function compileV3ImplementationTransportProposalV1(
  raw: string,
): V3ImplementationOutputCompilationV1 {
  const trimmed = raw.trim();
  const proposalBytes = Buffer.byteLength(trimmed, "utf8");
  if (proposalBytes < 2 || proposalBytes > V3_IMPLEMENTATION_PROPOSAL_MAX_BYTES) {
    throw new Error("V3_IMPLEMENTATION_OUTPUT_SIZE_INVALID");
  }
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new Error("V3_IMPLEMENTATION_OUTPUT_JSON_REQUIRED");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(trimmed);
  } catch {
    throw new Error("V3_IMPLEMENTATION_OUTPUT_JSON_INVALID");
  }
  const proposal = V3ImplementationAgentProposalV1Schema.parse(decoded);
  if (proposal.disposition === "ready_for_evidence") {
    requireUnique(
      proposal.changes.map((change) => change.path),
      "V3_IMPLEMENTATION_OUTPUT_DUPLICATE_CHANGE_PATH",
    );
  } else if (proposal.refusal.code === "SOURCE_SNAPSHOT_MISMATCH") {
    requireUnique(
      proposal.refusal.mismatchedPathRefs ?? [],
      "V3_IMPLEMENTATION_OUTPUT_DUPLICATE_PATH_REF",
    );
  } else {
    requireUnique(
      proposal.refusal.requiredPaths,
      "V3_IMPLEMENTATION_OUTPUT_DUPLICATE_REQUIRED_PATH",
    );
  }
  const output = projectProposal(proposal);
  const canonicalOutput = canonicalJsonStringify(output);
  return V3ImplementationOutputCompilationV1Schema.parse({
    schema: "setfarm.v3-implementation-output-compilation.v1",
    sourceSchema: proposal.schema,
    sourceProposalHash: createHash("sha256").update(trimmed, "utf8").digest("hex"),
    canonicalOutputHash: createHash("sha256").update(canonicalOutput, "utf8").digest("hex"),
    ignoredFieldPaths: ignoredFieldPaths(proposal),
    output,
  });
}

export function compileV3ImplementationAgentOutputV1(
  raw: string,
  context: V3ImplementationContextV1,
): V3ImplementationOutputCompilationV1 {
  const compilation = compileV3ImplementationTransportProposalV1(raw);
  const output = compilation.output;
  const handoff = context.handoff;
  if (
    output.handoffHash !== context.handoffHash
    || output.attemptId !== handoff.attemptId
    || output.packetHash !== handoff.packetHash
    || output.sliceHash !== handoff.sliceHash
    || output.sourceBefore.sha !== handoff.sourceBefore.sha
    || output.sourceBefore.treeHash !== handoff.sourceBefore.treeHash
  ) {
    throw new Error("V3_IMPLEMENTATION_OUTPUT_IDENTITY_MISMATCH");
  }

  if (output.disposition === "ready_for_evidence") {
    const allowed = new Set(context.writeAuthority.allowedPaths);
    const paths = output.changes.map((change) => change.path);
    if (paths.some((path) => !allowed.has(path))) {
      throw new Error("V3_IMPLEMENTATION_OUTPUT_CHANGE_OUTSIDE_AUTHORITY");
    }
  } else if (output.refusal.code === "SOURCE_SNAPSHOT_MISMATCH") {
    const refs = output.refusal.mismatchedPathRefs ?? [];
    const declaredRefs = new Set(handoff.implementationSlice.files.map((file) => file.pathRef));
    if (refs.some((pathRef) => !declaredRefs.has(pathRef))) {
      throw new Error("V3_IMPLEMENTATION_OUTPUT_PATH_REF_NOT_IN_SLICE");
    }
  } else {
    const allowed = new Set(context.writeAuthority.allowedPaths);
    if (output.refusal.requiredPaths.some((path) => allowed.has(path))) {
      throw new Error("V3_IMPLEMENTATION_SCOPE_CONFLICT_PATH_ALREADY_ALLOWED");
    }
  }

  return compilation;
}

/** Compatibility parser for existing completion consumers. */
export function parseV3ImplementationAgentOutputV1(
  raw: string,
  context: V3ImplementationContextV1,
): V3ImplementationAgentOutputV1 {
  return compileV3ImplementationAgentOutputV1(raw, context).output;
}

// Zod attaches a non-enumerable Standard Schema marker to generated objects;
// JSON round-tripping yields the exact portable artifact handed to the model.
const implementationProposalJsonSchema = JSON.parse(JSON.stringify(z.toJSONSchema(
  V3ImplementationAgentOutputV1Schema,
  { io: "input" },
))) as Record<string, unknown>;

/**
 * Machine-readable target handed to the model. Runtime authority is still the
 * compiler above: providers may add annotations, but those fields are removed
 * generically and can never become operational inputs.
 */
export const V3_IMPLEMENTATION_OUTPUT_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.v3-implementation-output-contract.v2" as const,
  source: V3_IMPLEMENTATION_AGENT_PROPOSAL_SCHEMA,
  format: [
    "Return exactly one JSON object and no markdown/prose outside it.",
    `Success: {\"schema\":\"${V3_IMPLEMENTATION_AGENT_PROPOSAL_SCHEMA}\",\"disposition\":\"ready_for_evidence\",\"handoffHash\":\"<copy>\",\"attemptId\":\"<copy>\",\"packetHash\":\"<copy>\",\"sliceHash\":\"<copy>\",\"sourceBefore\":{\"sha\":\"<copy>\",\"treeHash\":\"<copy>\"},\"summary\":\"...\",\"changes\":[{\"path\":\"...\",\"summary\":\"...\"}]}`,
    "Source refusal: same identity plus {\"disposition\":\"refused\",\"refusal\":{\"code\":\"SOURCE_SNAPSHOT_MISMATCH\",\"summary\":\"...\",\"mismatchedPathRefs\":[\"PATH_...\"]}}",
    "Scope refusal: same identity plus {\"disposition\":\"refused\",\"refusal\":{\"code\":\"CONTRACT_SCOPE_CONFLICT\",\"summary\":\"...\",\"requiredPaths\":[\"normalized/required/path\"]}}",
  ].join("\n"),
  jsonSchema: implementationProposalJsonSchema,
  jsonSchemaHash: hashCanonicalJson(implementationProposalJsonSchema),
  requiredFields: [
    "schema",
    "disposition",
    "handoffHash",
    "attemptId",
    "packetHash",
    "sliceHash",
    "sourceBefore",
  ],
  instruction: "Copy immutable identity from the context. Report only the bounded source delta or one typed refusal. Never report command outcomes or evidence verdicts; Setfarm executes and owns them. Never emit STATUS, PR_URL, STACK_PACK_ID, or arbitrary KEY:value context.",
});
