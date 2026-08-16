import type postgres from "postgres";

import {
  operationalFailureCauseAuthoritySqlPredicateV1,
  operationalFailureCauseEvidenceAuthoritySqlPredicateV1,
} from "../execution/operational-failure-cause-authority-v1.js";
import {
  operationalFailureCauseAuthoritySqlPredicateV2,
  operationalFailureCauseEvidenceAuthoritySqlPredicateV2,
} from "../execution/operational-failure-cause-authority-v2.js";
import {
  operationalFailureCauseAuthoritySqlPredicateV3,
  operationalFailureCauseEvidenceAuthoritySqlPredicateV3,
} from "../execution/operational-failure-cause-authority-v3.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT =
  "run_termination_requests_operational_failure_cause_check" as const;

export type OperationalFailureCauseAuthorityV3MigrationErrorCode =
  | "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_PARTIAL"
  | "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_MISMATCH"
  | "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_SQL_FAILED";

export class OperationalFailureCauseAuthorityV3MigrationError extends Error {
  readonly code: OperationalFailureCauseAuthorityV3MigrationErrorCode;

  constructor(
    code: OperationalFailureCauseAuthorityV3MigrationErrorCode,
    message: string,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "OperationalFailureCauseAuthorityV3MigrationError";
    this.code = code;
  }
}

type MigrationErrorFactory = (
  code: OperationalFailureCauseAuthorityV3MigrationErrorCode,
  message: string,
  cause?: unknown,
) => Error;

let migrationErrorFactory: MigrationErrorFactory | undefined;

export function configureOperationalFailureCauseAuthorityV3MigrationErrorFactory(
  factory: MigrationErrorFactory,
): void {
  if (migrationErrorFactory && migrationErrorFactory !== factory) {
    throw new Error("OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_MIGRATION_ERROR_FACTORY_ALREADY_BOUND");
  }
  migrationErrorFactory = factory;
}

