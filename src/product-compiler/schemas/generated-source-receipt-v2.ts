import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  ControlIdSchema,
  NormalizedRelativeLocatorSchema,
  ObservableIdSchema,
  Sha256Schema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import { GenerationTargetIdSchema } from "./design-generation-targets-v1.js";
import {
  BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  BYTE_BUNDLE_ENVELOPE_MAX_BYTES_V1,
} from "./byte-bundle-v1.js";
import {
  GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2,
  STITCH_GENERATED_SOURCE_CONTRACT_HASH_V2,
} from "./generated-source-contract-v2.js";

export const GENERATED_SOURCE_RECEIPT_VERSION_V2 = 2 as const;
export const GENERATED_SOURCE_RECEIPT_MAX_RAW_BYTES_V2 = 14 * 1024 * 1024;
export const GENERATED_SOURCE_RECEIPT_REF_PREFIX_V2 = "GSRC_" as const;
export const GENERATED_SOURCE_SEMANTIC_IDENTITY_CLOSURE_SCHEMA_V2 =
  "setfarm.generated-source-semantic-identity-closure.v2" as const;
export const GENERATED_SOURCE_RECEIPT_SET_COMMITMENT_SCHEMA_V2 =
  "setfarm.generated-source-receipt-set-commitment.v2" as const;
export const GENERATED_SOURCE_RECEIPT_ENTRY_COMMITMENT_SCHEMA_V2 =
  "setfarm.generated-source-receipt-entry-commitment.v2" as const;

const GeneratedSourceReceiptRefV2Schema = z.string()
  .regex(/^GSRC_[a-f0-9]{64}$/, "Expected a full content-derived GeneratedSourceReceiptV2 ref");

const ActionInputRefV2Schema = z.string()
  .min(3)
  .max(500)
  .superRefine((value, context) => {
    const separator = value.indexOf(".");
    if (
      separator < 0
      || !ActionIdSchema.safeParse(value.slice(0, separator)).success
      || value.slice(separator + 1).length < 1
      || value.slice(separator + 1).length > 160
    ) {
      context.addIssue({
        code: "custom",
        message: "Expected an exact ActionId.field generated-source input reference",
      });
    }
  });

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function strictlySorted(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

function canonicalIdentityArray(
  values: readonly string[],
  context: z.RefinementCtx,
  field: string,
): void {
  if (!hasUniqueStrings(values) || !strictlySorted(values)) {
    context.addIssue({
      code: "custom",
      path: [field],
      message: `${field} must be unique and strictly UTF-16 sorted`,
    });
  }
}

export const GeneratedSourceSemanticIdentityClosureV2Schema = z.object({
  schema: z.literal(GENERATED_SOURCE_SEMANTIC_IDENTITY_CLOSURE_SCHEMA_V2),
  targetRef: GenerationTargetIdSchema,
  surfaceRefs: z.array(SurfaceIdSchema).min(1).max(1_000),
  physicalControlRefs: z.array(ControlIdSchema).max(10_000),
  actionRefs: z.array(ActionIdSchema).max(10_000),
  actionInputRefs: z.array(ActionInputRefV2Schema).max(100_000),
  observableRefs: z.array(ObservableIdSchema).max(10_000),
  generatedElementBindings: z.array(z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("surface"),
      subjectRef: SurfaceIdSchema,
      elementRef: z.string().regex(/^E[0-9]{6}$/),
      elementHash: Sha256Schema,
    }).strict(),
    z.object({
      kind: z.literal("physical_control"),
      subjectRef: ControlIdSchema,
      elementRef: z.string().regex(/^E[0-9]{6}$/),
      elementHash: Sha256Schema,
    }).strict(),
  ])).min(1).max(11_000),
}).strict().superRefine((value, context) => {
  canonicalIdentityArray(value.surfaceRefs, context, "surfaceRefs");
  canonicalIdentityArray(value.physicalControlRefs, context, "physicalControlRefs");
  canonicalIdentityArray(value.actionRefs, context, "actionRefs");
  canonicalIdentityArray(value.actionInputRefs, context, "actionInputRefs");
  canonicalIdentityArray(value.observableRefs, context, "observableRefs");
  const elementKeys = value.generatedElementBindings.map((binding) =>
    `${binding.kind}\0${binding.subjectRef}`);
  canonicalIdentityArray(elementKeys, context, "generatedElementBindings");
  const expectedElementKeys = [
    ...value.surfaceRefs.map((subjectRef) => `surface\0${subjectRef}`),
    ...value.physicalControlRefs.map((subjectRef) => `physical_control\0${subjectRef}`),
  ].sort(compareUtf16);
  if (JSON.stringify(elementKeys) !== JSON.stringify(expectedElementKeys)) {
    context.addIssue({
      code: "custom",
      path: ["generatedElementBindings"],
      message: "Generated element bindings must cover every and only surface and physical-control subject ref",
    });
  }
});

