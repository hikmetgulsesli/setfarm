import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import { canonicalJsonBytes } from "./canonical-json.js";
import {
  inventoryVerifiedNodeToolchainDistributionArchiveV2,
} from "./node-toolchain-archive-inventory-v2.js";
import {
  disposeVerifiedNodeToolchainDistributionArchiveV2,
  verifyNodeToolchainDistributionArchiveV2,
} from "./node-toolchain-distribution-authority-v2.js";
import {
  disposeMaterializedNodeToolchainPrivateTreeV2,
  materializeInventoriedNodeToolchainPrivateTreeV2,
  type MaterializedNodeToolchainPrivateTreeV2,
} from "./node-toolchain-private-tree-v2.js";
import {
  applyProductionNodeToolchainProvisionerPlanV2,
  inspectNodeToolchainProvisionerInspectionV2,
  inspectProductionNodeToolchainProvisionerV2,
  planNodeToolchainProvisioningV2,
  planNodeToolchainRollbackV2,
  rollbackProductionNodeToolchainProvisionerPlanV2,
  verifyProductionNodeToolchainProvisionerV2,
  type InspectedNodeToolchainProvisionerStateV2,
} from "./node-toolchain-provisioner-command-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_CLI_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_CLI_FAILURE_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_CLI_VERSION_V2,
  NodeToolchainProvisionerCliFailureV2Schema,
  hashNodeToolchainProvisionerCliFailureV2,
  type NodeToolchainProvisionerCliCommandRefV2,
  type NodeToolchainProvisionerCliFailureHashPayloadV2,
  type NodeToolchainProvisionerCliFailureKindV2,
  type NodeToolchainProvisionerCliFailureV2,
} from "./schemas/node-toolchain-provisioner-cli-v2.js";
import {
  NodeToolchainProvisionerInspectionV2Schema,
  NodeToolchainProvisionerOperationReceiptV2Schema,
  NodeToolchainProvisionerPlanV2Schema,
  type NodeToolchainProvisionerInspectionV2,
  type NodeToolchainProvisionerOperationReceiptV2,
  type NodeToolchainProvisionerPlanV2,
} from "./schemas/node-toolchain-provisioner-command-v2.js";

const PLAN_FILE_MAX_BYTES_V2 = 16 * 1024 * 1024;
const CLI_USAGE_ERROR_CODE_V2 = "NODE_TOOLCHAIN_PROVISIONER_CLI_V2_USAGE_INVALID";
const CLI_PLAN_FILE_ERROR_CODE_V2 = "NODE_TOOLCHAIN_PROVISIONER_CLI_V2_PLAN_FILE_INVALID";
const CLI_OUTPUT_ERROR_CODE_V2 = "NODE_TOOLCHAIN_PROVISIONER_CLI_V2_OUTPUT_INVALID";
const CLI_INTERNAL_ERROR_CODE_V2 = "NODE_TOOLCHAIN_PROVISIONER_CLI_V2_INTERNAL_FAILURE";
const ERROR_CODE_PATTERN_V2 = /^[A-Z][A-Z0-9_]{2,159}$/;

type ParsedCommandV2 =
  | Readonly<{ commandRef: "inspect" }>
  | Readonly<{ commandRef: "plan_apply"; archivePath: string }>
  | Readonly<{ commandRef: "plan_rollback" }>
  | Readonly<{ commandRef: "apply"; planPath: string; archivePath: string }>
  | Readonly<{ commandRef: "verify" }>
  | Readonly<{ commandRef: "rollback"; planPath: string }>;

export type NodeToolchainProvisionerCliOperationsV2 = Readonly<{
  inspect: () => Promise<InspectedNodeToolchainProvisionerStateV2>;
  inspectArtifact: (
    handle: InspectedNodeToolchainProvisionerStateV2,
  ) => NodeToolchainProvisionerInspectionV2;
  withPrivateTree: <T>(
    archivePath: string,
    use: (tree: MaterializedNodeToolchainPrivateTreeV2) => Promise<T> | T,
  ) => Promise<T>;
  planApply: (
    inspection: InspectedNodeToolchainProvisionerStateV2,
    tree: MaterializedNodeToolchainPrivateTreeV2,
  ) => NodeToolchainProvisionerPlanV2;
  planRollback: (
    inspection: InspectedNodeToolchainProvisionerStateV2,
  ) => NodeToolchainProvisionerPlanV2;
  apply: (
    plan: NodeToolchainProvisionerPlanV2,
    tree: MaterializedNodeToolchainPrivateTreeV2,
  ) => Promise<NodeToolchainProvisionerOperationReceiptV2>;
  verify: () => Promise<NodeToolchainProvisionerOperationReceiptV2>;
  rollback: (
    plan: NodeToolchainProvisionerPlanV2,
  ) => Promise<NodeToolchainProvisionerOperationReceiptV2>;
}>;

