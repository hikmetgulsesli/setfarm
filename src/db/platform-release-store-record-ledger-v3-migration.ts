import type postgres from "postgres";

import {
  PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_MAX_CANONICAL_BYTES_V3,
  PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_SCHEMA,
  parsePlatformReleaseContentStoreDurableRecordTestCandidateV3,
  type PlatformReleaseContentStoreDurableRecordTestV3,
} from "../execution/schemas/platform-release-content-store-durable-record-test-v3.js";
import {
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_ATTESTATIONS_V3,
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3,
  assertPlatformReleaseContentStoreAppendOnlySupersetV3,
  type PlatformReleaseContentStoreGlobalCensusV3,
} from "../execution/schemas/platform-release-content-store-census-v3.js";
import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v27-platform-release-store-record-ledger:BEGIN
export const PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE =
  "platform_release_store_records_v3" as const;
export const PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION =
  "setfarm_enforce_platform_release_store_record_v3" as const;
export const PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_GUARD_TRIGGER =
  "trg_platform_release_store_records_v3_guard" as const;
export const PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TRUNCATE_TRIGGER =
  "trg_platform_release_store_records_v3_no_truncate" as const;
export const PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_ADVISORY_LOCK_KEYS =
  Object.freeze([1_397_117_251, 27] as const);
export const PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_INSTALL_ADVISORY_LOCK_KEYS =
  Object.freeze([1_397_117_251, 127] as const);

export type PlatformReleaseStoreRecordLedgerV3MigrationErrorCode =
  | "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_PARTIAL"
  | "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TOPOLOGY_INVALID"
  | "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_ADOPTION_REQUIRES_EMPTY"
  | "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_DATA_INVALID"
  | "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_SQL_FAILED";

const MAX_DIAGNOSTIC_BYTES = 1_000;

function boundedDiagnostic(message: string): string {
  const bytes = Buffer.from(message, "utf8");
  if (bytes.byteLength <= MAX_DIAGNOSTIC_BYTES) return message;
  return `${bytes.subarray(0, MAX_DIAGNOSTIC_BYTES - 3).toString("utf8")}...`;
}

function boundedIdentity(value: unknown): string {
  return String(value ?? "missing")
    .replace(/[^A-Za-z0-9_.:-]/gu, "_")
    .slice(0, 96);
}

export class PlatformReleaseStoreRecordLedgerV3MigrationError extends Error {
  readonly code: PlatformReleaseStoreRecordLedgerV3MigrationErrorCode;

  constructor(
    code: PlatformReleaseStoreRecordLedgerV3MigrationErrorCode,
    message: string,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(boundedDiagnostic(message), options.cause === undefined
      ? undefined
      : { cause: options.cause });
    this.name = "PlatformReleaseStoreRecordLedgerV3MigrationError";
    this.code = code;
  }
}

type PlatformReleaseStoreRecordLedgerV3MigrationErrorFactory = (
  code: PlatformReleaseStoreRecordLedgerV3MigrationErrorCode,
  message: string,
  cause?: unknown,
) => Error;

let migrationErrorFactory:
  PlatformReleaseStoreRecordLedgerV3MigrationErrorFactory | undefined;
const issuedMigrationErrors = new WeakSet<Error>();

export function configurePlatformReleaseStoreRecordLedgerV3MigrationErrorFactory(
  factory: PlatformReleaseStoreRecordLedgerV3MigrationErrorFactory,
): void {
  if (migrationErrorFactory && migrationErrorFactory !== factory) {
    throw new Error(
      "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_MIGRATION_ERROR_FACTORY_ALREADY_BOUND",
    );
  }
  migrationErrorFactory = factory;
}

function migrationError(
  code: PlatformReleaseStoreRecordLedgerV3MigrationErrorCode,
  message: string,
  cause?: unknown,
): Error {
  const error = migrationErrorFactory
    ? migrationErrorFactory(code, message, cause)
    : new PlatformReleaseStoreRecordLedgerV3MigrationError(
      code,
      message,
      cause === undefined ? {} : { cause },
    );
  issuedMigrationErrors.add(error);
  return error;
}

function isIssuedMigrationError(value: unknown): value is Error {
  return value instanceof Error && issuedMigrationErrors.has(value);
}

const HASH_PATTERN_SQL = "^[a-f0-9]{64}$";
const REMAINING_BLOCKERS_JSON = JSON.stringify([
  "production_store_bootstrap_absent",
  "authenticated_content_lease_absent",
  "authenticated_attestation_lease_absent",
  "authenticated_global_census_absent",
  "production_publisher_preflight_absent",
  "atomic_conditional_unlink_absent",
  "crash_replay_ledger_absent",
  "whole_content_root_atomic_rename_absent",
  "authenticated_restart_rejoin_absent",
  "canonical_release_payload_layout_absent",
  "b5d_composer_bridge_absent",
  "runtime_payload_unbound",
  "fresh_production_verifier_absent",
]);
const RECORD_TOP_LEVEL_KEYS_SQL = [
  "schema",
  "version",
  "admissionScope",
  "authorityState",
  "productionAuthority",
  "productionAdmission",
  "credentialUse",
  "signingAuthority",
  "mutationAuthority",
  "storeAuthority",
  "restartAuthority",
  "preparedPlatformReleaseIssued",
  "serializedValueAuthority",
  "trustConclusion",
  "persistenceScope",
  "closedProductionBlocker",
  "remainingProductionBlockers",
  "recordOrdinal",
  "priorRecordHash",
  "preflight",
  "leafReceipt",
  "recordHash",
].map((key) => `'${key}'`).join(", ");

export const PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION_BODY_SQL = `
  DECLARE
    tail_ordinal SMALLINT;
    tail_hash TEXT;
  BEGIN
    IF TG_OP = 'INSERT' THEN
      PERFORM pg_advisory_xact_lock(
        ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_ADVISORY_LOCK_KEYS[0]},
        ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_ADVISORY_LOCK_KEYS[1]}
      );
      SELECT record_ordinal, record_hash
        INTO tail_ordinal, tail_hash
        FROM public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}
       ORDER BY record_ordinal DESC
       LIMIT 1;
      IF tail_ordinal IS NULL THEN
        IF NEW.record_ordinal IS DISTINCT FROM 0
           OR NEW.prior_record_hash IS NOT NULL THEN
          RAISE EXCEPTION 'PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_GENESIS_MISMATCH'
            USING ERRCODE = '23514';
        END IF;
      ELSIF NEW.record_ordinal IS DISTINCT FROM tail_ordinal + 1
         OR NEW.prior_record_hash IS DISTINCT FROM tail_hash THEN
        RAISE EXCEPTION 'PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TAIL_MISMATCH'
          USING ERRCODE = '23514';
      END IF;
      NEW.recorded_at := clock_timestamp();
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_IMMUTABLE'
      USING ERRCODE = '23514';
  END;
`;

