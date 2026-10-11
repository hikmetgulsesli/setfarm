import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { test } from "node:test";

const enabled = process.env.SETFARM_TASK6A_TEST_PROTECTED_DESCRIPTOR_FIXTURE === "1";
const parent = "/Library/Application Support";
const env = Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" });
function command(executable: string, args: string[]) {
  const result = spawnSync(executable, args, { env, cwd: "/", encoding: "utf8",
    timeout: 15000, maxBuffer: 65536 });
  assert.equal(result.error, undefined); assert.equal(result.signal, null);
  return result;
}
function checked(executable: string, args: string[]): string {
  const result = command(executable, args);
  assert.equal(result.status, 0, `${executable}: ${result.stderr}`);
  return result.stdout.trim();
}
const CHILD = `import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createInterface} from 'node:readline';
const {holdTask6aRootOwnedJsonFileV1}=await import(process.argv[1]);
const file=process.argv[2], kind=process.argv[3];
assert.equal(process.getuid(),Number(process.argv[4]));assert.equal(process.geteuid(),Number(process.argv[4]));
assert.equal(process.getgid(),Number(process.argv[5]));assert.equal(process.getegid(),Number(process.argv[5]));
// Observe actual originals; no fake open results, metadata or production hook.
const actualOpen=fs.openSync,actualClose=fs.closeSync,pins=[],closeAttempts=new Map();
fs.openSync=function(...args){const fd=Reflect.apply(actualOpen,this,args);pins.push(fd);return fd;};
fs.closeSync=function(fd){if(pins.includes(fd))closeAttempts.set(fd,(closeAttempts.get(fd)??0)+1);return Reflect.apply(actualClose,this,[fd]);};
function closedOriginals(){for(const fd of pins){assert.equal(closeAttempts.get(fd),1);assert.throws(()=>fs.fstatSync(fd),e=>e.code==='EBADF');}}
try {
if(kind==='deny') {assert.throws(()=>holdTask6aRootOwnedJsonFileV1(file),/TASK6A_ROOT_JSON_FILE_REFUSED/);closedOriginals();console.log('denied');}
else {
 const holder=holdTask6aRootOwnedJsonFileV1(file);
 let revoked=false;
 try {
 assert.equal(pins.length,5);for(const fd of pins)assert.doesNotThrow(()=>fs.fstatSync(fd));
 holder.read().fill(0); // A returned buffer must not mutate the held original.
 assert.equal(holder.read().toString(),'fixture-v1\\n');holder.recheck();console.log('held');
  for await(const line of createInterface({input:process.stdin})) {
   if(line==='close') break;
   assert.equal(line,'check');
   assert.throws(()=>holder.read(),/TASK6A_ROOT_JSON_FILE_REFUSED/);
   assert.throws(()=>holder.recheck(),/TASK6A_ROOT_JSON_FILE_REFUSED/);
   for(const fd of pins){assert.equal(closeAttempts.get(fd),undefined);assert.doesNotThrow(()=>fs.fstatSync(fd),'revocation must retain actual FD until explicit close');}
   revoked=true;console.log('revoked');
  }
 } finally {holder.close();holder.close();}
 closedOriginals();
 assert.throws(()=>holder.read(),/TASK6A_ROOT_JSON_FILE_REFUSED/);
 console.log(revoked?'closed-revoked':'closed');
}
} finally {fs.openSync=actualOpen;fs.closeSync=actualClose;}`;

