import path from "node:path";

import { z } from "zod";

import {
  CanonicalJsonLimitError,
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../../product-compiler/bounded-canonical-json.js";
import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import {
  Sha256Schema,
  StableReferenceSchema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  isCanonicalNpmPackageNameV2,
} from
  "../../product-compiler/schemas/npm-lock-v3-grammar-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_PROFILES,
  canonicalRuntimePathIssuesV2,
} from "./canonical-runtime-tree-v2.js";

export const PLATFORM_RELEASE_COMPONENT_VERSION_V2 = "2.0.0" as const;
export const PLATFORM_RELEASE_COMPONENT_MAX_DIAGNOSTIC_BYTES_V2 = 1_000;
export const PLATFORM_RELEASE_RELATIVE_LOCATOR_MAX_BYTES_V2 = 1_024;
export const PLATFORM_RELEASE_ABSOLUTE_LOCATOR_MAX_BYTES_V2 = 4_096;
export const EXACT_HOST_OWNED_FILE_REF_V2_SCHEMA =
  "setfarm.exact-host-owned-file-ref.v2" as const;
export const HOST_ADMISSION_RECEIPT_V2_SCHEMA =
  "setfarm.host-admission-receipt.v2" as const;
export const HOST_ADMISSION_PHYSICAL_IDENTITY_V2_SCHEMA =
  "setfarm.host-admission-physical-identity.v2" as const;
export const HOST_ADMISSION_VERIFIER_V2_SCHEMA =
  "setfarm.host-admission-verifier.v2" as const;
export const EXACT_HOST_OWNED_FILE_MAX_BYTES_V2 = 1024 * 1024 * 1024;
export const HOST_ADMISSION_RECEIPT_MAX_CANONICAL_BYTES_V2 = 64 * 1024;

export function comparePlatformReleaseUtf16V2(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function hasCanonicalUniquePlatformReleaseStringsV2(
  values: readonly string[],
): boolean {
  return values.every((value, index) =>
    index === 0 || comparePlatformReleaseUtf16V2(values[index - 1]!, value) < 0);
}

export function isPlatformReleaseUnicodeScalarTextV2(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0) return false;
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const following = value.charCodeAt(index + 1);
      if (following < 0xdc00 || following > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

export function platformReleaseUtf8TextV2(
  minimumBytes: number,
  maximumBytes: number,
): z.ZodString {
  if (
    !Number.isSafeInteger(minimumBytes)
    || !Number.isSafeInteger(maximumBytes)
    || minimumBytes < 0
    || maximumBytes < Math.max(1, minimumBytes)
  ) {
    throw new RangeError("Platform release UTF-8 bounds are invalid");
  }
  return z.string()
    .refine(isPlatformReleaseUnicodeScalarTextV2, {
      message: "Expected Unicode scalar text without NUL",
    })
    .refine((value) => {
      const bytes = Buffer.byteLength(value, "utf8");
      return bytes >= minimumBytes && bytes <= maximumBytes;
    }, {
      message: `Expected ${minimumBytes}..${maximumBytes} UTF-8 bytes`,
    });
}

export const PlatformReleasePortableLocatorV2Schema = z.string()
  .superRefine((value, context) => {
    const issues = canonicalRuntimePathIssuesV2(
      value,
      CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies,
    );
    for (const issue of issues) {
      context.addIssue({ code: "custom", message: issue });
    }
  });

export const PlatformReleaseAbsoluteLocatorV2Schema = platformReleaseUtf8TextV2(
  1,
  PLATFORM_RELEASE_ABSOLUTE_LOCATOR_MAX_BYTES_V2,
).superRefine((value, context) => {
  const invalid = !value.startsWith("/")
    || value === "/"
    || value.endsWith("/")
    || value.includes("\\")
    || path.posix.normalize(value) !== value
    || value.split("/").some((segment, index) =>
      index > 0 && (segment === "" || segment === "." || segment === ".."));
  if (invalid) {
    context.addIssue({
      code: "custom",
      message: "Expected one normalized absolute POSIX file locator",
    });
  }
});

export const PlatformReleaseVersionIdentityV2Schema = z.string()
  .min(1)
  .max(100)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._+-]*$/,
    "Expected one bounded ASCII version identity",
  );

const CanonicalHostDecimalV2Schema = z.string()
  .min(1)
  .max(32)
  .regex(/^(?:0|[1-9][0-9]*)$/, "Expected one canonical host decimal");

