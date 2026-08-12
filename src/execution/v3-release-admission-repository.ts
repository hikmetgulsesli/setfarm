import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { evaluateConvergenceReleaseGate } from "../evals/release-gate.js";
import { ContentAddressedEvalResultStore } from "../evals/report.js";
import type { ConvergenceEvalResultVersioned } from "../evals/result-schema-v2.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { GitObjectHashSchema, Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import {
  INTERNAL_CANARY_ADMISSION_ENV,
  V3ReleaseAdmissionV1Schema,
  canarySelectorHash,
  computeCanarySlotHash,
  convergenceArtifactRef,
  createV3ReleaseAdmissionV1,
  exactCanarySlotKey,
  selectorHashesEqual,
  type InternalCanaryAdmissionContextV1,
  type V3ReleaseAdmissionV1,
} from "./v3-release-admission.js";

const MAX_CANARY_TTL_MS = 9 * 24 * 60 * 60 * 1_000;
const MAX_CANARY_SLOTS = 16;

export type V3ReleaseAdmissionErrorCode =
  | "V3_CANARY_ADMISSION_EXPIRED"
  | "V3_CANARY_ADMISSION_INVALID"
  | "V3_CANARY_ADMISSION_SLOT_CONFLICT"
  | "V3_CANARY_ADMISSION_SLOT_CONSUMED"
  | "V3_RELEASE_ADMISSION_ARTIFACT_INVALID"
  | "V3_RELEASE_ADMISSION_NOT_FOUND"
  | "V3_RELEASE_ADMISSION_STORED_INVALID"
  | "V3_RELEASE_GO_CONFLICT";

export class V3ReleaseAdmissionError extends Error {
  readonly code: V3ReleaseAdmissionErrorCode;

  constructor(code: V3ReleaseAdmissionErrorCode, message: string) {
    super(message);
    this.name = "V3ReleaseAdmissionError";
    this.code = code;
  }
}

type AdmissionRow = Readonly<{
  admission_hash: string;
  kind: string;
  release_sha: string;
  suite_hash: string;
  result_hash: string | null;
  result_ref: string | null;
  gate_hash: string | null;
  gate_ref: string | null;
  expires_at: Date | string | null;
  payload: unknown;
}>;

type CanaryClaimRow = Readonly<{
  slot_hash: string;
  admission_hash: string;
  case_hash: string;
  task_hash: string;
  repetition: number;
  selector_hash: string;
  run_id: string | null;
  consumed_at: Date | string | null;
}>;

type ConsumedCanaryEvidenceRow = AdmissionRow & Readonly<{
  slot_hash: string;
  case_hash: string;
  task_hash: string;
  repetition: number;
  selector_hash: string;
  run_id: string;
  consumed_at: Date | string;
  run_protocol: string;
  run_release_sha: string | null;
  run_admission_hash: string | null;
  run_status: string;
}>;

export type V3ReleaseAdmissionSelection = Readonly<{
  admissionHash: string;
  kind: "release_go" | "convergence_canary";
  releaseSha: string;
  canary: InternalCanaryAdmissionContextV1 | null;
}>;

export type V3CanaryAdmissionSlotInput = Readonly<{
  caseHash: string;
  taskHash: string;
  repetition: number;
  slotToken: string;
}>;

export type V3CanaryAdmissionCreation = Readonly<{
  admission: Extract<V3ReleaseAdmissionV1, { kind: "convergence_canary" }>;
  contexts: readonly InternalCanaryAdmissionContextV1[];
}>;

function storedInvalid(message: string): V3ReleaseAdmissionError {
  return new V3ReleaseAdmissionError("V3_RELEASE_ADMISSION_STORED_INVALID", message);
}

