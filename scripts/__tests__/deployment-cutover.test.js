import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fixture, run, write, git } from "./fixtures/deployment-cutover-bootstrap.mjs";

test("authenticated bootstrap accepts legitimate partial output-file reads", () => fixture(root => {
  const result = run(root); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).sourceBuild.clean, true);
}, source => source.replace('const closure = ', `const partialFile=path.join(root,'dist/cli/cli.js'),partialInode=fs.statSync(partialFile).ino,originalRead=fs.readSync;
  fs.readSync=(fd,buffer,offset,length,position)=>originalRead(fd,buffer,offset,fs.fstatSync(fd).ino===partialInode?Math.min(length,7):length,position);
  syncBuiltinESMExports();const closure = `)));

for (const fault of ["installed-bytes", "installed-mode", "installed-symlink", "package-metadata", "lock-bytes", "helper-bytes"]) {
  test(`authenticated dependency boundary refuses ${fault} without evaluating packages`, () => fixture(root => {
    const entry = path.join(root, "node_modules/postgres/src/index.js");
    if (fault === "installed-bytes") fs.writeFileSync(entry, 'process.stdout.write("UNVERIFIED_PACKAGE_EXECUTED");');
    if (fault === "installed-mode") fs.chmodSync(entry, 0o666);
    if (fault === "installed-symlink") { fs.renameSync(entry, entry + ".preserved"); fs.symlinkSync(entry + ".preserved", entry); }
    if (fault === "package-metadata") fs.writeFileSync(path.join(root, "node_modules/postgres/package.json"), '{"type":"commonjs"}');
    if (fault === "lock-bytes") fs.appendFileSync(path.join(root, "package-lock.json"), " ");
    if (fault === "helper-bytes") fs.appendFileSync(path.join(root, "scripts/deployment-cutover-dependencies.mjs"), 'process.stdout.write("UNVERIFIED_HELPER_EXECUTED");');
    const result = run(root); assert.equal(result.status, 1); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  }));
}

for (const specifier of ["postgres/src/index.js", "zod/index.js", "zod/index.cjs", "foreign",
  "../node_modules/postgres/src/index.js?crossed", "../node_modules/zod/index.js#crossed", "../node_modules/zod/index.cjs"]) {
  test(`authenticated dependency boundary denies ${specifier} before module evaluation`, () => fixture(root => {
    const result = run(root); assert.equal(result.status, 1); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  }, source => source.replace('const owner = await import', `await import(${JSON.stringify(specifier)});const owner = await import`)
    .replace('check(); return { format: "module",', 'check(); if(entry.locator.startsWith("node_modules/"))process.stdout.write("UNEXPECTED_DEPENDENCY_EVALUATION"); return { format: "module",')));
}

test("authenticated dependency loading rejects a same-byte installed ancestor replacement", () => fixture(root => {
  const result = run(root); assert.equal(result.status, 1); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  assert.equal(fs.existsSync(path.join(root, "node_modules/postgres.preserved")), true);
}, source => source.replace('const owner = await import', `const packageRoot=path.join(root,'node_modules/postgres');
  fs.renameSync(packageRoot,packageRoot+'.preserved');fs.mkdirSync(packageRoot);
  for(const name of fs.readdirSync(packageRoot+'.preserved'))fs.renameSync(path.join(packageRoot+'.preserved',name),path.join(packageRoot,name));
  const owner = await import`)));

test("authenticated dependency loading never evaluates load-time replacement bytes", () => fixture(root => {
  const result = run(root); assert.equal(result.status, 1); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  assert.match(fs.readFileSync(path.join(root, "node_modules/postgres/src/index.js"), "utf8"), /SWAPPED_DEPENDENCY_EXECUTED/);
}, source => source.replace('const owner = await import', `await import('postgres');const owner = await import`)
  .replace('check(); return { format: "module",', `check(); if(entry.locator==='node_modules/postgres/src/index.js')fs.writeFileSync(entry.target,'process.stdout.write("SWAPPED_DEPENDENCY_EXECUTED");'); return { format: "module",`)));
test("bootstrap without synchronous hooks refuses before source reads instead of failing module instantiation", () => fixture(root => {
  const result = run(root);
  assert.equal(result.status, 1); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  assert.equal(fs.existsSync(path.join(root, "ai")), false);
}, source => source.replace('from "node:module";', 'from "data:text/javascript,export%20%7BisBuiltin%7D%20from%20%27node%3Amodule%27";')
  .replace('function sourceState() {', 'function sourceState() { process.stdout.write("unexpected-source-read");')));

