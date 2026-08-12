import { z } from "zod";

import {
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  GitCodeShaSchema,
  ProductIdSchema,
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  CANONICAL_RUNTIME_TREE_V2_PROFILES,
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
} from "./canonical-runtime-tree-v2.js";
import {
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const CANDIDATE_BUILD_RECEIPT_V2_SCHEMA =
  "setfarm.candidate-build-receipt.v2" as const;
export const CANDIDATE_BUILD_RECEIPT_V2_VERSION = "2.1.0" as const;
export const CANDIDATE_BUILD_OPERATION_V2_SCHEMA =
  "setfarm.candidate-build-operation.v2" as const;
export const CANDIDATE_BUILD_SOURCE_CHECKPOINT_V2_SCHEMA =
  "setfarm.candidate-build-source-checkpoint.v2" as const;
export const CANDIDATE_BUILD_PROCESS_OUTCOME_V2_SCHEMA =
  "setfarm.candidate-build-process-outcome.v2" as const;
export const CANDIDATE_BUILD_OUTPUT_TREE_BINDING_V2_SCHEMA =
  "setfarm.candidate-build-output-tree-binding.v2" as const;
export const CANDIDATE_BUILD_OUTPUT_FILE_V2_SCHEMA =
  "setfarm.candidate-build-output-file.v2" as const;
export const CANDIDATE_CANONICAL_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA =
  "setfarm.candidate-canonical-runtime-tree-artifact-ref.v2" as const;

export const CANDIDATE_BUILD_RECEIPT_V2_MAX_CANONICAL_BYTES = 256 * 1024;
export const CANDIDATE_CANONICAL_RUNTIME_TREE_ENVELOPE_MAX_BYTES_V2 =
  128 * 1024 * 1024;

export const CANDIDATE_BUILD_RECEIPT_V2_BLOCKER_CODES = Object.freeze([
  "CANDIDATE_BUILD_V2_ATOMIC_ARTIFACT_SET_ACTIVATION_UNVERIFIED",
  "CANDIDATE_BUILD_V2_EVIDENCE_PLAN_V2_UNVERIFIED",
  "CANDIDATE_BUILD_V2_REGISTRY_V2_UNVERIFIED",
  "CANDIDATE_BUILD_V2_RUNTIME_BUNDLE_UNVERIFIED",
] as const);

export const CANDIDATE_BUILD_PROCESS_POLICY_V2 = Object.freeze({
  stdin: "closed" as const,
  timeoutMs: 120_000 as const,
  maxStdoutBytes: 1_048_576 as const,
  maxStderrBytes: 1_048_576 as const,
  shell: "forbidden" as const,
  ambientEnvironment: "forbidden" as const,
  outputLimitDisposition: "typed_build_rejection" as const,
  timeoutDisposition: "typed_build_rejection" as const,
  nonzeroOrSignalDisposition: "typed_build_rejection" as const,
});

export const CANDIDATE_BUILD_RECEIPT_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.candidate-build-receipt-contract.v2" as const,
  contractVersion: CANDIDATE_BUILD_RECEIPT_V2_VERSION,
  sourceAuthority:
    "verified_candidate_source_v1_semantic_revision_and_physical_fence" as const,
  operationAuthority:
    "build_topology_v3_2_direct_authenticated_node_typescript_target" as const,
  environmentAuthority: "deny_all_then_exact_set_v2" as const,
  processOutcome: "typed_bounded_exited_zero_only" as const,
  processEvidenceBinding:
    "authenticated_host_environment_compiler_argv_and_project_scope" as const,
  outputAuthority:
    "every_and_only_profile_dist_members_canonical_runtime_tree_v2" as const,
  pathDisclosure: "forbidden" as const,
  gitPlaceholder: "forbidden" as const,
  productionUse: "forbidden" as const,
  blockerCodes: CANDIDATE_BUILD_RECEIPT_V2_BLOCKER_CODES,
});

