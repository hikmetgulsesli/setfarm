import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {chmodSync,closeSync,constants,existsSync,fstatSync,lstatSync,mkdtempSync,
  openSync,readFileSync,symlinkSync,writeFileSync} from 'node:fs';
import {Writable} from 'node:stream';
import test from 'node:test';

const MODULE=new URL('../private-postgres-test-journal-v1.mjs',import.meta.url);
async function implementation(){
  assert.ok(existsSync(MODULE),'private test journal implementation missing');
  return import(MODULE.href);
}
const ROOT='/tmp/setfarm-task6a-pg.Abc123';
const terminal=code=>({outcome:'observed',testCode:code,privateDbQuiescent:true,
  adminEnded:true,serverClosed:true,productionAuthority:false});
const control=(stage,fields={})=>({kind:'control',payload:{stage,...fields,productionAuthority:false}});
function prefix(root=ROOT,code=0){
  const lifecycle=(role,pid,code)=>[
    control('child-exit',{childRole:role,pid,code,signal:null}),
    control('stream-end',{childRole:role,channel:'stdout'}),
    control('stream-end',{childRole:role,channel:'stderr'}),
    control('child-close',{childRole:role,pid,code,signal:null}),
  ];
  return [control('journal-opened',{root}),control('port-reservation'),
    control('password-create'),control('private-root-retained',{root,port:55439}),
    control('initdb'),...lifecycle('initdb',101,0),control('server-start'),
    control('identity'),control('identity-verified',{root,port:55439,serverPid:102}),
    control('test-graph'),...lifecycle('test',103,code),control('private-db-quiescence'),
    control('quiescence-sample',{sample:0,passed:true}),
    control('quiescence-sample',{sample:1,passed:true}),
    control('direct-test-child-closed',{code,privateDbQuiescent:true}),
    control('admin-close'),control('admin-ended'),control('server-close'),
    ...lifecycle('server',102,0),
    control('server-definitely-closed',{root,port:55439,code,retained:true})];
}
// Independent literal wire encoder: no production helper creates expectations.
function wire(records){
  return Buffer.concat(records.map((record,index)=>{
    const payload=Buffer.isBuffer(record.payload)?record.payload:Buffer.from(JSON.stringify(record.payload));
    return Buffer.from(JSON.stringify({version:1,sequence:index+1,kind:record.kind,
      role:record.role??null,channel:record.channel??null,byteLength:payload.length,
      sha256:createHash('sha256').update(payload).digest('hex'),payloadBase64:payload.toString('base64')})+'\n');
  }));
}
function ownedRoot(){
  const root=mkdtempSync('/tmp/setfarm-task6a-pg.');chmodSync(root,0o700);
  return {root,fd:openSync(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW)};
}
function replay(writer,records){
  for(const record of records)assert.equal(writer.control(record.payload.stage,
    Object.fromEntries(Object.entries(record.payload).filter(([key])=>!['stage','productionAuthority'].includes(key)))),true);
}
async function read(bytes,chunks=false){
  const {createPrivateTestJournalReaderV1:create}=await implementation();
  const reader=create(),records=[];
  if(chunks)for(const byte of bytes)records.push(...reader.write(Buffer.from([byte])));
  else for(let offset=0;offset<bytes.length;offset+=65536)records.push(...reader.write(bytes.subarray(offset,offset+65536)));
  return {records,result:reader.end()};
}