export const PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_STATEMENTS = Object.freeze([
  `CREATE TABLE public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE} (
     record_hash TEXT COLLATE "C" NOT NULL,
     record_schema TEXT COLLATE "C" NOT NULL,
     record_version TEXT COLLATE "C" NOT NULL,
     admission_scope TEXT COLLATE "C" NOT NULL,
     production_authority BOOLEAN NOT NULL,
     production_admission TEXT COLLATE "C" NOT NULL,
     record_ordinal SMALLINT NOT NULL,
     prior_record_hash TEXT COLLATE "C",
     host_identity_hash TEXT COLLATE "C" NOT NULL,
     manifest_payload_hash TEXT COLLATE "C" NOT NULL,
     attestation_hash TEXT COLLATE "C" NOT NULL,
     release_content_hash TEXT COLLATE "C" NOT NULL,
     candidate_hash TEXT COLLATE "C" NOT NULL,
     preflight_hash TEXT COLLATE "C" NOT NULL,
     leaf_receipt_hash TEXT COLLATE "C" NOT NULL,
     published_census_hash TEXT COLLATE "C" NOT NULL,
     manifest_byte_length INTEGER NOT NULL,
     attestation_byte_length INTEGER NOT NULL,
     publication TEXT COLLATE "C" NOT NULL,
     record_payload JSONB NOT NULL,
     recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT platform_release_store_records_v3_pkey
       PRIMARY KEY (record_hash),
     CONSTRAINT platform_release_store_records_v3_ordinal_unique
       UNIQUE (record_ordinal),
     CONSTRAINT platform_release_store_records_v3_prior_unique
       UNIQUE (prior_record_hash),
     CONSTRAINT platform_release_store_records_v3_attestation_unique
       UNIQUE (attestation_hash),
     CONSTRAINT platform_release_store_records_v3_candidate_unique
       UNIQUE (candidate_hash),
     CONSTRAINT platform_release_store_records_v3_preflight_unique
       UNIQUE (preflight_hash),
     CONSTRAINT platform_release_store_records_v3_leaf_receipt_unique
       UNIQUE (leaf_receipt_hash),
     CONSTRAINT platform_release_store_records_v3_published_census_unique
       UNIQUE (published_census_hash),
     CONSTRAINT platform_release_store_records_v3_prior_fkey
       FOREIGN KEY (prior_record_hash)
       REFERENCES public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}(record_hash)
       ON UPDATE RESTRICT ON DELETE RESTRICT,
     CONSTRAINT platform_release_store_records_v3_schema_check
       CHECK (
         record_schema = '${PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_SCHEMA}'
         AND record_version = '3.0.0'
         AND admission_scope = 'test_fixture'
       ),
     CONSTRAINT platform_release_store_records_v3_false_authority_check
       CHECK (
         production_authority = FALSE
         AND production_admission = 'forbidden'
         AND publication = 'published'
       ),
     CONSTRAINT platform_release_store_records_v3_hashes_check
       CHECK (
         record_hash ~ '${HASH_PATTERN_SQL}'
         AND (prior_record_hash ~ '${HASH_PATTERN_SQL}' OR prior_record_hash IS NULL)
       ),
     CONSTRAINT platform_release_store_records_v3_identity_hashes_check
       CHECK (
         host_identity_hash ~ '${HASH_PATTERN_SQL}'
         AND manifest_payload_hash ~ '${HASH_PATTERN_SQL}'
         AND attestation_hash ~ '${HASH_PATTERN_SQL}'
         AND release_content_hash ~ '${HASH_PATTERN_SQL}'
         AND candidate_hash ~ '${HASH_PATTERN_SQL}'
         AND preflight_hash ~ '${HASH_PATTERN_SQL}'
         AND leaf_receipt_hash ~ '${HASH_PATTERN_SQL}'
         AND published_census_hash ~ '${HASH_PATTERN_SQL}'
       ),
     CONSTRAINT platform_release_store_records_v3_ordinal_check
       CHECK (
         record_ordinal >= 0 AND record_ordinal <= 255
         AND ((record_ordinal = 0) = (prior_record_hash IS NULL))
       ),
     CONSTRAINT platform_release_store_records_v3_release_join_check
       CHECK (release_content_hash = manifest_payload_hash),
     CONSTRAINT platform_release_store_records_v3_bytes_check
       CHECK (
         manifest_byte_length >= 1
         AND manifest_byte_length <= ${PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3}
         AND attestation_byte_length >= 1
         AND attestation_byte_length <= ${PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3}
         AND manifest_byte_length + attestation_byte_length <= ${2 * PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3}
       ),
     CONSTRAINT platform_release_store_records_v3_payload_shape_check
       CHECK (
         jsonb_typeof(record_payload) = 'object'
         AND record_payload ?& ARRAY[${RECORD_TOP_LEVEL_KEYS_SQL}]
         AND record_payload - ARRAY[${RECORD_TOP_LEVEL_KEYS_SQL}] = '{}'::jsonb
         AND octet_length(record_payload::text) >= 2
         AND octet_length(record_payload::text)
              <= ${PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_MAX_CANONICAL_BYTES_V3}
       ),
     CONSTRAINT platform_release_store_records_v3_payload_authority_check
       CHECK (
         record_payload ->> 'schema' = record_schema
         AND record_payload ->> 'version' = record_version
         AND record_payload ->> 'admissionScope' = admission_scope
         AND record_payload ->> 'authorityState' = 'durable_database_record_test_fixture_unverified'
         AND record_payload ->> 'productionAuthority' = 'false'
         AND record_payload ->> 'productionAdmission' = production_admission
         AND record_payload ->> 'credentialUse' = 'none'
         AND record_payload ->> 'signingAuthority' = 'unsigned_test_fixture'
         AND record_payload ->> 'mutationAuthority' = 'false'
         AND record_payload ->> 'storeAuthority' = 'false'
         AND record_payload ->> 'restartAuthority' = 'false'
         AND record_payload ->> 'preparedPlatformReleaseIssued' = 'false'
         AND record_payload ->> 'serializedValueAuthority' = 'false'
         AND record_payload ->> 'trustConclusion' = 'characterization_only'
         AND record_payload ->> 'persistenceScope' = 'exact_database_occurrence_required'
         AND record_payload ->> 'closedProductionBlocker' = 'durable_release_store_records_absent'
         AND record_payload -> 'remainingProductionBlockers' = '${REMAINING_BLOCKERS_JSON}'::jsonb
       ),
     CONSTRAINT platform_release_store_records_v3_payload_projection_check
       CHECK (
         record_payload ->> 'recordHash' = record_hash
         AND (record_payload ->> 'recordOrdinal')::smallint = record_ordinal
         AND record_payload ->> 'priorRecordHash' IS NOT DISTINCT FROM prior_record_hash
         AND record_payload #>> '{preflight,productionAuthority}' = 'false'
         AND record_payload #>> '{preflight,productionAdmission}' = 'forbidden'
         AND record_payload #>> '{preflight,mutationAuthority}' = 'false'
         AND record_payload #>> '{leafReceipt,productionAuthority}' = 'false'
         AND record_payload #>> '{leafReceipt,productionAdmission}' = 'forbidden'
         AND record_payload #>> '{leafReceipt,mutationAuthority}' = 'false'
         AND record_payload #>> '{preflight,candidateFinalCensus,hostIdentityHash}' = host_identity_hash
         AND record_payload #>> '{leafReceipt,publishedCensus,hostIdentityHash}' = host_identity_hash
         AND record_payload #>> '{preflight,candidate,manifestPayloadHash}' = manifest_payload_hash
         AND record_payload #>> '{leafReceipt,leaf,manifestPayloadHash}' = manifest_payload_hash
         AND record_payload #>> '{preflight,candidate,attestationHash}' = attestation_hash
         AND record_payload #>> '{leafReceipt,leaf,attestationHash}' = attestation_hash
         AND record_payload #>> '{preflight,candidate,releaseContentHash}' = release_content_hash
         AND record_payload #>> '{leafReceipt,leaf,releaseContentHash}' = release_content_hash
         AND record_payload #>> '{preflight,candidate,candidateHash}' = candidate_hash
         AND record_payload #>> '{leafReceipt,leaf,candidateHash}' = candidate_hash
         AND record_payload #>> '{preflight,preflightHash}' = preflight_hash
         AND record_payload #>> '{leafReceipt,preflightHash}' = preflight_hash
         AND record_payload #>> '{leafReceipt,receiptHash}' = leaf_receipt_hash
         AND record_payload #>> '{preflight,expectedFinalCensusHash}' = published_census_hash
         AND record_payload #>> '{leafReceipt,publishedCensusHash}' = published_census_hash
         AND (record_payload #>> '{preflight,candidate,manifestByteLength}')::integer = manifest_byte_length
         AND (record_payload #>> '{leafReceipt,leaf,manifestByteLength}')::integer = manifest_byte_length
         AND (record_payload #>> '{preflight,candidate,attestationByteLength}')::integer = attestation_byte_length
         AND (record_payload #>> '{leafReceipt,leaf,attestationByteLength}')::integer = attestation_byte_length
         AND record_payload #>> '{leafReceipt,publication}' = publication
       )
   )`,
  `CREATE FUNCTION public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION}()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path TO pg_catalog, public
   AS $$${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION_BODY_SQL}$$`,
  `REVOKE ALL ON TABLE public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}
     FROM PUBLIC`,
  `REVOKE ALL ON FUNCTION public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION}()
     FROM PUBLIC`,
  `CREATE TRIGGER ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_GUARD_TRIGGER}
     BEFORE INSERT OR UPDATE OR DELETE
     ON public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}
     FOR EACH ROW
     EXECUTE FUNCTION public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION}()`,
  `CREATE TRIGGER ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TRUNCATE_TRIGGER}
     BEFORE TRUNCATE
     ON public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}
     FOR EACH STATEMENT
     EXECUTE FUNCTION public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION}()`,
] as const);

