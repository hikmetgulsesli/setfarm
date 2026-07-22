import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import {
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2,
  NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA,
  NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA,
} from "./node-scaffold-toolchain-catalog-v2.js";
import {
  HOST_NODE_TOOLCHAIN_AUTHORITY_REF_V2,
  HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA,
} from "./host-node-toolchain-receipt-v2.js";

export const EFFECTIVE_NPM_CONFIG_RECEIPT_V2_SCHEMA =
  "setfarm.effective-npm-config-receipt.v2" as const;
export const NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_RECEIPT_V2_SCHEMA =
  "setfarm.node-scaffold-execution-environment-receipt.v2" as const;
export const NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_AUTHORITY_REF_V2 =
  "AUTH_NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2" as const;
export const NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VERSION_V2 = "2.0.0" as const;
export const NODE_SCAFFOLD_PRIVATE_NPMRC_CONTENT_HASH_V2 =
  "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b" as const;

export const NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VARIABLE_NAMES_V2 = Object.freeze([
  "CI",
  "HOME",
  "LANG",
  "LC_ALL",
  "NODE_DISABLE_COMPILE_CACHE",
  "NO_COLOR",
  "NPM_CONFIG_CACHE",
  "NPM_CONFIG_GLOBALCONFIG",
  "NPM_CONFIG_LOGS_MAX",
  "NPM_CONFIG_REGISTRY",
  "NPM_CONFIG_USERCONFIG",
  "PATH",
  "TEMP",
  "TMP",
  "TMPDIR",
  "TZ",
] as const);

const AdmissionScopeV2Schema = z.enum(["production_host", "test_fixture"]);
const ProfileIdV2Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);
const EntryRefV2Schema = z.enum([
  "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2",
  "NODE_SCAFFOLD_TOOLCHAIN_NODE_EXPRESS_API_V2",
]);
const PosixIdentityV2Schema = z.number().int().nonnegative().max(4_294_967_294);

const CatalogBindingV2Schema = z.object({
  catalogSchema: z.literal(NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA),
  catalogHash: Sha256Schema,
  entrySchema: z.literal(NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA),
  entryRef: EntryRefV2Schema,
  entryHash: Sha256Schema,
  profileId: ProfileIdV2Schema,
  environmentRef: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2),
  environmentContractHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expectedEntry = value.profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    ? "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2"
    : "NODE_SCAFFOLD_TOOLCHAIN_NODE_EXPRESS_API_V2";
  if (value.entryRef !== expectedEntry) {
    context.addIssue({
      code: "custom",
      path: ["entryRef"],
      message: "Execution environment profile and catalog entry must join exactly",
    });
  }
});

const HostToolchainBindingV2Schema = z.object({
  receiptSchema: z.literal(HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA),
  authorityRef: z.literal(HOST_NODE_TOOLCHAIN_AUTHORITY_REF_V2),
  receiptHash: Sha256Schema,
  nodeIdentityHash: Sha256Schema,
  npmClosureHash: Sha256Schema,
  npmVersion: z.literal("10.9.8"),
}).strict();

const PrivateNpmrcIdentityV2Schema = z.object({
  pathRef: z.enum([
    "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2",
    "PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2",
  ]),
  normalizedPrivateLocator: z.enum(["user.npmrc", "global.npmrc"]),
  canonicalContent: z.literal("single_lf_blank_file"),
  rawHash: z.literal(NODE_SCAFFOLD_PRIVATE_NPMRC_CONTENT_HASH_V2),
  rawByteLength: z.literal(1),
  mode: z.literal("0600"),
  ownerUid: PosixIdentityV2Schema,
  ownerGid: PosixIdentityV2Schema,
  linkCount: z.literal(1),
  identityHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expectedLocator = value.pathRef === "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2"
    ? "user.npmrc"
    : "global.npmrc";
  const { identityHash: _identityHash, ...identity } = value;
  if (value.normalizedPrivateLocator !== expectedLocator) {
    context.addIssue({
      code: "custom",
      path: ["normalizedPrivateLocator"],
      message: "Private npmrc locator must match its stable path reference",
    });
  }
  if (value.identityHash !== hashPrivateNpmrcIdentityV2(identity)) {
    context.addIssue({
      code: "custom",
      path: ["identityHash"],
      message: "Private npmrc identity hash must bind its exact file evidence",
    });
  }
});

export type PrivateNpmrcIdentityHashPayloadV2 = Omit<
  z.infer<typeof PrivateNpmrcIdentityV2Schema>,
  "identityHash"
