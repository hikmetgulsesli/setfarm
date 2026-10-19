import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import path from "node:path";
test("fixed worker source entry rejects before importing operational effects", () => {
    const script = path.resolve("src/cli/control-test-worker-v1.ts");
    const bootstrap = `import {registerHooks} from 'node:module';
let effects=0;
registerHooks({resolve(specifier,context,next){if(/(?:db-pg|activation-preflight|manual-test-worker-v1|fresh-installation-entry-v1)\\.js$/.test(specifier)){effects++;throw new Error('EFFECT_IMPORT');}return next(specifier,context);}});
process.argv=[process.execPath,${JSON.stringify(script)},'--job-id','11111111-1111-4111-8111-111111111111'];
process.on('exit',()=>process.stdout.write('EFFECTS='+effects+'\\n'));
await import(${JSON.stringify(script)});`;
    const env = { ...process.env };
    delete env.SETFARM_INSTALLATION_DIR;
    delete env.NODE_OPTIONS;
    const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", bootstrap], { env, encoding: "utf8", timeout: 10000 });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /CONTROL_CHANNEL_INVALID/);
    assert.match(child.stdout, /EFFECTS=0/);
});
test("channel accessor cannot establish custody from an imported module", async () => {
    const channel = await import("../../src/execution/manual-test-worker-channel-v1.js");
    assert.throws(() => channel.selectedManualWorkerChannelV1(), /CONTROL_CUSTODY_UNCERTAIN/);
});
test("fixed worker closes its prepared DB after dispatch failure", async () => {
    const ts = await import("typescript");
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("src/cli/control-test-worker-v1.ts", "utf8");
    const tree = ts.createSourceFile("entry.ts", source, ts.ScriptTarget.ES2022, true);
    const main = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "main")!;
    const body = ts.transpileModule(main.getText(tree), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
        .replaceAll('await import("../installation/fresh-installation-entry-v1.js")', "entryFixture")
        .replaceAll('await import("../db-pg.js")', "dbFixture")
        .replaceAll('await import("../execution/manual-test-worker-v1.js")', "workerFixture")
        .replaceAll("import.meta.url", JSON.stringify("file:///fixture/dist/cli/control-test-worker-v1.js"))
        .replace(/export\s*\{\};?/, "");
    const events: string[] = [];
    const failure = new Error("dispatch refused");
    const invoke = new Function("acceptSelectedManualWorkerChannelV1", "entryFixture", "dbFixture", "workerFixture", "process", "fileURLToPath", "fs", "ControlWorkerFatalErrorV1", body + ";return main;")(async () => ({ intent: {}, custody: {} }), { prepareFreshInstallationOperationalEntryV1: async () => events.push("prepare"), assertFreshInstallationOperationalEntryV1: () => events.push("assert") }, { pgClose: async () => events.push("close") }, { runSelectedManualControlJobV1: async () => { events.push("dispatch"); throw failure; } }, { argv: ["node", "/fixture/dist/cli/control-test-worker-v1.js"], connected: false }, () => "/fixture/dist/cli/control-test-worker-v1.js", { realpathSync: (v: string) => v }, Error);
    await assert.rejects(invoke, value => value === failure);
    assert.deepEqual(events, ["prepare", "assert", "dispatch", "close"]);
});

// Explicit Root-only compiled mode: missing real inputs fail, never skip/pass.
// Ordinary source execution does not register placeholder compiled tests.
if (process.env.SETFARM_CONTROL_COMPILED_NEGATIVES === "required") {
    const { loadCompiledNegativeContext, compiledWorkerNegativeCases, runCompiledWorkerNegative } = await import("./control-worker-compiled-negative-support.js");
    const context = loadCompiledNegativeContext();
    for (const name of compiledWorkerNegativeCases) test(`Root prepared compiled worker negative: ${name}`, { concurrency: false, timeout: 35000 }, () => runCompiledWorkerNegative(context, name));
} else {
    process.stdout.write("# COMPILED WORKER MATRIX NOT RUN: requires Root reviewed immutable build, two real isolated activated selections and measured private context. No compiled cases credited.\n");
}
