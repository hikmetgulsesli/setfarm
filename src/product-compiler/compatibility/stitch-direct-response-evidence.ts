import type { z } from "zod";

import {
  StitchDirectResponseEvidenceV1Schema,
  type StitchDirectResponseEvidenceV1,
} from "../schemas/stitch-direct-response-evidence-v1.js";
import {
  StitchDirectResponseEvidenceV2Schema,
  type StitchDirectResponseEvidenceV2,
} from "../schemas/stitch-direct-response-evidence-v2.js";

type Source = StitchDirectResponseEvidenceV1 | StitchDirectResponseEvidenceV2;

export type NormalizedStitchDirectResponseEvidence = Readonly<{
  projectId: string;
  batches: Array<Readonly<{
    stageId: string;
    targetRefs: string[];
    source: "direct";
    candidates: Array<Readonly<{
      screenId: string;
      title: string;
      responsePaths: string[];
      htmlAvailable: boolean;
      screenshotAvailable: boolean;
      disposition: "admitted_renderable_screen" | "excluded_missing_render_evidence" | "excluded_identity_conflict";
      missingEvidence: Array<"html" | "screenshot">;
      identityConflicts: Array<"title" | "html_url" | "screenshot_url" | "width" | "height" | "screen_id" | "render_evidence_splice">;
      htmlSourceRefHash: string | null;
      screenshotSourceRefHash: string | null;
      htmlDownloadedArtifactHash: string | null;
      screenshotDownloadedArtifactHash: string | null;
    }>>;
  }>>;
}>;

export type ParsedStitchDirectResponseEvidence = Readonly<{
  status: "parsed";
  sourceVersion: "v1" | "v2";
  source: Source;
  normalized: NormalizedStitchDirectResponseEvidence;
  capabilities: Readonly<{
    identityConflictEvidence: boolean;
    attemptBoundDownloadReceipts: boolean;
  }>;
}>;

export function parseStitchDirectResponseEvidence(input: unknown):
  | ParsedStitchDirectResponseEvidence
  | Readonly<{ status: "rejected"; issues: z.core.$ZodIssue[] }> {
  const requestedV2 = (input as { schema?: unknown })?.schema === "setfarm.stitch-direct-response-evidence.v2";
  const parsed = requestedV2
    ? StitchDirectResponseEvidenceV2Schema.safeParse(input)
    : StitchDirectResponseEvidenceV1Schema.safeParse(input);
  if (!parsed.success) return { status: "rejected", issues: parsed.error.issues };
  const source = parsed.data as Source;
  const sourceVersion = source.schema === "setfarm.stitch-direct-response-evidence.v2" ? "v2" : "v1";
  return {
    status: "parsed",
    sourceVersion,
    source,
    normalized: {
      projectId: source.projectId,
      batches: source.batches.map((batch) => ({
        stageId: batch.stageId,
        targetRefs: [...batch.targetRefs],
        source: "direct",
        candidates: batch.candidates.map((candidate) => {
          const v2 = candidate as typeof candidate & Partial<StitchDirectResponseEvidenceV2["batches"][number]["candidates"][number]>;
          return {
            screenId: candidate.screenId,
            title: candidate.title,
            responsePaths: [...candidate.responsePaths],
            htmlAvailable: candidate.htmlAvailable,
            screenshotAvailable: candidate.screenshotAvailable,
            disposition: candidate.disposition,
            missingEvidence: [...candidate.missingEvidence],
            identityConflicts: [...(v2.identityConflicts ?? [])],
            htmlSourceRefHash: v2.htmlSourceRefHash ?? null,
            screenshotSourceRefHash: v2.screenshotSourceRefHash ?? null,
            htmlDownloadedArtifactHash: v2.htmlDownloadedArtifactHash ?? null,
            screenshotDownloadedArtifactHash: v2.screenshotDownloadedArtifactHash ?? null,
          };
        }),
      })),
    },
    capabilities: {
      identityConflictEvidence: sourceVersion === "v2",
      attemptBoundDownloadReceipts: sourceVersion === "v2",
    },
  };
}
