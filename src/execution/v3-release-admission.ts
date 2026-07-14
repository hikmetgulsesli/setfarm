import { createHash, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  GitObjectHashSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "../product-compiler/schemas/common-v1.js";

const TimestampSchema = z.string().datetime({ offset: true }).refine(
  (value) => new Date(value).toISOString() === value,
  { message: "Timestamp must use canonical millisecond UTC form" },
);
const ArtifactRefSchema = z.string().regex(/^sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.json$/);

export const V3ReleaseAdmissionKindSchema = z.enum([
  "convergence_canary",
  "release_go",
]);

export type V3ReleaseAdmissionKind = z.infer<typeof V3ReleaseAdmissionKindSchema>;

const CanarySlotPayloadV1Schema = z.object({
  slotHash: Sha256Schema,
  caseHash: Sha256Schema,
  taskHash: Sha256Schema,
  repetition: z.number().int().min(1).max(2),
  selectorHash: Sha256Schema,
}).strict();

export type V3CanarySlotPayloadV1 = z.infer<typeof CanarySlotPayloadV1Schema>;

const NullableArtifactBindingV1Schema = z.object({
  hash: z.null(),
  ref: z.null(),
}).strict();

const ArtifactBindingV1Schema = z.object({
  hash: Sha256Schema,
  ref: ArtifactRefSchema,
}).strict().superRefine((value, context) => {
  if (value.ref !== convergenceArtifactRef(value.hash)) {
    context.addIssue({
      code: "custom",
      path: ["ref"],
      message: "Convergence artifact ref must be derived from its exact hash",
    });
  }
});

const CanaryAdmissionPayloadV1ObjectSchema = z.object({
  schema: z.literal("setfarm.v3-release-admission.v1"),
  kind: z.literal("convergence_canary"),
  releaseSha: GitObjectHashSchema,
  suiteHash: Sha256Schema,
  result: NullableArtifactBindingV1Schema,
  gate: NullableArtifactBindingV1Schema,
  preflightHash: Sha256Schema,
  slots: z.array(CanarySlotPayloadV1Schema).min(1).max(16),
  issuedAt: TimestampSchema,
  expiresAt: TimestampSchema,
}).strict();

function refineCanaryAdmission(
  value: z.infer<typeof CanaryAdmissionPayloadV1ObjectSchema>,
  context: z.RefinementCtx,
): void {
  if (new Date(value.expiresAt).getTime() <= new Date(value.issuedAt).getTime()) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Canary expiry must follow issue time" });
  }
  if (!hasUniqueStrings(value.slots.map((slot) => slot.slotHash))) {
    context.addIssue({ code: "custom", path: ["slots"], message: "Canary slot hashes must be unique" });
  }
  if (!hasUniqueStrings(value.slots.map((slot) => exactCanarySlotKey(slot)))) {
    context.addIssue({ code: "custom", path: ["slots"], message: "Canary exact slots must be unique" });
  }
  if (!hasUniqueStrings(value.slots.map((slot) => slot.selectorHash))) {
    context.addIssue({ code: "custom", path: ["slots"], message: "Canary selector hashes must be unique" });
  }
}

const ReleaseGoAdmissionPayloadV1ObjectSchema = z.object({
  schema: z.literal("setfarm.v3-release-admission.v1"),
  kind: z.literal("release_go"),
  releaseSha: GitObjectHashSchema,
  suiteHash: Sha256Schema,
  result: ArtifactBindingV1Schema,
  gate: ArtifactBindingV1Schema,
  preflightHash: Sha256Schema,
  slots: z.array(z.never()).length(0),
  issuedAt: TimestampSchema,
  expiresAt: z.null(),
}).strict();

export const V3ReleaseAdmissionPayloadV1Schema = z.discriminatedUnion("kind", [
  CanaryAdmissionPayloadV1ObjectSchema,
  ReleaseGoAdmissionPayloadV1ObjectSchema,
]).superRefine((value, context) => {
  if (value.kind === "convergence_canary") refineCanaryAdmission(value, context);
});

export type V3ReleaseAdmissionPayloadV1 = z.infer<typeof V3ReleaseAdmissionPayloadV1Schema>;

