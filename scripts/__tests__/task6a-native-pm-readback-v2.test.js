import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {gzipSync} from 'node:zlib';

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

// Ordinary capture owns only this direct child. Every error/limit has a terminal
// record; no group, descendant or guessed PID cleanup. Overflow is never success.
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

async function invokeBridge(mode='copied') {
  assert.ok(ordinary,'ordinary Darwin only');
  const original=fs.readFileSync(BOOTSTRAP,'utf8');
  // Missing implementation is a support prerequisite, never a protocol RED.
  assert.ok(original.includes('my $pm_loader_native_state;'),'private observer support prerequisite');
  const home=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'task6a-native-pm-bridge.'));
  let source=once(original,GUARD,String.raw`BEGIN {CORE::die "TEST_ORDINARY_ONLY\n" unless $^O eq 'darwin'&&$<!=0&&$<==$>&&@ARGV==0;}
`);
  source=once(source,'\ntask6a_origin_main();\n','\n');
  const action=mode==='copied'?String.raw`
    my $first=$pm_loader_native_state->();
    CORE::print "first\t",CORE::join(',',@$first[0..2]),"\n";
    $first->[0]='FOREIGN';$first->[1]=128;$first->[2]=64;
    my $next=$pm_loader_native_state->();
    CORE::print "next\t",CORE::join(',',@$next[0..2]),"\n";
    CORE::print "same-hook\t",$strict_same_reference->($first->[3],$next->[3])?1:0,"\n";
    my $burn=eval {$pm_loader_install->(undef);1;};
    my $after=$pm_loader_native_state->();CORE::print "after\t",CORE::join(',',@$after[0..2]),"\n";
`:String.raw`
    my $bad=eval {$pm_loader_native_state->(undef);1;};my $error=$@;
    CORE::print "invalid-arity\t",$bad?1:0,"\n";
    CORE::print "error\t",CORE::unpack('H*',$error),"\n";
    my $after=$pm_loader_native_state->();CORE::print "after\t",CORE::join(',',@$after[0..2]),"\n";
`;
  source=once(source,'use strict;\n','BEGIN {\n'+action+'CORE::exit(0);\n}\nuse strict;\n');
  fs.writeFileSync(home+'/program.pl',source,{flag:'wx',mode:0o600});
  const creation={mode,scope:'ordinary private observer behavior only; no native issuer dispatch, Root or initial runtime admission',sourceSHA256:sha(original),programSHA256:sha(source),executable:'/usr/bin/perl',args:['-f',home+'/program.pl'],cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'}};
  fs.writeFileSync(home+'/creation.json',JSON.stringify(creation)+'\n',{flag:'wx',mode:0o600});
  const child=await capture(home,creation),rows=child.stdout.replace(/\n$/, '').split('\n').map(row=>row.split('\t'));
  assert.ok(rows.every(row=>row.length===2));assert.equal(new Set(rows.map(row=>row[0])).size,rows.length);
  return {home,pid:child.pid,observations:Object.fromEntries(rows)};
}

// Removing copied-value isolation lets a caller change real selector state.
test('private observer copies counters and exposes actual one-way selector burn',async t=>{
  const result=await invokeBridge(),o=result.observations;
  assert.equal(o.first,'new,0,0');assert.equal(o.next,'new,0,0');assert.equal(o['same-hook'],'1');assert.equal(o.after,'burned,0,0');
  t.diagnostic(JSON.stringify(result));
});
// Observer invalid arity must refuse without mutating the real selector realm.
test('read-only observer rejects invalid arity while preserving selector state',async t=>{
  const result=await invokeBridge('arity'),o=result.observations;
  assert.equal(o['invalid-arity'],'0');assert.equal(o.error,Buffer.from('TASK6A_PM_SOURCE_REFUSED\n').toString('hex'));assert.equal(o.after,'new,0,0');
  t.diagnostic(JSON.stringify(result));
});

const directories=[
  "/",
  "/System",
  "/System/Library",
  "/System/Library/Perl",
  "/System/Library/Perl/5.34",
  "/System/Library/Perl/5.34/Digest",
  "/System/Library/Perl/5.34/Exporter",
  "/System/Library/Perl/5.34/File",
  "/System/Library/Perl/5.34/IO",
  "/System/Library/Perl/5.34/JSON",
  "/System/Library/Perl/5.34/Tie",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level",
  "/System/Library/Perl/5.34/warnings",
  "/System/Library/Perl/5.34/IO/Compress",
  "/System/Library/Perl/5.34/IO/Uncompress",
  "/System/Library/Perl/5.34/JSON/PP",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/Compress",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/Digest",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/File",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/IO",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/List",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/MIME",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/PerlIO",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/Scalar",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/Time",
  "/System/Library/Perl/5.34/IO/Compress/Base",
  "/System/Library/Perl/5.34/IO/Compress/Gzip",
  "/System/Library/Perl/5.34/IO/Compress/Zlib",
  "/System/Library/Perl/5.34/IO/Uncompress/Adapter",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/Compress/Raw",
  "/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/MIME"
];
const leaves=[
  {"key":"Carp.pm","path":"/System/Library/Perl/5.34/Carp.pm","bytes":35985,"sha256":"020bba236b44c482c8a401b5f6676c0b5d27a76caaf7cae41dfb7a63b00488b3"},
  {"key":"Digest/base.pm","path":"/System/Library/Perl/5.34/Digest/base.pm","bytes":1984,"sha256":"06367faa5fb46a5794d3d7603d52075ab1533ad848184a5309a1cfac1058281a"},
  {"key":"Exporter.pm","path":"/System/Library/Perl/5.34/Exporter.pm","bytes":18774,"sha256":"073f49928a471678e14ce5c314aef306a93a58870dba423ff2f630d1de782cad"},
  {"key":"Exporter/Heavy.pm","path":"/System/Library/Perl/5.34/Exporter/Heavy.pm","bytes":6530,"sha256":"e53ad090aaa655b01ad1cff2af2daf6c92020ed349f9d48d55109cd1d142f6a0"},
  {"key":"File/GlobMapper.pm","path":"/System/Library/Perl/5.34/File/GlobMapper.pm","bytes":15683,"sha256":"1fc0b84c8fa4fc5b3cad7ae0a638a8fd3736efd5416c31afcc8ae58a03d525b3"},
  {"key":"IO/Compress/Base/Common.pm","path":"/System/Library/Perl/5.34/IO/Compress/Base/Common.pm","bytes":22774,"sha256":"7dbfdfdf0851619f00d98f5958203fd4ea9535ef008a87eec5cd19cd039710e5"},
  {"key":"IO/Compress/Gzip/Constants.pm","path":"/System/Library/Perl/5.34/IO/Compress/Gzip/Constants.pm","bytes":3883,"sha256":"108fdebbb31a16c6ff3ff2e9fb3220e197aa79ba9f7e995073da40da956315b3"},
  {"key":"IO/Compress/Zlib/Extra.pm","path":"/System/Library/Perl/5.34/IO/Compress/Zlib/Extra.pm","bytes":5647,"sha256":"57934980c670ff320d15164647da794882b9d3edee4d1586495f91dca4c9ed01"},
  {"key":"IO/Uncompress/Adapter/Inflate.pm","path":"/System/Library/Perl/5.34/IO/Uncompress/Adapter/Inflate.pm","bytes":3259,"sha256":"e93c905f15ba91ed6ef8cae083ed0cfd860bcbfcb763592e722a2e529ff5989b"},
  {"key":"IO/Uncompress/Base.pm","path":"/System/Library/Perl/5.34/IO/Uncompress/Base.pm","bytes":38337,"sha256":"adcbe73669c2f03ddce11fe3234b39e26057c9c7b8283ce4bf2e4d21ff64893a"},
  {"key":"IO/Uncompress/Gunzip.pm","path":"/System/Library/Perl/5.34/IO/Uncompress/Gunzip.pm","bytes":32152,"sha256":"f9cf9da150abe298dc8efa76e4cd385b641c377afb567db1d643e540ea3295ab"},
  {"key":"IO/Uncompress/RawInflate.pm","path":"/System/Library/Perl/5.34/IO/Uncompress/RawInflate.pm","bytes":31841,"sha256":"efa06d6eca40888d6f1f9bd3487339d9bbb788c823118171655701617bc922b8"},
  {"key":"JSON/PP.pm","path":"/System/Library/Perl/5.34/JSON/PP.pm","bytes":100527,"sha256":"b256804d959880439ce3e5b82497d01c080228276ae55979d3ababee48293a89"},
  {"key":"JSON/PP/Boolean.pm","path":"/System/Library/Perl/5.34/JSON/PP/Boolean.pm","bytes":810,"sha256":"264db0a8de27d592dceb964bbaab9a05a65197855a7bfd4f10ed20d14f86f379"},
  {"key":"PerlIO.pm","path":"/System/Library/Perl/5.34/PerlIO.pm","bytes":14441,"sha256":"183d8cc5992cd8197bd0621f0ac1c2346104327ecc4e7ccb53c26145481822b6"},
  {"key":"SelectSaver.pm","path":"/System/Library/Perl/5.34/SelectSaver.pm","bytes":1076,"sha256":"b951b99c894f701eac08b79265ff2ccbede0954f97a537d03fb78801ed645861"},
  {"key":"Symbol.pm","path":"/System/Library/Perl/5.34/Symbol.pm","bytes":4905,"sha256":"bd0e0df0aa0b830f87c2a991b3989abae21c9e9dce4edb2abc7125c3c7693621"},
  {"key":"Tie/Hash.pm","path":"/System/Library/Perl/5.34/Tie/Hash.pm","bytes":7639,"sha256":"12e565ea59a4a3a332d8fefa40a654f9482014c145f165bef3d065a59daee55a"},
  {"key":"XSLoader.pm","path":"/System/Library/Perl/5.34/XSLoader.pm","bytes":11398,"sha256":"c6efc1f25e87fb1c2343d471b868af1a755df601985065dbd22e22273d6b2192"},
  {"key":"bytes.pm","path":"/System/Library/Perl/5.34/bytes.pm","bytes":3782,"sha256":"7e3a78b180565c3caafa7f3dd5913acb91b06fe7c9f802bf948eb5a962df00f0"},
  {"key":"constant.pm","path":"/System/Library/Perl/5.34/constant.pm","bytes":14724,"sha256":"e67cdfa533d42cbe5265bcf3c270f055620cba38a9295b5d584b7efc37a0c156"},
  {"key":"B.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/B.pm","bytes":30093,"sha256":"cf275fdd78b25aa726b0068003aee6e08cd380f2aea1378efbb8fe268d6bc95a"},
  {"key":"Compress/Raw/Zlib.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/Compress/Raw/Zlib.pm","bytes":47387,"sha256":"7b9321c1d13ab20c19e2bd0deafc09a0c3fa30f526c68078145d9409f2ab2bc6"},
  {"key":"Config.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/Config.pm","bytes":3886,"sha256":"e85c38637cedf6a9e29e6946201fbefeceba184e07b720b976c068ecab4d7283"},
  {"key":"Digest/SHA.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/Digest/SHA.pm","bytes":22174,"sha256":"15efed6020da9028a7a5b2d41d7e6d8e6b1719aeae365bc592ffb4025f76d33d"},
  {"key":"DynaLoader.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/DynaLoader.pm","bytes":25540,"sha256":"dde9744d54a185e1d38d52c98bf9349a83360d5fb31c82904e28d514a87c79fe"},
  {"key":"Encode.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode.pm","bytes":32075,"sha256":"134fddc376de04a40dea58e6055f7ce28bc4159487a47c260ac8feaf04201a54"},
  {"key":"Encode/Alias.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/Alias.pm","bytes":12545,"sha256":"9ec57c436578d4c67b269c53dcb70db64bf845b7ba294da2b8fb998bc00a45ea"},
  {"key":"Encode/Config.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/Config.pm","bytes":6065,"sha256":"a15072cf84ac4a431b91b1a893a7c8d4c4dd48adefa077cd3a9b271cf0aba3bf"},
  {"key":"Encode/Encoding.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/Encoding.pm","bytes":9063,"sha256":"1daaf4400c4462c24d785b7eb91fbebc6eb868192aad410df48019fe7af6e39d"},
  {"key":"Encode/MIME/Name.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/MIME/Name.pm","bytes":3821,"sha256":"1cabed37ee26cfd763999649f9ac9a5f1e5a81cbc5125b8d85ff19d60b72f906"},
  {"key":"Fcntl.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/Fcntl.pm","bytes":4044,"sha256":"80511e494fc719cb63d252a95987ba24c04557947c1bf1584f5eeb6704786e9b"},
  {"key":"File/Glob.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/File/Glob.pm","bytes":12712,"sha256":"ff854e2cccfcd78e6c22278c843ea61fda1d0164704b1aa8941fe05ff9dbbfe8"},
  {"key":"IO.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/IO.pm","bytes":1462,"sha256":"d1db057bb61c36632e97e7216733ddf70ccd367f1f32393f9d7a4248cc4ec07e"},
  {"key":"IO/File.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/File.pm","bytes":4872,"sha256":"133658ff1c17332f46d01d34f872b71309c715656b47f39e31393e2d10d827e4"},
  {"key":"IO/Handle.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/Handle.pm","bytes":16641,"sha256":"af3d3b9f9bc2132644248480d21b2e7e5c1a7e0d7a3c1f121e89888a2153b9f1"},
  {"key":"IO/Seekable.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/Seekable.pm","bytes":2891,"sha256":"ce170c83abf1a599320c0f4369c8e6e123310b4603ac3791bee0e733d9e8e533"},
  {"key":"IO/Select.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/Select.pm","bytes":9263,"sha256":"a6804f44f8c90c88f8cc60cdd38538f65f3f92ce533fcda6933887c7228ad5d7"},
  {"key":"List/Util.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/List/Util.pm","bytes":24055,"sha256":"0d3135c14b4d4156a0de8156f2d33f54c6f0b6233b2f6fe5d4b9122e9fef1a5a"},
  {"key":"MIME/Base64.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/MIME/Base64.pm","bytes":5433,"sha256":"dfb1e3876b3e7f3cf9a3f23123c37464617e551802e618e54cabd7890c986cc8"},
  {"key":"POSIX.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/POSIX.pm","bytes":20384,"sha256":"d941cf37b6dee5253b859cbb703a5785629a0bcdd86f61d1ec96fa464d69df90"},
  {"key":"PerlIO/scalar.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/PerlIO/scalar.pm","bytes":1069,"sha256":"a4205c837c331d7945f0221600ae8b4bf6ea562812c71b535ac06693de26a859"},
  {"key":"Scalar/Util.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/Scalar/Util.pm","bytes":10189,"sha256":"9ba58fcbefc535a73d3fc0da949d0fb1e524411dea4e8bee97529700607a98a4"},
  {"key":"Storable.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/Storable.pm","bytes":49923,"sha256":"4a9ab42a68de934079da007e8df0ae3c66f33477c3f3218782596a83e3ea508c"},
  {"key":"Time/HiRes.pm","path":"/System/Library/Perl/5.34/darwin-thread-multi-2level/Time/HiRes.pm","bytes":25689,"sha256":"9bc6ece12a90e5c01d784a4efd672c49b8a7551ce6871b620efbd38cd4960f34"},
  {"key":"integer.pm","path":"/System/Library/Perl/5.34/integer.pm","bytes":3254,"sha256":"eb62cc3ee22a592bc673e07158927d1a6536075d33258fc67ff91e3f720cf463"},
  {"key":"overload.pm","path":"/System/Library/Perl/5.34/overload.pm","bytes":53349,"sha256":"3ea7fb212172cb9c01dacee5f7d90aa04da396f5bca442eca84ad2e94a200d99"},
  {"key":"overloading.pm","path":"/System/Library/Perl/5.34/overloading.pm","bytes":1808,"sha256":"5bba56c0acdcc449ca3b73500862a5750c907d97d652978038dbc7809c4fcd07"},
  {"key":"parent.pm","path":"/System/Library/Perl/5.34/parent.pm","bytes":2702,"sha256":"046169e129cfb7d4b302567de268409f175652192914abd33245cb9939f16626"},
  {"key":"strict.pm","path":"/System/Library/Perl/5.34/strict.pm","bytes":4783,"sha256":"f1296224730dceb5dd308ee1e72c452c8b13ced7f3bf742ccd16e1e1c416bcb5"},
  {"key":"utf8.pm","path":"/System/Library/Perl/5.34/utf8.pm","bytes":10756,"sha256":"9dd05cc86753dc3989926bdc0ed8425ff1ae8946f3298d61440891ee92026691"},
  {"key":"vars.pm","path":"/System/Library/Perl/5.34/vars.pm","bytes":2458,"sha256":"84de23fb5d39572d2b0dc5d4e1cd6363017fae8f54eff90d4c8121eb1edeeb57"},
  {"key":"warnings.pm","path":"/System/Library/Perl/5.34/warnings.pm","bytes":53221,"sha256":"7aa17d79aa23ee3635aa145902944e6dad909c0f5d6ca47d27bce7be864e42d2"},
  {"key":"warnings/register.pm","path":"/System/Library/Perl/5.34/warnings/register.pm","bytes":759,"sha256":"ce25ec34358642703ff05b546b2ac42b4f2081ab7610d8373dd94c6b78040cf4"},
];

