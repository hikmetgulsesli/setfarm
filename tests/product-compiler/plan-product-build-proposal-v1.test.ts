import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PlanProductBuildVerificationErrorV1,
  compilePlanProductBuildProposalV1,
  verifyPlanProductBuildAuthorityV1,
} from "../../src/product-compiler/producers/plan-product-build-proposal-v1.js";
import {
  evaluateProductRuntimeBehaviorContractV1,
} from "../../src/product-compiler/product-runtime-behavior-contract-v1.js";
import {
  PlanProductBuildAuthorityV1Schema,
  hashPlanProductBuildAuthorityV1,
  hashPlanProductBuildReferenceMapV1,
  type PlanProductBuildProposalV1,
} from "../../src/product-compiler/schemas/plan-product-build-proposal-v1.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";

function structuredEnvelope(): PlanProductBuildProposalV1 {
  return {
    schema: "setfarm.plan-product-build-proposal.v1",
    semantics: containedGamePlanProposalV2(),
    runtimeBehavior: {
      schema: "setfarm.plan-runtime-behavior-proposal.v1",
      invariantBindings: [{
        stateKey: "game_phase",
        invariantOrdinal: 0,
        disposition: {
          kind: "structured_semantic_coverage",
          coverageRefs: [{
            kind: "action_delta",
            actionKey: "start_game",
            stateDeltaKey: "start_phase",
          }],
        },
      }],
      entityFieldBindings: [],
    },
  };
}

function assertionEnvelope(): PlanProductBuildProposalV1 {
  const envelope = structuredClone(structuredEnvelope());
  envelope.runtimeBehavior.invariantBindings[0]!.disposition = {
    kind: "runtime_assertions",
    assertions: [{
      subject: { kind: "state_path", path: "/phase" },
      predicate: { operator: "one_of", expected: ["playing", "ready"] },
    }],
  };
  return envelope;
}

function entityEnvelope(): PlanProductBuildProposalV1 {
  const envelope: any = structuredClone(structuredEnvelope());
  const requirementRefs = envelope.semantics.states[0].requirementRefs;
  envelope.semantics.entities.push({
    key: "phase_value",
    name: "Phase Value",
    fields: [{
      key: "value",
      name: "value",
      valueType: "string",
      required: true,
    }],
    requirementRefs,
  });
  envelope.semantics.states.push({
    key: "phase_source",
    name: "Phase Source",
    kind: "domain",
    initialValue: { value: "playing" },
    invariants: [],
    requirementRefs,
  });
  envelope.semantics.actions[0].preconditions.push({
    stateKey: "phase_source",
    path: "",
    operator: "exists",
  });
  envelope.semantics.actions[0].stateDeltas[0].valueFrom = {
    kind: "entity_field",
    entityKey: "phase_value",
    fieldKey: "value",
  };
  envelope.runtimeBehavior.entityFieldBindings = [{
    actionKey: "start_game",
    stateDeltaKey: "start_phase",
    snapshot: {
      stateKey: "phase_source",
      collectionPath: "",
      selection: { kind: "singleton" },
    },
  }];
  return envelope;
}

function compileOrThrow(proposal: PlanProductBuildProposalV1) {
  const result = compilePlanProductBuildProposalV1({
    task: CONTAINED_GAME_TASK,
    proposal,
  });
  assert.equal(
    result.status,
    "shadow_compiled",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_compiled") throw new Error("Expected product-build authority");
  return result;
}

function assertRecursivelyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertRecursivelyFrozen(child);
}

