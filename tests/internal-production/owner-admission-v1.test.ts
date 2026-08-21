import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import test from "node:test";

import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import * as ownerAdmissionApi from "../../src/internal-production/owner-admission-v1.js";
import { parseProductBuildAuthorityV2DeliveryEvidenceResponseV1 } from "../../src/internal-production/product-build-authority-v2-delivery-evidence-v1.js";
import {
  INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1,
  assembleInternalProductionOwnerProducerRegistryV1,
  createInternalProductionBoundOwnerReservationV1,
  createInternalProductionOwnerReservationCloseV1,
  createInternalProductionOwnerReservationV1,
  createInternalProductionTerminalOwnerAuthorityV1,
  deriveInternalProductionTerminalOwnerAuthorityPairV1,
  validateInternalProductionBoundOwnerReservationV1,
  validateInternalProductionOwnerProducerManifestV1,
  validateInternalProductionOwnerProducerManifestSetActivationCurrentV1,
  validateInternalProductionOwnerProducerManifestSetActivationHeadV1,
  validateInternalProductionOwnerProducerManifestSetActivationReceiptV1,
  validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1,
  validateInternalProductionOwnerProducerSourceBuildAuthorityV1,
  validateInternalProductionOwnerReservationCloseV1,
  validateInternalProductionOwnerReservationV1,
  validateInternalProductionTerminalOwnerAuthorityPairV1,
  validateInternalProductionTerminalOwnerAuthorityV1,
  type InternalProductionCanonicalOwnerIdentityV1,
  type InternalProductionOwnerProducerManifestV1,
  type InternalProductionOwnerProducerRowV1,
  type InternalProductionOwnerProducerSourceBuildAuthorityAV1,
} from "../../src/internal-production/owner-admission-v1.js";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const GIT_A = "a".repeat(40);
const GIT_B = "b".repeat(40);

const DELIVERED_PATHS = [
  "server/routes/setfarm-operational.test.ts",
  "server/routes/setfarm-operational.ts",
  "server/services/setfarm-product-build-authority.ts",
  "server/services/setfarm-product-build-authority.test.ts",
  "src/lib/product-build-authority.ts",
  "src/components/run-detail/ProductBuildAuthority.tsx",
  "tests/product-build-authority-render.test.tsx",
  "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json",
] as const;
const VENDOR_ARTIFACTS = [
  ["run-operational-snapshot.v1.compatibility.json", "run-operational-snapshot.v1.compatibility.json"],
  ["run-operational-snapshot.v1.schema.json", "run-operational-snapshot.v1.schema.json"],
  ["run-operational-snapshot.v2.compatibility.json", "run-operational-snapshot.v2.compatibility.json"],
  ["run-operational-snapshot.v2.schema.json", "run-operational-snapshot.v2.schema.json"],
  ["run-operational-snapshot.v3.compatibility.json", "run-operational-snapshot.v3.compatibility.json"],
  ["run-operational-snapshot.v3.schema.json", "run-operational-snapshot.v3.schema.json"],
  ["deployment-observation.v1.compatibility.json", "deployment-observation.v1.compatibility.json"],
  ["deployment-observation.v1.schema.json", "deployment-observation.v1.schema.json"],
  ["project-transfer-ack.v1.compatibility.json", "project-transfer-ack.v1.compatibility.json"],
  ["project-transfer-ack.v1.schema.json", "project-transfer-ack.v1.schema.json"],
  ["operational-active-run-status.v1.compatibility.json", "operational-active-run-status.v1.compatibility.json"],
  ["operational-active-run-status.v1.schema.json", "operational-active-run-status.v1.schema.json"],
] as const;

function completePbaObservation(vendorProducerCommit = GIT_A) {
  const deliveredPathBlobs = DELIVERED_PATHS.map((path, index) => ({ path, blobHash: String(index + 1).padStart(64, "0") }));
  const argv = ["node", "--import", "tsx", "--test", "server/routes/setfarm-operational.test.ts", "server/services/setfarm-product-build-authority.test.ts", "tests/product-build-authority-render.test.tsx"] as const;
  const focusedCore = {
    schema: "mission-control.product-build-authority-v2-focused-test-receipt.v1" as const,
    argv,
    commandContractHash: hashCanonicalJson({ argv }),
    testPathBlobs: [deliveredPathBlobs[0]!, deliveredPathBlobs[3]!, deliveredPathBlobs[6]!],
    exitCode: 0 as const,
    passed: true as const,
  };
  const focusedTestReceiptHash = hashCanonicalJson(focusedCore);
  const focusedTests = { ...focusedCore, focusedTestReceiptRef: `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/${focusedTestReceiptHash}`, focusedTestReceiptHash };
  const artifacts = VENDOR_ARTIFACTS.map(([producer, vendored], index) => ({
    producerPath: `contracts/generated/mission-control/${producer}`,
    vendoredPath: `contracts/vendor/setfarm/${vendored}`,
    sha256: String(index + 20).padStart(64, "0"),
  }));
  const vendorCore = {
    schema: "mission-control.product-build-authority-v2-vendor-lock-projection.v1" as const,
    lockPath: "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json" as const,
    producerRepository: "https://github.com/hikmetgulsesli/setfarm.git" as const,
    producerCommit: vendorProducerCommit,
    lockContentHash: deliveredPathBlobs[7]!.blobHash,
    artifacts,
    compatibilitySetHash: hashCanonicalJson({ schema: "mission-control.setfarm-contract-compatibility-set.v1", artifacts }),
  };
  const vendorLock = { ...vendorCore, vendorLockProjectionHash: hashCanonicalJson(vendorCore) };
  const evidenceCore = {
    schema: "mission-control.product-build-authority-v2-delivery-evidence.v1" as const,
    currentStatus: "current" as const,
    deliveryPrNumber: 19 as const,
    deliveryMergeSha: "240e779d78804843a1202cbf0440fe423b806b1a" as const,
    deliveryMergeAncestorOfCurrentSource: true as const,
    currentSource: { branch: "main" as const, clean: true as const, sha: vendorProducerCommit, treeHash: GIT_B, buildHash: SHA_C, originMainSha: vendorProducerCommit },
    deliveredPathBlobs,
    focusedTests,
    vendorLock,
  };
  const deliveryEvidenceHash = hashCanonicalJson(evidenceCore);
  const evidence = { ...evidenceCore, deliveryEvidenceRef: `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${deliveryEvidenceHash}`, deliveryEvidenceHash };
  const response = { schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1" as const, currentStatus: "current" as const, deliveryEvidenceRef: evidence.deliveryEvidenceRef, deliveryEvidenceHash, evidence };
  parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(response);
  return { schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1" as const, observationTransport: "source-cli" as const, response } as ExactProductBuildObservation;
}

const activationFixtureSourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function fixtureGit(root: string, args: readonly string[]): string {
  const result = spawnSync("/usr/bin/git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function writeActivationFixtureFile(root: string, locator: string, bytes: string | Buffer, mode = 0o644): void {
  const target = path.join(root, locator);
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
  writeFileSync(target, bytes);
  chmodSync(target, mode);
}

function materializeActivationFixtureBuildOutputs(root: string): void {
  const tracked = fixtureGit(root, ["ls-files", "-z"]).split("\0").filter(Boolean);
  for (const locator of tracked) {
    let output: string | null = null;
    if (locator.startsWith("src/") && locator.endsWith(".ts") && !/\.(?:d|m|c)\.ts$/.test(locator)) {
      output = `dist/${locator.slice(4, -3)}.js`;
    } else if (locator === "src/server/index.html" || locator === "src/installer/compat-rules.json" || /^src\/installer\/prompts\/[^/]+\.md$/.test(locator) || /^src\/installer\/steps\/.+\.md$/.test(locator)) {
      output = `dist/${locator.slice(4)}`;
    }
    if (output !== null) writeActivationFixtureFile(root, output, `// disposable activation fixture for ${locator}\n`, 0o600);
  }
}

function createPreparedActivationRepositoryFixture(): Readonly<{ root: string; vendorCommit: string }> {
  const container = mkdtempSync(path.join(tmpdir(), "setfarm-activation-pg-"));
  const root = path.join(container, "setfarm");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  cpSync(path.join(activationFixtureSourceRoot, "src"), path.join(root, "src"), { recursive: true });
  for (const locator of ["package.json", "tsconfig.json", ".gitignore", "scripts/write-build-info.mjs", "scripts/build-generation-retention.mjs", "scripts/copy-step-assets.mjs", "scripts/stitch-to-jsx.mjs", "scripts/inject-version.js"]) {
    const source = path.join(activationFixtureSourceRoot, locator);
    if (readFileSync(source)) writeActivationFixtureFile(root, locator, readFileSync(source), locator.endsWith("copy-step-assets.mjs") ? 0o755 : 0o644);
  }
  fixtureGit(root, ["init", "-q", "-b", "main"]);
  fixtureGit(root, ["config", "user.name", "Setfarm Activation Test"]);
  fixtureGit(root, ["config", "user.email", "activation-test@example.invalid"]);
  fixtureGit(root, ["config", "commit.gpgsign", "false"]);
  const sourceCommonDir = fixtureGit(activationFixtureSourceRoot, ["rev-parse", "--git-common-dir"]);
  const sourceObjects = path.resolve(activationFixtureSourceRoot, sourceCommonDir, "objects");
  mkdirSync(path.join(root, ".git/objects/info"), { recursive: true });
  writeFileSync(path.join(root, ".git/objects/info/alternates"), `${sourceObjects}\n`);
  fixtureGit(root, ["update-ref", "refs/heads/main", "1d691c89760339ea905dfe17f8e9188e62603c1c"]);
  fixtureGit(root, ["reset", "--mixed", "HEAD"]);
  fixtureGit(root, ["remote", "add", "origin", "https://github.com/hikmetgulsesli/setfarm.git"]);
  fixtureGit(root, ["add", "."]);
  fixtureGit(root, ["commit", "-qm", "fixture vendor ancestor"]);
  const vendorCommit = fixtureGit(root, ["rev-parse", "HEAD"]);
  const observation = completePbaObservation(vendorCommit);
  writeActivationFixtureFile(root, "src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts", `const observation=${JSON.stringify(observation)}; export async function observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1(){return structuredClone(observation)} export function parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(value){return value}\n`);
  fixtureGit(root, ["add", "src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts"]);
  fixtureGit(root, ["commit", "-qm", "fixture controller source"]);
  fixtureGit(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  for (const entry of fixtureGit(root, ["ls-files", "-s", "-z"]).split("\0").filter(Boolean)) {
    const match = /^(100644|100755) [a-f0-9]+ 0\t(.+)$/.exec(entry);
    assert.ok(match, `unexpected fixture Git entry: ${entry}`);
    chmodSync(path.join(root, match[2]!), match[1] === "100755" ? 0o755 : 0o644);
  }
  const prepared = spawnSync(process.execPath, ["scripts/write-build-info.mjs", "--prepare"], { cwd: root, encoding: "utf8" });
  assert.equal(prepared.status, 0, prepared.stderr);
  materializeActivationFixtureBuildOutputs(root);
  const finalized = spawnSync(process.execPath, ["scripts/write-build-info.mjs", "--finalize"], { cwd: root, encoding: "utf8" });
  assert.equal(finalized.status, 0, finalized.stderr);
  symlinkSync(path.join(activationFixtureSourceRoot, "node_modules"), path.join(root, "node_modules"), "dir");
  writeFileSync(path.join(root, ".git/info/exclude"), "node_modules\n");
  return Object.freeze({ root, vendorCommit });
}

let activatedOwnerAdmissionFixture: Readonly<{
  root: string;
  db: typeof import("../../src/db-pg.js");
  sql: ReturnType<typeof import("../../src/db-pg.js")["getSql"]>;
  backendWorker: Worker;
}> | null = null;

type ProductBuildObservationFromOwnerCore =
  InternalProductionOwnerProducerSourceBuildAuthorityAV1[
    "productBuildAuthorityV2Observation"
  ];

type ExactProductBuildObservation = import(
  "../../src/internal-production/product-build-authority-v2-delivery-evidence-v1.js"
).ProductBuildAuthorityV2DeliveryEvidenceObservationV1;
type AssertCompileTimeTrue<Value extends true> = Value;
type OwnerCorePbaObservationIsExact = AssertCompileTimeTrue<
  ProductBuildObservationFromOwnerCore extends ExactProductBuildObservation ? true : false
>;
type ExactPbaObservationIsOwnerCore = AssertCompileTimeTrue<
  ExactProductBuildObservation extends ProductBuildObservationFromOwnerCore ? true : false
>;
const exactPbaCompileAssertions: readonly [
  OwnerCorePbaObservationIsExact,
  ExactPbaObservationIsOwnerCore,
] = [true, true];
void exactPbaCompileAssertions;

test("workflow run canonical owner identity is byte exact", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  const db = await import("../../src/db-pg.js");
  assert.equal(
    "resolveBoundInternalProductionWorkflowRunOwnerInTransactionV1" in db,
    false,
    "the generic bind port must own its strict post-publication reopen",
  );
  for (const runId of ["run-plain", "run/with/slash", "run % unicode-✓"] as const) {
    const encodedRunId = encodeURIComponent(runId);
    assert.deepEqual(db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId), {
      schema: "setfarm.internal-production-canonical-owner-identity.v1",
      category: "run",
      ownerKey: runId,
      ownerRef: `setfarm://runs/${encodedRunId}`,
      ownerHash: hashCanonicalJson({
        schema: "setfarm.internal-production-workflow-run-owner.v1",
        runId,
      }),
    });
  }
  assert.throws(
    () => db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(""),
    /^TypeError: INTERNAL_PRODUCTION_WORKFLOW_RUN_ID_INVALID$/,
  );
  assert.throws(
    () => db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1("\ud800"),
    /^TypeError: INTERNAL_PRODUCTION_WORKFLOW_RUN_ID_INVALID$/,
  );
});

const COMPILE_PBA_REF = "mission-control://compile-fixture" as
  ExactProductBuildObservation["response"]["deliveryEvidenceRef"];
const COMPILE_PBA_HASH = SHA_A as
  ExactProductBuildObservation["response"]["deliveryEvidenceHash"];

const incompleteProductBuildObservationCompileFixture: ProductBuildObservationFromOwnerCore = {
  schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1",
  observationTransport: "source-cli",
  response: {
    schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
    currentStatus: "current",
    deliveryEvidenceRef: COMPILE_PBA_REF,
    deliveryEvidenceHash: COMPILE_PBA_HASH,
    // @ts-expect-error owner-core ABI requires the complete delivered evidence body
    evidence: {},
  },
};
void incompleteProductBuildObservationCompileFixture;

const arbitraryProductBuildObservationCompileFixture: ProductBuildObservationFromOwnerCore = {
  schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1",
  observationTransport: "source-cli",
  response: {
    schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
    currentStatus: "current",
    deliveryEvidenceRef: COMPILE_PBA_REF,
    deliveryEvidenceHash: COMPILE_PBA_HASH,
    // @ts-expect-error owner-core ABI rejects an arbitrary evidence substitute
    evidence: { unexpected: true },
  },
};
void arbitraryProductBuildObservationCompileFixture;

function authorityAInput() {
  const productBuildAuthorityV2Observation = completePbaObservation();
  const evidence = productBuildAuthorityV2Observation.response.evidence;
  return {
    schema: "setfarm.internal-production-owner-producer-source-build-authority-a.v1" as const,
    plan: "A" as const,
    manifestHash: INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash,
    currentEntryOperationRef: `setfarm://internal-production/current-entry-operation/sha256/${SHA_B}`,
    currentEntryOperationHash: SHA_B,
    setfarmSource: { branch: "main" as const, clean: true as const, sha: GIT_B, treeHash: GIT_A, buildHash: SHA_C, originMainSha: GIT_B },
    productBuildAuthorityV2DeliveryEvidenceRef: evidence.deliveryEvidenceRef,
    productBuildAuthorityV2DeliveryEvidenceHash: evidence.deliveryEvidenceHash,
    productBuildAuthorityV2Observation,
    vendorProducerCommit: GIT_A,
    vendorProducerCommitAncestorProof: {
      schema: "setfarm.internal-production-vendor-ancestor-proof.v1" as const,
      vendorProducerCommit: GIT_A,
      setfarmSourceSha: GIT_B,
      mergeBase: GIT_A,
      verified: true as const,
    },
    ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
    ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  };
}

function authorityA() {
  return completeAuthorityFromInput(authorityAInput());
}

function completeAuthorityFromInput(body: ReturnType<typeof authorityAInput>) {
  const sourceBuildAuthorityHash = hashCanonicalJson(body);
  return validateInternalProductionOwnerProducerSourceBuildAuthorityV1({
    ...body,
    sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${sourceBuildAuthorityHash}`,
    sourceBuildAuthorityHash,
  });
}

function resignPbaObservation(observation: ExactProductBuildObservation): ExactProductBuildObservation {
  const clone = structuredClone(observation) as unknown as Record<string, any>;
  const focused = clone.response.evidence.focusedTests;
  const { focusedTestReceiptRef: _focusedRef, focusedTestReceiptHash: _focusedHash, ...focusedCore } = focused;
  focused.focusedTestReceiptHash = hashCanonicalJson(focusedCore);
  focused.focusedTestReceiptRef = `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/${focused.focusedTestReceiptHash}`;
  const evidence = clone.response.evidence;
  const { deliveryEvidenceRef: _evidenceRef, deliveryEvidenceHash: _evidenceHash, ...evidenceCore } = evidence;
  evidence.deliveryEvidenceHash = hashCanonicalJson(evidenceCore);
  evidence.deliveryEvidenceRef = `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${evidence.deliveryEvidenceHash}`;
  clone.response.deliveryEvidenceRef = evidence.deliveryEvidenceRef;
  clone.response.deliveryEvidenceHash = evidence.deliveryEvidenceHash;
  return clone as ExactProductBuildObservation;
}

test("pure owner-admission parser rejects malformed authority", () => {
  const authority = authorityA();
  assert.deepEqual(validateInternalProductionOwnerProducerSourceBuildAuthorityV1(authority), authority);
  assertDeepFrozen(authority, "source authority A");
  assert.throws(
    () => validateInternalProductionOwnerProducerSourceBuildAuthorityV1({ ...authority, extra: true }),
    /SOURCE_BUILD_AUTHORITY_A_KEYS_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerProducerSourceBuildAuthorityV1({
      ...authority,
      vendorProducerCommit: GIT_B,
      sourceBuildAuthorityHash: hashCanonicalJson({ crossed: true }),
    }),
    /SOURCE_BUILD_AUTHORITY_A_/,
  );
});

test("source boundary keeps owner-admission PostgreSQL imports lazy", async () => {
  const source = await readFile(new URL("../../src/internal-production/owner-admission-v1.ts", import.meta.url), "utf8");
  assert.deepEqual([...source.matchAll(/^import[^;]+from\s+["']([^"']+)["'];/gm)].map((match) => match[1]), ["postgres", "../product-compiler/canonical-json.js"]);
});

test("private fake derives owner-admission projection", () => {
  const value = authorityA();
  assert.equal(value.sourceBuildAuthorityHash, hashCanonicalJson(authorityAInput()));
  assert.equal(value.sourceBuildAuthorityRef, `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${value.sourceBuildAuthorityHash}`);
});

test("owner core exposes no complete source-authority body factory", () => {
  assert.equal(
    Object.hasOwn(ownerAdmissionApi, "createInternalProductionOwnerProducerSourceBuildAuthorityAV1"),
    false,
  );
});

test("pure owner parser recursively rejects a rehashed nested PBA extra", () => {
  const input = structuredClone(authorityAInput());
  (input.productBuildAuthorityV2Observation.response.evidence.focusedTests as Record<string, unknown>).extra = true;
  input.productBuildAuthorityV2Observation = resignPbaObservation(
    input.productBuildAuthorityV2Observation,
  );
  input.productBuildAuthorityV2DeliveryEvidenceRef =
    input.productBuildAuthorityV2Observation.response.deliveryEvidenceRef;
  input.productBuildAuthorityV2DeliveryEvidenceHash =
    input.productBuildAuthorityV2Observation.response.deliveryEvidenceHash;
  assert.throws(
    () => parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(
      input.productBuildAuthorityV2Observation.response,
    ),
    /PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_INVALID/,
  );
  assert.throws(
    () => completeAuthorityFromInput(input),
    /SOURCE_BUILD_AUTHORITY_A_PBA_INVALID/,
  );
});

test("A authority binds its literal manifest synchronized source and exact ancestor merge base", () => {
  const cases = [
    ["manifest", (input: ReturnType<typeof authorityAInput>) => { input.manifestHash = SHA_A; }],
    ["origin", (input: ReturnType<typeof authorityAInput>) => { input.setfarmSource.originMainSha = GIT_A; }],
    ["merge-base", (input: ReturnType<typeof authorityAInput>) => { input.vendorProducerCommitAncestorProof.mergeBase = GIT_B; }],
  ] as const;
  for (const [label, mutate] of cases) {
    const input = structuredClone(authorityAInput());
    mutate(input);
    assert.throws(
      () => completeAuthorityFromInput(input),
      /SOURCE_BUILD_AUTHORITY_A_(?:MANIFEST|SOURCE|ANCESTRY)_INVALID/,
      label,
    );
  }
});

test("A authority requires a proper vendor ancestor distinct from the Setfarm source", () => {
  const input = structuredClone(authorityAInput());
  input.productBuildAuthorityV2Observation = completePbaObservation(input.setfarmSource.sha);
  input.productBuildAuthorityV2DeliveryEvidenceRef = input.productBuildAuthorityV2Observation.response.deliveryEvidenceRef;
  input.productBuildAuthorityV2DeliveryEvidenceHash = input.productBuildAuthorityV2Observation.response.deliveryEvidenceHash;
  input.vendorProducerCommit = input.setfarmSource.sha;
  input.vendorProducerCommitAncestorProof.vendorProducerCommit = input.setfarmSource.sha;
  input.vendorProducerCommitAncestorProof.mergeBase = input.setfarmSource.sha;
  assert.throws(
    () => completeAuthorityFromInput(input),
    /SOURCE_BUILD_AUTHORITY_A_ANCESTRY_INVALID/,
  );
});

test("future B-E activation is rejected before PostgreSQL observation", async () => {
  const db = await import("../../src/db-pg.js");
  await assert.rejects(
    db.activateInternalProductionOwnerProducerManifestSetV1({
      expectedPredecessor: null,
      manifests: [syntheticManifest("B", 10)],
      orderedSourceBuildAuthorities: [{ plan: "B", sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/B/sha256/${SHA_A}`, sourceBuildAuthorityHash: SHA_A }],
    }),
    /ACTIVATION_PHASE_INVALID/,
  );
});

