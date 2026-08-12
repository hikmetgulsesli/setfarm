import { Buffer } from "node:buffer";

import { z } from "zod";

import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  prepareArtifactStoreBatchPlanV1,
  type ArtifactStoreBatchPutPlanV1,
  type PreparedArtifactStoreBatchV1,
} from "./artifact-store-batch-plan.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import {
  canonicalJsonBytes,
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  SemanticArtifactEnvelopeV1Schema,
  type SemanticArtifactEnvelopeV1,
} from "./artifact-envelope.js";
import {
  generateNodeProductRuntimeSourceV2,
  generateNodeProductRuntimeSourceV2ForTest,
  type NodeProductRuntimeSourceGenerationResultV2,
} from "./node-product-runtime-generator-v2.js";
import {
  generateNodeProductTestSourceV2,
  generateNodeProductTestSourceV2ForTest,
  type NodeProductTestSourceGenerationResultV2,
} from "./node-product-test-generator-v2.js";
import type {
  MaterializedNodeScaffoldPrivateStageV2,
} from "./node-scaffold-private-materializer-v2.js";
import {
  hashProductDeliverySelectionV2,
  ProductDeliverySelectionV2Schema,
} from "./product-delivery-profile-catalog-v2.js";
import {
  BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  BYTE_CHUNK_ARTIFACT_TYPE_V1,
  createByteBundleV1,
  type ByteBundleArtifactV1,
  type ByteChunkArtifactV1,
} from "./schemas/byte-bundle-v1.js";
import {
  SemanticArtifactProducerV1Schema,
  type SemanticArtifactProducerV1,
} from "./schemas/common-v1.js";
import { BuildTopologyV3Schema } from "./schemas/build-topology-v3.js";
import { FileTreeManifestV3Schema } from "./schemas/file-tree-manifest-v3.js";
import {
  NodeProductRuntimeSourceReceiptV2Schema,
  type NodeProductRuntimeSourceReceiptV2,
} from "./schemas/node-product-runtime-source-v2.js";
import {
  NodeProductTestSourceReceiptV2Schema,
  type NodeProductTestSourceReceiptV2,
} from "./schemas/node-product-test-source-v2.js";
import {
  NODE_PRODUCT_SOURCE_PUBLICATION_BLOCKER_CODES_V1,
  NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_SCHEMA,
  NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_VERSION,
  NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_SET_V1_SCHEMA,
  NodeProductSourcePublicationEntryAuthorityV1Schema,
  NodeProductSourcePublicationReceiptSetV1Schema,
  NodeProductSourcePublicationReceiptV1Schema,
  NodeProductSourceRoleV1Schema,
  hashNodeProductSourcePublicationEntryCommitmentV1,
  hashNodeProductSourcePublicationReceiptSetV1,
  hashNodeProductSourcePublicationReceiptV1,
  nodeProductSourcePublicationReceiptRefV1,
  type NodeProductSourcePublicationEntryAuthorityV1,
  type NodeProductSourcePublicationReceiptSetV1,
  type NodeProductSourcePublicationReceiptV1,
  type NodeProductSourceRoleV1,
} from "./schemas/node-product-source-publication-v1.js";
import {
  ProductRuntimeBehaviorContractV1Schema,
  ProductRuntimeBehaviorProposalV1Schema,
} from "./schemas/product-runtime-behavior-contract-v1.js";
import { ProductSpecV2Schema } from "./schemas/product-spec-v2.js";
import {
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
  SemanticRealizationPlanV2Schema,
} from "./schemas/semantic-realization-plan-v2.js";