>;

export function hashPrivateNpmrcIdentityV2(
  value: PrivateNpmrcIdentityHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.private-npmrc-file-identity-hash.v2",
    file: value,
  });
}

export type PrivateNpmrcIdentityV2 = z.infer<typeof PrivateNpmrcIdentityV2Schema>;

const EffectiveConfigV2Schema = z.object({
  registry: z.literal("https://registry.npmjs.org"),
  cachePathRef: z.literal("PRIVATE_STAGE_NPM_CACHE_V2"),
  userConfigPathRef: z.literal("PRIVATE_STAGE_EMPTY_USER_NPMRC_V2"),
  globalConfigPathRef: z.literal("PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2"),
  prefixPolicy: z.literal("host_toolchain_default_never_used_for_global_install"),
  location: z.literal("user"),
  proxy: z.literal("absent"),
  httpsProxy: z.literal("absent"),
  noProxy: z.literal("empty"),
  ca: z.literal("absent"),
  caFile: z.literal("absent"),
  certificate: z.literal("absent"),
  privateKey: z.literal("absent"),
  strictSsl: z.literal(true),
  color: z.literal(false),
  lifecycle: z.object({
    baselineIgnoreScripts: z.literal(false),
    foregroundScripts: z.literal(false),
    scriptShell: z.literal("default_null"),
    shell: z.literal("sh"),
    installLifecycleBarrier: z.literal("exact_install_argv_ignore_scripts"),
    installCommandRef: z.literal("CMD_NODE_SCAFFOLD_INSTALL_V2"),
    installDirectArgvHash: Sha256Schema,
  }).strict(),
  networkSideEffects: z.object({
    baselineAudit: z.literal(true),
    baselineFund: z.literal(true),
    installOverride: z.literal("exact_install_argv_no_audit_no_fund"),
  }).strict(),
  processCacheAndLogs: z.object({
    nodeCompileCache: z.literal("disabled"),
    npmLogsMax: z.literal(0),
    processReceiptAuthority: z.literal("canonical_command_stdout_stderr_receipt_v2"),
  }).strict(),
}).strict();

const EffectiveNpmConfigReceiptIdentityV2Schema = z.object({
  schema: z.literal(EFFECTIVE_NPM_CONFIG_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VERSION_V2),
  authorityRef: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_AUTHORITY_REF_V2),
  authorityVersion: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VERSION_V2),
  status: z.literal("verified"),
  admissionScope: AdmissionScopeV2Schema,
  catalogBinding: CatalogBindingV2Schema,
  hostToolchain: HostToolchainBindingV2Schema,
  environmentBinding: z.object({
    environmentHash: Sha256Schema,
    constructionPolicy: z.literal("deny_all_then_exact_set"),
    inheritedAmbientVariableCount: z.literal(0),
  }).strict(),
  probe: z.object({
    probeRef: z.literal("HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2"),
    executableRef: z.literal("TOOL_NODE_NPM_CLI_V2"),
    directArgv: z.tuple([
      z.literal("npm"),
      z.literal("config"),
      z.literal("list"),
      z.literal("--json"),
    ]),
    cwdRef: z.literal("PRIVATE_ENVIRONMENT_CONFIG_PROBE_CWD_V2"),
    shell: z.literal("forbidden"),
    timeoutMs: z.literal(5_000),
    maxStdoutBytes: z.literal(32_768),
    maxStderrBytes: z.literal(4_096),
    rawOutputHash: Sha256Schema,
    keySetHash: Sha256Schema,
    keyCount: z.number().int().positive().max(1_024),
  }).strict(),
  sourceIsolation: z.object({
    ambientEnvironment: z.literal("not_inherited"),
    ambientNpmConfigPolicy: z.literal("case_insensitive_strip_all_before_exact_set"),
    probeProjectNpmrc: z.object({
      normalizedLocator: z.literal(".npmrc"),
      state: z.literal("absent"),
      evidenceAuthority: z.literal("private_probe_cwd_fresh_capture_v2"),
    }).strict(),
    executionProjectNpmrc: z.object({
      requiredState: z.literal("absent"),
      evidenceStatus: z.literal("pending_file_tree_join"),
      evidenceAuthority: z.literal("future_file_tree_manifest_v2"),
    }).strict(),
    userNpmrc: PrivateNpmrcIdentityV2Schema,
    globalNpmrc: PrivateNpmrcIdentityV2Schema,
    builtinNpmrc: z.object({
      locator: z.literal("npmrc"),
      state: z.literal("absent"),
      evidenceAuthority: z.literal("host_npm_package_every_and_only_closure_v2"),
      npmClosureHash: Sha256Schema,
    }).strict(),
  }).strict(),
  effectiveConfig: EffectiveConfigV2Schema,
  effectiveConfigHash: Sha256Schema,
  secretAuthority: z.object({
    status: z.literal("absent"),
    credentialVariableRefs: z.tuple([]),
    discoveredCredentialConfigCount: z.literal(0),
  }).strict(),
}).strict();

