import * as fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {TextDecoder,types} from 'node:util';

export const MANUAL_ORPHAN_BASENAME_V1='manual-control-orphan-bootstrap-v1.integration.test.ts';
export const MANUAL_ORPHAN_VECTOR_V1=Object.freeze([
  'node','--import','tsx','--test','--test-concurrency=1',
  'tests/execution-attempts/'+MANUAL_ORPHAN_BASENAME_V1,
]);

function validateCellsV1(cells){
  if(!Array.isArray(cells))throw Error('MANUAL_ORPHAN_FRAME_REFUSED');
  for(let index=0;index<cells.length;index++){
    if(!Object.hasOwn(cells,index)||typeof cells[index]!=='string'){
      throw Error('MANUAL_ORPHAN_FRAME_REFUSED');
    }
  }
}

export function mentionsManualOrphanFileV1(cells){
  validateCellsV1(cells);
  return cells.some(cell=>cell.toLowerCase().includes(MANUAL_ORPHAN_BASENAME_V1));
}

export function classifyManualOrphanVectorV1(cells){
  validateCellsV1(cells);
  const same=cells.length===MANUAL_ORPHAN_VECTOR_V1.length
    &&cells.every((cell,index)=>cell===MANUAL_ORPHAN_VECTOR_V1[index]);
  return same?'exact':mentionsManualOrphanFileV1(cells)?'near':'unrelated';
}

function probeFrameRefusalV1(){
  return Error('MANUAL_ORPHAN_FRAME_REFUSED');
}

// Inspect every own descriptor before reading values. Reject proxies before any
// reflective operation so validation cannot execute their property traps either.
function probeOwnDataV1(value,keys){
  if(value===null||typeof value!=='object'||types.isProxy(value)
    ||Object.getPrototypeOf(value)!==Object.prototype)throw probeFrameRefusalV1();
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(descriptors).length!==keys.length)throw probeFrameRefusalV1();
  for(const key of keys){
    if(!Object.hasOwn(descriptors,key)||!descriptors[key].enumerable
      ||!Object.hasOwn(descriptors[key],'value'))throw probeFrameRefusalV1();
  }
  return Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
}

function probeHexV1(value){
  return typeof value==='string'&&value.length===64&&/^[0-9a-f]{64}$/.test(value);
}

function probeIntegerV1(value,minimum){
  return Number.isSafeInteger(value)&&value>=minimum&&value<=2147483647;
}

function probeTimestampV1(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(value))return false;
  const date=new Date(value);
  return Number.isFinite(date.getTime())&&date.toISOString()===value;
}

function probeExecutableV1(value){
  // POSIX normalization is syntactic here; no path is resolved or opened.
  return typeof value==='string'&&value.length>1&&value.startsWith('/')
    &&Buffer.byteLength(value,'utf8')<=4096&&!/[\u0000-\u001f\u007f-\u009f]/.test(value)
    &&Buffer.from(value,'utf8').toString('utf8')===value
    &&value.split('/').slice(1).every(part=>part!==''&&part!=='.'&&part!=='..');
}

function orderedProbeProcessV1(value){
  const data=probeOwnDataV1(value,[
    'pid','ppid','uid','pgid','startedAtUTC','executable','executableSha256','commandSha256',
  ]);
  if(!probeIntegerV1(data.pid,1)||!probeIntegerV1(data.ppid,1)
    ||!probeIntegerV1(data.uid,0)||!probeIntegerV1(data.pgid,1)
    ||!probeTimestampV1(data.startedAtUTC)||!probeExecutableV1(data.executable)
    ||!probeHexV1(data.executableSha256)||!probeHexV1(data.commandSha256))throw probeFrameRefusalV1();
  return {
    pid:data.pid,ppid:data.ppid,uid:data.uid,pgid:data.pgid,
    startedAtUTC:data.startedAtUTC,executable:data.executable,
    executableSha256:data.executableSha256,commandSha256:data.commandSha256,
  };
}

function orderedProbeFrameV1(value){
  const data=probeOwnDataV1(value,['schema','nonce','parent','child','source']);
  if(data.schema!=='setfarm.manual-orphan-lifecycle-probe.v1'||!probeHexV1(data.nonce))throw probeFrameRefusalV1();
  const parent=orderedProbeProcessV1(data.parent),child=orderedProbeProcessV1(data.child);
  const source=probeOwnDataV1(data.source,['helperSha256','issuerTestSha256']);
  if(!probeHexV1(source.helperSha256)||!probeHexV1(source.issuerTestSha256))throw probeFrameRefusalV1();
  return {
    schema:data.schema,nonce:data.nonce,parent,child,
    source:{helperSha256:source.helperSha256,issuerTestSha256:source.issuerTestSha256},
  };
}