export const CANDIDATE_BUILD_RECEIPT_CONTRACT_HASH_V2 = hashCanonicalJson(
  CANDIDATE_BUILD_RECEIPT_CONTRACT_V2,
);

const CandidateBuildBlockerCodeV2Schema = z.enum(
  CANDIDATE_BUILD_RECEIPT_V2_BLOCKER_CODES,
);

export const CandidateBuildProducerV2Schema = z.object({
  pass: z.literal("candidate-build-authority-v2"),
  codeSha: GitCodeShaSchema,
  toolVersions: z.object({
    candidateBuild: z.literal(CANDIDATE_BUILD_RECEIPT_V2_VERSION),
    candidateSource: z.literal("1.0.0"),
    buildTopology: z.literal("3.2.0"),
    canonicalRuntimeTree: z.literal("2.0.0"),
  }).strict(),
}).strict();

export type CandidateBuildProducerV2 = z.infer<
  typeof CandidateBuildProducerV2Schema
>;

const TypeScriptCompilerTargetV2Schema = z.object({
  executableRef: z.literal("TOOL_NODE_TYPESCRIPT_TSC_V2"),
  exactVersion: z.literal("5.9.3"),
  commandName: z.literal("tsc"),
  packagePath: z.literal("node_modules/typescript"),
  linkLocator: z.literal("node_modules/.bin/tsc"),
  targetLocator: z.literal("node_modules/typescript/bin/tsc"),
  linkTargetHash: Sha256Schema,
  targetContentHash: Sha256Schema,
  executionDisposition: z.literal(
    "direct_target_via_authenticated_node_runtime",
  ),
}).strict();

const CandidateBuildProcessPolicyV2Schema = z.object({
  stdin: z.literal(CANDIDATE_BUILD_PROCESS_POLICY_V2.stdin),
  timeoutMs: z.literal(CANDIDATE_BUILD_PROCESS_POLICY_V2.timeoutMs),
  maxStdoutBytes: z.literal(CANDIDATE_BUILD_PROCESS_POLICY_V2.maxStdoutBytes),
  maxStderrBytes: z.literal(CANDIDATE_BUILD_PROCESS_POLICY_V2.maxStderrBytes),
  shell: z.literal(CANDIDATE_BUILD_PROCESS_POLICY_V2.shell),
  ambientEnvironment: z.literal(
    CANDIDATE_BUILD_PROCESS_POLICY_V2.ambientEnvironment,
  ),
  outputLimitDisposition: z.literal(
    CANDIDATE_BUILD_PROCESS_POLICY_V2.outputLimitDisposition,
  ),
  timeoutDisposition: z.literal(
    CANDIDATE_BUILD_PROCESS_POLICY_V2.timeoutDisposition,
  ),
  nonzeroOrSignalDisposition: z.literal(
    CANDIDATE_BUILD_PROCESS_POLICY_V2.nonzeroOrSignalDisposition,
  ),
}).strict();

const CandidateBuildOperationIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_BUILD_OPERATION_V2_SCHEMA),
  topologySchema: z.literal("setfarm.build-topology.v3"),
  topologyVersion: z.literal("3.2.0"),
  commandRef: z.literal("CMD_NODE_PRODUCT_BUILD_V3"),
  executableRef: z.literal("TOOL_NODE_RUNTIME_V2"),
  compilerExecutableRef: z.literal("TOOL_NODE_TYPESCRIPT_TSC_V2"),
  compilerTarget: TypeScriptCompilerTargetV2Schema,
  cwdRootRef: z.literal("PATH_ROOT_NODE_REPOSITORY_V2"),
  directArgv: z.tuple([
    z.literal("node"),
    z.literal("node_modules/typescript/bin/tsc"),
    z.literal("-p"),
    z.literal("tsconfig.json"),
  ]),
  shell: z.literal("forbidden"),
  processPolicy: CandidateBuildProcessPolicyV2Schema,
  commandContractHash: Sha256Schema,
  compilationContractHash: Sha256Schema,
}).strict();

