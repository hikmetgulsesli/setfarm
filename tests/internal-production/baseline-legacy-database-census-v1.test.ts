import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("shared legacy census is import-inert and never adopts an ambient database URL", () => {
  const url = new URL("../../src/internal-production/baseline-legacy-database-census-v1.ts", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import fs from 'node:fs';import net from 'node:net';import {syncBuiltinESMExports} from 'node:module';
    let writes=0,connections=0;
    for(const name of ['writeFileSync','mkdirSync','renameSync','unlinkSync','rmdirSync','linkSync','chmodSync','fsyncSync'])fs[name]=()=>{writes++;throw Error('UNEXPECTED_CENSUS_WRITE')};
    net.Socket.prototype.connect=()=>{connections++;throw Error('UNEXPECTED_CENSUS_CONNECTION')};
    syncBuiltinESMExports();
    const module=await import(${JSON.stringify(url)});
    let error;try{await module.observeLegacyDatabaseCensusV1(undefined,true)}catch(caught){error=caught.message}
    process.stdout.write(JSON.stringify({error,writes,connections}));
  `], { encoding: "utf8", timeout: 15000, env: { SETFARM_PG_URL: "postgresql://PRIVATE_AMBIENT_CANARY@127.0.0.1/setfarm" } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    error: "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:legacy zero-owner database is unavailable", writes: 0, connections: 0,
  });
});

for (const scenario of ["ambient-port", "ambiguous-host"]) {
  test(`cutover profile rejects ${scenario} before any real driver connection`, () => {
    const url = new URL("../../src/internal-production/baseline-legacy-database-census-v1.ts", import.meta.url).href;
    const databaseUrl = scenario === "ambiguous-host"
      ? "postgresql://u:p@remote.invalid,other.invalid@localhost/setfarm"
      : "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm";
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import net from 'node:net';import{syncBuiltinESMExports}from'node:module';
      let connections=0;net.Socket.prototype.connect=()=>{connections++;throw Error('UNEXPECTED_DRIVER_CONNECTION')};syncBuiltinESMExports();
      const module=await import(${JSON.stringify(url)});let error;
      try{await module.observeLegacyDatabaseCensusV1(${JSON.stringify(databaseUrl)},true,'cutover-local')}catch(caught){error=caught.message}
      process.stdout.write(JSON.stringify({error,connections}));
    `], { encoding: "utf8", timeout: 15000, env: scenario === "ambient-port" ? { PGPORT: "6543" } : {} });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      error: "INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:cutover database target is ambiguous", connections: 0,
    });
  });
}

test("cutover profile validates real driver options before one read-only transaction and bounded close", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-driver-")));
  try {
    const original = new URL("../../src/internal-production/baseline-legacy-database-census-v1.ts", import.meta.url);
    let source = fs.readFileSync(original, "utf8");
    const marker = 'const postgresModule = await import("postgres");';
    assert.equal(source.split(marker).length, 2);
    source = source.replace(marker, `
      const actualModule=await import(${JSON.stringify(new URL("../../node_modules/postgres/src/index.js", import.meta.url).href)});
      const postgresModule={default:(...args)=>{
        const sql=actualModule.default(...args),end=sql.end;
        globalThis.probe.target={host:sql.options.host,port:sql.options.port,database:sql.options.database};
        sql.begin=async mode=>{globalThis.probe.modes.push(mode);throw Error('TRANSACTION_BOUNDARY_REACHED')};
        sql.end=async options=>{globalThis.probe.closes.push(options);return end(options)};
        return sql;
      }};
    `).replace('await import("../findings/finding-publication-v1.js")',
      `await import(${JSON.stringify(new URL("../../src/findings/finding-publication-v1.ts", import.meta.url).href)})`);
    fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
    const file = path.join(root, "census.ts"); fs.writeFileSync(file, source);
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import net from 'node:net';import{syncBuiltinESMExports}from'node:module';
      globalThis.probe={modes:[],closes:[],connections:0};
      net.Socket.prototype.connect=()=>{globalThis.probe.connections++;throw Error('UNEXPECTED_CONNECTION')};syncBuiltinESMExports();
      const module=await import(${JSON.stringify(pathToFileURL(file).href)});let error;
      try{await module.observeLegacyDatabaseCensusV1('postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm',true,'cutover-local')}catch(caught){error=caught.message}
      process.stdout.write(JSON.stringify({error,...globalThis.probe}));
    `], { encoding: "utf8", timeout: 15000, env: {} });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      error: "TRANSACTION_BOUNDARY_REACHED", modes: ["isolation level repeatable read read only"],
      closes: [{ timeout: 1 }], connections: 0, target: { host: ["localhost"], port: [5432], database: "setfarm" },
    });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
