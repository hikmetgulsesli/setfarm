#!/usr/bin/env node
import { runOrchestrator, orchestrateOnce } from "./orchestrator.js";

const args = process.argv.slice(2);

const pollInterval = parseInt(process.env.ANTFARM_POLL_INTERVAL ?? "15000", 10);
const verbose = args.includes("--verbose") || args.includes("-v");
const once = args.includes("--once");

const config = {
  pollIntervalMs: pollInterval,
  verbose,
};

if (once) {
  orchestrateOnce(config)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  runOrchestrator(config).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
