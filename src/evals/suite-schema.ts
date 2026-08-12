import { readFile, lstat, realpath } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { hasUniqueStrings } from "../product-compiler/schemas/common-v1.js";
import {
  TaskIntentOracleV1Schema,
  evaluateTaskIntentOracleTaskBindingV1,
} from "./task-intent-oracle.js";

const SlugSchema = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const IdentifierSchema = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/);

const PRIVATE_OR_SECRET = /(?:\/Users\/|\/home\/|[A-Za-z]:\\|(?:password|secret|token|api[_-]?key)\s*[:=]|\bsk-[A-Za-z0-9_-]{8,}|postgres(?:ql)?:\/\/[^\s/@]+:[^\s/@]+@)/i;

function containsNoPrivateHostOrSecret(value: string): boolean {
  return !PRIVATE_OR_SECRET.test(value);
}

const SafeTaskSchema = z.string()
  .min(40)
  .max(8_000)
  .refine(containsNoPrivateHostOrSecret, "Eval tasks must not contain credentials or absolute host paths")
  .refine((value) => !/(?:^|\s)--(?:repo|branch|port)(?:\s|=)/i.test(value), {
    message: "Clean convergence cases must not bind an existing repo, branch, or port",
  });

export const ConvergenceProductClassV1Schema = z.enum(["utility", "operations", "game", "negative"]);
export const ConvergenceRuntimeAdapterV1Schema = z.literal("browser");
export const ConvergenceStackPackV1Schema = z.enum([
  "vite-react-web-app",
  "browser-game-canvas",
]);

export const ConvergenceExecutionProfileV1Schema = z.object({
  providerId: IdentifierSchema,
  modelId: IdentifierSchema,
}).strict();

export const ConvergenceCaseV1Schema = z.object({
  caseId: SlugSchema,
  productClass: ConvergenceProductClassV1Schema,
  task: SafeTaskSchema,
  oracle: TaskIntentOracleV1Schema,
  executionProfile: ConvergenceExecutionProfileV1Schema,
}).strict().superRefine((value, context) => {
  const expectedDecision = value.oracle.expectedDecision;
  if (value.productClass === "negative") {
    if (expectedDecision.kind !== "typed_rejection") {
      context.addIssue({ code: "custom", path: ["oracle", "expectedDecision"], message: "Negative cases require typed rejection" });
    }
  } else if (expectedDecision.kind !== "accepted_candidate") {
    context.addIssue({ code: "custom", path: ["oracle", "expectedDecision"], message: "Positive cases require AcceptedCandidate" });
  } else {
    const required = {
      utility: { stackPackId: "vite-react-web-app", runtimeAdapter: "browser" },
      operations: { stackPackId: "vite-react-web-app", runtimeAdapter: "browser" },
      game: { stackPackId: "browser-game-canvas", runtimeAdapter: "browser" },
    } as const;
    const expected = required[value.productClass];
    if (expectedDecision.productClass !== value.productClass
      || expectedDecision.stackPackId !== expected.stackPackId
      || expectedDecision.runtimeAdapter !== expected.runtimeAdapter) {
      context.addIssue({
        code: "custom",
        path: ["oracle", "expectedDecision"],
        message: `${value.productClass} oracle must exercise ${expected.stackPackId}/${expected.runtimeAdapter}`,
      });
    }
  }
  const binding = evaluateTaskIntentOracleTaskBindingV1(value.task, value.oracle);
  if (binding.mismatchCodes.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["oracle", "clauses"],
      message: `Oracle/task binding failed: ${binding.mismatchCodes.join(",")}`,
    });
  }
});

export const ProductConvergenceSuiteV1Schema = z.object({
  schema: z.literal("setfarm.product-convergence-suite.v1"),
  suiteId: SlugSchema,
  suiteVersion: z.literal(1),
  workflowId: SlugSchema,
  protocol: z.literal("v3"),
  repetitionsPerCase: z.number().int().min(1).max(2),
  rootCauseRepeatLimit: z.literal(3),
  timeout: z.object({
    runMs: z.number().int().min(60_000).max(43_200_000),
    pollMs: z.number().int().min(1_000).max(60_000),
  }).strict(),
  cases: z.array(ConvergenceCaseV1Schema).length(8),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.cases.map((item) => item.caseId))) {
    context.addIssue({ code: "custom", path: ["cases"], message: "Convergence case IDs must be unique" });
  }
  const positiveClasses = ["utility", "operations", "game"] as const;
  for (const productClass of positiveClasses) {
    const cases = value.cases.filter((item) => item.productClass === productClass);
    if (cases.length !== 2
      || cases.filter((item) => item.oracle.cohort === "baseline").length !== 1
      || cases.filter((item) => item.oracle.cohort === "holdout").length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["cases"],
        message: `Suite must contain one baseline and one holdout ${productClass} case`,
      });
    }
  }
  const negatives = value.cases.filter((item) => item.productClass === "negative");
  if (negatives.length !== 2
    || !negatives.some((item) => item.oracle.variant === "ambiguous")
    || !negatives.some((item) => item.oracle.variant === "unsupported")) {
    context.addIssue({ code: "custom", path: ["cases"], message: "Suite requires ambiguity and unsupported negative controls" });
  }
  const holdouts = value.cases.filter((item) => item.oracle.cohort === "holdout");
  if (!holdouts.some((item) => item.oracle.variant === "paraphrase")
    || !holdouts.some((item) => item.oracle.variant === "compositional")) {
    context.addIssue({ code: "custom", path: ["cases"], message: "Holdouts require paraphrase and compositional variants" });
  }
  if (!hasUniqueStrings(value.cases.map((item) => hashCanonicalJson(item.task)))) {
    context.addIssue({ code: "custom", path: ["cases"], message: "Convergence tasks must be distinct" });
  }
});

export type ProductConvergenceSuiteV1 = z.infer<typeof ProductConvergenceSuiteV1Schema>;
export type ConvergenceCaseV1 = z.infer<typeof ConvergenceCaseV1Schema>;

export type LoadedConvergenceSuiteV1 = Readonly<{
  suite: ProductConvergenceSuiteV1;
  suiteHash: string;
}>;

export async function loadConvergenceSuite(file: string): Promise<LoadedConvergenceSuiteV1> {
  const absolute = path.resolve(file);
  const info = await lstat(absolute);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("EVAL_SUITE_FILE_NOT_REGULAR");
  const canonical = await realpath(absolute);
  const suite = ProductConvergenceSuiteV1Schema.parse(JSON.parse(await readFile(canonical, "utf8")));
  return Object.freeze({ suite, suiteHash: hashCanonicalJson(suite) });
}

export function convergenceCaseHash(value: ConvergenceCaseV1): string {
  return hashCanonicalJson(ConvergenceCaseV1Schema.parse(value));
}
