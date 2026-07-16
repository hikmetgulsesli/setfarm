import { createHash } from "node:crypto";
import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import {
  produceDesignInteractionGraphV1,
  type DesignGraphProducerInput,
  type DesignGraphProducerResult,
} from "../producers/design-graph.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  DesignGenerationTargetsV1Schema,
  StitchTargetResponseBindingsV1Schema,
} from "../schemas/design-generation-targets-v1.js";
import {
  StitchTargetCandidateSelectionV1Schema,
  StitchTargetResponseBindingsV2Schema,
} from "../schemas/stitch-target-candidate-selection-v1.js";
import { StitchRenderedSemanticsV1Schema } from "../schemas/stitch-rendered-semantics-v1.js";
import {
  ActionIdSchema,
  ObservableIdSchema,
  Sha256Schema,
  SourceArtifactRefV1Schema,
  hasUniqueStrings,
} from "../schemas/common-v1.js";
import {
  ProductSpecV1Schema,
  type ProductActionV1,
} from "../schemas/product-spec-v1.js";

const IndexedInputMappingSchema = z
  .object({
    actionRef: ActionIdSchema,
    inputField: z.string().min(1).max(160),
  })
  .strict();

const IndexedControlSchema = z
  .object({
    id: z.string().min(1).max(500),
    generatedLocalId: z.string().min(1).max(500),
    kind: z.enum(["button", "link", "input", "textarea", "select"]),
    label: z.string().min(1).max(500).optional(),
    actionRef: ActionIdSchema.optional(),
    inputBindings: z.array(IndexedInputMappingSchema).max(500).optional(),
    sourceLocator: z.string().min(1).max(1_024),
    generatedSourceLocator: z.string().min(1).max(1_024),
    selector: z.string().min(1).max(2_000),
    sourceElementRef: z.string().regex(/^E[0-9]{6}$/).optional(),
    semanticSource: z.enum(["data-action", "data-action-input"]).optional(),
    href: z.string().max(2_000).optional(),
    index: z.number().int().nonnegative().optional(),
  })
  .passthrough();

const InteractiveCountsSchema = z.object({
  buttons: z.number().int().nonnegative(),
  links: z.number().int().nonnegative(),
  inputs: z.number().int().nonnegative(),
  textareas: z.number().int().nonnegative(),
  selects: z.number().int().nonnegative(),
}).strict();

const RejectedControlSchema = z.object({
  rejectionId: z.string().min(1).max(500),
  kind: z.enum(["button", "link", "input", "textarea", "select"]),
  label: z.string().min(1).max(500),
  index: z.number().int().nonnegative(),
  reasonCode: z.enum([
    "undeclared_by_generation_target",
    "outside_canonical_rendered_contract",
  ]),
  rawActionRef: ActionIdSchema.optional(),
  rawInputBindings: z.array(IndexedInputMappingSchema).max(500).optional(),
  sourceLocator: z.string().min(1).max(1_024),
  generatedSourceLocator: z.string().min(1).max(1_024),
  selector: z.string().min(1).max(2_000),
  sourceElementRef: z.string().regex(/^E[0-9]{6}$/).optional(),
  href: z.string().max(2_000).optional(),
}).strict();

const IndexedObservableSchema = z.object({
  observableRef: ObservableIdSchema,
  role: z.string().min(1).max(160),
  name: z.string().min(1).max(500),
  sourceLocator: z.string().min(1).max(1_024),
  generatedSourceLocator: z.string().min(1).max(1_024),
  selector: z.string().min(1).max(2_000),
  sourceElementRef: z.string().regex(/^E[0-9]{6}$/).optional(),
}).strict();

const ContractProjectionSchema = z.object({
  schema: z.literal("setfarm.stitch-screen-projection.v2"),
  mode: z.literal("contract_only"),
  targetRef: z.string().regex(/^TARGET_[A-Z0-9]+(?:_[A-Z0-9]+)*$/),
  rawInteractiveCounts: InteractiveCountsSchema,
  requiredObservableRefs: z.array(ObservableIdSchema).max(10_000).refine(hasUniqueStrings),
}).strict();

const ScreenIndexEntrySchema = z
  .object({
    screenId: z.string().min(1).max(500),
    title: z.string().min(1).max(500),
    componentName: z.string().min(1).max(500),
    file: z.string().min(1).max(1_024),
    buttons: z.number().int().nonnegative(),
    inputs: z.number().int().nonnegative(),
    textareas: z.number().int().nonnegative(),
    selects: z.number().int().nonnegative(),
    links: z.number().int().nonnegative(),
    controls: z.array(IndexedControlSchema).max(10_000),
    observables: z.array(IndexedObservableSchema).max(10_000),
    projection: ContractProjectionSchema,
    rejectedControls: z.array(RejectedControlSchema).max(10_000),
  })
  .passthrough()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.controls.map((control) => control.generatedLocalId))) {
      context.addIssue({ code: "custom", path: ["controls"], message: "SCREEN_INDEX control IDs must be unique per screen" });
    }
    if (!hasUniqueStrings(value.controls.map((control) => control.selector))) {
      context.addIssue({ code: "custom", path: ["controls"], message: "SCREEN_INDEX selectors must be unique per screen" });
    }
    if (!hasUniqueStrings(value.rejectedControls.map((control) => control.rejectionId))) {
      context.addIssue({ code: "custom", path: ["rejectedControls"], message: "SCREEN_INDEX rejection IDs must be unique per screen" });
    }
    if (!hasUniqueStrings(value.rejectedControls.map((control) => control.selector))) {
      context.addIssue({ code: "custom", path: ["rejectedControls"], message: "SCREEN_INDEX rejection selectors must be unique per screen" });
    }
    if (!hasUniqueStrings(value.observables.map((observable) => observable.observableRef))) {
      context.addIssue({ code: "custom", path: ["observables"], message: "SCREEN_INDEX observable refs must be unique per screen" });
    }
    const controlElementRefs = value.controls.flatMap((control) => control.sourceElementRef ? [control.sourceElementRef] : []);
    if (!hasUniqueStrings(controlElementRefs)) {
      context.addIssue({ code: "custom", path: ["controls"], message: "SCREEN_INDEX control browser element refs must be unique per screen" });
    }
    if (!hasUniqueStrings([
      ...value.controls.map((control) => control.generatedLocalId),
      ...value.rejectedControls.map((control) => control.rejectionId),
    ])) {
      context.addIssue({ code: "custom", path: ["rejectedControls"], message: "Accepted and rejected SCREEN_INDEX identities must be disjoint" });
    }
  });

