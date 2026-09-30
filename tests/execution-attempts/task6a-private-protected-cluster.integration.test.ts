import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomInt } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { assertProtectedClusterPolicyV1 } from "./task6a-protected-cluster-policy.js";
import { prepareTask6aProtectedNativeFixtureV1, type ProtectedNativeFixtureV1 } from "./task6a-protected-native-fixture-v1.js";
import { assertTask6aNativeCleanupCertainV1, markTask6aNativeReleaseUncertainV1 } from "./task6a-native-load-commands-v1.js";
import { extractTask6aOrdinaryBaseStatementsV2 } from "./task6a-held-pg31-base-ddl-v2.js";

// Standalone OS/HBA rehearsal: never import the ambient database test harness.
// The root-capable driving UID is trusted; nobody/_www are the excluded actors.
// Homebrew tools are not a protected production deployment identity.
const enabled = process.env.SETFARM_TASK6A_TEST_PROTECTED_PG_FIXTURE === "1";
const nativeEnabled = process.env.SETFARM_TASK6A_TEST_PROTECTED_NATIVE_FIXTURE === "1";
const heldPg31Enabled = process.env.SETFARM_TASK6A_TEST_HELD_PG31_FIXTURE === "1";
if (process.env.SETFARM_TASK6A_TEST_HELD_PG31_FIXTURE !== undefined) {
  assert.equal(heldPg31Enabled && nativeEnabled && enabled, true,
    "held PG31 fixture requires all three explicit opt-ins");
}
if (process.env.SETFARM_TASK6A_TEST_PROTECTED_NATIVE_FIXTURE !== undefined) {
  assert.equal(nativeEnabled && enabled, true, "native fixture requires both explicit opt-ins");
}
const defaultPgBin = "/opt/homebrew/opt/postgresql@17/bin";
const cleanEnv = Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" });
type Result = Readonly<{ status: number | null; stdout: string; stderr: string }>;
let synchronousChildUncertain=false;
function definiteFixtureChildClose(code:number|null,signal:NodeJS.Signals|null):boolean {
  if(code!==null&&Number.isInteger(code)&&signal===null)return true;
  markTask6aNativeReleaseUncertainV1();return false;
}
function fixtureTimeout(message:string):Error {
  markTask6aNativeReleaseUncertainV1();return Error(`${message}; retain exact fixture`);
}

function endHeldFixtureInputV2(input: Pick<import("node:stream").Writable, "writableEnded" | "end">): void {
  if (!input.writableEnded) input.end("finish\n");
}

