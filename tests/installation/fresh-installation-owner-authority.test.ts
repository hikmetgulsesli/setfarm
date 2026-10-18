import assert from "node:assert/strict";
import { test } from "node:test";
import { validateInternalProductionOwnerProducerSourceBuildAuthorityV1 } from "../../src/internal-production/owner-admission-v1.js";
import { freshOwnerAuthorityDataV1 as authority, rehashFreshOwnerAuthorityDataV1 as derive } from "./fresh-installation-owner-authority-data.js";

test("fresh owner source authority accepts a distinct origin-bound data contract", () => {
  const value=authority(), parsed=validateInternalProductionOwnerProducerSourceBuildAuthorityV1(value);
  assert.deepEqual(parsed,value);assert.notEqual(parsed,value);
  assert.equal(Object.isFrozen(parsed),true);assert.equal(Object.isFrozen(parsed.setfarmSource),true);
  assert.equal(Object.hasOwn(parsed,"currentEntryOperationRef"),false);
});

test("fresh owner source authority rejects rehashed foreign source and policy data", () => {
  for (const mutate of [
    (v: ReturnType<typeof authority>)=>{v.origin.databaseName="setfarm";},
    (v: ReturnType<typeof authority>)=>{v.setfarmSource.sha="c".repeat(40);v.setfarmSource.originMainSha=v.setfarmSource.sha;},
    (v: ReturnType<typeof authority>)=>{v.setfarmSource.branch="feature";},
    (v: ReturnType<typeof authority>)=>{v.setfarmSource.clean=false;},
    (v: ReturnType<typeof authority>)=>{v.manifestHash="c".repeat(64);},
    (v: ReturnType<typeof authority>)=>{v.ownerCategoryRegistryHash="c".repeat(64);},
    (v: ReturnType<typeof authority>)=>{v.ownerCategoryCensusMapHash="c".repeat(64);},
  ]) {
    const input=authority();mutate(input);
    const {sourceBuildAuthorityRef,sourceBuildAuthorityHash,...body}=input;
    assert.throws(()=>validateInternalProductionOwnerProducerSourceBuildAuthorityV1(derive(body)));
  }
});

test("fresh owner source authority rejects missing keys, hash changes and legacy-field mixing", () => {
  const input=authority();
  assert.throws(()=>validateInternalProductionOwnerProducerSourceBuildAuthorityV1({...input,sourceBuildAuthorityHash:"c".repeat(64)}));
  const {origin,...missing}=input;assert.throws(()=>validateInternalProductionOwnerProducerSourceBuildAuthorityV1(missing));
  assert.throws(()=>validateInternalProductionOwnerProducerSourceBuildAuthorityV1({...input,currentEntryOperationRef:"setfarm://foreign/legacy"}));
  assert.throws(()=>validateInternalProductionOwnerProducerSourceBuildAuthorityV1({...input,schema:"setfarm.internal-production-owner-producer-source-build-authority-a.v1"}));
});

test("fresh owner source authority refuses accessors and proxies without invoking them", () => {
  let invoked=false;const input=authority();
  Object.defineProperty(input,"schema",{enumerable:true,get(){invoked=true;return "setfarm.fresh-installation-owner-producer-source-build-authority-a.v1";}});
  assert.throws(()=>validateInternalProductionOwnerProducerSourceBuildAuthorityV1(input));assert.equal(invoked,false);
  assert.throws(()=>validateInternalProductionOwnerProducerSourceBuildAuthorityV1(new Proxy(authority(),{ownKeys(){invoked=true;throw new Error("not data");}})));
  assert.equal(invoked,false);
});

test("fresh owner source authority rejects nested hostile values and detaches accepted data", () => {
  let invoked=false;
  for (const field of ["origin","setfarmSource"] as const) {
    const input=authority();
    Object.defineProperty(input,field,{enumerable:true,value:new Proxy(input[field],{getPrototypeOf(){invoked=true;throw new Error("not data");}})});
    assert.throws(()=>validateInternalProductionOwnerProducerSourceBuildAuthorityV1(input));assert.equal(invoked,false);
  }
  const accessor=authority();
  Object.defineProperty(accessor.setfarmSource,"buildHash",{enumerable:true,get(){invoked=true;return "b".repeat(64);}});
  assert.throws(()=>validateInternalProductionOwnerProducerSourceBuildAuthorityV1(accessor));assert.equal(invoked,false);
  const input=authority(),parsed=validateInternalProductionOwnerProducerSourceBuildAuthorityV1(input);
  input.origin.databaseOid+=1;input.setfarmSource.buildHash="c".repeat(64);
  assert.notDeepEqual(parsed,input);assert.equal(parsed.setfarmSource.buildHash,"b".repeat(64));
});