export type GeneratedSourceSemanticIdentityClosureV2 = z.infer<
  typeof GeneratedSourceSemanticIdentityClosureV2Schema
>;

function semanticIdentityClosureHash(
  closure: GeneratedSourceSemanticIdentityClosureV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.generated-source-semantic-identity-closure-hash.v2",
    closure,
  });
}

export function hashGeneratedSourceSemanticIdentityClosureV2(input: unknown): string {
  return semanticIdentityClosureHash(GeneratedSourceSemanticIdentityClosureV2Schema.parse(input));
}

export const GeneratedSourceBundleArtifactRefV2Schema = z.object({
  artifactType: z.literal(BYTE_BUNDLE_ARTIFACT_TYPE_V1),
  envelopeHash: Sha256Schema,
  envelopeByteLength: z.number().int().positive().max(BYTE_BUNDLE_ENVELOPE_MAX_BYTES_V1),
  rawHash: Sha256Schema,
  rawByteLength: z.number().int().positive().max(GENERATED_SOURCE_RECEIPT_MAX_RAW_BYTES_V2),
}).strict();

export type GeneratedSourceBundleArtifactRefV2 = z.infer<
  typeof GeneratedSourceBundleArtifactRefV2Schema
>;

const GeneratedSourceReceiptEntryAuthorityV2Schema = z.object({
  targetRef: GenerationTargetIdSchema,
  responseScreenId: z.string().min(1).max(500),
  generatedSourceLocator: NormalizedRelativeLocatorSchema,
  componentApiHash: Sha256Schema,
  designSourceClosurePayloadHash: Sha256Schema,
  generatorImplementationHash: Sha256Schema,
  generatorPlatformBundleHash: Sha256Schema,
  generatorExecution: z.object({
    status: z.literal("unverified"),
    blockerCode: z.literal("SEMANTIC_SOURCE_GENERATOR_EXECUTION_UNVERIFIED"),
  }).strict(),
  generatedSourceArtifactHash: Sha256Schema,
  generatedSourceArtifactByteLength: z.number().int().positive(),
  generatedSourceByteLength: z.number().int().positive()
    .max(GENERATED_SOURCE_RECEIPT_MAX_RAW_BYTES_V2),
  generatedSourceContentHash: Sha256Schema,
  semanticIdentityClosure: GeneratedSourceSemanticIdentityClosureV2Schema,
  semanticIdentityClosureHash: Sha256Schema,
  stitchScreenIndexEntryHash: Sha256Schema,
  stitchScreenIndexPayloadHash: Sha256Schema,
  stitchScreenIndexSourceHash: Sha256Schema,
  stitchScreenIndexSourceByteLength: z.number().int().positive()
    .max(GENERATED_SOURCE_RECEIPT_MAX_RAW_BYTES_V2),
  generatedSourceBundle: GeneratedSourceBundleArtifactRefV2Schema,
}).strict().superRefine((value, context) => {
  if (value.semanticIdentityClosure.targetRef !== value.targetRef) {
    context.addIssue({
      code: "custom",
      path: ["semanticIdentityClosure", "targetRef"],
      message: "Generated-source semantic identity target must equal the receipt target",
    });
  }
  if (semanticIdentityClosureHash(value.semanticIdentityClosure) !== value.semanticIdentityClosureHash) {
    context.addIssue({
      code: "custom",
      path: ["semanticIdentityClosureHash"],
      message: "Generated-source semantic identity hash does not bind the exact closure",
    });
  }
  if (
    value.generatedSourceBundle.envelopeHash !== value.generatedSourceArtifactHash
    || value.generatedSourceBundle.envelopeByteLength !== value.generatedSourceArtifactByteLength
    || value.generatedSourceBundle.rawHash !== value.generatedSourceContentHash
    || value.generatedSourceBundle.rawByteLength !== value.generatedSourceByteLength
  ) {
    context.addIssue({
      code: "custom",
      path: ["generatedSourceBundle"],
      message: "Generated-source bundle ref must equal the exact artifact and raw-byte authority",
    });
  }
});

