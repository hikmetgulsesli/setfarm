#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2));

const defaultTask =
  "Build a compact browser CRM called Customer Desk. It should manage accounts, contacts, leads, opportunities, activities, saved filters, reporting insights, settings, empty and error states, and every visible button/action should update real app state.";

const task = args.task || defaultTask;
const projectName = args["project-name"] || deriveProjectName(task);
const projectSlug = slugify(projectName);
const platform = args.platform || inferPlatform(task);
const techStack = args.stack || inferStack(task, platform);
const uiLanguage = args["ui-language"] || inferUiLanguage(task);
const dbRequired = args.db || inferDb(task);
const designRequired = args["design-required"] || String(isDesignRequired(platform));

const surfaces = buildProductSurfaces(task);
const prd = buildPrd({
  task,
  projectName,
  platform,
  techStack,
  uiLanguage,
  dbRequired,
  designRequired,
  surfaces,
});

process.stdout.write(
  [
    "STATUS: done",
    "",
    `PROJECT_NAME: ${projectName}`,
    `PROJECT_SLUG: ${projectSlug}`,
    `PLATFORM: ${platform}`,
    `TECH_STACK: ${techStack}`,
    `UI_LANGUAGE: ${uiLanguage}`,
    `DB_REQUIRED: ${dbRequired}`,
    `DESIGN_REQUIRED: ${designRequired}`,
    "",
    "PRD:",
    prd,
    "",
  ].join("\n"),
);

function parseArgs(tokens) {
  const parsed = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = tokens[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function deriveProjectName(text) {
  const explicit =
    text.match(/\bcalled\s+([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,4})\b/) ||
    text.match(/\bnamed\s+([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,4})\b/) ||
    text.match(/\bproject\s+([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,4})\b/i);
  if (explicit) return explicit[1].trim().replace(/[.?!,:;]+$/, "");

  if (/\bcrm\b|customer|account|lead|opportunit/i.test(text)) return "Customer Desk";
  if (/ticket|service desk|support/i.test(text)) return "Ticket Desk";
  if (/inventory|stock|warehouse/i.test(text)) return "Stock Desk";
  if (/game|arcade|puzzle/i.test(text)) return "Play Surface";
  return "Product App";
}

function slugify(value) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0130I]/g, "i")
    .replace(/[\u0131]/g, "i")
    .toLowerCase();
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "product-app";
}

function inferPlatform(text) {
  if (/react native|mobile app|ios|android/i.test(text)) return "mobile";
  if (/api only|backend only|rest api|graphql api/i.test(text)) return "api";
  if (/cli|command line|terminal/i.test(text)) return "cli";
  if (/desktop app|electron|macos|windows app/i.test(text)) return "desktop";
  if (/game|arcade|puzzle/i.test(text)) return "game";
  return "web";
}

function inferStack(text, platform) {
  if (/next\.?js|nextjs|seo|ssr/i.test(text)) return "nextjs";
  if (platform === "mobile") return "react-native";
  if (platform === "api") return "node-express";
  if (platform === "cli") return "vanilla-ts";
  return "vite-react";
}

function inferUiLanguage(text) {
  if (/[\u00e7\u011f\u0131\u00f6\u015f\u00fc\u00c7\u011e\u0130\u00d6\u015e\u00dc]/.test(text) || /\bTurkish\b|\bTurkce\b/i.test(text)) return "Turkish";
  return "English";
}

function inferDb(text) {
  if (/auth|user accounts|multi-user|crm|customer|account|lead|opportunit|order|invoice|quote/i.test(text)) {
    return "postgres";
  }
  if (/local storage|local only|no backend|offline/i.test(text)) return "none";
  return "none";
}

function isDesignRequired(platform) {
  return !["api", "cli"].includes(platform);
}