const nativeProbe=String.raw`
        $pm_native_test_probe=sub {
            return if $test_native_probe_started++;
            CORE::print "native-phase\t",$phase,"\n";
            CORE::print "native-claimed\t",$claimed,"\n";
            CORE::print "native-actions\t",$operations,"\n";
            CORE::print "native-actual-dispatches\t",$test_native_dispatches,"\n";
            CORE::print "native-raw-reserved\t",$raw_reserved,"\n";
            CORE::print "native-text-reserved\t",$text_reserved,"\n";
            CORE::print "native-originals\t",CORE::scalar(@originals),"\n";
            CORE::print "native-known\t",CORE::scalar(CORE::grep {$_->{known}} @originals),"\n";
            CORE::print "native-close-ok\t",CORE::scalar(CORE::grep {$_->{close_ok}} @originals),"\n";
            CORE::print "native-close-attempts\t",CORE::scalar(CORE::grep {$_->{close_attempted}} @originals),"\n";
            CORE::print "native-live-attempts\t",CORE::scalar(CORE::grep {$_->{live_attempted}} @originals),"\n";
            CORE::print "native-revocation\t",defined($revocation_outcome)?$revocation_outcome:'UNDEF',"\n";
            for my $record(@originals) {
                my $index=$record->{index};
                CORE::print 'original:',$index,"\t",$record->{path},"\n";
                if($record->{known}) {
                    CORE::print 'raw-handle:',$index,"\t",CORE::sprintf('%x',0+$record->{handle}),"\n";
                    CORE::print 'raw-io:',$index,"\t",CORE::sprintf('%x',0+$record->{io}),"\n";
                }
                for my $field('close_return','close_error','live_return','live_error') {
                    my $value=$record->{$field};
                    CORE::print 'cleanup:',$index,':',$field,"\t",!defined($value)?'UNDEF':CORE::ref($value) ne ''?'REFERENCE':CORE::unpack('H*',$value),"\n";
                }
            }
            for my $event(@native_events) {
                my $prefix='event:'.$event->{sequence}.':';
                CORE::print $prefix,'kind',"\t",$event->{kind},"\n";
                CORE::print $prefix,'index',"\t",$event->{index},"\n";
                for my $field('result','error','errno') {
                    my $value=$event->{$field};
                    CORE::print $prefix,$field,"\t",!defined($value)?'UNDEF':CORE::ref($value) ne ''?'REFERENCE':CORE::unpack('H*',$value),"\n";
                }
                CORE::print $prefix,'tuple',"\t",CORE::join(',',@{$event->{values}}),"\n" if defined($event->{values});
                CORE::print $prefix,'attributes',"\t",CORE::unpack('H*',$event->{attributes}),"\n" if defined($event->{attributes});
                CORE::print $prefix,'buffer',"\t",CORE::unpack('H*',${'${'} $event->{buffer_cell} }),"\n" if defined($event->{buffer_cell});
                CORE::print $prefix,'request',"\t",$event->{request},"\n" if defined($event->{request});
            }
        };
`;
const compilerProbe=String.raw`
        $pm_compiler_test_probe=sub {
            CORE::print "compiler-selected\t",CORE::scalar(CORE::grep {$_->{selected}} @records),"\n";
            for my $record(@records) {if($record->{selected}) {
                CORE::print 'compiler:',$record->{key},"\t",CORE::unpack('H*',${'${'} $record->{compiler_cell} }),"\n";
            }}
        };
`;
async function invokeNative(mode='healthy',options={}) {
  assert.ok(ordinary,'ordinary Darwin native only');
  const original=fs.readFileSync(BOOTSTRAP,'utf8');
  assert.ok(original.includes('my ($pm_native_readback_issue,'),'native issuer support prerequisite; never a protocol RED');
  const home=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'task6a-native-pm-readback.'));
  const inputs=leaves.map((row,index)=>{
    const bytes=fs.readFileSync(row.path);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);
    const file=home+'/'+index+'.input';fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});return {...row,file};
  });
  let source=once(original,GUARD,String.raw`BEGIN {CORE::die "TEST_ORDINARY_ONLY\n" unless $^O eq 'darwin'&&$<!=0&&$<==$>&&@ARGV==0;}
`);
  source=once(source,'# Inert fixed PM source-selection prerequisite.','my $pm_compiler_test_probe;\n# Inert fixed PM source-selection prerequisite.');
  source=once(source,'# Inert fixed native PM readback prerequisite.',
    'my $pm_native_test_probe;my ($test_native_dispatches,$test_native_probe_started);\nmy ($test_input_original,$test_input_known,$test_input_close_started,$test_input_close_return,$test_input_close_error);\nmy ($test_gzip_original,$test_gzip_known,$test_gzip_close_original,$test_gzip_close_started,$test_gzip_close_return,$test_gzip_close_error);\nBEGIN {$test_native_dispatches=0;$test_native_probe_started=0;$test_input_known=0;$test_gzip_known=0;$test_input_close_started=0;$test_gzip_close_started=0;}\n# Inert fixed native PM readback prerequisite.');
  source=once(source,'        # Private native PM lifecycle closures end here.',nativeProbe+'        # Private native PM lifecycle closures end here.');
  source=once(source,'        # Private PM lifecycle closures end here.',compilerProbe+'        # Private PM lifecycle closures end here.');
  // Actual call sites, independently counted from the native owner's quota.
  for(const call of [
    '$event->{values}=[CORE::lstat($record->{path})];',
    '$event->{values}=[CORE::stat($handle)];',
    '$event->{result}=CORE::sysopen(${ $record->{cell} },$record->{path},0x01000100);',
    '$event->{result}=CORE::fileno($handle);',
    '$event->{result}=CORE::syscall(228,$fd,$attributes,$buffer,8192,4);',
    '$event->{result}=CORE::sysseek($handle,0,0);',
    '$event->{result}=CORE::sysread($handle,$buffer,$request);',
  ])source=once(source,call,'$test_native_dispatches++;'+call);
  const before=String.raw`{
BEGIN {$^H|=0x01000000;CORE::delete($^H{'overloading'});}
my $test_release_original;
BEGIN {$test_release_original=$pm_native_readback_release;}
END {
    my $primary_status=$?;my $cleanup_ok=1;
    my $gzip_ok=eval {
        if($test_gzip_known&&!$test_gzip_close_started) {
            $test_gzip_close_started=1;
            $test_gzip_close_return=$test_gzip_close_original->($test_gzip_original);
        }1;
    };my $gzip_error=$@;
    if($test_gzip_known) {
        $test_gzip_close_error=$gzip_error unless defined($test_gzip_close_error);
        $cleanup_ok=0 unless $gzip_ok&&defined($test_gzip_close_return)&&$test_gzip_close_return eq '1';
    }
    my $input_ok=eval {
        if($test_input_known&&!$test_input_close_started) {
            $test_input_close_started=1;$test_input_close_return=CORE::close($test_input_original);
        }1;
    };my $input_error=$@;
    if($test_input_known) {
        $test_input_close_error=$input_error unless defined($test_input_close_error);
        my $live;my $live_ok=eval {$live=CORE::fileno($test_input_original);1;};my $live_error=$@;
        CORE::print "end-input-live-error\t",!defined($live_error)?'UNDEF':CORE::ref($live_error) ne ''?'REFERENCE':CORE::unpack('H*',$live_error),"\n";
        CORE::print "end-input-live\t",$live_ok?(defined($live)?1:0):'UNKNOWN',"\n";
        $cleanup_ok=0 unless $input_ok&&defined($test_input_close_return)&&$test_input_close_return eq '1'&&$live_ok&&!defined($live);
    }
    my $released;my $native_ok=eval {
        CORE::die "TEST_CHANGED_NATIVE_RELEASE\n" unless !defined(CORE::tied($pm_native_readback_release))
            &&CORE::ref($pm_native_readback_release) ne ''&&$pm_native_readback_release==$test_release_original;
        $released=$test_release_original->();1;
    };my $native_error=$@;
    $cleanup_ok=0 unless $native_ok&&defined($released)&&$released eq '1';
    CORE::print "end-native-release\t",$native_ok&&$released?1:0,"\n";
    CORE::print "end-primary-status\t",$primary_status,"\n";
    my $printed=eval {$pm_native_test_probe->();1;};my $print_error=$@;$cleanup_ok=0 unless $printed;
    CORE::print "end-cleanup-ok\t",$cleanup_ok?1:0,"\n";
    my $record_end_value=sub {
        my $label=$_[0];
        if(defined(CORE::tied($_[1]))) {CORE::print $label,"\tTIED\n";return;}
        my $value=$_[1];
        CORE::print $label,"\t",!defined($value)?'UNDEF':CORE::ref($value) ne ''?'REFERENCE':CORE::unpack('H*',$value),"\n";
    };
    $record_end_value->('end-gzip-error',$gzip_error);
    $record_end_value->('end-gzip-cached-error',$test_gzip_close_error);
    $record_end_value->('end-gzip-return',$test_gzip_close_return);
    $record_end_value->('end-input-error',$input_error);
    $record_end_value->('end-input-cached-error',$test_input_close_error);
    $record_end_value->('end-input-return',$test_input_close_return);
    $record_end_value->('end-native-error',$native_error);
    $record_end_value->('end-native-return',$released);
    $record_end_value->('end-probe-error',$print_error);
    # Installed Perl5.34 perlmod: END $? is the outgoing exit value, not wait bits.
    $?=$primary_status!=0?$primary_status:($cleanup_ok?0:1);
}
BEGIN {
    my $issued=eval {$pm_native_readback_issue->();1;};my $error=$@;
    CORE::print "native-issue\t",$issued?1:0,"\n";
    CORE::print "issue-actions\t",$test_native_dispatches,"\n";
    CORE::die $error unless $issued;
}
}
`;
  const issuePrelude=options.earlyFailure?once(before,'    CORE::die $error unless $issued;\n',options.earlyFailure):before;
  source=once(source,'use strict;\n',issuePrelude+'use strict;\n');
  const payload=Buffer.from('native PM owner preserves the exact source bytes\n');
  const compressed=gzipSync(payload).toString('hex');
  const runtime=options.runtime??String.raw`
my $start_dispatches=$test_native_dispatches;
my $check=eval {$pm_native_readback_recheck->();1;};my $check_error=$@;
CORE::print "native-runtime-check\t",$check?1:0,"\n";
CORE::print "runtime-actions\t",$test_native_dispatches-$start_dispatches,"\n";
CORE::die $check_error unless $check;
require IO::Uncompress::Gunzip;
my $compressed=CORE::pack('H*','COMPRESSED');
CORE::open($test_input_original,'<',\$compressed) or CORE::die "TEST_MEMORY_INPUT\n";
$test_input_known=1;my $input=$test_input_original;
$test_gzip_close_original=UNIVERSAL::can('IO::Uncompress::Gunzip','close');CORE::die "TEST_GZIP_CLOSE_METHOD\n" unless CORE::ref($test_gzip_close_original) eq 'CODE';
$test_gzip_original=IO::Uncompress::Gunzip->new($input) or CORE::die "TEST_GUNZIP_NEW\n";
$test_gzip_known=1;my $gzip=$test_gzip_original;
my $decoded='';my $reads=0;
while(1){my $part='';my $count=$gzip->read($part,128);$reads++;CORE::die "TEST_GUNZIP_READ\n" unless defined($count)&&$count>=0;last if $count==0;$decoded.=$part;}
CORE::print "decoded\t",CORE::unpack('H*',$decoded),"\n";
CORE::print "gzip-reads\t",$reads,"\n";
CORE::print "gzip-tell\t",$gzip->tell(),"\n";
$test_gzip_close_started=1;my $gzip_close_ok=eval {$test_gzip_close_return=$test_gzip_close_original->($test_gzip_original);1;};$test_gzip_close_error=$@;
CORE::print "gzip-close\t",$gzip_close_ok&&$test_gzip_close_return?1:0,"\n";
$test_input_close_started=1;my $input_close_ok=eval {$test_input_close_return=CORE::close($test_input_original);1;};$test_input_close_error=$@;
CORE::print "input-close\t",$input_close_ok&&$test_input_close_return?1:0,"\n";
CORE::print "input-live\t",defined(CORE::fileno($input))?1:0,"\n";
CORE::print "natural-selected\t",CORE::scalar(CORE::keys(%INC)),"\n";
# This explicit full54 exercise is separate from natural52 operations.
require Config;require DynaLoader;
$start_dispatches=$test_native_dispatches;
my $after=eval {$pm_native_readback_recheck->();1;};my $after_error=$@;
CORE::print "native-after-gzip-check\t",$after?1:0,"\n";
CORE::print "after-actions\t",$test_native_dispatches-$start_dispatches,"\n";
CORE::die $after_error unless $after;
$pm_compiler_test_probe->();
my $released=eval {$pm_native_readback_release->();1;};
CORE::print "native-release\t",$released?1:0,"\n";
my $repeated=eval {$pm_native_readback_release->();1;};CORE::print "native-release-repeat\t",$repeated?1:0,"\n";
$pm_native_test_probe->();
my $target_after=$pm_loader_native_state->();CORE::print "target-after-release\t",CORE::join(',',@$target_after[0..2]),"\n";
my $reused=eval {$pm_native_readback_recheck->();1;};CORE::print "native-reuse\t",$reused?1:0,"\n";
CORE::exit(0);
`.replace('COMPRESSED',compressed);
  source=once(source,'\ntask6a_origin_main();\n','\n'+runtime);
  if(options.mutate)source=options.mutate(source,home);
  const creation={mode,scope:'ordinary native fixed86 originals DATA; source/native/kernel/MAC/runtime initial TCB conditional, no Root/live/overall admission',sourceSHA256:sha(original),programSHA256:sha(source),executable:'/usr/bin/perl',args:['-f',home+'/program.pl'],cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},inputs,expectedStatus:options.expectedStatus??0};
  fs.writeFileSync(home+'/program.pl',source,{flag:'wx',mode:0o600});fs.writeFileSync(home+'/creation.json',JSON.stringify(creation)+'\n',{flag:'wx',mode:0o600});
  if(options.prepareOnly)return {home,creation,scope:'pre-effect program and input preparation only; no Perl/native dispatch'};
  const child=await capture(home,creation),rows=child.stdout.replace(/\n$/, '').split('\n').map(row=>row.split('\t'));
  assert.ok(rows.every(row=>row.length===2));assert.equal(new Set(rows.map(row=>row[0])).size,rows.length);
  const observations=Object.fromEntries(rows);
  fs.writeFileSync(home+'/witness.json',JSON.stringify({pid:child.pid,observations,scope:creation.scope})+'\n',{flag:'wx',mode:0o600});
  return {home,pid:child.pid,observations,payload};
}

