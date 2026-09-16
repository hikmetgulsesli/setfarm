import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const source = readFileSync(new URL("../build-generation-retention.mjs", import.meta.url), "utf8");
const oid = (bytes, algorithm = "sha1") => createHash(algorithm).update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const ok = stdout => ({ status: 0, signal: null, error: null, stdout, stderr: Buffer.alloc(0) });
async function fixture(spawn, run) {
  const root = mkdtempSync(join(tmpdir(), "setfarm-git-batch-")), key = randomUUID();
  const target = join(root, "retention.mjs");
  globalThis[key] = spawn;
  try {
    writeFileSync(target, source.replace('import { spawnSync } from "node:child_process";',
      `const spawnSync = globalThis[${JSON.stringify(key)}];`) + "\nexport { requireFixedGitBlobsV2 };\n");
    const { requireFixedGitBlobsV2: read } = await import(pathToFileURL(target).href);
    await run(read, root);
  } finally { delete globalThis[key]; rmSync(root, { recursive: true, force: true }); }
}
function responder(objects, mutate = (_, bytes) => bytes) {
  const calls = [];
  return { calls, spawn(executable, args, options) {
    calls.push({ executable, args, options });
    const hashes = Buffer.from(options.input).toString().trimEnd().split("\n");
    const headers = hashes.map(hash => Buffer.from(`${hash} blob ${objects.get(hash).length}\n`));
    const check = args.includes("--batch-check");
    const bytes = check ? Buffer.concat(headers) : Buffer.concat(hashes.flatMap((hash, i) => [headers[i], objects.get(hash), Buffer.from("\n")]));
    return ok(mutate(check ? "check" : "read", bytes));
  } };
}

test("bounded Git batch preserves binary, empty, duplicate and SHA-256 blobs with two children", async () => {
  for (const algorithm of ["sha1", "sha256"]) {
    const payloads = [Buffer.alloc(0), Buffer.from([0, 10, 255, 13]), ...Array.from({ length: 200 }, (_, i) => Buffer.from(`value-${i}`))];
    const objects = new Map(payloads.map(bytes => [oid(bytes, algorithm), bytes]));
    const mock = responder(objects), hashes = [...objects.keys()];
    await fixture(mock.spawn, read => {
      const actual = read("/fixture", [...hashes, hashes[0]]);
      assert.deepEqual(actual, objects);
      assert.equal(mock.calls.length, 2);
      for (const call of mock.calls) {
        assert.equal(call.executable, "/usr/bin/git");
        assert.equal(call.options.shell, false);
        assert.equal(call.options.env.GIT_NO_REPLACE_OBJECTS, "1");
        assert.equal(call.options.env.GIT_OPTIONAL_LOCKS, "0");
        assert.equal(call.options.timeout, 10000);
        assert.ok(call.options.maxBuffer <= 33_554_432 + 1_048_576);
      }
    });
  }
});