const ExactTextArtifactSchema = z
  .object({
    source: SourceArtifactRefV1Schema,
    text: z.string().max(20_000_000),
  })
  .strict();

const GeneratedSourceSchema = ExactTextArtifactSchema.extend({
  targetRef: z.string().regex(/^TARGET_[A-Z0-9]+(?:_[A-Z0-9]+)*$/),
}).strict();

const AdapterInputSchema = z
  .object({
    productSpec: ProductSpecV1Schema,
    generationTargets: DesignGenerationTargetsV1Schema,
    candidateSelection: StitchTargetCandidateSelectionV1Schema.optional(),
    renderedSemantics: StitchRenderedSemanticsV1Schema.optional(),
    authoritySourceHashes: z.array(Sha256Schema).max(100).refine(hasUniqueStrings, {
      message: "Exact design authority source hashes must be unique",
    }).default([]),
    responseBindings: z.union([
      StitchTargetResponseBindingsV2Schema,
      StitchTargetResponseBindingsV1Schema,
    ]),
    screenIndex: ExactTextArtifactSchema,
    generatedSources: z.array(GeneratedSourceSchema).min(1).max(1_000),
  })
  .strict();

export type StitchScreenIndexV4AdapterInput = z.input<typeof AdapterInputSchema>;

export type StitchScreenIndexV4AdapterResult =
  | Readonly<{
      status: "adapted";
      producerInput: DesignGraphProducerInput;
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  const first = uniqueSorted(left);
  const second = uniqueSorted(right);
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function diagnostic(input: {
  code: string;
  message: string;
  artifactHash?: string;
  reference?: string;
}): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: "adapter",
    severity: "error",
    message: input.message.slice(0, 2_000),
    ...(input.artifactHash ? { artifactHash: input.artifactHash } : {}),
    ...(input.reference ? { reference: input.reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: [],
  });
}

function reject(diagnostics: CompilationDiagnosticV1[]): StitchScreenIndexV4AdapterResult {
  const sorted = sortCompilationDiagnostics(diagnostics);
  return {
    status: "rejected",
    rejectionCodes: uniqueSorted(sorted.map((item) => item.code)),
    diagnostics: sorted,
  };
}

function exactArtifactBytes(
  artifact: z.infer<typeof ExactTextArtifactSchema>,
  diagnostics: CompilationDiagnosticV1[],
): boolean {
  const bytes = Buffer.from(artifact.text, "utf8");
  const hash = createHash("sha256").update(bytes).digest("hex");
  let valid = true;
  if (hash !== artifact.source.hash) {
    valid = false;
    diagnostics.push(diagnostic({
      code: "DESIGN_SOURCE_HASH_MISMATCH",
      message: `Source bytes do not match declared hash for ${artifact.source.locator}`,
      artifactHash: artifact.source.hash,
      reference: artifact.source.locator,
    }));
  }
  if (bytes.byteLength !== artifact.source.byteLength) {
    valid = false;
    diagnostics.push(diagnostic({
      code: "DESIGN_SOURCE_LENGTH_MISMATCH",
      message: `Source byte length does not match declared length for ${artifact.source.locator}`,
      artifactHash: artifact.source.hash,
      reference: artifact.source.locator,
    }));
  }
  return valid;
}

function attrValue(tag: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return tag.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']+)["']`))?.[1];
}

function sourceOpeningTags(text: string): string[] {
  return [...text.matchAll(/<(?:button|a|input|textarea|select)\b[^>]*>/gi)].map((match) => match[0]);
}

function sourceElementOpeningTags(text: string): string[] {
  const tags: string[] = [];
  const pattern = /<[a-z][a-z0-9:-]*\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    let quote = "";
    let braceDepth = 0;
    let escaped = false;
    let end = -1;
    for (let index = pattern.lastIndex; index < text.length; index += 1) {
      const character = text[index]!;
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === quote) {
          quote = "";
        }
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
      } else if (character === "{") {
        braceDepth += 1;
      } else if (character === "}" && braceDepth > 0) {
        braceDepth -= 1;
      } else if (character === ">" && braceDepth === 0) {
        end = index;
        break;
      }
    }
    if (end < 0) break;
    tags.push(text.slice(match.index, end + 1));
    pattern.lastIndex = end + 1;
  }
  return tags;
}

function exactTagForControl(
  sourceText: string,
  control: z.infer<typeof IndexedControlSchema>,
): string | undefined {
  const identityAttribute = control.actionRef ? "data-action-id" : "data-control-id";
  return sourceOpeningTags(sourceText).find((tag) =>
    attrValue(tag, identityAttribute) === control.generatedLocalId);
}

function exactTagForRejectedControl(
  sourceText: string,
  control: z.infer<typeof RejectedControlSchema>,
): string | undefined {
  return sourceOpeningTags(sourceText).find((tag) =>
    attrValue(tag, "data-setfarm-rejected-control") === control.rejectionId);
}

function exactTagForObservable(
  sourceText: string,
  observable: z.infer<typeof IndexedObservableSchema>,
): string | undefined {
  return sourceElementOpeningTags(sourceText).find((tag) =>
    (attrValue(tag, "data-observable-refs") ?? "").split(/\s+/).includes(observable.observableRef));
}

function hasAttribute(tag: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}(?:\\s*=|\\s|>)`, "i").test(tag);
}

function hasTrueAttributeValue(tag: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return attrValue(tag, name) === "true"
    || new RegExp(`\\b${escaped}\\s*=\\s*\\{\\s*true\\s*\\}`, "i").test(tag);
}

