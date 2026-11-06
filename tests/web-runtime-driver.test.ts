import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import net from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import type { RuntimeSession } from "../src/installer/runtime-driver.js";
import { V3_STATIC_SPA_PREVIEW_SOURCE } from "../src/product-compiler/stack-topology-catalog.js";
import { renderRuntimeCommand, WebPreviewRuntimeDriver } from "../src/installer/web-runtime-driver.js";

const root = path.resolve(import.meta.dirname, "..");

test("web runtime driver renders MC-owned host and port into preview command", () => {
  assert.equal(
    renderRuntimeCommand("npm run preview -- --host {{HOST}} --port {{PORT}} --strictPort", "127.0.0.1", 6123),
    "npm run preview -- --host 127.0.0.1 --port 6123 --strictPort",
  );
});

test("web runtime driver can be constructed with default preview command", () => {
  const driver = new WebPreviewRuntimeDriver();
  assert.equal(typeof driver.start, "function");
  assert.equal(typeof driver.waitReady, "function");
  assert.equal(typeof driver.interact, "function");
  assert.equal(typeof driver.captureState, "function");
  assert.equal(typeof driver.stop, "function");
});

test("web runtime capture preserves non-native data-value and exact identity in its serialized DOM expression", async () => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-capture-value-"));
  try {
    // Owned narrow DOM fixture, not a full browser/DOM implementation. Only the
    // page boundary is replaced; captureState serializes and executes real code
    // in a fresh realm without Node/tsx helpers or a local browser dependency.
    const specs = [
      { id: "native", nativeValue: "typed", attributes: { "data-value": "stale" } },
      { id: "native-empty", nativeValue: "", attributes: { "data-value": "fallback forbidden" } },
      { id: "display", attributes: { "data-value": "refreshed" } },
      { id: "empty", attributes: { "data-value": "" } },
      { id: "whitespace", attributes: { "data-value": " \t A > B & C / \n " } },
      { id: "missing", attributes: {} },
      { id: "raw-only", attributes: { value: "raw fallback forbidden" } },
    ];
    const surface = { getAttribute: (name: string) => name === "data-surface-id" ? "SURF_STATUS" : null };
    const elements = specs.map((spec) => {
      const attributes: Record<string, string> = {
        ...spec.attributes,
        "data-observable-refs": `OBS_${spec.id} OBS_SHARED`,
        "data-setfarm-element-ref": `E_${spec.id}`,
        "aria-label": `Status ${spec.id}`,
        role: "status",
      };
      return {
        tagName: "nativeValue" in spec ? "INPUT" : "DIV",
        textContent: "Ready",
        innerText: "Ready",
        ...(Object.hasOwn(spec, "nativeValue") ? { value: spec.nativeValue } : {}),
        getAttribute: (name: string) => attributes[name] ?? null,
        hasAttribute: (name: string) => Object.hasOwn(attributes, name),
        closest: () => surface,
        getBoundingClientRect: () => ({ width: 120, height: 24 }),
      };
    });
    const document = {
      title: "Status",
      body: { innerText: "Ready" },
      querySelectorAll: () => elements,
      querySelector: () => ({ outerHTML: '<main id="root">Ready</main>' }),
      getElementById: () => null,
    };
    const page = {
      waitForLoadState: async () => {},
      screenshot: async () => {},
      url: () => "http://127.0.0.1:3000/status",
      evaluate: async (expression: unknown) => typeof expression === "string"
        ? vm.runInNewContext(expression, { document, getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }) })
        : null,
    };
    const driver = new WebPreviewRuntimeDriver();
    Object.defineProperty(driver, "sessionPage", { value: async () => page });
    const capture = await driver.captureState({
      kind: "browser", sessionId: "value-fixture", workdir,
      host: "127.0.0.1", port: 3000, url: "http://127.0.0.1:3000", startedAt: "2026-11-05T00:00:00.000Z",
    });
    assert.ok(capture.domSnapshotPath);
    const dom = JSON.parse(fs.readFileSync(capture.domSnapshotPath, "utf8"));
    assert.equal(dom.schema, "setfarm.browser-dom-observation.v1");
    assert.deepEqual(dom.elements.map((element: { value: unknown }) => element.value), [
      "typed", "", "refreshed", "", " \t A > B & C / \n ", null, null,
    ]);
    assert.deepEqual(dom.elements[2], {
      actionId: null, controlId: null, observableRefs: ["OBS_display", "OBS_SHARED"],
      surfaceId: null, containingSurfaceId: "SURF_STATUS", role: "status",
      accessibleName: "Status display", visibleText: "Ready", value: "refreshed", visible: true, enabled: true,
    });
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
});