export function encodeManualOrphanProbeFrameV1(frame){
  try{
    const bytes=Buffer.from(JSON.stringify(orderedProbeFrameV1(frame))+'\n','utf8');
    if(bytes.length>16384)throw probeFrameRefusalV1();
    return bytes;
  }catch{
    throw probeFrameRefusalV1();
  }
}

export function decodeManualOrphanProbeFrameV1(bytes){
  try{
    if(types.isProxy(bytes)||!Buffer.isBuffer(bytes))throw probeFrameRefusalV1();
    // Read the actual view size, independent of any own length/byteLength data.
    const size=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get.call(bytes);
    if(size<1||size>16384||bytes[size-1]!==0x0a)throw probeFrameRefusalV1();
    // Retain a BOM rather than stripping it; both parse and exact bytes remain
    // strict. Fatal decoding must precede JSON parsing to reject replacement UTF8.
    const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
    const frame=orderedProbeFrameV1(JSON.parse(text.slice(0,-1)));
    if(Buffer.compare(bytes,encodeManualOrphanProbeFrameV1(frame))!==0)throw probeFrameRefusalV1();
    Object.freeze(frame.parent);Object.freeze(frame.child);Object.freeze(frame.source);
    return Object.freeze(frame);
  }catch{
    throw probeFrameRefusalV1();
  }
}

function probeOwnerRefusalV1(){return Error('MANUAL_ORPHAN_OWNER_REFUSED');}
function probeCloseUnknownV1(){return Error('MANUAL_ORPHAN_CHILD_UNKNOWN');}

// Capture each returned FD immediately. Closing burns its ownership before the
// syscall; an uncertain close can never be retried against a reused descriptor.
function probeDescriptorOwnerV1(){
  const descriptors=[];let closed=false,unknown=false;
  const guard=()=>{
    if(unknown)throw probeCloseUnknownV1();
    if(closed)throw probeOwnerRefusalV1();
  };
  return {
    guard,
    open(locator,flags){guard();const fd=fs.openSync(locator,flags);descriptors.push(fd);return fd;},
    close(){
      if(!closed){
        closed=true;
        for(let index=descriptors.length-1;index>=0;index--){
          try{fs.closeSync(descriptors[index]);}catch{unknown=true;}
        }
      }
      if(unknown)throw probeCloseUnknownV1();
    },
  };
}

function sameProbeFileV1(first,second){
  return ['dev','ino','uid','gid','mode','nlink','size','mtimeNs','ctimeNs']
    .every(key=>first[key]===second[key]);
}
function sameProbeDirectoryV1(first,second){
  return ['dev','ino','uid','mode'].every(key=>first[key]===second[key]);
}
function probeDirectoryShapeV1(stat){return stat.isDirectory()&&!stat.isSymbolicLink();}

