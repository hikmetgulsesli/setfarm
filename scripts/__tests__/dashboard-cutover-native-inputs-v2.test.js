import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {createFinalizedFixture,file,git,hash,finalize} from './helpers/dashboard-cutover-finalized-fixture-v2.js';

const sourceRoot=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const modulePath=path.join(sourceRoot,'scripts/dashboard-cutover-native-inputs-v2.mjs');
const actualNode='/opt/homebrew/Cellar/node/26.4.0/bin/node';
const fixed={node:actualNode,clang:'/Library/Developer/CommandLineTools/usr/bin/clang',
  ld:'/Library/Developer/CommandLineTools/usr/bin/ld',nm:'/Library/Developer/CommandLineTools/usr/bin/llvm-nm',
  otool:'/Library/Developer/CommandLineTools/usr/bin/llvm-otool',
  headers:'/opt/homebrew/Cellar/node/26.4.0/include/node',
  sdk:'/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk',
  resource:'/Library/Developer/CommandLineTools/usr/lib/clang/21',clt:'/Library/Developer/CommandLineTools'};
const env={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};

function fixture(body,{setup='',before='',preimport='',actual=false,profile=true,deepProviders=false}={}) {
  assert.ok(fs.existsSync(modulePath),'missing nominated retained native-input holder');
  const original=fs.readFileSync(modulePath,'utf8');
  const {root,expected}=createFinalizedFixture({
    'scripts/dashboard-cutover-native-inputs-v2.mjs':original,
    'scripts/build-generation-retention.mjs':fs.readFileSync(path.join(sourceRoot,'scripts/build-generation-retention.mjs')),
    'scripts/dashboard-cutover-mach-peer-v2.c':fs.readFileSync(path.join(sourceRoot,'scripts/dashboard-cutover-mach-peer-v2.c'))});
  const providerRoot=root+'.providers';
  const providers=Object.fromEntries(Object.entries(fixed).map(([role,p])=>[role,actual?p:path.join(providerRoot,p.slice(1))]));
  if(deepProviders){
    assert.equal(actual,false);const suffix=Array(116).fill('d').join('/');
    const nodeRoot=path.join(providerRoot,'node',suffix),cltRoot=path.join(providerRoot,'clt',suffix);
    Object.assign(providers,{node:nodeRoot+'/bin/node',headers:nodeRoot+'/include/node',clt:cltRoot,
      clang:cltRoot+'/usr/bin/clang',ld:cltRoot+'/usr/bin/ld',nm:cltRoot+'/usr/bin/llvm-nm',
      otool:cltRoot+'/usr/bin/llvm-otool',sdk:cltRoot+'/SDKs/MacOSX26.5.sdk',resource:cltRoot+'/usr/lib/clang/21'});
  }
  const inputNames=['node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h'];
  const expectedFiles={};
  if(!actual) {
    for(const role of ['node','clang','ld','nm','otool']){
      const bytes=role==='clang'?Buffer.alloc(3*65536+17,0x5a):Buffer.from('direct '+role+'\n');
      file(providerRoot,path.relative(providerRoot,providers[role]),bytes,0o755);expectedFiles[role]={byteLength:bytes.length,sha256:hash(bytes)};
    }
    for(const name of inputNames){const bytes=Buffer.from('public '+name+'\n');
      file(providerRoot,path.relative(providerRoot,path.join(providers.headers,name)),bytes);expectedFiles[name]={byteLength:bytes.length,sha256:hash(bytes)};}
    for(const role of ['sdk','resource'])fs.mkdirSync(providers[role],{recursive:true,mode:0o700});
    let copy=original;
    for(const [role,p] of Object.entries(fixed))copy=copy.replaceAll("'"+p+"'","'"+providers[role]+"'");
    fs.writeFileSync(path.join(root,'scripts/dashboard-cutover-native-inputs-v2.mjs'),copy);
    git(root,['add','scripts/dashboard-cutover-native-inputs-v2.mjs']);git(root,['commit','-qm','relocate closed provider literals']);
    git(root,['update-ref','refs/remotes/origin/main','HEAD']);
    // Finalized output must bind the updated source, never relax the verifier.
    // Move the original fixture-only output aside visibly, outside new dist.
    fs.renameSync(path.join(root,'dist'),root+'.previous-dist');
    expected.sourceSha=git(root,['rev-parse','HEAD']);expected.sourceTreeHash=git(root,['rev-parse','HEAD^{tree}']);
    // Importing test utility again is harmless; this writes only this new fixture.
    // The utility is invoked here rather than any production build bypass.
  }
  return finishFixture(root,expected,expectedFiles,providers,{body,setup,before,preimport,actual,profile});
}

