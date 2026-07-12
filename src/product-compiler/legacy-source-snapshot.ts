import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import {
  GitObjectHashSchema,
  NormalizedRelativeLocatorSchema,
  SourceArtifactRefV1Schema,
  type SourceArtifactRefV1,
  hasUniqueStrings,
} from "./schemas/common-v1.js";

const SourceDescriptorV1Schema = z
  .object({
    locator: NormalizedRelativeLocatorSchema,
    mediaType: z.string().min(3).max(160).regex(/^[^\s/]+\/[^\s/]+$/),
    required: z.boolean(),
  })
  .strict();

type SourceDescriptorV1 = z.infer<typeof SourceDescriptorV1Schema>;

const LegacySourceDeclarationsV1Schema = z
  .object({
    task: SourceDescriptorV1Schema,
    plan: SourceDescriptorV1Schema,
    stitchArtifacts: z.array(SourceDescriptorV1Schema).max(1_000),
    generatedScreenIndex: SourceDescriptorV1Schema.optional(),
    generatedSources: z.array(SourceDescriptorV1Schema).max(10_000),
    setupCertificate: SourceDescriptorV1Schema.optional(),
    fileTreeManifest: SourceDescriptorV1Schema.optional(),
    sharedGrants: SourceDescriptorV1Schema.optional(),
    stories: z.array(SourceDescriptorV1Schema).max(5_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.task.required) {
      context.addIssue({ code: "custom", path: ["task", "required"], message: "Task source is required" });
    }
    if (!value.plan.required) {
      context.addIssue({ code: "custom", path: ["plan", "required"], message: "Plan source is required" });
    }
    const descriptors = [
      value.task,
      value.plan,
      ...value.stitchArtifacts,
      ...(value.generatedScreenIndex ? [value.generatedScreenIndex] : []),
      ...value.generatedSources,
      ...(value.setupCertificate ? [value.setupCertificate] : []),
      ...(value.fileTreeManifest ? [value.fileTreeManifest] : []),
      ...(value.sharedGrants ? [value.sharedGrants] : []),
      ...value.stories,
    ];
    if (!hasUniqueStrings(descriptors.map((descriptor) => descriptor.locator))) {
      context.addIssue({
        code: "custom",
        message: "Each source locator must have one unambiguous declaration",
      });
    }
  });

export const LegacySourceSnapshotRequestV1Schema = z
  .object({
    schema: z.literal("setfarm.legacy-source-snapshot-request.v1"),
    runId: z.string().min(1).max(200),
    readRoot: z.string().min(1).max(4_096).refine(path.isAbsolute, {
      message: "Legacy snapshot read root must be absolute",
    }),
    sources: LegacySourceDeclarationsV1Schema,
    repo: z.object({
      baseSha: GitObjectHashSchema,
      treeHash: GitObjectHashSchema,
    }).strict(),
  })
  .strict();

export type LegacySourceSnapshotRequestV1 = z.infer<typeof LegacySourceSnapshotRequestV1Schema>;

export const LegacySourceSnapshotV1Schema = z
  .object({
    schema: z.literal("setfarm.legacy-source-snapshot.v1"),
    task: SourceArtifactRefV1Schema,
    plan: SourceArtifactRefV1Schema,
    stitchArtifacts: z.array(SourceArtifactRefV1Schema).max(1_000),
    generatedScreenIndex: SourceArtifactRefV1Schema.optional(),
    generatedSources: z.array(SourceArtifactRefV1Schema).max(10_000),
    setupCertificate: SourceArtifactRefV1Schema.optional(),
    fileTreeManifest: SourceArtifactRefV1Schema.optional(),
    sharedGrants: SourceArtifactRefV1Schema.optional(),
    stories: z.array(SourceArtifactRefV1Schema).max(5_000),
    repo: z.object({
      baseSha: GitObjectHashSchema,
      treeHash: GitObjectHashSchema,
    }).strict(),
  })
  .strict();

export type LegacySourceSnapshotV1 = z.infer<typeof LegacySourceSnapshotV1Schema>;

const MissingSourceKindV1Schema = z.enum([
  "task",
  "plan",
  "stitchArtifact",
  "generatedScreenIndex",
  "generatedSource",
  "setupCertificate",
  "fileTreeManifest",
  "sharedGrants",
  "story",
]);

export const MissingLegacySourceV1Schema = z
  .object({
    kind: MissingSourceKindV1Schema,
    locator: NormalizedRelativeLocatorSchema,
    required: z.boolean(),
    reason: z.enum(["not_found", "outside_root", "unreadable"]),
  })
  .strict();

export type MissingLegacySourceV1 = z.infer<typeof MissingLegacySourceV1Schema>;

const LegacySourceSnapshotReadResultV1Schema = z
  .object({
    runId: z.string().min(1).max(200),
    snapshot: LegacySourceSnapshotV1Schema.optional(),
    missingSources: z.array(MissingLegacySourceV1Schema).max(20_000),
  })
  .strict();

export type LegacySourceSnapshotReadResultV1 = z.infer<
  typeof LegacySourceSnapshotReadResultV1Schema
>;

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === ""
    || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

