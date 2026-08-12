import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import type postgres from "postgres";

import {
  PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_COLUMNS,
  PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_CONSTRAINTS,
  PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_INDEXES,
  PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_ADVISORY_LOCK_KEYS,
  PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION,
  PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION_BODY_SQL,
  PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_GUARD_TRIGGER,
  PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_INSTALL_ADVISORY_LOCK_KEYS,
  PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_STATEMENTS,
  PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE,
  PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TRUNCATE_TRIGGER,
  PlatformReleaseStoreRecordLedgerV3MigrationError,
  applyPlatformReleaseStoreRecordLedgerV3,
  auditPlatformReleaseStoreRecordLedgerV3Data,
  detectPlatformReleaseStoreRecordLedgerV3,
  verifyPlatformReleaseStoreRecordLedgerV3,
  type PlatformReleaseStoreRecordLedgerV3DataRow,
} from "../../src/db/platform-release-store-record-ledger-v3-migration.js";
import {
  buildPlatformReleaseContentStoreDurableRecordTestV3,
  type PlatformReleaseContentStoreDurableRecordTestV3,
} from "../../src/execution/schemas/platform-release-content-store-durable-record-test-v3.js";
import {
  buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3,
  buildPlatformReleaseContentStoreGlobalCensusV3,
  buildPlatformReleaseContentStoreObservationV3,
  type PlatformReleaseContentStoreGlobalCensusV3,
  type PlatformReleaseContentStoreObservationV3,
} from "../../src/execution/schemas/platform-release-content-store-census-v3.js";
import {
  PLATFORM_RELEASE_CONTENT_STORE_PUBLISHER_PREFLIGHT_TEST_V3_SCHEMA,
  PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS,
  buildPlatformReleaseContentStoreLeafReceiptFromPreflightTestV3,
  hashPlatformReleaseContentStoreCandidateDeltaTestV3,
  hashPlatformReleaseContentStoreCandidateTestV3,
  hashPlatformReleaseContentStorePublisherPreflightTestV3,
  parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3,
  type PlatformReleaseContentStorePublisherPreflightTestHashPayloadV3,
} from "../../src/execution/schemas/platform-release-content-store-test-v3.js";

