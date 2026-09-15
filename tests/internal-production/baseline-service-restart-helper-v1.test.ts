import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, closeSync, existsSync, fstatSync, linkSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const tsxLoader = import.meta.resolve("tsx");
const helperSourcePath = path.resolve(import.meta.dirname, "../../src/internal-production/baseline-service-restart-helper-v1.ts");

function installWorkspaceLocatorFixtureV1(internal: string, workspace: string): void {
  const locatorPath = path.resolve(import.meta.dirname, "../../src/internal-production/baseline-workspace-authority-path-v1.ts");
  let source = readFileSync(locatorPath, "utf8");
  const candidates = [
    'const CODE_OWNED_WORKSPACE_ROOT_V1 = path.join(CODE_OWNER_HOME_V1, "ai", "setrox");',
    'const CODE_OWNED_WORKSPACE_ROOT_V1 = path.resolve(import.meta.dirname, "../../..");',
  ];
  const matches = candidates.filter((candidate) => source.includes(candidate));
  assert.equal(matches.length, 1, "fixture authenticates exactly one workspace projection");
  assert.equal(source.split(matches[0]!).length, 2);
  source = source.replace(matches[0]!, `const CODE_OWNED_WORKSPACE_ROOT_V1 = ${JSON.stringify(workspace)};`);
  writeFileSync(path.join(internal, path.basename(locatorPath)), source);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function identity(fd: number) {
  const stats = fstatSync(fd, { bigint: true });
  return { devDecimal: stats.dev.toString(10), inoDecimal: stats.ino.toString(10) };
}

test("watcher start adopts a real detached daemon and cannot prove predecessor replacement", async () => {
  const fixture = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-detached-watcher-repro-")));
  let pid: number | undefined;
  const daemon = path.join(fixture, "fixture-daemon.mjs"), ready = path.join(fixture, "ready");
  const readProcess = () => spawnSync("/bin/ps", ["-p", String(pid), "-o", "uid=,pid=,ppid=,pgid=,lstart=,command="], { encoding: "utf8", timeout: 2_000 });
  try {
    writeFileSync(daemon, `import{writeFileSync,renameSync}from"node:fs";process.on("SIGTERM",()=>process.exit(0));const ready=${JSON.stringify(ready)},pending=ready+'.'+process.pid+'.pending';writeFileSync(pending,String(process.pid),{mode:0o600,flag:'wx'});renameSync(pending,ready);setInterval(()=>{},1000);\n`, { mode: 0o600 });
    const launcher = spawnSync(process.execPath, ["--input-type=module", "-e", `import{spawn}from"node:child_process";const child=spawn(process.execPath,[${JSON.stringify(daemon)}],{detached:true,stdio:"ignore"});child.unref();process.stdout.write(String(child.pid));`], { encoding: "utf8", timeout: 3_000 });
    assert.equal(launcher.status, 0, launcher.stderr);
    assert.match(launcher.stdout, /^[1-9][0-9]*$/); pid = Number(launcher.stdout);
    for (let attempt = 0; attempt < 100 && !existsSync(ready); attempt++) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(readFileSync(ready, "utf8"), String(pid));
    assert.equal(existsSync(`${ready}.${pid}.pending`), false, "readiness appears only after the closed complete PID file is renamed");
    const before = readProcess();
    assert.equal(before.status, 0, before.stderr);
    assert.match(before.stdout, new RegExp(`^\\s*${process.getuid!()}\\s+${pid}\\s+1\\s+${pid}\\s+`));
    assert.ok(before.stdout.trimEnd().endsWith(daemon), "the process is exactly this fixture's daemon");
    const controller = readFileSync(path.resolve(import.meta.dirname, "../../src/server/spawnerctl.ts"), "utf8");
    const pidExpression = 'path.join(os.homedir(), ".openclaw", "setfarm", "spawner.pid")';
    const logExpression = 'path.join(os.homedir(), ".openclaw", "setfarm", "spawner.log")';
    assert.equal(controller.split(pidExpression).length, 2); assert.equal(controller.split(logExpression).length, 2);
    mkdirSync(path.join(fixture, "src/server"), { recursive: true });
    writeFileSync(path.join(fixture, "src/server/spawnerctl.ts"), controller.replace(pidExpression, JSON.stringify(path.join(fixture, "spawner.pid"))).replace(logExpression, JSON.stringify(path.join(fixture, "spawner.log"))));
    writeFileSync(path.join(fixture, "src/runtime-config.ts"), 'export function loadRuntimeEnv(){throw new Error("WATCHER_MUST_ONLY_ADOPT_EXISTING");}\n');
    writeFileSync(path.join(fixture, "package.json"), '{"type":"module"}\n');
    writeFileSync(path.join(fixture, "spawner.pid"), String(pid));
    const actual = await import(pathToFileURL(path.join(fixture, "src/server/spawnerctl.ts")).href);
    for (let watcherStart = 0; watcherStart < 2; watcherStart++) {
      const adopted = await actual.startSpawner();
      assert.equal(adopted.pid, pid, "actual watcher start adopts the existing daemon");
      assert.deepEqual(readProcess().stdout, before.stdout, "PID, start time and detached ownership are unchanged");
    }
    assert.equal(existsSync(path.join(fixture, "spawner.log")), false, "no replacement dispatch was attempted");
  } finally {
    if (pid !== undefined) {
      const owned = readProcess();
      if (owned.status === 0 && owned.stdout.trimEnd().endsWith(daemon)) {
        process.kill(pid, "SIGTERM");
        for (let attempt = 0; attempt < 100 && readProcess().status === 0; attempt++) await new Promise((resolve) => setTimeout(resolve, 20));
        assert.notEqual(readProcess().status, 0, "the exact disposable daemon must terminate");
      }
    }
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("restart helper closes ancestor guards when its inherited journal descriptor is invalid", async () => {
  const fixture = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-helper-guard-release-")));
  try {
    const internal = path.join(fixture, "src/internal-production");
    mkdirSync(internal, { recursive: true, mode: 0o700 });
    installWorkspaceLocatorFixtureV1(internal, fixture);
    const modulePath = path.join(internal, "baseline-service-restart-helper-v1.ts");
    writeFileSync(modulePath, `${readFileSync(helperSourcePath, "utf8")}\nexport { authenticateCanonicalJournalCapability };\n`);
    const module = await import(pathToFileURL(modulePath).href);
    const journal = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-journal.json");
    mkdirSync(path.dirname(journal), { recursive: true, mode: 0o700 });
    const before = readdirSync("/dev/fd").length;
    assert.throws(() => module.authenticateCanonicalJournalCapability(-1, journal), /fd|descriptor|range/i);
    assert.equal(readdirSync("/dev/fd").length, before, "failed inherited-descriptor validation must release every workspace/private ancestor pin");
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test("P4 helper binds fixed pre-schema action", async () => {
  const module = await import(`../../src/internal-production/baseline-service-restart-helper-v1.js?p4-helper=${Date.now()}`);
  assert.deepEqual(Object.keys(module), []);
  const source = readFileSync(
    path.resolve(import.meta.dirname, "../../src/internal-production/baseline-service-restart-helper-v1.ts"),
    "utf8",
  );
  assert.match(source, /setfarm\.internal-production-pre-schema-spawner-rebind-restart-authority\.v1/);
  assert.match(source, /task6a-pre-schema-setfarm-spawner-rebind-v1/);
  assert.match(source, /process\.argv\.length !== 2/);
  assert.match(source, /fd:\s*3/);
  assert.doesNotMatch(source, /^export /m);

  const fixture = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-p4-helper-")));
  try {
    const internal = path.join(fixture, "src/internal-production");
    mkdirSync(internal, { recursive: true });
    installWorkspaceLocatorFixtureV1(internal, fixture);
    const counter = path.join(fixture, "dispatch-count.txt");
    const fakeLaunchctl = path.join(fixture, "fake-launchctl.mjs");
    writeFileSync(fakeLaunchctl, `#!/bin/sh
[ "$1" = "kickstart" ] || exit 7
[ "$2" = "-k" ] || exit 8
[ "$3" = "gui/${process.getuid?.()}/com.setrox.setfarm-spawner" ] || exit 9
count=0
[ ! -f '${counter}' ] || count=$(cat '${counter}')
count=$((count + 1))
printf '%s' "$count" > '${counter}'
`, "utf8");
    chmodSync(fakeLaunchctl, 0o700);
    const helperPath = path.join(internal, "baseline-service-restart-helper-v1.ts");
    writeFileSync(helperPath, source
      .replaceAll('"/bin/launchctl"', JSON.stringify(fakeLaunchctl))
      .replace('if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {', 'if (true) {'));
    const operationHash = "a".repeat(64);
    const restartHash = "b".repeat(64);
    const currentEntryOperation = { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash };
    const restartAuthority = { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartHash}`, restartAuthorityHash: restartHash };
    const lockPath = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/physical-service-restart-authority.transition.lock");
    const journalPath = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-journal.json");
    mkdirSync(path.dirname(lockPath), { recursive: true, mode: 0o700 });
    const ownerProcess = spawnSync("/bin/ps", ["-p", String(process.pid), "-o", "lstart=,command="], { encoding: "utf8" });
    assert.equal(ownerProcess.status, 0, ownerProcess.stderr);
    const ownerRow = ownerProcess.stdout.slice(0, -1);
    const ownerLstart = ownerRow.slice(0, 24);
    const ownerCommand = ownerRow.slice(24).trimStart();
    const ownerStart = Date.parse(ownerLstart);
    const ownerIdentityHash = sha256(canonical({ schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid: process.pid, processStartTimeEpochMs: ownerStart, lstart: ownerLstart, command: ownerCommand }));
    const transitionLock = { schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1", pid: process.pid, processStartTimeEpochMs: ownerStart, processIdentityHash: ownerIdentityHash, leaseNonce: "9".repeat(64) };
    writeFileSync(lockPath, `${canonical(transitionLock)}\n`, { mode: 0o600 });
    const lockFd = openSync(lockPath, "r");
    const journalBody = { schema: "setfarm.internal-production-service-restart-helper-journal.v1", family: "pre-schema-spawner-rebind", operationSchema: "setfarm.internal-production-current-entry-operation.v1", operationPurpose: "task6a-internal-production-current-entry-v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, transitionLock, lockIdentity: identity(lockFd), maximumDispatchCount: 1 };
    const journalHash = sha256(canonical(journalBody));
    writeFileSync(journalPath, `${canonical({ ...journalBody, journalHash })}\n`, { mode: 0o600 });
    const journalFd = openSync(journalPath, "r");
    const frame = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-restart-authority.v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, journalHash, lockIdentity: identity(lockFd), journalIdentity: identity(journalFd) };
    const framePath = path.join(fixture, "frame.json");
    writeFileSync(framePath, canonical(frame));
    const frameFd = openSync(framePath, "r");
    const child = spawnSync(process.execPath, ["--import", tsxLoader, helperPath], {
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe", frameFd, lockFd, journalFd],
      encoding: "utf8",
      timeout: 10_000,
    });
    closeSync(frameFd); closeSync(lockFd); closeSync(journalFd);
    assert.equal(child.status, 0, child.stderr);
    assert.equal(readFileSync(counter, "utf8"), "1");
    const expectedBody = { schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-settlement.v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation, restartAuthority, journalHash, transitionLock, lockIdentity: frame.lockIdentity, dispatchCount: 1, disposition: "completed" };
    const helperSettlementHash = sha256(canonical(expectedBody));
    const settlement = JSON.parse(readFileSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-settlements/sha256", helperSettlementHash.slice(0, 2), `${helperSettlementHash}.json`), "utf8"));
    assert.deepEqual(settlement, { ...expectedBody, helperSettlementRef: `setfarm://internal-production/pre-schema-spawner-rebind-helper-settlement/sha256/${helperSettlementHash}`, helperSettlementHash });

    const runFrame = (candidate: unknown) => {
      const candidatePath = path.join(fixture, `frame-${Math.random().toString(16).slice(2)}.json`);
      writeFileSync(candidatePath, canonical(candidate));
      const candidateFrameFd = openSync(candidatePath, "r");
      const candidateLockFd = openSync(lockPath, "r");
      const candidateJournalFd = openSync(journalPath, "r");
      try {
        return spawnSync(process.execPath, ["--import", tsxLoader, helperPath], {
          env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
          stdio: ["ignore", "pipe", "pipe", candidateFrameFd, candidateLockFd, candidateJournalFd],
          encoding: "utf8",
          timeout: 10_000,
        });
      } finally {
        closeSync(candidateFrameFd); closeSync(candidateLockFd); closeSync(candidateJournalFd);
      }
    };
    const settlementPath = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-settlements/sha256", helperSettlementHash.slice(0, 2), `${helperSettlementHash}.json`);
    const settlementCrashTemp = path.join(path.dirname(settlementPath), `.${path.basename(settlementPath)}.${"a".repeat(32)}.tmp`);
    linkSync(settlementPath, settlementCrashTemp);
    const crashAdoptedSettlement = runFrame(frame);
    assert.equal(crashAdoptedSettlement.status, 0, crashAdoptedSettlement.stderr);
    assert.equal(readFileSync(counter, "utf8"), "1", "linked settlement crash must adopt without redispatch");
    assert.throws(() => readFileSync(settlementCrashTemp), /ENOENT/);
    const adoptedSettlement = runFrame(frame);
    assert.equal(adoptedSettlement.status, 0, adoptedSettlement.stderr);
    assert.equal(readFileSync(counter, "utf8"), "1", "exact terminal settlement must adopt without redispatch");

    const crossedNonceBody = { ...journalBody, transitionLock: { ...transitionLock, leaseNonce: "0".repeat(64) } };
    const crossedNonceHash = sha256(canonical(crossedNonceBody));
    writeFileSync(journalPath, `${canonical({ ...crossedNonceBody, journalHash: crossedNonceHash })}\n`, { mode: 0o600 });
    const crossedNonce = runFrame({ ...frame, journalHash: crossedNonceHash });
    assert.notEqual(crossedNonce.status, 0, "journal nonce must bind the exact held transition lock");
    assert.equal(readFileSync(counter, "utf8"), "1");
    writeFileSync(journalPath, `${canonical({ ...journalBody, journalHash })}\n`, { mode: 0o600 });

    const unrelatedProcess = spawnSync("/bin/ps", ["-p", "1", "-o", "lstart=,command="], { encoding: "utf8" });
    assert.equal(unrelatedProcess.status, 0, unrelatedProcess.stderr);
    const unrelatedRow = unrelatedProcess.stdout.slice(0, -1);
    const unrelatedLstart = unrelatedRow.slice(0, 24);
    const unrelatedCommand = unrelatedRow.slice(24).trimStart();
    const unrelatedStart = Date.parse(unrelatedLstart);
    const unrelatedHash = sha256(canonical({ schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid: 1, processStartTimeEpochMs: unrelatedStart, lstart: unrelatedLstart, command: unrelatedCommand }));
    writeFileSync(lockPath, `${canonical({ schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1", pid: 1, processStartTimeEpochMs: unrelatedStart, processIdentityHash: unrelatedHash, leaseNonce: "9".repeat(64) })}\n`, { mode: 0o600 });
    const unrelatedOwner = runFrame(frame);
    assert.notEqual(unrelatedOwner.status, 0, "live unrelated FD4 owner must not authorize helper");
    assert.equal(readFileSync(counter, "utf8"), "1");
    writeFileSync(lockPath, `${canonical(transitionLock)}\n`, { mode: 0o600 });

    const copiedJournalPath = path.join(fixture, "copied-journal.json");
    writeFileSync(copiedJournalPath, readFileSync(journalPath), { mode: 0o600 });
    const copiedJournalFd = openSync(copiedJournalPath, "r");
    const copiedJournalFramePath = path.join(fixture, "copied-journal-frame.json");
    writeFileSync(copiedJournalFramePath, canonical({ ...frame, journalIdentity: identity(copiedJournalFd) }));
    const copiedJournalFrameFd = openSync(copiedJournalFramePath, "r");
    const copiedJournalLockFd = openSync(lockPath, "r");
    const copiedJournal = spawnSync(process.execPath, ["--import", tsxLoader, helperPath], {
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe", copiedJournalFrameFd, copiedJournalLockFd, copiedJournalFd],
      encoding: "utf8", timeout: 10_000,
    });
    closeSync(copiedJournalFrameFd); closeSync(copiedJournalLockFd); closeSync(copiedJournalFd);
    assert.notEqual(copiedJournal.status, 0, "copied noncanonical FD5 must not authorize helper");
    assert.equal(readFileSync(counter, "utf8"), "1");

    rmSync(path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-settlements"), { recursive: true, force: true });
    const swappedJournalHelperPath = path.join(internal, "baseline-service-restart-helper-journal-swap-v1.ts");
    writeFileSync(swappedJournalHelperPath, source
      .replace("closeSync, constants,", "closeSync, constants, renameSync,")
      .replace("  const finalJournalCapability = authenticateCanonicalJournalCapability(5);", "  const p4JournalPath = path.join(repositoryRoot(), \"data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-journal.json\"); renameSync(p4JournalPath, `${p4JournalPath}.old`); writeFileSync(p4JournalPath, \"foreign-journal\\n\", { mode: 0o600 });\n  const finalJournalCapability = authenticateCanonicalJournalCapability(5);")
      .replaceAll('"/bin/launchctl"', JSON.stringify(fakeLaunchctl))
      .replace('if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {', 'if (true) {'));
    const journalSwapFrameFd = openSync(framePath, "r");
    const journalSwapLockFd = openSync(lockPath, "r");
    const journalSwapFd = openSync(journalPath, "r");
    const journalSwapped = spawnSync(process.execPath, ["--import", tsxLoader, swappedJournalHelperPath], {
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe", journalSwapFrameFd, journalSwapLockFd, journalSwapFd], encoding: "utf8", timeout: 10_000,
    });
    closeSync(journalSwapFrameFd); closeSync(journalSwapLockFd); closeSync(journalSwapFd);
    assert.notEqual(journalSwapped.status, 0, "FD5 path swap before launchctl must refuse");
    assert.equal(readFileSync(counter, "utf8"), "1", "journal path swap must cause zero additional dispatch");
    rmSync(journalPath);
    renameSync(`${journalPath}.old`, journalPath);

    const swappedHelperPath = path.join(internal, "baseline-service-restart-helper-path-swap-v1.ts");
    writeFileSync(swappedHelperPath, source
      .replace("closeSync, constants,", "closeSync, constants, renameSync,")
      .replace("  const finalJournalCapability = authenticateCanonicalJournalCapability(5);", "  const p4LockPath = path.join(repositoryRoot(), \"data/internal-production-baseline/restart-authority-retirement-v1/physical-service-restart-authority.transition.lock\"); renameSync(p4LockPath, `${p4LockPath}.old`); writeFileSync(p4LockPath, \"foreign-lock\\n\", { mode: 0o600 });\n  const finalJournalCapability = authenticateCanonicalJournalCapability(5);")
      .replaceAll('"/bin/launchctl"', JSON.stringify(fakeLaunchctl))
      .replace('if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {', 'if (true) {'));
    const swapFrameFd = openSync(framePath, "r");
    const swapLockFd = openSync(lockPath, "r");
    const swapJournalFd = openSync(journalPath, "r");
    const swapped = spawnSync(process.execPath, ["--import", tsxLoader, swappedHelperPath], {
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe", swapFrameFd, swapLockFd, swapJournalFd], encoding: "utf8", timeout: 10_000,
    });
    closeSync(swapFrameFd); closeSync(swapLockFd); closeSync(swapJournalFd);
    assert.notEqual(swapped.status, 0, "FD4 path swap before launchctl must refuse");
    assert.equal(readFileSync(counter, "utf8"), "1", "path swap must cause zero additional dispatch");

    const { action: _discardedAction, ...missingAction } = frame;
    for (const [label, candidate] of [
      ["extra", { ...frame, extra: true }],
      ["missing", missingAction],
      ["schema", { ...frame, schema: "foreign.frame.v1" }],
      ["action", { ...frame, action: "foreign-action" }],
      ["journal hash", { ...frame, journalHash: "0".repeat(64) }],
      ["lock descriptor", { ...frame, lockIdentity: { devDecimal: "0", inoDecimal: "0" } }],
      ["journal descriptor", { ...frame, journalIdentity: { devDecimal: "0", inoDecimal: "0" } }],
      ["operation pair", { ...frame, currentEntryOperation: { ...currentEntryOperation, extra: true } }],
      ["restart pair", { ...frame, restartAuthority: { ...restartAuthority, restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${"c".repeat(64)}` } }],
    ] as const) {
      const refused = runFrame(candidate);
      assert.notEqual(refused.status, 0, `${label} mutation must refuse`);
      assert.equal(readFileSync(counter, "utf8"), "1", `${label} mutation must not dispatch`);
    }

    const forgedFrameFd = openSync(framePath, "r");
    const forged = spawnSync(process.execPath, ["--import", tsxLoader, helperPath], {
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe", forgedFrameFd, "ignore", "ignore"],
      encoding: "utf8",
      timeout: 10_000,
    });
    closeSync(forgedFrameFd);
    assert.notEqual(forged.status, 0);
    assert.equal(readFileSync(counter, "utf8"), "1");

    const crossedJournalBody = { ...journalBody, schema: "setfarm.internal-production-pre-schema-spawner-rebind-helper-journal.v1" };
    const crossedJournalHash = sha256(canonical(crossedJournalBody));
    const crossedJournalPath = path.join(fixture, "crossed-journal.json");
    writeFileSync(crossedJournalPath, `${canonical({ ...crossedJournalBody, journalHash: crossedJournalHash })}\n`);
    const crossedJournalFd = openSync(crossedJournalPath, "r");
    const crossedFrame = { ...frame, journalHash: crossedJournalHash, journalIdentity: identity(crossedJournalFd) };
    const crossedFramePath = path.join(fixture, "crossed-frame.json");
    writeFileSync(crossedFramePath, canonical(crossedFrame));
    const crossedFrameFd = openSync(crossedFramePath, "r");
    const crossedLockFd = openSync(lockPath, "r");
    const crossed = spawnSync(process.execPath, ["--import", tsxLoader, helperPath], {
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe", crossedFrameFd, crossedLockFd, crossedJournalFd],
      encoding: "utf8",
      timeout: 10_000,
    });
    closeSync(crossedFrameFd); closeSync(crossedLockFd); closeSync(crossedJournalFd);
    assert.notEqual(crossed.status, 0);
    assert.match(crossed.stderr, /journal.*(?:invalid|crossed)|journal descriptor\/path identity/);
    assert.equal(readFileSync(counter, "utf8"), "1");

    const maxTwoBody = { ...journalBody, maximumDispatchCount: 2 };
    const maxTwoHash = sha256(canonical(maxTwoBody));
    const maxTwoPath = path.join(fixture, "max-two-journal.json");
    writeFileSync(maxTwoPath, `${canonical({ ...maxTwoBody, journalHash: maxTwoHash })}\n`);
    const maxTwoFd = openSync(maxTwoPath, "r");
    const maxTwoFramePath = path.join(fixture, "max-two-frame.json");
    writeFileSync(maxTwoFramePath, canonical({ ...frame, journalHash: maxTwoHash, journalIdentity: identity(maxTwoFd) }));
    const maxTwoFrameFd = openSync(maxTwoFramePath, "r");
    const maxTwoLockFd = openSync(lockPath, "r");
    const maxTwo = spawnSync(process.execPath, ["--import", tsxLoader, helperPath], {
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe", maxTwoFrameFd, maxTwoLockFd, maxTwoFd],
      encoding: "utf8",
      timeout: 10_000,
    });
    closeSync(maxTwoFrameFd); closeSync(maxTwoLockFd); closeSync(maxTwoFd);
    assert.notEqual(maxTwo.status, 0);
    assert.match(maxTwo.stderr, /journal.*(?:invalid|crossed)|journal descriptor\/path identity/);
    assert.equal(readFileSync(counter, "utf8"), "1");

    const forgedLockPath = path.join(fixture, "forged-held.lock");
    writeFileSync(forgedLockPath, "arbitrary regular file\n", { mode: 0o600 });
    const forgedLockCapability = openSync(forgedLockPath, "r");
    const forgedOperationHash = "d".repeat(64);
    const forgedRestartHash = "e".repeat(64);
    const forgedOperation = { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${forgedOperationHash}`, operationHash: forgedOperationHash };
    const forgedRestart = { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${forgedRestartHash}`, restartAuthorityHash: forgedRestartHash };
    const forgedJournalBody = { schema: "setfarm.internal-production-service-restart-helper-journal.v1", family: "pre-schema-spawner-rebind", operationSchema: "setfarm.internal-production-current-entry-operation.v1", operationPurpose: "task6a-internal-production-current-entry-v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation: forgedOperation, restartAuthority: forgedRestart, transitionLock, lockIdentity: identity(forgedLockCapability), maximumDispatchCount: 1 };
    const forgedJournalHash = sha256(canonical(forgedJournalBody));
    const forgedJournalPath = path.join(fixture, "forged-journal.json");
    writeFileSync(forgedJournalPath, `${canonical({ ...forgedJournalBody, journalHash: forgedJournalHash })}\n`, { mode: 0o600 });
    const forgedJournalCapability = openSync(forgedJournalPath, "r");
    const forgedFramePath = path.join(fixture, "forged-capability-frame.json");
    writeFileSync(forgedFramePath, canonical({ schema: "setfarm.internal-production-pre-schema-spawner-rebind-restart-authority.v1", action: "task6a-pre-schema-setfarm-spawner-rebind-v1", currentEntryOperation: forgedOperation, restartAuthority: forgedRestart, journalHash: forgedJournalHash, lockIdentity: identity(forgedLockCapability), journalIdentity: identity(forgedJournalCapability) }));
    const forgedFrameCapability = openSync(forgedFramePath, "r");
    const forgedCapability = spawnSync(process.execPath, ["--import", tsxLoader, helperPath], {
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe", forgedFrameCapability, forgedLockCapability, forgedJournalCapability],
      encoding: "utf8",
      timeout: 10_000,
    });
    closeSync(forgedFrameCapability); closeSync(forgedLockCapability); closeSync(forgedJournalCapability);
    assert.notEqual(forgedCapability.status, 0, "arbitrary self-consistent fd4 must not authorize launchctl");
    assert.equal(readFileSync(counter, "utf8"), "1", "forged fd4 must cause zero physical dispatch");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 restart helper dispatches at most once", async () => {
  const source = readFileSync(helperSourcePath, "utf8");
  assert.match(source, /"baseline-service-restart"/);
  assert.match(source, /a-restart-service-setfarm-spawner-v1/);
  assert.match(source, /a-restart-service-setfarm-dashboard-v1/);
  assert.match(source, /a-restart-service-mission-control-v1/);
  assert.match(source, /journal\.maximumDispatchCount !== 1/);
  assert.doesNotMatch(source, /^export /m);

  const fixture = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-p4-baseline-helper-")));
  try {
    const internal = path.join(fixture, "src/internal-production");
    mkdirSync(internal, { recursive: true });
    installWorkspaceLocatorFixtureV1(internal, fixture);
    const counter = path.join(fixture, "dispatch-count.txt");
    const fakeLaunchctl = path.join(fixture, "fake-launchctl.sh");
    writeFileSync(fakeLaunchctl, `#!/bin/sh
count=0
[ ! -f '${counter}' ] || count=$(cat '${counter}')
count=$((count + 1))
printf '%s' "$count" > '${counter}'
`, { mode: 0o700 });
    const helperPath = path.join(internal, "baseline-service-restart-helper-v1.ts");
    writeFileSync(helperPath, source
      .replaceAll('"/bin/launchctl"', JSON.stringify(fakeLaunchctl))
      .replace('if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {', 'if (true) {'));

    const authorizationHash = "4".repeat(64);
    const authorizationRef = `setfarm://internal-production/baseline-service-restart-authorization/sha256/${authorizationHash}`;
    const operationBody = { schema: "setfarm.internal-production-baseline-service-restart-operation.v1", service: "setfarm-spawner", actionId: "a-restart-service-setfarm-spawner-v1", authorizationRef, authorizationHash };
    const operationHash = sha256(canonical(operationBody));
    const operationRef = `setfarm://internal-production/baseline-service-restart-operation/sha256/${operationHash}`;
    const restartOperation = { operationRef, operationHash };
    const operationDirectory = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-v1/operations/sha256", operationHash.slice(0, 2));
    mkdirSync(operationDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(operationDirectory, `${operationHash}.json`), `${canonical({ ...operationBody, operationRef, operationHash })}\n`, { mode: 0o600 });
    const outboxBody = { schema: "setfarm.internal-production-baseline-service-restart-launch-outbox.v1", service: operationBody.service, actionId: operationBody.actionId, authorizationRef, authorizationHash, operationRef, operationHash, maximumDispatchCount: 1 };
    const outboxHash = sha256(canonical(outboxBody));
    const outboxRef = `setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/${outboxHash}`;
    const outboxDirectory = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-v1/outboxes/sha256", outboxHash.slice(0, 2));
    mkdirSync(outboxDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(outboxDirectory, `${outboxHash}.json`), `${canonical({ ...outboxBody, outboxRef, outboxHash })}\n`, { mode: 0o600 });
    const locatorDirectory = path.join(fixture, "data/internal-production-baseline/baseline-service-restart-v1/outbox-by-operation/sha256", operationHash.slice(0, 2));
    mkdirSync(locatorDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(locatorDirectory, `${operationHash}.pair.json`), `${canonical({ operationRef, operationHash, outboxRef, outboxHash })}\n`, { mode: 0o600 });

    const retirementRoot = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1");
    const lockPath = path.join(retirementRoot, "physical-service-restart-authority.transition.lock");
    const journalDirectory = path.join(retirementRoot, "baseline-helper-journals/sha256", operationHash.slice(0, 2));
    mkdirSync(journalDirectory, { recursive: true, mode: 0o700 });
    const observed = spawnSync("/bin/ps", ["-p", String(process.pid), "-o", "lstart=,command="], { encoding: "utf8" });
    assert.equal(observed.status, 0, observed.stderr);
    const row = observed.stdout.slice(0, -1);
    const lstart = row.slice(0, 24);
    const command = row.slice(24).trimStart();
    const processStartTimeEpochMs = Date.parse(lstart);
    const processIdentityHash = sha256(canonical({ schema: "setfarm.internal-production-transition-lock-owner-process-identity.v1", pid: process.pid, processStartTimeEpochMs, lstart, command }));
    const transitionLock = { schema: "setfarm.internal-production-physical-service-restart-authority-transition-lock.v1", pid: process.pid, processStartTimeEpochMs, processIdentityHash, leaseNonce: "8".repeat(64) };
    writeFileSync(lockPath, `${canonical(transitionLock)}\n`, { mode: 0o600 });
    const lockFd = openSync(lockPath, "r");
    const lockIdentity = identity(lockFd);
    const journalBody = { schema: "setfarm.internal-production-service-restart-helper-journal.v1", family: "baseline-service-restart", operationSchema: "setfarm.internal-production-baseline-service-restart-operation.v1", action: "a-restart-service-setfarm-spawner-v1", restartOperation, transitionLock, lockIdentity, maximumDispatchCount: 1 };
    const journalHash = sha256(canonical(journalBody));
    const journalPath = path.join(journalDirectory, `${operationHash}.json`);
    writeFileSync(journalPath, `${canonical({ ...journalBody, journalHash })}\n`, { mode: 0o600 });
    const journalFd = openSync(journalPath, "r");
    const frame = { schema: "setfarm.internal-production-baseline-service-restart-helper-capability.v1", restartOperation, journalHash, lockIdentity, journalIdentity: identity(journalFd) };
    const framePath = path.join(fixture, "frame.json");
    writeFileSync(framePath, canonical(frame));
    const run = () => {
      const frameFd = openSync(framePath, "r");
      const nextLockFd = openSync(lockPath, "r");
      const nextJournalFd = openSync(journalPath, "r");
      const child = spawnSync(process.execPath, ["--import", tsxLoader, helperPath], { env: { PATH: process.env.PATH ?? "/usr/bin:/bin" }, stdio: ["ignore", "pipe", "pipe", frameFd, nextLockFd, nextJournalFd], encoding: "utf8", timeout: 10_000 });
      closeSync(frameFd); closeSync(nextLockFd); closeSync(nextJournalFd);
      return child;
    };
    closeSync(lockFd); closeSync(journalFd);
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(readFileSync(counter, "utf8"), "1");
    const replay = run();
    assert.equal(replay.status, 0, replay.stderr);
    assert.equal(readFileSync(counter, "utf8"), "1", "settled replay must not dispatch again");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 helper rejects insecure settlement-store ancestors", async () => {
  const fixture = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-p4-helper-ancestor-")));
  try {
    const internal = path.join(fixture, "src/internal-production");
    mkdirSync(internal, { recursive: true });
    installWorkspaceLocatorFixtureV1(internal, fixture);
    const source = readFileSync(helperSourcePath, "utf8").replace(
      "function publishSettlement(settlementPath: string, value: unknown): void",
      "export function publishSettlement(settlementPath: string, value: unknown): void",
    );
    const modulePath = path.join(internal, "baseline-service-restart-helper-v1.ts");
    writeFileSync(modulePath, source);
    const loaded = await import(`${pathToFileURL(modulePath).href}?ancestor=${Date.now()}`) as Readonly<{ publishSettlement: (file: string, value: unknown) => void }>;

    const insecureParent = path.join(fixture, "data");
    mkdirSync(insecureParent, { mode: 0o755 });
    chmodSync(insecureParent, 0o755);
    assert.throws(
      () => loaded.publishSettlement(path.join(insecureParent, "internal-production-baseline", "helper", "settlement.json"), { state: "bad-mode" }),
      /directory|mode|ancestor/,
    );

    chmodSync(insecureParent, 0o700);
    const external = path.join(fixture, "external-helper-store");
    mkdirSync(external, { mode: 0o700 });
    const linkedParent = path.join(insecureParent, "internal-production-baseline");
    symlinkSync(external, linkedParent);
    assert.throws(
      () => loaded.publishSettlement(path.join(linkedParent, "settlement.json"), { state: "symlink" }),
      /directory|symbolic|ancestor/,
    );

    const raceSource = source.replace(
      "const directoryGuard = ensurePrivateAuthorityDirectoryV1(path.dirname(settlementPath));\n  try {\n    directoryGuard.assertStable();",
      "const directoryGuard = ensurePrivateAuthorityDirectoryV1(path.dirname(settlementPath));\n  try {\n    const directoryRaceHook = Reflect.get(globalThis, '__setfarmP4HelperDirectoryRaceHook');\n    if (typeof directoryRaceHook === 'function') directoryRaceHook();\n    directoryGuard.assertStable();",
    );
    assert.notEqual(raceSource, source, "helper directory-race fixture must replace the exact post-authentication boundary");
    const raceModulePath = path.join(internal, "baseline-service-restart-helper-directory-race-v1.ts");
    writeFileSync(raceModulePath, raceSource);
    const raceModule = await import(`${pathToFileURL(raceModulePath).href}?directory-race=${Date.now()}`) as Readonly<{ publishSettlement: (file: string, value: unknown) => void }>;
    const raceDirectory = path.join(fixture, "race-helper-store");
    const heldRaceDirectory = `${raceDirectory}.held`;
    const externalRaceDirectory = path.join(fixture, "external-race-helper-store");
    mkdirSync(raceDirectory, { mode: 0o700 });
    mkdirSync(externalRaceDirectory, { mode: 0o700 });
    Reflect.set(globalThis, "__setfarmP4HelperDirectoryRaceHook", () => {
      renameSync(raceDirectory, heldRaceDirectory);
      symlinkSync(externalRaceDirectory, raceDirectory);
    });
    try {
      assert.throws(
        () => raceModule.publishSettlement(path.join(raceDirectory, "settlement.json"), { state: "post-authentication-directory-swap" }),
        /directory.*changed|symbolic|identity/i,
      );
      assert.throws(() => readFileSync(path.join(externalRaceDirectory, "settlement.json")), /ENOENT/);
    } finally {
      Reflect.deleteProperty(globalThis, "__setfarmP4HelperDirectoryRaceHook");
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function runStartupFamilyImportProbe({
  injectedImportUrl = null,
  retainedRequestPath = null,
}: Readonly<{ injectedImportUrl?: string | null; retainedRequestPath?: string | null }> = {}) {
  const repository = path.resolve(import.meta.dirname, "../..");
  const instrumentedModuleUrls = [
    "baseline-workspace-authority-path-v1.ts",
    "baseline-post-handoff-receipt-v1.ts",
    "baseline-spawner-startup-admission-v1.ts",
    "baseline-restart-authority-retirement-v1.ts",
    "baseline-service-restart-helper-v1.ts",
    "baseline-service-restart-sequence-v1.ts",
  ].flatMap((basename) => {
    const absolute = path.join(repository, "src/internal-production", basename);
    const physical = realpathSync(absolute);
    return [pathToFileURL(absolute).href, pathToFileURL(physical).href];
  });
  if (injectedImportUrl !== null) {
    instrumentedModuleUrls.push(injectedImportUrl);
    const physical = realpathSync(fileURLToPath(injectedImportUrl));
    instrumentedModuleUrls.push(pathToFileURL(physical).href);
  }
  const environment = { ...process.env };
  delete environment.SETFARM_PG_URL;
  delete environment.SETFARM_TEST_PG_ADMIN_URL;
  if (retainedRequestPath !== null) environment.UV_THREADPOOL_SIZE = "1";
  const program = `
    import {createHook} from "node:async_hooks";
    import childProcess from "node:child_process";
    import {pbkdf2} from "node:crypto";
    import dns from "node:dns";
    import fs from "node:fs";
    import http from "node:http";
    import https from "node:https";
    import {registerHooks,syncBuiltinESMExports} from "node:module";
    import net from "node:net";
    import tls from "node:tls";
    const probeSourceUrl=import.meta.url;
    const instrumentedModuleUrls=Object.freeze(${JSON.stringify([...new Set(instrumentedModuleUrls)])});
    await Promise.all([
      import("./src/internal-production/baseline-post-handoff-receipt-v1.ts?prewarm=receipt"),
      import("./src/internal-production/baseline-spawner-startup-admission-v1.ts?prewarm=startup"),
      import("./src/internal-production/baseline-restart-authority-retirement-v1.ts?prewarm=retirement"),
      import("./src/internal-production/baseline-service-restart-helper-v1.ts?prewarm=helper"),
      import("./src/internal-production/baseline-service-restart-sequence-v1.ts?prewarm=sequence")
    ]);
    const evaluationSetKey="__setfarmP4StartupImportEvaluationV1";
    const evaluatedSetKey="__setfarmP4StartupImportsEvaluatedV1";
    const activeInstrumentedModuleEvaluations=new Set();
    const evaluatedInstrumentedModuleUrls=new Set();
    globalThis[evaluationSetKey]=activeInstrumentedModuleEvaluations;
    globalThis[evaluatedSetKey]=evaluatedInstrumentedModuleUrls;
    const isInstrumentedModuleUrl=(url)=>instrumentedModuleUrls.some((candidate)=>url===candidate || url.startsWith(candidate+"?"));
    registerHooks({
      load(url,context,nextLoad){
        const loaded=nextLoad(url,context);
        if(!isInstrumentedModuleUrl(url)) return loaded;
        if(loaded.format!=="module" || loaded.source===null || loaded.source===undefined){
          throw new Error("IMPORT_INSTRUMENTATION_SOURCE_MISSING:"+url);
        }
        const prefix="globalThis["+JSON.stringify(evaluationSetKey)+"].add("+JSON.stringify(url)+");globalThis["+JSON.stringify(evaluatedSetKey)+"].add("+JSON.stringify(url)+");\\n";
        const suffix="\\nglobalThis["+JSON.stringify(evaluationSetKey)+"].delete("+JSON.stringify(url)+");\\n";
        const sourceText=typeof loaded.source==="string" ? loaded.source : new TextDecoder().decode(loaded.source);
        return {...loaded,source:prefix+sourceText+suffix};
      }
    });
    const allowedTaintedAsyncResourceTypes=Object.freeze([]);
    const allowedTaintedAsyncResourceTypeSet=new Set(allowedTaintedAsyncResourceTypes);
    const taintedAsyncIds=new Set();
    const observedTaintedAsyncResourceTypes=new Set();
    const importEvaluationHook=createHook({
      init(asyncId,type,triggerAsyncId){
        if(activeInstrumentedModuleEvaluations.size===0 && !taintedAsyncIds.has(triggerAsyncId)) return;
        taintedAsyncIds.add(asyncId);
        if(!allowedTaintedAsyncResourceTypeSet.has(type)) observedTaintedAsyncResourceTypes.add(type);
      },
      destroy(asyncId){
        taintedAsyncIds.delete(asyncId);
      }
    });
    importEvaluationHook.enable();
    const forbidden=(name)=>{throw new Error("IMPORT_SIDE_EFFECT_"+name)};
    const retainedStat=fs.promises.stat.bind(fs.promises);
    for(const name of ["spawn","spawnSync","exec","execSync","execFile","execFileSync","fork"]){
      childProcess[name]=()=>forbidden("child_process."+name);
    }
    const historicalReadOnlySyncCallableNames=Object.freeze([
      "accessSync","existsSync","fstatSync","lstatSync","opendirSync","readFileSync",
      "readdirSync","readlinkSync","realpathSync","statSync","statfsSync","readSync"
    ]);
    const historicalReadOnlySyncCallableNameSet=new Set(historicalReadOnlySyncCallableNames);
    for(const name of historicalReadOnlySyncCallableNames){
      const descriptor=Object.getOwnPropertyDescriptor(fs,name);
      if(descriptor===undefined) continue;
      if(typeof descriptor.value!=="function") forbidden("instrumentation_read_only_sync_semantics_"+name);
    }
    const originalSyncCallableNames=Reflect.ownKeys(fs).filter((key)=>
      typeof key==="string"
      && key.endsWith("Sync")
      && typeof Object.getOwnPropertyDescriptor(fs,key)?.value==="function"
    );
    const originalSyncCallableDescriptors=new Map(originalSyncCallableNames.map((name)=>[
      name,Object.getOwnPropertyDescriptor(fs,name)
    ]));
    const syncCallableClassifications=new Map();
    const forbiddenSyncCallables=new Map();
    const isNodeReadFileSyncInternalClose=()=>{
      const immediateCaller=(new Error().stack ?? "").split("\\n").slice(1).find((frame)=>!frame.includes(probeSourceUrl));
      return immediateCaller!==undefined && /^at (?:Object\\.)?readFileSync \\(node:fs:\\d+:\\d+\\)$/.test(immediateCaller.trim());
    };
    const originalOpenSync=fs.openSync;
    const isMutatingOpenSync=(args)=>{
      const flags=args[1];
      return typeof flags==="string"
        ? /[wa+]/.test(flags)
        : typeof flags==="number"
          && (flags&(fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_APPEND|fs.constants.O_CREAT|fs.constants.O_TRUNC))!==0;
    };
    const guardedOpenSync=new Proxy(originalOpenSync,{
      apply(target,thisArg,args){
        if(isMutatingOpenSync(args)) return forbidden("fs.openSync.mutating");
        return Reflect.apply(target,thisArg,args);
      },
      construct(target,args,newTarget){
        if(isMutatingOpenSync(args)) return forbidden("fs.openSync.mutating");
        return Reflect.construct(target,args,newTarget);
      }
    });
    const protectedSyncCallablePrototypes=new Map();
    const protectSyncCallableAuthority=(name,original,replacement)=>{
      const ownCallableKeys=Reflect.ownKeys(original).filter((key)=>{
        const descriptor=Object.getOwnPropertyDescriptor(original,key);
        return typeof descriptor?.value==="function" || typeof descriptor?.get==="function" || typeof descriptor?.set==="function";
      });
      if(ownCallableKeys.length!==0) forbidden("instrumentation_sync_function_authority_"+name+":"+ownCallableKeys.map(String).join(","));
      const functionPrototypeDescriptor=Object.getOwnPropertyDescriptor(original,"prototype");
      const functionPrototype=functionPrototypeDescriptor?.value;
      if(functionPrototype===null || typeof functionPrototype!=="object"){
        protectedSyncCallablePrototypes.set(name,null);
        return;
      }
      const prototypeCallableKeys=Reflect.ownKeys(functionPrototype).filter((key)=>{
        const descriptor=Object.getOwnPropertyDescriptor(functionPrototype,key);
        return key!=="constructor" && (typeof descriptor?.value==="function" || typeof descriptor?.get==="function" || typeof descriptor?.set==="function");
      });
      if(prototypeCallableKeys.length!==0) forbidden("instrumentation_sync_prototype_authority_"+name+":"+prototypeCallableKeys.map(String).join(","));
      const constructorDescriptor=Object.getOwnPropertyDescriptor(functionPrototype,"constructor");
      if(constructorDescriptor===undefined || constructorDescriptor.value!==original) forbidden("instrumentation_sync_prototype_constructor_"+name);
      Object.defineProperty(functionPrototype,"constructor",{...constructorDescriptor,value:replacement});
      protectedSyncCallablePrototypes.set(name,functionPrototype);
    };
    for(const name of originalSyncCallableNames){
      const descriptor=originalSyncCallableDescriptors.get(name);
      if(descriptor===undefined || typeof descriptor.value!=="function") forbidden("instrumentation_sync_inventory_changed_"+name);
      const original=descriptor.value;
      if(historicalReadOnlySyncCallableNameSet.has(name)){
        syncCallableClassifications.set(name,"read-only");
        continue;
      }
      const replacement=name==="openSync" ? guardedOpenSync : new Proxy(original,{
        apply(target,thisArg,args){
          if(name==="closeSync" && isNodeReadFileSyncInternalClose()) return Reflect.apply(target,thisArg,args);
          return forbidden("fs."+name);
        },
        construct(_target,_args,_newTarget){
          return forbidden("fs."+name);
        }
      });
      Object.defineProperty(fs,name,{...descriptor,value:replacement});
      protectSyncCallableAuthority(name,original,replacement);
      syncCallableClassifications.set(name,name==="openSync" ? "open" : "forbidden");
      if(name!=="openSync") forbiddenSyncCallables.set(name,replacement);
    }
    for(const name of ["appendFile","chmod","chown","copyFile","cp","link","mkdir","open","rename","rm","rmdir","symlink","truncate","unlink","writeFile","write","ftruncate"]){
      fs[name]=()=>forbidden("fs."+name);
    }
    for(const name of ["appendFile","chmod","chown","copyFile","cp","link","mkdir","open","rename","rm","rmdir","symlink","truncate","unlink","writeFile"]){
      fs.promises[name]=()=>forbidden("fs.promises."+name);
    }
    const afterSyncCallableNames=Reflect.ownKeys(fs).filter((key)=>
      typeof key==="string"
      && key.endsWith("Sync")
      && typeof Object.getOwnPropertyDescriptor(fs,key)?.value==="function"
    );
    if(JSON.stringify(afterSyncCallableNames)!==JSON.stringify(originalSyncCallableNames)){
      forbidden("instrumentation_sync_callable_inventory");
    }
    for(const name of afterSyncCallableNames){
      const currentDescriptor=Object.getOwnPropertyDescriptor(fs,name);
      const originalDescriptor=originalSyncCallableDescriptors.get(name);
      const current=currentDescriptor?.value;
      const classification=syncCallableClassifications.get(name);
      const classifiedExactly=
        classification==="read-only" && current===originalDescriptor?.value
        || classification==="open" && name==="openSync" && current===guardedOpenSync
        || classification==="forbidden" && current===forbiddenSyncCallables.get(name);
      const descriptorSemanticsPreserved=
        currentDescriptor?.writable===originalDescriptor?.writable
        && currentDescriptor?.enumerable===originalDescriptor?.enumerable
        && currentDescriptor?.configurable===originalDescriptor?.configurable;
      let callableAuthorityClosed=true;
      if(classification!=="read-only"){
        const ownCallableKeys=Reflect.ownKeys(current).filter((key)=>{
          const descriptor=Object.getOwnPropertyDescriptor(current,key);
          return typeof descriptor?.value==="function" || typeof descriptor?.get==="function" || typeof descriptor?.set==="function";
        });
        const functionPrototype=Object.getOwnPropertyDescriptor(current,"prototype")?.value;
        const expectedPrototype=protectedSyncCallablePrototypes.get(name);
        callableAuthorityClosed=ownCallableKeys.length===0
          && (expectedPrototype===null || functionPrototype===expectedPrototype && functionPrototype.constructor===current);
      }
      if(!classifiedExactly || !descriptorSemanticsPreserved || !callableAuthorityClosed) forbidden("instrumentation_sync_classification_"+name);
    }
    for(const name of ["connect","createConnection"]){
      net[name]=()=>forbidden("net."+name);
    }
    net.Socket.prototype.connect=()=>forbidden("net.Socket.connect");
    for(const name of ["get","request"]){
      http[name]=()=>forbidden("http."+name);
      https[name]=()=>forbidden("https."+name);
    }
    tls.connect=()=>forbidden("tls.connect");
    for(const name of ["lookup","resolve","resolve4","resolve6","resolveAny","resolveCaa","resolveCname","resolveMx","resolveNaptr","resolveNs","resolvePtr","resolveSoa","resolveSrv","resolveTxt","reverse"]){
      dns[name]=()=>forbidden("dns."+name);
      dns.promises[name]=()=>forbidden("dns.promises."+name);
    }
    if(typeof globalThis.fetch==="function") globalThis.fetch=()=>forbidden("fetch");
    syncBuiltinESMExports();
    const before=process._getActiveHandles().length;
    const requestsBefore=new Set(process._getActiveRequests());
    await Promise.all([
      import("./src/internal-production/baseline-post-handoff-receipt-v1.ts?inert=receipt"),
      import("./src/internal-production/baseline-spawner-startup-admission-v1.ts?inert=startup"),
      import("./src/internal-production/baseline-restart-authority-retirement-v1.ts?inert=retirement"),
      import("./src/internal-production/baseline-service-restart-helper-v1.ts?inert=helper"),
      import("./src/internal-production/baseline-service-restart-sequence-v1.ts?inert=sequence"),
      ...(${JSON.stringify(injectedImportUrl)}===null ? [] : [import(${JSON.stringify(injectedImportUrl)})])
    ]);
    const expectedInstrumentedEvaluationCount=5+(${JSON.stringify(injectedImportUrl)}===null ? 0 : 1);
    if(activeInstrumentedModuleEvaluations.size!==0 || evaluatedInstrumentedModuleUrls.size!==expectedInstrumentedEvaluationCount){
      throw new Error("IMPORT_EVALUATION_INSTRUMENTATION_MISMATCH:"+evaluatedInstrumentedModuleUrls.size+"/"+expectedInstrumentedEvaluationCount);
    }
    const retainedRequestPath=${JSON.stringify(retainedRequestPath)};
    if(retainedRequestPath!==null){
      pbkdf2("startup-import-probe","setfarm",40_000_000,32,"sha256",()=>{});
      void retainedStat(retainedRequestPath);
    }
    const requestQuiescenceDeadline=process.hrtime.bigint()+2_000_000_000n;
    let newRequests=[];
    let consecutiveZeroRequestObservations=0;
    do {
      await new Promise((resolve)=>setTimeout(resolve,5));
      newRequests=process._getActiveRequests().filter((request)=>!requestsBefore.has(request));
      consecutiveZeroRequestObservations=newRequests.length===0 ? consecutiveZeroRequestObservations+1 : 0;
    } while(consecutiveZeroRequestObservations<2 && process.hrtime.bigint()<requestQuiescenceDeadline);
    if(observedTaintedAsyncResourceTypes.size!==0){
      throw new Error("IMPORT_TAINTED_ASYNC_RESOURCE:"+[...observedTaintedAsyncResourceTypes].sort().join(","));
    }
    if(process._getActiveHandles().length!==before) throw new Error("IMPORT_CREATED_ACTIVE_HANDLE");
    if(consecutiveZeroRequestObservations!==2){
      const requestKinds=newRequests.map((request)=>request?.constructor?.name ?? typeof request).join(",");
      throw new Error("IMPORT_CREATED_ACTIVE_REQUEST:"+requestKinds);
    }
    importEvaluationHook.disable();
    process.stdout.write("IMPORT_INERT_OK\\n");
  `;
  return spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", program], {
    cwd: repository,
    env: environment,
    encoding: "utf8",
    timeout: 10_000,
  });
}

test("P4 startup family imports are inert in a fresh database-free child", () => {
  const child = runStartupFamilyImportProbe();
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, "IMPORT_INERT_OK\n");
});

test("P4 startup inert-import provenance rejects a fast completed filesystem request", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-startup-import-fast-request-"));
  try {
    const injectedModulePath = path.join(fixture, "fast-request.mjs");
    writeFileSync(injectedModulePath, `import fs from "node:fs"; await fs.promises.stat(${JSON.stringify(helperSourcePath)});\n`);
    const child = runStartupFamilyImportProbe({ injectedImportUrl: pathToFileURL(injectedModulePath).href });
    assert.notEqual(child.status, 0, child.stdout);
    assert.match(child.stderr, /IMPORT_TAINTED_ASYNC_RESOURCE:[^\n]*FSREQPROMISE/);
    assert.equal(child.stdout, "");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 startup inert-import provenance rejects a fast completed statfs request", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-startup-import-statfs-"));
  try {
    const injectedModulePath = path.join(fixture, "fast-statfs-request.mjs");
    writeFileSync(injectedModulePath, `import fs from "node:fs"; await fs.promises.statfs(${JSON.stringify(helperSourcePath)});\n`);
    const child = runStartupFamilyImportProbe({ injectedImportUrl: pathToFileURL(injectedModulePath).href });
    assert.notEqual(child.status, 0, child.stdout);
    assert.match(child.stderr, /IMPORT_TAINTED_ASYNC_RESOURCE:[^\n]*FSREQPROMISE/);
    assert.equal(child.stdout, "");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 startup inert-import synchronous inventory rejects mkdtempSync", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-startup-import-mkdtemp-sync-"));
  try {
    const injectedModulePath = path.join(fixture, "mkdtemp-sync.mjs");
    writeFileSync(
      injectedModulePath,
      `import {mkdtempSync} from "node:fs";\nmkdtempSync(${JSON.stringify(path.join(fixture, "created-"))});\n`,
    );
    const child = runStartupFamilyImportProbe({ injectedImportUrl: pathToFileURL(injectedModulePath).href });
    assert.notEqual(child.status, 0, child.stdout);
    assert.match(child.stderr, /IMPORT_SIDE_EFFECT_fs\.mkdtempSync/);
    assert.deepEqual(readdirSync(fixture), ["mkdtemp-sync.mjs"]);
    assert.equal(child.stdout, "");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 startup inert-import synchronous inventory rejects prototype constructor escape", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-startup-import-sync-prototype-"));
  try {
    const injectedModulePath = path.join(fixture, "sync-prototype.mjs");
    writeFileSync(
      injectedModulePath,
      `import fs from "node:fs";\nfs.mkdtempSync.prototype.constructor(${JSON.stringify(path.join(fixture, "created-"))});\n`,
    );
    const child = runStartupFamilyImportProbe({ injectedImportUrl: pathToFileURL(injectedModulePath).href });
    assert.notEqual(child.status, 0, child.stdout);
    assert.match(child.stderr, /IMPORT_SIDE_EFFECT_fs\.mkdtempSync/);
    assert.deepEqual(readdirSync(fixture), ["sync-prototype.mjs"]);
    assert.equal(child.stdout, "");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 startup inert-import synchronous inventory preserves nested read-only calls", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-startup-import-read-only-sync-"));
  try {
    const injectedModulePath = path.join(fixture, "read-only-sync.mjs");
    writeFileSync(
      injectedModulePath,
      `import fs from "node:fs";\nif(fs.realpathSync.native(${JSON.stringify(helperSourcePath)})!==${JSON.stringify(realpathSync(helperSourcePath))}) throw new Error("READ_ONLY_SYNC_SEMANTICS_CHANGED");\n`,
    );
    const child = runStartupFamilyImportProbe({ injectedImportUrl: pathToFileURL(injectedModulePath).href });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout, "IMPORT_INERT_OK\n");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 startup inert-import synchronous inventory rejects mutator reentrancy from read-only options", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-startup-import-sync-reentrancy-"));
  try {
    const injectedModulePath = path.join(fixture, "sync-reentrancy.mjs");
    writeFileSync(
      injectedModulePath,
      `import fs from "node:fs";\nfs.statSync(${JSON.stringify(helperSourcePath)},{get bigint(){fs.mkdtempSync(${JSON.stringify(path.join(fixture, "created-"))});return false;}});\n`,
    );
    const child = runStartupFamilyImportProbe({ injectedImportUrl: pathToFileURL(injectedModulePath).href });
    assert.notEqual(child.status, 0, child.stdout);
    assert.match(child.stderr, /IMPORT_SIDE_EFFECT_fs\.mkdtempSync/);
    assert.deepEqual(readdirSync(fixture), ["sync-reentrancy.mjs"]);
    assert.equal(child.stdout, "");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 startup inert-import synchronous inventory rejects close reentrancy from readFileSync options", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-startup-import-close-reentrancy-"));
  try {
    const injectedModulePath = path.join(fixture, "close-reentrancy.mjs");
    writeFileSync(
      injectedModulePath,
      `import fs from "node:fs";\nconst descriptor=fs.openSync(${JSON.stringify(helperSourcePath)},"r");\nfs.readFileSync(${JSON.stringify(helperSourcePath)},{get encoding(){fs.closeSync(descriptor);return "utf8";}});\n`,
    );
    const child = runStartupFamilyImportProbe({ injectedImportUrl: pathToFileURL(injectedModulePath).href });
    assert.notEqual(child.status, 0, child.stdout);
    assert.match(child.stderr, /IMPORT_SIDE_EFFECT_fs\.closeSync/);
    assert.equal(child.stdout, "");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 startup inert-import provenance rejects an accessor-created write stream", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-startup-import-write-stream-"));
  try {
    const victimPath = path.join(fixture, "victim.txt");
    const injectedModulePath = path.join(fixture, "write-stream.mjs");
    writeFileSync(victimPath, "unchanged\n");
    writeFileSync(
      injectedModulePath,
      `import fs from "node:fs";\nconst stream=new fs.WriteStream(${JSON.stringify(victimPath)},{flags:"wx"});\nawait new Promise((resolve,reject)=>{stream.once("error",resolve);stream.once("open",()=>reject(new Error("WRITE_STREAM_UNEXPECTEDLY_OPENED")));});\n`,
    );
    const child = runStartupFamilyImportProbe({ injectedImportUrl: pathToFileURL(injectedModulePath).href });
    assert.notEqual(child.status, 0, child.stdout);
    assert.match(child.stderr, /IMPORT_TAINTED_ASYNC_RESOURCE:[^\n]*(?:FSREQCALLBACK|TickObject)/);
    assert.equal(child.stdout, "");
    assert.equal(readFileSync(victimPath, "utf8"), "unchanged\n");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

for (const asyncEffect of [
  { name: "timer", source: "setTimeout(()=>{},0);\n", resourceType: "Timeout" },
  {
    name: "crypto work",
    source: 'import {pbkdf2} from "node:crypto"; await new Promise((resolve,reject)=>pbkdf2("p4","salt",1,8,"sha256",(error)=>error?reject(error):resolve()));\n',
    resourceType: "PBKDF2REQUEST",
  },
] as const) {
  test(`P4 startup inert-import provenance rejects ${asyncEffect.name}`, () => {
    const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-startup-import-async-effect-"));
    try {
      const injectedModulePath = path.join(fixture, "async-effect.mjs");
      writeFileSync(injectedModulePath, asyncEffect.source);
      const child = runStartupFamilyImportProbe({ injectedImportUrl: pathToFileURL(injectedModulePath).href });
      assert.notEqual(child.status, 0, child.stdout);
      assert.match(child.stderr, new RegExp(`IMPORT_TAINTED_ASYNC_RESOURCE:[^\\n]*${asyncEffect.resourceType}`));
      assert.equal(child.stdout, "");
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}

test("P4 startup inert-import provenance rejects an otherwise inert Promise", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-startup-import-promise-"));
  try {
    const injectedModulePath = path.join(fixture, "promise.mjs");
    writeFileSync(injectedModulePath, "new Promise(()=>{});\n");
    const child = runStartupFamilyImportProbe({ injectedImportUrl: pathToFileURL(injectedModulePath).href });
    assert.notEqual(child.status, 0, child.stdout);
    assert.match(child.stderr, /IMPORT_TAINTED_ASYNC_RESOURCE:[^\n]*PROMISE/);
    assert.equal(child.stdout, "");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 startup inert-import provenance follows a detached Promise chain to fast filesystem work", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-startup-import-detached-promise-"));
  try {
    const injectedModulePath = path.join(fixture, "detached-promise.mjs");
    writeFileSync(
      injectedModulePath,
      `import fs from "node:fs";\nlet chain=Promise.resolve();\nfor(let index=0;index<200;index++) chain=chain.then(()=>{});\nvoid chain.then(()=>fs.promises.stat(${JSON.stringify(helperSourcePath)}));\n`,
    );
    const child = runStartupFamilyImportProbe({ injectedImportUrl: pathToFileURL(injectedModulePath).href });
    assert.notEqual(child.status, 0, child.stdout);
    assert.match(child.stderr, /IMPORT_TAINTED_ASYNC_RESOURCE:[^\n]*FSREQPROMISE/);
    assert.equal(child.stdout, "");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("P4 startup inert-import quiescence rejects a retained active request", () => {
  const child = runStartupFamilyImportProbe({ retainedRequestPath: helperSourcePath });
  assert.notEqual(child.status, 0, child.stdout);
  assert.match(child.stderr, /IMPORT_CREATED_ACTIVE_REQUEST:FSReqPromise/);
  assert.equal(child.stdout, "");
});
