import nodeAssert from "node:assert/strict";
import {createHash} from "node:crypto";
import {contractSpinePre32SourceJournalIdentitiesV1} from "../../src/db/contract-spine-migrations.js";
// Independent metadata copied from the previously reviewed qualifier fixture.
// Actual source journal contract only; never import production column manifest.
const names = ["runs", "steps", "stories", "rules", "run_observations"];
// Independent fixture frozen from ordinary DDL and pre32 migrations, not the
// implementation's manifest. No live PG, credentials, SQL mutation or listener.
const fields = [
  "id run_number workflow_id task status context meta notify_url assigned_developer protocol protocol_version compiler_release_sha packet_hash activation_preflight_hash accepted_candidate_hash deploy_receipt_hash release_admission_hash project_transfer_ack_hash created_at updated_at",
  "id run_id step_id agent_id step_index input_template expects status output retry_count max_retries abandoned_count started_at type loop_config current_story_id created_at updated_at",
  "id run_id story_index story_id title description acceptance_criteria status output retry_count max_retries abandoned_count claimed_by claimed_at claim_generation started_at depends_on scope_files shared_files scope_targets requested_dependencies shared_edit_requests resolved_scope_files scope_description file_skeletons implementation_contract story_screens story_branch pr_url merge_status created_at updated_at quality_failure_fingerprint",
  "id title content category project_type source severity applies_to enabled readonly sort_order created_at updated_at",
  "id run_id step_id story_id agent_id phase check_id label status summary detail evidence file_paths github metadata event_type started_at completed_at created_at updated_at",
].map(value => value.split(" "));
const notNull = [
  "id run_number workflow_id task status context protocol protocol_version created_at updated_at",
  "id run_id step_id agent_id step_index input_template expects status retry_count max_retries abandoned_count type created_at updated_at",
  "id run_id story_index story_id title description acceptance_criteria status retry_count max_retries abandoned_count claim_generation created_at updated_at",
  fields[3]!.filter(name => name !== "source").join(" "),
  "id run_id step_id story_id check_id label status evidence file_paths github metadata created_at updated_at",
].map(value => new Set(value.split(" ")));
const integers = new Set("run_number protocol_version step_index story_index retry_count max_retries abandoned_count claim_generation sort_order".split(" "));

function fixture() {
  const relations = names.map((name, index) => ({
    relation_oid: String(1000 + index), relation_name: name, relation_kind: "r", persistence: "p",
    access_method: "heap", handler_namespace: "pg_catalog", handler_name: "heap_tableam_handler",
    handler_language: "internal", handler_source: "heap_tableam_handler", handler_binary: null,
    handler_security_definer: false, handler_config: null, row_security: false,
    force_row_security: false, has_inheritance: false, has_rewrite: false, can_select: true,
  }));
  const columns = fields.flatMap((list, table) => list.map((name, index) => {
    const type = name.endsWith("_at") ? "timestamptz" : integers.has(name) ? "int4" : ["enabled", "readonly"].includes(name) ? "bool" : "text";
    return {
      relation_oid: String(1000 + table), attribute_number: index + 1, column_name: name,
      type_oid: ({ text: "25", int4: "23", bool: "16", timestamptz: "1184" })[type],
      type_namespace: "pg_catalog", type_name: type, type_kind: "b", type_modifier: -1,
      dimensions: 0, not_null: notNull[table]!.has(name), identity_kind: "", generated_kind: "",
      collation_oid: type === "text" ? "100" : "0",
      collation_namespace: type === "text" ? "pg_catalog" : null,
      collation_name: type === "text" ? "default" : null,
    };
  }));
  const indexes = names.map((name, table) => ({
    relation_oid: String(1000 + table), index_oid: String(2000 + table), index_name: name + "_pkey",
    index_kind: "i", access_method: "btree", handler_namespace: "pg_catalog", handler_name: "bthandler",
    handler_language: "internal", handler_source: "bthandler", handler_binary: null,
    handler_security_definer: false, handler_config: null, total_attributes: 1, key_attributes: 1,
    primary_key: true, unique_index: true, immediate: true, valid: true, ready: true, live: true,
    exclusion: false, attribute_numbers: "1", operator_class_oids: "3126", collation_oids: "100",
    key_options: "0", expressions: null, predicate: null, definition: `CREATE UNIQUE INDEX ${name}_pkey ON public.${name} USING btree (id)`,
    primary_constraints: [{ constraint_oid: String(3000 + table), kind: "p", validated: true, deferrable: false, deferred: false, attributes: [1] }],
    keys: [{ ordinal: 0, attribute_number: 1, operator_class_oid: "3126", operator_class_namespace: "pg_catalog",
      operator_class_name: "text_ops", operator_class_default: true, operator_input_type_oid: "25", operator_key_type_oid: "0",
      family_oid: "1994", family_namespace: "pg_catalog", family_name: "text_ops", class_method_matches: true,
      family_method_matches: true, support_count: 2, operator_count: 5, support_builtin: true, operators_builtin: true }],
  }));
  return { relations, columns, indexes };
}


