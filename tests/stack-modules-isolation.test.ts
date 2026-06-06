import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { listStackModules, classifyStackFailure } from "../src/installer/stack-modules/registry.js";

test("every stack module routes tooling infrastructure failures to infra_retry", () => {
  for (const module of listStackModules()) {
    const decision = module.classifyFailure({
      stepId: "verify",
      failure: "playwright chromium_headless_shell executable doesn't exist; please run npx playwright install",
      hasMachineEvidence: true,
    });
    assert.equal(decision.owner, "infra", module.id);
    assert.equal(decision.action, "infra_retry", module.id);
    assert.equal(decision.category, "browser_infra_failure", module.id);
  }
});

test("stack modules choose shared browser smoke only for browser runtime stacks", () => {
  for (const module of listStackModules()) {
    const plan = module.executionPlanForStep("qa-test");
    if (plan.runtimeKind === "browser") {
      assert.equal(plan.systemSmokeRunner, "setfarm-smoke-test", module.id);
      assert.equal(plan.shouldAllocateRuntime, true, module.id);
    } else {
      assert.equal(plan.systemSmokeRunner, "stack-agent", module.id);
      assert.equal(plan.shouldAllocateRuntime, false, module.id);
    }
  }
});

test("stack modules keep game product evidence separate from framework selection", () => {
  const game = classifyStackFailure("browser-game-canvas", {
    stepId: "verify",
    failure: "[GAME] src/screens/Gameplay.tsx: gameplay runtime exposes moving position state, but visible game objects are not positioned from runtime data",
    hasMachineEvidence: true,
  });
  assert.equal(game.owner, "product");
  assert.equal(game.action, "product_retry");
  assert.equal(game.category, "verify_quality_failure");

  const next = classifyStackFailure("nextjs-web-app", {
    stepId: "verify",
    failure: "next build route /settings failed due to missing page export",
    hasMachineEvidence: true,
  });
  assert.equal(next.owner, "product");
  assert.equal(next.action, "product_retry");
  assert.equal(next.category, "verify_quality_failure");
});

test("stack module integration prevents infra evidence from reaching product gate", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/installer/step-ops.ts"), "utf-8");
  assert.match(source, /stackPackId: context\["stack_pack_id"\] \|\| context\["detected_stack"\]/);
  assert.match(source, /implementEvidenceRun\.failureAction === "infra_retry"/);
  assert.match(source, /SETFARM_INFRA_RETRY/);
  assert.match(source, /await failStep\(stepId, infraReason\)/);
});

test("QA and final preclaims use stack execution plans instead of generic browser checks", () => {
  const qa = fs.readFileSync(path.join(process.cwd(), "src/installer/steps/09-qa-test/preclaim.ts"), "utf-8");
  const final = fs.readFileSync(path.join(process.cwd(), "src/installer/steps/10-final-test/preclaim.ts"), "utf-8");
  for (const source of [qa, final]) {
    assert.match(source, /stackExecutionPlanForStep\(ctx\.stepId, stackContract\)/);
    assert.match(source, /stackPlan\.systemSmokeRunner !== "setfarm-smoke-test"/);
    assert.doesNotMatch(source, /isBrowserRuntimeStack/);
  }
});
