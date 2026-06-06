import type { PlatformSelfHealConfig, PlatformSelfHealMode } from "./types.js";

function boolEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function numberEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function listEnv(name: string, defaultValue: string[]): string[] {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return [...defaultValue];
  return raw.split(",").map((part) => part.trim()).filter(Boolean);
}

function modeEnv(): PlatformSelfHealMode {
  void process.env.SETFARM_PLATFORM_SELF_HEAL_MODE;
  return "plan_only";
}

export function readPlatformSelfHealConfig(): PlatformSelfHealConfig {
  return {
    enabled: boolEnv("SETFARM_PLATFORM_SELF_HEAL", false),
    mode: modeEnv(),
    maxPatchesPerRun: Math.max(0, Math.floor(numberEnv("SETFARM_PLATFORM_SELF_HEAL_MAX_PATCHES_PER_RUN", 1))),
    maxClassificationsPerRun: Math.max(0, Math.floor(numberEnv("SETFARM_PLATFORM_SELF_HEAL_MAX_CLASSIFICATIONS_PER_RUN", 3))),
    minConfidence: Math.min(1, Math.max(0, numberEnv("SETFARM_PLATFORM_SELF_HEAL_MIN_CONFIDENCE", 0.75))),
    autoResume: boolEnv("SETFARM_PLATFORM_SELF_HEAL_AUTO_RESUME", false),
    allowedAreas: listEnv("SETFARM_PLATFORM_SELF_HEAL_ALLOWED_AREAS", ["smoke", "qa", "final-test", "design-import", "mc", "stack-pack"]),
    allowedClasses: listEnv("SETFARM_PLATFORM_SELF_HEAL_ALLOWED_CLASSES", [
      "smoke_contract_gap",
      "qa_contract_gap",
      "final_test_contract_gap",
      "design_import_gap",
    ]),
    forbidDirtyRepo: boolEnv("SETFARM_PLATFORM_SELF_HEAL_FORBID_DIRTY_REPO", true),
    requireTestDelta: boolEnv("SETFARM_PLATFORM_SELF_HEAL_REQUIRE_TEST_DELTA", true),
    requireReplay: boolEnv("SETFARM_PLATFORM_SELF_HEAL_REQUIRE_REPLAY", true),
    rollbackOnFail: boolEnv("SETFARM_PLATFORM_SELF_HEAL_ROLLBACK_ON_FAIL", true),
  };
}
