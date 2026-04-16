import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deployModule } from "../../dist/installer/steps/11-deploy/module.js";
import { normalize, validateOutput } from "../../dist/installer/steps/11-deploy/guards.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

describe("11-deploy step module", () => {
  it("module metadata", () => {
    assert.equal(deployModule.id, "deploy");
    assert.equal(deployModule.type, "single");
    assert.equal(deployModule.agentRole, "deployer");
    assert.equal(deployModule.maxPromptSize, 10240);
  });

  it("injectContext is a no-op", async () => {
    const context: Record<string, string> = { foo: "bar" };
    await deployModule.injectContext({ runId: "r1", stepId: "deploy", task: "t", context });
    assert.deepEqual(context, { foo: "bar" });
  });

  it("buildPrompt derives PROJECT_NAME from REPO path", () => {
    const prompt = deployModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: { repo: "$HOME/projects/pomodoro-58131", build_cmd: "npm run build" },
    });
    assert.ok(prompt.includes("pomodoro-58131"));
    assert.ok(prompt.includes("npm run build"));
    assert.ok(prompt.includes("systemd"));
    assert.ok(prompt.includes("Kurallar"));
  });

  it("buildPrompt default BUILD_CMD when missing", () => {
    const prompt = deployModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: { repo: "$HOME/projects/app" },
    });
    assert.ok(prompt.includes("npm run build"));
  });

  it("buildPrompt stays within maxPromptSize", () => {
    const prompt = deployModule.buildPrompt({ runId: "r1", task: "t", context: { repo: "$HOME/projects/app" } });
    assert.ok(Buffer.byteLength(prompt, "utf-8") < deployModule.maxPromptSize);
  });

  it("validateOutput rejects missing STATUS", () => {
    assert.equal(validateOutput({} as ParsedOutput).ok, false);
  });

  it("validateOutput done requires DEPLOY_URL/SYSTEMD_UNIT/PORT", () => {
    const r1 = validateOutput({ status: "done" } as ParsedOutput);
    assert.equal(r1.ok, false);
    assert.ok(r1.errors.some(e => e.includes("DEPLOY_URL")));

    assert.equal(validateOutput({ status: "done", deploy_url: "https://x.setrox.com.tr" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "done", systemd_unit: "x.service" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "done", port: "4812" } as ParsedOutput).ok, true);
  });

  it("validateOutput retry requires feedback/issues/errors", () => {
    const r1 = validateOutput({ status: "retry" } as ParsedOutput);
    assert.equal(r1.ok, false);
    assert.ok(r1.errors.some(e => e.includes("FEEDBACK")));

    assert.equal(validateOutput({ status: "retry", errors: "port 4812 in use" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "retry", feedback: "nginx -t fail" } as ParsedOutput).ok, true);
  });

  it("validateOutput accepts STATUS: skip", () => {
    assert.equal(validateOutput({ status: "skip" } as ParsedOutput).ok, true);
  });

  it("validateOutput rejects unknown STATUS", () => {
    assert.equal(validateOutput({ status: "deployed" } as ParsedOutput).ok, false);
  });

  it("normalize first-word lowercase", () => {
    const parsed = { status: "DONE\nDEPLOY_URL: https://x" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], "done");
  });
});