function sqlDollarQuoteDelimiterAt(value: string, index: number): string | undefined {
  const match = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/u.exec(value.slice(index));
  return match?.[0];
}

function sqlQuotedTokenAt(
  value: string,
  index: number,
): Readonly<{ token: string; nextIndex: number }> | undefined {
  const quote = value[index];
  if (quote === "'" || quote === '"') {
    let cursor = index + 1;
    while (cursor < value.length) {
      if (value[cursor] === quote) {
        if (value[cursor + 1] === quote) {
          cursor += 2;
          continue;
        }
        cursor += 1;
        break;
      }
      if (quote === "'" && value[cursor] === "\\" && cursor + 1 < value.length) {
        cursor += 2;
        continue;
      }
      cursor += 1;
    }
    return Object.freeze({ token: value.slice(index, cursor), nextIndex: cursor });
  }
  if (quote !== "$") return undefined;
  const delimiter = sqlDollarQuoteDelimiterAt(value, index);
  if (!delimiter) return undefined;
  const end = value.indexOf(delimiter, index + delimiter.length);
  const nextIndex = end < 0 ? value.length : end + delimiter.length;
  return Object.freeze({ token: value.slice(index, nextIndex), nextIndex });
}

function normalizeSql(value: string): string {
  let normalized = "";
  let pendingSpace = false;
  const punctuation = /[()[\],]/u;
  const identifierPart = /[A-Za-z0-9_$]/u;
  const appendPendingSpace = (): void => {
    if (
      pendingSpace
      && normalized.length > 0
      && !punctuation.test(normalized[normalized.length - 1]!)
    ) {
      normalized += " ";
    }
    pendingSpace = false;
  };
  for (let index = 0; index < value.length;) {
    if (value.startsWith("--", index)) {
      const end = value.indexOf("\n", index + 2);
      index = end < 0 ? value.length : end + 1;
      pendingSpace = true;
      continue;
    }
    if (value.startsWith("/*", index)) {
      let cursor = index + 2;
      let depth = 1;
      while (cursor < value.length && depth > 0) {
        if (value.startsWith("/*", cursor)) {
          depth += 1;
          cursor += 2;
        } else if (value.startsWith("*/", cursor)) {
          depth -= 1;
          cursor += 2;
        } else {
          cursor += 1;
        }
      }
      index = cursor;
      pendingSpace = true;
      continue;
    }
    const quoted = sqlQuotedTokenAt(value, index);
    if (quoted) {
      appendPendingSpace();
      normalized += quoted.token;
      index = quoted.nextIndex;
      continue;
    }
    const character = value[index]!;
    if (/\s/u.test(character)) {
      pendingSpace = true;
      index += 1;
      continue;
    }
    if (
      value.slice(index, index + 7).toLowerCase() === "public."
      && (index === 0 || !identifierPart.test(value[index - 1]!))
    ) {
      index += 7;
      continue;
    }
    if (punctuation.test(character)) {
      if (normalized.endsWith(" ")) normalized = normalized.slice(0, -1);
      normalized += character.toLowerCase();
      pendingSpace = false;
      index += 1;
      continue;
    }
    appendPendingSpace();
    normalized += character.toLowerCase();
    index += 1;
  }
  return normalized.trim();
}

async function relationExists(
  sql: Sql | TransactionSql,
  relation: string,
): Promise<boolean> {
  const rows = await sql.unsafe<Array<{ relation: string | null }>>(
    "SELECT to_regclass($1)::text AS relation",
    [`public.${relation}`],
  );
  return rows[0]?.relation === relation
    || rows[0]?.relation === `public.${relation}`;
}

export type PlatformReleaseStoreRecordLedgerV3Detection =
  "absent" | "present" | "partial";

export async function detectPlatformReleaseStoreRecordLedgerV3(
  sql: Sql | TransactionSql,
): Promise<PlatformReleaseStoreRecordLedgerV3Detection> {
  const relation = await relationExists(
    sql,
    PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE,
  );
  const functions = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = $1`,
    [PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION],
  );
  const triggers = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count
       FROM pg_trigger t
      WHERE NOT t.tgisinternal
        AND t.tgname = ANY($1::text[])`,
    [[
      PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_GUARD_TRIGGER,
      PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TRUNCATE_TRIGGER,
    ]],
  );
  const relationCount = Number(relation);
  const functionCount = functions[0]?.count ?? 0;
  const triggerCount = triggers[0]?.count ?? 0;
  if (relationCount === 0 && functionCount === 0 && triggerCount === 0) {
    return "absent";
  }
  if (relationCount === 1 && functionCount === 1 && triggerCount === 2) {
    return "present";
  }
  return "partial";
}

export type PlatformReleaseStoreRecordLedgerV3ExpectedColumn = Readonly<{
  name: string;
  position: number;
  dataType: string;
  nullable: "YES" | "NO";
  defaultValue: string;
  collationSchema: string | null;
  collationName: string | null;
  udtSchema: "pg_catalog";
  udtName: string;
  domainSchema: null;
  domainName: null;
  isIdentity: "NO";
  isGenerated: "NEVER";
}>;

const cText = (name: string, position: number, nullable: "YES" | "NO" = "NO") =>
  Object.freeze({
    name,
    position,
    dataType: "text",
    nullable,
    defaultValue: "",
    collationSchema: "pg_catalog",
    collationName: "C",
    udtSchema: "pg_catalog" as const,
    udtName: "text",
    domainSchema: null,
    domainName: null,
    isIdentity: "NO" as const,
    isGenerated: "NEVER" as const,
  });

export const PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_COLUMNS = Object.freeze([
  cText("record_hash", 1),
  cText("record_schema", 2),
  cText("record_version", 3),
  cText("admission_scope", 4),
  Object.freeze({ name: "production_authority", position: 5, dataType: "boolean", nullable: "NO" as const, defaultValue: "", collationSchema: null, collationName: null, udtSchema: "pg_catalog" as const, udtName: "bool", domainSchema: null, domainName: null, isIdentity: "NO" as const, isGenerated: "NEVER" as const }),
  cText("production_admission", 6),
  Object.freeze({ name: "record_ordinal", position: 7, dataType: "smallint", nullable: "NO" as const, defaultValue: "", collationSchema: null, collationName: null, udtSchema: "pg_catalog" as const, udtName: "int2", domainSchema: null, domainName: null, isIdentity: "NO" as const, isGenerated: "NEVER" as const }),
  cText("prior_record_hash", 8, "YES"),
  cText("host_identity_hash", 9),
  cText("manifest_payload_hash", 10),
  cText("attestation_hash", 11),
  cText("release_content_hash", 12),
  cText("candidate_hash", 13),
  cText("preflight_hash", 14),
  cText("leaf_receipt_hash", 15),
  cText("published_census_hash", 16),
  Object.freeze({ name: "manifest_byte_length", position: 17, dataType: "integer", nullable: "NO" as const, defaultValue: "", collationSchema: null, collationName: null, udtSchema: "pg_catalog" as const, udtName: "int4", domainSchema: null, domainName: null, isIdentity: "NO" as const, isGenerated: "NEVER" as const }),
  Object.freeze({ name: "attestation_byte_length", position: 18, dataType: "integer", nullable: "NO" as const, defaultValue: "", collationSchema: null, collationName: null, udtSchema: "pg_catalog" as const, udtName: "int4", domainSchema: null, domainName: null, isIdentity: "NO" as const, isGenerated: "NEVER" as const }),
  cText("publication", 19),
  Object.freeze({ name: "record_payload", position: 20, dataType: "jsonb", nullable: "NO" as const, defaultValue: "", collationSchema: null, collationName: null, udtSchema: "pg_catalog" as const, udtName: "jsonb", domainSchema: null, domainName: null, isIdentity: "NO" as const, isGenerated: "NEVER" as const }),
  Object.freeze({ name: "recorded_at", position: 21, dataType: "timestamp with time zone", nullable: "NO" as const, defaultValue: "now()", collationSchema: null, collationName: null, udtSchema: "pg_catalog" as const, udtName: "timestamptz", domainSchema: null, domainName: null, isIdentity: "NO" as const, isGenerated: "NEVER" as const }),
] satisfies readonly PlatformReleaseStoreRecordLedgerV3ExpectedColumn[]);