export type NodeToolchainProvisionerCliIoV2 = Readonly<{
  writeStdout: (bytes: Buffer) => void;
  writeStderr: (text: string) => void;
}>;

class NodeToolchainProvisionerCliErrorV2 extends Error {
  readonly code: string;
  readonly failureKind: NodeToolchainProvisionerCliFailureKindV2;
  override readonly cause?: unknown;

  constructor(
    code: string,
    failureKind: NodeToolchainProvisionerCliFailureKindV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_000), options);
    this.name = "NodeToolchainProvisionerCliErrorV2";
    this.code = code;
    this.failureKind = failureKind;
    this.cause = options?.cause;
  }
}

function fail(
  code: string,
  failureKind: NodeToolchainProvisionerCliFailureKindV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeToolchainProvisionerCliErrorV2(
    code,
    failureKind,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function deepFreezeJson<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) pending.push(child);
    }
    Object.freeze(current);
  }
  return value;
}

function normalizedAbsolutePath(value: string, label: string): string {
  if (
    value.length < 1
    || value.length > 4_096
    || value.includes("\0")
    || !path.isAbsolute(value)
    || path.normalize(value) !== value
  ) {
    return fail(
      CLI_USAGE_ERROR_CODE_V2,
      "invocation_rejected",
      `${label} must be one normalized absolute path`,
    );
  }
  return value;
}

function validArgv(input: unknown): input is string[] {
  if (
    !Array.isArray(input)
    || isProxy(input)
    || Object.getPrototypeOf(input) !== Array.prototype
    || input.length < 1
    || input.length > 5
  ) return false;
  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== input.length + 1
    || keys[keys.length - 1] !== "length"
    || keys.slice(0, -1).some((key, index) => key !== String(index))
  ) return false;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  for (let index = 0; index < input.length; index += 1) {
    const descriptor = descriptors[String(index)];
    const value = descriptor && "value" in descriptor ? descriptor.value : undefined;
    if (
      !descriptor
      || descriptor.get !== undefined
      || descriptor.set !== undefined
      || typeof value !== "string"
      || value.length > 4_096
      || value.includes("\0")
    ) return false;
  }
  return true;
}

function parseCommand(input: unknown): ParsedCommandV2 {
  if (!validArgv(input)) {
    return fail(
      CLI_USAGE_ERROR_CODE_V2,
      "invocation_rejected",
      "Provisioner CLI requires one exact bounded argv shape",
    );
  }
  if (input.length === 1 && input[0] === "inspect") return Object.freeze({ commandRef: "inspect" });
  if (input.length === 1 && input[0] === "verify") return Object.freeze({ commandRef: "verify" });
  if (input.length === 2 && input[0] === "plan" && input[1] === "rollback") {
    return Object.freeze({ commandRef: "plan_rollback" });
  }
  if (
    input.length === 4
    && input[0] === "plan"
    && input[1] === "apply"
    && input[2] === "--archive"
  ) {
    return Object.freeze({
      commandRef: "plan_apply",
      archivePath: normalizedAbsolutePath(input[3]!, "Archive candidate"),
    });
  }
  if (
    input.length === 5
    && input[0] === "apply"
    && input[1] === "--plan-file"
    && input[3] === "--archive"
  ) {
    return Object.freeze({
      commandRef: "apply",
      planPath: normalizedAbsolutePath(input[2]!, "Plan file"),
      archivePath: normalizedAbsolutePath(input[4]!, "Archive candidate"),
    });
  }
  if (
    input.length === 3
    && input[0] === "rollback"
    && input[1] === "--plan-file"
  ) {
    return Object.freeze({
      commandRef: "rollback",
      planPath: normalizedAbsolutePath(input[2]!, "Plan file"),
    });
  }
  return fail(
    CLI_USAGE_ERROR_CODE_V2,
    "invocation_rejected",
    "Provisioner CLI command or option order is invalid",
  );
}

function inferredCommandRef(input: unknown): NodeToolchainProvisionerCliCommandRefV2 {
  if (!validArgv(input)) return "invalid_invocation";
  try {
    if (input[0] === "inspect") return "inspect";
    if (input[0] === "verify") return "verify";
    if (input[0] === "apply") return "apply";
    if (input[0] === "rollback") return "rollback";
    if (input[0] === "plan" && input[1] === "apply") return "plan_apply";
    if (input[0] === "plan" && input[1] === "rollback") return "plan_rollback";
  } catch {
    return "invalid_invocation";
  }
  return "invalid_invocation";
}

