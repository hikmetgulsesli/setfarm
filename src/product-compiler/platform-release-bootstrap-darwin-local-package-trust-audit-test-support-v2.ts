import { createHash, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { isProxy } from "node:util/types";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  expectedPlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandV2,
  classifyPlatformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptStateV2,
  platformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptChangedDuringAuditV2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_ENVIRONMENT_POLICY_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_OUTPUT_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_PACKAGE_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PACKAGE_IDENTIFIER_V2,
  parsePlatformReleaseBootstrapDarwinLocalPackageTrustAuditCandidateV2,
  type PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2,
  type PlatformReleaseBootstrapDarwinLocalPackageTrustAuditTargetEvidenceV2,
  type PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2,
} from "../execution/schemas/platform-release-bootstrap-darwin-local-package-trust-audit-v2.js";
import { deepFreezePlatformReleaseJsonV2 } from "../execution/schemas/platform-release-common-v2.js";

const COMMAND_TIMEOUT_MS_V2 = 8_000;
const ROOT_PREFIX_V2 = "setfarm-darwin-local-package-trust-audit-v2-";
const PAYLOAD_BASENAME_V2 = "payload";
const PACKAGE_BASENAME_V2 = "unsigned-v2.pkg";
const TARGET_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit-target-observation-hash.v2";
const AUDIT_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit-hash.v2";

export type PlatformReleaseBootstrapDarwinLocalPackageTrustAuditFixtureV2 = Readonly<{
  packageIdentifier: typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PACKAGE_IDENTIFIER_V2;
  dispose(): void;
}>;

export type PlatformReleaseBootstrapDarwinLocalPackageTrustAuditErrorCodeV2 =
  | "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PLATFORM_UNAVAILABLE"
  | "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_BUILD_FAILED"
  | "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PROBE_FAILED"
  | "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PACKAGE_DRIFT"
  | "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_FIXTURE_HANDLE_UNAUTHENTICATED"
  | "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_RECEIPT_UNEXPECTED";

export class PlatformReleaseBootstrapDarwinLocalPackageTrustAuditErrorV2 extends Error {
  constructor(
    readonly code: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseBootstrapDarwinLocalPackageTrustAuditErrorV2";
  }
}

type CommandResultV2 = Readonly<{
  status: "exited" | "spawn_failed" | "timed_out" | "output_limit_exceeded";
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: Buffer;
}>;

type FixtureStateV2 = Readonly<{
  rootAlias: string;
  root: string;
  payloadRoot: string;
  packagePath: string;
  packageIdentifier: typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PACKAGE_IDENTIFIER_V2;
}>;

const fixtureStatesV2 = new WeakMap<object, FixtureStateV2>();

export type PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandInvocationV2 = Readonly<{
  kind: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2["kind"];
  executable: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2["executable"];
  argvRef: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2["argvRef"];
  argvHash: string;
  argv: readonly string[];
  cwd: string;
  environmentPolicy: typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_ENVIRONMENT_POLICY_V2;
}>;

type PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandRunnerV2 = (
  invocation: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandInvocationV2,
) => Promise<CommandResultV2>;

