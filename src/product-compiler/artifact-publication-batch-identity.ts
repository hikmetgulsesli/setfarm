// SETFARM_SEMANTIC_MIGRATION_REGION:artifact-publication-batch-v1:BEGIN
import { createHash } from "node:crypto";
import { z } from "zod";

const ArtifactPublicationBatchSha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const ArtifactPublicationBatchGitCodeShaSchema = z.string().regex(/^[a-f0-9]{7,64}$/);

export const ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA =
  "setfarm.artifact-publication-batch.v1" as const;
export const ARTIFACT_PUBLICATION_BATCH_ITEM_IDENTITY_SCHEMA =
  "setfarm.artifact-publication-batch-item.v1" as const;
export const ARTIFACT_PUBLICATION_BATCH_CHILD_IDENTITY_SCHEMA =
  "setfarm.artifact-publication-batch-child.v1" as const;

export const ARTIFACT_PUBLICATION_BATCH_MAX_CANONICAL_BYTES = 4 * 1024 * 1024;
export const ARTIFACT_PUBLICATION_BATCH_MAX_PRODUCER_IDENTITY_BYTES = 128 * 1024;
export const ARTIFACT_PUBLICATION_BATCH_MAX_TOTAL_PRODUCER_IDENTITY_BYTES = 512 * 1024;

function isDatabaseSafeUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0) return false;
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const following = value.charCodeAt(index + 1);
      if (following < 0xdc00 || following > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

const ArtifactPublicationBatchUtf8TextSchema = (maximum: number) => z.string()
  .min(1)
  .max(maximum)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= maximum,
    `Expected at most ${maximum} UTF-8 bytes`,
  )
  .refine(
    isDatabaseSafeUnicode,
    "Expected PostgreSQL-compatible Unicode scalar text without NUL",
  );

const PROTOTYPE_SENSITIVE_TOOL_VERSION_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

const ArtifactPublicationBatchToolKeySchema = ArtifactPublicationBatchUtf8TextSchema(100)
  .refine(
    (key) => !PROTOTYPE_SENSITIVE_TOOL_VERSION_KEYS.has(key),
    "Prototype-sensitive tool version keys are forbidden",
  );

const ArtifactPublicationBatchToolVersionsSchema = z.unknown()
  .superRefine((value, context) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const key of Object.keys(value)) {
      if (PROTOTYPE_SENSITIVE_TOOL_VERSION_KEYS.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Prototype-sensitive tool version key is forbidden: ${key}`,
        });
      }
    }
  })
  .pipe(z.record(
    ArtifactPublicationBatchToolKeySchema,
    ArtifactPublicationBatchUtf8TextSchema(200),
  ))
  .superRefine((toolVersions, context) => {
    if (Object.keys(toolVersions).length > 4_096) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Artifact publication batch producer has too many tool versions",
      });
    }
  });

const ArtifactPublicationBatchProducerV1Schema = z.object({
  pass: ArtifactPublicationBatchUtf8TextSchema(160),
  codeSha: ArtifactPublicationBatchGitCodeShaSchema,
  model: ArtifactPublicationBatchUtf8TextSchema(200).optional(),
  promptHash: ArtifactPublicationBatchSha256Schema.optional(),
  toolVersions: ArtifactPublicationBatchToolVersionsSchema,
}).strict().superRefine((producer, context) => {
  if (
    computeArtifactPublicationBatchProducerIdentityByteLength(producer)
      > ARTIFACT_PUBLICATION_BATCH_MAX_PRODUCER_IDENTITY_BYTES
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Artifact publication batch producer identity exceeds its byte budget",
    });
  }
});

export const ArtifactPublicationBatchIdentityItemSchema = z.object({
  hash: ArtifactPublicationBatchSha256Schema,
  artifactType: z.string().min(1).max(200).regex(
    /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/,
    "Expected a versioned semantic artifact type",
  ),
  byteLength: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  producer: ArtifactPublicationBatchProducerV1Schema,
}).strict();

export const ArtifactPublicationBatchReservationIdSchema = z.string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/, "Expected an ASCII artifact publication batch ID");

export type ArtifactPublicationBatchIdentityItem = z.infer<
  typeof ArtifactPublicationBatchIdentityItemSchema
>;

export function computeArtifactPublicationBatchProducerIdentityByteLength(
  producer: ArtifactPublicationBatchIdentityItem["producer"],
): number {
  let total = Buffer.byteLength(producer.pass, "utf8")
    + Buffer.byteLength(producer.codeSha, "utf8")
    + Buffer.byteLength(producer.model ?? "", "utf8")
    + Buffer.byteLength(producer.promptHash ?? "", "utf8");
  for (const [key, value] of Object.entries(producer.toolVersions)) {
    total += Buffer.byteLength(key, "utf8") + Buffer.byteLength(value, "utf8");
  }
  return total;
}

function frameUtf8(value: string): string {
  return `${Buffer.byteLength(value, "utf8")}:${value}`;
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function computeArtifactPublicationBatchItemIdentityHash(
  item: ArtifactPublicationBatchIdentityItem,
): string {
  const toolVersions = Object.entries(item.producer.toolVersions)
    .sort(([left], [right]) => compareUtf8(left, right))
    .map(([key, value]) => `${frameUtf8(key)}${frameUtf8(value)}`)
    .join("");
  const payload = [
    item.hash,
    item.artifactType,
    String(item.byteLength),
    item.producer.pass,
    item.producer.codeSha,
    item.producer.model ?? "",
    item.producer.promptHash ?? "",
  ].map(frameUtf8).join("") + toolVersions;
  return createHash("sha256")
    .update(`${ARTIFACT_PUBLICATION_BATCH_ITEM_IDENTITY_SCHEMA}\n${payload}`, "utf8")
    .digest("hex");
}

export function computeArtifactPublicationBatchIdentityHash(
  items: readonly ArtifactPublicationBatchIdentityItem[],
): string {
  const artifacts = [...items].sort((left, right) =>
    left.hash < right.hash ? -1 : left.hash > right.hash ? 1 : 0);
  return createHash("sha256")
    .update(`${ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA}\n`, "utf8")
    .update(
      artifacts.map(computeArtifactPublicationBatchItemIdentityHash).join("\n"),
      "utf8",
    )
    .digest("hex");
}

export function computeArtifactPublicationBatchChildReservationId(
  batchReservationId: string,
  batchIdentityHash: string,
  artifactHash: string,
): string {
  return `APRB_${createHash("sha256")
    .update(`${ARTIFACT_PUBLICATION_BATCH_CHILD_IDENTITY_SCHEMA}\n`, "utf8")
    .update(`${batchReservationId}\n${batchIdentityHash}\n${artifactHash}`, "utf8")
    .digest("hex")}`;
}
// SETFARM_SEMANTIC_MIGRATION_REGION:artifact-publication-batch-v1:END
