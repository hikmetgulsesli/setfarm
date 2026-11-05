import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { SemanticArtifactEnvelopeV1Schema } from "../../src/product-compiler/artifact-store.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { captureStitchRenderedSemanticsV2 } from "../../src/product-compiler/producers/stitch-rendered-semantics-v2.js";
import { selectStitchTargetCandidatesV2, bindStitchTargetCandidateSelectionsV3 } from "../../src/product-compiler/producers/stitch-target-candidate-selection-v2.js";
import { produceDesignInteractionGraphV2 } from "../../src/product-compiler/producers/design-graph-v2.js";
import { produceImplementationSourceMapV1 } from "../../src/product-compiler/producers/implementation-source-map-v1.js";
import { produceRuntimeDataContractV1 } from "../../src/product-compiler/producers/runtime-data-contract.js";
import { produceStoryPlanV2 } from "../../src/product-compiler/producers/story-plan-v2.js";
import { BuildTopologyV1Schema } from "../../src/product-compiler/schemas/build-topology-v1.js";
import { DesignSourceClosureV2Schema } from "../../src/product-compiler/schemas/design-source-closure-v2.js";
import { ProductBuildPacketV3Schema } from "../../src/product-compiler/schemas/product-build-packet-v3.js";
import { StitchScreenIndexV2Schema } from "../../src/product-compiler/schemas/stitch-screen-index-v2.js";
import { RuntimeEvidenceContractV1Schema, hashRuntimeEvidenceContractV1 } from "../../src/evidence/runtime-evidence-contract-v1.js";
import { produceRuntimeEvidenceContractV1 } from "../../src/evidence/runtime-evidence-contract-producer-v1.js";
import { compileLegacyImplementationSliceV2, verifyLegacyImplementationSliceV2 } from "../../src/product-compiler/slice-compiler-v2-legacy.js";
import { CONTAINED_GAME_TASK, containedGamePlanProposalV2 } from "../product-compiler/fixtures/product-semantics-v2.js";
import { stitchDownloadReceipts, validStitchHtml, validStitchPng } from "../product-compiler/fixtures/stitch-artifacts.js";

export const NATIVE_BROWSER_SOURCE = { sha: "7".repeat(40), treeHash: "8".repeat(40) };
export const NATIVE_BROWSER_CANDIDATE = { sha: "9".repeat(40), treeHash: "a".repeat(40) };
const PRODUCER = { pass: "native-browser-evidence-test", codeSha: "b".repeat(40), toolVersions: {} };
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
const converterPath = fileURLToPath(new URL("../../scripts/stitch-to-jsx.mjs", import.meta.url));

