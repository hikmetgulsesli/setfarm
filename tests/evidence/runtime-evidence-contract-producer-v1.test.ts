import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { produceRuntimeEvidenceContractV1 } from "../../src/evidence/runtime-evidence-contract-producer-v1.js";
import { getStackTopologyCatalogContract } from "../../src/product-compiler/stack-topology-catalog.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";
import { buildContainedGameProductSpecV2 } from "../product-compiler/fixtures/product-semantics-v2.js";

describe("runtime evidence contract producer v1", () => {
  it("derives one exact browser launcher from sealed topology and the entry route", () => {
    const values = buildMinimalValidContracts();
    const result = produceRuntimeEvidenceContractV1({
      productSpec: values.productSpec,
      buildTopology: values.buildTopology,
    });

    assert.equal(result.status, "produced");
    if (result.status !== "produced") return;
    assert.equal(result.contract.adapter, "browser-service");
    assert.equal(result.contract.stackPackId, "vite-react-web-app");
    assert.deepEqual(result.contract.server.argv, [
      "npm", "run", "preview", "--", "--host", "{{HOST}}", "--port", "{{PORT}}", "--strictPort",
    ]);
    assert.equal(result.contract.readiness.path, "/");
    assert.equal(result.contract.readiness.expectedStatus, 200);
    assert.deepEqual(result.contract.capture, {
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
    });
    assert.deepEqual(result.contract.flowIsolation, {
      schema: "setfarm.browser-flow-isolation.v1",
      method: "clear-local-session-storage-and-reload",
    });
  });

  it("derives exact browser readiness and state bindings from native ProductSpecV2", () => {
    const values = buildMinimalValidContracts();
    const productSpec = buildContainedGameProductSpecV2();
    values.buildTopology.entrypoints[0]!.routeRefs = productSpec.routes.map((route) => route.id);

    const result = produceRuntimeEvidenceContractV1({
      productSpec,
      buildTopology: values.buildTopology,
    });

    assert.equal(result.status, "produced", JSON.stringify(result));
    if (result.status !== "produced") return;
    assert.equal(result.contract.schema, "setfarm.runtime-evidence-contract.v1");
    assert.equal(result.contract.readiness.path, "/play");
    assert.deepEqual(result.contract.capture.stateBindings, productSpec.states.map((state) => ({
      stateRef: state.id,
      pointer: `/states/${state.id}`,
    })));
  });

  it("rejects web topology without one tokenized preview command", () => {
    const values = buildMinimalValidContracts();
    values.buildTopology.commands = values.buildTopology.commands.filter((command) => command.kind !== "preview");
    const result = produceRuntimeEvidenceContractV1({
      productSpec: values.productSpec,
      buildTopology: values.buildTopology,
    });
    assert.deepEqual(result, {
      status: "rejected",
      rejectionCode: "RUNTIME_EVIDENCE_PREVIEW_COMMAND_AMBIGUOUS",
    });
  });

  it("projects exact host and port env bindings for the platform-owned static runtime", () => {
    const values = buildMinimalValidContracts();
    const preview = getStackTopologyCatalogContract("vite-react-web-app")!.descriptor.commands
      .find((command) => command.kind === "preview")!;
    values.buildTopology.commands = values.buildTopology.commands
      .filter((command) => command.kind !== "preview")
      .concat(preview);
    const result = produceRuntimeEvidenceContractV1({
      productSpec: values.productSpec,
      buildTopology: values.buildTopology,
    });
    assert.equal(result.status, "produced");
    if (result.status !== "produced") return;
    assert.deepEqual(result.contract.server.env, {
      HOST: "{{HOST}}",
      PORT: "{{PORT}}",
    });
  });

  it("keeps stacks without an authoritative invocation mapping unsupported", () => {
    const values = buildMinimalValidContracts();
    values.buildTopology.stackPack.id = "node-cli";
    const result = produceRuntimeEvidenceContractV1({
      productSpec: values.productSpec,
      buildTopology: values.buildTopology,
    });
    assert.deepEqual(result, { status: "unsupported", stackPackId: "node-cli" });
  });
});
