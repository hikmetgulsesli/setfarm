import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { ImplementationSliceV1Schema, type ImplementationSliceV1 } from "../product-compiler/schemas/implementation-slice-v1.js";
import {
  ActionIdSchema,
  ControlIdSchema,
  EvidenceIdSchema,
  Sha256Schema,
  StateIdSchema,
  StoryIdSchema,
  hasUniqueStrings,
} from "../product-compiler/schemas/common-v1.js";
import { RuntimeEvidenceContractV1Schema } from "./runtime-evidence-contract-v1.js";
import { ObservableActionEffectV1Schema } from "../product-compiler/schemas/product-spec-v1.js";

const RuntimeUrlTokenSchema = z.string().regex(/^__SETFARM_RUNTIME_URL__(?:\/[^\s]*)?$/);

export const EvidencePlanInteractionV1Schema = z.object({
  id: z.string().min(1).max(500),
  action: z.enum(["click", "fill", "press", "select", "wait", "navigate", "snapshot", "invoke", "reset"]),
  target: z.string().min(1).max(2_000).optional(),
  value: z.string().max(4_000).optional(),
  inputValues: z.record(z.string().min(1).max(160), z.json()).optional(),
  timeoutMs: z.number().int().positive().max(300_000),
}).strict().superRefine((value, context) => {
  if (["click", "fill", "press", "select"].includes(value.action) && !value.target) {
    context.addIssue({ code: "custom", path: ["target"], message: `${value.action} requires an exact control selector` });
  }
  if (value.action === "select" && value.value === undefined) {
    context.addIssue({ code: "custom", path: ["value"], message: "select requires one exact option value" });
  }
  if (value.action === "navigate" && (!value.value || !RuntimeUrlTokenSchema.safeParse(value.value).success)) {
    context.addIssue({ code: "custom", path: ["value"], message: "navigate requires the orchestrator runtime URL token" });
  }
  if (
    value.action === "invoke"
    && (!value.target || !ActionIdSchema.safeParse(value.target).success || !["action", "reload"].includes(value.value ?? ""))
  ) {
    context.addIssue({
      code: "custom",
      path: ["target"],
      message: "invoke requires an exact action reference and action/reload phase",
    });
  }
  if (value.action === "reset" && (value.target || value.value || value.inputValues)) {
    context.addIssue({ code: "custom", path: ["action"], message: "reset cannot carry target, value, or inputs" });
  }
}).transform((value) => value);

const EvidencePlanPreconditionV1Schema = z.object({
  stateRef: StateIdSchema,
  path: z.string().max(500).refine((value) => value === "" || value.startsWith("/")),
  operator: z.enum(["equals", "not_equals", "exists", "not_exists", "truthy", "falsy"]),
  expected: z.json().optional(),
}).strict();

const EvidencePlanScenarioV1Schema = z.object({
  targetInputValues: z.record(z.string().min(1).max(160), z.json()),
  prerequisiteSteps: z.array(z.object({
    actionRef: ActionIdSchema,
    inputValues: z.record(z.string().min(1).max(160), z.json()),
  }).strict()).max(100),
}).strict();

