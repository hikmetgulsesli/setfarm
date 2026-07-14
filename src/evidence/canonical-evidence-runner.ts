import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { SourceRevisionV1 } from "../execution/schemas/execution-attempt-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import type { ImplementationSliceV1 } from "../product-compiler/schemas/implementation-slice-v1.js";
import { ImplementationSliceV1Schema } from "../product-compiler/schemas/implementation-slice-v1.js";
import type {
  EvidencePredicateV1,
  ObservableActionEffectV1,
  PersistencePolicyV1,
  ProductActionV1,
} from "../product-compiler/schemas/product-spec-v1.js";
import type { CapturedRuntimeState, InteractionRequest, InteractionResult } from "../installer/runtime-driver.js";
import {
  computeEvidenceBundleHash,
  computeObservationRef,
  createEvidenceBundleV2,
  type EvidenceArtifactRefV2Schema,
  type EvidenceBundleV2,
  type EvidenceObservationDraftV2,
} from "./evidence-bundle-v2.js";
import { compileEvidencePlanV1, EvidencePlanV1Schema, type EvidencePlanV1 } from "./evidence-plan-v1.js";
import type { z } from "zod";

export type CanonicalCommandTraceV1 = Readonly<{
  commandRef: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  completedAt: string;
}>;

export type CanonicalInteractionTraceV1 = Readonly<{
  request: InteractionRequest;
  result: InteractionResult;
  before: CapturedRuntimeState;
  after: CapturedRuntimeState;
}>;

export type CanonicalEvidenceExecutionV1 = Readonly<{
  runtimeSessionId?: string;
  initialCapture?: CapturedRuntimeState;
  commands: readonly CanonicalCommandTraceV1[];
  interactions: readonly CanonicalInteractionTraceV1[];
  runtimeError?: string;
}>;

export type CanonicalEvidenceResultV1 = Readonly<{
  bundle: EvidenceBundleV2;
  bundleHash: string;
  artifactPaths: readonly string[];
}>;

type Artifact = z.infer<typeof EvidenceArtifactRefV2Schema>;
type Predicate = ImplementationSliceV1["requiredEvidence"][number];
type SemanticVerdict = "pass" | "fail" | "inconclusive";

export type ProducedPredicateSemanticInputV1 = Readonly<{
  predicate: EvidencePredicateV1;
  action: ProductActionV1;
  persistencePolicies: readonly PersistencePolicyV1[];
  inputValues: Readonly<Record<string, unknown>>;
  stateBefore: Readonly<Record<string, unknown>>;
  stateAfterAction: Readonly<Record<string, unknown>>;
  stateAfterReload?: Readonly<Record<string, unknown>>;
  actionPassed: boolean;
  reloadPassed?: boolean;
  runtimeAdapter?: "browser-service" | "cli-process" | "http-service";
}>;

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 180) || "artifact";
}

