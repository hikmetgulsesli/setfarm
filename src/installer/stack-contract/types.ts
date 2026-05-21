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

export interface TargetResolutionRule {
  ruleId: string;
  template: string;
  allowedRoles: ScopeTargetRole[];
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
  mockInjectionPolicy?: MockInjectionPolicy;
  dataAccessPolicy?: DataAccessPolicy;
  implementationBoundaries?: ImplementationBoundaries;
  dependencyPolicy?: DependencyPolicy;
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
  mockInjectionPolicy?: MockInjectionPolicy;
  dataAccessPolicy?: DataAccessPolicy;
  implementationBoundaries?: ImplementationBoundaries;
  dependencyPolicy?: DependencyPolicy;
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
