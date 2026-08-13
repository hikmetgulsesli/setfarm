import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";
import {
  PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2,
  PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_MAX_CANONICAL_BYTES_V2,
  PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2,
  PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_V2_SCHEMA,
  canonicalPlatformReleaseProductionAdmissionReadinessV2,
  parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2,
  type PlatformReleaseProductionAdmissionReadinessV2,
} from "../../src/execution/schemas/platform-release-production-admission-readiness-v2.js";
import {
  observePlatformReleaseProductionAdmissionReadinessV2,
} from "../../src/execution/platform-release-production-admission-readiness-v2.js";
import {
  observePlatformReleaseProductionAdmissionReadinessForTestV2,
} from "../../src/product-compiler/platform-release-production-admission-readiness-test-support-v2.js";
import {
  PLATFORM_RELEASE_HOST_VERIFIER_EXECUTABLE_LOCATOR_V2,
  PLATFORM_RELEASE_HOST_VERIFIER_ROOT_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";

const POLICY = Object.freeze({
  supportedPlatform: "darwin",
  commandTimeoutMs: 5_000,
  channelByteCap: 32 * 1024,
  canonicalReceiptByteCap: 64 * 1024,
  redactedProjectionByteCap: 4_096,
  maxCommandObservations: 16,
  maxBlockerCodes: 32,
  maxIdentityCountPerClass: 128,
  environment: Object.freeze({
    LC_ALL: "C",
    LANG: "C",
    HOME: "/var/empty",
    PATH: "/usr/bin:/usr/sbin:/bin:/sbin",
  }),
  knownNotaryProfileServices: Object.freeze([
    "com.apple.gke.notary.tool",
    "com.apple.notarytool",
    "notarytool",
  ] as const),
  blockerOrder: Object.freeze([
    "PLATFORM_UNSUPPORTED",
    "DEVELOPER_ID_APPLICATION_IDENTITY_NOT_OBSERVED",
    "DEVELOPER_ID_INSTALLER_IDENTITY_NOT_OBSERVED",
    "CODE_SIGNING_IDENTITY_OBSERVATION_FAILED",
    "DEVELOPER_ID_TEAM_UNCONFIGURED",
    "DESIGNATED_REQUIREMENT_UNCONFIGURED",
    "INSTALLER_PACKAGE_ID_UNCONFIGURED",
    "OFFLINE_RELEASE_PUBLIC_KEY_UNCONFIGURED",
    "SIGNED_NATIVE_DISTRIBUTION_CATALOG_EMPTY",
    "NOTARYTOOL_UNAVAILABLE",
    "NOTARYTOOL_OBSERVATION_FAILED",
    "NOTARY_CREDENTIAL_CONFIGURATION_UNVERIFIABLE",
    "NOTARIZED_DISTRIBUTION_UNPROVEN",
    "GATEKEEPER_DISABLED",
    "GATEKEEPER_OBSERVATION_FAILED",
    "SIP_DISABLED",
    "SIP_OBSERVATION_FAILED",
    "AUTHENTICATED_ROOT_DISABLED_OR_UNAVAILABLE",
    "AMFI_SERVICE_UNAVAILABLE",
    "AUTHENTICATED_RUNNING_HELPER_ABSENT",
    "AMFI_RUNTIME_ADMISSION_UNPROVEN",
    "INSTALLER_RECEIPT_UNOBSERVED_CONFIGURATION_UNAVAILABLE",
    "INSTALLED_SETFARM_ROOT_ABSENT",
    "INSTALLED_HELPER_ABSENT",
    "EXACT_INSTALLED_PAYLOAD_BINDING_UNPROVEN",
    "PRODUCTION_TRUST_CONFIGURATION_UNAVAILABLE",
    "V2_PLATFORM_RELEASE_MANIFEST_AUTHORITY_UNAVAILABLE",
    "PREPARED_RELEASE_STORE_AUTHORITY_UNAVAILABLE",
    "FRESH_VERIFIER_AUTHORITY_UNAVAILABLE",
    "REGISTRY_V2_ACTIVATION_AUTHORITY_UNAVAILABLE",
    "HOST_OBSERVATION_INCOMPLETE",
  ] as const),
  commandPlan: Object.freeze([
    Object.freeze({ commandLabel: "developer_id_application", commandRef: "SECURITY_FIND_IDENTITY_CODESIGNING_V2", execution: "subprocess", executable: "/usr/bin/security", argv: Object.freeze(["find-identity", "-v", "-p", "codesigning"]), kind: "developer_id_application_identity", executableRef: "SECURITY", argvRef: "SECURITY_FIND_IDENTITY_CODESIGNING", result: Object.freeze({ kind: "identity_count", identityClass: "developer_id_application" }) }),
    Object.freeze({ commandLabel: "developer_id_installer", commandRef: "SECURITY_FIND_IDENTITY_BASIC_V2", execution: "subprocess", executable: "/usr/bin/security", argv: Object.freeze(["find-identity", "-v", "-p", "basic"]), kind: "developer_id_installer_identity", executableRef: "SECURITY", argvRef: "SECURITY_FIND_IDENTITY_BASIC", result: Object.freeze({ kind: "identity_count", identityClass: "developer_id_installer" }) }),
    Object.freeze({ commandLabel: "gatekeeper_status", commandRef: "SPCTL_STATUS_V2", execution: "subprocess", executable: "/usr/sbin/spctl", argv: Object.freeze(["--status"]), kind: "gatekeeper_status", executableRef: "SPCTL", argvRef: "SPCTL_STATUS", result: Object.freeze({ kind: "gatekeeper" }) }),
    Object.freeze({ commandLabel: "sip_status", commandRef: "CSRUTIL_STATUS_V2", execution: "subprocess", executable: "/usr/bin/csrutil", argv: Object.freeze(["status"]), kind: "sip_status", executableRef: "CSRUTIL", argvRef: "CSRUTIL_STATUS", result: Object.freeze({ kind: "sip" }) }),
    Object.freeze({ commandLabel: "authenticated_root_status", commandRef: "CSRUTIL_AUTHENTICATED_ROOT_STATUS_V2", execution: "subprocess", executable: "/usr/bin/csrutil", argv: Object.freeze(["authenticated-root", "status"]), kind: "authenticated_root_status", executableRef: "CSRUTIL", argvRef: "CSRUTIL_AUTHENTICATED_ROOT_STATUS", result: Object.freeze({ kind: "authenticated_root" }) }),
    Object.freeze({ commandLabel: "amfi_service", commandRef: "LAUNCHCTL_AMFI_SERVICE_V2", execution: "subprocess", executable: "/bin/launchctl", argv: Object.freeze(["print", "system/com.apple.MobileFileIntegrity"]), kind: "amfi_service_status", executableRef: "LAUNCHCTL", argvRef: "LAUNCHCTL_PRINT_AMFI", result: Object.freeze({ kind: "amfi_service" }) }),
    Object.freeze({ commandLabel: "notarytool_resolution", commandRef: "XCRUN_FIND_NOTARYTOOL_V2", execution: "subprocess", executable: "/usr/bin/xcrun", argv: Object.freeze(["--find", "notarytool"]), kind: "tool_availability", executableRef: "NOTARYTOOL", argvRef: "NOTARYTOOL_AVAILABILITY", result: Object.freeze({ kind: "tool_availability", tool: "notarytool", fixedPathRef: "NOTARYTOOL_RESOLVED_TOOL" }) }),
    Object.freeze({ commandLabel: "stapler_resolution", commandRef: "XCRUN_FIND_STAPLER_V2", execution: "subprocess", executable: "/usr/bin/xcrun", argv: Object.freeze(["--find", "stapler"]), kind: "tool_availability", executableRef: "STAPLER", argvRef: "STAPLER_AVAILABILITY", result: Object.freeze({ kind: "tool_availability", tool: "stapler", fixedPathRef: "STAPLER_RESOLVED_TOOL" }) }),
    Object.freeze({ commandLabel: "notary_profile_service_1", commandRef: "SECURITY_FIND_GENERIC_PASSWORD_SERVICE_1_V2", execution: "subprocess", executable: "/usr/bin/security", argv: Object.freeze(["find-generic-password", "-s", "com.apple.gke.notary.tool"]), kind: "notary_profile_metadata", executableRef: "SECURITY", argvRef: "SECURITY_FIND_GENERIC_PASSWORD_GKE_NOTARY_TOOL", result: Object.freeze({ kind: "notary_profile_metadata", serviceRef: "GKE_NOTARY_TOOL" }) }),
    Object.freeze({ commandLabel: "notary_profile_service_2", commandRef: "SECURITY_FIND_GENERIC_PASSWORD_SERVICE_2_V2", execution: "subprocess", executable: "/usr/bin/security", argv: Object.freeze(["find-generic-password", "-s", "com.apple.notarytool"]), kind: "notary_profile_metadata", executableRef: "SECURITY", argvRef: "SECURITY_FIND_GENERIC_PASSWORD_NOTARYTOOL", result: Object.freeze({ kind: "notary_profile_metadata", serviceRef: "APPLE_NOTARYTOOL" }) }),
    Object.freeze({ commandLabel: "notary_profile_service_3", commandRef: "SECURITY_FIND_GENERIC_PASSWORD_SERVICE_3_V2", execution: "subprocess", executable: "/usr/bin/security", argv: Object.freeze(["find-generic-password", "-s", "notarytool"]), kind: "notary_profile_metadata", executableRef: "SECURITY", argvRef: "SECURITY_FIND_GENERIC_PASSWORD_NOTARY_TOOL", result: Object.freeze({ kind: "notary_profile_metadata", serviceRef: "NOTARYTOOL" }) }),
    Object.freeze({ commandLabel: "codesign_availability", commandRef: "CODESIGN_AVAILABILITY_V2", execution: "fixed_path", argv: Object.freeze([]), kind: "tool_availability", executableRef: "CODESIGN", argvRef: "CODESIGN_AVAILABILITY", result: Object.freeze({ kind: "tool_availability", tool: "codesign", fixedPathRef: "CODESIGN_TOOL" }) }),
    Object.freeze({ commandLabel: "spctl_availability", commandRef: "SPCTL_AVAILABILITY_V2", execution: "fixed_path", argv: Object.freeze([]), kind: "tool_availability", executableRef: "SPCTL", argvRef: "SPCTL_AVAILABILITY", result: Object.freeze({ kind: "tool_availability", tool: "spctl", fixedPathRef: "SPCTL_TOOL" }) }),
    Object.freeze({ commandLabel: "pkgutil_availability", commandRef: "PKGUTIL_AVAILABILITY_V2", execution: "fixed_path", argv: Object.freeze([]), kind: "tool_availability", executableRef: "PKGUTIL", argvRef: "PKGUTIL_AVAILABILITY", result: Object.freeze({ kind: "tool_availability", tool: "pkgutil", fixedPathRef: "PKGUTIL_TOOL" }) }),
    Object.freeze({ commandLabel: "security_availability", commandRef: "SECURITY_AVAILABILITY_V2", execution: "fixed_path", argv: Object.freeze([]), kind: "tool_availability", executableRef: "SECURITY", argvRef: "SECURITY_AVAILABILITY", result: Object.freeze({ kind: "tool_availability", tool: "security", fixedPathRef: "SECURITY_TOOL" }) }),
  ] as const),
  fixedPathPlan: Object.freeze([
    Object.freeze({ ref: "INSTALLED_SETFARM_ROOT", role: "installed_root", expectedKind: "directory", target: Object.freeze({ kind: "absolute", value: "/Library/Application Support/Setfarm/bootstrap/host-composition-verifier-v2" }) }),
    Object.freeze({ ref: "AUTHENTICATED_SETFARM_HELPER", role: "installed_helper", expectedKind: "executable_file", target: Object.freeze({ kind: "absolute", value: "/Library/Application Support/Setfarm/bootstrap/host-composition-verifier-v2/bin/setfarm-host-composition-verifier-v2" }) }),
    Object.freeze({ ref: "CODESIGN_TOOL", role: "fixed_tool", expectedKind: "executable_file", target: Object.freeze({ kind: "absolute", value: "/usr/bin/codesign" }) }),
    Object.freeze({ ref: "SPCTL_TOOL", role: "fixed_tool", expectedKind: "executable_file", target: Object.freeze({ kind: "absolute", value: "/usr/sbin/spctl" }) }),
    Object.freeze({ ref: "PKGUTIL_TOOL", role: "fixed_tool", expectedKind: "executable_file", target: Object.freeze({ kind: "absolute", value: "/usr/sbin/pkgutil" }) }),
    Object.freeze({ ref: "SECURITY_TOOL", role: "fixed_tool", expectedKind: "executable_file", target: Object.freeze({ kind: "absolute", value: "/usr/bin/security" }) }),
    Object.freeze({ ref: "NOTARYTOOL_RESOLVED_TOOL", role: "resolved_xcode_tool", expectedKind: "executable_file", target: Object.freeze({ kind: "absolute", value: "/Applications/Xcode.app/Contents/Developer/usr/bin/notarytool" }) }),
    Object.freeze({ ref: "STAPLER_RESOLVED_TOOL", role: "resolved_xcode_tool", expectedKind: "executable_file", target: Object.freeze({ kind: "absolute", value: "/Applications/Xcode.app/Contents/Developer/usr/bin/stapler" }) }),
    Object.freeze({ ref: "BUILD_INFO_DOCUMENT", role: "build_info_document", expectedKind: "ordinary_file", target: Object.freeze({ kind: "repository_relative", value: "dist/BUILD_INFO.json" }) }),
    Object.freeze({ ref: "PLATFORM_RELEASE_MANIFEST_DOCUMENT", role: "platform_release_manifest_document", expectedKind: "ordinary_file", target: Object.freeze({ kind: "repository_relative", value: "dist/PLATFORM_RELEASE_MANIFEST.json" }) }),
  ] as const),
  installerPackageIdentifier: Object.freeze({ state: "unconfigured", publicValue: null }),
  requiredProductionTrustConfiguration: Object.freeze({
    state: "unavailable",
    productionAdmission: "forbidden",
    offlineReleasePublicKeySpkiDerBase64: null,
    signedNativeDistributionCatalog: null,
  }),
});

const EXPECTED_BLOCKERS = [
  "DEVELOPER_ID_APPLICATION_IDENTITY_NOT_OBSERVED",
  "DEVELOPER_ID_INSTALLER_IDENTITY_NOT_OBSERVED",
  "DEVELOPER_ID_TEAM_UNCONFIGURED",
  "DESIGNATED_REQUIREMENT_UNCONFIGURED",
  "INSTALLER_PACKAGE_ID_UNCONFIGURED",
  "OFFLINE_RELEASE_PUBLIC_KEY_UNCONFIGURED",
  "SIGNED_NATIVE_DISTRIBUTION_CATALOG_EMPTY",
  "NOTARYTOOL_UNAVAILABLE",
  "NOTARY_CREDENTIAL_CONFIGURATION_UNVERIFIABLE",
  "NOTARIZED_DISTRIBUTION_UNPROVEN",
  "AUTHENTICATED_RUNNING_HELPER_ABSENT",
  "AMFI_RUNTIME_ADMISSION_UNPROVEN",
  "INSTALLER_RECEIPT_UNOBSERVED_CONFIGURATION_UNAVAILABLE",
  "INSTALLED_SETFARM_ROOT_ABSENT",
  "INSTALLED_HELPER_ABSENT",
  "EXACT_INSTALLED_PAYLOAD_BINDING_UNPROVEN",
  "PRODUCTION_TRUST_CONFIGURATION_UNAVAILABLE",
  "V2_PLATFORM_RELEASE_MANIFEST_AUTHORITY_UNAVAILABLE",
  "PREPARED_RELEASE_STORE_AUTHORITY_UNAVAILABLE",
  "FRESH_VERIFIER_AUTHORITY_UNAVAILABLE",
  "REGISTRY_V2_ACTIVATION_AUTHORITY_UNAVAILABLE",
] as const;

function clone<T>(value: T): T {
  return JSON.parse(canonicalJsonStringify(value)) as T;
}

function hashPathObservation(value: Record<string, unknown>): string {
  const observation = { ...value };
  delete observation.observationHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-production-admission-readiness-fixed-path-observation-hash.v2",
    observation,
  });
}

