import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture, reviewedPackages } from "../__tests__/fixtures/deployment-cutover-dependencies.mjs";

// Required Mac mini checkpoint. Missing local archives fail; no skip/download.
test("unmodified dependency observer authenticates the genuine reviewed postgres and Zod archives", () => fixture(context => {
  const result = context.observe(`for(const name of ['writeFileSync','mkdirSync','renameSync','unlinkSync','rmdirSync','linkSync','chmodSync','fsyncSync'])fs[name]=()=>{throw Error('UNEXPECTED_WRITE')};`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    exports: ["readCutoverDependencyArchivesV1"],
    packages: reviewedPackages.map(p => ({ name: p.name, version: p.version, entry: `node_modules/${p.name}/${p.entry}`, members: p.members, hasEntry: true })),
  });
}, { genuine: true }));
