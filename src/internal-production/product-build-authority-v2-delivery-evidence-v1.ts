import { z } from "zod";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

export const PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_SCHEMA_V1 =
  "mission-control.product-build-authority-v2-delivery-evidence-response.v1" as const;
export const PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CURRENT_STATUS_V1 =
  "current" as const;
export const GIT_OBJECT_HASH_V1_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
export const SHA256_V1_PATTERN = /^[0-9a-f]{64}$/;

const PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_INVALID =
  "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_INVALID" as const;
const DELIVERY_EVIDENCE_SCHEMA_V1 =
  "mission-control.product-build-authority-v2-delivery-evidence.v1" as const;
const FOCUSED_TEST_RECEIPT_SCHEMA_V1 =
  "mission-control.product-build-authority-v2-focused-test-receipt.v1" as const;
const VENDOR_LOCK_PROJECTION_SCHEMA_V1 =
  "mission-control.product-build-authority-v2-vendor-lock-projection.v1" as const;
const VENDOR_COMPATIBILITY_SET_SCHEMA_V1 =
  "mission-control.setfarm-contract-compatibility-set.v1" as const;
const FOCUSED_TEST_RECEIPT_REF_PREFIX_V1 =
  "mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/";
const DELIVERY_EVIDENCE_REF_PREFIX_V1 =
  "mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/";

export type GitObjectHashV1 = string & {
  readonly __gitObjectHashV1: unique symbol;
};
export type Sha256V1 = string & { readonly __sha256V1: unique symbol };
export type CanonicalRef = string & { readonly __canonicalRef: unique symbol };

type ProductBuildAuthorityV2PathBlobIdentityV1 = Readonly<{
  path: string;
  blobHash: Sha256V1;
}>;

type ProductBuildAuthorityV2VendorArtifactIdentityV1 = Readonly<{
  producerPath: string;
  vendoredPath: string;
  sha256: Sha256V1;
}>;

export type ProductBuildAuthorityV2FocusedTestReceiptV1 = Readonly<{
  schema: "mission-control.product-build-authority-v2-focused-test-receipt.v1";
  argv: readonly [
    "node",
    "--import",
    "tsx",
    "--test",
    "server/routes/setfarm-operational.test.ts",
    "server/services/setfarm-product-build-authority.test.ts",
    "tests/product-build-authority-render.test.tsx",
  ];
  commandContractHash: Sha256V1;
  testPathBlobs: readonly [
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
  ];
  exitCode: 0;
  passed: true;
  focusedTestReceiptRef: CanonicalRef;
  focusedTestReceiptHash: Sha256V1;
}>;

export type ProductBuildAuthorityV2VendorLockProjectionV1 = Readonly<{
  schema: "mission-control.product-build-authority-v2-vendor-lock-projection.v1";
  lockPath: "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json";
  producerRepository: "https://github.com/hikmetgulsesli/setfarm.git";
  producerCommit: GitObjectHashV1;
  lockContentHash: Sha256V1;
  artifacts: readonly [
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
    ProductBuildAuthorityV2VendorArtifactIdentityV1,
  ];
  compatibilitySetHash: Sha256V1;
  vendorLockProjectionHash: Sha256V1;
}>;

export type ProductBuildAuthorityV2DeliveryEvidenceV1 = Readonly<{
  schema: "mission-control.product-build-authority-v2-delivery-evidence.v1";
  currentStatus: "current";
  deliveryPrNumber: 19;
  deliveryMergeSha: "240e779d78804843a1202cbf0440fe423b806b1a";
  deliveryMergeAncestorOfCurrentSource: true;
  currentSource: Readonly<{
    branch: "main";
    clean: true;
    sha: GitObjectHashV1;
    treeHash: GitObjectHashV1;
    buildHash: Sha256V1;
    originMainSha: GitObjectHashV1;
  }>;
  deliveredPathBlobs: readonly [
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
    ProductBuildAuthorityV2PathBlobIdentityV1,
  ];
  focusedTests: ProductBuildAuthorityV2FocusedTestReceiptV1;
  vendorLock: ProductBuildAuthorityV2VendorLockProjectionV1;
  deliveryEvidenceRef: CanonicalRef;
  deliveryEvidenceHash: Sha256V1;
}>;

