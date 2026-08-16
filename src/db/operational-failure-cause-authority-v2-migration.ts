import type postgres from "postgres";

import {
  operationalFailureCauseAuthoritySqlPredicateV1,
  operationalFailureCauseEvidenceAuthoritySqlPredicateV1,
} from "../execution/operational-failure-cause-authority-v1.js";
import {
  operationalFailureCauseAuthoritySqlPredicateV2,
  operationalFailureCauseEvidenceAuthoritySqlPredicateV2,
} from "../execution/operational-failure-cause-authority-v2.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT =
  "run_termination_requests_operational_failure_cause_check" as const;

export type OperationalFailureCauseAuthorityV2MigrationErrorCode =
  | "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_PARTIAL"
  | "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_MISMATCH"
  | "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_SQL_FAILED";

export class OperationalFailureCauseAuthorityV2MigrationError extends Error {
  readonly code: OperationalFailureCauseAuthorityV2MigrationErrorCode;

  constructor(
    code: OperationalFailureCauseAuthorityV2MigrationErrorCode,
    message: string,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "OperationalFailureCauseAuthorityV2MigrationError";
    this.code = code;
  }
}

type MigrationErrorFactory = (
  code: OperationalFailureCauseAuthorityV2MigrationErrorCode,
  message: string,
  cause?: unknown,
) => Error;

let migrationErrorFactory: MigrationErrorFactory | undefined;

export function configureOperationalFailureCauseAuthorityV2MigrationErrorFactory(
  factory: MigrationErrorFactory,
): void {
  if (migrationErrorFactory && migrationErrorFactory !== factory) {
    throw new Error("OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_MIGRATION_ERROR_FACTORY_ALREADY_BOUND");
  }
  migrationErrorFactory = factory;
}

function migrationError(
  code: OperationalFailureCauseAuthorityV2MigrationErrorCode,
  message: string,
  cause?: unknown,
): Error {
  return migrationErrorFactory
    ? migrationErrorFactory(code, message, cause)
    : new OperationalFailureCauseAuthorityV2MigrationError(
      code,
      message,
      cause === undefined ? {} : { cause },
    );
}

type PredicateFactory = (input: Readonly<{
  requestedBySql: string;
  causeSql: string;
}>) => string;

type EvidencePredicateFactory = (input: Readonly<{
  requestedBySql: string;
  evidenceSql: string;
  causeSql: string;
}>) => string;

function constraintExpression(
  authorityPredicate: PredicateFactory,
  evidencePredicate: EvidencePredicateFactory,
): string {
  const requestedBySql = "requested_by";
  const evidenceSql = "evidence";
  const causeSql = "evidence->'operationalFailureCause'";
  const authority = authorityPredicate({ requestedBySql, causeSql });
  const evidenceAuthority = evidencePredicate({ requestedBySql, evidenceSql, causeSql });
  return `
       CASE
         WHEN NOT (evidence ? 'operationalFailureCause') THEN TRUE
         WHEN target_status <> 'failed' THEN FALSE
         WHEN jsonb_typeof(evidence->'operationalFailureCause') IS DISTINCT FROM 'object' THEN FALSE
         ELSE
           ((((((evidence->'operationalFailureCause') - 'schema'::text)
             - 'workflowStepId'::text) - 'boundary'::text)
             - 'failureClass'::text) - 'failureCode'::text) = '{}'::jsonb
           AND (evidence->'operationalFailureCause') ?& ARRAY[
             'schema', 'workflowStepId', 'boundary', 'failureClass', 'failureCode'
           ]
           AND jsonb_typeof(evidence->'operationalFailureCause'->'schema') = 'string'
           AND evidence->'operationalFailureCause'->>'schema'
             = 'setfarm.operational-failure-cause.v1'
           AND jsonb_typeof(evidence->'operationalFailureCause'->'workflowStepId') = 'string'
           AND length(evidence->'operationalFailureCause'->>'workflowStepId') BETWEEN 1 AND 100
           AND evidence->'operationalFailureCause'->>'workflowStepId'
             ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
           AND jsonb_typeof(evidence->'operationalFailureCause'->'boundary') = 'string'
           AND length(evidence->'operationalFailureCause'->>'boundary') BETWEEN 1 AND 160
           AND evidence->'operationalFailureCause'->>'boundary'
             ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
           AND jsonb_typeof(evidence->'operationalFailureCause'->'failureClass') = 'string'
           AND evidence->'operationalFailureCause'->>'failureClass' IN (
             'contract_invalid',
             'generated_artifact_invalid',
             'retry_delta_missing',
             'platform_authority_invalid',
             'infrastructure_failure',
             'platform_invariant_failed',
             'recovery_exhausted'
           )
           AND jsonb_typeof(evidence->'operationalFailureCause'->'failureCode') = 'string'
           AND length(evidence->'operationalFailureCause'->>'failureCode') BETWEEN 3 AND 160
           AND evidence->'operationalFailureCause'->>'failureCode'
             ~ '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$'
           AND ${authority}
           AND (${evidenceAuthority}) IS TRUE
       END`;
}

