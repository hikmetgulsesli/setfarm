import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { collectTask6aNativeClosureV1, hashNativeBytesV1, insideTask6aNativeRootV1,
  isTask6aSystemImageV1, readNativeRegularV1, verifyTask6aRelocatedNativeImageV1,
  assertTask6aNativeSourceStableV1, accountTask6aNativePayloadBytesV1,
  assertTask6aNativeCleanupCertainV1, markTask6aNativeReleaseUncertainV1,
  readTask6aNativeResourceV1, assertTask6aReadonlyLoggingCacheMapsV1 } from "./task6a-native-load-commands-v1.js";

const clean = { PATH:"/usr/bin:/bin",LANG:"C",LC_ALL:"C" };
function tool(executable:string,args:string[]):string {
  assertTask6aNativeCleanupCertainV1();
  const result=spawnSync(executable,args,{env:clean,cwd:"/private/tmp",encoding:"utf8",timeout:15_000,maxBuffer:1_048_576});
  if(result.error||result.signal!==null||result.status===null)markTask6aNativeReleaseUncertainV1();
  assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,0,result.stderr);
  return result.stdout.trim();
}
function batch<T>(items:readonly T[],run:(part:readonly T[])=>void):void {
  for(let i=0;i<items.length;i+=64)run(items.slice(i,i+64));
}
export type ProtectedNativeFixtureV1=Readonly<{
  node:string;negativeNode:string;pgBin:string;root:string;memberCount:number;imageCount:number;
  environment:Readonly<{OPENSSL_CONF:string;OPENSSL_MODULES:string}>;
  protect(rootCommand:(executable:string,args:string[])=>string):void;
  sealParent():void;
  recheck():void;
  verifyImages(pid:number,uid:number,required:readonly string[],rootCommand:(executable:string,args:string[])=>string):void;
  denialTargets:readonly string[];
}>;

