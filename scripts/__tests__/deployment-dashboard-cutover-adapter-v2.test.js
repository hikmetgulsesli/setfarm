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
function jointFixture(resources=false,pre32=false,bounded=false,owner=false,ownerInputCopy=false,localDrainFault=false,quiet=false,ingress=false){
  const bridgeList=pre32?[...translations,
    ['src/internal-production/baseline-legacy-database-census-v1.ts',
      'dist/internal-production/baseline-legacy-database-census-v1.js']]:[...translations];
  if(owner){
    assert.equal(resources,true);assert.ok(pre32||quiet||ingress);
    for(const name of ['baseline-deployment-cutover-records-v1','baseline-deployment-cutover-owner-store-v1',
      'baseline-deployment-cutover-publication-v1','baseline-deployment-cutover-v1','baseline-workspace-authority-path-v1',
      'baseline-dashboard-cutover-local-producer-drain-v2'])
      bridgeList.push(['src/internal-production/'+name+'.ts','dist/internal-production/'+name+'.js']);
    if(quiet)for(const name of ['baseline-dashboard-cutover-records-v2','baseline-dashboard-cutover-store-v2'])
      bridgeList.push(['src/internal-production/'+name+'.ts','dist/internal-production/'+name+'.js']);
    for(const name of ['baseline-positive-worktree-physical-catalog-v2',
      'baseline-positive-worktree-active-binding-snapshot-v1',
      'baseline-positive-worktree-active-row-snapshot-v2','baseline-positive-worktree-binding-rows-v1'])
      bridgeList.push(['src/internal-production/'+name+'.ts','dist/internal-production/'+name+'.js']);
  }
  const files=Object.fromEntries(scripts.map(n=>['scripts/'+n,fs.readFileSync(sourceRoot+'/scripts/'+n)]));
  if(owner)for(const name of ['build-generation-maintenance-journal.mjs','build-generation-maintenance-owner-observer.mjs',
    'deployment-cutover-owner.mjs','deployment-cutover.mjs','deployment-cutover-dependencies.mjs',
    'deployment-dashboard-cutover-first-generation-v2.mjs','deployment-dashboard-cutover-atomic-root-v2.py'])
    files['scripts/'+name]=fs.readFileSync(sourceRoot+'/scripts/'+name);
  let sourceFault=null;
  if(ownerInputCopy){
    assert.equal(owner,true);
    const locator='scripts/deployment-cutover-owner.mjs',original=files[locator].toString();
    const needle='acquireFirstGenerationDashboardCutoverJointReservationV4(record.input, record.token)';
    assert.equal(original.split(needle).length,2,'one literal original owner-to-provider call');
    const changed=original.replace(needle,'acquireFirstGenerationDashboardCutoverJointReservationV4({...record.input}, record.token)');
    files[locator]=Buffer.from(changed);
    sourceFault={authority:'explicit-counterfactual-source-graph-not-healthy-production-qualification',
      locator,originalHash:hash(original),changedHash:hash(changed),needle};
  }
  for(const [source] of bridgeList)files[source]=fs.readFileSync(sourceRoot+'/'+source);
  for(const n of ['deployment-dashboard-cutover-adapter-v2.mjs','deployment-dashboard-cutover-adapter-v2.d.mts']){
    const p=sourceRoot+'/scripts/'+n;if(fs.existsSync(p))files['scripts/'+n]=fs.readFileSync(p);
  }
  if(localDrainFault){
    assert.equal(owner,true);assert.equal(sourceFault,null);
    const locator='scripts/deployment-dashboard-cutover-adapter-v2.mjs',original=files[locator].toString();
    const [needle,replacement]=localDrainFault==='pending-stage-working'
      ?["record.stage='draining';checkOperation(record);","record.stage='working';checkOperation(record);"]
      :localDrainFault==='drop-fulfilled-custody'
        ?['occurrence.value=value;occurrence.returned=true;occurrence.settled=true;','occurrence.settled=true;']
        :localDrainFault==='ingress-immediate-refusal'
          ?["return qualifyOriginals(originalLoaded,originalDefinition,arguments.length,'ingress',originalOwner);",
            "throw Error('DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED');"]:[];
    assert.equal(typeof needle,'string');assert.equal(original.split(needle).length,2);
    const changed=original.replace(needle,replacement);files[locator]=Buffer.from(changed);
    sourceFault={authority:'explicit-counterfactual-source-graph-not-healthy-production-qualification',
      locator,originalHash:hash(original),changedHash:hash(changed),needle,replacement,localDrainFault};
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
    if(owner)for(const suffix of ['ai/setrox/setfarm','ai/setrox/mission-control','projects',
      '.openclaw/workspace/agent-scratch','.openclaw/workspaces/workflows'])
      fs.mkdirSync(home+'/'+suffix,{recursive:true,mode:0o700});
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
  return {root,bridges,pins,providers,home,pre32,bounded,owner,quiet,ingress,sourceFault,sourceSha:git(root,['rev-parse','HEAD']),outputTreeHash};
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
    ${fixture.owner?`if(command==='/usr/sbin/lsof'){
      assert.ok([4,6].includes(args.length));
      const excluded=args.length===6;
      assert.deepEqual(args.slice(0,2),['-nP','-F0']);
      if(excluded)assert.deepEqual(args.slice(2,4),['-p','^'+process.pid]);
      assert.equal(args[excluded?4:2],'+D');assert.ok(args.at(-1).startsWith(home+'/'));
      out.lsofObservations??=[];out.lsofObservations.push({authority:'explicit-inert-lsof-not-host-census',args:[...args]});
      const pid=globalThis.physicalProbe?.pid;
      return {status:pid?0:1,signal:null,stdout:pid?Buffer.from('p'+pid+'\\0n'+args.at(-1)+'\\0\\n'):Buffer.alloc(0),stderr:Buffer.alloc(0)};
    }`:''}
    ${fixture.owner?`if(command==='/usr/sbin/sysctl'||command==='/bin/ps'){
      assert.deepEqual(args,command==='/usr/sbin/sysctl'?['-n','kern.boottime']:
        ['-p',String(process.pid),'-o','uid=','-o','lstart=','-o','pgid=','-o','stat=']);
      out.ownerProcessObservations=(out.ownerProcessObservations??0)+1;
      return nativeSpawnSync(command,args,options);
    }`:''}
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
    ${fixture.owner?`if(command==='/usr/bin/python3'){
      out.portCounts??={};out.portCounts['reservation:spawn']=(out.portCounts['reservation:spawn']??0)+1;
      assert.equal(args.length,5);assert.deepEqual(args.slice(0,4),['-I','-S','-B',root+'/scripts/deployment-dashboard-cutover-atomic-root-v2.py']);
      assert.match(args[4],/^\\.dashboard-cutover-root\\.[a-f0-9-]{36}\\.stage$/);
      assert.equal(options.cwd,'/');assert.equal(options.stdio.length,4);
      assert.deepEqual(options.stdio.slice(0,3),['ignore','pipe','pipe']);
      const parent=home+'/ai/setrox/data/internal-production-baseline',stage=parent+'/'+args[4],destination=parent+'/restart-authority-retirement-v1';
      assert.equal(fdPaths.get(options.stdio[3]),parent);assert.equal(fs.fstatSync(options.stdio[3]).isDirectory(),true);
      const row={command,args,authority:'explicit-Python-process-and-publication-double-parent-custody-only',
        dispatchedWhilePgHeld:globalThis.pre32Probe.held,published:false,closed:false,events:[]};out.commands.push(row);
      const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
      child.kill=()=>{throw Error('FORBIDDEN_KILL')};
      for(const [name,stream] of [['stdout',child.stdout],['stderr',child.stderr]])
        for(const event of ['end','close'])stream.on(event,()=>row.events.push(name+':'+event));
      const release=()=>{
        assert.equal(row.published,false);assert.equal(fs.existsSync(destination),false);
        fs.renameSync(stage,destination);row.published=true;row.publishedWhilePgHeld=globalThis.pre32Probe.held;
        child.stdout.end('DASHBOARD_ATOMIC_ROOT_PUBLISHED\\n');child.stderr.end('');
        setImmediate(()=>{row.closed=true;row.status=0;row.signal=null;child.emit('close',0,null)});
      };
      out.reservationChild=row;
      if(globalThis.holdReservationChild){globalThis.releaseReservationChild=release;globalThis.reservationChildObserved()}
      else setImmediate(release);
      return child;
    }`:''}
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
  const originalOpen=fs.openSync,originalClose=fs.closeSync,originalStat=fs.fstatSync,fdPaths=new Map();let onPort=()=>{};
  fs.openSync=(p,...args)=>{
    const physical=globalThis.physicalProbe?.capture&&(Error().stack.split('\\n')[2]??'').includes('baseline-positive-worktree-physical-catalog-v2.js');
    let occurrence;
    if(physical){out.physicalFds??=[];occurrence={generation:out.physicalFds.length+1,path:String(p),intent:true,returned:false,fd:null,closeIntents:0};out.physicalFds.push(occurrence)}
    const fd=originalOpen(p,...args);fdPaths.set(fd,String(p));
    if(occurrence){occurrence.fd=fd;occurrence.returned=true;const s=originalStat(fd,{bigint:true});
      occurrence.identity={dev:String(s.dev),ino:String(s.ino),birthtimeNs:String(s.birthtimeNs),mode:String(s.mode),uid:String(s.uid)}}
    if(occurrence){out.portCounts??={};out.portCounts['physical:openSync']=(out.portCounts['physical:openSync']??0)+1}
    ${fixture.owner?`if((Error().stack.split('\\n')[2]??'').includes('deployment-dashboard-cutover-first-generation-v2.mjs')){
      out.reservationFds??=[];out.reservationFds.push({fd,path:String(p)});
      out.portCounts??={};out.portCounts['reservation:openSync']=(out.portCounts['reservation:openSync']??0)+1;
    }`:''}
    return fd};
  for(const name of ${fixture.owner?"['fstatSync','lstatSync','readSync','closeSync','readdirSync','writeFileSync','fsyncSync','mkdirSync']":"['fstatSync','lstatSync','readSync','closeSync']"}){const original=fs[name];fs[name]=(...args)=>{
    const stack=Error().stack,frames=stack.split('\\n'),direct=(frames[3]??'').includes('at port ');
    const owner=direct&&(frames[2]??'').includes('dashboard-cutover-native-sidecar-v2.mjs')?'native':
      direct&&(frames[2]??'').includes('baseline-deployment-cutover-launcher-observation-v1.js')?'definition':
      (frames[2]??'').includes('baseline-positive-worktree-physical-catalog-v2.js')?'physical':
      ${fixture.owner?"(frames[2]??'').includes('deployment-dashboard-cutover-first-generation-v2.mjs')?'reservation':":''}'composite';
    const row={name,owner,physicalOwnerEntry:stack.includes('assertHeldDashboardCutoverJointPhysicalOwnerEntryV4'),
      physicalFullAssertion:stack.includes('assertHeldDashboardCutoverJointPhysicalReservationV4'),scopeEnrollment:stack.includes('at enroll '),
      physicalStack:owner==='physical'?frames.filter(frame=>frame.includes('baseline-positive-worktree-physical-catalog-v2.js')):null,
      scopePass:!stack.includes('at enroll ')&&(stack.includes('assertHeldDashboardCutoverLoadedJobOperationV4')||
      stack.includes('assertHeldDashboardCutoverApprovedDefinitionOperationV4')),path:typeof args[0]==='number'?fdPaths.get(args[0]):String(args[0])};
    ${fixture.bounded?`row.fd=typeof args[0]==='number'?args[0]:null;
    out.portCounts??={};const key=owner+':'+name;out.portCounts[key]=(out.portCounts[key]??0)+1;
    if(owner!=='composite'&&out.ports.length<32)out.ports.push(row);`:'out.ports.push(row);'}
    if(name==='closeSync')for(const occurrence of out.physicalFds??[])
      if(occurrence.fd===args[0]&&occurrence.returned&&!occurrence.closeReturned)occurrence.closeIntents++;
    const result=original(...args);if(name==='readSync')row.result=result;
    if(name==='readSync'&&owner==='physical'){
      out.physicalReads??=[];out.physicalReads.push({fd:args[0],path:fdPaths.get(args[0]),position:args[4],length:args[3],result});
    }
    if(name==='closeSync')for(const occurrence of out.physicalFds??[])
      if(occurrence.fd===args[0]&&occurrence.returned&&!occurrence.closeReturned)occurrence.closeReturned=true;
    ${fixture.bounded?"if(name==='closeSync')fdPaths.delete(args[0]);":''}
    onPort(row);return result;
  }}
  ${fixture.owner?`const originalAccount=os.userInfo;
  os.userInfo=(...args)=>{if((Error().stack.split('\\n')[2]??'').includes('deployment-dashboard-cutover-first-generation-v2.mjs')){
    out.portCounts??={};out.portCounts['reservation:userInfo']=(out.portCounts['reservation:userInfo']??0)+1;
  }return originalAccount(...args)};`:''}
  syncBuiltinESMExports();
`;}

async function exercise(body,{resources=false,pre32=false,bounded=pre32,owner=false,ownerInputCopy=false,localDrainFault=false,quiet=false,ingress=false}={}){
  const fixture=jointFixture(resources,pre32,bounded,owner,ownerInputCopy,localDrainFault,quiet,ingress),{root}=fixture;
  const program=`import assert from 'node:assert/strict';import fs from 'node:fs';
    import path from 'node:path';
    import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
    const root=${JSON.stringify(root)},out={actual:false,ports:[],commands:[],nativeCalls:0};
    const originalExecFile=cp.execFile;
    ${resources?resourceProgram(fixture):''}
    for(const name of ${resources?"['exec','execSync','execFile','execFileSync','fork']":"['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']"})cp[name]=(...args)=>{
      out.commands.push({name,args});throw Error('FORBIDDEN_EXTERNAL_EFFECT')};
    syncBuiltinESMExports();
    try{${body};out.passed=true}catch(error){out.error=error.message;out.stack=error.stack;process.exitCode=1}
    ${owner?"out.reservationFds=(out.reservationFds??[]).map(row=>{let state;try{originalStat(row.fd);state='live'}catch(error){state=error.code}return{...row,state}});":''}
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

test('fixed owner-bound ROOT reservation entry exists before participant or database acquisition',()=>exercise(`
  const adapter=await import('./scripts/deployment-dashboard-cutover-adapter-v2.mjs');
  assert.deepEqual([typeof adapter.reserveHeldDashboardCutoverJointFirstGenerationV4,
    typeof adapter.assertDashboardCutoverJointOwnerTokenV4],['function','function'],
    'MISSING_OWNER_BOUND_ROOT_RESERVATION');
`));

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
  const p=globalThis.pre32Probe;assertTarget();p.open++;p.openObserved?.();
  const transaction='modeled-original-tx-'+p.open;
  function assertTarget(){if(url!=='postgresql://FIXTURE_ONLY@localhost/setfarm')throw Error('UNEXPECTED_FIXTURE_TARGET')}
  const tx=async strings=>{
    const q=strings.join('');p.queries++;
    if(q.startsWith('SET LOCAL'))return [];
    if(q.includes('FROM public.setfarm_schema_migrations')&&q.includes('ORDER BY version'))
      return [26,27,28,29,30,31].map(version=>({version,state:'applied'}));
    if(q.includes('WITH expected_tables(name)'))return [{laterJournalCount:'0',relationCount:'0',functionCount:'0',typeCount:'0',triggerCount:'0'}];
    if(q.includes('WITH required_columns(')){p.censusTransaction=transaction;return [{catalogViolationCount:'0',aprbChildViolationCount:'0',ordinaryBatchViolationCount:'0',activeHeaderViolationCount:'0',
      ownerReservationsRelation:null,ownerAdmissionHeadRelation:null,producerSourceRelation:null,producerActivationRelation:null,producerActivationHeadRelation:null,producerCurrentRelation:null,
      activeRunCount:'0',openClaimCount:'0',executionAttemptCount:'0',activeRuntimeSessionCount:'0',activeCompletionOwnerCount:'0',unsettledMandatoryEffectCount:'0',
      artifactReservationCount:'0',publicationBatchCount:'0',artifactPublicationCount:'0',terminationOwnerCount:'0',findingOwnerCount:'0',recoveryOwnerCount:'0',operationalDeliveryCount:'0'}]}
    if(q.includes('FROM public.finding_sets ORDER BY')||q.includes('FROM public.findings ORDER BY')||q.includes('finding_sets'))return [];
    throw Error('UNEXPECTED_QUERY');
  };
  tx.unsafe=async(q,parameters)=>{
    p.queries++;p.events.push(q);
    if(q.includes('oversizedRunCount')||q.includes('oversizedAttemptCount')||
      q.startsWith('SELECT id AS "runId"')||q.startsWith('SELECT id::text AS "claimId"')||
      q.startsWith('SELECT attempt_id AS "attemptId"')||q.startsWith('SELECT session_id AS "sessionId"')){
      const binding=q.includes('fence_token AS "fenceToken"')||
        (q.includes('oversizedAttemptCount')&&!q.includes('oversizedRunCount'));
      let rows=[];
      if(q.includes('oversizedRunCount'))rows=[{runCount:'0',claimCount:'0',attemptCount:'0',sessionCount:'0',
        oversizedRunCount:'0',oversizedClaimCount:'0',oversizedAttemptCount:'0',oversizedSessionCount:'0'}];
      else if(q.includes('oversizedAttemptCount'))rows=[{attemptCount:p.scenario==='binding-crossed'?'1':'0',
        sessionCount:'0',oversizedAttemptCount:'0',oversizedSessionCount:'0'}];
      else if(q.includes('fence_token AS "fenceToken"')&&p.scenario==='binding-crossed')
        rows=[{attemptId:'attempt-1',runId:'run-1',claimId:null,generation:1,fenceToken:'a'.repeat(64),
          sourceSha:'b'.repeat(40),sourceTreeHash:'c'.repeat(40),worktreeRoot:null,disposition:'running'}];
      p.bindingQueries??=[];p.bindingQueries.push({statement:q,transaction,binding,beginOccurrence:p.begins});
      if(q.includes('oversizedAttemptCount')&&!q.includes('oversizedRunCount')&&p.scenario==='binding-drift'){
        p.bindingObserved();await new Promise(resolve=>{p.resumeBinding=resolve});p.bindingSettled=true;
      }
      class Result extends Array {}
      const result=new Result(...rows);
      for(const key of ['count','state','command','columns','statement'])Object.defineProperty(result,key,{value:null,enumerable:false});
      return result;
    }
    if(q==='FIXTURE_EXACT_JOURNAL'){
      p.exactJournal++;
      p.journalTransactions??=[];p.journalTransactions.push({transaction,beginOccurrence:p.begins});
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
      p.begins=(p.begins??0)+1;
      p.mode=mode;p.held=true;p.events.push('begin');
      const driver=new Promise((resolve,reject)=>{p.rejectDriver=reject;
        const original=callback(tx);p.actualCallback=original;
        original.then(value=>{p.callbackSettled=true;p.events.push('actual-transaction-callback-settled');resolve(value)},
          error=>{p.callbackSettled=true;p.events.push('actual-transaction-callback-rejected');reject(error)});
      });p.actualDriver=driver;
      try{return await driver}finally{p.held=false;p.events.push('driver-return-or-reject')}
    },
    end:async()=>{p.end++;p.events.push('end');p.endObserved();
      if(p.holdEnd){p.originalEndWait=new Promise(resolve=>{p.resumeEnd=resolve});await p.originalEndWait}
      p.endReturned=true;p.events.push('end-returned')},
  };
}
`;

function pre32Setup(scenario){return `
  assert.equal(typeof (await import('./scripts/deployment-dashboard-cutover-adapter-v2.mjs'))
    .qualifyHeldDashboardCutoverJointPre32OperationV4,'function','MISSING_FIXED_JOINT_PRE32_OPERATION');
  const p=globalThis.pre32Probe={scenario:${JSON.stringify(scenario)},events:[],queries:0,exactJournal:0,open:0,end:0,held:false,callbackSettled:false};
  p.suspended=new Promise(resolve=>{p.suspendObserved=resolve});
  p.ended=new Promise(resolve=>{p.endObserved=resolve});
  p.bindingSuspended=new Promise(resolve=>{p.bindingObserved=resolve});
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

// Actual copied owner, history, maintenance/OPEN codecs and filesystem publisher.
// Finalized outputs remain manual fixture metadata, not a real clean-main build.
const ownerSetup=`
  const ownerApi=await import('./scripts/deployment-cutover-owner.mjs');
  const records=await import('./dist/internal-production/baseline-deployment-cutover-records-v1.js');
  const controllerSource=await ownerApi.observeDeploymentCutoverOwnerControllerSourceV1();
  const plan={
    oldDeployment:{checkoutPath:'/old',checkoutDirectoryIdentityHash:'a'.repeat(64),sourceSha:'b'.repeat(40),sourceTreeHash:'c'.repeat(40),buildHash:'d'.repeat(64)},
    newDeployment:{checkoutPath:'/new',checkoutDirectoryIdentityHash:'e'.repeat(64),sourceSha:'f'.repeat(40),sourceTreeHash:'1'.repeat(40),buildHash:'2'.repeat(64)},
    cliLinkObservationHash:'3'.repeat(64),spawnerLauncherConfigurationHash:'4'.repeat(64),dashboardLauncherConfigurationHash:'5'.repeat(64),dashboardPort:3333};
  const maintenance=records.createDeploymentCutoverMaintenanceIntentV1({controllerSourceHash:controllerSource.controllerSourceHash,plan});
  const actualOwner=await ownerApi.acquireDeploymentCutoverOwnerV1(maintenance);
  const intended=records.createDeploymentCutoverIntentV1({...plan,maintenanceIntentHash:maintenance.maintenanceIntentHash});
  ownerApi.publishDeploymentCutoverIntentWithOwnerV1(actualOwner,intended);
  const baseline=home+'/ai/setrox/data/internal-production-baseline';
  const actualOpenBytes=fs.readFileSync(baseline+'/deployment-cutover-v1/intent.json');
  const actualClaimBytes=fs.readFileSync(baseline+'/deployment-cutover-owner-v1/owner-0001.json');
  const actualOpen=records.parseDeploymentCutoverIntentV1(actualOpenBytes),actualClaim=JSON.parse(actualClaimBytes);
  assert.equal(actualOpen.cutoverIntentHash,intended.cutoverIntentHash);
  assert.equal(new Set([actualOpen.cutoverIntentHash,maintenance.maintenanceIntentHash,maintenance.cutoverPlanHash]).size,3);
  out.ownerOriginals={authority:'actual-source-owner-and-OPEN-manual-build-fixture-only',
    openBytes:actualOpenBytes.toString('base64'),claimBytes:actualClaimBytes.toString('base64'),
    cutoverIntentHash:actualOpen.cutoverIntentHash,maintenanceIntentHash:maintenance.maintenanceIntentHash,
    cutoverPlanHash:maintenance.cutoverPlanHash,ownerClaimHash:actualClaim.ownerClaimHash};
`;

// Independent literal fixture hashes are DATA; production must compare its
// retained actual plist hashes to the genuine OPEN before dispatching anything.
const quietConfigurationSetup=String.raw`
  const {createHash}=await import('node:crypto');
  const quietCanonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):
    Array.isArray(value)?'['+value.map(quietCanonical).join(',')+']':'{'+Object.keys(value).sort()
      .map(key=>JSON.stringify(key)+':'+quietCanonical(value[key])).join(',')+'}';
  const fixtureConfigurationHash=index=>createHash('sha256').update(quietCanonical({
    schema:'setfarm.internal-production-deployment-cutover-launcher-configuration.v1',
    plistPath:home+'/Library/LaunchAgents/'+labels[index]+'.plist',plist:definitions[index]})).digest('hex');
`;
const quietOwnerSetup=ownerSetup.replace(
  "spawnerLauncherConfigurationHash:'4'.repeat(64),dashboardLauncherConfigurationHash:'5'.repeat(64)",
  'spawnerLauncherConfigurationHash:fixtureConfigurationHash(0),dashboardLauncherConfigurationHash:fixtureConfigurationHash(1)');

// Complete launchctl child double: actual owner/OPEN/store/material remain real
// private FS. This is NOT launchd/native/source-build or legacy-exit evidence.
const quietCommandSetup=String.raw`
  const previousQuietSpawn=cp.spawn,quietLoaded=[true,true];
  out.quietChildren=[];out.bootoutArguments=[];out.forbiddenQuietImports=[];
  const forbiddenQuietUrls=new Set([
    root+'/dist/internal-production/baseline-legacy-database-census-v1.js',
    root+'/dist/internal-production/baseline-positive-worktree-physical-catalog-v2.js',
    root+'/dist/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.js',
    root+'/scripts/deployment-dashboard-cutover-first-generation-v2.mjs',
  ].map(locator=>'file://'+locator));
  moduleBuiltin.registerHooks({resolve(specifier,context,next){
    const resolved=next(specifier,context);
    if(forbiddenQuietUrls.has(resolved.url)){
      out.forbiddenQuietImports.push({specifier,url:resolved.url});throw Error('QUIET_IMPORTED_FORBIDDEN_PROVIDER');
    }return resolved;
  },load(url,context,next){
    if(forbiddenQuietUrls.has(url)){out.forbiddenQuietImports.push({url});throw Error('QUIET_EVALUATED_FORBIDDEN_PROVIDER')}
    return next(url,context);
  }});
  cp.spawn=(command,args,options)=>{
    if(command!=='/bin/launchctl')return previousQuietSpawn(command,args,options);
    assert.equal(args.length,2);assert.ok(['print','bootout'].includes(args[0]));
    const index=labels.findIndex(label=>args[1]==='gui/'+process.getuid()+'/'+label);assert.ok(index>=0);
    assert.equal(options.cwd,home);assert.deepEqual(options.stdio,['pipe','pipe','pipe']);
    assert.deepEqual(options.env,{PATH:'/usr/bin:/bin:/usr/sbin:/sbin',LANG:'C',LC_ALL:'C'});
    const journal=baseline+'/deployment-dashboard-cutover-v2';
    if(args[0]==='bootout'){
      const n=index+1,intent=JSON.parse(fs.readFileSync(journal+'/intent-000'+n+'.json'));
      assert.equal(intent.ordinal,n);assert.equal(intent.action,index?'bootout-dashboard':'bootout-spawner');
      assert.equal(intent.cutoverIntentHash,actualOpen.cutoverIntentHash);assert.equal(intent.ownerClaimHash,actualClaim.ownerClaimHash);
      assert.equal(fs.existsSync(journal+'/completion-000'+n+'.json'),false);
      if(index)assert.equal(fs.existsSync(journal+'/completion-0001.json'),true);
      out.bootoutArguments.push([...args]);
    }
    const row={authority:'explicit-launchctl-child-double-not-host-effect',args:[...args],events:[],closed:false};
    out.quietChildren.push(row);
    const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
    child.kill=()=>{throw Error('QUIET_FORBIDDEN_SIGNAL')};
    for(const [name,stream] of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]])
      for(const event of ['finish','end','close'])stream.on(event,()=>row.events.push(name+':'+event));
    child.stdin.resume();child.stdin.on('finish',()=>setImmediate(()=>{
      let status=0,stdout='',stderr='';
      if(args[0]==='bootout'){assert.equal(quietLoaded[index],true);quietLoaded[index]=false}
      else if(quietLoaded[index])stdout=launcherText(index);
      else{status=113;stderr='Bad request.\nCould not find service "'+labels[index]+'" in domain for user gui: '+process.getuid()+'\n'}
      if(args[0]==='print'&&index===0&&!quietLoaded[0]&&globalThis.quietFault==='absent-status')status=3;
      if(args[0]==='print'&&index===0&&!quietLoaded[0]&&globalThis.quietFault==='absent-label')stderr=stderr.replace(labels[0],labels[1]);
      if(args[0]==='bootout'&&index===0&&globalThis.quietFault==='abnormal')status=5;
      if(args[0]==='bootout'&&index===0&&globalThis.quietFault==='dashboard-drift')
        fs.appendFileSync(home+'/Library/LaunchAgents/'+labels[1]+'.plist','\n');
      const finish=()=>{
      child.stdout.end(stdout);child.stderr.end(stderr);
      row.status=status;row.signal=null;child.emit('exit',status,null);row.events.push('child:exit');
      setImmediate(()=>{row.closed=true;row.events.push('child:close');child.emit('close',status,null)});
      };
      if(args[0]==='bootout'&&index===0&&globalThis.quietFault==='missing-eof'){
        globalThis.releaseQuietChild=()=>child.stdout.end(stdout);
        child.stderr.end(stderr);row.status=status;row.signal=null;child.emit('exit',status,null);row.events.push('child:exit');
        setImmediate(()=>{row.closed=true;row.events.push('child:close');child.emit('close',status,null)});
        globalThis.quietChildObserved();
      }else if((args[0]==='bootout'&&index===0&&['response-loss','timeout','stream-error','oversize','native-reentry','native-cache-reentry','definition-reentry'].includes(globalThis.quietFault))
        ||(args[0]==='print'&&index===0&&globalThis.quietFault==='phase-microtask'&&!globalThis.releaseQuietChild)){
        globalThis.releaseQuietChild=finish;globalThis.quietChildObserved();
        if(globalThis.quietFault==='response-loss')child.emit('error',Error('INERT_BOOTOUT_RESPONSE_LOSS'));
        if(globalThis.quietFault==='stream-error')child.stdout.emit('error',Error('INERT_STREAM_ERROR'));
        if(globalThis.quietFault==='oversize')child.stdout.write(Buffer.alloc(1024*1024+1));
      }else finish();
    }));return child;
  };syncBuiltinESMExports();
`;

// Missing producer, wrong order, skipped readback or accidental full preparation
// must fail this REAL journal consumer; a command double alone cannot pass it.
test('native short checking guard burns before nested token metadata authentication',()=>exercise(participants+String.raw`
  const get=WeakMap.prototype.get;let nativeRecord,triggered=0,nested=false,nestedAuth=0,traps=0;
  const proxy=new Proxy({}, {get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
  WeakMap.prototype.get=function(key){const answer=get.call(this,key);
    if(answer?.original===loaded&&answer?.published)nativeRecord=answer;
    if(answer?.enrollments&&answer?.route==='original'&&/at bound \(/.test(Error().stack.split('\n')[2]??'')){
      if(nested)nestedAuth++;
      else if(!triggered&&nativeRecord?.checking&&answer.stage==='working'){
        triggered++;nested=true;try{assert.throws(()=>native.assertHeldDashboardCutoverLoadedJobOperationV4(proxy,proxy))}
        finally{nested=false}
      }
    }return answer};
  await assert.rejects(()=>adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4(loaded,approved));
  out.nativeShortGuard={triggered,nestedAuth,traps};
  assert.equal(triggered,1);assert.equal(traps,0);assert.equal(nestedAuth,0,'NATIVE_SHORT_CHECK_REENTRY_AUTHENTICATED_TOKEN');
`,{resources:true,bounded:true}));

test('launcher quiet original owner records ONLY two once-only journaled bootouts without PG or ROOT',()=>exercise(
  quietConfigurationSetup+quietOwnerSetup+participants+quietCommandSetup+String.raw`
  assert.equal(typeof adapter.quietHeldDashboardCutoverJointLaunchersV4,'function','MISSING_OWNER_BOUND_LAUNCHER_QUIET');
  assert.equal(await adapter.quietHeldDashboardCutoverJointLaunchersV4(loaded,approved,actualOwner),undefined);
  const journal=baseline+'/deployment-dashboard-cutover-v2';
  const intents=[1,2].map(n=>JSON.parse(fs.readFileSync(journal+'/intent-000'+n+'.json')));
  const completions=[1,2].map(n=>JSON.parse(fs.readFileSync(journal+'/completion-000'+n+'.json')));
  assert.deepEqual(intents.map(row=>row.action),['bootout-spawner','bootout-dashboard']);
  assert.deepEqual(completions.map(row=>row.outcome),['launcher-unloaded','launcher-unloaded']);
  assert.equal(intents[0].previousCompletionHash,null);
  assert.equal(intents[1].previousCompletionHash,completions[0].effectCompletionHash);
  for(const [index,row] of completions.entries())assert.equal(row.effectIntentHash,intents[index].effectIntentHash);
  assert.deepEqual(out.bootoutArguments,[['bootout','gui/'+process.getuid()+'/'+labels[0]],['bootout','gui/'+process.getuid()+'/'+labels[1]]]);
  assert.deepEqual(quietLoaded,[false,false]);assert.deepEqual(out.forbiddenQuietImports,[]);
  assert.equal(fs.existsSync(baseline+'/restart-authority-retirement-v1'),false);
  assert.equal(out.reservationChild,undefined);assert.equal(out.nativeCalls,0);
  for(const row of out.quietChildren){assert.equal(row.closed,true);
    for(const event of ['stdin:finish','stdin:close','stdout:end','stdout:close','stderr:end','stderr:close','child:exit','child:close'])
      assert.equal(row.events.includes(event),true,event);
  }
  const before=out.portCounts?.['composite:closeSync']??0;
  assert.throws(()=>native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded));
  assert.throws(()=>definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved));
  assert.equal(out.portCounts?.['composite:closeSync']??0,before);
  await assert.rejects(()=>adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner));
  out.quietJournal={intents,completions};
`,{resources:true,owner:true,quiet:true,bounded:true}));

for(const fault of ['absent-status','absent-label','abnormal','dashboard-drift','response-loss','timeout','missing-eof','stream-error','oversize','native-reentry','native-cache-reentry','definition-reentry'])
test('launcher quiet '+fault+' preserves unknown originals and never dispatches ordinal2',()=>exercise(
  quietConfigurationSetup+quietOwnerSetup+participants+quietCommandSetup+String.raw`
  globalThis.quietFault=${JSON.stringify(fault)};
  let capturedCoordinator,nativeScope,definitionScope,definitionRecord,traps=0,settlements=0,originalChild,originalSettled=false;
  const weakSet=WeakMap.prototype.set,weakGet=WeakMap.prototype.get;
  WeakMap.prototype.set=function(key,value){const answer=weakSet.call(this,key,value);
    if(value?.route==='quiet'&&value?.enrollments)capturedCoordinator=value;return answer};
  WeakMap.prototype.get=function(key){const answer=weakGet.call(this,key);
    if(answer?.original===loaded&&answer?.published)nativeScope=key;
    if(answer?.original===approved&&answer?.published){definitionScope=key;definitionRecord=answer}
    if(Error().stack.includes('settlementToken'))settlements++;return answer};
  const fault=globalThis.quietFault;
  const pending=['response-loss','timeout','missing-eof','stream-error','oversize','native-reentry','native-cache-reentry','definition-reentry'].includes(fault);
  const observed=new Promise(resolve=>{globalThis.quietChildObserved=resolve});
  const work=adapter.quietHeldDashboardCutoverJointLaunchersV4(loaded,approved,actualOwner);work.catch(()=>{});
  if(pending){
    await observed;
    originalChild=definitionRecord.quiet.children.at(-1);
    assert.equal((await import('node:util')).types.isPromise(originalChild.promise),true);
    originalChild.promise.then(()=>{originalSettled=true},()=>{originalSettled=true});
    if(fault.endsWith('reentry')){
      const proxy=new Proxy({}, {get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
      const at=JSON.stringify(out.portCounts);
      assert.throws(()=>fault==='native-reentry'?native.assertHeldDashboardCutoverLoadedJobOperationV4(nativeScope,proxy)
        :fault==='native-cache-reentry'?native.assertHeldDashboardCutoverLoadedJobOperationCacheV4(nativeScope,proxy)
          :definition.assertHeldDashboardCutoverApprovedDefinitionOperationV4(proxy,definitionScope));
      assert.equal(JSON.stringify(out.portCounts),at);assert.equal(traps,0);
      globalThis.releaseQuietChild();
    }
  }
  await assert.rejects(work);
  const journal=baseline+'/deployment-dashboard-cutover-v2';
  assert.equal(fs.existsSync(journal+'/completion-0001.json'),false);
  assert.equal(fs.existsSync(journal+'/intent-0002.json'),false);
  assert.deepEqual(out.bootoutArguments,[['bootout','gui/'+process.getuid()+'/'+labels[0]]]);
  assert.equal(capturedCoordinator.unknown,true);assert.equal(capturedCoordinator.quiet.returned,false);
  assert.equal(settlements,0);
  if(pending&&!fault.endsWith('reentry')){
    const child=out.quietChildren.find(row=>row.args[0]==='bootout');assert.equal(child.closed,fault==='missing-eof');
    assert.equal(originalSettled,false,'QUIET_DRIVER_LOSS_SETTLED_ORIGINAL_CHILD_PROMISE');
    globalThis.releaseQuietChild();await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
    assert.equal(child.closed,true);assert.equal(capturedCoordinator.unknown,true);assert.equal(settlements,0);
    assert.equal(originalSettled,true);assert.equal(originalChild.naturalSettled,true);
  }
  const at=JSON.stringify(out.portCounts);
  assert.throws(()=>native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded));
  assert.throws(()=>definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved));
  assert.equal(JSON.stringify(out.portCounts),at);
  assert.equal(fs.existsSync(baseline+'/restart-authority-retirement-v1'),false);
  assert.deepEqual(out.forbiddenQuietImports,[]);assert.equal(out.nativeCalls,0);
  out.quietFault={fault,traps,settlements,unknown:capturedCoordinator.unknown,secondDispatches:0};
`,{resources:true,owner:true,quiet:true,bounded:true}));

test('launcher quiet lost work registration cannot orphan an already scheduled original Promise',()=>exercise(
  quietConfigurationSetup+quietOwnerSetup+participants+quietCommandSetup+String.raw`
  const get=WeakMap.prototype.get,then=Promise.prototype.then,push=Array.prototype.push;
  let definitionRecord,actualWork=null,losses=0;
  WeakMap.prototype.get=function(key){const answer=get.call(this,key);
    if(answer?.original===approved&&answer?.published)definitionRecord=answer;return answer};
  Promise.prototype.then=function(...args){const answer=then.apply(this,args);
    if(Error().stack.includes('at withQuietDefinitionV4')){actualWork=answer;then.call(answer,undefined,()=>{})}return answer};
  Array.prototype.push=function(...args){
    if(!losses&&definitionRecord?.quiet?.work===this&&Error().stack.includes('at withQuietDefinitionV4')){
      losses++;throw Error('INERT_WORK_REGISTRATION_LOSS')}
    return push.apply(this,args)};
  await assert.rejects(()=>adapter.quietHeldDashboardCutoverJointLaunchersV4(loaded,approved,actualOwner));
  Promise.prototype.then=then;Array.prototype.push=push;WeakMap.prototype.get=get;
  assert.equal(losses,1);
  const retained=actualWork===null||definitionRecord.quiet.work.some(row=>row===actualWork||row.promise===actualWork);
  out.quietWorkRegistration={losses,actualScheduled:actualWork!==null,retained,unknown:definitionRecord.quiet.unknown};
  assert.equal(retained,true,'QUIET_SCHEDULED_ORIGINAL_LOST_BEFORE_REGISTRATION');
  assert.equal(definitionRecord.quiet.unknown,true);assert.deepEqual(out.bootoutArguments,[]);assert.equal(out.quietChildren.length,0);
`,{resources:true,owner:true,quiet:true,bounded:true}));

test('launcher quiet phase original-promise microtask revocation admits no post-await material port',()=>exercise(
  quietConfigurationSetup+quietOwnerSetup+participants+quietCommandSetup+String.raw`
  globalThis.quietFault='phase-microtask';
  let coordinator,nativeScope,definitionRecord,afterBurn,burns=0;
  const set=WeakMap.prototype.set,get=WeakMap.prototype.get;
  WeakMap.prototype.set=function(key,value){const answer=set.call(this,key,value);
    if(value?.route==='quiet'&&value?.enrollments)coordinator=value;return answer};
  WeakMap.prototype.get=function(key){const answer=get.call(this,key);
    if(answer?.original===loaded&&answer?.published)nativeScope=key;
    if(answer?.original===approved&&answer?.published)definitionRecord=answer;return answer};
  const observed=new Promise(resolve=>{globalThis.quietChildObserved=resolve});
  const work=adapter.quietHeldDashboardCutoverJointLaunchersV4(loaded,approved,actualOwner);work.catch(()=>{});
  await observed;
  const original=definitionRecord.quiet.children.at(-1);
  original.promise.then(()=>queueMicrotask(()=>{
    assert.throws(()=>native.assertHeldDashboardCutoverLoadedJobOperationV4(nativeScope));
    burns++;afterBurn=JSON.stringify(out.portCounts);
  }));
  globalThis.releaseQuietChild();await assert.rejects(work);
  out.quietPhaseSeam={burns,afterBurn,afterOuter:JSON.stringify(out.portCounts),children:out.quietChildren.length};
  assert.equal(burns,1);assert.equal(JSON.stringify(out.portCounts),afterBurn,'QUIET_PHASE_POST_AWAIT_MATERIAL_PORT_AFTER_BURN');
  assert.equal(out.quietChildren.length,1);assert.deepEqual(out.bootoutArguments,[]);assert.equal(coordinator.unknown,true);
  assert.equal(fs.existsSync(baseline+'/deployment-dashboard-cutover-v2/intent-0001.json'),false);
`,{resources:true,owner:true,quiet:true,bounded:true}));

for(const kind of ['publication-loss','readback-loss'])
test('launcher quiet intent1 '+kind+' refuses before any bootout',()=>exercise(
  quietConfigurationSetup+quietOwnerSetup+participants+quietCommandSetup+String.raw`
  const kind=${JSON.stringify(kind)},link=fs.linkSync,read=fs.readSync;
  Error.stackTraceLimit=64; // Fixed store composite is deeper than default10 frames.
  let committed=false,losses=0;
  const target=baseline+'/deployment-dashboard-cutover-v2/intent-0001.json';
  fs.linkSync=(from,to)=>{const result=link(from,to);if(to===target){committed=true;
    if(kind==='publication-loss'){losses++;throw Error('INERT_PUBLISH_RESPONSE_LOSS')}}return result};
  fs.readSync=(...args)=>{const result=read(...args);
    if(kind==='readback-loss'&&committed&&fdPaths.get(args[0])===target&&Error().stack.includes('quietHistory')){
      losses++;throw Error('INERT_INDEPENDENT_READBACK_LOSS')}
    return result};syncBuiltinESMExports();
  const result=await adapter.quietHeldDashboardCutoverJointLaunchersV4(loaded,approved,actualOwner)
    .then(()=>({success:true}),error=>({success:false,error:error.message}));
  out.quietIntentLoss={kind,committed,losses,result};
  assert.equal(result.success,false);assert.equal(losses,1,'QUIET_LOSS_CONTROL_NOT_ARMED');
  assert.equal(committed,true);assert.equal(losses,1);assert.deepEqual(out.bootoutArguments,[]);
  assert.equal(fs.existsSync(target),true);assert.equal(fs.existsSync(baseline+'/deployment-dashboard-cutover-v2/completion-0001.json'),false);
  assert.equal(fs.existsSync(baseline+'/deployment-dashboard-cutover-v2/intent-0002.json'),false);
`,{resources:true,owner:true,quiet:true,bounded:true}));

test('launcher quiet owner copy refuses without journal or bootout',()=>exercise(
  quietConfigurationSetup+quietOwnerSetup+participants+quietCommandSetup+String.raw`
  const before=JSON.stringify(out.portCounts);
  await assert.rejects(()=>adapter.quietHeldDashboardCutoverJointLaunchersV4(loaded,approved,{...actualOwner}));
  assert.deepEqual(out.bootoutArguments,[]);
  assert.equal(fs.existsSync(baseline+'/deployment-dashboard-cutover-v2'),false);
  out.quietOwnerCopy={before,after:JSON.stringify(out.portCounts),bootouts:0};
`,{resources:true,owner:true,quiet:true,bounded:true}));

test('launcher quiet cannot adopt an already published matching history prefix',()=>exercise(
  quietConfigurationSetup+quietOwnerSetup+participants+quietCommandSetup+String.raw`
  const store=await import('./dist/internal-production/baseline-dashboard-cutover-store-v2.js');
  const journalRecords=await import('./dist/internal-production/baseline-dashboard-cutover-records-v2.js');
  const empty=store.observeDashboardCutoverStoreV2();
  const row=journalRecords.createDashboardCutoverIntentV2({cutoverIntentHash:actualOpen.cutoverIntentHash,
    ownerClaimHash:actualClaim.ownerClaimHash,ordinal:1,previousCompletionHash:null,beforeObservationHash:'6'.repeat(64)});
  store.publishDashboardCutoverIntentV2(row,empty.storeObservationHash);
  const target=baseline+'/deployment-dashboard-cutover-v2/intent-0001.json',bytes=fs.readFileSync(target);
  await assert.rejects(()=>adapter.quietHeldDashboardCutoverJointLaunchersV4(loaded,approved,actualOwner));
  assert.deepEqual(out.bootoutArguments,[]);assert.equal(out.quietChildren.length,0);assert.ok(fs.readFileSync(target).equals(bytes));
  assert.equal(fs.existsSync(baseline+'/deployment-dashboard-cutover-v2/completion-0001.json'),false);
  out.quietHistoryCopy={unchanged:fs.readFileSync(target).equals(bytes),bootouts:0};
`,{resources:true,owner:true,quiet:true,bounded:true}));

for(const kind of ['genuine-metadata','wrong-arity-proxy'])
test('launcher quiet journal publication '+kind+' reentry burns before bootout',()=>exercise(
  quietConfigurationSetup+quietOwnerSetup+participants+quietCommandSetup+String.raw`
  const kind=${JSON.stringify(kind)},set=WeakMap.prototype.set,link=fs.linkSync;
  let coordinator,triggered=0,nestedRefused=false,traps=0;
  WeakMap.prototype.set=function(key,value){const answer=set.call(this,key,value);
    if(value?.route==='quiet'&&value?.enrollments)coordinator=value;return answer};
  fs.linkSync=(from,to)=>{
    const result=link(from,to);
    if(!triggered&&to===baseline+'/deployment-dashboard-cutover-v2/intent-0001.json'){
      triggered++;const at=JSON.stringify(out.portCounts);
      const proxy=new Proxy({}, {get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
      try{if(kind==='genuine-metadata')ownerApi.assertDeploymentCutoverQuietMetadataV4(coordinator.token,coordinator.enrollments[1].scope);
        else ownerApi.assertDeploymentCutoverQuietMetadataV4(proxy,proxy,undefined)}catch{nestedRefused=true}
      assert.equal(JSON.stringify(out.portCounts),at);
    }return result;
  };syncBuiltinESMExports();
  const result=await adapter.quietHeldDashboardCutoverJointLaunchersV4(loaded,approved,actualOwner)
    .then(()=>({success:true}),error=>({success:false,error:error.message}));
  out.quietStoreReentry={kind,triggered,nestedRefused,traps,result};
  assert.equal(triggered,1);assert.equal(traps,0);assert.equal(nestedRefused,true);
  assert.equal(result.success,false,'QUIET_STORE_COMPOSITE_REENTRY_DID_NOT_BURN');
  assert.deepEqual(out.bootoutArguments,[]);assert.equal(coordinator.unknown,true);
  assert.equal(fs.existsSync(baseline+'/deployment-dashboard-cutover-v2/completion-0001.json'),false);
  assert.equal(fs.existsSync(baseline+'/deployment-dashboard-cutover-v2/intent-0002.json'),false);
`,{resources:true,owner:true,quiet:true,bounded:true}));

test('actual owner OPEN fixture retains independent original bytes before any joint reservation',()=>exercise(ownerSetup+`
  ownerApi.assertDeploymentCutoverOwnerV1(actualOwner);
  assert.equal(fs.existsSync(baseline+'/restart-authority-retirement-v1'),false);
  assert.equal(out.commands.length,0);assert.ok(out.ownerProcessObservations>0);
`,{resources:true,pre32:true,owner:true}));

// These exercise actual canonical registry state, not synthetic drain handles.
// Removing the coordinator's acquisition permits PG/ROOT while the original
// producer/child is live; removing ready-handle rechecks admits later ports.
const localDrainSetup=`
  const local=await import('./dist/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.js');
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  const localSnapshot=()=>({open:p.open,queries:p.queries,
    reservationSpawns:out.portCounts?.['reservation:spawn']??0,
    reservationOpens:out.portCounts?.['reservation:openSync']??0,
    reservationPorts:Object.fromEntries(Object.entries(out.portCounts??{}).filter(([key])=>key.startsWith('reservation:')))});
  const waitLocalBoundary=async()=>{
    for(let probe=0;probe<4096;probe++){
      if(p.open!==0)return {kind:'PG-open',freshEntryRefused:false};
      try{local.withDashboardCutoverLocalProducerSyncV2('workspace-cleanup',()=>{})}
      catch(error){assert.equal(error.message,'DASHBOARD_CUTOVER_LOCAL_PRODUCER_DRAIN_REFUSED');
        return {kind:'fresh-producer-refused',freshEntryRefused:true}}
      await tick();
    }
    throw Error('LOCAL_DRAIN_BOUNDARY_SETUP_EXHAUSTED');
  };
`;

// SAME local originals only. Native loader/compiled output remain manual fixture
// bridges; the owned execFile child below is real, not historical-family proof.
const ingressPreparationSetup=String.raw`
  assert.equal(typeof adapter.prepareHeldDashboardCutoverJointIngressV5,'function','MISSING_PRE_INTENT_INGRESS_PREPARATION');
  const local=await import('./dist/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.js');
  const OriginalPromise=Promise,weakSet=WeakMap.prototype.set;let coordinator;
  WeakMap.prototype.set=function(key,value){const answer=weakSet.call(this,key,value);
    if(value?.route==='ingress'&&value?.enrollments)coordinator=value;return answer};
  out.ingressForbiddenImports=[];
  const forbiddenIngressUrls=new Set([
    root+'/dist/internal-production/baseline-legacy-database-census-v1.js',
    root+'/dist/internal-production/baseline-positive-worktree-physical-catalog-v2.js',
    root+'/dist/internal-production/baseline-positive-worktree-active-binding-snapshot-v1.js',
    root+'/scripts/deployment-dashboard-cutover-first-generation-v2.mjs',
  ].map(locator=>'file://'+locator));
  moduleBuiltin.registerHooks({resolve(specifier,context,next){
    if(forbiddenIngressUrls.has(specifier)||forbiddenIngressUrls.has('file://'+specifier)){
      out.ingressForbiddenImports.push(specifier);throw Error('INGRESS_FORBIDDEN_IMPORT')}
    return next(specifier,context);
  },load(url,context,next){if(forbiddenIngressUrls.has(url)){
    out.ingressForbiddenImports.push(url);throw Error('INGRESS_FORBIDDEN_EVALUATION')}
    return next(url,context)}});
  const observeIngressWait=kind=>{
    let entered;const waiting=new OriginalPromise(resolve=>{entered=resolve});
    globalThis.Promise=new Proxy(OriginalPromise,{construct(target,args){
      const original=Reflect.construct(target,args,target);
      if(Error().stack.includes(kind))entered();return original;
    }});return waiting;
  };
  const assertIngressPending=()=>{
    assert.equal(coordinator.stage,'draining');
    const before=JSON.stringify(out.portCounts);
    assert.throws(()=>adapter.assertDashboardCutoverJointNativeTokenV4(coordinator.token,loaded),
      {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
    assert.throws(()=>adapter.assertDashboardCutoverJointDefinitionTokenV4(coordinator.token,approved),
      {message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
    assert.equal(JSON.stringify(out.portCounts),before);
  };
  const assertIngressUnknown=async()=>{
    assert.ok(coordinator);assert.equal(coordinator.stage,'draining');
    assert.equal(coordinator.unknown,true);assert.equal(coordinator.revoked,true);
    assert.equal(coordinator.localDrain.ready,true);
    for(const kind of ['js','child']){
      const original=coordinator.localDrain[kind];
      assert.equal(original.intent,true);assert.equal(original.returned,true);
      assert.equal(original.settled,true);assert.equal(original.authenticated,true);
      assert.equal((awaitedTypes).isPromise(original.promise),true);assert.ok(original.value);
      assert.equal(await original.promise,original.value);
    }
    local.assertDashboardCutoverLocalProducerDrainV2(coordinator.localDrain.js.value);
    local.assertDashboardCutoverLocalChildDrainV3(coordinator.localDrain.child.value);
    assert.equal(fs.existsSync(baseline+'/deployment-dashboard-cutover-v2'),false);
    assert.equal(fs.existsSync(baseline+'/restart-authority-retirement-v1'),false);
    assert.equal(out.reservationChild,undefined);assert.deepEqual(out.ingressForbiddenImports,[]);
    assert.equal(coordinator.quiet,null);assert.equal(coordinator.pre32.invocationIntent,false);
    assert.equal(coordinator.reservation.invocationIntent,false);assert.equal(out.nativeCalls,0);
  };
  const awaitedTypes=(await import('node:util')).types;
`;

test('ingress preparation waits SAME JS original and closes queued fresh admission before historical refusal',()=>exercise(
  ownerSetup+participants+ingressPreparationSetup+String.raw`
  let finish,bodySettled=false,queued,releaseQueued;
  const original=new OriginalPromise(resolve=>{finish=resolve});
  const producer=local.withDashboardCutoverLocalProducerAsyncV2('workflow-uninstall',()=>{
    const queuedGate=new OriginalPromise(resolve=>{releaseQueued=resolve});
    queued=queuedGate.then(()=>{try{
      local.withDashboardCutoverLocalProducerSyncV2('workspace-cleanup',()=>{throw Error('QUEUED_BODY_DISPATCHED')});
      return 'accepted';
    }catch(error){return error.message}});
    return original;
  });producer.then(()=>{bodySettled=true});
  const waiting=observeIngressWait('acquireDashboardCutoverLocalProducerDrainV2');
  const work=adapter.prepareHeldDashboardCutoverJointIngressV5(loaded,approved,actualOwner);
  const outcome=work.then(()=>({success:true}),error=>({error:error.message}));
  let boundary,before,queuedResult;
  try{
    boundary=await OriginalPromise.race([waiting.then(()=>'original-wait'),outcome.then(()=>'returned')]);
    before={boundary,bodySettled,childIntent:coordinator?.localDrain.child.intent};
    if(boundary==='original-wait'){
      assertIngressPending();
      assert.throws(()=>local.withDashboardCutoverLocalProducerSyncV2('workspace-cleanup',()=>{}));
    }
  }finally{globalThis.Promise=OriginalPromise;finish();await producer;
    releaseQueued();queuedResult=await queued;WeakMap.prototype.set=weakSet}
  const result=await outcome;
  out.ingressPreparation={authority:'actual-local-JS-registry-with-manual-source-build-native-fixture',before,result};
  assert.deepEqual(before,{boundary:'original-wait',bodySettled:false,childIntent:false});
  assert.deepEqual(result,{error:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.equal(queuedResult,'DASHBOARD_CUTOVER_LOCAL_PRODUCER_DRAIN_REFUSED');
  await assertIngressUnknown();
`,{resources:true,owner:true,ingress:true,bounded:true,
  localDrainFault:process.env.SETFARM_INGRESS_COUNTERFACTUAL_RED==='1'?'ingress-immediate-refusal':false}));

test('ingress preparation joins SAME real owned child before historical refusal without effects',()=>exercise(
  ownerSetup+participants+String.raw`
  let child,closed,callback;const events=[];
  const node=${JSON.stringify(fixedNode)},program='process.stdin.resume();process.stdin.on("end",()=>{process.stdout.write("OUT");process.stderr.write("ERR")})';
  cp.execFile=(command,args,done)=>{
    assert.equal(command,node);assert.deepEqual(args,['-e',program]);
    child=originalExecFile(command,args,{cwd:root,env:{},encoding:'utf8'},done);
    closed=new OriginalPromise(resolve=>child.once('close',resolve));
    for(const event of ['exit','close'])child.on(event,(code,signal)=>events.push({event,code,signal}));
    for(const [name,stream] of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]])
      for(const event of name==='stdin'?['close']:['end','close'])stream.on(event,()=>events.push({event:name+':'+event}));
    return child;
  };syncBuiltinESMExports();
`+ingressPreparationSetup+String.raw`
  let before,result;
  try{
    await local.withDashboardCutoverLocalProducerAsyncV2('medic-install',async()=>{
      local.execFileDashboardCutoverLocalChildV3(node,['-e',program],(error,stdout,stderr)=>{callback={error:error?.message??null,stdout,stderr}});
    });
    const waiting=observeIngressWait('acquireDashboardCutoverLocalChildDrainV3');
    const work=adapter.prepareHeldDashboardCutoverJointIngressV5(loaded,approved,actualOwner);
    const outcome=work.then(()=>({success:true}),error=>({error:error.message}));
    const boundary=await OriginalPromise.race([waiting.then(()=>'original-child-wait'),outcome.then(()=>'returned')]);
    before={boundary,events:[...events],callbackReturned:callback!==undefined,jsAuthenticated:coordinator?.localDrain.js.authenticated};
    if(boundary==='original-child-wait')assertIngressPending();
    globalThis.Promise=OriginalPromise;child.stdin.end();result=await outcome;
  }finally{globalThis.Promise=OriginalPromise;WeakMap.prototype.set=weakSet;
    if(child){if(!child.stdin.writableEnded)child.stdin.end();await closed}}
  out.ingressPreparation={authority:'one-real-owned-Node-child-not-historical-family',before,result,events,callback,pid:child.pid};
  assert.deepEqual(before,{boundary:'original-child-wait',events:[],callbackReturned:false,jsAuthenticated:true});
  assert.deepEqual(result,{error:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.deepEqual(callback,{error:null,stdout:'OUT',stderr:'ERR'});
  for(const event of ['stdin:close','stdout:end','stdout:close','stderr:end','stderr:close'])assert.equal(events.filter(row=>row.event===event).length,1);
  for(const event of ['exit','close'])assert.deepEqual(events.find(row=>row.event===event),{event,code:0,signal:null});
  await assertIngressUnknown();
`,{resources:true,owner:true,ingress:true,bounded:true}));

test('ingress preparation rejects idle foreign admission and proxy arity before authentic local conjunction',()=>exercise(
  ownerSetup+participants+ingressPreparationSetup+String.raw`
  const refusal={message:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'};
  let traps=0;const proxy=new Proxy({}, {get(){traps++;throw Error('TRAP')},ownKeys(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
  const before=JSON.stringify(out.portCounts);
  for(const args of [[],[proxy,approved,actualOwner],[loaded,proxy,actualOwner],[loaded,approved,proxy],
    [loaded,approved,actualOwner,undefined]])
    await assert.rejects(()=>adapter.prepareHeldDashboardCutoverJointIngressV5(...args),refusal);
  assert.equal(traps,0);assert.equal(JSON.stringify(out.portCounts),before);assert.equal(coordinator,undefined);
  for(const args of [[{},approved,actualOwner],[loaded,{},actualOwner],[loaded,approved,{}]]){
    await assert.rejects(()=>adapter.prepareHeldDashboardCutoverJointIngressV5(...args),refusal);
    assert.equal(coordinator,undefined,'FOREIGN_INPUT_ADMITTED_OPERATION');
  }
  const authenticationReads=JSON.parse(JSON.stringify(out.portCounts));
  await assert.rejects(()=>adapter.prepareHeldDashboardCutoverJointIngressV5(loaded,approved,actualOwner),refusal);
  await assertIngressUnknown();
  const after=JSON.stringify(out.portCounts);
  await assert.rejects(()=>adapter.prepareHeldDashboardCutoverJointIngressV5(proxy,proxy,proxy,undefined),refusal);
  assert.equal(traps,0);assert.equal(JSON.stringify(out.portCounts),after);
  out.ingressPreparation={authority:'local-empty-registry-still-historical-UNKNOWN-with-trusted-authentication-reads',traps,authenticationReads};
`,{resources:true,owner:true,ingress:true,bounded:true}));

test('local drain waits SAME registered body before first PG or ROOT port',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+localDrainSetup+`
  let finish,settled=false;const original=new Promise(resolve=>{finish=resolve});
  const producer=local.withDashboardCutoverLocalProducerAsyncV2('workflow-uninstall',()=>original);
  void producer.then(()=>{settled=true});
  const reservation=adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner);
  const outcome=reservation.then(()=>({success:true}),error=>({error:error.message}));
  let boundary,before;
  try{boundary=await waitLocalBoundary();before={...localSnapshot(),...boundary,bodySettled:settled}}
  finally{finish();await producer}
  const result=await outcome;out.localDrain={authority:'actual-canonical-registry-body-with-explicit-PG-Python-native-doubles',before,result};
  assert.equal(before.bodySettled,false);
  assert.equal(before.open,0,'LOCAL_DRAIN_PG_OPEN_BEFORE_ORIGINAL_BODY_SETTLEMENT');
  assert.equal(before.reservationSpawns,0);assert.equal(before.reservationOpens,0);
  assert.equal(before.queries,0);assert.deepEqual(before.reservationPorts,{});
  assert.equal(before.freshEntryRefused,true);assert.deepEqual(result,{success:true});
  assert.equal(p.open,1);assert.equal(out.reservationChild.closed,true);
`,{resources:true,pre32:true,owner:true}));

