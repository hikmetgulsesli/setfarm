import fs, { type BigIntStats } from "node:fs";
import path from "node:path";
import { types } from "node:util";

import { canonicalJsonBytes, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { authenticateInternalProductionBaselineWorkspaceAnchorV1, resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";
import { parseProductBuildAuthorityV2DeliveryEvidenceResponseV1 } from "./product-build-authority-v2-delivery-evidence-v1.js";

const ERROR = "TASK6A_V2_PRE_SCHEMA_ORDINARY_START_REFUSED";
const DIRECTORIES = ["data", "internal-production-baseline", "current-entry-v1"] as const;
const OPERATION = "current-entry-operation.json";
const MAX_BYTES = 1_048_576;
let cleanupUncertain = false;

type OperationPresenceV2 = Readonly<{ state: "absent" }> | Readonly<{
  state: "present";
  operationHash: string;
  fileIdentity: string;
}>;

function fail(): never { throw new Error(ERROR); }
function missing(error: unknown): boolean { return error instanceof Error && "code" in error && error.code === "ENOENT"; }
function same(left: BigIntStats, right: BigIntStats, keys: readonly (keyof BigIntStats)[]): boolean {
  return keys.every((key) => left[key] === right[key]);
}
const DIRECTORY_KEYS = ["dev", "ino", "mode", "uid", "gid", "birthtimeNs"] as const;
const FILE_KEYS = [...DIRECTORY_KEYS, "size", "nlink", "mtimeNs", "ctimeNs"] as const;

function strictOperationHash(bytes: Buffer): string {
  if (bytes.length < 2 || bytes.at(-1) !== 10) fail();
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.subarray(0, -1).toString("utf8")); } catch { fail(); }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) fail();
  const value = parsed as Record<string, unknown>;
  const keys = ["schema", "purpose", "controllerSource", "productBuildAuthorityV2DeliveryEvidence",
    "productBuildAuthorityV2Observation", "authorityV3Migration31Audit", "pendingBootstrapHandoffMigration",
    "operationRef", "operationHash"];
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) fail();
  if (!bytes.equals(Buffer.concat([canonicalJsonBytes(value), Buffer.from("\n")]))) fail();
  if (value.schema !== "setfarm.internal-production-current-entry-operation.v1"
    || value.purpose !== "task6a-internal-production-current-entry-v1"
    || typeof value.operationHash !== "string" || !/^[a-f0-9]{64}$/.test(value.operationHash)
    || value.operationRef !== `setfarm://internal-production/current-entry-operation/sha256/${value.operationHash}`) fail();
  const projection = { ...value };
  delete projection.operationRef;
  delete projection.operationHash;
  if (hashCanonicalJson(projection) !== value.operationHash) fail();
  const source = plain(value.controllerSource, ["branch", "clean", "sha", "treeHash", "buildHash", "originMainSha"]);
  if (source.branch !== "main" || source.clean !== true
    || typeof source.sha !== "string" || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(source.sha)
    || typeof source.treeHash !== "string" || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(source.treeHash)
    || typeof source.buildHash !== "string" || !/^[a-f0-9]{64}$/.test(source.buildHash)
    || source.originMainSha !== source.sha) fail();
  const pair = (input: unknown, refKey: string, hashKey: string, prefix: string): Record<string, unknown> => {
    const exact = plain(input, [refKey, hashKey]);
    if (typeof exact[hashKey] !== "string" || !/^[a-f0-9]{64}$/.test(exact[hashKey])
      || exact[refKey] !== `${prefix}${exact[hashKey]}`) fail();
    return exact;
  };
  pair(value.authorityV3Migration31Audit, "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash",
    "setfarm://internal-production/authority-v3-migration31-audit/sha256/");
  pair(value.pendingBootstrapHandoffMigration, "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash",
    "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/");
  const observation = plain(value.productBuildAuthorityV2Observation, ["schema", "observationTransport", "response"]);
  if (observation.schema !== "setfarm.product-build-authority-v2-delivery-evidence-observation.v1"
    || observation.observationTransport !== "source-cli") fail();
  const response = plain(observation.response, ["schema", "currentStatus", "deliveryEvidenceRef", "deliveryEvidenceHash", "evidence"]);
  if (response.schema !== "mission-control.product-build-authority-v2-delivery-evidence-response.v1"
    || response.currentStatus !== "current" || typeof response.deliveryEvidenceHash !== "string"
    || !/^[a-f0-9]{64}$/.test(response.deliveryEvidenceHash)
    || response.deliveryEvidenceRef !== `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${response.deliveryEvidenceHash}`) fail();
  if (response.evidence === null || typeof response.evidence !== "object" || Array.isArray(response.evidence)) fail();
  const evidence = response.evidence as Record<string, unknown>;
  if (evidence.deliveryEvidenceRef !== response.deliveryEvidenceRef
    || evidence.deliveryEvidenceHash !== response.deliveryEvidenceHash) fail();
  const evidenceProjection = { ...evidence };
  delete evidenceProjection.deliveryEvidenceRef;
  delete evidenceProjection.deliveryEvidenceHash;
  if (hashCanonicalJson(evidenceProjection) !== response.deliveryEvidenceHash) fail();
  const pba = pair(value.productBuildAuthorityV2DeliveryEvidence, "deliveryEvidenceRef", "deliveryEvidenceHash",
    "mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/");
  if (pba.deliveryEvidenceRef !== response.deliveryEvidenceRef
    || pba.deliveryEvidenceHash !== response.deliveryEvidenceHash) fail();
  parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(response);
  return value.operationHash;
}

