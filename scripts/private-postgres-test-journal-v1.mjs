import {createHash} from 'node:crypto';
import {closeSync,constants,fstatSync,fsyncSync,lstatSync,openSync,writeSync} from 'node:fs';
import {constants as osConstants} from 'node:os';

const FRAME_MAX=128*1024,OUTPUT_MAX=64*1024,OUTPUT_CAP=256*1024*1024;
const CONTROL_CAP=1024*1024,CHECKPOINT=256*1024,SEQUENCE_MAX=1000000;
const ROLES=['initdb','server','test'],CHANNELS=['stdout','stderr'];
const ROOT=/^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+$/;
const REASONS=new Set([
  'PRIVATE_TEST_CLUSTER_AMBIENT_PG_FORBIDDEN','PRIVATE_TEST_CLUSTER_HOST_INVALID',
  'PRIVATE_TEST_CLUSTER_DISK_LOW','PRIVATE_TEST_CLUSTER_SOURCE_DIRTY','PRIVATE_TEST_CLUSTER_TOOL_INVALID',
  'PRIVATE_TEST_CLUSTER_ROOT_CHANGED','PRIVATE_TEST_CLUSTER_PASSWORD_FILE_INVALID',
  'PRIVATE_TEST_CLUSTER_INIT_FAILED','PRIVATE_TEST_CLUSTER_SERVER_UNAVAILABLE',
  'PRIVATE_TEST_CLUSTER_IDENTITY_INVALID','PRIVATE_TEST_CLUSTER_READINESS_TIMEOUT',
  'PRIVATE_TEST_CLUSTER_TEST_CLOSE_UNCERTAIN','PRIVATE_TEST_CLUSTER_DB_CLEANUP_UNVERIFIED',
  'PRIVATE_TEST_CLUSTER_SERVER_CLOSE_UNCERTAIN','PRIVATE_TEST_CLUSTER_CANCELLED','PRIVATE_TEST_CLUSTER_DEADLINE',
  'PRIVATE_TEST_CLUSTER_REFUSED','PRIVATE_TEST_JOURNAL_REFUSED',
  'journal-io','journal-identity','journal-input','journal-limit','journal-framing','journal-order','journal-close',
  'mirror-error','mirror-backpressure','mirror-close','mirror-throw',
]);
const FIELDS={
  'journal-opened':['root'],'port-reservation':[],'password-create':[],
  'private-root-retained':['root','port'],'initdb':[],'server-start':[],'identity':[],
  'identity-verified':['root','port','serverPid'],'test-graph':[],
  'child-exit':['childRole','pid','code','signal'],'child-close':['childRole','pid','code','signal'],
  'child-error':['childRole','reason'],'stream-end':['childRole','channel'],
  'stream-error':['childRole','channel','reason'],'private-db-quiescence':[],
  'quiescence-sample':['sample','passed'],'direct-test-child-closed':['code','privateDbQuiescent'],
  'admin-close':[],'admin-ended':[],'server-close':[],
  'server-definitely-closed':['root','port','code','retained'],
  'terminal-unavailable':['channel','reason'],
  'refused':['operation','reason','root','testsStarted','serverClosed','retained'],
};
const OPERATIONS=new Set(['preconditions','create-private-root',...Object.keys(FIELDS)]);
const keysMatch=(object,keys)=>object!==null&&typeof object==='object'&&!Array.isArray(object)
  &&Object.keys(object).length===keys.length&&keys.every(key=>Object.hasOwn(object,key));
const validRoot=value=>typeof value==='string'&&value.length<=128&&ROOT.test(value);
const validCode=value=>value===null||(Number.isInteger(value)&&value>=-4095&&value<=255);
const normal=value=>value&&Number.isInteger(value.code)&&value.code>=0&&value.code<=255&&value.signal===null;
function validControl(value){
  if(!value||typeof value.stage!=='string'||!Object.hasOwn(FIELDS,value.stage)
    ||!keysMatch(value,['stage',...FIELDS[value.stage],'productionAuthority'])||value.productionAuthority!==false)return false;
  for(const [key,item] of Object.entries(value)){
    if(key==='root'&&!(validRoot(item)||(value.stage==='refused'&&item===null)))return false;
    if(key==='port'&&(!Number.isInteger(item)||item<1024||item>65535||item===5432))return false;
    if(['pid','serverPid','testPid'].includes(key)&&(!Number.isSafeInteger(item)||item<1))return false;
    if(key==='childRole'&&!ROLES.includes(item))return false;
    if(key==='channel'&&!CHANNELS.includes(item))return false;
    if(key==='code'&&!validCode(item))return false;
    if(key==='signal'&&item!==null&&(typeof item!=='string'||!Object.hasOwn(osConstants.signals,item)))return false;
    if(key==='sample'&&item!==0&&item!==1)return false;
    if(['passed','testsStarted','serverClosed','retained','privateDbQuiescent'].includes(key)&&typeof item!=='boolean')return false;
    if(key==='reason'&&!REASONS.has(item))return false;
    if(key==='operation'&&!OPERATIONS.has(item))return false;
  }
  return true;
}
function validTerminal(value){
  if(value?.outcome==='refused')return keysMatch(value,['outcome','reason','productionAuthority'])
    &&REASONS.has(value.reason)&&value.productionAuthority===false;
  return keysMatch(value,['outcome','testCode','privateDbQuiescent','adminEnded','serverClosed','productionAuthority'])
    &&value.outcome==='observed'&&Number.isInteger(value.testCode)&&value.testCode>=0&&value.testCode<=255
    &&value.privateDbQuiescent===true&&value.adminEnded===true&&value.serverClosed===true
    &&value.productionAuthority===false;
}

