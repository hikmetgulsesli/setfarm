import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {canonical,createFinalizedFixture,file,git,hash} from './helpers/dashboard-cutover-finalized-fixture-v2.js';

const sourceRoot=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const fixedNode='/opt/homebrew/Cellar/node/26.4.0/bin/node';
const fixedProviders={node:fixedNode,clang:'/Library/Developer/CommandLineTools/usr/bin/clang',
  ld:'/Library/Developer/CommandLineTools/usr/bin/ld',nm:'/Library/Developer/CommandLineTools/usr/bin/llvm-nm',
  otool:'/Library/Developer/CommandLineTools/usr/bin/llvm-otool',headers:'/opt/homebrew/Cellar/node/26.4.0/include/node',
  sdk:'/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk',resource:'/Library/Developer/CommandLineTools/usr/lib/clang/21',
  clt:'/Library/Developer/CommandLineTools'};
const ts=createRequire(import.meta.url)('typescript');
const scripts=['dashboard-cutover-native-sidecar-v2.mjs','dashboard-cutover-native-build-inputs-v2.mjs',
  'dashboard-cutover-native-inputs-v2.mjs','build-generation-retention.mjs',
  'dashboard-cutover-mach-peer-v2.c','dashboard-cutover-mach-job-peer-v4.c'];
const translations=[
  ['src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts',
    'dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js'],
  ['src/internal-production/baseline-deployment-cutover-node-path-v1.ts',
    'dist/internal-production/baseline-deployment-cutover-node-path-v1.js'],
  ['src/internal-production/baseline-deployment-cutover-process-observation-v1.ts',
    'dist/internal-production/baseline-deployment-cutover-process-observation-v1.js'],
  ['src/product-compiler/canonical-json.ts','dist/product-compiler/canonical-json.js'],
];

// LOCAL finite source-only bridge. This does NOT run the production compiler or
// confer clean-main/native/executing-image authority. Shared fixture unchanged.
function jointFixture(resources=false,pre32=false,bounded=false){
  const bridgeList=pre32?[...translations,
    ['src/internal-production/baseline-legacy-database-census-v1.ts',
      'dist/internal-production/baseline-legacy-database-census-v1.js']]:translations;
  const files=Object.fromEntries(scripts.map(n=>['scripts/'+n,fs.readFileSync(sourceRoot+'/scripts/'+n)]));
  for(const [source] of bridgeList)files[source]=fs.readFileSync(sourceRoot+'/'+source);
  for(const n of ['deployment-dashboard-cutover-adapter-v2.mjs','deployment-dashboard-cutover-adapter-v2.d.mts']){
    const p=sourceRoot+'/scripts/'+n;if(fs.existsSync(p))files['scripts/'+n]=fs.readFileSync(p);
  }
  let providers=null,home=null;
  if(resources){
    const providerRoot=fs.realpathSync(fs.mkdtempSync('/private/tmp/setfarm-joint-providers-v4.'));
    fs.chmodSync(providerRoot,0o700);
    providers=Object.fromEntries(Object.entries(fixedProviders).map(([k,p])=>[k,providerRoot+p]));
    for(const key of ['node','clang','ld','nm','otool'])file(providerRoot,path.relative(providerRoot,providers[key]),'inert '+key+'\n',0o755);
    for(const n of ['node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h'])
      file(providerRoot,path.relative(providerRoot,providers.headers+'/'+n),'inert public '+n+'\n');
    for(const [p,b] of [[providers.resource+'/include/stdint.h','resource\n'],[providers.sdk+'/usr/include/bootstrap.h','bootstrap\n']])
      file(providerRoot,path.relative(providerRoot,p),b);
    fs.mkdirSync(providers.sdk+'/usr/include/servers',{mode:0o700});
    fs.symlinkSync('../bootstrap.h',providers.sdk+'/usr/include/servers/bootstrap.h');
    fs.mkdirSync(providers.sdk+'/System/Library/Frameworks',{recursive:true,mode:0o700});
    for(const p of [providers.clt+'/usr/lib/libtapi.dylib',providers.clt+'/usr/lib/libcodedirectory.dylib',
      providers.clt+'/usr/lib/libLTO.dylib',providers.clt+'/usr/lib/libswiftDemangle.dylib',
      providers.sdk+'/usr/lib/libSystem.B.tbd',providers.sdk+'/usr/lib/libbsm.0.tbd'])
      file(providerRoot,path.relative(providerRoot,p),'inert '+path.basename(p)+'\n');
    for(const n of scripts.filter(n=>n.startsWith('dashboard-cutover-native-'))){
      let text=files['scripts/'+n].toString();
      for(const [k,p] of Object.entries(fixedProviders))text=text.replaceAll("'"+p+"'","'"+providers[k]+"'");
      files['scripts/'+n]=Buffer.from(text);
    }
    home=fs.realpathSync(fs.mkdtempSync('/private/tmp/setfarm-joint-launcher-v4.'));fs.chmodSync(home,0o700);
    fs.mkdirSync(home+'/Library/LaunchAgents',{recursive:true,mode:0o700});
    fs.mkdirSync(home+'/ai/setrox/data/internal-production-baseline',{recursive:true,mode:0o700});
  }
  const {root}=createFinalizedFixture(files),bridges=[];
  const initialOutputs=['dist/cli/cli.js','dist/server/daemon.js','dist/service.js','dist/spawner.js',
    'dist/BUILD_INFO.json','dist/PLATFORM_BUILD_OUTPUT_TREE.json','dist/PLATFORM_RELEASE_MANIFEST.json'];
  const initial=Object.fromEntries(initialOutputs.map(p=>[p,{bytes:fs.readFileSync(root+'/'+p),mode:fs.statSync(root+'/'+p).mode&0o777}]));
  fs.renameSync(root+'/dist',root+'.initial-finalized-dist');
  for(const [p,r] of Object.entries(initial))if(p!=='dist/PLATFORM_BUILD_OUTPUT_TREE.json')file(root,p,r.bytes,r.mode);
  for(const [source,output] of bridgeList){
    const original=files[source],translated=ts.transpileModule(original.toString(),{
      fileName:source,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
    });
    assert.deepEqual(translated.diagnostics??[],[],'finite TS translation must be syntactically valid');
    const bytes=Buffer.from(translated.outputText);file(root,output,bytes);
    bridges.push({source,output,sourceHash:hash(original),outputHash:hash(bytes),url:'file://'+root+'/'+output});
  }
  const prior=JSON.parse(initial['dist/PLATFORM_BUILD_OUTPUT_TREE.json'].bytes);
  const entries=[...prior.entries,...bridges.map(b=>{
    const bytes=fs.readFileSync(root+'/'+b.output);return {locator:b.output,mode:0o644,byteLength:bytes.length,sha256:hash(bytes)};
  })].sort((a,b)=>Buffer.compare(Buffer.from(a.locator),Buffer.from(b.locator)));
  const projection={schema:prior.schema,sourceSha:prior.sourceSha,sourceTreeHash:prior.sourceTreeHash,entries};
  const outputTreeHash=hash(canonical(projection));
  file(root,'dist/PLATFORM_BUILD_OUTPUT_TREE.json',JSON.stringify({...projection,outputTreeHash})+'\n',0o444);
  for(const p of ['dist','dist/cli','dist/server','dist/internal-production','dist/product-compiler'])fs.chmodSync(root+'/'+p,0o755);
  const pins=Object.fromEntries(Object.entries(files).map(([p,b])=>[p,hash(b)]));
  return {root,bridges,pins,providers,home,pre32,bounded,sourceSha:git(root,['rev-parse','HEAD']),outputTreeHash};
}

