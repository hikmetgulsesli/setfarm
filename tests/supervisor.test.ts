import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildSupervisorChecklistFromProject } from "../src/installer/supervisor/checklist.js";
import { runImplementSupervisorScan } from "../src/installer/supervisor/run-supervisor.js";
import { readSupervisorChecklist, readSupervisorState } from "../src/installer/supervisor/state.js";

describe("supervisor checklist scanning", () => {
  it("merges checklist items across story scopes in the same run", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Main Menu", file: "src/screens/MainMenu.tsx" },
        { screenId: "SCR-002", title: "Settings", file: "src/screens/Settings.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            title: "Main Menu",
            buttons: [{ label: "Start", action: "start" }],
          },
          "SCR-002": {
            title: "Settings",
            buttons: [{ label: "Save", action: "save" }],
          },
        },
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/MainMenu.tsx"), [
        "export function MainMenu({ actions }: any) {",
        "  return <button type=\"button\" onClick={actions?.start}>Start</button>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/screens/Settings.tsx"), [
        "export function Settings() {",
        "  return <button type=\"button\">Save</button>;",
        "}",
      ].join("\n"));

      const runId = "run-merge";
      const first = await runImplementSupervisorScan({
        runId,
        workdir: tmp,
        storyId: "US-001",
        scopeFiles: ["src/screens/MainMenu.tsx"],
      });
      assert.equal(first.blockers.length, 0);

      const second = await runImplementSupervisorScan({
        runId,
        workdir: tmp,
        storyId: "US-002",
        scopeFiles: ["src/screens/Settings.tsx"],
      });

      assert.equal(second.blockers.length, 1);
      assert.match(second.blockers[0].message, /Save/);
      const checklist = readSupervisorChecklist(tmp, runId);
      assert.ok(checklist);
      assert.equal(checklist.items.some((item) => item.file === "src/screens/MainMenu.tsx"), true);
      assert.equal(checklist.items.some((item) => item.file === "src/screens/Settings.tsx"), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("treats explicit false inert attributes as active controls", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-false-attrs-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Settings", file: "src/screens/Settings.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            screenId: "SCR-001",
            title: "Settings",
            buttons: [{ label: "Save", action: "save" }],
            navLinks: [{ label: "Help", href: "#" }],
          },
        },
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/Settings.tsx"), [
        "export function Settings() {",
        "  return <main>",
        "    <button type=\"button\" disabled={false}>Save</button>",
        "    <a href=\"#\" aria-disabled=\"false\">Help</a>",
        "  </main>;",
        "}",
      ].join("\n"));

      const result = await runImplementSupervisorScan({
        runId: "run-false-attrs",
        workdir: tmp,
        storyId: "US-001",
        scopeFiles: ["src/screens/Settings.tsx"],
      });

      assert.equal(result.blockers.length, 2);
      assert.equal(result.blockers.some((finding) => finding.status === "static" && /Save/.test(finding.message)), true);
      assert.equal(result.blockers.some((finding) => finding.status === "dead-href" && /Help/.test(finding.message)), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps project status blocked while another story still has open blockers", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-project-status-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Main Menu", file: "src/screens/MainMenu.tsx" },
        { screenId: "SCR-002", title: "Settings", file: "src/screens/Settings.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            screenId: "SCR-001",
            title: "Main Menu",
            buttons: [{ label: "Start", action: "start" }],
          },
          "SCR-002": {
            screenId: "SCR-002",
            title: "Settings",
            buttons: [{ label: "Save", action: "save" }],
          },
        },
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/MainMenu.tsx"), [
        "export function MainMenu({ actions }: any) {",
        "  return <button type=\"button\" onClick={actions?.start}>Start</button>;",
        "}",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/screens/Settings.tsx"), [
        "export function Settings() {",
        "  return <button type=\"button\">Save</button>;",
        "}",
      ].join("\n"));

      const runId = "run-project-status";
      await runImplementSupervisorScan({
        runId,
        workdir: tmp,
        storyId: "US-002",
        scopeFiles: ["src/screens/Settings.tsx"],
      });
      assert.equal(readSupervisorState(tmp, runId).projectStatus, "blocked");

      await runImplementSupervisorScan({
        runId,
        workdir: tmp,
        storyId: "US-001",
        scopeFiles: ["src/screens/MainMenu.tsx"],
      });

      const state = readSupervisorState(tmp, runId);
      assert.equal(state.stories["US-001"].status, "passed");
      assert.equal(state.stories["US-002"].status, "blocked");
      assert.equal(state.projectStatus, "blocked");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps duplicate control labels from different screen files separate", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-duplicate-labels-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Settings", file: "src/screens/UserSettings.tsx" },
        { screenId: "SCR-002", title: "Settings", file: "src/screens/AdminSettings.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            screenId: "SCR-001",
            title: "Settings",
            buttons: [{ label: "Save", action: "save-user" }],
          },
          "SCR-002": {
            screenId: "SCR-002",
            title: "Settings",
            buttons: [{ label: "Save", action: "save-admin" }],
          },
        },
      }));

      const checklist = buildSupervisorChecklistFromProject({ runId: "run-duplicates", workdir: tmp });

      assert.equal(checklist.items.filter((item) => item.label === "Save").length, 2);
      assert.equal(new Set(checklist.items.map((item) => item.id)).size, checklist.items.length);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
