import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import ts from "typescript";

function writeConverterFixture(root: string, title: string, body: string): void {
  const stitch = path.join(root, "stitch");
  fs.mkdirSync(stitch, { recursive: true });
  fs.writeFileSync(path.join(stitch, "DESIGN_MANIFEST.json"), JSON.stringify([{
    screenId: "action-input-screen",
    title,
    htmlFile: "action-input-screen.html",
  }]));
  fs.writeFileSync(
    path.join(stitch, "action-input-screen.html"),
    `<!doctype html><html><body>${body}${"<p>design-token</p>".repeat(80)}</body></html>`,
  );
}

function convert(root: string, componentName: string): string {
  execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  return fs.readFileSync(path.join(root, `src/screens/${componentName}.tsx`), "utf8");
}

function typeCheckGeneratedTsx(root: string, sourceFile: string): void {
  const declarations = path.join(root, "generated-react-shim.d.ts");
  fs.writeFileSync(declarations, `
declare module "react" {
  type SetStateAction<T> = T | ((current: T) => T);
  export function useState<T>(initial: T): [T, (next: SetStateAction<T>) => void];
}
declare namespace JSX {
  interface Element {}
  interface ElementChildrenAttribute { children: {}; }
  interface IntrinsicElements {
    [name: string]: {
      children?: unknown;
      onClick?: (() => void) | ((event: { preventDefault(): void }) => void);
      onChange?: (event: { currentTarget: { value: string } }) => void;
      [attribute: string]: unknown;
    };
  }
}
`);
  const program = ts.createProgram([sourceFile, declarations], {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
  });
  const errors = ts.getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(
    errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")),
    [],
  );
}

