import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createFreshInstallationApplicationV1,
  parseFreshInstallationOriginV1,
} from "../../src/installation/fresh-installation-origin-v1.js";
import {
  createInternalProductionOwnerReservationV1,
  INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
} from "../../src/internal-production/owner-admission-v1.js";
import type { OwnerAdmissionMigrationApplicationV1 } from "../../src/internal-production/owner-admission-head-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { freshOwnerAuthorityDataV1 } from "./fresh-installation-owner-authority-data.js";

// Source-component tests only: synthetic DATA never admits a release, runtime,
// administrative transaction, or live owner. The genuine private running-step
// region imports all genuine validators; only its SQL row input is in memory.
// Do not import step-ops itself here: its unrelated orchestration graph is not
// an import-inert unit-test boundary. Real claim/reissue remains an integration
// test after a reviewed finalized build and actual privileged activation.
const INVALID = "RUNNING_SINGLE_STEP_OWNER_ANCESTRY_INVALID";
const ZERO = "0".repeat(64);
type Row = Record<string, unknown>;
type RowSql = { unsafe(query: string, parameters?: readonly unknown[]): Promise<unknown[]> };
let fixtureDirectory: string | undefined;
let running: {
  parse(value: unknown, evidenceHash: string): OwnerAdmissionMigrationApplicationV1;
  observe(sql: RowSql): Promise<readonly Readonly<{ version: number; authority: Row }>[]>;
};

before(async () => {
  const source = await readFile(new URL("../../src/installer/step-ops.ts", import.meta.url), "utf8");
  const startMarker = "type RunningSingleStepOwnerAuthorityRowV1 =";
  const endMarker = "async function authenticateRunningSingleStepOwnerSidecarsV1(";
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start);
  assert.equal(source.lastIndexOf(startMarker), start);
  assert.equal(source.lastIndexOf(endMarker), end);
  const owner = new URL("../../src/internal-production/owner-admission-v1.ts", import.meta.url).href;
  const head = new URL("../../src/internal-production/owner-admission-head-v1.ts", import.meta.url).href;
  const canonical = new URL("../../src/product-compiler/canonical-json.ts", import.meta.url).href;
  fixtureDirectory = await mkdtemp(path.join(tmpdir(), "setfarm-running-owner-application-"));
  const fixturePath = path.join(fixtureDirectory, "running-owner-component.ts");
  await writeFile(fixturePath, `
import type { PgTransactionSql } from ${JSON.stringify(owner)};
import {
  INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  createInternalProductionGlobalOwnerAdmissionFenceTransitionV1,
  createInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1,
  validateInternalProductionGlobalOwnerAdmissionFenceV1,
  validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1,
  validateInternalProductionOwnerReservationV1,
  validateInternalProductionOwnerReservationCloseV1,
} from ${JSON.stringify(owner)};
import {
  validateOwnerAdmissionMigrationApplicationV1,
  type OwnerAdmissionMigrationApplicationV1,
} from ${JSON.stringify(head)};
import { canonicalJsonStringify, hashCanonicalJson } from ${JSON.stringify(canonical)};
${source.slice(start, end)}
export {
  validateRunningSingleStepOwnerMigrationApplicationV1 as parse,
  observeRunningSingleStepOwnerAncestryV1 as observe,
};
`, { mode: 0o600 });
  running = await import(pathToFileURL(fixturePath).href) as typeof running;
});

after(async () => {
  if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true });
});

function freshApplication() {
  return createFreshInstallationApplicationV1(
    parseFreshInstallationOriginV1(freshOwnerAuthorityDataV1().origin),
  );
}

function legacyApplication() {
  const body = {
    schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-application.v1" as const,
    evidenceHash: "a".repeat(64),
    authorizationRef: "setfarm://tests/running-step/migration-authorization",
    authorizationHash: "b".repeat(64),
    authorizationConsumptionRef: "setfarm://tests/running-step/migration-consumption",
    authorizationConsumptionHash: "c".repeat(64),
  };
  return { ...body, applicationHash: hashCanonicalJson(body) };
}

function rowsFor(head: Row, authorities: readonly Row[] = []): RowSql {
  return {
    async unsafe(query, parameters = []) {
      if (query.includes("FROM internal_production_owner_admission_head_v1")) return [head];
      if (query.includes("FROM internal_production_owner_admission_authorities_v1")) {
        return authorities.filter(row => row.successor_head_hash === parameters[0]
          && row.predecessor_head_hash !== row.successor_head_hash);
      }
      throw new Error("unexpected source-component SQL input");
    },
  };
}