test('local drain unknown original child refuses PG and ROOT after registered JS settles',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+`
  let dispatches=0,callback;
  cp.execFile=(command,args,done)=>{
    assert.equal(command,'/fixture-owned-inert-child');assert.deepEqual(args,['unknown-custody']);
    dispatches++;done(null,'BUSINESS_OUT','BUSINESS_ERR');return undefined;
  };syncBuiltinESMExports();
`+localDrainSetup+`
  await local.withDashboardCutoverLocalProducerAsyncV2('medic-install',async()=>{
    local.execFileDashboardCutoverLocalChildV3('/fixture-owned-inert-child',['unknown-custody'],
      (error,stdout,stderr)=>{callback={error,stdout,stderr}});
  });
  assert.deepEqual(callback,{error:null,stdout:'BUSINESS_OUT',stderr:'BUSINESS_ERR'});
  const result=await adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner)
    .then(()=>({success:true}),error=>({error:error.message}));
  out.localDrain={authority:'explicit-undefined-child-return-double-not-child-execution',dispatches,result,...localSnapshot()};
  assert.deepEqual(result,{error:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'},'LOCAL_DRAIN_UNKNOWN_CHILD_ACCEPTED');
  assert.equal(p.open,0);assert.equal(out.portCounts?.['reservation:spawn']??0,0);
  assert.equal(out.portCounts?.['reservation:openSync']??0,0);assert.equal(dispatches,1);
  assert.equal(p.queries,0);assert.deepEqual(localSnapshot().reservationPorts,{});
`,{resources:true,pre32:true,owner:true}));