function parseAdmissionRow(row: AdmissionRow): V3ReleaseAdmissionV1 {
  const parsed = V3ReleaseAdmissionV1Schema.safeParse(row.payload);
  if (!parsed.success) throw storedInvalid("Stored release admission payload is invalid");
  const admission = parsed.data;
  const exact = admission.admissionHash === row.admission_hash
    && admission.kind === row.kind
    && admission.releaseSha === row.release_sha
    && admission.suiteHash === row.suite_hash
    && admission.result.hash === row.result_hash
    && admission.result.ref === row.result_ref
    && admission.gate.hash === row.gate_hash
    && admission.gate.ref === row.gate_ref
    && (admission.expiresAt === null
      ? row.expires_at === null
      : row.expires_at !== null && admission.expiresAt === new Date(row.expires_at).toISOString());
  if (!exact) throw storedInvalid("Stored release admission columns do not match the canonical payload");
  return admission;
}

async function readAdmission(
  sql: postgres.Sql | postgres.TransactionSql,
  admissionHash: string,
): Promise<V3ReleaseAdmissionV1 | null> {
  const rows = await sql.unsafe<AdmissionRow[]>(
    `SELECT admission_hash, kind, release_sha, suite_hash,
            result_hash, result_ref, gate_hash, gate_ref, expires_at, payload
       FROM v3_release_admissions
      WHERE admission_hash = $1
      LIMIT 1`,
    [Sha256Schema.parse(admissionHash)],
  );
  return rows[0] ? parseAdmissionRow(rows[0]) : null;
}

async function verifyReleaseGoArtifacts(
  store: ContentAddressedEvalResultStore,
  admission: Extract<V3ReleaseAdmissionV1, { kind: "release_go" }>,
): Promise<void> {
  try {
    if (
      admission.result.ref !== convergenceArtifactRef(admission.result.hash)
      || admission.gate.ref !== convergenceArtifactRef(admission.gate.hash)
    ) throw new Error("non-canonical artifact ref");
    const [result, gate] = await Promise.all([
      store.getVersionedResult(admission.result.hash),
      store.getReleaseGate(admission.gate.hash),
    ]);
    const expectedGate = evaluateConvergenceReleaseGate(result);
    const fullPass = result.executionMode === "execute"
      && result.status === "pass"
      && result.runs.length === result.plannedRuns
      && result.runs.every((run) => run.passed)
      && result.releaseSha === admission.releaseSha
      && result.suiteHash === admission.suiteHash
      && gate.decision === "go"
      && gate.releaseSha === admission.releaseSha
      && gate.resultHash === admission.result.hash
      && gate.gateHash === admission.gate.hash
      && hashCanonicalJson(gate) === hashCanonicalJson(expectedGate);
    if (!fullPass) throw new Error("release gate is not an exact full-suite GO");
  } catch {
    throw new V3ReleaseAdmissionError(
      "V3_RELEASE_ADMISSION_ARTIFACT_INVALID",
      "Release admission artifacts failed exact deep verification",
    );
  }
}