function pinProbeFileV1(locator,cap,kind,owner){
  owner.guard();
  if(!probeExecutableV1(locator)||fs.realpathSync(locator)!==locator)throw probeOwnerRefusalV1();
  const ancestors=[];
  for(let current=path.dirname(locator);;current=path.dirname(current)){
    if(ancestors.length>=128)throw probeOwnerRefusalV1();
    const first=fs.lstatSync(current,{bigint:true});
    if(!probeDirectoryShapeV1(first)||fs.realpathSync(current)!==current)throw probeOwnerRefusalV1();
    const fd=owner.open(current,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);
    const opened=fs.fstatSync(fd,{bigint:true});
    if(!probeDirectoryShapeV1(opened)||!sameProbeDirectoryV1(first,opened))throw probeOwnerRefusalV1();
    ancestors.push({locator:current,first,fd});
    if(current===path.dirname(current))break;
  }
  const first=fs.lstatSync(locator,{bigint:true}),uid=process.getuid();
  if(!probeIntegerV1(uid,0)||!first.isFile()||first.isSymbolicLink()||first.nlink!==1n
    ||first.size<0n||first.size>BigInt(cap)||(first.mode&0o022n)!==0n
    ||(first.uid!==BigInt(uid)&&(kind!=='executable'||first.uid!==0n)))throw probeOwnerRefusalV1();
  const fd=owner.open(locator,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  const metadata=()=>{
    owner.guard();
    if(fs.realpathSync(locator)!==locator)throw probeOwnerRefusalV1();
    for(const ancestor of ancestors){
      const named=fs.lstatSync(ancestor.locator,{bigint:true}),held=fs.fstatSync(ancestor.fd,{bigint:true});
      if(!probeDirectoryShapeV1(named)||!probeDirectoryShapeV1(held)
        ||!sameProbeDirectoryV1(ancestor.first,named)||!sameProbeDirectoryV1(ancestor.first,held)
        ||fs.realpathSync(ancestor.locator)!==ancestor.locator)throw probeOwnerRefusalV1();
    }
    const named=fs.lstatSync(locator,{bigint:true}),held=fs.fstatSync(fd,{bigint:true});
    if(!named.isFile()||named.isSymbolicLink()||!held.isFile()||held.isSymbolicLink()
      ||!sameProbeFileV1(first,named)||!sameProbeFileV1(first,held))throw probeOwnerRefusalV1();
  };
  const readHash=()=>{
    metadata();const hash=createHash('sha256'),size=Number(first.size);
    const bytes=Buffer.alloc(Math.min(size,65536));let position=0;
    while(position<size){
      const wanted=Math.min(bytes.length,size-position),count=fs.readSync(fd,bytes,0,wanted,position);
      if(!Number.isSafeInteger(count)||count<1||count>wanted)throw probeOwnerRefusalV1();
      hash.update(bytes.subarray(0,count));position+=count;
    }
    metadata();return hash.digest('hex');
  };
  const hash=readHash();
  return {hash,check(){if(readHash()!==hash)throw probeOwnerRefusalV1();}};
}

function probeSourceLocatorsV1(){
  const helper=fileURLToPath(import.meta.url),root=path.resolve(path.dirname(helper),'../../..');
  if(helper!==path.join(root,'tests','execution-attempts','helpers','manual-control-orphan-bootstrap-child-v1.mjs')){
    throw probeOwnerRefusalV1();
  }
  return {helper,issuer:path.join(root,'scripts','__tests__','manual-orphan-bootstrap-owned-route-v1.test.js')};
}

export function pinManualOrphanProbeSourcesV1(){
  const owner=probeDescriptorOwnerV1();
  try{
    const locators=probeSourceLocatorsV1();
    const helper=pinProbeFileV1(locators.helper,16777216,'source',owner);
    const issuer=pinProbeFileV1(locators.issuer,16777216,'source',owner);
    const check=()=>{
      try{owner.guard();helper.check();issuer.check();}
      catch{owner.close();throw probeOwnerRefusalV1();}
    };
    check();
    return Object.freeze({
      hashes:Object.freeze({helperSha256:helper.hash,issuerTestSha256:issuer.hash}),
      check,close(){owner.close();},
    });
  }catch{
    owner.close();throw probeOwnerRefusalV1();
  }
}

function readProbePsV1(args){
  const result=spawnSync('/bin/ps',args,{encoding:'utf8',timeout:2000,maxBuffer:16384,
    env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TZ:'UTC'}});
  if(result.error!=null||result.status!==0||result.signal!==null||result.stderr!==''
    ||typeof result.stdout!=='string'||Buffer.byteLength(result.stdout,'utf8')>16384)throw probeOwnerRefusalV1();
  return result.stdout;
}

