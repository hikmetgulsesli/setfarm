import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {verifyTask6aGithubSignedMergeObjectV2,verifyTask6aGithubTreeObjectV2,
  verifyTask6aGithubBlobObjectV2} from './task6a-github-delivery-object-v2.mjs';

// Ordinary fixed HTTPS diagnostics only. This reader neither admits its own
// execution/bootstrap nor grants reviewed, protected or production authority.
const PREFIX='https://api.github.com/repos/hikmetgulsesli/setfarm';
const REPO='hikmetgulsesli/setfarm';
const REF='/git/ref/heads/main';
const SOURCES=Object.freeze(['task6a-github-delivery-object-v2.mjs',
  'task6a-fixed-github-source-transport-v2.mjs']);
const MAX_BODY=4*1024*1024;
function refuse() {throw Error('TASK6A_GITHUB_SOURCE_TRANSPORT_REFUSED');}
function oid(value) {
  if(typeof value!=='string'||value.length!==40||!/^[a-f0-9]+$/.test(value)) refuse();
  return value;
}
function mainRef(value) {
  if(value?.ref!=='refs/heads/main'||value?.object?.type!=='commit') refuse();
  return oid(value.object.sha);
}

export function observeCurrentTask6aGithubMergedSourceTransportV2() {
  if(arguments.length!==0) refuse();
  const start=performance.now(),deadline=start+60000;
  function remaining() {
    const now=performance.now();
    if(!Number.isFinite(now)||now<start||now>=deadline) refuse();
    return deadline-now;
  }
  function get(route) {
    const bound=Math.min(10000,Math.floor(remaining()));
    if(bound<1) refuse();
    const url=PREFIX+route;
    const result=spawnSync('/usr/bin/curl',['-q','--silent','--show-error',
      '--proto','=https','--tlsv1.2','--cacert','/private/etc/ssl/cert.pem',
      '--proxy','','--noproxy','*','--max-redirs','0','--connect-timeout','5',
      '--max-time',String(bound/1000),'-H','Accept: application/vnd.github+json',
      '-H','X-GitHub-Api-Version: 2022-11-28','--write-out',
      '\n%{http_code}\n%{content_type}\n%{url_effective}',url],{
      cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},shell:false,
      timeout:bound,maxBuffer:MAX_BODY+1024,
    });
    remaining();
    if(result.error||result.signal!==null||result.status!==0
      ||!Buffer.isBuffer(result.stdout)||result.stdout.length>MAX_BODY+1024) refuse();
    const text=result.stdout.toString('utf8');
    if(!Buffer.from(text,'utf8').equals(result.stdout)) refuse();
    const lines=text.split('\n'),effective=lines.pop(),type=lines.pop(),status=lines.pop();
    if(effective!==url||status!=='200'||typeof type!=='string'
      ||!/^application\/json(?:;[\x20-\x7e]*)?$/.test(type)) refuse();
    const body=lines.join('\n');
    if(Buffer.byteLength(body)>MAX_BODY) refuse();
    return JSON.parse(body);
  }
  try {
    const mainSha=mainRef(get(REF));
    const merge=verifyTask6aGithubSignedMergeObjectV2(get(`/git/commits/${mainSha}`),mainSha);
    const associations=get(`/commits/${mainSha}/pulls?per_page=100&page=1`);
    if(!Array.isArray(associations)||associations.length>=100) refuse();
    const matches=associations.filter(pr=>pr?.merge_commit_sha===mainSha);
    if(matches.length!==1||!Number.isSafeInteger(matches[0].number)||matches[0].number<1) refuse();
    const prNumber=matches[0].number,pr=get(`/pulls/${prNumber}`);
    if(pr?.number!==prNumber||pr.state!=='closed'||pr.merged!==true
      ||typeof pr.merged_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(pr.merged_at)
      ||pr.merge_commit_sha!==mainSha||pr.base?.ref!=='main'
      ||pr.base?.repo?.full_name!==REPO||pr.head?.repo?.full_name!==REPO
      ||oid(pr.head?.sha)!==merge.parentShas[1]) refuse();
    const root=get(`/git/trees/${merge.treeSha}`);
    verifyTask6aGithubTreeObjectV2(root,merge.treeSha);
    const directory=root.tree.find(entry=>entry.path==='scripts');
    if(directory?.mode!=='040000'||directory.type!=='tree') refuse();
    const scripts=get(`/git/trees/${oid(directory.sha)}`);
    verifyTask6aGithubTreeObjectV2(scripts,directory.sha);
    const sources=SOURCES.map(name=>{
      const entry=scripts.tree.find(item=>item.path===name);
      if(entry?.mode!=='100644'||entry.type!=='blob') refuse();
      const blob=verifyTask6aGithubBlobObjectV2(get(`/git/blobs/${oid(entry.sha)}`),entry.sha);
      if(blob.byteLength!==entry.size) refuse();
      return Object.freeze({path:`scripts/${name}`,gitBlobSha:blob.sha,
        byteLength:blob.byteLength,contentSha256:blob.contentSha256});
    });
    // Endpoint agreement only: this does not exclude transient ABA ref moves
    // or authenticate this reader's executing source/toolchain.
    if(mainRef(get(REF))!==mainSha) refuse();
    remaining();
    return Object.freeze({schema:'setfarm.task6a-fixed-github-source-transport.v2',
      scope:'merged-source-transport-diagnostic-only',productionAuthority:false,
      reviewAuthority:false,mainSha,treeSha:merge.treeSha,prNumber,
      headSha:merge.parentShas[1],sources:Object.freeze(sources)});
  } catch {refuse();}
}