function failV2(
  code: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapDarwinLocalPackageTrustAuditErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256BytesV2(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function boundedAppendV2(
  chunks: Buffer[],
  size: { value: number },
  chunk: Buffer,
): boolean {
  if (size.value >= PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_OUTPUT_BYTES_V2) return false;
  const remaining = PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_OUTPUT_BYTES_V2 - size.value;
  const bounded = chunk.subarray(0, remaining);
  chunks.push(Buffer.from(bounded));
  size.value += bounded.byteLength;
  return bounded.byteLength === chunk.byteLength;
}

function runBoundedCommandV2(
  invocation: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandInvocationV2,
): Promise<CommandResultV2> {
  return new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const stdoutSize = { value: 0 };
    const stderrSize = { value: 0 };
    let outputLimitExceeded = false;
    let timedOut = false;
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    let child: ChildProcess;
    try {
      child = spawn(invocation.executable, [...invocation.argv], {
        cwd: invocation.cwd,
        env: {
          HOME: "/var/empty",
          LANG: "C",
          LC_ALL: "C",
          PATH: "/usr/bin:/usr/sbin:/bin:/sbin",
          TMPDIR: invocation.cwd,
        },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve(Object.freeze({
        status: "spawn_failed",
        exitCode: null,
        signal: null,
        stdout: Buffer.alloc(0),
        stderr: Buffer.from(String(error), "utf8").subarray(
          0,
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_OUTPUT_BYTES_V2,
        ),
      }));
      return;
    }
    const settle = (result: CommandResultV2): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(Object.freeze(result));
    };
    const kill = (): void => {
      try {
        child.kill("SIGKILL");
      } catch {
        // The close event still owns final settlement when the child already exited.
      }
    };
    timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, COMMAND_TIMEOUT_MS_V2);
    child.stdout?.on("data", (chunk: Buffer) => {
      if (!boundedAppendV2(stdoutChunks, stdoutSize, chunk)) {
        outputLimitExceeded = true;
        kill();
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (!boundedAppendV2(stderrChunks, stderrSize, chunk)) {
        outputLimitExceeded = true;
        kill();
      }
    });
    child.once("error", (error) => {
      settle({
        status: "spawn_failed",
        exitCode: null,
        signal: null,
        stdout: Buffer.concat(stdoutChunks),
        stderr: Buffer.concat([
          Buffer.concat(stderrChunks),
          Buffer.from(
            String(error).slice(0, PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_OUTPUT_BYTES_V2),
            "utf8",
          ),
        ]).subarray(0, PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_OUTPUT_BYTES_V2),
      });
    });
    child.once("close", (exitCode, signal) => {
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);
      if (outputLimitExceeded) {
        settle({ status: "output_limit_exceeded", exitCode: null, signal: null, stdout, stderr });
      } else if (timedOut) {
        settle({ status: "timed_out", exitCode: null, signal: null, stdout, stderr });
      } else {
        settle({ status: "exited", exitCode, signal, stdout, stderr });
      }
    });
  });
}

function exactCommandRunnerV2(
  invocation: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandInvocationV2,
): Promise<CommandResultV2> {
  return runBoundedCommandV2(invocation);
}

function exactPrivateRootV2(): Readonly<{ alias: string; root: string }> {
  const alias = mkdtempSync(path.join(os.tmpdir(), ROOT_PREFIX_V2));
  const root = realpathSync(alias);
  chmodSync(root, 0o700);
  const stat = lstatSync(root);
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || (stat.mode & 0o7777) !== 0o700
    || (typeof process.getuid === "function" && stat.uid !== process.getuid())
    || (typeof process.getgid === "function" && stat.gid !== process.getgid())
  ) {
    rmSync(alias, { recursive: true, force: true });
    return failV2(
      "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_BUILD_FAILED",
      "Trust audit root must be one private process-owned directory",
    );
  }
  return Object.freeze({ alias, root });
}

