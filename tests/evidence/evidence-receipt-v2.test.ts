import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import * as receiptModule from "../../src/evidence/schemas/evidence-receipt-v2.js";
import {
  EVIDENCE_CAPTURE_REDACTION_POLICY_REF_V2,
  EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2,
  EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2,
  EVIDENCE_PROCESS_SIGNAL_NAMES_V2,
  EVIDENCE_RECEIPT_V2_MAX_CANONICAL_BYTES,
  EVIDENCE_RECEIPT_SCHEMA_REVISION_V2,
  EvidenceOutcomeCandidateV2Schema,
  EvidenceReceiptAbiPolicyCandidateV2Schema,
  EvidenceReceiptCandidateV2Schema,
  createEvidenceOutcomeCandidateV2,
  evidenceCaptureRedactionPolicyHashV2,
  evidenceReceiptAbiPolicyHashV2,
  getEvidenceCaptureRedactionPolicyV2,
  getEvidenceReceiptAbiPolicyV2,
  hashEvidenceOutcomeV2,
  hashEvidenceReceiptV2,
  parseEvidenceReceiptCandidateV2,
  type EvidenceOutcomeCandidateV2,
  type EvidenceReceiptCandidateV2,
  type EvidenceReceiptHashPayloadV2,
} from "../../src/evidence/schemas/evidence-receipt-v2.js";

function sha(label: string): string {
  return createHash("sha256").update(label, "utf8").digest("hex");
}

const CAPTURE_ENVELOPE_HASH = sha("capture-envelope");

function capture() {
  return {
    schema: "setfarm.evidence-capture-ref.v2" as const,
    artifactEnvelopeHash: CAPTURE_ENVELOPE_HASH,
    contentHash: sha("capture-content"),
    byteLength: 57,
    mediaType: "application/json" as const,
    encoding: "identity" as const,
    redaction: {
      policyRef: EVIDENCE_CAPTURE_REDACTION_POLICY_REF_V2,
      policyHash: evidenceCaptureRedactionPolicyHashV2(),
      secretsRemoved: true as const,
      mutableLocatorStored: false as const,
    },
  };
}

function outcome(
  overrides: Partial<Parameters<typeof createEvidenceOutcomeCandidateV2>[0]> = {},
): EvidenceOutcomeCandidateV2 {
  return createEvidenceOutcomeCandidateV2({
    schema: "setfarm.evidence-outcome.v2",
    version: "2.0.0",
    checkKind: "cli_process",
    status: "passed",
    verdict: "pass",
    failureOwner: "none",
    code: "EVIDENCE_CHECK_PASSED",
    observedValueHash: sha("observed-value"),
    captureEnvelopeHashes: [CAPTURE_ENVELOPE_HASH],
    ...overrides,
  } as Parameters<typeof createEvidenceOutcomeCandidateV2>[0]);
}

function productFailure(
  checkKind: "cli_process" | "command" | "http_service",
): EvidenceOutcomeCandidateV2 {
  return createEvidenceOutcomeCandidateV2({
    schema: "setfarm.evidence-outcome.v2",
    version: "2.0.0",
    checkKind,
    status: "product_failed",
    verdict: "fail",
    failureOwner: "generated_product",
    code: "EVIDENCE_PRODUCT_OBSERVATION_MISMATCH",
    observedValueHash: sha(`product-failure:${checkKind}`),
    captureEnvelopeHashes: [CAPTURE_ENVELOPE_HASH],
  });
}

function infrastructureFailure(
  checkKind: "cli_process" | "command" | "http_service",
): EvidenceOutcomeCandidateV2 {
  return createEvidenceOutcomeCandidateV2({
    schema: "setfarm.evidence-outcome.v2",
    version: "2.0.0",
    checkKind,
    status: "infrastructure_failed",
    verdict: "inconclusive",
    failureOwner: "infrastructure",
    code: "EVIDENCE_INFRASTRUCTURE_UNAVAILABLE",
    captureEnvelopeHashes: [CAPTURE_ENVELOPE_HASH],
  });
}

type HttpLifecycle = Extract<
  EvidenceReceiptHashPayloadV2["lifecycle"],
  Readonly<{ kind: "http_service" }>