const EXPECTED_CONSTRAINT_NAMES = Object.freeze([
  "platform_release_store_records_v3_pkey",
  "platform_release_store_records_v3_ordinal_unique",
  "platform_release_store_records_v3_prior_unique",
  "platform_release_store_records_v3_attestation_unique",
  "platform_release_store_records_v3_candidate_unique",
  "platform_release_store_records_v3_preflight_unique",
  "platform_release_store_records_v3_leaf_receipt_unique",
  "platform_release_store_records_v3_published_census_unique",
  "platform_release_store_records_v3_prior_fkey",
  "platform_release_store_records_v3_schema_check",
  "platform_release_store_records_v3_false_authority_check",
  "platform_release_store_records_v3_hashes_check",
  "platform_release_store_records_v3_identity_hashes_check",
  "platform_release_store_records_v3_ordinal_check",
  "platform_release_store_records_v3_release_join_check",
  "platform_release_store_records_v3_bytes_check",
  "platform_release_store_records_v3_payload_shape_check",
  "platform_release_store_records_v3_payload_authority_check",
  "platform_release_store_records_v3_payload_projection_check",
] as const);

const EXPECTED_INDEX_NAMES = Object.freeze([
  "platform_release_store_records_v3_pkey",
  "platform_release_store_records_v3_ordinal_unique",
  "platform_release_store_records_v3_prior_unique",
  "platform_release_store_records_v3_attestation_unique",
  "platform_release_store_records_v3_candidate_unique",
  "platform_release_store_records_v3_preflight_unique",
  "platform_release_store_records_v3_leaf_receipt_unique",
  "platform_release_store_records_v3_published_census_unique",
] as const);

export const PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_INDEXES =
  Object.freeze({
    platform_release_store_records_v3_pkey:
      "CREATE UNIQUE INDEX platform_release_store_records_v3_pkey ON public.platform_release_store_records_v3 USING btree (record_hash)",
    platform_release_store_records_v3_ordinal_unique:
      "CREATE UNIQUE INDEX platform_release_store_records_v3_ordinal_unique ON public.platform_release_store_records_v3 USING btree (record_ordinal)",
    platform_release_store_records_v3_prior_unique:
      "CREATE UNIQUE INDEX platform_release_store_records_v3_prior_unique ON public.platform_release_store_records_v3 USING btree (prior_record_hash)",
    platform_release_store_records_v3_attestation_unique:
      "CREATE UNIQUE INDEX platform_release_store_records_v3_attestation_unique ON public.platform_release_store_records_v3 USING btree (attestation_hash)",
    platform_release_store_records_v3_candidate_unique:
      "CREATE UNIQUE INDEX platform_release_store_records_v3_candidate_unique ON public.platform_release_store_records_v3 USING btree (candidate_hash)",
    platform_release_store_records_v3_preflight_unique:
      "CREATE UNIQUE INDEX platform_release_store_records_v3_preflight_unique ON public.platform_release_store_records_v3 USING btree (preflight_hash)",
    platform_release_store_records_v3_leaf_receipt_unique:
      "CREATE UNIQUE INDEX platform_release_store_records_v3_leaf_receipt_unique ON public.platform_release_store_records_v3 USING btree (leaf_receipt_hash)",
    platform_release_store_records_v3_published_census_unique:
      "CREATE UNIQUE INDEX platform_release_store_records_v3_published_census_unique ON public.platform_release_store_records_v3 USING btree (published_census_hash)",
  } satisfies Readonly<Record<typeof EXPECTED_INDEX_NAMES[number], string>>);

