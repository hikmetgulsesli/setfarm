// Optional closed build DATA only. Never evaluate an addon or grant startup.
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {constants,openSync,closeSync,lstatSync,fstatSync,readSync,readdirSync,
  mkdirSync,writeSync,fchmodSync,fsyncSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {observeCurrentFinalizedSetfarmSourceBuildV1} from './build-generation-retention.mjs';
import * as buildInputs from './dashboard-cutover-native-build-inputs-v2.mjs';

const NODE='/opt/homebrew/Cellar/node/26.4.0/bin/node';
const CLANG='/Library/Developer/CommandLineTools/usr/bin/clang';
const LD='/Library/Developer/CommandLineTools/usr/bin/ld';
const NM='/Library/Developer/CommandLineTools/usr/bin/llvm-nm';
const OTOOL='/Library/Developer/CommandLineTools/usr/bin/llvm-otool';
const CLT='/Library/Developer/CommandLineTools';
const HEADERS='/opt/homebrew/Cellar/node/26.4.0/include/node';
const SDK='/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
const RESOURCE='/Library/Developer/CommandLineTools/usr/lib/clang/21';
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const V2=Object.freeze({source:ROOT+'/scripts/dashboard-cutover-mach-peer-v2.c',
  parent:ROOT+'/.setfarm/dashboard-cutover-native-v2',ignored:'.setfarm/dashboard-cutover-native-v2/',
  schema:'setfarm.internal-production-dashboard-native-sidecar-build.v2',
  prepare:()=>buildInputs.prepareDashboardCutoverNativeBuildInputsV2()});
const V4=Object.freeze({source:ROOT+'/scripts/dashboard-cutover-mach-job-peer-v4.c',
  parent:ROOT+'/.setfarm/dashboard-cutover-native-v4',ignored:'.setfarm/dashboard-cutover-native-v4/',
  schema:'setfarm.internal-production-dashboard-native-sidecar-build.v4',
  prepare:()=>buildInputs.prepareDashboardCutoverNativeBuildInputsV4()});
const NAPI=['create_buffer_copy','define_properties','create_object','create_uint32','get_cb_info',
  'get_typedarray_info','is_typedarray','is_arraybuffer','is_detached_arraybuffer','object_freeze',
  'throw_error','is_exception_pending','get_and_clear_last_exception'];
const SYSTEM=['audit_token_to_euid','audit_token_to_pid','audit_token_to_pidversion','bootstrap_check_in',
  'bootstrap_look_up','bootstrap_port','mach_port_allocate','mach_port_deallocate','mach_port_mod_refs',
  'mach_msg','mach_task_self_','getpid','geteuid','memcpy','memcmp','memset','bzero','__memcpy_chk',
  '__stack_chk_fail','__stack_chk_guard'];
const EXPORTS=['_napi_register_module_v1','_node_api_module_get_api_version_v1'].sort();
const DYLIBS=['/usr/lib/libSystem.B.dylib','/usr/lib/libbsm.0.dylib'].sort();
const identity=['dev','ino','uid','gid','mode','birthtimeNs'];
const treeKeys=[...identity,'mtimeNs','ctimeNs'];
const fileKeys=[...treeKeys,'size','nlink'];
const vault={attempted:false,active:false,burned:false,closed:false,revocations:0,uid:null,
  inputs:null,pins:[],directories:new Map(),files:[],effects:[],children:[],total:0,
  generation:null,temp:null,outputs:[],source:null,manifest:null,inputsCloseAttempted:false,binding:null};
const hash=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b,keys)=>keys.every(k=>a[k]===b[k]);
const within=(r,p)=>p===r||p.startsWith(r+path.sep);
const sorted=a=>a.slice().sort();
const exact=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
function refuse(){throw Error('DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED')}
function burn(){vault.burned=true;vault.revocations++}
function alive(){if(!vault.active||vault.burned||vault.closed)refuse()}
function port(fn){alive();const result=fn();alive();return result}
function enter(){if(vault.active){burn();refuse()}vault.active=true}
function profile(){return process.platform==='darwin'&&process.arch==='arm64'&&process.version==='v26.4.0'
  &&process.execPath===NODE&&Number(process.versions.napi)>=8&&Number.isSafeInteger(process.getuid())&&process.getuid()>0}