function earlyFaultOutput(extra='') {
  return String.raw`
    CORE::print "native-fault-error\t",CORE::unpack('H*',$error),"\n";
    EXTRA
    my $released=eval {$pm_native_readback_release->();1;};CORE::print "native-fault-release\t",$released?1:0,"\n";
    $pm_native_test_probe->();CORE::exit(0);
`.replace('EXTRA',extra);
}
function negativeNativeMutation(kind) {
  return source=>{
    if(kind==='initial-tied-array') {
      const model=String.raw`BEGIN {
    package Task6aNativeBridgeTie;our ($fetch,$delegate)=(0,0);
    sub TIEARRAY {CORE::bless({values=>$_[1]},$_[0]);}
    sub FETCHSIZE {$fetch++;return 4;}
    sub FETCH {$fetch++;return $_[0]{values}[$_[1]];}
}
BEGIN {
    my $genuine=$pm_loader_native_state;
    $pm_loader_native_state=sub {my $state=$genuine->();$Task6aNativeBridgeTie::delegate++;my @tied;CORE::tie(@tied,'Task6aNativeBridgeTie',$state);return \@tied;};
}
`;
      return once(source,'# Inert fixed native PM readback prerequisite.',model+'# Inert fixed native PM readback prerequisite.');
    }
    assert.equal(kind,'open-post-phase');
    source=once(source,'# Inert fixed native PM readback prerequisite.','my @test_fault_native_handles;\n# Inert fixed native PM readback prerequisite.');
    const call='$event->{result}=CORE::sysopen(${ $record->{cell} },$record->{path},0x01000100);';
    source=once(source,call,call+'CORE::push(@test_fault_native_handles,${ $record->{cell} });');
    const boundary=String.raw`$event->{error}=$@;$event->{ok}=$ok?1:0;
            CORE::die $literal_refusal unless $ok&&$error_plain->($event->{error})`;
    return once(source,boundary,String.raw`$event->{error}=$@;$event->{ok}=$ok?1:0;
            if($kind eq 'open') {
                CORE::print "fault-genuine-open\t",$event->{result},',',$event->{errno},',',CORE::unpack('H*',$event->{error}),"\n";
                $phase='burned';
            }
            CORE::die $literal_refusal unless $ok&&$error_plain->($event->{error})`);
  };
}
const initialTieOutput=earlyFaultOutput(String.raw`CORE::print "bridge-fetches\t",$Task6aNativeBridgeTie::fetch,"\n";CORE::print "bridge-genuine-delegates\t",$Task6aNativeBridgeTie::delegate,"\n";`);
const openPhaseOutput=earlyFaultOutput(String.raw`
    my $live=CORE::fileno($test_fault_native_handles[0]);CORE::print "fault-independent-native-live\t",defined($live)?1:0,"\n";
    # Test owner has the genuine lower-delegate original; no Source adoption credit.
    if(defined($live)){my $closed=CORE::close($test_fault_native_handles[0]);CORE::print "fault-test-owner-close\t",$closed?1:0,"\n";}
    else {CORE::print "fault-test-owner-close\t0\n";}
`);