const EvidencePlanFlowV1Schema = z.object({
  flowId: z.string().min(1).max(500),
  actionRef: ActionIdSchema,
  controlRef: ControlIdSchema.optional(),
  preconditions: z.array(EvidencePlanPreconditionV1Schema).max(500),
  scenario: EvidencePlanScenarioV1Schema,
  inputBindings: z.array(z.object({
    inputField: z.string().min(1).max(160),
    valueFrom: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("control_value"),
        controlRef: ControlIdSchema,
        testValue: z.json(),
      }).strict(),
      z.object({
        kind: z.literal("state"),
        stateRef: z.string().regex(/^STATE_[A-Z0-9]+(?:_[A-Z0-9]+)*$/),
        path: z.string().max(500).refine((value) => value === "" || value.startsWith("/")),
      }).strict(),
      z.object({ kind: z.literal("literal"), value: z.json() }).strict(),
    ]),
  }).strict()).max(500),
  predicateRefs: z.array(EvidenceIdSchema).min(1).max(5_000),
  observableEffects: z.array(ObservableActionEffectV1Schema).max(1_000),
  interactions: z.array(EvidencePlanInteractionV1Schema).min(1).max(1_000),
  actionInteractionId: z.string().min(1).max(500),
  reloadInteractionId: z.string().min(1).max(500).optional(),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.predicateRefs)) {
    context.addIssue({ code: "custom", path: ["predicateRefs"], message: "Flow predicate refs must be unique" });
  }
  if (!hasUniqueStrings(value.interactions.map((interaction) => interaction.id))) {
    context.addIssue({ code: "custom", path: ["interactions"], message: "Flow interaction IDs must be unique" });
  }
  if (!hasUniqueStrings(value.inputBindings.map((binding) => binding.inputField))) {
    context.addIssue({ code: "custom", path: ["inputBindings"], message: "Flow input bindings must be unique by field" });
  }
  if (!value.interactions.some((interaction) => interaction.id === value.actionInteractionId)) {
    context.addIssue({ code: "custom", path: ["actionInteractionId"], message: "Action interaction must exist in the flow" });
  }
  if (value.reloadInteractionId && !value.interactions.some((interaction) => interaction.id === value.reloadInteractionId)) {
    context.addIssue({ code: "custom", path: ["reloadInteractionId"], message: "Reload interaction must exist in the flow" });
  }
});

export const EvidencePlanV1Schema = z.object({
  schema: z.literal("setfarm.evidence-plan.v1"),
  planHash: Sha256Schema,
  packetHash: Sha256Schema,
  sliceHash: Sha256Schema,
  storyId: StoryIdSchema,
  runtime: RuntimeEvidenceContractV1Schema.optional(),
  commands: z.array(z.object({
    commandRef: z.string().regex(/^CMD_[A-Z0-9]+(?:_[A-Z0-9]+)*$/),
    kind: z.enum(["build", "test", "evidence"]),
    argv: z.array(z.string().min(1).max(1_000)).min(1).max(100),
    cwd: z.string().min(1).max(1_024),
    timeoutMs: z.number().int().positive().max(86_400_000),
  }).strict()).max(1_000),
  flows: z.array(EvidencePlanFlowV1Schema).min(1).max(5_000),
  predicateRefs: z.array(EvidenceIdSchema).min(1).max(5_000),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.predicateRefs)) {
    context.addIssue({ code: "custom", path: ["predicateRefs"], message: "Plan predicate refs must be unique" });
  }
  if (!hasUniqueStrings(value.flows.map((flow) => flow.flowId))) {
    context.addIssue({ code: "custom", path: ["flows"], message: "Evidence flow IDs must be unique" });
  }
  const covered = new Set(value.flows.flatMap((flow) => flow.predicateRefs));
  value.predicateRefs.forEach((reference, index) => {
    if (!covered.has(reference)) {
      context.addIssue({ code: "custom", path: ["predicateRefs", index], message: `Required predicate has no exact flow: ${reference}` });
    }
  });
  const { planHash: _planHash, ...identity } = value;
  if (value.planHash !== hashCanonicalJson(identity)) {
    context.addIssue({ code: "custom", path: ["planHash"], message: "Evidence plan hash must bind the exact plan" });
  }
});

export type EvidencePlanV1 = z.infer<typeof EvidencePlanV1Schema>;

function sourceSelector(control: ImplementationSliceV1["contract"]["controls"][number]): string {
  // The canonical controlRef is a compiler identity, not necessarily a DOM
  // attribute. The sealed design graph already carries the exact selector
  // emitted by the deterministic converter; evidence must execute that source
  // identity instead of inventing a second selector namespace.
  if (!control.source.selector.trim()) {
    throw new Error(`EVIDENCE_PLAN_CONTROL_SELECTOR_MISSING:${control.id}`);
  }
  return control.source.selector;
}

function interactionValue(value: unknown): string {
  return typeof value === "string" ? value : canonicalJsonStringify(value);
}