function hashCommandObservation(value: Record<string, unknown>): string {
  const observation = { ...value };
  delete observation.observationHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-production-admission-readiness-command-observation-hash.v2",
    observation,
  });
}

function rehashReceipt(candidate: Record<string, unknown>): void {
  candidate.policyHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-production-admission-readiness-policy-hash.v2",
    policy: POLICY,
  });
  const receipt = { ...candidate };
  delete receipt.readinessHash;
  candidate.readinessHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-production-admission-readiness-hash.v2",
    receipt,
  });
}

function rehashReadinessOnly(candidate: Record<string, unknown>): void {
  const receipt = { ...candidate };
  delete receipt.readinessHash;
  candidate.readinessHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-production-admission-readiness-hash.v2",
    receipt,
  });
}

function fixedPath(ref: "INSTALLED_SETFARM_ROOT" | "AUTHENTICATED_SETFARM_HELPER") {
  const observation: Record<string, unknown> = {
    ref,
    state: "absent",
    observationHash: "0".repeat(64),
  };
  observation.observationHash = hashPathObservation(observation);
  return observation;
}

function identityCommand(
  identityClass: "developer_id_application" | "developer_id_installer",
) {
  const application = identityClass === "developer_id_application";
  const observation: Record<string, unknown> = {
    kind: application
      ? "developer_id_application_identity"
      : "developer_id_installer_identity",
    executableRef: "SECURITY",
    argvRef: application
      ? "SECURITY_FIND_IDENTITY_CODESIGNING"
      : "SECURITY_FIND_IDENTITY_BASIC",
    status: "completed",
    exitCode: 0,
    signal: null,
    result: {
      kind: "identity_count",
      identityClass,
      validIdentityCount: 0,
      state: "not_observed_in_active_search_list",
    },
    projectionByteLength: 0,
    observationHash: "0".repeat(64),
  };
  refreshCommandObservation(observation);
  return observation;
}

function refreshCommandObservation(observation: Record<string, unknown>): void {
  observation.projectionByteLength = Buffer.byteLength(
    canonicalJsonStringify(observation.result),
    "utf8",
  );
  observation.observationHash = hashCommandObservation(observation);
}

