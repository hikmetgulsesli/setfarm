import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { pathToFileURL } from "node:url";
import { z } from "zod";

// Root alone supplies the reviewed compiled release and real, isolated activated
// selections. This helper never builds, prepares SQL, acknowledges activation,
// launches services or invents selection/OS observations. Its durable ACK is only
// a negative transport stimulus, never MC production or operational authority.
const Hash = z.string().regex(/^[a-f0-9]{64}$/), Source = z.string().regex(/^[a-f0-9]{40}$/);
const Absolute = z.string().refine(value => path.isAbsolute(value) && path.normalize(value) === value && !/\s/.test(value));
const Pin = z.object({ relativePath: z.string().min(1).refine(value => !path.isAbsolute(value) && path.normalize(value) === value && value !== ".." && !value.startsWith("../")), sha256: Hash }).strict();
const Selection = z.object({ directory: Absolute, installationId: z.string().uuid(), sourceSha: Source, catalogHash: Hash, pins: z.array(Pin).min(4) }).strict();
const Context = z.object({ schema: z.literal("setfarm.control-worker-compiled-negative-context.v1"), releaseDir: Absolute, sourceSha: Source,
    nodeExecutable: Absolute, nodeSha256: Hash, releasePins: z.array(Pin).min(6), selection: Selection, foreignSelection: Selection,
    mcSourceSha: Source, mcBuildFile: Absolute, mcBuildHash: Hash, auditRoot: Absolute }).strict();
