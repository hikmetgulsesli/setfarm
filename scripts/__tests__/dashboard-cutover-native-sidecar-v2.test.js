import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {createFinalizedFixture,file,git,hash,finalize} from './helpers/dashboard-cutover-finalized-fixture-v2.js';

const sourceRoot=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const target=sourceRoot+'/scripts/dashboard-cutover-native-sidecar-v2.mjs';
const fixed={node:'/opt/homebrew/Cellar/node/26.4.0/bin/node',
  clang:'/Library/Developer/CommandLineTools/usr/bin/clang',ld:'/Library/Developer/CommandLineTools/usr/bin/ld',
  nm:'/Library/Developer/CommandLineTools/usr/bin/llvm-nm',otool:'/Library/Developer/CommandLineTools/usr/bin/llvm-otool',
  headers:'/opt/homebrew/Cellar/node/26.4.0/include/node',sdk:'/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk',
  resource:'/Library/Developer/CommandLineTools/usr/lib/clang/21',clt:'/Library/Developer/CommandLineTools'};
const env={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};

// Each case exercises real source/Git/header custody; external async commands
// and optional native loader/cache/exports are inert doubles. Never remove roots.
function fixture(body,{setup='',before='',preimport='',profile=true,sdkDepth=0,actual=false,protocol=2,crossedSource=false,alternateSource=false,loader=false}={}){
  assert.ok(fs.existsSync(target),'missing nominated native sidecar builder');
  const names=['dashboard-cutover-native-sidecar-v2.mjs','dashboard-cutover-native-build-inputs-v2.mjs',
    'dashboard-cutover-native-inputs-v2.mjs','build-generation-retention.mjs','dashboard-cutover-mach-peer-v2.c','dashboard-cutover-mach-job-peer-v4.c'];
  const files=Object.fromEntries(names.map(n=>['scripts/'+n,fs.readFileSync(sourceRoot+'/scripts/'+n)]));
  if(alternateSource)files['scripts/dashboard-cutover-mach-job-peer-v4-alternate.c']=files['scripts/dashboard-cutover-mach-job-peer-v4.c'];
  const created=createFinalizedFixture(files),{root}=created,providerRoot=root+'.sidecar-providers';
  const providers=Object.fromEntries(Object.entries(fixed).map(([k,p])=>[k,actual?p:providerRoot+p]));
  if(!actual){
  if(sdkDepth)providers.sdk=providers.clt+'/SDKs/'+Array(sdkDepth).fill('d').join('/')+'/MacOSX26.5.sdk';
  for(const key of ['node','clang','ld','nm','otool'])file(providerRoot,path.relative(providerRoot,providers[key]),'provider '+key+'\n',0o755);
  for(const n of ['node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h'])file(providerRoot,
    path.relative(providerRoot,providers.headers+'/'+n),'public '+n+'\n');
  for(const [p,b] of [[providers.resource+'/include/stdint.h','resource\n'],
    [providers.sdk+'/usr/include/bootstrap.h','bootstrap\n']])file(providerRoot,path.relative(providerRoot,p),b);
  fs.mkdirSync(providers.sdk+'/usr/include/servers',{mode:0o700});
  fs.symlinkSync('../bootstrap.h',providers.sdk+'/usr/include/servers/bootstrap.h');
  fs.mkdirSync(providers.sdk+'/System/Library/Frameworks',{recursive:true,mode:0o700});
  for(const p of [providers.clt+'/usr/lib/libtapi.dylib',providers.clt+'/usr/lib/libcodedirectory.dylib',
    providers.clt+'/usr/lib/libLTO.dylib',providers.clt+'/usr/lib/libswiftDemangle.dylib',
    providers.sdk+'/usr/lib/libSystem.B.tbd',providers.sdk+'/usr/lib/libbsm.0.tbd'])
    file(providerRoot,path.relative(providerRoot,p),'physical '+path.basename(p)+'\n');
  for(const n of names.filter(n=>n.startsWith('dashboard-cutover-native-'))){
    let text=files['scripts/'+n].toString();
    for(const [k,p] of Object.entries(fixed))text=text.replaceAll("'"+p+"'","'"+providers[k]+"'");
    if(crossedSource&&n==='dashboard-cutover-native-sidecar-v2.mjs'){
      const from='prepare:()=>buildInputs.prepareDashboardCutoverNativeBuildInputsV4()';
      assert.equal(text.split(from).length,2);text=text.replace(from,'prepare:()=>buildInputs.prepareDashboardCutoverNativeBuildInputsV2()');
    }
    if(alternateSource&&n==='dashboard-cutover-native-sidecar-v2.mjs'){
      const from="'/scripts/dashboard-cutover-mach-job-peer-v4.c'";
      assert.equal(text.split(from).length,2);text=text.replace(from,"'/scripts/dashboard-cutover-mach-job-peer-v4-alternate.c'");
    }
    fs.writeFileSync(root+'/scripts/'+n,text);
  }
  git(root,['add','scripts']);git(root,['commit','-qm','relocate closed sidecar providers']);
  git(root,['update-ref','refs/remotes/origin/main','HEAD']);fs.renameSync(root+'/dist',root+'.previous-dist');
  }
  const selectedSource=root+'/scripts/'+(protocol===4?'dashboard-cutover-mach-job-peer-v4.c':'dashboard-cutover-mach-peer-v2.c');
  const expected=actual?created.expected:finalize(root),source=fs.readFileSync(selectedSource);
  const script=`import assert from 'node:assert/strict';import fs from 'node:fs';import cp from 'node:child_process';
    import {syncBuiltinESMExports} from 'node:module';import {EventEmitter} from 'node:events';
    import {PassThrough} from 'node:stream';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
    const root=${JSON.stringify(root)},providers=${JSON.stringify(providers)},expected=${JSON.stringify(expected)},
      sourceHash=${JSON.stringify(hash(source))},sourceLength=${source.length},selectedSource=${JSON.stringify(selectedSource)};
    const digest=b=>createHash('sha256').update(b).digest('hex');
    const refused=fn=>assert.throws(fn,e=>e.message==='DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED');
    const rejected=fn=>assert.rejects(fn,e=>e.message==='DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED');
    ${profile&&!actual?`Object.defineProperties(process,{platform:{value:'darwin'},arch:{value:'arm64'},version:{value:'v26.4.0'},execPath:{value:providers.node}});`:''}
    const open=fs.openSync,close=fs.closeSync,write=fs.writeSync,read=fs.readSync,nativeReceiptFsync=fs.fsyncSync;
    const ports=[],effects=[],opens=[],closes=[],fdPaths=new Map(),commands=[],children=[],
      sidecarOriginalFds=new Set(),sidecarOriginalDisposals=[];
    const isSidecarOriginal=()=>Error().stack.split('\\n').some(line=>
      /at (openOriginal|publishManifest) /.test(line)&&line.includes('dashboard-cutover-native-sidecar-v2.mjs'));
    fs.openSync=(p,...a)=>{ports.push('open');const owned=isSidecarOriginal(),fd=open(p,...a);
      opens.push({p:String(p),fd,flags:a[0],sidecarOriginal:owned});fdPaths.set(fd,String(p));
      if(owned)sidecarOriginalFds.add(fd);return fd};
    fs.closeSync=fd=>{ports.push('close');closes.push(fd);
      if(sidecarOriginalFds.has(fd))sidecarOriginalDisposals.push(fd);return close(fd)};
    for(const n of ['lstatSync','fstatSync','readSync','readFileSync','readlinkSync','readdirSync','realpathSync']){
      const f=fs[n];fs[n]=(...a)=>{ports.push(n);return f(...a)};}
    for(const n of ['mkdirSync','writeSync','writeFileSync','fchmodSync','fsyncSync','renameSync','chmodSync','rmSync','unlinkSync','rmdirSync']){
      const f=fs[n];fs[n]=(...a)=>{ports.push(n);effects.push({n,args:a});return f(...a)};}
    const generation=root+'/.setfarm/dashboard-cutover-native-v${protocol}/'+expected.sourceSha+'.'+expected.buildHash;
    const headerPaths=[providers.headers+'/node_api.h',providers.resource+'/include/stdint.h',
      providers.sdk+'/usr/include/servers/bootstrap.h'];
    const deps=()=> 'setfarm-cutover-inputs: - '+headerPaths.join(' ')+'\\n';
    const napi=['create_buffer_copy','define_properties','create_object','create_uint32','get_cb_info',
      'get_typedarray_info','is_typedarray','is_arraybuffer','is_detached_arraybuffer','object_freeze',
      'throw_error','is_exception_pending','get_and_clear_last_exception'];
    const imports=napi.map(n=>'_napi_'+n).concat(['_mach_msg','_audit_token_to_pid','_bootstrap_port']);
    const exports=['_napi_register_module_v1','_node_api_module_get_api_version_v1'];
    function mach(){const b=Buffer.alloc(40);b.writeUInt32LE(0xfeedfacf,0);b.writeUInt32LE(0x0100000c,4);
      b.writeUInt32LE(0,8);b.writeUInt32LE(8,12);b.writeUInt32LE(1,16);b.writeUInt32LE(8,20);
      b.writeUInt32LE(0x1b,32);b.writeUInt32LE(8,36);return b}
    let bundle=mach(),compileGraph=deps,importText=()=>imports.join('\\n')+'\\n',
      exportText=()=>exports.map((n,i)=>'000000000000'+i+'000 T '+n).join('\\n')+'\\n',
      dylibText=()=>generation+'/peer.node:\\n\\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1351.0.0)\\n'+
        '\\t/usr/lib/libbsm.0.dylib (compatibility version 1.0.0, current version 1.0.0)\\n';
    let outcome=()=>({code:0,signal:null,stderr:''}),onSpawn=()=>{},onFinish=()=>{};
    const nativeSpawn=cp.spawn;
    cp.spawn=(command,args,options)=>{
      const row={command,args,options,source:[],stdout:[],stderr:[],stdoutLength:0,stderrLength:0,
        events:[],closed:false,error:null,truncated:false,intentRecorded:true};commands.push(row);
      if(${actual}){
        const child=nativeSpawn(command,args,options);row.child=child;children.push(child);
        for(const [n,s] of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]]){
          row[n+'Original']=s;for(const e of ['finish','end','close'])s.on(e,()=>row.events.push(n+':'+e));
          s.on('error',()=>{row.error='original-pipe-error'});
          if(n!=='stdin')s.on('data',b=>{const cap=n==='stdout'?262144:65536,left=Math.max(0,cap-row[n+'Length']);
            if(left)row[n].push(Buffer.from(b.subarray(0,left)));row[n+'Length']+=b.length;if(b.length>left)row.truncated=true});
        }
        const end=child.stdin.end;child.stdin.end=function(b,...a){row.source.push(Buffer.from(b));return end.call(this,b,...a)};
        child.on('error',()=>{row.error='original-child-error'});child.on('close',(code,signal)=>{row.closed=true;row.code=code;row.signal=signal});
        return child;
      }
      const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
      child.kill=()=>{throw Error('FORBIDDEN_KILL')};children.push(child);row.child=child;
      for(const [n,s] of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]]){
        for(const e of ['finish','end','close'])s.on(e,()=>row.events.push(n+':'+e));
        s.on('data',b=>row[n==='stdin'?'source':n].push(Buffer.from(b)));}
      child.stdin.resume();const ordinal=commands.length;onSpawn(ordinal);
      child.stdin.on('finish',()=>setImmediate(()=>{
        onFinish(ordinal);let output='';
        if(command===providers.clang&&args.includes('-M'))output=deps();
        else if(command===providers.clang){fs.writeFileSync(generation+'/peer.node',bundle,{flag:'wx',mode:0o600});
          fs.writeFileSync(generation+'/inputs.d',compileGraph(),{flag:'wx',mode:0o600});}
        else if(command===providers.nm)output=args[0]==='-u'?importText():exportText();
        else if(command===providers.otool)output=dylibText();
        const o=outcome(ordinal);if(o.error){child.emit('error',Error('secret error'));return}
        child.stdout.end(o.stdout??output);child.stderr.end(o.stderr);
        setImmediate(()=>{if(!o.noClose){row.closed=true;row.code=o.code;row.signal=o.signal;child.emit('close',o.code,o.signal)}});
      }));return child;
    };
    let prepare,mod;
    ${loader?`import moduleBuiltin from 'node:module';
    const loadedMethodNames=['receiveControllerHelloV4','challengeControllerAndReceiveAckV4','sendControllerGrantV4',
      'helloClientAndReceiveChallengeV4','ackClientAndReceiveGrantV4'];
    let createRequireCalls=0,loadCalls=0,nativeCalls=0,loaderModule;
    let onCreate=()=>{},onLoad=()=>{},afterLoad=()=>{};
    let loadedExports=Object.freeze(Object.fromEntries(loadedMethodNames.map(n=>[n,()=>{nativeCalls++;throw Error('FORBIDDEN_NATIVE_METHOD')}])));
    const loaderCache=Object.create(null);let loadReturn=()=>loadedExports;
    const requireFixture=p=>{assert.equal(p,generation+'/peer.node');loadCalls++;onLoad();
      loaderModule={id:p,filename:p,loaded:true,exports:loadedExports};loaderCache[p]=loaderModule;
      afterLoad();return loadReturn()};requireFixture.cache=loaderCache;
    // TEST ONLY: no native image is evaluated. Keep the fixed source/provider
    // custody real; replace only the trusted builtin loader occurrence.
    moduleBuiltin.createRequire=url=>{assert.equal(url,'file://'+root+'/scripts/dashboard-cutover-native-sidecar-v2.mjs');
      createRequireCalls++;onCreate();return requireFixture};`:''}
    ${setup}
    ${preimport}
    try{syncBuiltinESMExports();const importedOpenAt=opens.length,importedEffectsAt=effects.length;
    mod=await import('./scripts/dashboard-cutover-native-sidecar-v2.mjs');
    prepare=mod[${JSON.stringify('prepareDashboardCutoverNativeSidecarV'+protocol)}];
    assert.equal(typeof prepare,'function','MISSING_FIXED_V4_NATIVE_SIDECAR');
    // The trusted ESM interpreter reads these four code modules. That is not
    // module-owned retention/preparation; any other original/effect is forbidden.
    const codeNames=new Set(['dashboard-cutover-native-sidecar-v2.mjs','dashboard-cutover-native-build-inputs-v2.mjs',
      'dashboard-cutover-native-inputs-v2.mjs','build-generation-retention.mjs']);
    for(const r of opens.slice(importedOpenAt)){const p=r.p.startsWith('file:')?fileURLToPath(r.p):r.p;
      assert.ok(p.startsWith(root+'/scripts/')&&codeNames.has(p.slice((root+'/scripts/').length)),r.p);}
    assert.equal(commands.length,0);assert.equal(effects.length,importedEffectsAt);
    assert.deepEqual(Object.keys(mod),['assertHeldDashboardCutoverLoadedJobPeerV4','assertHeldDashboardCutoverNativeSidecarLeaseV4',
      'closeHeldDashboardCutoverLoadedJobPeerV4','closeHeldDashboardCutoverNativeSidecarLeaseV4',
      'holdDashboardCutoverLoadedJobPeerV4','holdDashboardCutoverNativeSidecarLeaseV4',
      'prepareDashboardCutoverNativeSidecarV2','prepareDashboardCutoverNativeSidecarV4']);
    ${before}
    ${body}}finally{const snapshot=JSON.stringify({root,generation,commandCount:commands.length,opens:opens.length,closes:closes.length,
      ${loader?'loader:{createRequireCalls,loadCalls,nativeCalls},':''}
      commands:commands.map(r=>({command:r.command,args:r.args,options:r.options,closed:r.closed,code:r.code,signal:r.signal,events:r.events,
        intentRecorded:r.intentRecorded,error:r.error,truncated:r.truncated,stdoutLength:r.stdoutLength,stderrLength:r.stderrLength,
        source:Buffer.concat(r.source).toString('base64'),stdout:Buffer.concat(r.stdout).toString('base64'),stderr:Buffer.concat(r.stderr).toString('base64')}))});
      const bytes=Buffer.from(snapshot);assert.ok(bytes.length<=5242880);let fd;
      // Own diagnostic sibling is outside every pinned fixture root. Persist
      // before interpreter exit, even if an unknown original child remains alive.
      fd=open(root+'.sidecar-command-originals.json',fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
      const n=write(fd,bytes,0,bytes.length,0);assert.equal(n,bytes.length);nativeReceiptFsync(fd);close(fd);
      console.log(snapshot);}`;
  const r=spawnSync(actual?fixed.node:process.execPath,['--input-type=module','-e',script],{cwd:root,env,encoding:'utf8',maxBuffer:Infinity});
  fs.writeFileSync(root+'.sidecar-result.json',JSON.stringify({root,providers,expected,actual,sourceHash:hash(fs.readFileSync(target)),script,status:r.status,signal:r.signal,
    error:r.error?.message??null,stdout:r.stdout,stderr:r.stderr}),{flag:'wx',mode:0o600});
  assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,0,r.stderr+r.stdout);
  const originals=JSON.parse(fs.readFileSync(root+'.sidecar-command-originals.json'));
  assert.equal(originals.root,root);assert.ok(originals.commandCount<=7);
  console.log(JSON.stringify({kind:'sidecar-consumer-case',root,status:r.status}));return {root,result:r};
}