function sameFileIdentity(left: ReturnType<typeof fstatSync>, right: ReturnType<typeof fstatSync>): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.uid === right.uid
    && left.gid === right.gid
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

export function readNodeToolchainProvisionerPlanFileV2(planPath: string): NodeToolchainProvisionerPlanV2 {
  const absolutePath = normalizedAbsolutePath(planPath, "Plan file");
  let descriptor: number | undefined;
  let bytes: Buffer | undefined;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (
      !before.isFile()
      || before.nlink !== 1
      || before.size < 1
      || before.size > PLAN_FILE_MAX_BYTES_V2
    ) {
      return fail(
        CLI_PLAN_FILE_ERROR_CODE_V2,
        "invocation_rejected",
        "Plan input must be one bounded unaliased regular file",
      );
    }
    bytes = Buffer.allocUnsafeSlow(before.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, null);
      if (count < 1) {
        return fail(
          CLI_PLAN_FILE_ERROR_CODE_V2,
          "invocation_rejected",
          "Plan input ended before its inspected byte length",
        );
      }
      offset += count;
    }
    const eof = Buffer.allocUnsafe(1);
    if (readSync(descriptor, eof, 0, 1, null) !== 0) {
      return fail(
        CLI_PLAN_FILE_ERROR_CODE_V2,
        "invocation_rejected",
        "Plan input exceeded its inspected byte length",
      );
    }
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(absolutePath);
    if (!sameFileIdentity(before, after) || !sameFileIdentity(after, pathAfter)) {
      return fail(
        CLI_PLAN_FILE_ERROR_CODE_V2,
        "invocation_rejected",
        "Plan input changed during its bounded read",
      );
    }
    let raw: unknown;
    try {
      raw = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      return fail(
        CLI_PLAN_FILE_ERROR_CODE_V2,
        "invocation_rejected",
        "Plan input is not JSON",
        error,
      );
    }
    const parsed = NodeToolchainProvisionerPlanV2Schema.safeParse(raw);
    if (!parsed.success || !bytes.equals(canonicalJsonBytes(parsed.success ? parsed.data : raw))) {
      return fail(
        CLI_PLAN_FILE_ERROR_CODE_V2,
        "invocation_rejected",
        "Plan input is not one exact canonical provisioner plan",
        parsed.success ? undefined : parsed.error,
      );
    }
    return deepFreezeJson(parsed.data);
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerCliErrorV2) throw error;
    return fail(
      CLI_PLAN_FILE_ERROR_CODE_V2,
      "invocation_rejected",
      "Plan input could not be read safely",
      error,
    );
  } finally {
    bytes?.fill(0);
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // The primary read result owns the command outcome.
      }
    }
  }
}

function errorCode(error: unknown): string | undefined {
  try {
    if (
      error instanceof Error
      && "code" in error
      && typeof error.code === "string"
      && ERROR_CODE_PATTERN_V2.test(error.code)
    ) return error.code;
  } catch {
    return undefined;
  }
  return undefined;
}

function causeCodes(error: unknown): readonly string[] {
  const output: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current instanceof Error && !seen.has(current) && output.length < 8) {
    seen.add(current);
    const code = errorCode(current);
    if (code && !output.includes(code)) output.push(code);
    try {
      current = "cause" in current ? current.cause : undefined;
    } catch {
      break;
    }
  }
  if (output.length === 0) output.push(CLI_INTERNAL_ERROR_CODE_V2);
  return Object.freeze(output);
}

function buildFailure(
  commandRef: NodeToolchainProvisionerCliCommandRefV2,
  error: unknown,
): NodeToolchainProvisionerCliFailureV2 {
  const codes = causeCodes(error);
  const failureKind: NodeToolchainProvisionerCliFailureKindV2 =
    error instanceof NodeToolchainProvisionerCliErrorV2
      ? error.failureKind
      : codes[0] === CLI_INTERNAL_ERROR_CODE_V2
        ? "internal_failure"
        : "command_rejected";
  const identity: NodeToolchainProvisionerCliFailureHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_CLI_FAILURE_V2_SCHEMA,
    failureVersion: NODE_TOOLCHAIN_PROVISIONER_CLI_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_CLI_AUTHORITY_REF_V2,
    commandRef,
    failureKind,
    errorCode: codes[0]!,
    causeCodes: [...codes],
    exitCode: failureKind === "invocation_rejected" ? 64 : failureKind === "command_rejected" ? 1 : 70,
  };
  return NodeToolchainProvisionerCliFailureV2Schema.parse({
    ...identity,
    failureHash: hashNodeToolchainProvisionerCliFailureV2(identity),
  });
}

