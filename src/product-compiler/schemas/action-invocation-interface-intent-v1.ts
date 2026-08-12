import { z } from "zod";

import {
  RouteIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import { PlanSemanticKeyV1Schema } from "./plan-semantic-proposal-v1.js";

export const ACTION_INVOCATION_INTERFACE_INTENT_SCHEMA_V1 =
  "setfarm.action-invocation-interface-intent.v1" as const;

const ActionInputFieldNameV1Schema = z.string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/);

const JsonPointerV1Schema = z.string().max(500).refine(
  (value) => /^(?:\/(?:[^~]|~[01])*)*$/.test(value),
  "Expected an empty or RFC 6901 JSON Pointer",
);

const SafeCliTokenV1Schema = z.string().min(1).max(256).refine(
  (value) => /^[a-z0-9][a-z0-9_-]*$/u.test(value),
  "CLI subcommand tokens require canonical lowercase ASCII letters, digits, underscore, or hyphen",
);

const HttpPathParameterNameV1Schema = z.string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/);

const HttpQueryParameterNameV1Schema = z.string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z][A-Za-z0-9_.-]*$/);

// V1 external invocation carries only required logical inputs. Optional input
// defaults/absence outcomes require a later versioned semantic/evidence contract.
export const InvocationOptionalPresenceV1Schema = z.literal("not_applicable");

const InvocationFieldBindingBaseV1Schema = z.object({
  fieldName: ActionInputFieldNameV1Schema,
  optionalPresence: InvocationOptionalPresenceV1Schema,
});

export const CliInvocationFieldChannelV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("argv_position"),
    position: z.number().int().min(0).max(499),
  }).strict(),
  z.object({
    kind: z.literal("argv_flag"),
    flag: z.string().min(3).max(128).regex(/^--[a-z0-9][a-z0-9-]*$/),
    style: z.enum(["separate", "equals"]),
  }).strict(),
  z.object({
    kind: z.literal("stdin_json_pointer"),
    pointer: JsonPointerV1Schema,
    containerPolicy: z.literal("object_intermediates"),
  }).strict(),
]);

export const CliInvocationFieldBindingV1Schema = InvocationFieldBindingBaseV1Schema.extend({
  channel: CliInvocationFieldChannelV1Schema,
}).strict();

export const HttpInvocationFieldChannelV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("path_parameter"),
    name: HttpPathParameterNameV1Schema,
  }).strict(),
  z.object({
    kind: z.literal("query_parameter"),
    name: HttpQueryParameterNameV1Schema,
  }).strict(),
  z.object({
    kind: z.literal("json_body_pointer"),
    pointer: JsonPointerV1Schema,
    containerPolicy: z.literal("object_intermediates"),
  }).strict(),
]);

export const HttpInvocationFieldBindingV1Schema = InvocationFieldBindingBaseV1Schema.extend({
  channel: HttpInvocationFieldChannelV1Schema,
}).strict();

export const InvocationResultValueTypeV1Schema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "enum",
  "object",
  "array",
]);

const InvocationResultValueSourceV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("input"), fieldName: ActionInputFieldNameV1Schema }).strict(),
  z.object({ kind: z.literal("literal"), value: z.json() }).strict(),
]);

export const PlanInvocationResultValueSourceV1Schema = InvocationResultValueSourceV1Schema;
export const ProductInvocationResultValueSourceV1Schema = InvocationResultValueSourceV1Schema;

export type PlanInvocationResultValueSourceV1 = z.infer<
  typeof PlanInvocationResultValueSourceV1Schema
>;

export type ProductInvocationResultValueSourceV1 = z.infer<
  typeof ProductInvocationResultValueSourceV1Schema
>;

export const PlanInvocationResultValueContractV1Schema = z.object({
  valueType: InvocationResultValueTypeV1Schema,
  expectedFrom: PlanInvocationResultValueSourceV1Schema,
}).strict();

export const ProductInvocationResultValueContractV1Schema = z.object({
  valueType: InvocationResultValueTypeV1Schema,
  expectedFrom: ProductInvocationResultValueSourceV1Schema,
}).strict();

export type PlanInvocationResultValueContractV1 = z.infer<
  typeof PlanInvocationResultValueContractV1Schema
