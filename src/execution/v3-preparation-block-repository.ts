import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  createV3PreparationFingerprint,
  V3PreparationBlockV1Schema,
  V3PreparationDecisionV1Schema,
  V3PreparationDependencyStateV1Schema,
  V3PreparationIdentityV1Schema,
  type V3PreparationBlockV1,
  type V3PreparationDecisionV1,
  type V3PreparationDependencyStateV1,
  type V3PreparationIdentityV1,
} from "./v3-preparation-decision.js";
import {
  createV3PreparationClaimAuthorityV1,
  V3PreparationClaimAuthorityError,
  v3PreparationStoryLockIdentity,
  type V3PreparationClaimAuthorityV1,
  type V3PreparationDependencyAttemptAuthorityV1,
} from "./v3-preparation-claim-authority.js";
import {
  inspectAuthenticatedV3SupervisorRetryPreparationSourceV1,
  type AuthenticatedV3SupervisorRetryPreparationSourceV1,
} from "./claim-runtime-publication.js";

type TransactionSql = postgres.TransactionSql;

type BlockRow = Readonly<{
  block_id: string;
  fingerprint: string;
  occurrence: number;
  run_id: string;
  step_id: string;
  story_id: string;
  packet_hash: string;
  source_sha: string;
  source_tree_hash: string;
  phase: V3PreparationBlockV1["phase"];
  error_code: string;
  action: V3PreparationBlockV1["action"];
  dependency_state: unknown;
  detail: string;
  evidence_refs: unknown;
  opened_at: Date | string;
  resolved_at: Date | string | null;
  resolution_fingerprint: string | null;
}>;

type PreparationStateRow = Readonly<{
  run_id: string;
  step_id: string;
  story_id: string;
  state_version: number;
  state: "blocked" | "ready" | "claimed";
  packet_hash: string;
  base_source_sha: string;
  base_source_tree_hash: string;
  projected_dependency_ids: unknown;
  dependency_attempts: unknown;
  state_fingerprint: string;
  claim_id: string | number | null;
  created_at: Date | string;
  updated_at: Date | string;
  claimed_at: Date | string | null;
}>;

function timestamp(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function parsedJson(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function mapBlock(row: BlockRow): V3PreparationBlockV1 {
  return V3PreparationBlockV1Schema.parse({
    schema: "setfarm.v3-preparation-block.v1",
    blockId: row.block_id,
    fingerprint: row.fingerprint,
    occurrence: row.occurrence,
    runId: row.run_id,
    stepId: row.step_id,
    storyId: row.story_id,
    packetHash: row.packet_hash,
    sourceSha: row.source_sha,
    sourceTreeHash: row.source_tree_hash,
    phase: row.phase,
    errorCode: row.error_code,
    action: row.action,
    dependencyState: parsedJson(row.dependency_state),
    detail: row.detail,
    evidenceRefs: parsedJson(row.evidence_refs),
    openedAt: timestamp(row.opened_at),
    ...(row.resolved_at
      ? {
          resolvedAt: timestamp(row.resolved_at),
          resolutionFingerprint: row.resolution_fingerprint!,
        }
      : {}),
  });
}

function readyFingerprint(input: Readonly<{
  runId: string;
  stepId: string;
  storyId: string;
  packetHash: string;
  sourceSha: string;
  sourceTreeHash: string;
  dependencyState: readonly V3PreparationDependencyStateV1[];
}>): string {
  return hashCanonicalJson({
    schema: "setfarm.v3-preparation-ready.v1",
    runId: input.runId,
    stepId: input.stepId,
    storyId: input.storyId,
    packetHash: input.packetHash,
    sourceSha: input.sourceSha,
    sourceTreeHash: input.sourceTreeHash,
    dependencyState: [...input.dependencyState]
      .sort((left, right) => left.storyId.localeCompare(right.storyId)),
  });
}

function preparationFail(code: string, message: string): never {
  throw new V3PreparationClaimAuthorityError(code, message);
}

function canonicalStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function parseProjectedDependencies(value: string | null): string[] {
  if (value === null || value.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    preparationFail("V3_PREPARATION_STORY_PROJECTION_INVALID", "story dependency projection is not JSON");
  }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string" || item.length === 0)) {
    preparationFail("V3_PREPARATION_STORY_PROJECTION_INVALID", "story dependency projection is not a string array");
  }
  const canonical = canonicalStrings(parsed as string[]);
  if (canonical.length !== parsed.length) {
    preparationFail("V3_PREPARATION_STORY_PROJECTION_INVALID", "story dependency projection contains duplicates");
  }
  return canonical;
}

async function lockPreparationStory(
  transaction: TransactionSql,
  input: Readonly<{ runId: string; stepId: string; storyId: string }>,
): Promise<void> {
  await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    v3PreparationStoryLockIdentity(input),
  ]);
}