function toolAvailabilityCommand(
  tool: "codesign" | "notarytool" | "pkgutil" | "security" | "spctl" | "stapler",
  state: "available" | "unavailable" | "observation_failed",
): Record<string, unknown> {
  const refs = {
    codesign: ["CODESIGN", "CODESIGN_AVAILABILITY"],
    notarytool: ["NOTARYTOOL", "NOTARYTOOL_AVAILABILITY"],
    pkgutil: ["PKGUTIL", "PKGUTIL_AVAILABILITY"],
    security: ["SECURITY", "SECURITY_AVAILABILITY"],
    spctl: ["SPCTL", "SPCTL_AVAILABILITY"],
    stapler: ["STAPLER", "STAPLER_AVAILABILITY"],
  } as const;
  const [executableRef, argvRef] = refs[tool];
  const observation: Record<string, unknown> = {
    kind: "tool_availability",
    executableRef,
    argvRef,
    status: "completed",
    exitCode: state === "available" ? 0 : 1,
    signal: null,
    projectionByteLength: 0,
    result: { kind: "tool_availability", tool, state },
    observationHash: "0".repeat(64),
  };
  refreshCommandObservation(observation);
  return observation;
}

function hostCommand(
  kind: "gatekeeper_status" | "sip_status" | "authenticated_root_status" | "amfi_service_status",
  resultKind: "gatekeeper" | "sip" | "authenticated_root" | "amfi_service",
  state: "enabled" | "running",
): Record<string, unknown> {
  const refs = {
    gatekeeper_status: ["SPCTL", "SPCTL_STATUS"],
    sip_status: ["CSRUTIL", "CSRUTIL_STATUS"],
    authenticated_root_status: ["CSRUTIL", "CSRUTIL_AUTHENTICATED_ROOT_STATUS"],
    amfi_service_status: ["LAUNCHCTL", "LAUNCHCTL_PRINT_AMFI"],
  } as const;
  const [executableRef, argvRef] = refs[kind];
  const observation: Record<string, unknown> = {
    kind,
    executableRef,
    argvRef,
    status: "completed",
    exitCode: 0,
    signal: null,
    projectionByteLength: 0,
    result: { kind: resultKind, state },
    observationHash: "0".repeat(64),
  };
  refreshCommandObservation(observation);
  return observation;
}

function notaryProfileCommand(
  serviceRef: "GKE_NOTARY_TOOL" | "APPLE_NOTARYTOOL" | "NOTARYTOOL",
): Record<string, unknown> {
  const argvRefs = {
    GKE_NOTARY_TOOL: "SECURITY_FIND_GENERIC_PASSWORD_GKE_NOTARY_TOOL",
    APPLE_NOTARYTOOL: "SECURITY_FIND_GENERIC_PASSWORD_NOTARYTOOL",
    NOTARYTOOL: "SECURITY_FIND_GENERIC_PASSWORD_NOTARY_TOOL",
  } as const;
  const observation: Record<string, unknown> = {
    kind: "notary_profile_metadata",
    executableRef: "SECURITY",
    argvRef: argvRefs[serviceRef],
    status: "completed",
    exitCode: 44,
    signal: null,
    projectionByteLength: 0,
    result: {
      kind: "notary_profile_metadata",
      serviceRef,
      state: "not_observed",
    },
    observationHash: "0".repeat(64),
  };
  refreshCommandObservation(observation);
  return observation;
}

function validDarwinCandidate(): Record<string, unknown> {
  const candidate: Record<string, unknown> = {
    schema: "setfarm.platform-release-production-admission-readiness.v2",
    version: "2.0.0",
    authorityState: "diagnostic_observation_only",
    admissionScope: "production_host_readiness_observation",
    credentialUse: "none",
    mutationAuthority: false,
    productionAuthority: false,
    productionAdmission: "blocked",
    trustConclusion: "characterization_only",
    policyHash: "0".repeat(64),
    observedAt: "2026-08-12T09:10:11.123Z",
    blockerCodes: [...EXPECTED_BLOCKERS],
    readinessHash: "0".repeat(64),
    observedPlatform: "darwin",
    codeSigning: {
      developerIdApplication: {
        validIdentityCount: 0,
        state: "not_observed_in_active_search_list",
      },
      developerIdInstaller: {
        validIdentityCount: 0,
        state: "not_observed_in_active_search_list",
      },
    },
    notarization: {
      toolAvailability: "unavailable",
      knownProfileMetadata: "not_observed_at_known_service_names",
      credentialReadiness:
        "unverifiable_without_external_credential_configuration",
      ticketEvidence: "not_observed_without_exact_distribution",
    },
    hostEnforcement: {
      gatekeeper: "enabled",
      sip: "enabled",
      authenticatedRoot: "enabled",
      amfiService: "running",
      amfiRuntimeAdmission:
        "unavailable_requires_authenticated_running_helper",
    },
    installedDistribution: {
      expectedRoots: [fixedPath("INSTALLED_SETFARM_ROOT")],
      expectedHelpers: [fixedPath("AUTHENTICATED_SETFARM_HELPER")],
      installerPackageIdentifier: "unconfigured",
      installerReceipt: "not_observed_configuration_unavailable",
      exactPayloadBinding: "absent",
    },
    productionTrustConfiguration: {
      state: "unavailable",
      productionAdmission: "forbidden",
    },
    buildProvenance: {
      state: "v1_build_provenance_only",
      platformReleaseAuthority: false,
    },
    commandObservations: [
      identityCommand("developer_id_application"),
      identityCommand("developer_id_installer"),
      hostCommand("gatekeeper_status", "gatekeeper", "enabled"),
      hostCommand("sip_status", "sip", "enabled"),
      hostCommand("authenticated_root_status", "authenticated_root", "enabled"),
      hostCommand("amfi_service_status", "amfi_service", "running"),
      toolAvailabilityCommand("codesign", "available"),
      toolAvailabilityCommand("spctl", "available"),
      toolAvailabilityCommand("pkgutil", "available"),
      toolAvailabilityCommand("security", "available"),
      toolAvailabilityCommand("notarytool", "unavailable"),
      toolAvailabilityCommand("stapler", "available"),
      notaryProfileCommand("GKE_NOTARY_TOOL"),
      notaryProfileCommand("APPLE_NOTARYTOOL"),
      notaryProfileCommand("NOTARYTOOL"),
    ],
  };
  rehashReceipt(candidate);
  return candidate;
}

function assertRecursivelyFrozen(value: unknown): void {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object") continue;
    assert.equal(Object.isFrozen(current), true);
    pending.push(...Object.values(current));
  }
}

test("unsupported mode performs no Darwin observation and emits only fixed blockers", async () => {
  const receipt = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    Object.freeze({
      platform: "unsupported" as const,
      faults: Object.freeze([]),
    }),
  );

  assert.equal(receipt.observedPlatform, "unsupported");
  assert.deepEqual(receipt.codeSigning, {
    state: "not_observed_platform_unsupported",
  });
  assert.deepEqual(receipt.notarization, {
    state: "not_observed_platform_unsupported",
  });
  assert.deepEqual(receipt.hostEnforcement, {
    state: "not_observed_platform_unsupported",
  });
  assert.deepEqual(receipt.installedDistribution, {
    state: "not_observed_platform_unsupported",
  });
  assert.deepEqual(receipt.buildProvenance, {
    state: "not_observed_platform_unsupported",
  });
  assert.deepEqual(receipt.productionTrustConfiguration, {
    state: "not_observed_platform_unsupported",
    productionAdmission: "forbidden",
  });
  assert.deepEqual(receipt.commandObservations, []);
  assert.deepEqual(receipt.blockerCodes, [
    "PLATFORM_UNSUPPORTED",
    "DEVELOPER_ID_TEAM_UNCONFIGURED",
    "DESIGNATED_REQUIREMENT_UNCONFIGURED",
    "INSTALLER_PACKAGE_ID_UNCONFIGURED",
    "OFFLINE_RELEASE_PUBLIC_KEY_UNCONFIGURED",
    "SIGNED_NATIVE_DISTRIBUTION_CATALOG_EMPTY",
    "PREPARED_RELEASE_STORE_AUTHORITY_UNAVAILABLE",
    "FRESH_VERIFIER_AUTHORITY_UNAVAILABLE",
    "REGISTRY_V2_ACTIVATION_AUTHORITY_UNAVAILABLE",
    "HOST_OBSERVATION_INCOMPLETE",
  ]);
});

test("Darwin mode records the exact fixed diagnostic command references", async () => {
  const receipt = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    Object.freeze({
      platform: "darwin" as const,
      faults: Object.freeze([]),
    }),
  );
  assert.equal(receipt.observedPlatform, "darwin");
  assert.equal(observePlatformReleaseProductionAdmissionReadinessV2.length, 0);
  if (receipt.observedPlatform !== "darwin") return;

  assert.deepEqual(
    receipt.commandObservations.map(({ argvRef }) => argvRef),
    [
      "SECURITY_FIND_IDENTITY_CODESIGNING",
      "SECURITY_FIND_IDENTITY_BASIC",
      "SPCTL_STATUS",
      "CSRUTIL_STATUS",
      "CSRUTIL_AUTHENTICATED_ROOT_STATUS",
      "LAUNCHCTL_PRINT_AMFI",
      "NOTARYTOOL_AVAILABILITY",
      "STAPLER_AVAILABILITY",
      "SECURITY_FIND_GENERIC_PASSWORD_GKE_NOTARY_TOOL",
      "SECURITY_FIND_GENERIC_PASSWORD_NOTARYTOOL",
      "SECURITY_FIND_GENERIC_PASSWORD_NOTARY_TOOL",
      "CODESIGN_AVAILABILITY",
      "SPCTL_AVAILABILITY",
      "PKGUTIL_AVAILABILITY",
      "SECURITY_AVAILABILITY",
    ],
  );
});