>;

export type ProductInvocationResultValueContractV1 = z.infer<
  typeof ProductInvocationResultValueContractV1Schema
>;

export function invocationValueMatchesTypeV1(
  valueType: z.infer<typeof InvocationResultValueTypeV1Schema>,
  value: unknown,
): boolean {
  if (valueType === "number") return typeof value === "number" && Number.isFinite(value);
  if (valueType === "boolean") return typeof value === "boolean";
  if (valueType === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (valueType === "array") return Array.isArray(value);
  if (valueType === "date") {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    return validGregorianDateV1(year!, month!, day!);
  }
  if (valueType === "datetime") {
    if (typeof value !== "string") return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/u.exec(value);
    if (!match) return false;
    const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] = match;
    if (!validGregorianDateV1(Number(year), Number(month), Number(day))) return false;
    if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
    if (
      (offsetHour !== undefined && Number(offsetHour) > 23)
      || (offsetMinute !== undefined && Number(offsetMinute) > 59)
    ) return false;
    return !Number.isNaN(Date.parse(value));
  }
  return typeof value === "string";
}

function validGregorianDateV1(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || year < 1 || year > 9_999) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maximumDay = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day <= maximumDay;
}

const InvocationFailureKindV1Schema = z.enum([
  "input_validation",
  "precondition",
  "action_failure",
]);

const InvocationErrorShapeV1 = {
  errorCode: z.string().min(1).max(128).regex(/^[A-Z][A-Z0-9_]*$/),
  codePointer: JsonPointerV1Schema,
  messagePointer: JsonPointerV1Schema,
} as const;

const CliFailureCaseV1Schema = z.object({
  kind: InvocationFailureKindV1Schema,
  exitCodes: z.array(z.number().int().min(1).max(255)).min(1).max(32)
    .refine((values) => new Set(values).size === values.length, {
      message: "CLI failure exit codes must be unique",
    }),
  channel: z.literal("stderr_json"),
  ...InvocationErrorShapeV1,
}).strict();

const HttpFailureCaseV1Schema = z.object({
  kind: InvocationFailureKindV1Schema,
  statusCodes: z.array(z.number().int().min(400).max(599)).min(1).max(100)
    .refine((values) => new Set(values).size === values.length, {
      message: "HTTP failure status codes must be unique",
    }),
  channel: z.literal("response_json"),
  ...InvocationErrorShapeV1,
}).strict();

const CliResultIntentV1Schema = z.object({
  kind: z.literal("stdout_json"),
  successExitCodes: z.array(z.number().int().min(0).max(255)).min(1).max(32)
    .refine((values) => new Set(values).size === values.length, {
      message: "CLI success exit codes must be unique",
    }),
  valuePointer: JsonPointerV1Schema,
  failureCases: z.array(CliFailureCaseV1Schema).min(1).max(3),
}).strict();

const HttpResultIntentV1Schema = z.object({
  kind: z.literal("response_json"),
  successStatusCodes: z.array(z.number().int().min(200).max(299)).min(1).max(100)
    .refine((values) => new Set(values).size === values.length, {
      message: "HTTP success status codes must be unique",
    }).refine((values) => values.every((value) => value !== 204 && value !== 205), {
      message: "JSON response contracts cannot declare no-content success status codes",
    }),
  valuePointer: JsonPointerV1Schema,
  failureCases: z.array(HttpFailureCaseV1Schema).min(1).max(3),
}).strict();

const InvocationSchemaIdentityV1 = {
  schema: z.literal(ACTION_INVOCATION_INTERFACE_INTENT_SCHEMA_V1),
} as const;

const RenderedControlInvocationIntentV1Schema = z.object({
  ...InvocationSchemaIdentityV1,
  kind: z.literal("rendered_control"),
}).strict();

const CliInvocationIntentV1Schema = z.object({
  ...InvocationSchemaIdentityV1,
  kind: z.literal("cli_command"),
  subcommandTokens: z.array(SafeCliTokenV1Schema).max(32),
  fieldBindings: z.array(CliInvocationFieldBindingV1Schema).max(500),
  result: CliResultIntentV1Schema,
}).strict();