function checkProfile(){if(!profile()||BigInt(process.getuid())!==vault.uid)refuse()}
function protectedPath(p){return within(ROOT,p)||within(CLT,p)}
function safe(s,own=false){return (own?s.uid===vault.uid:s.uid===0n||s.uid===vault.uid)&&!(s.mode&0o022n)}
function checkPin(p){
  if(p.state!=='held')refuse();const keys=p.file?fileKeys:p.protected?treeKeys:identity;
  if(!same(p.stats,port(()=>fstatSync(p.fd,{bigint:true})),keys)
    ||!same(p.stats,port(()=>lstatSync(p.locator,{bigint:true})),keys))refuse();
}
function checkDirectories(){for(const p of vault.directories.values())checkPin(p)}
function openOriginal(locator,stats,file,writable=false){
  if(vault.pins.length>=128)refuse();
  const p={locator,stats,file,protected:protectedPath(locator),fd:null,state:'opening'};vault.pins.push(p);
  alive();p.fd=openSync(locator,(writable?constants.O_RDWR:constants.O_RDONLY)|constants.O_NOFOLLOW|
    (file?constants.O_NONBLOCK:constants.O_DIRECTORY));p.state='held';alive();checkPin(p);return p;
}
function holdDirectory(locator){
  if(vault.directories.has(locator))return vault.directories.get(locator);
  checkDirectories();const s=port(()=>lstatSync(locator,{bigint:true}));
  if(!s.isDirectory()||s.isSymbolicLink()||(protectedPath(locator)&&!safe(s,within(ROOT,locator))))refuse();
  const p=openOriginal(locator,s,false);vault.directories.set(locator,p);return p;
}
function ancestors(locator){
  const parts=locator.split(path.sep).filter(Boolean);if(parts.length>128)refuse();
  for(let i=0;i<=parts.length;i++)holdDirectory(path.join(path.parse(locator).root,...parts.slice(0,i)));
}
function stream(p,copy=false){
  checkPin(p);const n=Number(p.stats.size),h=createHash('sha256'),block=Buffer.allocUnsafe(Math.min(n,65536));
  const bytes=copy?Buffer.alloc(n):null;
  for(let pos=0;pos<n;){const length=Math.min(block.length,n-pos);
    if(port(()=>readSync(p.fd,block,0,length,pos))!==length)refuse();
    h.update(block.subarray(0,length));if(copy)block.copy(bytes,pos,0,length);pos+=length;}
  checkPin(p);return {sha256:h.digest('hex'),bytes};
}
function holdFile(locator,role,limit,copy=false){
  ancestors(path.dirname(locator));const s=port(()=>lstatSync(locator,{bigint:true}));
  if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1n||!safe(s,within(ROOT,locator))||s.size<=0n||s.size>BigInt(limit))refuse();
  if(vault.total+Number(s.size)>1024*1024*1024)refuse();
  if(vault.files.some(p=>p.stats.dev===s.dev&&p.stats.ino===s.ino))refuse();
  const p=openOriginal(locator,s,true);vault.total+=Number(s.size);p.role=role;vault.files.push(p);
  const result=stream(p,copy);p.sha256=result.sha256;return {pin:p,bytes:result.bytes,
    observation:Object.freeze({role,locator,byteLength:Number(s.size),sha256:p.sha256})};
}
function mkdirOccurrence(locator){
  const effect={kind:'mkdir',locator,state:'intent',returned:null};vault.effects.push(effect);alive();
  mkdirSync(locator,{mode:0o700});effect.state='returned';
  // Seal the named result before testing a swallowed reentry, without cleanup.
  effect.returned=lstatSync(locator,{bigint:true});alive();
  const s=effect.returned;if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==vault.uid||(s.mode&0o777n)!==0o700n)refuse();
  return s;
}
function optionalStat(locator){
  alive();try{const s=lstatSync(locator,{bigint:true});alive();return s}catch(e){alive();if(e?.code==='ENOENT')return null;throw e}
}
function bootstrap(){
  const root=port(()=>lstatSync(ROOT,{bigint:true}));if(!root.isDirectory()||root.isSymbolicLink()||!safe(root,true))refuse();
  for(const locator of [ROOT+'/.setfarm',vault.binding.parent]){
    const s=optionalStat(locator)??mkdirOccurrence(locator);
    if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==vault.uid||(s.mode&0o777n)!==0o700n)refuse();
  }
  ancestors(vault.binding.parent);checkDirectories();
}
function inventory(p,names){
  checkPin(p);const found=port(()=>readdirSync(p.locator));
  if(found.length>4||!exact(sorted(found),sorted(names)))refuse();checkPin(p);
}
function reconcile(p,names){
  // Only called at a nominated effect boundary, never for immutable providers.
  const actual=port(()=>fstatSync(p.fd,{bigint:true})),named=port(()=>lstatSync(p.locator,{bigint:true}));
  if(!same(p.stats,actual,identity)||!same(actual,named,treeKeys)||!actual.isDirectory())refuse();
  const found=port(()=>readdirSync(p.locator));if(found.length>4||!exact(sorted(found),sorted(names)))refuse();
  p.stats=actual;checkPin(p);
}
function createChildDirectory(parent,locator,parentNames){
  checkDirectories();mkdirOccurrence(locator);reconcile(parent,parentNames);
  return holdDirectory(locator);
}
function recheckInputs(){
  alive();checkProfile();vault.inputs.recheck();alive();checkDirectories();
  for(const p of vault.files)if(stream(p).sha256!==p.sha256)refuse();
  checkDirectories();vault.inputs.recheck();alive();
}
function command(phase,executable,args,env,cwd,input=Buffer.alloc(0)){
  alive();if(vault.children.length>=5)refuse();
  const r={phase,executable,args:Object.freeze(args.slice()),env:Object.freeze({...env}),cwd,
    child:null,stdin:null,stdout:null,stderr:null,closed:false,code:null,signal:null,writeSucceeded:false,
    inputFinished:false,inputClosed:false,outputEnded:false,outputClosed:false,errorEnded:false,errorClosed:false,
    output:[],errors:[],outputLength:0,errorLength:0,sourceHash:hash(input),sourceLength:input.length,failed:false};
  vault.children.push(r);
  return new Promise((resolve,reject)=>{
    let done=false,timer;
    const fail=()=>{r.failed=true;burn();if(!done){done=true;clearTimeout(timer);reject(Error('DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED'))}};
    const finish=()=>{
      if(done)return;if(vault.burned){fail();return}
      if(!r.closed||!r.writeSucceeded||!r.inputFinished||!r.inputClosed||!r.outputEnded||!r.outputClosed||!r.errorEnded||!r.errorClosed)return;
      if(r.code!==0||r.signal!==null||r.errorLength){fail();return}
      done=true;clearTimeout(timer);resolve(Buffer.concat(r.output,r.outputLength));
    };
    const mark=n=>()=>{r[n]=true;finish()};
    const collect=(n,limit)=>b=>{
      if(done||vault.burned)return;if(!Buffer.isBuffer(b)){fail();return}
      const left=Math.max(0,limit-r[n+'Length']);if(left)r[n==='output'?'output':'errors'].push(Buffer.from(b.subarray(0,left)));
      r[n+'Length']+=b.length;if(b.length>left)fail();
    };
    try{
      timer=setTimeout(fail,30000);alive();const child=spawn(executable,args,{cwd,env,shell:false,stdio:['pipe','pipe','pipe']});
      r.child=child;r.stdin=child.stdin;r.stdout=child.stdout;r.stderr=child.stderr;
      child.on('error',fail);child.on('close',(code,signal)=>{r.closed=true;r.code=code;r.signal=signal;finish()});
      r.stdin.on('error',fail);r.stdin.on('finish',mark('inputFinished'));r.stdin.on('close',mark('inputClosed'));
      r.stdout.on('error',fail);r.stdout.on('data',collect('output',262144));r.stdout.on('end',mark('outputEnded'));r.stdout.on('close',mark('outputClosed'));
      r.stderr.on('error',fail);r.stderr.on('data',collect('error',65536));r.stderr.on('end',mark('errorEnded'));r.stderr.on('close',mark('errorClosed'));
      alive();r.writeAttempted=true;r.stdin.end(input,e=>{r.writeSucceeded=!e;if(e)fail();else finish()});alive();
    }catch{fail()}
  });
}
function compileArgv(gen){return ['--no-default-config','-nostdinc','-std=c11','-DNAPI_VERSION=8',
  '-arch','arm64','-mmacosx-version-min=14.0','-isysroot',SDK,'-resource-dir',RESOURCE,
  '-isystem',HEADERS,'-isystem',RESOURCE+'/include','-isystem',SDK+'/usr/include',
  '-iframework',SDK+'/System/Library/Frameworks','-Wall','-Wextra','-Werror','-O2','-bundle','-nostdlib',
  '--ld-path='+LD,...NAPI.map(n=>'-Wl,-U,_napi_'+n),'-MD','-MF',gen+'/inputs.d','-MT',
  'setfarm-cutover-inputs','-x','c','-','-x','none',SDK+'/usr/lib/libSystem.B.tbd',SDK+'/usr/lib/libbsm.0.tbd','-o',gen+'/peer.node']}
