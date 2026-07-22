import { z } from "zod";

import { SemanticArtifactEnvelopeV1Schema } from
  "../../product-compiler/artifact-envelope.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../../product-compiler/bounded-canonical-json.js";
import { hashCanonicalJson } from
  "../../product-compiler/canonical-json.js";
import {
  GitCodeShaSchema,
  PathBindingIdSchema,
  Sha256Schema,
  StableReferenceSchema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  IMPLEMENTATION_CLOSURE_ARTIFACT_TYPE_V2,
  IMPLEMENTATION_CLOSURE_V2_SCHEMA,
  IMPLEMENTATION_CLOSURE_V2_VERSION,
} from "../../product-compiler/schemas/implementation-closure-v2.js";
import {
  BUILD_DEPENDENCY_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  SCAFFOLD_BASE_MATERIALIZATION_RECEIPT_V2_SCHEMA,
} from "../../product-compiler/schemas/node-scaffold-private-materialization-v2.js";
import {
  NODE_PRODUCT_SOURCE_MATERIALIZATION_RECEIPT_V1_SCHEMA,
} from "../../product-compiler/schemas/node-product-source-materialization-v1.js";
import {
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
} from "../../product-compiler/schemas/semantic-realization-plan-v2.js";
import { deriveFileTreePathRefV3 } from
  "../../product-compiler/schemas/file-tree-manifest-v3.js";

export const CANDIDATE_SOURCE_RECEIPT_V1_SCHEMA =
  "setfarm.candidate-source-receipt.v1" as const;
export const CANDIDATE_SOURCE_ARTIFACT_TYPE_V1 =
  CANDIDATE_SOURCE_RECEIPT_V1_SCHEMA;
export const CANDIDATE_SOURCE_RECEIPT_VERSION_V1 = "1.0.0" as const;
export const CANDIDATE_SOURCE_SEMANTIC_REVISION_V1_SCHEMA =
  "setfarm.candidate-source-semantic-revision.v1" as const;
export const CANDIDATE_SOURCE_CONTENT_TREE_V1_SCHEMA =
  "setfarm.candidate-source-content-tree.v1" as const;
export const CANDIDATE_SOURCE_CONTENT_ENTRY_V1_SCHEMA =
  "setfarm.candidate-source-content-entry.v1" as const;
export const CANDIDATE_SOURCE_ABSENCE_ENTRY_V1_SCHEMA =
  "setfarm.candidate-source-absence-entry.v1" as const;

export const CANDIDATE_SOURCE_RECEIPT_V1_MAX_CANONICAL_BYTES = 512 * 1024;
export const CANDIDATE_SOURCE_RECEIPT_V1_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 16,
  maxNodes: CANDIDATE_SOURCE_RECEIPT_V1_MAX_CANONICAL_BYTES + 16_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (CANDIDATE_SOURCE_RECEIPT_V1_MAX_CANONICAL_BYTES * 8) + (512 * 1024),
});

export const CANDIDATE_SOURCE_RECEIPT_V1_BLOCKER_CODES = Object.freeze([
  "CANDIDATE_SOURCE_V1_ATOMIC_ARTIFACT_SET_ACTIVATION_UNVERIFIED",
  "CANDIDATE_SOURCE_V1_AUTHENTICATED_BUILD_UNVERIFIED",
  "CANDIDATE_SOURCE_V1_EVIDENCE_PLAN_V2_UNVERIFIED",
  "CANDIDATE_SOURCE_V1_RELEASE_MANIFEST_V2_UNVERIFIED",
] as const);

export const CANDIDATE_SOURCE_RECEIPT_CONTRACT_V1 = Object.freeze({
  schema: "setfarm.candidate-source-receipt-contract.v1" as const,
  contractVersion: CANDIDATE_SOURCE_RECEIPT_VERSION_V1,
  sourceOrigin: "generated_private_materialization_v1" as const,
  semanticRevision:
    "five_exact_content_inputs_plus_project_npmrc_absence_v1" as const,
  pathIdentity: "canonical_file_tree_v3_path_ref_v1" as const,
  implementationCompletion:
    "every_and_only_story_implementation_closure_v2" as const,
  operationalEvidence:
    "authenticated_private_source_materialization_receipt_v1" as const,
  retryIdentity: "semantic_revision_hash_not_operational_receipt_hash" as const,
  pathDisclosure: "forbidden" as const,
  gitPlaceholder: "forbidden" as const,
  productionUse: "forbidden" as const,
  blockerCodes: CANDIDATE_SOURCE_RECEIPT_V1_BLOCKER_CODES,
});

