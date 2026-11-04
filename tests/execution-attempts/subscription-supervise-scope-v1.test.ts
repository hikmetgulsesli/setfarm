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
