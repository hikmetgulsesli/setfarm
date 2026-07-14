import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, open, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { promisify } from "node:util";

import { observeProcessIdentity } from "../../src/execution/process-identity.js";
import {
  challengeDarwinIsolatedRuntime,
  createWriteFreeDarwinIsolationBundle,
  spawnDarwinIsolatedRuntime,
} from "../../src/execution/v3-darwin-runtime-isolation.js";
import {
  hashRuntimeDataContractV1,
  RuntimeDataContractV1Schema,
} from "../../src/product-compiler/schemas/runtime-data-contract-v1.js";

const temporaryRoots = new Set<string>();
const processGroups = new Set<number>();
const reservedServers = new Set<ReturnType<typeof createServer>>();
const execFileAsync = promisify(execFile);
const isolationConfigRoots = {
  setfarmConfigRoot: path.resolve("."),
  // The isolation contract only requires two existing canonical denied-read
  // roots. Do not make this test depend on a sibling Mission Control checkout.
  missionControlConfigRoot: path.resolve(".."),
};

afterEach(async () => {
  for (const pid of processGroups) {
    try { process.kill(-pid, "SIGKILL"); } catch { /* already stopped */ }
  }
  processGroups.clear();
  await Promise.all([...reservedServers].map(async (server) => {
    if (!server.listening) return;
    await closeServer(server).catch(() => undefined);
  }));
  reservedServers.clear();
  await Promise.all([...temporaryRoots].map((root) => rm(root, { recursive: true, force: true })));
  temporaryRoots.clear();
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(await realpath(os.homedir()), ".setfarm-v3-isolation-test-"));
  temporaryRoots.add(root);
  return root;
}

async function reservePort() {
  const server = createServer();
  reservedServers.add(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { server, port: address.port };
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  reservedServers.delete(server);
}

async function waitForHealth(port: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(250) });
      const body = await response.text();
      if (response.status === 200 && body === "ok") return;
    } catch { /* bounded retry */ }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("isolated runtime did not become healthy");
}