const COMPILER_INPUT_MAX_CANONICAL_BYTES_V1 = 32 * 1024 * 1024;
const VERIFICATION_INPUT_MAX_CANONICAL_BYTES_V1 = 80 * 1024 * 1024;
const MAX_DIAGNOSTICS_V1 = 100;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const CompilerInputV1Schema = z.object({
  producer: SemanticArtifactProducerV1Schema,
  productSpec: ProductSpecV2Schema,
  deliverySelection: ProductDeliverySelectionV2Schema,
  runtimeBehaviorProposal: ProductRuntimeBehaviorProposalV1Schema,
  runtimeBehaviorContract: ProductRuntimeBehaviorContractV1Schema,
  realizationPlan: SemanticRealizationPlanV2Schema,
  fileTree: FileTreeManifestV3Schema,
  buildTopology: BuildTopologyV3Schema,
}).strict();

export type NodeProductSourcePublicationCompilerInputV1 = z.infer<
  typeof CompilerInputV1Schema
>;

const CandidatePublicationGroupV1Schema = z.object({
  sourceRole: NodeProductSourceRoleV1Schema,
  envelopes: z.array(z.unknown()).min(4).max(9),
}).strict();

const VerificationInputV1Schema = z.object({
  compilerInput: CompilerInputV1Schema,
  candidatePublications: z.array(CandidatePublicationGroupV1Schema).length(2),
}).strict();

export type NodeProductSourcePublicationDiagnosticCodeV1 =
  | "NODE_SOURCE_PUBLICATION_V1_INPUT_INVALID"
  | "NODE_SOURCE_PUBLICATION_V1_RUNTIME_SOURCE_REJECTED"
  | "NODE_SOURCE_PUBLICATION_V1_TEST_SOURCE_REJECTED"
  | "NODE_SOURCE_PUBLICATION_V1_BYTE_BUNDLE_REJECTED"
  | "NODE_SOURCE_PUBLICATION_V1_PUBLICATION_INCOMPATIBLE"
  | "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_INPUT_INVALID"
  | "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_CANDIDATE_INVALID"
  | "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_AUTHORITY_MISMATCH";

export type NodeProductSourcePublicationDiagnosticV1 = Readonly<{
  code: NodeProductSourcePublicationDiagnosticCodeV1;
  path: string;
  message: string;
}>;

type RuntimeSource = Extract<
  NodeProductRuntimeSourceGenerationResultV2,
  { status: "shadow_generated" }
>;
type TestSource = Extract<
  NodeProductTestSourceGenerationResultV2,
  { status: "shadow_generated" }
>;

type SourceReceipt = NodeProductRuntimeSourceReceiptV2
  | NodeProductTestSourceReceiptV2;

export type PreparedNodeProductSourcePublicationV1 = Readonly<{
  sourceRole: NodeProductSourceRoleV1;
  receipt: Readonly<NodeProductSourcePublicationReceiptV1>;
  receiptEnvelope: Readonly<SemanticArtifactEnvelopeV1>;
  receiptArtifactHash: string;
  receiptArtifactByteLength: number;
  sourceReceipt: Readonly<SourceReceipt>;
  sourceReceiptEnvelope: Readonly<SemanticArtifactEnvelopeV1>;
  sourceReceiptArtifactHash: string;
  sourceReceiptArtifactByteLength: number;
  sourceBundleArtifactHash: string;
  sourceBundleArtifactByteLength: number;
  sourceContentHash: string;
  sourceByteLength: number;
  publicationPlan: Readonly<ArtifactStoreBatchPutPlanV1>;
  publicationEnvelopes: readonly Readonly<SemanticArtifactEnvelopeV1>[];
  preparedPublication: PreparedArtifactStoreBatchV1;
}>;

export type NodeProductSourcePublicationCompilationResultV1 =
  | Readonly<{
      status: "shadow_prepared";
      diagnostics: readonly [];
      receiptSet: Readonly<NodeProductSourcePublicationReceiptSetV1>;
      publications: readonly PreparedNodeProductSourcePublicationV1[];
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly NodeProductSourcePublicationDiagnosticV1[];
    }>;

export type VerifiedNodeProductSourcePublicationV1 = Readonly<{
  status: "verified_shadow";
  receiptSet: Readonly<NodeProductSourcePublicationReceiptSetV1>;
  publications: readonly PreparedNodeProductSourcePublicationV1[];
}>;

