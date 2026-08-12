import fs from "node:fs";
import path from "node:path";

import { canonicalJsonStringify, hashCanonicalJson } from "../../../product-compiler/canonical-json.js";
import { produceDesignInteractionGraphV2 } from "../../../product-compiler/producers/design-graph-v2.js";
import { produceDesignGenerationTargetsV2 } from "../../../product-compiler/producers/design-targets-v2.js";
import {
  produceStoryDefinitionsV2,
  type ProductStoryDefinitionV2,
} from "../../../product-compiler/producers/story-definitions-v2.js";
import { resolveCanonicalProductSpecV2FromPlan } from "../../../product-compiler/runtime-plan-source-v2.js";
import {
  DesignGenerationTargetsV2Schema,
  type DesignGenerationTargetsV2,
} from "../../../product-compiler/schemas/design-generation-targets-v2.js";
import {
  DesignInteractionGraphV2Schema,
  type DesignInteractionGraphV2,
} from "../../../product-compiler/schemas/design-interaction-graph-v2.js";
import {
  ProductSpecV2EnglishWriteSchema,
  type ProductActionV2,
  type ProductSpecV2,
} from "../../../product-compiler/schemas/product-spec-v2.js";
import { StitchDirectResponseEvidenceV2Schema } from "../../../product-compiler/schemas/stitch-direct-response-evidence-v2.js";
import { StitchRenderedSemanticsV2Schema } from "../../../product-compiler/schemas/stitch-rendered-semantics-v2.js";
import {
  StitchTargetCandidateSelectionV2Schema,
  StitchTargetResponseBindingsV3Schema,
  type StitchTargetResponseBindingsV3,
} from "../../../product-compiler/schemas/stitch-target-candidate-selection-v2.js";

type ScopeTargetRole =
  | "app_shell"
  | "route_registration"
  | "surface_component"
  | "action_handler"
  | "state_store"
  | "fixture_data"
  | "persistence_adapter"
  | "test_bridge"
  | "style_integration"
  | "game_runtime"
  | "api_route"
  | "cli_command";

type V2ScopeTarget = Readonly<{
  role: ScopeTargetRole;
  surface_id?: string;
  screen_id?: string;
  domain_slug: string;
  target_slug: string;
  action_ids: string[];
  entity_names: string[];
  resolved_path: null;
}>;

type V2OwnedAction = Readonly<{
  id: string;
  canonical_action_hash: string;
  canonical_action: ProductActionV2;
  surface_id?: string;
  trigger: string;
  state_change: string;
  ui_feedback: string;
  control_slot_ids: string[];
  physical_control_ids: string[];
  control_surface_ids: string[];
  affected_surface_ids: string[];
  observable_ids: string[];
  state_ids: string[];
  persistence_ids: string[];
  evidence_ids: string[];
}>;

export type ProductSemanticsV2CompatibilityProjection = Readonly<{
  stories: ReadonlyArray<Readonly<{
    id: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
    depends_on: string[];
    screens: string[];
    requested_dependencies: readonly [];
    scope_targets: V2ScopeTarget[];
    shared_edit_requests: ReadonlyArray<Readonly<{
      role: "route_registration" | "app_shell";
      action: "register_route" | "wire_action";
      intent: string;
      edit_scope: "route_registration_only" | "owned_action_wiring_only";
      requested_by: string;
    }>>;
    scope_description: string;
    file_skeletons: Readonly<Record<string, never>>;
    implementation_contract: Readonly<{
      authority_schema: "setfarm.story-scheduling-authority.v2";
      product_spec_hash: string;
      design_graph_hash: string | null;
      component_hash: string;
      owned_route_ids: string[];
      owned_surface_ids: string[];
      owned_screen_ids: string[];
      owned_screen_files: readonly [];
      owned_control_slot_ids: string[];
      owned_physical_control_ids: string[];
      owned_observable_ids: string[];
      owned_evidence_ids: string[];
      owned_actions: V2OwnedAction[];
      state_contract: string[];
      persistence_contract: string[];
      navigation_contract: string[];
      test_contract: string[];
    }>;
  }>>;
  screenMap: ReadonlyArray<Readonly<{
    screenId: string;
    name: string;
    type: string;
    description: string;
    surfaceIds: string[];
    stories: string[];
  }>>;
  productSpecSourceHash: string;
  productSpecHash: string;
  designGraphHash: string | null;
}>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function semanticSlug(reference: string): string {
  return reference.toLowerCase().replace(/_/g, "-");
}

