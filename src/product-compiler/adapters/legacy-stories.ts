import { z } from "zod";

import { SourceArtifactRefV1Schema } from "../schemas/common-v1.js";
import { StoryPlanV1Schema, type StoryPlanV1 } from "../schemas/story-plan-v1.js";
import {
  adapterDiagnostic,
  finalizeAdapterResult,
  invalidCandidateDiagnostics,
  provenanceFromSource,
  type AdapterResult,
} from "./types.js";

const LegacyStoryRowSchema = z
  .object({
    storyId: z.string().min(1).max(160),
    order: z.number().int().positive(),
    title: z.string().min(1).max(500),
    description: z.string().min(1).max(10_000),
    ownerRef: z.string().min(1).max(160),
    dependsOn: z.array(z.string().min(1).max(160)).max(1_000),
    surfaceRefs: z.array(z.string().min(1).max(160)).max(2_000),
    controlRefs: z.array(z.string().min(1).max(160)).max(10_000),
    actionRefs: z.array(z.string().min(1).max(160)).max(5_000),
    stateRefs: z.array(z.string().min(1).max(160)).max(2_000),
    persistenceRefs: z.array(z.string().min(1).max(160)).max(2_000),
    evidenceRefs: z.array(z.string().min(1).max(160)).max(5_000),
    ownedPathRefs: z.array(z.string().min(1).max(160)).max(10_000),
    sharedGrantRefs: z.array(z.string().min(1).max(160)).max(10_000),
  })
  .strict();

const LegacyStoriesAdapterInputSchema = z
  .object({
    source: SourceArtifactRefV1Schema,
    rows: z.array(LegacyStoryRowSchema).min(1).max(5_000),
  })
  .strict();

export function adaptLegacyStories(input: unknown): AdapterResult<StoryPlanV1> {
  const parsed = LegacyStoriesAdapterInputSchema.safeParse(input);
  if (!parsed.success) {
    return finalizeAdapterResult({
      diagnostics: parsed.error.issues.slice(0, 100).map((issue) => adapterDiagnostic({
        code: "ADAPTER_STORY_INPUT_INVALID",
        severity: "error",
        message: `Legacy story input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      })),
    });
  }

  const { source, rows } = parsed.data;
  const provenance = [provenanceFromSource(source, "derived_with_provenance")];
  const candidate = {
    schema: "setfarm.story-plan.v1",
    stories: rows.map((row) => ({
      id: row.storyId,
      order: row.order,
      title: row.title,
      description: row.description,
      ownerRef: row.ownerRef,
      dependsOn: [...row.dependsOn],
      surfaceRefs: [...row.surfaceRefs],
      controlRefs: [...row.controlRefs],
      actionRefs: [...row.actionRefs],
      stateRefs: [...row.stateRefs],
      persistenceRefs: [...row.persistenceRefs],
      evidenceRefs: [...row.evidenceRefs],
      ownedPathRefs: [...row.ownedPathRefs],
      sharedGrantRefs: [...row.sharedGrantRefs],
    })),
  };
  const result = StoryPlanV1Schema.safeParse(candidate);
  if (!result.success) {
    return finalizeAdapterResult({
      diagnostics: invalidCandidateDiagnostics(
        "ADAPTER_STORY_CONTRACT_INVALID",
        source,
        result.error,
      ),
      provenance,
    });
  }
  return finalizeAdapterResult({ candidate: result.data, provenance });
}
