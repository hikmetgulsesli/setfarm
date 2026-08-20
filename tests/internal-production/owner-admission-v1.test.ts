import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
    await fixtureDb.pgClose();
    await db.pgClose();
  } finally {
    rmSync(path.dirname(fixture.root), { recursive: true, force: true });
  }
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
