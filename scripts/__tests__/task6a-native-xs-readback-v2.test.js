import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {componentSourceWithoutJointOrchestration} from './fixtures/task6a-consumer-epoch-native-v1.mjs';

const BOOTSTRAP=new URL('../task6a-protected-origin-bootstrap-v2.pl',import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ordinary=process.platform==='darwin'&&process.getuid?.()!==0&&process.getuid?.()===process.geteuid?.();
const GUARD=String.raw`# Cold entry stays closed before any candidate PM/XS import.
BEGIN {
    CORE::print STDERR "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
    CORE::exit(2);
}
`;
function once(source,from,to) {
  assert.equal(source.split(from).length,2,'unique disclosed memory substitution');
  return source.replace(from,()=>to);
}
function inXs(source,from,to) {
  const begin='# Inert fixed XS native readback prerequisite.';
  const end='# End fixed XS native readback prerequisite.';
  assert.equal(source.split(begin).length,2);assert.equal(source.split(end).length,2);
  const a=source.indexOf(begin),z=source.indexOf(end);assert.ok(z>a);
  return source.slice(0,a)+once(source.slice(a,z),from,to)+source.slice(z);
}

// Retain the previously reviewed direct-child capture; per-original360+15,
// native stdout64MiB/stderr64KiB, no guessed child/group or unknown close.
async function capture(home,creation) {
  const records=[{name:'stdout',limit:67108864},{name:'stderr',limit:65536}];
  const failures=[],signals=[];let child,exit=null,close=null,dataEvents=0,stopping=false;
  let normalTimer,killTimer,finalTimer,finalized=false,resolveFinal;
  const settled=new Promise(resolve=>{resolveFinal=resolve;});
  for(const record of records)Object.assign(record,{fd:null,received:0,written:0,chunks:[],ended:false,overflow:false,partial:false,hash:createHash('sha256')});
  function finalize(reason) {
    if(finalized)return;finalized=true;
    clearTimeout(normalTimer);clearTimeout(killTimer);clearTimeout(finalTimer);
    if(reason)failures.push(reason);
    try {
      for(const record of records) {
        // Settle each exact owned pipe independently; never skip later ones.
        record.pipeDestroyAttempted=false;record.pipeDestroyError=null;
        try{if(record.stream&&!record.stream.destroyed){record.pipeDestroyAttempted=true;record.stream.destroy();}}
        catch(error){record.pipeDestroyError=error.code??error.message;failures.push('owned pipe destroy: '+record.pipeDestroyError);}
      }
      if(child&&exit===null) {
        try{child.unref();}catch(error){failures.push('unknown owned child unref: '+(error.code??error.message));}
      }
    }finally{resolveFinal();}
  }
  function signal(name) {
    const outcome={name,intent:true,returned:null,error:null};signals.push(outcome);
    try{outcome.returned=child.kill(name);}catch(error){outcome.error=error.code??error.message;}
    if(outcome.error||outcome.returned!==true)failures.push('owned signal unqualified: '+name);
  }
  function stop(reason) {
    if(finalized)return;
    failures.push(reason);if(stopping)return;stopping=true;
    if(child&&Number.isInteger(child.pid)&&exit===null)signal('SIGTERM');
    killTimer=setTimeout(()=>{if(child&&Number.isInteger(child.pid)&&exit===null)signal('SIGKILL');},5000);
    finalTimer=setTimeout(()=>finalize('15-second reserved capture cleanup exhausted; settlement UNKNOWN unless separately exited'),15000);
  }
  try {
    for(const record of records)record.fd=fs.openSync(home+'/'+record.name+'.log','wx',0o600);
    child=spawn(creation.executable,creation.args,{cwd:creation.cwd,env:creation.env,stdio:['ignore','pipe','pipe'],shell:false});
    records[0].stream=child.stdout;records[1].stream=child.stderr;
    child.on('error',error=>stop('spawn: '+(error.code??error.message)));
    child.on('exit',(status,signal)=>{exit={status,signal};});
    child.on('close',(status,signal)=>{close={status,signal};finalize();});
    normalTimer=setTimeout(()=>stop('360-second ordinary capture deadline'),360000);
    for(const record of records) {
      if(!record.stream){stop('missing '+record.name);continue;}
      record.stream.on('data',bytes=>{
        if(finalized)return;
        record.received+=bytes.length;dataEvents++;
        // Retain cap plus one sentinel; any excess is explicit unqualified output.
        const remaining=Math.max(0,record.limit+1-record.written),prefix=bytes.subarray(0,remaining);
        let offset=0;
        try {
          while(offset<prefix.length) {
            const count=fs.writeSync(record.fd,prefix,offset,prefix.length-offset);
            if(count<=0)throw new Error('short capture write');
            const written=Buffer.from(prefix.subarray(offset,offset+count));
            record.hash.update(written);record.chunks.push(written);record.written+=count;offset+=count;
          }
        }catch(error){record.partial=true;stop('capture write: '+(error.code??error.message));}
        if(record.received>record.limit||dataEvents>16384) {
          record.overflow=true;stop('bounded output/data-event overflow; retained prefix only, unqualified');
        }
      });
      record.stream.on('end',()=>{record.ended=true;});
      record.stream.on('error',error=>stop('stream: '+(error.code??error.message)));
    }
    try{fs.writeFileSync(home+'/parent-creation.json',JSON.stringify({pid:process.pid,childPID:child.pid??null,creation})+'\n',{flag:'wx',mode:0o600});}
    catch(error){stop('parent creation: '+(error.code??error.message));}
    await settled;
  }catch(error) {
    failures.push('capture setup: '+(error.code??error.message));
    if(child){stop('setup after owned spawn');await settled;}else finalize();
  }finally {
    clearTimeout(normalTimer);clearTimeout(killTimer);clearTimeout(finalTimer);
    for(const record of records)if(record.fd!==null) {
      record.fileCloseAttempted=true;
      try{fs.closeSync(record.fd);record.fileCloseError=null;}catch(error){record.fileCloseError=error.code??error.message;failures.push('capture file close: '+record.fileCloseError);}
    }
  }
  const terminal={pid:child?.pid??null,exit,close,dataEvents,forced:stopping,signals,failures,
    settlement:exit!==null&&close!==null?'observed':'UNKNOWN',
    streams:records.map(record=>({name:record.name,received:record.received,written:record.written,sha256:record.hash.digest('hex'),ended:record.ended,limit:record.limit,overflow:record.overflow,partial:record.partial,pipeDestroyAttempted:record.pipeDestroyAttempted??false,pipeDestroyError:record.pipeDestroyError??null,fileCloseAttempted:record.fileCloseAttempted??false,fileCloseError:record.fileCloseError??null}))};
  fs.writeFileSync(home+'/terminal.json',JSON.stringify(terminal)+'\n',{flag:'wx',mode:0o600});
  assert.deepEqual(failures,[]);assert.equal(stopping,false);assert.deepEqual(exit,close);
  assert.ok(records.every(record=>record.ended&&record.received===record.written));assert.equal(exit?.signal,null);
  const stdout=Buffer.concat(records[0].chunks).toString('utf8'),stderr=Buffer.concat(records[1].chunks).toString('utf8');
  assert.equal(exit?.status,creation.expectedStatus??0,stdout.slice(-4096)+stderr);assert.equal(stderr,'');
  return {pid:terminal.pid,stdout};
}


async function invokeRelease(mode,options={}) {
  assert.ok(ordinary,'ordinary Darwin only');
  const original=fs.readFileSync(BOOTSTRAP,'utf8');const component=componentSourceWithoutJointOrchestration(original);
  // Missing private support is mechanical BEFORE Perl, not protocol/native RED.
  assert.ok(original.includes('my ($xs_native_readback_issue,'),'private XS support prerequisite; no Perl/control dispatch on failure');
  const home=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'task6a-native-xs-release.'));
  let source=once(component.source,GUARD,String.raw`BEGIN {CORE::die "TEST_ORDINARY_ONLY\n" unless $^O eq 'darwin'&&$<!=0&&$<==$>&&@ARGV==0;}
`);
  source=once(source,'# Inert fixed XS native readback prerequisite.','my $xs_test_probe;\n# Inert fixed XS native readback prerequisite.');
  source=inXs(source,'        # Private XS lifecycle closures end here.',String.raw`        $xs_test_probe=sub {
            my $label=$_[0];
            for my $pair(['phase',$xs_phase],['claimed',$xs_claimed],['native-actions',$xs_operations],
                ['originals',CORE::scalar(@xs_originals)],['release-api-started',$xs_release_api_started],
                ['release-api-outcome',defined($xs_release_api_outcome)?$xs_release_api_outcome:'UNDEF'],
                ['release-api-error',CORE::unpack('H*',$xs_release_api_error)],
                ['settle-started',$xs_settle_started],['settle-outcome',defined($xs_settle_outcome)?$xs_settle_outcome:'UNDEF'],
                ['settle-error',CORE::unpack('H*',$xs_settle_error)]) {
                CORE::print $label,'-',$pair->[0],"\t",$pair->[1],"\n";
            }
        };
        # Private XS lifecycle closures end here.`);
  const call=label=>String.raw`{
      my $return;my $ok=eval {$return=$xs_native_readback_release->(ARGS);1;};my $error=$@;
      CORE::print "LABEL-ok\t",$ok?1:0,"\n";
      CORE::print "LABEL-return\t",defined($return)?$return:'UNDEF',"\n";
      CORE::print "LABEL-error\t",CORE::unpack('H*',$error),"\n";
    }
`.replaceAll('LABEL',label).replace('ARGS',label==='first'?mode==='wrong-first'?'undef':'':label==='wrong-after'?'undef':'');
  let action=String.raw`$xs_test_probe->('initial');`+call('first')+String.raw`$xs_test_probe->('after-first');`;
  if(mode==='valid-first')action+=call('wrong-after')+String.raw`$xs_test_probe->('after-wrong');`;
  action+=call('again')+String.raw`$xs_test_probe->('after-again');my $issue;my $ok=eval {$issue=$xs_native_readback_issue->();1;};my $error=$@;
    CORE::print "later-issue-ok\t",$ok?1:0,"\n";
    CORE::print "later-issue-error\t",CORE::unpack('H*',$error),"\n";
    $xs_test_probe->('after-issue');CORE::exit(0);
`;
  source=once(source,'use strict;\n','BEGIN {\n'+action+'}\nuse strict;\n');
  source=once(source,'\ntask6a_origin_main();\n','\n');
  const creation={mode,scope:'ordinary CPU private release phase only; no positive XS/PM issue or file/native dispatch; initial runtime conditional',sourceSHA256:sha(original),componentProjection:component.disclosure,programSHA256:sha(source),executable:'/usr/bin/perl',args:['-f',home+'/program.pl'],cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},expectedStatus:0};
  fs.writeFileSync(home+'/program.pl',source,{flag:'wx',mode:0o600});fs.writeFileSync(home+'/creation.json',JSON.stringify(creation)+'\n',{flag:'wx',mode:0o600});
  if(options.prepareOnly)return {home,creation,scope:'program preparation only; zero Perl'};
  const child=await capture(home,creation);const rows=child.stdout.replace(/\n$/,'').split('\n').map(row=>row.split('\t'));
  assert.ok(rows.every(row=>row.length===2));assert.equal(new Set(rows.map(row=>row[0])).size,rows.length);
  return {home,pid:child.pid,observations:Object.fromEntries(rows)};
}
const REFUSAL=Buffer.from('TASK6A_NATIVE_XS_READBACK_REFUSED\n').toString('hex');
function assertSnapshot(o,label,phase,apiOutcome,apiError,started='1') {
  assert.equal(o[label+'-phase'],phase);assert.equal(o[label+'-claimed'],'0');
  assert.equal(o[label+'-native-actions'],'0');assert.equal(o[label+'-originals'],'0');
  assert.equal(o[label+'-release-api-started'],started);assert.equal(o[label+'-release-api-outcome'],apiOutcome);
  assert.equal(o[label+'-release-api-error'],apiError);assert.equal(o[label+'-settle-started'],started);
  assert.equal(o[label+'-settle-outcome'],started==='1'?'1':'UNDEF');assert.equal(o[label+'-settle-error'],'');
}
test('first invalid XS release remains API failure even with no physical originals',async t=>{
  const r=await invokeRelease('wrong-first'),o=r.observations;
  assertSnapshot(o,'initial','new','UNDEF','','0');
  for(const label of ['first','again']){assert.equal(o[label+'-ok'],'0');assert.equal(o[label+'-return'],'UNDEF');assert.equal(o[label+'-error'],REFUSAL);}
  for(const label of ['after-first','after-again','after-issue'])assertSnapshot(o,label,'burned','0',REFUSAL);
  assert.equal(o['later-issue-ok'],'0');assert.equal(o['later-issue-error'],REFUSAL);
  t.diagnostic(JSON.stringify(r));
});
test('wrong arity after valid XS release preserves first result and performs no new effects',async t=>{
  const r=await invokeRelease('valid-first'),o=r.observations;
  assertSnapshot(o,'initial','new','UNDEF','','0');assertSnapshot(o,'after-first','released','1','');
  for(const label of ['first','again']){assert.equal(o[label+'-ok'],'1');assert.equal(o[label+'-return'],'1');assert.equal(o[label+'-error'],'');}
  assert.equal(o['wrong-after-ok'],'0');assert.equal(o['wrong-after-return'],'UNDEF');assert.equal(o['wrong-after-error'],REFUSAL);
  for(const label of ['after-wrong','after-again','after-issue'])assertSnapshot(o,label,'burned','1','');
  assert.equal(o['later-issue-ok'],'0');assert.equal(o['later-issue-error'],REFUSAL);
  t.diagnostic(JSON.stringify(r));
});

