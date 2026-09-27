import { createHash } from "node:crypto";
import { types } from "node:util";
import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { FindingSetV1Schema } from "../findings/finding-set.js";
import { SemanticArtifactEnvelopeV1Schema } from "../product-compiler/artifact-envelope.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { ImplementationSliceV1Schema } from "../product-compiler/schemas/implementation-slice-v1.js";
import { V3RecoveryClaimHandoffV1Schema } from "../recovery/v3-recovery-claim-authority.js";
import { lockV3RecoveryRunMutationAuthorityInTransaction } from
  "../recovery/v3-recovery-run-mutation-authority.js";

// Private post-33 fixture only. This links committed DB rows but does not
// authenticate physical creation, settle either reservation, fence writers,
// register a migration, or grant ownership/admission. Direct SQL inserts are
// not producer-authenticated evidence. No raw lease or fence token is returned.
const RESERVATIONS = "public.internal_production_positive_worktree_recovery_precreate_reservations_v1";
const RECEIPTS = "public.internal_production_positive_worktree_receipt_journal_v1";
const LINKS = "public.internal_production_positive_worktree_recovery_reservation_receipt_links_v1";
const PUBLICATIONS = "public.internal_production_v3_recovery_claim_publications_v1";
const SCHEMA = "setfarm.internal-production-positive-worktree-private-recovery-reservation-receipt-link.v1";
const RESERVATION_SCHEMA = "setfarm.internal-production-positive-worktree-private-recovery-precreate-reservation.v1";
const RECEIPT_SCHEMA = "setfarm.internal-production-positive-worktree-binding-receipt.v1";
const TOKEN_SCHEMA = "setfarm.internal-production-positive-worktree-recovery-lease-token-commitment.v1";
const FENCE_SCHEMA = "setfarm.internal-production-positive-worktree-fence-commitment.v1";
const REFUSED = "TASK6A_PRIVATE_RECOVERY_RESERVATION_RECEIPT_LINK_REFUSED";
const fail = (): never => { throw new Error(REFUSED); };

export const PRIVATE_POSITIVE_WORKTREE_RECOVERY_RESERVATION_RECEIPT_LINK_V1_STATEMENTS = Object.freeze([
  `CREATE TABLE ${LINKS} (
    link_hash text PRIMARY KEY CHECK (link_hash ~ '^[a-f0-9]{64}$'),
    reservation_hash text NOT NULL UNIQUE REFERENCES ${RESERVATIONS}(reservation_hash) ON DELETE RESTRICT,
    receipt_hash text NOT NULL UNIQUE REFERENCES ${RECEIPTS}(receipt_hash) ON DELETE RESTRICT,
    dispatch_id text NOT NULL UNIQUE REFERENCES ${PUBLICATIONS}(dispatch_id) ON DELETE RESTRICT,
    run_id text NOT NULL,
    story_db_id text NOT NULL,
    story_id text NOT NULL,
    claim_id bigint NOT NULL,
    attempt_id text NOT NULL,
    session_id text NOT NULL,
    generation integer NOT NULL CHECK (generation > 0),
    owner_instance_id text NOT NULL,
    root text NOT NULL,
    source_sha text NOT NULL,
    source_tree_hash text NOT NULL,
    execution_slice_hash text NOT NULL CHECK (execution_slice_hash ~ '^[a-f0-9]{64}$'),
    lease_token_hash text NOT NULL CHECK (lease_token_hash ~ '^[a-f0-9]{64}$'),
    publication_hash text NOT NULL CHECK (publication_hash ~ '^[a-f0-9]{64}$'),
    physical_identity_hash text NOT NULL CHECK (physical_identity_hash ~ '^[a-f0-9]{64}$'),
    fence_token_hash text NOT NULL CHECK (fence_token_hash ~ '^[a-f0-9]{64}$'),
    canonical_body text NOT NULL CHECK (octet_length(canonical_body) BETWEEN 1 AND 4096),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT task6a_private_recovery_link_body_hash_v1 CHECK
      (link_hash = encode(pg_catalog.sha256(pg_catalog.convert_to(canonical_body, 'UTF8')), 'hex'))
  )`,
  `CREATE FUNCTION public.task6a_private_recovery_link_immutable_v1() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'TASK6A_PRIVATE_RECOVERY_RESERVATION_RECEIPT_LINK_IMMUTABLE' USING ERRCODE = '42501';
    END $$`,
  `CREATE TRIGGER task6a_private_recovery_link_no_replace_v1 BEFORE UPDATE OR DELETE ON ${LINKS}
    FOR EACH ROW EXECUTE FUNCTION public.task6a_private_recovery_link_immutable_v1()`,
  `CREATE TRIGGER task6a_private_recovery_link_no_truncate_v1 BEFORE TRUNCATE ON ${LINKS}
    FOR EACH STATEMENT EXECUTE FUNCTION public.task6a_private_recovery_link_immutable_v1()`,
] as const);

