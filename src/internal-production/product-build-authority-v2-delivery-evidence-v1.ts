import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
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

export type ProductBuildAuthorityV2DeliveryEvidencePairV1 = Readonly<{
  deliveryEvidenceRef: CanonicalRef;
  deliveryEvidenceHash: Sha256V1;
}>;

export type ProductBuildAuthorityV2DeliveryEvidenceObservationV1 = Readonly<{
  schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1";
  observationTransport: "source-cli";
  response: ProductBuildAuthorityV2DeliveryEvidenceResponseV1;
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

const PBA_OBSERVATION_SCHEMA_V1 =
  "setfarm.product-build-authority-v2-delivery-evidence-observation.v1" as const;
const MISSION_CONTROL_LAUNCHD_LABEL_V1 = "com.setrox.mission-control" as const;
const LAUNCHCTL_EXECUTABLE_V1 = "/bin/launchctl" as const;
const PLUTIL_EXECUTABLE_V1 = "/usr/bin/plutil" as const;
const MISSION_CONTROL_ENTRYPOINT_RELATIVE_PATH_V1 = "dist-server/index.js" as const;
const MISSION_CONTROL_SOURCE_CLI_RELATIVE_PATH_V1 =
  "dist-server/services/product-build-authority-v2-delivery-evidence-v1.js" as const;
const LOCATOR_CHILD_TIMEOUT_MS_V1 = 5_000;
const SOURCE_CLI_TIMEOUT_MS_V1 = 120_000;
const CHILD_MAX_BUFFER_BYTES_V1 = 1_048_576;
const CHILD_ENVIRONMENT_V1 = Object.freeze({
  PATH: "/opt/homebrew/bin:/usr/bin:/bin",
  LANG: "C",
  LC_ALL: "C",
});

type ProductBuildAuthorityV2DeliveryEvidenceObservationErrorCodeV1 =
  | "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_UID_INVALID"
  | "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LAUNCHCTL_FAILED"
  | "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LAUNCHCTL_OUTPUT_INVALID"
  | "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PLUTIL_FAILED"
  | "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PLUTIL_OUTPUT_INVALID"
  | "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID"
  | "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_SOURCE_CLI_FAILED"
  | "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_SOURCE_CLI_OUTPUT_INVALID"
  | "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_SOURCE_CLI_RESPONSE_INVALID"
  | "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_DRIFT"
  | "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_INVALID"
  | "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_MISMATCH";

class ProductBuildAuthorityV2DeliveryEvidenceObservationError extends Error {
  readonly code: ProductBuildAuthorityV2DeliveryEvidenceObservationErrorCodeV1;

  constructor(code: ProductBuildAuthorityV2DeliveryEvidenceObservationErrorCodeV1) {
    super(code);
    this.name = "ProductBuildAuthorityV2DeliveryEvidenceObservationError";
    this.code = code;
    this.stack = `${this.name}: ${code}`;
  }
}

function failObservation(
  code: ProductBuildAuthorityV2DeliveryEvidenceObservationErrorCodeV1,
): never {
  throw new ProductBuildAuthorityV2DeliveryEvidenceObservationError(code);
}

type ChildResultV1 = Readonly<{ stdout: string; stderr: string }>;

function runBoundedChildV1(
  executable: string,
  argv: readonly string[],
  options: Readonly<{ cwd?: string; timeout: number }>,
  failureCode: ProductBuildAuthorityV2DeliveryEvidenceObservationErrorCodeV1,
): Promise<ChildResultV1> {
  return new Promise((resolveChild, rejectChild) => {
    execFile(
      executable,
      [...argv],
      {
        cwd: options.cwd,
        env: CHILD_ENVIRONMENT_V1,
        shell: false,
        timeout: options.timeout,
        maxBuffer: CHILD_MAX_BUFFER_BYTES_V1,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        if (error !== null || typeof stdout !== "string" || typeof stderr !== "string") {
          rejectChild(new ProductBuildAuthorityV2DeliveryEvidenceObservationError(failureCode));
          return;
        }
        if (
          Buffer.byteLength(stdout, "utf8") > CHILD_MAX_BUFFER_BYTES_V1
          || Buffer.byteLength(stderr, "utf8") > CHILD_MAX_BUFFER_BYTES_V1
        ) {
          rejectChild(new ProductBuildAuthorityV2DeliveryEvidenceObservationError(failureCode));
          return;
        }
        resolveChild({ stdout, stderr });
      },
    );
  });
}

function parseSingleRawPlutilValueV1(stdout: string): string {
  if (!stdout.endsWith("\n")) {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PLUTIL_OUTPUT_INVALID");
  }
  const value = stdout.slice(0, -1);
  if (value.length === 0 || /[\n\r\0]/u.test(value)) {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PLUTIL_OUTPUT_INVALID");
  }
  return value;
}

function parseCompactSourceCliJsonLineV1(stdout: string): unknown {
  const invalidCode =
    "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_SOURCE_CLI_OUTPUT_INVALID";
  if (!stdout.endsWith("\n")) failObservation(invalidCode);
  const compact = stdout.slice(0, -1);
  if (compact.length === 0 || /[\n\r]/u.test(compact)) failObservation(invalidCode);
  try {
    const parsed: unknown = JSON.parse(compact);
    if (JSON.stringify(parsed) !== compact) failObservation(invalidCode);
    return parsed;
  } catch (error) {
    if (error instanceof ProductBuildAuthorityV2DeliveryEvidenceObservationError) throw error;
    failObservation(invalidCode);
  }
}

function parsePlutilProgramArgumentsV1(stdout: string): readonly [string, string] {
  const invalidCode =
    "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PLUTIL_OUTPUT_INVALID";
  if (stdout.length === 0 || /[\s\0]/u.test(stdout)) failObservation(invalidCode);
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (
      !Array.isArray(parsed)
      || parsed.length !== 2
      || parsed.some((member) => typeof member !== "string")
    ) {
      failObservation(invalidCode);
    }
    return Object.freeze([parsed[0] as string, parsed[1] as string]);
  } catch (error) {
    if (error instanceof ProductBuildAuthorityV2DeliveryEvidenceObservationError) throw error;
    failObservation(invalidCode);
  }
}