export type EffectiveNpmConfigReceiptHashPayloadV2 = z.infer<
  typeof EffectiveNpmConfigReceiptIdentityV2Schema
>;

export function hashEffectiveNpmConfigV2(
  value: z.infer<typeof EffectiveConfigV2Schema>,
): string {
  return hashCanonicalJson({
    schema: "setfarm.effective-npm-config-hash.v2",
    effectiveConfig: value,
  });
}

export function hashEffectiveNpmConfigReceiptV2(
  value: EffectiveNpmConfigReceiptHashPayloadV2 | EffectiveNpmConfigReceiptV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.effective-npm-config-receipt-hash.v2",
    receipt: payload,
  });
}

export const EffectiveNpmConfigReceiptV2Schema =
  EffectiveNpmConfigReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.sourceIsolation.userNpmrc.pathRef
        !== "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2"
      || value.sourceIsolation.globalNpmrc.pathRef
        !== "PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2"
      || value.sourceIsolation.userNpmrc.identityHash
        === value.sourceIsolation.globalNpmrc.identityHash
      || value.sourceIsolation.builtinNpmrc.npmClosureHash
        !== value.hostToolchain.npmClosureHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceIsolation"],
        message: "Effective npm sources must bind distinct private configs and the exact npm closure",
      });
    }
    if (value.effectiveConfigHash !== hashEffectiveNpmConfigV2(value.effectiveConfig)) {
      context.addIssue({
        code: "custom",
        path: ["effectiveConfigHash"],
        message: "Effective npm config hash must bind every normalized value",
      });
    }
    if (value.receiptHash !== hashEffectiveNpmConfigReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Effective npm config receipt hash must bind the exact receipt",
      });
    }
  });

export type EffectiveNpmConfigReceiptV2 = z.infer<
  typeof EffectiveNpmConfigReceiptV2Schema
>;

const ExecutionEnvironmentReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VERSION_V2),
  authorityRef: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_AUTHORITY_REF_V2),
  authorityVersion: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VERSION_V2),
  status: z.literal("verified_environment_pending_file_tree_join"),
  admissionScope: AdmissionScopeV2Schema,
  productionUse: z.literal("forbidden_until_private_materializer_and_file_tree_join"),
  catalogBinding: CatalogBindingV2Schema,
  hostToolchain: HostToolchainBindingV2Schema,
  privateMaterialization: z.object({
    layoutRef: z.literal("PRIVATE_NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_LAYOUT_V2"),
    rootIdentityHash: Sha256Schema,
    rootMode: z.literal("0700"),
    ownerUid: PosixIdentityV2Schema,
    ownerGid: PosixIdentityV2Schema,
    freshnessPolicy: z.literal("exclusive_random_root_no_adoption_v2"),
    directoryMode: z.literal("0700"),
    directoryRefs: z.tuple([
      z.literal("PRIVATE_ENVIRONMENT_CONFIG_PROBE_CWD_V2"),
      z.literal("PRIVATE_STAGE_HOME_V2"),
      z.literal("PRIVATE_STAGE_NPM_CACHE_V2"),
      z.literal("PRIVATE_STAGE_TMP_V2"),
    ]),
    userNpmrc: PrivateNpmrcIdentityV2Schema,
    globalNpmrc: PrivateNpmrcIdentityV2Schema,
    destructionPolicy: z.literal("authenticated_owned_root_only_v2"),
  }).strict(),
  environment: z.object({
    environmentRef: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2),
    environmentContractHash: Sha256Schema,
    constructionPolicy: z.literal("deny_all_then_exact_set"),
    inheritAmbientEnvironment: z.literal(false),
    inheritedVariableAllowlist: z.tuple([]),
    ambientNpmConfigPolicy: z.literal("case_insensitive_strip_all_before_exact_set"),
    exactVariableCount: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VARIABLE_NAMES_V2.length),
    exactVariableNames: z.tuple([
      z.literal("CI"),
      z.literal("HOME"),
      z.literal("LANG"),
      z.literal("LC_ALL"),
      z.literal("NODE_DISABLE_COMPILE_CACHE"),
      z.literal("NO_COLOR"),
      z.literal("NPM_CONFIG_CACHE"),
      z.literal("NPM_CONFIG_GLOBALCONFIG"),
      z.literal("NPM_CONFIG_LOGS_MAX"),
      z.literal("NPM_CONFIG_REGISTRY"),
      z.literal("NPM_CONFIG_USERCONFIG"),
      z.literal("PATH"),
      z.literal("TEMP"),
      z.literal("TMP"),
      z.literal("TMPDIR"),
      z.literal("TZ"),
    ]),
    environmentHash: Sha256Schema,
    privateBindings: z.object({
      HOME: z.literal("PRIVATE_STAGE_HOME_V2"),
      NPM_CONFIG_CACHE: z.literal("PRIVATE_STAGE_NPM_CACHE_V2"),
      NPM_CONFIG_GLOBALCONFIG: z.literal("PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2"),
      NPM_CONFIG_USERCONFIG: z.literal("PRIVATE_STAGE_EMPTY_USER_NPMRC_V2"),
      PATH: z.literal("HOST_TOOLCHAIN_EXACT_COMMAND_PATH_V2"),
      TEMP: z.literal("PRIVATE_STAGE_TMP_V2"),
      TMP: z.literal("PRIVATE_STAGE_TMP_V2"),
      TMPDIR: z.literal("PRIVATE_STAGE_TMP_V2"),
    }).strict(),
  }).strict(),
  recipeBindings: z.tuple([
    z.object({
      commandRef: z.literal("CMD_BUILD"),
      environmentHash: Sha256Schema,
    }).strict(),
    z.object({
      commandRef: z.literal("CMD_NODE_SCAFFOLD_INSTALL_V2"),
      environmentHash: Sha256Schema,
    }).strict(),
    z.object({
      commandRef: z.literal("CMD_TEST"),
      environmentHash: Sha256Schema,
    }).strict(),
  ]),
  effectiveNpmConfig: z.object({
    receiptSchema: z.literal(EFFECTIVE_NPM_CONFIG_RECEIPT_V2_SCHEMA),
    receiptHash: Sha256Schema,
    effectiveConfigHash: Sha256Schema,
    status: z.literal("verified"),
  }).strict(),
  executionProjectNpmrc: z.object({
    requiredState: z.literal("absent"),
    evidenceStatus: z.literal("pending_file_tree_join"),
    evidenceAuthority: z.literal("future_file_tree_manifest_v2"),
  }).strict(),
  secretAuthority: z.object({
    status: z.literal("absent"),
    credentialVariableRefs: z.tuple([]),
  }).strict(),
}).strict();

export type NodeScaffoldExecutionEnvironmentReceiptHashPayloadV2 = z.infer<
  typeof ExecutionEnvironmentReceiptIdentityV2Schema
>;

export function hashNodeScaffoldExecutionEnvironmentReceiptV2(
  value:
    | NodeScaffoldExecutionEnvironmentReceiptHashPayloadV2
    | NodeScaffoldExecutionEnvironmentReceiptV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-scaffold-execution-environment-receipt-hash.v2",
    receipt: payload,
  });
}

export const NodeScaffoldExecutionEnvironmentReceiptV2Schema =
  ExecutionEnvironmentReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const hashes = value.recipeBindings.map((binding) => binding.environmentHash);
    if (hashes.some((hash) => hash !== value.environment.environmentHash)) {
      context.addIssue({
        code: "custom",
        path: ["recipeBindings"],
        message: "Install, build and test must bind one exact environment hash",
      });
    }
    if (
      value.environment.environmentContractHash
        !== value.catalogBinding.environmentContractHash
      || value.privateMaterialization.userNpmrc.identityHash
        === value.privateMaterialization.globalNpmrc.identityHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["environment"],
        message: "Execution environment must bind its catalog contract and distinct npmrc identities",
      });
    }
    if (value.receiptHash !== hashNodeScaffoldExecutionEnvironmentReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Execution environment receipt hash must bind the exact receipt",
      });
    }
  });

export type NodeScaffoldExecutionEnvironmentReceiptV2 = z.infer<
  typeof NodeScaffoldExecutionEnvironmentReceiptV2Schema
>;
