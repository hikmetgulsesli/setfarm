import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  ActionIdSchema,
  RepoRelativePathSchema,
  StateIdSchema,
  hasUniqueStrings,
} from "../product-compiler/schemas/common-v1.js";

const JsonPointerSchema = z.string().max(1_024).refine(
  (value) => value === "" || value.startsWith("/"),
  "Expected an RFC 6901-style JSON pointer",
);

const RuntimeCaptureV1Schema = z.discriminatedUnion("format", [
  z.object({
    format: z.literal("json"),
    statePointer: JsonPointerSchema,
  }).strict(),
  z.object({
    format: z.literal("text"),
  }).strict(),
]);

const RuntimeCommandV1Schema = z.object({
  argv: z.array(z.string().min(1).max(20_000)).min(1).max(200),
  cwd: RepoRelativePathSchema,
  timeoutMs: z.number().int().positive().max(300_000),
  env: z.record(
    z.string().regex(/^[A-Z_][A-Z0-9_]*$/),
    z.string().max(20_000),
  ).refine((value) => Object.keys(value).length <= 500, "Runtime command env is limited to 500 entries").optional(),
}).strict();

const RuntimeInputValuesV1Schema = z.record(
  z.string().min(1).max(160),
  z.json(),
).refine((value) => Object.keys(value).length <= 500, "Runtime action inputs are limited to 500 entries");

const CliInvocationV1Schema = z.object({
  command: RuntimeCommandV1Schema,
  stdin: z.string().max(1_000_000).optional(),
  expectedExitCode: z.number().int(),
  capture: RuntimeCaptureV1Schema,
}).strict();

const CliActionBindingV1Schema = z.object({
  actionRef: ActionIdSchema,
  inputValues: RuntimeInputValuesV1Schema,
  action: CliInvocationV1Schema,
  reload: CliInvocationV1Schema.optional(),
}).strict();

const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);
const HttpPathSchema = z.string()
  .min(1)
  .max(2_000)
  .refine((value) => value.startsWith("/") && !value.startsWith("//"), {
    message: "Runtime HTTP paths must be origin-relative",
  })
  .refine((value) => !value.includes("\\") && !value.includes("\0"), {
    message: "Runtime HTTP paths cannot contain backslashes or NUL",
  });

const HttpInvocationV1Schema = z.object({
  method: HttpMethodSchema,
  path: HttpPathSchema,
  headers: z.record(
    z.string().min(1).max(200),
    z.string().max(20_000),
  ).refine((value) => Object.keys(value).length <= 500, "Runtime HTTP headers are limited to 500 entries"),
  body: z.json().optional(),
  expectedStatus: z.number().int().min(100).max(599),
  timeoutMs: z.number().int().positive().max(300_000),
  capture: RuntimeCaptureV1Schema,
}).strict().superRefine((value, context) => {
  if ((value.method === "GET" || value.method === "HEAD") && value.body !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["body"],
      message: `${value.method} runtime evidence requests cannot carry a body`,
    });
  }
});

const HttpActionBindingV1Schema = z.object({
  actionRef: ActionIdSchema,
  inputValues: RuntimeInputValuesV1Schema,
  action: HttpInvocationV1Schema,
  reload: HttpInvocationV1Schema.optional(),
  reloadLifecycle: z.enum(["readback", "restart"]).optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.reload) !== Boolean(value.reloadLifecycle)) {
    context.addIssue({
      code: "custom",
      path: [value.reload ? "reloadLifecycle" : "reload"],
      message: "HTTP reload evidence must declare both an exact invocation and its process lifecycle",
    });
  }
});

const CliRuntimeEvidenceContractV1Schema = z.object({
  schema: z.literal("setfarm.runtime-evidence-contract.v1"),
  adapter: z.literal("cli-process"),
  stackPackId: z.enum(["node-cli", "python-cli"]),
  initial: CliInvocationV1Schema.optional(),
  actions: z.array(CliActionBindingV1Schema).min(1).max(5_000),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.actions.map((action) => action.actionRef))) {
    context.addIssue({ code: "custom", path: ["actions"], message: "CLI action bindings must be unique" });
  }
});