function jsonPointer(value: unknown, pointer: string): unknown {
  if (pointer === "") return value;
  if (!pointer.startsWith("/")) return undefined;
  let current = value;
  for (const encoded of pointer.slice(1).split("/")) {
    if (current === null || typeof current !== "object") return undefined;
    const key = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function statePayload(capture: CapturedRuntimeState | undefined): unknown {
  const bridge = capture?.stateBridge;
  if (!bridge || typeof bridge !== "object") return undefined;
  return Object.prototype.hasOwnProperty.call(bridge, "state")
    ? (bridge as Record<string, unknown>).state
    : bridge;
}

function capturedStates(
  capture: CapturedRuntimeState | undefined,
  slice: ImplementationSliceV1,
): Readonly<Record<string, unknown>> {
  const bridge = capture?.stateBridge;
  if (!isRecord(bridge)) return {};
  if (isRecord(bridge.states)) return bridge.states;

  // Compatibility for pre-v3 fixtures and evidence bundles. Production v3
  // browser execution always uses the versioned states-by-reference bridge.
  if (slice.contract.states.length !== 1) return {};
  const stateRef = slice.contract.states[0]!.id;
  if (Object.prototype.hasOwnProperty.call(bridge, "state")) {
    return { [stateRef]: bridge.state };
  }
  return { [stateRef]: bridge };
}

function actionStatePayload(
  capture: CapturedRuntimeState | undefined,
  action: ProductActionV1,
  slice: ImplementationSliceV1,
): unknown {
  const refs = [...new Set([
    ...action.preconditions.map((condition) => condition.stateRef),
    ...action.stateDeltas.map((delta) => delta.stateRef),
    ...action.success.stateRefs,
  ])];
  const states = capturedStates(capture, slice);
  if (refs.length === 1 && Object.prototype.hasOwnProperty.call(states, refs[0]!)) return states[refs[0]!];
  return statePayload(capture);
}

function pathname(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
}

function deepEqual(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function assertionVerdict(
  operator: Predicate["assertion"]["operator"],
  actual: unknown,
  expected: unknown,
): "pass" | "fail" | "inconclusive" {
  if (operator === "passes") return actual === true ? "pass" : actual === false ? "fail" : "inconclusive";
  if (operator === "exists") return actual === undefined || actual === null ? "fail" : "pass";
  if (operator === "not_exists") return actual === undefined || actual === null ? "pass" : "fail";
  if (actual === undefined) return "inconclusive";
  if (operator === "equals") return deepEqual(actual, expected) ? "pass" : "fail";
  if (operator === "not_equals") return deepEqual(actual, expected) ? "fail" : "pass";
  if (operator === "matches") {
    if (typeof actual !== "string" || typeof expected !== "string") return "inconclusive";
    try {
      return new RegExp(expected).test(actual) ? "pass" : "fail";
    } catch {
      return "inconclusive";
    }
  }
  return "inconclusive";
}

function invariantRef(kind: Predicate["kind"]): string {
  return `INV_${kind.toUpperCase()}`;
}

function resolveActionInput(
  flow: EvidencePlanV1["flows"][number],
  field: string,
  before: CapturedRuntimeState | undefined,
  slice: ImplementationSliceV1,
): unknown {
  const binding = flow.inputBindings.find((candidate) => candidate.inputField === field);
  if (!binding) return undefined;
  if (binding.valueFrom.kind === "control_value") return binding.valueFrom.testValue;
  if (binding.valueFrom.kind === "literal") return binding.valueFrom.value;
  const state = capturedStates(before, slice)[binding.valueFrom.stateRef];
  return state === undefined ? undefined : jsonPointer(state, binding.valueFrom.path);
}

function resolvedActionInputs(
  action: ProductActionV1,
  flow: EvidencePlanV1["flows"][number],
  before: CapturedRuntimeState | undefined,
  slice: ImplementationSliceV1,
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(action.input.fields.map((field) => [
    field.name,
    resolveActionInput(flow, field.name, before, slice),
  ]));
}

function expectedActionValue(
  predicate: Predicate,
  flow: EvidencePlanV1["flows"][number],
  before: CapturedRuntimeState | undefined,
  slice: ImplementationSliceV1,
): Readonly<{ path?: string; value: unknown }> {
  const expected = predicate.assertion.expected;
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) {
    return { value: expected };
  }
  const record = expected as Record<string, unknown>;
  const source = typeof record.source === "string" ? record.source : "";
  const field = source.startsWith("action.input.") ? source.slice("action.input.".length) : "";
  return {
    ...(typeof record.path === "string" ? { path: record.path } : {}),
    value: field ? resolveActionInput(flow, field, before, slice) : expected,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactStringSet(left: readonly string[], right: readonly string[]): boolean {
  const canonical = (values: readonly string[]) => [...new Set(values)].sort();
  const a = canonical(left);
  const b = canonical(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function evaluateActionPreconditions(
  action: ProductActionV1,
  stateBefore: Readonly<Record<string, unknown>>,
): SemanticVerdict {
  for (const condition of action.preconditions) {
    if (!Object.prototype.hasOwnProperty.call(stateBefore, condition.stateRef)) return "inconclusive";
    const actual = jsonPointer(stateBefore[condition.stateRef], condition.path);
    let passed = false;
    if (condition.operator === "equals") passed = deepEqual(actual, condition.expected);
    else if (condition.operator === "not_equals") passed = !deepEqual(actual, condition.expected);
    else if (condition.operator === "exists") passed = actual !== undefined && actual !== null;
    else if (condition.operator === "not_exists") passed = actual === undefined || actual === null;
    else if (condition.operator === "truthy") passed = Boolean(actual);
    else if (condition.operator === "falsy") passed = !actual;
    if (!passed) return "fail";
  }
  return "pass";
}

function semanticValueSource(input: Readonly<{
  source: ProductActionV1["stateDeltas"][number]["valueFrom"];
  inputValues: Readonly<Record<string, unknown>>;
  stateBefore: Readonly<Record<string, unknown>>;
}>): unknown {
  if (input.source.kind === "literal") return input.source.value;
  if (input.source.kind === "input") {
    return Object.prototype.hasOwnProperty.call(input.inputValues, input.source.field)
      ? input.inputValues[input.source.field]
      : undefined;
  }
  if (input.source.kind === "inputs") {
    const entries = input.source.fields.map((field) => [field, input.inputValues[field]] as const);
    if (entries.some(([, value]) => value === undefined)) return undefined;
    return Object.fromEntries(entries);
  }
  if (input.source.kind === "state") {
    const state = input.stateBefore[input.source.stateRef];
    return state === undefined ? undefined : jsonPointer(state, input.source.path);
  }
  // Entity-field sources need an entity snapshot binding that ProductSpec v1
  // does not carry into ImplementationSlice. Never guess a state/entity join.
  return undefined;
}

function evaluateActionStateDeltas(input: Readonly<{
  action: ProductActionV1;
  deltas?: ProductActionV1["stateDeltas"];
  inputValues: Readonly<Record<string, unknown>>;
  stateBefore: Readonly<Record<string, unknown>>;
  stateAfter: Readonly<Record<string, unknown>>;
}>): SemanticVerdict {
  const deltas = input.deltas ?? input.action.stateDeltas;
  if (deltas.length === 0) return "inconclusive";
  let observedExactChange = false;
  for (const delta of deltas) {
    if (
      !Object.prototype.hasOwnProperty.call(input.stateBefore, delta.stateRef)
      || !Object.prototype.hasOwnProperty.call(input.stateAfter, delta.stateRef)
    ) return "inconclusive";
    const beforeState = input.stateBefore[delta.stateRef];
    const afterState = input.stateAfter[delta.stateRef];
    const beforeTarget = jsonPointer(beforeState, delta.path);
    const afterTarget = jsonPointer(afterState, delta.path);
    const expected = semanticValueSource({
      source: delta.valueFrom,
      inputValues: input.inputValues,
      stateBefore: input.stateBefore,
    });
    if (expected === undefined || afterTarget === undefined) return "inconclusive";

    let operationPassed = false;
    if (delta.operation === "set" || delta.operation === "clear") {
      operationPassed = deepEqual(afterTarget, expected);
    } else if (delta.operation === "merge") {
      if (!isRecord(expected) || !isRecord(afterTarget)) return "inconclusive";
      operationPassed = Object.entries(expected)
        .every(([key, value]) => deepEqual(afterTarget[key], value));
    } else if (delta.operation === "append") {
      if (!Array.isArray(beforeTarget) || !Array.isArray(afterTarget)) return "inconclusive";
      operationPassed = deepEqual(afterTarget, [...beforeTarget, expected]);
    } else if (delta.operation === "remove") {
      if (!Array.isArray(beforeTarget) || !Array.isArray(afterTarget)) return "inconclusive";
      const filtered = delta.matchField
        ? beforeTarget.filter((value) => {
            if (!isRecord(value)) return true;
            const expectedKey = isRecord(expected) ? expected[delta.matchField!] : expected;
            return !deepEqual(value[delta.matchField!], expectedKey);
          })
        : beforeTarget.filter((value) => !deepEqual(value, expected));
      operationPassed = deepEqual(afterTarget, filtered);
    } else if (delta.operation === "upsert") {
      if (!Array.isArray(beforeTarget) || !Array.isArray(afterTarget) || !isRecord(expected) || !delta.matchField) {
        return "inconclusive";
      }
      const expectedKey = expected[delta.matchField];
      if (expectedKey === undefined) return "inconclusive";
      const existingIndex = beforeTarget.findIndex((value) =>
        isRecord(value) && deepEqual(value[delta.matchField!], expectedKey));
      const expectedAfter = [...beforeTarget];
      if (existingIndex === -1) expectedAfter.push(expected);
      else expectedAfter[existingIndex] = expected;
      operationPassed = deepEqual(afterTarget, expectedAfter);
    }
    if (!operationPassed) return "fail";
    if (!deepEqual(beforeTarget, afterTarget)) observedExactChange = true;
  }
  return observedExactChange ? "pass" : "fail";
}

function exactDeltaTargetsPersisted(input: Readonly<{
  action: ProductActionV1;
  deltas: ProductActionV1["stateDeltas"];
  inputValues: Readonly<Record<string, unknown>>;
  stateAfterAction: Readonly<Record<string, unknown>>;
  stateAfterReload: Readonly<Record<string, unknown>>;
}>): SemanticVerdict {
  for (const delta of input.deltas) {
    const actionState = input.stateAfterAction[delta.stateRef];
    const reloadState = input.stateAfterReload[delta.stateRef];
    if (actionState === undefined || reloadState === undefined) return "inconclusive";
    const actionTarget = jsonPointer(actionState, delta.path);
    const reloadTarget = jsonPointer(reloadState, delta.path);
    if (actionTarget === undefined || reloadTarget === undefined) return "inconclusive";
    if (delta.operation === "merge") {
      const expected = semanticValueSource({
        source: delta.valueFrom,
        inputValues: input.inputValues,
        stateBefore: input.stateAfterAction,
      });
      if (!isRecord(expected) || !isRecord(actionTarget) || !isRecord(reloadTarget)) return "inconclusive";
      if (!Object.keys(expected).every((key) => deepEqual(actionTarget[key], reloadTarget[key]))) return "fail";
    } else if (!deepEqual(actionTarget, reloadTarget)) {
      return "fail";
    }
  }
  return "pass";
}

function persistenceEffectDeltas(
  action: ProductActionV1,
  effect: ProductActionV1["persistenceEffects"][number],
): ProductActionV1["stateDeltas"] | undefined {
  const deltas = effect.statePaths.map((statePath) => action.stateDeltas.find((delta) =>
    delta.stateRef === statePath.stateRef && delta.path === statePath.path));
  if (deltas.some((delta) => !delta)) return undefined;
  return deltas as ProductActionV1["stateDeltas"];
}

export function evaluateProducedPredicateSemanticsV1(
  input: ProducedPredicateSemanticInputV1,
): SemanticVerdict {
  if (!input.actionPassed) return "fail";
  const preconditions = evaluateActionPreconditions(input.action, input.stateBefore);
  if (preconditions !== "pass") return preconditions;
  if (input.predicate.kind === "state_transition") {
    if (input.predicate.assertion.operator !== "passes") return "inconclusive";
    const metadata = input.predicate.assertion.expected;
    if (!isRecord(metadata) || !Array.isArray(metadata.stateRefs) || !metadata.stateRefs.every((value) => typeof value === "string")) {
      return "fail";
    }
    const contractedStateRefs = input.action.stateDeltas.map((delta) => delta.stateRef);
    if (!exactStringSet(metadata.stateRefs, contractedStateRefs)) return "fail";
    return evaluateActionStateDeltas({
      action: input.action,
      inputValues: input.inputValues,
      stateBefore: input.stateBefore,
      stateAfter: input.stateAfterAction,
    });
  }
  if (input.predicate.kind !== "persistence_round_trip" || input.predicate.assertion.operator !== "passes") {
    return "inconclusive";
  }
  const metadata = input.predicate.assertion.expected;
  if (
    !isRecord(metadata)
    || typeof metadata.policyRef !== "string"
    || typeof metadata.durability !== "string"
    || typeof metadata.operation !== "string"
    || !Array.isArray(metadata.statePaths)
  ) {
    return "fail";
  }
  const policy = input.persistencePolicies.find((candidate) => candidate.id === metadata.policyRef);
  const effect = input.action.persistenceEffects.find((candidate) =>
    candidate.policyRef === metadata.policyRef && candidate.operation === metadata.operation);
  if (!policy || !effect || policy.durability !== metadata.durability || effect.operation === "read") return "fail";
  const metadataStatePaths = metadata.statePaths.filter((value): value is { stateRef: string; path: string } =>
    isRecord(value) && typeof value.stateRef === "string" && typeof value.path === "string");
  if (
    metadataStatePaths.length !== metadata.statePaths.length
    || !exactStringSet(
      metadataStatePaths.map((value) => `${value.stateRef}\0${value.path}`),
      effect.statePaths.map((value) => `${value.stateRef}\0${value.path}`),
    )
  ) return "fail";
  const persistedDeltas = persistenceEffectDeltas(input.action, effect);
  if (!persistedDeltas) return "fail";
  const actionDeltaVerdict = evaluateActionStateDeltas({
    action: input.action,
    deltas: persistedDeltas,
    inputValues: input.inputValues,
    stateBefore: input.stateBefore,
    stateAfter: input.stateAfterAction,
  });
  if (actionDeltaVerdict !== "pass") return actionDeltaVerdict;
  if (policy.durability === "none" || policy.durability === "session") return "pass";
  if (
    (policy.durability === "restart" || policy.durability === "durable")
    && input.runtimeAdapter === "browser-service"
  ) {
    // A browser navigation proves reload semantics, not a server/process restart.
    return "inconclusive";
  }
  if (!input.reloadPassed || !input.stateAfterReload) return "fail";
  const reloadDeltaVerdict = evaluateActionStateDeltas({
    action: input.action,
    deltas: persistedDeltas,
    inputValues: input.inputValues,
    stateBefore: input.stateBefore,
    stateAfter: input.stateAfterReload,
  });
  if (reloadDeltaVerdict !== "pass") return reloadDeltaVerdict;
  return exactDeltaTargetsPersisted({
    action: input.action,
    deltas: persistedDeltas,
    inputValues: input.inputValues,
    stateAfterAction: input.stateAfterAction,
    stateAfterReload: input.stateAfterReload,
  });
}

type CapturedDomElementV1 = Readonly<{
  actionId?: string | null;
  controlId: string | null;
  surfaceId: string | null;
  containingSurfaceId?: string | null;
  role: string;
  accessibleName: string;
  visibleText: string;
  value: string | null;
  visible: boolean;
  enabled: boolean;
}>;

function capturedDomElements(capture: CapturedRuntimeState | undefined): CapturedDomElementV1[] | undefined {
  const file = capture?.domSnapshotPath;
  if (!file) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (!isRecord(parsed) || parsed.schema !== "setfarm.browser-dom-observation.v1" || !Array.isArray(parsed.elements)) {
      return undefined;
    }
    const elements = parsed.elements.filter((value): value is CapturedDomElementV1 =>
      isRecord(value)
      && (typeof value.actionId === "string" || value.actionId === null || value.actionId === undefined)
      && (typeof value.controlId === "string" || value.controlId === null)
      && (typeof value.surfaceId === "string" || value.surfaceId === null)
      && (value.containingSurfaceId === undefined || typeof value.containingSurfaceId === "string" || value.containingSurfaceId === null)
      && typeof value.role === "string"
      && typeof value.accessibleName === "string"
      && typeof value.visibleText === "string"
      && (typeof value.value === "string" || value.value === null)
      && typeof value.visible === "boolean"
      && typeof value.enabled === "boolean");
    return elements.length === parsed.elements.length ? elements : undefined;
  } catch {
    return undefined;
  }
}

function escapeAttributeValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function sourceSelectors(element: CapturedDomElementV1): string[] {
  return [
    ...(element.actionId ? [`[data-action-id="${escapeAttributeValue(element.actionId)}"]`] : []),
    ...(element.controlId ? [`[data-control-id="${escapeAttributeValue(element.controlId)}"]`] : []),
  ];
}

function exactFlowControlSelector(flow: EvidencePlanV1["flows"][number]): string | undefined {
  const interaction = flow.interactions.find((candidate) => candidate.id === flow.actionInteractionId);
  return interaction && ["click", "fill", "press", "select"].includes(interaction.action)
    ? interaction.target
    : undefined;
}

function domContainsControl(
  capture: CapturedRuntimeState | undefined,
  flow: EvidencePlanV1["flows"][number],
): boolean | undefined {
  const selector = exactFlowControlSelector(flow);
  if (!selector) return undefined;
  const elements = capturedDomElements(capture);
  if (!elements) return undefined;
  const matches = elements.filter((element) => sourceSelectors(element).includes(selector));
  return matches.length === 1 ? matches[0]!.visible : false;
}

function observableElement(input: Readonly<{
  capture: CapturedRuntimeState | undefined;
  effect: ObservableActionEffectV1;
  flow: EvidencePlanV1["flows"][number];
}>): CapturedDomElementV1 | undefined {
  const elements = capturedDomElements(input.capture);
  if (!elements) return undefined;
  const selector = input.effect.selector;
  let matches: CapturedDomElementV1[];
  if (selector.kind === "control") {
    const exactSelector = exactFlowControlSelector(input.flow);
    if (!exactSelector) return undefined;
    matches = elements.filter((element) => sourceSelectors(element).includes(exactSelector));
  } else if (selector.kind === "surface") {
    matches = elements.filter((element) => element.surfaceId === selector.surfaceRef);
  } else {
    matches = elements.filter((element) =>
      (element.containingSurfaceId ?? element.surfaceId) === selector.surfaceRef
      && element.role === selector.role
      && element.accessibleName === selector.name);
  }
  return matches.length === 1 ? matches[0] : undefined;
}

function observableValue(input: Readonly<{
  capture: CapturedRuntimeState | undefined;
  effect: ObservableActionEffectV1;
  flow: EvidencePlanV1["flows"][number];
  property: ObservableActionEffectV1["assertions"][number]["property"];
}>): unknown {
  if (input.property === "route") return pathname(input.capture?.url);
  const element = observableElement(input);
  if (!element) return undefined;
  if (input.property === "visible_text") return element.visibleText;
  if (input.property === "value") return element.value;
  if (input.property === "visibility") return element.visible;
  return element.enabled;
}

function evaluateObservableEffect(input: Readonly<{
  effect: ObservableActionEffectV1;
  flow: EvidencePlanV1["flows"][number];
  actionTrace: CanonicalInteractionTraceV1;
  reloadTrace?: CanonicalInteractionTraceV1;
}>): SemanticVerdict {
  let observedInconclusive = false;
  for (const assertion of input.effect.assertions) {
    const capture = assertion.phase === "before"
      ? input.actionTrace.before
      : assertion.phase === "after"
        ? input.actionTrace.after
        : input.reloadTrace?.after;
    const actual = observableValue({
      capture,
      effect: input.effect,
      flow: input.flow,
      property: assertion.property,
    });
    if (actual === undefined) {
      observedInconclusive = true;
      continue;
    }
    let verdict: SemanticVerdict;
    if (assertion.operator === "changed") {
      const before = observableValue({
        capture: input.actionTrace.before,
        effect: input.effect,
        flow: input.flow,
        property: assertion.property,
      });
      verdict = before === undefined ? "inconclusive" : deepEqual(before, actual) ? "fail" : "pass";
    } else if (assertion.operator === "contains") {
      verdict = typeof actual === "string" && typeof assertion.expected === "string"
        ? actual.includes(assertion.expected) ? "pass" : "fail"
        : "inconclusive";
    } else if (assertion.operator === "matches") {
      if (typeof actual !== "string" || typeof assertion.expected !== "string") verdict = "inconclusive";
      else {
        try {
          verdict = new RegExp(assertion.expected).test(actual) ? "pass" : "fail";
        } catch {
          verdict = "inconclusive";
        }
      }
    } else {
      verdict = deepEqual(actual, assertion.expected) ? "pass" : "fail";
    }
    if (verdict === "fail") return "fail";
    if (verdict === "inconclusive") observedInconclusive = true;
  }
  return observedInconclusive ? "inconclusive" : "pass";
}

function predicateVerdict(input: Readonly<{
  predicate: Predicate;
  flow?: EvidencePlanV1["flows"][number];
  actionTrace?: CanonicalInteractionTraceV1;
  reloadTrace?: CanonicalInteractionTraceV1;
  command?: CanonicalCommandTraceV1;
  slice: ImplementationSliceV1;
  runtimeAdapter?: EvidencePlanV1["runtime"] extends infer Runtime
    ? Runtime extends { adapter: infer Adapter }
      ? Adapter
      : never
    : never;
  runtimeError?: string;
}>): "pass" | "fail" | "inconclusive" {
  const { predicate, flow, actionTrace, reloadTrace, command } = input;
  if (predicate.kind === "build" || predicate.kind === "test") {
    if (!command) return "inconclusive";
    return command.exitCode === 0 ? "pass" : "fail";
  }
  if (input.runtimeError || !flow || !actionTrace) return "inconclusive";
  const actionPassed = actionTrace.result.status === "pass";
  if (predicate.kind === "control_visible") {
    if (!flow.controlRef) return "inconclusive";
    const visible = domContainsControl(actionTrace.before, flow);
    return visible === undefined ? "inconclusive" : visible ? "pass" : "fail";
  }
  if (predicate.kind === "control_action") return actionPassed ? "pass" : "fail";
  if (predicate.kind === "observable_outcome") {
    if (!actionPassed) return "fail";
    const effect = flow.observableEffects.find((candidate) => candidate.id === predicate.subjectRef);
    if (!effect || effect.evidenceRef !== predicate.id) return "inconclusive";
    return evaluateObservableEffect({
      effect,
      flow,
      actionTrace,
      ...(reloadTrace ? { reloadTrace } : {}),
    });
  }
  if (predicate.kind === "state_transition") {
    if (!actionPassed) return "fail";
    const action = input.slice.contract.actions.find((candidate) => candidate.id === flow.actionRef);
    if (!action) return "inconclusive";
    if (predicate.assertion.operator === "passes") {
      return evaluateProducedPredicateSemanticsV1({
        predicate,
        action,
        persistencePolicies: input.slice.contract.persistencePolicies,
        inputValues: resolvedActionInputs(action, flow, actionTrace.before, input.slice),
        stateBefore: capturedStates(actionTrace.before, input.slice),
        stateAfterAction: capturedStates(actionTrace.after, input.slice),
        actionPassed,
        ...(input.runtimeAdapter ? { runtimeAdapter: input.runtimeAdapter } : {}),
      });
    }
    const expected = expectedActionValue(predicate, flow, actionTrace.before, input.slice);
    const beforeState = actionStatePayload(actionTrace.before, action, input.slice);
    const afterState = actionStatePayload(actionTrace.after, action, input.slice);
    if (beforeState === undefined || afterState === undefined) return "inconclusive";
    const actual = expected.path ? jsonPointer(afterState, expected.path) : afterState;
    const assertion = assertionVerdict(predicate.assertion.operator, actual, expected.value);
    if (assertion !== "pass") return assertion;
    return deepEqual(beforeState, afterState) ? "fail" : "pass";
  }
  if (predicate.kind === "persistence_round_trip") {
    const action = input.slice.contract.actions.find((candidate) => candidate.id === flow.actionRef);
    if (!action) return "inconclusive";
    if (predicate.assertion.operator === "passes") {
      return evaluateProducedPredicateSemanticsV1({
        predicate,
        action,
        persistencePolicies: input.slice.contract.persistencePolicies,
        inputValues: resolvedActionInputs(action, flow, actionTrace.before, input.slice),
        stateBefore: capturedStates(actionTrace.before, input.slice),
        stateAfterAction: capturedStates(actionTrace.after, input.slice),
        ...(reloadTrace ? { stateAfterReload: capturedStates(reloadTrace.after, input.slice) } : {}),
        actionPassed,
        ...(reloadTrace ? { reloadPassed: reloadTrace.result.status === "pass" } : {}),
        ...(input.runtimeAdapter ? { runtimeAdapter: input.runtimeAdapter } : {}),
      });
    }
    if (!actionPassed || !reloadTrace || reloadTrace.result.status !== "pass") return "fail";
    const expected = expectedActionValue(predicate, flow, actionTrace.before, input.slice);
    const afterAction = actionStatePayload(actionTrace.after, action, input.slice);
    const afterReload = actionStatePayload(reloadTrace.after, action, input.slice);
    if (afterAction === undefined || afterReload === undefined || !expected.path) return "inconclusive";
    const written = jsonPointer(afterAction, expected.path);
    const reloaded = jsonPointer(afterReload, expected.path);
    const actionVerdict = assertionVerdict(predicate.assertion.operator, written, expected.value);
    const reloadVerdict = assertionVerdict(predicate.assertion.operator, reloaded, expected.value);
    if (actionVerdict === "inconclusive" || reloadVerdict === "inconclusive") return "inconclusive";
    return actionVerdict === "pass" && reloadVerdict === "pass" ? "pass" : "fail";
  }
  if (predicate.kind === "navigation") {
    if (!actionPassed) return "fail";
    const action = input.slice.contract.actions.find((candidate) => candidate.id === flow.actionRef);
    const beforePath = pathname(actionTrace.before.url);
    const afterPath = pathname(actionTrace.after.url);
    if (!action || !beforePath || !afterPath) return "inconclusive";
    const navigation = action.navigation;
    if (navigation.kind === "stay") return beforePath === afterPath ? "pass" : "fail";
    if (navigation.kind === "route") {
      const route = input.slice.contract.routes.find((candidate) => candidate.id === navigation.routeRef);
      return route ? (afterPath === route.path ? "pass" : "fail") : "inconclusive";
    }
    if (navigation.kind === "external") {
      try {
        return new URL(actionTrace.after.url!).origin === new URL(navigation.url).origin ? "pass" : "fail";
      } catch {
        return "inconclusive";
      }
    }
    return "inconclusive";
  }
  if (predicate.kind === "runtime") return actionPassed ? "pass" : "fail";
  // download and visual need dedicated stack-owned adapters. Absence of such an
  // adapter is evidence-inconclusive, never proof that the product passed.
  return "inconclusive";
}

export function createCanonicalEvidenceBundleV2(input: Readonly<{
  runId: string;
  storyId: string;
  workdir: string;
  attemptId: string;
  sourceRevision: SourceRevisionV1;
  slice: ImplementationSliceV1;
  plan: EvidencePlanV1;
  execution: CanonicalEvidenceExecutionV1;
  startedAt: string;
  completedAt: string;
  runnerVersion?: string;
}>): CanonicalEvidenceResultV1 {
  const slice = ImplementationSliceV1Schema.parse(input.slice);
  const plan = EvidencePlanV1Schema.parse(input.plan);
  const expectedPlan = compileEvidencePlanV1({ slice, sliceHash: plan.sliceHash });
  if (
    slice.storyId !== input.storyId
    || plan.storyId !== input.storyId
    || plan.packetHash !== slice.packetHash
    || canonicalJsonStringify(plan) !== canonicalJsonStringify(expectedPlan)
  ) {
    throw new Error("CANONICAL_EVIDENCE_SLICE_PLAN_IDENTITY_MISMATCH");
  }

  const root = path.resolve(input.workdir);
  const evidenceRoot = path.join(root, ".setfarm", "evidence-v2", safeSegment(input.storyId), safeSegment(input.attemptId));
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const artifacts = new Map<string, Artifact>();
  const artifactPaths: string[] = [];
  const addBytes = (locator: string, bytes: Buffer | string, mediaType: string): string => {
    const normalized = locator.split(path.sep).join("/");
    const absolute = path.resolve(root, normalized);
    if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) throw new Error("EVIDENCE_ARTIFACT_PATH_ESCAPE");
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, bytes);
    const hash = sha256(bytes);
    if (!artifacts.has(hash)) artifacts.set(hash, { hash, mediaType, locator: normalized });
    artifactPaths.push(absolute);
    return hash;
  };
  const addExisting = (file: string | undefined, mediaType: string): string | undefined => {
    if (!file) return undefined;
    const absolute = path.resolve(file);
    if (!fs.existsSync(absolute) || (absolute !== root && !absolute.startsWith(`${root}${path.sep}`))) return undefined;
    const bytes = fs.readFileSync(absolute);
    const hash = sha256(bytes);
    const locator = path.relative(root, absolute).split(path.sep).join("/");
    if (!artifacts.has(hash)) artifacts.set(hash, { hash, mediaType, locator });
    return hash;
  };
  const captureHash = (capture: CapturedRuntimeState | undefined, key: string): string => {
    const screenshotHash = addExisting(capture?.screenshotPath, "image/png");
    const domHash = addExisting(capture?.domSnapshotPath, "application/json");
    const accessibilityHash = addExisting(capture?.accessibilitySnapshotPath, "application/json");
    const runtimeSnapshotHash = addExisting(capture?.runtimeSnapshotPath, "application/json");
    const payload = {
      schema: "setfarm.runtime-capture.v1",
      key,
      capturedAt: capture?.capturedAt ?? input.completedAt,
      url: capture?.url ?? null,
      stateBridge: capture?.stateBridge ?? null,
      screenshotHash: screenshotHash ?? null,
      domHash: domHash ?? null,
      accessibilityHash: accessibilityHash ?? null,
      runtimeSnapshotHash: runtimeSnapshotHash ?? null,
      unavailable: !capture,
    };
    const locator = path.relative(root, path.join(evidenceRoot, `capture-${safeSegment(key)}.json`));
    return addBytes(locator, `${canonicalJsonStringify(payload)}\n`, "application/json");
  };

  const commandObservations: EvidenceObservationDraftV2[] = [];
  const commandRefs = new Map<string, string>();
  for (const command of plan.commands) {
    const trace = input.execution.commands.find((candidate) => candidate.commandRef === command.commandRef);
    const startedAt = trace?.startedAt ?? input.startedAt;
    const completedAt = trace?.completedAt ?? input.completedAt;
    const stdoutHash = addBytes(
      path.relative(root, path.join(evidenceRoot, `command-${safeSegment(command.commandRef)}-stdout.txt`)),
      trace?.stdout ?? "COMMAND_NOT_EXECUTED\n",
      "text/plain",
    );
    const stderr = trace?.stderr ?? "";
    const stderrHash = stderr
      ? addBytes(
          path.relative(root, path.join(evidenceRoot, `command-${safeSegment(command.commandRef)}-stderr.txt`)),
          stderr,
          "text/plain",
        )
      : undefined;
    const observation: EvidenceObservationDraftV2 = {
      kind: "command",
      owner: "setfarm-orchestrator",
      commandRef: command.commandRef,
      exitCode: trace?.exitCode ?? 127,
      stdoutArtifactHash: stdoutHash,
      ...(stderrHash ? { stderrArtifactHash: stderrHash } : {}),
      startedAt,
      completedAt,
    };
    commandObservations.push(observation);
    commandRefs.set(command.commandRef, computeObservationRef(observation));
  }

  const tracePayload = {
    schema: "setfarm.canonical-runtime-trace.v1",
    planHash: plan.planHash,
    runtimeSessionId: input.execution.runtimeSessionId ?? null,
    runtimeError: input.execution.runtimeError ?? null,
    interactions: input.execution.interactions,
  };
  const runtimeArtifactHash = addBytes(
    path.relative(root, path.join(evidenceRoot, "runtime-trace.json")),
    `${canonicalJsonStringify(tracePayload)}\n`,
    "application/json",
  );

  const flowObservations: EvidenceObservationDraftV2[] = [];
  const observationRefsByFlow = new Map<string, string[]>();
  for (const flow of plan.flows) {
    const actionTrace = input.execution.interactions.find((trace) => trace.request.id === flow.actionInteractionId);
    const reloadTrace = flow.reloadInteractionId
      ? input.execution.interactions.find((trace) => trace.request.id === flow.reloadInteractionId)
      : undefined;
    const before = actionTrace?.before ?? input.execution.initialCapture;
    const terminal = reloadTrace?.after ?? actionTrace?.after ?? before;
    const beforeHash = captureHash(before, `${flow.flowId}-before`);
    const afterHash = captureHash(terminal, `${flow.flowId}-after`);
    const startedAt = actionTrace?.result.startedAt ?? input.startedAt;
    const completedAt = reloadTrace?.result.completedAt ?? actionTrace?.result.completedAt ?? input.completedAt;
    const drafts: EvidenceObservationDraftV2[] = [];
    if (flow.controlRef) {
      drafts.push({
        kind: "control",
        owner: "setfarm-orchestrator",
        actionRef: flow.actionRef,
        controlRef: flow.controlRef,
        beforeArtifactHash: beforeHash,
        afterArtifactHash: afterHash,
        startedAt,
        completedAt,
      });
    }
    drafts.push({
      kind: "runtime",
      owner: "setfarm-orchestrator",
      runtimeSessionId: input.execution.runtimeSessionId ?? "runtime-not-started",
      runtimeArtifactHash,
      stateBeforeHash: beforeHash,
      stateAfterHash: afterHash,
      startedAt,
      completedAt,
    });
    flowObservations.push(...drafts);
    observationRefsByFlow.set(flow.flowId, drafts.map(computeObservationRef).sort());
  }

  const candidateObservations = [...commandObservations, ...flowObservations];
  const productPredicates = slice.requiredEvidence.map((predicate) => {
    const flow = plan.flows.find((candidate) => candidate.predicateRefs.includes(predicate.id));
    const actionTrace = flow
      ? input.execution.interactions.find((trace) => trace.request.id === flow.actionInteractionId)
      : undefined;
    const reloadTrace = flow?.reloadInteractionId
      ? input.execution.interactions.find((trace) => trace.request.id === flow.reloadInteractionId)
      : undefined;
    const command = predicate.kind === "build" || predicate.kind === "test"
      ? plan.commands
          .filter((candidate) => candidate.kind === predicate.kind)
          .map((candidate) => input.execution.commands.find((trace) => trace.commandRef === candidate.commandRef))
          .find(Boolean)
      : undefined;
    const commandRef = predicate.kind === "build" || predicate.kind === "test"
      ? plan.commands.find((candidate) => candidate.kind === predicate.kind)?.commandRef
      : undefined;
    const refs = commandRef && commandRefs.has(commandRef)
      ? [commandRefs.get(commandRef)!]
      : flow
        ? observationRefsByFlow.get(flow.flowId) ?? []
        : [];
    if (refs.length === 0) throw new Error(`CANONICAL_EVIDENCE_OBSERVATION_MISSING:${predicate.id}`);
    return {
      invariantRef: invariantRef(predicate.kind),
      predicateRef: predicate.id,
      ...(flow ? { actionRef: flow.actionRef } : {}),
      ...(flow?.controlRef ? { controlRef: flow.controlRef } : {}),
      required: predicate.required,
      verdict: predicateVerdict({
        predicate,
        ...(flow ? { flow } : {}),
        ...(actionTrace ? { actionTrace } : {}),
        ...(reloadTrace ? { reloadTrace } : {}),
        ...(command ? { command } : {}),
        slice,
        ...(plan.runtime ? { runtimeAdapter: plan.runtime.adapter } : {}),
        ...(input.execution.runtimeError ? { runtimeError: input.execution.runtimeError } : {}),
      }),
      observationRefs: refs.sort(),
    };
  });
  const commandPredicates = plan.commands.map((command) => {
    const trace = input.execution.commands.find((candidate) => candidate.commandRef === command.commandRef);
    const observationRef = commandRefs.get(command.commandRef);
    if (!observationRef) throw new Error(`CANONICAL_COMMAND_OBSERVATION_MISSING:${command.commandRef}`);
    return {
      invariantRef: `INV_COMMAND_${command.kind.toUpperCase()}`,
      predicateRef: `EVID_COMMAND_${command.commandRef}`,
      required: true,
      verdict: trace ? (trace.exitCode === 0 ? "pass" as const : "fail" as const) : "inconclusive" as const,
      observationRefs: [observationRef],
    };
  });
  const predicates = [...productPredicates, ...commandPredicates];

  const bundle = createEvidenceBundleV2({
    runId: input.runId,
    storyId: input.storyId,
    packetHash: slice.packetHash,
    sliceHash: plan.sliceHash,
    sourceRevision: input.sourceRevision,
    attemptId: input.attemptId,
    predicates,
    observations: candidateObservations.filter((observation) => new Set(
      predicates.flatMap((predicate) => predicate.observationRefs),
    ).has(computeObservationRef(observation))),
    artifacts: [...artifacts.values()],
    runner: {
      id: "setfarm-canonical-evidence-runner",
      version: input.runnerVersion ?? "1.0.0",
      environmentHash: hashCanonicalJson({
        schema: "setfarm.evidence-runner-environment.v1",
        platform: process.platform,
        architecture: process.arch,
        node: process.version,
        planHash: plan.planHash,
      }),
    },
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  });
  const bundleHash = computeEvidenceBundleHash(bundle);
  const bundlePath = path.relative(root, path.join(evidenceRoot, "EVIDENCE_BUNDLE.json"));
  addBytes(bundlePath, `${canonicalJsonStringify(bundle)}\n`, "application/json");
  return { bundle, bundleHash, artifactPaths: [...new Set(artifactPaths)].sort() };
}