const xsDirectories=[
  "/",
  "/System",
  "/System/Library",
  "/System/Library/Perl",
  "/System/Library/Perl/5.34",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/B",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Compress",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Digest",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Encode",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Fcntl",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/File",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/IO",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/List",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/MIME",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/POSIX",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/PerlIO",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Storable",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Time",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Compress/Raw",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Digest/SHA",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/File/Glob",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/List/Util",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/MIME/Base64",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/PerlIO/scalar",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Time/HiRes",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Compress/Raw/Zlib"
];
const xsLeaves=[
  {
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/B/B.bundle",
    "bytes": 238208,
    "sha256": "cb67010fc8fd0cd9526017d1eedd509fc16e46128c80d9484814dafb278b095e"
  },
  {
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Compress/Raw/Zlib/Zlib.bundle",
    "bytes": 187504,
    "sha256": "6375b83850447c7b08e3f22c446790d5d9eb3c64ceeb12a7960febd19aa67e98"
  },
  {
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Digest/SHA/SHA.bundle",
    "bytes": 151888,
    "sha256": "0aee84231c0297e0d51e7f8523fac64cd3c8887daa644d58e957642436ec1628"
  },
  {
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Encode/Encode.bundle",
    "bytes": 154672,
    "sha256": "0d6d427f6caefb29744bee9cdde231aff56ce675397b85d296ee2767b23d6156"
  },
  {
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Fcntl/Fcntl.bundle",
    "bytes": 118688,
    "sha256": "fa9d85d04cc25eaf10ea9bfe761ddde566568c222a14f6b5043de9ed971f42ab"
  },
  {
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/File/Glob/Glob.bundle",
    "bytes": 137824,
    "sha256": "10171bdaecea588bdbc099f46f4a891dc03fa31e2155cb33476c3807f338a014"
  },
  {
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/IO/IO.bundle",
    "bytes": 120224,
    "sha256": "16943647611acf30476a89c564c14a9cf15617c17e9b44c73c81ccea724801b4"
  },
  {
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/List/Util/Util.bundle",
    "bytes": 188608,
    "sha256": "bb0c14ea99a66b4cab6d9c4ae3b39e13bd27b72b239e8d7f209d8f0e276055e9"
  },
  {
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/MIME/Base64/Base64.bundle",
    "bytes": 118400,
    "sha256": "1c7ec3c9d946c9da29e4077d0bdea7b3c89366e33d45bfa97a60f3293dcdb263"
  },
  {
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/POSIX/POSIX.bundle",
    "bytes": 242592,
    "sha256": "300b45401ae71f3b09666c107ef94404a994d11a61528202b7b184978799c754"
  },
  {
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/PerlIO/scalar/scalar.bundle",
    "bytes": 119376,
    "sha256": "3203586f1bcc6609dd971d822a96a7ef87b9e9ed7ade6df926580cd3400d641d"
  },
  {
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Storable/Storable.bundle",
    "bytes": 271712,
    "sha256": "8357bfed40e3cc39bc90cd29f180a256f1ee9adb200218ad4276633eb3355921"
  },
  {
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Time/HiRes/HiRes.bundle",
    "bytes": 119840,
    "sha256": "759c7cc87b97b1084eb8fdf3d5dd4ca3fb80b9a291823408aba1ca001316b336"
  }
];