// This is bounded diagnostic consistency, never child ownership or effect authority.
function observationState(){
  let eligible=true,root=null,port=null,serverPid=null,samples=0;
  const seen=new Set(),roles=Object.fromEntries(ROLES.map(role=>[role,{exit:null,close:null,eof:new Set()}]));
  const started=role=>seen.has({initdb:'initdb',server:'server-start',test:'test-graph'}[role]);
  const closed=role=>normal(roles[role].close)&&roles[role].close.code===(role==='test'?roles[role].close.code:0);
  function require(condition){if(!condition)eligible=false;}
  function control(value){
    const {stage}=value;
    if(stage==='journal-opened'){
      require(seen.size===0);root=value.root;
    }else require(seen.has('journal-opened'));
    if(Object.hasOwn(value,'root')&&value.root!==null)require(value.root===root);
    if(Object.hasOwn(value,'port')){
      if(port===null)port=value.port;else require(port===value.port);
    }
    if(stage==='initdb')require(!seen.has('server-start'));
    if(stage==='server-start')require(closed('initdb'));
    if(stage==='identity')require(started('server')&&!roles.server.exit&&!roles.server.close);
    if(stage==='identity-verified'){
      require(seen.has('identity')&&!roles.server.exit&&!roles.server.close);serverPid=value.serverPid;
    }
    if(stage==='test-graph')require(seen.has('identity-verified')&&!roles.server.exit&&!roles.server.close);
    if(stage==='private-db-quiescence')require(closed('test'));
    if(stage==='quiescence-sample'){
      require(closed('test')&&seen.has('private-db-quiescence')&&value.sample===samples&&value.passed===true);
      samples++;
    }
    if(stage==='direct-test-child-closed')require(closed('test')&&samples===2
      &&value.code===roles.test.close.code&&value.privateDbQuiescent===true);
    if(stage==='admin-close')require(closed('test')&&samples===2);
    if(stage==='admin-ended')require(seen.has('admin-close')&&samples===2);
    if(stage==='server-close')require(seen.has('admin-ended')&&samples===2&&closed('test'));
    if(stage==='server-definitely-closed')require(closed('server')&&closed('test')
      &&value.code===roles.test.close.code&&value.retained===true);
    if(stage==='child-exit'||stage==='child-close'){
      const role=roles[value.childRole];require(started(value.childRole));
      if(value.childRole==='server')require(seen.has('server-close')&&value.pid===serverPid);
      if(stage==='child-exit'){
        require(!role.exit&&!role.close&&normal(value)&&(value.childRole==='test'||value.code===0));
        role.exit={pid:value.pid,code:value.code,signal:value.signal};
      }else{
        require(!role.close&&role.exit&&role.exit.pid===value.pid&&role.exit.code===value.code
          &&role.exit.signal===value.signal&&role.eof.size===2&&normal(value));
        role.close={pid:value.pid,code:value.code,signal:value.signal};
      }
    }
    if(stage==='stream-end'){
      const role=roles[value.childRole];require(started(value.childRole)&&!role.close&&!role.eof.has(value.channel));
      role.eof.add(value.channel);
    }
    if(['child-error','stream-error','refused'].includes(stage))eligible=false;
    if(!['child-exit','child-close','child-error','stream-end','stream-error','quiescence-sample',
      'terminal-unavailable','refused'].includes(stage))require(!seen.has(stage));
    seen.add(stage);
  }
  return {
    get eligible(){return eligible;},burn(){eligible=false;},control,
    output(role,channel){require(started(role)&&!roles[role].close&&!roles[role].eof.has(channel));},
    terminal(value){return value.outcome==='refused'||(eligible&&closed('initdb')&&closed('test')&&closed('server')
      &&samples===2&&seen.has('admin-ended')&&seen.has('server-close')&&roles.test.close.code===value.testCode);},
  };
}
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
function encode(sequence,kind,role,channel,payload){
  return Buffer.from(JSON.stringify({version:1,sequence,kind,role,channel,
    byteLength:payload.length,sha256:digest(payload),payloadBase64:payload.toString('base64')})+'\n');
}

