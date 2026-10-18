#!/usr/bin/env node
import "../runtime-config.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { startDashboardWithPreSchemaAdmissionV3 } from "./dashboard.js";
import { assertOrdinaryDashboardDeploymentCutoverAdmissionV2 } from "../internal-production/baseline-deployment-cutover-v1.js";
import { assertTask6aPreSchemaOrdinaryStartupV2 } from "../internal-production/baseline-task6a-preschema-ordinary-refusal-v2.js";

const port = parseInt(process.argv[2], 10) || 3333;

const pidDir = path.join(os.homedir(), ".openclaw", "setfarm");
const pidFile = path.join(pidDir, "dashboard.pid");

assertOrdinaryDashboardDeploymentCutoverAdmissionV2();
await assertTask6aPreSchemaOrdinaryStartupV2();
assertOrdinaryDashboardDeploymentCutoverAdmissionV2();
function removeOwnPid(): void {
  try {
    if (fs.readFileSync(pidFile, "utf8") === String(process.pid)) fs.unlinkSync(pidFile);
  } catch {}
}
process.once("exit", removeOwnPid);
fs.mkdirSync(pidDir, { recursive: true });
fs.writeFileSync(pidFile, String(process.pid));
process.on("SIGTERM", () => process.exit(0));

const server = await startDashboardWithPreSchemaAdmissionV3(port);
await new Promise<void>((resolve, reject) => {
  if (server.listening) { resolve(); return; }
  const onListening = (): void => { server.off("error", onError); resolve(); };
  const onError = (error: Error): void => { server.off("listening", onListening); reject(error); };
  server.once("listening", onListening); server.once("error", onError);
});
if (process.send) {
  process.send({ type: "setfarm.dashboard.ready.v1", pid: process.pid, port }, (error) => {
    if (error) { server.close(); process.exitCode = 1; }
  });
}
