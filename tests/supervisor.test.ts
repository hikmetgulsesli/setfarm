import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runImplementSupervisorScan } from "../src/installer/supervisor/run-supervisor.js";
import { readSupervisorChecklist } from "../src/installer/supervisor/state.js";

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
});