export const PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_CONSTRAINTS =
  Object.freeze({
    platform_release_store_records_v3_pkey:
      "PRIMARY KEY (record_hash)",
    platform_release_store_records_v3_ordinal_unique:
      "UNIQUE (record_ordinal)",
    platform_release_store_records_v3_prior_unique:
      "UNIQUE (prior_record_hash)",
    platform_release_store_records_v3_attestation_unique:
      "UNIQUE (attestation_hash)",
    platform_release_store_records_v3_candidate_unique:
      "UNIQUE (candidate_hash)",
    platform_release_store_records_v3_preflight_unique:
      "UNIQUE (preflight_hash)",
    platform_release_store_records_v3_leaf_receipt_unique:
      "UNIQUE (leaf_receipt_hash)",
    platform_release_store_records_v3_published_census_unique:
      "UNIQUE (published_census_hash)",
    platform_release_store_records_v3_prior_fkey:
      "FOREIGN KEY (prior_record_hash) REFERENCES platform_release_store_records_v3(record_hash) ON UPDATE RESTRICT ON DELETE RESTRICT",
    platform_release_store_records_v3_schema_check:
      "CHECK (record_schema = 'setfarm.platform-release-content-store-durable-record-test.v3'::text AND record_version = '3.0.0'::text AND admission_scope = 'test_fixture'::text)",
    platform_release_store_records_v3_false_authority_check:
      "CHECK (production_authority = false AND production_admission = 'forbidden'::text AND publication = 'published'::text)",
    platform_release_store_records_v3_hashes_check:
      "CHECK (record_hash ~ '^[a-f0-9]{64}$'::text AND (prior_record_hash ~ '^[a-f0-9]{64}$'::text OR prior_record_hash IS NULL))",
    platform_release_store_records_v3_identity_hashes_check:
      "CHECK (host_identity_hash ~ '^[a-f0-9]{64}$'::text AND manifest_payload_hash ~ '^[a-f0-9]{64}$'::text AND attestation_hash ~ '^[a-f0-9]{64}$'::text AND release_content_hash ~ '^[a-f0-9]{64}$'::text AND candidate_hash ~ '^[a-f0-9]{64}$'::text AND preflight_hash ~ '^[a-f0-9]{64}$'::text AND leaf_receipt_hash ~ '^[a-f0-9]{64}$'::text AND published_census_hash ~ '^[a-f0-9]{64}$'::text)",
    platform_release_store_records_v3_ordinal_check:
      "CHECK (record_ordinal >= 0 AND record_ordinal <= 255 AND (record_ordinal = 0) = (prior_record_hash IS NULL))",
    platform_release_store_records_v3_release_join_check:
      "CHECK (release_content_hash = manifest_payload_hash)",
    platform_release_store_records_v3_bytes_check:
      "CHECK (manifest_byte_length >= 1 AND manifest_byte_length <= 8388608 AND attestation_byte_length >= 1 AND attestation_byte_length <= 8388608 AND (manifest_byte_length + attestation_byte_length) <= 16777216)",
    platform_release_store_records_v3_payload_shape_check:
      "CHECK (jsonb_typeof(record_payload) = 'object'::text AND record_payload ?& ARRAY['schema'::text, 'version'::text, 'admissionScope'::text, 'authorityState'::text, 'productionAuthority'::text, 'productionAdmission'::text, 'credentialUse'::text, 'signingAuthority'::text, 'mutationAuthority'::text, 'storeAuthority'::text, 'restartAuthority'::text, 'preparedPlatformReleaseIssued'::text, 'serializedValueAuthority'::text, 'trustConclusion'::text, 'persistenceScope'::text, 'closedProductionBlocker'::text, 'remainingProductionBlockers'::text, 'recordOrdinal'::text, 'priorRecordHash'::text, 'preflight'::text, 'leafReceipt'::text, 'recordHash'::text] AND (record_payload - ARRAY['schema'::text, 'version'::text, 'admissionScope'::text, 'authorityState'::text, 'productionAuthority'::text, 'productionAdmission'::text, 'credentialUse'::text, 'signingAuthority'::text, 'mutationAuthority'::text, 'storeAuthority'::text, 'restartAuthority'::text, 'preparedPlatformReleaseIssued'::text, 'serializedValueAuthority'::text, 'trustConclusion'::text, 'persistenceScope'::text, 'closedProductionBlocker'::text, 'remainingProductionBlockers'::text, 'recordOrdinal'::text, 'priorRecordHash'::text, 'preflight'::text, 'leafReceipt'::text, 'recordHash'::text]) = '{}'::jsonb AND octet_length(record_payload::text) >= 2 AND octet_length(record_payload::text) <= 68157440)",
    platform_release_store_records_v3_payload_authority_check:
      `CHECK ((record_payload ->> 'schema'::text) = record_schema AND (record_payload ->> 'version'::text) = record_version AND (record_payload ->> 'admissionScope'::text) = admission_scope AND (record_payload ->> 'authorityState'::text) = 'durable_database_record_test_fixture_unverified'::text AND (record_payload ->> 'productionAuthority'::text) = 'false'::text AND (record_payload ->> 'productionAdmission'::text) = production_admission AND (record_payload ->> 'credentialUse'::text) = 'none'::text AND (record_payload ->> 'signingAuthority'::text) = 'unsigned_test_fixture'::text AND (record_payload ->> 'mutationAuthority'::text) = 'false'::text AND (record_payload ->> 'storeAuthority'::text) = 'false'::text AND (record_payload ->> 'restartAuthority'::text) = 'false'::text AND (record_payload ->> 'preparedPlatformReleaseIssued'::text) = 'false'::text AND (record_payload ->> 'serializedValueAuthority'::text) = 'false'::text AND (record_payload ->> 'trustConclusion'::text) = 'characterization_only'::text AND (record_payload ->> 'persistenceScope'::text) = 'exact_database_occurrence_required'::text AND (record_payload ->> 'closedProductionBlocker'::text) = 'durable_release_store_records_absent'::text AND (record_payload -> 'remainingProductionBlockers'::text) = '["production_store_bootstrap_absent", "authenticated_content_lease_absent", "authenticated_attestation_lease_absent", "authenticated_global_census_absent", "production_publisher_preflight_absent", "atomic_conditional_unlink_absent", "crash_replay_ledger_absent", "whole_content_root_atomic_rename_absent", "authenticated_restart_rejoin_absent", "canonical_release_payload_layout_absent", "b5d_composer_bridge_absent", "runtime_payload_unbound", "fresh_production_verifier_absent"]'::jsonb)`,
    platform_release_store_records_v3_payload_projection_check:
      "CHECK ((record_payload ->> 'recordHash'::text) = record_hash AND ((record_payload ->> 'recordOrdinal'::text)::smallint) = record_ordinal AND NOT (record_payload ->> 'priorRecordHash'::text) IS DISTINCT FROM prior_record_hash AND (record_payload #>> '{preflight,productionAuthority}'::text[]) = 'false'::text AND (record_payload #>> '{preflight,productionAdmission}'::text[]) = 'forbidden'::text AND (record_payload #>> '{preflight,mutationAuthority}'::text[]) = 'false'::text AND (record_payload #>> '{leafReceipt,productionAuthority}'::text[]) = 'false'::text AND (record_payload #>> '{leafReceipt,productionAdmission}'::text[]) = 'forbidden'::text AND (record_payload #>> '{leafReceipt,mutationAuthority}'::text[]) = 'false'::text AND (record_payload #>> '{preflight,candidateFinalCensus,hostIdentityHash}'::text[]) = host_identity_hash AND (record_payload #>> '{leafReceipt,publishedCensus,hostIdentityHash}'::text[]) = host_identity_hash AND (record_payload #>> '{preflight,candidate,manifestPayloadHash}'::text[]) = manifest_payload_hash AND (record_payload #>> '{leafReceipt,leaf,manifestPayloadHash}'::text[]) = manifest_payload_hash AND (record_payload #>> '{preflight,candidate,attestationHash}'::text[]) = attestation_hash AND (record_payload #>> '{leafReceipt,leaf,attestationHash}'::text[]) = attestation_hash AND (record_payload #>> '{preflight,candidate,releaseContentHash}'::text[]) = release_content_hash AND (record_payload #>> '{leafReceipt,leaf,releaseContentHash}'::text[]) = release_content_hash AND (record_payload #>> '{preflight,candidate,candidateHash}'::text[]) = candidate_hash AND (record_payload #>> '{leafReceipt,leaf,candidateHash}'::text[]) = candidate_hash AND (record_payload #>> '{preflight,preflightHash}'::text[]) = preflight_hash AND (record_payload #>> '{leafReceipt,preflightHash}'::text[]) = preflight_hash AND (record_payload #>> '{leafReceipt,receiptHash}'::text[]) = leaf_receipt_hash AND (record_payload #>> '{preflight,expectedFinalCensusHash}'::text[]) = published_census_hash AND (record_payload #>> '{leafReceipt,publishedCensusHash}'::text[]) = published_census_hash AND ((record_payload #>> '{preflight,candidate,manifestByteLength}'::text[])::integer) = manifest_byte_length AND ((record_payload #>> '{leafReceipt,leaf,manifestByteLength}'::text[])::integer) = manifest_byte_length AND ((record_payload #>> '{preflight,candidate,attestationByteLength}'::text[])::integer) = attestation_byte_length AND ((record_payload #>> '{leafReceipt,leaf,attestationByteLength}'::text[])::integer) = attestation_byte_length AND (record_payload #>> '{leafReceipt,publication}'::text[]) = publication)",
  } satisfies Readonly<Record<typeof EXPECTED_CONSTRAINT_NAMES[number], string>>);

const PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_TRIGGERS = Object.freeze({
  [PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_GUARD_TRIGGER]:
    `CREATE TRIGGER ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_GUARD_TRIGGER} BEFORE INSERT OR DELETE OR UPDATE ON ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE} FOR EACH ROW EXECUTE FUNCTION ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION}()`,
  [PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TRUNCATE_TRIGGER]:
    `CREATE TRIGGER ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TRUNCATE_TRIGGER} BEFORE TRUNCATE ON ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE} FOR EACH STATEMENT EXECUTE FUNCTION ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION}()`,
} satisfies Readonly<Record<
  | typeof PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_GUARD_TRIGGER
  | typeof PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TRUNCATE_TRIGGER,
  string
>>);

function normalizeConstraintDefinition(value: string): string {
  return normalizeSql(value);
}

function topologyError(message: string): Error {
  return migrationError(
    "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TOPOLOGY_INVALID",
    message,
  );
}

async function verifyRelationTopology(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    relkind: string;
    relpersistence: string;
    relispartition: boolean;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
    inheritance_edges: number;
    rules: number;
    policies: number;
  }>>(
    `SELECT c.relkind, c.relpersistence, c.relispartition,
            c.relrowsecurity, c.relforcerowsecurity,
            (SELECT COUNT(*)::integer FROM pg_inherits i
              WHERE i.inhrelid = c.oid OR i.inhparent = c.oid) AS inheritance_edges,
            (SELECT COUNT(*)::integer FROM pg_rewrite r
              WHERE r.ev_class = c.oid) AS rules,
            (SELECT COUNT(*)::integer FROM pg_policy p
              WHERE p.polrelid = c.oid) AS policies
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1`,
    [PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE],
  );
  const row = rows[0];
  if (
    rows.length !== 1
    || row?.relkind !== "r"
    || row.relpersistence !== "p"
    || row.relispartition
    || row.relrowsecurity
    || row.relforcerowsecurity
    || row.inheritance_edges !== 0
    || row.rules !== 0
    || row.policies !== 0
  ) {
    throw topologyError("release-store record ledger relation topology mismatch");
  }
}