export async function nativeBrowserFixture(options: { input?: "empty-string" | "boolean"; persistence?: boolean; prerequisite?: boolean; twoPlacements?: boolean } = {}) {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-native-browser-evidence-"));
  try {
    const proposal = containedGamePlanProposalV2();
    const primary = proposal.actions[0];
    if (options.twoPlacements) primary.controlPlacements.push({ ...primary.controlPlacements[0], key: "secondary_start" });
    if (options.input) {
      const field = options.input === "boolean" ? "enabled" : "phase";
      primary.inputs = [{ name: field, valueType: options.input === "boolean" ? "boolean" : "string", required: true }];
      primary.evidenceScenario.targetInputValues = { [field]: options.input === "boolean" ? true : "" };
      primary.stateDeltas[0].path = `/${field}`;
      primary.stateDeltas[0].valueFrom = { kind: "input", field };
      if (options.input === "boolean") proposal.states[0].initialValue.enabled = false;
      else primary.observables.push({ key: "status_value", selector: { kind: "accessibility", surfaceKey: "status_panel", role: "status", name: "Game value" },
        assertions: [{ phase: "after", property: "value", operator: "equals", expected: "" },
          ...(options.persistence ? [{ phase: "reload", property: "value", operator: "equals", expected: "" }] : [])], requirementRefs: primary.requirementRefs });
    }
    if (options.persistence) {
      proposal.requirements.forEach((requirement: { expectedSemanticKinds: string[] }) => {
        if (!requirement.expectedSemanticKinds.includes("persistence")) requirement.expectedSemanticKinds.push("persistence");
      });
      proposal.persistencePolicies = [{ key: "game_local", kind: "local_storage", entityKeys: [], rehydration: { kind: "initialization" }, requirementRefs: primary.requirementRefs }];
      primary.persistenceIntents = [{ policyKey: "game_local", operation: "write", stateDeltaKeys: ["start_phase"] }];
      primary.observables.find((observable: { key: string }) => observable.key === "status_text").assertions.push({ phase: "reload", property: "visible_text", operator: "contains", expected: "Playing" });
    }
    if (options.prerequisite) {
      const prepare = structuredClone(primary);
      prepare.key = "prepare_game"; prepare.name = "Prepare Game";
      prepare.controlPlacements = [{ ...primary.controlPlacements[0], key: "prepare" }];
      prepare.inputs = []; prepare.preconditions = []; prepare.persistenceIntents = [];
      prepare.evidenceScenario = { controlPlacementKey: "prepare", targetInputValues: {}, prerequisiteSteps: [] };
      prepare.stateDeltas = [{ key: "prepare_phase", stateKey: "game_phase", operation: "set", path: "/phase", valueFrom: { kind: "literal", value: "prepared" } }];
      prepare.observables = [{ key: "prepared_control", selector: { kind: "control", controlPlacementKey: "prepare" },
        assertions: [{ phase: "after", property: "visibility", operator: "equals", expected: true }], requirementRefs: primary.requirementRefs }];
      primary.preconditions = [{ stateKey: "game_phase", path: "/phase", operator: "equals", expected: "prepared" }];
      primary.evidenceScenario.prerequisiteSteps = [{ actionKey: "prepare_game", inputValues: {} }];
      proposal.actions.push(prepare);
    }
    const productResult = compilePlanSemanticProposalV2({ task: CONTAINED_GAME_TASK, proposal });
    assert.equal(productResult.status, "canonicalized", JSON.stringify(productResult));
    if (productResult.status !== "canonicalized") throw Error("native browser product rejected");
    const productSpec = productResult.productSpec;
    const targetResult = produceDesignGenerationTargetsV2(productSpec);
    assert.equal(targetResult.status, "produced", JSON.stringify(targetResult));
    if (targetResult.status !== "produced") throw Error("native browser targets rejected");
    const generationTargets = targetResult.generationTargets;
    assert.equal(generationTargets.targets.length, 1, "all variants intentionally remain one native story/screen");
    const target = generationTargets.targets[0]!;
    const surfaceHtml = (surfaceRef: string): string => {
      const controls = target.requiredControlPlacements.filter(placement => placement.surfaceRef === surfaceRef).map(placement => {
        const action = productSpec.actions.find(candidate => candidate.id === placement.actionRef)!;
        if (action.input.fields.length) {
          assert.equal(action.input.fields.length, 1, "input variants intentionally declare one exact physical input");
          const field = action.input.fields[0]!;
          return `<input type="${field.valueType === "boolean" ? "checkbox" : "text"}" aria-label="${escape(action.name)}" data-action="${action.id}" data-control-slot="${placement.controlSlotRef}" data-action-input="${action.id}.${field.name}" value="ready" />`;
        }
        return `<button data-action="${action.id}" data-control-slot="${placement.controlSlotRef}">${action.name}</button>`;
      }).join("");
      const observables = target.requiredObservableSelectors.flatMap(observable => observable.selector.kind === "accessibility" && observable.selector.surfaceRef === surfaceRef
        ? [`<div role="${observable.selector.role}" aria-label="${escape(observable.selector.name)}" data-value="ready">Ready</div>`] : []).join("");
      const children = productSpec.surfaces.filter(surface => surface.composition.kind === "contained" && surface.composition.hostSurfaceRef === surfaceRef).map(surface => surfaceHtml(surface.id)).join("");
      return `<section data-surface-id="${surfaceRef}">${controls}${observables}${children}</section>`;
    };
    const htmlBytes = validStitchHtml(surfaceHtml(target.surfaceRef), "native-evidence-fixture");
    const screenshotBytes = validStitchPng(117);
    const screenId = "screen-native-evidence-fixture";
    const directResponseEvidence = { schema: "setfarm.stitch-direct-response-evidence.v2", projectId: "native-evidence-fixture", batches: [{
      stageId: "stage-native-evidence-fixture", targetRefs: [target.targetId], source: "direct", candidates: [{ screenId, title: target.expectedScreenTitle,
        responsePaths: ["$result.screens[0]"], htmlAvailable: true, screenshotAvailable: true, ...stitchDownloadReceipts(screenId, htmlBytes, screenshotBytes),
        identityConflicts: [], disposition: "admitted_renderable_screen", missingEvidence: [] }],
    }] };
    const artifacts = [{ screenId, htmlBytes, screenshotBytes }];
    const capture = await captureStitchRenderedSemanticsV2({ generationTargets, directResponseEvidence, artifacts, deviceType: "DESKTOP" });
    const selection = selectStitchTargetCandidatesV2({ generationTargets, directResponseEvidence, artifacts, renderedSemantics: capture.artifact });
    assert.equal(selection.status, "produced", JSON.stringify(selection));
    if (selection.status !== "produced") throw Error("native browser selection rejected");
    const bound = bindStitchTargetCandidateSelectionsV3({ generationTargets, candidateSelection: selection.candidateSelection, renderedSemantics: capture.artifact });
    assert.equal(bound.status, "produced", JSON.stringify(bound));
    if (bound.status !== "produced") throw Error("native browser binding rejected");
    const designGraph = produceDesignInteractionGraphV2({ productSpec, generationTargets, candidateSelection: selection.candidateSelection,
      renderedSemantics: capture.artifact, responseBindings: bound.responseBindings }).designGraph;
    const stitch = path.join(workdir, "stitch"); fs.mkdirSync(stitch);
    const write = (name: string, value: unknown) => fs.writeFileSync(path.join(stitch, name), JSON.stringify(value));
    write("DESIGN_MANIFEST.json", [{ screenId, title: target.expectedScreenTitle, htmlFile: `${screenId}.html`, screenshotFile: `${screenId}.png`, targetRef: target.targetId }]);
    fs.writeFileSync(path.join(stitch, `${screenId}.html`), htmlBytes); fs.writeFileSync(path.join(stitch, `${screenId}.png`), screenshotBytes);
    for (const [locator, bytes] of capture.sidecars.semanticDom) { const destination = path.join(workdir, locator); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes); }
    write("GENERATION_TARGETS.json", generationTargets); write("STITCH_RENDERED_SEMANTICS_V2.json", capture.artifact);
    write("STITCH_TARGET_CANDIDATE_SELECTION.json", selection.candidateSelection); write("STITCH_RESPONSE_BINDINGS.json", bound.responseBindings);
    write("DESIGN_INTERACTION_GRAPH_V2.json", designGraph);
    execFileSync(process.execPath, [converterPath, workdir], { encoding: "utf8", timeout: 30_000, stdio: "pipe" });
    const indexPath = path.join(workdir, "src/screens/SCREEN_INDEX.json");
    const indexText = fs.readFileSync(indexPath, "utf8");
    const screenIndex = StitchScreenIndexV2Schema.parse(JSON.parse(indexText));
    assert.equal(screenIndex.length, 1);
    const screen = screenIndex[0]!;
    const generatedText = fs.readFileSync(path.join(workdir, screen.file), "utf8");
    const commands = [
      { id: "CMD_BUILD", kind: "build", argv: [process.execPath, "--check", "server.cjs"], cwd: ".", timeoutMs: 30_000, capabilityRefs: [] },
      { id: "CMD_PREVIEW", kind: "preview", argv: [process.execPath, "server.cjs", "{{HOST}}", "{{PORT}}"], cwd: ".", timeoutMs: 30_000, capabilityRefs: [] },
    ];
    const runtimeData = produceRuntimeDataContractV1({ productSpec, commands });
    assert.equal(runtimeData.status, "produced", JSON.stringify(runtimeData));
    if (runtimeData.status !== "produced") throw Error("native browser runtime data rejected");
    const baseTopology = BuildTopologyV1Schema.parse({ schema: "setfarm.build-topology.v1", stackPack: { id: "browser-game-canvas", version: "2.0.0", contentHash: sha("native-browser-stack") },
      repo: { id: "native-browser-evidence", baseSha: NATIVE_BROWSER_SOURCE.sha, treeHash: NATIVE_BROWSER_SOURCE.treeHash },
      owners: [{ id: "OWNER_US_001", kind: "story", storyRef: "US-001" }],
      pathBindings: [{ id: "PATH_SCREEN", path: screen.file, role: "generated", ownerRef: "OWNER_US_001", presence: "present", knownContentHash: sha(generatedText) }], sharedGrants: [],
      entrypoints: [{ id: "ENTRY_GAME", kind: "game", pathRef: "PATH_SCREEN", mountPoint: "/play", routeRefs: productSpec.routes.map(route => route.id) }], commands,
      capabilities: [{ id: "CAP_BROWSER_INTERACTION", kind: "browser_interaction", enabled: true }, ...(options.persistence ? [{ id: "CAP_LOCAL_PERSISTENCE", kind: "local_persistence", enabled: true }] : [])],
      policies: { packageManager: "npm", allowedRoots: ["src"], deniedGlobs: [], buildOutputPaths: ["dist"] },
      runtimeDataContract: runtimeData.contract, runtimeDataContractHash: runtimeData.contractHash });
    const runtimeResult = produceRuntimeEvidenceContractV1({ productSpec, buildTopology: baseTopology });
    assert.equal(runtimeResult.status, "produced", JSON.stringify(runtimeResult));
    if (runtimeResult.status !== "produced") throw Error("native browser runtime evidence rejected");
    const runtime = runtimeResult.contract;
    const buildTopology = BuildTopologyV1Schema.parse({ ...baseTopology, runtimeEvidenceContract: runtime, runtimeEvidenceContractHash: hashRuntimeEvidenceContractV1(runtime) });
    const stories = produceStoryPlanV2({ productSpec, designGraph, buildTopology });
    assert.equal(stories.status, "produced", JSON.stringify(stories));
    if (stories.status !== "produced") throw Error("native browser story rejected");
    const envelope = (artifactType: string, payload: unknown) => SemanticArtifactEnvelopeV1Schema.parse({ schema: "setfarm.semantic-artifact-envelope.v1", artifactType, producer: PRODUCER, payload });
    const typedRef = (artifactType: string, payload: unknown) => ({ artifactType, envelopeHash: hashCanonicalJson(envelope(artifactType, payload)), payloadHash: hashCanonicalJson(payload) });
    const closure = DesignSourceClosureV2Schema.parse({ schema: "setfarm.design-source-closure.v2", kind: "stitch",
      generationTargets: typedRef("setfarm.design-generation-targets.v2", generationTargets), directResponseEvidence: typedRef("setfarm.stitch-direct-response-evidence.v2", directResponseEvidence),
      renderedSemantics: typedRef("setfarm.stitch-rendered-semantics.v2", capture.artifact), candidateSelection: typedRef("setfarm.stitch-target-candidate-selection.v2", selection.candidateSelection),
      responseBindings: typedRef("setfarm.stitch-target-response-bindings.v3", bound.responseBindings), designGraph: typedRef("setfarm.design-interaction-graph.v2", designGraph),
      acceptedAttempt: { attemptRef: `PCA_${sha("native-design-attempt")}`, outputSealHash: sha("native-design-seal") },
      artifactManifest: { artifactType: "setfarm.product-compilation-artifact-manifest.v1", artifactHash: sha("native-design-manifest") },
      projectionReceipt: { artifactType: "setfarm.product-compilation-projection-receipt.v1", artifactHash: sha("native-design-projection") } });
    const textSource = (locator: string, text: string, mediaType: string) => ({ source: { schema: "setfarm.source-artifact-ref.v1", hash: sha(text), mediaType, locator, byteLength: Buffer.byteLength(text) }, text });
    const converterText = fs.readFileSync(converterPath, "utf8");
    const sourceMap = produceImplementationSourceMapV1({ designSourceKind: "stitch", productSpec, designGraph, buildTopology, storyPlan: stories.storyPlan, designSourceClosure: closure,
      generationTargets, responseBindings: bound.responseBindings, screenIndex,
      screenIndexSource: textSource("src/screens/SCREEN_INDEX.json", indexText, "application/json"), converterSource: textSource("scripts/stitch-to-jsx.mjs", converterText, "text/javascript"),
      generatedSources: [{ targetRef: target.targetId, responseScreenId: screenId, pathRef: "PATH_SCREEN", ...textSource(screen.file, generatedText, "text/typescript") }] });
    assert.equal(sourceMap.status, "produced", JSON.stringify(sourceMap));
    if (sourceMap.status !== "produced") throw Error("native browser source map rejected");
    const packet = ProductBuildPacketV3Schema.parse({ schema: "setfarm.product-build-packet.v3", packetVersion: 3, parentPacketHashes: [], designSourceKind: "stitch",
      productSpecV2Hash: hashCanonicalJson(envelope("setfarm.product-spec.v2", productSpec)), designGraphV2Hash: hashCanonicalJson(envelope("setfarm.design-interaction-graph.v2", designGraph)),
      buildTopologyV1Hash: hashCanonicalJson(envelope("setfarm.build-topology.v1", buildTopology)), storyPlanV2Hash: hashCanonicalJson(envelope("setfarm.story-plan.v2", stories.storyPlan)),
      designSourceClosureV2Hash: hashCanonicalJson(envelope("setfarm.design-source-closure.v2", closure)), implementationSourceMapV1Hash: hashCanonicalJson(envelope("setfarm.implementation-source-map.v1", sourceMap.sourceMap)),
      runtimeDataContractHash: runtimeData.contractHash, runtimeEvidenceContractHash: hashRuntimeEvidenceContractV1(runtime),
      compiler: { version: "4.0.0", codeSha: PRODUCER.codeSha }, validationIds: ["VALIDATE_NATIVE_BROWSER_EVIDENCE"] });
    const compilerInput = { packetHash: hashCanonicalJson(envelope("setfarm.product-build-packet.v3", packet)), packet, productSpec, designGraph, buildTopology,
      storyPlan: stories.storyPlan, designSourceClosure: closure, implementationSourceMap: sourceMap.sourceMap, storyId: "US-001", sourceRevision: NATIVE_BROWSER_SOURCE, producer: PRODUCER,
      currentFiles: [{ pathRef: "PATH_SCREEN", presence: "present", contentHash: sha(generatedText) }], dependencyOutputs: [] };
    const compiled = compileLegacyImplementationSliceV2(compilerInput);
    assert.equal(compiled.status, "compiled", JSON.stringify(compiled));
    if (compiled.status !== "compiled") throw Error("native browser slice rejected");
    const verified = verifyLegacyImplementationSliceV2({ compilerInput, slice: compiled.slice });
    assert.equal(verified.status, "verified", JSON.stringify(verified));
    if (verified.status !== "verified") throw Error("native browser independent verification rejected");
    assert.equal(verified.sliceHash, compiled.sliceHash);
    return { workdir, ...compiled, compilerInput, runtime, screen, productSpec, options,
      cleanup: () => fs.rmSync(workdir, { recursive: true, force: true }) };
  } catch (error) { fs.rmSync(workdir, { recursive: true, force: true }); throw error; }
}