const xsNativeProbe=String.raw`
        $xs_test_phase_probe=sub {
            CORE::die "TEST_PHASE_PROBE_ARITY\n" unless @_==0;
            return CORE::substr($xs_phase,0);
        };
        $xs_test_native_probe=sub {
            return if $xs_test_probe_started++;
            CORE::print "xs-phase\t",$xs_phase,"\n";
            CORE::print "xs-claimed\t",$xs_claimed,"\n";
            CORE::print "xs-actions\t",$xs_operations,"\n";
            CORE::print "xs-actual-dispatches\t",$xs_test_actual_calls,"\n";
            CORE::print "xs-originals\t",CORE::scalar(@xs_originals),"\n";
            CORE::print "xs-known\t",CORE::scalar(CORE::grep {$_->{known}} @xs_originals),"\n";
            CORE::print "xs-close-attempts\t",CORE::scalar(CORE::grep {$_->{close_attempted}} @xs_originals),"\n";
            CORE::print "xs-live-attempts\t",CORE::scalar(CORE::grep {$_->{live_attempted}} @xs_originals),"\n";
            CORE::print "xs-close-ok\t",CORE::scalar(CORE::grep {$_->{close_ok}} @xs_originals),"\n";
            CORE::print "xs-raw-reserved\t",$xs_raw_reserved,"\n";
            CORE::print "xs-text-reserved\t",$xs_text_reserved,"\n";
            for my $record(@xs_originals) {
                my $index=$record->{index};CORE::print 'xs-original:',$index,"\t",$record->{path},"\n";
                if($record->{known}) {
                    CORE::print 'xs-raw-handle:',$index,"\t",CORE::sprintf('%x',0+$record->{handle}),"\n";
                    CORE::print 'xs-raw-io:',$index,"\t",CORE::sprintf('%x',0+$record->{io}),"\n";
                }
                for my $field('close_return','close_error','live_return','live_error') {
                    my $value=$record->{$field};CORE::print 'xs-cleanup:',$index,':',$field,"\t",!defined($value)?'UNDEF':CORE::ref($value) ne ''?'REFERENCE':CORE::unpack('H*',$value),"\n";
                }
            }
            for my $event(@xs_native_events) {
                my $prefix='xs-event:'.$event->{sequence}.':';
                CORE::print $prefix,'kind',"\t",$event->{kind},"\n";CORE::print $prefix,'index',"\t",$event->{index},"\n";
                for my $field('result','errno','error') {
                    if(defined(CORE::tied($event->{$field}))) {CORE::print $prefix,$field,"\tTIED\n";}
                    else {my $value=$event->{$field};CORE::print $prefix,$field,"\t",!defined($value)?'UNDEF':CORE::ref($value) ne ''?'REFERENCE':CORE::unpack('H*',$value),"\n";}
                }
                if(defined($event->{values})) {
                    my $value=$event->{values};
                    CORE::print $prefix,'tuple',"\t",CORE::ref($value) eq 'ARRAY'&&!defined(CORE::tied(@$value))?CORE::join(',',@$value):'TIED_OR_REFERENCE',"\n";
                }
                CORE::print $prefix,'attributes',"\t",CORE::unpack('H*',$event->{attributes}),"\n" if defined($event->{attributes});
                if(defined($event->{buffer_cell})) {
                    if(defined(CORE::tied(${'${'} $event->{buffer_cell} }))) {CORE::print $prefix,"buffer\tTIED\n";}
                    else {CORE::print $prefix,'buffer',"\t",CORE::unpack('H*',${'${'} $event->{buffer_cell} }),"\n";}
                }
                CORE::print $prefix,'request',"\t",$event->{request},"\n" if defined($event->{request});
            }
            for my $index(0..$#xs_validated) {CORE::print 'xs-validated:',$index,"\t",CORE::unpack('H*',$xs_validated[$index]),"\n";}
        };
`;
async function invokeXsNative(mode='healthy',options={}) {
  assert.ok(ordinary,'ordinary Darwin only');
  const original=fs.readFileSync(BOOTSTRAP,'utf8');const component=componentSourceWithoutJointOrchestration(original);
  assert.ok(original.includes('my $xs_native=sub {'),'native XS ledger support prerequisite BEFORE Perl; never protocol RED');
  const home=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'task6a-native-xs-readback.'));
  const inputs=xsLeaves.map((row,i)=>{const bytes=fs.readFileSync(row.path);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);const file=home+'/'+i+'.input';fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});return {...row,file};});
  let source=once(component.source,GUARD,String.raw`BEGIN {CORE::die "TEST_ORDINARY_ONLY\n" unless $^O eq 'darwin'&&$<!=0&&$<==$>&&@ARGV==0;}
`);
  source=once(source,'# Inert fixed XS native readback prerequisite.','my ($xs_test_native_probe,$xs_test_actual_calls,$xs_test_probe_started,$xs_test_release_original,$xs_test_phase_probe);\nBEGIN {$xs_test_actual_calls=0;$xs_test_probe_started=0;}\n# Inert fixed XS native readback prerequisite.');
  source=inXs(source,'        # Private XS lifecycle closures end here.',xsNativeProbe.replaceAll("${'${'}",'${')+'        # Private XS lifecycle closures end here.');
  for(const call of [
    '$xs_event->{values}=[CORE::lstat($xs_record->{path})];',
    '$xs_event->{values}=[CORE::stat($xs_handle)];',
    '$xs_event->{result}=CORE::sysopen(${ $xs_record->{cell} },$xs_record->{path},0x01000100);',
    '$xs_event->{result}=CORE::fileno($xs_handle);',
    '$xs_event->{result}=CORE::syscall(228,$xs_fd,$xs_attributes,$xs_buffer,8192,4);',
    '$xs_event->{result}=CORE::sysseek($xs_handle,0,0);',
    '$xs_event->{result}=CORE::sysread($xs_handle,$xs_buffer,$xs_request);',
  ])source=inXs(source,call,'$xs_test_actual_calls++;'+call);
  const action=String.raw`
BEGIN {$xs_test_release_original=$xs_native_readback_release;}
END {
    my $primary=$?;my $returned;my $ok=eval {
        CORE::die "TEST_CHANGED_XS_RELEASE\n" unless !defined(CORE::tied($xs_native_readback_release))
            &&$strict_same_reference->($xs_native_readback_release,$xs_test_release_original);
        $returned=$xs_test_release_original->();1;
    };my $error=$@;
    CORE::print "end-xs-release-ok\t",$ok?1:0,"\n";
    CORE::print "end-xs-release-return\t",defined($returned)?$returned:'UNDEF',"\n";
    CORE::print "end-xs-release-error\t",CORE::unpack('H*',$error),"\n";
    my $probe_ok=eval {$xs_test_native_probe->();1;};my $probe_error=$@;
    CORE::print "end-xs-probe-ok\t",$probe_ok?1:0,"\n";CORE::print "end-xs-probe-error\t",CORE::unpack('H*',$probe_error),"\n";
    $?=$primary;if(!$ok||!$probe_ok){$?=1 unless $?;}
}
BEGIN {
    my $issued;my $ok=eval {$issued=$xs_native_readback_issue->();1;};my $error=$@;
    CORE::print "xs-issue-ok\t",$ok?1:0,"\n";CORE::print "xs-issue-return\t",defined($issued)?$issued:'UNDEF',"\n";CORE::print "xs-issue-error\t",CORE::unpack('H*',$error),"\n";
    CORE::exit(0) unless $ok;
    my $checked;my $check_ok=eval {$checked=$xs_native_readback_recheck->();1;};my $check_error=$@;
    CORE::print "xs-check-ok\t",$check_ok?1:0,"\n";CORE::print "xs-check-return\t",defined($checked)?$checked:'UNDEF',"\n";CORE::print "xs-check-error\t",CORE::unpack('H*',$check_error),"\n";
    CORE::print "xs-check-phase\t",$xs_test_phase_probe->(),"\n";
    my $released;my $release_ok=eval {$released=$xs_native_readback_release->();1;};my $release_error=$@;
    CORE::print "xs-release-ok\t",$release_ok?1:0,"\n";CORE::print "xs-release-return\t",defined($released)?$released:'UNDEF',"\n";CORE::print "xs-release-error\t",CORE::unpack('H*',$release_error),"\n";
    my $again;my $again_ok=eval {$again=$xs_native_readback_release->();1;};my $again_error=$@;
    CORE::print "xs-again-ok\t",$again_ok?1:0,"\n";CORE::print "xs-again-return\t",defined($again)?$again:'UNDEF',"\n";CORE::print "xs-again-error\t",CORE::unpack('H*',$again_error),"\n";
    my $reused=eval {$xs_native_readback_recheck->();1;};my $reuse_error=$@;
    CORE::print "xs-reuse-ok\t",$reused?1:0,"\n";CORE::print "xs-reuse-error\t",CORE::unpack('H*',$reuse_error),"\n";
    CORE::exit(0);
}
`;
  source=once(source,'use strict;\n',action+'use strict;\n');source=once(source,'\ntask6a_origin_main();\n','\n');
  if(options.mutate)source=options.mutate(source);
  const creation={mode,scope:'ordinary genuine41 XS readback DATA only; no actual XS import/loadedimage or initial runtime admission',sourceSHA256:sha(original),componentProjection:component.disclosure,programSHA256:sha(source),executable:'/usr/bin/perl',args:['-f',home+'/program.pl'],cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},expectedStatus:options.expectedStatus??0,inputs};
  fs.writeFileSync(home+'/program.pl',source,{flag:'wx',mode:0o600});fs.writeFileSync(home+'/creation.json',JSON.stringify(creation)+'\n',{flag:'wx',mode:0o600});
  if(options.prepareOnly)return {home,creation,scope:'program/input preparation only; zero Perl'};
  const child=await capture(home,creation),rows=child.stdout.replace(/\n$/,'').split('\n').map(row=>row.split('\t'));assert.ok(rows.every(row=>row.length===2));assert.equal(new Set(rows.map(row=>row[0])).size,rows.length);
  return {home,pid:child.pid,observations:Object.fromEntries(rows)};
}
test('genuine fixed41 XS owner authenticates all13 bundles and settles originals once',async t=>{
  const r=await invokeXsNative(),o=r.observations;
  for(const label of ['issue','check','release','again']){assert.equal(o['xs-'+label+'-ok'],'1');assert.equal(o['xs-'+label+'-return'],'1');assert.equal(o['xs-'+label+'-error'],'');}
  assert.equal(o['xs-check-phase'],'held');
  assert.equal(o['xs-reuse-ok'],'0');assert.equal(o['xs-reuse-error'],REFUSAL);
  assert.equal(o['xs-actual-dispatches'],'1429');assert.equal(o['xs-actions'],'1429');
  assert.equal(o['xs-originals'],'41');assert.equal(o['xs-known'],'41');
  for(const label of ['close-attempts','live-attempts','close-ok'])assert.equal(o['xs-'+label],'41');
  assert.equal(o['xs-raw-reserved'],'10539150');assert.equal(o['xs-text-reserved'],'7316480');
  const expected=xsDirectories.concat(xsLeaves.map(r=>r.path));
  for(let i=0;i<41;i++){assert.equal(o['xs-original:'+i],expected[i]);assert.equal(o['xs-cleanup:'+i+':close_return'],'31');assert.equal(o['xs-cleanup:'+i+':close_error'],'');assert.equal(o['xs-cleanup:'+i+':live_return'],'UNDEF');assert.equal(o['xs-cleanup:'+i+':live_error'],'');}
  assert.equal(new Set(Array.from({length:41},(_,i)=>o['xs-raw-handle:'+i])).size,41);assert.equal(new Set(Array.from({length:41},(_,i)=>o['xs-raw-io:'+i])).size,41);
  for(let i=0;i<13;i++){const bytes=Buffer.from(o['xs-validated:'+i],'hex');assert.equal(bytes.length,xsLeaves[i].bytes);assert.equal(sha(bytes),xsLeaves[i].sha256);assert.deepEqual(bytes,fs.readFileSync(r.home+'/'+i+'.input'));}
  assert.equal(o['end-xs-release-ok'],'1');assert.equal(o['end-xs-release-return'],'1');assert.equal(o['end-xs-release-error'],'');assert.equal(o['end-xs-probe-ok'],'1');assert.equal(o['end-xs-probe-error'],'');
  t.diagnostic(JSON.stringify({home:r.home,pid:r.pid,scope:'fixed XS readback physical lifetime only/no loadednativeimage/initialTCBRoot'}));
});

