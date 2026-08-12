import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";

export const CANONICAL_RUNTIME_TREE_V2_SCHEMA =
  "setfarm.canonical-runtime-tree.v2" as const;

export const CANONICAL_RUNTIME_TREE_V2_PROFILES = Object.freeze({
  dist: Object.freeze({
    maxFiles: 20_000,
    maxDirectories: 4_000,
    maxFileBytes: 64 * 1024 * 1024,
    maxTotalBytes: 512 * 1024 * 1024,
    maxPathBytes: 1_024,
    maxSegmentBytes: 255,
    maxDepth: 64,
  }),
  dependencies: Object.freeze({
    maxFiles: 100_000,
    maxDirectories: 20_000,
    maxFileBytes: 512 * 1024 * 1024,
    maxTotalBytes: 2 * 1024 * 1024 * 1024,
    maxPathBytes: 1_024,
    maxSegmentBytes: 255,
    maxDepth: 64,
  }),
} as const);

export type CanonicalRuntimeTreeProfileV2 = keyof typeof CANONICAL_RUNTIME_TREE_V2_PROFILES;

export type CanonicalRuntimeTreeLimitsV2 = Readonly<{
  maxFiles: number;
  maxDirectories: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxPathBytes: number;
  maxSegmentBytes: number;
  maxDepth: number;
}>;

const PORTABLE_SEGMENT = /^[A-Za-z0-9._@+-]+$/;

export function canonicalRuntimePathIssuesV2(
  value: string,
  limits: Pick<CanonicalRuntimeTreeLimitsV2, "maxPathBytes" | "maxSegmentBytes" | "maxDepth">,
): string[] {
  const issues: string[] = [];
  const segments = value.split("/");
  const pathBytes = Buffer.byteLength(value, "utf8");
  if (!value || pathBytes > limits.maxPathBytes) {
    issues.push(`path must contain 1..${limits.maxPathBytes} UTF-8 bytes`);
  }
  if (
    value.includes("\0")
    || value.includes("\\")
    || value.startsWith("/")
    || value.endsWith("/")
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    issues.push("path must be one normalized relative locator without traversal");
  }
  if (segments.length > limits.maxDepth) {
    issues.push(`path depth exceeds ${limits.maxDepth}`);
  }
  for (const segment of segments) {
    if (!PORTABLE_SEGMENT.test(segment)) {
      issues.push("path segments must use portable ASCII [A-Za-z0-9._@+-]");
      break;
    }
    if (Buffer.byteLength(segment, "utf8") > limits.maxSegmentBytes) {
      issues.push(`path segment exceeds ${limits.maxSegmentBytes} UTF-8 bytes`);
      break;
    }
  }
  return issues;
}

const PortableRuntimePathV2Schema = z.string().superRefine((value, context) => {
  const broadest = CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies;
  for (const issue of canonicalRuntimePathIssuesV2(value, broadest)) {
    context.addIssue({ code: "custom", message: issue });
  }
});

export const CanonicalRuntimeDirectoryEntryV2Schema = z.object({
  path: PortableRuntimePathV2Schema,
  type: z.literal("directory"),
  mode: z.literal("0555"),
}).strict();

export const CanonicalRuntimeFileEntryV2Schema = z.object({
  path: PortableRuntimePathV2Schema,
  type: z.literal("file"),
  mode: z.enum(["0444", "0555"]),
  executable: z.boolean(),
  byteLength: z.number().int().nonnegative(),
  contentHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expectedMode = value.executable ? "0555" : "0444";
  if (value.mode !== expectedMode) {
    context.addIssue({
      code: "custom",
      path: ["mode"],
      message: `file mode must be ${expectedMode} when executable=${value.executable}`,
    });
  }
});

export const CanonicalRuntimeTreeEntryV2Schema = z.discriminatedUnion("type", [
  CanonicalRuntimeDirectoryEntryV2Schema,
  CanonicalRuntimeFileEntryV2Schema,
]);

const CanonicalRuntimeTreeIdentityV2ObjectSchema = z.object({
  schema: z.literal(CANONICAL_RUNTIME_TREE_V2_SCHEMA),
  profile: z.enum(["dist", "dependencies"]),
  rootMode: z.literal("0555"),
  // This broad cap bounds parse/refinement work before the selected profile's
  // tighter file and directory limits are available to superRefine.
  entries: z.array(CanonicalRuntimeTreeEntryV2Schema).max(120_000),
  fileCount: z.number().int().nonnegative(),
  directoryCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
}).strict();

type CanonicalRuntimeTreeIdentityV2 = z.infer<typeof CanonicalRuntimeTreeIdentityV2ObjectSchema>;

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function expectedTreeHash(value: CanonicalRuntimeTreeIdentityV2): string {
  return hashCanonicalJson({
    schema: "setfarm.canonical-runtime-tree-content.v2",
    profile: value.profile,
    rootMode: value.rootMode,
    entries: value.entries,
    fileCount: value.fileCount,
    directoryCount: value.directoryCount,
    totalBytes: value.totalBytes,
  });
}