export const CANDIDATE_SOURCE_RECEIPT_CONTRACT_HASH_V1 = hashCanonicalJson(
  CANDIDATE_SOURCE_RECEIPT_CONTRACT_V1,
);

const CandidateSourceBlockerCodeV1Schema = z.enum(
  CANDIDATE_SOURCE_RECEIPT_V1_BLOCKER_CODES,
);

const CandidateSourceProfileIdV1Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);

export const CandidateSourceProducerV1Schema = z.object({
  pass: z.literal("candidate-source-authority-v1"),
  codeSha: GitCodeShaSchema,
  toolVersions: z.object({
    candidateSource: z.literal(CANDIDATE_SOURCE_RECEIPT_VERSION_V1),
    implementationClosure: z.literal(IMPLEMENTATION_CLOSURE_V2_VERSION),
  }).strict(),
}).strict();

export type CandidateSourceProducerV1 = z.infer<
  typeof CandidateSourceProducerV1Schema
>;

const CandidateSourceEntryRoleV1Schema = z.enum([
  "dependency_lock_manifest",
  "package_manifest",
  "runtime_source",
  "test_source",
  "typescript_compiler_config",
]);

const CandidateSourceEntryMediaTypeV1Schema = z.enum([
  "application/json",
  "text/typescript",
]);

const CandidateSourceContentEntryIdentityV1Schema = z.object({
  schema: z.literal(CANDIDATE_SOURCE_CONTENT_ENTRY_V1_SCHEMA),
  role: CandidateSourceEntryRoleV1Schema,
  pathRef: PathBindingIdSchema,
  ownerRef: z.enum([
    "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2",
    "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2",
    "OWNER_SETUP_V3",
  ]),
  normalizedLocator: z.enum([
    "package-lock.json",
    "package.json",
    "src/app.setfarm.test.ts",
    "src/app.ts",
    "src/cli.setfarm.test.ts",
    "src/cli.ts",
    "tsconfig.json",
  ]),
  mediaType: CandidateSourceEntryMediaTypeV1Schema,
  mode: z.literal("0444"),
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive().max(16 * 1024 * 1024),
  sourceIdentityHash: Sha256Schema.nullable(),
}).strict();

export type CandidateSourceContentEntryHashPayloadV1 = z.infer<
  typeof CandidateSourceContentEntryIdentityV1Schema
>;

export function hashCandidateSourceContentEntryV1(
  value:
    | CandidateSourceContentEntryHashPayloadV1
    | CandidateSourceContentEntryV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.entryHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-source-content-entry-hash.v1",
    entry: payload,
  });
}

export const CandidateSourceContentEntryV1Schema =
  CandidateSourceContentEntryIdentityV1Schema.extend({
    entryHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.entryHash !== hashCandidateSourceContentEntryV1(value)) {
      context.addIssue({
        code: "custom",
        path: ["entryHash"],
        message: "Candidate source entry hash must bind its complete content identity",
      });
    }
    const sourceRole = value.role === "runtime_source" || value.role === "test_source";
    if (
      sourceRole !== (value.sourceIdentityHash !== null)
      || (sourceRole && value.mediaType !== "text/typescript")
      || (!sourceRole && value.mediaType !== "application/json")
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceIdentityHash"],
        message: "Candidate source entry role, media type and source identity must agree",
      });
    }
  });

export type CandidateSourceContentEntryV1 = z.infer<
  typeof CandidateSourceContentEntryV1Schema
>;

export function hashCandidateSourceEntryMembershipV1(
  entries: readonly Pick<CandidateSourceContentEntryV1, "role" | "entryHash">[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.candidate-source-entry-membership-hash.v1",
    entries: entries.map((entry) => ({
      role: entry.role,
      entryHash: entry.entryHash,
    })),
  });
}

const CandidateSourceAbsenceEntryIdentityV1Schema = z.object({
  schema: z.literal(CANDIDATE_SOURCE_ABSENCE_ENTRY_V1_SCHEMA),
  role: z.literal("project_npmrc"),
  pathRef: PathBindingIdSchema,
  ownerRef: z.literal("OWNER_SETUP_V3"),
  normalizedLocator: z.literal(".npmrc"),
  absenceHash: Sha256Schema,
}).strict();

export type CandidateSourceAbsenceEntryHashPayloadV1 = z.infer<
  typeof CandidateSourceAbsenceEntryIdentityV1Schema