async function verifyColumns(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    column_name: string;
    ordinal_position: number;
    data_type: string;
    is_nullable: "YES" | "NO";
    column_default: string | null;
    collation_schema: string | null;
    collation_name: string | null;
    udt_schema: string;
    udt_name: string;
    domain_schema: string | null;
    domain_name: string | null;
    is_identity: "YES" | "NO";
    is_generated: "ALWAYS" | "NEVER";
  }>>(
    `SELECT column_name, ordinal_position, data_type, is_nullable,
            column_default, collation_schema, collation_name,
            udt_schema, udt_name, domain_schema, domain_name,
            is_identity, is_generated
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE],
  );
  if (
    rows.length !== PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_COLUMNS.length
    || rows.some((row, index) => {
      const expected = PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_COLUMNS[index];
      return expected === undefined
        || row.column_name !== expected.name
        || row.ordinal_position !== expected.position
        || row.data_type !== expected.dataType
        || row.is_nullable !== expected.nullable
        || normalizeSql(row.column_default ?? "") !== expected.defaultValue
        || row.collation_schema !== expected.collationSchema
        || row.collation_name !== expected.collationName
        || row.udt_schema !== expected.udtSchema
        || row.udt_name !== expected.udtName
        || row.domain_schema !== expected.domainSchema
        || row.domain_name !== expected.domainName
        || row.is_identity !== expected.isIdentity
        || row.is_generated !== expected.isGenerated;
    })
  ) {
    throw topologyError("release-store record ledger exact columns mismatch");
  }
}

async function verifyConstraints(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    conname: string;
    contype: string;
    definition: string;
    validated: boolean;
    deferrable: boolean;
    initially_deferred: boolean;
  }>>(
    `SELECT conname, contype, pg_get_constraintdef(oid, true) AS definition,
            convalidated AS validated, condeferrable AS deferrable,
            condeferred AS initially_deferred
       FROM pg_constraint
      WHERE conrelid = $1::regclass
        AND contype <> 't'
      ORDER BY conname`,
    [`public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}`],
  );
  const names = rows.map((row) => row.conname).sort();
  const expectedNames = [...EXPECTED_CONSTRAINT_NAMES].sort();
  const prior = rows.find((row) => row.conname === "platform_release_store_records_v3_prior_fkey");
  if (
    JSON.stringify(names) !== JSON.stringify(expectedNames)
    || rows.some((row) => !row.validated || row.deferrable || row.initially_deferred)
    || rows.some((row) =>
      normalizeConstraintDefinition(row.definition)
        !== normalizeConstraintDefinition(
          PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_CONSTRAINTS[
            row.conname as keyof typeof PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_CONSTRAINTS
          ] ?? "",
        ))
    || prior?.contype !== "f"
    || normalizeConstraintDefinition(prior.definition)
      !== normalizeConstraintDefinition(
        "FOREIGN KEY (prior_record_hash) REFERENCES platform_release_store_records_v3(record_hash) ON UPDATE RESTRICT ON DELETE RESTRICT",
      )
    || rows.filter((row) => row.contype === "f").length !== 1
    || rows.filter((row) => row.contype === "p").length !== 1
    || rows.filter((row) => row.contype === "u").length !== 7
    || rows.filter((row) => row.contype === "c").length !== 10
  ) {
    throw topologyError("release-store record ledger exact constraints/FK mismatch");
  }
}

async function verifyIndexes(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    name: string;
    definition: string;
    valid: boolean;
    ready: boolean;
    live: boolean;
  }>>(
    `SELECT index_relation.relname AS name,
            pg_get_indexdef(index_relation.oid) AS definition,
            index_row.indisvalid AS valid,
            index_row.indisready AS ready,
            index_row.indislive AS live
       FROM pg_index index_row
       JOIN pg_class table_relation ON table_relation.oid = index_row.indrelid
       JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
       JOIN pg_namespace namespace ON namespace.oid = table_relation.relnamespace
      WHERE namespace.nspname = 'public' AND table_relation.relname = $1
      ORDER BY index_relation.relname`,
    [PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE],
  );
  const names = rows.map((row) => row.name).sort();
  if (
    JSON.stringify(names) !== JSON.stringify([...EXPECTED_INDEX_NAMES].sort())
    || rows.some((row) =>
      !row.valid
      || !row.ready
      || !row.live
      || normalizeSql(row.definition) !== normalizeSql(
        PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_INDEXES[
          row.name as keyof typeof PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_INDEXES
        ] ?? "",
      ))
  ) {
    throw topologyError("release-store record ledger exact indexes mismatch");
  }
}

async function verifyFunction(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    name: string;
    body: string;
    language: string;
    volatility: string;
    parallel_safety: string;
    security_definer: boolean;
    leakproof: boolean;
    strict: boolean;
    returns_set: boolean;
    configuration: string[] | null;
    result: string;
    arguments: string;
  }>>(
    `SELECT p.proname AS name, p.prosrc AS body, l.lanname AS language,
            p.provolatile AS volatility, p.proparallel AS parallel_safety,
            p.prosecdef AS security_definer, p.proleakproof AS leakproof,
            p.proisstrict AS strict, p.proretset AS returns_set,
            p.proconfig AS configuration,
            pg_get_function_result(p.oid) AS result,
            pg_get_function_arguments(p.oid) AS arguments
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       JOIN pg_language l ON l.oid = p.prolang
      WHERE n.nspname = 'public' AND p.proname = $1`,
    [PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION],
  );
  const row = rows[0];
  if (
    rows.length !== 1
    || row?.name !== PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION
    || normalizeSql(row.body) !== normalizeSql(PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION_BODY_SQL)
    || row.language !== "plpgsql"
    || row.volatility !== "v"
    || row.parallel_safety !== "u"
    || row.security_definer
    || row.leakproof
    || row.strict
    || row.returns_set
    || JSON.stringify(row.configuration) !== JSON.stringify(["search_path=pg_catalog, public"])
    || row.result !== "trigger"
    || row.arguments !== ""
  ) {
    throw topologyError("release-store record ledger exact function mismatch");
  }
}

async function verifyAuthorityOwnershipAndPrivileges(
  sql: Sql | TransactionSql,
): Promise<void> {
  const rows = await sql.unsafe<Array<{
    table_owner_exact: boolean;
    function_owner_exact: boolean;
    table_acl_exact: boolean;
    column_acl_exact: boolean;
    function_acl_exact: boolean;
  }>>(
    `WITH expected_owner AS (
       SELECT COALESCE(
         (
           SELECT journal.relowner
             FROM pg_class journal
             JOIN pg_namespace journal_namespace
               ON journal_namespace.oid = journal.relnamespace
            WHERE journal_namespace.nspname = 'public'
              AND journal.relname = 'setfarm_schema_migrations'
         ),
         (SELECT oid FROM pg_roles WHERE rolname = current_user)
       ) AS oid
     ), ledger AS (
       SELECT relation.oid, relation.relowner, relation.relacl
         FROM pg_class relation
         JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public' AND relation.relname = $1
     ), guard AS (
       SELECT routine.oid, routine.proowner, routine.proacl
         FROM pg_proc routine
         JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
        WHERE namespace.nspname = 'public' AND routine.proname = $2
     )
     SELECT ledger.relowner = expected_owner.oid AS table_owner_exact,
            guard.proowner = expected_owner.oid AS function_owner_exact,
            NOT EXISTS (
              (
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(COALESCE(
                    ledger.relacl,
                    acldefault('r', ledger.relowner)
                  ))
                EXCEPT
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(acldefault('r', ledger.relowner))
              )
              UNION ALL
              (
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(acldefault('r', ledger.relowner))
                EXCEPT
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(COALESCE(
                    ledger.relacl,
                    acldefault('r', ledger.relowner)
                  ))
              )
            ) AS table_acl_exact,
            NOT EXISTS (
              SELECT 1
                FROM pg_attribute attribute
               WHERE attribute.attrelid = ledger.oid
                 AND attribute.attnum > 0
                 AND NOT attribute.attisdropped
                 AND attribute.attacl IS NOT NULL
            ) AS column_acl_exact,
            (
              SELECT COUNT(*) = 1
                 AND COALESCE(BOOL_AND(
                   acl.grantor = guard.proowner
                   AND acl.grantee = guard.proowner
                   AND acl.privilege_type = 'EXECUTE'
                   AND NOT acl.is_grantable
                 ), FALSE)
                FROM aclexplode(COALESCE(
                  guard.proacl,
                  acldefault('f', guard.proowner)
                )) acl
            ) AS function_acl_exact
       FROM ledger CROSS JOIN guard CROSS JOIN expected_owner`,
    [
      PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE,
      PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION,
    ],
  );
  const row = rows[0];
  if (
    rows.length !== 1
    || !row?.table_owner_exact
    || !row.function_owner_exact
    || !row.table_acl_exact
    || !row.column_acl_exact
    || !row.function_acl_exact
  ) {
    throw topologyError("release-store record ledger exact owner/ACL mismatch");
  }
}

async function verifyNoExternalDependencies(
  sql: Sql | TransactionSql,
): Promise<void> {
  const rows = await sql.unsafe<Array<{ count: number }>>(
    `WITH ledger AS (
       SELECT relation.oid, relation.reltype, relation.reltoastrelid
         FROM pg_class relation
         JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public' AND relation.relname = $1
     )
     SELECT COUNT(DISTINCT (dependency.classid, dependency.objid, dependency.objsubid))::integer
              AS count
       FROM ledger
       JOIN pg_depend dependency
         ON dependency.refclassid = 'pg_class'::regclass
        AND dependency.refobjid = ledger.oid
      WHERE NOT (
        (
          dependency.classid = 'pg_attrdef'::regclass
          AND EXISTS (
            SELECT 1 FROM pg_attrdef attribute_default
             WHERE attribute_default.oid = dependency.objid
               AND attribute_default.adrelid = ledger.oid
          )
        )
        OR (
          dependency.classid = 'pg_class'::regclass
          AND (
            dependency.objid = ledger.reltoastrelid
            OR EXISTS (
              SELECT 1 FROM pg_index index_row
               WHERE index_row.indexrelid = dependency.objid
                 AND index_row.indrelid = ledger.oid
            )
          )
        )
        OR (
          dependency.classid = 'pg_constraint'::regclass
          AND EXISTS (
            SELECT 1 FROM pg_constraint constraint_row
             WHERE constraint_row.oid = dependency.objid
               AND constraint_row.conrelid = ledger.oid
          )
        )
        OR (
          dependency.classid = 'pg_trigger'::regclass
          AND EXISTS (
            SELECT 1 FROM pg_trigger trigger_row
             WHERE trigger_row.oid = dependency.objid
               AND trigger_row.tgrelid = ledger.oid
          )
        )
        OR (
          dependency.classid = 'pg_type'::regclass
          AND dependency.objid = ledger.reltype
        )
      )`,
    [PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE],
  );
  if (rows.length !== 1 || rows[0]?.count !== 0) {
    throw topologyError("release-store record ledger has external dependencies");
  }
}

async function verifyTriggers(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    name: string;
    relation: string;
    enabled: string;
    deferrable: boolean;
    initially_deferred: boolean;
    definition: string;
    function_identity: string;
  }>>(
    `SELECT t.tgname AS name, t.tgrelid::regclass::text AS relation,
            t.tgenabled AS enabled, t.tgdeferrable AS deferrable,
            t.tginitdeferred AS initially_deferred,
            pg_get_triggerdef(t.oid, true) AS definition,
            t.tgfoid::regprocedure::text AS function_identity
       FROM pg_trigger t
      WHERE NOT t.tgisinternal
        AND (
          t.tgrelid = $1::regclass
          OR t.tgname = ANY($2::text[])
          OR t.tgfoid IN (
            SELECT p.oid FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = $3
          )
        )
      ORDER BY t.tgname`,
    [
      `public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}`,
      [
        PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_GUARD_TRIGGER,
        PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TRUNCATE_TRIGGER,
      ],
      PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION,
    ],
  );
  const expectedNames = [
    PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_GUARD_TRIGGER,
    PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TRUNCATE_TRIGGER,
  ].sort();
  const names = rows.map((row) => row.name).sort();
  const commonInvalid = rows.some((row) =>
    ![PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE, `public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}`]
      .includes(row.relation)
    || row.enabled !== "O"
    || row.deferrable
    || row.initially_deferred
    || ![
      `${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION}()`,
      `public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION}()`,
    ].includes(row.function_identity)
    || normalizeSql(row.definition) !== normalizeSql(
      PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_TRIGGERS[
        row.name as keyof typeof PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_TRIGGERS
      ] ?? "",
    ));
  if (
    JSON.stringify(names) !== JSON.stringify(expectedNames)
    || commonInvalid
  ) {
    throw topologyError("release-store record ledger exact triggers mismatch");
  }
}

async function countRows(sql: Sql | TransactionSql): Promise<number> {
  const rows = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count
       FROM public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}`,
  );
  return rows[0]?.count ?? -1;
}

