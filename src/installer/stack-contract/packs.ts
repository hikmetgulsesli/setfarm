import type {
  BuildStrippingPolicy,
  DependencyResolutionPolicy,
  PatchWindowMarker,
  SandboxPrewarmPolicy,
  ScopeTargetRole,
  SharedEditValidationPolicy,
  SlugRules,
  SlugRuleTest,
  StackPack,
  StackPackId,
  StackRouterParadigm,
  TargetResolutionRule,
  UtilityFilePolicy,
} from "./types.js";

function rule(ruleId: string, role: ScopeTargetRole, template: string): TargetResolutionRule {
  const kind = role === "route_registration" || role === "style_integration" || role === "test_bridge"
    ? "shared_file"
    : "single_file";
  return { ruleId, template, allowedRoles: [role], kind };
}

function rules(prefix: string, templates: Record<ScopeTargetRole, string>): Record<ScopeTargetRole, TargetResolutionRule> {
  return Object.fromEntries(
    Object.entries(templates).map(([role, template]) => [role, rule(`${prefix}.${role}`, role as ScopeTargetRole, template)]),
  ) as Record<ScopeTargetRole, TargetResolutionRule>;
}

const VITE_TARGET_RULES = rules("vite", {
  app_shell: "src/App.tsx",
  route_registration: "src/App.tsx",
  surface_component: "src/screens/{ComponentName}.tsx",
  action_handler: "src/features/{domain_slug}/{action_id}.ts",
  state_store: "src/features/{domain_slug}/{domain_slug}.store.ts",
  fixture_data: "src/__fixtures__/{domain_slug}.fixture.ts",
  persistence_adapter: "src/features/{domain_slug}/{domain_slug}.repo.ts",
  test_bridge: "src/test/bridge.ts",
  style_integration: "src/index.css",
  game_runtime: "src/game/{target_slug}.ts",
  api_route: "src/api/{target_slug}.ts",
  cli_command: "scripts/{target_slug}.ts",
});

const NEXT_TARGET_RULES = rules("next", {
  app_shell: "app/page.tsx",
  route_registration: "app/page.tsx",
  surface_component: "src/screens/{ComponentName}.tsx",
  action_handler: "app/actions/{action_id}.ts",
  state_store: "src/features/{domain_slug}/{domain_slug}.store.ts",
  fixture_data: "src/__fixtures__/{domain_slug}.fixture.ts",
  persistence_adapter: "src/lib/{domain_slug}.repo.ts",
  test_bridge: "src/test/bridge.ts",
  style_integration: "app/globals.css",
  game_runtime: "src/game/{target_slug}.ts",
  api_route: "app/api/{target_slug}/route.ts",
  cli_command: "scripts/{target_slug}.ts",
});

const STATIC_TARGET_RULES = rules("static", {
  app_shell: "index.html",
  route_registration: "index.html",
  surface_component: "{target_slug}.html",
  action_handler: "assets/js/{action_id}.js",
  state_store: "assets/js/{domain_slug}.state.js",
  fixture_data: "assets/data/{domain_slug}.json",
  persistence_adapter: "assets/js/{domain_slug}.storage.js",
  test_bridge: "assets/js/test-bridge.js",
  style_integration: "assets/css/styles.css",
  game_runtime: "assets/js/game/{target_slug}.js",
  api_route: "assets/js/api/{target_slug}.js",
  cli_command: "scripts/{target_slug}.js",
});

const PYTHON_TARGET_RULES = rules("python", {
  app_shell: "main.py",
  route_registration: "main.py",
  surface_component: "templates/{target_slug}.html",
  action_handler: "src/{domain_slug}/actions/{action_id}.py",
  state_store: "src/{domain_slug}/state.py",
  fixture_data: "tests/fixtures/{domain_slug}.json",
  persistence_adapter: "src/{domain_slug}/repository.py",
  test_bridge: "tests/test_bridge.py",
  style_integration: "static/styles.css",
  game_runtime: "src/game/{target_slug}.py",
  api_route: "src/routes/{target_slug}.py",
  cli_command: "src/commands/{target_slug}.py",
});

const NODE_API_TARGET_RULES = rules("node-api", {
  app_shell: "src/server.ts",
  route_registration: "src/routes/index.ts",
  surface_component: "src/contracts/{target_slug}.ts",
  action_handler: "src/services/{domain_slug}/{action_id}.ts",
  state_store: "src/state/{domain_slug}.store.ts",
  fixture_data: "src/__fixtures__/{domain_slug}.fixture.ts",
  persistence_adapter: "src/repositories/{domain_slug}.repo.ts",
  test_bridge: "src/test/bridge.ts",
  style_integration: "src/contracts/{domain_slug}.style.ts",
  game_runtime: "src/runtime/{target_slug}.ts",
  api_route: "src/routes/{target_slug}.ts",
  cli_command: "src/commands/{target_slug}.ts",
});

const NODE_CLI_TARGET_RULES = rules("node-cli", {
  app_shell: "src/cli.ts",
  route_registration: "src/cli.ts",
  surface_component: "src/output/{target_slug}.ts",
  action_handler: "src/actions/{action_id}.ts",
  state_store: "src/state/{domain_slug}.ts",
  fixture_data: "src/__fixtures__/{domain_slug}.fixture.ts",
  persistence_adapter: "src/persistence/{domain_slug}.ts",
  test_bridge: "src/test/bridge.ts",
  style_integration: "src/output/styles.ts",
  game_runtime: "src/runtime/{target_slug}.ts",
  api_route: "src/api/{target_slug}.ts",
  cli_command: "src/commands/{target_slug}.ts",
});