export type NodeProductSourcePublicationVerificationErrorCodeV1 =
  | "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_INPUT_INVALID"
  | "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_CANDIDATE_INVALID"
  | "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_REPRODUCTION_REJECTED"
  | "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_AUTHORITY_MISMATCH";

export class NodeProductSourcePublicationVerificationErrorV1 extends Error {
  readonly code: NodeProductSourcePublicationVerificationErrorCodeV1;

  constructor(
    code: NodeProductSourcePublicationVerificationErrorCodeV1,
    message: string,
  ) {
    super(message.slice(0, 1_500));
    this.name = "NodeProductSourcePublicationVerificationErrorV1";
    this.code = code;
  }
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 1_500) : "Unknown source publication failure";
}

function diagnostic(
  code: NodeProductSourcePublicationDiagnosticCodeV1,
  path: string,
  message: string,
): NodeProductSourcePublicationDiagnosticV1 {
  return Object.freeze({
    code,
    path: path.slice(0, 1_000),
    message: message.slice(0, 1_500),
  });
}

function rejected(
  diagnostics: readonly NodeProductSourcePublicationDiagnosticV1[],
): NodeProductSourcePublicationCompilationResultV1 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([...diagnostics]
      .sort((left, right) => compareUtf16(
        `${left.path}\0${left.code}\0${left.message}`,
        `${right.path}\0${right.code}\0${right.message}`,
      ))
      .slice(0, MAX_DIAGNOSTICS_V1)),
  });
}

function boundedSnapshotV1(value: unknown, maxBytes: number): unknown {
  const bytes = canonicalJsonBytesBounded(value, {
    maxBytes,
    maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 32,
    maxNodes: maxBytes + 100_000,
    maxContainerEntries:
      DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
    maxWorkUnits: (maxBytes * 8) + (4 * 1024 * 1024),
  });
  return JSON.parse(bytes.toString("utf8"));
}

function deepFreezeJson<T>(value: T): T {
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

function envelopeIdentityV1(envelope: SemanticArtifactEnvelopeV1): Readonly<{
  hash: string;
  byteLength: number;
}> {
  const bytes = canonicalJsonBytes(envelope);
  return Object.freeze({
    hash: hashCanonicalJson(envelope),
    byteLength: bytes.byteLength,
  });
}

function sourceReceiptEnvelopeV1(
  producer: SemanticArtifactProducerV1,
  role: NodeProductSourceRoleV1,
  receipt: SourceReceipt,
): SemanticArtifactEnvelopeV1 {
  return SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: role === "runtime"
      ? NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA
      : NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
    producer,
    payload: receipt,
  });
}

function publicationReceiptEnvelopeV1(
  producer: SemanticArtifactProducerV1,
  receipt: NodeProductSourcePublicationReceiptV1,
): SemanticArtifactEnvelopeV1 {
  return SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_SCHEMA,
    producer,
    payload: receipt,
  });
}

type EntryPreparationV1 = Readonly<{
  sourceRole: NodeProductSourceRoleV1;
  sourceText: string;
  sourceReceipt: SourceReceipt;
  sourceReceiptEnvelope: SemanticArtifactEnvelopeV1;
  sourceReceiptIdentity: Readonly<{ hash: string; byteLength: number }>;
  chunks: readonly ByteChunkArtifactV1[];
  bundle: ByteBundleArtifactV1;
  entryAuthority: NodeProductSourcePublicationEntryAuthorityV1;
  entryCommitmentHash: string;
}>;

function sourceIdentityV1(receipt: SourceReceipt) {
  return {
    pathRef: receipt.source.pathRef,
    normalizedLocator: receipt.source.normalizedLocator,
    mediaType: receipt.source.mediaType,
    encoding: receipt.source.encoding,
    newline: receipt.source.newline,
    contentHash: receipt.source.contentHash,
    byteLength: receipt.source.byteLength,
    lineCount: receipt.source.lineCount,
    sourceIdentityHash: receipt.source.sourceIdentityHash,
  } as const;
}

