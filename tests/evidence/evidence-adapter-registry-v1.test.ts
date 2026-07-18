import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compileEvidenceAdapterRegistryV1,
  resolveEvidenceAdapterSupportV1,
  verifyEvidenceAdapterRegistryV1,
} from "../../src/evidence/evidence-adapter-registry-v1.js";
import {
  EVIDENCE_ADAPTER_REGISTRY_ARTIFACT_TYPE_V1,
  EVIDENCE_ADAPTER_RUNNER_ABI_V1,
  EVIDENCE_CHECK_KIND_BY_PREDICATE_KIND_V1,
  EvidenceAdapterRegistryV1Schema,
  evidenceCheckKindForPredicateV1,
  hashEvidenceAdapterEntryV1,
  hashEvidenceAdapterRegistryPayloadV1,
  hashEvidenceAdapterSupportSignatureV1,
  type EvidenceAdapterRegistryCompilerInputV1,
  type EvidenceAdapterSupportSignatureCandidateV1,
} from "../../src/evidence/schemas/evidence-adapter-registry-v1.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";
import {
  getProductDeliveryProfileCatalogV1,
  productDeliveryProfileCatalogHashV1,
} from "../../src/product-compiler/product-delivery-profile-catalog.js";
import { getStackTopologyCatalogContract } from "../../src/product-compiler/stack-topology-catalog.js";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const SHA_D = "d".repeat(64);
const SHA_E = "e".repeat(64);
const SHA_F = "f".repeat(64);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function stackPackBinding(stackPackId: string) {
  const contract = getStackTopologyCatalogContract(stackPackId);
  assert.ok(contract, `missing stack fixture ${stackPackId}`);
  return {
    stackPackId: contract.identity.id,
    stackPackVersion: contract.identity.version,
    stackPackContentHash: contract.identity.contentHash,
  };
}

function profileBinding(profileId: string) {
  const catalog = getProductDeliveryProfileCatalogV1();
  const profile = catalog.profiles.find((candidate) => candidate.id === profileId);
  assert.ok(profile, `missing profile fixture ${profileId}`);
  return {
    kind: "profile" as const,
    profileId: profile.id,
    catalogVersion: catalog.version,
    catalogHash: productDeliveryProfileCatalogHashV1(),
  };
}

function commandBuildSupport(): EvidenceAdapterSupportSignatureCandidateV1 {
  return {
    stackPackBinding: stackPackBinding("node-cli"),
    deliveryBinding: { kind: "unprofiled" },
    invocationKind: "command",
    predicateKind: "build",
    evidenceCapabilityRefs: ["CAP_FILESYSTEM_ACCESS"],
    inputTransportSchemaRefs: [],
    checkKind: "CHECK_BUILD_PASS",
    lifecycleMode: "none",
  };
}

function commandTestSupport(): EvidenceAdapterSupportSignatureCandidateV1 {
  return {
    stackPackBinding: stackPackBinding("node-cli"),
    deliveryBinding: { kind: "unprofiled" },
    invocationKind: "command",
    predicateKind: "test",
    evidenceCapabilityRefs: ["CAP_TEST_RUNNER"],
    inputTransportSchemaRefs: [],
    checkKind: "CHECK_TEST_PASS",
    lifecycleMode: "none",
  };
}

function browserActionSupport(): EvidenceAdapterSupportSignatureCandidateV1 {
  return {
    stackPackBinding: stackPackBinding("vite-react-web-app"),
    deliveryBinding: profileBinding("PROFILE_WEB_REACT_EXACT_V1"),
    invocationKind: "browser_dom",
    predicateKind: "control_action",
    evidenceCapabilityRefs: ["CAP_RUNTIME_STATE", "CAP_BROWSER_INTERACTION"],
    inputTransportSchemaRefs: ["setfarm.action-input-transport.v2"],
    checkKind: "CHECK_CONTROL_ACTION",
    lifecycleMode: "none",
  };
}

function browserStateSupport(): EvidenceAdapterSupportSignatureCandidateV1 {
  return {
    stackPackBinding: stackPackBinding("vite-react-web-app"),
    deliveryBinding: profileBinding("PROFILE_WEB_REACT_EXACT_V1"),
    invocationKind: "browser_dom",
    predicateKind: "state_transition",
    evidenceCapabilityRefs: ["CAP_RUNTIME_STATE"],
    inputTransportSchemaRefs: [],
    checkKind: "CHECK_STATE_TRANSITION",
    lifecycleMode: "reload",
  };
}