test('local drain waits original real Node child and streams before PG',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+`
  let originalChild,childClosed,callbackResult;const events=[];const OriginalPromise=Promise;
  const node=${JSON.stringify(fixedNode)},childProgram='process.stdin.resume();process.stdin.on("end",()=>{process.stdout.write("OUT");process.stderr.write("ERR")})';
  cp.execFile=(command,args,done)=>{
    assert.equal(command,node);assert.deepEqual(args,['-e',childProgram]);
    originalChild=originalExecFile(command,args,{cwd:root,env:{},encoding:'utf8'},done);
    childClosed=new OriginalPromise(resolve=>originalChild.once('close',resolve));
    out.localOriginalChild={pid:originalChild.pid,command,args,options:{cwd:root,env:{},encoding:'utf8'}};
    for(const event of ['exit','close'])originalChild.on(event,(code,signal)=>events.push({event,code,signal}));
    for(const [name,stream] of [['stdout',originalChild.stdout],['stderr',originalChild.stderr],['stdin',originalChild.stdin]])
      for(const event of name==='stdin'?['close']:['end','close'])stream.on(event,()=>events.push({event:name+':'+event}));
    return originalChild;
  };syncBuiltinESMExports();
`+localDrainSetup+`
  let boundary,before,result;
  try{
  await local.withDashboardCutoverLocalProducerAsyncV2('medic-install',async()=>{
    local.execFileDashboardCutoverLocalChildV3(node,['-e',childProgram],
      (error,stdout,stderr)=>{callbackResult={error:error?.message??null,stdout,stderr}});
  });
  // Observe the actual wait-promise constructor at the canonical child-drain
  // boundary. Return SAME native Promise; never mint a fake drain handle.
  let childWaitResolve,pgResolve;
  const childWait=new OriginalPromise(resolve=>{childWaitResolve=resolve});
  const pgOpened=new OriginalPromise(resolve=>{pgResolve=resolve});p.openObserved=pgResolve;
  globalThis.Promise=new Proxy(OriginalPromise,{construct(target,args,newTarget){
    const value=Reflect.construct(target,args,target);
    if(Error().stack.includes('acquireDashboardCutoverLocalChildDrainV3'))childWaitResolve('actual-child-wait');
    return value;
  }});
  const reservation=adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner);
  const outcome=reservation.then(()=>({success:true}),error=>({error:error.message}));
  try{boundary=await OriginalPromise.race([childWait,pgOpened.then(()=>'PG-open'),outcome.then(()=> 'operation-returned')]);
    before={...localSnapshot(),boundary,events:[...events],callbackReturned:callbackResult!==undefined}}
  finally{globalThis.Promise=OriginalPromise;originalChild.stdin.end()}
  result=await outcome;
  }finally{
    globalThis.Promise=OriginalPromise;
    if(originalChild){if(!originalChild.stdin.writableEnded)originalChild.stdin.end();await childClosed}
  }
  out.localDrain={authority:'one-actual-owned-Node-child-leaf-explicit-PG-Python-native-doubles',before,result,events,callbackResult};
  assert.equal(before.boundary,'actual-child-wait','LOCAL_DRAIN_PG_OPEN_BEFORE_REAL_CHILD_SETTLEMENT');
  assert.equal(before.open,0);assert.equal(before.callbackReturned,false);assert.deepEqual(before.events,[]);
  assert.equal(before.queries,0);assert.deepEqual(before.reservationPorts,{});
  assert.deepEqual(result,{success:true});assert.deepEqual(callbackResult,{error:null,stdout:'OUT',stderr:'ERR'});
  for(const event of ['stdout:end','stdout:close','stderr:end','stderr:close','stdin:close'])
    assert.equal(events.filter(row=>row.event===event).length,1);
  for(const event of ['exit','close'])assert.deepEqual(events.find(row=>row.event===event),{event,code:0,signal:null});
`,{resources:true,pre32:true,owner:true}));