function buildProductSurfaces(text) {
  if (/\bcrm\b|customer|account|lead|opportunit/i.test(text)) {
    return [
      {
        name: "Account and contact management",
        purpose: "Help sales and operations users understand who the customer is, what relationship exists, and what needs attention next.",
        content: "accounts, contacts, ownership, tags, lifecycle status, recent activity, linked opportunities, and notes.",
        actions: "create, edit, search, filter, assign owner, add note, open related records, and resolve empty results.",
        guidance: "Prioritize fast scanning, dense but calm layout, and clear relationship hierarchy over decorative profile cards.",
      },
      {
        name: "Lead and opportunity workflow",
        purpose: "Help users qualify leads, move deals through stages, and see the next action required to progress revenue work.",
        content: "pipeline stage, value, probability, expected close date, owner, blockers, next task, and recent changes.",
        actions: "advance stage, mark lost/won, create follow-up, update value, filter by owner/stage, and inspect blockers.",
        guidance: "Represent workflow state clearly; do not flatten everything into a static table with dead controls.",
      },
      {
        name: "Activity and task follow-up",
        purpose: "Help users avoid missed follow-ups and understand the timeline of calls, emails, meetings, and internal tasks.",
        content: "activity timeline, due dates, overdue items, completed actions, reminders, assignees, and linked customer context.",
        actions: "add task, complete task, snooze, reschedule, filter overdue, and jump back to the related account or opportunity.",
        guidance: "Make overdue and next-best-action signals prominent without turning the app into a calendar clone.",
      },
      {
        name: "Reporting and insights",
        purpose: "Help managers compare pipeline health, workload, overdue work, conversion movement, and team performance.",
        content: "trend summaries, stage distribution, overdue counts, workload by owner, conversion signals, and filter context.",
        actions: "filter, compare time ranges, drill into contributing records, reset filters, and share/export where relevant.",
        guidance: "Charts must answer operational questions; avoid vanity metrics that cannot lead to action.",
      },
      {
        name: "Settings and preferences",
        purpose: "Let users adapt the CRM workflow without exposing irrelevant account filler.",
        content: "saved views, default filters, notification preferences, team visibility, pipeline labels, and storage/status controls.",
        actions: "save preference, reset defaults, rename saved view, toggle notifications, and recover persisted state.",
        guidance: "Settings should support the CRM workflow; do not make this a generic profile page.",
      },
      {
        name: "Empty, loading, and error recovery",
        purpose: "Keep the app usable when there is no data, filtered results are empty, persistence fails, or data is corrupt.",
        content: "clear cause, next action, retry/reset controls, sample seed option, and state-specific guidance.",
        actions: "retry, clear filters, create first record, reset corrupted data, and return to the active workflow.",
        guidance: "Recovery states must be useful product states, not blank placeholder panels.",
      },
    ];
  }

  return [
    {
      name: "Primary workflow",
      purpose: "Represent the main job the user hires the product to complete.",
      content: "core data, current status, important context, progress, and the next useful action.",
      actions: "start, inspect, update, save, cancel, retry, and return to the prior context.",
      guidance: "Prioritize task completion over decorative layout.",
    },
    {
      name: "Supporting management",
      purpose: "Expose secondary configuration or organization needed for repeated use.",
      content: "preferences, filters, saved state, and workflow-specific configuration.",
      actions: "change, persist, reset, and verify visible changes.",
      guidance: "Only include controls that support the product workflow.",
    },
    {
      name: "Recovery states",
      purpose: "Represent empty, error, and loading conditions as usable product states.",
      content: "clear message, cause, action, and route back to productive work.",
      actions: "retry, clear, create, reset, and navigate back.",
      guidance: "Avoid generic error filler.",
    },
  ];
}

