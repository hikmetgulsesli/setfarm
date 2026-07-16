import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  StitchScreenIndexEntryV2Schema,
  type StitchScreenIndexEntryV2,
} from "../../src/product-compiler/schemas/stitch-screen-index-v2.js";
import {
  validateStitchScreenSourceV2,
  type StitchScreenSourceDiagnosticCodeV2,
} from "../../src/product-compiler/stitch-screen-source-validator-v2.js";

function nativeScreen(): StitchScreenIndexEntryV2 {
  const physicalControl = {
    id: "save-record-1",
    generatedLocalId: "save-record-1",
    kind: "button" as const,
    label: "Save",
    semanticSource: "data-action" as const,
    actionRef: "ACT_SAVE_RECORD",
    controlSlotRef: "CSLOT_SAVE_RECORD_PRIMARY",
    surfaceRef: "SURF_EDITOR",
    physicalControlRef: "CTRL_SAVE_RECORD_PRIMARY",
    affectedSurfaceRefs: ["SURF_EDITOR"],
    tagName: "button",
    nativeControlKind: "button" as const,
    role: null,
    ariaLabel: null,
    interactiveRole: false,
    href: null,
    sourceElementRef: "E000001",
    sourceLocator: "stitch/rendered-dom/screen-editor.html",
    generatedSourceLocator: "src/screens/EditorScreen.tsx",
    selector: "[data-action-id=\"save-record-1\"]",
  };
  const { generatedSourceLocator: _generatedSourceLocator, ...action } = physicalControl;
  return StitchScreenIndexEntryV2Schema.parse({
    screenId: "screen-editor",
    title: "Editor",
    componentName: "EditorScreen",
    file: "src/screens/EditorScreen.tsx",
    buttons: 1,
    inputs: 1,
    textareas: 0,
    selects: 0,
    links: 0,
    actions: [action],
    controls: [
      physicalControl,
      {
        id: "record-fields-1",
        generatedLocalId: "record-fields-1",
        kind: "input",
        label: "Record fields",
        semanticSource: "data-action-input",
        inputBindings: [
          { actionRef: "ACT_SAVE_RECORD", inputField: "title" },
          { actionRef: "ACT_SAVE_RECORD", inputField: "description" },
        ],
        sourceElementRef: "E000002",
        sourceLocator: "stitch/rendered-dom/screen-editor.html",
        generatedSourceLocator: "src/screens/EditorScreen.tsx",
        selector: "[data-control-id=\"record-fields-1\"]",
      },
    ],
    observables: [{
      observableRef: "OBS_RECORD_SAVED",
      actionRef: "ACT_SAVE_RECORD",
      selectorKind: "accessibility",
      surfaceRef: "SURF_EDITOR",
      role: "status",
      name: "Record saved",
      evidenceRef: "EVID_RECORD_SAVED",
      sourceElementRef: "E000003",
      sourceLocator: "stitch/rendered-dom/screen-editor.html",
      generatedSourceLocator: "src/screens/EditorScreen.tsx",
      selector: "[data-observable-refs~=\"OBS_RECORD_SAVED\"]",
    }],
    projection: {
      schema: "setfarm.stitch-screen-projection.v2",
      mode: "contract_only",
      targetRef: "TARGET_EDITOR",
      authoritySchema: "setfarm.design-interaction-graph.v2",
      rawInteractiveCounts: {
        buttons: 1,
        links: 0,
        inputs: 1,
        textareas: 0,
        selects: 0,
      },
      requiredObservableRefs: ["OBS_RECORD_SAVED"],
    },
    componentApi: {
      schema: "setfarm.generated-screen-component-api.v1",
      actionsPropName: "actions",
      actionBindings: [{
        generatedLocalId: "save-record-1",
        actionRef: "ACT_SAVE_RECORD",
        inputFields: ["description", "title"],
      }],
      inputTransports: [
        {
          actionInputRef: "ACT_SAVE_RECORD.description",
          generatedControlId: "record-fields-1",
          stateKey: "ACT_SAVE_RECORD.description",
        },
        {
          actionInputRef: "ACT_SAVE_RECORD.title",
          generatedControlId: "record-fields-1",
          stateKey: "ACT_SAVE_RECORD.title",
        },
      ],
    },
    rejectedControls: [],
  });
}

