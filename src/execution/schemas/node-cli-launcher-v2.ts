import { createHash } from "node:crypto";

import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
} from "./network-isolation-negative-probe-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const NODE_CLI_LAUNCHER_ABI_POLICY_V2_SCHEMA =
  "setfarm.node-cli-launcher-abi-policy.v2" as const;
export const NODE_CLI_LAUNCH_RECEIPT_V2_SCHEMA =
  "setfarm.node-cli-launch-receipt.v2" as const;
export const NODE_CLI_LAUNCHER_ABI_REF_V2 =
  "LAUNCHER_NODE_CLI_ABI_V2" as const;
export const NODE_CLI_LAUNCHER_REF_V2 = "LAUNCH_NODE_CLI_V2" as const;
export const NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2 =
  "dist/execution/launchers/node-cli-v2.js" as const;
export const NODE_CLI_LAUNCHER_SOURCE_MODULE_LOCATOR_V2 =
  "src/execution/launchers/node-cli-v2.ts" as const;
export const NODE_CLI_LAUNCHER_EXPORT_V2 = "launchNodeCliV2" as const;
export const NODE_CLI_APPLICATION_MODULE_LOCATOR_V2 =
  "candidate-bundle/application/cli.js" as const;
export const NODE_CLI_LAUNCH_TIMEOUT_MS_V2 = 30_000 as const;
export const NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2 = 1_048_576 as const;
export const NODE_CLI_LAUNCH_MAX_STDIN_BYTES_V2 = 8 * 1024 * 1024;
export const NODE_CLI_LAUNCH_MAX_ARGV_BYTES_V2 = 256 * 1024;
export const NODE_CLI_LAUNCH_RECEIPT_MAX_CANONICAL_BYTES_V2 = 256 * 1024;
export const NODE_CLI_BOOTSTRAP_SOURCE_V2 = String.raw`
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fail = (code) => {
  process.stderr.write(String(code).slice(0, 1000) + "\n");
  process.exit(125);
};
let config;
try {
  config = JSON.parse(Buffer.from(process.argv[1], "base64url").toString("utf8"));
} catch {
  fail("NODE_CLI_BOOTSTRAP_CONFIG_INVALID");
}
const exactKeys = (value, keys) =>
  value
  && typeof value === "object"
  && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
if (!exactKeys(config, [
  "schema",
  "bundleRoot",
  "modulePath",
  "moduleContentHash",
  "environment",
])) {
  fail("NODE_CLI_BOOTSTRAP_CONFIG_INVALID");
}
delete process.env.__CF_USER_TEXT_ENCODING;
const expectedEnvironmentNames = Object.keys(config.environment).sort();
const observedEnvironmentNames = Object.keys(process.env).sort();
if (
  config.schema !== "setfarm.node-cli-bootstrap-config.v2"
  || typeof config.bundleRoot !== "string"
  || typeof config.modulePath !== "string"
  || !/^[a-f0-9]{64}$/.test(config.moduleContentHash)
  || !exactKeys(config.environment, expectedEnvironmentNames)
  || JSON.stringify(observedEnvironmentNames)
    !== JSON.stringify(expectedEnvironmentNames)
  || expectedEnvironmentNames.some((name) =>
    process.env[name] !== config.environment[name])
) {
  fail("NODE_CLI_BOOTSTRAP_AUTHORITY_INVALID");
}
let bytes;
try {
  if (
    fs.realpathSync(config.bundleRoot) !== config.bundleRoot
    || fs.realpathSync(process.cwd()) !== config.bundleRoot
    || fs.realpathSync(config.modulePath) !== config.modulePath
    || path.dirname(path.dirname(config.modulePath)) !== config.bundleRoot
    || path.basename(path.dirname(config.modulePath)) !== "application"
  ) {
    fail("NODE_CLI_BOOTSTRAP_MODULE_NONCANONICAL");
  }
  bytes = fs.readFileSync(config.modulePath);
} catch {
  fail("NODE_CLI_BOOTSTRAP_MODULE_UNREADABLE");
}
if (
  crypto.createHash("sha256").update(bytes).digest("hex")
    !== config.moduleContentHash
) {
  fail("NODE_CLI_BOOTSTRAP_MODULE_DRIFT");
}
process.umask(0o077);
process.execArgv = [];
process.argv = [process.execPath, config.modulePath, ...process.argv.slice(2)];
import(pathToFileURL(config.modulePath).href).catch((error) => {
  fail(error && error.stack ? error.stack : "NODE_CLI_BOOTSTRAP_IMPORT_FAILED");
});
`;
export const NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2 = createHash("sha256")
  .update(NODE_CLI_BOOTSTRAP_SOURCE_V2)
  .digest("hex");