const MOBILE_TARGET_RULES = rules("mobile", {
  app_shell: "src/App.tsx",
  route_registration: "src/navigation/routes.tsx",
  surface_component: "src/screens/{ComponentName}.tsx",
  action_handler: "src/features/{domain_slug}/{action_id}.ts",
  state_store: "src/features/{domain_slug}/{domain_slug}.store.ts",
  fixture_data: "src/__fixtures__/{domain_slug}.fixture.ts",
  persistence_adapter: "src/features/{domain_slug}/{domain_slug}.repo.ts",
  test_bridge: "src/test/bridge.ts",
  style_integration: "src/theme/tokens.ts",
  game_runtime: "src/game/{target_slug}.ts",
  api_route: "src/api/{target_slug}.ts",
  cli_command: "scripts/{target_slug}.ts",
});

const DEFAULT_SLUG_RULES: SlugRules = {
  surface_slug: "kebab-case: strip SURF_ prefix, lowercase, replace non-alphanumeric separators with hyphen",
  screen_file: "PascalCase: strip SCR-NNN prefix when present, capitalize words",
  action_file: "camelCase: strip ACT_ prefix when present, lowercase first word",
  entity_file: "PascalCase: entity name as-is after separator normalization",
};

const JS_SLUG_TESTS: SlugRuleTest[] = [
  { ruleKey: "surface_slug", input: "SURF_TICKET_EDITOR", expected: "ticket-editor" },
  { ruleKey: "screen_file", input: "SCR-002-ticket-editor", expected: "TicketEditor" },
  { ruleKey: "action_file", input: "ACT_SAVE_RECORD", expected: "saveRecord" },
];

const PYTHON_SLUG_TESTS: SlugRuleTest[] = [
  { ruleKey: "surface_slug", input: "SURF_TICKET_EDITOR", expected: "ticket_editor" },
  { ruleKey: "screen_file", input: "SCR-002-ticket-editor", expected: "ticket_editor" },
  { ruleKey: "action_file", input: "ACT_SAVE_RECORD", expected: "save_record" },
];

const ANDROID_SLUG_TESTS: SlugRuleTest[] = [
  { ruleKey: "surface_slug", input: "SURF_TICKET_EDITOR", expected: "ticket_editor" },
  { ruleKey: "screen_file", input: "SCR-002-ticket-editor", expected: "TicketEditorScreen" },
  { ruleKey: "entity_file", input: "ticket record", expected: "TicketRecord" },
];

const IOS_SLUG_TESTS: SlugRuleTest[] = [
  { ruleKey: "surface_slug", input: "SURF_TICKET_EDITOR", expected: "ticket-editor" },
  { ruleKey: "screen_file", input: "SCR-002-ticket-editor", expected: "TicketEditorView" },
  { ruleKey: "entity_file", input: "ticket record", expected: "TicketRecord" },
];

const DEFAULT_DEPENDENCY_RESOLUTION: DependencyResolutionPolicy = {
  conflictStrategy: "reject_conflict",
  outOfEcosystem: "reject",
  manifestPatchMode: "setup_build_only",
};

const DEFAULT_BUILD_STRIPPING: BuildStrippingPolicy = {
  testBridgeStripping: {
    required: true,
    method: "bundler_define_replacement",
    verification: "config_and_bundle_scan",
  },
  devToolStripping: {
    required: false,
    method: "not_applicable",
    verification: "not_applicable",
  },
};

const NOT_APPLICABLE_STRIPPING: BuildStrippingPolicy = {
  testBridgeStripping: {
    required: false,
    method: "not_applicable",
    verification: "not_applicable",
  },
  devToolStripping: {
    required: false,
    method: "not_applicable",
    verification: "not_applicable",
  },
};

function sandboxPrewarm(commands: string[], artifactPath = ".setfarm/setup/PREWARM_EVIDENCE.json"): SandboxPrewarmPolicy {
  return {
    commands,
    successCheck: commands.length > 0 ? "exit_code_zero" : "not_required",
    timeoutMs: commands.length > 0 ? 120000 : 1000,
    networkPolicy: commands.length > 0 ? "allowlist" : "none",
    allowedHosts: commands.length > 0
      ? ["registry.npmjs.org", "pypi.org", "files.pythonhosted.org", "services.gradle.org", "github.com"]
      : [],
    artifactPath,
  };
}

function routerParadigmFor(pack: StackPack): StackRouterParadigm {
  if (pack.id === "nextjs-web-app") return "file_system_nested";
  if (pack.id === "browser-game-canvas") return "game_runtime";
  if (pack.platform === "api" || pack.platform === "cli") return "declarative_flat";
  if (pack.id === "android-app" || pack.id === "ios-app") return "native_manifest";
  if (pack.routeContract.router === "none") return "none";
  return "single_entry";
}

function slugTestsFor(pack: StackPack): SlugRuleTest[] {
  if (pack.id === "python-cli" || pack.id === "python-web") return PYTHON_SLUG_TESTS;
  if (pack.id === "android-app") return ANDROID_SLUG_TESTS;
  if (pack.id === "ios-app") return IOS_SLUG_TESTS;
  return JS_SLUG_TESTS;
}

function utilityPolicyFor(pack: StackPack): UtilityFilePolicy {
  const roots = pack.id.startsWith("python") ? ["src/", "tests/"] : pack.id === "android-app"
    ? ["app/src/main/", "app/src/test/"]
    : pack.id === "ios-app"
      ? ["Sources/", "Tests/"]
      : ["src/", "tests/"];
  return {
    allowedRoots: roots,
    naming: "derive from scope target slug rules; no product-specific hardcoded file names",
    garbageCollection: "mc_reachable_imports",
  };
}

function sharedEditPolicyFor(pack: StackPack): SharedEditValidationPolicy {
  if (pack.id.startsWith("python") || pack.id === "android-app" || pack.id === "ios-app") return "patch_window";
  return "ast_required";
}