test('actual journal persists exact binary frames and never owns the directory FD',async()=>{
  const {createPrivateTestJournalV1:create}=await implementation();
  const {root,fd}=ownedRoot();let journal;
  try{
    journal=create(root,fd);
    assert.equal(journal.control('journal-opened',{root}),true);
    assert.equal(journal.control('initdb'),true);
    assert.equal(journal.output('initdb','stdout',Buffer.from([0,255,10])),true);
    const expected=wire([control('journal-opened',{root}),control('initdb'),
      {kind:'output',role:'initdb',channel:'stdout',payload:Buffer.from([0,255,10])}]);
    assert.deepEqual(readFileSync(root+'/transcript.journal'),expected);
    const stat=lstatSync(root+'/transcript.journal');
    assert.equal(stat.mode&0o777,0o600);assert.equal(stat.uid,501);assert.equal(stat.nlink,1);
    const {records,result}=await read(expected,true);
    assert.deepEqual(records[2].payload,Buffer.from([0,255,10]));
    assert.equal(result.incomplete,true);assert.equal(result.terminalObserved,false);
    assert.equal(journal.close(),true);assert.equal(fstatSync(fd).isDirectory(),true);
  }finally{journal?.close();closeSync(fd);}
});
for(const existing of ['file','symlink'])test('exclusive journal refuses an existing '+existing+' without overwriting',async()=>{
  const {createPrivateTestJournalV1:create}=await implementation();
  const {root,fd}=ownedRoot(),target=root+'/retained';
  try{
    writeFileSync(target,'preserved');
    if(existing==='file')writeFileSync(root+'/transcript.journal','original');
    else symlinkSync(target,root+'/transcript.journal');
    assert.throws(()=>create(root,fd),/^Error: PRIVATE_TEST_JOURNAL_REFUSED$/);
    assert.equal(readFileSync(target,'utf8'),'preserved');
    assert.equal(readFileSync(root+'/transcript.journal','utf8'),existing==='file'?'original':'preserved');
    assert.equal(fstatSync(fd).isDirectory(),true);
  }finally{closeSync(fd);}
});
test('journal file mode drift stops writes yet closes only its owned FD',async()=>{
  const {createPrivateTestJournalV1:create}=await implementation();
  const {root,fd}=ownedRoot();const journal=create(root,fd);
  try{
    assert.equal(journal.control('journal-opened',{root}),true);
    const before=readFileSync(root+'/transcript.journal');
    chmodSync(root+'/transcript.journal',0o644);
    assert.equal(journal.control('initdb'),false);assert.equal(journal.healthy,false);
    assert.equal(journal.close(),false);assert.equal(journal.close(),false);
    assert.deepEqual(readFileSync(root+'/transcript.journal'),before);
    assert.equal(fstatSync(fd).isDirectory(),true);
  }finally{journal.close();closeSync(fd);}
});
for(const code of [0,7])test('positive terminal retains actual normal test code '+code+' without future exit claims',async()=>{
  const {createPrivateTestJournalV1:create}=await implementation();
  const {root,fd}=ownedRoot();const journal=create(root,fd);
  try{
    replay(journal,prefix(root,code));assert.equal(journal.finish(terminal(code)),true);
    assert.equal(journal.output('test','stdout',Buffer.from('late')),false);
    const {result}=await read(readFileSync(root+'/transcript.journal'),true);
    assert.equal(result.incomplete,false);assert.equal(result.terminalObserved,true);
    assert.deepEqual(result.terminal,terminal(code));
    assert.equal(Object.hasOwn(result,'wrapperExited'),false);
    assert.equal(journal.close(),true);
  }finally{journal.close();closeSync(fd);}
});
test('completeness burn retains refusal recording but never revives positive eligibility',async()=>{
  const {createPrivateTestJournalV1:create}=await implementation();
  const {root,fd}=ownedRoot();const journal=create(root,fd);
  try{
    replay(journal,prefix(root));assert.equal(journal.burn('journal-input'),false);
    assert.equal(journal.healthy,false);assert.equal(journal.finish(terminal(0)),false);
    assert.equal(journal.finish({outcome:'refused',reason:'journal-input',productionAuthority:false}),true);
    const {result}=await read(readFileSync(root+'/transcript.journal'));
    assert.equal(result.terminalObserved,true);assert.equal(result.incomplete,true);
    assert.equal(journal.close(),false);
  }finally{journal.close();closeSync(fd);}
});