export type GeneratedSourceReceiptEntryAuthorityV2 = z.infer<
  typeof GeneratedSourceReceiptEntryAuthorityV2Schema
>;

function entryCommitmentHash(authority: GeneratedSourceReceiptEntryAuthorityV2): string {
  return hashCanonicalJson({
    schema: GENERATED_SOURCE_RECEIPT_ENTRY_COMMITMENT_SCHEMA_V2,
    contractHash: STITCH_GENERATED_SOURCE_CONTRACT_HASH_V2,
    authority,
  });
}

export function hashGeneratedSourceReceiptEntryCommitmentV2(input: unknown): string {
  return entryCommitmentHash(GeneratedSourceReceiptEntryAuthorityV2Schema.parse(input));
}

export function generatedSourceReceiptRefV2(entryHash: string): string {
  const parsed = Sha256Schema.parse(entryHash);
  return `${GENERATED_SOURCE_RECEIPT_REF_PREFIX_V2}${parsed}`;
}

export const GeneratedSourceReceiptSetEntryV2Schema = z.object({
  targetRef: GenerationTargetIdSchema,
  entryCommitmentHash: Sha256Schema,
}).strict();

export type GeneratedSourceReceiptSetEntryV2 = z.infer<
  typeof GeneratedSourceReceiptSetEntryV2Schema
>;

function receiptSetCommitmentHash(entries: readonly GeneratedSourceReceiptSetEntryV2[]): string {
  return hashCanonicalJson({
    schema: GENERATED_SOURCE_RECEIPT_SET_COMMITMENT_SCHEMA_V2,
    entries,
  });
}

export function hashGeneratedSourceReceiptSetCommitmentV2(input: unknown): string {
  const entries = z.array(GeneratedSourceReceiptSetEntryV2Schema).min(1).max(1_000).parse(input);
  const targetRefs = entries.map((entry) => entry.targetRef);
  const hashes = entries.map((entry) => entry.entryCommitmentHash);
  if (
    !hasUniqueStrings(targetRefs)
    || !strictlySorted(targetRefs)
    || !hasUniqueStrings(hashes)
  ) {
    throw new TypeError("Generated-source receipt-set target/hash entries must be unique and canonical");
  }
  return receiptSetCommitmentHash(entries);
}

export const GeneratedSourceReceiptSetCommitmentV2Schema = z.object({
  schema: z.literal(GENERATED_SOURCE_RECEIPT_SET_COMMITMENT_SCHEMA_V2),
  entryCount: z.number().int().min(1).max(1_000),
  entries: z.array(GeneratedSourceReceiptSetEntryV2Schema).min(1).max(1_000),
  commitmentHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const targetRefs = value.entries.map((entry) => entry.targetRef);
  const hashes = value.entries.map((entry) => entry.entryCommitmentHash);
  if (
    value.entryCount !== value.entries.length
    || !hasUniqueStrings(targetRefs)
    || !strictlySorted(targetRefs)
    || !hasUniqueStrings(hashes)
  ) {
    context.addIssue({
      code: "custom",
      path: ["entries"],
      message: "Receipt-set target/hash entries must be complete, unique, and strictly target-sorted",
    });
  }
  if (receiptSetCommitmentHash(value.entries) !== value.commitmentHash) {
    context.addIssue({
      code: "custom",
      path: ["commitmentHash"],
      message: "Receipt-set commitment does not bind its exact entry hashes",
    });
  }
});

export type GeneratedSourceReceiptSetCommitmentV2 = z.infer<
  typeof GeneratedSourceReceiptSetCommitmentV2Schema
>;

