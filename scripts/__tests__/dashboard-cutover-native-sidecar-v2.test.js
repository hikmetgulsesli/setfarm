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

// Each case exercises real source/Git/header custody; only external async
// commands are simulated. Roots and original failure receipts are never removed.
function fixture(body,{setup='',before='',preimport='',profile=true,sdkDepth=0,actual=false}={}){
  assert.ok(fs.existsSync(target),'missing nominated native sidecar builder');
  const names=['dashboard-cutover-native-sidecar-v2.mjs','dashboard-cutover-native-build-inputs-v2.mjs',
    'dashboard-cutover-native-inputs-v2.mjs','build-generation-retention.mjs','dashboard-cutover-mach-peer-v2.c'];
  const files=Object.fromEntries(names.map(n=>['scripts/'+n,fs.readFileSync(sourceRoot+'/scripts/'+n)]));
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
    fs.writeFileSync(root+'/scripts/'+n,text);
  }
  git(root,['add','scripts']);git(root,['commit','-qm','relocate closed sidecar providers']);
  git(root,['update-ref','refs/remotes/origin/main','HEAD']);fs.renameSync(root+'/dist',root+'.previous-dist');
  }
  const expected=actual?created.expected:finalize(root),source=fs.readFileSync(root+'/scripts/dashboard-cutover-mach-peer-v2.c');
  const script=`import assert from 'node:assert/strict';import fs from 'node:fs';import cp from 'node:child_process';
    import {syncBuiltinESMExports} from 'node:module';import {EventEmitter} from 'node:events';
    import {PassThrough} from 'node:stream';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
    const root=${JSON.stringify(root)},providers=${JSON.stringify(providers)},expected=${JSON.stringify(expected)},
      sourceHash=${JSON.stringify(hash(source))},sourceLength=${source.length};
    const digest=b=>createHash('sha256').update(b).digest('hex');
    const refused=fn=>assert.throws(fn,e=>e.message==='DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED');
    const rejected=fn=>assert.rejects(fn,e=>e.message==='DASHBOARD_CUTOVER_NATIVE_SIDECAR_REFUSED');
    ${profile&&!actual?`Object.defineProperties(process,{platform:{value:'darwin'},arch:{value:'arm64'},version:{value:'v26.4.0'},execPath:{value:providers.node}});`:''}
    const open=fs.openSync,close=fs.closeSync,write=fs.writeSync,read=fs.readSync,nativeReceiptFsync=fs.fsyncSync;
    const ports=[],effects=[],opens=[],closes=[],fdPaths=new Map(),commands=[],children=[];
    fs.openSync=(p,...a)=>{ports.push('open');const fd=open(p,...a);opens.push({p:String(p),fd,flags:a[0]});fdPaths.set(fd,String(p));return fd};
    fs.closeSync=fd=>{ports.push('close');closes.push(fd);return close(fd)};
    for(const n of ['lstatSync','fstatSync','readSync','readFileSync','readlinkSync','readdirSync','realpathSync']){
      const f=fs[n];fs[n]=(...a)=>{ports.push(n);return f(...a)};}
    for(const n of ['mkdirSync','writeSync','writeFileSync','fchmodSync','fsyncSync','renameSync','chmodSync','rmSync','unlinkSync','rmdirSync']){
      const f=fs[n];fs[n]=(...a)=>{ports.push(n);effects.push({n,args:a});return f(...a)};}
    const generation=root+'/.setfarm/dashboard-cutover-native-v2/'+expected.sourceSha+'.'+expected.buildHash;
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
    let prepare;
    ${setup}
    ${preimport}
    try{syncBuiltinESMExports();const importedOpenAt=opens.length,importedEffectsAt=effects.length,
      mod=await import('./scripts/dashboard-cutover-native-sidecar-v2.mjs');
    // The trusted ESM interpreter reads these four code modules. That is not
    // module-owned retention/preparation; any other original/effect is forbidden.
    const codeNames=new Set(['dashboard-cutover-native-sidecar-v2.mjs','dashboard-cutover-native-build-inputs-v2.mjs',
      'dashboard-cutover-native-inputs-v2.mjs','build-generation-retention.mjs']);
    for(const r of opens.slice(importedOpenAt)){const p=r.p.startsWith('file:')?fileURLToPath(r.p):r.p;
      assert.ok(p.startsWith(root+'/scripts/')&&codeNames.has(p.slice((root+'/scripts/').length)),r.p);}
    assert.equal(commands.length,0);assert.equal(effects.length,importedEffectsAt);
    assert.deepEqual(Object.keys(mod),['prepareDashboardCutoverNativeSidecarV2']);prepare=mod.prepareDashboardCutoverNativeSidecarV2;
    ${before}
    ${body}}finally{const snapshot=JSON.stringify({root,generation,commandCount:commands.length,opens:opens.length,closes:closes.length,
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

test('terminal sidecar binds source, exact recipe, original commands and independent manifest contents',()=>fixture(`
  const ctx=await prepare(),o=ctx.observation;assert.ok(Object.isFrozen(ctx));assert.ok(Object.isFrozen(o));
  assert.equal(o.authority,'native-sidecar-build-only');assert.equal(o.generation,generation);assert.equal(commands.length,7);
  const g=commands[0];assert.equal(g.command,'/usr/bin/git');assert.deepEqual(g.args,
    ['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','check-ignore','-q','--','.setfarm/dashboard-cutover-native-v2/']);
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
  const m=JSON.parse(fs.readFileSync(generation+'/manifest.json'));assert.equal(m.schema,'setfarm.internal-production-dashboard-native-sidecar-build.v2');
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
  const n=ports.length;ctx.close();assert.equal(ports.length,n);await rejected(()=>prepare());`));

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
test('once-close unknown does not close reused number or later originals',()=>fixture(`const ctx=await prepare();
  let replacement;closes.length=0;fs.closeSync=fd=>{closes.push(fd);close(fd);replacement=open(providers.node,'r');
    assert.equal(replacement,fd);throw Error('unknown close')};syncBuiltinESMExports();refused(()=>ctx.close());
  assert.equal(closes.length,1);ctx.close();assert.equal(closes.length,1);fs.fstatSync(replacement);close(replacement);`));

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
test('externally consumed terminal descriptor is never closed after number reuse',()=>fixture(`const ctx=await prepare();
  const row=opens.findLast(x=>x.p===generation+'/manifest.json');close(row.fd);const replacement=open(providers.node,'r');
  assert.equal(replacement,row.fd);refused(()=>ctx.recheck());closes.length=0;refused(()=>ctx.close());assert.equal(closes.length,0);
  fs.fstatSync(replacement);ctx.close();assert.equal(closes.length,0);close(replacement);`));
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