describe("Stitch converter typed action-input transport", () => {
  it("wires a separate input and physical button through local state and an exact payload", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-action-input-separate-"));
    try {
      writeConverterFixture(root, "Record Editor", `
        <main>
          <input aria-label="Title" value="Draft" data-action-input="ACT_SAVE_RECORD.title" data-setfarm-element-ref="E000001" />
          <button data-action="ACT_SAVE_RECORD" data-setfarm-element-ref="E000002">Save</button>
        </main>
      `);
      const source = convert(root, "RecordEditor");
      const index = JSON.parse(fs.readFileSync(path.join(root, "src/screens/SCREEN_INDEX.json"), "utf8"));

      assert.match(source, /import \{ useState \} from "react";/);
      assert.match(source, /"save-1"\?: \(payload: \{ "title": string \}\) => void;/);
      assert.match(source, /data-action-input="ACT_SAVE_RECORD\.title"[^>]*data-setfarm-element-ref="E000001"[^>]*data-control-id="title-1"/);
      assert.match(source, /setActionInputValues\(\(current\) => \(\{ \.\.\.current, "ACT_SAVE_RECORD\.title": nextValue \}\)\)/);
      assert.match(source, /data-action="ACT_SAVE_RECORD"[^>]*data-setfarm-element-ref="E000002"[^>]*data-action-id="save-1"/);
      assert.ok(source.includes('actions?.["save-1"]?.({ "title": actionInputValues["ACT_SAVE_RECORD.title"] })'));
      assert.doesNotMatch(source, /querySelector|getElementById|closest\(/);
      assert.deepEqual(index[0].componentApi, {
        schema: "setfarm.generated-screen-component-api.v1",
        actionsPropName: "actions",
        actionBindings: [{
          generatedLocalId: "save-1",
          actionRef: "ACT_SAVE_RECORD",
          inputFields: ["title"],
        }],
        inputTransports: [{
          actionInputRef: "ACT_SAVE_RECORD.title",
          generatedControlId: "title-1",
          stateKey: "ACT_SAVE_RECORD.title",
        }],
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses the current event value for a same-element input action", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-action-input-same-element-"));
    try {
      writeConverterFixture(root, "Search Panel", `
        <main>
          <input aria-label="Search" data-action="ACT_SEARCH" data-action-input="ACT_SEARCH.query" data-control-slot="CSLOT_SEARCH_PRIMARY" data-setfarm-element-ref="E000001" />
        </main>
      `);
      const source = convert(root, "SearchPanel");
      const index = JSON.parse(fs.readFileSync(path.join(root, "src/screens/SCREEN_INDEX.json"), "utf8"));

      assert.match(source, /"search-1"\?: \(payload: \{ "query": string \}\) => void;/);
      assert.match(source, /data-action="ACT_SEARCH"[^>]*data-action-input="ACT_SEARCH\.query"[^>]*data-control-slot="CSLOT_SEARCH_PRIMARY"[^>]*data-setfarm-element-ref="E000001"[^>]*data-action-id="search-1"/);
      assert.match(source, /const nextValue = event\.currentTarget\.value;/);
      assert.ok(source.includes('actions?.["search-1"]?.({ "query": nextValue })'));
      assert.doesNotMatch(source, /data-control-id="search-1"/);
      assert.deepEqual(index[0].componentApi.inputTransports, [{
        actionInputRef: "ACT_SEARCH.query",
        generatedControlId: "search-1",
        stateKey: "ACT_SEARCH.query",
      }]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("emits a deterministic multi-field payload keyed by exact ProductSpec field names", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-action-input-multi-field-"));
    try {
      writeConverterFixture(root, "Multi Field Editor", `
        <main>
          <input aria-label="Title" data-action-input="ACT_SAVE_RECORD.title" />
          <textarea aria-label="Description" data-action-input="ACT_SAVE_RECORD.description"></textarea>
          <button data-action="ACT_SAVE_RECORD">Save</button>
        </main>
      `);
      const source = convert(root, "MultiFieldEditor");
      const index = JSON.parse(fs.readFileSync(path.join(root, "src/screens/SCREEN_INDEX.json"), "utf8"));

      assert.match(source, /"save-1"\?: \(payload: \{ "description": string; "title": string \}\) => void;/);
      assert.ok(source.includes(
        'actions?.["save-1"]?.({ "description": actionInputValues["ACT_SAVE_RECORD.description"], "title": actionInputValues["ACT_SAVE_RECORD.title"] })',
      ));
      assert.deepEqual(index[0].componentApi, {
        schema: "setfarm.generated-screen-component-api.v1",
        actionsPropName: "actions",
        actionBindings: [{
          generatedLocalId: "save-1",
          actionRef: "ACT_SAVE_RECORD",
          inputFields: ["description", "title"],
        }],
        inputTransports: [
          {
            actionInputRef: "ACT_SAVE_RECORD.description",
            generatedControlId: "description-2",
            stateKey: "ACT_SAVE_RECORD.description",
          },
          {
            actionInputRef: "ACT_SAVE_RECORD.title",
            generatedControlId: "title-1",
            stateKey: "ACT_SAVE_RECORD.title",
          },
        ],
      });
      const generated = path.join(root, "src/screens/MultiFieldEditor.tsx");
      typeCheckGeneratedTsx(root, generated);
      const rerunSource = convert(root, "MultiFieldEditor");
      assert.equal(rerunSource, source);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps no-input callbacks zero-argument and dispatches semantic links regardless of href", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-action-input-no-input-"));
    try {
      writeConverterFixture(root, "Action Links", `
        <main>
          <button data-action="ACT_CANCEL">Cancel</button>
          <a href="/help" data-action="ACT_OPEN_HELP">Help</a>
        </main>
      `);
      const source = convert(root, "ActionLinks");
      const index = JSON.parse(fs.readFileSync(path.join(root, "src/screens/SCREEN_INDEX.json"), "utf8"));

      assert.match(source, /"cancel-1"\?: \(\) => void;/);
      assert.match(source, /"help-1"\?: \(\) => void;/);
      assert.match(source, /data-action-id="cancel-1" onClick=\{actions\?\.\["cancel-1"\]\}/);
      assert.match(source, /<a href="\/help" data-action="ACT_OPEN_HELP" data-action-id="help-1" onClick=\{\(event\) => \{ event\.preventDefault\(\); actions\?\.\["help-1"\]\?\.\(\); \}\}>/);
      assert.doesNotMatch(source, /useState|actionInputValues/);
      assert.deepEqual(index[0].componentApi.actionBindings, [
        { generatedLocalId: "cancel-1", actionRef: "ACT_CANCEL", inputFields: [] },
        { generatedLocalId: "help-1", actionRef: "ACT_OPEN_HELP", inputFields: [] },
      ]);
      assert.deepEqual(index[0].componentApi.inputTransports, []);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