function resourceProgram(fixture){return `
  import os from 'node:os';import moduleBuiltin from 'node:module';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
  const providers=${JSON.stringify(fixture.providers)},home=${JSON.stringify(fixture.home)};
  Object.defineProperties(process,{platform:{value:'darwin'},arch:{value:'arm64'},version:{value:'v26.4.0'},execPath:{value:providers.node}});
  const account=os.userInfo();os.userInfo=()=>({...account,homedir:home});
  const labels=['com.setrox.setfarm-spawner','com.setrox.setfarm-dashboard'];
  const definitions=labels.map((Label,i)=>({Label,ProgramArguments:[home+'/.local/bin/setfarm',...(i?['dashboard','start','--port','3333']:['spawner','start'])],
    EnvironmentVariables:{PATH:'/usr/local/bin:/usr/bin:/bin',SETFARM_PG_URL:'postgresql://FIXTURE_ONLY@localhost/setfarm',
      ...(i?{SETFARM_OPERATIONAL_WRITE_TOKEN:'FIXTURE_ONLY'}:{})},RunAtLoad:true,StartInterval:60,
    StandardOutPath:home+'/.openclaw/logs/'+(i?'setfarm-dashboard.watch':'setfarm-spawner.watch')+'.log',
    StandardErrorPath:home+'/.openclaw/logs/'+(i?'setfarm-dashboard.watch':'setfarm-spawner.watch')+'.err.log'}));
  for(const [i,label] of labels.entries())fs.writeFileSync(home+'/Library/LaunchAgents/'+label+'.plist',JSON.stringify(definitions[i]),{flag:'wx',mode:0o600});
  const block=(name,lines)=>'\\t'+name+' = {\\n'+lines.map(line=>'\\t\\t'+line+'\\n').join('')+'\\t}\\n';
  const launcherText=i=>'gui/'+process.getuid()+'/'+labels[i]+' = {\\n\\tpath = '+home+'/Library/LaunchAgents/'+labels[i]+'.plist\\n'+
    '\\tprogram = '+definitions[i].ProgramArguments[0]+'\\n\\tstate = not running\\n\\tactive count = 0\\n\\ttype = LaunchAgent\\n\\trun interval = 60 seconds\\n\\tproperties = runatload\\n'+
    block('arguments',definitions[i].ProgramArguments)+block('environment',Object.entries({...definitions[i].EnvironmentVariables,OSLogRateLimit:'64',XPC_SERVICE_NAME:labels[i]}).map(([k,v])=>k+' => '+v))+
    block('inherited environment',['SSH_AUTH_SOCK => /var/run/com.apple.launchd.Fixture/Listeners'])+
    block('default environment',['PATH => /usr/bin:/bin:/usr/sbin:/sbin'])+'}\\n';
  const nativeSpawnSync=cp.spawnSync;
  cp.spawnSync=(command,args,options)=>{
    if(command==='/usr/bin/git')return nativeSpawnSync(command,args,options);
    if(command==='/bin/launchctl'){
      assert.equal(args[0],'print');const i=labels.findIndex(l=>args[1]==='gui/'+process.getuid()+'/'+l);assert.ok(i>=0);
      out.launcherPrints=(out.launcherPrints??0)+1;return {status:0,signal:null,stdout:Buffer.from(launcherText(i)),stderr:Buffer.alloc(0)};
    }
    assert.equal(command,'/usr/bin/plutil');assert.deepEqual(args,['-convert','json','-o','-','-']);
    return nativeSpawnSync(command,args,options);
  };
  const headerPaths=[providers.headers+'/node_api.h',providers.resource+'/include/stdint.h',providers.sdk+'/usr/include/servers/bootstrap.h'];
  const deps=()=> 'setfarm-cutover-inputs: - '+headerPaths.join(' ')+'\\n';
  const napi=['create_buffer_copy','define_properties','create_object','create_uint32','get_cb_info','get_typedarray_info',
    'is_typedarray','is_arraybuffer','is_detached_arraybuffer','object_freeze','throw_error','is_exception_pending','get_and_clear_last_exception'];
  const imports=napi.map(n=>'_napi_'+n).concat(['_mach_msg','_audit_token_to_pid','_bootstrap_port']);
  const exports=['_napi_register_module_v1','_node_api_module_get_api_version_v1'];
  function mach(){const b=Buffer.alloc(40);b.writeUInt32LE(0xfeedfacf,0);b.writeUInt32LE(0x0100000c,4);b.writeUInt32LE(8,12);
    b.writeUInt32LE(1,16);b.writeUInt32LE(8,20);b.writeUInt32LE(0x1b,32);b.writeUInt32LE(8,36);return b}
  cp.spawn=(command,args,options)=>{
    assert.ok(['/usr/bin/git',providers.clang,providers.nm,providers.otool].includes(command));
    const row={command,args,options,source:[],stdout:[],stderr:[],events:[],closed:false};out.commands.push(row);
    const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
    child.kill=()=>{throw Error('FORBIDDEN_KILL')};
    for(const [name,stream] of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]]){
      for(const e of ['finish','end','close'])stream.on(e,()=>row.events.push(name+':'+e));
      stream.on('data',b=>row[name==='stdin'?'source':name].push(Buffer.from(b).toString('base64')));
    }
    child.stdin.resume();child.stdin.on('finish',()=>setImmediate(()=>{
      let text='';
      if(command===providers.clang&&args.includes('-M'))text=deps();
      else if(command===providers.clang){const output=args[args.indexOf('-o')+1],generation=path.dirname(output);
        fs.writeFileSync(output,mach(),{flag:'wx',mode:0o600});fs.writeFileSync(generation+'/inputs.d',deps(),{flag:'wx',mode:0o600})}
      else if(command===providers.nm)text=(args[0]==='-u'?imports:exports.map((n,i)=>'000000000000'+i+'000 T '+n)).join('\\n')+'\\n';
      else if(command===providers.otool)text=args[1]+':\\n\\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1351.0.0)\\n'+
        '\\t/usr/lib/libbsm.0.dylib (compatibility version 1.0.0, current version 1.0.0)\\n';
      child.stdout.end(text);child.stderr.end('');setImmediate(()=>{row.closed=true;row.code=0;row.signal=null;child.emit('close',0,null)});
    }));return child;
  };
  const methodNames=['receiveControllerHelloV4','challengeControllerAndReceiveAckV4','sendControllerGrantV4','helloClientAndReceiveChallengeV4','ackClientAndReceiveGrantV4'];
  const loadedExports=Object.freeze(Object.fromEntries(methodNames.map(n=>[n,()=>{out.nativeCalls++;throw Error('FORBIDDEN_NATIVE_METHOD')}])));
  const loaderCache=Object.create(null);let loadCalls=0;
  const loader=p=>{assert.ok(p.startsWith(root+'/.setfarm/dashboard-cutover-native-v4/')&&p.endsWith('/peer.node'));
    loadCalls++;loaderCache[p]={id:p,filename:p,loaded:true,exports:loadedExports};return loadedExports};loader.cache=loaderCache;
  moduleBuiltin.createRequire=url=>{assert.equal(url,'file://'+root+'/scripts/dashboard-cutover-native-sidecar-v2.mjs');return loader};
  const originalOpen=fs.openSync,originalClose=fs.closeSync,fdPaths=new Map();let onPort=()=>{};
  fs.openSync=(p,...args)=>{const fd=originalOpen(p,...args);fdPaths.set(fd,String(p));return fd};
  for(const name of ['fstatSync','lstatSync','readSync','closeSync']){const original=fs[name];fs[name]=(...args)=>{
    const stack=Error().stack,frames=stack.split('\\n'),direct=(frames[3]??'').includes('at port ');
    const owner=direct&&(frames[2]??'').includes('dashboard-cutover-native-sidecar-v2.mjs')?'native':
      direct&&(frames[2]??'').includes('baseline-deployment-cutover-launcher-observation-v1.js')?'definition':'composite';
    const row={name,owner,scopeEnrollment:stack.includes('at enroll '),
      scopePass:!stack.includes('at enroll ')&&(stack.includes('assertHeldDashboardCutoverLoadedJobOperationV4')||
      stack.includes('assertHeldDashboardCutoverApprovedDefinitionOperationV4')),path:typeof args[0]==='number'?fdPaths.get(args[0]):String(args[0])};
    ${fixture.bounded?`row.fd=typeof args[0]==='number'?args[0]:null;
    out.portCounts??={};const key=owner+':'+name;out.portCounts[key]=(out.portCounts[key]??0)+1;
    if(owner!=='composite'&&out.ports.length<32)out.ports.push(row);`:'out.ports.push(row);'}
    const result=original(...args);if(name==='readSync')row.result=result;
    ${fixture.bounded?"if(name==='closeSync')fdPaths.delete(args[0]);":''}
    onPort(row);return result;
  }}
  syncBuiltinESMExports();
`;}

