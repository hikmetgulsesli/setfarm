import type postgres from "postgres";
import { createHash } from "node:crypto";
import { OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT_EXPRESSION,
  detectOperationalFailureCauseAuthorityV3Constraint,
} from "./operational-failure-cause-authority-v3-migration.js";
import { operationalFailureCauseAuthoritySqlPredicateV3 } from "../execution/operational-failure-cause-authority-v3.js";
import { operationalFailureCauseAuthoritySqlPredicateV4 } from "../execution/operational-failure-cause-authority-v4.js";

type Sql = postgres.Sql | postgres.TransactionSql;
const CONSTRAINT = "run_termination_requests_operational_failure_cause_check";
const predicateInput = { requestedBySql: "requested_by", causeSql: "evidence->'operationalFailureCause'" };
const previousPredicate = operationalFailureCauseAuthoritySqlPredicateV3(predicateInput);
const structuralParts = OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_CONSTRAINT_EXPRESSION.split(previousPredicate);
if (structuralParts.length !== 2) throw new Error("OPERATIONAL_FAILURE_CAUSE_V4_PREDECESSOR_SOURCE_INVALID");
export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V4_CONSTRAINT_EXPRESSION =
  structuralParts[0]! + operationalFailureCauseAuthoritySqlPredicateV4(predicateInput) + structuralParts[1]!;
export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V4_STATEMENTS = Object.freeze([
  `ALTER TABLE public.run_termination_requests DROP CONSTRAINT ${CONSTRAINT}`,
  `ALTER TABLE public.run_termination_requests ADD CONSTRAINT ${CONSTRAINT} CHECK (${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V4_CONSTRAINT_EXPRESSION}) NOT VALID`,
  `ALTER TABLE public.run_termination_requests VALIDATE CONSTRAINT ${CONSTRAINT}`,
]);
export class OperationalFailureCauseAuthorityV4MigrationError extends Error {
  readonly code = "MIGRATION_ADOPTION_MISMATCH";
}
function refuse(message: string): never { throw new OperationalFailureCauseAuthorityV4MigrationError(message); }
async function row(sql: Sql) {
  const rows = await sql.unsafe<Array<{ validated: boolean; expression: string }>>(
    `SELECT convalidated AS validated, pg_get_expr(conbin,conrelid,true) AS expression
     FROM pg_constraint WHERE conrelid=to_regclass('public.run_termination_requests') AND conname=$1`, [CONSTRAINT]);
  if (rows.length > 1) refuse("OPERATIONAL_FAILURE_CAUSE_V4_DUPLICATE_CONSTRAINT");
  return rows[0];
}
async function canonicalExpression(sql: Sql): Promise<string> {
  const inspect = async (tx: postgres.TransactionSql) => {
    const name = "setfarm_operational_failure_cause_v4_identity";
    await tx.unsafe(`CREATE TEMP TABLE ${name} (requested_by TEXT NOT NULL,target_status TEXT NOT NULL,evidence JSONB NOT NULL,
      CHECK (${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V4_CONSTRAINT_EXPRESSION}))`);
    try {
      const rows = await tx.unsafe<Array<{ expression: string }>>(
        "SELECT pg_get_expr(conbin,conrelid,true) AS expression FROM pg_constraint WHERE conrelid=to_regclass($1)", [`pg_temp.${name}`]);
      if (rows.length !== 1 || !rows[0]?.expression) refuse("OPERATIONAL_FAILURE_CAUSE_V4_CANONICAL_IDENTITY_INVALID");
      return rows[0]!.expression;
    } finally { await tx.unsafe(`DROP TABLE pg_temp.${name}`); }
  };
  return typeof (sql as postgres.Sql).begin === "function"
    ? (sql as postgres.Sql).begin(tx => inspect(tx)) as unknown as Promise<string>
    : inspect(sql as postgres.TransactionSql);
}
export async function detectOperationalFailureCauseAuthorityV4Constraint(sql: Sql): Promise<"absent" | "present" | "partial"> {
  const actual = await row(sql);
  if (!actual) return "absent";
  if (!actual.validated) return "partial";
  if (actual.expression === await canonicalExpression(sql)) return "present";
  if (await detectOperationalFailureCauseAuthorityV3Constraint(sql) !== "partial") return "absent";
  return "partial";
}

