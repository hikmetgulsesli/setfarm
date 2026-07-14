import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, it } from "node:test";

import { runImplementEvidenceIfRequested } from "../../src/installer/implement-evidence-runner.js";
import { createStackRuntimeEvidenceDriver } from "../../src/installer/stack-runtime-evidence-driver.js";
import { validateImplementEvidenceArtifacts } from "../../src/installer/implement-evidence.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

const SOURCE = { sha: "1".repeat(40), treeHash: "2".repeat(40) };
const ENV_KEYS = ["SETFARM_IMPLEMENT_EVIDENCE_GATE", "SETFARM_VISUAL_EVIDENCE_GATE"];
const savedEnv = new Map<string, string | undefined>();

type SliceInput = ReturnType<typeof buildMinimalValidContracts>["implementationSlice"] & Record<string, unknown>;

function command(argv: string[], timeoutMs = 30_000) {
  return { argv, cwd: ".", timeoutMs };
}

function baseSlice(): SliceInput {
  const slice = structuredClone(buildMinimalValidContracts().implementationSlice) as SliceInput;
  slice.commands = [
    { id: "CMD_BUILD", kind: "build", argv: ["true"], cwd: ".", timeoutMs: 10_000, capabilityRefs: [] },
    { id: "CMD_TEST", kind: "test", argv: ["true"], cwd: ".", timeoutMs: 10_000, capabilityRefs: [] },
  ];
  return slice;
}

function bindScenarioTitle(slice: SliceInput, title: string): void {
  slice.contract.actions[0]!.evidenceScenario.targetInputValues = { title };
}

async function runV3(workdir: string, stackPackId: "node-cli" | "python-cli" | "node-express-api", sliceInput: SliceInput) {
  const slice = ImplementationSliceV1Schema.parse(sliceInput);
  const result = await runImplementEvidenceIfRequested({
    runId: `run-${stackPackId}`,
    storyId: slice.storyId,
    workdir,
    stackPackId,
    v3: {
      slice,
      sliceHash: "f".repeat(64),
      attemptId: `ATT_runtime-${stackPackId}-0001`,
      sourceRevision: SOURCE,
    },
  });
  assert.equal(result.attempted, true);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.canonicalEvidence?.bundle.aggregateVerdict, "pass");
  assert.equal(result.evidencePlan?.runtime?.stackPackId, stackPackId);
  assert.equal(validateImplementEvidenceArtifacts(workdir, slice.storyId).ok, true);
  assert.ok(result.canonicalEvidence?.artifactPaths.some((file) => file.includes("runtime") && file.endsWith(".json")));
  return result;
}