function diagnostic(error: unknown): string {
  try {
    if (error instanceof Error) return `${errorCode(error) ?? CLI_INTERNAL_ERROR_CODE_V2}: ${error.message}`
      .replace(/[\r\n]+/g, " ")
      .slice(0, 1_200) + "\n";
  } catch {
    // Fall through to a non-authoritative bounded diagnostic.
  }
  return `${CLI_INTERNAL_ERROR_CODE_V2}: command failed\n`;
}

function outputArtifact(
  command: ParsedCommandV2,
  value: unknown,
): Buffer {
  const schema = command.commandRef === "inspect"
    ? NodeToolchainProvisionerInspectionV2Schema
    : command.commandRef === "plan_apply" || command.commandRef === "plan_rollback"
      ? NodeToolchainProvisionerPlanV2Schema
      : NodeToolchainProvisionerOperationReceiptV2Schema;
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return fail(
      CLI_OUTPUT_ERROR_CODE_V2,
      "internal_failure",
      "Provisioner command returned an artifact outside its exact output schema",
      parsed.error,
    );
  }
  return canonicalJsonBytes(parsed.data);
}

export async function runNodeToolchainProvisionerCliV2(
  argv: unknown,
  operations: NodeToolchainProvisionerCliOperationsV2,
  io: NodeToolchainProvisionerCliIoV2,
): Promise<number> {
  let commandRef = inferredCommandRef(argv);
  try {
    const command = parseCommand(argv);
    commandRef = command.commandRef;
    let result: unknown;
    if (command.commandRef === "inspect") {
      result = operations.inspectArtifact(await operations.inspect());
    } else if (command.commandRef === "plan_apply") {
      result = await operations.withPrivateTree(command.archivePath, async (tree) =>
        operations.planApply(await operations.inspect(), tree));
    } else if (command.commandRef === "plan_rollback") {
      result = operations.planRollback(await operations.inspect());
    } else if (command.commandRef === "apply") {
      const plan = readNodeToolchainProvisionerPlanFileV2(command.planPath);
      result = await operations.withPrivateTree(command.archivePath, (tree) => operations.apply(plan, tree));
    } else if (command.commandRef === "verify") {
      result = await operations.verify();
    } else {
      result = await operations.rollback(readNodeToolchainProvisionerPlanFileV2(command.planPath));
    }
    io.writeStdout(outputArtifact(command, result));
    return 0;
  } catch (error) {
    const failure = buildFailure(commandRef, error);
    io.writeStdout(canonicalJsonBytes(failure));
    io.writeStderr(diagnostic(error));
    return failure.exitCode;
  }
}

async function withProductionPrivateTree<T>(
  archivePath: string,
  use: (tree: MaterializedNodeToolchainPrivateTreeV2) => Promise<T> | T,
): Promise<T> {
  if (process.arch !== "arm64" && process.arch !== "x64") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_V2_PLATFORM_UNSUPPORTED",
      "command_rejected",
      "Production toolchain source supports arm64 or x64 only",
    );
  }
  const archive = await verifyNodeToolchainDistributionArchiveV2({
    architecture: process.arch,
    archivePath,
  });
  let tree: MaterializedNodeToolchainPrivateTreeV2 | undefined;
  try {
    const inventory = await inventoryVerifiedNodeToolchainDistributionArchiveV2(archive);
    tree = await materializeInventoriedNodeToolchainPrivateTreeV2(inventory);
    return await use(tree);
  } finally {
    try {
      if (tree) await disposeMaterializedNodeToolchainPrivateTreeV2(tree);
    } finally {
      await disposeVerifiedNodeToolchainDistributionArchiveV2(archive);
    }
  }
}

/**
 * Production operation binding only. It is intentionally not wired to the main
 * Setfarm CLI; a later root-owned bootstrap package must own process startup.
 */
export function createProductionNodeToolchainProvisionerCliOperationsV2():
NodeToolchainProvisionerCliOperationsV2 {
  return Object.freeze({
    inspect: inspectProductionNodeToolchainProvisionerV2,
    inspectArtifact: inspectNodeToolchainProvisionerInspectionV2,
    withPrivateTree: withProductionPrivateTree,
    planApply: planNodeToolchainProvisioningV2,
    planRollback: planNodeToolchainRollbackV2,
    apply: applyProductionNodeToolchainProvisionerPlanV2,
    verify: verifyProductionNodeToolchainProvisionerV2,
    rollback: rollbackProductionNodeToolchainProvisionerPlanV2,
  });
}
