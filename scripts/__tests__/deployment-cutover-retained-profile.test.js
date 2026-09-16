import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { write } from "./fixtures/deployment-cutover-bootstrap.mjs";
import { retainedFixture } from "./fixtures/deployment-cutover-retained-profile.mjs";

test("standard genuine command executes the retained archive qualification", () => {
  const result = spawnSync("npm", ["run", "test:scripts:cutover-genuine"], { cwd: new URL("../../", import.meta.url),
    env: { PATH: process.env.PATH, LANG: "C", LC_ALL: "C", TZ: "UTC" },
    encoding: "utf8", timeout: 60000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /reviewed retained profile matches all genuine fixed integrity archives without evaluation/);
});

test("retained profile authenticates real selected build and physical inventory without evaluation", () => retainedFixture(({ observe, expectedProfile }) => {
  const result = observe(`for(const name of ['writeFileSync','mkdirSync','renameSync','unlinkSync','rmdirSync','linkSync','chmodSync','fsyncSync'])fs[name]=()=>{throw Error('UNEXPECTED_WRITE')};`);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.scope, "retained-startup-byte-inventory-only");
  assert.equal(observed.sourceSha, expectedProfile.sourceSha);
  assert.equal(observed.installations.length, 1);
  assert.equal(observed.installations[0].inventoryHash, expectedProfile.installations[0].inventoryHash);
  assert.ok(observed.blockers.includes("runtime-effective-environment-not-authenticated"));
}));

test("retained profile authenticates declared nested packages independently", () => retainedFixture(({ observe }) => {
  const result = observe(); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).installations.length, 2);
}, { nested: true }));

for (const fault of ["nested-bytes", "unknown-empty-nested"]) {
  test(`retained profile refuses ${fault} inside a declared nested tree`, () => retainedFixture(({ selected, observe }) => {
    const directory = path.join(selected, "node_modules/reviewed-fixture/node_modules");
    if (fault === "nested-bytes") fs.appendFileSync(path.join(directory, "nested-fixture/index.js"), "PRIVATE_NESTED_CANARY\n");
    else fs.mkdirSync(path.join(directory, "unreviewed-fixture"));
    const result = observe(); assert.equal(result.status, 1, result.stdout); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_RETAINED_PROFILE_INVALID");
  }, { nested: true }));
}

for (const fault of ["unknown-generation", "unknown-output", "wrong-architecture", "changed-package", "extra-file", "missing-file",
  "package-symlink", "file-symlink", "unsafe-mode", "nested-resolution", "sibling-resolution"]) {
  test(`retained profile refuses ${fault} without evaluating or repairing retained input`, () => retainedFixture(({ root, selected, expectedProfile, observe }) => {
    const packageRoot = path.join(selected, "node_modules/reviewed-fixture"), file = path.join(packageRoot, "index.js");
    if (fault === "unknown-generation") expectedProfile.sourceSha = "a".repeat(40);
    if (fault === "unknown-output") expectedProfile.outputTreeHash = "b".repeat(64);
    if (fault === "wrong-architecture") expectedProfile.arch = "unreviewed";
    if (fault.startsWith("unknown-") || fault === "wrong-architecture") write(root, "scripts/deployment-cutover-retained-profile.v1.json", JSON.stringify(expectedProfile));
    if (fault === "changed-package") fs.appendFileSync(file, "PRIVATE_PACKAGE_CANARY\n");
    if (fault === "extra-file") write(packageRoot, "extra.js", "PRIVATE_PACKAGE_CANARY\n");
    if (fault === "missing-file") { fs.mkdirSync(path.join(selected, ".setfarm"), { recursive: true }); fs.renameSync(file, path.join(selected, ".setfarm/preserved-index.js")); }
    if (fault === "package-symlink") { fs.renameSync(packageRoot, `${packageRoot}.preserved`); fs.symlinkSync(`${packageRoot}.preserved`, packageRoot); }
    if (fault === "file-symlink") { fs.renameSync(file, `${file}.preserved`); fs.symlinkSync(`${file}.preserved`, file); }
    if (fault === "unsafe-mode") fs.chmodSync(file, 0o666);
    if (fault === "nested-resolution") fs.mkdirSync(path.join(packageRoot, "node_modules"));
    if (fault === "sibling-resolution") fs.writeFileSync(`${packageRoot}.js`, "PRIVATE_PACKAGE_CANARY\n");
    const result = observe(); assert.equal(result.status, 1, result.stdout); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_RETAINED_PROFILE_INVALID");
    if (fault === "changed-package") assert.match(fs.readFileSync(file, "utf8"), /PRIVATE_PACKAGE_CANARY/);
    if (fault === "unsafe-mode") assert.equal(fs.statSync(file).mode & 0o777, 0o666);
  }));
}