async function readDeclaredSource(
  realRoot: string,
  kind: z.infer<typeof MissingSourceKindV1Schema>,
  descriptor: SourceDescriptorV1,
): Promise<{ ref?: SourceArtifactRefV1; missing?: MissingLegacySourceV1 }> {
  const candidate = path.resolve(realRoot, descriptor.locator);
  let resolved: string;
  try {
    resolved = await realpath(candidate);
  } catch (error) {
    return {
      missing: {
        kind,
        locator: descriptor.locator,
        required: descriptor.required,
        reason: isNodeError(error, "ENOENT") ? "not_found" : "unreadable",
      },
    };
  }

  if (!isWithinRoot(realRoot, resolved)) {
    return {
      missing: {
        kind,
        locator: descriptor.locator,
        required: descriptor.required,
        reason: "outside_root",
      },
    };
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(resolved);
  } catch {
    return {
      missing: {
        kind,
        locator: descriptor.locator,
        required: descriptor.required,
        reason: "unreadable",
      },
    };
  }

  return {
    ref: SourceArtifactRefV1Schema.parse({
      schema: "setfarm.source-artifact-ref.v1",
      hash: createHash("sha256").update(bytes).digest("hex"),
      mediaType: descriptor.mediaType,
      locator: descriptor.locator,
      byteLength: bytes.byteLength,
    }),
  };
}

type SourceRead = Readonly<{
  kind: z.infer<typeof MissingSourceKindV1Schema>;
  descriptor: SourceDescriptorV1;
  slot:
    | "task"
    | "plan"
    | "stitchArtifacts"
    | "generatedScreenIndex"
    | "generatedSources"
    | "setupCertificate"
    | "fileTreeManifest"
    | "sharedGrants"
    | "stories";
}>;

export async function readLegacySourceSnapshot(
  input: unknown,
): Promise<LegacySourceSnapshotReadResultV1> {
  const request = LegacySourceSnapshotRequestV1Schema.parse(input);
  const realRoot = await realpath(request.readRoot);
  const reads: SourceRead[] = [
    { kind: "task", descriptor: request.sources.task, slot: "task" },
    { kind: "plan", descriptor: request.sources.plan, slot: "plan" },
    ...request.sources.stitchArtifacts.map((descriptor) => ({
      kind: "stitchArtifact" as const,
      descriptor,
      slot: "stitchArtifacts" as const,
    })),
    ...(request.sources.generatedScreenIndex ? [{
      kind: "generatedScreenIndex" as const,
      descriptor: request.sources.generatedScreenIndex,
      slot: "generatedScreenIndex" as const,
    }] : []),
    ...request.sources.generatedSources.map((descriptor) => ({
      kind: "generatedSource" as const,
      descriptor,
      slot: "generatedSources" as const,
    })),
    ...(request.sources.setupCertificate ? [{
      kind: "setupCertificate" as const,
      descriptor: request.sources.setupCertificate,
      slot: "setupCertificate" as const,
    }] : []),
    ...(request.sources.fileTreeManifest ? [{
      kind: "fileTreeManifest" as const,
      descriptor: request.sources.fileTreeManifest,
      slot: "fileTreeManifest" as const,
    }] : []),
    ...(request.sources.sharedGrants ? [{
      kind: "sharedGrants" as const,
      descriptor: request.sources.sharedGrants,
      slot: "sharedGrants" as const,
    }] : []),
    ...request.sources.stories.map((descriptor) => ({
      kind: "story" as const,
      descriptor,
      slot: "stories" as const,
    })),
  ];

  const results = await Promise.all(
    reads.map(async (read) => ({ read, result: await readDeclaredSource(realRoot, read.kind, read.descriptor) })),
  );
  const missingSources = results
    .flatMap(({ result }) => result.missing ? [result.missing] : [])
    .sort((left, right) => compareUtf16(`${left.kind}\0${left.locator}`, `${right.kind}\0${right.locator}`));

  if (missingSources.some((missing) => missing.required)) {
    return LegacySourceSnapshotReadResultV1Schema.parse({
      runId: request.runId,
      missingSources,
    });
  }

  const bySlot = new Map<SourceRead["slot"], SourceArtifactRefV1[]>();
  results.forEach(({ read, result }) => {
    if (!result.ref) return;
    const refs = bySlot.get(read.slot) ?? [];
    refs.push(result.ref);
    bySlot.set(read.slot, refs);
  });
  for (const refs of bySlot.values()) {
    refs.sort((left, right) => compareUtf16(left.locator, right.locator));
  }

  const task = bySlot.get("task")?.[0];
  const plan = bySlot.get("plan")?.[0];
  if (!task || !plan) {
    throw new Error("Required task and plan refs were not captured despite successful validation");
  }

  const snapshot = LegacySourceSnapshotV1Schema.parse({
    schema: "setfarm.legacy-source-snapshot.v1",
    task,
    plan,
    stitchArtifacts: bySlot.get("stitchArtifacts") ?? [],
    ...(bySlot.get("generatedScreenIndex")?.[0]
      ? { generatedScreenIndex: bySlot.get("generatedScreenIndex")![0] }
      : {}),
    generatedSources: bySlot.get("generatedSources") ?? [],
    ...(bySlot.get("setupCertificate")?.[0]
      ? { setupCertificate: bySlot.get("setupCertificate")![0] }
      : {}),
    ...(bySlot.get("fileTreeManifest")?.[0]
      ? { fileTreeManifest: bySlot.get("fileTreeManifest")![0] }
      : {}),
    ...(bySlot.get("sharedGrants")?.[0]
      ? { sharedGrants: bySlot.get("sharedGrants")![0] }
      : {}),
    stories: bySlot.get("stories") ?? [],
    repo: request.repo,
  });

  return LegacySourceSnapshotReadResultV1Schema.parse({
    runId: request.runId,
    snapshot,
    missingSources,
  });
}