/** Sampled fixed-file discriminator only; absence is never writer authority. */
export function observeTask6aFixedCurrentEntryOperationPresenceV2(): OperationPresenceV2 {
  if (cleanupUncertain) fail();
  const anchor = authenticateInternalProductionBaselineWorkspaceAnchorV1();
  const descriptors: number[] = [];
  const held: Array<{ target: string; stat: BigIntStats; fd: number }> = [];
  let result: OperationPresenceV2 | undefined;
  let primary: unknown;
  const stable = (): void => {
    anchor.assertStable();
    for (const item of held) {
      if (!same(item.stat, fs.fstatSync(item.fd, { bigint: true }), DIRECTORY_KEYS)
        || !same(item.stat, fs.lstatSync(item.target, { bigint: true }), DIRECTORY_KEYS)) fail();
    }
  };
  try {
    const root = resolveInternalProductionBaselineWorkspaceRootV1();
    const uid = process.getuid?.();
    if (uid === undefined) fail();
    let current = root;
    let device: bigint | undefined;
    for (const segment of DIRECTORIES) {
      current = path.join(current, segment);
      stable();
      let stat: BigIntStats;
      try { stat = fs.lstatSync(current, { bigint: true }); }
      catch (error) {
        if (!missing(error)) throw error;
        stable();
        try { fs.lstatSync(current, { bigint: true }); fail(); } catch (again) { if (!missing(again)) throw again; }
        result = Object.freeze({ state: "absent" });
        break;
      }
      if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== BigInt(uid)
        || (stat.mode & 0o022n) !== 0n || (device !== undefined && stat.dev !== device)) fail();
      device ??= stat.dev;
      const fd = fs.openSync(current, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      descriptors.push(fd); held.push({ target: current, stat, fd }); stable();
    }
    if (result === undefined) {
      const target = path.join(current, OPERATION);
      stable();
      let before: BigIntStats;
      try { before = fs.lstatSync(target, { bigint: true }); }
      catch (error) {
        if (!missing(error)) throw error;
        stable();
        try { fs.lstatSync(target, { bigint: true }); fail(); } catch (again) { if (!missing(again)) throw again; }
        result = Object.freeze({ state: "absent" });
      }
      if (result === undefined) {
        if (!before!.isFile() || before!.isSymbolicLink() || before!.uid !== BigInt(uid)
          || before!.dev !== device || before!.nlink !== 1n || (before!.mode & 0o7777n) !== 0o600n
          || before!.size < 1n || before!.size > BigInt(MAX_BYTES)) fail();
        const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
        descriptors.push(fd);
        const opened = fs.fstatSync(fd, { bigint: true });
        if (!same(before!, opened, FILE_KEYS)) fail();
        const bytes = Buffer.alloc(Number(before!.size) + 1);
        let count = 0;
        while (count < bytes.length) {
          const read = fs.readSync(fd, bytes, count, bytes.length - count, count);
          if (read === 0) break;
          count += read;
        }
        if (BigInt(count) !== before!.size || !same(before!, fs.fstatSync(fd, { bigint: true }), FILE_KEYS)
          || !same(before!, fs.lstatSync(target, { bigint: true }), FILE_KEYS)) fail();
        const operationHash = strictOperationHash(bytes.subarray(0, count));
        result = Object.freeze({ state: "present", operationHash,
          fileIdentity: `${before!.dev}:${before!.ino}:${before!.ctimeNs}:${before!.mtimeNs}` });
      }
    }
    stable();
  } catch (error) { primary = error; }
  finally {
    for (const fd of descriptors.reverse()) try { fs.closeSync(fd); } catch (error) { cleanupUncertain = true; primary ??= error; }
    try { anchor.close(); } catch (error) { cleanupUncertain = true; primary ??= error; }
  }
  if (primary || !result) fail();
  return result;
}

function plain(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== "string" || !keys.includes(key)
    || !descriptors[key].enumerable || !("value" in descriptors[key]))) fail();
  return Object.fromEntries(keys.map((key) => [key, descriptors[key].value]));
}

export function classifyTask6aPreSchemaOrdinaryStartupV2(operation: unknown, journal: unknown): "existing-gates" {
  if (operation === null || typeof operation !== "object" || types.isProxy(operation)) fail();
  const state = Object.getOwnPropertyDescriptor(operation, "state")?.value as unknown;
  const observed = plain(operation, state === "present"
    ? ["state", "operationHash", "fileIdentity"] : ["state"]);
  if (observed.state === "absent") {
    if (journal !== null) fail();
    return "existing-gates";
  }
  if (observed.state !== "present" || typeof observed.operationHash !== "string"
    || !/^[a-f0-9]{64}$/.test(observed.operationHash)
    || typeof observed.fileIdentity !== "string" || observed.fileIdentity.length === 0) fail();
  const value = plain(journal, ["schema", "state"]);
  if (value.schema === "setfarm.contract-spine-through33-journal-read-only.v2"
    && value.state === "through33-journal-applied") return "existing-gates";
  fail();
}

/** Additional sampled refusal before the existing ordinary startup gates. */
export async function assertTask6aPreSchemaOrdinaryStartupV2(): Promise<void> {
  const before = observeTask6aFixedCurrentEntryOperationPresenceV2();
  if (before.state === "absent") return;
  try {
    const [{ getSql }, { inspectContractSpineThrough33JournalReadOnlyV2 }] = await Promise.all([
      import("../db-pg.js"), import("../db/contract-spine-migrations.js"),
    ]);
    const journal = await inspectContractSpineThrough33JournalReadOnlyV2(getSql());
    const after = observeTask6aFixedCurrentEntryOperationPresenceV2();
    if (after.state !== "present" || before.operationHash !== after.operationHash
      || before.fileIdentity !== after.fileIdentity) fail();
    classifyTask6aPreSchemaOrdinaryStartupV2(after, journal);
  } catch { fail(); }
}
