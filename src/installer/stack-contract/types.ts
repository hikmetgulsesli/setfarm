export type StackPackId =
  | "nextjs-web-app"
  | "vite-react-web-app"
  | "static-html-site"
  | "browser-game-canvas"
  | "node-express-api"
  | "node-cli"
  | "python-cli"
  | "python-web"
  | "react-native-expo"
  | "android-app"
  | "ios-app"
  | "desktop-electron";

export type StackContractStatus = "resolved" | "needs-reconcile";

export type StackContractConfidence = "high" | "medium" | "low";

export type StackEvidenceType =
  | "dependency"
  | "script"
  | "file"
  | "directory"
  | "task-hint";

export interface StackEvidence {
  type: StackEvidenceType;
  path?: string;
  value: string;
  weight: number;
}

export interface StackCommandSet {
  install?: string;
  dev?: string;
  build?: string;
  test?: string;
  smoke?: string;
  preview?: string;
}

export interface StackFileContract {
  entrypoints: string[];
  routes: string[];
  assets: string[];
  generated: string[];
  notes: string[];
}

export interface StackRouteContract {
  router: string;
  routeFiles: string[];
  requiredRoutes: string[];
}

export interface StackVerificationContract {
  build: string[];
  smoke: string[];
  dom: string[];
  visual: string[];
  tests: string[];
}

export type StackDesignPolicy = "stitch-required" | "stitch-brief-only" | "none";
export type StackConversionPolicy = "none" | "wrap_jsx" | "reference_only" | "native_equivalent";
export type StackScaffoldPolicy = "create" | "verify-existing" | "hybrid";

export type ScopeTargetRole =
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

export const SCOPE_TARGET_ROLES: ScopeTargetRole[] = [
  "app_shell",
  "route_registration",
  "surface_component",
  "action_handler",
  "state_store",
  "fixture_data",
  "persistence_adapter",
  "test_bridge",
  "style_integration",
  "game_runtime",
  "api_route",
  "cli_command",
];

export type StackRouterParadigm =
  | "file_system_nested"
  | "declarative_flat"
  | "single_entry"
  | "native_manifest"
  | "none"
  | "game_runtime";

export type TargetResolutionKind = "single_file" | "shared_file" | "file_set" | "submodule_set";

export interface TargetResolutionRule {
  ruleId: string;
  template: string;
  allowedRoles: ScopeTargetRole[];
  kind?: TargetResolutionKind;
}

export interface SlugRules {
  surface_slug: string;
  screen_file: string;
  action_file: string;
  entity_file: string;
}

export interface SlugRuleTest {
  ruleKey: keyof SlugRules;
  input: string;
  expected: string;
}

export interface MockInjectionPolicy {
  fixtureRoot?: string;
  bootstrapFile?: string;
  productionIsolation: "test_only" | "dev_only" | "runtime_seed";
}

export interface DataAccessPolicy {
  defaultClientState: string;
  defaultServerState: string;
  allowedLibraries: string[];
}

export interface ImplementationBoundaries {
  setupOwnedFiles: string[];
  forbiddenDuringImplement: string[];
  sharedFiles: string[];
}

export interface DependencyPolicy {
  ecosystem: "npm" | "python" | "gradle" | "swift" | "none";
  allowedDependencies: string[];
}

export type DependencyConflictStrategy = "highest_compatible" | "exact_match" | "reject_conflict";

export interface DependencyResolutionPolicy {
  conflictStrategy: DependencyConflictStrategy;
  outOfEcosystem: "reject";
  manifestPatchMode: "setup_build_only";
}

export type SharedEditValidationPolicy = "ast_required" | "patch_window" | "human_review_required";

export interface PatchWindowMarker {
  file: string;
  start: string;
  end: string;
  scope: string;
}

export interface UtilityFilePolicy {
  allowedRoots: string[];
  naming: string;
  garbageCollection: "mc_reachable_imports" | "none";
}

export interface BuildStrippingPolicy {
  testBridgeStripping: {
    required: boolean;
    method: "bundler_define_replacement" | "file_exclusion" | "not_applicable";
    verification: "config_and_bundle_scan" | "not_applicable";
  };
  devToolStripping: {
    required: boolean;
    method: "bundler_define_replacement" | "file_exclusion" | "not_applicable";
    verification: "config_and_bundle_scan" | "not_applicable";
  };
}

export interface SandboxPrewarmPolicy {
  commands: string[];
  successCheck: "exit_code_zero" | "binary_hash" | "version_match" | "not_required";
  expectedVersion?: string;
  timeoutMs: number;
  networkPolicy: "allowlist" | "open" | "none";
  allowedHosts: string[];
  artifactPath: string;
}