function actionStateRefs(action: ProductActionV1): string[] {
  return uniqueSorted([
    ...action.preconditions.map((item) => item.stateRef),
    ...action.stateDeltas.map((item) => item.stateRef),
    ...action.stateDeltas.flatMap((item) => item.valueFrom.kind === "state" ? [item.valueFrom.stateRef] : []),
    ...action.success.stateRefs,
    ...action.failure.stateRefs,
  ]);
}

function actionPersistenceRefs(action: ProductActionV1): string[] {
  return uniqueSorted([
    ...action.persistenceEffects.map((item) => item.policyRef),
    ...(action.success.persistenceRefs ?? []),
    ...(action.failure.persistenceRefs ?? []),
  ]);
}

function mappingKey(actionRef: string, inputField: string): string {
  return `${actionRef}\0${inputField}`;
}

/**
 * Converts only the exact v3 SCREEN_INDEX projection. Every response, generated
 * file, control, action, and action-input pair must have a unique upstream
 * identity. Unindexed/fuzzy/label-derived controls are rejected.
 */
export function adaptExactStitchScreenIndexV4(input: unknown): StitchScreenIndexV4AdapterResult {
  const parsed = AdapterInputSchema.safeParse(input);
  if (!parsed.success) {
    return reject(parsed.error.issues.slice(0, 100).map((issue) => diagnostic({
      code: "DESIGN_SCREEN_INDEX_INPUT_INVALID",
      message: `V3 SCREEN_INDEX adapter input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      reference: issue.path.join("/") || "$",
    })));
  }
  const value = parsed.data;
  const diagnostics: CompilationDiagnosticV1[] = [];

  if (hashCanonicalJson(value.productSpec) !== value.generationTargets.productSpecHash) {
    diagnostics.push(diagnostic({
      code: "DESIGN_TARGET_PRODUCT_SPEC_HASH_MISMATCH",
      message: "GENERATION_TARGETS does not reference the exact ProductSpec bytes",
      reference: value.generationTargets.productSpecHash,
    }));
  }
  if (hashCanonicalJson(value.generationTargets) !== value.responseBindings.generationTargetsHash) {
    diagnostics.push(diagnostic({
      code: "DESIGN_RESPONSE_TARGET_HASH_MISMATCH",
      message: "Stitch response bindings do not reference the exact GENERATION_TARGETS bytes",
      reference: value.responseBindings.generationTargetsHash,
    }));
  }
  if (value.responseBindings.schema === "setfarm.stitch-target-response-bindings.v2" && (
    !value.candidateSelection
    || hashCanonicalJson(value.generationTargets) !== value.candidateSelection.generationTargetsHash
    || hashCanonicalJson(value.candidateSelection) !== value.responseBindings.candidateSelectionHash
    || !value.renderedSemantics
    || hashCanonicalJson(value.renderedSemantics) !== value.responseBindings.renderedSemanticsHash
    || value.candidateSelection.renderedSemanticsHash !== value.responseBindings.renderedSemanticsHash
    || value.renderedSemantics.generationTargetsHash !== value.responseBindings.generationTargetsHash
    || value.renderedSemantics.directResponseEvidenceHash !== value.candidateSelection.directResponseEvidenceHash
  )) {
    diagnostics.push(diagnostic({
      code: "DESIGN_CANDIDATE_SELECTION_HASH_MISMATCH",
      message: "Stitch response bindings do not reference one exact rendered-semantics and candidate-selection authority chain",
      reference: value.responseBindings.candidateSelectionHash,
    }));
  }
  if (value.responseBindings.schema === "setfarm.stitch-target-response-bindings.v1" && (value.candidateSelection || value.renderedSemantics)) {
    diagnostics.push(diagnostic({
      code: "DESIGN_CANDIDATE_SELECTION_VERSION_MISMATCH",
      message: "Historical v1 bindings cannot claim browser-rendered or v2 candidate-selection authority",
    }));
  }
  exactArtifactBytes(value.screenIndex, diagnostics);
  value.generatedSources.forEach((source) => exactArtifactBytes(source, diagnostics));

  let screenIndexValue: unknown;
  try {
    screenIndexValue = JSON.parse(value.screenIndex.text);
  } catch {
    diagnostics.push(diagnostic({
      code: "DESIGN_SCREEN_INDEX_JSON_INVALID",
      message: "SCREEN_INDEX source is not valid JSON",
      artifactHash: value.screenIndex.source.hash,
      reference: value.screenIndex.source.locator,
    }));
    return reject(diagnostics);
  }
  const screenIndexResult = ScreenIndexEntrySchema.array().min(1).max(1_000).safeParse(screenIndexValue);
  if (!screenIndexResult.success) {
    diagnostics.push(...screenIndexResult.error.issues.slice(0, 100).map((issue) => diagnostic({
      code: "DESIGN_SCREEN_INDEX_SCHEMA_INVALID",
      message: `SCREEN_INDEX failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      artifactHash: value.screenIndex.source.hash,
      reference: issue.path.join("/") || "$",
    })));
    return reject(diagnostics);
  }

  const screenIndex = screenIndexResult.data;
  if (!hasUniqueStrings(screenIndex.map((entry) => entry.screenId))) {
    diagnostics.push(diagnostic({ code: "DESIGN_SCREEN_INDEX_SCREEN_ID_DUPLICATE", message: "SCREEN_INDEX screen IDs must be unique" }));
  }
  if (!hasUniqueStrings(screenIndex.map((entry) => entry.title))) {
    diagnostics.push(diagnostic({ code: "DESIGN_SCREEN_INDEX_TITLE_DUPLICATE", message: "SCREEN_INDEX titles must be unique" }));
  }
  if (!hasUniqueStrings(value.generatedSources.map((source) => source.targetRef))) {
    diagnostics.push(diagnostic({ code: "DESIGN_GENERATED_SOURCE_TARGET_DUPLICATE", message: "Generated sources must be unique by target" }));
  }

  const targetById = new Map(value.generationTargets.targets.map((target) => [target.targetId, target]));
  const bindingByTarget = new Map(value.responseBindings.bindings.map((binding) => [binding.targetRef, binding]));
  const indexByScreenId = new Map(screenIndex.map((entry) => [entry.screenId, entry]));
  const sourceByTarget = new Map(value.generatedSources.map((source) => [source.targetRef, source]));
  for (const entry of screenIndex) {
    if (!value.responseBindings.bindings.some((binding) => binding.responseScreenId === entry.screenId)) {
      diagnostics.push(diagnostic({
        code: "DESIGN_SCREEN_INDEX_RESPONSE_UNEXPECTED",
        message: `SCREEN_INDEX contains screen ${entry.screenId} absent from direct Stitch response bindings`,
        artifactHash: value.screenIndex.source.hash,
        reference: entry.screenId,
      }));
    }
  }
  for (const source of value.generatedSources) {
    if (!targetById.has(source.targetRef)) {
      diagnostics.push(diagnostic({
        code: "DESIGN_GENERATED_SOURCE_TARGET_UNRESOLVED",
        message: `Generated source references absent target ${source.targetRef}`,
        artifactHash: source.source.hash,
        reference: source.targetRef,
      }));
    }
  }

  const generationTargets: DesignGraphProducerInput["generationTargets"] = [];
  const converterOutputs: DesignGraphProducerInput["converterOutputs"] = [];
  for (const target of value.generationTargets.targets) {
    const binding = bindingByTarget.get(target.targetId);
    const source = sourceByTarget.get(target.targetId);
    const screen = binding ? indexByScreenId.get(binding.responseScreenId) : undefined;
    if (!binding) {
      diagnostics.push(diagnostic({
        code: "DESIGN_SCREEN_INDEX_RESPONSE_BINDING_MISSING",
        message: `Target ${target.targetId} has no exact response binding`,
        reference: target.targetId,
      }));
      continue;
    }
    if (!screen) {
      diagnostics.push(diagnostic({
        code: "DESIGN_SCREEN_INDEX_SCREEN_MISSING",
        message: `Target ${target.targetId} response ${binding.responseScreenId} is absent from SCREEN_INDEX`,
        reference: target.targetId,
      }));
      continue;
    }
    if (!source) {
      diagnostics.push(diagnostic({
        code: "DESIGN_GENERATED_SOURCE_MISSING",
        message: `Target ${target.targetId} has no exact generated source`,
        reference: target.targetId,
      }));
      continue;
    }
    const bindingV2 = "semanticDomHash" in binding ? binding : undefined;
    const targetSelection = value.candidateSelection?.selections.find((selection) => selection.targetRef === target.targetId);
    const selectedEvaluation = targetSelection?.evaluations.find((evaluation) => evaluation.screenId === binding.responseScreenId);
    const selectedCandidate = value.candidateSelection?.candidates.find((candidate) => candidate.screenId === binding.responseScreenId);
    const renderedCandidate = value.renderedSemantics?.candidates.find((candidate) => candidate.screenId === binding.responseScreenId);
    const exactElementRefsBySemantic = new Map<string, string[]>();
    for (const check of selectedEvaluation?.semanticChecks ?? []) {
      if (check.kind === "screen_title" || check.disposition !== "exact") continue;
      const key = `${check.kind}\0${check.semanticRef}`;
      if (exactElementRefsBySemantic.has(key)) {
        diagnostics.push(diagnostic({
          code: "DESIGN_RENDERED_SEMANTIC_CHECK_DUPLICATE",
          message: `Target ${target.targetId} repeats exact semantic check ${check.kind}:${check.semanticRef}`,
          reference: check.semanticRef,
        }));
      }
      exactElementRefsBySemantic.set(key, check.elementRefs);
    }
    const exactElementRefs = (kind: string, semanticRef: string): string[] =>
      exactElementRefsBySemantic.get(`${kind}\0${semanticRef}`) ?? [];
    const expectedSourceLocator = bindingV2
      ? renderedCandidate?.semanticDom?.locator
      : `stitch/${binding.responseScreenId}.html`;
    if (bindingV2) {
      const exactContractRefs = uniqueSorted([...exactElementRefsBySemantic.values()].flat());
      if (
        !targetSelection
        || targetSelection.status !== "selected"
        || targetSelection.selectedScreenId !== binding.responseScreenId
        || targetSelection.stageId !== binding.stageId
        || selectedEvaluation?.qualificationTier !== "exact_target_semantics"
        || !selectedCandidate
        || selectedCandidate.semanticEvidenceStatus !== "browser_rendered"
        || selectedCandidate.semanticDomHash !== bindingV2.semanticDomHash
        || selectedCandidate.semanticObservationHash !== bindingV2.semanticObservationHash
        || !renderedCandidate
        || renderedCandidate.status !== "rendered"
        || renderedCandidate.stageId !== binding.stageId
        || renderedCandidate.semanticDom?.hash !== bindingV2.semanticDomHash
        || renderedCandidate.observationHash !== bindingV2.semanticObservationHash
        || hashCanonicalJson(renderedCandidate.elements) !== renderedCandidate.observationHash
        || !sameStrings(exactContractRefs, bindingV2.contractElementRefs)
      ) {
        diagnostics.push(diagnostic({
          code: "DESIGN_RENDERED_AUTHORITY_MISMATCH",
          message: `Target ${target.targetId} converter evidence does not match its exact browser-rendered binding`,
          reference: target.targetId,
        }));
      }
      for (const [kind, semanticRefs] of [
        ["surface", [target.surfaceRef]],
        ["action", target.requiredActionRefs],
        ["action_input", target.requiredActionInputs.flatMap((entry) => entry.inputFields.map((field) => `${entry.actionRef}.${field}`))],
        ["accessibility", (target.requiredObservableSelectors ?? []).flatMap((entry) => entry.selector.kind === "accessibility" ? [entry.observableRef] : [])],
      ] as const) {
        for (const semanticRef of semanticRefs) {
          if (exactElementRefs(kind, semanticRef).length !== 1) {
            diagnostics.push(diagnostic({
              code: "DESIGN_RENDERED_SEMANTIC_CHECK_INVALID",
              message: `Target ${target.targetId} requires one exact browser element for ${kind}:${semanticRef}`,
              reference: semanticRef,
            }));
          }
        }
      }
    }
    if (screen.title !== target.expectedScreenTitle || binding.responseTitle !== target.expectedScreenTitle) {
      diagnostics.push(diagnostic({
        code: "DESIGN_SCREEN_INDEX_TITLE_MISMATCH",
        message: `SCREEN_INDEX title ${JSON.stringify(screen.title)} does not equal target title ${JSON.stringify(target.expectedScreenTitle)}`,
        artifactHash: value.screenIndex.source.hash,
        reference: target.targetId,
      }));
    }
    if (screen.file !== source.source.locator) {
      diagnostics.push(diagnostic({
        code: "DESIGN_SCREEN_INDEX_FILE_MISMATCH",
        message: `SCREEN_INDEX file ${screen.file} does not equal exact generated source ${source.source.locator}`,
        artifactHash: source.source.hash,
        reference: target.targetId,
      }));
    }
    if (screen.projection.targetRef !== target.targetId) {
      diagnostics.push(diagnostic({
        code: "DESIGN_PROJECTION_TARGET_MISMATCH",
        message: `SCREEN_INDEX contract projection ${screen.projection.targetRef} does not equal exact target ${target.targetId}`,
        artifactHash: value.screenIndex.source.hash,
        reference: target.targetId,
      }));
    }
    const requiredAccessibilityObservables = (target.requiredObservableSelectors ?? []).flatMap((item) =>
      item.selector.kind === "accessibility" ? [{ ...item, selector: item.selector }] : []);
    const requiredObservableRefs = requiredAccessibilityObservables.map((item) => item.observableRef);
    if (!sameStrings(screen.projection.requiredObservableRefs, requiredObservableRefs)) {
      diagnostics.push(diagnostic({
        code: "DESIGN_PROJECTION_OBSERVABLE_REFS_MISMATCH",
        message: `Target ${target.targetId} SCREEN_INDEX observable projection differs from exact generation targets`,
        artifactHash: value.screenIndex.source.hash,
        reference: target.targetId,
      }));
    }
    for (const kind of ["buttons", "links", "inputs", "textareas", "selects"] as const) {
      if (screen.projection.rawInteractiveCounts[kind] !== screen[kind]) {
        diagnostics.push(diagnostic({
          code: "DESIGN_PROJECTION_RAW_COUNT_MISMATCH",
          message: `Target ${target.targetId} raw ${kind} count differs between SCREEN_INDEX and its contract projection`,
          artifactHash: value.screenIndex.source.hash,
          reference: `${target.targetId}:${kind}`,
        }));
      }
    }

    const surface = value.productSpec.surfaces.find((item) => item.id === target.surfaceRef);
    if (!surface) {
      diagnostics.push(diagnostic({
        code: "DESIGN_TARGET_SURFACE_UNRESOLVED",
        message: `Generation target ${target.targetId} references absent ProductSpec surface ${target.surfaceRef}`,
        reference: target.surfaceRef,
      }));
      continue;
    }
    const expectedActions = new Set(target.requiredActionRefs);
    const expectedInputPairs = new Set(target.requiredActionInputs.flatMap((item) =>
      item.inputFields.map((field) => mappingKey(item.actionRef, field))));
    const actionControls = screen.controls.filter((control) => Boolean(control.actionRef));
    for (const [kind, expectedCount] of [
      ["button", screen.buttons],
      ["link", screen.links],
      ["input", screen.inputs],
      ["textarea", screen.textareas],
      ["select", screen.selects],
    ] as const) {
      const indexedCount = screen.controls.filter((control) => control.kind === kind).length;
      const rejectedCount = screen.rejectedControls.filter((control) => control.kind === kind).length;
      if (indexedCount + rejectedCount !== expectedCount) {
        diagnostics.push(diagnostic({
          code: "DESIGN_CONTROL_INDEX_INCOMPLETE",
          message: `Target ${target.targetId} has ${expectedCount} raw ${kind} element(s) but SCREEN_INDEX accounts for ${indexedCount} accepted and ${rejectedCount} rejected control(s)`,
          artifactHash: value.screenIndex.source.hash,
          reference: `${target.targetId}:${kind}`,
        }));
      }
    }
    const observedActionRefs = actionControls.flatMap((control) => control.actionRef ? [control.actionRef] : []);
    for (const actionRef of expectedActions) {
      const count = observedActionRefs.filter((observed) => observed === actionRef).length;
      if (count !== 1) {
        diagnostics.push(diagnostic({
          code: count === 0 ? "DESIGN_REQUIRED_ACTION_CONTROL_MISSING" : "DESIGN_REQUIRED_ACTION_CONTROL_AMBIGUOUS",
          message: `Target ${target.targetId} requires exactly one ${actionRef} control; observed ${count}`,
          artifactHash: source.source.hash,
          reference: actionRef,
        }));
      }
    }
    for (const actionRef of observedActionRefs) {
      if (!expectedActions.has(actionRef)) {
        diagnostics.push(diagnostic({
          code: "DESIGN_CONTROL_UNEXPECTED",
          message: `Target ${target.targetId} contains undeclared action control ${actionRef}`,
          artifactHash: source.source.hash,
          reference: actionRef,
        }));
      }
    }

    for (const rejectedControl of screen.rejectedControls) {
      if (rejectedControl.generatedSourceLocator !== source.source.locator) {
        diagnostics.push(diagnostic({
          code: "DESIGN_REJECTED_CONTROL_SOURCE_MISMATCH",
          message: `Rejected control ${rejectedControl.rejectionId} generated source locator differs from exact generated source`,
          artifactHash: source.source.hash,
          reference: rejectedControl.rejectionId,
        }));
      }
      if (rejectedControl.sourceLocator !== expectedSourceLocator) {
        diagnostics.push(diagnostic({
          code: "DESIGN_REJECTED_CONTROL_RAW_SOURCE_MISMATCH",
          message: `Rejected control ${rejectedControl.rejectionId} source differs from exact design authority`,
          artifactHash: source.source.hash,
          reference: rejectedControl.rejectionId,
        }));
      }
      if (bindingV2 && (
        !rejectedControl.sourceElementRef
        || rejectedControl.reasonCode !== "outside_canonical_rendered_contract"
      )) {
        diagnostics.push(diagnostic({
          code: "DESIGN_REJECTED_CONTROL_RENDERED_REF_MISSING",
          message: `Rejected control ${rejectedControl.rejectionId} lacks its canonical browser element disposition`,
          artifactHash: source.source.hash,
          reference: rejectedControl.rejectionId,
        }));
      }
      const expectedSelector = `[data-setfarm-rejected-control="${rejectedControl.rejectionId}"]`;
      if (rejectedControl.selector !== expectedSelector) {
        diagnostics.push(diagnostic({
          code: "DESIGN_REJECTED_CONTROL_SELECTOR_MISMATCH",
          message: `Rejected control ${rejectedControl.rejectionId} does not use its exact rejection marker selector`,
          artifactHash: source.source.hash,
          reference: rejectedControl.rejectionId,
        }));
      }
      const exactRejectedTag = exactTagForRejectedControl(source.text, rejectedControl);
      if (!exactRejectedTag) {
        diagnostics.push(diagnostic({
          code: "DESIGN_REJECTED_CONTROL_SOURCE_ELEMENT_MISSING",
          message: `Generated source lacks rejection marker for ${rejectedControl.rejectionId}`,
          artifactHash: source.source.hash,
          reference: rejectedControl.rejectionId,
        }));
      } else if (
        !hasAttribute(exactRejectedTag, "hidden")
        || !hasTrueAttributeValue(exactRejectedTag, "aria-hidden")
        || hasAttribute(exactRejectedTag, "data-action")
        || hasAttribute(exactRejectedTag, "data-action-input")
        || hasAttribute(exactRejectedTag, "onClick")
        || hasAttribute(exactRejectedTag, "onChange")
        || (rejectedControl.kind === "link" && hasAttribute(exactRejectedTag, "href"))
      ) {
        diagnostics.push(diagnostic({
          code: "DESIGN_REJECTED_CONTROL_NOT_NEUTRALIZED",
          message: `Rejected control ${rejectedControl.rejectionId} remains visible, semantic, or actionable in generated source`,
          artifactHash: source.source.hash,
          reference: rejectedControl.rejectionId,
        }));
      }
      if (
        rejectedControl.rawActionRef
        && expectedActions.has(rejectedControl.rawActionRef)
        && (!bindingV2 || exactElementRefs("action", rejectedControl.rawActionRef).includes(rejectedControl.sourceElementRef ?? ""))
      ) {
        diagnostics.push(diagnostic({
          code: "DESIGN_REQUIRED_ACTION_CONTROL_REJECTED",
          message: `Required action ${rejectedControl.rawActionRef} was rejected instead of projected as an exact control`,
          artifactHash: source.source.hash,
          reference: rejectedControl.rawActionRef,
        }));
      }
      for (const mapping of rejectedControl.rawInputBindings ?? []) {
        if (!expectedInputPairs.has(mappingKey(mapping.actionRef, mapping.inputField))) continue;
        if (bindingV2 && !exactElementRefs("action_input", `${mapping.actionRef}.${mapping.inputField}`).includes(rejectedControl.sourceElementRef ?? "")) continue;
        diagnostics.push(diagnostic({
          code: "DESIGN_REQUIRED_INPUT_CONTROL_REJECTED",
          message: `Required input ${mapping.actionRef}.${mapping.inputField} was rejected instead of projected as an exact value provider`,
          artifactHash: source.source.hash,
          reference: `${mapping.actionRef}.${mapping.inputField}`,
        }));
      }
    }

    const requiredObservableByRef = new Map(requiredAccessibilityObservables.map((item) => [
      item.observableRef,
      item.selector,
    ]));
    for (const observableRef of requiredObservableRefs) {
      const count = screen.observables.filter((item) => item.observableRef === observableRef).length;
      if (count !== 1) {
        diagnostics.push(diagnostic({
          code: count === 0
            ? "DESIGN_REQUIRED_OBSERVABLE_MISSING"
            : "DESIGN_REQUIRED_OBSERVABLE_AMBIGUOUS",
          message: `Target ${target.targetId} requires exactly one indexed observable ${observableRef}; observed ${count}`,
          artifactHash: source.source.hash,
          reference: observableRef,
        }));
      }
    }
    for (const observable of screen.observables) {
      const expected = requiredObservableByRef.get(observable.observableRef);
      if (!expected) {
        diagnostics.push(diagnostic({
          code: "DESIGN_OBSERVABLE_UNEXPECTED",
          message: `Target ${target.targetId} indexes undeclared observable ${observable.observableRef}`,
          artifactHash: source.source.hash,
          reference: observable.observableRef,
        }));
        continue;
      }
      if (observable.generatedSourceLocator !== source.source.locator) {
        diagnostics.push(diagnostic({
          code: "DESIGN_OBSERVABLE_SOURCE_MISMATCH",
          message: `Observable ${observable.observableRef} generated source differs from exact target source`,
          artifactHash: source.source.hash,
          reference: observable.observableRef,
        }));
      }
      if (observable.sourceLocator !== expectedSourceLocator) {
        diagnostics.push(diagnostic({
          code: "DESIGN_OBSERVABLE_RAW_SOURCE_MISMATCH",
          message: `Observable ${observable.observableRef} source differs from its exact design authority`,
          artifactHash: source.source.hash,
          reference: observable.observableRef,
        }));
      }
      const expectedSelector = `[data-observable-refs~="${observable.observableRef}"]`;
      if (observable.selector !== expectedSelector) {
        diagnostics.push(diagnostic({
          code: "DESIGN_OBSERVABLE_SELECTOR_MISMATCH",
          message: `Observable ${observable.observableRef} does not use its exact semantic selector`,
          artifactHash: source.source.hash,
          reference: observable.observableRef,
        }));
      }
      const tag = exactTagForObservable(source.text, observable);
      if (!tag) {
        diagnostics.push(diagnostic({
          code: "DESIGN_OBSERVABLE_SOURCE_ELEMENT_MISSING",
          message: `Generated source lacks exact observable marker ${observable.observableRef}`,
          artifactHash: source.source.hash,
          reference: observable.observableRef,
        }));
      } else if (
        attrValue(tag, "role") !== expected.role
        || attrValue(tag, "aria-label") !== expected.name
        || observable.role !== expected.role
        || observable.name !== expected.name
      ) {
        diagnostics.push(diagnostic({
          code: "DESIGN_OBSERVABLE_ACCESSIBILITY_MISMATCH",
          message: `Observable ${observable.observableRef} does not preserve exact role and aria-label`,
          artifactHash: source.source.hash,
          reference: observable.observableRef,
        }));
      }
      if (bindingV2 && (
        !observable.sourceElementRef
        || !exactElementRefs("accessibility", observable.observableRef).includes(observable.sourceElementRef)
        || attrValue(tag ?? "", "data-setfarm-element-ref") !== observable.sourceElementRef
      )) {
        diagnostics.push(diagnostic({
          code: "DESIGN_OBSERVABLE_RENDERED_REF_MISMATCH",
          message: `Observable ${observable.observableRef} does not preserve its exact browser element ref`,
          artifactHash: source.source.hash,
          reference: observable.observableRef,
        }));
      }
    }

    const providerByInputPair = new Map<string, string[]>();
    for (const control of screen.controls) {
      if (control.id !== control.generatedLocalId) {
        diagnostics.push(diagnostic({
          code: "DESIGN_SCREEN_INDEX_CONTROL_ID_MISMATCH",
          message: `SCREEN_INDEX control id and generatedLocalId differ for ${control.generatedLocalId}`,
          artifactHash: source.source.hash,
          reference: control.generatedLocalId,
        }));
      }
      if (control.generatedSourceLocator !== source.source.locator) {
        diagnostics.push(diagnostic({
          code: "DESIGN_SCREEN_INDEX_CONTROL_SOURCE_MISMATCH",
          message: `Control ${control.generatedLocalId} generated source locator differs from exact generated source`,
          artifactHash: source.source.hash,
          reference: control.generatedLocalId,
        }));
      }
      if (control.sourceLocator !== expectedSourceLocator) {
        diagnostics.push(diagnostic({
          code: "DESIGN_SCREEN_INDEX_CONTROL_RAW_SOURCE_MISMATCH",
          message: `Control ${control.generatedLocalId} source differs from exact design authority`,
          artifactHash: source.source.hash,
          reference: control.generatedLocalId,
        }));
      }
      const exactTag = exactTagForControl(source.text, control);
      if (!exactTag) {
        diagnostics.push(diagnostic({
          code: "DESIGN_CONTROL_SOURCE_ELEMENT_MISSING",
          message: `Generated source lacks same identity element for ${control.generatedLocalId}`,
          artifactHash: source.source.hash,
          reference: control.generatedLocalId,
        }));
      }
      if (control.actionRef) {
        if (control.semanticSource !== "data-action" || attrValue(exactTag ?? "", "data-action") !== control.actionRef) {
          diagnostics.push(diagnostic({
            code: "DESIGN_SAME_ELEMENT_ACTION_MISSING",
            message: `Control ${control.generatedLocalId} does not preserve same-element data-action=${control.actionRef}`,
            artifactHash: source.source.hash,
            reference: control.generatedLocalId,
          }));
        }
        if (bindingV2 && (
          !control.sourceElementRef
          || !exactElementRefs("action", control.actionRef).includes(control.sourceElementRef)
          || attrValue(exactTag ?? "", "data-setfarm-element-ref") !== control.sourceElementRef
        )) {
          diagnostics.push(diagnostic({
            code: "DESIGN_ACTION_RENDERED_REF_MISMATCH",
            message: `Control ${control.generatedLocalId} does not preserve exact browser action element ref`,
            artifactHash: source.source.hash,
            reference: control.actionRef,
          }));
        }
      } else if (!["input", "textarea", "select"].includes(control.kind) || control.semanticSource !== "data-action-input") {
        diagnostics.push(diagnostic({
          code: "DESIGN_CONTROL_UNEXPECTED",
          message: `Control ${control.generatedLocalId} has no ProductSpec action or exact input disposition`,
          artifactHash: source.source.hash,
          reference: control.generatedLocalId,
        }));
      }
      for (const mapping of control.inputBindings ?? []) {
        const key = mappingKey(mapping.actionRef, mapping.inputField);
        providerByInputPair.set(key, [...(providerByInputPair.get(key) ?? []), control.generatedLocalId]);
        const sourceMappings = new Set((attrValue(exactTag ?? "", "data-action-input") ?? "").split(/[;,\s]+/).filter(Boolean));
        if (!sourceMappings.has(`${mapping.actionRef}.${mapping.inputField}`)) {
          diagnostics.push(diagnostic({
            code: "DESIGN_INPUT_SOURCE_MAPPING_MISSING",
            message: `Control ${control.generatedLocalId} does not preserve exact data-action-input=${mapping.actionRef}.${mapping.inputField}`,
            artifactHash: source.source.hash,
            reference: `${mapping.actionRef}.${mapping.inputField}`,
          }));
        }
        if (bindingV2 && (
          !control.sourceElementRef
          || !exactElementRefs("action_input", `${mapping.actionRef}.${mapping.inputField}`).includes(control.sourceElementRef)
          || attrValue(exactTag ?? "", "data-setfarm-element-ref") !== control.sourceElementRef
        )) {
          diagnostics.push(diagnostic({
            code: "DESIGN_INPUT_RENDERED_REF_MISMATCH",
            message: `Control ${control.generatedLocalId} does not preserve exact browser input element ref`,
            artifactHash: source.source.hash,
            reference: `${mapping.actionRef}.${mapping.inputField}`,
          }));
        }
        if (!expectedInputPairs.has(key)) {
          diagnostics.push(diagnostic({
            code: "DESIGN_INPUT_MAPPING_UNEXPECTED",
            message: `Control ${control.generatedLocalId} supplies undeclared input ${mapping.actionRef}.${mapping.inputField}`,
            artifactHash: source.source.hash,
            reference: `${mapping.actionRef}.${mapping.inputField}`,
          }));
        }
      }
    }
    for (const expected of expectedInputPairs) {
      const providers = providerByInputPair.get(expected) ?? [];
      if (providers.length !== 1) {
        const [actionRef, inputField] = expected.split("\0");
        diagnostics.push(diagnostic({
          code: providers.length === 0 ? "DESIGN_INPUT_MAPPING_MISSING" : "DESIGN_INPUT_MAPPING_AMBIGUOUS",
          message: `Target ${target.targetId} requires exactly one provider for ${actionRef}.${inputField}; observed ${providers.length}`,
          artifactHash: source.source.hash,
          reference: `${actionRef}.${inputField}`,
        }));
      }
    }

    const outputControls: DesignGraphProducerInput["converterOutputs"][number]["controls"] = [];
    const renderedSourceFor = (elementRef: string | undefined) =>
      bindingV2 && expectedSourceLocator && elementRef
        ? {
            artifactHash: bindingV2.semanticDomHash,
            locator: expectedSourceLocator,
            elementRef,
          }
        : undefined;
    for (const control of screen.controls) {
      const inputMappings = control.inputBindings ?? [];
      if (!control.actionRef) {
        outputControls.push({
          generatedLocalId: control.generatedLocalId,
          kind: control.kind,
          interactive: true,
          ...(control.label ? { label: control.label } : {}),
          source: {
            selector: control.selector,
            ...(renderedSourceFor(control.sourceElementRef)
              ? { renderedSource: renderedSourceFor(control.sourceElementRef) }
              : {}),
          },
          bindings: [{
            disposition: "value_input" as const,
            fields: inputMappings.map((mapping) => ({
              actionRef: mapping.actionRef,
              inputField: mapping.inputField,
            })),
          }],
        });
        continue;
      }
      const action = value.productSpec.actions.find((item) => item.id === control.actionRef);
      if (!action) continue;
      const inputBindings = action.input.fields.flatMap((field) => {
        const providers = providerByInputPair.get(mappingKey(action.id, field.name)) ?? [];
        return providers.length === 1 ? [{
          inputField: field.name,
          valueFrom: {
            kind: "control_value" as const,
            generatedLocalId: providers[0]!,
            targetRef: target.targetId,
          },
        }] : [];
      });
      outputControls.push({
        generatedLocalId: control.generatedLocalId,
        kind: control.kind,
        interactive: true,
        ...(control.label ? { label: control.label } : {}),
        source: {
          selector: control.selector,
          ...(renderedSourceFor(control.sourceElementRef)
            ? { renderedSource: renderedSourceFor(control.sourceElementRef) }
            : {}),
        },
        bindings: [{
          disposition: "action" as const,
          sameElement: {
            generatedLocalId: control.generatedLocalId,
            dataAction: control.actionRef,
            actionRef: control.actionRef,
          },
          routeRef: surface.routeRef,
          inputBindings,
          stateRefs: actionStateRefs(action),
          persistenceRefs: actionPersistenceRefs(action),
          evidenceRefs: uniqueSorted(action.evidenceRefs),
        }],
      });
    }

    generationTargets.push({
      targetId: target.targetId,
      designSurfaceId: target.designSurfaceId,
      surfaceRef: target.surfaceRef,
      requestScreenKey: target.requestScreenKey,
      returnedScreenId: binding.responseScreenId,
      sourceArtifactHash: source.source.hash,
      sourceLocator: source.source.locator,
      ...(renderedSourceFor(exactElementRefs("surface", target.surfaceRef)[0])
        ? { renderedSource: renderedSourceFor(exactElementRefs("surface", target.surfaceRef)[0]) }
        : {}),
    });
    converterOutputs.push({
      targetRef: target.targetId,
      responseScreenId: binding.responseScreenId,
      designSurfaceId: target.designSurfaceId,
      surfaceRef: target.surfaceRef,
      sourceArtifactHash: source.source.hash,
      sourceLocator: source.source.locator,
      controls: outputControls,
      observables: screen.observables.map((observable) => ({
        observableRef: observable.observableRef,
        accessibility: { role: observable.role, name: observable.name },
        source: {
          selector: observable.selector,
          ...(renderedSourceFor(observable.sourceElementRef)
            ? { renderedSource: renderedSourceFor(observable.sourceElementRef) }
            : {}),
        },
      })),
    });
  }

  if (diagnostics.length > 0) return reject(diagnostics);
  return {
    status: "adapted",
    producerInput: {
      productSpec: value.productSpec,
      generationTargets,
      converterOutputs,
      authorityArtifactHashes: uniqueSorted([
        ...value.authoritySourceHashes,
        hashCanonicalJson(value.generationTargets),
        hashCanonicalJson(value.responseBindings),
        ...(value.candidateSelection ? [hashCanonicalJson(value.candidateSelection)] : []),
        ...(value.renderedSemantics ? [hashCanonicalJson(value.renderedSemantics)] : []),
      ]),
    },
    diagnostics: [],
  };
}

export function produceDesignGraphFromExactStitchScreenIndexV4(
  input: unknown,
): StitchScreenIndexV4AdapterResult | DesignGraphProducerResult {
  const adapted = adaptExactStitchScreenIndexV4(input);
  return adapted.status === "adapted"
    ? produceDesignInteractionGraphV1(adapted.producerInput)
    : adapted;
}

// Source-path compatibility for callers compiled against the preceding module.
// The active delivery profile and setup orchestrator use the explicit v4 names.
export type StitchScreenIndexV3AdapterInput = StitchScreenIndexV4AdapterInput;
export type StitchScreenIndexV3AdapterResult = StitchScreenIndexV4AdapterResult;
export const adaptExactStitchScreenIndexV3 = adaptExactStitchScreenIndexV4;
export const produceDesignGraphFromExactStitchScreenIndexV3 = produceDesignGraphFromExactStitchScreenIndexV4;