test("Darwin exact C-locale Gatekeeper and authenticated-root success forms are enabled", async () => {
  const receipt = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    Object.freeze({
      platform: "darwin" as const,
      faults: Object.freeze([]),
    }),
  );
  assert.equal(receipt.observedPlatform, "darwin");
  if (receipt.observedPlatform !== "darwin") return;
  assert.equal(receipt.hostEnforcement.gatekeeper, "enabled");
  assert.equal(receipt.hostEnforcement.authenticatedRoot, "enabled");
});

function finiteDarwinMode(
  ...faults: Array<
    | "application_identity_spawn_failure"
    | "installer_identity_timeout"
    | "gatekeeper_output_overflow"
    | "sip_malformed_output"
    | "authenticated_root_spawn_failure"
    | "amfi_malformed_output"
    | "notarytool_unavailable"
    | "notary_profile_probe_failure"
    | "fixed_path_symlink"
    | "fixed_path_replacement"
    | "build_manifest_invalid"
    | "escaped_writer_settlement_watchdog"
    | "escaped_writer_output_limit_watchdog"
    | "fixed_path_leaf_created_after_absence"
    | "amfi_running_near_miss"
    | "amfi_duplicate_keys"
    | "amfi_nonzero_exact_output"
    | "fixed_path_hardlink"
    | "fixed_path_unsafe_mode"
  >
) {
  return Object.freeze({
    platform: "darwin" as const,
    faults: Object.freeze(faults),
  });
}

test("escaped writer settlement preserves timeout and releases every referenced handle", () => {
  const startedAt = Date.now();
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      [
        'import { observePlatformReleaseProductionAdmissionReadinessForTestV2 as observe } from "./src/product-compiler/platform-release-production-admission-readiness-test-support-v2.js";',
        'const receipt = await observe(Object.freeze({ platform: "darwin", faults: Object.freeze(["escaped_writer_settlement_watchdog"]) }));',
        'if (receipt.observedPlatform !== "darwin") process.exit(11);',
        'const command = receipt.commandObservations.find(({ argvRef }) => argvRef === "LAUNCHCTL_PRINT_AMFI");',
        'process.stdout.write(JSON.stringify({ status: command?.status, state: command?.result.state, blocked: receipt.blockerCodes.includes("HOST_OBSERVATION_INCOMPLETE") }));',
      ].join("\n"),
    ],
    {
      cwd: path.resolve("."),
      encoding: "utf8",
      maxBuffer: 16 * 1024,
      timeout: 9_000,
    },
  );
  const elapsed = Date.now() - startedAt;

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "timed_out",
    state: "observation_failed",
    blocked: true,
  });
  assert.ok(elapsed < 8_500, `escaped writer remained referenced for ${elapsed}ms`);
});

test("escaped writer settlement preserves output limit while failing containment closed", () => {
  const startedAt = Date.now();
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      [
        'import { observePlatformReleaseProductionAdmissionReadinessForTestV2 as observe } from "./src/product-compiler/platform-release-production-admission-readiness-test-support-v2.js";',
        'const receipt = await observe(Object.freeze({ platform: "darwin", faults: Object.freeze(["escaped_writer_output_limit_watchdog"]) }));',
        'if (receipt.observedPlatform !== "darwin") process.exit(11);',
        'const command = receipt.commandObservations.find(({ argvRef }) => argvRef === "LAUNCHCTL_PRINT_AMFI");',
        'process.stdout.write(JSON.stringify({ status: command?.status, state: command?.result.state, blocked: receipt.blockerCodes.includes("HOST_OBSERVATION_INCOMPLETE") }));',
      ].join("\n"),
    ],
    {
      cwd: path.resolve("."),
      encoding: "utf8",
      maxBuffer: 16 * 1024,
      timeout: 5_000,
    },
  );
  const elapsed = Date.now() - startedAt;

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "output_limit_exceeded",
    state: "observation_failed",
    blocked: true,
  });
  assert.ok(elapsed < 4_500, `escaped writer remained referenced for ${elapsed}ms`);
});

test("a leaf created after the first ENOENT cannot remain classified absent", async () => {
  const receipt = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("fixed_path_leaf_created_after_absence"),
  );
  assert.equal(receipt.observedPlatform, "darwin");
  if (receipt.observedPlatform !== "darwin") return;
  assert.equal(
    receipt.installedDistribution.expectedRoots[0]?.state,
    "observation_failed",
  );
  assert.ok(receipt.blockerCodes.includes("HOST_OBSERVATION_INCOMPLETE"));
});

test("AMFI requires unique exact running lines and terminal success", async () => {
  for (const fault of [
    "amfi_running_near_miss",
    "amfi_duplicate_keys",
    "amfi_nonzero_exact_output",
  ] as const) {
    const receipt = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
      finiteDarwinMode(fault),
    );
    assert.equal(receipt.observedPlatform, "darwin");
    if (receipt.observedPlatform !== "darwin") continue;
    assert.equal(receipt.hostEnforcement.amfiService, "observation_failed", fault);
    assert.equal(
      darwinCommandByArgvRef(receipt, "LAUNCHCTL_PRINT_AMFI").status,
      "observation_failed",
      fault,
    );
    assert.ok(receipt.blockerCodes.includes("HOST_OBSERVATION_INCOMPLETE"));
  }
});

test("finite path faults use real symlink, hardlink, mode, and replacement objects", async () => {
  for (const [fault, expected] of [
    ["fixed_path_symlink", "unproven"],
    ["fixed_path_hardlink", "unproven"],
    ["fixed_path_unsafe_mode", "unproven"],
    ["fixed_path_replacement", "observation_failed"],
  ] as const) {
    const receipt = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
      finiteDarwinMode(fault),
    );
    assert.equal(receipt.observedPlatform, "darwin");
    if (receipt.observedPlatform !== "darwin") continue;
    assert.equal(receipt.installedDistribution.expectedRoots[0]?.state, expected, fault);
    assert.equal(receipt.installedDistribution.expectedHelpers[0]?.state, expected, fault);
    assert.ok(receipt.blockerCodes.includes("EXACT_INSTALLED_PAYLOAD_BINDING_UNPROVEN"));
  }
});

function darwinCommandByArgvRef(
  receipt: PlatformReleaseProductionAdmissionReadinessV2,
  argvRef: string,
): PlatformReleaseProductionAdmissionReadinessV2 extends infer _Receipt
  ? Readonly<Record<string, unknown>>
  : never {
  assert.equal(receipt.observedPlatform, "darwin");
  if (receipt.observedPlatform !== "darwin") throw new Error("unreachable");
  const command = receipt.commandObservations.find(
    (candidate) => candidate.argvRef === argvRef,
  );
  assert.ok(command, `missing ${argvRef}`);
  return command as unknown as Readonly<Record<string, unknown>>;
}