function patchMarkersFor(pack: StackPack): PatchWindowMarker[] {
  const sharedFiles = pack.implementationBoundaries?.sharedFiles || [];
  if (sharedEditPolicyFor(pack) !== "patch_window") return [];
  return sharedFiles.map((file) => ({
    file,
    start: "SETFARM_INJECT_START",
    end: "SETFARM_INJECT_END",
    scope: "stack-pack shared edit patch window",
  }));
}

function finalizePack(pack: StackPack): StackPack {
  const isCodeBuild = pack.dependencyPolicy?.ecosystem === "none" ? false : Boolean(pack.setup.install || pack.setup.build || pack.setup.test || pack.setup.smoke);
  return {
    ...pack,
    routerParadigm: pack.routerParadigm || routerParadigmFor(pack),
    slugRules: pack.slugRules || DEFAULT_SLUG_RULES,
    slugRuleTests: pack.slugRuleTests || slugTestsFor(pack),
    dependencyResolutionPolicy: pack.dependencyResolutionPolicy || DEFAULT_DEPENDENCY_RESOLUTION,
    sharedEditValidationPolicy: pack.sharedEditValidationPolicy || sharedEditPolicyFor(pack),
    patchWindowMarkers: pack.patchWindowMarkers || patchMarkersFor(pack),
    utilityFilePolicy: pack.utilityFilePolicy || utilityPolicyFor(pack),
    buildStrippingPolicy: pack.buildStrippingPolicy || (pack.designPolicy === "none" ? NOT_APPLICABLE_STRIPPING : DEFAULT_BUILD_STRIPPING),
    sandboxPrewarm: pack.sandboxPrewarm || sandboxPrewarm(isCodeBuild && pack.setup.install ? [pack.setup.install] : []),
  };
}

