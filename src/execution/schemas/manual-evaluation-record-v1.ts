import { z } from "zod";
import { ObservedControlWorkerOwnerV1Schema } from "./manual-control-worker-channel-v1.js";

// Preserve the original schemas and their JSON.stringify field order.
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const ManualAcquireV1Schema = z.object({ jobId: z.string().uuid().refine(value => value === value.toLowerCase()), kind: z.enum(["activation_preflight", "convergence_full8"]),
  selectionHash: Hash, sourceSha: z.string().regex(/^[a-f0-9]{40}$/), suiteHash: Hash.nullable() }).strict();
export const ManualReservationV1Schema = ManualAcquireV1Schema.extend({ revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  phase: z.enum(["pending", "active", "cancelling", "ownership_unknown", "released"]) }).strict();
export type ManualReservationV1 = z.infer<typeof ManualReservationV1Schema>;
export const ManualSlotV1Schema = z.object({ admissionHash: Hash, slotHash: Hash, caseHash: Hash, taskHash: Hash, repetition: z.literal(1) }).strict();
export type ManualSlotV1 = z.infer<typeof ManualSlotV1Schema>;
export const ManualOwnerV1Schema = ObservedControlWorkerOwnerV1Schema;
export const ManualClosureV1Schema = ManualAcquireV1Schema.extend({ schema: z.literal("setfarm.manual-control-custody-closed.v1"),
  executionMode: z.enum(["preflight", "execute"]), intentOrigin: z.enum(["mission_control", "direct"]),
  intentHash: Hash, nonceDigest: Hash, owner: ManualOwnerV1Schema,
  closure: z.discriminatedUnion("kind", [z.object({ kind: z.literal("never_reserved") }).strict(),
    z.object({ kind: z.literal("reservation_released"), revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), recordHash: Hash }).strict()]),
}).strict().superRefine((value, context) => {
  if ((value.kind === "convergence_full8") !== (value.suiteHash !== null)
    || (value.kind === "activation_preflight" && (value.executionMode !== "preflight" || value.intentOrigin !== "mission_control"))) {
    context.addIssue({ code: "custom", message: "Closure recipe identity mismatch" });
  }
});
export type ManualClosureV1 = z.infer<typeof ManualClosureV1Schema>;
export type ManualOwnerV1 = z.infer<typeof ManualOwnerV1Schema>;
export const ManualRecordV1Schema = z.object({ schema: z.literal("setfarm.manual-evaluation-record.v1"), reservation: ManualReservationV1Schema,
  owner: ManualOwnerV1Schema, intentHash: Hash, nonceDigest: Hash, admissionHash: Hash.nullable(), slots: z.array(ManualSlotV1Schema).max(8),
  executionMode: z.enum(["preflight", "execute"]) }).strict();
export type ManualRecordV1 = z.infer<typeof ManualRecordV1Schema>;
export type ManualAcquireV1 = z.infer<typeof ManualAcquireV1Schema>;