export const V3ReleaseAdmissionV1Schema = z.discriminatedUnion("kind", [
  CanaryAdmissionPayloadV1ObjectSchema.extend({ admissionHash: Sha256Schema }).strict(),
  ReleaseGoAdmissionPayloadV1ObjectSchema.extend({ admissionHash: Sha256Schema }).strict(),
]).superRefine((value, context) => {
  const { admissionHash, ...payload } = value;
  const parsedPayload = V3ReleaseAdmissionPayloadV1Schema.safeParse(payload);
  if (!parsedPayload.success) {
    context.addIssue({ code: "custom", message: "Release admission payload invalid" });
    return;
  }
  if (admissionHash !== hashCanonicalJson(payload)) {
    context.addIssue({ code: "custom", path: ["admissionHash"], message: "Release admission hash mismatch" });
  }
});

export type V3ReleaseAdmissionV1 = z.infer<typeof V3ReleaseAdmissionV1Schema>;

const InternalCanaryAdmissionContextV1Schema = z.object({
  schema: z.literal("setfarm.internal-convergence-admission.v1"),
  admissionHash: Sha256Schema,
  slotHash: Sha256Schema,
  caseHash: Sha256Schema,
  taskHash: Sha256Schema,
  repetition: z.number().int().min(1).max(2),
  slotToken: z.string().min(32).max(512).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

export type InternalCanaryAdmissionContextV1 = z.infer<
  typeof InternalCanaryAdmissionContextV1Schema
>;

export const INTERNAL_CANARY_ADMISSION_ENV = "SETFARM_INTERNAL_CONVERGENCE_ADMISSION";

export function convergenceArtifactRef(hashValue: string): string {
  const hash = Sha256Schema.parse(hashValue);
  return `sha256/${hash.slice(0, 2)}/${hash}.json`;
}

export function canarySelectorHash(token: string): string {
  const parsed = InternalCanaryAdmissionContextV1Schema.shape.slotToken.parse(token);
  return createHash("sha256").update(parsed, "utf8").digest("hex");
}

export function exactCanarySlotKey(
  value: Readonly<{ caseHash: string; taskHash: string; repetition: number }>,
): string {
  return `${value.caseHash}:${value.taskHash}:${value.repetition}`;
}

export function computeCanarySlotHash(input: Readonly<{
  releaseSha: string;
  suiteHash: string;
  caseHash: string;
  taskHash: string;
  repetition: number;
  selectorHash: string;
}>): string {
  return hashCanonicalJson({
    schema: "setfarm.v3-canary-admission-slot.v1",
    releaseSha: GitObjectHashSchema.parse(input.releaseSha),
    suiteHash: Sha256Schema.parse(input.suiteHash),
    caseHash: Sha256Schema.parse(input.caseHash),
    taskHash: Sha256Schema.parse(input.taskHash),
    repetition: z.number().int().min(1).max(2).parse(input.repetition),
    selectorHash: Sha256Schema.parse(input.selectorHash),
  });
}

export function createV3ReleaseAdmissionV1(
  input: V3ReleaseAdmissionPayloadV1,
): V3ReleaseAdmissionV1 {
  const payload = V3ReleaseAdmissionPayloadV1Schema.parse(input);
  return V3ReleaseAdmissionV1Schema.parse({
    ...payload,
    admissionHash: hashCanonicalJson(payload),
  });
}

export function parseInternalCanaryAdmissionContext(
  value: string | undefined,
): InternalCanaryAdmissionContextV1 | null {
  if (value === undefined) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("V3_INTERNAL_CANARY_CONTEXT_INVALID");
  }
  const result = InternalCanaryAdmissionContextV1Schema.safeParse(parsed);
  if (!result.success) throw new Error("V3_INTERNAL_CANARY_CONTEXT_INVALID");
  return Object.freeze(result.data);
}

export function serializeInternalCanaryAdmissionContext(
  value: InternalCanaryAdmissionContextV1,
): string {
  return JSON.stringify(InternalCanaryAdmissionContextV1Schema.parse(value));
}

export function selectorHashesEqual(left: string, right: string): boolean {
  const first = Buffer.from(Sha256Schema.parse(left), "hex");
  const second = Buffer.from(Sha256Schema.parse(right), "hex");
  return timingSafeEqual(first, second);
}
