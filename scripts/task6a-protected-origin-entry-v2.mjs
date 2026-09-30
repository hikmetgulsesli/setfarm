import process from 'node:process';
import {setTimeout,clearTimeout} from 'node:timers';

// Private protocol only. No child-reported PID, source, vendor or origin facts.
// The admitted parent owns direct exec, physical pins and native observations.
let stopped=false;
function refuse() {
  if(stopped)return;
  stopped=true;
  process.stderr.write('TASK6A_ORIGIN_ENTRY_REFUSED\n');
  process.exit(2);
}
process.stderr.on('error',()=>process.exit(2));
process.stdout.on('error',refuse);
process.stdin.on('error',refuse);
if(process.argv.length!==2||process.execArgv.length!==0||process.env.NODE_OPTIONS)refuse();

const deadline=process.hrtime.bigint()+20_000_000_000n;
const timer=setTimeout(refuse,20_000);
let pending=Buffer.alloc(0),total=0,ending=false;
const seen=new Set();
function alive() {if(process.hrtime.bigint()>=deadline)refuse();return !stopped;}
function write(line) {
  if(!alive())return;
  process.stdout.write(line,error=>{if(error)refuse();else alive();});
}
process.stdin.on('data',bytes=>{
  if(!alive())return;
  total+=bytes.length;
  if(ending||total>229)return refuse();
  pending=Buffer.concat([pending,bytes]);
  while(pending.length) {
    const end=pending.indexOf(10);
    if(end<0) {if(pending.length>74)refuse();return;}
    const line=pending.subarray(0,end).toString('latin1');
    pending=pending.subarray(end+1);
    if(line==='END') {
      if(seen.size!==3||pending.length)return refuse();
      ending=true;return;
    }
    const match=/^CHALLENGE ([0-9a-f]{64})$/.exec(line);
    if(!match||seen.size===3||seen.has(match[1]))return refuse();
    seen.add(match[1]);write(`PONG ${match[1]}\n`);
  }
});
process.stdin.on('end',()=>{
  if(!alive())return;
  if(!ending||pending.length||seen.size!==3)return refuse();
  process.stdout.end('END\n',error=>{
    if(error)return refuse();
    if(!alive())return;
    stopped=true;clearTimeout(timer);process.exit(0);
  });
});
write('READY\n');
