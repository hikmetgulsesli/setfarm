import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";

const IdentitySchema = z.string().min(1).max(4_096).refine(
  (value) => value.trim() === value,
  "OPERATIONAL_EVENT_IDENTITY_NOT_CANONICAL",
);
export const OperationalEventKeyV1Schema = IdentitySchema.regex(
  /^[\x21-\x7e]+$/,
  "OPERATIONAL_EVENT_KEY_NOT_HTTP_SAFE",
);
const TimestampSchema = z.string().datetime({ offset: true });
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const VersionedSchemaIdSchema = z.string().regex(
  /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*\.v[1-9][0-9]*$/,
  "OPERATIONAL_EVENT_PAYLOAD_SCHEMA_VERSION_INVALID",
);
const PayloadSchema = z.record(z.string(), z.json()).superRefine((value, context) => {
  const parsed = VersionedSchemaIdSchema.safeParse(value.schema);
  if (!parsed.success) {
    context.addIssue({
      code: "custom",
      path: ["schema"],
      message: "OPERATIONAL_EVENT_PAYLOAD_SCHEMA_VERSION_INVALID",
    });
  }
});

export const OperationalEventIdentityV1Schema = z.object({
  schema: z.literal("setfarm.operational-event-identity.v1"),
  eventKey: OperationalEventKeyV1Schema,
  outboxId: IdentitySchema,
  requestId: IdentitySchema.nullable(),
  eventType: IdentitySchema,
  aggregateType: IdentitySchema,
  aggregateId: IdentitySchema,
  runId: IdentitySchema,
  payload: PayloadSchema,
  sourceCreatedAt: TimestampSchema,
}).strict();

export type OperationalEventIdentityV1 = z.infer<typeof OperationalEventIdentityV1Schema>;

export const CanonicalOperationalEventV1Schema = OperationalEventIdentityV1Schema.extend({
  schema: z.literal("setfarm.operational-event.v1"),
  eventHash: Sha256Schema,
  committedAt: TimestampSchema,
}).strict().superRefine((value, context) => {
  const identity: OperationalEventIdentityV1 = {
    schema: "setfarm.operational-event-identity.v1",
    eventKey: value.eventKey,
    outboxId: value.outboxId,
    requestId: value.requestId,
    eventType: value.eventType,
    aggregateType: value.aggregateType,
    aggregateId: value.aggregateId,
    runId: value.runId,
    payload: value.payload,
    sourceCreatedAt: value.sourceCreatedAt,
  };
  if (hashCanonicalJson(identity) !== value.eventHash) {
    context.addIssue({
      code: "custom",
      path: ["eventHash"],
      message: "OPERATIONAL_EVENT_HASH_MISMATCH",
    });
  }
});

export type CanonicalOperationalEventV1 = z.infer<typeof CanonicalOperationalEventV1Schema>;

export const OperationalEventDeliveryConsumerV1Schema = z.enum(["jsonl", "webhook"]);
export type OperationalEventDeliveryConsumerV1 = z.infer<
  typeof OperationalEventDeliveryConsumerV1Schema
>;

export function operationalEventRunId(input: Readonly<{
  aggregateType: string;
  aggregateId: string;
  payload: Readonly<Record<string, unknown>>;
}>): string {
  if (input.aggregateType === "run" && input.aggregateId.trim()) return input.aggregateId.trim();
  const payloadRunId = typeof input.payload.runId === "string" ? input.payload.runId.trim() : "";
  if (!payloadRunId) throw new Error("OPERATIONAL_EVENT_RUN_ID_MISSING");
  return payloadRunId;
}

export function createCanonicalOperationalEventV1(input: Readonly<{
  eventKey: string;
  outboxId: string;
  requestId?: string | null;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Readonly<Record<string, unknown>>;
  sourceCreatedAt: string;
  committedAt: string;
}>): CanonicalOperationalEventV1 {
  const identity = OperationalEventIdentityV1Schema.parse({
    schema: "setfarm.operational-event-identity.v1",
    eventKey: input.eventKey,
    outboxId: input.outboxId,
    requestId: input.requestId ?? null,
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    runId: operationalEventRunId(input),
    payload: input.payload,
    sourceCreatedAt: input.sourceCreatedAt,
  });
  return CanonicalOperationalEventV1Schema.parse({
    ...identity,
    schema: "setfarm.operational-event.v1",
    eventHash: hashCanonicalJson(identity),
    committedAt: input.committedAt,
  });
}

export function operationalEventDeliveryId(
  eventKey: string,
  consumer: OperationalEventDeliveryConsumerV1,
): string {
  const identity = Object.freeze({
    schema: "setfarm.operational-event-delivery-identity.v1",
    eventKey: OperationalEventKeyV1Schema.parse(eventKey),
    consumer: OperationalEventDeliveryConsumerV1Schema.parse(consumer),
  });
  return `OED_${hashCanonicalJson(identity)}`;
}
