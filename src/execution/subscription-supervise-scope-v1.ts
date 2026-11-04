import path from "node:path";
import {ImplementationSliceV1Schema,type ImplementationSliceV1} from "../product-compiler/schemas/implementation-slice-v1.js";
import type {V3StoryClaimRuntimeSubjectV1} from "./v3-story-claim-runtime-binding-v1.js";
export type SubscriptionSuperviseContractV1=Readonly<{storyDbId:string;storyClaimGeneration:number;slice:ImplementationSliceV1;sliceHash:string;allowedPaths?:readonly string[]}>;
/** DATA projection only. Real bound-subject and accepted-context joins belong to the genuine facade. */
export function projectSubscriptionSuperviseWritePathsV1(input:Readonly<{worktree:string;subject:V3StoryClaimRuntimeSubjectV1;contexts:readonly SubscriptionSuperviseContractV1[]}>):string[]{
  const refuse=():never=>{throw Error("SUBSCRIPTION_SUPERVISE_SCOPE_REFUSED");};
  if(!path.isAbsolute(input.worktree)||path.normalize(input.worktree)!==input.worktree||!input.contexts.length)refuse();
  const seen=new Set<string>(),result=new Set<string>();
  for(const context of input.contexts){
    if(!context.storyDbId||seen.has(context.storyDbId)||!Number.isSafeInteger(context.storyClaimGeneration)||context.storyClaimGeneration<0
      ||!/^[a-f0-9]{64}$/.test(context.sliceHash))refuse();seen.add(context.storyDbId);
    const slice=ImplementationSliceV1Schema.parse(context.slice);
    if(input.subject.kind==="story_member"&&(input.contexts.length!==1||input.subject.storyDbId!==context.storyDbId
      ||input.subject.storyId!==slice.storyId||input.subject.storyClaimGeneration!==context.storyClaimGeneration))refuse();
    const allowed=new Set(slice.files.filter(f=>f.role==="owned"||f.role==="shared_writable").map(f=>f.path));
    const paths=context.allowedPaths??[...allowed];
    if(paths.some(p=>!allowed.has(p)))refuse();
    for(const relative of paths){const absolute=path.resolve(input.worktree,relative);
      if(!relative||relative.startsWith("/")||relative.includes("\\")||relative.split("/").some(p=>!p||p==="."||p===".."||p===".git"||p===".setfarm")
        ||!absolute.startsWith(input.worktree+"/"))refuse();result.add(absolute);}
  }
  if(result.size>256)refuse();return[...result].sort();
}
