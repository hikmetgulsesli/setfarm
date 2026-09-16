import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { test } from "node:test";

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
test("reviewed retained profile matches all genuine fixed integrity archives without evaluation", () => {
  const profile = JSON.parse(fs.readFileSync(new URL("../deployment-cutover-retained-profile.v1.json", import.meta.url), "utf8"));
  assert.equal(profile.schema, "setfarm.internal-production-retained-startup-profile.v1");
  assert.equal(profile.platform, "darwin"); assert.equal(profile.arch, "arm64");
  assert.equal(profile.sourceSha, "eef9f6c4059daa487a5a367f8f1609b1d1e39142");
  assert.equal(profile.outputTreeHash, "2cc9696322bb131070560d122a602b73a560fe9e8d26943404c9078094f27054");
  assert.equal(profile.installations.length, 10);
  const lock = JSON.parse(fs.readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"));
  for (const installation of profile.installations) {
    const declared = lock.packages[installation.locator];
    assert.equal(declared.version, installation.version); assert.equal(declared.integrity, installation.integrity);
    assert.match(installation.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
    const hex = Buffer.from(installation.integrity.slice(7), "base64").toString("hex");
    const compressed = fs.readFileSync(path.join(userInfo().homedir, ".npm/_cacache/content-v2/sha512", hex.slice(0, 2), hex.slice(2, 4), hex.slice(4)));
    assert.ok(compressed.length < 4 * 1024 * 1024);
    assert.equal(`sha512-${createHash("sha512").update(compressed).digest("base64")}`, installation.integrity);
    // The archive is authenticated before parsing. This independent test decoder
    // never extracts to disk and is not used by the production physical observer.
    const tar = gunzipSync(compressed, { maxOutputLength: 32 * 1024 * 1024 });
    const members = [], seen = new Set();
    const field = bytes => bytes.toString("ascii").replace(/\0.*$/s, "");
    let terminated = false;
    for (let offset = 0; offset < tar.length;) {
      const header = tar.subarray(offset, offset + 512); assert.equal(header.length, 512);
      if (header.every(byte => byte === 0)) {
        assert.ok(tar.length - offset >= 1024); assert.ok(tar.subarray(offset).every(byte => byte === 0)); terminated = true; break;
      }
      let sum = 0; for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : header[i];
      assert.equal(sum, Number.parseInt(field(header.subarray(148, 156)), 8));
      assert.equal(header[156], 48);
      const prefix = field(header.subarray(345, 500)), name = field(header.subarray(0, 100));
      const full = prefix ? `${prefix}/${name}` : name; assert.match(full, /^package\/[A-Za-z0-9._/-]+$/);
      const locator = full.slice(8); assert.equal(path.posix.normalize(locator), locator);
      assert.ok(!locator.startsWith("../") && !seen.has(locator)); seen.add(locator);
      const byteLength = Number.parseInt(field(header.subarray(124, 136)), 8);
      assert.ok(Number.isSafeInteger(byteLength) && byteLength >= 0 && byteLength < 16 * 1024 * 1024);
      const bytes = tar.subarray(offset + 512, offset + 512 + byteLength); assert.equal(bytes.length, byteLength);
      members.push({ locator, byteLength, sha256: sha256(bytes) });
      offset += 512 + Math.ceil(byteLength / 512) * 512;
    }
    assert.equal(terminated, true); members.sort((a, b) => Buffer.compare(Buffer.from(a.locator), Buffer.from(b.locator)));
    assert.equal(members.length, installation.fileCount, installation.locator);
    assert.equal(members.reduce((total, member) => total + member.byteLength, 0), installation.byteLength, installation.locator);
    assert.equal(sha256(JSON.stringify(members)), installation.inventoryHash, installation.locator);
  }
});
