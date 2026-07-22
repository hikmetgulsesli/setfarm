import { z } from "zod";

import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import type { CompilationDiagnosticV1 } from
  "../schemas/compilation-report-v1.js";
import type { DesignInteractionGraphV2 } from
  "../schemas/design-interaction-graph-v2.js";
import { DesignInteractionGraphV2Schema } from
  "../schemas/design-interaction-graph-v2.js";
import { ProductSpecV2Schema, type ProductSpecV2 } from
  "../schemas/product-spec-v2.js";
import { verifyProductRuntimeBehaviorContractV1 } from
  "../product-runtime-behavior-contract-v1.js";
import type { ProductRuntimeBehaviorContractV1 } from
  "../schemas/product-runtime-behavior-contract-v1.js";
import { hashSemanticStoryPartitionComponentV3 } from
  "../schemas/semantic-source-intent-set-v1.js";
import {
  produceStoryPartitionBaseV2ForV3,
  type ProductStoryPartitionV2,
} from "./story-partition-v2.js";

const StoryPartitionInputV3Schema = z.object({
  productSpec: ProductSpecV2Schema,
  designGraph: DesignInteractionGraphV2Schema.nullable().optional(),
  runtimeBehaviorProposal: z.unknown().optional(),
  runtimeBehaviorContract: z.unknown().optional(),
}).strict().superRefine((value, context) => {
  if (
    (value.runtimeBehaviorProposal === undefined)
      !== (value.runtimeBehaviorContract === undefined)
  ) {
    context.addIssue({
      code: "custom",
      path: ["runtimeBehaviorContract"],
      message: "V3 behavior proposal and contract must be supplied together",
    });
  }
});

export type ProductStoryPartitionV3 = Readonly<
  ProductStoryPartitionV2 & { entityRefs: string[] }
>;

export type StoryPartitionResultV3 =
  | Readonly<{
      status: "produced";
      productSpec: ProductSpecV2;
      designGraph: DesignInteractionGraphV2 | null;
      components: ProductStoryPartitionV3[];
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function diagnostic(
  code: string,
  message: string,
  reference?: string,
): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code,
    category: "contract",
    severity: "error",
    message: message.slice(0, 2_000),
    ...(reference ? { reference: reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: [],
  });
}

class ComponentSetV3 {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_value, index) => index);
  }

  find(value: number): number {
    const parent = this.parent[value];
    if (parent === undefined) throw new Error(`Unknown component ${value}`);
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent[value] = root;
    return root;
  }

  union(left: number, right: number): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;
    const [root, child] = leftRoot < rightRoot
      ? [leftRoot, rightRoot]
      : [rightRoot, leftRoot];
    this.parent[child] = root;
  }
}

function entityConsumersV3(productSpec: ProductSpecV2): Map<string, string[]> {
  const entityByField = new Map(productSpec.entities.flatMap((entity) =>
    entity.fields.map((field) => [field.id, entity.id] as const)));
  const policyById = new Map(productSpec.persistencePolicies.map((policy) =>
    [policy.id, policy] as const));
  const consumers = new Map<string, string[]>();
  productSpec.actions.forEach((action) => {
    const entityRefs = uniqueSorted([
      ...action.input.fields.flatMap((field) => {
        const entityRef = field.entityFieldRef
          ? entityByField.get(field.entityFieldRef)
          : undefined;
        return entityRef ? [entityRef] : [];
      }),
      ...action.stateDeltas.flatMap((delta) =>
        delta.valueFrom.kind === "entity_field"
          ? [delta.valueFrom.entityRef]
          : []),
      ...action.persistenceEffects.flatMap((effect) => [
        ...(effect.entityRef ? [effect.entityRef] : []),
        ...(policyById.get(effect.policyRef)?.entityRefs ?? []),
      ]),
    ]);
    entityRefs.forEach((entityRef) => {
      const actionRefs = consumers.get(entityRef) ?? [];
      actionRefs.push(action.id);
      consumers.set(entityRef, actionRefs);
    });
  });
  return consumers;
}

export function hashProductStoryPartitionComponentV3(
  value: Omit<ProductStoryPartitionV3, "componentHash">,
): string {
  return hashSemanticStoryPartitionComponentV3(value);
}

