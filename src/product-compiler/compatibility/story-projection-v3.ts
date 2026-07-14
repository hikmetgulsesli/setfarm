import { hashCanonicalJson } from "../canonical-json.js";
import { produceStoryPartitionV1 } from "../producers/story-partition.js";
import {
  DesignGenerationTargetsV1Schema,
  StitchTargetResponseBindingsV1Schema,
} from "../schemas/design-generation-targets-v1.js";
import {
  ProductSpecV1Schema,
  type ProductActionV1,
  type ProductSpecV1,
} from "../schemas/product-spec-v1.js";

type LegacyScopeTarget = Readonly<{
  role:
    | "app_shell"
    | "route_registration"
    | "surface_component"
    | "action_handler"
    | "state_store"
    | "fixture_data"
    | "persistence_adapter"
    | "test_bridge"
    | "style_integration"
    | "game_runtime";
  surface_id?: string;
  screen_id?: string;
  domain_slug: string;
  target_slug: string;
  action_ids: string[];
  entity_names: string[];
  resolved_path: null;
}>;

type LegacyOwnedAction = Readonly<{
  id: string;
  surface_id: string;
  trigger: string;
  state_change: string;
  ui_feedback: string;
}>;

export type V3CompatibilityStory = Readonly<{
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  depends_on: string[];
  screens: string[];
  requested_dependencies: readonly [];
  scope_targets: LegacyScopeTarget[];
  shared_edit_requests: Array<Readonly<{
    role: "route_registration" | "app_shell";
    action: "register_route" | "wire_action";
    intent: string;
    edit_scope: "route_registration_only" | "owned_action_wiring_only";
    requested_by: string;
  }>>;
  scope_description: string;
  file_skeletons: Readonly<Record<string, never>>;
  implementation_contract: Readonly<{
    owned_surface_ids: string[];
    owned_screen_ids: string[];
    owned_screen_files: string[];
    owned_actions: LegacyOwnedAction[];
    state_contract: string[];
    persistence_contract: string[];
    navigation_contract: string[];
    test_contract: string[];
  }>;
}>;

export type V3CompatibilityScreen = Readonly<{
  screenId: string;
  name: string;
  type: "screen";
  description: string;
  surfaceIds: string[];
  stories: string[];
}>;

export type V3CompatibilityStoryProjection = Readonly<{
  stories: V3CompatibilityStory[];
  screenMap: V3CompatibilityScreen[];
}>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "contract";
}

/** Must stay byte-for-byte equivalent to stitch-to-jsx.mjs toComponentName. */
export function stitchComponentNameV3(title: string): string {
  return title
    .replace(/[\u0131\u0130]/g, "i").replace(/[\u015f\u015e]/g, "s").replace(/[\u00e7\u00c7]/g, "c")
    .replace(/[\u011f\u011e]/g, "g").replace(/[\u00fc\u00dc]/g, "u").replace(/[\u00f6\u00d6]/g, "o")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/).filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
}

function actionStateRefs(action: ProductActionV1): string[] {
  return unique([
    ...action.preconditions.map((item) => item.stateRef),
    ...action.stateDeltas.map((item) => item.stateRef),
    ...action.stateDeltas.flatMap((item) =>
      item.valueFrom.kind === "state" ? [item.valueFrom.stateRef] : []),
    ...action.success.stateRefs,
    ...action.failure.stateRefs,
  ]);
}

function actionPersistenceRefs(action: ProductActionV1): string[] {
  return unique([
    ...action.persistenceEffects.map((item) => item.policyRef),
    ...(action.success.persistenceRefs ?? []),
    ...(action.failure.persistenceRefs ?? []),
  ]);
}

function actionTrigger(action: ProductActionV1): string {
  const inputs = action.input.fields.length === 0
    ? "no inputs"
    : action.input.fields.map((field) => `${field.name}:${field.valueType}${field.required ? ":required" : ":optional"}`).join(",");
  return `${action.trigger.kind}:${action.trigger.sourceRef ?? action.id}; inputs=${inputs}`;
}

function actionStateChange(action: ProductActionV1): string {
  const deltas = action.stateDeltas.map((delta) =>
    `${delta.stateRef}${delta.path}:${delta.operation}<-${delta.valueFrom.kind}`);
  return deltas.length > 0 ? deltas.join("; ") : "No state delta is declared by ProductSpec.";
}

function actionFeedback(action: ProductActionV1): string {
  return `evidence=${unique([
    ...action.evidenceRefs,
    ...action.success.evidenceRefs,
    ...action.failure.evidenceRefs,
  ]).join(",")}; success_visible=${action.success.userVisible ?? false}; failure_visible=${action.failure.userVisible ?? false}`;
}

function actionNavigation(action: ProductActionV1): string {
  if (action.navigation.kind === "route") return `${action.id}:route:${action.navigation.routeRef}`;
  if (action.navigation.kind === "external") return `${action.id}:external:${action.navigation.url}`;
  return `${action.id}:${action.navigation.kind}`;
}

