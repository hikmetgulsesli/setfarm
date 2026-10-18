// Proposed src/installation/fresh-installation-spawner-listener-v1.ts.
// Fixed same-reserved-connection verification + notification lifecycle only.
import postgres from "postgres";
import { freshInstallationSelectionV1 } from "./fresh-installation-selection-v1.js";
import { prepareFreshInstallationOperationalEntryV1, assertFreshInstallationOperationalEntryV1 } from "./fresh-installation-entry-v1.js";

const channels=Object.freeze(["step_pending","story_pending","run_termination_requested","runtime_completion_requested"] as const);
export type FreshSpawnerNotificationChannelV1 = typeof channels[number];
export type FreshSpawnerListenerV1 = Readonly<{
  backendPid:number;
  listen(channel:string,callback:(payload:string)=>void):Promise<void>;
  arm():Promise<void>;
  assertCurrent():void;
  closed:Promise<Error|null>;
  end():Promise<void>;
}>;
export async function openFreshInstallationSpawnerListenerV1():Promise<FreshSpawnerListenerV1> {
  // The existing fixed entry performs actual source/build/private owned-client
  // preparation. No caller SQL, URL, verifier or success capability is accepted.
  await prepareFreshInstallationOperationalEntryV1();
  assertFreshInstallationOperationalEntryV1();
  const selected=freshInstallationSelectionV1,activation=selected?.activation;
  if(!selected||!activation?.acknowledged)throw new Error("FRESH_SPAWNER_LISTENER_REFUSED");
  selected.assertUnchanged();
  const verifier=await import("./fresh-installation-activation-verifier-v1.js");
  assertFreshInstallationOperationalEntryV1();
  let phase:"opening"|"verified"|"refused"|"closing"|"closed"="opening";
  let armed=false,pool:postgres.Sql|undefined,reserved:postgres.ReservedSql|undefined;
  let releaseEntered=false,backendPid=0,endPromise:Promise<void>|undefined;
  let settleClosed!:(value:Error|null)=>void;
  const closed=new Promise<Error|null>(resolve=>{settleClosed=resolve;});
  const handlers=new Map<FreshSpawnerNotificationChannelV1,(payload:string)=>void>();
  const pending=new Set<FreshSpawnerNotificationChannelV1>();
  const completed=new Set<FreshSpawnerNotificationChannelV1>();
  const refuse=():Error=>{
    if(phase!=="closing"&&phase!=="closed")phase="refused";
    armed=false;handlers.clear();completed.clear();
    const error=new Error("FRESH_SPAWNER_LISTENER_REFUSED");settleClosed(error);return error;
  };
  const assertCurrent=():void=>{
    if(phase!=="verified")throw refuse();
    try{selected.assertUnchanged();assertFreshInstallationOperationalEntryV1();}
    catch{throw refuse();}
  };
  const end=():Promise<void>=>{
    if(endPromise)return endPromise;
    endPromise=(async()=>{
      phase="closing";armed=false;handlers.clear();completed.clear();let failed=false;
      // No cleanup query or reconnection after refusal. Releasing then ending
      // the owned pool closes this one connection and drops its LISTEN state.
      if(reserved&&!releaseEntered){releaseEntered=true;try{reserved.release();}catch{failed=true;}}
      if(pool)try{await pool.end({timeout:5});}catch{failed=true;}
      phase="closed";
      if(failed){const error=new Error("FRESH_SPAWNER_LISTENER_CLOSE_FAILED");settleClosed(error);throw error;}
      settleClosed(null);
    })();return endPromise;
  };
  const assertSameBackend=async():Promise<void>=>{
    assertCurrent();if(!reserved)throw refuse();
    const rows=await reserved.unsafe<Array<{pid:number}>>("SELECT pg_backend_pid()::integer AS pid");
    if(rows.length!==1||rows[0]!.pid!==backendPid)throw refuse();
    assertCurrent();
  };
  try{
    // onnotify is consumed directly by this installed driver's connection.js;
    // do NOT call pool.listen(), which constructs an unverified internal pool.
    // A variable preserves ordinary structural option typing without a cast or
    // pretending a reserved SQL object implements its inherited .begin type.
    const options={max:1,connect_timeout:3,idle_timeout:0,max_lifetime:0,fetch_types:false,
      onnotice(){},
      onclose(){if(phase!=="closing"&&phase!=="closed")refuse();},
      onnotify(channel:string,payload:string){
        if(!armed||phase!=="verified")return;
        try{
          assertCurrent();
          if(!channels.includes(channel as FreshSpawnerNotificationChannelV1))throw refuse();
          const callback=handlers.get(channel as FreshSpawnerNotificationChannelV1);
          if(!callback)throw refuse();callback(payload);
        }catch{refuse();}
      }};
    pool=postgres(selected.state.runtimeUrl,options);
    // postgres3.4.8 can leave first reserve pending with fetch_types:false.
    // Warm this max1 pool with a fixed read; all authority checks still use
    // the subsequently reserved backend before any LISTEN or notification.
    await pool.unsafe("SELECT 1::integer AS ready");
    reserved=await pool.reserve();
    selected.assertUnchanged();assertFreshInstallationOperationalEntryV1();
    const pidRows=await reserved.unsafe<Array<{pid:number}>>("SELECT pg_backend_pid()::integer AS pid");
    if(pidRows.length!==1||!Number.isSafeInteger(pidRows[0]!.pid)||pidRows[0]!.pid<=0)throw refuse();
    backendPid=pidRows[0]!.pid;
    let inTransaction=false;
    try{
      await reserved.unsafe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");inTransaction=true;
      await reserved.unsafe("SELECT set_config('lock_timeout','1000ms',true),set_config('statement_timeout','30000ms',true),set_config('search_path','public',true)");
      // This production verifier's actual parameter is unsafe-only, not a
      // TransactionSql/Sql callback. ReservedSql satisfies it directly.
      await verifier.verifyFreshInstallationActivatedDatabaseOnTransactionV1(reserved,activation,selected.state,"runtime");
      selected.assertUnchanged();assertFreshInstallationOperationalEntryV1();
      if(phase!=="opening")throw refuse();
      await reserved.unsafe("COMMIT");inTransaction=false;
    }catch(error){if(inTransaction&&phase==="opening")try{await reserved.unsafe("ROLLBACK");}catch{/* Preserve refusal. */}throw error;}
    if(phase!=="opening")throw refuse();phase="verified";
    await assertSameBackend();
    return Object.freeze({backendPid,closed,assertCurrent,end,
      async listen(channel:string,callback:(payload:string)=>void):Promise<void>{
        assertCurrent();if(armed||!channels.includes(channel as FreshSpawnerNotificationChannelV1)||handlers.has(channel as FreshSpawnerNotificationChannelV1))throw refuse();
        if(typeof callback!=="function")throw refuse();
        const fixed=channel as FreshSpawnerNotificationChannelV1;
        handlers.set(fixed,callback);pending.add(fixed);
        try{
          // channel is one of four fixed literals above; it is never SQL input.
          if(!reserved)throw refuse();await assertSameBackend();
          await reserved.unsafe('LISTEN "'+fixed+'"');await assertSameBackend();
          completed.add(fixed);
        }catch{throw refuse();}
        finally{pending.delete(fixed);}
      },
      async arm():Promise<void>{
        assertCurrent();if(armed||pending.size!==0||handlers.size!==channels.length||completed.size!==channels.length||channels.some(channel=>!handlers.has(channel)||!completed.has(channel)))throw refuse();
        await assertSameBackend();
        // Recheck after the await: registration alone is never completion.
        if(armed||pending.size!==0||handlers.size!==channels.length||completed.size!==channels.length||channels.some(channel=>!handlers.has(channel)||!completed.has(channel)))throw refuse();
        armed=true;
      }});
  }catch{
    refuse();try{await end();}catch{/* The original refusal remains terminal. */}
    throw new Error("FRESH_SPAWNER_LISTENER_REFUSED");
  }
}