type LaunchctlProjectionV1 = Readonly<{
  plistPath: string;
  program: string;
  workingDirectory: string;
}>;

function parseLaunchctlProjectionV1(
  stdout: string,
  expectedDomain: string,
): LaunchctlProjectionV1 {
  if (!stdout.startsWith(`${expectedDomain} = {\n`) || !stdout.endsWith("}\n")) {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LAUNCHCTL_OUTPUT_INVALID");
  }
  const selected = {
    plistPath: [...stdout.matchAll(/^\tpath = ([^\n\r\0]+)$/gmu)],
    program: [...stdout.matchAll(/^\tprogram = ([^\n\r\0]+)$/gmu)],
    workingDirectory: [...stdout.matchAll(/^\tworking directory = ([^\n\r\0]+)$/gmu)],
  };
  if (
    selected.plistPath.length !== 1
    || selected.program.length !== 1
    || selected.workingDirectory.length !== 1
  ) {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LAUNCHCTL_OUTPUT_INVALID");
  }
  return {
    plistPath: selected.plistPath[0]?.[1] ?? "",
    program: selected.program[0]?.[1] ?? "",
    workingDirectory: selected.workingDirectory[0]?.[1] ?? "",
  };
}

type FileIdentityV1 = Readonly<{
  path: string;
  device: number;
  inode: number;
  size: number;
  modifiedAtMillis: number;
  mode: number;
  uid: number;
}>;

async function observeRegularNonSymlinkFileV1(
  path: string,
  options: Readonly<{ uid?: number; safeMode?: boolean }>,
): Promise<FileIdentityV1> {
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
    }
    if (
      options.uid !== undefined
      && metadata.uid !== 0
      && metadata.uid !== options.uid
    ) {
      failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
    }
    if (options.safeMode === true && (metadata.mode & 0o022) !== 0) {
      failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
    }
    if (await realpath(path) !== path) {
      failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
    }
    const numericIdentity = [
      metadata.dev,
      metadata.ino,
      metadata.size,
      metadata.mtimeMs,
      metadata.mode,
      metadata.uid,
    ];
    if (numericIdentity.some((value) => !Number.isFinite(value) || value < 0)) {
      failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
    }
    return {
      path,
      device: metadata.dev,
      inode: metadata.ino,
      size: metadata.size,
      modifiedAtMillis: metadata.mtimeMs,
      mode: metadata.mode,
      uid: metadata.uid,
    };
  } catch (error) {
    if (error instanceof ProductBuildAuthorityV2DeliveryEvidenceObservationError) throw error;
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
  }
}

