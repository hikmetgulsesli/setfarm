import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// Test-only native closure reader. No production authority or execution effects.
export type NativeDependencyV1 = Readonly<{ kind: "load" | "weak" | "reexport" | "upward" | "lazy"; path: string }>;
export type NativeLoadCommandsV1 = Readonly<{
  fileType: number; dependencies: readonly NativeDependencyV1[];
  installId: string | null; rpaths: readonly string[]; dynamicLinker: string | null;
}>;
export function nativeClosureRefusedV1(reason: string): never {
  throw new Error(`TASK6A_NATIVE_CLOSURE_REFUSED:${reason}`);
}
let nativeReleaseUncertain=false;
export function markTask6aNativeReleaseUncertainV1():void { nativeReleaseUncertain=true; }
export function assertTask6aNativeCleanupCertainV1():void {
  if(nativeReleaseUncertain)nativeClosureRefusedV1("native release or child completion uncertain; retain fixture");
}
export function accountTask6aNativePayloadBytesV1(total:number,currentLength:number,newLength:number):number {
  if(![total,currentLength,newLength].every(value=>Number.isSafeInteger(value)&&value>=0)
    ||currentLength>total||total>536_870_912||total-currentLength+newLength>536_870_912)
    nativeClosureRefusedV1("native complete payload byte bound exceeded");
  return total-currentLength+newLength;
}

function validNativePath(value: string, isRpath: boolean): void {
  if (Buffer.byteLength(value) > 1024 || !/^[\x21-\x7e]+$/.test(value)) nativeClosureRefusedV1("invalid native path bytes");
  if (isRpath && ["@loader_path","@executable_path"].includes(value)) return;
  const macro = /^(?:@loader_path|@executable_path|@rpath)\//.exec(value);
  if (!value.startsWith("/") && !macro) nativeClosureRefusedV1("unresolved native path kind");
  const segments = value.slice(macro?.[0].length ?? 1).split("/");
  if (segments.some(segment => segment === "" || segment === ".")
    || ((!macro || value.startsWith("@rpath/")) && segments.includes(".."))) {
    nativeClosureRefusedV1("noncanonical native path");
  }
}

