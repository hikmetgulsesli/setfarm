import type postgres from "postgres";

import { SemanticArtifactEnvelopeV1Schema } from "../product-compiler/artifact-store.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { IndexedArtifactPublisher } from "../product-compiler/indexed-artifact-publisher.js";
import { createRuntimeArtifactReader } from "../product-compiler/runtime-artifact-reader.js";
import { createHybridArtifactStoreCapacityLeaseProviderV1 } from "../product-compiler/artifact-store-authority.js";
import type { SemanticArtifactProducerV1 } from "../product-compiler/schemas/common-v1.js";
import { ImplementationSliceV1Schema } from "../product-compiler/schemas/implementation-slice-v1.js";
import {
  resolveArtifactStorePublicationAuthorityMode,
  resolveProductArtifactCapacity,
  resolveProductArtifactDir,
} from "../runtime-config.js";
import { getSql } from "../db-pg.js";
import { createFindingRecoveryRepository } from "../recovery/finding-recovery-repository.js";
import { createRecoveryDeliveryRepository } from "../recovery/recovery-delivery-repository.js";
import type { RecoveryCaseV1 } from "../recovery/recovery-case.js";
import type { RecoveryCaseRevisionV1 } from "../recovery/recovery-delivery.js";
import {
  createDefaultGithubReviewSourcePort,
  createGithubReviewSource,
  type GithubReviewThreadEvidenceV1,
} from "./github-review-source.js";
import { ingestGithubReviewThreadsV1 } from "./github-review-ingestion.js";
import type { FindingSetV1 } from "./finding-set.js";
import type { V3GithubReviewDispatchAuthorityV1 } from "./github-review-routing-authority.js";

export type V3GithubReviewImplementationAuthority = Readonly<{
  packetHash: string;
  producer: SemanticArtifactProducerV1;
  storyDbId: string;
  attemptId: string;
  contractSliceHash: string;
  sourceRevision: Readonly<{ sha: string; treeHash: string }>;
  evidencePlan: readonly string[];
}>;

type RouterDependencies = Readonly<{
  readReview(input: Readonly<{ prUrl: string; repositoryPath: string }>): Promise<Readonly<{
    prState: "OPEN" | "CLOSED" | "MERGED";
    headSha: string;
    actionableThreads: readonly GithubReviewThreadEvidenceV1[];
  }>>;
  loadImplementationAuthority(input: Readonly<{
    runId: string;
    storyId: string;
    headSha: string;
    paths: readonly string[];
  }>): Promise<V3GithubReviewImplementationAuthority>;
  publishEvidence(envelope: unknown): Promise<Readonly<{ hash: string }>>;
  addRunRef(input: Readonly<{ runId: string; refKey: string; artifactHash: string }>): Promise<unknown>;
  putFindingSet(findingSet: FindingSetV1): Promise<unknown>;
  openRecoveryCase(input: Parameters<ReturnType<typeof createFindingRecoveryRepository>["openRecoveryCase"]>[0]): Promise<Readonly<{
    recoveryCase: RecoveryCaseV1;
  }>>;
  findRecoveryCase(recoveryCaseId: string): Promise<RecoveryCaseV1 | undefined>;
  findCurrentRevision(recoveryCaseId: string): Promise<RecoveryCaseRevisionV1 | undefined>;
  authorizeCurrentRevision(input: unknown): Promise<Readonly<{
    status: "authorized" | "duplicate" | "finding_conflict" | "budget_exhausted" | "stale_version";
    dispatch?: Readonly<{ dispatchId: string }>;
  }>>;
}>;

export type V3GithubReviewRouteResult =
  | Readonly<{ status: "clean" | "pr_not_open"; headSha: string }>
  | Readonly<{
      status: "routed" | "duplicate" | "unchanged_terminal";
      headSha: string;
      findingSetHash: string;
      recoveryCaseId: string;
      dispatchId?: string;
      evidenceArtifactHashes: readonly string[];
    }>;

export class V3GithubReviewRouterError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "V3GithubReviewRouterError";
    this.code = code;
  }
}

function reviewArtifactEnvelope(
  producer: SemanticArtifactProducerV1,
  evidence: GithubReviewThreadEvidenceV1,
) {
  return SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: "setfarm.github-review-thread-evidence.v1",
    producer,
    payload: evidence,
  });
}

function reviewRefKey(artifactHash: string): string {
  return `GITHUB_REVIEW_${artifactHash.slice(0, 32).toUpperCase()}`;
}

