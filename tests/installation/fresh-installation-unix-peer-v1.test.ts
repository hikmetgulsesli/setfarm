import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";

// Run the actual provisioning controller, replacing every external effect with
// an inert boundary. No PostgreSQL, filesystem creation or role operation runs.
async function controller(kind:"create"|"activation"="create") {
  const file=new URL(kind==="create"?"../../src/installation/fresh-installation-v1.ts":"../../src/installation/fresh-installation-activation-v1.ts",import.meta.url);
  // Locator seam only for the compiled-only activation controller; no actual
  // source/installation admission or production capability is minted here.
  const source=readFileSync(file,"utf8").replaceAll("fileURLToPath(import.meta.url)",JSON.stringify("/fixture/dist/installation/controller.js"));
  const tree=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.ESNext,true),dependencies:Record<string,unknown>={};
  let captured:unknown;const captures:unknown[]=[];
  const sql=Object.assign(async()=>{throw Error("FIXTURE_END_AFTER_TRANSPORT");},{end:async()=>{},begin:async()=>{throw Error("FIXTURE_END_AFTER_TRANSPORT");}});
  const overrides:Record<string,unknown>={
    "postgres":{default:(options:unknown)=>{captured=options;captures.push(options);return sql;}},
    "node:fs":{statfsSync:()=>({bavail:100n*1024n**3n,bsize:1n}),lstatSync:()=>({isDirectory:()=>true,isSymbolicLink:()=>false,uid:process.getuid?.(),mode:0o700}),mkdirSync(){}},
    "./fresh-installation-source-v1.js":{captureFreshInstallationSourceShaV1:async()=>"a".repeat(40)},
    "./fresh-installation-private-assets-v1.js":{initializeFreshInstallationPrivateAssetsV1(){}},
    "./fresh-installation-records-v1.js":{publishFreshInstallationPrivateRecordV1:()=>({}),
      readFreshInstallationPreparedStateV1:()=>({origin:{databaseName:"fixture_install"},runtimeUrl:"postgresql://fixture",catalogHash:"fixture",ownerOid:2,runtimeOid:3,assertUnchanged(){}}),
      captureFreshInstallationActivationAbsenceV1:()=>()=>{}},
    "./fresh-installation-owner-source-v1.js":{deriveFreshInstallationOwnerProducerSourceBuildAuthorityAV1:async()=>({})},
    "./fresh-installation-runtime-v1.js":{verifyFreshInstallationRuntimeConnectionV1:async()=>{}},
  };
  for(const node of tree.statements){if(!ts.isImportDeclaration(node)||!ts.isStringLiteral(node.moduleSpecifier))continue;
    const name=node.moduleSpecifier.text;dependencies[name]=name in overrides?overrides[name]:await import(name.startsWith(".")?new URL(name.replace(/\.js$/,".ts"),file).href:name);
  }
  // Re-exported schema functions are loaded too, without invoking them.
  dependencies["./fresh-installation-runtime-v1.js"]??=await import("../../src/installation/fresh-installation-runtime-v1.js");
  const module={exports:{} as any},output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("require","exports","module",output)((name:string)=>{if(!(name in dependencies))throw Error("UNEXPECTED_IMPORT:"+name);return dependencies[name];},module.exports,module);
  return {create:module.exports.createFreshInstallationV1,activate:module.exports.activateFreshInstallationManifestAV1,get captured(){return captured;},captures};
}

test("explicit peer bootstrap uses the fixed local socket without ambient admin credentials",async()=>{
  const c=await controller();
  await assert.rejects(c.create({adminTransport:"local-unix-peer",baseDirectory:"/fixture",sourceSha:"a".repeat(40)}),/FRESH_INSTALLATION_CREATE_FAILED/);
  const {onnotice,...options}=c.captured as Record<string,unknown>;
  assert.equal(typeof onnotice,"function");
  assert.deepEqual(options,{host:"/tmp",port:5432,database:"postgres",username:"setrox",password:"",ssl:false,
    max:1,connect_timeout:5,idle_timeout:2});
});

test("peer bootstrap refuses caller connection options before any connection",async()=>{
  const c=await controller();
  await assert.rejects(c.create({adminTransport:"local-unix-peer",host:"attacker",baseDirectory:"/fixture",sourceSha:"a".repeat(40)}),/FRESH_INSTALLATION_OPTIONS_INVALID/);
  assert.equal(c.captured,undefined);
});


test("activation uses the same closed peer branch after restricted runtime verification",async()=>{
  const c=await controller("activation");
  await assert.rejects(c.activate({directory:"/fixture",adminTransport:"local-unix-peer"}),/FRESH_INSTALLATION_ACTIVATION_UNAVAILABLE/);
  assert.equal(c.captures.length,2);assert.equal(c.captures[0],"postgresql://fixture");
  const {onnotice,...options}=c.captured as Record<string,unknown>;assert.equal(typeof onnotice,"function");
  assert.deepEqual(options,{host:"/tmp",port:5432,database:"fixture_install",username:"setrox",password:"",ssl:false,
    max:1,connect_timeout:5,idle_timeout:2});
});
