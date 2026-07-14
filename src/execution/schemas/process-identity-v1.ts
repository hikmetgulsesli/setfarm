import { z } from "zod";

export const ProcessIdentityV1Schema = z.object({
  schema: z.literal("setfarm.process-identity.v1"),
  pid: z.number().int().positive(),
  processStartedAt: z.string().datetime({ offset: true }),
  processGroupId: z.number().int().positive().optional(),
  source: z.enum(["observed_os", "tracked_child", "legacy-backfill"]),
}).strict();

export type ProcessIdentityV1 = z.infer<typeof ProcessIdentityV1Schema>;

export function sameProcessIdentity(
  expected: ProcessIdentityV1,
  observed: ProcessIdentityV1,
): boolean {
  if (expected.pid !== observed.pid) return false;
  if (
    expected.processGroupId !== undefined
    && observed.processGroupId !== undefined
    && expected.processGroupId !== observed.processGroupId
  ) return false;
  return Math.abs(
    new Date(expected.processStartedAt).getTime() - new Date(observed.processStartedAt).getTime(),
  ) <= 1_000;
}