function buildPrd(input) {
  const {
    task,
    projectName,
    platform,
    techStack,
    uiLanguage,
    dbRequired,
    designRequired,
    surfaces,
  } = input;
  const surfaceBlocks =
    designRequired === "true"
      ? surfaces.flatMap((surface, index) => {
          const id = surfaceId(surface.name, index);
          return [
            `### SURFACE: ${id}`,
            `- Name: ${surface.name}`,
            `- Purpose: ${surface.purpose}`,
            "- Data Entities Bound: Account, Contact, Lead, Opportunity, Activity, Preference",
            `- Core Content: ${surface.content}`,
            "- Permitted Actions:",
            `  - ACT_SEARCH_${id.replace(/^SURF_/, "")}: control_hint=search_input_persistent`,
            `  - ACT_SAVE_${id.replace(/^SURF_/, "")}: control_hint=primary_button`,
            `  - ACT_OPEN_${id.replace(/^SURF_/, "")}: control_hint=secondary_button`,
            "- Entry Points: direct_url, previous_surface",
            "- Exit And Guard Rules: preserve active filters and return context; auth is required when shared data is enabled.",
            `- Auth Required: ${dbRequired === "postgres" ? "true" : "false"}`,
            `- Design Guidance: ${surface.guidance}`,
            "",
          ];
        })
      : [
          "DESIGN_REQUIRED=false. Product Surfaces and Stitch design are not part of this run.",
          "",
        ];
  const firstSurfaceId = designRequired === "true" ? surfaceId(surfaces[0]?.name || "Primary workflow", 0) : "SURF_NONE";

  return [
    `# ${projectName} Product Contract`,
    "",
    "## 1. Context And Goals",
    `- Overview: ${projectName} is a ${platform} product generated from the user request: "${task}" It must open directly into useful product work, preserve the selected product identity, and avoid marketing or placeholder-first behavior.`,
    "- Target Audience: operators who repeatedly manage the product workflow, managers who need status clarity, and test agents that need deterministic state and actions.",
    "- Business Goals: make the core workflow visible, reduce missed follow-up work, and expose enough state to verify real behavior.",
    "- User Goals: inspect current work, search/filter records, create or update records, recover from empty/error states, and keep preferences consistent.",
    "- Primary Workflows: open current work state; narrow records; create/update a core record; inspect related context; recover from empty/error states; update preferences.",
    "- Non-Functional Targets: accessible controls, no text overflow, deterministic test hooks, fast first interaction, and platform-appropriate navigation.",
    "- External Dependencies: none unless the selected stack later requires persistence, auth, or deployment services.",
    "",
    "## 2. Data And State Contract",
    "### Entities",
    "- Account: id uuid required, name string required, status enum required, owner string, priority enum, createdAt timestamp, updatedAt timestamp.",
    "- Contact: id uuid required, accountId uuid required, name string required, email string, role string, lastTouch timestamp.",
    "- Lead: id uuid required, source string, score number, stage enum, nextAction string, owner string.",
    "- Opportunity: id uuid required, accountId uuid required, value number, probability number, stage enum, closeDate date.",
    "- Activity: id uuid required, relatedEntityId uuid, type enum, dueAt timestamp, completed boolean, notes string.",
    "- Preference: id string required, savedFilters json, notificationRules json, density enum.",
    "### State Architecture",
    `- Server State: ${dbRequired === "postgres" ? "shared product records and preferences live in Postgres." : "no server persistence is required unless MC provisions it later."}`,
    "- Client/Local State: active filters, selected record, drafts, transient panels, loading flags, and recoverable error state.",
    "- URL/Router State: active surface, selected record id, saved view id, and search/filter query when appropriate.",
    "- Persisted Preferences: saved filters, density, notification toggles, and last selected view.",
    "- Side Effects: saving records updates summaries; filter changes update counts; retry resets the failed operation without wiping unrelated state.",
    "### Data Flow",
    "- Read Path: load seed or persisted records, derive summaries, then bind visible collections to the active surface.",
    "- Write Path: validate input, update domain state, update dependent summaries, persist when enabled, then provide user feedback.",
    "- Error Path: keep the user in context, show field/system feedback, preserve drafts when safe, and expose retry/reset controls.",
    "- Seed States: include normal records, overdue records, high-priority records, empty-result cases, and recoverable error fixtures.",
    "",
    "## 3. Behavioral And Action Contract",
    `### ACTION: ACT_SEARCH_${firstSurfaceId.replace(/^SURF_/, "")}`,
    `- Surface Bound: ${firstSurfaceId}`,
    "- Trigger: user changes the persistent search input.",
    "- Preconditions & Auth: product data has loaded; auth is required only when shared persistence is enabled.",
    "- Async Behavior: immediate local filtering; no blocking spinner; idempotent.",
    "- Expected Effect (Success): visible records, counters, empty states, and related summaries reflect the query.",
    "- Fallback Behavior (Error): keep prior results and show a recoverable search/filter error.",
    "- Navigation After Success: same surface.",
    "- State Changes: update active query, visible collection, summary counters, and no-result flag.",
    "- Persistence Effects: persist saved view only when the user explicitly saves it.",
    "- User Feedback: show result count and clear-filter affordance.",
    "",
    `### ACTION: ACT_SAVE_${firstSurfaceId.replace(/^SURF_/, "")}`,
    `- Surface Bound: ${firstSurfaceId}`,
    "- Trigger: user submits a create/edit form or inline edit.",
    "- Preconditions & Auth: required fields valid; user role may create or edit the record.",
    "- Async Behavior: disable submit, show loading state, timeout after 10000ms, idempotent when record id is stable.",
    "- Expected Effect (Success): record is created or updated, summaries refresh, related references update, and the changed record is inspectable.",
    "- Fallback Behavior (Error): preserve form data, show inline field/system errors, and allow retry.",
    "- Navigation After Success: return to the previous productive context or keep the updated detail open.",
    "- State Changes: update domain record, dirty flags, selected record, counters, and timeline.",
    "- Persistence Effects: write to the configured persistence layer when available.",
    "- User Feedback: success confirmation with clear changed state.",
    "",
    `### ACTION: ACT_RECOVER_${firstSurfaceId.replace(/^SURF_/, "")}`,
    `- Surface Bound: ${firstSurfaceId}`,
    "- Trigger: user clicks retry, reset, clear filters, or create first record from an empty/error state.",
    "- Preconditions & Auth: active state is empty, failed, filtered to zero, or corrupted.",
    "- Async Behavior: show scoped loading for retry/reset; destructive reset requires confirmation.",
    "- Expected Effect (Success): product returns to a usable state without unrelated data loss.",
    "- Fallback Behavior (Error): keep diagnostic context and offer another retry or safe reset.",
    "- Navigation After Success: same surface or the most relevant productive surface.",
    "- State Changes: clear recoverable error, reset corrupted data when confirmed, update visible records.",
    "- Persistence Effects: remove only corrupted or explicitly reset data.",
    "- User Feedback: explain what changed and what action is available next.",
    "",
    "## 4. Product Surfaces",
    "> DESIGN AUTHORITY LIES WITH STITCH MANIFEST. PLAN defines semantic surfaces only; Stitch determines physical screens, routing, drawers, tabs, modals, and component hierarchy.",
    ...surfaceBlocks,
    "## 5. Validation And Error Strategy",
    "- Required fields cannot be saved when empty.",
    "- Invalid numeric, date, email, or enum values must show field-level feedback.",
    "- Runtime or persistence errors must not silently reset user data.",
    "- Empty states must explain the next useful action.",
    "- Error states must include a recovery action and should preserve diagnostic context for tests.",
    "",
    "## 6. System Contracts",
    "- Environment Needs: key names only; MC supplies values. No env secret values may appear in PLAN.",
    "- Required Keys: [] unless external integrations are explicitly requested.",
    "- External Integrations: none by default.",
    "- Permission Model: anonymous local use is allowed for local-only products; shared persistence requires authenticated roles.",
    "- Role Boundaries: owner can create/edit/reset; viewer can inspect/filter unless the task says otherwise.",
    "",
    "## 7. Platform Contract",
    platformRequirements(platform),
    stackRequirements(techStack),
    "",
    "## 8. Testability Contract",
    testabilityContract(platform, techStack),
    "",
    "## 9. Out Of Scope",
    "- No repo paths, branch names, GitHub URLs, run slugs, package names, or hardcoded directories.",
    "- No physical screen table, screen-count field, or PLAN-invented route list.",
    "- No unrelated ecommerce, admin, documentation, profile, or marketing modules unless the user asks for them.",
    "- No fake controls that cannot be verified through state, data, navigation, or visible feedback.",
  ].join("\n");
}

