import type postgres from "postgres";
import { z } from "zod";

const CLAIM_REF = /^setfarm:\/\/claim-log\/([1-9][0-9]{0,15})$/;
const ACTIVE_ATTEMPT_DISPOSITIONS = new Set(["claimed", "running"]);
const TERMINAL_RUN_STATUSES = new Set(["completed", "done", "failed", "cancelled", "canceled", "error"]);
const TERMINAL_STEP_STATUSES = new Set(["done", "failed", "skipped"]);
const TERMINAL_STORY_STATUSES = new Set(["done", "verified", "failed", "skipped"]);

const ShadowParityAttemptV1Schema = z.object({
  attemptId: z.string().min(1).max(500),
  generation: z.number().int().positive(),
  attemptClass: z.string().min(1).max(100),
  disposition: z.string().min(1).max(100),
  leaseExpiresAt: z.string().datetime({ offset: true }),
}).strict();

const ShadowParityBindingV1Schema = z.object({
  legacyClaimId: z.number().int().positive(),
  stepId: z.string().min(1).max(500),
  storyId: z.string().min(1).max(500),
  agentId: z.string().min(1).max(500),
  claimDisposition: z.string().min(1).max(100),
  stepDisposition: z.string().min(1).max(100).nullable(),
  storyDisposition: z.string().min(1).max(100).nullable(),
  workflowDisposition: z.string().min(1).max(100),
  attempts: z.array(ShadowParityAttemptV1Schema),
}).strict();

export const ShadowParityFindingCodeV1Schema = z.enum([
  "SHADOW_ATTEMPT_CLAIM_ORPHAN",
  "SHADOW_ATTEMPT_CLAIM_REF_INVALID",
  "SHADOW_ATTEMPT_LEASE_STALE",
  "SHADOW_CLAIM_ATTEMPT_DUPLICATE",
  "SHADOW_CLAIM_ATTEMPT_MISSING",
  "SHADOW_OPEN_CLAIM_TERMINAL_ATTEMPT",
  "SHADOW_PARITY_EVIDENCE_EMPTY",
  "SHADOW_TERMINAL_PROCESS_ACTIVE_ATTEMPT",
]);

const ShadowParityFindingV1Schema = z.object({
  code: ShadowParityFindingCodeV1Schema,
  legacyClaimId: z.number().int().positive().optional(),
  attemptId: z.string().min(1).max(500).optional(),
  stepId: z.string().min(1).max(500).optional(),
  storyId: z.string().min(1).max(500).optional(),
}).strict();

export const ShadowParityReportV1Schema = z.object({
  schema: z.literal("setfarm.shadow-parity-report.v1"),
  runId: z.string().min(1).max(500),
  protocol: z.enum(["legacy", "shadow", "v3"]),
  protocolVersion: z.number().int().positive(),
  asOf: z.string().datetime({ offset: true }),
  status: z.enum(["not_applicable", "pending", "pass", "fail"]),
  workflowDisposition: z.string().min(1).max(100),
  counts: z.object({
    ignoredSingleStepClaims: z.number().int().nonnegative(),
    scopedClaims: z.number().int().nonnegative(),
    attempts: z.number().int().nonnegative(),
    exactBindings: z.number().int().nonnegative(),
    findings: z.number().int().nonnegative(),
  }).strict(),
  bindings: z.array(ShadowParityBindingV1Schema),
  unboundAttemptIds: z.array(z.string().min(1).max(500)),
  findings: z.array(ShadowParityFindingV1Schema),
}).strict();

export type ShadowParityReportV1 = z.infer<typeof ShadowParityReportV1Schema>;

type RunRow = {
  id: string;
  protocol: string;
  protocol_version: number;
  status: string;
};

type ClaimRow = {
  id: number | string;
  step_id: string;
  story_id: string | null;
  agent_id: string;
  outcome: string | null;
};

type AttemptRow = {
  attempt_id: string;
  generation: number;
  attempt_class: string;
  disposition: string;
  lease_expires_at: Date | string;
  evidence_refs: string;
};

type ProcessRow = { identity: string; status: string };

export function legacyClaimEvidenceRef(claimId: number): string {
  if (!Number.isSafeInteger(claimId) || claimId <= 0) {
    throw new TypeError("legacy claim id must be a positive safe integer");
  }
  return `setfarm://claim-log/${claimId}`;
}

