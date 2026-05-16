export type StackPackId =
  | "nextjs-web-app"
  | "vite-react-web-app"
  | "static-html-site"
  | "browser-game-canvas"
  | "python-cli"
  | "python-web"
  | "android-app"
  | "ios-app";

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

export interface StackPack {
  id: StackPackId;
  label: string;
  projectTypes: string[];
  whenToUse: string;
  repoSignals: string[];
  setup: StackCommandSet;
  fileContract: StackFileContract;
  routeContract: StackRouteContract;
  verification: StackVerificationContract;
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
