import { spawn } from "node:child_process";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  fstatSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readSync,
  renameSync,
  rmSync,
  symlinkSync,
  type BigIntStats,
  writeSync,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_TRUST_CONFIGURATION_V2,
} from "./schemas/platform-release-bootstrap-darwin-native-distribution-v2.js";
import {
  PlatformReleaseManifestV1Schema,
} from "./schemas/platform-release-manifest-v1.js";
import {
  PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2,
  PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2,
  PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_V2_SCHEMA,
  parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2,
  type PlatformReleaseProductionAdmissionReadinessV2,
} from "./schemas/platform-release-production-admission-readiness-v2.js";

const POLICY_HASH_SCHEMA_V2 =
  "setfarm.platform-release-production-admission-readiness-policy-hash.v2" as const;
const READINESS_HASH_SCHEMA_V2 =
  "setfarm.platform-release-production-admission-readiness-hash.v2" as const;
const PATH_OBSERVATION_HASH_SCHEMA_V2 =
  "setfarm.platform-release-production-admission-readiness-fixed-path-observation-hash.v2" as const;
const COMMAND_OBSERVATION_HASH_SCHEMA_V2 =
  "setfarm.platform-release-production-admission-readiness-command-observation-hash.v2" as const;
const BUILD_DOCUMENT_MAX_BYTES_V2 = 64 * 1024;
const PROCESS_SETTLEMENT_WATCHDOG_MILLISECONDS_V2 = 1_000;
const PROCESS_GROUP_DEATH_ATTEMPTS_V2 = 100;
const PROCESS_GROUP_DEATH_INTERVAL_MILLISECONDS_V2 = 5;
const REPOSITORY_ROOT_V2 = path.resolve(import.meta.dirname, "../..");

const fixedEnvironment = Object.freeze({
  ...PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.environment,
});

type ReadinessCommandPolicyV2 = typeof PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2
  .commandPlan[number];
type ExecutedReadinessCommandPolicyV2 = Extract<
  ReadinessCommandPolicyV2,
  { execution: "subprocess" }
>;
type FixedPathReadinessCommandPolicyV2 = Extract<
  ReadinessCommandPolicyV2,
  { execution: "fixed_path" }
>;
type ReadinessFixedPathPolicyV2 = typeof PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2
  .fixedPathPlan[number];
type ReadinessFixedPathRoleV2 = ReadinessFixedPathPolicyV2["role"];

const executedCommandPlanV2 = Object.freeze(
  PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.commandPlan.filter(
    (command): command is ExecutedReadinessCommandPolicyV2 =>
      command.execution === "subprocess",
  ),
);
const fixedPathCommandPlanV2 = Object.freeze(
  PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.commandPlan.filter(
    (command): command is FixedPathReadinessCommandPolicyV2 =>
      command.execution === "fixed_path",
  ),
);

function fixedPathPolicyForRefV2<Ref extends ReadinessFixedPathPolicyV2["ref"]>(
  ref: Ref,
): Extract<ReadinessFixedPathPolicyV2, { ref: Ref }> {
  const entry = PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2
    .fixedPathPlan.find((candidate) => candidate.ref === ref);
  if (entry === undefined) throw new TypeError("Fixed path policy reference is missing");
  return entry as Extract<ReadinessFixedPathPolicyV2, { ref: Ref }>;
}

function fixedPathPolicyForRoleV2<Role extends ReadinessFixedPathRoleV2>(
  role: Role,
): Extract<ReadinessFixedPathPolicyV2, { role: Role }> {
  const entry = PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2
    .fixedPathPlan.find((candidate) => candidate.role === role);
  if (entry === undefined) throw new TypeError("Fixed path policy role is missing");
  return entry as Extract<ReadinessFixedPathPolicyV2, { role: Role }>;
}

function resolveFixedPathPolicyTargetV2(
  entry: ReadinessFixedPathPolicyV2,
): string {
  return entry.target.kind === "absolute"
    ? entry.target.value
    : path.resolve(REPOSITORY_ROOT_V2, entry.target.value);
}

const finiteFaultsV2 = Object.freeze([
  "application_identity_spawn_failure",
  "installer_identity_timeout",
  "gatekeeper_output_overflow",
  "sip_malformed_output",
  "authenticated_root_spawn_failure",
  "amfi_malformed_output",
  "notarytool_unavailable",
  "notary_profile_probe_failure",
  "fixed_path_symlink",
  "fixed_path_replacement",
  "build_manifest_invalid",
  "escaped_writer_settlement_watchdog",
  "escaped_writer_output_limit_watchdog",
  "fixed_path_leaf_created_after_absence",
  "amfi_running_near_miss",
  "amfi_duplicate_keys",
  "amfi_nonzero_exact_output",
  "fixed_path_hardlink",
  "fixed_path_unsafe_mode",
] as const);

export type PlatformReleaseReadinessTestFaultV2 = typeof finiteFaultsV2[number];

export type PlatformReleaseReadinessTestModeV2 = Readonly<{
  platform: "darwin" | "unsupported";
  faults: readonly PlatformReleaseReadinessTestFaultV2[];
}>;

type ProductionModeV2 = Readonly<{ purpose: "production" }>;
type InternalModeV2 = ProductionModeV2 | PlatformReleaseReadinessTestModeV2;
type BlockerCodeV2 = typeof PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2[number];

type TerminalStatusV2 =
  | "completed"
  | "spawn_failed"
  | "timed_out"
  | "output_limit_exceeded"
  | "observation_failed";

type TerminalCaptureV2 = Readonly<{
  status: TerminalStatusV2;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: Buffer;
}>;

type FixedPathStateV2 =
  | "absent"
  | "present_unjoined"
  | "unproven"
  | "observation_failed";

type FixedPathRefV2 =
  | "INSTALLED_SETFARM_ROOT"
  | "INSTALLED_SETFARM_APPLICATION"
  | "AUTHENTICATED_SETFARM_HELPER";

type FixedPathObservationV2 = Readonly<{
  ref: FixedPathRefV2;
  state: FixedPathStateV2;
  observationHash: string;
}>;

type CommandResultV2 =
  | Readonly<{
      kind: "identity_count";
      identityClass: "developer_id_application" | "developer_id_installer";
      validIdentityCount: number | null;
      state:
        | "not_observed_in_active_search_list"
        | "present_unjoined"
        | "observation_failed";
    }>
  | Readonly<{
      kind: "tool_availability";
      tool: "codesign" | "notarytool" | "pkgutil" | "security" | "spctl" | "stapler";
      state: "available" | "unavailable" | "observation_failed";
    }>
  | Readonly<{
      kind: "gatekeeper";
      state: "enabled" | "disabled" | "observation_failed";
    }>
  | Readonly<{
      kind: "sip";
      state: "enabled" | "disabled" | "observation_failed";
    }>
  | Readonly<{
      kind: "authenticated_root";
      state: "enabled" | "disabled" | "unsupported" | "observation_failed";
    }>
  | Readonly<{
      kind: "amfi_service";
      state: "running" | "not_running" | "observation_failed";
    }>
  | Readonly<{
      kind: "notary_profile_metadata";
      serviceRef: "GKE_NOTARY_TOOL" | "APPLE_NOTARYTOOL" | "NOTARYTOOL";
      state: "not_observed" | "present_unjoined" | "observation_failed";
    }>;

type CommandObservationV2 = Readonly<{
  kind:
    | "developer_id_application_identity"
    | "developer_id_installer_identity"
    | "tool_availability"
    | "gatekeeper_status"
    | "sip_status"
    | "authenticated_root_status"
    | "amfi_service_status"
    | "notary_profile_metadata";
  executableRef:
    | "CODESIGN"
    | "CSRUTIL"
    | "LAUNCHCTL"
    | "NOTARYTOOL"
    | "PKGUTIL"
    | "SECURITY"
    | "SPCTL"
    | "STAPLER";
  argvRef:
    | "CODESIGN_AVAILABILITY"
    | "CSRUTIL_AUTHENTICATED_ROOT_STATUS"
    | "CSRUTIL_STATUS"
    | "LAUNCHCTL_PRINT_AMFI"
    | "NOTARYTOOL_AVAILABILITY"
    | "PKGUTIL_AVAILABILITY"
    | "SECURITY_AVAILABILITY"
    | "SECURITY_FIND_GENERIC_PASSWORD_GKE_NOTARY_TOOL"
    | "SECURITY_FIND_GENERIC_PASSWORD_NOTARYTOOL"
    | "SECURITY_FIND_GENERIC_PASSWORD_NOTARY_TOOL"
    | "SECURITY_FIND_IDENTITY_BASIC"
    | "SECURITY_FIND_IDENTITY_CODESIGNING"
    | "SPCTL_AVAILABILITY"
    | "SPCTL_STATUS"
    | "STAPLER_AVAILABILITY";
  status: TerminalStatusV2;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  projectionByteLength: number;
  result: CommandResultV2;
  observationHash: string;
}>;

type BuildProvenanceStateV2 =
  | "v1_build_provenance_only"
  | "missing"
  | "invalid"
  | "observation_failed";

