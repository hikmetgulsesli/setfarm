import { createHash } from "node:crypto";

import type postgres from "postgres";

import {
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT_EXPRESSION,
  OperationalFailureCauseAuthorityV3MigrationError,
  readOperationalFailureCauseAuthorityV3ConstraintIdentity,
} from "./operational-failure-cause-authority-v3-migration.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const expectedOperationalFailureCauseAuthorityV3ConstraintSourceHash =
  "98597708b0edec8f32eb1fd7027f821c6d2815472913eeedefeb046c1d546dec";
const expectedOperationalFailureCauseAuthorityV3CanonicalConstraintHash =
  "0b72d87583d2b2556e403cf5a5dc12b177d8bfcb89370815bcd584a190916d0b";
const expectedOperationalFailureCauseAuthorityV3TriggerName =
  "trg_run_termination_requests_operational_failure_cause_immutable".slice(0, 63);
const expectedOperationalFailureCauseAuthorityV3FunctionSourceHash =
  "01306dd989960d1f795ae16d38886dbd36a1abb5f4275722ad4bac4d7e0f383d";

function normalizeCatalogSource(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function verifyOperationalFailureCauseAuthorityV3CatalogV1(
  transaction: Sql | TransactionSql,
): Promise<void> {
  const expectedConstraintExpression =
    OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT_EXPRESSION;
  const expectedConstraintSourceHash = createHash("sha256")
    .update(expectedConstraintExpression)
    .digest("hex");
  if (expectedConstraintSourceHash !== expectedOperationalFailureCauseAuthorityV3ConstraintSourceHash) {
    throw new OperationalFailureCauseAuthorityV3MigrationError(
      "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_MISMATCH",
      "operational failure cause authority v3 source expression identity is invalid",
    );
  }
  const observed = await readOperationalFailureCauseAuthorityV3ConstraintIdentity(transaction);
  const expressionHash = createHash("sha256").update(observed.expression).digest("hex");
  if (
    observed.validated !== true
    || expressionHash !== expectedOperationalFailureCauseAuthorityV3CanonicalConstraintHash
  ) {
    throw new OperationalFailureCauseAuthorityV3MigrationError(
      "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_MISMATCH",
      "operational failure cause authority v3 catalog identity is invalid",
    );
  }
  const sealRows = await transaction.unsafe<Array<{
    triggerName: string;
    enabled: string;
    typeBits: number;
    relationSchema: string;
    relationName: string;
    updateColumns: string[];
    functionSchema: string;
    functionName: string;
    language: string;
    returnType: string;
    volatility: string;
    securityDefiner: boolean;
    leakproof: boolean;
    strict: boolean;
    argumentCount: number;
    configuration: string[];
    functionSource: string;
  }>>(
    `SELECT trigger_row.tgname AS "triggerName",
            trigger_row.tgenabled AS enabled,
            trigger_row.tgtype::integer AS "typeBits",
            relation_namespace.nspname AS "relationSchema",
            relation.relname AS "relationName",
            ARRAY(
              SELECT attribute.attname
                FROM unnest(trigger_row.tgattr::smallint[]) WITH ORDINALITY
                     AS columns(attnum, ordinality)
                JOIN pg_attribute attribute
                  ON attribute.attrelid=trigger_row.tgrelid
                 AND attribute.attnum=columns.attnum
               ORDER BY columns.ordinality
            ) AS "updateColumns",
            function_namespace.nspname AS "functionSchema",
            routine.proname AS "functionName",
            language.lanname AS language,
            routine.prorettype::regtype::text AS "returnType",
            routine.provolatile AS volatility,
            routine.prosecdef AS "securityDefiner",
            routine.proleakproof AS leakproof,
            routine.proisstrict AS strict,
            routine.pronargs::integer AS "argumentCount",
            COALESCE(routine.proconfig, ARRAY[]::text[]) AS configuration,
            routine.prosrc AS "functionSource"
       FROM pg_trigger trigger_row
       JOIN pg_class relation ON relation.oid=trigger_row.tgrelid
       JOIN pg_namespace relation_namespace ON relation_namespace.oid=relation.relnamespace
       JOIN pg_proc routine ON routine.oid=trigger_row.tgfoid
       JOIN pg_namespace function_namespace ON function_namespace.oid=routine.pronamespace
       JOIN pg_language language ON language.oid=routine.prolang
      WHERE NOT trigger_row.tgisinternal
        AND trigger_row.tgname=$1`,
    [expectedOperationalFailureCauseAuthorityV3TriggerName],
  );
  const seal = sealRows[0];
  const functionSourceHash = seal
    ? createHash("sha256").update(normalizeCatalogSource(seal.functionSource)).digest("hex")
    : null;
  if (
    sealRows.length !== 1
    || !seal
    || seal.triggerName !== expectedOperationalFailureCauseAuthorityV3TriggerName
    || seal.enabled !== "O"
    || seal.typeBits !== 19
    || seal.relationSchema !== "public"
    || seal.relationName !== "run_termination_requests"
    || JSON.stringify(seal.updateColumns) !== JSON.stringify(["evidence", "target_status", "requested_by"])
    || seal.functionSchema !== "public"
    || seal.functionName !== "setfarm_enforce_operational_failure_cause_immutable"
    || seal.language !== "plpgsql"
    || seal.returnType !== "trigger"
    || seal.volatility !== "v"
    || seal.securityDefiner !== false
    || seal.leakproof !== false
    || seal.strict !== false
    || seal.argumentCount !== 0
    || seal.configuration.length !== 0
    || functionSourceHash !== expectedOperationalFailureCauseAuthorityV3FunctionSourceHash
  ) {
    throw new OperationalFailureCauseAuthorityV3MigrationError(
      "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_MISMATCH",
      "operational failure cause authority v3 immutability seal identity is invalid",
    );
  }
}