test("web runtime driver preserves one page per runtime session for interaction evidence", () => {
  const source = fs.readFileSync(path.join(root, "src", "installer", "web-runtime-driver.ts"), "utf-8");
  assert.match(source, /private readonly browsers = new Map/);
  assert.match(source, /private readonly pages = new Map/);
  assert.match(source, /async function launchBrowser\(chromium: any\)/);
  assert.match(source, /channel: "chrome"/);
  assert.match(source, /chromium_headless_shell/);
  assert.match(source, /private async sessionPage\(session: RuntimeSession\)/);
  assert.match(source, /const page = await this\.sessionPage\(session\)/);
  assert.match(source, /this\.pages\.delete\(session\.sessionId\)/);
  assert.match(source, /this\.browsers\.delete\(session\.sessionId\)/);

  const interactStart = source.indexOf("async interact(session: RuntimeSession");
  const captureStart = source.indexOf("async captureState(session: RuntimeSession");
  const stopStart = source.indexOf("async stop(session: RuntimeSession");
  assert.notEqual(interactStart, -1);
  assert.notEqual(captureStart, -1);
  assert.notEqual(stopStart, -1);
  const interactBlock = source.slice(interactStart, captureStart);
  const captureBlock = source.slice(captureStart, stopStart);
  assert.doesNotMatch(interactBlock, /chromium\.launch/);
  assert.doesNotMatch(captureBlock, /chromium\.launch/);
});


for (const method of ["GET", "HEAD"] as const) {
  test(`web runtime readiness accepts catalog SPA extensionless HTML routes with ${method}`, { timeout: 10000 }, async (t) => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-html-readiness-"));
    fs.mkdirSync(path.join(workdir, "dist"));
    const html = "<!doctype html><main>owned readiness fixture</main>";
    fs.writeFileSync(path.join(workdir, "dist", "index.html"), html);
    const reservation = net.createServer();
    let child: ChildProcess | undefined;
    let closed: Promise<void> | undefined;
    let stderr = "";
    t.after(async () => {
      if (reservation.listening) await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
      if (child && closed) {
        const original = child;
        if (original.exitCode === null && original.signalCode === null) original.kill("SIGTERM");
        const killTimer = setTimeout(() => {
          if (original.exitCode === null && original.signalCode === null) original.kill("SIGKILL");
        }, 1500);
        let deadline: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([closed, new Promise<never>((_resolve, reject) => {
            deadline = setTimeout(() => reject(new Error("CATALOG_FIXTURE_ORIGINAL_CLOSE_TIMEOUT")), 3000);
          })]);
          assert.ok(original.exitCode !== null || original.signalCode !== null, "original child close must precede fixture cleanup");
        } finally { clearTimeout(killTimer); if (deadline) clearTimeout(deadline); }
      }
      fs.rmSync(workdir, { recursive: true, force: true });
    });
    await new Promise<void>((resolve, reject) => {
      reservation.once("error", reject); reservation.listen(0, "127.0.0.1", resolve);
    });
    const address = reservation.address();
    assert.ok(address && typeof address !== "string");
    const port = address.port;
    await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
    child = spawn(process.execPath, ["-e", V3_STATIC_SPA_PREVIEW_SOURCE, "dist"], {
      cwd: workdir, env: { HOST: "127.0.0.1", PORT: String(port) }, stdio: ["ignore", "ignore", "pipe"],
    });
    closed = new Promise<void>(resolve => child!.once("close", () => resolve()));
    child.stderr?.on("data", chunk => { stderr = (stderr + String(chunk)).slice(-4096); });
    await new Promise<void>((resolve, reject) => { child!.once("spawn", resolve); child!.once("error", reject); });
    const url = `http://127.0.0.1:${port}`;
    const startupDeadline = Date.now() + 3000;
    let listening = false;
    while (Date.now() < startupDeadline && child.exitCode === null && child.signalCode === null) {
      try {
        const response = await fetch(url + "/index.html", { signal: AbortSignal.timeout(200) });
        listening = response.status === 200 && await response.text() === html;
        if (listening) break;
      } catch { /* Original child may not yet have bound its private listener. */ }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(listening, true, `catalog fixture startup: ${stderr}`);
    const session: RuntimeSession = { kind: "browser", sessionId: `readiness-${method}-${port}`, workdir,
      host: "127.0.0.1", port, url, startedAt: new Date().toISOString() };
    const withoutHtml = await fetch(url + "/status", { method, signal: AbortSignal.timeout(500) });
    assert.equal(withoutHtml.status, 404); await withoutHtml.body?.cancel();
    // Independent negatives run before the target assertion on old Source.
    await assert.rejects(new WebPreviewRuntimeDriver({ readinessPath: "/assets/missing.js", readinessMethod: method,
      readinessExpectedStatus: 200, timeoutMs: 50 }).waitReady(session), /HTTP 404; expected 200/);
    await assert.rejects(new WebPreviewRuntimeDriver({ readinessPath: "/index.html", readinessMethod: method,
      readinessExpectedStatus: 201, timeoutMs: 50 }).waitReady(session), /HTTP 200; expected 201/);
    await new WebPreviewRuntimeDriver({ readinessPath: "/status", readinessMethod: method,
      readinessExpectedStatus: 200, timeoutMs: 100 }).waitReady(session);
  });
}