// Trusted-driver payload preparation only. Not a production installer or attestor.
export function prepareTask6aProtectedNativeFixtureV1(home:string):ProtectedNativeFixtureV1 {
  assert.equal(path.dirname(home),"/private/tmp");assert.match(path.basename(home),/^setfarm-task6a-protected-pg\.[A-Za-z0-9]+$/);
  assert.equal(fs.realpathSync(home),home);
  const root=path.join(home,"native"),pgSuffix="opt/homebrew/Cellar/postgresql@17/17.10/bin";
  const pgSource="/opt/homebrew/Cellar/postgresql@17/17.10/bin",pgBin=path.join(root,pgSuffix),node=path.join(root,"node/bin/node");
  assert.equal(fs.existsSync(root),false);
  const entries=[{source:"/opt/homebrew/Cellar/node@22/22.23.1/bin/node",target:node},
    ...["postgres","pg_ctl","initdb","psql"].map(name=>({source:path.join(pgSource,name),target:path.join(pgBin,name)})),
    ...["plpgsql","dict_snowball"].map(name=>({source:`/opt/homebrew/Cellar/postgresql@17/17.10/lib/postgresql/${name}.dylib`,
      target:path.join(root,"opt/homebrew/lib/postgresql@17",`${name}.dylib`)}))];
  const images=collectTask6aNativeClosureV1(entries,root),allowedImages=new Set(images.map(item=>item.target));
  assert.ok(images.length<128);
  const nodeImage=images.find(image=>image.target===node)!;
  assert.throws(()=>verifyTask6aRelocatedNativeImageV1(nodeImage.target,nodeImage.bytes,root,allowedImages),
    /TASK6A_NATIVE_CLOSURE_REFUSED/,"original Homebrew executable must not masquerade as protected relocation");
  // Capture the complete non-executable resource shape before any payload write.
  // Homebrew timezone aliases can be hardlinked trusted inputs; each published
  // output must still be a fresh independent one-link protected regular file.
  const resources:{source:string;target:string;identity:fs.BigIntStats;bytes:Buffer|null;members:string[]|null}[]=[];
  let resourceBytes=0;
  function captureResources(source:string,target:string,depth:number):void {
    assert.ok(depth<=32&&resources.length<4096);
    const before=fs.lstatSync(source,{bigint:true});
    if(before.isDirectory()&&!before.isSymbolicLink()){
      const members=fs.readdirSync(source).sort();resources.push({source,target,identity:before,bytes:null,members});
      for(const name of members)captureResources(path.join(source,name),path.join(target,name),depth+1);
      const after=fs.lstatSync(source,{bigint:true});
      for(const field of ["dev","ino","uid","gid","mode","nlink","size","birthtimeNs","mtimeNs","ctimeNs"] as const)
        assert.equal(after[field],before[field]);
      assert.deepEqual(fs.readdirSync(source).sort(),members);
    }else{
      assert.ok(before.size>=0n&&before.size<=BigInt(536_870_912-resourceBytes));
      const captured=readTask6aNativeResourceV1(source);
      resourceBytes=accountTask6aNativePayloadBytesV1(resourceBytes,0,captured.bytes.length);
      resources.push({source,target,identity:captured.identity,bytes:captured.bytes,members:null});
    }
  }
  captureResources("/opt/homebrew/Cellar/postgresql@17/17.10/share/postgresql",path.join(root,"opt/homebrew/share/postgresql@17"),0);
  accountTask6aNativePayloadBytesV1(images.reduce((total,item)=>total+item.bytes.length,0),0,resourceBytes);
  function recheckResource(record:typeof resources[number]):void {
    const current=record.bytes===null?{identity:fs.lstatSync(record.source,{bigint:true}),bytes:null}:readTask6aNativeResourceV1(record.source);
    for(const field of ["dev","ino","uid","gid","mode","nlink","size","birthtimeNs","mtimeNs","ctimeNs"] as const)
      assert.equal(current.identity[field],record.identity[field]);
    if(record.bytes!==null)assert.ok(current.bytes!.equals(record.bytes));
    else assert.deepEqual(fs.readdirSync(record.source).sort(),record.members);
  }
  for(const resource of resources)recheckResource(resource);
  fs.mkdirSync(root,{mode:0o700});
  const directories=new Set<string>([root]),files=new Map<string,{hash:string;executable:boolean;byteLength:number}>();
  let payloadBytes=0;
  function ensureDirectory(target:string):void {
    if(directories.has(target))return;
    assert.ok(insideTask6aNativeRootV1(root,target));ensureDirectory(path.dirname(target));
    fs.mkdirSync(target,{mode:0o700});directories.add(target);
  }
  function publish(target:string,bytes:Buffer,executable:boolean):void {
    assert.ok(insideTask6aNativeRootV1(root,target));assert.equal(files.has(target),false);
    payloadBytes=accountTask6aNativePayloadBytesV1(payloadBytes,0,bytes.length);
    ensureDirectory(path.dirname(target));fs.writeFileSync(target,bytes,{flag:"wx",mode:executable?0o755:0o644});
    files.set(target,{hash:hashNativeBytesV1(bytes),executable,byteLength:bytes.length});
  }
  for(const image of images){
    assertTask6aNativeSourceStableV1(image);
    publish(image.target,image.bytes,true);
    const edits:string[]=[];
    for(const load of image.replacements)if(load.from!==load.to)edits.push("-change",load.from,load.to);
    for(const rpath of image.commands.rpaths)edits.push("-delete_rpath",rpath);
    if(image.commands.installId!==null)edits.push("-id",`@loader_path/${path.basename(image.target)}`);
    if(edits.length>0)tool("/usr/bin/install_name_tool",[...edits,image.target]);
    tool("/usr/bin/codesign",["--force","--sign","-","--timestamp=none",image.target]);
    tool("/usr/bin/codesign",["--verify","--strict",image.target]);
    const copied=readNativeRegularV1(image.target);
    const expected={fileType:image.commands.fileType,
      dependencies:image.commands.dependencies.map(dependency=>({kind:dependency.kind,
        path:image.replacements.find(edit=>edit.from===dependency.path)?.to??dependency.path})),
      installId:image.commands.installId===null?null:`@loader_path/${path.basename(image.target)}`,
      rpaths:[],dynamicLinker:image.commands.dynamicLinker};
    verifyTask6aRelocatedNativeImageV1(image.target,copied.bytes,root,allowedImages,expected);
    payloadBytes=accountTask6aNativePayloadBytesV1(payloadBytes,files.get(image.target)!.byteLength,copied.bytes.length);
    files.set(image.target,{hash:hashNativeBytesV1(copied.bytes),executable:true,byteLength:copied.bytes.length});
    assertTask6aNativeSourceStableV1(image);
  }
  // Separate negative tree: identical relocated Node/dependency bytes, except
  // the required libnode image is deliberately absent. Positive tree untouched.
  const negativeNode=path.join(root,"negative/node/bin/node");
  for(const image of images.filter(item=>item.target===node||path.dirname(item.target)===path.join(root,"lib"))){
    if(path.basename(image.target).startsWith("libnode."))continue;
    publish(path.join(root,"negative",path.relative(root,image.target)),fs.readFileSync(image.target),true);
  }
  for(const resource of resources){
    recheckResource(resource);
    if(resource.bytes===null)ensureDirectory(resource.target);else publish(resource.target,resource.bytes,false);
    recheckResource(resource);
  }
  const opensslConf=path.join(root,"openssl.cnf"),opensslModules=path.join(root,"openssl-modules");
  publish(opensslConf,Buffer.alloc(0),false);ensureDirectory(opensslModules);
  const identityByPath=new Map<string,fs.BigIntStats>();let protectedPayload=false;
  const ancestorPaths=["/","/private","/private/tmp",home],ancestorIdentities=new Map<string,fs.BigIntStats>();
  const filePaths=[...files.keys()].sort(),directoryPaths=[...directories].sort();
  function aclFree(paths:readonly string[]):void {
    batch(paths,part=>{
      const lines=tool("/bin/ls",["-lde",...part]).split("\n");
      assert.equal(lines.length,part.length,"ACL rows/unknown output must refuse");
      for(const line of lines)assert.match(line,/^[d-][rwxStTs-]{9}[@+]?\s+/);
    });
  }
  function protect(rootCommand:(executable:string,args:string[])=>string):void {
    assert.equal(protectedPayload,false);
    aclFree(["/","/private","/private/tmp",home,...directoryPaths,...filePaths]);
    batch([...filePaths,...directoryPaths],part=>rootCommand("/usr/sbin/chown",["root:wheel",...part]));
    batch(filePaths.filter(file=>files.get(file)!.executable),part=>rootCommand("/bin/chmod",["0555",...part]));
    batch(filePaths.filter(file=>!files.get(file)!.executable),part=>rootCommand("/bin/chmod",["0444",...part]));
    batch([...directoryPaths].reverse(),part=>rootCommand("/bin/chmod",["0555",...part]));
    for(const target of [...directoryPaths,...filePaths])identityByPath.set(target,fs.lstatSync(target,{bigint:true}));
    protectedPayload=true;recheck();
  }
  function recheck():void {
    assertTask6aNativeCleanupCertainV1();
    assert.equal(protectedPayload,true);
    for(const target of ancestorPaths){
      const stat=fs.lstatSync(target,{bigint:true});assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());
      if(ancestorIdentities.size>0){
        const before=ancestorIdentities.get(target)!;
        for(const field of ["dev","ino","uid","gid","mode","birthtimeNs"] as const)assert.equal(stat[field],before[field]);
      }
    }
    for(const target of [...directoryPaths,...filePaths]){
      const before=identityByPath.get(target)!,after=fs.lstatSync(target,{bigint:true});
      for(const field of ["dev","ino","uid","gid","mode","nlink","size","birthtimeNs","mtimeNs","ctimeNs"] as const)
        assert.equal(after[field],before[field],`protected native member drift: ${target}`);
      assert.equal(after.uid,0n);assert.equal(after.gid,0n);assert.equal(after.dev,fs.lstatSync(home,{bigint:true}).dev);
      if(files.has(target)){
        assert.equal(after.mode&0o7777n,files.get(target)!.executable?0o555n:0o444n);
        assert.equal(hashNativeBytesV1(readNativeRegularV1(target).bytes),files.get(target)!.hash);
      }else{
        assert.equal(after.mode&0o7777n,0o555n);assert.ok(after.isDirectory()&&!after.isSymbolicLink());
        const children=[...directoryPaths,...filePaths].filter(p=>path.dirname(p)===target).map(p=>path.basename(p)).sort();
        assert.deepEqual(fs.readdirSync(target).sort(),children);
      }
    }
    aclFree([home,...directoryPaths,...filePaths]);
  }
  function sealParent():void {
    assert.equal(ancestorIdentities.size,0);assert.equal(protectedPayload,true);
    for(const target of ancestorPaths){
      const stat=fs.lstatSync(target,{bigint:true});assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());assert.equal(stat.uid,0n);
      assert.equal(stat.mode&0o7777n,target==="/private/tmp"?0o1777n:target===home?0o711n:0o755n);
      ancestorIdentities.set(target,stat);
    }
    aclFree(ancestorPaths);recheck();
  }
  function verifyImages(pid:number,uid:number,required:readonly string[],rootCommand:(executable:string,args:string[])=>string):void {
    assert.ok(Number.isSafeInteger(pid)&&pid>1);recheck();
    assert.equal(ancestorIdentities.size,4);
    const argumentsForIdentity=["-p",String(pid),"-o","uid=","-o","lstart=","-o","command="];
    const before=rootCommand("/bin/ps",argumentsForIdentity);assert.equal(Number(before.split(/\s+/)[0]),uid);
    const output=rootCommand("/usr/sbin/lsof",["-a","-p",String(pid),"-d","txt","-Fn"]);
    const names=output.split("\n").filter(line=>line.startsWith("n")).map(line=>line.slice(1));
    assert.ok(names.length>0&&names.length<=256);
    const dataNames=names.filter(name=>!isTask6aSystemImageV1(name)&&!allowedImages.has(name));
    assert.ok(dataNames.length<=4);
    if(dataNames.length>0){
      for(const name of dataNames)assert.match(name,/^\/Library\/Preferences\/Logging\/\.plist-cache\.[A-Za-z0-9]{1,64}$/,
        `native mapped image escaped closure: ${name}`);
      const first=rootCommand("/usr/bin/vmmap",["-w",String(pid)]);
      assert.equal(rootCommand("/usr/sbin/lsof",["-a","-p",String(pid),"-d","txt","-Fn"]),output,
        "mapped membership changed between data classification samples");
      const second=rootCommand("/usr/bin/vmmap",["-w",String(pid)]);
      for(const name of dataNames)assertTask6aReadonlyLoggingCacheMapsV1(first,second,pid,name);
    }
    // Data exclusions cannot satisfy the unchanged executable/module checks.
    for(const member of required)assert.ok(names.includes(member),`required mapped image absent: ${member}`);
    assert.equal(rootCommand("/bin/ps",argumentsForIdentity),before,"mapped-image process identity changed");
    recheck();
  }
  return Object.freeze({node,negativeNode,pgBin,root,memberCount:filePaths.length,imageCount:images.length,
    environment:Object.freeze({OPENSSL_CONF:opensslConf,OPENSSL_MODULES:opensslModules}),protect,sealParent,recheck,verifyImages,
    denialTargets:Object.freeze([node,pgBin,path.join(root,"lib"),...images.slice(0,8).map(item=>item.target),opensslConf,opensslModules])});
}