const countKeys = "activeRunCount openClaimCount executionAttemptCount activeRuntimeSessionCount activeCompletionOwnerCount unsettledMandatoryEffectCount artifactReservationCount publicationBatchCount artifactPublicationCount terminationOwnerCount findingOwnerCount recoveryOwnerCount operationalDeliveryCount".split(" ");
function data() {
  return {
    profile: fixture(),
    journal: contractSpinePre32SourceJournalIdentitiesV1().map(row => ({ ...row, state: "applied" })),
    tail: Array.from({ length: 6 }, (_, index) => ({ version: index + 26, state: "applied" })),
    cold: { laterJournalCount: "0", relationCount: "0", functionCount: "0", typeCount: "0", triggerCount: "0" },
    aggregate: { catalogViolationCount: "0", aprbChildViolationCount: "0", ordinaryBatchViolationCount: "0",
      activeHeaderViolationCount: "0", ownerReservationsRelation: null, ownerAdmissionHeadRelation: null,
      producerSourceRelation: null, producerActivationRelation: null, producerActivationHeadRelation: null,
      producerCurrentRelation: null, ...Object.fromEntries(countKeys.map(key => [key, "0"])) } as Record<string, unknown>,
    parents: [] as Record<string, unknown>[], children: [] as Record<string, unknown>[], runs: [] as Record<string, unknown>[],
  };
}

