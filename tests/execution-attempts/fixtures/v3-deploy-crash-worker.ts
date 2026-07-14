import { readFile } from "node:fs/promises";

import {
  createLocalProcessV3DeploymentAdapter,
  type V3DeploymentRequestV1,
} from "../../../src/execution/v3-deploy-executor.js";

type Payload = Readonly<{
  stateRoot: string;
  portStart: number;
  portEnd: number;
  isolationConfigRoots: Readonly<{ setfarmConfigRoot: string; missionControlConfigRoot: string }>;
  request: V3DeploymentRequestV1;
}>;

const inputPath = process.argv[2];
if (!inputPath) throw new Error("V3_DEPLOY_CRASH_WORKER_INPUT_MISSING");
const payload = JSON.parse(await readFile(inputPath, "utf8")) as Payload;
const adapter = createLocalProcessV3DeploymentAdapter({
  stateRoot: payload.stateRoot,
  portStart: payload.portStart,
  portEnd: payload.portEnd,
  isolationConfigRoots: payload.isolationConfigRoots,
  healthAttempts: 30,
  healthIntervalMs: 25,
  onDurabilityBoundary(boundary) {
    if (boundary === "deployment_state_pending") process.exit(91);
  },
});
await adapter.deploy(payload.request);
throw new Error("V3_DEPLOY_STATE_CRASH_BOUNDARY_NOT_REACHED");