export function legacyClaimIdsFromEvidenceRefs(refs: readonly string[]): number[] {
  const ids = new Set<number>();
  for (const ref of refs) {
    const match = CLAIM_REF.exec(ref);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isSafeInteger(value) && value > 0) ids.add(value);
  }
  return [...ids].sort((left, right) => left - right);
}

function timestamp(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function parseEvidenceRefs(raw: string): string[] | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = z.array(z.string().min(1).max(500)).max(1_000).safeParse(parsed);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

function findingKey(finding: z.infer<typeof ShadowParityFindingV1Schema>): string {
  return [
    finding.code,
    String(finding.legacyClaimId ?? ""),
    finding.attemptId ?? "",
    finding.stepId ?? "",
    finding.storyId ?? "",
  ].join("\u0000");
}

export function buildShadowParityReport(input: Readonly<{
  run: RunRow;
  claims: readonly ClaimRow[];
  attempts: readonly AttemptRow[];
  steps: readonly ProcessRow[];
  stories: readonly ProcessRow[];
  asOf: Date;
}>): ShadowParityReportV1 {
  const protocol = z.enum(["legacy", "shadow", "v3"]).parse(input.run.protocol);
  const asOf = new Date(input.asOf);
  const base = {
    schema: "setfarm.shadow-parity-report.v1" as const,
    runId: input.run.id,
    protocol,
    protocolVersion: input.run.protocol_version,
    asOf: asOf.toISOString(),
    workflowDisposition: input.run.status,
  };
  if (protocol !== "shadow") {
    return ShadowParityReportV1Schema.parse({
      ...base,
      status: "not_applicable",
      counts: {
        ignoredSingleStepClaims: 0,
        scopedClaims: 0,
        attempts: 0,
        exactBindings: 0,
        findings: 0,
      },
      bindings: [],
      unboundAttemptIds: [],
      findings: [],
    });
  }

  const stepStatuses = new Map(input.steps.map((row) => [row.identity, row.status]));
  const storyStatuses = new Map(input.stories.map((row) => [row.identity, row.status]));
  const scopedClaims = input.claims.filter((claim) => claim.story_id !== null);
  const claimById = new Map(scopedClaims.map((claim) => [Number(claim.id), claim]));
  const attemptsByClaim = new Map<number, AttemptRow[]>();
  const unboundAttemptIds: string[] = [];
  const findings: Array<z.infer<typeof ShadowParityFindingV1Schema>> = [];

  if (
    TERMINAL_RUN_STATUSES.has(input.run.status)
    && input.stories.length > 0
    && scopedClaims.length === 0
  ) {
    findings.push({ code: "SHADOW_PARITY_EVIDENCE_EMPTY" });
  }

  for (const attempt of input.attempts) {
    const refs = parseEvidenceRefs(attempt.evidence_refs);
    const claimIds = refs ? legacyClaimIdsFromEvidenceRefs(refs) : [];
    if (claimIds.length !== 1) {
      findings.push({ code: "SHADOW_ATTEMPT_CLAIM_REF_INVALID", attemptId: attempt.attempt_id });
      unboundAttemptIds.push(attempt.attempt_id);
      continue;
    }
    const claimId = claimIds[0]!;
    if (!claimById.has(claimId)) {
      findings.push({
        code: "SHADOW_ATTEMPT_CLAIM_ORPHAN",
        legacyClaimId: claimId,
        attemptId: attempt.attempt_id,
      });
      unboundAttemptIds.push(attempt.attempt_id);
      continue;
    }
    const existing = attemptsByClaim.get(claimId) ?? [];
    existing.push(attempt);
    attemptsByClaim.set(claimId, existing);
  }

  const bindings = scopedClaims
    .map((claim) => {
      const claimId = Number(claim.id);
      const attempts = [...(attemptsByClaim.get(claimId) ?? [])]
        .sort((left, right) => left.attempt_id.localeCompare(right.attempt_id));
      const storyId = claim.story_id!;
      const stepDisposition = stepStatuses.get(claim.step_id) ?? null;
      const storyDisposition = storyStatuses.get(storyId) ?? null;
      if (attempts.length === 0) {
        findings.push({
          code: "SHADOW_CLAIM_ATTEMPT_MISSING",
          legacyClaimId: claimId,
          stepId: claim.step_id,
          storyId,
        });
      } else if (attempts.length > 1) {
        findings.push({
          code: "SHADOW_CLAIM_ATTEMPT_DUPLICATE",
          legacyClaimId: claimId,
          stepId: claim.step_id,
          storyId,
        });
      }
      for (const attempt of attempts) {
        const active = ACTIVE_ATTEMPT_DISPOSITIONS.has(attempt.disposition);
        if (active && new Date(attempt.lease_expires_at).getTime() <= asOf.getTime()) {
          findings.push({
            code: "SHADOW_ATTEMPT_LEASE_STALE",
            legacyClaimId: claimId,
            attemptId: attempt.attempt_id,
            stepId: claim.step_id,
            storyId,
          });
        }
        const terminalProcess = claim.outcome !== null
          || TERMINAL_RUN_STATUSES.has(input.run.status)
          || (stepDisposition !== null && TERMINAL_STEP_STATUSES.has(stepDisposition))
          || (storyDisposition !== null && TERMINAL_STORY_STATUSES.has(storyDisposition));
        if (active && terminalProcess) {
          findings.push({
            code: "SHADOW_TERMINAL_PROCESS_ACTIVE_ATTEMPT",
            legacyClaimId: claimId,
            attemptId: attempt.attempt_id,
            stepId: claim.step_id,
            storyId,
          });
        }
        if (!active && claim.outcome === null) {
          findings.push({
            code: "SHADOW_OPEN_CLAIM_TERMINAL_ATTEMPT",
            legacyClaimId: claimId,
            attemptId: attempt.attempt_id,
            stepId: claim.step_id,
            storyId,
          });
        }
      }
      return {
        legacyClaimId: claimId,
        stepId: claim.step_id,
        storyId,
        agentId: claim.agent_id,
        claimDisposition: claim.outcome ?? "open",
        stepDisposition,
        storyDisposition,
        workflowDisposition: input.run.status,
        attempts: attempts.map((attempt) => ({
          attemptId: attempt.attempt_id,
          generation: attempt.generation,
          attemptClass: attempt.attempt_class,
          disposition: attempt.disposition,
          leaseExpiresAt: timestamp(attempt.lease_expires_at),
        })),
      };
    })
    .sort((left, right) => left.legacyClaimId - right.legacyClaimId);

  findings.sort((left, right) => findingKey(left).localeCompare(findingKey(right)));
  unboundAttemptIds.sort();
  return ShadowParityReportV1Schema.parse({
    ...base,
    status: findings.length > 0
      ? "fail"
      : TERMINAL_RUN_STATUSES.has(input.run.status)
        ? "pass"
        : "pending",
    counts: {
      ignoredSingleStepClaims: input.claims.length - scopedClaims.length,
      scopedClaims: scopedClaims.length,
      attempts: input.attempts.length,
      exactBindings: bindings.filter((binding) => binding.attempts.length === 1).length,
      findings: findings.length,
    },
    bindings,
    unboundAttemptIds,
    findings,
  });
}

export async function readShadowParityReport(
  sql: postgres.Sql,
  runId: string,
  options: Readonly<{ asOf?: Date }> = {},
): Promise<ShadowParityReportV1 | undefined> {
  const runs = await sql.unsafe<RunRow[]>(
    "SELECT id, protocol, protocol_version, status FROM runs WHERE id = $1 LIMIT 1",
    [runId],
  );
  const run = runs[0];
  if (!run) return undefined;
  if (run.protocol !== "shadow") {
    return buildShadowParityReport({
      run,
      claims: [],
      attempts: [],
      steps: [],
      stories: [],
      asOf: options.asOf ?? new Date(),
    });
  }
  const [claims, attempts, steps, stories] = await Promise.all([
    sql.unsafe<ClaimRow[]>(
      `SELECT id, step_id, story_id, agent_id, outcome
         FROM claim_log WHERE run_id = $1 ORDER BY id`,
      [runId],
    ),
    sql.unsafe<AttemptRow[]>(
      `SELECT attempt_id, generation, attempt_class, disposition, lease_expires_at, evidence_refs
         FROM execution_attempts WHERE run_id = $1 ORDER BY created_at, attempt_id`,
      [runId],
    ),
    sql.unsafe<ProcessRow[]>(
      `SELECT step_id AS identity, status FROM steps
        WHERE run_id = $1 ORDER BY step_index, id`,
      [runId],
    ),
    sql.unsafe<ProcessRow[]>(
      `SELECT story_id AS identity, status FROM stories
        WHERE run_id = $1 ORDER BY story_index, id`,
      [runId],
    ),
  ]);
  return buildShadowParityReport({
    run,
    claims,
    attempts,
    steps,
    stories,
    asOf: options.asOf ?? new Date(),
  });
}
