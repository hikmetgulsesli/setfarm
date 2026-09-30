import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const ROOT=new URL('../../',import.meta.url);
const TARGET='scripts/task6a-fixed-github-source-transport-v2.mjs';
const TEST='scripts/__tests__/task6a-fixed-github-source-transport-v2.test.js';
const PREFIX='https://api.github.com/repos/hikmetgulsesli/setfarm';
const PATHS=['task6a-github-delivery-object-v2.mjs','task6a-fixed-github-source-transport-v2.mjs'];
const REF='/git/ref/heads/main';
const REFUSED=/TASK6A_GITHUB_SOURCE_TRANSPORT_REFUSED/;
function hash(kind,bytes) {return createHash('sha1').update(`${kind} ${bytes.length}\0`).update(bytes).digest('hex');}
function tree(entries) {
  const sorted=[...entries].sort((a,b)=>Buffer.compare(Buffer.from(a.path+(a.type==='tree'?'/':'')),Buffer.from(b.path+(b.type==='tree'?'/':''))));
  const raw=Buffer.concat(sorted.flatMap(x=>[Buffer.from(`${x.mode.replace(/^0+/,'')} ${x.path}\0`),Buffer.from(x.sha,'hex')]));
  return {sha:hash('tree',raw),truncated:false,tree:entries};
}
function fixture(changeTree=()=>{}) {
  const blobs=PATHS.map((path,i)=>{const bytes=Buffer.from(`// source ${i}\n`);return {path,sha:hash('blob',bytes),size:bytes.length,encoding:'base64',content:bytes.toString('base64')};});
  const entries=blobs.map(b=>({path:b.path,sha:b.sha,size:b.size,mode:'100644',type:'blob'}));
  changeTree(entries);
  const scripts=tree(entries),root=tree([{path:'scripts',sha:scripts.sha,mode:'040000',type:'tree'}]);
  const parent='a'.repeat(40),head='b'.repeat(40);
  const payload=`tree ${root.sha}\nparent ${parent}\nparent ${head}\nauthor Fixture <fixture@example.test> 1 +0000\ncommitter Fixture <fixture@example.test> 1 +0000\n\nMerge fixture\n`;
  const signature='-----BEGIN PGP SIGNATURE-----\n\nYWJj\n-----END PGP SIGNATURE-----\n';
  const split=payload.indexOf('\n\n'),raw=Buffer.from(payload.slice(0,split)+'\ngpgsig '+signature.split('\n').join('\n ')+payload.slice(split));
  const mainSha=hash('commit',raw);
  const commit={sha:mainSha,tree:{sha:root.sha},parents:[{sha:parent},{sha:head}],verification:{verified:true,reason:'valid',payload,signature}};
  const ref={ref:'refs/heads/main',object:{type:'commit',sha:mainSha}};
  const pr={number:252,state:'closed',merged:true,merged_at:'2026-09-30T12:00:00Z',merge_commit_sha:mainSha,
    base:{ref:'main',repo:{full_name:'hikmetgulsesli/setfarm'}},head:{sha:head,repo:{full_name:'hikmetgulsesli/setfarm'}}};
  const routes=new Map([[REF,ref],[`/git/commits/${mainSha}`,commit],[`/commits/${mainSha}/pulls?per_page=100&page=1`,[{number:252,merge_commit_sha:mainSha}]],
    ['/pulls/252',pr],[`/git/trees/${root.sha}`,root],[`/git/trees/${scripts.sha}`,scripts],...blobs.map(b=>[`/git/blobs/${b.sha}`,b])]);
  return {routes,pr,commit,ref,mainSha,head,root,scripts,blobs};
}
async function loadReader({data=fixture(),response=()=>{},elapsed=()=>0,mutation}={}) {
  const filename=new URL(TARGET,ROOT);
  assert.ok(fs.existsSync(filename),'fixed source transport implementation missing');
  const context=vm.createContext({Buffer}),calls=[];
  const boundary=(exe,args,options)=>{
    const url=args.at(-1);const route=url.slice(PREFIX.length);
    const call={exe,args,options,url,route};calls.push(call);
    assert.ok(data.routes.has(route),`unexpected route ${route}`);
    const result={status:0,signal:null,stdout:Buffer.from(JSON.stringify(data.routes.get(route))+`\n200\napplication/json; charset=utf-8\n${url}`),stderr:Buffer.alloc(0)};
    response(result,call,calls.length,data);return result;
  };
  const builtins={
    'node:child_process':{spawnSync:boundary},'node:perf_hooks':{performance:{now:()=>elapsed(calls.length)}},
    'node:crypto':{createHash},
  };
  const modules=new Map();
  async function module(url) {
    if(modules.has(url)) return modules.get(url);
    let source=fs.readFileSync(new URL(url),'utf8');
    if(mutation&&url===filename.href) source=mutation(source);
    const m=new vm.SourceTextModule(source,{context,identifier:url});modules.set(url,m);
    await m.link(async(specifier,owner)=>{
      if(Object.hasOwn(builtins,specifier)) {
        const values=builtins[specifier];return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context});
      }
      assert.ok(specifier.startsWith('./'),'unexpected non-builtin dependency');
      return module(new URL(specifier,owner.identifier).href);
    });return m;
  }
  const m=await module(filename.href);await m.evaluate();
  assert.equal(calls.length,0,'import must not request network');
  return {observe:m.namespace.observeCurrentTask6aGithubMergedSourceTransportV2,calls,data};
}