for(const [label,change] of [
  ['missing exit',r=>r.filter(x=>!(x.payload.stage==='child-exit'&&x.payload.childRole==='test'))],
  ['missing close',r=>r.filter(x=>!(x.payload.stage==='child-close'&&x.payload.childRole==='test'))],
  ['missing EOF',r=>r.filter(x=>!(x.payload.stage==='stream-end'&&x.payload.childRole==='test'&&x.payload.channel==='stderr'))],
  ['early samples',r=>{const samples=r.filter(x=>x.payload.stage==='quiescence-sample');
    const rest=r.filter(x=>x.payload.stage!=='quiescence-sample');rest.splice(13,0,...samples);return rest;}],
  ['sample order',r=>{const i=r.findIndex(x=>x.payload.stage==='quiescence-sample');[r[i],r[i+1]]=[r[i+1],r[i]];return r;}],
  ['early admin end',r=>{const i=r.findIndex(x=>x.payload.stage==='admin-ended');r.splice(13,0,...r.splice(i,1));return r;}],
  ['early server exit',r=>{const i=r.findIndex(x=>x.payload.stage==='child-exit'&&x.payload.childRole==='server');r.splice(13,0,...r.splice(i,1));return r;}],
  ['duplicate close',r=>{const i=r.findIndex(x=>x.payload.stage==='child-close'&&x.payload.childRole==='test');r.splice(i,0,r[i]);return r;}],
  ['disagreeing PID',r=>{r.find(x=>x.payload.stage==='child-close'&&x.payload.childRole==='test').payload.pid=999;return r;}],
  ['nonzero initdb',r=>{for(const x of r)if(x.payload.childRole==='initdb'&&x.payload.code!==undefined)x.payload.code=1;return r;}],
  ['child error',r=>{r.splice(14,0,control('child-error',{childRole:'test',reason:'PRIVATE_TEST_CLUSTER_REFUSED'}));return r;}],
  ['output after EOF',r=>{r.push({kind:'output',role:'test',channel:'stdout',payload:Buffer.from('late')});return r;}],
])test('reader refuses positive observations after '+label+' despite coherent digests',async()=>{
  const records=change(prefix());records.push({kind:'terminal',payload:terminal(0)});
  const {result}=await read(wire(records));assert.equal(result.incomplete,true);
  assert.equal(result.terminalObserved,false);
});
test('reader accepts EOF before exit but never before that role dispatch intent',async()=>{
  const records=prefix();const index=records.findIndex(r=>r.payload.stage==='child-exit'&&r.payload.childRole==='test');
  [records[index],records[index+1],records[index+2]]=[records[index+1],records[index+2],records[index]];
  records.push({kind:'terminal',payload:terminal(0)});
  assert.equal((await read(wire(records),true)).result.incomplete,false);
});
for(const [label,mutate] of [
  ['sequence',o=>({...o,sequence:2})],['digest',o=>({...o,sha256:'0'.repeat(64)})],
  ['length',o=>({...o,byteLength:o.byteLength+1})],['base64',o=>({...o,payloadBase64:o.payloadBase64+'='})],
  ['extra key',o=>({...o,authority:true})],['unknown kind',o=>({...o,kind:'receipt'})],
  ['noncanonical keys',o=>({sequence:o.sequence,version:o.version,...Object.fromEntries(Object.entries(o).slice(2))})],
])test('reader rejects malformed '+label+' framing at the first consumer',async()=>{
  const line=wire([control('journal-opened',{root:ROOT})]).toString();
  const {result}=await read(Buffer.from(JSON.stringify(mutate(JSON.parse(line)))+'\n'));
  assert.equal(result.incomplete,true);assert.equal(result.validatedPrefix,0);
});
test('reader rejects truncated terminal and any suffix following a sealed terminal',async()=>{
  const bytes=wire([...prefix(),{kind:'terminal',payload:terminal(0)}]);
  assert.equal((await read(bytes.subarray(0,-1))).result.incomplete,true);
  assert.equal((await read(Buffer.concat([bytes,Buffer.from('x')]))).result.incomplete,true);
  const {createPrivateTestJournalReaderV1:create}=await implementation();
  const reader=create();assert.deepEqual(reader.write(Buffer.alloc(131073)),[]);
  assert.equal(reader.end().incomplete,true);
  const beginning=wire(prefix()),tail=bytes.subarray(beginning.length);
  for(let length=0;length<tail.length;length++){
    const truncated=create();truncated.write(beginning);truncated.write(tail.subarray(0,length));
    assert.equal(truncated.end().incomplete,true,'terminal prefix length '+length);
  }
});
test('control schema refuses unknown reason text instead of persisting arbitrary errors',async()=>{
  const {createPrivateTestJournalV1:create}=await implementation();
  const {root,fd}=ownedRoot();const journal=create(root,fd);
  try{
    journal.control('journal-opened',{root});
    assert.equal(journal.control('child-error',{childRole:'test',reason:'PRIVATE_TEST_CLUSTER_SECRET-do-not-log'}),false);
    assert.equal(readFileSync(root+'/transcript.journal','utf8').includes('SECRET'),false);
    assert.equal(journal.healthy,false);
  }finally{journal.close();closeSync(fd);}
});
test('mirror handles asynchronous terminal error and disables display once without child effects',async()=>{
  const {createPrivateTestTerminalMirrorV1:create}=await implementation();
  const stream=new EventEmitter(),calls=[],unavailable=[];
  stream.write=buffer=>{calls.push(Buffer.from(buffer));return true;};
  const mirror=create(stream,reason=>unavailable.push(reason));
  assert.equal(mirror.write(Buffer.from('first')),true);
  assert.doesNotThrow(()=>stream.emit('error',Error('raw secret EPIPE')));
  stream.emit('close');stream.emit('error',Error('again'));
  assert.equal(mirror.write(Buffer.from('late')),false);
  assert.deepEqual(calls,[Buffer.from('first')]);assert.deepEqual(unavailable,['mirror-error']);
});
test('real Writable backpressure disables only the mirror without an unbounded retry queue',async()=>{
  const {createPrivateTestTerminalMirrorV1:create}=await implementation();const unavailable=[];
  const stream=new Writable({highWaterMark:1,write(_chunk,_encoding,callback){setImmediate(callback);}});
  const mirror=create(stream,reason=>unavailable.push(reason));
  assert.equal(mirror.write(Buffer.alloc(2)),false);
  assert.equal(mirror.write(Buffer.alloc(2)),false);
  assert.deepEqual(unavailable,['mirror-backpressure']);stream.destroy();
});

