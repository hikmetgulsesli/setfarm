import { z } from "zod";

import type { V3ImplementationContextV1 } from "./v3-implementation-handoff.js";
import {
  CommandIdSchema,
  GitObjectHashSchema,
  NormalizedRelativeLocatorSchema,
  PathBindingIdSchema,
  Sha256Schema,
} from "../product-compiler/schemas/common-v1.js";

const V3ImplementationOutputIdentityV1Schema = z.object({
  handoffHash: Sha256Schema,
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
  packetHash: Sha256Schema,
  sliceHash: Sha256Schema,
  sourceBefore: z.object({
    sha: GitObjectHashSchema,
    treeHash: GitObjectHashSchema,
  }).strict(),
}).strict();

const V3ImplementationReadyOutputV1Schema = V3ImplementationOutputIdentityV1Schema.extend({
  schema: z.literal("setfarm.v3-implementation-agent-output.v1"),
  disposition: z.literal("ready_for_evidence"),
  summary: z.string().min(1).max(8_000),
  changes: z.array(z.object({
    path: NormalizedRelativeLocatorSchema,
    summary: z.string().min(1).max(1_000),
  }).strict()).max(20_000),
  commands: z.array(z.object({
    commandId: CommandIdSchema,
    outcome: z.enum(["passed", "failed", "not_run"]),
  }).strict()).max(1_000),
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
  schema: z.literal("setfarm.v3-implementation-agent-output.v1"),
  disposition: z.literal("refused"),
  refusal: z.discriminatedUnion("code", [
    SourceSnapshotMismatchRefusalV1Schema,
    ContractScopeConflictRefusalV1Schema,
  ]),
}).strict();

export const V3ImplementationAgentOutputV1Schema = z.discriminatedUnion("disposition", [
  V3ImplementationReadyOutputV1Schema,
  V3ImplementationRefusalOutputV1Schema,
]);

export type V3ImplementationAgentOutputV1 = z.infer<typeof V3ImplementationAgentOutputV1Schema>;
export type V3ImplementationRefusalOutputV1 = z.infer<typeof V3ImplementationRefusalOutputV1Schema>;

function canonical(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function requireCanonical(values: readonly string[], code: string): void {
  const expected = canonical(values);
  if (values.length !== expected.length || values.some((value, index) => value !== expected[index])) {
    throw new Error(code);
  }
}

/**
 * Parse the native v3 protocol before any legacy KEY:value/prose processing.
 * Agent prose is data inside bounded summary fields; it is never an authority.
 */
export function parseV3ImplementationAgentOutputV1(
  raw: string,
  context: V3ImplementationContextV1,
): V3ImplementationAgentOutputV1 {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new Error("V3_IMPLEMENTATION_OUTPUT_JSON_REQUIRED");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(trimmed);
  } catch {
    throw new Error("V3_IMPLEMENTATION_OUTPUT_JSON_INVALID");
  }
  const output = V3ImplementationAgentOutputV1Schema.parse(decoded);
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
    requireCanonical(paths, "V3_IMPLEMENTATION_OUTPUT_CHANGE_PATHS_NOT_CANONICAL");
    if (paths.some((path) => !allowed.has(path))) {
      throw new Error("V3_IMPLEMENTATION_OUTPUT_CHANGE_OUTSIDE_AUTHORITY");
    }
    const commandIds = output.commands.map((command) => command.commandId);
    requireCanonical(commandIds, "V3_IMPLEMENTATION_OUTPUT_COMMANDS_NOT_CANONICAL");
    const declaredCommands = new Set(handoff.implementationSlice.commands.map((command) => command.id));
    if (commandIds.some((commandId) => !declaredCommands.has(commandId))) {
      throw new Error("V3_IMPLEMENTATION_OUTPUT_COMMAND_NOT_IN_SLICE");
    }
    return output;
  }

  if (output.refusal.code === "SOURCE_SNAPSHOT_MISMATCH") {
    const refs = output.refusal.mismatchedPathRefs ?? [];
    requireCanonical(refs, "V3_IMPLEMENTATION_OUTPUT_PATH_REFS_NOT_CANONICAL");
    const declaredRefs = new Set(handoff.implementationSlice.files.map((file) => file.pathRef));
    if (refs.some((pathRef) => !declaredRefs.has(pathRef))) {
      throw new Error("V3_IMPLEMENTATION_OUTPUT_PATH_REF_NOT_IN_SLICE");
    }
    return output;
  }

  requireCanonical(output.refusal.requiredPaths, "V3_IMPLEMENTATION_OUTPUT_REQUIRED_PATHS_NOT_CANONICAL");
  const allowed = new Set(context.writeAuthority.allowedPaths);
  if (output.refusal.requiredPaths.some((path) => allowed.has(path))) {
    throw new Error("V3_IMPLEMENTATION_SCOPE_CONFLICT_PATH_ALREADY_ALLOWED");
  }
  return output;
}

/**
 * Prompt rendering metadata only. Runtime acceptance is the strict schema and
 * handoff-bound parser above, never string matching against this example.
 */
export const V3_IMPLEMENTATION_OUTPUT_CONTRACT_V1 = Object.freeze({
  source: "setfarm.v3-implementation-agent-output.v1",
  format: [
    "Return exactly one JSON object and no markdown/prose outside it.",
    "Success: {\"schema\":\"setfarm.v3-implementation-agent-output.v1\",\"disposition\":\"ready_for_evidence\",\"handoffHash\":\"<copy>\",\"attemptId\":\"<copy>\",\"packetHash\":\"<copy>\",\"sliceHash\":\"<copy>\",\"sourceBefore\":{\"sha\":\"<copy>\",\"treeHash\":\"<copy>\"},\"summary\":\"...\",\"changes\":[{\"path\":\"...\",\"summary\":\"...\"}],\"commands\":[{\"commandId\":\"CMD_...\",\"outcome\":\"passed|failed|not_run\"}]}",
    "Source refusal: same identity plus {\"disposition\":\"refused\",\"refusal\":{\"code\":\"SOURCE_SNAPSHOT_MISMATCH\",\"summary\":\"...\",\"mismatchedPathRefs\":[\"PATH_...\"]}}",
    "Scope refusal: same identity plus {\"disposition\":\"refused\",\"refusal\":{\"code\":\"CONTRACT_SCOPE_CONFLICT\",\"summary\":\"...\",\"requiredPaths\":[\"normalized/required/path\"]}}",
  ].join("\n"),
  requiredFields: [
    "schema",
    "disposition",
    "handoffHash",
    "attemptId",
    "packetHash",
    "sliceHash",
    "sourceBefore",
  ],
  instruction: "Copy immutable identity from the context. Return ready_for_evidence or one typed refusal. Never emit STATUS, PR_URL, STACK_PACK_ID, evidence verdicts, or arbitrary KEY:value context.",
});
