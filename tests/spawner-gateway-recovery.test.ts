import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");

describe("spawner gateway recovery wiring", () => {
  it("notifies the event-driven spawner when a run starts", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "run.ts"), "utf-8");
    assert.match(source, /pg_notify\('step_pending'/);
    assert.match(source, /agentId:\s*`\$\{workflow\.id\}_\$\{firstStep\.agent\}`/);
  });

  it("restarts gateway after prolonged prespawn readiness failures only when idle", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.match(source, /GATEWAY_PRESPAWN_RESTART_AFTER_MS/);
    assert.match(source, /activeProcesses\.size > 0\)\s*return/);
    assert.match(source, /execFile\("systemctl",\s*\["--user",\s*"restart",\s*"openclaw-gateway"\]/);
    assert.match(source, /maybeRestartGatewayForReadiness\(gatewayReadiness\.reason,\s*key\)/);
  });

  it("does not claim gateway cron recreation in event-driven spawner mode", () => {
    const source = fs.readFileSync(path.join(root, "src", "cli", "cli.ts"), "utf-8");
    assert.match(source, /gatewayAgentCronsEnabled/);
    assert.match(source, /event-driven spawner owns workflow/);
  });

  it("delegates verify review-delay decisions to claimStep", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
    assert.doesNotMatch(source, /isVerifyReviewDelayActive/);
    assert.doesNotMatch(source, /Verify review delay active/);
    assert.match(source, /claim = await claimStep\(fullAgentId,\s*agentId\)/);
  });
});
