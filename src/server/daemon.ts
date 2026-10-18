#!/usr/bin/env node
import { freshInstallationSelectionV1, assertFreshInstallationSelectionUnchangedV1 } from "../installation/fresh-installation-selection-v1.js";
import { prepareFreshInstallationOperationalEntryV1, assertFreshInstallationOperationalEntryV1 } from "../installation/fresh-installation-entry-v1.js";
import { acquireFreshServiceProcessV1 } from "./fresh-installation-service-controls-v1.js";
import { pgClose } from "../db-pg.js";
import "../runtime-config.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { startDashboardWithPreSchemaAdmissionV3 } from "./dashboard.js";
import { assertOrdinaryDashboardDeploymentCutoverAdmissionV2 } from "../internal-production/baseline-deployment-cutover-v1.js";
import { assertTask6aPreSchemaOrdinaryStartupV2 } from "../internal-production/baseline-task6a-preschema-ordinary-refusal-v2.js";

const port = parseInt(process.argv[2], 10) || 3333;

async function runFreshDashboardDaemonV1():Promise<void> {
  await prepareFreshInstallationOperationalEntryV1();assertFreshInstallationOperationalEntryV1();
  if(!process.send)throw new Error("FRESH_INSTALLATION_SERVICE_IPC_REQUIRED");
  const selected=freshInstallationSelectionV1!,lease=acquireFreshServiceProcessV1("dashboard");
  let server:Awaited<ReturnType<typeof startDashboardWithPreSchemaAdmissionV3>>|undefined;
  let closure:Promise<void>|undefined;
  const close=():Promise<void>=>closure??=(async()=>{
    let primary:unknown;
    try{if(server)await new Promise<void>((resolve,reject)=>server!.close(error=>error?reject(error):resolve()));}catch(error){primary=error;}
    try{await pgClose();}catch(error){primary??=error;}
    try{lease.release();}catch(error){primary??=error;}
    if(primary!==undefined)throw primary;
  })();
  process.once("SIGTERM",()=>{void close().then(()=>process.exit(0),()=>process.exit(1));});
  try{
    server=await startDashboardWithPreSchemaAdmissionV3(port);
    if(closure)throw new Error("FRESH_INSTALLATION_SERVICE_START_CANCELLED");
    await new Promise<void>((resolve,reject)=>{
      if(server!.listening){resolve();return;}
      const ready=():void=>{server!.off("error",failed);resolve();};
      const failed=(error:Error):void=>{server!.off("listening",ready);reject(error);};
      server!.once("listening",ready);server!.once("error",failed);
    });
    assertFreshInstallationOperationalEntryV1();if(closure)throw new Error("FRESH_INSTALLATION_SERVICE_START_CANCELLED");
    await new Promise<void>((resolve,reject)=>process.send!({type:"setfarm.dashboard.ready.v1",pid:process.pid,port,sourceSha:selected.state.origin.sourceSha},error=>error?reject(error):resolve()));
  }catch(error){try{await close();}catch(cleanup){throw new AggregateError([error,cleanup],"FRESH_INSTALLATION_SERVICE_START_CLEANUP_UNCONFIRMED");}throw error;}
}
assertFreshInstallationSelectionUnchangedV1();
if(freshInstallationSelectionV1){await runFreshDashboardDaemonV1();}else{
const pidDir = path.join(os.homedir(), ".openclaw", "setfarm");
const pidFile = path.join(pidDir, "dashboard.pid");

assertOrdinaryDashboardDeploymentCutoverAdmissionV2();
await assertTask6aPreSchemaOrdinaryStartupV2();
assertOrdinaryDashboardDeploymentCutoverAdmissionV2();
function removeOwnPid(): void {
  try {
    if (fs.readFileSync(pidFile, "utf8") === String(process.pid)) fs.unlinkSync(pidFile);
  } catch {}
}
process.once("exit", removeOwnPid);
fs.mkdirSync(pidDir, { recursive: true });
fs.writeFileSync(pidFile, String(process.pid));
process.on("SIGTERM", () => process.exit(0));

const server = await startDashboardWithPreSchemaAdmissionV3(port);
await new Promise<void>((resolve, reject) => {
  if (server.listening) { resolve(); return; }
  const onListening = (): void => { server.off("error", onError); resolve(); };
  const onError = (error: Error): void => { server.off("listening", onListening); reject(error); };
  server.once("listening", onListening); server.once("error", onError);
});
if (process.send) {
  process.send({ type: "setfarm.dashboard.ready.v1", pid: process.pid, port }, (error) => {
    if (error) { server.close(); process.exitCode = 1; }
  });
}
}