async function verifyConsumedCanaryEvidence(
  sql: postgres.Sql | postgres.TransactionSql,
  result: ConvergenceEvalResultVersioned,
): Promise<void> {
  const runIds = result.runs.map((run) => run.runId);
  if (new Set(runIds).size !== result.plannedRuns || runIds.length !== result.plannedRuns) {
    throw new V3ReleaseAdmissionError(
      "V3_RELEASE_ADMISSION_ARTIFACT_INVALID",
      "Release GO result does not identify one unique run per canary slot",
    );
  }
  const rows = await sql.unsafe<ConsumedCanaryEvidenceRow[]>(
    `SELECT a.admission_hash, a.kind, a.release_sha, a.suite_hash,
            a.result_hash, a.result_ref, a.gate_hash, a.gate_ref,
            a.expires_at, a.payload,
            claim.slot_hash, claim.case_hash, claim.task_hash,
            claim.repetition, claim.selector_hash, claim.run_id,
            claim.consumed_at,
            run.protocol AS run_protocol,
            run.compiler_release_sha AS run_release_sha,
            run.release_admission_hash AS run_admission_hash,
            run.status AS run_status
       FROM v3_canary_admission_claims claim
       JOIN v3_release_admissions a
         ON a.admission_hash = claim.admission_hash
        AND a.kind = 'convergence_canary'
       JOIN runs run
         ON run.id = claim.run_id
        AND run.release_admission_hash = claim.admission_hash
      WHERE a.release_sha = $1
        AND a.suite_hash = $2
        AND a.payload->>'preflightHash' = $3
        AND claim.run_id = ANY($4::text[])
        AND claim.consumed_at IS NOT NULL
      ORDER BY a.admission_hash, claim.slot_hash
      FOR SHARE OF a, claim, run`,
    [result.releaseSha, result.suiteHash, result.preflight.preflightHash, runIds],
  );
  const groups = new Map<string, ConsumedCanaryEvidenceRow[]>();
  for (const row of rows) {
    const group = groups.get(row.admission_hash) ?? [];
    group.push(row);
    groups.set(row.admission_hash, group);
  }
  const expectedRuns = new Map(result.runs.map((run) => [run.runId, run]));
  const validAdmissions = [...groups.values()].filter((group) => {
    if (group.length !== result.plannedRuns) return false;
    let admission: V3ReleaseAdmissionV1;
    try {
      admission = parseAdmissionRow(group[0]!);
    } catch {
      return false;
    }
    if (
      admission.kind !== "convergence_canary"
      || admission.preflightHash !== result.preflight.preflightHash
      || admission.slots.length !== result.plannedRuns
    ) return false;
    const slots = new Map(admission.slots.map((slot) => [exactCanarySlotKey(slot), slot]));
    if (slots.size !== result.plannedRuns) return false;
    return group.every((row) => {
      const expectedRun = expectedRuns.get(row.run_id);
      if (!expectedRun) return false;
      const slot = slots.get(exactCanarySlotKey({
        caseHash: row.case_hash,
        taskHash: row.task_hash,
        repetition: row.repetition,
      }));
      const expectedStatus = expectedRun.expectedDecision === "accepted_candidate" ? "completed" : "failed";
      return Boolean(slot)
        && slot!.slotHash === row.slot_hash
        && slot!.selectorHash === row.selector_hash
        && expectedRun.caseHash === row.case_hash
        && expectedRun.taskHash === row.task_hash
        && expectedRun.repetition === row.repetition
        && expectedRun.disposition === expectedStatus
        && row.run_status === expectedStatus
        && row.run_protocol === "v3"
        && row.run_release_sha === result.releaseSha
        && row.run_admission_hash === admission.admissionHash;
    });
  });
  if (validAdmissions.length !== 1) {
    throw new V3ReleaseAdmissionError(
      "V3_RELEASE_ADMISSION_ARTIFACT_INVALID",
      "Release GO result is not bound to one exact fully consumed canary admission",
    );
  }
}

function parseCanaryTtlMs(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_CANARY_TTL_MS) {
    throw new V3ReleaseAdmissionError(
      "V3_CANARY_ADMISSION_INVALID",
      "Canary admission TTL must be a positive integer no greater than nine days",
    );
  }
  return value;
}

function exactClaimMatches(
  row: CanaryClaimRow,
  context: InternalCanaryAdmissionContextV1,
): boolean {
  return row.slot_hash === context.slotHash
    && row.admission_hash === context.admissionHash
    && row.case_hash === context.caseHash
    && row.task_hash === context.taskHash
    && row.repetition === context.repetition
    && selectorHashesEqual(row.selector_hash, canarySelectorHash(context.slotToken));
}