function finishFixture(root,expected,expectedFiles,providers,{body,setup,before,preimport,actual,profile}) {
  if(!actual)Object.assign(expected,finalize(root));
  const c=fs.readFileSync(path.join(root,'scripts/dashboard-cutover-mach-peer-v2.c'));
  expectedFiles.source={byteLength:c.length,sha256:hash(c)};
  const script=`import assert from 'node:assert/strict';import fs from 'node:fs';import cp from 'node:child_process';
    import {syncBuiltinESMExports} from 'node:module';
    const root=${JSON.stringify(root)},expected=${JSON.stringify(expected)},wantFiles=${JSON.stringify(expectedFiles)},
      providers=${JSON.stringify(providers)};
    const refused=fn=>assert.throws(fn,e=>e.message==='DASHBOARD_CUTOVER_NATIVE_INPUTS_REFUSED');
    ${!actual&&profile?`Object.defineProperties(process,{platform:{value:'darwin'},arch:{value:'arm64'},
      version:{value:'v26.4.0'},execPath:{value:providers.node}});`:''}
    const ports=[],writes=[],opens=[],closes=[],nativeCloses=[],direct=new Map(),live=new Set();
    const providerRoot=${JSON.stringify(providerRootFrom(providers,root))};
    const isProvider=p=>['node','clang','ld','nm','otool'].some(k=>providers[k]===p)||p.startsWith(providers.headers+'/');
    const open=fs.openSync,close=fs.closeSync,read=fs.readSync;
    fs.openSync=(p,...args)=>{ports.push('open');const fd=open(p,...args);opens.push({p:String(p),fd});direct.set(fd,String(p));live.add(fd);return fd};
    fs.closeSync=fd=>{ports.push('close');closes.push(fd);if(isProvider(direct.get(fd)??''))nativeCloses.push(fd);live.delete(fd);return close(fd)};
    for(const name of ['lstatSync','fstatSync','readSync','readFileSync','readlinkSync','readdirSync','realpathSync',
      'writeFileSync','mkdirSync','renameSync','chmodSync','unlinkSync','rmSync','rmdirSync']){
      const original=fs[name];fs[name]=(...a)=>{ports.push(name);if(['writeFileSync','mkdirSync','renameSync','chmodSync',
        'unlinkSync','rmSync','rmdirSync'].includes(name))writes.push(name);return original(...a)};
    }
    const spawnSync=cp.spawnSync;cp.spawnSync=(...a)=>{ports.push('spawnSync');return spawnSync(...a)};
    const spawn=cp.spawn;cp.spawn=(...a)=>{ports.push('spawn');return spawn(...a)};
    ${setup}
    ${preimport}
    syncBuiltinESMExports();const mod=await import('./scripts/dashboard-cutover-native-inputs-v2.mjs');
    assert.deepEqual(Object.keys(mod),['holdDashboardCutoverNativeInputsV2']);
    const hold=mod.holdDashboardCutoverNativeInputsV2;
    ${before}
    ${body}
    console.log(JSON.stringify({kind:'native-inputs-case-receipt',root,openCount:opens.length,closeCount:closes.length}));`;
  const r=spawnSync(actual?actualNode:process.execPath,['--input-type=module','-e',script],{cwd:root,env,encoding:'utf8',maxBuffer:1024*1024});
  fs.writeFileSync(root+'.result.json',JSON.stringify({root,providers,expected,actual,script,
    sourceHash:hash(fs.readFileSync(modulePath)),status:r.status,signal:r.signal,error:r.error?.message??null,
    stdout:r.stdout,stderr:r.stderr}),{flag:'wx',mode:0o600});
  assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,0,r.stderr+r.stdout);
  console.log(r.stdout.trim());return {root,result:r};
}

function providerRootFrom(providers,root){return providers.node.startsWith(root+'.providers/')?root+'.providers':null}