function readCanonicalV2Json<T>(input: Readonly<{
  filePath: string;
  label: string;
  parse: (value: unknown) => T;
}>): T {
  let text: string;
  try {
    text = fs.readFileSync(input.filePath, "utf8");
  } catch {
    throw new Error(`V2_STORY_${input.label}_MISSING:${input.filePath}`);
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new Error(`V2_STORY_${input.label}_JSON_INVALID:${input.filePath}`);
  }
  let parsed: T;
  try {
    parsed = input.parse(decoded);
  } catch (error) {
    const detail = String(error instanceof Error ? error.message : error).replace(/\s+/g, " ").slice(0, 1_000);
    throw new Error(`V2_STORY_${input.label}_SCHEMA_INVALID:${detail}`);
  }
  if (canonicalJsonStringify(parsed) !== text) {
    throw new Error(`V2_STORY_${input.label}_NON_CANONICAL:${input.filePath}`);
  }
  return parsed;
}

function actionStateRefs(action: ProductActionV2): string[] {
  return uniqueSorted([
    ...action.preconditions.map((item) => item.stateRef),
    ...action.stateDeltas.map((item) => item.stateRef),
    ...action.stateDeltas.flatMap((item) =>
      item.valueFrom.kind === "state" ? [item.valueFrom.stateRef] : []),
    ...action.persistenceEffects.flatMap((effect) =>
      effect.statePaths.map((statePath) => statePath.stateRef)),
    ...action.success.stateRefs,
    ...action.failure.stateRefs,
  ]);
}

function actionPersistenceRefs(action: ProductActionV2): string[] {
  return uniqueSorted([
    ...action.persistenceEffects.map((item) => item.policyRef),
    ...(action.success.persistenceRefs ?? []),
    ...(action.failure.persistenceRefs ?? []),
  ]);
}

function actionEvidenceRefs(action: ProductActionV2): string[] {
  return uniqueSorted([
    ...action.evidenceRefs,
    ...action.success.evidenceRefs,
    ...action.failure.evidenceRefs,
    ...action.observableEffects.map((observable) => observable.evidenceRef),
  ]);
}

function appTargets(productSpec: ProductSpecV2): V2ScopeTarget[] {
  const roles: ScopeTargetRole[] = [
    "app_shell",
    "route_registration",
    "state_store",
    "fixture_data",
    "persistence_adapter",
    "test_bridge",
    "style_integration",
    ...(productSpec.product.class === "game" ? ["game_runtime" as const] : []),
  ];
  const domain = semanticSlug(productSpec.product.id);
  return roles.map((role) => ({
    role,
    domain_slug: domain,
    target_slug: role.replace(/_/g, "-"),
    action_ids: [],
    entity_names: [],
    resolved_path: null,
  }));
}

function nonVisualAppTargets(productSpec: ProductSpecV2): V2ScopeTarget[] {
  const roles: ScopeTargetRole[] = [
    "app_shell",
    "route_registration",
    "state_store",
    "fixture_data",
    "persistence_adapter",
    "test_bridge",
  ];
  const domain = semanticSlug(productSpec.product.id);
  return roles.map((role) => ({
    role,
    domain_slug: domain,
    target_slug: role.replace(/_/g, "-"),
    action_ids: [],
    entity_names: [],
    resolved_path: null,
  }));
}

