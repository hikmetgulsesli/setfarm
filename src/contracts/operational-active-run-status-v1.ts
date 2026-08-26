import { z } from "zod";

export const SetfarmOperationalActiveRunStatusV1Schema = z.enum([
  "running",
  "resuming",
  "cancelling",
  "failing",
]);

export type SetfarmOperationalActiveRunStatusV1 = z.infer<
  typeof SetfarmOperationalActiveRunStatusV1Schema
>;

export const SETFARM_OPERATIONAL_ACTIVE_RUN_STATUSES_V1 = Object.freeze([
  "running",
  "resuming",
  "cancelling",
  "failing",
] as const satisfies readonly SetfarmOperationalActiveRunStatusV1[]);

export function isSetfarmOperationalActiveRunStatusV1(
  value: unknown,
): value is SetfarmOperationalActiveRunStatusV1 {
  return SetfarmOperationalActiveRunStatusV1Schema.safeParse(value).success;
}