function command(executable: string, args: string[], timeout = 15_000): Result {
  const result = spawnSync(executable, args, {
    env: cleanEnv, cwd: "/private/tmp", encoding: "utf8", timeout,
    maxBuffer: 1024 * 1024,
  });
  if(result.error||result.signal!==null||result.status===null)synchronousChildUncertain=true;
  assert.equal(result.error, undefined, `fixture command failed: ${executable}`);
  assert.equal(result.signal, null, `fixture command interrupted: ${executable}`);
  assert.notEqual(result.status,null,`fixture command completion uncertain: ${executable}`);
  return Object.freeze({ status: result.status, stdout: result.stdout, stderr: result.stderr });
}
function checked(executable: string, args: string[], timeout?: number): string {
  const result = command(executable, args, timeout);
  assert.equal(result.status, 0, `${executable}: ${result.stderr}`);
  return result.stdout.trim();
}
function asUserBase(user: string, executable: string, args: string[], timeout?: number,
  environment:Readonly<Record<string,string>>={}): Result {
  return command("/usr/bin/sudo", ["-n", "-u", user, "/usr/bin/env", "-i",
    "PATH=/usr/bin:/bin", "LANG=C", "LC_ALL=C",...Object.entries(environment).map(([key,value])=>`${key}=${value}`), executable, ...args], timeout);
}
function asChecked(user: string, executable: string, args: string[], timeout?: number): string {
  const result = asUserBase(user, executable, args, timeout);
  assert.equal(result.status, 0, `${user} ${executable}: ${result.stderr}`);
  return result.stdout.trim();
}
function id(user: string, option: "-u" | "-g"): number {
  const value = Number(checked("/usr/bin/id", [option, user]));
  assert.ok(Number.isSafeInteger(value) && value > 0);
  return value;
}
const WRITE_PROBE = `const fs=require('node:fs');
try { fs.writeFileSync(process.argv[1], 'denied', {flag:process.argv[2]}); process.exit(0); }
catch(e) { process.exit(e.code==='EACCES'||e.code==='EPERM'?42:43); }`;
const PHYSICAL_HOLD_PROBE = `import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
const {holdTask6aSocketPhysicalEvidenceV1}=await import(process.argv[1]);
const candidate=JSON.parse(process.argv[2]),identity=JSON.parse(process.argv[3]);
const held=holdTask6aSocketPhysicalEvidenceV1(candidate,identity.serverUid,identity.clientGid);
held.recheck();console.log('held');
try {for await(const line of createInterface({input:process.stdin})) {
  assert.equal(line,'check');
  assert.throws(()=>held.recheck(),/TASK6A_SOCKET_PHYSICAL_REFUSED/);console.log('refused');
}} finally {held.close();}`;
const SOCKET_CLIENT_PROBE = `import assert from 'node:assert/strict';
const {createTask6aPostgresSocketSqlV1,createTask6aSingleBackendSocketClientV1,holdTask6aSocketPhysicalEvidenceV1}=await import(process.argv[1]);
const candidate=JSON.parse(process.argv[2]);
const physicalInput=JSON.parse(process.argv[3]);
const physical=holdTask6aSocketPhysicalEvidenceV1(candidate,physicalInput.serverUid,physicalInput.clientGid);
const physicalObservation=physical.observe();
assert.equal(Object.isFrozen(physical),true);assert.equal(Object.isFrozen(physicalObservation),true);
assert.equal(Object.isFrozen(physicalObservation.directory),true);assert.equal(Object.isFrozen(physicalObservation.socket),true);
assert.equal(physicalObservation.schema,'setfarm.socket-physical-evidence.v1');
for(const key of ['directory','socket']) {
  const expected=physicalInput[key],actual=physicalObservation[key];
  for(const field of ['dev','ino','uid','gid','mode','nlink'])assert.equal(actual[field],expected[field]);
  assert.equal(String(BigInt(actual.birthtimeNs)/1000000000n),expected.birthtimeSeconds);
}
assert.throws(()=>holdTask6aSocketPhysicalEvidenceV1(candidate,candidate.osUid,physicalInput.clientGid),/TASK6A_SOCKET_PHYSICAL_REFUSED/);
assert.throws(()=>holdTask6aSocketPhysicalEvidenceV1(candidate,physicalInput.otherUid,physicalInput.clientGid),/TASK6A_SOCKET_PHYSICAL_REFUSED/);
assert.throws(()=>holdTask6aSocketPhysicalEvidenceV1(candidate,physicalInput.serverUid,physicalInput.clientGid+1),/TASK6A_SOCKET_PHYSICAL_REFUSED/);
assert.throws(()=>holdTask6aSocketPhysicalEvidenceV1({...candidate,port:candidate.port+1},physicalInput.serverUid,physicalInput.clientGid),/TASK6A_SOCKET_PHYSICAL_REFUSED/);
process.env.PGPASSWORD='fixture-sentinel';
assert.throws(()=>createTask6aPostgresSocketSqlV1(candidate,'pool'),/TASK6A_SOCKET_TRANSPORT_ENVIRONMENT_REFUSED/);
delete process.env.PGPASSWORD;
for(const profile of ['pool','listener']) {
  physical.recheck();
  const sql=createTask6aPostgresSocketSqlV1(candidate,profile);
  try {
    const rows=await sql.unsafe('SELECT current_user AS role, current_database() AS database, inet_client_addr() IS NULL AS socket');
    assert.deepEqual(rows[0],{role:'task6a_runtime',database:'postgres',socket:true});
    const inserted=await sql.unsafe("INSERT INTO task6a_probe.effects(note) VALUES ('socket-client') RETURNING note");
    assert.equal(inserted[0].note,'socket-client');
    const counted=await sql.unsafe('SELECT count(*) > 0 AS present FROM task6a_probe.effects');
    assert.equal(counted[0].present,true);
    await assert.rejects(sql.unsafe('SET ROLE task6a_admin'),e=>e.code==='42501');
    if(profile==='listener') {
      let resolveNotification;
      const notification=new Promise(resolve=>{resolveNotification=resolve;});
      const listening=await sql.listen('task6a_socket_fixture',payload=>resolveNotification(payload));
      let timer;
      try {
        await sql.notify('task6a_socket_fixture','fixture-notification');
        const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('fixture notification timeout')),3000);});
        assert.equal(await Promise.race([notification,timeout]),'fixture-notification');
      } finally {clearTimeout(timer);await listening.unlisten();}
    }
  } finally {await sql.end({timeout:2});}
  const denied=createTask6aPostgresSocketSqlV1({...candidate,user:'task6a_admin'},profile);
  try {await assert.rejects(denied.unsafe('SELECT current_user'),e=>e.code==='28000');}
  finally {await denied.end({timeout:2});}
  const missing=createTask6aPostgresSocketSqlV1({...candidate,port:candidate.port+1},profile);
  try {await assert.rejects(missing.unsafe('SELECT 1'),e=>e.code==='ENOENT');}
  finally {await missing.end({timeout:2});}
  physical.recheck();
}
let resolveSingleNotification;
const singleNotification=new Promise(resolve=>{resolveSingleNotification=resolve;});
const single=createTask6aSingleBackendSocketClientV1(candidate,(channel,payload)=>{
  assert.equal(channel,'task6a_single_backend_fixture');resolveSingleNotification(payload);
});
let reserved;
try {
  reserved=await single.sql.reserve();
  const before=(await reserved.unsafe('SELECT pg_backend_pid() AS pid, session_user AS session, current_user AS role, current_database() AS database, inet_client_addr() IS NULL AS socket'))[0];
  assert.equal(before.session,'task6a_runtime');assert.equal(before.role,'task6a_runtime');
  assert.equal(before.database,'postgres');assert.equal(before.socket,true);
  assert.ok(Number.isSafeInteger(before.pid)&&before.pid>1);
  await reserved.unsafe('LISTEN task6a_single_backend_fixture');
  await reserved.unsafe("SELECT pg_notify('task6a_single_backend_fixture','same-backend-notification')");
  let timer;
  try {
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('single backend notification timeout')),3000);});
    assert.equal(await Promise.race([singleNotification,timeout]),'same-backend-notification');
  } finally {clearTimeout(timer);}
  const after=(await reserved.unsafe('SELECT pg_backend_pid() AS pid'))[0];
  assert.equal(after.pid,before.pid);
  assert.deepEqual(single.observe(),{nativeSocketCreations:1,revoked:false});
  physical.recheck();
} finally {single.revoke();reserved?.release();await single.close();}
await assert.rejects(single.sql.unsafe('SELECT 1'));
assert.deepEqual(single.observe(),{nativeSocketCreations:1,revoked:true});

const lost=createTask6aSingleBackendSocketClientV1(candidate);
try {
  const live=(await lost.sql.unsafe('SELECT pg_backend_pid() AS pid, current_user AS role'))[0];
  assert.equal(live.role,'task6a_runtime');assert.ok(live.pid>1);
  // Only our own scoped backend; never the postmaster or another live session.
  const killing=lost.sql.unsafe('SELECT pg_terminate_backend(pg_backend_pid())').then(
    ()=>{throw Error('own backend unexpectedly survived');},()=>true);
  const queued=Array.from({length:4},()=>lost.sql.unsafe("INSERT INTO task6a_probe.effects(note) VALUES ('gated-queued-after-loss')").then(
    ()=>{throw Error('forbidden replacement backend effect');},()=>true));
  let timer;
  try {
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('single backend loss timeout')),3000);});
    assert.deepEqual(await Promise.race([Promise.all([killing,...queued]),timeout]),[true,true,true,true,true]);
  } finally {clearTimeout(timer);}
  await assert.rejects(lost.sql.unsafe('SELECT 1'));
  assert.deepEqual(lost.observe(),{nativeSocketCreations:1,revoked:true});
} finally {await lost.close();}
physical.recheck();physical.close();physical.close();
assert.throws(()=>physical.observe(),/TASK6A_SOCKET_PHYSICAL_REFUSED/);
assert.throws(()=>physical.recheck(),/TASK6A_SOCKET_PHYSICAL_REFUSED/);
console.log('peer transport and single backend lifecycle verified');`;

const NATIVE_IMAGE_PROBE=`import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';import {createInterface} from 'node:readline';
assert.equal(createHash('sha256').update('abc').digest('hex'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
assert.equal(randomBytes(32).length,32);assert.equal(new Intl.Collator('tr').resolvedOptions().locale,'tr');
const {createTask6aPostgresSocketSqlV1}=await import(process.argv[1]);
const sql=createTask6aPostgresSocketSqlV1(JSON.parse(process.argv[2]),'pool');let reserved;
try {reserved=await sql.reserve();
const facts=(await reserved.unsafe("SELECT pg_backend_pid() AS pid, task6a_probe.native_add(40,2) AS result, to_tsvector('english','running')::text AS dictionary"))[0];
assert.equal(facts.result,42);assert.equal(facts.dictionary,"'run':1");
console.log(JSON.stringify({pid:process.pid,backendPid:facts.pid,uid:process.getuid(),euid:process.geteuid(),executable:process.execPath}));
for await(const line of createInterface({input:process.stdin})){assert.equal(line,'finish');break;}
}finally{reserved?.release();await sql.end({timeout:2});}`;