const BuildInfoV2Schema = z.object({
  sha: z.string().regex(/^[a-f0-9]{40}$/u),
  shortSha: z.string().regex(/^[a-f0-9]{8}$/u),
  branch: z.literal("main"),
  dirty: z.literal(false),
  packageVersion: z.string().min(1).max(128).regex(/^[0-9A-Za-z.+-]+$/u),
  displayVersion: z.string().min(1).max(160).regex(/^[0-9A-Za-z.+-]+$/u),
  builtAt: z.string().datetime({ offset: false, precision: 3 }),
}).strict().superRefine((value, context) => {
  if (
    value.shortSha !== value.sha.slice(0, 8)
    || value.displayVersion !== `${value.packageVersion}+${value.shortSha}`
  ) {
    context.addIssue({
      code: "custom",
      message: "Build information must bind its exact clean-main release SHA",
    });
  }
});

function exactOwnDataObjectV2(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  if (
    typeof value !== "object"
    || value === null
    || isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) return false;
  const keys = (ownKeys as string[]).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...expectedKeys].sort())) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Object.values(descriptors).every(
    (descriptor) => "value" in descriptor && descriptor.enumerable,
  );
}

function validateInternalModeV2(mode: InternalModeV2): Readonly<{
  platform: "darwin" | "unsupported";
  faults: ReadonlySet<PlatformReleaseReadinessTestFaultV2>;
}> {
  const candidate: unknown = mode;
  if (exactOwnDataObjectV2(candidate, ["purpose"])) {
    if (Object.isFrozen(candidate) && candidate.purpose === "production") {
      return Object.freeze({
        platform: process.platform
          === PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.supportedPlatform
          ? "darwin"
          : "unsupported",
        faults: new Set<PlatformReleaseReadinessTestFaultV2>(),
      });
    }
    throw new TypeError("Platform release readiness production mode is invalid");
  }
  if (
    !exactOwnDataObjectV2(candidate, ["faults", "platform"])
  ) {
    throw new TypeError("Platform release readiness mode must be one exact frozen finite mode");
  }
  const finiteMode = candidate as unknown as PlatformReleaseReadinessTestModeV2;
  if (
    !Object.isFrozen(finiteMode)
    || (finiteMode.platform !== "darwin" && finiteMode.platform !== "unsupported")
    || !Array.isArray(finiteMode.faults)
    || isProxy(finiteMode.faults)
    || !Object.isFrozen(finiteMode.faults)
    || Object.getPrototypeOf(finiteMode.faults) !== Array.prototype
  ) {
    throw new TypeError("Platform release readiness mode must be one exact frozen finite mode");
  }
  const arrayKeys = Reflect.ownKeys(finiteMode.faults);
  const arrayDescriptors = Object.getOwnPropertyDescriptors(finiteMode.faults);
  if (
    arrayKeys.length !== finiteMode.faults.length + 1
    || arrayKeys[finiteMode.faults.length] !== "length"
    || arrayKeys.slice(0, -1).some((key, index) => {
      const descriptor = typeof key === "string" ? arrayDescriptors[key] : undefined;
      return key !== String(index)
        || descriptor === undefined
        || !("value" in descriptor)
        || !descriptor.enumerable;
    })
  ) {
    throw new TypeError("Platform release readiness fault list must be one dense frozen array");
  }
  const allowed = new Set<string>(finiteFaultsV2);
  if (finiteMode.faults.some((fault) => !allowed.has(fault))) {
    throw new TypeError("Platform release readiness fault is outside the exact finite set");
  }
  const faults = new Set(finiteMode.faults);
  if (faults.size !== finiteMode.faults.length) {
    throw new TypeError("Platform release readiness fault list contains a duplicate");
  }
  if (finiteMode.platform === "unsupported" && faults.size !== 0) {
    throw new TypeError("Platform release readiness faults are impossible on unsupported platforms");
  }
  return Object.freeze({ platform: finiteMode.platform, faults });
}

function isErrnoV2(error: unknown, code: string): boolean {
  return error instanceof Error
    && "code" in error
    && error.code === code;
}

function processGroupAliveV2(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    return !isErrnoV2(error, "ESRCH");
  }
}

async function waitForProcessGroupDeathV2(processGroupId: number): Promise<boolean> {
  for (let attempt = 0; attempt < PROCESS_GROUP_DEATH_ATTEMPTS_V2; attempt += 1) {
    if (!processGroupAliveV2(processGroupId)) return true;
    if (attempt + 1 < PROCESS_GROUP_DEATH_ATTEMPTS_V2) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, PROCESS_GROUP_DEATH_INTERVAL_MILLISECONDS_V2);
      });
    }
  }
  return !processGroupAliveV2(processGroupId);
}

const allowedSignalsV2 = new Set<NodeJS.Signals>([
  "SIGABRT",
  "SIGBUS",
  "SIGFPE",
  "SIGHUP",
  "SIGILL",
  "SIGINT",
  "SIGKILL",
  "SIGPIPE",
  "SIGQUIT",
  "SIGSEGV",
  "SIGTERM",
  "SIGTRAP",
]);

function normalizedSignalV2(signal: NodeJS.Signals | null): NodeJS.Signals | null {
  return signal !== null && allowedSignalsV2.has(signal) ? signal : null;
}

function terminalFaultForCommandV2(
  index: number,
  faults: ReadonlySet<PlatformReleaseReadinessTestFaultV2>,
): "spawn_failed" | "timed_out" | "output_limit_exceeded" | undefined {
  const argvRef = executedCommandPlanV2[index]!.argvRef;
  if (
    argvRef === "SECURITY_FIND_IDENTITY_CODESIGNING"
    && faults.has("application_identity_spawn_failure")
  ) {
    return "spawn_failed";
  }
  if (
    argvRef === "SECURITY_FIND_IDENTITY_BASIC"
    && faults.has("installer_identity_timeout")
  ) return "timed_out";
  if (argvRef === "SPCTL_STATUS" && faults.has("gatekeeper_output_overflow")) {
    return "output_limit_exceeded";
  }
  if (
    argvRef === "CSRUTIL_AUTHENTICATED_ROOT_STATUS"
    && faults.has("authenticated_root_spawn_failure")
  ) {
    return "spawn_failed";
  }
  return undefined;
}