test("finite faults fail closed without erasing independent observations", async () => {
  const baseline = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode(),
  );
  assert.equal(baseline.observedPlatform, "darwin");
  if (baseline.observedPlatform !== "darwin") return;

  const applicationSpawn = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("application_identity_spawn_failure"),
  );
  assert.equal(applicationSpawn.observedPlatform, "darwin");
  if (applicationSpawn.observedPlatform !== "darwin") return;
  assert.deepEqual(applicationSpawn.codeSigning.developerIdApplication, {
    validIdentityCount: null,
    state: "observation_failed",
  });
  assert.deepEqual(
    applicationSpawn.codeSigning.developerIdInstaller,
    baseline.codeSigning.developerIdInstaller,
  );
  assert.equal(
    darwinCommandByArgvRef(
      applicationSpawn,
      "SECURITY_FIND_IDENTITY_CODESIGNING",
    ).status,
    "spawn_failed",
  );
  assert.ok(applicationSpawn.blockerCodes.includes(
    "CODE_SIGNING_IDENTITY_OBSERVATION_FAILED",
  ));

  const installerTimeout = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("installer_identity_timeout"),
  );
  assert.equal(installerTimeout.observedPlatform, "darwin");
  if (installerTimeout.observedPlatform !== "darwin") return;
  assert.deepEqual(installerTimeout.codeSigning.developerIdInstaller, {
    validIdentityCount: null,
    state: "observation_failed",
  });
  assert.equal(
    darwinCommandByArgvRef(installerTimeout, "SECURITY_FIND_IDENTITY_BASIC").status,
    "timed_out",
  );

  const gatekeeperOverflow = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("gatekeeper_output_overflow"),
  );
  assert.equal(gatekeeperOverflow.observedPlatform, "darwin");
  if (gatekeeperOverflow.observedPlatform !== "darwin") return;
  assert.equal(gatekeeperOverflow.hostEnforcement.gatekeeper, "observation_failed");
  assert.equal(
    darwinCommandByArgvRef(gatekeeperOverflow, "SPCTL_STATUS").status,
    "output_limit_exceeded",
  );
  assert.ok(gatekeeperOverflow.blockerCodes.includes("GATEKEEPER_OBSERVATION_FAILED"));

  const sipMalformed = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("sip_malformed_output"),
  );
  assert.equal(sipMalformed.observedPlatform, "darwin");
  if (sipMalformed.observedPlatform !== "darwin") return;
  assert.equal(sipMalformed.hostEnforcement.sip, "observation_failed");
  const malformedSipCommand = darwinCommandByArgvRef(sipMalformed, "CSRUTIL_STATUS");
  assert.equal(malformedSipCommand.exitCode, 1);
  assert.equal(malformedSipCommand.status, "observation_failed");
  assert.ok(sipMalformed.blockerCodes.includes("SIP_OBSERVATION_FAILED"));

  const rootSpawn = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("authenticated_root_spawn_failure"),
  );
  assert.equal(rootSpawn.observedPlatform, "darwin");
  if (rootSpawn.observedPlatform !== "darwin") return;
  assert.equal(rootSpawn.hostEnforcement.authenticatedRoot, "observation_failed");
  assert.equal(
    darwinCommandByArgvRef(rootSpawn, "CSRUTIL_AUTHENTICATED_ROOT_STATUS").status,
    "spawn_failed",
  );
  assert.ok(rootSpawn.blockerCodes.includes(
    "AUTHENTICATED_ROOT_DISABLED_OR_UNAVAILABLE",
  ));

  const amfiMalformed = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("amfi_malformed_output"),
  );
  assert.equal(amfiMalformed.observedPlatform, "darwin");
  if (amfiMalformed.observedPlatform !== "darwin") return;
  assert.equal(amfiMalformed.hostEnforcement.amfiService, "observation_failed");
  assert.ok(amfiMalformed.blockerCodes.includes("AMFI_SERVICE_UNAVAILABLE"));

  const notaryUnavailable = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("notarytool_unavailable"),
  );
  assert.equal(notaryUnavailable.observedPlatform, "darwin");
  if (notaryUnavailable.observedPlatform !== "darwin") return;
  assert.equal(notaryUnavailable.notarization.toolAvailability, "unavailable");
  assert.ok(notaryUnavailable.blockerCodes.includes("NOTARYTOOL_UNAVAILABLE"));
  assert.equal(notaryUnavailable.blockerCodes.includes("NOTARYTOOL_OBSERVATION_FAILED"), false);

  const profileFailure = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("notary_profile_probe_failure"),
  );
  assert.equal(profileFailure.observedPlatform, "darwin");
  if (profileFailure.observedPlatform !== "darwin") return;
  assert.equal(profileFailure.notarization.knownProfileMetadata, "observation_failed");
  assert.ok(profileFailure.blockerCodes.includes("HOST_OBSERVATION_INCOMPLETE"));

  const symlink = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("fixed_path_symlink"),
  );
  assert.equal(symlink.observedPlatform, "darwin");
  if (symlink.observedPlatform !== "darwin") return;
  assert.equal(symlink.installedDistribution.expectedRoots[0]?.state, "unproven");
  assert.equal(symlink.installedDistribution.expectedHelpers[0]?.state, "unproven");
  assert.equal(symlink.buildProvenance.state, "observation_failed");
  assert.ok(symlink.blockerCodes.includes("EXACT_INSTALLED_PAYLOAD_BINDING_UNPROVEN"));

  const replacement = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("fixed_path_replacement"),
  );
  assert.equal(replacement.observedPlatform, "darwin");
  if (replacement.observedPlatform !== "darwin") return;
  assert.equal(
    replacement.installedDistribution.expectedRoots[0]?.state,
    "observation_failed",
  );
  assert.equal(
    replacement.installedDistribution.expectedHelpers[0]?.state,
    "observation_failed",
  );
  assert.equal(replacement.buildProvenance.state, "observation_failed");
  assert.ok(replacement.blockerCodes.includes("HOST_OBSERVATION_INCOMPLETE"));

  const changingSymlinkAncestor = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("fixed_path_symlink", "fixed_path_replacement"),
  );
  assert.equal(changingSymlinkAncestor.observedPlatform, "darwin");
  if (changingSymlinkAncestor.observedPlatform !== "darwin") return;
  assert.equal(
    changingSymlinkAncestor.installedDistribution.expectedRoots[0]?.state,
    "observation_failed",
  );
  assert.equal(
    changingSymlinkAncestor.installedDistribution.expectedHelpers[0]?.state,
    "observation_failed",
  );

  const manifestInvalid = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("build_manifest_invalid"),
  );
  assert.equal(manifestInvalid.observedPlatform, "darwin");
  if (manifestInvalid.observedPlatform !== "darwin") return;
  assert.equal(manifestInvalid.buildProvenance.state, "invalid");
  assert.equal(manifestInvalid.buildProvenance.platformReleaseAuthority, false);
  assert.ok(manifestInvalid.blockerCodes.includes(
    "V2_PLATFORM_RELEASE_MANIFEST_AUTHORITY_UNAVAILABLE",
  ));

  const missingAndReplacement = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("build_manifest_invalid", "fixed_path_replacement"),
  );
  assert.equal(missingAndReplacement.observedPlatform, "darwin");
  if (missingAndReplacement.observedPlatform !== "darwin") return;
  assert.equal(missingAndReplacement.buildProvenance.state, "observation_failed");
  assert.ok(missingAndReplacement.blockerCodes.includes("HOST_OBSERVATION_INCOMPLETE"));
});

test("terminal faults preserve typed first causes and never serialize raw output", async () => {
  for (const [fault, argvRef, status] of [
    [
      "application_identity_spawn_failure",
      "SECURITY_FIND_IDENTITY_CODESIGNING",
      "spawn_failed",
    ],
    ["installer_identity_timeout", "SECURITY_FIND_IDENTITY_BASIC", "timed_out"],
    ["gatekeeper_output_overflow", "SPCTL_STATUS", "output_limit_exceeded"],
  ] as const) {
    const receipt = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
      finiteDarwinMode(fault),
    );
    assert.equal(darwinCommandByArgvRef(receipt, argvRef).status, status);
    const canonical = canonicalPlatformReleaseProductionAdmissionReadinessV2(receipt);
    assert.doesNotMatch(
      canonical,
      /Developer ID Application:|Developer ID Installer:|assessments enabled|System Integrity Protection|forced|timed out|spawn failed|\/usr\/(?:bin|sbin)\//iu,
    );
  }
});

test("finite test mode rejects widening, duplicates, and impossible platform faults", async () => {
  await assert.rejects(
    () => observePlatformReleaseProductionAdmissionReadinessForTestV2({
      platform: "darwin",
      faults: [],
    } as never),
    /frozen|mode/i,
  );
  await assert.rejects(
    () => observePlatformReleaseProductionAdmissionReadinessForTestV2(Object.freeze({
      platform: "darwin",
      faults: ["sip_malformed_output"],
    }) as never),
    /frozen|fault/i,
  );
  await assert.rejects(
    () => observePlatformReleaseProductionAdmissionReadinessForTestV2(finiteDarwinMode(
      "sip_malformed_output",
      "sip_malformed_output",
    )),
    /duplicate/i,
  );
  await assert.rejects(
    () => observePlatformReleaseProductionAdmissionReadinessForTestV2(Object.freeze({
      platform: "unsupported",
      faults: Object.freeze(["sip_malformed_output"]),
    }) as never),
    /unsupported|impossible/i,
  );
  await assert.rejects(
    () => observePlatformReleaseProductionAdmissionReadinessForTestV2(Object.freeze({
      platform: "darwin",
      faults: Object.freeze([]),
      executable: "/tmp/caller-controlled",
    }) as never),
    /mode|field|exact/i,
  );

  const hiddenModeSymbol = Symbol("hidden mode input");
  const symbolWidenedMode = Object.freeze(Object.defineProperty({
    platform: "unsupported" as const,
    faults: Object.freeze([]),
  }, hiddenModeSymbol, {
    value: "/tmp/caller-controlled",
    enumerable: false,
  }));
  await assert.rejects(
    () => observePlatformReleaseProductionAdmissionReadinessForTestV2(
      symbolWidenedMode as never,
    ),
    /mode|field|exact/i,
  );

  const nonEnumerableFaults = Object.freeze(Object.defineProperty(
    [] as string[],
    "hidden",
    { value: "sip_malformed_output", enumerable: false },
  ));
  await assert.rejects(
    () => observePlatformReleaseProductionAdmissionReadinessForTestV2(Object.freeze({
      platform: "unsupported",
      faults: nonEnumerableFaults,
    }) as never),
    /fault|dense|exact/i,
  );

  const hiddenFaultSymbol = Symbol("hidden fault input");
  const symbolWidenedFaults = Object.freeze(Object.defineProperty(
    [] as string[],
    hiddenFaultSymbol,
    { value: "sip_malformed_output", enumerable: false },
  ));
  await assert.rejects(
    () => observePlatformReleaseProductionAdmissionReadinessForTestV2(Object.freeze({
      platform: "unsupported",
      faults: symbolWidenedFaults,
    }) as never),
    /fault|dense|exact/i,
  );

  let faultAccessorInvoked = false;
  const accessorFaults: string[] = [];
  Object.defineProperty(accessorFaults, "0", {
    configurable: false,
    enumerable: true,
    get() {
      faultAccessorInvoked = true;
      return "sip_malformed_output";
    },
  });
  Object.freeze(accessorFaults);
  await assert.rejects(
    () => observePlatformReleaseProductionAdmissionReadinessForTestV2(Object.freeze({
      platform: "darwin",
      faults: accessorFaults,
    }) as never),
    /fault|dense|exact/i,
  );
  assert.equal(faultAccessorInvoked, false);
});