const NODE_CLI_LAUNCHER_ABI_POLICY_IDENTITY_V2 = Object.freeze({
  schema: NODE_CLI_LAUNCHER_ABI_POLICY_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  launcherRef: NODE_CLI_LAUNCHER_REF_V2,
  moduleLocator: NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2,
  requiredExport: NODE_CLI_LAUNCHER_EXPORT_V2,
  abiRef: NODE_CLI_LAUNCHER_ABI_REF_V2,
  profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2" as const,
  stackPackId: "node-cli" as const,
  invocationKind: "cli_process" as const,
  applicationModuleLocator: NODE_CLI_APPLICATION_MODULE_LOCATOR_V2,
  applicationModuleSystem: "node_esm" as const,
  applicationEntrypointAbi: "NODE_ESM_CLI_ENTRYPOINT_ABI_V2" as const,
  argvPolicy:
    "exact_module_then_transport_subcommand_and_suffix" as const,
  stdinPolicy: "exact_transport_bytes_or_closed" as const,
  nodeOptionPolicy: "fixed_eval_bootstrap_before_candidate_import" as const,
  nodeOptionTokens: Object.freeze(["-e"] as const),
  bootstrapSourceHash: NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2,
  bootstrapConfigSchema: "setfarm.node-cli-bootstrap-config.v2" as const,
  candidateVisibleExecArgv: Object.freeze([] as const),
  candidateVisibleArgv:
    "node_executable_candidate_module_then_transport_arguments" as const,
  knownOsInjectedVariableNames: Object.freeze([
    "__CF_USER_TEXT_ENCODING",
  ] as const),
  childUmask: "0077" as const,
  processGroupPolicy: "isolated_group_killed_on_every_terminal_path" as const,
  shell: "forbidden" as const,
  ambientEnvironment: "forbidden" as const,
  cwdPolicy: "candidate_bundle_root" as const,
  networkPolicy: "macos_sandbox_exec_loopback_only_v2" as const,
  normalizedEnvironmentHash:
    NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
  timeoutMs: NODE_CLI_LAUNCH_TIMEOUT_MS_V2,
  maxStdoutBytes: NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2,
  maxStderrBytes: NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2,
  maxStdinBytes: NODE_CLI_LAUNCH_MAX_STDIN_BYTES_V2,
  maxArgvBytes: NODE_CLI_LAUNCH_MAX_ARGV_BYTES_V2,
  capturePolicy: "bounded_private_bytes_plus_canonical_hashes" as const,
  sourceFencePolicy:
    "fresh_runtime_bundle_and_exact_module_before_after" as const,
  resultAuthority:
    "process_observation_only_never_product_verdict" as const,
  productionAdmission:
    "current_activated_platform_release_and_candidate_execution_lease_required" as const,
  testFixtureAdmission:
    "authentic_test_runtime_bundle_but_production_forbidden" as const,
});