export type ProductBuildAuthorityV2DeliveryEvidenceResponseV1 = Readonly<{
  schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1";
  currentStatus: "current";
  deliveryEvidenceRef: CanonicalRef;
  deliveryEvidenceHash: Sha256V1;
  evidence: ProductBuildAuthorityV2DeliveryEvidenceV1;
}>;

const GitObjectHashV1Schema = z.string().regex(GIT_OBJECT_HASH_V1_PATTERN)
  .transform((value): GitObjectHashV1 => value as GitObjectHashV1);
const Sha256V1Schema = z.string().regex(SHA256_V1_PATTERN)
  .transform((value): Sha256V1 => value as Sha256V1);
const CanonicalRefSchema = z.string().min(1).max(4_000)
  .transform((value): CanonicalRef => value as CanonicalRef);

function pathBlobIdentitySchema(path: string) {
  return z.object({
    path: z.literal(path),
    blobHash: Sha256V1Schema,
  }).strict();
}

function vendorArtifactIdentitySchema(producerPath: string, vendoredPath: string) {
  return z.object({
    producerPath: z.literal(producerPath),
    vendoredPath: z.literal(vendoredPath),
    sha256: Sha256V1Schema,
  }).strict();
}

const DeliveredPathBlobsV1Schema = z.tuple([
  pathBlobIdentitySchema("server/routes/setfarm-operational.test.ts"),
  pathBlobIdentitySchema("server/routes/setfarm-operational.ts"),
  pathBlobIdentitySchema("server/services/setfarm-product-build-authority.ts"),
  pathBlobIdentitySchema("server/services/setfarm-product-build-authority.test.ts"),
  pathBlobIdentitySchema("src/lib/product-build-authority.ts"),
  pathBlobIdentitySchema("src/components/run-detail/ProductBuildAuthority.tsx"),
  pathBlobIdentitySchema("tests/product-build-authority-render.test.tsx"),
  pathBlobIdentitySchema("contracts/vendor/setfarm/mission-control-contracts.v1.lock.json"),
]);

const FocusedTestPathBlobsV1Schema = z.tuple([
  pathBlobIdentitySchema("server/routes/setfarm-operational.test.ts"),
  pathBlobIdentitySchema("server/services/setfarm-product-build-authority.test.ts"),
  pathBlobIdentitySchema("tests/product-build-authority-render.test.tsx"),
]);

const FocusedTestArgvV1Schema = z.tuple([
  z.literal("node"),
  z.literal("--import"),
  z.literal("tsx"),
  z.literal("--test"),
  z.literal("server/routes/setfarm-operational.test.ts"),
  z.literal("server/services/setfarm-product-build-authority.test.ts"),
  z.literal("tests/product-build-authority-render.test.tsx"),
]);

const ProductBuildAuthorityV2FocusedTestReceiptV1Schema = z.object({
  schema: z.literal(FOCUSED_TEST_RECEIPT_SCHEMA_V1),
  argv: FocusedTestArgvV1Schema,
  commandContractHash: Sha256V1Schema,
  testPathBlobs: FocusedTestPathBlobsV1Schema,
  exitCode: z.literal(0),
  passed: z.literal(true),
  focusedTestReceiptRef: CanonicalRefSchema,
  focusedTestReceiptHash: Sha256V1Schema,
}).strict().superRefine((value, context) => {
  if (value.commandContractHash !== hashCanonicalJson({ argv: value.argv })) {
    context.addIssue({
      code: "custom",
      path: ["commandContractHash"],
      message: "Focused-test command hash does not bind the fixed argv",
    });
  }
  const {
    focusedTestReceiptRef: _focusedTestReceiptRef,
    focusedTestReceiptHash: _focusedTestReceiptHash,
    ...focusedTestReceiptCore
  } = value;
  const expectedHash = hashCanonicalJson(focusedTestReceiptCore);
  if (value.focusedTestReceiptHash !== expectedHash) {
    context.addIssue({
      code: "custom",
      path: ["focusedTestReceiptHash"],
      message: "Focused-test receipt hash does not bind the strict receipt",
    });
  }
  if (value.focusedTestReceiptRef !== `${FOCUSED_TEST_RECEIPT_REF_PREFIX_V1}${expectedHash}`) {
    context.addIssue({
      code: "custom",
      path: ["focusedTestReceiptRef"],
      message: "Focused-test receipt ref does not bind its receipt hash",
    });
  }
});