test("controller-only A database port rejects every caller authority seam before PostgreSQL", async () => {
  const db = await import("../../src/db-pg.js");
  const pair = {
    plan: "A" as const,
    sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${SHA_A}`,
    sourceBuildAuthorityHash: SHA_A,
  };
  const assertPortCorruption = async (promise: Promise<unknown>) => {
    let observed: unknown;
    try { await promise; } catch (error) { observed = error; }
    assert.ok(observed instanceof Error);
    assert.equal(observed.message, "CORRUPTION");
    assert.equal(Object.getPrototypeOf(observed), Error.prototype);
    assert.deepEqual(Reflect.ownKeys(observed).filter((key) => key !== "stack" && key !== "message"), []);
  };
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1({ sourceBuildAuthority: pair, extra: true } as never));
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1({ sourceBuildAuthority: { ...pair, plan: "B", sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/B/sha256/${SHA_A}` } as never }));
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1({ sourceBuildAuthority: { ...pair, sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${SHA_B}` } }));
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1({ sourceBuildAuthority: pair, [Symbol("hidden")]: true } as never));
  const hidden = { sourceBuildAuthority: pair };
  Object.defineProperty(hidden, "extra", { value: true, enumerable: false });
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1(hidden));
  const customPrototype = Object.assign(Object.create({ inherited: true }), { sourceBuildAuthority: pair });
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1(customPrototype));
  let getterCalls = 0;
  const getterInput = {};
  Object.defineProperty(getterInput, "sourceBuildAuthority", { enumerable: true, get() { getterCalls += 1; return pair; } });
  await assertPortCorruption(db.activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1(getterInput as never));
  assert.equal(getterCalls, 0);
});

test("generic and controller-only exports share one private core without an exported drift side channel", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const controllerPort = source.slice(
    source.indexOf("export async function activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1"),
    source.indexOf("/**\n * Read-only current-entry composition"),
  );
  assert.match(controllerPort, /exactObjectKeys\(input, \["sourceBuildAuthority"\]/);
  assert.match(controllerPort, /expectedPredecessor: null/);
  assert.match(controllerPort, /manifests: \[INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1\]/);
  assert.match(controllerPort, /activateInternalProductionOwnerProducerManifestSetCoreV1/);
  assert.match(source, /const OWNER_PRODUCER_CURRENT_SOURCE_DRIFT = Symbol\("owner-producer-current-source-drift"\)/);
  assert.doesNotMatch(source, /Symbol\.for|privateCandidateDrift/);
  assert.doesNotMatch(source, /export (?:const|class).*CURRENT_SOURCE_DRIFT/);
});

test("database new-A candidate uses only the read-only prepared-operation accessor", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const candidate = /async function deriveCurrentOwnerProducerSourceAuthorityAForDatabaseV1\(\)[\s\S]*?\n}\n/.exec(source)?.[0] ?? "";
  assert.match(candidate, /observePreparedInternalProductionCurrentEntryOperationV1\(\)/);
  assert.doesNotMatch(candidate, /prepareInternalProductionCurrentEntryOperationV1|lstatSync|CURRENT_ENTRY_OPERATION_PATH/);
});

test("database committed-current module graph has no static fresh observer or Git edge", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const runtimeImports = [...source.matchAll(/^import(?!\s+type\b)[\s\S]*?from\s+["']([^"']+)["'];/gm)].map((match) => match[1]);
  assert.equal(runtimeImports.includes("./internal-production/baseline-post-handoff-receipt-v1.js"), false);
  assert.equal(runtimeImports.includes("./internal-production/product-build-authority-v2-delivery-evidence-v1.js"), false);
  assert.equal(runtimeImports.includes("./execution/v3-git-revision.js"), false);
});

test("database activation resolves source before deriving or querying target authority", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const activation = source.slice(source.indexOf("async function activateInternalProductionOwnerProducerManifestSetCoreV1"));
  const sourceResolution = activation.indexOf("resolveOwnerProducerSourceInTransactionV1(sql, sourcePair, sourceCache)");
  const targetDerivation = activation.indexOf("const manifestSetBody");
  const targetQuery = activation.indexOf("FROM internal_production_owner_producer_manifest_set_activations_v1");
  assert.ok(sourceResolution >= 0 && targetDerivation >= 0 && targetQuery >= 0);
  assert.ok(sourceResolution < targetDerivation, "source resolution must precede target derivation");
  assert.ok(sourceResolution < targetQuery, "source resolution must precede target query");
});

test("database resolves activation and head as one cross-bound recursive chain", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const chain = /async function resolveOwnerProducerActivationChainInTransactionV1\([\s\S]*?\n}\n/.exec(source)?.[0] ?? "";
  assert.match(chain, /receipt\.predecessorActivationRef/);
  assert.match(chain, /receipt\.predecessorHeadRef/);
  assert.match(chain, /head\.predecessorHeadRef/);
  assert.match(chain, /resolveOwnerProducerActivationChainInTransactionV1\(\s*sql,/);
  assert.doesNotMatch(chain, /Promise\.all/);
});

test("database classifies superseded only when the strict current chain contains target", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const activation = source.slice(source.indexOf("async function activateInternalProductionOwnerProducerManifestSetCoreV1"));
  assert.match(activation, /currentChainContainsTarget/);
  assert.match(activation, /if \(currentChainContainsTarget\) throw new OwnerProducerActivationSupersededError\(\)/);
  assert.doesNotMatch(activation, /if \(current\) throw new OwnerProducerActivationSupersededError\(\)/);
});

test("database supersession reuses the one pinned cross-bound chain without a second phase read", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const activation = source.slice(source.indexOf("async function activateInternalProductionOwnerProducerManifestSetCoreV1"));
  assert.doesNotMatch(activation, /currentChainContainsTargetInTransactionV1/);
  assert.match(activation, /currentResolution\.ancestry\.some/);
});

test("database target classification reuses an already resolved current-chain node", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const activation = source.slice(source.indexOf("async function activateInternalProductionOwnerProducerManifestSetCoreV1"));
  assert.match(activation, /currentTargetNode = currentResolution\?\.nodes\.find/);
  assert.match(activation, /if \(currentTargetNode !== undefined\)/);
});

test("database shares one transaction-local resolved-source cache across target and current chain", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  const activation = source.slice(source.indexOf("async function activateInternalProductionOwnerProducerManifestSetCoreV1"));
  assert.match(activation, /const sourceCache = new Map/);
  assert.match(activation, /resolveOwnerProducerSourceInTransactionV1\(sql, sourcePair, sourceCache\)/);
  assert.match(activation, /resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1\(sql, true, sourceCache\)/);
});

test("database keeps the authenticated terminal-body close private behind the fixed controller", async () => {
  const source = await readFile(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
  assert.match(source, /async function closeOwnerReservationInTransactionV1(?:<|\()/);
  assert.match(source, /closeInTransactionV1: closeOwnerReservationInTransactionV1/);
  assert.doesNotMatch(source, /export async function closeOwnerReservationInTransactionV1/);
  const privateClose = source.slice(
    source.indexOf("async function closeOwnerReservationInTransactionV1"),
    source.indexOf("const OWNER_TERMINAL_AUTHORITY_RESOLVERS_V1"),
  );
  assert.match(privateClose, /validateBoundOwnerReservationRowV1/);
  assert.match(privateClose, /validateClosedOwnerReservationRowV1/);
});

test("historical source rejects a self-consistent non-contract PBA before target scans", async () => {
  const db = await import("../../src/db-pg.js");
  const valid = authorityA();
  const invalidBody = structuredClone(authorityAInput());
  (invalidBody.productBuildAuthorityV2Observation.response.evidence.focusedTests as Record<string, unknown>).extra = true;
  invalidBody.productBuildAuthorityV2Observation = resignPbaObservation(
    invalidBody.productBuildAuthorityV2Observation,
  );
  invalidBody.productBuildAuthorityV2DeliveryEvidenceRef = invalidBody.productBuildAuthorityV2Observation.response.deliveryEvidenceRef;
  invalidBody.productBuildAuthorityV2DeliveryEvidenceHash = invalidBody.productBuildAuthorityV2Observation.response.deliveryEvidenceHash;
  const invalidHash = hashCanonicalJson(invalidBody);
  const authority = {
    ...invalidBody,
    sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${invalidHash}`,
    sourceBuildAuthorityHash: invalidHash,
  };
  const sql = db.getSql();
  await sql`
    INSERT INTO internal_production_owner_producer_source_build_authorities_v1 (
      source_build_authority_ref, source_build_authority_hash, plan, manifest_hash,
      owner_category_registry_hash, owner_category_census_map_hash, canonical_body
    ) VALUES (
      ${authority.sourceBuildAuthorityRef}, ${authority.sourceBuildAuthorityHash}, ${authority.plan},
      ${authority.manifestHash}, ${authority.ownerCategoryRegistryHash},
      ${authority.ownerCategoryCensusMapHash}, ${canonicalJsonStringify(authority)}
    )
  `;
  await assert.rejects(
    db.resolveInternalProductionOwnerProducerSourceBuildAuthorityV1({
      plan: "A",
      sourceBuildAuthorityRef: authority.sourceBuildAuthorityRef,
      sourceBuildAuthorityHash: authority.sourceBuildAuthorityHash,
    }),
    /SOURCE_BUILD_AUTHORITY_A_PBA_INVALID/,
  );
  await assert.rejects(
    db.activateInternalProductionOwnerProducerManifestSetV1({
      expectedPredecessor: null,
      manifests: [INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1],
      orderedSourceBuildAuthorities: [{
        plan: "A",
        sourceBuildAuthorityRef: authority.sourceBuildAuthorityRef,
        sourceBuildAuthorityHash: authority.sourceBuildAuthorityHash,
      }],
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
  );
  void valid;
  await db.pgClose();
});

test("PostgreSQL source rows reject every noncanonical TEXT spelling before historical ports", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  const db = await import("../../src/db-pg.js");
  const sql = db.getSql();
  const bodies = [
    ' {"schema":"x"}',
    '{"z":0,"a":0}',
    '{"value":1.0}',
    '{"schema":"x","schema":"x"}',
  ] as const;
  for (const [index, canonicalBody] of bodies.entries()) {
    const hash = String(index + 40).padStart(64, "0");
    const ref = `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${hash}`;
    await sql`
      INSERT INTO internal_production_owner_producer_source_build_authorities_v1 (
        source_build_authority_ref, source_build_authority_hash, plan, manifest_hash,
        owner_category_registry_hash, owner_category_census_map_hash, canonical_body
      ) VALUES (
        ${ref}, ${hash}, 'A', ${INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash},
        ${INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1},
        ${INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1}, ${canonicalBody}
      )
    `;
    await assert.rejects(
      db.resolveInternalProductionOwnerProducerSourceBuildAuthorityV1({
        plan: "A", sourceBuildAuthorityRef: ref, sourceBuildAuthorityHash: hash,
      }),
      /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_CORRUPTION$/,
    );
  }
  await db.pgClose();
});

test("PostgreSQL target resolution rejects noncanonical activation bytes before source or head adoption", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  const db = await import("../../src/db-pg.js");
  const sql = db.getSql();
  const activationHash = "6".repeat(64);
  const headHash = "7".repeat(64);
  const activationRef = `setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${activationHash}`;
  const headRef = `setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/${headHash}`;
  await sql`
    INSERT INTO internal_production_owner_producer_manifest_set_activations_v1 (
      activation_ref, activation_hash, phase, manifest_set_hash,
      owner_category_registry_hash, owner_category_census_map_hash,
      predecessor_activation_ref, predecessor_activation_hash,
      predecessor_head_ref, predecessor_head_hash, canonical_body
    ) VALUES (
      ${activationRef}, ${activationHash}, 'A', ${"8".repeat(64)},
      ${INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1},
      ${INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1},
      NULL, NULL, NULL, NULL, ${' {"schema":"crossed"}'}
    )
  `;
  await sql`
    INSERT INTO internal_production_owner_producer_manifest_activation_heads_v1 (
      head_ref, head_hash, phase, activation_ref, activation_hash,
      predecessor_head_ref, predecessor_head_hash, canonical_body
    ) VALUES (${headRef}, ${headHash}, 'A', ${activationRef}, ${activationHash}, NULL, NULL, ${"{}"})
  `;
  await assert.rejects(
    db.resolveInternalProductionOwnerProducerManifestSetActivationV1({ activationRef, activationHash }),
    /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
  );
  await db.pgClose();
});

