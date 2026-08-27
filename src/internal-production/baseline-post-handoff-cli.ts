import path from "node:path";
import { fileURLToPath } from "node:url";

type CommandV1 =
  | "prepare-current-entry"
  | "resume-current-entry"
  | "current-entry-status"
  | "verify-current-entry"
  | "prepare-recovery-source-bootstrap"
  | "resume-recovery-source-bootstrap"
  | "recovery-source-bootstrap-status"
  | "observe-product-build-authority-v2-delivery-evidence"
  | "audit-authority-v3-migration31"
  | "inspect-pending-bootstrap-handoff-successor"
  | "service-census";

const COMMANDS = new Set<CommandV1>([
  "prepare-current-entry",
  "resume-current-entry",
  "current-entry-status",
  "verify-current-entry",
  "prepare-recovery-source-bootstrap",
  "resume-recovery-source-bootstrap",
  "recovery-source-bootstrap-status",
  "observe-product-build-authority-v2-delivery-evidence",
  "audit-authority-v3-migration31",
  "inspect-pending-bootstrap-handoff-successor",
  "service-census",
]);

function parseCommand(argv: readonly string[]): CommandV1 {
  if (argv.length !== 2 || argv[1] !== "--json" || !COMMANDS.has(argv[0] as CommandV1)) {
    throw new Error("INTERNAL_PRODUCTION_BASELINE_POST_HANDOFF_CLI_USAGE_INVALID");
  }
  return argv[0] as CommandV1;
}

async function run(command: CommandV1): Promise<unknown> {
  if (command === "observe-product-build-authority-v2-delivery-evidence") {
    const observer = await import("./product-build-authority-v2-delivery-evidence-v1.js");
    const observation = await observer.observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1();
    return Object.freeze({ ...observation.response, observationTransport: observation.observationTransport });
  }
  const controller = await import("./baseline-post-handoff-receipt-v1.js");
  if (command === "prepare-current-entry") {
    const operation = await controller.prepareInternalProductionCurrentEntryOperationV1();
    return Object.freeze({ operationRef: operation.operationRef, operationHash: operation.operationHash });
  }
  if (command === "resume-current-entry") return controller.resumeInternalProductionCurrentEntryAuthorityV1();
  if (command === "current-entry-status") return controller.observeInternalProductionCurrentEntryAuthorityStatusV1();
  if (command === "prepare-recovery-source-bootstrap") return controller.prepareInternalProductionRecoverySourceBootstrapRunV1();
  if (command === "resume-recovery-source-bootstrap") return controller.resumeActiveInternalProductionRecoverySourceBootstrapRunV1();
  if (command === "recovery-source-bootstrap-status") return controller.observeInternalProductionRecoverySourceBootstrapStatusV1();
  if (command === "audit-authority-v3-migration31") return controller.observeCurrentInternalProductionAuthorityV3Migration31AuditV1();
  if (command === "inspect-pending-bootstrap-handoff-successor") return controller.observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1();
  if (command === "service-census") return controller.observeInternalProductionServiceCensusV1();
  return controller.verifyCurrentInternalProductionCurrentEntryV1();
}

async function main(argv: readonly string[]): Promise<void> {
  const result = await run(parseCommand(argv));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url) || path.basename(invokedPath) === "baseline-post-handoff-cli.ts") {
  void main(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "INTERNAL_PRODUCTION_BASELINE_POST_HANDOFF_CLI_FAILED";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