type Reservation = Readonly<{ reservationHash: string; runId: string;
  storyDbId: string; storyId: string; dispatchId: string; recoveryCaseId: string;
  revisionId: string; ownerInstanceId: string; root: string; sourceSha: string;
  sourceTreeHash: string; leaseTokenHash: string; canonicalBody: string }>;
type Receipt = Readonly<{ receiptHash: string; runId: string; claimId: string;
  attemptId: string; sessionId: string; generation: number; ownerInstanceId: string;
  root: string; sourceSha: string; sourceTreeHash: string;
  physicalIdentityHash: string; fenceTokenHash: string; canonicalBody: string }>;
type LinkRow = Readonly<{ linkHash: string; reservationHash: string;
  receiptHash: string; dispatchId: string; runId: string; storyDbId: string;
  storyId: string; claimId: string; attemptId: string; sessionId: string;
  generation: number; ownerInstanceId: string; root: string; sourceSha: string;
  sourceTreeHash: string; executionSliceHash: string; leaseTokenHash: string; publicationHash: string;
  physicalIdentityHash: string; fenceTokenHash: string; canonicalBody: string }>;

function project(input: unknown): Readonly<{ reservationHash: string; receiptHash: string }> {
  if (input === null || typeof input !== "object" || types.isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype) return fail();
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== 2 || keys.some((key) => typeof key !== "string"
    || !["reservationHash", "receiptHash"].includes(key))) fail();
  const field = (key: "reservationHash" | "receiptHash"): string => {
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)
      || typeof descriptor.value !== "string" || !/^[a-f0-9]{64}$/.test(descriptor.value)) return fail();
    return descriptor.value;
  };
  return Object.freeze({ reservationHash: field("reservationHash"), receiptHash: field("receiptHash") });
}