test("real PostgreSQL initial activation rolls back a write prefix then identical publishers converge and adopt response loss", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  const fixture = createPreparedActivationRepositoryFixture();
  try {
    const db = await import("../../src/db-pg.js");
    const migrations = await import("../../src/db/contract-spine-migrations.js");
    const guarded = await import("../../src/db/bootstrap-main-claim-handoff-v1-migration.js");
    const sql = db.getSql();
    await sql.unsafe("DROP SCHEMA public CASCADE");
    await sql.unsafe("CREATE SCHEMA public");
    const automatic = await migrations.applyContractSpineMigrations(sql);
    assert.deepEqual(automatic.guardedPending, ["contract-spine-bootstrap-main-claim-handoff-v1"]);

    const receiptUrl = pathToFileURL(path.join(fixture.root, "src/internal-production/baseline-post-handoff-receipt-v1.ts")).href;
    const fixtureReceipt = await import(`${receiptUrl}?prepare=${Date.now()}`);
    const operation = await fixtureReceipt.prepareInternalProductionCurrentEntryOperationV1();
    assert.notEqual(fixture.vendorCommit, operation.controllerSource.sha);

    const fact = (name: string) => hashCanonicalJson({ schema: "setfarm.activation-fixture-fact.v1", name });
    const evidence = guarded.mintBootstrapMainClaimHandoffGuardedMigration32EvidenceForControllerV1({
      schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-evidence.v1",
      purpose: "task6a-guarded-migration-32-after-sealed-spawner-v1",
      currentEntryOperationRef: operation.operationRef,
      currentEntryOperationHash: operation.operationHash,
      sealedSpawnerAdmissionRef: "setfarm://tests/activation/sealed-spawner-admission",
      sealedSpawnerAdmissionHash: fact("sealed-spawner-admission"),
      postPredecessorTerminationLegacyZeroOwnerObservationRef: "setfarm://tests/activation/postzero",
      postPredecessorTerminationLegacyZeroOwnerObservationHash: fact("postzero"),
      authorityV3Migration31AuditRef: operation.authorityV3Migration31Audit.authorityV3Migration31AuditRef,
      authorityV3Migration31AuditHash: operation.authorityV3Migration31Audit.authorityV3Migration31AuditHash,
      pendingBootstrapHandoffMigrationRef: operation.pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationRef,
      pendingBootstrapHandoffMigrationHash: operation.pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationHash,
      cleanSetfarmSourceSha: operation.controllerSource.sha,
      cleanSetfarmTreeHash: operation.controllerSource.treeHash,
      cleanSetfarmBuildHash: operation.controllerSource.buildHash,
      migrationSourceSha: operation.controllerSource.sha,
      freshLegacyZeroOwnerObservationRef: "setfarm://tests/activation/fresh-zero",
      freshLegacyZeroOwnerObservationHash: fact("fresh-zero"),
      preManifestMigration32AuthorizationRef: "setfarm://tests/activation/migration-authorization",
      preManifestMigration32AuthorizationHash: fact("migration-authorization"),
      preManifestMigration32AuthorizationConsumptionRef: "setfarm://tests/activation/migration-consumption",
      preManifestMigration32AuthorizationConsumptionHash: fact("migration-consumption"),
    });
    await migrations.applyBootstrapMainClaimHandoffGuardedMigration32V1(sql, evidence);

    const response = operation.productBuildAuthorityV2Observation.response;
    const sourceBody = {
      schema: "setfarm.internal-production-owner-producer-source-build-authority-a.v1" as const,
      plan: "A" as const,
      manifestHash: INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash,
      currentEntryOperationRef: operation.operationRef,
      currentEntryOperationHash: operation.operationHash,
      setfarmSource: operation.controllerSource,
      productBuildAuthorityV2DeliveryEvidenceRef: response.deliveryEvidenceRef,
      productBuildAuthorityV2DeliveryEvidenceHash: response.deliveryEvidenceHash,
      productBuildAuthorityV2Observation: operation.productBuildAuthorityV2Observation,
      vendorProducerCommit: fixture.vendorCommit,
      vendorProducerCommitAncestorProof: {
        schema: "setfarm.internal-production-vendor-ancestor-proof.v1" as const,
        vendorProducerCommit: fixture.vendorCommit,
        setfarmSourceSha: operation.controllerSource.sha,
        mergeBase: fixture.vendorCommit,
        verified: true as const,
      },
      ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
      ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
    };
    const sourceHash = hashCanonicalJson(sourceBody);
    const source = validateInternalProductionOwnerProducerSourceBuildAuthorityV1({
      ...sourceBody,
      sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${sourceHash}`,
      sourceBuildAuthorityHash: sourceHash,
    });
    const tempDbUrl = pathToFileURL(path.join(fixture.root, "src/db-pg.ts")).href;
    const fixtureDb = await import(`${tempDbUrl}?activation=${Date.now()}`);
    const fixtureSql = fixtureDb.getSql();
    const persistenceDb = await import(pathToFileURL(path.join(fixture.root, "src/db-pg.js")).href);
    await persistenceDb.pgBegin(async () => undefined);
    const input = {
      expectedPredecessor: null,
      manifests: [INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1],
      orderedSourceBuildAuthorities: [{
        plan: "A" as const,
        sourceBuildAuthorityRef: source.sourceBuildAuthorityRef,
        sourceBuildAuthorityHash: source.sourceBuildAuthorityHash,
      }],
    };
    const assertEmptyActivationStore = async () => assert.deepEqual([...(await fixtureSql<Array<{ sources: string; activations: string; heads: string; revision: string }>>`
      SELECT
        (SELECT COUNT(*)::text FROM internal_production_owner_producer_source_build_authorities_v1) AS sources,
        (SELECT COUNT(*)::text FROM internal_production_owner_producer_manifest_set_activations_v1) AS activations,
        (SELECT COUNT(*)::text FROM internal_production_owner_producer_manifest_activation_heads_v1) AS heads,
        (SELECT current_revision::text FROM internal_production_owner_producer_manifest_set_current_v1 WHERE singleton_key=TRUE) AS revision
    `)], [{ sources: "0", activations: "0", heads: "0", revision: "0" }]);

    await assert.rejects(
      fixtureSql.begin((transaction) => fixtureDb.beginOrAdoptInternalProductionOwnerReservationV1(
        transaction,
        { producerImplementationId: "a-runtime-run-v1", ownerKey: "run-persistence-missing-a-ancestry" },
      )),
      /^Error: RUN_PERSISTENCE_ADMISSION_READY_IDENTITY_INVALID$/,
    );
    assert.equal((await fixtureSql<Array<{ count: string }>>`
      SELECT COUNT(*)::text AS count FROM internal_production_owner_reservations_v1
       WHERE owner_key='run-persistence-missing-a-ancestry'
    `)[0]!.count, "0");
    await assertEmptyActivationStore();

    const conflictingHash = `${source.sourceBuildAuthorityHash[0] === "a" ? "b" : "a"}${source.sourceBuildAuthorityHash.slice(1)}`;
    let publicGenericDriftError: unknown;
    try {
      await fixtureDb.activateInternalProductionOwnerProducerManifestSetV1({
        ...input,
        orderedSourceBuildAuthorities: [{
          plan: "A",
          sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${conflictingHash}`,
          sourceBuildAuthorityHash: conflictingHash,
        }],
      });
    } catch (error) {
      publicGenericDriftError = error;
    }
    assert.ok(publicGenericDriftError instanceof Error);
    assert.equal(publicGenericDriftError.message, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
    assert.equal(Object.getPrototypeOf(publicGenericDriftError), Error.prototype);
    assert.equal(Object.hasOwn(publicGenericDriftError, "privateCandidateDrift"), false);
    assert.deepEqual(Object.getOwnPropertySymbols(publicGenericDriftError), []);
    assert.deepEqual(
      Reflect.ownKeys(publicGenericDriftError).filter((key) => key !== "stack" && key !== "message"),
      [],
    );
    await assertEmptyActivationStore();

    await fixtureSql.unsafe(`CREATE FUNCTION ip_op_test_fail_source_v1() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_SOURCE_INSERT_FAILURE'; END $$`);
    await fixtureSql.unsafe(`CREATE TRIGGER ip_op_test_fail_source_v1 BEFORE INSERT ON internal_production_owner_producer_source_build_authorities_v1 FOR EACH ROW EXECUTE FUNCTION ip_op_test_fail_source_v1()`);
    await assert.rejects(
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input),
      /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
    );
    await assertEmptyActivationStore();
    await fixtureSql.unsafe("DROP TRIGGER ip_op_test_fail_source_v1 ON internal_production_owner_producer_source_build_authorities_v1");
    await fixtureSql.unsafe("DROP FUNCTION ip_op_test_fail_source_v1()");

    await fixtureSql.unsafe(`CREATE FUNCTION ip_op_test_fail_activation_v1() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_ACTIVATION_INSERT_FAILURE'; END $$`);
    await fixtureSql.unsafe(`CREATE TRIGGER ip_op_test_fail_activation_v1 BEFORE INSERT ON internal_production_owner_producer_manifest_set_activations_v1 FOR EACH ROW EXECUTE FUNCTION ip_op_test_fail_activation_v1()`);
    await assert.rejects(
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input),
      /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
    );
    await assertEmptyActivationStore();
    await fixtureSql.unsafe("DROP TRIGGER ip_op_test_fail_activation_v1 ON internal_production_owner_producer_manifest_set_activations_v1");
    await fixtureSql.unsafe("DROP FUNCTION ip_op_test_fail_activation_v1()");

    await fixtureSql.unsafe(`CREATE FUNCTION ip_op_test_fail_head_v1() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_HEAD_INSERT_FAILURE'; END $$`);
    await fixtureSql.unsafe(`CREATE TRIGGER ip_op_test_fail_head_v1 BEFORE INSERT ON internal_production_owner_producer_manifest_activation_heads_v1 FOR EACH ROW EXECUTE FUNCTION ip_op_test_fail_head_v1()`);
    await assert.rejects(
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input),
      /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
    );
    await assertEmptyActivationStore();
    await fixtureSql.unsafe("DROP TRIGGER ip_op_test_fail_head_v1 ON internal_production_owner_producer_manifest_activation_heads_v1");
    await fixtureSql.unsafe("DROP FUNCTION ip_op_test_fail_head_v1()");

    await fixtureSql.unsafe(`CREATE FUNCTION ip_op_test_fail_current_v1() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_CURRENT_UPDATE_FAILURE'; END $$`);
    await fixtureSql.unsafe(`CREATE TRIGGER zz_ip_op_test_fail_current_v1 BEFORE UPDATE ON internal_production_owner_producer_manifest_set_current_v1 FOR EACH ROW EXECUTE FUNCTION ip_op_test_fail_current_v1()`);
    await assert.rejects(
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input),
      /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
    );
    await assertEmptyActivationStore();
    await fixtureSql.unsafe("DROP TRIGGER zz_ip_op_test_fail_current_v1 ON internal_production_owner_producer_manifest_set_current_v1");
    await fixtureSql.unsafe("DROP FUNCTION ip_op_test_fail_current_v1()");

    const [first, concurrent] = await Promise.all([
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input),
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input),
    ]);
    assert.deepEqual(concurrent, first);
    assert.deepEqual(await fixtureDb.activateInternalProductionOwnerProducerManifestSetV1(input), first);
    await assert.rejects(
      fixtureDb.activateInternalProductionOwnerProducerManifestSetV1({
        ...input,
        orderedSourceBuildAuthorities: [{
          plan: "A",
          sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${conflictingHash}`,
          sourceBuildAuthorityHash: conflictingHash,
        }],
      }),
      /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION$/,
    );
    assert.deepEqual([...(await fixtureSql<Array<{ sources: string; activations: string; heads: string; revision: string }>>`
      SELECT
        (SELECT COUNT(*)::text FROM internal_production_owner_producer_source_build_authorities_v1) AS sources,
        (SELECT COUNT(*)::text FROM internal_production_owner_producer_manifest_set_activations_v1) AS activations,
        (SELECT COUNT(*)::text FROM internal_production_owner_producer_manifest_activation_heads_v1) AS heads,
        (SELECT current_revision::text FROM internal_production_owner_producer_manifest_set_current_v1 WHERE singleton_key=TRUE) AS revision
    `)], [{ sources: "1", activations: "1", heads: "1", revision: "1" }]);

    const beforeMissingReadiness = (await fixtureSql<Array<{
      head_version: string;
      reservations: string;
      runs: string;
      steps: string;
    }>>`
      SELECT head.head_version::text,
             (SELECT COUNT(*)::text FROM internal_production_owner_reservations_v1) AS reservations,
             (SELECT COUNT(*)::text FROM runs) AS runs,
             (SELECT COUNT(*)::text FROM steps) AS steps
        FROM internal_production_owner_admission_head_v1 head
       WHERE head.singleton=TRUE
    `)[0]!;
    await assert.rejects(
      fixtureSql.begin(async (transaction) => {
        await fixtureDb.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
          producerImplementationId: "a-runtime-run-v1",
          ownerKey: "run-persistence-missing-readiness-module",
        });
        throw new Error("TEST_ACCEPTED_MISSING_RUN_PERSISTENCE_READINESS_MODULE");
      }),
      /^Error: RUN_PERSISTENCE_ADMISSION_READY_UNAVAILABLE$/,
    );
    assert.deepEqual((await fixtureSql<typeof beforeMissingReadiness[]>`
      SELECT head.head_version::text,
             (SELECT COUNT(*)::text FROM internal_production_owner_reservations_v1) AS reservations,
             (SELECT COUNT(*)::text FROM runs) AS runs,
             (SELECT COUNT(*)::text FROM steps) AS steps
        FROM internal_production_owner_admission_head_v1 head
       WHERE head.singleton=TRUE
    `)[0], beforeMissingReadiness);

    const readinessHead = (await fixtureSql<Array<{ head_ref: string; head_hash: string }>>`
      SELECT head_ref,head_hash
        FROM internal_production_owner_producer_manifest_activation_heads_v1
       WHERE activation_ref=${first.activationRef}
         AND activation_hash=${first.activationHash}
    `)[0]!;
    const admissionReadyRef = "setfarm://tests/run-persistence/admission-ready";
    const admissionReadyHash = hashCanonicalJson({
      schema: "setfarm.test-run-persistence-admission-ready.v1",
      activationRef: first.activationRef,
      activationHash: first.activationHash,
    });
    const readinessModulePath = path.join(
      fixture.root,
      "src/internal-production/baseline-spawner-startup-admission-v1.js",
    );
    writeFileSync(readinessModulePath, `
const deepFreeze = (value) => {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};
const READY = deepFreeze(${JSON.stringify({
      state: "normal-task0-admission-ready",
      admissionReadyRef,
      admissionReadyHash,
      manifestActivationRef: first.activationRef,
      manifestActivationHash: first.activationHash,
      manifestHeadRef: readinessHead.head_ref,
      manifestHeadHash: readinessHead.head_hash,
    })});
const STATUS = deepFreeze({
  state: "normal_task0_admission_ready",
  admissionReady: {
    admissionReadyRef: READY.admissionReadyRef,
    admissionReadyHash: READY.admissionReadyHash,
  },
});
export async function observeInternalProductionPreSchemaSpawnerRebindStatusV1() {
  return STATUS;
}
export async function resolveInternalProductionTask0SpawnerAdmissionReadyV1(pair) {
  if (pair.admissionReadyRef !== READY.admissionReadyRef
    || pair.admissionReadyHash !== READY.admissionReadyHash) throw new Error("PAIR_INVALID");
  return READY;
}
`, "utf8");
    const fixtureDbSourcePath = path.join(fixture.root, "src/db-pg.ts");
    const fixtureDbSource = readFileSync(fixtureDbSourcePath, "utf8");
    assert.match(fixtureDbSource, /let _schemaReady = false;/);
    writeFileSync(
      fixtureDbSourcePath,
      fixtureDbSource.replace("let _schemaReady = false;", "let _schemaReady = true;"),
      "utf8",
    );
    const backendWorkerPath = path.join(fixture.root, "task2-backend-worker.mjs");
    writeFileSync(backendWorkerPath, `
import { parentPort } from "node:worker_threads";
parentPort.postMessage({ type: "ready" });
parentPort.on("message", async ({ input }) => {
  try {
    const persistence = await import("./src/execution/run-persistence.ts");
    const value = await persistence.persistWorkflowRun(input);
    parentPort.postMessage({ type: "result", status: "fulfilled", value });
  } catch (error) {
    parentPort.postMessage({ type: "result", status: "rejected", error: String(error) });
  }
});
`, "utf8");
    const backendWorker = new Worker(pathToFileURL(backendWorkerPath), {
      env: process.env,
      execArgv: ["--import", "tsx"],
    });
    await new Promise<void>((resolve, reject) => {
      backendWorker.once("error", reject);
      backendWorker.once("message", (message) => {
        if ((message as { type?: string }).type !== "ready") reject(new Error("TEST_BACKEND_WORKER_NOT_READY"));
        else resolve();
      });
    });
    activatedOwnerAdmissionFixture = { root: fixture.root, db: fixtureDb, sql: fixtureSql, backendWorker };
    await db.pgClose();
  } finally {
    if (activatedOwnerAdmissionFixture === null) {
      rmSync(path.dirname(fixture.root), { recursive: true, force: true });
    }
  }
});

test("real PostgreSQL run persistence fences before mutation and adopts an exact committed run", async (t) => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the activated fixture must remain available");
  const { root, sql, backendWorker } = activatedOwnerAdmissionFixture;
  t.after(async () => { await backendWorker.terminate(); });
  const persistence = await import(`${pathToFileURL(path.join(root, "src/execution/run-persistence.ts")).href}?task2=${Date.now()}`);
  const input = {
    run: {
      id: "run-persistence-task2-exact-adoption",
      runNumber: 1801,
      workflowId: "feature-dev",
      task: "persist one authenticated ordinary run",
      context: "{}",
      notifyUrl: null,
      createdAt: "2026-08-21T00:00:00.000Z",
      protocol: {
        mode: "legacy" as const,
        version: 1 as const,
        compilerReleaseSha: "a".repeat(40),
        activationPreflightHash: null,
        releaseAdmissionHash: null,
        releaseAdmissionKind: null,
        canaryAdmission: null,
      },
    },
    steps: [{
      id: "run-persistence-task2-step",
      stepId: "plan",
      agentId: "feature-dev_planner",
      stepIndex: 0,
      inputTemplate: "task",
      expects: "plan",
      status: "pending",
      maxRetries: 2,
      type: "single",
      loopConfig: null,
    }, {
      id: "run-persistence-task2-step-design",
      stepId: "design",
      agentId: "feature-dev_designer",
      stepIndex: 1,
      inputTemplate: "plan",
      expects: "design",
      status: "waiting",
      maxRetries: 1,
      type: "single",
      loopConfig: null,
    }],
  };
  const snapshot = async () => (await sql<Array<{
    head_version: string;
    reservations: string;
    bindings: string;
    runs: string;
    steps: string;
  }>>`
    SELECT head.head_version::text,
           (SELECT COUNT(*)::text FROM internal_production_owner_reservations_v1) AS reservations,
           (SELECT COUNT(*)::text FROM internal_production_owner_admission_authorities_v1 WHERE authority_kind='binding') AS bindings,
           (SELECT COUNT(*)::text FROM runs) AS runs,
           (SELECT COUNT(*)::text FROM steps) AS steps
      FROM internal_production_owner_admission_head_v1 head
     WHERE head.singleton=TRUE
  `)[0]!;
  const beforeFence = await snapshot();
  await sql`UPDATE setfarm_schema_migrations SET state='adopted' WHERE version=31`;
  try {
    await assert.rejects(
      sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, input)),
      /^Error: RUN_PERSISTENCE_MIGRATION_31_FENCE_DRIFT$/,
    );
    assert.deepEqual(await snapshot(), beforeFence);
  } finally {
    await sql`UPDATE setfarm_schema_migrations SET state='applied' WHERE version=31`;
  }

  const first = await sql.begin((transaction) => (
    persistence.persistWorkflowRunInTransaction(transaction, input)
  ));
  assert.equal(first.run.id, input.run.id);
  assert.equal(first.run.status, "running");
  assert.notEqual(first.run.createdAt, input.run.createdAt);
  assert.match(first.runOwnerReservationRef, /^setfarm:\/\/internal-production\/owner-reservations\//);
  assert.match(first.runOwnerReservationHash, /^[a-f0-9]{64}$/);
  assert.deepEqual([...(await sql<Array<{ runs: string; steps: string; reservations: string; bindings: string }>>`
    SELECT
      (SELECT COUNT(*)::text FROM runs WHERE id=${input.run.id}) AS runs,
      (SELECT COUNT(*)::text FROM steps WHERE run_id=${input.run.id}) AS steps,
      (SELECT COUNT(*)::text FROM internal_production_owner_reservations_v1 WHERE owner_key=${input.run.id} AND state='bound') AS reservations,
      (SELECT COUNT(*)::text FROM internal_production_owner_admission_authorities_v1 authority JOIN internal_production_owner_reservations_v1 reservation ON reservation.reservation_ref=authority.phase_key WHERE reservation.owner_key=${input.run.id} AND authority.authority_kind='binding') AS bindings
  `)], [{ runs: "1", steps: "2", reservations: "1", bindings: "1" }]);
  assert.deepEqual(
    [...await sql<Array<{ id: string; created_at: Date; updated_at: Date }>>`
      SELECT id,created_at,updated_at FROM steps WHERE run_id=${input.run.id} ORDER BY step_index,id
    `].map((step) => ({
      id: step.id,
      createdAt: step.created_at.toISOString(),
      updatedAt: step.updated_at.toISOString(),
    })),
    input.steps.map((step) => ({
      id: step.id,
      createdAt: first.run.createdAt,
      updatedAt: first.run.createdAt,
    })),
  );
  const beforeRetry = await snapshot();
  assert.deepEqual(
    await sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, input)),
    first,
  );
  assert.deepEqual(await snapshot(), beforeRetry);

  const exactStoredInventory = async (ownerKey = input.run.id) => ({
    run: [...await sql`SELECT * FROM runs WHERE id=${ownerKey}`],
    steps: [...await sql`SELECT * FROM steps WHERE run_id=${ownerKey} ORDER BY step_index,id`],
    reservation: [...await sql`SELECT * FROM internal_production_owner_reservations_v1 WHERE owner_key=${ownerKey}`],
    authorities: [...await sql`
      SELECT authority.*
        FROM internal_production_owner_admission_authorities_v1 authority
        JOIN internal_production_owner_reservations_v1 reservation
          ON reservation.reservation_ref=authority.phase_key
       WHERE reservation.owner_key=${ownerKey}
       ORDER BY authority.authority_kind,authority.authority_ref
    `],
    claims: [...await sql`SELECT * FROM claim_log WHERE run_id=${input.run.id} ORDER BY id`],
    attempts: [...await sql`SELECT * FROM execution_attempts WHERE run_id=${input.run.id} ORDER BY attempt_id`],
    head: [...await sql`SELECT * FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE`],
  });
  const crossedRuns = [
    { ...input, run: { ...input.run, runNumber: input.run.runNumber + 1 } },
    { ...input, run: { ...input.run, workflowId: "crossed-workflow" } },
    { ...input, run: { ...input.run, task: `${input.run.task} crossed` } },
    { ...input, run: { ...input.run, context: '{"crossed":true}' } },
    { ...input, run: { ...input.run, notifyUrl: "https://example.invalid/crossed" } },
    { ...input, run: { ...input.run, protocol: { ...input.run.protocol, version: 2 as 1 } } },
    { ...input, run: { ...input.run, protocol: { ...input.run.protocol, compilerReleaseSha: "b".repeat(40) } } },
  ];
  const crossedSteps = [
    { ...input, steps: [{ ...input.steps[0]!, id: "crossed-step-id" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, stepId: "crossed-step" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, agentId: "crossed_agent" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, stepIndex: 7 }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, inputTemplate: "crossed input" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, expects: "crossed output" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, status: "waiting" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, maxRetries: 9 }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, type: "loop" }, input.steps[1]!] },
    { ...input, steps: [{ ...input.steps[0]!, loopConfig: "{}" }, input.steps[1]!] },
    { ...input, steps: [...input.steps].reverse() },
    { ...input, steps: [...input.steps, { ...input.steps[1]!, id: "run-persistence-task2-extra-step", stepIndex: 2 }] },
    { ...input, steps: [] },
  ];
  for (const crossed of [...crossedRuns, ...crossedSteps]) {
    const beforeCrossedRetry = await exactStoredInventory();
    await assert.rejects(
      sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, crossed)),
      /^Error: RUN_PERSISTENCE_ADOPTION_IDENTITY_INVALID$/,
    );
    assert.deepEqual(await exactStoredInventory(), beforeCrossedRetry);
  }
  await sql`UPDATE steps SET created_at=created_at + INTERVAL '1 second' WHERE id=${input.steps[0]!.id}`;
  const crossedTimestampInventory = await exactStoredInventory();
  await assert.rejects(
    sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, input)),
    /^Error: RUN_PERSISTENCE_ADOPTION_IDENTITY_INVALID$/,
  );
  assert.deepEqual(await exactStoredInventory(), crossedTimestampInventory);
  await sql`UPDATE steps SET created_at=${first.run.createdAt},updated_at=${first.run.createdAt} WHERE id=${input.steps[0]!.id}`;

  for (const scenario of [
    {
      label: "pending",
      dropStateShape: true,
      disableAuthorityImmutability: false,
      mutation: `UPDATE internal_production_owner_reservations_v1 SET state='pending' WHERE owner_key='${input.run.id}' RETURNING state AS observed`,
      observed: "pending",
    },
    {
      label: "closed",
      dropStateShape: true,
      disableAuthorityImmutability: false,
      mutation: `UPDATE internal_production_owner_reservations_v1 SET state='closed' WHERE owner_key='${input.run.id}' RETURNING state AS observed`,
      observed: "closed",
    },
    {
      label: "crossed reservation",
      dropStateShape: false,
      disableAuthorityImmutability: false,
      mutation: `UPDATE internal_production_owner_reservations_v1 SET owner_key='crossed-owner' WHERE owner_key='${input.run.id}' RETURNING owner_key AS observed`,
      observed: "crossed-owner",
    },
    {
      label: "crossed binding",
      dropStateShape: false,
      disableAuthorityImmutability: false,
      mutation: `UPDATE internal_production_owner_reservations_v1 SET binding_payload=jsonb_set(binding_payload,'{canonicalOwnerIdentity,ownerHash}',to_jsonb(repeat('e',64))) WHERE owner_key='${input.run.id}' RETURNING binding_payload #>> '{canonicalOwnerIdentity,ownerHash}' AS observed`,
      observed: "e".repeat(64),
    },
    {
      label: "crossed authority",
      dropStateShape: false,
      disableAuthorityImmutability: true,
      mutation: `UPDATE internal_production_owner_admission_authorities_v1 SET authority_body=jsonb_set(authority_body,'{canonicalOwnerIdentity,ownerHash}',to_jsonb(repeat('d',64))) WHERE authority_kind='binding' AND phase_key='${first.runOwnerReservationRef}' RETURNING authority_body #>> '{canonicalOwnerIdentity,ownerHash}' AS observed`,
      observed: "d".repeat(64),
    },
  ] as const) {
    const beforeSidecarDrift = await exactStoredInventory();
    await assert.rejects(
      sql.begin(async (transaction) => {
        if (scenario.dropStateShape) {
          await transaction.unsafe(
            "ALTER TABLE internal_production_owner_reservations_v1 DROP CONSTRAINT internal_production_owner_reservation_state_shape_check",
          );
        }
        if (scenario.disableAuthorityImmutability) {
          await transaction.unsafe(
            "ALTER TABLE internal_production_owner_admission_authorities_v1 DISABLE TRIGGER trg_internal_production_owner_admission_authority_immutable",
          );
        }
        const changed = await transaction.unsafe<Array<{ observed: string }>>(scenario.mutation);
        assert.equal(changed.length, 1, `${scenario.label} setup must change exactly one row before persistence`);
        assert.equal(changed[0]!.observed, scenario.observed, `${scenario.label} setup must complete before persistence`);
        await persistence.persistWorkflowRunInTransaction(transaction, input);
        throw new Error(`TEST_ACCEPTED_${scenario.label.toUpperCase().replaceAll(" ", "_")}`);
      }),
      /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
    );
    assert.deepEqual(await exactStoredInventory(), beforeSidecarDrift);
  }

  await sql`
    INSERT INTO claim_log (run_id,step_id,story_id,agent_id,outcome)
    VALUES (${input.run.id},${input.steps[0]!.stepId},'US-TASK2-ADOPTION','task2-reviewer','test_terminal')
  `;
  const downstreamInventory = await exactStoredInventory();
  await assert.rejects(
    sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, input)),
    /^RunActivationConflictError: RUN_ACTIVATION_CONFLICT:/,
  );
  assert.deepEqual(await exactStoredInventory(), downstreamInventory);
  await sql`DELETE FROM claim_log WHERE run_id=${input.run.id}`;

  await sql.unsafe(
    `INSERT INTO execution_attempts (
       attempt_id,run_id,step_id,story_id,generation,fence_token,attempt_class,
       compilation_report_hash,source_before_sha,source_before_tree_hash,role,
       lease_acquired_at,lease_expires_at,heartbeat_at,disposition
     ) VALUES ($1,$2,$3,'US-TASK2-ADOPTION',1,$4,'evidence_only',$5,$6,$7,
               'reviewer',NOW(),NOW(),NOW(),'verified')`,
    [
      "ATT_task2-adoption-downstream",
      input.run.id,
      input.steps[0]!.stepId,
      "f".repeat(64),
      "e".repeat(64),
      "d".repeat(40),
      "c".repeat(40),
    ],
  );
  const downstreamAttemptInventory = await exactStoredInventory();
  await assert.rejects(
    sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, input)),
    /^RunActivationConflictError: RUN_ACTIVATION_CONFLICT:/,
  );
  assert.deepEqual(await exactStoredInventory(), downstreamAttemptInventory);
  await sql`DELETE FROM execution_attempts WHERE run_id=${input.run.id}`;

  const beforeSecondPair = await exactStoredInventory();
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction.unsafe(
        "ALTER TABLE internal_production_owner_reservations_v1 DROP CONSTRAINT internal_production_owner_reservation_key_unique",
      );
      await transaction.unsafe(
        `INSERT INTO internal_production_owner_reservations_v1 (
           reservation_ref,reservation_hash,category,owner_key,owner_key_hash,
           producer_purpose_hash,producer_implementation_id,producer_implementation_hash,
           reservation_payload,reservation_head_predecessor_hash,state,
           canonical_owner_identity,binding_hash,binding_payload,head_version,
           created_at,updated_at
         ) SELECT $1,$2,category,owner_key,owner_key_hash,producer_purpose_hash,
                  producer_implementation_id,producer_implementation_hash,
                  reservation_payload,reservation_head_predecessor_hash,state,
                  canonical_owner_identity,binding_hash,binding_payload,head_version,
                  created_at,updated_at
             FROM internal_production_owner_reservations_v1
            WHERE owner_key=$3`,
        [
          "setfarm://tests/task2-second-run-owner-pair",
          "9".repeat(64),
          input.run.id,
        ],
      );
      await persistence.persistWorkflowRunInTransaction(transaction, input);
      throw new Error("TEST_ACCEPTED_SECOND_RUN_OWNER_PAIR");
    }),
    (error: unknown) => !String(error).includes("TEST_ACCEPTED_SECOND_RUN_OWNER_PAIR"),
  );
  assert.deepEqual(await exactStoredInventory(), beforeSecondPair);

  const ownerInventory = async (ownerKey: string) => (await sql<Array<{
    runs: string;
    steps: string;
    reservations: string;
    bindings: string;
  }>>`
    SELECT
      (SELECT COUNT(*)::text FROM runs WHERE id=${ownerKey}) AS runs,
      (SELECT COUNT(*)::text FROM steps WHERE run_id=${ownerKey}) AS steps,
      (SELECT COUNT(*)::text FROM internal_production_owner_reservations_v1 WHERE owner_key=${ownerKey}) AS reservations,
      (SELECT COUNT(*)::text
         FROM internal_production_owner_admission_authorities_v1 authority
         JOIN internal_production_owner_reservations_v1 reservation
           ON reservation.reservation_ref=authority.phase_key
        WHERE reservation.owner_key=${ownerKey} AND authority.authority_kind='binding') AS bindings
  `)[0]!;
  const emptyOwnerInventory = { runs: "0", steps: "0", reservations: "0", bindings: "0" };
  const forgedBindingInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task2-forged-binding", runNumber: 1802 },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task2-forged-binding-step-${index}` })),
  };
  await sql.unsafe(`CREATE FUNCTION ip_task2_forge_binding_v1() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.authority_kind='binding'
         AND NEW.authority_body #>> '{canonicalOwnerIdentity,ownerKey}' = 'run-persistence-task2-forged-binding' THEN
        NEW.authority_body = jsonb_set(
          NEW.authority_body,
          '{canonicalOwnerIdentity,ownerHash}',
          to_jsonb(repeat('f', 64))
        );
      END IF;
      RETURN NEW;
    END $$`);
  await sql.unsafe(`CREATE TRIGGER ip_task2_forge_binding_v1
    BEFORE INSERT ON internal_production_owner_admission_authorities_v1
    FOR EACH ROW EXECUTE FUNCTION ip_task2_forge_binding_v1()`);
  try {
    await assert.rejects(
      sql.begin(async (transaction) => {
        await persistence.persistWorkflowRunInTransaction(transaction, forgedBindingInput);
        throw new Error("TEST_ACCEPTED_FORGED_BINDING_AUTHORITY");
      }),
      /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
    );
    assert.deepEqual(await ownerInventory(forgedBindingInput.run.id), emptyOwnerInventory);
  } finally {
    await sql.unsafe("DROP TRIGGER ip_task2_forge_binding_v1 ON internal_production_owner_admission_authorities_v1");
    await sql.unsafe("DROP FUNCTION ip_task2_forge_binding_v1()");
  }
  const forgedReservationInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task2-forged-reservation", runNumber: 1803 },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task2-forged-reservation-step-${index}` })),
  };
  await sql.unsafe(`CREATE FUNCTION ip_task2_forge_reservation_on_bind_v1() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.state='pending'
         AND NEW.state='bound'
         AND NEW.owner_key='run-persistence-task2-forged-reservation' THEN
        NEW.owner_key = 'run-persistence-task2-forged-reservation-crossed';
      END IF;
      RETURN NEW;
    END $$`);
  await sql.unsafe(`CREATE TRIGGER ip_task2_forge_reservation_on_bind_v1
    BEFORE UPDATE ON internal_production_owner_reservations_v1
    FOR EACH ROW EXECUTE FUNCTION ip_task2_forge_reservation_on_bind_v1()`);
  try {
    await assert.rejects(
      sql.begin(async (transaction) => {
        await persistence.persistWorkflowRunInTransaction(transaction, forgedReservationInput);
        throw new Error("TEST_ACCEPTED_FORGED_RESERVATION_DURING_BIND");
      }),
      /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
    );
    assert.deepEqual(await ownerInventory(forgedReservationInput.run.id), emptyOwnerInventory);
  } finally {
    await sql.unsafe("DROP TRIGGER ip_task2_forge_reservation_on_bind_v1 ON internal_production_owner_reservations_v1");
    await sql.unsafe("DROP FUNCTION ip_task2_forge_reservation_on_bind_v1()");
  }
  const rollbackInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task2-rollback", runNumber: 1804 },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task2-rollback-step-${index}` })),
  };
  await assert.rejects(
    sql.begin(async (transaction) => {
      await persistence.persistWorkflowRunInTransaction(transaction, rollbackInput);
      throw new Error("TEST_ROLLBACK_AFTER_TENTATIVE_RESULT");
    }),
    /^Error: TEST_ROLLBACK_AFTER_TENTATIVE_RESULT$/,
  );
  assert.deepEqual(await ownerInventory(rollbackInput.run.id), emptyOwnerInventory);

  const commitRejectedInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task2-commit-rejected", runNumber: 1805 },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task2-commit-rejected-step-${index}` })),
  };
  await sql.unsafe(`CREATE FUNCTION ip_task2_reject_run_commit_v1() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.id = 'run-persistence-task2-commit-rejected' THEN
        RAISE EXCEPTION 'TEST_DEFERRED_RUN_COMMIT_REJECTED';
      END IF;
      RETURN NEW;
    END $$`);
  await sql.unsafe(`CREATE CONSTRAINT TRIGGER ip_task2_reject_run_commit_v1
    AFTER INSERT ON runs DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION ip_task2_reject_run_commit_v1()`);
  try {
    await assert.rejects(
      persistence.persistWorkflowRun(commitRejectedInput),
      /TEST_DEFERRED_RUN_COMMIT_REJECTED/,
    );
    assert.deepEqual(await ownerInventory(commitRejectedInput.run.id), emptyOwnerInventory);
  } finally {
    await sql.unsafe("DROP TRIGGER ip_task2_reject_run_commit_v1 ON runs");
    await sql.unsafe("DROP FUNCTION ip_task2_reject_run_commit_v1()");
  }

  const backendLossInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task2-backend-loss", runNumber: 1806 },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task2-backend-loss-step-${index}` })),
  };
  const advisoryKey = 882018;
  await sql.unsafe(`CREATE FUNCTION ip_task2_wait_reservation_v1() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.owner_key = 'run-persistence-task2-backend-loss' THEN
        PERFORM pg_advisory_xact_lock(${advisoryKey});
      END IF;
      RETURN NEW;
    END $$`);
  await sql.unsafe(`CREATE TRIGGER ip_task2_wait_reservation_v1
    BEFORE INSERT ON internal_production_owner_reservations_v1
    FOR EACH ROW EXECUTE FUNCTION ip_task2_wait_reservation_v1()`);
  let releaseAdvisoryHolder!: () => void;
  let reportAdvisoryHeld!: () => void;
  const advisoryHeld = new Promise<void>((resolve) => { reportAdvisoryHeld = resolve; });
  const releaseAdvisory = new Promise<void>((resolve) => { releaseAdvisoryHolder = resolve; });
  const advisoryHolder = sql.begin(async (transaction) => {
    await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [advisoryKey]);
    reportAdvisoryHeld();
    await releaseAdvisory;
  });
  await advisoryHeld;
  try {
    const publisher = new Promise<Readonly<{ type: string; status?: string; error?: string }>>((resolve) => {
      backendWorker.once("message", (message) => resolve(message as { type: string; status?: string; error?: string }));
      backendWorker.once("error", (error) => resolve({ type: "worker-error", error: String(error) }));
      backendWorker.once("exit", (code) => resolve({ type: "worker-exit", error: String(code) }));
    });
    backendWorker.postMessage({ input: backendLossInput });
    let blocked: Array<{ pid: number }> = [];
    for (let attempt = 0; attempt < 100; attempt += 1) {
      blocked = await sql<Array<{ pid: number }>>`
        SELECT pid
          FROM pg_stat_activity
         WHERE datname=current_database()
           AND pid <> pg_backend_pid()
           AND wait_event_type='Lock'
           AND wait_event='advisory'
           AND query LIKE '%internal_production_owner_reservations_v1%'
      `;
      if (blocked.length === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(blocked.length, 1, `expected one exact blocked publisher, saw ${JSON.stringify(blocked)}`);
    assert.deepEqual(
      [...await sql`SELECT pg_terminate_backend(${blocked[0]!.pid}) AS terminated`],
      [{ terminated: true }],
    );
    const outcome = await publisher;
    assert.notEqual(outcome.status, "fulfilled");
  } finally {
    await backendWorker.terminate();
    releaseAdvisoryHolder();
    await advisoryHolder;
    await sql.unsafe("DROP TRIGGER ip_task2_wait_reservation_v1 ON internal_production_owner_reservations_v1");
    await sql.unsafe("DROP FUNCTION ip_task2_wait_reservation_v1()");
  }
  assert.deepEqual(await ownerInventory(backendLossInput.run.id), emptyOwnerInventory);

  const duplicateStepInput = {
    ...input,
    run: { ...input.run, id: "run-persistence-task2-duplicate-step", runNumber: 1807 },
    steps: [
      { ...input.steps[0]!, id: "run-persistence-task2-duplicate" },
      { ...input.steps[0]!, id: "run-persistence-task2-duplicate", stepIndex: 1 },
    ],
  };
  await assert.rejects(
    sql.begin((transaction) => persistence.persistWorkflowRunInTransaction(transaction, duplicateStepInput)),
  );
  assert.deepEqual(await ownerInventory(duplicateStepInput.run.id), emptyOwnerInventory);

  await sql`UPDATE runs SET status='completed' WHERE id=${input.run.id}`;

  const canaryStoreRoot = mkdtempSync(path.join(tmpdir(), "setfarm-task2-canary-store-"));
  t.after(() => rmSync(canaryStoreRoot, { recursive: true, force: true }));
  const fixtureReport = await import(`${pathToFileURL(path.join(root, "src/evals/report.ts")).href}?task2canary=${Date.now()}`);
  const fixtureV3 = await import(`${pathToFileURL(path.join(root, "src/execution/v3-release-admission-repository.ts")).href}?task2canary=${Date.now()}`);
  const fixtureProtocol = await import(`${pathToFileURL(path.join(root, "src/execution/run-protocol.ts")).href}?task2canary=${Date.now()}`);
  const canaryRepository = fixtureV3.createV3ReleaseAdmissionRepository(
    sql,
    new fixtureReport.ContentAddressedEvalResultStore(canaryStoreRoot),
  );
  const canaryTask = "persist one owner-bound release canary";
  const canaryCreated = await canaryRepository.createCanary({
    releaseSha: "a".repeat(40),
    suiteHash: "b".repeat(64),
    preflightHash: "c".repeat(64),
    ttlMs: 60 * 60 * 1_000,
    slots: [1, 2].map((repetition) => ({
      caseHash: hashCanonicalJson({ case: "task2-owner-canary", repetition }),
      taskHash: hashCanonicalJson(canaryTask),
      repetition,
      slotToken: `task2-owner-canary-${repetition}-${"x".repeat(48)}`,
    })),
  });
  const canaryProtocolFor = async (index: number) => fixtureProtocol.resolveNewRunProtocol({
    requestedMode: "v3",
    compilerReleaseSha: "a".repeat(40),
    env: { SETFARM_V3_ACTIVATION: "enabled" },
    activationPreflight: { status: "pass", hash: "c".repeat(64), stored: true },
    releaseAdmission: await canaryRepository.verifyCanarySelection({
      releaseSha: "a".repeat(40),
      taskHash: hashCanonicalJson(canaryTask),
      context: canaryCreated.contexts[index]!,
    }),
  });
  const canaryInput = {
    ...input,
    run: {
      ...input.run,
      id: "run-persistence-task2-owner-canary",
      runNumber: 1808,
      task: canaryTask,
      protocol: await canaryProtocolFor(0),
    },
    steps: input.steps.map((step, index) => ({ ...step, id: `run-persistence-task2-owner-canary-step-${index}` })),
  };
  const canaryFirst = await persistence.persistWorkflowRun(canaryInput);
  assert.deepEqual(await persistence.persistWorkflowRun(canaryInput), canaryFirst);
  const crossedCanaryInput = {
    ...canaryInput,
    run: { ...canaryInput.run, protocol: await canaryProtocolFor(1) },
  };
  const beforeCrossedCanary = await exactStoredInventory(canaryInput.run.id);
  await assert.rejects(
    persistence.persistWorkflowRun(crossedCanaryInput),
    /^Error: RUN_CANARY_ADMISSION_SLOT_UNAVAILABLE$/,
  );
  assert.deepEqual(await exactStoredInventory(canaryInput.run.id), beforeCrossedCanary);
  await sql`UPDATE runs SET status='completed' WHERE id=${canaryInput.run.id}`;

  const publisherInput = (id: string, runNumber: number, mode: "legacy" | "shadow") => ({
    ...input,
    run: {
      ...input.run,
      id,
      runNumber,
      task: `deterministic ${mode} publisher`,
      protocol: mode === "legacy" ? input.run.protocol : {
        mode: "shadow" as const,
        version: 1 as const,
        compilerReleaseSha: "a".repeat(40),
        activationPreflightHash: "b".repeat(64),
        releaseAdmissionHash: null,
        releaseAdmissionKind: null,
        canaryAdmission: null,
      },
    },
    steps: input.steps.map((step, index) => ({ ...step, id: `${id}-step-${index}` })),
  });
  for (const [round, winnerMode, loserMode] of [
    [0, "legacy", "shadow"],
    [1, "shadow", "legacy"],
  ] as const) {
    const winnerInput = publisherInput(`run-persistence-task2-race-${round}-winner`, 1810 + round * 2, winnerMode);
    const loserInput = publisherInput(`run-persistence-task2-race-${round}-loser`, 1811 + round * 2, loserMode);
    const roundKey = 882100 + round;
    const functionName = `ip_task2_wait_publisher_${round}_v1`;
    await sql.unsafe(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.owner_key = '${winnerInput.run.id}' THEN
          PERFORM pg_advisory_xact_lock(${roundKey});
        END IF;
        RETURN NEW;
      END $$`);
    await sql.unsafe(`CREATE TRIGGER ${functionName}
      BEFORE INSERT ON internal_production_owner_reservations_v1
      FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
    let releaseRound!: () => void;
    let reportRoundHeld!: () => void;
    const roundHeld = new Promise<void>((resolve) => { reportRoundHeld = resolve; });
    const roundRelease = new Promise<void>((resolve) => { releaseRound = resolve; });
    const holder = sql.begin(async (transaction) => {
      await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [roundKey]);
      reportRoundHeld();
      await roundRelease;
    });
    await roundHeld;
    try {
      const winner = persistence.persistWorkflowRun(winnerInput).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason }),
      );
      let blocked: Array<{ pid: number }> = [];
      for (let attempt = 0; attempt < 100; attempt += 1) {
        blocked = await sql<Array<{ pid: number }>>`
          SELECT pid FROM pg_stat_activity
           WHERE datname=current_database()
             AND pid <> pg_backend_pid()
             AND wait_event_type='Lock'
             AND wait_event='advisory'
             AND query LIKE '%internal_production_owner_reservations_v1%'
        `;
        if (blocked.length === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert.equal(blocked.length, 1);
      let loserSettled = false;
      const loser = persistence.persistWorkflowRun(loserInput).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason }),
      ).finally(() => { loserSettled = true; });
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(loserSettled, false);
      releaseRound();
      const [winnerResult, loserResult] = await Promise.all([winner, loser]);
      assert.equal(winnerResult.status, "fulfilled");
      assert.equal(loserResult.status, "rejected");
      assert.match(String("reason" in loserResult ? loserResult.reason : ""), /RUN_ACTIVATION_CONFLICT/);
      assert.deepEqual(await ownerInventory(winnerInput.run.id), {
        runs: "1", steps: "2", reservations: "1", bindings: "1",
      });
      assert.deepEqual(await ownerInventory(loserInput.run.id), emptyOwnerInventory);
      await sql`UPDATE runs SET status='completed' WHERE id=${winnerInput.run.id}`;
    } finally {
      releaseRound();
      await holder;
      await sql.unsafe(`DROP TRIGGER ${functionName} ON internal_production_owner_reservations_v1`);
      await sql.unsafe(`DROP FUNCTION ${functionName}()`);
    }
  }
});