for (const kind of ["missing", "wrong-type", "wrong-oid", "reordered", "leading-zero-size", "negative-size", "oversized", "truncated-check", "extra-check", "read-header-drift", "truncated-body", "bad-delimiter", "extra-body", "wrong-body", "child-error", "child-signal", "child-status", "child-stderr", "payload-child-error", "payload-child-signal", "payload-child-status", "payload-child-stderr"]) {
  test(`bounded Git batch refuses ${kind}`, async () => {
    const objects = new Map([Buffer.from("first\0\n"), Buffer.from("second")].map(bytes => [oid(bytes), bytes]));
    const hashes = [...objects.keys()];
    const mock = responder(objects, (phase, bytes) => {
      if (phase === "check") {
        if (kind === "missing") return Buffer.from(`${hashes[0]} missing\n`);
        if (kind === "wrong-type") return Buffer.from(bytes.toString().replace(" blob ", " tree "));
        if (kind === "wrong-oid") return Buffer.from(bytes.toString().replace(hashes[0], "0".repeat(40)));
        if (kind === "reordered") return Buffer.from(bytes.toString().trimEnd().split("\n").reverse().join("\n") + "\n");
        if (kind === "leading-zero-size") return Buffer.from(bytes.toString().replace(" blob 7", " blob 07"));
        if (kind === "negative-size") return Buffer.from(bytes.toString().replace(" blob 7", " blob -1"));
        if (kind === "oversized") return Buffer.from(bytes.toString().replace(" blob 7", " blob 33554433"));
        if (kind === "truncated-check") return bytes.subarray(0, -1);
        if (kind === "extra-check") return Buffer.concat([bytes, Buffer.from("\n")]);
      } else {
        if (kind === "read-header-drift") { const result = Buffer.from(bytes); result[0] = result[0] === 97 ? 98 : 97; return result; }
        if (kind === "truncated-body") return bytes.subarray(0, -2);
        if (kind === "bad-delimiter") { const result = Buffer.from(bytes); result[result.length - 1] = 0; return result; }
        if (kind === "extra-body") return Buffer.concat([bytes, Buffer.from("x")]);
        if (kind === "wrong-body") { const result = Buffer.from(bytes); result[result.indexOf(10) + 1] ^= 1; return result; }
      }
      return bytes;
    });
    await fixture((...args) => {
      const result = mock.spawn(...args);
      const failure = kind.startsWith("payload-") ? (args[1].includes("--batch") ? kind.slice(8) : "") : kind;
      if (failure === "child-error") result.error = Error("failed");
      if (failure === "child-signal") result.signal = "SIGTERM";
      if (failure === "child-status") result.status = 1;
      if (failure === "child-stderr") result.stderr = Buffer.from("warning");
      return result;
    }, read => assert.throws(() => read("/fixture", hashes)));
    if (["missing", "oversized", "wrong-type"].includes(kind)) assert.equal(mock.calls.length, 1);
    if (kind.startsWith("payload-")) assert.equal(mock.calls.length, 2);
  });
}

test("bounded Git batch rejects invalid requests before Git and caps aggregate metadata", async () => {
  let invalidCalls = 0;
  await fixture(() => { invalidCalls++; throw Error("unexpected Git invocation"); }, read => {
    for (const hashes of [[], ["HEAD"], ["a".repeat(40), "b".repeat(64)], Array(10001).fill("a".repeat(40))]) {
      assert.throws(() => read("/fixture", hashes));
    }
    assert.equal(invalidCalls, 0);
  });
  let calls = 0;
  const hashes = Array.from({ length: 17 }, (_, i) => i.toString(16).padStart(40, "0"));
  await fixture(() => { calls++; return ok(Buffer.from(hashes.map(hash => `${hash} blob 33554432\n`).join(""))); }, read => {
    assert.throws(() => read("/fixture", hashes));
    assert.equal(calls, 1);
  });
});

test("bounded Git batch reads actual Git objects and splits file-budget batches", async () => {
  let calls = 0;
  await fixture((...args) => { calls++; return spawnSync(...args); }, (read, root) => {
    const git = (args, input) => {
      const result = spawnSync("/usr/bin/git", args, { cwd: root, input, maxBuffer: 34_000_000 });
      assert.equal(result.status, 0, result.stderr?.toString());
      return result.stdout;
    };
    git(["init", "-q"]);
    const payloads = [Buffer.alloc(33_554_432, 97), Buffer.from("b"), Buffer.alloc(0), Buffer.from([0, 255, 10])];
    const objects = new Map(payloads.map(bytes => [git(["hash-object", "-w", "--stdin"], bytes).toString().trim(), bytes]));
    const hashes = [...objects.keys()];
    assert.deepEqual(read(root, [...hashes, hashes[0]]), objects);
    assert.equal(calls, 3, "one size query plus two byte-budgeted reads");
    for (const [hash, bytes] of objects) assert.deepEqual(git(["cat-file", "blob", hash]), bytes);
  });
});

test("bounded Git batch accepts maximum-entry metadata within the fixed output cap", async () => {
  const objects = new Map(Array.from({ length: 10000 }, (_, i) => {
    const bytes = Buffer.from(String(i)); return [oid(bytes), bytes];
  }));
  const mock = responder(objects);
  await fixture(mock.spawn, read => {
    assert.deepEqual(read("/fixture", [...objects.keys()]), objects);
    assert.equal(mock.calls.length, 2);
  });
});