export function parseTask6aNativeLoadCommandsV1(bytes: Buffer): NativeLoadCommandsV1 {
  if (!Buffer.isBuffer(bytes) || bytes.length < 32 || bytes.length > 536_870_912
    || bytes.readUInt32LE(0) !== 0xfeedfacf || bytes.readUInt32LE(4) !== 0x0100000c
    || bytes.readUInt32LE(28) !== 0) nativeClosureRefusedV1("not bounded thin arm64 Mach-O");
  const fileType = bytes.readUInt32LE(12), count = bytes.readUInt32LE(16), tableBytes = bytes.readUInt32LE(20);
  if (![2, 6, 8].includes(fileType) || count > 4096 || tableBytes > 16_777_216
    || tableBytes < count * 8 || tableBytes > bytes.length - 32) nativeClosureRefusedV1("invalid load-command table");
  const dependencies: NativeDependencyV1[] = [], rpaths: string[] = [];
  let installId: string | null = null, dynamicLinker: string | null = null, cursor = 32;
  const end = 32 + tableBytes;
  const kinds = new Map<number, NativeDependencyV1["kind"]>([
    [0xc, "load"], [0x80000018, "weak"], [0x8000001f, "reexport"], [0x80000023, "upward"], [0x20, "lazy"],
  ]);
  const nonLoaderCommands=new Set([0x2,0xb,0x16,0x19,0x1a,0x1b,0x1d,0x1e,0x22,0x80000022,
    0x24,0x26,0x80000028,0x29,0x2a,0x2b,0x2e,0x31,0x32,0x80000033,0x80000034,0x36,0x37,0x38,0x39]);
  for (let i = 0; i < count; i++) {
    if (cursor + 8 > end) nativeClosureRefusedV1("truncated load command");
    const cmd = bytes.readUInt32LE(cursor), size = bytes.readUInt32LE(cursor + 4);
    if (size < 8 || size % 8 !== 0 || size > end - cursor) nativeClosureRefusedV1("crossed load-command size");
    const kind = kinds.get(cmd), isString = kind !== undefined || cmd === 0xd || cmd === 0xe || cmd === 0x8000001c;
    if (isString) {
      const minimum = kind !== undefined || cmd === 0xd ? 24 : 12;
      if (size < minimum + 1) nativeClosureRefusedV1("truncated loader string");
      if(kind!==undefined&&bytes.readUInt32LE(cursor+12)===0x1a741800)
        nativeClosureRefusedV1("unsupported alternate dylib-use record semantics");
      const offset = bytes.readUInt32LE(cursor + 8);
      if (offset < minimum || offset >= size) nativeClosureRefusedV1("crossed loader string offset");
      const terminator = bytes.indexOf(0, cursor + offset);
      if (terminator < 0 || terminator >= cursor + size) nativeClosureRefusedV1("unterminated loader string");
      const value = bytes.subarray(cursor + offset, terminator).toString("utf8");
      validNativePath(value,cmd===0x8000001c);
      if (kind !== undefined) dependencies.push(Object.freeze({ kind, path: value }));
      else if (cmd === 0xd) {
        if (installId !== null) nativeClosureRefusedV1("duplicate install id");
        installId = value;
      } else if (cmd === 0xe) {
        if (dynamicLinker !== null || value !== "/usr/lib/dyld") nativeClosureRefusedV1("invalid dynamic linker");
        dynamicLinker = value;
      } else rpaths.push(value);
    } else if (!nonLoaderCommands.has(cmd)) {
      nativeClosureRefusedV1("unsupported loader command");
    }
    cursor += size;
  }
  if (cursor !== end) nativeClosureRefusedV1("load-command count/size mismatch");
  return Object.freeze({ fileType, dependencies: Object.freeze(dependencies), installId,
    rpaths: Object.freeze(rpaths), dynamicLinker });
}

