import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { SourceRevisionV1Schema, type SourceRevisionV1 } from "../execution/schemas/execution-attempt-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import type { ImplementationSliceV1 } from "../product-compiler/schemas/implementation-slice-v1.js";
import { ImplementationSliceV1Schema } from "../product-compiler/schemas/implementation-slice-v1.js";
import { LegacyImplementationSliceV2Schema, type LegacyImplementationSliceV2 } from "../product-compiler/schemas/implementation-slice-v2-legacy.js";
import { EvidencePredicateV2Schema, type EvidencePredicateV2 } from "../product-compiler/schemas/product-spec-v2.js";
import { EvidencePredicateV1Schema } from "../product-compiler/schemas/product-spec-v1.js";
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
import { compileEvidencePlanV2, EvidencePlanV2Schema, type EvidencePlanV2 } from "./evidence-plan-v2.js";
import type { z } from "zod";
import { parseStitchSemanticDomV1 } from "../product-compiler/stitch-semantic-dom-v1.js";
import { encodeActionInputValueV2 } from "../product-compiler/schemas/action-input-transport-v2.js";

import {ClaimEnvelopeV1Schema,type ClaimEnvelopeV1} from "../execution/schemas/claim-envelope-v1.js";
import type {V3StoryClaimRuntimeSubjectV1} from "../execution/v3-story-claim-runtime-binding-v1.js";
export type SuperviseStageEvidenceIdentityV1=Readonly<{
  workflowStepId:"supervise";claimId:number;runtimeSessionId:string;requestId:string;ownerAttemptCount:number;
  outputHash:string;envelope:ClaimEnvelopeV1;boundSubject:V3StoryClaimRuntimeSubjectV1;sourceBefore:SourceRevisionV1;
}>;

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
type ActionStateSemantics = Pick<ProductActionV1, "preconditions" | "stateDeltas" | "persistenceEffects" | "input" | "success">;

export type ProducedPredicateSemanticInputV1 = Readonly<{
  predicate: EvidencePredicateV1;
  action: ActionStateSemantics;
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
  action: ActionStateSemantics,
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

function invariantRef(kind: Predicate["kind"] | EvidencePredicateV2["kind"]): string {
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
  action: ActionStateSemantics,
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
  action: ActionStateSemantics,
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
  action: ActionStateSemantics;
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
    if (beforeTarget === undefined || !deepEqual(beforeTarget, afterTarget)) observedExactChange = true;
  }
  return observedExactChange ? "pass" : "fail";
}

