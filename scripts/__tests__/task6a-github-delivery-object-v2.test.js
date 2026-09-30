import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const COMMIT='8aa0d2c6f44815339da3d6ecf8eac8ff1cc49d2c';
const TREE='5166646e62fa6f8c95f083c1d01ae81dd35a23fe';
const BLOB='ce013625030ba8dba906f756967f9e9ca394464a';
const ZERO='0'.repeat(40), ONE='1'.repeat(40), TWO='2'.repeat(40);
async function implementation() {
  const target=new URL('../task6a-github-delivery-object-v2.mjs',import.meta.url);
  assert.ok(fs.existsSync(target),'Git object protocol implementation is missing');
  const module=await import(target.href);
  for(const name of ['verifyTask6aGithubSignedMergeObjectV2','verifyTask6aGithubTreeObjectV2',
    'verifyTask6aGithubBlobObjectV2']) assert.equal(typeof module[name],'function',`${name} is missing`);
  return module;
}
function commit() {
  return {sha:COMMIT,tree:{sha:ZERO},parents:[{sha:ONE},{sha:TWO}],verification:{
    verified:true,reason:'valid',
    payload:`tree ${ZERO}\nparent ${ONE}\nparent ${TWO}\nauthor Example <dev@example.test> 1700000000 +0000\ncommitter Example <dev@example.test> 1700000000 +0000\n\nreviewed merge\n`,
    // Deliberately protocol-only fake verdict/signature, never trusted provenance.
    signature:'-----BEGIN PGP SIGNATURE-----\n\nYWJj\n=AAAA\n-----END PGP SIGNATURE-----\n',
  }};
}
function tree() {
  return {sha:TREE,truncated:false,tree:[
    {path:'foo',mode:'040000',type:'tree',sha:ONE},
    {path:'z',mode:'100644',type:'blob',sha:BLOB,size:6},
    {path:'foo.bar',mode:'100644',type:'blob',sha:BLOB,size:6},
  ]};
}
function blob() {return {sha:BLOB,size:6,encoding:'base64',content:'aGVsbG8K\n'};}