function prepareEntryV1(
  input: NodeProductSourcePublicationCompilerInputV1,
  runtime: RuntimeSource,
  test: TestSource,
  role: NodeProductSourceRoleV1,
): EntryPreparationV1 {
  const generated = role === "runtime" ? runtime : test;
  const sourceReceipt = role === "runtime"
    ? NodeProductRuntimeSourceReceiptV2Schema.parse(generated.receipt)
    : NodeProductTestSourceReceiptV2Schema.parse(generated.receipt);
  const sourceBytes = Buffer.from(generated.sourceText, "utf8");
  if (sourceBytes.byteLength !== sourceReceipt.source.byteLength) {
    throw new Error(`${role} generated source lost its exact byte identity`);
  }
  const byteBundle = createByteBundleV1({
    bytes: sourceBytes,
    producer: input.producer,
  });
  if (byteBundle.status !== "produced") {
    throw new Error(
      `${role} ByteBundle rejected as ${byteBundle.rejectionCode}: ${
        byteBundle.issues.map((issue) => issue.message).join(", ")}`,
    );
  }
  if (
    byteBundle.rawHash !== sourceReceipt.source.contentHash
    || byteBundle.rawByteLength !== sourceReceipt.source.byteLength
  ) {
    throw new Error(`${role} ByteBundle does not equal the generated source receipt`);
  }
  const sourceReceiptEnvelope = sourceReceiptEnvelopeV1(
    input.producer,
    role,
    sourceReceipt,
  );
  const sourceReceiptIdentity = envelopeIdentityV1(sourceReceiptEnvelope);
  const sourceSet = {
    runtimeLogicalReceiptHash: runtime.receipt.logicalReceiptHash,
    runtimeReceiptHash: runtime.receipt.receiptHash,
    testLogicalReceiptHash: test.receipt.logicalReceiptHash,
    testReceiptHash: test.receipt.receiptHash,
  } as const;
  const entryAuthority = NodeProductSourcePublicationEntryAuthorityV1Schema.parse({
    sourceRole: role,
    productSpecPayloadHash: hashCanonicalJson(input.productSpec),
    deliverySelectionHash: hashProductDeliverySelectionV2(input.deliverySelection),
    runtimeBehavior: {
      proposalHash: input.runtimeBehaviorContract.authority.proposalHash,
      contractHash: input.runtimeBehaviorContract.contractHash,
      evaluatorContractHash:
        input.runtimeBehaviorContract.authority.evaluatorContractHash,
    },
    semanticRealizationPlanHash: input.realizationPlan.planHash,
    fileTreeManifestHash: input.fileTree.manifestHash,
    buildTopology: {
      logicalBuildHash: input.buildTopology.logicalBuildHash,
      manifestHash: input.buildTopology.manifestHash,
    },
    sourceSet,
    source: sourceIdentityV1(sourceReceipt),
    sourceReceiptArtifact: {
      schema: sourceReceipt.schema,
      logicalReceiptHash: sourceReceipt.logicalReceiptHash,
      receiptHash: sourceReceipt.receiptHash,
      envelopeHash: sourceReceiptIdentity.hash,
      envelopeByteLength: sourceReceiptIdentity.byteLength,
    },
    sourceBundle: {
      artifactType: BYTE_BUNDLE_ARTIFACT_TYPE_V1,
      envelopeHash: byteBundle.bundle.envelopeHash,
      envelopeByteLength: byteBundle.bundle.envelopeByteLength,
      rawHash: byteBundle.rawHash,
      rawByteLength: byteBundle.rawByteLength,
    },
  });
  return Object.freeze({
    sourceRole: role,
    sourceText: generated.sourceText,
    sourceReceipt,
    sourceReceiptEnvelope,
    sourceReceiptIdentity,
    chunks: byteBundle.chunks,
    bundle: byteBundle.bundle,
    entryAuthority,
    entryCommitmentHash:
      hashNodeProductSourcePublicationEntryCommitmentV1(entryAuthority),
  });
}

