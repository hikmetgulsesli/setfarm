import assert from "node:assert/strict";
import { test } from "node:test";
import fs, { existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

// These bytes are built independently from the documented Mach-O structures.
function command(cmd: number, value: string, offset = 24): Buffer {
  const bytes = Buffer.alloc(Math.ceil((offset + Buffer.byteLength(value) + 1) / 8) * 8);
  bytes.writeUInt32LE(cmd, 0); bytes.writeUInt32LE(bytes.length, 4);
  bytes.writeUInt32LE(offset, 8); bytes.write(value, offset); return bytes;
}
function image(commands: Buffer[], type = 2): Buffer {
  const header = Buffer.alloc(32);
  header.writeUInt32LE(0xfeedfacf, 0); header.writeUInt32LE(0x0100000c, 4);
  header.writeUInt32LE(type, 12); header.writeUInt32LE(commands.length, 16);
  header.writeUInt32LE(commands.reduce((sum, item) => sum + item.length, 0), 20);
  return Buffer.concat([header, ...commands]);
}
const target = new URL("./task6a-native-load-commands-v1.ts", import.meta.url);
const helper = existsSync(fileURLToPath(target)) ? await import(target.href) : {};
function parse(bytes: Buffer): any {
  assert.equal(typeof helper.parseTask6aNativeLoadCommandsV1, "function", "native load-command parser is missing");
  return helper.parseTask6aNativeLoadCommandsV1(bytes);
}

test("native parser retains every dependency load kind and separates install id/rpaths/linker", () => {
  const result = parse(image([
    command(0xc, "/usr/lib/libSystem.B.dylib"),
    command(0x80000018, "@rpath/libweak.dylib"),
    command(0x8000001f, "@loader_path/libreexport.dylib"),
    command(0x80000023, "@executable_path/libupward.dylib"),
    command(0x20, "/opt/homebrew/lib/liblazy.dylib"),
    command(0xd, "@rpath/libself.dylib"),
    command(0x8000001c, "@loader_path/../lib", 12),
    command(0xe, "/usr/lib/dyld", 12),
  ], 6));
  assert.deepEqual(result, {
    fileType: 6,
    dependencies: [
      { kind: "load", path: "/usr/lib/libSystem.B.dylib" },
      { kind: "weak", path: "@rpath/libweak.dylib" },
      { kind: "reexport", path: "@loader_path/libreexport.dylib" },
      { kind: "upward", path: "@executable_path/libupward.dylib" },
      { kind: "lazy", path: "/opt/homebrew/lib/liblazy.dylib" },
    ],
    installId: "@rpath/libself.dylib", rpaths: ["@loader_path/../lib"], dynamicLinker: "/usr/lib/dyld",
  });
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.dependencies) && Object.isFrozen(result.dependencies[0]));
});

const valid = image([command(0xc, "/usr/lib/libSystem.B.dylib")]);
for (const [name, mutate] of [
  ["foreign architecture", (b: Buffer) => b.writeUInt32LE(0x01000007, 4)],
  ["fat binary", (b: Buffer) => b.writeUInt32LE(0xcafebabe, 0)],
  ["truncated table", (b: Buffer) => b.writeUInt32LE(b.length, 20)],
  ["excess commands", (b: Buffer) => b.writeUInt32LE(4097, 16)],
  ["crossed table size", (b: Buffer) => b.writeUInt32LE(8, 20)],
  ["unaligned command", (b: Buffer) => b.writeUInt32LE(25, 36)],
  ["string overlapping command fields", (b: Buffer) => b.writeUInt32LE(8, 40)],
  ["string outside command", (b: Buffer) => b.writeUInt32LE(65535, 40)],
  ["missing terminator", (b: Buffer) => b.fill(0x61, 56)],
  ["unsupported load command", (b: Buffer) => b.writeUInt32LE(0x8000000c, 32)],
] as const) {
  test(`native parser refuses ${name}`, () => {
    const changed = Buffer.from(valid); mutate(changed);
    assert.throws(() => parse(changed), /TASK6A_NATIVE_CLOSURE_REFUSED/);
  });
}
for (const badPath of ["librelative.dylib", "/usr/lib/../evil.dylib", "/usr//lib/evil.dylib", "@unknown/lib.dylib",
  "/usr/lib/bad\nname.dylib", `/usr/lib/${"a".repeat(1025)}`, "@rpath/../outside.dylib"]) {
  test(`native parser refuses noncanonical path ${JSON.stringify(badPath).slice(0, 70)}`, () => {
    assert.throws(() => parse(image([command(0xc, badPath)])), /TASK6A_NATIVE_CLOSURE_REFUSED/);
  });
}
test("native parser rejects repeated install identifiers and non-system dynamic linker", () => {
  assert.throws(() => parse(image([command(0xd, "@rpath/a.dylib"), command(0xd, "@rpath/b.dylib")], 6)), /TASK6A_NATIVE_CLOSURE_REFUSED/);
  assert.throws(() => parse(image([command(0xe, "/opt/homebrew/bin/dyld", 12)])), /TASK6A_NATIVE_CLOSURE_REFUSED/);
});
test("native parser skips a bounded non-loader command without inventing a dependency", () => {
  const uuid = Buffer.alloc(24); uuid.writeUInt32LE(0x1b, 0); uuid.writeUInt32LE(24, 4);
  assert.deepEqual(parse(image([uuid])).dependencies, []);
});
test("native parser accepts the literal loader directory as a search root", () => {
  assert.deepEqual(parse(image([command(0x8000001c,"@loader_path",12)])).rpaths,["@loader_path"]);
});