function xsBoundaryMutation(kind) {
  return source=>{
    const defs=String.raw`my ($xs_test_boundary_armed,$xs_test_genuine_values,$xs_test_genuine_metadata,$xs_test_genuine_open,$xs_test_genuine_open_event,$xs_test_outside_fetch,$xs_test_backup,$xs_test_backup_dispose,$xs_test_wire);
BEGIN {
    $xs_test_boundary_armed=0;$xs_test_outside_fetch=0;
    $xs_test_backup={known=>0,started=>0,close_attempted=>0,before_attempted=>0,after_attempted=>0};
    $xs_test_wire=sub {
        return 'TIED' if defined(CORE::tied($_[0]));
        return 'UNDEF' unless defined($_[0]);return 'REFERENCE' if CORE::ref($_[0]) ne '';
        return CORE::unpack('H*',$_[0]);
    };
}
END {
    my $primary=$?;my $returned;my $ok=eval {$returned=$xs_test_backup_dispose->();1;};my $error=$@;
    $?=$primary; # Restore incoming END status before diagnostic publication.
    CORE::print "end-xs-backup-ok\t",$ok?1:0,"\n";
    CORE::print "end-xs-backup-return\t",$xs_test_wire->($returned),"\n";
    CORE::print "end-xs-backup-error\t",$xs_test_wire->($error),"\n";
    CORE::print "end-xs-backup-known\t",$xs_test_backup->{known},"\n";
    CORE::print "end-xs-backup-started\t",$xs_test_backup->{started},"\n";
    CORE::print "end-xs-backup-close-attempted\t",$xs_test_backup->{close_attempted},"\n";
    $?=$primary;if($xs_test_backup->{known}&&(!$ok||!defined($returned)||$returned ne '1')){$?=1 unless $?;}
}
BEGIN {
    package Task6aXsMetadataTie;our $fetch=0;
    sub TIEARRAY {CORE::bless({values=>$_[1]},$_[0]);}
    sub FETCHSIZE {$fetch++;return CORE::scalar(@{$_[0]{values}});}
    sub FETCH {$fetch++;return $_[0]{values}[$_[1]];}
}
`;
    source=once(source,'# Inert fixed XS native readback prerequisite.',defs+'# Inert fixed XS native readback prerequisite.');
    const boundary=String.raw`$xs_event->{error}=$@;$xs_event->{ok}=$xs_ok?1:0;
            CORE::die $xs_literal_refusal unless $xs_ok&&$xs_error_plain->($xs_event->{error})`;
    const effect=kind==='tied-native-values'?String.raw`
            if($xs_kind eq 'lstat'&&!$xs_test_boundary_armed) {
                CORE::die "TEST_UNARMED_XS_METADATA\n" unless $xs_ok
                    &&!defined(CORE::tied($xs_event->{error}))&&$xs_error_plain->($xs_event->{error})&&$xs_event->{error} eq ''
                    &&!defined(CORE::tied($xs_event->{errno}))&&$xs_number->($xs_event->{errno})&&$xs_event->{errno}>=0
                    &&!defined(CORE::tied($xs_event->{values}));
                my $values=$xs_event->{values};
                CORE::die "TEST_UNARMED_XS_METADATA\n" unless CORE::ref($values) eq 'ARRAY'
                    &&!defined(CORE::tied(@$values))&&@$values==13;
                for my $i(0..12) {CORE::die "TEST_UNARMED_XS_METADATA\n" unless !defined(CORE::tied($values->[$i]))&&$xs_number->($values->[$i]);}
                $xs_test_genuine_values=[map {CORE::substr($_,0)} @$values];
                $xs_test_genuine_metadata={ok=>$xs_ok?1:0,errno=>CORE::substr($xs_event->{errno},0),error=>CORE::substr($xs_event->{error},0)};
                CORE::die "TEST_UNARMED_XS_METADATA\n" unless ($xs_test_genuine_values->[2]&0170000)==0040000
                    &&($xs_test_genuine_values->[2]&0022)==0&&$xs_test_genuine_values->[4]==0&&$xs_test_genuine_values->[5]==0;
                my @tied;CORE::tie(@tied,'Task6aXsMetadataTie',$xs_test_genuine_values);
                my $outside=CORE::scalar(@tied);$xs_test_outside_fetch=$Task6aXsMetadataTie::fetch;
                CORE::die "TEST_UNARMED_XS_TIE\n" unless $outside==13&&$xs_test_outside_fetch==1;
                $Task6aXsMetadataTie::fetch=0;$xs_test_boundary_armed=1;$xs_event->{values}=\@tied;
            }
`:String.raw`
            if($xs_kind eq 'open'&&!$xs_test_boundary_armed) {
                $xs_test_genuine_open_event=$xs_event;
                $xs_test_backup->{admission_started}=1;
                my $admitted=eval {
                    CORE::die "TEST_UNARMED_XS_OPEN\n" unless $xs_ok
                        &&!defined(CORE::tied($xs_event->{result}))&&$xs_plain->($xs_event->{result})&&$xs_event->{result} eq '1'
                        &&!defined(CORE::tied($xs_event->{error}))&&$xs_error_plain->($xs_event->{error})&&$xs_event->{error} eq '';
                    my ($handle,$io)=$xs_shape->(${'${'} $xs_record->{cell} });
                    $xs_test_backup->{handle}=$handle;$xs_test_backup->{io}=$io;$xs_test_backup->{known}=1;
                    1;
                };
                $xs_test_backup->{admission_error}=$@;$xs_test_backup->{admission_ok}=$admitted?1:0;
                CORE::die "TEST_UNARMED_XS_OPEN\n" unless $admitted;
                # Retained genuine pair is owned BEFORE diagnostic copies or later queries.
                $xs_test_genuine_open={ok=>$xs_ok?1:0,result=>$xs_test_wire->($xs_event->{result}),errno=>$xs_test_wire->($xs_event->{errno}),error=>$xs_test_wire->($xs_event->{error})};
                CORE::die "TEST_UNARMED_XS_OPEN_ERRNO\n" unless !defined(CORE::tied($xs_event->{errno}))&&$xs_number->($xs_event->{errno})&&$xs_event->{errno}>=0;
                $xs_test_boundary_armed=1;$xs_phase='burned';
            }
`;
    source=inXs(source,boundary,String.raw`$xs_event->{error}=$@;$xs_event->{ok}=$xs_ok?1:0;
`+effect.replaceAll("${'${'}",'${')+String.raw`            CORE::die $xs_literal_refusal unless $xs_ok&&$xs_error_plain->($xs_event->{error})`);
    const disposer=String.raw`
        $xs_test_backup_dispose=sub {
            return $xs_test_backup->{outcome} if $xs_test_backup->{started};
            $xs_test_backup->{started}=1; # Once intent BEFORE any fallible work.
            unless($xs_test_backup->{known}) {$xs_test_backup->{outcome}=0;return 0;}
            my ($handle,$io);
            my $before_ok=eval {
                ($handle,$io)=$xs_shape->($xs_test_backup->{handle});
                CORE::die "TEST_CHANGED_XS_BACKUP\n" unless $xs_raw_same->($handle,$xs_test_backup->{handle})&&$xs_raw_same->($io,$xs_test_backup->{io});
                $xs_test_backup->{before_attempted}=1;$xs_test_backup->{before_return}=CORE::fileno($handle);1;
            };
            $xs_test_backup->{before_error}=$@;$xs_test_backup->{before_ok}=$before_ok?1:0;
            if($before_ok&&defined($xs_test_backup->{before_return})) {
                my $close_ok=eval {
                    CORE::die "TEST_CHANGED_XS_BACKUP\n" unless $xs_number->($xs_test_backup->{before_return})&&$xs_test_backup->{before_return}>=0;
                    my ($h,$i)=$xs_shape->($xs_test_backup->{handle});
                    CORE::die "TEST_CHANGED_XS_BACKUP\n" unless $xs_raw_same->($h,$xs_test_backup->{handle})&&$xs_raw_same->($i,$xs_test_backup->{io});
                    $xs_test_backup->{close_attempted}=1;$xs_test_backup->{close_return}=CORE::close($h);1;
                };
                $xs_test_backup->{close_error}=$@;$xs_test_backup->{close_ok}=$close_ok?1:0;
            }
            # Independent post-close liveness, including a caught close error.
            my $after_ok=eval {
                my ($h,$i)=$xs_shape->($xs_test_backup->{handle});
                CORE::die "TEST_CHANGED_XS_BACKUP\n" unless $xs_raw_same->($h,$xs_test_backup->{handle})&&$xs_raw_same->($i,$xs_test_backup->{io});
                $xs_test_backup->{after_attempted}=1;$xs_test_backup->{after_return}=CORE::fileno($h);1;
            };
            $xs_test_backup->{after_error}=$@;$xs_test_backup->{after_ok}=$after_ok?1:0;
            my $closed=!defined($xs_test_backup->{before_return})&&!$xs_test_backup->{close_attempted}
                ||$xs_test_backup->{close_ok}&&$xs_plain->($xs_test_backup->{close_return})&&$xs_test_backup->{close_return} eq '1'
                    &&$xs_error_plain->($xs_test_backup->{close_error})&&$xs_test_backup->{close_error} eq '';
            $xs_test_backup->{outcome}=$before_ok&&$xs_error_plain->($xs_test_backup->{before_error})&&$xs_test_backup->{before_error} eq ''
                &&$after_ok&&!defined($xs_test_backup->{after_return})&&$xs_error_plain->($xs_test_backup->{after_error})&&$xs_test_backup->{after_error} eq ''&&$closed?1:0;
            return $xs_test_backup->{outcome};
        };
`;
    source=inXs(source,'        # Private XS lifecycle closures end here.',disposer+'        # Private XS lifecycle closures end here.');
    const extra=String.raw`
            CORE::print "xs-boundary-armed\t",$xs_test_boundary_armed,"\n";
            CORE::print "xs-outside-fetch\t",$xs_test_outside_fetch,"\n";
            CORE::print "xs-inside-fetch\t",$Task6aXsMetadataTie::fetch,"\n";
            CORE::print "xs-genuine-tuple\t",CORE::join(',',@$xs_test_genuine_values),"\n" if defined($xs_test_genuine_values);
            if(defined($xs_test_genuine_metadata)) {
                CORE::print "xs-genuine-lstat-ok\t",$xs_test_genuine_metadata->{ok},"\n";
                for my $field('errno','error') {CORE::print 'xs-genuine-lstat-',$field,"\t",$xs_test_wire->($xs_test_genuine_metadata->{$field}),"\n";}
            }
            if(defined($xs_test_genuine_open)) {
                CORE::print "xs-genuine-open-ok\t",$xs_test_genuine_open->{ok},"\n";
                CORE::print "xs-backup-raw-handle\t",CORE::sprintf("%x",0+$xs_test_backup->{handle}),"\n";
                CORE::print "xs-backup-raw-io\t",CORE::sprintf("%x",0+$xs_test_backup->{io}),"\n";
                for my $field('result','errno','error') {CORE::print 'xs-genuine-open-',$field,"\t",$xs_test_genuine_open->{$field},"\n";}
                my $returned;my $ok=eval {$returned=$xs_test_backup_dispose->();1;};my $error=$@;
                CORE::print "xs-backup-dispose-ok\t",$ok?1:0,"\n";CORE::print "xs-backup-dispose-return\t",$xs_test_wire->($returned),"\n";CORE::print "xs-backup-dispose-error\t",$xs_test_wire->($error),"\n";
                for my $field('known','started','admission_started','admission_ok','before_attempted','before_ok','close_attempted','close_ok','after_attempted','after_ok','outcome') {
                    CORE::print 'xs-backup-',$field,"\t",defined($xs_test_backup->{$field})?$xs_test_backup->{$field}:'UNDEF',"\n";
                }
                for my $field('admission_error','before_return','before_error','close_return','close_error','after_return','after_error') {
                    CORE::print 'xs-backup-',$field,"\t",$xs_test_wire->($xs_test_backup->{$field}),"\n";
                }
                CORE::print "xs-independent-live\t",defined($xs_test_backup->{before_return})?1:0,"\n";
                CORE::print "xs-independent-live-ok\t",$xs_test_backup->{before_ok},"\n";
                CORE::print "xs-independent-live-error\t",$xs_test_wire->($xs_test_backup->{before_error}),"\n";
                CORE::print "xs-test-owner-close\t",$xs_test_backup->{close_attempted}?'ATTEMPTED':'NOT_NEEDED',"\n";
            }
`;
    return once(source,'            for my $record(@xs_originals) {',extra+'            for my $record(@xs_originals) {');
  };
}
test('genuine first XS metadata then MODELED tied array refuses with zero internal callbacks',async t=>{
  const r=await invokeXsNative('tied-native-values',{mutate:xsBoundaryMutation('tied-native-values'),expectedStatus:1}),o=r.observations;
  assert.equal(o['xs-issue-ok'],'0');assert.equal(o['xs-issue-error'],REFUSAL);assert.equal(o['xs-boundary-armed'],'1');
  assert.equal(o['xs-outside-fetch'],'1');assert.equal(o['xs-inside-fetch'],'0');
  assert.equal(o['xs-genuine-lstat-ok'],'1');assert.equal(o['xs-genuine-lstat-error'],'');assert.match(Buffer.from(o['xs-genuine-lstat-errno'],'hex').toString(),/^(?:0|[1-9][0-9]*)$/);
  const cells=o['xs-genuine-tuple'].split(',');assert.equal(cells.length,13);for(const cell of cells)assert.match(cell,/^(?:0|[1-9][0-9]*|-[1-9][0-9]*)$/);
  const tuple=cells.map(BigInt);assert.equal(tuple[2]&0o170000n,0o040000n);assert.equal(tuple[2]&0o022n,0n);assert.equal(tuple[4],0n);assert.equal(tuple[5],0n);
  assert.equal(o['xs-actual-dispatches'],'1');assert.equal(o['xs-known'],'0');assert.equal(o['xs-originals'],'1');
  assert.equal(o['xs-close-attempts'],'0');assert.equal(o['xs-live-attempts'],'0');assert.equal(o['end-xs-release-ok'],'0');assert.equal(o['end-xs-release-error'],REFUSAL);
  assert.equal(o['end-xs-backup-known'],'0');assert.equal(o['end-xs-backup-started'],'1');assert.equal(o['end-xs-backup-close-attempted'],'0');assert.equal(o['end-xs-backup-ok'],'1');assert.equal(o['end-xs-backup-return'],'30');assert.equal(o['end-xs-backup-error'],'');
  t.diagnostic(JSON.stringify({home:r.home,pid:r.pid,scope:'qualified genuine CORElstat then modeled tied return; known0 pending quarantined/no SourceREDsupportclaim'}));
});
test('genuine positive XS open stays known through MODELED post-effect phase drift',async t=>{
  const r=await invokeXsNative('open-post-phase',{mutate:xsBoundaryMutation('open-post-phase')}),o=r.observations;
  assert.equal(o['xs-issue-ok'],'0');assert.equal(o['xs-issue-error'],REFUSAL);assert.equal(o['xs-boundary-armed'],'1');
  assert.equal(o['xs-genuine-open-ok'],'1');assert.equal(o['xs-genuine-open-result'],'31');assert.equal(o['xs-genuine-open-error'],'');assert.match(Buffer.from(o['xs-genuine-open-errno'],'hex').toString(),/^(?:0|[1-9][0-9]*)$/);
  assert.equal(o['xs-actual-dispatches'],'2');assert.equal(o['xs-known'],'1');assert.equal(o['xs-originals'],'1');
  assert.equal(o['xs-backup-raw-handle'],o['xs-raw-handle:0']);assert.equal(o['xs-backup-raw-io'],o['xs-raw-io:0']);
  assert.equal(o['xs-close-attempts'],'1');assert.equal(o['xs-live-attempts'],'1');assert.equal(o['xs-close-ok'],'1');
  assert.equal(o['xs-independent-live'],'0');assert.equal(o['xs-independent-live-ok'],'1');assert.equal(o['xs-independent-live-error'],'');assert.equal(o['xs-test-owner-close'],'NOT_NEEDED');
  for(const field of ['known','started','admission_started','admission_ok','before_attempted','before_ok','after_attempted','after_ok','outcome'])assert.equal(o['xs-backup-'+field],'1');
  assert.equal(o['xs-backup-close_attempted'],'0');for(const field of ['admission_error','before_error','after_error'])assert.equal(o['xs-backup-'+field],'');
  assert.equal(o['xs-backup-before_return'],'UNDEF');assert.equal(o['xs-backup-after_return'],'UNDEF');
  assert.equal(o['xs-backup-dispose-ok'],'1');assert.equal(o['xs-backup-dispose-return'],'31');assert.equal(o['xs-backup-dispose-error'],'');
  assert.equal(o['end-xs-release-ok'],'1');assert.equal(o['end-xs-release-return'],'1');assert.equal(o['end-xs-release-error'],'');
  assert.equal(o['end-xs-backup-known'],'1');assert.equal(o['end-xs-backup-started'],'1');assert.equal(o['end-xs-backup-close-attempted'],'0');assert.equal(o['end-xs-backup-ok'],'1');assert.equal(o['end-xs-backup-return'],'31');assert.equal(o['end-xs-backup-error'],'');
  t.diagnostic(JSON.stringify({home:r.home,pid:r.pid,scope:'genuine COREopen, known test backup, Sourceknown once settlement and cached END backup after memoryMODELEDphase drift; no41positiveprofile'}));
});

