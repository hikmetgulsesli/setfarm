// Closed dependency DATA only. Never compile/link/load or grant startup.
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {constants,openSync,closeSync,lstatSync,fstatSync,readSync,readlinkSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {holdDashboardCutoverNativeInputsV2} from './dashboard-cutover-native-inputs-v2.mjs';

const NODE='/opt/homebrew/Cellar/node/26.4.0/bin/node';
const CLANG='/Library/Developer/CommandLineTools/usr/bin/clang';
const CLT='/Library/Developer/CommandLineTools';
const HEADERS='/opt/homebrew/Cellar/node/26.4.0/include/node';
const SDK='/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
const RESOURCE='/Library/Developer/CommandLineTools/usr/lib/clang/21';
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE=path.join(ROOT,'scripts/dashboard-cutover-mach-peer-v2.c');
const ALIAS=SDK+'/usr/include/servers/bootstrap.h',ALIAS_TARGET='../bootstrap.h';
const PHYSICAL_ALIAS=SDK+'/usr/include/bootstrap.h';
const identity=['dev','ino','uid','gid','mode','birthtimeNs'];
const treeKeys=[...identity,'mtimeNs','ctimeNs'];
const fileKeys=[...treeKeys,'size','nlink'];
const vault={attempted:false,active:false,burned:false,closed:false,revocations:0,
  direct:null,source:null,uid:null,pins:[],directories:new Map(),files:[],aliases:[],
  physical:new Set(),total:0,children:[],directCloseAttempted:false};
const within=(r,p)=>p===r||p.startsWith(r+path.sep);
const same=(a,b,keys)=>keys.every(k=>a[k]===b[k]);
const hash=b=>createHash('sha256').update(b).digest('hex');
function refuse(){throw Error('DASHBOARD_CUTOVER_NATIVE_BUILD_INPUTS_REFUSED')}
function burn(){vault.burned=true;vault.revocations++}
function alive(){if(!vault.active||vault.burned||vault.closed)refuse()}
function port(fn){alive();const value=fn();alive();return value}
function enter(){if(vault.active){burn();refuse()}vault.active=true}
function profile(){return process.platform==='darwin'&&process.arch==='arm64'
  &&process.version==='v26.4.0'&&process.execPath===NODE&&Number(process.versions.napi)>=8
  &&Number.isSafeInteger(process.getuid())&&process.getuid()>0}
function checkProfile(){if(!profile()||BigInt(process.getuid())!==vault.uid)refuse()}
function checkPin(pin){
  if(pin.state!=='held')refuse();const keys=pin.file?fileKeys:pin.protected?treeKeys:identity;
  if(!same(pin.stats,port(()=>fstatSync(pin.fd,{bigint:true})),keys)
    ||!same(pin.stats,port(()=>lstatSync(pin.locator,{bigint:true})),keys))refuse();
}
function checkDirectories(){for(const p of vault.directories.values())checkPin(p)}
function protectedPath(p){return within(ROOT,p)||within(CLT,p)||within(path.dirname(path.dirname(NODE)),p)}
function safeOwner(s,own=false){return (own?s.uid===vault.uid:s.uid===0n||s.uid===vault.uid)&&!(s.mode&0o022n)}
function openOriginal(locator,stats,file){
  if(vault.pins.length>=512)refuse();
  const pin={locator,stats,file,protected:protectedPath(locator),fd:null,state:'opening'};
  vault.pins.push(pin);alive();
  pin.fd=openSync(locator,constants.O_RDONLY|constants.O_NOFOLLOW|(file?constants.O_NONBLOCK:constants.O_DIRECTORY));
  pin.state='held';alive();checkPin(pin);return pin;
}
function ancestors(locator){
  const pieces=locator.split(path.sep).filter(Boolean);if(pieces.length>128)refuse();
  for(let i=0;i<=pieces.length;i++){
    const p=path.join(path.parse(locator).root,...pieces.slice(0,i));
    if(vault.directories.has(p))continue;
    checkDirectories();const s=port(()=>lstatSync(p,{bigint:true}));
    if(!s.isDirectory()||s.isSymbolicLink()||(protectedPath(p)&&!safeOwner(s,within(ROOT,p))))refuse();
    vault.directories.set(p,openOriginal(p,s,false));checkDirectories();
  }
}
function stream(pin,copy=false){
  checkPin(pin);const n=Number(pin.stats.size),h=createHash('sha256');
  const block=Buffer.allocUnsafe(Math.min(n,65536)),copied=copy?Buffer.alloc(n):null;
  for(let pos=0;pos<n;){const length=Math.min(block.length,n-pos);
    if(port(()=>readSync(pin.fd,block,0,length,pos))!==length)refuse();
    h.update(block.subarray(0,length));if(copy)block.copy(copied,pos,0,length);pos+=length;}
  checkPin(pin);return {sha256:h.digest('hex'),bytes:copied};
}
function checkAlias(a){
  if(!same(a.stats,port(()=>lstatSync(a.locator,{bigint:true})),fileKeys)
    ||port(()=>readlinkSync(a.locator))!==ALIAS_TARGET)refuse();
}
function holdFile(locator,source=false){
  ancestors(path.dirname(locator));let actual=locator,alias=null;
  const lexical=port(()=>lstatSync(locator,{bigint:true}));
  if(lexical.isSymbolicLink()){
    if(locator!==ALIAS||lexical.nlink!==1n||(lexical.uid!==0n&&lexical.uid!==vault.uid)
      ||port(()=>readlinkSync(locator))!==ALIAS_TARGET)refuse();
    alias={locator,stats:lexical};vault.aliases.push(alias);checkAlias(alias);
    actual=PHYSICAL_ALIAS;ancestors(path.dirname(actual));
  }
  const s=port(()=>lstatSync(actual,{bigint:true}));
  if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1n||!safeOwner(s,source)||s.size<=0n
    ||s.size>BigInt(source?65536:4*1024*1024))refuse();
  const key=s.dev+':'+s.ino;if(vault.physical.has(key))refuse();
  if(vault.total+Number(s.size)>32*1024*1024)refuse();
  const pin=openOriginal(actual,s,true);vault.physical.add(key);vault.total+=Number(s.size);
  vault.files.push(pin);const digest=stream(pin,source);pin.sha256=digest.sha256;
  checkDirectories();if(alias)checkAlias(alias);
  return {pin,bytes:digest.bytes,observation:Object.freeze({locator,physicalLocator:actual,
    byteLength:Number(s.size),sha256:pin.sha256,...(alias?{aliasTarget:ALIAS_TARGET}:{})})};
}
function recheckOriginals(){
  alive();checkProfile();vault.direct.recheck();alive();checkDirectories();
  for(const a of vault.aliases)checkAlias(a);
  for(const p of vault.files)if(stream(p).sha256!==p.sha256)refuse();
  for(const a of vault.aliases)checkAlias(a);
  checkDirectories();vault.direct.recheck();alive();
}
function parseDependencies(bytes){
  const text=bytes.toString('utf8');
  if(!Buffer.from(text).equals(bytes)||/[\x00-\x08\x0b-\x1f\x7f#$]/.test(text))refuse();
  const flat=text.replace(/\\\n/g,' ');
  if(!flat.startsWith('setfarm-cutover-inputs: ')||!flat.endsWith('\n')||flat.slice(0,-1).includes('\n'))refuse();
  const data=flat.slice('setfarm-cutover-inputs: '.length,-1),tokens=[];let token='';
  for(let i=0;i<data.length;i++){
    const c=data[i];if(c==='\\'){
      const next=data[++i];if(next!==' '&&next!=='\t'&&next!=='\\')refuse();token+=next;
    }else if(c===' '||c==='\t'){if(token){tokens.push(token);token=''}}
    else {if(c===':')refuse();token+=c}
  }
  if(token)tokens.push(token);let sentinel=0;const paths=[];
  for(const p of tokens){
    if(p==='-'||p==='<stdin>'){if(++sentinel>1)refuse();continue}
    if(p.length>4096||!path.isAbsolute(p)||path.normalize(p)!==p
      ||![HEADERS,RESOURCE+'/include',SDK].some(r=>within(r,p)&&p!==r))refuse();
    paths.push(p);if(paths.length>384)refuse();
  }
  if(!paths.length||new Set(paths).size!==paths.length)refuse();return paths.sort();
}
function argv(){return ['--no-default-config','-nostdinc','-std=c11','-DNAPI_VERSION=8',
  '-arch','arm64','-mmacosx-version-min=14.0','-isysroot',SDK,'-resource-dir',RESOURCE,
  '-isystem',HEADERS,'-isystem',RESOURCE+'/include','-isystem',SDK+'/usr/include',
  '-iframework',SDK+'/System/Library/Frameworks','-M','-MT','setfarm-cutover-inputs','-x','c','-']}
function discover(phase){
  alive();if(vault.children.length>=2)refuse();
  const record={phase,child:null,stdin:null,stdout:null,stderr:null,closed:false,code:null,signal:null,
    inputFinished:false,inputClosed:false,writeSucceeded:false,outputEnded:false,outputClosed:false,
    errorEnded:false,errorClosed:false,output:[],errors:[],outputLength:0,errorLength:0,failed:false};
  vault.children.push(record); // Original occurrence BEFORE spawn admission.
  return new Promise((resolve,reject)=>{
    let done=false,timer;
    const fail=()=>{record.failed=true;burn();if(!done){done=true;clearTimeout(timer);reject(Error('DASHBOARD_CUTOVER_NATIVE_BUILD_INPUTS_REFUSED'))}};
    const finish=()=>{
      if(done)return;if(vault.burned){fail();return}
      if(!record.closed||!record.inputFinished||!record.inputClosed||!record.writeSucceeded
        ||!record.outputEnded||!record.outputClosed||!record.errorEnded||!record.errorClosed)return;
      if(record.code!==0||record.signal!==null||record.errorLength){fail();return}
      done=true;clearTimeout(timer);resolve(Buffer.concat(record.output,record.outputLength));
    };
    const mark=(name)=>()=>{record[name]=true;finish()};
    const collect=(name,limit)=>b=>{
      if(done||vault.burned)return;
      if(!Buffer.isBuffer(b)||record[name+'Length']+b.length>limit){fail();return}
      record[name+'Length']+=b.length;record[name==='output'?'output':'errors'].push(Buffer.from(b));
    };
    try{
      timer=setTimeout(fail,30000);
      alive();const child=spawn(CLANG,argv(),{cwd:'/private/tmp',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TMPDIR:'/private/tmp'},
        shell:false,stdio:['pipe','pipe','pipe']});
      record.child=child;record.stdin=child.stdin;record.stdout=child.stdout;record.stderr=child.stderr;
      // Seal all returned originals and mark-only observers BEFORE admission checks.
      child.on('error',fail);child.on('close',(code,signal)=>{record.closed=true;record.code=code;record.signal=signal;finish()});
      record.stdin.on('error',fail);record.stdin.on('finish',mark('inputFinished'));record.stdin.on('close',mark('inputClosed'));
      record.stdout.on('error',fail);record.stdout.on('data',collect('output',262144));
      record.stdout.on('end',mark('outputEnded'));record.stdout.on('close',mark('outputClosed'));
      record.stderr.on('error',fail);record.stderr.on('data',collect('error',65536));
      record.stderr.on('end',mark('errorEnded'));record.stderr.on('close',mark('errorClosed'));
      alive();record.writeAttempted=true;
      record.stdin.end(vault.source,error=>{record.writeSucceeded=!error;if(error)fail();else finish()});
      alive();
    }catch{fail()}
  });
}
function recheck(){
  if(vault.active){burn();refuse()}if(arguments.length||vault.burned||vault.closed)refuse();enter();
  try{recheckOriginals()}catch{burn();refuse()}finally{vault.active=false}
}
function close(){
  if(vault.active){burn();refuse()}if(arguments.length)refuse();if(vault.closed)return;
  if(vault.children.some(c=>!c.closed))refuse();enter();vault.closed=true;const revocations=vault.revocations;
  try{
    for(let i=vault.pins.length-1;i>=0;i--){const p=vault.pins[i];if(p.state!=='held')refuse();
      p.state='validating-close';const s=fstatSync(p.fd,{bigint:true});
      if(vault.revocations!==revocations||!same(s,p.stats,['dev','ino','birthtimeNs'])
        ||(p.file?!s.isFile():!s.isDirectory())){p.state='unknown';refuse()}
      p.state='closing';try{closeSync(p.fd);p.state='closed'}catch{p.state='unknown';refuse()}
      if(vault.revocations!==revocations)refuse();
    }
    vault.directCloseAttempted=true;vault.direct.close();if(vault.revocations!==revocations)refuse();
  }catch{burn();refuse()}finally{vault.active=false}
}
export async function prepareDashboardCutoverNativeBuildInputsV2(){
  if(vault.active){burn();refuse()}if(arguments.length||!profile())refuse();
  if(vault.attempted||vault.burned||vault.closed)refuse();enter();vault.attempted=true;vault.uid=BigInt(process.getuid());
  try{
    alive();vault.direct=holdDashboardCutoverNativeInputsV2();alive();
    const source=holdFile(SOURCE,true);vault.source=source.bytes;
    const nominated=vault.direct.observation.files.find(f=>f.role==='source');
    if(source.pin.sha256!==nominated.sha256||source.bytes.length!==nominated.byteLength)refuse();
    recheckOriginals();const first=parseDependencies(await discover('provisional'));alive();recheckOriginals();
    const headers=first.map(p=>holdFile(p).observation);recheckOriginals();
    const second=parseDependencies(await discover('held-validation'));alive();recheckOriginals();
    if(first.length!==second.length||first.some((p,i)=>p!==second[i]))refuse();
    const observation=Object.freeze({schema:'setfarm.internal-production-dashboard-native-build-inputs.v2',
      authority:'compiler-dependencies-only',direct:vault.direct.observation,headers:Object.freeze(headers),
      discoveries:Object.freeze(vault.children.map(c=>Object.freeze({phase:c.phase,code:c.code,signal:c.signal,
        byteLength:c.outputLength,sha256:hash(Buffer.concat(c.output,c.outputLength))})))});
    alive();return Object.freeze({observation,recheck,close});
  }catch{burn();refuse()}finally{vault.active=false}
}