for(const fields of [{stage:'server-start'},{productionAuthority:true}]){
  test('control rejects reserved caller fields rather than replacing their meaning '+Object.keys(fields),async()=>{
    const {createPrivateTestJournalV1:create}=await implementation();
    const {root,fd}=ownedRoot();const journal=create(root,fd);
    try{
      journal.control('journal-opened',{root});const before=readFileSync(root+'/transcript.journal');
      assert.equal(journal.control('initdb',fields),false);
      assert.deepEqual(readFileSync(root+'/transcript.journal'),before);
      assert.equal(journal.healthy,false);
    }finally{journal.close();closeSync(fd);}
  });
}
for(const method of ['control','finish'])test('post-creation '+method+' input failure never throws from a child callback',async()=>{
  const {createPrivateTestJournalV1:create}=await implementation();
  const {root,fd}=ownedRoot();const journal=create(root,fd);
  const input=method==='control'?{get stage(){throw Error('private input');}}:
    {get outcome(){throw Error('private input');}};
  try{
    assert.doesNotThrow(()=>assert.equal(method==='control'?journal.control('initdb',input):journal.finish(input),false));
    assert.equal(journal.healthy,false);assert.equal(lstatSync(root+'/transcript.journal').size,0);
  }finally{journal.close();closeSync(fd);}
});