test('direct inputs retain genuine own source/build and independently hashed original files across await',async()=>{
  fixture(`const ctx=hold();assert.ok(Object.isFrozen(ctx));assert.ok(Object.isFrozen(ctx.observation));
    const o=ctx.observation;assert.equal(o.authority,'direct-inputs-only');assert.equal(o.files.length,10);
    assert.equal(o.sourceBuild.checkoutSource.sha,expected.sourceSha);assert.equal(o.sourceBuild.buildSource.buildHash,expected.buildHash);
    for(const item of o.files){assert.ok(Object.isFrozen(item));assert.equal(item.sha256,wantFiles[item.role].sha256);
      assert.equal(item.byteLength,wantFiles[item.role].byteLength)}
    assert.equal(nativeCloses.length,0);assert.ok(live.size>10);assert.equal(writes.length,0);
    await Promise.resolve();ctx.recheck();assert.equal(nativeCloses.length,0);assert.equal(writes.length,0);
    ctx.close();assert.equal(live.size,0);assert.equal(closes.length,opens.length);const n=closes.length;ctx.close();assert.equal(closes.length,n);
    const p=ports.length;refused(()=>ctx.recheck());refused(()=>hold());assert.equal(ports.length,p);`);
});

test('invalid arity and proxied arguments have zero ports and do not burn a valid first acquisition',()=>{
  fixture(`let traps=0;const p=new Proxy({},{get(){traps++;throw Error('secret')}});const n=ports.length;
    refused(()=>hold(undefined));refused(()=>hold(p));assert.equal(traps,0);assert.equal(ports.length,n);
    const ctx=hold();ctx.recheck();ctx.close();`);
});

test('wrong runtime profile refuses before source proof or file ports',()=>{
  fixture(`const n=ports.length;refused(()=>hold());assert.equal(ports.length,n);`,{profile:false});
});

test('cwd and environment do not select native providers or checkout',()=>{
  fixture(`const ctx=hold();assert.equal(ctx.observation.sourceBuild.checkoutSource.sha,expected.sourceSha);
    assert.equal(ctx.observation.files.find(f=>f.role==='clang').locator,providers.clang);ctx.close();`,{
    preimport:`process.chdir('/');process.env.CC='/invalid/secret';process.env.SDKROOT='/invalid';
      process.env.SETFARM_DIR='/invalid';process.env.NODE_PATH='/invalid';`});
});

test('compiler original is streamed in bounded positional blocks without whole-file reads',()=>{
  fixture(`const ctx=hold();assert.ok(blocks.length>=4);assert.ok(blocks.every(b=>b.length<=65536));
    assert.deepEqual(blocks.slice(0,4).map(b=>b.position),[0,65536,131072,196608]);ctx.recheck();ctx.close();`,{
    setup:`const blocks=[];const readFile=fs.readFileSync;fs.readFileSync=(p,...a)=>{
      if(p===providers.clang)throw Error('whole compiler read');return readFile(p,...a)};
      fs.readSync=(fd,b,o,l,p)=>{if(direct.get(fd)===providers.clang)blocks.push({length:l,position:p});return read(fd,b,o,l,p)};`});
});

for(const kind of ['symlink','hardlink','writable','empty','directory'])test('direct provider '+kind+' refuses without cleanup or reacquisition',()=>{
  fixture(`refused(()=>hold());assert.equal(nativeCloses.length,0);
    const count=ports.length;refused(()=>hold());assert.equal(ports.length,count);`,{
    before:`const p=providers.clang;
      ${kind==='symlink'?`fs.renameSync(p,p+'.original');fs.symlinkSync(p+'.original',p);`:''}
      ${kind==='hardlink'?`fs.linkSync(p,p+'.alias');`:''}
      ${kind==='writable'?`fs.chmodSync(p,0o777);`:''}
      ${kind==='empty'?`fs.truncateSync(p,0);`:''}
      ${kind==='directory'?`fs.renameSync(p,p+'.original');fs.mkdirSync(p);`:''}
      closes.length=0;nativeCloses.length=0;ports.length=0;`});
});

for(const kind of ['dirty','branch','stale'])test('unqualified own '+kind+' refuses before any direct provider open',()=>{
  fixture(`refused(()=>hold());assert.equal(opens.some(x=>x.p===providers.clang),false);`,{
    before:kind==='dirty'?`fs.appendFileSync(root+'/scripts/dashboard-cutover-mach-peer-v2.c','changed');`:
      kind==='branch'?`cp.execFileSync('/usr/bin/git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',
        'switch','-qc','fixture-wrong'],{cwd:root,env:{PATH:'/usr/bin:/bin',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}});`:
      `const p=root+'/dist/BUILD_INFO.json';fs.chmodSync(p,0o644);const v=JSON.parse(fs.readFileSync(p));v.sha='1'.repeat(40);fs.writeFileSync(p,JSON.stringify(v));fs.chmodSync(p,0o444);`});
});

