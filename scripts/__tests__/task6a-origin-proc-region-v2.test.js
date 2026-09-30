import assert from 'node:assert/strict';
import {existsSync,readFileSync,lstatSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const HELPER=new URL('../task6a-origin-proc-region-v2.pm',import.meta.url);
const ordinary=()=>process.platform==='darwin'&&typeof process.getuid==='function'
  &&typeof process.geteuid==='function'&&process.getuid()!==0&&process.geteuid()!==0
  &&process.getuid()===process.geteuid();
const CAP=281474976710656n;
function fixture(){
  const b=Buffer.alloc(96);
  [3,7,2,0].forEach((v,i)=>b.writeUInt32LE(v,i*4));
  b.writeBigUInt64LE(0xfedcba9876543210n,16);
  [11,12,13,14,15,16,17,18,19,2,21,22,23,0].forEach((v,i)=>b.writeUInt32LE(v,24+i*4));
  b.writeBigUInt64LE(0x100000000n,80);b.writeBigUInt64LE(0x4000n,88);return b;
}
function invoke(raw,query='0',{source,expression}={}){
  assert.ok(ordinary(),'ordinary macOS required');
  assert.ok(existsSync(HELPER),'raw region decoder implementation missing');
  const st=lstatSync('/usr/bin/perl');assert.ok(st.isFile()&&!st.isSymbolicLink());
  assert.equal(st.uid,0);assert.equal(st.gid,0);assert.equal(st.nlink,1);
  const load=source===undefined?'require $ARGV[0];':'use MIME::Base64 ();eval MIME::Base64::decode_base64($ARGV[0]);die $@ if $@;';
  const program='BEGIN{@INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34");}use strict;use warnings;use JSON::PP ();'+load+'binmode STDIN;local $/;my $raw=<STDIN>;my $query=$ARGV[1];print JSON::PP->new->canonical->encode('+ (expression??'Task6aOriginProcRegionV2::decode_region_v2($raw,$query)')+');';
  const r=spawnSync('/usr/bin/perl',['-f','-e',program,source===undefined?fileURLToPath(HELPER):Buffer.from(source).toString('base64'),String(query)],{input:raw,cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:5000,maxBuffer:65536});
  assert.equal(r.error,undefined);assert.equal(r.signal,null);return r;
}
function accepted(raw=fixture(),query='0',options){
  const r=invoke(raw,query,options);assert.equal(r.status,0,r.stderr.toString());assert.equal(r.stderr.length,0);
  return JSON.parse(r.stdout.toString());
}
function denied(raw=fixture(),query='0',options){
  const r=invoke(raw,query,options);assert.notEqual(r.status,0,'unsafe raw region unexpectedly accepted');
  assert.equal(r.stdout.length,0);assert.match(r.stderr.toString(),/^TASK6A_ORIGIN_PROC_REGION_REFUSED\n$/);
}
if(ordinary()&&process.env.TASK6A_REGION_TEST_HOST_PROBE!=='1'){
  for(const [name,platform,ruid,euid] of [['non-macOS','linux',501,501],['real root','darwin',0,501],['effective root','darwin',501,0]])
    test(`raw region default graph refuses ${name} before external execution`,()=>{
      const program=`import c from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';Object.defineProperty(process,'platform',{value:${JSON.stringify(platform)}});process.getuid=()=>${ruid};process.geteuid=()=>${euid};c.spawnSync=()=>{process.stdout.write('FORBIDDEN_CHILD\\n');throw Error('external child');};syncBuiltinESMExports();await import(${JSON.stringify(import.meta.url)});`;
      const r=spawnSync(process.execPath,['--input-type=module','-e',program],{cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TASK6A_REGION_TEST_HOST_PROBE:'1'},timeout:5000,encoding:'utf8'});
      assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.stdout,/FORBIDDEN_CHILD/);assert.match(r.stdout,/(?:ℹ|#) skipped 1\b/);
    });
}
if(!ordinary())test('raw region native ABI coverage unavailable on unsupported or root host',{skip:true},()=>{});
else{
  test('raw region decoder preserves every native ABI field without granting origin',()=>{
    assert.deepEqual(accepted(),{
      scope:'proc-region-abi-diagnostic-only',completeNativeClosure:false,productionAuthority:false,
      protection:3,maximumProtection:7,inheritance:2,flags:0,offsetHex:'fedcba9876543210',
      behavior:11,userWiredCount:12,userTag:13,pagesResident:14,pagesSharedNowPrivate:15,
      pagesSwappedOut:16,pagesDirtied:17,referenceCount:18,shadowDepth:19,shareMode:2,
      privatePagesResident:21,sharedPagesResident:22,objectId:23,depth:0,
      address:4294967296,size:16384,end:4294983680,submap:false,shared:false,
      currentExecutable:false,potentialExecutable:true,
    });
  });
  for(const [name,offset,value] of [['unknown current bit',0,8],['unknown max bit',4,8],['current beyond maximum',4,1],['unknown flags',12,4],['nonzero depth',76,1],['synthetic ledger tag',32,0xffffffff],['unknown share mode',60,9]])
    test(`raw region decoder refuses ${name}`,()=>{const b=fixture();b.writeUInt32LE(value,offset);denied(b);});
  for(const [name,b] of [['short',fixture().subarray(0,95)],['suffix',Buffer.concat([fixture(),Buffer.from([0])])],['empty',Buffer.alloc(0)]])
    test(`raw region decoder refuses ${name} bytes`,()=>denied(b));
  for(const query of ['-1','00','1.0','1e4',' 0','0\n','281474976710656','18446744073709551615'])
    test(`raw region decoder refuses noncanonical query ${JSON.stringify(query)}`,()=>denied(fixture(),query));
  for(const [name,address,size,query] of [
    ['zero size',0n,0n,'0'],['address above bound',CAP,1n,'0'],['size above bound',0n,CAP+1n,'0'],
    ['end above bound',CAP-1n,2n,'0'],['u64 sum overflow',0xffffffffffffffffn,1n,'0'],
    ['nonprogress at end',0x100000000n,0x4000n,'4294983680'],['backtracked end',0x100000000n,0x4000n,'4294983681'],
  ])test(`raw region decoder refuses ${name}`,()=>{const b=fixture();b.writeBigUInt64LE(address,80);b.writeBigUInt64LE(size,88);denied(b,query);});
  for(const [name,expression] of [
    ['missing query','Task6aOriginProcRegionV2::decode_region_v2($raw)'],
    ['extra argument','Task6aOriginProcRegionV2::decode_region_v2($raw,$query,0)'],
    ['raw reference','Task6aOriginProcRegionV2::decode_region_v2([],0)'],
    ['query reference','Task6aOriginProcRegionV2::decode_region_v2($raw,[])'],
    ['undefined raw','Task6aOriginProcRegionV2::decode_region_v2(undef,0)'],
    ['undefined query','Task6aOriginProcRegionV2::decode_region_v2($raw,undef)'],
    ['UTF8 scalar','do {utf8::upgrade($raw);Task6aOriginProcRegionV2::decode_region_v2($raw,0)}'],
  ])test(`raw region decoder refuses ${name}`,()=>denied(fixture(),'0',{expression}));
  for(const [current,max,currentX,potentialX] of [[0,0,false,false],[1,1,false,false],[3,3,false,false],[4,4,true,true],[0,4,false,true],[5,7,true,true],[3,7,false,true],[7,7,true,true]])
    test(`raw region preserves current/max ${current}/${max} executable distinction`,()=>{const b=fixture();b.writeUInt32LE(current,0);b.writeUInt32LE(max,4);const r=accepted(b);assert.equal(r.currentExecutable,currentX);assert.equal(r.potentialExecutable,potentialX);assert.equal(r.productionAuthority,false);});
  for(const flags of [0,1,2,3])test(`raw region keeps flags ${flags} visible without leaf admission`,()=>{const b=fixture();b.writeUInt32LE(flags,12);const r=accepted(b);assert.equal(r.flags,flags);assert.equal(r.submap,(flags&1)!==0);assert.equal(r.shared,(flags&2)!==0);assert.equal(r.completeNativeClosure,false);});
  for(const mode of [0,1,2,3,4,5,6,7,8])test(`raw region preserves share mode ${mode} without origin exemption`,()=>{const b=fixture();b.writeUInt32LE(mode,60);const r=accepted(b);assert.equal(r.shareMode,mode);assert.equal(r.potentialExecutable,true);});
  test('raw region permits containing query and a next region after a gap',()=>{assert.equal(accepted(fixture(),'4294967297').address,4294967296);assert.equal(accepted(fixture(),'0').end,4294983680);});
  test('raw region keeps exact admitted exclusive address boundary',()=>{const b=fixture();b.writeBigUInt64LE(CAP-1n,80);b.writeBigUInt64LE(1n,88);const r=accepted(b,String(CAP-1n));assert.equal(r.end,281474976710656);assert.equal(r.size,1);});
  test('raw region retains unsigned full-width offset without rounding',()=>{const b=fixture();b.writeBigUInt64LE(0xffffffffffffffffn,16);assert.equal(accepted(b).offsetHex,'ffffffffffffffff');});
  test('raw region refusal consumers detect missing length permission and end guards',()=>{
    const source=readFileSync(HELPER,'utf8');
    for(const [from,to,raw,query] of [
      ['||length($raw)!=96','',Buffer.concat([fixture(),Buffer.from([0])]),'0'],
      ['$head[0]>7||$head[1]>7||($head[0]&$head[1])!=$head[0]','0',(()=>{const b=fixture();b.writeUInt32LE(1,4);return b;})(),'0'],
      ['$end>281474976710656||$end<=$query','0',(()=>{const b=fixture();b.writeBigUInt64LE(CAP-1n,80);b.writeBigUInt64LE(2n,88);return b;})(),'0'],
    ]){
      denied(raw,query);
      assert.equal(source.split(from).length,2,'in-memory mutant must alter exactly one guard');
      const r=invoke(raw,query,{source:source.replace(from,to)});
      assert.equal(r.status,0,r.stderr.toString());assert.equal(r.stderr.length,0);
      assert.equal(JSON.parse(r.stdout.toString()).productionAuthority,false);
      assert.throws(()=>denied(raw,query,{source:source.replace(from,to)}),/unsafe raw region unexpectedly accepted/);
    }
  });
  test('default npm graph dispatches a real raw region pure leaf without native calls',()=>{
    const root=new URL('../../',import.meta.url),pkg=JSON.parse(readFileSync(new URL('package.json',root),'utf8'));
    const target='scripts/__tests__/task6a-origin-proc-region-v2.test.js';
    function selected(scripts){
      const pending=['test'],seen=new Set(),selectors=[];
      while(pending.length){const name=pending.pop();if(seen.has(name))continue;seen.add(name);
        const cmd=scripts[name];assert.equal(typeof cmd,'string');
        for(const m of cmd.matchAll(/\bnpm run ([a-zA-Z0-9:_-]+)/g))pending.push(m[1]);
        if(/\bnode\b[^&]*--test\b/.test(cmd))for(const m of cmd.matchAll(/(?:tests|scripts)\/[a-zA-Z0-9_./*-]+\.test\.(?:js|ts)/g))selectors.push(m[0]);
      }
      assert.ok(selectors.some(x=>new RegExp('^'+x.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'[^/]*')+'$').test(target)),
        'default graph omitted raw region pure suite');
    }
    selected(pkg.scripts);
    assert.throws(()=>selected({...pkg.scripts,'test:scripts':'node --test scripts/elsewhere/*.test.js'}),/omitted raw region/);
    const r=spawnSync(process.execPath,['--test','--test-name-pattern=^raw region decoder preserves every native ABI field',target],{cwd:root,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:5000,maxBuffer:65536,encoding:'utf8'});
    assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,0,r.stdout+r.stderr);
    assert.match(r.stdout,/(?:ℹ|#) pass 1\b/);assert.match(r.stdout,/(?:ℹ|#) skipped 0\b/);
  });
}