export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V1_CONSTRAINT_EXPRESSION =
  constraintExpression(
    operationalFailureCauseAuthoritySqlPredicateV1,
    operationalFailureCauseEvidenceAuthoritySqlPredicateV1,
  );

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v30-operational-failure-cause-authority-v2:BEGIN
export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT_EXPRESSION =
  constraintExpression(
    operationalFailureCauseAuthoritySqlPredicateV2,
    operationalFailureCauseEvidenceAuthoritySqlPredicateV2,
  );

export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_STATEMENTS = Object.freeze([
  `ALTER TABLE public.run_termination_requests
     DROP CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT}`,
  `ALTER TABLE public.run_termination_requests
     ADD CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT}
     CHECK (${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT_EXPRESSION}) NOT VALID`,
  `ALTER TABLE public.run_termination_requests
     VALIDATE CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT}`,
]);

export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V1_RESTORE_STATEMENTS = Object.freeze([
  `ALTER TABLE public.run_termination_requests
     DROP CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT}`,
  `ALTER TABLE public.run_termination_requests
     ADD CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT}
     CHECK (${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V1_CONSTRAINT_EXPRESSION}) NOT VALID`,
  `ALTER TABLE public.run_termination_requests
     VALIDATE CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT}`,
]);

async function constraintRow(
  sql: Sql | TransactionSql,
): Promise<Readonly<{ validated: boolean; expression: string }> | undefined> {
  const rows = await sql.unsafe<Array<{ validated: boolean; expression: string }>>(
    `SELECT convalidated AS validated,
            pg_get_expr(conbin, conrelid, true) AS expression
       FROM pg_constraint
      WHERE conrelid = to_regclass('public.run_termination_requests')
        AND conname = $1`,
    [OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT],
  );
  return rows[0];
}

export type OperationalFailureCauseAuthorityV2ConstraintIdentity = Readonly<{
  validated: true;
  expression: string;
}>;

export async function readOperationalFailureCauseAuthorityV2ConstraintIdentity(
  sql: Sql | TransactionSql,
): Promise<OperationalFailureCauseAuthorityV2ConstraintIdentity> {
  const row = await constraintRow(sql);
  if (!row?.validated) {
    throw migrationError(
      "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_MISMATCH",
      "operational failure cause authority v2 constraint identity is unavailable",
    );
  }
  return Object.freeze({ validated: true as const, expression: row.expression });
}

export async function canonicalOperationalFailureCauseAuthorityV2ConstraintIdentity(
  sql: Sql | TransactionSql,
): Promise<OperationalFailureCauseAuthorityV2ConstraintIdentity> {
  const expression = await canonicalExpression(
    sql,
    OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT_EXPRESSION,
    "canonical_identity_v2",
  );
  if (!expression) {
    throw migrationError(
      "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_MISMATCH",
      "operational failure cause authority v2 canonical constraint identity is unavailable",
    );
  }
  return Object.freeze({ validated: true as const, expression });
}

export async function assertOperationalFailureCauseAuthorityV2ConstraintIdentity(
  sql: Sql | TransactionSql,
  expected: OperationalFailureCauseAuthorityV2ConstraintIdentity,
): Promise<void> {
  const observed = await readOperationalFailureCauseAuthorityV2ConstraintIdentity(sql);
  if (observed.expression !== expected.expression) {
    throw migrationError(
      "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_MISMATCH",
      "operational failure cause authority v2 constraint changed during audit",
    );
  }
}

