import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { holdTask6aSocketPhysicalEvidenceV1, holdTask6aProtectedPostgresSocketV1 }
  from "../../src/internal-production/task6a-socket-physical-evidence-v1.js";

const uid = process.getuid!(), gid = process.getgid!();
const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "sf-sp.")));
const candidate = { schema: "setfarm.postgres-socket-transport.v1", socketDirectory: home,
  port: 55439, database: "setfarm_fixture", user: "task6a_runtime", osUid: uid };
const serverUid = uid === 216 ? 217 : 216;
process.on("exit", () => fs.rmSync(home, { recursive: true, force: true }));
const refused = /TASK6A_SOCKET_PHYSICAL_REFUSED/;

test("physical socket holder refuses extra args before inspecting paths", () => {
  assert.throws(() => Reflect.apply(holdTask6aSocketPhysicalEvidenceV1, undefined,
    [candidate, serverUid, gid, "caller-override"]), refused);
});
test("physical socket holder refuses unsafe or nonseparate server identities", () => {
  for (const value of [0, uid, -1, 4294967295, NaN, 1.5])
    assert.throws(() => holdTask6aSocketPhysicalEvidenceV1(candidate, value, gid), refused);
});
test("physical socket holder refuses transport or runtime identity mismatch", () => {
  for (const transport of [{ ...candidate, osUid: uid + 1 }, { ...candidate, extra: true },
    { ...candidate, socketDirectory: `${home}/../override` }])
    assert.throws(() => holdTask6aSocketPhysicalEvidenceV1(transport, serverUid, gid), refused);
  assert.throws(() => holdTask6aSocketPhysicalEvidenceV1(candidate, serverUid, gid + 1), refused);
});
test("unprivileged ordinary directory and regular fake socket never authenticate", () => {
  fs.chmodSync(home, 0o710);
  fs.writeFileSync(path.join(home, ".s.PGSQL.55439"), "not-a-socket", { mode: 0o777 });
  assert.throws(() => holdTask6aSocketPhysicalEvidenceV1(candidate, serverUid, gid), refused);
});
test("fixed production socket loader denies arguments and missing protected authority", () => {
  assert.throws(() => Reflect.apply(holdTask6aProtectedPostgresSocketV1, undefined, [candidate]),
    /TASK6A_PROTECTED_POSTGRES_SOCKET_REFUSED/);
  // Read-only missing-authority assertion only; never install production state.
  if (!fs.existsSync("/Library/Application Support/Setfarm/authority/platform-postgres-endpoint-v1.json"))
    assert.throws(() => holdTask6aProtectedPostgresSocketV1(), /TASK6A_PROTECTED_POSTGRES_SOCKET_REFUSED/);
});
