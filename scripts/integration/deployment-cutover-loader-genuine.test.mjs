import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fixture, run } from "../__tests__/fixtures/deployment-cutover-bootstrap.mjs";

test("authenticated bootstrap denies genuine CommonJS js members before evaluation", () => fixture(root => {
  const result = run(root); assert.equal(result.status, 1); assert.equal(result.stdout, "");
  assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED\n");
}, source => source.replace('const owner = await import', `await import('../node_modules/postgres/cjs/src/index.js');const owner = await import`)
  .replace('check(); return { format: "module",', 'check(); if(entry.locator.startsWith("node_modules/postgres/cjs/"))process.stdout.write("COMMONJS_MEMBER_EVALUATED"); return { format: "module",'), { genuine: true }));

test("authenticated bootstrap loads genuine postgres and Zod without opening a database connection", () => fixture((root, expected, home) => {
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const value = JSON.parse(result.stdout);
  assert.deepEqual(value.sourceBuild, expected);
  assert.deepEqual(value.dependencyProbe, { postgresType: "function", parsed: "ok" });
  assert.equal(fs.existsSync(path.join(home, "ai/setrox/data")), false);
}, source => source.replace('const closure = ', `import net from 'node:net';net.Socket.prototype.connect=()=>{throw Error('UNEXPECTED_DATABASE_CONNECTION')};syncBuiltinESMExports();\nconst closure = `)
  .replace('const owner = await import', `const pg=await import('postgres'),zod=await import('zod');
    const dependencyProbe={postgresType:typeof pg.default,parsed:zod.z.string().parse('ok')};
    const owner = await import`)
  .replace('controllerSourceHash: authority.controllerSourceHash,', 'controllerSourceHash: authority.controllerSourceHash, dependencyProbe,'), { genuine: true }));
