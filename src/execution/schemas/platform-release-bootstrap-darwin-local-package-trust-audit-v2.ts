import { createHash } from "node:crypto";
import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  deepFreezePlatformReleaseJsonV2,
  PlatformReleaseAbsoluteLocatorV2Schema,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_CANONICAL_BYTES_V2 =
  256 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_PACKAGE_BYTES_V2 =
  64 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_OUTPUT_BYTES_V2 =
  64 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PACKAGE_IDENTIFIER_V2 =
  "com.setfarm.platform-release-bootstrap.audit.unsigned-v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PACKAGE_LOCATOR_V2 =
  "/private/var/folders/setfarm-darwin-local-package-trust-audit-v2/unsigned.pkg" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_ENVIRONMENT_POLICY_V2 =
  "home_empty_c_locale_fixed_path_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_TARGET_BINDING_V2 =
  "pathname_only_unproven" as const;

const CanonicalDecimalV2Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/u);

const CanonicalModeV2Schema = z.string().regex(/^[0-7]{4}$/u);

function sha256Utf8V2(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const TargetStableIdentityV2Schema = z.object({
  hostIdentityHash: Sha256Schema.nullable(),
  objectKind: z.literal("ordinary_file"),
  device: CanonicalDecimalV2Schema,
  inode: CanonicalDecimalV2Schema,
}).strict();

const TargetMutableFingerprintV2Schema = z.object({
  byteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_PACKAGE_BYTES_V2),
  contentHash: Sha256Schema,
  mode: CanonicalModeV2Schema,
  linkCount: z.literal(1),
  ownerUid: z.number().int().nonnegative().safe(),
  ownerGid: z.number().int().nonnegative().safe(),
  modifiedNanoseconds: CanonicalDecimalV2Schema,
  changedNanoseconds: CanonicalDecimalV2Schema,
}).strict();

