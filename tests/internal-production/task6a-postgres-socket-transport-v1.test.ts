import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildTask6aPostgresSocketOptionsV1,
  createTask6aPostgresSocketSqlV1,
  parseTask6aPostgresSocketTransportV1,
} from "../../src/internal-production/task6a-postgres-socket-transport-v1.js";

const candidate = Object.freeze({ schema: "setfarm.postgres-socket-transport.v1",
  socketDirectory: "/private/tmp/task6a-socket", port: 55437,
  database: "setfarm_fixture", user: "task6a_runtime", osUid: process.getuid!() });

test("socket transport builds explicit full path and bounded pool/listener profiles", () => {
  for (const profile of ["pool", "listener"] as const) {
    const options = buildTask6aPostgresSocketOptionsV1(candidate, profile, {});
    assert.equal(options.path, "/private/tmp/task6a-socket/.s.PGSQL.55437");
    assert.equal(options.database, "setfarm_fixture");
    assert.equal(options.username, "task6a_runtime");
    assert.equal(options.port, 55437);
    assert.equal(options.max, profile === "pool" ? 50 : 1);
    assert.equal(options.connect_timeout, 10);
    assert.equal(options.password, ""); assert.equal(options.ssl, false);
    assert.equal(Object.isFrozen(options), true);
  }
});

test("socket transport refuses ambiguous directory, schema and connection inputs", () => {
  for (const value of [null, [], { ...candidate, schema: "wrong" },
    { ...candidate, socketDirectory: "" }, { ...candidate, socketDirectory: "/" },
    { ...candidate, socketDirectory: "private/tmp" },
    { ...candidate, socketDirectory: "/private/tmp/../socket" },
    { ...candidate, socketDirectory: "/private//tmp/socket" },
    { ...candidate, socketDirectory: "/private/tmp/./socket" },
    { ...candidate, socketDirectory: "%2Fprivate%2Ftmp" },
    { ...candidate, socketDirectory: "/private/tmp%2Fsocket" },
    { ...candidate, socketDirectory: "postgresql://fixture@localhost" },
    { ...candidate, socketDirectory: "/private/tmp/.s.PGSQL.55437" },
    { ...candidate, socketDirectory: "/private/tmp/new\nline" },
    { ...candidate, socketDirectory: "/private/tmp/" + "a".repeat(110) },
    { ...candidate, port: 5432 }, { ...candidate, port: 0 },
    { ...candidate, port: "55437" }, { ...candidate, port: 65536 },
    { ...candidate, osUid: 0 }, { ...candidate, osUid: 1.5 },
    { ...candidate, user: "" }, { ...candidate, database: "fixture/other" },
    { ...candidate, url: "postgresql://fixture@localhost?host=/private/tmp" },
    { ...candidate, password: "forbidden" }, { ...candidate, socket: () => {} },
  ]) assert.throws(() => parseTask6aPostgresSocketTransportV1(value), /TASK6A_SOCKET_TRANSPORT_INVALID/);
  const accessor = Object.defineProperty({ ...candidate }, "user", { get() { throw Error("must not invoke"); } });
  assert.throws(() => parseTask6aPostgresSocketTransportV1(accessor), /TASK6A_SOCKET_TRANSPORT_INVALID/);
  const parsed = parseTask6aPostgresSocketTransportV1(candidate);
  assert.equal(Object.isFrozen(parsed), true);
  assert.notEqual(parsed, candidate);
});

test("socket transport refuses every ambient PG or URL source before client construction", () => {
  for (const environment of [{ PGHOST: "localhost" }, { PGPASSWORD: "forbidden" },
    { PGAPPNAME: "override" }, { PGSSL: "require" }, { PGPORT: undefined },
    { SETFARM_PG_URL: "postgresql://localhost" }, { DATABASE_URL: "postgresql://localhost" },
    Object.create({ PGPASSWORD: "inherited-forbidden" }) as NodeJS.ProcessEnv]) {
    assert.throws(() => buildTask6aPostgresSocketOptionsV1(candidate, "pool", environment),
      /TASK6A_SOCKET_TRANSPORT_ENVIRONMENT_REFUSED/);
  }
  assert.throws(() => buildTask6aPostgresSocketOptionsV1(candidate, "invalid" as "pool", {}),
    /TASK6A_SOCKET_TRANSPORT_INVALID/);
});

test("lazy socket clients preserve resolved endpoint and reject wrong peer UID", async () => {
  assert.throws(() => createTask6aPostgresSocketSqlV1({ ...candidate, osUid: candidate.osUid + 1 }, "pool"),
    /TASK6A_SOCKET_TRANSPORT_UID_REFUSED/);
  for (const profile of ["pool", "listener"] as const) {
    const sql = createTask6aPostgresSocketSqlV1(candidate, profile);
    try {
      assert.equal(sql.options.path, "/private/tmp/task6a-socket/.s.PGSQL.55437");
      assert.equal(sql.options.user, "task6a_runtime");
      assert.equal(sql.options.database, "setfarm_fixture");
      assert.deepEqual(sql.options.port, [55437]);
      assert.equal(sql.options.pass, "");
    } finally { await sql.end({ timeout: 1 }); }
  }
});