for(const protocol of [2,4]){
  const other=protocol===2?4:2;
  test('V4 shared sidecar vault '+protocol+' idle proxy preserves selection and closed retry has zero ports',()=>{
    fixture(`const alternate=mod.prepareDashboardCutoverNativeSidecarV${other};let traps=0;
      const proxy=new Proxy({},{get(){traps++;throw Error('secret')}}),n=ports.length;
      await rejected(()=>alternate(proxy));assert.equal(traps,0);assert.equal(ports.length,n);
      const ctx=await prepare(),at=ports.length;await rejected(()=>alternate());assert.equal(ports.length,at);
      ctx.recheck();ctx.close();const closed=ports.length;await rejected(()=>alternate());assert.equal(ports.length,closed);`,{protocol});
  });
  test('V4 shared sidecar vault '+protocol+' alternate wrong arity during spawn prevents pipe write',()=>{
    fixture(`await rejected(()=>prepare());await nested;assert.equal(commands.length,1);
      assert.equal(commands[0].source.length,0);assert.equal(effects.length,0);
      const n=ports.length;await rejected(()=>mod.prepareDashboardCutoverNativeSidecarV${other}());assert.equal(ports.length,n);`,{
      protocol,setup:`let nested;onSpawn=()=>{nested=rejected(()=>mod.prepareDashboardCutoverNativeSidecarV${other}(undefined))};`});
  });
  test('V4 shared sidecar vault '+protocol+' alternate reentry stops once-only cleanup',()=>{
    fixture(`const ctx=await prepare();let nested;closes.length=0;fs.closeSync=fd=>{closes.push(fd);close(fd);
      if(!nested)nested=rejected(()=>mod.prepareDashboardCutoverNativeSidecarV${other}(undefined))};
      syncBuiltinESMExports();refused(()=>ctx.close());await nested;assert.equal(closes.length,1);
      const n=ports.length;ctx.close();await rejected(()=>mod.prepareDashboardCutoverNativeSidecarV${other}());assert.equal(ports.length,n);`,{protocol});
  });
}

