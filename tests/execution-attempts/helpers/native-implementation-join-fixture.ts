import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { hashCanonicalJson } from "../../../src/product-compiler/canonical-json.js";
import { produceImplementationSourceMapV1 } from "../../../src/product-compiler/producers/implementation-source-map-v1.js";
import { produceStoryPlanV2 } from "../../../src/product-compiler/producers/story-plan-v2.js";
import { ProductBuildPacketV3Schema } from "../../../src/product-compiler/schemas/product-build-packet-v3.js";
import { ProductCompilationReportV3Schema } from "../../../src/product-compiler/schemas/compilation-report-v3.js";
import { SemanticArtifactEnvelopeV1Schema } from "../../../src/product-compiler/artifact-store.js";
import type { SealedRuntimePacketV3 } from "../../../src/product-compiler/runtime-artifact-reader.js";
import { resolveV3GitRevision } from "../../../src/execution/v3-git-revision.js";
import { buildNoDesignProductBuildPacketV3Contracts } from "../../product-compiler/fixtures/product-build-packet-v3.js";
import { RuntimeEvidenceContractV1Schema, hashRuntimeEvidenceContractV1 } from "../../../src/evidence/runtime-evidence-contract-v1.js";
import { produceRuntimeDataContractV1 } from "../../../src/product-compiler/producers/runtime-data-contract.js";
import { twoStoryNodeExpressApiProductSpecV2 } from "../../product-compiler/fixtures/no-design-product-semantics-v2.js";

export const NATIVE_JOIN_PRODUCER = Object.freeze({
  pass: "native-implementation-join-test", codeSha: "c".repeat(40), toolVersions: {},
});
export const NATIVE_JOIN_LIMITS = Object.freeze({
  maxPayloadBytes: 4 * 1024 * 1024, rootQuotaBytes: 16 * 1024 * 1024, minFreeBytes: 0,
});
export const NATIVE_JOIN_SOURCE = "export const nativeImplementation = true;\n";

// Task11's opt-in application is real executable source, not a declared-success
// marker. The existing Task9 fixture/default packet bytes remain unchanged.
export const NATIVE_JOIN_CLI_SOURCE = [
  "const fs = require('node:fs');",
  "const argv = process.argv.slice(2);",
  "if (argv[0] === 'inspect') { process.stdout.write(JSON.stringify({state:[]})); process.exit(0); }",
  "if (argv[0] !== 'add' || argv[1] !== '--title' || !argv[2]) process.exit(2);",
  "const title = argv[2];",
  "fs.writeFileSync('invoked-title.json', JSON.stringify({title}));",
  "process.stdout.write(JSON.stringify({task:{title},state:[title]}));",
  "",
].join("\n");


export const NATIVE_JOIN_API_NOTES_SOURCE = "exports.notes = [];\n";
export const NATIVE_JOIN_API_SOURCE = [
  "const http = require('node:http');",
  "const { notes } = require('./notes.js');",
  "const tasks = [];",
  "const server = http.createServer((req, res) => {",
  "  const send = (status, body) => { res.writeHead(status, {'content-type':'application/json'}); res.end(JSON.stringify(body)); };",
  "  if (req.method === 'GET' && req.url === '/health') return send(200, {ok:true});",
  "  if (req.method === 'GET' && req.url === '/state') return send(200, {state:tasks});",
  "  const match = new URL(req.url || '/', 'http://localhost').pathname.split('/');",
  "  if (req.method !== 'POST' || match.length !== 3 || !['tasks','notes'].includes(match[1]) || !match[2]) return send(404, {error:{code:'NOT_FOUND'}});",
  "  let body = ''; req.on('data', chunk => { body += chunk; });",
  "  req.on('end', () => {",
  "    let input; try { input = JSON.parse(body); } catch { return send(400, {error:{code:'INPUT_VALIDATION_FAILED',message:'JSON required'}}); }",
  "    if (typeof input.title !== 'string' || !input.title.trim()) return send(400, {error:{code:'INPUT_VALIDATION_FAILED',message:'Title required'}});",
  "    const task = {project:decodeURIComponent(match[2]),title:input.title};",
  "    const state = match[1] === 'notes' ? notes : tasks; state.push(task); send(201, {task,state});",
  "  });",
  "});",
  "server.listen(Number(process.env.PORT), process.env.HOST || '127.0.0.1');",
  "",
].join("\n");

