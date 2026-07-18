import path from "node:path";

import { z } from "zod";

import {
  CanonicalJsonLimitError,
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../../product-compiler/bounded-canonical-json.js";
import {
  Sha256Schema,
  StableReferenceSchema,
} from "../../product-compiler/schemas/common-v1.js";
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
export const EXACT_HOST_OWNED_FILE_MAX_BYTES_V2 = 1024 * 1024 * 1024;

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

export const ExactHostOwnedFileRefV2Schema = z.object({
  schema: z.literal(EXACT_HOST_OWNED_FILE_REF_V2_SCHEMA),
  absoluteRealpathLocator: PlatformReleaseAbsoluteLocatorV2Schema,
  hash: Sha256Schema,
  byteLength: z.number().int().positive().max(EXACT_HOST_OWNED_FILE_MAX_BYTES_V2),
  ownerUid: z.literal(0),
  ownerGid: z.number().int().nonnegative().max(4_294_967_294),
  mode: z.enum(["0444", "0555"]),
  hostAdmissionEvidenceHash: Sha256Schema,
}).strict();

export type ExactHostOwnedFileRefV2 = z.infer<typeof ExactHostOwnedFileRefV2Schema>;

export const PlatformReleaseVersionIdentityV2Schema = z.string()
  .min(1)
  .max(100)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._+-]*$/,
    "Expected one bounded ASCII version identity",
  );

export const PlatformReleaseStableReferenceV2Schema = StableReferenceSchema;

export const PlatformReleaseNpmPackageNameV2Schema = z.string()
  .min(1)
  .max(214)
  .regex(
    /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/,
    "Expected one canonical lowercase npm package name",
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
