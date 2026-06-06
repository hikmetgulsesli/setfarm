export type PlatformSelfHealMode = "plan_only" | "patch_only" | "patch_and_resume";

export type FailureClass = "project_failure" | "platform_failure" | "ambiguous_failure";

export type RepairTarget = "generated_project" | "setfarm_repo" | "mission_control" | "none";

export type ResumePolicy = "resume_same_run" | "replay_failed_step" | "start_clean_replay" | "none";

export interface PlatformSelfHealConfig {
  enabled: boolean;
  mode: PlatformSelfHealMode;
  maxPatchesPerRun: number;
  maxClassificationsPerRun: number;
  minConfidence: number;
  autoResume: boolean;
  allowedAreas: string[];
  allowedClasses: string[];
  forbidDirtyRepo: boolean;
  requireTestDelta: boolean;
  requireReplay: boolean;
  rollbackOnFail: boolean;
}

export interface MechanicalCorroboration {
  type: "known_pattern" | "deterministic_signature" | "recurring_failure";
  id: string;
  detail: string;
}

export interface FailureRoute {
  schema: "setfarm.failure-route.v1";
  createdAt: string;
  selfHealId: string;
  runId: string;
  stepId: string;
  failureClass: FailureClass;
  category: string;
  confidence: number;
  evidence: string[];
  repairTarget: RepairTarget;
  repairMode: "platform_self_heal" | "project_repair" | "human_review";
  resumePolicy: ResumePolicy;
  mechanicalCorroboration: MechanicalCorroboration[];
  blueAssessment: {
    classification: FailureClass;
    category: string;
    rationale: string;
  };
  redAssessment: {
    invalidatedPlatformFailure: boolean;
    rationale: string;
  };
  policy: {
    mode: PlatformSelfHealMode;
    allowedByEnv: boolean;
    patchEligible: boolean;
    reason: string;
  };
}

export interface PatchPlan {
  schema: "setfarm.platform-patch-plan.v1";
  selfHealId: string;
  createdAt: string;
  intent: string;
  targetFiles: string[];
  expectedBehaviorChange: string[];
  testsToRun: string[];
  rollback: "none" | "revert_patch_if_tests_fail";
  status: "plan_only";
  reason: string;
}

export interface PlatformSelfHealResult {
  attempted: boolean;
  selfHealId?: string;
  artifactDir?: string;
  route?: FailureRoute;
  patchPlan?: PatchPlan;
  reason?: string;
}