export type CandidateBuildOperationHashPayloadV2 = z.infer<
  typeof CandidateBuildOperationIdentityV2Schema
>;

export function hashCandidateBuildOperationV2(
  value: CandidateBuildOperationHashPayloadV2 | CandidateBuildOperationV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.operationHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-build-operation-hash.v2",
    operation: payload,
  });
}

export const CandidateBuildOperationV2Schema =
  CandidateBuildOperationIdentityV2Schema.extend({
    operationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.operationHash !== hashCandidateBuildOperationV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["operationHash"],
        message: "Candidate build operation hash must bind the exact V3.2 operation",
      });
    }
  });

export type CandidateBuildOperationV2 = z.infer<
  typeof CandidateBuildOperationV2Schema
>;

const CandidateBuildSourceCheckpointIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_BUILD_SOURCE_CHECKPOINT_V2_SCHEMA),
  candidateSourceEnvelopeHash: Sha256Schema,
  candidateSourceReceiptHash: Sha256Schema,
  semanticRevisionHash: Sha256Schema,
  sourceMaterializationReceiptHash: Sha256Schema,
  sourceDirectoryPhysicalIdentityHash: Sha256Schema,
  dependencyReceiptHash: Sha256Schema,
  dependencyIdentityHash: Sha256Schema,
}).strict();

export type CandidateBuildSourceCheckpointHashPayloadV2 = z.infer<
  typeof CandidateBuildSourceCheckpointIdentityV2Schema
>;

export function hashCandidateBuildSourceCheckpointV2(
  value:
    | CandidateBuildSourceCheckpointHashPayloadV2
    | CandidateBuildSourceCheckpointV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.checkpointHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-build-source-checkpoint-hash.v2",
    checkpoint: payload,
  });
}

export const CandidateBuildSourceCheckpointV2Schema =
  CandidateBuildSourceCheckpointIdentityV2Schema.extend({
    checkpointHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.checkpointHash !== hashCandidateBuildSourceCheckpointV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["checkpointHash"],
        message: "Candidate build source checkpoint hash mismatch",
      });
    }
  });

export type CandidateBuildSourceCheckpointV2 = z.infer<
  typeof CandidateBuildSourceCheckpointV2Schema
>;

const CandidateBuildProcessOutcomeIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_BUILD_PROCESS_OUTCOME_V2_SCHEMA),
  status: z.literal("exited_zero"),
  exitCode: z.literal(0),
  signal: z.null(),
  stdoutHash: Sha256Schema,
  stdoutBytes: z.number().int().nonnegative()
    .max(CANDIDATE_BUILD_PROCESS_POLICY_V2.maxStdoutBytes),
  stderrHash: Sha256Schema,
  stderrBytes: z.number().int().nonnegative()
    .max(CANDIDATE_BUILD_PROCESS_POLICY_V2.maxStderrBytes),
}).strict();

export type CandidateBuildProcessOutcomeHashPayloadV2 = z.infer<
  typeof CandidateBuildProcessOutcomeIdentityV2Schema
>;

export function hashCandidateBuildProcessOutcomeV2(
  value:
    | CandidateBuildProcessOutcomeHashPayloadV2
    | CandidateBuildProcessOutcomeV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.outcomeHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-build-process-outcome-hash.v2",
    outcome: payload,
  });
}

export const CandidateBuildProcessOutcomeV2Schema =
  CandidateBuildProcessOutcomeIdentityV2Schema.extend({
    outcomeHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.outcomeHash !== hashCandidateBuildProcessOutcomeV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["outcomeHash"],
        message: "Candidate build process outcome hash mismatch",
      });
    }
  });

export type CandidateBuildProcessOutcomeV2 = z.infer<
  typeof CandidateBuildProcessOutcomeV2Schema
>;

