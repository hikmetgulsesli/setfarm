import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

// Real compiler results only. No emitted target is evaluated by these tests.
const target = new URL("./task6a-cold-native-emission-v1.ts", import.meta.url);
const helper = fs.existsSync(target) ? await import(target.href) : undefined;
const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
const entrySource = path.join(sourceRoot, "tests/execution-attempts/task6a-native-closed-probe-entry.ts");
const probeSource = path.join(sourceRoot, "src/internal-production/task6a-protected-postgres-backend-probe-v1.ts");
const canonicalSource = path.join(sourceRoot, "src/db/contract-spine-migrations.ts");
function directory(): string {
  return fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "cold-emit."));
}
function staticClosure(metadata: esbuild.Metafile, start: string): Set<string> {
  const seen = new Set<string>();
  function visit(member: string): void {
    if (seen.has(member)) return;
    seen.add(member);
    assert.ok(metadata.outputs[member], "missing emitted member");
    for (const edge of metadata.outputs[member]!.imports)
      if (!edge.external && edge.kind === "import-statement") visit(edge.path);
  }
  visit(start); return seen;
}

// Removing splitting must make the actual canonical initialization statically
// reachable. The fallback is the existing private compiler, not a modeled graph.
test("actual native compiler keeps canonical outside the entire static entry closure", async () => {
  const outputDirectory = path.join(directory(), "out");
  const result = helper ? await helper.emitTask6aColdNativeV1(outputDirectory) : await esbuild.build({
    entryPoints: [entrySource], absWorkingDir: sourceRoot, outdir: outputDirectory,
    bundle: true, platform: "node", format: "esm", write: false, metafile: true,
    absPaths: ["metafile"], logLevel: "silent",
    plugins: [{ name: "existing-private-holder-only", setup(build) {
      build.onResolve({ filter: /^\.\/task6a-socket-physical-evidence-v1\.js$/ }, args =>
        args.importer === probeSource ? { path: entrySource } : undefined);
    } }],
  });
  const metadata: esbuild.Metafile = result.metafile!;
  const entry = Object.entries(metadata.outputs).filter(([, value]) => value.entryPoint === entrySource);
  const canonical = Object.entries(metadata.outputs).filter(([, value]) =>
    (value.inputs[canonicalSource]?.bytesInOutput ?? 0) > 0);
  const probe = Object.entries(metadata.outputs).filter(([, value]) =>
    (value.inputs[probeSource]?.bytesInOutput ?? 0) > 0);
  assert.equal(entry.length, 1); assert.equal(canonical.length, 1);
  assert.equal(staticClosure(metadata, entry[0]![0]).has(canonical[0]![0]), false,
    "canonical initializer must not be in any statically reachable entry/shared output");
  assert.equal(probe.length, 1);
  assert.equal(staticClosure(metadata, entry[0]![0]).has(probe[0]![0]), false,
    "probe module must remain deferred until native passive hooks are installed");
  assert.equal(fs.existsSync(outputDirectory), false, "compile/validate must not publish outputs");
  if (helper) {
    assert.equal(result.entryPath, entry[0]![0]);
    assert.equal(result.canonicalPath, canonical[0]![0]);
    assert.deepEqual(result.outputs.map((output: { path: string }) => output.path).sort(),
      Object.keys(metadata.outputs).sort(), "all returned byte outputs required, not a vacuous hash loop");
    for (const output of result.outputs) {
      assert.equal(output.contents.byteLength, metadata.outputs[output.path]!.bytes);
      assert.equal(output.sha256, createHash("sha256").update(output.contents).digest("hex"));
    }
  }
});

