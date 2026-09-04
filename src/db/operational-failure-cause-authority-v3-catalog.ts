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
}
