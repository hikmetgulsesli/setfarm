import fs from "node:fs";
import path from "node:path";
import type { ClaimContext } from "../types.js";
import { pgGet } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import {
  collectUiBehaviorRequirements,
  computePredictedScreenFiles,
  extractExplicitMaxStories,
  isPrdPseudoScreen,
  type UiBehaviorRequirement,
} from "./context.js";
import { REOPENABLE_APP_INTEGRATION_FILES } from "../../story-scope.js";
import {
  buildOwnedActionsForScreens,
  surfaceActionsForScreens,
  type StoryOwnedAction,
} from "./action-control-mapper.js";
import { contextPrdText, parsePrdContract, type PrdSurfaceAction } from "./prd-contract-parser.js";

type PredictedScreen = ReturnType<typeof computePredictedScreenFiles>[number];
type ProjectKind = "game" | "product";

interface StoryDraft {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  depends_on: string[];
  screens: string[];
  requested_dependencies: StoryRequestedDependency[];
  scope_targets: StoryScopeTarget[];
  shared_edit_requests: StorySharedEditRequest[];
  scope_files?: string[];
  shared_files?: string[];
  scope_description: string;
  file_skeletons: Record<string, string>;
  implementation_contract: StoryImplementationContract;
}

interface StoryRequestedDependency {
  name: string;
  ecosystem: "npm" | "python" | "gradle" | "swift" | "none";
  reason: string;
  requested_by_action_ids: string[];
}

interface StoryScopeTarget {
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
    | "game_runtime"
    | "api_route"
    | "cli_command";
  surface_id?: string;
  screen_id?: string;
  domain_slug: string;
  target_slug: string;
  action_ids: string[];
  entity_names: string[];
  resolved_path: null;
}

interface StorySharedEditRequest {
  role: "route_registration" | "style_integration" | "app_shell" | "test_bridge";
  action: "register_route" | "wire_action" | "append_style_hook" | "expose_test_bridge";
  intent: string;
  edit_scope: string;
  requested_by: string;
}

interface StoryImplementationContract {
  owned_surface_ids: string[];
  owned_screen_ids: string[];
  owned_screen_files: string[];
  owned_actions: StoryOwnedAction[];
  state_contract: string[];
  persistence_contract: string[];
  navigation_contract: string[];
  test_contract: string[];
}

interface StoryGroup {
  key: "primary" | "metrics" | "settings" | "support";
  title: string;
  description: string;
  screens: PredictedScreen[];
}

const APP_SCOPE_FILES = [
  "src/App.tsx",
  "src/App.css",
  "src/main.tsx",
  "src/index.css",
  "src/contexts/AppContext.tsx",
  "src/types/domain.ts",
  "src/hooks/useAppState.ts",
  "src/utils/storage.ts",
];

const STORY_APP_INTEGRATION_FILES = APP_SCOPE_FILES;

function slugify(value: string, fallback = "app"): string {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || fallback;
}

function compactText(text: string, fallback: string): string {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 180) : fallback;
}