export function createV3GithubReviewRouter(dependencies: RouterDependencies) {
  return Object.freeze({
    async route(input: Readonly<{
      runId: string;
      verifyStepDbId: string;
      verifyClaimId: number;
      storyId: string;
      prUrl: string;
      repositoryPath: string;
    }>): Promise<V3GithubReviewRouteResult> {
      const review = await dependencies.readReview({
        prUrl: input.prUrl,
        repositoryPath: input.repositoryPath,
      });
      if (review.prState !== "OPEN") {
        return { status: "pr_not_open", headSha: review.headSha };
      }
      if (review.actionableThreads.length === 0) {
        return { status: "clean", headSha: review.headSha };
      }
      const paths = [...new Set(review.actionableThreads.map((thread) => thread.path))].sort();
      const authority = await dependencies.loadImplementationAuthority({
        runId: input.runId,
        storyId: input.storyId,
        headSha: review.headSha,
        paths,
      });
      if (authority.sourceRevision.sha !== review.headSha) {
        throw new V3GithubReviewRouterError(
          "V3_GITHUB_REVIEW_HEAD_AUTHORITY_MISMATCH",
          "GitHub review head differs from the exact terminal implementation attempt",
        );
      }

      const published = [] as Array<Readonly<{
        artifactHash: string;
        evidence: GithubReviewThreadEvidenceV1;
      }>>;
      for (const evidence of review.actionableThreads) {
        const envelope = reviewArtifactEnvelope(authority.producer, evidence);
        const expectedHash = hashCanonicalJson(envelope);
        const publication = await dependencies.publishEvidence(envelope);
        if (publication.hash !== expectedHash) {
          throw new V3GithubReviewRouterError(
            "V3_GITHUB_REVIEW_PUBLICATION_HASH_MISMATCH",
            `Published review evidence ${publication.hash} differs from ${expectedHash}`,
          );
        }
        await dependencies.addRunRef({
          runId: input.runId,
          refKey: reviewRefKey(publication.hash),
          artifactHash: publication.hash,
        });
        published.push({ artifactHash: publication.hash, evidence });
      }
      published.sort((left, right) => left.evidence.threadId.localeCompare(right.evidence.threadId));
      const findingSet = ingestGithubReviewThreadsV1({
        schema: "setfarm.github-review-finding-set-input.v1",
        runId: input.runId,
        storyId: input.storyId,
        packetHash: authority.packetHash,
        sliceHash: authority.contractSliceHash,
        sourceRevision: authority.sourceRevision,
        reviews: published.map(({ artifactHash, evidence }) => ({
          evidenceArtifactHash: artifactHash,
          comment: {
            repositoryNodeId: evidence.repository.nodeId,
            prNumber: evidence.prNumber,
            threadId: evidence.threadId,
            commentId: evidence.comments[evidence.comments.length - 1]!.commentId,
            headSha: evidence.headSha,
            bodyRevisionHash: evidence.bodyRevisionHash,
            currentSource: {
              path: evidence.path,
              contentHash: evidence.currentSource.contentHash,
            },
          },
        })),
      });
      await dependencies.putFindingSet(findingSet);
      const evidenceArtifactHashes = published.map((artifact) => artifact.artifactHash).sort();
      const opened = await dependencies.openRecoveryCase({
        runId: input.runId,
        storyId: input.storyId,
        findingSetHash: findingSet.findingSetHash,
        findingIds: findingSet.findings.map((finding) => finding.findingId),
        packetHash: authority.packetHash,
        sliceHash: authority.contractSliceHash,
        sourceRevision: authority.sourceRevision,
        owner: "supervisor",
        expectedDelta: {
          kind: "source_change",
          invariantRefs: ["INV_UNSTRUCTURED_REVIEW"],
          requiredPaths: paths,
        },
        allowedPaths: paths,
        evidencePlan: [...new Set([
          ...authority.evidencePlan,
          "EVID_REVIEW_THREAD_RESOLVED",
        ])].sort(),
        priorAttemptRefs: [authority.attemptId],
        budget: {
          limits: { implement: 0, supervisorRepair: 1, evidenceOnly: 3 },
          used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
        },
        status: "open",
        decisionRefs: evidenceArtifactHashes,
      });
      const currentCase = await dependencies.findRecoveryCase(opened.recoveryCase.recoveryCaseId);
      if (!currentCase) {
        throw new V3GithubReviewRouterError(
          "V3_GITHUB_REVIEW_RECOVERY_CASE_MISSING",
          "Durable review recovery case disappeared before dispatch authorization",
        );
      }
      if (["resolved", "blocked", "superseded"].includes(currentCase.status)) {
        return {
          status: "unchanged_terminal",
          headSha: review.headSha,
          findingSetHash: findingSet.findingSetHash,
          recoveryCaseId: currentCase.recoveryCaseId,
          evidenceArtifactHashes,
        };
      }
      const revision = await dependencies.findCurrentRevision(currentCase.recoveryCaseId);
      if (!revision || revision.findingSetHash !== findingSet.findingSetHash) {
        throw new V3GithubReviewRouterError(
          "V3_GITHUB_REVIEW_REVISION_MISMATCH",
          "Current recovery revision differs from the exact GitHub review finding set",
        );
      }
      const reviewAuthority: V3GithubReviewDispatchAuthorityV1 = {
        schema: "setfarm.v3-github-review-dispatch-authority.v1",
        runId: input.runId,
        verifyStepDbId: input.verifyStepDbId,
        workflowStepId: "verify",
        parentClaimId: input.verifyClaimId,
        storyId: input.storyId,
        storyDbId: authority.storyDbId,
        packetHash: authority.packetHash,
        implementationAttemptId: authority.attemptId,
        contractSliceHash: authority.contractSliceHash,
        sourceRevision: authority.sourceRevision,
        reviews: published.map(({ artifactHash, evidence }) => ({
          evidenceArtifactHash: artifactHash,
          repositoryNodeId: evidence.repository.nodeId,
          prNumber: evidence.prNumber,
          threadId: evidence.threadId,
          commentId: evidence.comments[evidence.comments.length - 1]!.commentId,
          headSha: evidence.headSha,
          bodyRevisionHash: evidence.bodyRevisionHash,
          path: evidence.path,
          sourceContentHash: evidence.currentSource.contentHash,
        })),
      };
      const authorization = await dependencies.authorizeCurrentRevision({
        recoveryCaseId: currentCase.recoveryCaseId,
        revisionId: revision.revisionId,
        expectedStateVersion: currentCase.stateVersion,
        dispatchClass: "supervisor_repair",
        githubReview: reviewAuthority,
      });
      if (authorization.status === "authorized" || authorization.status === "duplicate") {
        return {
          status: authorization.status === "authorized" ? "routed" : "duplicate",
          headSha: review.headSha,
          findingSetHash: findingSet.findingSetHash,
          recoveryCaseId: currentCase.recoveryCaseId,
          ...(authorization.dispatch?.dispatchId
            ? { dispatchId: authorization.dispatch.dispatchId }
            : {}),
          evidenceArtifactHashes,
        };
      }
      throw new V3GithubReviewRouterError(
        `V3_GITHUB_REVIEW_DISPATCH_${authorization.status.toUpperCase()}`,
        `GitHub review recovery dispatch returned ${authorization.status}`,
      );
    },
  });
}