function surfaceId(name, index) {
  const core = slugify(name).toUpperCase().replace(/-/g, "_") || `SURFACE_${index + 1}`;
  return `SURF_${core}`;
}

function platformRequirements(platform) {
  switch (platform) {
    case "mobile":
      return [
        "- Use touch-first navigation, safe-area handling, and small-screen ergonomic controls.",
        "- Avoid browser-only assumptions such as DOM globals and desktop hover dependency.",
        "- Represent offline, permission, and poor-network states when relevant.",
      ].join("\n");
    case "api":
      return [
        "- No UI or Stitch design is required unless a separate client is requested.",
        "- Define endpoints, request/response shapes, validation failures, auth needs, and observability.",
        "- Use deterministic errors and status codes for tests.",
      ].join("\n");
    case "cli":
      return [
        "- Define commands, options, stdout/stderr behavior, exit codes, and config file behavior.",
        "- Avoid browser and UI design assumptions.",
        "- Keep command output stable enough for tests.",
      ].join("\n");
    case "game":
      return [
        "- Define input model, game state machine, pause/restart/game-over behavior, score/timer rules, and deterministic test hooks.",
        "- UI design should support gameplay clarity before decoration.",
      ].join("\n");
    default:
      return [
        "- Build as a responsive web product with reliable keyboard, pointer, and small-screen behavior.",
        "- Use routes, panels, or app state deliberately according to the selected stack.",
        "- Support browser storage or backend persistence according to DB_REQUIRED.",
      ].join("\n");
  }
}

