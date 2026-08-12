import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { hashNodeToolchainOperationalLocatorV2 } from "../../src/product-compiler/node-toolchain-target-registry-v2.js";
import {
  captureNodeToolchainProvisionerPhysicalCensusV3,
  defaultNodeToolchainProvisionerHostIdentityHashV3,
  makeNodeToolchainProvisionerPhysicalScopeV3,
  verifyNodeToolchainProvisionerPhysicalCensusV3,
  NodeToolchainProvisionerPhysicalCensusV3Error,
} from "../../src/product-compiler/node-toolchain-provisioner-physical-census-v3.js";
import {
  NodeToolchainProvisionerPhysicalCensusV3Schema,
  NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_ROLE_ORDER_V3,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-physical-census-v3.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(): Promise<Readonly<{
  root: string;
  paths: Record<"parent" | "root" | "receipt" | "claim" | "rollback_claim" | "lock" | "staging", string>;
}>> {
  const root = await mkdtemp(path.join(tmpdir(), "setfarm-physical-census-v3-"));
  roots.push(root);
  const parent = path.join(root, "parent");
  await mkdir(parent, { mode: 0o700 });
  await chmod(parent, 0o700);
  const paths = {
    parent,
    root: path.join(parent, "root"),
    receipt: path.join(parent, "receipt.json"),
    claim: path.join(parent, "claim.json"),
    rollback_claim: path.join(parent, "rollback.claim"),
    lock: path.join(parent, "lock"),
    staging: path.join(parent, "staging"),
  } as const;
  await mkdir(paths.root, { mode: 0o700 });
  await writeFile(paths.receipt, "{}\n", { mode: 0o600 });
  await symlink(paths.receipt, paths.lock);
  return { root, paths };
}

describe("Node toolchain provisioner physical census V3", () => {
  it("derives one stable machine identity independently of admission scope and target architecture", () => {
    assert.equal(Object.isFrozen(NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_ROLE_ORDER_V3), true);
    const productionArm = defaultNodeToolchainProvisionerHostIdentityHashV3({
      admissionScope: "production_root",
      architecture: "arm64",
    });
    const testX64 = defaultNodeToolchainProvisionerHostIdentityHashV3({
      admissionScope: "test_fixture",
      architecture: "x64",
    });
    assert.match(productionArm, /^[a-f0-9]{64}$/);
    assert.equal(testX64, productionArm);
  });

  it("captures canonical decimal stable identity and a separate mutable fingerprint for every role", async () => {
    const input = await fixture();
    const scope = makeNodeToolchainProvisionerPhysicalScopeV3({
      admissionScope: "test_fixture",
      architecture: "arm64",
      targetRef: "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2",
      parentLocatorHash: hashNodeToolchainOperationalLocatorV2("parent", input.paths.parent),
      hostIdentityHash: "a".repeat(64),
    });
    const census = captureNodeToolchainProvisionerPhysicalCensusV3({
      scope,
      paths: input.paths,
    });
    assert.deepEqual(
      census.observations.map((observation) => observation.role),
      NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_ROLE_ORDER_V3,
    );
    assert.equal(census.observations[0]?.state, "present");
    assert.equal(census.observations[1]?.state, "present");
    assert.equal(census.observations[2]?.state, "present");
    assert.equal(census.observations[3]?.state, "absent");
    assert.equal(census.observations[4]?.state, "absent");
    assert.equal(census.observations[5]?.state, "present");
    assert.equal(census.observations[6]?.state, "absent");
    const parent = census.observations[0]!;
    const receipt = census.observations[2]!;
    const lock = census.observations[5]!;
    assert.equal(parent.state, "present");
    assert.equal(receipt.state, "present");
    assert.equal(lock.state, "present");
    if (parent.state === "present" && receipt.state === "present" && lock.state === "present") {
      assert.equal(parent.objectIdentity.objectKind, "directory");
      assert.equal(receipt.objectIdentity.objectKind, "ordinary_file");
      assert.equal(lock.objectIdentity.objectKind, "symbolic_link");
      assert.match(parent.objectIdentity.device, /^[0-9]+$/);
      assert.match(parent.objectIdentity.inode, /^[0-9]+$/);
      assert.equal(parent.objectIdentity.hostIdentityHash, "a".repeat(64));
      assert.equal(parent.fingerprint.objectIdentityHash, parent.objectIdentity.objectIdentityHash);
      assert.notEqual(parent.objectIdentity.objectIdentityHash, parent.fingerprint.fingerprintHash);
    }
    assert.equal(NodeToolchainProvisionerPhysicalCensusV3Schema.safeParse(census).success, true);
  });

  it("fails closed when a mutable fingerprint changes after a transport census", async () => {
    const input = await fixture();
    const scope = makeNodeToolchainProvisionerPhysicalScopeV3({
      admissionScope: "test_fixture",
      architecture: "arm64",
      targetRef: "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2",
      parentLocatorHash: hashNodeToolchainOperationalLocatorV2("parent", input.paths.parent),
      hostIdentityHash: "b".repeat(64),
    });
    const census = captureNodeToolchainProvisionerPhysicalCensusV3({
      scope,
      paths: input.paths,
    });
    await chmod(input.paths.root, 0o755);
    assert.throws(
      () => verifyNodeToolchainProvisionerPhysicalCensusV3(census, { scope, paths: input.paths }),
      (error: unknown) =>
        error instanceof NodeToolchainProvisionerPhysicalCensusV3Error
        && error.code === "NODE_TOOLCHAIN_PROVISIONER_PHYSICAL_CENSUS_V3_MISMATCH",
    );
  });

  it("allows only the code-owned absent-to-present lock/staging preparation transition", async () => {
    const input = await fixture();
    await unlink(input.paths.lock);
    const scope = makeNodeToolchainProvisionerPhysicalScopeV3({
      admissionScope: "test_fixture",
      architecture: "arm64",
      targetRef: "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2",
      parentLocatorHash: hashNodeToolchainOperationalLocatorV2("parent", input.paths.parent),
      hostIdentityHash: "d".repeat(64),
    });
    const before = captureNodeToolchainProvisionerPhysicalCensusV3({ scope, paths: input.paths });
    await symlink(input.paths.receipt, input.paths.lock);
    await mkdir(input.paths.staging, { mode: 0o700 });
    await chmod(input.paths.staging, 0o700);
    const prepared = verifyNodeToolchainProvisionerPhysicalCensusV3(
      before,
      { scope, paths: input.paths },
      { allowPreparationTransition: true },
    );
    assert.notEqual(prepared.censusHash, before.censusHash);
    assert.throws(
      () => verifyNodeToolchainProvisionerPhysicalCensusV3(before, { scope, paths: input.paths }),
      NodeToolchainProvisionerPhysicalCensusV3Error,
    );
  });

  it("allows production-parent creation only as part of the same preparation transition", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-physical-census-v3-parent-"));
    roots.push(root);
    const parent = path.join(root, "parent");
    const paths = {
      parent,
      root: path.join(parent, "root"),
      receipt: path.join(parent, "receipt.json"),
      claim: path.join(parent, "claim.json"),
      rollback_claim: path.join(parent, "rollback.claim"),
      lock: path.join(parent, "lock"),
      staging: path.join(parent, "staging"),
    } as const;
    const scope = makeNodeToolchainProvisionerPhysicalScopeV3({
      admissionScope: "production_root",
      architecture: "arm64",
      targetRef: "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2",
      parentLocatorHash: hashNodeToolchainOperationalLocatorV2("parent", parent),
    });
    const before = captureNodeToolchainProvisionerPhysicalCensusV3({ scope, paths });
    await mkdir(parent, { mode: 0o755 });
    await mkdir(paths.staging, { mode: 0o700 });
    await symlink("missing-lock-target", paths.lock);
    const prepared = verifyNodeToolchainProvisionerPhysicalCensusV3(
      before,
      { scope, paths },
      { allowPreparationTransition: true },
    );
    assert.notEqual(prepared.censusHash, before.censusHash);
  });

  it("does not trust a path alias as a stable object identity", async () => {
    const input = await fixture();
    const stat = lstatSync(input.paths.lock, { bigint: true });
    assert.equal(stat.isSymbolicLink(), true);
    const scope = makeNodeToolchainProvisionerPhysicalScopeV3({
      admissionScope: "test_fixture",
      architecture: "arm64",
      targetRef: "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2",
      parentLocatorHash: hashNodeToolchainOperationalLocatorV2("parent", input.paths.parent),
      hostIdentityHash: "c".repeat(64),
    });
    const census = captureNodeToolchainProvisionerPhysicalCensusV3({ scope, paths: input.paths });
    const lock = census.observations.find((observation) => observation.role === "lock")!;
    assert.equal(lock.state, "present");
    if (lock.state === "present") assert.equal(lock.objectIdentity.objectKind, "symbolic_link");
  });
});