function humanizeProjectLabel(input: string, fallback: string): string {
  const cleaned = String(input || "")
    .replace(/^(?:Project)\s*:\s*/i, "")
    .replace(/\s+(?:Build|Create|Make|Implement|Design|Write|Add|Fix|Develop|Scaffold)\b[\s\S]*$/i, "")
    .replace(/\s+(?:React|Vite|TypeScript|Tailwind|Next\.?js|Node\.?js)\b[\s\S]*$/i, "")
    .replace(/[.;:,\-\s]+$/g, "")
    .trim();

  if (!cleaned) return fallback;
  const hasSlugShape = /[-_]/.test(cleaned) || /^[a-z0-9]+$/.test(cleaned);
  if (!hasSlugShape) return compactText(cleaned, fallback);

  const words = cleaned
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word && !/^\d{4,8}$/.test(word));
  if (words.length === 0) return compactText(cleaned, fallback);

  const acronyms = new Set(["api", "crm", "erp", "hr", "ui", "ux", "ai", "qa", "iot"]);
  return compactText(words.map((word) => {
    const lower = word.toLowerCase();
    if (acronyms.has(lower)) return lower.toUpperCase();
    if (lower === "rootfix") return "Root Fix";
    if (lower === "scopefix") return "Scope Fix";
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(" "), fallback);
}

function extractProjectLabel(text: string, fallback: string): string {
  const raw = String(text || "");
  const projectLine = raw.match(/(?:^|\n)\s*(?:Project)\s*:\s*([^\n]+)/i)?.[1]?.trim();
  const candidate = projectLine || raw.split(/\n+/).map((line) => line.trim()).find(Boolean) || "";
  const cleaned = candidate
    .replace(/^(?:Project)\s*:\s*/i, "")
    .replace(/\s+(?:Build|Create|Make|Implement|Platform|React|Vite|TypeScript)\b[\s\S]*$/i, "")
    .replace(/[.;:,\-\s]+$/g, "")
    .trim();
  return humanizeProjectLabel(cleaned, fallback);
}

function inferProjectKind(params: {
  task?: string;
  context?: Record<string, string>;
  predicted?: PredictedScreen[];
  screenMap?: any[];
}): ProjectKind {
  const platform = String(params.context?.["platform"] || params.context?.["PLATFORM"] || "").toLowerCase();
  if (platform === "game") return "game";
  if (platform && ["web", "mobile", "desktop", "api", "cli"].includes(platform)) return "product";

  const screenText = [
    ...(params.predicted || []).map((screen) => `${screen.screenId} ${screen.title} ${screen.filePath}`),
    ...(params.screenMap || []).map((screen: any) => `${screen?.screenId || screen?.id || ""} ${screen?.title || screen?.name || ""} ${screen?.type || ""} ${screen?.description || ""}`),
  ].join(" ");
  const text = [
    params.task || "",
    params.context?.["task"] || "",
    params.context?.["prd"] || "",
    params.context?.["project_name"] || "",
    params.context?.["project_slug"] || "",
    screenText,
  ].join(" ").toLowerCase();

  if (/\b(game|puzzle|arcade|score|level|pause|resume|restart|keyboard controls?|playfield|game board)\b/.test(text)) {
    return "game";
  }
  return "product";
}

function loadScreenMap(repo: string): any[] {
  const p = path.join(repo, "stitch", "SCREEN_MAP.json");
  if (!fs.existsSync(p)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
    return Array.isArray(parsed) ? parsed.filter((screen: any) => !isPrdPseudoScreen(screen)) : [];
  } catch {
    return [];
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function appImplementationContract(projectKind: ProjectKind): StoryImplementationContract {
  if (projectKind === "game") {
    return {
      owned_surface_ids: [],
      owned_screen_ids: [],
      owned_screen_files: [],
      owned_actions: [
        {
          id: "ACT_APP_STATE_BOOTSTRAP",
          trigger: "Application load and shared game shell initialization",
          state_change: "Initialize gameplay state, navigation target, storage status, and window.app test bridge.",
          ui_feedback: "The first rendered surface is the actual playable game/product state, not a landing page.",
        },
      ],
      state_contract: [
        "Own shared gameplay state, active screen, score/progress, level/difficulty where present, paused/gameOver, storage status, and last error.",
      ],
      persistence_contract: [
        "Persist only explicit game preferences/high score or PRD-required state; corrupted persisted data produces visible recovery feedback.",
      ],
      navigation_contract: [
        "Expose stable navigation/action handlers for screen-owner stories without implementing sibling screens in this story.",
      ],
      test_contract: [
        "window.app exposes live gameplay/product state and actions required by smoke/final tests.",
      ],
    };
  }
  return {
    owned_surface_ids: [],
    owned_screen_ids: [],
    owned_screen_files: [],
    owned_actions: [
      {
        id: "ACT_APP_STATE_BOOTSTRAP",
        trigger: "Application load and shared app shell initialization",
        state_change: "Initialize active surface, selected item, storage status, last error, active panel, and item counts.",
        ui_feedback: "The first rendered surface is the actual requested product workflow, not a landing page.",
      },
    ],
    state_contract: [
      "Own shared app shell state, navigation state, selected entity, storage status, last error, active panel, and item count.",
    ],
    persistence_contract: [
      "Persist local preferences/records only when PRD or DESIGN_DOM requires persistence; corrupted persisted data shows recoverable feedback.",
    ],
    navigation_contract: [
      "Expose stable navigation/action handlers for screen-owner stories without implementing sibling screens in this story.",
    ],
    test_contract: [
      "window.app exposes active screen/route, selected record, counts, storage status, last error, and active panel when those concepts exist.",
    ],
  };
}

function screenImplementationContract(params: {
  repo: string;
  title: string;
  screenIds: string[];
  screenFiles: string[];
  semanticActions?: PrdSurfaceAction[];
}): StoryImplementationContract {
  const ownedActions = buildOwnedActionsForScreens(params.repo, params.screenIds, params.semanticActions || []);
  return {
    owned_surface_ids: unique((params.semanticActions || []).map((action) => action.surfaceId || "")),
    owned_screen_ids: params.screenIds,
    owned_screen_files: params.screenFiles,
    owned_actions: ownedActions,
    state_contract: [
      `${params.title}: own the state needed by the listed generated controls and use shared app state/context for cross-screen data.`,
    ],
    persistence_contract: [
      `${params.title}: persist only PRD/DESIGN_DOM-required values; otherwise keep transient UI state local/shared.`,
    ],
    navigation_contract: [
      `${params.title}: every owned screen must be reachable from the first rendered app surface or embedded into a reachable parent, with visible return/close behavior where applicable.`,
    ],
    test_contract: [
      `${params.title}: tests must prove visible state/DOM/route/storage feedback for owned controls, not only click without throw.`,
    ],
  };
}

function screenDisplayTitle(screen: PredictedScreen): string {
  const title = compactText(screen.title || screen.screenId, screen.screenId)
    .replace(/\s+screen$/i, "")
    .trim();
  return title || screen.screenId;
}

function formatScreenListTitle(screens: PredictedScreen[], fallback: string): string {
  const titles = unique(screens.map(screenDisplayTitle));
  if (titles.length === 0) return fallback;
  if (titles.length === 1) return `${titles[0]} screen`;
  if (titles.length === 2) return `${titles[0]} and ${titles[1]} screens`;
  if (titles.length === 3) return `${titles[0]}, ${titles[1]} and ${titles[2]} screens`;
  return `${titles[0]}, ${titles[1]} and ${titles.length - 2} more screens`;
}

function storyGroupTitle(group: StoryGroup): string {
  return formatScreenListTitle(group.screens, group.title);
}

function storyGroupDescription(group: StoryGroup): string {
  const titles = unique(group.screens.map(screenDisplayTitle));
  const owned = titles.length > 0 ? titles.join(", ") : group.title;
  const plural = titles.length === 1 ? "screen" : "screens";
  const demonstrative = titles.length === 1 ? "that screen" : "those screens";
  const pronoun = titles.length === 1 ? "it" : "these owned screens";
  return `Implement only the owned generated ${plural}: ${owned}. Wire visible controls declared for ${demonstrative} in DESIGN_DOM. You may edit app integration files only to connect these owned screens to shared state, navigation, and actions; do not implement broader ${group.key} behavior unless it is present in ${pronoun}, and do not edit sibling screen groups.`;
}

export function buildAcceptanceCriteria(repo: string): string[] {
  const reqs = collectUiBehaviorRequirements(repo);
  const criteria = reqs.slice(0, 30).map((req) => {
    const trigger = [req.label, req.icon ? `icon ${req.icon}` : ""].filter(Boolean).join(" / ");
    return `${req.screenTitle}: ${req.kind} \"${trigger}\" must produce visible behavior: ${req.expectedBehavior}.`;
  });
  criteria.push("All visible active buttons, links, icons, inputs, and selects from Stitch screens have real behavior or an explicit disabled/hidden state.");
  criteria.push("All generated screens are reachable from the first rendered app surface by a visible button/link/menu item/keyboard shortcut, or are embedded into a reachable screen; no orphan route/phase-only screens remain.");
  criteria.push("Stateful interactions persist only when the PRD or DESIGN_DOM explicitly requires persistence; no unrelated demo flows are added.");
  return unique(criteria).slice(0, 40);
}

function behaviorCriterion(req: UiBehaviorRequirement): string {
  const trigger = [req.label, req.icon ? `icon ${req.icon}` : ""].filter(Boolean).join(" / ");
  return `${req.screenTitle}: ${req.kind} "${trigger}" must produce visible behavior: ${req.expectedBehavior}.`;
}

function buildAcceptanceCriteriaForScreens(repo: string, screenIds: string[], fallbackTitle: string): string[] {
  const screenSet = new Set(screenIds);
  const criteria = collectUiBehaviorRequirements(repo)
    .filter((req) => screenSet.has(req.screenId))
    .map(behaviorCriterion);

  criteria.push(`${fallbackTitle}: all visible active controls have non-empty handlers or an explicit disabled/hidden state.`);
  criteria.push(`${fallbackTitle}: each owned generated screen is reachable from the first rendered app surface through visible navigation/control flow or is embedded into a reachable parent screen; no owned screen remains orphaned.`);
  criteria.push(`${fallbackTitle}: screen state changes are visible in the DOM and remain responsive on desktop and mobile.`);
  criteria.push(`${fallbackTitle}: no product control uses data-smoke-ignore to bypass smoke checks.`);
  return unique(criteria);
}

function buildScreenStoryScopeFiles(groupScreenFiles: string[]): string[] {
  return unique([
    ...groupScreenFiles,
    ...STORY_APP_INTEGRATION_FILES.filter((file) => REOPENABLE_APP_INTEGRATION_FILES.includes(file)),
  ]);
}

export function buildSingleStoryScopeFiles(screenFiles: string[]): string[] {
  return unique([
    ...screenFiles,
    "src/App.tsx",
    "src/App.css",
    "src/main.tsx",
    "src/index.css",
    "src/contexts/AppContext.tsx",
  ]);
}

function screenBucket(screen: PredictedScreen, projectKind: ProjectKind): StoryGroup["key"] {
  const text = `${screen.screenId} ${screen.title} ${screen.filePath}`.toLowerCase();
  if (projectKind === "game") {
    if (/setting|option|control|difficulty|audio|preferences?/.test(text)) return "settings";
    if (/score|level|line|stat|status|preview|next|queue|hud|metric/.test(text)) return "metrics";
    if (/error|empty|fallback|support|help|gameover|game over|result|pause|paused/.test(text)) return "support";
    return "primary";
  }
  if (/setting|profile|account|preference|user/.test(text)) return "settings";
  if (/insight|stat|metric|dashboard|report|pipeline|kanban|board|analysis/.test(text)) return "metrics";
  if (/error|storage|empty|fallback|support|help/.test(text)) return "support";
  return "primary";
}

function groupTemplates(projectKind: ProjectKind): StoryGroup[] {
  if (projectKind === "game") {
    return [
      {
        key: "primary",
        title: "Playable gameplay screens",
        description: "Game board, main menu, direct gameplay controls, and primary player actions.",
        screens: [],
      },
      {
        key: "metrics",
        title: "Score, progress and status screens",
        description: "Score, level/progress, status, HUD panels, and task-requested gameplay summaries.",
        screens: [],
      },
      {
        key: "settings",
        title: "Game options and controls screens",
        description: "Difficulty, audio, keyboard/touch controls, and option toggles.",
        screens: [],
      },
      {
        key: "support",
        title: "Pause, game-over and help states",
        description: "Pause overlay, game-over/restart, help, empty, error, retry and recovery states.",
        screens: [],
      },
    ];
  }

  return [
    {
      key: "primary",
      title: "Primary workflow screens",
      description: "Main list/detail/form workflow screens and direct user actions.",
      screens: [],
    },
    {
      key: "metrics",
      title: "Pipeline, metrics and status screens",
      description: "Operational board, dashboard, summary, reporting and status views.",
      screens: [],
    },
    {
      key: "settings",
      title: "Settings, profile and account screens",
      description: "Profile/account controls, preferences, toggles and close/back behavior.",
      screens: [],
    },
    {
      key: "support",
      title: "Empty, error and supporting states",
      description: "Empty, loading, storage-error, retry and recovery states.",
      screens: [],
    },
  ];
}

function chooseScreenGroups(predicted: PredictedScreen[], maxStories: number | null, projectKind: ProjectKind): StoryGroup[] {
  const cap = maxStories && maxStories > 1 ? Math.max(1, Math.min(maxStories - 1, 4)) : 4;
  const groups = groupTemplates(projectKind);

  const byKey = new Map(groups.map((group) => [group.key, group]));
  for (const screen of predicted) {
    byKey.get(screenBucket(screen, projectKind))?.screens.push(screen);
  }

  const nonEmpty = groups.filter((group) => group.screens.length > 0);
  if (nonEmpty.length === 0) return [];
  if (nonEmpty.length <= cap) return nonEmpty;

  const kept = nonEmpty.slice(0, cap);
  const overflow = nonEmpty.slice(cap).flatMap((group) => group.screens);
  kept[kept.length - 1].screens.push(...overflow);
  return kept;
}

function appStoryDraft(params: {
  product: string;
  predicted: PredictedScreen[];
  screenFiles: string[];
  screenFileSet: Set<string>;
  projectKind: ProjectKind;
}): StoryDraft {
  const screens = unique(params.predicted.map((s) => s.screenId));
  if (params.projectKind === "game") {
    return {
      id: "US-001",
      title: `${params.product} - game engine, state and test bridge`,
      description: "Build the shared game shell, reducer/state model, keyboard input wiring, persistence helper boundaries, smoke-visible window.app game state, and context/actions used by generated screens without editing read-only screen components.",
      acceptanceCriteria: [
        "App shell renders the playable game surface first, not a generic landing page or dashboard.",
        "Shared shell exposes stable navigation targets and action handlers for screen-owner stories without requiring pending generated screens to be visible in this story.",
        "HUD/status data is derived from the same gameplay state used by the simulation; screen-owner stories embed or route generated HUD/status screens when they own those screens.",
        "App shell does not pass invented props to generated shared screen components; render read-only screens with their existing TypeScript props only.",
        "If App renders generated Stitch screens, it wires controls through declared actions props/action IDs from SCREEN_INDEX, never through textContent/DOM-label matching.",
        "Reducer/state transitions are pure and immutable; persistence, timers, and DOM/test bridge side effects live in effects or action wrappers.",
        "Shared game state exposes visible screen, status, score/progress, level/difficulty where present, gameplay entities, paused/gameOver, storage status, and last error through window.app.",
        "Start, pause, resume, restart, and game tick actions exist in owned state/context/window.app code; generated screen button wiring is owned by the screen stories.",
        "Keyboard controls implemented in owned files produce visible gameplay state changes when the game is active.",
        "Touch/gameplay controls are visible and active only in states where they can affect gameplay; on menu, paused, game-over, or inactive states they are hidden or explicitly disabled/aria-disabled.",
        "HUD and status displays are derived from the same state source used by gameplay simulation; no ref-only or duplicated display state can drift.",
        "Game loop timers and repeated input use stable effects/callbacks so intervals do not restart every frame and pause/game-over stops movement.",
        "Persistence is limited to high score/preferences unless explicitly requested; corrupted persisted data produces visible recovery feedback when persistence is used.",
        "No product control uses data-smoke-ignore; inactive controls are disabled/hidden explicitly.",
      ],
      depends_on: [],
      screens: [],
      requested_dependencies: [],
      scope_targets: buildAppScopeTargets(params.product, params.projectKind),
      shared_edit_requests: [],
      scope_description: "Shared game integration and state ownership. Generated src/screens files are read-only shared context here: do not edit them, do not change their prop interfaces, and do not pass props they do not already declare. If generated screens expose typed actions props, App may pass those declared action handlers; never use textContent or DOM-label matching for control routing. Screen stories own all edits and additional button wiring for those files.",
      file_skeletons: fileSkeletons(APP_SCOPE_FILES, params.screenFileSet),
      implementation_contract: appImplementationContract(params.projectKind),
    };
  }

  return {
    id: "US-001",
    title: `${params.product} - app shell, state and persistence`,
    description: "Build the shared application shell, navigation state, domain types, persistence helpers, requested settings/preferences wiring, and smoke-visible window.app state used by generated screens.",
    acceptanceCriteria: [
      "App shell provides the actual product surface and shared navigation/state contracts, not a landing page.",
      "Shared shell exposes stable navigation targets and action handlers for screen-owner stories without requiring pending generated screens to be visible in this story.",
      "Shared state exposes visible active screen, selected item, storage status, last error, active panel, and item count through window.app.",
      "Declared settings/preferences controls open a visible panel/drawer/page or inline surface only when requested by the PRD/Product Surfaces, and close/back controls visibly dismiss that surface.",
      "localStorage success, corrupted JSON, retry, and clear-data paths produce visible DOM feedback when persistence is required.",
      "No product control uses data-smoke-ignore; inactive controls are disabled/hidden explicitly.",
    ],
    depends_on: [],
    screens: [],
    requested_dependencies: [],
    scope_targets: buildAppScopeTargets(params.product, params.projectKind),
    shared_edit_requests: [],
    scope_description: "Shared app integration and state ownership. Generated src/screens files are read-only shared context here; screen stories own all edits to those files.",
    file_skeletons: fileSkeletons(APP_SCOPE_FILES, params.screenFileSet),
    implementation_contract: appImplementationContract(params.projectKind),
  };
}

function fileSkeletons(files: string[], screenFiles: Set<string>): Record<string, string> {
  return Object.fromEntries(files.map((file) => [
    file,
    screenFiles.has(file)
      ? "Generated Stitch screen wired to shared app state and visible behavior handlers."
      : "Shared app state, integration, styling, or persistence implementation file.",
  ]));
}

function targetFor(role: StoryScopeTarget["role"], params: {
  domainSlug: string;
  targetSlug: string;
  screenId?: string;
  surfaceId?: string;
  actionIds?: string[];
  entityNames?: string[];
}): StoryScopeTarget {
  return {
    role,
    surface_id: params.surfaceId,
    screen_id: params.screenId,
    domain_slug: params.domainSlug,
    target_slug: params.targetSlug,
    action_ids: params.actionIds || [],
    entity_names: params.entityNames || [],
    resolved_path: null,
  };
}

function buildAppScopeTargets(product: string, projectKind: ProjectKind): StoryScopeTarget[] {
  const domainSlug = slugify(product);
  return unique([
    "app_shell",
    "state_store",
    "fixture_data",
    "persistence_adapter",
    "test_bridge",
    "style_integration",
    ...(projectKind === "game" ? ["game_runtime"] : []),
  ]).map((role) => targetFor(role as StoryScopeTarget["role"], {
    domainSlug,
    targetSlug: role === "game_runtime" ? "game-runtime" : domainSlug,
  }));
}

function buildScreenScopeTargets(
  screens: PredictedScreen[],
  semanticActions: PrdSurfaceAction[],
  fallbackDomain: string,
): StoryScopeTarget[] {
  const targets: StoryScopeTarget[] = [];
  for (const screen of screens) {
    const title = screenDisplayTitle(screen);
    const actionsForScreen = surfaceActionsForScreens([screen], [screen.screenId], semanticActions);
    const actionIds = actionsForScreen.map((action) => action.id);
    const surfaceId = actionsForScreen.find((action) => action.surfaceId)?.surfaceId;
    const domainSlug = slugify(surfaceId || fallbackDomain || title, fallbackDomain || "surface");
    targets.push(targetFor("surface_component", {
      domainSlug,
      targetSlug: slugify(title, screen.screenId.toLowerCase()),
      screenId: screen.screenId,
      surfaceId,
      actionIds,
    }));
    for (const actionId of actionIds) {
      targets.push(targetFor("action_handler", {
        domainSlug,
        targetSlug: slugify(actionId, "action"),
        screenId: screen.screenId,
        surfaceId,
        actionIds: [actionId],
      }));
    }
  }
  return targets;
}

function buildSharedEditRequests(storyId: string, screens: PredictedScreen[]): StorySharedEditRequest[] {
  if (screens.length === 0) return [];
  return [
    {
      role: "route_registration",
      action: "register_route",
      intent: "Register only this story's resolved surface components in the app shell navigation/route registry.",
      edit_scope: "route_registration_only",
      requested_by: storyId,
    },
    {
      role: "app_shell",
      action: "wire_action",
      intent: "Wire only this story's owned PRD actions and Stitch controls to existing shared app state.",
      edit_scope: "owned_action_wiring_only",
      requested_by: storyId,
    },
  ];
}

function buildScreenMap(screenMap: any[], predicted: PredictedScreen[], stories: StoryDraft[]): any[] {
  const screenToStories = new Map<string, string[]>();
  for (const story of stories) {
    for (const screenId of story.screens) {
      const current = screenToStories.get(screenId) || [];
      current.push(story.id);
      screenToStories.set(screenId, current);
    }
  }

  return (screenMap.length > 0 ? screenMap.filter((screen: any) => !isPrdPseudoScreen(screen)) : predicted.map((s) => ({
    screenId: s.screenId,
    name: s.title,
    type: "screen",
    description: s.title,
  }))).map((s: any) => {
    const screenId = s.screenId || s.id;
    return {
      screenId,
      name: s.name || s.title || screenId,
      type: s.type || "screen",
      description: s.description || s.name || s.title || "Generated screen",
      stories: screenToStories.get(screenId) || [],
    };
  }).filter((s: any) => s.screenId);
}

export function buildAutoStoriesOutput(params: {
  repo: string;
  task?: string;
  context?: Record<string, string>;
  predicted: PredictedScreen[];
  screenMap?: any[];
  maxStories?: number | null;
}): string {
  const { repo, predicted, screenMap = [], maxStories = null } = params;
  const product = extractProjectLabel(
    params.context?.["project_display_name"] || params.context?.["project_name"] || params.context?.["project_slug"] || params.context?.["task"] || params.task || "",
    "Uygulama",
  );
  const screenFiles = unique(predicted.map((s) => s.filePath));
  const screenFileSet = new Set(screenFiles);
  const projectKind = inferProjectKind(params);
  const prdContract = parsePrdContract(contextPrdText(params.context));
  const semanticSurfaceActions = prdContract.surfaceActions;

  let stories: StoryDraft[];
  if (maxStories === 1) {
    const scopeFiles = buildSingleStoryScopeFiles(screenFiles);
    const screenIds = unique(predicted.map((s) => s.screenId));
    stories = [{
      id: "US-001",
      title: `${product} - complete single-story implementation`,
      description: "Single explicit-cap story covering generated screens, app integration, visible controls, route/state behavior, and any persistence explicitly required by PRD/DESIGN_DOM.",
      acceptanceCriteria: buildAcceptanceCriteria(repo),
      depends_on: [],
      screens: unique(predicted.map((s) => s.screenId)),
      requested_dependencies: [],
      scope_targets: [
        ...buildAppScopeTargets(product, projectKind),
        ...buildScreenScopeTargets(predicted, semanticSurfaceActions, slugify(product)),
      ],
      shared_edit_requests: [],
      scope_description: "One-story explicit user cap: implement all generated screens, visible button/icon behavior, app integration, and only the state/persistence behavior required by the project context.",
      file_skeletons: fileSkeletons(scopeFiles, screenFileSet),
      implementation_contract: screenImplementationContract({
        repo,
        title: "complete single-story implementation",
        screenIds,
        screenFiles,
        semanticActions: surfaceActionsForScreens(predicted, screenIds, semanticSurfaceActions),
      }),
    }];
  } else {
    const groups = chooseScreenGroups(predicted, maxStories, projectKind);
    const appStory = appStoryDraft({ product, predicted, screenFiles, screenFileSet, projectKind });

    stories = [appStory];
    groups.forEach((group, index) => {
      const id = `US-${String(index + 2).padStart(3, "0")}`;
      const groupScreenFiles = unique(group.screens.map((s) => s.filePath));
      const groupScreenIds = unique(group.screens.map((s) => s.screenId));
      const scopeFiles = buildScreenStoryScopeFiles(groupScreenFiles);
      const title = storyGroupTitle(group);
      stories.push({
        id,
        title: `${product} - ${title}`,
        description: storyGroupDescription(group),
        acceptanceCriteria: buildAcceptanceCriteriaForScreens(repo, groupScreenIds, title),
        depends_on: ["US-001"],
        screens: groupScreenIds,
        requested_dependencies: [],
        scope_targets: buildScreenScopeTargets(group.screens, semanticSurfaceActions, slugify(product)),
        shared_edit_requests: buildSharedEditRequests(id, group.screens),
        scope_description: `${title}: own generated screens ${groupScreenFiles.join(", ")} plus app integration files needed to wire those screens to shared state, navigation, and actions. Do not edit sibling screen groups or unrelated app behavior.`,
        file_skeletons: fileSkeletons(scopeFiles, screenFileSet),
        implementation_contract: screenImplementationContract({
          repo,
          title,
          screenIds: groupScreenIds,
          screenFiles: groupScreenFiles,
          semanticActions: surfaceActionsForScreens(predicted, groupScreenIds, semanticSurfaceActions),
        }),
      });
    });
  }

  const mappedScreens = buildScreenMap(screenMap, predicted, stories);
  return [
    "STATUS: done",
    "STORIES_JSON:",
    JSON.stringify(stories, null, 2),
    "SCREEN_MAP:",
    JSON.stringify(mappedScreens, null, 2),
    "",
  ].join("\n");
}

export async function preClaim(ctx: ClaimContext): Promise<void> {
  if (process.env.SETFARM_DISABLE_AUTO_STORIES === "1") return;

  const maxStories = extractExplicitMaxStories(`${ctx.task || ""}\n${ctx.context["task"] || ""}\n${ctx.context["prd"] || ""}`);

  const existing = await pgGet<{ cnt: string }>("SELECT COUNT(*)::text as cnt FROM stories WHERE run_id = $1", [ctx.runId]);
  if (Number(existing?.cnt || 0) > 0) return;

  const repo = ctx.context["repo"] || ctx.context["REPO"] || "";
  if (!repo) return;
  const predicted = computePredictedScreenFiles(repo);
  if (predicted.length === 0) return;

  const screenMap = loadScreenMap(repo);
  const output = buildAutoStoriesOutput({
    repo,
    task: ctx.task,
    context: ctx.context,
    predicted,
    screenMap,
    maxStories,
  });

  const step = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
  if (!step?.id) return;

  const { completeStep } = await import("../../step-ops.js");
  await completeStep(step.id, output);
  logger.info(`[module:stories preclaim] AUTO-COMPLETED stories without planner agent (${predicted.length} screen(s), ${Buffer.byteLength(output, "utf-8")} bytes)`, {
    runId: ctx.runId,
    stepId: ctx.stepId,
  });
}
