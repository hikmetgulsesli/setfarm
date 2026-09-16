import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { fixture, write } from "../__tests__/fixtures/deployment-cutover-bootstrap.mjs";
import { resolutionFixtureParent } from "../__tests__/fixtures/deployment-cutover-retained-profile.mjs";

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const reviewedProfile = () => JSON.parse(fs.readFileSync(new URL("../deployment-cutover-retained-profile.v1.json", import.meta.url), "utf8"));
function readGenuineArchives(profile) {
  const archives = [];
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
    // is not used by the production physical observer. Tests may materialize
    // authenticated regular members only into their private owned fixture.
    const tar = gunzipSync(compressed, { maxOutputLength: 32 * 1024 * 1024 });
    const members = [], payloads = [], seen = new Set();
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
      payloads.push({ locator, bytes: Buffer.from(bytes) });
      offset += 512 + Math.ceil(byteLength / 512) * 512;
    }
    assert.equal(terminated, true); members.sort((a, b) => Buffer.compare(Buffer.from(a.locator), Buffer.from(b.locator)));
    assert.equal(members.length, installation.fileCount, installation.locator);
    assert.equal(members.reduce((total, member) => total + member.byteLength, 0), installation.byteLength, installation.locator);
    assert.equal(sha256(JSON.stringify(members)), installation.inventoryHash, installation.locator);
    archives.push({ locator: installation.locator, members: payloads });
  }
  return archives;
}
test("reviewed retained profile matches all genuine fixed integrity archives without evaluation", () => {
  const profile = reviewedProfile();
  assert.equal(profile.schema, "setfarm.internal-production-retained-startup-profile.v1");
  assert.equal(profile.platform, "darwin"); assert.equal(profile.arch, "arm64");
  assert.equal(profile.sourceSha, "eef9f6c4059daa487a5a367f8f1609b1d1e39142");
  assert.equal(profile.outputTreeHash, "2cc9696322bb131070560d122a602b73a560fe9e8d26943404c9078094f27054");
  assert.equal(profile.installations.length, 10); readGenuineArchives(profile);
});

for (const mismatch of [false, true]) {
  test(`genuine held startup resolution ${mismatch ? "rejects crossed target" : "qualifies all 29 reviewed edges without evaluation"}`, () => {
    const profile = reviewedProfile(), archives = readGenuineArchives(profile);
    assert.equal(profile.startupResolution.length, 29);
    const extraSources = Object.fromEntries(profile.startupResolution.filter(edge => edge[1].startsWith("dist/"))
      .map(edge => [edge[1].slice(5, -3), 'throw Error("GENUINE_PARENT_MUST_NOT_EXECUTE");export {};\n']));
    fixture((root, _build, home) => {
      const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
        import os from 'node:os';import {syncBuiltinESMExports} from 'node:module';
        const identity=os.userInfo();os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});syncBuiltinESMExports();
        const module=await import('./scripts/deployment-cutover-retained-profile.mjs');let held;
        try{
          held=module.holdDeploymentCutoverRetainedProfileV1();
          if(${JSON.stringify(mismatch)}){
            let refused=false;try{held.resolveModules()}catch{refused=true}finally{try{held.close()}catch{}}
            process.stdout.write(JSON.stringify({inventorySucceeded:true,resolutionRefused:refused}));
          }else{const result=held.resolveModules();held.recheck();held.close();process.stdout.write(JSON.stringify(result))}
        }
        catch{try{held?.close()}catch{}process.stderr.write('GENUINE_RESOLUTION_REFUSED');process.exitCode=1}
      `], { cwd: root, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, encoding: "utf8", timeout: 60000 });
      assert.equal(result.status, 0, result.stderr);
      if (mismatch) { assert.deepEqual(JSON.parse(result.stdout), { inventorySucceeded: true, resolutionRefused: true }); return; }
      const observation = JSON.parse(result.stdout);
      assert.equal(observation.scope, "reviewed-selected-startup-resolution-only");
      assert.deepEqual(observation.contexts.map(context => context.home), ["absent", "account"]);
      for (const context of observation.contexts) assert.deepEqual(context.targets, profile.startupResolution.map(edge => edge[3]));
    }, undefined, { temporaryParent: resolutionFixtureParent(), prepare(root, home) {
      fixture((oldRoot, oldBuild) => {
        const selected = path.join(home, "ai/setrox/old"); fs.renameSync(oldRoot, selected);
        fs.mkdirSync(path.join(home, ".local/bin"), { recursive: true, mode: 0o755 });
        fs.symlinkSync(path.join(selected, "dist/cli/cli.js"), path.join(home, ".local/bin/setfarm"));
        for (const archive of archives) for (const member of archive.members) write(selected, `${archive.locator}/${member.locator}`, member.bytes);
        const fixtureProfile = { ...profile, sourceSha: oldBuild.sha, platform: process.platform, arch: process.arch,
          outputTreeHash: JSON.parse(fs.readFileSync(path.join(selected, "dist/PLATFORM_BUILD_OUTPUT_TREE.json"))).outputTreeHash };
        if (mismatch) fixtureProfile.startupResolution = profile.startupResolution.map((edge, index) => index === 3
          ? [edge[0], edge[1], edge[2], "node_modules/postgres/cjs/src/index.js"] : edge);
        write(root, "scripts/deployment-cutover-retained-profile.v1.json", JSON.stringify(fixtureProfile));
      }, undefined, { extraSources, temporaryParent: resolutionFixtureParent() });
    } });
  });
}