>;
type HttpAttempt = Extract<HttpLifecycle["request"], Readonly<{ status: "attempted" }>>;

function readyHttpLifecycle(
  observation: HttpAttempt["observation"],
): HttpLifecycle {
  return {
    kind: "http_service",
    serviceIdentityHash: sha("service"),
    startup: {
      status: "ready",
      privateListenerLeaseHash: sha("held-private-lease"),
      readinessReceiptHash: sha("readiness"),
    },
    request: {
      status: "attempted",
      requestCount: 1,
      redirectPolicy: "error",
      originPolicy: "exact_loopback_origin",
      timeoutMs: EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2,
      responseByteLimit: EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2,
      observation,
    },
    cleanupReceiptHash: sha("cleanup"),
    lifecycleReceiptHash: sha("http-lifecycle"),
  };
}

function receiptIdentity(
  overrides: Partial<EvidenceReceiptHashPayloadV2> = {},
): EvidenceReceiptHashPayloadV2 {
  const base: EvidenceReceiptHashPayloadV2 = {
    schema: "setfarm.evidence-receipt.v2",
    version: "2.0.0",
    authorityState: "candidate_unverified",
    productionUse: "forbidden",
    release: {
      activationAcknowledgementHash: sha("activation-ack"),
      platformReleaseManifestHash: sha("platform-manifest"),
      runtimePayloadHash: sha("runtime-payload"),
      externalResolutionHash: sha("external-resolution"),
      environmentCapsuleHash: sha("environment"),
      toolchainHash: sha("toolchain"),
      launcherDefinitionHash: sha("launcher-definition"),
      launcherModuleHash: sha("launcher-module"),
      runnerDefinitionHash: sha("runner-definition"),
      runnerModuleHash: sha("runner-module"),
      receiptSchemaHash: evidenceReceiptAbiPolicyHashV2(),
      adapterDefinitionHash: sha("adapter-definition"),
      adapterCatalogHash: sha("adapter-catalog"),
    },
    product: {
      packetHash: sha("packet-envelope"),
      buildTopologyHash: sha("build-topology"),
      profileCatalogHash: sha("profile-catalog"),
      profileId: "NODE_CLI_EXACT",
      profileHash: sha("profile"),
      stackPackHash: sha("stack-pack"),
      transportContractHash: sha("transport-contract"),
      executableTransportBindingHash: sha("executable-transport"),
    },
    candidate: {
      buildReceiptHash: sha("build-receipt"),
      runtimeBundleHash: sha("runtime-bundle"),
      launchTargetHash: sha("launch-target"),
    },
    execution: {
      runId: "run-receipt-fixture",
      attemptId: "ATT_0123456789abcdef",
      storyId: "STORY-ONE",
      sliceHash: sha("slice"),
      predicateRef: "EVID_CHECK_OUTPUT",
    },
    sourceBefore: {
      sha: "a".repeat(40),
      treeHash: "b".repeat(40),
    },
    sourceAfter: {
      sha: "a".repeat(40),
      treeHash: "b".repeat(40),
    },
    startedAt: "2026-07-18T10:00:00.000Z",
    finishedAt: "2026-07-18T10:00:00.250Z",
    durationMs: 250,
    invocationRequestHash: sha("request"),
    invocationResponseHash: outcome().outcomeHash,
    lifecycle: {
      kind: "cli_process",
      processIdentityHash: sha("process"),
      termination: {
        status: "normal_exit",
        exitCode: 0,
      },
      lifecycleReceiptHash: sha("lifecycle"),
    },
    outcome: outcome(),
    captures: [capture()],
  };
  const merged = { ...base, ...overrides };
  if (overrides.outcome !== undefined && overrides.invocationResponseHash === undefined) {
    merged.invocationResponseHash = overrides.outcome.outcomeHash;
  }
  return merged;
}

function receipt(
  overrides: Partial<EvidenceReceiptHashPayloadV2> = {},
): EvidenceReceiptCandidateV2 {
  const identity = receiptIdentity(overrides);
  return EvidenceReceiptCandidateV2Schema.parse({
    ...identity,
    receiptHash: hashEvidenceReceiptV2(identity),
  });
}