test('local drain genuine ready-generation burn inhibits later ports after SAME PG query settles',()=>exercise(
  pre32Setup('callback-loss')+ownerSetup+participants+localDrainSetup+`
  const reservation=adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner);
  const outcome=reservation.then(()=>({success:true}),error=>({error:error.message}));
  await p.suspended;
  const burn=await local.acquireDashboardCutoverLocalProducerDrainV2()
    .then(()=>({success:true}),error=>({error:error.message}));
  const direct=()=>Object.fromEntries(Object.entries(out.portCounts??{}).filter(([key])=>
    key.startsWith('native:')||key.startsWith('definition:')||key.startsWith('reservation:')));
  const before=direct();p.resumeOriginalQuery();const result=await outcome;
  const after=direct();out.localDrain={authority:'actual-canonical-ready-generation-burn-driver-double',burn,before,after,result,querySettled:p.querySettled};
  assert.deepEqual(burn,{error:'DASHBOARD_CUTOVER_LOCAL_PRODUCER_DRAIN_REFUSED'},'LOCAL_DRAIN_READY_GENERATION_NOT_ACQUIRED');
  assert.deepEqual(result,{error:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.equal(p.querySettled,true);assert.deepEqual(after,before);
  assert.equal(out.portCounts?.['reservation:spawn']??0,0);
`,{resources:true,pre32:true,owner:true}));