function migrationError(
  code: OperationalFailureCauseAuthorityV3MigrationErrorCode,
  message: string,
  cause?: unknown,
): Error {
  return migrationErrorFactory
    ? migrationErrorFactory(code, message, cause)
    : new OperationalFailureCauseAuthorityV3MigrationError(
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

const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V1_CONSTRAINT_EXPRESSION =
  constraintExpression(
    operationalFailureCauseAuthoritySqlPredicateV1,
    operationalFailureCauseEvidenceAuthoritySqlPredicateV1,
  );

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v31-operational-failure-cause-authority-v3:BEGIN
export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT_EXPRESSION =
  constraintExpression(
    operationalFailureCauseAuthoritySqlPredicateV2,
    operationalFailureCauseEvidenceAuthoritySqlPredicateV2,
  );

export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT_EXPRESSION =
  constraintExpression(
    operationalFailureCauseAuthoritySqlPredicateV3,
    operationalFailureCauseEvidenceAuthoritySqlPredicateV3,
  );

export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_STATEMENTS = Object.freeze([
  `ALTER TABLE public.run_termination_requests
     DROP CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT}`,
  `ALTER TABLE public.run_termination_requests
     ADD CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT}
     CHECK (${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT_EXPRESSION}) NOT VALID`,
  `ALTER TABLE public.run_termination_requests
     VALIDATE CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT}`,
]);

export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_RESTORE_STATEMENTS = Object.freeze([
  `ALTER TABLE public.run_termination_requests
     DROP CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT}`,
  `ALTER TABLE public.run_termination_requests
     ADD CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT}
     CHECK (${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT_EXPRESSION}) NOT VALID`,
  `ALTER TABLE public.run_termination_requests
     VALIDATE CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT}`,
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
    [OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT],
  );
  return rows[0];
}

export type OperationalFailureCauseAuthorityV3ConstraintIdentity = Readonly<{
  validated: true;
  expression: string;
}>;

export async function readOperationalFailureCauseAuthorityV3ConstraintIdentity(
  sql: Sql | TransactionSql,
): Promise<OperationalFailureCauseAuthorityV3ConstraintIdentity> {
  const row = await constraintRow(sql);
  if (!row?.validated) {
    throw migrationError(
      "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_MISMATCH",
      "operational failure cause authority v3 constraint identity is unavailable",
    );
  }
  return Object.freeze({ validated: true as const, expression: row.expression });
}

export async function canonicalOperationalFailureCauseAuthorityV3ConstraintIdentity(
  sql: Sql | TransactionSql,
): Promise<OperationalFailureCauseAuthorityV3ConstraintIdentity> {
  const expression = await canonicalExpression(
    sql,
    OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT_EXPRESSION,
    "canonical_identity_v3",
  );
  if (!expression) {
    throw migrationError(
      "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_MISMATCH",
      "operational failure cause authority v3 canonical constraint identity is unavailable",
    );
  }
  return Object.freeze({ validated: true as const, expression });
}

export async function assertOperationalFailureCauseAuthorityV3ConstraintIdentity(
  sql: Sql | TransactionSql,
  expected: OperationalFailureCauseAuthorityV3ConstraintIdentity,
): Promise<void> {
  const observed = await readOperationalFailureCauseAuthorityV3ConstraintIdentity(sql);
  if (observed.expression !== expected.expression) {
    throw migrationError(
      "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_MISMATCH",
      "operational failure cause authority v3 constraint changed during audit",
      "operational failure cause authority v3 constraint changed during audit",
    );
  }
}

async function canonicalExpression(
  sql: Sql | TransactionSql,
  expression: string,
  suffix: string,
): Promise<string | undefined> {
  const inspect = async (connection: Sql | TransactionSql): Promise<string | undefined> => {
    const tableName = `setfarm_operational_failure_cause_v3_${suffix}`;
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

export async function detectOperationalFailureCauseAuthorityV3Constraint(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const row = await constraintRow(sql);
  if (!row) return "absent";
  if (!row.validated) return "partial";
  if (await expressionMatches(
    sql,
    row.expression,
    OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT_EXPRESSION,
    "v3",
  )) return "present";
  if (await expressionMatches(
    sql,
    row.expression,
    OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V2_CONSTRAINT_EXPRESSION,
    "v2",
  )) return "absent";
  if (await expressionMatches(
    sql,
    row.expression,
    OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V1_CONSTRAINT_EXPRESSION,
    "v1",
  )) return "absent";
  return "partial";
}

const V3_ONLY_CAUSES = Object.freeze([
  "SETUP_PACKET_DESIGN_SOURCE_ATTEMPT_REJECTED",
  "SETUP_PACKET_DESIGN_SOURCE_CLOSURE_REJECTED",
  "SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED",
] as const);

function exactV3Cause(failureCode: string): Readonly<Record<string, string>> {
  return Object.freeze({
    schema: "setfarm.operational-failure-cause.v1",
    workflowStepId: "setup-build",
    boundary: "product_compiler.setup_build_packet",
    failureClass: "contract_invalid",
    failureCode,
  });
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function verifyBehavior(sql: Sql | TransactionSql): Promise<void> {
  const tableName = "setfarm_operational_failure_cause_v3_behavior";
  await sql.unsafe(`DROP TABLE IF EXISTS pg_temp.${tableName}`);
  try {
    await sql.unsafe(
      `CREATE TEMP TABLE ${tableName} (
         requested_by TEXT NOT NULL,
         target_status TEXT NOT NULL,
         evidence JSONB NOT NULL,
         CONSTRAINT ${tableName}_check
           CHECK (${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT_EXPRESSION})
       )`,
    );
    const insert = (requestedBy: string, cause: Readonly<Record<string, string>>) =>
      sql.unsafe(
        `INSERT INTO ${tableName} (requested_by, target_status, evidence)
         VALUES ($1, 'failed', jsonb_build_object('operationalFailureCause', $2::text::jsonb))`,
        [requestedBy, JSON.stringify(cause)],
      );
    for (const failureCode of V3_ONLY_CAUSES) {
      try {
        await insert("setfarm.step-fail.single", exactV3Cause(failureCode));
      } catch (error) {
        throw migrationError(
          "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_MISMATCH",
          `operational failure cause v3 exact ${failureCode} probe was rejected`,
          error,
        );
      }
    }
    for (const [requestedBy, cause] of [
      ["setfarm.step-fail.story", exactV3Cause(V3_ONLY_CAUSES[0])],
      ["setfarm.step-fail.single", { ...exactV3Cause(V3_ONLY_CAUSES[0]), workflowStepId: "design" }],
      ["setfarm.step-fail.single", { ...exactV3Cause(V3_ONLY_CAUSES[0]), boundary: "product_compiler.setup_build_packet_other" }],
      ["setfarm.step-fail.single", { ...exactV3Cause(V3_ONLY_CAUSES[0]), failureClass: "generated_artifact_invalid" }],
      ["setfarm.step-fail.single", { ...exactV3Cause(V3_ONLY_CAUSES[0]), failureCode: `${V3_ONLY_CAUSES[0]}_OTHER` }],
    ] as const) {
      await sql.unsafe(
        `DO $setfarm_v3_negative_probe$
         BEGIN
           BEGIN
             INSERT INTO ${tableName} (requested_by, target_status, evidence)
             VALUES (${sqlLiteral(requestedBy)}, 'failed',
                     jsonb_build_object(
                       'operationalFailureCause',
                       ${sqlLiteral(JSON.stringify(cause))}::jsonb
                     ));
           EXCEPTION WHEN check_violation THEN
             RETURN;
           END;
           RAISE EXCEPTION 'OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_NEGATIVE_PROBE_ADMITTED';
         END
         $setfarm_v3_negative_probe$`,
      );
    }
  } finally {
    await sql.unsafe(`DROP TABLE IF EXISTS pg_temp.${tableName}`);
  }
}

export async function verifyOperationalFailureCauseAuthorityV3Constraint(
  sql: Sql | TransactionSql,
): Promise<void> {
  try {
    const row = await constraintRow(sql);
    if (
      !row?.validated
      || !await expressionMatches(
        sql,
        row.expression,
        OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT_EXPRESSION,
        "verify_v3",
      )
    ) {
      throw migrationError(
        "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_MISMATCH",
        "operational failure cause authority v3 constraint mismatch",
      );
    }
    await verifyBehavior(sql);
  } catch (error) {
    if (error instanceof OperationalFailureCauseAuthorityV3MigrationError) throw error;
    if (error instanceof Error && error.name === "ContractSpineMigrationError") throw error;
    if (
      error instanceof Error
      && error.message.includes(
        "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_NEGATIVE_PROBE_ADMITTED",
      )
    ) {
      throw migrationError(
        "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_MISMATCH",
        "operational failure cause v3 strict-negative probe was admitted",
        error,
      );
    }
    throw migrationError(
      "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_SQL_FAILED",
      "operational failure cause authority v3 verification failed",
      error,
    );
  }
}
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v31-operational-failure-cause-authority-v3:END
