import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

describe("Stitch converter semantic projection", () => {
  it("projects only exact v3 controls and records every undeclared Stitch control as neutralized evidence", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-contract-projection-"));
    try {
      const stitch = path.join(root, "stitch");
      fs.mkdirSync(stitch, { recursive: true });
      fs.writeFileSync(path.join(stitch, "DESIGN_MANIFEST.json"), JSON.stringify([{
        screenId: "status-screen",
        title: "Status Page - Status Utility",
        surfaceIds: ["SURF_STATUS"],
      }]));
      fs.writeFileSync(path.join(stitch, "GENERATION_TARGETS.json"), JSON.stringify({
        schema: "setfarm.design-generation-targets.v1",
        productSpecHash: "a".repeat(64),
        targets: [{
          targetId: "TARGET_STATUS",
          designSurfaceId: "DSURF_STATUS",
          surfaceRef: "SURF_STATUS",
          requestScreenKey: "Status Page - Status Utility",
          expectedScreenTitle: "Status Page - Status Utility",
          requiredActionRefs: ["ACT_REFRESH"],
          requiredActionInputs: [],
          requiredObservableSelectors: [{
            observableRef: "OBS_REFRESHED_STATUS",
            actionRef: "ACT_REFRESH",
            selector: {
              kind: "accessibility",
              surfaceRef: "SURF_STATUS",
              actionRef: "ACT_REFRESH",
              role: "status",
              name: "Status refreshed",
            },
          }],
        }],
      }));
      fs.writeFileSync(path.join(stitch, "STITCH_RESPONSE_BINDINGS.json"), JSON.stringify({
        schema: "setfarm.stitch-target-response-bindings.v1",
        generationTargetsHash: "b".repeat(64),
        bindings: [{
          targetRef: "TARGET_STATUS",
          requestScreenKey: "Status Page - Status Utility",
          expectedScreenTitle: "Status Page - Status Utility",
          responseScreenId: "status-screen",
          responseTitle: "Status Page - Status Utility",
          stageId: "stage-status",
        }],
      }));
      fs.writeFileSync(path.join(stitch, "status-screen.html"), `<!doctype html><html><body>
        <main data-surface-id="SURF_STATUS">
          <button>Settings</button>
          <button aria-label="Help">?</button>
          <button data-action="ACT_REFRESH">Refresh Status</button>
          <img title="1 > 0" role="status" aria-label="Status refreshed" />
          ${"<p>design-token</p>".repeat(80)}
        </main>
      </body></html>`);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const index = JSON.parse(fs.readFileSync(path.join(root, "src/screens/SCREEN_INDEX.json"), "utf8"));
      assert.deepEqual(index[0].projection, {
        schema: "setfarm.stitch-screen-projection.v2",
        mode: "contract_only",
        targetRef: "TARGET_STATUS",
        rawInteractiveCounts: { buttons: 3, links: 0, inputs: 0, textareas: 0, selects: 0 },
        requiredObservableRefs: ["OBS_REFRESHED_STATUS"],
      });
      assert.deepEqual(index[0].observables, [{
        observableRef: "OBS_REFRESHED_STATUS",
        role: "status",
        name: "Status refreshed",
        sourceLocator: "stitch/status-screen.html",
        generatedSourceLocator: "src/screens/StatusPageStatusUtility.tsx",
        selector: '[data-observable-refs~="OBS_REFRESHED_STATUS"]',
      }]);
      assert.equal(index[0].controls.length, 1);
      assert.equal(index[0].controls[0].actionRef, "ACT_REFRESH");
      assert.deepEqual(
        index[0].rejectedControls.map((control: { label: string; reasonCode: string }) => ({
          label: control.label,
          reasonCode: control.reasonCode,
        })),
        [
          { label: "Settings", reasonCode: "undeclared_by_generation_target" },
          { label: "Help", reasonCode: "undeclared_by_generation_target" },
        ],
      );

      const source = fs.readFileSync(path.join(root, "src/screens/StatusPageStatusUtility.tsx"), "utf8");
      assert.match(source, /<button[^>]*hidden=\{true\}[^>]*data-setfarm-rejected-control="settings-1"[^>]*>Settings<\/button>/);
      assert.match(source, /<button[^>]*hidden=\{true\}[^>]*data-setfarm-rejected-control="help-2"[^>]*>/);
      assert.match(source, /data-action="ACT_REFRESH"[^>]*data-action-id="refresh-status-3"[^>]*onClick=/);
      assert.match(source, /<img[^>]*title="1 > 0"[^>]*role="status"[^>]*aria-label="Status refreshed"[^>]*data-observable-refs="OBS_REFRESHED_STATUS"[^>]*\/>/);
      assert.doesNotMatch(source, /actions\?\.\["settings-1"\]|actions\?\.\["help-2"\]/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("retains same-element semantic and generated-local action identity", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-semantic-projection-"));
    try {
      const stitch = path.join(root, "stitch");
      fs.mkdirSync(stitch, { recursive: true });
      fs.writeFileSync(path.join(stitch, "DESIGN_MANIFEST.json"), JSON.stringify([{
        screenId: "editor",
        title: "Task Editor",
        surfaceIds: ["SURF_EDITOR"],
      }]));
      const filler = "<p>design-token</p>".repeat(80);
      fs.writeFileSync(path.join(stitch, "editor.html"), `<!doctype html><html><body>
        <label for="task-title">Task Title</label>
        <input id="task-title" />
        <label for="task-desc">Description</label>
        <textarea id="task-desc"></textarea>
        <button data-action="ACT_SAVE_RECORD">Save Changes</button>
        <button data-action="actSaveRecord">Invalid Semantic Token</button>
        <a href="#" data-action="ACT_EXPORT_JSON">Export JSON</a>
        ${filler}
      </body></html>`);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      const index = JSON.parse(
        fs.readFileSync(path.join(root, "src", "screens", "SCREEN_INDEX.json"), "utf8"),
      );
      const save = index[0].actions.find((action: { actionRef?: string }) =>
        action.actionRef === "ACT_SAVE_RECORD");
      const exportAction = index[0].actions.find((action: { actionRef?: string }) =>
        action.actionRef === "ACT_EXPORT_JSON");
      const invalid = index[0].actions.find((action: { label: string }) =>
        action.label === "Invalid Semantic Token");

      assert.deepEqual(save, {
        id: "save-changes-1",
        kind: "button",
        label: "Save Changes",
        index: 0,
        actionRef: "ACT_SAVE_RECORD",
        generatedLocalId: "save-changes-1",
        semanticSource: "data-action",
        sourceLocator: "stitch/editor.html",
        selector: '[data-action-id="save-changes-1"]',
      });
      assert.deepEqual(exportAction, {
        id: "export-json-1",
        kind: "link",
        label: "Export JSON",
        href: "#",
        index: 0,
        actionRef: "ACT_EXPORT_JSON",
        generatedLocalId: "export-json-1",
        semanticSource: "data-action",
        sourceLocator: "stitch/editor.html",
        selector: '[data-action-id="export-json-1"]',
      });
      assert.equal(invalid.actionRef, undefined);
      assert.equal(invalid.generatedLocalId, undefined);
      assert.deepEqual(
        index[0].actions.map((action: { id: string }) => action.id),
        ["save-changes-1", "invalid-semantic-token-2", "export-json-1"],
      );

      const code = fs.readFileSync(
        path.join(root, "src", "screens", "TaskEditor.tsx"),
        "utf8",
      );
      assert.match(code, /data-action="ACT_SAVE_RECORD"[^>]*data-action-id="save-changes-1"/);
      assert.match(code, /data-action="ACT_EXPORT_JSON"[^>]*data-action-id="export-json-1"/);
      assert.doesNotMatch(JSON.stringify(index), /"Description"|"task-title"|"task-desc"/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("emits exact value-input mappings without exposing uncontracted form controls", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-input-projection-"));
    try {
      const stitch = path.join(root, "stitch");
      fs.mkdirSync(stitch, { recursive: true });
      fs.writeFileSync(path.join(stitch, "DESIGN_MANIFEST.json"), JSON.stringify([{
        screenId: "editor-v3",
        title: "Task Editor - Exact Product",
        surfaceIds: ["SURF_EDITOR"],
      }]));
      fs.writeFileSync(path.join(stitch, "editor-v3.html"), `<!doctype html><html><body>
        <input aria-label="Task title" data-action-input="ACT_SAVE_RECORD.title" />
        <input aria-label="Decorative search" />
        <button data-action="ACT_SAVE_RECORD">Save</button>
        ${"<p>design-token</p>".repeat(80)}
      </body></html>`);

      execFileSync("node", ["scripts/stitch-to-jsx.mjs", root], {
        cwd: process.cwd(),
        stdio: "pipe",
      });
      const index = JSON.parse(fs.readFileSync(path.join(root, "src/screens/SCREEN_INDEX.json"), "utf8"));
      assert.equal(index[0].inputs, 2);
      assert.equal(index[0].controls.filter((control: { kind: string }) => control.kind === "input").length, 1);
      assert.deepEqual(index[0].controls.find((control: { kind: string }) => control.kind === "input").inputBindings, [{
        actionRef: "ACT_SAVE_RECORD",
        inputField: "title",
      }]);
      const source = fs.readFileSync(path.join(root, "src/screens/TaskEditorExactProduct.tsx"), "utf8");
      assert.match(source, /data-action-input="ACT_SAVE_RECORD\.title"[^>]*data-control-id="task-title-1"/);
      assert.match(source, /data-action="ACT_SAVE_RECORD"[^>]*data-action-id="save-1"/);
      assert.doesNotMatch(source, /data-control-id="decorative-search/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
