import postgres from "postgres";
import path from "node:path";
import { types } from "node:util";

export type Task6aPostgresSocketTransportV1 = Readonly<{
  schema: "setfarm.postgres-socket-transport.v1";
  socketDirectory: string;
  port: number;
  database: string;
  user: string;
  osUid: number;
}>;

export function parseTask6aPostgresSocketTransportV1(value: unknown): Task6aPostgresSocketTransportV1 {
  const refuse = (): never => { throw new Error("TASK6A_SOCKET_TRANSPORT_INVALID"); };
  if (!value || typeof value !== "object" || types.isProxy(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) refuse();
  const fields = ["schema", "socketDirectory", "port", "database", "user", "osUid"];
  const keys = Reflect.ownKeys(value as object);
  if (keys.length !== fields.length || keys.some((key) => typeof key !== "string" || !fields.includes(key))) refuse();
  for (const key of fields) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property || !("value" in property) || !property.enumerable) refuse();
  }
  const input = value as Record<string, unknown>;
  if (input.schema !== "setfarm.postgres-socket-transport.v1"
    || typeof input.socketDirectory !== "string"
    || typeof input.port !== "number" || !Number.isSafeInteger(input.port)
    || input.port < 1 || input.port > 65535 || input.port === 5432
    || typeof input.osUid !== "number" || !Number.isSafeInteger(input.osUid)
    || input.osUid < 1 || input.osUid > 4294967294
    || typeof input.database !== "string" || !/^[a-z_][a-z0-9_]{0,62}$/.test(input.database)
    || typeof input.user !== "string" || !/^[a-z_][a-z0-9_]{0,62}$/.test(input.user)) refuse();
  const directory = input.socketDirectory as string;
  if (!path.posix.isAbsolute(directory) || directory === "/" || directory.endsWith("/")
    || path.posix.normalize(directory) !== directory || /[\x00-\x1f\x7f%\\:]/.test(directory)
    || /^\.s\.PGSQL\./.test(path.posix.basename(directory))
    || Buffer.byteLength(`${directory}/.s.PGSQL.${input.port}`, "utf8") > 103) refuse();
  // Transport data only: no physical descriptor, peer-role grant or admission proof.
  return Object.freeze({ schema: "setfarm.postgres-socket-transport.v1",
    socketDirectory: directory, port: input.port as number, database: input.database as string,
    user: input.user as string, osUid: input.osUid as number });
}
export function buildTask6aPostgresSocketOptionsV1(value: unknown,
  profile: "pool" | "listener", environment: Readonly<NodeJS.ProcessEnv>): Readonly<postgres.Options<{}>> {
  const candidate = parseTask6aPostgresSocketTransportV1(value);
  if (profile !== "pool" && profile !== "listener") throw new Error("TASK6A_SOCKET_TRANSPORT_INVALID");
  const refuseEnvironment = (): never => { throw new Error("TASK6A_SOCKET_TRANSPORT_ENVIRONMENT_REFUSED"); };
  if (!environment || typeof environment !== "object") refuseEnvironment();
  let inherited: object | null = environment;
  let depth = 0;
  while (inherited !== null) {
    if (++depth > 16 || types.isProxy(inherited)
      || Reflect.ownKeys(inherited).some((key) => typeof key !== "string"
        || key.startsWith("PG") || key === "SETFARM_PG_URL" || key === "DATABASE_URL")) refuseEnvironment();
    inherited = Object.getPrototypeOf(inherited);
  }
  return Object.freeze({ path: `${candidate.socketDirectory}/.s.PGSQL.${candidate.port}`,
    port: candidate.port, database: candidate.database, username: candidate.user,
    password: "", ssl: false, max: profile === "pool" ? 50 : 1,
    idle_timeout: 5, connect_timeout: 10, onnotice: () => {},
    connection: Object.freeze({ application_name: "setfarm.socket-transport.v1" }) });
}
export function createTask6aPostgresSocketSqlV1(value: unknown, profile: "pool" | "listener") {
  const candidate = parseTask6aPostgresSocketTransportV1(value);
  if (typeof process.getuid !== "function" || process.getuid() !== candidate.osUid) {
    throw new Error("TASK6A_SOCKET_TRANSPORT_UID_REFUSED");
  }
  const options = buildTask6aPostgresSocketOptionsV1(candidate, profile, process.env);
  const sql = postgres(options);
  if (sql.options.path !== options.path || sql.options.database !== candidate.database
    || sql.options.user !== candidate.user || sql.options.pass !== ""
    || sql.options.port.length !== 1 || sql.options.port[0] !== candidate.port) {
    void sql.end({ timeout: 0 }).catch(() => {});
    throw new Error("TASK6A_SOCKET_TRANSPORT_OPTIONS_REFUSED");
  }
  return sql;
}