test('partial direct-provider read permanently refuses and retains original extra descriptors',()=>{
  fixture(`refused(()=>hold());assert.equal(nativeCloses.length,0);const n=ports.length;refused(()=>hold());assert.equal(ports.length,n);`,{
    setup:`fs.readSync=(fd,b,o,l,p)=>direct.get(fd)===providers.clang?0:read(fd,b,o,l,p);`});
});

for(const target of ['file','ancestor'])test('held direct '+target+' replacement and ABA burn original custody across await',()=>{
  fixture(`const ctx=hold();await Promise.resolve();const p=${target==='file'?'providers.clang':`providers.resource`};
    fs.renameSync(p,p+'.original');${target==='file'?`fs.writeFileSync(p,'other',{mode:0o755});fs.renameSync(p,p+'.other');`:
      `fs.mkdirSync(p,{mode:0o700});fs.renameSync(p,p+'.other');`}fs.renameSync(p+'.original',p);
    const n=nativeCloses.length;refused(()=>ctx.recheck());assert.equal(nativeCloses.length,n);
    const portsBefore=ports.length;refused(()=>ctx.recheck());assert.equal(ports.length,portsBefore);ctx.close();`);
});

test('in-place provider content drift is sticky even after byte restoration',()=>{
  fixture(`const ctx=hold(),p=providers.clang,b=fs.readFileSync(p);fs.writeFileSync(p,Buffer.alloc(b.length,1));
    refused(()=>ctx.recheck());fs.writeFileSync(p,b);refused(()=>ctx.recheck());ctx.close();`);
});

test('swallowed acquisition reentry burns before another provider operation and retains originals',()=>{
  fixture(`refused(()=>hold());assert.equal(nested,1);assert.equal(nativeCloses.length,0);
    assert.equal(opens.filter(x=>x.p===providers.clang).length,1);`,{
    setup:`let nested=0;fs.openSync=(p,...a)=>{const fd=open(p,...a);opens.push({p:String(p),fd});direct.set(fd,String(p));live.add(fd);
      if(p===providers.clang){nested++;refused(()=>hold())}return fd};`});
});

test('swallowed active close reentry admits no close ports until actual recheck unwinds',()=>{
  fixture(`const ctx=hold();armed=true;refused(()=>ctx.recheck());assert.equal(nested,1);assert.equal(nativeCloses.length,0);
    ctx.close();assert.equal(closes.length,opens.length);`,{
    setup:`let armed=false,nested=0;fs.readSync=(fd,b,o,l,p)=>{const n=read(fd,b,o,l,p);
      if(armed&&direct.get(fd)===providers.clang){armed=false;nested++;refused(()=>ctx.close())}return n};`});
});

test('idle method arity has zero ports and preserves a healthy original context',()=>{
  fixture(`const ctx=hold(),n=ports.length;refused(()=>ctx.recheck(undefined));refused(()=>ctx.close(undefined));
    assert.equal(ports.length,n);ctx.recheck();ctx.close();`);
});

test('unknown original close stops later disposal and never closes its reused descriptor',()=>{
  fixture(`const ctx=hold();const row=opens.findLast(x=>x.p===providers.headers+'/js_native_api_types.h');closes.length=0;
    let replacement,n=0;fs.closeSync=fd=>{closes.push(fd);if(fd===row.fd){n++;close(fd);replacement=open(providers.node,'r');
      assert.equal(replacement,fd);throw Error('unknown close')}return close(fd)};
    syncBuiltinESMExports();refused(()=>ctx.close());assert.equal(n,1);assert.equal(closes.length,1);
    ctx.close();assert.equal(n,1);assert.equal(closes.length,1);fs.fstatSync(replacement);refused(()=>ctx.recheck());close(replacement);`);
});

test('new swallowed close reentry stops remaining originals even when custody was already burned',()=>{
  fixture(`const ctx=hold();const p=providers.clang;fs.writeFileSync(p,'changed');refused(()=>ctx.recheck());
    closes.length=0;let nested=0;fs.closeSync=fd=>{closes.push(fd);close(fd);if(nested===0){nested++;refused(()=>ctx.close())}};
    syncBuiltinESMExports();let failure;try{ctx.close()}catch(e){failure=e}
    assert.equal(nested,1);assert.equal(closes.length,1);assert.equal(failure?.message,'DASHBOARD_CUTOVER_NATIVE_INPUTS_REFUSED');
    ctx.close();assert.equal(closes.length,1);`);
});