function publicationPlanV1(
  entry: EntryPreparationV1,
  receiptEnvelope: SemanticArtifactEnvelopeV1,
): Readonly<ArtifactStoreBatchPutPlanV1> {
  return deepFreezeJson({
    schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
    items: [
      ...entry.chunks.map((chunk) => ({
        durabilityTier: 0,
        envelope: chunk.envelope,
      })),
      { durabilityTier: 1, envelope: entry.bundle.envelope },
      { durabilityTier: 2, envelope: entry.sourceReceiptEnvelope },
      { durabilityTier: 3, envelope: receiptEnvelope },
    ],
  });
}

function snapshotPublicationV1(
  entry: EntryPreparationV1,
  receipt: NodeProductSourcePublicationReceiptV1,
  receiptEnvelope: SemanticArtifactEnvelopeV1,
  publicationPlan: Readonly<ArtifactStoreBatchPutPlanV1>,
  preparedPublication: PreparedArtifactStoreBatchV1,
): PreparedNodeProductSourcePublicationV1 {
  const items = copyPreparedArtifactStoreBatchCanonicalItemsV1(preparedPublication);
  const immutableEnvelopes = deepFreezeJson([
    ...entry.chunks.map((chunk) => chunk.envelope),
    entry.bundle.envelope,
    entry.sourceReceiptEnvelope,
    receiptEnvelope,
  ].map((envelope) => SemanticArtifactEnvelopeV1Schema.parse(
    JSON.parse(canonicalJsonStringify(envelope)),
  )));
  const immutableReceiptEnvelope = immutableEnvelopes.find((envelope) =>
    envelope.artifactType === NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_SCHEMA)!;
  const immutableSourceReceiptEnvelope = immutableEnvelopes.find((envelope) =>
    envelope.artifactType === entry.sourceReceipt.schema)!;
  const receiptItem = items.find((item) =>
    item.identity.artifactType === NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_SCHEMA)!;
  const sourceReceiptItem = items.find((item) =>
    item.identity.artifactType === entry.sourceReceipt.schema)!;
  const bundleItem = items.find((item) =>
    item.identity.artifactType === BYTE_BUNDLE_ARTIFACT_TYPE_V1)!;
  if (!receiptItem || !sourceReceiptItem || !bundleItem) {
    throw new Error(`${entry.sourceRole} publication lacks exact receipt or bundle artifacts`);
  }
  return Object.freeze({
    sourceRole: entry.sourceRole,
    receipt: immutableReceiptEnvelope.payload as NodeProductSourcePublicationReceiptV1,
    receiptEnvelope: immutableReceiptEnvelope,
    receiptArtifactHash: receiptItem.identity.hash,
    receiptArtifactByteLength: receiptItem.identity.byteLength,
    sourceReceipt: immutableSourceReceiptEnvelope.payload as SourceReceipt,
    sourceReceiptEnvelope: immutableSourceReceiptEnvelope,
    sourceReceiptArtifactHash: sourceReceiptItem.identity.hash,
    sourceReceiptArtifactByteLength: sourceReceiptItem.identity.byteLength,
    sourceBundleArtifactHash: bundleItem.identity.hash,
    sourceBundleArtifactByteLength: bundleItem.identity.byteLength,
    sourceContentHash: receipt.authority.source.contentHash,
    sourceByteLength: receipt.authority.source.byteLength,
    publicationPlan,
    publicationEnvelopes: Object.freeze(immutableEnvelopes),
    preparedPublication,
  });
}

