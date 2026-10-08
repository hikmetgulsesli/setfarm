import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {createFinalizedFixture,file,git,hash,finalize} from './helpers/dashboard-cutover-finalized-fixture-v2.js';

const rootSource=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const target=path.join(rootSource,'scripts/dashboard-cutover-native-build-inputs-v2.mjs');
const fixed={node:'/opt/homebrew/Cellar/node/26.4.0/bin/node',
  clang:'/Library/Developer/CommandLineTools/usr/bin/clang',ld:'/Library/Developer/CommandLineTools/usr/bin/ld',
  nm:'/Library/Developer/CommandLineTools/usr/bin/llvm-nm',otool:'/Library/Developer/CommandLineTools/usr/bin/llvm-otool',
  headers:'/opt/homebrew/Cellar/node/26.4.0/include/node',sdk:'/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk',
  resource:'/Library/Developer/CommandLineTools/usr/lib/clang/21',clt:'/Library/Developer/CommandLineTools'};
const env={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};

function fixture(body,{setup='',before='',preimport='',actual=false,profile=true}={}){
  assert.ok(fs.existsSync(target),'missing nominated compiler dependency holder');
  const files={};
  for(const name of ['dashboard-cutover-native-build-inputs-v2.mjs','dashboard-cutover-native-inputs-v2.mjs',
    'build-generation-retention.mjs','dashboard-cutover-mach-peer-v2.c'])
    files['scripts/'+name]=fs.readFileSync(path.join(rootSource,'scripts',name));
  const {root}=createFinalizedFixture(files),providerRoot=root+'.providers';
  const providers=Object.fromEntries(Object.entries(fixed).map(([k,p])=>[k,actual?p:providerRoot+p]));
  if(!actual){
    for(const key of ['node','clang','ld','nm','otool'])file(providerRoot,path.relative(providerRoot,providers[key]),'fixed '+key+'\n',0o755);
    for(const name of ['node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h'])
      file(providerRoot,path.relative(providerRoot,providers.headers+'/'+name),'public '+name+'\n');
    for(const [p,b] of [[providers.resource+'/include/stdint.h','resource\n'],
      [providers.sdk+'/usr/include/bootstrap.h','bootstrap\n'],[providers.sdk+'/usr/include/a space.h','spaces\n']])
      file(providerRoot,path.relative(providerRoot,p),b);
    fs.mkdirSync(providers.sdk+'/usr/include/servers',{mode:0o700});
    fs.symlinkSync('../bootstrap.h',providers.sdk+'/usr/include/servers/bootstrap.h');
    fs.mkdirSync(providers.sdk+'/System/Library/Frameworks',{recursive:true,mode:0o700});
    for(const name of ['dashboard-cutover-native-build-inputs-v2.mjs','dashboard-cutover-native-inputs-v2.mjs']){
      let text=files['scripts/'+name].toString();
      for(const [k,p] of Object.entries(fixed))text=text.replaceAll("'"+p+"'","'"+providers[k]+"'");
      fs.writeFileSync(root+'/scripts/'+name,text);
    }
    git(root,['add','scripts']);git(root,['commit','-qm','relocate closed dependency providers']);
    git(root,['update-ref','refs/remotes/origin/main','HEAD']);
    fs.renameSync(root+'/dist',root+'.previous-dist');
  }
  const expected=actual?{sourceSha:git(root,['rev-parse','HEAD'])}:finalize(root);
  const source=fs.readFileSync(root+'/scripts/dashboard-cutover-mach-peer-v2.c');
  const script=`import assert from 'node:assert/strict';import fs from 'node:fs';import cp from 'node:child_process';
    import {syncBuiltinESMExports} from 'node:module';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
    const root=${JSON.stringify(root)},providers=${JSON.stringify(providers)},expected=${JSON.stringify(expected)},
      sourceHash=${JSON.stringify(hash(source))},sourceLength=${source.length};
    const refused=fn=>assert.throws(fn,e=>e.message==='DASHBOARD_CUTOVER_NATIVE_BUILD_INPUTS_REFUSED');
    const rejected=fn=>assert.rejects(fn,e=>e.message==='DASHBOARD_CUTOVER_NATIVE_BUILD_INPUTS_REFUSED');
    ${!actual&&profile?`Object.defineProperties(process,{platform:{value:'darwin'},arch:{value:'arm64'},
      version:{value:'v26.4.0'},execPath:{value:providers.node}});`:''}
    const open=fs.openSync,close=fs.closeSync,read=fs.readSync,readFile=fs.readFileSync;
    const opens=[],closes=[],ports=[],writes=[],commands=[],children=[],fdPaths=new Map();
    fs.openSync=(p,...a)=>{ports.push('open');const fd=open(p,...a);opens.push({p:String(p),fd});fdPaths.set(fd,String(p));return fd};
    fs.closeSync=fd=>{ports.push('close');closes.push(fd);return close(fd)};
    for(const name of ['lstatSync','fstatSync','readSync','readFileSync','readlinkSync','readdirSync','realpathSync']){
      const original=fs[name];fs[name]=(...a)=>{ports.push(name);return original(...a)};}
    for(const name of ['writeFileSync','mkdirSync','renameSync','chmodSync','unlinkSync','rmSync','rmdirSync']){
      const original=fs[name];fs[name]=(...a)=>{ports.push(name);writes.push(name);return original(...a)};}
    const nativeSpawn=cp.spawn;
    const headerPaths=[providers.headers+'/node_api.h',providers.resource+'/include/stdint.h',
      providers.sdk+'/usr/include/servers/bootstrap.h',providers.sdk+'/usr/include/a space.h'];
    const escape=p=>p.replaceAll(' ','\\\\ ');
    let dependencyOutput=()=> 'setfarm-cutover-inputs: - '+headerPaths.map(escape).join(' \\\\'+String.fromCharCode(10)+'  ')+'\\n';
    let outcome=()=>({code:0,signal:null,stderr:''});
    let onSpawn=()=>{},onFinish=()=>{};
    cp.spawn=(command,args,options)=>{
      commands.push({command,args,options});onSpawn(commands.length);
      if(${actual}){
        const row={command,args,options,intentRecorded:true,source:[],stdout:[],stderr:[],stdoutLength:0,stderrLength:0,truncated:false,
          events:[],closed:false,code:null,signal:null,error:null};children.push(row);
        const child=nativeSpawn(command,args,options);row.child=child;
        for(const [name,stream] of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]]){
          row[name+'Original']=stream;
          for(const event of ['finish','end','close'])stream.on(event,()=>row.events.push(name+':'+event));
          stream.on('error',()=>{row.error='original-pipe-error'});
          if(name!=='stdin')stream.on('data',b=>{const limit=name==='stdout'?262144:65536;
            const left=Math.max(0,limit-row[name+'Length']);if(left)row[name].push(Buffer.from(b.subarray(0,left)));
            row[name+'Length']+=b.length;if(b.length>left)row.truncated=true});
        }
        const end=child.stdin.end;child.stdin.end=function(b,...a){row.source.push(Buffer.from(b));return end.call(this,b,...a)};
        child.on('error',()=>{row.error='original-child-error'});
        child.on('close',(code,signal)=>{row.closed=true;row.code=code;row.signal=signal});return child;
      }
      const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
      child.kill=()=>{throw Error('FORBIDDEN_KILL')};
      child.stdin.resume();const inputs=[];child.stdin.on('data',b=>inputs.push(Buffer.from(b)));
      children.push(child);child.stdin.on('finish',()=>setImmediate(()=>{
        onFinish(commands.length);child.source=Buffer.concat(inputs);
        const o=outcome(commands.length);if(o.error){child.emit('error',Error('secret external error'));return}
        child.stdout.end(dependencyOutput(commands.length));child.stderr.end(o.stderr);
        setImmediate(()=>{if(!o.noClose){child.actualClosed=true;child.emit('close',o.code,o.signal)}});
      }));return child;
    };
    ${setup}
    ${preimport}
    syncBuiltinESMExports();const mod=await import('./scripts/dashboard-cutover-native-build-inputs-v2.mjs');
    assert.deepEqual(Object.keys(mod),['prepareDashboardCutoverNativeBuildInputsV2']);const prepare=mod.prepareDashboardCutoverNativeBuildInputsV2;
    ${before}
    try{${body}}finally{
    console.log(JSON.stringify({kind:'compiler-inputs-case',root,commandCount:commands.length,openCount:opens.length,closeCount:closes.length}));
    if(${actual})console.log(JSON.stringify({kind:'actual-compiler-command-originals',commands:children.map(r=>({
      command:r.command,args:r.args,options:r.options,intentRecorded:r.intentRecorded,closed:r.closed,code:r.code,
      signal:r.signal,error:r.error,events:r.events,truncated:r.truncated,stdoutLength:r.stdoutLength,stderrLength:r.stderrLength,
      source:Buffer.concat(r.source).toString('base64'),stdout:Buffer.concat(r.stdout).toString('base64'),
      stderr:Buffer.concat(r.stderr).toString('base64')}))}));}`;
  const r=spawnSync(actual?fixed.node:process.execPath,['--input-type=module','-e',script],{
    // No killing timeout/maxBuffer: trusted fixture output is bounded by the
    // production data/count/path caps; an unknown active child is never killed.
    cwd:root,env,encoding:'utf8',maxBuffer:Infinity});
  fs.writeFileSync(root+'.build-inputs-result.json',JSON.stringify({root,providers,expected,actual,script,
    sourceHash:hash(fs.readFileSync(target)),status:r.status,signal:r.signal,error:r.error?.message??null,
    stdout:r.stdout,stderr:r.stderr}),{flag:'wx',mode:0o600});
  assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,0,r.stderr+r.stdout);
  console.log(r.stdout.trim());return {root,result:r};
}

