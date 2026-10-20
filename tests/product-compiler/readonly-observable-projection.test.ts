import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";
import ts from "typescript";

import { StitchScreenIndexEntryV2Schema, type StitchScreenIndexEntryV2 } from "../../src/product-compiler/schemas/stitch-screen-index-v2.js";
import { validateStitchScreenSourceV2 } from "../../src/product-compiler/stitch-screen-source-validator-v2.js";

// Execute whole genuine converter declarations, never its CLI/module initializer.
// All selected dependencies are pure string/collection operations. The only
// source read is this bounded file; no filesystem/runtime port is supplied.
function converterFunctions() {
  const source = fs.readFileSync(new URL("../../scripts/stitch-to-jsx.mjs", import.meta.url), "utf8");
  const ast = ts.createSourceFile("stitch-to-jsx.mjs", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declarations = new Map<string, ts.Node>();
  const pureConstants = new Set([
    "JSX_ATTRIBUTE_MAP", "JSX_TAG_MAP", "NUMERIC_JSX_ATTRIBUTES",
    "BOOLEAN_JSX_ATTRIBUTES", "RESPONSIVE_STYLE_PREFIXES", "VOID_HTML_TAGS",
  ]);
  for (const statement of ast.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
      declarations.set(statement.name.text, statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && pureConstants.has(declaration.name.text)) {
          declarations.set(declaration.name.text, statement);
        }
      }
    }
  }
  const selected = new Set<string>();
  function include(name: string) {
    if (selected.has(name)) return;
    const declaration = declarations.get(name);
    assert.ok(declaration, `missing genuine declaration ${name}`);
    selected.add(name);
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        assert.ok(!["fs", "process", "fetch", "require", "setTimeout"].includes(node.text), `non-inert dependency ${node.text}`);
        if (declarations.has(node.text)) include(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(declaration);
  }
  const roots = ["annotateObservableElements", "annotateInteractiveElements", "htmlToJsx"];
  roots.forEach(include);
  const bodies = [...new Set([...selected].map((name) => declarations.get(name)!))]
    .sort((left, right) => left.pos - right.pos)
    .map((node) => node.getText(ast)).join("\n");
  return vm.runInNewContext(`${bodies}\n({ ${roots.join(", ")} })`, {}, { timeout: 1_000 });
}

const converter = converterFunctions();
const displayElementRef = "E000007";
const requiredObservable = {
  observableRef: "OBS_DISPLAY_STATE", actionRef: "ACT_UPDATE_STATE",
  selectorKind: "accessibility", surfaceRef: "SURF_STATE", role: "textbox",
  name: "Display state", evidenceRef: "EVID_DISPLAY_STATE", elementRefs: new Set([displayElementRef]),
  readonlyDisplay: { kind: "input", inputType: "text", readOnly: true },
};

function syntheticProjection(tagName = "input", inputType: string | null = "text") {
  // Synthetic validated-input authority for a pure unit test. This is NOT a
  // browser capture/receipt or proof of the private loader's hash validation.
  return {
    authorityMode: "browser_rendered_v2", requiredObservables: [requiredObservable],
    readonlyObservableDisplays: new Map([[displayElementRef, { tagName, inputType, readOnly: true }]]),
    expectedActionRefs: new Set(), expectedInputPairs: new Set(),
    actionElementRefs: new Map(), inputElementRefs: new Map(), controlElementRefs: new Map(),
    controlByElementRef: new Map(),
  };
}

function screenFor(observables: any[], rejectedControls: any[] = []): StitchScreenIndexEntryV2 {
  const inputs = rejectedControls.length + new Set(observables.filter((observable) => observable.readonlyDisplay).map((observable) => observable.sourceElementRef)).size;
  return {
    screenId: "screen-state", title: "State", componentName: "StateScreen", file: "src/screens/StateScreen.tsx",
    buttons: 0, links: 0, inputs, textareas: 0, selects: 0,
    actions: [], controls: [],
    observables: observables.map((observable) => ({
      ...observable, sourceLocator: "stitch/rendered-dom-v2/state.html",
      generatedSourceLocator: "src/screens/StateScreen.tsx",
      selector: `[data-observable-refs~="${observable.observableRef}"]`,
    })),
    rejectedControls: rejectedControls.map((control) => ({
      ...control, sourceLocator: "stitch/rendered-dom-v2/state.html",
      generatedSourceLocator: "src/screens/StateScreen.tsx",
      selector: `[data-setfarm-rejected-control="${control.rejectionId}"]`,
    })),
    projection: {
      schema: "setfarm.stitch-screen-projection.v2", mode: "contract_only", targetRef: "TARGET_STATE",
      authoritySchema: "setfarm.design-interaction-graph.v2",
      rawInteractiveCounts: { buttons: 0, links: 0, inputs, textareas: 0, selects: 0 },
      requiredObservableRefs: observables.map((observable) => observable.observableRef),
    },
    componentApi: { schema: "setfarm.generated-screen-component-api.v1", actionsPropName: "actions", actionBindings: [], inputTransports: [] },
  };
}