function sha(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

function observation(input: Readonly<{
  inode: number;
  objectKind: "directory" | "ordinary_file";
  mode: string;
  contentHash: string;
  byteLength: number;
  linkCount?: number;
}>): PlatformReleaseContentStoreObservationV3 {
  return buildPlatformReleaseContentStoreObservationV3({
    stableIdentity: {
      hostIdentityHash: sha("ledger-v3-host"),
      objectKind: input.objectKind,
      device: "91",
      inode: String(input.inode),
    },
    mutableFingerprint: {
      ownerUid: 501,
      ownerGid: 20,
      mode: input.mode,
      linkCount: input.linkCount ?? 2,
      byteLength: input.byteLength,
      contentHash: input.contentHash,
      modifiedTimeNanoseconds: "4000000001",
      changedTimeNanoseconds: "4000000002",
    },
  });
}

function directoryObservation(input: Readonly<{
  inode: number;
  mode: "0700" | "0555";
  role: Parameters<
    typeof buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3
  >[0];
  entryNames: readonly string[];
}>): PlatformReleaseContentStoreObservationV3 {
  const membership =
    buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3(
      input.role,
      input.entryNames,
    );
  return observation({
    inode: input.inode,
    objectKind: "directory",
    mode: input.mode,
    ...membership,
  });
}

const MANIFEST_PAYLOAD_HASH = sha("ledger-v3-manifest-payload");
const MANIFEST_FILE_HASH = sha("ledger-v3-manifest-file");
const MANIFEST_BYTES = 307;

type AttestationFixture = Readonly<{
  hash: string;
  fileHash: string;
  bytes: number;
  inode: number;
}>;

const ATTESTATION_A = Object.freeze({
  hash: sha("ledger-v3-attestation-a"),
  fileHash: sha("ledger-v3-attestation-file-a"),
  bytes: 211,
  inode: 8,
});
const ATTESTATION_B = Object.freeze({
  hash: sha("ledger-v3-attestation-b"),
  fileHash: sha("ledger-v3-attestation-file-b"),
  bytes: 223,
  inode: 9,
});
const ATTESTATION_FOREIGN = Object.freeze({
  hash: sha("ledger-v3-attestation-foreign"),
  fileHash: sha("ledger-v3-attestation-file-foreign"),
  bytes: 227,
  inode: 10,
});

function census(attestations: readonly AttestationFixture[]):
  PlatformReleaseContentStoreGlobalCensusV3 {
  const releaseHashes = attestations.length === 0 ? [] : [MANIFEST_PAYLOAD_HASH];
  const attestationHashes = attestations.map((item) => item.hash).sort();
  const persistentAnchors = {
    storeRoot: directoryObservation({
      inode: 1,
      mode: "0700",
      role: "store_root",
      entryNames: [".locks", ".staging", "attestations", "releases"],
    }),
    locksRoot: directoryObservation({
      inode: 2,
      mode: "0700",
      role: "locks_root",
      entryNames: [],
    }),
    stagingRoot: directoryObservation({
      inode: 3,
      mode: "0700",
      role: "staging_root",
      entryNames: [],
    }),
    releasesRoot: directoryObservation({
      inode: 4,
      mode: "0700",
      role: "releases_root",
      entryNames: releaseHashes,
    }),
    attestationsRoot: directoryObservation({
      inode: 5,
      mode: "0700",
      role: "attestations_root",
      entryNames: attestationHashes.map((hash) => `${hash}.json`),
    }),
  };
  return buildPlatformReleaseContentStoreGlobalCensusV3({
    hostIdentityHash: sha("ledger-v3-host"),
    persistentAnchors,
    releaseEntries: attestations.length === 0 ? [] : [{
      manifestPayloadHash: MANIFEST_PAYLOAD_HASH,
      releaseRoot: directoryObservation({
        inode: 6,
        mode: "0555",
        role: "release_root",
        entryNames: ["manifest.json"],
      }),
      manifest: observation({
        inode: 7,
        objectKind: "ordinary_file",
        mode: "0444",
        linkCount: 1,
        contentHash: MANIFEST_FILE_HASH,
        byteLength: MANIFEST_BYTES,
      }),
    }],
    attestationEntries: attestations.map((item) => ({
      attestationHash: item.hash,
      releaseContentHash: MANIFEST_PAYLOAD_HASH,
      attestation: observation({
        inode: item.inode,
        objectKind: "ordinary_file",
        mode: "0444",
        linkCount: 1,
        contentHash: item.fileHash,
        byteLength: item.bytes,
      }),
    })).sort((left, right) => left.attestationHash.localeCompare(right.attestationHash)),
  });
}

function buildRecord(input: Readonly<{
  ordinal: number;
  priorRecordHash: string | null;
  baseline: readonly AttestationFixture[];
  final: readonly AttestationFixture[];
  candidate: AttestationFixture;
}>): PlatformReleaseContentStoreDurableRecordTestV3 {
  const baselineCensus = census(input.baseline);
  const finalCensus = census(input.final);
  const candidateIdentity = {
    manifestPayloadHash: MANIFEST_PAYLOAD_HASH,
    attestationHash: input.candidate.hash,
    releaseContentHash: MANIFEST_PAYLOAD_HASH,
    manifestFileContentHash: MANIFEST_FILE_HASH,
    attestationFileContentHash: input.candidate.fileHash,
    manifestByteLength: MANIFEST_BYTES,
    attestationByteLength: input.candidate.bytes,
  };
  const candidate = {
    ...candidateIdentity,
    candidateHash:
      hashPlatformReleaseContentStoreCandidateTestV3(candidateIdentity),
  };
  const addedReleaseCount = Number(input.baseline.length === 0);
  const deltaIdentity = {
    addedReleaseCount,
    addedAttestationCount: 1,
    addedContentBytes:
      addedReleaseCount * MANIFEST_BYTES + input.candidate.bytes,
  };
  const preflightIdentity: PlatformReleaseContentStorePublisherPreflightTestHashPayloadV3 = {
    schema: PLATFORM_RELEASE_CONTENT_STORE_PUBLISHER_PREFLIGHT_TEST_V3_SCHEMA,
    version: "3.0.0",
    admissionScope: "test_fixture",
    productionAuthority: false,
    productionAdmission: "forbidden",
    credentialUse: "none",
    signingAuthority: "unsigned_test_fixture",
    mutationAuthority: false,
    trustConclusion: "characterization_only",
    productionBlockers: [
      ...PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS,
    ],
    authorityState: "test_fixture_publisher_preflight_unverified",
    operationMode: "test_fixture_preflight_only",
    baselineCensus,
    candidateFinalCensus: finalCensus,
    candidate,
    disposition: "append_candidate_delta",
    delta: {
      ...deltaIdentity,
      deltaHash:
        hashPlatformReleaseContentStoreCandidateDeltaTestV3(deltaIdentity),
    },
    expectedFinalCensusHash: finalCensus.censusHash,
  };
  const preflight =
    parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3({
      ...preflightIdentity,
      preflightHash:
        hashPlatformReleaseContentStorePublisherPreflightTestV3(
          preflightIdentity,
        ),
    });
  const receipt =
    buildPlatformReleaseContentStoreLeafReceiptFromPreflightTestV3(preflight);
  return buildPlatformReleaseContentStoreDurableRecordTestV3({
    recordOrdinal: input.ordinal,
    priorRecordHash: input.priorRecordHash,
    preflight,
    leafReceipt: receipt,
  });
}

function rowForRecord(
  record: PlatformReleaseContentStoreDurableRecordTestV3,
): PlatformReleaseStoreRecordLedgerV3DataRow {
  const candidate = record.preflight.candidate;
  return {
    record_hash: record.recordHash,
    record_schema: record.schema,
    record_version: record.version,
    admission_scope: record.admissionScope,
    production_authority: record.productionAuthority,
    production_admission: record.productionAdmission,
    record_ordinal: record.recordOrdinal,
    prior_record_hash: record.priorRecordHash,
    host_identity_hash: record.preflight.candidateFinalCensus.hostIdentityHash,
    manifest_payload_hash: candidate.manifestPayloadHash,
    attestation_hash: candidate.attestationHash,
    release_content_hash: candidate.releaseContentHash,
    candidate_hash: candidate.candidateHash,
    preflight_hash: record.preflight.preflightHash,
    leaf_receipt_hash: record.leafReceipt.receiptHash,
    published_census_hash: record.leafReceipt.publishedCensusHash,
    manifest_byte_length: candidate.manifestByteLength,
    attestation_byte_length: candidate.attestationByteLength,
    publication: record.leafReceipt.publication,
    record_payload: record,
    recorded_at: new Date("2026-08-06T12:00:00.000Z"),
  };
}

type MockShape = "absent" | "present" | "partial";

class LedgerSqlMock {
  shape: MockShape;
  rowCount: number;
  auditRows: PlatformReleaseStoreRecordLedgerV3DataRow[];
  readonly executedStatements: string[] = [];
  readonly observedSql: string[] = [];
  readonly advisoryLockParameters: readonly unknown[][] = [];
  driftColumn = false;
  driftIdentity = false;
  driftConstraint = false;
  driftConstraintLiteralCase = false;
  driftFunctionLiteralCase = false;
  driftOwner = false;
  driftAcl = false;
  driftColumnAcl = false;
  externalDependencies = 0;
  extraIndex = false;
  guardTriggerWhenFalse = false;
  transactionIsolation = "repeatable read";
  transactionReadOnly = true;

  constructor(options: Readonly<{
    shape?: MockShape;
    rowCount?: number;
    auditRows?: PlatformReleaseStoreRecordLedgerV3DataRow[];
  }> = {}) {
    this.shape = options.shape ?? "present";
    this.rowCount = options.rowCount ?? options.auditRows?.length ?? 0;
    this.auditRows = options.auditRows ?? [];
  }

  async unsafe<T extends readonly unknown[] = readonly unknown[]>(
    query: string,
    parameters?: readonly unknown[],
  ): Promise<T> {
    const normalized = query.replace(/\s+/gu, " ").trim();
    this.observedSql.push(normalized);
    if (normalized.startsWith("SELECT pg_advisory_xact_lock")) {
      (this.advisoryLockParameters as unknown[][]).push([...(parameters ?? [])]);
      return [{ pg_advisory_xact_lock: null }] as unknown as T;
    }
    if (normalized.startsWith("LOCK TABLE")) {
      return [] as unknown as T;
    }
    if (normalized.includes("current_setting('transaction_isolation')")) {
      return [{
        isolation: this.transactionIsolation,
        read_only: this.transactionReadOnly,
      }] as unknown as T;
    }
    if (normalized.startsWith("CREATE ") || normalized.startsWith("REVOKE ")) {
      this.executedStatements.push(query);
      if (query.includes(PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TRUNCATE_TRIGGER)) {
        this.shape = "present";
      }
      return [] as unknown as T;
    }
    if (normalized.startsWith("SELECT to_regclass")) {
      return [{
        relation: this.shape === "absent"
          ? null
          : `public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}`,
      }] as unknown as T;
    }
    if (normalized.includes("COUNT(*)::integer AS count FROM pg_proc")) {
      return [{ count: this.shape === "present" ? 1 : 0 }] as unknown as T;
    }
    if (normalized.includes("COUNT(*)::integer AS count FROM pg_trigger")) {
      return [{ count: this.shape === "present" ? 2 : 0 }] as unknown as T;
    }
    if (normalized.includes("FROM pg_class c") && normalized.includes("inheritance_edges")) {
      return [{
        relkind: "r",
        relpersistence: "p",
        relispartition: false,
        relrowsecurity: false,
        relforcerowsecurity: false,
        inheritance_edges: 0,
        rules: 0,
        policies: 0,
      }] as unknown as T;
    }
    if (normalized.includes("FROM information_schema.columns")) {
      const rows = PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_COLUMNS.map(
        (column) => ({
          column_name: column.name,
          ordinal_position: column.position,
          data_type: column.dataType,
          is_nullable: column.nullable,
          column_default: column.defaultValue || null,
          collation_schema: column.collationSchema,
          collation_name: column.collationName,
          udt_schema: column.udtSchema,
          udt_name: column.udtName,
          domain_schema: column.domainSchema,
          domain_name: column.domainName,
          is_identity: column.isIdentity,
          is_generated: column.isGenerated,
        }),
      );
      if (this.driftColumn) rows[0]!.data_type = "character varying";
      if (this.driftIdentity) rows[0]!.is_identity = "YES";
      return rows as unknown as T;
    }
    if (normalized.startsWith("SELECT conname")) {
      const rows = Object.entries(
        PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_CONSTRAINTS,
      ).map(([name, definition]) => ({
        conname: name,
        contype: name.endsWith("_pkey")
          ? "p"
          : name.endsWith("_unique")
          ? "u"
          : name.endsWith("_fkey")
          ? "f"
          : "c",
        definition,
        validated: true,
        deferrable: false,
        initially_deferred: false,
      })).sort((left, right) => left.conname.localeCompare(right.conname));
      if (this.driftConstraint) {
        rows.find((row) => row.conname.endsWith("schema_check"))!.definition =
          "CHECK (record_schema IS NOT NULL)";
      }
      if (this.driftConstraintLiteralCase) {
        const hashes = rows.find((row) => row.conname.endsWith("hashes_check"))!;
        hashes.definition = hashes.definition.replace("[a-f0-9]", "[A-F0-9]");
      }
      return rows as unknown as T;
    }
    if (normalized.startsWith("SELECT index_relation.relname AS name")) {
      const rows = Object.entries(
        PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_EXPECTED_INDEXES,
      ).map(([name, definition]) => ({
        name,
        definition,
        valid: true,
        ready: true,
        live: true,
      }));
      if (this.extraIndex) {
        rows.push({
          name: "platform_release_store_records_v3_extra",
          definition: `CREATE INDEX platform_release_store_records_v3_extra ON public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE} USING btree (record_schema)`,
          valid: true,
          ready: true,
          live: true,
        });
      }
      return rows as unknown as T;
    }
    if (normalized.includes("p.prosrc AS body")) {
      return [{
        name: PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION,
        body: this.driftFunctionLiteralCase
          ? PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION_BODY_SQL.replace(
              "TG_OP = 'INSERT'",
              "TG_OP = 'insert'",
            )
          : PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION_BODY_SQL,
        language: "plpgsql",
        volatility: "v",
        parallel_safety: "u",
        security_definer: false,
        leakproof: false,
        strict: false,
        returns_set: false,
        configuration: ["search_path=pg_catalog, public"],
        result: "trigger",
        arguments: "",
      }] as unknown as T;
    }
    if (normalized.startsWith("WITH expected_owner AS")) {
      return [{
        table_owner_exact: !this.driftOwner,
        function_owner_exact: !this.driftOwner,
        table_acl_exact: !this.driftAcl,
        column_acl_exact: !this.driftColumnAcl,
        function_acl_exact: !this.driftAcl,
      }] as unknown as T;
    }
    if (normalized.includes("pg_get_triggerdef")) {
      return [{
        name: PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_GUARD_TRIGGER,
        relation: PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE,
        enabled: "O",
        deferrable: false,
        initially_deferred: false,
        definition: `CREATE TRIGGER ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_GUARD_TRIGGER} BEFORE INSERT OR DELETE OR UPDATE ON ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE} FOR EACH ROW${this.guardTriggerWhenFalse ? " WHEN (false)" : ""} EXECUTE FUNCTION ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION}()`,
        function_identity: `${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION}()`,
      }, {
        name: PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TRUNCATE_TRIGGER,
        relation: PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE,
        enabled: "O",
        deferrable: false,
        initially_deferred: false,
        definition: `CREATE TRIGGER ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TRUNCATE_TRIGGER} BEFORE TRUNCATE ON ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE} FOR EACH STATEMENT EXECUTE FUNCTION ${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION}()`,
        function_identity: `${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_FUNCTION}()`,
      }] as unknown as T;
    }
    if (normalized.startsWith("WITH ledger AS")
      && normalized.includes("COUNT(DISTINCT (dependency.classid")) {
      return [{ count: this.externalDependencies }] as unknown as T;
    }
    if (normalized.startsWith("SELECT COUNT(*)::integer AS count FROM public.")) {
      return [{ count: this.rowCount }] as unknown as T;
    }
    if (normalized.includes("record_payload, recorded_at")
      && normalized.includes(`FROM public.${PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TABLE}`)) {
      const ordinal = Number(parameters?.[0]);
      return this.auditRows.filter((row) => row.record_ordinal === ordinal) as unknown as T;
    }
    throw new Error(`UNEXPECTED_LEDGER_SQL:${normalized.slice(0, 160)}`);
  }
}

function asSql(mock: LedgerSqlMock): postgres.Sql {
  return mock as unknown as postgres.Sql;
}

function asTransactionSql(mock: LedgerSqlMock): postgres.TransactionSql {
  return mock as unknown as postgres.TransactionSql;
}

describe("platform release-store durable record ledger v3 migration helper", () => {
  it("defines one false-authority table, tail-serializing function, and two immutable triggers", () => {
    assert.equal(PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_STATEMENTS.length, 6);
    const sql = PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_STATEMENTS.join("\n");
    assert.match(sql, /CREATE TABLE public\.platform_release_store_records_v3/u);
    assert.match(sql, /production_authority = FALSE/u);
    assert.match(sql, /storeAuthority' = 'false'/u);
    assert.match(sql, /restartAuthority' = 'false'/u);
    assert.match(sql, /preparedPlatformReleaseIssued' = 'false'/u);
    assert.match(sql, /FOREIGN KEY \(prior_record_hash\)/u);
    assert.match(sql, /pg_advisory_xact_lock/u);
    assert.match(sql, /NEW\.recorded_at := clock_timestamp\(\)/u);
    assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC/u);
    assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC/u);
    assert.match(sql, /BEFORE INSERT OR UPDATE OR DELETE/u);
    assert.match(sql, /BEFORE TRUNCATE/u);
    assert.doesNotMatch(sql, /PreparedPlatformReleaseV2/u);
  });

  it("detects absent/present/partial and creates or adopts only an exact empty shape", async () => {
    assert.equal(
      await detectPlatformReleaseStoreRecordLedgerV3(
        asSql(new LedgerSqlMock({ shape: "absent" })),
      ),
      "absent",
    );
    assert.equal(
      await detectPlatformReleaseStoreRecordLedgerV3(
        asSql(new LedgerSqlMock({ shape: "present" })),
      ),
      "present",
    );
    assert.equal(
      await detectPlatformReleaseStoreRecordLedgerV3(
        asSql(new LedgerSqlMock({ shape: "partial" })),
      ),
      "partial",
    );

    const absent = new LedgerSqlMock({ shape: "absent" });
    assert.equal(
      await applyPlatformReleaseStoreRecordLedgerV3(asTransactionSql(absent)),
      "created",
    );
    assert.deepEqual(
      absent.executedStatements,
      PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_STATEMENTS,
    );
    assert.deepEqual(absent.advisoryLockParameters, [
      [...PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_INSTALL_ADVISORY_LOCK_KEYS],
    ]);
    const present = new LedgerSqlMock({ shape: "present" });
    assert.equal(
      await applyPlatformReleaseStoreRecordLedgerV3(asTransactionSql(present)),
      "adopted",
    );
    assert.equal(present.executedStatements.length, 0);
    const advisories = present.observedSql
      .map((query, index) =>
        query.startsWith("SELECT pg_advisory_xact_lock") ? index : -1)
      .filter((index) => index >= 0);
    const accessExclusive = present.observedSql.findIndex((query) =>
      query.startsWith("LOCK TABLE") && query.includes("ACCESS EXCLUSIVE"));
    const detections = present.observedSql
      .map((query, index) => query.startsWith("SELECT to_regclass") ? index : -1)
      .filter((index) => index >= 0);
    const adoptionCount = present.observedSql.findIndex((query) =>
      query.startsWith("SELECT COUNT(*)::integer AS count FROM public."));
    assert.deepEqual(present.advisoryLockParameters, [
      [...PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_INSTALL_ADVISORY_LOCK_KEYS],
      [...PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_ADVISORY_LOCK_KEYS],
    ]);
    assert.equal(advisories[0]! < detections[0]!, true);
    assert.equal(detections[0]! < accessExclusive, true);
    assert.equal(accessExclusive < advisories[1]!, true);
    assert.equal(advisories[1]! < detections[1]!, true);
    assert.equal(detections[1]! < adoptionCount, true);

    // Models a writer that acquired RowExclusive before adoption. ACCESS
    // EXCLUSIVE waits without holding the record advisory; after that writer
    // commits, the fenced count observes its row and adoption rejects it.
    const completedWriter = new LedgerSqlMock({ shape: "present", rowCount: 1 });
    await assert.rejects(
      applyPlatformReleaseStoreRecordLedgerV3(asTransactionSql(completedWriter)),
      (error: unknown) => error
        instanceof PlatformReleaseStoreRecordLedgerV3MigrationError
        && error.code
          === "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_ADOPTION_REQUIRES_EMPTY",
    );
    const completedWriterAccess = completedWriter.observedSql.findIndex((query) =>
      query.startsWith("LOCK TABLE") && query.includes("ACCESS EXCLUSIVE"));
    const completedWriterCount = completedWriter.observedSql.findIndex((query) =>
      query.startsWith("SELECT COUNT(*)::integer AS count FROM public."));
    assert.equal(completedWriterAccess < completedWriterCount, true);
    await assert.rejects(
      applyPlatformReleaseStoreRecordLedgerV3(asTransactionSql(
        new LedgerSqlMock({ shape: "partial" }),
      )),
      (error: unknown) => error
        instanceof PlatformReleaseStoreRecordLedgerV3MigrationError
        && error.code === "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_PARTIAL",
    );
  });

  it("rejects exact column, constraint, function, owner/ACL, dependency, index, and trigger drift", async () => {
    const column = new LedgerSqlMock();
    column.driftColumn = true;
    await assert.rejects(
      verifyPlatformReleaseStoreRecordLedgerV3(asSql(column)),
      (error: unknown) => error
        instanceof PlatformReleaseStoreRecordLedgerV3MigrationError
        && error.code
          === "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TOPOLOGY_INVALID",
    );
    const identity = new LedgerSqlMock();
    identity.driftIdentity = true;
    await assert.rejects(
      verifyPlatformReleaseStoreRecordLedgerV3(asSql(identity)),
      /exact columns mismatch/u,
    );
    const constraint = new LedgerSqlMock();
    constraint.driftConstraint = true;
    await assert.rejects(
      verifyPlatformReleaseStoreRecordLedgerV3(asSql(constraint)),
      /exact constraints\/FK mismatch/u,
    );
    const constraintLiteralCase = new LedgerSqlMock();
    constraintLiteralCase.driftConstraintLiteralCase = true;
    await assert.rejects(
      verifyPlatformReleaseStoreRecordLedgerV3(asSql(constraintLiteralCase)),
      /exact constraints\/FK mismatch/u,
    );
    const functionLiteralCase = new LedgerSqlMock();
    functionLiteralCase.driftFunctionLiteralCase = true;
    await assert.rejects(
      verifyPlatformReleaseStoreRecordLedgerV3(asSql(functionLiteralCase)),
      /exact function mismatch/u,
    );
    const owner = new LedgerSqlMock();
    owner.driftOwner = true;
    await assert.rejects(
      verifyPlatformReleaseStoreRecordLedgerV3(asSql(owner)),
      /exact owner\/ACL mismatch/u,
    );
    const acl = new LedgerSqlMock();
    acl.driftAcl = true;
    await assert.rejects(
      verifyPlatformReleaseStoreRecordLedgerV3(asSql(acl)),
      /exact owner\/ACL mismatch/u,
    );
    const columnAcl = new LedgerSqlMock();
    columnAcl.driftColumnAcl = true;
    await assert.rejects(
      verifyPlatformReleaseStoreRecordLedgerV3(asSql(columnAcl)),
      /exact owner\/ACL mismatch/u,
    );
    const dependency = new LedgerSqlMock();
    dependency.externalDependencies = 1;
    await assert.rejects(
      verifyPlatformReleaseStoreRecordLedgerV3(asSql(dependency)),
      /has external dependencies/u,
    );
    const index = new LedgerSqlMock();
    index.extraIndex = true;
    await assert.rejects(
      verifyPlatformReleaseStoreRecordLedgerV3(asSql(index)),
      /exact indexes mismatch/u,
    );
    const trigger = new LedgerSqlMock();
    trigger.guardTriggerWhenFalse = true;
    await assert.rejects(
      verifyPlatformReleaseStoreRecordLedgerV3(asSql(trigger)),
      (error: unknown) => error
        instanceof PlatformReleaseStoreRecordLedgerV3MigrationError
        && error.code
          === "PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_TOPOLOGY_INVALID"
        && /exact triggers mismatch/u.test(error.message),
    );
  });

  it("audits a two-record ordinal/prior/census append chain read-only", async () => {
    const first = buildRecord({
      ordinal: 0,
      priorRecordHash: null,
      baseline: [],
      final: [ATTESTATION_A],
      candidate: ATTESTATION_A,
    });
    const second = buildRecord({
      ordinal: 1,
      priorRecordHash: first.recordHash,
      baseline: [ATTESTATION_A],
      final: [ATTESTATION_A, ATTESTATION_B],
      candidate: ATTESTATION_B,
    });
    const mock = new LedgerSqlMock({
      auditRows: [rowForRecord(first), rowForRecord(second)],
    });
    const queryPhases: string[] = [];
    const settledQueryPhases: string[] = [];
    const parseOrdinals: number[] = [];
    const settledParseOrdinals: number[] = [];
    const result = await auditPlatformReleaseStoreRecordLedgerV3Data(
      asTransactionSql(mock),
      {
        beforeQuery: (phase) => queryPhases.push(phase),
        afterQuery: (phase) => settledQueryPhases.push(phase),
        beforeRowParse: (ordinal) => parseOrdinals.push(ordinal),
        afterRowParse: (ordinal) => settledParseOrdinals.push(ordinal),
      },
    );

    assert.deepEqual(result, {
      schema: "setfarm.platform-release-store-record-ledger-audit.v3",
      status: "integrity_verified",
      authorityState: "database_record_integrity_audit_only",
      productionAuthority: false,
      productionAdmission: "forbidden",
      mutationAuthority: false,
      storeAuthority: false,
      restartAuthority: false,
      trustConclusion: "characterization_only",
      recordCount: 2,
      tailRecordHash: second.recordHash,
      tailPublishedCensusHash: second.leafReceipt.publishedCensusHash,
    });
    assert.deepEqual(queryPhases, [
      "transaction-contract",
      "ledger-lock",
      "ledger-topology",
      "record-count",
      "record-query:0",
      "record-query:1",
    ]);
    assert.deepEqual(settledQueryPhases, queryPhases);
    assert.deepEqual(parseOrdinals, [0, 1]);
    assert.deepEqual(settledParseOrdinals, parseOrdinals);
    assert.equal(
      mock.executedStatements.some((statement) =>
        /INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE/u.test(statement)),
      false,
    );
    const transactionCheck = mock.observedSql.findIndex((query) =>
      query.includes("transaction_isolation"));
    const shareLock = mock.observedSql.findIndex((query) =>
      query.startsWith("LOCK TABLE") && query.includes("IN ACCESS SHARE MODE"));
    const topology = mock.observedSql.findIndex((query) =>
      query.includes("FROM pg_class c") && query.includes("inheritance_edges"));
    const count = mock.observedSql.findIndex((query) =>
      query.startsWith("SELECT COUNT(*)::integer AS count FROM public."));
    const rowFetches = mock.observedSql.filter((query) =>
      query.includes("WHERE record_ordinal = $1"));
    assert.equal(transactionCheck >= 0, true);
    assert.equal(transactionCheck < shareLock, true);
    assert.equal(shareLock < topology, true);
    assert.equal(topology < count, true);
    assert.equal(rowFetches.length, 2);
    assert.equal(
      mock.observedSql.some((query) =>
        query.startsWith("LOCK TABLE") && query.includes("IN SHARE MODE")),
      false,
    );
    assert.equal(
      mock.observedSql.some((query) => query.includes("ORDER BY record_ordinal")),
      false,
    );
  });

  it("rejects scalar projection drift, nonempty genesis, and a mismatched append baseline", async () => {
    const validFirst = buildRecord({
      ordinal: 0,
      priorRecordHash: null,
      baseline: [],
      final: [ATTESTATION_A],
      candidate: ATTESTATION_A,
    });
    const projection = rowForRecord(validFirst);
    await assert.rejects(
      auditPlatformReleaseStoreRecordLedgerV3Data(asTransactionSql(new LedgerSqlMock({
        auditRows: [{ ...projection, host_identity_hash: sha("wrong-host") }],
      }))),
      /scalar projection mismatch/u,
    );

    const nonemptyGenesis = buildRecord({
      ordinal: 0,
      priorRecordHash: null,
      baseline: [ATTESTATION_A],
      final: [ATTESTATION_A, ATTESTATION_B],
      candidate: ATTESTATION_B,
    });
    await assert.rejects(
      auditPlatformReleaseStoreRecordLedgerV3Data(asTransactionSql(new LedgerSqlMock({
        auditRows: [rowForRecord(nonemptyGenesis)],
      }))),
      /genesis baseline is not empty/u,
    );

    const foreignSecond = buildRecord({
      ordinal: 1,
      priorRecordHash: validFirst.recordHash,
      baseline: [ATTESTATION_FOREIGN],
      final: [ATTESTATION_FOREIGN, ATTESTATION_B],
      candidate: ATTESTATION_B,
    });
    await assert.rejects(
      auditPlatformReleaseStoreRecordLedgerV3Data(asTransactionSql(new LedgerSqlMock({
        auditRows: [rowForRecord(validFirst), rowForRecord(foreignSecond)],
      }))),
      /prior chain mismatch|append-only baseline mismatch/u,
    );
  });

  it("requires read-only repeatable-read audit fencing and bounded ordinal fetches", async () => {
    const notReadOnly = new LedgerSqlMock();
    notReadOnly.transactionReadOnly = false;
    await assert.rejects(
      auditPlatformReleaseStoreRecordLedgerV3Data(asTransactionSql(notReadOnly)),
      /read-only repeatable-read transaction/u,
    );
    assert.equal(
      notReadOnly.observedSql.some((query) => query.startsWith("LOCK TABLE")),
      false,
    );

    const wrongIsolation = new LedgerSqlMock();
    wrongIsolation.transactionIsolation = "read committed";
    await assert.rejects(
      auditPlatformReleaseStoreRecordLedgerV3Data(asTransactionSql(wrongIsolation)),
      /read-only repeatable-read transaction/u,
    );

    const first = buildRecord({
      ordinal: 0,
      priorRecordHash: null,
      baseline: [],
      final: [ATTESTATION_A],
      candidate: ATTESTATION_A,
    });
    const gap = new LedgerSqlMock({
      rowCount: 2,
      auditRows: [rowForRecord(first)],
    });
    await assert.rejects(
      auditPlatformReleaseStoreRecordLedgerV3Data(asTransactionSql(gap)),
      /ordinal gap at 1/u,
    );
    assert.equal(
      gap.observedSql.filter((query) => query.includes("WHERE record_ordinal = $1"))
        .length,
      2,
    );

    const oversized = new LedgerSqlMock({ rowCount: 257 });
    await assert.rejects(
      auditPlatformReleaseStoreRecordLedgerV3Data(asTransactionSql(oversized)),
      /exceeds its bounded row count/u,
    );
    assert.equal(
      oversized.observedSql.some((query) => query.includes("WHERE record_ordinal = $1")),
      false,
    );
  });
});
