import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { userInfo } from "node:os";
import { after } from "node:test";
import { fixture, write } from "./deployment-cutover-bootstrap.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
// One stable per-worker base: individual fixtures must not churn account HOME
// while another worker holds an ancestor optional-package absence there.
let suiteParent;
export function resolutionFixtureParent() {
  return suiteParent ??= fs.realpathSync(fs.mkdtempSync(path.join(userInfo().homedir, ".cutover-retained-suite-")));
}
after(() => { if (suiteParent) fs.rmSync(suiteParent, { recursive: true, force: true }); });
export function retainedFixture(body, { genuine = false, nested = false, conditional = false, nearerShadow = false, resolution = false, phaseClosure = false,
  bootstrapInstrument = source => source, controllerOptions = {} } = {}) {
  const temporaryParent = resolution ? resolutionFixtureParent() : undefined;
  let selected, expectedProfile;
  fixture((root, _build, home) => {
    const observe = (instrument = "", expression = "await module.observeDeploymentCutoverRetainedProfileV1()") => spawnSync(process.execPath, ["--input-type=module", "-e", `
      import os from 'node:os';import fs from 'node:fs';import net from 'node:net';import {syncBuiltinESMExports} from 'node:module';
      const identity=os.userInfo();os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});
      net.Socket.prototype.connect=()=>{throw Error('UNEXPECTED_CONNECTION')};
      ${instrument}
      syncBuiltinESMExports();const module=await import('./scripts/deployment-cutover-retained-profile.mjs');
      try{const observation=${expression};
        const frozen=value=>!value||typeof value!=='object'||(Object.isFrozen(value)&&Object.values(value).every(frozen));
        if(!frozen(observation))throw Error('MUTABLE_OBSERVATION');process.stdout.write(JSON.stringify(observation));}
      catch(error){process.stderr.write(error.message);process.exitCode=1;}
    `], { cwd: root, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, encoding: "utf8", timeout: 30000 });
    body({ root, home, selected, expectedProfile, observe });
  }, bootstrapInstrument, { ...controllerOptions, genuine, temporaryParent, prepare(root, home) {
    fixture((oldRoot, oldBuild) => {
      selected = path.join(home, "ai/setrox/old"); fs.renameSync(oldRoot, selected);
      fs.mkdirSync(path.join(home, ".local/bin"), { recursive: true, mode: 0o755 });
      fs.symlinkSync(path.join(selected, "dist/cli/cli.js"), path.join(home, ".local/bin/setfarm"));
      const bytes = Buffer.from('throw Error("RETAINED_PACKAGE_MUST_NOT_EXECUTE");\n');
      write(selected, "node_modules/reviewed-fixture/index.js", bytes);
      const inventory = [{ locator: "index.js", byteLength: bytes.length, sha256: sha256(bytes) }];
      const additional = conditional ? [
        ["package.json", Buffer.from(JSON.stringify({ name: "reviewed-fixture", type: "module", exports: { import: "./index.js", require: "./require.cjs" } }))],
        ["require.cjs", bytes],
      ] : [];
      for (const [locator, content] of additional) {
        write(selected, `node_modules/reviewed-fixture/${locator}`, content);
        inventory.push({ locator, byteLength: content.length, sha256: sha256(content) });
      }
      inventory.sort((a, b) => Buffer.compare(Buffer.from(a.locator), Buffer.from(b.locator)));
      expectedProfile = { schema: "setfarm.internal-production-retained-startup-profile.v1", platform: process.platform, arch: process.arch,
        sourceSha: oldBuild.sha, outputTreeHash: JSON.parse(fs.readFileSync(path.join(selected, "dist/PLATFORM_BUILD_OUTPUT_TREE.json"))).outputTreeHash,
        installations: [{ locator: "node_modules/reviewed-fixture", name: "reviewed-fixture", version: "1.0.0", integrity: `sha512-${"A".repeat(86)}==`,
          fileCount: inventory.length, byteLength: inventory.reduce((sum, entry) => sum + entry.byteLength, 0), inventoryHash: sha256(JSON.stringify(inventory)) }],
        startupResolution: [
          ["esm", "dist/cli/cli.js", "reviewed-fixture", "node_modules/reviewed-fixture/index.js"],
          ["cjs", "dist/cli/cli.js", "reviewed-fixture", `node_modules/reviewed-fixture/${conditional ? "require.cjs" : "index.js"}`],
          ["cjs", "dist/cli/cli.js", "reviewed-absent-optional", null],
        ] };
      if (nested || nearerShadow) {
        const name = nearerShadow ? "reviewed-fixture" : "nested-fixture";
        const locator = `node_modules/reviewed-fixture/node_modules/${name}`;
        write(selected, `${locator}/index.js`, bytes);
        for (const [name, content] of additional) write(selected, `${locator}/${name}`, content);
        expectedProfile.installations.push({ ...expectedProfile.installations[0], locator, name });
        if (nearerShadow) for (const edge of expectedProfile.startupResolution.slice(0, 2)) edge[1] = "node_modules/reviewed-fixture/index.js";
      }
      write(root, "scripts/deployment-cutover-retained-profile.v1.json", JSON.stringify(expectedProfile));
      write(root, "scripts/deployment-cutover-retained-profile.mjs", fs.readFileSync(new URL("../../deployment-cutover-retained-profile.mjs", import.meta.url)));
    }, undefined, { temporaryParent, extraSources: phaseClosure ? { "internal-production/baseline-post-handoff-receipt-v1": "export const inertReceipt = true;\n" } : {} });
    controllerOptions.prepare?.(root, home);
  } });
}
