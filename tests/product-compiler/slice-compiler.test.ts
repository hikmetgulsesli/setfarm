import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { compileProductBuildPacket } from "../../src/product-compiler/packet-compiler.js";
import { produceRuntimeDataContractV1 } from "../../src/product-compiler/producers/runtime-data-contract.js";
import { compileImplementationSlice } from "../../src/product-compiler/slice-compiler.js";
import { topologyPathAbsenceHash } from "../../src/product-compiler/schemas/build-topology-v1.js";
import {
  buildMinimalValidContracts,
  buildMinimalValidV3ProductSpec,
} from "./fixtures/minimal-valid-contract.js";

const PRODUCER = {
  pass: "product-packet-compiler",
  codeSha: "5840ae3",
  toolVersions: { zod: "4.4.3" },
};

describe("implementation slice compiler", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function sealedInput(v3 = false) {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-slice-compiler-"));
    roots.push(root);
    const artifactStore = new ContentAddressedArtifactStore(path.join(root, "artifacts"));
    const values = buildMinimalValidContracts();
    if (v3) {
      values.productSpec = buildMinimalValidV3ProductSpec();
      values.designGraph.bindings[0]!.evidenceRefs.push("EVID_SAVE_CONFIRMATION");
      values.storyPlan.stories[0]!.evidenceRefs.push("EVID_SAVE_CONFIRMATION");
      const runtimeData = produceRuntimeDataContractV1({
        productSpec: values.productSpec,
        commands: values.buildTopology.commands,
      });
      assert.equal(runtimeData.status, "produced", JSON.stringify(runtimeData));
      if (runtimeData.status !== "produced") throw new Error("runtime-data fixture rejected");
      Object.assign(values.buildTopology, {
        runtimeDataContract: runtimeData.contract,
        runtimeDataContractHash: runtimeData.contractHash,
      });
    }
    const compilation = await compileProductBuildPacket({
      productSpec: values.productSpec,
      designGraph: values.designGraph,
      buildTopology: values.buildTopology,
      storyPlan: values.storyPlan,
      compiler: { version: "3.0.0-shadow.1", codeSha: "5840ae3" },
      producer: PRODUCER,
      artifactStore,
    });
    assert.equal(compilation.status, "sealed");
    return {
      packetHash: compilation.packetHash!,
      packet: compilation.packet!,
      productSpec: values.productSpec,
      designGraph: values.designGraph,
      buildTopology: values.buildTopology,
      storyPlan: values.storyPlan,
      storyId: "US-001",
      sourceRevision: {
        sha: "3".repeat(40),
        treeHash: "4".repeat(40),
      },
      producer: PRODUCER,
      fileSnapshots: { PATH_APP: { presence: "present" as const, contentHash: values.hashes.HASH_A } },
      dependencySignatures: {},
    };
  }

  async function sealedDependentSharedInput() {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-slice-dependent-shared-"));
    roots.push(root);
    const artifactStore = new ContentAddressedArtifactStore(path.join(root, "artifacts"));
    const values = buildMinimalValidContracts();
    const secondRoute = structuredClone(values.productSpec.routes[0]!);
    secondRoute.id = "ROUTE_CLEAR";
    secondRoute.path = "/clear";
    secondRoute.surfaceRefs = ["SURF_CLEAR"];
    secondRoute.entry = false;
    values.productSpec.routes.push(secondRoute);
    const secondSurface = structuredClone(values.productSpec.surfaces[0]!);
    secondSurface.id = "SURF_CLEAR";
    secondSurface.name = "Task clear";
    secondSurface.routeRef = "ROUTE_CLEAR";
    values.productSpec.surfaces.push(secondSurface);
    const secondAction = structuredClone(values.productSpec.actions[0]!);
    secondAction.id = "ACT_CLEAR_TASK";
    secondAction.name = "Clear task";
    secondAction.surfaceRefs = ["SURF_CLEAR"];
    secondAction.input.fields = [];
    secondAction.evidenceScenario.targetInputValues = {};
    secondAction.stateDeltas = [{
      stateRef: "STATE_EDITOR",
      operation: "set",
      path: "/title",
      valueFrom: { kind: "literal", value: "" },
    }];
    secondAction.persistenceEffects[0]!.operation = "clear";
    secondAction.persistenceEffects[0]!.payloadFields = [];
    secondAction.evidenceRefs = ["EVID_CLEAR_TASK"];
    secondAction.success.evidenceRefs = ["EVID_CLEAR_TASK"];
    values.productSpec.actions.push(secondAction);
    const secondEvidence = structuredClone(values.productSpec.evidencePredicates[0]!);
    secondEvidence.id = "EVID_CLEAR_TASK";
    secondEvidence.subjectRef = "ACT_CLEAR_TASK";
    values.productSpec.evidencePredicates.push(secondEvidence);
    const secondControl = structuredClone(values.designGraph.controls[0]!);
    secondControl.id = "CTRL_CLEAR_TASK";
    secondControl.generatedLocalId = "clear-task-1";
    secondControl.label = "Clear";
    secondControl.accessibility.name = "Clear task";
    secondControl.surfaceRef = "SURF_CLEAR";
    secondControl.source.selector = "[data-action-id=\"clear-task-1\"]";
    values.designGraph.controls.push(secondControl);
    const secondDesignSurface = structuredClone(values.designGraph.surfaces[0]!);
    secondDesignSurface.id = "DSURF_CLEAR";
    secondDesignSurface.surfaceRef = "SURF_CLEAR";
    secondDesignSurface.sourceLocator = "sources/clear.html";
    values.designGraph.surfaces.push(secondDesignSurface);
    const secondBinding = structuredClone(values.designGraph.bindings[0]!);
    secondBinding.controlRef = "CTRL_CLEAR_TASK";
    secondBinding.actionRef = "ACT_CLEAR_TASK";
    secondBinding.routeRef = "ROUTE_CLEAR";
    secondBinding.inputBindings = [];
    secondBinding.evidenceRefs = ["EVID_CLEAR_TASK"];
    values.designGraph.bindings.push(secondBinding);
    values.buildTopology.owners.push({
      id: "OWNER_US_002",
      kind: "story",
      storyRef: "US-002",
    });
    values.buildTopology.pathBindings.push({
      id: "PATH_SECONDARY",
      path: "src/clear-task.ts",
      role: "source",
      ownerRef: "OWNER_US_002",
      presence: "absent",
      knownContentHash: topologyPathAbsenceHash("src/clear-task.ts"),
    });
    values.buildTopology.sharedGrants.push({
      id: "GRANT_APP_TO_US_002",
      fromOwnerRef: "OWNER_US_001",
      toOwnerRef: "OWNER_US_002",
      pathRefs: ["PATH_APP"],
      permissions: ["read", "write"],
    });
    values.buildTopology.entrypoints[0]!.routeRefs.push("ROUTE_CLEAR");
    values.storyPlan.stories.push({
      id: "US-002",
      order: 2,
      title: "Implement task clear",
      description: "Add clear behavior to the cumulative application shell.",
      ownerRef: "OWNER_US_002",
      dependsOn: ["US-001"],
      surfaceRefs: ["SURF_CLEAR"],
      controlRefs: ["CTRL_CLEAR_TASK"],
      actionRefs: ["ACT_CLEAR_TASK"],
      stateRefs: ["STATE_EDITOR"],
      persistenceRefs: ["PERSIST_TASK_LOCAL"],
      evidenceRefs: ["EVID_CLEAR_TASK"],
      ownedPathRefs: ["PATH_SECONDARY"],
      sharedGrantRefs: ["GRANT_APP_TO_US_002"],
    });
    const compilation = await compileProductBuildPacket({
      productSpec: values.productSpec,
      designGraph: values.designGraph,
      buildTopology: values.buildTopology,
      storyPlan: values.storyPlan,
      compiler: { version: "3.0.0-shadow.1", codeSha: "5840ae3" },
      producer: PRODUCER,
      artifactStore,
    });
    assert.equal(compilation.status, "sealed", JSON.stringify(compilation));
    const currentTreeHash = "8".repeat(64);
    return {
      packetHash: compilation.packetHash!,
      packet: compilation.packet!,
      productSpec: values.productSpec,
      designGraph: values.designGraph,
      buildTopology: values.buildTopology,
      storyPlan: values.storyPlan,
      storyId: "US-002",
      sourceRevision: { sha: "7".repeat(40), treeHash: currentTreeHash },
      producer: PRODUCER,
      fileSnapshots: {
        PATH_APP: { presence: "present" as const, contentHash: "9".repeat(64) },
        PATH_SECONDARY: {
          presence: "absent" as const,
          contentHash: topologyPathAbsenceHash("src/clear-task.ts"),
        },
      },
      dependencySignatures: {
        "US-001": {
          sliceHash: "6".repeat(64),
          outputHash: "5".repeat(64),
          sourceAfter: { baseSha: "4".repeat(40), treeHash: currentTreeHash },
          fileSignatures: [{
            pathRef: "PATH_APP",
            presence: "present" as const,
            contentHash: "9".repeat(64),
          }],
        },
      },
    };
  }

  it("produces the same slice for the same packet, story, and source revision", async () => {
    const input = await sealedInput();
    const first = compileImplementationSlice(input);
    const second = compileImplementationSlice(input);

    assert.equal(first.status, "compiled");
    assert.equal(second.status, "compiled");
    assert.equal(second.sliceHash, first.sliceHash);
    assert.deepEqual(second.slice, first.slice);
    assert.equal(first.slice?.packetHash, input.packetHash);
    assert.equal(first.slice?.storyId, "US-001");
    assert.deepEqual(first.slice?.contract.actions.map((item) => item.id), ["ACT_SAVE_TASK"]);
    assert.deepEqual(first.slice?.contract.controls.map((item) => item.id), ["CTRL_SAVE_TASK"]);
    assert.deepEqual(first.slice?.files, [{
      pathRef: "PATH_APP",
      path: "src/App.tsx",
      role: "owned",
      presence: "present",
      knownContentHash: input.buildTopology.pathBindings[0]!.knownContentHash,
    }]);
  });

  it("changes the slice hash when source SHA or tree changes", async () => {
    const input = await sealedInput();
    const original = compileImplementationSlice(input);
    const changedSha = compileImplementationSlice({
      ...input,
      sourceRevision: { ...input.sourceRevision, sha: "5".repeat(40) },
    });
    const changedTree = compileImplementationSlice({
      ...input,
      sourceRevision: { ...input.sourceRevision, treeHash: "6".repeat(40) },
    });
    assert.equal(original.status, "compiled");
    assert.equal(changedSha.status, "compiled");
    assert.equal(changedTree.status, "compiled");
    assert.notEqual(changedSha.sliceHash, original.sliceHash);
    assert.notEqual(changedTree.sliceHash, original.sliceHash);
  });

  it("rejects a missing owned-file presence/hash snapshot", async () => {
    const input = await sealedInput();
    input.fileSnapshots = {};
    const result = compileImplementationSlice(input);
    assert.equal(result.status, "rejected");
    assert.equal(
      result.diagnostics.some((item) => item.code === "SLICE_OWNED_FILE_SNAPSHOT_MISSING"),
      true,
    );
  });

  it("rejects explicit source presence disagreement without inferring status from the hash", async () => {
    const input = await sealedInput();
    input.fileSnapshots.PATH_APP!.presence = "absent";
    const result = compileImplementationSlice(input);
    assert.equal(result.status, "rejected");
    assert.equal(
      result.diagnostics.some((item) => item.code === "SLICE_FILE_PRESENCE_CONFLICT"),
      true,
    );
  });

  it("accepts an exact committed recovery baseline only through a revision-bound dispatch", async () => {
    const input = await sealedInput();
    const initial = compileImplementationSlice(input);
    assert.equal(initial.status, "compiled");
    const changedHash = "7".repeat(64);
    const recoverySource = { sha: "8".repeat(40), treeHash: "9".repeat(40) };
    const withoutAuthorization = compileImplementationSlice({
      ...input,
      sourceRevision: recoverySource,
      fileSnapshots: { PATH_APP: { presence: "present", contentHash: changedHash } },
    });
    assert.equal(withoutAuthorization.status, "rejected");
    assert.equal(withoutAuthorization.diagnostics.some((item) => item.code === "SLICE_FILE_HASH_CONFLICT"), true);

    const recovered = compileImplementationSlice({
      ...input,
      sourceRevision: recoverySource,
      fileSnapshots: { PATH_APP: { presence: "present", contentHash: changedHash } },
      recovery: {
        schema: "setfarm.implementation-recovery-directive.v1",
        recoveryCaseRevisionId: `RREV_${"a".repeat(64)}`,
        recoveryDispatchId: `RDISP_${"b".repeat(64)}`,
        dispatchClass: "product_implementation",
        findingSetHash: "c".repeat(64),
        findingIds: [`FIND_${"d".repeat(64)}`],
        contractSliceHash: initial.sliceHash!,
        sourceRevision: { baseSha: recoverySource.sha, treeHash: recoverySource.treeHash },
        expectedDelta: {
          kind: "source_change",
          invariantRefs: ["INV_SAVE_RELOAD"],
          requiredPaths: ["src/App.tsx"],
        },
        allowedPaths: ["src/App.tsx"],
        evidencePlanArtifactHash: "e".repeat(64),
      },
    });
    assert.equal(recovered.status, "compiled", JSON.stringify(recovered.diagnostics));
    assert.equal(recovered.slice?.files[0]?.knownContentHash, changedHash);
    assert.equal(recovered.slice?.recovery?.contractSliceHash, initial.sliceHash);
    assert.equal(recovered.slice?.recovery?.allowedPaths[0], "src/App.tsx");
  });

  it("rejects recovery write authority that is not topology-derived", async () => {
    const input = await sealedInput();
    const initial = compileImplementationSlice(input);
    const result = compileImplementationSlice({
      ...input,
      recovery: {
        schema: "setfarm.implementation-recovery-directive.v1",
        recoveryCaseRevisionId: `RREV_${"a".repeat(64)}`,
        recoveryDispatchId: `RDISP_${"b".repeat(64)}`,
        dispatchClass: "supervisor_repair",
        findingSetHash: "c".repeat(64),
        findingIds: [`FIND_${"d".repeat(64)}`],
        contractSliceHash: initial.sliceHash!,
        sourceRevision: {
          baseSha: input.sourceRevision.sha,
          treeHash: input.sourceRevision.treeHash,
        },
        expectedDelta: {
          kind: "source_change",
          invariantRefs: ["INV_SAVE_RELOAD"],
          requiredPaths: ["README.md"],
        },
        allowedPaths: ["README.md"],
      },
    });
    assert.equal(result.status, "rejected");
    assert.equal(result.diagnostics.some((item) =>
      item.code === "SLICE_CONTRACT_INVALID" && item.message.includes("not writable in the sealed topology")), true);
  });

  it("rejects child payloads that do not match the sealed packet hashes", async () => {
    const input = await sealedInput();
    input.productSpec.actions[0]!.name = "Mutated after sealing";
    const result = compileImplementationSlice(input);
    assert.equal(result.status, "rejected");
    assert.equal(
      result.diagnostics.some((item) => item.code === "SLICE_PRODUCT_SPEC_HASH_MISMATCH"),
      true,
    );
  });

  it("rejects absent story identity instead of reconstructing it from prose", async () => {
    const input = await sealedInput();
    input.storyId = "US-999";
    const result = compileImplementationSlice(input);
    assert.equal(result.status, "rejected");
    assert.equal(result.diagnostics.some((item) => item.code === "SLICE_STORY_NOT_FOUND"), true);
  });

  it("captures exact shared read/write grant source in the slice", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-slice-shared-"));
    roots.push(root);
    const artifactStore = new ContentAddressedArtifactStore(path.join(root, "artifacts"));
    const values = buildMinimalValidContracts();
    values.buildTopology.owners.push({ id: "OWNER_SETUP", kind: "setup" });
    values.buildTopology.pathBindings.push({
      id: "PATH_SHARED_CONFIG",
      path: "src/shared/config.ts",
      role: "source",
      ownerRef: "OWNER_SETUP",
      presence: "present",
      knownContentHash: values.hashes.HASH_B,
    });
    values.buildTopology.sharedGrants.push({
      id: "GRANT_SHARED_CONFIG",
      fromOwnerRef: "OWNER_SETUP",
      toOwnerRef: "OWNER_US_001",
      pathRefs: ["PATH_SHARED_CONFIG"],
      permissions: ["read", "write"],
    });
    values.storyPlan.stories[0]!.sharedGrantRefs = ["GRANT_SHARED_CONFIG"];
    const compilation = await compileProductBuildPacket({
      productSpec: values.productSpec,
      designGraph: values.designGraph,
      buildTopology: values.buildTopology,
      storyPlan: values.storyPlan,
      compiler: { version: "3.0.0-shadow.1", codeSha: "5840ae3" },
      producer: PRODUCER,
      artifactStore,
    });
    assert.equal(compilation.status, "sealed", JSON.stringify(compilation.diagnostics));
    const result = compileImplementationSlice({
      packetHash: compilation.packetHash,
      packet: compilation.packet,
      productSpec: values.productSpec,
      designGraph: values.designGraph,
      buildTopology: values.buildTopology,
      storyPlan: values.storyPlan,
      storyId: "US-001",
      sourceRevision: { sha: "3".repeat(40), treeHash: "4".repeat(40) },
      producer: PRODUCER,
      fileSnapshots: {
        PATH_APP: { presence: "present", contentHash: values.hashes.HASH_A },
        PATH_SHARED_CONFIG: { presence: "present", contentHash: values.hashes.HASH_B },
      },
      dependencySignatures: {},
    });
    assert.equal(result.status, "compiled", JSON.stringify(result.diagnostics));
    assert.deepEqual(result.slice?.files.find((file) => file.pathRef === "PATH_SHARED_CONFIG"), {
      pathRef: "PATH_SHARED_CONFIG",
      path: "src/shared/config.ts",
      role: "shared_writable",
      presence: "present",
      knownContentHash: values.hashes.HASH_B,
    });
  });

  it("accepts a changed shared file only when its owner dependency attests the exact terminal blob", async () => {
    const input = await sealedDependentSharedInput();
    const result = compileImplementationSlice(input);
    assert.equal(result.status, "compiled", JSON.stringify(result.diagnostics));
    assert.deepEqual(result.slice?.files.find((file) => file.pathRef === "PATH_APP"), {
      pathRef: "PATH_APP",
      path: "src/App.tsx",
      role: "shared_writable",
      presence: "present",
      knownContentHash: "9".repeat(64),
    });
    assert.deepEqual(result.slice?.dependencySignatures, [{
      storyId: "US-001",
      sliceHash: "6".repeat(64),
      outputHash: "5".repeat(64),
      sourceAfter: { baseSha: "4".repeat(40), treeHash: "8".repeat(64) },
      fileSignatures: [{
        pathRef: "PATH_APP",
        presence: "present",
        contentHash: "9".repeat(64),
      }],
    }]);
  });

  it("rejects a changed shared file when its hash differs from the terminal dependency blob", async () => {
    const input = await sealedDependentSharedInput();
    input.dependencySignatures["US-001"]!.fileSignatures[0]!.contentHash = "3".repeat(64);
    const result = compileImplementationSlice(input);
    assert.equal(result.status, "rejected");
    assert.equal(
      result.diagnostics.some((item) => item.code === "SLICE_SHARED_FILE_REVISION_UNATTESTED"),
      true,
    );
  });

  it("copies the exact packet/topology runtime-data contract into every v3 implementation slice", async () => {
    const input = await sealedInput(true);
    const result = compileImplementationSlice(input);
    assert.equal(result.status, "compiled", JSON.stringify(result.diagnostics));
    assert.equal(
      result.slice?.runtimeDataContractHash,
      input.packet.runtimeDataContractHash,
    );
    assert.deepEqual(
      result.slice?.runtimeDataContract,
      input.buildTopology.runtimeDataContract,
    );
  });

  it("rejects a v3 slice when runtime-data is omitted after packet sealing", async () => {
    const input = await sealedInput(true);
    delete input.buildTopology.runtimeDataContract;
    delete input.buildTopology.runtimeDataContractHash;
    const result = compileImplementationSlice(input);
    assert.equal(result.status, "rejected");
    assert.equal(
      result.diagnostics.some((item) => item.code === "SLICE_RUNTIME_DATA_CONTRACT_MISSING"),
      true,
    );
  });
});
