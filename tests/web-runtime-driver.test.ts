import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderRuntimeCommand, WebPreviewRuntimeDriver } from "../dist/installer/web-runtime-driver.js";

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

test("web runtime driver preserves one page per runtime session for interaction evidence", () => {
  const source = fs.readFileSync(path.join(root, "src", "installer", "web-runtime-driver.ts"), "utf-8");
  assert.match(source, /private readonly browsers = new Map/);
  assert.match(source, /private readonly pages = new Map/);
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
