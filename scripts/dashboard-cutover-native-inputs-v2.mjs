// Retained DIRECT input DATA only. No compile/load/Mach/startup authority.
import {createHash} from 'node:crypto';
import {constants,openSync,closeSync,lstatSync,fstatSync,readSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {holdCurrentFinalizedSetfarmSourceBuildV1} from './build-generation-retention.mjs';

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
const FILE_LIMIT=512*1024*1024,TOTAL_LIMIT=1024*1024*1024,FD_LIMIT=256,BLOCK=65536;
const identity=['dev','ino','uid','gid','mode','birthtimeNs'];
const treeKeys=[...identity,'mtimeNs','ctimeNs'];
const fileKeys=[...treeKeys,'nlink','size'];
const vault={attempted:false,active:false,burned:false,revocations:0,closed:false,source:null,
  sourceCloseAttempted:false,pins:[],directories:new Map(),files:[],uid:null};

function refuse(){throw new Error('DASHBOARD_CUTOVER_NATIVE_INPUTS_REFUSED')}
function burn(){vault.burned=true;vault.revocations++}
function alive(){if(!vault.active||vault.burned||vault.closed)refuse()}
function enter(){if(vault.active){burn();refuse()}vault.active=true}
function same(a,b,keys){return keys.every(k=>a[k]===b[k])}
function port(body){alive();const value=body();alive();return value}
function within(root,p){return p===root||p.startsWith(root+path.sep)}
function profile(){
  return process.platform==='darwin'&&process.arch==='arm64'&&process.version==='v26.4.0'
    &&process.execPath===NODE&&Number(process.versions.napi)>=8
    &&Number.isSafeInteger(process.getuid())&&process.getuid()>0;
}
function currentProfile(){if(!profile()||BigInt(process.getuid())!==vault.uid)refuse()}
function checkPin(pin){
  if(pin.state!=='held'||!Number.isInteger(pin.fd))refuse();
  const keys=pin.file?fileKeys:pin.tree?treeKeys:identity;
  const actual=port(()=>fstatSync(pin.fd,{bigint:true}));
  if(!same(pin.stats,actual,keys))refuse();
  const named=port(()=>lstatSync(pin.locator,{bigint:true}));
  if(!same(pin.stats,named,keys))refuse();
}
function checkDirectories(){for(const pin of vault.directories.values())checkPin(pin)}
function openOriginal(locator,stats,file,tree){
  if(vault.pins.length>=FD_LIMIT)refuse();
  const pin={locator,stats,file,tree,fd:null,state:'opening'};
  vault.pins.push(pin); // Original occurrence exists BEFORE open admission.
  alive();const fd=openSync(locator,constants.O_RDONLY|constants.O_NOFOLLOW|
    (file?constants.O_NONBLOCK:constants.O_DIRECTORY));
  pin.fd=fd;pin.state='held'; // Seal returned original BEFORE burn checks.
  alive();checkPin(pin);return pin;
}
function holdDirectory(locator,privateTree){
  if(vault.directories.has(locator)){
    const original=vault.directories.get(locator);
    if(privateTree&&!original.tree){
      if((original.stats.uid!==0n&&original.stats.uid!==vault.uid)||(original.stats.mode&0o022n))refuse();
      original.tree=true;checkPin(original);
    }
    return;
  }
  checkDirectories();
  const stats=port(()=>lstatSync(locator,{bigint:true}));
  if(!stats.isDirectory()||stats.isSymbolicLink())refuse();
  const own=within(ROOT,locator);
  if((own||privateTree)&&((own?stats.uid!==vault.uid:stats.uid!==0n&&stats.uid!==vault.uid)
    ||(stats.mode&0o022n)))refuse();
  const pin=openOriginal(locator,stats,false,own||privateTree);
  vault.directories.set(locator,pin);checkDirectories();
}
function holdAncestors(locator,anchor){
  const pieces=locator.split(path.sep).filter(Boolean);
  if(pieces.length>128)refuse();
  for(let i=0;i<=pieces.length;i++){
    const p=path.join(path.parse(locator).root,...pieces.slice(0,i));
    holdDirectory(p,within(anchor,p));
  }
}
function streamHash(pin){
  checkPin(pin);const size=Number(pin.stats.size);
  if(!Number.isSafeInteger(size)||size<=0||size>FILE_LIMIT)refuse();
  const hash=createHash('sha256'),block=Buffer.allocUnsafe(BLOCK);
  for(let position=0;position<size;){
    const length=Math.min(BLOCK,size-position);
    const count=port(()=>readSync(pin.fd,block,0,length,position));
    if(count!==length)refuse();
    hash.update(block.subarray(0,count));position+=count;
  }
  checkPin(pin);return hash.digest('hex');
}
function holdFile(role,locator,anchor){
  holdAncestors(path.dirname(locator),anchor);
  const stats=port(()=>lstatSync(locator,{bigint:true}));
  const own=within(ROOT,locator);
  if(!stats.isFile()||stats.isSymbolicLink()||stats.nlink!==1n||(stats.mode&0o022n)
    ||(own?stats.uid!==vault.uid:stats.uid!==0n&&stats.uid!==vault.uid)
    ||stats.size<=0n||stats.size>BigInt(FILE_LIMIT))refuse();
  const total=vault.files.reduce((sum,p)=>sum+p.stats.size,0n)+stats.size;
  if(total>BigInt(TOTAL_LIMIT))refuse();
  const pin=openOriginal(locator,stats,true,false);
  pin.role=role;vault.files.push(pin);pin.sha256=streamHash(pin);
  checkDirectories();return Object.freeze({role,locator,byteLength:Number(stats.size),sha256:pin.sha256});
}
function recheckOriginals(){
  currentProfile();alive();vault.source.recheck();alive();
  checkDirectories();
  for(const pin of vault.files)if(streamHash(pin)!==pin.sha256)refuse();
  checkDirectories();vault.source.recheck();alive();
}
function recheck(){
  if(vault.active){burn();refuse()}
  if(arguments.length)refuse();
  if(vault.burned||vault.closed)refuse();
  enter();
  try{recheckOriginals()}catch{vault.burned=true;refuse()}finally{vault.active=false}
}
function close(){
  if(vault.active){burn();refuse()}
  if(arguments.length)refuse();
  if(vault.closed)return;
  enter();vault.closed=true;const originalRevocations=vault.revocations;
  try{
    // Closure is a separate checked-once operation; burn does not authorize retry.
    for(let i=vault.pins.length-1;i>=0;i--){
      const pin=vault.pins[i];
      if(pin.state!=='held')refuse();
      pin.state='validating-close';
      try{pin.closeStat=fstatSync(pin.fd,{bigint:true})}catch{pin.state='unknown';refuse()}
      if(vault.revocations!==originalRevocations
        ||!same(pin.stats,pin.closeStat,['dev','ino','birthtimeNs'])
        ||(pin.file?!pin.closeStat.isFile():!pin.closeStat.isDirectory())){
        pin.state='unknown';refuse();
      }
      pin.state='closing';
      try{closeSync(pin.fd);pin.state='closed'}catch{pin.state='unknown';refuse()}
      if(vault.revocations!==originalRevocations)refuse();
    }
    vault.sourceCloseAttempted=true;vault.source.close();
    if(vault.revocations!==originalRevocations)refuse();
  }catch{vault.burned=true;refuse()}finally{vault.active=false}
}
export function holdDashboardCutoverNativeInputsV2(){
  if(vault.active){burn();refuse()}
  if(arguments.length||!profile())refuse();
  if(vault.attempted||vault.burned||vault.closed)refuse();
  enter();vault.attempted=true;vault.uid=BigInt(process.getuid());
  try{
    alive();vault.source=holdCurrentFinalizedSetfarmSourceBuildV1();alive();
    const files=[];
    files.push(holdFile('source',path.join(ROOT,'scripts/dashboard-cutover-mach-peer-v2.c'),ROOT));
    for(const [role,locator,anchor] of [['node',NODE,path.dirname(path.dirname(NODE))],
      ['clang',CLANG,CLT],['ld',LD,CLT],['nm',NM,CLT],['otool',OTOOL,CLT]])files.push(holdFile(role,locator,anchor));
    holdAncestors(SDK,CLT);holdAncestors(RESOURCE,CLT);
    for(const name of ['node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h'])
      files.push(holdFile(name,path.join(HEADERS,name),path.dirname(path.dirname(NODE))));
    recheckOriginals();
    const observation=Object.freeze({schema:'setfarm.internal-production-dashboard-native-direct-inputs.v2',
      authority:'direct-inputs-only',profile:Object.freeze({platform:'darwin',arch:'arm64',nodeVersion:'26.4.0',
        napiVersion:8,sdk:SDK,resource:RESOURCE}),sourceBuild:vault.source.observation,files:Object.freeze(files)});
    alive();
    return Object.freeze({observation,recheck,close});
  }catch{vault.burned=true;refuse()}finally{vault.active=false}
}
