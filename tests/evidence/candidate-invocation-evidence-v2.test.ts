import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  CandidateInvocationEvidenceCaptureV2,
  CandidateInvocationEvidenceErrorV2,
  CandidateInvocationEvidenceExecutionAuthorityV2,
  copyCandidateInvocationEvidenceCaptureV2ForTest,
  runCandidateInvocationEvidenceV2ForTest,
} from
  "../../src/evidence/candidate-invocation-evidence-v2.js";
import {
  hashInvocationEvidenceEvaluationV2,
} from
  "../../src/evidence/invocation-evidence-evaluator-v2.js";
import {
  canonicalJsonBytes,
} from "../../src/product-compiler/canonical-json.js";
import {
  CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2,
  CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_HASH_V2,
  CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_V2,
  CandidateInvocationEvidenceObservationV2Schema,
  createCandidateInvocationEvidenceObservationV2,
  hashCandidateInvocationEvidenceObservationV2,
  parseCandidateInvocationEvidenceObservationV2,
  type CandidateInvocationEvidenceObservationHashPayloadV2,
  type CandidateInvocationEvidenceObservationV2,
} from
  "../../src/evidence/schemas/candidate-invocation-evidence-observation-v2.js";

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function observationIdentity(
  kind: "cli_process" | "http_service" = "cli_process",
): CandidateInvocationEvidenceObservationHashPayloadV2 {
  const checkHash = sha("check");
  const contractHash = sha("contract");
  const requestHash = sha("request");
  const evaluationIdentity = {
    schema: "setfarm.invocation-evidence-evaluation.v2" as const,
    version: "2.0.0" as const,
    checkHash,
    transportContractHash: contractHash,
    encodedRequestHash: requestHash,
    status: "passed" as const,
    verdict: "pass" as const,
    failureOwner: "none" as const,
    outcomeCode: "EVIDENCE_CHECK_PASSED" as const,
    reasonCode:
      "INVOCATION_EVIDENCE_ACTION_INVOCATION_PASSED" as const,
    observedValueHash: sha("observed"),
  };
  const evaluation = {
    ...evaluationIdentity,
    evaluationHash:
      hashInvocationEvidenceEvaluationV2(evaluationIdentity),
  };
  return {
    schema:
      "setfarm.candidate-invocation-evidence-observation.v2",
    version: "2.0.0",
    contractHash:
      CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_HASH_V2,
    authorityState:
      "observed_unverified_release_candidate",
    productionUse:
      "forbidden_until_verified_release_join",
    admissionScope: "test_fixture",
    releaseBlockers: [
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[0],
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[1],
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[2],
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[3],
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[4],
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[5],
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2[6],
    ],
    invocationKind: kind,
    execution: {
      runId: "run-candidate-invocation",
      attemptId: "ATT_0123456789abcdef",
      storyId: "STORY-CANDIDATE-INVOCATION",
      sliceHash: sha("slice"),
      predicateRef: "EVID_ACTION_CALL",
    },
    sourceAuthority: {
      candidateSourceReceiptHash: sha("candidate-source"),
      semanticRevisionHash: sha("semantic-revision"),
      implementationClosureHash: sha("closure"),
      sourceMaterializationReceiptHash: sha("materialization"),
      packetHash: sha("packet"),
    },
    runtimeAuthority: {
      buildReceiptHash: sha("build"),
      buildTopologyHash: sha("topology"),
      runtimeBundleHash: sha("runtime"),
    },
    transportAuthority: {
      contractHash,
      contractSetHash: sha("contract-set"),
      contractMembershipHash: sha("membership"),
      runtimeSourceLogicalReceiptHash: sha("runtime-source"),
      encodedRequestHash: requestHash,
    },
    checkAuthority: {
      checkHash,
      predicateKind: "action_invocation",
      checkRef: "CHECK_ACTION_INVOCATION",
      actionRef: "ACTION_CREATE",
    },
    launcherAuthority: {
      launcherRef: kind === "cli_process"
        ? "LAUNCH_NODE_CLI_V2"
        : "LAUNCH_NODE_EXPRESS_API_V2",
      observationReceiptHash: sha("launcher-observation"),
      sourceFenceBeforeHash: sha("fence"),
      sourceFenceAfterHash: sha("fence"),
    },
    response: kind === "cli_process"
      ? {
          kind: "cli_process_result",
          exitCode: 0,
          stdoutContentHash: sha("stdout"),
          stdoutByteLength: 57,
          stderrContentHash: sha("stderr"),
          stderrByteLength: 0,
        }
      : {
          kind: "http_response",
          statusCode: 201,
          bodyContentHash: sha("body"),
          bodyByteLength: 57,
        },
    evaluation,
    startedAt: "2026-07-26T10:00:00.000Z",
    finishedAt: "2026-07-26T10:00:00.250Z",
    durationMs: 250,
  };
}

function rehash(
  value: CandidateInvocationEvidenceObservationV2,
): CandidateInvocationEvidenceObservationV2 {
  return {
    ...value,
    observationHash:
      hashCandidateInvocationEvidenceObservationV2(value),
  };
}

