import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  activateInternalProductionBaselineOwnerProducerManifestV1,
  observeInternalProductionBaselineOwnerProducerManifestActivationStatusV1,
  validateInternalProductionBaselineOwnerProducerManifestActivationStatusV1,
} from "../../src/internal-production/baseline-owner-producer-manifest-activation-controller-v1.js";

function absentStatus() {
  const body = {
    schema: "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1" as const,
    state: "absent" as const,
    predecessorActivationRef: null,
    predecessorActivationHash: null,
    predecessorHeadRef: null,
    predecessorHeadHash: null,
    successorActivationRef: null,
    successorActivationHash: null,
    successorHeadRef: null,
    successorHeadHash: null,
    receiptRef: null,
    receiptHash: null,
    manifestHash: null,
    sourceBuildAuthorityRef: null,
    sourceBuildAuthorityHash: null,
    blockedReason: null,
  };
  const statusHash = hashCanonicalJson(body);
  return { ...body, statusRef: `setfarm://internal-production/baseline-owner-producer-manifest-activation-status/sha256/${statusHash}`, statusHash };
}

test("pure activation parser rejects malformed status", () => {
  const status = absentStatus();
  assert.deepEqual(validateInternalProductionBaselineOwnerProducerManifestActivationStatusV1(status), status);
  assert.throws(
    () => validateInternalProductionBaselineOwnerProducerManifestActivationStatusV1({ ...status, extra: true }),
    /ACTIVATION_STATUS_KEYS_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionBaselineOwnerProducerManifestActivationStatusV1({ ...status, blockedReason: "CORRUPTION" }),
    /ACTIVATION_STATUS_SHAPE_INVALID/,
  );
  const blockedBody = {
    ...status,
    state: "blocked",
    blockedReason: "CURRENT_ENTRY_UNAVAILABLE",
    statusRef: undefined,
    statusHash: undefined,
  };
  const { statusRef: _statusRef, statusHash: _statusHash, ...blockedProjection } = blockedBody;
  const blockedHash = hashCanonicalJson(blockedProjection);
  assert.throws(
    () => validateInternalProductionBaselineOwnerProducerManifestActivationStatusV1({
      ...blockedProjection,
      statusRef: `setfarm://internal-production/baseline-owner-producer-manifest-activation-status/sha256/${blockedHash}`,
      statusHash: blockedHash,
    }),
    /ACTIVATION_STATUS_SHAPE_INVALID/,
  );
});

test("status parser rejects hidden descriptor members and crossed ref domains", () => {
  const hidden = absentStatus() as Record<string, unknown>;
  Object.defineProperty(hidden, "hidden", { value: true, enumerable: false });
  assert.throws(
    () => validateInternalProductionBaselineOwnerProducerManifestActivationStatusV1(hidden),
    /ACTIVATION_STATUS_KEYS_INVALID/,
  );
  const hash = "a".repeat(64);
  const activeBody = {
    schema: "setfarm.internal-production-baseline-owner-producer-manifest-activation-status.v1" as const,
    state: "active" as const,
    predecessorActivationRef: null,
    predecessorActivationHash: null,
    predecessorHeadRef: null,
    predecessorHeadHash: null,
    successorActivationRef: `setfarm://wrong-domain/sha256/${hash}`,
    successorActivationHash: hash,
    successorHeadRef: `setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/${hash}`,
    successorHeadHash: hash,
    receiptRef: `setfarm://internal-production/baseline-owner-producer-manifest-activation-receipt/sha256/${hash}`,
    receiptHash: hash,
    manifestHash: hash,
    sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${hash}`,
    sourceBuildAuthorityHash: hash,
    blockedReason: null,
  };
  const statusHash = hashCanonicalJson(activeBody);
  assert.throws(
    () => validateInternalProductionBaselineOwnerProducerManifestActivationStatusV1({
      ...activeBody,
      statusRef: `setfarm://internal-production/baseline-owner-producer-manifest-activation-status/sha256/${statusHash}`,
      statusHash,
    }),
    /ACTIVATION_STATUS_SHAPE_INVALID/,
  );
});

test("source boundary keeps activation PostgreSQL imports lazy", async () => {
  const source = await readFile(new URL("../../src/internal-production/baseline-owner-producer-manifest-activation-controller-v1.ts", import.meta.url), "utf8");
  const runtimeImports = [...source.matchAll(/^import(?!\s+type\b)[\s\S]*?from\s+["']([^"']+)["'];/gm)]
    .map((match) => match[1]);
  assert.deepEqual(runtimeImports, ["./owner-admission-v1.js", "../product-compiler/canonical-json.js"]);
  assert.doesNotMatch(source, /node:(?:fs|path|url|child_process)/);
  assert.doesNotMatch(source, /ensureSchemaReady|pgBegin/);
});