export async function appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(
  sql: postgres.Sql, input: unknown, executionSliceEnvelope?: unknown,
): Promise<Readonly<{ schema: typeof SCHEMA; authority: "diagnostic-only";
  disposition: "inserted" | "identical-retry"; linkHash: string }>> {
  try {
    const { reservationHash, receiptHash } = project(input);
    return await sql.begin("isolation level serializable", async (tx) => {
      const mode = await tx.unsafe<Array<{ isolation: string; readOnly: string }>>(`
        SELECT pg_catalog.current_setting('transaction_isolation') AS isolation,
          pg_catalog.current_setting('transaction_read_only') AS "readOnly"`);
      if (mode.length !== 1 || mode[0]?.isolation !== "serializable"
        || mode[0]?.readOnly !== "off") fail();
      // A first read derives the canonical story advisory-lock identity. The
      // immutable parent is re-read after the advisory/run fence; delivery is
      // the first row lock in the recovery chain.
      const heads = await tx.unsafe<Array<{ runId: string; storyId: string }>>(`SELECT
        run_id AS "runId", story_id AS "storyId" FROM ${RESERVATIONS}
        WHERE reservation_hash = $1`, [reservationHash]);
      if (heads.length !== 1) fail();
      const authority = await lockV3RecoveryRunMutationAuthorityInTransaction(tx,
        { runId: heads[0]!.runId, storyId: heads[0]!.storyId });
      if (authority.protocol !== "v3") fail();
      const runs = await tx.unsafe<Array<{ packetHash: string | null }>>(`SELECT
        packet_hash AS "packetHash" FROM public.runs WHERE id = $1`,
      [heads[0]!.runId]);
      if (runs.length !== 1 || !runs[0]?.packetHash) fail();
      const reservations = await tx.unsafe<Array<Reservation>>(`SELECT
        reservation_hash AS "reservationHash", run_id AS "runId",
        story_db_id AS "storyDbId", story_id AS "storyId",
        dispatch_id AS "dispatchId", recovery_case_id AS "recoveryCaseId",
        revision_id AS "revisionId", owner_instance_id AS "ownerInstanceId",
        root, source_sha AS "sourceSha", source_tree_hash AS "sourceTreeHash",
        lease_token_hash AS "leaseTokenHash", canonical_body AS "canonicalBody"
        FROM ${RESERVATIONS} WHERE reservation_hash = $1`, [reservationHash]);
      if (reservations.length !== 1) fail();
      const reservation = reservations[0]!;
      if (reservation.runId !== heads[0]!.runId || reservation.storyId !== heads[0]!.storyId) fail();
      const reservationBody = { schema: RESERVATION_SCHEMA, runId: reservation.runId,
        storyDbId: reservation.storyDbId, storyId: reservation.storyId,
        dispatchId: reservation.dispatchId, recoveryCaseId: reservation.recoveryCaseId,
        revisionId: reservation.revisionId, ownerInstanceId: reservation.ownerInstanceId,
        root: reservation.root, sourceSha: reservation.sourceSha,
        sourceTreeHash: reservation.sourceTreeHash,
        leaseTokenHash: reservation.leaseTokenHash };
      if (canonicalJsonStringify(reservationBody) !== reservation.canonicalBody
        || hashCanonicalJson(reservationBody) !== reservation.reservationHash) fail();
      const deliveries = await tx.unsafe<Array<{ recoveryCaseId: string;
        revisionId: string; runId: string; storyId: string; state: string;
        ownerInstanceId: string | null; leaseToken: string | null;
        leaseExpiresAt: Date | null; attemptId: string | null;
        claimId: string | null; attemptCount: number; executionSliceHash: string | null }>>(`SELECT
        recovery_case_id AS "recoveryCaseId", revision_id AS "revisionId",
        run_id AS "runId", story_id AS "storyId", state,
        owner_instance_id AS "ownerInstanceId", lease_token AS "leaseToken",
        lease_expires_at AS "leaseExpiresAt", attempt_id AS "attemptId",
        claim_id::text AS "claimId", attempt_count AS "attemptCount",
        execution_slice_hash AS "executionSliceHash"
        FROM public.recovery_dispatch_deliveries WHERE dispatch_id = $1 FOR UPDATE`,
      [reservation.dispatchId]);
      if (deliveries.length !== 1) fail();
      const delivery = deliveries[0]!;
      // Match the V3 mutation lock order: advisory/run, delivery, then case,
      // revision, dispatch and publication. The private parent is immutable.
      if (delivery.runId !== reservation.runId || delivery.storyId !== reservation.storyId
        || delivery.recoveryCaseId !== reservation.recoveryCaseId
        || delivery.revisionId !== reservation.revisionId
        || delivery.ownerInstanceId !== reservation.ownerInstanceId
        || !["attempt_reserved", "running"].includes(delivery.state)
        || delivery.attemptCount !== 1 || delivery.claimId === null
        || delivery.attemptId === null || delivery.leaseToken === null
        || delivery.executionSliceHash === null) fail();
      const executionSliceHash: string = delivery.executionSliceHash ?? fail();
      const cases = await tx.unsafe<Array<{ currentRevisionId: string; status: string;
        owner: string; packetHash: string; expectedDelta: unknown;
        allowedPaths: unknown; evidencePlan: unknown }>>(`SELECT
        current_revision_id AS "currentRevisionId", status, owner,
        packet_hash AS "packetHash", expected_delta AS "expectedDelta",
        allowed_paths AS "allowedPaths", evidence_plan AS "evidencePlan"
        FROM public.recovery_cases
        WHERE recovery_case_id = $1 AND run_id = $2 AND story_id = $3
          AND EXISTS (
            SELECT 1 FROM public.recovery_case_revisions opening_revision
            WHERE opening_revision.recovery_case_id = recovery_cases.recovery_case_id
              AND opening_revision.revision_number = 1
              AND opening_revision.parent_revision_id IS NULL
              AND opening_revision.run_id = recovery_cases.run_id
              AND opening_revision.story_id = recovery_cases.story_id
              AND opening_revision.packet_hash = recovery_cases.packet_hash
              AND opening_revision.finding_set_hash = recovery_cases.finding_set_hash
              AND opening_revision.finding_ids = recovery_cases.finding_ids
              AND opening_revision.contract_slice_hash = recovery_cases.slice_hash
              AND opening_revision.source_sha = recovery_cases.source_sha
              AND opening_revision.source_tree_hash = recovery_cases.source_tree_hash
          ) FOR UPDATE`,
      [reservation.recoveryCaseId, reservation.runId, reservation.storyId]);
      if (cases.length !== 1 || cases[0]?.currentRevisionId !== reservation.revisionId
        || cases[0]?.status !== "repairing") fail();
      const revisions = await tx.unsafe<Array<{ sourceSha: string; sourceTreeHash: string;
        dispatchClassOwner: string; packetHash: string; contractSliceHash: string;
        findingSetHash: string; findingIds: unknown; expectedDelta: unknown;
        allowedPaths: unknown; evidencePlan: unknown;
        evidencePlanArtifactHash: string | null }>>(`SELECT source_sha AS "sourceSha",
        source_tree_hash AS "sourceTreeHash", owner AS "dispatchClassOwner",
        packet_hash AS "packetHash", contract_slice_hash AS "contractSliceHash",
        finding_set_hash AS "findingSetHash", finding_ids AS "findingIds",
        expected_delta AS "expectedDelta", allowed_paths AS "allowedPaths",
        evidence_plan AS "evidencePlan",
        evidence_plan_artifact_hash AS "evidencePlanArtifactHash"
        FROM public.recovery_case_revisions WHERE revision_id = $1
          AND recovery_case_id = $2 AND run_id = $3 AND story_id = $4 FOR KEY SHARE`,
      [reservation.revisionId, reservation.recoveryCaseId,
        reservation.runId, reservation.storyId]);
      if (revisions.length !== 1 || revisions[0]?.sourceSha !== reservation.sourceSha
        || revisions[0]?.sourceTreeHash !== reservation.sourceTreeHash) fail();
      const dispatches = await tx.unsafe<Array<{ dispatchClass: string;
        sourceSha: string; sourceTreeHash: string; packetHash: string;
        contractSliceHash: string; findingSetHash: string; findingIds: unknown;
        evidencePlan: unknown; evidencePlanArtifactHash: string | null }>>(`SELECT
        dispatch_class AS "dispatchClass", source_sha AS "sourceSha",
        source_tree_hash AS "sourceTreeHash", packet_hash AS "packetHash",
        contract_slice_hash AS "contractSliceHash", finding_set_hash AS "findingSetHash",
        finding_ids AS "findingIds", evidence_plan AS "evidencePlan",
        evidence_plan_artifact_hash AS "evidencePlanArtifactHash"
        FROM public.recovery_revision_dispatches WHERE dispatch_id = $1
          AND recovery_case_id = $2 AND revision_id = $3 FOR KEY SHARE`,
      [reservation.dispatchId, reservation.recoveryCaseId, reservation.revisionId]);
      if (dispatches.length !== 1 || dispatches[0]?.sourceSha !== reservation.sourceSha
        || dispatches[0]?.sourceTreeHash !== reservation.sourceTreeHash
        || !["product_implementation", "supervisor_repair"].includes(dispatches[0].dispatchClass)
        || (dispatches[0].dispatchClass === "product_implementation"
          ? revisions[0]?.dispatchClassOwner !== "implement"
          : revisions[0]?.dispatchClassOwner !== "supervisor")) fail();
      const dispatch = dispatches[0]!;
      const revision = revisions[0]!;
      const canonicalDirective = { packetHash: revision.packetHash,
        contractSliceHash: revision.contractSliceHash,
        sourceRevision: { sha: revision.sourceSha, treeHash: revision.sourceTreeHash },
        findingSetHash: revision.findingSetHash, findingIds: revision.findingIds,
        expectedDelta: revision.expectedDelta, allowedPaths: revision.allowedPaths,
        evidencePlan: revision.evidencePlan,
        ...(revision.evidencePlanArtifactHash
          ? { evidencePlanArtifactHash: revision.evidencePlanArtifactHash } : {}) };
      if (dispatch.packetHash !== revision.packetHash
        || dispatch.packetHash !== runs[0]!.packetHash
        || dispatch.contractSliceHash !== revision.contractSliceHash
        || dispatch.findingSetHash !== revision.findingSetHash
        || cases[0]?.owner !== revision.dispatchClassOwner
        || cases[0]?.packetHash !== revision.packetHash
        || canonicalJsonStringify(cases[0]?.expectedDelta)
          !== canonicalJsonStringify(revision.expectedDelta)
        || canonicalJsonStringify(cases[0]?.allowedPaths)
          !== canonicalJsonStringify(revision.allowedPaths)
        || canonicalJsonStringify(cases[0]?.evidencePlan)
          !== canonicalJsonStringify(revision.evidencePlan)
        || canonicalJsonStringify(dispatch.findingIds) !== canonicalJsonStringify(revision.findingIds)
        || canonicalJsonStringify(dispatch.evidencePlan) !== canonicalJsonStringify(revision.evidencePlan)
        || dispatch.evidencePlanArtifactHash !== revision.evidencePlanArtifactHash) fail();
      const findings = await tx.unsafe<Array<{ runId: string; storyId: string;
        packetHash: string; sliceHash: string; sourceSha: string;
        sourceTreeHash: string; findingIds: unknown; payload: unknown }>>(`SELECT
        run_id AS "runId", story_id AS "storyId", packet_hash AS "packetHash",
        slice_hash AS "sliceHash", source_sha AS "sourceSha",
        source_tree_hash AS "sourceTreeHash", finding_ids AS "findingIds", payload
        FROM public.finding_sets WHERE finding_set_hash = $1 FOR KEY SHARE`,
      [revision.findingSetHash]);
      if (findings.length !== 1) fail();
      const finding = findings[0]!;
      const findingPayload = FindingSetV1Schema.parse(finding.payload);
      if (finding.runId !== reservation.runId || finding.storyId !== reservation.storyId
        || finding.packetHash !== revision.packetHash
        || finding.sliceHash !== revision.contractSliceHash
        || finding.sourceSha !== revision.sourceSha
        || finding.sourceTreeHash !== revision.sourceTreeHash
        || canonicalJsonStringify(finding.findingIds) !== canonicalJsonStringify(revision.findingIds)
        || findingPayload.findingSetHash !== revision.findingSetHash
        || findingPayload.runId !== reservation.runId
        || findingPayload.storyId !== reservation.storyId
        || findingPayload.packetHash !== revision.packetHash
        || findingPayload.sliceHash !== revision.contractSliceHash
        || findingPayload.sourceRevision.sha !== revision.sourceSha
        || findingPayload.sourceRevision.treeHash !== revision.sourceTreeHash
        || canonicalJsonStringify(findingPayload.findings.map((item) => item.findingId))
          !== canonicalJsonStringify(revision.findingIds)) fail();
      const publications = await tx.unsafe<Array<{ claimId: string;
        runtimeSessionId: string; runId: string; stepDbId: string;
        workflowStepId: string; storyDbId: string; storyId: string;
        storyIndex: number;
        recoveryCaseId: string; revisionId: string; status: string;
        handoffCanonicalJson: string; handoffHash: string; boundAt: Date }>>(`SELECT
        claim_id::text AS "claimId", runtime_session_id AS "runtimeSessionId",
        run_id AS "runId", step_db_id AS "stepDbId",
        workflow_step_id AS "workflowStepId", story_db_id AS "storyDbId",
        story_id AS "storyId", story_index AS "storyIndex",
        recovery_case_id AS "recoveryCaseId",
        revision_id AS "revisionId", status,
        handoff_canonical_json AS "handoffCanonicalJson",
        handoff_hash AS "handoffHash", bound_at AS "boundAt"
        FROM ${PUBLICATIONS} WHERE dispatch_id = $1 FOR UPDATE`, [reservation.dispatchId]);
      if (publications.length !== 1) fail();
      const publication = publications[0]!;
      if (publication.runId !== reservation.runId
        || publication.storyDbId !== reservation.storyDbId
        || publication.storyId !== reservation.storyId
        || publication.recoveryCaseId !== reservation.recoveryCaseId
        || publication.revisionId !== reservation.revisionId
        || publication.workflowStepId !== "implement"
        || publication.claimId !== delivery.claimId
        || !["lease_acquired", "lease_reissued"].includes(publication.status)
        || Buffer.byteLength(publication.handoffCanonicalJson, "utf8") > 32_000_000) fail();
      const handoff = V3RecoveryClaimHandoffV1Schema.parse(JSON.parse(publication.handoffCanonicalJson));
      if (canonicalJsonStringify(handoff) !== publication.handoffCanonicalJson
        || hashCanonicalJson(handoff) !== publication.handoffHash
        || handoff.runId !== reservation.runId || handoff.storyId !== reservation.storyId
        || handoff.recoveryCaseId !== reservation.recoveryCaseId
        || handoff.revisionId !== reservation.revisionId
        || handoff.dispatchId !== reservation.dispatchId
        || handoff.dispatchClass !== dispatch.dispatchClass
        || handoff.recoveryOwner !== revisions[0]?.dispatchClassOwner
        || handoff.lease.ownerInstanceId !== reservation.ownerInstanceId
        || handoff.lease.leaseToken !== delivery.leaseToken
        || handoff.directive.packetHash !== dispatch.packetHash
        || handoff.directive.contractSliceHash !== dispatch.contractSliceHash
        || handoff.directive.findingSetHash !== dispatch.findingSetHash
        || canonicalJsonStringify(handoff.directive)
          !== canonicalJsonStringify(canonicalDirective)
        || handoff.directive.sourceRevision.sha !== reservation.sourceSha
        || handoff.directive.sourceRevision.treeHash !== reservation.sourceTreeHash
        || handoff.status !== publication.status
        || handoff.attemptBinding !== undefined
        || hashCanonicalJson({ schema: TOKEN_SCHEMA, dispatchId: reservation.dispatchId,
          leaseToken: handoff.lease.leaseToken }) !== reservation.leaseTokenHash
        || !Number.isFinite(publication.boundAt.getTime())
        || Date.parse(handoff.lease.expiresAt) <= publication.boundAt.getTime()) fail();
      if (delivery.executionSliceHash !== dispatch.contractSliceHash
        || executionSliceEnvelope !== undefined) {
        const envelope = SemanticArtifactEnvelopeV1Schema.parse(executionSliceEnvelope);
        const slice = ImplementationSliceV1Schema.parse(envelope.payload);
        const expectedRecovery = { schema: "setfarm.implementation-recovery-directive.v1",
          recoveryCaseRevisionId: handoff.revisionId,
          recoveryDispatchId: handoff.dispatchId,
          dispatchClass: handoff.dispatchClass,
          findingSetHash: handoff.directive.findingSetHash,
          findingIds: handoff.directive.findingIds,
          contractSliceHash: handoff.directive.contractSliceHash,
          sourceRevision: { baseSha: reservation.sourceSha,
            treeHash: reservation.sourceTreeHash },
          expectedDelta: handoff.directive.expectedDelta,
          allowedPaths: handoff.directive.allowedPaths,
          ...(handoff.directive.evidencePlanArtifactHash
            ? { evidencePlanArtifactHash: handoff.directive.evidencePlanArtifactHash } : {}) };
        const envelopeBytes = canonicalJsonStringify(envelope);
        if (envelope.artifactType !== "setfarm.implementation-slice.v1"
          || Buffer.byteLength(envelopeBytes, "utf8") > 32_000_000
          || hashCanonicalJson(envelope) !== delivery.executionSliceHash
          || canonicalJsonStringify(envelope.payload) !== canonicalJsonStringify(slice)
          || slice.packetHash !== dispatch.packetHash
          || slice.storyId !== reservation.storyId
          || slice.sourceRevision.baseSha !== reservation.sourceSha
          || slice.sourceRevision.treeHash !== reservation.sourceTreeHash
          || !slice.recovery
          || canonicalJsonStringify(slice.recovery)
            !== canonicalJsonStringify(expectedRecovery)) fail();
        const artifacts = await tx.unsafe<Array<{ artifactType: string;
          byteLength: string; producerMetadata: unknown }>>(`SELECT
          artifact_type AS "artifactType", byte_length::text AS "byteLength",
          producer_metadata AS "producerMetadata"
          FROM public.semantic_artifacts WHERE artifact_hash = $1 FOR KEY SHARE`,
        [delivery.executionSliceHash]);
        if (artifacts.length !== 1
          || artifacts[0]?.artifactType !== envelope.artifactType
          || artifacts[0]?.byteLength !== String(Buffer.byteLength(envelopeBytes, "utf8"))
          || canonicalJsonStringify(artifacts[0]?.producerMetadata)
            !== canonicalJsonStringify(envelope.producer)) fail();
      }
      const now = await readDatabaseWallClock(tx,
        "TASK6A_PRIVATE_RECOVERY_LINK_DATABASE_TIME_UNAVAILABLE");
      if (publication.boundAt.getTime() > now.getTime()) fail();
      if (!(delivery.leaseExpiresAt instanceof Date)
        || delivery.leaseExpiresAt.getTime() <= now.getTime()) fail();
      const receipts = await tx.unsafe<Array<Receipt>>(`SELECT
        receipt_hash AS "receiptHash", run_id AS "runId",
        claim_id::text AS "claimId", attempt_id AS "attemptId",
        session_id AS "sessionId", generation,
        owner_instance_id AS "ownerInstanceId", root,
        source_sha AS "sourceSha", source_tree_hash AS "sourceTreeHash",
        physical_identity_hash AS "physicalIdentityHash",
        fence_token_hash AS "fenceTokenHash", canonical_body AS "canonicalBody"
        FROM ${RECEIPTS} WHERE receipt_hash = $1 FOR UPDATE`, [receiptHash]);
      if (receipts.length !== 1) fail();
      const receipt = receipts[0]!;
      const receiptBody = { schema: RECEIPT_SCHEMA, runId: receipt.runId,
        claimId: receipt.claimId, attemptId: receipt.attemptId,
        sessionId: receipt.sessionId, ownerInstanceId: receipt.ownerInstanceId,
        generation: receipt.generation, fenceTokenHash: receipt.fenceTokenHash,
        root: receipt.root, physicalIdentityHash: receipt.physicalIdentityHash,
        sourceSha: receipt.sourceSha, sourceTreeHash: receipt.sourceTreeHash };
      if (canonicalJsonStringify(receiptBody) !== receipt.canonicalBody
        || hashCanonicalJson(receiptBody) !== receipt.receiptHash) fail();
      if (receipt.runId !== reservation.runId
        || receipt.claimId !== publication.claimId
        || receipt.attemptId !== delivery.attemptId
        || receipt.sessionId !== publication.runtimeSessionId
        || receipt.ownerInstanceId !== reservation.ownerInstanceId
        || receipt.root !== reservation.root
        || receipt.sourceSha !== reservation.sourceSha
        || receipt.sourceTreeHash !== reservation.sourceTreeHash) fail();
      const active = await tx.unsafe<Array<{ fenceToken: string }>>(`SELECT
        a.fence_token AS "fenceToken" FROM public.stories st
        JOIN public.claim_log c ON c.run_id = st.run_id AND c.story_id = st.story_id
        JOIN public.steps step ON step.id = $18 AND step.run_id = st.run_id
          AND step.step_id = c.step_id
        JOIN public.execution_attempts a ON a.claim_id = c.id
          AND a.run_id = st.run_id AND a.step_id = c.step_id AND a.story_id = st.story_id
        JOIN public.runtime_sessions s ON s.claim_id = c.id
          AND s.run_id = st.run_id AND s.attempt_id = a.attempt_id
        JOIN ${PUBLICATIONS} pub ON pub.dispatch_id = $7
          AND pub.claim_id = c.id AND pub.runtime_session_id = s.session_id
        JOIN public.recovery_dispatch_deliveries live_delivery
          ON live_delivery.dispatch_id = pub.dispatch_id
        JOIN public.recovery_revision_dispatches live_dispatch
          ON live_dispatch.dispatch_id = live_delivery.dispatch_id
        JOIN public.v3_story_claim_runtime_bindings_v1 b
          ON b.claim_id = c.id AND b.runtime_session_id = s.session_id
          AND b.run_id = st.run_id AND b.step_db_id = s.step_db_id
          AND b.workflow_step_id = c.step_id AND b.subject_kind = 'story_member'
          AND b.story_db_id = st.id AND b.story_id = st.story_id
          AND b.story_index = st.story_index
          AND b.story_claim_generation = st.claim_generation
          AND b.bound_at = c.claimed_at
        WHERE st.id = $1 AND st.run_id = $2 AND st.story_id = $3
          AND st.status = 'running' AND c.id = $4::bigint
          AND st.claimed_by = c.agent_id
          AND st.claimed_at = pub.bound_at
          AND c.claimed_at = pub.bound_at
          AND step.type = 'loop' AND step.status = 'running'
          AND step.current_story_id = st.id
          AND c.step_id = 'implement' AND c.outcome IS NULL
          AND c.abandoned_at IS NULL
          AND a.agent_id = c.agent_id
          AND a.role = CASE WHEN $9 = 'product_implementation'
            THEN 'developer' ELSE 'supervisor' END
          AND a.attempt_id = $5 AND a.generation = $6
          AND a.recovery_dispatch_id = $7
          AND a.recovery_case_revision_id = $8
          AND a.attempt_class = $9 AND a.packet_hash = $10
          AND a.slice_hash = $11 AND a.finding_set_hash = $12
          AND a.disposition IN ('claimed', 'running')
          AND a.lease_expires_at > $20::timestamptz
          AND a.worktree = $13 AND a.source_before_sha = $14
          AND a.source_before_tree_hash = $15
          AND s.session_id = $16 AND s.owner_instance_id = $17
          AND s.created_at >= pub.bound_at
          AND s.heartbeat_at >= s.created_at
          AND live_delivery.authorized_at = live_dispatch.authorized_at
          AND live_delivery.started_at IS NOT NULL
          AND live_delivery.started_at = a.lease_acquired_at
          AND live_delivery.started_at >= s.created_at
          AND live_delivery.started_at <= live_delivery.lease_expires_at
          AND live_delivery.lease_expires_at > clock_timestamp()
          AND s.step_db_id = step.id AND st.story_index = $19
          AND s.claim_agent_id = c.agent_id AND s.workflow_step_id = c.step_id
          AND s.story_db_id = st.id AND s.story_id = st.story_id
          AND s.worktree = $13
          AND (
            (live_delivery.state = 'attempt_reserved'
              AND s.state IN ('reserved', 'starting', 'running'))
            OR (live_delivery.state = 'running' AND s.state = 'running')
          )
        FOR UPDATE OF st, step, c, a, s, b`, [reservation.storyDbId,
      reservation.runId, reservation.storyId, receipt.claimId,
      receipt.attemptId, receipt.generation, reservation.dispatchId,
      reservation.revisionId, dispatch.dispatchClass, dispatch.packetHash,
      delivery.executionSliceHash, dispatch.findingSetHash, reservation.root,
      reservation.sourceSha, reservation.sourceTreeHash, receipt.sessionId,
      reservation.ownerInstanceId, publication.stepDbId,
      publication.storyIndex, now]);
      if (active.length !== 1 || typeof active[0]?.fenceToken !== "string") fail();
      // The prior wall-clock read may predate a receipt/owner lock wait. Both
      // leases are held now; sample PostgreSQL time again after acquiring
      // those locks and after any later unique-index/insert wait.
      const assertFreshLeases = async (): Promise<void> => {
        const leases = await tx.unsafe<Array<{ attemptLive: boolean;
          deliveryLive: boolean }>>(`WITH observed AS MATERIALIZED (
            SELECT clock_timestamp() AS observed_at
          ) SELECT a.lease_expires_at > observed.observed_at AS "attemptLive",
              d.lease_expires_at > observed.observed_at AS "deliveryLive"
            FROM public.execution_attempts a
            JOIN public.recovery_dispatch_deliveries d
              ON d.attempt_id = a.attempt_id
            CROSS JOIN observed
            WHERE a.attempt_id = $1 AND d.dispatch_id = $2`,
        [receipt.attemptId, reservation.dispatchId]);
        if (leases.length !== 1 || leases[0]?.attemptLive !== true
          || leases[0]?.deliveryLive !== true) fail();
      };
      await assertFreshLeases();
      if (hashCanonicalJson({ schema: FENCE_SCHEMA, attemptId: receipt.attemptId,
        generation: receipt.generation, fenceToken: active[0].fenceToken })
        !== receipt.fenceTokenHash) fail();
      const body = Object.freeze({ schema: SCHEMA, reservationHash, receiptHash,
        dispatchId: reservation.dispatchId, runId: reservation.runId,
        storyDbId: reservation.storyDbId, storyId: reservation.storyId,
        claimId: receipt.claimId, attemptId: receipt.attemptId,
        sessionId: receipt.sessionId, generation: receipt.generation,
        ownerInstanceId: reservation.ownerInstanceId, root: reservation.root,
        sourceSha: reservation.sourceSha, sourceTreeHash: reservation.sourceTreeHash,
        executionSliceHash,
        leaseTokenHash: reservation.leaseTokenHash,
        publicationHash: publication.handoffHash,
        physicalIdentityHash: receipt.physicalIdentityHash,
        fenceTokenHash: receipt.fenceTokenHash });
      const canonicalBody = canonicalJsonStringify(body);
      if (Buffer.byteLength(canonicalBody, "utf8") > 4096) fail();
      const linkHash = createHash("sha256").update(canonicalBody, "utf8").digest("hex");
      const { schema: bodySchema, ...columns } = body;
      if (bodySchema !== SCHEMA) fail();
      const expected: LinkRow = Object.freeze({ ...columns, linkHash, canonicalBody });
      const inserted = await tx.unsafe(`INSERT INTO ${LINKS} (
        link_hash, reservation_hash, receipt_hash, dispatch_id, run_id,
        story_db_id, story_id, claim_id, attempt_id, session_id, generation,
        owner_instance_id, root, source_sha, source_tree_hash,
        execution_slice_hash, lease_token_hash, publication_hash,
        physical_identity_hash, fence_token_hash, canonical_body
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::bigint,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      ON CONFLICT DO NOTHING RETURNING link_hash`, [linkHash, reservationHash,
      receiptHash, reservation.dispatchId, reservation.runId,
      reservation.storyDbId, reservation.storyId, receipt.claimId,
      receipt.attemptId, receipt.sessionId, receipt.generation,
      reservation.ownerInstanceId, reservation.root, reservation.sourceSha,
      reservation.sourceTreeHash, executionSliceHash, reservation.leaseTokenHash,
      publication.handoffHash, receipt.physicalIdentityHash,
      receipt.fenceTokenHash, canonicalBody]);
      if (inserted.length === 1) {
        await assertFreshLeases();
        return Object.freeze({ schema: SCHEMA,
          authority: "diagnostic-only" as const, disposition: "inserted" as const,
          linkHash });
      }
      const existing = await tx.unsafe<Array<LinkRow>>(`SELECT
        link_hash AS "linkHash", reservation_hash AS "reservationHash",
        receipt_hash AS "receiptHash", dispatch_id AS "dispatchId",
        run_id AS "runId", story_db_id AS "storyDbId", story_id AS "storyId",
        claim_id::text AS "claimId", attempt_id AS "attemptId",
        session_id AS "sessionId", generation,
        owner_instance_id AS "ownerInstanceId", root,
        source_sha AS "sourceSha", source_tree_hash AS "sourceTreeHash",
        execution_slice_hash AS "executionSliceHash",
        lease_token_hash AS "leaseTokenHash", publication_hash AS "publicationHash",
        physical_identity_hash AS "physicalIdentityHash",
        fence_token_hash AS "fenceTokenHash", canonical_body AS "canonicalBody"
        FROM ${LINKS} WHERE link_hash = $1 OR reservation_hash = $2
          OR receipt_hash = $3 OR dispatch_id = $4`,
      [linkHash, reservationHash, receiptHash, reservation.dispatchId]);
      if (existing.length !== 1 || !Object.keys(expected).every((key) =>
        existing[0]![key as keyof LinkRow] === expected[key as keyof LinkRow])) fail();
      await assertFreshLeases();
      return Object.freeze({ schema: SCHEMA, authority: "diagnostic-only" as const,
        disposition: "identical-retry" as const, linkHash });
    });
  } catch { return fail(); }
}
