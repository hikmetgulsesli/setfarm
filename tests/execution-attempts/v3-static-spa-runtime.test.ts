import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { V3_STATIC_SPA_PREVIEW_SOURCE } from "../../src/product-compiler/stack-topology-catalog.js";

const roots = new Set<string>();
const children = new Set<ChildProcess>();

afterEach(async () => {
  for (const child of children) {
    if (child.pid) {
      try { process.kill(-child.pid, "SIGKILL"); } catch { /* already stopped */ }
    }
  }
  children.clear();
  await Promise.all([...roots].map((root) => rm(root, { recursive: true, force: true })));
  roots.clear();
});

async function reservePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function fixture(): Promise<{ root: string; port: number; child: ChildProcess }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "setfarm-v3-static-spa-"));
  roots.add(root);
  const dist = path.join(root, "dist");
  await mkdir(path.join(dist, "assets"), { recursive: true });
  await writeFile(path.join(dist, "index.html"), "<!doctype html><script type=\"module\" src=\"/assets/app.js\"></script><link rel=\"stylesheet\" href=\"/assets/app.css\"><main>ready</main>");
  await writeFile(path.join(dist, "assets", "app.js"), "globalThis.__SETFARM_APP_READY__ = true;\n");
  await writeFile(path.join(dist, "assets", "app.css"), "main { color: rgb(1, 2, 3); }\n");
  await writeFile(path.join(dist, "assets", "unicode \u00f6.txt"), "unicode asset\n");
  await writeFile(path.join(dist, "assets", "media.bin"), Buffer.from("0123456789", "utf8"));
  const port = await reservePort();
  const child = spawn(process.execPath, ["-e", V3_STATIC_SPA_PREVIEW_SOURCE, "dist"], {
    cwd: root,
    detached: true,
    env: { HOST: "127.0.0.1", PORT: String(port) },
    stdio: ["ignore", "ignore", "pipe"],
  });
  children.add(child);
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("spawn", resolve);
  });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      await response.body?.cancel();
      if (response.status === 200) return { root, port, child };
    } catch { /* listener not ready */ }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const diagnostic = await new Promise<string>((resolve) => {
    let value = "";
    child.stderr?.on("data", (chunk) => { value += chunk.toString(); });
    setTimeout(() => resolve(value), 50);
  });
  throw new Error(`static runtime did not start: ${diagnostic}`);
}

async function rawRequest(input: Readonly<{
  port: number;
  path: string;
  method?: string;
  headers?: Record<string, string>;
}>): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port: input.port,
      path: input.path,
      method: input.method ?? "GET",
      headers: input.headers,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.once("error", reject);
      response.once("end", () => resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    request.once("error", reject);
    request.end();
  });
}

async function treeIdentity(root: string): Promise<string> {
  const entries: Array<{ path: string; mode: number; size: number; hash: string | null }> = [];
  const visit = async (current: string): Promise<void> => {
    for (const name of (await readdir(current)).sort()) {
      const absolute = path.join(current, name);
      const info = await stat(absolute);
      const relative = path.relative(root, absolute);
      if (info.isDirectory()) {
        entries.push({ path: `${relative}/`, mode: info.mode & 0o7777, size: info.size, hash: null });
        await visit(absolute);
      } else {
        entries.push({
          path: relative,
          mode: info.mode & 0o7777,
          size: info.size,
          hash: createHash("sha256").update(await readFile(absolute)).digest("hex"),
        });
      }
    }
  };
  await visit(root);
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}

describe("v3 platform-owned static SPA runtime", () => {
  it("serves exact assets, navigation fallback, MIME, HEAD, and byte ranges without writes", async () => {
    const running = await fixture();
    const before = await treeIdentity(path.join(running.root, "dist"));

    const index = await rawRequest({ port: running.port, path: "/" });
    assert.equal(index.status, 200);
    assert.match(String(index.headers["content-type"]), /^text\/html/);
    assert.equal(index.headers["x-content-type-options"], "nosniff");
    assert.match(index.body.toString("utf8"), /src="\/assets\/app\.js"/);

    const javascript = await rawRequest({ port: running.port, path: "/assets/app.js" });
    assert.equal(javascript.status, 200);
    assert.match(String(javascript.headers["content-type"]), /^text\/javascript/);
    assert.match(javascript.body.toString("utf8"), /SETFARM_APP_READY/);

    const head = await rawRequest({ port: running.port, path: "/assets/app.js", method: "HEAD" });
    assert.equal(head.status, 200);
    assert.match(String(head.headers["content-type"]), /^text\/javascript/);
    assert.equal(head.body.length, 0);
    assert.equal(Number(head.headers["content-length"]), Buffer.byteLength("globalThis.__SETFARM_APP_READY__ = true;\n"));

    const css = await rawRequest({ port: running.port, path: "/assets/app.css" });
    assert.equal(css.status, 200);
    assert.match(String(css.headers["content-type"]), /^text\/css/);

    const deepLink = await rawRequest({
      port: running.port,
      path: "/tasks/active",
      headers: { accept: "text/html" },
    });
    assert.equal(deepLink.status, 200);
    assert.match(deepLink.body.toString("utf8"), /<main>ready<\/main>/);

    const unicode = await rawRequest({ port: running.port, path: "/assets/unicode%20%C3%B6.txt" });
    assert.equal(unicode.status, 200);
    assert.equal(unicode.body.toString("utf8"), "unicode asset\n");

    for (const [range, expected] of [
      ["bytes=2-5", "2345"],
      ["bytes=7-", "789"],
      ["bytes=-3", "789"],
    ] as const) {
      const response = await rawRequest({
        port: running.port,
        path: "/assets/media.bin",
        headers: { range },
      });
      assert.equal(response.status, 206);
      assert.equal(response.body.toString("utf8"), expected);
      assert.match(String(response.headers["content-range"]), /^bytes /);
    }

    assert.equal(await treeIdentity(path.join(running.root, "dist")), before);
  });

  it("fails closed for traversal, missing assets, unsupported methods, and malformed ranges", async () => {
    const running = await fixture();
    for (const target of [
      "/../secret",
      "/%2e%2e/secret",
      "/%2e%2e%2fsecret",
      "/%252e%252e/secret",
      "/..%5csecret",
      "/%00secret",
    ]) {
      const response = await rawRequest({ port: running.port, path: target });
      assert.equal(response.status, 404, target);
      assert.equal(response.body.toString("utf8").includes(running.root), false);
    }
    const missingAsset = await rawRequest({
      port: running.port,
      path: "/assets/missing.js",
      headers: { accept: "text/html" },
    });
    assert.equal(missingAsset.status, 404);
    const api = await rawRequest({ port: running.port, path: "/api/tasks", headers: { accept: "application/json" } });
    assert.equal(api.status, 404);
    const post = await rawRequest({ port: running.port, path: "/", method: "POST" });
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, "GET, HEAD");
    for (const range of ["bytes=", "bytes=2-3,5-6", "bytes=99-100", "items=0-1"]) {
      const response = await rawRequest({
        port: running.port,
        path: "/assets/media.bin",
        headers: { range },
      });
      assert.equal(response.status, 416, range);
      assert.equal(response.headers["content-range"], "bytes */10");
    }
  });
});