const PlanHttpInvocationIntentV1Schema = z.object({
  ...InvocationSchemaIdentityV1,
  kind: z.literal("http_request"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  routeKey: PlanSemanticKeyV1Schema,
  fieldBindings: z.array(HttpInvocationFieldBindingV1Schema).max(500),
  result: HttpResultIntentV1Schema,
}).strict();

const ProductHttpInvocationIntentV1Schema = z.object({
  ...InvocationSchemaIdentityV1,
  kind: z.literal("http_request"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  routeRef: RouteIdSchema,
  fieldBindings: z.array(HttpInvocationFieldBindingV1Schema).max(500),
  result: HttpResultIntentV1Schema,
}).strict();

const PlanRouteEntryInvocationIntentV1Schema = z.object({
  ...InvocationSchemaIdentityV1,
  kind: z.literal("route_entry"),
  routeKey: PlanSemanticKeyV1Schema,
}).strict();

const ProductRouteEntryInvocationIntentV1Schema = z.object({
  ...InvocationSchemaIdentityV1,
  kind: z.literal("route_entry"),
  routeRef: RouteIdSchema,
}).strict();

export const PlanActionInvocationInterfaceIntentV1Schema = z.discriminatedUnion("kind", [
  RenderedControlInvocationIntentV1Schema,
  CliInvocationIntentV1Schema,
  PlanHttpInvocationIntentV1Schema,
  PlanRouteEntryInvocationIntentV1Schema,
]);

export type PlanActionInvocationInterfaceIntentV1 = z.infer<
  typeof PlanActionInvocationInterfaceIntentV1Schema
>;

export const ProductActionInvocationInterfaceIntentV1Schema = z.discriminatedUnion("kind", [
  RenderedControlInvocationIntentV1Schema,
  CliInvocationIntentV1Schema,
  ProductHttpInvocationIntentV1Schema,
  ProductRouteEntryInvocationIntentV1Schema,
]);

export type ProductActionInvocationInterfaceIntentV1 = z.infer<
  typeof ProductActionInvocationInterfaceIntentV1Schema
>;

type InvocationInterfaceWithFieldsV1 = Extract<
  PlanActionInvocationInterfaceIntentV1 | ProductActionInvocationInterfaceIntentV1,
  { kind: "cli_command" | "http_request" }
>;

function pointerSegments(pointer: string): string[] {
  if (pointer === "") return [];
  return pointer.slice(1).split("/").map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function pointerOverlaps(left: string, right: string): boolean {
  const leftSegments = pointerSegments(left);
  const rightSegments = pointerSegments(right);
  const common = Math.min(leftSegments.length, rightSegments.length);
  for (let index = 0; index < common; index += 1) {
    if (leftSegments[index] !== rightSegments[index]) return false;
  }
  return true;
}

function addDuplicateChannelIssues(
  value: InvocationInterfaceWithFieldsV1,
  context: z.RefinementCtx,
  pathPrefix: readonly PropertyKey[],
): void {
  const identities = value.fieldBindings.flatMap((binding, index) => {
    const channel = binding.channel;
    if (channel.kind === "argv_position") return [{ index, identity: `argv_position\0${channel.position}` }];
    if (channel.kind === "argv_flag") return [{ index, identity: `argv_flag\0${channel.flag}` }];
    if (channel.kind === "path_parameter") return [{ index, identity: `path_parameter\0${channel.name}` }];
    if (channel.kind === "query_parameter") return [{ index, identity: `query_parameter\0${channel.name}` }];
    return [];
  });
  const counts = new Map<string, number>();
  identities.forEach(({ identity }) => counts.set(identity, (counts.get(identity) ?? 0) + 1));
  identities.forEach(({ index, identity }) => {
    if ((counts.get(identity) ?? 0) < 2) return;
    context.addIssue({
      code: "custom",
      path: [...pathPrefix, "fieldBindings", index, "channel"],
      message: `INVOCATION_INTERFACE_CHANNEL_DUPLICATE: ${identity.replace("\0", ":")}`,
    });
  });

  const pointerBindings = value.fieldBindings.flatMap((binding, index) => {
    const channel = binding.channel;
    return channel.kind === "stdin_json_pointer" || channel.kind === "json_body_pointer"
      ? [{ index, pointer: channel.pointer, kind: channel.kind }]
      : [];
  });
  for (const kind of ["stdin_json_pointer", "json_body_pointer"] as const) {
    const bindings = pointerBindings.filter((binding) => binding.kind === kind);
    const byPointer = new Map<string, typeof bindings>();
    bindings.forEach((binding) => {
      const owned = byPointer.get(binding.pointer) ?? [];
      owned.push(binding);
      byPointer.set(binding.pointer, owned);
    });
    const overlapPartner = new Map<number, string>();
    byPointer.forEach((owned, pointer) => {
      if (owned.length < 2) return;
      owned.forEach((binding) => overlapPartner.set(binding.index, pointer));
    });
    for (const binding of bindings) {
      const candidates: string[] = [];
      if (binding.pointer !== "" && byPointer.has("")) candidates.push("");
      for (let index = 1; index < binding.pointer.length; index += 1) {
        if (binding.pointer[index] !== "/") continue;
        const ancestor = binding.pointer.slice(0, index);
        if (byPointer.has(ancestor)) candidates.push(ancestor);
      }
      const partnerPointer = candidates[0];
      if (partnerPointer === undefined) continue;
      overlapPartner.set(binding.index, partnerPointer);
      byPointer.get(partnerPointer)?.forEach((partner) =>
        overlapPartner.set(partner.index, binding.pointer));
    }
    for (const binding of bindings) {
      const partner = overlapPartner.get(binding.index);
      if (partner === undefined) continue;
      context.addIssue({
        code: "custom",
        path: [...pathPrefix, "fieldBindings", binding.index, "channel", "pointer"],
        message: `INVOCATION_INTERFACE_JSON_POINTER_OVERLAP: ${binding.pointer} overlaps ${partner}`,
      });
    }
  }
}

export function addInvocationInterfaceActionIssuesV1(input: Readonly<{
  invocationInterface: PlanActionInvocationInterfaceIntentV1 | ProductActionInvocationInterfaceIntentV1;
  inputFields: readonly Readonly<{ name: string; required: boolean; valueType: string }>[];
  inputFieldPath: readonly PropertyKey[];
  trigger: Readonly<{ kind: "user" | "system" | "timer" | "route"; sourceRef?: string }>;
  preconditionCount: number;
  controlPlacementCount: number;
  evidenceControlRefPresent: boolean;
  canonicalAuthority: boolean;
  context: z.RefinementCtx;
  pathPrefix?: readonly PropertyKey[];
}>): void {
  const {
    invocationInterface,
    inputFields,
    inputFieldPath,
    trigger,
    preconditionCount,
    controlPlacementCount,
    evidenceControlRefPresent,
    canonicalAuthority,
    context,
  } = input;
  const pathPrefix = input.pathPrefix ?? [];
  const issue = (path: readonly PropertyKey[], message: string) => context.addIssue({
    code: "custom",
    path: [...pathPrefix, ...path],
    message,
  });

  const rendered = invocationInterface.kind === "rendered_control";
  const external = invocationInterface.kind === "cli_command" || invocationInterface.kind === "http_request";
  if (rendered) {
    if (trigger.kind !== "user") issue(["invocationInterface", "kind"], "INVOCATION_INTERFACE_RENDERED_TRIGGER_MISMATCH: rendered controls require a user trigger");
    if (trigger.sourceRef !== undefined) issue(["trigger", "sourceRef"], "INVOCATION_INTERFACE_RENDERED_TRIGGER_SOURCE_FORBIDDEN: rendered invocation identity is owned only by exact control placement authority");
    if (controlPlacementCount === 0) issue(["controlPlacements"], "INVOCATION_INTERFACE_RENDERED_CONTROL_REQUIRED: rendered-control invocation requires at least one control placement");
    if (!evidenceControlRefPresent) issue(["evidenceScenario"], "INVOCATION_INTERFACE_RENDERED_EVIDENCE_CONTROL_REQUIRED: rendered-control invocation requires an exact evidence control");
    inputFields.forEach((field, fieldIndex) => {
      if (!field.required) {
        issue(
          [...inputFieldPath, fieldIndex, "required"],
          "INVOCATION_INTERFACE_RENDERED_OPTIONAL_INPUT_UNSUPPORTED: active rendered V1 has no logical absence/default evidence contract",
        );
      }
      if (field.valueType === "date" || field.valueType === "datetime") {
        issue(
          [...inputFieldPath, fieldIndex, "valueType"],
          "INVOCATION_INTERFACE_RENDERED_TEMPORAL_INPUT_UNSUPPORTED: active rendered V1 has no release-owned date/datetime DOM codec",
        );
      }
    });
  } else if (controlPlacementCount > 0 || evidenceControlRefPresent) {
    issue(["controlPlacements"], "INVOCATION_INTERFACE_NON_RENDERED_CONTROL_FORBIDDEN: only rendered-control invocation can own physical controls");
  }

  if (external && trigger.kind !== "user") {
    issue(["trigger", "kind"], "INVOCATION_INTERFACE_EXTERNAL_TRIGGER_MISMATCH: CLI and HTTP invocation require a user trigger");
  }
  if (external && trigger.sourceRef !== undefined) {
    issue(["trigger", "sourceRef"], "INVOCATION_INTERFACE_EXTERNAL_TRIGGER_SOURCE_FORBIDDEN: CLI and HTTP invocation identity is owned only by the typed invocation interface");
  }
  if (invocationInterface.kind === "route_entry") {
    if (trigger.kind !== "route") issue(["trigger", "kind"], "INVOCATION_INTERFACE_ROUTE_TRIGGER_MISMATCH: route entry requires a route trigger");
    const routeIdentity = "routeKey" in invocationInterface
      ? invocationInterface.routeKey
      : invocationInterface.routeRef;
    if (trigger.sourceRef !== routeIdentity) {
      issue(["trigger", "sourceRef"], "INVOCATION_INTERFACE_ROUTE_SOURCE_MISMATCH: trigger sourceRef must equal the exact route identity");
    }
  }
  if (!external) {
    if (invocationInterface.kind !== "rendered_control" && inputFields.length > 0) {
      issue(inputFieldPath, "INVOCATION_INTERFACE_UNBOUND_INPUTS: only CLI/HTTP interfaces can carry logical input fields without a rendered input transport");
    }
    return;
  }

  const expectedNames = inputFields.map((field) => field.name);
  const observedNames = invocationInterface.fieldBindings.map((binding) => binding.fieldName);
  if (
    !hasUniqueStrings(observedNames)
    || observedNames.length !== expectedNames.length
    || expectedNames.some((name) => !observedNames.includes(name))
  ) {
    issue(["invocationInterface", "fieldBindings"], "INVOCATION_INTERFACE_FIELD_CLOSURE_MISMATCH: field bindings must cover every and only logical action input exactly once");
  }
  const canonicalBindingNames = [...observedNames].sort();
  if (
    canonicalAuthority
    && observedNames.some((name, index) => name !== canonicalBindingNames[index])
  ) {
    issue(["invocationInterface", "fieldBindings"], "INVOCATION_INTERFACE_FIELD_ORDER_NON_CANONICAL: field bindings must be ordered by fieldName");
  }
  invocationInterface.fieldBindings.forEach((binding) => {
    const field = inputFields.find((candidate) => candidate.name === binding.fieldName);
    if (!field) return;
    if (!field.required) {
      const fieldIndex = inputFields.indexOf(field);
      issue(
        [...inputFieldPath, fieldIndex, "required"],
        "INVOCATION_INTERFACE_OPTIONAL_INPUT_UNSUPPORTED: V1 CLI/HTTP invocation requires every logical input; defaults and absence evidence require a later contract",
      );
    }
  });
  addDuplicateChannelIssues(invocationInterface, context, [...pathPrefix, "invocationInterface"]);

  const expectedFailureKinds = [
    ...(inputFields.length > 0 ? ["input_validation" as const] : []),
    ...(preconditionCount > 0 ? ["precondition" as const] : []),
    "action_failure" as const,
  ];
  const observedFailureKinds = invocationInterface.result.failureCases.map((failure) => failure.kind);
  if (
    !hasUniqueStrings(observedFailureKinds)
    || observedFailureKinds.length !== expectedFailureKinds.length
    || expectedFailureKinds.some((kind) => !observedFailureKinds.includes(kind))
    || (
      canonicalAuthority
      && expectedFailureKinds.some((kind, index) => observedFailureKinds[index] !== kind)
    )
  ) {
    issue(
      ["invocationInterface", "result", "failureCases"],
      `INVOCATION_INTERFACE_FAILURE_CASE_CLOSURE: expected ${expectedFailureKinds.join(",")}`,
    );
  }
  const failureCodes = invocationInterface.result.failureCases.flatMap((failure) =>
    "exitCodes" in failure ? failure.exitCodes : failure.statusCodes);
  if (new Set(failureCodes).size !== failureCodes.length) {
    issue(
      ["invocationInterface", "result", "failureCases"],
      "INVOCATION_INTERFACE_FAILURE_CODE_DUPLICATE: every failure case must own disjoint exit/status codes",
    );
  }
  const errorCodes = invocationInterface.result.failureCases.map((failure) => failure.errorCode);
  if (!hasUniqueStrings(errorCodes)) {
    issue(
      ["invocationInterface", "result", "failureCases"],
      "INVOCATION_INTERFACE_ERROR_CODE_DUPLICATE: every failure case requires a distinct stable errorCode",
    );
  }
  if (canonicalAuthority) {
    const canonicalCodes = (codes: readonly number[]) =>
      codes.every((code, index) => index === 0 || codes[index - 1]! < code);
    const successCodes = invocationInterface.kind === "cli_command"
      ? invocationInterface.result.successExitCodes
      : invocationInterface.result.successStatusCodes;
    if (!canonicalCodes(successCodes)) {
      issue(
        ["invocationInterface", "result"],
        "INVOCATION_INTERFACE_SUCCESS_CODES_NON_CANONICAL: ProductSpec success codes must be ascending",
      );
    }
    invocationInterface.result.failureCases.forEach((failure, failureIndex) => {
      const codes = "exitCodes" in failure ? failure.exitCodes : failure.statusCodes;
      if (canonicalCodes(codes)) return;
      issue(
        ["invocationInterface", "result", "failureCases", failureIndex],
        "INVOCATION_INTERFACE_FAILURE_CODES_NON_CANONICAL: ProductSpec failure codes must be ascending",
      );
    });
  }
  invocationInterface.result.failureCases.forEach((failure, failureIndex) => {
    if (!pointerOverlaps(failure.codePointer, failure.messagePointer)) return;
    issue(
      ["invocationInterface", "result", "failureCases", failureIndex],
      "INVOCATION_INTERFACE_ERROR_POINTER_OVERLAP: code and message pointers must be disjoint",
    );
  });
  if (invocationInterface.kind === "cli_command") {
    const successCodes = new Set(invocationInterface.result.successExitCodes);
    if (failureCodes.some((code) => successCodes.has(code))) {
      issue(
        ["invocationInterface", "result"],
        "INVOCATION_INTERFACE_SUCCESS_FAILURE_CODE_OVERLAP: CLI success and failure exit codes must be disjoint",
      );
    }
  }

  if (invocationInterface.kind === "cli_command") {
    const positional = invocationInterface.fieldBindings.flatMap((binding, index) =>
      binding.channel.kind === "argv_position"
        ? [{ index, position: binding.channel.position }]
        : []).sort((left, right) => left.position - right.position);
    positional.forEach((binding, index) => {
      if (binding.position !== index) {
        issue(
          ["invocationInterface", "fieldBindings", binding.index, "channel", "position"],
          "INVOCATION_INTERFACE_ARGV_POSITION_GAP: positional input indexes must be contiguous from zero",
        );
      }
    });
  }

  if (
    invocationInterface.kind === "http_request"
    && invocationInterface.method === "GET"
    && invocationInterface.fieldBindings.some((binding) => binding.channel.kind === "json_body_pointer")
  ) {
    issue(["invocationInterface", "fieldBindings"], "INVOCATION_INTERFACE_HTTP_BODY_FORBIDDEN: GET cannot carry JSON body fields");
  }
}

export function cliInvocationTokenSequencesOverlapV1(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const common = Math.min(left.length, right.length);
  for (let index = 0; index < common; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function compareCliInvocationTokenSequencesV1(
  left: readonly string[],
  right: readonly string[],
): number {
  const common = Math.min(left.length, right.length);
  for (let index = 0; index < common; index += 1) {
    const comparison = compareInvocationTextCodeUnitsV1(left[index]!, right[index]!);
    if (comparison !== 0) return comparison;
  }
  return left.length - right.length;
}

export function compareInvocationTextCodeUnitsV1(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function httpInvocationRoutePathsOverlapV1(left: string, right: string): boolean {
  const leftSegments = left === "/" ? [] : left.slice(1).split("/");
  const rightSegments = right === "/" ? [] : right.slice(1).split("/");
  if (leftSegments.length !== rightSegments.length) return false;
  return leftSegments.every((segment, index) =>
    segment.startsWith(":")
    || rightSegments[index]!.startsWith(":")
    || segment === rightSegments[index]);
}

export const HTTP_INVOCATION_ROUTE_COMPARISON_MAX_V1 = 100_000;

export type HttpInvocationRouteCollisionCandidateV1 = Readonly<{
  identity: string;
  method: string;
  path: string;
}>;

export type HttpInvocationRouteCollisionResultV1 =
  | Readonly<{ status: "disjoint"; comparisons: number }>
  | Readonly<{
      status: "collision";
      comparisons: number;
      leftIdentity: string;
      rightIdentity: string;
      method: string;
      leftPath: string;
      rightPath: string;
    }>
  | Readonly<{ status: "budget_exceeded"; comparisons: number }>;

export function findHttpInvocationRouteCollisionV1(
  candidates: readonly HttpInvocationRouteCollisionCandidateV1[],
): HttpInvocationRouteCollisionResultV1 {
  const prepared = candidates.map((candidate) => ({
    ...candidate,
    segmentCount: candidate.path === "/" ? 0 : candidate.path.slice(1).split("/").length,
  })).sort((left, right) =>
    compareInvocationTextCodeUnitsV1(left.method, right.method)
    || left.segmentCount - right.segmentCount
    || compareInvocationTextCodeUnitsV1(left.path, right.path)
    || compareInvocationTextCodeUnitsV1(left.identity, right.identity));
  let comparisons = 0;
  for (let leftIndex = 0; leftIndex < prepared.length; leftIndex += 1) {
    const left = prepared[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < prepared.length; rightIndex += 1) {
      const right = prepared[rightIndex]!;
      if (left.method !== right.method || left.segmentCount !== right.segmentCount) break;
      comparisons += 1;
      if (comparisons > HTTP_INVOCATION_ROUTE_COMPARISON_MAX_V1) {
        return { status: "budget_exceeded", comparisons };
      }
      if (!httpInvocationRoutePathsOverlapV1(left.path, right.path)) continue;
      return {
        status: "collision",
        comparisons,
        leftIdentity: left.identity,
        rightIdentity: right.identity,
        method: left.method,
        leftPath: left.path,
        rightPath: right.path,
      };
    }
  }
  return { status: "disjoint", comparisons };
}

export function httpRouteParameterNamesV1(path: string): string[] | null {
  const parameters: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment.includes(":")) continue;
    const match = /^:([A-Za-z][A-Za-z0-9_]*)$/.exec(segment);
    if (!match) return null;
    parameters.push(match[1]!);
  }
  return parameters;
}

/**
 * V1 HTTP invocation paths are portable origin-relative templates. Percent
 * escapes and ambiguous/empty segments stay fail-closed until a versioned URL
 * codec owns their canonicalization.
 */
export function isSafeHttpInvocationRoutePathV1(path: string): boolean {
  if (path === "/") return true;
  if (!path.startsWith("/") || path.startsWith("//") || path.endsWith("/")) return false;
  if (/[\\?#%\u0000-\u001f\u007f]/u.test(path)) return false;
  return path.slice(1).split("/").every((segment) =>
    /^[A-Za-z0-9][A-Za-z0-9._~-]*$/u.test(segment)
    || /^:[A-Za-z][A-Za-z0-9_]*$/u.test(segment));
}