/** Literal fixture application: real browser events and the declared capture ABI
 * share one state/action implementation. No driver verdict or capture is mocked.
 * This is a bounded HTML app fixture, not the later real React delivery gate.
 */
export function writeNativeBrowserRuntime(value: Awaited<ReturnType<typeof nativeBrowserFixture>>, faults: {
  wrongSlot?: boolean; wrongSurface?: boolean; wrongValue?: boolean; wrongReloadValue?: boolean; losePersistence?: boolean; skipPrerequisite?: boolean; duplicateControl?: boolean; wrongSecondarySlot?: boolean;
} = {}) {
  const screen = value.slice.storySourceMap.screens[0]!;
  const product = value.slice.contract.product;
  const refs = (elementRef: string) => screen.observables.filter(observable => observable.sourceElementRef === elementRef).map(observable => observable.observableRef).join(" ");
  const surfaceSource = [screen.rootSurface, ...screen.containedSurfaces];
  const surfaceHtml = (surfaceRef: string): string => {
    const source = surfaceSource.find(surface => surface.surfaceRef === surfaceRef)!;
    const controls = screen.controls.filter(control => control.placement.surfaceRef === surfaceRef).map(control => {
      const inputs = screen.actionInputs.filter(input => input.generatedControlId === control.generatedLocalId);
      const input = inputs[0];
      const field = input && product.actions.find(action => action.id === input.actionRef)!.input.fields.find(field => field.name === input.inputField)!;
      const slot = faults.wrongSlot || (faults.wrongSecondarySlot && control === screen.controls[1]) ? "CSLOT_WRONG_PHYSICAL_SLOT" : control.controlSlotRef;
      const attributes = `data-action-id="${control.generatedLocalId}" data-control-id="${control.physicalControlRef}" data-action="${control.actionRef}" data-control-slot="${slot}" data-setfarm-element-ref="${control.sourceElementRef}" data-observable-refs="${refs(control.sourceElementRef)}"`;
      const button = input && field
        ? `<input ${attributes} type="${field.valueType === "boolean" ? "checkbox" : "text"}" data-action-input="${input.actionInputRef}" value="ready" />`
        : `<button ${attributes}>${control.actionRef}</button>`;
      return `${button}${faults.duplicateControl ? button : ""}`;
    }).join("");
    const observables = product.actions.flatMap(action => action.observableEffects).flatMap(effect => {
      if (effect.selector.kind !== "accessibility" || effect.selector.surfaceRef !== surfaceRef) return [];
      const source = screen.observables.find(observable => observable.observableRef === effect.id)!;
      const output = `<div role="${effect.selector.role}" aria-label="${escape(effect.selector.name)}" data-setfarm-element-ref="${source.sourceElementRef}" data-observable-refs="${effect.id}" data-value="ready">Ready</div>`;
      return faults.wrongSurface ? [`<aside data-surface-id="SURF_OTHER">${output}</aside>`] : [output];
    }).join("");
    const children = product.surfaces.filter(surface => surface.composition.kind === "contained" && surface.composition.hostSurfaceRef === surfaceRef).map(surface => surfaceHtml(surface.id)).join("");
    return `<section data-surface-id="${surfaceRef}" data-setfarm-element-ref="${source.sourceElementRef}" data-observable-refs="${refs(source.sourceElementRef)}">${controls}${observables}${children}</section>`;
  };
  const initialStates = Object.fromEntries(product.states.map(state => [state.id, state.initialValue]));
  const script = `
const actions=${JSON.stringify(product.actions)};
const initialStates=${JSON.stringify(initialStates)};
const options=${JSON.stringify(value.options)},faults=${JSON.stringify(faults)};
const restored=Boolean(localStorage.getItem('native-evidence-state'));
const states=options.persistence&&!faults.losePersistence&&restored?JSON.parse(localStorage.getItem('native-evidence-state')):structuredClone(initialStates);
function render(){
 const primary=states.STATE_GAME_PHASE;
 const playing=primary.enabled===true||(primary.phase!=='ready'&&primary.phase!=='prepared');
 for(const output of document.querySelectorAll('[role="status"]')){
   output.textContent=playing?'Playing':'Ready';
   output.setAttribute('data-value',faults.wrongValue||(faults.wrongReloadValue&&restored)?'stale':String(primary.phase));
 }
}
function invokeAction(actionRef,inputValues){
 const action=actions.find(action=>action.id===actionRef); if(!action)throw Error('unknown action');
 if(faults.skipPrerequisite&&actionRef==='ACT_PREPARE_GAME')return;
 for(const delta of action.stateDeltas){
  if(delta.operation!=='set')throw Error('fixture only declares set deltas');
  const next=delta.valueFrom.kind==='input'?inputValues[delta.valueFrom.field]:delta.valueFrom.value;
  states[delta.stateRef][delta.path.slice(1)]=next;
 }
 if(options.persistence&&!faults.losePersistence)localStorage.setItem('native-evidence-state',JSON.stringify(states));
 render();
}
globalThis[${JSON.stringify(value.runtime.capture.globalName)}]={states,[${JSON.stringify(value.runtime.capture.actionInvocation.method)}]:invokeAction};
for(const button of document.querySelectorAll('[data-action]'))button.addEventListener(button.tagName==='INPUT'?(button.type==='checkbox'?'change':'input'):'click',()=>{
 const action=actions.find(action=>action.id===button.getAttribute('data-action'));
 const values=Object.fromEntries(action.input.fields.map(field=>{
  const input=document.querySelector('[data-action-input="'+action.id+'.'+field.name+'"]');
  return [field.name,field.valueType==='boolean'?input.checked:input.value];
 }));invokeAction(action.id,values);
});render();`;
  const html = `<!doctype html><html><body><main id="root">${surfaceHtml(screen.rootSurface.surfaceRef)}</main><script>${script}</script></body></html>`;
  fs.writeFileSync(path.join(value.workdir, "server.cjs"), `require('node:http').createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(${JSON.stringify(html)})}).listen(Number(process.argv[3]),process.argv[2]);`);
}