async function runFixedCommandV2(
  index: number,
  faults: ReadonlySet<PlatformReleaseReadinessTestFaultV2>,
): Promise<TerminalCaptureV2> {
  const command = executedCommandPlanV2[index]!;
  const escapedWriterOutputLimitFixture =
    faults.has("escaped_writer_output_limit_watchdog")
    && command.argvRef === "LAUNCHCTL_PRINT_AMFI";
  const escapedWriterFixture = (
    faults.has("escaped_writer_settlement_watchdog")
    || escapedWriterOutputLimitFixture
  ) && command.argvRef === "LAUNCHCTL_PRINT_AMFI";
  const [executable, argv] = escapedWriterFixture
    ? [process.execPath, [
        "--input-type=module",
        "--eval",
        [
          'import { spawn } from "node:child_process";',
          "const writer = spawn(process.execPath, [",
          '  "--input-type=module",',
          '  "--eval",',
          "  'const timer = setInterval(() => process.stdout.write(\"x\"), 25); process.stdout.on(\"error\", () => process.exit(0)); setTimeout(() => { clearInterval(timer); process.exit(0); }, 15000);',",
          "], { detached: true, stdio: [\"ignore\", \"inherit\", \"inherit\"] });",
          "writer.unref();",
          escapedWriterOutputLimitFixture
            ? `process.stdout.write(Buffer.alloc(${PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.channelByteCap + 1}, 0x58));`
            : 'process.stdout.write("fixture-ready\\n");',
        ].join("\n"),
      ]] as const
    : [command.executable, command.argv] as const;
  const injectedFault = terminalFaultForCommandV2(index, faults);
  const child = spawn(executable, argv, {
    detached: true,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    env: fixedEnvironment,
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let stdoutByteLength = 0;
  let stderrByteLength = 0;
  let terminalStatus: TerminalStatusV2 | undefined;
  let settled = false;
  let terminationRequested = false;
  let executionTimer: NodeJS.Timeout | undefined;
  let settlementTimer: NodeJS.Timeout | undefined;
  let resourcesReleased = false;
  let resolveSettlement: ((value: Readonly<{
    kind: "close" | "watchdog";
    exitCode: number | null;
    signal: NodeJS.Signals | null;
  }>) => void) | undefined;

  const settlement = new Promise<Readonly<{
    kind: "close" | "watchdog";
    exitCode: number | null;
    signal: NodeJS.Signals | null;
  }>>((resolve) => {
    resolveSettlement = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    child.once("close", (exitCode, signal) => {
      resolveSettlement?.({ kind: "close", exitCode, signal });
    });
  });

  const releaseChildResourcesV2 = (): boolean => {
    child.stdout.removeAllListeners();
    child.stderr.removeAllListeners();
    child.removeAllListeners("close");
    child.removeAllListeners("error");
    child.stdout.destroy();
    child.stderr.destroy();
    child.unref();
    resourcesReleased = child.stdout.listenerCount("data") === 0
      && child.stdout.listenerCount("error") === 0
      && child.stderr.listenerCount("data") === 0
      && child.stderr.listenerCount("error") === 0
      && child.listenerCount("close") === 0
      && child.listenerCount("error") === 0
      && child.stdout.destroyed
      && child.stderr.destroyed;
    return resourcesReleased;
  };

  const directChildKillV2 = (): void => {
    try {
      child.kill("SIGKILL");
    } catch (error) {
      if (!isErrnoV2(error, "ESRCH") && terminalStatus === undefined) {
        terminalStatus = "observation_failed";
      }
    }
  };
  const requestTerminationV2 = (): void => {
    if (terminationRequested) return;
    terminationRequested = true;
    if (
      child.pid !== undefined
      && Number.isSafeInteger(child.pid)
      && child.pid > 0
    ) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (!isErrnoV2(error, "ESRCH") && terminalStatus === undefined) {
          terminalStatus = "observation_failed";
        }
      }
    }
    directChildKillV2();
    settlementTimer = setTimeout(() => {
      if (terminalStatus === undefined) terminalStatus = "observation_failed";
      directChildKillV2();
      if (!releaseChildResourcesV2() && terminalStatus === undefined) {
        terminalStatus = "observation_failed";
      }
      resolveSettlement?.({ kind: "watchdog", exitCode: null, signal: null });
    }, PROCESS_SETTLEMENT_WATCHDOG_MILLISECONDS_V2);
  };
  const latchTerminalStatusV2 = (status: TerminalStatusV2): void => {
    if (terminalStatus !== undefined) return;
    terminalStatus = status;
    requestTerminationV2();
  };
  const captureOutputV2 = (channel: "stdout" | "stderr", chunk: Buffer): void => {
    const owned = Buffer.from(chunk);
    chunk.fill(0);
    const current = channel === "stdout" ? stdoutByteLength : stderrByteLength;
    if (
      terminalStatus !== undefined
      || current + owned.byteLength
        > PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.channelByteCap
    ) {
      owned.fill(0);
      if (terminalStatus === undefined) latchTerminalStatusV2("output_limit_exceeded");
      return;
    }
    if (channel === "stdout") {
      stdoutChunks.push(owned);
      stdoutByteLength += owned.byteLength;
    } else {
      stderrChunks.push(owned);
      stderrByteLength += owned.byteLength;
    }
  };

  child.stdout.on("data", (chunk: Buffer) => captureOutputV2("stdout", chunk));
  child.stderr.on("data", (chunk: Buffer) => captureOutputV2("stderr", chunk));
  child.stdout.once("error", () => latchTerminalStatusV2("observation_failed"));
  child.stderr.once("error", () => latchTerminalStatusV2("observation_failed"));
  child.once("error", () => latchTerminalStatusV2("spawn_failed"));

  executionTimer = setTimeout(() => {
    latchTerminalStatusV2("timed_out");
  }, PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.commandTimeoutMs);
  if (injectedFault !== undefined) {
    queueMicrotask(() => {
      if (injectedFault === "output_limit_exceeded") {
        const overflow = Buffer.alloc(
          PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.channelByteCap + 1,
          0x58,
        );
        captureOutputV2("stdout", overflow);
        overflow.fill(0);
      } else {
        latchTerminalStatusV2(injectedFault);
      }
    });
  }

  let stdout = Buffer.alloc(0);
  let stderr = Buffer.alloc(0);
  let returned = false;
  try {
    const result = await settlement;
    if (executionTimer !== undefined) clearTimeout(executionTimer);
    if (settlementTimer !== undefined) clearTimeout(settlementTimer);
    let containmentProven = result.kind === "close";
    if (
      child.pid !== undefined
      && Number.isSafeInteger(child.pid)
      && child.pid > 0
      && processGroupAliveV2(child.pid)
    ) {
      if (terminalStatus === undefined) terminalStatus = "observation_failed";
      requestTerminationV2();
      if (!await waitForProcessGroupDeathV2(child.pid)) {
        containmentProven = false;
      }
    }
    if (!containmentProven || (result.kind === "watchdog" && !resourcesReleased)) {
      if (terminalStatus === undefined) terminalStatus = "observation_failed";
    }
    stdout = Buffer.concat(stdoutChunks, stdoutByteLength);
    stderr = Buffer.concat(stderrChunks, stderrByteLength);
    if (command.argvRef === "LAUNCHCTL_PRINT_AMFI") {
      const finiteAmfiOutput = faults.has("amfi_running_near_miss")
        ? "state = running-old\nprogram = /usr/libexec/amfid.backup\n"
        : faults.has("amfi_duplicate_keys")
          ? "state = running\nstate = running\nprogram = /usr/libexec/amfid\n"
          : faults.has("amfi_nonzero_exact_output")
            ? "state = running\nprogram = /usr/libexec/amfid\n"
            : undefined;
      if (finiteAmfiOutput !== undefined) {
        stdout.fill(0);
        stderr.fill(0);
        stdout = Buffer.from(finiteAmfiOutput, "ascii");
        stderr = Buffer.alloc(0);
      }
    }
    let status = terminalStatus;
    if (status === undefined) {
      status = result.signal === null && result.exitCode !== null
        ? "completed"
        : "observation_failed";
    }
    const signal = status === "spawn_failed"
      ? null
      : normalizedSignalV2(result.signal);
    const exitCode = status === "spawn_failed"
      ? null
      : command.argvRef === "CSRUTIL_STATUS" && faults.has("sip_malformed_output")
        ? 1
        : command.argvRef === "NOTARYTOOL_AVAILABILITY"
          && faults.has("notarytool_unavailable")
          ? 1
        : command.argvRef === "LAUNCHCTL_PRINT_AMFI"
          && faults.has("amfi_nonzero_exact_output")
          ? 1
        : result.exitCode;
    returned = true;
    return Object.freeze({ status, exitCode, signal, stdout, stderr });
  } finally {
    if (executionTimer !== undefined) clearTimeout(executionTimer);
    if (settlementTimer !== undefined) clearTimeout(settlementTimer);
    for (const chunk of stdoutChunks) chunk.fill(0);
    for (const chunk of stderrChunks) chunk.fill(0);
    if (!returned) {
      stdout.fill(0);
      stderr.fill(0);
    }
  }
}

function buffersEqualExactV2(bytes: Buffer, expected: string): boolean {
  const expectedBytes = Buffer.from(expected, "ascii");
  try {
    return bytes.byteLength === expectedBytes.byteLength && bytes.equals(expectedBytes);
  } finally {
    expectedBytes.fill(0);
  }
}

function combinedExactV2(
  capture: TerminalCaptureV2,
  stdoutExpected: string,
  stderrExpected: string,
): boolean {
  return capture.status === "completed"
    && capture.exitCode === 0
    && capture.signal === null
    && buffersEqualExactV2(capture.stdout, stdoutExpected)
    && buffersEqualExactV2(capture.stderr, stderrExpected);
}

function lineRangesV2(bytes: Buffer): Array<Readonly<{ start: number; end: number }>> {
  const output: Array<Readonly<{ start: number; end: number }>> = [];
  let start = 0;
  for (let index = 0; index <= bytes.byteLength; index += 1) {
    if (index === bytes.byteLength || bytes[index] === 0x0a) {
      let end = index;
      if (end > start && bytes[end - 1] === 0x0d) end -= 1;
      output.push(Object.freeze({ start, end }));
      start = index + 1;
    }
  }
  return output;
}

function isAsciiSpaceV2(value: number): boolean {
  return value === 0x20 || value === 0x09;
}

function isAsciiDigitV2(value: number): boolean {
  return value >= 0x30 && value <= 0x39;
}

function isAsciiHexV2(value: number): boolean {
  return isAsciiDigitV2(value)
    || (value >= 0x41 && value <= 0x46)
    || (value >= 0x61 && value <= 0x66);
}

function lineEqualsAsciiSuffixV2(
  bytes: Buffer,
  start: number,
  end: number,
  suffix: Buffer,
): boolean {
  if (end - start < suffix.byteLength) return false;
  const suffixStart = end - suffix.byteLength;
  for (let index = 0; index < suffix.byteLength; index += 1) {
    if (bytes[suffixStart + index] !== suffix[index]) return false;
  }
  return true;
}

function hasValidSecurityIdentityFooterV2(bytes: Buffer): boolean {
  const suffix = Buffer.from(" valid identities found", "ascii");
  try {
    const ranges = lineRangesV2(bytes);
    for (let rangeIndex = ranges.length - 1; rangeIndex >= 0; rangeIndex -= 1) {
      const range = ranges[rangeIndex]!;
      let start = range.start;
      let end = range.end;
      while (start < end && isAsciiSpaceV2(bytes[start]!)) start += 1;
      while (end > start && isAsciiSpaceV2(bytes[end - 1]!)) end -= 1;
      if (start === end) continue;
      if (!lineEqualsAsciiSuffixV2(bytes, start, end, suffix)) return false;
      const digitEnd = end - suffix.byteLength;
      if (digitEnd === start) return false;
      for (let index = start; index < digitEnd; index += 1) {
        if (!isAsciiDigitV2(bytes[index]!)) return false;
      }
      return true;
    }
    return false;
  } finally {
    suffix.fill(0);
  }
}

function lineHasExactIdentityMarkerV2(
  bytes: Buffer,
  start: number,
  end: number,
  marker: Buffer,
): boolean {
  let cursor = start;
  while (cursor < end && isAsciiSpaceV2(bytes[cursor]!)) cursor += 1;
  const ordinalStart = cursor;
  while (cursor < end && isAsciiDigitV2(bytes[cursor]!)) cursor += 1;
  if (cursor === ordinalStart || bytes[cursor] !== 0x29) return false;
  cursor += 1;
  while (cursor < end && isAsciiSpaceV2(bytes[cursor]!)) cursor += 1;
  const digestStart = cursor;
  while (cursor < end && isAsciiHexV2(bytes[cursor]!)) cursor += 1;
  if (cursor - digestStart !== 40) return false;
  while (cursor < end && isAsciiSpaceV2(bytes[cursor]!)) cursor += 1;
  if (bytes[cursor] !== 0x22) return false;
  cursor += 1;
  if (end - cursor < marker.byteLength) return false;
  for (let index = 0; index < marker.byteLength; index += 1) {
    if (bytes[cursor + index] !== marker[index]) return false;
  }
  return true;
}