async function compileInternalV1(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<NodeProductSourcePublicationCompilationResultV1> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshotV1(input, COMPILER_INPUT_MAX_CANONICAL_BYTES_V1);
  } catch (error) {
    return rejected([diagnostic(
      "NODE_SOURCE_PUBLICATION_V1_INPUT_INVALID",
      "/",
      errorMessage(error),
    )]);
  }
  const parsed = CompilerInputV1Schema.safeParse(snapshot);
  if (!parsed.success) {
    return rejected(parsed.error.issues.map((issue) => diagnostic(
      "NODE_SOURCE_PUBLICATION_V1_INPUT_INVALID",
      `/${issue.path.join("/")}`,
      issue.message,
    )));
  }
  const authority = {
    productSpec: parsed.data.productSpec,
    deliverySelection: parsed.data.deliverySelection,
    runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
    runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
    realizationPlan: parsed.data.realizationPlan,
    fileTree: parsed.data.fileTree,
    buildTopology: parsed.data.buildTopology,
  };
  const runtime = expectedScope === "production_host"
    ? await generateNodeProductRuntimeSourceV2(handle, authority)
    : await generateNodeProductRuntimeSourceV2ForTest(handle, authority);
  if (runtime.status !== "shadow_generated") {
    return rejected(runtime.diagnostics.map((item) => diagnostic(
      "NODE_SOURCE_PUBLICATION_V1_RUNTIME_SOURCE_REJECTED",
      item.path,
      `${item.code}: ${item.message}`,
    )));
  }
  const test = expectedScope === "production_host"
    ? await generateNodeProductTestSourceV2(handle, {
        ...authority,
        runtimeSourceText: runtime.sourceText,
        runtimeSourceReceipt: runtime.receipt,
      })
    : await generateNodeProductTestSourceV2ForTest(handle, {
        ...authority,
        runtimeSourceText: runtime.sourceText,
        runtimeSourceReceipt: runtime.receipt,
      });
  if (test.status !== "shadow_generated") {
    return rejected(test.diagnostics.map((item) => diagnostic(
      "NODE_SOURCE_PUBLICATION_V1_TEST_SOURCE_REJECTED",
      item.path,
      `${item.code}: ${item.message}`,
    )));
  }
  try {
    const entries = (["runtime", "test"] as const).map((role) =>
      prepareEntryV1(parsed.data, runtime, test, role));
    const setEntries = entries.map((entry) => ({
      sourceRole: entry.sourceRole,
      sourceReceiptSchema: entry.sourceReceipt.schema,
      sourceReceiptHash: entry.sourceReceipt.receiptHash,
      entryCommitmentHash: entry.entryCommitmentHash,
    }));
    const receiptSet = NodeProductSourcePublicationReceiptSetV1Schema.parse({
      schema: NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_SET_V1_SCHEMA,
      entryCount: 2,
      entries: setEntries,
      commitmentHash: hashNodeProductSourcePublicationReceiptSetV1({
        schema: NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_SET_V1_SCHEMA,
        entryCount: 2,
        entries: setEntries,
      }),
    });
    const publications = entries.map((entry) => {
      const receiptWithoutHash = {
        schema: NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_SCHEMA,
        receiptVersion: NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_VERSION,
        readiness: {
          status: "shadow_blocked" as const,
          productionConsumption: "forbidden" as const,
          blockerCodes: [...NODE_PRODUCT_SOURCE_PUBLICATION_BLOCKER_CODES_V1] as [
            typeof NODE_PRODUCT_SOURCE_PUBLICATION_BLOCKER_CODES_V1[0],
            typeof NODE_PRODUCT_SOURCE_PUBLICATION_BLOCKER_CODES_V1[1],
            typeof NODE_PRODUCT_SOURCE_PUBLICATION_BLOCKER_CODES_V1[2],
            typeof NODE_PRODUCT_SOURCE_PUBLICATION_BLOCKER_CODES_V1[3],
          ],
        },
        receiptRef:
          nodeProductSourcePublicationReceiptRefV1(entry.entryCommitmentHash),
        entryCommitmentHash: entry.entryCommitmentHash,
        receiptSet,
        authority: entry.entryAuthority,
      };
      const receipt = NodeProductSourcePublicationReceiptV1Schema.parse({
        ...receiptWithoutHash,
        receiptHash: hashNodeProductSourcePublicationReceiptV1(receiptWithoutHash),
      });
      const receiptEnvelope = publicationReceiptEnvelopeV1(
        parsed.data.producer,
        receipt,
      );
      const publicationPlan = publicationPlanV1(entry, receiptEnvelope);
      const prepared = prepareArtifactStoreBatchPlanV1(publicationPlan);
      return snapshotPublicationV1(
        entry,
        receipt,
        receiptEnvelope,
        publicationPlan,
        prepared,
      );
    });
    return Object.freeze({
      status: "shadow_prepared" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      receiptSet: deepFreezeJson(structuredClone(receiptSet)),
      publications: Object.freeze(publications),
    });
  } catch (error) {
    return rejected([diagnostic(
      errorMessage(error).includes("ByteBundle")
        ? "NODE_SOURCE_PUBLICATION_V1_BYTE_BUNDLE_REJECTED"
        : "NODE_SOURCE_PUBLICATION_V1_PUBLICATION_INCOMPATIBLE",
      "/publication",
      errorMessage(error),
    )]);
  }
}