test("private root-owned file source and sticky recheck deny excluded identities and ACL drift", {
  skip: enabled ? false : "requires explicit isolated root-owned descriptor fixture opt-in",
  timeout: 180000,
}, async (t) => {
  assert.equal(process.platform, "darwin");
  assert.ok(process.getuid!() > 0);
  // Resolve and build before any privileged fixture effect. An unavailable
  // toolchain must fail here, not leave a root-owned preparation behind.
  const { buildSync } = createRequire(import.meta.url)("esbuild") as typeof import("esbuild");
  const bundle = buildSync({ entryPoints: [fileURLToPath(new URL(
    "../../src/internal-production/task6a-root-owned-json-file-v1.ts", import.meta.url))],
    bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
  assert.equal(bundle.outputFiles.length, 1);
  const parents: { target: string; fd: number; stat: fs.BigIntStats }[] = [];
  const keys = ["dev", "ino", "uid", "gid", "mode", "birthtimeNs"] as const;
  t.after(() => {
    let uncertain = false;
    while (parents.length) {
      try { fs.closeSync(parents.pop()!.fd); } catch { uncertain = true; }
    }
    assert.equal(uncertain, false, "fixture ancestor close uncertain");
  });
  function exactParents(): void {
    for (const pin of parents) {
      for (const observed of [fs.fstatSync(pin.fd, { bigint: true }), fs.lstatSync(pin.target, { bigint: true })])
        assert.ok(keys.every(key => pin.stat[key] === observed[key]), "fixture ancestor identity drift");
      const rows = checked("/bin/ls", ["-ldne", pin.target]).split("\n");
      assert.equal(rows.length, 1, "fixture ancestor ACL/ambiguity refused");
      assert.match(rows[0], /^d[rwx-]{9}[@.]?\s/); assert.ok(rows[0].endsWith(` ${pin.target}`));
      assert.ok(keys.every(key => pin.stat[key] === fs.lstatSync(pin.target, { bigint: true })[key]));
    }
  }
  for (const target of ["/", "/Library", parent]) {
    const stat = fs.lstatSync(target, { bigint: true });
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
    assert.equal(stat.uid, 0n); assert.equal(stat.mode & 0o7777n, 0o755n);
    const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    parents.push({ target, fd, stat }); exactParents();
  }
  assert.equal(checked("/usr/bin/sudo", ["-n", "/usr/bin/id", "-u"]), "0");
  const clientUid = Number(checked("/usr/bin/id", ["-u", "_www"]));
  const clientGid = Number(checked("/usr/bin/id", ["-g", "_www"]));
  assert.ok(clientUid > 0 && clientGid > 0 && clientUid !== process.getuid!());
  for (const user of ["_www", "nobody"]) {
    assert.match(checked("/usr/bin/sudo", ["-n", "/usr/bin/sudo", "-l", "-U", user]),
      new RegExp(`^User ${user} is not allowed to run sudo on [^\\n]+\\.$`));
  }
  const scratch = fs.mkdtempSync("/private/tmp/setfarm-task6a-descriptor-source.");
  const dataSource = path.join(scratch, "data"), moduleSource = path.join(scratch, "module");
  fs.writeFileSync(dataSource, "fixture-v1\n", { mode: 0o600 });
  fs.writeFileSync(moduleSource, bundle.outputFiles[0].contents, { mode: 0o600 });
  // Approved Task6A protected-host rehearsal, NOT the production Setfarm path.
  exactParents();
  const home = checked("/usr/bin/sudo", ["-n", "/usr/bin/mktemp", "-d",
    `${parent}/setfarm-task6a-descriptor.XXXXXXXX`]);
  t.diagnostic(`private protected descriptor allocation returned ${home}`);
  const anchor = fs.lstatSync(home, { bigint: true });
  t.diagnostic(`private protected descriptor allocated ${home}; ${anchor.dev}/${anchor.ino}`);
  let mode = 0o700, childRunning = false, cleanupReady = false;
  const file = path.join(home, "descriptor.json"), module = path.join(home, "reader.mjs");
  const extra = path.join(home, "extra.json");
  function exactHome(): void {
    exactParents();
    assert.equal(path.dirname(home), parent);
    assert.match(path.basename(home), /^setfarm-task6a-descriptor\.[A-Za-z0-9]{8}$/);
    const stat = fs.lstatSync(home, { bigint: true });
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
    assert.equal(fs.realpathSync(home), home);
    assert.equal(stat.dev, anchor.dev); assert.equal(stat.ino, anchor.ino);
    assert.equal(stat.uid, 0n); assert.equal(stat.mode & 0o7777n, BigInt(mode));
    assert.equal(stat.mode & 0o022n, 0n, "fixture directory must never admit excluded writers");
    const rows = checked("/bin/ls", ["-ldne", home]).split("\n");
    assert.equal(rows.length, 1, "fixture root ACL/ambiguity refused");
    assert.match(rows[0], /^d[rwx-]{9}[@.]?\s/); assert.ok(rows[0].endsWith(` ${home}`));
    const after = fs.lstatSync(home, { bigint: true });
    assert.ok(keys.every(key => stat[key] === after[key]), "fixture root changed during ACL probe");
  }
  function root(executable: string, args: string[]): string {
    exactHome(); return checked("/usr/bin/sudo", ["-n", executable, ...args]);
  }
  function install(source: string, destination: string): void {
    root("/usr/bin/install", ["-m", "0444", "-o", "root", "-g", "wheel", source, destination]);
  }
  function scopedArgs(kind: "deny" | "hold") {
    return ["-n", "-u", "_www", "/usr/bin/env", "-i", "PATH=/usr/bin:/bin", "LANG=C", "LC_ALL=C",
      process.execPath, "--input-type=module", "-e", CHILD, module, file, kind, String(clientUid), String(clientGid)];
  }
  function denied(): void {
    exactHome(); const result = command("/usr/bin/sudo", scopedArgs("deny"));
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), "denied");
  }
  async function held(perturb?: () => void, restore?: () => void): Promise<void> {
    exactHome();
    const child = spawn("/usr/bin/sudo", scopedArgs("hold"), { env, cwd: "/", stdio: ["pipe", "pipe", "pipe"] });
    childRunning = true;
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    const exited = once(child, "close");
    async function waitLine(line: string) {
      const limit = Date.now() + 5000;
      while (!stdout.split("\n").includes(line)) {
        assert.ok(stdout.length + stderr.length < 65536 && Date.now() < limit, `child timeout: ${stderr}`);
        assert.equal(child.exitCode, null, `child exited: ${stderr}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    try {
      await waitLine("held");
      if (perturb) {
        perturb(); child.stdin.write("check\n"); await waitLine("revoked");
        restore?.(); stdout = ""; child.stdin.write("check\n"); await waitLine("revoked");
      }
      child.stdin.end("close\n");
      const [code, signal] = await Promise.race([exited,
        new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(Error("private reader exit uncertain")), 5000);
          void exited.finally(() => clearTimeout(timer));
        })]);
      assert.equal(code, 0, stderr); assert.equal(signal, null); childRunning = false;
      assert.ok(stdout.includes(perturb ? "closed-revoked" : "closed"));
    } finally {
      // Only request orderly shutdown of our exact child, never pkill/root Node.
      if (child.exitCode === null && !child.stdin.destroyed) child.stdin.end("close\n");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([exited, new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(Error("private reader close uncertain")), 5000);
        })]);
        childRunning = false;
      } finally { clearTimeout(timer); }
    }
  }
  let primaryFailure: unknown;
  let cleanupFailure: unknown;
  let primaryFailed = false, cleanupFailed = false;
  try {
    exactHome();
    install(dataSource, file); install(moduleSource, module);
    root("/bin/chmod", ["0755", home]); mode = 0o755; exactHome(); cleanupReady = true;
    t.diagnostic(`private protected descriptor ${home}; ${anchor.dev}/${anchor.ino}`);
    await held();
    for (const user of ["_www", "nobody"]) {
      for (const target of [file, path.join(home, "replacement")]) {
        const probe = `try{require('node:fs').writeFileSync(process.argv[1],'denied',{flag:process.argv[2]});process.exit(0)}catch(e){process.exit(['EACCES','EPERM'].includes(e.code)?42:43)}`;
        const result = command("/usr/bin/sudo", ["-n", "-u", user, "/usr/bin/env", "-i",
          "PATH=/usr/bin:/bin", process.execPath, "-e", probe, target, target === file ? "a" : "wx"]);
        assert.equal(result.status, 42, result.stderr);
      }
    }
    await held(() => root("/bin/chmod", ["0644", file]), () => root("/bin/chmod", ["0444", file]));
    const originalInode = fs.lstatSync(file, { bigint: true }).ino;
    await held(() => {
      fs.writeFileSync(dataSource, "fixture-v2\n");
      root("/bin/dd", [`if=${dataSource}`, `of=${file}`, "conv=notrunc"]);
      assert.equal(fs.lstatSync(file, { bigint: true }).ino, originalInode);
    }, () => {
      fs.writeFileSync(dataSource, "fixture-v1\n");
      root("/bin/dd", [`if=${dataSource}`, `of=${file}`, "conv=notrunc"]);
      assert.equal(fs.lstatSync(file, { bigint: true }).ino, originalInode);
    });
    await held(() => {
      fs.writeFileSync(dataSource, "fixture-v2\n"); install(dataSource, extra);
      root("/bin/mv", [extra, file]);
    }, () => { fs.writeFileSync(dataSource, "fixture-v1\n"); install(dataSource, file); });
    root("/bin/ln", [file, extra]); denied(); root("/bin/rm", [extra]);
    // Restrict, never widen, fixture traversal while an actual reader holds it.
    await held(() => { root("/bin/chmod", ["0750", home]); mode = 0o750; },
      () => { root("/bin/chmod", ["0755", home]); mode = 0o755; });
    await held(() => {
      root("/usr/bin/xattr", ["-w", "com.setfarm.task6a.fixture", "fixture", file]);
      root("/bin/chmod", ["+a", "user:_www allow write,append", file]);
      const listing = root("/bin/ls", ["-ldne", file]);
      assert.match(listing.split("\n")[0], /^-[rwx-]{9}@\s/);
      assert.ok(listing.split("\n").length > 1, "actual @-masked ACL rows must exist");
    }, () => {
      root("/bin/chmod", ["-N", file]);
      root("/usr/bin/xattr", ["-d", "com.setfarm.task6a.fixture", file]);
    });
    fs.writeFileSync(dataSource, Buffer.alloc(16385)); install(dataSource, file); denied();
    root("/bin/rm", [file]); root("/bin/ln", ["-s", module, file]); denied();
    root("/bin/rm", [file]); fs.writeFileSync(dataSource, "fixture-v1\n"); install(dataSource, file);
    await held();
  } catch (error) {
    primaryFailed = true; primaryFailure = error;
  } finally {
    try {
    assert.equal(childRunning, false, `retain ${home}: reader lifecycle uncertain`);
    assert.equal(cleanupReady, true, `retain ${home}: preparation uncertain`);
    exactHome(); assert.deepEqual(fs.readdirSync(home).sort(), ["descriptor.json", "reader.mjs"]);
    for (const target of [file, module]) {
      const stat = fs.lstatSync(target, { bigint: true });
      assert.ok(stat.isFile() && !stat.isSymbolicLink()); assert.equal(stat.dev, anchor.dev);
      assert.equal(stat.uid, 0n); assert.equal(stat.nlink, 1n);
      root("/bin/rm", [target]);
    }
    exactHome(); assert.deepEqual(fs.readdirSync(home), []); root("/bin/rmdir", [home]);
    assert.equal(fs.existsSync(home), false);
    fs.rmSync(scratch, { recursive: true, force: true });
    t.diagnostic("verified exact private fixture removed; production namespace untouched");
    } catch (error) { cleanupFailed = true; cleanupFailure = error; }
  }
  if (primaryFailed && cleanupFailed)
    throw new AggregateError([primaryFailure, cleanupFailure], "private descriptor execution and cleanup failed");
  if (cleanupFailed) throw cleanupFailure;
  if (primaryFailed) throw primaryFailure;
});