>;

export function hashCandidateSourceAbsenceEntryV1(
  value:
    | CandidateSourceAbsenceEntryHashPayloadV1
    | CandidateSourceAbsenceEntryV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.entryHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-source-absence-entry-hash.v1",
    entry: payload,
  });
}

export const CandidateSourceAbsenceEntryV1Schema =
  CandidateSourceAbsenceEntryIdentityV1Schema.extend({
    entryHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.entryHash !== hashCandidateSourceAbsenceEntryV1(value)) {
      context.addIssue({
        code: "custom",
        path: ["entryHash"],
        message: "Candidate source absence hash must bind the exact path commitment",
      });
    }
  });

export type CandidateSourceAbsenceEntryV1 = z.infer<
  typeof CandidateSourceAbsenceEntryV1Schema
>;

export function hashCandidateSourceAbsenceMembershipV1(
  entries: readonly Pick<CandidateSourceAbsenceEntryV1, "role" | "entryHash">[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.candidate-source-absence-membership-hash.v1",
    entries: entries.map((entry) => ({
      role: entry.role,
      entryHash: entry.entryHash,
    })),
  });
}

const CandidateSourceContentTreeIdentityV1Schema = z.object({
  schema: z.literal(CANDIDATE_SOURCE_CONTENT_TREE_V1_SCHEMA),
  profileId: CandidateSourceProfileIdV1Schema,
  logicalRoot: z.literal("repository"),
  entryCount: z.literal(5),
  entries: z.array(CandidateSourceContentEntryV1Schema).length(5),
  entryMembershipHash: Sha256Schema,
  absenceCount: z.literal(1),
  absences: z.tuple([CandidateSourceAbsenceEntryV1Schema]),
  absenceMembershipHash: Sha256Schema,
}).strict();

export type CandidateSourceContentTreeHashPayloadV1 = z.infer<
  typeof CandidateSourceContentTreeIdentityV1Schema
>;

export function hashCandidateSourceContentTreeV1(
  value: CandidateSourceContentTreeHashPayloadV1 | CandidateSourceContentTreeV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.contentTreeHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-source-content-tree-hash.v1",
    tree: payload,
  });
}

export const CandidateSourceContentTreeV1Schema =
  CandidateSourceContentTreeIdentityV1Schema.extend({
    contentTreeHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expected = value.profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      ? [
          ["dependency_lock_manifest", "package-lock.json"],
          ["package_manifest", "package.json"],
          ["test_source", "src/cli.setfarm.test.ts"],
          ["runtime_source", "src/cli.ts"],
          ["typescript_compiler_config", "tsconfig.json"],
        ]
      : [
          ["dependency_lock_manifest", "package-lock.json"],
          ["package_manifest", "package.json"],
          ["test_source", "src/app.setfarm.test.ts"],
          ["runtime_source", "src/app.ts"],
          ["typescript_compiler_config", "tsconfig.json"],
        ];
    if (
      value.entries.some((entry, index) =>
        entry.role !== expected[index]?.[0]
        || entry.normalizedLocator !== expected[index]?.[1]
        || entry.pathRef !== deriveFileTreePathRefV3(
          "repository",
          entry.normalizedLocator,
        ))
      || value.absences.some((entry) =>
        entry.pathRef !== deriveFileTreePathRefV3(
          "repository",
          entry.normalizedLocator,
        ))
      || value.entryMembershipHash
        !== hashCandidateSourceEntryMembershipV1(value.entries)
      || value.absenceMembershipHash
        !== hashCandidateSourceAbsenceMembershipV1(value.absences)
      || value.contentTreeHash !== hashCandidateSourceContentTreeV1(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Candidate source content tree must be canonical, complete and hashed",
      });
    }
  });

export type CandidateSourceContentTreeV1 = z.infer<
  typeof CandidateSourceContentTreeV1Schema
>;