test("actual compiler binds physical baseline bridge and all genuine verifier owners", async () => {
  const result = await helper!.emitTask6aColdNativeV1(path.join(directory(), "out"));
  const metadata: esbuild.Metafile = result.metafile;
  const bridge = path.join(sourceRoot, "tests/execution-attempts/task6a-native-baseline-observer-bridge-v1.ts");
  const observer = path.join(sourceRoot, "tests/execution-attempts/task6a-native-baseline-observer-v1.ts");
  assert.ok(Object.hasOwn(metadata.inputs, bridge), "genuine physical baseline bridge input required");
  const owners = ["contract-spine-runtime-access-readonly-verifier-v1", "base-schema-readonly-verifier-v1",
    "public-object-owner-readonly-verifier-v1"].map(name => path.join(sourceRoot, "src/db", name + ".ts"));
  for (const input of [bridge, observer, ...owners]) {
    assert.ok(Object.hasOwn(metadata.inputs, input), "genuine nominated input required: " + input);
    assert.equal(Object.values(metadata.outputs).filter(output => (output.inputs[input]?.bytesInOutput ?? 0) > 0).length, 1,
      "one positive genuine input contribution required: " + input);
  }
  for (const owner of owners) {
    const name = path.basename(owner, ".ts");
    const routed = metadata.inputs[probeSource]!.imports.filter(edge => edge.original === `../db/${name}.js`);
    assert.equal(routed.length, 1); assert.equal(routed[0]!.path, bridge);
    assert.equal(routed[0]!.kind, "import-statement"); assert.ok(!routed[0]!.external);
    const genuine = metadata.inputs[bridge]!.imports.filter(edge => edge.original === `../../src/db/${name}.js`);
    assert.equal(genuine.length, 1); assert.equal(genuine[0]!.path, owner);
    assert.equal(genuine[0]!.kind, "import-statement"); assert.ok(!genuine[0]!.external);
  }
});