export const HostAdmissionOperatingSystemV2Schema = z.object({
  platform: z.literal("darwin"),
  architecture: z.enum(["arm64", "x64"]),
  macosProductVersion: PlatformReleaseVersionIdentityV2Schema,
  macosBuildVersion: PlatformReleaseVersionIdentityV2Schema,
  darwinKernelRelease: PlatformReleaseVersionIdentityV2Schema,
}).strict();

export type HostAdmissionOperatingSystemV2 = z.infer<
  typeof HostAdmissionOperatingSystemV2Schema
>;

const HostAdmissionTargetV2Schema = z.object({
  absoluteRealpathLocator: PlatformReleaseAbsoluteLocatorV2Schema,
  hash: Sha256Schema,
  byteLength: z.number().int().positive()
    .max(EXACT_HOST_OWNED_FILE_MAX_BYTES_V2),
  ownerUid: z.literal(0),
  ownerGid: z.number().int().nonnegative().max(4_294_967_294),
  mode: z.enum(["0444", "0555"]),
}).strict();

const HostAdmissionPhysicalIdentityPayloadV2Schema = z.object({
  schema: z.literal(HOST_ADMISSION_PHYSICAL_IDENTITY_V2_SCHEMA),
  device: CanonicalHostDecimalV2Schema,
  inode: CanonicalHostDecimalV2Schema,
  linkCount: z.literal(1),
  hash: Sha256Schema,
  byteLength: z.number().int().positive()
    .max(EXACT_HOST_OWNED_FILE_MAX_BYTES_V2),
  ownerUid: z.literal(0),
  ownerGid: z.number().int().nonnegative().max(4_294_967_294),
  mode: z.enum(["0444", "0555"]),
  identityHash: Sha256Schema,
}).strict();

export function hashHostAdmissionPhysicalIdentityV2(
  value: z.infer<typeof HostAdmissionPhysicalIdentityPayloadV2Schema>,
): string {
  const identity = { ...value } as Record<string, unknown>;
  delete identity.identityHash;
  return hashCanonicalJson({
    schema: "setfarm.host-admission-physical-identity-hash.v2",
    identity,
  });
}

export const HostAdmissionPhysicalIdentityV2Schema =
  HostAdmissionPhysicalIdentityPayloadV2Schema.superRefine(
    (value, context) => {
      if (
        value.identityHash
          !== hashHostAdmissionPhysicalIdentityV2(value)
      ) {
        context.addIssue({
          code: "custom",
          path: ["identityHash"],
          message: "Host physical identity hash mismatch",
        });
      }
    },
  );

export type HostAdmissionPhysicalIdentityV2 = z.infer<
  typeof HostAdmissionPhysicalIdentityV2Schema
>;

export const HostAdmissionVerifierV2Schema = z.object({
  schema: z.literal(HOST_ADMISSION_VERIFIER_V2_SCHEMA),
  installationScope: z.literal("root_owned_separately_installed"),
  absoluteRealpathLocator: PlatformReleaseAbsoluteLocatorV2Schema,
  hash: Sha256Schema,
  byteLength: z.number().int().positive()
    .max(EXACT_HOST_OWNED_FILE_MAX_BYTES_V2),
  ownerUid: z.literal(0),
  ownerGid: z.number().int().nonnegative().max(4_294_967_294),
  mode: z.literal("0555"),
  requiredAbi: z.literal("HOST_FILE_STABLE_DESCRIPTOR_ADMISSION_V2"),
  abiHash: Sha256Schema,
  installationAnchorHash: Sha256Schema,
}).strict();

export type HostAdmissionVerifierV2 = z.infer<
  typeof HostAdmissionVerifierV2Schema
>;

const HostAdmissionReceiptIdentityV2Schema = z.object({
  schema: z.literal(HOST_ADMISSION_RECEIPT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("candidate_host_admission_receipt_unverified"),
  productionUse: z.literal(
    "forbidden_until_fresh_independent_host_bootstrap_verification",
  ),
  host: HostAdmissionOperatingSystemV2Schema,
  target: HostAdmissionTargetV2Schema,
  physicalBefore: HostAdmissionPhysicalIdentityV2Schema,
  physicalAfter: HostAdmissionPhysicalIdentityV2Schema,
  metadata: z.object({
    acl: z.literal("absent"),
    extendedAttributes: z.literal("absent"),
    probeReceiptHash: Sha256Schema,
  }).strict(),
  verifier: HostAdmissionVerifierV2Schema,
}).strict().superRefine((value, context) => {
  const target = value.target;
  const matchesTarget = (
    physical: z.infer<typeof HostAdmissionPhysicalIdentityV2Schema>,
  ) =>
    physical.hash === target.hash
    && physical.byteLength === target.byteLength
    && physical.ownerUid === target.ownerUid
    && physical.ownerGid === target.ownerGid
    && physical.mode === target.mode;
  if (
    !matchesTarget(value.physicalBefore)
    || !matchesTarget(value.physicalAfter)
    || value.physicalBefore.identityHash
      !== value.physicalAfter.identityHash
    || value.verifier.absoluteRealpathLocator
      === value.target.absoluteRealpathLocator
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Host admission must bind one unchanged target observed by a distinct verifier",
    });
  }
});