export async function verifyPlatformReleaseStoreRecordLedgerV3(
  sql: Sql | TransactionSql,
  options: Readonly<{ requireEmpty?: boolean }> = {},
): Promise<void> {
  await verifyRelationTopology(sql);
  await verifyColumns(sql);
  await verifyConstraints(sql);
  await verifyIndexes(sql);
  await verifyFunction(sql);
  await verifyAuthorityOwnershipAndPrivileges(sql);
  await verifyTriggers(sql);
  await verifyNoExternalDependencies(sql);
  if (options.requireEmpty === true && await countRows(sql) !== 0) {
    throw migrationError(
      "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_ADOPTION_REQUIRES_EMPTY",
      "release-store record ledger adoption requires an exact empty ledger",
    );
  }
}

export type PlatformReleaseStoreRecordLedgerV3ApplyResult =
  "created" | "adopted";

export async function applyPlatformReleaseStoreRecordLedgerV3(
  sql: TransactionSql,
): Promise<PlatformReleaseStoreRecordLedgerV3ApplyResult> {
  // The caller owns the surrounding transaction and its rollback. A distinct
  // install key serializes concurrent helpers without reversing the normal
  // writer order (RowExclusive table lock, then record advisory key).
  await sql.unsafe("SELECT pg_advisory_xact_lock($1, $2)", [
    ...PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_INSTALL_ADVISORY_LOCK_KEYS,
  ]);
  const detection = await detectPlatformReleaseStoreRecordLedgerV3(sql);
  if (detection === "partial") {
    throw migrationError(
      "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_PARTIAL",
      "release-store record ledger objects are partially present",
    );
  }
  if (detection === "present") {
    // Take the table fence before the advisory key used by INSERT triggers.
    // Any writer already holding RowExclusive is allowed to finish first; its
    // committed row then makes the empty-adoption check reject safely.
    await sql.unsafe(
      `LOCK TABLE public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}
         IN ACCESS EXCLUSIVE MODE`,
    );
    await sql.unsafe("SELECT pg_advisory_xact_lock($1, $2)", [
      ...PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_ADVISORY_LOCK_KEYS,
    ]);
    if (await detectPlatformReleaseStoreRecordLedgerV3(sql) !== "present") {
      throw migrationError(
        "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_PARTIAL",
        "release-store record ledger changed during adoption fencing",
      );
    }
    await verifyPlatformReleaseStoreRecordLedgerV3(sql, { requireEmpty: true });
    return "adopted";
  }
  try {
    for (const statement of PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_STATEMENTS) {
      await sql.unsafe(statement);
    }
    if (await detectPlatformReleaseStoreRecordLedgerV3(sql) !== "present") {
      throw migrationError(
        "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_PARTIAL",
        "release-store record ledger installation did not create one exact object set",
      );
    }
    await verifyPlatformReleaseStoreRecordLedgerV3(sql, { requireEmpty: true });
    return "created";
  } catch (cause) {
    if (
      cause instanceof PlatformReleaseStoreRecordLedgerV3MigrationError
      || isIssuedMigrationError(cause)
    ) {
      throw cause;
    }
    throw migrationError(
      "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_SQL_FAILED",
      "release-store record ledger SQL installation failed",
      cause,
    );
  }
}

export type PlatformReleaseStoreRecordLedgerV3DataRow = Readonly<{
  record_hash: string;
  record_schema: string;
  record_version: string;
  admission_scope: string;
  production_authority: boolean;
  production_admission: string;
  record_ordinal: number;
  prior_record_hash: string | null;
  host_identity_hash: string;
  manifest_payload_hash: string;
  attestation_hash: string;
  release_content_hash: string;
  candidate_hash: string;
  preflight_hash: string;
  leaf_receipt_hash: string;
  published_census_hash: string;
  manifest_byte_length: number;
  attestation_byte_length: number;
  publication: string;
  record_payload: unknown;
  recorded_at: Date | string;
}>;

function dataError(message: string): Error {
  return migrationError(
    "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_DATA_INVALID",
    message,
  );
}