export const CandidateCanonicalRuntimeTreeArtifactRefV2Schema = z.object({
  schema: z.literal(CANDIDATE_CANONICAL_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA),
  artifactType: z.literal(CANONICAL_RUNTIME_TREE_V2_SCHEMA),
  envelopeHash: Sha256Schema,
  envelopeByteLength: z.number().int().positive()
    .max(CANDIDATE_CANONICAL_RUNTIME_TREE_ENVELOPE_MAX_BYTES_V2),
  producer: CandidateBuildProducerV2Schema,
}).strict();

export type CandidateCanonicalRuntimeTreeArtifactRefV2 = z.infer<
  typeof CandidateCanonicalRuntimeTreeArtifactRefV2Schema
>;

const CandidateBuildOutputFileCommonV2Shape = {
  schema: z.literal(CANDIDATE_BUILD_OUTPUT_FILE_V2_SCHEMA),
  mode: z.literal("0444"),
  executable: z.literal(false),
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive().max(32 * 1024 * 1024),
} as const;

const CandidateBuildCliOutputFilesV2Schema = z.tuple([
  z.object({
    ...CandidateBuildOutputFileCommonV2Shape,
    normalizedLocator: z.literal("dist/cli.js"),
  }).strict(),
  z.object({
    ...CandidateBuildOutputFileCommonV2Shape,
    normalizedLocator: z.literal("dist/cli.setfarm.test.js"),
  }).strict(),
]);

const CandidateBuildApiOutputFilesV2Schema = z.tuple([
  z.object({
    ...CandidateBuildOutputFileCommonV2Shape,
    normalizedLocator: z.literal("dist/app.js"),
  }).strict(),
  z.object({
    ...CandidateBuildOutputFileCommonV2Shape,
    normalizedLocator: z.literal("dist/app.setfarm.test.js"),
  }).strict(),
]);

const CandidateBuildOutputTreeBindingCommonV2Shape = {
  schema: z.literal(CANDIDATE_BUILD_OUTPUT_TREE_BINDING_V2_SCHEMA),
  treeSchema: z.literal(CANONICAL_RUNTIME_TREE_V2_SCHEMA),
  profile: z.literal("dist"),
  logicalRoot: z.literal("candidate-build-output"),
  rootMode: z.literal("0555"),
  memberCount: z.literal(2),
  membershipHash: Sha256Schema,
  treeArtifact: CandidateCanonicalRuntimeTreeArtifactRefV2Schema,
  treeHash: Sha256Schema,
  treePayloadHash: Sha256Schema,
  fileCount: z.literal(2),
  directoryCount: z.literal(0),
  totalBytes: z.number().int().positive()
    .max(CANONICAL_RUNTIME_TREE_V2_PROFILES.dist.maxTotalBytes),
} as const;

const CandidateBuildOutputTreeBindingIdentityV2Schema = z.discriminatedUnion(
  "profileId",
  [
    z.object({
      ...CandidateBuildOutputTreeBindingCommonV2Shape,
      profileId: z.literal("PROFILE_NODE_CLI_STATELESS_EXACT_V2"),
      files: CandidateBuildCliOutputFilesV2Schema,
    }).strict(),
    z.object({
      ...CandidateBuildOutputTreeBindingCommonV2Shape,
      profileId: z.literal("PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"),
      files: CandidateBuildApiOutputFilesV2Schema,
    }).strict(),
  ],
);

export type CandidateBuildOutputTreeBindingHashPayloadV2 = z.infer<
  typeof CandidateBuildOutputTreeBindingIdentityV2Schema
>;

export function hashCandidateBuildOutputMembershipV2(
  files: readonly Readonly<{
    normalizedLocator: string;
    contentHash: string;
    byteLength: number;
  }>[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.candidate-build-output-membership-hash.v2",
    files: files.map((file) => ({
      normalizedLocator: file.normalizedLocator,
      contentHash: file.contentHash,
      byteLength: file.byteLength,
    })),
  });
}