export const PlatformReleaseBootstrapDarwinLocalPackageTrustAuditTargetEvidenceV2Schema =
  z.object({
    stableIdentity: TargetStableIdentityV2Schema,
    mutableFingerprint: TargetMutableFingerprintV2Schema,
    observationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expected = hashCanonicalJson({
      schema:
        "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit-target-observation-hash.v2",
      stableIdentity: value.stableIdentity,
      mutableFingerprint: value.mutableFingerprint,
    });
    if (value.observationHash !== expected) {
      context.addIssue({
        code: "custom",
        path: ["observationHash"],
        message: "Package target observation hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapDarwinLocalPackageTrustAuditTargetEvidenceV2 =
  z.infer<
    typeof PlatformReleaseBootstrapDarwinLocalPackageTrustAuditTargetEvidenceV2Schema
  >;

const CommandKindV2Schema = z.enum([
  "pkgbuild_fixture",
  "pkgutil_receipt_before",
  "pkgutil_check_signature",
  "spctl_install_assessment",
  "stapler_validate",
  "pkgutil_receipt_after",
]);

const CommandStatusV2Schema = z.enum([
  "exited",
  "spawn_failed",
  "timed_out",
  "output_limit_exceeded",
]);

const CommandArgvRefV2Schema = z.enum([
  "PKGBUILD_UNSIGNED_FIXED_V2",
  "PKGUTIL_RECEIPT_BEFORE_FIXED_V2",
  "PKGUTIL_CHECK_SIGNATURE_FIXED_V2",
  "SPCTL_INSTALL_ASSESSMENT_FIXED_V2",
  "STAPLER_VALIDATE_FIXED_V2",
  "PKGUTIL_RECEIPT_AFTER_FIXED_V2",
]);

const CommandExecutableV2Schema = z.enum([
  "/usr/bin/pkgbuild",
  "/usr/sbin/pkgutil",
  "/usr/sbin/spctl",
  "/usr/bin/xcrun",
]);

type CommandKindV2 = z.infer<typeof CommandKindV2Schema>;
type CommandArgvRefV2 = z.infer<typeof CommandArgvRefV2Schema>;
type CommandExecutableV2 = z.infer<typeof CommandExecutableV2Schema>;

const COMMAND_EXECUTABLE_BY_KIND_V2: Readonly<Record<CommandKindV2, CommandExecutableV2>> = {
  pkgbuild_fixture: "/usr/bin/pkgbuild",
  pkgutil_receipt_before: "/usr/sbin/pkgutil",
  pkgutil_check_signature: "/usr/sbin/pkgutil",
  spctl_install_assessment: "/usr/sbin/spctl",
  stapler_validate: "/usr/bin/xcrun",
  pkgutil_receipt_after: "/usr/sbin/pkgutil",
};

const COMMAND_ARGV_REF_BY_KIND_V2: Readonly<Record<CommandKindV2, CommandArgvRefV2>> = {
  pkgbuild_fixture: "PKGBUILD_UNSIGNED_FIXED_V2",
  pkgutil_receipt_before: "PKGUTIL_RECEIPT_BEFORE_FIXED_V2",
  pkgutil_check_signature: "PKGUTIL_CHECK_SIGNATURE_FIXED_V2",
  spctl_install_assessment: "SPCTL_INSTALL_ASSESSMENT_FIXED_V2",
  stapler_validate: "STAPLER_VALIDATE_FIXED_V2",
  pkgutil_receipt_after: "PKGUTIL_RECEIPT_AFTER_FIXED_V2",
};

export function expectedPlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandV2(
  input: Readonly<{
    kind: CommandKindV2;
    packageIdentifier: string;
    packageLocator: string;
    payloadRootLocator: string;
    fixtureRootLocator: string;
  }>,
): Readonly<{
  kind: CommandKindV2;
  executable: CommandExecutableV2;
  argvRef: CommandArgvRefV2;
  argv: readonly string[];
  cwdLocator: string;
  environmentPolicy: typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_ENVIRONMENT_POLICY_V2;
  argvHash: string;
}> {
  const executable = COMMAND_EXECUTABLE_BY_KIND_V2[input.kind];
  const argvRef = COMMAND_ARGV_REF_BY_KIND_V2[input.kind];
  const argv = input.kind === "pkgbuild_fixture"
    ? [
        "--root",
        input.payloadRootLocator,
        "--identifier",
        input.packageIdentifier,
        "--version",
        "1.0.0",
        "--install-location",
        "/Library/Application Support/Setfarm/Audit",
        input.packageLocator,
      ]
    : input.kind === "pkgutil_receipt_before" || input.kind === "pkgutil_receipt_after"
      ? ["--volume", "/", "--pkg-info-plist", input.packageIdentifier]
      : input.kind === "pkgutil_check_signature"
        ? ["--check-signature", input.packageLocator]
        : input.kind === "spctl_install_assessment"
          ? ["--assess", "--type", "install", "--raw", "--ignore-cache", "--no-cache", "--verbose=4", input.packageLocator]
          : ["stapler", "validate", "-q", input.packageLocator];
  const environmentPolicy =
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_ENVIRONMENT_POLICY_V2;
  return Object.freeze({
    kind: input.kind,
    executable,
    argvRef,
    argv: Object.freeze(argv),
    cwdLocator: input.fixtureRootLocator,
    environmentPolicy,
    argvHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit-command-argv.v2",
      kind: input.kind,
      executable,
      argvRef,
      argv,
      cwdLocator: input.fixtureRootLocator,
      environmentPolicy,
    }),
  });
}

export const PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2Schema =
  z.object({
    kind: CommandKindV2Schema,
    executable: CommandExecutableV2Schema,
    argvRef: CommandArgvRefV2Schema,
    argvHash: Sha256Schema,
    cwdLocator: PlatformReleaseAbsoluteLocatorV2Schema,
    environmentPolicy: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_ENVIRONMENT_POLICY_V2,
    ),
    status: CommandStatusV2Schema,
    exitCode: z.number().int().safe().nullable(),
    signal: z.string().regex(/^[A-Z0-9]+$/u).nullable(),
    stdoutByteLength: z.number().int().nonnegative().safe()
      .max(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_OUTPUT_BYTES_V2),
    stderrByteLength: z.number().int().nonnegative().safe()
      .max(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_OUTPUT_BYTES_V2),
    stdoutHash: Sha256Schema,
    stderrHash: Sha256Schema,
    observationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.status === "exited" && value.exitCode === null) {
      context.addIssue({
        code: "custom",
        path: ["exitCode"],
        message: "Exited command must carry an exit code",
      });
    }
    if (value.status !== "exited" && value.exitCode !== null) {
      context.addIssue({
        code: "custom",
        path: ["exitCode"],
        message: "Non-exited command cannot carry an exit code",
      });
    }
    const expected = hashCanonicalJson({
      schema:
        "setfarm.platform-release-bootstrap-darwin-local-package-trust-audit-command-observation-hash.v2",
      kind: value.kind,
      executable: value.executable,
      argvRef: value.argvRef,
      argvHash: value.argvHash,
      cwdLocator: value.cwdLocator,
      environmentPolicy: value.environmentPolicy,
      status: value.status,
      exitCode: value.exitCode,
      signal: value.signal,
      stdoutByteLength: value.stdoutByteLength,
      stderrByteLength: value.stderrByteLength,
      stdoutHash: value.stdoutHash,
      stderrHash: value.stderrHash,
    });
    if (value.observationHash !== expected) {
      context.addIssue({
        code: "custom",
        path: ["observationHash"],
        message: "Command observation hash mismatch",
      });
    }
    if (
      value.executable !== COMMAND_EXECUTABLE_BY_KIND_V2[value.kind]
      || value.argvRef !== COMMAND_ARGV_REF_BY_KIND_V2[value.kind]
    ) {
      context.addIssue({
        code: "custom",
        path: ["argvRef"],
        message: "Command argv reference does not match its command kind",
      });
    }
  });

export type PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2 =
  z.infer<
    typeof PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2Schema
  >;

const ProbeConclusionV2Schema = z.enum([
  "accepted",
  "nonzero",
  "not_observed",
  "unavailable",
]);

const ReceiptStateV2Schema = z.enum([
  "absent",
  "present",
  "unavailable",
]);

export type PlatformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptStateV2 =
  z.infer<typeof ReceiptStateV2Schema>;

export function classifyPlatformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptStateV2(
  command: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2,
  packageIdentifier: string,
): PlatformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptStateV2 {
  if (command.status !== "exited" || command.exitCode === null) return "unavailable";
  if (command.exitCode === 0) return "present";
  const expectedAbsenceDiagnostic = `No receipt for '${packageIdentifier}' found at '/'.\n`;
  return command.exitCode === 1
    && command.stdoutByteLength === 0
    && command.stdoutHash === sha256Utf8V2("")
    && command.stderrByteLength === Buffer.byteLength(expectedAbsenceDiagnostic, "utf8")
    && command.stderrHash === sha256Utf8V2(expectedAbsenceDiagnostic)
    ? "absent"
    : "unavailable";
}

function receiptCommandOutputFingerprintEqualV2(
  before: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2,
  after: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2,
): boolean {
  return before.status === after.status
    && before.exitCode === after.exitCode
    && before.signal === after.signal
    && before.stdoutByteLength === after.stdoutByteLength
    && before.stdoutHash === after.stdoutHash
    && before.stderrByteLength === after.stderrByteLength
    && before.stderrHash === after.stderrHash;
}

export function platformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptChangedDuringAuditV2(
  before: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2,
  after: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2,
  packageIdentifier: string,
): boolean {
  const beforeState = classifyPlatformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptStateV2(
    before,
    packageIdentifier,
  );
  const afterState = classifyPlatformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptStateV2(
    after,
    packageIdentifier,
  );
  return beforeState !== afterState
    || (beforeState === "present"
      && afterState === "present"
      && !receiptCommandOutputFingerprintEqualV2(before, after));
}

const AuditBlockerCodeV2Schema = z.enum([
  "PACKAGE_SIGNATURE_NOT_ACCEPTED",
  "NOTARIZATION_TICKET_UNPROVEN",
  "GATEKEEPER_INSTALL_ASSESSMENT_UNPROVEN",
  "AMFI_RUNTIME_ADMISSION_UNAVAILABLE_REQUIRES_RUNNING_HELPER",
  "INSTALLER_RECEIPT_ABSENT",
  "INSTALLER_RECEIPT_UNAVAILABLE",
  "INSTALLER_RECEIPT_PAYLOAD_UNBOUND",
  "INSTALLER_RECEIPT_CHANGED_DURING_AUDIT",
  "DEVELOPER_ID_INSTALLER_UNPROVEN",
  "COMMAND_TARGET_EXACT_OBJECT_UNPROVEN",
  "NOTARIZATION_INSTALLER_CHAIN_UNPROVEN",
]);

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_BLOCKER_CODES_V2 =
  Object.freeze([
    "PACKAGE_SIGNATURE_NOT_ACCEPTED",
    "NOTARIZATION_TICKET_UNPROVEN",
    "GATEKEEPER_INSTALL_ASSESSMENT_UNPROVEN",
    "AMFI_RUNTIME_ADMISSION_UNAVAILABLE_REQUIRES_RUNNING_HELPER",
    "INSTALLER_RECEIPT_ABSENT",
    "INSTALLER_RECEIPT_UNAVAILABLE",
    "INSTALLER_RECEIPT_PAYLOAD_UNBOUND",
    "INSTALLER_RECEIPT_CHANGED_DURING_AUDIT",
    "DEVELOPER_ID_INSTALLER_UNPROVEN",
    "COMMAND_TARGET_EXACT_OBJECT_UNPROVEN",
    "NOTARIZATION_INSTALLER_CHAIN_UNPROVEN",
  ] as const);

const AuditIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  admissionScope: z.literal("test_fixture"),
  authorityScope: z.literal("diagnostic_observation_only"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  fixtureMutationScope: z.literal("private_0700_root_setup_only"),
  trustConclusion: z.literal("characterization_only"),
  challengeHash: Sha256Schema,
  fixtureRootLocator: PlatformReleaseAbsoluteLocatorV2Schema,
  payloadRootLocator: PlatformReleaseAbsoluteLocatorV2Schema,
  targetBinding: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_TARGET_BINDING_V2,
  ),
  packageIdentifier: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_PACKAGE_IDENTIFIER_V2,
  ),
  packageLocator: PlatformReleaseAbsoluteLocatorV2Schema,
  packageBefore:
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditTargetEvidenceV2Schema,
  packageAfter:
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditTargetEvidenceV2Schema,
  fixtureSetup:
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2Schema,
  commands: z.tuple([
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2Schema,
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2Schema,
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2Schema,
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2Schema,
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2Schema,
  ]),
  packageSignature: z.object({
    conclusion: ProbeConclusionV2Schema,
    commandHash: Sha256Schema,
  }).strict(),
  gatekeeperInstallAssessment: z.object({
    conclusion: ProbeConclusionV2Schema,
    commandHash: Sha256Schema,
  }).strict(),
  gatekeeperAssessmentSideEffect: z.literal("ignore_and_no_cache_controls_applied_v2"),
  notarization: z.object({
    conclusion: ProbeConclusionV2Schema,
    commandHash: Sha256Schema,
  }).strict(),
  installerReceipt: z.object({
    before: ReceiptStateV2Schema,
    after: ReceiptStateV2Schema,
    beforeCommandHash: Sha256Schema,
    afterCommandHash: Sha256Schema,
  }).strict(),
  amfiRuntimeAdmission: z.object({
    conclusion: z.literal("not_evaluated"),
    reason: z.literal("requires_authenticated_running_helper"),
  }).strict(),
  blockerCodes: z.array(AuditBlockerCodeV2Schema).min(1).max(16),
}).strict().superRefine((value, context) => {
  const commands = value.commands;
  if (value.fixtureSetup.status !== "exited" || value.fixtureSetup.exitCode !== 0) {
    context.addIssue({
      code: "custom",
      path: ["fixtureSetup"],
      message: "Private package setup must settle successfully before read-only probes",
    });
  }
  if (
    value.packageBefore.observationHash !== value.packageAfter.observationHash
    || value.packageBefore.stableIdentity.hostIdentityHash
      !== value.packageAfter.stableIdentity.hostIdentityHash
    || value.packageBefore.stableIdentity.device
      !== value.packageAfter.stableIdentity.device
    || value.packageBefore.stableIdentity.inode
      !== value.packageAfter.stableIdentity.inode
  ) {
    context.addIssue({
      code: "custom",
      path: ["packageAfter"],
      message: "Package changed during the read-only trust audit",
    });
  }
  const expectedCommandInputs = [
    { kind: "pkgutil_receipt_before" as const },
    { kind: "pkgutil_check_signature" as const },
    { kind: "spctl_install_assessment" as const },
    { kind: "stapler_validate" as const },
    { kind: "pkgutil_receipt_after" as const },
  ];
  const commandInputs = expectedCommandInputs.map((entry) =>
    expectedPlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandV2({
      kind: entry.kind,
      packageIdentifier: value.packageIdentifier,
      packageLocator: value.packageLocator,
      payloadRootLocator: value.payloadRootLocator,
      fixtureRootLocator: value.fixtureRootLocator,
    }),
  );
  const setupInput = expectedPlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandV2({
    kind: "pkgbuild_fixture",
    packageIdentifier: value.packageIdentifier,
    packageLocator: value.packageLocator,
    payloadRootLocator: value.payloadRootLocator,
    fixtureRootLocator: value.fixtureRootLocator,
  });
  const observedCommands = [value.fixtureSetup, ...commands];
  const expectedCommands = [setupInput, ...commandInputs];
  for (let index = 0; index < expectedCommands.length; index += 1) {
    const observed = observedCommands[index]!;
    const expected = expectedCommands[index]!;
    if (
      observed.executable !== expected.executable
      || observed.argvRef !== expected.argvRef
      || observed.argvHash !== expected.argvHash
      || observed.cwdLocator !== expected.cwdLocator
      || observed.environmentPolicy !== expected.environmentPolicy
    ) {
      context.addIssue({
        code: "custom",
        path: [index === 0 ? "fixtureSetup" : "commands"],
        message: "Trust audit command does not match its code-owned argv plan",
      });
    }
  }
  const commandHashBindings: ReadonlyArray<readonly [string, string]> = [
    [value.packageSignature.commandHash, commands[1].observationHash],
    [value.gatekeeperInstallAssessment.commandHash, commands[2].observationHash],
    [value.notarization.commandHash, commands[3].observationHash],
    [value.installerReceipt.beforeCommandHash, commands[0].observationHash],
    [value.installerReceipt.afterCommandHash, commands[4].observationHash],
  ];
  for (const [claimed, observed] of commandHashBindings) {
    if (claimed !== observed) {
      context.addIssue({
        code: "custom",
        path: ["commands"],
        message: "Trust conclusion must bind the exact command observation hash",
      });
      break;
    }
  }
  const conclusionFromCommand = (
    command: PlatformReleaseBootstrapDarwinLocalPackageTrustAuditCommandObservationV2,
  ): "accepted" | "nonzero" | "unavailable" => {
    if (command.status !== "exited" || command.exitCode === null) return "unavailable";
    return command.exitCode === 0 ? "accepted" : "nonzero";
  };
  const expectedPackageSignature = conclusionFromCommand(commands[1]);
  const expectedGatekeeper = conclusionFromCommand(commands[2]);
  const expectedNotarization = conclusionFromCommand(commands[3]);
  if (value.packageSignature.conclusion !== expectedPackageSignature) {
    context.addIssue({ code: "custom", path: ["packageSignature"], message: "Package signature conclusion is not derived from its command" });
  }
  if (value.gatekeeperInstallAssessment.conclusion !== expectedGatekeeper) {
    context.addIssue({ code: "custom", path: ["gatekeeperInstallAssessment"], message: "Gatekeeper conclusion is not derived from its command" });
  }
  if (value.notarization.conclusion !== expectedNotarization) {
    context.addIssue({ code: "custom", path: ["notarization"], message: "Notarization conclusion is not derived from its command" });
  }
  const expectedReceiptBefore = classifyPlatformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptStateV2(
    commands[0],
    value.packageIdentifier,
  );
  const expectedReceiptAfter = classifyPlatformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptStateV2(
    commands[4],
    value.packageIdentifier,
  );
  if (value.installerReceipt.before !== expectedReceiptBefore || value.installerReceipt.after !== expectedReceiptAfter) {
    context.addIssue({ code: "custom", path: ["installerReceipt"], message: "Installer receipt state is not derived from the exact pkgutil absence diagnostic" });
  }
  const expectedBlockers = new Set<z.infer<typeof AuditBlockerCodeV2Schema>>([
    "DEVELOPER_ID_INSTALLER_UNPROVEN",
    "AMFI_RUNTIME_ADMISSION_UNAVAILABLE_REQUIRES_RUNNING_HELPER",
    "COMMAND_TARGET_EXACT_OBJECT_UNPROVEN",
    "NOTARIZATION_INSTALLER_CHAIN_UNPROVEN",
  ]);
  if (expectedPackageSignature !== "accepted") expectedBlockers.add("PACKAGE_SIGNATURE_NOT_ACCEPTED");
  if (expectedGatekeeper !== "accepted") expectedBlockers.add("GATEKEEPER_INSTALL_ASSESSMENT_UNPROVEN");
  if (expectedNotarization !== "accepted") expectedBlockers.add("NOTARIZATION_TICKET_UNPROVEN");
  if (platformReleaseBootstrapDarwinLocalPackageTrustAuditReceiptChangedDuringAuditV2(
    commands[0],
    commands[4],
    value.packageIdentifier,
  )) {
    expectedBlockers.add("INSTALLER_RECEIPT_CHANGED_DURING_AUDIT");
  }
  if (expectedReceiptBefore === "present" || expectedReceiptAfter === "present") {
    expectedBlockers.add("INSTALLER_RECEIPT_PAYLOAD_UNBOUND");
  }
  if (expectedReceiptBefore === "unavailable" || expectedReceiptAfter === "unavailable") {
    expectedBlockers.add("INSTALLER_RECEIPT_UNAVAILABLE");
  }
  if (expectedReceiptBefore === "absent" && expectedReceiptAfter === "absent") {
    expectedBlockers.add("INSTALLER_RECEIPT_ABSENT");
  }
  const expectedBlockerList = [...expectedBlockers].sort();
  if (JSON.stringify(value.blockerCodes) !== JSON.stringify(expectedBlockerList)) {
    context.addIssue({ code: "custom", path: ["blockerCodes"], message: "Trust audit blocker set is not the deterministic projection of command observations" });
  }
  if (value.fixtureSetup.kind !== "pkgbuild_fixture") {
    context.addIssue({
      code: "custom",
      path: ["fixtureSetup"],
      message: "Fixture setup must be the private pkgbuild command",
    });
  }
  const expectedKinds = [
    "pkgutil_receipt_before",
    "pkgutil_check_signature",
    "spctl_install_assessment",
    "stapler_validate",
    "pkgutil_receipt_after",
  ];
  const actualKinds = commands.map((command) => command.kind);
  if (actualKinds.some((kind, index) => kind !== expectedKinds[index])) {
    context.addIssue({
      code: "custom",
      path: ["commands"],
      message: "Trust audit commands must follow the fixed code-owned order",
    });
  }
  const uniqueBlockers = new Set(value.blockerCodes);
  if (uniqueBlockers.size !== value.blockerCodes.length) {
    context.addIssue({
      code: "custom",
      path: ["blockerCodes"],
      message: "Trust audit blocker codes must be unique",
    });
  }
  for (let index = 1; index < value.blockerCodes.length; index += 1) {
    if (value.blockerCodes[index - 1]! >= value.blockerCodes[index]!) {
      context.addIssue({
        code: "custom",
        path: ["blockerCodes"],
        message: "Trust audit blocker codes must be canonical sorted order",
      });
      break;
    }
  }
});

export function hashPlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2(
  value: z.infer<typeof AuditIdentityV2Schema>,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_HASH_V2_SCHEMA,
    audit: value,
  });
}

export const PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema =
  AuditIdentityV2Schema.extend({
    auditHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_LOCAL_PACKAGE_TRUST_AUDIT_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Trust audit exceeds its bounded canonical byte cap",
      });
    }
    const { auditHash: _auditHash, ...identity } = value;
    if (value.auditHash !== hashPlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2(identity)) {
      context.addIssue({
        code: "custom",
        path: ["auditHash"],
        message: "Trust audit hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2 = z.infer<
  typeof PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema
>;

export function parsePlatformReleaseBootstrapDarwinLocalPackageTrustAuditCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapDarwinLocalPackageTrustAuditV2Schema.parse(input),
  );
}
