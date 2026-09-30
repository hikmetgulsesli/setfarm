import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import net from "node:net";
import { once } from "node:events";
import { createTask6aSingleBackendSocketClientV1 }
  from "../../src/internal-production/task6a-single-backend-socket-client-v1.js";

const home = fs.mkdtempSync("/private/tmp/setfarm-task6a-single-socket-unit.");
const candidate = { schema: "setfarm.postgres-socket-transport.v1", socketDirectory: home,
  port: 55439, database: "setfarm_fixture", user: "task6a_runtime", osUid: process.getuid!() };
const keys = Object.keys(process.env).filter(key => key.startsWith("PG") || key === "SETFARM_PG_URL" || key === "DATABASE_URL");
const saved = new Map(keys.map(key => [key, process.env[key]!]));
for (const key of keys) delete process.env[key];
process.on("exit", () => { for (const [key, value] of saved) process.env[key] = value; fs.rmSync(home, { recursive: true, force: true }); });

test("single backend uses persistent single-connection options without opening a socket", async () => {
  const client = createTask6aSingleBackendSocketClientV1(candidate);
  try {
    assert.equal(client.sql.options.path, `${home}/.s.PGSQL.55439`);
    assert.equal(client.sql.options.max, 1);
    assert.equal(client.sql.options.idle_timeout, null);
    assert.equal(client.sql.options.max_lifetime, null);
    assert.equal(Reflect.get(client.sql.options, "max_pipeline"), 1);
    assert.equal(Object.isFrozen(client.sql.options), true);
    assert.equal(Object.isFrozen(client), true);
    assert.deepEqual(client.observe(), { nativeSocketCreations: 0, revoked: false });
    assert.equal(Object.isFrozen(client.observe()), true);
  } finally { await client.close(); }
});

test("synchronous revoke and close forbid captured lazy SQL before native allocation", { timeout: 5000 }, async () => {
  for (const closeFirst of [false, true]) {
    const client = createTask6aSingleBackendSocketClientV1(candidate), captured = client.sql;
    const closing = closeFirst ? client.close() : undefined;
    if (!closeFirst) client.revoke();
    assert.equal(client.observe().revoked, true);
    await assert.rejects(captured.unsafe("SELECT 1"));
    assert.equal(client.observe().nativeSocketCreations, 0);
    await closing; await client.close(); await client.close();
  }
});

test("driver hidden LISTEN client is refused before any native allocation", { timeout: 5000 }, async () => {
  const client = createTask6aSingleBackendSocketClientV1(candidate);
  try {
    await assert.rejects(client.sql.listen("task6a_hidden_client_unit", () => {}), /TASK6A_SINGLE_BACKEND_SOCKET_REFUSED/);
    assert.deepEqual(client.observe(), { nativeSocketCreations: 0, revoked: true });
  } finally { await client.close(); }
});

test("single backend refuses caller hooks, wrong peer and ambient credentials", () => {
  assert.throws(() => createTask6aSingleBackendSocketClientV1(candidate, {} as (channel: string, payload: string) => void),
    /TASK6A_SINGLE_BACKEND_SOCKET_REFUSED/);
  assert.throws(() => createTask6aSingleBackendSocketClientV1({ ...candidate, osUid: candidate.osUid + 1 }),
    /TASK6A_SINGLE_BACKEND_SOCKET_REFUSED/);
  process.env.PGPASSWORD = "fixture-sentinel";
  try { assert.throws(() => createTask6aSingleBackendSocketClientV1(candidate), /TASK6A_SINGLE_BACKEND_SOCKET_REFUSED/); }
  finally { delete process.env.PGPASSWORD; }
});

test("native error revokes synchronously before close even after connect completed", async () => {
  const peers = new Set<net.Socket>();
  const server = net.createServer(peer => { peers.add(peer); peer.on("error", () => {}); });
  server.listen(`${home}/.s.PGSQL.55439`); await once(server, "listening");
  const client = createTask6aSingleBackendSocketClientV1(candidate);
  try {
    // Exercise the actual owned native factory, not a PG protocol substitute.
    const factory = Reflect.get(client.sql.options, "socket") as (options: unknown) => Promise<net.Socket>;
    const opened = await factory(client.sql.options);
    assert.equal(client.observe().revoked, false);
    assert.doesNotThrow(() => opened.emit("error", Error("unit-native-error")));
    assert.equal(client.observe().revoked, true);
    assert.equal(opened.destroyed, true);
  } finally {
    await client.close(); for (const peer of peers) peer.destroy();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("notification callback throws and async returns both revoke without unhandled rejection", async () => {
  for (const callback of [() => { throw Error("unit-callback-error"); },
    () => Promise.reject(Error("unit-async-callback-error"))]) {
    const client = createTask6aSingleBackendSocketClientV1(candidate, callback);
    try {
      const notify = Reflect.get(client.sql.options, "onnotify") as (channel: string, payload: string) => void;
      assert.doesNotThrow(() => notify("unit", "payload"));
      assert.equal(client.observe().revoked, true);
      await new Promise(resolve => setImmediate(resolve));
    } finally { await client.close(); }
  }
});