function reservationChain(application: OwnerAdmissionMigrationApplicationV1) {
  const reservation = createInternalProductionOwnerReservationV1({
    producer: INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.rows[0]!,
    ownerKey: "running-owner-application-component",
    ownerAdmissionHeadPredecessorHash: ZERO,
  });
  // Construct the expected head independently of the private successor helper.
  const payload = {
    schema: "setfarm.internal-production-owner-admission-head.v1",
    version: 1,
    predecessorHeadHash: ZERO,
    transitionKind: "reservation",
    transitionRef: reservation.reservationRef,
    transitionHash: reservation.reservationHash,
    migrationApplication: application,
  };
  const hash = hashCanonicalJson(payload);
  const head = {
    head_version: "1", head_hash: hash,
    active_fence_ref: null, active_fence_hash: null, active_target_family_hash: null,
    migration_application_evidence_hash: application.evidenceHash,
    head_payload: payload,
  };
  const authority = {
    authority_ref: reservation.reservationRef, authority_hash: reservation.reservationHash,
    authority_kind: "reservation", phase_key: reservation.reservationRef,
    predecessor_head_hash: ZERO, successor_head_hash: hash, authority_body: reservation,
  };
  return { head, authority, payload };
}

test("running-step parser accepts distinct fresh and legacy applications without legacy reminting", () => {
  for (const application of [freshApplication(), legacyApplication()]) {
    const parsed = running.parse(application, application.evidenceHash);
    assert.deepEqual(parsed, application);
    assert.notEqual(parsed, application);
    assert.equal(Object.isFrozen(parsed), true);
  }
  const parsed = running.parse(freshApplication(), freshApplication().evidenceHash);
  assert.equal(parsed.schema, "setfarm.fresh-installation-schema-application.v1");
  assert.equal(Object.hasOwn(parsed, "authorizationRef"), false);
  if (parsed.schema === "setfarm.fresh-installation-schema-application.v1") {
    assert.equal(Object.isFrozen(parsed.origin), true);
    assert.equal(Object.isFrozen(parsed.origin.migrations), true);
  }
});

test("running-step parser rejects mixed contracts, changed hashes and crossed evidence with its existing error", () => {
  const fresh = freshApplication(), legacy = legacyApplication();
  for (const [value, evidence] of [
    [{ ...fresh, authorizationRef: legacy.authorizationRef }, fresh.evidenceHash],
    [{ ...legacy, origin: fresh.origin }, legacy.evidenceHash],
    [{ ...fresh, applicationHash: "d".repeat(64) }, fresh.evidenceHash],
    [{ ...legacy, applicationHash: "d".repeat(64) }, legacy.evidenceHash],
    [fresh, "d".repeat(64)], [legacy, "d".repeat(64)],
    [null, fresh.evidenceHash],
  ] as const) assert.throws(() => running.parse(value, evidence), { message: INVALID });
});

test("running-step parser rejects accessors, proxies and reference coercion without invoking them", () => {
  let invoked = false;
  const accessor = structuredClone(freshApplication());
  Object.defineProperty(accessor, "schema", {
    enumerable: true, get() { invoked = true; return "setfarm.fresh-installation-schema-application.v1"; },
  });
  const proxy = new Proxy(freshApplication(), {
    getOwnPropertyDescriptor() { invoked = true; throw new Error("proxy trap"); },
  });
  const coercion = { ...legacyApplication(), authorizationRef: {
    toString() { invoked = true; return "setfarm://tests/running-step/coercion"; },
  } };
  for (const value of [accessor, proxy, coercion]) {
    assert.throws(() => running.parse(value, "a".repeat(64)), { message: INVALID });
  }
  assert.equal(invoked, false);
});

test("running-step ancestry authenticates genuine reservation records under both application variants", async () => {
  for (const application of [freshApplication(), legacyApplication()]) {
    const { head, authority } = reservationChain(application);
    const observed = await running.observe(rowsFor(head, [authority]));
    assert.deepEqual(observed, [{ version: 1, authority }]);
  }
});

test("fresh running-step applications retain head, fence and predecessor rejection", async () => {
  const { head, authority, payload } = reservationChain(freshApplication());
  for (const changed of [
    { ...head, head_hash: "d".repeat(64) },
    { ...head, head_version: "2" },
    { ...head, active_fence_ref: "setfarm://tests/running-step/fence", active_fence_hash: "d".repeat(64) },
    { ...head, head_payload: { ...payload, predecessorHeadHash: "d".repeat(64) } },
    { ...head, migration_application_evidence_hash: "d".repeat(64) },
  ]) await assert.rejects(running.observe(rowsFor(changed, [authority])), { message: INVALID });
  await assert.rejects(running.observe(rowsFor(head, [{ ...authority, predecessor_head_hash: "d".repeat(64) }])), { message: INVALID });
});

test("a separately self-consistent fresh application cannot reuse an existing running-step ancestry", async () => {
  const application = freshApplication();
  const { head, authority, payload } = reservationChain(application);
  const other = createFreshInstallationApplicationV1({ ...application.origin,
    databaseOid: application.origin.databaseOid + 1 });
  const changedPayload = { ...payload, migrationApplication: other };
  const changedHead = { ...head, head_hash: hashCanonicalJson(changedPayload),
    head_payload: changedPayload, migration_application_evidence_hash: other.evidenceHash };
  await assert.rejects(running.observe(rowsFor(changedHead, [authority])), { message: INVALID });
});