function projectNoDesignCompatibilityStories(input: Readonly<{
  productSpec: ProductSpecV2;
  definitions: ProductStoryDefinitionV2[];
}>): Pick<ProductSemanticsV2CompatibilityProjection, "stories" | "screenMap"> {
  const { productSpec, definitions } = input;
  const productSpecHash = hashCanonicalJson(productSpec);
  const actionById = new Map(productSpec.actions.map((action) => [action.id, action] as const));
  const stateById = new Map(productSpec.states.map((state) => [state.id, state] as const));
  const persistenceById = new Map(productSpec.persistencePolicies.map((policy) =>
    [policy.id, policy] as const));
  const evidenceById = new Map(productSpec.evidencePredicates.map((evidence) =>
    [evidence.id, evidence] as const));
  const surfaceById = new Map(productSpec.surfaces.map((surface) => [surface.id, surface] as const));
  const endpointRole: ScopeTargetRole = productSpec.delivery.platform === "api"
    ? "api_route"
    : "cli_command";

  const stories = definitions.map((story, storyIndex) => {
    const ownedActions = story.actionRefs.map((actionRef): V2OwnedAction => {
      const action = actionById.get(actionRef);
      if (!action) throw new Error(`V2_STORY_ACTION_MISSING:${actionRef}`);
      const placementSurfaceIds = uniqueSorted(action.controlPlacements.map((placement) =>
        placement.surfaceRef));
      return {
        id: action.id,
        canonical_action_hash: hashCanonicalJson(action),
        canonical_action: structuredClone(action),
        ...(placementSurfaceIds[0] ? { surface_id: placementSurfaceIds[0] } : {}),
        trigger: canonicalJsonStringify(action.trigger),
        state_change: canonicalJsonStringify(action.stateDeltas),
        ui_feedback: canonicalJsonStringify({
          observableRefs: action.observableEffects.map((observable) => observable.id).sort(compareUtf16),
          success: action.success,
          failure: action.failure,
        }),
        control_slot_ids: action.controlPlacements.map((placement) => placement.id).sort(compareUtf16),
        physical_control_ids: [],
        control_surface_ids: placementSurfaceIds,
        affected_surface_ids: [...action.affectedSurfaceRefs].sort(compareUtf16),
        observable_ids: action.observableEffects.map((observable) => observable.id).sort(compareUtf16),
        state_ids: actionStateRefs(action),
        persistence_ids: actionPersistenceRefs(action),
        evidence_ids: actionEvidenceRefs(action),
      };
    });
    const actionTargets = story.actionRefs.map((actionRef): V2ScopeTarget => {
      const action = actionById.get(actionRef)!;
      const surfaceRef = action.controlPlacements[0]?.surfaceRef
        ?? action.affectedSurfaceRefs[0]
        ?? story.surfaceRefs[0]!;
      return {
        role: endpointRole,
        surface_id: surfaceRef,
        domain_slug: semanticSlug(surfaceRef),
        target_slug: semanticSlug(action.id),
        action_ids: [action.id],
        entity_names: [],
        resolved_path: null,
      };
    });
    const acceptanceCriteria = [
      `[PRODUCT_SPEC_V2_COMPONENT] componentHash=${story.componentHash}; routes=${story.routeRefs.join(",")}; surfaces=${story.surfaceRefs.join(",")}; actions=${story.actionRefs.join(",")}.`,
      `[PRODUCT_SPEC_V2_OWNERSHIP] controlSlots=${story.controlSlotRefs.join(",") || "none"}; physicalControls=none; observables=${story.observableRefs.join(",")}; states=${story.stateRefs.join(",") || "none"}; persistence=${story.persistenceRefs.join(",") || "none"}; evidence=${story.evidenceRefs.join(",")}.`,
      ...story.surfaceRefs.map((surfaceRef) => {
        const surface = surfaceById.get(surfaceRef)!;
        return `[PRODUCT_SPEC_V2_SURFACE] ${surfaceRef}; hash=${hashCanonicalJson(surface)}; kind=${surface.kind}; route=${surface.routeRef}.`;
      }),
      ...story.actionRefs.map((actionRef) => {
        const action = actionById.get(actionRef)!;
        return `[PRODUCT_SPEC_V2_ACTION] ${action.id}; hash=${hashCanonicalJson(action)}; endpointRole=${endpointRole}; navigation=${canonicalJsonStringify(action.navigation)}.`;
      }),
      ...story.evidenceRefs.map((evidenceRef) => {
        const evidence = evidenceById.get(evidenceRef)!;
        return `[PRODUCT_SPEC_V2_EVIDENCE] ${evidence.id}; hash=${hashCanonicalJson(evidence)}; subject=${evidence.subjectRef}; kind=${evidence.kind}.`;
      }),
    ];
    return {
      id: story.id,
      title: `${productSpec.product.name}: ${story.title}`.slice(0, 500),
      description: `${story.description} ProductSpecV2=${productSpecHash}; DesignInteractionGraphV2=none.`,
      acceptanceCriteria,
      depends_on: storyIndex === 0 ? [] : [definitions[0]!.id],
      screens: [],
      requested_dependencies: [] as const,
      scope_targets: [...(storyIndex === 0 ? nonVisualAppTargets(productSpec) : []), ...actionTargets],
      shared_edit_requests: storyIndex === 0 ? [] : [
        {
          role: "route_registration" as const,
          action: "register_route" as const,
          intent: `Register only exact route refs ${story.routeRefs.join(",")} for ${story.id}.`,
          edit_scope: "route_registration_only" as const,
          requested_by: story.id,
        },
        {
          role: "app_shell" as const,
          action: "wire_action" as const,
          intent: `Wire only exact action refs ${story.actionRefs.join(",")} for ${story.id}.`,
          edit_scope: "owned_action_wiring_only" as const,
          requested_by: story.id,
        },
      ],
      scope_description: `Compatibility scheduling projection for no-design semantic component ${story.componentHash}; final path ownership is compiled later by StoryPlanV2 and BuildTopologyV1.`,
      file_skeletons: {},
      implementation_contract: {
        authority_schema: "setfarm.story-scheduling-authority.v2" as const,
        product_spec_hash: productSpecHash,
        design_graph_hash: null,
        component_hash: story.componentHash,
        owned_route_ids: [...story.routeRefs],
        owned_surface_ids: [...story.surfaceRefs],
        owned_screen_ids: [],
        owned_screen_files: [] as const,
        owned_control_slot_ids: [...story.controlSlotRefs],
        owned_physical_control_ids: [] as string[],
        owned_observable_ids: [...story.observableRefs],
        owned_evidence_ids: [...story.evidenceRefs],
        owned_actions: ownedActions,
        state_contract: story.stateRefs.map((stateRef) => {
          const state = stateById.get(stateRef)!;
          return `${state.id}#${hashCanonicalJson(state)}:${canonicalJsonStringify(state)}`;
        }),
        persistence_contract: story.persistenceRefs.length > 0
          ? story.persistenceRefs.map((persistenceRef) => {
              const policy = persistenceById.get(persistenceRef)!;
              return `${policy.id}#${hashCanonicalJson(policy)}:${canonicalJsonStringify(policy)}`;
            })
          : ["ProductSpecV2 declares no persistence policy owned by this semantic component."],
        navigation_contract: story.actionRefs.map((actionRef) => {
          const action = actionById.get(actionRef)!;
          return `${action.id}:${canonicalJsonStringify(action.navigation)}`;
        }),
        test_contract: story.evidenceRefs.map((evidenceRef) => {
          const evidence = evidenceById.get(evidenceRef)!;
          return `${evidence.id}#${hashCanonicalJson(evidence)}:${canonicalJsonStringify(evidence)}`;
        }),
      },
    };
  });
  return { stories, screenMap: [] };
}