export function createPrivateTestJournalV1(root,directoryFd){
  let fd=null,owned=false,pinnedRoot,pinnedFile;
  function rootMatches(){
    const actual=lstatSync(root),held=fstatSync(directoryFd);
    for(const stat of [actual,held])if(!stat.isDirectory()||stat.uid!==501||(stat.mode&0o7777)!==0o700
      ||stat.dev!==pinnedRoot.dev||stat.ino!==pinnedRoot.ino)throw Error('journal-identity');
  }
  function fileMatches(size){
    for(const stat of [lstatSync(root+'/transcript.journal'),fstatSync(fd)]){
      if(!stat.isFile()||stat.uid!==501||(stat.mode&0o7777)!==0o600||stat.nlink!==1
        ||stat.dev!==pinnedFile.dev||stat.ino!==pinnedFile.ino||stat.size!==size)throw Error('journal-identity');
    }
  }
  try{
    if(!validRoot(root)||!Number.isInteger(directoryFd)||directoryFd<0
      ||process.getuid?.()!==501||process.geteuid?.()!==501)throw Error('journal-identity');
    pinnedRoot=fstatSync(directoryFd);rootMatches();
    fd=openSync(root+'/transcript.journal',constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
    owned=true; // Own immediately, including every subsequent constructor failure.
    pinnedFile=fstatSync(fd);
    fileMatches(0);fsyncSync(fd);fsyncSync(directoryFd);rootMatches();fileMatches(0);
  }catch{
    if(owned){owned=false;try{closeSync(fd);}catch{}}
    throw Error('PRIVATE_TEST_JOURNAL_REFUSED');
  }
  let io=true,sealed=false,closed=false,closeResult=false,sequence=0,size=0,outputSize=0,controlSize=0,unsynced=0;
  const state=observationState();
  function check(){
    rootMatches();fileMatches(size);
  }
  function append(kind,role,channel,payload){
    if(!io||sealed||closed)return false;
    const frame=encode(sequence+1,kind,role,channel,payload);
    if(frame.length>FRAME_MAX||sequence>=SEQUENCE_MAX||(kind==='output'
      ?outputSize+frame.length>OUTPUT_CAP:controlSize+frame.length>CONTROL_CAP)){
      state.burn();return false;
    }
    try{
      check();
      if(kind==='output'&&unsynced+frame.length>CHECKPOINT){fsyncSync(fd);check();unsynced=0;}
      if(writeSync(fd,frame,0,frame.length,null)!==frame.length)throw Error('journal-io');
      size+=frame.length;sequence++;
      if(kind==='output'){outputSize+=frame.length;unsynced+=frame.length;}else controlSize+=frame.length;
      check();
      if(kind!=='output'||unsynced>=CHECKPOINT){fsyncSync(fd);check();unsynced=0;}
      if(kind==='terminal')sealed=true;
      return true;
    }catch{io=false;state.burn();return false;}
  }
  return Object.freeze({
    get healthy(){return io&&state.eligible&&!closed;},
    output(role,channel,buffer){
      if(!ROLES.includes(role)||!CHANNELS.includes(channel)||!Buffer.isBuffer(buffer)){
        state.burn();return false;
      }
      if(!io||sealed||closed)return false;
      state.output(role,channel);
      for(let offset=0;offset<buffer.length;offset+=OUTPUT_MAX){
        if(!append('output',role,channel,buffer.subarray(offset,offset+OUTPUT_MAX)))return false;
      }
      return true;
    },
    control(stage,fields={}){
      try{
        if(typeof stage!=='string'||!Object.hasOwn(FIELDS,stage)||!keysMatch(fields,FIELDS[stage])){
          state.burn();return false;
        }
        const value={stage,...fields,productionAuthority:false};
        if(!validControl(value)){state.burn();return false;}
        if(!io||sealed||closed)return false;
        state.control(value);return append('control',null,null,Buffer.from(JSON.stringify(value)));
      }catch{state.burn();return false;}
    },
    finish(value){
      try{
        const snapshot={...value};
        if(!validTerminal(snapshot)||!state.terminal(snapshot)){state.burn();return false;}
        return append('terminal',null,null,Buffer.from(JSON.stringify(snapshot)));
      }catch{state.burn();return false;}
    },
    burn(_reason){state.burn();return false;},
    close(){
      if(closed)return closeResult;
      closed=true;closeResult=io&&state.eligible;
      if(io){try{check();fsyncSync(fd);check();}catch{io=false;state.burn();closeResult=false;}}
      if(owned){owned=false;try{closeSync(fd);}catch{io=false;state.burn();closeResult=false;}}
      return closeResult;
    },
  });
}

export function createPrivateTestJournalReaderV1(){
  const state=observationState();
  let pending=Buffer.alloc(0),sequence=0,outputSize=0,controlSize=0,terminal=null,reason=null,ended=false;
  function fail(value){reason??=value;state.burn();pending=Buffer.alloc(0);}
  function frame(line){
    try{
      const value=JSON.parse(line.toString('utf8'));
      if(!keysMatch(value,['version','sequence','kind','role','channel','byteLength','sha256','payloadBase64'])
        ||!Buffer.from(JSON.stringify(value)).equals(line)||Object.keys(value).join(',')!==
          'version,sequence,kind,role,channel,byteLength,sha256,payloadBase64'
        ||value.version!==1||value.sequence!==sequence+1||value.sequence>SEQUENCE_MAX
        ||!['output','control','terminal'].includes(value.kind)||!Number.isInteger(value.byteLength)||value.byteLength<0
        ||typeof value.sha256!=='string'||!/^[0-9a-f]{64}$/.test(value.sha256)
        ||typeof value.payloadBase64!=='string')throw Error();
      const payload=Buffer.from(value.payloadBase64,'base64');
      if(payload.toString('base64')!==value.payloadBase64||payload.length!==value.byteLength
        ||digest(payload)!==value.sha256)throw Error();
      if(value.kind==='output'){
        if(!ROLES.includes(value.role)||!CHANNELS.includes(value.channel)||payload.length>OUTPUT_MAX
          ||outputSize+line.length+1>OUTPUT_CAP)throw Error();
        outputSize+=line.length+1;state.output(value.role,value.channel);
      }else{
        if(value.role!==null||value.channel!==null||controlSize+line.length+1>CONTROL_CAP)throw Error();
        const decoded=JSON.parse(payload.toString('utf8'));
        if(!Buffer.from(JSON.stringify(decoded)).equals(payload))throw Error();
        if(value.kind==='control'){
          if(!validControl(decoded))throw Error();state.control(decoded);
        }else{
          if(!validTerminal(decoded)||!state.terminal(decoded))throw Error();terminal=decoded;
        }
        controlSize+=line.length+1;
      }
      sequence++;return Object.freeze({...value,payload});
    }catch{fail('journal-framing');return null;}
  }
  return Object.freeze({
    write(buffer){
      if(reason)return [];
      if(ended||!Buffer.isBuffer(buffer)||buffer.length>FRAME_MAX){fail('journal-input');return [];}
      const records=[];let offset=0;
      while(offset<buffer.length&&!reason){
        if(terminal){fail('journal-framing');break;}
        const newline=buffer.indexOf(10,offset),end=newline<0?buffer.length:newline;
        if(pending.length+end-offset+(newline<0?0:1)>FRAME_MAX){fail('journal-limit');break;}
        pending=Buffer.concat([pending,buffer.subarray(offset,end)]);
        offset=end+(newline<0?0:1);
        if(newline<0)break;
        const record=frame(pending);pending=Buffer.alloc(0);
        if(record)records.push(record);
      }
      return records;
    },
    end(){
      ended=true;
      if(pending.length)fail('journal-framing');
      return Object.freeze({validatedPrefix:sequence,terminalObserved:terminal!==null,
        terminal:terminal?Object.freeze({...terminal}):null,
        incomplete:reason!==null||terminal?.outcome!=='observed'||!state.eligible,
        reason:reason??(terminal?.outcome==='refused'?terminal.reason:(!terminal?'journal-input':
          (!state.eligible?'journal-order':null)))});
    },
  });
}

export function createPrivateTestTerminalMirrorV1(stream,onUnavailable){
  let available=true;
  function disable(reason){
    if(!available)return;available=false;
    try{onUnavailable(reason);}catch{}
  }
  stream.on('error',()=>disable('mirror-error'));stream.on('close',()=>disable('mirror-close'));
  return Object.freeze({
    write(buffer){
      if(!available)return false;
      try{
        if(stream.destroyed||stream.writableEnded){disable('mirror-close');return false;}
        if(stream.write(buffer)!==true){disable('mirror-backpressure');return false;}
        return true;
      }catch{disable('mirror-throw');return false;}
    },
  });
}