test('local drain pending reentry burns before proxy traps PG ROOT and original settlement',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+localDrainSetup+`
  let finish;const original=new Promise(resolve=>{finish=resolve});
  const producer=local.withDashboardCutoverLocalProducerAsyncV2('workflow-uninstall',()=>original);
  const reservation=adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner);
  const outcome=reservation.then(()=>({success:true}),error=>({error:error.message}));
  let boundary,traps=0,reentry;
  const proxy=new Proxy({},{get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')}});
  try{boundary=await waitLocalBoundary();
    reentry=await adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(proxy,proxy,proxy,{})
      .then(()=>({success:true}),error=>({error:error.message}))}
  finally{finish();await producer}
  const result=await outcome;out.localDrain={authority:'actual-canonical-pending-drain-reentry',boundary,reentry,result,traps,...localSnapshot()};
  assert.equal(boundary.freshEntryRefused,true);
  assert.deepEqual(reentry,{error:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.deepEqual(result,{error:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.equal(traps,0);assert.equal(p.open,0);assert.equal(out.portCounts?.['reservation:spawn']??0,0);
  assert.equal(p.queries,0);assert.deepEqual(localSnapshot().reservationPorts,{});
`,{resources:true,pre32:true,owner:true}));

test('local drain captured genuine scopes deny all direct ports while JS original remains pending',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+localDrainSetup+`
  const get=WeakMap.prototype.get;let nativeScope,definitionScope;
  WeakMap.prototype.get=function(key){const value=get.call(this,key);
    if(value?.original===loaded&&value.published)nativeScope=key;
    if(value?.original===approved&&value.published)definitionScope=key;
    return value;
  };
  let finish;const original=new Promise(resolve=>{finish=resolve});
  const producer=local.withDashboardCutoverLocalProducerAsyncV2('workflow-uninstall',()=>original);
  const reservation=adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner);
  const outcome=reservation.then(()=>({success:true}),error=>({error:error.message}));
  const direct=()=>Object.fromEntries(Object.entries(out.portCounts??{}).filter(([key])=>!key.startsWith('composite:')));
  let boundary,before,after,nativeRefused=false,definitionRefused=false;
  try{boundary=await waitLocalBoundary();before=direct();
    try{native.assertHeldDashboardCutoverLoadedJobOperationV4(nativeScope)}catch{nativeRefused=true}
    try{definition.assertHeldDashboardCutoverApprovedDefinitionOperationV4(definitionScope)}catch{definitionRefused=true}
    after=direct();
  }finally{WeakMap.prototype.get=get;finish();await producer}
  const result=await outcome;
  out.localDrain={authority:'actual-captured-bilateral-scopes-pending-canonical-JS-drain',
    boundary,capturedNative:!!nativeScope,capturedDefinition:!!definitionScope,
    nativeRefused,definitionRefused,before,after,afterSettlement:direct(),result,...localSnapshot()};
  assert.equal(boundary.freshEntryRefused,true);assert.ok(nativeScope);assert.ok(definitionScope);
  assert.equal(nativeRefused,true,'LOCAL_DRAIN_STAGE_ADMITTED_NATIVE_SCOPE');assert.equal(definitionRefused,true);
  assert.deepEqual(after,before);assert.deepEqual(direct(),before);
  assert.deepEqual(result,{error:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.equal(p.open,0);assert.equal(p.queries,0);assert.deepEqual(localSnapshot().reservationPorts,{});
`,{resources:true,pre32:true,owner:true,
  localDrainFault:process.env.SETFARM_LOCAL_DRAIN_COUNTERFACTUAL_RED==='1'?'pending-stage-working':false}));

