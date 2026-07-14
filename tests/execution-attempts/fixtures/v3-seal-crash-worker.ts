import { readFile } from "node:fs/promises";

import {
  materializeV3SealedRuntime,
  type V3SealDurabilityBoundary,
} from "../../../src/execution/v3-sealed-runtime.js";

type SerializableInput = Omit<
  Parameters<typeof materializeV3SealedRuntime>[0],
  "onDurabilityBoundary"
>;

const inputPath = process.argv[2];
const requestedBoundary = process.argv[3] as V3SealDurabilityBoundary | undefined;
if (!inputPath || !requestedBoundary) throw new Error("V3_SEAL_CRASH_WORKER_INPUT_MISSING");

const input = JSON.parse(await readFile(inputPath, "utf8")) as SerializableInput;
await materializeV3SealedRuntime({
  ...input,
  onDurabilityBoundary(boundary) {
    if (boundary === requestedBoundary) process.exit(90);
  },
});
throw new Error(`V3_SEAL_CRASH_BOUNDARY_NOT_REACHED:${requestedBoundary}`);