export function createV3ReleaseAdmissionRepository(
  sql: postgres.Sql,
  store: ContentAddressedEvalResultStore,
  options: Readonly<{ now?: () => Date }> = {},
) {
  const validateCompatibilityClock = (): void => {
    if (options.now && !Number.isFinite(new Date(options.now()).getTime())) {
      throw new V3ReleaseAdmissionError(
        "V3_CANARY_ADMISSION_INVALID",
        "Canary compatibility clock is invalid",
      );
    }
  };

  return Object.freeze({
    async createCanary(input: Readonly<{
      releaseSha: string;
      suiteHash: string;
      preflightHash: string;
      ttlMs: number;
      slots: readonly V3CanaryAdmissionSlotInput[];
    }>): Promise<V3CanaryAdmissionCreation> {
      const releaseSha = GitObjectHashSchema.parse(input.releaseSha);
      const suiteHash = Sha256Schema.parse(input.suiteHash);
      const preflightHash = Sha256Schema.parse(input.preflightHash);
      const ttlMs = parseCanaryTtlMs(input.ttlMs);
      validateCompatibilityClock();
      if (input.slots.length < 1 || input.slots.length > MAX_CANARY_SLOTS) {
        throw new V3ReleaseAdmissionError(
          "V3_CANARY_ADMISSION_INVALID",
          "Canary admission must contain one to sixteen exact slots",
        );
      }
      const descriptors = input.slots.map((slot) => {
        const selectorHash = canarySelectorHash(slot.slotToken);
        const descriptor = {
          caseHash: Sha256Schema.parse(slot.caseHash),
          taskHash: Sha256Schema.parse(slot.taskHash),
          repetition: slot.repetition,
          selectorHash,
          slotHash: computeCanarySlotHash({
            releaseSha,
            suiteHash,
            caseHash: slot.caseHash,
            taskHash: slot.taskHash,
            repetition: slot.repetition,
            selectorHash,
          }),
        };
        return { descriptor, slotToken: slot.slotToken };
      }).sort((left, right) => exactCanarySlotKey(left.descriptor)
        .localeCompare(exactCanarySlotKey(right.descriptor)));
      if (new Set(descriptors.map(({ descriptor }) => exactCanarySlotKey(descriptor))).size !== descriptors.length) {
        throw new V3ReleaseAdmissionError("V3_CANARY_ADMISSION_INVALID", "Canary exact slots must be unique");
      }
      const creationLockIdentity = hashCanonicalJson({
        schema: "setfarm.v3-canary-admission-creation.v1",
        releaseSha,
        suiteHash,
        preflightHash,
        ttlMs,
        slots: descriptors.map(({ descriptor }) => descriptor),
      });

      const admission = await sql.begin(async (transaction) => {
        await transaction.unsafe(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [creationLockIdentity],
        );
        const existingClaims = await transaction.unsafe<CanaryClaimRow[]>(
          `SELECT slot_hash, admission_hash, case_hash, task_hash, repetition,
                  selector_hash, run_id, consumed_at
             FROM v3_canary_admission_claims
            WHERE slot_hash = ANY($1::text[])
            ORDER BY slot_hash
            FOR SHARE`,
          [descriptors.map(({ descriptor }) => descriptor.slotHash)],
        );
        if (existingClaims.length > 0) {
          const admissionHashes = new Set(existingClaims.map((claim) => claim.admission_hash));
          const expected = new Map(descriptors.map(({ descriptor }) => [descriptor.slotHash, descriptor]));
          if (
            existingClaims.length !== descriptors.length
            || admissionHashes.size !== 1
            || existingClaims.some((claim) => {
              const descriptor = expected.get(claim.slot_hash);
              return !descriptor
                || claim.case_hash !== descriptor.caseHash
                || claim.task_hash !== descriptor.taskHash
                || claim.repetition !== descriptor.repetition
                || claim.selector_hash !== descriptor.selectorHash;
            })
          ) {
            throw new V3ReleaseAdmissionError(
              "V3_CANARY_ADMISSION_SLOT_CONFLICT",
              "Canary creation overlaps a different immutable slot set",
            );
          }
          const stored = await readAdmission(transaction, existingClaims[0]!.admission_hash);
          const storedTtlMs = stored?.kind === "convergence_canary"
            ? new Date(stored.expiresAt).getTime() - new Date(stored.issuedAt).getTime()
            : Number.NaN;
          if (
            !stored
            || stored.kind !== "convergence_canary"
            || stored.releaseSha !== releaseSha
            || stored.suiteHash !== suiteHash
            || stored.preflightHash !== preflightHash
            || storedTtlMs !== ttlMs
            || hashCanonicalJson(stored.slots) !== hashCanonicalJson(descriptors.map(({ descriptor }) => descriptor))
          ) {
            throw new V3ReleaseAdmissionError(
              "V3_CANARY_ADMISSION_SLOT_CONFLICT",
              "Canary slot identity conflicts with its immutable admission",
            );
          }
          return stored;
        }

        const wallClock = await readDatabaseWallClock(
          transaction,
          "V3_RELEASE_ADMISSION_DATABASE_TIME_UNAVAILABLE",
        );
        const issuedAt = wallClock.toISOString();
        const expiresAt = new Date(wallClock.getTime() + ttlMs).toISOString();
        const created = createV3ReleaseAdmissionV1({
          schema: "setfarm.v3-release-admission.v1",
          kind: "convergence_canary",
          releaseSha,
          suiteHash,
          result: { hash: null, ref: null },
          gate: { hash: null, ref: null },
          preflightHash,
          slots: descriptors.map(({ descriptor }) => descriptor),
          issuedAt,
          expiresAt,
        }) as Extract<V3ReleaseAdmissionV1, { kind: "convergence_canary" }>;
        await transaction.unsafe(
          `INSERT INTO v3_release_admissions (
             admission_hash, kind, release_sha, suite_hash,
             result_hash, result_ref, gate_hash, gate_ref,
             expires_at, payload, created_at
           ) VALUES ($1, $2, $3, $4, NULL, NULL, NULL, NULL,
                     $5, $6::text::jsonb, $7)
           ON CONFLICT (admission_hash) DO NOTHING`,
          [
            created.admissionHash,
            created.kind,
            created.releaseSha,
            created.suiteHash,
            created.expiresAt,
            JSON.stringify(created),
            wallClock,
          ],
        );
        const stored = await readAdmission(transaction, created.admissionHash);
        if (!stored || hashCanonicalJson(stored) !== hashCanonicalJson(created)) {
          throw new V3ReleaseAdmissionError(
            "V3_CANARY_ADMISSION_SLOT_CONFLICT",
            "Canary admission identity conflicts with stored state",
          );
        }
        for (const { descriptor } of descriptors) {
          await transaction.unsafe(
            `INSERT INTO v3_canary_admission_claims (
               slot_hash, admission_hash, admission_kind, case_hash,
               task_hash, repetition, selector_hash, created_at
             ) VALUES ($1, $2, 'convergence_canary', $3, $4, $5, $6, $7)
             ON CONFLICT (slot_hash) DO NOTHING`,
            [
              descriptor.slotHash,
              created.admissionHash,
              descriptor.caseHash,
              descriptor.taskHash,
              descriptor.repetition,
              descriptor.selectorHash,
              wallClock,
            ],
          );
        }
        const claims = await transaction.unsafe<CanaryClaimRow[]>(
          `SELECT slot_hash, admission_hash, case_hash, task_hash, repetition,
                  selector_hash, run_id, consumed_at
             FROM v3_canary_admission_claims
            WHERE admission_hash = $1
            ORDER BY case_hash, task_hash, repetition`,
          [created.admissionHash],
        );
        const expected = new Map(descriptors.map(({ descriptor }) => [descriptor.slotHash, descriptor]));
        if (claims.length !== expected.size || claims.some((claim) => {
          const descriptor = expected.get(claim.slot_hash);
          return !descriptor
            || claim.admission_hash !== created.admissionHash
            || claim.case_hash !== descriptor.caseHash
            || claim.task_hash !== descriptor.taskHash
            || claim.repetition !== descriptor.repetition
            || claim.selector_hash !== descriptor.selectorHash;
        })) {
          throw new V3ReleaseAdmissionError(
            "V3_CANARY_ADMISSION_SLOT_CONFLICT",
            "Canary admission slots conflict with stored state",
          );
        }
        return created;
      }) as Extract<V3ReleaseAdmissionV1, { kind: "convergence_canary" }>;

      return Object.freeze({
        admission,
        contexts: descriptors.map(({ descriptor, slotToken }) => Object.freeze({
          schema: "setfarm.internal-convergence-admission.v1" as const,
          admissionHash: admission.admissionHash,
          slotHash: descriptor.slotHash,
          caseHash: descriptor.caseHash,
          taskHash: descriptor.taskHash,
          repetition: descriptor.repetition,
          slotToken,
        })),
      });
    },

    async verifyCanarySelection(input: Readonly<{
      releaseSha: string;
      taskHash: string;
      context: InternalCanaryAdmissionContextV1;
    }>): Promise<V3ReleaseAdmissionSelection> {
      const releaseSha = GitObjectHashSchema.parse(input.releaseSha);
      const taskHash = Sha256Schema.parse(input.taskHash);
      validateCompatibilityClock();
      const admission = await readAdmission(sql, input.context.admissionHash);
      if (!admission || admission.kind !== "convergence_canary") {
        throw new V3ReleaseAdmissionError("V3_RELEASE_ADMISSION_NOT_FOUND", "Canary admission not found");
      }
      if (admission.releaseSha !== releaseSha || input.context.taskHash !== taskHash) {
        throw new V3ReleaseAdmissionError("V3_CANARY_ADMISSION_INVALID", "Canary release or task identity mismatch");
      }
      const wallClock = await readDatabaseWallClock(
        sql,
        "V3_RELEASE_ADMISSION_DATABASE_TIME_UNAVAILABLE",
      );
      if (new Date(admission.expiresAt).getTime() <= wallClock.getTime()) {
        throw new V3ReleaseAdmissionError("V3_CANARY_ADMISSION_EXPIRED", "Canary admission expired");
      }
      const claims = await sql.unsafe<CanaryClaimRow[]>(
        `SELECT slot_hash, admission_hash, case_hash, task_hash, repetition,
                selector_hash, run_id, consumed_at
           FROM v3_canary_admission_claims
          WHERE slot_hash = $1
          LIMIT 1`,
        [input.context.slotHash],
      );
      const claim = claims[0];
      if (!claim || !exactClaimMatches(claim, input.context)) {
        throw new V3ReleaseAdmissionError("V3_CANARY_ADMISSION_INVALID", "Canary exact slot mismatch");
      }
      if (claim.run_id !== null || claim.consumed_at !== null) {
        throw new V3ReleaseAdmissionError("V3_CANARY_ADMISSION_SLOT_CONSUMED", "Canary slot already consumed");
      }
      return Object.freeze({
        admissionHash: admission.admissionHash,
        kind: admission.kind,
        releaseSha: admission.releaseSha,
        canary: input.context,
      });
    },

    async requireReleaseGo(releaseShaValue: string): Promise<V3ReleaseAdmissionSelection> {
      const releaseSha = GitObjectHashSchema.parse(releaseShaValue);
      const rows = await sql.unsafe<AdmissionRow[]>(
        `SELECT admission_hash, kind, release_sha, suite_hash,
                result_hash, result_ref, gate_hash, gate_ref, expires_at, payload
           FROM v3_release_admissions
          WHERE kind = 'release_go' AND release_sha = $1
          LIMIT 2`,
        [releaseSha],
      );
      if (rows.length !== 1) {
        throw new V3ReleaseAdmissionError("V3_RELEASE_ADMISSION_NOT_FOUND", "Exact release GO admission not found");
      }
      const admission = parseAdmissionRow(rows[0]!);
      if (admission.kind !== "release_go" || admission.releaseSha !== releaseSha) {
        throw storedInvalid("Release GO identity mismatch");
      }
      await verifyReleaseGoArtifacts(store, admission);
      return Object.freeze({
        admissionHash: admission.admissionHash,
        kind: admission.kind,
        releaseSha: admission.releaseSha,
        canary: null,
      });
    },

    async promoteReleaseGo(input: Readonly<{
      releaseSha: string;
      suiteHash: string;
      resultHash: string;
      resultRef: string;
      gateHash: string;
      gateRef: string;
    }>): Promise<Extract<V3ReleaseAdmissionV1, { kind: "release_go" }>> {
      const resultHash = Sha256Schema.parse(input.resultHash);
      const gateHash = Sha256Schema.parse(input.gateHash);
      if (
        input.resultRef !== convergenceArtifactRef(resultHash)
        || input.gateRef !== convergenceArtifactRef(gateHash)
      ) {
        throw new V3ReleaseAdmissionError(
          "V3_RELEASE_ADMISSION_ARTIFACT_INVALID",
          "Release GO artifact refs are not canonical",
        );
      }
      let result;
      let gate;
      try {
        [result, gate] = await Promise.all([
          store.getVersionedResult(resultHash),
          store.getReleaseGate(gateHash),
        ]);
      } catch {
        throw new V3ReleaseAdmissionError(
          "V3_RELEASE_ADMISSION_ARTIFACT_INVALID",
          "Release GO artifacts could not be deep-read",
        );
      }
      const admission = createV3ReleaseAdmissionV1({
        schema: "setfarm.v3-release-admission.v1",
        kind: "release_go",
        releaseSha: GitObjectHashSchema.parse(input.releaseSha),
        suiteHash: Sha256Schema.parse(input.suiteHash),
        result: { hash: resultHash, ref: input.resultRef },
        gate: { hash: gateHash, ref: input.gateRef },
        preflightHash: result.preflight.preflightHash,
        slots: [],
        issuedAt: result.finishedAt,
        expiresAt: null,
      }) as Extract<V3ReleaseAdmissionV1, { kind: "release_go" }>;
      if (
        result.releaseSha !== admission.releaseSha
        || result.suiteHash !== admission.suiteHash
        || gate.releaseSha !== admission.releaseSha
        || gate.resultHash !== admission.result.hash
        || gate.gateHash !== admission.gate.hash
      ) {
        throw new V3ReleaseAdmissionError(
          "V3_RELEASE_ADMISSION_ARTIFACT_INVALID",
          "Release GO artifact identity mismatch",
        );
      }
      await verifyReleaseGoArtifacts(store, admission);
      try {
        return await sql.begin(async (transaction) => {
          await verifyConsumedCanaryEvidence(transaction, result);
          await transaction.unsafe(
            `INSERT INTO v3_release_admissions (
               admission_hash, kind, release_sha, suite_hash,
               result_hash, result_ref, gate_hash, gate_ref,
               expires_at, payload, created_at
             ) VALUES ($1, 'release_go', $2, $3, $4, $5, $6, $7,
                       NULL, $8::text::jsonb, $9)
             ON CONFLICT (admission_hash) DO NOTHING`,
            [
              admission.admissionHash,
              admission.releaseSha,
              admission.suiteHash,
              admission.result.hash,
              admission.result.ref,
              admission.gate.hash,
              admission.gate.ref,
              JSON.stringify(admission),
              admission.issuedAt,
            ],
          );
          const stored = await readAdmission(transaction, admission.admissionHash);
          if (!stored || stored.kind !== "release_go" || hashCanonicalJson(stored) !== hashCanonicalJson(admission)) {
            throw new V3ReleaseAdmissionError("V3_RELEASE_GO_CONFLICT", "Release GO admission conflict");
          }
          return admission;
        });
      } catch (error) {
        if (error instanceof V3ReleaseAdmissionError) throw error;
        throw new V3ReleaseAdmissionError("V3_RELEASE_GO_CONFLICT", "Release already has a different GO admission");
      }
    },
  });
}

export function readAndClearInternalCanaryAdmissionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const value = env[INTERNAL_CANARY_ADMISSION_ENV];
  delete env[INTERNAL_CANARY_ADMISSION_ENV];
  return value;
}