function exactDeltaTargetsPersisted(input: Readonly<{
  action: ActionStateSemantics;
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
  action: ActionStateSemantics,
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
  observableRefs?: readonly string[];
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
      && (value.observableRefs === undefined || (
        Array.isArray(value.observableRefs)
        && value.observableRefs.every((item) => typeof item === "string")
      ))
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
    const exactBinding = input.flow.observableBindings?.find((binding) =>
      binding.observableRef === input.effect.id
      && binding.target.kind === "accessibility");
    matches = exactBinding
      ? elements.filter((element) =>
          (element.observableRefs ?? []).includes(input.effect.id)
          && (element.containingSurfaceId ?? element.surfaceId) === selector.surfaceRef
          && element.role === selector.role
          && element.accessibleName === selector.name)
      : elements.filter((element) =>
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

function nativeInvocationValue(slice: LegacyImplementationSliceV2, actionRef: string, capture: CapturedRuntimeState | undefined): unknown {
  const action = slice.contract.product.actions.find(candidate => candidate.id === actionRef);
  if (!action || (action.invocationInterface.kind !== "cli_command" && action.invocationInterface.kind !== "http_request")) return undefined;
  const result = capture?.stateBridge?.result;
  return result === undefined ? undefined : jsonPointer(result, action.invocationInterface.result.valuePointer);
}

function nativeDom(capture: CapturedRuntimeState | undefined) {
  const file = capture?.domSnapshotPath;
  if (!file) return undefined;
  const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!isRecord(parsed) || parsed.schema !== "setfarm.browser-dom-observation.v1" || typeof parsed.rootHtml !== "string") return undefined;
  const observations = capturedDomElements(capture);
  return observations ? { observations, elements: parseStitchSemanticDomV1(parsed.rootHtml) } : undefined;
}

function nativePhysicalControl(capture: CapturedRuntimeState | undefined, flow: EvidencePlanV2["flows"][number]): boolean | undefined {
  const source = flow.controlSource, dom = nativeDom(capture);
  if (!source || !dom) return undefined;
  const elements = dom.elements.filter(element => element.attributes.get("data-action-id") === source.generatedLocalId);
  const observations = dom.observations.filter(element => sourceSelectors(element).includes(source.generatedSelector));
  if (elements.length !== 1 || observations.length !== 1) return false;
  const element = elements[0]!, observation = observations[0]!;
  return element.duplicateAttributes.length === 0 && element.attributes.get("data-setfarm-element-ref") === source.sourceElementRef
    && element.attributes.get("data-action") === source.actionRef && element.attributes.get("data-control-slot") === source.controlSlotRef
    && element.activeSurfaceRef === source.placement.surfaceRef && element.tagName === source.tagName
    && observation.containingSurfaceId === source.placement.surfaceRef && observation.visible && observation.enabled;
}

function nativeStates(capture: CapturedRuntimeState | undefined, slice: LegacyImplementationSliceV2): Readonly<Record<string, unknown>> {
  const bridge = capture?.stateBridge;
  if (!isRecord(bridge)) return {};
  if (slice.build.runtimeEvidenceContract?.adapter === "browser-service") {
    return bridge.schema === "setfarm.runtime-state-bridge.v1" && isRecord(bridge.states) ? bridge.states : {};
  }
  if (slice.contract.product.states.length === 1 && Object.hasOwn(bridge, "state")) return { [slice.contract.product.states[0]!.id]: bridge.state };
  return {};
}

function nativeRenderedValue(input: Readonly<{ slice: LegacyImplementationSliceV2; capture: CapturedRuntimeState | undefined; effect: EvidencePlanV2["flows"][number]["observableEffects"][number];
  flow: EvidencePlanV2["flows"][number]; property: ObservableActionEffectV1["assertions"][number]["property"] }>): unknown {
  const dom = nativeDom(input.capture), selector = input.effect.selector;
  if (!dom || selector.kind === "invocation_output") return undefined;
  const sources = input.flow.observableSources?.filter(source => source.observableRef === input.effect.id && source.evidenceRef === input.effect.evidenceRef) ?? [];
  const bindings = input.flow.observableBindings.filter(binding => binding.observableRef === input.effect.id && binding.evidenceRef === input.effect.evidenceRef);
  if (sources.length !== 1 || bindings.length !== 1) return undefined;
  const source = sources[0]!;
  const elements = dom.elements.filter(element => element.attributes.get("data-setfarm-element-ref") === source.sourceElementRef
    && (element.attributes.get("data-observable-refs") ?? "").split(/\s+/).includes(input.effect.id));
  const observations = dom.observations.filter(element => (element.observableRefs ?? []).includes(input.effect.id));
  if (elements.length !== 1 || observations.length !== 1) return undefined;
  const element = elements[0]!, observation = observations[0]!;
  if (element.duplicateAttributes.length) return undefined;
  if (selector.kind === "control") {
    if (element.attributes.get("data-control-slot") !== selector.controlSlotRef) return undefined;
    const expected = input.flow.observableBindings.find(binding => binding.observableRef === input.effect.id);
    if (expected?.selector.kind !== "control" || expected.selector.controlSlotRef !== selector.controlSlotRef) return undefined;
    // The observable selects its own slot, which need not be this flow's invoked
    // placement. Bind every observed phase to that slot's authenticated source.
    const controls = input.slice.contract.design?.controls.filter(control => control.identity.actionRef === input.flow.actionRef
      && control.identity.controlSlotRef === selector.controlSlotRef) ?? [];
    if (controls.length !== 1) return undefined;
    const controlSources = input.slice.storySourceMap.screens.flatMap(screen => screen.controls).filter(control =>
      control.physicalControlRef === controls[0]!.id && control.actionRef === input.flow.actionRef && control.controlSlotRef === selector.controlSlotRef);
    if (controlSources.length !== 1) return undefined;
    const controlSource = controlSources[0]!;
    if (source.sourceElementRef !== controlSource.sourceElementRef || element.activeSurfaceRef !== controlSource.placement.surfaceRef
      || observation.containingSurfaceId !== controlSource.placement.surfaceRef) return undefined;
  } else if (selector.kind === "surface") {
    if (element.attributes.get("data-surface-id") !== selector.surfaceRef || observation.surfaceId !== selector.surfaceRef) return undefined;
  } else if (element.activeSurfaceRef !== selector.surfaceRef || (observation.containingSurfaceId ?? observation.surfaceId) !== selector.surfaceRef
    || observation.role !== selector.role || observation.accessibleName !== selector.name) return undefined;
  if (input.property === "route") return pathname(input.capture?.url);
  if (input.property === "visible_text") return observation.visibleText;
  if (input.property === "value") return observation.value;
  if (input.property === "visibility") return observation.visible;
  return observation.enabled;
}

function nativeObservableVerdict(input: Readonly<{ slice: LegacyImplementationSliceV2; flow: EvidencePlanV2["flows"][number];
  effect: EvidencePlanV2["flows"][number]["observableEffects"][number]; actionTrace: CanonicalInteractionTraceV1; reloadTrace?: CanonicalInteractionTraceV1 }>): SemanticVerdict {
  const read = (capture: CapturedRuntimeState | undefined, property: ObservableActionEffectV1["assertions"][number]["property"]) => {
    const selector = input.effect.selector;
    if (selector.kind === "invocation_output") {
      const value = nativeInvocationValue(input.slice, input.flow.actionRef, capture);
      return value === undefined ? undefined : jsonPointer(value, selector.pointer);
    }
    return nativeRenderedValue({ slice: input.slice, capture, property, effect: input.effect, flow: input.flow });
  };
  let inconclusive = false;
  for (const assertion of input.effect.assertions) {
    const capture = assertion.phase === "before" ? input.actionTrace.before : assertion.phase === "after" ? input.actionTrace.after : input.reloadTrace?.after;
    const actual = read(capture, assertion.property);
    if (actual === undefined) { inconclusive = true; continue; }
    let verdict: SemanticVerdict;
    if (assertion.operator === "changed") {
      const before = read(input.actionTrace.before, assertion.property);
      verdict = before === undefined ? "inconclusive" : deepEqual(before, actual) ? "fail" : "pass";
    } else if (assertion.operator === "contains") verdict = typeof actual === "string" && typeof assertion.expected === "string" ? actual.includes(assertion.expected) ? "pass" : "fail" : "inconclusive";
    else if (assertion.operator === "matches") {
      try { verdict = typeof actual === "string" && typeof assertion.expected === "string" ? new RegExp(assertion.expected).test(actual) ? "pass" : "fail" : "inconclusive"; }
      catch { verdict = "inconclusive"; }
    } else verdict = deepEqual(actual, assertion.expected) ? "pass" : "fail";
    if (verdict === "fail") return "fail";
    if (verdict === "inconclusive") inconclusive = true;
  }
  return inconclusive ? "inconclusive" : "pass";
}

function nativeInputVerdict(slice: LegacyImplementationSliceV2, flow: EvidencePlanV2["flows"][number], traces: readonly CanonicalInteractionTraceV1[]): SemanticVerdict {
  for (const source of flow.inputSources ?? []) {
    const transports = slice.actionInputTransports.filter(transport => transport.actionInputRef === source.actionInputRef);
    if (transports.length !== 1) return "inconclusive";
    const transport = transports[0]!;
    const interaction = flow.interactions.find(candidate => candidate.id === `input:${flow.flowId}:${source.inputField}`);
    const trace = traces.find(candidate => candidate.request.id === interaction?.id);
    if (!interaction || !trace || trace.result.status !== "pass" || interaction.value !== encodeActionInputValueV2(transport, flow.scenario.targetInputValues[source.inputField])) return "fail";
    const dom = nativeDom(trace.before);
    if (!dom) return "inconclusive";
    const elements = dom.elements.filter(element => element.attributes.get("data-action-id") === source.generatedControlId);
    if (elements.length !== 1) return "fail";
    const element = elements[0]!;
    if (element.attributes.get("data-setfarm-element-ref") !== source.sourceElementRef
      || !(element.attributes.get("data-action-input") ?? "").split(/\s+/).includes(source.actionInputRef)
      || !transport.domRequirements.some(requirement => requirement.tagName === element.tagName
        && requirement.inputType === (element.tagName === "input" ? element.attributes.get("type") ?? "text" : null)
        && requirement.evidenceAction === interaction.action)) return "fail";
  }
  return "pass";
}

function nativePersistenceVerdict(input: Readonly<{ slice: LegacyImplementationSliceV2; action: ActionStateSemantics; predicate: EvidencePredicateV2;
  flow: EvidencePlanV2["flows"][number]; actionTrace: CanonicalInteractionTraceV1; reloadTrace?: CanonicalInteractionTraceV1 }>): SemanticVerdict {
  // Native V2 predicates identify the exact policy in subjectRef; they do not
  // contain V1's assertion.expected metadata. Read the genuine native action
  // effects/policy and reuse the existing state/delta engines directly.
  const policy = input.slice.contract.product.persistencePolicies.find(policy => policy.id === input.predicate.subjectRef);
  const effects = input.action.persistenceEffects.filter(effect => effect.policyRef === input.predicate.subjectRef && effect.operation !== "read");
  if (!policy || !effects.length) return "inconclusive";
  const before = nativeStates(input.actionTrace.before, input.slice), after = nativeStates(input.actionTrace.after, input.slice);
  for (const effect of effects) {
    const deltas = persistenceEffectDeltas(input.action, effect);
    if (!deltas) return "inconclusive";
    const changed = evaluateActionStateDeltas({ action: input.action, deltas, inputValues: input.flow.scenario.targetInputValues, stateBefore: before, stateAfter: after });
    if (changed !== "pass") return changed;
    if (policy.durability === "none" || policy.durability === "session") continue;
    if ((policy.durability === "restart" || policy.durability === "durable") && input.slice.build.runtimeEvidenceContract?.adapter === "browser-service") return "inconclusive";
    if (!input.reloadTrace || input.reloadTrace.result.status !== "pass") return "fail";
    const reloaded = nativeStates(input.reloadTrace.after, input.slice);
    const reloadDelta = evaluateActionStateDeltas({ action: input.action, deltas, inputValues: input.flow.scenario.targetInputValues, stateBefore: before, stateAfter: reloaded });
    if (reloadDelta !== "pass") return reloadDelta;
    const retained = exactDeltaTargetsPersisted({ action: input.action, deltas, inputValues: input.flow.scenario.targetInputValues, stateAfterAction: after, stateAfterReload: reloaded });
    if (retained !== "pass") return retained;
  }
  return "pass";
}

function nativePredicateVerdict(input: Readonly<{
  slice: LegacyImplementationSliceV2; plan: EvidencePlanV2; predicate: EvidencePredicateV2;
  flow?: EvidencePlanV2["flows"][number]; actionTrace?: CanonicalInteractionTraceV1; reloadTrace?: CanonicalInteractionTraceV1; runtimeError?: string;
  traces: readonly CanonicalInteractionTraceV1[];
}>): SemanticVerdict {
  const { slice, plan, predicate, flow, actionTrace, reloadTrace } = input;
  if (input.runtimeError || !flow || !actionTrace) return "inconclusive";
  const declared = flow.interactions.find(interaction => interaction.id === flow.actionInteractionId);
  if (!declared || !deepEqual(declared, actionTrace.request)) return "fail";
  if (actionTrace.result.status !== "pass") return "fail";
  for (const interaction of flow.interactions) {
    const trace = input.traces.find(candidate => candidate.request.id === interaction.id);
    if (!trace) return "inconclusive";
    if (!deepEqual(trace.request, interaction) || trace.result.status !== "pass") return "fail";
  }
  const action = slice.contract.product.actions.find(candidate => candidate.id === flow.actionRef);
  if (!action) return "inconclusive";
  const stateBefore = nativeStates(actionTrace.before, slice);
  const preconditions = evaluateActionPreconditions(action, stateBefore);
  if (preconditions !== "pass") return preconditions;
  const inputs = nativeInputVerdict(slice, flow, input.traces);
  if (inputs !== "pass") return inputs;
  if (predicate.kind === "control_visible" || predicate.kind === "control_action") {
    const physical = nativePhysicalControl(actionTrace.before, flow);
    return physical === undefined ? "inconclusive" : physical ? "pass" : "fail";
  }
  if (predicate.kind === "persistence_round_trip") return nativePersistenceVerdict({ slice, action, predicate, flow, actionTrace, ...(reloadTrace ? { reloadTrace } : {}) });
  if (predicate.kind === "state_transition") return evaluateProducedPredicateSemanticsV1({
    predicate: EvidencePredicateV1Schema.parse(predicate), action, persistencePolicies: slice.contract.product.persistencePolicies,
    inputValues: flow.scenario.targetInputValues, stateBefore, stateAfterAction: nativeStates(actionTrace.after, slice),
    ...(reloadTrace ? { stateAfterReload: nativeStates(reloadTrace.after, slice), reloadPassed: reloadTrace.result.status === "pass" } : {}),
    actionPassed: true, ...(plan.runtime ? { runtimeAdapter: plan.runtime.adapter } : {}),
  });
  if (predicate.kind === "navigation") {
    const before = pathname(actionTrace.before.url), after = pathname(actionTrace.after.url);
    if (!before || !after) return "inconclusive";
    if (action.navigation.kind === "stay") return before === after ? "pass" : "fail";
    if (action.navigation.kind === "route") return slice.contract.product.routes.find(route => action.navigation.kind === "route" && route.id === action.navigation.routeRef)?.path === after ? "pass" : "fail";
    if (action.navigation.kind === "external") {
      try { return new URL(actionTrace.after.url!).origin === new URL(action.navigation.url).origin ? "pass" : "fail"; } catch { return "inconclusive"; }
    }
    return "inconclusive";
  }
  if (predicate.kind === "runtime") return "pass";
  if (predicate.kind === "action_invocation") {
    if (plan.runtime?.adapter === "browser-service") {
      const beforeBridge = actionTrace.before.stateBridge, afterBridge = actionTrace.after.stateBridge;
      if (!beforeBridge || !afterBridge || beforeBridge.schema !== "setfarm.runtime-state-bridge.v1" || afterBridge.schema !== "setfarm.runtime-state-bridge.v1"
        || beforeBridge.globalName !== plan.runtime.capture.globalName || afterBridge.globalName !== plan.runtime.capture.globalName
        || !Array.isArray(beforeBridge.missingStateRefs) || beforeBridge.missingStateRefs.length
        || !Array.isArray(afterBridge.missingStateRefs) || afterBridge.missingStateRefs.length) return "inconclusive";
      if (action.invocationInterface.kind === "rendered_control") {
        const physical = nativePhysicalControl(actionTrace.before, flow);
        if (physical !== true || !flow.controlSource || flow.controlSource.actionRef !== action.id
          || declared.target !== flow.controlSource.generatedSelector
          || (flow.controlSource.handlerBinding.event === "click" ? declared.action !== "click" : !["fill", "select", "set_checked"].includes(declared.action))) return physical === undefined ? "inconclusive" : "fail";
      } else if (action.invocationInterface.kind === "route_entry") {
        if (declared.action !== "invoke" || declared.target !== action.id || declared.value !== "action") return "fail";
      } else return "fail";
      if (action.stateDeltas.length) return evaluateActionStateDeltas({ action, inputValues: flow.scenario.targetInputValues, stateBefore,
        stateAfter: nativeStates(actionTrace.after, slice) });
      const outcomes = flow.observableEffects.map(effect => nativeObservableVerdict({ slice, flow, effect, actionTrace, ...(reloadTrace ? { reloadTrace } : {}) }));
      return outcomes.some(verdict => verdict === "fail") ? "fail" : outcomes.length && outcomes.every(verdict => verdict === "pass") ? "pass" : "inconclusive";
    }
    if (nativeInvocationValue(slice, flow.actionRef, actionTrace.after) === undefined) return "fail";
    const snapshotPath = actionTrace.after.runtimeSnapshotPath;
    if (!snapshotPath) return "inconclusive";
    const snapshot: unknown = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    if (!isRecord(snapshot) || snapshot.captureOk !== true || typeof snapshot.raw !== "string") return "fail";
    const runtime = plan.runtime;
    if (!runtime) return "inconclusive";
    const binding = runtime.actions.find(candidate => candidate.actionRef === flow.actionRef);
    if (!binding || snapshot.adapter !== runtime.adapter || !deepEqual(snapshot.parsed, actionTrace.after.stateBridge?.result)) return "fail";
    if (runtime.adapter === "cli-process" && "command" in binding.action && action.invocationInterface.kind === "cli_command") {
      return deepEqual(snapshot.argv, binding.action.command.argv) && typeof snapshot.exitCode === "number"
        && action.invocationInterface.result.successExitCodes.includes(snapshot.exitCode) ? "pass" : "fail";
    }
    if (runtime.adapter === "http-service" && "method" in binding.action && action.invocationInterface.kind === "http_request") {
      return typeof snapshot.status === "number" && action.invocationInterface.result.successStatusCodes.includes(snapshot.status) ? "pass" : "fail";
    }
    return "fail";
  }
  if (predicate.kind === "observable_outcome") {
    const effect = flow.observableEffects.find(candidate => candidate.id === predicate.subjectRef && candidate.evidenceRef === predicate.id);
    return effect ? nativeObservableVerdict({ slice, flow, effect, actionTrace, ...(reloadTrace ? { reloadTrace } : {}) }) : "inconclusive";
  }
  return "inconclusive";
}

export function createCanonicalEvidenceBundleV2(input: Readonly<{
  runId: string;
  storyId: string;
  workdir: string;
  sourceRevision: SourceRevisionV1;
  slice: ImplementationSliceV1 | LegacyImplementationSliceV2;
  plan: EvidencePlanV1 | EvidencePlanV2;
  execution: CanonicalEvidenceExecutionV1;
  startedAt: string;
  completedAt: string;
  runnerVersion?: string;
}&({attemptId:string;stageClaim?:never}|{stageClaim:SuperviseStageEvidenceIdentityV1;attemptId?:never})>): CanonicalEvidenceResultV1 {
  const slice = input.slice.schema === "setfarm.implementation-slice.v2" ? LegacyImplementationSliceV2Schema.parse(input.slice) : ImplementationSliceV1Schema.parse(input.slice);
  const plan = input.plan.schema === "setfarm.evidence-plan.v2" ? EvidencePlanV2Schema.parse(input.plan) : EvidencePlanV1Schema.parse(input.plan);
  if ((slice.schema === "setfarm.implementation-slice.v2") !== (plan.schema === "setfarm.evidence-plan.v2")) throw Error("CANONICAL_EVIDENCE_NATIVE_DOMAIN_MISMATCH");
  const expectedPlan = slice.schema === "setfarm.implementation-slice.v2" ? compileEvidencePlanV2({ slice, sliceHash: plan.sliceHash }) : compileEvidencePlanV1({ slice, sliceHash: plan.sliceHash });
  if (
    slice.storyId !== input.storyId
    || plan.storyId !== input.storyId
    || plan.packetHash !== slice.packetHash
    || canonicalJsonStringify(plan) !== canonicalJsonStringify(expectedPlan)
  ) {
    throw new Error("CANONICAL_EVIDENCE_SLICE_PLAN_IDENTITY_MISMATCH");
  }
  if (slice.schema === "setfarm.implementation-slice.v2" && plan.schema === "setfarm.evidence-plan.v2") {
    SourceRevisionV1Schema.parse(input.sourceRevision);
    const declared = new Map(plan.flows.flatMap(flow => flow.interactions.map(interaction => [interaction.id, interaction] as const)));
    const seen = new Set<string>();
    const start = Date.parse(input.startedAt), end = Date.parse(input.completedAt);
    const time = (stamp: string) => { const value = Date.parse(stamp); if (!Number.isFinite(value) || value < start || value > end) throw Error("CANONICAL_EVIDENCE_NATIVE_TIME_FENCE_MISMATCH"); };
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw Error("CANONICAL_EVIDENCE_NATIVE_TIME_FENCE_MISMATCH");
    for (const trace of input.execution.interactions) {
      const id = trace.request.id;
      if (!id || seen.has(id) || !deepEqual(declared.get(id), trace.request) || trace.result.id !== id || trace.result.action !== trace.request.action) throw Error("CANONICAL_EVIDENCE_NATIVE_TRACE_IDENTITY_MISMATCH");
      seen.add(id); time(trace.result.startedAt); time(trace.result.completedAt); time(trace.before.capturedAt); time(trace.after.capturedAt);
    }
    const commandRefs = new Set<string>();
    for (const command of input.execution.commands) {
      if (commandRefs.has(command.commandRef) || !plan.commands.some(declared => declared.commandRef === command.commandRef)) throw Error("CANONICAL_EVIDENCE_NATIVE_COMMAND_IDENTITY_MISMATCH");
      commandRefs.add(command.commandRef); time(command.startedAt); time(command.completedAt);
    }
  }

  const stage=input.stageClaim;
  if(stage){
    const envelope=ClaimEnvelopeV1Schema.parse(stage.envelope),fail=():never=>{throw Error("STAGE_EVIDENCE_IDENTITY_OR_FRESHNESS_REFUSED");};
    if(input.attemptId!==undefined||stage.workflowStepId!=="supervise"||envelope.workflowStepId!=="supervise"||envelope.protocol!=="v3"||envelope.attempt
      ||envelope.claimId!==stage.claimId||envelope.runId!==input.runId||envelope.workdir!==input.workdir
      ||!/^RTS_[A-Za-z0-9-]+$/.test(stage.runtimeSessionId)||!/^RCR_[A-Za-z0-9-]+$/.test(stage.requestId)
      ||!Number.isSafeInteger(stage.ownerAttemptCount)||stage.ownerAttemptCount<1||!/^[a-f0-9]{64}$/.test(stage.outputHash)
      ||(stage.boundSubject.kind!=="story_member"&&stage.boundSubject.kind!=="final_product")
      ||(stage.boundSubject.kind==="story_member"&&stage.boundSubject.storyId!==input.storyId))fail();
    const start=Date.parse(input.startedAt),end=Date.parse(input.completedAt);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start>end||Date.parse(envelope.issuedAt)>start)fail();
    const time=(value:string)=>{const t=Date.parse(value);if(!Number.isFinite(t)||t<start||t>end)fail();};
    for(const command of input.execution.commands){time(command.startedAt);time(command.completedAt);if(Date.parse(command.startedAt)>Date.parse(command.completedAt))fail();}
    if(input.execution.initialCapture)time(input.execution.initialCapture.capturedAt);
    for(const trace of input.execution.interactions){time(trace.result.startedAt);time(trace.result.completedAt);time(trace.before.capturedAt);time(trace.after.capturedAt);
      if(Date.parse(trace.result.startedAt)>Date.parse(trace.result.completedAt))fail();}
  }
  const root = path.resolve(input.workdir);
  const evidenceRoot = path.join(root, ".setfarm", "evidence-v2", safeSegment(input.storyId), safeSegment(stage?`stage-claim-${stage.claimId}-${stage.runtimeSessionId}-${stage.requestId}-owner-${stage.ownerAttemptCount}`:input.attemptId!));
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
  if (slice.schema === "setfarm.implementation-slice.v2") addBytes(path.relative(root, path.join(evidenceRoot, "NATIVE_CONTRACT_BINDING.json")), canonicalJsonStringify({
    schema: "setfarm.native-evidence-contract-binding.v2", producer: slice.producer, packetHash: slice.packetHash,
    sliceHash: plan.sliceHash, planHash: plan.planHash, sourceBefore: slice.sourceRevision, sourceAfter: input.sourceRevision,
    ...(input.attemptId ? { attemptId: input.attemptId } : {}),
  }) + "\n", "application/json");
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

  if(stage)addBytes(path.relative(root,path.join(evidenceRoot,"STAGE_CLAIM_BINDING.json")),canonicalJsonStringify({
    ...stage,sourceAfter:input.sourceRevision,sliceHash:plan.sliceHash,planHash:plan.planHash,
  })+"\n","application/json");
  const candidateObservations = [...commandObservations, ...flowObservations];
  const requiredPredicates = slice.schema === "setfarm.implementation-slice.v2"
    ? slice.contract.product.evidencePredicates.filter(predicate => predicate.required && slice.story.evidenceRefs.includes(predicate.id))
    : slice.requiredEvidence;
  const productPredicates = requiredPredicates.map((predicate) => {
    const nativeEvaluations = slice.schema === "setfarm.implementation-slice.v2" && plan.schema === "setfarm.evidence-plan.v2"
      ? plan.flows.filter(candidate => candidate.predicateRefs.includes(predicate.id)).map(nativeFlow => {
          const actionTrace = input.execution.interactions.find(trace => trace.request.id === nativeFlow.actionInteractionId);
          const reloadTrace = nativeFlow.reloadInteractionId ? input.execution.interactions.find(trace => trace.request.id === nativeFlow.reloadInteractionId) : undefined;
          return { flow: nativeFlow, verdict: nativePredicateVerdict({ slice, plan, predicate: EvidencePredicateV2Schema.parse(predicate),
            traces: input.execution.interactions, flow: nativeFlow, ...(actionTrace ? { actionTrace } : {}), ...(reloadTrace ? { reloadTrace } : {}),
            ...(input.execution.runtimeError ? { runtimeError: input.execution.runtimeError } : {}) }) };
        })
      : undefined;
    const nonPassing = nativeEvaluations?.filter(evaluation => evaluation.verdict !== "pass") ?? [];
    const identityFlows = (nonPassing.length ? nonPassing : nativeEvaluations ?? []).map(evaluation => evaluation.flow);
    const actionRefs = [...new Set(identityFlows.map(flow => flow.actionRef))];
    const physicalRefs = identityFlows.map(flow => flow.controlRef);
    const controlRefs = [...new Set(physicalRefs.filter((ref): ref is string => ref !== undefined))];
    const nativeVerdict: SemanticVerdict = nativeEvaluations?.some(evaluation => evaluation.verdict === "fail") ? "fail"
      : nativeEvaluations?.length && nativeEvaluations.every(evaluation => evaluation.verdict === "pass") ? "pass" : "inconclusive";
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
      : nativeEvaluations
        ? [...new Set(nativeEvaluations.flatMap(evaluation => observationRefsByFlow.get(evaluation.flow.flowId) ?? []))]
      : flow
        ? observationRefsByFlow.get(flow.flowId) ?? []
        : [];
    if (refs.length === 0) throw new Error(`CANONICAL_EVIDENCE_OBSERVATION_MISSING:${predicate.id}`);
    return {
      invariantRef: invariantRef(predicate.kind),
      predicateRef: predicate.id,
      ...(nativeEvaluations ? {
        ...(actionRefs.length === 1 ? { actionRef: actionRefs[0]! } : {}),
        ...(controlRefs.length === 1 && physicalRefs.every(ref => ref !== undefined) ? { controlRef: controlRefs[0]! } : {}),
      } : { ...(flow ? { actionRef: flow.actionRef } : {}), ...(flow?.controlRef ? { controlRef: flow.controlRef } : {}) }),
      required: predicate.required,
      verdict: nativeEvaluations ? nativeVerdict : predicateVerdict({
        predicate: EvidencePredicateV1Schema.parse(predicate),
        flow: EvidencePlanV1Schema.parse(plan).flows.find(candidate => candidate.predicateRefs.includes(predicate.id)),
        ...(actionTrace ? { actionTrace } : {}),
        ...(reloadTrace ? { reloadTrace } : {}),
        ...(command ? { command } : {}),
        slice: ImplementationSliceV1Schema.parse(slice),
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
    ...(stage?{}:{attemptId:input.attemptId!}),
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
