import path from "node:path";
import { fileURLToPath } from "node:url";

type CommandV2 = "prepare-current-entry-v2" | "resume-current-entry-v2";

function parseCommand(argv: readonly string[]): CommandV2 {
  if (argv.length !== 2 || argv[1] !== "--json" || (argv[0] !== "prepare-current-entry-v2" && argv[0] !== "resume-current-entry-v2")) {
    throw new Error("TASK6A_V2_CURRENT_ENTRY_CLI_USAGE_INVALID");
  }
  return argv[0];
}

async function main(argv: readonly string[]): Promise<void> {
  parseCommand(argv);
  try {
    const controller = await import("./baseline-task6a-current-entry-controller-v2.js");
    await controller.requestTask6aCurrentEntryAdmissionV2();
  } catch {
    throw new Error("TASK6A_V2_ADMISSION_NOT_GRANTED");
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url) || path.basename(invokedPath) === "baseline-task6a-current-entry-cli-v2.ts") {
  void main(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error && error.message === "TASK6A_V2_CURRENT_ENTRY_CLI_USAGE_INVALID"
      ? "TASK6A_V2_CURRENT_ENTRY_CLI_USAGE_INVALID" : "TASK6A_V2_ADMISSION_NOT_GRANTED";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
