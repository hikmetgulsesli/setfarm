import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { ContentAddressedEvalResultStore } from "../../src/evals/report.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  createConvergenceResult,
  createConvergencePreflight,
} from "../../src/evals/result-schema.js";
import { createConvergenceResultV2 } from "../../src/evals/result-schema-v2.js";
import { loadConvergenceSuite } from "../../src/evals/suite-schema.js";
import {
  ProductConvergenceSuiteV2Schema,
  loadConvergenceSuiteV2,
  loadConvergenceSuiteVersioned,
} from "../../src/evals/suite-schema-v2.js";
import {
  TaskIntentOracleV2Schema,
  TaskIntentOracleEvaluationV2Schema,
  evaluateTaskIntentOracleV2,
  projectTaskIntentOracleV2ToV1,
} from "../../src/evals/task-intent-oracle-v2.js";
import { evaluateTaskIntentOracleV1 } from "../../src/evals/task-intent-oracle.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";

const TASK = "Build a polished experience but leave its users and workflow deliberately unspecified. Also require a native kernel driver that this product compiler does not support.";

function negativeFixture() {
  const ledger = extractTaskRequirementLedgerV1(TASK);
  const clauseIds = ["ambiguous-product", "unsupported-kernel"] as const;
  const oracle = TaskIntentOracleV2Schema.parse({
    schema: "setfarm.task-intent-oracle.v2",
    oracleId: "exact-negative-control",
    oracleVersion: 2,
    locale: "en",
    cohort: "negative",
    variant: "unsupported",
    expectedDecision: {
      kind: "typed_rejection",
      requiredReasonCodes: [
        "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
        "PRODUCT_SPEC_TASK_AMBIGUOUS",
      ],
      allowedReasonCodes: [
        "PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING",
        "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
        "PRODUCT_SPEC_TASK_AMBIGUOUS",
      ],
      reasonRequirements: [
        { reasonCode: "PRODUCT_SPEC_TASK_AMBIGUOUS", clauseRefs: [clauseIds[0]] },
        { reasonCode: "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED", clauseRefs: [clauseIds[1]] },
        { reasonCode: "PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING", clauseRefs: [clauseIds[0]] },
      ],
    },
    clauses: ledger.requirements.map((requirement, index) => ({
      clauseId: clauseIds[index],
      source: {
        startOffset: requirement.sources[0]!.span.startOffset,
        endOffset: requirement.sources[0]!.span.endOffset,
        normalizedClause: requirement.normalizedClause,
      },
      requiredSemanticKinds: [],
    })),
    expectations: [],
  });
  const reason = (
    code: "PRODUCT_SPEC_TASK_AMBIGUOUS"
      | "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED"
      | "PRODUCT_SPEC_REQUIREMENT_CONFLICT"
      | "PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING",
    requirementRefs: string[],
  ) => ({ code, requirementRefs, message: `${code} is bound to exact source requirements.` });
  const rejection = (reasons: ReturnType<typeof reason>[]) => ({
    schema: "setfarm.product-spec-rejection.v1" as const,
    sourceTaskHash: ledger.sourceHash,
    reasons,
  });
  const exactReasons = [
    reason("PRODUCT_SPEC_TASK_AMBIGUOUS", [ledger.requirements[0]!.id]),
    reason("PRODUCT_SPEC_SEMANTIC_UNSUPPORTED", [ledger.requirements[1]!.id]),
  ];
  return { ledger, oracle, reason, rejection, exactReasons };
}

function evaluateNegative(
  fixture: ReturnType<typeof negativeFixture>,
  reasons: ReturnType<ReturnType<typeof negativeFixture>["reason"]>[],
) {
  return evaluateTaskIntentOracleV2({
    task: TASK,
    oracle: fixture.oracle,
    actual: {
      kind: "typed_rejection",
      rejection: fixture.rejection(reasons),
      owner: "compiler",
      modelRedispatchBudget: 0,
    },
  });
}

