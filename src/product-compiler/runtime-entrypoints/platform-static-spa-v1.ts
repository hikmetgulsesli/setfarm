import type { BuildCommandV1 } from "../schemas/build-topology-v1.js";

/**
 * Versioned, platform-owned runtime entrypoint for immutable browser build
 * outputs. The source is intentionally part of the stack catalog identity;
 * generated repositories cannot replace it with an npm script or framework
 * development server.
 */
export const PLATFORM_STATIC_SPA_RUNTIME_ENTRYPOINT_ID =
  "setfarm-platform-static-spa-v1" as const;

export const PLATFORM_STATIC_SPA_RUNTIME_SOURCE = String.raw`"use strict";
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const root=fs.realpathSync(".");
const mime=Object.freeze({
  ".avif":"image/avif",".css":"text/css; charset=utf-8",".csv":"text/csv; charset=utf-8",
  ".gif":"image/gif",".htm":"text/html; charset=utf-8",".html":"text/html; charset=utf-8",
  ".ico":"image/x-icon",".jpeg":"image/jpeg",".jpg":"image/jpeg",".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",".map":"application/json; charset=utf-8",
  ".mjs":"text/javascript; charset=utf-8",".mp3":"audio/mpeg",".mp4":"video/mp4",
  ".ogg":"audio/ogg",".otf":"font/otf",".pdf":"application/pdf",".png":"image/png",
  ".svg":"image/svg+xml",".txt":"text/plain; charset=utf-8",".wasm":"application/wasm",
  ".wav":"audio/wav",".webm":"video/webm",".webmanifest":"application/manifest+json",
  ".webp":"image/webp",".woff":"font/woff",".woff2":"font/woff2",".xml":"application/xml; charset=utf-8"
});
const end=(res,status,message)=>{res.statusCode=status;res.setHeader("Content-Type","text/plain; charset=utf-8");res.end(message);};
const inside=(candidate)=>candidate===root||candidate.startsWith(root+path.sep);
const regular=(candidate)=>{
  const before=fs.lstatSync(candidate);
  if(!before.isFile()||before.isSymbolicLink())throw 0;
  const canonical=fs.realpathSync(candidate);
  if(!inside(canonical))throw 0;
  const after=fs.statSync(canonical);
  if(!after.isFile()||before.dev!==after.dev||before.ino!==after.ino)throw 0;
  return {canonical,stat:after};
};
const locator=(raw)=>{
  const origin=String(raw||"").split("?",1)[0].split("#",1)[0];
  if(!origin.startsWith("/")||/%2f|%5c/i.test(origin))throw 0;
  const decoded=decodeURIComponent(origin);
  if(decoded.includes("\0")||decoded.includes("\\")||decoded.split("/").includes(".."))throw 0;
  return decoded==="/"?"index.html":decoded.replace(/^\/+/,"");
};
const rangeFor=(header,size)=>{
  if(header===undefined)return null;
  const match=/^bytes=(\d*)-(\d*)$/.exec(String(header));
  if(!match||(match[1]===""&&match[2]===""))throw 0;
  let start;
  let end;
  if(match[1]===""){
    const suffix=Number(match[2]);
    if(!Number.isSafeInteger(suffix)||suffix<=0)throw 0;
    start=Math.max(0,size-suffix);end=size-1;
  }else{
    start=Number(match[1]);end=match[2]===""?size-1:Number(match[2]);
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=size)throw 0;
    end=Math.min(end,size-1);
  }
  return {start,end};
};
http.createServer((req,res)=>{
  if(req.method!=="GET"&&req.method!=="HEAD"){
    res.setHeader("Allow","GET, HEAD");return end(res,405,"method not allowed");
  }
  let selected;
  try{
    const relative=locator(req.url);
    const candidate=path.resolve(root,relative);
    if(!inside(candidate))throw 0;
    try{selected=regular(candidate);}catch{
      const html=String(req.headers.accept||"").toLowerCase().includes("text/html");
      if(!html||path.posix.extname(relative)!==""||/^api(?:\/|$)/i.test(relative))throw 0;
      selected=regular(path.join(root,"index.html"));
    }
  }catch{return end(res,404,"not found");}
  const size=selected.stat.size;
  let range;
  try{range=rangeFor(req.headers.range,size);}catch{
    res.statusCode=416;res.setHeader("Content-Range","bytes */"+size);return res.end();
  }
  const start=range?range.start:0;
  const finish=range?range.end:Math.max(0,size-1);
  res.statusCode=range?206:200;
  res.setHeader("Accept-Ranges","bytes");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Content-Type",mime[path.extname(selected.canonical).toLowerCase()]||"application/octet-stream");
  res.setHeader("Content-Length",range?finish-start+1:size);
  if(range)res.setHeader("Content-Range","bytes "+start+"-"+finish+"/"+size);
  if(req.method==="HEAD"||size===0)return res.end();
  const stream=fs.createReadStream(selected.canonical,{start,end:finish});
  stream.on("error",()=>res.destroy());
  stream.pipe(res);
}).listen(Number(process.env.PORT),"127.0.0.1");`;

export function isPlatformStaticSpaPreviewCommand(
  command: Pick<BuildCommandV1, "kind" | "argv" | "capabilityRefs">,
): boolean {
  return command.kind === "preview"
    && command.argv.length === 3
    && command.argv[0] === "node"
    && command.argv[1] === "-e"
    && command.argv[2] === PLATFORM_STATIC_SPA_RUNTIME_SOURCE
    && command.capabilityRefs.length === 0;
}