export type CompiledNegativeContext = z.infer<typeof Context>;
export const compiledWorkerNegativeCases = ["ready_without_ack", "extra_argv", "wrong_flag", "malformed_job", "symlink_self", "loader_import", "node_options", "missing_ipc", "missing_selection", "foreign_selection", "missing_custody", "wrong_custody_selection", "wrong_custody_source", "wrong_custody_build", "wrong_nonce", "intent_inode_after_ready", "intent_content_after_ready"] as const;
export type CompiledNegativeCase = typeof compiledWorkerNegativeCases[number];
const canonical = (value: any): string => value && typeof value === "object" ? Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` : JSON.stringify(value);
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
function boundedRead(file: string, cap: number): Buffer {
    const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
        const before = fs.fstatSync(fd, { bigint: true });
        assert.ok(before.isFile() && before.nlink === 1n && before.size <= BigInt(cap), "unsafe or oversized fixture file");
        const buffer = Buffer.alloc(cap + 1); let length = 0;
        while (length < buffer.length) { const count = fs.readSync(fd, buffer, length, buffer.length - length, null); if (!count) break; length += count; }
        const after = fs.fstatSync(fd, { bigint: true });
        assert.ok(length <= cap && before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs, "fixture file changed");
        return buffer.subarray(0, length);
    } finally { fs.closeSync(fd); }
}
function fileWitness(file: string) {
    const before = fs.lstatSync(file, { bigint: true });
    assert.ok(before.isFile() && !before.isSymbolicLink() && before.nlink === 1n, "pin is not a regular single-link file");
    assert.equal(fs.realpathSync(file), file, "noncanonical pinned file");
    const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW), digest = createHash("sha256"), buffer = Buffer.alloc(65536);
    let length = 0;
    try {
        const opened = fs.fstatSync(fd, { bigint: true }); assert.equal(opened.dev, before.dev); assert.equal(opened.ino, before.ino);
        for (;;) { const count = fs.readSync(fd, buffer, 0, buffer.length, null); if (!count) break; length += count; assert.ok(length <= 512 * 1024 * 1024, "pin hashing cap exceeded"); digest.update(buffer.subarray(0, count)); }
        const closed = fs.fstatSync(fd, { bigint: true }); assert.equal(closed.size, before.size); assert.equal(closed.mtimeNs, before.mtimeNs); assert.equal(closed.ctimeNs, before.ctimeNs);
    } finally { fs.closeSync(fd); }
    assert.equal(BigInt(length), before.size);
    const sha256 = digest.digest("hex");
    const after = fs.lstatSync(file, { bigint: true });
    assert.equal(before.ino, after.ino); assert.equal(before.dev, after.dev); assert.equal(before.mtimeNs, after.mtimeNs); assert.equal(before.ctimeNs, after.ctimeNs);
    return { device: String(after.dev), inode: String(after.ino), mode: Number(after.mode & 511n), uid: Number(after.uid), size: String(after.size), mtimeNs: String(after.mtimeNs), ctimeNs: String(after.ctimeNs), sha256 };
}
function directory(file: string, privateMode = false): void {
    const stat = fs.lstatSync(file);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && fs.realpathSync(file) === file, "noncanonical directory");
    if (privateMode) { assert.equal(stat.uid, process.getuid!()); assert.equal(stat.mode & 511, 0o700); }
}
function pins(root: string, entries: Array<z.infer<typeof Pin>>) {
    directory(root);
    assert.equal(new Set(entries.map(pin => pin.relativePath)).size, entries.length, "duplicate context pin");
    return entries.map(pin => { const locator = path.join(root, pin.relativePath); const witness = fileWitness(locator); assert.equal(witness.sha256, pin.sha256, `pin mismatch: ${pin.relativePath}`); return { locator, ...witness }; });
}
function privateParents(target: string, root: string): void {
    assert.ok(target.startsWith(root + path.sep)); directory(root, true);
    const parts = path.relative(root, target).split(path.sep); let cursor = root;
    for (const part of parts) { cursor = path.join(cursor, part); try { fs.mkdirSync(cursor, { mode: 0o700 }); sync(path.dirname(cursor)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; } directory(cursor, true); }
}
function sync(directory: string): void { const fd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function durable(file: string, value: unknown): void {
    const bytes = Buffer.from(canonical(value) + "\n");
    const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    sync(path.dirname(file)); assert.deepEqual(boundedRead(file, 32768), bytes);
}
export function loadCompiledNegativeContext(locator = process.env.SETFARM_CONTROL_COMPILED_CONTEXT): CompiledNegativeContext {
    assert.ok(locator, "COMPILED MATRIX NOT RUN: required Root prepared-context manifest is missing");
    const context = Context.parse(JSON.parse(boundedRead(path.resolve(locator), 65536).toString("utf8")));
    assert.equal(fs.realpathSync(context.nodeExecutable), context.nodeExecutable);
    assert.equal(fs.realpathSync(process.execPath), context.nodeExecutable, "Root must run the helper with the pinned canonical Node");
    assert.equal(fileWitness(context.nodeExecutable).sha256, context.nodeSha256);
    assert.equal(fileWitness(context.mcBuildFile).sha256, context.mcBuildHash);
    for (const required of ["dist/cli/control-test-worker-v1.js", "dist/execution/manual-test-worker-channel-v1.js", "dist/execution/schemas/manual-control-worker-channel-v1.js", "dist/execution/schemas/manual-control-job-v1.js", "dist/installation/fresh-installation-selection-v1.js", "dist/installation/fresh-installation-records-v1.js"])
        assert.ok(context.releasePins.some(pin => pin.relativePath === required), `missing measured release pin: ${required}`);
    pins(context.releaseDir, context.releasePins);
    assert.notEqual(context.selection.directory, context.foreignSelection.directory);
    for (const selection of [context.selection, context.foreignSelection]) {
        directory(selection.directory, true); assert.equal(path.basename(selection.directory), selection.installationId);
        for (const required of ["schema-prepared.json", "schema-committed.json", "activation-prepared.json", "activated.json"])
            assert.ok(selection.pins.some(pin => pin.relativePath === required), `missing actual selection pin: ${required}`);
        pins(selection.directory, selection.pins);
    }
    assert.equal(context.selection.sourceSha, context.sourceSha);
    directory(context.auditRoot, true);
    for (const root of [context.releaseDir, context.selection.directory, context.foreignSelection.directory]) assert.ok(context.auditRoot !== root && !context.auditRoot.startsWith(root + path.sep), "audit root must be separate from measured authority");
    return context;
}
function passiveSnapshot(selection: string) {
    let entries = 0;
    const walk = (file: string): any => {
        if (++entries > 4096) throw new Error("passive filesystem observation cap exceeded");
        let stat: fs.Stats; try { stat = fs.lstatSync(file); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
        assert.ok(!stat.isSymbolicLink(), "passive observation refuses symbolic links");
        if (stat.isFile()) return fileWitness(file);
        assert.ok(stat.isDirectory());
        return { device: stat.dev, inode: stat.ino, mode: stat.mode, entries: Object.fromEntries(fs.readdirSync(file).sort().map(name => [name, walk(path.join(file, name))])) };
    };
    return Object.fromEntries(["runtime/evals", "runtime/product-compiler/artifacts", "runtime/projects"].map(relative => [relative, walk(path.join(selection, relative))]));
}
function observeChild(child: ChildProcess, executable: string, args: string[]) {
    assert.ok(child.pid && child.exitCode === null && child.signalCode === null);
    const read = (columns: string[]) => {
        const result = spawnSync("/bin/ps", ["-ww", "-p", String(child.pid), ...columns.flatMap(column => ["-o", column + "="])], { shell: false, encoding: "utf8", timeout: 1500, maxBuffer: 1024 * 1024, env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C", TZ: "UTC" } });
        assert.equal(result.status, 0); assert.equal(result.stderr, ""); assert.equal(result.error, undefined); return result.stdout;
    };
    const metadata = read(["lstart", "pgid", "args"]), command = read(["comm"]), parent = read(["ppid"]);
    assert.equal(read(["lstart", "pgid", "args"]), metadata); assert.equal(read(["ppid"]), parent);
    const row = /^\s*(\w{3} \w{3} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4})\s+(\d+)\s+([^\r\n]+)\n?$/.exec(metadata);
    const fullExecutable = /^(\S+)\n?$/.exec(command); assert.ok(row && fullExecutable);
    assert.equal(fs.realpathSync(fullExecutable[1]!), executable); assert.equal(row[3], [executable, ...args].join(" "));
    assert.equal(Number(parent.trim()), process.pid, "child is not held by this original parent");
    return { pid: child.pid, processStartedAt: new Date(`${row[1]} UTC`).toISOString(), processGroupId: Number(row[2]), source: "observed_os", executable, script: args[0], commandHash: hash(row[3]!) };
}

export async function runCompiledWorkerNegative(context: CompiledNegativeContext, kind: CompiledNegativeCase): Promise<void> {
    // Re-observe supplied context immediately before every original child.
    const releaseBefore = pins(context.releaseDir, context.releasePins), selectionBefore = pins(context.selection.directory, context.selection.pins), foreignBefore = pins(context.foreignSelection.directory, context.foreignSelection.pins);
    const effectsBefore = [passiveSnapshot(context.selection.directory), passiveSnapshot(context.foreignSelection.directory)];
    const pure: any = await import(pathToFileURL(path.join(context.releaseDir, "dist/execution/schemas/manual-control-worker-channel-v1.js")).href);
    const publicSchema: any = await import(pathToFileURL(path.join(context.releaseDir, "dist/execution/schemas/manual-control-job-v1.js")).href);
    const jobId = randomUUID(), channelId = randomUUID(), nonce = randomBytes(32).toString("hex"), requestedAt = new Date().toISOString();
    const caseRoot = path.join(context.auditRoot, `${kind}-${jobId}`); fs.mkdirSync(caseRoot, { mode: 0o700 }); sync(context.auditRoot);
    const selection = context.selection;
    const selectionHash = publicSchema.hashControlSelectionIdentityV1({ schema: "setfarm.manual-control-selection.v1", installationId: selection.installationId, sourceSha: selection.sourceSha, installationDir: selection.directory, releaseDir: context.releaseDir, catalogHash: selection.catalogHash, activationPreparedHash: selection.pins.find(pin => pin.relativePath === "activation-prepared.json")!.sha256, activationAcknowledgedHash: selection.pins.find(pin => pin.relativePath === "activated.json")!.sha256 });
    const receipt = publicSchema.ControlJobReceiptV1Schema.parse({ schema: "mission-control.control-job.v1", jobId, kind: "activation_preflight", revision: 1, selectionHash, sourceSha: selection.sourceSha, mcSourceSha: context.mcSourceSha, mcBuildHash: context.mcBuildHash, suiteHash: null, state: "accepted", requestedAt, startedAt: null, updatedAt: requestedAt, finishedAt: null, phase: "accepted", code: null, currentCaseId: null, ownedRunId: null, completedCases: 0, plannedCases: 0, reportRefs: {}, cancelRequested: false });
    const intent = publicSchema.ControlPrivateIntentV1Schema.parse({ schema: "mission-control.control-intent.v1", receipt, installationDir: selection.directory, releaseDir: context.releaseDir, nonceDigest: hash(nonce), fixedSuiteRelativePath: null });
    const selectedDirectory = kind === "foreign_selection" ? context.foreignSelection.directory : selection.directory;
    const jobs = path.join(selectedDirectory, "runtime/mission-control/controls/jobs"); privateParents(jobs, selectedDirectory);
    const job = path.join(jobs, jobId); fs.mkdirSync(job, { mode: 0o700 }); sync(jobs);
    const intentFile = path.join(job, "intent.json"); durable(intentFile, intent);
    durable(path.join(caseRoot, "accepted-receipt.json"), { schema: "setfarm.negative-transport-receipt.v1", receipt, mapping: null });
    const intentBefore = fileWitness(intentFile), binding = { jobId, channelId, intentHash: intentBefore.sha256, kind: "activation_preflight" };
    const script = path.join(context.releaseDir, "dist/cli/control-test-worker-v1.js");
    const args = [script, "--job-id", jobId];
    if (kind === "extra_argv") args.push("unexpected");
    if (kind === "wrong_flag") args[1] = "--job";
    if (kind === "malformed_job") args[2] = "invalid-job";
    if (kind === "symlink_self") { args[0] = path.join(caseRoot, "worker.js"); fs.symlinkSync(script, args[0]!); }
    if (kind === "loader_import") args.unshift("--import", "data:text/javascript,void(0)");
    const env: NodeJS.ProcessEnv = { PATH: `${path.dirname(context.nodeExecutable)}:/usr/bin:/bin:/usr/sbin:/sbin`, LANG: "C", LC_ALL: "C", TZ: "UTC", HOME: process.env.HOME, SETFARM_INSTALLATION_DIR: selectedDirectory };
    if (kind === "missing_selection") delete env.SETFARM_INSTALLATION_DIR;
    if (kind === "node_options") env.NODE_OPTIONS = "--no-warnings";
    durable(path.join(caseRoot, "input.json"), { schema: "setfarm.compiled-negative-input.v1", kind, jobId, channelId, releaseDir: context.releaseDir, sourceSha: context.sourceSha, selectionDirectory: selectedDirectory, intentHash: binding.intentHash, args, environmentKeys: Object.keys(env).sort() });
    const launchedAt = performance.now();
    const child = spawn(context.nodeExecutable, args, { cwd: context.releaseDir, shell: false, env, serialization: "json", stdio: kind === "missing_ipc" ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe", "ipc"] });
    const transcript: unknown[] = []; let stdout = "", stderr = "", readyCount = 0, timedOut = false, failure: unknown = null, acknowledged = false, changedIntent: unknown = null, verified = false;
    const record = (event: unknown) => { if (transcript.length >= 32) throw new Error("transport transcript cap exceeded"); transcript.push(event); };
    const send = (frame: any) => new Promise<void>((resolve, reject) => { assert.ok(child.connected); record({ direction: "parent_to_child", sequence: frame.sequence, type: frame.body.type, hash: pure.hashWorkerChannelFrameV1(frame) }); child.send(frame, error => error ? reject(error) : resolve()); });
    const safeFailure = (error: unknown) => { failure ??= error; if (child.connected) child.disconnect(); };
    child.stdout!.on("data", (bytes: Buffer) => { if (Buffer.byteLength(stdout) + bytes.length > 16384) safeFailure(new Error("stdout cap exceeded")); else stdout += bytes.toString("utf8"); });
    child.stderr!.on("data", (bytes: Buffer) => { if (Buffer.byteLength(stderr) + bytes.length > 16384) safeFailure(new Error("stderr cap exceeded")); else stderr += bytes.toString("utf8"); });
    let messageWork = Promise.resolve();
    child.on("message", raw => {
        messageWork = messageWork.then(async () => {
            assert.ok(Buffer.byteLength(JSON.stringify(raw)) <= 16384);
            const frame = pure.verifyWorkerChannelFrameV1({ frame: raw, binding, direction: "worker_to_broker", nonce });
            record({ direction: "child_to_parent", sequence: frame.sequence, type: frame.body.type, hash: pure.hashWorkerChannelFrameV1(frame) });
            assert.equal(frame.sequence, 1); assert.equal(frame.body.type, "ready"); assert.equal(++readyCount, 1);
            const observedOwner = observeChild(child, context.nodeExecutable, [script, "--job-id", jobId]);
            assert.deepEqual(frame.body.owner, observedOwner); record({ type: "independent_owned_child", owner: observedOwner, parentPid: process.pid });
            assert.equal(frame.body.journal, null);
            assert.ok(["ready_without_ack", "intent_inode_after_ready", "intent_content_after_ready"].includes(kind), `unexpected ready for ${kind}`);
            if (kind === "ready_without_ack") return; // Keep IPC open: exercise the actual startup timeout.
            if (kind === "intent_inode_after_ready") {
                durable(path.join(job, "intent.replacement.json"), intent); fs.renameSync(path.join(job, "intent.replacement.json"), intentFile); sync(job);
                changedIntent = fileWitness(intentFile); assert.notEqual((changedIntent as any).inode, intentBefore.inode); assert.equal((changedIntent as any).sha256, intentBefore.sha256);
            } else {
                const changed = publicSchema.ControlPrivateIntentV1Schema.parse({ ...intent, nonceDigest: "0".repeat(64) });
                const fd = fs.openSync(intentFile, fs.constants.O_WRONLY | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW);
                try { fs.writeFileSync(fd, canonical(changed) + "\n"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
                changedIntent = fileWitness(intentFile); assert.equal((changedIntent as any).inode, intentBefore.inode); assert.notEqual((changedIntent as any).sha256, intentBefore.sha256);
            }
            const starting = publicSchema.ControlJobReceiptV1Schema.parse({ ...receipt, revision: 2, state: "starting", phase: "starting", updatedAt: new Date().toISOString() });
            const mapping = { workerSequence: frame.sequence, workerFrameHash: pure.hashWorkerChannelFrameV1(frame), receiptRevision: starting.revision };
            // A single immutable fsynced file contains both receipt and its exact
            // mapping. Only this negative test parent owns/uses this fixture file.
            durable(path.join(caseRoot, "starting-receipt-and-mapping.json"), { schema: "setfarm.negative-transport-receipt.v1", receipt: starting, mapping });
            const ack = pure.signWorkerChannelFrameV1({ binding, direction: "broker_to_worker", sequence: 2, nonce, body: { type: "ack", ...mapping, receipt: starting } });
            pure.verifyWorkerChannelFrameV1({ frame: ack, binding, direction: "broker_to_worker", nonce });
            await send(ack); acknowledged = true;
        }).catch(safeFailure);
    });
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => record({ type: "original_child_exit", code, signal }));
        child.once("close", (code, signal) => resolve({ code, signal }));
    });
    void exited.catch(() => {});
    let rejectDeadline!: (error: Error) => void;
    const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject; });
    const watchdog = setTimeout(() => {
        timedOut = true;
        rejectDeadline(new Error("compiled child exceeded natural refusal deadline"));
    }, 25000);
    let exit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
    try {
        if (kind !== "missing_ipc" && kind !== "missing_custody") {
            const sentNonce = kind === "wrong_nonce" ? randomBytes(32).toString("hex") : nonce;
            const custody: any = { schema: "mission-control.control-custody.v1", jobId, selectionHash, sourceSha: selection.sourceSha, mcBuildHash: context.mcBuildHash, nonce: sentNonce };
            if (kind === "wrong_custody_selection") custody.selectionHash = "0".repeat(64);
            if (kind === "wrong_custody_source") custody.sourceSha = "0".repeat(40);
            if (kind === "wrong_custody_build") custody.mcBuildHash = "0".repeat(64);
            await send(pure.signWorkerChannelFrameV1({ binding, direction: "broker_to_worker", sequence: 1, nonce: sentNonce, body: { type: "custody", custody } })).catch(error => {
                // An early guard can close before the first IPC write completes.
                if (!["extra_argv", "wrong_flag", "malformed_job", "symlink_self", "loader_import", "node_options", "missing_selection", "foreign_selection"].includes(kind)) throw error;
            });
        }
        exit = await Promise.race([exited, deadline]); await messageWork;
        assert.equal(timedOut, false, "watchdog cleanup is not natural refusal evidence"); if (failure) throw failure;
        assert.equal(exit.signal, null); assert.equal(exit.code, 1); assert.equal(stdout, "");
        if (kind === "ready_without_ack" || kind === "missing_custody") assert.ok(performance.now() - launchedAt >= 9000, "natural startup deadline was not exercised");
        const readyExpected = ["ready_without_ack", "intent_inode_after_ready", "intent_content_after_ready"].includes(kind);
        assert.equal(readyCount, readyExpected ? 1 : 0);
        assert.equal(acknowledged, kind === "intent_inode_after_ready" || kind === "intent_content_after_ready");
        assert.match(stderr, /^CONTROL_(?:CHANNEL_INVALID|CHANNEL_UNAVAILABLE|CUSTODY_UNCERTAIN)\n$/);
        if (["ready_without_ack", "missing_custody", "wrong_nonce", "wrong_custody_selection", "wrong_custody_source", "wrong_custody_build"].includes(kind)) assert.equal(stderr, "CONTROL_CHANNEL_UNAVAILABLE\n");
        if (acknowledged) assert.equal(stderr, "CONTROL_CHANNEL_INVALID\n");
        assert.deepEqual(pins(context.releaseDir, context.releasePins), releaseBefore);
        assert.deepEqual(pins(context.selection.directory, context.selection.pins), selectionBefore);
        assert.deepEqual(pins(context.foreignSelection.directory, context.foreignSelection.pins), foreignBefore);
        assert.deepEqual([passiveSnapshot(context.selection.directory), passiveSnapshot(context.foreignSelection.directory)], effectsBefore);
        verified = true;
    } finally {
        clearTimeout(watchdog);
        if (child.exitCode === null && child.signalCode === null) {
            try {
                observeChild(child, context.nodeExecutable, args);
                child.kill("SIGTERM");
                let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
                try { exit = await Promise.race([exited, new Promise<never>((_, reject) => { cleanupTimer = setTimeout(() => reject(new Error("owned child cleanup uncertain")), 2000); })]); }
                finally { clearTimeout(cleanupTimer); }
            } catch (error) { failure ??= error; child.unref(); }
        }
        if (child.connected) child.disconnect();
        durable(path.join(caseRoot, "observation.json"), { schema: "setfarm.compiled-negative-observation.v1", kind, childPid: child.pid ?? null, parentPid: process.pid, exit: exit ?? null, elapsedMs: performance.now() - launchedAt, timedOut, readyCount, acknowledged, intentBefore, changedIntent, transcript, stdout, stderr, passed: verified,
            effectCoverage: { filesystem: ["runtime/evals", "runtime/product-compiler/artifacts", "runtime/projects"], sqlAttempts: "not observed by helper; Root capture required", networkAttempts: "not observed by helper; Root capture required", imports: "reviewed pre-import source order plus actual refusal stage; no loader spy" } });
    }
}