// A skipped genuine read/custody check, wrong source or extra close fails this
// independent native outcome/dispatch/compiler-byte oracle.
test('genuine fixed86 native owner supplies compiler bytes across runtime and once release',async t=>{
  const r=await invokeNative(),o=r.observations;
  assert.equal(o['native-issue'],'1');assert.equal(o['issue-actions'],'2216');assert.equal(o['runtime-actions'],'1022');assert.equal(o['after-actions'],'1022');
  assert.equal(o['native-runtime-check'],'1');assert.equal(o['native-after-gzip-check'],'1');assert.equal(o.decoded,r.payload.toString('hex'));
  assert.equal(o['gzip-reads'],'2');assert.equal(o['gzip-tell'],String(r.payload.length));assert.equal(o['gzip-close'],'1');assert.equal(o['input-close'],'1');assert.equal(o['input-live'],'0');
  assert.equal(o['natural-selected'],'52');assert.equal(o['compiler-selected'],'54');
  assert.equal(o['native-release'],'1');assert.equal(o['native-release-repeat'],'1');assert.equal(o['native-reuse'],'0');
  assert.equal(o['native-phase'],'released');assert.equal(o['native-originals'],'86');assert.equal(o['native-known'],'86');assert.equal(o['native-close-ok'],'86');
  assert.equal(o['native-close-attempts'],'86');assert.equal(o['native-live-attempts'],'86');assert.equal(o['native-revocation'],'1');
  assert.equal(o['native-actions'],'4260');assert.equal(o['native-actual-dispatches'],'4260');assert.equal(o['native-raw-reserved'],'14834692');assert.equal(o['native-text-reserved'],'21811200');
  const rawHandles=directories.concat(leaves.map(row=>row.path)).map((file,index)=>{assert.equal(o['original:'+index],file);return o['raw-handle:'+index];});
  const rawIOs=rawHandles.map((_,index)=>o['raw-io:'+index]);assert.equal(new Set(rawHandles).size,86);assert.equal(new Set(rawIOs).size,86);
  for(const row of leaves){const compiler=Buffer.from(o['compiler:'+row.key],'hex');assert.equal(compiler.length,row.bytes);assert.equal(sha(compiler),row.sha256);}
  for(let index=0;index<86;index++){assert.equal(o['cleanup:'+index+':close_return'],'31');assert.equal(o['cleanup:'+index+':close_error'],'');assert.equal(o['cleanup:'+index+':live_return'],'UNDEF');assert.equal(o['cleanup:'+index+':live_error'],'');}
  assert.match(o['target-after-release'],/^burned,[0-9]+,4$/);
  t.diagnostic(JSON.stringify({home:r.home,pid:r.pid,scope:'ordinary native/source conditional only; full raw records retained separately'}));
});


// MODELED lower bridge wraps the genuine delegate then returns an actual tied AV.
// A count-before-tie regression invokes FETCHSIZE despite refusal.
test('MODELED tied bridge return refuses with zero callbacks before native effects',async t=>{
  const r=await invokeNative('initial-tied-array',{mutate:negativeNativeMutation('initial-tied-array'),earlyFailure:initialTieOutput}),o=r.observations;
  assert.equal(o['native-issue'],'0');assert.equal(o['bridge-fetches'],'0');assert.equal(o['bridge-genuine-delegates'],'2');
  assert.equal(o['native-actual-dispatches'],'0');assert.equal(o['native-known'],'0');assert.equal(o['native-close-attempts'],'0');
  t.diagnostic(JSON.stringify({home:r.home,pid:r.pid,scope:'MODELED lower return after genuine bridge delegate; no initial provenance credit'}));
});
// Genuine positive native open is armed first; modeled later private phase burn
// must still settle that enrolled raw handle/IO exactly once.
test('genuine positive open keeps known cleanup after MODELED post-effect phase burn',async t=>{
  const r=await invokeNative('open-post-phase',{mutate:negativeNativeMutation('open-post-phase'),earlyFailure:openPhaseOutput}),o=r.observations;
  assert.equal(o['native-issue'],'0');assert.match(o['fault-genuine-open'],/^1,(?:0|[1-9][0-9]*),$/);
  assert.equal(o['native-actual-dispatches'],'2');assert.equal(o['native-known'],'1');assert.equal(o['native-close-attempts'],'1');
  assert.equal(o['native-live-attempts'],'1');assert.equal(o['native-close-ok'],'1');assert.equal(o['fault-independent-native-live'],'0');assert.equal(o['fault-test-owner-close'],'0');
  t.diagnostic(JSON.stringify({home:r.home,pid:r.pid,scope:'genuine native open then MODELED private phase burn; independent native liveness; no Root credit'}));
});


// Each ordinary model keeps the actual genuine CORE dispatch first and arms
// one post-result fault. They exercise refusal/custody, never initial TCB.
const nativeFaultCases=[
  {kind:'lstat-throw',dispatches:1,known:0},
  {kind:'tuple-short',dispatches:1,known:0},
  {kind:'tuple-mode',dispatches:1,known:0},
  {kind:'tuple-owner',dispatches:1,known:0},
  {kind:'open-false-after-enrollment',dispatches:2,known:1},
  {kind:'stat-throw',dispatches:3,known:1},
  {kind:'cap-return',dispatches:6,known:1},
  {kind:'cap-active-bit',dispatches:6,known:1},
  {kind:'security-null-length',dispatches:7,known:1},
  {kind:'security-tail',dispatches:7,known:1},
  {kind:'read-short',dispatches:1034,known:86},
  {kind:'read-content',dispatches:1035,known:86},
  {kind:'eof-extra',dispatches:1035,known:86},
  {kind:'native-quota',dispatches:602,known:86},
  {kind:'raw-quota',dispatches:605,known:86},
  {kind:'text-quota',dispatches:602,known:86},
];
function nativeFaultMutation(kind) {
  return source=>{
    const marker='# Inert fixed native PM readback prerequisite.';
    source=once(source,marker,'my ($test_fault_armed,$test_fault_original);BEGIN {$test_fault_armed=0;}\n'+marker);
    const boundary=String.raw`$event->{error}=$@;$event->{ok}=$ok?1:0;
            CORE::die $literal_refusal unless $ok&&$error_plain->($event->{error})`;
    const conditions={
      'lstat-throw':[`$kind eq 'lstat'`,`$event->{ok}=0;$event->{error}="MODELED_LSTAT_THROW\n";$ok=0;`],
      'tuple-short':[`$kind eq 'lstat'`,`CORE::pop(@{$event->{values}});`],
      'tuple-mode':[`$kind eq 'lstat'`,`$event->{values}[2]|=0020;`],
      'tuple-owner':[`$kind eq 'lstat'`,`$event->{values}[4]=70;`],
      'open-false-after-enrollment':[`$kind eq 'open'`,`$event->{result}=0;`],
      'stat-throw':[`$kind eq 'stat'`,`$event->{ok}=0;$event->{error}="MODELED_STAT_THROW\n";$ok=0;`],
      'cap-return':[`$kind eq 'capabilities'`,`$event->{result}=-1;`],
      'cap-active-bit':[`$kind eq 'capabilities'`,`my $bits=CORE::unpack('L',CORE::substr(${'${'} $event->{buffer_cell} },8,4));CORE::substr(${'${'} $event->{buffer_cell} },8,4)=CORE::pack('L',$bits&~0x400);`],
      'security-null-length':[`$kind eq 'security'`,`CORE::substr(${'${'} $event->{buffer_cell} },8,4)=CORE::pack('L',1);`],
      'security-tail':[`$kind eq 'security'`,`CORE::substr(${'${'} $event->{buffer_cell} },12,1)="\x00";`],
      'read-short':[`$kind eq 'read'`,`$event->{result}--;`],
      'read-content':[`$kind eq 'read'`,`CORE::substr(${'${'} $event->{buffer_cell} },0,1)="X";`],
      'eof-extra':[`$kind eq 'eof'`,`$event->{result}=1;${'${'} $event->{buffer_cell} }="X";`],
    };
    if(conditions[kind]) {
      const [condition,effect]=conditions[kind];
      source=once(source,boundary,String.raw`$event->{error}=$@;$event->{ok}=$ok?1:0;
            if(!$test_fault_armed&&CONDITION) {
                $test_fault_original={kind=>$kind,index=>$record->{index},ok=>$ok?1:0,
                    result=>$event->{result},errno=>$event->{errno},error=>$event->{error},
                    values=>defined($event->{values})?[@{$event->{values}}]:undef,
                    buffer=>defined($event->{buffer_cell})?CORE::substr(${'${'} $event->{buffer_cell} },0):undef};
                $test_fault_armed=1;EFFECT
            }
            CORE::die $literal_refusal unless $ok&&$error_plain->($event->{error})`.replace('CONDITION',condition).replace('EFFECT',effect.replaceAll("${'${'}",'${')));
    } else {
      const setting={
        'native-quota':`$operations=16384;`,
        'raw-quota':`$raw_reserved=67108864;`,
        'text-quota':`$text_reserved=33554432;`,
      }[kind];assert.ok(setting);
      const afterAcquisition='                $check_originals->();\n                for my $index(0..53) {$validated[$index]=$read->($originals[$index+32]);}';
      source=once(source,afterAcquisition,'                $test_fault_armed=1;'+setting+'\n'+afterAcquisition);
    }
    return source;
  };
}
const faultFamilyOutput=earlyFaultOutput(String.raw`
    CORE::print "fault-armed\t",$test_fault_armed,"\n";
    if(defined($test_fault_original)) {
        CORE::print "genuine-kind\t",$test_fault_original->{kind},"\n";
        CORE::print "genuine-index\t",$test_fault_original->{index},"\n";
        CORE::print "genuine-ok\t",$test_fault_original->{ok},"\n";
        for my $field('result','errno','error','buffer') {
            my $value=$test_fault_original->{$field};
            CORE::print 'genuine:',$field,"\t",!defined($value)?'UNDEF':CORE::ref($value) ne ''?'REFERENCE':CORE::unpack('H*',$value),"\n";
        }
        CORE::print "genuine-tuple\t",CORE::join(',',@{$test_fault_original->{values}}),"\n" if defined($test_fault_original->{values});
    }
`);
function assertGenuineFaultDelegate(o,scenario) {
  if(scenario.kind.endsWith('-quota')) {
    assert.equal(o['event:602:kind'],'security');assert.equal(o['event:602:index'],'85');
    assert.equal(o['event:602:result'],'30');assert.equal(o['event:602:error'],'');
    assert.equal(o['native-known'],'86');return;
  }
  assert.equal(o['genuine-ok'],'1');assert.equal(o['genuine:error'],'');
  const errno=Buffer.from(o['genuine:errno'],'hex').toString('ascii');assert.match(errno,/^(?:0|[1-9][0-9]*)$/);
  const kind=o['genuine-kind'],result=o['genuine:result']==='UNDEF'?undefined:Buffer.from(o['genuine:result'],'hex').toString('ascii');
  if(kind==='lstat'||kind==='stat') {
    const tuple=o['genuine-tuple'].split(',').map(Number);assert.equal(tuple.length,13);
    assert.ok(tuple.every(Number.isSafeInteger));assert.equal(tuple[2]&0o170000,0o040000);
    assert.equal(tuple[2]&0o022,0);assert.equal(tuple[4],0);assert.equal(tuple[5],0);
  }else if(kind==='open')assert.equal(result,'1');
  else if(kind==='capabilities'||kind==='security') {
    assert.equal(result,'0');const bytes=Buffer.from(o['genuine:buffer'],'hex');assert.equal(bytes.length,8192);
    if(kind==='capabilities') {
      assert.equal(bytes.readUInt32LE(0),36);assert.ok(bytes.readUInt32LE(8)&0x400);assert.ok(bytes.readUInt32LE(24)&0x400);
      assert.ok(bytes.subarray(36).every(byte=>byte===0xcc));
    }else{assert.deepEqual([...bytes.subarray(0,12)],[12,0,0,0,8,0,0,0,0,0,0,0]);assert.ok(bytes.subarray(12).every(byte=>byte===0xcc));}
  }else if(kind==='read') {
    const row=leaves[Number(o['genuine-index'])-32],bytes=Buffer.from(o['genuine:buffer'],'hex');
    assert.equal(result,String(row.bytes));assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);
  }else{assert.equal(kind,'eof');assert.equal(result,'0');assert.equal(o['genuine:buffer'],'');}
}