test('signed merge preserves literal payload and folded signature bytes',async()=>{
  // Trimming signature/body or changing continuation folding breaks this identity.
  const {verifyTask6aGithubSignedMergeObjectV2:verify}=await implementation();
  const result=verify(commit(),COMMIT);
  assert.equal(result.sha,COMMIT);
  assert.equal(result.treeSha,ZERO);
  assert.deepEqual(result.parentShas,[ONE,TWO]);
  assert.equal(result.productionAuthority,false);
  assert.equal(result.scope,'object-protocol-only');
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.parentShas),true);
});
test('signed merge frames literal UTF8 byte length rather than character count',async()=>{
  const {verifyTask6aGithubSignedMergeObjectV2:verify}=await implementation();
  const input=commit();input.verification.payload=input.verification.payload.replace('reviewed merge','reviewed café ☕');
  input.sha='265de3b51c93ee02433a5058668cf8eb0a9a4b0c';
  assert.equal(verify(input,input.sha).sha,'265de3b51c93ee02433a5058668cf8eb0a9a4b0c');
});
const commitMutations={
  'trimmed signature':r=>{r.verification.signature=r.verification.signature.trimEnd();},
  'added payload newline':r=>{r.verification.payload+='\n';},
  'changed body':r=>{r.verification.payload=r.verification.payload.replace('reviewed','unreviewed');},
  'unverified verdict':r=>{r.verification.verified=false;},
  'invalid reason':r=>{r.verification.reason='unsigned';},
  'wrong API tree':r=>{r.tree.sha=ONE;},
  'reordered API parents':r=>{r.parents.reverse();},
  'duplicate parent':r=>{r.parents[1].sha=ONE;},
  'extra header':r=>{r.verification.payload=r.verification.payload.replace('\n\n','\nencoding UTF-8\n\n');},
  'wrong signature kind':r=>{r.verification.signature=r.verification.signature.replaceAll('PGP','SSH');},
  'NUL text':r=>{r.verification.payload+='\0';},
  'unpaired surrogate':r=>{r.verification.payload+='\ud800';},
  'oversize payload':r=>{r.verification.payload+='a'.repeat(65536);},
  'oversize signature':r=>{r.verification.signature+='a'.repeat(16384);},
};
for(const [name,mutate] of Object.entries(commitMutations)) test(`signed merge refuses ${name}`,async()=>{
  const {verifyTask6aGithubSignedMergeObjectV2:verify}=await implementation();
  const input=commit();mutate(input);
  assert.throws(()=>verify(input,COMMIT),/TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
});

test('tree canonicalizes Git directory ordering independently of API array order',async()=>{
  // Directory foo sorts after foo.bar, not before it as plain-name ordering does.
  const {verifyTask6aGithubTreeObjectV2:verify}=await implementation();
  const input=tree(),result=verify(input,TREE);
  assert.equal(result.sha,TREE);assert.equal(result.entryCount,3);
  input.tree.reverse();assert.equal(verify(input,TREE).sha,TREE);
  assert.equal(result.productionAuthority,false);assert.equal(Object.isFrozen(result),true);
});
const treeMutations={
  'truncated tree':r=>{r.truncated=true;},
  'changed member OID':r=>{r.tree[0].sha=TWO;},
  'changed executable mode':r=>{r.tree[1].mode='100755';},
  'symlink':r=>{r.tree[1].mode='120000';},
  'gitlink':r=>{r.tree[0].mode='160000';r.tree[0].type='commit';},
  'wrong type':r=>{r.tree[1].type='tree';},
  'nested name':r=>{r.tree[1].path='nested/z';},
  'dotdot name':r=>{r.tree[1].path='..';},
  'duplicate name':r=>{r.tree.push({...r.tree[1]});},
  'casefold duplicate':r=>{r.tree.push({...r.tree[1],path:'Z'});},
  'oversize name':r=>{r.tree[1].path='z'.repeat(256);},
  'negative blob size':r=>{r.tree[1].size=-1;},
  'fractional blob size':r=>{r.tree[1].size=0.5;},
  'oversize blob size':r=>{r.tree[1].size=2097153;},
  'too many members':r=>{r.tree=Array.from({length:4097},(_,i)=>({...r.tree[1],path:`f${i}`}));},
};
for(const [name,mutate] of Object.entries(treeMutations)) test(`tree refuses ${name}`,async()=>{
  const {verifyTask6aGithubTreeObjectV2:verify}=await implementation();
  const input=tree();mutate(input);
  assert.throws(()=>verify(input,TREE),/TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
});

test('blob verifies independently literal hello-newline Git and SHA256 identities',async()=>{
  const {verifyTask6aGithubBlobObjectV2:verify}=await implementation();
  const result=verify(blob(),BLOB);
  assert.equal(result.sha,BLOB);assert.equal(result.byteLength,6);
  assert.equal(result.contentSha256,'5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03');
  assert.equal(result.productionAuthority,false);assert.equal(Object.isFrozen(result),true);
});
const blobMutations={
  'wrong bytes':r=>{r.content='aGVsbG8h';},
  'wrong size':r=>{r.size=5;},
  'wrong encoding':r=>{r.encoding='utf-8';},
  'noncanonical padding bits':r=>{r.content='aGVsbG9=';r.size=5;},
  'invalid alphabet':r=>{r.content='aGVsbG8K$';},
  'embedded whitespace':r=>{r.content='aGVs bG8K';},
  'oversize decoded declaration':r=>{r.size=2097153;},
};
for(const [name,mutate] of Object.entries(blobMutations)) test(`blob refuses ${name}`,async()=>{
  const {verifyTask6aGithubBlobObjectV2:verify}=await implementation();
  const input=blob();mutate(input);
  assert.throws(()=>verify(input,BLOB),/TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
});

test('every object verifier refuses arity, accessor, prototype and identity substitutions',async()=>{
  const module=await implementation();let getterCalls=0;
  for(const [name,make,sha] of [
    ['verifyTask6aGithubSignedMergeObjectV2',commit,COMMIT],
    ['verifyTask6aGithubTreeObjectV2',tree,TREE],
    ['verifyTask6aGithubBlobObjectV2',blob,BLOB],
  ]) {
    const verify=module[name];
    assert.throws(()=>verify(make(),sha,'override'),/TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
    assert.throws(()=>verify(make()),/TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
    assert.throws(()=>verify(make(),ONE),/TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
    assert.throws(()=>verify(Object.assign(Object.create({}),make()),sha),/TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
    const input=make();Object.defineProperty(input,'sha',{get(){getterCalls++;return sha;}});
    assert.throws(()=>verify(input,sha),/TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
  }
  assert.equal(getterCalls,0,'metadata getters must not execute');
});

// Negative fixtures independently frame coherent objects so refusal cannot
// pass merely because malformed metadata happened to keep an old wrong hash.
function objectHash(kind,bytes) {
  return createHash('sha1').update(Buffer.from(`${kind} ${bytes.length}\0`)).update(bytes).digest('hex');
}
function coherentCommit(input) {
  const {payload,signature}=input.verification,p=payload.indexOf('\n\n');
  input.sha=objectHash('commit',Buffer.from(payload.slice(0,p)+'\ngpgsig '
    +signature.replaceAll('\n','\n ')+payload.slice(p)));
  return input;
}
for(const kind of ['payload bound','signature bound','unsupported header','multiple signatures','malformed armor body','terminal CRC separator','terminal actor separator']) test(`signed merge refuses coherently hashed ${kind}`,async()=>{
  const {verifyTask6aGithubSignedMergeObjectV2:verify}=await implementation();
  const input=commit();
  if(kind==='payload bound') input.verification.payload+='a'.repeat(65536);
  if(kind==='signature bound') input.verification.signature=input.verification.signature.replace('YWJj','YWJj'.repeat(4096));
  if(kind==='unsupported header') input.verification.payload=input.verification.payload.replace('\n\n','\nencoding UTF-8\n\n');
  if(kind==='multiple signatures') input.verification.signature+=input.verification.signature;
  if(kind==='malformed armor body') input.verification.signature=input.verification.signature.replace('YWJj','not signature data!');
  if(kind==='terminal CRC separator') input.verification.signature=input.verification.signature.replace('=AAAA','=AAAA\u2028');
  if(kind==='terminal actor separator') input.verification.payload=input.verification.payload.replace('+0000\n\n','+0000\u2029\n\n');
  coherentCommit(input);
  assert.throws(()=>verify(input,input.sha),/TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
});
test('tree refuses coherently hashed overlong portable name',async()=>{
  const {verifyTask6aGithubTreeObjectV2:verify}=await implementation();
  const name='z'.repeat(256),raw=Buffer.concat([Buffer.from(`100644 ${name}\0`),Buffer.from(BLOB,'hex')]);
  const sha=objectHash('tree',raw);
  assert.throws(()=>verify({sha,truncated:false,tree:[{path:name,mode:'100644',type:'blob',sha:BLOB,size:6}]},sha),
    /TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
});
function coherentTree(input) {
  const entries=[...input.tree].sort((a,b)=>Buffer.compare(
    Buffer.from(a.path+(a.mode==='040000'?'/':'')),Buffer.from(b.path+(b.mode==='040000'?'/':''))));
  input.sha=objectHash('tree',Buffer.concat(entries.flatMap(entry=>[
    Buffer.from(`${entry.mode.replace(/^0+/,'')} ${entry.path}\0`),Buffer.from(entry.sha,'hex'),
  ])));
  return input;
}
for(const kind of ['duplicate name','casefold duplicate','symlink','gitlink','wrong type','nested name','dotdot name','too many members']) {
  test(`tree refuses coherently hashed ${kind}`,async()=>{
    const {verifyTask6aGithubTreeObjectV2:verify}=await implementation();
    const input=tree();treeMutations[kind](input);coherentTree(input);
    assert.throws(()=>verify(input,input.sha),/TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
  });
}
test('tree refuses newline-extended member OID even when hex decoder preserves bytes',async()=>{
  const {verifyTask6aGithubTreeObjectV2:verify}=await implementation();
  const input=tree();input.tree[1].sha+='\n';
  assert.throws(()=>verify(input,TREE),/TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
});
test('tree refuses coherently hashed terminal newline in member name',async()=>{
  const {verifyTask6aGithubTreeObjectV2:verify}=await implementation();
  const input=tree();input.tree[1].path+='\n';coherentTree(input);
  assert.throws(()=>verify(input,input.sha),/TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
});
test('blob handles the full bounded large input without regexp stack failure',async()=>{
  // Recursive group quantifiers can throw RangeError well before the2MiB bound.
  const {verifyTask6aGithubBlobObjectV2:verify}=await implementation();
  const bytes=Buffer.alloc(2097152,97),sha=objectHash('blob',bytes);
  const result=verify({sha,size:bytes.length,encoding:'base64',content:bytes.toString('base64')},sha);
  assert.equal(result.byteLength,2097152);
});
test('blob refuses coherently hashed overbound bytes before decoding',async()=>{
  const {verifyTask6aGithubBlobObjectV2:verify}=await implementation();
  const bytes=Buffer.alloc(2097153,97),sha=objectHash('blob',bytes);
  assert.throws(()=>verify({sha,size:bytes.length,encoding:'base64',content:bytes.toString('base64')},sha),
    /TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED/);
});

test('default npm graph actually dispatches the Git object protocol leaf',()=>{
  const pkg=JSON.parse(fs.readFileSync(new URL('../../package.json',import.meta.url),'utf8'));
  const pending=['test'],visited=new Set(),selectors=[];
  while(pending.length) {
    const name=pending.pop();if(visited.has(name)) continue;visited.add(name);
    const command=pkg.scripts[name];assert.equal(typeof command,'string');
    for(const match of command.matchAll(/\bnpm run ([a-zA-Z0-9:_-]+)/g)) pending.push(match[1]);
    if(/\bnode\b[^&]*--test\b/.test(command)) {
      for(const match of command.matchAll(/(?:tests|scripts)\/[a-zA-Z0-9_./*-]+\.test\.(?:js|ts)/g)) selectors.push(match[0]);
    }
  }
  const target='scripts/__tests__/task6a-github-delivery-object-v2.test.js';
  assert.ok(selectors.some(selector=>new RegExp(`^${selector
    .replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'[^/]*')}$`).test(target)),
    'default npm graph never selects the object protocol suite');
  const result=spawnSync(process.execPath,['--test',
    '--test-name-pattern=^blob verifies independently literal hello-newline',target],{
    cwd:new URL('../../',import.meta.url),env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
    timeout:5000,maxBuffer:65536,encoding:'utf8',
  });
  assert.equal(result.error,undefined);assert.equal(result.signal,null);
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/blob verifies independently literal hello-newline/);
  assert.match(result.stdout,/(?:ℹ|#) pass 1\b/);
});