export function hashCandidateBuildOutputTreeBindingV2(
  value:
    | CandidateBuildOutputTreeBindingHashPayloadV2
    | CandidateBuildOutputTreeBindingV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.bindingHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-build-output-tree-binding-hash.v2",
    binding: payload,
  });
}

export const CandidateBuildOutputTreeBindingV2Schema =
  CandidateBuildOutputTreeBindingIdentityV2Schema.and(z.object({
    bindingHash: Sha256Schema,
  }).strict()).superRefine((value, context) => {
    if (value.membershipHash !== hashCandidateBuildOutputMembershipV2(value.files)) {
      context.addIssue({
        code: "custom",
        path: ["membershipHash"],
        message: "Candidate build output membership hash mismatch",
      });
    }
    if (value.totalBytes !== value.files.reduce(
      (total, file) => total + file.byteLength,
      0,
    )) {
      context.addIssue({
        code: "custom",
        path: ["totalBytes"],
        message: "Candidate build output total bytes must equal exact members",
      });
    }
    if (value.bindingHash !== hashCandidateBuildOutputTreeBindingV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "Candidate build output binding hash mismatch",
      });
    }
  });

export type CandidateBuildOutputTreeBindingV2 = z.infer<
  typeof CandidateBuildOutputTreeBindingV2Schema
>;

const CandidateBuildReceiptIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_BUILD_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(CANDIDATE_BUILD_RECEIPT_V2_VERSION),
  contractHash: z.literal(CANDIDATE_BUILD_RECEIPT_CONTRACT_HASH_V2),
  stage: z.literal("private_candidate_build_verified"),
  readiness: z.object({
    status: z.literal("verified_private_shadow"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(CandidateBuildBlockerCodeV2Schema)
      .length(CANDIDATE_BUILD_RECEIPT_V2_BLOCKER_CODES.length),
  }).strict(),
  producer: CandidateBuildProducerV2Schema,
  authority: z.object({
    productRef: ProductIdSchema,
    packet: z.object({
      schema: z.literal("setfarm.product-build-packet.v4"),
      version: z.literal("4.0.0"),
      envelopeHash: Sha256Schema,
      packetHash: Sha256Schema,
    }).strict(),
    implementationClosure: z.object({
      artifactType: z.literal("setfarm.implementation-closure.v2"),
      schema: z.literal("setfarm.implementation-closure.v2"),
      version: z.literal("2.0.0"),
      envelopeHash: Sha256Schema,
      closureHash: Sha256Schema,
    }).strict(),
    candidateSource: z.object({
      schema: z.literal("setfarm.candidate-source-receipt.v1"),
      version: z.literal("1.0.0"),
      envelopeHash: Sha256Schema,
      receiptHash: Sha256Schema,
      semanticRevisionHash: Sha256Schema,
    }).strict(),
    buildTopology: z.object({
      schema: z.literal("setfarm.build-topology.v3"),
      version: z.literal("3.2.0"),
      manifestHash: Sha256Schema,
      logicalBuildHash: Sha256Schema,
      commandContractHash: Sha256Schema,
      compilationContractHash: Sha256Schema,
    }).strict(),
  }).strict(),
  operation: CandidateBuildOperationV2Schema,
  executionAuthority: z.object({
    admissionScope: z.enum(["production_host", "test_fixture"]),
    pathDisclosure: z.literal("forbidden"),
    hostToolchain: z.object({
      receiptHash: Sha256Schema,
      nodeIdentityHash: Sha256Schema,
    }).strict(),
    environment: z.object({
      receiptHash: Sha256Schema,
      environmentContractHash: Sha256Schema,
      effectiveConfigHash: Sha256Schema,
      environmentHash: Sha256Schema,
    }).strict(),
    dependency: z.object({
      receiptHash: Sha256Schema,
      dependencyIdentityHash: Sha256Schema,
      installedBinsMembershipHash: Sha256Schema,
      compilerTarget: TypeScriptCompilerTargetV2Schema,
    }).strict(),
    processBinding: z.object({
      probeRef: z.literal("HOST_NODE_PRODUCT_BUILD_V2"),
      projectScopeHash: Sha256Schema,
      compilerTargetIdentityHash: Sha256Schema,
      directArgvHash: Sha256Schema,
    }).strict(),
  }).strict(),
  sourceBefore: CandidateBuildSourceCheckpointV2Schema,
  sourceAfter: CandidateBuildSourceCheckpointV2Schema,
  processOutcome: CandidateBuildProcessOutcomeV2Schema,
  outputTree: CandidateBuildOutputTreeBindingV2Schema,
}).strict();