test('local drain lost original observer response retains SAME later fulfilled JS handle',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+localDrainSetup+`
  const set=WeakMap.prototype.set,apply=Reflect.apply;let coordinator,triggered=0;
  WeakMap.prototype.set=function(key,value){const result=set.call(this,key,value);
    if(value?.originalLoaded===loaded&&value.originalDefinition===approved&&value.route==='reservation')coordinator=value;
    return result;
  };
  Reflect.apply=function(target,thisArg,args){const result=apply(target,thisArg,args);
    if(!triggered&&target===Promise.prototype.then&&thisArg===coordinator?.localDrain.js.promise
      &&Error().stack.includes('acquireLocalDrainOriginal')){
      triggered++;throw Error('ACTUAL_INTRINSIC_OBSERVER_RESPONSE_LOST');
    }return result;
  };
  let result,fulfilled;
  try{
    result=await adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner)
      .then(()=>({success:true}),error=>({error:error.message}));
    assert.ok(coordinator);fulfilled=await coordinator.localDrain.js.promise;await tick();
  }finally{WeakMap.prototype.set=set;Reflect.apply=apply}
  // No legacy/reentry burn before observing original fulfillment and retention.
  local.assertDashboardCutoverLocalProducerDrainV2(fulfilled);
  const js=coordinator.localDrain.js,child=coordinator.localDrain.child;
  out.localDrain={authority:'actual-original-intrinsic-observer-installed-then-response-loss',
    triggered,result,retainedSameValue:js.value===fulfilled,returned:js.returned,settled:js.settled,
    authenticOriginal:true,promiseNative:(await import('node:util')).types.isPromise(js.promise),
    ready:coordinator.localDrain.ready,unknown:coordinator.unknown,childIntent:child.intent,...localSnapshot()};
  assert.equal(triggered,1);assert.equal(js.value,fulfilled,'LOCAL_DRAIN_FULFILLED_HANDLE_DISCARDED');
  assert.equal(js.returned,true);assert.equal(js.settled,true);assert.equal(child.intent,false);
  assert.equal(coordinator.localDrain.ready,false);assert.equal(coordinator.unknown,true);
  assert.deepEqual(result,{error:'DASHBOARD_CUTOVER_JOINT_ORIGINAL_OPERATION_REFUSED'});
  assert.equal(p.open,0);assert.equal(p.queries,0);assert.deepEqual(localSnapshot().reservationPorts,{});
`,{resources:true,pre32:true,owner:true,
  localDrainFault:process.env.SETFARM_LOCAL_DRAIN_COUNTERFACTUAL_RED==='1'?'drop-fulfilled-custody':false}));

const physicalSnapshot=String.raw`
  const physicalSnapshot=()=>({
    descriptors:(out.physicalFds??[]).map(row=>{let state,identity;
      try{const s=originalStat(row.fd,{bigint:true});state='live';identity={dev:String(s.dev),ino:String(s.ino),
        birthtimeNs:String(s.birthtimeNs),mode:String(s.mode),uid:String(s.uid)}}catch(error){state=error.code}
      return {...row,state,currentIdentity:identity??null}}),
    reservationPorts:Object.fromEntries(Object.entries(out.portCounts??{}).filter(([key])=>key.startsWith('reservation:'))),
    bindingQueries:p.bindingQueries??[],exactJournal:p.exactJournal,open:p.open,end:p.end,held:p.held,
  });
`;

const capturePhysicalCoordinator=String.raw`
  let actualCoordinator;
  const originalWeakSet=WeakMap.prototype.set;
  WeakMap.prototype.set=function(key,value){const returned=Reflect.apply(originalWeakSet,this,[key,value]);
    if(value?.route==='reservation'&&value?.pre32&&value?.enrollments)actualCoordinator=value;
    return returned};
  const directPhysicalCounters=()=>Object.fromEntries(Object.entries(out.portCounts??{}).filter(([key])=>!key.startsWith('composite:')));
`;

const privatePhysicalGit=String.raw`
  const privateGit=args=>{const result=cp.spawnSync('/usr/bin/git',args,{encoding:'utf8',env:{
    PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_OPTIONAL_LOCKS:'0'}});
    assert.equal(result.status,0,result.stderr);return result.stdout.trim()};
  const privateRepo=(directory,origin)=>{
    privateGit(['init','-q',directory]);privateGit(['-C',directory,'config','user.name','Fixture']);
    privateGit(['-C',directory,'config','user.email','fixture@example.invalid']);
    privateGit(['-C',directory,'commit','-q','--allow-empty','-m','initial']);
    if(origin)privateGit(['-C',directory,'remote','add','origin',origin]);
  };
`;

test('physical binding healthy retained linked marker and directories survive actual outer success',()=>exercise(
  pre32Setup('healthy')+ownerSetup+privatePhysicalGit+`
  const primary=home+'/ai/setrox/setfarm',linked=home+'/ai/setrox/.worktrees/linked';
  privateRepo(primary,'https://github.com/hikmetgulsesli/setfarm.git');
  fs.mkdirSync(path.dirname(linked),{recursive:true,mode:0o700});
  privateGit(['-C',primary,'worktree','add','-q','-b','retained-fixture',linked]);
  `+participants+physicalSnapshot+`
  globalThis.physicalProbe={capture:true};
  const result=await adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner)
    .then(()=>({success:true}),error=>({success:false,error:error.message}));
  const snapshot=physicalSnapshot();
  const markerReads=(out.physicalReads??[]).filter(row=>row.path===linked+'/.git');
  out.physicalBinding={authority:'actual-private-Git-FS-originals-explicit-PG-lsof-Python-native-doubles',result,snapshot,markerReads};
  assert.equal(result.success,true);
  assert.ok(snapshot.descriptors.length>14);assert.ok(snapshot.descriptors.some(row=>row.path===linked+'/.git'));
  assert.ok(markerReads.filter(row=>row.position===0&&row.result>0).length>=2);
  assert.equal(new Set(markerReads.map(row=>row.fd)).size,1);
  const markerOpens=snapshot.descriptors.filter(row=>row.path===linked+'/.git');
  assert.equal(markerOpens.length,1);
  assert.ok(markerReads.every(row=>row.fd===markerOpens[0].fd));
  assert.ok(snapshot.descriptors.every(row=>row.state==='live'&&row.returned&&row.closeIntents===0&&
    JSON.stringify(row.identity)===JSON.stringify(row.currentIdentity)));
  assert.equal(p.open,1);assert.equal(p.begins,1);assert.equal(p.end,1);assert.equal(p.endReturned,true);
  assert.equal(p.bindingQueries.length,8);assert.ok(p.bindingQueries.every(row=>row.transaction===p.censusTransaction&&row.beginOccurrence===1));
  assert.equal(out.reservationChild.publishedWhilePgHeld,true);
  assert.deepEqual(fs.readFileSync(baseline+'/deployment-cutover-v1/intent.json'),actualOpenBytes);
  assert.deepEqual(fs.readFileSync(baseline+'/deployment-cutover-owner-v1/owner-0001.json'),actualClaimBytes);
`,{resources:true,pre32:true,owner:true}));

for(const kind of ['runtime','referenced-retained'])test('physical binding complete '+kind+' candidate still refuses cold-zero ROOT',()=>exercise(
  pre32Setup('healthy')+ownerSetup+privatePhysicalGit+`
  const kind=${JSON.stringify(kind)};
  const primary=kind==='runtime'?home+'/projects/project':home+'/ai/setrox/setfarm';
  const linked=kind==='runtime'?primary+'/.worktrees/runtime':home+'/ai/setrox/.worktrees/retained';
  privateRepo(primary,kind==='runtime'?null:'https://github.com/hikmetgulsesli/setfarm.git');
  fs.mkdirSync(path.dirname(linked),{recursive:true,mode:0o700});
  privateGit(['-C',primary,'worktree','add','-q','-b','candidate-fixture',linked]);
  globalThis.physicalProbe={capture:false,pid:kind==='referenced-retained'?424242:null};
  const physical=await import('./dist/internal-production/baseline-positive-worktree-physical-catalog-v2.js');
  const diagnostic=await physical.observeCodeOwnedPositiveWorktreePhysicalCatalogV2();
  assert.equal(diagnostic.status,'complete');assert.equal(diagnostic.entries.length,1);
  assert.equal(diagnostic.entries[0].zone,kind==='runtime'?'runtime-zone':'retained-zone');
  assert.deepEqual(diagnostic.entries[0].referencingPids,kind==='runtime'?[]:[424242]);
  out.completeCandidate={authority:'actual-private-Git-FS-with-explicit-lsof-reference-double',kind,diagnostic};
  `+participants+physicalSnapshot+`
  globalThis.physicalProbe.capture=true;
  const result=await adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner)
    .then(()=>({success:true}),error=>({success:false,error:error.message}));
  out.physicalBinding={authority:'actual-source-cold-zero-policy-with-explicit-PG-lsof-Python-native-doubles',result,snapshot:physicalSnapshot()};
  assert.deepEqual(out.physicalBinding.snapshot.reservationPorts,{});assert.equal(result.success,false);
  assert.equal(fs.existsSync(baseline+'/restart-authority-retirement-v1'),false);
`,{resources:true,pre32:true,owner:true}));