function assertPrivateFixtureStateV2(state: FixtureStateV2): void {
  const rootStat = lstatSync(state.root);
  if (
    rootStat.isSymbolicLink()
    || !rootStat.isDirectory()
    || realpathSync(state.root) !== state.root
    || realpathSync(state.rootAlias) !== state.root
    || (rootStat.mode & 0o7777) !== 0o700
    || (typeof process.getuid === "function" && rootStat.uid !== process.getuid())
    || (typeof process.getgid === "function" && rootStat.gid !== process.getgid())
    || path.dirname(state.payloadRoot) !== state.root
    || path.dirname(state.packagePath) !== state.root
    || path.basename(state.payloadRoot) !== PAYLOAD_BASENAME_V2
    || path.basename(state.packagePath) !== PACKAGE_BASENAME_V2
  ) {
    return failV2(
      "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Trust audit fixture root is not the original private direct-child layout",
    );
  }
  const payloadStat = lstatSync(state.payloadRoot);
  const markerPath = path.join(state.payloadRoot, "SETFARM_AUDIT_MARKER.txt");
  const markerStat = lstatSync(markerPath);
  if (
    payloadStat.isSymbolicLink()
    || !payloadStat.isDirectory()
    || (payloadStat.mode & 0o7777) !== 0o700
    || markerStat.isSymbolicLink()
    || !markerStat.isFile()
    || (markerStat.mode & 0o7777) !== 0o444
    || readdirSync(state.payloadRoot).length !== 1
  ) {
    return failV2(
      "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Trust audit payload root is not the original private marker tree",
    );
  }
  try {
    lstatSync(state.packagePath);
    return failV2(
      "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Trust audit package output already exists before the fixed setup command",
    );
  } catch (error) {
    const code = error as NodeJS.ErrnoException;
    if (code.code !== "ENOENT") throw error;
  }
}

function authenticFixtureStateV2(
  fixture: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditFixtureV2,
): FixtureStateV2 {
  if (
    typeof fixture !== "object"
    || fixture === null
    || isProxy(fixture)
  ) {
    return failV2(
      "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Trust audit requires one authentic fixture handle",
    );
  }
  const state = fixtureStatesV2.get(fixture);
  if (state === undefined) {
    return failV2(
      "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Trust audit fixture handle is not owned by the code-owned builder",
    );
  }
  assertPrivateFixtureStateV2(state);
  return state;
}

export function buildPlatformReleaseBootstrapDarwinLocalPackageTrustAuditFixtureForTestV2(): PlatformReleaseBootstrapDarwinLocalPackageTrustAuditFixtureV2 {
  if (process.platform !== "darwin") {
    return failV2(
      "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PLATFORM_UNAVAILABLE",
      "The local package trust audit fixture requires Darwin package tooling",
    );
  }
  const privateRoot = exactPrivateRootV2();
  try {
    const payloadRoot = path.join(privateRoot.root, PAYLOAD_BASENAME_V2);
    mkdirSync(payloadRoot, { mode: 0o700 });
    const payloadPath = path.join(payloadRoot, "SETFARM_AUDIT_MARKER.txt");
    writeFileSync(payloadPath, "setfarm-local-package-trust-audit-v2\n", {
      mode: 0o444,
    });
    const packagePath = path.join(privateRoot.root, PACKAGE_BASENAME_V2);
    const state: FixtureStateV2 = Object.freeze({
      rootAlias: privateRoot.alias,
      root: privateRoot.root,
      payloadRoot,
      packagePath,
      packageIdentifier:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PACKAGE_IDENTIFIER_V2,
    });
    const fixture: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditFixtureV2 = {
      packageIdentifier: state.packageIdentifier,
      dispose(): void {
        fixtureStatesV2.delete(fixture);
        rmSync(privateRoot.alias, { recursive: true, force: true });
      },
    };
    const handle = Object.freeze(fixture);
    fixtureStatesV2.set(handle, state);
    return handle;
  } catch (error) {
    rmSync(privateRoot.alias, { recursive: true, force: true });
    return failV2(
      "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_BUILD_FAILED",
      "Could not create the private unsigned package fixture root",
      error,
    );
  }
}