async function canonicalExpression(
  sql: Sql | TransactionSql,
  expression: string,
  suffix: string,
): Promise<string | undefined> {
  const inspect = async (connection: Sql | TransactionSql): Promise<string | undefined> => {
    const tableName = `setfarm_operational_failure_cause_v2_${suffix}`;
    const constraintName = `${tableName}_check`;
    await connection.unsafe(`DROP TABLE IF EXISTS pg_temp.${tableName}`);
    try {
      await connection.unsafe(
        `CREATE TEMP TABLE ${tableName} (
           requested_by TEXT NOT NULL,
           target_status TEXT NOT NULL,
           evidence JSONB NOT NULL,
           CONSTRAINT ${constraintName} CHECK (${expression})
         )`,
      );
      const rows = await connection.unsafe<Array<{ expression: string }>>(
        `SELECT pg_get_expr(conbin, conrelid, true) AS expression
           FROM pg_constraint
          WHERE conrelid = to_regclass($1)
            AND conname = $2`,
        [`pg_temp.${tableName}`, constraintName],
      );
      return rows[0]?.expression;
    } finally {
      await connection.unsafe(`DROP TABLE IF EXISTS pg_temp.${tableName}`);
    }
  };
  const root = sql as Sql;
  return typeof root.begin === "function"
    ? root.begin((transaction) => inspect(transaction)) as unknown as Promise<string | undefined>
    : inspect(sql);
}

async function expressionMatches(
  sql: Sql | TransactionSql,
  observed: string,
  expected: string,
  suffix: string,
): Promise<boolean> {
  const canonical = await canonicalExpression(sql, expected, suffix);
  return canonical !== undefined && canonical === observed;
}

export async function detectOperationalFailureCauseAuthorityV2Constraint(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const row = await constraintRow(sql);
  if (!row) return "absent";
  if (!row.validated) return "partial";
  if (await expressionMatches(
    sql,
    row.expression,
    OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT_EXPRESSION,
    "v2",
  )) return "present";
  if (await expressionMatches(
    sql,
    row.expression,
    OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V1_CONSTRAINT_EXPRESSION,
    "v1",
  )) return "absent";
  return "partial";
}

async function verifyBehavior(sql: Sql | TransactionSql): Promise<void> {
  const tableName = "setfarm_operational_failure_cause_v2_behavior";
  await sql.unsafe(`DROP TABLE IF EXISTS pg_temp.${tableName}`);
  try {
    await sql.unsafe(
      `CREATE TEMP TABLE ${tableName} (
         requested_by TEXT NOT NULL,
         target_status TEXT NOT NULL,
         evidence JSONB NOT NULL,
         CONSTRAINT ${tableName}_check
           CHECK (${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT_EXPRESSION})
       )`,
    );
    const designCause = {
      schema: "setfarm.operational-failure-cause.v1",
      workflowStepId: "design",
      boundary: "product_compiler.design_source.semantic_closure",
      failureClass: "contract_invalid",
      failureCode: "DESIGN_SOURCE_SEMANTIC_CLOSURE_REJECTED",
    };
    try {
      await sql.unsafe(
        `INSERT INTO ${tableName} (requested_by, target_status, evidence)
         VALUES ($1, 'failed', jsonb_build_object('operationalFailureCause', $2::text::jsonb))`,
        ["setfarm.step-fail.single", JSON.stringify(designCause)],
      );
    } catch (error) {
      throw migrationError(
        "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_MISMATCH",
        "operational failure cause v2 exact DESIGN probe was rejected",
        error,
      );
    }
  } finally {
    await sql.unsafe(`DROP TABLE IF EXISTS pg_temp.${tableName}`);
  }
}

export async function verifyOperationalFailureCauseAuthorityV2Constraint(
  sql: Sql | TransactionSql,
): Promise<void> {
  try {
    const row = await constraintRow(sql);
    if (
      !row?.validated
      || !await expressionMatches(
        sql,
        row.expression,
        OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT_EXPRESSION,
        "verify_v2",
      )
    ) {
      throw migrationError(
        "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_MISMATCH",
        "operational failure cause authority v2 constraint mismatch",
      );
    }
    await verifyBehavior(sql);
  } catch (error) {
    if (error instanceof OperationalFailureCauseAuthorityV2MigrationError) throw error;
    if (error instanceof Error && error.name === "ContractSpineMigrationError") throw error;
    throw migrationError(
      "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_SQL_FAILED",
      "operational failure cause authority v2 verification failed",
      error,
    );
  }
}
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v30-operational-failure-cause-authority-v2:END
