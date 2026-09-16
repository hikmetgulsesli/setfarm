import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const reviewedPackages = Object.freeze([
  Object.freeze({ name: "postgres", version: "3.4.8", entry: "src/index.js", members: 37,
    integrity: "sha512-d+JFcLM17njZaOLkv6SCev7uoLaBtfK86vMUXhW1Z4glPWh4jozno9APvW/XKFJ3CCxVoC7OL38BqRydtu5nGg==" }),
  Object.freeze({ name: "zod", version: "4.4.3", entry: "index.js", members: 718,
    integrity: "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ==" }),
]);
// Independently encoded two-member USTAR fixtures, with literal reviewed SRIs.
// Never derive the expected integrity from the archive under test at runtime.
const archives = [
  { integrity: "sha512-AdsRnO01BwGA95MOSrIuwQxMbKyr+GXRK4VXbadV80zkvVYFEk1QCVNrIvgy2m8sUPB//sgZRuzOAgO1JPz/vA==",
    base64: "H4sIAAAAAAAAEytITM5OTE/VL4DQelnF+XkMVAYGBgZmJiYKIBoI0GmgpCmCbWAIZBsamhqC5KntEGygtLgksQhoPT3sGoSgWikvMTdVyUqpIL+4JL0otVhJR6kstag4Mz8PKGisZ6JnARQpqSwAqcnNTynNSVWqHWhHjwKqAWi+1y8uStbPzEtJrQCWANS2g1D+NzXDyP8mYDFqOwQbGOH5vySjKL9cwbWoKL9IQynENTgk3jHI2cMzzDXeNxTI8fMPiXeNcHUODXFV0rTmGmjXjoJRMApGwSigFgAAMzlUSAAMAAA=" },
  { integrity: "sha512-JqZFebxN7jEE8gGGt6RZ4EIa35S5TrzGD8bJz6+ISzHm1Kt/FpxfB1OMzMjhOI96pBPYY43cHCFF/2dGx2WjrA==",
    base64: "H4sIAAAAAAAAEytITM5OTE/VL4DQelnF+XkMVAYGBgZmJiYKIBoI0GmgJBLbwBDINjQ0NTAG0tR2CDZQWlySWAS0nh52DUJQrZSXmJuqZKVUlZ+ipKNUllpUnJmfB+Sb6JnoGQNFSioLQNK5+SmlOalKtQPt3lFAXQDN9/qZeSmpFcDcTws7COV/UzP0/G9gZmY+mv/pAUoyivLLFVyLivKLNJRCXIND4h2DnD08w1zjfUOBHD//kHjXCFfn0BBXJU1rroF27SgYBaNgFIwCagEA7dkdpQAMAAA=" },
];
export const packages = Object.freeze(reviewedPackages.map((item, i) => Object.freeze({ ...item, members: 2, integrity: archives[i].integrity })));
export function cachePath(home, integrity) {
  const hex = Buffer.from(integrity.slice(7), "base64").toString("hex");
  return path.join(home, ".npm/_cacache/content-v2/sha512", hex.slice(0, 2), hex.slice(2, 4), hex.slice(4));
}
export function materialize(root, home, { genuine = false, installed = false } = {}) {
  const contracts = genuine ? reviewedPackages : packages;
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  let source = fs.readFileSync(path.join(sourceRoot, "scripts/deployment-cutover-dependencies.mjs"), "utf8");
  if (!genuine) for (const [i, item] of reviewedPackages.entries()) {
    assert.equal(source.split(item.integrity).length, 2, "reviewed production integrity contract changed");
    source = source.replace(item.integrity, archives[i].integrity);
  }
  fs.writeFileSync(path.join(root, "scripts/deployment-cutover-dependencies.mjs"), source);
  const lock = { lockfileVersion: 3, packages: Object.fromEntries(contracts.map(({ name, version, integrity }) => [`node_modules/${name}`, { version, integrity }])) };
  fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify(lock));
  for (const [i, item] of contracts.entries()) {
    const target = cachePath(home, item.integrity);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (genuine) {
      const cached = cachePath(os.userInfo().homedir, item.integrity);
      assert.ok(fs.existsSync(cached), `Required genuine ${item.name} archive is absent; qualification cannot skip or download it`);
      fs.copyFileSync(cached, target);
    } else fs.writeFileSync(target, Buffer.from(archives[i].base64, "base64"));
  }
  if (installed) for (const item of contracts) {
    const target = path.join(root, "node_modules", item.name);
    if (genuine) fs.cpSync(path.join(sourceRoot, "node_modules", item.name), target, { recursive: true });
    else {
      fs.mkdirSync(path.dirname(path.join(target, item.entry)), { recursive: true });
      fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: item.name, version: item.version, type: "module" }));
      fs.writeFileSync(path.join(target, item.entry), 'throw Error("TEST_ARCHIVE_MUST_NOT_EXECUTE");\n');
    }
  }
  return lock;
}
export function fixture(run, { genuine = false } = {}) {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-dependencies-")));
  const root = path.join(home, "ai/setrox/controller");
  try {
    const lock = materialize(root, home, { genuine });
    run({ root, home, lock, observe(instrument = "", body = `
      const value=module.readCutoverDependencyArchivesV1();
      process.stdout.write(JSON.stringify({exports:Object.keys(module),packages:value.packages.map(p=>({name:p.name,version:p.version,entry:p.entryLocator,
        members:p.members.length,hasEntry:p.members.some(m=>m.locator===p.entryLocator&&m.bytes.length>0)}))}));`) {
      return spawnSync(process.execPath, ["--input-type=module", "-e", `
        import fs from 'node:fs';import os from 'node:os';import {syncBuiltinESMExports} from 'node:module';
        const identity=os.userInfo();os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});
        ${instrument}
        syncBuiltinESMExports();
        try{const module=await import('./scripts/deployment-cutover-dependencies.mjs');${body}}
        catch(error){process.stderr.write(error.message);process.exitCode=1}
      `], { cwd: root, encoding: "utf8", timeout: 10000, env: { PATH: "/usr/bin:/bin" } });
    } });
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
}
