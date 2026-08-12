import { createHash } from "node:crypto";

import {
  Sha256Schema,
  StableReferenceSchema,
  StoryIdSchema,
} from "../product-compiler/schemas/common-v1.js";

export const V3_ARTIFACT_REF_KEY_V2_MAX_LENGTH = 160;

export type V3ArtifactRefKindV2 = "slice" | "evidence_plan";

const PREFIX_BY_KIND = Object.freeze({
  slice: "SLICE_V2",
  evidence_plan: "EVIDENCE_PLAN_V2",
} satisfies Record<V3ArtifactRefKindV2, string>);

/**
 * Produces a bounded ref without embedding a caller-controlled story ID.
 * Full artifact hashes are retained so two publications cannot alias through
 * a truncated display token.
 */
export function createV3ArtifactRefKeyV2(
  kind: V3ArtifactRefKindV2,
  storyIdInput: string,
  artifactHashInput: string,
): string {
  const storyId = StoryIdSchema.parse(storyIdInput);
  const artifactHash = Sha256Schema.parse(artifactHashInput);
  const storyHash = createHash("sha256")
    .update("setfarm.v3-artifact-ref-story.v2\0", "utf8")
    .update(storyId, "utf8")
    .digest("hex")
    .toUpperCase();
  const refKey = `${PREFIX_BY_KIND[kind]}_${storyHash}_${artifactHash.toUpperCase()}`;
  if (refKey.length > V3_ARTIFACT_REF_KEY_V2_MAX_LENGTH) {
    throw new Error("V3_ARTIFACT_REF_KEY_V2_CAPACITY_EXCEEDED");
  }
  return StableReferenceSchema.parse(refKey);
}
