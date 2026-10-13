import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Pure controlled transport fixtures. No tests, children or production authority.
const COMMIT='8aa0d2c6f44815339da3d6ecf8eac8ff1cc49d2c';
const HELPER=new URL('../../task6a-origin-archive-v2.pm',import.meta.url);
const NATIVE=new URL('../../task6a-origin-native-v2.pm',import.meta.url);
const MAP=new URL('../../task6a-origin-map-v2.pm',import.meta.url);
const ENTRY=new URL('../../task6a-protected-origin-entry-v2.mjs',import.meta.url);
const ZERO='0'.repeat(40),ONE='1'.repeat(40),TWO='2'.repeat(40);
function literalCommit() {
  return {sha:COMMIT,tree:{sha:ZERO},parents:[{sha:ONE},{sha:TWO}],verification:{verified:true,reason:'valid',
    payload:`tree ${ZERO}\nparent ${ONE}\nparent ${TWO}\nauthor Example <dev@example.test> 1700000000 +0000\ncommitter Example <dev@example.test> 1700000000 +0000\n\nreviewed merge\n`,
    signature:'-----BEGIN PGP SIGNATURE-----\n\nYWJj\n=AAAA\n-----END PGP SIGNATURE-----\n',
  }};
}
function framedHash(kind,bytes) {return createHash('sha1').update(`${kind} ${bytes.length}\0`).update(bytes).digest('hex');}
function coherentCommit(r) {
  const p=r.verification.payload,s=r.verification.signature,i=p.indexOf('\n\n');
  r.sha=framedHash('commit',Buffer.from(p.slice(0,i)+'\ngpgsig '+s.split('\n').join('\n ')+p.slice(i)));return r;
}
function coherentTree(r) {
  const entries=[...r.tree].sort((a,b)=>Buffer.compare(Buffer.from(a.path+(a.type==='tree'?'/':'')),Buffer.from(b.path+(b.type==='tree'?'/':''))));
  r.sha=framedHash('tree',Buffer.concat(entries.flatMap(e=>[Buffer.from(`${e.mode==='040000'?'40000':e.mode} ${e.path}\0`),Buffer.from(e.sha,'hex')])));return r;
}
function sourceGraph({sourceBytes={}}={}) {
  const sources=[['task6a-origin-archive-v2.pm',HELPER],['task6a-origin-native-v2.pm',NATIVE],['task6a-origin-map-v2.pm',MAP],['task6a-protected-origin-entry-v2.mjs',ENTRY]];
  const blobs=sources.map(([path,url])=>{
    const bytes=sourceBytes[path]??readFileSync(url);return {path,sha:framedHash('blob',bytes),size:bytes.length,bytes};
  });
  const scripts=coherentTree({truncated:false,tree:blobs.map(({path,sha,size})=>({path,sha,size,mode:'100644',type:'blob'}))});
  const root=coherentTree({truncated:false,tree:[{path:'scripts',sha:scripts.sha,mode:'040000',type:'tree'}]});
  const merge=literalCommit();merge.tree.sha=root.sha;merge.verification.payload=merge.verification.payload.replace(`tree ${ZERO}`,`tree ${root.sha}`);coherentCommit(merge);
  const main={ref:'refs/heads/main',object:{type:'commit',sha:merge.sha}};
  const pr={number:253,state:'closed',merged:true,merged_at:'2026-09-30T13:00:00Z',merge_commit_sha:merge.sha,
    base:{ref:'main',repo:{full_name:'hikmetgulsesli/setfarm'}},head:{sha:TWO,repo:{full_name:'hikmetgulsesli/setfarm'}}};
  return [
    {route:'/git/ref/heads/main',data:main},{route:`/git/commits/${merge.sha}`,data:merge},
    {route:`/commits/${merge.sha}/pulls?per_page=100&page=1`,data:[{number:253,merge_commit_sha:merge.sha}]},
    {route:'/pulls/253',data:pr},{route:`/git/trees/${root.sha}`,data:root},{route:`/git/trees/${scripts.sha}`,data:scripts},
    ...blobs.map(b=>({route:`/git/blobs/${b.sha}`,data:{sha:b.sha,size:b.size,encoding:'base64',content:b.bytes.toString('base64')}})),
    {route:'/git/ref/heads/main',data:structuredClone(main)},
  ];
}

export {ZERO,ONE,TWO,literalCommit,framedHash,coherentCommit,coherentTree,sourceGraph};
