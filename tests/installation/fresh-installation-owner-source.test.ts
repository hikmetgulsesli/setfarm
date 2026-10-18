import assert from "node:assert/strict";
import { test } from "node:test";
import { freshOwnerAuthorityDataV1 } from "./fresh-installation-owner-authority-data.js";

test("fresh owner source refuses unqualified source execution before SQL access", async () => {
  const api = await import("../../src/installation/fresh-installation-owner-source-v1.js");
  assert.equal(typeof api.deriveFreshInstallationOwnerProducerSourceBuildAuthorityAV1, "function");
  assert.equal(typeof api.verifyFreshInstallationOwnerProducerSourceBuildAuthorityAV1, "function");
  const authority = freshOwnerAuthorityDataV1();
  await assert.rejects(api.deriveFreshInstallationOwnerProducerSourceBuildAuthorityAV1(authority.origin),
    /FRESH_INSTALLATION_OWNER_SOURCE_AUTHORITY_UNAVAILABLE/);
  let queries=0;
  const sql={unsafe(){queries+=1;throw new Error("unqualified source must not query SQL");}};
  await assert.rejects(api.verifyFreshInstallationOwnerProducerSourceBuildAuthorityAV1(sql,authority.origin,authority),
    /FRESH_INSTALLATION_OWNER_SOURCE_AUTHORITY_UNAVAILABLE/);
  assert.equal(queries,0);
});

test("fresh activated verifier refuses every source mode before any SQL or state access",async()=>{
  const api=await import("../../src/installation/fresh-installation-activation-verifier-v1.js");
  let calls=0;
  const sql={unsafe(){calls++;throw Error("must not query");}};
  const state=new Proxy({},{get(){calls++;throw Error("must not inspect");}});
  for(const mode of ["runtime","owner","reconcile-runtime"] as const) {
    await assert.rejects(api.verifyFreshInstallationActivatedDatabaseOnTransactionV1(sql,state as never,state as never,mode),/FRESH_INSTALLATION_ACTIVATED_DATABASE_UNVERIFIED/);
  }
  assert.equal(calls,0);
});
