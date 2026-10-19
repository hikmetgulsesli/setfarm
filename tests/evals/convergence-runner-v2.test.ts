import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  runConvergenceSuite,
  type ConvergenceRunnerPorts,
} from "../../src/evals/convergence-runner.js";
import {
  ContentAddressedEvalResultStore,
  convergenceResultTableV2,
  stableConvergenceResultJsonV2,
} from "../../src/evals/report.js";
import { loadConvergenceSuite } from "../../src/evals/suite-schema.js";
import { ProductConvergenceSuiteV2Schema } from "../../src/evals/suite-schema-v2.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

const RELEASE_SHA = "a".repeat(40);
const NOW = new Date("2026-07-16T12:00:00.000Z");

async function loadedSuiteV2() {
  const raw = JSON.parse(await readFile(path.resolve("evals/suites/product-convergence-v1.json"), "utf8"));
  const suite = ProductConvergenceSuiteV2Schema.parse({
    ...raw,
    schema: "setfarm.product-convergence-suite.v2",
    suiteId: "product-convergence-v2-runner-test",
    suiteVersion: 2,
    cases: raw.cases.map((item: any) => ({
      ...item,
      oracle: {
        ...item.oracle,
        schema: "setfarm.task-intent-oracle.v2",
        oracleVersion: 2,
        expectedDecision: item.oracle.expectedDecision.kind === "typed_rejection"
          ? {
              kind: "typed_rejection",
              requiredReasonCodes: item.oracle.expectedDecision.reasonCodes,
              allowedReasonCodes: item.oracle.expectedDecision.reasonCodes,
              reasonRequirements: item.oracle.expectedDecision.reasonCodes.map((reasonCode: string) => ({
                reasonCode,
                clauseRefs: item.oracle.clauses.map((clause: any) => clause.clauseId),
              })),
            }
          : item.oracle.expectedDecision,
      },
    })),
  });
  return { suite, suiteHash: hashCanonicalJson(suite) };
}

function preflightPorts(store: ContentAddressedEvalResultStore): ConvergenceRunnerPorts {
  return {
    sql: {
      inspectPlatform: async () => ({
        migrationVerified: true,
        attestedReleaseSha: RELEASE_SHA,
        artifactIndexReady: true,
        activeRuns: 0,
        openClaims: 0,
        activeAttempts: 0,
        activeRuntimes: 0,
        activeRecoveryDeliveries: 0,
      }),
      readRun: async () => { throw new Error("preflight must not read a run"); },
      collectRun: async () => { throw new Error("preflight must not collect a run"); },
    },
    http: {
      health: async (service) => ({ ok: true, evidenceHash: hashCanonicalJson({ service, ok: true }) }),
      operationalSnapshot: async () => { throw new Error("preflight must not read projections"); },
      syncProject: async () => { throw new Error("preflight must not sync projects"); },
    },
    process: {
      inspectRelease: async () => ({
        headSha: RELEASE_SHA,
        clean: true,
        runnerHash: "b".repeat(64),
        environmentHash: "c".repeat(64),
        providerId: "minimax",
        modelId: "minimax/MiniMax-M3",
        cliReady: true,
        v3ActivationEnabled: true,
      }),
      startRun: async () => { throw new Error("preflight must not start a run"); },
      inspectProject: async () => { throw new Error("preflight must not inspect projects"); },
      inspectGitHub: async () => { throw new Error("preflight must not inspect GitHub"); },
    },
    artifacts: store,
    admissions: {
      createCanary: async () => { throw new Error("preflight must not create canaries"); },
      promoteReleaseGo: async () => { throw new Error("preflight must not promote releases"); },
    },
    clock: {
      now: () => new Date(NOW),
      sleep: async () => {},
    },
  };
}

describe("dual-version convergence runner", () => {
  it("emits and stores v2 preflight authority for a v2 suite", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-convergence-runner-v2-"));
    try {
      const store = new ContentAddressedEvalResultStore(root);
      const loaded = await loadedSuiteV2();
      const output = await runConvergenceSuite(loaded, { releaseSha: RELEASE_SHA }, preflightPorts(store));

      assert.equal(output.result.schema, "setfarm.product-convergence-result.v2");
      assert.equal(output.result.suiteVersion, 2);
      assert.equal(output.result.suiteHash, loaded.suiteHash);
      assert.equal(output.result.executionMode, "preflight");
      assert.equal(output.result.status, "planned");
      assert.deepEqual(await store.getResultV2(output.result.resultHash), output.result);
      assert.deepEqual(await store.getVersionedResult(output.result.resultHash), output.result);
      assert.match(stableConvergenceResultJsonV2(output.result), /product-convergence-result\.v2/);
      assert.match(convergenceResultTableV2(output.result), /^CASE\s+REP\s+CLASS/m);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps the same runner path on immutable v1 suite/result authority", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-convergence-runner-v1-"));
    try {
      const store = new ContentAddressedEvalResultStore(root);
      const loaded = await loadConvergenceSuite(path.resolve("evals/suites/product-convergence-v1.json"));
      const output = await runConvergenceSuite(loaded, { releaseSha: RELEASE_SHA }, preflightPorts(store));

      assert.equal(output.result.schema, "setfarm.product-convergence-result.v1");
      assert.equal(output.result.suiteVersion, 1);
      assert.equal(output.result.suiteHash, loaded.suiteHash);
      assert.deepEqual(await store.getResult(output.result.resultHash), output.result);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

it("selected direct main dispatches through reservation owner before runner artifacts", async () => {
  const ts=await import("typescript");
  const source=await readFile("src/evals/convergence-runner.ts","utf8");
  const tree=ts.createSourceFile("convergence-runner.ts",source,ts.ScriptTarget.ES2022,true);
  const declaration=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="main")!;
  const body=ts.transpileModule(declaration.getText(tree),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
    .replace('await import("../execution/manual-test-worker-v1.js")','({runSelectedDirectConvergenceV1})');
  const events:string[]=[];
  const run={result:{schema:"setfarm.product-convergence-result.v1",status:"planned"},artifact:{locator:"artifact"},gate:{decision:"no_go",gateHash:"hash"},gateArtifact:{locator:"gate"}};
  const main=new Function("parseCli","createDefaultConvergencePorts","GitObjectHashSchema","loadConvergenceSuiteVersioned","runConvergenceSuite","freshInstallationSelectionV1","runSelectedDirectConvergenceV1","process","convergenceResultTable","stableConvergenceResultJson","convergenceResultTableV2","stableConvergenceResultJsonV2",body+";return main;")(
    ()=>({outputRoot:"fixed",execute:false,json:false,suiteFile:"fixed",releaseSha:RELEASE_SHA}),
    async()=>({process:{inspectRelease:async()=>({headSha:RELEASE_SHA})},sql:{close:async()=>{events.push("close");}}}),
    {parse:(v:unknown)=>v},async()=>({}),async()=>{events.push("unreserved");return run;},Object.freeze({}),
    async()=>{events.push("reserved");return run;},{argv:[],stdout:{write:()=>{}}},()=>"",()=>"",()=>"",()=>"",
  );
  await main();assert.deepEqual(events,["reserved","close"]);
});
