import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const enabled = process.env.SETFARM_TASK6A_TEST_CHILD_AUTHORITY_FIXTURE === "1";
const pgBin = "/opt/homebrew/opt/postgresql@17/bin";
const childSource = fileURLToPath(new URL("./task6a-private-child-authority-child.mjs", import.meta.url));
const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

function command(file: string, args: string[], timeout = 30_000): string {
  const result = spawnSync(file, args, { encoding: "utf8", timeout, maxBuffer: 8192,
    env: { PATH: "/usr/bin:/bin:/opt/homebrew/bin", LANG: "C", LC_ALL: "C" } });
  assert.equal(result.error, undefined, "TASK6A_CHILD_COMMAND_EXEC_FAILED");
  assert.equal(result.status, 0, "TASK6A_CHILD_COMMAND_FAILED");
  return result.stdout.trim();
}

function sudo(args: string[]): string { return command("/usr/bin/sudo", ["-n", ...args]); }

function userId(user: string): number {
  const value = Number(command("/usr/bin/id", ["-u", user]));
  assert.ok(Number.isSafeInteger(value) && value > 0);
  assert.equal(sudo(["-u", user, "/usr/bin/id", "-u"]), String(value));
  return value;
}

async function freeLoopbackPort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") { server.close(); reject(new Error("TASK6A_PORT_INVALID")); return; }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

type ChildResult = Readonly<{
  uid: number; login: string; effective: string;
  read: "ok" | "denied" | "other";
  write: "ok" | "denied" | "other";
  ddl: "ok" | "denied" | "other";
  file: "ok" | "denied" | "other";
  otherCredential: "denied" | "readable" | "other";
  protectedFileWrite: "ok" | "denied" | "other";
}>;