function projectCompatibilityStories(input: Readonly<{
  productSpec: ProductSpecV2;
  designGraph: DesignInteractionGraphV2;
  responseBindings: StitchTargetResponseBindingsV3;
  definitions: ProductStoryDefinitionV2[];
}>): Pick<ProductSemanticsV2CompatibilityProjection, "stories" | "screenMap"> {
  const { productSpec, designGraph, responseBindings, definitions } = input;
  const productSpecHash = hashCanonicalJson(productSpec);
  const designGraphHash = hashCanonicalJson(designGraph);
  const actionById = new Map(productSpec.actions.map((action) => [action.id, action] as const));
  const stateById = new Map(productSpec.states.map((state) => [state.id, state] as const));
  const persistenceById = new Map(productSpec.persistencePolicies.map((policy) => [policy.id, policy] as const));
  const evidenceById = new Map(productSpec.evidencePredicates.map((evidence) => [evidence.id, evidence] as const));
  const surfaceById = new Map(productSpec.surfaces.map((surface) => [surface.id, surface] as const));
  const graphSurfaceById = new Map(designGraph.surfaces.map((surface) => [surface.surfaceRef, surface] as const));
  const bindingByScreen = new Map(responseBindings.bindings.map((binding) =>
    [binding.responseScreenId, binding] as const));
  const graphControlsByAction = new Map(productSpec.actions.map((action) => [
    action.id,
    designGraph.controls.filter((control) => control.identity.actionRef === action.id),
  ] as const));
  const ownerBySurface = new Map(definitions.flatMap((story) =>
    story.surfaceRefs.map((surfaceRef) => [surfaceRef, story.id] as const)));

  const screenForSurface = (surfaceRef: string): string => {
    const graphSurface = graphSurfaceById.get(surfaceRef);
    if (!graphSurface) throw new Error(`V2_STORY_GRAPH_SURFACE_MISSING:${surfaceRef}`);
    return graphSurface.source.responseScreenId;
  };

  const stories = definitions.map((story, storyIndex) => {
    const screens = uniqueSorted(story.surfaceRefs.map(screenForSurface));
    const ownedActions = story.actionRefs.map((actionRef): V2OwnedAction => {
      const action = actionById.get(actionRef);
      if (!action) throw new Error(`V2_STORY_ACTION_MISSING:${actionRef}`);
      const controls = graphControlsByAction.get(action.id) ?? [];
      const placementSurfaceIds = uniqueSorted(action.controlPlacements.map((placement) => placement.surfaceRef));
      return {
        id: action.id,
        canonical_action_hash: hashCanonicalJson(action),
        canonical_action: structuredClone(action),
        ...(placementSurfaceIds[0] ? { surface_id: placementSurfaceIds[0] } : {}),
        trigger: canonicalJsonStringify(action.trigger),
        state_change: canonicalJsonStringify(action.stateDeltas),
        ui_feedback: canonicalJsonStringify({
          observableRefs: action.observableEffects.map((observable) => observable.id).sort(compareUtf16),
          success: action.success,
          failure: action.failure,
        }),
        control_slot_ids: action.controlPlacements.map((placement) => placement.id).sort(compareUtf16),
        physical_control_ids: controls.map((control) => control.id).sort(compareUtf16),
        control_surface_ids: placementSurfaceIds,
        affected_surface_ids: [...action.affectedSurfaceRefs].sort(compareUtf16),
        observable_ids: action.observableEffects.map((observable) => observable.id).sort(compareUtf16),
        state_ids: actionStateRefs(action),
        persistence_ids: actionPersistenceRefs(action),
        evidence_ids: actionEvidenceRefs(action),
      };
    });

    const surfaceTargets = screens.map((screenId): V2ScopeTarget => {
      const screenSurfaces = story.surfaceRefs.filter((surfaceRef) => screenForSurface(surfaceRef) === screenId);
      const rootSurfaceRef = screenSurfaces.find((surfaceRef) =>
        surfaceById.get(surfaceRef)?.composition.kind === "route_root") ?? screenSurfaces[0];
      if (!rootSurfaceRef) throw new Error(`V2_STORY_SCREEN_SURFACE_MISSING:${screenId}`);
      const actionIds = story.actionRefs.filter((actionRef) => {
        const action = actionById.get(actionRef)!;
        const actionSurfaceRefs = [
          ...action.controlPlacements.map((placement) => placement.surfaceRef),
          ...action.affectedSurfaceRefs,
        ];
        return actionSurfaceRefs.some((surfaceRef) => screenSurfaces.includes(surfaceRef));
      });
      return {
        role: "surface_component",
        surface_id: rootSurfaceRef,
        screen_id: screenId,
        domain_slug: semanticSlug(rootSurfaceRef),
        target_slug: semanticSlug(screenId),
        action_ids: actionIds,
        entity_names: [],
        resolved_path: null,
      };
    });
    const actionTargets = story.actionRefs.map((actionRef): V2ScopeTarget => {
      const action = actionById.get(actionRef)!;
      const surfaceRef = action.controlPlacements[0]?.surfaceRef
        ?? action.affectedSurfaceRefs[0]
        ?? story.surfaceRefs[0]!;
      return {
        role: "action_handler",
        surface_id: surfaceRef,
        screen_id: screenForSurface(surfaceRef),
        domain_slug: semanticSlug(surfaceRef),
        target_slug: semanticSlug(action.id),
        action_ids: [action.id],
        entity_names: [],
        resolved_path: null,
      };
    });
    const acceptanceCriteria = [
      `[PRODUCT_SPEC_V2_COMPONENT] componentHash=${story.componentHash}; routes=${story.routeRefs.join(",")}; surfaces=${story.surfaceRefs.join(",")}; actions=${story.actionRefs.join(",")}.`,
      `[PRODUCT_SPEC_V2_OWNERSHIP] controlSlots=${story.controlSlotRefs.join(",") || "none"}; physicalControls=${story.controlRefs.join(",") || "none"}; observables=${story.observableRefs.join(",")}; states=${story.stateRefs.join(",") || "none"}; persistence=${story.persistenceRefs.join(",") || "none"}; evidence=${story.evidenceRefs.join(",")}.`,
      ...story.surfaceRefs.map((surfaceRef) => {
        const surface = graphSurfaceById.get(surfaceRef)!;
        return `[DESIGN_GRAPH_V2_SURFACE] ${surfaceRef}; screen=${surface.source.responseScreenId}; sourceHash=${surface.source.sourceHash}; element=${surface.elementRef}#${surface.elementHash}.`;
      }),
      ...story.controlRefs.map((controlRef) => {
        const control = designGraph.controls.find((candidate) => candidate.id === controlRef)!;
        const action = actionById.get(control.identity.actionRef)!;
        return `[DESIGN_GRAPH_V2_CONTROL] ${control.id}; slot=${control.identity.controlSlotRef}; action=${control.identity.actionRef}; placementSurface=${control.identity.surfaceRef}; affectedSurfaces=${action.affectedSurfaceRefs.join(",") || "none"}; sourceHash=${control.source.sourceHash}; element=${control.elementRef}#${control.elementHash}.`;
      }),
      ...story.evidenceRefs.map((evidenceRef) => {
        const evidence = evidenceById.get(evidenceRef)!;
        return `[PRODUCT_SPEC_V2_EVIDENCE] ${evidence.id}; hash=${hashCanonicalJson(evidence)}; subject=${evidence.subjectRef}; kind=${evidence.kind}.`;
      }),
    ];
    return {
      id: story.id,
      title: `${productSpec.product.name}: ${story.title}`.slice(0, 500),
      description: `${story.description} ProductSpecV2=${productSpecHash}; DesignInteractionGraphV2=${designGraphHash}.`,
      acceptanceCriteria,
      depends_on: storyIndex === 0 ? [] : [definitions[0]!.id],
      screens,
      requested_dependencies: [] as const,
      scope_targets: [...(storyIndex === 0 ? appTargets(productSpec) : []), ...surfaceTargets, ...actionTargets],
      shared_edit_requests: storyIndex === 0 ? [] : [
        {
          role: "route_registration" as const,
          action: "register_route" as const,
          intent: `Register only exact route refs ${story.routeRefs.join(",")} for ${story.id}.`,
          edit_scope: "route_registration_only" as const,
          requested_by: story.id,
        },
        {
          role: "app_shell" as const,
          action: "wire_action" as const,
          intent: `Wire only exact action refs ${story.actionRefs.join(",")} for ${story.id}.`,
          edit_scope: "owned_action_wiring_only" as const,
          requested_by: story.id,
        },
      ],
      scope_description: `Compatibility scheduling projection for semantic component ${story.componentHash}; final path ownership is compiled later by StoryPlanV2 and BuildTopologyV1.`,
      file_skeletons: {},
      implementation_contract: {
        authority_schema: "setfarm.story-scheduling-authority.v2" as const,
        product_spec_hash: productSpecHash,
        design_graph_hash: designGraphHash,
        component_hash: story.componentHash,
        owned_route_ids: [...story.routeRefs],
        owned_surface_ids: [...story.surfaceRefs],
        owned_screen_ids: screens,
        owned_screen_files: [] as const,
        owned_control_slot_ids: [...story.controlSlotRefs],
        owned_physical_control_ids: [...story.controlRefs],
        owned_observable_ids: [...story.observableRefs],
        owned_evidence_ids: [...story.evidenceRefs],
        owned_actions: ownedActions,
        state_contract: story.stateRefs.map((stateRef) => {
          const state = stateById.get(stateRef)!;
          return `${state.id}#${hashCanonicalJson(state)}:${canonicalJsonStringify(state)}`;
        }),
        persistence_contract: story.persistenceRefs.length > 0
          ? story.persistenceRefs.map((persistenceRef) => {
              const policy = persistenceById.get(persistenceRef)!;
              return `${policy.id}#${hashCanonicalJson(policy)}:${canonicalJsonStringify(policy)}`;
            })
          : ["ProductSpecV2 declares no persistence policy owned by this semantic component."],
        navigation_contract: story.actionRefs.map((actionRef) => {
          const action = actionById.get(actionRef)!;
          return `${action.id}:${canonicalJsonStringify(action.navigation)}`;
        }),
        test_contract: story.evidenceRefs.map((evidenceRef) => {
          const evidence = evidenceById.get(evidenceRef)!;
          return `${evidence.id}#${hashCanonicalJson(evidence)}:${canonicalJsonStringify(evidence)}`;
        }),
      },
    };
  });

  const screenSurfaceRefs = new Map<string, string[]>();
  designGraph.surfaces.forEach((surface) => {
    const values = screenSurfaceRefs.get(surface.source.responseScreenId) ?? [];
    values.push(surface.surfaceRef);
    screenSurfaceRefs.set(surface.source.responseScreenId, values);
  });
  const screenMap = [...screenSurfaceRefs.entries()].map(([screenId, rawSurfaceRefs]) => {
    const binding = bindingByScreen.get(screenId);
    if (!binding) throw new Error(`V2_STORY_RESPONSE_BINDING_MISSING:${screenId}`);
    const surfaceIds = uniqueSorted(rawSurfaceRefs);
    const rootSurface = surfaceIds.map((surfaceRef) => surfaceById.get(surfaceRef)!)
      .find((surface) => surface.composition.kind === "route_root") ?? surfaceById.get(surfaceIds[0]!)!;
    const stories = uniqueSorted(surfaceIds.map((surfaceRef) => {
      const owner = ownerBySurface.get(surfaceRef);
      if (!owner) throw new Error(`V2_STORY_SURFACE_OWNER_MISSING:${surfaceRef}`);
      return owner;
    }));
    return {
      screenId,
      name: binding.responseTitle,
      type: rootSurface.kind,
      description: `Exact DesignInteractionGraphV2 screen for surfaces ${surfaceIds.join(",")}.`,
      surfaceIds,
      stories,
    };
  }).sort((left, right) => compareUtf16(left.screenId, right.screenId));
  return { stories, screenMap };
}