async function listenerPids(port: number): Promise<number[]> {
  const { stdout } = await execFileAsync("lsof", ["-nP", "-a", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"]);
  return [...new Set(stdout.split(/\r?\n/)
    .filter((entry) => /^p[1-9][0-9]*$/.test(entry))
    .map((entry) => Number(entry.slice(1))))];
}

async function waitForIdentity(pid: number) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const identity = observeProcessIdentity(pid);
    if (identity) return identity;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("test process identity unavailable");
}

describe("v3 Darwin runtime isolation", { skip: process.platform !== "darwin" }, () => {
  it("starts and rechallenges a write-free local runtime with exact denied capabilities", async () => {
    const root = await temporaryRoot();
    const stateRoot = path.join(root, "state");
    const sealedRoot = path.join(root, "sealed");
    const logRoot = path.join(root, "logs");
    await Promise.all([mkdir(stateRoot), mkdir(sealedRoot), mkdir(logRoot)]);
    const logPath = path.join(logRoot, "runtime.log");
    await (await open(logPath, "wx", 0o600)).close();
    await writeFile(path.join(sealedRoot, "server.cjs"), [
      "const http = require('node:http');",
      "http.createServer((_request, response) => response.end('ok')).listen(Number(process.env.PORT), '127.0.0.1');",
      "setInterval(() => {}, 1000);",
      "",
    ].join("\n"));
    const gatePath = path.join(stateRoot, "launch.go");
    const gate = { schema: "test.gate.v1", token: randomUUID() };
    const runtimeDataContract = RuntimeDataContractV1Schema.parse({
      schema: "setfarm.runtime-data-contract.v1",
      contractVersion: 1,
      sourceProductSpecHash: "a".repeat(64),
      delivery: { platform: "api", techStack: "node-express", database: "none" },
      policyBindings: [],
      authorities: [{ id: "AUTH_DATA_STATELESS", kind: "stateless", durability: "none", persistenceRefs: [] }],
      writableVolumes: [],
      scratch: { kind: "none" },
    });
    const runtimeDataContractHash = hashRuntimeDataContractV1(runtimeDataContract);
    const previewArgv = [process.execPath, "server.cjs"];
    const reservation = await reservePort();
    const environment = {
      PATH: process.env.PATH,
      HOME: sealedRoot,
      TMPDIR: sealedRoot,
      XDG_CACHE_HOME: sealedRoot,
      NODE_ENV: "production",
      PORT: String(reservation.port),
    };
    const isolation = createWriteFreeDarwinIsolationBundle({
      runId: "run-isolation-0001",
      projectId: "project-isolation-0001",
      candidateHash: "b".repeat(64),
      buildArtifactHash: "c".repeat(64),
      stateRoot,
      sealedRuntimeRoot: sealedRoot,
      gatePath,
      logPath,
      previewArgv,
      environment,
      runtimeDataContract,
      runtimeDataContractHash,
      ...isolationConfigRoots,
    });
    const spawned = await spawnDarwinIsolatedRuntime({
      gatePath,
      expectedGate: gate,
      cwd: sealedRoot,
      argv: previewArgv,
      environment,
      logPath,
      isolation,
    });
    assert.ok(spawned.child.pid);
    processGroups.add(spawned.child.pid);
    const wrapperProcessIdentity = await waitForIdentity(spawned.child.pid);
    assert.equal(wrapperProcessIdentity.processGroupId, wrapperProcessIdentity.pid);
    assert.deepEqual(spawned.startup.deniedSignalProbes, [{ authorityId: "control-sentinel", outcome: "denied" }]);
    await closeServer(reservation.server);
    await writeFile(gatePath, `${JSON.stringify(gate)}\n`, { flag: "wx", mode: 0o600 });
    await waitForHealth(reservation.port);
    const pids = await listenerPids(reservation.port);
    assert.equal(pids.length, 1);
    const listener = await waitForIdentity(pids[0]!);
    assert.equal(listener.processGroupId, wrapperProcessIdentity.pid);
    const challenge = await challengeDarwinIsolatedRuntime({
      controlPort: spawned.controlPort,
      controlToken: spawned.controlToken,
      authorityHash: isolation.authority.authorityHash,
      wrapperProcessIdentity,
    });
    assert.equal(challenge.authorityHash, isolation.authority.authorityHash);
    assert.deepEqual(challenge.deniedRootProbes, [
      { rootId: "sealed-runtime", outcome: "denied" },
      { rootId: "state-authority", outcome: "denied" },
    ]);
    assert.deepEqual(challenge.deniedReadProbes.map((entry) => entry.authorityId), [
      "launch-agents",
      "mission-control-config",
      "setfarm-config",
    ]);
    assert.deepEqual(challenge.deniedNetworkProbes, [{ authorityId: "all-outbound", outcome: "denied" }]);
    assert.deepEqual(challenge.deniedProcessExecProbes, [{ executableId: "launchctl", outcome: "denied" }]);
    assert.deepEqual(challenge.deniedSignalProbes, [{ authorityId: "control-sentinel", outcome: "denied" }]);
    process.kill(-wrapperProcessIdentity.pid, "SIGTERM");
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("isolated process group did not stop")), 3_000);
      spawned.child.once("close", () => { clearTimeout(timeout); resolve(); });
    });
    processGroups.delete(wrapperProcessIdentity.pid);
  });

  it("rejects symlinked log and gate authority paths before sandbox launch", async () => {
    const root = await temporaryRoot();
    const stateRoot = path.join(root, "state");
    const sealedRoot = path.join(root, "sealed");
    const logRoot = path.join(root, "logs");
    await Promise.all([mkdir(stateRoot), mkdir(sealedRoot), mkdir(logRoot)]);
    const target = path.join(logRoot, "target.log");
    await writeFile(target, "");
    const symlinkedLog = path.join(logRoot, "runtime.log");
    await symlink(target, symlinkedLog);
    const runtimeDataContract = RuntimeDataContractV1Schema.parse({
      schema: "setfarm.runtime-data-contract.v1",
      contractVersion: 1,
      sourceProductSpecHash: "a".repeat(64),
      delivery: { platform: "api", techStack: "node-express", database: "none" },
      policyBindings: [],
      authorities: [{ id: "AUTH_DATA_STATELESS", kind: "stateless", durability: "none", persistenceRefs: [] }],
      writableVolumes: [],
      scratch: { kind: "none" },
    });
    assert.throws(() => createWriteFreeDarwinIsolationBundle({
      runId: "run-isolation-0002",
      projectId: "project-isolation-0002",
      candidateHash: "b".repeat(64),
      buildArtifactHash: "c".repeat(64),
      stateRoot,
      sealedRuntimeRoot: sealedRoot,
      gatePath: path.join(stateRoot, "launch.go"),
      logPath: symlinkedLog,
      previewArgv: [process.execPath, "server.cjs"],
      environment: { PATH: process.env.PATH },
      runtimeDataContract,
      runtimeDataContractHash: hashRuntimeDataContractV1(runtimeDataContract),
      ...isolationConfigRoots,
    }), /V3_DEPLOY_ISOLATION_LOG_PATH_UNSAFE/);
    const regularLog = path.join(logRoot, "regular.log");
    await writeFile(regularLog, "");
    const gateTarget = path.join(stateRoot, "gate-target");
    await writeFile(gateTarget, "");
    const symlinkedGate = path.join(stateRoot, "launch.go");
    await symlink(gateTarget, symlinkedGate);
    assert.throws(() => createWriteFreeDarwinIsolationBundle({
      runId: "run-isolation-0003",
      projectId: "project-isolation-0003",
      candidateHash: "b".repeat(64),
      buildArtifactHash: "c".repeat(64),
      stateRoot,
      sealedRuntimeRoot: sealedRoot,
      gatePath: symlinkedGate,
      logPath: regularLog,
      previewArgv: [process.execPath, "server.cjs"],
      environment: { PATH: process.env.PATH },
      runtimeDataContract,
      runtimeDataContractHash: hashRuntimeDataContractV1(runtimeDataContract),
      ...isolationConfigRoots,
    }), /V3_DEPLOY_ISOLATION_GATE_PATH_UNSAFE/);
  });

  it("keeps the isolation source free of embedded NUL bytes", async () => {
    const sourcePath = new URL("../../src/execution/v3-darwin-runtime-isolation.ts", import.meta.url);
    const source = await readFile(sourcePath);
    assert.equal(source.includes(0), false);
  });
});