const CandidateSourceRevisionAuthorityV1Schema = z.object({
  productRef: StableReferenceSchema,
  profileId: CandidateSourceProfileIdV1Schema,
  packet: z.object({
    envelopeHash: Sha256Schema,
    packetHash: Sha256Schema,
  }).strict(),
  implementationClosure: z.object({
    artifactType: z.literal(IMPLEMENTATION_CLOSURE_ARTIFACT_TYPE_V2),
    schema: z.literal(IMPLEMENTATION_CLOSURE_V2_SCHEMA),
    version: z.literal(IMPLEMENTATION_CLOSURE_V2_VERSION),
    envelopeHash: Sha256Schema,
    closureHash: Sha256Schema,
    producerCodeSha: GitCodeShaSchema,
    storyCount: z.number().int().positive().max(5_000),
    storyIdSetHash: Sha256Schema,
    storyMembershipHash: Sha256Schema,
    dispositionHash: Sha256Schema,
    implementationMode: z.literal(
      "generated_sources_complete_no_model_dispatch",
    ),
    modelDispatch: z.literal("forbidden"),
  }).strict(),
  fileTree: z.object({
    schema: z.literal("setfarm.file-tree-manifest.v3"),
    manifestHash: Sha256Schema,
    pathMembershipHash: Sha256Schema,
  }).strict(),
  buildTopology: z.object({
    schema: z.literal("setfarm.build-topology.v3"),
    version: z.literal("3.2.0"),
    logicalBuildHash: Sha256Schema,
    commandContractHash: Sha256Schema,
    compilationContractHash: Sha256Schema,
  }).strict(),
  runtimeSource: z.object({
    schema: z.literal(NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA),
    logicalReceiptHash: Sha256Schema,
    sourceIdentityHash: Sha256Schema,
    contentHash: Sha256Schema,
  }).strict(),
  testSource: z.object({
    schema: z.literal(NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA),
    logicalReceiptHash: Sha256Schema,
    sourceIdentityHash: Sha256Schema,
    contentHash: Sha256Schema,
  }).strict(),
}).strict();

const CandidateSourceSemanticRevisionIdentityV1Schema = z.object({
  schema: z.literal(CANDIDATE_SOURCE_SEMANTIC_REVISION_V1_SCHEMA),
  revisionVersion: z.literal(CANDIDATE_SOURCE_RECEIPT_VERSION_V1),
  origin: z.literal("generated_private_materialization_v1"),
  authority: CandidateSourceRevisionAuthorityV1Schema,
  contentTree: CandidateSourceContentTreeV1Schema,
}).strict();

export type CandidateSourceSemanticRevisionHashPayloadV1 = z.infer<
  typeof CandidateSourceSemanticRevisionIdentityV1Schema
>;

export function hashCandidateSourceSemanticRevisionV1(
  value:
    | CandidateSourceSemanticRevisionHashPayloadV1
    | CandidateSourceSemanticRevisionV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.revisionHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-source-semantic-revision-hash.v1",
    revision: payload,
  });
}

export const CandidateSourceSemanticRevisionV1Schema =
  CandidateSourceSemanticRevisionIdentityV1Schema.extend({
    revisionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.authority.profileId !== value.contentTree.profileId
      || value.revisionHash !== hashCandidateSourceSemanticRevisionV1(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["revisionHash"],
        message: "Candidate source revision must bind exact authority and content tree",
      });
    }
  });

export type CandidateSourceSemanticRevisionV1 = z.infer<
  typeof CandidateSourceSemanticRevisionV1Schema
>;

const CandidateSourceMaterializedRoleV1Schema = z.object({
  sourceRole: z.enum(["runtime", "test"]),
  sourceReceiptHash: Sha256Schema,
  sourceCasVerificationReceiptHash: Sha256Schema,
  publicationReceiptHash: Sha256Schema,
  publicationCasVerificationReceiptHash: Sha256Schema,
  deepVerificationReceiptHash: Sha256Schema,
  consumerBindingHash: Sha256Schema,
}).strict();

const CandidateSourceMaterializationEvidenceV1Schema = z.object({
  admissionScope: z.enum(["production_host", "test_fixture"]),
  pathDisclosure: z.literal("forbidden"),
  sourceMaterialization: z.object({
    schema: z.literal(NODE_PRODUCT_SOURCE_MATERIALIZATION_RECEIPT_V1_SCHEMA),
    receiptHash: Sha256Schema,
    sourceMembershipHash: Sha256Schema,
    sourceDirectoryPhysicalIdentityHash: Sha256Schema,
    privateRootIdentityHash: Sha256Schema,
  }).strict(),
  scaffoldBase: z.object({
    schema: z.literal(SCAFFOLD_BASE_MATERIALIZATION_RECEIPT_V2_SCHEMA),
    receiptHash: Sha256Schema,
    semanticInputHash: Sha256Schema,
  }).strict(),
  dependency: z.object({
    schema: z.literal(BUILD_DEPENDENCY_MATERIALIZATION_RECEIPT_V2_SCHEMA),
    receiptHash: Sha256Schema,
    dependencyIdentityHash: Sha256Schema,
  }).strict(),
  publicationReceiptSetCommitmentHash: Sha256Schema,
  sourceCount: z.literal(2),
  sources: z.tuple([
    CandidateSourceMaterializedRoleV1Schema,
    CandidateSourceMaterializedRoleV1Schema,
  ]),
}).strict().superRefine((value, context) => {
  if (
    value.sources[0].sourceRole !== "runtime"
    || value.sources[1].sourceRole !== "test"
  ) {
    context.addIssue({
      code: "custom",
      path: ["sources"],
      message: "Candidate source materialization must bind runtime then test",
    });
  }
});

