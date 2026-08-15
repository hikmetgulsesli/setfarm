import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";
import {
  STITCH_STAGE_PROVIDER_REJECTION_POLICY_V1,
  StitchStageProviderRejectionV1Schema,
  canonicalStitchStageProviderRejectionV1,
  parseStitchStageProviderRejectionProcessEnvelopeV1,
} from "../../src/product-compiler/stitch-stage-provider-rejection-v1.js";

function providerRejection(diagnostic = "Request contains an invalid argument") {
  return StitchStageProviderRejectionV1Schema.parse({
    schema: "setfarm.stitch-stage-provider-rejection.v1",
    classification: "explicit_mcp_error_before_accepted_result",
    tool: "generate_screen_from_text",
    isError: true,
    acceptedResult: false,
    acceptedScreenIds: [],
    acceptedArtifactLocators: [],
    diagnosticCode: "STITCH_MCP_TOOL_ERROR",
    diagnostic,
    diagnosticHash: hashCanonicalJson({
      schema: "setfarm.stitch-stage-provider-rejection-diagnostic.v1",
      diagnostic,
    }),
  });
}

describe("Stitch stage provider rejection v1", () => {
  it("parses one exact canonical stderr envelope with empty stdout", () => {
    assert.deepEqual(STITCH_STAGE_PROVIDER_REJECTION_POLICY_V1, {
      schema: "setfarm.stitch-stage-provider-rejection-policy.v1",
      maximumDiagnosticCodeUnits: 700,
      maximumCanonicalEnvelopeBytes: 4 * 1024,
      redactionPolicy: "aq-credential-token-redaction.v1",
    });
    const envelope = providerRejection();

    assert.deepEqual(
      parseStitchStageProviderRejectionProcessEnvelopeV1({
        stdout: "",
        stderr: `${canonicalStitchStageProviderRejectionV1(envelope)}\n`,
      }),
      envelope,
    );
  });

  it("rejects output ambiguity, accepted artifacts, secret diagnostics, and hash drift", () => {
    const envelope = providerRejection();
    const canonical = canonicalStitchStageProviderRejectionV1(envelope);
    const withDiagnostic = (diagnostic: string) => ({
      ...envelope,
      diagnostic,
      diagnosticHash: hashCanonicalJson({
        schema: "setfarm.stitch-stage-provider-rejection-diagnostic.v1",
        diagnostic,
      }),
    });
    const secretDiagnostics = [
      "Authorization=[REDACTED] FAKE_SECRET_123",
      "provider rejected Bearer FAKE_SECRET_123",
      "Bearer=[REDACTED] FAKE_SECRET_456",
      "Bearer: FAKE_SECRET_456",
      "bearer=FAKE_SECRET_456",
      "Authorization=[REDACTED], response=FAKE_SECRET_789",
      "Bearer=[REDACTED],FAKE_SECRET_789",
    ];
    for (const diagnostic of secretDiagnostics) {
      const candidate = withDiagnostic(diagnostic);
      assert.equal(StitchStageProviderRejectionV1Schema.safeParse(candidate).success, false);
      assert.throws(() => parseStitchStageProviderRejectionProcessEnvelopeV1({
        stdout: "",
        stderr: `${canonicalJsonStringify(candidate)}\n`,
      }));
    }
    const invalid = [
      { stdout: "provider output", stderr: `${canonical}\n` },
      { stdout: "", stderr: `${canonical}\nextra\n` },
      { stdout: "", stderr: `${canonical}\n\n` },
      { stdout: "", stderr: `${JSON.stringify({ ...envelope, isError: false })}\n` },
      { stdout: "", stderr: `${JSON.stringify({ ...envelope, acceptedScreenIds: ["screen-1"] })}\n` },
      { stdout: "", stderr: `${JSON.stringify({ ...envelope, acceptedArtifactLocators: ["screen.html"] })}\n` },
      { stdout: "", stderr: `${JSON.stringify({ ...envelope, extra: true })}\n` },
      { stdout: "", stderr: `${JSON.stringify({ ...envelope, diagnostic: "x".repeat(701) })}\n` },
      { stdout: "", stderr: `${JSON.stringify({ ...envelope, diagnostic: "token=secret-value" })}\n` },
      { stdout: "", stderr: `${JSON.stringify({ ...envelope, diagnosticHash: "f".repeat(64) })}\n` },
      { stdout: "", stderr: `${JSON.stringify({ error: '{"isError":true}' })}\n` },
    ];

    for (const output of invalid) {
      assert.throws(() => parseStitchStageProviderRejectionProcessEnvelopeV1(output));
    }
    assert.throws(
      () => parseStitchStageProviderRejectionProcessEnvelopeV1({
        stdout: "",
        stderr: `${JSON.stringify({ padding: "x".repeat(4 * 1024) })}\n`,
      }),
      /STITCH_PROVIDER_REJECTION_ENVELOPE_CAPACITY_EXCEEDED/,
    );
  });
});
