import { z } from "zod";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { LegacyImplementationSliceV2Schema, type LegacyImplementationSliceV2 } from "../product-compiler/schemas/implementation-slice-v2-legacy.js";
import { ProductActionV2Schema } from "../product-compiler/schemas/product-spec-v2.js";
import { Sha256Schema, StoryIdSchema, hasUniqueStrings } from "../product-compiler/schemas/common-v1.js";
import { RuntimeEvidenceContractV1Schema } from "./runtime-evidence-contract-v1.js";
import { EvidencePlanInteractionV1Schema, EvidencePlanV1Schema } from "./evidence-plan-v1.js";
import { ControlSlotIdSchema } from "../product-compiler/schemas/common-v2.js";
import { DesignObservableBindingV2Schema } from "../product-compiler/schemas/design-interaction-graph-v2.js";
import { ImplementationControlSourceV1Schema, ImplementationActionInputSourceV1Schema, ImplementationObservableSourceV1Schema } from "../product-compiler/schemas/implementation-source-map-v1.js";
import { encodeActionInputValueV2 } from "../product-compiler/schemas/action-input-transport-v2.js";
import type { ProductActionV2, EvidencePredicateV2 } from "../product-compiler/schemas/product-spec-v2.js";

export const EvidencePlanInteractionV2Schema = z.union([EvidencePlanInteractionV1Schema,
  z.object({ id: z.string().min(1).max(500), action: z.literal("set_checked"), target: z.string().min(1).max(2_000),
    value: z.enum(["true", "false"]), timeoutMs: z.number().int().positive().max(300_000) }).strict()]);

const NativeFlowSchema = z.object({
  flowId: z.string().min(1).max(500),
  actionRef: z.string().min(1).max(500),
  controlRef: z.string().min(1).max(500).optional(),
  controlSlotRef: ControlSlotIdSchema.optional(),
  controlSource: ImplementationControlSourceV1Schema.optional(),
  inputSources: z.array(ImplementationActionInputSourceV1Schema).max(500).optional(),
  observableSources: z.array(ImplementationObservableSourceV1Schema).max(10_000).optional(),
  surfaceRefs: z.array(z.string().min(1).max(500)).max(2_000),
  preconditions: ProductActionV2Schema.shape.preconditions,
  scenario: ProductActionV2Schema.shape.evidenceScenario,
  inputBindings: EvidencePlanV1Schema.shape.flows.element.shape.inputBindings,
  predicateRefs: EvidencePlanV1Schema.shape.predicateRefs,
  observableEffects: ProductActionV2Schema.shape.observableEffects,
  observableBindings: z.array(DesignObservableBindingV2Schema).max(10_000),
  interactions: z.array(EvidencePlanInteractionV2Schema).min(1).max(1_000),
  actionInteractionId: z.string().min(1).max(500),
  reloadInteractionId: z.string().min(1).max(500).optional(),
}).strict();

export const EvidencePlanV2Schema = z.object({
  schema: z.literal("setfarm.evidence-plan.v2"),
  planHash: Sha256Schema,
  packetHash: Sha256Schema,
  sliceHash: Sha256Schema,
  storyId: StoryIdSchema,
  runtime: RuntimeEvidenceContractV1Schema.optional(),
  commands: EvidencePlanV1Schema.shape.commands,
  flows: z.array(NativeFlowSchema).min(1).max(5_000),
  predicateRefs: EvidencePlanV1Schema.shape.predicateRefs,
}).strict().superRefine((value, context) => {
  const { planHash, ...identity } = value;
  if (hashCanonicalJson(identity) !== planHash) context.addIssue({ code: "custom", path: ["planHash"], message: "Native plan hash must bind its exact payload" });
  if (!hasUniqueStrings(value.predicateRefs) || !hasUniqueStrings(value.flows.map(flow => flow.flowId))) {
    context.addIssue({ code: "custom", message: "Native plan predicate and flow identities must be unique" });
  }
  const covered = value.flows.flatMap(flow => flow.predicateRefs);
  if (value.predicateRefs.some(ref => !covered.includes(ref)) || covered.some(ref => !value.predicateRefs.includes(ref))) {
    context.addIssue({ code: "custom", path: ["predicateRefs"], message: "Native flows must cover exactly the required predicates" });
  }
  for (const [index, flow] of value.flows.entries()) {
    const ids = flow.interactions.map(interaction => interaction.id);
    if (!hasUniqueStrings(ids) || !ids.includes(flow.actionInteractionId) || (flow.reloadInteractionId && !ids.includes(flow.reloadInteractionId))) {
      context.addIssue({ code: "custom", path: ["flows", index], message: "Native flow interaction identities are incomplete or ambiguous" });
    }
  }
});

