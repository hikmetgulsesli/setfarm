import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { gzipSync } from "node:zlib";

import { sourceRoot, packages, cachePath, fixture } from "./fixtures/deployment-cutover-dependencies.mjs";

test("dependency observer accepts legitimate partial regular-file reads", () => fixture(context => {
  const result = context.observe(`const read=fs.readSync;fs.readSync=(fd,buffer,offset,length,position)=>read(fd,buffer,offset,Math.min(length,7),position);`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).packages.length, 2);
}));

for (const kind of ["file", "directory"]) {
  test(`dependency observer consumes ${kind} close uncertainty once and permanently refuses reuse`, () => fixture(context => {
    const sentinel = path.join(context.root, "package-lock.json");
    const result = context.observe(`
      const close=fs.closeSync;let active=false,chosen=null,reused=null,count=0;
      fs.closeSync=fd=>{if(active&&chosen===null&&fs.fstatSync(fd).isDirectory()===${kind === "directory"}){
        chosen=fd;count++;close(fd);reused=fs.openSync(${JSON.stringify(sentinel)},'r');throw Error('CLOSE_RESPONSE_LOST')}
        if(fd===chosen)count++;return close(fd)};`, `
      active=true;let refused=false,retryRefused=false;
      try{module.readCutoverDependencyArchivesV1()}catch{refused=true}
      try{module.readCutoverDependencyArchivesV1()}catch{retryRefused=true}
      process.stdout.write(JSON.stringify({refused,retryRefused,count,reused:chosen===reused,preserved:fs.fstatSync(reused).ino===fs.statSync(${JSON.stringify(sentinel)}).ino}));`);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { refused: true, retryRefused: true, count: 1, reused: true, preserved: true });
  }));
}

for (const fault of ["same-inode-lock", "cache-ancestor"]) {
  test(`dependency observer refuses ${fault} drift during its physical bracket`, () => fixture(context => {
    const file = fault === "same-inode-lock" ? path.join(context.root, "package-lock.json") : cachePath(context.home, packages[0].integrity);
    const result = context.observe(`
      const read=fs.readSync,inode=fs.statSync(${JSON.stringify(file)}).ino;let changed=false;
      fs.readSync=(fd,buffer,offset,...args)=>{const count=read(fd,buffer,offset,...args);
        if(!changed&&fs.fstatSync(fd).ino===inode){changed=true;
          ${fault === "same-inode-lock" ? `fs.writeFileSync(${JSON.stringify(file)},buffer.subarray(offset,offset+count));`
            : `const parent=${JSON.stringify(path.join(context.home, ".npm/_cacache"))};fs.renameSync(parent,parent+'.preserved');fs.mkdirSync(parent);fs.renameSync(parent+'.preserved/content-v2',parent+'/content-v2');`}}
        return count};
      process.on('exit',()=>process.stdout.write(JSON.stringify({changed})));`);
    assert.equal(result.status, 1); assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_DEPENDENCY_REFUSED");
    assert.deepEqual(JSON.parse(result.stdout), { changed: true });
  }));
}

test("dependency observer bounds a lockfile that grows after its size check", () => fixture(context => {
  const file = path.join(context.root, "package-lock.json"), originalSize = fs.statSync(file).size;
  const result = context.observe(`
    const file=${JSON.stringify(file)},stat=fs.fstatSync,read=fs.readSync,inode=fs.statSync(file).ino;let grew=false,maxRead=0;
    fs.fstatSync=(fd,...args)=>{const value=stat(fd,...args);if(!grew&&String(value.ino)===String(inode)){
      grew=true;fs.writeFileSync(file,Buffer.alloc(4*1024*1024+2,32));}return value};
    fs.readSync=(fd,...args)=>{const count=read(fd,...args);if(String(stat(fd).ino)===String(inode))maxRead=Math.max(maxRead,count);return count};
    process.on('exit',()=>process.stdout.write(JSON.stringify({grew,maxRead})));`);
  assert.equal(result.status, 1); assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_DEPENDENCY_REFUSED");
  const observed = JSON.parse(result.stdout); assert.equal(observed.grew, true); assert.ok(observed.maxRead <= originalSize + 1);
}));

test("fixed dependency archives authenticate portable packages without writes or module evaluation", () => fixture(context => {
  const result = context.observe(`for(const name of ['writeFileSync','mkdirSync','renameSync','unlinkSync','rmdirSync','linkSync','chmodSync','fsyncSync'])fs[name]=()=>{throw Error('UNEXPECTED_WRITE')};`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    exports: ["readCutoverDependencyArchivesV1"],
    packages: packages.map(p => ({ name: p.name, version: p.version, entry: `node_modules/${p.name}/${p.entry}`, members: p.members, hasEntry: true })),
  });
}));

for (const fault of ["version", "integrity", "dependency", "missing-cache", "corrupt-cache", "cache-symlink", "cache-mode", "lock-symlink"]) {
  test(`dependency archive authentication refuses ${fault} with a sanitized error`, () => fixture(context => {
    const target = cachePath(context.home, packages[0].integrity), lockPath = path.join(context.root, "package-lock.json");
    if (fault === "version") context.lock.packages["node_modules/postgres"].version = "3.4.9";
    if (fault === "integrity") context.lock.packages["node_modules/postgres"].integrity = packages[1].integrity;
    if (fault === "dependency") context.lock.packages["node_modules/postgres"].dependencies = { extra: "1" };
    fs.writeFileSync(lockPath, JSON.stringify(context.lock));
    if (fault === "missing-cache") fs.unlinkSync(target);
    if (fault === "corrupt-cache") fs.writeFileSync(target, "PRIVATE_CACHE_BYTES_MUST_NOT_APPEAR");
    if (fault === "cache-symlink") { fs.renameSync(target, target + ".saved"); fs.symlinkSync(target + ".saved", target); }
    if (fault === "cache-mode") fs.chmodSync(target, 0o666);
    if (fault === "lock-symlink") { fs.renameSync(lockPath, lockPath + ".saved"); fs.symlinkSync(lockPath + ".saved", lockPath); }
    const result = context.observe();
    assert.equal(result.status, 1); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_DEPENDENCY_REFUSED");
  }));
}