for(const mode of ['construct-fstat','construct-fsync','construct-mode-drift','write-short','write-eintr','frame-fsync','close-terminal']){
  test('actual owned journal '+mode+' fault retains evidence and never retries ambiguous closure',async()=>{
    await implementation();
    const code=`
import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
const mode=${JSON.stringify(mode)},original={...fs};let owned=null,closes=0,armed=false;
fs.openSync=(pathname,...args)=>{const fd=original.openSync(pathname,...args);
  if(String(pathname).endsWith('/transcript.journal'))owned=fd;return fd;};
fs.closeSync=fd=>{if(fd===owned){closes++;if(mode==='close-terminal'&&armed){original.closeSync(fd);throw Error('raw secret close');}}
  return original.closeSync(fd);};
fs.fstatSync=fd=>{if(fd===owned&&mode==='construct-fstat')throw Error('raw secret stat');return original.fstatSync(fd);};
fs.fsyncSync=fd=>{if(fd===owned&&(mode==='construct-fsync'||(mode==='frame-fsync'&&armed)))throw Error('raw secret sync');
  const result=original.fsyncSync(fd);
  if(mode==='construct-mode-drift'&&fd!==owned&&owned!==null)original.fchmodSync(owned,0o644);
  return result;};
fs.writeSync=(fd,buffer,offset,length,position)=>{
  if(fd===owned&&armed&&['write-short','write-eintr'].includes(mode)){
    const count=original.writeSync(fd,buffer,offset,Math.floor(length/2),position);
    if(mode==='write-eintr')throw Object.assign(Error('raw secret interrupt'),{code:'EINTR'});return count;
  }return original.writeSync(fd,buffer,offset,length,position);
};syncBuiltinESMExports();
const {createPrivateTestJournalV1:create,createPrivateTestJournalReaderV1:readerCreate}=await import(${JSON.stringify(MODULE.href)});
const root=original.mkdtempSync('/tmp/setfarm-task6a-pg.');original.chmodSync(root,0o700);
const directory=original.openSync(root,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);
let journal=null,refused=false,operation=null,close1=null,close2=null;
try{journal=create(root,directory);}catch(error){refused=error.message==='PRIVATE_TEST_JOURNAL_REFUSED';}
if(journal){
  if(mode==='close-terminal'){
    const control=${control.toString()},prefix=${prefix.toString()};
    for(const record of prefix(root,0))journal.control(record.payload.stage,
      Object.fromEntries(Object.entries(record.payload).filter(([key])=>!['stage','productionAuthority'].includes(key))));
    operation=journal.finish(${JSON.stringify(terminal(0))});armed=true;
  }else{armed=true;operation=journal.control('journal-opened',{root});}
  close1=journal.close();close2=journal.close();
}
for(const key of ['openSync','closeSync','fstatSync','fsyncSync','writeSync'])fs[key]=original[key];
syncBuiltinESMExports();
const reader=readerCreate(),bytes=original.readFileSync(root+'/transcript.journal');
for(let offset=0;offset<bytes.length;offset+=65536)reader.write(bytes.subarray(offset,offset+65536));
const result={refused,operation,close1,close2,closes,rootUsable:original.fstatSync(directory).isDirectory(),
  healthy:journal?.healthy??false,reader:reader.end(),bytes:bytes.length};
original.closeSync(directory);console.log(JSON.stringify(result));`;
    const result=spawnSync(process.execPath,['--input-type=module','-e',code],{
      encoding:'utf8',timeout:5000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
    });
    assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,0,result.stderr);
    const observed=JSON.parse(result.stdout);
    assert.equal(observed.rootUsable,true);assert.equal(observed.closes,1);assert.equal(observed.healthy,false);
    if(mode.startsWith('construct-')){
      assert.equal(observed.refused,true);assert.equal(observed.bytes,0);
    }else{
      assert.equal(observed.close1,false);assert.equal(observed.close2,false);
      assert.equal(observed.operation,mode==='close-terminal');
    }
    assert.equal(observed.reader.incomplete,mode!=='close-terminal');
    if(mode==='frame-fsync')assert.equal(observed.reader.validatedPrefix,1,'complete bytes do not prove fsync');
    if(mode==='close-terminal')assert.equal(observed.reader.terminalObserved,true,'record cannot prove future FD close');
    assert.doesNotMatch(result.stdout+result.stderr,/raw secret/);
  });
}

