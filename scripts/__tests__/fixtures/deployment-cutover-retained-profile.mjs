import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fixture, write } from "./deployment-cutover-bootstrap.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
export function retainedFixture(body, { genuine = false, nested = false } = {}) {
  let selected, expectedProfile;
  fixture((root, _build, home) => {
    const observe = (instrument = "") => spawnSync(process.execPath, ["--input-type=module", "-e", `
      import os from 'node:os';import fs from 'node:fs';import net from 'node:net';import {syncBuiltinESMExports} from 'node:module';
      const identity=os.userInfo();os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});
      net.Socket.prototype.connect=()=>{throw Error('UNEXPECTED_CONNECTION')};
      ${instrument}
      syncBuiltinESMExports();const module=await import('./scripts/deployment-cutover-retained-profile.mjs');
      try{const observation=await module.observeDeploymentCutoverRetainedProfileV1();
        const frozen=value=>!value||typeof value!=='object'||(Object.isFrozen(value)&&Object.values(value).every(frozen));
        if(!frozen(observation))throw Error('MUTABLE_OBSERVATION');process.stdout.write(JSON.stringify(observation));}
      catch(error){process.stderr.write(error.message);process.exitCode=1;}
    `], { cwd: root, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, encoding: "utf8", timeout: 30000 });
    body({ root, home, selected, expectedProfile, observe });
  }, undefined, { genuine, prepare(root, home) {
    fixture((oldRoot, oldBuild) => {
      selected = path.join(home, "ai/setrox/old"); fs.renameSync(oldRoot, selected);
      fs.mkdirSync(path.join(home, ".local/bin"), { recursive: true, mode: 0o755 });
      fs.symlinkSync(path.join(selected, "dist/cli/cli.js"), path.join(home, ".local/bin/setfarm"));
      const bytes = Buffer.from('throw Error("RETAINED_PACKAGE_MUST_NOT_EXECUTE");\n');
      write(selected, "node_modules/reviewed-fixture/index.js", bytes);
      const inventory = [{ locator: "index.js", byteLength: bytes.length, sha256: sha256(bytes) }];
      expectedProfile = { schema: "setfarm.internal-production-retained-startup-profile.v1", platform: process.platform, arch: process.arch,
        sourceSha: oldBuild.sha, outputTreeHash: JSON.parse(fs.readFileSync(path.join(selected, "dist/PLATFORM_BUILD_OUTPUT_TREE.json"))).outputTreeHash,
        installations: [{ locator: "node_modules/reviewed-fixture", name: "reviewed-fixture", version: "1.0.0", integrity: `sha512-${"A".repeat(86)}==`,
          fileCount: 1, byteLength: bytes.length, inventoryHash: sha256(JSON.stringify(inventory)) }] };
      if (nested) {
        const locator = "node_modules/reviewed-fixture/node_modules/nested-fixture";
        write(selected, `${locator}/index.js`, bytes);
        expectedProfile.installations.push({ ...expectedProfile.installations[0], locator, name: "nested-fixture" });
      }
      write(root, "scripts/deployment-cutover-retained-profile.v1.json", JSON.stringify(expectedProfile));
      write(root, "scripts/deployment-cutover-retained-profile.mjs", fs.readFileSync(new URL("../../deployment-cutover-retained-profile.mjs", import.meta.url)));
    });
  } });
}