export function nativeJoinRuntimeEvidence(actionRef: string) {
  const runtimeEvidenceContract = RuntimeEvidenceContractV1Schema.parse({
    schema: "setfarm.runtime-evidence-contract.v1", adapter: "cli-process", stackPackId: "node-cli",
    actions: [{ actionRef, inputValues: { title: "Ship Setfarm" }, action: {
      command: { argv: ["node", "dist/index.js", "add", "--title", "Ship Setfarm"], cwd: ".", timeoutMs: 30_000 },
      expectedExitCode: 0, capture: { format: "json", statePointer: "" },
    } }],
  });
  return { runtimeEvidenceContract, runtimeEvidenceContractHash: hashRuntimeEvidenceContractV1(runtimeEvidenceContract) };
}

export function nativeJoinEnvelope(artifactType: string, payload: unknown) {
  return SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1", artifactType, producer: NATIVE_JOIN_PRODUCER, payload,
  });
}

export function nativeJoinPacket(runId: string, twoStories = false, runnableCli = false, runnableApi = false, runtimeServerEnv?: Readonly<Record<string, string>>, sharedWritable = false): SealedRuntimePacketV3 {
  assert.ok(!runnableApi || (twoStories && !runnableCli));
  assert.ok(!sharedWritable || twoStories, "a shared writer requires the actual two-story product");
  assert.ok(!runtimeServerEnv || runnableApi, "external evidence environment belongs only to the real API fixture");
  assert.ok(!(twoStories && runnableCli), "the two-story HTTP and one-story CLI fixtures are separate products");
  const contracts = buildNoDesignProductBuildPacketV3Contracts();
  if (twoStories) {
    contracts.productSpecV2 = twoStoryNodeExpressApiProductSpecV2();
    contracts.buildTopologyV1.stackPack.id = "node-express-api";
    contracts.buildTopologyV1.owners.push({ id: "OWNER_US_002", kind: "story", storyRef: "US-002" });
    contracts.buildTopologyV1.pathBindings.push({
      id: "PATH_NOTES", path: "src/notes.ts", role: "source", ownerRef: "OWNER_US_002",
      presence: "present", knownContentHash: runnableApi
        ? createHash("sha256").update(NATIVE_JOIN_API_NOTES_SOURCE).digest("hex") : "d".repeat(64),
    });
    contracts.buildTopologyV1.sharedGrants.push({
      id: "GRANT_APP_TO_NOTES", fromOwnerRef: "OWNER_US_001", toOwnerRef: "OWNER_US_002",
      pathRefs: ["PATH_APP"], permissions: sharedWritable ? ["read","write"] : ["read"],
    });
    contracts.buildTopologyV1.entrypoints[0]!.kind = "api";
    contracts.buildTopologyV1.entrypoints[0]!.routeRefs = contracts.productSpecV2.routes.map(route => route.id).sort();
    contracts.buildTopologyV1.capabilities = [{ id: "CAP_HTTP_INTERACTION", kind: "network", enabled: true }];
    const runtimeEvidenceContract = RuntimeEvidenceContractV1Schema.parse({
      schema: "setfarm.runtime-evidence-contract.v1", adapter: "http-service", stackPackId: "node-express-api",
      server: { argv: ["node", "dist/index.js"], cwd: ".", timeoutMs: 30_000,
        ...(runnableApi ? { env: { ...runtimeServerEnv, HOST: "{{HOST}}", PORT: "{{PORT}}" } } : {}) },
      ...(runnableApi ? { initial: { method: "GET", path: "/state", headers: {}, expectedStatus: 200,
        timeoutMs: 30_000, capture: { format: "json", statePointer: "/state" } } } : {}),
      readiness: { method: "GET", path: "/health", expectedStatus: 200, timeoutMs: 30_000 },
      actions: contracts.productSpecV2.actions.map(action => ({
        actionRef: action.id, inputValues: { project: "setfarm", title: "Bind contracts" }, action: {
          method: "POST", path: action.id === "ACT_CREATE_NOTE" ? "/notes/setfarm" : "/tasks/setfarm",
          headers: { "content-type": "application/json" }, body: { title: "Bind contracts" },
          expectedStatus: 201, timeoutMs: 30_000, capture: { format: "json", statePointer: runnableApi ? "/state" : "" },
        },
      })),
    });
    Object.assign(contracts.buildTopologyV1, {
      runtimeEvidenceContract, runtimeEvidenceContractHash: hashRuntimeEvidenceContractV1(runtimeEvidenceContract),
    });
  } else {
    Object.assign(contracts.buildTopologyV1, nativeJoinRuntimeEvidence(contracts.productSpecV2.actions[0]!.id));
  }
  if (runnableCli) {
    const runtimeEvidenceContract = RuntimeEvidenceContractV1Schema.parse({
      adapter: "cli-process", schema: "setfarm.runtime-evidence-contract.v1", stackPackId: "node-cli",
      initial: { command: { argv: ["node", "dist/index.js", "inspect"], cwd: ".", timeoutMs: 30_000 },
        expectedExitCode: 0, capture: { format: "json", statePointer: "/state" } },
      actions: [{ actionRef: "ACT_ADD_TASK", inputValues: { title: "Ship Setfarm" }, action: {
        command: { argv: ["node", "dist/index.js", "add", "--title", "Ship Setfarm"], cwd: ".", timeoutMs: 30_000 },
        expectedExitCode: 0, capture: { format: "json", statePointer: "/state" },
      } }],
    });
    Object.assign(contracts.buildTopologyV1, {
      runtimeEvidenceContract, runtimeEvidenceContractHash: hashRuntimeEvidenceContractV1(runtimeEvidenceContract),
    });
  }
  const runtimeData = produceRuntimeDataContractV1({
    productSpec: contracts.productSpecV2, commands: contracts.buildTopologyV1.commands,
  });
  assert.equal(runtimeData.status, "produced", JSON.stringify(runtimeData));
  if (runtimeData.status !== "produced") throw Error("native runtime data fixture rejected");
  Object.assign(contracts.buildTopologyV1, {
    runtimeDataContract: runtimeData.contract, runtimeDataContractHash: runtimeData.contractHash,
  });
  contracts.buildTopologyV1.pathBindings[0]!.knownContentHash = createHash("sha256")
    .update(runnableCli ? NATIVE_JOIN_CLI_SOURCE : runnableApi ? NATIVE_JOIN_API_SOURCE : NATIVE_JOIN_SOURCE).digest("hex");
  const produced = produceStoryPlanV2({ productSpec: contracts.productSpecV2, buildTopology: contracts.buildTopologyV1 });
  assert.equal(produced.status, "produced", JSON.stringify(produced));
  if (produced.status !== "produced") throw Error("native story fixture rejected");
  const map = produceImplementationSourceMapV1({
    ...contracts.implementationSourceInputsV1,
    productSpec: contracts.productSpecV2, buildTopology: contracts.buildTopologyV1, storyPlan: produced.storyPlan,
  });
  assert.equal(map.status, "produced", JSON.stringify(map));
  if (map.status !== "produced") throw Error("native source map fixture rejected");
  const hash = (type: string, payload: unknown) => hashCanonicalJson(nativeJoinEnvelope(type, payload));
  const refs = {
    productSpec: hash("setfarm.product-spec.v2", contracts.productSpecV2), designGraph: null,
    buildTopology: hash("setfarm.build-topology.v1", contracts.buildTopologyV1),
    storyPlan: hash("setfarm.story-plan.v2", produced.storyPlan),
    designSourceClosure: hash("setfarm.design-source-closure.v2", contracts.designSourceClosureV2),
    implementationSourceMap: hash("setfarm.implementation-source-map.v1", map.sourceMap),
  };
  const compiler = { version: "4.0.0", codeSha: NATIVE_JOIN_PRODUCER.codeSha };
  const packet = ProductBuildPacketV3Schema.parse({
    schema: "setfarm.product-build-packet.v3", packetVersion: 3, parentPacketHashes: [], designSourceKind: "none",
    productSpecV2Hash: refs.productSpec, designGraphV2Hash: null, buildTopologyV1Hash: refs.buildTopology,
    storyPlanV2Hash: refs.storyPlan, designSourceClosureV2Hash: refs.designSourceClosure,
    implementationSourceMapV1Hash: refs.implementationSourceMap,
    ...(contracts.buildTopologyV1.runtimeEvidenceContractHash
      ? { runtimeEvidenceContractHash: contracts.buildTopologyV1.runtimeEvidenceContractHash } : {}),
    ...(contracts.buildTopologyV1.runtimeDataContractHash
      ? { runtimeDataContractHash: contracts.buildTopologyV1.runtimeDataContractHash } : {}),
    compiler, validationIds: ["VALIDATE_NATIVE_IMPLEMENTATION_JOIN"],
  });
  const packetHash = hash(packet.schema, packet);
  const compilationReport = ProductCompilationReportV3Schema.parse({
    schema: "setfarm.product-compilation-report.v3", compiler, inputHashes: ["9".repeat(64)], diagnostics: [],
    validationIds: packet.validationIds, status: "sealed", packetHash,
    artifactHashes: { productSpecV2: refs.productSpec, designGraphV2: null, buildTopologyV1: refs.buildTopology,
      storyPlanV2: refs.storyPlan, designSourceClosureV2: refs.designSourceClosure,
      implementationSourceMapV1: refs.implementationSourceMap },
  });
  return { runId, packetHash, producer: NATIVE_JOIN_PRODUCER, packet, compilationReport,
    productSpec: contracts.productSpecV2, designGraph: null, buildTopology: contracts.buildTopologyV1,
    storyPlan: produced.storyPlan, designSourceClosure: contracts.designSourceClosureV2,
    implementationSourceMap: map.sourceMap,
    refs: { ...refs, packet: packetHash, compilationReport: hash(compilationReport.schema, compilationReport) } };
}

