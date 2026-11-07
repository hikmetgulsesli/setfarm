import assert from "node:assert/strict";
import { it } from "node:test";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";
let api: Record<string,any>|undefined;
try {api=await import("../../src/execution/subscription-workflow-transport-v1.js");}
catch(error){const e=error as {code?:string;url?:string};if(e.code!=="ERR_MODULE_NOT_FOUND"||![".js",".ts"].some(ext=>e.url===
  new URL("../../src/execution/subscription-workflow-transport-v1"+ext,import.meta.url).href))throw error;}
function project(input: unknown){assert.equal(typeof api?.projectSubscriptionSuperviseWritePathsV1,"function","bounded supervisor scope DATA projector required");
  return api!.projectSubscriptionSuperviseWritePathsV1(input);}
function fixture(){
  const slice=ImplementationSliceV1Schema.parse(buildMinimalValidContracts().implementationSlice);
  const files=[...slice.files,{...slice.files[0]!,pathRef:"PATH_READONLY",path:"src/readonly.ts",role:"shared_readonly" as const},
    {...slice.files[0]!,pathRef:"PATH_SHARED",path:"src/shared.ts",role:"shared_writable" as const}];
  const extended=ImplementationSliceV1Schema.parse({...slice,files});
  return {worktree:"/project/supervisor-worktree",subject:{kind:"story_member",storyDbId:"story-db-1",storyId:slice.storyId,storyIndex:1,storyClaimGeneration:4},
    contexts:[{storyDbId:"story-db-1",storyClaimGeneration:4,slice:extended,sliceHash:"a".repeat(64)}]};
}
it("supervisor DATA scope is exact owned/shared-writable files, never read-only or whole-worktree grants",()=>{
  assert.deepEqual(project(fixture()),["/project/supervisor-worktree/src/App.tsx","/project/supervisor-worktree/src/shared.ts"]);
});
it("final-product DATA scope is a sorted explicit union rather than a directory grant",()=>{
  const f=fixture(),second=structuredClone(f.contexts[0]!);
  second.storyDbId="story-db-2";second.slice.storyId="US-002";second.slice.story.id="US-002";
  second.slice.files[0]!.path="src/Second.tsx";
  assert.deepEqual(project({...f,subject:{kind:"final_product"},contexts:[f.contexts[0],second]}),
    ["/project/supervisor-worktree/src/App.tsx","/project/supervisor-worktree/src/Second.tsx","/project/supervisor-worktree/src/shared.ts"]);
});
it("missing ambiguous crossed generation or escaping scope DATA refuses",()=>{
  const f=fixture();
  for(const value of [{...f,contexts:[]},{...f,contexts:[f.contexts[0],f.contexts[0]]},
    {...f,subject:{...f.subject,storyClaimGeneration:5}},
    {...f,contexts:[{...f.contexts[0],slice:{...f.contexts[0]!.slice,files:[{...f.contexts[0]!.slice.files[0],path:"../escape.ts"}]}}]}]){
    assert.throws(()=>project(value),/REFUSED|MISMATCH|INVALID|normalized|relative/);
  }
});