for(const leaf of ['SDKs','usr/lib'])test('protected CLT '+leaf+' intermediate ancestor rejects writable mode outside own checkout',()=>{
  fixture(`refused(()=>hold());assert.equal(nativeCloses.length,0);`,{
    before:`fs.chmodSync(providers.clt+'/'+${JSON.stringify(leaf)},0o777);`});
});

test('externally consumed original FD is not disposed again after numeric reuse and burnt recheck',()=>{
  fixture(`const ctx=hold(),row=opens.findLast(x=>x.p===providers.headers+'/js_native_api_types.h');
    close(row.fd);const replacement=open(providers.node,'r');assert.equal(replacement,row.fd);
    refused(()=>ctx.recheck());closes.length=0;let failure;try{ctx.close()}catch(e){failure=e}
    assert.equal(closes.length,0);assert.equal(failure?.message,'DASHBOARD_CUTOVER_NATIVE_INPUTS_REFUSED');
    fs.fstatSync(replacement);ctx.close();assert.equal(closes.length,0);close(replacement);`);
});

test('compiler above the nominated 512MiB cap is refused before original file acquisition',()=>{
  fixture(`refused(()=>hold());assert.equal(opens.some(x=>x.p===providers.clang),false);
    assert.equal(nativeCloses.length,0);`,{setup:`const stat=fs.lstatSync;
    fs.lstatSync=(p,...a)=>{const s=stat(p,...a);if(p===providers.clang)s.size=536870913n;return s};`});
});

test('aggregate cap counts an exactly 512MiB first provider before refusing crossed second acquisition',()=>{
  // Closed FS size/read fault ports avoid a GiB artifact; real holder/cap/hash
  // loop runs, owns real original FDs, and checks both real original paths.
  fixture(`refused(()=>hold());assert.equal(nodeBytes,536870912);assert.equal(nodeReads,8192);
    assert.equal(opens.filter(x=>x.p===providers.node).length,1);
    assert.equal(opens.some(x=>x.p===providers.clang),false);assert.equal(nativeCloses.length,0);`,{
    setup:`let nodeBytes=0,nodeReads=0;const stat=fs.lstatSync,fstat=fs.fstatSync;
      const sized=(p,s)=>{if(p===providers.node||p===providers.clang)s.size=536870912n;return s};
      fs.lstatSync=(p,...a)=>sized(p,stat(p,...a));fs.fstatSync=(fd,...a)=>sized(direct.get(fd),fstat(fd,...a));
      fs.readSync=(fd,b,o,l,p)=>{if(direct.get(fd)===providers.node){b.fill(0,o,o+l);nodeBytes+=l;nodeReads++;return l}
        return read(fd,b,o,l,p)};`});
});

test('extra descriptor budget refuses the 257th opening without closing retained originals',()=>{
  fixture(`const n=opens.length;refused(()=>hold());const admitted=opens.slice(n);
    const providerPins=admitted.filter(x=>x.p.startsWith(providerRoot+'/'));
    // Five own source ancestors + original C + sibling provider root = seven
    // extra pins outside this filter; 256 - 7 = 249 admitted provider pins.
    assert.ok(providerPins.length>200);assert.equal(providerPins.length,249);
    assert.equal(nativeCloses.length,0);const count=ports.length;refused(()=>hold());assert.equal(ports.length,count);`,{
    deepProviders:true});
});

test('actual fixed Darwin profile retains and streams real direct inputs without compiler or native invocation',{
  skip:process.env.SETFARM_DASHBOARD_NATIVE_INPUTS_TEST!=='1'},()=>{
  fixture(`const actualSpawnSync=cp.spawnSync;cp.spawn=()=>{throw Error('FORBIDDEN_COMPILER')};
    cp.spawnSync=(command,...a)=>{assert.equal(command,'/usr/bin/git');return actualSpawnSync(command,...a)};
    syncBuiltinESMExports();const ctx=hold();assert.equal(ctx.observation.authority,'direct-inputs-only');
    assert.equal(ctx.observation.files.length,10);assert.ok(ctx.observation.files.find(f=>f.role==='clang').byteLength>250000000);
    const n=nativeCloses.length;await Promise.resolve();ctx.recheck();assert.equal(nativeCloses.length,n);ctx.close();
    assert.equal(closes.length,opens.length);console.log(JSON.stringify({kind:'actual-native-direct-inputs',observation:ctx.observation}));`,{actual:true});
});