function parseIdentityResultV2(
  capture: TerminalCaptureV2,
  identityClass: "developer_id_application" | "developer_id_installer",
): CommandResultV2 {
  if (
    capture.status !== "completed"
    || capture.exitCode !== 0
    || capture.signal !== null
    || capture.stderr.byteLength !== 0
    || !hasValidSecurityIdentityFooterV2(capture.stdout)
  ) {
    return Object.freeze({
      kind: "identity_count",
      identityClass,
      validIdentityCount: null,
      state: "observation_failed",
    });
  }
  const marker = Buffer.from(
    identityClass === "developer_id_application"
      ? "Developer ID Application:"
      : "Developer ID Installer:",
    "ascii",
  );
  let count = 0;
  try {
    for (const { start, end } of lineRangesV2(capture.stdout)) {
      if (lineHasExactIdentityMarkerV2(capture.stdout, start, end, marker)) {
        count += 1;
        if (
          count
          > PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2
            .maxIdentityCountPerClass
        ) {
          return Object.freeze({
            kind: "identity_count",
            identityClass,
            validIdentityCount: null,
            state: "observation_failed",
          });
        }
      }
    }
  } finally {
    marker.fill(0);
  }
  return count === 0
    ? Object.freeze({
        kind: "identity_count",
        identityClass,
        validIdentityCount: 0,
        state: "not_observed_in_active_search_list",
      })
    : Object.freeze({
        kind: "identity_count",
        identityClass,
        validIdentityCount: count,
        state: "present_unjoined",
      });
}

function bufferHasOneExactTrimmedLineV2(bytes: Buffer, expected: string): boolean {
  const expectedBytes = Buffer.from(expected, "ascii");
  let matches = 0;
  try {
    for (const range of lineRangesV2(bytes)) {
      let start = range.start;
      let end = range.end;
      while (start < end && isAsciiSpaceV2(bytes[start]!)) start += 1;
      while (end > start && isAsciiSpaceV2(bytes[end - 1]!)) end -= 1;
      if (end - start !== expectedBytes.byteLength) continue;
      let exact = true;
      for (let index = 0; index < expectedBytes.byteLength; index += 1) {
        if (bytes[start + index] !== expectedBytes[index]) {
          exact = false;
          break;
        }
      }
      if (exact) matches += 1;
    }
    return matches === 1;
  } finally {
    expectedBytes.fill(0);
  }
}

function sameStableIdentityV2(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.uid === right.uid
    && left.gid === right.gid
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs
    && left.isFile() === right.isFile()
    && left.isDirectory() === right.isDirectory()
    && left.isSymbolicLink() === right.isSymbolicLink();
}

type FixedAncestorIdentityV2 = Readonly<{
  device: bigint;
  inode: bigint;
  ownerUid: bigint;
  ownerGid: bigint;
  mode: bigint;
  kind: "directory" | "symbolic_link" | "special";
}>;

type FixedAncestorChainV2 =
  | Readonly<{
      state: "complete";
      entries: readonly FixedAncestorIdentityV2[];
    }>
  | Readonly<{
      state: "missing";
      entries: readonly FixedAncestorIdentityV2[];
      missingIndex: number;
    }>
  | Readonly<{
      state: "unproven";
      entries: readonly FixedAncestorIdentityV2[];
      unprovenIndex: number;
    }>
  | Readonly<{ state: "observation_failed" }>;

function fixedAncestorPathsV2(target: string): readonly string[] | undefined {
  if (
    !path.isAbsolute(target)
    || path.normalize(target) !== target
    || target === path.parse(target).root
  ) return undefined;
  const root = path.parse(target).root;
  const components = target.slice(root.length).split(path.sep).filter(Boolean);
  const ancestors = [root];
  let current = root;
  for (const component of components.slice(0, -1)) {
    current = path.join(current, component);
    ancestors.push(current);
  }
  return Object.freeze(ancestors);
}

function captureFixedAncestorChainV2(target: string): FixedAncestorChainV2 {
  const ancestors = fixedAncestorPathsV2(target);
  if (ancestors === undefined) return Object.freeze({ state: "observation_failed" });
  const entries: FixedAncestorIdentityV2[] = [];
  for (let index = 0; index < ancestors.length; index += 1) {
    let observed: BigIntStats;
    try {
      observed = lstatSync(ancestors[index]!, { bigint: true });
    } catch (error) {
      return isErrnoV2(error, "ENOENT")
        ? Object.freeze({
            state: "missing",
            entries: Object.freeze(entries),
            missingIndex: index,
          })
        : Object.freeze({ state: "observation_failed" });
    }
    const kind = observed.isDirectory()
      ? "directory"
      : observed.isSymbolicLink()
        ? "symbolic_link"
        : "special";
    entries.push(Object.freeze({
      device: observed.dev,
      inode: observed.ino,
      ownerUid: observed.uid,
      ownerGid: observed.gid,
      mode: observed.mode,
      kind,
    }));
    if (kind !== "directory") {
      return Object.freeze({
        state: "unproven",
        entries: Object.freeze(entries),
        unprovenIndex: index,
      });
    }
  }
  return Object.freeze({ state: "complete", entries: Object.freeze(entries) });
}

function sameFixedAncestorIdentityV2(
  left: FixedAncestorIdentityV2,
  right: FixedAncestorIdentityV2,
): boolean {
  return left.device === right.device
    && left.inode === right.inode
    && left.ownerUid === right.ownerUid
    && left.ownerGid === right.ownerGid
    && left.mode === right.mode
    && left.kind === right.kind;
}

function sameFixedAncestorChainV2(
  before: FixedAncestorChainV2,
  after: FixedAncestorChainV2,
): boolean {
  if (
    before.state === "observation_failed"
    || after.state === "observation_failed"
    || before.state !== after.state
    || before.entries.length !== after.entries.length
    || before.entries.some(
      (entry, index) => !sameFixedAncestorIdentityV2(entry, after.entries[index]!),
    )
  ) return false;
  if (before.state === "missing" && after.state === "missing") {
    return before.missingIndex === after.missingIndex;
  }
  if (before.state === "unproven" && after.state === "unproven") {
    return before.unprovenIndex === after.unprovenIndex;
  }
  return before.state === "complete" && after.state === "complete";
}

function fixedAncestorChainStableAfterV2(
  target: string,
  before: FixedAncestorChainV2,
): boolean {
  const after = captureFixedAncestorChainV2(target);
  return sameFixedAncestorChainV2(before, after);
}

function fixedLeafAbsentAfterV2(target: string): boolean {
  try {
    lstatSync(target, { bigint: true });
    return false;
  } catch (error) {
    return isErrnoV2(error, "ENOENT");
  }
}

function createFiniteMissingLeafV2(target: string): void {
  const descriptor = openSync(
    target,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
    0o600,
  );
  closeSync(descriptor);
}

function replaceFiniteLeafV2(target: string): void {
  renameSync(target, `${target}.displaced`);
  const descriptor = openSync(
    target,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
    0o700,
  );
  closeSync(descriptor);
}

function observeFixedPathStateV2(
  target: string,
  kind: "directory" | "executable_file",
  injectedFault:
    | "create_leaf_after_absence"
    | "replace_leaf"
    | undefined = undefined,
): FixedPathStateV2 {
  const ancestorBefore = captureFixedAncestorChainV2(target);
  if (ancestorBefore.state === "observation_failed") return "observation_failed";
  if (ancestorBefore.state === "unproven") {
    return fixedAncestorChainStableAfterV2(target, ancestorBefore)
      ? "unproven"
      : "observation_failed";
  }
  if (ancestorBefore.state === "missing") {
    const ancestorStable = fixedAncestorChainStableAfterV2(
      target,
      ancestorBefore,
    );
    if (injectedFault === "create_leaf_after_absence") createFiniteMissingLeafV2(target);
    return ancestorStable && fixedLeafAbsentAfterV2(target)
      ? "absent"
      : "observation_failed";
  }
  let before: BigIntStats;
  try {
    before = lstatSync(target, { bigint: true });
  } catch (error) {
    const ancestorStable = fixedAncestorChainStableAfterV2(
      target,
      ancestorBefore,
    );
    if (
      isErrnoV2(error, "ENOENT")
      && injectedFault === "create_leaf_after_absence"
    ) createFiniteMissingLeafV2(target);
    return isErrnoV2(error, "ENOENT")
      && ancestorStable
      && fixedLeafAbsentAfterV2(target)
      ? "absent"
      : "observation_failed";
  }
  if (injectedFault === "replace_leaf") {
    replaceFiniteLeafV2(target);
    let after: BigIntStats;
    try {
      after = lstatSync(target, { bigint: true });
    } catch {
      return "observation_failed";
    }
    return fixedAncestorChainStableAfterV2(target, ancestorBefore)
      && sameStableIdentityV2(before, after)
      ? "unproven"
      : "observation_failed";
  }
  if (before.isSymbolicLink()) {
    return fixedAncestorChainStableAfterV2(target, ancestorBefore)
      ? "unproven"
      : "observation_failed";
  }
  const validType = kind === "directory" ? before.isDirectory() : before.isFile();
  const mode = before.mode & 0o7777n;
  const validPolicy = validType
    && before.uid === 0n
    && (mode & 0o022n) === 0n
    && (kind === "directory" || (
      before.nlink === 1n
      && (mode & 0o111n) !== 0n
    ));
  if (!validPolicy) {
    return fixedAncestorChainStableAfterV2(target, ancestorBefore)
      ? "unproven"
      : "observation_failed";
  }
  let descriptor: number | undefined;
  let state: FixedPathStateV2 = "observation_failed";
  try {
    descriptor = openSync(
      target,
      fsConstants.O_RDONLY
        | (fsConstants.O_NOFOLLOW ?? 0)
        | (fsConstants.O_NONBLOCK ?? 0),
    );
  } catch {
    descriptor = undefined;
  }
  if (descriptor !== undefined) {
    try {
      const descriptorBefore = fstatSync(descriptor, { bigint: true });
      const descriptorAfter = fstatSync(descriptor, { bigint: true });
      const after = lstatSync(target, { bigint: true });
      state = sameStableIdentityV2(before, descriptorBefore)
        && sameStableIdentityV2(descriptorBefore, descriptorAfter)
        && sameStableIdentityV2(descriptorAfter, after)
        ? "present_unjoined"
        : "observation_failed";
    } catch {
      state = "observation_failed";
    }
  }
  if (descriptor !== undefined) {
    try {
      closeSync(descriptor);
    } catch {
      state = "observation_failed";
    }
  }
  if (!fixedAncestorChainStableAfterV2(target, ancestorBefore)) {
    state = "observation_failed";
  }
  return state;
}