describe("candidate invocation evidence authority v2", () => {
  it("binds exact pre-release CLI and HTTP observations", () => {
    assert.equal(
      CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_HASH_V2,
      "f73b4d152c2a970d8da7de3a2ba22da59de0275c23a715294e6b605fed10fd31",
    );
    assert.equal(
      canonicalJsonBytes(
        CANDIDATE_INVOCATION_EVIDENCE_OBSERVATION_CONTRACT_V2,
      ).byteLength,
      1_262,
    );
    const cli = createCandidateInvocationEvidenceObservationV2(
      observationIdentity("cli_process"),
    );
    const http = createCandidateInvocationEvidenceObservationV2(
      observationIdentity("http_service"),
    );
    assert.equal(
      CandidateInvocationEvidenceObservationV2Schema.safeParse(cli)
        .success,
      true,
    );
    assert.equal(
      CandidateInvocationEvidenceObservationV2Schema.safeParse(http)
        .success,
      true,
    );
    assert.equal(
      parseCandidateInvocationEvidenceObservationV2(cli)
        .observationHash,
      cli.observationHash,
    );
    assert.equal(
      cli.observationHash,
      "e40578d367f7e478298e9a19208b8de1e12a606752212e6717999adc3f730ee0",
    );
    assert.equal(canonicalJsonBytes(cli).byteLength, 3_812);
    assert.deepEqual(
      cli.releaseBlockers,
      CANDIDATE_INVOCATION_EVIDENCE_RELEASE_BLOCKERS_V2,
    );
    assert.equal(
      JSON.stringify(cli).includes("executableTransportBindingHash"),
      false,
    );
    assert.equal(JSON.stringify(cli).includes("launchTargetHash"), false);
    assert.equal(JSON.stringify(cli).includes("expectedValue"), false);
    assert.equal(JSON.stringify(cli).includes("githubComment"), false);
  });

  it("rejects kind, source fence, check and evaluation drift after rehash", () => {
    const base = createCandidateInvocationEvidenceObservationV2(
      observationIdentity(),
    );
    const cases = [
      rehash({
        ...base,
        invocationKind: "http_service",
      }),
      rehash({
        ...base,
        launcherAuthority: {
          ...base.launcherAuthority,
          sourceFenceAfterHash: sha("drift"),
        },
      }),
      rehash({
        ...base,
        checkAuthority: {
          ...base.checkAuthority,
          checkRef: "CHECK_OBSERVABLE_OUTCOME",
        },
      }),
      rehash({
        ...base,
        transportAuthority: {
          ...base.transportAuthority,
          encodedRequestHash: sha("other-request"),
        },
      }),
      rehash({
        ...base,
        durationMs: 249,
      }),
    ];
    for (const candidate of cases) {
      assert.equal(
        CandidateInvocationEvidenceObservationV2Schema.safeParse(
          candidate,
        ).success,
        false,
      );
    }
  });

  it("rejects hostile, cyclic, extra-field and blocker-list input without invoking traps", () => {
    let accessorCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, "schema", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return "setfarm.candidate-invocation-evidence-observation.v2";
      },
    });
    assert.throws(
      () => parseCandidateInvocationEvidenceObservationV2(accessor),
    );
    assert.equal(accessorCalls, 0);

    let proxyCalls = 0;
    const proxy = new Proxy({}, {
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
    });
    assert.throws(
      () => parseCandidateInvocationEvidenceObservationV2(proxy),
    );
    assert.equal(proxyCalls, 0);

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    assert.throws(
      () => parseCandidateInvocationEvidenceObservationV2(cycle),
    );

    const base = createCandidateInvocationEvidenceObservationV2(
      observationIdentity(),
    );
    const extra: any = structuredClone(base);
    extra.callerExpectedValue = "forged";
    extra.observationHash =
      hashCandidateInvocationEvidenceObservationV2(extra);
    assert.equal(
      CandidateInvocationEvidenceObservationV2Schema.safeParse(extra)
        .success,
      false,
    );

    const reordered: any = structuredClone(base);
    reordered.releaseBlockers = [
      ...reordered.releaseBlockers,
    ].reverse();
    reordered.observationHash =
      hashCandidateInvocationEvidenceObservationV2(reordered);
    assert.equal(
      CandidateInvocationEvidenceObservationV2Schema.safeParse(
        reordered,
      ).success,
      false,
    );
  });

  it("does not expose constructor or structural-forgery authority", async () => {
    assert.throws(
      () => new CandidateInvocationEvidenceExecutionAuthorityV2(
        {},
        {} as never,
      ),
      (error: unknown) =>
        error instanceof CandidateInvocationEvidenceErrorV2
        && error.code
          === "CANDIDATE_INVOCATION_EVIDENCE_V2_AUTHORITY_UNAUTHENTICATED",
    );
    assert.throws(
      () => new CandidateInvocationEvidenceCaptureV2(
        {},
        sha("observation"),
        {} as never,
      ),
      (error: unknown) =>
        error instanceof CandidateInvocationEvidenceErrorV2
        && error.code
          === "CANDIDATE_INVOCATION_EVIDENCE_V2_AUTHORITY_UNAUTHENTICATED",
    );
    await assert.rejects(
      runCandidateInvocationEvidenceV2ForTest({
        authority: Object.create(
          CandidateInvocationEvidenceExecutionAuthorityV2.prototype,
        ),
      }),
      (error: unknown) =>
        error instanceof CandidateInvocationEvidenceErrorV2
        && error.code
          === "CANDIDATE_INVOCATION_EVIDENCE_V2_AUTHORITY_UNAUTHENTICATED",
    );
    assert.throws(
      () => copyCandidateInvocationEvidenceCaptureV2ForTest(
        Object.create(
          CandidateInvocationEvidenceCaptureV2.prototype,
        ),
      ),
      (error: unknown) =>
        error instanceof CandidateInvocationEvidenceErrorV2
        && error.code
          === "CANDIDATE_INVOCATION_EVIDENCE_V2_AUTHORITY_UNAUTHENTICATED",
    );
  });
});