test("observer receipts stay within every public allocation maximum", async () => {
  const receipt = await observePlatformReleaseProductionAdmissionReadinessForTestV2(
    finiteDarwinMode("application_identity_spawn_failure", "notary_profile_probe_failure"),
  );
  assert.equal(receipt.observedPlatform, "darwin");
  if (receipt.observedPlatform !== "darwin") return;
  assert.equal(receipt.commandObservations.length, 15);
  assert.ok(receipt.commandObservations.length <= 16);
  assert.ok(receipt.blockerCodes.length <= 32);
  assert.ok(receipt.installedDistribution.expectedRoots.length <= 8);
  assert.ok(receipt.installedDistribution.expectedHelpers.length <= 8);
  for (const command of receipt.commandObservations) {
    assert.ok(command.projectionByteLength <= 4_096);
    if (command.result.kind === "identity_count") {
      assert.ok(
        command.result.validIdentityCount === null
        || command.result.validIdentityCount <= 128,
      );
    }
  }
  assert.ok(Buffer.byteLength(
    canonicalPlatformReleaseProductionAdmissionReadinessV2(receipt),
    "utf8",
  ) <= 64 * 1024);
});

function fixedObjectSnapshotV2(target: string): Readonly<Record<string, unknown>> {
  try {
    const observed = lstatSync(target, { bigint: true });
    return Object.freeze({
      state: "present",
      device: observed.dev.toString(),
      inode: observed.ino.toString(),
      ownerUid: observed.uid.toString(),
      ownerGid: observed.gid.toString(),
      mode: observed.mode.toString(),
      linkCount: observed.nlink.toString(),
      byteLength: observed.size.toString(),
      modifiedNanoseconds: observed.mtimeNs.toString(),
      changedNanoseconds: observed.ctimeNs.toString(),
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return Object.freeze({ state: "absent" });
    }
    throw error;
  }
}

test("zero-input live Darwin observation is blocked, secret-free, and non-mutating", async (t) => {
  if (process.platform !== "darwin") {
    t.skip("live production observation requires Darwin");
    return;
  }
  const helper = path.join(
    PLATFORM_RELEASE_HOST_VERIFIER_ROOT_V2,
    PLATFORM_RELEASE_HOST_VERIFIER_EXECUTABLE_LOCATOR_V2,
  );
  const before = [
    fixedObjectSnapshotV2(PLATFORM_RELEASE_HOST_VERIFIER_ROOT_V2),
    fixedObjectSnapshotV2(helper),
  ];
  const live = await observePlatformReleaseProductionAdmissionReadinessV2();
  const after = [
    fixedObjectSnapshotV2(PLATFORM_RELEASE_HOST_VERIFIER_ROOT_V2),
    fixedObjectSnapshotV2(helper),
  ];

  assert.equal(live.observedPlatform, "darwin");
  assert.equal(live.productionAuthority, false);
  assert.equal(live.productionAdmission, "blocked");
  assert.equal(live.credentialUse, "none");
  assert.ok(live.blockerCodes.includes(
    "NOTARY_CREDENTIAL_CONFIGURATION_UNVERIFIABLE",
  ));
  assert.ok(live.blockerCodes.includes("AMFI_RUNTIME_ADMISSION_UNPROVEN"));
  assert.doesNotMatch(
    canonicalPlatformReleaseProductionAdmissionReadinessV2(live),
    /setrox|Users\//iu,
  );
  assert.deepEqual(after, before);
});

test("observer dependency and command surfaces stay closed and read-only", async () => {
  const privateRelative = "execution/private-platform-release-production-admission-readiness-v2.ts";
  const wrapperRelative = "execution/platform-release-production-admission-readiness-v2.ts";
  const supportRelative =
    "product-compiler/platform-release-production-admission-readiness-test-support-v2.ts";
  const privateSource = readFileSync(path.resolve("src", privateRelative), "utf8");
  const wrapperSource = readFileSync(path.resolve("src", wrapperRelative), "utf8");
  const supportSource = readFileSync(path.resolve("src", supportRelative), "utf8");

  const exactCommandPlan = [
    ["developer_id_application", "SECURITY_FIND_IDENTITY_CODESIGNING_V2"],
    ["developer_id_installer", "SECURITY_FIND_IDENTITY_BASIC_V2"],
    ["gatekeeper_status", "SPCTL_STATUS_V2"],
    ["sip_status", "CSRUTIL_STATUS_V2"],
    ["authenticated_root_status", "CSRUTIL_AUTHENTICATED_ROOT_STATUS_V2"],
    ["amfi_service", "LAUNCHCTL_AMFI_SERVICE_V2"],
    ["notarytool_resolution", "XCRUN_FIND_NOTARYTOOL_V2"],
    ["stapler_resolution", "XCRUN_FIND_STAPLER_V2"],
    ["notary_profile_service_1", "SECURITY_FIND_GENERIC_PASSWORD_SERVICE_1_V2"],
    ["notary_profile_service_2", "SECURITY_FIND_GENERIC_PASSWORD_SERVICE_2_V2"],
    ["notary_profile_service_3", "SECURITY_FIND_GENERIC_PASSWORD_SERVICE_3_V2"],
  ] as const;
  const recordedPlan = PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2
    .commandPlan
    .filter(({ execution }) => execution === "subprocess")
    .map(({ commandLabel, commandRef }) => [commandLabel, commandRef]);
  assert.deepEqual(recordedPlan, exactCommandPlan);
  assert.doesNotMatch(privateSource, /const commandPlan\b|const commandMetadata\b/u);
  assert.match(privateSource, /\.commandPlan\.filter/u);

  const forbiddenMutationSurface =
    /\b(?:writeFile|appendFile|rename|unlink|rm|rmdir|mkdir|chmod|chown|sign|submit|install|restart|execFile|exec|fork)\s*\(/u;
  assert.doesNotMatch(privateSource, forbiddenMutationSurface);
  assert.doesNotMatch(wrapperSource, forbiddenMutationSurface);
  assert.doesNotMatch(supportSource, forbiddenMutationSurface);
  assert.doesNotMatch(privateSource, /SETFARM_REPO_DIR/u);
  assert.doesNotMatch(
    privateSource,
    /function pathStateToToolStateV2[\s\S]*?state === "absent"\) return "unavailable"/u,
    "absence of a fixed non-executed tool must fail closed as an incomplete host observation",
  );
  assert.doesNotMatch(privateSource, /test-support-v2/u);
  assert.doesNotMatch(wrapperSource, /test-support-v2/u);

  const boundedReadStart = privateSource.indexOf("function readStrictBoundedJsonV2(");
  const boundedReadEnd = privateSource.indexOf(
    "function observeBuildProvenanceV2(",
    boundedReadStart,
  );
  assert.ok(boundedReadStart >= 0 && boundedReadEnd > boundedReadStart);
  assert.equal(
    privateSource.slice(boundedReadStart, boundedReadEnd).match(/return result;/gu)?.length,
    1,
    "bounded document descriptor failures must still execute the final ancestor fence",
  );

  const sourceRoot = path.resolve("src");
  const importers = readdirSync(sourceRoot, { recursive: true })
    .map(String)
    .filter((relative) => relative.endsWith(".ts"))
    .filter((relative) => readFileSync(path.join(sourceRoot, relative), "utf8")
      .includes("private-platform-release-production-admission-readiness-v2"));
  assert.deepEqual(importers.sort(), [supportRelative, wrapperRelative].sort());

  const productionModule = await import(
    "../../src/execution/platform-release-production-admission-readiness-v2.js"
  );
  assert.deepEqual(Object.keys(productionModule), [
    "observePlatformReleaseProductionAdmissionReadinessV2",
  ]);
});

test("strict policy produces one canonical, recursively frozen blocked Darwin receipt", () => {
  assert.equal(PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.commandTimeoutMs, 5_000);
  assert.equal(PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.channelByteCap, 32 * 1024);
  assert.equal(PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_MAX_CANONICAL_BYTES_V2, 64 * 1024);
  assert.deepEqual(
    PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.environment,
    Object.freeze({
      LC_ALL: "C",
      LANG: "C",
      HOME: "/var/empty",
      PATH: "/usr/bin:/usr/sbin:/bin:/sbin",
    }),
  );
  assert.deepEqual(
    PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2,
    [
      "PLATFORM_UNSUPPORTED",
      "DEVELOPER_ID_APPLICATION_IDENTITY_NOT_OBSERVED",
      "DEVELOPER_ID_INSTALLER_IDENTITY_NOT_OBSERVED",
      "CODE_SIGNING_IDENTITY_OBSERVATION_FAILED",
      "DEVELOPER_ID_TEAM_UNCONFIGURED",
      "DESIGNATED_REQUIREMENT_UNCONFIGURED",
      "INSTALLER_PACKAGE_ID_UNCONFIGURED",
      "OFFLINE_RELEASE_PUBLIC_KEY_UNCONFIGURED",
      "SIGNED_NATIVE_DISTRIBUTION_CATALOG_EMPTY",
      "NOTARYTOOL_UNAVAILABLE",
      "NOTARYTOOL_OBSERVATION_FAILED",
      "NOTARY_CREDENTIAL_CONFIGURATION_UNVERIFIABLE",
      "NOTARIZED_DISTRIBUTION_UNPROVEN",
      "GATEKEEPER_DISABLED",
      "GATEKEEPER_OBSERVATION_FAILED",
      "SIP_DISABLED",
      "SIP_OBSERVATION_FAILED",
      "AUTHENTICATED_ROOT_DISABLED_OR_UNAVAILABLE",
      "AMFI_SERVICE_UNAVAILABLE",
      "AUTHENTICATED_RUNNING_HELPER_ABSENT",
      "AMFI_RUNTIME_ADMISSION_UNPROVEN",
      "INSTALLER_RECEIPT_UNOBSERVED_CONFIGURATION_UNAVAILABLE",
      "INSTALLED_SETFARM_ROOT_ABSENT",
      "INSTALLED_HELPER_ABSENT",
      "EXACT_INSTALLED_PAYLOAD_BINDING_UNPROVEN",
      "PRODUCTION_TRUST_CONFIGURATION_UNAVAILABLE",
      "V2_PLATFORM_RELEASE_MANIFEST_AUTHORITY_UNAVAILABLE",
      "PREPARED_RELEASE_STORE_AUTHORITY_UNAVAILABLE",
      "FRESH_VERIFIER_AUTHORITY_UNAVAILABLE",
      "REGISTRY_V2_ACTIVATION_AUTHORITY_UNAVAILABLE",
      "HOST_OBSERVATION_INCOMPLETE",
    ],
  );

  const receipt = parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
    validDarwinCandidate(),
  );
  assert.deepEqual(receipt.blockerCodes, EXPECTED_BLOCKERS);
  assert.equal(receipt.productionAuthority, false);
  assert.equal(receipt.productionAdmission, "blocked");
  assert.equal(receipt.mutationAuthority, false);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.codeSigning), true);
  assertRecursivelyFrozen(receipt);
  assert.ok(
    Buffer.byteLength(
      canonicalPlatformReleaseProductionAdmissionReadinessV2(receipt),
      "utf8",
    ) <= 64 * 1024,
  );
  assert.deepEqual(receipt.blockerCodes.slice(-3), [
    "PREPARED_RELEASE_STORE_AUTHORITY_UNAVAILABLE",
    "FRESH_VERIFIER_AUTHORITY_UNAVAILABLE",
    "REGISTRY_V2_ACTIVATION_AUTHORITY_UNAVAILABLE",
  ]);
});