async function fixture(mode: "lazy" | "eager" | "shared" | "external" | "computed" | "hooks") {
  const root = directory(), outputDirectory = path.join(root, "out");
  const entrySource = path.join(root, "entry.ts"), probeSource = path.join(root, "probe.ts");
  const canonicalSource = path.join(root, "contract-spine-migrations.ts");
  fs.writeFileSync(canonicalSource, "export const singleton={value:41}; console.log('canonical initializer');\n", { flag: "wx", mode: 0o600 });
  const lazy = "export async function probe(){return (await import('../db/contract-spine-migrations.js')).singleton;}\n";
  const probe = mode === "eager" ? "import {singleton} from '../db/contract-spine-migrations.js'; export function probe(){return singleton;}\n"
    : mode === "computed" ? lazy + "export function dynamic(p:string){return import(p);}\n" : lazy;
  fs.writeFileSync(probeSource, probe, { flag: "wx", mode: 0o600 });
  fs.writeFileSync(entrySource, (mode === "computed" ? "export {probe,dynamic} from './probe.js';\n"
    : "export {probe} from './probe.js';\n") + (mode === "shared"
    ? "export {singleton} from './contract-spine-migrations.js';\n"
    : mode === "external" ? "export {value} from 'foreign-runtime';\n"
    : mode === "hooks" ? "import {registerHooks as passiveHooks} from 'node:module'; export {passiveHooks};\n" : ""), { flag: "wx", mode: 0o600 });
  const result = await esbuild.build({ entryPoints: [entrySource], absWorkingDir: root,
    outdir: outputDirectory, bundle: true, platform: "node", format: "esm", splitting: true,
    write: false, metafile: true, absPaths: ["metafile"], logLevel: "silent",
    external: mode === "external" ? ["foreign-runtime"] : [],
    plugins: [{ name: "tiny-genuine-compiler-relative-owner", setup(build) {
      build.onResolve({ filter: /^\.\.\/db\/contract-spine-migrations\.js$/ }, args =>
        args.importer === probeSource ? { path: canonicalSource } : undefined);
    } }],
  });
  return { result, nomination: { outputDirectory, entrySource, probeSource, canonicalSource } };
}
function validate(result: esbuild.BuildResult, nomination: Record<string, string>): any {
  assert.equal(typeof helper?.validateTask6aColdEmissionV1, "function", "cold graph validator is missing");
  return helper!.validateTask6aColdEmissionV1(result, nomination);
}
test("genuine tiny lazy graph is accepted without executing or publishing it", async () => {
  const { result, nomination } = await fixture("lazy");
  const validated = validate(result, nomination);
  assert.equal(validated.outputs.length, result.outputFiles!.length);
  assert.equal(fs.existsSync(nomination.outputDirectory), false);
});
test("ordinary compiler fixture works without a TMPDIR environment variable", () => {
  const environment = { ...process.env };
  delete environment.TMPDIR;
  delete environment.NODE_TEST_CONTEXT;
  const inherited: string[] = [];
  for (let i = 0; i < process.execArgv.length; i++) {
    const argument = process.execArgv[i]!;
    if (["--import", "--loader", "--require", "-r"].includes(argument)) {
      inherited.push(argument, process.execArgv[++i]!);
    } else if (/^--(?:import|loader|require)=/.test(argument)
      || ["--experimental-strip-types", "--experimental-transform-types"].includes(argument)) inherited.push(argument);
  }
  const original = spawnSync(process.execPath, [...inherited, "--test",
    "--test-name-pattern=^genuine tiny lazy graph is accepted without executing or publishing it$",
    fileURLToPath(import.meta.url)], { cwd: sourceRoot, env: environment, maxBuffer: 1024 * 1024 });
  assert.equal(original.error, undefined);
  assert.equal(original.signal, null);
  assert.equal(original.status, 0, `actual selected compiler fixture must pass:\n${original.stdout}\n${original.stderr}`);
  assert.match(original.stdout.toString(), /\bpass 1(?:\r?\n|$)/);
  assert.match(original.stdout.toString(), /\bfail 0(?:\r?\n|$)/);
});
test("genuine graph permits only the named passive module hook API without invoking it", async () => {
  const { result, nomination } = await fixture("hooks");
  assert.ok(result.metafile!.outputs[Object.keys(result.metafile!.outputs)[0]!]!.imports.some(edge => edge.path === "node:module"));
  const validated = validate(result, nomination);
  assert.equal(validated.outputs.length, result.outputFiles!.length);
  assert.equal(fs.existsSync(nomination.outputDirectory), false);
});
test("validated byte snapshots do not alias caller Buffer storage", async () => {
  const { result, nomination } = await fixture("lazy");
  const supplied = { ...result, outputFiles: result.outputFiles!.map(output =>
    ({ ...output, contents: Buffer.from(output.contents) })) };
  const validated = validate(supplied, nomination);
  const first = validated.outputs[0];
  const before = Buffer.from(first.contents);
  supplied.outputFiles.find(output => output.path === first.path)!.contents.fill(0);
  assert.deepEqual(Buffer.from(first.contents), before, "validated snapshot must retain original bytes");
  assert.equal(first.sha256, createHash("sha256").update(first.contents).digest("hex"));
});
test("exact parent output refuses before touching private byte storage", async () => {
  const { result, nomination } = await fixture("lazy");
  const first = result.outputFiles![0]!;
  let reads = 0;
  Object.defineProperty(first, "contents", { get() { reads++; throw Error("private byte getter evaluated"); } });
  nomination.outputDirectory = path.join(first.path, "nested");
  assert.throws(() => validate(result, nomination), /TASK6A_COLD_EMISSION_REFUSED:escaped-output/);
  assert.equal(reads, 0);
});
for (const mode of ["eager", "shared", "external", "computed"] as const) {
  test(`genuine compiler ${mode} graph is refused`, async () => {
    const { result, nomination } = await fixture(mode);
    if (mode === "shared") {
      const canonical = Object.entries(result.metafile!.outputs).find(([, value]) =>
        (value.inputs[nomination.canonicalSource]?.bytesInOutput ?? 0) > 0)![0];
      const entry = Object.entries(result.metafile!.outputs).find(([, value]) =>
        value.entryPoint === nomination.entrySource)![0];
      assert.notEqual(entry, canonical, "genuine shared chunk, not an eager single-file surrogate");
      assert.ok(staticClosure(result.metafile!, entry).has(canonical));
    }
    assert.throws(() => validate(result, nomination), /TASK6A_COLD_EMISSION_REFUSED/);
    assert.equal(fs.existsSync(nomination.outputDirectory), false);
  });
}