const CandidateSourceReceiptIdentityV1Schema = z.object({
  schema: z.literal(CANDIDATE_SOURCE_RECEIPT_V1_SCHEMA),
  receiptVersion: z.literal(CANDIDATE_SOURCE_RECEIPT_VERSION_V1),
  contractHash: z.literal(CANDIDATE_SOURCE_RECEIPT_CONTRACT_HASH_V1),
  stage: z.literal("final_generated_source_verified_before_private_build"),
  readiness: z.object({
    status: z.literal("verified_private_shadow"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(CandidateSourceBlockerCodeV1Schema)
      .length(CANDIDATE_SOURCE_RECEIPT_V1_BLOCKER_CODES.length),
  }).strict(),
  semanticRevision: CandidateSourceSemanticRevisionV1Schema,
  materialization: CandidateSourceMaterializationEvidenceV1Schema,
}).strict();

export type CandidateSourceReceiptHashPayloadV1 = z.infer<
  typeof CandidateSourceReceiptIdentityV1Schema
>;

export function hashCandidateSourceReceiptV1(
  value: CandidateSourceReceiptHashPayloadV1 | CandidateSourceReceiptV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-source-receipt-hash.v1",
    receipt: payload,
  });
}

const CandidateSourceReceiptCandidateV1Schema =
  CandidateSourceReceiptIdentityV1Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const authority = value.semanticRevision.authority;
    const entries = value.semanticRevision.contentTree.entries;
    const runtime = entries.find((entry) => entry.role === "runtime_source");
    const test = entries.find((entry) => entry.role === "test_source");
    if (
      JSON.stringify(value.readiness.blockerCodes)
        !== JSON.stringify(CANDIDATE_SOURCE_RECEIPT_V1_BLOCKER_CODES)
      || runtime?.contentHash !== authority.runtimeSource.contentHash
      || runtime?.sourceIdentityHash !== authority.runtimeSource.sourceIdentityHash
      || test?.contentHash !== authority.testSource.contentHash
      || test?.sourceIdentityHash !== authority.testSource.sourceIdentityHash
      || value.materialization.admissionScope === "production_host"
        && value.readiness.productionUse !== "forbidden"
      || value.receiptHash !== hashCandidateSourceReceiptV1(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Candidate source receipt must close exact revision and materialization authority",
      });
    }
  });

export const CandidateSourceReceiptV1Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: CANDIDATE_SOURCE_RECEIPT_V1_MAX_CANONICAL_BYTES,
        ...CANDIDATE_SOURCE_RECEIPT_V1_BOUNDED_WORK_LIMITS,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: "Candidate source receipt exceeds canonical byte or work bounds",
      });
    }
  }).pipe(CandidateSourceReceiptCandidateV1Schema);

export type CandidateSourceReceiptV1 = z.infer<
  typeof CandidateSourceReceiptCandidateV1Schema
>;

export const CandidateSourceEnvelopeV1Schema =
  SemanticArtifactEnvelopeV1Schema.extend({
    artifactType: z.literal(CANDIDATE_SOURCE_ARTIFACT_TYPE_V1),
    producer: CandidateSourceProducerV1Schema,
    payload: CandidateSourceReceiptV1Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.producer.codeSha
        !== value.payload.semanticRevision.authority.implementationClosure
          .producerCodeSha
    ) {
      context.addIssue({
        code: "custom",
        path: ["producer", "codeSha"],
        message:
          "Candidate source producer must equal the fresh ImplementationClosureV2 producer",
      });
    }
  });

export type CandidateSourceEnvelopeV1 = z.infer<
  typeof CandidateSourceEnvelopeV1Schema
>;

export function recursivelyFreezeCandidateSourceReceiptV1<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        pending.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}