test("private Task6A child refuses malformed authority without fixture effects", () => {
  const result = spawnSync(process.execPath, [childSource, "5432", "bad", "bad", "bad", "bad", "bad"], {
    encoding: "utf8", timeout: 5000, maxBuffer: 1024,
    env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 64);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("private Task6A child jointly proves OS and PostgreSQL authority transition", {
  skip: enabled ? false : "requires explicit disposable child-authority fixture opt-in",
  timeout: 120_000,
}, async () => {
  assert.equal(process.platform, "darwin");
  assert.equal(process.env.SETFARM_PG_URL, undefined);
  assert.equal(process.env.SETFARM_TEST_PG_ADMIN_URL, undefined);
  assert.equal(typeof process.getuid, "function");
  assert.equal(typeof process.getgid, "function");
  const runnerUid = process.getuid!();
  const runnerGid = process.getgid!();
  const oldUid = userId("nobody"), nextUid = userId("_www");
  assert.ok(runnerUid > 0 && runnerUid !== oldUid && runnerUid !== nextUid && oldUid !== nextUid);
  const nestedSudo = spawnSync("/usr/bin/sudo", ["-n", "-u", "nobody", "/usr/bin/sudo",
    "-n", "-u", "_www", "/usr/bin/id", "-u"], { encoding: "utf8", timeout: 10_000,
    maxBuffer: 1024, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
  assert.equal(nestedSudo.error, undefined);
  assert.notEqual(nestedSudo.status, 0, "old UID must not sudo into successor UID");
  for (const binary of ["initdb", "pg_ctl", "psql"]) {
    assert.equal(fs.statSync(path.join(pgBin, binary)).isFile(), true);
  }
  const parent = fs.realpathSync("/tmp");
  const home = fs.mkdtempSync(path.join(parent, "setfarm-task6a-child-authority."));
  fs.chmodSync(home, 0o711);
  const homeStat = fs.lstatSync(home, { bigint: true });
  const data = path.join(home, "data"), writer = path.join(home, "writer");
  const stagedChild = path.join(home, "child.mjs");
  const adminPass = path.join(home, "admin.pass");
  const oldPass = path.join(home, "old.pgpass"), nextPass = path.join(home, "next.pgpass");
  const sourceBytes = fs.readFileSync(childSource);
  fs.writeFileSync(stagedChild, sourceBytes, { mode: 0o644, flag: "wx" });
  assert.equal(hash(fs.readFileSync(stagedChild)), hash(sourceBytes));
  const stagedStat = fs.lstatSync(stagedChild, { bigint: true });
  fs.mkdirSync(writer, { mode: 0o700 });
  const writerStat = fs.lstatSync(writer, { bigint: true });
  const exactHome = (): void => {
    assert.equal(path.dirname(home), parent);
    assert.match(path.basename(home), /^setfarm-task6a-child-authority\.[A-Za-z0-9]+$/);
    const stat = fs.lstatSync(home, { bigint: true });
    assert.equal(stat.isDirectory(), true);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(fs.realpathSync(home), home);
    assert.equal(stat.dev, homeStat.dev);
    assert.equal(stat.ino, homeStat.ino);
    assert.equal(stat.uid, BigInt(runnerUid));
  };
  const exactWriter = (expectedUid: number): void => {
    exactHome();
    const stat = fs.lstatSync(writer, { bigint: true });
    assert.equal(stat.isDirectory(), true);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(stat.dev, writerStat.dev);
    assert.equal(stat.ino, writerStat.ino);
    assert.equal(stat.uid, BigInt(expectedUid));
    assert.equal(Number(stat.mode & 0o777n), 0o700);
  };
  const exactChild = (): void => {
    exactHome();
    const stat = fs.lstatSync(stagedChild, { bigint: true });
    assert.equal(stat.isFile(), true);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(stat.dev, stagedStat.dev);
    assert.equal(stat.ino, stagedStat.ino);
    assert.equal(stat.uid, BigInt(runnerUid));
    assert.equal(Number(stat.mode & 0o777n), 0o644);
    assert.equal(hash(fs.readFileSync(stagedChild)), hash(sourceBytes));
  };
  let startAttempted = false;
  let admin: postgres.Sql | undefined;
  let fixture: postgres.Sql | undefined;
  let databaseCreated = false, oldCreated = false, nextCreated = false;
  let failure: unknown;
  const suffix = randomBytes(6).toString("hex");
  const database = `task6a_child_${suffix}`;
  const oldRole = `task6a_old_${suffix}`, nextRole = `task6a_next_${suffix}`;
  const oldPassword = randomBytes(24).toString("hex"), nextPassword = randomBytes(24).toString("hex");
  const adminPassword = randomBytes(24).toString("hex");
  try {
    const port = await freeLoopbackPort();
    assert.notEqual(port, 5432);
    fs.writeFileSync(adminPass, `${adminPassword}\n`, { mode: 0o600, flag: "wx" });
    command(path.join(pgBin, "initdb"), ["-D", data, "--auth-local=scram-sha-256",
      "--auth-host=scram-sha-256", `--pwfile=${adminPass}`, "--no-instructions"], 60_000);
    startAttempted = true;
    command(path.join(pgBin, "pg_ctl"), ["-D", data, "-w", "-l", path.join(home, "server.log"), "-o",
      `-h 127.0.0.1 -p ${port} -k ${home}`, "start"], 30_000);
    const adminUrl = new URL(`postgresql://127.0.0.1:${port}/postgres`);
    adminUrl.username = command("/usr/bin/id", ["-un"]);
    adminUrl.password = adminPassword;
    admin = postgres(adminUrl.toString(), { max: 1, connect_timeout: 5 });
    const identity = await admin<Array<{ data_directory: string; port: string; sockets: string; version: number }>>`
      SELECT current_setting('data_directory') AS data_directory,
        current_setting('port') AS port,
        current_setting('unix_socket_directories') AS sockets,
        current_setting('server_version_num')::integer AS version`;
    assert.deepEqual(identity[0], { data_directory: data, port: String(port), sockets: home,
      version: identity[0]?.version });
    assert.ok(identity[0]!.version >= 170000 && identity[0]!.version < 180000);
    const preExisting = await admin<Array<{ count: string }>>`
      SELECT count(*)::text AS count FROM pg_catalog.pg_database WHERE datname = ${database}`;
    assert.equal(preExisting[0]?.count, "0");
    await admin.unsafe(`CREATE DATABASE "${database}"`); databaseCreated = true;
    await admin.unsafe(`CREATE ROLE "${oldRole}" LOGIN PASSWORD '${oldPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`); oldCreated = true;
    await admin.unsafe(`CREATE ROLE "${nextRole}" LOGIN PASSWORD '${nextPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`); nextCreated = true;
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${database}" TO "${oldRole}", "${nextRole}"`);
    const fixtureUrl = new URL(adminUrl);
    fixtureUrl.pathname = `/${database}`;
    fixture = postgres(fixtureUrl.toString(), { max: 1, connect_timeout: 5 });
    await fixture`CREATE TABLE public.probe (id integer PRIMARY KEY, value text NOT NULL)`;
    await fixture`INSERT INTO public.probe (id, value) VALUES (1, 'sentinel')`;
    await fixture.unsafe(`GRANT USAGE ON SCHEMA public TO "${oldRole}", "${nextRole}"`);
    await fixture.unsafe(`GRANT INSERT ON public.probe TO "${oldRole}"`);
    await fixture.unsafe(`GRANT SELECT ON public.probe TO "${nextRole}"`);
    fs.writeFileSync(oldPass, `127.0.0.1:${port}:${database}:${oldRole}:${oldPassword}\n`, { mode: 0o600, flag: "wx" });
    fs.writeFileSync(nextPass, `127.0.0.1:${port}:${database}:${nextRole}:${nextPassword}\n`, { mode: 0o600, flag: "wx" });
    sudo(["/usr/sbin/chown", "nobody:nobody", oldPass]);
    sudo(["/usr/sbin/chown", "_www:_www", nextPass]);
    const oldPassStat = fs.lstatSync(oldPass, { bigint: true });
    const nextPassStat = fs.lstatSync(nextPass, { bigint: true });
    const exactCredential = (target: string, original: fs.BigIntStats, uid: number): void => {
      exactHome();
      const stat = fs.lstatSync(target, { bigint: true });
      assert.equal(stat.isFile(), true);
      assert.equal(stat.isSymbolicLink(), false);
      assert.equal(stat.dev, original.dev);
      assert.equal(stat.ino, original.ino);
      assert.equal(stat.uid, BigInt(uid));
      assert.equal(Number(stat.mode & 0o777n), 0o600);
    };
    const invoke = (user: string, role: string, pass: string, foreignPass: string,
      marker: string, protectedFile: string): ChildResult => {
      exactChild();
      exactCredential(oldPass, oldPassStat, oldUid);
      exactCredential(nextPass, nextPassStat, nextUid);
      const result = spawnSync("/usr/bin/sudo", ["-n", "-u", user, "/usr/bin/env", "-i",
        `PGPASSFILE=${pass}`, "HOME=/tmp", "PATH=/usr/bin:/bin", process.execPath,
        stagedChild, String(port), database, role, path.join(writer, marker), foreignPass,
        path.join(writer, protectedFile)],
      { encoding: "utf8", timeout: 15_000, maxBuffer: 2048, cwd: home,
        env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
      assert.equal(result.error, undefined, "TASK6A_CHILD_EXEC_FAILED");
      assert.equal(result.status, 0, "TASK6A_CHILD_REFUSED");
      assert.equal(result.stderr, "", "TASK6A_CHILD_STDERR_NOT_EMPTY");
      assert.ok(result.stdout.length < 1024);
      return JSON.parse(result.stdout) as ChildResult;
    };
    exactWriter(runnerUid);
    sudo(["/usr/sbin/chown", "nobody:nobody", writer]);
    exactWriter(oldUid);
    const before = invoke("nobody", oldRole, oldPass, nextPass, "old-before.txt", "old-before.txt");
    assert.deepEqual({ uid: before.uid, login: before.login, effective: before.effective,
      write: before.write, file: before.file, otherCredential: before.otherCredential,
      protectedFileWrite: before.protectedFileWrite },
    { uid: oldUid, login: oldRole, effective: oldRole, write: "ok", file: "ok",
      otherCredential: "denied", protectedFileWrite: "ok" });
    await fixture.unsafe(`REVOKE INSERT ON public.probe FROM "${oldRole}"`);
    exactWriter(oldUid);
    sudo(["/usr/sbin/chown", "_www:_www", writer]);
    exactWriter(nextUid);
    const successor = invoke("_www", nextRole, nextPass, oldPass, "next.txt", "old-before.txt");
    assert.deepEqual(successor, { uid: nextUid, login: nextRole, effective: nextRole,
      read: "ok", write: "denied", ddl: "denied", file: "ok", otherCredential: "denied",
      protectedFileWrite: "denied" });
    const after = invoke("nobody", oldRole, oldPass, nextPass, "old-after.txt", "next.txt");
    assert.deepEqual({ uid: after.uid, login: after.login, effective: after.effective,
      write: after.write, file: after.file, otherCredential: after.otherCredential,
      protectedFileWrite: after.protectedFileWrite },
    { uid: oldUid, login: oldRole, effective: oldRole, write: "denied", file: "denied",
      otherCredential: "denied", protectedFileWrite: "denied" });
    const rows = await fixture<Array<{ count: string }>>`SELECT count(*)::text AS count FROM public.probe`;
    assert.equal(rows[0]?.count, "1");
    assert.equal(fs.existsSync(path.join(writer, "old-after.txt")), false);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    const cleanup: string[] = [];
    try { await fixture?.end({ timeout: 5 }); } catch { cleanup.push("fixture_connection"); }
    try { if (databaseCreated) await admin?.unsafe(`DROP DATABASE "${database}"`); } catch { cleanup.push("database"); }
    try { if (oldCreated) await admin?.unsafe(`DROP ROLE "${oldRole}"`); } catch { cleanup.push("old_role"); }
    try { if (nextCreated) await admin?.unsafe(`DROP ROLE "${nextRole}"`); } catch { cleanup.push("next_role"); }
    try { await admin?.end({ timeout: 5 }); } catch { cleanup.push("admin_connection"); }
    try {
      if (startAttempted) {
        const status = spawnSync(path.join(pgBin, "pg_ctl"), ["-D", data, "status"], {
          encoding: "utf8", timeout: 10_000, maxBuffer: 1024,
          env: { PATH: "/usr/bin:/bin:/opt/homebrew/bin", LANG: "C", LC_ALL: "C" },
        });
        assert.equal(status.error, undefined);
        if (status.status === 0) command(path.join(pgBin, "pg_ctl"), ["-D", data, "-w", "stop", "-m", "fast"], 30_000);
        else assert.equal(status.status, 3, "TASK6A_CLUSTER_STATUS_UNCERTAIN");
      }
    } catch { cleanup.push("cluster_stop"); }
    if (cleanup.length === 0) {
      try {
        exactHome();
        const currentWriter = fs.lstatSync(writer, { bigint: true });
        assert.equal(currentWriter.dev, writerStat.dev);
        assert.equal(currentWriter.ino, writerStat.ino);
        sudo(["/usr/sbin/chown", `${runnerUid}:${runnerGid}`, writer]);
        exactWriter(runnerUid);
        exactChild();
        fs.rmSync(home, { recursive: true, force: false });
      } catch { cleanup.push("files"); }
    }
    if (cleanup.length > 0) {
      const error = new Error(`TASK6A_CHILD_CLEANUP_FAILED:${cleanup.join(",")}`);
      if (failure !== undefined) throw new AggregateError([failure, error], "TASK6A_CHILD_TEST_AND_CLEANUP_FAILED");
      throw error;
    }
  }
});
