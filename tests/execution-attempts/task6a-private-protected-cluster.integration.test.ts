import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomInt } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { assertProtectedClusterPolicyV1 } from "./task6a-protected-cluster-policy.js";

// Standalone OS/HBA rehearsal: never import the ambient database test harness.
// The root-capable driving UID is trusted; nobody/_www are the excluded actors.
// Homebrew tools are not a protected production deployment identity.
const enabled = process.env.SETFARM_TASK6A_TEST_PROTECTED_PG_FIXTURE === "1";
const pgBin = "/opt/homebrew/opt/postgresql@17/bin";
const cleanEnv = Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" });
type Result = Readonly<{ status: number | null; stdout: string; stderr: string }>;

function command(executable: string, args: string[], timeout = 15_000): Result {
  const result = spawnSync(executable, args, {
    env: cleanEnv, cwd: "/private/tmp", encoding: "utf8", timeout,
    maxBuffer: 1024 * 1024,
  });
  assert.equal(result.error, undefined, `fixture command failed: ${executable}`);
  assert.equal(result.signal, null, `fixture command interrupted: ${executable}`);
  return Object.freeze({ status: result.status, stdout: result.stdout, stderr: result.stderr });
}
function checked(executable: string, args: string[], timeout?: number): string {
  const result = command(executable, args, timeout);
  assert.equal(result.status, 0, `${executable}: ${result.stderr}`);
  return result.stdout.trim();
}
function asUser(user: string, executable: string, args: string[], timeout?: number): Result {
  return command("/usr/bin/sudo", ["-n", "-u", user, "/usr/bin/env", "-i",
    "PATH=/usr/bin:/bin", "LANG=C", "LC_ALL=C", executable, ...args], timeout);
}
function asChecked(user: string, executable: string, args: string[], timeout?: number): string {
  const result = asUser(user, executable, args, timeout);
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
const SOCKET_CLIENT_PROBE = `import assert from 'node:assert/strict';
const {createTask6aPostgresSocketSqlV1}=await import(process.argv[1]);
const candidate=JSON.parse(process.argv[2]);
process.env.PGPASSWORD='fixture-sentinel';
assert.throws(()=>createTask6aPostgresSocketSqlV1(candidate,'pool'),/TASK6A_SOCKET_TRANSPORT_ENVIRONMENT_REFUSED/);
delete process.env.PGPASSWORD;
for(const profile of ['pool','listener']) {
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
}
console.log('peer socket pool/listener verified');`;

test("private protected PG denies old identity and scoped admin impersonation across restart", {
  skip: enabled ? false : "requires explicit isolated protected PostgreSQL OS fixture opt-in",
  timeout: 180_000,
}, (t) => {
  assert.equal(process.platform, "darwin");
  const runnerUid = process.getuid!();
  const serverUid = id("_postgres", "-u"), clientUid = id("_www", "-u");
  const oldUid = id("nobody", "-u"), clientGid = id("_www", "-g");
  assert.equal(new Set([runnerUid, serverUid, clientUid, oldUid]).size, 4);
  assert.ok(runnerUid > 0);
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
  const port = randomInt(55_000, 59_000);
  const socketFile = path.join(socket, `.s.PGSQL.${port}`);
  let protectedRoot = false, uncertainLifecycle = false;
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
        const result = asUser(user, process.execPath, ["-e", WRITE_PROBE, target,
          [config, hba, ident, clientModule].includes(target) ? "a" : "wx"]);
        assert.equal(result.status, 42, `${user} must not modify ${target}: ${result.stderr}`);
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
    const client = asUser("_www", process.execPath, [
      "--input-type=module", "-e", SOCKET_CLIENT_PROBE,
      new URL(`file://${clientModule}`).href,
      JSON.stringify({ schema: "setfarm.postgres-socket-transport.v1", socketDirectory: socket,
        port, database: "postgres", user: "task6a_runtime", osUid: clientUid })], 30_000);
    assert.equal(client.status, 0, `actual source connector failed: ${client.stderr}`);
    assert.equal(client.stdout.trim(), "peer socket pool/listener verified");
    fileDenials();
  }

  try {
    fs.mkdirSync(data, { mode: 0o700 }); fs.mkdirSync(socket, { mode: 0o710 });
    dataAnchor = fs.lstatSync(data, { bigint: true });
    // The excluded UID cannot traverse the user's Home/worktree. Bundle the
    // actual source and dependency unchanged; never relax repository permissions.
    const esbuild = createRequire(import.meta.url)("esbuild") as typeof import("esbuild");
    const bundle = esbuild.buildSync({ entryPoints: [fileURLToPath(new URL(
      "../../src/internal-production/task6a-postgres-socket-transport-v1.ts", import.meta.url))],
      bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
    assert.equal(bundle.outputFiles.length, 1);
    fs.writeFileSync(clientModule, bundle.outputFiles[0].contents, { mode: 0o444 });
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
    rootCommand("/bin/chmod", ["0711", home]);
    rootCommand("/usr/sbin/chown", ["root:wheel", home]); protectedRoot = true;
    exactHome();
    assert.equal(fs.lstatSync(socket).uid, serverUid);
    assert.equal(fs.lstatSync(socket).gid, clientGid);
    for (const file of [config, hba, ident, clientModule]) {
      const stat = fs.lstatSync(file);
      assert.equal(stat.uid, 0); assert.equal(stat.mode & 0o777, 0o444);
    }
    fileDenials();
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
    boundary(); stop(); start(); boundary(); stop();
  } catch (error) {
    failure = error; throw error;
  } finally {
    try {
      assert.equal(uncertainLifecycle, false, `ambiguous lifecycle; retain ${home}`);
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