test('two planned discoveries bind original source, fixed recipe and retained declared include closure',()=>{
  fixture(`const ctx=await prepare();assert.ok(Object.isFrozen(ctx));assert.ok(Object.isFrozen(ctx.observation));
    const o=ctx.observation;assert.equal(o.authority,'compiler-dependencies-only');assert.equal(o.headers.length,4);
    assert.equal(o.direct.sourceBuild.checkoutSource.sha,expected.sourceSha);assert.equal(o.discoveries.length,2);
    assert.deepEqual(o.discoveries.map(x=>x.phase),['provisional','held-validation']);assert.equal(writes.length,0);
    assert.equal(commands.length,2);for(const {command,args,options} of commands){
      assert.equal(command,providers.clang);assert.deepEqual(args,['--no-default-config','-nostdinc','-std=c11','-DNAPI_VERSION=8',
        '-arch','arm64','-mmacosx-version-min=14.0','-isysroot',providers.sdk,'-resource-dir',providers.resource,
        '-isystem',providers.headers,'-isystem',providers.resource+'/include','-isystem',providers.sdk+'/usr/include',
        '-iframework',providers.sdk+'/System/Library/Frameworks','-M','-MT','setfarm-cutover-inputs','-x','c','-']);
      assert.deepEqual(options.env,{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TMPDIR:'/private/tmp'});
      assert.equal(options.cwd,'/private/tmp');assert.equal(options.shell,false);assert.deepEqual(options.stdio,['pipe','pipe','pipe']);}
    for(const child of children){assert.equal(child.source.length,sourceLength);
      assert.equal((await import('node:crypto')).createHash('sha256').update(child.source).digest('hex'),sourceHash);
      assert.equal(child.actualClosed,true);assert.equal(child.stdin.destroyed,true);}
    const alias=o.headers.find(x=>x.locator.endsWith('/servers/bootstrap.h'));
    assert.equal(alias.physicalLocator,providers.sdk+'/usr/include/bootstrap.h');assert.equal(alias.aliasTarget,'../bootstrap.h');
    await Promise.resolve();ctx.recheck();assert.equal(writes.length,0);ctx.close();assert.equal(closes.length,opens.length);
    const n=closes.length;ctx.close();assert.equal(closes.length,n);await rejected(()=>prepare());`);
});