// These are metadata/byte guard controls, NOT genuine compiler negative credit.
for (const mode of ["missing-byte-output", "extra-byte-output", "duplicate-byte-output",
  "wrong-byte-length", "missing-owner-input", "duplicate-owner-contribution",
  "missing-dynamic-edge", "edge-kind-drift", "missing-chunk", "escaped-output",
  "emitted-edge-drift", "invalid-javascript", "require-static-reach", "require-alias",
  "module-loader-alias", "module-loader-namespace"] as const) {
  test(`validator envelope refuses ${mode}`, async () => {
    const { result, nomination } = await fixture("lazy");
    const changed: esbuild.BuildResult = { ...result, metafile: structuredClone(result.metafile!),
      outputFiles: result.outputFiles!.map(output => ({ ...output, contents: output.contents.slice() })) };
    const metadata = changed.metafile!, files = changed.outputFiles!;
    const entry = Object.entries(metadata.outputs).find(([, value]) => value.entryPoint === nomination.entrySource)![0];
    const owner = Object.entries(metadata.outputs).find(([, value]) =>
      (value.inputs[nomination.canonicalSource]?.bytesInOutput ?? 0) > 0)![0];
    const entryFile = files.find(output => output.path === entry)!;
    switch (mode) {
      case "missing-byte-output": files.pop(); break;
      case "extra-byte-output": files.push({ ...entryFile, path: path.join(nomination.outputDirectory, "extra.js") }); break;
      case "duplicate-byte-output": files.push(entryFile); break;
      case "wrong-byte-length": metadata.outputs[entry]!.bytes++; break;
      case "missing-owner-input": delete metadata.inputs[nomination.canonicalSource]; break;
      case "duplicate-owner-contribution": metadata.outputs[entry]!.inputs[nomination.canonicalSource] = { bytesInOutput: 1 }; break;
      case "missing-dynamic-edge": metadata.inputs[nomination.probeSource]!.imports = []; break;
      case "edge-kind-drift": metadata.outputs[entry]!.imports[0]!.kind = "import-statement"; break;
      case "missing-chunk": delete metadata.outputs[owner]; break;
      case "escaped-output": {
        const escaped = path.join(nomination.outputDirectory, "..", "escaped.js");
        metadata.outputs[escaped] = metadata.outputs[owner]!; delete metadata.outputs[owner];
        files.find(output => output.path === owner)!.path = escaped; break;
      }
      case "emitted-edge-drift": case "invalid-javascript": case "require-static-reach": case "require-alias":
      case "module-loader-alias": case "module-loader-namespace": {
        const ownerRelative = `./${path.basename(owner)}`;
        const suffix = mode === "invalid-javascript" ? "\nexport {"
          : mode === "require-static-reach" ? `\nrequire(${JSON.stringify(ownerRelative)});\n`
          : mode === "require-alias" ? `\nconst ownerLoad=require; ownerLoad(${JSON.stringify(ownerRelative)});\n`
          : mode === "module-loader-alias" ? `\nimport {createRequire as makeLoader} from 'node:module'; const loadOwner=makeLoader(import.meta.url); loadOwner(${JSON.stringify(ownerRelative)});\n`
          : mode === "module-loader-namespace" ? `\nimport * as runtimeModule from 'node:module'; const loadOwner=runtimeModule.createRequire(import.meta.url); loadOwner(${JSON.stringify(ownerRelative)});\n`
          : "\nimport './foreign.js';\n";
        entryFile.contents = Buffer.concat([entryFile.contents, Buffer.from(suffix)]);
        metadata.outputs[entry]!.bytes = entryFile.contents.byteLength;
        if (mode === "require-static-reach") metadata.outputs[entry]!.imports.push({ path: owner, kind: "require-call" });
        if (mode.startsWith("module-loader-")) metadata.outputs[entry]!.imports.push({ path: "node:module", kind: "import-statement", external: true });
        break;
      }
    }
    assert.throws(() => validate(changed, nomination), /TASK6A_COLD_EMISSION_REFUSED/);
    assert.equal(fs.existsSync(nomination.outputDirectory), false);
  });
}