for(const scenario of nativeFaultCases) {
  test('armed ordinary native refusal and once settlement: '+scenario.kind,async t=>{
    const r=await invokeNative(scenario.kind,{mutate:nativeFaultMutation(scenario.kind),earlyFailure:faultFamilyOutput,expectedStatus:scenario.known===0?1:0}),o=r.observations;
    assert.equal(o['fault-armed'],'1');assertGenuineFaultDelegate(o,scenario);assert.equal(o['native-issue'],'0');
    assert.equal(o['native-actual-dispatches'],String(scenario.dispatches));
    assert.equal(o['native-known'],String(scenario.known));
    assert.equal(o['native-close-attempts'],String(scenario.known));
    assert.equal(o['native-live-attempts'],String(scenario.known));
    assert.equal(o['native-close-ok'],String(scenario.known));
    assert.equal(o['native-revocation'],'1');assert.equal(o['native-fault-release'],scenario.known===0?'0':'1');
    for(let index=0;index<scenario.known;index++) {
      assert.equal(o['cleanup:'+index+':close_return'],'31');assert.equal(o['cleanup:'+index+':close_error'],'');
      assert.equal(o['cleanup:'+index+':live_return'],'UNDEF');assert.equal(o['cleanup:'+index+':live_error'],'');
    }
    t.diagnostic(JSON.stringify({home:r.home,pid:r.pid,scenario:scenario.kind,scope:'actual genuine native delegate; MODELED post-result/finite private quota fault; original full outcomes retained'}));
  });
}


const lifecycleCases=[
 {kind:'fake-invalidator',expectedStatus:1,issue:'1',dispatches:2216,revocation:'0',closed:86},
 {kind:'fake-invalidator-counter128',expectedStatus:1,issue:'1',dispatches:2216,revocation:'0',closed:86},
 {kind:'close-then-throw',expectedStatus:1,issue:'1',dispatches:2216,revocation:'1',closed:85},
 {kind:'read-reentry-release',expectedStatus:0,issue:'0',dispatches:1034,revocation:'1',closed:86},
 {kind:'publication-reentry-release',expectedStatus:0,issue:'0',dispatches:2216,revocation:'1',closed:86},
 {kind:'partial-install-throw',expectedStatus:0,issue:'0',dispatches:2216,revocation:'1',closed:86},
];
function lifecycleMutation(kind) {
 return source=>{
  source=once(source,'my $pm_compiler_test_probe;',String.raw`my ($test_pm_counter_force,$test_lifecycle_armed,$test_fake_active,$test_fake_calls,$test_real_close_calls,$test_partial_insert,$test_reentry_read,$test_publication_result,$test_publication_bytes,$test_publication_count,$test_pm_install_probe);
BEGIN {$test_lifecycle_armed=0;$test_fake_active=1;$test_fake_calls=0;$test_real_close_calls=0;}
my $pm_compiler_test_probe;`);
  source=once(source,'        $pm_compiler_test_probe=sub {',String.raw`        $test_pm_counter_force=sub {$calls=128;};
        $pm_compiler_test_probe=sub {`);
  if(kind.startsWith('fake-invalidator')) {
   const wrap=String.raw`BEGIN {
    my $genuine_installer=$pm_loader_install;
    $pm_loader_install=sub {
      if(@_!=0&&$test_fake_active) {$test_lifecycle_armed=1;$test_fake_calls++;CORE::die "TASK6A_PM_SOURCE_REFUSED\n";}
      return $genuine_installer->(@_);
    };
}
`;
   return once(source,'# Inert fixed native PM readback prerequisite.',wrap+'# Inert fixed native PM readback prerequisite.');
  }
  if(kind==='close-then-throw') {
   return once(source,'$record->{close_return}=CORE::close($handle);',String.raw`$record->{close_return}=CORE::close($handle);$test_real_close_calls++;
        if(!$test_lifecycle_armed) {$test_lifecycle_armed=1;CORE::die "MODELED_AFTER_GENUINE_CLOSE\n";}`);
  }
  if(kind==='read-reentry-release') {
   return once(source,'$event->{result}=CORE::sysread($handle,$buffer,$request);',String.raw`$event->{result}=CORE::sysread($handle,$buffer,$request);
       if($kind eq 'read'&&!$test_lifecycle_armed) {$test_reentry_read={result=>$event->{result},errno=>0+$!,bytes=>CORE::substr($buffer,0)};$test_lifecycle_armed=1;$pm_native_readback_release->();}`);
  }
  if(kind==='publication-reentry-release') {
   return once(source,'$event->{result}=CORE::push(@pm_completed_readbacks,CORE::substr($validated[$index],0));',String.raw`$event->{result}=CORE::push(@pm_completed_readbacks,CORE::substr($validated[$index],0));
       if(!$test_lifecycle_armed) {$test_publication_result=$event->{result};$test_publication_count=CORE::scalar(@pm_completed_readbacks);$test_publication_bytes=CORE::substr($pm_completed_readbacks[0],0);$test_lifecycle_armed=1;$pm_native_readback_release->();}`);
  }
  assert.equal(kind,'partial-install-throw');
  source=once(source,'        $test_pm_counter_force=sub {$calls=128;};',String.raw`        $test_pm_counter_force=sub {$calls=128;};
        $test_pm_install_probe=sub {
         for my $pair(['outcome',$install_outcome],['error',$install_error],['shape',$install_post_shape],['shape-error',$install_post_error]) {
          my $v=$pair->[1];CORE::print 'lifecycle-pm-install:',$pair->[0],"\t",!defined($v)?'UNDEF':CORE::ref($v) ne ''?'REFERENCE':CORE::unpack('H*',$v),"\n";
         }
        };`);
  source=once(source,'            CORE::print "native-phase\\t",$phase,"\\n";',String.raw`            CORE::print "native-phase\t",$phase,"\n";
            CORE::print "lifecycle-install-succeeded\t",$install_succeeded,"\n";
            CORE::print "lifecycle-hook-captured\t",$hook_captured,"\n";`);
  return once(source,'$inserted=CORE::unshift(@INC,$original_hook);' ,String.raw`$inserted=CORE::unshift(@INC,$original_hook);
       $test_partial_insert=$inserted;$test_lifecycle_armed=1;CORE::die "MODELED_AFTER_GENUINE_UNSHIFT\n";`);
 };
}
const lifecycleIssueOutput=earlyFaultOutput(String.raw`
 if(defined($test_publication_result)) {
  CORE::print "lifecycle-genuine-push-return\t",$test_publication_result,"\n";
  CORE::print "lifecycle-genuine-push-count\t",$test_publication_count,"\n";
  CORE::print "lifecycle-genuine-push-bytes\t",CORE::unpack('H*',$test_publication_bytes),"\n";
 }
 if(defined($test_partial_insert)){$test_pm_install_probe->();CORE::print "lifecycle-genuine-insert\t",$test_partial_insert,"\n";}
 if(defined($test_reentry_read)) {
  CORE::print "lifecycle-genuine-read-return\t",$test_reentry_read->{result},"\n";
  CORE::print "lifecycle-genuine-read-errno\t",$test_reentry_read->{errno},"\n";
  CORE::print "lifecycle-genuine-read-bytes\t",CORE::unpack('H*',$test_reentry_read->{bytes}),"\n";
 }
 CORE::print "lifecycle-armed\t",$test_lifecycle_armed,"\n";my $state=$pm_loader_native_state->();CORE::print "lifecycle-target\t",CORE::join(',',@$state[0..2]),"\n";`);
function lifecycleRuntime(kind) {
 return String.raw`
 if(COUNTER) {$test_pm_counter_force->();}
 my $before=$pm_loader_native_state->();CORE::print "lifecycle-target-before\t",CORE::join(',',@$before[0..2]),"\n";
 my $one=eval {$pm_native_readback_release->();1;};my $first_error=$@;
 CORE::print "lifecycle-first-release\t",$one?1:0,"\n";
 CORE::print "lifecycle-first-error\t",CORE::unpack('H*',$first_error),"\n";
 $test_fake_active=0; # Restoration cannot grant another invalidation/close attempt.
 my $two=eval {$pm_native_readback_release->();1;};my $second_error=$@;
 CORE::print "lifecycle-second-release\t",$two?1:0,"\n";
 CORE::print "lifecycle-second-error\t",CORE::unpack('H*',$second_error),"\n";
 CORE::print "lifecycle-armed\t",$test_lifecycle_armed,"\n";
 CORE::print "lifecycle-fake-attempts\t",$test_fake_calls,"\n";
 CORE::print "lifecycle-real-close-attempts\t",$test_real_close_calls,"\n";
 my $state=$pm_loader_native_state->();CORE::print "lifecycle-target\t",CORE::join(',',@$state[0..2]),"\n";
 $pm_native_test_probe->();CORE::exit(0);
 `.replace('COUNTER',kind==='fake-invalidator-counter128'?'1':'0');
}
function assertLifecycle(o,scenario) {
 assert.equal(o['native-issue'],scenario.issue);assert.equal(o['lifecycle-armed'],'1');
 assert.equal(o['native-actual-dispatches'],String(scenario.dispatches));assert.equal(o['native-known'],'86');
 assert.equal(o['native-close-attempts'],'86');assert.equal(o['native-live-attempts'],'86');assert.equal(o['native-close-ok'],String(scenario.closed));
 assert.equal(o['native-revocation'],scenario.revocation);
 for(let index=0;index<86;index++) {
  assert.equal(o['cleanup:'+index+':close_return'],'31');
  assert.equal(o['cleanup:'+index+':live_return'],'UNDEF');assert.equal(o['cleanup:'+index+':live_error'],'');
  const expectedError=scenario.kind==='close-then-throw'&&index===85?Buffer.from('MODELED_AFTER_GENUINE_CLOSE\n').toString('hex'):'';
  assert.equal(o['cleanup:'+index+':close_error'],expectedError);
 }
 if(scenario.issue==='1') {
  assert.equal(o['lifecycle-first-release'],'0');assert.equal(o['lifecycle-second-release'],'0');
  assert.equal(Buffer.from(o['lifecycle-first-error'],'hex').toString(),'TASK6A_NATIVE_PM_READBACK_REFUSED\n');
  assert.equal(o['lifecycle-first-error'],o['lifecycle-second-error']);
  if(scenario.kind.startsWith('fake-invalidator')) {
   assert.equal(o['lifecycle-fake-attempts'],'1');assert.match(o['lifecycle-target'],/^installed,[0-9]+,1$/);
   if(scenario.kind.endsWith('counter128'))assert.equal(o['lifecycle-target'],'installed,128,1');
  }else {
   assert.equal(o['lifecycle-real-close-attempts'],'86');assert.equal(Buffer.from(o['cleanup:85:close_error'],'hex').toString(),'MODELED_AFTER_GENUINE_CLOSE\n');
   assert.match(o['lifecycle-target'],/^burned,[0-9]+,2$/);
  }
 }else{
  assert.equal(o['native-fault-release'],'1');assert.match(o['lifecycle-target'],/^burned,0,1$/);
  if(scenario.kind==='partial-install-throw') {
   assert.equal(o['lifecycle-genuine-insert'],'3');assert.equal(o['lifecycle-pm-install:outcome'],'33');
   assert.equal(Buffer.from(o['lifecycle-pm-install:error'],'hex').toString(),'MODELED_AFTER_GENUINE_UNSHIFT\n');
   assert.equal(o['lifecycle-pm-install:shape'],'31');assert.equal(o['lifecycle-pm-install:shape-error'],'');
   assert.equal(o['lifecycle-install-succeeded'],'0');assert.equal(o['lifecycle-hook-captured'],'0');
  }
  if(scenario.kind==='publication-reentry-release') {
   const row=leaves[0],bytes=Buffer.from(o['lifecycle-genuine-push-bytes'],'hex');assert.equal(o['lifecycle-genuine-push-return'],'1');assert.equal(o['lifecycle-genuine-push-count'],'1');assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);
  }
  if(scenario.kind==='read-reentry-release') {
   const row=leaves[0],bytes=Buffer.from(o['lifecycle-genuine-read-bytes'],'hex');assert.equal(o['lifecycle-genuine-read-return'],String(row.bytes));assert.equal(sha(bytes),row.sha256);assert.match(o['lifecycle-genuine-read-errno'],/^(?:0|[1-9][0-9]*)$/);
  }
 }
}
for(const scenario of lifecycleCases) {
 test('once native lifecycle refuses restoration/reentry: '+scenario.kind,async t=>{
  const r=await invokeNative(scenario.kind,{mutate:lifecycleMutation(scenario.kind),earlyFailure:scenario.issue==='0'?lifecycleIssueOutput:undefined,expectedStatus:scenario.expectedStatus,
   runtime:lifecycleRuntime(scenario.kind)});assertLifecycle(r.observations,scenario);
  t.diagnostic(JSON.stringify({home:r.home,pid:r.pid,scope:'ordinary genuine native owner/delegate; explicitly MODELED lower invalidator/counter or reentry/throw; no initialTCB'}));
 });
}


