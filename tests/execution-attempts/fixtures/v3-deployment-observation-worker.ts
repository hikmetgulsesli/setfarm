import { readFile } from "node:fs/promises";

import { observeLocalV3Deployment } from "../../../src/execution/v3-deploy-executor.js";
import { V3DeployReceiptV1Schema } from "../../../src/execution/schemas/v3-deploy-receipt-v1.js";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("V3_DEPLOY_OBSERVATION_WORKER_INPUT_MISSING");
const payload = JSON.parse(await readFile(inputPath, "utf8")) as { stateRoot: string; receipt: unknown };
const observation = await observeLocalV3Deployment({
  stateRoot: payload.stateRoot,
  receipt: V3DeployReceiptV1Schema.parse(payload.receipt),
});
process.stdout.write(`${JSON.stringify(observation)}\n`);