function observeFiniteLeafCreationAfterAbsenceV2(): FixedPathStateV2 {
  const fixtureRoot = mkdtempSync(path.join(
    REPOSITORY_ROOT_V2,
    ".setfarm-readiness-v2-leaf-creation-",
  ));
  const target = path.join(fixtureRoot, "created-after-enoent");
  try {
    return observeFixedPathStateV2(
      target,
      "directory",
      "create_leaf_after_absence",
    );
  } finally {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
}

type FinitePathObjectFaultV2 =
  | "fixed_path_symlink"
  | "fixed_path_hardlink"
  | "fixed_path_unsafe_mode"
  | "fixed_path_replacement";

function observeFinitePathObjectV2(
  fault: FinitePathObjectFaultV2,
): FixedPathStateV2 {
  const fixtureRoot = mkdtempSync(path.join(
    REPOSITORY_ROOT_V2,
    ".setfarm-readiness-v2-path-object-",
  ));
  const source = path.join(fixtureRoot, "source");
  const target = path.join(fixtureRoot, "target");
  try {
    const sourceDescriptor = openSync(
      source,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
      0o700,
    );
    closeSync(sourceDescriptor);
    if (fault === "fixed_path_symlink") {
      symlinkSync(source, target);
    } else if (fault === "fixed_path_hardlink") {
      linkSync(source, target);
    } else {
      const targetDescriptor = openSync(
        target,
        fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
        0o700,
      );
      closeSync(targetDescriptor);
      if (fault === "fixed_path_unsafe_mode") chmodSync(target, 0o777);
    }
    return observeFixedPathStateV2(
      target,
      "executable_file",
      fault === "fixed_path_replacement" ? "replace_leaf" : undefined,
    );
  } finally {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
}

function fixedPathObservationV2(
  ref: FixedPathRefV2,
  state: FixedPathStateV2,
): FixedPathObservationV2 {
  const identity = { ref, state };
  return Object.freeze({
    ...identity,
    observationHash: hashCanonicalJson({
      schema: PATH_OBSERVATION_HASH_SCHEMA_V2,
      observation: identity,
    }),
  });
}

function pathStateToToolStateV2(
  state: FixedPathStateV2,
): "available" | "observation_failed" {
  if (state === "present_unjoined") return "available";
  return "observation_failed";
}

function commandObservationV2(
  identity: Omit<CommandObservationV2, "projectionByteLength" | "observationHash">,
): CommandObservationV2 {
  const projectionByteLength = Buffer.byteLength(
    canonicalJsonStringify(identity.result),
    "utf8",
  );
  const hashIdentity = { ...identity, projectionByteLength };
  return Object.freeze({
    ...hashIdentity,
    observationHash: hashCanonicalJson({
      schema: COMMAND_OBSERVATION_HASH_SCHEMA_V2,
      observation: hashIdentity,
    }),
  });
}

function failedResultForCommandV2(index: number): CommandResultV2 {
  const expected = executedCommandPlanV2[index]!.result;
  switch (expected.kind) {
    case "identity_count":
      return Object.freeze({
        kind: "identity_count",
        identityClass: expected.identityClass,
        validIdentityCount: null,
        state: "observation_failed",
      });
    case "gatekeeper":
      return Object.freeze({ kind: "gatekeeper", state: "observation_failed" });
    case "sip":
      return Object.freeze({ kind: "sip", state: "observation_failed" });
    case "authenticated_root":
      return Object.freeze({ kind: "authenticated_root", state: "observation_failed" });
    case "amfi_service":
      return Object.freeze({ kind: "amfi_service", state: "observation_failed" });
    case "tool_availability":
      return Object.freeze({
        kind: "tool_availability",
        tool: expected.tool,
        state: "observation_failed",
      });
    case "notary_profile_metadata":
      return Object.freeze({
        kind: "notary_profile_metadata",
        serviceRef: expected.serviceRef,
        state: "observation_failed",
      });
    default:
      throw new TypeError("Unknown fixed command semantic");
  }
}

function parseCompletedCommandV2(
  index: number,
  capture: TerminalCaptureV2,
  faults: ReadonlySet<PlatformReleaseReadinessTestFaultV2>,
): Readonly<{ result: CommandResultV2; malformed: boolean }> {
  const expected = executedCommandPlanV2[index]!.result;
  if (expected.kind === "identity_count") {
    return Object.freeze({
      result: parseIdentityResultV2(capture, expected.identityClass),
      malformed: false,
    });
  }
  if (expected.kind === "gatekeeper") {
    if (combinedExactV2(capture, "assessments enabled\n", "")) {
      return Object.freeze({
        result: Object.freeze({ kind: "gatekeeper", state: "enabled" }),
        malformed: false,
      });
    }
    if (combinedExactV2(capture, "assessments disabled\n", "")) {
      return Object.freeze({
        result: Object.freeze({ kind: "gatekeeper", state: "disabled" }),
        malformed: false,
      });
    }
    return Object.freeze({ result: failedResultForCommandV2(index), malformed: true });
  }
  if (expected.kind === "sip") {
    if (combinedExactV2(
      capture,
      "System Integrity Protection status: enabled.\n",
      "",
    )) {
      return Object.freeze({
        result: Object.freeze({ kind: "sip", state: "enabled" }),
        malformed: false,
      });
    }
    if (combinedExactV2(
      capture,
      "System Integrity Protection status: disabled.\n",
      "",
    )) {
      return Object.freeze({
        result: Object.freeze({ kind: "sip", state: "disabled" }),
        malformed: false,
      });
    }
    return Object.freeze({ result: failedResultForCommandV2(index), malformed: true });
  }
  if (expected.kind === "authenticated_root") {
    if (combinedExactV2(capture, "Authenticated Root status: enabled\n", "")) {
      return Object.freeze({
        result: Object.freeze({ kind: "authenticated_root", state: "enabled" }),
        malformed: false,
      });
    }
    if (combinedExactV2(capture, "Authenticated Root status: disabled\n", "")) {
      return Object.freeze({
        result: Object.freeze({ kind: "authenticated_root", state: "disabled" }),
        malformed: false,
      });
    }
    if (combinedExactV2(
      capture,
      "Authenticated Root is not supported on this device.\n",
      "",
    )) {
      return Object.freeze({
        result: Object.freeze({ kind: "authenticated_root", state: "unsupported" }),
        malformed: false,
      });
    }
    return Object.freeze({ result: failedResultForCommandV2(index), malformed: true });
  }
  if (expected.kind === "amfi_service") {
    if (faults.has("amfi_malformed_output")) {
      return Object.freeze({ result: failedResultForCommandV2(index), malformed: true });
    }
    const running = capture.status === "completed"
      && capture.exitCode === 0
      && capture.signal === null
      && capture.stderr.byteLength === 0
      && bufferHasOneExactTrimmedLineV2(capture.stdout, "state = running")
      && bufferHasOneExactTrimmedLineV2(
        capture.stdout,
        "program = /usr/libexec/amfid",
      );
    if (running) {
      return Object.freeze({
        result: Object.freeze({ kind: "amfi_service", state: "running" }),
        malformed: false,
      });
    }
    return Object.freeze({ result: failedResultForCommandV2(index), malformed: true });
  }
  if (expected.kind === "tool_availability") {
    const tool = expected.tool;
    if (tool === "notarytool" && faults.has("notarytool_unavailable")) {
      return Object.freeze({
        result: Object.freeze({ kind: "tool_availability", tool, state: "unavailable" }),
        malformed: false,
      });
    }
    if (capture.status !== "completed") {
      return Object.freeze({ result: failedResultForCommandV2(index), malformed: false });
    }
    if (capture.exitCode !== 0) {
      return Object.freeze({
        result: Object.freeze({ kind: "tool_availability", tool, state: "unavailable" }),
        malformed: false,
      });
    }
    const exactPath = resolveFixedPathPolicyTargetV2(
      fixedPathPolicyForRefV2(expected.fixedPathRef),
    );
    const exactOutput = `${exactPath}\n`;
    if (
      !buffersEqualExactV2(capture.stdout, exactOutput)
      || capture.stderr.byteLength !== 0
    ) {
      return Object.freeze({ result: failedResultForCommandV2(index), malformed: true });
    }
    const pathState = observeFixedPathStateV2(exactPath, "executable_file");
    const state = pathState === "present_unjoined"
      ? "available"
      : pathState === "absent"
        ? "unavailable"
        : "observation_failed";
    return Object.freeze({
      result: Object.freeze({ kind: "tool_availability", tool, state }),
      malformed: state === "observation_failed",
    });
  }
  const serviceRef = expected.serviceRef;
  if (
    serviceRef === "GKE_NOTARY_TOOL"
    && faults.has("notary_profile_probe_failure")
  ) {
    return Object.freeze({
      result: Object.freeze({
        kind: "notary_profile_metadata",
        serviceRef,
        state: "observation_failed",
      }),
      malformed: false,
    });
  }
  const state = capture.status === "completed" && capture.exitCode === 0
    ? "present_unjoined"
    : capture.status === "completed" && capture.exitCode === 44
      ? "not_observed"
      : "observation_failed";
  return Object.freeze({
    result: Object.freeze({ kind: "notary_profile_metadata", serviceRef, state }),
    malformed: false,
  });
}

async function observeExecutedCommandV2(
  index: number,
  faults: ReadonlySet<PlatformReleaseReadinessTestFaultV2>,
): Promise<CommandObservationV2> {
  const metadata = executedCommandPlanV2[index]!;
  const capture = await runFixedCommandV2(index, faults);
  try {
    const parsed = capture.status === "completed"
      ? parseCompletedCommandV2(index, capture, faults)
      : Object.freeze({ result: failedResultForCommandV2(index), malformed: false });
    const status = parsed.malformed ? "observation_failed" : capture.status;
    return commandObservationV2({
      kind: metadata.kind,
      executableRef: metadata.executableRef,
      argvRef: metadata.argvRef,
      status,
      exitCode: capture.exitCode,
      signal: capture.signal,
      result: parsed.result,
    });
  } finally {
    capture.stdout.fill(0);
    capture.stderr.fill(0);
  }
}

function fixedToolObservationV2(
  command: FixedPathReadinessCommandPolicyV2,
): CommandObservationV2 {
  const fixedPath = fixedPathPolicyForRefV2(command.result.fixedPathRef);
  const state = pathStateToToolStateV2(
    observeFixedPathStateV2(
      resolveFixedPathPolicyTargetV2(fixedPath),
      fixedPath.expectedKind,
    ),
  );
  return commandObservationV2({
    kind: command.kind,
    executableRef: command.executableRef,
    argvRef: command.argvRef,
    status: state === "observation_failed" ? "observation_failed" : "completed",
    exitCode: state === "available" ? 0 : null,
    signal: null,
    result: Object.freeze({
      kind: "tool_availability",
      tool: command.result.tool,
      state,
    }),
  });
}

type StrictJsonReadV2 =
  | Readonly<{ state: "ok"; value: unknown }>
  | Readonly<{ state: "missing" | "invalid" | "observation_failed" }>;

function readStrictBoundedJsonV2(
  target: string,
  injectedFault: "replace_leaf" | undefined = undefined,
): StrictJsonReadV2 {
  const ancestorBefore = captureFixedAncestorChainV2(target);
  if (ancestorBefore.state === "observation_failed") {
    return Object.freeze({ state: "observation_failed" });
  }
  if (ancestorBefore.state === "unproven") {
    fixedAncestorChainStableAfterV2(target, ancestorBefore);
    return Object.freeze({ state: "observation_failed" });
  }
  if (ancestorBefore.state === "missing") {
    return fixedAncestorChainStableAfterV2(target, ancestorBefore)
      && fixedLeafAbsentAfterV2(target)
      ? Object.freeze({ state: "missing" })
      : Object.freeze({ state: "observation_failed" });
  }
  let before: BigIntStats;
  try {
    before = lstatSync(target, { bigint: true });
  } catch (error) {
    const state = isErrnoV2(error, "ENOENT") ? "missing" : "observation_failed";
    return fixedAncestorChainStableAfterV2(target, ancestorBefore)
      && (state !== "missing" || fixedLeafAbsentAfterV2(target))
      ? Object.freeze({ state })
      : Object.freeze({ state: "observation_failed" });
  }
  if (before.isSymbolicLink() || !before.isFile() || before.nlink !== 1n) {
    fixedAncestorChainStableAfterV2(target, ancestorBefore);
    return Object.freeze({ state: "observation_failed" });
  }
  if (before.size < 1n || before.size > BigInt(BUILD_DOCUMENT_MAX_BYTES_V2)) {
    return fixedAncestorChainStableAfterV2(target, ancestorBefore)
      ? Object.freeze({ state: "invalid" })
      : Object.freeze({ state: "observation_failed" });
  }
  let descriptor: number;
  try {
    descriptor = openSync(
      target,
      fsConstants.O_RDONLY
        | (fsConstants.O_NOFOLLOW ?? 0)
        | (fsConstants.O_NONBLOCK ?? 0),
    );
  } catch {
    fixedAncestorChainStableAfterV2(target, ancestorBefore);
    return Object.freeze({ state: "observation_failed" });
  }
  let result: StrictJsonReadV2 = Object.freeze({ state: "observation_failed" });
  let bytes: Buffer | undefined;
  try {
    const descriptorBefore = fstatSync(descriptor, { bigint: true });
    let descriptorStable = sameStableIdentityV2(before, descriptorBefore);
    if (descriptorStable) {
      bytes = Buffer.alloc(Number(before.size));
      let offset = 0;
      while (offset < bytes.byteLength) {
        const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, offset);
        if (count < 1) {
          descriptorStable = false;
          break;
        }
        offset += count;
      }
    }
    if (descriptorStable && bytes !== undefined) {
      const growth = Buffer.alloc(1);
      let growthCount = 1;
      try {
        growthCount = readSync(descriptor, growth, 0, 1, bytes.byteLength);
      } finally {
        growth.fill(0);
      }
      const descriptorAfter = fstatSync(descriptor, { bigint: true });
      if (injectedFault === "replace_leaf") replaceFiniteLeafV2(target);
      const after = lstatSync(target, { bigint: true });
      descriptorStable = growthCount === 0
        && sameStableIdentityV2(descriptorBefore, descriptorAfter)
        && sameStableIdentityV2(descriptorAfter, after);
    }
    if (descriptorStable && bytes !== undefined) {
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        result = Object.freeze({ state: "ok", value: JSON.parse(text) });
      } catch {
        result = Object.freeze({ state: "invalid" });
      }
    }
  } catch {
    result = Object.freeze({ state: "observation_failed" });
  } finally {
    bytes?.fill(0);
    try {
      closeSync(descriptor);
    } catch {
      result = Object.freeze({ state: "observation_failed" });
    }
  }
  if (!fixedAncestorChainStableAfterV2(target, ancestorBefore)) {
    return Object.freeze({ state: "observation_failed" });
  }
  return result;
}