function requireContainedPathV1(root: string, path: string): void {
  const relativePath = relative(root, path);
  if (
    relativePath.length === 0
    || relativePath === ".."
    || relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    || isAbsolute(relativePath)
  ) {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
  }
}

type MissionControlSourceCliLocatorV1 = Readonly<{
  uid: number;
  domain: string;
  plist: FileIdentityV1;
  workingDirectory: string;
  nodeExecutable: string;
  entrypoint: FileIdentityV1;
  sourceCli: FileIdentityV1;
}>;

async function observeMissionControlSourceCliLocatorV1(): Promise<MissionControlSourceCliLocatorV1> {
  let uid: unknown;
  try {
    uid = process.getuid?.();
  } catch {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_UID_INVALID");
  }
  if (!Number.isSafeInteger(uid) || (uid as number) < 0) {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_UID_INVALID");
  }
  const exactUid = uid as number;
  const domain = `gui/${exactUid}/${MISSION_CONTROL_LAUNCHD_LABEL_V1}`;
  const launchctl = await runBoundedChildV1(
    LAUNCHCTL_EXECUTABLE_V1,
    ["print", domain],
    { timeout: LOCATOR_CHILD_TIMEOUT_MS_V1 },
    "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LAUNCHCTL_FAILED",
  );
  if (launchctl.stderr !== "") {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LAUNCHCTL_OUTPUT_INVALID");
  }
  const loaded = parseLaunchctlProjectionV1(launchctl.stdout, domain);
  if (!isAbsolute(loaded.plistPath)) {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
  }
  const plist = await observeRegularNonSymlinkFileV1(loaded.plistPath, {
    uid: exactUid,
    safeMode: true,
  });
  const plutilSelections = await Promise.all([
    runBoundedChildV1(
      PLUTIL_EXECUTABLE_V1,
      ["-extract", "Label", "raw", "-o", "-", loaded.plistPath],
      { timeout: LOCATOR_CHILD_TIMEOUT_MS_V1 },
      "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PLUTIL_FAILED",
    ),
    runBoundedChildV1(
      PLUTIL_EXECUTABLE_V1,
      ["-extract", "WorkingDirectory", "raw", "-o", "-", loaded.plistPath],
      { timeout: LOCATOR_CHILD_TIMEOUT_MS_V1 },
      "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PLUTIL_FAILED",
    ),
    runBoundedChildV1(
      PLUTIL_EXECUTABLE_V1,
      ["-extract", "ProgramArguments", "json", "-o", "-", loaded.plistPath],
      { timeout: LOCATOR_CHILD_TIMEOUT_MS_V1 },
      "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PLUTIL_FAILED",
    ),
  ]);
  if (plutilSelections.some((selection) => selection.stderr !== "")) {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PLUTIL_OUTPUT_INVALID");
  }
  const label = parseSingleRawPlutilValueV1(plutilSelections[0]?.stdout ?? "");
  const workingDirectory = parseSingleRawPlutilValueV1(
    plutilSelections[1]?.stdout ?? "",
  );
  const programArguments = parsePlutilProgramArgumentsV1(
    plutilSelections[2]?.stdout ?? "",
  );
  if (
    label !== MISSION_CONTROL_LAUNCHD_LABEL_V1
    || !isAbsolute(workingDirectory)
    || loaded.workingDirectory !== workingDirectory
  ) {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
  }
  try {
    if (await realpath(workingDirectory) !== workingDirectory) {
      failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
    }
  } catch (error) {
    if (error instanceof ProductBuildAuthorityV2DeliveryEvidenceObservationError) throw error;
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
  }
  const entrypointPath = resolve(
    workingDirectory,
    MISSION_CONTROL_ENTRYPOINT_RELATIVE_PATH_V1,
  );
  const sourceCliPath = resolve(
    workingDirectory,
    MISSION_CONTROL_SOURCE_CLI_RELATIVE_PATH_V1,
  );
  requireContainedPathV1(workingDirectory, entrypointPath);
  requireContainedPathV1(workingDirectory, sourceCliPath);
  if (programArguments[1] !== entrypointPath) {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
  }
  let loadedNodeRealpath: string;
  let plistNodeRealpath: string;
  try {
    if (!isAbsolute(loaded.program) || !isAbsolute(programArguments[0] ?? "")) {
      failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
    }
    [loadedNodeRealpath, plistNodeRealpath] = await Promise.all([
      realpath(loaded.program),
      realpath(programArguments[0] ?? ""),
    ]);
  } catch (error) {
    if (error instanceof ProductBuildAuthorityV2DeliveryEvidenceObservationError) throw error;
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
  }
  if (loadedNodeRealpath !== plistNodeRealpath || !isAbsolute(loadedNodeRealpath)) {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_INVALID");
  }
  const [entrypoint, sourceCli] = await Promise.all([
    observeRegularNonSymlinkFileV1(entrypointPath, {}),
    observeRegularNonSymlinkFileV1(sourceCliPath, {}),
  ]);
  return {
    uid: exactUid,
    domain,
    plist,
    workingDirectory,
    nodeExecutable: loadedNodeRealpath,
    entrypoint,
    sourceCli,
  };
}

