import {
  INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  validateInternalProductionOwnerProducerSourceBuildAuthorityV1,
  type InternalProductionOwnerProducerSourceBuildAuthorityAV1,
} from "./owner-admission-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";

export type InternalProductionBaselineOwnerProducerManifestActivationReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-owner-producer-manifest-activation.v1";
  plan: "A";
  manifestHash: string;
  sourceBuildAuthorityRef: string;
  sourceBuildAuthorityHash: string;
  predecessorActivationRef: null;
  predecessorActivationHash: null;
  predecessorHeadRef: null;
  predecessorHeadHash: null;
  successorActivationRef: string;
  successorActivationHash: string;
  successorHeadRef: string;
  successorHeadHash: string;
  receiptRef: string;
  receiptHash: string;
}>;

type BlockedReason = "SUPERSEDED" | "CORRUPTION";
type ActivationStatusPairV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1";
  statusRef: string;
  statusHash: string;
}>;
type NullActivationAuthorityV1 = Readonly<{
  predecessorActivationRef: null; predecessorActivationHash: null;
  predecessorHeadRef: null; predecessorHeadHash: null;
  successorActivationRef: null; successorActivationHash: null;
  successorHeadRef: null; successorHeadHash: null;
  receiptRef: null; receiptHash: null; manifestHash: null;
  sourceBuildAuthorityRef: null; sourceBuildAuthorityHash: null;
}>;
export type InternalProductionBaselineOwnerProducerManifestActivationStatusV1 =
  ActivationStatusPairV1 & (
    | (NullActivationAuthorityV1 & Readonly<{ state: "absent"; blockedReason: null }>)
    | (NullActivationAuthorityV1 & Readonly<{ state: "blocked"; blockedReason: BlockedReason }>)
    | Readonly<{
      state: "active";
      predecessorActivationRef: null; predecessorActivationHash: null;
      predecessorHeadRef: null; predecessorHeadHash: null;
      successorActivationRef: string; successorActivationHash: string;
      successorHeadRef: string; successorHeadHash: string;
      receiptRef: string; receiptHash: string; manifestHash: string;
      sourceBuildAuthorityRef: string; sourceBuildAuthorityHash: string;
      blockedReason: null;
    }>
  );

const SHA256 = /^[a-f0-9]{64}$/;
const STATUS_KEYS = ["schema", "state", "predecessorActivationRef", "predecessorActivationHash", "predecessorHeadRef", "predecessorHeadHash", "successorActivationRef", "successorActivationHash", "successorHeadRef", "successorHeadHash", "receiptRef", "receiptHash", "manifestHash", "sourceBuildAuthorityRef", "sourceBuildAuthorityHash", "blockedReason", "statusRef", "statusHash"] as const;

export function validateInternalProductionBaselineOwnerProducerManifestActivationStatusV1(value: unknown): InternalProductionBaselineOwnerProducerManifestActivationStatusV1 {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || JSON.stringify(Reflect.ownKeys(value).sort()) !== JSON.stringify([...STATUS_KEYS].sort())) throw new TypeError("INTERNAL_PRODUCTION_BASELINE_OWNER_PRODUCER_ACTIVATION_STATUS_KEYS_INVALID");
  for (const key of STATUS_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new TypeError("INTERNAL_PRODUCTION_BASELINE_OWNER_PRODUCER_ACTIVATION_STATUS_KEYS_INVALID");
  }
  const status = value as Record<string, unknown>;
  if (status.schema !== "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1" || !["absent", "active", "blocked"].includes(String(status.state))) throw new TypeError("INTERNAL_PRODUCTION_BASELINE_OWNER_PRODUCER_ACTIVATION_STATUS_SHAPE_INVALID");
  const authorityKeys = STATUS_KEYS.filter((key) => !["schema", "state", "blockedReason", "statusRef", "statusHash"].includes(key));
  const authorities = authorityKeys.map((key) => status[key]);
  if (status.state === "absent" && (!authorities.every((member) => member === null) || status.blockedReason !== null)) throw new TypeError("INTERNAL_PRODUCTION_BASELINE_OWNER_PRODUCER_ACTIVATION_STATUS_SHAPE_INVALID");
  if (status.state === "blocked" && (!authorities.every((member) => member === null) || !["SUPERSEDED", "CORRUPTION"].includes(String(status.blockedReason)))) throw new TypeError("INTERNAL_PRODUCTION_BASELINE_OWNER_PRODUCER_ACTIVATION_STATUS_SHAPE_INVALID");
  if (status.state === "active" && (status.blockedReason !== null || [status.successorActivationRef,status.successorActivationHash,status.successorHeadRef,status.successorHeadHash,status.receiptRef,status.receiptHash,status.manifestHash,status.sourceBuildAuthorityRef,status.sourceBuildAuthorityHash].some((member) => member === null) || [status.predecessorActivationRef,status.predecessorActivationHash,status.predecessorHeadRef,status.predecessorHeadHash].some((member) => member !== null))) throw new TypeError("INTERNAL_PRODUCTION_BASELINE_OWNER_PRODUCER_ACTIVATION_STATUS_SHAPE_INVALID");
  if (status.state === "active") {
    const activePairs = [
      [status.successorActivationRef, status.successorActivationHash, "setfarm://internal-production/owner-producer-manifest-set-activation/sha256/"],
      [status.successorHeadRef, status.successorHeadHash, "setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/"],
      [status.receiptRef, status.receiptHash, "setfarm://internal-production/baseline-owner-producer-manifest-activation-receipt/sha256/"],
      [status.sourceBuildAuthorityRef, status.sourceBuildAuthorityHash, "setfarm://internal-production/owner-producer-source-build-authority/A/sha256/"],
    ] as const;
    if (!SHA256.test(String(status.manifestHash)) || activePairs.some(([ref, hash, prefix]) => !SHA256.test(String(hash)) || ref !== `${prefix}${hash}`)) {
      throw new TypeError("INTERNAL_PRODUCTION_BASELINE_OWNER_PRODUCER_ACTIVATION_STATUS_SHAPE_INVALID");
    }
  }
  const { statusRef: _ref, statusHash: _hash, ...body } = status;
  const hash = hashCanonicalJson(body);
  if (!SHA256.test(String(status.statusHash)) || status.statusHash !== hash || status.statusRef !== `setfarm://internal-production/baseline-owner-producer-manifest-activation-status/sha256/${hash}`) throw new TypeError("INTERNAL_PRODUCTION_BASELINE_OWNER_PRODUCER_ACTIVATION_STATUS_DERIVATION_INVALID");
  return Object.freeze(structuredClone(value)) as InternalProductionBaselineOwnerProducerManifestActivationStatusV1;
}