function exactSource(): string {
  return [
    "export function EditorScreen({ actions }: { actions?: Record<string, () => void> }) {",
    "  return (",
    "    <main title={\"1 > 0\"}>",
    "      <button",
    "        data-action-id={\"save-record-1\"}",
    "        data-action=\"ACT_SAVE_RECORD\"",
    "        data-control-slot=\"CSLOT_SAVE_RECORD_PRIMARY\"",
    "        data-setfarm-element-ref=\"E000001\"",
    "        onClick={() => actions?.[\"save-record-1\"]?.({ \"description\": actionInputValues[\"ACT_SAVE_RECORD.description\"], \"title\": actionInputValues[\"ACT_SAVE_RECORD.title\"] })}",
    "      >Save</button>",
    "      <input",
    "        data-control-id=\"record-fields-1\"",
    "        data-action-input=\"ACT_SAVE_RECORD.title; ACT_SAVE_RECORD.description\"",
    "        data-setfarm-element-ref=\"E000002\"",
    "        value={actionInputValues[\"ACT_SAVE_RECORD.description\"]}",
    "        onChange={(event) => { const nextValue = event.currentTarget.value; setActionInputValues((current) => ({ ...current, \"ACT_SAVE_RECORD.description\": nextValue, \"ACT_SAVE_RECORD.title\": nextValue })); }}",
    "      />",
    "      <output",
    "        role=\"status\"",
    "        aria-label=\"Record saved\"",
    "        data-observable-refs=\"OBS_RECORD_SAVED\"",
    "        data-setfarm-element-ref=\"E000003\"",
    "      >Record saved</output>",
    "    </main>",
    "  );",
    "}",
    "",
  ].join("\n");
}

function synchronizeScreenProjection(
  screen: StitchScreenIndexEntryV2,
): StitchScreenIndexEntryV2 {
  screen.actions = screen.controls
    .filter((control) => control.semanticSource === "data-action")
    .map((control) => {
      const { generatedSourceLocator: _generatedSourceLocator, ...action } = control;
      return action;
    });
  const counts = {
    buttons: 0,
    links: 0,
    inputs: 0,
    textareas: 0,
    selects: 0,
  };
  for (const control of [...screen.controls, ...screen.rejectedControls]) {
    const field = control.kind === "button"
      ? "buttons"
      : control.kind === "link"
        ? "links"
        : control.kind === "input"
          ? "inputs"
          : control.kind === "textarea"
            ? "textareas"
            : "selects";
    counts[field] += 1;
  }
  Object.assign(screen, counts);
  screen.projection.rawInteractiveCounts = counts;
  const physicalControls = screen.controls.filter((control) =>
    control.semanticSource === "data-action");
  screen.componentApi.actionBindings = physicalControls
    .map((control) => ({
      generatedLocalId: control.generatedLocalId,
      actionRef: control.actionRef,
      inputFields: [...new Set(screen.controls.flatMap((candidate) =>
        (candidate.inputBindings ?? [])
          .filter((binding) => binding.actionRef === control.actionRef)
          .map((binding) => binding.inputField)))].sort(),
    }))
    .sort((left, right) => `${left.generatedLocalId}\0${left.actionRef}`
      .localeCompare(`${right.generatedLocalId}\0${right.actionRef}`));
  screen.componentApi.inputTransports = screen.controls
    .flatMap((control) => (control.inputBindings ?? []).map((binding) => ({
      actionInputRef: `${binding.actionRef}.${binding.inputField}`,
      generatedControlId: control.generatedLocalId,
      stateKey: `${binding.actionRef}.${binding.inputField}`,
    })))
    .sort((left, right) => `${left.actionInputRef}\0${left.generatedControlId}`
      .localeCompare(`${right.actionInputRef}\0${right.generatedControlId}`));
  return StitchScreenIndexEntryV2Schema.parse(screen);
}

function screenWithRejectedControls(): StitchScreenIndexEntryV2 {
  const screen = structuredClone(nativeScreen());
  screen.rejectedControls = [
    {
      rejectionId: "settings-1",
      kind: "button",
      label: "Settings",
      index: 0,
      reasonCode: "outside_canonical_rendered_contract",
      sourceElementRef: "E000004",
      sourceLocator: "stitch/rendered-dom/screen-editor.html",
      generatedSourceLocator: "src/screens/EditorScreen.tsx",
      selector: "[data-setfarm-rejected-control=\"settings-1\"]",
    },
    {
      rejectionId: "missing-help-2",
      kind: "link",
      label: "Help",
      index: 1,
      reasonCode: "outside_canonical_rendered_contract",
      sourceElementRef: "E000005",
      sourceLocator: "stitch/rendered-dom/screen-editor.html",
      generatedSourceLocator: "src/screens/EditorScreen.tsx",
      selector: "[data-setfarm-rejected-control=\"missing-help-2\"]",
    },
  ];
  return synchronizeScreenProjection(screen);
}

