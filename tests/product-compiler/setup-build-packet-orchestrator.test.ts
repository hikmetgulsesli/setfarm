import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import { createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { bootstrapArtifactIndex } from "../../src/product-compiler/indexed-artifact-publisher.js";
import {
  assembleSetupBuildPacketContracts,
  orchestrateSetupBuildProductPacket,
  SetupBuildPacketError,
} from "../../src/product-compiler/setup-build-packet-orchestrator.js";
import {
  produceDesignGenerationTargetsV1,
} from "../../src/product-compiler/producers/design-targets.js";
import {
  bindStitchTargetCandidateSelectionsV2,
  selectStitchTargetCandidatesV1,
} from "../../src/product-compiler/producers/stitch-target-candidate-selection.js";
import { produceProductSpecV1 } from "../../src/product-compiler/producers/product-spec.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
import { renderLegacyPrd } from "../../src/product-compiler/renderers/legacy-prd.js";
import { resolveProductDeliverySelectionV1 } from "../../src/product-compiler/product-delivery-profile-catalog.js";
import {
  createIsolatedTestDatabase,
  type TestDatabase,
} from "../execution-attempts/test-database.js";
import {
  buildTestRenderedSemantics,
  stitchDownloadReceipts,
  validStitchHtml,
  validStitchPng,
} from "./fixtures/stitch-artifacts.js";

const TASK = [
  "Build a compact single-page status utility called Pulse Tile.",
  "It has a refresh button and a ready/paused toggle.",
  "Keep status in localStorage.",
  "Do not add navigation or analytics.",
].join(" ");

type Fixture = Readonly<{
  runId: string;
  repo: string;
  planText: string;
  generatedFiles: string[];
}>;

function writeJson(file: string, value: unknown, canonical = false): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    canonical ? canonicalJsonStringify(value) : `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function git(repo: string, args: string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

function addV3PlanContract(productSpec: any, productClass: "utility" | "game" = "utility"): void {
  const ledger = extractTaskRequirementLedgerV1(TASK);
  productSpec.actions.forEach((action: any) => {
    const token = action.id.replace(/^ACT_/, "");
    const evidenceRef = `EVID_OBSERVABLE_${token}`;
    const observableRef = `OBS_${token}`;
    const durable = action.persistenceEffects.some((effect: any) => {
      const policy = productSpec.persistencePolicies.find((candidate: any) => candidate.id === effect.policyRef);
      return effect.operation !== "read" && policy && ["reload", "restart", "durable"].includes(policy.durability);
    });
    action.observableEffects = [{
      id: observableRef,
      selector: { kind: "control", actionRef: action.id },
      assertions: [
        { phase: "after", property: "enabled", operator: "equals", expected: true },
        ...(durable ? [{ phase: "reload", property: "enabled", operator: "equals", expected: true }] : []),
      ],
      evidenceRef,
    }];
    action.evidenceRefs.push(evidenceRef);
    action.success.evidenceRefs.push(evidenceRef);
    productSpec.evidencePredicates.push({
      id: evidenceRef,
      kind: "observable_outcome",
      required: true,
      subjectRef: observableRef,
      capabilityRefs: ["CAP_BROWSER_INTERACTION"],
      assertion: { operator: "passes" },
    });
  });
  productSpec.product.class = productClass;
  productSpec.delivery = {
    platform: productClass === "game" ? "game" : "web",
    techStack: productClass === "game" ? "browser-game" : "vite-react",
    uiLanguage: "English",
    database: "none",
    designRequired: true,
    uiVisionSummary: "A compact status utility exposes only the requested controls and visible state changes.",
  };
  productSpec.requirements = ledger.requirements.map((requirement) => ({
    ...requirement,
    classification: "functional",
    expectedSemanticKinds: ["action"],
  }));
  const requirementRefs = ledger.requirements.map((requirement) => requirement.id);
  const semantics = [
    ...productSpec.product.goals.map((entry: any) => ["goal", entry.id]),
    ...productSpec.product.nonGoals.map((entry: any) => ["non_goal", entry.id]),
    ...productSpec.entities.map((entry: any) => ["entity", entry.id]),
    ...productSpec.states.map((entry: any) => ["state", entry.id]),
    ...productSpec.persistencePolicies.map((entry: any) => ["persistence", entry.id]),
    ...productSpec.routes.map((entry: any) => ["route", entry.id]),
    ...productSpec.surfaces.map((entry: any) => ["surface", entry.id]),
    ...productSpec.actions.map((entry: any) => ["action", entry.id]),
    ...productSpec.evidencePredicates.map((entry: any) => ["evidence", entry.id]),
    ...productSpec.actions.flatMap((action: any) => action.observableEffects.map((entry: any) => ["observable", entry.id])),
  ];
  productSpec.traceability = {
    schema: "setfarm.product-requirement-traceability.v1",
    sourceTaskHash: ledger.sourceHash,
    bindings: semantics.map(([semanticKind, semanticRef]) => ({ semanticKind, semanticRef, requirementRefs })),
  };
}

function createFixture(
  runId = "run-packet-fixture",
  v3 = false,
  productClass: "utility" | "game" = "utility",
): Fixture {
  const repo = fs.mkdtempSync(path.join(tmpdir(), "setfarm-setup-packet-"));
  const product = produceProductSpecV1({ task: TASK });
  assert.equal(product.status, "produced", JSON.stringify(product.diagnostics));
  if (v3) addV3PlanContract(product.productSpec, productClass);
  const platform = productClass === "game" ? "game" : "web";
  const techStack = productClass === "game" ? "browser-game" : "vite-react";
  const stackPackId = productClass === "game" ? "browser-game-canvas" : "vite-react-web-app";
  const targets = produceDesignGenerationTargetsV1(product.productSpec);
  assert.equal(targets.status, "produced", JSON.stringify(targets.diagnostics));
  const batches = targets.generationTargets.targets.map((target, index) => ({
    stageId: `stage-${index + 1}`,
    targetRefs: [target.targetId],
    screens: [{ screenId: `screen-${index + 1}`, title: target.expectedScreenTitle }],
  }));
  const candidateArtifacts = targets.generationTargets.targets.map((target, index) => {
    const screenId = `screen-${index + 1}`;
    let elementOrdinal = 1;
    const nextElementRef = () => `E${String(elementOrdinal++).padStart(6, "0")}`;
    const surfaceElementRef = nextElementRef();
    const actionTags = target.requiredActionRefs.map((actionRef) =>
      `<button data-action="${actionRef}" data-setfarm-element-ref="${nextElementRef()}">${actionRef}</button>`);
    const inputTags = target.requiredActionInputs.flatMap((input) => input.inputFields.map((field) =>
      `<input data-action-input="${input.actionRef}.${field}" data-setfarm-element-ref="${nextElementRef()}" />`));
    const html = [
      `<main data-surface-id="${target.surfaceRef}" data-setfarm-element-ref="${surfaceElementRef}">`,
      ...actionTags,
      ...inputTags,
      "</main>",
    ].join("");
    return {
      screenId,
      htmlBytes: validStitchHtml(html, `setup-build-${screenId}`),
      screenshotBytes: validStitchPng(index + 1),
    };
  });
  const directResponseEvidence = {
    schema: "setfarm.stitch-direct-response-evidence.v2",
    projectId: "fixture-project",
    batches: batches.map((batch, index) => ({
      stageId: batch.stageId,
      targetRefs: batch.targetRefs,
      source: "direct",
      candidates: [
        {
          screenId: batch.screens[0]!.screenId,
          title: batch.screens[0]!.title,
          responsePaths: [`$result.structuredContent.outputComponents[${index}].design.screens[0]`],
          width: "1440",
          height: "900",
          htmlAvailable: true,
          screenshotAvailable: true,
          ...stitchDownloadReceipts(
            batch.screens[0]!.screenId,
            candidateArtifacts[index]!.htmlBytes,
            candidateArtifacts[index]!.screenshotBytes,
          ),
          identityConflicts: [],
          disposition: "admitted_renderable_screen",
          missingEvidence: [],
        },
        ...(index === 0 ? [{
          screenId: "helper-code-canvas",
          title: "Three.js",
          responsePaths: ["$result.structuredContent.outputComponents[0].design.screens[1]"],
          width: "512",
          height: "512",
          htmlAvailable: true,
          screenshotAvailable: false,
          htmlSourceRefHash: "a".repeat(64),
          identityConflicts: [],
          disposition: "excluded_missing_render_evidence",
          missingEvidence: ["screenshot"],
        }] : []),
      ],
    })),
  };
  const renderedSemantics = buildTestRenderedSemantics({
    generationTargets: targets.generationTargets,
    directResponseEvidence,
    artifacts: candidateArtifacts,
  });
  const selection = selectStitchTargetCandidatesV1({
    generationTargets: targets.generationTargets,
    directResponseEvidence,
    renderedSemantics,
    artifacts: candidateArtifacts,
    authorityMode: "clean_v3",
  });
  assert.equal(selection.status, "produced", JSON.stringify(selection.diagnostics));
  if (selection.status !== "produced") throw new Error("fixture candidate selection failed");
  const bindings = bindStitchTargetCandidateSelectionsV2({
    generationTargets: targets.generationTargets,
    candidateSelection: selection.candidateSelection,
  });
  assert.equal(bindings.status, "produced", JSON.stringify(bindings.diagnostics));
  if (bindings.status !== "produced") throw new Error("fixture response binding failed");

  fs.mkdirSync(path.join(repo, "src", "screens"), { recursive: true });
  fs.mkdirSync(path.join(repo, "src", "features"), { recursive: true });
  fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
  fs.mkdirSync(path.join(repo, ".setfarm", "setup"), { recursive: true });
  fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({
    name: "pulse-tile",
    private: true,
    scripts: { build: "vite build", test: "vitest run" },
  }, null, 2) + "\n");
  fs.writeFileSync(path.join(repo, "src", "main.tsx"), "export const main = true;\n");
  fs.writeFileSync(path.join(repo, "src", "features", "status.ts"), "export const status = 'ready';\n");
  writeJson(path.join(repo, "stitch", "GENERATION_TARGETS.json"), targets.generationTargets, true);
  writeJson(path.join(repo, "stitch", "STITCH_DIRECT_RESPONSE_EVIDENCE.json"), directResponseEvidence, true);
  writeJson(path.join(repo, "stitch", "STITCH_RENDERED_SEMANTICS.json"), renderedSemantics, true);
  writeJson(path.join(repo, "stitch", "STITCH_TARGET_CANDIDATE_SELECTION.json"), selection.candidateSelection, true);
  writeJson(path.join(repo, "stitch", "STITCH_RESPONSE_BINDINGS.json"), bindings.responseBindings, true);
  candidateArtifacts.forEach((artifact) => {
    fs.writeFileSync(path.join(repo, "stitch", `${artifact.screenId}.html`), artifact.htmlBytes);
    fs.writeFileSync(path.join(repo, "stitch", `${artifact.screenId}.png`), artifact.screenshotBytes);
  });
  for (const candidate of renderedSemantics.candidates) {
    if (candidate.status !== "rendered" || !candidate.semanticDom) continue;
    const artifact = candidateArtifacts.find((item) => item.screenId === candidate.screenId)!;
    fs.mkdirSync(path.dirname(path.join(repo, candidate.semanticDom.locator)), { recursive: true });
    fs.writeFileSync(path.join(repo, candidate.semanticDom.locator), artifact.htmlBytes);
  }

  const bindingByTarget = new Map(bindings.responseBindings.bindings.map((item) => [item.targetRef, item]));
  const screenIndex: Array<Record<string, unknown>> = [];
  const generatedFiles: string[] = [];
  targets.generationTargets.targets.forEach((target, targetIndex) => {
    const binding = bindingByTarget.get(target.targetId)!;
    const targetSelection = selection.candidateSelection.selections.find((item) => item.targetRef === target.targetId)!;
    const selectedEvaluation = targetSelection.evaluations.find((item) => item.screenId === binding.responseScreenId)!;
    const exactElementRef = (kind: string, semanticRef: string) => {
      const check = selectedEvaluation.semanticChecks.find((item) => item.kind === kind && item.semanticRef === semanticRef);
      assert.equal(check?.disposition, "exact");
      assert.equal(check?.elementRefs.length, 1);
      return check!.elementRefs[0]!;
    };
    const renderedCandidate = renderedSemantics.candidates.find((item) => item.screenId === binding.responseScreenId)!;
    assert.equal(renderedCandidate.status, "rendered");
    const sourceLocator = renderedCandidate.semanticDom!.locator;
    const file = `src/screens/Surface${targetIndex + 1}.tsx`;
    const controls: Array<Record<string, unknown>> = [];
    const tags: string[] = [];
    target.requiredActionRefs.forEach((actionRef, actionIndex) => {
      const generatedLocalId = `action-${targetIndex + 1}-${actionIndex + 1}`;
      controls.push({
        id: generatedLocalId,
        generatedLocalId,
        kind: "button",
        label: actionRef,
        actionRef,
        semanticSource: "data-action",
        sourceLocator,
        sourceElementRef: exactElementRef("action", actionRef),
        generatedSourceLocator: file,
        selector: `[data-action-id="${generatedLocalId}"]`,
      });
      tags.push(`<button data-action="${actionRef}" data-setfarm-element-ref="${exactElementRef("action", actionRef)}" data-action-id="${generatedLocalId}">${actionRef}</button>`);
    });
    target.requiredActionInputs.forEach((required, actionIndex) => {
      required.inputFields.forEach((inputField, fieldIndex) => {
        const generatedLocalId = `input-${targetIndex + 1}-${actionIndex + 1}-${fieldIndex + 1}`;
        controls.push({
          id: generatedLocalId,
          generatedLocalId,
          kind: "input",
          label: inputField,
          inputBindings: [{ actionRef: required.actionRef, inputField }],
          semanticSource: "data-action-input",
          sourceLocator,
          sourceElementRef: exactElementRef("action_input", `${required.actionRef}.${inputField}`),
          generatedSourceLocator: file,
          selector: `[data-control-id="${generatedLocalId}"]`,
        });
        tags.push(`<input data-action-input="${required.actionRef}.${inputField}" data-setfarm-element-ref="${exactElementRef("action_input", `${required.actionRef}.${inputField}`)}" data-control-id="${generatedLocalId}" />`);
      });
    });
    fs.writeFileSync(path.join(repo, file), [
      `export function Surface${targetIndex + 1}() {`,
      "  return <>",
      ...tags.map((tag) => `    ${tag}`),
      "  </>;",
      "}",
      "",
    ].join("\n"));
    generatedFiles.push(file);
    screenIndex.push({
      screenId: binding.responseScreenId,
      title: binding.responseTitle,
      componentName: `Surface${targetIndex + 1}`,
      file,
      buttons: target.requiredActionRefs.length,
      inputs: target.requiredActionInputs.reduce((count, item) => count + item.inputFields.length, 0),
      textareas: 0,
      selects: 0,
      links: 0,
      controls,
      observables: [],
      projection: {
        schema: "setfarm.stitch-screen-projection.v2",
        mode: "contract_only",
        targetRef: target.targetId,
        rawInteractiveCounts: {
          buttons: target.requiredActionRefs.length,
          links: 0,
          inputs: target.requiredActionInputs.reduce((count, item) => count + item.inputFields.length, 0),
          textareas: 0,
          selects: 0,
        },
        requiredObservableRefs: [],
      },
      rejectedControls: [],
    });
  });
  writeJson(path.join(repo, "src", "screens", "SCREEN_INDEX.json"), screenIndex);

  const dependencyEvidence = { requested: [], approved: [], installed: [], rejected: [] };
  const certificate = {
    schema: "setfarm.setup-certificate.v1",
    runId,
    projectName: "Pulse Tile",
    projectSlug: "pulse-tile",
    platform,
    techStack,
    stackPackId,
    commands: { build: "legacy command prose is not compiler authority" },
    entrypoints: ["src/main.tsx", "src/main.jsx", "src/App.tsx", "src/App.jsx"],
    setupOwnedFiles: ["package.json"],
    forbiddenDuringImplement: ["package.json"],
    sharedFiles: [],
    scaffoldSnapshot: [
      "package.json",
      "src/main.tsx",
      "src/features/status.ts",
      "src/screens/SCREEN_INDEX.json",
      ...generatedFiles,
    ],
    generatedDesignFiles: [],
    designAuthority: {
      required: true,
      source: "stitch",
      screenMap: "stitch/SCREEN_MAP.json",
      rules: ["Exact v3 bindings only."],
      conversionPolicy: "wrap_jsx",
      conversionNote: "Generated JSX is immutable setup input.",
    },
    fileTreeManifestPath: ".setfarm/setup/FILE_TREE_MANIFEST.json",
    sharedGrantsPath: ".setfarm/setup/SHARED_GRANTS.json",
    targetResolutionRules: {},
    dependencyEvidence,
    buildEvidence: {
      buildCommand: "npm run build",
      artifactPath: "dist/index.html",
      stdoutPath: "",
      stderrPath: "",
    },
    createdAt: "2026-07-13T00:00:00.000Z",
  };
  const manifest = {
    schema: "setfarm.file-tree-manifest.v1",
    runId,
    stackPackId,
    resolvedTargets: [{
      storyId: "US-001",
      role: "action_handler",
      domainSlug: "status",
      targetSlug: "status",
      path: "src/features/status.ts",
      resolvedPath: "src/features/status.ts",
      ruleId: "vite.action_handler",
      collisionStatus: "unique",
      source: "scope_target",
    }, ...targets.generationTargets.targets.map((target, index) => {
      const response = bindingByTarget.get(target.targetId)!;
      return {
        storyId: "US-001",
        role: "surface_component",
        surfaceId: target.surfaceRef,
        screenId: response.responseScreenId,
        domainSlug: "status",
        targetSlug: `surface-${index + 1}`,
        path: generatedFiles[index]!,
        resolvedPath: generatedFiles[index]!,
        ruleId: "vite.surface_component",
        collisionStatus: "unique",
        source: "scope_target",
      };
    })],
    dependencyPlan: dependencyEvidence,
    mockInjectionPoints: [],
    routeRegistrationPlan: [],
  };
  const sharedGrants = {
    schema: "setfarm.shared-grants.v1",
    version: 1,
    runId,
    grants: [],
  };
  writeJson(path.join(repo, ".setfarm", "setup", "SETUP_CERTIFICATE.json"), certificate);
  writeJson(path.join(repo, ".setfarm", "setup", "FILE_TREE_MANIFEST.json"), manifest);
  writeJson(path.join(repo, ".setfarm", "setup", "SHARED_GRANTS.json"), sharedGrants);

  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "setfarm-test@example.invalid"]);
  git(repo, ["config", "user.name", "Setfarm Test"]);
  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", "fixture"]);
  return {
    runId,
    repo,
    planText: renderLegacyPrd(product.productSpec, {
      platform,
      techStack,
      uiLanguage: "English",
    }),
    generatedFiles,
  };
}

describe("setup-build Product Build Packet orchestration", () => {
  const repos: string[] = [];

  afterEach(() => {
    repos.splice(0).forEach((repo) => fs.rmSync(repo, { recursive: true, force: true }));
  });

  function fixture(): Fixture {
    const value = createFixture();
    repos.push(value.repo);
    return value;
  }

  it("assembles ProductSpec, exact DesignGraph, BuildTopology and StoryPlan from source files", () => {
    const value = fixture();
    const first = assembleSetupBuildPacketContracts(value);
    const second = assembleSetupBuildPacketContracts(value);

    assert.deepEqual(second, first);
    assert.equal(first.productSpec.schema, "setfarm.product-spec.v1");
    assert.equal(first.designGraph.schema, "setfarm.design-interaction-graph.v1");
    assert.equal(first.buildTopology.schema, "setfarm.build-topology.v1");
    assert.equal(first.storyPlan.schema, "setfarm.story-plan.v1");
    assert.equal(first.buildTopology.repo.baseSha, git(value.repo, ["rev-parse", "HEAD"]));
    assert.equal(first.buildTopology.repo.treeHash, git(value.repo, ["rev-parse", "HEAD^{tree}"]));
    assert.deepEqual(first.storyPlan.stories.map((story) => story.id), ["US-001"]);
    assert.equal(first.buildTopology.commands.find((command) => command.kind === "build")?.argv.join(" "), "npm run build");
    assert.equal(Object.values(first.sourceHashes).flat().every((hash) => /^[a-f0-9]{64}$/.test(hash)), true);
    assert.equal(first.sourceHashes.candidateSelection?.length, 64);
    assert.equal(first.designGraph.rawArtifactHashes.includes(first.sourceHashes.generationTargets), true);
    assert.equal(first.designGraph.rawArtifactHashes.includes(first.sourceHashes.candidateSelection!), true);
    assert.equal(first.designGraph.rawArtifactHashes.includes(first.sourceHashes.responseBindings), true);
  });

  it("rejects candidate selection that lost admitted direct response evidence", () => {
    const value = fixture();
    const evidencePath = path.join(value.repo, "stitch", "STITCH_DIRECT_RESPONSE_EVIDENCE.json");
    const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
    const admitted = evidence.batches
      .flatMap((batch: any) => batch.candidates)
      .find((candidate: any) => candidate.disposition === "admitted_renderable_screen");
    admitted.screenId = "different-direct-screen";
    writeJson(evidencePath, evidence, true);
    git(value.repo, ["add", "stitch/STITCH_DIRECT_RESPONSE_EVIDENCE.json"]);
    git(value.repo, ["commit", "-q", "-m", "break direct evidence"]);

    assert.throws(
      () => assembleSetupBuildPacketContracts(value),
      (error: unknown) => error instanceof SetupBuildPacketError
        && error.code === "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
    );
  });

  it("keeps pre-v3 shadow assembly compatible when direct evidence is absent", () => {
    const value = fixture();
    const bindingsPath = path.join(value.repo, "stitch", "STITCH_RESPONSE_BINDINGS.json");
    const selected = JSON.parse(fs.readFileSync(bindingsPath, "utf8"));
    writeJson(bindingsPath, {
      schema: "setfarm.stitch-target-response-bindings.v1",
      generationTargetsHash: selected.generationTargetsHash,
      bindings: selected.bindings.map(({
        htmlArtifactHash: _html,
        screenshotArtifactHash: _png,
        semanticDomHash: _dom,
        semanticObservationHash: _observation,
        contractElementRefs: _elementRefs,
        ...binding
      }: any) => binding),
    }, true);
    fs.rmSync(path.join(value.repo, "stitch", "STITCH_DIRECT_RESPONSE_EVIDENCE.json"));
    fs.rmSync(path.join(value.repo, "stitch", "STITCH_RENDERED_SEMANTICS.json"));
    fs.rmSync(path.join(value.repo, "stitch", "STITCH_TARGET_CANDIDATE_SELECTION.json"));
    const screenIndexPath = path.join(value.repo, "src", "screens", "SCREEN_INDEX.json");
    const screenIndex = JSON.parse(fs.readFileSync(screenIndexPath, "utf8"));
    for (const screen of screenIndex) {
      for (const control of screen.controls) {
        control.sourceLocator = `stitch/${screen.screenId}.html`;
        delete control.sourceElementRef;
      }
    }
    writeJson(screenIndexPath, screenIndex);
    git(value.repo, ["add", "-A"]);
    git(value.repo, ["commit", "-q", "-m", "legacy fixture without direct evidence"]);

    const assembled = assembleSetupBuildPacketContracts(value);
    assert.equal(assembled.sourceHashes.directResponseEvidence, undefined);
  });

  it("requires direct response evidence for Product Compiler v3 assembly", () => {
    const value = createFixture("run-v3-direct-evidence", true);
    repos.push(value.repo);
    fs.rmSync(path.join(value.repo, "stitch", "STITCH_DIRECT_RESPONSE_EVIDENCE.json"));
    git(value.repo, ["add", "-u"]);
    git(value.repo, ["commit", "-q", "-m", "remove v3 direct evidence"]);

    assert.throws(
      () => assembleSetupBuildPacketContracts({ ...value, requireV3Proposal: true }),
      (error: unknown) => error instanceof SetupBuildPacketError
        && error.code === "SETUP_PACKET_DIRECT_RESPONSE_EVIDENCE_REJECTED",
    );
  });

  it("rejects utility static delivery before reading a missing generated-screen topology", () => {
    const value = createFixture("run-v3-static-delivery", true);
    repos.push(value.repo);
    fs.rmSync(path.join(value.repo, "src", "screens"), { recursive: true, force: true });
    const incompatiblePlan = value.planText.replace(
      '"techStack":"vite-react"',
      '"techStack":"static-html"',
    );

    assert.throws(
      () => assembleSetupBuildPacketContracts({
        ...value,
        planText: incompatiblePlan,
        requireV3Proposal: true,
      }),
      (error: unknown) => error instanceof SetupBuildPacketError
        && error.code === "SETUP_PACKET_DELIVERY_PROFILE_REJECTED"
        && !String(error.message).includes("SCREEN_INDEX"),
    );
  });

  it("seals a browser-game React/canvas shell through the same exact packet projection", () => {
    const value = createFixture("run-v3-browser-game", true, "game");
    repos.push(value.repo);
    const assembled = assembleSetupBuildPacketContracts({
      ...value,
      requireV3Proposal: true,
    });

    assert.equal(assembled.deliverySelection?.profileId, "PROFILE_BROWSER_GAME_REACT_CANVAS_EXACT_V1");
    assert.equal(assembled.deliverySelection?.stackPackId, "browser-game-canvas");
    assert.equal(assembled.buildTopology.stackPack.id, "browser-game-canvas");
    assert.equal(assembled.sourceHashes.deliverySelection?.length, 64);
    assert.equal(
      assembled.buildTopology.deliveryProfile?.selectionHash,
      assembled.sourceHashes.deliverySelection,
    );
    assert.equal(
      assembled.buildTopology.deliveryProfile?.designProjection,
      "exact_stitch_screen_index_v4",
    );
    assert.equal(assembled.designGraph.bindings.length > 0, true);
  });

  it("selects one catalog-prioritized executable entrypoint and seals runtime evidence during setup-build", () => {
    const value = createFixture("run-v3-entrypoint-authority", true);
    repos.push(value.repo);
    fs.writeFileSync(path.join(value.repo, "src", "App.tsx"), "export const app = true;\n");
    git(value.repo, ["add", "src/App.tsx"]);
    git(value.repo, ["commit", "-q", "-m", "add normal Vite app module"]);

    const assembled = assembleSetupBuildPacketContracts({
      ...value,
      requireV3Proposal: true,
    });
    assert.equal(assembled.buildTopology.entrypoints.length, 1);
    const entrypoint = assembled.buildTopology.entrypoints[0]!;
    assert.equal(
      assembled.buildTopology.pathBindings.find((binding) => binding.id === entrypoint.pathRef)?.path,
      "src/main.tsx",
    );
    assert.equal(assembled.buildTopology.runtimeEvidenceContract?.adapter, "browser-service");
    assert.deepEqual(assembled.buildTopology.runtimeEvidenceContract?.server.env, {
      HOST: "{{HOST}}",
      PORT: "{{PORT}}",
    });
    assert.match(assembled.buildTopology.runtimeEvidenceContractHash ?? "", /^[a-f0-9]{64}$/);
  });

  it("rejects setup when the PLAN-sealed delivery selection hash changes", () => {
    const value = createFixture("run-v3-selection-hash", true);
    repos.push(value.repo);

    assert.throws(
      () => assembleSetupBuildPacketContracts({
        ...value,
        requireV3Proposal: true,
        expectedDeliverySelectionHash: "0".repeat(64),
      }),
      (error: unknown) => error instanceof SetupBuildPacketError
        && error.code === "SETUP_PACKET_DELIVERY_PROFILE_REJECTED"
        && String(error.message).includes("selection hash"),
    );
  });

  it("preserves a valid explicit stack-prefix selection identity through packet seal", () => {
    const value = createFixture("run-v3-explicit-vite", true);
    repos.push(value.repo);
    const explicit = resolveProductDeliverySelectionV1({
      productClass: "utility",
      requestedStackPackId: "vite-react-web-app",
    });
    assert.equal(explicit.status, "selected");
    if (explicit.status !== "selected") return;

    const assembled = assembleSetupBuildPacketContracts({
      ...value,
      requireV3Proposal: true,
      expectedDeliverySelectionHash: explicit.selectionHash,
      requestedStackPackId: "vite-react-web-app",
    });
    assert.equal(assembled.deliverySelection?.selectionBasis, "explicit_stack_prefix");
    assert.equal(assembled.sourceHashes.deliverySelection, explicit.selectionHash);
  });

  it("rejects same-element semantic loss instead of guessing from labels", () => {
    const value = fixture();
    const generated = path.join(value.repo, value.generatedFiles[0]!);
    fs.writeFileSync(generated, fs.readFileSync(generated, "utf8").replace(/ data-action="[^"]+"/, ""));
    git(value.repo, ["add", value.generatedFiles[0]!]);
    git(value.repo, ["commit", "-q", "-m", "semantic loss"]);

    assert.throws(
      () => assembleSetupBuildPacketContracts(value),
      (error: unknown) => error instanceof SetupBuildPacketError
        && error.code === "SETUP_PACKET_DESIGN_GRAPH_REJECTED"
        && String(error.message).includes("DESIGN_SAME_ELEMENT_ACTION_MISSING"),
    );
  });

  it("rejects a dirty product source before binding it to a Git tree", () => {
    const value = fixture();
    fs.appendFileSync(path.join(value.repo, "src", "features", "status.ts"), "export const drift = true;\n");

    assert.throws(
      () => assembleSetupBuildPacketContracts(value),
      (error: unknown) => error instanceof SetupBuildPacketError
        && error.code === "SETUP_PACKET_REPO_DIRTY",
    );
  });
});

describe("setup-build packet runtime publication", () => {
  const releaseSha = "c".repeat(40);
  const limits = {
    maxPayloadBytes: 4 * 1024 * 1024,
    rootQuotaBytes: 16 * 1024 * 1024,
    minFreeBytes: 0,
  };
  const roots: string[] = [];
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => {
    roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true }));
    await database.cleanup();
  });

  beforeEach(async () => {
    await database.reset();
    await database.sql.unsafe(
      `UPDATE artifact_capacity
          SET quota_bytes = 16777216, max_payload_bytes = 4194304,
              total_bytes = 0, reserved_bytes = 0,
              state = 'bootstrap_required', reconciled_at = NULL,
              diagnostic = NULL, updated_at = NOW()
        WHERE capacity_key = 'semantic-artifacts'`,
    );
  });

  async function compileShadow() {
    const runId = "setup-packet-runtime-shadow";
    const fixture = createFixture(runId);
    roots.push(fixture.repo);
    const artifactParent = fs.mkdtempSync(path.join(tmpdir(), "setfarm-setup-packet-cas-"));
    roots.push(artifactParent);
    const artifactRoot = path.join(artifactParent, "sha256");
    await bootstrapArtifactIndex({
      index: createArtifactIndex(database.sql),
      store: new ContentAddressedArtifactStore(artifactRoot, { limits }),
      quotaBytes: limits.rootQuotaBytes,
      maxPayloadBytes: limits.maxPayloadBytes,
    });
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol,
         compiler_release_sha, activation_preflight_hash, release_admission_hash
       ) VALUES ($1, 'feature-dev', 'setup packet runtime', 'running', $2, $3, $4, $5)`,
      [runId, "shadow", releaseSha, "d".repeat(64), null],
    );
    const result = await orchestrateSetupBuildProductPacket({
      sql: database.sql,
      artifactRoot,
      artifactLimits: limits,
      runId,
      expectedMode: "shadow",
      repo: fixture.repo,
      planText: fixture.planText,
      ownerInstanceId: "setup-packet-test-shadow",
    });
    return { runId, result };
  }

  it("publishes shadow history refs without mutating run packet state", async () => {
    const { runId, result } = await compileShadow();
    assert.equal(result.compilation.activation, "observed");
    assert.equal(result.compilation.compilation.status, "sealed");
    const rows = await database.sql<Array<{
      packet_hash: string | null;
      packets: number;
      refs: number;
      non_shadow_refs: number;
    }>>`
      SELECT r.packet_hash,
             (SELECT COUNT(*)::integer FROM product_packets WHERE run_id = r.id) AS packets,
             (SELECT COUNT(*)::integer FROM run_artifact_refs WHERE run_id = r.id) AS refs,
             (SELECT COUNT(*)::integer FROM run_artifact_refs
               WHERE run_id = r.id AND ref_key NOT LIKE 'SHADOW_%') AS non_shadow_refs
        FROM runs r WHERE r.id = ${runId}
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), [{
      packet_hash: null,
      packets: 0,
      refs: 6,
      non_shadow_refs: 0,
    }]);
  });
});