function appTargets(productSpec: ProductSpecV1): LegacyScopeTarget[] {
  const domain = slug(productSpec.product.id);
  const roles: LegacyScopeTarget["role"][] = [
    "app_shell",
    "route_registration",
    "state_store",
    "fixture_data",
    "persistence_adapter",
    "test_bridge",
    "style_integration",
    ...(productSpec.product.class === "game" ? ["game_runtime" as const] : []),
  ];
  return roles.map((role) => ({
    role,
    domain_slug: domain,
    target_slug: role.replace(/_/g, "-"),
    action_ids: [],
    entity_names: [],
    resolved_path: null,
  }));
}

export function compileV3CompatibilityStoryProjection(input: Readonly<{
  productSpec: unknown;
  generationTargets: unknown;
  responseBindings: unknown;
  maxStories?: number | null;
}>): V3CompatibilityStoryProjection {
  const productSpec = ProductSpecV1Schema.parse(input.productSpec);
  const generationTargets = DesignGenerationTargetsV1Schema.parse(input.generationTargets);
  const responseBindings = StitchTargetResponseBindingsV1Schema.parse(input.responseBindings);
  if (generationTargets.productSpecHash !== hashCanonicalJson(productSpec)) {
    throw new Error("V3_STORY_PRODUCT_SPEC_TARGET_HASH_MISMATCH");
  }
  if (responseBindings.generationTargetsHash !== hashCanonicalJson(generationTargets)) {
    throw new Error("V3_STORY_TARGET_BINDING_HASH_MISMATCH");
  }

  const partition = produceStoryPartitionV1({ productSpec });
  if (partition.status !== "produced") {
    throw new Error(`V3_STORY_PARTITION_REJECTED:${partition.rejectionCodes.join(",")}`);
  }
  if (input.maxStories && partition.stories.length > input.maxStories) {
    throw new Error(`V3_STORY_CAP_INCOMPATIBLE:required=${partition.stories.length}:cap=${input.maxStories}`);
  }

  const targetBySurface = new Map(generationTargets.targets.map((target) => [target.surfaceRef, target]));
  const bindingByTarget = new Map(responseBindings.bindings.map((binding) => [binding.targetRef, binding]));
  if (targetBySurface.size !== productSpec.surfaces.length || responseBindings.bindings.length !== generationTargets.targets.length) {
    throw new Error("V3_STORY_DESIGN_CARDINALITY_MISMATCH");
  }

  const surfaceScreen = new Map<string, { screenId: string; title: string; file: string }>();
  const componentOwners = new Map<string, string>();
  for (const surface of productSpec.surfaces) {
    const target = targetBySurface.get(surface.id);
    if (!target) throw new Error(`V3_STORY_TARGET_MISSING:${surface.id}`);
    const binding = bindingByTarget.get(target.targetId);
    if (!binding || binding.responseTitle !== target.expectedScreenTitle) {
      throw new Error(`V3_STORY_RESPONSE_BINDING_MISSING:${target.targetId}`);
    }
    const componentName = stitchComponentNameV3(binding.responseTitle);
    if (!componentName) throw new Error(`V3_STORY_COMPONENT_NAME_EMPTY:${target.targetId}`);
    const prior = componentOwners.get(componentName);
    if (prior) throw new Error(`V3_STORY_COMPONENT_NAME_COLLISION:${prior}:${target.targetId}`);
    componentOwners.set(componentName, target.targetId);
    surfaceScreen.set(surface.id, {
      screenId: binding.responseScreenId,
      title: binding.responseTitle,
      file: `src/screens/${componentName}.tsx`,
    });
  }

  const actionById = new Map(productSpec.actions.map((action) => [action.id, action]));
  const stateById = new Map(productSpec.states.map((state) => [state.id, state]));
  const persistenceById = new Map(productSpec.persistencePolicies.map((policy) => [policy.id, policy]));
  const evidenceById = new Map(productSpec.evidencePredicates.map((predicate) => [predicate.id, predicate]));
  const ownerBySurface = new Map(partition.stories.flatMap((story) =>
    story.surfaceRefs.map((surfaceRef) => [surfaceRef, story.id] as const)));

  const stories = partition.stories.map((story, storyIndex): V3CompatibilityStory => {
    const screens = story.surfaceRefs.map((surfaceRef) => surfaceScreen.get(surfaceRef)!);
    const ownedActions = story.actionRefs.flatMap((actionRef): LegacyOwnedAction[] => {
      const action = actionById.get(actionRef)!;
      return action.surfaceRefs
        .filter((surfaceRef) => story.surfaceRefs.includes(surfaceRef))
        .map((surfaceRef) => ({
          id: action.id,
          surface_id: surfaceRef,
          trigger: actionTrigger(action),
          state_change: actionStateChange(action),
          ui_feedback: actionFeedback(action),
        }));
    });
    const surfaceTargets: LegacyScopeTarget[] = story.surfaceRefs.flatMap((surfaceRef) => {
      const screen = surfaceScreen.get(surfaceRef)!;
      const actionIds = story.actionRefs.filter((actionRef) =>
        actionById.get(actionRef)!.surfaceRefs.includes(surfaceRef));
      const domain = slug(surfaceRef);
      return [
        {
          role: "surface_component" as const,
          surface_id: surfaceRef,
          screen_id: screen.screenId,
          domain_slug: domain,
          target_slug: slug(screen.title),
          action_ids: actionIds,
          entity_names: [],
          resolved_path: null,
        },
        ...actionIds.map((actionId): LegacyScopeTarget => ({
          role: "action_handler",
          surface_id: surfaceRef,
          screen_id: screen.screenId,
          domain_slug: domain,
          target_slug: slug(actionId),
          action_ids: [actionId],
          entity_names: [],
          resolved_path: null,
        })),
      ];
    });
    const acceptanceCriteria = [
      ...story.surfaceRefs.map((surfaceRef) => {
        const screen = surfaceScreen.get(surfaceRef)!;
        return `[PRODUCT_SPEC_SURFACE] ${surfaceRef} is implemented by exact Stitch response ${screen.screenId} (${screen.title}) in ${screen.file}.`;
      }),
      ...story.actionRefs.map((actionRef) => {
        const action = actionById.get(actionRef)!;
        return `[PRODUCT_SPEC_ACTION] ${action.id}; surfaces=${action.surfaceRefs.join(",")}; ${actionTrigger(action)}; ${actionStateChange(action)}; ${actionNavigation(action)}; ${actionFeedback(action)}.`;
      }),
      ...story.evidenceRefs.map((evidenceRef) => {
        const evidence = evidenceById.get(evidenceRef)!;
        return `[PRODUCT_SPEC_EVIDENCE] ${evidence.id}:${evidence.kind}:${evidence.subjectRef}:${evidence.assertion.operator}.`;
      }),
    ];
    return {
      id: story.id,
      title: `${productSpec.product.name}: ${story.title}`.slice(0, 500),
      description: `${story.description} ProductSpec refs: surfaces=${story.surfaceRefs.join(",")}; actions=${story.actionRefs.join(",")}.`,
      acceptanceCriteria,
      depends_on: [...story.dependsOn],
      screens: screens.map((screen) => screen.screenId),
      requested_dependencies: [],
      scope_targets: [...(storyIndex === 0 ? appTargets(productSpec) : []), ...surfaceTargets],
      shared_edit_requests: storyIndex === 0 ? [] : [
        {
          role: "route_registration",
          action: "register_route",
          intent: `Register only ProductSpec surfaces ${story.surfaceRefs.join(",")} and routes owned by ${story.id}.`,
          edit_scope: "route_registration_only",
          requested_by: story.id,
        },
        {
          role: "app_shell",
          action: "wire_action",
          intent: `Wire only ProductSpec actions ${story.actionRefs.join(",")} from ${story.id}.`,
          edit_scope: "owned_action_wiring_only",
          requested_by: story.id,
        },
      ],
      scope_description: `Canonical compatibility projection for surfaces ${story.surfaceRefs.join(", ")} and actions ${story.actionRefs.join(", ")}.`,
      file_skeletons: {},
      implementation_contract: {
        owned_surface_ids: [...story.surfaceRefs],
        owned_screen_ids: screens.map((screen) => screen.screenId),
        owned_screen_files: screens.map((screen) => screen.file),
        owned_actions: ownedActions,
        state_contract: story.stateRefs.map((stateRef) => {
          const state = stateById.get(stateRef)!;
          return `${state.id}:${state.kind}; initial=${JSON.stringify(state.initialValue)}; invariants=${state.invariants.join("|") || "none"}`;
        }),
        persistence_contract: story.persistenceRefs.length > 0
          ? story.persistenceRefs.map((persistenceRef) => {
              const policy = persistenceById.get(persistenceRef)!;
              return `${policy.id}:${policy.kind}:${policy.owner}:${policy.durability}; entities=${policy.entityRefs.join(",") || "none"}`;
            })
          : ["ProductSpec declares no persistence policy owned by this story."],
        navigation_contract: story.actionRefs.map((actionRef) => actionNavigation(actionById.get(actionRef)!)),
        test_contract: story.evidenceRefs.map((evidenceRef) => {
          const evidence = evidenceById.get(evidenceRef)!;
          return `${evidence.id}:${evidence.kind}:${evidence.subjectRef}:${evidence.assertion.operator}`;
        }),
      },
    };
  });

  const screenMap = productSpec.surfaces
    .map((surface): V3CompatibilityScreen => {
      const screen = surfaceScreen.get(surface.id)!;
      const owner = ownerBySurface.get(surface.id);
      if (!owner) throw new Error(`V3_STORY_SURFACE_OWNER_MISSING:${surface.id}`);
      return {
        screenId: screen.screenId,
        name: screen.title,
        type: "screen",
        description: `${surface.name} ProductSpec surface`,
        surfaceIds: [surface.id],
        stories: [owner],
      };
    })
    .sort((left, right) => compareUtf16(left.screenId, right.screenId));
  return { stories, screenMap };
}
