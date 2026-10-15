import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readDashboardCoreResponseV2 } from "../db-pg.js";
import { loadRequiredDashboardWorkflowsV2, parseRequiredDashboardSystemRulesV2, mergeDashboardRulesV2 } from "./dashboard-core-static-v2.js";

const directory=path.dirname(fileURLToPath(import.meta.url));
const maximum=4*1024*1024;
const unavailable=Buffer.from('{"error":"Dashboard unavailable"}',"utf8");
function target(raw:unknown):{pathname:string;query:URLSearchParams} {
  if(typeof raw!=="string" || !raw.startsWith("/") || raw.startsWith("//")
    || Buffer.byteLength(raw,"utf8")>16384 || Buffer.from(raw,"utf8").toString("utf8")!==raw
    || /[\s\\#\u0000-\u001f\u007f]/u.test(raw))throw Error("DASHBOARD_TARGET_UNAVAILABLE");
  const decoded=decodeURIComponent(raw);
  if(/[\u0000-\u001f\u007f]/u.test(decoded))throw Error("DASHBOARD_TARGET_UNAVAILABLE");
  const index=raw.indexOf("?"), pathname=index<0?raw:raw.slice(0,index);
  if(pathname.split("/").some(segment=>[".",".."].includes(decodeURIComponent(segment))))throw Error("DASHBOARD_TARGET_UNAVAILABLE");
  return{pathname,query:new URLSearchParams(index<0?"":raw.slice(index+1))};
}
function staged(data:unknown, pretty=false):Buffer {
  const json=JSON.stringify(data,null,pretty?2:undefined);
  if(typeof json!=="string")throw Error("DASHBOARD_RESPONSE_UNAVAILABLE");
  const bytes=Buffer.from(json,"utf8");
  if(bytes.length>maximum)throw Error("DASHBOARD_RESPONSE_UNAVAILABLE");
  return bytes;
}
function staticBytes(file:string, html=false):Buffer {
  const bytes=fs.readFileSync(file);
  if(bytes.length===0 || bytes.length>maximum || (html && !Buffer.from(bytes.toString("utf8"),"utf8").equals(bytes)))throw Error("DASHBOARD_MATERIAL_UNAVAILABLE");
  return bytes;
}
// Internal consuming handler only. No preparation, server/listener, SQL or startup grant.
export async function handleDashboardCoreReadonlyHttpV2(req:IncomingMessage,res:ServerResponse):Promise<void> {
  let lost=false, started=false, ended=false, destroyed=false;
  const destroy=()=>{if(destroyed)return;destroyed=true;lost=true;try{res.destroy();}catch{/* transport only */}};
  res.on("error",destroy);
  res.on("close",()=>{lost=true;});
  const publish=(bytes:Buffer,status=200,type="application/json",attachment=false)=>{
    if(lost || res.destroyed || res.writableEnded)return;
    if(started || bytes.length>maximum)throw Error("DASHBOARD_RESPONSE_UNAVAILABLE");
    started=true;
    res.writeHead(status,{"Content-Type":type,"Content-Length":String(bytes.length),"Access-Control-Allow-Origin":"*",...(attachment?{"Content-Disposition":'attachment; filename="setfarm-rules.json"'}:{})});
    if(lost || res.destroyed || res.writableEnded)return;
    if(!ended){ended=true;res.end(bytes);}
  };
  try {
    if(req.method!=="GET"){publish(unavailable,503);return;}
    const {pathname:p,query}=target(req.url);
    if(p==="/"){
      const local=path.join(directory,"index.html"), source=path.resolve(directory,"..","..","src","server","index.html");
      publish(staticBytes(fs.existsSync(local)?local:source,true),200,"text/html");return;
    }
    if(p==="/logo.jpeg" || p==="/fonts/GeistPixel-Square.woff2"){
      const asset=p==="/logo.jpeg"?"logo.jpeg":"fonts/GeistPixel-Square.woff2";
      publish(staticBytes(path.resolve(directory,"..","..","assets",asset)),200,p==="/logo.jpeg"?"image/jpeg":"font/woff2");return;
    }
    if(p==="/api/workflows"){publish(staged(loadRequiredDashboardWorkflowsV2()));return;}
    if(p==="/api/rules" || p==="/api/rules/export"){
      const system=parseRequiredDashboardSystemRulesV2();
      const custom=await readDashboardCoreResponseV2({kind:"rules"});
      if(!Array.isArray(custom))throw Error("DASHBOARD_RESPONSE_UNAVAILABLE");
      const exported=p==="/api/rules/export";
      const rules=mergeDashboardRulesV2(system,custom,exported?new URLSearchParams():query);
      publish(staged(exported?{version:1,exportedAt:new Date().toISOString(),rules}:rules,exported),200,"application/json",exported);return;
    }
    if(p==="/api/runs"){
      const workflowId=query.get("workflow"), includeTerminal=["1","true","yes","on"].includes((query.get("include_terminal")||"").toLowerCase());
      publish(staged(await readDashboardCoreResponseV2({kind:"runs",includeTerminal,...(workflowId?{workflowId}:{})})));return;
    }
    const match=/^\/api\/runs\/([^/]+)(?:\/(stories|observations))?$/.exec(p);
    if(match){
      const kind=match[2]??"run";
      const data=await readDashboardCoreResponseV2({kind,id:match[1]});
      publish(staged(kind==="run" && data===null?{error:"Run not found"}:data),kind==="run" && data===null?404:200);return;
    }
    publish(unavailable,503);
  }catch{
    if(started){destroy();return;}
    try{publish(unavailable,503);}catch{destroy();}
  }
}