function compilerInput(): EvidenceAdapterRegistryCompilerInputV1 {
  return {
    producer: {
      pass: "evidence-adapter-registry-v1",
      codeSha: SHA_A,
      toolVersions: {
        node: "22.18.0",
        playwright: "1.60.0",
      },
    },
    releaseAuthority: {
      codeSha: SHA_A,
      platformBundleHash: SHA_B,
      externalResolutionHash: SHA_C,
      environmentCapsuleHash: SHA_D,
    },
    adapters: [
      {
        adapterRef: "ADAPTER_COMMAND_V2",
        adapterVersion: "2.0.0",
        owner: "setfarm-orchestrator",
        supportSignatures: [commandTestSupport(), commandBuildSupport()],
        receiptSchema: "setfarm.evidence-receipt.v2",
        runtimeDependencyRefs: ["RUNTIME_NODE_PROCESS"],
        toolchainHash: SHA_E,
        runnerEntrypointRef: "ENTRY_EVIDENCE_COMMAND_V2",
      },
      {
        adapterRef: "ADAPTER_BROWSER_DOM_V2",
        adapterVersion: "2.0.0",
        owner: "setfarm-orchestrator",
        supportSignatures: [browserStateSupport(), browserActionSupport()],
        receiptSchema: "setfarm.evidence-receipt.v2",
        runtimeDependencyRefs: ["RUNTIME_PLAYWRIGHT"],
        toolchainHash: SHA_F,
        runnerEntrypointRef: "ENTRY_EVIDENCE_BROWSER_DOM_V2",
      },
    ],
  };
}

function compiledRegistry() {
  const result = compileEvidenceAdapterRegistryV1(compilerInput());
  assert.equal(result.status, "compiled", result.status === "rejected"
    ? JSON.stringify(result.diagnostics)
    : undefined);
  return result;
}

