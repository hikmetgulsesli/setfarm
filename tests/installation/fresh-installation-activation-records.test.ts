import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as records from "../../src/installation/fresh-installation-records-v1.js";
import { freshOwnerAuthorityDataV1 } from "./fresh-installation-owner-authority-data.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

// Filesystem DATA fixtures only; no DB/release/activation authority.
function fixture(t: {after(fn:()=>void):void}) {
  const root=mkdtempSync(path.join(tmpdir(),"sf-activation-record-data-"));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const sourceAuthority=freshOwnerAuthorityDataV1(), origin=sourceAuthority.origin;
  const directory=path.join(root,origin.installationId); mkdirSync(directory,{mode:0o700});
  const put=records.publishFreshInstallationPrivateRecordV1;
  const pins:Record<string,unknown>={};
  pins["planned.json"]=put(directory,"planned.json",{schema:"setfarm.fresh-installation-plan.v1",...Object.fromEntries(["installationId","operationId","databaseName","ownerRole","runtimeRole","sourceSha"].map(k=>[k,origin[k as keyof typeof origin]]))});
  pins["owner-created.json"]=put(directory,"owner-created.json",{ownerRole:origin.ownerRole,ownerOid:17001});
  pins["runtime-created.json"]=put(directory,"runtime-created.json",{runtimeRole:origin.runtimeRole,runtimeOid:17002});
  pins["database-created.json"]=put(directory,"database-created.json",{origin,ownerOid:17001,runtimeOid:17002});
  pins["runtime-credentials.json"]=put(directory,"runtime-credentials.json",{runtimeUrl:`postgres://${origin.runtimeRole}:${"a".repeat(64)}@127.0.0.1:5432/${origin.databaseName}`});
  put(directory,"schema-prepared.json",{schema:"setfarm.fresh-installation-schema-prepared.v1",origin,catalogHash:"c".repeat(64),directoryIdentity:records.freshInstallationDirectoryIdentityV1(directory),recordPins:pins});
  records.acknowledgeFreshInstallationCommitV1(directory,origin,"c".repeat(64));
  const pair={plan:"A",sourceBuildAuthorityRef:sourceAuthority.sourceBuildAuthorityRef,sourceBuildAuthorityHash:sourceAuthority.sourceBuildAuthorityHash};
  const set={schema:"setfarm.internal-production-owner-producer-manifest-set.v1",phase:"A",orderedPlans:["A"],orderedManifestHashes:[sourceAuthority.manifestHash],orderedSourceBuildAuthorities:[pair],ownerCategoryRegistryHash:sourceAuthority.ownerCategoryRegistryHash,ownerCategoryCensusMapHash:sourceAuthority.ownerCategoryCensusMapHash};
  const body={...set,schema:"setfarm.internal-production-owner-producer-manifest-set-activation.v1",manifestSetHash:hashCanonicalJson(set),predecessorActivationRef:null,predecessorActivationHash:null,predecessorHeadRef:null,predecessorHeadHash:null};
  const activationHash=hashCanonicalJson(body), receipt={...body,activationRef:`setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${activationHash}`,activationHash};
  const headBody={schema:"setfarm.internal-production-owner-producer-manifest-set-activation-head.v1",phase:"A",activationRef:receipt.activationRef,activationHash,predecessorHeadRef:null,predecessorHeadHash:null};
  const headHash=hashCanonicalJson(headBody),head={...headBody,headRef:`setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/${headHash}`,headHash};
  const input={sourceAuthority,current:{currentRevision:1,receipt,head},catalogHash:"d".repeat(64)};
  return {directory,input,origin};
}

test("activation records separate prepared from acknowledged and retain schema pins",t=>{
  const {directory,input,origin}=fixture(t);
  assert.equal(records.readFreshInstallationActivationStateV1(directory,"optional"),null);
  const pin=records.publishFreshInstallationActivationPreparedV1(directory,input);
  assert.throws(()=>records.readFreshInstallationActivationStateV1(directory),/RECORDS_REFUSED/);
  assert.throws(()=>records.readFreshInstallationActivationStateV1(directory,"optional"),/RECORDS_REFUSED/);
  const prepared=records.readFreshInstallationActivationStateV1(directory,"reconcile")!;
  assert.equal(prepared.acknowledged,false); assert.deepEqual(prepared.preparedPin,pin);
  const schemaBytes=readFileSync(path.join(directory,"schema-prepared.json"));
  const expected={activationPreparedPin:pin,origin,catalogHash:input.catalogHash};
  records.acknowledgeFreshInstallationActivationV1(directory,expected);
  records.acknowledgeFreshInstallationActivationV1(directory,expected);
  const activated=records.readFreshInstallationActivationStateV1(directory)!;
  assert.equal(activated.acknowledged,true); activated.assertUnchanged();
  assert.deepEqual(readFileSync(path.join(directory,"schema-prepared.json")),schemaBytes);
  assert.throws(()=>prepared.assertUnchanged(),/RECORDS_REFUSED/);
});

test("schema-only captured absence never promotes after activation evidence appears",t=>{
  const {directory,input}=fixture(t);
  const unchanged=records.captureFreshInstallationActivationAbsenceV1(directory); unchanged();
  records.publishFreshInstallationActivationPreparedV1(directory,input);
  assert.throws(unchanged,/RECORDS_REFUSED/);
  unlinkSync(path.join(directory,"activation-prepared.json"));
  assert.throws(unchanged,/RECORDS_REFUSED/);
});

test("activation acknowledgment rejects wrong verified pin and partial or changed records",t=>{
  const {directory,input,origin}=fixture(t);
  const pin=records.publishFreshInstallationActivationPreparedV1(directory,input);
  assert.throws(()=>records.acknowledgeFreshInstallationActivationV1(directory,{activationPreparedPin:{...pin,sha256:"e".repeat(64)},origin,catalogHash:input.catalogHash}),/RECORDS_REFUSED/);
  const state=records.readFreshInstallationActivationStateV1(directory,"reconcile")!;
  const schema=path.join(directory,"schema-committed.json"),bytes=readFileSync(schema);
  writeFileSync(schema,Buffer.concat([bytes,Buffer.from(" ")]));
  assert.throws(state.assertUnchanged,/RECORDS_REFUSED/);
  assert.throws(()=>records.readFreshInstallationActivationStateV1(directory,"reconcile"),/RECORDS_REFUSED/);
});

test("activation record publication rejects hostile data before getter or proxy traps",t=>{
  const {directory,input}=fixture(t); let calls=0;
  const bad={...input}; Object.defineProperty(bad,"current",{enumerable:true,get(){calls++;return input.current;}});
  assert.throws(()=>records.publishFreshInstallationActivationPreparedV1(directory,bad),/RECORDS_REFUSED/);
  assert.throws(()=>records.publishFreshInstallationActivationPreparedV1(directory,new Proxy(input,{ownKeys(){calls++;throw Error();}})),/RECORDS_REFUSED/);
  assert.equal(calls,0);
});