for(const [label,stage,fields] of [
  ['stage array',['initdb'],{}],
  ['signal array','child-exit',{childRole:'initdb',pid:101,code:null,signal:['SIGTERM']}],
  ['coercible signal','child-exit',{childRole:'initdb',pid:101,code:null,
    signal:{[Symbol.toPrimitive]:()=> 'SIGTERM',toJSON:()=> 'do-not-persist-secret'}}],
])test('literal schema refuses '+label+' without coercing or serializing secrets',async()=>{
  const {createPrivateTestJournalV1:create}=await implementation();
  const {root,fd}=ownedRoot();const journal=create(root,fd);
  try{
    journal.control('journal-opened',{root});const before=readFileSync(root+'/transcript.journal');
    assert.equal(journal.control(stage,fields),false);
    assert.deepEqual(readFileSync(root+'/transcript.journal'),before);
  }finally{journal.close();closeSync(fd);}
});

test('actual fsync intervals never accept more than 256KiB encoded output before checkpoint',async()=>{
  await implementation();
  const code=`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
const original={...fs};let owned=null,interval=0,max=0;
fs.openSync=(pathname,...args)=>{const fd=original.openSync(pathname,...args);
  if(String(pathname).endsWith('/transcript.journal'))owned=fd;return fd;};
fs.writeSync=(fd,buffer,...args)=>{const count=original.writeSync(fd,buffer,...args);
  if(fd===owned&&JSON.parse(buffer.toString()).kind==='output'){interval+=count;max=Math.max(max,interval);}return count;};
fs.fsyncSync=fd=>{const result=original.fsyncSync(fd);if(fd===owned)interval=0;return result;};
syncBuiltinESMExports();const {createPrivateTestJournalV1:create}=await import(${JSON.stringify(MODULE.href)});
const root=original.mkdtempSync('/tmp/setfarm-task6a-pg.');original.chmodSync(root,0o700);
const directory=original.openSync(root,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);
const journal=create(root,directory);journal.control('journal-opened',{root});journal.control('initdb');
for(const length of [60000,60000,60000,64000]){
  if(!journal.output('initdb','stdout',Buffer.alloc(length,97)))throw Error('write refused');
}const closed=journal.close();original.closeSync(directory);console.log(JSON.stringify({max,closed}));`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{
    encoding:'utf8',timeout:5000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
  });
  assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,0,result.stderr);
  const observed=JSON.parse(result.stdout);assert.equal(observed.closed,true);
  assert.ok(observed.max<=262144,'observed unsynced encoded bytes '+observed.max);
});

test('reader rejects coherent array stage and signal controls before accepting their facts',async()=>{
  for(const payload of [
    {stage:['child-error'],childRole:'test',reason:'PRIVATE_TEST_CLUSTER_REFUSED',productionAuthority:false},
    {stage:'child-exit',childRole:'initdb',pid:101,code:null,signal:['SIGTERM'],productionAuthority:false},
    {stage:'journal-opened',root:ROOT+'\n',productionAuthority:false},
  ]){
    const {result}=await read(wire([{kind:'control',payload}]));
    assert.equal(result.validatedPrefix,0);assert.equal(result.incomplete,true);
  }
});
test('creation refuses a newline-suffixed root even when a directory FD is valid',async()=>{
  const {createPrivateTestJournalV1:create}=await implementation();
  const {root,fd}=ownedRoot();
  try{
    assert.throws(()=>create(root+'\n',fd),/^Error: PRIVATE_TEST_JOURNAL_REFUSED$/);
    assert.equal(existsSync(root+'/transcript.journal'),false);
  }finally{closeSync(fd);}
});