test("the hashed public policy binds every actual fixed target without an observer duplicate", () => {
  assert.deepEqual(PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2, POLICY);
  assertRecursivelyFrozen(PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2);
  assert.ok(Buffer.byteLength(
    canonicalJsonStringify(PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2),
    "utf8",
  ) <= 16 * 1024);

  const mutations: Array<readonly [string, Record<string, unknown>]> = [
    ["supported platform", { ...POLICY, supportedPlatform: "unsupported" }],
    ["blocker order", { ...POLICY, blockerOrder: POLICY.blockerOrder.slice(1) }],
    ["command plan", {
      ...POLICY,
      commandPlan: [
        { ...POLICY.commandPlan[0], executable: "/tmp/caller-controlled" },
        ...POLICY.commandPlan.slice(1),
      ],
    }],
    ["installed root target", {
      ...POLICY,
      fixedPathPlan: [
        {
          ...POLICY.fixedPathPlan[0],
          target: { kind: "absolute", value: "/Library/Application Support/Setfarm/forged" },
        },
        ...POLICY.fixedPathPlan.slice(1),
      ],
    }],
    ["package identifier", {
      ...POLICY,
      installerPackageIdentifier: { state: "configured", publicValue: "forged" },
    }],
    ["production trust", {
      ...POLICY,
      requiredProductionTrustConfiguration: {
        ...POLICY.requiredProductionTrustConfiguration,
        state: "configured",
      },
    }],
    ["resolved Xcode target", {
      ...POLICY,
      fixedPathPlan: POLICY.fixedPathPlan.map((entry) =>
        entry.ref === "NOTARYTOOL_RESOLVED_TOOL"
          ? { ...entry, target: { kind: "absolute", value: "/tmp/notarytool" } }
          : entry),
    }],
  ];
  for (const [name, policy] of mutations) {
    const candidate = validDarwinCandidate();
    candidate.policyHash = hashCanonicalJson({
      schema:
        "setfarm.platform-release-production-admission-readiness-policy-hash.v2",
      policy,
    });
    rehashReadinessOnly(candidate);
    assert.throws(
      () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
        candidate,
      ),
      /policy hash/i,
      name,
    );
  }

  const privateSource = readFileSync(
    path.resolve(
      "src/execution/private-platform-release-production-admission-readiness-v2.ts",
    ),
    "utf8",
  );
  assert.doesNotMatch(privateSource, /platform-release-bootstrap-contract-v2/u);
  assert.doesNotMatch(
    privateSource,
    /\/Library\/Application Support\/Setfarm|\/Applications\/Xcode\.app|dist\/(?:BUILD_INFO|PLATFORM_RELEASE_MANIFEST)\.json|\/usr\/bin\/(?:codesign|security)|\/usr\/sbin\/(?:pkgutil|spctl)/u,
  );
  assert.match(privateSource, /\.fixedPathPlan/u);
});

test("strict candidate parsing rejects structural hostility before invoking values", () => {
  const mutations: Array<[string, () => unknown, RegExp]> = [
    ["unknown field", () => ({ ...validDarwinCandidate(), surprise: true }), /unrecognized|unknown/i],
    ["cycle", () => {
      const value = validDarwinCandidate();
      value.loop = value;
      return value;
    }, /CANONICAL_JSON_CYCLE/u],
    ["sparse array", () => {
      const value = validDarwinCandidate();
      const sparse = new Array(2);
      sparse[0] = EXPECTED_BLOCKERS[0];
      value.blockerCodes = sparse;
      return value;
    }, /CANONICAL_JSON_SPARSE_ARRAY/u],
    ["non-enumerable property", () => Object.defineProperty(
      validDarwinCandidate(),
      "hidden",
      { value: true, enumerable: false },
    ), /CANONICAL_JSON_NON_ENUMERABLE_PROPERTY/u],
    ["symbol property", () => Object.assign(validDarwinCandidate(), {
      [Symbol("hidden")]: true,
    }), /CANONICAL_JSON_SYMBOL_PROPERTY/u],
    ["oversized candidate", () => ({
      ...validDarwinCandidate(),
      oversized: "x".repeat(PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_MAX_CANONICAL_BYTES_V2),
    }), /CANONICAL_JSON_MAX_BYTES_EXCEEDED/u],
  ];

  for (const [name, makeCandidate, expected] of mutations) {
    assert.throws(
      () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
        makeCandidate(),
      ),
      expected,
      name,
    );
  }

  let getterCalled = false;
  const hostile = Object.defineProperty({}, "schema", {
    enumerable: true,
    get() {
      getterCalled = true;
      return PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_V2_SCHEMA;
    },
  });
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(hostile),
    /CANONICAL_JSON_/u,
  );
  assert.equal(getterCalled, false);

  let proxyGetCalled = false;
  const proxy = new Proxy(Object.create({ candidate: validDarwinCandidate() }), {
    get(target, property, receiver) {
      proxyGetCalled = true;
      return Reflect.get(target, property, receiver);
    },
  });
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(proxy),
    /CANONICAL_JSON_UNSUPPORTED_PROTOTYPE/u,
  );
  assert.equal(proxyGetCalled, false);
});

test("strict semantics reject blocker and hash tampering", () => {
  const reordered = validDarwinCandidate();
  const reorderedCodes = reordered.blockerCodes as string[];
  [reorderedCodes[0], reorderedCodes[1]] = [reorderedCodes[1]!, reorderedCodes[0]!];
  rehashReceipt(reordered);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(reordered),
    /blocker/i,
  );

  const duplicate = validDarwinCandidate();
  (duplicate.blockerCodes as string[]).splice(1, 0, EXPECTED_BLOCKERS[0]);
  rehashReceipt(duplicate);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(duplicate),
    /blocker/i,
  );

  const nestedDrift = validDarwinCandidate();
  ((nestedDrift.installedDistribution as {
    expectedRoots: Array<Record<string, unknown>>;
  }).expectedRoots[0]!).observationHash = "f".repeat(64);
  rehashReceipt(nestedDrift);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(nestedDrift),
    /observation hash/i,
  );

  const policyDrift = validDarwinCandidate();
  policyDrift.policyHash = "f".repeat(64);
  const policyDriftIdentity = { ...policyDrift };
  delete policyDriftIdentity.readinessHash;
  policyDrift.readinessHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-production-admission-readiness-hash.v2",
    receipt: policyDriftIdentity,
  });
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(policyDrift),
    /policy hash/i,
  );

  const authorityTamper = validDarwinCandidate();
  authorityTamper.productionAuthority = true;
  rehashReceipt(authorityTamper);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(authorityTamper),
  );

  const missingFutureAuthority = validDarwinCandidate();
  (missingFutureAuthority.blockerCodes as string[]).pop();
  rehashReceipt(missingFutureAuthority);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      missingFutureAuthority,
    ),
    /blocker/i,
  );

  const mismatchedToolBinding = validDarwinCandidate();
  const toolObservation: Record<string, unknown> = {
    kind: "tool_availability",
    executableRef: "SECURITY",
    argvRef: "CODESIGN_AVAILABILITY",
    status: "completed",
    exitCode: 0,
    signal: null,
    projectionByteLength: 0,
    result: {
      kind: "tool_availability",
      tool: "stapler",
      state: "available",
    },
    observationHash: "0".repeat(64),
  };
  refreshCommandObservation(toolObservation);
  (mismatchedToolBinding.commandObservations as unknown[]).push(toolObservation);
  rehashReceipt(mismatchedToolBinding);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      mismatchedToolBinding,
    ),
    /command binding/i,
  );

  const configuredPackageIdentifier = validDarwinCandidate();
  (configuredPackageIdentifier.installedDistribution as {
    installerPackageIdentifier: string;
  }).installerPackageIdentifier = "configured_public_value_unjoined";
  rehashReceipt(configuredPackageIdentifier);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      configuredPackageIdentifier,
    ),
    /package identifier/i,
  );
});

