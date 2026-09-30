import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { holdTask6aProtectedPostgresDescriptorV1, parseTask6aProtectedPostgresDescriptorV1 }
  from "../../src/internal-production/task6a-protected-postgres-descriptor-v1.js";
import { holdTask6aRootOwnedJsonFileV1 }
  from "../../src/internal-production/task6a-root-owned-json-file-v1.js";

const value = { schema: "setfarm.protected-postgres-endpoint.v1", schemaOwner: "setfarm_owner",
  serverOsUid: 216, runtimeOsGid: 70,
  transport: { schema: "setfarm.postgres-socket-transport.v1", port: 55437,
    socketDirectory: "/Library/Application Support/Setfarm/PostgreSQL/run",
    database: "setfarm", user: "setfarm_runtime", osUid: 70 } };
const bytes = (input: unknown): Buffer => Buffer.from(canonicalJsonStringify(input) + "\n");

test("protected descriptor accepts only canonical cloned deeply frozen data", () => {
  const result = parseTask6aProtectedPostgresDescriptorV1(bytes(value));
  assert.deepEqual(result, value);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.transport), true);
  assert.notEqual(result.transport, value.transport);
});

test("protected descriptor refuses alternate source, role, identity and schema", () => {
  for (const input of [null, [], { ...value, schema: "wrong" }, { ...value, extra: true },
    { ...value, schemaOwner: "setrox" }, { ...value, serverOsUid: 0 },
    { ...value, serverOsUid: 70 }, { ...value, serverOsUid: "216" },
    { ...value, runtimeOsGid: 0 }, { ...value, runtimeOsGid: 1.5 },
    { ...value, runtimeOsGid: 4294967295 }, { ...value, transport: null },
    ...[{ socketDirectory: "/private/tmp/socket" }, { database: "postgres" },
      { user: "setrox" }, { osUid: 0 }, { port: 5432 }, { password: "forbidden" }]
      .map(change => ({ ...value, transport: { ...value.transport, ...change } }))]) {
    assert.throws(() => parseTask6aProtectedPostgresDescriptorV1(bytes(input)),
      /TASK6A_PROTECTED_POSTGRES_DESCRIPTOR_INVALID/);
  }
});

test("protected descriptor refuses duplicate keys, ambiguity and unbounded bytes", () => {
  for (const input of [Buffer.alloc(0), Buffer.alloc(16385, 32),
    Buffer.from(JSON.stringify(value) + "\n"), bytes(value).subarray(0, -1),
    Buffer.concat([bytes(value), Buffer.from("\n")]), Buffer.from('{"schema":1,"schema":2}\n'),
    Buffer.from('{"schema":"\xff"}\n', "latin1"), Buffer.from("[]\n"),
    bytes(value).toString("utf8"), new Uint8Array(bytes(value))]) {
    assert.throws(() => parseTask6aProtectedPostgresDescriptorV1(input as Buffer),
      /TASK6A_PROTECTED_POSTGRES_DESCRIPTOR_INVALID/);
  }
});

test("root file holder refuses real unprivileged and symlink sources without mutation", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-descriptor-unit-"));
  try {
    const file = path.join(home, "descriptor.json"), link = path.join(home, "link.json");
    fs.writeFileSync(file, bytes(value), { mode: 0o444 }); fs.symlinkSync(file, link);
    for (const target of [file, link, file + "/missing", "relative", "/", "/tmp/../file",
      "/Library/Application Support/no\npath", "/Library//wrong"])
      assert.throws(() => holdTask6aRootOwnedJsonFileV1(target), /TASK6A_ROOT_JSON_FILE_REFUSED/);
    assert.deepEqual(fs.readFileSync(file), bytes(value));
    assert.equal(fs.readlinkSync(link), file);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test("production descriptor loader refuses caller-supplied path or options before filesystem use", () => {
  for (const input of [undefined, "/private/tmp/descriptor.json", {}, value])
    assert.throws(() => (holdTask6aProtectedPostgresDescriptorV1 as (...args: unknown[]) => unknown)(input),
      /TASK6A_PROTECTED_POSTGRES_DESCRIPTOR_REFUSED/);
});