test('large actual output is split into bounded frames without altering binary bytes',async()=>{
  const {createPrivateTestJournalV1:create}=await implementation();
  const {root,fd}=ownedRoot();const journal=create(root,fd),input=Buffer.alloc(131077,255);
  try{
    journal.control('journal-opened',{root});journal.control('initdb');
    assert.equal(journal.output('initdb','stderr',input),true);
    const {records}=await read(readFileSync(root+'/transcript.journal'));
    const output=records.filter(r=>r.kind==='output');assert.equal(output.length,3);
    assert.deepEqual(output.map(r=>r.payload.length),[65536,65536,5]);
    assert.deepEqual(Buffer.concat(output.map(r=>r.payload)),input);
    assert.equal(journal.close(),true);
  }finally{journal.close();closeSync(fd);}
});

// Scaled, IN-MEMORY clones exercise the actual cap branch; not a257MiB run.
test('scaled output cap retains reserved refusal space and its coherent bypass is detected',async()=>{
  await implementation();
  const source=readFileSync(MODULE,'utf8');
  assert.ok(source.includes('OUTPUT_CAP=256*1024*1024'));
  const scaled=source.replace('OUTPUT_CAP=256*1024*1024','OUTPUT_CAP=1024');
  const bypass=scaled.replace('outputSize+frame.length>OUTPUT_CAP','false')
    .replace('||outputSize+line.length+1>OUTPUT_CAP','');
  assert.notEqual(bypass,scaled);
  for(const [body,want] of [[scaled,false],[bypass,true]]){
    const {createPrivateTestJournalV1:create,createPrivateTestJournalReaderV1:createReader}=
      await import('data:text/javascript;base64,'+Buffer.from(body).toString('base64'));
    const {root,fd}=ownedRoot();const journal=create(root,fd);
    try{
      journal.control('journal-opened',{root});journal.control('initdb');
      assert.equal(journal.output('initdb','stdout',Buffer.alloc(400,97)),true);
      assert.equal(journal.output('initdb','stdout',Buffer.alloc(400,97)),want);
      assert.equal(journal.finish({outcome:'refused',reason:'journal-limit',productionAuthority:false}),true);
      const reader=createReader();reader.write(readFileSync(root+'/transcript.journal'));
      const result=reader.end();assert.equal(result.terminalObserved,true);assert.equal(result.incomplete,true);
      assert.equal(result.validatedPrefix,want?5:4);
      if(!want)assert.equal(journal.healthy,false);
    }finally{journal.close();closeSync(fd);}
  }
  const records=[control('journal-opened',{root:ROOT}),control('initdb'),
    ...[1,2].map(()=>({kind:'output',role:'initdb',channel:'stdout',payload:Buffer.alloc(400,97)}))];
  const {createPrivateTestJournalReaderV1:createReader}=await import('data:text/javascript;base64,'+Buffer.from(scaled).toString('base64'));
  const reader=createReader();reader.write(wire(records));assert.equal(reader.end().validatedPrefix,3);
});
test('every split of a binary output frame yields the same bounded validated record',async()=>{
  const {createPrivateTestJournalReaderV1:create}=await implementation();
  const beginning=wire([control('journal-opened',{root:ROOT}),control('initdb')]);
  const payload=Buffer.from([0,255,10,195,169]),frame=wire([
    control('journal-opened',{root:ROOT}),control('initdb'),
    {kind:'output',role:'initdb',channel:'stdout',payload},
  ]).subarray(beginning.length);
  for(let split=0;split<=frame.length;split++){
    const reader=create();reader.write(beginning);
    const records=[...reader.write(frame.subarray(0,split)),...reader.write(frame.subarray(split))];
    assert.equal(records.length,1);assert.deepEqual(records[0].payload,payload);
    assert.equal(reader.end().validatedPrefix,3);
  }
});

