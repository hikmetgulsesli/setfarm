// Test-only genuine Git/finalized-output fixture. New roots remain retained.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

export const hash=b=>createHash('sha256').update(b).digest('hex');
const gitEnvironment={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',GIT_CONFIG_NOSYSTEM:'1',
  GIT_CONFIG_GLOBAL:'/dev/null',GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'};
const gitPrefix=['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false'];
export function canonical(value) {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)))
    .map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
export function git(root,args) {
  return execFileSync('/usr/bin/git',[...gitPrefix,...args],{cwd:root,encoding:'utf8',
    env:gitEnvironment,stdio:['ignore','pipe','pipe']}).trim();
}
export function file(root,locator,bytes,mode=0o644) {
  const target=path.join(root,locator);
  fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
  fs.writeFileSync(target,bytes,{flag:'wx',mode});fs.chmodSync(target,mode);
  return target;
}
export function finalize(root) {
  const sourceSha=git(root,['rev-parse','HEAD']),sourceTreeHash=git(root,['rev-parse','HEAD^{tree}']);
  const records=execFileSync('/usr/bin/git',[...gitPrefix,'ls-tree','-r','-z','--full-tree',sourceSha],
    {cwd:root,env:gitEnvironment,stdio:['ignore','pipe','pipe']});
  const entries=records.toString().split('\0').filter(Boolean).map(line=>{
    const m=/^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/.exec(line);
    if(!m)throw Error('unexpected fixture Git entry');
    return {locator:m[3],gitMode:m[1],gitBlobHash:m[2]};
  }).sort((a,b)=>Buffer.compare(Buffer.from(a.locator),Buffer.from(b.locator)));
  const buildInputSetHash=hash(canonical({schema:'setfarm.internal-production-pinned-build-input-set.v1',
    sourceSha,sourceTreeHash,entries}));
  const outputFiles=[['dist/cli/cli.js',0o755],['dist/server/daemon.js',0o644],
    ['dist/service.js',0o644],['dist/spawner.js',0o644]];
  const bytes=Buffer.from("throw Error('FORBIDDEN_DIST_EVALUATION');\n");
  const outputProjection={schema:'setfarm.platform-build-output-tree.v1',sourceSha,sourceTreeHash,
    entries:outputFiles.map(([locator,mode])=>({locator,mode,byteLength:bytes.length,sha256:hash(bytes)}))};
  const outputTree={...outputProjection,outputTreeHash:hash(canonical(outputProjection))};
  const converter=fs.readFileSync(path.join(root,'scripts/stitch-to-jsx.mjs'));
  const manifest={schema:'setfarm.platform-release-manifest.v1',releaseSha:sourceSha,branch:'main',dirty:false,
    stitchConverter:{converterId:'setfarm.stitch-to-jsx',source:{schema:'setfarm.source-artifact-ref.v1',
      hash:hash(converter),mediaType:'text/javascript',locator:'scripts/stitch-to-jsx.mjs',byteLength:converter.length}}};
  const stableBuildInfo={schema:'setfarm.internal-production-stable-setfarm-build-info.v1',sha:sourceSha,
    shortSha:sourceSha.slice(0,8),branch:'main',dirty:false,packageVersion:'1.0.0',
    displayVersion:'1.0.0+'+sourceSha.slice(0,8)};
  const {schema,...info}=stableBuildInfo;
  for(const [locator,mode] of outputFiles)file(root,locator,bytes,mode);
  file(root,'dist/BUILD_INFO.json',JSON.stringify({...info,builtAt:'2026-10-08T00:00:00.000Z'},null,2)+'\n',0o444);
  file(root,'dist/PLATFORM_BUILD_OUTPUT_TREE.json',JSON.stringify(outputTree)+'\n',0o444);
  file(root,'dist/PLATFORM_RELEASE_MANIFEST.json',JSON.stringify(manifest)+'\n',0o444);
  for(const locator of ['dist','dist/cli','dist/server'])fs.chmodSync(path.join(root,locator),0o755);
  const buildHash=hash(canonical({schema:'setfarm.internal-production-controller-build.v1',stableBuildInfo,
    buildInputSetHash,outputTreeHash:outputTree.outputTreeHash,releaseManifestHash:hash(canonical(manifest))}));
  return {sourceSha,sourceTreeHash,buildHash};
}
export function createFinalizedFixture(files) {
  const root=fs.realpathSync(fs.mkdtempSync('/private/tmp/setfarm-native-inputs-v2.'));
  fs.chmodSync(root,0o700);
  for(const [locator,bytes] of Object.entries(files))file(root,locator,bytes);
  file(root,'.gitignore','.setfarm/\ndist/\n');
  file(root,'package.json','{"name":"setfarm-native-inputs-fixture","version":"1.0.0","type":"module"}\n');
  file(root,'scripts/stitch-to-jsx.mjs','export const fixture=true;\n');
  for(const locator of ['src/cli/cli.ts','src/server/daemon.ts','src/service.ts','src/spawner.ts'])
    file(root,locator,'export const fixture=true;\n');
  git(root,['init','-q','-b','main']);git(root,['config','user.name','Setfarm Test']);
  git(root,['config','user.email','setfarm-test@example.invalid']);git(root,['config','commit.gpgsign','false']);
  git(root,['config','remote.origin.url','https://github.com/hikmetgulsesli/setfarm.git']);
  git(root,['add','.']);git(root,['commit','-qm','owned native-input fixture']);
  git(root,['update-ref','refs/remotes/origin/main','HEAD']);
  const expected=finalize(root);
  console.log(JSON.stringify({kind:'owned-native-inputs-fixture',root,...expected}));
  return {root,expected};
}
