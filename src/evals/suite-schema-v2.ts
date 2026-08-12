import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  ConvergenceExecutionProfileV1Schema,
  ConvergenceProductClassV1Schema,
  ProductConvergenceSuiteV1Schema,
  type ProductConvergenceSuiteV1,
} from "./suite-schema.js";
import {
  TaskIntentOracleV2Schema,
  projectTaskIntentOracleV2ToV1,
} from "./task-intent-oracle-v2.js";

const SlugSchema = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const PRIVATE_OR_SECRET = /(?:\/Users\/|\/home\/|[A-Za-z]:\\|(?:password|secret|token|api[_-]?key)\s*[:=]|\bsk-[A-Za-z0-9_-]{8,}|postgres(?:ql)?:\/\/[^\s/@]+:[^\s/@]+@)/i;

const SafeTaskSchema = z.string()
  .min(40)
  .max(8_000)
  .refine((value) => !PRIVATE_OR_SECRET.test(value), "Eval tasks must not contain credentials or absolute host paths")
  .refine((value) => !/(?:^|\s)--(?:repo|branch|port)(?:\s|=)/i.test(value), {
    message: "Clean convergence cases must not bind an existing repo, branch, or port",
  });

export const ConvergenceCaseV2Schema = z.object({
  caseId: SlugSchema,
  productClass: ConvergenceProductClassV1Schema,
  task: SafeTaskSchema,
  oracle: TaskIntentOracleV2Schema,
  executionProfile: ConvergenceExecutionProfileV1Schema,
}).strict();

const ProductConvergenceSuiteV2BaseSchema = z.object({
  schema: z.literal("setfarm.product-convergence-suite.v2"),
  suiteId: SlugSchema,
  suiteVersion: z.literal(2),
  workflowId: SlugSchema,
  protocol: z.literal("v3"),
  repetitionsPerCase: z.number().int().min(1).max(2),
  rootCauseRepeatLimit: z.literal(3),
  timeout: z.object({
    runMs: z.number().int().min(60_000).max(43_200_000),
    pollMs: z.number().int().min(1_000).max(60_000),
  }).strict(),
  cases: z.array(ConvergenceCaseV2Schema).length(8),
}).strict();

export const ProductConvergenceSuiteV2Schema = ProductConvergenceSuiteV2BaseSchema.superRefine((value, context) => {
  const projected = ProductConvergenceSuiteV1Schema.safeParse({
    ...value,
    schema: "setfarm.product-convergence-suite.v1",
    suiteVersion: 1,
    cases: value.cases.map((item) => ({
      ...item,
      oracle: projectTaskIntentOracleV2ToV1(item.oracle),
    })),
  });
  if (!projected.success) {
    projected.error.issues.forEach((issue) => context.addIssue({
      code: "custom",
      path: issue.path,
      message: `V1-compatible suite contract failed: ${issue.message}`,
    }));
  }
});

export type ProductConvergenceSuiteV2 = z.infer<typeof ProductConvergenceSuiteV2Schema>;
export type ConvergenceCaseV2 = z.infer<typeof ConvergenceCaseV2Schema>;
export type ProductConvergenceSuiteVersioned = ProductConvergenceSuiteV1 | ProductConvergenceSuiteV2;

export type LoadedConvergenceSuiteV2 = Readonly<{
  suite: ProductConvergenceSuiteV2;
  suiteHash: string;
}>;

export type LoadedConvergenceSuiteVersioned = Readonly<{
  suite: ProductConvergenceSuiteVersioned;
  suiteHash: string;
}>;

async function readSuiteFile(file: string): Promise<unknown> {
  const absolute = path.resolve(file);
  const info = await lstat(absolute);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("EVAL_SUITE_FILE_NOT_REGULAR");
  const canonical = await realpath(absolute);
  return JSON.parse(await readFile(canonical, "utf8"));
}

export async function loadConvergenceSuiteV2(file: string): Promise<LoadedConvergenceSuiteV2> {
  const suite = ProductConvergenceSuiteV2Schema.parse(await readSuiteFile(file));
  return Object.freeze({ suite, suiteHash: hashCanonicalJson(suite) });
}

export async function loadConvergenceSuiteVersioned(file: string): Promise<LoadedConvergenceSuiteVersioned> {
  const raw = await readSuiteFile(file);
  const suite = raw && typeof raw === "object" && (raw as { schema?: unknown }).schema === "setfarm.product-convergence-suite.v1"
    ? ProductConvergenceSuiteV1Schema.parse(raw)
    : ProductConvergenceSuiteV2Schema.parse(raw);
  return Object.freeze({ suite, suiteHash: hashCanonicalJson(suite) });
}

export function convergenceCaseHashV2(value: ConvergenceCaseV2): string {
  return hashCanonicalJson(ConvergenceCaseV2Schema.parse(value));
}