const NodeCliLauncherAbiPolicyIdentityV2Schema = z.object({
  schema: z.literal(NODE_CLI_LAUNCHER_ABI_POLICY_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  launcherRef: z.literal(NODE_CLI_LAUNCHER_REF_V2),
  moduleLocator: z.literal(NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2),
  requiredExport: z.literal(NODE_CLI_LAUNCHER_EXPORT_V2),
  abiRef: z.literal(NODE_CLI_LAUNCHER_ABI_REF_V2),
  profileId: z.literal("PROFILE_NODE_CLI_STATELESS_EXACT_V2"),
  stackPackId: z.literal("node-cli"),
  invocationKind: z.literal("cli_process"),
  applicationModuleLocator: z.literal(
    NODE_CLI_APPLICATION_MODULE_LOCATOR_V2,
  ),
  applicationModuleSystem: z.literal("node_esm"),
  applicationEntrypointAbi: z.literal("NODE_ESM_CLI_ENTRYPOINT_ABI_V2"),
  argvPolicy: z.literal(
    "exact_module_then_transport_subcommand_and_suffix",
  ),
  stdinPolicy: z.literal("exact_transport_bytes_or_closed"),
  nodeOptionPolicy: z.literal(
    "fixed_eval_bootstrap_before_candidate_import",
  ),
  nodeOptionTokens: z.tuple([z.literal("-e")]),
  bootstrapSourceHash: z.literal(NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2),
  bootstrapConfigSchema: z.literal("setfarm.node-cli-bootstrap-config.v2"),
  candidateVisibleExecArgv: z.tuple([]),
  candidateVisibleArgv: z.literal(
    "node_executable_candidate_module_then_transport_arguments",
  ),
  knownOsInjectedVariableNames: z.tuple([
    z.literal("__CF_USER_TEXT_ENCODING"),
  ]),
  childUmask: z.literal("0077"),
  processGroupPolicy: z.literal(
    "isolated_group_killed_on_every_terminal_path",
  ),
  shell: z.literal("forbidden"),
  ambientEnvironment: z.literal("forbidden"),
  cwdPolicy: z.literal("candidate_bundle_root"),
  networkPolicy: z.literal("macos_sandbox_exec_loopback_only_v2"),
  normalizedEnvironmentHash: z.literal(
    NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
  ),
  timeoutMs: z.literal(NODE_CLI_LAUNCH_TIMEOUT_MS_V2),
  maxStdoutBytes: z.literal(NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2),
  maxStderrBytes: z.literal(NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2),
  maxStdinBytes: z.literal(NODE_CLI_LAUNCH_MAX_STDIN_BYTES_V2),
  maxArgvBytes: z.literal(NODE_CLI_LAUNCH_MAX_ARGV_BYTES_V2),
  capturePolicy: z.literal(
    "bounded_private_bytes_plus_canonical_hashes",
  ),
  sourceFencePolicy: z.literal(
    "fresh_runtime_bundle_and_exact_module_before_after",
  ),
  resultAuthority: z.literal(
    "process_observation_only_never_product_verdict",
  ),
  productionAdmission: z.literal(
    "current_activated_platform_release_and_candidate_execution_lease_required",
  ),
  testFixtureAdmission: z.literal(
    "authentic_test_runtime_bundle_but_production_forbidden",
  ),
}).strict();

export function hashNodeCliLauncherAbiPolicyV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const policy = { ...value };
  delete policy.abiHash;
  return hashCanonicalJson({
    schema: "setfarm.node-cli-launcher-abi-policy-hash.v2",
    policy,
  });
}

export const NODE_CLI_LAUNCHER_ABI_HASH_V2 =
  hashNodeCliLauncherAbiPolicyV2(
    NODE_CLI_LAUNCHER_ABI_POLICY_IDENTITY_V2,
  );

export const NodeCliLauncherAbiPolicyV2Schema =
  NodeCliLauncherAbiPolicyIdentityV2Schema.extend({
    abiHash: z.literal(NODE_CLI_LAUNCHER_ABI_HASH_V2),
  }).strict().superRefine((value, context) => {
    if (
      value.abiHash !== hashNodeCliLauncherAbiPolicyV2(value)
      || JSON.stringify(value)
        !== JSON.stringify({
          ...NODE_CLI_LAUNCHER_ABI_POLICY_IDENTITY_V2,
          abiHash: NODE_CLI_LAUNCHER_ABI_HASH_V2,
        })
    ) {
      context.addIssue({
        code: "custom",
        message: "Node CLI launcher ABI must equal exact code-owned policy",
      });
    }
  });