test("command observations are exact, unique, and projection-compatible", () => {
  const reorderedCompleteSet = validDarwinCandidate();
  (reorderedCompleteSet.commandObservations as unknown[]).reverse();
  rehashReceipt(reorderedCompleteSet);
  assert.doesNotThrow(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      reorderedCompleteSet,
    ),
    "command occurrence order must not invent observation authority",
  );

  const missing = validDarwinCandidate();
  (missing.commandObservations as unknown[]).pop();
  rehashReceipt(missing);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(missing),
    /exact command observation/i,
  );

  const duplicate = validDarwinCandidate();
  const duplicateCommands = duplicate.commandObservations as Array<Record<string, unknown>>;
  duplicateCommands[14] = clone(duplicateCommands[0]!);
  rehashReceipt(duplicate);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(duplicate),
    /exact command observation/i,
  );

  const projectionMismatch = validDarwinCandidate();
  const projectionCommand = (projectionMismatch.commandObservations as Array<
    Record<string, unknown>
  >)[0]!;
  projectionCommand.projectionByteLength =
    Number(projectionCommand.projectionByteLength) + 1;
  projectionCommand.observationHash = hashCommandObservation(projectionCommand);
  rehashReceipt(projectionMismatch);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      projectionMismatch,
    ),
    /projection byte length/i,
  );
});

test("non-completed commands fail closed and summaries equal command results", () => {
  const nonCompleted = validDarwinCandidate();
  const codesignCommand = (nonCompleted.commandObservations as Array<
    Record<string, unknown>
  >)[6]!;
  codesignCommand.status = "timed_out";
  codesignCommand.exitCode = null;
  codesignCommand.signal = "SIGKILL";
  codesignCommand.observationHash = hashCommandObservation(codesignCommand);
  (nonCompleted.blockerCodes as string[]).push("HOST_OBSERVATION_INCOMPLETE");
  rehashReceipt(nonCompleted);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      nonCompleted,
    ),
    /non-completed command.*observation-failed/i,
  );

  const contradictoryIdentity = validDarwinCandidate();
  const identity = (contradictoryIdentity.commandObservations as Array<
    Record<string, unknown>
  >)[0]!;
  identity.exitCode = 1;
  identity.result = {
    kind: "identity_count",
    identityClass: "developer_id_application",
    validIdentityCount: null,
    state: "observation_failed",
  };
  refreshCommandObservation(identity);
  rehashReceipt(contradictoryIdentity);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      contradictoryIdentity,
    ),
    /code-signing summary/i,
  );

  const contradictoryNotary = validDarwinCandidate();
  const notarytool = (contradictoryNotary.commandObservations as Array<
    Record<string, unknown>
  >)[10]!;
  notarytool.result = {
    kind: "tool_availability",
    tool: "notarytool",
    state: "observation_failed",
  };
  refreshCommandObservation(notarytool);
  rehashReceipt(contradictoryNotary);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      contradictoryNotary,
    ),
    /notarization summary/i,
  );

  const contradictoryHost = validDarwinCandidate();
  const gatekeeper = (contradictoryHost.commandObservations as Array<
    Record<string, unknown>
  >)[2]!;
  gatekeeper.exitCode = 1;
  gatekeeper.result = { kind: "gatekeeper", state: "observation_failed" };
  refreshCommandObservation(gatekeeper);
  rehashReceipt(contradictoryHost);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      contradictoryHost,
    ),
    /host-enforcement summary/i,
  );

  const contradictoryProfiles = validDarwinCandidate();
  const profile = (contradictoryProfiles.commandObservations as Array<
    Record<string, unknown>
  >)[12]!;
  profile.exitCode = 0;
  profile.result = {
    kind: "notary_profile_metadata",
    serviceRef: "GKE_NOTARY_TOOL",
    state: "present_unjoined",
  };
  refreshCommandObservation(profile);
  rehashReceipt(contradictoryProfiles);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      contradictoryProfiles,
    ),
    /notarization summary/i,
  );
});

test("fully rehashed receipts reject command, path, and derived-summary contradictions", () => {
  const favorableNonzero = validDarwinCandidate();
  const gatekeeper = (favorableNonzero.commandObservations as Array<
    Record<string, unknown>
  >)[2]!;
  gatekeeper.exitCode = 7;
  refreshCommandObservation(gatekeeper);
  rehashReceipt(favorableNonzero);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      favorableNonzero,
    ),
    /terminal|exit|command semantic/i,
  );

  const wrongNotaryExit = validDarwinCandidate();
  const profile = (wrongNotaryExit.commandObservations as Array<
    Record<string, unknown>
  >)[12]!;
  profile.exitCode = 1;
  refreshCommandObservation(profile);
  rehashReceipt(wrongNotaryExit);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      wrongNotaryExit,
    ),
    /terminal|exit|notary profile/i,
  );

  const substitutedPathRef = validDarwinCandidate();
  const root = (substitutedPathRef.installedDistribution as {
    expectedRoots: Array<Record<string, unknown>>;
  }).expectedRoots[0]!;
  root.ref = "INSTALLED_SETFARM_APPLICATION";
  root.observationHash = hashPathObservation(root);
  rehashReceipt(substitutedPathRef);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      substitutedPathRef,
    ),
    /path.*tuple|fixed-path.*exact|reference/i,
  );

  for (const [field, value] of [
    ["ticketEvidence", "unproven"],
    ["exactPayloadBinding", "unproven"],
  ] as const) {
    const contradictory = validDarwinCandidate();
    if (field === "ticketEvidence") {
      (contradictory.notarization as Record<string, unknown>)[field] = value;
    } else {
      (contradictory.installedDistribution as Record<string, unknown>)[field] = value;
    }
    rehashReceipt(contradictory);
    assert.throws(
      () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
        contradictory,
      ),
      /path|payload|ticket|summary/i,
      field,
    );
  }

  const trustDrift = validDarwinCandidate();
  (trustDrift.productionTrustConfiguration as Record<string, unknown>).state =
    "configured_public_material_unjoined";
  trustDrift.blockerCodes = (trustDrift.blockerCodes as string[]).filter(
    (blocker) => blocker !== "PRODUCTION_TRUST_CONFIGURATION_UNAVAILABLE",
  );
  rehashReceipt(trustDrift);
  assert.throws(
    () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
      trustDrift,
    ),
    /productionTrustConfiguration|production trust|unavailable/i,
  );
});

test("an unconfigured package identifier forbids every receipt lookup result", () => {
  for (const installerReceipt of [
    "not_observed",
    "present_unjoined",
    "observation_failed",
  ]) {
    const candidate = validDarwinCandidate();
    (candidate.installedDistribution as {
      installerReceipt: string;
    }).installerReceipt = installerReceipt;
    if (installerReceipt === "observation_failed") {
      (candidate.blockerCodes as string[]).push("HOST_OBSERVATION_INCOMPLETE");
    }
    rehashReceipt(candidate);
    assert.throws(
      () => parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(candidate),
      /receipt lookup.*package identifier/i,
      installerReceipt,
    );
  }
});

test("serialized diagnostic clones remain non-authoritative and isolated from authority APIs", () => {
  const receipt = parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
    validDarwinCandidate(),
  );
  const serializedClone = clone(receipt) as PlatformReleaseProductionAdmissionReadinessV2;
  const reparsed = parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
    serializedClone,
  );
  assert.equal(reparsed.productionAuthority, false);
  assert.equal(reparsed.productionAdmission, "blocked");
  assert.equal(reparsed.trustConclusion, "characterization_only");

  const sourceRoot = path.resolve("src");
  const productionSources = readdirSync(sourceRoot, { recursive: true })
    .map(String)
    .filter((relative) => relative.endsWith(".ts"))
    .filter((relative) => !relative.endsWith(".test.ts"))
    .filter((relative) => relative !== (
      "execution/schemas/platform-release-production-admission-readiness-v2.ts"
    ));
  assert.ok(
    productionSources.includes("execution/platform-release-source-admission-v2.ts"),
    "the production census must include admission modules without authority in their filename",
  );
  assert.ok(
    productionSources.includes("cli/cli.ts"),
    "the parser census must include CLI modules that may safely import serialization",
  );
  const allowedParserImporters = new Set([
    "execution/private-platform-release-production-admission-readiness-v2.ts",
  ]);
  const internalParserImporters = productionSources.filter((relative) => {
    const source = readFileSync(path.join(sourceRoot, relative), "utf8");
    return /\bparsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2\b/u
      .test(source);
  });
  assert.deepEqual(
    internalParserImporters.filter(
      (relative) => !allowedParserImporters.has(relative),
    ),
    [],
    "only the private observer core may reference the internal candidate parser",
  );

  const allowedReadinessConsumers = new Set([
    "execution/private-platform-release-production-admission-readiness-v2.ts",
    "execution/platform-release-production-admission-readiness-v2.ts",
    "product-compiler/platform-release-production-admission-readiness-test-support-v2.ts",
    "cli/cli.ts",
  ]);
  const readinessConsumers = productionSources.filter((relative) => {
    const source = readFileSync(path.join(sourceRoot, relative), "utf8");
    return /\b(?:PlatformReleaseProductionAdmissionReadinessV2|canonicalPlatformReleaseProductionAdmissionReadinessV2)\b|platform-release-production-admission-readiness-v2/u
      .test(source);
  });
  assert.deepEqual(
    readinessConsumers.filter(
      (relative) => !allowedReadinessConsumers.has(relative),
    ),
    [],
    "only the four closed safe consumers may reference the readiness module, type, or serializer",
  );
});