test("P4 current-entry resumes 32 audit 33 A verify init ready", async () => {
  const db = await import("../../src/db-pg.js");
  for (const name of [
    "applyOrAdoptInternalProductionCurrentEntryOrdinaryMigration33V1",
    "verifyInternalProductionCurrentEntryDatabaseThroughMigration33AndManifestAV1",
    "initializeInternalProductionCurrentEntryDatabaseV1",
  ] as const) {
    const value = Reflect.get(db, name);
    assert.equal(typeof value, "function", name);
    assert.equal((value as Function).length, 0, name);
  }
});

test("controller alone calls the one-key A database port and never the public generic activator", async () => {
  const source = await readFile(new URL("../../src/internal-production/baseline-owner-producer-manifest-activation-controller-v1.ts", import.meta.url), "utf8");
  assert.match(source, /activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1\(\{ sourceBuildAuthority: \{ plan: "A", sourceBuildAuthorityRef: source\.sourceBuildAuthorityRef, sourceBuildAuthorityHash: source\.sourceBuildAuthorityHash \} \}\)/);
  assert.doesNotMatch(source, /db\.activateInternalProductionOwnerProducerManifestSetV1\(/);
  assert.doesNotMatch(source, /privateCandidateDrift|Object\.getOwnPropertySymbols|Object\.getPrototypeOf\(error\)|error\.message|catch \(error\)/);
});

async function isolatedControllerFixture(options: Readonly<{ currentError?: boolean; committedA?: boolean; laterCurrent?: boolean; sourceFailure?: boolean; newCandidate?: boolean; postPortLaterCurrent?: boolean; dbMutationError?: boolean; dbCandidateDrift?: boolean }> = {}): Promise<{ root: string; moduleUrl: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "setfarm-owner-producer-controller-"));
  const internal = path.join(root, "src/internal-production");
  await mkdir(path.join(root, "src/execution"), { recursive: true });
  await mkdir(path.join(root, "src/product-compiler"), { recursive: true });
  await mkdir(internal, { recursive: true });
  await writeFile(path.join(root, "package.json"), '{"type":"module"}\n');
  await writeFile(path.join(root, "src/product-compiler/canonical-json.ts"), await readFile(new URL("../../src/product-compiler/canonical-json.ts", import.meta.url)));
  await writeFile(path.join(internal, "owner-admission-v1.ts"), `export const INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1="${"a".repeat(64)}"; export const INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1="${"b".repeat(64)}"; export const INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1={manifestHash:"${"c".repeat(64)}"}; export function validateInternalProductionOwnerProducerSourceBuildAuthorityV1(v){return v}\n`);
  const source = { branch: "main", clean: true, sha: "1".repeat(40), treeHash: "2".repeat(40), buildHash: "3".repeat(64), originMainSha: "1".repeat(40) };
  const response = { deliveryEvidenceRef: "mission-control://evidence", deliveryEvidenceHash: "4".repeat(64), evidence: { vendorLock: { producerCommit: "5".repeat(40) } } };
  const observation = { response };
  const preparedOperation = { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${"9".repeat(64)}`, operationHash: "9".repeat(64), controllerSource: source, productBuildAuthorityV2DeliveryEvidence: { deliveryEvidenceRef: response.deliveryEvidenceRef, deliveryEvidenceHash: response.deliveryEvidenceHash }, productBuildAuthorityV2Observation: observation };
  await writeFile(path.join(internal, "baseline-post-handoff-receipt-v1.ts"), options.sourceFailure
    ? `export function observeCurrentInternalProductionCleanSetfarmSourceBuildV1(){throw new Error("RAW_SOURCE_FAILURE")} export async function observePreparedInternalProductionCurrentEntryOperationV1(){return ${JSON.stringify(preparedOperation)}} export async function prepareInternalProductionCurrentEntryOperationV1(){throw new Error("PREPARE_CALLED")}\n`
    : options.newCandidate || options.postPortLaterCurrent || options.dbMutationError || options.dbCandidateDrift
      ? `const source=${JSON.stringify(source)}; export function observeCurrentInternalProductionCleanSetfarmSourceBuildV1(){return structuredClone(source)} export async function observePreparedInternalProductionCurrentEntryOperationV1(){return ${JSON.stringify(preparedOperation)}} export async function prepareInternalProductionCurrentEntryOperationV1(){throw new Error("PREPARE_CALLED")}\n`
    : `export function observeCurrentInternalProductionCleanSetfarmSourceBuildV1(){throw new Error("SOURCE_CALLED")} export async function observePreparedInternalProductionCurrentEntryOperationV1(){return null} export async function prepareInternalProductionCurrentEntryOperationV1(){throw new Error("PREPARE_CALLED")}\n`);
  await writeFile(path.join(internal, "product-build-authority-v2-delivery-evidence-v1.ts"), options.newCandidate || options.postPortLaterCurrent || options.dbMutationError || options.dbCandidateDrift
    ? `const observation=${JSON.stringify(observation)}; export async function observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(){return structuredClone(observation)} export function parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(v){return v}\n`
    : `export async function observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(){throw new Error("PBA_CALLED")} export function parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(v){return v}\n`);
  await writeFile(path.join(root, "src/execution/v3-git-revision.ts"), options.newCandidate || options.postPortLaterCurrent || options.dbMutationError || options.dbCandidateDrift
    ? `export function captureV3GitCommitRevision(){return {treeHash:"6".repeat(40)}} export function replayV3HistoricalGitCommitAncestryV1(){}\n`
    : `export function captureV3GitCommitRevision(){throw new Error("GIT_CALLED")} export function replayV3HistoricalGitCommitAncestryV1(){throw new Error("GIT_CALLED")}\n`);
  const committed = { receipt: { phase: "A", activationRef: `setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${"d".repeat(64)}`, activationHash: "d".repeat(64), orderedSourceBuildAuthorities: [{ plan: "A", sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${"e".repeat(64)}`, sourceBuildAuthorityHash: "e".repeat(64) }] }, head: { headRef: `setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/${"f".repeat(64)}`, headHash: "f".repeat(64) } };
  const later = { receipt: { ...committed.receipt, phase: "A+B", orderedSourceBuildAuthorities: [...committed.receipt.orderedSourceBuildAuthorities, { plan: "B", sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/B/sha256/${"8".repeat(64)}`, sourceBuildAuthorityHash: "8".repeat(64) }] }, head: { ...committed.head } };
  const newCandidateDb = `let current=null; const activationRef="setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${"d".repeat(64)}"; const activationHash="${"d".repeat(64)}"; const head={headRef:"setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/${"f".repeat(64)}",headHash:"${"f".repeat(64)}"}; let receipt=null; async function publish(sourceBuildAuthority){${options.dbMutationError ? 'throw new Error("RAW_SQLSTATE_23505")' : `receipt={phase:"A",activationRef,activationHash,orderedSourceBuildAuthorities:[sourceBuildAuthority]}; current=${options.postPortLaterCurrent ? JSON.stringify(later) : "{receipt,head}"}; return {activationRef,activationHash}`}} export async function activateInternalProductionOwnerProducerManifestSetV1(input){${options.dbCandidateDrift ? 'throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION")' : "return publish(input.orderedSourceBuildAuthorities[0])"}} export async function activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1(input){${options.dbCandidateDrift ? 'throw new Error("CURRENT_SOURCE_DRIFT")' : options.dbMutationError ? 'try{return await publish(input.sourceBuildAuthority)}catch{throw new Error("CORRUPTION")}' : "return publish(input.sourceBuildAuthority)"}} export async function resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1(){return current} export async function resolveInternalProductionOwnerProducerManifestSetActivationHeadV1(){return head} export async function resolveInternalProductionOwnerProducerManifestSetActivationV1(){return receipt}\n`;
  await writeFile(path.join(root, "src/db-pg.ts"), options.newCandidate || options.postPortLaterCurrent || options.dbMutationError || options.dbCandidateDrift
    ? newCandidateDb
    : `export async function activateInternalProductionOwnerProducerManifestSetV1(){throw new Error("DB_MUTATION_CALLED")} export async function resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1(){${options.currentError ? 'throw new Error("RAW_PG_FAILURE")' : options.committedA ? `return ${JSON.stringify(committed)}` : options.laterCurrent ? `return ${JSON.stringify(later)}` : "return null"}} export async function resolveInternalProductionOwnerProducerManifestSetActivationHeadV1(){throw new Error("HEAD_CALLED")} export async function resolveInternalProductionOwnerProducerManifestSetActivationV1(){throw new Error("ACTIVATION_CALLED")}\n`);
  await writeFile(path.join(internal, "baseline-owner-producer-manifest-activation-controller-v1.ts"), await readFile(new URL("../../src/internal-production/baseline-owner-producer-manifest-activation-controller-v1.ts", import.meta.url)));
  return { root, moduleUrl: pathToFileURL(path.join(internal, "baseline-owner-producer-manifest-activation-controller-v1.ts")).href };
}

test("private fake derives canonical activation status", async () => {
  const fixture = await isolatedControllerFixture();
  const controller = await import(`${fixture.moduleUrl}?status=${Date.now()}`);
  const status = await controller.observeInternalProductionBaselineOwnerProducerManifestActivationStatusV1();
  assert.equal(status.state, "absent");
  assert.deepEqual(controller.validateInternalProductionBaselineOwnerProducerManifestActivationStatusV1(status), status);
});

test("missing operation with migration32 state is finite and leaves current-entry bytes unchanged", async () => {
  const fixture = await isolatedControllerFixture();
  const store = path.join(fixture.root, "data/internal-production-baseline/current-entry-v1");
  await mkdir(store, { recursive: true });
  await writeFile(path.join(store, "pending-bootstrap-handoff-migration.json"), '{"migration":32}\n');
  const beforeNames = await readdir(store);
  const beforeBytes = await readFile(path.join(store, beforeNames[0]!));
  const controller = await import(`${fixture.moduleUrl}?missing=${Date.now()}`);
  await assert.rejects(
    controller.activateInternalProductionBaselineOwnerProducerManifestV1(),
    /^Error: CURRENT_ENTRY_UNAVAILABLE$/,
  );
  assert.deepEqual(await readdir(store), beforeNames);
  assert.deepEqual(await readFile(path.join(store, beforeNames[0]!)), beforeBytes);
});

test("committed-current corruption is finite before loading fresh activation ports", async () => {
  const fixture = await isolatedControllerFixture({ currentError: true });
  const controller = await import(`${fixture.moduleUrl}?corrupt-current=${Date.now()}`);
  await assert.rejects(
    controller.activateInternalProductionBaselineOwnerProducerManifestV1(),
    /^Error: CORRUPTION$/,
  );
});

test("fresh source observation failure is finite CURRENT_SOURCE_DRIFT before database mutation", async () => {
  const fixture = await isolatedControllerFixture({ sourceFailure: true });
  const controller = await import(`${fixture.moduleUrl}?source-drift=${Date.now()}`);
  await assert.rejects(
    controller.activateInternalProductionBaselineOwnerProducerManifestV1(),
    /^Error: CURRENT_SOURCE_DRIFT$/,
  );
});

test("committed later current is superseded and status uses committed rows only", async () => {
  const fixture = await isolatedControllerFixture({ laterCurrent: true });
  const controller = await import(`${fixture.moduleUrl}?later=${Date.now()}`);
  await assert.rejects(
    controller.activateInternalProductionBaselineOwnerProducerManifestV1(),
    /^Error: SUPERSEDED$/,
  );
  const status = await controller.observeInternalProductionBaselineOwnerProducerManifestActivationStatusV1();
  assert.equal(status.state, "blocked");
  assert.equal(status.blockedReason, "SUPERSEDED");
});

test("corrupt committed current maps to blocked CORRUPTION status", async () => {
  const fixture = await isolatedControllerFixture({ currentError: true });
  const controller = await import(`${fixture.moduleUrl}?corrupt-status=${Date.now()}`);
  const status = await controller.observeInternalProductionBaselineOwnerProducerManifestActivationStatusV1();
  assert.equal(status.state, "blocked");
  assert.equal(status.blockedReason, "CORRUPTION");
});

test("response-loss retry adopts committed A before every fresh observer", async () => {
  const fixture = await isolatedControllerFixture({ committedA: true });
  const controller = await import(`${fixture.moduleUrl}?response-loss=${Date.now()}`);
  const first = await controller.activateInternalProductionBaselineOwnerProducerManifestV1();
  const second = await controller.activateInternalProductionBaselineOwnerProducerManifestV1();
  assert.deepEqual(second, first);
  assert.equal(first.plan, "A");
  assert.equal(first.manifestHash, "c".repeat(64));
  assert.equal(first.successorActivationHash, "d".repeat(64));
  assert.equal(first.sourceBuildAuthorityHash, "e".repeat(64));
  assert.equal(first.successorHeadHash, "f".repeat(64));
});

test("seeded-null activation publishes once then response-loss retry adopts committed output", async () => {
  const fixture = await isolatedControllerFixture({ newCandidate: true });
  const controller = await import(`${fixture.moduleUrl}?initial=${Date.now()}`);
  const first = await controller.activateInternalProductionBaselineOwnerProducerManifestV1();
  const second = await controller.activateInternalProductionBaselineOwnerProducerManifestV1();
  assert.deepEqual(second, first);
  assert.equal(first.plan, "A");
  assert.equal(first.successorActivationHash, "d".repeat(64));
  const status = await controller.observeInternalProductionBaselineOwnerProducerManifestActivationStatusV1();
  assert.equal(status.state, "active");
  assert.equal(status.statusRef.endsWith(status.statusHash), true);
});

test("post-port later current is SUPERSEDED instead of corruption", async () => {
  const fixture = await isolatedControllerFixture({ postPortLaterCurrent: true });
  const controller = await import(`${fixture.moduleUrl}?post-port-later=${Date.now()}`);
  await assert.rejects(
    controller.activateInternalProductionBaselineOwnerProducerManifestV1(),
    /^Error: SUPERSEDED$/,
  );
});

test("database mutation failures cannot leak raw SQL diagnostics", async () => {
  const fixture = await isolatedControllerFixture({ dbMutationError: true });
  const controller = await import(`${fixture.moduleUrl}?db-error=${Date.now()}`);
  await assert.rejects(
    controller.activateInternalProductionBaselineOwnerProducerManifestV1(),
    /^Error: CORRUPTION$/,
  );
});

test("database private candidate drift remains CURRENT_SOURCE_DRIFT at the wrapper boundary", async () => {
  const fixture = await isolatedControllerFixture({ dbCandidateDrift: true });
  const controller = await import(`${fixture.moduleUrl}?db-candidate-drift=${Date.now()}`);
  let observed: unknown;
  try {
    await controller.activateInternalProductionBaselineOwnerProducerManifestV1();
  } catch (error) {
    observed = error;
  }
  assert.ok(observed instanceof Error);
  assert.equal(observed.message, "CURRENT_SOURCE_DRIFT");
  assert.equal(Object.getPrototypeOf(observed), Error.prototype);
  assert.deepEqual(Reflect.ownKeys(observed).filter((key) => key !== "stack" && key !== "message"), []);
});

test("public current is repeatable-read nonlocking while transaction-pinned current keeps FOR UPDATE", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  const db = await import("../../src/db-pg.js");
  const sql = db.getSql();
  let release!: () => void;
  let locked!: () => void;
  const released = new Promise<void>((resolve) => { release = resolve; });
  const acquired = new Promise<void>((resolve) => { locked = resolve; });
  const holder = sql.begin(async (transaction) => {
    await transaction`SELECT singleton_key FROM internal_production_owner_producer_manifest_set_current_v1 WHERE singleton_key=TRUE FOR UPDATE`;
    locked();
    await released;
  });
  await acquired;
  const publicObserver = db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();
  const publicResult = await Promise.race([
    publicObserver,
    new Promise<"PUBLIC_BLOCKED">((resolve) => setTimeout(() => resolve("PUBLIC_BLOCKED"), 75)),
  ]);
  if (publicResult === "PUBLIC_BLOCKED") {
    release();
    await holder;
  }
  assert.notEqual(publicResult, "PUBLIC_BLOCKED");
  assert.equal(publicResult, null);
  let pinnedSettled = false;
  const pinned = sql.begin((transaction) => db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationInTransactionV1(transaction as never))
    .then((value) => { pinnedSettled = true; return value; });
  await new Promise((resolve) => setTimeout(resolve, 75));
  assert.equal(pinnedSettled, false);
  release();
  await holder;
  assert.equal(await pinned, null);
  await db.pgClose();
});

test("real PostgreSQL missing prepared operation leaves all activation relations unchanged", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  const db = await import("../../src/db-pg.js");
  const sql = db.getSql();
  const counts = async () => sql<Array<{ sources: string; activations: string; heads: string; current_revision: string }>>`
    SELECT
      (SELECT COUNT(*)::text FROM internal_production_owner_producer_source_build_authorities_v1) AS sources,
      (SELECT COUNT(*)::text FROM internal_production_owner_producer_manifest_set_activations_v1) AS activations,
      (SELECT COUNT(*)::text FROM internal_production_owner_producer_manifest_activation_heads_v1) AS heads,
      (SELECT current_revision::text FROM internal_production_owner_producer_manifest_set_current_v1 WHERE singleton_key=TRUE) AS current_revision
  `;
  const before = await counts();
  await assert.rejects(
    activateInternalProductionBaselineOwnerProducerManifestV1(),
    /^Error: CURRENT_ENTRY_UNAVAILABLE$/,
  );
  assert.deepEqual(await counts(), before);
  const status = await observeInternalProductionBaselineOwnerProducerManifestActivationStatusV1();
  assert.equal(status.state, "absent");
  assert.equal(status.blockedReason, null);
  await db.pgClose();
});