function xsOutputTieMutation(kind) {
  return source=>{
    const defs=String.raw`my ($xs_output_armed,$xs_output_genuine,$xs_output_outside_fetch);
BEGIN {$xs_output_armed=0;$xs_output_outside_fetch=0;}
BEGIN {
    package Task6aXsOutputTie;our $fetch=0;
    sub TIESCALAR {CORE::bless({value=>$_[1]},$_[0]);}
    sub FETCH {$fetch++;return $_[0]{value};}
    sub STORE {CORE::die "TEST_XS_TIE_STORE\n";}
}
`;
    source=once(source,'# Inert fixed XS native readback prerequisite.',defs+'# Inert fixed XS native readback prerequisite.');
    const boundary=String.raw`$xs_event->{error}=$@;$xs_event->{ok}=$xs_ok?1:0;
            CORE::die $xs_literal_refusal unless $xs_ok&&$xs_error_plain->($xs_event->{error})`;
    const effect=kind==='tied-fileno-result'?String.raw`
                CORE::tie($xs_event->{result},'Task6aXsOutputTie',$xs_output_genuine->{result});
                my $outside=$xs_event->{result};CORE::die "TEST_XS_FD_ARM\n" unless $outside eq $xs_output_genuine->{result};
`:String.raw`
                CORE::tie(${'${'} $xs_event->{buffer_cell} },'Task6aXsOutputTie',$xs_output_genuine->{buffer});
                my $outside=${'${'} $xs_event->{buffer_cell} };CORE::die "TEST_XS_BUFFER_ARM\n" unless $outside eq $xs_output_genuine->{buffer};
`;
    const condition=kind==='tied-fileno-result'?"$xs_kind eq 'fileno'":"$xs_kind eq 'capabilities'";
    source=inXs(source,boundary,String.raw`$xs_event->{error}=$@;$xs_event->{ok}=$xs_ok?1:0;
            if(!$xs_output_armed&&CONDITION) {
                $xs_output_genuine={kind=>$xs_kind,ok=>$xs_ok?1:0,result=>$xs_event->{result},errno=>$xs_event->{errno},error=>$xs_event->{error},
                    attributes=>$xs_event->{attributes},buffer=>defined($xs_event->{buffer_cell})?CORE::substr(${'${'} $xs_event->{buffer_cell} },0):undef};
                EFFECT
                $xs_output_outside_fetch=$Task6aXsOutputTie::fetch;CORE::die "TEST_XS_OUTPUT_UNARMED\n" unless $xs_output_outside_fetch==1;
                $Task6aXsOutputTie::fetch=0;$xs_output_armed=1;
            }
            CORE::die $xs_literal_refusal unless $xs_ok&&$xs_error_plain->($xs_event->{error})`.replace('CONDITION',condition).replace('EFFECT',effect).replaceAll("${'${'}",'${'));
    const output=String.raw`
            CORE::print "xs-output-armed\t",$xs_output_armed,"\n";CORE::print "xs-output-outside-fetch\t",$xs_output_outside_fetch,"\n";
            CORE::print "xs-output-inside-fetch\t",$Task6aXsOutputTie::fetch,"\n";
            if(defined($xs_output_genuine)) {
                CORE::print "xs-output-genuine-kind\t",$xs_output_genuine->{kind},"\n";CORE::print "xs-output-genuine-ok\t",$xs_output_genuine->{ok},"\n";
                for my $field('result','errno','error','attributes','buffer') {my $value=$xs_output_genuine->{$field};CORE::print 'xs-output-genuine-',$field,"\t",!defined($value)?'UNDEF':CORE::ref($value) ne ''?'REFERENCE':CORE::unpack('H*',$value),"\n";}
            }
`;
    return once(source,'            for my $record(@xs_originals) {',output+'            for my $record(@xs_originals) {');
  };
}
for(const kind of ['tied-fileno-result','tied-ACL-buffer'])test('genuine native XS output guard rejects MODELED scalar tie: '+kind,async t=>{
  const r=await invokeXsNative(kind,{mutate:xsOutputTieMutation(kind)}),o=r.observations;
  assert.equal(o['xs-output-armed'],'1');assert.equal(o['xs-output-outside-fetch'],'1');assert.equal(o['xs-output-inside-fetch'],'0');
  assert.equal(o['xs-output-genuine-ok'],'1');assert.equal(o['xs-output-genuine-error'],'');
  assert.match(Buffer.from(o['xs-output-genuine-errno'],'hex').toString(),/^(?:0|[1-9][0-9]*)$/);
  if(kind==='tied-fileno-result') {assert.equal(o['xs-output-genuine-kind'],'fileno');assert.match(Buffer.from(o['xs-output-genuine-result'],'hex').toString(),/^(?:0|[1-9][0-9]*)$/);}
  else {assert.equal(o['xs-output-genuine-kind'],'capabilities');assert.equal(o['xs-output-genuine-result'],'30');const packet=Buffer.from(o['xs-output-genuine-buffer'],'hex');assert.equal(packet.length,8192);assert.equal(packet.readUInt32LE(0),36);assert.ok(packet.readUInt32LE(8)&0x400);assert.ok(packet.readUInt32LE(24)&0x400);assert.ok(packet.subarray(36).every(b=>b===0xcc));assert.equal(Buffer.from(o['xs-output-genuine-attributes'],'hex').length,24);}
  assert.equal(o['xs-issue-ok'],'0');assert.equal(o['xs-issue-error'],REFUSAL);assert.equal(o['xs-actual-dispatches'],kind==='tied-fileno-result'?'5':'6');
  assert.equal(o['xs-known'],'1');assert.equal(o['xs-originals'],'1');for(const k of ['close-attempts','live-attempts','close-ok'])assert.equal(o['xs-'+k],'1');
  assert.equal(o['end-xs-release-ok'],'1');assert.equal(o['end-xs-release-error'],'');
  t.diagnostic(JSON.stringify({home:r.home,pid:r.pid,scope:'genuine native output then memoryMODELtie; rawbeforemodel retained/callback0 expected; no Root/TCB'}));
});