const HELD_PG31_PROBE = `import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
const {withTask6aPrivateHeldPg31DiagnosticV2}=await import(process.argv[1]);
const candidate=JSON.parse(process.argv[2]),identities=JSON.parse(process.argv[3]),mode=process.argv[4];
let entered=false,denied=false,captured;
function rejectAssertionFailures(error,seen=new Set()) {
  if(error instanceof assert.AssertionError)throw error;
  if(!error||typeof error!=='object'||seen.has(error))return;
  seen.add(error);
  if(error instanceof AggregateError)for(const nested of error.errors)rejectAssertionFailures(nested,seen);
  if(Object.hasOwn(error,'cause'))rejectAssertionFailures(error.cause,seen);
}
try {
  const result=await withTask6aPrivateHeldPg31DiagnosticV2(candidate,identities.serverUid,identities.clientGid,async held=>{
    entered=true;captured=held;const facts=held.observe();
    assert.equal(facts.authority,'diagnostic-only');assert.equal(facts.productionAuthority,false);
    assert.equal(facts.observingBackendCount,1);assert.ok(facts.backendPid>1);
    console.log(JSON.stringify({event:'held',nodePid:process.pid,backendPid:facts.backendPid,
      uid:process.getuid(),euid:process.geteuid(),executable:process.execPath}));
    for await(const line of createInterface({input:process.stdin})) {
      if(line==='finish')break;
      assert.equal(line,'check');
      let refused=false;
      try {await held.recheck();}catch(error){rejectAssertionFailures(error);refused=true;}
      if(!refused){assert.equal(denied,false);console.log(JSON.stringify({event:'rechecked'}));}
      else {denied=true;assert.throws(()=>held.observe());await assert.rejects(held.recheck());
        console.log(JSON.stringify({event:'refused'}));}
    }
    if(mode==='positive'){assert.equal(denied,false);await held.recheck();return 'same-held-backend';}
    assert.equal(denied,true);return 'forbidden-revival';
  });
  assert.equal(mode,'positive');assert.equal(result,'same-held-backend');
} catch(error) {
  rejectAssertionFailures(error);
  assert.notEqual(mode,'positive',String(error));
  if(mode==='corrupt'){assert.equal(entered,false);denied=true;}else assert.equal(denied,true);
}
if(captured){assert.throws(()=>captured.observe());await assert.rejects(captured.recheck());}
assert.equal(mode==='positive'?entered:denied,true);
console.log(JSON.stringify({event:'closed',mode,entered,denied}));`;

const EXTRA_PG31_BACKEND_PROBE = `import {createInterface} from 'node:readline';
const {createTask6aSingleBackendSocketClientV1}=await import(process.argv[1]);
const client=createTask6aSingleBackendSocketClientV1(JSON.parse(process.argv[2]));
try {const rows=await client.sql.unsafe('SELECT pg_backend_pid() AS pid');
console.log(JSON.stringify({event:'extra',backendPid:rows[0].pid}));
for await(const line of createInterface({input:process.stdin})){if(line==='finish')break;throw Error('unexpected extra action');}}
finally{client.revoke();await client.close();}`;

