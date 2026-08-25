import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, closeSync, fstatSync, linkSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const tsxLoader = import.meta.resolve("tsx");

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

  const fixture = mkdtempSync(path.join(tmpdir(), "setfarm-p4-helper-"));
  try {
    const internal = path.join(fixture, "src/internal-production");
    mkdirSync(internal, { recursive: true });
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
      .replace('"/bin/launchctl"', JSON.stringify(fakeLaunchctl))
      .replace('if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {', 'if (true) {'));
    const operationHash = "a".repeat(64);
    const restartHash = "b".repeat(64);
    const currentEntryOperation = { operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash };
    const restartAuthority = { restartAuthorityRef: `setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/${restartHash}`, restartAuthorityHash: restartHash };
    const lockPath = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/physical-service-restart-authority.transition.lock");
    const journalPath = path.join(fixture, "data/internal-production-baseline/restart-authority-retirement-v1/pre-schema-helper-journal.json");
    mkdirSync(path.dirname(lockPath), { recursive: true });
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
      .replace('"/bin/launchctl"', JSON.stringify(fakeLaunchctl))
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
      .replace('"/bin/launchctl"', JSON.stringify(fakeLaunchctl))
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

test("P4 startup family imports are inert in a fresh database-free child", () => {
  const repository = path.resolve(import.meta.dirname, "../..");
  const environment = { ...process.env };
  delete environment.SETFARM_PG_URL;
  delete environment.SETFARM_TEST_PG_ADMIN_URL;
  const program = `
    import childProcess from "node:child_process";
    import fs from "node:fs";
    import {syncBuiltinESMExports} from "node:module";
    await Promise.all([
      import("./src/internal-production/baseline-post-handoff-receipt-v1.ts?prewarm=receipt"),
      import("./src/internal-production/baseline-spawner-startup-admission-v1.ts?prewarm=startup"),
      import("./src/internal-production/baseline-restart-authority-retirement-v1.ts?prewarm=retirement"),
      import("./src/internal-production/baseline-service-restart-helper-v1.ts?prewarm=helper")
    ]);
    const forbidden=(name)=>{throw new Error("IMPORT_SIDE_EFFECT_"+name)};
    const originalOpenSync=fs.openSync;
    for(const name of ["spawn","spawnSync","exec","execSync","execFile","execFileSync","fork"]){
      childProcess[name]=()=>forbidden("child_process."+name);
    }
    for(const name of ["appendFileSync","chmodSync","chownSync","copyFileSync","cpSync","linkSync","mkdirSync","renameSync","rmSync","rmdirSync","symlinkSync","truncateSync","unlinkSync","writeFileSync"]){
      fs[name]=()=>forbidden("fs."+name);
    }
    for(const name of ["appendFile","chmod","chown","copyFile","cp","link","mkdir","open","rename","rm","rmdir","symlink","truncate","unlink","writeFile","write","writeSync","ftruncate","ftruncateSync"]){
      fs[name]=()=>forbidden("fs."+name);
    }
    fs.openSync=(target,flags,...rest)=>{
      const mutating=typeof flags==="string" ? /[wa+]/.test(flags) : (flags&(fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_APPEND|fs.constants.O_CREAT|fs.constants.O_TRUNC))!==0;
      if(mutating) return forbidden("fs.openSync.mutating");
      return originalOpenSync(target,flags,...rest);
    };
    for(const name of ["appendFile","chmod","chown","copyFile","cp","link","mkdir","open","rename","rm","rmdir","symlink","truncate","unlink","writeFile"]){
      fs.promises[name]=()=>forbidden("fs.promises."+name);
    }
    syncBuiltinESMExports();
    const before=process._getActiveHandles().length;
    const requestsBefore=new Set(process._getActiveRequests());
    await Promise.all([
      import("./src/internal-production/baseline-post-handoff-receipt-v1.ts?inert=receipt"),
      import("./src/internal-production/baseline-spawner-startup-admission-v1.ts?inert=startup"),
      import("./src/internal-production/baseline-restart-authority-retirement-v1.ts?inert=retirement"),
      import("./src/internal-production/baseline-service-restart-helper-v1.ts?inert=helper")
    ]);
    let newRequests=[];
    for(let attempt=0;attempt<16;attempt++){
      await new Promise((resolve)=>setImmediate(resolve));
      newRequests=process._getActiveRequests().filter((request)=>!requestsBefore.has(request));
      if(newRequests.length===0) break;
    }
    if(process._getActiveHandles().length!==before) throw new Error("IMPORT_CREATED_ACTIVE_HANDLE");
    if(newRequests.length!==0) throw new Error("IMPORT_CREATED_ACTIVE_REQUEST");
    process.stdout.write("IMPORT_INERT_OK\\n");
  `;
  const child = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", program], {
    cwd: repository,
    env: environment,
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, "IMPORT_INERT_OK\n");
});