test("real PostgreSQL owner admission begins adopts binds and rejects an unauthenticated terminal pair", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the prior real activation fixture must remain available");
  const { db, sql, root } = activatedOwnerAdmissionFixture;
  try {
  const ownerKey = "run-owner-p1-real-pg";
  const begin = () => sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(
    transaction,
    { producerImplementationId: "a-runtime-run-v1", ownerKey },
  ));
  const [first, concurrent] = await Promise.all([begin(), begin()]);
  assert.deepEqual(concurrent, first);
  assert.deepEqual(await begin(), first);
  const storedCreationVersion = (await sql<Array<{ head_version: string }>>`
    SELECT head_version::text FROM internal_production_owner_reservations_v1
     WHERE reservation_ref=${first.reservationRef}
  `)[0]!.head_version;
  await sql`UPDATE internal_production_owner_reservations_v1 SET head_version=head_version+7 WHERE reservation_ref=${first.reservationRef}`;
  await assert.rejects(begin(), /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/);
  await sql`UPDATE internal_production_owner_reservations_v1 SET head_version=${storedCreationVersion} WHERE reservation_ref=${first.reservationRef}`;
  assert.deepEqual(await db.resolveInternalProductionOwnerReservationV1({
    reservationRef: first.reservationRef,
    reservationHash: first.reservationHash,
  }), first);

  const identity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey,
    ownerRef: "setfarm://runs/run-owner-p1-real-pg",
    ownerHash: SHA_B,
  };
  const bind = () => sql.begin((transaction) => db.bindInternalProductionOwnerReservationV1(
    transaction,
    {
      reservationRef: first.reservationRef,
      reservationHash: first.reservationHash,
      canonicalOwnerIdentity: identity,
    },
  ));
  const bound = await bind();
  assert.deepEqual(await bind(), bound);
  const bindingRef = `setfarm://internal-production/bound-owner-reservations/${bound.bindingHash}`;
  const bindingHead = (await sql<Array<{ predecessor_head_hash: string }>>`
    SELECT predecessor_head_hash
      FROM internal_production_owner_admission_authorities_v1
     WHERE authority_ref=${bindingRef} AND authority_hash=${bound.bindingHash}
  `)[0]!.predecessor_head_hash;
  await sql.unsafe("ALTER TABLE internal_production_owner_admission_authorities_v1 DISABLE TRIGGER trg_internal_production_owner_admission_authority_immutable");
  try {
    await sql`UPDATE internal_production_owner_admission_authorities_v1 SET predecessor_head_hash=${SHA_C},successor_head_hash=${SHA_C} WHERE authority_ref=${bindingRef}`;
    await assert.rejects(begin(), /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/);
    await sql`UPDATE internal_production_owner_admission_authorities_v1 SET predecessor_head_hash=${bindingHead},successor_head_hash=${bindingHead} WHERE authority_ref=${bindingRef}`;
  } finally {
    await sql.unsafe("ALTER TABLE internal_production_owner_admission_authorities_v1 ENABLE TRIGGER trg_internal_production_owner_admission_authority_immutable");
  }
  await assert.rejects(
    sql.begin((transaction) => db.bindInternalProductionOwnerReservationV1(transaction, {
      reservationRef: first.reservationRef,
      reservationHash: first.reservationHash,
      canonicalOwnerIdentity: { ...identity, ownerHash: SHA_C },
    })),
    /OWNER_IDENTITY_CONFLICT/,
  );

  const stalePending = await sql.begin((transaction) => (
    db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: "a-runtime-run-v1",
      ownerKey: "run-owner-stale-pending-bind",
    })
  ));
  await sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(
    transaction,
    { producerImplementationId: "a-runtime-run-v1", ownerKey: "run-owner-intervening-head" },
  ));
  const staleIdentity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey: stalePending.ownerKey,
    ownerRef: "setfarm://runs/run-owner-stale-pending-bind",
    ownerHash: SHA_B,
  };
  await assert.rejects(
    sql.begin((transaction) => db.bindInternalProductionOwnerReservationV1(transaction, {
      reservationRef: stalePending.reservationRef,
      reservationHash: stalePending.reservationHash,
      canonicalOwnerIdentity: staleIdentity,
    })),
    /^Error: INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CONFLICT$/,
  );
  assert.deepEqual([...(await sql<Array<{
    state: string;
    canonical_owner_identity: unknown | null;
    binding_hash: string | null;
    binding_payload: unknown | null;
    binding_authorities: string;
  }>>`
    SELECT reservation.state,reservation.canonical_owner_identity,reservation.binding_hash,
           reservation.binding_payload,COUNT(authority.authority_ref)::text AS binding_authorities
      FROM internal_production_owner_reservations_v1 reservation
      LEFT JOIN internal_production_owner_admission_authorities_v1 authority
        ON authority.phase_key=reservation.reservation_ref AND authority.authority_kind='binding'
     WHERE reservation.reservation_ref=${stalePending.reservationRef}
     GROUP BY reservation.reservation_ref
  `)], [{
    state: "pending",
    canonical_owner_identity: null,
    binding_hash: null,
    binding_payload: null,
    binding_authorities: "0",
  }]);

  const terminal = createInternalProductionTerminalOwnerAuthorityV1({
    canonicalOwnerIdentity: identity,
    terminalOwnerRef: "setfarm://runs/run-owner-p1-real-pg/terminal/completed",
    terminalOwnerHash: SHA_C,
  });
  const terminalPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
  const beforeUnavailable = await sql<Array<{ state: string; head_version: string }>>`
    SELECT reservation.state, head.head_version::text
      FROM internal_production_owner_reservations_v1 reservation
      CROSS JOIN internal_production_owner_admission_head_v1 head
     WHERE reservation.reservation_ref = ${first.reservationRef}
  `;
  await assert.rejects(
    sql.begin((transaction) => db.closeInternalProductionOwnerReservationV1(transaction, {
      reservationRef: first.reservationRef,
      reservationHash: first.reservationHash,
      ...terminalPair,
    })),
    /^Error: INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_UNAVAILABLE$/,
  );
  assert.deepEqual(await sql<Array<{ state: string; head_version: string }>>`
    SELECT reservation.state, head.head_version::text
      FROM internal_production_owner_reservations_v1 reservation
      CROSS JOIN internal_production_owner_admission_head_v1 head
     WHERE reservation.reservation_ref = ${first.reservationRef}
  `, beforeUnavailable);

  let rolledBackReservation: Awaited<ReturnType<typeof begin>> | undefined;
  await assert.rejects(
    sql.begin(async (transaction) => {
      rolledBackReservation = await db.beginOrAdoptInternalProductionOwnerReservationV1(
        transaction,
        { producerImplementationId: "a-runtime-run-v1", ownerKey: "run-owner-p1-rollback" },
      );
      throw new Error("ROLLBACK_AFTER_BEGIN");
    }),
    /ROLLBACK_AFTER_BEGIN/,
  );
  assert.ok(rolledBackReservation);
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationV1({
      reservationRef: rolledBackReservation.reservationRef,
      reservationHash: rolledBackReservation.reservationHash,
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_UNAVAILABLE$/,
  );

  await assert.rejects(
    sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(
      transaction,
      { producerImplementationId: "future-owner-v1", ownerKey: "future-owner" },
    )),
    /^Error: INTERNAL_PRODUCTION_OWNER_PRODUCER_IMPLEMENTATION_UNAVAILABLE$/,
  );

  const headBeforeTamper = (await sql<Array<{
    head_version: string;
    head_hash: string;
    migration_application_evidence_hash: string;
    head_payload: unknown;
  }>>`SELECT head_version::text,head_hash,migration_application_evidence_hash,head_payload FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE`)[0]!;
  const reservationCountBeforeTamper = (await sql<Array<{ count: string }>>`SELECT COUNT(*)::text AS count FROM internal_production_owner_reservations_v1`)[0]!.count;
  const headTampers = [
    { head_payload: sql.json({ schema: "setfarm.internal-production-owner-admission-head.v1", version: 99 }) },
    { migration_application_evidence_hash: SHA_C },
    { head_hash: SHA_C },
  ] as const;
  for (const [index, tamper] of headTampers.entries()) {
    if ("head_payload" in tamper) {
      await sql`UPDATE internal_production_owner_admission_head_v1 SET head_payload=${tamper.head_payload} WHERE singleton=TRUE`;
    } else if ("migration_application_evidence_hash" in tamper) {
      await sql`UPDATE internal_production_owner_admission_head_v1 SET migration_application_evidence_hash=${tamper.migration_application_evidence_hash} WHERE singleton=TRUE`;
    } else {
      await sql`UPDATE internal_production_owner_admission_head_v1 SET head_hash=${tamper.head_hash} WHERE singleton=TRUE`;
    }
    await assert.rejects(
      sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(
        transaction,
        { producerImplementationId: "a-runtime-run-v1", ownerKey: `head-tamper-${index}` },
      )),
      /^Error: INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION$/,
    );
    await sql`UPDATE internal_production_owner_admission_head_v1 SET head_version=${headBeforeTamper.head_version},head_hash=${headBeforeTamper.head_hash},migration_application_evidence_hash=${headBeforeTamper.migration_application_evidence_hash},head_payload=${sql.json(headBeforeTamper.head_payload as never)} WHERE singleton=TRUE`;
    assert.equal((await sql<Array<{ count: string }>>`SELECT COUNT(*)::text AS count FROM internal_production_owner_reservations_v1`)[0]!.count, reservationCountBeforeTamper);
  }
  const advancingAuthority = (await sql<Array<{ authority_ref: string; phase_key: string }>>`
    SELECT authority_ref,phase_key
      FROM internal_production_owner_admission_authorities_v1
     WHERE successor_head_hash=${headBeforeTamper.head_hash}
       AND predecessor_head_hash<>successor_head_hash
  `)[0]!;
  await sql.unsafe("ALTER TABLE internal_production_owner_admission_authorities_v1 DISABLE TRIGGER trg_internal_production_owner_admission_authority_immutable");
  try {
    await sql`UPDATE internal_production_owner_admission_authorities_v1 SET phase_key='setfarm://tests/crossed-phase' WHERE authority_ref=${advancingAuthority.authority_ref}`;
    await assert.rejects(
      sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(
        transaction,
        { producerImplementationId: "a-runtime-run-v1", ownerKey: "head-crossed-phase" },
      )),
      /^Error: INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION$/,
    );
    assert.equal((await sql<Array<{ count: string }>>`SELECT COUNT(*)::text AS count FROM internal_production_owner_reservations_v1`)[0]!.count, reservationCountBeforeTamper);
    await sql`UPDATE internal_production_owner_admission_authorities_v1 SET phase_key=${advancingAuthority.phase_key} WHERE authority_ref=${advancingAuthority.authority_ref}`;
  } finally {
    await sql.unsafe("ALTER TABLE internal_production_owner_admission_authorities_v1 ENABLE TRIGGER trg_internal_production_owner_admission_authority_immutable");
  }

  const missingBindingReservation = await sql.begin((transaction) => (
    db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: "a-runtime-run-v1",
      ownerKey: "run-owner-missing-binding-authority",
    })
  ));
  const missingBindingIdentity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey: missingBindingReservation.ownerKey,
    ownerRef: "setfarm://runs/run-owner-missing-binding-authority",
    ownerHash: SHA_B,
  };
  const missingBindingBody = createInternalProductionBoundOwnerReservationV1({
    reservation: missingBindingReservation,
    canonicalOwnerIdentity: missingBindingIdentity,
  });
  await sql`UPDATE internal_production_owner_reservations_v1 SET state='bound',canonical_owner_identity=${sql.json(missingBindingIdentity)},binding_hash=${missingBindingBody.bindingHash},binding_payload=${sql.json(missingBindingBody)} WHERE reservation_ref=${missingBindingReservation.reservationRef}`;
  await assert.rejects(
    sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: missingBindingReservation.producerImplementationId,
      ownerKey: missingBindingReservation.ownerKey,
    })),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
  );
  await assert.rejects(
    sql.begin((transaction) => db.bindInternalProductionOwnerReservationV1(transaction, {
      reservationRef: missingBindingReservation.reservationRef,
      reservationHash: missingBindingReservation.reservationHash,
      canonicalOwnerIdentity: missingBindingIdentity,
    })),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
  );
  } catch (error) {
    await db.pgClose();
    rmSync(path.dirname(root), { recursive: true, force: true });
    activatedOwnerAdmissionFixture = null;
    throw error;
  }
});