type ImplementationAuthorityRow = Readonly<{
  story_db_id: string;
  story_status: string;
  attempt_id: string;
  packet_hash: string | null;
  slice_hash: string | null;
  source_after_sha: string | null;
  source_after_tree_hash: string | null;
  disposition: string;
  claim_outcome: string | null;
}>;

async function loadDefaultImplementationAuthority(input: Readonly<{
  sql: postgres.Sql;
  reader: ReturnType<typeof createRuntimeArtifactReader>;
  runId: string;
  storyId: string;
  headSha: string;
  paths: readonly string[];
}>): Promise<V3GithubReviewImplementationAuthority> {
  const packet = await input.reader.readSealedPacket(input.runId);
  const rows = await input.sql.unsafe<ImplementationAuthorityRow[]>(
    `SELECT story.id AS story_db_id,
            story.status AS story_status,
            attempt.attempt_id,
            attempt.packet_hash,
            attempt.slice_hash,
            attempt.source_after_sha,
            attempt.source_after_tree_hash,
            attempt.disposition,
            claim.outcome AS claim_outcome
       FROM stories story
       JOIN execution_attempts attempt
         ON attempt.run_id = story.run_id
        AND attempt.story_id = story.story_id
       JOIN claim_log claim ON claim.id = attempt.claim_id
      WHERE story.run_id = $1
        AND story.story_id = $2
        AND attempt.step_id = 'implement'
        AND attempt.packet_hash = $3
        AND attempt.attempt_class IN ('product_implementation', 'supervisor_repair')
        AND attempt.disposition IN ('produced_delta', 'already_satisfied', 'verified')
        AND attempt.source_after_sha = $4
        AND attempt.source_after_tree_hash IS NOT NULL
      ORDER BY attempt.generation DESC, attempt.updated_at DESC
      LIMIT 2`,
    [input.runId, input.storyId, packet.packetHash, input.headSha],
  );
  const row = rows[0];
  if (
    rows.length !== 1
    || !row
    || row.story_status !== "done"
    || row.packet_hash !== packet.packetHash
    || !row.slice_hash
    || row.source_after_sha !== input.headSha
    || !row.source_after_tree_hash
    || row.claim_outcome !== "completed"
  ) {
    throw new V3GithubReviewRouterError(
      "V3_GITHUB_REVIEW_IMPLEMENTATION_AUTHORITY_MISSING",
      "Review routing requires one exact done story and terminal implementation attempt at the PR head",
    );
  }
  const [indexed, stored] = await Promise.all([
    input.reader.index.getArtifact(row.slice_hash),
    input.reader.store.get(row.slice_hash),
  ]);
  if (
    !indexed
    || indexed.artifactType !== "setfarm.implementation-slice.v1"
    || stored.envelope.artifactType !== indexed.artifactType
    || indexed.byteLength !== stored.bytes.byteLength
    || canonicalJsonStringify(indexed.producer) !== canonicalJsonStringify(packet.producer)
    || canonicalJsonStringify(stored.envelope.producer) !== canonicalJsonStringify(packet.producer)
  ) {
    throw new V3GithubReviewRouterError(
      "V3_GITHUB_REVIEW_SLICE_ARTIFACT_MISMATCH",
      "Terminal implementation slice differs between packet authority, index, and CAS",
    );
  }
  const slice = ImplementationSliceV1Schema.parse(stored.envelope.payload);
  if (slice.packetHash !== packet.packetHash || slice.storyId !== input.storyId) {
    throw new V3GithubReviewRouterError(
      "V3_GITHUB_REVIEW_SLICE_IDENTITY_MISMATCH",
      "Terminal implementation slice does not own the exact packet and story",
    );
  }
  const writablePaths = new Set(slice.files
    .filter((file) => file.role === "owned" || file.role === "shared_writable")
    .map((file) => file.path));
  const outside = input.paths.filter((reviewPath) => !writablePaths.has(reviewPath));
  if (outside.length > 0) {
    throw new V3GithubReviewRouterError(
      "V3_GITHUB_REVIEW_PATH_OUTSIDE_OWNERSHIP",
      `Review paths are outside the sealed story ownership: ${outside.join(", ")}`,
    );
  }
  return {
    packetHash: packet.packetHash,
    producer: packet.producer,
    storyDbId: row.story_db_id,
    attemptId: row.attempt_id,
    contractSliceHash: row.slice_hash,
    sourceRevision: {
      sha: row.source_after_sha,
      treeHash: row.source_after_tree_hash,
    },
    evidencePlan: slice.requiredEvidence.map((evidence) => evidence.id).sort(),
  };
}