test('idle invalid arguments inspect no proxy and touch no files or compiler',()=>{
  fixture(`let traps=0;const p=new Proxy({},{get(){traps++;throw Error('secret')}}),n=ports.length;
    await rejected(()=>prepare(p));await rejected(()=>prepare(undefined));assert.equal(traps,0);assert.equal(ports.length,n);
    assert.equal(commands.length,0);const ctx=await prepare();ctx.close();`);
});
test('wrong process profile admits zero dependency or source ports',()=>{
  fixture(`const n=ports.length;await rejected(()=>prepare());assert.equal(ports.length,n);assert.equal(commands.length,0);`,{profile:false});
});
test('ambient cwd and compiler variables cannot select the discovery recipe',()=>{
  fixture(`const ctx=await prepare();assert.equal(commands[0].command,providers.clang);
    assert.equal(ctx.observation.direct.sourceBuild.checkoutSource.sha,expected.sourceSha);ctx.close();`,{
    preimport:`process.chdir('/');process.env.CC='/invalid';process.env.CPATH='/invalid';process.env.SDKROOT='/invalid';`});
});
for(const kind of ['foreign','duplicate','dotdot','rule','variable','empty','invalidEscape'])
  test('dependency '+kind+' burns without held-validation retry',()=>{
    const output={foreign:"'setfarm-cutover-inputs: /private/tmp/foreign.h\\n'",
      duplicate:"'setfarm-cutover-inputs: '+headerPaths[0]+' '+headerPaths[0]+'\\n'",
      dotdot:"'setfarm-cutover-inputs: '+providers.headers+'/../foreign.h\\n'",
      rule:"'setfarm-cutover-inputs: '+headerPaths[0]+'\\nother: x\\n'",
      variable:"'setfarm-cutover-inputs: $(SECRET)\\n'",empty:"'setfarm-cutover-inputs: -\\n'",
      invalidEscape:"'setfarm-cutover-inputs: '+headerPaths[0]+'\\\\q\\n'"}[kind];
    fixture(`await rejected(()=>prepare());assert.equal(commands.length,1);const n=ports.length;
      await rejected(()=>prepare());assert.equal(ports.length,n);assert.equal(commands.length,1);`,{
      setup:`dependencyOutput=()=>${output};`});
  });
