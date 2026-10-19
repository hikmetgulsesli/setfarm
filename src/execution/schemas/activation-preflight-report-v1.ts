import { z } from "zod";

export const PreflightCheckV1Schema = z.object({
  id: z.enum([
    "migration_shape",
    "migration_attestation",
    "database",
    "artifact_capacity",
    "activity",
    "protocol_activation",
  ]),
  status: z.enum(["pass", "fail", "advisory"]),
  blocking: z.boolean(),
  code: z.string().regex(/^[A-Z][A-Z0-9_]{2,100}$/),
  metrics: z.record(z.string(), z.number().int().nonnegative()).optional(),
}).strict();

export const ActivationPreflightReportV1Schema = z.object({
  schema: z.literal("setfarm.activation-preflight.v1"),
  status: z.enum(["pass", "fail"]),
  protocol: z.enum(["shadow", "v3"]),
  compilerReleaseSha: z.string().regex(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/),
  checks: z.array(PreflightCheckV1Schema).length(6),
}).strict();

export type ActivationPreflightReportV1 = z.infer<typeof ActivationPreflightReportV1Schema>;