let defaultRouter: ReturnType<typeof createV3GithubReviewRouter> | undefined;

export function createDefaultV3GithubReviewRouter() {
  const sql = getSql();
  const artifactRoot = resolveProductArtifactDir();
  const artifactLimits = resolveProductArtifactCapacity();
  const publicationAuthority = resolveArtifactStorePublicationAuthorityMode();
  const capacityLeaseProvider = publicationAuthority === "hybrid-required"
    ? createHybridArtifactStoreCapacityLeaseProviderV1({
        sql,
        artifactRoot,
        purpose: "writer",
      })
    : undefined;
  const reader = createRuntimeArtifactReader({
    sql,
    artifactRoot,
    artifactLimits,
    publicationAuthorityMode: publicationAuthority,
    ...(capacityLeaseProvider ? { capacityLeaseProvider } : {}),
  });
  const publisher = new IndexedArtifactPublisher({
    index: reader.index,
    store: reader.store,
    ownerInstanceId: `github-review-router:${process.pid}`,
    publicationAuthority,
  });
  const findings = createFindingRecoveryRepository(sql);
  const deliveries = createRecoveryDeliveryRepository(sql);
  const source = createGithubReviewSource(createDefaultGithubReviewSourcePort());
  return createV3GithubReviewRouter({
    readReview: (input) => source.read(input),
    loadImplementationAuthority: (input) => loadDefaultImplementationAuthority({
      sql,
      reader,
      ...input,
    }),
    publishEvidence: (envelope) => publisher.put(envelope),
    addRunRef: (input) => reader.index.addRunArtifactRef(input),
    putFindingSet: (findingSet) => findings.putFindingSet(findingSet),
    openRecoveryCase: (input) => findings.openRecoveryCase(input),
    findRecoveryCase: (recoveryCaseId) => findings.findRecoveryCase(recoveryCaseId),
    findCurrentRevision: (recoveryCaseId) => deliveries.findCurrentRevision(recoveryCaseId),
    authorizeCurrentRevision: (input) => deliveries.authorizeCurrentRevision(input),
  });
}

export function routeV3GithubReview(input: Readonly<{
  runId: string;
  verifyStepDbId: string;
  verifyClaimId: number;
  storyId: string;
  prUrl: string;
  repositoryPath: string;
}>): Promise<V3GithubReviewRouteResult> {
  defaultRouter ??= createDefaultV3GithubReviewRouter();
  return defaultRouter.route(input);
}
