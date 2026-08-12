import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adaptLegacyPlan } from "../../src/product-compiler/adapters/legacy-plan.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { produceProductSpecV1 } from "../../src/product-compiler/producers/product-spec.js";
import { renderLegacyPrd } from "../../src/product-compiler/renderers/legacy-prd.js";
import {
  ProductSpecV1EnglishWriteSchema,
  ProductSpecV1Schema,
  type ProductSpecV1,
} from "../../src/product-compiler/schemas/product-spec-v1.js";
import { validateOutput as validateLegacyPlanOutput } from "../../src/installer/steps/01-plan/guards.js";
import { buildMinimalValidV3ProductSpec } from "./fixtures/minimal-valid-contract.js";

const UTILITY_TASK = [
  "Build a compact single-page status utility called Pulse Tile.",
  "It has a refresh button and a ready/paused toggle.",
  "Keep status in localStorage.",
  "Do not add navigation or analytics.",
].join(" ");

const OPERATIONS_TASK = [
  "Build a local inventory operations app called Field Stock.",
  "It must list, create, edit, save, and delete items.",
  "Persist the item records in localStorage.",
].join(" ");

const GAME_TASK = [
  "Build a browser game called Side Step.",
  "The player can start, move left and right, pause and resume, and restart.",
  "The game tracks score and stores high score in localStorage.",
].join(" ");

function produced(task: string): ProductSpecV1 {
  const result = produceProductSpecV1({ task });
  assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
  return result.productSpec;
}

function assertCompleteActions(spec: ProductSpecV1): void {
  const surfaces = new Set(spec.surfaces.map((surface) => surface.id));
  const states = new Set(spec.states.map((state) => state.id));
  const policies = new Set(spec.persistencePolicies.map((policy) => policy.id));
  const evidence = new Set(spec.evidencePredicates.map((predicate) => predicate.id));
  assert.ok(spec.actions.length > 0);
  for (const action of spec.actions) {
    assert.ok(action.surfaceRefs.length > 0, `${action.id} has no surface`);
    assert.ok(action.surfaceRefs.every((reference) => surfaces.has(reference)), `${action.id} has unresolved surface`);
    assert.ok(action.input && Array.isArray(action.input.fields), `${action.id} has no typed input contract`);
    assert.ok(action.stateDeltas.length > 0, `${action.id} has no state delta`);
    assert.ok(action.stateDeltas.every((delta) => states.has(delta.stateRef)), `${action.id} has unresolved state`);
    assert.ok(action.persistenceEffects.every((effect) => policies.has(effect.policyRef)), `${action.id} has unresolved persistence`);
    assert.ok(
      action.persistenceEffects.every((effect) => effect.statePaths.length > 0),
      `${action.id} has incomplete persistence state paths`,
    );
    assert.deepEqual(
      [...(action.success.persistenceRefs ?? [])].sort(),
      [...new Set(action.persistenceEffects.map((effect) => effect.policyRef))].sort(),
      `${action.id} success persistence refs do not match its exact effects`,
    );
    const durableMutationCount = action.persistenceEffects.filter((effect) => effect.operation !== "read").length;
    assert.ok(
      action.evidenceRefs.length >= 2 + Math.min(durableMutationCount, 1),
      `${action.id} has incomplete action/state/persistence evidence`,
    );
    assert.deepEqual(
      Object.keys(action.evidenceScenario.targetInputValues).sort(),
      action.input.fields.map((field) => field.name).sort(),
      `${action.id} has incomplete exact evidence inputs`,
    );
    assert.ok(action.evidenceRefs.every((reference) => evidence.has(reference)), `${action.id} has unresolved evidence`);
  }
}