const ownedFixtureCases=[
 {kind:'fixture-valid',issue:'1',known:86,dispatches:2216,expectedStatus:0},
 {kind:'fixture-missing',issue:'0',known:32,dispatches:225,expectedStatus:1},
 {kind:'fixture-symlink',issue:'0',known:32,dispatches:225,expectedStatus:1},
 {kind:'fixture-group-write',issue:'0',known:32,dispatches:225,expectedStatus:1},
 {kind:'fixture-world-write',issue:'0',known:32,dispatches:225,expectedStatus:1},
 {kind:'fixture-extra-byte',issue:'0',known:32,dispatches:225,expectedStatus:1},
 {kind:'fixture-corrupt-same-size',issue:'0',known:86,dispatches:1035,expectedStatus:0},
 {kind:'fixture-same-byte-rename',issue:'0',known:33,dispatches:228,expectedStatus:0},
];
function ownedFixtureMutation(kind) {
 return (source,home)=>{
  assert.match(home,/^[A-Za-z0-9/._-]+$/);
  const row=leaves[0],bytes=fs.readFileSync(home+'/0.input'),file=home+'/native-source.pm',retained=home+'/native-source.before-move.pm',replacement=home+'/native-source.replacement.pm';
  assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);
  const modeledUID=process.getuid(),modeledGID=fs.lstatSync(home).gid;
  assert.ok(Number.isSafeInteger(modeledGID)&&modeledGID>=0,'actual created parent GID');
  const snapshots=[];
  const save=file=>{const st=fs.lstatSync(file),b=st.isFile()?fs.readFileSync(file):null;return {path:file,device:st.dev,inode:st.ino,mode:st.mode,uid:st.uid,gid:st.gid,bytes:st.size,sha256:b?sha(b):null,type:st.isSymbolicLink()?'symlink':st.isFile()?'file':'unknown',target:st.isSymbolicLink()?fs.readlinkSync(file):null};};
  if(kind==='fixture-symlink')fs.symlinkSync(home+'/0.input',file);
  else if(kind!=='fixture-missing') {
   let content=Buffer.from(bytes);
   if(kind==='fixture-extra-byte')content=Buffer.concat([content,Buffer.from('X')]);
   if(kind==='fixture-corrupt-same-size')content[0]^=1;
   fs.writeFileSync(file,content,{flag:'wx',mode:0o600});
   if(kind==='fixture-group-write')fs.chmodSync(file,0o620);
   if(kind==='fixture-world-write')fs.chmodSync(file,0o602);
  }
  if(kind!=='fixture-missing')snapshots.push(save(file));
  if(kind!=='fixture-missing'&&kind!=='fixture-symlink')fs.writeFileSync(home+'/fixture.expected.input',fs.readFileSync(file),{flag:'wx',mode:0o600});
  if(kind==='fixture-same-byte-rename') {
   fs.writeFileSync(replacement,bytes,{flag:'wx',mode:0o600});snapshots.push(save(replacement));
   assert.equal(snapshots[0].sha256,snapshots[1].sha256);assert.notEqual(snapshots[0].inode,snapshots[1].inode);assert.equal(fs.existsSync(retained),false);
  }
  assert.ok(snapshots.every(st=>st.uid===modeledUID&&st.gid===modeledGID),'actual fixture inherited ownership before dispatch');
  fs.writeFileSync(home+'/fixture-creation.json',JSON.stringify({kind,modeledUID,modeledGID,paths:{file,retained,replacement},snapshots,expectedInput:kind!=='fixture-missing'&&kind!=='fixture-symlink'?home+'/fixture.expected.input':null,model:'one native leaf path/expectedordinaryUIDGID only; ancestry is unchangedSystemMODEL; noRoot'} )+'\n',{flag:'wx',mode:0o600});
  const start=source.indexOf('# Inert fixed native PM readback prerequisite.');assert.ok(start>0);
  let prefix=source.slice(0,start),native=source.slice(start);
  native=once(native,"['Carp.pm','/System/Library/Perl/5.34/Carp.pm',35985,",`['Carp.pm','${file}',35985,`);
  native=once(native,'&&($values->[2]&0022)==0&&$values->[4]==0&&$values->[5]==0;',`&&($values->[2]&0022)==0&&$values->[4]==($record->{index}==32?${modeledUID}:0)&&$values->[5]==($record->{index}==32?${modeledGID}:0);`);
  source=prefix+native;
  if(kind==='fixture-same-byte-rename') {
   source=once(source,'my $pm_compiler_test_probe;','my ($test_fixture_renames,$test_fixture_before,$test_fixture_after,$test_fixture_held_query,$test_fixture_after_query);\nBEGIN {$test_fixture_renames=[];}\nmy $pm_compiler_test_probe;');
   const boundary=String.raw`$event->{error}=$@;$event->{ok}=$ok?1:0;
            CORE::die $literal_refusal unless $ok&&$error_plain->($event->{error})`;
   source=once(source,boundary,String.raw`$event->{error}=$@;$event->{ok}=$ok?1:0;
            if($kind eq 'open'&&$record->{index}==32) {
              $test_fixture_held_query={intent=>1};$!=0;my $held_ok=eval {$test_fixture_before=[CORE::stat($record->{handle})];$test_fixture_held_query->{errno}=0+$!;1;};
              $test_fixture_held_query->{ok}=$held_ok?1:0;$test_fixture_held_query->{error}=$@;
              CORE::die "TEST_OWNED_FIXTURE_HELD_QUERY\n" unless $held_ok&&@{$test_fixture_before}==13&&!CORE::ref($test_fixture_held_query->{error})&&$test_fixture_held_query->{error} eq '';
              my $replacement_expected=REPLACEMENT_EXPECTED;
              for my $pair(['FILE','RETAINED',$test_fixture_before],['REPLACEMENT','FILE',$replacement_expected]) {
                my $entry={source=>$pair->[0],destination=>$pair->[1]};CORE::push(@$test_fixture_renames,$entry);
                $!=0;my $source_ok=eval {$entry->{source_tuple}=[CORE::lstat($pair->[0])];$entry->{source_errno}=0+$!;1;};$entry->{source_error}=$@;$entry->{source_ok}=$source_ok?1:0;
                $!=0;my $destination_ok=eval {$entry->{destination_tuple}=[CORE::lstat($pair->[1])];$entry->{destination_errno}=0+$!;1;};$entry->{destination_error}=$@;$entry->{destination_ok}=$destination_ok?1:0;
                CORE::die "TEST_OWNED_FIXTURE_PREFLIGHT\n" unless $source_ok&&$destination_ok&&!CORE::ref($entry->{source_error})&&$entry->{source_error} eq ''&&!CORE::ref($entry->{destination_error})&&$entry->{destination_error} eq ''&&@{$entry->{source_tuple}}==13&&@{$entry->{destination_tuple}}==0&&$entry->{destination_errno}==2;
                for my $field(0,1,2,4,5,7) {CORE::die "TEST_OWNED_FIXTURE_SOURCE_CHANGED\n" unless $entry->{source_tuple}[$field]==$pair->[2][$field];}
                my $source_argument=CORE::substr($pair->[0],0);my $destination_argument=CORE::substr($pair->[1],0);
                $!=0;my $r;my $ok=eval {$r=CORE::syscall(488,-2,$source_argument,-2,$destination_argument,4);$entry->{errno}=0+$!;1;};my $error=$@;
                $entry->{return}=$r;$entry->{error}=$error;$entry->{ok}=$ok?1:0;
                CORE::die "TEST_OWNED_FIXTURE_RENAME_EXCL\n" unless $ok&&defined($r)&&$r eq '0'&&!CORE::ref($error)&&$error eq '';
              }
              $test_fixture_after_query={intent=>1};$!=0;my $after_ok=eval {$test_fixture_after=[CORE::lstat('FILE')];$test_fixture_after_query->{errno}=0+$!;1;};
              $test_fixture_after_query->{ok}=$after_ok?1:0;$test_fixture_after_query->{error}=$@;
              CORE::die "TEST_OWNED_FIXTURE_AFTER_QUERY\n" unless $after_ok&&@{$test_fixture_after}==13&&!CORE::ref($test_fixture_after_query->{error})&&$test_fixture_after_query->{error} eq '';
            }
            CORE::die $literal_refusal unless $ok&&$error_plain->($event->{error})`.replace('REPLACEMENT_EXPECTED','['+snapshots[1].device+','+snapshots[1].inode+','+snapshots[1].mode+',0,'+snapshots[1].uid+','+snapshots[1].gid+',0,'+snapshots[1].bytes+']').replaceAll('REPLACEMENT',replacement).replaceAll('RETAINED',retained).replaceAll('FILE',file));
  }
  return source;
 };
}
const ownedFixtureOutput=earlyFaultOutput(String.raw`
 if(defined($test_fixture_held_query)) {
  for my $pair(['held',$test_fixture_held_query],['after',$test_fixture_after_query]) {
   my ($label,$query)=@$pair;next unless defined($query);
   CORE::print 'fixture-query:',$label,"\t",$query->{ok},',',$query->{errno},',',!defined($query->{error})?'UNDEF':CORE::ref($query->{error}) ne ''?'REFERENCE':CORE::unpack('H*',$query->{error}),"\n";
  }
 }
 if(defined($test_fixture_before)) {
  CORE::print "fixture-native-before\t",CORE::join(',',@$test_fixture_before),"\n";
  CORE::print "fixture-native-after\t",CORE::join(',',@$test_fixture_after),"\n";
  for my $i(0..$#$test_fixture_renames) {
   my $r=$test_fixture_renames->[$i];
   for my $label('source','destination') {CORE::print 'fixture-preflight:',$label,':',$i,"\t",$r->{$label.'_ok'},',',!defined($r->{$label.'_error'})?'UNDEF':CORE::ref($r->{$label.'_error'}) ne ''?'REFERENCE':CORE::unpack('H*',$r->{$label.'_error'}),"\n";}
   CORE::print 'fixture-source-errno:',$i,"\t",$r->{source_errno},"\n";
   CORE::print 'fixture-source-tuple:',$i,"\t",CORE::join(',',@{$r->{source_tuple}}),"\n";
   CORE::print 'fixture-destination-tuple:',$i,"\t",CORE::join(',',@{$r->{destination_tuple}}),"\n";
   CORE::print 'fixture-destination-errno:',$i,"\t",$r->{destination_errno},"\n";
   CORE::print 'fixture-rename:',$i,"\t",$r->{ok},',',$r->{return},',',$r->{errno},',',CORE::unpack('H*',$r->{error}),"\n";
  }
 }
`);
const ownedFixtureRuntime=String.raw`my $closed=eval {$pm_native_readback_release->();1;};CORE::print "fixture-runtime-release\t",$closed?1:0,"\n";$pm_native_test_probe->();CORE::exit(0);`;
function assertOwnedFixture(o,scenario,home) {
 assert.equal(o['native-issue'],scenario.issue);assert.equal(o['native-actual-dispatches'],String(scenario.dispatches));
 assert.equal(o['native-known'],String(scenario.known));assert.equal(o['native-close-attempts'],String(scenario.known));assert.equal(o['native-live-attempts'],String(scenario.known));assert.equal(o['native-close-ok'],String(scenario.known));
 for(let index=0;index<scenario.known;index++) {
  assert.equal(o['cleanup:'+index+':close_return'],'31');assert.equal(o['cleanup:'+index+':close_error'],'');
  assert.equal(o['cleanup:'+index+':live_return'],'UNDEF');assert.equal(o['cleanup:'+index+':live_error'],'');
 }
 const f=JSON.parse(fs.readFileSync(home+'/fixture-creation.json','utf8')),kind=scenario.kind;
 assert.equal(o['original:32'],f.paths.file);assert.equal(o['native-revocation'],'1');
 if(scenario.issue==='0') {
  assert.equal(Buffer.from(o['native-fault-error'],'hex').toString(),'TASK6A_NATIVE_PM_READBACK_REFUSED\n');
  const quarantine=scenario.known===32;assert.equal(o['native-fault-release'],quarantine?'0':'1');
  assert.equal(o['native-phase'],quarantine?'burned':'released');assert.equal(o['end-cleanup-ok'],quarantine?'0':'1');
 }else assert.equal(o['fixture-runtime-release'],'1');
 if(kind==='fixture-missing') {
  assert.equal(o['event:225:tuple'],'');assert.equal(o['event:225:error'],'');assert.equal(o['event:225:errno'],'32');
 }else {
  const st=f.snapshots[0],tuple=o['event:225:tuple'].split(',').map(Number);assert.equal(tuple.length,13);
  for(const [field,value] of [[0,st.device],[1,st.inode],[2,st.mode],[4,st.uid],[5,st.gid],[7,st.bytes]])assert.equal(tuple[field],value);
  assert.equal(o['event:225:error'],'');
  if(kind==='fixture-symlink'){assert.equal(tuple[2]&0o170000,0o120000);assert.equal(st.target,home+'/0.input');}
  else {assert.equal(tuple[2]&0o170000,0o100000);assert.equal(tuple[4],f.modeledUID);assert.equal(tuple[5],f.modeledGID);}
  if(kind==='fixture-group-write')assert.ok(tuple[2]&0o020);
  if(kind==='fixture-world-write')assert.ok(tuple[2]&0o002);
  if(kind==='fixture-extra-byte')assert.equal(tuple[7],leaves[0].bytes+1);
 }
 if(kind==='fixture-corrupt-same-size') {
  const expected=fs.readFileSync(f.expectedInput),actual=Buffer.from(o['event:1034:buffer'],'hex');assert.deepEqual(actual,expected);assert.equal(actual.length,leaves[0].bytes);assert.notEqual(sha(actual),leaves[0].sha256);
  assert.ok(['0','0 but true'].includes(Buffer.from(o['event:1033:result'],'hex').toString()));assert.equal(o['event:1033:error'],'');
  assert.equal(Buffer.from(o['event:1034:result'],'hex').toString(),String(leaves[0].bytes));assert.equal(o['event:1034:error'],'');
  assert.equal(o['event:1035:result'],'30');assert.equal(o['event:1035:buffer'],'');assert.equal(o['event:1035:error'],'');
 }
 if(scenario.kind==='fixture-same-byte-rename') {
  const before=o['fixture-native-before'].split(',').map(Number),after=o['fixture-native-after'].split(',').map(Number);assert.equal(before.length,13);assert.equal(after.length,13);assert.notEqual(before[1],after[1]);assert.equal(before[7],after[7]);
  assert.match(o['fixture-query:held'],/^1,(?:0|[1-9][0-9]*),$/);assert.match(o['fixture-query:after'],/^1,(?:0|[1-9][0-9]*),$/);
  for(let i=0;i<2;i++){assert.equal(o['fixture-preflight:source:'+i],'1,');assert.equal(o['fixture-preflight:destination:'+i],'1,');assert.match(o['fixture-source-errno:'+i],/^(?:0|[1-9][0-9]*)$/);assert.equal(o['fixture-destination-tuple:'+i],'');assert.equal(o['fixture-destination-errno:'+i],'2');assert.equal(o['fixture-source-tuple:'+i].split(',').length,13);}
  assert.match(o['fixture-rename:0'],/^1,0,(?:0|[1-9][0-9]*),$/);assert.match(o['fixture-rename:1'],/^1,0,(?:0|[1-9][0-9]*),$/);
 }
}
for(const scenario of ownedFixtureCases) {
 test('genuine owned filesystem with explicit path/owner MODEL: '+scenario.kind,async t=>{
  let mutate=ownedFixtureMutation(scenario.kind);
  if(scenario.kind!=='fixture-same-byte-rename') {
   const first=mutate;mutate=(source,home)=>once(first(source,home),'my $pm_compiler_test_probe;','my ($test_fixture_renames,$test_fixture_before,$test_fixture_after,$test_fixture_held_query,$test_fixture_after_query);\nmy $pm_compiler_test_probe;');
  }
  const r=await invokeNative(scenario.kind,{mutate,earlyFailure:scenario.issue==='0'?ownedFixtureOutput:undefined,expectedStatus:scenario.expectedStatus,runtime:ownedFixtureRuntime});assertOwnedFixture(r.observations,scenario,r.home);
  t.diagnostic(JSON.stringify({home:r.home,pid:r.pid,scope:'genuine owned fixture/native effects; firstleafpathandUIDGID MODELED, noSystemwrites/Root/TCB'}));
 });
}