test('physical binding post-binding actual directory drift refuses owner and ROOT',()=>exercise(
  pre32Setup('binding-drift')+ownerSetup+participants+physicalSnapshot+capturePhysicalCoordinator+`
  globalThis.physicalProbe={capture:true};
  const operation=adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner)
    .then(()=>({success:true}),error=>({success:false,error:error.message}));
  const boundary=await Promise.race([p.bindingSuspended.then(()=>({kind:'binding'})),operation.then(result=>({kind:'operation',result}))]);
  if(boundary.kind!=='binding'){out.physicalBinding={boundary,snapshot:physicalSnapshot()};assert.equal(boundary.kind,'binding')}
  const before=physicalSnapshot();fs.mkdirSync(home+'/projects/appeared-during-binding',{mode:0o700});
  p.resumeBinding();const result=await operation;
  out.physicalBinding={authority:'actual-private-held-directory-drift-during-SAME-modeled-query',before,result,snapshot:physicalSnapshot()};
  assert.equal(p.bindingSettled,true);assert.equal(result.success,false);
  assert.equal(actualCoordinator.reservation.invocationIntent,false);
  assert.deepEqual(out.physicalBinding.snapshot.reservationPorts,{});
  assert.equal(fs.existsSync(baseline+'/restart-authority-retirement-v1'),false);
`,{resources:true,pre32:true,owner:true}));

test('physical binding original final query loss revokes BEFORE suspended end and retains SAME FDs',()=>exercise(
  pre32Setup('final-loss')+ownerSetup+participants+physicalSnapshot+capturePhysicalCoordinator+`
  const physical=await import('./dist/internal-production/baseline-positive-worktree-physical-catalog-v2.js');
  globalThis.physicalProbe={capture:true};p.holdEnd=true;
  const operation=adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner);operation.catch(()=>{});
  await p.suspended;assert.equal(p.suspendedAt,4);assert.equal(out.reservationChild.published,true);
  p.rejectDriver(Error('ACTUAL_MODELED_BEGIN_RESPONSE_LOSS'));await p.ended;
  const before=physicalSnapshot(),revokedBeforeEnd=actualCoordinator.revoked;
  const ports=directPhysicalCounters();
  assert.throws(()=>native.assertHeldDashboardCutoverLoadedJobOperationV4(actualCoordinator.enrollments[0].scope));
  assert.throws(()=>definition.assertHeldDashboardCutoverApprovedDefinitionOperationV4(actualCoordinator.enrollments[1].scope));
  assert.throws(()=>physical.assertHeldDashboardCutoverJointPhysicalReservationV4(actualCoordinator.pre32.scope,actualOwner,actualCoordinator.token));
  const afterRefusal=directPhysicalCounters();
  p.resumeOriginalQuery();await assert.rejects(()=>p.actualCallback);
  const afterQuery=physicalSnapshot();p.resumeEnd();await assert.rejects(()=>operation);
  const after=physicalSnapshot();
  out.physicalBinding={authority:'SAME-source-PG-composite-response-loss-explicit-driver-lsof-Python-native-doubles',
    revokedBeforeEnd,before,ports,afterRefusal,afterQuery,after};
  assert.equal(revokedBeforeEnd,true);assert.deepEqual(afterRefusal,ports);
  assert.ok(before.descriptors.length>0);assert.deepEqual(afterQuery.descriptors,before.descriptors);
  assert.deepEqual(after.descriptors,before.descriptors);
  assert.ok(after.descriptors.every(row=>row.state==='live'&&row.closeIntents===0));
  assert.deepEqual(directPhysicalCounters(),ports);assert.equal(p.querySettled,true);assert.equal(p.endReturned,true);
`,{resources:true,pre32:true,owner:true}));

test('physical binding successful begin with suspended end denies physical ports before outer success',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+physicalSnapshot+capturePhysicalCoordinator+`
  const physical=await import('./dist/internal-production/baseline-positive-worktree-physical-catalog-v2.js');
  globalThis.physicalProbe={capture:true};p.holdEnd=true;
  const operation=adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner);operation.catch(()=>{});
  await p.ended;
  const before=physicalSnapshot(),ports=directPhysicalCounters(),revokedBefore=actualCoordinator.revoked;
  let refused=false;
  try{physical.assertHeldDashboardCutoverJointPhysicalReservationV4(actualCoordinator.pre32.scope,actualOwner,actualCoordinator.token)}catch{refused=true}
  const afterRefusal=directPhysicalCounters();p.resumeEnd();
  const result=await operation.then(()=>({success:true}),error=>({success:false,error:error.message}));
  out.physicalBinding={authority:'actual-source-successful-begin-pending-end-phase-with-explicit-provider-doubles',
    before,ports,revokedBefore,refused,afterRefusal,result,after:physicalSnapshot()};
  assert.equal(revokedBefore,false);assert.equal(refused,true);assert.deepEqual(afterRefusal,ports);
  assert.equal(result.success,false);assert.deepEqual(out.physicalBinding.after.descriptors,before.descriptors);
`,{resources:true,pre32:true,owner:true}));

test('physical binding owner-entry reentry burns before any nested direct port or owner intent',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+physicalSnapshot+capturePhysicalCoordinator+`
  globalThis.physicalProbe={capture:true};let nested,triggered=0,nestedResult;
  onPort=row=>{if(row.owner==='physical'&&row.physicalOwnerEntry&&triggered++===0){
    const before=directPhysicalCounters();
    nested=adapter.executeDashboardCutoverJointPhysicalOwnerReservationV4(actualCoordinator.token,actualOwner,actualCoordinator.pre32.scope);
    nestedResult=nested.then(()=>({success:true}),error=>({success:false,error:error.message}));
    out.physicalReentry={before,after:directPhysicalCounters(),ownerIntent:actualCoordinator.reservation.invocationIntent};
  }};
  const result=await adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner)
    .then(()=>({success:true}),error=>({success:false,error:error.message}));
  onPort=()=>{};const nestedOutcome=await nestedResult;
  out.physicalBinding={authority:'actual-source-original-tuple-reentry-explicit-PG-lsof-Python-native-doubles',result,
    snapshot:physicalSnapshot(),reentry:out.physicalReentry,nestedOutcome,triggered};
  assert.ok(out.physicalReentry);assert.equal(result.success,false);assert.equal(nestedOutcome.success,false);
  assert.deepEqual(out.physicalReentry.after,out.physicalReentry.before);
  assert.equal(out.physicalReentry.ownerIntent,false);assert.equal(actualCoordinator.reservation.invocationIntent,false);
  assert.deepEqual(out.physicalBinding.snapshot.reservationPorts,{});
`,{resources:true,pre32:true,owner:true}));

test('physical binding full assertion reentry burns before any nested direct port',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+physicalSnapshot+capturePhysicalCoordinator+`
  const physical=await import('./dist/internal-production/baseline-positive-worktree-physical-catalog-v2.js');
  globalThis.physicalProbe={capture:true};let triggered=0;
  onPort=row=>{if(row.owner==='physical'&&row.physicalFullAssertion&&triggered++===0){
    const before=directPhysicalCounters();let refused=false;
    try{physical.assertHeldDashboardCutoverJointPhysicalReservationV4(actualCoordinator.pre32.scope,actualOwner,actualCoordinator.token)}catch{refused=true}
    out.physicalReentry={before,after:directPhysicalCounters(),refused};
  }};
  const result=await adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner)
    .then(()=>({success:true}),error=>({success:false,error:error.message}));
  onPort=()=>{};
  out.physicalBinding={authority:'actual-source-full-assertion-tuple-reentry-explicit-PG-lsof-Python-native-doubles',
    result,snapshot:physicalSnapshot(),reentry:out.physicalReentry,triggered};
  assert.ok(out.physicalReentry);assert.equal(out.physicalReentry.refused,true);
  assert.deepEqual(out.physicalReentry.after,out.physicalReentry.before);assert.equal(result.success,false);
`,{resources:true,pre32:true,owner:true}));

test('physical binding private terminal recheck refuses public reentry before extra direct ports',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+physicalSnapshot+capturePhysicalCoordinator+`
  const physical=await import('./dist/internal-production/baseline-positive-worktree-physical-catalog-v2.js');
  const lines=fs.readFileSync(root+'/dist/internal-production/baseline-positive-worktree-physical-catalog-v2.js','utf8').split('\\n');
  const terminalLine=lines.findLastIndex(line=>line.trim()==='record.recheck();')+1;assert.ok(terminalLine>0);
  globalThis.physicalProbe={capture:true};let triggered=0;
  onPort=row=>{if(row.owner==='physical'&&row.physicalStack.some(frame=>frame.includes('runHeldDashboardCutoverJointPhysicalReservationV4')&&frame.includes(':'+terminalLine+':'))&&triggered++===0){
    const before=directPhysicalCounters();let refused=false;
    try{physical.assertHeldDashboardCutoverJointPhysicalReservationV4(actualCoordinator.pre32.scope,actualOwner,actualCoordinator.token)}catch{refused=true}
    out.physicalReentry={before,after:directPhysicalCounters(),refused,terminalLine,frames:row.physicalStack};
  }};
  const result=await adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner)
    .then(()=>({success:true}),error=>({success:false,error:error.message}));
  onPort=()=>{};
  out.physicalBinding={authority:'actual-source-private-terminal-check-public-reentry-explicit-provider-doubles',result,
    snapshot:physicalSnapshot(),reentry:out.physicalReentry,triggered};
  assert.ok(out.physicalReentry);assert.equal(out.physicalReentry.refused,true);
  assert.deepEqual(out.physicalReentry.after,out.physicalReentry.before);assert.equal(result.success,false);
`,{resources:true,pre32:true,owner:true}));

test('physical binding post-owner private recheck burns wrong-arity proxy reentry before extra direct ports',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+physicalSnapshot+capturePhysicalCoordinator+`
  const physical=await import('./dist/internal-production/baseline-positive-worktree-physical-catalog-v2.js');
  const lines=fs.readFileSync(root+'/dist/internal-production/baseline-positive-worktree-physical-catalog-v2.js','utf8').split('\\n');
  const postOwnerBranch=lines.findLastIndex((line,index)=>line.trim()==='if (retained)'&&lines[index+1]?.trim()==='retained.recheck();');
  const postOwnerLine=postOwnerBranch+2;assert.ok(postOwnerBranch>=0);
  let traps=0;const proxy=new Proxy({}, {get(){traps++;throw Error('UNREACHABLE_PROXY')},ownKeys(){traps++;throw Error('UNREACHABLE_PROXY')}});
  globalThis.physicalProbe={capture:true};let triggered=0;
  onPort=row=>{if(row.owner==='physical'&&row.physicalStack.some(frame=>frame.includes('observePhysicalCatalogV2')&&frame.includes(':'+postOwnerLine+':'))&&triggered++===0){
    const before=directPhysicalCounters();let refused=false;
    try{physical.assertHeldDashboardCutoverJointPhysicalReservationV4(proxy)}catch{refused=true}
    out.physicalReentry={before,after:directPhysicalCounters(),refused,postOwnerLine,traps,frames:row.physicalStack};
  }};
  const result=await adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner)
    .then(()=>({success:true}),error=>({success:false,error:error.message}));
  onPort=()=>{};
  out.physicalBinding={authority:'actual-source-post-owner-private-check-wrong-arity-proxy-reentry-explicit-provider-doubles',result,
    snapshot:physicalSnapshot(),reentry:out.physicalReentry,triggered,traps};
  assert.ok(out.physicalReentry);assert.equal(out.physicalReentry.refused,true);assert.equal(traps,0);
  assert.deepEqual(out.physicalReentry.after,out.physicalReentry.before);assert.equal(result.success,false);
`,{resources:true,pre32:true,owner:true}));

test('physical binding first-pass non-Git blocker prevents actual ROOT reservation',()=>exercise(
  pre32Setup('healthy')+`
  const unknown=home+'/ai/setrox/.worktrees/unknown';fs.mkdirSync(unknown,{recursive:true,mode:0o700});
  const physical=await import('./dist/internal-production/baseline-positive-worktree-physical-catalog-v2.js');
  const diagnostic=await physical.observeCodeOwnedPositiveWorktreePhysicalCatalogV2();
  assert.equal(diagnostic.status,'unresolved');assert.deepEqual(diagnostic.blockers,[{root:unknown,reason:'non-git-child'}]);
  out.actualBlocker={status:diagnostic.status,blockers:diagnostic.blockers};
  `+ownerSetup+participants+physicalSnapshot+`
  globalThis.physicalProbe={capture:true};
  const result=await adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner)
    .then(()=>({success:true}),error=>({success:false,error:error.message}));
  out.physicalBinding={authority:'actual-private-FS-with-explicit-PG-lsof-Python-native-doubles',result,snapshot:physicalSnapshot()};
  assert.deepEqual(out.physicalBinding.snapshot.reservationPorts,{});
  assert.equal(result.success,false);assert.equal(fs.existsSync(baseline+'/restart-authority-retirement-v1'),false);
`,{resources:true,pre32:true,owner:true}));