const CHECK_IDS = [
  "release_identity",
  "release_cleanliness",
  "migration_attestation",
  "database_ownership",
  "setfarm_health",
  "mission_control_health",
  "execution_profile",
  "result_store",
] as const;

function passingPreflight() {
  return createConvergencePreflight({
    checks: CHECK_IDS.map((id, index) => ({
      id,
      status: "pass" as const,
      code: `EVAL_PREFLIGHT_${id.toUpperCase()}_PASS`,
      evidenceHash: String(index + 1).repeat(64).slice(0, 64),
    })),
  });
}

function preflightResult(version: 1 | 2) {
  const payload = {
    schema: `setfarm.product-convergence-result.v${version}`,
    suiteId: `product-convergence-v${version}`,
    suiteVersion: version,
    suiteHash: "a".repeat(64),
    releaseSha: "b".repeat(40),
    runnerHash: "c".repeat(64),
    environmentHash: "d".repeat(64),
    executionMode: "preflight",
    startedAt: "2026-07-16T10:00:00.000Z",
    finishedAt: "2026-07-16T10:00:01.000Z",
    plannedRuns: 8,
    status: "planned",
    preflight: passingPreflight(),
    runs: [],
    rootCauseCounts: [],
    stoppedOnRepeatedRootCause: null,
    blockerCodes: [],
  };
  return version === 1 ? createConvergenceResult(payload) : createConvergenceResultV2(payload);
}

describe("TaskIntentOracleV2 exact typed-negative contract", () => {
  it("accepts all required reason codes only when each reason owns its declared exact requirement refs", () => {
    const fixture = negativeFixture();
    const result = evaluateNegative(fixture, fixture.exactReasons);
    assert.equal(result.schema, "setfarm.task-intent-oracle-evaluation.v2");
    assert.equal(result.contractComplete, true);
    assert.equal(result.decisionEvidenceVerified, true);
    assert.deepEqual(result.mismatchCodes, []);
    assert.deepEqual(result.rejectionContract?.actualReasonCodes, [
      "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
      "PRODUCT_SPEC_TASK_AMBIGUOUS",
    ]);
  });

  it("rejects missing required codes and emit-all-codes output", () => {
    const fixture = negativeFixture();
    const missing = evaluateNegative(fixture, [fixture.exactReasons[0]!]);
    assert.ok(missing.mismatchCodes.includes("ORACLE_REJECTION_REQUIRED_CODE_MISSING"));

    const emitAll = evaluateNegative(fixture, [
      ...fixture.exactReasons,
      fixture.reason("PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING", [fixture.ledger.requirements[0]!.id]),
      fixture.reason("PRODUCT_SPEC_REQUIREMENT_CONFLICT", [fixture.ledger.requirements[0]!.id]),
    ]);
    assert.ok(emitAll.mismatchCodes.includes("ORACLE_REJECTION_CODE_NOT_ALLOWED"));
    assert.equal(emitAll.contractComplete, false);

    const { evaluationHash: _evaluationHash, ...tamperedPayload } = emitAll;
    const forgedPayload = {
      ...tamperedPayload,
      contractComplete: true,
      decisionEvidenceVerified: true,
      mismatchCodes: [],
    };
    assert.equal(TaskIntentOracleEvaluationV2Schema.safeParse({
      ...forgedPayload,
      evaluationHash: hashCanonicalJson(forgedPayload),
    }).success, false);
  });

  it("fails swapped per-reason ownership that the v1 union-coverage oracle accepts", () => {
    const fixture = negativeFixture();
    const swapped = [
      fixture.reason("PRODUCT_SPEC_TASK_AMBIGUOUS", [fixture.ledger.requirements[1]!.id]),
      fixture.reason("PRODUCT_SPEC_SEMANTIC_UNSUPPORTED", [fixture.ledger.requirements[0]!.id]),
    ];
    const legacy = evaluateTaskIntentOracleV1({
      task: TASK,
      oracle: projectTaskIntentOracleV2ToV1(fixture.oracle),
      actual: {
        kind: "typed_rejection",
        rejection: fixture.rejection(swapped),
        owner: "compiler",
        modelRedispatchBudget: 0,
      },
    });
    assert.deepEqual(legacy.mismatchCodes, []);

    const exact = evaluateNegative(fixture, swapped);
    assert.ok(exact.mismatchCodes.includes("ORACLE_REJECTION_REQUIREMENT_OWNERSHIP_MISMATCH"));
    assert.equal(exact.decisionEvidenceVerified, false);
  });

  it("forbids a non-selective oracle from allowing every rejection code", () => {
    const fixture = negativeFixture();
    const raw = structuredClone(fixture.oracle) as any;
    raw.expectedDecision.allowedReasonCodes.push("PRODUCT_SPEC_REQUIREMENT_CONFLICT");
    raw.expectedDecision.reasonRequirements.push({
      reasonCode: "PRODUCT_SPEC_REQUIREMENT_CONFLICT",
      clauseRefs: ["ambiguous-product"],
    });
    assert.equal(TaskIntentOracleV2Schema.safeParse(raw).success, false);
  });
});