// Removing transitive traversal or the destination containment check must fail.
function withTree(run: (root: string) => void): void {
  const root = fs.mkdtempSync("/private/tmp/setfarm-native-graph.");
  const identity = fs.lstatSync(root, { bigint: true });
  try { run(root); }
  finally {
    assert.equal(fs.lstatSync(root, { bigint: true }).ino, identity.ino);
    // Only this independently created bounded no-symlink test tree.
    let count=0;
    function remove(target:string):void{assert.ok(++count<100);
      const stat=fs.lstatSync(target,{bigint:true});assert.equal(stat.dev,identity.dev);
      if(stat.isDirectory()){for(const name of fs.readdirSync(target))remove(path.join(target,name));fs.rmdirSync(target);}
      else{assert.ok(stat.isFile()&&!stat.isSymbolicLink());fs.unlinkSync(target);}}
    remove(root);
  }
}
function collect(entries: readonly {source: string; target: string}[], root: string): any {
  assert.equal(typeof helper.collectTask6aNativeClosureV1, "function", "native closure collector is missing");
  return helper.collectTask6aNativeClosureV1(entries, root);
}
test("native closure follows a real transitive cycle and derives contained concrete replacements", () => withTree(root => {
  fs.writeFileSync(path.join(root, "entry"), image([command(0xc, "@loader_path/liba.dylib")]));
  fs.writeFileSync(path.join(root, "liba.dylib"), image([command(0xc, "@loader_path/libb.dylib")], 6));
  fs.writeFileSync(path.join(root, "libb.dylib"), image([command(0xc, "@loader_path/liba.dylib"), command(0xc, "/usr/lib/libSystem.B.dylib")], 6));
  const native = path.join(root, "native");
  const got = collect([{source:path.join(root,"entry"),target:path.join(native,"bin/entry")}], native);
  assert.equal(got.length, 3);
  assert.deepEqual(got.map((item:any)=>({name:path.basename(item.source),loads:item.replacements})), [
    {name:"entry",loads:[{from:"@loader_path/liba.dylib",to:"@loader_path/../lib/liba.dylib"}]},
    {name:"liba.dylib",loads:[{from:"@loader_path/libb.dylib",to:"@loader_path/libb.dylib"}]},
    {name:"libb.dylib",loads:[{from:"@loader_path/liba.dylib",to:"@loader_path/liba.dylib"}]},
  ]);
}));
test("native closure refuses missing required dependency instead of search fallback", () => withTree(root => {
  fs.writeFileSync(path.join(root, "entry"), image([command(0x80000018, "@loader_path/missing.dylib")]));
  assert.throws(()=>collect([{source:path.join(root,"entry"),target:path.join(root,"native/entry")}],path.join(root,"native")),/TASK6A_NATIVE_CLOSURE_REFUSED/);
}));
test("native closure refuses a destination outside its private root", () => withTree(root => {
  fs.writeFileSync(path.join(root, "entry"), image([]));
  assert.throws(()=>collect([{source:path.join(root,"entry"),target:path.join(root,"escaped")}],path.join(root,"native")),/TASK6A_NATIVE_CLOSURE_REFUSED/);
}));
test("native closure refuses two different binaries mapped to one destination", () => withTree(root => {
  fs.writeFileSync(path.join(root, "entry"), image([])); fs.writeFileSync(path.join(root, "other"), image([],6));
  const native=path.join(root,"native");
  assert.throws(()=>collect([{source:path.join(root,"entry"),target:path.join(native,"same")},
    {source:path.join(root,"other"),target:path.join(native,"same")}],native),/TASK6A_NATIVE_CLOSURE_REFUSED/);
}));
function verifyRelocated(bytes:Buffer, dependencies:readonly string[]):void {
  assert.equal(typeof helper.verifyTask6aRelocatedNativeImageV1,"function","relocated image verifier is missing");
  helper.verifyTask6aRelocatedNativeImageV1("/private/tmp/native/lib/a.dylib",bytes,"/private/tmp/native",new Set(dependencies));
}
test("relocated verifier rejects original mutable Homebrew imports before execution",()=>{
  assert.throws(()=>verifyRelocated(image([command(0xc,"/opt/homebrew/opt/openssl@3/lib/libcrypto.3.dylib")],6),[]),/TASK6A_NATIVE_CLOSURE_REFUSED/);
});
test("relocated verifier accepts only system and exact contained closure members",()=>{
  verifyRelocated(image([command(0xc,"@loader_path/libb.dylib"),command(0xc,"/usr/lib/libSystem.B.dylib")],6),["/private/tmp/native/lib/libb.dylib"]);
  assert.throws(()=>verifyRelocated(image([command(0xc,"@loader_path/libb.dylib")],6),[]),/TASK6A_NATIVE_CLOSURE_REFUSED/);
  assert.throws(()=>verifyRelocated(image([command(0xc,"@loader_path/../../outside.dylib")],6),["/private/tmp/outside.dylib"]),/TASK6A_NATIVE_CLOSURE_REFUSED/);
});
test("relocated verifier refuses any retained native search fallback",()=>{
  assert.throws(()=>verifyRelocated(image([command(0x8000001c,"@loader_path",12)],6),[]),/TASK6A_NATIVE_CLOSURE_REFUSED/);
});
test("native parser refuses unknown required-dyld and unsupported new loader commands",()=>{
  for(const cmd of [0x80000039,0x3a,0x3b,0x40,0x18]){
    const unknown=Buffer.alloc(24);unknown.writeUInt32LE(cmd);unknown.writeUInt32LE(24,4);
    assert.throws(()=>parse(image([unknown])),/TASK6A_NATIVE_CLOSURE_REFUSED/);
  }
});
test("native closure refuses one shared image resolving differently for two entry executable contexts",()=>withTree(root=>{
  for(const name of ["a","b"])fs.mkdirSync(path.join(root,name));
  const shared=path.join(root,"shared.dylib");fs.writeFileSync(shared,image([command(0xc,"@executable_path/libtarget.dylib")],6));
  for(const name of ["a","b"]){
    fs.writeFileSync(path.join(root,name,"entry"),image([command(0xc,shared)]));
    fs.writeFileSync(path.join(root,name,"libtarget.dylib"),image([],6));
  }
  const native=path.join(root,"native");
  assert.throws(()=>collect(["a","b"].map(name=>({source:path.join(root,name,"entry"),target:path.join(native,"bin",name)})),native),/TASK6A_NATIVE_CLOSURE_REFUSED/);
}));
test("native closure rejects global duplicate install identifiers",()=>withTree(root=>{
  for(const name of ["a","b"])fs.writeFileSync(path.join(root,name),image([command(0xd,"@rpath/same.dylib")],6));
  const native=path.join(root,"native");
  assert.throws(()=>collect(["a","b"].map(name=>({source:path.join(root,name),target:path.join(native,"lib",name)})),native),/TASK6A_NATIVE_CLOSURE_REFUSED/);
}));
test("native closure rejects duplicate original basenames even at distinct destinations",()=>withTree(root=>{
  for(const name of ["a","b"]){fs.mkdirSync(path.join(root,name));fs.writeFileSync(path.join(root,name,"same.dylib"),image([],6));}
  const native=path.join(root,"native");
  assert.throws(()=>collect(["a","b"].map(name=>({source:path.join(root,name,"same.dylib"),target:path.join(native,name,"same.dylib")})),native),/TASK6A_NATIVE_CLOSURE_REFUSED/);
}));
test("native reader rejects an actual inode substitution before reading bytes and closes its acquired FD",()=>withTree(root=>{
  const source=path.join(root,"source");fs.writeFileSync(source,Buffer.alloc(32));let reads=0;
  const port={...fs,openSync:(p:fs.PathLike,flags:number)=>{
    fs.renameSync(source,path.join(root,"old"));fs.writeFileSync(source,Buffer.alloc(2048));return fs.openSync(p,flags);
  },readFileSync:(...args:any[])=>{reads++;return (fs.readFileSync as any)(...args);},
  readSync:(...args:any[])=>{reads++;return (fs.readSync as any)(...args);}};
  const sourceText=fs.readFileSync(fileURLToPath(target),"utf8");
  const compiled=ts.transpileModule(sourceText,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const module={exports:{} as any};
  const require=(name:string)=>name==="node:fs"?port:name==="node:path"?path:name==="node:crypto"?{createHash:()=>{throw Error("unused hash");}}:null;
  vm.runInNewContext(compiled,{module,exports:module.exports,require,Buffer,Set,Map});
  function fdCount():number{let count=0;for(let fd=0;fd<1024;fd++){try{fs.fstatSync(fd);count++;}catch(e){assert.equal((e as NodeJS.ErrnoException).code,"EBADF");}}return count;}
  const before=fdCount();assert.throws(()=>module.exports.readNativeRegularV1(source),/TASK6A_NATIVE_CLOSURE_REFUSED/);
  assert.equal(reads,0,"replacement must reject before any read/allocation");assert.equal(fdCount(),before);
}));
test("relocated verifier rejects retargeting to a different allowed image or dependency kind/order",()=>{
  const expected={fileType:6,dependencies:[{kind:"load",path:"@loader_path/b.dylib"},{kind:"weak",path:"@loader_path/c.dylib"}],
    installId:"@loader_path/a.dylib",rpaths:[],dynamicLinker:null};
  const allowed=new Set(["/private/tmp/native/lib/b.dylib","/private/tmp/native/lib/c.dylib"]);
  for(const commands of [
    [command(0xc,"@loader_path/c.dylib"),command(0x80000018,"@loader_path/b.dylib")],
    [command(0x80000018,"@loader_path/b.dylib"),command(0xc,"@loader_path/c.dylib")],
    [command(0x80000018,"@loader_path/c.dylib"),command(0xc,"@loader_path/b.dylib")],
  ])assert.throws(()=>helper.verifyTask6aRelocatedNativeImageV1("/private/tmp/native/lib/a.dylib",
    image([...commands,command(0xd,"@loader_path/a.dylib")],6),"/private/tmp/native",allowed,expected),/TASK6A_NATIVE_CLOSURE_REFUSED/);
});
test("native source recheck refuses same-byte mode drift after collection",()=>withTree(root=>{
  const source=path.join(root,"source");fs.writeFileSync(source,image([]));const native=path.join(root,"native");
  const [record]=collect([{source,target:path.join(native,"source")}],native);
  assert.equal(typeof helper.assertTask6aNativeSourceStableV1,"function","native source recheck is missing");
  helper.assertTask6aNativeSourceStableV1(record);fs.chmodSync(source,0o600);
  assert.throws(()=>helper.assertTask6aNativeSourceStableV1(record),/TASK6A_NATIVE_CLOSURE_REFUSED/);
}));
test("private synchronous child ambiguity burns cleanup but ordinary denied exit does not",()=>{
  const integration=fs.readFileSync(new URL("./task6a-private-protected-cluster.integration.test.ts",import.meta.url),"utf8");
  const ast=ts.createSourceFile("fixture.ts",integration,ts.ScriptTarget.Latest,true);
  const body=ast.statements.find((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text==="command")!;
  assert.ok(body);
  for(const result of [
    {error:Error("fixture timeout"),signal:null,status:null,stdout:"",stderr:""},
    {error:undefined,signal:"SIGTERM",status:null,stdout:"",stderr:""},
    {error:undefined,signal:null,status:null,stdout:"",stderr:""},
    {error:undefined,signal:null,status:42,stdout:"",stderr:""},
  ]){
    const script=`let synchronousChildUncertain=false;const cleanEnv={};${body.getText(ast)};
      globalThis.probe=()=>{try{command('/bin/false',[]);}catch{}return synchronousChildUncertain;};`;
    const compiled=ts.transpileModule(script,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const sandbox:any={assert,spawnSync:()=>result};vm.runInNewContext(compiled,sandbox);
    assert.equal(sandbox.probe(),result.status!==42,"only definite normal exit permits fixture cleanup");
  }
});
test("native parser rejects unsupported alternate dylib-use records and their semantic flags",()=>{
  for(const flags of [0,1,2,4,8,16,0xffffffff]){
    const record=command(0xc,"@loader_path/b.dylib",28);record.writeUInt32LE(0x1a741800,12);record.writeUInt32LE(flags,24);
    assert.throws(()=>parse(image([record])),/TASK6A_NATIVE_CLOSURE_REFUSED/);
  }
});
test("native payload budget counts negative copies and post-edit growth before publication",()=>{
  assert.equal(typeof helper.accountTask6aNativePayloadBytesV1,"function","native payload byte budget is missing");
  assert.equal(helper.accountTask6aNativePayloadBytesV1(500,100,120),520);
  assert.equal(helper.accountTask6aNativePayloadBytesV1(536870912,100,98),536870910);
  assert.throws(()=>helper.accountTask6aNativePayloadBytesV1(536870912,0,1),/TASK6A_NATIVE_CLOSURE_REFUSED/);
  assert.throws(()=>helper.accountTask6aNativePayloadBytesV1(536870912,100,101),/TASK6A_NATIVE_CLOSURE_REFUSED/);
  assert.throws(()=>helper.accountTask6aNativePayloadBytesV1(1,2,0),/TASK6A_NATIVE_CLOSURE_REFUSED/);
});
test("native reader close ambiguity preserves both failures and denies all reacquisition",()=>withTree(root=>{
  const source=path.join(root,"source");fs.writeFileSync(source,image([]));let opens=0,closes=0;
  const primary=Error("actual descriptor read failure"),close=Error("release completion uncertain");
  const port={...fs,openSync:(...args:any[])=>{opens++;return (fs.openSync as any)(...args);},
    readSync:()=>{throw primary;},closeSync:(fd:number)=>{closes++;fs.closeSync(fd);throw close;}};
  const compiled=ts.transpileModule(fs.readFileSync(fileURLToPath(target),"utf8"),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const module={exports:{} as any};
  vm.runInNewContext(compiled,{module,exports:module.exports,Buffer,Set,Map,AggregateError,
    require:(name:string)=>name==="node:fs"?port:name==="node:path"?path:{}});
  assert.throws(()=>module.exports.readNativeRegularV1(source),(error:any)=>
    error instanceof AggregateError&&error.errors.includes(primary)&&error.errors.includes(close));
  assert.equal(opens,1);assert.equal(closes,1);
  assert.throws(()=>module.exports.readNativeRegularV1(source),/TASK6A_NATIVE_CLOSURE_REFUSED/);
  assert.equal(opens,1,"uncertain release must reject before reacquiring a descriptor");
  assert.equal(typeof module.exports.assertTask6aNativeCleanupCertainV1,"function");
  assert.throws(()=>module.exports.assertTask6aNativeCleanupCertainV1(),/TASK6A_NATIVE_CLOSURE_REFUSED/);
}));
test("standalone module closure rejects executable-dependent imports, including transitive ones",()=>withTree(root=>{
  for(const dependency of ["@executable_path/child.dylib","@rpath/child.dylib"]){
    const source=path.join(root,"module.dylib");fs.writeFileSync(source,image([command(0xc,dependency)],8));
    fs.writeFileSync(path.join(root,"child.dylib"),image([],6));
    const native=path.join(root,"native");
    assert.throws(()=>collect([{source,target:path.join(native,"module.dylib")}],native),/TASK6A_NATIVE_CLOSURE_REFUSED/);
  }
  const source=path.join(root,"module.dylib"),child=path.join(root,"child.dylib");
  fs.writeFileSync(source,image([command(0xc,"@loader_path/child.dylib")],8));
  fs.writeFileSync(child,image([command(0xc,"@executable_path/leaf.dylib")],6));
  fs.writeFileSync(path.join(root,"leaf.dylib"),image([],6));
  const native=path.join(root,"native");
  assert.throws(()=>collect([{source,target:path.join(native,"module.dylib")}],native),/TASK6A_NATIVE_CLOSURE_REFUSED/);
}));
test("native closure resolves a real dependency chain using inherited executable rpaths",()=>withTree(root=>{
  fs.mkdirSync(path.join(root,"libs"));
  const source=path.join(root,"entry"),native=path.join(root,"native");
  fs.writeFileSync(source,image([command(0x8000001c,"@loader_path/libs",12),command(0xc,"@rpath/a.dylib")]));
  fs.writeFileSync(path.join(root,"libs/a.dylib"),image([command(0xc,"@rpath/b.dylib")],6));
  fs.writeFileSync(path.join(root,"libs/b.dylib"),image([],6));
  const got=collect([{source,target:path.join(native,"bin/entry")}],native);
  assert.deepEqual(got.map((record:any)=>path.basename(record.source)),["entry","a.dylib","b.dylib"]);
  assert.deepEqual(got[1].replacements,[{from:"@rpath/b.dylib",to:"@loader_path/b.dylib"}]);
}));
test("native closure refuses two existing inherited rpath candidates rather than choosing one",()=>withTree(root=>{
  for(const name of ["a","b"]){fs.mkdirSync(path.join(root,name));fs.writeFileSync(path.join(root,name,"same.dylib"),image([],6));}
  const source=path.join(root,"entry"),native=path.join(root,"native");
  fs.writeFileSync(source,image([command(0x8000001c,"@loader_path/a",12),command(0x8000001c,"@loader_path/b",12),command(0xc,"@rpath/same.dylib")]));
  assert.throws(()=>collect([{source,target:path.join(native,"entry")}],native),/TASK6A_NATIVE_CLOSURE_REFUSED/);
}));
test("private async completion and timeout helpers permanently retain ambiguous fixtures",()=>{
  const source=fs.readFileSync(new URL("./task6a-private-protected-cluster.integration.test.ts",import.meta.url),"utf8");
  const ast=ts.createSourceFile("fixture.ts",source,ts.ScriptTarget.Latest,true);
  const functions=["definiteFixtureChildClose","fixtureTimeout"].map(name=>{
    const body=ast.statements.find((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
    assert.ok(body,`missing real fixture helper: ${name}`);return body.getText(ast);
  });
  const compiled=ts.transpileModule(functions.join("\n"),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  for(const [code,signal,definite] of [[0,null,true],[1,null,true],[null,null,false],[null,"SIGTERM",false],[0,"SIGKILL",false]] as const){
    let burned=0;const sandbox:any={markTask6aNativeReleaseUncertainV1:()=>{burned++;},Error};
    vm.runInNewContext(compiled,sandbox);assert.equal(sandbox.definiteFixtureChildClose(code,signal),definite);
    assert.equal(burned,definite?0:1);assert.match(sandbox.fixtureTimeout("ready timeout").message,/retain/);assert.equal(burned,definite?1:2);
  }
});
test("trusted resource reader captures actual hardlinked bytes without weakening native image policy",()=>withTree(root=>{
  const source=path.join(root,"timezone"),alias=path.join(root,"timezone-alias");
  fs.writeFileSync(source,Buffer.from("trusted resource bytes"));fs.linkSync(source,alias);
  assert.throws(()=>helper.readNativeRegularV1(source),/TASK6A_NATIVE_CLOSURE_REFUSED/);
  assert.equal(typeof helper.readTask6aNativeResourceV1,"function","bounded resource reader is missing");
  const capture=helper.readTask6aNativeResourceV1(source);
  assert.equal(capture.identity.nlink,2n);assert.equal(capture.bytes.toString(),"trusted resource bytes");
  const copy=path.join(root,"copy");fs.writeFileSync(copy,capture.bytes,{flag:"wx"});
  assert.equal(fs.lstatSync(copy,{bigint:true}).nlink,1n);helper.readNativeRegularV1(copy);
}));
test("trusted resource reader refuses executable inputs even when their bytes are ordinary data",()=>withTree(root=>{
  const source=path.join(root,"resource");fs.writeFileSync(source,Buffer.from("data"),{mode:0o755});
  assert.throws(()=>helper.readTask6aNativeResourceV1(source),/TASK6A_NATIVE_CLOSURE_REFUSED/);
}));
test("trusted resource reader refuses actual alias-induced byte and metadata drift",()=>withTree(root=>{
  const source=path.join(root,"resource"),alias=path.join(root,"alias");fs.writeFileSync(source,Buffer.from("before"));fs.linkSync(source,alias);
  let changed=false,closes=0;
  const port={...fs,readSync:(...args:any[])=>{const count=(fs.readSync as any)(...args);
    if(!changed){changed=true;fs.writeFileSync(alias,Buffer.from("after!"));}return count;},
    closeSync:(fd:number)=>{closes++;fs.closeSync(fd);}};
  const compiled=ts.transpileModule(fs.readFileSync(fileURLToPath(target),"utf8"),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const module={exports:{} as any};vm.runInNewContext(compiled,{module,exports:module.exports,Buffer,Set,Map,AggregateError,
    require:(name:string)=>name==="node:fs"?port:name==="node:path"?path:{}});
  assert.throws(()=>module.exports.readTask6aNativeResourceV1(source),/TASK6A_NATIVE_CLOSURE_REFUSED/);
  assert.equal(changed,true);assert.equal(closes,1);module.exports.assertTask6aNativeCleanupCertainV1();
}));
const loggingCache="/Library/Preferences/Logging/.plist-cache.W4xs5ShC";
function vmMap(rows:string[],pid=123):string{return `Process: postgres [${pid}]\n==== Non-writable regions for process ${pid}\nREGION TYPE START - END [ VSIZE RSDNT DIRTY SWAP] PRT/MAX SHRMOD PURGE REGION DETAIL\n${rows.join("\n")}\n==== Writable regions for process ${pid}\n==== Legend\n==== Summary for process ${pid}\n`;}
function mappedCache(protection="r--/r--",cache=loggingCache):string{return `mapped file 100000000-100004000 [ 16K 16K 0K 0K] ${protection} SM=SHM ${cache}`;}
function verifyCache(first:string,second=first,cache=loggingCache):void{
  assert.equal(typeof helper.assertTask6aReadonlyLoggingCacheMapsV1,"function","sampled non-executable logging data classifier is missing");
  helper.assertTask6aReadonlyLoggingCacheMapsV1(first,second,123,cache);
}
test("logging data exclusion requires two complete bound process maps with every region read-only non-executable",()=>{
  verifyCache(vmMap([mappedCache(),mappedCache()]));
});
test("logging data exclusion rejects executable sibling or maximum-executable permission",()=>{
  for(const protection of ["r-x/r-x","r--/r-x","r--/rwx","rw-/rw-"])
    assert.throws(()=>verifyCache(vmMap([mappedCache(),mappedCache(protection)])),/TASK6A_NATIVE_CLOSURE_REFUSED/);
});
test("logging data exclusion rejects missing, crossed, truncated and malformed map evidence",()=>{
  const good=vmMap([mappedCache()]);
  for(const bad of [vmMap([]),vmMap([mappedCache()],124),good.replace("==== Legend","missing end"),
    good.replace("100000000-100004000","unknown-range"),good.replace("r--/r--","???/???"),`${good}WARNING: incomplete map\n`,
    `${good}${mappedCache("r--/r-x")}\n`])
    assert.throws(()=>verifyCache(good,bad),/TASK6A_NATIVE_CLOSURE_REFUSED/);
});
test("logging data exclusion never admits another Library path, traversal or an unbounded sample",()=>{
  for(const cache of ["/Library/Preferences/Logging/other","/Library/Preferences/Logging/../.plist-cache.a",`${loggingCache}/extra`])
    assert.throws(()=>verifyCache(vmMap([mappedCache("r--/r--",cache)]),undefined,cache),/TASK6A_NATIVE_CLOSURE_REFUSED/);
  assert.throws(()=>verifyCache(`${vmMap([mappedCache()])}${" ".repeat(1_048_577)}`),/TASK6A_NATIVE_CLOSURE_REFUSED/);
});