async function assertActivePacketOwner(
  transaction: TransactionSql,
  input: Readonly<{ runId: string; packetHash: string }>,
): Promise<void> {
  const runs = await transaction.unsafe<Array<{
    protocol: string;
    status: string;
    packet_hash: string | null;
  }>>(
    "SELECT protocol, status, packet_hash FROM runs WHERE id = $1 FOR UPDATE",
    [input.runId],
  );
  const run = runs[0];
  if (
    !run
    || run.protocol !== "v3"
    || !["running", "resuming"].includes(run.status)
    || run.packet_hash !== input.packetHash
  ) {
    preparationFail("V3_PREPARATION_RUN_AUTHORITY_MISMATCH", "run is not the active owner of the sealed packet");
  }
}

async function loadExactDependencyAuthorities(
  transaction: TransactionSql,
  input: Readonly<{
    runId: string;
    stepId: string;
    packetHash: string;
    dependencyState: readonly V3PreparationDependencyStateV1[];
  }>,
): Promise<readonly V3PreparationDependencyAttemptAuthorityV1[]> {
  const dependencies = input.dependencyState.map((dependency) =>
    V3PreparationDependencyStateV1Schema.parse(dependency));
  if (dependencies.some((dependency) => dependency.state !== "ready")) {
    preparationFail("V3_PREPARATION_DEPENDENCY_NOT_READY", "ready authority cannot bind a non-ready dependency");
  }
  if (dependencies.length === 0) return [];
  const attemptIds = dependencies.map((dependency) => dependency.attemptId!);
  if (new Set(attemptIds).size !== attemptIds.length) {
    preparationFail("V3_PREPARATION_DEPENDENCY_ATTEMPT_DUPLICATE", "dependency attempts must be one-to-one");
  }
  const rows = await transaction.unsafe<Array<{
    attempt_id: string;
    run_id: string;
    step_id: string;
    story_id: string;
    packet_hash: string | null;
    attempt_class: string;
    disposition: string;
    source_after_sha: string | null;
    source_after_tree_hash: string | null;
  }>>(
    `SELECT attempt_id, run_id, step_id, story_id, packet_hash, attempt_class,
            disposition, source_after_sha, source_after_tree_hash
       FROM execution_attempts
      WHERE attempt_id = ANY($1::text[])
      FOR UPDATE`,
    [attemptIds],
  );
  const rowByAttempt = new Map(rows.map((row) => [row.attempt_id, row]));
  const authorities = dependencies.map((dependency) => {
    const row = rowByAttempt.get(dependency.attemptId!);
    if (
      !row
      || row.run_id !== input.runId
      || row.step_id !== input.stepId
      || row.story_id !== dependency.storyId
      || row.packet_hash !== input.packetHash
      || !["product_implementation", "supervisor_repair"].includes(row.attempt_class)
      || row.disposition !== dependency.disposition
      || row.source_after_sha !== dependency.sourceAfterSha
      || row.source_after_tree_hash !== dependency.sourceAfterTreeHash
    ) {
      preparationFail(
        "V3_PREPARATION_DEPENDENCY_ATTEMPT_MISMATCH",
        `dependency ${dependency.storyId} is not bound to the exact successful packet attempt`,
      );
    }
    return {
      storyId: dependency.storyId,
      attemptId: row.attempt_id,
      attemptClass: row.attempt_class as "product_implementation" | "supervisor_repair",
      disposition: row.disposition as "produced_delta" | "already_satisfied" | "verified",
      sourceRevision: {
        sha: row.source_after_sha!,
        treeHash: row.source_after_tree_hash!,
      },
    };
  }).sort((left, right) => left.storyId.localeCompare(right.storyId));
  return authorities;
}