function codesFor(
  screen: StitchScreenIndexEntryV2,
  sourceText: string,
): readonly StitchScreenSourceDiagnosticCodeV2[] {
  const result = validateStitchScreenSourceV2({
    screen,
    sourceText,
  });
  assert.equal(result.status, "invalid", JSON.stringify(result));
  if (result.status !== "invalid") throw new Error("expected invalid source");
  return result.rejectionCodes;
}

function codes(sourceText: string): readonly StitchScreenSourceDiagnosticCodeV2[] {
  return codesFor(nativeScreen(), sourceText);
}

describe("native Stitch SCREEN_INDEX v2 generated-source validator", () => {
  it("accepts one exact AST-resolved action, input pair set, and observable", () => {
    assert.deepEqual(validateStitchScreenSourceV2({
      screen: nativeScreen(),
      sourceText: exactSource(),
    }), {
      status: "valid",
      diagnostics: [],
    });
  });

  it("rejects same-element semantic, slot, input-pair, and source-ref tampering deterministically", () => {
    const tampered = exactSource()
      .replace('data-action="ACT_SAVE_RECORD"', 'data-action="ACT_DELETE_RECORD"')
      .replace(
        'data-control-slot="CSLOT_SAVE_RECORD_PRIMARY"',
        'data-control-slot="CSLOT_SAVE_RECORD_SECONDARY"',
      )
      .replace('data-setfarm-element-ref="E000001"', 'data-setfarm-element-ref="E000010"')
      .replace(
        'data-action-input="ACT_SAVE_RECORD.title; ACT_SAVE_RECORD.description"',
        'data-action-input="ACT_SAVE_RECORD.title"',
      )
      .replace('data-setfarm-element-ref="E000002"', 'data-setfarm-element-ref="E000020"')
      .replace('data-setfarm-element-ref="E000003"', 'data-setfarm-element-ref="E000030"');
    const first = validateStitchScreenSourceV2({ screen: nativeScreen(), sourceText: tampered });
    const second = validateStitchScreenSourceV2({ screen: nativeScreen(), sourceText: tampered });
    assert.deepEqual(first, second);
    assert.equal(first.status, "invalid");
    if (first.status !== "invalid") throw new Error("expected invalid source");
    assert.deepEqual(first.rejectionCodes, [
      "STITCH_SCREEN_ACTION_BINDING_MISMATCH",
      "STITCH_SCREEN_ACTION_SOURCE_ELEMENT_REF_MISMATCH",
      "STITCH_SCREEN_CONTROL_SLOT_MISMATCH",
      "STITCH_SCREEN_INPUT_BINDINGS_MISMATCH",
      "STITCH_SCREEN_INPUT_SOURCE_ELEMENT_REF_MISMATCH",
      "STITCH_SCREEN_OBSERVABLE_SOURCE_ELEMENT_REF_MISMATCH",
    ]);
  });

  it("rejects duplicate indexed action, input, and observable resolutions", () => {
    const duplicated = exactSource().replace("    </main>", [
      "      <button data-action-id=\"save-record-1\" data-action=\"ACT_SAVE_RECORD\" data-control-slot=\"CSLOT_SAVE_RECORD_PRIMARY\" data-setfarm-element-ref=\"E000001\">Duplicate</button>",
      "      <input data-control-id=\"record-fields-1\" data-action-input=\"ACT_SAVE_RECORD.title ACT_SAVE_RECORD.description\" data-setfarm-element-ref=\"E000002\" />",
      "      <output data-observable-refs=\"OBS_RECORD_SAVED\" data-setfarm-element-ref=\"E000003\">Duplicate</output>",
      "    </main>",
    ].join("\n"));
    assert.deepEqual(codes(duplicated), [
      "STITCH_SCREEN_ACTION_CONTROL_AMBIGUOUS",
      "STITCH_SCREEN_INPUT_CONTROL_AMBIGUOUS",
      "STITCH_SCREEN_OBSERVABLE_AMBIGUOUS",
    ]);
  });

  it("rejects source-local action and input IDs absent from SCREEN_INDEX", () => {
    const withExtras = exactSource().replace("    </main>", [
      "      <button data-action-id=\"delete-record-1\">Delete</button>",
      "      <input data-control-id=\"search-records-1\" />",
      "    </main>",
    ].join("\n"));
    assert.deepEqual(codes(withExtras), [
      "STITCH_SCREEN_EXTRA_ACTION_CONTROL_ID",
      "STITCH_SCREEN_EXTRA_INPUT_CONTROL_ID",
    ]);
  });

  it("rejects component, tag, action dispatch, accessibility, spread, and unindexed-interactive tampering", () => {
    const tampered = exactSource()
      .replace("export function EditorScreen", "function DifferentScreen")
      .replace("      <button", "      <div")
      .replace(">Save</button>", ">Save</div>")
      .replace(
        '        data-action-id={"save-record-1"}',
        '        {...buttonProps}\n        data-action-id={"save-record-1"}',
      )
      .replace('actions?.["save-record-1"]', 'actions?.["delete-record-1"]')
      .replace('aria-label="Record saved"', 'aria-label="Record failed"')
      .replace("    </main>", "      <button>Unindexed</button>\n    </main>");
    assert.deepEqual(codes(tampered), [
      "STITCH_SCREEN_ACTION_DISPATCH_MISMATCH",
      "STITCH_SCREEN_COMPONENT_EXPORT_MISSING",
      "STITCH_SCREEN_CONTRACT_ELEMENT_SPREAD_FORBIDDEN",
      "STITCH_SCREEN_CONTROL_TAG_MISMATCH",
      "STITCH_SCREEN_INTERACTIVE_ELEMENT_UNINDEXED",
      "STITCH_SCREEN_OBSERVABLE_ACCESSIBILITY_MISMATCH",
    ]);
  });

  it("accepts only inert indexed rejected controls and rejects missing, active, and extra markers", () => {
    const invalidRejectedSource = exactSource().replace("    </main>", [
      "      <button hidden aria-hidden=\"true\" data-setfarm-rejected-control=\"settings-1\" data-setfarm-element-ref=\"E000004\">Settings</button>",
      "      <button hidden aria-hidden=\"true\" disabled data-setfarm-rejected-control=\"extra-help-3\" data-setfarm-element-ref=\"E000006\">Extra</button>",
      "    </main>",
    ].join("\n"));
    const invalid = validateStitchScreenSourceV2({
      screen: screenWithRejectedControls(),
      sourceText: invalidRejectedSource,
    });
    assert.equal(invalid.status, "invalid");
    if (invalid.status !== "invalid") throw new Error("expected invalid source");
    assert.deepEqual(invalid.rejectionCodes, [
      "STITCH_SCREEN_EXTRA_REJECTED_CONTROL_ID",
      "STITCH_SCREEN_INTERACTIVE_ELEMENT_UNINDEXED",
      "STITCH_SCREEN_REJECTED_CONTROL_ACTIVE",
      "STITCH_SCREEN_REJECTED_CONTROL_MISSING",
    ]);

    const acceptedScreen = screenWithRejectedControls();
    acceptedScreen.rejectedControls = acceptedScreen.rejectedControls.slice(0, 1);
    const inertSource = exactSource().replace("    </main>", [
      "      <button hidden aria-hidden=\"true\" disabled data-setfarm-rejected-control=\"settings-1\" data-setfarm-element-ref=\"E000004\">Settings</button>",
      "    </main>",
    ].join("\n"));
    assert.deepEqual(validateStitchScreenSourceV2({
      screen: synchronizeScreenProjection(acceptedScreen),
      sourceText: inertSource,
    }), {
      status: "valid",
      diagnostics: [],
    });
  });

  it("requires semantic links to dispatch their exact local action key despite an href", () => {
    const screen = nativeScreen();
    const action = screen.controls[0]!;
    if (action.semanticSource !== "data-action") throw new Error("expected physical action");
    action.kind = "link";
    action.tagName = "a";
    action.nativeControlKind = "link";
    action.href = "/records/save";
    const exactLinkScreen = synchronizeScreenProjection(screen);
    const linkHandler = 'onClick={(event) => { event.preventDefault(); actions?.["save-record-1"]?.({ "description": actionInputValues["ACT_SAVE_RECORD.description"], "title": actionInputValues["ACT_SAVE_RECORD.title"] }); }}';
    const buttonHandler = 'onClick={() => actions?.["save-record-1"]?.({ "description": actionInputValues["ACT_SAVE_RECORD.description"], "title": actionInputValues["ACT_SAVE_RECORD.title"] })}';
    const linkSource = exactSource()
      .replace("      <button", '      <a href="/records/save"')
      .replace(">Save</button>", ">Save</a>")
      .replace(buttonHandler, linkHandler);
    assert.equal(validateStitchScreenSourceV2({ screen: exactLinkScreen, sourceText: linkSource }).status, "valid");
    assert.deepEqual(codesFor(exactLinkScreen, linkSource.replace(
      `        ${linkHandler}\n`,
      "",
    )), [
      "STITCH_SCREEN_ACTION_DEFAULT_BEHAVIOR_MISMATCH",
      "STITCH_SCREEN_ACTION_DISPATCH_MISMATCH",
    ]);
    assert.deepEqual(codesFor(exactLinkScreen, linkSource.replace(
      linkHandler,
      'onClick={() => { const candidate = actions?.["save-record-1"]; void candidate; }}',
    )), [
      "STITCH_SCREEN_ACTION_DEFAULT_BEHAVIOR_MISMATCH",
      "STITCH_SCREEN_ACTION_DISPATCH_MISMATCH",
    ]);
    assert.deepEqual(codesFor(exactLinkScreen, linkSource.replace(
      "event.preventDefault(); ",
      "",
    )), ["STITCH_SCREEN_ACTION_DEFAULT_BEHAVIOR_MISMATCH"]);
  });

  it("does not accept contract JSX parked outside the exact exported screen component", () => {
    const parked = [
      "export function EditorScreen() { return <main />; }",
      exactSource().replace("export function EditorScreen", "function DeadScreen"),
    ].join("\n");
    assert.deepEqual(codes(parked), [
      "STITCH_SCREEN_ACTION_CONTROL_MISSING",
      "STITCH_SCREEN_INPUT_CONTROL_MISSING",
      "STITCH_SCREEN_OBSERVABLE_MISSING",
    ]);
  });

  it("preserves the rendered tag and literal accessibility authority for role controls", () => {
    const screen = nativeScreen();
    const action = screen.controls[0]!;
    if (action.semanticSource !== "data-action") throw new Error("expected physical action");
    action.tagName = "div";
    action.nativeControlKind = null;
    action.role = "button";
    action.ariaLabel = "Save record";
    action.interactiveRole = true;
    const exactRoleScreen = synchronizeScreenProjection(screen);
    const roleSource = exactSource()
      .replace("      <button", '      <div role="button" aria-label="Save record"')
      .replace(">Save</button>", ">Save</div>");
    assert.equal(validateStitchScreenSourceV2({
      screen: exactRoleScreen,
      sourceText: roleSource,
    }).status, "valid");
    const tampered = roleSource
      .replace('<div role="button" aria-label="Save record"', '<span role="link" aria-label="Wrong"')
      .replace(">Save</div>", ">Save</span>");
    assert.deepEqual(codesFor(exactRoleScreen, tampered), [
      "STITCH_SCREEN_CONTROL_ACCESSIBILITY_MISMATCH",
      "STITCH_SCREEN_CONTROL_TAG_MISMATCH",
    ]);
  });

  it("rejects input handlers that do not transport the exact indexed value keys", () => {
    const tampered = exactSource()
      .replace(
        '"ACT_SAVE_RECORD.title": nextValue',
        '"ACT_SAVE_RECORD.slug": nextValue',
      )
      .replace(
        'value={actionInputValues["ACT_SAVE_RECORD.description"]}',
        'value={actionInputValues["ACT_SAVE_RECORD.title"]}',
      );
    assert.deepEqual(codes(tampered), ["STITCH_SCREEN_INPUT_TRANSPORT_MISMATCH"]);
  });

  it("rejects callback payload fields that differ from the exact component API", () => {
    const missingField = exactSource().replace(
      '{ "description": actionInputValues["ACT_SAVE_RECORD.description"], "title": actionInputValues["ACT_SAVE_RECORD.title"] }',
      '{ "title": actionInputValues["ACT_SAVE_RECORD.title"] }',
    );
    assert.deepEqual(codes(missingField), ["STITCH_SCREEN_ACTION_PAYLOAD_MISMATCH"]);

    const wrongTransport = exactSource().replace(
      '"description": actionInputValues["ACT_SAVE_RECORD.description"]',
      '"description": actionInputValues["ACT_SAVE_RECORD.title"]',
    );
    assert.deepEqual(codes(wrongTransport), ["STITCH_SCREEN_ACTION_PAYLOAD_MISMATCH"]);
  });
});