const VendorArtifactsV1Schema = z.tuple([
  vendorArtifactIdentitySchema(
    "contracts/generated/mission-control/run-operational-snapshot.v1.compatibility.json",
    "contracts/vendor/setfarm/run-operational-snapshot.v1.compatibility.json",
  ),
  vendorArtifactIdentitySchema(
    "contracts/generated/mission-control/run-operational-snapshot.v1.schema.json",
    "contracts/vendor/setfarm/run-operational-snapshot.v1.schema.json",
  ),
  vendorArtifactIdentitySchema(
    "contracts/generated/mission-control/run-operational-snapshot.v2.compatibility.json",
    "contracts/vendor/setfarm/run-operational-snapshot.v2.compatibility.json",
  ),
  vendorArtifactIdentitySchema(
    "contracts/generated/mission-control/run-operational-snapshot.v2.schema.json",
    "contracts/vendor/setfarm/run-operational-snapshot.v2.schema.json",
  ),
  vendorArtifactIdentitySchema(
    "contracts/generated/mission-control/run-operational-snapshot.v3.compatibility.json",
    "contracts/vendor/setfarm/run-operational-snapshot.v3.compatibility.json",
  ),
  vendorArtifactIdentitySchema(
    "contracts/generated/mission-control/run-operational-snapshot.v3.schema.json",
    "contracts/vendor/setfarm/run-operational-snapshot.v3.schema.json",
  ),
  vendorArtifactIdentitySchema(
    "contracts/generated/mission-control/deployment-observation.v1.compatibility.json",
    "contracts/vendor/setfarm/deployment-observation.v1.compatibility.json",
  ),
  vendorArtifactIdentitySchema(
    "contracts/generated/mission-control/deployment-observation.v1.schema.json",
    "contracts/vendor/setfarm/deployment-observation.v1.schema.json",
  ),
  vendorArtifactIdentitySchema(
    "contracts/generated/mission-control/project-transfer-ack.v1.compatibility.json",
    "contracts/vendor/setfarm/project-transfer-ack.v1.compatibility.json",
  ),
  vendorArtifactIdentitySchema(
    "contracts/generated/mission-control/project-transfer-ack.v1.schema.json",
    "contracts/vendor/setfarm/project-transfer-ack.v1.schema.json",
  ),
  vendorArtifactIdentitySchema(
    "contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json",
    "contracts/vendor/setfarm/operational-active-run-status.v1.compatibility.json",
  ),
  vendorArtifactIdentitySchema(
    "contracts/generated/mission-control/operational-active-run-status.v1.schema.json",
    "contracts/vendor/setfarm/operational-active-run-status.v1.schema.json",
  ),
]);

const ProductBuildAuthorityV2VendorLockProjectionV1Schema = z.object({
  schema: z.literal(VENDOR_LOCK_PROJECTION_SCHEMA_V1),
  lockPath: z.literal("contracts/vendor/setfarm/mission-control-contracts.v1.lock.json"),
  producerRepository: z.literal("https://github.com/hikmetgulsesli/setfarm.git"),
  producerCommit: GitObjectHashV1Schema,
  lockContentHash: Sha256V1Schema,
  artifacts: VendorArtifactsV1Schema,
  compatibilitySetHash: Sha256V1Schema,
  vendorLockProjectionHash: Sha256V1Schema,
}).strict().superRefine((value, context) => {
  const expectedCompatibilitySetHash = hashCanonicalJson({
    schema: VENDOR_COMPATIBILITY_SET_SCHEMA_V1,
    artifacts: value.artifacts,
  });
  if (value.compatibilitySetHash !== expectedCompatibilitySetHash) {
    context.addIssue({
      code: "custom",
      path: ["compatibilitySetHash"],
      message: "Compatibility-set hash does not bind the ordered artifact tuple",
    });
  }
  const {
    vendorLockProjectionHash: _vendorLockProjectionHash,
    ...vendorLockProjectionCore
  } = value;
  if (value.vendorLockProjectionHash !== hashCanonicalJson(vendorLockProjectionCore)) {
    context.addIssue({
      code: "custom",
      path: ["vendorLockProjectionHash"],
      message: "Vendor-lock projection hash does not bind the strict projection",
    });
  }
});