function rehash(candidate: EvidenceReceiptCandidateV2): EvidenceReceiptCandidateV2 {
  return {
    ...candidate,
    receiptHash: hashEvidenceReceiptV2(candidate),
  };
}

describe("EvidenceOutcomeV2 typed candidate contract", () => {
  it("publishes one frozen code-owned receipt ABI policy with a literal hash", () => {
    const policy = getEvidenceReceiptAbiPolicyV2();
    assert.equal(EvidenceReceiptAbiPolicyCandidateV2Schema.safeParse(policy).success, true);
    assert.equal(policy.policyHash, evidenceReceiptAbiPolicyHashV2());
    assert.equal(policy.policyHash, "adfcaec93bfa69f82583684ebc9b702fd928744007a7a27f6db382b89aec07cf");
    assert.equal(policy.diagnosticProsePolicy, "forbidden_use_redacted_capture");
    assert.equal(policy.httpRequestTimeoutMs, EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2);
    assert.equal(policy.httpResponseMaxBytes, EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2);
    assert.equal(policy.schemaRevision, EVIDENCE_RECEIPT_SCHEMA_REVISION_V2);
    assert.deepEqual(policy.processSignalNames, EVIDENCE_PROCESS_SIGNAL_NAMES_V2);
    assert.equal(policy.shapeSignatures.length, 29);
    assert.equal(policy.crossFieldRelations.length, 21);
    assert.equal(Object.isFrozen(policy), true);
    assert.equal(Object.isFrozen(policy.outcomeOwnership), true);
  });

  it("publishes one frozen code-owned capture redaction policy", () => {
    const policy = getEvidenceCaptureRedactionPolicyV2();
    assert.equal(policy.policyRef, EVIDENCE_CAPTURE_REDACTION_POLICY_REF_V2);
    assert.equal(policy.policyHash, evidenceCaptureRedactionPolicyHashV2());
    assert.equal(policy.unknownCredentialPolicy, "reject_capture");
    assert.equal(Object.isFrozen(policy), true);
    assert.equal(Object.isFrozen(policy.forbiddenHeaderNames), true);
  });

  it("pins the code-owned pass shape and a literal domain-separated hash", () => {
    const candidate = outcome();
    assert.equal(candidate.outcomeHash, hashEvidenceOutcomeV2(candidate));
    assert.equal(candidate.outcomeHash, "b99a36f6f4b84475367afe1e69acd0a5bd20e82b8d98d7edb09a304fca9bfdd0");
    assert.equal(Object.isFrozen(candidate), true);
    assert.equal(Object.isFrozen(candidate.captureEnvelopeHashes), true);
  });

  it("admits every typed owner variant without retry or classifier prose authority", () => {
    const variants = [
      ["product_failed", "fail", "generated_product", "EVIDENCE_PRODUCT_OBSERVATION_MISMATCH"],
      ["source_rejected", "fail", "generated_source", "EVIDENCE_SOURCE_AUTHORITY_CHANGED"],
      ["platform_rejected", "inconclusive", "platform_release", "EVIDENCE_PLATFORM_AUTHORITY_REJECTED"],
      ["infrastructure_failed", "inconclusive", "infrastructure", "EVIDENCE_INFRASTRUCTURE_UNAVAILABLE"],
      ["external_dependency_failed", "inconclusive", "external_dependency", "EVIDENCE_EXTERNAL_DEPENDENCY_UNAVAILABLE"],
      ["cancelled", "inconclusive", "operator", "EVIDENCE_EXECUTION_CANCELLED"],
    ] as const;
    for (const [status, verdict, failureOwner, code] of variants) {
      const candidate = createEvidenceOutcomeCandidateV2({
        schema: "setfarm.evidence-outcome.v2",
        version: "2.0.0",
        checkKind: "command",
        status,
        verdict,
        failureOwner,
        code,
        ...(status === "product_failed"
          ? { observedValueHash: sha("failed-observed-value") }
          : {}),
        captureEnvelopeHashes: [CAPTURE_ENVELOPE_HASH],
      });
      assert.equal(candidate.status, status);
      assert.equal("retry" in candidate, false);
      assert.equal("classifier" in candidate, false);
      assert.equal("agentProse" in candidate, false);
    }
  });

  it("rejects contradictory owners, duplicate captures, and direct hash drift", () => {
    const candidate = outcome();
    assert.equal(EvidenceOutcomeCandidateV2Schema.safeParse({
      ...candidate,
      failureOwner: "infrastructure",
    }).success, false);
    assert.equal(EvidenceOutcomeCandidateV2Schema.safeParse({
      ...candidate,
      captureEnvelopeHashes: [CAPTURE_ENVELOPE_HASH, CAPTURE_ENVELOPE_HASH],
    }).success, false);
    assert.equal(EvidenceOutcomeCandidateV2Schema.safeParse({
      ...candidate,
      outcomeHash: sha("forged-outcome"),
    }).success, false);
    const failedWithoutObservation = {
      schema: "setfarm.evidence-outcome.v2" as const,
      version: "2.0.0" as const,
      checkKind: "cli_process" as const,
      status: "product_failed" as const,
      verdict: "fail" as const,
      failureOwner: "generated_product" as const,
      code: "EVIDENCE_PRODUCT_OBSERVATION_MISMATCH" as const,
      captureEnvelopeHashes: [CAPTURE_ENVELOPE_HASH],
    };
    assert.throws(() => createEvidenceOutcomeCandidateV2(failedWithoutObservation));
  });

  it("rejects a caller-authored outcome code even with a matching domain hash", () => {
    const valid = productFailure("cli_process");
    const { outcomeHash: _outcomeHash, ...identity } = valid;
    const forgedIdentity = {
      ...identity,
      code: "EVIDENCE_CALLER_AUTHORED",
    };
    const forged = {
      ...forgedIdentity,
      outcomeHash: hashCanonicalJson({
        schema: "setfarm.evidence-outcome-payload.v2",
        outcome: forgedIdentity,
      }),
    };
    assert.equal(EvidenceOutcomeCandidateV2Schema.safeParse(forged).success, false);
  });
});