function capturePackageEvidenceV2(
  packagePath: string,
  hostIdentityHash: string | null,
): PlatformReleaseBootstrapDarwinLocalPackageTrustAuditTargetEvidenceV2 {
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  let descriptor = -1;
  try {
    const closeOnExec = (fsConstants as unknown as Record<string, number>).O_CLOEXEC ?? 0;
    descriptor = openSync(packagePath, fsConstants.O_RDONLY | closeOnExec | noFollow);
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !before.isFile()
      || before.nlink !== 1n
      || before.size > BigInt(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_PACKAGE_BYTES_V2)
    ) {
      return failV2(
        "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PACKAGE_DRIFT",
        "Unsigned package fixture is not one bounded ordinary file",
      );
    }
    const expectedByteLength = Number(before.size);
    const bytes = Buffer.alloc(expectedByteLength);
    let offset = 0;
    while (offset < expectedByteLength) {
      const bytesRead = readSync(
        descriptor,
        bytes,
        offset,
        expectedByteLength - offset,
        offset,
      );
      if (bytesRead <= 0) {
        return failV2(
          "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PACKAGE_DRIFT",
          "Unsigned package reached EOF before its descriptor-bounded size",
        );
      }
      offset += bytesRead;
    }
    const eofProbe = Buffer.alloc(1);
    if (readSync(descriptor, eofProbe, 0, 1, expectedByteLength) !== 0) {
      return failV2(
        "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PACKAGE_DRIFT",
        "Unsigned package grew beyond its descriptor-bounded size",
      );
    }
    const after = fstatSync(descriptor, { bigint: true });
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs
    ) {
      return failV2(
        "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PACKAGE_DRIFT",
        "Unsigned package changed during descriptor capture",
      );
    }
    const stableIdentity = {
      hostIdentityHash,
      objectKind: "ordinary_file" as const,
      device: before.dev.toString(),
      inode: before.ino.toString(),
    };
    const mutableFingerprint = {
      byteLength: bytes.byteLength,
      contentHash: sha256BytesV2(bytes),
      mode: (Number(before.mode) & 0o7777).toString(8).padStart(4, "0"),
      linkCount: 1 as const,
      ownerUid: Number(before.uid),
      ownerGid: Number(before.gid),
      modifiedNanoseconds: before.mtimeNs.toString(),
      changedNanoseconds: before.ctimeNs.toString(),
    };
    return deepFreezePlatformReleaseJsonV2({
      stableIdentity,
      mutableFingerprint,
      observationHash: hashCanonicalJson({
        schema: TARGET_HASH_DOMAIN_V2,
        stableIdentity,
        mutableFingerprint,
      }),
    });
  } catch (error) {
    return failV2(
      "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PACKAGE_DRIFT",
      "Unsigned package fixture could not be captured through one descriptor",
      error,
    );
  } finally {
    if (descriptor >= 0) closeSync(descriptor);
  }
}

function commandObservationV2(
  invocation: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandInvocationV2,
  result: CommandResultV2,
): PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2 {
  const identity = {
    kind: invocation.kind,
    executable: invocation.executable,
    argvRef: invocation.argvRef,
    argvHash: invocation.argvHash,
    cwdLocator: invocation.cwd,
    environmentPolicy: invocation.environmentPolicy,
    status: result.status,
    exitCode: result.exitCode,
    signal: result.signal,
    stdoutByteLength: result.stdout.byteLength,
    stderrByteLength: result.stderr.byteLength,
    stdoutHash: sha256BytesV2(result.stdout),
    stderrHash: sha256BytesV2(result.stderr),
  } as const;
  return deepFreezePlatformReleaseJsonV2({
    ...identity,
    observationHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit-command-observation-hash.v2",
      ...identity,
    }),
  });
}

function conclusionV2(
  command: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2,
): "accepted" | "nonzero" | "not_observed" | "unavailable" {
  if (command.status !== "exited") return "unavailable";
  return command.exitCode === 0 ? "accepted" : "nonzero";
}

function commandInvocationV2(
  plan: Readonly<{
    kind: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2["kind"];
    executable: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2["executable"];
    argvRef: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2["argvRef"];
    argvHash: string;
    argv: readonly string[];
    cwdLocator: string;
    environmentPolicy: typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_ENVIRONMENT_POLICY_V2;
  }>,
): PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandInvocationV2 {
  return Object.freeze({
    kind: plan.kind,
    executable: plan.executable,
    argvRef: plan.argvRef,
    argvHash: plan.argvHash,
    argv: Object.freeze([...plan.argv]),
    cwd: plan.cwdLocator,
    environmentPolicy: plan.environmentPolicy,
  });
}

