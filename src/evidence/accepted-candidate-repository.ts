import type postgres from "postgres";

import { EvidencePlanV1Schema, compileEvidencePlanV1 } from "./evidence-plan-v1.js";
import {
  EvidenceBundleV2Schema,
  computeEvidenceBundleHash,
} from "./evidence-bundle-v2.js";
import {
  AcceptedCandidateV1Schema,
  createAcceptedCandidateV1,
  type AcceptedCandidateV1,
} from "./accepted-candidate-v1.js";
import type { ArtifactCapacityLimits } from "../product-compiler/artifact-capacity.js";
import { SemanticArtifactEnvelopeV1Schema } from "../product-compiler/artifact-store.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { createRuntimeArtifactReader } from "../product-compiler/runtime-artifact-reader.js";
import { ImplementationSliceV1Schema } from "../product-compiler/schemas/implementation-slice-v1.js";
import { SourceRevisionV1Schema } from "../execution/schemas/execution-attempt-v1.js";

export type AcceptedCandidateRepositoryErrorCode =
  | "ACCEPTED_CANDIDATE_RUN_CONFLICT"
  | "ACCEPTED_CANDIDATE_STORY_SET_MISMATCH"
  | "ACCEPTED_CANDIDATE_STORY_STATUS_INVALID"
  | "ACCEPTED_CANDIDATE_ATTEMPT_INVALID"
  | "ACCEPTED_CANDIDATE_ARTIFACT_INVALID"
  | "ACCEPTED_CANDIDATE_EVIDENCE_INVALID"
  | "ACCEPTED_CANDIDATE_PREDICATE_COVERAGE_INVALID"
  | "ACCEPTED_CANDIDATE_UNSETTLED_RECOVERY"
  | "ACCEPTED_CANDIDATE_CAS_LOST";

export class AcceptedCandidateRepositoryError extends Error {
  readonly code: AcceptedCandidateRepositoryErrorCode;

  constructor(code: AcceptedCandidateRepositoryErrorCode, message: string) {
    super(message);
    this.name = "AcceptedCandidateRepositoryError";
    this.code = code;
  }
}

function fail(code: AcceptedCandidateRepositoryErrorCode, message: string): never {
  throw new AcceptedCandidateRepositoryError(code, message);
}

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

type AttemptRow = Readonly<{
  attempt_id: string;
  run_id: string;
  story_id: string;
  attempt_class: string;
  packet_hash: string | null;
  slice_hash: string | null;
  source_before_sha: string;
  source_before_tree_hash: string;
  source_after_sha: string | null;
  source_after_tree_hash: string | null;
  disposition: string;
  output_hash: string | null;
  evidence_refs: string;
}>;

type EvidenceRow = Readonly<{
  evidence_bundle_hash: string;
  evidence_id: string;
  run_id: string;
  story_id: string;
  packet_hash: string;
  slice_hash: string;
  source_sha: string;
  source_tree_hash: string;
  attempt_id: string | null;
  aggregate_verdict: string;
  payload: unknown;
}>;

function stringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function exactStrings(left: readonly string[], right: readonly string[]): boolean {
  const first = [...left].sort();
  const second = [...right].sort();
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function expectedPredicateRefs(plan: ReturnType<typeof EvidencePlanV1Schema.parse>): string[] {
  return [
    ...plan.predicateRefs,
    ...plan.commands.map((command) => `EVID_COMMAND_${command.commandRef}`),
  ].sort();
}

export function createAcceptedCandidateRepository(input: Readonly<{
  sql: Sql;
  artifactRoot: string;
  artifactLimits: ArtifactCapacityLimits;
}>) {
  const reader = createRuntimeArtifactReader(input);

  async function readExactArtifact(
    artifactHash: string,
    artifactType: "setfarm.implementation-slice.v1" | "setfarm.evidence-plan.v1",
    producer: unknown,
  ) {
    const [indexed, stored] = await Promise.all([
      reader.index.getArtifact(artifactHash),
      reader.store.get(artifactHash),
    ]);
    const envelope = SemanticArtifactEnvelopeV1Schema.parse(stored.envelope);
    if (
      !indexed
      || indexed.artifactType !== artifactType
      || envelope.artifactType !== artifactType
      || indexed.byteLength !== stored.bytes.byteLength
      || canonicalJsonStringify(indexed.producer) !== canonicalJsonStringify(envelope.producer)
      || canonicalJsonStringify(envelope.producer) !== canonicalJsonStringify(producer)
    ) {
      fail("ACCEPTED_CANDIDATE_ARTIFACT_INVALID", `${artifactHash} is not the exact packet-owned ${artifactType}`);
    }
    return envelope;
  }

  return Object.freeze({
    async findByRun(runId: string): Promise<AcceptedCandidateV1 | undefined> {
      const rows = await input.sql.unsafe<Array<{ payload: unknown }>>(
        "SELECT payload FROM accepted_candidates WHERE run_id = $1 LIMIT 1",
        [runId],
      );
      return rows[0] ? AcceptedCandidateV1Schema.parse(rows[0].payload) : undefined;
    },

    async publish(raw: Readonly<{
      runId: string;
      sourceRevision: unknown;
      storyEvidence: readonly Readonly<{
        storyId: string;
        attemptId: string;
        evidencePlanArtifactHash: string;
        evidenceBundleHash: string;
      }>[];
      now?: Date;
    }>): Promise<Readonly<{ created: boolean; candidate: AcceptedCandidateV1 }>> {
      const runId = raw.runId.trim();
      const sourceRevision = SourceRevisionV1Schema.parse(raw.sourceRevision);
      const alreadyAccepted = await this.findByRun(runId);
      if (alreadyAccepted) {
        const requested = [...raw.storyEvidence]
          .map((story) => ({
            storyId: story.storyId,
            attemptId: story.attemptId,
            evidencePlanArtifactHash: story.evidencePlanArtifactHash,
            evidenceBundleHash: story.evidenceBundleHash,
          }))
          .sort((left, right) => left.storyId.localeCompare(right.storyId));
        const stored = alreadyAccepted.storyEvidence.map((story) => ({
          storyId: story.storyId,
          attemptId: story.attemptId,
          evidencePlanArtifactHash: story.evidencePlanArtifactHash,
          evidenceBundleHash: story.evidenceBundleHash,
        }));
        if (
          canonicalJsonStringify(alreadyAccepted.sourceRevision) !== canonicalJsonStringify(sourceRevision)
          || canonicalJsonStringify(stored) !== canonicalJsonStringify(requested)
        ) {
          fail("ACCEPTED_CANDIDATE_RUN_CONFLICT", "run is already sealed to another candidate identity");
        }
        const storyRows = await input.sql.unsafe<Array<{ story_id: string; status: string }>>(
          `SELECT story_id, status FROM stories
            WHERE run_id = $1 AND story_id = ANY($2::text[])
              AND story_id NOT LIKE 'QA-FIX-%'
            ORDER BY story_id`,
          [runId, requested.map((story) => story.storyId)],
        );
        if (
          !exactStrings(storyRows.map((story) => story.story_id), requested.map((story) => story.storyId))
          || storyRows.some((story) => story.status !== "verified")
        ) {
          fail("ACCEPTED_CANDIDATE_STORY_STATUS_INVALID", "accepted candidate stories must retain the canonical verified projection");
        }
        return { created: false, candidate: alreadyAccepted };
      }
      const packet = await reader.readSealedPacket(runId);
      const expectedStoryIds = packet.storyPlan.stories.map((story) => story.id).sort();
      const requestedStoryIds = raw.storyEvidence.map((story) => story.storyId).sort();
      if (!exactStrings(expectedStoryIds, requestedStoryIds)) {
        fail("ACCEPTED_CANDIDATE_STORY_SET_MISMATCH", "final evidence must cover every sealed StoryPlan story exactly once");
      }

      return input.sql.begin(async (transaction) => {
        await transaction.unsafe(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [`accepted-candidate:${runId}`],
        );
        const runRows = await transaction.unsafe<Array<{
          status: string;
          protocol: string;
          packet_hash: string | null;
          accepted_candidate_hash: string | null;
        }>>(
          `SELECT status, protocol, packet_hash, accepted_candidate_hash
             FROM runs WHERE id = $1 FOR UPDATE`,
          [runId],
        );
        const run = runRows[0];
        if (
          !run
          || run.protocol !== "v3"
          || !["running", "resuming"].includes(run.status)
          || run.packet_hash !== packet.packetHash
        ) {
          fail("ACCEPTED_CANDIDATE_RUN_CONFLICT", "run is not the active owner of the sealed packet");
        }
        const storyRows = await transaction.unsafe<Array<{ story_id: string; status: string }>>(
          `SELECT story_id, status FROM stories
            WHERE run_id = $1 AND story_id = ANY($2::text[])
              AND story_id NOT LIKE 'QA-FIX-%'
            ORDER BY story_id FOR UPDATE`,
          [runId, expectedStoryIds],
        );
        if (
          !exactStrings(storyRows.map((story) => story.story_id), expectedStoryIds)
          || storyRows.some((story) => !["done", "verified"].includes(story.status))
        ) {
          fail("ACCEPTED_CANDIDATE_STORY_STATUS_INVALID", "final acceptance requires every sealed story to be done or verified");
        }
        const unsettledRows = await transaction.unsafe<Array<{
          active_attempts: number;
          open_findings: number;
          active_recovery: number;
        }>>(
          `SELECT
             (SELECT COUNT(*)::integer FROM execution_attempts
               WHERE run_id = $1 AND disposition IN ('claimed', 'running')) AS active_attempts,
             (SELECT COUNT(*)::integer FROM findings f
               JOIN finding_sets fs ON fs.finding_set_hash = f.finding_set_hash
              WHERE fs.run_id = $1 AND f.status = 'open') AS open_findings,
             (SELECT COUNT(*)::integer FROM recovery_cases
               WHERE run_id = $1 AND status IN ('open', 'repairing', 'evidencing')) AS active_recovery`,
          [runId],
        );
        const unsettled = unsettledRows[0];
        if (!unsettled || unsettled.active_attempts > 0 || unsettled.open_findings > 0 || unsettled.active_recovery > 0) {
          fail("ACCEPTED_CANDIDATE_UNSETTLED_RECOVERY", "candidate cannot seal active attempts, findings, or recovery ownership");
        }

        const acceptedStories = [];
        const evidenceRunners: Array<Readonly<{
          storyId: string;
          id: string;
          version: string;
          environmentHash: string;
        }>> = [];
        const coveredProductPredicates = new Set<string>();
        for (const request of [...raw.storyEvidence].sort((left, right) => left.storyId.localeCompare(right.storyId))) {
          const attemptRows = await transaction.unsafe<AttemptRow[]>(
            `SELECT attempt_id, run_id, story_id, attempt_class, packet_hash, slice_hash,
                    source_before_sha, source_before_tree_hash, source_after_sha,
                    source_after_tree_hash, disposition, output_hash, evidence_refs
               FROM execution_attempts WHERE attempt_id = $1 FOR SHARE`,
            [request.attemptId],
          );
          const attempt = attemptRows[0];
          if (
            !attempt
            || attempt.run_id !== runId
            || attempt.story_id !== request.storyId
            || attempt.attempt_class !== "evidence_only"
            || attempt.packet_hash !== packet.packetHash
            || !attempt.slice_hash
            || attempt.source_before_sha !== sourceRevision.sha
            || attempt.source_before_tree_hash !== sourceRevision.treeHash
            || attempt.source_after_sha !== sourceRevision.sha
            || attempt.source_after_tree_hash !== sourceRevision.treeHash
            || attempt.disposition !== "verified"
            || attempt.output_hash !== request.evidenceBundleHash
          ) {
            fail("ACCEPTED_CANDIDATE_ATTEMPT_INVALID", `${request.storyId} is not a verified final-source evidence-only attempt`);
          }
          const refs = stringArray(attempt.evidence_refs);
          if (
            !refs.includes(`setfarm://artifact/${attempt.slice_hash}`)
            || !refs.includes(`setfarm://artifact/${request.evidencePlanArtifactHash}`)
            || !refs.includes(`setfarm://evidence-bundle/${request.evidenceBundleHash}`)
          ) {
            fail("ACCEPTED_CANDIDATE_ATTEMPT_INVALID", `${request.storyId} attempt lacks exact canonical evidence refs`);
          }
          const artifactRefs = await transaction.unsafe<Array<{ artifact_hash: string; ref_key: string }>>(
            `SELECT artifact_hash, ref_key FROM run_artifact_refs
              WHERE run_id = $1 AND artifact_hash = ANY($2::text[])
              ORDER BY artifact_hash, ref_key`,
            [runId, [attempt.slice_hash, request.evidencePlanArtifactHash]],
          );
          const indexedHashes = new Set(artifactRefs.map((reference) => reference.artifact_hash));
          if (
            !indexedHashes.has(attempt.slice_hash)
            || !indexedHashes.has(request.evidencePlanArtifactHash)
          ) {
            fail("ACCEPTED_CANDIDATE_ARTIFACT_INVALID", `${request.storyId} final slice and plan lack immutable run refs`);
          }

          const sliceEnvelope = await readExactArtifact(
            attempt.slice_hash,
            "setfarm.implementation-slice.v1",
            packet.producer,
          );
          const slice = ImplementationSliceV1Schema.parse(sliceEnvelope.payload);
          if (
            slice.packetHash !== packet.packetHash
            || slice.storyId !== request.storyId
            || slice.sourceRevision.baseSha !== sourceRevision.sha
            || slice.sourceRevision.treeHash !== sourceRevision.treeHash
          ) {
            fail("ACCEPTED_CANDIDATE_ARTIFACT_INVALID", `${request.storyId} slice is not compiled from the final source`);
          }
          const planEnvelope = await readExactArtifact(
            request.evidencePlanArtifactHash,
            "setfarm.evidence-plan.v1",
            packet.producer,
          );
          const plan = EvidencePlanV1Schema.parse(planEnvelope.payload);
          const expectedPlan = compileEvidencePlanV1({ slice, sliceHash: attempt.slice_hash });
          if (canonicalJsonStringify(plan) !== canonicalJsonStringify(expectedPlan)) {
            fail("ACCEPTED_CANDIDATE_ARTIFACT_INVALID", `${request.storyId} evidence plan is not exact slice-derived authority`);
          }

          const evidenceRows = await transaction.unsafe<EvidenceRow[]>(
            `SELECT evidence_bundle_hash, evidence_id, run_id, story_id, packet_hash,
                    slice_hash, source_sha, source_tree_hash, attempt_id,
                    aggregate_verdict, payload
               FROM evidence_bundles WHERE evidence_bundle_hash = $1 FOR SHARE`,
            [request.evidenceBundleHash],
          );
          const evidenceRow = evidenceRows[0];
          if (!evidenceRow) {
            fail("ACCEPTED_CANDIDATE_EVIDENCE_INVALID", `${request.storyId} evidence bundle is absent`);
          }
          const bundle = EvidenceBundleV2Schema.parse(evidenceRow.payload);
          if (
            computeEvidenceBundleHash(bundle) !== request.evidenceBundleHash
            || evidenceRow.evidence_id !== bundle.evidenceId
            || bundle.runId !== runId
            || bundle.storyId !== request.storyId
            || bundle.packetHash !== packet.packetHash
            || bundle.sliceHash !== attempt.slice_hash
            || bundle.sourceRevision.sha !== sourceRevision.sha
            || bundle.sourceRevision.treeHash !== sourceRevision.treeHash
            || bundle.attemptId !== attempt.attempt_id
            || bundle.aggregateVerdict !== "pass"
            || bundle.runner.id !== "setfarm-canonical-evidence-runner"
          ) {
            fail("ACCEPTED_CANDIDATE_EVIDENCE_INVALID", `${request.storyId} bundle is not canonical passing final-source evidence`);
          }
          const predicates = bundle.predicates.map((predicate) => predicate.predicateRef).sort();
          if (!exactStrings(predicates, expectedPredicateRefs(plan))) {
            fail("ACCEPTED_CANDIDATE_PREDICATE_COVERAGE_INVALID", `${request.storyId} bundle does not exactly cover its evidence plan`);
          }
          plan.predicateRefs.forEach((reference) => coveredProductPredicates.add(reference));
          evidenceRunners.push({ storyId: request.storyId, ...bundle.runner });
          acceptedStories.push({
            storyId: request.storyId,
            attemptId: attempt.attempt_id,
            sliceHash: attempt.slice_hash,
            evidencePlanHash: plan.planHash,
            evidencePlanArtifactHash: request.evidencePlanArtifactHash,
            evidenceBundleHash: request.evidenceBundleHash,
            evidenceId: bundle.evidenceId,
            predicateRefs: predicates,
          });
        }

        const allProductPredicates = packet.productSpec.evidencePredicates.map((predicate) => predicate.id);
        if (!exactStrings([...coveredProductPredicates], allProductPredicates)) {
          fail(
            "ACCEPTED_CANDIDATE_PREDICATE_COVERAGE_INVALID",
            "final-source story evidence does not exactly cover the sealed ProductSpec predicate set",
          );
        }
        const candidate = createAcceptedCandidateV1({
          runId,
          packetHash: packet.packetHash,
          storyPlanHash: packet.refs.storyPlan,
          sourceRevision,
          storyEvidence: acceptedStories,
          acceptor: {
            id: "setfarm-final-tree-acceptor",
            version: "1.0.0",
            codeSha: packet.packet.compiler.codeSha,
            environmentHash: hashCanonicalJson({
              schema: "setfarm.final-tree-acceptor-environment.v1",
              evidenceRunners: evidenceRunners.sort((left, right) => left.storyId.localeCompare(right.storyId)),
            }),
          },
        });
        const existingRows = await transaction.unsafe<Array<{ payload: unknown }>>(
          "SELECT payload FROM accepted_candidates WHERE run_id = $1 FOR SHARE",
          [runId],
        );
        if (existingRows[0]) {
          const existing = AcceptedCandidateV1Schema.parse(existingRows[0].payload);
          if (canonicalJsonStringify(existing) !== canonicalJsonStringify(candidate)) {
            fail("ACCEPTED_CANDIDATE_RUN_CONFLICT", "run is already sealed to another candidate");
          }
          return { created: false, candidate: existing };
        }

        await transaction.unsafe(
          `INSERT INTO accepted_candidates (
             candidate_hash, candidate_id, run_id, packet_hash, story_plan_hash,
             source_sha, source_tree_hash, integration_evidence_hash, payload, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb, $10)`,
          [
            candidate.candidateHash,
            candidate.candidateId,
            candidate.runId,
            candidate.packetHash,
            candidate.storyPlanHash,
            candidate.sourceRevision.sha,
            candidate.sourceRevision.treeHash,
            candidate.integrationEvidenceHash,
            JSON.stringify(candidate),
            raw.now ?? new Date(),
          ],
        );
        for (const story of candidate.storyEvidence) {
          await transaction.unsafe(
            `INSERT INTO accepted_candidate_story_evidence (
               candidate_hash, story_id, attempt_id, slice_hash,
               evidence_plan_hash, evidence_plan_artifact_hash,
               evidence_bundle_hash, evidence_id, predicate_refs, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb, $10)`,
            [
              candidate.candidateHash,
              story.storyId,
              story.attemptId,
              story.sliceHash,
              story.evidencePlanHash,
              story.evidencePlanArtifactHash,
              story.evidenceBundleHash,
              story.evidenceId,
              JSON.stringify(story.predicateRefs),
              raw.now ?? new Date(),
            ],
          );
        }
        const verifiedStories = await transaction.unsafe<Array<{ story_id: string }>>(
          `UPDATE stories SET status = 'verified', updated_at = $3
            WHERE run_id = $1 AND story_id = ANY($2::text[])
              AND story_id NOT LIKE 'QA-FIX-%' AND status IN ('done', 'verified')
            RETURNING story_id`,
          [runId, expectedStoryIds, raw.now ?? new Date()],
        );
        if (!exactStrings(verifiedStories.map((story) => story.story_id), expectedStoryIds)) {
          fail("ACCEPTED_CANDIDATE_STORY_STATUS_INVALID", "story verification projection compare-and-swap lost");
        }
        const updated = await transaction.unsafe<Array<{ id: string }>>(
          `UPDATE runs SET accepted_candidate_hash = $2
            WHERE id = $1 AND protocol = 'v3' AND status IN ('running', 'resuming')
              AND packet_hash = $3 AND accepted_candidate_hash IS NULL
            RETURNING id`,
          [runId, candidate.candidateHash, packet.packetHash],
        );
        if (updated.length !== 1) {
          fail("ACCEPTED_CANDIDATE_CAS_LOST", "run candidate pointer compare-and-swap lost");
        }
        return { created: true, candidate };
      }) as Promise<Readonly<{ created: boolean; candidate: AcceptedCandidateV1 }>>;
    },
  });
}