async function exercise(body,{resources=false,pre32=false,bounded=pre32}={}){
  const fixture=jointFixture(resources,pre32,bounded),{root}=fixture;
  const program=`import assert from 'node:assert/strict';import fs from 'node:fs';
    import path from 'node:path';
    import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
    const root=${JSON.stringify(root)},out={actual:false,ports:[],commands:[],nativeCalls:0};
    ${resources?resourceProgram(fixture):''}
    for(const name of ${resources?"['exec','execSync','execFile','execFileSync','fork']":"['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']"})cp[name]=(...args)=>{
      out.commands.push({name,args});throw Error('FORBIDDEN_EXTERNAL_EFFECT')};
    syncBuiltinESMExports();
    try{${body};out.passed=true}catch(error){out.error=error.message;out.stack=error.stack;process.exitCode=1}
    fs.writeFileSync(root+'.joint-originals.json',JSON.stringify(out),{flag:'wx',mode:0o600});
    process.stdout.write(JSON.stringify(out));`;
  file(path.dirname(root),path.basename(root)+'.joint-intent.json',JSON.stringify({fixture,program,node:fixedNode}));
  const child=spawn(fixedNode,['--input-type=module','-e',program],{
    cwd:root,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},stdio:['ignore','pipe','pipe'],
  });
  let stdout='',stderr='',error=null;
  const eof={stdout:false,stderr:false},closed={stdout:false,stderr:false};
  child.on('error',e=>{error=e.message});
  for(const [name,stream] of [['stdout',child.stdout],['stderr',child.stderr]]){
    stream.on('error',e=>{error??=e.message});stream.on('end',()=>{eof[name]=true});
    stream.on('close',()=>{closed[name]=true});stream.on('data',b=>{if(name==='stdout')stdout+=b;else stderr+=b});
  }
  const [status,signal]=await new Promise(resolve=>child.on('close',(code,sig)=>resolve([code,sig])));
  file(path.dirname(root),path.basename(root)+'.joint-result.json',JSON.stringify({fixture,program,status,signal,error,eof,closed,stdout,stderr}));
  console.log(JSON.stringify({kind:'joint-source-only-case',root,status,signal,eof,closed}));
  assert.equal(error,null);assert.equal(signal,null);assert.deepEqual(eof,{stdout:true,stderr:true});
  assert.deepEqual(closed,{stdout:true,stderr:true});assert.equal(stderr,'');
  const original=JSON.parse(fs.readFileSync(root+'.joint-originals.json'));
  assert.equal(original.actual,false);if(!resources)assert.deepEqual(original.commands,[]);assert.equal(original.nativeCalls,0);
  assert.equal(status,0,original.stack);assert.equal(original.passed,true);
}

const participants=`
  const adapter=await import('./scripts/deployment-dashboard-cutover-adapter-v2.mjs');
  const native=await import('./scripts/dashboard-cutover-native-sidecar-v2.mjs');
  const definition=await import('./dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js');
  const material=definition.holdDashboardCutoverLauncherMaterialV2();
  const approved=definition.holdDashboardCutoverApprovedDefinitionV4(material);
  const lease=await native.holdDashboardCutoverNativeSidecarLeaseV4();
  const loaded=await native.holdDashboardCutoverLoadedJobPeerV4(lease);
`;

test('fixed joint original-operation qualifier is available before any participant acquisition',()=>exercise(`
  let adapter={};try{adapter=await import('./scripts/deployment-dashboard-cutover-adapter-v2.mjs')}
  catch(e){assert.equal(e.code,'ERR_MODULE_NOT_FOUND');assert.equal(fs.existsSync(root+'/scripts/deployment-dashboard-cutover-adapter-v2.mjs'),false)}
  assert.equal(typeof adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4,'function','MISSING_FIXED_JOINT_ORIGINAL_OPERATION');`));

test('native original-operation scope interfaces are available before resource acquisition',()=>exercise(`
  const native=await import('./scripts/dashboard-cutover-native-sidecar-v2.mjs');
  for(const name of ['beginHeldDashboardCutoverLoadedJobOperationV4','assertHeldDashboardCutoverLoadedJobOperationV4',
    'assertHeldDashboardCutoverLoadedJobOperationCacheV4','settleHeldDashboardCutoverLoadedJobOperationV4'])
    assert.equal(typeof native[name],'function','MISSING_NATIVE_JOINT_SCOPE_'+name);`));