describe("versioned convergence suite and result readers", () => {
  it("keeps v1 suite reading and separately reads a canonical v2 suite", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-eval-suite-v2-"));
    try {
      const liveSuiteFile = path.resolve("evals/suites/product-convergence-v1.json");
      const legacy = await loadConvergenceSuite(liveSuiteFile);
      assert.equal(legacy.suite.schema, "setfarm.product-convergence-suite.v1");

      const raw = JSON.parse(await readFile(liveSuiteFile, "utf8"));
      const suiteV2 = ProductConvergenceSuiteV2Schema.parse({
        ...raw,
        schema: "setfarm.product-convergence-suite.v2",
        suiteId: "product-convergence-v2",
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
      const compositional = suiteV2.cases.find((item) => item.oracle.variant === "compositional")!;
      assert.equal(compositional.oracle.locale, "en");
      assert.equal(TaskIntentOracleV2Schema.safeParse({
        ...compositional.oracle,
        variant: "multilingual",
      }).success, false);
      assert.equal(TaskIntentOracleV2Schema.safeParse({
        ...compositional.oracle,
        locale: "tr",
      }).success, false);
      const v2File = path.join(root, "suite-v2.json");
      await writeFile(v2File, `${JSON.stringify(suiteV2)}\n`, "utf8");

      assert.equal((await loadConvergenceSuiteV2(v2File)).suite.schema, "setfarm.product-convergence-suite.v2");
      assert.equal((await loadConvergenceSuiteVersioned(liveSuiteFile)).suite.schema, "setfarm.product-convergence-suite.v1");
      assert.equal((await loadConvergenceSuiteVersioned(v2File)).suite.schema, "setfarm.product-convergence-suite.v2");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("stores and dual-reads immutable v1 and v2 result artifacts without widening legacy getResult", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-eval-result-v2-"));
    try {
      const store = new ContentAddressedEvalResultStore(root);
      const legacy = preflightResult(1);
      const v2 = preflightResult(2);
      const legacyStored = await store.put(legacy);
      const v2Stored = await store.put(v2);

      assert.equal((await store.getResult(legacyStored.hash)).schema, "setfarm.product-convergence-result.v1");
      assert.equal((await store.getResultV2(v2Stored.hash)).schema, "setfarm.product-convergence-result.v2");
      assert.equal((await store.getVersionedResult(legacyStored.hash)).schema, "setfarm.product-convergence-result.v1");
      assert.equal((await store.getVersionedResult(v2Stored.hash)).schema, "setfarm.product-convergence-result.v2");
      await assert.rejects(store.getResult(v2Stored.hash));
      await assert.rejects(store.getResultV2(legacyStored.hash));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