test('V4 private loaded job peer exports exist before any acquisition or loader port',()=>fixture(`
  assert.equal(typeof mod.holdDashboardCutoverLoadedJobPeerV4,'function','MISSING_V4_PRIVATE_LOADED_JOB_PEER');
  assert.equal(typeof mod.assertHeldDashboardCutoverLoadedJobPeerV4,'function','MISSING_V4_PRIVATE_LOADED_ASSERT');
  assert.equal(typeof mod.closeHeldDashboardCutoverLoadedJobPeerV4,'function','MISSING_V4_PRIVATE_LOADED_CLOSE');
  assert.equal(commands.length,0);assert.equal(createRequireCalls,0);assert.equal(loadCalls,0);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded job peer holds the same original without exposing or calling native methods',()=>fixture(`
  assert.equal(typeof mod.holdDashboardCutoverLoadedJobPeerV4,'function','MISSING_V4_PRIVATE_LOADED_JOB_PEER');
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4(),loaded=await mod.holdDashboardCutoverLoadedJobPeerV4(lease);
  assert.equal(createRequireCalls,1);assert.equal(loadCalls,1);assert.equal(nativeCalls,0);
  assert.equal(Object.getPrototypeOf(loaded),null);assert.equal(Object.isFrozen(loaded),true);
  assert.deepEqual(Reflect.ownKeys(loaded),[]);assert.equal(JSON.stringify(loaded),'{}');
  assert.equal(loaderCache[generation+'/peer.node'],loaderModule);
  const beforeInvalid=ports.length;
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));
  refused(()=>mod.assertHeldDashboardCutoverLoadedJobPeerV4());
  refused(()=>mod.closeHeldDashboardCutoverLoadedJobPeerV4());
  refused(()=>mod.assertHeldDashboardCutoverLoadedJobPeerV4(loaded,undefined));
  refused(()=>mod.closeHeldDashboardCutoverLoadedJobPeerV4(loaded,undefined));
  assert.equal(ports.length,beforeInvalid);
  mod.assertHeldDashboardCutoverLoadedJobPeerV4(loaded);assert.equal(nativeCalls,0);
  mod.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);assert.equal(closes.length,opens.length);
  const at=ports.length;mod.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(ports.length,at);
  assert.equal(loaderCache[generation+'/peer.node'],loaderModule);assert.equal(loadCalls,1);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded job peer idle foreign proxy arity refuses zero loader ports and preserves healthy lease',()=>fixture(`
  assert.equal(typeof mod.holdDashboardCutoverLoadedJobPeerV4,'function','MISSING_V4_PRIVATE_LOADED_JOB_PEER');
  let traps=0;const proxy=new Proxy({},{get(){traps++;throw Error('secret')},getPrototypeOf(){traps++;throw Error('secret')}}),at=ports.length;
  for(const value of [proxy,{},Object.freeze(Object.create(null)),undefined,null,generation]){
    await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(value));
    refused(()=>mod.assertHeldDashboardCutoverLoadedJobPeerV4(value));refused(()=>mod.closeHeldDashboardCutoverLoadedJobPeerV4(value));}
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4());assert.equal(ports.length,at);
  assert.equal(traps,0);assert.equal(loadCalls,0);assert.equal(createRequireCalls,0);
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4(),n=ports.length;
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease,undefined));assert.equal(ports.length,n);
  mod.assertHeldDashboardCutoverNativeSidecarLeaseV4(lease);
  const loaded=await mod.holdDashboardCutoverLoadedJobPeerV4(lease);mod.assertHeldDashboardCutoverLoadedJobPeerV4(loaded);
  mod.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded final terminal-pass cache drift cannot escape assertion',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4(),loaded=await mod.holdDashboardCutoverLoadedJobPeerV4(lease);
  let bundleReads=0,replaced=false;const reading=fs.readSync;
  fs.readSync=(fd,...a)=>{const r=reading(fd,...a);if(fdPaths.get(fd)===generation+'/peer.node'&&++bundleReads===2){
    loaderCache[generation+'/peer.node']={...loaderModule};replaced=true;}return r};syncBuiltinESMExports();
  refused(()=>mod.assertHeldDashboardCutoverLoadedJobPeerV4(loaded));assert.equal(replaced,true);
  const at=ports.length;refused(()=>mod.assertHeldDashboardCutoverLoadedJobPeerV4(loaded));assert.equal(ports.length,at);
  mod.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded mint-time cache drift cannot publish a valid loaded handle',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4();let changed=false;
  const freezing=Object.freeze;Object.freeze=o=>{const r=freezing(o);
    if(o&&Object.getPrototypeOf(o)===null&&Reflect.ownKeys(o).length===0){loaderCache[generation+'/peer.node']={...loaderModule};changed=true;}return r};
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(changed,true);
  const at=ports.length;await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(ports.length,at);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded cache arrival during pre-load terminal pass refuses before require',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4();let inserted=false;
  onCreate=()=>{const reading=fs.readSync;fs.readSync=(fd,...a)=>{const r=reading(fd,...a);
    if(!inserted&&fdPaths.get(fd)===generation+'/peer.node'){
      loaderCache[generation+'/peer.node']={id:generation+'/peer.node',filename:generation+'/peer.node',loaded:true,exports:loadedExports};
      inserted=true;}return r};syncBuiltinESMExports()};
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(inserted,true);assert.equal(loadCalls,0);
  const at=ports.length;await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(ports.length,at);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded cache binding drift before require refuses with zero load',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4();let changed=false;
  onCreate=()=>{const reading=fs.readSync;fs.readSync=(fd,...a)=>{const r=reading(fd,...a);
    if(!changed&&fdPaths.get(fd)===generation+'/peer.node'){requireFixture.cache=Object.create(null);changed=true;}
    return r};syncBuiltinESMExports()};
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(changed,true);assert.equal(loadCalls,0);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded mint creation active reentry prevents sealing',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4();let count=0,minted,seals=0;
  const creating=Object.create,freezing=Object.freeze;
  Object.create=(...a)=>{const r=creating(...a);if(a[0]===null&&Error().stack.includes('at loadFixed ')&&++count===3){
    minted=r;refused(()=>mod.assertHeldDashboardCutoverLoadedJobPeerV4());}return r};
  Object.freeze=o=>{if(o===minted)seals++;return freezing(o)};
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.ok(minted);assert.equal(seals,0);
  refused(()=>mod.assertHeldDashboardCutoverLoadedJobPeerV4(minted));
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