export async function observePlatformReleaseBootstrapDarwinLocalPackageTrustAuditForTestV2(
  fixture: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditFixtureV2,
  options: Readonly<{
    challenge?: Uint8Array;
    hostIdentityHash?: string | null;
  }> = {},
): Promise<PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2> {
  if (process.platform !== "darwin") {
    return failV2(
      "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PLATFORM_UNAVAILABLE",
      "The local package trust audit requires Darwin",
    );
  }
  const state = authenticFixtureStateV2(fixture);
  const challenge = options.challenge === undefined
    ? randomBytes(32)
    : Buffer.from(options.challenge);
  if (challenge.byteLength !== 32) {
    return failV2(
      "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PROBE_FAILED",
      "Trust audit challenge must be exactly 32 bytes",
    );
  }
  const hostIdentityHash = options.hostIdentityHash ?? null;
  if (hostIdentityHash !== null && !/^[a-f0-9]{64}$/u.test(hostIdentityHash)) {
    return failV2(
      "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PROBE_FAILED",
      "Trust audit host identity must be one lowercase SHA-256 commitment",
    );
  }
  const buildPlan = expectedPlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandV2({
    kind: "pkgbuild_fixture",
    packageIdentifier: state.packageIdentifier,
    packageLocator: state.packagePath,
    payloadRootLocator: state.payloadRoot,
    fixtureRootLocator: state.root,
  });
  const buildInvocation = commandInvocationV2(buildPlan);
  const buildResult = await exactCommandRunnerV2(buildInvocation);
  if (buildResult.status !== "exited" || buildResult.exitCode !== 0) {
    return failV2(
      "DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_BUILD_FAILED",
      "Private unsigned package builder did not exit successfully",
    );
  }
  const before = capturePackageEvidenceV2(state.packagePath, hostIdentityHash);
  const probePlans = [
    "pkgutil_receipt_before",
    "pkgutil_check_signature",
    "spctl_install_assessment",
    "stapler_validate",
    "pkgutil_receipt_after",
  ] as const;
  const invocations = probePlans.map((kind) => commandInvocationV2(
    expectedPlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandV2({
      kind,
      packageIdentifier: state.packageIdentifier,
      packageLocator: state.packagePath,
      payloadRootLocator: state.payloadRoot,
      fixtureRootLocator: state.root,
    }),
  ));
  const results: CommandResultV2[] = [];
  for (const invocation of invocations) {
    results.push(await exactCommandRunnerV2(invocation));
  }
  // Re-capture after all probes; package path replacement or mutation never gets
  // converted into trust evidence.
  const after = capturePackageEvidenceV2(state.packagePath, hostIdentityHash);
  const fixtureSetup = commandObservationV2(buildInvocation, buildResult);
  const commands = results.map((result, index) => commandObservationV2(invocations[index]!, result)) as [
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2,
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2,
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2,
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2,
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2,
  ];
  const receiptBefore = classifyPlatformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptStateV2(
    commands[0],
    state.packageIdentifier,
  );
  const receiptAfter = classifyPlatformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptStateV2(
    commands[4],
    state.packageIdentifier,
  );
  const packageSignature = conclusionV2(commands[1]);
  const gatekeeperInstallAssessment = conclusionV2(commands[2]);
  const notarization = conclusionV2(commands[3]);
  const blockerCodes = [
    "DEVELOPER_ID_INSTALLER_UNPROVEN",
    "AMFI_RUNTIME_ADMISSION_UNAVAILABLE_REQUIRES_RUNNING_HELPER",
    "COMMAND_TARGET_EXACT_OBJECT_UNPROVEN",
    "NOTARIZATION_INSTALLER_CHAIN_UNPROVEN",
    ...(packageSignature !== "accepted" ? ["PACKAGE_SIGNATURE_NOT_ACCEPTED"] as const : []),
    ...(gatekeeperInstallAssessment !== "accepted" ? ["GATEKEEPER_INSTALL_ASSESSMENT_UNPROVEN"] as const : []),
    ...(notarization !== "accepted" ? ["NOTARIZATION_TICKET_UNPROVEN"] as const : []),
    ...(platformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptChangedDuringAuditV2(
      commands[0],
      commands[4],
      state.packageIdentifier,
    ) ? ["INSTALLER_RECEIPT_CHANGED_DURING_AUDIT"] as const : []),
    ...(receiptBefore === "present" || receiptAfter === "present" ? ["INSTALLER_RECEIPT_PAYLOAD_UNBOUND"] as const : []),
    ...(receiptBefore === "unavailable" || receiptAfter === "unavailable" ? ["INSTALLER_RECEIPT_UNAVAILABLE"] as const : []),
    ...(receiptBefore === "absent" && receiptAfter === "absent" ? ["INSTALLER_RECEIPT_ABSENT"] as const : []),
  ].sort() as Array<
    "AMFI_RUNTIME_ADMISSION_UNAVAILABLE_REQUIRES_RUNNING_HELPER"
    | "COMMAND_TARGET_EXACT_OBJECT_UNPROVEN"
    | "DEVELOPER_ID_INSTALLER_UNPROVEN"
    | "GATEKEEPER_INSTALL_ASSESSMENT_UNPROVEN"
    | "INSTALLER_RECEIPT_ABSENT"
    | "INSTALLER_RECEIPT_CHANGED_DURING_AUDIT"
    | "INSTALLER_RECEIPT_PAYLOAD_UNBOUND"
    | "INSTALLER_RECEIPT_UNAVAILABLE"
    | "NOTARIZATION_INSTALLER_CHAIN_UNPROVEN"
    | "NOTARIZATION_TICKET_UNPROVEN"
    | "PACKAGE_SIGNATURE_NOT_ACCEPTED"
  >;
  const identity = {
    schema:
      "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit.v2" as const,
    version: "2.0.0" as const,
    admissionScope: "test_fixture" as const,
    authorityScope: "diagnostic_observation_only" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    mutationAuthority: false as const,
    fixtureMutationScope: "private_0700_root_setup_only" as const,
    trustConclusion: "characterization_only" as const,
    challengeHash: sha256BytesV2(challenge),
    fixtureRootLocator: state.root,
    payloadRootLocator: state.payloadRoot,
    targetBinding: "pathname_only_unproven" as const,
    packageIdentifier: state.packageIdentifier,
    packageLocator: state.packagePath,
    packageBefore: before,
    packageAfter: after,
    fixtureSetup,
    commands,
    packageSignature: {
      conclusion: packageSignature,
      commandHash: commands[1].observationHash,
    },
    gatekeeperInstallAssessment: {
      conclusion: gatekeeperInstallAssessment,
      commandHash: commands[2].observationHash,
    },
    gatekeeperAssessmentSideEffect: "ignore_and_no_cache_controls_applied_v2" as const,
    notarization: {
      conclusion: notarization,
      commandHash: commands[3].observationHash,
    },
    installerReceipt: {
      before: receiptBefore,
      after: receiptAfter,
      beforeCommandHash: commands[0].observationHash,
      afterCommandHash: commands[4].observationHash,
    },
    amfiRuntimeAdmission: {
      conclusion: "not_evaluated" as const,
      reason: "requires_authenticated_running_helper" as const,
    },
    blockerCodes,
  } as const;
  return parsePlatformReleaseBootstrapDarwinLocalPackageTrustAuditCandidateV2({
    ...identity,
    auditHash: hashCanonicalJson({
      schema: AUDIT_HASH_DOMAIN_V2,
      audit: identity,
    }),
  });
}

export function canonicalizePlatformReleaseBootstrapDarwinLocalPackageTrustAuditForTestV2(
  audit: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2,
): string {
  return canonicalJsonStringify(audit);
}
