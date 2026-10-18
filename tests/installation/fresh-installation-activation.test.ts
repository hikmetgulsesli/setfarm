import assert from "node:assert/strict";
import { test } from "node:test";

test("fresh activation refuses source execution before records, SQL or getters",async()=>{
  const api=await import("../../src/installation/fresh-installation-activation-v1.js");
  let gets=0;
  const input=Object.defineProperty({},"adminUrl",{enumerable:true,get(){gets++;throw Error("must not read");}});
  await assert.rejects(api.activateFreshInstallationManifestAV1(input as never),/FRESH_INSTALLATION_ACTIVATION_UNAVAILABLE/);
  assert.equal(gets,0);
});

test("fresh activation transaction capability cannot be created from caller SQL or data",async()=>{
  const api=await import("../../src/installation/fresh-installation-activation-v1.js");
  let calls=0; const sql=()=>{calls++;throw Error("must not call");};
  assert.equal(api.peekFreshInstallationActivationTransactionV1(sql),null);
  assert.throws(()=>api.requireFreshInstallationActivationTransactionV1(sql),/FRESH_INSTALLATION_ACTIVATION_TRANSACTION_NOT_OWNED/);
  assert.equal(calls,0);
  assert.deepEqual(Object.keys(api).sort(),["activateFreshInstallationManifestAV1","peekFreshInstallationActivationTransactionV1","reconcileFreshInstallationActivationV1","requireFreshInstallationActivationTransactionV1","verifyFreshInstallationActivationV1"].sort());
});