export const STACK_PACKS: Record<StackPackId, StackPack> = {
  "nextjs-web-app": {
    id: "nextjs-web-app",
    label: "Next.js Web App",
    platform: "web",
    techStackAliases: ["nextjs", "next.js", "next"],
    designPolicy: "stitch-required",
    conversionPolicy: "wrap_jsx",
    scaffoldPolicy: "hybrid",
    projectTypes: ["web-app", "dashboard", "saas", "site"],
    whenToUse: "Use for React web applications that need Next.js routing, app/pages directories, server components, or existing Next.js repository evidence.",
    repoSignals: ["next dependency", "next.config.*", "app/", "pages/"],
    setup: {
      install: "npm install",
      dev: "npm run dev",
      build: "npm run build",
      test: "npm test",
      smoke: "npm run build",
    },
    fileContract: {
      entrypoints: ["app/page.tsx", "pages/index.tsx"],
      routes: ["app/**/page.tsx", "pages/**/*.tsx"],
      assets: ["public/"],
      generated: [],
      notes: [
        "Use app router when an app directory exists.",
        "Use client components only when state, effects, or browser APIs are required.",
      ],
    },
    routeContract: {
      router: "next",
      routeFiles: ["app/**/page.tsx", "pages/**/*.tsx"],
      requiredRoutes: ["/"],
    },
    verification: {
      build: ["npm run build"],
      smoke: ["start Next preview or dev server and open required routes"],
      dom: ["extract buttons, links, forms, dialogs, and route navigation controls"],
      visual: ["capture desktop and mobile screenshots for required routes"],
      tests: ["npm test when present"],
    },
    requiredFiles: ["package.json"],
    artifactChecks: [".next"],
    targetResolutionRules: NEXT_TARGET_RULES,
    mockInjectionPolicy: { fixtureRoot: "src/__fixtures__", bootstrapFile: "src/test/bridge.ts", productionIsolation: "runtime_seed" },
    dataAccessPolicy: { defaultClientState: "React state or reducer", defaultServerState: "Next route/server action only when PRD requires backend state", allowedLibraries: [] },
    implementationBoundaries: {
      setupOwnedFiles: ["package.json", "package-lock.json", "tsconfig.json", "next.config.js", "next.config.mjs"],
      forbiddenDuringImplement: ["package.json", "package-lock.json", "tsconfig.json", "next.config.js", "next.config.mjs"],
      sharedFiles: ["app/page.tsx", "app/layout.tsx", "app/globals.css", "src/test/bridge.ts"],
    },
    dependencyPolicy: { ecosystem: "npm", allowedDependencies: ["@tanstack/react-query", "zustand", "zod", "recharts", "date-fns", "lucide-react"] },
    prompt: [
      "Follow the resolved Next.js stack contract.",
      "Use Next.js routing conventions instead of inventing client-only routing.",
      "Do not add app/api handlers unless explicitly required by the story.",
      "Use 'use client' only for components that need state, effects, or browser APIs.",
    ].join("\n"),
  },
  "vite-react-web-app": {
    id: "vite-react-web-app",
    label: "Vite React Web App",
    platform: "web",
    techStackAliases: ["vite-react", "vite", "react"],
    designPolicy: "stitch-required",
    conversionPolicy: "wrap_jsx",
    scaffoldPolicy: "hybrid",
    projectTypes: ["web-app", "dashboard", "tool", "single-page-app"],
    whenToUse: "Use for browser React applications with Vite evidence or when a lightweight SPA is the best fit.",
    repoSignals: ["vite dependency", "react dependency", "vite.config.*", "src/main.tsx"],
    setup: {
      install: "npm install",
      dev: "npm run dev",
      build: "npm run build",
      test: "npm test",
      smoke: "npm run build",
      preview: "npm run preview -- --host {{HOST}} --port {{PORT}} --strictPort",
    },
    fileContract: {
      entrypoints: ["src/main.tsx", "src/main.jsx", "src/App.tsx", "src/App.jsx"],
      routes: ["src/**/*.{tsx,jsx,ts,js}"],
      assets: ["public/", "src/assets/"],
      generated: [],
      notes: [
        "src/main.tsx or src/main.jsx owns the createRoot render entry.",
        "index.html is the Vite root document.",
      ],
    },
    routeContract: {
      router: "client",
      routeFiles: ["src/**/*.{tsx,jsx}"],
      requiredRoutes: ["/"],
    },
    verification: {
      build: ["npm run build"],
      smoke: ["serve preview/dev server and open root route"],
      dom: ["extract buttons, links, forms, dialogs, and client navigation controls"],
      visual: ["capture desktop and mobile screenshots for root and discovered routes"],
      tests: ["npm test when present"],
    },
    runtime: {
      service: "preview",
      host: "127.0.0.1",
      portPolicy: "allocated_by_mc",
      portBand: "preview",
      devCommand: "npm run dev -- --host {{HOST}} --port {{PORT}} --strictPort",
      previewCommand: "npm run preview -- --host {{HOST}} --port {{PORT}} --strictPort",
      readinessProbe: "http_200",
      rootUrlPath: "/",
      appRootSelector: "#root, main, [data-setfarm-root]",
      smokeRunner: "setfarm-smoke-test",
      timeoutMs: 240000,
    },
    toolPreflight: [
      { tool: "node", command: "node --version", required: true, timeoutMs: 5000, failureCategory: "tooling_contract_missing" },
      { tool: "npm", command: "npm --version", required: true, timeoutMs: 5000, failureCategory: "tooling_contract_missing" },
      { tool: "agent-browser", command: "agent-browser --help", required: true, timeoutMs: 10000, failureCategory: "browser_infra_failure" },
    ],
    requiredFiles: ["package.json", "index.html"],
    artifactChecks: ["dist/index.html"],
    targetResolutionRules: VITE_TARGET_RULES,
    mockInjectionPolicy: { fixtureRoot: "src/__fixtures__", bootstrapFile: "src/test/bridge.ts", productionIsolation: "runtime_seed" },
    dataAccessPolicy: { defaultClientState: "React reducer/local state", defaultServerState: "none unless PRD requires external API", allowedLibraries: [] },
    implementationBoundaries: {
      setupOwnedFiles: ["package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "vite.config.js", "index.html"],
      forbiddenDuringImplement: ["package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "vite.config.js", "index.html"],
      sharedFiles: ["src/App.tsx", "src/main.tsx", "src/index.css", "src/test/bridge.ts"],
    },
    dependencyPolicy: { ecosystem: "npm", allowedDependencies: ["@tanstack/react-query", "zustand", "zod", "recharts", "date-fns", "lucide-react"] },
    prompt: [
      "Follow the resolved Vite React stack contract.",
      "Use src/main.tsx or src/main.jsx as the browser entrypoint.",
      "Keep package scripts and Vite config stable unless they are explicitly in scope.",
      "Use client-side route/state patterns appropriate for a Vite SPA.",
    ].join("\n"),
  },
  "static-html-site": {
    id: "static-html-site",
    label: "Static HTML Site",
    platform: "web",
    techStackAliases: ["static-html", "html"],
    designPolicy: "stitch-required",
    conversionPolicy: "reference_only",
    scaffoldPolicy: "hybrid",
    projectTypes: ["landing-page", "simple-site", "static-site"],
    whenToUse: "Use for simple static pages that do not need a framework runtime.",
    repoSignals: ["index.html", "static assets", "no package framework evidence"],
    setup: {
      dev: "python3 -m http.server 4173",
      build: "true",
      smoke: "open index.html or serve the directory",
    },
    fileContract: {
      entrypoints: ["index.html"],
      routes: ["*.html"],
      assets: ["assets/", "public/"],
      generated: [],
      notes: ["Keep behavior in plain JavaScript when interaction is required."],
    },
    routeContract: {
      router: "static",
      routeFiles: ["*.html"],
      requiredRoutes: ["/", "/index.html"],
    },
    verification: {
      build: ["no framework build required unless package scripts exist"],
      smoke: ["serve directory and open index.html"],
      dom: ["extract static links, buttons, and forms"],
      visual: ["capture desktop and mobile screenshots"],
      tests: [],
    },
    requiredFiles: ["index.html"],
    artifactChecks: ["index.html"],
    targetResolutionRules: STATIC_TARGET_RULES,
    mockInjectionPolicy: { fixtureRoot: "assets/data", bootstrapFile: "assets/js/test-bridge.js", productionIsolation: "runtime_seed" },
    dataAccessPolicy: { defaultClientState: "plain browser state", defaultServerState: "none", allowedLibraries: [] },
    implementationBoundaries: {
      setupOwnedFiles: ["index.html"],
      forbiddenDuringImplement: [],
      sharedFiles: ["index.html", "assets/css/styles.css", "assets/js/test-bridge.js"],
    },
    dependencyPolicy: { ecosystem: "none", allowedDependencies: [] },
    prompt: [
      "Follow the resolved static HTML stack contract.",
      "Do not introduce a JavaScript framework unless the stack contract is reconciled first.",
      "Keep links, forms, and buttons functional with plain browser behavior.",
    ].join("\n"),
  },
  "browser-game-canvas": {
    id: "browser-game-canvas",
    label: "Browser Game Canvas",
    platform: "game",
    techStackAliases: ["browser-game", "canvas-game", "game"],
    designPolicy: "stitch-brief-only",
    conversionPolicy: "reference_only",
    scaffoldPolicy: "hybrid",
    projectTypes: ["browser-game", "arcade", "canvas-game"],
    whenToUse: "Use for browser games where the primary experience is canvas, game loop, keyboard/touch input, animation, scoring, and restartable gameplay.",
    repoSignals: ["game PRD hints", "canvas usage", "Vite React or static browser runtime"],
    setup: {
      install: "npm install",
      dev: "npm run dev",
      build: "npm run build",
      test: "npm test",
      smoke: "npm run build",
    },
    fileContract: {
      entrypoints: ["src/main.tsx", "src/main.jsx", "src/App.tsx", "src/App.jsx", "index.html"],
      routes: ["src/**/*.{tsx,jsx,ts,js}", "*.html"],
      assets: ["public/", "src/assets/"],
      generated: [],
      notes: [
        "Expose a real runtime bridge for smoke tests when required by the project contract.",
        "Gameplay controls must affect state or be hidden/disabled when inactive.",
      ],
    },
    routeContract: {
      router: "browser-game",
      routeFiles: ["src/**/*.{tsx,jsx,ts,js}", "*.html"],
      requiredRoutes: ["/"],
    },
    verification: {
      build: ["npm run build when package scripts exist"],
      smoke: ["open the game route and verify a nonblank playable scene"],
      dom: ["extract menu, pause, restart, help, and gameplay controls"],
      visual: ["capture desktop and mobile screenshots for menu and gameplay states"],
      tests: ["game state and control tests when test runner exists"],
    },
    requiredFiles: ["package.json", "index.html"],
    artifactChecks: ["dist/index.html"],
    targetResolutionRules: VITE_TARGET_RULES,
    mockInjectionPolicy: { fixtureRoot: "src/__fixtures__", bootstrapFile: "src/test/bridge.ts", productionIsolation: "runtime_seed" },
    dataAccessPolicy: { defaultClientState: "game reducer/runtime state", defaultServerState: "none", allowedLibraries: [] },
    implementationBoundaries: {
      setupOwnedFiles: ["package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "vite.config.js", "index.html"],
      forbiddenDuringImplement: ["package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "vite.config.js", "index.html"],
      sharedFiles: ["src/App.tsx", "src/main.tsx", "src/index.css", "src/test/bridge.ts"],
    },
    dependencyPolicy: { ecosystem: "npm", allowedDependencies: ["phaser", "matter-js", "zustand", "zod", "lucide-react"] },
    prompt: [
      "Follow the resolved browser game stack contract.",
      "Implement a real game loop, state transitions, input handling, scoring/progress, pause/restart, and terminal states as required by the PRD.",
      "Visible controls must either affect current game state or be hidden/disabled when inactive.",
      "Canvas or scene output must be nonblank and verifiable in Playwright screenshots.",
    ].join("\n"),
  },
  "node-express-api": {
    id: "node-express-api",
    label: "Node Express API",
    platform: "api",
    techStackAliases: ["node-express", "express", "node-api"],
    designPolicy: "none",
    conversionPolicy: "none",
    scaffoldPolicy: "hybrid",
    projectTypes: ["api", "backend", "server"],
    whenToUse: "Use for Node/Express APIs, HTTP services, and backend-only JavaScript/TypeScript projects.",
    repoSignals: ["express dependency", "src/server.ts", "src/app.ts", "package.json"],
    setup: {
      install: "npm install",
      dev: "npm run dev",
      build: "npm run build",
      test: "npm test",
      smoke: "npm run build",
    },
    fileContract: {
      entrypoints: ["src/server.ts", "src/app.ts", "server.ts"],
      routes: ["src/routes/**/*.ts", "src/**/*.route.ts"],
      assets: [],
      generated: [],
      notes: ["Keep HTTP handlers explicit and return deterministic JSON envelopes."],
    },
    routeContract: {
      router: "express",
      routeFiles: ["src/routes/**/*.ts", "src/server.ts", "src/app.ts"],
      requiredRoutes: ["/health"],
    },
    verification: {
      build: ["npm run build"],
      smoke: ["start server or run request-level tests when safe"],
      dom: [],
      visual: [],
      tests: ["npm test when present"],
    },
    requiredFiles: ["package.json"],
    artifactChecks: ["build command exit 0"],
    targetResolutionRules: NODE_API_TARGET_RULES,
    mockInjectionPolicy: { fixtureRoot: "src/__fixtures__", bootstrapFile: "src/test/bridge.ts", productionIsolation: "test_only" },
    dataAccessPolicy: { defaultClientState: "none", defaultServerState: "Express route/service/repository", allowedLibraries: ["zod"] },
    implementationBoundaries: {
      setupOwnedFiles: ["package.json", "package-lock.json", "tsconfig.json"],
      forbiddenDuringImplement: ["package.json", "package-lock.json", "tsconfig.json"],
      sharedFiles: ["src/server.ts", "src/app.ts", "src/routes/index.ts"],
    },
    dependencyPolicy: { ecosystem: "npm", allowedDependencies: ["express", "zod", "cors", "helmet", "dotenv", "pino", "supertest"] },
    prompt: [
      "Follow the resolved Node Express API stack contract.",
      "Do not add UI screens for API-only projects.",
      "Keep route, service, validation, and repository boundaries explicit.",
    ].join("\n"),
  },
  "node-cli": {
    id: "node-cli",
    label: "Node CLI",
    platform: "cli",
    techStackAliases: ["node-cli", "typescript-cli"],
    designPolicy: "none",
    conversionPolicy: "none",
    scaffoldPolicy: "hybrid",
    projectTypes: ["cli", "automation", "script"],
    whenToUse: "Use for Node/TypeScript command-line tools and local automation.",
    repoSignals: ["bin field", "src/cli.ts", "commander dependency", "yargs dependency"],
    setup: {
      install: "npm install",
      build: "npm run build",
      test: "npm test",
      smoke: "npm run build",
    },
    fileContract: {
      entrypoints: ["src/cli.ts", "src/index.ts"],
      routes: [],
      assets: [],
      generated: [],
      notes: ["Commands must have deterministic stdout, stderr, and exit codes."],
    },
    routeContract: { router: "none", routeFiles: [], requiredRoutes: [] },
    verification: {
      build: ["npm run build"],
      smoke: ["run CLI help or a safe dry-run command"],
      dom: [],
      visual: [],
      tests: ["npm test when present"],
    },
    requiredFiles: ["package.json"],
    artifactChecks: ["build command exit 0"],
    targetResolutionRules: NODE_CLI_TARGET_RULES,
    mockInjectionPolicy: { fixtureRoot: "src/__fixtures__", bootstrapFile: "src/test/bridge.ts", productionIsolation: "test_only" },
    dataAccessPolicy: { defaultClientState: "command context", defaultServerState: "none", allowedLibraries: ["zod"] },
    implementationBoundaries: {
      setupOwnedFiles: ["package.json", "package-lock.json", "tsconfig.json"],
      forbiddenDuringImplement: ["package.json", "package-lock.json", "tsconfig.json"],
      sharedFiles: ["src/cli.ts", "src/index.ts"],
    },
    dependencyPolicy: { ecosystem: "npm", allowedDependencies: ["commander", "yargs", "zod", "chalk"] },
    prompt: [
      "Follow the resolved Node CLI stack contract.",
      "Keep command arguments, output, and exit codes deterministic.",
    ].join("\n"),
  },
  "python-cli": {
    id: "python-cli",
    label: "Python CLI",
    platform: "cli",
    techStackAliases: ["python-cli"],
    designPolicy: "none",
    conversionPolicy: "none",
    scaffoldPolicy: "hybrid",
    projectTypes: ["cli", "script", "automation"],
    whenToUse: "Use for command-line Python tools and automation scripts without a web server requirement.",
    repoSignals: ["pyproject.toml", "requirements.txt", "main.py", "cli.py"],
    setup: {
      install: "python3 -m pip install -r requirements.txt",
      test: "python3 -m pytest",
      smoke: "python3 -m compileall .",
    },
    fileContract: {
      entrypoints: ["main.py", "cli.py", "src/**/__main__.py"],
      routes: [],
      assets: [],
      generated: [],
      notes: ["Provide clear CLI arguments and deterministic stdout/stderr behavior."],
    },
    routeContract: {
      router: "none",
      routeFiles: [],
      requiredRoutes: [],
    },
    verification: {
      build: ["python3 -m compileall ."],
      smoke: ["run CLI help or a safe dry-run command"],
      dom: [],
      visual: [],
      tests: ["python3 -m pytest when present"],
    },
    requiredFiles: ["main.py"],
    artifactChecks: ["python compileall exit 0"],
    targetResolutionRules: PYTHON_TARGET_RULES,
    mockInjectionPolicy: { fixtureRoot: "tests/fixtures", bootstrapFile: "tests/test_bridge.py", productionIsolation: "test_only" },
    dataAccessPolicy: { defaultClientState: "in-memory command context", defaultServerState: "none", allowedLibraries: [] },
    implementationBoundaries: {
      setupOwnedFiles: ["pyproject.toml", "requirements.txt"],
      forbiddenDuringImplement: ["pyproject.toml", "requirements.txt"],
      sharedFiles: ["main.py", "tests/test_bridge.py"],
    },
    dependencyPolicy: { ecosystem: "python", allowedDependencies: ["click", "typer", "pydantic", "rich", "pytest"] },
    prompt: [
      "Follow the resolved Python CLI stack contract.",
      "Keep the command-line entrypoint explicit and testable.",
      "Avoid starting servers unless the stack contract is reconciled to python-web.",
    ].join("\n"),
  },
  "python-web": {
    id: "python-web",
    label: "Python Web App",
    platform: "api",
    techStackAliases: ["python-web", "python-web-api", "fastapi", "flask"],
    designPolicy: "none",
    conversionPolicy: "none",
    scaffoldPolicy: "hybrid",
    projectTypes: ["python-web", "api", "server"],
    whenToUse: "Use for Python web applications with FastAPI, Flask, Django, or similar server evidence.",
    repoSignals: ["fastapi dependency", "flask dependency", "django dependency", "app.py", "main.py"],
    setup: {
      install: "python3 -m pip install -r requirements.txt",
      dev: "python3 -m uvicorn main:app --reload",
      test: "python3 -m pytest",
      smoke: "python3 -m compileall .",
    },
    fileContract: {
      entrypoints: ["main.py", "app.py", "src/main.py"],
      routes: ["**/routes.py", "**/views.py", "**/api.py"],
      assets: ["static/", "templates/"],
      generated: [],
      notes: ["Keep server startup command aligned with the detected framework."],
    },
    routeContract: {
      router: "python-web",
      routeFiles: ["**/routes.py", "**/views.py", "**/api.py", "main.py", "app.py"],
      requiredRoutes: ["/"],
    },
    verification: {
      build: ["python3 -m compileall ."],
      smoke: ["start app and request health/root route when safe"],
      dom: ["for HTML apps, extract links, buttons, and forms"],
      visual: ["for HTML apps, capture primary route screenshots"],
      tests: ["python3 -m pytest when present"],
    },
    requiredFiles: ["main.py"],
    artifactChecks: ["python compileall exit 0"],
    targetResolutionRules: PYTHON_TARGET_RULES,
    mockInjectionPolicy: { fixtureRoot: "tests/fixtures", bootstrapFile: "tests/test_bridge.py", productionIsolation: "test_only" },
    dataAccessPolicy: { defaultClientState: "request context only", defaultServerState: "Python web framework handlers", allowedLibraries: ["pydantic"] },
    implementationBoundaries: {
      setupOwnedFiles: ["pyproject.toml", "requirements.txt"],
      forbiddenDuringImplement: ["pyproject.toml", "requirements.txt"],
      sharedFiles: ["main.py", "tests/test_bridge.py"],
    },
    dependencyPolicy: { ecosystem: "python", allowedDependencies: ["fastapi", "flask", "django", "uvicorn", "pydantic", "pytest", "httpx"] },
    prompt: [
      "Follow the resolved Python web stack contract.",
      "Keep routes explicit and verify server startup with the configured command.",
      "Do not convert a CLI project into a web server unless reconcile selected python-web.",
    ].join("\n"),
  },
  "react-native-expo": {
    id: "react-native-expo",
    label: "React Native Expo App",
    platform: "mobile",
    techStackAliases: ["react-native-expo", "expo", "react-native"],
    designPolicy: "stitch-brief-only",
    conversionPolicy: "reference_only",
    scaffoldPolicy: "hybrid",
    projectTypes: ["mobile-app", "react-native", "expo"],
    whenToUse: "Use for Expo/React Native apps where Stitch is reference material, not direct HTML-to-native conversion.",
    repoSignals: ["expo dependency", "app.json", "app.config.ts", "App.tsx"],
    setup: {
      install: "npm install",
      dev: "npx expo start",
      build: "npx expo export --platform web --dev",
      test: "npm test",
      smoke: "npx expo-doctor",
    },
    fileContract: {
      entrypoints: ["App.tsx", "src/App.tsx", "app/_layout.tsx"],
      routes: ["app/**/*.tsx", "src/screens/**/*.tsx"],
      assets: ["assets/"],
      generated: [],
      notes: ["Stitch HTML is reference-only. Build native-equivalent RN components with platform primitives."],
    },
    routeContract: {
      router: "expo",
      routeFiles: ["app/**/*.tsx", "src/navigation/**/*.tsx"],
      requiredRoutes: ["/"],
    },
    verification: {
      build: ["npx expo export --platform web --dev"],
      smoke: ["npx expo-doctor"],
      dom: [],
      visual: ["capture Expo web screenshots only when configured"],
      tests: ["npm test when present"],
    },
    requiredFiles: ["package.json", "app.json"],
    artifactChecks: ["dist/index.html OR expo-doctor exit 0"],
    targetResolutionRules: MOBILE_TARGET_RULES,
    mockInjectionPolicy: { fixtureRoot: "src/__fixtures__", bootstrapFile: "src/test/bridge.ts", productionIsolation: "test_only" },
    dataAccessPolicy: { defaultClientState: "React Native state/store", defaultServerState: "none unless API integration is explicit", allowedLibraries: ["zod"] },
    implementationBoundaries: {
      setupOwnedFiles: ["package.json", "package-lock.json", "app.json", "app.config.ts", "tsconfig.json"],
      forbiddenDuringImplement: ["package.json", "package-lock.json", "app.json", "app.config.ts", "tsconfig.json"],
      sharedFiles: ["App.tsx", "src/App.tsx", "src/navigation/routes.tsx"],
    },
    dependencyPolicy: { ecosystem: "npm", allowedDependencies: ["zustand", "zod", "@react-navigation/native", "expo-secure-store"] },
    prompt: [
      "Follow the resolved React Native Expo stack contract.",
      "Treat Stitch HTML as visual reference only; do not paste DOM/CSS into native components.",
      "Expo web export is not native device build evidence.",
    ].join("\n"),
  },
  "android-app": {
    id: "android-app",
    label: "Android App",
    platform: "mobile",
    techStackAliases: ["android-native", "android"],
    designPolicy: "stitch-brief-only",
    conversionPolicy: "reference_only",
    scaffoldPolicy: "verify-existing",
    projectTypes: ["android", "mobile-app"],
    whenToUse: "Use for native Android apps with Gradle, AndroidManifest, Kotlin, Java, or Android project evidence.",
    repoSignals: ["settings.gradle", "build.gradle", "AndroidManifest.xml", "MainActivity.kt"],
    setup: {
      build: "./gradlew build",
      test: "./gradlew test",
      smoke: "./gradlew assembleDebug",
    },
    fileContract: {
      entrypoints: ["app/src/main/AndroidManifest.xml", "app/src/main/java/**/MainActivity.kt", "app/src/main/kotlin/**/MainActivity.kt"],
      routes: [],
      assets: ["app/src/main/res/"],
      generated: [],
      notes: ["Prefer the existing UI system. Use Jetpack Compose for new UI only when the project already supports it or setup adds it intentionally."],
    },
    routeContract: {
      router: "android",
      routeFiles: ["app/src/main/AndroidManifest.xml"],
      requiredRoutes: [],
    },
    verification: {
      build: ["./gradlew build"],
      smoke: ["./gradlew assembleDebug"],
      dom: [],
      visual: ["capture emulator screenshots when mobile QA infrastructure is available"],
      tests: ["./gradlew test"],
    },
    requiredFiles: ["settings.gradle", "build.gradle"],
    artifactChecks: ["Gradle build exit 0"],
    targetResolutionRules: MOBILE_TARGET_RULES,
    mockInjectionPolicy: { fixtureRoot: "app/src/test/fixtures", bootstrapFile: "app/src/androidTest", productionIsolation: "test_only" },
    dataAccessPolicy: { defaultClientState: "ViewModel or Compose state", defaultServerState: "repository layer only when PRD requires backend", allowedLibraries: [] },
    implementationBoundaries: {
      setupOwnedFiles: ["settings.gradle", "build.gradle", "app/build.gradle"],
      forbiddenDuringImplement: ["settings.gradle", "build.gradle", "app/build.gradle"],
      sharedFiles: ["app/src/main/AndroidManifest.xml"],
    },
    dependencyPolicy: { ecosystem: "gradle", allowedDependencies: [] },
    prompt: [
      "Follow the resolved Android stack contract.",
      "Respect AndroidManifest, Gradle, resource, and package structure.",
      "Do not mix unrelated mobile stacks into a native Android project.",
    ].join("\n"),
  },
  "ios-app": {
    id: "ios-app",
    label: "iOS App",
    platform: "mobile",
    techStackAliases: ["ios-native", "ios"],
    designPolicy: "stitch-brief-only",
    conversionPolicy: "reference_only",
    scaffoldPolicy: "verify-existing",
    projectTypes: ["ios", "iphone", "mobile-app"],
    whenToUse: "Use for native iOS apps with Xcode, Swift, SwiftUI, UIKit, or iOS project evidence.",
    repoSignals: [".xcodeproj", ".xcworkspace", "Info.plist", "Swift files"],
    setup: {
      build: "xcodebuild build",
      test: "xcodebuild test",
      smoke: "xcodebuild build",
    },
    fileContract: {
      entrypoints: ["*App.swift", "AppDelegate.swift", "SceneDelegate.swift", "ContentView.swift"],
      routes: [],
      assets: ["Assets.xcassets/"],
      generated: [],
      notes: ["Respect safe areas, Dynamic Type, accessibility labels, and platform navigation conventions."],
    },
    routeContract: {
      router: "ios",
      routeFiles: ["*App.swift", "AppDelegate.swift", "SceneDelegate.swift"],
      requiredRoutes: [],
    },
    verification: {
      build: ["xcodebuild build"],
      smoke: ["xcodebuild build"],
      dom: [],
      visual: ["capture simulator screenshots when mobile QA infrastructure is available"],
      tests: ["xcodebuild test"],
    },
    requiredFiles: ["*.xcodeproj"],
    artifactChecks: ["xcodebuild exit 0"],
    targetResolutionRules: MOBILE_TARGET_RULES,
    mockInjectionPolicy: { fixtureRoot: "Tests/Fixtures", bootstrapFile: "Tests/TestBridge.swift", productionIsolation: "test_only" },
    dataAccessPolicy: { defaultClientState: "SwiftUI Observable state", defaultServerState: "repository/service only when PRD requires backend", allowedLibraries: [] },
    implementationBoundaries: {
      setupOwnedFiles: ["*.xcodeproj", "Package.swift"],
      forbiddenDuringImplement: ["*.xcodeproj", "Package.swift"],
      sharedFiles: ["*App.swift", "ContentView.swift"],
    },
    dependencyPolicy: { ecosystem: "swift", allowedDependencies: [] },
    prompt: [
      "Follow the resolved iOS stack contract.",
      "Respect Xcode project structure, SwiftUI/UIKit conventions, safe areas, and accessibility.",
      "Do not mix unrelated mobile stacks into a native iOS project.",
    ].join("\n"),
  },
  "desktop-electron": {
    id: "desktop-electron",
    label: "Desktop Electron App",
    platform: "desktop",
    techStackAliases: ["desktop-electron", "electron"],
    designPolicy: "stitch-required",
    conversionPolicy: "wrap_jsx",
    scaffoldPolicy: "hybrid",
    projectTypes: ["desktop-app", "electron"],
    whenToUse: "Use for Electron desktop apps with renderer UI plus main-process desktop shell.",
    repoSignals: ["electron dependency", "electron-builder", "src/main.ts", "src/renderer"],
    setup: {
      install: "npm install",
      dev: "npm run dev",
      build: "npm run build",
      test: "npm test",
      smoke: "npm run build",
    },
    fileContract: {
      entrypoints: ["src/main.ts", "src/renderer/main.tsx", "src/App.tsx"],
      routes: ["src/renderer/**/*.tsx", "src/**/*.tsx"],
      assets: ["public/", "src/assets/"],
      generated: [],
      notes: ["Keep main-process capabilities separate from renderer UI state."],
    },
    routeContract: {
      router: "electron-renderer",
      routeFiles: ["src/renderer/**/*.tsx", "src/App.tsx"],
      requiredRoutes: ["/"],
    },
    verification: {
      build: ["npm run build"],
      smoke: ["run renderer smoke or build"],
      dom: ["extract renderer controls"],
      visual: ["capture renderer screenshots when configured"],
      tests: ["npm test when present"],
    },
    requiredFiles: ["package.json"],
    artifactChecks: ["build command exit 0"],
    targetResolutionRules: VITE_TARGET_RULES,
    mockInjectionPolicy: { fixtureRoot: "src/__fixtures__", bootstrapFile: "src/test/bridge.ts", productionIsolation: "runtime_seed" },
    dataAccessPolicy: { defaultClientState: "renderer React state", defaultServerState: "Electron main process only for desktop APIs", allowedLibraries: [] },
    implementationBoundaries: {
      setupOwnedFiles: ["package.json", "package-lock.json", "tsconfig.json", "electron-builder.json"],
      forbiddenDuringImplement: ["package.json", "package-lock.json", "tsconfig.json", "electron-builder.json"],
      sharedFiles: ["src/App.tsx", "src/renderer/main.tsx", "src/main.ts"],
    },
    dependencyPolicy: { ecosystem: "npm", allowedDependencies: ["electron", "electron-builder", "zustand", "zod", "lucide-react"] },
    prompt: [
      "Follow the resolved Electron stack contract.",
      "Keep renderer UI separate from main-process integration.",
    ].join("\n"),
  },
};

for (const id of Object.keys(STACK_PACKS) as StackPackId[]) {
  STACK_PACKS[id] = finalizePack(STACK_PACKS[id]);
}

export function getStackPack(packId: StackPackId): StackPack {
  return STACK_PACKS[packId];
}

export function listStackPacks(): StackPack[] {
  return Object.values(STACK_PACKS);
}