test('compiled-path definition original-operation scope interfaces are available before acquisition',()=>exercise(`
  const definition=await import('./dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js');
  for(const name of ['beginHeldDashboardCutoverApprovedDefinitionOperationV4','assertHeldDashboardCutoverApprovedDefinitionOperationV4',
    'settleHeldDashboardCutoverApprovedDefinitionOperationV4'])assert.equal(typeof definition[name],'function','MISSING_DEFINITION_JOINT_SCOPE_'+name);`));

test('fixed joint qualifier checks genuine copied participant originals and releases both activities without effects',()=>exercise(`
  let adapter={};try{adapter=await import('./scripts/deployment-dashboard-cutover-adapter-v2.mjs')}
  catch(e){assert.equal(e.code,'ERR_MODULE_NOT_FOUND');assert.equal(fs.existsSync(root+'/scripts/deployment-dashboard-cutover-adapter-v2.mjs'),false)}
  assert.equal(typeof adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4,'function','MISSING_FIXED_JOINT_ORIGINAL_OPERATION');
  const native=await import('./scripts/dashboard-cutover-native-sidecar-v2.mjs');
  const definition=await import('./dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js');
  const material=definition.holdDashboardCutoverLauncherMaterialV2();
  const approved=definition.holdDashboardCutoverApprovedDefinitionV4(material);
  const lease=await native.holdDashboardCutoverNativeSidecarLeaseV4();
  const loaded=await native.holdDashboardCutoverLoadedJobPeerV4(lease);
  const commandCount=out.commands.length;assert.equal(commandCount,7);assert.equal(loadCalls,1);
  const result=await adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved);
  assert.equal(result,undefined);assert.equal(out.commands.length,commandCount);assert.equal(out.nativeCalls,0);
  native.assertHeldDashboardCutoverLoadedJobPeerV4(loaded);definition.assertHeldDashboardCutoverApprovedDefinitionV4(approved);
  definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved);native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);
  definition.closeHeldDashboardCutoverLauncherMaterialV2(material);
`,{resources:true}));

test('joint operation record construction cannot discard a swallowed preparation revocation',()=>exercise(`
  const adapter=await import('./scripts/deployment-dashboard-cutover-adapter-v2.mjs');
  const native=await import('./scripts/dashboard-cutover-native-sidecar-v2.mjs');
  const definition=await import('./dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js');
  const material=definition.holdDashboardCutoverLauncherMaterialV2();
  const approved=definition.holdDashboardCutoverApprovedDefinitionV4(material);
  const lease=await native.holdDashboardCutoverNativeSidecarLeaseV4();
  const loaded=await native.holdDashboardCutoverLoadedJobPeerV4(lease);
  const OriginalSet=globalThis.Set,originalCreate=Object.create;let nested,triggered=0,mints=0;
  globalThis.Set=function(...args){
    const caller=Error().stack.split('\\n')[2]??'';
    if(!triggered&&caller.includes('qualifyOriginals')&&caller.includes('deployment-dashboard-cutover-adapter-v2.mjs')){
      triggered++;nested=assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(),{message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
    }
    return new OriginalSet(...args);
  };
  Object.create=function(...args){
    const caller=Error().stack.split('\\n')[2]??'';
    if(triggered&&caller.includes('deployment-dashboard-cutover-adapter-v2.mjs'))mints++;
    return originalCreate(...args);
  };
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
    {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  await nested;assert.equal(triggered,1);assert.equal(mints,0);
`,{resources:true}));

test('terminal loaded cache drift in the last definition FD pass refuses joint success',()=>exercise(participants+`
  let definitionPasses=0;out.changed=false;
  onPort=row=>{
    if(row.owner==='definition'&&row.scopePass&&row.name==='readSync'&&row.result===0&&
      row.path.includes('/dashboard-cutover-approved-definitions-v4/')&&++definitionPasses===2){
      const keys=Object.keys(loaderCache);assert.equal(keys.length,1);loaderCache[keys[0]].loaded=false;out.changed=true;
    }
  };
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
    {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.equal(out.changed,true);assert.equal(definitionPasses,2);
`,{resources:true}));

for(const direction of ['native-to-definition','definition-to-native']){
  test('joint '+direction+' burn prevents the next opposite direct port and active disposal',()=>exercise(participants+`
    const direction=${JSON.stringify(direction)},outer=direction==='native-to-definition'?'definition':'native';
    let traps=0,triggered=0,at=-1;
    const proxy=new Proxy({},{get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
    onPort=row=>{
      if(!triggered&&row.owner===outer&&row.scopePass&&row.name==='readSync'){
        triggered++;at=out.ports.length;
        if(outer==='definition')assert.throws(()=>native.closeHeldDashboardCutoverLoadedJobPeerV4(proxy,{}),
          {message:'DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED'});
        else assert.throws(()=>definition.closeHeldDashboardCutoverApprovedDefinitionV4(proxy,{}),
          {message:'DASHBOARD_CUTOVER_APPROVED_DEFINITION_REFUSED'});
      }
    };
    await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
      {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
    assert.equal(triggered,1);assert.equal(traps,0);
    assert.deepEqual(out.ports.slice(at).filter(r=>r.owner==='native'||r.owner==='definition'||r.name==='closeSync'),[]);
    const commands=out.commands.length;
    await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
      {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
    assert.equal(out.commands.length,commands);assert.equal(out.nativeCalls,0);
  `,{resources:true}));
}

test('ordinary foreign participants preserve originals and do not consume the joint attempt',()=>exercise(participants+`
  const error={message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'};
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4({},approved),error);
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,{}),error);
  native.assertHeldDashboardCutoverLoadedJobPeerV4(loaded);definition.assertHeldDashboardCutoverApprovedDefinitionV4(approved);
  assert.equal(await adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),undefined);
  definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved);native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);
  definition.closeHeldDashboardCutoverLauncherMaterialV2(material);
`,{resources:true}));

test('lost second enrollment publication quarantines both original activities without disposal',()=>exercise(participants+`
  const freeze=Object.freeze;let unpublished,triggered=0;
  Object.freeze=function(value){
    const caller=Error().stack.split('\\n')[2]??'';
    if(caller.includes('beginHeldDashboardCutoverApprovedDefinitionOperationV4')){
      triggered++;unpublished=value;freeze(value);throw Error('ORIGINAL_SCOPE_SEAL_RESPONSE_LOSS');
    }
    return freeze(value);
  };
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
    {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.equal(triggered,1);assert.ok(unpublished);
  const at=out.ports.length;
  assert.throws(()=>definition.assertHeldDashboardCutoverApprovedDefinitionOperationV4(unpublished),
    {message:'DASHBOARD_CUTOVER_APPROVED_DEFINITION_REFUSED'});
  assert.throws(()=>native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded),{message:'DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED'});
  assert.throws(()=>definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved),{message:'DASHBOARD_CUTOVER_APPROVED_DEFINITION_REFUSED'});
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
    {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.equal(out.ports.length,at);assert.equal(out.nativeCalls,0);
`,{resources:true}));

