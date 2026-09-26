import assert from "node:assert/strict";
import { test } from "node:test";

const meta = () => ({ serverVersionText: "170010", databaseName: "setfarm",
  sessionRole: "setrox", effectiveRole: "setrox" });
const objects = () => [
  { kind: "database", oidText: "1", namespaceText: "", nameText: "setfarm",
    ownerText: "setrox", aclText: null, attributeText: "", publicAcl: false },
  { kind: "relation", oidText: "11", namespaceText: "public", nameText: "runs",
    ownerText: "setrox", aclText: "{setrox=arwdDxt/setrox,=r/setrox}", attributeText: "r", publicAcl: true },
];
const defaults = () => [{ oidText: "12", namespaceText: "public", roleText: "setrox",
  objectTypeText: "r", aclText: "{setrox=arwdDxt/setrox,=r/setrox}", publicAcl: true }];
const memberships = () => [{ roleText: "pg_read_all_data", memberText: "setrox",
  grantorText: "setrox", inherit: true, set: false, admin: false }];

async function project(rows = [ [meta()], objects(), defaults(), memberships() ] as unknown[]) {
  const module = await import("../../src/internal-production/baseline-task6a-private-catalog-inventory-v3.js");
  const statements: string[] = [];
  let index = 0;
  const result = await module.projectTask6aPrivateCatalogInventoryInTransactionV3(async statement => {
    statements.push(statement);
    return rows[index++];
  });
  return { module, result, statements };
}

test("selected exact rows form a private, frozen diagnostic hash without publishing names or ACLs", async () => {
  const { result, statements } = await project();
  assert.equal(statements.length, 4);
  assert.match(statements[0]!, /server_version_num/);
  assert.match(statements[1]!, /pg_class/);
  assert.match(statements[1]!, /pg_namespace/);
  assert.match(statements[1]!, /pg_proc/);
  assert.match(statements[1]!, /pg_type/);
  assert.match(statements[1]!, /LEFT JOIN pg_roles/);
  assert.match(statements[1]!, /n\.oid IS NULL/);
  assert.match(statements[2]!, /LEFT JOIN pg_roles/);
  assert.match(statements[3]!, /LEFT JOIN pg_roles/);
  assert.match(statements[1]!, /left\(d\.datacl::text, 4097\)/);
  assert.match(statements[2]!, /left\(a\.defaclacl::text, 4097\)/);
  for (const statement of statements.slice(1)) assert.match(statement, /LIMIT 1025/);
  assert.match(statements[2]!, /pg_default_acl/);
  assert.match(statements[3]!, /pg_auth_members/);
  for (const statement of statements.slice(1)) assert.match(statement, /COLLATE "C"/);
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.cutoverAdmission, "not-granted");
  assert.equal(result.physicalIdentityProvenance, "unverified");
  assert.equal(result.catalogScope, "selected-explicit-acl-and-direct-membership-rows-not-permission-proof");
  assert.deepEqual(result.counts, { object: 2, explicitAclObject: 1, defaultAcl: 1,
    directMembership: 1, publicAclObject: 1, publicDefaultAcl: 1 });
  assert.match(result.detailHash, /^[a-f0-9]{64}$/);
  assert.match(result.diagnosticHash, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.counts));
  const publicText = JSON.stringify(result);
  for (const privateText of ["runs", "pg_read_all_data", "arwdDxt", "setrox"]) {
    assert.equal(publicText.includes(privateText), false);
  }
});

test("a changed ACL or membership option changes the exact private detail hash", async () => {
  const first = (await project()).result;
  const changedAcl = objects();
  changedAcl[1]!.aclText = "{setrox=arwdDxt/setrox}";
  changedAcl[1]!.publicAcl = false;
  const second = (await project([[meta()], changedAcl, defaults(), memberships()])).result;
  assert.notEqual(first.detailHash, second.detailHash);
  const changedMembership = memberships();
  changedMembership[0]!.admin = true;
  const third = (await project([[meta()], objects(), defaults(), changedMembership])).result;
  assert.notEqual(first.detailHash, third.detailHash);
});

test("membership order follows PostgreSQL C collation bytes rather than JavaScript UTF-16", async () => {
  const rows = [{ ...memberships()[0], roleText: "\uE000" },
    { ...memberships()[0], roleText: "\u{10000}" }];
  const { result } = await project([[meta()], objects(), defaults(), rows]);
  assert.equal(result.counts.directMembership, 2);
});

test("missing, duplicate, reordered and malformed selected rows refuse closed", async () => {
  const rejects = async (rows: unknown[]) => assert.rejects(() => project(rows),
    /INTERNAL_PRODUCTION_TASK6A_PRIVATE_CATALOG_INVENTORY_INVALID/);
  await rejects([[], objects(), defaults(), memberships()]);
  await rejects([[meta()], [...objects()].reverse(), defaults(), memberships()]);
  await rejects([[meta()], [objects()[0], objects()[0]], defaults(), memberships()]);
  await rejects([[meta()], objects(), [...defaults(), defaults()[0]], memberships()]);
  await rejects([[meta()], objects(), defaults(), [...memberships(), memberships()[0]]]);
  await rejects([[meta()], [{ ...objects()[0], aclText: "x".repeat(4097) }], [], []]);
  await rejects([[{ ...meta(), effectiveRole: "other" }], [], [], []]);
  await rejects([[meta()], [], [], [{ ...memberships()[0], inherit: "true" }]]);
  await rejects([[meta()], [{ ...objects()[0], ownerText: null }], [], []]);
});

test("proxies, accessors, oversized input and query errors are sanitized", async () => {
  const reject = async (rows: unknown[]) => assert.rejects(() => project(rows),
    /INTERNAL_PRODUCTION_TASK6A_PRIVATE_CATALOG_INVENTORY_INVALID/);
  await reject([[meta()], [new Proxy(objects()[0]!, { get() { throw Error("secret"); } })], [], []]);
  const getter = { ...objects()[0] };
  Object.defineProperty(getter, "nameText", { enumerable: true, get() { throw Error("secret"); } });
  await reject([[meta()], [getter], [], []]);
  await reject([[meta()], new Array(1025).fill(objects()[0]), [], []]);
  const module = await import("../../src/internal-production/baseline-task6a-private-catalog-inventory-v3.js");
  await assert.rejects(() => module.projectTask6aPrivateCatalogInventoryInTransactionV3(async () => {
    throw Error("private database URL");
  }), error => error instanceof Error && error.message === "INTERNAL_PRODUCTION_TASK6A_PRIVATE_CATALOG_INVENTORY_INVALID");
  await assert.rejects(() => module.observeTask6aPrivateCatalogInventoryV3(undefined),
    /INTERNAL_PRODUCTION_TASK6A_PRIVATE_CATALOG_INVENTORY_INVALID/);
  await assert.rejects(() => module.projectTask6aPrivateCatalogInventoryInTransactionV3(
    async () => [meta()], "other"), /INTERNAL_PRODUCTION_TASK6A_PRIVATE_CATALOG_INVENTORY_INVALID/);
});