test("retained profile accepts partial reads without changing its inventory", () => retainedFixture(({ observe }) => {
  const result = observe(`const read=fs.readSync;fs.readSync=(fd,buffer,offset,length,position)=>read(fd,buffer,offset,Math.min(length,11),position);`);
  assert.equal(result.status, 0, result.stderr);
}));

test("retained profile catches same-byte dependency replacement during reading", () => retainedFixture(({ selected, observe }) => {
  const file = path.join(selected, "node_modules/reviewed-fixture/index.js");
  const result = observe(`const read=fs.readSync,target=${JSON.stringify(file)},ino=fs.statSync(target).ino;let changed=false;
    fs.readSync=(fd,...args)=>{const count=read(fd,...args);if(!changed&&fs.fstatSync(fd).ino===ino){changed=true;
      const bytes=fs.readFileSync(target);fs.renameSync(target,target+'.preserved');fs.writeFileSync(target,bytes);}return count};`);
  assert.equal(result.status, 1); assert.equal(result.stdout, ""); assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_RETAINED_PROFILE_INVALID");
  assert.ok(fs.existsSync(`${file}.preserved`));
}));

test("retained profile bounds empty-directory fanout before exhausting descriptors", () => retainedFixture(({ selected, observe }) => {
  const packageRoot = path.join(selected, "node_modules/reviewed-fixture");
  for (let index = 0; index < 320; index++) fs.mkdirSync(path.join(packageRoot, `empty-${index}`));
  const result = observe(`const open=fs.openSync,prefix=${JSON.stringify(packageRoot)};let directories=0;
    fs.openSync=(target,flags,...args)=>{if(String(target).startsWith(prefix)&&(flags&fs.constants.O_DIRECTORY)){
      directories++;if(directories>300)throw Error('TEST_FD_CEILING');}return open(target,flags,...args)};
    process.on('exit',()=>process.stdout.write(JSON.stringify({directories})));`);
  assert.equal(result.status, 1); assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_RETAINED_PROFILE_INVALID");
  assert.ok(JSON.parse(result.stdout).directories <= 256, result.stdout);
}));

for (const kind of ["file", "directory"]) {
  test(`retained profile consumes ${kind} close loss once and refuses reuse`, () => retainedFixture(({ root, selected, observe }) => {
    const target = path.join(selected, "node_modules/reviewed-fixture", kind === "file" ? "index.js" : "");
    const sentinel = path.join(root, "package.json");
    const result = observe(`const close=fs.closeSync,inode=fs.statSync(${JSON.stringify(target)}).ino;let selectedFd=null,reused=null,attempts=0;
      fs.closeSync=fd=>{if(selectedFd===null&&fs.fstatSync(fd).ino===inode){selectedFd=fd;attempts++;close(fd);
        reused=fs.openSync(${JSON.stringify(sentinel)},'r');throw Error('PRIVATE_CLOSE_LOSS');}
        if(fd===selectedFd)attempts++;return close(fd)};
      process.on('exit',()=>{let retryRefused=false;try{module.observeDeploymentCutoverRetainedProfileV1()}catch{retryRefused=true}
        process.stdout.write(JSON.stringify({retryRefused,attempts,reused:reused===selectedFd,
          preserved:fs.fstatSync(reused).ino===fs.statSync(${JSON.stringify(sentinel)}).ino}));});`);
    assert.equal(result.status, 1); assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_RETAINED_PROFILE_INVALID");
    assert.deepEqual(JSON.parse(result.stdout), { retryRefused: true, attempts: 1, reused: true, preserved: true });
  }));
}

for (const locator of ["bufferutil/index.js", "utf-8-validate/index.js", "bufferutil.js"]) {
  test(`retained profile refuses unreviewed optional resolution ${locator}`, () => retainedFixture(({ selected, observe }) => {
    write(selected, `node_modules/${locator}`, 'throw Error("UNREVIEWED_OPTIONAL_MUST_NOT_EXECUTE");\n');
    const result = observe(); assert.equal(result.status, 1, result.stdout); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_RETAINED_PROFILE_INVALID");
  }));
}