for(const [name,mutation,beforeLoad] of [
  ['cache proxy',`onCreate=()=>{requireFixture.cache=new Proxy(loaderCache,{get(){traps++;throw Error('secret')},getPrototypeOf(){traps++;throw Error('secret')}})}`,true],
  ['cache accessor',`onCreate=()=>Object.defineProperty(requireFixture,'cache',{get(){traps++;throw Error('secret')}})`,true],
  ['module proxy',`afterLoad=()=>{loaderCache[generation+'/peer.node']=new Proxy(loaderModule,{get(){traps++;throw Error('secret')},getOwnPropertyDescriptor(){traps++;throw Error('secret')}})}`,false],
  ['module accessor',`afterLoad=()=>Object.defineProperty(loaderModule,'filename',{get(){traps++;throw Error('secret')}})`,false],
  ['module unloaded',`afterLoad=()=>{loaderModule.loaded=false}`,false],
  ['module id',`afterLoad=()=>{loaderModule.id+='-foreign'}`,false],
  ['module filename',`afterLoad=()=>{loaderModule.filename+='-foreign'}`,false],
  ['module exports mismatch',`afterLoad=()=>{loaderModule.exports={...loadedExports}}`,false],
  ['exports proxy',`loadedExports=new Proxy(loadedExports,{get(){traps++;throw Error('secret')},ownKeys(){traps++;throw Error('secret')},getPrototypeOf(){traps++;throw Error('secret')}})`,false],
  ['exports mutable',`loadedExports={...loadedExports}`,false],
  ['exports missing',`loadedExports=Object.freeze(Object.fromEntries(Object.entries(loadedExports).slice(1)))`,false],
  ['exports extra',`loadedExports=Object.freeze({...loadedExports,extra(){}})`,false],
  ['exports symbol',`loadedExports=Object.freeze({...loadedExports,[Symbol('extra')]:()=>{}})`,false],
  ['method accessor',`const malformed={...loadedExports};Object.defineProperty(malformed,loadedMethodNames[0],{get(){traps++;throw Error('secret')},enumerable:true});loadedExports=Object.freeze(malformed)`,false],
  ['method proxy',`loadedExports=Object.freeze({...loadedExports,[loadedMethodNames[0]]:new Proxy(loadedExports[loadedMethodNames[0]],{apply(){traps++;throw Error('secret')},get(){traps++;throw Error('secret')}})})`,false],
])test('V4 private loaded malformed '+name+' rejects without caller traps',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4();await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));
  assert.equal(traps,0);assert.equal(createRequireCalls,1);assert.equal(loadCalls,${beforeLoad?0:1});
  const at=ports.length;await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(ports.length,at);
  const entry=loaderCache[generation+'/peer.node'];mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);
  assert.equal(loaderCache[generation+'/peer.node'],entry);assert.equal(nativeCalls,0);`,
  {protocol:4,loader:true,setup:`let traps=0;${mutation};`}));

for(const absentValue of [false,true])test('V4 private loaded preexisting '+(absentValue?'undefined':'shaped')+' own cache is never adopted',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4(),entry=${absentValue?'undefined':"{id:generation+'/peer.node',filename:generation+'/peer.node',loaded:true,exports:loadedExports}"};
  loaderCache[generation+'/peer.node']=entry;await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));
  assert.equal(loadCalls,0);assert.equal(loaderCache[generation+'/peer.node'],entry);
  const at=ports.length;await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(ports.length,at);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(Object.hasOwn(loaderCache,generation+'/peer.node'),true);
  assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded load response loss retains cache without retry or method invocation',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4();afterLoad=()=>{throw Error('private-response-loss')};
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(loadCalls,1);
  assert.equal(loaderCache[generation+'/peer.node'],loaderModule);
  const at=ports.length;await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(ports.length,at);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(loaderCache[generation+'/peer.node'],loaderModule);
  assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded thenable return is never awaited or inspected through then getter',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4();let thenReads=0;
  loadReturn=()=>Object.defineProperty({},'then',{get(){thenReads++;throw Error('secret')}});
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(thenReads,0);assert.equal(loadCalls,1);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded pending seal response loss never authenticates captured key',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4();let captured;
  const freezing=Object.freeze;Object.freeze=o=>{const r=freezing(o);
    if(o&&Object.getPrototypeOf(o)===null&&Reflect.ownKeys(o).length===0){captured=o;throw Error('seal-response-loss')}return r};
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.ok(captured);
  const at=ports.length;refused(()=>mod.assertHeldDashboardCutoverLoadedJobPeerV4(captured));
  refused(()=>mod.closeHeldDashboardCutoverLoadedJobPeerV4(captured));
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(ports.length,at);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

for(const [stage,api,args] of [
  ['createRequire','assertHeldDashboardCutoverLoadedJobPeerV4',''],
  ['createRequire','closeHeldDashboardCutoverNativeSidecarLeaseV4','foreign'],
  ['require','assertHeldDashboardCutoverNativeSidecarLeaseV4','lease,undefined'],
  ['require','closeHeldDashboardCutoverLoadedJobPeerV4','foreign'],
  ['inspection','assertHeldDashboardCutoverLoadedJobPeerV4',''],
  ['seal','closeHeldDashboardCutoverLoadedJobPeerV4','foreign,undefined'],
])test('V4 private loaded active-first '+stage+' '+api+' rejects before identity or arity',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4();let traps=0,hit=false,at;
  const foreign=new Proxy({},{get(){traps++;throw Error('secret')},getPrototypeOf(){traps++;throw Error('secret')}});
  const reentry=()=>{if(hit)return;hit=true;refused(()=>mod.${api}(${args}));at=ports.length};
  ${stage==='createRequire'?'onCreate=reentry':stage==='require'?'onLoad=reentry':stage==='inspection'?`const inspecting=Object.getOwnPropertyDescriptor;Object.getOwnPropertyDescriptor=(o,k)=>{const r=inspecting(o,k);if(o===loaderModule)reentry();return r}`:`const freezing=Object.freeze;Object.freeze=o=>{const r=freezing(o);if(o&&Object.getPrototypeOf(o)===null&&Reflect.ownKeys(o).length===0)reentry();return r}`};
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(hit,true);
  assert.equal(ports.length,at);assert.equal(traps,0);assert.equal(loadCalls,${stage==='createRequire'?0:1});
  const entry=loaderCache[generation+'/peer.node'];mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);
  assert.equal(loaderCache[generation+'/peer.node'],entry);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

for(const [name,mutation] of [
  ['cache clone',`loaderCache[generation+'/peer.node']={...loaderModule}`],
  ['module field',`loaderModule.loaded=false`],
  ['exports replacement',`loaderModule.exports=Object.freeze({...loadedExports})`],
  ['descriptor flags',`Object.defineProperty(loaderModule,'filename',{enumerable:false})`],
])test('V4 private loaded post-load '+name+' drift burns with no replacement',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4(),loaded=await mod.holdDashboardCutoverLoadedJobPeerV4(lease);
  ${mutation};refused(()=>mod.assertHeldDashboardCutoverLoadedJobPeerV4(loaded));
  const at=ports.length;refused(()=>mod.assertHeldDashboardCutoverLoadedJobPeerV4(loaded));assert.equal(ports.length,at);
  const entry=loaderCache[generation+'/peer.node'];mod.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);
  assert.equal(loaderCache[generation+'/peer.node'],entry);assert.equal(loadCalls,1);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded original-first cross-close never recloses reused descriptors',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4(),loaded=await mod.holdDashboardCutoverLoadedJobPeerV4(lease);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);const disposed=closes.length,fd=open('/dev/null','r');
  const at=ports.length;mod.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(ports.length,at);assert.equal(closes.length,disposed);
  assert.ok(fs.fstatSync(fd));close(fd);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded source drift before loader refuses with zero loader occurrences',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4();
  fs.writeFileSync(selectedSource,Buffer.concat([fs.readFileSync(selectedSource),Buffer.from('\\n')]));
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(createRequireCalls,0);assert.equal(loadCalls,0);
  const at=ports.length;await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(ports.length,at);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded terminal bundle ABA after loading burns without replay',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4(),loaded=await mod.holdDashboardCutoverLoadedJobPeerV4(lease);
  const p=generation+'/peer.node';fs.renameSync(p,p+'.preserved');fs.renameSync(p+'.preserved',p);
  refused(()=>mod.assertHeldDashboardCutoverLoadedJobPeerV4(loaded));
  const at=ports.length;refused(()=>mod.assertHeldDashboardCutoverLoadedJobPeerV4(loaded));assert.equal(ports.length,at);
  mod.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);assert.equal(loadCalls,1);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded acquisition active reentry burns before require',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4();let nested;
  onCreate=()=>{nested=rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4())};
  await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));await nested;assert.equal(loadCalls,0);
  const at=ports.length;await rejected(()=>mod.holdDashboardCutoverLoadedJobPeerV4(lease));assert.equal(ports.length,at);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 private loaded wrapper close response loss never retries reused number or later originals',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4(),loaded=await mod.holdDashboardCutoverLoadedJobPeerV4(lease);
  let replacement;closes.length=0;fs.closeSync=fd=>{closes.push(fd);close(fd);replacement=open(providers.node,'r');
    assert.equal(replacement,fd);throw Error('unknown close')};syncBuiltinESMExports();
  refused(()=>mod.closeHeldDashboardCutoverLoadedJobPeerV4(loaded));assert.equal(closes.length,1);
  const at=ports.length;mod.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);refused(()=>mod.assertHeldDashboardCutoverLoadedJobPeerV4(loaded));
  assert.equal(ports.length,at);assert.equal(closes.length,1);fs.fstatSync(replacement);close(replacement);
  assert.equal(nativeCalls,0);`,{protocol:4,loader:true}));

test('V4 opaque original sidecar lease exports exist before any acquisition port',()=>fixture(`
  assert.equal(typeof mod.holdDashboardCutoverNativeSidecarLeaseV4,'function','MISSING_V4_ORIGINAL_SIDECAR_LEASE');
  assert.equal(typeof mod.assertHeldDashboardCutoverNativeSidecarLeaseV4,'function','MISSING_V4_ORIGINAL_SIDECAR_ASSERT');
  assert.equal(typeof mod.closeHeldDashboardCutoverNativeSidecarLeaseV4,'function','MISSING_V4_ORIGINAL_SIDECAR_CLOSE');
  assert.equal(commands.length,0);assert.equal(effects.length,0);`,{protocol:4}));

test('V4 opaque original lease is empty and frozen while its same original can assert and close once',()=>fixture(`
  const hold=mod.holdDashboardCutoverNativeSidecarLeaseV4;
  assert.equal(typeof hold,'function','MISSING_V4_ORIGINAL_SIDECAR_LEASE');
  const lease=await hold();assert.equal(commands.length,7);assert.equal(Object.getPrototypeOf(lease),null);
  assert.equal(Object.isFrozen(lease),true);assert.deepEqual(Reflect.ownKeys(lease),[]);
  assert.equal(JSON.stringify(lease),'{}');assert.equal(mod.assertHeldDashboardCutoverNativeSidecarLeaseV4(lease),undefined);
  const m=JSON.parse(fs.readFileSync(generation+'/manifest.json'));assert.equal(m.source.sha256,sourceHash);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(closes.length,opens.length);
  const n=ports.length;mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);
  refused(()=>mod.assertHeldDashboardCutoverNativeSidecarLeaseV4(lease));assert.equal(ports.length,n);`,{protocol:4}));

test('V4 opaque original lease refuses foreign proxy arity without consuming a healthy first attempt',()=>fixture(`
  const hold=mod.holdDashboardCutoverNativeSidecarLeaseV4,check=mod.assertHeldDashboardCutoverNativeSidecarLeaseV4,
    shut=mod.closeHeldDashboardCutoverNativeSidecarLeaseV4;
  assert.equal(typeof hold,'function','MISSING_V4_ORIGINAL_SIDECAR_LEASE');
  let traps=0;const proxy=new Proxy({},{get(){traps++;throw Error('secret')},getPrototypeOf(){traps++;throw Error('secret')}}),n=ports.length;
  await rejected(()=>hold(proxy));await rejected(()=>hold(undefined));
  for(const value of [proxy,{},Object.freeze(Object.create(null)),undefined,null,generation]){
    refused(()=>check(value));refused(()=>shut(value));}
  refused(()=>check());refused(()=>shut());assert.equal(traps,0);assert.equal(ports.length,n);
  const lease=await hold(),at=ports.length;refused(()=>check(lease,undefined));refused(()=>shut(lease,undefined));
  assert.equal(ports.length,at);check(lease);shut(lease);`,{protocol:4}));

test('V4 opaque original lease refuses clones prototypes paths manifests and another module instance without traps',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4(),check=mod.assertHeldDashboardCutoverNativeSidecarLeaseV4,
    shut=mod.closeHeldDashboardCutoverNativeSidecarLeaseV4;
  const other=await import('./scripts/dashboard-cutover-native-sidecar-v2.mjs?independent-lease-instance');
  const manifest=JSON.parse(fs.readFileSync(generation+'/manifest.json'));let traps=0;
  const proxy=new Proxy(lease,{get(){traps++;throw Error('secret')},getPrototypeOf(){traps++;throw Error('secret')}});
  const revoked=Proxy.revocable(lease,{});revoked.revoke();const at=ports.length;
  for(const fake of [{...lease},Object.create(lease),proxy,revoked.proxy,generation,manifest,generation+'/peer.node']){
    refused(()=>check(fake));refused(()=>shut(fake));}
  refused(()=>other.assertHeldDashboardCutoverNativeSidecarLeaseV4(lease));
  refused(()=>other.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease));
  assert.equal(traps,0);assert.equal(ports.length,at);check(lease);shut(lease);`,{protocol:4}));

for(const protocol of [2,4])test('V4 opaque original DATA '+protocol+' cannot be adopted and remains healthy after lease refusal',()=>fixture(`
  const ctx=await prepare(),at=ports.length;await rejected(()=>mod.holdDashboardCutoverNativeSidecarLeaseV4());
  for(const fake of [ctx,ctx.observation,ctx.observation.manifest]){
    refused(()=>mod.assertHeldDashboardCutoverNativeSidecarLeaseV4(fake));
    refused(()=>mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(fake));}
  assert.equal(ports.length,at);ctx.recheck();ctx.close();const closed=ports.length;
  await rejected(()=>mod.holdDashboardCutoverNativeSidecarLeaseV4());assert.equal(ports.length,closed);`,{protocol}));

test('V4 opaque original lease blocks both DATA profiles and replacement without revoking original',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4(),at=ports.length;
  for(const f of [mod.prepareDashboardCutoverNativeSidecarV2,mod.prepareDashboardCutoverNativeSidecarV4,
    mod.holdDashboardCutoverNativeSidecarLeaseV4])await rejected(()=>f());
  assert.equal(ports.length,at);mod.assertHeldDashboardCutoverNativeSidecarLeaseV4(lease);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);const closed=ports.length;
  for(const f of [mod.prepareDashboardCutoverNativeSidecarV2,mod.prepareDashboardCutoverNativeSidecarV4,
    mod.holdDashboardCutoverNativeSidecarLeaseV4])await rejected(()=>f());assert.equal(ports.length,closed);`,{protocol:4}));