export type EvidencePlanV2 = z.infer<typeof EvidencePlanV2Schema>;

export function nativeSliceEnvelopeHash(slice: LegacyImplementationSliceV2): string {
  return hashCanonicalJson({ schema: "setfarm.semantic-artifact-envelope.v1", artifactType: "setfarm.implementation-slice.v2", producer: slice.producer, payload: slice });
}

function renderedFlows(slice: LegacyImplementationSliceV2, action: ProductActionV2, predicates: EvidencePredicateV2[]): EvidencePlanV2["flows"] {
  const design = slice.contract.design, runtime = slice.build.runtimeEvidenceContract;
  if (!design || !runtime || runtime.adapter !== "browser-service") throw Error(`EVIDENCE_PLAN_NATIVE_BROWSER_RUNTIME_MISSING:${action.id}`);
  const bindings = design.actions.filter(binding => binding.actionRef === action.id);
  if (bindings.length !== 1) throw Error(`EVIDENCE_PLAN_NATIVE_ACTION_BINDING_AMBIGUOUS:${action.id}`);
  const controls = design.controls.filter(control => control.identity.actionRef === action.id);
  if (action.trigger.kind === "user" && !controls.length) throw Error(`EVIDENCE_PLAN_NATIVE_PHYSICAL_CONTROL_MISSING:${action.id}`);
  const allControlSources = slice.storySourceMap.screens.flatMap(screen => screen.controls);
  const allInputSources = slice.storySourceMap.screens.flatMap(screen => screen.actionInputs);
  const allObservableSources = slice.storySourceMap.screens.flatMap(screen => screen.observables);
  const observableBindings = design.observables.filter(binding => binding.actionRef === action.id);
  const observableSources = allObservableSources.filter(source => source.actionRef === action.id);
  for (const effect of action.observableEffects) {
    if (!predicates.some(predicate => predicate.id === effect.evidenceRef)
      || observableBindings.filter(binding => binding.observableRef === effect.id && binding.evidenceRef === effect.evidenceRef).length !== 1
      || observableSources.filter(source => source.observableRef === effect.id && source.evidenceRef === effect.evidenceRef).length !== 1) {
      throw Error(`EVIDENCE_PLAN_NATIVE_OBSERVABLE_BINDING_AMBIGUOUS:${effect.id}`);
    }
  }
  return (controls.length ? controls : [undefined]).map(control => {
    const sources = control ? allControlSources.filter(source => source.physicalControlRef === control.id && source.controlSlotRef === control.identity.controlSlotRef) : [];
    if (control && sources.length !== 1) throw Error(`EVIDENCE_PLAN_NATIVE_CONTROL_SOURCE_AMBIGUOUS:${control.id}`);
    const source = sources[0];
    if (source && source.generatedSelector !== `[data-action-id="${source.generatedLocalId}"]`) throw Error(`EVIDENCE_PLAN_NATIVE_CONTROL_SELECTOR_UNSUPPORTED:${source.controlSlotRef}`);
    const flowId = `flow:${action.id}${control ? `:${control.identity.controlSlotRef}` : ""}`;
    const surface = slice.contract.product.surfaces.find(candidate => candidate.id === (source?.placement.surfaceRef ?? action.affectedSurfaceRefs[0]));
    const route = slice.contract.product.routes.find(candidate => candidate.id === surface?.routeRef);
    if (!route) throw Error(`EVIDENCE_PLAN_NATIVE_ROUTE_MISSING:${action.id}`);
    const interactions: EvidencePlanV2["flows"][number]["interactions"] = [
      { id: `reset:${flowId}`, action: "reset", timeoutMs: 30_000 },
      { id: `route:${flowId}`, action: "navigate", value: `__SETFARM_RUNTIME_URL__${route.path}`, timeoutMs: 30_000 },
      ...action.evidenceScenario.prerequisiteSteps.map((step, index) => ({
        id: `prerequisite:${flowId}:${String(index + 1).padStart(3, "0")}:${step.actionRef}`, action: "invoke" as const,
        target: step.actionRef, value: "action", inputValues: step.inputValues, timeoutMs: 30_000,
      })),
    ];
    const inputSources: z.infer<typeof ImplementationActionInputSourceV1Schema>[] = [];
    let actionInteractionId = `action:${flowId}`;
    for (const field of action.input.fields) {
      const transports = slice.actionInputTransports.filter(transport => transport.actionRef === action.id && transport.fieldRef === field.name);
      const candidates = allInputSources.filter(input => input.actionRef === action.id && input.inputField === field.name
        && (!source || input.actionHandlerIds.includes(source.generatedLocalId)));
      if (transports.length !== 1 || candidates.length !== 1) throw Error(`EVIDENCE_PLAN_NATIVE_INPUT_SOURCE_AMBIGUOUS:${action.id}.${field.name}`);
      const transport = transports[0]!, input = candidates[0]!;
      if (input.generatedSelector !== `[data-action-id="${input.generatedControlId}"]`) throw Error(`EVIDENCE_PLAN_NATIVE_INPUT_SELECTOR_UNSUPPORTED:${input.actionInputRef}`);
      const evidenceActions = [...new Set(transport.domRequirements.map(requirement => requirement.evidenceAction))];
      if (evidenceActions.length !== 1) throw Error(`EVIDENCE_PLAN_NATIVE_INPUT_OPERATION_AMBIGUOUS:${input.actionInputRef}`);
      const operation = evidenceActions[0]!;
      const encoded = encodeActionInputValueV2(transport, action.evidenceScenario.targetInputValues[field.name]);
      const id = `input:${flowId}:${field.name}`;
      if (operation === "set_checked") {
        if (encoded !== "true" && encoded !== "false") throw Error(`EVIDENCE_PLAN_NATIVE_CHECKED_VALUE_INVALID:${input.actionInputRef}`);
        interactions.push({ id, action: "set_checked", target: input.generatedSelector, value: encoded, timeoutMs: 30_000 });
      }
      else interactions.push({ id, action: operation, target: input.generatedSelector, value: encoded, timeoutMs: 30_000 });
      inputSources.push(input);
      if (source?.generatedSelector === input.generatedSelector && source.handlerBinding.event === "change") actionInteractionId = id;
    }
    if (!interactions.some(interaction => interaction.id === actionInteractionId)) interactions.push(source
      ? { id: actionInteractionId, action: "click", target: source.generatedSelector, timeoutMs: 30_000 }
      : { id: actionInteractionId, action: "invoke", target: action.id, value: "action", inputValues: action.evidenceScenario.targetInputValues, timeoutMs: 30_000 });
    const reloadRequired = action.observableEffects.some(effect => effect.assertions.some(assertion => assertion.phase === "reload"))
      || action.persistenceEffects.some(effect => effect.operation !== "read" && slice.contract.product.persistencePolicies.some(policy => policy.id === effect.policyRef && policy.durability === "reload"));
    const reloadInteractionId = reloadRequired ? `reload:${flowId}` : undefined;
    if (reloadInteractionId) interactions.push({ id: reloadInteractionId, action: "navigate", value: `__SETFARM_RUNTIME_URL__${route.path}`, timeoutMs: 30_000 });
    return { flowId, actionRef: action.id, ...(control && source ? { controlRef: control.id, controlSlotRef: control.identity.controlSlotRef, controlSource: source } : {}),
      inputSources, observableSources, surfaceRefs: [...action.affectedSurfaceRefs], preconditions: action.preconditions, scenario: action.evidenceScenario,
      inputBindings: action.input.fields.map(field => ({ inputField: field.name, valueFrom: { kind: "literal" as const, value: action.evidenceScenario.targetInputValues[field.name] } })),
      predicateRefs: predicates.map(predicate => predicate.id).sort(), observableEffects: action.observableEffects, observableBindings, interactions, actionInteractionId,
      ...(reloadInteractionId ? { reloadInteractionId } : {}) };
  });
}