if(!vm.SourceTextModule) {
  test('default script runner executes the full real fixed transport suite',()=>{
    const result=spawnSync(process.execPath,['--experimental-vm-modules','--test',TEST],{
      cwd:ROOT,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:15000,maxBuffer:262144,encoding:'utf8',
    });
    assert.equal(result.error,undefined);assert.equal(result.signal,null);
    assert.equal(result.status,0,result.stdout+result.stderr);
    assert.match(result.stdout,/fixed transport joins signed merged main/);
    assert.match(result.stdout,/(?:ℹ|#) fail 0\b/);
  });
} else {
  test('fixed transport joins signed merged main and the selected exact source pair',async()=>{
    const {observe,calls,data}=await loadReader();const result=observe();
    assert.equal(result.mainSha,data.mainSha);assert.equal(result.treeSha,data.root.sha);
    assert.equal(result.headSha,'b'.repeat(40));assert.equal(result.prNumber,252);
    assert.equal(result.scope,'merged-source-transport-diagnostic-only');
    assert.equal(result.productionAuthority,false);assert.equal(result.reviewAuthority,false);
    assert.deepEqual(JSON.parse(JSON.stringify(result.sources.map(x=>x.path))),PATHS.map(x=>'scripts/'+x));
    assert.equal(result.sources[0].contentSha256,'5661eafa0bfbdfd97e1f5ce41c32e2742a2437b35dc023b477bc83cd5a0898b9');
    assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.sources)&&result.sources.every(Object.isFrozen));
    assert.equal(calls.length,9);assert.equal(calls[0].route,REF);assert.equal(calls.at(-1).route,REF);
  });
  test('fixed transport rejects caller-selected options before any request',async()=>{
    const {observe,calls}=await loadReader();
    for(const value of [undefined,null,{},PREFIX,'a'.repeat(40)]) assert.throws(()=>observe(value),REFUSED);
    assert.equal(calls.length,0);
  });
  test('fixed transport owns the direct curl argv, cwd and scrubbed environment',async()=>{
    const {observe,calls}=await loadReader();observe();
    for(const c of calls) {
      assert.equal(c.exe,'/usr/bin/curl');assert.equal(c.args[0],'-q');
      assert.deepEqual(JSON.parse(JSON.stringify(c.options.env)),{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'});
      assert.equal(c.options.cwd,'/');assert.equal(c.options.shell,false);
      for(const [key,want] of [['--cacert','/private/etc/ssl/cert.pem'],['--proto','=https'],['--proxy',''],['--noproxy','*'],['--max-redirs','0'],['--connect-timeout','5'],['--max-time','10']]) {
        assert.equal(c.args[c.args.indexOf(key)+1],want,key);
      }
      assert.ok(c.args.includes('--tlsv1.2'));assert.ok(!c.args.includes('-L'));
      assert.ok(c.args.includes('Accept: application/vnd.github+json'));
      assert.ok(c.args.includes('X-GitHub-Api-Version: 2022-11-28'));
      assert.equal(c.options.timeout,10000);assert.ok(c.options.maxBuffer<=4195328);
    }
  });
  for(const [name,change] of [
    ['nonzero exit',r=>r.status=60],['signal',r=>r.signal='SIGTERM'],['timeout',r=>r.error=Error('ETIMEDOUT')],
    ['redirect',r=>r.stdout=Buffer.from('{}\n302\napplication/json\n'+PREFIX+REF)],
    ['effective URL substitution',r=>r.stdout=Buffer.from('{}\n200\napplication/json\nhttps://evil.example/')],
    ['non-JSON type',r=>r.stdout=Buffer.from('{}\n200\ntext/html\n'+PREFIX+REF)],
    ['malformed JSON',r=>r.stdout=Buffer.from('{\n200\napplication/json\n'+PREFIX+REF)],
    ['invalid UTF8',r=>r.stdout=Buffer.concat([Buffer.from([255]),r.stdout])],
    ['oversize body',r=>r.stdout=Buffer.alloc(4195329,97)],['missing stdout',r=>r.stdout=null],
  ]) test(`fixed transport refuses ${name} before another request`,async()=>{
    const {observe,calls}=await loadReader({response:change});assert.throws(observe,REFUSED);assert.equal(calls.length,1);
  });
  for(const [name,change] of [
    ['open synthetic merge',p=>{p.state='open';p.merged=false;}],['missing merged timestamp',p=>p.merged_at=null],
    ['open but merged claim',p=>p.state='open'],['closed but unmerged claim',p=>p.merged=false],
    ['wrong actual merge',p=>p.merge_commit_sha='c'.repeat(40)],['wrong PR number',p=>p.number=253],
    ['wrong base',p=>p.base.ref='feature'],['wrong repository',p=>p.base.repo.full_name='evil/setfarm'],
    ['fork head repository',p=>p.head.repo.full_name='evil/setfarm'],['wrong signed second parent',p=>p.head.sha='c'.repeat(40)],
  ]) test(`fixed transport refuses ${name}`,async()=>{
    const data=fixture();change(data.pr);const {observe,calls}=await loadReader({data});assert.throws(observe,REFUSED);assert.equal(calls.length,4);
  });
  for(const [name,change] of [
    ['missing association',xs=>xs.length=0],['ambiguous association',xs=>xs.push({...xs[0]})],
    ['incomplete bounded association',xs=>{while(xs.length<100)xs.push({number:1,merge_commit_sha:'d'.repeat(40)});}],
    ['unsafe association number',xs=>xs[0].number='../evil'],
  ]) test(`fixed transport refuses ${name}`,async()=>{
    const data=fixture();change(data.routes.get(`/commits/${data.mainSha}/pulls?per_page=100&page=1`));
    const {observe,calls}=await loadReader({data});assert.throws(observe,REFUSED);assert.equal(calls.length,3);
  });
  for(const [name,change] of [
    ['coherent symlink source',xs=>xs[0].mode='120000'],['coherent executable source',xs=>xs[0].mode='100755'],
    ['missing selected source',xs=>xs.pop()],['coherent tree size substitution',xs=>xs[0].size++],
  ]) test(`fixed transport refuses ${name}`,async()=>{
    const {observe}=await loadReader({data:fixture(change)});assert.throws(observe,REFUSED);
  });
  test('fixed transport ignores API returned URLs instead of executing them',async()=>{
    const data=fixture();for(const x of data.routes.values())if(x&&typeof x==='object')x.url='https://evil.example/';
    const {observe,calls}=await loadReader({data});assert.equal(observe().mainSha,data.mainSha);
    assert.ok(calls.every(c=>c.url.startsWith(PREFIX+'/')));
  });
  test('fixed transport refuses changed blob bytes joined to the same Git tree',async()=>{
    const data=fixture();data.blobs[0].content=Buffer.from('// source x\n').toString('base64');
    const {observe}=await loadReader({data});assert.throws(observe,REFUSED);
  });
  test('fixed transport refuses a bad main ref before selecting a commit route',async()=>{
    const data=fixture();data.ref.ref='refs/heads/evil';
    const {observe,calls}=await loadReader({data});assert.throws(observe,REFUSED);assert.equal(calls.length,1);
  });
  test('fixed transport refuses GitHub unsigned verdict at the real commit join',async()=>{
    const data=fixture();data.commit.verification.verified=false;
    const {observe,calls}=await loadReader({data});assert.throws(observe,REFUSED);assert.equal(calls.length,2);
  });
  test('fixed transport refuses truncated root before selecting scripts',async()=>{
    const data=fixture();data.root.truncated=true;
    const {observe,calls}=await loadReader({data});assert.throws(observe,REFUSED);assert.equal(calls.length,5);
  });
  test('fixed transport sanitizes a thrown external error without leaking its contents',async()=>{
    const {observe}=await loadReader({response:()=>{throw Error('private error body');}});
    assert.throws(observe,{message:'TASK6A_GITHUB_SOURCE_TRANSPORT_REFUSED'});
  });
  test('fixed transport refuses a moving main after source observation',async()=>{
    const {observe,calls}=await loadReader({response:(r,c,n)=>{if(n===9)r.stdout=Buffer.from(JSON.stringify({ref:'refs/heads/main',object:{type:'commit',sha:'e'.repeat(40)}})+`\n200\napplication/json\n${c.url}`);}});
    assert.throws(observe,REFUSED);assert.equal(calls.length,9);
  });
  test('fixed transport refuses monotonic total expiry after a successful curl',async()=>{
    const {observe,calls}=await loadReader({elapsed:n=>n?60000:0});assert.throws(observe,REFUSED);assert.equal(calls.length,1);
  });
  test('fixed transport refuses final deadline expiry without renewing the bound',async()=>{
    const {observe,calls}=await loadReader({elapsed:n=>n===9?60000:n*5000});assert.throws(observe,REFUSED);assert.equal(calls.length,9);
  });
  test('fixed transport clamps the final subprocess to the same remaining deadline',async()=>{
    const {observe,calls}=await loadReader({elapsed:n=>n===8||n===9?59999:n*5000});
    observe();assert.equal(calls.length,9);const last=calls.at(-1);
    assert.equal(last.options.timeout,1);assert.equal(last.args[last.args.indexOf('--max-time')+1],'0.001');
  });
  test('moving-main guard mutation is rejected by the actual refusal consumer',async()=>{
    const changed=(r,c,n)=>{if(n===9)r.stdout=Buffer.from(JSON.stringify({ref:'refs/heads/main',object:{type:'commit',sha:'e'.repeat(40)}})+`\n200\napplication/json\n${c.url}`);};
    const original=await loadReader({response:changed});assert.throws(original.observe,REFUSED);
    const mutant=await loadReader({response:changed,mutation:s=>s.replace('if(mainRef(get(REF))!==mainSha) refuse();','get(REF);')});
    assert.throws(()=>assert.throws(mutant.observe,REFUSED),{code:'ERR_ASSERTION'});
  });
  test('default npm graph actually dispatches a bounded real fixed transport leaf',()=>{
    const pkg=JSON.parse(fs.readFileSync(new URL('package.json',ROOT),'utf8'));
    function selected(scripts) {
      const pending=['test'],seen=new Set(),selectors=[];
      while(pending.length) {const name=pending.pop();if(seen.has(name))continue;seen.add(name);
        const cmd=scripts[name];assert.equal(typeof cmd,'string');
        for(const m of cmd.matchAll(/\bnpm run ([a-zA-Z0-9:_-]+)/g))pending.push(m[1]);
        if(/\bnode\b[^&]*--test\b/.test(cmd))for(const m of cmd.matchAll(/(?:tests|scripts)\/[a-zA-Z0-9_./*-]+\.test\.(?:js|ts)/g))selectors.push(m[0]);
      }
      assert.ok(selectors.some(x=>new RegExp('^'+x.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'[^/]*')+'$').test(TEST)),'default graph omitted fixed transport suite');
    }
    selected(pkg.scripts);const mutant={...pkg.scripts,'test:scripts':'node --test scripts/elsewhere/*.test.js'};
    assert.throws(()=>selected(mutant),/omitted fixed transport/);
    const r=spawnSync(process.execPath,['--experimental-vm-modules','--test','--test-name-pattern=^fixed transport rejects caller-selected options',TEST],{cwd:ROOT,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:5000,maxBuffer:65536,encoding:'utf8'});
    assert.equal(r.error,undefined);assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/(?:ℹ|#) pass 1\b/);
  });
}