for(const action of ['hold','assert','close'])for(const boundary of ['opening','spawn','pending','terminal-sync','terminal-read','mint'])
  test('V4 opaque original active '+action+' at '+boundary+' burns before later ports or publication',()=>fixture(`
    await rejected(()=>mod.holdDashboardCutoverNativeSidecarLeaseV4());await nested;assert.equal(fired,1);
    assert.equal(later,0);assert.equal(sidecarOriginalDisposals.length,0);const at=ports.length;
    if(captured){refused(()=>mod.assertHeldDashboardCutoverNativeSidecarLeaseV4(captured));
      refused(()=>mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(captured));}
    await rejected(()=>mod.holdDashboardCutoverNativeSidecarLeaseV4());assert.equal(ports.length,at);
    assert.equal(effects.some(e=>['unlinkSync','rmSync','rmdirSync'].includes(e.n)),false);
    ${boundary==='spawn'?"assert.equal(commands.length,1);assert.equal(commands[0].source.length,0);":''}
    ${boundary==='pending'?"assert.equal(commands.length,4);assert.equal(fs.existsSync(generation+'/manifest.json'),false);":''}`,{
    protocol:4,setup:`let fired=0,nested,later=0,captured,terminal=false;
      const fire=()=>{fired++;${action==='hold'?`nested=rejected(()=>mod.holdDashboardCutoverNativeSidecarLeaseV4(undefined));`:
        `refused(()=>mod.${action==='assert'?'assertHeld':'closeHeld'}DashboardCutoverNativeSidecarLeaseV4(${['opening','terminal-sync'].includes(boundary)?'':
          ['spawn','pending'].includes(boundary)?'{}':'{},undefined'}));`}};
      ${boundary==='opening'?`const opening=fs.openSync;fs.openSync=(p,...a)=>{
        const owned=isSidecarOriginal();if(fired&&owned)later++;const fd=opening(p,...a);
        if(!fired&&owned&&String(p)===root)fire();return fd};`:
        boundary==='spawn'?`onSpawn=()=>{if(!fired)fire();else later++};`:
        boundary==='pending'?`onFinish=n=>{if(n===4)fire();else if(fired)later++};`:
        boundary==='mint'?`const freezing=Object.freeze;Object.freeze=o=>{
          if(o&&Object.getPrototypeOf(o)===null&&Reflect.ownKeys(o).length===0){captured=o;const r=freezing(o);fire();return r}
          if(fired)later++;return freezing(o)};`:
        `const syncing=fs.fsyncSync;fs.fsyncSync=fd=>{if(fired)later++;const r=syncing(fd);
          if(fdPaths.get(fd)===generation){terminal=true;${boundary==='terminal-sync'?'fire();':''}}return r};
        const reading=fs.readSync;fs.readSync=(fd,...a)=>{if(fired)later++;const r=reading(fd,...a);
          ${boundary==='terminal-read'?"if(terminal&&!fired&&fdPaths.get(fd)===generation+'/peer.node')fire();":''}return r};`}`
  }));

for(const kind of ['seal-loss','last-fsync-loss','unknown-child','missing-output-eof'])
  test('V4 opaque original '+kind+' retains unpublished originals without replacement',()=>fixture(`
    await rejected(()=>mod.holdDashboardCutoverNativeSidecarLeaseV4());assert.equal(fired,1);
    assert.equal(sidecarOriginalDisposals.length,0);const at=ports.length;
    if(captured){assert.equal(Object.isFrozen(captured),true);
      refused(()=>mod.assertHeldDashboardCutoverNativeSidecarLeaseV4(captured));
      refused(()=>mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(captured));}
    await rejected(()=>mod.holdDashboardCutoverNativeSidecarLeaseV4());assert.equal(ports.length,at);
    assert.equal(effects.some(e=>['unlinkSync','rmSync','rmdirSync'].includes(e.n)),false);`,{
    protocol:4,setup:`let fired=0,captured;
      ${kind==='seal-loss'?`const freezing=Object.freeze;Object.freeze=o=>{
        const r=freezing(o);if(o&&Object.getPrototypeOf(o)===null&&Reflect.ownKeys(o).length===0){
          captured=o;fired++;throw Error('unknown sealing response')}return r};`:
        kind==='last-fsync-loss'?`const syncing=fs.fsyncSync;fs.fsyncSync=fd=>{const r=syncing(fd);
          if(fdPaths.get(fd)===generation){fired++;throw Error('unknown terminal sync response')}return r};`:
        kind==='unknown-child'?`outcome=n=>{if(n===4){fired++;return {error:true}}return {code:0,signal:null,stderr:''}};`:
        `const timeout=globalThis.setTimeout;globalThis.setTimeout=(f,ms,...a)=>timeout(f,ms===30000?50:ms,...a);
        const spawning=cp.spawn;cp.spawn=(...a)=>{const c=spawning(...a);if(commands.length===4){fired++;c.stdout.end=()=>c.stdout}return c};`}`
  }));