/**
 * Adds entity ownership as first-class component authority. V2 remains readable
 * for historical artifacts; V3 merges every component connected by one entity
 * instead of inferring entity ownership later in a source consumer.
 */
export function produceStoryPartitionV3(input: unknown): StoryPartitionResultV3 {
  const parsed = StoryPartitionInputV3Schema.safeParse(input);
  if (!parsed.success) {
    const diagnostics = parsed.error.issues.map((issue) => diagnostic(
      "STORY_PARTITION_V3_INPUT_INVALID",
      `Story partition V3 input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    ));
    return {
      status: "rejected",
      rejectionCodes: ["STORY_PARTITION_V3_INPUT_INVALID"],
      diagnostics: sortCompilationDiagnostics(diagnostics),
    };
  }
  let runtimeBehavior: Readonly<ProductRuntimeBehaviorContractV1> | null = null;
  if (parsed.data.runtimeBehaviorContract !== undefined) {
    try {
      runtimeBehavior = verifyProductRuntimeBehaviorContractV1({
        productSpec: parsed.data.productSpec,
        proposal: parsed.data.runtimeBehaviorProposal,
        candidate: parsed.data.runtimeBehaviorContract,
      });
    } catch (error) {
      return {
        status: "rejected",
        rejectionCodes: ["STORY_PARTITION_V3_BEHAVIOR_AUTHORITY_INVALID"],
        diagnostics: [diagnostic(
          "STORY_PARTITION_V3_BEHAVIOR_AUTHORITY_INVALID",
          error instanceof Error ? error.message : "Behavior authority is invalid",
        )],
      };
    }
  }
  if (parsed.data.productSpec.entities.length > 0 && runtimeBehavior === null) {
    return {
      status: "rejected",
      rejectionCodes: ["STORY_PARTITION_V3_BEHAVIOR_AUTHORITY_REQUIRED"],
      diagnostics: [diagnostic(
        "STORY_PARTITION_V3_BEHAVIOR_AUTHORITY_REQUIRED",
        "Entity-aware story ownership requires exact runtime behavior authority",
        "runtimeBehaviorContract",
      )],
    };
  }
  const base = produceStoryPartitionBaseV2ForV3({
    productSpec: parsed.data.productSpec,
    designGraph: parsed.data.designGraph ?? null,
  });
  if (base.status === "rejected") return base;
  const components = base.components;
  const componentSet = new ComponentSetV3(components.length);
  const actionOwner = new Map<string, number>();
  const stateOwner = new Map<string, number>();
  components.forEach((component, componentIndex) => {
    component.actionRefs.forEach((actionRef) =>
      actionOwner.set(actionRef, componentIndex));
    component.stateRefs.forEach((stateRef) =>
      stateOwner.set(stateRef, componentIndex));
  });
  const entityConsumers = entityConsumersV3(base.productSpec);
  const entityOwnerSeeds = new Map<string, number>();
  const diagnostics: CompilationDiagnosticV1[] = [];
  base.productSpec.entities.forEach((entity) => {
    const consumers = uniqueSorted(entityConsumers.get(entity.id) ?? []);
    if (consumers.length === 0) {
      diagnostics.push(diagnostic(
        "STORY_PARTITION_V3_ENTITY_UNOWNED",
        `Entity ${entity.id} has no exact ProductSpec action consumer`,
        entity.id,
      ));
      return;
    }
    const owners = uniqueSorted(consumers.map((actionRef) => {
      const owner = actionOwner.get(actionRef);
      return owner === undefined ? "" : String(owner).padStart(8, "0");
    })).filter((owner) => owner !== "").map(Number);
    if (owners.length === 0) {
      diagnostics.push(diagnostic(
        "STORY_PARTITION_V3_ENTITY_OWNER_UNRESOLVED",
        `Entity ${entity.id} consumers have no exact V2 semantic component`,
        entity.id,
      ));
      return;
    }
    owners.slice(1).forEach((owner) => componentSet.union(owners[0]!, owner));
    entityOwnerSeeds.set(entity.id, owners[0]!);
  });
  runtimeBehavior?.entityFieldBindings.forEach((binding) => {
    const actionComponent = actionOwner.get(binding.actionRef);
    const snapshotStateComponent = stateOwner.get(binding.snapshot.stateRef);
    if (actionComponent === undefined || snapshotStateComponent === undefined) {
      diagnostics.push(diagnostic(
        "STORY_PARTITION_V3_ENTITY_SNAPSHOT_OWNER_UNRESOLVED",
        `Entity snapshot ${binding.occurrenceRef} has no exact action/state component owner`,
        binding.occurrenceRef,
      ));
      return;
    }
    componentSet.union(actionComponent, snapshotStateComponent);
  });
  if (diagnostics.length > 0) {
    const sorted = sortCompilationDiagnostics(diagnostics);
    return {
      status: "rejected",
      rejectionCodes: uniqueSorted(sorted.map((item) => item.code)),
      diagnostics: sorted,
    };
  }

  const grouped = new Map<number, ProductStoryPartitionV2[]>();
  components.forEach((component, componentIndex) => {
    const root = componentSet.find(componentIndex);
    const members = grouped.get(root) ?? [];
    members.push(component);
    grouped.set(root, members);
  });
  const entitiesByRoot = new Map<number, string[]>();
  entityOwnerSeeds.forEach((seed, entityRef) => {
    const root = componentSet.find(seed);
    const refs = entitiesByRoot.get(root) ?? [];
    refs.push(entityRef);
    entitiesByRoot.set(root, refs);
  });

  const v3Components = [...grouped.entries()].map(([root, members]) => {
    const value = {
      routeRefs: uniqueSorted(members.flatMap((member) => member.routeRefs)),
      surfaceRefs: uniqueSorted(members.flatMap((member) => member.surfaceRefs)),
      controlSlotRefs: uniqueSorted(members.flatMap((member) =>
        member.controlSlotRefs)),
      controlRefs: uniqueSorted(members.flatMap((member) => member.controlRefs)),
      actionRefs: uniqueSorted(members.flatMap((member) => member.actionRefs)),
      observableRefs: uniqueSorted(members.flatMap((member) =>
        member.observableRefs)),
      stateRefs: uniqueSorted(members.flatMap((member) => member.stateRefs)),
      persistenceRefs: uniqueSorted(members.flatMap((member) =>
        member.persistenceRefs)),
      evidenceRefs: uniqueSorted(members.flatMap((member) => member.evidenceRefs)),
      entityRefs: uniqueSorted(entitiesByRoot.get(root) ?? []),
    };
    return {
      componentHash: hashProductStoryPartitionComponentV3(value),
      ...value,
    };
  }).sort((left, right) =>
    compareUtf16(left.routeRefs[0] ?? "", right.routeRefs[0] ?? "")
    || compareUtf16(left.actionRefs[0] ?? "", right.actionRefs[0] ?? "")
    || compareUtf16(left.componentHash, right.componentHash));

  v3Components.forEach((component) => {
    if (component.actionRefs.length === 0) {
      diagnostics.push(diagnostic(
        "STORY_PARTITION_V3_COMPONENT_ACTION_MISSING",
        `Entity-aware semantic component ${component.componentHash} has no executable action`,
        component.componentHash,
      ));
    }
    if (component.observableRefs.length === 0) {
      diagnostics.push(diagnostic(
        "STORY_PARTITION_V3_COMPONENT_OBSERVABLE_MISSING",
        `Entity-aware semantic component ${component.componentHash} has no observable`,
        component.componentHash,
      ));
    }
    if (component.evidenceRefs.length === 0) {
      diagnostics.push(diagnostic(
        "STORY_PARTITION_V3_COMPONENT_EVIDENCE_MISSING",
        `Entity-aware semantic component ${component.componentHash} has no required evidence`,
        component.componentHash,
      ));
    }
  });
  if (diagnostics.length > 0) {
    const sorted = sortCompilationDiagnostics(diagnostics);
    return {
      status: "rejected",
      rejectionCodes: uniqueSorted(sorted.map((item) => item.code)),
      diagnostics: sorted,
    };
  }

  return {
    status: "produced",
    productSpec: base.productSpec,
    designGraph: base.designGraph,
    components: v3Components,
    diagnostics: [],
  };
}