describe("PlanProductBuildProposalV1", () => {
  it("atomically compiles semantic and behavior authority through one local-key map", () => {
    const envelope = structuredEnvelope();
    const result = compileOrThrow(envelope);
    assert.equal(PlanProductBuildAuthorityV1Schema.safeParse(result.authority).success, true);
    assert.equal(result.authority.readiness.productionConsumption, "forbidden");
    assert.equal(result.authority.source.semanticProposalHash, result.semanticProposalHash);
    assert.deepEqual(result.authority.source, {
      sourceTaskHash: "44bcb94306d41edb2f9034c11fa601b3b5b176eff24bd3ac484f390b0dc53912",
      envelopeHash: "9784007ad451839f2565d6779ac06e48cb540acd4029de3851ab591f0dafdbde",
      semanticProposalHash: "c0e683eac3b4429deb473461fce61ddb676bb5d6dab44737bd719ddbdfa9d236",
    });
    assert.deepEqual(result.authority.outputs, {
      productSpecHash: "6fe621966b0d44c90e499f30a3c30e0e724c9a1589cb170da30ef49bc2510ace",
      deliverySelectionHash: "ae3158ea63fa143554617dd3049450ea4ab984398518f38603b5950a24f10289",
      runtimeBehaviorProposalHash: "18a48142bedbe8685903679e8c7ee72d4603a6aef46ccc9c90d9b4c045a95a60",
      runtimeBehaviorContractHash: "a17cee4be7f4d021b6c189173a5e4e9910481049438c0860771520b979ac2f0b",
      referenceMapHash: "f32f95e950deba41dfe0aeccc9d665a64d8e3bbf6153858f42bb34fd4f165a04",
    });
    assert.equal(
      result.authority.authorityHash,
      "bfc556ceb445ec936f59755292ba9a05674af7393ca82093ccd377661708eab4",
    );
    assert.equal(
      result.authority.outputs.runtimeBehaviorContractHash,
      result.runtimeBehaviorContract.contractHash,
    );
    assert.deepEqual(result.referenceMap.states, [{
      stateKey: "game_phase",
      stateRef: "STATE_GAME_PHASE",
      invariantCount: 1,
    }]);
    assert.equal(result.referenceMap.actions[0]?.actionRef, "ACT_START_GAME");
    assert.deepEqual(result.referenceMap.actions[0]?.stateDeltas, [{
      stateDeltaKey: "start_phase",
      deltaOrdinal: 0,
    }]);
    assert.deepEqual(
      result.runtimeBehaviorContract.invariantBindings[0]?.disposition,
      {
        kind: "structured_semantic_coverage",
        coverageRefs: [{
          kind: "action_delta",
          actionRef: "ACT_START_GAME",
          deltaOrdinal: 0,
        }],
      },
    );
    assert.doesNotMatch(
      JSON.stringify(envelope.runtimeBehavior),
      /(?:STATE|ACT|EVID|OBS|FIELD|PERSIST)_/u,
    );
    assertRecursivelyFrozen(result);

    const replay = compileOrThrow(structuredClone(envelope));
    assert.equal(replay.canonicalAuthorityBytes, result.canonicalAuthorityBytes);
    assert.equal(replay.runtimeBehaviorContract.contractHash, result.runtimeBehaviorContract.contractHash);
  });

  it("maps local assertions into the code-owned evaluator without prose input", () => {
    const result = compileOrThrow(assertionEnvelope());
    const passing = evaluateProductRuntimeBehaviorContractV1({
      productSpec: result.productSpec,
      proposal: result.runtimeBehaviorProposal,
      candidate: result.runtimeBehaviorContract,
      checkpoint: "after_action",
      actionRef: "ACT_START_GAME",
      stateSnapshot: { STATE_GAME_PHASE: { phase: "playing" } },
    });
    assert.equal(passing.status, "passed");

    const failing = evaluateProductRuntimeBehaviorContractV1({
      productSpec: result.productSpec,
      proposal: result.runtimeBehaviorProposal,
      candidate: result.runtimeBehaviorContract,
      checkpoint: "after_action",
      actionRef: "ACT_START_GAME",
      stateSnapshot: { STATE_GAME_PHASE: { phase: "stopped" } },
    });
    assert.equal(failing.status, "failed");
    if (failing.status === "failed") assert.equal(failing.failedAssertionCount, 1);
  });

  it("derives entity-field instance authority from local semantic keys", () => {
    const result = compileOrThrow(entityEnvelope());
    assert.equal(result.authority.coverage.entityCount, 1);
    assert.equal(result.authority.coverage.entityFieldCount, 1);
    assert.equal(result.authority.coverage.stateCount, 2);
    assert.deepEqual(result.referenceMap.entities, [{
      entityKey: "phase_value",
      entityRef: "ENTITY_PHASE_VALUE",
      fields: [{ fieldKey: "value", fieldRef: "FIELD_PHASE_VALUE_VALUE" }],
    }]);
    assert.equal(result.runtimeBehaviorContract.entityFieldBindings.length, 1);
    assert.deepEqual(result.runtimeBehaviorContract.entityFieldBindings[0]?.snapshot, {
      stateRef: "STATE_PHASE_SOURCE",
      collectionPath: "",
      selection: { kind: "singleton" },
    });
  });

  it("binds local persistence intent ordinals to exact effects and required evidence", () => {
    const envelope: any = structuredClone(structuredEnvelope());
    const requirementRefs = envelope.semantics.actions[0].requirementRefs;
    envelope.semantics.persistencePolicies.push({
      key: "game_phase_local",
      kind: "local_storage",
      entityKeys: [],
      rehydration: { kind: "initialization" },
      requirementRefs,
    });
    envelope.semantics.actions[0].persistenceIntents.push({
      policyKey: "game_phase_local",
      operation: "write",
      stateDeltaKeys: ["start_phase"],
    });
    envelope.semantics.actions[0].observables[0].assertions.push({
      phase: "reload",
      property: "visibility",
      operator: "equals",
      expected: true,
    });
    envelope.runtimeBehavior.invariantBindings[0].disposition = {
      kind: "structured_semantic_coverage",
      coverageRefs: [{
        kind: "persistence_effect",
        actionKey: "start_game",
        persistenceIntentOrdinal: 0,
      }],
    };

    const result = compileOrThrow(envelope);
    assert.equal(result.authority.coverage.persistenceEffectCount, 1);
    assert.deepEqual(result.referenceMap.actions[0]?.persistenceEffects, [{
      persistenceIntentOrdinal: 0,
      policyKey: "game_phase_local",
      policyRef: "PERSIST_GAME_PHASE_LOCAL",
      evidenceRef: result.referenceMap.actions[0]!.persistenceEffects[0]!.evidenceRef,
    }]);
    assert.match(
      result.referenceMap.actions[0]!.persistenceEffects[0]!.evidenceRef,
      /^EVID_PERSISTENCE_ROUND_TRIP_/u,
    );
    assert.deepEqual(
      result.runtimeBehaviorContract.invariantBindings[0]?.disposition,
      {
        kind: "structured_semantic_coverage",
        coverageRefs: [{
          kind: "persistence_effect",
          actionRef: "ACT_START_GAME",
          effectOrdinal: 0,
        }],
      },
    );
  });

  it("maps non-runtime evidence but preserves functional anti-laundering", () => {
    const functional: any = structuredClone(structuredEnvelope());
    functional.runtimeBehavior.invariantBindings[0].disposition = {
      kind: "non_runtime_requirement",
      evidenceRefs: [{
        kind: "observable_outcome",
        actionKey: "start_game",
        observableKey: "status_text",
      }],
    };
    const rejected = compilePlanProductBuildProposalV1({
      task: CONTAINED_GAME_TASK,
      proposal: functional,
    });
    assert.equal(rejected.status, "rejected");
    if (rejected.status === "rejected") {
      assert.equal(rejected.diagnostics.some((item) =>
        item.message.includes("cannot use non-runtime disposition")), true);
    }

    const constraint = structuredClone(functional);
    constraint.semantics.requirements.forEach((requirement: any) => {
      requirement.classification = "constraint";
    });
    const accepted = compileOrThrow(constraint);
    assert.equal(
      accepted.runtimeBehaviorContract.coverage.nonRuntimeRequirementCount,
      1,
    );
  });

  it("rejects partial, duplicate, global-ID and unresolved local behavior", () => {
    const missing = structuredClone(structuredEnvelope());
    missing.runtimeBehavior.invariantBindings = [];
    const missingResult = compilePlanProductBuildProposalV1({
      task: CONTAINED_GAME_TASK,
      proposal: missing,
    });
    assert.equal(missingResult.status, "rejected");
    if (missingResult.status === "rejected") {
      assert.equal(missingResult.diagnostics.some((item) =>
        item.message.includes("Missing exact ProductSpec invariant binding")), true);
    }

    const duplicate: any = structuredClone(structuredEnvelope());
    duplicate.runtimeBehavior.invariantBindings.push(
      structuredClone(duplicate.runtimeBehavior.invariantBindings[0]),
    );
    assert.equal(compilePlanProductBuildProposalV1({
      task: CONTAINED_GAME_TASK,
      proposal: duplicate,
    }).status, "rejected");

    const global: any = structuredClone(structuredEnvelope());
    global.runtimeBehavior.invariantBindings[0].stateKey = "STATE_GAME_PHASE";
    assert.equal(compilePlanProductBuildProposalV1({
      task: CONTAINED_GAME_TASK,
      proposal: global,
    }).status, "rejected");

    const unresolved: any = structuredClone(structuredEnvelope());
    unresolved.runtimeBehavior.invariantBindings[0]
      .disposition.coverageRefs[0].stateDeltaKey = "missing_delta";
    const unresolvedResult = compilePlanProductBuildProposalV1({
      task: CONTAINED_GAME_TASK,
      proposal: unresolved,
    });
    assert.equal(unresolvedResult.status, "rejected");
    if (unresolvedResult.status === "rejected") {
      assert.equal(unresolvedResult.diagnostics[0]?.code,
        "PLAN_PRODUCT_BUILD_V1_RUNTIME_REFERENCE_UNRESOLVED");
    }
  });

  it("fresh-verifies exact source authority and rejects self-rehash or cross-envelope reuse", () => {
    const firstEnvelope = structuredEnvelope();
    const first = compileOrThrow(firstEnvelope);
    const verified = verifyPlanProductBuildAuthorityV1({
      task: CONTAINED_GAME_TASK,
      proposal: firstEnvelope,
      candidate: first.authority,
    });
    assert.equal(verified.authorityHash, first.authority.authorityHash);
    assertRecursivelyFrozen(verified);

    const selfRehashed = structuredClone(first.authority) as any;
    selfRehashed.source.envelopeHash = "f".repeat(64);
    selfRehashed.authorityHash = hashPlanProductBuildAuthorityV1(selfRehashed);
    assert.equal(PlanProductBuildAuthorityV1Schema.safeParse(selfRehashed).success, true);
    assert.throws(
      () => verifyPlanProductBuildAuthorityV1({
        task: CONTAINED_GAME_TASK,
        proposal: firstEnvelope,
        candidate: selfRehashed,
      }),
      (error: unknown) =>
        error instanceof PlanProductBuildVerificationErrorV1
        && error.code === "PLAN_PRODUCT_BUILD_V1_VERIFICATION_AUTHORITY_MISMATCH",
    );

    const otherEnvelope = assertionEnvelope();
    assert.equal(compileOrThrow(otherEnvelope).status, "shadow_compiled");
    assert.throws(
      () => verifyPlanProductBuildAuthorityV1({
        task: CONTAINED_GAME_TASK,
        proposal: otherEnvelope,
        candidate: first.authority,
      }),
      /differs from fresh task and proposal authority/u,
    );
  });

  it("keeps canonical map ordering structural rather than self-rehashable", () => {
    const result = compileOrThrow(structuredEnvelope());
    const reordered = structuredClone(result.authority) as any;
    reordered.referenceMap.actions[0].observables.reverse();
    reordered.outputs.referenceMapHash = hashPlanProductBuildReferenceMapV1(
      reordered.referenceMap,
    );
    reordered.authorityHash = hashPlanProductBuildAuthorityV1(reordered);
    assert.equal(PlanProductBuildAuthorityV1Schema.safeParse(reordered).success, false);
  });

  it("bounds strict and hostile input without invoking caller authority", () => {
    const extra: any = structuredClone(structuredEnvelope());
    extra.retryHint = "accept me";
    assert.equal(compilePlanProductBuildProposalV1({
      task: CONTAINED_GAME_TASK,
      proposal: extra,
    }).status, "rejected");

    let trapCount = 0;
    const proxy = new Proxy(structuredEnvelope(), {
      get() {
        trapCount += 1;
        throw new Error("must not execute");
      },
    });
    assert.equal(compilePlanProductBuildProposalV1({
      task: CONTAINED_GAME_TASK,
      proposal: proxy,
    }).status, "rejected");
    assert.equal(trapCount, 0);

    const cyclic: any = structuredEnvelope();
    cyclic.loop = cyclic;
    assert.equal(compilePlanProductBuildProposalV1({
      task: CONTAINED_GAME_TASK,
      proposal: cyclic,
    }).status, "rejected");

    const oversized: any = assertionEnvelope();
    oversized.runtimeBehavior.invariantBindings[0]
      .disposition.assertions[0].predicate = {
        operator: "equals",
        expected: "x".repeat((8 * 1024 * 1024) + 1),
      };
    assert.equal(compilePlanProductBuildProposalV1({
      task: CONTAINED_GAME_TASK,
      proposal: oversized,
    }).status, "rejected");
  });
});
