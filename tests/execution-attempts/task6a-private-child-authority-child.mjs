import { spawnSync } from "node:child_process";
import fs from "node:fs";

const [port, database, role, marker, foreignCredential, protectedFile] = process.argv.slice(2);
const passfile = process.env.PGPASSFILE;
if (!/^[0-9]{4,5}$/.test(port ?? "") || String(Number(port)) !== port
  || Number(port) < 1024 || Number(port) > 65535 || port === "5432"
  || !/^task6a_child_[a-f0-9]{12}$/.test(database ?? "")
  || !/^task6a_(?:old|next)_[a-f0-9]{12}$/.test(role ?? "")
  || !/^\/private\/tmp\/setfarm-task6a-child-authority\.[A-Za-z0-9]+\/writer\/[a-z-]+\.txt$/.test(marker ?? "")
  || !/^\/private\/tmp\/setfarm-task6a-child-authority\.[A-Za-z0-9]+\/writer\/[a-z-]+\.txt$/.test(protectedFile ?? "")
  || !/^\/private\/tmp\/setfarm-task6a-child-authority\.[A-Za-z0-9]+\/(?:old|next)\.pgpass$/.test(passfile ?? "")
  || !/^\/private\/tmp\/setfarm-task6a-child-authority\.[A-Za-z0-9]+\/(?:old|next)\.pgpass$/.test(foreignCredential ?? "")
  || passfile === foreignCredential || process.env.SETFARM_PG_URL !== undefined) {
  process.exit(64);
}

function sql(statement, expected, targetDatabase = database) {
  const result = spawnSync("/opt/homebrew/opt/postgresql@17/bin/psql", [
    "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate",
    "-h", "127.0.0.1", "-p", port, "-U", role, "-d", targetDatabase, "-c", statement,
  ], { encoding: "utf8", timeout: 5000, maxBuffer: 1024,
    env: { PATH: "/usr/bin:/bin", HOME: "/tmp", PGPASSFILE: passfile,
      PGCONNECT_TIMEOUT: "3", PGCLIENTENCODING: "UTF8", LANG: "C", LC_ALL: "C" } });
  if (result.error || result.signal) return { state: "other", output: "" };
  if (result.status === 0) return { state: expected === undefined || result.stdout.trim() === expected ? "ok" : "other",
    output: result.stdout.trim() };
  const denied = targetDatabase === "postgres"
    ? /FATAL:\s+permission denied for database "postgres"/.test(result.stderr)
    : /\b42501\b/.test(result.stderr);
  return { state: denied ? "denied" : "other", output: "" };
}

const identity = sql("SELECT session_user || ':' || current_user");
if (identity.state !== "ok" || identity.output !== `${role}:${role}`) process.exit(65);
const read = sql("SELECT value FROM public.probe WHERE id = 1", "sentinel").state;
const write = sql("BEGIN; INSERT INTO public.probe (id, value) VALUES (2, 'rollback'); ROLLBACK;").state;
const ddl = sql("CREATE TABLE public.outside (id integer)").state;
const tempDdl = sql("CREATE TEMP TABLE task6a_temp (id integer)").state;
const otherDatabase = sql("SELECT 1", "1", "postgres").state;
let file = "other";
try {
  fs.writeFileSync(marker, "probe\n", { flag: "wx", mode: 0o600 });
  file = "ok";
} catch (error) {
  if (error?.code === "EACCES" || error?.code === "EPERM") file = "denied";
}
let otherCredential = "other";
try {
  fs.readFileSync(foreignCredential);
  otherCredential = "readable";
} catch (error) {
  if (error?.code === "EACCES" || error?.code === "EPERM") otherCredential = "denied";
}
let protectedFileWrite = "other";
try {
  fs.appendFileSync(protectedFile, "probe\n");
  protectedFileWrite = "ok";
} catch (error) {
  if (error?.code === "EACCES" || error?.code === "EPERM") protectedFileWrite = "denied";
}
process.stdout.write(`${JSON.stringify({ uid: process.getuid(), euid: process.geteuid(), login: role, effective: role,
  read, write, ddl, tempDdl, otherDatabase, file, otherCredential, protectedFileWrite })}\n`);