test("fresh bootstrap authenticates source and finalized output without runtime writes", () => fixture((root, expected) => {
  const result = run(root); assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
  const value = JSON.parse(result.stdout); assert.deepEqual(value.sourceBuild, expected);
  assert.match(value.controllerSourceHash, /^[a-f0-9]{64}$/); assert.equal(fs.existsSync(path.join(root, ".setfarm")), false);
  assert.equal(git(root, "status", "--porcelain"), "");
  assert.equal(fs.existsSync(path.join(root, "ai")), false);
}));
for (const fault of ["dirty-script", "wrong-origin", "output-bytes"]) test(`fresh bootstrap refuses ${fault} before reporting authority`, () => fixture(root => {
  if (fault === "dirty-script") fs.appendFileSync(path.join(root, "scripts/deployment-cutover-owner.mjs"), "\n");
  if (fault === "wrong-origin") git(root, "config", "remote.origin.url", "https://example.invalid/foreign.git");
  if (fault === "output-bytes") fs.appendFileSync(path.join(root, "dist/cli/cli.js"), "\n");
  const result = run(root); assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.match(result.stderr, /DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED/); assert.equal(fs.existsSync(path.join(root, ".setfarm")), false);
}));

for (const locator of ["scripts/build-generation-retention.mjs", "dist/internal-production/baseline-deployment-cutover-records-v1.js"]) {
  test(`load-time replacement of ${locator} never evaluates swapped bytes`, () => fixture(root => {
    const result = run(root); assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
    assert.match(result.stderr, /^DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n$/);
    assert.equal(fs.existsSync(path.join(root, "executed-marker")), false);
    assert.match(fs.readFileSync(path.join(root, locator), "utf8"), /executed-marker/);
    assert.equal(fs.existsSync(path.join(root, "ai")), false);
  }, source => source.replace('check(); return { format: "module", source: Buffer.from(entry.bytes), shortCircuit: true };',
    `check(); if(entry.locator===${JSON.stringify(locator)}){fs.writeFileSync(entry.target,"import fs from 'node:fs';fs.writeFileSync("+JSON.stringify(path.join(root,'executed-marker'))+",'executed');export const swapped=true;\\n");}
      return { format: "module", source: Buffer.from(entry.bytes), shortCircuit: true };`)));
}

for (const args of [[], ["prepare"], ["inspect"], ["inspect", "--json", "extra"]]) {
  test(`bootstrap rejects unsupported arguments ${JSON.stringify(args)} without runtime writes`, () => fixture(root => {
    const result = run(root, args); assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
    assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n"); assert.equal(fs.existsSync(path.join(root, "ai")), false);
  }));
}

test("bootstrap rejects unexpected secret-bearing environment without disclosing it", () => fixture(root => {
  const result = run(root, ["inspect", "--json"], { SETFARM_PG_URL: "fixture-secret-never-print" });
  assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n"); assert.doesNotMatch(result.stderr, /fixture-secret/);
  assert.equal(fs.existsSync(path.join(root, "ai")), false);
}));