test('live token stage inspection cannot swallow revocation and admit a direct native port',()=>exercise(participants+`
  const includes=Array.prototype.includes;let nested,triggered=0,at=-1;
  Array.prototype.includes=function(...args){
    const stack=Error().stack,caller=stack.split('\\n')[2]??'';
    if(!triggered&&caller.includes('liveToken')&&stack.includes('at port ')&&stack.includes('dashboard-cutover-native-sidecar-v2.mjs')){
      triggered++;at=out.ports.length;
      nested=assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(),
        {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
    }
    return includes.apply(this,args);
  };
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
    {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  await nested;assert.equal(triggered,1);
  assert.deepEqual(out.ports.slice(at).filter(r=>r.owner==='native'||r.owner==='definition'),[]);
`,{resources:true}));

test('unrecoverable first scope identity prevents admission of the second participant scope',()=>exercise(participants+`
  const set=WeakMap.prototype.set,create=Object.create;let lost=0,secondMints=0;
  WeakMap.prototype.set=function(...args){
    const caller=Error().stack.split('\\n')[2]??'';
    if(caller.includes('beginHeldDashboardCutoverLoadedJobOperationV4')){lost++;return this}
    return set.apply(this,args);
  };
  Object.create=function(...args){
    const caller=Error().stack.split('\\n')[2]??'';
    if(caller.includes('beginHeldDashboardCutoverApprovedDefinitionOperationV4'))secondMints++;
    return create.apply(this,args);
  };
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
    {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.equal(lost,1);assert.equal(secondMints,0);
  const at=out.ports.length;
  assert.throws(()=>native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded),{message:'DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED'});
  assert.equal(out.ports.length,at);
`,{resources:true}));

test('idle proxies foreign scopes and token copies cause zero traps or participant ports',()=>exercise(participants+`
  let traps=0;const proxy=new Proxy({},{get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
  const at=out.ports.length;
  for(const args of [[],[proxy],[proxy,proxy,{}],[proxy,approved],[loaded,proxy]])
    await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(...args),
      {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  for(const provider of [native,definition])for(const name of Object.keys(provider).filter(n=>
    n.includes('Operation')&&(n.startsWith('assertHeld')||n.startsWith('settleHeld')))){
    for(const args of [[],[{}],[proxy],[proxy,{}]])assert.throws(()=>provider[name](...args));
  }
  for(const name of Object.keys(adapter).filter(n=>n.startsWith('assertDashboardCutoverJoint')))
    for(const args of [[],[{}],[proxy,loaded],[proxy,approved],[proxy,approved,{}]])assert.throws(()=>adapter[name](...args));
  assert.throws(()=>adapter.revokeDashboardCutoverJointTokenV4(proxy));
  assert.equal(traps,0);assert.equal(out.ports.length,at);
  assert.equal(await adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),undefined);
`,{resources:true}));

test('preparation reentry burns before parsing and retains the original caller operation',()=>exercise(participants+`
  let nested,triggered=0,traps=0;
  const proxy=new Proxy({},{get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
  onPort=row=>{
    if(!triggered){
      triggered++;const before=out.ports.length;
      nested=assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(proxy,proxy,{}),
        {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
      assert.equal(out.ports.length,before);
    }
  };
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
    {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  await nested;assert.equal(triggered,1);assert.equal(traps,0);
  onPort=()=>{};
  native.assertHeldDashboardCutoverLoadedJobPeerV4(loaded);definition.assertHeldDashboardCutoverApprovedDefinitionV4(approved);
`,{resources:true}));

for(const lost of ['native','definition']){
  test('unknown '+lost+' settlement response retains both fences and stops later settlement',()=>exercise(participants+`
    const lost=${JSON.stringify(lost)},get=WeakMap.prototype.get;let triggered=0,nativeSettlements=0,definitionSettlements=0;
    WeakMap.prototype.get=function(key){
      const stack=Error().stack,caller=stack.split('\\n')[2]??'';
      const original=get.call(this,key);
      if(caller.includes('bound')&&stack.includes('settlementToken')){
        const owner=stack.includes('settleHeldDashboardCutoverLoadedJobOperationV4')?'native':'definition';
        if(owner==='native')nativeSettlements++;else definitionSettlements++;
        if(owner===lost&&!triggered){triggered++;throw Error('ORIGINAL_SETTLEMENT_TOKEN_READ_RESPONSE_LOSS')}
      }
      return original;
    };
    await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
      {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
    assert.equal(triggered,1);assert.equal(nativeSettlements,1);assert.equal(definitionSettlements,lost==='native'?0:1);
    const at=out.ports.length;
    assert.throws(()=>native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded),{message:'DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED'});
    assert.throws(()=>definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved),{message:'DASHBOARD_CUTOVER_APPROVED_DEFINITION_REFUSED'});
    assert.equal(out.ports.length,at);
  `,{resources:true}));
}

test('public native close in the serial settlement gap cannot dispose its locally settled originals',()=>exercise(participants+`
  const get=WeakMap.prototype.get;let triggered=0,at=-1;
  WeakMap.prototype.get=function(key){
    const stack=Error().stack,caller=stack.split('\\n')[2]??'';
    const original=get.call(this,key);
    if(!triggered&&caller.includes('bound')&&stack.includes('settlementToken')&&
      stack.includes('settleHeldDashboardCutoverApprovedDefinitionOperationV4')){
      triggered++;at=out.ports.length;
      assert.throws(()=>native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded),{message:'DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED'});
      assert.equal(out.ports.length,at);
    }
    return original;
  };
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
    {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.equal(triggered,1);assert.equal(out.ports.length,at);
  native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved);
  const closed=out.ports.length;
  native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved);
  assert.equal(out.ports.length,closed);
`,{resources:true}));

test('pending fixed original import reentry never admits scopes or starts the next import',()=>exercise(participants+`
  let nativeImports=0,definitionImports=0,nested,traps=0;
  const proxy=new Proxy({},{get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
  const hooks=moduleBuiltin.registerHooks({resolve(specifier,context,next){
    const original=next(specifier,context);
    if(specifier===root+'/dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js')definitionImports++;
    if(specifier===root+'/scripts/dashboard-cutover-native-sidecar-v2.mjs'){
      nativeImports++;const at=out.ports.length;
      nested=assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(proxy),
        {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
      assert.equal(out.ports.length,at);
    }
    return original;
  }});
  const originalWork=adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved);
  await assert.rejects(()=>originalWork,{message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  await nested;hooks.deregister();assert.equal(nativeImports,1);assert.equal(definitionImports,0);assert.equal(traps,0);
  native.assertHeldDashboardCutoverLoadedJobPeerV4(loaded);definition.assertHeldDashboardCutoverApprovedDefinitionV4(approved);
  const at=out.ports.length;
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
    {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.equal(out.ports.length,at);
`,{resources:true}));