describe("sealed stack runtime evidence adapters", () => {
  beforeEach(() => {
    savedEnv.clear();
    for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
    process.env.SETFARM_IMPLEMENT_EVIDENCE_GATE = "blocking";
    process.env.SETFARM_VISUAL_EVIDENCE_GATE = "off";
  });

  afterEach(() => {
    for (const [key, value] of savedEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("starts the existing browser driver from sealed direct argv without package-script discovery", async () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-browser-sealed-launcher-"));
    const script = [
      "const http=require('node:http');",
      "const html='<button data-control-id=\"CTRL_SAVE_TASK\">Save</button><script>",
      "globalThis.__SETFARM_TEST_BRIDGE__={states:{STATE_EDITOR:{title:\"Before\"}},invokeAction(actionRef,inputValues){if(globalThis.__SETFARM_SCENARIO_MODE__!==\"manual\")throw new Error(\"scenario mode missing\");if(actionRef!==\"ACT_SAVE_TASK\")throw new Error(\"unknown action\");this.states.STATE_EDITOR={...this.states.STATE_EDITOR,...inputValues};localStorage.setItem(\"probe\",\"dirty\")}};",
      "</script>';",
      "http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(html)}).listen(Number(process.env.PORT),process.env.HOST);",
    ].join("");
    const driver = createStackRuntimeEvidenceDriver({
      schema: "setfarm.runtime-evidence-contract.v1",
      adapter: "browser-service",
      stackPackId: "vite-react-web-app",
      server: {
        ...command([process.execPath, "-e", script]),
        env: { HOST: "{{HOST}}", PORT: "{{PORT}}" },
      },
      readiness: { method: "GET", path: "/", expectedStatus: 200, timeoutMs: 5_000 },
      capture: {
        schema: "setfarm.browser-state-capture.v1",
        globalName: "__SETFARM_TEST_BRIDGE__",
        actionInvocation: {
          schema: "setfarm.browser-action-invocation.v1",
          method: "invokeAction",
        },
        scenarioMode: {
          schema: "setfarm.browser-scenario-mode.v1",
          globalName: "__SETFARM_SCENARIO_MODE__",
          value: "manual",
        },
        stateBindings: [{ stateRef: "STATE_EDITOR", pointer: "/states/STATE_EDITOR" }],
      },
      flowIsolation: {
        schema: "setfarm.browser-flow-isolation.v1",
        method: "clear-local-session-storage-and-reload",
      },
    });
    let session: Awaited<ReturnType<typeof driver.start>> | undefined;
    try {
      session = await driver.start({ runId: "run-browser-sealed", storyId: "US-001", workdir });
      await driver.waitReady(session);
      assert.equal((await fetch(session.url!)).status, 200);
      const before = await driver.captureState(session);
      assert.deepEqual((before.stateBridge as any)?.states, { STATE_EDITOR: { title: "Before" } });
      const invoked = await driver.interact(session, {
        id: "action:ACT_SAVE_TASK",
        action: "invoke",
        target: "ACT_SAVE_TASK",
        value: "action",
        inputValues: { title: "After" },
        timeoutMs: 5_000,
      });
      assert.equal(invoked.status, "pass", invoked.detail);
      const after = await driver.captureState(session);
      assert.deepEqual((after.stateBridge as any)?.states, { STATE_EDITOR: { title: "After" } });
      const reset = await driver.interact(session, { id: "reset:ACT_SAVE_TASK", action: "reset", timeoutMs: 5_000 });
      assert.equal(reset.status, "pass", reset.detail);
      const isolated = await driver.captureState(session);
      assert.deepEqual((isolated.stateBridge as any)?.states, { STATE_EDITOR: { title: "Before" } });
    } finally {
      if (session) await driver.stop(session);
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  });

  it("executes a sealed browser plan with flow reset, UI action, capture ABI, and reload readback", async () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-browser-canonical-runner-"));
    const script = [
      "const http=require('node:http');",
      "const html='<div id=\"root\"><button data-action-id=\"save-task-1\" onclick=\"localStorage.setItem(&quot;title&quot;,globalThis.__SETFARM_TEST_BRIDGE__.states.STATE_EDITOR.title)\">Save</button></div><script>",
      "const title=localStorage.getItem(\"title\")||\"Task from state\";",
      "globalThis.__SETFARM_TEST_BRIDGE__={states:{STATE_EDITOR:{title}},invokeAction(actionRef,inputValues){if(actionRef!==\"ACT_SAVE_TASK\")throw new Error(\"unknown action\");this.states.STATE_EDITOR={...this.states.STATE_EDITOR,...inputValues}}};",
      "</script>';",
      "http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(html)}).listen(Number(process.env.PORT),process.env.HOST);",
    ].join("");
    const sliceInput = baseSlice();
    sliceInput.runtimeEvidence = {
      schema: "setfarm.runtime-evidence-contract.v1",
      adapter: "browser-service",
      stackPackId: "vite-react-web-app",
      server: {
        ...command([process.execPath, "-e", script]),
        env: { HOST: "{{HOST}}", PORT: "{{PORT}}" },
      },
      readiness: { method: "GET", path: "/", expectedStatus: 200, timeoutMs: 5_000 },
      capture: {
        schema: "setfarm.browser-state-capture.v1",
        globalName: "__SETFARM_TEST_BRIDGE__",
        actionInvocation: {
          schema: "setfarm.browser-action-invocation.v1",
          method: "invokeAction",
        },
        scenarioMode: {
          schema: "setfarm.browser-scenario-mode.v1",
          globalName: "__SETFARM_SCENARIO_MODE__",
          value: "manual",
        },
        stateBindings: [{ stateRef: "STATE_EDITOR", pointer: "/states/STATE_EDITOR" }],
      },
      flowIsolation: {
        schema: "setfarm.browser-flow-isolation.v1",
        method: "clear-local-session-storage-and-reload",
      },
    };
    const slice = ImplementationSliceV1Schema.parse(sliceInput);
    try {
      const result = await runImplementEvidenceIfRequested({
        runId: "run-browser-canonical",
        storyId: slice.storyId,
        workdir,
        stackPackId: "vite-react-web-app",
        v3: {
          slice,
          sliceHash: "f".repeat(64),
          attemptId: "ATT_runtime-browser-canonical-0001",
          sourceRevision: SOURCE,
        },
      });
      assert.equal(result.attempted, true);
      assert.equal(result.ok, true, JSON.stringify({ reason: result.reason, predicates: result.canonicalEvidence?.bundle.predicates }));
      assert.equal(result.canonicalEvidence?.bundle.aggregateVerdict, "pass");
      assert.deepEqual(
        result.evidencePlan?.flows[0]?.interactions.map((interaction) => interaction.action),
        ["reset", "navigate", "click", "navigate"],
      );
      assert.equal(validateImplementEvidenceArtifacts(workdir, slice.storyId).ok, true);
    } finally {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  });

  it("executes an exact Node CLI action and durable readback without script-name inference", async () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-node-cli-evidence-"));
    const statePath = path.join(workdir, "state.json");
    fs.writeFileSync(statePath, JSON.stringify({ title: "Before" }));
    const readScript = "const fs=require('node:fs');process.stdout.write(fs.readFileSync(process.argv.at(-1),'utf8'))";
    const writeScript = "const fs=require('node:fs');const value={title:process.argv.at(-1)};fs.writeFileSync(process.argv.at(-2),JSON.stringify(value));process.stdout.write(JSON.stringify(value))";
    const slice = baseSlice();
    bindScenarioTitle(slice, "Task from Node CLI");
    slice.runtimeEvidence = {
      schema: "setfarm.runtime-evidence-contract.v1",
      adapter: "cli-process",
      stackPackId: "node-cli",
      initial: {
        command: command([process.execPath, "-e", readScript, statePath]),
        expectedExitCode: 0,
        capture: { format: "json", statePointer: "" },
      },
      actions: [{
        actionRef: "ACT_SAVE_TASK",
        inputValues: { title: "Task from Node CLI" },
        action: {
          command: command([process.execPath, "-e", writeScript, statePath, "Task from Node CLI"]),
          expectedExitCode: 0,
          capture: { format: "json", statePointer: "" },
        },
        reload: {
          command: command([process.execPath, "-e", readScript, statePath]),
          expectedExitCode: 0,
          capture: { format: "json", statePointer: "" },
        },
      }],
    };
    try {
      await runV3(workdir, "node-cli", slice);
      assert.deepEqual(JSON.parse(fs.readFileSync(statePath, "utf8")), { title: "Task from Node CLI" });
    } finally {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  });

  it("executes an exact Python CLI action and durable readback", { skip: spawnSync("python3", ["--version"]).status !== 0 }, async () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-python-cli-evidence-"));
    const statePath = path.join(workdir, "state.json");
    fs.writeFileSync(statePath, JSON.stringify({ title: "Before" }));
    const readScript = "import pathlib,sys;print(pathlib.Path(sys.argv[-1]).read_text(),end='')";
    const writeScript = "import json,pathlib,sys;value={'title':sys.argv[-1]};pathlib.Path(sys.argv[-2]).write_text(json.dumps(value));print(json.dumps(value),end='')";
    const slice = baseSlice();
    bindScenarioTitle(slice, "Task from Python CLI");
    slice.runtimeEvidence = {
      schema: "setfarm.runtime-evidence-contract.v1",
      adapter: "cli-process",
      stackPackId: "python-cli",
      initial: {
        command: command(["python3", "-c", readScript, statePath]),
        expectedExitCode: 0,
        capture: { format: "json", statePointer: "" },
      },
      actions: [{
        actionRef: "ACT_SAVE_TASK",
        inputValues: { title: "Task from Python CLI" },
        action: {
          command: command(["python3", "-c", writeScript, statePath, "Task from Python CLI"]),
          expectedExitCode: 0,
          capture: { format: "json", statePointer: "" },
        },
        reload: {
          command: command(["python3", "-c", readScript, statePath]),
          expectedExitCode: 0,
          capture: { format: "json", statePointer: "" },
        },
      }],
    };
    try {
      await runV3(workdir, "python-cli", slice);
      assert.deepEqual(JSON.parse(fs.readFileSync(statePath, "utf8")), { title: "Task from Python CLI" });
    } finally {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  });

  it("starts an exact Express-compatible service and captures POST plus GET readback", async () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-node-api-evidence-"));
    const serverScript = [
      "const http=require('node:http');let state={title:'Before'};",
      "const send=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value))};",
      "http.createServer((req,res)=>{",
      "if(req.method==='GET'&&req.url==='/health')return send(res,200,{ok:true});",
      "if(req.method==='GET'&&req.url==='/editor')return send(res,200,state);",
      "if(req.method==='POST'&&req.url==='/editor'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{state=JSON.parse(body);send(res,200,state)});return;}",
      "send(res,404,{error:'not_found'});",
      "}).listen(Number(process.env.PORT),process.env.HOST);",
    ].join("");
    const slice = baseSlice();
    bindScenarioTitle(slice, "Task from HTTP");
    slice.runtimeEvidence = {
      schema: "setfarm.runtime-evidence-contract.v1",
      adapter: "http-service",
      stackPackId: "node-express-api",
      server: {
        ...command([process.execPath, "-e", serverScript], 60_000),
        env: { HOST: "{{HOST}}", PORT: "{{PORT}}" },
      },
      readiness: { method: "GET", path: "/health", expectedStatus: 200, timeoutMs: 10_000 },
      initial: {
        method: "GET",
        path: "/editor",
        headers: {},
        expectedStatus: 200,
        timeoutMs: 5_000,
        capture: { format: "json", statePointer: "" },
      },
      actions: [{
        actionRef: "ACT_SAVE_TASK",
        inputValues: { title: "Task from HTTP" },
        action: {
          method: "POST",
          path: "/editor",
          headers: {},
          body: { title: "Task from HTTP" },
          expectedStatus: 200,
          timeoutMs: 5_000,
          capture: { format: "json", statePointer: "" },
        },
        reload: {
          method: "GET",
          path: "/editor",
          headers: {},
          expectedStatus: 200,
          timeoutMs: 5_000,
          capture: { format: "json", statePointer: "" },
        },
        reloadLifecycle: "readback",
      }],
    };
    try {
      const result = await runV3(workdir, "node-express-api", slice);
      assert.equal(result.evidencePlan?.runtime?.adapter, "http-service");
    } finally {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  });

  it("restarts an HTTP service before durable readback when the sealed lifecycle requires it", async () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-node-api-restart-evidence-"));
    const statePath = path.join(workdir, "state.json");
    const launchesPath = path.join(workdir, "launches.txt");
    fs.writeFileSync(statePath, JSON.stringify({ title: "Before" }));
    const serverScript = [
      "const fs=require('node:fs'),http=require('node:http');",
      "const [statePath,launchesPath]=process.argv.slice(1);fs.appendFileSync(launchesPath,String(process.pid)+'\\n');",
      "let state=JSON.parse(fs.readFileSync(statePath,'utf8'));",
      "const send=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value))};",
      "http.createServer((req,res)=>{",
      "if(req.method==='GET'&&req.url==='/health')return send(res,200,{ok:true});",
      "if(req.method==='GET'&&req.url==='/editor')return send(res,200,state);",
      "if(req.method==='POST'&&req.url==='/editor'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{state=JSON.parse(body);fs.writeFileSync(statePath,JSON.stringify(state));send(res,200,state)});return;}",
      "send(res,404,{error:'not_found'});",
      "}).listen(Number(process.env.PORT),process.env.HOST);",
    ].join("");
    const slice = baseSlice();
    bindScenarioTitle(slice, "Task after process restart");
    slice.contract.persistencePolicies[0]!.durability = "restart";
    slice.runtimeEvidence = {
      schema: "setfarm.runtime-evidence-contract.v1",
      adapter: "http-service",
      stackPackId: "node-express-api",
      server: {
        ...command([process.execPath, "-e", serverScript, statePath, launchesPath], 60_000),
        env: { HOST: "{{HOST}}", PORT: "{{PORT}}" },
      },
      readiness: { method: "GET", path: "/health", expectedStatus: 200, timeoutMs: 10_000 },
      initial: {
        method: "GET",
        path: "/editor",
        headers: {},
        expectedStatus: 200,
        timeoutMs: 5_000,
        capture: { format: "json", statePointer: "" },
      },
      actions: [{
        actionRef: "ACT_SAVE_TASK",
        inputValues: { title: "Task after process restart" },
        action: {
          method: "POST",
          path: "/editor",
          headers: {},
          body: { title: "Task after process restart" },
          expectedStatus: 200,
          timeoutMs: 5_000,
          capture: { format: "json", statePointer: "" },
        },
        reload: {
          method: "GET",
          path: "/editor",
          headers: {},
          expectedStatus: 200,
          timeoutMs: 5_000,
          capture: { format: "json", statePointer: "" },
        },
        reloadLifecycle: "restart",
      }],
    };
    try {
      await runV3(workdir, "node-express-api", slice);
      const launches = fs.readFileSync(launchesPath, "utf8").trim().split("\n");
      assert.equal(launches.length, 2);
      assert.equal(new Set(launches).size, 2);
      assert.deepEqual(JSON.parse(fs.readFileSync(statePath, "utf8")), { title: "Task after process restart" });
    } finally {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  });

  it("does not fall back to a package preview script when a claimed CLI stack lacks its sealed adapter", async () => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-cli-missing-adapter-"));
    const slice = ImplementationSliceV1Schema.parse(baseSlice());
    fs.writeFileSync(path.join(workdir, "package.json"), JSON.stringify({
      scripts: { preview: "node -e \"setInterval(() => {}, 1000)\"" },
    }));
    try {
      const result = await runImplementEvidenceIfRequested({
        runId: "run-node-cli-missing-adapter",
        storyId: slice.storyId,
        workdir,
        stackPackId: "node-cli",
        v3: {
          slice,
          sliceHash: "f".repeat(64),
          attemptId: "ATT_runtime-node-cli-missing-adapter-0001",
          sourceRevision: SOURCE,
        },
      });
      assert.equal(result.attempted, true);
      assert.equal(result.ok, false);
      assert.match(result.reason, /requires a sealed runtime evidence contract/);
    } finally {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  });

  it("fails closed when a durable action lacks a sealed readback invocation", () => {
    const slice = baseSlice();
    bindScenarioTitle(slice, "missing readback");
    slice.runtimeEvidence = {
      schema: "setfarm.runtime-evidence-contract.v1",
      adapter: "cli-process",
      stackPackId: "node-cli",
      initial: {
        command: command(["true"]),
        expectedExitCode: 0,
        capture: { format: "json", statePointer: "" },
      },
      actions: [{
        actionRef: "ACT_SAVE_TASK",
        inputValues: { title: "missing readback" },
        action: {
          command: command(["true"]),
          expectedExitCode: 0,
          capture: { format: "json", statePointer: "" },
        },
      }],
    };
    const parsed = ImplementationSliceV1Schema.safeParse(slice);
    assert.equal(parsed.success, false);
    assert.match(parsed.error?.issues.map((issue) => issue.message).join("\n") ?? "", /requires an exact reload\/readback invocation/);
  });

  it("fails closed when a stack adapter changes the canonical evidence scenario values", () => {
    const slice = baseSlice();
    slice.runtimeEvidence = {
      schema: "setfarm.runtime-evidence-contract.v1",
      adapter: "cli-process",
      stackPackId: "node-cli",
      initial: {
        command: command(["true"]),
        expectedExitCode: 0,
        capture: { format: "json", statePointer: "" },
      },
      actions: [{
        actionRef: "ACT_SAVE_TASK",
        inputValues: { title: "Adapter-owned value" },
        action: {
          command: command(["true"]),
          expectedExitCode: 0,
          capture: { format: "json", statePointer: "" },
        },
        reload: {
          command: command(["true"]),
          expectedExitCode: 0,
          capture: { format: "json", statePointer: "" },
        },
      }],
    };
    const parsed = ImplementationSliceV1Schema.safeParse(slice);
    assert.equal(parsed.success, false);
    assert.match(
      parsed.error?.issues.map((issue) => issue.message).join("\n") ?? "",
      /must equal the canonical evidence scenario/,
    );
  });
});