function runtimeUrl(pathname: string): string {
  if (pathname === "/") return "__SETFARM_RUNTIME_URL__/";
  return `__SETFARM_RUNTIME_URL__${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function canonical<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort();
}

export function compileEvidencePlanV1(input: Readonly<{
  slice: ImplementationSliceV1;
  sliceHash: string;
}>): EvidencePlanV1 {
  const slice = ImplementationSliceV1Schema.parse(input.slice);
  const bindingByAction = new Map(slice.contract.bindings
    .filter((binding) => binding.disposition === "action")
    .map((binding) => [binding.actionRef, binding]));
  const bindingByControl = new Map(slice.contract.bindings.map((binding) => [binding.controlRef, binding]));
  const controlById = new Map(slice.contract.controls.map((control) => [control.id, control]));
  const routeBySurface = new Map(slice.contract.surfaces.map((surface) => [surface.id, surface.routeRef]));
  const routeById = new Map(slice.contract.routes.map((route) => [route.id, route]));
  const predicatesByAction = new Map<string, typeof slice.requiredEvidence>();
  for (const predicate of slice.requiredEvidence) {
    const action = slice.contract.actions.find((candidate) =>
      candidate.id === predicate.subjectRef || candidate.evidenceRefs.includes(predicate.id));
    if (!action) throw new Error(`EVIDENCE_PLAN_ACTION_MISSING:${predicate.id}`);
    const entries = predicatesByAction.get(action.id) ?? [];
    entries.push(predicate);
    predicatesByAction.set(action.id, entries);
  }

  const flows = slice.contract.actions
    .filter((action) => predicatesByAction.has(action.id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((action) => {
      const predicates = predicatesByAction.get(action.id)!;
      const observableEffects = action.observableEffects ?? [];
      observableEffects.forEach((effect) => {
        if (!predicates.some((predicate) => predicate.id === effect.evidenceRef)) {
          throw new Error(`EVIDENCE_PLAN_OBSERVABLE_PREDICATE_MISSING:${action.id}:${effect.id}`);
        }
      });
      const observableReloadRequired = observableEffects.some((effect) =>
        effect.assertions.some((assertion) => assertion.phase === "reload"));
      const invocationRuntime = slice.runtimeEvidence?.adapter === "cli-process"
        || slice.runtimeEvidence?.adapter === "http-service"
        ? slice.runtimeEvidence
        : undefined;
      const runtimeBinding = invocationRuntime?.actions.find((binding) => binding.actionRef === action.id);
      if (invocationRuntime) {
        if (!runtimeBinding) throw new Error(`EVIDENCE_PLAN_RUNTIME_ACTION_MISSING:${action.id}`);
        const inputBindings: z.input<typeof EvidencePlanFlowV1Schema>["inputBindings"] = action.input.fields.map((field) => {
          if (!Object.prototype.hasOwnProperty.call(runtimeBinding.inputValues, field.name)) {
            throw new Error(`EVIDENCE_PLAN_RUNTIME_INPUT_MISSING:${action.id}:${field.name}`);
          }
          return {
            inputField: field.name,
            valueFrom: { kind: "literal" as const, value: runtimeBinding.inputValues[field.name] },
          };
        });
        const actionInteractionId = `action:${action.id}`;
        const reloadInteractionId = runtimeBinding.reload ? `reload:${action.id}` : undefined;
        if (observableReloadRequired && !reloadInteractionId) {
          throw new Error(`EVIDENCE_PLAN_OBSERVABLE_RELOAD_MISSING:${action.id}`);
        }
        const actionTimeoutMs = "command" in runtimeBinding.action
          ? runtimeBinding.action.command.timeoutMs
          : runtimeBinding.action.timeoutMs;
        const reloadTimeoutMs = runtimeBinding.reload
          ? "command" in runtimeBinding.reload
            ? runtimeBinding.reload.command.timeoutMs
            : runtimeBinding.reload.timeoutMs
          : undefined;
        const prerequisiteInteractions = action.evidenceScenario.prerequisiteSteps.map((step, index) => {
          const prerequisiteBinding = invocationRuntime.actions.find((binding) => binding.actionRef === step.actionRef);
          if (!prerequisiteBinding) {
            throw new Error(`EVIDENCE_PLAN_RUNTIME_PREREQUISITE_MISSING:${action.id}:${step.actionRef}`);
          }
          if (canonicalJsonStringify(prerequisiteBinding.inputValues) !== canonicalJsonStringify(step.inputValues)) {
            throw new Error(`EVIDENCE_PLAN_RUNTIME_PREREQUISITE_INPUT_MISMATCH:${action.id}:${step.actionRef}`);
          }
          const timeoutMs = "command" in prerequisiteBinding.action
            ? prerequisiteBinding.action.command.timeoutMs
            : prerequisiteBinding.action.timeoutMs;
          return {
            id: `prerequisite:${action.id}:${String(index + 1).padStart(3, "0")}:${step.actionRef}`,
            action: "invoke" as const,
            target: step.actionRef,
            value: "action",
            inputValues: step.inputValues,
            timeoutMs,
          };
        });
        return {
          flowId: `flow:${action.id}`,
          actionRef: action.id,
          preconditions: action.preconditions,
          scenario: action.evidenceScenario,
          inputBindings,
          predicateRefs: canonical(predicates.map((predicate) => predicate.id)),
          observableEffects,
          interactions: [
            ...prerequisiteInteractions,
            {
              id: actionInteractionId,
              action: "invoke" as const,
              target: action.id,
              value: "action",
              inputValues: runtimeBinding.inputValues,
              timeoutMs: actionTimeoutMs,
            },
            ...(reloadInteractionId ? [{
              id: reloadInteractionId,
              action: "invoke" as const,
              target: action.id,
              value: "reload",
              inputValues: runtimeBinding.inputValues,
              timeoutMs: reloadTimeoutMs!,
            }] : []),
          ],
          actionInteractionId,
          ...(reloadInteractionId ? { reloadInteractionId } : {}),
        };
      }
      const actionBinding = bindingByAction.get(action.id);
      const control = actionBinding ? controlById.get(actionBinding.controlRef) : undefined;
      observableEffects.forEach((effect) => {
        if (effect.selector.kind === "control" && (!actionBinding || !control)) {
          throw new Error(`EVIDENCE_PLAN_OBSERVABLE_CONTROL_MISSING:${action.id}:${effect.id}`);
        }
        if (effect.selector.kind === "surface" && !action.surfaceRefs.includes(effect.selector.surfaceRef)) {
          throw new Error(`EVIDENCE_PLAN_OBSERVABLE_SURFACE_MISSING:${action.id}:${effect.id}`);
        }
        if (effect.selector.kind === "accessibility") {
          const selector = effect.selector;
          const matches = slice.contract.controls.filter((candidate) =>
            candidate.surfaceRef === selector.surfaceRef
            && candidate.accessibility.role === selector.role
            && candidate.accessibility.name === selector.name);
          if (matches.length !== 1) {
            throw new Error(`EVIDENCE_PLAN_OBSERVABLE_ACCESSIBILITY_AMBIGUOUS:${action.id}:${effect.id}:${matches.length}`);
          }
          if (selector.actionRef && matches[0]!.id !== actionBinding?.controlRef) {
            throw new Error(`EVIDENCE_PLAN_OBSERVABLE_ACCESSIBILITY_ACTION_MISMATCH:${action.id}:${effect.id}`);
          }
        }
      });
      const routeRef = actionBinding?.routeRef
        ?? action.surfaceRefs.map((surfaceRef) => routeBySurface.get(surfaceRef)).find(Boolean);
      const route = routeRef ? routeById.get(routeRef) : undefined;
      const interactions: z.input<typeof EvidencePlanInteractionV1Schema>[] = [];
      const browserRuntime = slice.runtimeEvidence?.adapter === "browser-service";
      if (browserRuntime) {
        interactions.push({
          id: `reset:${action.id}`,
          action: "reset",
          timeoutMs: 30_000,
        });
      }
      if (route?.path) {
        interactions.push({
          id: `route:${action.id}`,
          action: "navigate",
          value: runtimeUrl(route.path),
          timeoutMs: 30_000,
        });
      }
      if (browserRuntime) {
        action.evidenceScenario.prerequisiteSteps.forEach((step, index) => {
          interactions.push({
            id: `prerequisite:${action.id}:${String(index + 1).padStart(3, "0")}:${step.actionRef}`,
            action: "invoke",
            target: step.actionRef,
            value: "action",
            inputValues: step.inputValues,
            timeoutMs: 30_000,
          });
        });
      }
      const inputBindings: z.input<typeof EvidencePlanFlowV1Schema>["inputBindings"] = [];
      for (const field of action.input.fields) {
        const evidenceValue = action.evidenceScenario.targetInputValues[field.name];
        if (evidenceValue === undefined) {
          throw new Error(`EVIDENCE_PLAN_TARGET_INPUT_MISSING:${action.id}:${field.name}`);
        }
        const inputBinding = actionBinding?.inputBindings.find((candidate) => candidate.inputField === field.name);
        if (browserRuntime && action.trigger.kind !== "user") {
          inputBindings.push({
            inputField: field.name,
            valueFrom: { kind: "literal", value: evidenceValue },
          });
          continue;
        }
        if (!inputBinding) {
          throw new Error(`EVIDENCE_PLAN_INPUT_BINDING_MISSING:${action.id}:${field.name}`);
        }
        if (inputBinding.valueFrom.kind === "control_value") {
          const inputControl = controlById.get(inputBinding.valueFrom.controlRef);
          const valueBinding = bindingByControl.get(inputBinding.valueFrom.controlRef);
          const sameActionToggle = Boolean(
            inputControl
            && inputControl.id === control?.id
            && (inputControl.kind === "checkbox" || inputControl.kind === "radio"),
          );
          if (!inputControl || (!sameActionToggle && valueBinding?.disposition !== "value_input")) {
            throw new Error(`EVIDENCE_PLAN_INPUT_CONTROL_INVALID:${action.id}:${field.name}`);
          }
          const testValue = evidenceValue;
          inputBindings.push({
            inputField: field.name,
            valueFrom: { kind: "control_value", controlRef: inputControl.id, testValue },
          });
          if (!sameActionToggle) {
            interactions.push({
              id: `input:${action.id}:${field.name}`,
              action: inputControl.kind === "checkbox" || inputControl.kind === "radio"
                ? "click"
                : inputControl.kind === "select"
                  ? "select"
                  : "fill",
              target: sourceSelector(inputControl),
              ...(inputControl.kind === "checkbox" || inputControl.kind === "radio"
                ? {}
                : { value: interactionValue(testValue) }),
              timeoutMs: 10_000,
            });
          }
        } else if (inputBinding.valueFrom.kind === "state") {
          inputBindings.push({
            inputField: field.name,
            valueFrom: {
              kind: "state",
              stateRef: inputBinding.valueFrom.stateRef,
              path: inputBinding.valueFrom.path,
            },
          });
        } else {
          if (canonicalJsonStringify(inputBinding.valueFrom.value) !== canonicalJsonStringify(evidenceValue)) {
            throw new Error(`EVIDENCE_PLAN_LITERAL_INPUT_MISMATCH:${action.id}:${field.name}`);
          }
          inputBindings.push({
            inputField: field.name,
            valueFrom: { kind: "literal", value: inputBinding.valueFrom.value },
          });
        }
      }
      const actionInteractionId = `action:${action.id}`;
      if (action.trigger.kind === "user") {
        if (!actionBinding || !control || !control.interactive) {
          throw new Error(`EVIDENCE_PLAN_ACTION_CONTROL_MISSING:${action.id}`);
        }
        interactions.push({
          id: actionInteractionId,
          action: "click",
          target: sourceSelector(control),
          timeoutMs: 10_000,
        });
      } else if (action.trigger.kind === "route" && route?.path) {
        interactions.push({
          id: actionInteractionId,
          action: "navigate",
          value: runtimeUrl(route.path),
          timeoutMs: 30_000,
        });
      } else if (browserRuntime) {
        interactions.push({
          id: actionInteractionId,
          action: "invoke",
          target: action.id,
          value: "action",
          inputValues: action.evidenceScenario.targetInputValues,
          timeoutMs: 30_000,
        });
      } else {
        interactions.push({ id: actionInteractionId, action: "wait", timeoutMs: 1_000 });
      }
      const durablePolicies = action.persistenceEffects.flatMap((effect) => {
        const policy = slice.contract.persistencePolicies.find((candidate) => candidate.id === effect.policyRef);
        return policy && ["reload", "restart", "durable"].includes(policy.durability) ? [policy] : [];
      });
      let reloadInteractionId: string | undefined;
      if (durablePolicies.length > 0) {
        const rehydrationActionRefs = canonical(durablePolicies.flatMap((policy) =>
          policy.rehydration.kind === "action" ? [policy.rehydration.actionRef] : []));
        if (browserRuntime && rehydrationActionRefs.length > 0) {
          interactions.push({
            id: `reload-navigation:${action.id}`,
            action: "navigate",
            value: runtimeUrl(route?.path ?? "/"),
            timeoutMs: 30_000,
          });
          rehydrationActionRefs.forEach((actionRef, index) => {
            const rehydrationAction = slice.contract.actions.find((candidate) => candidate.id === actionRef);
            if (!rehydrationAction) throw new Error(`EVIDENCE_PLAN_REHYDRATION_ACTION_MISSING:${action.id}:${actionRef}`);
            const interactionId = `reload:${action.id}:${String(index + 1).padStart(3, "0")}:${actionRef}`;
            interactions.push({
              id: interactionId,
              action: "invoke",
              target: actionRef,
              value: "reload",
              inputValues: rehydrationAction.evidenceScenario.targetInputValues,
              timeoutMs: 30_000,
            });
            reloadInteractionId = interactionId;
          });
        } else {
          reloadInteractionId = `reload:${action.id}`;
          interactions.push({
            id: reloadInteractionId,
            action: "navigate",
            value: runtimeUrl(route?.path ?? "/"),
            timeoutMs: 30_000,
          });
        }
      }
      if (observableReloadRequired && !reloadInteractionId) {
        if (!browserRuntime) throw new Error(`EVIDENCE_PLAN_OBSERVABLE_RELOAD_UNSUPPORTED:${action.id}`);
        reloadInteractionId = `reload:${action.id}`;
        interactions.push({
          id: reloadInteractionId,
          action: "navigate",
          value: runtimeUrl(route?.path ?? "/"),
          timeoutMs: 30_000,
        });
      }
      return {
        flowId: `flow:${action.id}`,
        actionRef: action.id,
        ...(control ? { controlRef: control.id } : {}),
        preconditions: action.preconditions,
        scenario: action.evidenceScenario,
        inputBindings,
        predicateRefs: canonical(predicates.map((predicate) => predicate.id)),
        observableEffects,
        interactions,
        actionInteractionId,
        ...(reloadInteractionId ? { reloadInteractionId } : {}),
      };
    });

  const draft = {
    schema: "setfarm.evidence-plan.v1" as const,
    packetHash: slice.packetHash,
    sliceHash: Sha256Schema.parse(input.sliceHash),
    storyId: slice.storyId,
    ...(slice.runtimeEvidence ? { runtime: slice.runtimeEvidence } : {}),
    commands: slice.commands
      .filter((command) => ["build", "test", "evidence"].includes(command.kind))
      .map((command) => ({
        commandRef: command.id,
        kind: command.kind as "build" | "test" | "evidence",
        argv: [...command.argv],
        cwd: command.cwd,
        timeoutMs: command.timeoutMs,
      }))
      .sort((left, right) => left.commandRef.localeCompare(right.commandRef)),
    flows,
    predicateRefs: canonical(slice.requiredEvidence.map((predicate) => predicate.id)),
  };
  return EvidencePlanV1Schema.parse({ ...draft, planHash: hashCanonicalJson(draft) });
}

export function flattenEvidencePlanInteractions(plan: EvidencePlanV1): Array<z.infer<typeof EvidencePlanInteractionV1Schema>> {
  return EvidencePlanV1Schema.parse(plan).flows.flatMap((flow) => flow.interactions);
}