const ownerProtocolCases=[
 {kind:'bridge-port-drift',issue:'0',known:0,dispatches:0,expectedStatus:0},
 {kind:'installer-port-drift',issue:'0',known:0,dispatches:0,expectedStatus:0},
 {kind:'bridge-field-alias',issue:'0',known:0,dispatches:0,expectedStatus:0},
 {kind:'issue-invalid-arity',issue:'0',known:0,dispatches:0,expectedStatus:0},
 {kind:'duplicate-raw-original',issue:'0',known:1,dispatches:9,expectedStatus:1},
 {kind:'duplicate-io-shape-model',issue:'0',known:1,dispatches:9,expectedStatus:1},
 {kind:'issuer-recheck-limit',issue:'1',known:86,dispatches:2216,expectedStatus:0},
 {kind:'target-recheck-reserve',issue:'1',known:86,dispatches:3238,expectedStatus:0},
];
function ownerProtocolMutation(kind) {
 return source=>{
  source=once(source,'my $pm_compiler_test_probe;',String.raw`my ($test_protocol_calls,$test_protocol_delegates,$test_protocol_prior,$test_protocol_prior_error,$test_protocol_prior_snapshot,$test_protocol_native_snapshot,$test_protocol_orphan,$test_protocol_orphan_return,$test_protocol_orphan_errno,$test_protocol_orphan_error,$test_protocol_orphan_close,$test_protocol_orphan_close_error,$test_protocol_orphan_live,$test_protocol_orphan_live_error,$test_protocol_orphan_io,$test_protocol_orphan_handle_id,$test_protocol_orphan_io_id,$test_protocol_orphan_handle_tag,$test_protocol_orphan_io_tag,$test_protocol_orphan_known,$test_protocol_orphan_started,$test_protocol_orphan_outcome,$test_protocol_orphan_dispose,$test_issuer_counter_force,$test_target_counter_force);
BEGIN {$test_protocol_calls=0;$test_protocol_delegates=0;$test_protocol_orphan_known=0;$test_protocol_orphan_started=0;}
my $pm_compiler_test_probe;`);
  source=once(source,'        $pm_compiler_test_probe=sub {',String.raw`        $test_target_counter_force=sub {$rechecks=63;};
        $pm_compiler_test_probe=sub {`);
  source=once(source,'        # Private native PM lifecycle closures end here.',String.raw`        $test_issuer_counter_force=sub {$rechecks=64;};
        $test_protocol_native_snapshot=sub {return [CORE::substr($phase,0),0+$claimed,0+$rechecks];};
        $test_protocol_orphan_dispose=sub {
         return 1 unless $test_protocol_orphan_known;
         return $test_protocol_orphan_outcome if $test_protocol_orphan_started;
         $test_protocol_orphan_started=1;$test_protocol_orphan_outcome=0;
         my $closed=eval {my ($h,$i)=$shape->($test_protocol_orphan);CORE::die "TEST_ORPHAN_IDENTITY\n" unless $raw_same->($h,$test_protocol_orphan)&&$raw_same->($i,$test_protocol_orphan_io);$test_protocol_orphan_close=CORE::close($h);1;};$test_protocol_orphan_close_error=$@;
         my $inspected=eval {my ($h,$i)=$shape->($test_protocol_orphan);CORE::die "TEST_ORPHAN_IDENTITY\n" unless $raw_same->($h,$test_protocol_orphan)&&$raw_same->($i,$test_protocol_orphan_io);$test_protocol_orphan_live=CORE::fileno($h);1;};$test_protocol_orphan_live_error=$@;
         $test_protocol_orphan_outcome=$closed&&$inspected&&$plain->($test_protocol_orphan_close)&&$test_protocol_orphan_close eq '1'&&!defined($test_protocol_orphan_live)&&$error_plain->($test_protocol_orphan_close_error)&&$test_protocol_orphan_close_error eq ''&&$error_plain->($test_protocol_orphan_live_error)&&$test_protocol_orphan_live_error eq ''?1:0;
         return $test_protocol_orphan_outcome;
        };
        # Private native PM lifecycle closures end here.`);
  if(kind==='bridge-field-alias') {
   return once(source,'# Inert fixed native PM readback prerequisite.',String.raw`BEGIN {
    my $genuine=$pm_loader_native_state;
    $pm_loader_native_state=sub {my $state=$genuine->();$test_protocol_delegates++;my $value=$state->[0];$state->[0]=\$value;return $state;};
}
# Inert fixed native PM readback prerequisite.`);
  }
  source=once(source,'BEGIN {\n    my $issued=eval {$pm_native_readback_issue->();1;};my $error=$@;',String.raw`END {
    my $primary=$?;my $disposed;my $ok=eval {$disposed=$test_protocol_orphan_dispose->();1;};my $error=$@;
    CORE::print "protocol-end-orphan-dispose\t",$ok&&$disposed?1:0,"\n";
    CORE::print "protocol-end-orphan-error\t",!defined($error)?'UNDEF':CORE::ref($error) ne ''?'REFERENCE':CORE::unpack('H*',$error),"\n";
    $?=$primary!=0?$primary:($ok&&$disposed?0:1);
}
BEGIN {
    my $issued=eval {$pm_native_readback_issue->();1;};my $error=$@;`);
  const issueStart='    my $issued=eval {$pm_native_readback_issue->();1;};my $error=$@;';
  if(kind==='bridge-port-drift'||kind==='installer-port-drift') {
   const cell=kind==='bridge-port-drift'?'$pm_loader_native_state':'$pm_loader_install';
   return once(source,issueStart,`    my $genuine=${cell};${cell}=sub {$test_protocol_calls++;return $genuine->(@_);};\n`+issueStart);
  }
  if(kind==='issue-invalid-arity')return once(source,issueStart,String.raw`    $test_protocol_prior=eval {$pm_native_readback_issue->(undef);1;}?1:0;$test_protocol_prior_error=$@;$test_protocol_prior_snapshot=$test_protocol_native_snapshot->();
`+issueStart);
  if(kind==='duplicate-io-shape-model') {
   const call='$event->{result}=CORE::sysopen(${ $record->{cell} },$record->{path},0x01000100);';
   source=once(source,call,call+String.raw`
       if($record->{index}==1) {$test_protocol_orphan_return=$event->{result};$test_protocol_orphan_errno=0+$!;$test_protocol_orphan_error=$@;
        if($plain->($event->{result})&&$event->{result} eq '1') {my ($h,$i)=$shape->(${'${'} $record->{cell} });$test_protocol_orphan=$h;$test_protocol_orphan_io=$i;$test_protocol_orphan_known=1;$test_protocol_orphan_handle_id=CORE::sprintf('%x',0+$h);$test_protocol_orphan_io_id=CORE::sprintf('%x',0+$i);$test_protocol_orphan_handle_tag=CORE::ref($h);$test_protocol_orphan_io_tag=CORE::ref($i);}}`);
   return once(source,'my ($opened_handle,$opened_io)=$shape->(${ $record->{cell} });',String.raw`my ($opened_handle,$opened_io)=$shape->(${'${'} $record->{cell} });
       if($record->{index}==1&&$test_protocol_orphan_known){$test_protocol_calls++;$opened_io=$originals[0]{io};} # MODEL after genuine shape; no actual IO slot overwrite.
`);
  }
  if(kind==='duplicate-raw-original') {
   const call='$event->{result}=CORE::sysopen(${ $record->{cell} },$record->{path},0x01000100);';
   return once(source,call,call+String.raw`
       if($record->{index}==1) {
        $test_protocol_orphan_return=$event->{result};$test_protocol_orphan_errno=0+$!;$test_protocol_orphan_error=$@;
        if($plain->($event->{result})&&$event->{result} eq '1') {my ($h,$i)=$shape->(${'${'} $record->{cell} });$test_protocol_orphan=$h;$test_protocol_orphan_io=$i;$test_protocol_orphan_known=1;$test_protocol_orphan_handle_id=CORE::sprintf('%x',0+$h);$test_protocol_orphan_io_id=CORE::sprintf('%x',0+$i);$test_protocol_orphan_handle_tag=CORE::ref($h);$test_protocol_orphan_io_tag=CORE::ref($i);
        $test_protocol_calls++;${'${'} $record->{cell} }=$originals[0]{handle};}
       }`);
  }
  assert.ok(kind==='issuer-recheck-limit'||kind==='target-recheck-reserve');return source;
 };
}
const ownerProtocolOutput=earlyFaultOutput(String.raw`
 CORE::print "protocol-wrapper-calls\t",$test_protocol_calls,"\n";
 CORE::print "protocol-genuine-delegates\t",$test_protocol_delegates,"\n";
 if(defined($test_protocol_prior_snapshot)){CORE::print "protocol-prior-snapshot\t",CORE::join(',',@$test_protocol_prior_snapshot),"\n";CORE::print "protocol-prior-error\t",CORE::unpack('H*',$test_protocol_prior_error),"\n";}
 CORE::print "protocol-orphan-known\t",$test_protocol_orphan_known,"\n";
 CORE::print "protocol-prior-arity\t",defined($test_protocol_prior)?$test_protocol_prior:'UNDEF',"\n";
 if($test_protocol_orphan_known) {
  CORE::print "protocol-genuine-orphan-handle-id\t",$test_protocol_orphan_handle_id,"\n";
  CORE::print "protocol-genuine-orphan-io-id\t",$test_protocol_orphan_io_id,"\n";
  CORE::print "protocol-genuine-orphan-handle-tag\t",$test_protocol_orphan_handle_tag,"\n";
  CORE::print "protocol-genuine-orphan-io-tag\t",$test_protocol_orphan_io_tag,"\n";
  CORE::print "protocol-genuine-orphan-return\t",$test_protocol_orphan_return,"\n";
  CORE::print "protocol-genuine-orphan-errno\t",$test_protocol_orphan_errno,"\n";
  CORE::print "protocol-genuine-orphan-error\t",CORE::unpack('H*',$test_protocol_orphan_error),"\n";
  $test_protocol_orphan_dispose->();
  CORE::print "protocol-test-owner-orphan-close-error\t",CORE::unpack('H*',$test_protocol_orphan_close_error),"\n";
  CORE::print "protocol-test-owner-orphan-live-error\t",CORE::unpack('H*',$test_protocol_orphan_live_error),"\n";
  CORE::print "protocol-test-owner-orphan-close\t",$test_protocol_orphan_close,"\n";
  CORE::print "protocol-test-owner-orphan-live\t",defined($test_protocol_orphan_live)?$test_protocol_orphan_live:'UNDEF',"\n";
 }
`);
function ownerProtocolRuntime(kind) {
 return String.raw`
 FORCING
 my $before=$test_protocol_native_snapshot->();my $target_before=$pm_loader_native_state->();
 CORE::print "protocol-native-before\t",CORE::join(',',@$before),"\n";CORE::print "protocol-target-before\t",CORE::join(',',@$target_before[0..2]),"\n";
 my $checked=eval {$pm_native_readback_recheck->();1;};my $error=$@;
 my $after=$test_protocol_native_snapshot->();my $target_after=$pm_loader_native_state->();
 CORE::print "protocol-native-after\t",CORE::join(',',@$after),"\n";CORE::print "protocol-target-after\t",CORE::join(',',@$target_after[0..2]),"\n";
 CORE::print "protocol-recheck\t",$checked?1:0,"\n";CORE::print "protocol-recheck-error\t",CORE::unpack('H*',$error),"\n";
 my $closed=eval {$pm_native_readback_release->();1;};my $close_error=$@;CORE::print "protocol-release\t",$closed?1:0,"\n";CORE::print "protocol-release-error\t",CORE::unpack('H*',$close_error),"\n";
 my $retry=eval {$pm_native_readback_recheck->();1;};my $retry_error=$@;CORE::print "protocol-recheck-repeat\t",$retry?1:0,"\n";CORE::print "protocol-recheck-repeat-error\t",CORE::unpack('H*',$retry_error),"\n";
 my $state=$pm_loader_native_state->();CORE::print "protocol-target\t",CORE::join(',',@$state[0..2]),"\n";
 $pm_native_test_probe->();CORE::exit(0);
 `.replace('FORCING',kind==='issuer-recheck-limit'?'$test_issuer_counter_force->();':'$test_target_counter_force->();');
}
function assertOwnerProtocol(o,s) {
 assert.equal(o['native-issue'],s.issue);assert.equal(o['native-actual-dispatches'],String(s.dispatches));assert.equal(o['native-known'],String(s.known));
 for(let index=0;index<s.known;index++) {
  assert.equal(o['cleanup:'+index+':close_return'],'31');assert.equal(o['cleanup:'+index+':close_error'],'');
  assert.equal(o['cleanup:'+index+':live_return'],'UNDEF');assert.equal(o['cleanup:'+index+':live_error'],'');
 }
 assert.equal(o['native-close-attempts'],String(s.known));assert.equal(o['native-live-attempts'],String(s.known));assert.equal(o['native-close-ok'],String(s.known));
 if(s.kind.endsWith('port-drift'))assert.equal(o['protocol-wrapper-calls'],'0');
 if(s.kind==='bridge-field-alias')assert.equal(o['protocol-genuine-delegates'],'2');
 if(s.kind==='issue-invalid-arity'){assert.equal(o['protocol-prior-arity'],'0');assert.equal(o['protocol-prior-snapshot'],'burned,0,0');assert.equal(Buffer.from(o['protocol-prior-error'],'hex').toString(),'TASK6A_NATIVE_PM_READBACK_REFUSED\n');}
 if(s.kind==='duplicate-raw-original'||s.kind==='duplicate-io-shape-model') {
  assert.match(o['protocol-genuine-orphan-handle-id'],/^[a-f0-9]+$/);assert.match(o['protocol-genuine-orphan-io-id'],/^[a-f0-9]+$/);
  assert.notEqual(o['protocol-genuine-orphan-handle-id'],o['raw-handle:0']);assert.notEqual(o['protocol-genuine-orphan-io-id'],o['raw-io:0']);
  assert.equal(o['protocol-genuine-orphan-handle-tag'],'GLOB');assert.ok(o['protocol-genuine-orphan-io-tag'].length>0);
  assert.equal(o['protocol-orphan-known'],'1');assert.equal(o['protocol-end-orphan-dispose'],'1');assert.equal(o['protocol-end-orphan-error'],'');
  assert.equal(o['protocol-wrapper-calls'],'1');assert.equal(o['protocol-genuine-orphan-return'],'1');assert.equal(o['protocol-genuine-orphan-error'],'');
  assert.equal(o['protocol-test-owner-orphan-close'],'1');assert.equal(o['protocol-test-owner-orphan-close-error'],'');assert.equal(o['protocol-test-owner-orphan-live-error'],'');assert.equal(o['protocol-test-owner-orphan-live'],'UNDEF');assert.equal(o['native-originals'],'2');assert.equal(o['native-fault-release'],'0');
 }
 if(s.issue==='1') {
  assert.equal(o['protocol-native-before'],s.kind==='issuer-recheck-limit'?'held,1,64':'held,1,0');assert.equal(o['protocol-native-after'],s.kind==='issuer-recheck-limit'?'burned,1,65':'burned,1,1');
  assert.match(o['protocol-target-before'],s.kind==='target-recheck-reserve'?/^installed,[0-9]+,63$/:/^installed,[0-9]+,1$/);assert.match(o['protocol-target-after'],s.kind==='target-recheck-reserve'?/^burned,[0-9]+,64$/:/^burned,[0-9]+,2$/);
  assert.equal(o['protocol-release-error'],'');assert.equal(Buffer.from(o['protocol-recheck-repeat-error'],'hex').toString(),'TASK6A_NATIVE_PM_READBACK_REFUSED\n');
  assert.equal(o['protocol-recheck'],'0');assert.equal(o['protocol-release'],'1');assert.equal(o['protocol-recheck-repeat'],'0');
  assert.equal(Buffer.from(o['protocol-recheck-error'],'hex').toString(),'TASK6A_NATIVE_PM_READBACK_REFUSED\n');
  assert.match(o['protocol-target'],s.kind==='target-recheck-reserve'?/^burned,[0-9]+,64$/:/^burned,[0-9]+,2$/);
 }
}
for(const scenario of ownerProtocolCases) {
 test('private native owner protocol boundary: '+scenario.kind,async t=>{
  const r=await invokeNative(scenario.kind,{mutate:ownerProtocolMutation(scenario.kind),earlyFailure:scenario.issue==='0'?ownerProtocolOutput:undefined,expectedStatus:scenario.expectedStatus,runtime:ownerProtocolRuntime(scenario.kind)});assertOwnerProtocol(r.observations,scenario);
  t.diagnostic(JSON.stringify({home:r.home,pid:r.pid,scope:'genuine originals plus memoryMODELEDport/alias/duplicate/counter fault; testownergenuineorphan cleanup only; noRoot/TCB'}));
 });
}