export const GeneratedSourceReceiptV2Schema = GeneratedSourceReceiptEntryAuthorityV2Schema.extend({
  schema: z.literal(GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2),
  receiptVersion: z.literal(GENERATED_SOURCE_RECEIPT_VERSION_V2),
  contractRef: z.literal("GENERATOR_STITCH_GENERATED_SOURCE_V2"),
  contractHash: z.literal(STITCH_GENERATED_SOURCE_CONTRACT_HASH_V2),
  receiptRef: GeneratedSourceReceiptRefV2Schema,
  entryCommitmentHash: Sha256Schema,
  receiptSet: GeneratedSourceReceiptSetCommitmentV2Schema,
}).strict().superRefine((value, context) => {
  const authority: GeneratedSourceReceiptEntryAuthorityV2 = {
    targetRef: value.targetRef,
    responseScreenId: value.responseScreenId,
    generatedSourceLocator: value.generatedSourceLocator,
    componentApiHash: value.componentApiHash,
    designSourceClosurePayloadHash: value.designSourceClosurePayloadHash,
    generatorImplementationHash: value.generatorImplementationHash,
    generatorPlatformBundleHash: value.generatorPlatformBundleHash,
    generatorExecution: value.generatorExecution,
    generatedSourceArtifactHash: value.generatedSourceArtifactHash,
    generatedSourceArtifactByteLength: value.generatedSourceArtifactByteLength,
    generatedSourceByteLength: value.generatedSourceByteLength,
    generatedSourceContentHash: value.generatedSourceContentHash,
    semanticIdentityClosure: value.semanticIdentityClosure,
    semanticIdentityClosureHash: value.semanticIdentityClosureHash,
    stitchScreenIndexEntryHash: value.stitchScreenIndexEntryHash,
    stitchScreenIndexPayloadHash: value.stitchScreenIndexPayloadHash,
    stitchScreenIndexSourceHash: value.stitchScreenIndexSourceHash,
    stitchScreenIndexSourceByteLength: value.stitchScreenIndexSourceByteLength,
    generatedSourceBundle: value.generatedSourceBundle,
  };
  const expectedEntryHash = entryCommitmentHash(authority);
  if (value.entryCommitmentHash !== expectedEntryHash) {
    context.addIssue({
      code: "custom",
      path: ["entryCommitmentHash"],
      message: "Generated-source receipt entry commitment does not bind its exact authority",
    });
  }
  if (value.receiptRef !== generatedSourceReceiptRefV2(expectedEntryHash)) {
    context.addIssue({
      code: "custom",
      path: ["receiptRef"],
      message: "Generated-source receipt ref must derive from its exact entry commitment",
    });
  }
  if (!value.receiptSet.entries.some((entry) =>
    entry.targetRef === value.targetRef && entry.entryCommitmentHash === expectedEntryHash)) {
    context.addIssue({
      code: "custom",
      path: ["receiptSet", "entries"],
      message: "Generated-source receipt set must bind this exact target and entry commitment",
    });
  }
});

export type GeneratedSourceReceiptV2 = z.infer<typeof GeneratedSourceReceiptV2Schema>;

export function generatedSourceReceiptEntryAuthorityV2(
  receipt: GeneratedSourceReceiptV2,
): GeneratedSourceReceiptEntryAuthorityV2 {
  return GeneratedSourceReceiptEntryAuthorityV2Schema.parse({
    targetRef: receipt.targetRef,
    responseScreenId: receipt.responseScreenId,
    generatedSourceLocator: receipt.generatedSourceLocator,
    componentApiHash: receipt.componentApiHash,
    designSourceClosurePayloadHash: receipt.designSourceClosurePayloadHash,
    generatorImplementationHash: receipt.generatorImplementationHash,
    generatorPlatformBundleHash: receipt.generatorPlatformBundleHash,
    generatorExecution: receipt.generatorExecution,
    generatedSourceArtifactHash: receipt.generatedSourceArtifactHash,
    generatedSourceArtifactByteLength: receipt.generatedSourceArtifactByteLength,
    generatedSourceByteLength: receipt.generatedSourceByteLength,
    generatedSourceContentHash: receipt.generatedSourceContentHash,
    semanticIdentityClosure: receipt.semanticIdentityClosure,
    semanticIdentityClosureHash: receipt.semanticIdentityClosureHash,
    stitchScreenIndexEntryHash: receipt.stitchScreenIndexEntryHash,
    stitchScreenIndexPayloadHash: receipt.stitchScreenIndexPayloadHash,
    stitchScreenIndexSourceHash: receipt.stitchScreenIndexSourceHash,
    stitchScreenIndexSourceByteLength: receipt.stitchScreenIndexSourceByteLength,
    generatedSourceBundle: receipt.generatedSourceBundle,
  });
}