async function upsertBlockedPreparationState(
  transaction: TransactionSql,
  input: Readonly<{
    identity: V3PreparationIdentityV1;
    fingerprint: string;
    now: string;
  }>,
): Promise<void> {
  const projectedDependencyIds = canonicalStrings(
    input.identity.dependencyState.map((dependency) => dependency.storyId),
  );
  await transaction.unsafe(
    `INSERT INTO v3_preparation_story_state (
       run_id, step_id, story_id, state_version, state, packet_hash,
       base_source_sha, base_source_tree_hash, projected_dependency_ids,
       dependency_attempts, state_fingerprint, claim_id,
       created_at, updated_at, claimed_at
     ) VALUES ($1,$2,$3,1,'blocked',$4,$5,$6,$7::text::jsonb,$8::text::jsonb,$9,NULL,$10,$10,NULL)
     ON CONFLICT (run_id, step_id, story_id) DO UPDATE
       SET state_version = v3_preparation_story_state.state_version + 1,
           state = 'blocked',
           packet_hash = EXCLUDED.packet_hash,
           base_source_sha = EXCLUDED.base_source_sha,
           base_source_tree_hash = EXCLUDED.base_source_tree_hash,
           projected_dependency_ids = EXCLUDED.projected_dependency_ids,
           dependency_attempts = EXCLUDED.dependency_attempts,
           state_fingerprint = EXCLUDED.state_fingerprint,
           claim_id = NULL,
           claimed_at = NULL,
           updated_at = EXCLUDED.updated_at`,
    [
      input.identity.runId,
      input.identity.stepId,
      input.identity.storyId,
      input.identity.packetHash,
      input.identity.sourceSha,
      input.identity.sourceTreeHash,
      canonicalJsonStringify(projectedDependencyIds),
      canonicalJsonStringify(input.identity.dependencyState),
      input.fingerprint,
      input.now,
    ],
  );
}

async function assertReadyStoryProjection(
  transaction: TransactionSql,
  input: Readonly<{
    runId: string;
    stepId: string;
    storyId: string;
    projectedDependencyIds: readonly string[];
  }>,
): Promise<void> {
  const steps = await transaction.unsafe<Array<{ status: string }>>(
    `SELECT status FROM steps
      WHERE run_id = $1 AND step_id = $2
      FOR UPDATE`,
    [input.runId, input.stepId],
  );
  if (steps.length !== 1 || !["pending", "running"].includes(steps[0]!.status)) {
    preparationFail("V3_PREPARATION_STEP_PROJECTION_MISMATCH", "exact loop step is not claimable");
  }
  const stories = await transaction.unsafe<Array<{ status: string; depends_on: string | null }>>(
    `SELECT status, depends_on FROM stories
      WHERE run_id = $1 AND story_id = $2
      FOR UPDATE`,
    [input.runId, input.storyId],
  );
  if (stories.length !== 1 || stories[0]!.status !== "pending") {
    preparationFail("V3_PREPARATION_STORY_NOT_PENDING", "exact story projection is not pending");
  }
  const projected = parseProjectedDependencies(stories[0]!.depends_on);
  if (!sameStrings(projected, input.projectedDependencyIds)) {
    preparationFail("V3_PREPARATION_STORY_PROJECTION_MISMATCH", "story dependency projection changed");
  }
}