const HttpReadinessV1Schema = z.object({
  method: z.enum(["GET", "HEAD"]),
  path: HttpPathSchema,
  expectedStatus: z.number().int().min(100).max(599),
  timeoutMs: z.number().int().positive().max(300_000),
}).strict();

const HttpRuntimeEvidenceContractV1Schema = z.object({
  schema: z.literal("setfarm.runtime-evidence-contract.v1"),
  adapter: z.literal("http-service"),
  stackPackId: z.literal("node-express-api"),
  server: RuntimeCommandV1Schema,
  readiness: HttpReadinessV1Schema,
  initial: HttpInvocationV1Schema.optional(),
  actions: z.array(HttpActionBindingV1Schema).min(1).max(5_000),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.actions.map((action) => action.actionRef))) {
    context.addIssue({ code: "custom", path: ["actions"], message: "HTTP action bindings must be unique" });
  }
});

const BrowserRuntimeEvidenceContractV1Schema = z.object({
  schema: z.literal("setfarm.runtime-evidence-contract.v1"),
  adapter: z.literal("browser-service"),
  stackPackId: z.enum([
    "nextjs-web-app",
    "vite-react-web-app",
    "static-html-site",
    "browser-game-canvas",
  ]),
  server: RuntimeCommandV1Schema,
  readiness: HttpReadinessV1Schema,
  capture: z.object({
    schema: z.literal("setfarm.browser-state-capture.v1"),
    globalName: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/).max(160),
    actionInvocation: z.object({
      schema: z.literal("setfarm.browser-action-invocation.v1"),
      method: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/).max(160),
    }).strict(),
    scenarioMode: z.object({
      schema: z.literal("setfarm.browser-scenario-mode.v1"),
      globalName: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/).max(160),
      value: z.literal("manual"),
    }).strict(),
    stateBindings: z.array(z.object({
      stateRef: StateIdSchema,
      pointer: JsonPointerSchema,
    }).strict()).min(1).max(500),
  }).strict().superRefine((value, context) => {
    if (value.scenarioMode.globalName === value.globalName) {
      context.addIssue({ code: "custom", path: ["scenarioMode", "globalName"], message: "Scenario mode and test bridge globals must be distinct" });
    }
    if (!hasUniqueStrings(value.stateBindings.map((binding) => binding.stateRef))) {
      context.addIssue({ code: "custom", path: ["stateBindings"], message: "Browser state refs must be unique" });
    }
    if (!hasUniqueStrings(value.stateBindings.map((binding) => binding.pointer))) {
      context.addIssue({ code: "custom", path: ["stateBindings"], message: "Browser state pointers must be unique" });
    }
  }),
  flowIsolation: z.object({
    schema: z.literal("setfarm.browser-flow-isolation.v1"),
    method: z.literal("clear-local-session-storage-and-reload"),
  }).strict(),
}).strict();

export const RuntimeEvidenceContractV1Schema = z.discriminatedUnion("adapter", [
  CliRuntimeEvidenceContractV1Schema,
  HttpRuntimeEvidenceContractV1Schema,
  BrowserRuntimeEvidenceContractV1Schema,
]);

export type RuntimeEvidenceContractV1 = z.infer<typeof RuntimeEvidenceContractV1Schema>;
export type RuntimeEvidenceActionBindingV1 = Extract<
  RuntimeEvidenceContractV1,
  { adapter: "cli-process" | "http-service" }
>["actions"][number];
export type RuntimeCliInvocationV1 = z.infer<typeof CliInvocationV1Schema>;
export type RuntimeHttpInvocationV1 = z.infer<typeof HttpInvocationV1Schema>;

export function hashRuntimeEvidenceContractV1(value: unknown): string {
  return hashCanonicalJson(RuntimeEvidenceContractV1Schema.parse(value));
}