describe("EvidenceReceiptV2 candidate contract", () => {
  it("binds the complete release/product/candidate/execution chain to a literal golden", () => {
    const candidate = receipt();
    assert.equal(candidate.receiptHash, "739d8c13a6a3b86d7a7fdf44b402eee0b1b363e72fbccb3b12066298b7bcfd13");
    assert.equal(candidate.authorityState, "candidate_unverified");
    assert.equal(candidate.productionUse, "forbidden");
    assert.equal(Object.keys(candidate.release).length, 13);
    assert.equal(Object.isFrozen(parseEvidenceReceiptCandidateV2(candidate)), true);
  });

  it("rejects duration, lifecycle, capture, source, and direct hash drift after rehash", () => {
    const base = receipt();
    const cases: EvidenceReceiptCandidateV2[] = [
      rehash({ ...base, durationMs: 249 }),
      rehash({
        ...base,
        lifecycle: {
          kind: "command_process",
          processIdentityHash: sha("process"),
          termination: {
            status: "normal_exit",
            exitCode: 0,
          },
          lifecycleReceiptHash: sha("lifecycle"),
        },
      }),
      rehash({ ...base, captures: [{ ...capture(), artifactEnvelopeHash: sha("other") }] }),
      rehash({
        ...base,
        lifecycle: {
          ...base.lifecycle,
          termination: {
            status: "platform_terminated",
            signal: "SIGTERM",
            terminationReceiptHash: sha("platform-termination"),
          },
        },
      }),
      rehash({
        ...base,
        sourceAfter: { sha: "c".repeat(40), treeHash: "d".repeat(40) },
      }),
    ];
    for (const candidate of cases) {
      assert.equal(EvidenceReceiptCandidateV2Schema.safeParse(candidate).success, false);
    }
    assert.equal(EvidenceReceiptCandidateV2Schema.safeParse({
      ...base,
      receiptHash: sha("wrong-receipt"),
    }).success, false);
  });

  it("rejects caller-authored ABI, redaction, and impossible timestamp authority after rehash", () => {
    const base = receipt();
    const forgedSchema = rehash({
      ...base,
      release: {
        ...base.release,
        receiptSchemaHash: sha("caller-receipt-schema"),
      },
    });
    const forgedRedaction = rehash({
      ...base,
      captures: [{
        ...capture(),
        redaction: {
          ...capture().redaction,
          policyHash: sha("caller-redaction-policy"),
        },
      }],
    });
    const impossibleTimestamp = rehash({
      ...base,
      startedAt: "2026-02-30T10:00:00.000Z",
    });
    for (const candidate of [forgedSchema, forgedRedaction, impossibleTimestamp]) {
      assert.equal(EvidenceReceiptCandidateV2Schema.safeParse(candidate).success, false);
    }
  });

  it("permits source drift only as an exact typed source rejection", () => {
    const sourceRejected = createEvidenceOutcomeCandidateV2({
      schema: "setfarm.evidence-outcome.v2",
      version: "2.0.0",
      checkKind: "cli_process",
      status: "source_rejected",
      verdict: "fail",
      failureOwner: "generated_source",
      code: "EVIDENCE_SOURCE_AUTHORITY_CHANGED",
      captureEnvelopeHashes: [CAPTURE_ENVELOPE_HASH],
    });
    const candidate = receipt({
      sourceAfter: { sha: "c".repeat(40), treeHash: "d".repeat(40) },
      outcome: sourceRejected,
    });
    assert.equal(candidate.outcome.status, "source_rejected");
    assert.equal(receipt({ outcome: sourceRejected }).outcome.status, "source_rejected");
  });

  it("closes HTTP redirect/origin/lease lifecycle policy structurally", () => {
    const httpOutcome = createEvidenceOutcomeCandidateV2({
      schema: "setfarm.evidence-outcome.v2",
      version: "2.0.0",
      checkKind: "http_service",
      status: "passed",
      verdict: "pass",
      failureOwner: "none",
      code: "EVIDENCE_CHECK_PASSED",
      observedValueHash: sha("http-value"),
      captureEnvelopeHashes: [CAPTURE_ENVELOPE_HASH],
    });
    const candidate = receipt({
      outcome: httpOutcome,
      lifecycle: {
        kind: "http_service",
        serviceIdentityHash: sha("service"),
        startup: {
          status: "ready",
          privateListenerLeaseHash: sha("held-private-lease"),
          readinessReceiptHash: sha("readiness"),
        },
        request: {
          status: "attempted",
          requestCount: 1,
          redirectPolicy: "error",
          originPolicy: "exact_loopback_origin",
          timeoutMs: EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2,
          responseByteLimit: EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2,
          observation: {
            status: "response",
            httpStatus: 200,
            bodyByteLength: 57,
          },
        },
        cleanupReceiptHash: sha("cleanup"),
        lifecycleReceiptHash: sha("http-lifecycle"),
      },
    });
    assert.equal(candidate.lifecycle.kind, "http_service");
    assert.equal(candidate.lifecycle.request.status, "attempted");
    assert.equal(candidate.lifecycle.request.redirectPolicy, "error");
    assert.equal(EvidenceReceiptCandidateV2Schema.safeParse(rehash({
      ...candidate,
      lifecycle: {
        ...candidate.lifecycle,
        request: {
          ...candidate.lifecycle.request,
          observation: {
            status: "response",
            httpStatus: 500,
            bodyByteLength: 57,
          },
        },
      },
    })).success, false);
  });

  it("preserves typed product ownership across HTTP startup and readiness failures", () => {
    const failed = productFailure("http_service");
    const startups = [
      {
        status: "start_failed",
        privateListenerLeaseHash: sha("start-failure-lease"),
        startFailureReceiptHash: sha("start-failure"),
      },
      {
        status: "readiness_failed",
        privateListenerLeaseHash: sha("readiness-lease"),
        readinessFailureReceiptHash: sha("readiness-failure"),
      },
    ] as const;
    for (const startup of startups) {
      const candidate = receipt({
        outcome: failed,
        lifecycle: {
          kind: "http_service",
          serviceIdentityHash: sha(`service:${startup.status}`),
          startup,
          request: {
            status: "not_attempted",
            requestCount: 0,
          },
          cleanupReceiptHash: sha(`cleanup:${startup.status}`),
          lifecycleReceiptHash: sha(`lifecycle:${startup.status}`),
        },
      });
      assert.equal(candidate.outcome.failureOwner, "generated_product");
      assert.equal(candidate.lifecycle.kind, "http_service");
      assert.equal(candidate.lifecycle.startup.status, startup.status);
      assert.equal(candidate.lifecycle.request.status, "not_attempted");
    }

    const startFailed = receipt({
      outcome: failed,
      lifecycle: {
        kind: "http_service",
        serviceIdentityHash: sha("service:missing-lease"),
        startup: {
          status: "start_failed",
          privateListenerLeaseHash: sha("start-failure-lease"),
          startFailureReceiptHash: sha("start-failure"),
        },
        request: { status: "not_attempted", requestCount: 0 },
        cleanupReceiptHash: sha("cleanup:missing-lease"),
        lifecycleReceiptHash: sha("lifecycle:missing-lease"),
      },
    });
    const missingLease = structuredClone(startFailed) as unknown as Record<string, unknown>;
    const lifecycle = missingLease.lifecycle as Record<string, unknown>;
    const startup = lifecycle.startup as Record<string, unknown>;
    delete startup.privateListenerLeaseHash;
    missingLease.receiptHash = hashEvidenceReceiptV2(missingLease as never);
    assert.equal(EvidenceReceiptCandidateV2Schema.safeParse(missingLease).success, false);
  });

  it("preserves typed product ownership for every bounded HTTP request failure", () => {
    const failed = productFailure("http_service");
    const observations: readonly HttpAttempt["observation"][] = [
      {
        status: "timeout",
        timeoutMs: EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2,
        observationReceiptHash: sha("timeout-observation"),
      },
      {
        status: "connection_error",
        errorCode: "ECONNRESET",
        observationReceiptHash: sha("connection-observation"),
      },
      {
        status: "redirect_rejected",
        locationHash: sha("redirect-location"),
        observationReceiptHash: sha("redirect-observation"),
      },
      {
        status: "response_limit_exceeded",
        responseByteLimit: EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2,
        observedByteLength: EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2 + 1,
        observationReceiptHash: sha("response-limit-observation"),
      },
    ];
    for (const observation of observations) {
      const candidate = receipt({
        outcome: failed,
        lifecycle: readyHttpLifecycle(observation),
      });
      assert.equal(candidate.outcome.status, "product_failed");
      assert.equal(candidate.lifecycle.kind, "http_service");
      assert.equal(candidate.lifecycle.request.status, "attempted");
      assert.equal(candidate.lifecycle.request.observation.status, observation.status);
    }
  });

  it("rejects timeout observations that contradict the code-owned request limit", () => {
    const failed = productFailure("http_service");
    const candidate = receipt({
      outcome: failed,
      lifecycle: readyHttpLifecycle({
        status: "timeout",
        timeoutMs: EVIDENCE_HTTP_REQUEST_TIMEOUT_MS_V2,
        observationReceiptHash: sha("timeout-observation"),
      }),
    });
    assert.equal(candidate.lifecycle.kind, "http_service");
    assert.equal(candidate.lifecycle.request.status, "attempted");
    const forged = structuredClone(candidate) as unknown as Record<string, unknown>;
    const lifecycle = forged.lifecycle as Record<string, unknown>;
    const request = lifecycle.request as Record<string, unknown>;
    const observation = request.observation as Record<string, unknown>;
    observation.timeoutMs = 1;
    forged.receiptHash = hashEvidenceReceiptV2(forged as never);
    assert.equal(EvidenceReceiptCandidateV2Schema.safeParse(forged).success, false);
  });

  it("represents signal exit and process loss without inventing exit codes", () => {
    const signalFailure = receipt({
      outcome: productFailure("cli_process"),
      lifecycle: {
        kind: "cli_process",
        processIdentityHash: sha("signalled-process"),
        termination: {
          status: "signal_exit",
          signal: {
            kind: "known_posix",
            name: "SIGINT",
          },
          coreDumped: false,
          observationReceiptHash: sha("signal-observation"),
        },
        lifecycleReceiptHash: sha("signal-lifecycle"),
      },
    });
    const lostFailure = receipt({
      outcome: infrastructureFailure("command"),
      lifecycle: {
        kind: "command_process",
        processIdentityHash: sha("lost-process"),
        termination: {
          status: "process_lost",
          observationReceiptHash: sha("lost-observation"),
        },
        lifecycleReceiptHash: sha("lost-lifecycle"),
      },
    });
    const futureSignalFailure = receipt({
      outcome: productFailure("cli_process"),
      lifecycle: {
        kind: "cli_process",
        processIdentityHash: sha("runtime-signalled-process"),
        termination: {
          status: "signal_exit",
          signal: {
            kind: "runtime_reported_name",
            name: "SIGRTMIN+3",
          },
          coreDumped: false,
          observationReceiptHash: sha("runtime-signal-observation"),
        },
        lifecycleReceiptHash: sha("runtime-signal-lifecycle"),
      },
    });
    const numericSignalFailure = receipt({
      outcome: infrastructureFailure("command"),
      lifecycle: {
        kind: "command_process",
        processIdentityHash: sha("numeric-signalled-process"),
        termination: {
          status: "signal_exit",
          signal: {
            kind: "runtime_reported_number",
            signalNumber: 37,
          },
          coreDumped: false,
          observationReceiptHash: sha("numeric-signal-observation"),
        },
        lifecycleReceiptHash: sha("numeric-signal-lifecycle"),
      },
    });
    assert.equal(signalFailure.lifecycle.kind, "cli_process");
    assert.equal(signalFailure.lifecycle.termination.status, "signal_exit");
    assert.equal("exitCode" in signalFailure.lifecycle.termination, false);
    assert.equal(lostFailure.lifecycle.kind, "command_process");
    assert.equal(lostFailure.lifecycle.termination.status, "process_lost");
    assert.equal("exitCode" in lostFailure.lifecycle.termination, false);
    assert.equal(futureSignalFailure.lifecycle.kind, "cli_process");
    assert.equal(futureSignalFailure.lifecycle.termination.status, "signal_exit");
    assert.equal(futureSignalFailure.lifecycle.termination.signal.kind, "runtime_reported_name");
    assert.equal(numericSignalFailure.lifecycle.kind, "command_process");
    assert.equal(numericSignalFailure.lifecycle.termination.status, "signal_exit");
    assert.equal(
      numericSignalFailure.lifecycle.termination.signal.kind,
      "runtime_reported_number",
    );
  });

  it("represents a typed pre-start infrastructure refusal without inventing a process", () => {
    const blockedOutcome = createEvidenceOutcomeCandidateV2({
      schema: "setfarm.evidence-outcome.v2",
      version: "2.0.0",
      checkKind: "http_service",
      status: "infrastructure_failed",
      verdict: "inconclusive",
      failureOwner: "infrastructure",
      code: "EVIDENCE_INFRASTRUCTURE_UNAVAILABLE",
      captureEnvelopeHashes: [CAPTURE_ENVELOPE_HASH],
    });
    const candidate = receipt({
      invocationResponseHash: blockedOutcome.outcomeHash,
      outcome: blockedOutcome,
      lifecycle: {
        kind: "not_started",
        intendedCheckKind: "http_service",
        reasonOwner: "infrastructure",
        lifecycleReceiptHash: sha("not-started"),
      },
    });
    assert.equal(candidate.lifecycle.kind, "not_started");
  });

  it("rejects mutable locators, unknown fields, oversized input, and hostile proxies", () => {
    const candidate = receipt();
    assert.equal(EvidenceReceiptCandidateV2Schema.safeParse({
      ...candidate,
      worktree: "/tmp/mutable-candidate",
    }).success, false);
    assert.throws(() => parseEvidenceReceiptCandidateV2({
      ...candidate,
      padding: "x".repeat(EVIDENCE_RECEIPT_V2_MAX_CANONICAL_BYTES),
    }));

    let trapped = false;
    const hostile = new Proxy({}, {
      get() {
        trapped = true;
        throw new Error("trap");
      },
    });
    assert.throws(() => parseEvidenceReceiptCandidateV2(hostile));
    assert.equal(trapped, false);
  });

  it("exports no production authority issuer or runnable surface", () => {
    const exportedNames = Object.keys(receiptModule);
    assert.equal(exportedNames.some((name) => /^(?:verify|issue|materialize|activate|run)/i.test(name)), false);
    assert.equal(exportedNames.some((name) => /(?:Brand|Verified|Activated|Retry|Classifier)/.test(name)), false);
  });
});