function text(bytes){const s=bytes.toString('utf8');if(!Buffer.from(s).equals(bytes)||/[\x00-\x08\x0b-\x1f\x7f]/.test(s))refuse();return s}
function dependencyGraph(bytes){
  const s=text(bytes).replace(/\\\n/g,' ');if(/[#$]/.test(s)||!s.startsWith('setfarm-cutover-inputs: ')
    ||!s.endsWith('\n')||s.slice(0,-1).includes('\n'))refuse();
  const body=s.slice(24,-1),tokens=[];let token='';
  for(let i=0;i<body.length;i++){const c=body[i];if(c==='\\'){
    const next=body[++i];if(![' ','\t','\\'].includes(next))refuse();token+=next;
  }else if(c===' '||c==='\t'){if(token){tokens.push(token);token=''}}else{if(c===':')refuse();token+=c}}
  if(token)tokens.push(token);let sentinel=0;const files=[];
  for(const p of tokens){if(p==='-'||p==='<stdin>'){if(++sentinel>1)refuse();continue}
    if(p.length>4096||!path.isAbsolute(p)||path.normalize(p)!==p||![HEADERS,RESOURCE+'/include',SDK].some(r=>within(r,p)&&p!==r))refuse();
    files.push(p);if(files.length>384)refuse();}
  if(!files.length||new Set(files).size!==files.length)refuse();return sorted(files);
}
function macho(b){
  if(b.length<32||b.readUInt32LE(0)!==0xfeedfacf||b.readUInt32LE(4)!==0x0100000c||b.readUInt32LE(8)!==0||b.readUInt32LE(12)!==8)refuse();
  const count=b.readUInt32LE(16),size=b.readUInt32LE(20);if(count<1||count>128||size>b.length-32)refuse();
  let pos=32;for(let i=0;i<count;i++){if(pos+8>32+size)refuse();const n=b.readUInt32LE(pos+4);
    if(n<8||n%8||pos+n>32+size||pos+n>b.length)refuse();pos+=n;}if(pos!==32+size)refuse();
}
function symbols(bytes,undefinedOnly){
  const s=text(bytes);if(!s.endsWith('\n'))refuse();const lines=s.slice(0,-1).split('\n');if(lines.length>128)refuse();
  const result=lines.map(line=>{const m=(undefinedOnly?/^(_[A-Za-z0-9_]+|dyld_stub_binder)$/:/^[0-9a-fA-F]{16} [TDS] (_[A-Za-z0-9_]+)$/).exec(line);
    if(!m)refuse();return m[1]});if(new Set(result).size!==result.length)refuse();return sorted(result);
}
function dylibs(bytes,gen){
  const s=text(bytes);if(!s.startsWith(gen+'/peer.node:\n')||!s.endsWith('\n'))refuse();
  const lines=s.slice((gen+'/peer.node:\n').length,-1).split('\n');if(lines.length!==2)refuse();
  const deps=lines.map(line=>{const m=/^\t(\/usr\/lib\/[A-Za-z0-9.]+) \(compatibility version [0-9.]+, current version [0-9.]+\)$/.exec(line);
    if(!m)refuse();return m[1]});if(!exact(sorted(deps),DYLIBS))refuse();return sorted(deps);
}
function receipt(r){return Object.freeze({phase:r.phase,executable:r.executable,args:r.args,env:r.env,cwd:r.cwd,
  code:r.code,signal:r.signal,sourceHash:r.sourceHash,sourceLength:r.sourceLength,
  stdoutLength:r.outputLength,stdoutHash:hash(Buffer.concat(r.output)),stderrLength:r.errorLength,
  originalPipeCompletion:r.inputFinished&&r.inputClosed&&r.writeSucceeded&&r.outputEnded&&r.outputClosed&&r.errorEnded&&r.errorClosed})}
function syncOccurrence(p,phase){
  checkPin(p);const e={kind:'fsync',phase,fd:p.fd,locator:p.locator,state:'intent'};vault.effects.push(e);alive();
  try{fsyncSync(p.fd);e.state='returned'}catch{e.state='unknown';throw Error('DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED')}
  alive();checkPin(p);
}
function publishManifest(value){
  const bytes=Buffer.from(JSON.stringify(value)+'\n');if(bytes.length>262144)refuse();
  checkDirectories();inventory(vault.generation,['provider-tmp','peer.node','inputs.d']);inventory(vault.temp,[]);
  const locator=vault.generation.locator+'/manifest.json',effect={kind:'manifest-open',locator,state:'intent'};
  vault.effects.push(effect);if(vault.pins.length>=128)refuse();
  const p={locator,file:true,protected:true,stats:null,fd:null,state:'opening'};vault.pins.push(p);alive();
  p.fd=openSync(locator,constants.O_RDWR|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  p.state='held';effect.state='returned';alive();
  p.stats=port(()=>fstatSync(p.fd,{bigint:true}));if(!p.stats.isFile()||p.stats.uid!==vault.uid||p.stats.nlink!==1n||p.stats.size!==0n
    ||(p.stats.mode&0o777n)!==0o600n||!same(p.stats,port(()=>lstatSync(locator,{bigint:true})),fileKeys))refuse();
  reconcile(vault.generation,['provider-tmp','peer.node','inputs.d','manifest.json']);checkDirectories();
  const writeEffect={kind:'manifest-write',fd:p.fd,state:'intent',bytes};vault.effects.push(writeEffect);alive();
  writeEffect.count=writeSync(p.fd,bytes,0,bytes.length,0);writeEffect.state='returned';alive();
  if(writeEffect.count!==bytes.length)refuse();const after=port(()=>fstatSync(p.fd,{bigint:true}));
  if(!same(p.stats,after,identity)||after.size!==BigInt(bytes.length)||after.nlink!==1n)refuse();p.stats=after;checkPin(p);
  syncOccurrence(p,'manifest-publication');p.sha256=hash(bytes);p.role='manifest';vault.files.push(p);vault.outputs.push(p);
  if(stream(p).sha256!==p.sha256)refuse();vault.manifest=p;return p;
}
function terminalize(p){
  checkPin(p);checkDirectories();const original=p.stats,e={kind:'fchmod',fd:p.fd,state:'intent'};vault.effects.push(e);alive();
  fchmodSync(p.fd,0o444);e.state='returned';e.stats=fstatSync(p.fd,{bigint:true});alive();
  if(!same(original,e.stats,fileKeys.filter(k=>k!=='mode'&&k!=='ctimeNs'))||(e.stats.mode&0o777n)!==0o444n)refuse();
  p.stats=e.stats;checkPin(p);syncOccurrence(p,'terminal-'+p.role);if(stream(p).sha256!==p.sha256)refuse();
}
function recheckTerminal(){
  recheckInputs();inventory(vault.generation,['provider-tmp','peer.node','inputs.d','manifest.json']);inventory(vault.temp,[]);
}
function recheck(){
  if(vault.active){burn();refuse()}if(arguments.length||vault.burned||vault.closed)refuse();enter();
  try{recheckTerminal()}catch{burn();refuse()}finally{vault.active=false}
}
function close(){
  if(vault.active){burn();refuse()}if(arguments.length)refuse();if(vault.closed)return;
  if(vault.children.some(c=>!c.closed))refuse();enter();vault.closed=true;const revocations=vault.revocations;
  try{
    for(let i=vault.pins.length-1;i>=0;i--){const p=vault.pins[i];if(p.state!=='held')refuse();p.state='validating-close';
      const s=fstatSync(p.fd,{bigint:true});if(vault.revocations!==revocations||!same(p.stats,s,['dev','ino','birthtimeNs'])
        ||(p.file?!s.isFile():!s.isDirectory())){p.state='unknown';refuse()}
      p.state='closing';try{closeSync(p.fd);p.state='closed'}catch{p.state='unknown';refuse()}
      if(vault.revocations!==revocations)refuse();
    }
    vault.inputsCloseAttempted=true;vault.inputs.close();if(vault.revocations!==revocations)refuse();
  }catch{burn();refuse()}finally{vault.active=false}
}
async function prepareFixed(binding,arity){
  if(vault.active){burn();refuse()}if(arity||!profile())refuse();
  if(vault.attempted||vault.burned||vault.closed)refuse();enter();vault.attempted=true;vault.uid=BigInt(process.getuid());
  vault.binding=binding;
  try{
    const preflight=port(()=>observeCurrentFinalizedSetfarmSourceBuildV1());
    const gitOutput=await command('ignored-parent','/usr/bin/git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',
      'check-ignore','-q','--',binding.ignored],{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',
      GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},ROOT);
    alive();if(gitOutput.length)refuse();
    const refreshed=port(()=>observeCurrentFinalizedSetfarmSourceBuildV1());
    if(!['sha','treeHash','buildHash'].every(k=>refreshed[k]===preflight[k]))refuse();bootstrap();alive();
    vault.inputs=await binding.prepare();alive();
    if(binding===V4){
      const o=vault.inputs.observation,d=o.direct,p=d.profile;
      if(o.schema!=='setfarm.internal-production-dashboard-native-build-inputs.v4'
        ||o.authority!=='compiler-dependencies-only'
        ||d.schema!=='setfarm.internal-production-dashboard-native-direct-inputs.v4'
        ||d.authority!=='direct-inputs-only'||p.platform!=='darwin'||p.arch!=='arm64'
        ||p.nodeVersion!=='26.4.0'||p.napiVersion!==8||p.sdk!==SDK||p.resource!==RESOURCE
        ||d.files.filter(f=>f.role==='source').length!==1
        ||o.discoveries.length!==2||o.discoveries[0].phase!=='provisional'
        ||o.discoveries[1].phase!=='held-validation'
        ||o.discoveries.some(c=>c.code!==0||c.signal!==null))refuse();
      // The genuine build-input provider compares parsed canonical graphs.
      // Different discovery formatting/order is not a different dependency set.
    }
    checkDirectories();
    const sourceBuild=vault.inputs.observation.direct.sourceBuild;
    if(!['sha','treeHash','buildHash'].every(k=>preflight[k]===sourceBuild.buildSource[k])
      ||preflight.sha!==sourceBuild.checkoutSource.sha)refuse();
    const linkInputs=[];for(const locator of [CLT+'/usr/lib/libtapi.dylib',CLT+'/usr/lib/libcodedirectory.dylib',
      CLT+'/usr/lib/libLTO.dylib',CLT+'/usr/lib/libswiftDemangle.dylib',SDK+'/usr/lib/libSystem.B.tbd',SDK+'/usr/lib/libbsm.0.tbd'])
      linkInputs.push(holdFile(locator,'link-input',512*1024*1024).observation);
    const source=holdFile(binding.source,'source',65536,true);vault.source=source.bytes;
    const directSource=vault.inputs.observation.direct.files.find(f=>f.role==='source');
    if(binding===V4&&directSource.locator!==binding.source)refuse();
    if(source.pin.sha256!==directSource.sha256||source.bytes.length!==directSource.byteLength)refuse();
    const parentLocator=binding.parent;
    ancestors(parentLocator);const parent=vault.directories.get(parentLocator);checkDirectories();
    const gen=parentLocator+'/'+preflight.sha+'.'+preflight.buildHash;
    // Parent may contain preserved prior generations; only its metadata changes.
    const parentNames=port(()=>readdirSync(parentLocator));if(parentNames.length>128||parentNames.includes(path.basename(gen)))refuse();
    mkdirOccurrence(gen);
    const named=port(()=>fstatSync(parent.fd,{bigint:true}));if(!same(parent.stats,named,identity))refuse();
    const entries=port(()=>readdirSync(parentLocator));if(!exact(sorted(entries),sorted([...parentNames,path.basename(gen)])))refuse();
    parent.stats=named;checkPin(parent);vault.generation=holdDirectory(gen);inventory(vault.generation,[]);
    vault.temp=createChildDirectory(vault.generation,gen+'/provider-tmp',['provider-tmp']);inventory(vault.temp,[]);
    recheckInputs();const commandEnv={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TMPDIR:gen+'/provider-tmp'};
    const compileOutput=await command('compile',CLANG,compileArgv(gen),commandEnv,'/private/tmp',vault.source);alive();
    if(compileOutput.length)refuse();
    reconcile(vault.temp,[]);reconcile(vault.generation,['provider-tmp','peer.node','inputs.d']);recheckInputs();
    const bundle=holdFile(gen+'/peer.node','bundle',4*1024*1024,true),depfile=holdFile(gen+'/inputs.d','depfile',262144,true);
    vault.outputs.push(bundle.pin,depfile.pin);macho(bundle.bytes);
    if(!exact(dependencyGraph(depfile.bytes),sorted(vault.inputs.observation.headers.map(h=>h.locator))))refuse();recheckInputs();
    const imports=symbols(await command('imports',NM,['-u',gen+'/peer.node'],commandEnv,'/private/tmp'),true);alive();recheckInputs();
    const required=NAPI.map(n=>'_napi_'+n),allowed=new Set([...required,...SYSTEM.map(n=>'_'+n),'dyld_stub_binder']);
    if(required.some(n=>!imports.includes(n))||imports.some(n=>!allowed.has(n)))refuse();
    const exports=symbols(await command('exports',NM,['-gU',gen+'/peer.node'],commandEnv,'/private/tmp'),false);alive();recheckInputs();
    if(!exact(exports,EXPORTS))refuse();
    const dependencies=dylibs(await command('dependencies',OTOOL,['-L',gen+'/peer.node'],commandEnv,'/private/tmp'),gen);alive();recheckInputs();
    const manifest={schema:binding.schema,
      sourceBuild:{sha:preflight.sha,treeHash:preflight.treeHash,buildHash:preflight.buildHash},source:source.observation,
      profile:vault.inputs.observation.direct.profile,directInputs:vault.inputs.observation.direct.files,linkInputs,
      headers:vault.inputs.observation.headers,discoveries:vault.inputs.observation.discoveries,
      commands:vault.children.filter(c=>c.phase!=='ignored-parent').map(receipt),preflight:receipt(vault.children[0]),
      imports,exports,dependencies,outputs:{bundle:bundle.observation,depfile:depfile.observation}};
    publishManifest(manifest);for(const p of vault.outputs)terminalize(p);syncOccurrence(vault.generation,'terminal-generation');recheckTerminal();
    const observation=Object.freeze({schema:manifest.schema,authority:'native-sidecar-build-only',generation:gen,
      manifest:Object.freeze({locator:vault.manifest.locator,byteLength:Number(vault.manifest.stats.size),sha256:vault.manifest.sha256})});
    alive();return Object.freeze({observation,recheck,close});
  }catch{burn();refuse()}finally{vault.active=false}
}
export async function prepareDashboardCutoverNativeSidecarV2(){return prepareFixed(V2,arguments.length)}
export async function prepareDashboardCutoverNativeSidecarV4(){return prepareFixed(V4,arguments.length)}