async function readCurrentPreparationState(
  transaction: TransactionSql,
  input: Readonly<{ runId: string; stepId: string; storyId: string }>,
): Promise<PreparationStateRow | undefined> {
  const rows = await transaction.unsafe<PreparationStateRow[]>(
    `SELECT * FROM v3_preparation_story_state
      WHERE run_id = $1 AND step_id = $2 AND story_id = $3
      FOR UPDATE`,
    [input.runId, input.stepId, input.storyId],
  );
  return rows[0];
}

function mapReadyAuthority(row: PreparationStateRow): V3PreparationClaimAuthorityV1 {
  return createV3PreparationClaimAuthorityV1({
    stateVersion: row.state_version,
    runId: row.run_id,
    stepId: row.step_id,
    storyId: row.story_id,
    packetHash: row.packet_hash,
    baseRevision: {
      sha: row.base_source_sha,
      treeHash: row.base_source_tree_hash,
    },
    projectedDependencyIds: parsedJson(row.projected_dependency_ids) as string[],
    dependencyAttempts: parsedJson(row.dependency_attempts) as V3PreparationDependencyAttemptAuthorityV1[],
  });
}

export function createV3PreparationBlockRepository(sql: postgres.Sql) {
  async function findOpen(input: Readonly<{
    runId: string;
    stepId: string;
    storyId: string;
  }>): Promise<V3PreparationBlockV1 | undefined> {
    const rows = await sql.unsafe<BlockRow[]>(
      `SELECT * FROM v3_preparation_blocks
        WHERE run_id = $1 AND step_id = $2 AND story_id = $3 AND resolved_at IS NULL
        ORDER BY opened_at DESC, block_id DESC LIMIT 1`,
      [input.runId, input.stepId, input.storyId],
    );
    return rows[0] ? mapBlock(rows[0]) : undefined;
  }

  return Object.freeze({
    findOpen,

    async readOpenFingerprint(input: Readonly<{
      runId: string;
      stepId: string;
      storyId: string;
    }>): Promise<string | undefined> {
      return (await findOpen(input))?.fingerprint;
    },

    async record(input: Readonly<{
      identity: V3PreparationIdentityV1;
      decision: V3PreparationDecisionV1;
      detail: string;
      evidenceRefs: readonly string[];
      now?: Date;
    }>): Promise<Readonly<{
      status: "opened" | "duplicate" | "superseded" | "historical";
      block: V3PreparationBlockV1;
    }>> {
      const identity = V3PreparationIdentityV1Schema.parse(input.identity);
      const decision = V3PreparationDecisionV1Schema.parse(input.decision);
      if (["ready", "unchanged_replay"].includes(decision.action)) {
        throw new Error("V3_PREPARATION_NON_BLOCKING_DECISION_REJECTED");
      }
      const expectedFingerprint = createV3PreparationFingerprint(identity);
      if (
        decision.fingerprint !== expectedFingerprint
        || decision.phase !== identity.phase
        || decision.errorCode !== identity.errorCode
      ) {
        throw new Error("V3_PREPARATION_DECISION_IDENTITY_MISMATCH");
      }
      if (input.now && !Number.isFinite(new Date(input.now).getTime())) {
        throw new Error("V3_PREPARATION_BLOCK_TIME_INVALID");
      }
      return sql.begin(async (transaction) => {
        await lockPreparationStory(transaction, identity);
        await assertActivePacketOwner(transaction, identity);
        const openRows = await transaction.unsafe<BlockRow[]>(
          `SELECT * FROM v3_preparation_blocks
            WHERE run_id = $1 AND step_id = $2 AND story_id = $3 AND resolved_at IS NULL
            FOR UPDATE`,
          [identity.runId, identity.stepId, identity.storyId],
        );
        const open = openRows[0];
        if (open?.fingerprint === decision.fingerprint) {
          return { status: "duplicate" as const, block: mapBlock(open) };
        }
        const historicalRows = await transaction.unsafe<BlockRow[]>(
          `SELECT * FROM v3_preparation_blocks
            WHERE run_id = $1 AND step_id = $2 AND story_id = $3 AND fingerprint = $4
            ORDER BY occurrence DESC LIMIT 1 FOR UPDATE`,
          [identity.runId, identity.stepId, identity.storyId, decision.fingerprint],
        );
        const historical = historicalRows[0];
        const openedAt = (await readDatabaseWallClock(
          transaction,
          "V3_PREPARATION_DATABASE_TIME_UNAVAILABLE",
        )).toISOString();
        if (open) {
          await transaction.unsafe(
            `UPDATE v3_preparation_blocks
                SET resolved_at = $2, resolution_fingerprint = $3
              WHERE block_id = $1 AND resolved_at IS NULL`,
            [open.block_id, openedAt, decision.fingerprint],
          );
        }
        const occurrenceRows = await transaction.unsafe<Array<{ next_occurrence: number }>>(
          `SELECT COALESCE(MAX(occurrence), 0)::integer + 1 AS next_occurrence
             FROM v3_preparation_blocks
            WHERE run_id = $1 AND step_id = $2 AND story_id = $3`,
          [identity.runId, identity.stepId, identity.storyId],
        );
        const occurrence = occurrenceRows[0]?.next_occurrence;
        if (!Number.isSafeInteger(occurrence) || occurrence! <= 0) {
          throw new Error("V3_PREPARATION_BLOCK_OCCURRENCE_INVALID");
        }
        const blockId = `VPB_${decision.fingerprint}_${occurrence}`;
        const rows = await transaction.unsafe<BlockRow[]>(
          `INSERT INTO v3_preparation_blocks (
             block_id, fingerprint, occurrence, run_id, step_id, story_id, packet_hash,
             source_sha, source_tree_hash, phase, error_code, action,
             dependency_state, detail, evidence_refs, opened_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text::jsonb,$14,$15::text::jsonb,$16)
           RETURNING *`,
          [
            blockId,
            decision.fingerprint,
            occurrence,
            identity.runId,
            identity.stepId,
            identity.storyId,
            identity.packetHash,
            identity.sourceSha,
            identity.sourceTreeHash,
            identity.phase,
            identity.errorCode,
            decision.action,
            canonicalJsonStringify(identity.dependencyState),
            input.detail.slice(0, 8_000),
            canonicalJsonStringify([...new Set(input.evidenceRefs)].sort()),
            openedAt,
          ],
        );
        const row = rows[0];
        if (!row) throw new Error("V3_PREPARATION_BLOCK_PUBLICATION_FAILED");
        await upsertBlockedPreparationState(transaction, {
          identity,
          fingerprint: decision.fingerprint,
          now: openedAt,
        });
        return {
          status: historical
            ? "historical" as const
            : open
              ? "superseded" as const
              : "opened" as const,
          block: mapBlock(row),
        };
      });
    },

    async resolveReady(input: Readonly<{
      runId: string;
      stepId: string;
      storyId: string;
      packetHash: string;
      sourceSha: string;
      sourceTreeHash: string;
      dependencyState: readonly V3PreparationDependencyStateV1[];
      /**
       * Required to mint a claim authority. Omission retains the pre-authority
       * v16 block-resolution API for callers that only close historical blocks.
       */
      projectedDependencyIds?: readonly string[];
      supervisorRetryRearm?: AuthenticatedV3SupervisorRetryPreparationSourceV1;
      now?: Date;
    }>): Promise<Readonly<{
      status: "none" | "resolved";
      block?: V3PreparationBlockV1;
      authority?: V3PreparationClaimAuthorityV1;
    }>> {
      const resolutionFingerprint = readyFingerprint(input);
      if (input.now && !Number.isFinite(new Date(input.now).getTime())) {
        throw new Error("V3_PREPARATION_RESOLUTION_TIME_INVALID");
      }
      return sql.begin(async (transaction) => {
        await lockPreparationStory(transaction, input);
        await assertActivePacketOwner(transaction, input);
        const rows = await transaction.unsafe<BlockRow[]>(
          `SELECT * FROM v3_preparation_blocks
            WHERE run_id = $1 AND step_id = $2 AND story_id = $3 AND resolved_at IS NULL
            FOR UPDATE`,
          [input.runId, input.stepId, input.storyId],
        );
        const open = rows[0];
        if (input.projectedDependencyIds === undefined) {
          if (!open) return { status: "none" as const };
          if (open.fingerprint === resolutionFingerprint) {
            throw new Error("V3_PREPARATION_UNCHANGED_RESOLUTION_REJECTED");
          }
          const resolvedAt = (await readDatabaseWallClock(
            transaction,
            "V3_PREPARATION_DATABASE_TIME_UNAVAILABLE",
          )).toISOString();
          const resolvedRows = await transaction.unsafe<BlockRow[]>(
            `UPDATE v3_preparation_blocks
                SET resolved_at = $2, resolution_fingerprint = $3
              WHERE block_id = $1 AND resolved_at IS NULL
              RETURNING *`,
            [open.block_id, resolvedAt, resolutionFingerprint],
          );
          return { status: "resolved" as const, block: mapBlock(resolvedRows[0]!) };
        }

        const projectedDependencyIds = canonicalStrings(input.projectedDependencyIds);
        if (
          projectedDependencyIds.length !== input.projectedDependencyIds.length
          || !sameStrings(projectedDependencyIds, input.projectedDependencyIds)
        ) {
          preparationFail(
            "V3_PREPARATION_PROJECTED_DEPENDENCIES_NONCANONICAL",
            "projected dependencies must be unique and canonically sorted",
          );
        }
        const dependencyStoryIds = canonicalStrings(
          input.dependencyState.map((dependency) => dependency.storyId),
        );
        if (!sameStrings(projectedDependencyIds, dependencyStoryIds)) {
          preparationFail(
            "V3_PREPARATION_PROJECTED_DEPENDENCIES_MISMATCH",
            "ready dependency state differs from the projected dependency IDs",
          );
        }
        await assertReadyStoryProjection(transaction, {
          ...input,
          projectedDependencyIds,
        });
        const dependencyAttempts = await loadExactDependencyAuthorities(transaction, {
          ...input,
          dependencyState: input.dependencyState,
        });
        const current = await readCurrentPreparationState(transaction, input);
        if (current?.state === "claimed") {
          const claims = await transaction.unsafe<Array<{ outcome: string | null }>>(
            "SELECT outcome FROM claim_log WHERE id = $1 FOR UPDATE",
            [current.claim_id],
          );
          if (claims[0]?.outcome === null) {
            preparationFail(
              "V3_PREPARATION_PRIOR_CLAIM_ACTIVE",
              "claimed preparation cannot be rearmed while its claim is active",
            );
          }
          const supervisorRetryRearm = input.supervisorRetryRearm
            ? inspectAuthenticatedV3SupervisorRetryPreparationSourceV1(input.supervisorRetryRearm)
            : undefined;
          const exactSupervisorRetryRearm = claims[0]?.outcome === "completed"
            && supervisorRetryRearm?.storyId === input.storyId
            && supervisorRetryRearm.preparationStateVersion === current.state_version
            && supervisorRetryRearm.preparationStateFingerprint === current.state_fingerprint
            && supervisorRetryRearm.priorImplementationClaimId === Number(current.claim_id);
          if (claims[0]?.outcome !== "infra_retry" && !exactSupervisorRetryRearm) {
            preparationFail(
              "V3_PREPARATION_PRIOR_CLAIM_NOT_RETRYABLE",
              "only terminal infra_retry or the exact authenticated supervisor retry owner can mint a new ready generation",
            );
          }
        }

        if (current?.state === "ready") {
          const currentAuthority = mapReadyAuthority(current);
          if (current.state_fingerprint !== currentAuthority.authorityHash) {
            preparationFail(
              "V3_PREPARATION_STATE_FINGERPRINT_MISMATCH",
              "stored ready state does not match its canonical authority hash",
            );
          }
          const sameAuthority = current.packet_hash === input.packetHash
            && current.base_source_sha === input.sourceSha
            && current.base_source_tree_hash === input.sourceTreeHash
            && sameStrings(currentAuthority.projectedDependencyIds, projectedDependencyIds)
            && hashCanonicalJson(currentAuthority.dependencyAttempts) === hashCanonicalJson(dependencyAttempts);
          if (sameAuthority) {
            if (open) {
              preparationFail(
                "V3_PREPARATION_STATE_BLOCK_CONFLICT",
                "ready state cannot coexist with an open preparation block",
              );
            }
            return { status: "none" as const, authority: currentAuthority };
          }
        }

        const stateVersion = current ? current.state_version + 1 : 1;
        const authority = createV3PreparationClaimAuthorityV1({
          stateVersion,
          runId: input.runId,
          stepId: input.stepId,
          storyId: input.storyId,
          packetHash: input.packetHash,
          baseRevision: { sha: input.sourceSha, treeHash: input.sourceTreeHash },
          projectedDependencyIds,
          dependencyAttempts: [...dependencyAttempts],
        });
        const resolvedAt = (await readDatabaseWallClock(
          transaction,
          "V3_PREPARATION_DATABASE_TIME_UNAVAILABLE",
        )).toISOString();
        let resolvedBlock: V3PreparationBlockV1 | undefined;
        if (open) {
          if (open.fingerprint === authority.authorityHash) {
            preparationFail(
              "V3_PREPARATION_UNCHANGED_RESOLUTION_REJECTED",
              "an unchanged fingerprint cannot resolve a preparation block",
            );
          }
          const resolvedRows = await transaction.unsafe<BlockRow[]>(
            `UPDATE v3_preparation_blocks
                SET resolved_at = $2, resolution_fingerprint = $3
              WHERE block_id = $1 AND resolved_at IS NULL
              RETURNING *`,
            [open.block_id, resolvedAt, authority.authorityHash],
          );
          resolvedBlock = mapBlock(resolvedRows[0]!);
        }
        await transaction.unsafe(
          `INSERT INTO v3_preparation_story_state (
             run_id, step_id, story_id, state_version, state, packet_hash,
             base_source_sha, base_source_tree_hash, projected_dependency_ids,
             dependency_attempts, state_fingerprint, claim_id,
             created_at, updated_at, claimed_at
           ) VALUES ($1,$2,$3,$4,'ready',$5,$6,$7,$8::text::jsonb,$9::text::jsonb,$10,NULL,$11,$11,NULL)
           ON CONFLICT (run_id, step_id, story_id) DO UPDATE
             SET state_version = EXCLUDED.state_version,
                 state = 'ready',
                 packet_hash = EXCLUDED.packet_hash,
                 base_source_sha = EXCLUDED.base_source_sha,
                 base_source_tree_hash = EXCLUDED.base_source_tree_hash,
                 projected_dependency_ids = EXCLUDED.projected_dependency_ids,
                 dependency_attempts = EXCLUDED.dependency_attempts,
                 state_fingerprint = EXCLUDED.state_fingerprint,
                 claim_id = NULL,
                 claimed_at = NULL,
                 updated_at = EXCLUDED.updated_at`,
          [
            input.runId,
            input.stepId,
            input.storyId,
            authority.stateVersion,
            input.packetHash,
            input.sourceSha,
            input.sourceTreeHash,
            canonicalJsonStringify(projectedDependencyIds),
            canonicalJsonStringify(dependencyAttempts),
            authority.authorityHash,
            resolvedAt,
          ],
        );
        return {
          status: resolvedBlock ? "resolved" as const : "none" as const,
          ...(resolvedBlock ? { block: resolvedBlock } : {}),
          authority,
        };
      });
    },
  });
}
