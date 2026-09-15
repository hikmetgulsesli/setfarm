import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const secrets = ["postgresql://fixture:PG_SENTINEL@localhost/fixture", "TOKEN_SENTINEL", "/var/run/com.apple.launchd.SocketSentinel/Listeners"];
const labels = ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard"];
function fixture(body: (home: string, texts: string[]) => void): void {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-launcher-")));
  const directory = path.join(home, "Library", "LaunchAgents");
  fs.mkdirSync(directory, { recursive: true, mode: 0o755 });
  const texts = labels.map((label, index) => {
    const program = path.join(home, ".local", "bin", "setfarm");
    const args = index ? [program, "dashboard", "start", "--port", "3333"] : [program, "spawner", "start"];
    const environment = index ? { PATH: "/usr/local/bin:/usr/bin:/bin", SETFARM_PG_URL: secrets[0], SETFARM_OPERATIONAL_WRITE_TOKEN: secrets[1] }
      : { PATH: "/usr/local/bin:/usr/bin:/bin", SETFARM_PG_URL: secrets[0] };
    const log = path.join(home, ".openclaw", "logs", index ? "setfarm-dashboard.watch" : "setfarm-spawner.watch");
    const plistPath = path.join(directory, `${label}.plist`);
    const plist = { Label: label, ProgramArguments: args, EnvironmentVariables: environment, RunAtLoad: true, StartInterval: 60,
      StandardOutPath: `${log}.log`, StandardErrorPath: `${log}.err.log` };
    fs.writeFileSync(plistPath, execFileSync("/usr/bin/plutil", ["-convert", "xml1", "-o", "-", "-"], { input: JSON.stringify(plist) }), { mode: 0o600 });
    const block = (name: string, lines: string[]) => `\t${name} = {\n${lines.map(line => `\t\t${line}\n`).join("")}\t}\n`;
    return `gui/${process.getuid!()}/${label} = {\n\tpath = ${plistPath}\n\tprogram = ${program}\n\tstate = not running\n\tactive count = 0\n\ttype = LaunchAgent\n\trun interval = 60 seconds\n\tproperties = runatload\n`
      + block("arguments", args)
      + block("environment", Object.entries({ ...environment, OSLogRateLimit: "64", XPC_SERVICE_NAME: label }).map(([key, value]) => `${key} => ${value}`))
      + block("inherited environment", [`SETFARM_ENV_DIR => ${home}/ai/setrox/setfarm/scripts`, `SSH_AUTH_SOCK => ${secrets[2]}`])
      + block("default environment", ["PATH => /usr/bin:/bin:/usr/sbin:/sbin"]) + "}\n";
  });
  try { body(home, texts); } finally { fs.rmSync(home, { recursive: true, force: true }); }
}
function observe(home: string, texts: string[], fault = ""): any {
  const url = new URL("../../src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import os from "node:os"; import fs from "node:fs"; import cp from "node:child_process";
    import {inspect as render} from "node:util"; import {syncBuiltinESMExports} from "node:module";
    const identity = os.userInfo(); os.userInfo = () => ({...identity,homedir:${JSON.stringify(home)}});
    const texts = ${JSON.stringify(texts)}, labels = ${JSON.stringify(labels)};
    let prints = 0, conversions = 0, active = false, run, evidence = () => null;
    const spawn = cp.spawnSync;
    cp.spawnSync = (command, args, options) => {
      if (command === "/bin/launchctl") {
        if (args.length !== 2 || args[0] !== "print") throw Error("unexpected launcher command");
        const index = labels.findIndex(label => args[1] === "gui/" + process.getuid() + "/" + label);
        if (index < 0) throw Error("unexpected launcher target");
        prints++; return {status:0, signal:null, stdout:Buffer.from(texts[index]), stderr:Buffer.alloc(0)};
      }
      if (command !== "/usr/bin/plutil" || JSON.stringify(args) !== JSON.stringify(["-convert","json","-o","-","-"])) throw Error("unexpected command");
      conversions++; return spawn(command,args,options);
    };
    ${fault}
    syncBuiltinESMExports();
    try {
      const module = await import(${JSON.stringify(url)}); active = true;
      run = module.observeDeploymentCutoverLauncherConfigurationV1;
      const observation = run();
      const frozen = value => !value || typeof value !== "object" || (Object.isFrozen(value) && Object.values(value).every(frozen));
      process.stdout.write(JSON.stringify({observation,frozen:frozen(observation),prints,conversions,evidence:evidence()}));
    } catch(error) {
      let retryError = null;
      if (run) { try { run(); } catch (retry) { retryError = render(retry,{depth:null}); } }
      process.stdout.write(JSON.stringify({error:render(error,{depth:null}),retryError,prints,conversions,evidence:evidence()}));
    }
  `], { encoding: "utf8", env: {}, timeout: 15000 });
  assert.equal(child.status, 0, child.stderr); return JSON.parse(child.stdout);
}

test("fixed launcher observation commits both unchanged configurations without revealing secrets", () => fixture((home, texts) => {
  const paths = labels.map(label => path.join(home, "Library", "LaunchAgents", `${label}.plist`));
  const bytes = paths.map(file => fs.readFileSync(file)), inodes = paths.map(file => fs.lstatSync(file).ino);
  const result = observe(home, texts);
  assert.equal(result.observation?.launchers.length, 2, JSON.stringify(result));
  assert.deepEqual(result.observation.launchers.map((entry: any) => entry.label), labels);
  assert.ok(result.observation.launchers.every((entry: any) => entry.activeCount === 0 && entry.state === "not running"));
  assert.equal(result.frozen, true); assert.equal(result.prints, 4);
  for (const secret of secrets) assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(observe(home, texts).observation.launcherObservationHash, result.observation.launcherObservationHash);
  paths.forEach((file, index) => { assert.deepEqual(fs.readFileSync(file), bytes[index]); assert.equal(fs.lstatSync(file).ino, inodes[index]); });
}));

test("transient inherited socket changes do not change durable launcher commitments", () => fixture((home, texts) => {
  const first = observe(home, texts), next = observe(home, texts.map(text => text.replace("SocketSentinel", "DifferentSocket")));
  assert.equal(first.observation?.launchers.length, 2, JSON.stringify(first));
  assert.equal(next.observation?.launchers.length, 2, JSON.stringify(next));
  first.observation.launchers.forEach((entry: any, index: number) => {
    assert.equal(entry.configurationHash, next.observation.launchers[index].configurationHash);
    assert.notEqual(entry.loadedStateHash, next.observation.launchers[index].loadedStateHash);
  });
}));

for (const change of ["credential", "duplicate", "active", "arguments"]) {
  test(`${change} loaded configuration refuses without leaking credentials`, () => fixture((home, texts) => {
    if (change === "credential") texts[1] = texts[1]!.replace("TOKEN_SENTINEL", "CROSSED_TOKEN_SENTINEL");
    if (change === "duplicate") texts[0] = texts[0]!.replace("\tactive count = 0", "\tactive count = 0\n\tactive count = 0");
    if (change === "active") texts[0] = texts[0]!.replace("\tactive count = 0", "\tactive count = 1");
    if (change === "arguments") texts[1] = texts[1]!.replace("\t\t3333\n", "\t\t4444\n");
    const result = observe(home, texts);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    for (const secret of [...secrets, "CROSSED_TOKEN_SENTINEL"]) assert.equal(result.error.includes(secret), false);
  }));
}

for (const change of ["symlink", "parent-symlink", "hardlink", "mode", "parent-mode", "fifo", "oversized"]) {
  test(`${change} physical plist refuses before conversion`, () => fixture((home, texts) => {
    const file = path.join(home, "Library", "LaunchAgents", `${labels[0]}.plist`), outside = path.join(home, "retained");
    if (change === "symlink") { fs.renameSync(file, outside); fs.symlinkSync(outside, file); }
    if (change === "parent-symlink") { fs.renameSync(path.dirname(file), outside); fs.symlinkSync(outside, path.dirname(file)); }
    if (change === "hardlink") fs.linkSync(file, outside);
    if (change === "mode") fs.chmodSync(file, 0o666);
    if (change === "parent-mode") fs.chmodSync(path.dirname(file), 0o777);
    if (change === "fifo") { fs.unlinkSync(file); execFileSync("/usr/bin/mkfifo", [file]); }
    if (change === "oversized") fs.truncateSync(file, 1024 * 1024 + 1);
    const inode = fs.lstatSync(file).ino, result = observe(home, texts);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    assert.equal(result.conversions, 0); assert.equal(fs.lstatSync(file).ino, inode);
  }));
}

for (const change of ["file", "parent", "bytes", "loaded"]) {
  test(`${change} drift during launcher bracket refuses without repairing replacement`, () => fixture((home, texts) => {
    const file = path.join(home, "Library", "LaunchAgents", `${labels[0]}.plist`), outside = path.join(home, "retained");
    const result = observe(home, texts, `
      const command = cp.spawnSync; let changed = false;
      cp.spawnSync = (...args) => {
        const result = command(...args);
        if (active && args[0] === "/bin/launchctl" && !changed) {
          changed = true; const kind = ${JSON.stringify(change)}, file = ${JSON.stringify(file)}, outside = ${JSON.stringify(outside)};
          if (kind === "file") { const bytes = fs.readFileSync(file); fs.renameSync(file,outside); fs.writeFileSync(file,bytes,{mode:0o600}); }
          if (kind === "parent") { fs.renameSync(${JSON.stringify(path.dirname(file))},outside); fs.mkdirSync(${JSON.stringify(path.dirname(file))}); }
          if (kind === "bytes") fs.appendFileSync(file,"\\n");
          if (kind === "loaded") texts[0] = texts[0].replace("not running","spawn scheduled");
        }
        return result;
      }; evidence = () => ({changed});
    `);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    assert.equal(result.evidence.changed, true);
    if (change === "file" || change === "parent") assert.equal(fs.existsSync(outside), true);
    if (change === "parent") assert.deepEqual(fs.readdirSync(path.dirname(file)), []);
    if (change === "bytes") assert.ok(fs.readFileSync(file, "utf8").endsWith("\n\n"));
  }));
}

for (const boundary of ["launchctl", "plutil"]) {
  test(`${boundary} subprocess failures cannot expose secret-bearing causes or output`, () => fixture((home, texts) => {
    const result = observe(home, texts, `
      const command = cp.spawnSync;
      cp.spawnSync = (...args) => {
        if (args[0].endsWith(${JSON.stringify(boundary)})) {
          throw new Error(${JSON.stringify(secrets.join(" "))}, {cause:new Error("TOKEN_SENTINEL")});
        }
        return command(...args);
      };
    `);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    for (const secret of secrets) assert.equal(result.error.includes(secret), false);
  }));
}

for (const change of ["unexpected-key", "interval", "log", "arguments", "environment-key"]) {
  test(`${change} durable plist refuses before launcher reads`, () => fixture((home, texts) => {
    const file = path.join(home, "Library", "LaunchAgents", `${labels[0]}.plist`);
    const parsed = JSON.parse(execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", file], { encoding: "utf8" }));
    if (change === "unexpected-key") parsed.KeepAlive = true;
    if (change === "interval") parsed.StartInterval = 1;
    if (change === "log") parsed.StandardOutPath = path.join(home, "wrong.log");
    if (change === "arguments") parsed.ProgramArguments.push("--unexpected");
    if (change === "environment-key") parsed.EnvironmentVariables.EXTRA = "unexpected";
    const bytes = execFileSync("/usr/bin/plutil", ["-convert", "xml1", "-o", "-", "-"], { input: JSON.stringify(parsed) });
    fs.writeFileSync(file, bytes);
    const result = observe(home, texts);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    assert.equal(result.prints, 0); assert.deepEqual(fs.readFileSync(file), bytes);
  }));
}

for (const change of ["environment-duplicate", "block-duplicate", "envelope", "interval"]) {
  test(`${change} loaded launcher text refuses`, () => fixture((home, texts) => {
    if (change === "environment-duplicate") texts[0] = texts[0]!.replace("\t\tOSLogRateLimit => 64", "\t\tOSLogRateLimit => 64\n\t\tOSLogRateLimit => 64");
    if (change === "block-duplicate") texts[0] = texts[0]!.replace("\tproperties = runatload", "\targuments = {\n\t}\n\tproperties = runatload");
    if (change === "envelope") texts[0] = "crossed" + texts[0];
    if (change === "interval") texts[0] = texts[0]!.replace("60 seconds", "1 seconds");
    assert.match(observe(home, texts).error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
  }));
}

test("uncertain launcher descriptor close never closes a reused descriptor and prevents reobservation", () => fixture((home, texts) => {
  const sentinel = path.join(home, "sentinel"); fs.writeFileSync(sentinel, "sentinel");
  const result = observe(home, texts, `
    const close = fs.closeSync; let consumed = null, sentinelFd = null, attempts = 0;
    fs.closeSync = fd => {
      if (active && consumed === null) {
        consumed = fd; attempts++; close(fd);
        sentinelFd = fs.openSync(${JSON.stringify(sentinel)},"r");
        if (sentinelFd !== fd) throw Error("sentinel did not reuse descriptor");
        throw Error("close response lost TOKEN_SENTINEL");
      }
      if (fd === consumed) attempts++;
      return close(fd);
    };
    evidence = () => { let alive = false; try { alive = fs.fstatSync(sentinelFd).isFile(); } catch {}
      return {attempts,alive,reused:sentinelFd === consumed}; };
  `);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
  assert.match(result.retryError, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
  assert.equal(result.error.includes("TOKEN_SENTINEL"), false);
  assert.deepEqual(result.evidence, { attempts: 1, alive: true, reused: true });
  assert.equal(result.prints, 4);
}));

for (const name of ["state", "active count"]) {
  test(`empty duplicate ${name} assignment is ambiguous and refuses`, () => fixture((home, texts) => {
    texts[0] = texts[0]!.replace("\ttype = LaunchAgent", `\t${name} = \n\ttype = LaunchAgent`);
    assert.match(observe(home, texts).error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
  }));
}
for (const boundary of ["launchctl", "plutil"]) {
  test(`${boundary} success carrying stderr refuses without exposing it`, () => fixture((home, texts) => {
    const result = observe(home, texts, `
      const command = cp.spawnSync;
      cp.spawnSync = (...args) => {
        const result = command(...args);
        return args[0].endsWith(${JSON.stringify(boundary)}) ? {...result,stderr:Buffer.from("TOKEN_SENTINEL")} : result;
      };
    `);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    assert.equal(result.error.includes("TOKEN_SENTINEL"), false);
  }));
}
