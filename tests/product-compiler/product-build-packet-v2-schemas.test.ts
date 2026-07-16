import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { validateDesignSourceClosureInputV1 } from "../../src/product-compiler/design-source-closure-compiler.js";
import {
  DesignSourceClosureV1Schema,
} from "../../src/product-compiler/schemas/design-source-closure-v1.js";
import {
  ProductCompilationReportV2Schema,
} from "../../src/product-compiler/schemas/compilation-report-v2.js";
import {
  ProductBuildPacketV1Schema,
} from "../../src/product-compiler/schemas/product-build-packet-v1.js";
import {
  ProductBuildPacketV2Schema,
} from "../../src/product-compiler/schemas/product-build-packet-v2.js";
import { buildMinimalValidV3PacketV2Contracts } from "./fixtures/minimal-valid-contract.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);
const HASH_F = "f".repeat(64);
const HASH_0 = "0".repeat(64);

function artifactRef(artifactType: string, envelopeHash: string, payloadHash: string) {
  return { artifactType, envelopeHash, payloadHash };
}

function stitchClosure() {
  return {
    schema: "setfarm.design-source-closure.v1" as const,
    kind: "stitch" as const,
    generationTargets: artifactRef(
      "setfarm.design-generation-targets.v1",
      HASH_A,
      HASH_B,
    ),
    directResponseEvidence: artifactRef(
      "setfarm.stitch-direct-response-evidence.v2",
      HASH_C,
      HASH_D,
    ),
    renderedSemantics: artifactRef(
      "setfarm.stitch-rendered-semantics.v1",
      HASH_D,
      HASH_E,
    ),
    candidateSelection: artifactRef(
      "setfarm.stitch-target-candidate-selection.v1",
      HASH_E,
      HASH_F,
    ),
    responseBindings: artifactRef(
      "setfarm.stitch-target-response-bindings.v2",
      HASH_0,
      HASH_A,
    ),
  };
}

function packetV2() {
  return {
    schema: "setfarm.product-build-packet.v2" as const,
    packetVersion: 2 as const,
    parentPacketHashes: [HASH_A],
    productSpecHash: HASH_B,
    designGraphHash: HASH_C,
    buildTopologyHash: HASH_D,
    storyPlanHash: HASH_E,
    runtimeDataContractHash: HASH_F,
    runtimeEvidenceContractHash: HASH_0,
    designSourceClosureHash: HASH_A,
    compiler: { version: "3.5.0", codeSha: "b57b693" },
    validationIds: ["VALIDATE_DESIGN_SOURCE_CLOSURE"],
  };
}

function errorDiagnostic() {
  return {
    schema: "setfarm.compilation-diagnostic.v1" as const,
    code: "CONTRACT_DESIGN_SOURCE_CLOSURE_INVALID",
    category: "contract" as const,
    severity: "error" as const,
    message: "The design source closure is not exact.",
    provenance: [],
    suggestions: [],
  };
}

function sealedReportV2() {
  return {
    schema: "setfarm.product-compilation-report.v2" as const,
    status: "sealed" as const,
    compiler: { version: "3.5.0", codeSha: "b57b693" },
    inputHashes: [HASH_A, HASH_B],
    artifactHashes: {
      productSpec: HASH_B,
      designGraph: HASH_C,
      buildTopology: HASH_D,
      storyPlan: HASH_E,
      designSourceClosure: HASH_F,
    },
    diagnostics: [],
    validationIds: ["VALIDATE_DESIGN_SOURCE_CLOSURE"],
    packetHash: HASH_0,
  };
}

