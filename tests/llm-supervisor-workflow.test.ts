import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflow = readFileSync(resolve(import.meta.dirname, "../workflows/feature-dev/workflow.yml"), "utf-8");
const stepsSection = workflow.split(/^steps:/m)[1] || "";
const prompt = readFileSync(resolve(import.meta.dirname, "../src/installer/steps/12-supervise/prompt.md"), "utf-8");
const verifyPrompt = readFileSync(resolve(import.meta.dirname, "../src/installer/steps/07-verify/prompt.md"), "utf-8");
const agent = readFileSync(resolve(import.meta.dirname, "../workflows/feature-dev/agents/supervisor/AGENTS.md"), "utf-8");

describe("LLM product supervisor architecture", () => {
  it("declares a dedicated supervisor role and agent", () => {
    assert.match(workflow, /supervisor:\s+\[feature-dev_supervisor\]/);
    assert.match(workflow, /- id: supervisor\s+name: Product Supervisor\s+role: coding/s);
  });

  it("runs supervisor after verify and before downstream gates", () => {
    const verifyIdx = stepsSection.indexOf("- id: verify");
    const superviseIdx = stepsSection.indexOf("- id: supervise");
    const securityIdx = stepsSection.indexOf("- id: security-gate");
    assert.ok(verifyIdx > 0, "verify step exists");
    assert.ok(superviseIdx > verifyIdx, "supervisor runs after verify");
    assert.ok(securityIdx > superviseIdx, "security-gate runs after supervisor");
  });

  it("requires durable supervisor memory instead of project-specific rules", () => {
    assert.match(prompt, /SUPERVISOR_MEMORY/);
    assert.match(prompt, /SUPERVISOR_RUN/);
    assert.match(prompt, /SUPERVISOR_STATE/);
    assert.match(prompt, /SUPERVISOR_INTERVENTIONS/);
    assert.match(prompt, /SUPERVISOR_VISUAL_REPORT/);
    assert.match(prompt, /SUPERVISOR_MEMORY_APPEND/);
    assert.match(agent, /whole run/);
    assert.match(prompt, /Apply this same system-level\s+contract to every project/);
    assert.match(prompt, /Do not add project-specific policy/);
    assert.match(prompt, /durable, reusable manager findings/);
    assert.match(agent, /Do not create one-off, project-specific policy/);
    assert.match(readFileSync(resolve(import.meta.dirname, "../src/installer/steps/12-supervise/rules.md"), "utf-8"), /persistent manager session/);
  });

  it("keeps supervisor patch git ownership on Setfarm", () => {
    assert.match(prompt, /Setfarm will\s+commit and push supervisor edits after this step validates scope/);
    assert.match(readFileSync(resolve(import.meta.dirname, "../src/installer/steps/12-supervise/rules.md"), "utf-8"), /Do not create git commits manually/);
    assert.doesNotMatch(prompt, /git commit -m "fix: supervisor audit"/);
  });

  it("forces story-scoped supervisor audits onto the story worktree", () => {
    assert.match(prompt, /SUPERVISOR_WORKDIR/);
    assert.match(prompt, /STORY_WORKDIR/);
    assert.match(prompt, /MAIN_REPO/);
    assert.match(prompt, /only authoritative checkout/);
    assert.match(prompt, /Do not audit `MAIN_REPO` as a fallback/);
  });

  it("injects supervisor memory into per-story verify feedback", () => {
    assert.match(verifyPrompt, /SUPERVISOR_MEMORY/);
    assert.match(verifyPrompt, /durable manager decisions/);
  });

  it("keeps developer git ownership on the platform, not story agents", () => {
    assert.match(workflow, /Developers write code only in prepared story worktrees/);
    assert.match(workflow, /Setfarm stages the\s+declared scope, commits and pushes the story branch/);
    assert.doesNotMatch(workflow, /Developer commits and pushes the prepared story branch/);
  });
});