describe("readonly observable projection through genuine inert converter functions", () => {
  for (const [kind, displayHtml, tagName, inputType] of [
    ["text input", '<input type="text" readonly="" value="Open"', "input", "text"],
    ["default input", '<input readonly="" value="Open"', "input", "text"],
  ] as const) {
    it(`preserves exact ${kind} display while neutralizing an adjacent undeclared input`, () => {
      const projection = syntheticProjection(tagName, inputType);
      const html = `<main>${displayHtml} data-setfarm-element-ref="${displayElementRef}">${tagName === "textarea" ? "Open</textarea>" : ""}<input aria-label="Undeclared" data-setfarm-element-ref="E000008"></main>`;
      const observable = converter.annotateObservableElements(html, projection);
      const projected = converter.annotateInteractiveElements(observable.html, projection, observable.readonlyDisplayElementRefs);
      const displayTag = projected.html.match(new RegExp(`<${tagName}[^>]*data-setfarm-element-ref="${displayElementRef}"[^>]*>`))?.[0];
      assert.ok(displayTag);
      assert.match(displayTag, /role="textbox"/);
      assert.match(displayTag, /aria-label="Display state"/);
      assert.match(displayTag, /readonly=""/);
      assert.doesNotMatch(displayTag, /data-setfarm-rejected-control|hidden|disabled|data-action-id|data-control-id|onChange/);
      assert.equal(projected.valueControls.length, 0);
      assert.equal(projected.actions.length, 0);
      assert.equal(projected.actionInputFields.size, 0);
      assert.equal(projected.rejectedControls.some((control: any) => control.sourceElementRef === displayElementRef), false);
      assert.equal(projected.rejectedControls.length, 1);
      assert.equal(projected.rejectedControls[0].sourceElementRef, "E000008");
      const sourceText = `export function StateScreen() { return (${converter.htmlToJsx(projected.html)}); }`;
      assert.match(sourceText, /readOnly=\{true\}/);
      const screen = StitchScreenIndexEntryV2Schema.parse(screenFor(observable.observables, projected.rejectedControls));
      assert.equal(screen.inputs, 2);
      const result = validateStitchScreenSourceV2({ screen, sourceText });
      assert.equal(result.status, "valid", JSON.stringify(result));
    });
  }

  it("exposes the independent unindexed readonly-display validator refusal", () => {
    const observable = converter.annotateObservableElements(
      `<input type="text" readOnly="true" value="Open" data-setfarm-element-ref="${displayElementRef}">`, syntheticProjection(),
    );
    const sourceText = `export function StateScreen() { return (${converter.htmlToJsx(observable.html)}); }`;
    const result = validateStitchScreenSourceV2({ screen: screenFor(observable.observables), sourceText });
    assert.equal(result.status, "valid", JSON.stringify(result));
  });

  it("accounts the original raw input count for one exact indexed readonly display", () => {
    const observable = { ...requiredObservable, sourceElementRef: displayElementRef };
    const screen = screenFor([observable]);
    // Private elementRefs is not public screen metadata.
    delete (screen.observables[0] as any).elementRefs;
    const result = StitchScreenIndexEntryV2Schema.safeParse(screen);
    assert.equal(result.success, true, JSON.stringify(result));
    if (result.success) assert.equal(result.data.inputs, 1);
  });

  it("does not launder malformed original attributes or unsupported controls through observable annotation", () => {
    const attrs = ' type="text" readonly="" value="Open" data-setfarm-element-ref="E000007"';
    const variants = [
      attrs.replace('readonly=""', ""),
      attrs.replace('readonly=""', 'readonly="false"'),
      attrs.replace('readonly=""', "readOnly={isReadonly}"),
      attrs.replace('readonly=""', 'readonly="" readonly=""'),
      attrs.replace('type="text"', 'type="number"'),
      attrs.replace('type="text"', 'type="text" type="text"'),
      attrs.replace('type="text"', "type={inputType}"),
      `${attrs} data-setfarm-element-ref="E000007"`,
      `${attrs} data-observable-refs="OBS_DISPLAY_STATE OBS_DISPLAY_STATE"`,
      `${attrs} data-observable-refs="OBS_DISPLAY_STATE" data-observable-refs="OBS_DISPLAY_STATE"`,
      `${attrs} data-observable-refs="OBS_UNKNOWN"`,
      `${attrs} role="textbox" role="textbox"`,
      `${attrs} aria-label="Display state" aria-label="Display state"`,
      `${attrs} role="button"`,
      `${attrs} aria-label="Other"`,
      `${attrs} onChange="noop"`,
      `${attrs} onKeyDown="noop"`,
      `${attrs} {...extra}`,
      ...["data-action", "data-action-input", "data-action-id", "data-control-id", "data-control-slot", "data-setfarm-rejected-control"].map((name) => `${attrs} ${name}=""`),
    ];
    for (const sourceAttrs of variants) {
      const projection = syntheticProjection();
      const observable = converter.annotateObservableElements(`<input${sourceAttrs}>`, projection);
      const projected = converter.annotateInteractiveElements(observable.html, projection, observable.readonlyDisplayElementRefs);
      assert.equal(projected.rejectedControls.length, 1, sourceAttrs);
      assert.equal(observable.observables[0].readonlyDisplay, undefined, sourceAttrs);
      assert.equal(projected.valueControls.length, 0);
    }
    for (const html of [
      '<textarea readonly="" data-setfarm-element-ref="E000007">Open</textarea>',
      '<select readonly="" data-setfarm-element-ref="E000007"><option>Open</option></select>',
    ]) {
      const projection = syntheticProjection();
      const observable = converter.annotateObservableElements(html, projection);
      const projected = converter.annotateInteractiveElements(observable.html, projection, observable.readonlyDisplayElementRefs);
      assert.equal(projected.rejectedControls.length, 1);
      assert.equal(observable.observables[0].readonlyDisplay, undefined);
    }
  });

  it("requires native v2 proof even for exact readonly observable markup", () => {
    const html = '<input readonly="" data-setfarm-element-ref="E000007">';
    for (const mutation of [
      (projection: any) => { projection.readonlyObservableDisplays.clear(); },
      (projection: any) => { projection.readonlyObservableDisplays.get(displayElementRef).readOnly = false; },
      (projection: any) => { projection.readonlyObservableDisplays.get(displayElementRef).inputType = "number"; },
      (projection: any) => { projection.authorityMode = "browser_rendered_v1"; },
      (projection: any) => { projection.inputElementRefs.set("ACT_OTHER.field", new Set([displayElementRef])); },
    ]) {
      const projection = syntheticProjection();
      mutation(projection);
      // Input binding consumption is an independent strict gate. This overlap
      // case must fail conversion rather than invent an input transport.
      if (projection.inputElementRefs.size > 0) {
        const observable = converter.annotateObservableElements(html, projection);
        assert.throws(() => converter.annotateInteractiveElements(observable.html, projection, observable.readonlyDisplayElementRefs), /not projected exactly once/);
      } else {
        const observable = converter.annotateObservableElements(html, projection);
        const projected = converter.annotateInteractiveElements(observable.html, projection, observable.readonlyDisplayElementRefs);
        assert.equal(projected.rejectedControls.length, 1);
      }
    }
  });

  it("preserves original hidden visibility and indexes multiple exact observables once", () => {
    const projection = syntheticProjection();
    projection.requiredObservables.push({ ...requiredObservable, observableRef: "OBS_DISPLAY_RELOADED" });
    const observable = converter.annotateObservableElements('<input type="text" readonly="" hidden="true" aria-hidden="true" value="Open" data-setfarm-element-ref="E000007">', projection);
    const projected = converter.annotateInteractiveElements(observable.html, projection, observable.readonlyDisplayElementRefs);
    assert.equal(projected.rejectedControls.length, 0);
    assert.equal(projected.valueControls.length, 0);
    assert.match(projected.html, /hidden="true" aria-hidden="true"/);
    assert.match(projected.html, /data-observable-refs="OBS_DISPLAY_RELOADED OBS_DISPLAY_STATE"/);
    const screen = StitchScreenIndexEntryV2Schema.parse(screenFor(observable.observables));
    assert.equal(screen.inputs, 1);
    const sourceText = `export function StateScreen() { return (${converter.htmlToJsx(projected.html)}); }`;
    assert.equal(validateStitchScreenSourceV2({ screen, sourceText }).status, "valid");
  });
});