for(const [label,from,to] of [
  ['control bytes','CONTROL_CAP=1024*1024','CONTROL_CAP=1024'],
  ['frame count','SEQUENCE_MAX=1000000','SEQUENCE_MAX=3'],
])test('scaled '+label+' bounds reject further records without repairing the prefix',async()=>{
  await implementation();const source=readFileSync(MODULE,'utf8');assert.ok(source.includes(from));
  const {createPrivateTestJournalV1:create,createPrivateTestJournalReaderV1:createReader}=
    await import('data:text/javascript;base64,'+Buffer.from(source.replace(from,to)).toString('base64'));
  const {root,fd}=ownedRoot(),journal=create(root,fd);let accepted=0;
  try{
    assert.equal(journal.control('journal-opened',{root}),true);accepted++;
    for(let i=0;i<8;i++){
      if(!journal.control('terminal-unavailable',{channel:'stdout',reason:'mirror-close'}))break;
      accepted++;
    }
    assert.ok(accepted>=2&&accepted<9);assert.equal(journal.healthy,false);
    assert.equal(journal.finish({outcome:'refused',reason:'journal-limit',productionAuthority:false}),false);
    const reader=createReader();reader.write(readFileSync(root+'/transcript.journal'));
    assert.equal(reader.end().validatedPrefix,accepted);
    const overflow=createReader(),records=[control('journal-opened',{root}),
      ...Array.from({length:8},()=>control('terminal-unavailable',{channel:'stdout',reason:'mirror-close'}))];
    overflow.write(wire(records));assert.equal(overflow.end().validatedPrefix,accepted);
  }finally{journal.close();closeSync(fd);}
});
test('terminal mirror synchronous throw and close never escape or restart display',async()=>{
  const {createPrivateTestTerminalMirrorV1:create}=await implementation();
  for(const mode of ['throw','close']){
    const stream=new EventEmitter(),unavailable=[];let writes=0;
    stream.write=()=>{writes++;if(mode==='throw')throw Error('must-not-log');return true;};
    const mirror=create(stream,reason=>{unavailable.push(reason);throw Error('callback failure');});
    if(mode==='close')stream.emit('close');
    assert.doesNotThrow(()=>assert.equal(mirror.write(Buffer.from('first')),false));
    stream.emit('error',Error('late'));assert.equal(mirror.write(Buffer.from('late')),false);
    assert.deepEqual(unavailable,[mode==='throw'?'mirror-throw':'mirror-close']);
    assert.equal(writes,mode==='throw'?1:0);
  }
});

test('failed-spawn null PID close is retained as diagnostic unknown, never invented normal closure',async()=>{
  const {createPrivateTestJournalV1:create}=await implementation();
  const {root,fd}=ownedRoot();const journal=create(root,fd);
  try{
    journal.control('journal-opened',{root});journal.control('initdb');
    journal.control('child-error',{childRole:'initdb',reason:'PRIVATE_TEST_CLUSTER_REFUSED'});
    assert.equal(journal.control('child-close',{childRole:'initdb',pid:null,code:-2,signal:null}),true);
    assert.equal(journal.healthy,false);assert.equal(journal.finish(terminal(0)),false);
    assert.equal(journal.finish({outcome:'refused',reason:'PRIVATE_TEST_CLUSTER_INIT_FAILED',productionAuthority:false}),true);
    const {records,result}=await read(readFileSync(root+'/transcript.journal'));
    assert.equal(result.incomplete,true);assert.equal(result.terminalObserved,true);
    assert.deepEqual(JSON.parse(records[3].payload),{stage:'child-close',childRole:'initdb',pid:null,
      code:-2,signal:null,productionAuthority:false});
  }finally{journal.close();closeSync(fd);}
});