export type NodeCliLauncherAbiPolicyV2 = z.infer<
  typeof NodeCliLauncherAbiPolicyV2Schema
>;

export const NODE_CLI_LAUNCHER_ABI_POLICY_V2 =
  deepFreezePlatformReleaseJsonV2(
    NodeCliLauncherAbiPolicyV2Schema.parse({
      ...NODE_CLI_LAUNCHER_ABI_POLICY_IDENTITY_V2,
      abiHash: NODE_CLI_LAUNCHER_ABI_HASH_V2,
    }),
  );

const ExactUtcMillisecondTimestampV2Schema = z.string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u,
    "Expected one exact UTC millisecond timestamp",
  )
  .refine((value) => {
    const milliseconds = Date.parse(value);
    return !Number.isNaN(milliseconds)
      && new Date(milliseconds).toISOString() === value;
  }, "Expected one valid round-tripping UTC timestamp");

const BoundedCaptureV2Schema = z.object({
  contentHash: Sha256Schema,
  byteLength: z.number().int().nonnegative()
    .max(NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2),
}).strict();

const NodeCliProcessTerminationV2Schema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("exited"),
    exitCode: z.number().int().min(0).max(255),
    signal: z.null(),
  }).strict(),
  z.object({
    status: z.literal("signal_exit"),
    exitCode: z.null(),
    signal: z.string().min(4).max(64)
      .regex(/^SIG[A-Z0-9]+(?:\+[0-9]+)?$/u),
  }).strict(),
  z.object({
    status: z.literal("platform_terminated"),
    reason: z.enum(["output_limit", "timeout"]),
    exitCode: z.null(),
    signal: z.literal("SIGKILL"),
  }).strict(),
]);

const NodeCliLaunchReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_CLI_LAUNCH_RECEIPT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("observed_unverified_release_candidate"),
  productionUse: z.literal("forbidden_until_verified_release_join"),
  admissionScope: z.literal("test_fixture"),
  launcher: z.object({
    launcherRef: z.literal(NODE_CLI_LAUNCHER_REF_V2),
    releaseModuleLocator: z.literal(NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2),
    requiredExport: z.literal(NODE_CLI_LAUNCHER_EXPORT_V2),
    abiRef: z.literal(NODE_CLI_LAUNCHER_ABI_REF_V2),
    abiHash: z.literal(NODE_CLI_LAUNCHER_ABI_HASH_V2),
    observedImplementation: z.object({
      scope: z.literal("test_fixture_typescript_source"),
      moduleLocator: z.literal(
        NODE_CLI_LAUNCHER_SOURCE_MODULE_LOCATOR_V2,
      ),
      moduleContentHash: Sha256Schema,
      modulePhysicalIdentityHash: Sha256Schema,
    }).strict(),
  }).strict(),
  candidate: z.object({
    runtimeBundleHash: Sha256Schema,
    runtimeBundleClosureHash: Sha256Schema,
    buildReceiptHash: Sha256Schema,
    applicationTreeHash: Sha256Schema,
    materializationHash: Sha256Schema,
    moduleLocator: z.literal(NODE_CLI_APPLICATION_MODULE_LOCATOR_V2),
    moduleContentHash: Sha256Schema,
    moduleByteLength: z.number().int().positive()
      .max(64 * 1024 * 1024),
    moduleMode: z.literal("0444"),
    modulePhysicalIdentityHash: Sha256Schema,
  }).strict(),
  transport: z.object({
    actionRef: z.string().min(1).max(160),
    contractHash: Sha256Schema,
    contractSetHash: Sha256Schema,
    contractMembershipHash: Sha256Schema,
    runtimeSourceLogicalReceiptHash: Sha256Schema,
    requestHash: Sha256Schema,
    argvTokenCount: z.number().int().nonnegative().max(10_000),
    argvByteLength: z.number().int().nonnegative()
      .max(NODE_CLI_LAUNCH_MAX_ARGV_BYTES_V2),
    stdinContentHash: Sha256Schema,
    stdinByteLength: z.number().int().nonnegative()
      .max(NODE_CLI_LAUNCH_MAX_STDIN_BYTES_V2),
  }).strict(),
  execution: z.object({
    hostToolchainReceiptHash: Sha256Schema,
    nodeIdentityHash: Sha256Schema,
    nodeExecutableContentHash: Sha256Schema,
    sandboxExecutableContentHash: Sha256Schema,
    sandboxExecutablePhysicalIdentityHash: Sha256Schema,
    sandboxProfileHash: Sha256Schema,
    bootstrapSourceHash: z.literal(NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2),
    normalizedEnvironmentHash: z.literal(
      NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
    ),
    environmentInstanceHash: Sha256Schema,
    shell: z.literal("forbidden"),
    ambientEnvironment: z.literal("forbidden"),
    nodeOptionTokens: z.tuple([z.literal("-e")]),
    candidateVisibleExecArgv: z.tuple([]),
    childUmask: z.literal("0077"),
    processGroupPolicy: z.literal(
      "isolated_group_killed_on_every_terminal_path",
    ),
    cwdPolicy: z.literal("candidate_bundle_root"),
    sourceFenceBeforeHash: Sha256Schema,
    sourceFenceAfterHash: Sha256Schema,
  }).strict(),
  startedAt: ExactUtcMillisecondTimestampV2Schema,
  finishedAt: ExactUtcMillisecondTimestampV2Schema,
  durationMs: z.number().int().nonnegative()
    .max(NODE_CLI_LAUNCH_TIMEOUT_MS_V2 + 5_000),
  process: z.object({
    pid: z.number().int().positive(),
    termination: NodeCliProcessTerminationV2Schema,
    stdout: BoundedCaptureV2Schema,
    stderr: BoundedCaptureV2Schema,
  }).strict(),
}).strict().superRefine((value, context) => {
  const started = Date.parse(value.startedAt);
  const finished = Date.parse(value.finishedAt);
  if (finished < started || finished - started !== value.durationMs) {
    context.addIssue({
      code: "custom",
      path: ["durationMs"],
      message: "Node CLI duration must equal its exact UTC interval",
    });
  }
  if (
    value.execution.sourceFenceBeforeHash
      !== value.execution.sourceFenceAfterHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["execution", "sourceFenceAfterHash"],
      message: "Node CLI launch cannot issue evidence across source drift",
    });
  }
});

export type NodeCliLaunchReceiptHashPayloadV2 = z.infer<
  typeof NodeCliLaunchReceiptIdentityV2Schema
>;

export function hashNodeCliLaunchReceiptV2(
  value:
    | NodeCliLaunchReceiptHashPayloadV2
    | NodeCliLaunchReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-cli-launch-receipt-hash.v2",
    receipt,
  });
}

export const NodeCliLaunchReceiptV2Schema =
  NodeCliLaunchReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        NODE_CLI_LAUNCH_RECEIPT_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: `Node CLI receipt exceeds ${NODE_CLI_LAUNCH_RECEIPT_MAX_CANONICAL_BYTES_V2} canonical bytes`,
      });
      return;
    }
    if (value.receiptHash !== hashNodeCliLaunchReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Node CLI receipt hash must bind the exact observation",
      });
    }
  });

export type NodeCliLaunchReceiptV2 = z.infer<
  typeof NodeCliLaunchReceiptV2Schema
>;

export function parseNodeCliLaunchReceiptV2(
  input: unknown,
): NodeCliLaunchReceiptV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    NODE_CLI_LAUNCH_RECEIPT_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    NodeCliLaunchReceiptV2Schema.parse(snapshot),
  );
}