test("real PostgreSQL workflow run owner pairs resolve only from authenticated stored state", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the owner-admission fixture must remain available");
  const { db, sql } = activatedOwnerAdmissionFixture;
  const createBoundRun = async (runId: string, status: string) => sql.begin(async (transaction) => {
    const reservation = await db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: "a-runtime-run-v1",
      ownerKey: runId,
    });
    await transaction`
      INSERT INTO runs (id,workflow_id,task,status)
      VALUES (${runId},'workflow-run-owner-task1','terminal fixture',${status})
    `;
    return db.bindInternalProductionOwnerReservationV1(transaction, {
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
      canonicalOwnerIdentity: db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId),
    });
  });
  const snapshot = async () => (await sql<Array<{ reservations: string; head_version: string }>>`
    SELECT COUNT(reservation.reservation_ref)::text AS reservations,
           head.head_version::text AS head_version
      FROM internal_production_owner_reservations_v1 reservation
      CROSS JOIN internal_production_owner_admission_head_v1 head
     GROUP BY head.head_version
  `)[0]!;

  let completed: Awaited<ReturnType<typeof createBoundRun>> | null = null;
  for (const status of ["completed", "failed", "cancelled"] as const) {
    const runId = `run-owner-task1-${status}`;
    const identity = db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId);
    const bound = await createBoundRun(runId, status);
    if (status === "completed") completed = bound;
    assert.deepEqual(await db.resolveBoundInternalProductionWorkflowRunOwnerV1({
      runOwnerReservationRef: bound.reservationRef,
      runOwnerReservationHash: bound.reservationHash,
    }), bound);
    assert.deepEqual(await db.recoverBoundInternalProductionWorkflowRunOwnerV1({ runId }), bound);
    const terminalOwnerRef = `setfarm://runs/${encodeURIComponent(runId)}/terminal/${status}`;
    const terminalOwnerHash = hashCanonicalJson({
      schema: "setfarm.internal-production-workflow-run-terminal-owner.v1",
      runId,
      status,
    });
    const expectedTerminalPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(
      createInternalProductionTerminalOwnerAuthorityV1({
        canonicalOwnerIdentity: identity,
        terminalOwnerRef,
        terminalOwnerHash,
      }),
    );
    assert.deepEqual(await sql.begin((transaction) => (
      db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
        transaction,
        { runId },
      )
    )), {
      runOwnerReservationRef: bound.reservationRef,
      runOwnerReservationHash: bound.reservationHash,
      ...expectedTerminalPair,
    });
  }
  assert.ok(completed);

  const beforeWrongPair = await snapshot();
  await assert.rejects(
    db.resolveBoundInternalProductionWorkflowRunOwnerV1({
      runOwnerReservationRef: completed.reservationRef,
      runOwnerReservationHash: SHA_A,
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
  );
  assert.deepEqual(await snapshot(), beforeWrongPair);

  const secondMatchingRef = `setfarm://internal-production/owner-reservations/${SHA_C}`;
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`
        INSERT INTO internal_production_owner_reservations_v1 (
          reservation_ref,reservation_hash,category,owner_key,owner_key_hash,
          producer_purpose_hash,producer_implementation_id,producer_implementation_hash,
          reservation_payload,reservation_head_predecessor_hash,state,
          canonical_owner_identity,binding_hash,binding_payload,head_version
        )
        SELECT ${secondMatchingRef},${SHA_C},category,owner_key,${SHA_B},
               producer_purpose_hash,producer_implementation_id,producer_implementation_hash,
               reservation_payload,reservation_head_predecessor_hash,state,
               canonical_owner_identity,binding_hash,binding_payload,head_version
          FROM internal_production_owner_reservations_v1
         WHERE reservation_ref=${completed.reservationRef}
      `;
      return db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
        transaction,
        { runId: "run-owner-task1-completed" },
      );
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
  );
  assert.deepEqual(await snapshot(), beforeWrongPair);

  const crossedImplementationReservation = await sql.begin((transaction) => (
    db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: "a-recovery-source-bootstrap-run-v1",
      ownerKey: "run-owner-task1-crossed-implementation",
    })
  ));
  const crossedImplementationBound = await sql.begin((transaction) => (
    db.bindInternalProductionOwnerReservationV1(transaction, {
      reservationRef: crossedImplementationReservation.reservationRef,
      reservationHash: crossedImplementationReservation.reservationHash,
      canonicalOwnerIdentity: db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(
        crossedImplementationReservation.ownerKey,
      ),
    })
  ));
  await assert.rejects(
    db.resolveBoundInternalProductionWorkflowRunOwnerV1({
      runOwnerReservationRef: crossedImplementationBound.reservationRef,
      runOwnerReservationHash: crossedImplementationBound.reservationHash,
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/,
  );

  const pendingRunId = "run-owner-task1-pending";
  await sql.begin((transaction) => db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
    producerImplementationId: "a-runtime-run-v1",
    ownerKey: pendingRunId,
  }));
  const beforePending = await snapshot();
  await assert.rejects(
    db.recoverBoundInternalProductionWorkflowRunOwnerV1({ runId: pendingRunId }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
  );
  assert.deepEqual(await snapshot(), beforePending);

  const nonterminalRunId = "run-owner-task1-running";
  await createBoundRun(nonterminalRunId, "running");
  const beforeNonterminal = await snapshot();
  await assert.rejects(
    sql.begin((transaction) => db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
      transaction,
      { runId: nonterminalRunId },
    )),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_TERMINAL_STATUS_INVALID$/,
  );
  assert.deepEqual(await snapshot(), beforeNonterminal);

  const invalidStatusRunId = "run-owner-task1-invalid-status";
  const invalidStatusBound = await createBoundRun(invalidStatusRunId, "terminal-ish");
  const beforeInvalidStatus = await snapshot();
  await assert.rejects(
    sql.begin((transaction) => db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
      transaction,
      { runId: invalidStatusRunId },
    )),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_TERMINAL_STATUS_INVALID$/,
  );
  assert.deepEqual(await snapshot(), beforeInvalidStatus);

  const crossedIdentity = {
    ...db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(invalidStatusRunId),
    ownerKey: `${invalidStatusRunId}-crossed`,
  };
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`
        UPDATE internal_production_owner_reservations_v1
           SET canonical_owner_identity=${transaction.json(crossedIdentity)}
         WHERE reservation_ref=${invalidStatusBound.reservationRef}
      `;
      return db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
        transaction,
        { runId: invalidStatusRunId },
      );
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/,
  );
  assert.deepEqual(await snapshot(), beforeInvalidStatus);

  for (const [label, expected, mutate] of [
    ["category", /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/, async (transaction: typeof sql) => {
      await transaction`UPDATE internal_production_owner_reservations_v1 SET category='claim' WHERE reservation_ref=${invalidStatusBound.reservationRef}`;
    }],
    ["owner key", /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/, async (transaction: typeof sql) => {
      await transaction`UPDATE internal_production_owner_reservations_v1 SET owner_key=${`${invalidStatusRunId}-crossed`} WHERE reservation_ref=${invalidStatusBound.reservationRef}`;
    }],
    ["binding body", /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/, async (transaction: typeof sql) => {
      await transaction`UPDATE internal_production_owner_reservations_v1 SET binding_payload=binding_payload || '{"extra":true}'::jsonb WHERE reservation_ref=${invalidStatusBound.reservationRef}`;
    }],
  ] as const) {
    await assert.rejects(
      sql.begin(async (transaction) => {
        await mutate(transaction as typeof sql);
        return db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
          transaction,
          { runId: invalidStatusRunId },
        );
      }),
      expected,
      label,
    );
    assert.deepEqual(await snapshot(), beforeInvalidStatus, label);
  }

  const completedRunId = "run-owner-task1-completed";
  const completedPair = await sql.begin((transaction) => (
    db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
      transaction,
      { runId: completedRunId },
    )
  ));
  await sql.begin((transaction) => db.closeInternalProductionOwnerReservationV1(transaction, {
    reservationRef: completedPair.runOwnerReservationRef,
    reservationHash: completedPair.runOwnerReservationHash,
    terminalAuthorityRef: completedPair.terminalAuthorityRef,
    terminalAuthorityHash: completedPair.terminalAuthorityHash,
  }));
  await assert.rejects(
    db.recoverBoundInternalProductionWorkflowRunOwnerV1({ runId: completedRunId }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
  );
  await assert.rejects(
    db.resolveBoundInternalProductionWorkflowRunOwnerV1({
      runOwnerReservationRef: completedPair.runOwnerReservationRef,
      runOwnerReservationHash: completedPair.runOwnerReservationHash,
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
  );
  assert.deepEqual(await sql.begin((transaction) => (
    db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
      transaction,
      { runId: completedRunId },
    )
  )), completedPair);

  const encodedRunId = "run/owner-task1-encoded";
  const encodedBound = await createBoundRun(encodedRunId, "completed");
  const encodedOwnerHash = hashCanonicalJson({
    schema: "setfarm.internal-production-workflow-run-terminal-owner.v1",
    runId: encodedRunId,
    status: "completed",
  });
  for (const terminalOwnerRef of [
    `setfarm://runs/${encodedRunId}/terminal/completed`,
    `setfarm://runs/${encodeURIComponent(encodedRunId).replace("%2F", "%2f")}/terminal/completed`,
  ]) {
    const noncanonicalPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(
      createInternalProductionTerminalOwnerAuthorityV1({
        canonicalOwnerIdentity: db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(encodedRunId),
        terminalOwnerRef,
        terminalOwnerHash: encodedOwnerHash,
      }),
    );
    const beforeNoncanonical = await snapshot();
    await assert.rejects(
      sql.begin((transaction) => db.closeInternalProductionOwnerReservationV1(transaction, {
        reservationRef: encodedBound.reservationRef,
        reservationHash: encodedBound.reservationHash,
        ...noncanonicalPair,
      })),
      /^Error: INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_UNAVAILABLE$/,
    );
    assert.deepEqual(await snapshot(), beforeNoncanonical);
  }

  const rawTerminal = deriveInternalProductionTerminalOwnerAuthorityPairV1(
    createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(completedRunId),
      terminalOwnerRef: `setfarm://runs/${completedRunId}/terminal/failed`,
      terminalOwnerHash: hashCanonicalJson({
        schema: "setfarm.internal-production-workflow-run-terminal-owner.v1",
        runId: completedRunId,
        status: "failed",
      }),
    }),
  );
  const beforeCrossedTerminal = await snapshot();
  await assert.rejects(
    sql.begin((transaction) => db.closeInternalProductionOwnerReservationV1(transaction, {
      reservationRef: invalidStatusBound.reservationRef,
      reservationHash: invalidStatusBound.reservationHash,
      ...rawTerminal,
    })),
    /^Error: INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_UNAVAILABLE$/,
  );
  assert.deepEqual(await snapshot(), beforeCrossedTerminal);
});