test('physical binding SAME transaction crossed rows prevent actual ROOT reservation',()=>exercise(
  pre32Setup('binding-crossed')+ownerSetup+participants+physicalSnapshot+`
  globalThis.physicalProbe={capture:true};
  const result=await adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner)
    .then(()=>({success:true}),error=>({success:false,error:error.message}));
  out.physicalBinding={authority:'deliberately-crossed-modeled-PG-evidence-not-real-PG-consistency',result,snapshot:physicalSnapshot()};
  assert.deepEqual(out.physicalBinding.snapshot.reservationPorts,{});
  assert.equal(result.success,false);assert.equal(fs.existsSync(baseline+'/restart-authority-retirement-v1'),false);
  assert.equal(p.bindingQueries.length,8);assert.equal(p.open,1);assert.equal(p.begins,1);
  assert.ok(p.bindingQueries.every(row=>row.transaction===p.censusTransaction&&row.beginOccurrence===1));
  assert.ok(p.journalTransactions.every(row=>row.transaction===p.censusTransaction&&row.beginOccurrence===1));
`,{resources:true,pre32:true,owner:true}));

test('owner-bound reservation uses actual OPEN and claim while genuine pre32 scope remains held',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+`
  assert.equal(typeof adapter.reserveHeldDashboardCutoverJointFirstGenerationV4,'function','MISSING_OWNER_BOUND_ROOT_RESERVATION');
  const result=await adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner);
  assert.equal(result,undefined);
  assert.equal(out.reservationChild.dispatchedWhilePgHeld,true);assert.equal(out.reservationChild.publishedWhilePgHeld,true);
  assert.equal(out.reservationChild.closed,true);assert.equal(out.reservationChild.status,0);
  const reservationRoot=baseline+'/restart-authority-retirement-v1';
  assert.deepEqual(fs.readdirSync(reservationRoot),['physical-service-restart-authority.transition.lock']);
  const wire=JSON.parse(fs.readFileSync(reservationRoot+'/physical-service-restart-authority.transition.lock'));
  assert.equal(wire.cutoverIntentHash,actualOpen.cutoverIntentHash);assert.equal(wire.ownerClaimHash,actualClaim.ownerClaimHash);
  assert.notEqual(wire.owner.reservationNonce,actualClaim.owner.reservationNonce);
  for(const field of ['pid','uid','processLstart','processGroupId','bootSessionHash'])assert.equal(wire.owner[field],actualClaim.owner[field]);
  assert.equal(p.open,1);assert.equal(p.end,1);assert.equal(p.exactJournal,4);assert.equal(p.callbackSettled,true);
  assert.deepEqual(p.events.filter(e=>e.startsWith('LOCK TABLE ')),${JSON.stringify(expectedPre32Locks)});
  assert.equal(fs.readFileSync(baseline+'/deployment-cutover-v1/intent.json').equals(actualOpenBytes),true);
  assert.equal(fs.readFileSync(baseline+'/deployment-cutover-owner-v1/owner-0001.json').equals(actualClaimBytes),true);
  out.reservationWire=wire;out.pre32={mode:p.mode,events:p.events,open:p.open,end:p.end,exactJournal:p.exactJournal};
`,{resources:true,pre32:true,owner:true}));

for(const fault of ['owner-namespace','OPEN-maintenance','swallowed-owner-reentry']){
  test('owner-bound reservation refuses '+fault+' before ROOT dispatch',()=>exercise(
    pre32Setup('healthy')+ownerSetup+participants+`
    assert.equal(typeof adapter.reserveHeldDashboardCutoverJointFirstGenerationV4,'function','MISSING_OWNER_BOUND_ROOT_RESERVATION');
    const fault=${JSON.stringify(fault)};let triggered=0,traps=0,nestedRefused=false;
    if(fault==='owner-namespace'){
      fs.renameSync(baseline+'/deployment-cutover-owner-v1',baseline+'/deployment-cutover-owner-v1.retained');
      fs.mkdirSync(baseline+'/deployment-cutover-owner-v1',{mode:0o700});triggered++;
    }else if(fault==='OPEN-maintenance'){
      fs.renameSync(baseline+'/deployment-cutover-v1',baseline+'/deployment-cutover-v1.retained');
      fs.mkdirSync(baseline+'/deployment-cutover-v1',{mode:0o700});
      const crossed=records.createDeploymentCutoverIntentV1({...plan,cliLinkObservationHash:'9'.repeat(64),maintenanceIntentHash:maintenance.maintenanceIntentHash});
      fs.writeFileSync(baseline+'/deployment-cutover-v1/intent.json',records.encodeDeploymentCutoverIntentV1(crossed),{flag:'wx',mode:0o600});triggered++;
    }else{
      const proxy=new Proxy({}, {get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')},ownKeys(){traps++;throw Error('TRAP')}});
      onPort=row=>{if(!triggered&&row.name==='fstatSync'&&row.path===baseline+'/deployment-cutover-v1/intent.json'){
        triggered++;try{ownerApi.observeDashboardCutoverOwnerBindingsV2(proxy,undefined)}catch{nestedRefused=true}
      }};
    }
    await assert.rejects(()=>adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner));
    assert.equal(triggered,1);assert.equal(traps,0);
    if(fault==='swallowed-owner-reentry')assert.equal(nestedRefused,true);
    assert.equal(out.reservationChild,undefined);assert.equal(fs.existsSync(baseline+'/restart-authority-retirement-v1'),false);
    out.ownerFault={fault,triggered,traps,nestedRefused};
  `,{resources:true,pre32:true,owner:true}));
}

test('owner-bound original token and owner reject source-call input COPY before first parent port',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+`
  await assert.rejects(()=>adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner));
  assert.equal(p.open,1);assert.equal(p.end,1);assert.equal(p.callbackSettled,true);
  assert.equal(out.reservationChild,undefined);assert.equal((out.reservationFds??[]).length,0);
  assert.equal(Object.keys(out.portCounts??{}).some(key=>key.startsWith('reservation:')),false);
  assert.equal(fs.existsSync(baseline+'/restart-authority-retirement-v1'),false);
  out.copiedInputRefused={sameOriginalOwnerAndTokenSourceCall:true,parentPorts:0,callbackSettled:p.callbackSettled};
`,{resources:true,pre32:true,owner:true,ownerInputCopy:true}));

test('owner-bound first canonical import reentry inhibits both participant ports before promise rejection',()=>exercise(
  pre32Setup('healthy')+ownerSetup+participants+`
  const get=WeakMap.prototype.get,push=Array.prototype.push;let nativeScope,definitionScope,triggered=0,traps=0;
  WeakMap.prototype.get=function(key){const value=get.call(this,key);
    if(value&&value.original===loaded&&value.published)nativeScope=key;
    if(value&&value.original===approved&&value.published)definitionScope=key;
    return value;
  };
  Array.prototype.push=function(...items){
    const result=push.apply(this,items);
    if(!triggered&&items[0]?.locator==='./deployment-dashboard-cutover-adapter-v2.mjs'){
      triggered++;
      const proxy=new Proxy({}, {get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')},ownKeys(){traps++;throw Error('TRAP')}});
      let ownerRefused=false,nativeRefused=false,definitionRefused=false;
      try{ownerApi.observeDashboardCutoverOwnerBindingsV2(proxy,undefined)}catch{ownerRefused=true}
      const direct=()=>Object.fromEntries(Object.entries(out.portCounts??{}).filter(([key])=>!key.startsWith('composite:')));
      const before=direct();
      try{native.assertHeldDashboardCutoverLoadedJobOperationV4(nativeScope)}catch{nativeRefused=true}
      try{definition.assertHeldDashboardCutoverApprovedDefinitionOperationV4(definitionScope)}catch{definitionRefused=true}
      out.firstImportReentry={triggered,traps,ownerRefused,nativeRefused,definitionRefused,
        capturedNative:!!nativeScope,capturedDefinition:!!definitionScope,before,after:direct()};
    }
    return result;
  };
  await assert.rejects(()=>adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner));
  assert.equal(triggered,1);assert.equal(traps,0);
  assert.equal(out.firstImportReentry.capturedNative,true);assert.equal(out.firstImportReentry.capturedDefinition,true);
  assert.equal(out.firstImportReentry.ownerRefused,true);
  assert.equal(out.firstImportReentry.nativeRefused,true,'OWNER_IMPORT_BURN_ADMITTED_NATIVE_SCOPE');
  assert.equal(out.firstImportReentry.definitionRefused,true);
  assert.deepEqual(out.firstImportReentry.after,out.firstImportReentry.before,'OWNER_IMPORT_BURN_DISPATCHED_PARTICIPANT_PORT');
  assert.equal(out.reservationChild,undefined);
`,{resources:true,pre32:true,owner:true}));

for(const scenario of ['child-driver-loss','child-reentry','final-loss']){
  test('owner-bound reservation '+scenario+' quarantines SAME originals after later settlement',()=>exercise(
    pre32Setup(scenario==='final-loss'?'final-loss':'healthy')+ownerSetup+participants+`
    assert.equal(typeof adapter.reserveHeldDashboardCutoverJointFirstGenerationV4,'function','MISSING_OWNER_BOUND_ROOT_RESERVATION');
    const provider=await import('./scripts/deployment-dashboard-cutover-first-generation-v2.mjs');
    const scenario=${JSON.stringify(scenario)};
    if(scenario!=='final-loss'){
      globalThis.holdReservationChild=true;
      globalThis.reservationChildSuspended=new Promise(resolve=>{globalThis.reservationChildObserved=resolve});
    }
    const operation=adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner);operation.catch(()=>{});
    if(scenario!=='final-loss'){
      await globalThis.reservationChildSuspended;assert.equal(out.reservationChild.published,false);assert.equal(p.held,true);
    }else{await p.suspended;assert.equal(out.reservationChild.published,true);assert.equal(p.suspendedAt,4)}
    p.rejectDriver(Error('INERT_DRIVER_LOSS'));await p.ended;await new Promise(resolve=>setImmediate(resolve));
    const counters=()=>Object.fromEntries(Object.entries(out.portCounts??{}).filter(([key])=>!key.startsWith('composite:')));
    let traps=0;const proxy=new Proxy({}, {get(){traps++;throw Error('TRAP')},getPrototypeOf(){traps++;throw Error('TRAP')},ownKeys(){traps++;throw Error('TRAP')}});
    const refusedLegacy=async()=>{
      const at=counters();
      assert.throws(()=>ownerApi.assertDeploymentCutoverOwnerV1(proxy,undefined));
      assert.throws(()=>ownerApi.observeDashboardCutoverOwnerBindingsV2(proxy,undefined));
      await assert.rejects(()=>ownerApi.acquireDeploymentCutoverOwnerV1(proxy,undefined));
      assert.throws(()=>provider.assertFirstGenerationDashboardCutoverReservationV2(proxy,undefined));
      assert.throws(()=>provider.closeFirstGenerationDashboardCutoverReservationV2(proxy,undefined));
      await assert.rejects(()=>provider.acquireFirstGenerationDashboardCutoverReservationV2(proxy,undefined));
      await assert.rejects(()=>adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(proxy));
      assert.throws(()=>native.closeHeldDashboardCutoverLoadedJobPeerV4(loaded));
      assert.throws(()=>definition.closeHeldDashboardCutoverApprovedDefinitionV4(approved));
      assert.deepEqual(counters(),at);assert.equal(traps,0);
    };
    const afterDriverLoss=counters();
    // Natural-loss cases must not get their burn from this test's legacy calls.
    // Pending reentry is independently exercised in its own separate case.
    if(scenario==='child-reentry')await refusedLegacy();
    if(scenario!=='final-loss'){
      globalThis.releaseReservationChild();
      await assert.rejects(()=>p.actualCallback);
      assert.equal(out.reservationChild.published,true);assert.equal(out.reservationChild.publishedWhilePgHeld,false);
      assert.equal(out.reservationChild.closed,true);
    }else{
      p.resumeOriginalQuery();await assert.rejects(()=>p.actualCallback);assert.equal(p.querySettled,true);
    }
    await assert.rejects(()=>operation);
    const afterOriginalSettlement=counters();assert.deepEqual(afterOriginalSettlement,afterDriverLoss);
    await refusedLegacy();
    assert.equal(out.portCounts?.['reservation:closeSync']??0,0);
    const reservationRoot=baseline+'/restart-authority-retirement-v1';
    assert.deepEqual(fs.readdirSync(reservationRoot),['physical-service-restart-authority.transition.lock']);
    out.quarantine={scenario,traps,callbackSettled:p.callbackSettled,child:out.reservationChild,
      afterDriverLoss,afterOriginalSettlement,parentCounters:counters(),end:p.end,rootPreserved:fs.existsSync(reservationRoot)};
  `,{resources:true,pre32:true,owner:true}));
}

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