const profileHashes=["9ea113ccc449ceaaeae6e7362bc131b5fd5260580dc1d764eeb9dfcc29786b01","15f44c2567b07793c4a1f3e2c23585669ec6a806b13f706b1d97ff04244c5794","42c521cd61e04e5981886488001ef456f01d73df90b42e583b65e906b863043f"];
const censusHashes=["25371b9c322bc30b7446f742bc40c5748583aee617beb55e2c755e404abd99b1","604dc7224ef8e950ee063473fdd3b213e48f51d0ff98f9b6773d1df3a53e3586","cfd7f07b898db74749ed5efb9db8c469a5b18769cfeab7417b72af4b12a7b49b","29d0341dc92de635daaa07be0138c173031f8adc87e12651b8cf7127217de05b","1fe6252b15ec7fd48c7023d87cb07d0b9bd78774536c9e3fcff0b49a77caf60e"];
const utilityStatements=["SET LOCAL statement_timeout = '5s'","SET LOCAL lock_timeout = '1s'","SET LOCAL search_path = pg_catalog","LOCK TABLE ONLY public.runs, ONLY public.steps, ONLY public.stories, ONLY public.rules, ONLY public.run_observations IN ACCESS SHARE MODE"];
const journalStatement="SELECT version, name, checksum, state\n       FROM public.setfarm_schema_migrations\n      WHERE version <= $1\n      ORDER BY version";
const tailStatement="SELECT version,state FROM public.setfarm_schema_migrations WHERE version >= 26 ORDER BY version";
function historicalRows(){
 const values=fields.map((list,index)=>Object.fromEntries(list.map(name=>[name,
 name.endsWith("_at")?new Date(0):integers.has(name)?1:["enabled","readonly"].includes(name)?true:notNull[index]!.has(name)?name:null])));
 Object.assign(values[0]!,{id:"r",status:"failed",workflow_id:"feature-dev",context:"{}",protocol:"legacy"});
 Object.assign(values[1]!,{id:"s",run_id:"r",status:"failed"});
 Object.assign(values[2]!,{id:"story",run_id:"r",status:"failed"});
 Object.assign(values[3]!,{id:"rule",title:"Public rule",content:"Public content"});
 Object.assign(values[4]!,{id:"o",run_id:"r",status:"failed",evidence:"[]",file_paths:"[]",github:"{}",metadata:"{}"});
 return values;
}
export function createCompositionProviderV2(scenario:string){
 const invariantErrors:string[]=[];
 function checked(work:()=>void):void{try{work()}catch(error){invariantErrors.push(String(error));throw error}}
 const assert={
  equal(actual:unknown,expected:unknown,message?:string){checked(()=>nodeAssert.equal(actual,expected,message))},
  deepEqual(actual:unknown,expected:unknown,message?:string){checked(()=>nodeAssert.deepEqual(actual,expected,message))},
  ok(value:unknown,message?:string){checked(()=>nodeAssert.ok(value,message))},
  fail(message:string){checked(()=>nodeAssert.fail(message))},
 };
 const value=data(), rows=historicalRows();
 const originals:Array<{kind:string;promise:Promise<unknown>;settled:boolean}>=[];
 const clients:Array<{calls:Array<{role:string;sql:string;parameters:unknown[];sameOriginal:boolean}>;end:number;qualification:number;callbackSucceeded:boolean;commitSucceeded:boolean}>=[];
 let release:(()=>void)|undefined, barrierEntered=false;
 let signalBarrier:(()=>void)|undefined;
 const barrierSignal=new Promise<void>(resolve=>{signalBarrier=resolve});
 function tracked<T>(kind:string,promise:Promise<T>):Promise<T>{
  const entry={kind,promise:promise as Promise<unknown>,settled:false};originals.push(entry);
  promise.then(()=>{entry.settled=true},()=>{entry.settled=true});return promise;
 }
 async function hold(point:string,index:number):Promise<void>{
  const selected=scenario==="disconnect"||scenario==="early-loss"?"query":scenario;
  if(index===2 && selected===point && !barrierEntered){
   barrierEntered=true;signalBarrier!();await new Promise<void>(resolve=>{release=resolve});
  }
 }
 function createClient(url:string,options:Record<string,any>){
  assert.equal(url,"postgresql://test@localhost/setfarm");
  assert.equal(options.max,1);
  const record={calls:[] as typeof clients[number]["calls"],end:0,qualification:0,callbackSucceeded:false,commitSucceeded:false};
  clients.push(record);const index=clients.length;
  async function query(sql:string,parameters:unknown[],sameOriginal:boolean){
   assert.equal(sameOriginal,true);
   const digest=createHash("sha256").update(sql).digest("hex");
   let result:unknown,role:string;
   const profileIndex=profileHashes.indexOf(digest),censusIndex=censusHashes.indexOf(digest);
   if(utilityStatements.includes(sql)){role="utility";assert.deepEqual(parameters,[]);result=[]}
   else if(profileIndex>=0){
    role=["relations","columns","indexes"][profileIndex]!;
    assert.deepEqual(parameters,profileIndex===0?[]:[["1000","1001","1002","1003","1004"]]);
    if(profileIndex===0){record.qualification++;if(record.qualification===2)await hold("final-qualification",index)}
    result=[value.profile.relations,value.profile.columns,value.profile.indexes][profileIndex];
   }else if(sql===journalStatement){role="journal";assert.deepEqual(parameters,[31]);result=value.journal}
   else if(sql===tailStatement){role="tail";assert.deepEqual(parameters,[]);result=value.tail}
   else if(censusIndex>=0){
    role=["cold","aggregate","finding-parents","finding-children","finding-runs"][censusIndex]!;
    assert.deepEqual(parameters,[]);
    result=[[value.cold],[value.aggregate],[],[],[]][censusIndex];
   }else{
    const requests:Record<string,{table:number;parameters:unknown[]}>={
     "SELECT * FROM public.runs ORDER BY created_at DESC":{table:0,parameters:[]},
     "SELECT * FROM public.runs WHERE workflow_id = $1 ORDER BY created_at DESC":{table:0,parameters:["feature-dev"]},
     "SELECT * FROM public.runs WHERE id = $1":{table:0,parameters:["r"]},
     "SELECT * FROM public.steps WHERE run_id = $1 ORDER BY step_index ASC":{table:1,parameters:["r"]},
     "SELECT * FROM public.stories WHERE run_id = $1 ORDER BY story_index ASC":{table:2,parameters:["r"]},
     "SELECT * FROM public.rules ORDER BY sort_order ASC, created_at ASC":{table:3,parameters:[]},
     "SELECT id, run_id, step_id, story_id, agent_id, phase, check_id, label, status,\n       summary, detail, evidence, file_paths, github, metadata, event_type,\n       started_at, completed_at, created_at, updated_at\nFROM public.run_observations\nWHERE run_id = $1\nORDER BY created_at DESC\nLIMIT 250":{table:4,parameters:["r"]},
    };
    assert.ok(Object.hasOwn(requests,sql),"unnominated SQL");
    const request=requests[sql]!;assert.deepEqual(parameters,request.parameters);
    role="data";await hold("query",index);result=[rows[request.table]!];
   }
   record.calls.push({role,sql,parameters,sameOriginal});return result;
  }
  const tx=function(this:unknown,strings:TemplateStringsArray,...parameters:unknown[]){return tracked("tagged-query",query(strings.join("?"),parameters,this===tx))};
  tx.unsafe=function(this:unknown,sql:string,parameters:unknown[]=[]){return tracked("unsafe-query",query(sql,parameters,this===tx))};
  return{
   options:{host:["localhost"],port:[5432],database:"setfarm",user:"test",pass:"",path:false,ssl:false,socket:undefined},
   begin(mode:string,callback:(original:typeof tx)=>Promise<unknown>){
    assert.equal(mode,"isolation level repeatable read read only");
    const pending=(async()=>{
     const callbackOriginal=tracked("callback",callback(tx));
     if(scenario==="early-loss"&&index===2){await barrierSignal;throw Error("PRIVATE_BEGIN_LOSS")}
     const result=await callbackOriginal;record.callbackSucceeded=true;await hold("commit",index);record.commitSucceeded=true;return result;
    })();return tracked("begin",pending);
   },
   end(endOptions:unknown){
    record.end++;assert.equal(record.end,1);assert.deepEqual(endOptions,{timeout:1});
    return tracked("end",(async()=>{await hold("end",index);options.onclose(1);if(scenario==="end-rejection"&&index===2)throw Error("PRIVATE_END");})());
   }
  };
 }
 return{createClient,clients,originals,invariantErrors,get barrierEntered(){return barrierEntered},
  release(){assert.ok(release,"owned barrier missing");release!();release=undefined},
  async settle(){
   for(let round=0;round<100;round++){
    const count=originals.length;assert.ok(count<=10000,"fixture original ledger bound");
    await Promise.allSettled(originals.map(entry=>entry.promise));
    await new Promise<void>(resolve=>setImmediate(resolve));
    if(count===originals.length && originals.every(entry=>entry.settled))return;
   }
   assert.fail("fixture original ledger did not stabilize");
  }};
}