export type CandidateBuildReceiptHashPayloadV2 = z.infer<
  typeof CandidateBuildReceiptIdentityV2Schema
>;

export function hashCandidateBuildReceiptV2(
  value: CandidateBuildReceiptHashPayloadV2 | CandidateBuildReceiptV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-build-receipt-hash.v2",
    receipt: payload,
  });
}

export const CandidateBuildReceiptV2Schema =
  CandidateBuildReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const source = value.authority.candidateSource;
    const before = value.sourceBefore;
    const after = value.sourceAfter;
    if (
      before.candidateSourceEnvelopeHash !== source.envelopeHash
      || before.candidateSourceReceiptHash !== source.receiptHash
      || before.semanticRevisionHash !== source.semanticRevisionHash
      || JSON.stringify(before) !== JSON.stringify(after)
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceAfter"],
        message: "Candidate build must fence one unchanged authenticated source",
      });
    }
    const topology = value.authority.buildTopology;
    if (
      value.operation.commandContractHash !== topology.commandContractHash
      || value.operation.compilationContractHash !== topology.compilationContractHash
      || JSON.stringify(value.operation.compilerTarget)
        !== JSON.stringify(value.executionAuthority.dependency.compilerTarget)
      || before.dependencyReceiptHash
        !== value.executionAuthority.dependency.receiptHash
      || before.dependencyIdentityHash
        !== value.executionAuthority.dependency.dependencyIdentityHash
      || value.executionAuthority.processBinding.directArgvHash
        !== hashCanonicalJson({
          schema: "setfarm.candidate-build-direct-argv-hash.v2",
          directArgv: value.operation.directArgv,
        })
    ) {
      context.addIssue({
        code: "custom",
        path: ["executionAuthority"],
        message: "Candidate build topology, dependency, compiler and source fence must join",
      });
    }
    if (
      JSON.stringify(value.readiness.blockerCodes)
        !== JSON.stringify(CANDIDATE_BUILD_RECEIPT_V2_BLOCKER_CODES)
      || JSON.stringify(value.producer)
        !== JSON.stringify(value.outputTree.treeArtifact.producer)
    ) {
      context.addIssue({
        code: "custom",
        path: ["readiness"],
        message: "Candidate build blockers and output producer must be code-owned",
      });
    }
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      CANDIDATE_BUILD_RECEIPT_V2_MAX_CANONICAL_BYTES,
    )) {
      context.addIssue({
        code: "custom",
        message: `Candidate build receipt exceeds ${CANDIDATE_BUILD_RECEIPT_V2_MAX_CANONICAL_BYTES} canonical bytes`,
      });
      return;
    }
    if (value.receiptHash !== hashCandidateBuildReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Candidate build receipt hash must bind the superseding wire",
      });
    }
  });

export type CandidateBuildReceiptV2 = z.infer<
  typeof CandidateBuildReceiptV2Schema
>;

export function parseCandidateBuildReceiptV2(input: unknown): CandidateBuildReceiptV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    CANDIDATE_BUILD_RECEIPT_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    CandidateBuildReceiptV2Schema.parse(snapshot),
  );
}