for(const kind of ['source','ancestor','bundle','manifest'])test('V4 opaque original '+kind+' drift burns validity but genuine idle cleanup survives',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4(),p=${({source:'selectedSource',ancestor:"root+'/scripts'",
    bundle:"generation+'/peer.node'",manifest:"generation+'/manifest.json'"})[kind]};
  fs.renameSync(p,p+'.preserved');fs.renameSync(p+'.preserved',p);
  refused(()=>mod.assertHeldDashboardCutoverNativeSidecarLeaseV4(lease));const at=ports.length;
  refused(()=>mod.assertHeldDashboardCutoverNativeSidecarLeaseV4(lease));assert.equal(ports.length,at);
  mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(closes.length,opens.length);
  const closed=ports.length;mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(ports.length,closed);`,{protocol:4}));

for(const phase of ['recheck','cleanup'])for(const action of ['hold','assert','close'])
  test('V4 opaque original '+action+' during '+phase+' stops later original ports',()=>fixture(`
    const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4();let fired=0,later=0,nested;
    const fire=()=>{fired++;${action==='hold'?`nested=rejected(()=>mod.holdDashboardCutoverNativeSidecarLeaseV4(undefined));`:
      `refused(()=>mod.${action==='assert'?'assertHeld':'closeHeld'}DashboardCutoverNativeSidecarLeaseV4({},undefined));`}};
    ${phase==='recheck'?`fs.readSync=(fd,...a)=>{if(fired)later++;const r=read(fd,...a);
      if(!fired&&fdPaths.get(fd)===generation+'/peer.node')fire();return r};`:
      `closes.length=0;fs.closeSync=fd=>{if(fired)later++;closes.push(fd);close(fd);if(!fired)fire()};`}
    syncBuiltinESMExports();refused(()=>mod.${phase==='recheck'?'assertHeld':'closeHeld'}DashboardCutoverNativeSidecarLeaseV4(lease));
    await nested;assert.equal(fired,1);assert.equal(later,0);
    ${phase==='recheck'?`mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(closes.length,opens.length);`:
      `assert.equal(closes.length,1);mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);assert.equal(closes.length,1);`}`,{protocol:4}));

test('V4 opaque original close response loss never retries the reused number or later originals',()=>fixture(`
  const lease=await mod.holdDashboardCutoverNativeSidecarLeaseV4();let replacement;closes.length=0;
  fs.closeSync=fd=>{closes.push(fd);close(fd);replacement=open(providers.node,'r');
    assert.equal(replacement,fd);throw Error('unknown close')};syncBuiltinESMExports();
  refused(()=>mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease));assert.equal(closes.length,1);
  const at=ports.length;mod.closeHeldDashboardCutoverNativeSidecarLeaseV4(lease);
  refused(()=>mod.assertHeldDashboardCutoverNativeSidecarLeaseV4(lease));assert.equal(ports.length,at);
  fs.fstatSync(replacement);close(replacement);`,{protocol:4}));

test('V4 terminal sidecar independently binds the job source and separate generation namespace',()=>fixture(`
  const old=fs.readFileSync(root+'/scripts/dashboard-cutover-mach-peer-v2.c'),ctx=await prepare(),o=ctx.observation;
  assert.equal(o.schema,'setfarm.internal-production-dashboard-native-sidecar-build.v4');
  assert.equal(o.authority,'native-sidecar-build-only');assert.equal(o.generation,generation);assert.equal(commands.length,7);
  assert.equal(commands[0].args.at(-1),'.setfarm/dashboard-cutover-native-v4/');
  assert.equal(digest(Buffer.concat(commands[3].source)),sourceHash);assert.equal(Buffer.concat(commands[3].source).length,sourceLength);
  const manifest=JSON.parse(fs.readFileSync(generation+'/manifest.json'));
  assert.equal(manifest.schema,'setfarm.internal-production-dashboard-native-sidecar-build.v4');
  assert.equal(manifest.source.locator,selectedSource);assert.equal(manifest.source.sha256,sourceHash);assert.equal(manifest.source.byteLength,sourceLength);
  const direct=manifest.directInputs.find(f=>f.role==='source');assert.equal(direct.locator,selectedSource);assert.equal(direct.sha256,sourceHash);
  assert.deepEqual(fs.readdirSync(generation).sort(),['inputs.d','manifest.json','peer.node','provider-tmp']);
  assert.equal(fs.existsSync(root+'/.setfarm/dashboard-cutover-native-v2'),false);
  for(const name of ['peer.node','inputs.d','manifest.json'])assert.equal(fs.statSync(generation+'/'+name).mode&0o777,0o444);
  ctx.recheck();ctx.close();assert.ok(fs.readFileSync(root+'/scripts/dashboard-cutover-mach-peer-v2.c').equals(old));`,{protocol:4}));

test('V4 sidecar accepts the same canonical graph with different dependency ordering',()=>fixture(`
  const ctx=await prepare();assert.equal(commands.length,7);
  const manifest=JSON.parse(fs.readFileSync(generation+'/manifest.json'));
  assert.notEqual(manifest.discoveries[0].sha256,manifest.discoveries[1].sha256);
  assert.deepEqual(manifest.headers.map(h=>h.locator).sort(),headerPaths.slice().sort());
  ctx.recheck();ctx.close();`,{protocol:4,setup:`onFinish=n=>{if(n===3)headerPaths.reverse()};`}));

test('V4 sidecar refuses genuine crossed V2 upstream before generation or compile',()=>fixture(`
  await rejected(()=>prepare());assert.equal(commands.length,3);
  assert.equal(commands.some(r=>r.args.includes('-bundle')),false);assert.equal(fs.existsSync(generation),false);
  const n=ports.length;await rejected(()=>prepare());assert.equal(ports.length,n);`,{protocol:4,crossedSource:true}));

test('V4 sidecar refuses locator-only mismatch with identical bytes and genuine V4 build inputs',()=>fixture(`
  assert.ok(fs.readFileSync(selectedSource).equals(fs.readFileSync(root+'/scripts/dashboard-cutover-mach-job-peer-v4-alternate.c')));
  await rejected(()=>prepare());assert.equal(commands.length,3);assert.equal(fs.existsSync(generation),false);
  const n=ports.length;await rejected(()=>prepare());assert.equal(ports.length,n);`,{protocol:4,alternateSource:true}));

test('V4 namespace collision preserves both historical namespaces without adoption',()=>fixture(`
  const old=fs.readFileSync(generation+'/preserved'),v2=root+'/.setfarm/dashboard-cutover-native-v2/preserved';
  await rejected(()=>prepare());assert.equal(commands.length,3);assert.ok(fs.readFileSync(generation+'/preserved').equals(old));
  assert.equal(fs.readFileSync(v2,'utf8'),'V2 history');assert.equal(effects.some(e=>['unlinkSync','rmSync','rmdirSync'].includes(e.n)),false);
  const n=ports.length;await rejected(()=>prepare());assert.equal(ports.length,n);`,{protocol:4,before:`
    fs.mkdirSync(generation,{recursive:true,mode:0o700});fs.writeFileSync(generation+'/preserved','V4 history',{mode:0o600});
    fs.mkdirSync(root+'/.setfarm/dashboard-cutover-native-v2',{mode:0o700});
    fs.writeFileSync(root+'/.setfarm/dashboard-cutover-native-v2/preserved','V2 history',{mode:0o600});effects.length=0;`}));

for(const protocol of [2,4])test('V4 shared sidecar vault '+protocol+' alternate reentry during pending compile prevents inspection',()=>{
  const other=protocol===2?4:2;
  fixture(`await rejected(()=>prepare());await nested;assert.equal(commands.length,4);
    assert.equal(fs.existsSync(generation+'/manifest.json'),false);const n=ports.length;
    await rejected(()=>mod.prepareDashboardCutoverNativeSidecarV${other}());assert.equal(ports.length,n);`,{
    protocol,setup:`let nested;onFinish=n=>{if(n===4)nested=rejected(()=>mod.prepareDashboardCutoverNativeSidecarV${other}(undefined))};`});
});

test('V4 sidecar original compile error retains unknown child and generation without retry',()=>fixture(`
  await rejected(()=>prepare());assert.equal(commands.length,4);assert.equal(commands[3].closed,false);
  assert.equal(fs.existsSync(generation+'/manifest.json'),false);const n=ports.length;
  await rejected(()=>mod.prepareDashboardCutoverNativeSidecarV2());assert.equal(ports.length,n);`,{
  protocol:4,setup:`outcome=n=>n===4?{error:true}:{code:0,signal:null,stderr:''};`}));

for(const protocol of [2,4])test((protocol===4?'V4 full oracle: ':'')+'terminal sidecar binds source, exact recipe, original commands and independent manifest contents',()=>fixture(`
  const ctx=await prepare(),o=ctx.observation;assert.ok(Object.isFrozen(ctx));assert.ok(Object.isFrozen(o));
  assert.equal(o.authority,'native-sidecar-build-only');assert.equal(o.generation,generation);assert.equal(commands.length,7);
  const g=commands[0];assert.equal(g.command,'/usr/bin/git');assert.deepEqual(g.args,
    ['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','check-ignore','-q','--','.setfarm/dashboard-cutover-native-v${protocol}/']);
  assert.equal(g.options.cwd,root);assert.deepEqual(g.options.env,{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',GIT_CONFIG_NOSYSTEM:'1',
    GIT_CONFIG_GLOBAL:'/dev/null',GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'});
  const c=commands[3];assert.equal(c.command,providers.clang);assert.deepEqual(c.args,
    ['--no-default-config','-nostdinc','-std=c11','-DNAPI_VERSION=8','-arch','arm64','-mmacosx-version-min=14.0',
    '-isysroot',providers.sdk,'-resource-dir',providers.resource,'-isystem',providers.headers,'-isystem',providers.resource+'/include',
    '-isystem',providers.sdk+'/usr/include','-iframework',providers.sdk+'/System/Library/Frameworks','-Wall','-Wextra','-Werror','-O2',
    '-bundle','-nostdlib','--ld-path='+providers.ld,...napi.map(n=>'-Wl,-U,_napi_'+n),
    '-MD','-MF',generation+'/inputs.d','-MT','setfarm-cutover-inputs','-x','c','-','-x','none',
    providers.sdk+'/usr/lib/libSystem.B.tbd',providers.sdk+'/usr/lib/libbsm.0.tbd','-o',generation+'/peer.node']);
  for(const r of commands.slice(3)){assert.deepEqual(r.options.env,{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TMPDIR:generation+'/provider-tmp'});
    assert.equal(r.options.cwd,'/private/tmp');assert.equal(r.options.shell,false);assert.deepEqual(r.options.stdio,['pipe','pipe','pipe']);}
  assert.equal(digest(Buffer.concat(c.source)),sourceHash);assert.equal(Buffer.concat(c.source).length,sourceLength);
  assert.deepEqual(commands.slice(4).map(r=>[r.command,r.args]),[[providers.nm,['-u',generation+'/peer.node']],
    [providers.nm,['-gU',generation+'/peer.node']],[providers.otool,['-L',generation+'/peer.node']]]);
  assert.deepEqual(fs.readdirSync(generation).sort(),['inputs.d','manifest.json','peer.node','provider-tmp']);
  assert.deepEqual(fs.readdirSync(generation+'/provider-tmp'),[]);
  const m=JSON.parse(fs.readFileSync(generation+'/manifest.json'));assert.equal(m.schema,'setfarm.internal-production-dashboard-native-sidecar-build.v${protocol}');
  assert.deepEqual(m.sourceBuild,{sha:expected.sourceSha,treeHash:expected.sourceTreeHash,buildHash:expected.buildHash});
  assert.equal(m.source.sha256,sourceHash);assert.equal(m.source.byteLength,sourceLength);assert.equal(m.linkInputs.length,6);
  for(const p of [...m.linkInputs,...m.headers,...m.directInputs]){const original=fs.readFileSync(p.physicalLocator??p.locator);
    assert.equal(p.byteLength,original.length);assert.equal(p.sha256,digest(original));}
  assert.deepEqual(m.profile,{platform:'darwin',arch:'arm64',nodeVersion:'26.4.0',napiVersion:8,sdk:providers.sdk,resource:providers.resource});
  assert.deepEqual(m.discoveries.map(x=>[x.phase,x.byteLength,x.sha256]),['provisional','held-validation'].map(p=>[p,Buffer.byteLength(deps()),digest(Buffer.from(deps()))]));
  assert.deepEqual(m.headers.map(x=>x.locator).sort(),headerPaths.slice().sort());
  assert.deepEqual(m.imports,imports.slice().sort());assert.deepEqual(m.exports,exports.slice().sort());
  assert.deepEqual(m.dependencies,['/usr/lib/libSystem.B.dylib','/usr/lib/libbsm.0.dylib'].sort());
  assert.equal(m.outputs.bundle.sha256,digest(bundle));assert.equal(m.outputs.depfile.sha256,digest(Buffer.from(deps())));
  assert.deepEqual(m.commands.map(x=>x.phase),['compile','imports','exports','dependencies']);
  for(let i=0;i<4;i++){const r=commands[i+3],c=m.commands[i];assert.deepEqual(c.args,r.args);assert.equal(c.executable,r.command);
    assert.deepEqual(c.env,r.options.env);assert.equal(c.cwd,r.options.cwd);assert.equal(c.code,0);assert.equal(c.signal,null);
    assert.equal(c.originalPipeCompletion,true);assert.equal(c.sourceHash,digest(Buffer.concat(r.source)));
    assert.equal(c.stdoutHash,digest(Buffer.concat(r.stdout)));assert.equal(c.stderrLength,0);}
  for(const n of ['peer.node','inputs.d','manifest.json'])assert.equal(fs.statSync(generation+'/'+n).mode&0o777,0o444);
  await Promise.resolve();ctx.recheck();ctx.close();assert.equal(closes.length,opens.length);
  const n=ports.length;ctx.close();assert.equal(ports.length,n);await rejected(()=>prepare());`,{protocol}));

test('invalid idle arguments do not inspect proxy or admit effect ports',()=>fixture(`const n=ports.length;
  let traps=0;const p=new Proxy({},{get(){traps++;throw Error('secret')}});await rejected(()=>prepare(p));await rejected(()=>prepare(undefined));
  assert.equal(traps,0);assert.equal(ports.length,n);assert.equal(commands.length,0);const ctx=await prepare();ctx.close();`));
test('wrong profile refuses before source or child effects',()=>fixture(`const n=ports.length;await rejected(()=>prepare());
  assert.equal(ports.length,n);assert.equal(commands.length,0);`,{profile:false}));
test('cwd and compiler environment cannot select providers',()=>fixture(`const ctx=await prepare();assert.equal(commands[3].command,providers.clang);ctx.close();`,{
  preimport:`process.chdir('/');process.env.CC='/invalid';process.env.SDKROOT='/invalid';process.env.TMPDIR='/invalid';`}));
for(const kind of ['dirty','nonmain','stale'])test(kind+' source prevents bootstrap',()=>fixture(`await rejected(()=>prepare());
  assert.equal(commands.length,0);assert.equal(fs.existsSync(root+'/.setfarm'),false);`,{before:kind==='dirty'?
  `fs.appendFileSync(root+'/scripts/dashboard-cutover-mach-peer-v2.c','dirty');`:
  kind==='nonmain'?`cp.execFileSync('/usr/bin/git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','checkout','-qb','not-main'],
    {cwd:root,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',
      GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});`:
  `fs.chmodSync(root+'/dist/BUILD_INFO.json',0o600);fs.appendFileSync(root+'/dist/BUILD_INFO.json',' ');`}));
for(const kind of ['unsafe','alias','collision'])test('preexisting '+kind+' is preserved and not adopted',()=>fixture(`
  await rejected(()=>prepare());assert.equal(commands.length,${kind==='collision'?3:kind==='alias'?0:1});
  assert.equal(commands.some(x=>x.command===providers.nm),false);assert.equal(fs.existsSync(root+'/.setfarm'),true);
  assert.equal(effects.some(x=>['unlinkSync','rmSync','rmdirSync','renameSync','chmodSync'].includes(x.n)),false);`,{
  before:kind==='unsafe'?`fs.mkdirSync(root+'/.setfarm',{mode:0o755});effects.length=0;`:
    kind==='alias'?`fs.symlinkSync('/private/tmp',root+'/.setfarm');effects.length=0;`:
    `fs.mkdirSync(generation,{recursive:true,mode:0o700});fs.writeFileSync(generation+'/preserved','collision');effects.length=0;`}));
for(const kind of ['subtype','ncmds','size','alignment','traversal'])test('Mach-O '+kind+' rejected before inspection',()=>fixture(`
  await rejected(()=>prepare());assert.equal(commands.length,4);assert.equal(fs.existsSync(generation+'/peer.node'),true);
  assert.equal(fs.existsSync(generation+'/manifest.json'),false);`,{setup:{subtype:`bundle.writeUInt32LE(2,8);`,
    ncmds:`bundle.writeUInt32LE(129,16);`,size:`bundle.writeUInt32LE(65536,20);`,alignment:`bundle.writeUInt32LE(9,36);`,
    traversal:`bundle.writeUInt32LE(16,20);bundle=Buffer.concat([bundle,Buffer.alloc(8)]);`}[kind]}));
for(const kind of ['graph','imports','exports','dependencies','temp'])test('unexpected '+kind+' burns without publication or retry',()=>fixture(`
  await rejected(()=>prepare());assert.equal(commands.length,${({graph:4,imports:5,exports:6,dependencies:7,temp:4})[kind]});
  assert.equal(fs.existsSync(generation+'/manifest.json'),false);const n=ports.length;await rejected(()=>prepare());assert.equal(ports.length,n);`,{
    setup:{graph:`compileGraph=()=> 'setfarm-cutover-inputs: '+headerPaths[0]+'\\n';`,
      imports:`imports.push('_foreign_import');`,exports:`exports.push('_foreign_export');`,
      dependencies:`dylibText=()=>generation+'/peer.node:\\n\\t/usr/lib/foreign.dylib (compatibility version 1.0.0, current version 1.0.0)\\n';`,
      temp:`onFinish=n=>{if(n===4)fs.writeFileSync(generation+'/provider-tmp/unknown','retain')};`}[kind]}));
for(const ordinal of [1,4,5])test('unknown child '+ordinal+' retains artifacts and admits no later child',()=>fixture(`
  await rejected(()=>prepare());assert.equal(commands.length,${ordinal});assert.equal(commands.at(-1).closed,false);
  const n=ports.length;await rejected(()=>prepare());assert.equal(ports.length,n);assert.equal(effects.some(x=>['unlinkSync','rmSync','rmdirSync'].includes(x.n)),false);`,{
  setup:`outcome=n=>n===${ordinal}?{error:true}:{code:0,signal:null,stderr:''};`}));
test('swallowed active prepare reentry burns before original stdin write',()=>fixture(`await rejected(()=>prepare());await nested;
  assert.equal(commands.length,1);assert.equal(Buffer.concat(commands[0].source).length,0);`,{
  setup:`let nested;onSpawn=()=>{nested=rejected(()=>prepare())};`}));
for(const kind of ['bundle','manifest','link','header'])test('terminal '+kind+' ABA burns retained context',()=>fixture(`
  const ctx=await prepare(),p=${({bundle:"generation+'/peer.node'",manifest:"generation+'/manifest.json'",
    link:"providers.clt+'/usr/lib/libtapi.dylib'",header:"providers.resource+'/include/stdint.h'"})[kind]};
  fs.renameSync(p,p+'.original');fs.renameSync(p+'.original',p);refused(()=>ctx.recheck());const n=commands.length;
  refused(()=>ctx.recheck());assert.equal(commands.length,n);ctx.close();`));
for(const protocol of [2,4])test((protocol===4?'V4 close loss: ':'')+'once-close unknown does not close reused number or later originals',()=>fixture(`const ctx=await prepare();
  let replacement;closes.length=0;fs.closeSync=fd=>{closes.push(fd);close(fd);replacement=open(providers.node,'r');
    assert.equal(replacement,fd);throw Error('unknown close')};syncBuiltinESMExports();refused(()=>ctx.close());
  assert.equal(closes.length,1);ctx.close();assert.equal(closes.length,1);fs.fstatSync(replacement);close(replacement);`,{protocol}));

test('source drift during Git settlement refuses before bootstrap',()=>fixture(`await rejected(()=>prepare());
  assert.equal(commands.length,1);assert.equal(fs.existsSync(root+'/.setfarm'),false);`,{
  setup:`onFinish=n=>{if(n===1)fs.appendFileSync(root+'/scripts/dashboard-cutover-mach-peer-v2.c','drift')};`}));
test('safe-looking bootstrap parent replacement during header discovery is not adopted',()=>fixture(`await rejected(()=>prepare());
  assert.equal(fs.existsSync(generation),false);assert.equal(fs.existsSync(root+'/.setfarm/original-parent'),true);
  assert.equal(commands.some(x=>x.command===providers.clang&&!x.args.includes('-M')),false);`,{
  setup:`onFinish=n=>{if(n===2){fs.renameSync(root+'/.setfarm/dashboard-cutover-native-v2',root+'/.setfarm/original-parent');
    fs.mkdirSync(root+'/.setfarm/dashboard-cutover-native-v2',{mode:0o700})}};`}));
test('exact bare dyld_stub_binder is admitted without admitting arbitrary bare imports',()=>fixture(`
  const ctx=await prepare();const m=JSON.parse(fs.readFileSync(generation+'/manifest.json'));
  assert.ok(m.imports.includes('dyld_stub_binder'));ctx.close();`,{setup:`imports.push('dyld_stub_binder');`}));
for(const name of ['arbitrary_bare','_dyld_stub_binder'])test('unlisted '+name+' import is refused',()=>fixture(`
  await rejected(()=>prepare());assert.equal(commands.length,5);assert.equal(fs.existsSync(generation+'/manifest.json'),false);`,{
    setup:`imports.push(${JSON.stringify(name)});`}));

for(const kind of ['mode','hardlink','alias','foreignOwner','oversize'])test('physical link '+kind+' refuses before compile',()=>fixture(`
  await rejected(()=>prepare());assert.equal(commands.length,3);assert.equal(fs.existsSync(generation),false);
  assert.equal(opens.some(x=>x.p===providers.clt+'/usr/lib/libtapi.dylib'),false);`,{
    before:kind==='mode'?`fs.chmodSync(providers.clt+'/usr/lib/libtapi.dylib',0o777);`:
      kind==='hardlink'?`fs.linkSync(providers.clt+'/usr/lib/libtapi.dylib',providers.clt+'/usr/lib/duplicate');`:
      kind==='alias'?`fs.renameSync(providers.clt+'/usr/lib/libtapi.dylib',providers.clt+'/usr/lib/original');
        fs.symlinkSync('original',providers.clt+'/usr/lib/libtapi.dylib');`:'',
    setup:['foreignOwner','oversize'].includes(kind)?`const stat=fs.lstatSync;
      fs.lstatSync=(p,...a)=>{const s=stat(p,...a);if(String(p)===providers.clt+'/usr/lib/libtapi.dylib')
        ${kind==='foreignOwner'?'s.uid=99999n':'s.size=536870913n'};return s};`:''}));
for(const kind of ['bundleSize','depfileSize','outputMode','outputAlias','outputHardlink'])test('compile '+kind+' output rejected before inspection',()=>fixture(`
  await rejected(()=>prepare());assert.equal(commands.length,4);assert.equal(fs.existsSync(generation+'/manifest.json'),false);
  assert.equal(opens.some(x=>x.p===generation+'/${kind==='depfileSize'?'inputs.d':'peer.node'}'&&typeof x.flags==='number'&&(x.flags&3)===0),false);`,{
    setup:kind==='bundleSize'?`bundle=Buffer.concat([mach(),Buffer.alloc(4194305-40)]);`:
      kind==='depfileSize'?`compileGraph=()=>deps().slice(0,-1)+' '.repeat(262144)+'\\n';`:
      `const originalWrite=fs.writeFileSync;fs.writeFileSync=(p,...a)=>{const r=originalWrite(p,...a);if(p===generation+'/peer.node'){
        ${kind==='outputMode'?`fs.chmodSync(p,0o777);`:kind==='outputAlias'?`fs.renameSync(p,root+'.output-original');fs.symlinkSync(root+'.output-original',p);`:
          `fs.linkSync(p,root+'.output-link');`}}
        return r};`}));

for(const kind of ['nonzero','stderr','stdoutOverflow','stderrOverflow','signal','stdinCallback','noClose','noEOF'])
  test('compile original '+kind+' burns before inspection without cancellation',()=>fixture(`await rejected(()=>prepare());
    assert.equal(commands.length,4);assert.equal(commands[3].closed,${['stdoutOverflow','stderrOverflow','stdinCallback','noClose'].includes(kind)?'false':'true'});
    ${kind==='stderrOverflow'||kind==='stdoutOverflow'?`assert.equal(watchdogFired,false);`:''}
    assert.equal(fs.existsSync(generation+'/manifest.json'),false);const n=ports.length;await rejected(()=>prepare());assert.equal(ports.length,n);`,{
    setup:`let watchdogFired=false;const timeout=globalThis.setTimeout;
      globalThis.setTimeout=(f,ms,...a)=>timeout(()=>{if(ms===30000)watchdogFired=true;f()},ms===30000?50:ms,...a);
      ${kind==='nonzero'?`outcome=n=>({code:n===4?1:0,signal:null,stderr:''});`:
        kind==='stderr'?`outcome=n=>({code:0,signal:null,stderr:n===4?'secret failure':''});`:
        kind==='stdoutOverflow'?`outcome=n=>({code:0,signal:null,stderr:'',stdout:n===4?Buffer.alloc(262145,32):undefined,noClose:n===4});`:
        kind==='stderrOverflow'?`outcome=n=>({code:0,signal:null,stderr:n===4?Buffer.alloc(65537,32):'',noClose:n===4});`:
        kind==='signal'?`outcome=n=>({code:n===4?null:0,signal:n===4?'SIGTERM':null,stderr:''});`:
        kind==='noClose'?`outcome=n=>({code:0,signal:null,stderr:'',noClose:n===4});`:
        `const originalSpawn=cp.spawn;cp.spawn=(...a)=>{const c=originalSpawn(...a);if(commands.length===4){
          ${kind==='stdinCallback'?`c.stdin.end=(b,cb)=>{cb(Error('unknown write'));return c.stdin};`:
            `c.stdout.end=()=>c.stdout;`}}return c};`}`
  }));
for(const kind of ['partialWrite','fsync','fchmod','fsyncReentry'])test('publication '+kind+' retains original partials and never retries',()=>fixture(`
  await rejected(()=>prepare());assert.equal(commands.length,7);assert.equal(fs.existsSync(generation+'/manifest.json'),true);
  assert.equal(attempts,1);assert.equal(effects.some(x=>['unlinkSync','rmSync','rmdirSync','renameSync'].includes(x.n)),false);
  const n=ports.length;await rejected(()=>prepare());assert.equal(ports.length,n);${kind==='fsyncReentry'?'await nested;':''}`,{
    setup:`let attempts=0,nested;
      ${kind==='partialWrite'?`fs.writeSync=(fd,b,o,l,p)=>{if(fdPaths.get(fd)===generation+'/manifest.json'){
        attempts++;return write(fd,b,o,l-1,p)}return write(fd,b,o,l,p)};`:
        kind==='fchmod'?`fs.fchmodSync=()=>{attempts++;throw Error('unknown chmod')};`:
        `const sync=fs.fsyncSync;fs.fsyncSync=fd=>{attempts++;${kind==='fsync'?`throw Error('unknown fsync');`:
          `const r=sync(fd);nested=rejected(()=>prepare());return r;`}};`}`
  }));
test('active terminal recheck reentry prevents later reads but permits later idle original disposal',()=>fixture(`
  const ctx=await prepare();let armed=true,later=0;fs.readSync=(fd,...a)=>{const r=read(fd,...a);
    if(armed&&fdPaths.get(fd)===generation+'/peer.node'){armed=false;refused(()=>ctx.close())}else if(!armed)later++;return r};
  syncBuiltinESMExports();refused(()=>ctx.recheck());assert.equal(later,0);ctx.close();`));
test('already-burned close reentry consumes only its first original descriptor',()=>fixture(`const ctx=await prepare();
  fs.renameSync(generation+'/peer.node',generation+'/peer.node.saved');refused(()=>ctx.recheck());let nested=0;closes.length=0;
  fs.closeSync=fd=>{closes.push(fd);close(fd);if(!nested){nested++;refused(()=>ctx.close())}};syncBuiltinESMExports();
  refused(()=>ctx.close());assert.equal(closes.length,1);ctx.close();assert.equal(closes.length,1);`));
for(const protocol of [2,4])test((protocol===4?'V4 close loss: ':'')+'externally consumed terminal descriptor is never closed after number reuse',()=>fixture(`const ctx=await prepare();
  const row=opens.findLast(x=>x.p===generation+'/manifest.json');close(row.fd);const replacement=open(providers.node,'r');
  assert.equal(replacement,row.fd);refused(()=>ctx.recheck());closes.length=0;refused(()=>ctx.close());assert.equal(closes.length,0);
  fs.fstatSync(replacement);ctx.close();assert.equal(closes.length,0);close(replacement);`,{protocol}));
test('idle terminal method arity admits zero ports without revoking custody',()=>fixture(`const ctx=await prepare(),n=ports.length;
  refused(()=>ctx.recheck(undefined));refused(()=>ctx.close(undefined));assert.equal(ports.length,n);ctx.recheck();ctx.close();`));
test('bounded manifest refuses before opening its output occurrence',()=>fixture(`await rejected(()=>prepare());
  assert.equal(commands.length,7);assert.equal(opens.some(x=>x.p===generation+'/manifest.json'),false);
  assert.equal(fs.existsSync(generation+'/manifest.json'),false);`,{
  before:`const p=providers.headers+'/manifest-budget';fs.mkdirSync(p,{mode:0o700});
    for(let i=0;i<360;i++){const h=p+'/'+'header-'.padEnd(210,'h')+i+'.h';fs.writeFileSync(h,'header',{flag:'wx',mode:0o600});headerPaths.push(h)};`}));

test('separate original link FD budget refuses its 129th admission without draining held originals',()=>fixture(`
  await rejected(()=>prepare());assert.equal(commands.length,3);assert.equal(admissions.length,128);assert.equal(disposals.length,0);`,{
  sdkDepth:105,setup:`const admissions=[],disposals=[],originalOpen=fs.openSync,originalClose=fs.closeSync,ownNumbers=new Set();
    fs.openSync=(p,...a)=>{const caller=Error().stack.split('\\n')[2],fd=originalOpen(p,...a);
      if(caller.includes('at openOriginal')&&caller.includes('dashboard-cutover-native-sidecar-v2.mjs')){
        admissions.push({p,fd});ownNumbers.add(fd)}return fd};
    fs.closeSync=fd=>{if(ownNumbers.has(fd))disposals.push(fd);return originalClose(fd)};`}));
test('aggregate link budget refuses before third original after exactly one GiB of bounded reads',()=>fixture(`
  await rejected(()=>prepare());assert.equal(commands.length,3);assert.equal(readBytes,1073741824);
  assert.equal(opens.some(x=>x.p===providers.clt+'/usr/lib/libLTO.dylib'),false);`,{
  setup:`let readBytes=0;const stat=fs.lstatSync,fstat=fs.fstatSync;
    const sized=p=>p===providers.clt+'/usr/lib/libtapi.dylib'||p===providers.clt+'/usr/lib/libcodedirectory.dylib';
    fs.lstatSync=(p,...a)=>{const s=stat(p,...a);if(sized(String(p)))s.size=536870912n;return s};
    fs.fstatSync=(fd,...a)=>{const s=fstat(fd,...a);if(sized(fdPaths.get(fd)))s.size=536870912n;return s};
    fs.readSync=(fd,b,o,l,p)=>{if(sized(fdPaths.get(fd))){assert.ok(l<=65536);b.fill(0,o,o+l);readBytes+=l;return l}return read(fd,b,o,l,p)};`}));
test('fixed Mach-O undefined-symbol inspection accepts exact name-only provider output',()=>fixture(`const ctx=await prepare();
  assert.equal(commands[4].command,providers.nm);assert.deepEqual(commands[4].args,['-u',generation+'/peer.node']);ctx.close();`,{
  setup:`importText=()=>imports.join('\\n')+'\\n';`}));
test('actual reviewed fixed recipe creates one inspected sidecar without evaluation or startup',{
  skip:process.env.SETFARM_DASHBOARD_SIDECAR_TEST!=='1'},()=>{
  const {root}=fixture(`const ctx=await prepare();assert.equal(commands.length,7);assert.equal(ctx.observation.authority,'native-sidecar-build-only');
    const manifest=JSON.parse(fs.readFileSync(generation+'/manifest.json'));assert.equal(manifest.sourceBuild.sha,expected.sourceSha);
    assert.equal(manifest.sourceBuild.treeHash,expected.sourceTreeHash);assert.equal(manifest.sourceBuild.buildHash,expected.buildHash);
    assert.equal(manifest.source.sha256,sourceHash);assert.equal(manifest.source.byteLength,sourceLength);assert.ok(manifest.headers.length>200);
    for(const p of [...manifest.linkInputs,...manifest.headers,...manifest.directInputs]){const b=fs.readFileSync(p.physicalLocator??p.locator);
      assert.equal(p.byteLength,b.length);assert.equal(p.sha256,digest(b));}
    for(const r of commands){assert.equal(r.intentRecorded,true);assert.equal(r.closed,true);assert.equal(r.code,0);assert.equal(r.signal,null);
      assert.equal(r.error,null);assert.equal(r.truncated,false);assert.equal(r.stderrLength,0);
      for(const e of ['stdin:finish','stdin:close','stdout:end','stdout:close','stderr:end','stderr:close'])assert.ok(r.events.includes(e));}
    assert.equal(digest(Buffer.concat(commands[3].source)),sourceHash);assert.equal(Buffer.concat(commands[3].source).length,sourceLength);
    assert.deepEqual(fs.readdirSync(generation).sort(),['inputs.d','manifest.json','peer.node','provider-tmp']);assert.deepEqual(fs.readdirSync(generation+'/provider-tmp'),[]);
    for(const [role,n] of [['bundle','peer.node'],['depfile','inputs.d']]){const b=fs.readFileSync(generation+'/'+n);
      assert.equal(manifest.outputs[role].byteLength,b.length);assert.equal(manifest.outputs[role].sha256,digest(b));
      assert.equal(fs.statSync(generation+'/'+n).mode&0o777,0o444);}
    await Promise.resolve();ctx.recheck();ctx.close();assert.equal(opens.length,closes.length);
    console.log(JSON.stringify({kind:'actual-native-sidecar-build',observation:ctx.observation,manifest}));`,{actual:true});
  console.log(JSON.stringify({kind:'actual-native-sidecar-originals',root,result:root+'.sidecar-result.json'}));
});