async function deriveCurrentAuthorityAForController(): Promise<InternalProductionOwnerProducerSourceBuildAuthorityAV1 | null> {
  const receipt = await import("./baseline-post-handoff-receipt-v1.js");
  const pba = await import("./product-build-authority-v2-delivery-evidence-v1.js");
  const git = await import("../execution/v3-git-revision.js");
  const operation = await receipt.observePreparedInternalProductionCurrentEntryOperationV1();
  if (operation === null) return null;
  const source = receipt.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  if (source.sha !== source.originMainSha) throw new Error("CURRENT_SOURCE_DRIFT");
  const observation = await pba.observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1();
  const response = pba.parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(observation.response);
  if (canonicalJsonStringify(operation.controllerSource) !== canonicalJsonStringify(source) || operation.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceRef !== response.deliveryEvidenceRef || operation.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceHash !== response.deliveryEvidenceHash || canonicalJsonStringify(operation.productBuildAuthorityV2Observation.response) !== canonicalJsonStringify(response)) throw new Error("CURRENT_SOURCE_DRIFT");
  const vendorProducerCommit = response.evidence.vendorLock.producerCommit;
  const vendor = git.captureV3GitCommitRevision({ repo: new URL("../..", import.meta.url).pathname, commitSha: vendorProducerCommit });
  git.replayV3HistoricalGitCommitAncestryV1({ repo: new URL("../..", import.meta.url).pathname, ancestorSha: vendorProducerCommit, descendantSha: source.sha, expectedAncestorTreeHash: vendor.treeHash, expectedDescendantTreeHash: source.treeHash, expectedMergeBase: vendorProducerCommit });
  const sourceAfter = receipt.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  if (canonicalJsonStringify(sourceAfter) !== canonicalJsonStringify(source)) throw new Error("CURRENT_SOURCE_DRIFT");
  const body = { schema: "setfarm.internal-production-owner-producer-source-build-authority-a.v1", plan: "A", manifestHash: INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash, currentEntryOperationRef: operation.operationRef, currentEntryOperationHash: operation.operationHash, setfarmSource: source, productBuildAuthorityV2DeliveryEvidenceRef: response.deliveryEvidenceRef, productBuildAuthorityV2DeliveryEvidenceHash: response.deliveryEvidenceHash, productBuildAuthorityV2Observation: observation, vendorProducerCommit, vendorProducerCommitAncestorProof: { schema: "setfarm.internal-production-vendor-ancestor-proof.v1", vendorProducerCommit, setfarmSourceSha: source.sha, mergeBase: vendorProducerCommit, verified: true }, ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1, ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1 } as const;
  const sourceBuildAuthorityHash = hashCanonicalJson(body);
  return validateInternalProductionOwnerProducerSourceBuildAuthorityV1({ ...body, sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${sourceBuildAuthorityHash}`, sourceBuildAuthorityHash });
}

function receiptFrom(source: InternalProductionOwnerProducerSourceBuildAuthorityAV1, activationRef: string, activationHash: string, headRef: string, headHash: string): InternalProductionBaselineOwnerProducerManifestActivationReceiptV1 {
  const body = { schema: "setfarm.internal-production-baseline-owner-producer-manifest-activation.v1", plan: "A", manifestHash: INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash, sourceBuildAuthorityRef: source.sourceBuildAuthorityRef, sourceBuildAuthorityHash: source.sourceBuildAuthorityHash, predecessorActivationRef: null, predecessorActivationHash: null, predecessorHeadRef: null, predecessorHeadHash: null, successorActivationRef: activationRef, successorActivationHash: activationHash, successorHeadRef: headRef, successorHeadHash: headHash } as const;
  const receiptHash = hashCanonicalJson(body);
  return Object.freeze({ ...body, receiptRef: `setfarm://internal-production/baseline-owner-producer-manifest-activation-receipt/sha256/${receiptHash}`, receiptHash });
}

export async function activateInternalProductionBaselineOwnerProducerManifestV1(): Promise<InternalProductionBaselineOwnerProducerManifestActivationReceiptV1> {
  const db = await import("../db-pg.js");
  let committed;
  try {
    committed = await db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();
  } catch {
    throw new Error("CORRUPTION");
  }
  if (committed !== null) {
    if (committed.receipt.phase !== "A") throw new Error("SUPERSEDED");
    const sourcePair = committed.receipt.orderedSourceBuildAuthorities[0]!;
    return receiptFrom(sourcePair as InternalProductionOwnerProducerSourceBuildAuthorityAV1, committed.receipt.activationRef, committed.receipt.activationHash, committed.head.headRef, committed.head.headHash);
  }
  let observedSource: InternalProductionOwnerProducerSourceBuildAuthorityAV1 | null;
  try {
    observedSource = await deriveCurrentAuthorityAForController();
  } catch {
    throw new Error("CURRENT_SOURCE_DRIFT");
  }
  if (observedSource === null) throw new Error("CURRENT_ENTRY_UNAVAILABLE");
  const source = observedSource;
  const pair = await db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1({ sourceBuildAuthority: { plan: "A", sourceBuildAuthorityRef: source.sourceBuildAuthorityRef, sourceBuildAuthorityHash: source.sourceBuildAuthorityHash } });
  let activation;
  let current;
  try {
    activation = await db.resolveInternalProductionOwnerProducerManifestSetActivationV1(pair);
    current = await db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();
  } catch {
    throw new Error("CORRUPTION");
  }
  if (!current) throw new Error("CORRUPTION");
  if (current.receipt.phase !== "A") throw new Error("SUPERSEDED");
  if (current.receipt.activationRef !== activation.activationRef || current.receipt.activationHash !== activation.activationHash) throw new Error("CORRUPTION");
  let head;
  try {
    head = await db.resolveInternalProductionOwnerProducerManifestSetActivationHeadV1({ headRef: current.head.headRef, headHash: current.head.headHash });
  } catch {
    throw new Error("CORRUPTION");
  }
  return receiptFrom(source, activation.activationRef, activation.activationHash, head.headRef, head.headHash);
}

function statusBody(state: "absent" | "active" | "blocked", receipt: InternalProductionBaselineOwnerProducerManifestActivationReceiptV1 | null, blockedReason: BlockedReason | null) {
  return { schema: "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1", state, predecessorActivationRef: receipt?.predecessorActivationRef ?? null, predecessorActivationHash: receipt?.predecessorActivationHash ?? null, predecessorHeadRef: receipt?.predecessorHeadRef ?? null, predecessorHeadHash: receipt?.predecessorHeadHash ?? null, successorActivationRef: receipt?.successorActivationRef ?? null, successorActivationHash: receipt?.successorActivationHash ?? null, successorHeadRef: receipt?.successorHeadRef ?? null, successorHeadHash: receipt?.successorHeadHash ?? null, receiptRef: receipt?.receiptRef ?? null, receiptHash: receipt?.receiptHash ?? null, manifestHash: receipt?.manifestHash ?? null, sourceBuildAuthorityRef: receipt?.sourceBuildAuthorityRef ?? null, sourceBuildAuthorityHash: receipt?.sourceBuildAuthorityHash ?? null, blockedReason } as const;
}

export async function observeInternalProductionBaselineOwnerProducerManifestActivationStatusV1(): Promise<InternalProductionBaselineOwnerProducerManifestActivationStatusV1> {
  try {
    const db = await import("../db-pg.js");
    const current = await db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();
    let body;
    if (!current) body = statusBody("absent", null, null);
    else if (current.receipt.phase !== "A") body = statusBody("blocked", null, "SUPERSEDED");
    else {
      const sourcePair = current.receipt.orderedSourceBuildAuthorities[0]!;
      const receipt = receiptFrom(sourcePair as InternalProductionOwnerProducerSourceBuildAuthorityAV1, current.receipt.activationRef, current.receipt.activationHash, current.head.headRef, current.head.headHash);
      body = statusBody("active", receipt, null);
    }
    const statusHash = hashCanonicalJson(body);
    return validateInternalProductionBaselineOwnerProducerManifestActivationStatusV1({ ...body, statusRef: `setfarm://internal-production/baseline-owner-producer-manifest-activation-status/sha256/${statusHash}`, statusHash });
  } catch {
    const body = statusBody("blocked", null, "CORRUPTION");
    const statusHash = hashCanonicalJson(body);
    return validateInternalProductionBaselineOwnerProducerManifestActivationStatusV1({ ...body, statusRef: `setfarm://internal-production/baseline-owner-producer-manifest-activation-status/sha256/${statusHash}`, statusHash });
  }
}