function parseProbeProcessV1(pid,before,comm,after){
  if(before!==after)throw probeOwnerRefusalV1();
  const row=/^[ \t]*(\d+)[ \t]+(\d+)[ \t]+(\d+)[ \t]+([A-Z][a-z]{2} [A-Z][a-z]{2}[ \t]+\d{1,2} \d\d:\d\d:\d\d \d{4})[ \t]+(\d+)[ \t]+([^\r\n]+)\n$/.exec(before);
  const command=/^([^\r\n]+)\n$/.exec(comm);
  if(!row||row[0]!==before||!command||command[0]!==comm||Number(row[1])!==pid
    ||!probeExecutableV1(command[1]))throw probeOwnerRefusalV1();
  const ppid=Number(row[2]),uid=Number(row[3]),pgid=Number(row[5]);
  if(!probeIntegerV1(ppid,1)||!probeIntegerV1(uid,0)||!probeIntegerV1(pgid,1))throw probeOwnerRefusalV1();
  const date=/^([A-Z][a-z]{2}) ([A-Z][a-z]{2})[ \t]+(\d{1,2}) (\d\d):(\d\d):(\d\d) (\d{4})$/.exec(row[4]);
  if(!date)throw probeOwnerRefusalV1();
  const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(date[2]);
  const day=Number(date[3]),hour=Number(date[4]),minute=Number(date[5]),second=Number(date[6]),year=Number(date[7]);
  if(month<0||year<1970||day<1||day>31||hour>23||minute>59||second>59)throw probeOwnerRefusalV1();
  const actual=new Date(Date.UTC(year,month,day,hour,minute,second));
  if(actual.getUTCFullYear()!==year||actual.getUTCMonth()!==month||actual.getUTCDate()!==day
    ||['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][actual.getUTCDay()]!==date[1])throw probeOwnerRefusalV1();
  return {ppid,uid,pgid,startedAtUTC:actual.toISOString(),executable:command[1],rawCommand:row[6]};
}

export function observeManualOrphanProcessV1(pid){
  if(!probeIntegerV1(pid,1))throw probeOwnerRefusalV1();
  const owner=probeDescriptorOwnerV1();
  try{
    const args=['-ww','-p',String(pid),'-o','pid=','-o','ppid=','-o','uid=','-o','lstart=','-o','pgid=','-o','args='];
    const before=readProbePsV1(args),comm=readProbePsV1(['-ww','-p',String(pid),'-o','comm=']),after=readProbePsV1(args);
    const facts=parseProbeProcessV1(pid,before,comm,after);
    // This path comes only from the independent ps comm observation, never a frame.
    const executable=pinProbeFileV1(facts.executable,536870912,'executable',owner);
    executable.check();
    const pin=Object.freeze({pid,ppid:facts.ppid,uid:facts.uid,pgid:facts.pgid,
      startedAtUTC:facts.startedAtUTC,executable:facts.executable,executableSha256:executable.hash,
      commandSha256:createHash('sha256').update(facts.rawCommand,'utf8').digest('hex')});
    const result=Object.freeze({pin,rawCommand:facts.rawCommand});
    owner.close();return result;
  }catch{
    owner.close();throw probeOwnerRefusalV1();
  }
}

const PROBE_EMPTY_OUTPUT_SHA256_V1='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export function observeManualOrphanOriginalChildV1(child){
  let state='pending',reason=null,exit=null,close=null,exitCount=0,closeCount=0,spawned=false;
  let timer=null,timerCleared=false,historyResolved=false,resolveHistory;
  const settled=new Promise(resolve=>{resolveHistory=resolve;});
  const makeOutput=()=>({bytes:0,hash:null,end:false,close:false,chunks:[],retained:0});
  const stdout=makeOutput(),stderr=makeOutput(),fd4={finish:false,end:false,close:false};
  const outputFact=channel=>Object.freeze({bytes:channel.bytes,
    sha256:channel.hash?channel.hash.copy().digest('hex'):PROBE_EMPTY_OUTPUT_SHA256_V1,
    end:channel.end,close:channel.close});
  const snapshot=()=>Object.freeze({state,
    exit:exit===null?null:Object.freeze({...exit}),close:close===null?null:Object.freeze({...close}),
    stdout:outputFact(stdout),stderr:outputFact(stderr),fd4:Object.freeze({...fd4}),reason});
  const clearOwnedTimer=()=>{
    if(timer!==null&&!timerCleared){
      timerCleared=true;
      try{clearTimeout(timer);}catch{state='unknown';if(reason===null)reason='binding';}
    }
  };
  const settle=()=>{
    if(state==='pending'&&exitCount===1&&closeCount===1&&exit!==null&&close!==null
      &&stdout.end&&stdout.close&&stderr.end&&stderr.close&&fd4.finish&&fd4.end&&fd4.close){
      state='observed';
    }
    if(state!=='pending'&&!historyResolved){
      historyResolved=true;clearOwnedTimer();resolveHistory(snapshot());
    }
  };
  const fail=code=>{
    if(state!=='unknown'){state='unknown';reason=code;}
    settle();
  };
  const eventValue=(code,signal)=>({
    code:typeof code==='number'&&Number.isFinite(code)?code:null,
    signal:typeof signal==='string'?signal:null,
  });
  const normalExit=(code,signal)=>Number.isSafeInteger(code)&&code>=0&&signal===null;
  const witness=Object.freeze({settled,snapshot,output(){
    return {stdout:Buffer.concat(stdout.chunks,stdout.retained),stderr:Buffer.concat(stderr.chunks,stderr.retained)};
  }});

  // Bind the given original before reading streams or creating hashes/timers.
  try{
    if(child===null||typeof child!=='object'||typeof child.on!=='function'){
      fail('binding');return witness;
    }
    child.on('spawn',()=>{spawned=true;});
    child.on('error',()=>{fail(spawned?'child-error':'spawn-error');});
    child.on('exit',(code,signal)=>{
      exitCount++;
      if(exit===null)exit=eventValue(code,signal);
      if(exitCount!==1||closeCount!==0||!normalExit(code,signal))fail('exit-close');
      settle();
    });
    child.on('close',(code,signal)=>{
      closeCount++;
      if(close===null)close=eventValue(code,signal);
      if(closeCount!==1||exitCount!==1||!normalExit(code,signal)
        ||exit===null||exit.code!==code||exit.signal!==signal)fail('exit-close');
      settle();
    });
  }catch{fail('binding');return witness;}

  const streams={stdout:null,stderr:null,fd4:null};
  // Each inspection is independent: a missing channel must not prevent binding
  // and bounded draining of the other channels after UNKNOWN has been recorded.
  try{streams.stdout=child.stdout;}catch{fail('binding');}
  if(streams.stdout==null)fail('stdout');
  try{streams.stderr=child.stderr;}catch{fail('binding');}
  if(streams.stderr==null)fail('stderr');
  try{
    const stdio=child.stdio;
    if(!Array.isArray(stdio))fail('binding');
    else streams.fd4=stdio[4];
  }catch{fail('binding');}
  if(streams.fd4==null)fail('fd4');

  const present=[];
  const attachOutput=(name,channel,stream)=>{
    stream.on('error',()=>{fail(name);});
    stream.on('end',()=>{
      const invalid=channel.end||channel.close;channel.end=true;
      if(invalid)fail(name);settle();
    });
    stream.on('close',()=>{
      const invalid=channel.close||!channel.end;channel.close=true;
      if(invalid)fail(name);settle();
    });
  };
  for(const name of ['stdout','stderr','fd4']){
    const stream=streams[name];if(stream==null)continue;
    try{
      if(typeof stream.on!=='function'||typeof stream.pause!=='function'||typeof stream.resume!=='function'){
        fail('binding');continue;
      }
      if(name!=='fd4')attachOutput(name,name==='stdout'?stdout:stderr,stream);
      else{
        stream.on('error',()=>{fail('fd4');});
        stream.on('finish',()=>{const invalid=fd4.finish||fd4.close;fd4.finish=true;if(invalid)fail('fd4');settle();});
        stream.on('end',()=>{const invalid=fd4.end||fd4.close;fd4.end=true;if(invalid)fail('fd4');settle();});
        stream.on('close',()=>{
          const invalid=fd4.close||!fd4.finish||!fd4.end;fd4.close=true;if(invalid)fail('fd4');settle();
        });
      }
      present.push({name,stream});
    }catch{fail('binding');}
  }
  // Pause before adding data listeners (Readable.on('data') otherwise resumes).
  // All channel handlers are installed before any deliberate readable resume.
  for(const {name,stream} of present){try{stream.pause();}catch{fail(name);}}
  for(const {name,stream} of present){
    try{
      if(name==='fd4')stream.on('data',()=>{fail('fd4');});
      else{
        const channel=name==='stdout'?stdout:stderr;
        stream.on('data',chunk=>{
          if(!Buffer.isBuffer(chunk)){fail(name);return;}
          let invalid=channel.end||channel.close;
          channel.bytes+=chunk.length;
          try{if(channel.hash)channel.hash.update(chunk);}catch{channel.hash=null;invalid=true;}
          const count=Math.min(65536-channel.retained,chunk.length);
          if(count>0){channel.chunks.push(Buffer.from(chunk.subarray(0,count)));channel.retained+=count;}
          if(invalid)fail(name);
          if(channel.bytes>65536)fail('limit');
        });
      }
    }catch{fail('binding');}
  }
  try{stdout.hash=createHash('sha256');stderr.hash=createHash('sha256');}catch{fail('binding');}
  if(state==='pending'){
    try{timer=setTimeout(()=>{fail('deadline');},10000);}catch{fail('binding');}
    if(state!=='pending')clearOwnedTimer();
  }
  for(const {name,stream} of present){try{stream.resume();}catch{fail(name);}}
  settle();return witness;
}