test("real PostgreSQL terminal pair replay locks only its exact run", { timeout: 15_000 }, async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the owner-admission fixture must remain available");
  const { db, sql } = activatedOwnerAdmissionFixture;
  const boundByRun = new Map<string, Awaited<ReturnType<typeof db.bindInternalProductionOwnerReservationV1>>>();
  for (const runId of ["run-owner-task1-concurrent-a", "run-owner-task1-concurrent-b"]) {
    const bound = await sql.begin(async (transaction) => {
      const reservation = await db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
        producerImplementationId: "a-runtime-run-v1",
        ownerKey: runId,
      });
      await transaction`
        INSERT INTO runs (id,workflow_id,task,status)
        VALUES (${runId},'workflow-run-owner-task1','concurrent terminal fixture','running')
      `;
      return db.bindInternalProductionOwnerReservationV1(transaction, {
        reservationRef: reservation.reservationRef,
        reservationHash: reservation.reservationHash,
        canonicalOwnerIdentity: db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId),
      });
    });
    boundByRun.set(runId, bound);
  }

  let arrivals = 0;
  let release!: () => void;
  const bothRunRowsLocked = new Promise<void>((resolve) => { release = resolve; });
  const transactionAttempts = new Map<string, number>();
  const replay = (runId: string) => sql.begin(async (transaction) => {
    transactionAttempts.set(runId, (transactionAttempts.get(runId) ?? 0) + 1);
    await transaction`UPDATE runs SET status='completed' WHERE id=${runId}`;
    arrivals += 1;
    if (arrivals === 2) release();
    await bothRunRowsLocked;
    return db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
      transaction,
      { runId },
    );
  });
  const runIds = ["run-owner-task1-concurrent-a", "run-owner-task1-concurrent-b"] as const;
  const results = await Promise.allSettled(runIds.map(replay));
  assert.deepEqual(
    runIds.map((runId) => [runId, transactionAttempts.get(runId)]),
    runIds.map((runId) => [runId, 1]),
  );
  for (const [index, result] of results.entries()) {
    assert.equal(result.status, "fulfilled", result.status === "rejected" ? String(result.reason) : undefined);
    if (result.status !== "fulfilled") continue;
    const runId = runIds[index]!;
    const bound = boundByRun.get(runId)!;
    const expectedPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(
      createInternalProductionTerminalOwnerAuthorityV1({
        canonicalOwnerIdentity: db.createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId),
        terminalOwnerRef: `setfarm://runs/${encodeURIComponent(runId)}/terminal/completed`,
        terminalOwnerHash: hashCanonicalJson({
          schema: "setfarm.internal-production-workflow-run-terminal-owner.v1",
          runId,
          status: "completed",
        }),
      }),
    );
    assert.deepEqual(result.value, {
      runOwnerReservationRef: bound.reservationRef,
      runOwnerReservationHash: bound.reservationHash,
      ...expectedPair,
    });
  }

  let lockedUnrelated!: () => void;
  const unrelatedLocked = new Promise<void>((resolve) => { lockedUnrelated = resolve; });
  let releaseUnrelated!: () => void;
  const holdUnrelated = new Promise<void>((resolve) => { releaseUnrelated = resolve; });
  const unrelatedRunId = runIds[1];
  const unrelatedBlocker = sql.begin(async (transaction) => {
    await transaction`UPDATE runs SET status=status WHERE id=${unrelatedRunId}`;
    lockedUnrelated();
    await holdUnrelated;
  });
  await unrelatedLocked;
  let exactReplay: Awaited<ReturnType<typeof db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1>>;
  try {
    exactReplay = await sql.begin(async (transaction) => {
      await transaction`SET LOCAL lock_timeout='250ms'`;
      return db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
        transaction,
        { runId: runIds[0] },
      );
    });
  } finally {
    releaseUnrelated();
    await unrelatedBlocker;
  }
  assert.deepEqual(exactReplay, results[0]!.status === "fulfilled" ? results[0]!.value : null);
});

test("real PostgreSQL closed workflow run rejects terminal status drift without mutation", async () => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the owner-admission fixture must remain available");
  const { db, sql } = activatedOwnerAdmissionFixture;
  const runId = "run-owner-task1-completed";
  const before = (await sql<Array<{
    status: string;
    state: string;
    terminal_owner_ref: string;
    terminal_owner_hash: string;
    close_ref: string;
    close_hash: string;
    head_version: string;
  }>>`
    SELECT run.status,reservation.state,reservation.terminal_owner_ref,
           reservation.terminal_owner_hash,reservation.close_ref,reservation.close_hash,
           head.head_version::text
      FROM runs run
      JOIN internal_production_owner_reservations_v1 reservation
        ON reservation.owner_key=run.id
      CROSS JOIN internal_production_owner_admission_head_v1 head
     WHERE run.id=${runId}
       AND reservation.producer_implementation_id='a-runtime-run-v1'
       AND reservation.category='run'
  `)[0]!;
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`UPDATE runs SET status='failed' WHERE id=${runId}`;
      await db.resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
        transaction,
        { runId },
      );
      throw new Error("TEST_ACCEPTED_CLOSED_WORKFLOW_RUN_TERMINAL_DRIFT");
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/,
  );
  assert.deepEqual((await sql<typeof before[]>`
    SELECT run.status,reservation.state,reservation.terminal_owner_ref,
           reservation.terminal_owner_hash,reservation.close_ref,reservation.close_hash,
           head.head_version::text
      FROM runs run
      JOIN internal_production_owner_reservations_v1 reservation
        ON reservation.owner_key=run.id
      CROSS JOIN internal_production_owner_admission_head_v1 head
     WHERE run.id=${runId}
       AND reservation.producer_implementation_id='a-runtime-run-v1'
       AND reservation.category='run'
  `)[0], before);
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`UPDATE runs SET status='failed' WHERE id=${runId}`;
      await db.resolveInternalProductionOwnerReservationCloseInTransactionV1(transaction, {
        closeRef: before.close_ref,
        closeHash: before.close_hash,
      });
      throw new Error("TEST_ACCEPTED_CLOSED_WORKFLOW_RUN_TERMINAL_OWNER_DRIFT");
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION$/,
  );
  assert.deepEqual((await sql<typeof before[]>`
    SELECT run.status,reservation.state,reservation.terminal_owner_ref,
           reservation.terminal_owner_hash,reservation.close_ref,reservation.close_hash,
           head.head_version::text
      FROM runs run
      JOIN internal_production_owner_reservations_v1 reservation
        ON reservation.owner_key=run.id
      CROSS JOIN internal_production_owner_admission_head_v1 head
     WHERE run.id=${runId}
       AND reservation.producer_implementation_id='a-runtime-run-v1'
       AND reservation.category='run'
  `)[0], before);
});