test("bootstrap refuses being imported by an unsupported existing entry process", () => fixture(root => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(path.join(root, "scripts/deployment-cutover.mjs"))});`], {
    cwd: root, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", TZ: "UTC" }, encoding: "utf8", timeout: 30000,
  });
  assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n"); assert.equal(fs.existsSync(path.join(root, "ai")), false);
}));

// Only external OS service/process responses are simulated. The compiled
// observers, physical files, plist conversion and authenticated loader are real.
function hostCommandFixture(root, home, fault, cp, fs, path) {
  const original = cp.spawnSync, labels = ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard"];
  const oldRoot = path.join(home, "ai/setrox/old"), node = fs.realpathSync(process.execPath);
  let scans = 0, prints = 0;
  const row = (pid, command, ppid = 1, pgid = pid) => `${process.getuid()} ${pid} ${ppid} ${pgid} S Wed Sep 16 01:02:03 2026 ${command}\n`;
  const reply = (stdout, status = 0) => ({ status, signal: null, stdout: Buffer.from(stdout), stderr: Buffer.alloc(0) });
  cp.spawnSync = (command, args, options) => {
    if (command === "/usr/bin/git" || command === "/usr/bin/plutil") return original(command, args, options);
    if (command === "/bin/launchctl") {
      if (args.length !== 2 || args[0] !== "print") throw Error("unexpected service mutation");
      const label = labels.find(item => args[1] === `gui/${process.getuid()}/${item}`);
      if (!label) throw Error("unexpected service target");
      prints++;
      const plistPath = path.join(home, "Library/LaunchAgents", `${label}.plist`);
      const converted = original("/usr/bin/plutil", ["-convert", "json", "-o", "-", "-"], { input: fs.readFileSync(plistPath) });
      const plist = JSON.parse(converted.stdout), program = plist.ProgramArguments[0];
      const block = (name, lines) => `\t${name} = {\n${lines.map(line => `\t\t${line}\n`).join("")}\t}\n`;
      const state = fault === "launcher-drift" && prints > 4 ? "spawn scheduled" : "not running";
      return reply(`gui/${process.getuid()}/${label} = {\n\tpath = ${plistPath}\n\tprogram = ${program}\n\tstate = ${state}\n\tactive count = 0\n\ttype = LaunchAgent\n\trun interval = 60 seconds\n\tproperties = runatload\n`
        + block("arguments", plist.ProgramArguments)
        + block("environment", Object.entries({ ...plist.EnvironmentVariables, OSLogRateLimit: "64", XPC_SERVICE_NAME: label }).map(([k, v]) => `${k} => ${v}`))
        + block("inherited environment", [`SETFARM_ENV_DIR => ${home}/ai/setrox/setfarm/scripts`, "SSH_AUTH_SOCK => /var/run/com.apple.launchd.Fixture/Listeners"])
        + block("default environment", ["PATH => /usr/bin:/bin:/usr/sbin:/sbin"]) + "}\n");
    }
    if (command === "/bin/ps" && JSON.stringify(args) === JSON.stringify(["-ww", "-axo", "uid=,pid=,ppid=,pgid=,stat=,lstart=,command="])) {
      scans++;
      if (fault === "cli-drift" && scans === 1) {
        const link = path.join(home, ".local/bin/setfarm"); fs.renameSync(link, `${link}.preserved`); fs.symlinkSync(`${oldRoot}/dist/cli/cli.js`, link);
      }
      const dashboardRoot = fault === "mixed-root" ? root : oldRoot;
      return reply(row(process.pid, `${node} /fixture/controller.mjs`, process.ppid, process.pid)
        + row(4103, `${node} ${dashboardRoot}/dist/server/daemon.js 3333`)
        + (fault === "starter" || (fault === "family-drift" && scans > 2) ? row(4105, `${node} ${oldRoot}/dist/cli/cli.js spawner start`, 4100, 4100) : ""));
    }
    if (command === "/bin/ps" && JSON.stringify(args) === JSON.stringify(["-ww", "-p", "4103", "-o", "comm="])) return reply(`${node}\n`);
    if (command === "/usr/sbin/lsof" && JSON.stringify(args) === JSON.stringify(["-nP", "-iTCP:3333", "-sTCP:LISTEN", "-F0pcfn"])) return reply("p4103\0cnode\0\nf21\0n127.0.0.1:3333\0\n");
    throw Error("unexpected host command");
  };
}
function hostFixture(body, fault = "") {
  fixture((root, expected, home) => {
    const oldRoot = path.join(home, "ai/setrox/old");
    fs.mkdirSync(path.dirname(oldRoot), { recursive: true, mode: 0o755 });
    fixture(historicalRoot => {
      fs.renameSync(historicalRoot, oldRoot);
      write(oldRoot, "checkout-note.md", "New checkout retains the previous finalized build.\n");
      git(oldRoot, "add", "checkout-note.md"); git(oldRoot, "commit", "-qm", "new source retains build");
      git(oldRoot, "update-ref", "refs/remotes/origin/main", "HEAD");
    });
    fs.mkdirSync(path.join(home, ".local/bin"), { recursive: true, mode: 0o755 });
    fs.symlinkSync(path.join(oldRoot, "dist/cli/cli.js"), path.join(home, ".local/bin/setfarm"));
    for (const [index, label] of ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard"].entries()) {
      const program = path.join(home, ".local/bin/setfarm"), log = path.join(home, ".openclaw/logs", index ? "setfarm-dashboard.watch" : "setfarm-spawner.watch");
      const plist = { Label: label, ProgramArguments: index ? [program, "dashboard", "start", "--port", "3333"] : [program, "spawner", "start"],
        EnvironmentVariables: { PATH: "/usr/bin:/bin", SETFARM_PG_URL: "PG_SECRET_SENTINEL", ...(index ? { SETFARM_OPERATIONAL_WRITE_TOKEN: "TOKEN_SECRET_SENTINEL" } : {}) },
        RunAtLoad: true, StartInterval: 60, StandardOutPath: `${log}.log`, StandardErrorPath: `${log}.err.log` };
      write(home, `Library/LaunchAgents/${label}.plist`, execFileSync("/usr/bin/plutil", ["-convert", "xml1", "-o", "-", "-"], { input: JSON.stringify(plist) }), 0o600);
    }
    body(root, oldRoot, home);
  }, source => source.replace("const closure = ", `import cp from 'node:child_process';\n(${hostCommandFixture.toString()})(root,fixtureHome,${JSON.stringify(fault)},cp,fs,path);syncBuiltinESMExports();\nconst closure = `));
}

test("trusted host inspection joins real diagnostics without publishing authority", () => hostFixture((root, oldRoot, home) => {
  const link = path.join(home, ".local/bin/setfarm"), inode = fs.lstatSync(link).ino;
  const originalTarget = fs.readlinkSync(link), targetBytes = fs.readFileSync(link);
  const plistPaths = ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard"].map(label => path.join(home, "Library/LaunchAgents", `${label}.plist`));
  const plistsBefore = plistPaths.map(file => ({ bytes: fs.readFileSync(file), inode: fs.lstatSync(file).ino }));
  const result = run(root, ["inspect-host", "--json"]); assert.equal(result.status, 0, result.stderr);
  const host = JSON.parse(result.stdout).host;
  assert.equal(host.cli.checkoutPath, oldRoot); assert.equal(host.newCheckoutPath, root);
  assert.equal(host.launchers.launchers.length, 2); assert.equal(host.processes.listener.pid, 4103);
  assert.deepEqual(host.blockers, ["database-zero-owner-not-observed", "controller-ownership-not-acquired"]);
  assert.deepEqual(host.selectedDeployment.cli, host.cli);
  assert.notEqual(host.selectedDeployment.buildSource.sha, host.selectedDeployment.checkoutSource.sha);
  assert.match(host.hostObservationHash, /^[a-f0-9]{64}$/);
  assert.equal(fs.lstatSync(link).ino, inode); assert.equal(fs.existsSync(path.join(home, "ai/setrox/data")), false);
  assert.equal(fs.readlinkSync(link), originalTarget); assert.deepEqual(fs.readFileSync(link), targetBytes);
  assert.deepEqual(plistPaths.map(file => ({ bytes: fs.readFileSync(file), inode: fs.lstatSync(file).ino })), plistsBefore);
  assert.doesNotMatch(result.stdout + result.stderr, /SECRET_SENTINEL/);
  assert.equal(git(root, "status", "--porcelain"), "");
}));

for (const fault of ["cli-drift", "launcher-drift", "family-drift"]) test(`host inspection rejects cross-observer ${fault}`, () => hostFixture((root, oldRoot, home) => {
  const result = run(root, ["inspect-host", "--json"]); assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  assert.equal(fs.existsSync(path.join(home, "ai/setrox/data")), false);
}, fault));

for (const [fault, blocker] of [["mixed-root", "dashboard-cli-root-disagreement"], ["starter", "non-dashboard-process-family"]]) {
  test(`host inspection reports ${fault} as a blocker, never ready authority`, () => hostFixture((root, oldRoot, home) => {
    const result = run(root, ["inspect-host", "--json"]); assert.equal(result.status, 0, result.stderr);
    const host = JSON.parse(result.stdout).host; assert.ok(host.blockers.includes(blocker));
    assert.ok(host.blockers.includes("database-zero-owner-not-observed"));
    assert.equal(fs.existsSync(path.join(home, "ai/setrox/data")), false);
  }, fault));
}

test("trusted host inspection refuses a tampered selected build without evaluating it", () => hostFixture((root, oldRoot, home) => {
  const target = path.join(oldRoot, "dist/cli/cli.js");
  fs.writeFileSync(target, `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(path.join(root, "old-code-executed"))},'bad');\n`);
  const result = run(root, ["inspect-host", "--json"]);
  assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
  assert.equal(fs.existsSync(path.join(root, "old-code-executed")), false);
  assert.equal(fs.existsSync(path.join(home, "ai/setrox/data")), false);
}));