/** Same immutable trigger/function as V3; only the CHECK authority evolves. */
export async function verifyOperationalFailureCauseAuthorityV4Seal(sql: Sql): Promise<void> {
  const rows = await sql.unsafe<Array<{ definition: string; source: string; enabled: string;
    type_bits: number; columns: string[]; function_schema: string; function_name: string;
    language: string; return_type: string; volatility: string; security_definer: boolean;
    leakproof: boolean; strict: boolean; argument_count: number; configuration: string[] }>>(`
    SELECT pg_get_triggerdef(t.oid,true) AS definition,p.prosrc AS source,t.tgenabled AS enabled,
      t.tgtype::integer AS type_bits,ARRAY(SELECT a.attname FROM unnest(t.tgattr::smallint[]) WITH ORDINALITY x(attnum,n)
      JOIN pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=x.attnum ORDER BY x.n) AS columns,
      pn.nspname AS function_schema,p.proname AS function_name,l.lanname AS language,
      p.prorettype::regtype::text AS return_type,p.provolatile AS volatility,p.prosecdef AS security_definer,
      p.proleakproof AS leakproof,p.proisstrict AS strict,p.pronargs::integer AS argument_count,
      COALESCE(p.proconfig,ARRAY[]::text[]) AS configuration
    FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace
      JOIN pg_language l ON l.oid=p.prolang WHERE NOT t.tgisinternal
      AND t.tgrelid=to_regclass('public.run_termination_requests') ORDER BY t.tgname`);
  const r = rows[0];
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  if (rows.length !== 1 || !r || r.enabled !== "O" || r.type_bits !== 19
    || JSON.stringify(r.columns) !== JSON.stringify(["evidence","target_status","requested_by"])
    || r.function_schema !== "public" || r.function_name !== "setfarm_enforce_operational_failure_cause_immutable"
    || r.language !== "plpgsql" || r.return_type !== "trigger" || r.volatility !== "v"
    || r.security_definer !== false || r.leakproof !== false || r.strict !== false
    || r.argument_count !== 0 || r.configuration.length !== 0
    || hash(r.definition.trim().replace(/\s+/g," ").toLowerCase()) !== "d02b5e95eb2cf5668228415fee74a8d3ad0a8a960906e66b584e0fea01e8396a"
    || hash(r.source.trim().replace(/\r\n?/g,"\n")) !== "7e10ffacda335b3e87f65e6fb7a5e95b8f59ac450294b1f3298f1063f1791f2f") {
    refuse("OPERATIONAL_FAILURE_CAUSE_V4_IMMUTABLE_SEAL_MISMATCH");
  }
}
export async function verifyOperationalFailureCauseAuthorityV4Constraint(sql: Sql): Promise<void> {
  if (await detectOperationalFailureCauseAuthorityV4Constraint(sql) !== "present") refuse("OPERATIONAL_FAILURE_CAUSE_V4_CONSTRAINT_MISMATCH");
  await verifyOperationalFailureCauseAuthorityV4Seal(sql);
  const exact = { schema: "setfarm.operational-failure-cause.v1", workflowStepId: "design",
    boundary: "product_compiler.design_source.artifact_download", failureClass: "infrastructure_failure",
    failureCode: "STITCH_MCP_ARTIFACT_RETRIEVAL_FAILED" };
  const cases = [
    { requester: "setfarm.step-fail.single", cause: exact, expected: true },
    { requester: "setfarm.step-ops.stories-completeness", cause: exact, expected: false },
    ...[{ workflowStepId: "setup-build" }, { boundary: "product_compiler.design_source.resource_prefetch" },
      { failureClass: "contract_invalid" }, { failureCode: "STITCH_MCP_ARTIFACT_RETRIEVAL_FAILED_OTHER" },
      { diagnostic: "not canonical cause identity" }].map(change => ({ requester: "setfarm.step-fail.single",
        cause: { ...exact, ...change }, expected: false })),
  ];
  for (const item of cases) {
    const result = await sql.unsafe<Array<{ accepted: boolean }>>(`SELECT (${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V4_CONSTRAINT_EXPRESSION}) IS TRUE AS accepted
      FROM (SELECT $1::text AS requested_by,'failed'::text AS target_status,jsonb_build_object('operationalFailureCause',$2::jsonb) AS evidence) candidate`,
      [item.requester, JSON.stringify(item.cause)]);
    if (result.length !== 1 || result[0]?.accepted !== item.expected) refuse("OPERATIONAL_FAILURE_CAUSE_V4_BEHAVIOR_MISMATCH");
  }
}