test("real PostgreSQL close resolver rejects a bare historical row and unavailable terminal authority", async (t) => {
  if (process.env.SETFARM_PG_URL === undefined) return;
  assert.ok(activatedOwnerAdmissionFixture, "the owner-admission fixture must remain available");
  const { db, sql, root } = activatedOwnerAdmissionFixture;
  t.after(async () => {
    await db.pgClose();
    rmSync(path.dirname(root), { recursive: true, force: true });
    activatedOwnerAdmissionFixture = null;
  });
  const row = INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1[0];
  const currentHead = (await sql<Array<{
    head_version: string;
    head_hash: string;
    head_payload: { migrationApplication: unknown };
  }>>`SELECT head_version::text,head_hash,head_payload FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE`)[0]!;
  const reservation = createInternalProductionOwnerReservationV1({
    producer: row,
    ownerKey: "run-owner-canonical-historical-close",
    ownerAdmissionHeadPredecessorHash: currentHead.head_hash,
  });
  const identity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey: reservation.ownerKey,
    ownerRef: "setfarm://runs/run-owner-canonical-historical-close",
    ownerHash: SHA_B,
  };
  const bound = createInternalProductionBoundOwnerReservationV1({
    reservation,
    canonicalOwnerIdentity: identity,
  });
  const terminal = createInternalProductionTerminalOwnerAuthorityV1({
    canonicalOwnerIdentity: identity,
    terminalOwnerRef: "setfarm://runs/run-owner-canonical-historical-close/terminal/completed",
    terminalOwnerHash: SHA_C,
  });
  const reservationSuccessorPayload = {
    schema: "setfarm.internal-production-owner-admission-head.v1",
    version: Number(currentHead.head_version) + 1,
    predecessorHeadHash: currentHead.head_hash,
    transitionKind: "reservation",
    transitionRef: reservation.reservationRef,
    transitionHash: reservation.reservationHash,
    migrationApplication: currentHead.head_payload.migrationApplication,
  };
  const reservationSuccessorHash = hashCanonicalJson(reservationSuccessorPayload);
  const intermediateReservation = createInternalProductionOwnerReservationV1({
    producer: row,
    ownerKey: "run-owner-intermediate-head-transition",
    ownerAdmissionHeadPredecessorHash: reservationSuccessorHash,
  });
  const intermediateSuccessorPayload = {
    schema: "setfarm.internal-production-owner-admission-head.v1",
    version: reservationSuccessorPayload.version + 1,
    predecessorHeadHash: reservationSuccessorHash,
    transitionKind: "reservation",
    transitionRef: intermediateReservation.reservationRef,
    transitionHash: intermediateReservation.reservationHash,
    migrationApplication: currentHead.head_payload.migrationApplication,
  };
  const intermediateSuccessorHash = hashCanonicalJson(intermediateSuccessorPayload);
  const closeTransition = {
    schema: "setfarm.internal-production-owner-reservation-close-transition.v1",
    reservationRef: bound.reservationRef,
    reservationHash: bound.reservationHash,
    terminalOwnerRef: terminal.terminalOwnerRef,
    terminalOwnerHash: terminal.terminalOwnerHash,
  };
  const closeTransitionHash = hashCanonicalJson(closeTransition);
  const closeSuccessorPayload = {
    schema: "setfarm.internal-production-owner-admission-head.v1",
    version: intermediateSuccessorPayload.version + 1,
    predecessorHeadHash: intermediateSuccessorHash,
    transitionKind: "close",
    transitionRef: `setfarm://internal-production/owner-reservation-close-transitions/${closeTransitionHash}`,
    transitionHash: closeTransitionHash,
    migrationApplication: currentHead.head_payload.migrationApplication,
  };
  const closeSuccessorHash = hashCanonicalJson(closeSuccessorPayload);
  const close = createInternalProductionOwnerReservationCloseV1({
    closeKind: "ordinary",
    boundReservation: bound,
    terminalAuthority: terminal,
    ownerAdmissionHeadPredecessorHash: intermediateSuccessorHash,
    ownerAdmissionHeadSuccessorHash: closeSuccessorHash,
    preservedFenceRef: null,
    preservedFenceHash: null,
  });
  await sql`
    INSERT INTO internal_production_owner_reservations_v1 (
      reservation_ref, reservation_hash, category, owner_key, owner_key_hash,
      producer_purpose_hash, producer_implementation_id, producer_implementation_hash,
      reservation_payload, reservation_head_predecessor_hash, state,
      canonical_owner_identity, binding_hash, binding_payload, close_kind,
      terminal_owner_ref, terminal_owner_hash, close_head_predecessor_hash,
      close_head_successor_hash, preserved_fence_ref, preserved_fence_hash,
      close_ref, close_hash, close_payload, head_version
    ) VALUES (
      ${reservation.reservationRef}, ${reservation.reservationHash}, ${reservation.category},
      ${reservation.ownerKey}, ${reservation.ownerKeyHash}, ${reservation.producerPurposeHash},
      ${reservation.producerImplementationId}, ${reservation.producerImplementationHash},
      ${sql.json(reservation)}, ${reservation.ownerAdmissionHeadPredecessorHash},
      'closed', ${sql.json(identity)}, ${bound.bindingHash},
      ${sql.json(bound)}, ${close.closeKind}, ${close.terminalOwnerRef},
      ${close.terminalOwnerHash}, ${close.ownerAdmissionHeadPredecessorHash},
      ${close.ownerAdmissionHeadSuccessorHash}, NULL, NULL, ${close.closeRef}, ${close.closeHash},
      ${sql.json(close)}, ${closeSuccessorPayload.version}
    )
  `;
  await sql`
    INSERT INTO internal_production_owner_reservations_v1 (
      reservation_ref,reservation_hash,category,owner_key,owner_key_hash,
      producer_purpose_hash,producer_implementation_id,producer_implementation_hash,
      reservation_payload,reservation_head_predecessor_hash,state,head_version
    ) VALUES (
      ${intermediateReservation.reservationRef},${intermediateReservation.reservationHash},
      ${intermediateReservation.category},${intermediateReservation.ownerKey},
      ${intermediateReservation.ownerKeyHash},${intermediateReservation.producerPurposeHash},
      ${intermediateReservation.producerImplementationId},
      ${intermediateReservation.producerImplementationHash},${sql.json(intermediateReservation)},
      ${intermediateReservation.ownerAdmissionHeadPredecessorHash},'pending',
      ${intermediateSuccessorPayload.version}
    )
  `;
  await sql`
    INSERT INTO internal_production_owner_admission_authorities_v1 (
      authority_ref, authority_hash, authority_kind, phase_key,
      predecessor_head_hash, successor_head_hash, authority_body
    ) VALUES (
      ${reservation.reservationRef}, ${reservation.reservationHash}, 'reservation',
      ${reservation.reservationRef}, ${reservation.ownerAdmissionHeadPredecessorHash},
      ${reservationSuccessorHash}, ${sql.json(reservation)}
    ), (
      ${intermediateReservation.reservationRef}, ${intermediateReservation.reservationHash},
      'reservation', ${intermediateReservation.reservationRef},
      ${intermediateReservation.ownerAdmissionHeadPredecessorHash},
      ${intermediateSuccessorHash}, ${sql.json(intermediateReservation)}
    ), (
      ${close.closeRef}, ${close.closeHash}, 'close', ${reservation.reservationRef},
      ${close.ownerAdmissionHeadPredecessorHash}, ${close.ownerAdmissionHeadSuccessorHash},
      ${sql.json(close)}
    )
  `;
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationV1({
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
  );
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationCloseV1({
      closeRef: close.closeRef,
      closeHash: close.closeHash,
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION$/,
  );
  const bindingRef = `setfarm://internal-production/bound-owner-reservations/${bound.bindingHash}`;
  await sql`
    INSERT INTO internal_production_owner_admission_authorities_v1 (
      authority_ref, authority_hash, authority_kind, phase_key,
      predecessor_head_hash, successor_head_hash, authority_body
    ) VALUES (
      ${bindingRef}, ${bound.bindingHash}, 'binding', ${reservation.reservationRef},
      ${reservationSuccessorHash}, ${reservationSuccessorHash}, ${sql.json(bound)}
    )
  `;
  assert.deepEqual(await db.resolveInternalProductionOwnerReservationV1({
    reservationRef: reservation.reservationRef,
    reservationHash: reservation.reservationHash,
  }), reservation);
  const beginHistorical = () => sql.begin((transaction) => (
    db.beginOrAdoptInternalProductionOwnerReservationV1(transaction, {
      producerImplementationId: reservation.producerImplementationId,
      ownerKey: reservation.ownerKey,
    })
  ));
  await sql.unsafe("ALTER TABLE internal_production_owner_admission_authorities_v1 DISABLE TRIGGER trg_internal_production_owner_admission_authority_immutable");
  try {
    await sql`DELETE FROM internal_production_owner_admission_authorities_v1 WHERE authority_ref=${close.closeRef} AND authority_hash=${close.closeHash}`;
    await assert.rejects(beginHistorical(), /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/);
    await sql`
      INSERT INTO internal_production_owner_admission_authorities_v1 (
        authority_ref, authority_hash, authority_kind, phase_key,
        predecessor_head_hash, successor_head_hash, authority_body
      ) VALUES (
        ${close.closeRef}, ${close.closeHash}, 'close', ${reservation.reservationRef},
        ${close.ownerAdmissionHeadPredecessorHash}, ${close.ownerAdmissionHeadSuccessorHash},
        ${sql.json(close)}
      )
    `;
    await sql`UPDATE internal_production_owner_admission_authorities_v1 SET phase_key=${intermediateReservation.reservationRef} WHERE authority_ref=${close.closeRef}`;
    await assert.rejects(beginHistorical(), /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/);
    await sql`UPDATE internal_production_owner_admission_authorities_v1 SET phase_key=${reservation.reservationRef} WHERE authority_ref=${close.closeRef}`;
  } finally {
    await sql.unsafe("ALTER TABLE internal_production_owner_admission_authorities_v1 ENABLE TRIGGER trg_internal_production_owner_admission_authority_immutable");
  }
  assert.deepEqual(await beginHistorical(), reservation);
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationCloseV1({
      closeRef: close.closeRef,
      closeHash: close.closeHash,
    }),
    /^Error: INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE$/,
  );
  const crossedReservation = createInternalProductionOwnerReservationV1({
    producer: row,
    ownerKey: "run-owner-crossed-reservation-successor",
    ownerAdmissionHeadPredecessorHash: currentHead.head_hash,
  });
  await sql`
    INSERT INTO internal_production_owner_reservations_v1 (
      reservation_ref,reservation_hash,category,owner_key,owner_key_hash,
      producer_purpose_hash,producer_implementation_id,producer_implementation_hash,
      reservation_payload,reservation_head_predecessor_hash,state,head_version
    ) VALUES (
      ${crossedReservation.reservationRef},${crossedReservation.reservationHash},
      ${crossedReservation.category},${crossedReservation.ownerKey},${crossedReservation.ownerKeyHash},
      ${crossedReservation.producerPurposeHash},${crossedReservation.producerImplementationId},
      ${crossedReservation.producerImplementationHash},${sql.json(crossedReservation)},
      ${crossedReservation.ownerAdmissionHeadPredecessorHash},'pending',
      ${reservationSuccessorPayload.version}
    )
  `;
  await sql`
    INSERT INTO internal_production_owner_admission_authorities_v1 (
      authority_ref,authority_hash,authority_kind,phase_key,
      predecessor_head_hash,successor_head_hash,authority_body
    ) VALUES (
      ${crossedReservation.reservationRef},${crossedReservation.reservationHash},'reservation',
      ${crossedReservation.reservationRef},${currentHead.head_hash},${SHA_C},
      ${sql.json(crossedReservation)}
    )
  `;
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationV1({
      reservationRef: crossedReservation.reservationRef,
      reservationHash: crossedReservation.reservationHash,
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION$/,
  );
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationV1({
      reservationRef: reservation.reservationRef,
      reservationHash: SHA_C,
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_UNAVAILABLE$/,
  );
  await assert.rejects(
    db.resolveInternalProductionOwnerReservationCloseV1({
      closeRef: close.closeRef,
      closeHash: SHA_C,
    }),
    /^Error: INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_UNAVAILABLE$/,
  );
});

function assertDeepFrozen(value: unknown, label: string): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) {
      assertDeepFrozen(descriptor.value, `${label}.${String(key)}`);
    }
  }
}

const EXPECTED_CATEGORIES = [
  "run", "claim", "execution-attempt", "runtime-session", "completion-owner",
  "mandatory-effect", "ordinary-service-start", "restart-reservation",
  "service-restart-operation", "launch-preparation", "prepared-launch", "staged-case",
  "fixture-attempt", "artifact-reservation", "artifact-publication", "docs-session",
  "docs-lease", "fleet-stage", "fleet-inflight", "fleet-review", "matrix-inflight",
  "launch-outbox", "termination", "finding", "recovery", "operational-delivery",
  "source-run", "cold-rehearsal", "compilation-lease", "execution-lease", "process",
  "listener", "worktree", "dirty-worktree", "stale-child",
] as const;

const EXPECTED_CENSUS_KEYS = [
  "activeRunCount", "openClaimCount", "executionAttemptCount",
  "activeRuntimeSessionCount", "activeCompletionOwnerCount",
  "unsettledMandatoryEffectCount", "ordinaryStartingCount", "restartReservationCount",
  "serviceRestartOperationCount", "launchPreparationCount", "preparedLaunchCount",
  "stagedCaseCount", "fixtureAttemptCount", "artifactReservationCount",
  "publicationBatchCount", "artifactPublicationCount", "docsSessionCount",
  "docsLeaseCount", "fleetStageCount", "fleetInflightCount", "fleetPendingReviewCount",
  "matrixInflightCount", "launchOutboxCount", "terminationOwnerCount",
  "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount",
  "sourceRunOwnerCount", "coldRehearsalOwnerCount", "compilationLeaseCount",
  "executionLeaseCount", "ownedProcessCount", "ownedListenerCount",
  "ownedWorktreeCount", "dirtyWorktreeCount", "staleChildCount",
] as const;

const EXPECTED_A_TUPLES = [
  ["src/execution/run-persistence.ts", "persistWorkflowRunInTransaction", "a-runtime-run-v1", "run", "run-id-generation-v1", "activeRunCount"],
  ["src/execution/claim-runtime-publication.ts", "publishSingleClaimRuntime", "a-claim-single-runtime-v1", "claim", "claim-log-id-v1", "openClaimCount"],
  ["src/execution/claim-runtime-publication.ts", "publishLoopClaimRuntime", "a-claim-loop-runtime-v1", "claim", "claim-log-id-v1", "openClaimCount"],
  ["src/recovery/v3-downstream-evidence-publication.ts", "createV3DownstreamEvidencePublication.reserve", "a-claim-v3-downstream-evidence-v1", "claim", "claim-log-id-v1", "openClaimCount"],
  ["src/recovery/v3-evidence-only-publication.ts", "createV3EvidenceOnlyPublication.reserve", "a-claim-v3-evidence-only-v1", "claim", "claim-log-id-v1", "openClaimCount"],
  ["src/execution/attempt-repository.ts", "reserveAttemptInTransaction", "a-execution-attempt-v1", "execution-attempt", "execution-attempt-id-generation-v1", "executionAttemptCount"],
  ["src/execution/runtime-session-repository.ts", "reserveRuntimeSessionInTransaction", "a-runtime-session-v1", "runtime-session", "runtime-session-id-v1", "activeRuntimeSessionCount"],
  ["src/execution/runtime-completion.ts", "createRuntimeCompletionRepository.claim", "a-completion-owner-v1", "completion-owner", "completion-request-id-v1", "activeCompletionOwnerCount"],
  ["src/execution/runtime-completion.ts", "markRuntimeCompletionOwnerCommittedInTransaction", "a-mandatory-effect-v1", "mandatory-effect", "completion-request-id-effect-key-v1", "unsettledMandatoryEffectCount"],
  ["src/execution/run-termination.ts", "requestRunTerminationInTransaction", "a-termination-v1", "termination", "termination-request-id-v1", "terminationOwnerCount"],
  ["src/recovery/finding-recovery-repository.ts", "createFindingRecoveryRepository.putFindingSet", "a-finding-recovery-repository-v1", "finding", "finding-set-hash-v1", "findingOwnerCount"],
  ["src/recovery/v3-downstream-evidence-publication.ts", "putFindingSet", "a-finding-v3-downstream-evidence-v1", "finding", "finding-set-hash-v1", "findingOwnerCount"],
  ["src/recovery/v3-evidence-only-publication.ts", "putFindingSetInTransaction", "a-finding-v3-evidence-only-v1", "finding", "finding-set-hash-v1", "findingOwnerCount"],
  ["src/execution/operational-outbox-repository.ts", "createOperationalOutboxRepository.publish", "a-operational-delivery-v1", "operational-delivery", "operational-event-key-consumer-v1", "operationalDeliveryCount"],
  ["src/internal-production/baseline-post-handoff-receipt-v1.ts", "reserveRecoverySourceRunOwnerV1", "a-recovery-source-run-v1", "source-run", "source-bootstrap-operation-run-v1", "sourceRunOwnerCount"],
  ["src/internal-production/baseline-post-handoff-receipt-v1.ts", "reserveRecoverySourceBootstrapRunOwnerV1", "a-recovery-source-bootstrap-run-v1", "run", "source-bootstrap-reciprocal-run-v1", "activeRunCount"],
] as const;

test("freezes the exact 35-category registry and complete 36-counter census mapping", () => {
  assert.deepEqual(INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1, EXPECTED_CATEGORIES);
  assert.equal(new Set(INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1).size, 35);
  assert.deepEqual(Object.keys(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1), EXPECTED_CATEGORIES);
  assert.deepEqual(
    [...new Set(Object.values(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1).flat())].sort(),
    [...EXPECTED_CENSUS_KEYS].sort(),
  );
  assert.equal(Object.values(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1).flat().length, 36);
  assert.deepEqual(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1["artifact-publication"], [
    "publicationBatchCount", "artifactPublicationCount",
  ]);
});