function recursivelyFreezeV1<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      recursivelyFreezeV1((value as Record<PropertyKey, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function parseExactDeliveryEvidencePairV1(
  input: ProductBuildAuthorityV2DeliveryEvidencePairV1,
): ProductBuildAuthorityV2DeliveryEvidencePairV1 {
  try {
    if (input === null || typeof input !== "object" || Object.getPrototypeOf(input) !== Object.prototype) {
      failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_INVALID");
    }
    const ownKeys = Reflect.ownKeys(input);
    if (
      ownKeys.length !== 2
      || !ownKeys.includes("deliveryEvidenceRef")
      || !ownKeys.includes("deliveryEvidenceHash")
    ) {
      failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_INVALID");
    }
    const refDescriptor = Object.getOwnPropertyDescriptor(input, "deliveryEvidenceRef");
    const hashDescriptor = Object.getOwnPropertyDescriptor(input, "deliveryEvidenceHash");
    if (
      refDescriptor === undefined
      || hashDescriptor === undefined
      || !("value" in refDescriptor)
      || !("value" in hashDescriptor)
      || refDescriptor.enumerable !== true
      || hashDescriptor.enumerable !== true
      || typeof refDescriptor.value !== "string"
      || typeof hashDescriptor.value !== "string"
      || !SHA256_V1_PATTERN.test(hashDescriptor.value)
      || refDescriptor.value !== `${DELIVERY_EVIDENCE_REF_PREFIX_V1}${hashDescriptor.value}`
    ) {
      failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_INVALID");
    }
    return Object.freeze({
      deliveryEvidenceRef: refDescriptor.value as CanonicalRef,
      deliveryEvidenceHash: hashDescriptor.value as Sha256V1,
    });
  } catch (error) {
    if (error instanceof ProductBuildAuthorityV2DeliveryEvidenceObservationError) throw error;
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_INVALID");
  }
}

export async function observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(): Promise<ProductBuildAuthorityV2DeliveryEvidenceObservationV1> {
  const before = await observeMissionControlSourceCliLocatorV1();
  const child = await runBoundedChildV1(
    before.nodeExecutable,
    [before.sourceCli.path, "--json"],
    { cwd: before.workingDirectory, timeout: SOURCE_CLI_TIMEOUT_MS_V1 },
    "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_SOURCE_CLI_FAILED",
  );
  if (child.stderr !== "") {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_SOURCE_CLI_OUTPUT_INVALID");
  }
  const rawResponse = parseCompactSourceCliJsonLineV1(child.stdout);
  let response: ProductBuildAuthorityV2DeliveryEvidenceResponseV1;
  try {
    response = parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(rawResponse);
  } catch {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_SOURCE_CLI_RESPONSE_INVALID");
  }
  const after = await observeMissionControlSourceCliLocatorV1();
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_LOCATOR_DRIFT");
  }
  return recursivelyFreezeV1({
    schema: PBA_OBSERVATION_SCHEMA_V1,
    observationTransport: "source-cli",
    response,
  });
}

export async function resolveProductBuildAuthorityV2DeliveryEvidenceV1(
  input: ProductBuildAuthorityV2DeliveryEvidencePairV1,
): Promise<ProductBuildAuthorityV2DeliveryEvidenceObservationV1> {
  const expected = parseExactDeliveryEvidencePairV1(input);
  const observation = await observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1();
  if (
    observation.response.deliveryEvidenceRef !== expected.deliveryEvidenceRef
    || observation.response.deliveryEvidenceHash !== expected.deliveryEvidenceHash
  ) {
    failObservation("PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_PAIR_MISMATCH");
  }
  return observation;
}