/**
 * Builds only the Product Semantics v2 DB scheduling projection. It never
 * accepts ProductSpec v1 or re-infers v2 identities from story prose.
 */
export function buildProductSemanticsV2StoriesOutput(input: Readonly<{
  repo: string;
  planText: string;
  expectedProductSpecHash: string;
  maxStories?: number | null;
}>): string {
  const plan = resolveCanonicalProductSpecV2FromPlan({ text: input.planText });
  if (plan.status !== "resolved") {
    throw new Error(`V2_STORY_PRODUCT_SPEC_REJECTED:${plan.rejectionCodes.join(",")}`);
  }
  const productSpec = ProductSpecV2EnglishWriteSchema.parse(plan.productSpec);
  if (hashCanonicalJson(productSpec) !== input.expectedProductSpecHash) {
    throw new Error("V2_STORY_ENGLISH_ADMISSION_PRODUCT_SPEC_MISMATCH");
  }
  if (!productSpec.delivery.designRequired) {
    const definitions = produceStoryDefinitionsV2({
      productSpec,
      designGraph: null,
    });
    if (definitions.status !== "produced") {
      throw new Error(`V2_STORY_PARTITION_REJECTED:${definitions.rejectionCodes.join(",")}`);
    }
    if (input.maxStories && definitions.stories.length > input.maxStories) {
      throw new Error(`V2_STORY_CAP_INCOMPATIBLE:required=${definitions.stories.length}:cap=${input.maxStories}`);
    }
    const projected = projectNoDesignCompatibilityStories({
      productSpec: definitions.productSpec,
      definitions: definitions.stories,
    });
    const projection: ProductSemanticsV2CompatibilityProjection = {
      ...projected,
      productSpecSourceHash: plan.sourceHash,
      productSpecHash: hashCanonicalJson(productSpec),
      designGraphHash: null,
    };
    return [
      "STATUS: done",
      "STORY_SCHEDULING_PROJECTION_SCHEMA: setfarm.story-scheduling-projection.v2",
      `PRODUCT_SPEC_SOURCE_HASH: ${projection.productSpecSourceHash}`,
      `PRODUCT_SPEC_HASH: ${projection.productSpecHash}`,
      "DESIGN_GRAPH_HASH: none",
      `STORIES_JSON: ${canonicalJsonStringify(projection.stories)}`,
      `SCREEN_MAP: ${canonicalJsonStringify(projection.screenMap)}`,
      "",
    ].join("\n");
  }
  const stitchDir = path.join(input.repo, "stitch");
  const generationTargets = readCanonicalV2Json({
    filePath: path.join(stitchDir, "GENERATION_TARGETS.json"),
    label: "GENERATION_TARGETS",
    parse: (value) => DesignGenerationTargetsV2Schema.parse(value),
  });
  const producedTargets = produceDesignGenerationTargetsV2(productSpec);
  if (producedTargets.status !== "produced") {
    throw new Error(`V2_STORY_GENERATION_TARGETS_REJECTED:${producedTargets.rejectionCodes.join(",")}`);
  }
  if (hashCanonicalJson(producedTargets.generationTargets) !== hashCanonicalJson(generationTargets)) {
    throw new Error("V2_STORY_GENERATION_TARGETS_MISMATCH");
  }
  const directResponseEvidence = readCanonicalV2Json({
    filePath: path.join(stitchDir, "STITCH_DIRECT_RESPONSE_EVIDENCE.json"),
    label: "DIRECT_RESPONSE_EVIDENCE",
    parse: (value) => StitchDirectResponseEvidenceV2Schema.parse(value),
  });
  const renderedSemantics = readCanonicalV2Json({
    filePath: path.join(stitchDir, "STITCH_RENDERED_SEMANTICS_V2.json"),
    label: "RENDERED_SEMANTICS",
    parse: (value) => StitchRenderedSemanticsV2Schema.parse(value),
  });
  const candidateSelection = readCanonicalV2Json({
    filePath: path.join(stitchDir, "STITCH_TARGET_CANDIDATE_SELECTION.json"),
    label: "CANDIDATE_SELECTION",
    parse: (value) => StitchTargetCandidateSelectionV2Schema.parse(value),
  });
  const responseBindings = readCanonicalV2Json({
    filePath: path.join(stitchDir, "STITCH_RESPONSE_BINDINGS.json"),
    label: "RESPONSE_BINDINGS",
    parse: (value) => StitchTargetResponseBindingsV3Schema.parse(value),
  });
  const projectedGraph = readCanonicalV2Json({
    filePath: path.join(stitchDir, "DESIGN_INTERACTION_GRAPH_V2.json"),
    label: "DESIGN_GRAPH",
    parse: (value) => DesignInteractionGraphV2Schema.parse(value),
  });
  const generationTargetsHash = hashCanonicalJson(generationTargets);
  const directResponseEvidenceHash = hashCanonicalJson(directResponseEvidence);
  const renderedSemanticsHash = hashCanonicalJson(renderedSemantics);
  const candidateSelectionHash = hashCanonicalJson(candidateSelection);
  if (
    generationTargets.productSpecHash !== hashCanonicalJson(productSpec)
    || renderedSemantics.generationTargetsHash !== generationTargetsHash
    || renderedSemantics.directResponseEvidenceHash !== directResponseEvidenceHash
    || candidateSelection.generationTargetsHash !== generationTargetsHash
    || candidateSelection.directResponseEvidenceHash !== directResponseEvidenceHash
    || candidateSelection.renderedSemanticsHash !== renderedSemanticsHash
    || responseBindings.generationTargetsHash !== generationTargetsHash
    || responseBindings.directResponseEvidenceHash !== directResponseEvidenceHash
    || responseBindings.renderedSemanticsHash !== renderedSemanticsHash
    || responseBindings.candidateSelectionHash !== candidateSelectionHash
  ) {
    throw new Error("V2_STORY_DESIGN_AUTHORITY_HASH_MISMATCH");
  }
  const reproducedGraph = produceDesignInteractionGraphV2({
    productSpec,
    generationTargets,
    renderedSemantics,
    candidateSelection,
    responseBindings,
  }).designGraph;
  if (hashCanonicalJson(reproducedGraph) !== hashCanonicalJson(projectedGraph)) {
    throw new Error("V2_STORY_DESIGN_GRAPH_REPRODUCTION_MISMATCH");
  }
  const definitions = produceStoryDefinitionsV2({
    productSpec,
    designGraph: reproducedGraph,
  });
  if (definitions.status !== "produced") {
    throw new Error(`V2_STORY_PARTITION_REJECTED:${definitions.rejectionCodes.join(",")}`);
  }
  if (input.maxStories && definitions.stories.length > input.maxStories) {
    throw new Error(`V2_STORY_CAP_INCOMPATIBLE:required=${definitions.stories.length}:cap=${input.maxStories}`);
  }
  const projected = projectCompatibilityStories({
    productSpec: definitions.productSpec,
    designGraph: reproducedGraph,
    responseBindings,
    definitions: definitions.stories,
  });
  const projection: ProductSemanticsV2CompatibilityProjection = {
    ...projected,
    productSpecSourceHash: plan.sourceHash,
    productSpecHash: hashCanonicalJson(productSpec),
    designGraphHash: hashCanonicalJson(reproducedGraph),
  };
  return [
    "STATUS: done",
    "STORY_SCHEDULING_PROJECTION_SCHEMA: setfarm.story-scheduling-projection.v2",
    `PRODUCT_SPEC_SOURCE_HASH: ${projection.productSpecSourceHash}`,
    `PRODUCT_SPEC_HASH: ${projection.productSpecHash}`,
    `DESIGN_GRAPH_HASH: ${projection.designGraphHash}`,
    `STORIES_JSON: ${canonicalJsonStringify(projection.stories)}`,
    `SCREEN_MAP: ${canonicalJsonStringify(projection.screenMap)}`,
    "",
  ].join("\n");
}