async function decoders(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cutover-archive-codec-"));
  try {
    const file = path.join(root, "codec.mjs");
    fs.writeFileSync(file, fs.readFileSync(path.join(sourceRoot, "scripts/deployment-cutover-dependencies.mjs"), "utf8") + "\nexport {decodeGzipV1,decodeTarV1};\n");
    await run(await import(pathToFileURL(file).href));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function tarEntry(name = "package/file.js", content = "export const value=1;\n") {
  const bytes = Buffer.from(content), header = Buffer.alloc(512);
  header.write(name, 0, 100, "ascii");
  for (const [start, width, value] of [[100, 8, 0o644], [108, 8, 0], [116, 8, 0], [124, 12, bytes.length], [136, 12, 1]]) {
    header.write(value.toString(8).padStart(width - 2, "0") + " \0", start, width, "ascii");
  }
  header[156] = 48; Buffer.from([117, 115, 116, 97, 114, 0, 48, 48]).copy(header, 257);
  checksum(header);
  return Buffer.concat([header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512)]);
}
function checksum(header) {
  header.fill(32, 148, 156);
  header.write([...header].reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, "0") + " \0", 148, 8, "ascii");
}
const tar = (...entries) => Buffer.concat([...entries, Buffer.alloc(1024)]);

test("bounded archive decoders accept one independently encoded regular member", () => decoders(({ decodeGzipV1, decodeTarV1 }) => {
  const encoded = tar(tarEntry()), decoded = decodeGzipV1(gzipSync(encoded));
  assert.deepEqual(decoded, encoded);
  assert.deepEqual(decodeTarV1(decoded).map(m => [m.locator, m.bytes.toString()]), [["file.js", "export const value=1;\n"]]);
}));
for (const fault of ["second-member", "empty-member", "zero-trailing", "nonzero-trailing", "header", "flags", "deflate-truncated", "trailer-truncated", "crc", "isize", "expansion", "compressed-cap"]) {
  test(`gzip decoder rejects ${fault}`, () => decoders(({ decodeGzipV1 }) => {
    let bytes = gzipSync(tar(tarEntry()));
    if (fault === "second-member") bytes = Buffer.concat([bytes, gzipSync("extra")]);
    if (fault === "empty-member") bytes = Buffer.concat([bytes, gzipSync("")]);
    if (fault === "zero-trailing") bytes = Buffer.concat([bytes, Buffer.alloc(1)]);
    if (fault === "nonzero-trailing") bytes = Buffer.concat([bytes, Buffer.from("extra")]);
    if (fault === "header") bytes[0] = 0;
    if (fault === "flags") bytes[3] = 8;
    if (fault === "deflate-truncated") bytes = bytes.subarray(0, 18);
    if (fault === "trailer-truncated") bytes = bytes.subarray(0, bytes.length - 1);
    if (fault === "crc") bytes[bytes.length - 8] ^= 1;
    if (fault === "isize") bytes[bytes.length - 4] ^= 1;
    if (fault === "expansion") bytes = gzipSync(Buffer.alloc(8 * 1024 * 1024 + 1));
    if (fault === "compressed-cap") bytes = Buffer.alloc(2 * 1024 * 1024 + 1);
    assert.throws(() => decodeGzipV1(bytes));
  }));
}
for (const fault of ["duplicate", "traversal", "absolute", "double-slash", "file-parent", "file-parent-reversed", "link", "extension", "octal", "base256", "checksum", "member-size", "padding", "truncated", "trailing", "single-terminator", "member-cap"]) {
  test(`tar decoder rejects ${fault}`, () => decoders(({ decodeTarV1 }) => {
    let entry = tarEntry(), bytes;
    if (fault === "duplicate") bytes = tar(entry, entry);
    if (fault === "traversal") entry = tarEntry("package/../outside");
    if (fault === "absolute") entry = tarEntry("/outside");
    if (fault === "double-slash") entry = tarEntry("package//file");
    if (fault === "file-parent") bytes = tar(tarEntry("package/a"), tarEntry("package/a/file"));
    if (fault === "file-parent-reversed") bytes = tar(tarEntry("package/a/file"), tarEntry("package/a"));
    if (fault === "link") entry[156] = 50;
    if (fault === "extension") entry[156] = 120;
    if (fault === "octal") entry[124] = 56;
    if (fault === "base256") entry[124] = 128;
    if (fault === "member-size") entry.write("00010000001 \0", 124, 12, "ascii");
    if (fault === "padding") entry[entry.length - 1] = 1;
    checksum(entry.subarray(0, 512));
    if (fault === "checksum") entry[148] ^= 1;
    bytes ??= tar(entry);
    if (fault === "truncated") bytes = bytes.subarray(0, bytes.length - 1);
    if (fault === "trailing") bytes[bytes.length - 1] = 1;
    if (fault === "single-terminator") bytes = bytes.subarray(0, bytes.length - 512);
    if (fault === "member-cap") bytes = tar(...Array.from({ length: 1025 }, (_, index) => tarEntry(`package/f${index}`, "")));
    assert.throws(() => decodeTarV1(bytes));
  }));
}