test('lost first scope sealing retains its unpublished original and never enters definition enrollment',()=>exercise(participants+`
  const freeze=Object.freeze,create=Object.create;let unpublished,triggered=0,secondMints=0;
  Object.create=function(...args){
    if((Error().stack.split('\\n')[2]??'').includes('beginHeldDashboardCutoverApprovedDefinitionOperationV4'))secondMints++;
    return create.apply(this,args);
  };
  Object.freeze=function(value){
    if((Error().stack.split('\\n')[2]??'').includes('beginHeldDashboardCutoverLoadedJobOperationV4')){
      triggered++;unpublished=value;freeze(value);throw Error('ORIGINAL_NATIVE_SCOPE_SEAL_RESPONSE_LOSS');
    }
    return freeze(value);
  };
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
    {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.equal(triggered,1);assert.equal(secondMints,0);assert.ok(unpublished);
  const at=out.ports.length;
  assert.throws(()=>native.assertHeldDashboardCutoverLoadedJobOperationV4(unpublished),{message:'DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED'});
  assert.throws(()=>native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded),{message:'DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED'});
  assert.equal(out.ports.length,at);
  definition.assertHeldDashboardCutoverApprovedDefinitionV4(approved);
`,{resources:true}));

test('scope checking guard burns before wrong-arity proxy reentry reaches resource ports',()=>exercise(participants+`
  let triggered=0,at=-1,traps=0;
  const proxy=new Proxy({},{get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
  onPort=row=>{
    if(!triggered&&row.owner==='native'&&row.scopePass&&row.name==='readSync'){
      triggered++;at=out.ports.length;
      assert.throws(()=>native.assertHeldDashboardCutoverLoadedJobOperationV4(proxy,{}),{message:'DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED'});
      assert.equal(out.ports.length,at);
    }
  };
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
    {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.equal(triggered,1);assert.equal(traps,0);
  assert.deepEqual(out.ports.slice(at).filter(r=>r.owner==='native'||r.owner==='definition'||r.name==='closeSync'),[]);
`,{resources:true}));

test('genuine query-instance definition and captured-token copies cannot substitute canonical originals',()=>exercise(participants+`
  const otherDefinition=await import('./dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js?independent-originals');
  const otherMaterial=otherDefinition.holdDashboardCutoverLauncherMaterialV2();
  const otherApproved=otherDefinition.holdDashboardCutoverApprovedDefinitionV4(otherMaterial);
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,otherApproved),
    {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  const freeze=Object.freeze;let originalToken;
  Object.freeze=function(value){
    if((Error().stack.split('\\n')[2]??'').includes('qualifyOriginals'))originalToken=value;
    return freeze(value);
  };
  assert.equal(await adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),undefined);
  assert.ok(originalToken);assert.deepEqual(Reflect.ownKeys(originalToken),[]);
  const otherAdapter=await import('./scripts/deployment-dashboard-cutover-adapter-v2.mjs?independent-originals');
  const copiedToken=freeze(Object.create(null)),at=out.ports.length;
  for(const name of Object.keys(adapter).filter(n=>n.startsWith('assertDashboardCutoverJoint'))){
    for(const participant of [loaded,approved])assert.throws(()=>otherAdapter[name](originalToken,participant));
    for(const participant of [loaded,approved])assert.throws(()=>adapter[name](copiedToken,participant));
  }
  assert.throws(()=>otherAdapter.revokeDashboardCutoverJointTokenV4(originalToken));
  assert.throws(()=>adapter.revokeDashboardCutoverJointTokenV4(copiedToken));assert.equal(out.ports.length,at);
  otherDefinition.assertHeldDashboardCutoverApprovedDefinitionV4(otherApproved);
  otherDefinition.closeHeldDashboardCutoverApprovedDefinitionV4(otherApproved);otherDefinition.closeHeldDashboardCutoverLauncherMaterialV2(otherMaterial);
  definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved);definition.closeHeldDashboardCutoverLauncherMaterialV2(material);
  native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);
`,{resources:true}));

for(const lost of ['native','definition']){
  test('post-local '+lost+' settlement response loss keeps both original idle fences',()=>exercise(participants+`
    const lost=${JSON.stringify(lost)},get=WeakMap.prototype.get;let injected=0,locallySettled=false;
    WeakMap.prototype.get=function(key){
      const stack=Error().stack,caller=stack.split('\\n')[2]??'';
      const original=get.call(this,key);
      const owner=stack.includes('settleHeldDashboardCutoverLoadedJobOperationV4')?'native':
        stack.includes('settleHeldDashboardCutoverApprovedDefinitionOperationV4')?'definition':null;
      if(original&&owner===lost&&!injected&&
        (caller.includes('originalOperationScope')||caller.includes('originalApprovedDefinitionOperationV4'))){
        injected++;let checking=original.checking;
        // TEST ONLY fault on the REAL retained private scope record, not a
        // fabricated holder or authority return. Its real settlement completes
        // before the existing finally's checking-release response is lost.
        Object.defineProperty(original,'checking',{get(){return checking},set(value){
          checking=value;
          if(value===false&&original.settled){locallySettled=true;throw Error('POST_LOCAL_SETTLEMENT_RESPONSE_LOSS')}
        }});
      }
      return original;
    };
    await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
      {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
    assert.equal(injected,1);assert.equal(locallySettled,true);
    const at=out.ports.length;
    assert.throws(()=>native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded),{message:'DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED'});
    assert.throws(()=>definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved),{message:'DASHBOARD_CUTOVER_APPROVED_DEFINITION_REFUSED'});
    assert.equal(out.ports.length,at);assert.equal(out.nativeCalls,0);
  `,{resources:true}));
}

test('fixed pre32 original-operation interfaces exist before participant or database acquisition',()=>exercise(`
  const adapter=await import('./scripts/deployment-dashboard-cutover-adapter-v2.mjs');
  const definition=await import('./dist/internal-production/baseline-deployment-cutover-launcher-observation-v1.js');
  const census=await import('./dist/internal-production/baseline-legacy-database-census-v1.js');
  assert.equal(typeof census.assertHeldDashboardCutoverPre32DatabaseV2,'function');
  assert.deepEqual({
    qualifier:typeof adapter.qualifyHeldDashboardCutoverJointPre32OperationV4,
    fixedAssertions:typeof adapter.executeDashboardCutoverJointPre32AssertionsV4,
    definitionOperation:typeof definition.runHeldDashboardCutoverApprovedDefinitionOperationPre32V4,
  },{qualifier:'function',fixedAssertions:'function',definitionOperation:'function'},
  'MISSING_FIXED_JOINT_PRE32_OPERATION_INTERFACES');
`,{pre32:true}));