function parseLegacyPlanOutput(output: string) {
  const field = (key: string) => output.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1]?.trim() ?? "";
  return {
    contract_schema_version: field("CONTRACT_SCHEMA_VERSION"),
    status: field("STATUS"),
    project_name: field("PROJECT_NAME"),
    project_slug: field("PROJECT_SLUG"),
    platform: field("PLATFORM"),
    tech_stack: field("TECH_STACK"),
    ui_language: field("UI_LANGUAGE"),
    db_required: field("DB_REQUIRED"),
    design_required: field("DESIGN_REQUIRED"),
    ui_vision_summary: field("UI_VISION_SUMMARY"),
    prd: output.match(/^PRD:\n([\s\S]*)$/m)?.[1] ?? "",
  };
}

describe("typed-first ProductSpec producer", () => {
  it("deterministically compiles a complete utility contract from task semantics", () => {
    const first = produceProductSpecV1({ task: UTILITY_TASK });
    const second = produceProductSpecV1({ task: UTILITY_TASK });
    assert.deepEqual(second, first);
    assert.equal(first.status, "produced");
    assert.equal(first.productClass, "utility");
    assert.equal(first.productSpec.product.name, "Pulse Tile");
    assert.equal(first.productSpec.product.goals.some((goal) => goal.statement.includes("refresh button")), true);
    assert.equal(first.productSpec.product.nonGoals.some((nonGoal) => nonGoal.statement.includes("Do not add navigation")), true);
    assert.ok(first.productSpec.actions.some((action) => action.id === "ACT_REFRESH_STATUS"));
    assert.ok(first.productSpec.actions.some((action) => action.id === "ACT_SET_PAUSED"));
    assert.equal(first.productSpec.persistencePolicies[0]?.kind, "local_storage");
    assert.deepEqual(ProductSpecV1Schema.parse(first.productSpec), first.productSpec);
    assertCompleteActions(first.productSpec);
  });

  it("rejects source text that requires an approved English translation", () => {
    const localizedName = "\u00c7\u0131\u011f \u00d6z\u00fc";
    const result = produceProductSpecV1({
      task: [
        `Build a compact single-page status utility called ${localizedName}.`,
        "It has a refresh button and a ready/paused toggle.",
        "Keep status in localStorage.",
      ].join(" "),
    });

    assert.equal(result.status, "rejected");
    assert.equal(result.diagnostics.some((item) =>
      item.code === "PRODUCT_SPEC_ENGLISH_TRANSLATION_REQUIRED"
      && item.reference === "task"), true);
    assert.equal("productSpec" in result, false);

    const named = produceProductSpecV1({
      task: UTILITY_TASK,
      productName: `English marker ${String.fromCodePoint(0x03a9)}`,
    });
    assert.equal(named.status, "rejected");
    assert.equal(named.diagnostics.some((item) =>
      item.code === "PRODUCT_SPEC_ENGLISH_TRANSLATION_REQUIRED"
      && item.reference === "productName"), true);
  });

  it("compiles explicit CRUD operations without inventing unrequested feature actions", () => {
    const spec = produced(OPERATIONS_TASK);
    assert.equal(spec.product.class, "operations");
    assert.equal(spec.product.name, "Field Stock");
    assert.deepEqual(
      spec.actions.map((action) => action.id),
      ["ACT_LOAD_ITEMS", "ACT_CREATE_ITEM", "ACT_SELECT_ITEM", "ACT_SAVE_ITEM", "ACT_DELETE_ITEM"],
    );
    assert.equal(spec.actions.some((action) => /FILTER|SEARCH|ASSIGN/.test(action.id)), false);
    assert.equal(spec.persistencePolicies.some((policy) => policy.kind === "local_storage"), true);
    assertCompleteActions(spec);
  });

  it("compiles browser-game control, timing, state, and high-score persistence", () => {
    const spec = produced(GAME_TASK);
    assert.equal(spec.product.class, "game");
    assert.equal(spec.product.name, "Side Step");
    assert.ok(spec.actions.some((action) => action.id === "ACT_MOVE_LEFT"));
    assert.ok(spec.actions.some((action) => action.id === "ACT_MOVE_RIGHT"));
    assert.ok(spec.actions.some((action) => action.id === "ACT_ADVANCE_GAME" && action.trigger.kind === "timer"));
    assert.ok(spec.actions.some((action) => action.id === "ACT_RECORD_HIGH_SCORE"));
    assert.equal(spec.persistencePolicies.some((policy) => policy.id === "PERSIST_GAME_HIGH_SCORE" && policy.kind === "local_storage"), true);
    assert.equal(spec.product.goals.some((goal) => goal.statement.includes("pause and resume")), true);
    assertCompleteActions(spec);
  });

  it("rejects conflicting product classes instead of choosing a convenient template", () => {
    const result = produceProductSpecV1({
      task: "Build a compact single-page inventory operations utility that can list, create, and edit items in localStorage, with refresh and a ready/paused toggle.",
    });
    assert.equal(result.status, "rejected");
    assert.equal(result.diagnostics.some((item) => item.code === "PRODUCT_SPEC_CLASS_AMBIGUOUS"), true);
    assert.equal("productSpec" in result, false);
  });

  it("rejects incomplete and unsupported semantics with actionable diagnostics", () => {
    const incomplete = produceProductSpecV1({ task: "Build a browser game with a score." });
    assert.equal(incomplete.status, "rejected");
    assert.equal(incomplete.productClass, "game");
    assert.equal(incomplete.diagnostics.some((item) => item.code === "PRODUCT_SPEC_GAME_MOVEMENT_MISSING"), true);
    assert.equal(incomplete.diagnostics.some((item) => item.code === "PRODUCT_SPEC_GAME_PAUSE_MISSING"), true);

    const unsupported = produceProductSpecV1({
      task: "Build an inventory operations app with list, create, edit, database persistence, login, and role-based access.",
    });
    assert.equal(unsupported.status, "rejected");
    assert.equal(unsupported.diagnostics.some((item) => item.code === "PRODUCT_SPEC_TASK_FEATURE_UNSUPPORTED"), true);

    const databaseOnly = produceProductSpecV1({
      task: "Build an inventory operations app with list, create, edit, save, and delete using PostgreSQL database persistence.",
    });
    assert.equal(databaseOnly.status, "rejected");
    assert.equal(
      databaseOnly.diagnostics.some((item) => item.code === "PRODUCT_SPEC_OPERATIONS_DATABASE_PROFILE_UNSUPPORTED"),
      true,
    );
  });

  it("rejects an explicit unsupported class and an otherwise unclassifiable task", () => {
    const unsupported = produceProductSpecV1({ task: "Publish articles.", productClass: "content" });
    assert.equal(unsupported.status, "rejected");
    assert.equal(unsupported.diagnostics[0]?.code, "PRODUCT_SPEC_CLASS_UNSUPPORTED");

    const missing = produceProductSpecV1({ task: "Make something useful." });
    assert.equal(missing.status, "rejected");
    assert.equal(missing.diagnostics[0]?.code, "PRODUCT_SPEC_CLASS_MISSING");
  });

  it("fails closed when exact evidence scenario inputs lose their action keys or value types", () => {
    const spec = structuredClone(produced(UTILITY_TASK));
    const paused = spec.actions.find((action) => action.id === "ACT_SET_PAUSED")!;
    paused.evidenceScenario.targetInputValues = {};
    assert.equal(ProductSpecV1Schema.safeParse(spec).success, false);

    paused.evidenceScenario.targetInputValues = { paused: "true" };
    assert.equal(ProductSpecV1Schema.safeParse(spec).success, false);
  });
});