function observeFiniteBuildDocumentPathFaultV2(
  fault: "fixed_path_symlink" | "fixed_path_replacement",
): StrictJsonReadV2 {
  const fixtureRoot = mkdtempSync(path.join(
    REPOSITORY_ROOT_V2,
    ".setfarm-readiness-v2-build-document-",
  ));
  const source = path.join(fixtureRoot, "source.json");
  const target = path.join(fixtureRoot, "target.json");
  try {
    for (const document of fault === "fixed_path_symlink"
      ? [source]
      : [target]) {
      const descriptor = openSync(
        document,
        fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
        0o600,
      );
      try {
        const bytes = Buffer.from("{}", "ascii");
        try {
          writeSync(descriptor, bytes, 0, bytes.byteLength, 0);
        } finally {
          bytes.fill(0);
        }
      } finally {
        closeSync(descriptor);
      }
    }
    if (fault === "fixed_path_symlink") symlinkSync(source, target);
    return readStrictBoundedJsonV2(
      target,
      fault === "fixed_path_replacement" ? "replace_leaf" : undefined,
    );
  } finally {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
}

function observeBuildProvenanceV2(
  faults: ReadonlySet<PlatformReleaseReadinessTestFaultV2>,
): BuildProvenanceStateV2 {
  const finitePathFault = faults.has("fixed_path_replacement")
    ? "fixed_path_replacement"
    : faults.has("fixed_path_symlink")
      ? "fixed_path_symlink"
      : undefined;
  const buildInfoPolicy = fixedPathPolicyForRoleV2("build_info_document");
  const manifestPolicy = fixedPathPolicyForRoleV2(
    "platform_release_manifest_document",
  );
  let buildInfo: StrictJsonReadV2 = finitePathFault === undefined
    ? readStrictBoundedJsonV2(resolveFixedPathPolicyTargetV2(buildInfoPolicy))
    : observeFiniteBuildDocumentPathFaultV2(finitePathFault);
  let manifest: StrictJsonReadV2 = finitePathFault === undefined
    ? readStrictBoundedJsonV2(resolveFixedPathPolicyTargetV2(manifestPolicy))
    : observeFiniteBuildDocumentPathFaultV2(finitePathFault);
  if (faults.has("build_manifest_invalid")) {
    buildInfo = Object.freeze({ state: "missing" });
    if (manifest.state !== "observation_failed") {
      manifest = Object.freeze({ state: "invalid" });
    }
  }
  if (buildInfo.state === "observation_failed" || manifest.state === "observation_failed") {
    return "observation_failed";
  }
  if (buildInfo.state === "invalid" || manifest.state === "invalid") return "invalid";
  if (buildInfo.state === "missing" || manifest.state === "missing") return "missing";
  if (buildInfo.state !== "ok" || manifest.state !== "ok") return "observation_failed";
  const parsedBuildInfo = BuildInfoV2Schema.safeParse(buildInfo.value);
  const parsedManifest = PlatformReleaseManifestV1Schema.safeParse(manifest.value);
  if (
    !parsedBuildInfo.success
    || !parsedManifest.success
    || parsedBuildInfo.data.sha !== parsedManifest.data.releaseSha
  ) return "invalid";
  return "v1_build_provenance_only";
}

const hardCodedConfigurationBlockersV2 = Object.freeze([
  "DEVELOPER_ID_TEAM_UNCONFIGURED",
  "DESIGNATED_REQUIREMENT_UNCONFIGURED",
  "INSTALLER_PACKAGE_ID_UNCONFIGURED",
  "OFFLINE_RELEASE_PUBLIC_KEY_UNCONFIGURED",
  "SIGNED_NATIVE_DISTRIBUTION_CATALOG_EMPTY",
] as const);

const futureAuthorityBlockersV2 = Object.freeze([
  "PREPARED_RELEASE_STORE_AUTHORITY_UNAVAILABLE",
  "FRESH_VERIFIER_AUTHORITY_UNAVAILABLE",
  "REGISTRY_V2_ACTIVATION_AUTHORITY_UNAVAILABLE",
] as const);

function deriveUnsupportedBlockersV2(): BlockerCodeV2[] {
  const blockers = new Set<BlockerCodeV2>([
    ...hardCodedConfigurationBlockersV2,
    ...futureAuthorityBlockersV2,
    "PLATFORM_UNSUPPORTED",
    "HOST_OBSERVATION_INCOMPLETE",
  ]);
  return PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2.filter(
    (blocker) => blockers.has(blocker),
  );
}

type DarwinSummaryV2 = Readonly<{
  codeSigning: Readonly<{
    developerIdApplication: Extract<CommandResultV2, { kind: "identity_count" }>;
    developerIdInstaller: Extract<CommandResultV2, { kind: "identity_count" }>;
  }>;
  notarization: Readonly<{
    toolAvailability: "available" | "unavailable" | "observation_failed";
    knownProfileMetadata:
      | "not_observed_at_known_service_names"
      | "present_unjoined"
      | "observation_failed";
    credentialReadiness: "unverifiable_without_external_credential_configuration";
    ticketEvidence: "not_observed_without_exact_distribution" | "unproven" | "observation_failed";
  }>;
  hostEnforcement: Readonly<{
    gatekeeper: "enabled" | "disabled" | "observation_failed";
    sip: "enabled" | "disabled" | "observation_failed";
    authenticatedRoot: "enabled" | "disabled" | "unsupported" | "observation_failed";
    amfiService: "running" | "not_running" | "observation_failed";
    amfiRuntimeAdmission: "unavailable_requires_authenticated_running_helper";
  }>;
  installedDistribution: Readonly<{
    expectedRoots: readonly FixedPathObservationV2[];
    expectedHelpers: readonly FixedPathObservationV2[];
    installerPackageIdentifier: "unconfigured";
    installerReceipt: "not_observed_configuration_unavailable";
    exactPayloadBinding: "absent" | "unproven";
  }>;
  productionTrustConfiguration: Readonly<{
    state: "unavailable";
    productionAdmission: "forbidden";
  }>;
  buildProvenance: Readonly<{
    state: BuildProvenanceStateV2;
    platformReleaseAuthority: false;
  }>;
  commandObservations: readonly CommandObservationV2[];
  trustDrift: boolean;
}>;

function commandResultByArgvRefV2(
  observations: readonly CommandObservationV2[],
  argvRef: CommandObservationV2["argvRef"],
): CommandResultV2 {
  const found = observations.find((observation) => observation.argvRef === argvRef);
  if (found === undefined) throw new TypeError("Fixed command observation is missing");
  return found.result;
}

function summarizeDarwinV2(
  commandObservations: readonly CommandObservationV2[],
  expectedRoots: readonly FixedPathObservationV2[],
  expectedHelpers: readonly FixedPathObservationV2[],
  buildProvenanceState: BuildProvenanceStateV2,
): DarwinSummaryV2 {
  const application = commandResultByArgvRefV2(
    commandObservations,
    "SECURITY_FIND_IDENTITY_CODESIGNING",
  );
  const installer = commandResultByArgvRefV2(
    commandObservations,
    "SECURITY_FIND_IDENTITY_BASIC",
  );
  const notarytool = commandResultByArgvRefV2(
    commandObservations,
    "NOTARYTOOL_AVAILABILITY",
  );
  const profiles = [
    commandResultByArgvRefV2(
      commandObservations,
      "SECURITY_FIND_GENERIC_PASSWORD_GKE_NOTARY_TOOL",
    ),
    commandResultByArgvRefV2(
      commandObservations,
      "SECURITY_FIND_GENERIC_PASSWORD_NOTARYTOOL",
    ),
    commandResultByArgvRefV2(
      commandObservations,
      "SECURITY_FIND_GENERIC_PASSWORD_NOTARY_TOOL",
    ),
  ];
  const gatekeeper = commandResultByArgvRefV2(commandObservations, "SPCTL_STATUS");
  const sip = commandResultByArgvRefV2(commandObservations, "CSRUTIL_STATUS");
  const authenticatedRoot = commandResultByArgvRefV2(
    commandObservations,
    "CSRUTIL_AUTHENTICATED_ROOT_STATUS",
  );
  const amfi = commandResultByArgvRefV2(commandObservations, "LAUNCHCTL_PRINT_AMFI");
  if (
    application.kind !== "identity_count"
    || installer.kind !== "identity_count"
    || notarytool.kind !== "tool_availability"
    || profiles.some((profile) => profile.kind !== "notary_profile_metadata")
    || gatekeeper.kind !== "gatekeeper"
    || sip.kind !== "sip"
    || authenticatedRoot.kind !== "authenticated_root"
    || amfi.kind !== "amfi_service"
  ) throw new TypeError("Fixed command observation binding drifted");

  const profileStates = profiles.map((profile) => profile.state);
  const knownProfileMetadata = profileStates.includes("observation_failed")
    ? "observation_failed"
    : profileStates.includes("present_unjoined")
      ? "present_unjoined"
      : "not_observed_at_known_service_names";
  const pathStates = [...expectedRoots, ...expectedHelpers].map(({ state }) => state);
  const ticketEvidence = pathStates.includes("observation_failed")
    ? "observation_failed"
    : pathStates.every((state) => state === "present_unjoined")
      ? "unproven"
      : "not_observed_without_exact_distribution";
  const exactPayloadBinding = pathStates.includes("absent") ? "absent" : "unproven";
  const trust = PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_TRUST_CONFIGURATION_V2;
  const requiredTrust =
    PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2
      .requiredProductionTrustConfiguration;
  const trustDrift = trust.state !== requiredTrust.state
    || trust.productionAdmission !== requiredTrust.productionAdmission
    || trust.offlineReleasePublicKeySpkiDerBase64
      !== requiredTrust.offlineReleasePublicKeySpkiDerBase64
    || trust.signedNativeDistributionCatalog
      !== requiredTrust.signedNativeDistributionCatalog;
  return Object.freeze({
    codeSigning: Object.freeze({
      developerIdApplication: application,
      developerIdInstaller: installer,
    }),
    notarization: Object.freeze({
      toolAvailability: notarytool.state,
      knownProfileMetadata,
      credentialReadiness: "unverifiable_without_external_credential_configuration",
      ticketEvidence,
    }),
    hostEnforcement: Object.freeze({
      gatekeeper: gatekeeper.state,
      sip: sip.state,
      authenticatedRoot: authenticatedRoot.state,
      amfiService: amfi.state,
      amfiRuntimeAdmission: "unavailable_requires_authenticated_running_helper",
    }),
    installedDistribution: Object.freeze({
      expectedRoots,
      expectedHelpers,
      installerPackageIdentifier:
        PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2
          .installerPackageIdentifier.state,
      installerReceipt: "not_observed_configuration_unavailable",
      exactPayloadBinding,
    }),
    productionTrustConfiguration: Object.freeze({
      state: requiredTrust.state,
      productionAdmission: requiredTrust.productionAdmission,
    }),
    buildProvenance: Object.freeze({
      state: buildProvenanceState,
      platformReleaseAuthority: false,
    }),
    commandObservations,
    trustDrift,
  });
}

function deriveDarwinBlockersV2(summary: DarwinSummaryV2): BlockerCodeV2[] {
  const blockers = new Set<BlockerCodeV2>([
    ...hardCodedConfigurationBlockersV2,
    ...futureAuthorityBlockersV2,
  ]);
  const identities = summary.codeSigning;
  if (identities.developerIdApplication.state === "not_observed_in_active_search_list") {
    blockers.add("DEVELOPER_ID_APPLICATION_IDENTITY_NOT_OBSERVED");
  }
  if (identities.developerIdInstaller.state === "not_observed_in_active_search_list") {
    blockers.add("DEVELOPER_ID_INSTALLER_IDENTITY_NOT_OBSERVED");
  }
  if (
    identities.developerIdApplication.state === "observation_failed"
    || identities.developerIdInstaller.state === "observation_failed"
  ) {
    blockers.add("CODE_SIGNING_IDENTITY_OBSERVATION_FAILED");
    blockers.add("HOST_OBSERVATION_INCOMPLETE");
  }
  if (summary.notarization.toolAvailability === "unavailable") {
    blockers.add("NOTARYTOOL_UNAVAILABLE");
  } else if (summary.notarization.toolAvailability === "observation_failed") {
    blockers.add("NOTARYTOOL_OBSERVATION_FAILED");
    blockers.add("HOST_OBSERVATION_INCOMPLETE");
  }
  blockers.add("NOTARY_CREDENTIAL_CONFIGURATION_UNVERIFIABLE");
  blockers.add("NOTARIZED_DISTRIBUTION_UNPROVEN");
  if (
    summary.notarization.knownProfileMetadata === "observation_failed"
    || summary.notarization.ticketEvidence === "observation_failed"
  ) blockers.add("HOST_OBSERVATION_INCOMPLETE");
  if (summary.hostEnforcement.gatekeeper === "disabled") {
    blockers.add("GATEKEEPER_DISABLED");
  } else if (summary.hostEnforcement.gatekeeper === "observation_failed") {
    blockers.add("GATEKEEPER_OBSERVATION_FAILED");
    blockers.add("HOST_OBSERVATION_INCOMPLETE");
  }
  if (summary.hostEnforcement.sip === "disabled") {
    blockers.add("SIP_DISABLED");
  } else if (summary.hostEnforcement.sip === "observation_failed") {
    blockers.add("SIP_OBSERVATION_FAILED");
    blockers.add("HOST_OBSERVATION_INCOMPLETE");
  }
  if (summary.hostEnforcement.authenticatedRoot !== "enabled") {
    blockers.add("AUTHENTICATED_ROOT_DISABLED_OR_UNAVAILABLE");
    if (summary.hostEnforcement.authenticatedRoot === "observation_failed") {
      blockers.add("HOST_OBSERVATION_INCOMPLETE");
    }
  }
  if (summary.hostEnforcement.amfiService !== "running") {
    blockers.add("AMFI_SERVICE_UNAVAILABLE");
    if (summary.hostEnforcement.amfiService === "observation_failed") {
      blockers.add("HOST_OBSERVATION_INCOMPLETE");
    }
  }
  blockers.add("AUTHENTICATED_RUNNING_HELPER_ABSENT");
  blockers.add("AMFI_RUNTIME_ADMISSION_UNPROVEN");
  blockers.add("INSTALLER_RECEIPT_UNOBSERVED_CONFIGURATION_UNAVAILABLE");
  if (summary.installedDistribution.expectedRoots.some(({ state }) => state === "absent")) {
    blockers.add("INSTALLED_SETFARM_ROOT_ABSENT");
  }
  if (summary.installedDistribution.expectedHelpers.some(({ state }) => state === "absent")) {
    blockers.add("INSTALLED_HELPER_ABSENT");
  }
  blockers.add("EXACT_INSTALLED_PAYLOAD_BINDING_UNPROVEN");
  if ([
    ...summary.installedDistribution.expectedRoots,
    ...summary.installedDistribution.expectedHelpers,
  ].some(({ state }) => state === "observation_failed")) {
    blockers.add("HOST_OBSERVATION_INCOMPLETE");
  }
  blockers.add("PRODUCTION_TRUST_CONFIGURATION_UNAVAILABLE");
  blockers.add("V2_PLATFORM_RELEASE_MANIFEST_AUTHORITY_UNAVAILABLE");
  if (
    summary.buildProvenance.state === "observation_failed"
    || summary.commandObservations.some(
      ({ status, result }) => status !== "completed" || result.state === "observation_failed",
    )
    || summary.trustDrift
  ) blockers.add("HOST_OBSERVATION_INCOMPLETE");
  return PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2.filter(
    (blocker) => blockers.has(blocker),
  );
}

function commonReceiptV2(observedAt: string, blockerCodes: readonly BlockerCodeV2[]) {
  return {
    schema: PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "diagnostic_observation_only" as const,
    admissionScope: "production_host_readiness_observation" as const,
    credentialUse: "none" as const,
    mutationAuthority: false as const,
    productionAuthority: false as const,
    productionAdmission: "blocked" as const,
    trustConclusion: "characterization_only" as const,
    policyHash: hashCanonicalJson({
      schema: POLICY_HASH_SCHEMA_V2,
      policy: PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2,
    }),
    observedAt,
    blockerCodes: [...blockerCodes],
  };
}

function finalizeCandidateV2(candidateWithoutHash: Record<string, unknown>):
  PlatformReleaseProductionAdmissionReadinessV2 {
  const candidate = {
    ...candidateWithoutHash,
    readinessHash: hashCanonicalJson({
      schema: READINESS_HASH_SCHEMA_V2,
      receipt: candidateWithoutHash,
    }),
  };
  return parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(candidate);
}

function unsupportedReceiptV2(): PlatformReleaseProductionAdmissionReadinessV2 {
  const observedAt = new Date().toISOString();
  const common = commonReceiptV2(observedAt, deriveUnsupportedBlockersV2());
  return finalizeCandidateV2({
    ...common,
    observedPlatform: "unsupported",
    codeSigning: { state: "not_observed_platform_unsupported" },
    notarization: { state: "not_observed_platform_unsupported" },
    hostEnforcement: { state: "not_observed_platform_unsupported" },
    installedDistribution: { state: "not_observed_platform_unsupported" },
    productionTrustConfiguration: {
      state: "not_observed_platform_unsupported",
      productionAdmission: "forbidden",
    },
    buildProvenance: { state: "not_observed_platform_unsupported" },
    commandObservations: [],
  });
}

async function darwinReceiptV2(
  faults: ReadonlySet<PlatformReleaseReadinessTestFaultV2>,
): Promise<PlatformReleaseProductionAdmissionReadinessV2> {
  const executed = await Promise.all(
    executedCommandPlanV2.map(
      (_command, index) => observeExecutedCommandV2(index, faults),
    ),
  );
  const fixedToolObservations = fixedPathCommandPlanV2.map(
    (command) => fixedToolObservationV2(command),
  );
  const finitePathFault: FinitePathObjectFaultV2 | undefined =
    faults.has("fixed_path_replacement")
    ? "fixed_path_replacement"
    : faults.has("fixed_path_symlink")
      ? "fixed_path_symlink"
      : faults.has("fixed_path_hardlink")
        ? "fixed_path_hardlink"
        : faults.has("fixed_path_unsafe_mode")
          ? "fixed_path_unsafe_mode"
          : undefined;
  const rootPolicy = fixedPathPolicyForRoleV2("installed_root");
  const helperPolicy = fixedPathPolicyForRoleV2("installed_helper");
  const expectedRoots = Object.freeze([
    fixedPathObservationV2(
      rootPolicy.ref,
      faults.has("fixed_path_leaf_created_after_absence")
        ? observeFiniteLeafCreationAfterAbsenceV2()
        : finitePathFault !== undefined
          ? observeFinitePathObjectV2(finitePathFault)
        : observeFixedPathStateV2(
            resolveFixedPathPolicyTargetV2(rootPolicy),
            rootPolicy.expectedKind,
          ),
    ),
  ]);
  const expectedHelpers = Object.freeze([
    fixedPathObservationV2(
      helperPolicy.ref,
      finitePathFault !== undefined
        ? observeFinitePathObjectV2(finitePathFault)
        : observeFixedPathStateV2(
            resolveFixedPathPolicyTargetV2(helperPolicy),
            helperPolicy.expectedKind,
          ),
    ),
  ]);
  const commandObservations = Object.freeze([
    ...executed,
    ...fixedToolObservations,
  ]);
  const summary = summarizeDarwinV2(
    commandObservations,
    expectedRoots,
    expectedHelpers,
    observeBuildProvenanceV2(faults),
  );
  const observedAt = new Date().toISOString();
  const common = commonReceiptV2(observedAt, deriveDarwinBlockersV2(summary));
  const developerIdApplication = {
    validIdentityCount: summary.codeSigning.developerIdApplication.validIdentityCount,
    state: summary.codeSigning.developerIdApplication.state,
  };
  const developerIdInstaller = {
    validIdentityCount: summary.codeSigning.developerIdInstaller.validIdentityCount,
    state: summary.codeSigning.developerIdInstaller.state,
  };
  return finalizeCandidateV2({
    ...common,
    observedPlatform: "darwin",
    codeSigning: { developerIdApplication, developerIdInstaller },
    notarization: summary.notarization,
    hostEnforcement: summary.hostEnforcement,
    installedDistribution: summary.installedDistribution,
    productionTrustConfiguration: summary.productionTrustConfiguration,
    buildProvenance: summary.buildProvenance,
    commandObservations: summary.commandObservations,
  });
}

/** @internal */
export async function observePlatformReleaseProductionAdmissionReadinessWithFiniteModeForInternalUseV2(
  mode: InternalModeV2,
): Promise<PlatformReleaseProductionAdmissionReadinessV2> {
  const validated = validateInternalModeV2(mode);
  if (validated.platform === "unsupported") return unsupportedReceiptV2();
  return darwinReceiptV2(validated.faults);
}
