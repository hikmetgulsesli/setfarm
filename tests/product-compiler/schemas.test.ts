import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NormalizedRelativeLocatorSchema,
  ProvenanceRefV1Schema,
  SemanticArtifactProducerV1Schema,
  Sha256Schema,
  SourceArtifactRefV1Schema,
} from "../../src/product-compiler/schemas/common-v1.js";
import {
  CompilationDiagnosticV1Schema,
  ProductCompilationReportV1Schema,
} from "../../src/product-compiler/schemas/compilation-report-v1.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../../src/product-compiler/diagnostics.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function diagnostic(code = "LINK_UNRESOLVED_CONTROL") {
  return {
    schema: "setfarm.compilation-diagnostic.v1" as const,
    code,
    category: "link" as const,
    severity: "error" as const,
    message: "The interactive control has no exact semantic binding.",
    artifactHash: HASH_A,
    reference: "CTRL_SAVE",
    provenance: [],
    suggestions: [],
  };
}

describe("product compiler common schemas", () => {
  it("accepts lowercase SHA-256 and rejects malformed hashes", () => {
    assert.equal(Sha256Schema.parse(HASH_A), HASH_A);
    for (const value of ["a".repeat(63), "A".repeat(64), `g${"a".repeat(63)}`]) {
      assert.equal(Sha256Schema.safeParse(value).success, false);
    }
  });

  it("accepts only normalized relative locators", () => {
    assert.equal(
      NormalizedRelativeLocatorSchema.parse("src/screens/index.tsx"),
      "src/screens/index.tsx",
    );
    for (const value of [
      "",
      "/tmp/source.tsx",
      "../source.tsx",
      "src/../source.tsx",
      "./src/source.tsx",
      "src\\source.tsx",
      "src//source.tsx",
    ]) {
      assert.equal(NormalizedRelativeLocatorSchema.safeParse(value).success, false);
    }
  });

  it("rejects unknown provenance and source-reference fields", () => {
    const provenance = {
      schema: "setfarm.provenance-ref.v1" as const,
      sourceHash: HASH_A,
      locator: "plan/product.md",
      confidence: "exact" as const,
    };
    assert.deepEqual(ProvenanceRefV1Schema.parse(provenance), provenance);
    assert.equal(
      ProvenanceRefV1Schema.safeParse({ ...provenance, hostPath: "/tmp/plan.md" }).success,
      false,
    );

    const sourceRef = {
      schema: "setfarm.source-artifact-ref.v1" as const,
      hash: HASH_A,
      mediaType: "text/markdown",
      locator: "plan/product.md",
      byteLength: 42,
    };
    assert.deepEqual(SourceArtifactRefV1Schema.parse(sourceRef), sourceRef);
    assert.equal(
      SourceArtifactRefV1Schema.safeParse({ ...sourceRef, runId: "run-1" }).success,
      false,
    );
  });

  it("keeps operational metadata out of semantic producer identity", () => {
    const producer = {
      pass: "legacy-plan-adapter",
      codeSha: "5840ae3",
      promptHash: HASH_B,
      toolVersions: { node: "22.0.0" },
    };
    assert.deepEqual(SemanticArtifactProducerV1Schema.parse(producer), producer);
    for (const extra of [
      { timestamp: "2026-07-12T00:00:00Z" },
      { pid: 42 },
      { hostname: "dev-host" },
      { absolutePath: "/tmp/source" },
    ]) {
      assert.equal(
        SemanticArtifactProducerV1Schema.safeParse({ ...producer, ...extra }).success,
        false,
      );
    }
  });
});

describe("product compilation diagnostics and reports", () => {
  it("rejects unknown fields and malformed diagnostic codes", () => {
    const value = diagnostic();
    assert.deepEqual(CompilationDiagnosticV1Schema.parse(value), value);
    assert.equal(
      CompilationDiagnosticV1Schema.safeParse({ ...value, proseVerdict: "probably fixed" }).success,
      false,
    );
    assert.equal(
      CompilationDiagnosticV1Schema.safeParse({ ...value, code: "regex bug" }).success,
      false,
    );
  });

  it("constructs and deterministically sorts bounded diagnostics", () => {
    const first = makeCompilationDiagnostic(diagnostic("LINK_ZETA"));
    const second = makeCompilationDiagnostic({
      ...diagnostic("CONTRACT_ALPHA"),
      category: "contract",
      artifactHash: HASH_B,
    });
    assert.deepEqual(
      sortCompilationDiagnostics([first, second]).map((item) => item.code),
      ["CONTRACT_ALPHA", "LINK_ZETA"],
    );
  });

  it("represents a rejected report without a packet hash", () => {
    const report = {
      schema: "setfarm.product-compilation-report.v1" as const,
      status: "rejected" as const,
      compiler: { version: "3.0.0-shadow.1", codeSha: "5840ae3" },
      inputHashes: [HASH_A],
      artifactHashes: { productSpec: HASH_B },
      diagnostics: [diagnostic()],
      validationIds: ["VALIDATE_REFERENCE_COMPLETENESS"],
      rejectionCodes: ["LINK_UNRESOLVED_CONTROL"],
    };
    assert.deepEqual(ProductCompilationReportV1Schema.parse(report), report);
    assert.equal(
      ProductCompilationReportV1Schema.safeParse({ ...report, packetHash: HASH_A }).success,
      false,
    );
  });

  it("represents a sealed report without rejection fields or error diagnostics", () => {
    const report = {
      schema: "setfarm.product-compilation-report.v1" as const,
      status: "sealed" as const,
      compiler: { version: "3.0.0-shadow.1", codeSha: "5840ae3" },
      inputHashes: [HASH_A],
      artifactHashes: {
        productSpec: HASH_A,
        designGraph: HASH_B,
        buildTopology: "c".repeat(64),
        storyPlan: "d".repeat(64),
      },
      diagnostics: [],
      validationIds: ["VALIDATE_REFERENCE_COMPLETENESS"],
      packetHash: "e".repeat(64),
    };
    assert.deepEqual(ProductCompilationReportV1Schema.parse(report), report);
    assert.equal(
      ProductCompilationReportV1Schema.safeParse({
        ...report,
        rejectionCodes: ["LINK_UNRESOLVED_CONTROL"],
      }).success,
      false,
    );
    assert.equal(
      ProductCompilationReportV1Schema.safeParse({
        ...report,
        diagnostics: [diagnostic()],
      }).success,
      false,
    );
  });
});