export function isTask6aSystemImageV1(target: string): boolean {
  return target.startsWith("/usr/lib/") || target.startsWith("/System/Library/");
}
// A logging cache is sampled data, never an image/source/ownership authority.
// Darwin lsof txt includes mapped data as well as executable image mappings.
export function assertTask6aReadonlyLoggingCacheMapsV1(first:string,second:string,pid:number,cache:string):void {
  if(!Number.isSafeInteger(pid)||pid<=1||!/^\/Library\/Preferences\/Logging\/\.plist-cache\.[A-Za-z0-9]{1,64}$/.test(cache))
    nativeClosureRefusedV1("not an exact logging-cache data path/process");
  for(const output of [first,second]){
    if(typeof output!=="string"||Buffer.byteLength(output)>1_048_576||output.includes("\0")
      ||/(?:warning|error|truncated|unable|failed|not permitted)/i.test(output))nativeClosureRefusedV1("invalid complete VM map output");
    const lines=output.split("\n");if(lines.length>8192)nativeClosureRefusedV1("VM map line bound exceeded");
    const processLines=lines.filter(line=>/^Process:/.test(line));
    if(processLines.length!==1||!new RegExp(`^Process:\\s+.+ \\[${pid}\\]$`).test(processLines[0]!))nativeClosureRefusedV1("VM map process crossed");
    const sections=[`==== Non-writable regions for process ${pid}`,`==== Writable regions for process ${pid}`,"==== Legend",`==== Summary for process ${pid}`];
    const positions=sections.map(section=>{
      if(lines.filter(line=>line===section).length!==1)nativeClosureRefusedV1("VM map section absent/crossed/truncated");
      return lines.indexOf(section);
    });
    if(positions.some((position,index)=>index>0&&position<=positions[index-1]!))nativeClosureRefusedV1("VM map section order crossed");
    const matches=lines.map((line,index)=>({line,index})).filter(row=>row.line.includes(cache));
    if(matches.length<1||matches.length>64)nativeClosureRefusedV1("logging-cache map absent or region bound exceeded");
    for(const row of matches){
      const match=/^[A-Za-z_ ][A-Za-z0-9_ ()-]*\s+[0-9a-f]+-[0-9a-f]+\s+\[\s*[0-9.KMGTB ]+\]\s+(r--\/r--)\s+SM=(?:SHM|COW|PRV)\s+(\/.*)$/.exec(row.line);
      if(!match||match[2]!==cache||row.index<=positions[0]!||row.index>=positions[2]!)
        nativeClosureRefusedV1("logging-cache region is malformed or current/max executable/writable");
    }
  }
}
export function insideTask6aNativeRootV1(root: string, target: string): boolean {
  return path.isAbsolute(root) && path.normalize(root) === root && path.normalize(target) === target
    && target.startsWith(`${root}/`);
}
export function verifyTask6aRelocatedNativeImageV1(target:string,bytes:Buffer,nativeRoot:string,allowed:ReadonlySet<string>,expected?:NativeLoadCommandsV1):void {
  if (!insideTask6aNativeRootV1(nativeRoot,target)) nativeClosureRefusedV1("image escaped native root");
  const parsed=parseTask6aNativeLoadCommandsV1(bytes);
  if(expected!==undefined&&JSON.stringify(parsed)!==JSON.stringify(expected))nativeClosureRefusedV1("relocated dependency kinds/paths/order/install id differ from intended closure");
  if (parsed.rpaths.length!==0) nativeClosureRefusedV1("relocated image retains search fallback");
  for (const dependency of parsed.dependencies) {
    if (isTask6aSystemImageV1(dependency.path)) continue;
    if (!dependency.path.startsWith("@loader_path/")) nativeClosureRefusedV1("relocated load has external search path");
    const resolved=path.resolve(path.dirname(target),dependency.path.slice(13));
    if (!insideTask6aNativeRootV1(nativeRoot,resolved)||!allowed.has(resolved)) nativeClosureRefusedV1("relocated load escaped or is not a closure member");
  }
}
export type NativeImageV1 = Readonly<{
  source: string; target: string; bytes: Buffer; originalHash: string; originalIdentity: fs.BigIntStats;
  commands: NativeLoadCommandsV1; replacements: readonly Readonly<{from: string; to: string}>[];
}>;
export function hashNativeBytesV1(bytes: Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
export function assertTask6aNativeSourceStableV1(record:NativeImageV1):void {
  const current=readNativeRegularV1(record.source);
  if(hashNativeBytesV1(current.bytes)!==record.originalHash)nativeClosureRefusedV1("source hash drift after collection");
  for(const field of ["dev","ino","uid","gid","mode","nlink","size","birthtimeNs","mtimeNs","ctimeNs"] as const)
    if(current.identity[field]!==record.originalIdentity[field])nativeClosureRefusedV1("source identity drift after collection");
}
export function readNativeRegularV1(source: string): Readonly<{bytes: Buffer; identity: fs.BigIntStats}> {
  return readCapturedRegularV1(source,1n);
}
// Trusted, non-executable resource input only. Publication creates independent
// one-link files; no resource alias is ever execution or protection authority.
export function readTask6aNativeResourceV1(source:string):Readonly<{bytes:Buffer;identity:fs.BigIntStats}> {
  return readCapturedRegularV1(source,4096n);
}
function readCapturedRegularV1(source:string,maximumLinks:bigint):Readonly<{bytes:Buffer;identity:fs.BigIntStats}> {
  assertTask6aNativeCleanupCertainV1();
  const before = fs.lstatSync(source, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink<1n||before.nlink>maximumLinks
    ||(maximumLinks!==1n&&(before.mode&0o111n)!==0n)||before.size > 536_870_912n) {
    nativeClosureRefusedV1("invalid source regular file");
  }
  const fd = fs.openSync(source, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let primary:unknown,failed=false;
  try {
    const held = fs.fstatSync(fd, { bigint: true });
    for(const field of ["dev","ino","uid","gid","mode","nlink","size","birthtimeNs","mtimeNs","ctimeNs"] as const)
      if(before[field]!==held[field])nativeClosureRefusedV1("source file changed before bounded read");
    const buffer=Buffer.alloc(Number(before.size)+1);let length=0;
    while(length<buffer.length){
      const count=fs.readSync(fd,buffer,length,Math.min(65536,buffer.length-length),length);
      if(count===0)break;length+=count;
    }
    const bytes=buffer.subarray(0,length);
    for (const after of [fs.fstatSync(fd, {bigint:true}), fs.lstatSync(source, {bigint:true})]) {
      for (const field of ["dev","ino","uid","gid","mode","nlink","size","birthtimeNs","mtimeNs","ctimeNs"] as const)
        if (before[field] !== after[field]) nativeClosureRefusedV1("source file drift");
    }
    if (BigInt(bytes.length) !== before.size) nativeClosureRefusedV1("source byte length drift");
    return Object.freeze({ bytes, identity: before });
  } catch(error) { failed=true;primary=error;throw error; }
  finally {
    try { fs.closeSync(fd); }
    catch(error) {
      markTask6aNativeReleaseUncertainV1();
      if(failed)throw new AggregateError([primary,error],"native read and release failed; retain fixture");
      throw error;
    }
  }
}

export function collectTask6aNativeClosureV1(
  entries: readonly Readonly<{source: string; target: string}>[], nativeRoot: string,
): readonly NativeImageV1[] {
  if (entries.length < 1 || entries.length > 16) nativeClosureRefusedV1("entry count invalid");
  const images = new Map<string, {source:string;target:string;bytes:Buffer;originalHash:string;
    originalIdentity:fs.BigIntStats;commands:NativeLoadCommandsV1;replacements:Readonly<{from:string;to:string}>[]}>();
  const targets = new Map<string,string>(), pending: {source:string;target:string;executable:string;rpaths:string[];standalone:boolean|null}[] = [];
  const queuedContexts=new Set<string>(),resolutions=new Map<string,string[]>();
  const installIds=new Map<string,string>(),basenames=new Map<string,string>();
  let total = 0;
  function enqueue(source: string, target: string, executable: string, rpaths: string[],standalone:boolean|null): void {
    if (!insideTask6aNativeRootV1(nativeRoot,target)) nativeClosureRefusedV1("destination escaped native root");
    const real = fs.realpathSync(source);
    const priorTarget = targets.get(target);
    if (priorTarget !== undefined && priorTarget !== real) nativeClosureRefusedV1("destination collision");
    targets.set(target,real);
    const prior = pending.find(item=>item.source===real);
    if ((prior && prior.target!==target) || (images.has(real) && images.get(real)!.target!==target)) nativeClosureRefusedV1("source destination crossed");
    const uniqueRpaths=[...new Set(rpaths)],contextKey=JSON.stringify([real,executable,uniqueRpaths,standalone]);
    if(!queuedContexts.has(contextKey)){
      if(pending.length>=1024)nativeClosureRefusedV1("native resolution context bound exceeded");
      queuedContexts.add(contextKey);pending.push({source:real,target,executable,rpaths:uniqueRpaths,standalone});
    }
  }
  for (const entry of entries) enqueue(entry.source,entry.target,fs.realpathSync(entry.source),[],null);
  function expand(value:string, source:string, executable:string): string {
    if (value==="@loader_path") return path.dirname(source);
    if (value==="@executable_path") return path.dirname(executable);
    if (value.startsWith("@loader_path/")) return path.resolve(path.dirname(source),value.slice(13));
    if (value.startsWith("@executable_path/")) return path.resolve(path.dirname(executable),value.slice(17));
    if (value.startsWith("/")) return value;
    nativeClosureRefusedV1("recursive unresolved rpath");
  }
  function resolve(load:string,item:typeof pending[number],rpaths:string[]): string {
    const candidates = load.startsWith("@rpath/") ? rpaths.map(p=>path.join(p,load.slice(7)))
      : [expand(load,item.source,item.executable)];
    const found = new Set<string>();
    for (const candidate of candidates) {
      try { found.add(fs.realpathSync(candidate)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code!=="ENOENT") throw error; }
    }
    if (found.size!==1) nativeClosureRefusedV1("required native dependency missing or ambiguous");
    return [...found][0]!;
  }
  for (let index=0; index<pending.length; index++) {
    const item=pending[index]!;
    let record=images.get(item.source);
    if(!record){
      if (images.size>=128) nativeClosureRefusedV1("native graph count exceeded");
      const captured=readNativeRegularV1(item.source),commands=parseTask6aNativeLoadCommandsV1(captured.bytes);
      const basename=path.basename(item.source);
      if(basenames.has(basename)&&basenames.get(basename)!==item.source)nativeClosureRefusedV1("duplicate native basename");
      basenames.set(basename,item.source);
      if(commands.installId!==null){
        if(installIds.has(commands.installId)&&installIds.get(commands.installId)!==item.source)nativeClosureRefusedV1("duplicate native install id");
        installIds.set(commands.installId,item.source);
      }
      total+=captured.bytes.length;
      if (total>536_870_912) nativeClosureRefusedV1("native graph byte bound exceeded");
      record={source:item.source,target:item.target,bytes:captured.bytes,originalHash:hashNativeBytesV1(captured.bytes),
        originalIdentity:captured.identity,commands,replacements:[]};
      images.set(item.source,record);
    }
    const commands=record.commands,firstContext=!resolutions.has(item.source),resolvedDependencies:string[]=[];
    const standalone=item.standalone??commands.fileType!==2;
    if(standalone&&(commands.dependencies.some(load=>load.path.startsWith("@executable_path/")||load.path.startsWith("@rpath/"))
      ||commands.rpaths.some(value=>value.startsWith("@executable_path"))))
      nativeClosureRefusedV1("standalone module requires an unbound executable context");
    const rpaths=[...commands.rpaths.map(p=>expand(p,item.source,item.executable)),...item.rpaths];
    for (const dependency of commands.dependencies) {
      if (isTask6aSystemImageV1(dependency.path)) continue;
      const source=resolve(dependency.path,item,rpaths);
      resolvedDependencies.push(source);
      if (isTask6aSystemImageV1(source)) nativeClosureRefusedV1("non-system load redirects to system alias");
      const prior=images.get(source)??pending.find(candidate=>candidate.source===source);
      const target=prior?.target??path.join(nativeRoot,"lib",path.basename(source));
      enqueue(source,target,item.executable,rpaths,standalone);
      if(firstContext)record.replacements.push(Object.freeze({from:dependency.path,to:`@loader_path/${path.relative(path.dirname(item.target),target)}`}));
    }
    if(!firstContext&&JSON.stringify(resolutions.get(item.source))!==JSON.stringify(resolvedDependencies))nativeClosureRefusedV1("native load resolution differs across executable contexts");
    resolutions.set(item.source,resolvedDependencies);
  }
  for (const record of images.values()) {
    const current=readNativeRegularV1(record.source);
    if (!current.bytes.equals(record.bytes)) nativeClosureRefusedV1("source closure bytes drifted");
    for (const field of ["dev","ino","uid","gid","mode","nlink","size","birthtimeNs","mtimeNs","ctimeNs"] as const)
      if (current.identity[field]!==record.originalIdentity[field]) nativeClosureRefusedV1("source closure identity drifted");
  }
  return Object.freeze([...images.values()].map(record=>Object.freeze({...record,replacements:Object.freeze(record.replacements)})));
}