function addIdentityIssues(
  value: CanonicalRuntimeTreeIdentityV2,
  context: z.RefinementCtx,
): void {
  const limits = CANONICAL_RUNTIME_TREE_V2_PROFILES[value.profile];
  const sorted = [...value.entries].sort((left, right) => compareCodeUnits(left.path, right.path));
  if (value.entries.some((entry, index) => entry.path !== sorted[index]?.path)) {
    context.addIssue({
      code: "custom",
      path: ["entries"],
      message: "runtime tree entries must be canonically sorted by path",
    });
  }

  const paths = new Set<string>();
  const casefoldPaths = new Map<string, string>();
  const directories = new Set<string>();
  const files = new Set<string>();
  for (let index = 0; index < value.entries.length; index += 1) {
    const entry = value.entries[index]!;
    for (const issue of canonicalRuntimePathIssuesV2(entry.path, limits)) {
      context.addIssue({ code: "custom", path: ["entries", index, "path"], message: issue });
    }
    if (paths.has(entry.path)) {
      context.addIssue({
        code: "custom",
        path: ["entries", index, "path"],
        message: "runtime tree paths must be unique",
      });
    }
    paths.add(entry.path);
    const folded = entry.path.toLowerCase();
    const prior = casefoldPaths.get(folded);
    if (prior !== undefined && prior !== entry.path) {
      context.addIssue({
        code: "custom",
        path: ["entries", index, "path"],
        message: `runtime tree paths collide under ASCII case folding: ${prior}`,
      });
    } else {
      casefoldPaths.set(folded, entry.path);
    }
    if (entry.type === "directory") directories.add(entry.path);
    else files.add(entry.path);
  }

  for (let index = 0; index < value.entries.length; index += 1) {
    const entry = value.entries[index]!;
    const segments = entry.path.split("/");
    for (let end = 1; end < segments.length; end += 1) {
      const parent = segments.slice(0, end).join("/");
      if (!directories.has(parent)) {
        context.addIssue({
          code: "custom",
          path: ["entries", index, "path"],
          message: files.has(parent)
            ? `runtime tree path descends through file ${parent}`
            : `runtime tree path is missing parent directory ${parent}`,
        });
        break;
      }
    }
  }

  const fileEntries = value.entries.filter((entry) => entry.type === "file");
  const directoryEntries = value.entries.filter((entry) => entry.type === "directory");
  const totalBytes = fileEntries.reduce((sum, entry) => sum + entry.byteLength, 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes !== value.totalBytes) {
    context.addIssue({
      code: "custom",
      path: ["totalBytes"],
      message: "runtime tree totalBytes must equal the exact file-byte sum",
    });
  }
  if (fileEntries.length !== value.fileCount) {
    context.addIssue({
      code: "custom",
      path: ["fileCount"],
      message: "runtime tree fileCount must equal its file entries",
    });
  }
  if (directoryEntries.length !== value.directoryCount) {
    context.addIssue({
      code: "custom",
      path: ["directoryCount"],
      message: "runtime tree directoryCount must equal its directory entries",
    });
  }
  if (value.fileCount > limits.maxFiles) {
    context.addIssue({ code: "custom", path: ["fileCount"], message: "runtime tree file limit exceeded" });
  }
  if (value.directoryCount > limits.maxDirectories) {
    context.addIssue({ code: "custom", path: ["directoryCount"], message: "runtime tree directory limit exceeded" });
  }
  if (value.totalBytes > limits.maxTotalBytes) {
    context.addIssue({ code: "custom", path: ["totalBytes"], message: "runtime tree total-byte limit exceeded" });
  }
  value.entries.forEach((entry, index) => {
    if (entry.type === "file" && entry.byteLength > limits.maxFileBytes) {
      context.addIssue({
        code: "custom",
        path: ["entries", index, "byteLength"],
        message: "runtime tree per-file byte limit exceeded",
      });
    }
  });
}

const CanonicalRuntimeTreePayloadV2ObjectSchema = CanonicalRuntimeTreeIdentityV2ObjectSchema.extend({
  treeHash: Sha256Schema,
}).strict();

export const CanonicalRuntimeTreeV2Schema = CanonicalRuntimeTreePayloadV2ObjectSchema.extend({
  payloadHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  addIdentityIssues(value, context);
  const identity: CanonicalRuntimeTreeIdentityV2 = {
    schema: value.schema,
    profile: value.profile,
    rootMode: value.rootMode,
    entries: value.entries,
    fileCount: value.fileCount,
    directoryCount: value.directoryCount,
    totalBytes: value.totalBytes,
  };
  if (value.treeHash !== expectedTreeHash(identity)) {
    context.addIssue({ code: "custom", path: ["treeHash"], message: "runtime treeHash mismatch" });
  }
  const { payloadHash: _payloadHash, ...payload } = value;
  if (value.payloadHash !== hashCanonicalJson(payload)) {
    context.addIssue({ code: "custom", path: ["payloadHash"], message: "runtime payloadHash mismatch" });
  }
});

export type CanonicalRuntimeTreeEntryV2 = z.infer<typeof CanonicalRuntimeTreeEntryV2Schema>;
export type CanonicalRuntimeTreeV2 = z.infer<typeof CanonicalRuntimeTreeV2Schema>;

export function createCanonicalRuntimeTreeV2(
  input: z.input<typeof CanonicalRuntimeTreeIdentityV2ObjectSchema>,
): CanonicalRuntimeTreeV2 {
  const identity = CanonicalRuntimeTreeIdentityV2ObjectSchema.parse(input);
  const treeHash = expectedTreeHash(identity);
  const payload = CanonicalRuntimeTreePayloadV2ObjectSchema.parse({ ...identity, treeHash });
  return CanonicalRuntimeTreeV2Schema.parse({
    ...payload,
    payloadHash: hashCanonicalJson(payload),
  });
}