// New pre32 cases retain bounded counters/events, not huge duplicate FS traces.
// Scope owner is the actual fifth compiled bridge. These three imported boundaries
// are explicit inert driver/journal/finding mechanics, never a fabricated scope.
const pre32Driver=String.raw`
export default function postgres(url,options){
  const p=globalThis.pre32Probe;assertTarget();p.open++;
  function assertTarget(){if(url!=='postgresql://FIXTURE_ONLY@localhost/setfarm')throw Error('UNEXPECTED_FIXTURE_TARGET')}
  const tx=async strings=>{
    const q=strings.join('');p.queries++;
    if(q.startsWith('SET LOCAL'))return [];
    if(q.includes('FROM public.setfarm_schema_migrations')&&q.includes('ORDER BY version'))
      return [26,27,28,29,30,31].map(version=>({version,state:'applied'}));
    if(q.includes('WITH expected_tables(name)'))return [{laterJournalCount:'0',relationCount:'0',functionCount:'0',typeCount:'0',triggerCount:'0'}];
    if(q.includes('WITH required_columns('))return [{catalogViolationCount:'0',aprbChildViolationCount:'0',ordinaryBatchViolationCount:'0',activeHeaderViolationCount:'0',
      ownerReservationsRelation:null,ownerAdmissionHeadRelation:null,producerSourceRelation:null,producerActivationRelation:null,producerActivationHeadRelation:null,producerCurrentRelation:null,
      activeRunCount:'0',openClaimCount:'0',executionAttemptCount:'0',activeRuntimeSessionCount:'0',activeCompletionOwnerCount:'0',unsettledMandatoryEffectCount:'0',
      artifactReservationCount:'0',publicationBatchCount:'0',artifactPublicationCount:'0',terminationOwnerCount:'0',findingOwnerCount:'0',recoveryOwnerCount:'0',operationalDeliveryCount:'0'}];
    if(q.includes('FROM public.finding_sets ORDER BY')||q.includes('FROM public.findings ORDER BY')||q.includes('finding_sets'))return [];
    throw Error('UNEXPECTED_QUERY');
  };
  tx.unsafe=async(q,parameters)=>{
    p.queries++;p.events.push(q);
    if(q==='FIXTURE_EXACT_JOURNAL'){
      p.exactJournal++;
      const stop=p.scenario==='callback-loss'?2:p.scenario==='final-loss'?4:0;
      if(p.exactJournal===stop){
        p.suspendedAt=p.exactJournal;p.suspendObserved();
        await new Promise(resolve=>{p.resumeOriginalQuery=resolve});
        p.querySettled=true;p.events.push('original-suspended-query-settled');
      }
    }
    return [];
  };
  return {options:{host:['localhost'],port:[5432],database:'setfarm',user:'FIXTURE_ONLY'},
    begin:async(mode,callback)=>{
      p.mode=mode;p.held=true;p.events.push('begin');
      const driver=new Promise((resolve,reject)=>{p.rejectDriver=reject;
        const original=callback(tx);p.actualCallback=original;
        original.then(value=>{p.callbackSettled=true;p.events.push('actual-transaction-callback-settled');resolve(value)},
          error=>{p.callbackSettled=true;p.events.push('actual-transaction-callback-rejected');reject(error)});
      });p.actualDriver=driver;
      try{return await driver}finally{p.held=false;p.events.push('driver-return-or-reject')}
    },
    end:async()=>{p.end++;p.events.push('end');p.endObserved()},
  };
}
`;

function pre32Setup(scenario){return `
  assert.equal(typeof (await import('./scripts/deployment-dashboard-cutover-adapter-v2.mjs'))
    .qualifyHeldDashboardCutoverJointPre32OperationV4,'function','MISSING_FIXED_JOINT_PRE32_OPERATION');
  const p=globalThis.pre32Probe={scenario:${JSON.stringify(scenario)},events:[],queries:0,exactJournal:0,open:0,end:0,held:false,callbackSettled:false};
  p.suspended=new Promise(resolve=>{p.suspendObserved=resolve});
  p.ended=new Promise(resolve=>{p.endObserved=resolve});
  const sources={postgres:${JSON.stringify(pre32Driver)},
    '../findings/finding-publication-v1.js':'export const observeLegacyFindingPublicationInventoryV1=()=>Object.freeze({authority:"diagnostic-only"});',
    '../db/contract-spine-migrations.js':'export async function verifyHeldPre32ContractSpineJournalIdentityV1(query){await query("FIXTURE_EXACT_JOURNAL",[31])}',
  };
  moduleBuiltin.registerHooks({resolve(specifier,context,next){
    if(Object.hasOwn(sources,specifier))return {url:'data:text/javascript,'+encodeURIComponent(sources[specifier]),shortCircuit:true};
    return next(specifier,context);
  }});
`;}

const expectedPre32Locks=[
  'artifact_capacity','artifact_publication_batch_items','artifact_publication_batch_plan_items',
  'artifact_publication_batch_plans','artifact_publication_batches','artifact_publication_reservations','artifact_store_authorities',
  'claim_log','execution_attempts','finding_sets','findings','operational_event_deliveries','operational_outbox',
  'platform_release_store_records_v3','product_compilation_attempts','product_packets','recovery_cases','recovery_dispatch_deliveries',
  'recovery_revision_dispatches','run_termination_requests','runs','runtime_completion_effects','runtime_completion_requests','runtime_sessions',
  'semantic_artifacts','setfarm_schema_migrations','steps','stories','v3_canary_admission_claims','v3_preparation_authorities_v2',
  'v3_preparation_authority_attempts_v2','v3_preparation_authority_claims_v2','v3_preparation_blocks','v3_preparation_story_state',
  'v3_story_claim_runtime_binding_cutovers_v1','v3_story_claim_runtime_bindings_v1',
].map(n=>'LOCK TABLE public.'+n+' IN SHARE MODE');

test('fixed pre32 operation holds genuine transaction across both original participants before successful release',()=>exercise(
  pre32Setup('healthy')+participants+`
  const heldFds=new Set(fdPaths.keys());let disposals=0;const heldChecks={native:0,definition:0};
  onPort=row=>{if(row.name==='closeSync'&&heldFds.has(row.fd))disposals++;
    if(p.held&&row.scopePass&&Object.hasOwn(heldChecks,row.owner))heldChecks[row.owner]++};
  const result=await adapter.qualifyHeldDashboardCutoverJointPre32OperationV4(loaded,approved);
  assert.equal(result,undefined);assert.equal(disposals,0);assert.ok(heldChecks.native>0);assert.ok(heldChecks.definition>0);
  assert.equal(p.open,1);assert.equal(p.end,1);assert.equal(p.held,false);assert.equal(p.callbackSettled,true);
  assert.equal(p.mode,'isolation level read committed read only');assert.equal(p.exactJournal,4);
  assert.deepEqual(p.events.filter(e=>e.startsWith('LOCK TABLE ')),${JSON.stringify(expectedPre32Locks)});
  native.assertHeldDashboardCutoverLoadedJobPeerV4(loaded);definition.assertHeldDashboardCutoverApprovedDefinitionV4(approved);
  definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved);native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);
  definition.closeHeldDashboardCutoverLauncherMaterialV2(material);assert.ok(disposals>0);
  out.pre32={mode:p.mode,events:p.events,queries:p.queries,exactJournal:p.exactJournal,heldChecks,open:p.open,end:p.end,callbackSettled:p.callbackSettled};
`,{resources:true,pre32:true}));