describe("EvidenceAdapterRegistryV1", () => {
  it("compiles exact support signatures with domain hashes and CAS identity", () => {
    const result = compiledRegistry();

    assert.equal(result.envelope.artifactType, EVIDENCE_ADAPTER_REGISTRY_ARTIFACT_TYPE_V1);
    assert.equal(result.registry.registryPayloadHash, result.registryPayloadHash);
    assert.equal(
      result.registryPayloadHash,
      hashEvidenceAdapterRegistryPayloadV1(result.registry),
    );
    assert.equal(result.registryArtifactHash, hashCanonicalJson(result.envelope));
    assert.equal(
      result.registryArtifactByteLength,
      Buffer.byteLength(canonicalJsonStringify(result.envelope), "utf8"),
    );
    assert.deepEqual(
      result.registry.adapters.map((adapter) => adapter.adapterRef),
      ["ADAPTER_BROWSER_DOM_V2", "ADAPTER_COMMAND_V2"],
    );
    for (const adapter of result.registry.adapters) {
      assert.equal(adapter.adapterEntryHash, hashEvidenceAdapterEntryV1(adapter));
      assert.deepEqual(
        adapter.supportSignatures.map((signature) => signature.supportSignatureHash),
        [...adapter.supportSignatures]
          .map((signature) => signature.supportSignatureHash)
          .sort(),
      );
      for (const signature of adapter.supportSignatures) {
        const { schema: _schema, supportSignatureHash: _hash, ...candidate } = signature;
        assert.equal(
          signature.supportSignatureHash,
          hashEvidenceAdapterSupportSignatureV1(candidate),
        );
      }
    }
    assert.deepEqual(EvidenceAdapterRegistryV1Schema.parse(result.registry), result.registry);
  });

  it("is deterministic across caller ordering without mutating compiler input", () => {
    const firstInput = compilerInput();
    const firstSnapshot = clone(firstInput);
    const secondInput = compilerInput();
    secondInput.adapters.reverse();
    secondInput.adapters[0]!.supportSignatures.reverse();
    secondInput.adapters[0]!.supportSignatures[0]!.evidenceCapabilityRefs.reverse();
    secondInput.adapters[1]!.supportSignatures.reverse();

    const first = compileEvidenceAdapterRegistryV1(firstInput);
    const second = compileEvidenceAdapterRegistryV1(secondInput);
    assert.equal(first.status, "compiled");
    assert.equal(second.status, "compiled");
    if (first.status !== "compiled" || second.status !== "compiled") return;
    assert.equal(first.registryPayloadHash, second.registryPayloadHash);
    assert.equal(first.registryArtifactHash, second.registryArtifactHash);
    assert.equal(
      canonicalJsonStringify(first.envelope),
      canonicalJsonStringify(second.envelope),
    );
    assert.deepEqual(firstInput, firstSnapshot);
  });

  it("fresh-verifies the exact compiler-owned registry envelope", () => {
    const compiled = compiledRegistry();
    const result = verifyEvidenceAdapterRegistryV1({
      compilerInput: compilerInput(),
      candidateEnvelope: compiled.envelope,
    });

    assert.equal(result.status, "verified");
    if (result.status !== "verified") return;
    assert.equal(result.registryPayloadHash, compiled.registryPayloadHash);
    assert.equal(result.registryArtifactHash, compiled.registryArtifactHash);
    assert.equal(
      canonicalJsonStringify(result.envelope),
      canonicalJsonStringify(compiled.envelope),
    );
  });

  it("rejects a self-consistent forged entry against fresh release authority", () => {
    const compiled = compiledRegistry();
    const forged = clone(compiled.envelope) as typeof compiled.envelope & {
      payload: typeof compiled.registry;
    };
    const payload = clone(compiled.registry);
    payload.adapters[0]!.toolchainHash = SHA_A;
    payload.adapters[0]!.adapterEntryHash = hashEvidenceAdapterEntryV1(payload.adapters[0]!);
    payload.registryPayloadHash = hashEvidenceAdapterRegistryPayloadV1(payload);
    forged.payload = payload;
    assert.deepEqual(EvidenceAdapterRegistryV1Schema.parse(payload), payload);

    const result = verifyEvidenceAdapterRegistryV1({
      compilerInput: compilerInput(),
      candidateEnvelope: forged,
    });

    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.deepEqual(
      result.diagnostics.map((item) => item.code),
      ["EVIDENCE_ADAPTER_REGISTRY_V1_AUTHORITY_MISMATCH"],
    );
  });

  it("resolves only exact signatures and never a Cartesian combination", () => {
    const compiled = compiledRegistry();
    const exact = resolveEvidenceAdapterSupportV1(
      compiled,
      browserActionSupport(),
    );
    assert.equal(exact.status, "resolved");
    if (exact.status === "resolved") {
      assert.equal(exact.adapterRef, "ADAPTER_BROWSER_DOM_V2");
      assert.equal(exact.adapterEntryHash.length, 64);
      assert.equal(exact.supportSignatureHash.length, 64);
    }

    const crossedLifecycle = browserActionSupport();
    crossedLifecycle.lifecycleMode = "reload";
    const crossedCapabilities = commandBuildSupport();
    crossedCapabilities.evidenceCapabilityRefs = ["CAP_TEST_RUNNER"];
    for (const requirement of [crossedLifecycle, crossedCapabilities]) {
      const missing = resolveEvidenceAdapterSupportV1(compiled, requirement);
      assert.deepEqual(missing, {
        status: "missing",
        code: "EVIDENCE_ADAPTER_SUPPORT_MISSING",
        message: "No registry adapter owns the exact support signature",
      });
    }

    const forgedAuthority = clone(compiled);
    const forgedResolution = resolveEvidenceAdapterSupportV1(
      forgedAuthority,
      browserActionSupport(),
    );
    assert.deepEqual(forgedResolution, {
      status: "invalid",
      code: "EVIDENCE_ADAPTER_SUPPORT_INPUT_INVALID",
      message: "Adapter resolution requires an in-memory compiled or fresh-verified registry authority",
    });
  });

  it("rejects duplicate signatures and conflicting logical binding hashes", () => {
    const duplicate = compilerInput();
    duplicate.adapters[1]!.supportSignatures[0] = clone(
      duplicate.adapters[0]!.supportSignatures[0]!,
    );
    const conflict = compilerInput();
    const conflictingSupport = clone(commandBuildSupport());
    conflictingSupport.predicateKind = "runtime";
    conflictingSupport.checkKind = "CHECK_RUNTIME";
    conflictingSupport.stackPackBinding.stackPackContentHash = SHA_A;
    conflict.adapters[0]!.supportSignatures.push(conflictingSupport);

    for (const input of [duplicate, conflict]) {
      const result = compileEvidenceAdapterRegistryV1(input);
      assert.equal(result.status, "rejected");
      if (result.status === "rejected") {
        assert.ok(result.diagnostics.some((item) =>
          item.code === "EVIDENCE_ADAPTER_REGISTRY_V1_INPUT_INVALID"));
      }
    }
  });

  it("rejects non-canonical stack/profile/capability authority", () => {
    const wrongStackHash = compilerInput();
    wrongStackHash.adapters[0]!.supportSignatures.forEach((signature) => {
      signature.stackPackBinding.stackPackContentHash = SHA_A;
    });
    const wrongProfileOwner = compilerInput();
    wrongProfileOwner.adapters[1]!.supportSignatures[0]!.stackPackBinding =
      stackPackBinding("node-cli");
    const absentCapability = compilerInput();
    absentCapability.adapters[0]!.supportSignatures[0]!.evidenceCapabilityRefs = [
      "CAP_BROWSER_INTERACTION",
    ];

    for (const input of [wrongStackHash, wrongProfileOwner, absentCapability]) {
      const result = compileEvidenceAdapterRegistryV1(input);
      assert.equal(result.status, "rejected");
      if (result.status === "rejected") {
        assert.ok(result.diagnostics.some((item) =>
          item.code === "EVIDENCE_ADAPTER_REGISTRY_V1_CATALOG_MISMATCH"));
      }
    }
  });

  it("bounds catalog diagnostics before accumulation and sorting", () => {
    const input = compilerInput();
    input.adapters = [input.adapters[0]!];
    input.adapters[0]!.supportSignatures = Array.from({ length: 256 }, (_, index) => ({
      ...commandBuildSupport(),
      evidenceCapabilityRefs: [`CAP_UNAVAILABLE_${String(index).padStart(3, "0")}`],
    }));

    const result = compileEvidenceAdapterRegistryV1(input);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.diagnostics.length, 100);
    assert.ok(result.diagnostics.every((item) =>
      item.code === "EVIDENCE_ADAPTER_REGISTRY_V1_CATALOG_MISMATCH"));
    assert.ok(result.diagnostics.some((item) =>
      item.reference === "catalogDiagnostics"
      && item.message.includes("produced 256 diagnostics")));
  });

  it("rejects unknown refs and predicate/check mismatches at the schema boundary", () => {
    const unknownTransport = compilerInput();
    unknownTransport.adapters[1]!.supportSignatures[0]!.inputTransportSchemaRefs = [
      "setfarm.unknown-input-transport.v9" as "setfarm.action-input-transport.v2",
    ];
    const unknownRunner = compilerInput();
    unknownRunner.adapters[0]!.runnerEntrypointRef =
      "ENTRY_EVIDENCE_UNKNOWN_V2" as "ENTRY_EVIDENCE_COMMAND_V2";
    const wrongCheck = compilerInput();
    wrongCheck.adapters[0]!.supportSignatures[0]!.checkKind = "CHECK_RUNTIME";

    for (const input of [unknownTransport, unknownRunner, wrongCheck]) {
      const result = compileEvidenceAdapterRegistryV1(input);
      assert.equal(result.status, "rejected");
      if (result.status === "rejected") {
        assert.ok(result.diagnostics.some((item) =>
          item.code === "EVIDENCE_ADAPTER_REGISTRY_V1_INPUT_INVALID"));
      }
    }
  });

  it("exports one exhaustive predicate/check authority and enforces the runner ABI", () => {
    assert.ok(Object.isFrozen(EVIDENCE_ADAPTER_RUNNER_ABI_V1));
    assert.ok(Object.isFrozen(EVIDENCE_ADAPTER_RUNNER_ABI_V1.ENTRY_EVIDENCE_COMMAND_V2));
    assert.ok(Object.isFrozen(
      EVIDENCE_ADAPTER_RUNNER_ABI_V1
        .ENTRY_EVIDENCE_COMMAND_V2.runtimeDependencyProfiles,
    ));
    assert.ok(Object.isFrozen(
      EVIDENCE_ADAPTER_RUNNER_ABI_V1
        .ENTRY_EVIDENCE_COMMAND_V2.runtimeDependencyProfiles[0],
    ));
    assert.throws(() => {
      (EVIDENCE_ADAPTER_RUNNER_ABI_V1
        .ENTRY_EVIDENCE_COMMAND_V2.runtimeDependencyProfiles[0] as string[])
        .push("RUNTIME_PLAYWRIGHT");
    }, TypeError);

    const pairs = Object.entries(EVIDENCE_CHECK_KIND_BY_PREDICATE_KIND_V1);
    assert.equal(pairs.length, 11);
    for (const [predicateKind, checkKind] of pairs) {
      assert.equal(
        evidenceCheckKindForPredicateV1(
          predicateKind as keyof typeof EVIDENCE_CHECK_KIND_BY_PREDICATE_KIND_V1,
        ),
        checkKind,
      );
    }

    const wrongRunner = compilerInput();
    wrongRunner.adapters[0]!.runnerEntrypointRef = "ENTRY_EVIDENCE_BROWSER_DOM_V2";
    wrongRunner.adapters[0]!.runtimeDependencyRefs = ["RUNTIME_PLAYWRIGHT"];
    const wrongDependencies = compilerInput();
    wrongDependencies.adapters[1]!.runtimeDependencyRefs = ["RUNTIME_NODE_PROCESS"];
    for (const input of [wrongRunner, wrongDependencies]) {
      const result = compileEvidenceAdapterRegistryV1(input);
      assert.equal(result.status, "rejected");
      if (result.status === "rejected") {
        assert.ok(result.diagnostics.some((item) =>
          item.code === "EVIDENCE_ADAPTER_REGISTRY_V1_INPUT_INVALID"));
      }
    }
  });

  it("turns hostile, cyclic, and null public inputs into typed rejections without traps", () => {
    let traps = 0;
    const hostile = new Proxy({}, {
      get() {
        traps += 1;
        throw new Error("trap:get");
      },
      ownKeys() {
        traps += 1;
        throw new Error("trap:ownKeys");
      },
    });
    const compileResult = compileEvidenceAdapterRegistryV1(hostile);
    assert.equal(compileResult.status, "rejected");
    assert.equal(traps, 0);

    const nullVerification = verifyEvidenceAdapterRegistryV1(null);
    assert.equal(nullVerification.status, "rejected");
    const hostileVerification = verifyEvidenceAdapterRegistryV1({
      compilerInput: compilerInput(),
      candidateEnvelope: hostile,
    });
    assert.equal(hostileVerification.status, "rejected");
    assert.equal(traps, 0);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    assert.equal(compileEvidenceAdapterRegistryV1(cyclic).status, "rejected");
  });

  it("returns immutable snapshots instead of caller-shared mutable claims", () => {
    const compiled = compiledRegistry();
    assert.ok(Object.isFrozen(compiled.registry));
    assert.ok(Object.isFrozen(compiled.registry.adapters));
    assert.ok(Object.isFrozen(compiled.registry.adapters[0]));
    assert.ok(Object.isFrozen(compiled.registry.adapters[0]!.supportSignatures));
    assert.throws(() => {
      (compiled.registry.adapters[0] as { toolchainHash: string }).toolchainHash = SHA_A;
    }, TypeError);
    assert.equal(compiled.registryArtifactHash, hashCanonicalJson(compiled.envelope));
  });

  it("rejects wrong envelope type, unknown envelope fields, and payload hash tamper", () => {
    const compiled = compiledRegistry();
    const wrongType = clone(compiled.envelope);
    wrongType.artifactType = "setfarm.evidence-plan.v2";
    const unknownField = { ...compiled.envelope, discoveredAt: "runtime" };
    const hashTamper = clone(compiled.envelope) as typeof compiled.envelope & {
      payload: typeof compiled.registry;
    };
    hashTamper.payload = clone(compiled.registry);
    hashTamper.payload.registryPayloadHash = SHA_A;

    for (const candidateEnvelope of [wrongType, unknownField, hashTamper]) {
      const result = verifyEvidenceAdapterRegistryV1({
        compilerInput: compilerInput(),
        candidateEnvelope,
      });
      assert.equal(result.status, "rejected");
      if (result.status === "rejected") {
        assert.ok(result.diagnostics.every((item) =>
          item.code === "EVIDENCE_ADAPTER_REGISTRY_V1_ENVELOPE_INVALID"));
      }
    }
  });

  it("rejects producer/release drift, duplicate adapter refs, and unknown compiler fields", () => {
    const releaseDrift = compilerInput();
    releaseDrift.releaseAuthority.codeSha = SHA_B;
    const duplicateRef = compilerInput();
    duplicateRef.adapters[1]!.adapterRef = duplicateRef.adapters[0]!.adapterRef;
    const unknownField = { ...compilerInput(), runtimeDiscovery: true };

    for (const input of [releaseDrift, duplicateRef, unknownField]) {
      const result = compileEvidenceAdapterRegistryV1(input);
      assert.equal(result.status, "rejected");
      if (result.status === "rejected") {
        assert.ok(result.diagnostics.every((item) =>
          item.code === "EVIDENCE_ADAPTER_REGISTRY_V1_INPUT_INVALID"));
      }
    }
  });

  it("rejects publication-incompatible Unicode and never emits an oversized artifact", () => {
    const unsafeUnicode = compilerInput();
    unsafeUnicode.producer.pass = "registry\ud800";
    const unsafeResult = compileEvidenceAdapterRegistryV1(unsafeUnicode);
    assert.equal(unsafeResult.status, "rejected");
    if (unsafeResult.status === "rejected") {
      assert.ok(unsafeResult.diagnostics.some((item) =>
        item.code === "EVIDENCE_ADAPTER_REGISTRY_V1_PUBLICATION_INCOMPATIBLE"));
    }

    const oversized = compilerInput();
    const seed = clone(oversized.adapters[1]!);
    const predicateChecks = [
      ["control_visible", "CHECK_CONTROL_VISIBLE"],
      ["control_action", "CHECK_CONTROL_ACTION"],
      ["state_transition", "CHECK_STATE_TRANSITION"],
      ["persistence_round_trip", "CHECK_PERSISTENCE_ROUND_TRIP"],
      ["navigation", "CHECK_NAVIGATION"],
      ["download", "CHECK_DOWNLOAD"],
      ["runtime", "CHECK_RUNTIME"],
      ["build", "CHECK_BUILD_PASS"],
      ["test", "CHECK_TEST_PASS"],
      ["visual", "CHECK_VISUAL"],
      ["observable_outcome", "CHECK_OBSERVABLE_OUTCOME"],
    ] as const;
    const lifecycleModes = [
      "none", "reload", "process_restart", "durable_readback", "flow_isolation",
      "download_completion",
    ] as const;
    const capabilities = [
      "CAP_BROWSER_INTERACTION",
      "CAP_RUNTIME_STATE",
      "CAP_LOCAL_PERSISTENCE",
      "CAP_VISUAL_CAPTURE",
      "CAP_TEST_RUNNER",
    ] as const;
    let globalIndex = 0;
    oversized.adapters = Array.from({ length: 64 }, (_, adapterIndex) => ({
      ...clone(seed),
      adapterRef: `ADAPTER_BROWSER_${String(adapterIndex).padStart(3, "0")}_V2`,
      supportSignatures: Array.from({ length: 128 }, () => {
        let cursor = globalIndex;
        globalIndex += 1;
        const [predicateKind, checkKind] = predicateChecks[cursor % predicateChecks.length]!;
        cursor = Math.floor(cursor / predicateChecks.length);
        const lifecycleMode = lifecycleModes[cursor % lifecycleModes.length]!;
        cursor = Math.floor(cursor / lifecycleModes.length);
        const capabilityMask = cursor % 32;
        cursor = Math.floor(cursor / 32);
        const inputTransportSchemaRefs = cursor % 2 === 0
          ? []
          : ["setfarm.action-input-transport.v2" as const];
        cursor = Math.floor(cursor / 2);
        const gameStack = cursor % 2 === 1;
        return {
          stackPackBinding: stackPackBinding(gameStack
            ? "browser-game-canvas"
            : "vite-react-web-app"),
          deliveryBinding: profileBinding(gameStack
            ? "PROFILE_BROWSER_GAME_REACT_CANVAS_EXACT_V1"
            : "PROFILE_WEB_REACT_EXACT_V1"),
          invocationKind: "browser_dom" as const,
          predicateKind,
          evidenceCapabilityRefs: capabilities.filter((_, index) =>
            (capabilityMask & (1 << index)) !== 0),
          inputTransportSchemaRefs,
          checkKind,
          lifecycleMode,
        };
      }),
    }));
    const oversizedResult = compileEvidenceAdapterRegistryV1(oversized);
    assert.equal(oversizedResult.status, "rejected");
    if (oversizedResult.status === "rejected") {
      assert.ok(oversizedResult.diagnostics.some((item) =>
        item.code === "EVIDENCE_ADAPTER_REGISTRY_V1_PUBLICATION_INCOMPATIBLE"
        || item.code === "EVIDENCE_ADAPTER_REGISTRY_V1_INPUT_INVALID"));
    }
  });
});