describe("legacy PRD compatibility renderer", () => {
  it("keeps historical ProductSpec V1 reads compatible while new writes fail closed", () => {
    const legacy = structuredClone(buildMinimalValidV3ProductSpec());
    const legacyLanguage = `English ${String.fromCodePoint(0x0416)}`;
    legacy.delivery.uiLanguage = legacyLanguage;

    assert.equal(ProductSpecV1Schema.safeParse(legacy).success, true);
    assert.equal(ProductSpecV1EnglishWriteSchema.safeParse(legacy).success, false);
    assert.throws(
      () => renderLegacyPrd(legacy),
      /PRODUCT_SPEC_UI_LANGUAGE_MUST_BE_ENGLISH|PRODUCT_SPEC_ENGLISH_TEXT_REQUIRED/,
    );

    const markerBypass = structuredClone(buildMinimalValidV3ProductSpec());
    markerBypass.product.name = `English marker ${String.fromCodePoint(0x03a9)}`;
    assert.equal(ProductSpecV1Schema.safeParse(markerBypass).success, true);
    assert.equal(ProductSpecV1EnglishWriteSchema.safeParse(markerBypass).success, false);
    assert.throws(
      () => renderLegacyPrd(markerBypass),
      /PRODUCT_SPEC_ENGLISH_TEXT_REQUIRED/,
    );
  });

  it("renders deterministically from the typed value and round-trips through the exact adapter", () => {
    const spec = produced(OPERATIONS_TASK);
    const first = renderLegacyPrd(spec);
    const second = renderLegacyPrd(spec);
    assert.equal(second, first);
    assert.match(first, /^CONTRACT_SCHEMA_VERSION: setfarm\.plan\.v2\.2/m);
    assert.match(first, /^### ACTION: ACT_SAVE_ITEM$/m);
    assert.match(first, /^- Surface Bound: SURF_ITEM_EDITOR$/m);
    assert.ok(first.includes(`\`\`\`product-spec-v1\n${canonicalJsonStringify(spec)}\n\`\`\``));

    const adapted = adaptLegacyPlan({
      source: {
        schema: "setfarm.source-artifact-ref.v1",
        hash: "a".repeat(64),
        mediaType: "text/markdown",
        locator: "plan/legacy-prd.md",
        byteLength: Buffer.byteLength(first),
      },
      text: first,
    });
    assert.deepEqual(adapted.candidate, spec);
    assert.deepEqual(adapted.diagnostics, []);
    const validation = validateLegacyPlanOutput(parseLegacyPlanOutput(first));
    assert.equal(validation.ok, true, validation.errors.join("; "));
  });

  it("keeps UI language canonical and rejects non-English compatibility overrides", () => {
    const spec = produced(OPERATIONS_TASK);

    assert.match(renderLegacyPrd(spec, { uiLanguage: "English" }), /^UI_LANGUAGE: English$/m);
    assert.throws(
      () => renderLegacyPrd(spec, { uiLanguage: "Spanish" }),
      /LEGACY_PRD_UI_LANGUAGE_MUST_BE_ENGLISH/,
    );
  });

  it("reflects typed changes in both prose and the structured projection", () => {
    const spec = produced(UTILITY_TASK);
    const changed = structuredClone(spec);
    changed.product.goals[0]!.statement = "Operator must see the requested status immediately.";
    const rendered = renderLegacyPrd(changed);
    assert.ok(rendered.includes("GOAL_REQUEST_001: Operator must see the requested status immediately."));

    const adapted = adaptLegacyPlan({
      source: {
        schema: "setfarm.source-artifact-ref.v1",
        hash: "b".repeat(64),
        mediaType: "text/markdown",
        locator: "plan/changed.md",
        byteLength: Buffer.byteLength(rendered),
      },
      text: rendered,
    });
    assert.equal(adapted.candidate?.product.goals[0]?.statement, changed.product.goals[0]?.statement);
  });

  it("rejects a non-canonical typed projection even when its JSON value is valid", () => {
    const spec = produced(UTILITY_TASK);
    const rendered = renderLegacyPrd(spec);
    const nonCanonical = rendered.replace(
      canonicalJsonStringify(spec),
      JSON.stringify(spec, null, 2),
    );
    const validation = validateLegacyPlanOutput(parseLegacyPlanOutput(nonCanonical));
    assert.equal(validation.ok, false);
    assert.equal(validation.errors.some((error) => error.includes("Canonical JSON")), true);
  });

  it("refuses to render invalid ProductSpec input", () => {
    assert.throws(
      () => renderLegacyPrd({ schema: "setfarm.product-spec.v1" }),
      /Invalid input|expected/i,
    );
  });
});