function stackRequirements(stack) {
  switch (stack) {
    case "nextjs":
      return [
        "- Use Next.js conventions only for this stack.",
        "- Decide App Router versus Pages Router explicitly before implementation.",
        "- Keep server/client boundaries clear and avoid client-only state in server components.",
        "- Use SSR/SEO only when the product actually needs it.",
      ].join("\n");
    case "react-native":
      return [
        "- Use React Native navigation and native component constraints.",
        "- Use testID-based testability rather than window or DOM globals.",
        "- Respect platform safe areas, native permissions, and touch behavior.",
      ].join("\n");
    case "node-express":
      return [
        "- Define REST endpoints, validation middleware, error handling, and persistence boundaries.",
        "- Do not include UI, Stitch, browser, or mobile requirements unless a client is explicitly requested.",
      ].join("\n");
    case "vanilla-ts":
      return [
        "- Keep dependencies minimal and expose stable module or CLI boundaries.",
        "- Do not include framework-specific React, Next.js, or native assumptions.",
      ].join("\n");
    default:
      return [
        "- Use React with Vite as a client-rendered app.",
        "- Do not include Next.js SSR/App Router rules.",
        "- Keep state local or in small reducers/context unless the app complexity requires more.",
        "- Use accessible HTML, stable routes or app views, and deterministic browser test hooks.",
      ].join("\n");
  }
}

function testabilityContract(platform, stack) {
  if (platform === "api" || stack === "node-express") {
    return [
      "- Expose deterministic endpoint responses for normal, validation, not-found, and failure cases.",
      "- Tests should verify status codes, response bodies, validation errors, and persistence effects.",
    ].join("\n");
  }
  if (platform === "mobile" || stack === "react-native") {
    return [
      "- Important controls and states must expose stable testID values.",
      "- Tests should verify navigation, form validation, persistence behavior, and recovery flows.",
    ].join("\n");
  }
  if (platform === "cli" || stack === "vanilla-ts") {
    return [
      "- Commands must expose stable stdout/stderr and exit codes.",
      "- Tests should verify valid input, invalid input, config behavior, and failure paths.",
    ].join("\n");
  }
  return [
    "- Expose a deterministic window.app test bridge with active view, visible record count, selected record id, filters, errors, and action counters.",
    "- Tests should verify visible UI plus the state bridge after create, edit, filter, retry, reset, and settings actions.",
  ].join("\n");
}
