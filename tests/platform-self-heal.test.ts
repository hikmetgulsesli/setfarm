import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readPlatformSelfHealConfig } from "../src/installer/platform-self-heal/config.js";
import { classifyPlatformFailure } from "../src/installer/platform-self-heal/classifier.js";
import { buildPlanOnlyPatchPlan, validatePatchPlanTargets } from "../src/installer/platform-self-heal/patch-contract.js";
import { assertSelfHealWriteAllowed } from "../src/installer/platform-self-heal/write-interceptor.js";
import { analyzeStrictnessDelta } from "../src/installer/platform-self-heal/strictness-delta.js";
import { capturePrePatchHashes, restorePrePatchHashes } from "../src/installer/platform-self-heal/rollback.js";
import { persistPlanOnlyArtifacts } from "../src/installer/platform-self-heal/workspace.js";

const ENV_KEYS = [
  "SETFARM_PLATFORM_SELF_HEAL",
  "SETFARM_PLATFORM_SELF_HEAL_MODE",
  "SETFARM_PLATFORM_SELF_HEAL_ALLOWED_CLASSES",
  "SETFARM_PLATFORM_SELF_HEAL_ALLOWED_AREAS",
  "SETFARM_PLATFORM_SELF_HEAL_DIR",
];

const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("platform self-heal safety foundation", () => {
  it("defaults to disabled plan-only policy", () => {
    const config = readPlatformSelfHealConfig();
    assert.equal(config.enabled, false);
    assert.equal(config.mode, "plan_only");
    assert.equal(config.autoResume, false);
    assert.equal(config.maxPatchesPerRun, 1);
  });

  it("keeps self-heal in plan-only mode even when patch mode is requested", () => {
    process.env.SETFARM_PLATFORM_SELF_HEAL = "on";
    process.env.SETFARM_PLATFORM_SELF_HEAL_MODE = "patch_and_resume";
    const config = readPlatformSelfHealConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.mode, "plan_only");
    assert.equal(config.autoResume, false);
  });

  it("classifies known QA interaction failures as mechanically corroborated platform failures", () => {
    process.env.SETFARM_PLATFORM_SELF_HEAL = "on";
    process.env.SETFARM_PLATFORM_SELF_HEAL_MODE = "plan_only";
    const route = classifyPlatformFailure({
      runId: "run-1",
      stepId: "qa-test",
      error: "GUARDRAIL [module:qa-test]: STATUS: done requires QA_INTERACTIONS_TESTED > 0. QA_INTERACTIONS_TESTED=0",
      config: readPlatformSelfHealConfig(),
      selfHealId: "sh_test",
    });

    assert.equal(route.failureClass, "platform_failure");
    assert.equal(route.category, "smoke_contract_gap");
    assert.equal(route.mechanicalCorroboration[0].type, "known_pattern");
    assert.equal(route.policy.patchEligible, false);
    assert.match(route.policy.reason, /Plan-only mode/);
  });

  it("keeps uncorroborated project-like failures ambiguous", () => {
    process.env.SETFARM_PLATFORM_SELF_HEAL = "on";
    const route = classifyPlatformFailure({
      runId: "run-2",
      stepId: "qa-test",
      error: "The game does not move and the settings button has no handler.",
      config: readPlatformSelfHealConfig(),
      selfHealId: "sh_project",
    });

    assert.equal(route.failureClass, "ambiguous_failure");
    assert.notEqual(route.repairTarget, "setfarm_repo");
    assert.equal(route.mechanicalCorroboration.length, 0);
  });

  it("validates patch targets against ownership and blocks immutable tests", () => {
    process.env.SETFARM_PLATFORM_SELF_HEAL = "on";
    const route = classifyPlatformFailure({
      runId: "run-3",
      stepId: "qa-test",
      error: "QA_INTERACTIONS_TESTED=0 requires QA_INTERACTIONS_TESTED > 0",
      config: readPlatformSelfHealConfig(),
      selfHealId: "sh_targets",
    });
    const plan = buildPlanOnlyPatchPlan(route);
    assert.equal(validatePatchPlanTargets(route, plan).ok, true);

    const badPlan = { ...plan, targetFiles: ["tests/platform-invariants/smoke-invariants.test.ts"] };
    const result = validatePatchPlanTargets(route, badPlan);
    assert.equal(result.ok, false);
    assert.match(result.reason || "", /Immutable/);
  });

  it("intercepts writes outside target files and immutable paths", () => {
    const plan = {
      schema: "setfarm.platform-patch-plan.v1" as const,
      selfHealId: "sh_write",
      createdAt: new Date().toISOString(),
      intent: "test",
      targetFiles: ["scripts/smoke-test.mjs", "tests/smoke-test-static-rules.test.ts"],
      expectedBehaviorChange: [],
      testsToRun: [],
      rollback: "none" as const,
      status: "plan_only" as const,
      reason: "test",
    };
    assert.doesNotThrow(() => assertSelfHealWriteAllowed(plan, "scripts/smoke-test.mjs"));
    assert.throws(() => assertSelfHealWriteAllowed(plan, "src/installer/step-fail.ts"), /OUTSIDE_TARGET_FILES/);
    assert.throws(() => assertSelfHealWriteAllowed(plan, "tests/platform-invariants/smoke-invariants.test.ts"), /FORBIDDEN_IMMUTABLE/);
  });

  it("flags strictness-reducing diffs", () => {
    const issues = analyzeStrictnessDelta([
      "- if (!ok) throw new Error('GUARDRAIL failed')",
      "+ if (!ok) console.warn('ignored')",
      "- return false;",
      "+ return true;",
    ].join("\n"));
    assert.equal(issues.some((issue) => issue.severity === "blocker" && issue.rule === "deleted_throw"), true);
    assert.equal(issues.some((issue) => issue.severity === "blocker" && issue.rule === "deleted_return_false"), true);
  });

  it("restores pre-patch file contents by captured hash state", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-self-heal-rollback-"));
    try {
      const file = path.join(tmp, "target.ts");
      fs.writeFileSync(file, "original");
      const snapshots = capturePrePatchHashes([file, path.join(tmp, "missing.ts")]);
      fs.writeFileSync(file, "changed");
      fs.writeFileSync(path.join(tmp, "missing.ts"), "created");
      restorePrePatchHashes(snapshots);
      assert.equal(fs.readFileSync(file, "utf-8"), "original");
      assert.equal(fs.existsSync(path.join(tmp, "missing.ts")), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("writes plan-only artifacts without applying a patch", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-self-heal-artifacts-"));
    process.env.SETFARM_PLATFORM_SELF_HEAL_DIR = tmp;
    try {
      process.env.SETFARM_PLATFORM_SELF_HEAL = "on";
      const route = classifyPlatformFailure({
        runId: "run-4",
        stepId: "qa-test",
        error: "QA_INTERACTIONS_TESTED=0 requires QA_INTERACTIONS_TESTED > 0",
        config: readPlatformSelfHealConfig(),
        selfHealId: "sh_artifact",
      });
      const patchPlan = buildPlanOnlyPatchPlan(route);
      const dir = persistPlanOnlyArtifacts({ route, patchPlan });
      assert.equal(fs.existsSync(path.join(dir, "FAILURE_ROUTE.json")), true);
      assert.equal(fs.existsSync(path.join(dir, "PATCH_PLAN.json")), true);
      const result = JSON.parse(fs.readFileSync(path.join(dir, "RESULT.json"), "utf-8"));
      assert.equal(result.patchApplied, false);
      assert.equal(result.status, "plan_only");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