export type StackRuntimeService = "frontend" | "backend" | "preview" | "none";
export type StackPortPolicy = "allocated_by_mc" | "not_required";
export type StackReadinessProbe = "http_200" | "port_open" | "log_pattern" | "not_required";
export type StackSmokeRunner = "setfarm-smoke-test" | "agent-browser" | "maestro" | "xctest" | "none";

export interface StackRuntimeContract {
  service: StackRuntimeService;
  host: string;
  portPolicy: StackPortPolicy;
  portBand?: "frontend" | "backend" | "preview";
  devCommand?: string;
  previewCommand?: string;
  readinessProbe: StackReadinessProbe;
  rootUrlPath?: string;
  appRootSelector?: string;
  smokeRunner: StackSmokeRunner;
  timeoutMs: number;
}

export interface StackToolPreflight {
  tool: string;
  command: string;
  required: boolean;
  timeoutMs: number;
  failureCategory: "tooling_contract_missing" | "browser_infra_failure" | "stack_preflight_failed";
}

export interface StackPack {
  id: StackPackId;
  label: string;
  platform?: string;
  techStackAliases?: string[];
  designPolicy?: StackDesignPolicy;
  conversionPolicy?: StackConversionPolicy;
  scaffoldPolicy?: StackScaffoldPolicy;
  projectTypes: string[];
  whenToUse: string;
  repoSignals: string[];
  setup: StackCommandSet;
  fileContract: StackFileContract;
  routeContract: StackRouteContract;
  verification: StackVerificationContract;
  requiredFiles?: string[];
  artifactChecks?: string[];
  targetResolutionRules?: Record<ScopeTargetRole, TargetResolutionRule>;
  routerParadigm?: StackRouterParadigm;
  slugRules?: SlugRules;
  slugRuleTests?: SlugRuleTest[];
  mockInjectionPolicy?: MockInjectionPolicy;
  dataAccessPolicy?: DataAccessPolicy;
  implementationBoundaries?: ImplementationBoundaries;
  dependencyPolicy?: DependencyPolicy;
  dependencyResolutionPolicy?: DependencyResolutionPolicy;
  sharedEditValidationPolicy?: SharedEditValidationPolicy;
  patchWindowMarkers?: PatchWindowMarker[];
  utilityFilePolicy?: UtilityFilePolicy;
  buildStrippingPolicy?: BuildStrippingPolicy;
  sandboxPrewarm?: SandboxPrewarmPolicy;
  runtime?: StackRuntimeContract;
  toolPreflight?: StackToolPreflight[];
  nativeEquivalentContract?: string;
  prompt: string;
}

export interface StackContract {
  schema: "setfarm.stack-contract.v1";
  status: StackContractStatus;
  packId?: StackPackId;
  label?: string;
  confidence: StackContractConfidence;
  reason: string;
  repoPath?: string;
  taskHints: string[];
  evidence: StackEvidence[];
  setup: StackCommandSet;
  fileContract: StackFileContract;
  routeContract: StackRouteContract;
  verification: StackVerificationContract;
  designPolicy?: StackDesignPolicy;
  conversionPolicy?: StackConversionPolicy;
  scaffoldPolicy?: StackScaffoldPolicy;
  targetResolutionRules?: Record<ScopeTargetRole, TargetResolutionRule>;
  routerParadigm?: StackRouterParadigm;
  slugRules?: SlugRules;
  slugRuleTests?: SlugRuleTest[];
  mockInjectionPolicy?: MockInjectionPolicy;
  dataAccessPolicy?: DataAccessPolicy;
  implementationBoundaries?: ImplementationBoundaries;
  dependencyPolicy?: DependencyPolicy;
  dependencyResolutionPolicy?: DependencyResolutionPolicy;
  sharedEditValidationPolicy?: SharedEditValidationPolicy;
  patchWindowMarkers?: PatchWindowMarker[];
  utilityFilePolicy?: UtilityFilePolicy;
  buildStrippingPolicy?: BuildStrippingPolicy;
  sandboxPrewarm?: SandboxPrewarmPolicy;
  runtime?: StackRuntimeContract;
  toolPreflight?: StackToolPreflight[];
  nativeEquivalentContract?: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResolveStackContractInput {
  repoPath?: string;
  taskText?: string;
  projectSlug?: string;
  now?: string;
}

export interface StackCandidate {
  packId: StackPackId;
  score: number;
  evidence: StackEvidence[];
}