function xsRecheckReentryMutation(source) {
  const defs=String.raw`my ($xs_reentry_armed,$xs_reentry_return,$xs_reentry_ok,$xs_reentry_error,$xs_reentry_genuine,$xs_reentry_before,$xs_reentry_after);
BEGIN {$xs_reentry_armed=0;}
`;
  source=once(source,'# Inert fixed XS native readback prerequisite.',defs+'# Inert fixed XS native readback prerequisite.');
  const boundary=String.raw`$xs_event->{error}=$@;$xs_event->{ok}=$xs_ok?1:0;
            CORE::die $xs_literal_refusal unless $xs_ok&&$xs_error_plain->($xs_event->{error})`;
  source=inXs(source,boundary,String.raw`$xs_event->{error}=$@;$xs_event->{ok}=$xs_ok?1:0;
            if(!$xs_reentry_armed&&$xs_kind eq 'stat'&&$xs_operations>980) {
                $xs_reentry_genuine={ok=>$xs_ok?1:0,errno=>$xs_event->{errno},error=>$xs_event->{error},values=>[@{$xs_event->{values}}]};
                $xs_reentry_before=CORE::substr($xs_phase,0);$xs_reentry_armed=1;
                my $inner=eval {$xs_reentry_return=$xs_native_readback_recheck->();1;};
                $xs_reentry_error=$@;$xs_reentry_ok=$inner?1:0;$xs_reentry_after=CORE::substr($xs_phase,0);
            }
            CORE::die $xs_literal_refusal unless $xs_ok&&$xs_error_plain->($xs_event->{error})`);
  const output=String.raw`
            CORE::print "xs-reentry-armed\t",$xs_reentry_armed,"\n";
            CORE::print "xs-reentry-inner-ok\t",defined($xs_reentry_ok)?$xs_reentry_ok:'UNDEF',"\n";
            CORE::print "xs-reentry-inner-return\t",defined($xs_reentry_return)?$xs_reentry_return:'UNDEF',"\n";
            CORE::print "xs-reentry-inner-error\t",CORE::unpack('H*',$xs_reentry_error),"\n";
            CORE::print "xs-reentry-before\t",$xs_reentry_before,"\n";CORE::print "xs-reentry-after\t",$xs_reentry_after,"\n";
            CORE::print "xs-reentry-genuine-ok\t",$xs_reentry_genuine->{ok},"\n";
            CORE::print "xs-reentry-genuine-error\t",CORE::unpack('H*',$xs_reentry_genuine->{error}),"\n";
            CORE::print "xs-reentry-genuine-errno\t",$xs_reentry_genuine->{errno},"\n";
            CORE::print "xs-reentry-genuine-tuple\t",CORE::join(',',@{$xs_reentry_genuine->{values}}),"\n";
`;
  return once(source,'            for my $record(@xs_originals) {',output+'            for my $record(@xs_originals) {');
}
test('genuine native XS rechecker rejects MODELED same-owner nested recheck',async t=>{
  const r=await invokeXsNative('recheck-reentry',{mutate:xsRecheckReentryMutation}),o=r.observations;
  assert.equal(o['xs-issue-ok'],'1');assert.equal(o['xs-issue-error'],'');assert.equal(o['xs-reentry-armed'],'1');
  assert.equal(o['xs-reentry-genuine-ok'],'1');assert.equal(o['xs-reentry-genuine-error'],'');assert.match(o['xs-reentry-genuine-errno'],/^(?:0|[1-9][0-9]*)$/);
  const tuple=o['xs-reentry-genuine-tuple'].split(',').map(Number);assert.equal(tuple.length,13);assert.equal(tuple[2]&0o170000,0o040000);assert.equal(tuple[4],0);assert.equal(tuple[5],0);assert.equal(tuple[2]&0o022,0);
  assert.equal(o['xs-reentry-before'],'rechecking');
  assert.equal(o['xs-reentry-inner-ok'],'0');assert.equal(o['xs-reentry-inner-return'],'UNDEF');assert.equal(o['xs-reentry-inner-error'],REFUSAL);
  assert.equal(o['xs-check-ok'],'0');assert.equal(o['xs-check-error'],REFUSAL);assert.equal(o['xs-reentry-after'],'burned');assert.equal(o['xs-actual-dispatches'],'981');
  assert.equal(o['xs-known'],'41');for(const k of ['close-attempts','live-attempts','close-ok'])assert.equal(o['xs-'+k],'41');
  assert.equal(o['end-xs-release-ok'],'1');assert.equal(o['end-xs-release-error'],'');
  t.diagnostic(JSON.stringify({home:r.home,pid:r.pid,scope:'genuine outerstat then actual original nested rechecker through memoryMODELcallsite; Source phase/callback admission only'}));
});