for(const scenario of ['callback-loss','final-loss']){
  test('fixed pre32 '+scenario+' retains both fences after original driver loss and same query settlement',()=>exercise(
    pre32Setup(scenario)+participants+`
    const heldFds=new Set(fdPaths.keys());let disposals=0;
    onPort=row=>{if(row.name==='closeSync'&&heldFds.has(row.fd))disposals++};
    const operation=adapter.qualifyHeldDashboardCutoverJointPre32OperationV4(loaded,approved);operation.catch(()=>{});
    await p.suspended;assert.equal(p.held,true);assert.equal(p.callbackSettled,false);
    assert.equal(p.suspendedAt,p.scenario==='callback-loss'?2:4);
    const queries=p.queries;p.rejectDriver(Error('INERT_DRIVER_LOSS'));await p.ended;
    await new Promise(resolve=>setImmediate(resolve));
    const direct=()=>Object.fromEntries(['native','definition'].flatMap(owner=>['fstatSync','lstatSync','readSync']
      .map(name=>[owner+':'+name,out.portCounts?.[owner+':'+name]??0])));
    const directAt=direct();
    assert.equal(disposals,0);assert.equal(p.queries,queries);
    assert.throws(()=>native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded));
    assert.throws(()=>definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved));assert.equal(disposals,0);
    let traps=0;const proxy=new Proxy({}, {get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
    await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointPre32OperationV4(proxy));assert.equal(traps,0);
    assert.equal(disposals,0);assert.equal(p.queries,queries);assert.deepEqual(direct(),directAt);
    p.resumeOriginalQuery();await p.actualCallback.catch(()=>{});
    await assert.rejects(()=>operation,{message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
    assert.equal(p.querySettled,true);assert.equal(p.callbackSettled,true);assert.equal(p.queries,queries);assert.equal(disposals,0);
    assert.throws(()=>native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded));
    assert.throws(()=>definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved));assert.equal(disposals,0);
    await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointPre32OperationV4(loaded,approved));assert.equal(p.open,1);
    assert.deepEqual(direct(),directAt);
    out.pre32={scenario:p.scenario,events:p.events,queries:p.queries,exactJournal:p.exactJournal,suspendedAt:p.suspendedAt,
      disposals,querySettled:p.querySettled,callbackSettled:p.callbackSettled,open:p.open,end:p.end,traps,directAt,directAfter:direct()};
  `,{resources:true,pre32:true}));
}

test('fixed pre32 keeps original invocation and query promises after genuine settlement',()=>exercise(
  pre32Setup('healthy')+participants+`
  const set=WeakMap.prototype.set;let coordinatorOriginal;
  WeakMap.prototype.set=function(key,value){
    if(value&&value.originalLoaded===loaded&&value.originalDefinition===approved)coordinatorOriginal=value;
    return set.call(this,key,value);
  };
  await adapter.qualifyHeldDashboardCutoverJointPre32OperationV4(loaded,approved);
  assert.ok(coordinatorOriginal);assert.equal(coordinatorOriginal.pending.size,0);
  out.retention={captured:true,pending:coordinatorOriginal.pending.size,count:coordinatorOriginal.originals?.length??null};
  assert.ok(Array.isArray(coordinatorOriginal.originals),'MISSING_RETAINED_ORIGINAL_OCCURRENCE_HISTORY');
  assert.equal(coordinatorOriginal.originals.length,3);
  const {types}=await import('node:util');
  for(const occurrence of coordinatorOriginal.originals){
    assert.equal(occurrence.intent,true);assert.equal(occurrence.returned,true);assert.equal(occurrence.settled,true);
    assert.ok(types.isPromise(occurrence.promise));
  }
  definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved);native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded);
  definition.closeHeldDashboardCutoverLauncherMaterialV2(material);
`,{resources:true,pre32:true}));

for(const window of ['configuration','final']){
  test('fixed pre32 short checking fence refuses genuine scope reentry at '+window+' post-driver validation',()=>exercise(
    pre32Setup('healthy')+participants+`
    const get=WeakMap.prototype.get;let originalScope,originalRecord,triggered=0,nestedRefused=false;
    WeakMap.prototype.get=function(key){const value=get.call(this,key);
      if(value&&value.original===approved&&Object.hasOwn(value,'definition')&&value.published){originalScope=key;originalRecord=value}
      return value;
    };
    const window=${JSON.stringify(window)};
    onPort=row=>{
      const target=window==='final'?row.owner==='definition':
        row.owner==='composite'&&row.path===home+'/Library/LaunchAgents/com.setrox.setfarm-dashboard.plist';
      if(!triggered&&p.end===1&&target&&row.name==='fstatSync'&&originalScope&&
        originalRecord.pre32.outerSettled===(window==='final')){
        triggered++;out.shortFence={window,triggered,outerSettled:originalRecord.pre32.outerSettled,nestedRefused:false};
        // Do not throw a test assertion from this port: an admitted nested assert
        // must let the actual outer operation succeed and expose a genuine RED.
        try{definition.assertHeldDashboardCutoverApprovedDefinitionOperationV4(originalScope)}catch{nestedRefused=true}
        out.shortFence.nestedRefused=nestedRefused;
      }
    };
    await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointPre32OperationV4(loaded,approved),
      {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
    assert.equal(triggered,1);assert.equal(nestedRefused,true);assert.equal(out.nativeCalls,0);
  `,{resources:true,pre32:true}));
}

test('unpublished coordinator token sealing loss admits no participant and never authenticates a captured mint',()=>exercise(participants+`
  const freeze=Object.freeze,create=Object.create;let token,mints=0;
  Object.create=function(...args){
    const caller=Error().stack.split('\\n')[2]??'';
    if(caller.includes('beginHeldDashboardCutover'))mints++;
    return create.apply(this,args);
  };
  Object.freeze=function(value){
    if((Error().stack.split('\\n')[2]??'').includes('qualifyOriginals')){
      token=value;freeze(value);throw Error('ORIGINAL_TOKEN_SEAL_RESPONSE_LOSS');
    }
    return freeze(value);
  };
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved),
    {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.ok(token);assert.equal(mints,0);
  const at=out.ports.length;
  for(const name of Object.keys(adapter).filter(n=>n.startsWith('assertDashboardCutoverJoint')))
    for(const participant of [loaded,approved])assert.throws(()=>adapter[name](token,participant));
  assert.equal(adapter.revokeDashboardCutoverJointTokenV4(token),undefined);
  assert.equal(out.ports.length,at);
  native.assertHeldDashboardCutoverLoadedJobPeerV4(loaded);definition.assertHeldDashboardCutoverApprovedDefinitionV4(approved);
`,{resources:true}));