/** Runtime IDs are derived from test labels; labels/agent/run identities stay unchanged. */
export function nativeJoinRuntimeSessionId(suffix: string): string {
  return `RTS_native-join-${suffix.replaceAll("_", "-")}`;
}

export async function nativeJoinSourceFixture(runnableCli = false, runnableApi = false, linkedStory = false) {
  assert.ok(!(runnableCli && runnableApi));
  const runnable = runnableCli || runnableApi;
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "setfarm-native-implementation-join-")));
  const worktree = path.join(root, "worktree");
  await mkdir(path.join(worktree, "src"), { recursive: true });
  await writeFile(path.join(worktree, "src/index.ts"), runnableCli ? NATIVE_JOIN_CLI_SOURCE : runnableApi ? NATIVE_JOIN_API_SOURCE : NATIVE_JOIN_SOURCE);
  if (runnableApi) await writeFile(path.join(worktree, "src/notes.ts"), NATIVE_JOIN_API_NOTES_SOURCE);
  if (runnable) {
    await writeFile(path.join(worktree, "package.json"), JSON.stringify({
      name: runnableApi ? "native-task11-owned-api" : "native-task11-owned-cli", private: true,
      scripts: { build: runnableApi
        ? "node build.cjs && node --check dist/index.js && node --check dist/notes.js"
        : "node build.cjs && node --check dist/index.js" },
    }, null, 2) + "\n");
    await writeFile(path.join(worktree, "build.cjs"), [
      "const fs = require('node:fs');",
      "fs.mkdirSync('dist', {recursive:true});",
      "fs.copyFileSync('src/index.ts', 'dist/index.js');",
      ...(runnableApi ? [
        "fs.copyFileSync('src/notes.ts', 'dist/notes.js');",
        "const { Script } = require('node:vm');",
        "for (const file of ['dist/index.js', 'dist/notes.js']) new Script(fs.readFileSync(file, 'utf8'), {filename:file});",
      ] : []),
      "",
    ].join("\n"));
    await writeFile(path.join(worktree, ".gitignore"), ".worktrees/\nnode_modules/\ndist/\ninvoked-title.json\n");
  }
  const git = (args: string[]) => execFileSync("git", args, {
    cwd: worktree, encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"],
  });
  git(["init", "-q", "-b", "main"]);
  git(["-c", "user.name=Setfarm Test", "-c", "user.email=setfarm-test@example.invalid", "add",
    ...(runnable ? ["src", "package.json", "build.cjs", ".gitignore"] : ["src"])]);
  git(["-c", "user.name=Setfarm Test", "-c", "user.email=setfarm-test@example.invalid", "commit", "-qm", "native base"]);
  if (linkedStory) {
    assert.ok(runnable, "lifecycle cleanup fixture requires executable application source");
    git(["config", "user.name", "Setfarm Test"]);
    git(["config", "user.email", "setfarm-test@example.invalid"]);
    const origin = path.join(root, "origin.git");
    git(["init", "--bare", "-q", origin]);
    git(["remote", "add", "origin", origin]);
    git(["push", "-u", "origin", "main"]);
    const branch = "native-task11-us-001";
    const storyWorktree = path.join(worktree, ".worktrees", branch);
    git(["worktree", "add", "-q", "-b", branch, storyWorktree, "HEAD"]);
    return { root, repo: worktree, worktree: storyWorktree, branch,
      sourceBefore: resolveV3GitRevision({ repo: storyWorktree, requestedRef: "HEAD" }) };
  }
  return { root, repo: worktree, worktree, branch: "main",
    sourceBefore: resolveV3GitRevision({ repo: worktree, requestedRef: "HEAD" }) };
}
