import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deployModule } from "../../dist/installer/steps/11-deploy/module.js";
import { normalize, validateOutput } from "../../dist/installer/steps/11-deploy/guards.js";
import { evaluateDeployCapability } from "../../dist/installer/steps/11-deploy/preclaim.js";
import { humanizeProjectDisplayName, normalizeMissionControlHostname, normalizeMissionControlSummary } from "../../dist/installer/step-ops.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

describe("11-deploy step module", () => {
  it("module metadata", () => {
    assert.equal(deployModule.id, "deploy");
    assert.equal(deployModule.type, "single");
    assert.equal(deployModule.agentRole, "deployer");
    assert.equal(typeof deployModule.preClaim, "function");
    assert.equal(deployModule.maxPromptSize, 10240);
  });

  it("injectContext adds stack evidence context", async () => {
    const context: Record<string, string> = { foo: "bar" };
    await deployModule.injectContext({ runId: "r1", stepId: "deploy", task: "t", context });
    assert.equal(context.foo, "bar");
    assert.equal(context.stack_pack_id, "needs-reconcile");
    assert.match(context.stack_contract, /Schema: setfarm\.stack-contract\.v1/);
    assert.match(context.stack_verification_contract, /no stack-specific verification/i);
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
    assert.ok(prompt.includes("Rules"));
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

  it("validateOutput accepts retry without extra fields (enforcement upstream in step-ops)", () => {
    assert.equal(validateOutput({ status: "retry" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "retry", errors: "port busy" } as ParsedOutput).ok, true);
  });

  it("validateOutput accepts STATUS: skip", () => {
    assert.equal(validateOutput({ status: "skip" } as ParsedOutput).ok, true);
  });

  it("deploy capability gate skips when local and remote deployment infrastructure is unavailable", () => {
    const decision = evaluateDeployCapability({
      platform: "darwin",
      localMissionControl: false,
      localSystemctl: false,
      remoteHost: "",
      remoteReachable: false,
      deployRequired: false,
      deployDisabled: false,
    });

    assert.equal(decision.shouldSkip, true);
    assert.equal(decision.mode, "unavailable");
    assert.match(decision.reason, /Deployment infrastructure is unavailable/);
    assert.match(decision.reason, /Mission Control/);
  });

  it("deploy capability gate lets the deployer run when local deploy services are available", () => {
    const decision = evaluateDeployCapability({
      platform: "linux",
      localMissionControl: true,
      localSystemctl: true,
      remoteHost: "",
      remoteReachable: false,
      deployRequired: false,
      deployDisabled: false,
    });

    assert.equal(decision.shouldSkip, false);
    assert.equal(decision.mode, "local");
  });

  it("deploy capability gate does not auto-skip when deploy is explicitly required", () => {
    const decision = evaluateDeployCapability({
      platform: "darwin",
      localMissionControl: false,
      localSystemctl: false,
      remoteHost: "deploy-host",
      remoteReachable: false,
      deployRequired: true,
      deployDisabled: false,
    });

    assert.equal(decision.shouldSkip, false);
    assert.equal(decision.mode, "required");
  });

  it("validateOutput rejects unknown STATUS", () => {
    assert.equal(validateOutput({ status: "deployed" } as ParsedOutput).ok, false);
  });

  it("normalize first-word lowercase", () => {
    const parsed = { status: "DONE\nDEPLOY_URL: https://x" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], "done");
  });

  it("normalizes Mission Control hostnames to hostname-only domains", () => {
    assert.equal(
      normalizeMissionControlHostname("https://https//sample-control-0510.setrox.com.tr", "sample-control-0510"),
      "sample-control-0510.setrox.com.tr",
    );
    assert.equal(
      normalizeMissionControlHostname("https://sample-control-0510.setrox.com.tr/path?q=1", "sample-control-0510"),
      "sample-control-0510.setrox.com.tr",
    );
    assert.equal(
      normalizeMissionControlHostname("not a host", "sample-control-0510"),
      "sample-control-0510.setrox.com.tr",
    );
  });

  it("normalizes Mission Control display names and raw task summaries", () => {
    assert.equal(
      humanizeProjectDisplayName("sample-control-0510 Build a browser-based React/Vite/TypeScript operations control room"),
      "Sample Control",
    );
    assert.equal(
      normalizeMissionControlSummary("Project: sample-control-0510 Build a browser-based React/Vite/TypeScript operations control room", "Sample Control"),
      "Sample Control web application.",
    );
    assert.equal(
      normalizeMissionControlSummary("Operations dashboard for active jobs.", "Sample Control"),
      "Operations dashboard for active jobs.",
    );
  });
});
