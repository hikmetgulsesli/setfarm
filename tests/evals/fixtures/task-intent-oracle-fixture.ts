import { createAcceptedCandidateV1 } from "../../../src/evidence/accepted-candidate-v1.js";
import { produceRuntimeEvidenceContractV1 } from "../../../src/evidence/runtime-evidence-contract-producer-v1.js";
import { hashRuntimeEvidenceContractV1 } from "../../../src/evidence/runtime-evidence-contract-v1.js";
import { TaskIntentOracleV1Schema } from "../../../src/evals/task-intent-oracle.js";
import { extractTaskRequirementLedgerV1 } from "../../../src/product-compiler/requirements/task-requirements-v1.js";
import { produceRuntimeDataContractV1 } from "../../../src/product-compiler/producers/runtime-data-contract.js";
import { produceDesignGenerationTargetsV1 } from "../../../src/product-compiler/producers/design-targets.js";
import {
  bindStitchTargetCandidateSelectionsV2,
  selectStitchTargetCandidatesV1,
} from "../../../src/product-compiler/producers/stitch-target-candidate-selection.js";
import { hashCanonicalJson } from "../../../src/product-compiler/canonical-json.js";
import { ProductSpecV3ProposalSchema } from "../../../src/product-compiler/schemas/product-spec-v1.js";
import { DesignInteractionGraphV1Schema } from "../../../src/product-compiler/schemas/design-interaction-graph-v1.js";
import { ImplementationSliceV1Schema } from "../../../src/product-compiler/schemas/implementation-slice-v1.js";
import { StoryPlanV1Schema } from "../../../src/product-compiler/schemas/story-plan-v1.js";
import { buildMinimalValidContracts } from "../../product-compiler/fixtures/minimal-valid-contract.js";
import {
  buildTestRenderedSemantics,
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "../../product-compiler/fixtures/stitch-artifacts.js";

export const TASK_INTENT_ORACLE_TASK = "Build a single-page task editor at / with a Save button that stores the entered title in domain state and local storage across reloads, then shows text Saved, value Task from state, keeps the button visible and enabled, and remains on /";

export function buildTaskIntentOracleFixture(
  runId = "oracle-eval-run",
) {
  const base = buildMinimalValidContracts();
  const ledger = extractTaskRequirementLedgerV1(TASK_INTENT_ORACLE_TASK);
  if (ledger.requirements.length !== 1) throw new Error("ORACLE_FIXTURE_REQUIREMENT_CARDINALITY_INVALID");
  const requirement = ledger.requirements[0]!;
  const action = {
    ...base.productSpec.actions[0]!,
    success: {
      ...base.productSpec.actions[0]!.success,
      evidenceRefs: ["EVID_SAVE_OBSERVABLE", "EVID_SAVE_RELOAD"],
    },
    evidenceRefs: ["EVID_SAVE_OBSERVABLE", "EVID_SAVE_RELOAD"],
    observableEffects: [{
      id: "OBS_SAVE_CONFIRMATION",
      selector: { kind: "control" as const, actionRef: "ACT_SAVE_TASK" },
      assertions: [
        { phase: "after" as const, property: "visible_text" as const, operator: "equals" as const, expected: "Saved" },
        { phase: "after" as const, property: "value" as const, operator: "equals" as const, expected: "Task from state" },
        { phase: "after" as const, property: "visibility" as const, operator: "equals" as const, expected: true },
        { phase: "after" as const, property: "enabled" as const, operator: "equals" as const, expected: true },
        { phase: "after" as const, property: "route" as const, operator: "equals" as const, expected: "/" },
        { phase: "reload" as const, property: "value" as const, operator: "equals" as const, expected: "Task from state" },
      ],
      evidenceRef: "EVID_SAVE_OBSERVABLE",
    }],
  };
  const productSpec = ProductSpecV3ProposalSchema.parse({
    ...base.productSpec,
    actions: [action],
    evidencePredicates: [
      {
        id: "EVID_SAVE_OBSERVABLE",
        kind: "observable_outcome",
        required: true,
        subjectRef: "OBS_SAVE_CONFIRMATION",
        capabilityRefs: ["CAP_BROWSER_INTERACTION"],
        assertion: { operator: "passes" },
      },
      ...base.productSpec.evidencePredicates,
    ],
    delivery: {
      platform: "web",
      techStack: "vite-react",
      uiLanguage: "English",
      database: "none",
      designRequired: true,
      uiVisionSummary: "A focused single-page task editor with one explicit save control.",
    },
    requirements: [{
      ...requirement,
      classification: "functional",
      expectedSemanticKinds: [
        "goal", "non_goal", "entity", "state", "persistence", "route", "surface", "action", "evidence", "observable",
      ],
    }],
    traceability: {
      schema: "setfarm.product-requirement-traceability.v1",
      sourceTaskHash: ledger.sourceHash,
      bindings: [
        ...base.productSpec.product.goals.map((item) => ({ semanticKind: "goal" as const, semanticRef: item.id, requirementRefs: [requirement.id] })),
        ...base.productSpec.product.nonGoals.map((item) => ({ semanticKind: "non_goal" as const, semanticRef: item.id, requirementRefs: [requirement.id] })),
        ...base.productSpec.entities.map((item) => ({ semanticKind: "entity" as const, semanticRef: item.id, requirementRefs: [requirement.id] })),
        ...base.productSpec.states.map((item) => ({ semanticKind: "state" as const, semanticRef: item.id, requirementRefs: [requirement.id] })),
        ...base.productSpec.persistencePolicies.map((item) => ({ semanticKind: "persistence" as const, semanticRef: item.id, requirementRefs: [requirement.id] })),
        ...base.productSpec.routes.map((item) => ({ semanticKind: "route" as const, semanticRef: item.id, requirementRefs: [requirement.id] })),
        ...base.productSpec.surfaces.map((item) => ({ semanticKind: "surface" as const, semanticRef: item.id, requirementRefs: [requirement.id] })),
        { semanticKind: "action" as const, semanticRef: action.id, requirementRefs: [requirement.id] },
        { semanticKind: "evidence" as const, semanticRef: "EVID_SAVE_OBSERVABLE", requirementRefs: [requirement.id] },
        ...base.productSpec.evidencePredicates.map((item) => ({ semanticKind: "evidence" as const, semanticRef: item.id, requirementRefs: [requirement.id] })),
        { semanticKind: "observable" as const, semanticRef: action.observableEffects[0]!.id, requirementRefs: [requirement.id] },
      ],
    },
  });
  const designGraphBase = DesignInteractionGraphV1Schema.parse({
    ...base.designGraph,
    bindings: base.designGraph.bindings.map((binding) => ({
      ...binding,
      evidenceRefs: ["EVID_SAVE_OBSERVABLE", "EVID_SAVE_RELOAD"],
    })),
    observableBindings: [{
      observableRef: "OBS_SAVE_CONFIRMATION",
      actionRef: "ACT_SAVE_TASK",
      evidenceRef: "EVID_SAVE_OBSERVABLE",
      target: { kind: "control", controlRef: "CTRL_SAVE_TASK" },
    }],
  });
  const targetsResult = produceDesignGenerationTargetsV1(productSpec);
  if (targetsResult.status !== "produced") {
    throw new Error(`ORACLE_FIXTURE_GENERATION_TARGETS_REJECTED:${JSON.stringify(targetsResult.diagnostics)}`);
  }
  const target = targetsResult.generationTargets.targets[0]!;
  const html = validStitchHtml([
    `<main data-surface-id="${target.surfaceRef}">`,
    ...target.requiredActionRefs.map((actionRef) => `<button data-action="${actionRef}">${actionRef}</button>`),
    ...target.requiredActionInputs.flatMap((input) => input.inputFields.map((field) =>
      `<input data-action-input="${input.actionRef}.${field}" />`)),
    "</main>",
  ].join(""), "task-intent-oracle");
  const screenshot = validStitchPng(29);
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2" as const,
    projectId: "task-intent-oracle",
    batches: [{
      stageId: "stage-task-intent-oracle",
      targetRefs: [target.targetId],
      source: "direct" as const,
      candidates: [{
        screenId: "screen-task-intent-oracle",
        title: target.expectedScreenTitle,
        responsePaths: ["$result.screens[0]"],
        htmlAvailable: true,
        screenshotAvailable: true,
        ...stitchDownloadReceipts("screen-task-intent-oracle", html, screenshot),
        identityConflicts: [],
        disposition: "admitted_renderable_screen" as const,
        missingEvidence: [],
      }],
    }],
  };
  const artifacts = [{
    screenId: "screen-task-intent-oracle",
    htmlBytes: html,
    screenshotBytes: screenshot,
  }];
  const renderedSemantics = buildTestRenderedSemantics({
    generationTargets: targetsResult.generationTargets,
    directResponseEvidence,
    artifacts,
  });
  const selection = selectStitchTargetCandidatesV1({
    generationTargets: targetsResult.generationTargets,
    directResponseEvidence,
    renderedSemantics,
    artifacts,
    authorityMode: "clean_v3",
  });
  if (selection.status !== "produced") {
    throw new Error(`ORACLE_FIXTURE_CANDIDATE_SELECTION_REJECTED:${JSON.stringify(selection.diagnostics)}`);
  }
  const bindings = bindStitchTargetCandidateSelectionsV2({
    generationTargets: targetsResult.generationTargets,
    candidateSelection: selection.candidateSelection,
  });
  if (bindings.status !== "produced") {
    throw new Error(`ORACLE_FIXTURE_RESPONSE_BINDINGS_REJECTED:${JSON.stringify(bindings.diagnostics)}`);
  }
  const designSource = {
    kind: "stitch" as const,
    generationTargets: targetsResult.generationTargets,
    directResponseEvidence,
    renderedSemantics,
    candidateSelection: selection.candidateSelection,
    responseBindings: bindings.responseBindings,
  };
  const designGraph = DesignInteractionGraphV1Schema.parse({
    ...designGraphBase,
    rawArtifactHashes: [...new Set([
      ...designGraphBase.rawArtifactHashes,
      hashCanonicalJson(designSource.generationTargets),
      hashCanonicalJson(designSource.directResponseEvidence),
      hashCanonicalJson(designSource.renderedSemantics),
      hashCanonicalJson(designSource.candidateSelection),
      hashCanonicalJson(designSource.responseBindings),
    ])].sort(),
  });
  const storyPlan = StoryPlanV1Schema.parse({
    ...base.storyPlan,
    stories: base.storyPlan.stories.map((story) => ({
      ...story,
      evidenceRefs: ["EVID_SAVE_OBSERVABLE", "EVID_SAVE_RELOAD"],
    })),
  });
  const runtimeData = produceRuntimeDataContractV1({
    productSpec,
    commands: base.buildTopology.commands,
  });
  if (runtimeData.status !== "produced") {
    throw new Error(`ORACLE_FIXTURE_RUNTIME_DATA_REJECTED:${JSON.stringify(runtimeData.diagnostics)}`);
  }
  const topologyWithRuntimeData = {
    ...base.buildTopology,
    runtimeDataContract: runtimeData.contract,
    runtimeDataContractHash: runtimeData.contractHash,
  };
  const runtimeEvidence = produceRuntimeEvidenceContractV1({
    productSpec,
    buildTopology: topologyWithRuntimeData,
  });
  if (runtimeEvidence.status !== "produced") {
    throw new Error(`ORACLE_FIXTURE_RUNTIME_EVIDENCE_REJECTED:${JSON.stringify(runtimeEvidence)}`);
  }
  const runtimeEvidenceContractHash = hashRuntimeEvidenceContractV1(runtimeEvidence.contract);
  const buildTopology = {
    ...topologyWithRuntimeData,
    runtimeEvidenceContract: runtimeEvidence.contract,
    runtimeEvidenceContractHash,
  };
  const implementationSlice = ImplementationSliceV1Schema.parse({
    ...base.implementationSlice,
    story: storyPlan.stories[0],
    contract: {
      routes: productSpec.routes,
      surfaces: productSpec.surfaces,
      controls: designGraph.controls,
      bindings: designGraph.bindings,
      observableBindings: designGraph.observableBindings,
      actions: productSpec.actions,
      states: productSpec.states,
      persistencePolicies: productSpec.persistencePolicies,
      evidencePredicates: productSpec.evidencePredicates,
    },
    requiredEvidence: productSpec.evidencePredicates.filter((predicate) => predicate.required),
    runtimeDataContract: runtimeData.contract,
    runtimeDataContractHash: runtimeData.contractHash,
    runtimeEvidence: runtimeEvidence.contract,
  });
  const oracle = TaskIntentOracleV1Schema.parse({
    schema: "setfarm.task-intent-oracle.v1",
    oracleId: "task-editor-contract",
    oracleVersion: 1,
    locale: "en",
    cohort: "baseline",
    variant: "direct",
    expectedDecision: {
      kind: "accepted_candidate",
      productClass: "utility",
      delivery: { platform: "web", techStack: "vite-react" },
      stackPackId: "vite-react-web-app",
      runtimeAdapter: "browser",
    },
    clauses: [{
      clauseId: "task-editor",
      source: {
        startOffset: 0,
        endOffset: TASK_INTENT_ORACLE_TASK.length,
        normalizedClause: TASK_INTENT_ORACLE_TASK,
      },
      requiredSemanticKinds: ["entity", "state", "persistence", "route", "surface", "action", "observable"],
    }],
    expectations: [
      { intentId: "task-entity", kind: "entity", clauseRefs: ["task-editor"], minimumFields: 1 },
      { intentId: "editor-state", kind: "state", clauseRefs: ["task-editor"], stateKind: "domain" },
      { intentId: "reload-storage", kind: "persistence", clauseRefs: ["task-editor"], policyKind: "local_storage", durability: "reload" },
      { intentId: "home-route", kind: "route", clauseRefs: ["task-editor"], path: "/" },
      { intentId: "editor-surface", kind: "surface", clauseRefs: ["task-editor"], surfaceKind: "page", routePath: "/" },
      {
        intentId: "save-action",
        kind: "action",
        clauseRefs: ["task-editor"],
        triggerKind: "user",
        surfaceKinds: ["page"],
        stateEffects: [{ operation: "set", stateKind: "domain" }],
        persistenceEffects: [{ operation: "write", policyKind: "local_storage", durability: "reload" }],
        navigation: { kind: "stay" },
        control: { kinds: ["button"], label: { operator: "equals", expected: "Save" } },
        observableAssertions: action.observableEffects[0]!.assertions,
      },
    ],
  });
  const candidate = createAcceptedCandidateV1({
    runId,
    packetHash: "1".repeat(64),
    storyPlanHash: "2".repeat(64),
    sourceRevision: { sha: "3".repeat(40), treeHash: "4".repeat(40) },
    storyEvidence: [{
      storyId: "US-001",
      attemptId: "ATT_00000000-0000-0000-0000-000000000001",
      sliceHash: "5".repeat(64),
      evidencePlanHash: "6".repeat(64),
      evidencePlanArtifactHash: "7".repeat(64),
      evidenceBundleHash: "8".repeat(64),
      evidenceId: `EVB_${"9".repeat(64)}`,
      predicateRefs: ["EVID_SAVE_OBSERVABLE", "EVID_SAVE_RELOAD"],
    }],
    acceptor: {
      id: "setfarm-final-tree-acceptor",
      version: "1.0.0",
      codeSha: "a".repeat(40),
      environmentHash: "b".repeat(64),
    },
  });
  return {
    task: TASK_INTENT_ORACLE_TASK,
    oracle,
    contracts: {
      ...base,
      productSpec,
      designGraph,
      buildTopology,
      storyPlan,
      designSource,
      packet: {
        ...base.packet,
        runtimeDataContractHash: runtimeData.contractHash,
        runtimeEvidenceContractHash,
      },
      implementationSlice,
    },
    productSpec,
    designGraph,
    candidate,
  };
}