// Exercise the complete authenticated reader body, with only SQL/other owned
// readers replaced by inert boundaries. The driver Result is real; no DB opens.
async function authenticatedContractsFixture(options:Readonly<{duplicate?:boolean;customRow?:boolean}>= {}) {
  const [{readFileSync},tsModule,driver]=await Promise.all([import("node:fs"),import("typescript"),
    import(new URL("./result.js",import.meta.resolve("postgres")).href)]);
  const ts=tsModule.default,Result=driver.default;
  const file=new URL("../../src/execution/subscription-supervise-contracts-v1.ts",import.meta.url),source=readFileSync(file,"utf8");
  const tree=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.ESNext,true);
  const functions=["frozen","refuse","readAuthenticatedSubscriptionSuperviseContractsV1"].map(name=>{
    const node=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
    assert.ok(node,"actual reader declaration exists");return node.getText(tree).replace(/^export\s+/,"");
  }).join("\n");
  const f=fixture(),subject=f.subject,slice=f.contexts[0]!.slice;
  const rowData={story_db_id:"story-db-1",story_id:slice.storyId,story_claim_generation:4,attempt_id:"ATT_supervise-contract-fixture-01"};
  const row=options.customRow?Object.assign(new class DriverUnrelatedRow{}(),rowData):rowData;
  const rows=new Result();rows.push(row);if(options.duplicate)rows.push({...rowData});
  const tx={unsafe:async(query:string,params:unknown[])=>{
    const result=new Result();
    if(query.includes("r.attempt_id\n      FROM v3_story_claim_runtime_bindings_v1")){
      assert.deepEqual(params,["run-supervise",subject.storyDbId,21,"RTS_supervise-fixture"]);return rows;
    }
    if(query.includes("source_claim_id"))return result;
    if(query.startsWith("SELECT id FROM stories")){result.push({id:"story-db-1"});return result;}
    throw Error("UNEXPECTED_CONTRACT_READER_QUERY");
  }};
  const ports={getSql:()=>({begin:async(body:(value:unknown)=>Promise<unknown>)=>body(tx)}),
    loadAndRevalidateV3StoryClaimRuntimeBindingV1:async()=>subject,
    readNativeEvidenceOnlySuccessAuthority:async()=>{throw Error("UNEXPECTED_NATIVE_VERIFIER");},
    loadV3ImplementationAttemptContext:async(input:unknown)=>{
      assert.deepEqual(input,{runId:"run-supervise",storyId:slice.storyId,attemptId:rowData.attempt_id});
      return {attempt:{disposition:"verified"},slice,sliceHash:"a".repeat(64)};
    }};
  const compiled=ts.transpileModule(functions,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const read=new Function(...Object.keys(ports),compiled+";return readAuthenticatedSubscriptionSuperviseContractsV1;")(...Object.values(ports));
  const envelope={protocol:"v3",workflowStepId:"supervise",claimId:21,runId:"run-supervise",stepId:"step-supervise"};
  return {read:()=>read(envelope,"RTS_supervise-fixture"),readForged:()=>read({...envelope,workflowStepId:"implement"},"RTS_supervise-fixture"),
    rows,expected:{subject,rows:[rowData],contexts:[{storyDbId:"story-db-1",storyClaimGeneration:4,slice,sliceHash:"a".repeat(64)}]}};
}

it("authenticated PostgreSQL Result contracts seal as immutable canonical own-data arrays",async()=>{
  const {hashCanonicalJson}=await import("../../src/product-compiler/canonical-json.js"),f=await authenticatedContractsFixture();
  assert.notEqual(Object.getPrototypeOf(f.rows),Array.prototype,"fixture uses the genuine driver Result subclass");
  const contracts=await f.read();
  assert.equal(hashCanonicalJson(contracts),hashCanonicalJson(f.expected));
  assert.equal(Object.getPrototypeOf(contracts.rows),Array.prototype);
  assert.ok(Object.isFrozen(contracts)&&Object.isFrozen(contracts.rows)&&Object.isFrozen(contracts.rows[0]));
  assert.throws(()=>contracts.rows.push({}),TypeError);
});

it("contract row conversion retains canonical rejection of custom row prototypes",async()=>{
  const {hashCanonicalJson}=await import("../../src/product-compiler/canonical-json.js"),f=await authenticatedContractsFixture({customRow:true});
  const contracts=await f.read();
  assert.throws(()=>hashCanonicalJson(contracts),(error:any)=>error.code==="CANONICAL_JSON_UNSUPPORTED_PROTOTYPE"&&error.path==="$/rows/0");
});

it("authenticated contract reader still refuses duplicate membership and forged stage",async()=>{
  const duplicate=await authenticatedContractsFixture({duplicate:true});
  await assert.rejects(duplicate.read(),/SUBSCRIPTION_SUPERVISE_CONTRACTS_REFUSED/);
  const valid=await authenticatedContractsFixture();
  await assert.rejects(valid.readForged(),/SUBSCRIPTION_SUPERVISE_CONTRACTS_REFUSED/);
});
