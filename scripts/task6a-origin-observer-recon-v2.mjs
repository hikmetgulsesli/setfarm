import process from 'node:process';
import {spawn} from 'node:child_process';
import {lstatSync,openSync,readFileSync,fstatSync,closeSync,constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';

// Ordinary format exploration ONLY. Never invoke as root or infer protected
// source/native authority from this user-owned Node test program or its JSON.
const ENV={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
const VMHASH='9e2b3e0653ca8c4bdde2ea17c01f6f8e1eecab3658aa470b5e6f511c55f59928';
const PERLHASH='abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0';
function refuse() {throw Error('TASK6A_ORIGIN_OBSERVER_RECON_REFUSED');}
function pinned(path,hash) {
  const before=lstatSync(path);
  if(!before.isFile()||before.isSymbolicLink()||before.uid!==0||before.gid!==0
    ||(before.mode&0o7777)!==0o755||before.nlink!==1||before.size>1048576)refuse();
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const opened=fstatSync(fd),bytes=readFileSync(fd),after=fstatSync(fd),again=lstatSync(path);
    for(const value of [opened,after,again])for(const key of ['dev','ino','mode','uid','gid','nlink','size','mtimeMs','ctimeMs'])
      if(value[key]!==before[key])refuse();
    if(createHash('sha256').update(bytes).digest('hex')!==hash)refuse();
  } finally {closeSync(fd);}
}
function managed(tool,args,env=ENV) {
  const child=spawn(tool,args,{cwd:'/',env,stdio:['pipe','pipe','pipe']});
  const record={child,pid:child.pid,closed:false,exited:false,out:'',err:'',fault:null};
  let rejectFault;
  record.faulted=new Promise((_,reject)=>{rejectFault=reject;});record.faulted.catch(()=>{});
  const fault=error=>{record.fault=error;rejectFault(error);};
  record.done=new Promise(resolve=>{
    child.once('error',fault);
    child.once('exit',()=>{record.exited=true;});
    child.once('close',(code,signal)=>{Object.assign(record,{closed:true,exited:true,code,signal});resolve(record);});
  });
  child.stdin.on('error',fault);
  for(const [stream,key,cap] of [[child.stdout,'out',8388608],[child.stderr,'err',65536]]) {
    stream.on('error',fault);
    stream.on('data',bytes=>{
      if(record[key].length+bytes.length>cap){fault(Error('output bound'));return;}
      record[key]+=bytes.toString('latin1');
    });
  }
  return record;
}
async function within(done,ms) {
  let timer;
  try {return await Promise.race([done,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('deadline')),ms);})]);}
  finally {clearTimeout(timer);}
}
async function shutdown(record) {
  if(!record||record.closed)return;
  let inputFault=false;
  try {record.child.stdin.end();}catch(error) {record.fault=error;inputFault=true;}
  for(const [signal,ms] of [[null,5000],['SIGTERM',2000],['SIGKILL',2000]]) {
    if(record.closed)break;
    // exit delivered means libuv has reaped: NEVER signal after that edge.
    if(signal&&!record.exited) {
      if(!Number.isInteger(record.pid)||record.pid<2||!record.child.kill(signal))refuse();
    }
    try {await within(record.done,ms);}catch{}
  }
  if(!record.closed||inputFault)refuse();
}
async function ready(target,cancelled) {
  const deadline=performance.now()+5000;
  while(target.out!=='READY\n') {
    if(cancelled()||target.closed||target.fault||!('READY\n'.startsWith(target.out))||performance.now()>=deadline)refuse();
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  if(cancelled()||target.closed||target.exited||target.fault)refuse();
}
async function run() {
  if(process.platform!=='darwin'||typeof process.getuid!=='function'||typeof process.geteuid!=='function'
    ||process.getuid()===0||process.geteuid()===0||process.getuid()!==process.geteuid()
    ||process.argv.length!==2)refuse();
  // Sampled physical pins only, not root installation/native admission.
  pinned('/usr/bin/vmmap',VMHASH);pinned('/usr/bin/perl',PERLHASH);
  let target,observer,diagnostic,failed=false,cancelled=false;
  let rejectAbort;
  const abort=new Promise((_,reject)=>{rejectAbort=reject;});abort.catch(()=>{});
  const cancel=()=>{cancelled=true;rejectAbort(Error('cancelled'));};
  for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.on(signal,cancel);
  try {
    target=managed('/usr/bin/perl',['-f','-e',
      'BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34"); } use strict; use warnings; $|=1; $SIG{ALRM}=sub {exit 2}; alarm 20; print "READY\\n"; while(defined(my $line=<STDIN>)) {exit 2;} exit 0;']);
    await ready(target,()=>cancelled);
    if(cancelled||!Number.isInteger(target.pid)||target.pid<2)refuse();
    observer=managed('/usr/bin/vmmap',['-w','-noCoalesce','-interleaved',String(target.pid)],
      {...ENV,DT_NO_RESPAWN:'1'});
    await within(Promise.race([observer.done,observer.faulted,target.faulted,
      target.done.then(()=>refuse()),abort]),10000);
    if(cancelled||observer.fault||observer.code!==0||observer.signal!==null||observer.err!==''
      ||target.closed||target.exited||target.fault||target.out!=='READY\n')refuse();
    const lines=observer.out.split('\n');
    const headers=lines.filter(line=>/^Process:/.test(line));
    if(headers.length!==1||!new RegExp(`^Process:\\s+\\S+\\s+\\[${target.pid}\\]$`).test(headers[0]))refuse();
    const regions=lines.filter(line=>/(?:^|\s)[r-][w-][x-]\/[r-][w-][x-](?:\s|$)/.test(line));
    if(regions.length<1)refuse();
    const paths=[...new Set(regions.flatMap(line=>{const m=line.match(/ (\/[^\r\n]+)$/);return m?[m[1]]:[];}))];
    diagnostic={schema:'setfarm.task6a-origin-observer-recon.v2',scope:'ordinary-owned-child-map-diagnostic-only',
      productionAuthority:false,observerSha256:VMHASH,targetPid:target.pid,
      regionCount:regions.length,nativePaths:paths,mapText:observer.out};
  } catch {failed=true;}
  finally {
    // Observer may suspend its own target. Unknown resume is never success:
    // settle exact helper then target; KILL/reap a stuck target, never reuse it.
    for(const record of [observer,target])try {await shutdown(record);}catch {failed=true;}
    for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.off(signal,cancel);
  }
  if(cancelled||failed||!observer?.closed||!target?.closed||target.fault||target.code!==0||target.signal!==null)refuse();
  return {...diagnostic,observerDefinitelyClosed:true,targetDefinitelyClosed:true};
}
try {process.stdout.write(JSON.stringify(await run())+'\n');}
catch {process.stderr.write('TASK6A_ORIGIN_OBSERVER_RECON_REFUSED\n');process.exitCode=2;}