function assertScalarProjections(
  row: PlatformReleaseStoreRecordLedgerV3DataRow,
  record: PlatformReleaseContentStoreDurableRecordTestV3,
): void {
  const candidate = record.preflight.candidate;
  const timestamp = new Date(row.recorded_at);
  if (
    row.record_hash !== record.recordHash
    || row.record_schema !== record.schema
    || row.record_version !== record.version
    || row.admission_scope !== record.admissionScope
    || row.production_authority !== record.productionAuthority
    || row.production_admission !== record.productionAdmission
    || row.record_ordinal !== record.recordOrdinal
    || row.prior_record_hash !== record.priorRecordHash
    || row.host_identity_hash !== record.preflight.candidateFinalCensus.hostIdentityHash
    || row.host_identity_hash !== record.leafReceipt.publishedCensus.hostIdentityHash
    || row.manifest_payload_hash !== candidate.manifestPayloadHash
    || row.attestation_hash !== candidate.attestationHash
    || row.release_content_hash !== candidate.releaseContentHash
    || row.candidate_hash !== candidate.candidateHash
    || row.preflight_hash !== record.preflight.preflightHash
    || row.leaf_receipt_hash !== record.leafReceipt.receiptHash
    || row.published_census_hash !== record.leafReceipt.publishedCensusHash
    || row.manifest_byte_length !== candidate.manifestByteLength
    || row.attestation_byte_length !== candidate.attestationByteLength
    || row.publication !== record.leafReceipt.publication
    || !Number.isFinite(timestamp.getTime())
  ) {
    throw dataError(
      `release-store record scalar projection mismatch at ordinal ${boundedIdentity(row.record_ordinal)}`,
    );
  }
}

type PreviousRecordChainState = Readonly<{
  recordOrdinal: number;
  recordHash: string;
  publishedCensus: PlatformReleaseContentStoreGlobalCensusV3;
}>;

function assertRecordChain(
  record: PlatformReleaseContentStoreDurableRecordTestV3,
  previous: PreviousRecordChainState | undefined,
): void {
  const ordinal = record.recordOrdinal;
  const baseline = record.preflight.baselineCensus;
  const published = record.leafReceipt.publishedCensus;
  if (previous === undefined && (
    ordinal !== 0
    || record.priorRecordHash !== null
    || baseline.releaseCount !== 0
    || baseline.attestationCount !== 0
    || baseline.totalContentBytes !== 0
  )) {
    throw dataError("release-store record genesis baseline is not empty");
  }
  if (
    baseline.attestationCount !== ordinal
    || published.attestationCount !== ordinal + 1
    || record.preflight.delta.addedAttestationCount !== 1
    || record.preflight.delta.addedReleaseCount < 0
    || record.preflight.delta.addedReleaseCount > 1
  ) {
    throw dataError(`release-store record census count mismatch at ordinal ${ordinal}`);
  }
  if (previous === undefined) {
    return;
  }
  if (
    ordinal !== previous.recordOrdinal + 1
    || record.priorRecordHash !== previous.recordHash
    || baseline.releaseCount !== previous.publishedCensus.releaseCount
    || baseline.attestationCount
      !== previous.publishedCensus.attestationCount
    || canonicalJsonStringify(baseline.releaseEntries)
      !== canonicalJsonStringify(previous.publishedCensus.releaseEntries)
    || canonicalJsonStringify(baseline.attestationEntries)
      !== canonicalJsonStringify(previous.publishedCensus.attestationEntries)
  ) {
    throw dataError(`release-store record prior chain mismatch at ordinal ${ordinal}`);
  }
  try {
    assertPlatformReleaseContentStoreAppendOnlySupersetV3(
      previous.publishedCensus,
      baseline,
    );
  } catch {
    throw dataError(`release-store record append-only baseline mismatch at ordinal ${ordinal}`);
  }
}

export type PlatformReleaseStoreRecordLedgerV3AuditResult = Readonly<{
  schema: "setfarm.platform-release-store-record-ledger-audit.v3";
  status: "integrity_verified";
  authorityState: "database_record_integrity_audit_only";
  productionAuthority: false;
  productionAdmission: "forbidden";
  mutationAuthority: false;
  storeAuthority: false;
  restartAuthority: false;
  trustConclusion: "characterization_only";
  recordCount: number;
  tailRecordHash: string | null;
  tailPublishedCensusHash: string | null;
}>;

export type PlatformReleaseStoreRecordLedgerV3AuditHooks = Readonly<{
  beforeQuery?: (phase: string) => void | Promise<void>;
  afterQuery?: (phase: string) => void;
  beforeRowParse?: (ordinal: number) => void;
  afterRowParse?: (ordinal: number) => void;
}>;

async function auditQuery<T>(
  hooks: PlatformReleaseStoreRecordLedgerV3AuditHooks,
  phase: string,
  query: () => Promise<T>,
): Promise<T> {
  await hooks.beforeQuery?.(phase);
  const result = await query();
  hooks.afterQuery?.(phase);
  return result;
}

export async function auditPlatformReleaseStoreRecordLedgerV3Data(
  sql: TransactionSql,
  hooks: PlatformReleaseStoreRecordLedgerV3AuditHooks = {},
): Promise<PlatformReleaseStoreRecordLedgerV3AuditResult> {
  const transaction = await auditQuery(
    hooks,
    "transaction-contract",
    () => sql.unsafe<Array<{
      isolation: string;
      read_only: boolean;
    }>>(
      `SELECT current_setting('transaction_isolation') AS isolation,
              current_setting('transaction_read_only')::boolean AS read_only`,
    ),
  );
  if (
    transaction.length !== 1
    || transaction[0]?.isolation !== "repeatable read"
    || transaction[0].read_only !== true
  ) {
    throw dataError(
      "release-store record audit requires one read-only repeatable-read transaction",
    );
  }
  await auditQuery(
    hooks,
    "ledger-lock",
    () => sql.unsafe(
      `LOCK TABLE public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}
         IN ACCESS SHARE MODE`,
    ),
  );
  await auditQuery(
    hooks,
    "ledger-topology",
    () => verifyPlatformReleaseStoreRecordLedgerV3(sql),
  );
  const recordCount = await auditQuery(
    hooks,
    "record-count",
    () => countRows(sql),
  );
  if (
    recordCount < 0
    || recordCount > PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_ATTESTATIONS_V3
  ) {
    throw dataError("release-store record ledger exceeds its bounded row count");
  }
  let previous: PreviousRecordChainState | undefined;
  for (let ordinal = 0; ordinal < recordCount; ordinal += 1) {
    const rows = await auditQuery(
      hooks,
      `record-query:${ordinal}`,
      () => sql.unsafe<PlatformReleaseStoreRecordLedgerV3DataRow[]>(
        `SELECT record_hash, record_schema, record_version, admission_scope,
                production_authority, production_admission, record_ordinal,
                prior_record_hash, host_identity_hash, manifest_payload_hash,
                attestation_hash, release_content_hash, candidate_hash,
                preflight_hash, leaf_receipt_hash, published_census_hash,
                manifest_byte_length, attestation_byte_length, publication,
                record_payload, recorded_at
           FROM public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}
          WHERE record_ordinal = $1`,
        [ordinal],
      ),
    );
    if (rows.length !== 1 || rows[0]?.record_ordinal !== ordinal) {
      throw dataError(`release-store record ordinal gap at ${ordinal}`);
    }
    const row = rows[0];
    hooks.beforeRowParse?.(ordinal);
    let record: PlatformReleaseContentStoreDurableRecordTestV3;
    try {
      record = parsePlatformReleaseContentStoreDurableRecordTestCandidateV3(
        row.record_payload,
      );
    } catch {
      throw dataError(
        `release-store record payload invalid at ordinal ${boundedIdentity(row.record_ordinal)} hash ${boundedIdentity(row.record_hash)}`,
      );
    }
    assertScalarProjections(row, record);
    assertRecordChain(record, previous);
    hooks.afterRowParse?.(ordinal);
    previous = Object.freeze({
      recordOrdinal: record.recordOrdinal,
      recordHash: record.recordHash,
      publishedCensus: record.leafReceipt.publishedCensus,
    });
  }
  return Object.freeze({
    schema: "setfarm.platform-release-store-record-ledger-audit.v3" as const,
    status: "integrity_verified" as const,
    authorityState: "database_record_integrity_audit_only" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    mutationAuthority: false as const,
    storeAuthority: false as const,
    restartAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    recordCount,
    tailRecordHash: previous?.recordHash ?? null,
    tailPublishedCensusHash:
      previous?.publishedCensus.censusHash ?? null,
  });
}
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v27-platform-release-store-record-ledger:END