test('second planned graph mismatch refuses instead of admitting a third discovery',()=>{
  fixture(`await rejected(()=>prepare());assert.equal(commands.length,2);await rejected(()=>prepare());assert.equal(commands.length,2);`,{
    setup:`const output=dependencyOutput;dependencyOutput=n=>n===2?'setfarm-cutover-inputs: '+headerPaths[0]+'\\n':output();`});
});
for(const kind of ['writable','hardlink','symlink','aliasTarget'])test('original include '+kind+' refuses before second child',()=>{
  fixture(`await rejected(()=>prepare());assert.equal(commands.length,1);`,{
    before:kind==='writable'?`fs.chmodSync(providers.resource+'/include/stdint.h',0o777);`:
      kind==='hardlink'?`fs.linkSync(providers.resource+'/include/stdint.h',providers.resource+'/include/other.h');`:
      kind==='symlink'?`fs.renameSync(providers.resource+'/include/stdint.h',providers.resource+'/include/real.h');
        fs.symlinkSync('real.h',providers.resource+'/include/stdint.h');`:
      `fs.unlinkSync(providers.sdk+'/usr/include/servers/bootstrap.h');fs.symlinkSync('./../bootstrap.h',providers.sdk+'/usr/include/servers/bootstrap.h');`});
});
for(const kind of ['nonzero','stderr','error','overflow'])test('original child '+kind+' stops all later spawn ports',()=>{
  fixture(`await rejected(()=>prepare());assert.equal(commands.length,1);const n=ports.length;
    await rejected(()=>prepare());assert.equal(ports.length,n);assert.equal(commands.length,1);`,{
    setup:kind==='nonzero'?`outcome=()=>({code:1,signal:null,stderr:''});`:
      kind==='stderr'?`outcome=()=>({code:0,signal:null,stderr:'secret compiler stderr'});`:
      kind==='error'?`outcome=()=>({error:true});`:
      `dependencyOutput=()=> 'setfarm-cutover-inputs: '+headerPaths[0]+' '+ ' '.repeat(262144)+'\\n';`});
});
test('swallowed prepare reentry during admitted spawn revokes before source pipe write',()=>{
  fixture(`await rejected(()=>prepare());await nested;assert.equal(commands.length,1);assert.equal(children[0].source,undefined);`,{
    setup:`let nested;onSpawn=()=>{nested=rejected(()=>prepare())};`});
});
for(const target of ['header','alias'])test('held '+target+' ABA burns across await but proven original close is permitted',()=>{
  fixture(`const ctx=await prepare();await Promise.resolve();const p=${target==='header'?"providers.resource+'/include/stdint.h'":"providers.sdk+'/usr/include/servers/bootstrap.h'"};
    fs.renameSync(p,p+'.original');fs.renameSync(p+'.original',p);refused(()=>ctx.recheck());
    const n=commands.length;refused(()=>ctx.recheck());assert.equal(commands.length,n);ctx.close();`);
});
test('header change during held-validation discovery is refused before publication',()=>{
  fixture(`await rejected(()=>prepare());assert.equal(commands.length,2);`,{
    setup:`onFinish=n=>{if(n===2)fs.appendFileSync(providers.resource+'/include/stdint.h','changed')};`});
});
test('partial original header read burns and retains originals without second spawn',()=>{
  fixture(`await rejected(()=>prepare());assert.equal(commands.length,1);
    assert.equal(closes.includes(opens.findLast(x=>x.p===providers.resource+'/include/stdint.h').fd),false);`,{
    setup:`fs.readSync=(fd,b,o,l,p)=>fdPaths.get(fd)===providers.resource+'/include/stdint.h'?0:read(fd,b,o,l,p);`});
});
test('unknown once-close never disposes a reused include descriptor or later originals',()=>{
  fixture(`const ctx=await prepare();const row=opens.findLast(x=>x.p===providers.sdk+'/usr/include/bootstrap.h');
    let replacement;closes.length=0;fs.closeSync=fd=>{closes.push(fd);close(fd);replacement=open(providers.node,'r');
      assert.equal(replacement,fd);throw Error('unknown original close')};syncBuiltinESMExports();
    refused(()=>ctx.close());assert.equal(closes.length,1);ctx.close();assert.equal(closes.length,1);
    fs.fstatSync(replacement);close(replacement);`);
});
test('idle method arity performs zero ports without burning healthy original custody',()=>{
  fixture(`const ctx=await prepare(),n=ports.length;refused(()=>ctx.recheck(undefined));refused(()=>ctx.close(undefined));
    assert.equal(ports.length,n);ctx.recheck();ctx.close();`);
});
test('header recheck reentry burns before another original read and allows only later idle disposal',()=>{
  fixture(`const ctx=await prepare();let armed=true,nested=0,reads=0;fs.readSync=(fd,b,o,l,p)=>{
    const n=read(fd,b,o,l,p);if(armed&&fdPaths.get(fd)===providers.resource+'/include/stdint.h'){
      armed=false;nested++;refused(()=>ctx.close())}else if(!armed)reads++;return n};syncBuiltinESMExports();
    refused(()=>ctx.recheck());assert.equal(nested,1);assert.equal(reads,0);ctx.close();`);
});
test('external consumed original header number is never closed again after reuse',()=>{
  fixture(`const ctx=await prepare(),row=opens.findLast(x=>x.p===providers.headers+'/node_api.h');
    close(row.fd);const replacement=open(providers.node,'r');assert.equal(replacement,row.fd);
    refused(()=>ctx.recheck());closes.length=0;refused(()=>ctx.close());assert.equal(closes.length,0);
    fs.fstatSync(replacement);ctx.close();assert.equal(closes.length,0);close(replacement);`);
});
test('already-burned close reentry consumes only its first original occurrence',()=>{
  fixture(`const ctx=await prepare();fs.appendFileSync(providers.resource+'/include/stdint.h','drift');refused(()=>ctx.recheck());
    let nested=0;closes.length=0;fs.closeSync=fd=>{closes.push(fd);close(fd);if(!nested){nested++;refused(()=>ctx.close())}};
    syncBuiltinESMExports();refused(()=>ctx.close());assert.equal(closes.length,1);assert.equal(nested,1);ctx.close();assert.equal(closes.length,1);`);
});
for(const kind of ['noClose','noOutputEOF'])test('mark-only watchdog '+kind+' retains child and never cancels or retries',()=>{
  fixture(`await rejected(()=>prepare());assert.equal(commands.length,1);const child=children[0];
    assert.equal(child.actualClosed,${kind==='noClose'?'undefined':'true'});assert.equal(child.stdout.destroyed,${kind==='noClose'?'true':'false'});
    const n=ports.length;await rejected(()=>prepare());assert.equal(ports.length,n);assert.equal(commands.length,1);`,{
    setup:`const timeout=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...a)=>timeout(fn,ms===30000?10:ms,...a);
      ${kind==='noClose'?`outcome=()=>({code:0,signal:null,stderr:'',noClose:true});`:
        `onSpawn=()=>{};const originalSpawn=cp.spawn;cp.spawn=(...a)=>{const c=originalSpawn(...a);c.stdout.end=()=>c.stdout;return c};`}`,
    // For noClose, both output streams naturally close; custody is still unknown
    // because the child close is absent, not because pipes remain open.
  });
});
test('header count cap refuses a 385th lexical path before any include-file opening',()=>{
  fixture(`await rejected(()=>prepare());assert.equal(commands.length,1);
    assert.equal(capLookups.length,0);assert.equal(opens.some(x=>x.p.endsWith('/cap-0.h')),false);`,{
    setup:`const capLookups=[],stat=fs.lstatSync;fs.lstatSync=(p,...a)=>{
      if(String(p).startsWith(providers.headers+'/cap-'))capLookups.push(p);return stat(p,...a)};
      dependencyOutput=()=> 'setfarm-cutover-inputs: '+Array.from({length:385},(_,i)=>providers.headers+'/cap-'+i+'.h').join(' ')+'\\n';`});
});
test('a 4MiB-plus-one header refuses before acquiring its original FD',()=>{
  fixture(`const n=opens.length;await rejected(()=>prepare());assert.equal(commands.length,1);
    assert.equal(opens.slice(n).some(x=>x.p===providers.resource+'/include/stdint.h'),false);`,{
    before:`fs.truncateSync(providers.resource+'/include/stdint.h',4194305);`});
});
test('declared alias and physical target cannot count the same original file twice',()=>{
  fixture(`await rejected(()=>prepare());assert.equal(commands.length,1);`,{
    setup:`dependencyOutput=()=> 'setfarm-cutover-inputs: '+providers.sdk+'/usr/include/bootstrap.h '+providers.sdk+'/usr/include/servers/bootstrap.h\\n';`});
});
test('separate include-FD budget refuses its 513th original admission',()=>{
  fixture(`await rejected(()=>prepare());assert.equal(commands.length,1);assert.equal(includeAdmissions.length,512);
    assert.equal(includeCloses.length,0);`,{
    setup:`const includeAdmissions=[],includeCloses=[],includeNumbers=new Set(),recordedOpen=fs.openSync,recordedClose=fs.closeSync;
      fs.closeSync=fd=>{if(includeNumbers.has(fd))includeCloses.push(fd);return recordedClose(fd)};fs.openSync=(p,...a)=>{
      const caller=Error().stack.split('\\n')[2];const fd=recordedOpen(p,...a);
      if(caller.includes('at openOriginal')&&caller.includes('dashboard-cutover-native-build-inputs-v2.mjs')){
        includeAdmissions.push({p,fd});includeNumbers.add(fd)}return fd};`,
    before:`const directory=providers.headers+'/budget/'+Array(110).fill('d').join('/');
      fs.mkdirSync(directory,{recursive:true,mode:0o700});
      for(let i=0;i<380;i++){const p=directory+'/h'+i+'.h';fs.writeFileSync(p,'header',{flag:'wx',mode:0o600});headerPaths.push(p)};`});
});
test('aggregate header budget accounts exactly sized originals before crossed acquisition',()=>{
  fixture(`const n=opens.length;await rejected(()=>prepare());assert.equal(commands.length,1);assert.equal(readBytes,29360128);
    assert.equal(opens.slice(n).some(x=>x.p.endsWith('/aggregate-7.h')),false);`,{
    before:`headerPaths.length=0;for(let i=0;i<8;i++){const p=providers.headers+'/aggregate-'+i+'.h';
      fs.writeFileSync(p,'header',{flag:'wx',mode:0o600});headerPaths.push(p)};`,
    setup:`let readBytes=0;const stat=fs.lstatSync,fstat=fs.fstatSync;
      const sized=(p,s)=>{if(p.includes('/aggregate-'))s.size=4194304n;return s};
      fs.lstatSync=(p,...a)=>sized(String(p),stat(p,...a));fs.fstatSync=(fd,...a)=>sized(fdPaths.get(fd)??'',fstat(fd,...a));
      fs.readSync=(fd,b,o,l,p)=>{if((fdPaths.get(fd)??'').includes('/aggregate-')){b.fill(0,o,o+l);readBytes+=l;return l}
        return read(fd,b,o,l,p)};`});
});
for(const kind of ['stderrOverflow','signal','stdinCallback','outputError'])test('original '+kind+' remains unknown and admits no later compiler',()=>{
  fixture(`await rejected(()=>prepare());assert.equal(commands.length,1);${kind==='stderrOverflow'?`assert.equal(watchdogFired,false);assert.equal(children[0].actualClosed,undefined);`:''}const n=ports.length;
    await rejected(()=>prepare());assert.equal(ports.length,n);assert.equal(commands.length,1);`,{
    setup:kind==='stderrOverflow'?`let watchdogFired=false;const timeout=globalThis.setTimeout;
      globalThis.setTimeout=(fn,ms,...a)=>timeout(()=>{if(ms===30000)watchdogFired=true;fn()},ms===30000?50:ms,...a);
      outcome=()=>({code:0,signal:null,stderr:Buffer.alloc(65537,97),noClose:true});`:
      kind==='signal'?`outcome=()=>({code:null,signal:'SIGTERM',stderr:''});`:
      kind==='stdinCallback'?`const s=cp.spawn;cp.spawn=(...a)=>{const c=s(...a);c.stdin.end=(b,callback)=>{
        callback(Error('unknown write'));return c.stdin};return c};`:
      `const s=cp.spawn;cp.spawn=(...a)=>{const c=s(...a);setImmediate(()=>c.stdout.emit('error',Error('unknown output')));return c};`});
});
test('actual fixed compiler discovers and retains original headers without object, native or startup effects',{
  skip:process.env.SETFARM_DASHBOARD_BUILD_INPUTS_TEST!=='1'},()=>{
  fixture(`const ctx=await prepare();assert.equal(commands.length,2);assert.equal(ctx.observation.authority,'compiler-dependencies-only');
    assert.ok(ctx.observation.headers.length>200);assert.equal(writes.length,0);await Promise.resolve();ctx.recheck();ctx.close();
    assert.equal(closes.length,opens.length);assert.equal(fs.existsSync(root+'/.setfarm'),false);
    console.log(JSON.stringify({kind:'actual-compiler-dependencies',observation:ctx.observation}));`,{actual:true});
});