test("freezes and hashes the exact sixteen A producer rows", () => {
  assert.equal(INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1.length, 16);
  assert.deepEqual(
    INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1.map((row) => [
      row.module, row.function, row.implementationId, row.category,
      row.ownerKeyDerivationId, row.censusKeys.join(","),
    ]),
    EXPECTED_A_TUPLES,
  );
  assert.deepEqual(
    INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash,
    hashCanonicalJson({
      schema: "setfarm.internal-production-owner-producer-manifest.v1",
      plan: "A",
      rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1,
    }),
  );
  assert.deepEqual(
    validateInternalProductionOwnerProducerManifestV1(
      INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
    ),
    INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  );
});

test("validates the stable source pair and schema-domain-separated activation chain", () => {
  assert.equal(INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1, hashCanonicalJson({
    schema: "setfarm.internal-production-owner-category-registry.v1",
    categories: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1,
  }));
  assert.equal(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1, hashCanonicalJson({
    schema: "setfarm.internal-production-owner-category-census-map.v1",
    entries: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1.map((category) => ({
      category,
      censusKeys: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1[category],
    })),
  }));
  const source = validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1({
    plan: "A",
    sourceBuildAuthorityRef:
      `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${SHA_A}`,
    sourceBuildAuthorityHash: SHA_A,
  });
  const manifestSetHash = hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-manifest-set.v1",
    phase: "A",
    orderedPlans: ["A"],
    orderedManifestHashes: [INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash],
    orderedSourceBuildAuthorities: [source],
    ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
    ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  });
  const receiptBody = {
    schema: "setfarm.internal-production-owner-producer-manifest-set-activation.v1" as const,
    phase: "A" as const,
    orderedPlans: ["A"] as const,
    orderedManifestHashes: [INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash],
    orderedSourceBuildAuthorities: [source],
    manifestSetHash,
    ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
    ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
    predecessorActivationRef: null,
    predecessorActivationHash: null,
    predecessorHeadRef: null,
    predecessorHeadHash: null,
  };
  const activationHash = hashCanonicalJson(receiptBody);
  const receipt = validateInternalProductionOwnerProducerManifestSetActivationReceiptV1({
    ...receiptBody,
    activationRef:
      `setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${activationHash}`,
    activationHash,
  });
  const headBody = {
    schema: "setfarm.internal-production-owner-producer-manifest-set-activation-head.v1" as const,
    phase: "A" as const,
    activationRef: receipt.activationRef,
    activationHash: receipt.activationHash,
    predecessorHeadRef: null,
    predecessorHeadHash: null,
  };
  const headHash = hashCanonicalJson(headBody);
  const head = validateInternalProductionOwnerProducerManifestSetActivationHeadV1({
    ...headBody,
    headRef:
      `setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/${headHash}`,
    headHash,
  });
  const current = validateInternalProductionOwnerProducerManifestSetActivationCurrentV1({
    currentRevision: 1,
    head,
    receipt,
  });
  assert.equal(current.currentRevision, 1);
  assertDeepFrozen(current, "activation current");

  assert.throws(
    () => validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1({
      ...source,
      plan: "B",
    }),
    /SOURCE_BUILD_AUTHORITY_REF_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestSetActivationReceiptV1({
      ...receipt,
      activationHash: SHA_B,
    }),
    /ACTIVATION_DERIVATION_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestSetActivationCurrentV1({
      currentRevision: 1,
      head: { ...head, activationHash: SHA_B },
      receipt,
    }),
    /ACTIVATION_HEAD_DERIVATION_INVALID|ACTIVATION_CURRENT_PAIR_INVALID/,
  );
});

test("manifest validation is strict and rejects hash, census, duplicate, and A-row drift", () => {
  const manifest = structuredClone(INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1);
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestV1({ ...manifest, extra: true }),
    /MANIFEST_KEYS_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestV1({ ...manifest, manifestHash: SHA_A }),
    /MANIFEST_HASH_INVALID/,
  );
  const wrongCensus = structuredClone(manifest);
  // @ts-expect-error runtime rejection fixture deliberately mutates readonly caller input
  wrongCensus.rows[0]!.censusKeys = ["openClaimCount"];
  // @ts-expect-error runtime rejection fixture deliberately mutates readonly caller input
  wrongCensus.manifestHash = hashCanonicalJson({ schema: wrongCensus.schema, plan: wrongCensus.plan, rows: wrongCensus.rows });
  assert.throws(() => validateInternalProductionOwnerProducerManifestV1(wrongCensus), /ROW_CENSUS_KEYS_INVALID/);
  const duplicate = structuredClone(manifest);
  // @ts-expect-error runtime rejection fixture deliberately mutates readonly caller input
  duplicate.rows[1]!.implementationId = duplicate.rows[0]!.implementationId;
  // @ts-expect-error runtime rejection fixture deliberately mutates readonly caller input
  duplicate.manifestHash = hashCanonicalJson({ schema: duplicate.schema, plan: duplicate.plan, rows: duplicate.rows });
  assert.throws(() => validateInternalProductionOwnerProducerManifestV1(duplicate), /IMPLEMENTATION_ID_DUPLICATE/);
  const reorderedA = structuredClone(manifest);
  // @ts-expect-error runtime rejection fixture deliberately mutates readonly caller input
  reorderedA.rows.reverse();
  // @ts-expect-error runtime rejection fixture deliberately mutates readonly caller input
  reorderedA.manifestHash = hashCanonicalJson({ schema: reorderedA.schema, plan: reorderedA.plan, rows: reorderedA.rows });
  assert.throws(() => validateInternalProductionOwnerProducerManifestV1(reorderedA), /PLAN_A_ROWS_INVALID/);
});

function syntheticManifest(
  plan: "B" | "C" | "D" | "E",
  count: number,
): InternalProductionOwnerProducerManifestV1 {
  const rows: InternalProductionOwnerProducerRowV1[] = Array.from({ length: count }, (_, index) => {
    const category = EXPECTED_CATEGORIES[(index + plan.charCodeAt(0)) % EXPECTED_CATEGORIES.length]!;
    return {
      plan,
      module: `src/${plan.toLowerCase()}/producer-${index}.ts`,
      function: `produce${plan}${index}`,
      implementationId: `${plan.toLowerCase()}-producer-${index}-v1`,
      category,
      ownerKeyDerivationId: `${plan.toLowerCase()}-owner-key-${index}-v1`,
      censusKeys: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1[category],
    };
  });
  return {
    schema: "setfarm.internal-production-owner-producer-manifest.v1",
    plan,
    rows,
    manifestHash: hashCanonicalJson({
      schema: "setfarm.internal-production-owner-producer-manifest.v1", plan, rows,
    }),
  };
}

test("assembles only the ordered 16/10/6/16/9 five-plan registry", () => {
  const manifests = [
    INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
    syntheticManifest("B", 10), syntheticManifest("C", 6),
    syntheticManifest("D", 16), syntheticManifest("E", 9),
  ] as const;
  const assembled = assembleInternalProductionOwnerProducerRegistryV1({ manifests });
  assert.equal(assembled.rows.length, 57);
  assert.equal(assembled.registryHash, hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-registry.v1",
    rows: assembled.rows,
  }));
  const wrong = [...manifests] as unknown as [
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
  ];
  wrong[2] = syntheticManifest("C", 5);
  assert.throws(() => assembleInternalProductionOwnerProducerRegistryV1({ manifests: wrong }), /MANIFEST_ROW_COUNT_INVALID/);
});

function reservationFixture() {
  const row = INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1[0];
  const reservation = createInternalProductionOwnerReservationV1({
    producer: row,
    ownerKey: "run-owner-admission-test-1",
    ownerAdmissionHeadPredecessorHash: SHA_A,
  });
  const identity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey: reservation.ownerKey,
    ownerRef: "setfarm://runs/run-owner-admission-test-1",
    ownerHash: SHA_B,
  };
  const bound = createInternalProductionBoundOwnerReservationV1({
    reservation,
    canonicalOwnerIdentity: identity,
  });
  const terminal = createInternalProductionTerminalOwnerAuthorityV1({
    canonicalOwnerIdentity: identity,
    terminalOwnerRef: "setfarm://runs/run-owner-admission-test-1/terminal/completed",
    terminalOwnerHash: SHA_C,
  });
  return { row, reservation, identity, bound, terminal };
}

test("constructs canonical reservation, binding, terminal authority, and pair", () => {
  const { row, reservation, bound, terminal } = reservationFixture();
  assert.deepEqual(validateInternalProductionOwnerReservationV1(reservation, row), reservation);
  assert.deepEqual(validateInternalProductionBoundOwnerReservationV1(bound), bound);
  assert.deepEqual(validateInternalProductionTerminalOwnerAuthorityV1(terminal), terminal);
  const pair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
  assert.deepEqual(validateInternalProductionTerminalOwnerAuthorityPairV1(pair, terminal), pair);
  assert.match(reservation.reservationRef, /^setfarm:\/\/internal-production\/owner-reservations\/[a-f0-9]{64}$/);
  assert.match(bound.bindingHash, /^[a-f0-9]{64}$/);
});

test("strict body validators reject extras, crossed identities, and structural hash clones", () => {
  const { row, reservation, identity, bound, terminal } = reservationFixture();
  assert.throws(
    () => validateInternalProductionOwnerReservationV1({ ...reservation, extra: true }, row),
    /RESERVATION_KEYS_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerReservationV1({ ...reservation, ownerKeyHash: SHA_C }, row),
    /RESERVATION_DERIVATION_INVALID/,
  );
  assert.throws(
    () => createInternalProductionBoundOwnerReservationV1({
      reservation,
      canonicalOwnerIdentity: { ...identity, ownerKey: "crossed" },
    }),
    /OWNER_IDENTITY_MISMATCH/,
  );
  assert.throws(
    () => validateInternalProductionBoundOwnerReservationV1({ ...bound, bindingHash: SHA_C }),
    /BINDING_HASH_INVALID/,
  );
  const pair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
  assert.throws(
    () => validateInternalProductionTerminalOwnerAuthorityPairV1(
      { ...pair, terminalAuthorityHash: SHA_A }, terminal,
    ),
    /TERMINAL_OWNER_AUTHORITY_PAIR_INVALID/,
  );
});

test("constructs ordinary and fence-target closes with exact pair and hash rules", () => {
  const { bound, terminal } = reservationFixture();
  const ordinary = createInternalProductionOwnerReservationCloseV1({
    closeKind: "ordinary",
    boundReservation: bound,
    terminalAuthority: terminal,
    ownerAdmissionHeadPredecessorHash: SHA_A,
    ownerAdmissionHeadSuccessorHash: SHA_B,
    preservedFenceRef: null,
    preservedFenceHash: null,
  });
  assert.deepEqual(validateInternalProductionOwnerReservationCloseV1(ordinary), ordinary);
  assert.throws(
    () => validateInternalProductionOwnerReservationCloseV1({ ...ordinary, extra: true }),
    /CLOSE_KEYS_INVALID/,
  );
  assert.throws(
    () => createInternalProductionOwnerReservationCloseV1({
      closeKind: "ordinary",
      boundReservation: bound,
      terminalAuthority: terminal,
      ownerAdmissionHeadPredecessorHash: SHA_A,
      ownerAdmissionHeadSuccessorHash: SHA_B,
      preservedFenceRef: "setfarm://internal-production/fences/test",
      preservedFenceHash: SHA_C,
    }),
    /ORDINARY_CLOSE_PRESERVED_FENCE_FORBIDDEN/,
  );
  const fenced = createInternalProductionOwnerReservationCloseV1({
    closeKind: "fence-target",
    boundReservation: bound,
    terminalAuthority: terminal,
    ownerAdmissionHeadPredecessorHash: SHA_A,
    ownerAdmissionHeadSuccessorHash: SHA_B,
    preservedFenceRef: "setfarm://internal-production/fences/test",
    preservedFenceHash: SHA_C,
  });
  assert.deepEqual(validateInternalProductionOwnerReservationCloseV1(fenced), fenced);
});

test("exports and every successful construction or validation are detached and deeply immutable", () => {
  assertDeepFrozen(INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1, "category registry");
  assertDeepFrozen(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1, "census map");
  assertDeepFrozen(INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1, "A rows");
  assertDeepFrozen(INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1, "A manifest");

  const callerManifest = structuredClone(INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1);
  const validatedManifest = validateInternalProductionOwnerProducerManifestV1(callerManifest);
  assertDeepFrozen(validatedManifest, "validated manifest");
  // @ts-expect-error runtime detachment fixture deliberately mutates readonly caller input
  callerManifest.rows[0]!.module = "src/caller-mutated.ts";
  assert.equal(validatedManifest.rows[0]!.module, "src/execution/run-persistence.ts");

  const manifests = [
    INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
    syntheticManifest("B", 10), syntheticManifest("C", 6),
    syntheticManifest("D", 16), syntheticManifest("E", 9),
  ] as const;
  const assembled = assembleInternalProductionOwnerProducerRegistryV1({ manifests });
  assertDeepFrozen(assembled, "assembled registry");
  const originalB = manifests[1].rows[0] as { module: string };
  originalB.module = "src/caller-mutated-b.ts";
  assert.notEqual(assembled.rows[16]!.module, originalB.module);

  const { row, reservation, identity, bound, terminal } = reservationFixture();
  const callerReservation = structuredClone(reservation);
  const validatedReservation = validateInternalProductionOwnerReservationV1(callerReservation, row);
  const callerBound = structuredClone(bound);
  const validatedBound = validateInternalProductionBoundOwnerReservationV1(callerBound);
  const callerTerminal = structuredClone(terminal);
  const validatedTerminal = validateInternalProductionTerminalOwnerAuthorityV1(callerTerminal);
  const terminalPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
  const callerPair = structuredClone(terminalPair);
  const validatedPair = validateInternalProductionTerminalOwnerAuthorityPairV1(callerPair, terminal);
  const close = createInternalProductionOwnerReservationCloseV1({
    closeKind: "ordinary",
    boundReservation: bound,
    terminalAuthority: terminal,
    ownerAdmissionHeadPredecessorHash: SHA_A,
    ownerAdmissionHeadSuccessorHash: SHA_B,
    preservedFenceRef: null,
    preservedFenceHash: null,
  });
  const callerClose = structuredClone(close);
  const validatedClose = validateInternalProductionOwnerReservationCloseV1(callerClose);
  for (const [label, value] of [
    ["reservation", reservation], ["validated reservation", validatedReservation],
    ["binding", bound], ["validated binding", validatedBound],
    ["terminal", terminal], ["validated terminal", validatedTerminal],
    ["terminal pair", terminalPair], ["validated terminal pair", validatedPair],
    ["close", close], ["validated close", validatedClose],
  ] as const) assertDeepFrozen(value, label);
  assertDeepFrozen(validatedBound.canonicalOwnerIdentity, "validated nested owner identity");

  // @ts-expect-error runtime detachment fixture deliberately mutates readonly caller input
  callerReservation.ownerKey = "caller-mutated";
  // @ts-expect-error runtime detachment fixture deliberately mutates readonly caller input
  callerBound.canonicalOwnerIdentity.ownerKey = "caller-mutated";
  // @ts-expect-error runtime detachment fixture deliberately mutates readonly caller input
  callerTerminal.ownerKey = "caller-mutated";
  // @ts-expect-error runtime detachment fixture deliberately mutates readonly caller input
  callerPair.terminalAuthorityRef = "setfarm://caller-mutated";
  // @ts-expect-error runtime detachment fixture deliberately mutates readonly caller input
  callerClose.terminalOwnerRef = "setfarm://caller-mutated";
  assert.equal(validatedReservation.ownerKey, reservation.ownerKey);
  assert.equal(validatedBound.canonicalOwnerIdentity.ownerKey, identity.ownerKey);
  assert.equal(validatedTerminal.ownerKey, identity.ownerKey);
  assert.notEqual(validatedPair.terminalAuthorityRef, callerPair.terminalAuthorityRef);
  assert.notEqual(validatedClose.terminalOwnerRef, callerClose.terminalOwnerRef);

  assert.throws(() => {
    (validatedBound.canonicalOwnerIdentity as { ownerKey: string }).ownerKey = "forbidden";
  }, TypeError);
});

test("strict shapes reject symbols, non-enumerable fields, custom prototypes, and null prototypes", () => {
  const symbolManifest = structuredClone(INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1) as
    Record<PropertyKey, unknown>;
  symbolManifest[Symbol("hidden")] = true;
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestV1(symbolManifest),
    /MANIFEST_KEYS_INVALID/,
  );

  const { row, reservation, identity } = reservationFixture();
  const nonEnumerableReservation = structuredClone(reservation);
  Object.defineProperty(nonEnumerableReservation, "hidden", { value: true, enumerable: false });
  assert.throws(
    () => validateInternalProductionOwnerReservationV1(nonEnumerableReservation, row),
    /RESERVATION_KEYS_INVALID/,
  );

  class CustomTerminalAuthority {}
  const customPrototypeTerminal = Object.assign(
    new CustomTerminalAuthority(),
    createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: identity,
      terminalOwnerRef: "setfarm://runs/run-owner-admission-test-1/terminal/completed",
      terminalOwnerHash: SHA_C,
    }),
  );
  assert.throws(
    () => validateInternalProductionTerminalOwnerAuthorityV1(customPrototypeTerminal),
    /TERMINAL_OWNER_AUTHORITY_INVALID/,
  );

  const nullPrototypeIdentity = Object.assign(Object.create(null), identity);
  assert.throws(
    () => createInternalProductionBoundOwnerReservationV1({
      reservation,
      canonicalOwnerIdentity: nullPrototypeIdentity,
    }),
    /CANONICAL_OWNER_IDENTITY_INVALID/,
  );
});

test("the core is import-inert and contains only the approved dependency edges", async () => {
  const source = await readFile(new URL("../../src/internal-production/owner-admission-v1.ts", import.meta.url), "utf8");
  const imports = [...source.matchAll(/^import[^;]+from\s+["']([^"']+)["'];/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ["postgres", "../product-compiler/canonical-json.js"]);
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:db-pg|receipt|restart|spawner|execution)[^"']*["']/);
  assert.doesNotMatch(source, /createInternalProductionOwnerAdmission(?:Repository|Controller)/);
  assert.doesNotMatch(source, /postgres\s*\(/);
});

test("the A source-build body exposes the complete exact PBA evidence ABI", async () => {
  const source = await readFile(
    new URL("../../src/internal-production/owner-admission-v1.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /evidence:\s*Readonly<Record<string, unknown>>/,
  );
  assert.match(
    source,
    /type InternalProductionProductBuildAuthorityV2DeliveryEvidenceObservationV1 = import\(\s*["']\.\/product-build-authority-v2-delivery-evidence-v1\.js["']\s*\)\.ProductBuildAuthorityV2DeliveryEvidenceObservationV1;/,
  );
});