const ProductBuildAuthorityV2DeliveryEvidenceV1Schema = z.object({
  schema: z.literal(DELIVERY_EVIDENCE_SCHEMA_V1),
  currentStatus: z.literal(PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CURRENT_STATUS_V1),
  deliveryPrNumber: z.literal(19),
  deliveryMergeSha: z.literal("240e779d78804843a1202cbf0440fe423b806b1a")
    .refine((value) => GIT_OBJECT_HASH_V1_PATTERN.test(value)),
  deliveryMergeAncestorOfCurrentSource: z.literal(true),
  currentSource: z.object({
    branch: z.literal("main"),
    clean: z.literal(true),
    sha: GitObjectHashV1Schema,
    treeHash: GitObjectHashV1Schema,
    buildHash: Sha256V1Schema,
    originMainSha: GitObjectHashV1Schema,
  }).strict(),
  deliveredPathBlobs: DeliveredPathBlobsV1Schema,
  focusedTests: ProductBuildAuthorityV2FocusedTestReceiptV1Schema,
  vendorLock: ProductBuildAuthorityV2VendorLockProjectionV1Schema,
  deliveryEvidenceRef: CanonicalRefSchema,
  deliveryEvidenceHash: Sha256V1Schema,
}).strict().superRefine((value, context) => {
  if (value.currentSource.sha !== value.currentSource.originMainSha) {
    context.addIssue({
      code: "custom",
      path: ["currentSource", "originMainSha"],
      message: "Clean current main must equal origin/main",
    });
  }
  const focusedPathIndexes = [0, 3, 6] as const;
  for (let index = 0; index < focusedPathIndexes.length; index += 1) {
    const delivered = value.deliveredPathBlobs[focusedPathIndexes[index]];
    const tested = value.focusedTests.testPathBlobs[index];
    if (delivered.path !== tested.path || delivered.blobHash !== tested.blobHash) {
      context.addIssue({
        code: "custom",
        path: ["focusedTests", "testPathBlobs", index],
        message: "Focused-test path identity must equal its delivered path identity",
      });
    }
  }
  if (value.vendorLock.lockContentHash !== value.deliveredPathBlobs[7].blobHash) {
    context.addIssue({
      code: "custom",
      path: ["vendorLock", "lockContentHash"],
      message: "Vendor lock content must equal the delivered lock path identity",
    });
  }
  const {
    deliveryEvidenceRef: _deliveryEvidenceRef,
    deliveryEvidenceHash: _deliveryEvidenceHash,
    ...deliveryEvidenceCore
  } = value;
  const expectedHash = hashCanonicalJson(deliveryEvidenceCore);
  if (value.deliveryEvidenceHash !== expectedHash) {
    context.addIssue({
      code: "custom",
      path: ["deliveryEvidenceHash"],
      message: "Delivery-evidence hash does not bind the strict evidence body",
    });
  }
  if (value.deliveryEvidenceRef !== `${DELIVERY_EVIDENCE_REF_PREFIX_V1}${expectedHash}`) {
    context.addIssue({
      code: "custom",
      path: ["deliveryEvidenceRef"],
      message: "Delivery-evidence ref does not bind its evidence hash",
    });
  }
});

export const ProductBuildAuthorityV2DeliveryEvidenceResponseV1Schema = z.object({
  schema: z.literal(PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_SCHEMA_V1),
  currentStatus: z.literal(PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CURRENT_STATUS_V1),
  deliveryEvidenceRef: CanonicalRefSchema,
  deliveryEvidenceHash: Sha256V1Schema,
  evidence: ProductBuildAuthorityV2DeliveryEvidenceV1Schema,
}).strict().superRefine((value, context) => {
  if (
    value.deliveryEvidenceRef !== value.evidence.deliveryEvidenceRef
    || value.deliveryEvidenceHash !== value.evidence.deliveryEvidenceHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["evidence"],
      message: "Response pair must equal the strict evidence pair",
    });
  }
});

class ProductBuildAuthorityV2DeliveryEvidenceResponseParseError extends TypeError {
  readonly code = PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_INVALID;

  constructor() {
    super(PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_INVALID);
    this.name = "ProductBuildAuthorityV2DeliveryEvidenceResponseParseError";
  }
}

export function parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(value: unknown): ProductBuildAuthorityV2DeliveryEvidenceResponseV1 {
  try {
    return ProductBuildAuthorityV2DeliveryEvidenceResponseV1Schema.parse(value);
  } catch {
    throw new ProductBuildAuthorityV2DeliveryEvidenceResponseParseError();
  }
}
