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
fs.mkdirSync(pidDir, { recursive: true });
fs.writeFileSync(pidFile, String(process.pid));

process.on("SIGTERM", () => {
  try { fs.unlinkSync(pidFile); } catch {}
  process.exit(0);
});

await startDashboardWithPreSchemaAdmissionV3(port);
