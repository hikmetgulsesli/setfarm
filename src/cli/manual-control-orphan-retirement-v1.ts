import { observeSelectedManualOrphanBootstrapV1 } from "../installation/fresh-installation-manual-control-maintenance-v1.js";

const codes = new Set(["BOOTSTRAP_CONTEXT_REFUSED", "BOOTSTRAP_M_REFUSED", "BOOTSTRAP_TARGET_REFUSED",
  "BOOTSTRAP_DEPENDENCY_REFUSED", "BOOTSTRAP_ENTRY_REFUSED", "BOOTSTRAP_CLEANUP_UNKNOWN"]);

// This is a compiled command entry, never a general retirement/effect lane.
try {
  if (process.argv.length !== 3 || process.argv[2] !== "observe-bootstrap") throw new Error("BOOTSTRAP_CONTEXT_REFUSED");
  const observation = await observeSelectedManualOrphanBootstrapV1();
  process.stdout.write(`${JSON.stringify(observation)}\n`);
} catch (error) {
  const code = error instanceof Error && codes.has(error.message) ? error.message : "BOOTSTRAP_CONTEXT_REFUSED";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}