test("private protected PG denies old identity and scoped admin impersonation across restart", {
  skip: enabled ? false : "requires explicit isolated protected PostgreSQL OS fixture opt-in",
  timeout: nativeEnabled ? 600_000 : 180_000,
}, async (t) => {
  assert.equal(process.platform, "darwin");
  const runnerUid = process.getuid!();
  const serverUid = id("_postgres", "-u"), clientUid = id("_www", "-u");
  const oldUid = id("nobody", "-u"), clientGid = id("_www", "-g");
  assert.equal(new Set([runnerUid, serverUid, clientUid, oldUid]).size, 4);
  assert.ok(runnerUid > 0);
  let native:ProtectedNativeFixtureV1|undefined;
  let pgBin=defaultPgBin,fixtureNode=process.execPath;
  function asUser(user:string,executable:string,args:string[],timeout?:number):Result {
    native?.recheck();
    const result=asUserBase(user,executable,args,timeout,native?.environment);
    native?.recheck();return result;
  }
  function asChecked(user:string,executable:string,args:string[],timeout?:number):string {
    const result=asUser(user,executable,args,timeout);assert.equal(result.status,0,`${user} ${executable}: ${result.stderr}`);
    return result.stdout.trim();
  }
  assert.equal(checked("/usr/bin/sudo", ["-n", "/usr/bin/id", "-u"]), "0");
  for (const user of ["_postgres", "_www", "nobody"]) {
    assert.equal(asChecked(user, "/usr/bin/id", ["-u"]), String(id(user, "-u")));
  }
  for (const user of ["_postgres", "_www", "nobody"]) {
    const policy = checked("/usr/bin/sudo", ["-n", "/usr/bin/sudo", "-l", "-U", user]);
    assert.match(policy, new RegExp(`^User ${user} is not allowed to run sudo on [^\\n]+\\.$`),
      `${user} effective sudo policy must explicitly deny all commands`);
    assert.notEqual(asUser(user, "/usr/bin/sudo", ["-n", "/usr/bin/id", "-u"]).status,
      0, `${user} must not inherit root sudo`);
  }
  for (const tool of ["initdb", "pg_ctl", "psql", "postgres"]) {
    assert.match(checked(path.join(pgBin, tool), ["--version"]), /PostgreSQL\) 17\./);
  }
  assert.equal(fs.realpathSync("/tmp"), "/private/tmp");
  const tmpStat = fs.lstatSync("/private/tmp");
  assert.equal(tmpStat.uid, 0); assert.equal(tmpStat.mode & 0o1000, 0o1000);
  const home = fs.mkdtempSync("/private/tmp/setfarm-task6a-protected-pg.");
  const anchor = fs.lstatSync(home, { bigint: true });
  const data = path.join(home, "data"), socket = path.join(home, "socket");
  const config = path.join(home, "postgresql.conf"), hba = path.join(home, "pg_hba.conf");
  const ident = path.join(home, "pg_ident.conf"), pidFile = path.join(data, "postmaster.pid");
  const clientModule = path.join(home, "socket-client.mjs");
  const heldModule = path.join(home, "held-pg31.mjs");
  const port = randomInt(55_000, 59_000);
  const socketFile = path.join(socket, `.s.PGSQL.${port}`);
  let protectedRoot = false, uncertainLifecycle = false;
  let observerLifecycleUncertain = false, observerModeUncertain = false;
  let nativeChildUncertain=false;
  let heldChildrenPossiblyRunning = 0;
  let server: Readonly<{ pid: number; identity: string; pidFile: string }> | undefined;
  let dataAnchor: fs.BigIntStats | undefined;
  let failure: unknown;

  function exactHome(): void {
    const stat = fs.lstatSync(home, { bigint: true });
    assert.equal(path.dirname(home), "/private/tmp");
    assert.match(path.basename(home), /^setfarm-task6a-protected-pg\.[A-Za-z0-9]+$/);
    assert.equal(fs.realpathSync(home), home);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
    assert.equal(stat.dev, anchor.dev); assert.equal(stat.ino, anchor.ino);
    assert.equal(stat.uid, protectedRoot ? 0n : BigInt(runnerUid));
    if (protectedRoot) assert.equal(Number(stat.mode & 0o777n), 0o711);
  }
  function rootCommand(executable: string, args: string[]): string {
    exactHome();
    if(executable==="/usr/bin/vmmap"){
      const result=command("/usr/bin/sudo",["-n",executable,...args]);
      assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,"","VM map warnings/errors refuse classification");
      return result.stdout.trim();
    }
    return checked("/usr/bin/sudo", ["-n", executable, ...args]);
  }
  function sqlAs(user: string, role: string, sql: string): Result {
    exactHome();
    return asUser(user, path.join(pgBin, "psql"), ["-X", "-w", "-A", "-t",
      "-v", "ON_ERROR_STOP=1", "-h", socket, "-p", String(port),
      "-U", role, "-d", "postgres", "-c", sql]);
  }
  function admin(sql: string): string {
    const result = sqlAs("_postgres", "task6a_admin", sql);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  function processIdentity(pid: number): string {
    return checked("/bin/ps", ["-p", String(pid), "-o", "uid=", "-o", "lstart=", "-o", "command="]);
  }
  function exactServer(): void {
    exactHome(); assert.ok(server);
    assert.equal(asChecked("_postgres", "/bin/cat", [pidFile]), server.pidFile);
    assert.equal(processIdentity(server.pid), server.identity);
  }
  function start(): void {
    exactHome(); assert.equal(server, undefined);
    uncertainLifecycle = true; // A timed-out start must never permit speculative cleanup.
    asChecked("_postgres", path.join(pgBin, "pg_ctl"), ["-D", data, "-l",
      path.join(data, "server.log"), "-o", `-c config_file=${config}`,
      "-w", "-t", "15", "start"], 25_000);
    const body = asChecked("_postgres", "/bin/cat", [pidFile]);
    const lines = body.split("\n"), pid = Number(lines[0]);
    assert.ok(Number.isSafeInteger(pid) && pid > 1);
    assert.equal(lines[1], data); assert.ok(/^\d+$/.test(lines[2]));
    const identity = processIdentity(pid);
    assert.equal(Number(identity.split(/\s+/)[0]), serverUid);
    assert.ok(identity.includes(data) && identity.includes(`config_file=${config}`));
    server = Object.freeze({ pid, identity, pidFile: body });
    exactServer(); uncertainLifecycle = false;
    t.diagnostic(`private fixture ${home}; verified postmaster ${pid}`);
  }
  function stop(): void {
    exactServer(); const captured = server!; uncertainLifecycle = true;
    asChecked("_postgres", path.join(pgBin, "pg_ctl"), ["-D", data,
      "-m", "immediate", "-w", "-t", "15", "stop"], 25_000);
    assert.equal(asUser("_postgres", path.join(pgBin, "pg_ctl"), ["-D", data, "status"]).status, 3);
    assert.equal(asUser("_postgres", "/bin/test", ["-e", pidFile]).status, 1);
    assert.equal(asUser("_postgres", "/bin/test", ["-e", socketFile]).status, 1);
    assert.equal(asUser("_postgres", "/bin/test", ["-e", `${socketFile}.lock`]).status, 1);
    const after = command("/bin/ps", ["-p", String(captured.pid), "-o", "uid=", "-o", "lstart=", "-o", "command="]);
    assert.notEqual(after.stdout.trim(), captured.identity, "captured postmaster must be gone");
    server = undefined; uncertainLifecycle = false;
  }
  function fileDenials(): void {
    for (const user of ["nobody", "_www"]) {
      for (const target of [config, hba, ident, clientModule, path.join(home, "replacement"),
        path.join(socket, "replacement"), path.join(data, "replacement")]) {
        const result = asUser(user, fixtureNode, ["-e", WRITE_PROBE, target,
          [config, hba, ident, clientModule].includes(target) ? "a" : "wx"]);
        assert.equal(result.status, 42, `${user} must not modify ${target}: ${result.stderr}`);
      }
    }
  }
  async function physicalRevocation(): Promise<void> {
    exactServer();
    observerLifecycleUncertain = true; // Burn before spawn; only CLOSE proves completion.
    const child = spawn("/usr/bin/sudo", ["-n", "-u", "_www", "/usr/bin/env", "-i",
      "PATH=/usr/bin:/bin", "LANG=C", "LC_ALL=C",...Object.entries(native?.environment??{}).map(([key,value])=>`${key}=${value}`), fixtureNode, "--input-type=module", "-e",
      PHYSICAL_HOLD_PROBE, new URL(`file://${clientModule}`).href,
      JSON.stringify({ schema: "setfarm.postgres-socket-transport.v1", socketDirectory: socket,
        port, database: "postgres", user: "task6a_runtime", osUid: clientUid }),
      JSON.stringify({ serverUid, clientGid })], { cwd: "/private/tmp", env: cleanEnv, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", errors = "", finished = false;
    let spawnError: Error | undefined;
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { errors += chunk; });
    child.on("error", error => { spawnError = error; });
    const done = new Promise<number | null>(resolve => child.once("close", (code,signal) => {
      finished = true; observerLifecycleUncertain = !definiteFixtureChildClose(code,signal); resolve(code);
    }));
    async function waitLines(lines: string): Promise<void> {
      const deadline = Date.now() + 3000;
      while (!output.endsWith(lines)) {
        assert.equal(spawnError, undefined); assert.equal(finished, false, errors);
        assert.ok(output.length < 2048 && errors.length < 2048, "bounded child output required");
        if(Date.now()>=deadline)throw fixtureTimeout("held physical evidence response timeout");
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    let tightened = false, runIdentity: fs.BigIntStats | undefined;
    function restore(): void {
      exactServer(); assert.ok(runIdentity);
      const before = fs.lstatSync(socket, { bigint: true });
      assert.ok(before.isDirectory() && !before.isSymbolicLink());
      for (const key of ["dev", "ino", "uid", "gid", "birthtimeNs"] as const)
        assert.equal(before[key], runIdentity[key]);
      assert.ok([0o700n, 0o710n].includes(before.mode & 0o7777n));
      rootCommand("/bin/chmod", ["0710", socket]);
      const after = fs.lstatSync(socket, { bigint: true });
      for (const key of ["dev", "ino", "uid", "gid", "birthtimeNs"] as const)
        assert.equal(after[key], runIdentity[key]);
      assert.equal(after.mode & 0o7777n, 0o710n);
      exactServer(); tightened = false; observerModeUncertain = false;
    }
    try {
      await waitLines("held\n"); exactServer();
      const current = fs.lstatSync(socket, { bigint: true });
      assert.ok(current.isDirectory() && !current.isSymbolicLink());
      assert.equal(current.uid, BigInt(serverUid)); assert.equal(current.gid, BigInt(clientGid));
      assert.equal(current.mode & 0o7777n, 0o710n);
      runIdentity = current; tightened = true; observerModeUncertain = true;
      rootCommand("/bin/chmod", ["0700", socket]);
      child.stdin.write("check\n"); await waitLines("held\nrefused\n");
      restore();
      child.stdin.write("check\n"); await waitLines("held\nrefused\nrefused\n");
    } finally {
      try {
        if (tightened) restore();
      } finally {
        // Always close the exact child even if directory restoration refuses.
        child.stdin.end();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => {
            reject(fixtureTimeout("observer child close uncertain"));
          }, 3000); });
          assert.equal(await Promise.race([done, timeout]), 0, errors); assert.equal(errors, "");
        } finally { clearTimeout(timer); }
      }
    }
  }
  function boundary(): void {
    exactServer();
    const dataStat = fs.lstatSync(data, { bigint: true });
    assert.ok(dataAnchor && dataStat.isDirectory() && !dataStat.isSymbolicLink());
    assert.equal(dataStat.dev, dataAnchor.dev); assert.equal(dataStat.ino, dataAnchor.ino);
    assert.equal(dataStat.uid, BigInt(serverUid));
    assert.equal(Number(dataStat.mode & 0o777n), 0o700);
    assert.equal(asChecked("_postgres", "/bin/cat", [path.join(data, "PG_VERSION")]), "17");
    for (const user of ["_www", "nobody"]) {
      assert.equal(asUser(user, "/bin/test", ["-x", data]).status, 1);
      const read = asUser(user, "/bin/cat", [path.join(data, "PG_VERSION")]);
      assert.notEqual(read.status, 0); assert.match(read.stderr, /permission denied/i);
    }
    assert.equal(admin("SELECT current_setting('config_file')"), config);
    assert.equal(admin("SELECT current_setting('data_directory')"), data);
    assert.equal(admin("SELECT current_setting('hba_file')"), hba);
    assert.equal(admin("SELECT current_setting('ident_file')"), ident);
    assert.equal(admin("SELECT current_setting('unix_socket_directories')"), socket);
    assert.equal(admin("SELECT current_setting('listen_addresses')"), "");
    assert.equal(admin("SELECT current_setting('unix_socket_group')"), "");
    assert.equal(admin("SELECT current_setting('port')"), String(port));
    assert.equal(admin("SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL"), "0");
    assert.equal(admin("SELECT count(*) FROM pg_hba_file_rules WHERE auth_method='trust'"), "0");
    assert.equal(admin("SELECT count(*) FROM pg_ident_file_mappings WHERE error IS NOT NULL"), "0");
    exactServer();
    const tcp = command("/usr/bin/sudo", ["-n", "/usr/sbin/lsof", "-a", "-p", String(server!.pid),
      "-iTCP", "-sTCP:LISTEN"]);
    assert.equal(tcp.status, 1); assert.equal(tcp.stdout.trim(), "",
      "fixture postmaster must have no TCP listener");
    assert.equal(tcp.stderr.trim(), "", "no-listener proof must not mask inspection errors");
    exactServer();
    assert.equal(admin("SELECT current_user || ':' || session_user"), "task6a_admin:task6a_admin");
    assert.equal(sqlAs("_www", "task6a_runtime", "SELECT current_user").stdout.trim(), "task6a_runtime");
    const denied = sqlAs("_www", "task6a_admin", "SELECT current_user");
    assert.notEqual(denied.status, 0, "scoped client must not impersonate admin");
    assert.match(denied.stderr, /peer authentication failed/i);
    for (const role of ["task6a_admin", "task6a_runtime"]) {
      const old = sqlAs("nobody", role, "SELECT current_user");
      assert.notEqual(old.status, 0); assert.match(old.stderr, /permission denied/i);
    }
    const allowed = sqlAs("_www", "task6a_runtime", "INSERT INTO task6a_probe.effects(note) VALUES ('fixture') RETURNING note");
    assert.equal(allowed.status, 0, allowed.stderr); assert.match(allowed.stdout, /^fixture\n/);
    assert.equal(sqlAs("_www", "task6a_runtime", "SELECT count(*) > 0 FROM task6a_probe.effects").stdout.trim(), "t");
    for (const sql of ["SET ROLE task6a_owner", "SET ROLE task6a_admin",
      "CREATE TABLE task6a_probe.forbidden(id int)", "DELETE FROM task6a_probe.effects",
      "UPDATE task6a_probe.effects SET note='forbidden'",
      "TRUNCATE task6a_probe.effects", "CREATE ROLE task6a_forbidden",
      "ALTER SYSTEM SET log_statement='all'"]) {
      const result = sqlAs("_www", "task6a_runtime", sql);
      assert.notEqual(result.status, 0, `runtime must refuse ${sql}`);
      assert.match(result.stderr, /permission denied|must be|not permitted/i);
    }
    assert.equal(admin("SELECT rolcanlogin FROM pg_roles WHERE rolname='task6a_owner'"), "f");
    assert.equal(admin("SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls FROM pg_roles WHERE rolname='task6a_runtime'"), "f");
    const physicalSnapshots = Object.fromEntries([["directory", socket], ["socket", socketFile]].map(([key, target]) => {
      // Driving UID intentionally cannot traverse0710. Root runs only the
      // system read-only metadata tool, never user-owned Node or wider ACLs.
      const fields = rootCommand("/usr/bin/stat", ["-f", "%d %i %u %g %p %B %l", target]).split(" ");
      assert.equal(fields.length, 7); assert.ok(fields.every(value => /^[0-9]+$/.test(value)));
      const [dev, ino, uid, gid, octalMode, birthtimeSeconds, nlink] = fields;
      return [key, { dev, ino, uid, gid, mode: String(BigInt(`0o${octalMode}`)), birthtimeSeconds, nlink }];
    }));
    const client = asUser("_www", fixtureNode, [
      "--input-type=module", "-e", SOCKET_CLIENT_PROBE,
      new URL(`file://${clientModule}`).href,
      JSON.stringify({ schema: "setfarm.postgres-socket-transport.v1", socketDirectory: socket,
        port, database: "postgres", user: "task6a_runtime", osUid: clientUid }),
      JSON.stringify({ serverUid, clientGid, otherUid: oldUid, ...physicalSnapshots })], 30_000);
    assert.equal(client.status, 0, `actual source connector failed: ${client.stderr}`);
    assert.equal(client.stdout.trim(), "peer transport and single backend lifecycle verified");
    assert.equal(admin("SELECT count(*) FROM task6a_probe.effects WHERE note='gated-queued-after-loss'"), "0",
      "queued effects must not execute on a replacement backend");
    fileDenials();
  }

  async function nativeEvidence():Promise<void>{
    if(!native)return;
    exactServer();native.recheck();
    native.verifyImages(server!.pid,serverUid,[path.join(pgBin,"postgres")],rootCommand);
    nativeChildUncertain=true;
    const child=spawn("/usr/bin/sudo",["-n","-u","_www","/usr/bin/env","-i","PATH=/usr/bin:/bin","LANG=C","LC_ALL=C",
      ...Object.entries(native.environment).map(([key,value])=>`${key}=${value}`),fixtureNode,"--input-type=module","-e",NATIVE_IMAGE_PROBE,
      new URL(`file://${clientModule}`).href,JSON.stringify({schema:"setfarm.postgres-socket-transport.v1",socketDirectory:socket,
        port,database:"postgres",user:"task6a_runtime",osUid:clientUid})],{cwd:"/private/tmp",env:cleanEnv,stdio:["pipe","pipe","pipe"]});
    let output="",errors="",finished=false,spawnError:Error|undefined;
    child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");
    child.stdout.on("data",chunk=>{output+=chunk;});child.stderr.on("data",chunk=>{errors+=chunk;});
    child.on("error",error=>{spawnError=error;});
    const done=new Promise<number|null>(resolve=>child.once("close",(code,signal)=>{
      finished=true;nativeChildUncertain=!definiteFixtureChildClose(code,signal);resolve(code);}));
    try{
      const deadline=Date.now()+5000;
      while(!output.endsWith("\n")){
        assert.equal(spawnError,undefined);assert.equal(finished,false,errors);assert.ok(output.length<2048&&errors.length<2048);
        if(Date.now()>=deadline)throw fixtureTimeout("native observer ready timeout");await new Promise(resolve=>setTimeout(resolve,10));
      }
      const facts=JSON.parse(output.trim());assert.equal(facts.uid,clientUid);assert.equal(facts.euid,clientUid);
      assert.equal(facts.executable,fixtureNode);assert.ok(Number.isSafeInteger(facts.backendPid)&&facts.backendPid>1);
      native.verifyImages(facts.pid,clientUid,[fixtureNode],rootCommand);
      native.verifyImages(facts.backendPid,serverUid,[path.join(pgBin,"postgres"),path.join(native.root,"opt/homebrew/lib/postgresql@17/plpgsql.dylib"),
        path.join(native.root,"opt/homebrew/lib/postgresql@17/dict_snowball.dylib")],rootCommand);
      t.diagnostic(`protected native ${native.imageCount} images/${native.memberCount} files; Node ${facts.pid}; backend ${facts.backendPid}`);
    }finally{
      child.stdin.end("finish\n");let timer:ReturnType<typeof setTimeout>|undefined;
      try{const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(fixtureTimeout("native child close uncertain")),5000);});
        assert.equal(await Promise.race([done,timeout]),0,errors);assert.equal(errors,"");
      }finally{clearTimeout(timer);}
    }
    native.recheck();exactServer();
  }

  async function heldPg31Evidence(): Promise<void> {
    if (!heldPg31Enabled) return;
    assert.ok(native); exactServer(); native.recheck();
    const candidate = { schema: "setfarm.postgres-socket-transport.v1", socketDirectory: socket,
      port, database: "setfarm", user: "task6a_runtime", osUid: clientUid };
    const adminCandidate = { ...candidate, user: "task6a_admin", osUid: serverUid };
    const statements = extractTask6aOrdinaryBaseStatementsV2(fs.readFileSync(new URL("../../src/db-pg.ts", import.meta.url), "utf8"));
    admin("CREATE DATABASE setfarm OWNER task6a_owner");
    const setup = asUser("_postgres", fixtureNode, ["--input-type=module", "-e",
      `const {prepareTask6aPrivateSource31FixtureV2}=await import(process.argv[1]);
       await prepareTask6aPrivateSource31FixtureV2(JSON.parse(process.argv[2]),JSON.parse(process.argv[3]));
       console.log('actual source31 prepared; guarded32 pending');`,
      new URL(`file://${heldModule}`).href, JSON.stringify(adminCandidate), JSON.stringify(statements)], 120000);
    assert.equal(setup.status, 0, setup.stderr); assert.equal(setup.stderr, "");
    assert.equal(setup.stdout.trim(), "actual source31 prepared; guarded32 pending");
    t.diagnostic("actual ordinary base52/source1-through31 prepared by peer setup actor; guarded32 remains pending");

    function spawnHeld(user: string, code: string, module: string, transport: unknown, mode = "") {
      exactServer(); native!.recheck(); heldChildrenPossiblyRunning++;
      const child = spawn("/usr/bin/sudo", ["-n", "-u", user, "/usr/bin/env", "-i",
        "PATH=/usr/bin:/bin", "LANG=C", "LC_ALL=C",
        ...Object.entries(native!.environment).map(([key, value]) => `${key}=${value}`),
        fixtureNode, "--input-type=module", "-e", code, new URL(`file://${module}`).href,
        JSON.stringify(transport), JSON.stringify({ serverUid, clientGid }), mode],
      { cwd: "/private/tmp", env: cleanEnv, stdio: ["pipe", "pipe", "pipe"] });
      let output = "", errors = "", finished = false, spawnError: Error | undefined;
      child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
      child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { errors += chunk; });
      child.on("error", error => { spawnError = error; }); child.stdin.on("error", error => { spawnError = error; });
      const done = new Promise<number | null>(resolve => child.once("close", (code, signal) => {
        finished = true;
        if (definiteFixtureChildClose(code, signal)) heldChildrenPossiblyRunning--;
        resolve(code);
      }));
      const next = async () => {
        const deadline = Date.now() + 40000;
        while (!output.includes("\n")) {
          assert.equal(spawnError, undefined); assert.equal(finished, false, errors);
          assert.ok(output.length < 4096 && errors.length < 4096);
          if (Date.now() >= deadline) throw fixtureTimeout("held PG31 observer response uncertain");
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        const split = output.indexOf("\n"), line = output.slice(0, split); output = output.slice(split + 1);
        return JSON.parse(line) as Record<string, unknown>;
      };
      const close = async () => {
        if (!finished) endHeldFixtureInputV2(child.stdin);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const timeout = new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(fixtureTimeout("held PG31 child close uncertain")), 10000);
          });
          assert.equal(await Promise.race([done, timeout]), 0, errors);
          assert.equal(errors, ""); assert.equal(spawnError, undefined);
        } finally { clearTimeout(timer); }
      };
      return { next, close, check: () => child.stdin.write("check\n"), finish: () => endHeldFixtureInputV2(child.stdin) };
    }
    const checkedFacts = (facts: Record<string, unknown>) => {
      assert.equal(facts.event, "held"); assert.equal(facts.uid, clientUid); assert.equal(facts.euid, clientUid);
      assert.equal(facts.executable, fixtureNode);
      assert.ok(Number.isSafeInteger(facts.nodePid) && Number(facts.nodePid) > 1);
      assert.ok(Number.isSafeInteger(facts.backendPid) && Number(facts.backendPid) > 1);
      native!.verifyImages(Number(facts.nodePid), clientUid, [fixtureNode], rootCommand);
      native!.verifyImages(Number(facts.backendPid), serverUid, [path.join(pgBin, "postgres"),
        path.join(native!.root, "opt/homebrew/lib/postgresql@17/plpgsql.dylib")], rootCommand);
      t.diagnostic(`retained actual PG31 Node ${facts.nodePid}/backend ${facts.backendPid}; native images sampled while held`);
    };
    for (const mode of ["positive", "other-backend", "backend-loss", "physical"]) {
      const child = spawnHeld("_www", HELD_PG31_PROBE, heldModule, candidate, mode);
      let extra: ReturnType<typeof spawnHeld> | undefined;
      let tightened = false;
      const socketPin = fs.lstatSync(socket, { bigint: true });
      const restore = () => {
        exactServer();
        const current = fs.lstatSync(socket, { bigint: true });
        for (const key of ["dev", "ino", "uid", "gid", "birthtimeNs"] as const) assert.equal(current[key], socketPin[key]);
        assert.ok([0o700n, 0o710n].includes(current.mode & 0o7777n));
        rootCommand("/bin/chmod", ["0710", socket]);
        assert.equal(fs.lstatSync(socket, { bigint: true }).mode & 0o7777n, 0o710n);
        tightened = false; observerModeUncertain = false;
      };
      try {
        const facts = await child.next(); checkedFacts(facts);
        if (mode === "other-backend") {
          extra = spawnHeld("_postgres", EXTRA_PG31_BACKEND_PROBE, clientModule, adminCandidate);
          const other = await extra.next(); assert.equal(other.event, "extra");
          assert.notEqual(other.backendPid, facts.backendPid);
        } else if (mode === "backend-loss") {
          assert.equal(admin(`SELECT pg_terminate_backend(pid) FROM pg_catalog.pg_stat_activity
            WHERE pid=${Number(facts.backendPid)} AND datname='setfarm' AND usename='task6a_runtime'`), "t");
        } else if (mode === "physical") {
          observerModeUncertain = true; tightened = true; rootCommand("/bin/chmod", ["0700", socket]);
        }
        child.check(); assert.equal((await child.next()).event, mode === "positive" ? "rechecked" : "refused");
        if (extra) { await extra.close(); extra = undefined; }
        if (tightened) restore();
        child.check(); assert.equal((await child.next()).event, mode === "positive" ? "rechecked" : "refused");
        child.finish(); const closed = await child.next(); assert.equal(closed.event, "closed");
        assert.equal(closed.denied, mode !== "positive");
      } finally {
        try { if (extra) await extra.close(); if (tightened) restore(); }
        finally { await child.close(); }
      }
      exactServer(); native!.recheck();
      t.diagnostic(`actual retained PG31 ${mode} validated; no holder revival/reconnect`);
    }
    const corrupt = asUser("_postgres", path.join(pgBin, "psql"), ["-X", "-w", "-v", "ON_ERROR_STOP=1",
      "-h", socket, "-p", String(port), "-U", "task6a_admin", "-d", "setfarm", "-c",
      "ALTER TABLE public.run_termination_requests DROP CONSTRAINT run_termination_requests_operational_failure_cause_check"]);
    assert.equal(corrupt.status, 0, corrupt.stderr);
    const denied = spawnHeld("_www", HELD_PG31_PROBE, heldModule, candidate, "corrupt");
    try {
      const closed = await denied.next(); assert.equal(closed.event, "closed");
      assert.equal(closed.entered, false); assert.equal(closed.denied, true);
    } finally { await denied.close(); }
    t.diagnostic("actual corrupt source31 constraint refused before continuation; no migration32/33 applied");
  }

  try {
    fs.mkdirSync(data, { mode: 0o700 }); fs.mkdirSync(socket, { mode: 0o710 });
    dataAnchor = fs.lstatSync(data, { bigint: true });
    if(nativeEnabled){
      const prepared=prepareTask6aProtectedNativeFixtureV1(home);prepared.protect(rootCommand);
      native=prepared;pgBin=prepared.pgBin;fixtureNode=prepared.node;
    }
    // The excluded UID cannot traverse the user's Home/worktree. Bundle the
    // actual source and dependency unchanged; never relax repository permissions.
    const esbuild = createRequire(import.meta.url)("esbuild") as typeof import("esbuild");
    const bundle = esbuild.buildSync({ entryPoints: [fileURLToPath(new URL(
      "./task6a-protected-cluster-client-entry.ts", import.meta.url))],
      bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
    assert.equal(bundle.outputFiles.length, 1);
    fs.writeFileSync(clientModule, bundle.outputFiles[0].contents, { mode: 0o444 });
    if (heldPg31Enabled) {
      const heldBundle = esbuild.buildSync({ entryPoints: [fileURLToPath(new URL(
        "./task6a-held-pg31-fixture-entry-v2.ts", import.meta.url))],
        bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
      assert.equal(heldBundle.outputFiles.length, 1);
      fs.writeFileSync(heldModule, heldBundle.outputFiles[0].contents, { mode: 0o444 });
    }
    fs.writeFileSync(hba, "local all task6a_admin peer map=task6a_fixture\nlocal all task6a_runtime peer map=task6a_fixture\nlocal all all reject\nlocal replication all reject\nhost all all 0.0.0.0/0 reject\nhost all all ::0/0 reject\nhost replication all 0.0.0.0/0 reject\nhost replication all ::0/0 reject\n", { mode: 0o444 });
    fs.writeFileSync(ident, "task6a_fixture _postgres task6a_admin\ntask6a_fixture _www task6a_runtime\n", { mode: 0o444 });
    fs.writeFileSync(config, `data_directory='${data}'\nhba_file='${hba}'\nident_file='${ident}'\nlisten_addresses=''\nport=${port}\nunix_socket_directories='${socket}'\nunix_socket_permissions=0777\nunix_socket_group=''\nshared_buffers='16MB'\nmax_connections=10\n`, { mode: 0o444 });
    assertProtectedClusterPolicyV1({ home, port, config: fs.readFileSync(config, "utf8"),
      hba: fs.readFileSync(hba, "utf8"), ident: fs.readFileSync(ident, "utf8") });
    rootCommand("/usr/sbin/chown", ["_postgres:_postgres", data]);
    rootCommand("/usr/sbin/chown", ["_postgres:_www", socket]);
    rootCommand("/bin/chmod", ["0710", socket]);
    rootCommand("/usr/sbin/chown", ["root:wheel", config, hba, ident, clientModule]);
    rootCommand("/bin/chmod", ["0444", config, hba, ident, clientModule]);
    if (heldPg31Enabled) {
      rootCommand("/usr/sbin/chown", ["root:wheel", heldModule]);
      rootCommand("/bin/chmod", ["0444", heldModule]);
    }
    rootCommand("/bin/chmod", ["0711", home]);
    rootCommand("/usr/sbin/chown", ["root:wheel", home]); protectedRoot = true;
    exactHome();
    native?.sealParent();
    assert.equal(fs.lstatSync(socket).uid, serverUid);
    assert.equal(fs.lstatSync(socket).gid, clientGid);
    for (const file of [config, hba, ident, clientModule]) {
      const stat = fs.lstatSync(file);
      assert.equal(stat.uid, 0); assert.equal(stat.mode & 0o777, 0o444);
    }
    fileDenials();
    if(native){
      const denialTargets:readonly string[]=native.denialTargets;
      for(const user of ["_postgres","_www","nobody"]){
        for(const target of denialTargets){
          const stat:fs.Stats=fs.lstatSync(target);const probe:string=stat.isDirectory()?path.join(target,"forbidden-new-file"):target;
          assert.equal(asUser(user,fixtureNode,["-e",WRITE_PROBE,probe,stat.isDirectory()?"wx":"a"]).status,42,
            `${user} must not modify protected native member`);
        }
      }
      native.recheck();
      // Unprivileged system shell waits/reaps the deliberate dyld abort and
      // disables core files only in this child. All arguments stay positional.
      const negative=asUser("_www","/bin/sh",["-c",'ulimit -c 0; "$@"; code=$?; exit "$code"',
        "fixture-no-core",native.negativeNode,"--version"],5000);
      assert.equal(negative.status,134,"only the deliberately missing-lib dyld abort is expected");
      assert.match(negative.stderr,/Library not loaded:.*libnode|libnode.*not found/s);
      assert.equal(negative.stdout,"");native.recheck();
      assert.match(asChecked("_www",fixtureNode,["--version"]),/^v22\.23\.1$/);
    }
    asChecked("_postgres", path.join(pgBin, "initdb"), ["-D", data,
      "-U", "task6a_admin", "--auth-local=peer", "--auth-host=reject", "--no-locale", "--no-instructions"], 30_000);
    start();
    admin(`CREATE ROLE task6a_owner NOLOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
CREATE ROLE task6a_runtime LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
REVOKE ALL ON DATABASE postgres FROM PUBLIC;
GRANT CONNECT ON DATABASE postgres TO task6a_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA task6a_probe AUTHORIZATION task6a_owner;
SET ROLE task6a_owner;
CREATE TABLE task6a_probe.effects(id bigserial PRIMARY KEY, note text NOT NULL);
RESET ROLE;
GRANT USAGE ON SCHEMA task6a_probe TO task6a_runtime;
GRANT SELECT,INSERT ON task6a_probe.effects TO task6a_runtime;
GRANT USAGE ON SEQUENCE task6a_probe.effects_id_seq TO task6a_runtime;`);
    if(native)admin("CREATE FUNCTION task6a_probe.native_add(a int,b int) RETURNS int LANGUAGE plpgsql AS 'BEGIN RETURN a+b; END'; GRANT EXECUTE ON FUNCTION task6a_probe.native_add(int,int) TO task6a_runtime;");
    boundary();await nativeEvidence(); await physicalRevocation(); stop(); start(); boundary();await nativeEvidence(); await physicalRevocation();
    await heldPg31Evidence(); stop();
  } catch (error) {
    failure = error; throw error;
  } finally {
    try {
      assert.equal(synchronousChildUncertain,false,`synchronous child completion uncertain; retain ${home}`);
      assertTask6aNativeCleanupCertainV1();
      assert.equal(uncertainLifecycle, false, `ambiguous lifecycle; retain ${home}`);
      assert.equal(observerLifecycleUncertain, false, `observer completion uncertain; retain ${home}`);
      assert.equal(observerModeUncertain, false, `observer mode restoration uncertain; retain ${home}`);
      assert.equal(nativeChildUncertain,false,`native child completion uncertain; retain ${home}`);
      assert.equal(heldChildrenPossiblyRunning, 0, `held PG31 child completion uncertain; retain ${home}`);
      if (server) stop();
      exactHome();
      if (protectedRoot) {
        assert.equal(asUser("_postgres", "/bin/test", ["-e", pidFile]).status, 1);
        assert.equal(asUser("_postgres", "/bin/test", ["-e", socketFile]).status, 1);
        // System-owned executables only under root. No user-writable Node or
        // recursive chown; find defaults to no-follow and -x bounds the device.
        const tree = rootCommand("/usr/bin/find", ["-x", home, "-exec",
          "/usr/bin/stat", "-f", "%d %HT", "{}", "+"]).split("\n");
        assert.ok(tree.length > 0 && tree.length < 10_000);
        for (const entry of tree) {
          assert.match(entry, new RegExp(`^${anchor.dev} (Directory|Regular File)$`),
            "cleanup refuses symlinks, special files or another device");
        }
        exactHome();
        rootCommand("/bin/rm", ["-r", home]);
      } else {
        // Preparation failure may have left child ownership changed; retain it.
        throw new Error(`incomplete protected fixture preparation; retain ${home}`);
      }
      assert.equal(fs.existsSync(home), false);
      t.diagnostic("verified private fixture stopped and removed; live paths untouched");
    } catch (error) {
      const cleanup = new Error(`protected fixture cleanup refused; retain ${home}`, { cause: error });
      if (failure) throw new AggregateError([failure, cleanup], "fixture and cleanup failed");
      throw cleanup;
    }
  }
});