export function compileNodeProductSourcePublicationV1(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<NodeProductSourcePublicationCompilationResultV1> {
  return compileInternalV1(handle, input, "production_host");
}

export function compileNodeProductSourcePublicationV1ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<NodeProductSourcePublicationCompilationResultV1> {
  return compileInternalV1(handle, input, "test_fixture");
}

function candidatePreparedPublicationV1(
  group: z.infer<typeof CandidatePublicationGroupV1Schema>,
): Readonly<{
  role: NodeProductSourceRoleV1;
  prepared: PreparedArtifactStoreBatchV1;
  envelopes: readonly SemanticArtifactEnvelopeV1[];
}> {
  const envelopes = group.envelopes.map((candidate) =>
    SemanticArtifactEnvelopeV1Schema.parse(candidate));
  const publicationReceipts = envelopes.filter((envelope) =>
    envelope.artifactType === NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_SCHEMA);
  const chunks = envelopes.filter((envelope) =>
    envelope.artifactType === BYTE_CHUNK_ARTIFACT_TYPE_V1);
  const bundles = envelopes.filter((envelope) =>
    envelope.artifactType === BYTE_BUNDLE_ARTIFACT_TYPE_V1);
  const sourceReceipts = envelopes.filter((envelope) =>
    envelope.artifactType === NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA
    || envelope.artifactType === NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA);
  if (
    publicationReceipts.length !== 1
    || chunks.length < 1
    || chunks.length > 6
    || bundles.length !== 1
    || sourceReceipts.length !== 1
    || envelopes.length !== chunks.length + 3
  ) {
    throw new Error("Candidate source publication requires chunks, one bundle, one source receipt and one publication receipt exactly");
  }
  const publicationReceipt = NodeProductSourcePublicationReceiptV1Schema.parse(
    publicationReceipts[0]!.payload,
  );
  const role = publicationReceipt.authority.sourceRole;
  if (role !== group.sourceRole) {
    throw new Error("Candidate group role differs from its publication receipt");
  }
  if (role === "runtime") {
    NodeProductRuntimeSourceReceiptV2Schema.parse(sourceReceipts[0]!.payload);
    if (sourceReceipts[0]!.artifactType !== NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA) {
      throw new Error("Runtime publication contains the wrong source receipt schema");
    }
  } else {
    NodeProductTestSourceReceiptV2Schema.parse(sourceReceipts[0]!.payload);
    if (sourceReceipts[0]!.artifactType !== NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA) {
      throw new Error("Test publication contains the wrong source receipt schema");
    }
  }
  return Object.freeze({
    role,
    envelopes: Object.freeze(envelopes),
    prepared: prepareArtifactStoreBatchPlanV1({
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: [
        ...chunks.map((envelope) => ({ durabilityTier: 0, envelope })),
        { durabilityTier: 1, envelope: bundles[0]! },
        { durabilityTier: 2, envelope: sourceReceipts[0]! },
        { durabilityTier: 3, envelope: publicationReceipts[0]! },
      ],
    }),
  });
}

function occurrenceMultisetV1(
  envelopes: readonly SemanticArtifactEnvelopeV1[],
): readonly string[] {
  return envelopes.map((envelope) => {
    const bytes = canonicalJsonBytes(envelope);
    return `${envelope.artifactType}\0${hashCanonicalJson(envelope)}\0${bytes.byteLength}`;
  }).sort(compareUtf16);
}

function preparedIdentityV1(prepared: PreparedArtifactStoreBatchV1): string {
  return canonicalJsonStringify({
    schema: prepared.schema,
    planIdentityHash: prepared.planIdentityHash,
    occurrenceCount: prepared.occurrenceCount,
    items: prepared.items,
  });
}

async function verifyInternalV1(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<VerifiedNodeProductSourcePublicationV1> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshotV1(input, VERIFICATION_INPUT_MAX_CANONICAL_BYTES_V1);
  } catch (error) {
    throw new NodeProductSourcePublicationVerificationErrorV1(
      "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = VerificationInputV1Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new NodeProductSourcePublicationVerificationErrorV1(
      "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_INPUT_INVALID",
      parsed.error.issues[0]?.message ?? "Source publication verifier input is invalid",
    );
  }
  const reproduced = await compileInternalV1(
    handle,
    parsed.data.compilerInput,
    expectedScope,
  );
  if (reproduced.status !== "shadow_prepared") {
    throw new NodeProductSourcePublicationVerificationErrorV1(
      "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message ?? "Fresh source publication reproduction failed",
    );
  }
  let candidates: readonly ReturnType<typeof candidatePreparedPublicationV1>[];
  try {
    candidates = Object.freeze(parsed.data.candidatePublications.map(
      candidatePreparedPublicationV1,
    ));
  } catch (error) {
    throw new NodeProductSourcePublicationVerificationErrorV1(
      "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_CANDIDATE_INVALID",
      errorMessage(error),
    );
  }
  const candidateRoles = candidates.map((candidate) => candidate.role);
  if (
    candidateRoles[0] !== "runtime"
    || candidateRoles[1] !== "test"
  ) {
    throw new NodeProductSourcePublicationVerificationErrorV1(
      "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_CANDIDATE_INVALID",
      "Candidate publications must contain runtime then test exactly once",
    );
  }
  for (const publication of reproduced.publications) {
    const candidate = candidates.find((item) => item.role === publication.sourceRole);
    if (
      !candidate
      || canonicalJsonStringify(occurrenceMultisetV1(candidate.envelopes))
        !== canonicalJsonStringify(occurrenceMultisetV1(publication.publicationEnvelopes))
      || preparedIdentityV1(candidate.prepared)
        !== preparedIdentityV1(publication.preparedPublication)
    ) {
      throw new NodeProductSourcePublicationVerificationErrorV1(
        "NODE_SOURCE_PUBLICATION_V1_VERIFICATION_AUTHORITY_MISMATCH",
        `${publication.sourceRole} publication differs from fresh source, receipt and batch authority`,
      );
    }
  }
  return Object.freeze({
    status: "verified_shadow" as const,
    receiptSet: reproduced.receiptSet,
    publications: reproduced.publications,
  });
}

export function verifyNodeProductSourcePublicationV1(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedNodeProductSourcePublicationV1> {
  return verifyInternalV1(handle, input, "production_host");
}

export function verifyNodeProductSourcePublicationV1ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedNodeProductSourcePublicationV1> {
  return verifyInternalV1(handle, input, "test_fixture");
}