export type HostAdmissionReceiptHashPayloadV2 = z.infer<
  typeof HostAdmissionReceiptIdentityV2Schema
>;

export function hashHostAdmissionReceiptV2(
  value: HostAdmissionReceiptHashPayloadV2 | HostAdmissionReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.host-admission-receipt-hash.v2",
    receipt,
  });
}

export const HostAdmissionReceiptV2Schema =
  HostAdmissionReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      HOST_ADMISSION_RECEIPT_MAX_CANONICAL_BYTES_V2,
    )) {
      context.addIssue({
        code: "custom",
        message: "Host admission receipt exceeds its canonical byte cap",
      });
      return;
    }
    if (value.receiptHash !== hashHostAdmissionReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Host admission receipt hash mismatch",
      });
    }
  });

export type HostAdmissionReceiptV2 = z.infer<
  typeof HostAdmissionReceiptV2Schema
>;

export const ExactHostOwnedFileRefV2Schema = z.object({
  schema: z.literal(EXACT_HOST_OWNED_FILE_REF_V2_SCHEMA),
  absoluteRealpathLocator: PlatformReleaseAbsoluteLocatorV2Schema,
  hash: Sha256Schema,
  byteLength: z.number().int().positive()
    .max(EXACT_HOST_OWNED_FILE_MAX_BYTES_V2),
  ownerUid: z.literal(0),
  ownerGid: z.number().int().nonnegative().max(4_294_967_294),
  mode: z.enum(["0444", "0555"]),
  hostAdmissionEvidenceHash: Sha256Schema,
  hostAdmissionReceipt: HostAdmissionReceiptV2Schema,
}).strict().superRefine((value, context) => {
  const receipt = value.hostAdmissionReceipt;
  if (
    value.hostAdmissionEvidenceHash !== receipt.receiptHash
    || value.absoluteRealpathLocator
      !== receipt.target.absoluteRealpathLocator
    || value.hash !== receipt.target.hash
    || value.byteLength !== receipt.target.byteLength
    || value.ownerUid !== receipt.target.ownerUid
    || value.ownerGid !== receipt.target.ownerGid
    || value.mode !== receipt.target.mode
  ) {
    context.addIssue({
      code: "custom",
      path: ["hostAdmissionReceipt"],
      message:
        "Exact host-owned file projection must equal its complete admission receipt",
    });
  }
});

export type ExactHostOwnedFileRefV2 = z.infer<
  typeof ExactHostOwnedFileRefV2Schema
>;

export const PlatformReleaseStableReferenceV2Schema = StableReferenceSchema;

export const PlatformReleaseNpmPackageNameV2Schema = z.string()
  .refine(
    isCanonicalNpmPackageNameV2,
    "Expected one canonical lowercase npm lock-v3 package name",
  );

export function boundedPlatformReleaseJsonSnapshotV2(
  input: unknown,
  maxBytes: number,
): unknown {
  const bytes = canonicalJsonBytesBounded(input, {
    maxBytes,
    ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  });
  return JSON.parse(bytes.toString("utf8"));
}

export function platformReleaseCandidateFitsCanonicalCapV2(
  value: unknown,
  maxBytes: number,
): boolean {
  try {
    canonicalJsonBytesBounded(value, {
      maxBytes,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
    return true;
  } catch (error) {
    if (error instanceof CanonicalJsonLimitError) return false;
    throw error;
  }
}

export function deepFreezePlatformReleaseJsonV2<T>(value: T): T {
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

export function parseHostAdmissionReceiptCandidateV2(
  input: unknown,
): HostAdmissionReceiptV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    HOST_ADMISSION_RECEIPT_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    HostAdmissionReceiptV2Schema.parse(snapshot),
  );
}