/** Genuine PacketV3 compiler. No historical slice or selector is fabricated. */
export function compileEvidencePlanV2(input: Readonly<{ slice: LegacyImplementationSliceV2; sliceHash: string }>): EvidencePlanV2 {
  const slice = LegacyImplementationSliceV2Schema.parse(input.slice);
  if (nativeSliceEnvelopeHash(slice) !== input.sliceHash) throw Error("EVIDENCE_PLAN_NATIVE_SLICE_HASH_MISMATCH");
  const required = slice.contract.product.evidencePredicates.filter(predicate => predicate.required && slice.story.evidenceRefs.includes(predicate.id));
  const runtime = slice.build.runtimeEvidenceContract;
  const flows: EvidencePlanV2["flows"] = [];
  for (const action of slice.contract.product.actions) {
    const predicates = required.filter(predicate => action.evidenceRefs.includes(predicate.id));
    if (!predicates.length) continue;
    if (slice.contract.design !== null) { flows.push(...renderedFlows(slice, action, predicates)); continue; }
    if (!runtime || runtime.adapter === "browser-service") throw Error(`EVIDENCE_PLAN_NATIVE_INVOCATION_RUNTIME_MISSING:${action.id}`);
    const binding = runtime.actions.find(candidate => candidate.actionRef === action.id);
    if (!binding || canonicalJsonStringify(binding.inputValues) !== canonicalJsonStringify(action.evidenceScenario.targetInputValues)) {
      throw Error(`EVIDENCE_PLAN_NATIVE_RUNTIME_INPUT_MISMATCH:${action.id}`);
    }
    for (const effect of action.observableEffects) {
      if (!predicates.some(predicate => predicate.id === effect.evidenceRef)) throw Error(`EVIDENCE_PLAN_NATIVE_OBSERVABLE_PREDICATE_MISSING:${effect.id}`);
    }
    const interactions: EvidencePlanV2["flows"][number]["interactions"] = action.evidenceScenario.prerequisiteSteps.map((step, index) => {
      const prior = runtime.actions.find(candidate => candidate.actionRef === step.actionRef);
      if (!prior || canonicalJsonStringify(prior.inputValues) !== canonicalJsonStringify(step.inputValues)) throw Error(`EVIDENCE_PLAN_NATIVE_PREREQUISITE_MISMATCH:${step.actionRef}`);
      return { id: `prerequisite:${action.id}:${String(index + 1).padStart(3, "0")}:${step.actionRef}`, action: "invoke", target: step.actionRef, value: "action", inputValues: step.inputValues,
        timeoutMs: "command" in prior.action ? prior.action.command.timeoutMs : prior.action.timeoutMs };
    });
    const actionInteractionId = `action:${action.id}`;
    interactions.push({ id: actionInteractionId, action: "invoke", target: action.id, value: "action", inputValues: binding.inputValues,
      timeoutMs: "command" in binding.action ? binding.action.command.timeoutMs : binding.action.timeoutMs });
    const reloadInteractionId = binding.reload ? `reload:${action.id}` : undefined;
    if (action.observableEffects.some(effect => effect.assertions.some(assertion => assertion.phase === "reload")) && !reloadInteractionId) {
      throw Error(`EVIDENCE_PLAN_NATIVE_RELOAD_MISSING:${action.id}`);
    }
    if (binding.reload && reloadInteractionId) interactions.push({ id: reloadInteractionId, action: "invoke", target: action.id, value: "reload", inputValues: binding.inputValues,
      timeoutMs: "command" in binding.reload ? binding.reload.command.timeoutMs : binding.reload.timeoutMs });
    flows.push({ flowId: `flow:${action.id}`, actionRef: action.id, surfaceRefs: [...action.affectedSurfaceRefs], preconditions: action.preconditions, scenario: action.evidenceScenario,
      inputBindings: action.input.fields.map(field => ({ inputField: field.name, valueFrom: { kind: "literal", value: binding.inputValues[field.name] } })),
      predicateRefs: predicates.map(predicate => predicate.id).sort(), observableEffects: action.observableEffects, observableBindings: [], interactions, actionInteractionId,
      ...(reloadInteractionId ? { reloadInteractionId } : {}) });
  }
  const identity = {
    schema: "setfarm.evidence-plan.v2", packetHash: slice.packetHash, sliceHash: input.sliceHash, storyId: slice.storyId,
    ...(runtime ? { runtime } : {}),
    commands: slice.build.commands.filter(command => command.kind === "build" || command.kind === "test" || command.kind === "evidence")
      .map(command => ({ commandRef: command.id, kind: command.kind, argv: command.argv, cwd: command.cwd, timeoutMs: command.timeoutMs })),
    flows: flows.sort((left, right) => left.flowId < right.flowId ? -1 : left.flowId > right.flowId ? 1 : 0),
    predicateRefs: required.map(predicate => predicate.id).sort(),
  };
  return EvidencePlanV2Schema.parse({ ...identity, planHash: hashCanonicalJson(identity) });
}

export function flattenEvidencePlanInteractionsV2(plan: EvidencePlanV2) {
  return EvidencePlanV2Schema.parse(plan).flows.flatMap(flow => flow.interactions);
}
