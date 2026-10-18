import assert from "node:assert/strict";
import cp, { type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourceRoot = new URL("../src/", import.meta.url);
const read = (name: string) => fs.readFileSync(new URL(name, sourceRoot), "utf8");
const dashboard = read("server/dashboard.ts");
const tree = ts.createSourceFile("dashboard.ts", dashboard, ts.ScriptTarget.Latest, true);
const entry = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node)
  && node.name?.text === "startDashboardWithPreSchemaAdmissionV3");
assert.ok(entry?.body);
const compile = (source: string) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function unusedPort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address === "object");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  assert.notEqual(address.port, 3333);
  return address.port;
}

async function fixture(mode: string, run: (start: () => Promise<{ pid: number; port: number }>, pidFile: string, port: number, stop: () => Promise<void>) => Promise<void>) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "dashboard-readiness-")));
  const serverDir = path.join(root, "server"), internal = path.join(root, "internal-production");
  fs.mkdirSync(serverDir); fs.mkdirSync(internal);
  fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
  fs.writeFileSync(path.join(root, "runtime-config.js"), "");
  fs.writeFileSync(path.join(internal, "baseline-deployment-cutover-v1.js"), "export function assertOrdinaryDashboardDeploymentCutoverAdmissionV2(){}");
  fs.writeFileSync(path.join(internal, "baseline-task6a-preschema-ordinary-refusal-v2.js"), `
    import fs from 'node:fs';
    let calls=0;
    export async function assertTask6aPreSchemaOrdinaryStartupV2(){
      calls++;
      if(!process.argv[1]?.endsWith('/server/daemon.js'))return;
      const mode=${JSON.stringify(mode)};
      if(mode==='pid-write-throws'&&calls===1){
        const write=fs.writeFileSync;
        fs.writeFileSync=(file,...args)=>{const result=write(file,...args);if(String(file).endsWith('/dashboard.pid'))throw Error('CONTROLLED_PID_WRITE_FAILURE');return result};
      }
      if(mode==='early-exit')process.exit(17);
      if(calls===1&&['wrong-pid','wrong-port','malformed'].includes(mode)){
        const send=process.send.bind(process);
        process.send=(message,callback)=>send(mode==='malformed'?{}:{...message,[mode==='wrong-pid'?'pid':'port']:-1},callback);
      }
      if(calls===2&&['timeout','disconnect','force-timeout','force-foreign'].includes(mode)){
        if(mode==='disconnect')process.disconnect();
        if(mode.startsWith('force-')){process.removeAllListeners('SIGTERM');process.on('SIGTERM',()=>{});}
        if(mode==='force-foreign')fs.writeFileSync(process.env.HOME+'/.openclaw/setfarm/dashboard.pid','987654321');
        await new Promise(()=>setInterval(()=>{},1000));
      }
      if(mode==='delayed-both'||(mode==='delayed-second'&&calls===2)||(mode==='failing-second'&&calls===2))
        await new Promise(resolve=>setTimeout(resolve,1250));
      if(mode==='failing-second'&&calls===2)throw Error('CONTROLLED_SECOND_PREFLIGHT_REFUSED');
    }
  `);
  fs.writeFileSync(path.join(serverDir, "dashboard.js"), compile(`
    import http from 'node:http';
    import {assertTask6aPreSchemaOrdinaryStartupV2} from '../internal-production/baseline-task6a-preschema-ordinary-refusal-v2.js';
    import {assertOrdinaryDashboardDeploymentCutoverAdmissionV2} from '../internal-production/baseline-deployment-cutover-v1.js';
    ${entry.getText(tree)}
    function createDashboardServer(port,options){
      const server=http.createServer((req,res)=>res.end('fixture-ready'));
      server.listen(port,'127.0.0.1');return server;
    }
  `));
  for (const name of ["daemon", "daemonctl"]) fs.writeFileSync(path.join(serverDir, `${name}.js`), compile(read(`server/${name}.ts`)));
  const originalHome = os.homedir, originalSpawn = cp.spawn, originalTimer = globalThis.setTimeout;
  const originalOpen = fs.openSync, originalClose = fs.closeSync;
  const originalEnvHome = process.env.HOME;
  const children: ChildProcess[] = [];
  const logFds = new Set<number>(); let opened = 0, closed = 0;
  os.homedir = () => root; process.env.HOME = root;
  if (mode === "timeout" || mode === "disconnect" || mode.startsWith("force-")) globalThis.setTimeout = ((fn, ms, ...args) =>
    originalTimer(fn, ms === 30_000 ? 150 : ms, ...args)) as typeof setTimeout;
  fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
    const fd = Reflect.apply(originalOpen, fs, args);
    if (String(args[0]) === path.join(root, ".openclaw/setfarm/dashboard.log")) { logFds.add(fd); opened++; }
    return fd;
  }) as typeof fs.openSync;
  fs.closeSync = (fd: number) => {
    originalClose(fd);
    if (logFds.delete(fd)) { closed++; assert.throws(() => fs.fstatSync(fd), { code: "EBADF" }); }
  };
  cp.spawn = ((...args: Parameters<typeof cp.spawn>) => {
    assert.equal(args[0], process.execPath);
    assert.equal((args[1] as string[])[0], path.join(serverDir, "daemon.js"));
    if (mode === "spawn-throws") throw Error("CONTROLLED_SPAWN_FAILURE");
    const child = Reflect.apply(originalSpawn, cp, args); children.push(child); return child;
  }) as typeof cp.spawn;
  syncBuiltinESMExports();
  const stop = async (): Promise<void> => {
    await Promise.all(children.map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return;
      await new Promise<void>((resolve) => {
        const timer = originalTimer(() => child.kill("SIGKILL"), 1000);
        child.once("exit", () => { clearTimeout(timer); resolve(); });
        child.kill("SIGTERM");
      });
    }));
  };
  try {
    const { startDaemon } = await import(pathToFileURL(path.join(serverDir, "daemonctl.js")).href);
    const port = await unusedPort();
    await run(() => startDaemon(port), path.join(root, ".openclaw/setfarm/dashboard.pid"), port, stop);
    assert.equal(opened, 1); assert.equal(closed, opened); assert.equal(logFds.size, 0);
    assert.ok(children.every((child) => child.exitCode !== null || child.signalCode !== null), "owned child must settle before fixture cleanup");
    if (mode === "early-exit") assert.equal(children[0]?.exitCode, 17);
    if (mode.startsWith("force-")) assert.equal(children[0]?.signalCode, "SIGKILL");
  } finally {
    os.homedir = originalHome; cp.spawn = originalSpawn;
    globalThis.setTimeout = originalTimer; fs.openSync = originalOpen; fs.closeSync = originalClose;
    if (originalEnvHome === undefined) delete process.env.HOME; else process.env.HOME = originalEnvHome;
    syncBuiltinESMExports();
    await stop();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

for (const mode of ["delayed-both", "delayed-second"]) {
  test(`daemon readiness waits for ${mode} preflights and the real listener`, { timeout: 10000 }, async () => {
    await fixture(mode, async (start, pidFile, port, stop) => {
      const started = await start();
      assert.equal(started.port, port);
      assert.equal(fs.readFileSync(pidFile, "utf8"), String(started.pid));
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
      assert.equal(await response.text(), "fixture-ready");
      await stop(); assert.equal(fs.existsSync(pidFile), false);
    });
  });
}

test("daemon readiness rejects a delayed second preflight failure after PID publication", { timeout: 10000 }, async () => {
  await fixture("failing-second", async (start, pidFile) => {
    await assert.rejects(start());
    assert.equal(fs.existsSync(pidFile), false);
  });
});

test("daemon exit preserves a PID record replaced by another owner", { timeout: 10000 }, async () => {
  await fixture("immediate", async (start, pidFile, _port, stop) => {
    await start(); fs.writeFileSync(pidFile, "987654321"); await stop();
    assert.equal(fs.readFileSync(pidFile, "utf8"), "987654321");
  });
});

for (const mode of ["wrong-pid", "wrong-port", "malformed", "early-exit", "timeout", "disconnect", "spawn-throws", "pid-write-throws", "force-timeout"]) {
  test(`daemon readiness rejects ${mode} and settles its owned resources`, { timeout: 10000 }, async () => {
    await fixture(mode, async (start, pidFile) => {
      const expected = mode === "timeout" || mode === "force-timeout" ? /readiness timed out/ : mode === "disconnect" ? /disconnected before listener readiness/
        : mode === "early-exit" || mode === "pid-write-throws" ? /(?:exited|disconnected) before listener readiness/ : mode === "spawn-throws" ? /CONTROLLED_SPAWN_FAILURE/
        : /Invalid daemon readiness message/;
      await assert.rejects(start(), expected);
      assert.equal(fs.existsSync(pidFile), false);
    });
  });
}

test("daemon forced termination preserves a replacement foreign PID record", { timeout: 10000 }, async () => {
  await fixture("force-foreign", async (start, pidFile) => {
    await assert.rejects(start(), /readiness timed out/);
    assert.equal(fs.readFileSync(pidFile, "utf8"), "987654321");
  });
});

test("daemon readiness rejects a real listener bind failure", { timeout: 10000 }, async () => {
  await fixture("immediate", async (start, pidFile, port) => {
    const occupied = http.createServer();
    await new Promise<void>((resolve) => occupied.listen(port, "127.0.0.1", resolve));
    try { await assert.rejects(start()); assert.equal(fs.existsSync(pidFile), false); }
    finally { await new Promise<void>((resolve) => occupied.close(() => resolve())); }
  });
});
