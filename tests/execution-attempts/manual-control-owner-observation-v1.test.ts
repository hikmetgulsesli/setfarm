import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import ts from "typescript";
import { z } from "zod";
import { ObservedControlWorkerOwnerV1Schema, ControlWorkerFatalErrorV1 } from "../../src/execution/schemas/manual-control-worker-channel-v1.js";
// Extract unchanged source function bodies; this is OS observation only. The
// child has no selected installation, DB, operational entry or external effects.
function declarations(locator: string, names: string[]): string {
    const source = fs.readFileSync(locator, "utf8"), tree = ts.createSourceFile(locator, source, ts.ScriptTarget.ES2022, true);
    const selected = tree.statements.filter(node => ts.isFunctionDeclaration(node) ? names.includes(node.name?.text ?? "") : ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ts.isIdentifier(d.name) && names.includes(d.name.text)));
    assert.equal(selected.length, names.length);
    return ts.transpileModule(selected.map(n => n.getText(tree)).join("\n"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
}
const environment = { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C", TZ: "UTC" };
test("actual owned Node child preserves full executable, exact args digest and stable OS start in both observers", async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "manual-owner-observation-")));
    const script = path.join(root, "fixed-worker.js"), executable = fs.realpathSync(process.execPath), jobId = "11111111-1111-4111-8111-111111111111";
    fs.writeFileSync(script, "process.stdout.write('READY\\n');setTimeout(()=>process.exit(0),2000);\n", { mode: 0o600 });
    const child = spawn(executable, [script, "--job-id", jobId], { argv0: executable, env: environment, stdio: ["ignore", "pipe", "pipe"] });
    const finished = once(child, "exit");
    try {
        const [ready] = await once(child.stdout!, "data");
        assert.equal(String(ready), "READY\n");
        assert.ok(child.pid);
        const ps = (args: string[]) => { const result = spawnSync("/bin/ps", args, { encoding: "utf8", env: environment, timeout: 5000, maxBuffer: 65536 }); assert.equal(result.status, 0); return result.stdout; };
        const expected = { pid: child.pid, processStartedAt: new Date(`${ps(["-ww", "-p", String(child.pid), "-o", "lstart="]).trim()} UTC`).toISOString(), processGroupId: Number(ps(["-ww", "-p", String(child.pid), "-o", "pgid="]).trim()), source: "observed_os", executable, script, commandHash: createHash("sha256").update(`${executable} ${script} --job-id ${jobId}`).digest("hex") };
        const admission = declarations("src/execution/manual-test-admission-v1.ts", ["Hash", "OwnerSchema", "digestV1", "refuseV1", "psV1", "processOwnerV1"]);
        const admissionObserver = new Function("fs", "path", "createHash", "spawnSync", "z", admission + ";return processOwnerV1;")(fs, path, createHash, spawnSync, z);
        const channel = declarations("src/execution/manual-test-worker-channel-v1.ts", ["fail", "observeOwner"]);
        const channelObserver = new Function("fs", "createHash", "spawnSync", "process", "ObservedControlWorkerOwnerV1Schema", "ControlWorkerFatalErrorV1", channel + ";return observeOwner;")(fs, createHash, spawnSync, Object.freeze({ pid: child.pid, execPath: executable, argv: Object.freeze([executable, script, "--job-id", jobId]) }), ObservedControlWorkerOwnerV1Schema, ControlWorkerFatalErrorV1);
        const observed: Record<string, unknown> = {};
        for (const [name, observe] of [["admission", () => admissionObserver(child.pid, script, executable)], ["channel", () => channelObserver(script)]] as const) {
            try {
                observed[name] = observe();
            }
            catch (error) {
                observed[name] = error instanceof Error ? error.message : String(error);
            }
        }
        assert.deepEqual(observed, { admission: expected, channel: expected });
        assert.throws(() => admissionObserver(child.pid, script + "-foreign", executable));
        assert.throws(() => channelObserver(script + "-foreign"));
    }
    finally {
        const [code, signal] = await finished;
        assert.equal(code, 0);
        assert.equal(signal, null);
        fs.rmSync(root, { recursive: true, force: true });
    }
});