describe("Design Source Closure v1", () => {
  it("accepts only the exact none or Stitch closure shapes", () => {
    const none = {
      schema: "setfarm.design-source-closure.v1" as const,
      kind: "none" as const,
      reason: "product_delivery_design_not_required" as const,
    };
    assert.deepEqual(DesignSourceClosureV1Schema.parse(none), none);
    assert.deepEqual(DesignSourceClosureV1Schema.parse(stitchClosure()), stitchClosure());

    assert.equal(
      DesignSourceClosureV1Schema.safeParse({ ...none, generationTargets: HASH_A }).success,
      false,
    );
    assert.equal(
      DesignSourceClosureV1Schema.safeParse({ ...stitchClosure(), reviewComment: "looks good" }).success,
      false,
    );
  });

  it("binds every Stitch child reference to its exact artifact type", () => {
    const fields = [
      ["generationTargets", "setfarm.stitch-direct-response-evidence.v2"],
      ["directResponseEvidence", "setfarm.stitch-rendered-semantics.v1"],
      ["renderedSemantics", "setfarm.stitch-target-candidate-selection.v1"],
      ["candidateSelection", "setfarm.stitch-target-response-bindings.v2"],
      ["responseBindings", "setfarm.design-generation-targets.v1"],
    ] as const;

    for (const [field, wrongArtifactType] of fields) {
      const value = structuredClone(stitchClosure());
      value[field].artifactType = wrongArtifactType;
      assert.equal(
        DesignSourceClosureV1Schema.safeParse(value).success,
        false,
        `${field} accepted ${wrongArtifactType}`,
      );
    }
  });

  it("rejects missing, malformed, or embellished child identities", () => {
    const missingPayload = structuredClone(stitchClosure()) as any;
    delete missingPayload.candidateSelection.payloadHash;
    assert.equal(DesignSourceClosureV1Schema.safeParse(missingPayload).success, false);

    const malformedEnvelope = structuredClone(stitchClosure());
    malformedEnvelope.directResponseEvidence.envelopeHash = "A".repeat(64);
    assert.equal(DesignSourceClosureV1Schema.safeParse(malformedEnvelope).success, false);

    const embellished = structuredClone(stitchClosure()) as any;
    embellished.responseBindings.locator = "stitch/response-bindings.json";
    assert.equal(DesignSourceClosureV1Schema.safeParse(embellished).success, false);
  });

  it("requires response bindings to carry the exact selected semantic-check element set", () => {
    const contracts = buildMinimalValidV3PacketV2Contracts();
    const responseBindings = structuredClone(contracts.designSource.responseBindings) as any;
    const previousHash = hashCanonicalJson(responseBindings);
    responseBindings.bindings[0].contractElementRefs = responseBindings.bindings[0].contractElementRefs.slice(1);
    const nextHash = hashCanonicalJson(responseBindings);
    const designGraph = structuredClone(contracts.designGraph);
    designGraph.rawArtifactHashes = designGraph.rawArtifactHashes
      .filter((hash) => hash !== previousHash)
      .concat(nextHash)
      .sort();

    const result = validateDesignSourceClosureInputV1({
      productSpec: contracts.productSpec,
      designGraph,
      designSource: {
        ...contracts.designSource,
        responseBindings,
      },
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(
      result.issues.some((entry) => entry.code === "CONTRACT_DESIGN_SOURCE_TARGET_BINDING_MISMATCH"),
      true,
    );
  });
});

describe("Product Build Packet v2", () => {
  it("mirrors the v1 packet core and seals a required design-source closure", () => {
    const packet = packetV2();
    assert.deepEqual(ProductBuildPacketV2Schema.parse(packet), packet);

    const missingClosure = structuredClone(packet) as any;
    delete missingClosure.designSourceClosureHash;
    assert.equal(ProductBuildPacketV2Schema.safeParse(missingClosure).success, false);
    assert.equal(ProductBuildPacketV2Schema.safeParse({ ...packet, packetVersion: 1 }).success, false);
    assert.equal(ProductBuildPacketV2Schema.safeParse({ ...packet, sealedAt: "now" }).success, false);
  });

  it("keeps v1 and v2 packet boundaries disjoint", () => {
    const v2 = packetV2();
    assert.equal(ProductBuildPacketV1Schema.safeParse(v2).success, false);

    const v1 = {
      ...v2,
      schema: "setfarm.product-build-packet.v1" as const,
      packetVersion: 1 as const,
    } as any;
    delete v1.designSourceClosureHash;
    assert.equal(ProductBuildPacketV1Schema.safeParse(v1).success, true);
    assert.equal(ProductBuildPacketV2Schema.safeParse(v1).success, false);
  });

  it("rejects duplicate authority identities", () => {
    const packet = packetV2();
    assert.equal(
      ProductBuildPacketV2Schema.safeParse({
        ...packet,
        parentPacketHashes: [HASH_A, HASH_A],
      }).success,
      false,
    );
    assert.equal(
      ProductBuildPacketV2Schema.safeParse({
        ...packet,
        validationIds: ["VALIDATE_DESIGN_SOURCE_CLOSURE", "VALIDATE_DESIGN_SOURCE_CLOSURE"],
      }).success,
      false,
    );
  });
});

describe("Product Compilation Report v2", () => {
  it("attests the exact sealed core, closure, and packet hashes", () => {
    const report = sealedReportV2();
    assert.deepEqual(ProductCompilationReportV2Schema.parse(report), report);

    const missingClosure = structuredClone(report) as any;
    delete missingClosure.artifactHashes.designSourceClosure;
    assert.equal(ProductCompilationReportV2Schema.safeParse(missingClosure).success, false);

    assert.equal(
      ProductCompilationReportV2Schema.safeParse({
        ...report,
        artifactHashes: { ...report.artifactHashes, sourceSnapshot: HASH_A },
      }).success,
      false,
    );
    assert.equal(
      ProductCompilationReportV2Schema.safeParse({ ...report, rejectionCodes: ["CONTRACT_FAIL"] }).success,
      false,
    );
  });

  it("rejects error diagnostics from sealed reports", () => {
    assert.equal(
      ProductCompilationReportV2Schema.safeParse({
        ...sealedReportV2(),
        diagnostics: [errorDiagnostic()],
      }).success,
      false,
    );
  });

  it("keeps rejected reports packet-free and ties rejection codes to errors", () => {
    const rejected = {
      schema: "setfarm.product-compilation-report.v2" as const,
      status: "rejected" as const,
      compiler: { version: "3.5.0", codeSha: "b57b693" },
      inputHashes: [HASH_A],
      artifactHashes: { productSpec: HASH_B, designSourceClosure: HASH_C },
      diagnostics: [errorDiagnostic()],
      validationIds: ["VALIDATE_DESIGN_SOURCE_CLOSURE"],
      rejectionCodes: ["CONTRACT_DESIGN_SOURCE_CLOSURE_INVALID"],
    };
    assert.deepEqual(ProductCompilationReportV2Schema.parse(rejected), rejected);
    assert.equal(
      ProductCompilationReportV2Schema.safeParse({ ...rejected, packetHash: HASH_D }).success,
      false,
    );
    assert.equal(
      ProductCompilationReportV2Schema.safeParse({
        ...rejected,
        rejectionCodes: ["CONTRACT_ANOTHER_ERROR"],
      }).success,
      false,
    );
  });
});
