import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { buildSupervisorChecklistFromProject } from "../src/installer/supervisor/checklist.js";
import { scanSupervisorChecklist } from "../src/installer/supervisor/scanner.js";
import { runImplementSupervisorScan } from "../src/installer/supervisor/run-supervisor.js";
import {
  applyScanFindings,
  readSupervisorChecklist,
  readSupervisorRunMetadata,
  readSupervisorState,
  readSupervisorVisualResult,
  supervisorFixerPlanPath,
  supervisorInterventionsPath,
  supervisorVisualReportPath,
  upsertSupervisorRunMetadata,
  writeSupervisorVisualResult,
} from "../src/installer/supervisor/state.js";
import {
  classifyVisibleScreenText,
  isUnsafeSceneBackground,
  isTilingBackgroundRepeat,
  resolveStoryVisualScope,
  suppressBrowserInfraIssues,
} from "../src/installer/supervisor/visual-qa.js";
import { readSupervisorArtifactSummary } from "../src/server/supervisor-summary.js";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    timeout: 10000,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Setfarm Test",
      GIT_AUTHOR_EMAIL: "setfarm-test@example.test",
      GIT_COMMITTER_NAME: "Setfarm Test",
      GIT_COMMITTER_EMAIL: "setfarm-test@example.test",
    },
  }).trim();
}

describe("supervisor checklist scanning", () => {
  it("does not classify no-repeat scene backgrounds as tiled viewport failures", () => {
    assert.equal(isTilingBackgroundRepeat("no-repeat"), false);
    assert.equal(isTilingBackgroundRepeat("no-repeat no-repeat"), false);
    assert.equal(isTilingBackgroundRepeat("repeat"), true);
    assert.equal(isTilingBackgroundRepeat("repeat-x"), true);
    assert.equal(isTilingBackgroundRepeat("space"), true);
    assert.equal(isUnsafeSceneBackground("repeat", "cover"), false);
    assert.equal(isUnsafeSceneBackground("repeat", "contain"), false);
    assert.equal(isUnsafeSceneBackground("repeat", "auto"), true);
    assert.equal(isUnsafeSceneBackground("no-repeat", ""), true);
  });

  it("keeps scene background repeat detection self-contained inside browser evaluation", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/supervisor/visual-qa.ts"), "utf-8");
    const evaluateStart = source.indexOf("const snapshot = await page.evaluate(() => {");
    assert.notEqual(evaluateStart, -1);
    const useIndex = source.indexOf("if (isUnsafeSceneBackground(repeat, size)", evaluateStart);
    assert.notEqual(useIndex, -1);
    const evaluateBodyBeforeUse = source.slice(evaluateStart, useIndex);
    assert.match(evaluateBodyBeforeUse, /const isTilingBackgroundRepeat = \(value: string \| undefined\) =>/);
    assert.match(evaluateBodyBeforeUse, /const isUnsafeSceneBackground = \(repeat: string \| undefined, size: string \| undefined\) =>/);
  });

  it("waits for meaningful React render before visual QA screenshots", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/supervisor/visual-qa.ts"), "utf-8");
    assert.match(source, /async function waitForMeaningfulRender\(page: Page\): Promise<void>/);
    assert.match(source, /document\.getElementById\("root"\)/);
    assert.match(source, /\[data-setfarm-root\]/);
    assert.match(source, /text\.length >= 5 \|\| meaningful > 0/);
    const gotoRoute = source.slice(source.indexOf("async function gotoRoute"));
    assert.match(gotoRoute, /await waitForMeaningfulRender\(page\);/);
  });

  it("requires HTTP success before treating a visual QA preview server as ready", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/supervisor/visual-qa.ts"), "utf-8");
    const waitForServer = source.slice(source.indexOf("async function waitForServer"));
    assert.match(waitForServer, /if \(response\.ok\) return true;/);
    assert.doesNotMatch(waitForServer, /response\.status < 500/);
  });

  it("does not flag clipped transformed hover effects as visual overflow", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/supervisor/visual-qa.ts"), "utf-8");
    const inspectPage = source.slice(source.indexOf("async function inspectPage"));
    assert.match(inspectPage, /pageHorizontallyScrollable/);
    assert.match(inspectPage, /hasClippingAncestor/);
    assert.match(inspectPage, /style\.transform && style\.transform !== "none"/);
    assert.match(inspectPage, /hasClippingAncestor && \(transformed \|\| !pageHorizontallyScrollable\)/);
  });

  it("does not count JSX-commented controls as rendered checklist evidence", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-commented-control-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/Game.tsx"), [
        "export function Game({ actions }: any) {",
        "  return <main>",
        "    {/*",
        "      <button type=\"button\" data-action-id=\"resume-1\" onClick={actions?.['resume-1']}>RESUME</button>",
        "    */}",
        "    <button type=\"button\" data-action-id=\"pause-1\" onClick={actions?.['pause-1']}>PAUSE</button>",
        "  </main>;",
        "}",
      ].join("\n"));
      const checklist = {
        schema: "setfarm.supervisor-checklist.v1" as const,
        runId: "run-commented-control",
        generatedAt: new Date().toISOString(),
        items: [
          {
            id: "resume-button",
            storyId: "US-001",
            screen: "Game",
            file: "src/screens/Game.tsx",
            scopeFiles: ["src/screens/Game.tsx"],
            type: "button" as const,
            label: "RESUME",
            severity: "blocker" as const,
            evidenceRequired: ["rendered-control"],
            source: "ui-contract" as const,
          },
          {
            id: "pause-button",
            storyId: "US-001",
            screen: "Game",
            file: "src/screens/Game.tsx",
            scopeFiles: ["src/screens/Game.tsx"],
            type: "button" as const,
            label: "PAUSE",
            severity: "blocker" as const,
            evidenceRequired: ["rendered-control"],
            source: "ui-contract" as const,
          },
        ],
      };

      const result = scanSupervisorChecklist(tmp, checklist, ["src/screens/Game.tsx"]);

      assert.equal(result.passed.some((finding) => finding.itemId === "pause-button"), true);
      assert.equal(result.blockers.some((finding) => finding.itemId === "resume-button"), true);
      assert.match(result.blockers.find((finding) => finding.itemId === "resume-button")?.message || "", /missing button "RESUME"/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("ignores decorative generic design controls that are absent from generated screen actions", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-decorative-design-control-"));
    try {
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        {
          screenId: "screen-1",
          title: "Operations",
          componentName: "OperationsScreen",
          file: "src/screens/OperationsScreen.tsx",
          actions: [{ id: "start-1", kind: "button", label: "Start", index: 0 }],
        },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: [
          {
            screenId: "screen-1",
            title: "Operations",
            buttons: [
              { label: "Start", action: "click-action", classes: [] },
              { label: "terrain", icon: "terrain", action: "click-action", classes: [] },
              { label: "flight_takeoff", icon: "flight_takeoff", action: "navigate", classes: [] },
              { label: "Lives", icon: "favorite", action: "navigate", expectedRoute: "/favorites", classes: [] },
              { label: "Operations Unit Active", action: "click-action", classes: [] },
            ],
          },
        ],
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/OperationsScreen.tsx"), [
        "export function OperationsScreen({ actions }: any) {",
        "  return <button type=\"button\" onClick={actions?.['start-1']}>Start</button>;",
        "}",
      ].join("\n"));

      const checklist = buildSupervisorChecklistFromProject({
        runId: "run-decorative-design-control",
        workdir: tmp,
        scopeFiles: ["src/screens/OperationsScreen.tsx"],
      });
      assert.deepEqual(checklist.items.map((item) => item.label), ["Start"]);

      const result = scanSupervisorChecklist(tmp, checklist, ["src/screens/OperationsScreen.tsx"]);
      assert.equal(result.blockers.length, 0);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("defers story-scoped visual QA for non-visual shell stories", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-visual-scope-"));
    try {
      fs.mkdirSync(path.join(tmp, ".setfarm"), { recursive: true });
      fs.writeFileSync(path.join(tmp, ".setfarm", "STORY_OWNERSHIP.json"), JSON.stringify({
        schema: "setfarm.story-ownership.v1",
        runId: "run-visual-scope",
        stories: [
          {
            storyId: "US-001",
            ownsScreens: [],
            scopeFiles: ["src/App.tsx", "src/index.css"],
          },
          {
            storyId: "US-002",
            ownsScreens: ["Dashboard"],
            scopeFiles: ["src/screens/Dashboard.tsx"],
          },
        ],
      }));

      const shellScope = resolveStoryVisualScope(tmp, "US-001");
      assert.equal(shellScope.skip, true);
      assert.match(shellScope.reason || "", /owns no visual screens/);
      assert.equal(resolveStoryVisualScope(tmp, "US-002").skip, false);
      assert.equal(resolveStoryVisualScope(tmp, "US-999").skip, false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("defers story visual QA from a story worktree using main repo ownership metadata", () => {
    const mainRepo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-visual-main-repo-"));
    const storyWorktree = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-visual-story-worktree-"));
    try {
      fs.mkdirSync(path.join(mainRepo, ".setfarm"), { recursive: true });
      fs.writeFileSync(path.join(mainRepo, ".setfarm", "STORY_OWNERSHIP.json"), JSON.stringify({
        schema: "setfarm.story-ownership.v1",
        runId: "run-visual-main-repo",
        stories: [
          {
            storyId: "US-001",
            ownsScreens: [],
            scopeFiles: ["src/App.tsx", "src/index.css"],
          },
        ],
      }));

      const storyScope = resolveStoryVisualScope(storyWorktree, "US-001", [mainRepo]);
      assert.equal(storyScope.skip, true);
      assert.match(storyScope.reason || "", /owns no visual screens/);
    } finally {
      fs.rmSync(mainRepo, { recursive: true, force: true });
      fs.rmSync(storyWorktree, { recursive: true, force: true });
    }
  });

  it("runs visual QA when a story owns screen files even if ownership metadata is sparse", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-visual-screen-scope-"));
    try {
      fs.mkdirSync(path.join(tmp, ".setfarm"), { recursive: true });
      fs.writeFileSync(path.join(tmp, ".setfarm", "STORY_OWNERSHIP.json"), JSON.stringify({
        schema: "setfarm.story-ownership.v1",
        runId: "run-visual-screen-scope",
        stories: [
          {
            storyId: "US-001",
            ownsScreens: [],
            scopeFiles: ["src/screens/Editor.tsx"],
          },
        ],
      }));

      assert.equal(resolveStoryVisualScope(tmp, "US-001").skip, false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("classifies post-click visual state to the owning screen story", () => {
    const result = classifyVisibleScreenText(
      [
        "SYSTEM CONFIG",
        "PROTOCOL DIFFICULTY",
        "EASY MEDIUM HARD",
        "RESET TO DEFAULTS",
        "RETURN",
        "SAVE CONFIG",
      ].join(" "),
      [
        {
          storyId: "US-002",
          title: "Gameplay - CircuitSlide Lite",
          file: "src/screens/GameplayCircuitslideLite.tsx",
          labels: ["Gameplay - CircuitSlide Lite", "Pause", "Settings", "Start Sequence", "Start"],
        },
        {
          storyId: "US-003",
          title: "Game Settings - CircuitSlide Lite",
          file: "src/screens/GameSettingsCircuitslideLite.tsx",
          labels: ["Game Settings - CircuitSlide Lite", "Easy", "Medium", "Hard", "Reset to Defaults", "Return", "Save Config"],
        },
      ],
      "US-002",
    );

    assert.equal(result.storyId, "US-003");
    assert.equal(result.title, "Game Settings - CircuitSlide Lite");
    assert.ok(result.score >= 4);
  });

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

  it("accepts Stitch display-only identity labels after semantic PR fixes", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-display-labels-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Operations", file: "src/screens/Operations.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            screenId: "SCR-001",
            title: "Operations",
            buttons: [
              { label: "FleetPulse Matrix", action: "click-action" },
              { label: "FM", action: "click-action" },
              { label: "Fleet Manager", action: "click-action" },
              { label: "Central Command", action: "click-action" },
              { label: "person", action: "click-action" },
              { label: "Save", action: "save" },
            ],
          },
        },
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/Operations.tsx"), [
        "export function Operations({ actions }: any) {",
        "  return <main>",
        "    <h1>FleetPulse Matrix</h1>",
        "    <span aria-hidden=\"true\">FM</span>",
        "    <p>Fleet Manager</p>",
        "    <p>Central Command</p>",
        "    <div aria-hidden=\"true\"><User /></div>",
        "    <button type=\"button\" onClick={actions?.save}>Save</button>",
        "  </main>;",
        "}",
      ].join("\n"));

      const result = await runImplementSupervisorScan({
        runId: "run-display-labels",
        workdir: tmp,
        storyId: "US-001",
        scopeFiles: ["src/screens/Operations.tsx"],
      });

      assert.equal(result.blockers.length, 0);
      assert.equal(result.passed.filter((finding) => /display-only button/.test(finding.message)).length, 5);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("matches form controls by JSX tag and attributes instead of empty visible text", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-form-controls-"));
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
            inputs: [
              { kind: "input", type: "range", label: "range" },
              { kind: "input", type: "select", label: "select" },
            ],
          },
        },
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/Settings.tsx"), [
        "import { useState } from 'react';",
        "export function Settings() {",
        "  const [speed, setSpeed] = useState('1.5');",
        "  const [level, setLevel] = useState('2');",
        "  return <main>",
        "    <input className=\"sr-only\" type=\"checkbox\" />",
        "    <input id=\"signal-speed\" name=\"signal-speed\" type=\"range\" value={speed} onChange={(event) => setSpeed(event.currentTarget.value)} />",
        "    <select id=\"security-clearance\" name=\"security-clearance\" value={level} onChange={(event) => setLevel(event.currentTarget.value)}>",
        "      <option value=\"1\">Easy</option>",
        "      <option value=\"2\">Normal</option>",
        "    </select>",
        "  </main>;",
        "}",
      ].join("\n"));

      const result = await runImplementSupervisorScan({
        runId: "run-form-controls",
        workdir: tmp,
        storyId: "US-001",
        scopeFiles: ["src/screens/Settings.tsx"],
      });

      assert.equal(result.blockers.length, 0);
      assert.equal(result.passed.some((finding) => finding.itemId.endsWith(":input:range")), true);
      assert.equal(result.passed.some((finding) => finding.itemId.endsWith(":input:select")), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not require sample placeholder text as a supervisor input identity", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-sample-placeholder-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Patient Editor", file: "src/screens/PatientEditor.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            screenId: "SCR-001",
            title: "Patient Editor",
            inputs: [
              { kind: "input", type: "text", label: "e.g. Jane Doe", placeholder: "e.g. Jane Doe" },
            ],
          },
        },
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/PatientEditor.tsx"), [
        "export function PatientEditor() {",
        "  return <main>",
        "    <input id=\"patient-name\" name=\"patientName\" type=\"text\" value=\"\" onChange={() => {}} />",
        "  </main>;",
        "}",
      ].join("\n"));

      const checklist = buildSupervisorChecklistFromProject({
        runId: "run-sample-placeholder",
        workdir: tmp,
        storyId: "US-001",
        scopeFiles: ["src/screens/PatientEditor.tsx"],
      });
      assert.equal(checklist.items.some((item) => item.id.includes("e-g-jane-doe")), false);

      const result = scanSupervisorChecklist(tmp, checklist, ["src/screens/PatientEditor.tsx"]);
      assert.equal(result.blockers.length, 0);
      assert.equal(result.passed.some((finding) => finding.itemId.endsWith(":input:text")), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("matches icon-only generated buttons by accessible label, icon, or class signature", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-icon-buttons-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Panel", file: "src/screens/Panel.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            screenId: "SCR-001",
            title: "Panel",
            buttons: [
              { label: "Close", icon: "close", classes: ["text-muted", "p-2", "rounded-DEFAULT", "transition-colors"], action: "dismiss" },
              { label: "help", icon: "help", classes: ["w-touch-target-min", "h-touch-target-min", "items-center", "justify-center", "rounded-DEFAULT"], action: "navigate" },
            ],
          },
        },
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/Panel.tsx"), [
        "import { Circle, X } from 'lucide-react';",
        "export function Panel({ actions }: any) {",
        "  return <main>",
        "    <button aria-label=\"Close\" className=\"text-muted p-2 rounded-DEFAULT transition-colors\" type=\"button\" onClick={actions?.close}><X /></button>",
        "    <button className=\"w-touch-target-min h-touch-target-min flex items-center justify-center rounded-DEFAULT\" type=\"button\" onClick={actions?.help}><Circle /></button>",
        "  </main>;",
        "}",
      ].join("\n"));

      const result = await runImplementSupervisorScan({
        runId: "run-icon-buttons",
        workdir: tmp,
        storyId: "US-001",
        scopeFiles: ["src/screens/Panel.tsx"],
      });

      assert.equal(result.blockers.length, 0);
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

  it("builds checklist link items from DESIGN_DOM navigation arrays", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-navigation-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Main Menu", file: "src/screens/MainMenu.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            screenId: "SCR-001",
            title: "Main Menu",
            navigation: [{ label: "Help", href: "#" }],
            buttons: [{ label: "Start", action: "start" }],
          },
        },
      }));

      const checklist = buildSupervisorChecklistFromProject({ runId: "run-navigation", workdir: tmp });

      assert.equal(checklist.items.some((item) => item.type === "button" && item.label === "Start"), true);
      assert.equal(checklist.items.some((item) => item.type === "link" && item.label === "Help" && item.href === "#"), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("falls back to generated SCREEN_INDEX actions when design DOM is absent", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-screen-index-actions-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        {
          screenId: "SCR-001",
          title: "Main Menu",
          file: "src/screens/MainMenu.tsx",
          actions: [
            { id: "start-1", kind: "button", label: "Start" },
            { id: "help-1", kind: "link", label: "Help", href: "#" },
          ],
        },
      ]));

      const checklist = buildSupervisorChecklistFromProject({ runId: "run-screen-index-actions", workdir: tmp });

      assert.equal(checklist.items.some((item) => item.type === "button" && item.action === "start-1"), true);
      assert.equal(checklist.items.some((item) => item.type === "link" && item.action === "help-1" && item.href === "#"), true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("persists supervisor ledger, interventions, fixer plan, and git artifact exclude", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-ledger-"));
    try {
      fs.mkdirSync(path.join(tmp, ".git/info"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Console", file: "src/screens/Console.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            screenId: "SCR-001",
            title: "Console",
            buttons: [{ label: "Launch", action: "launch" }],
          },
        },
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/Console.tsx"), [
        "export function Console() {",
        "  return <main><button type=\"button\">Launch</button></main>;",
        "}",
      ].join("\n"));

      const runId = "run-ledger";
      await runImplementSupervisorScan({
        runId,
        workdir: tmp,
        storyId: "US-001",
        scopeFiles: ["src/screens/Console.tsx"],
        repeatedBlockerCount: 1,
      });

      const run = readSupervisorRunMetadata(tmp, runId);
      assert.equal(run?.status, "fixing");
      assert.equal(run?.storyId, "US-001");
      assert.equal(fs.existsSync(supervisorInterventionsPath(tmp, runId)), true);
      assert.equal(fs.existsSync(supervisorFixerPlanPath(tmp, runId)), true);
      assert.match(fs.readFileSync(supervisorInterventionsPath(tmp, runId), "utf-8"), /Launch/);
      assert.match(fs.readFileSync(path.join(tmp, ".git/info/exclude"), "utf-8"), /^\.setfarm\/$/m);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("writes supervisor artifact excludes to linked worktree common git metadata", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-worktree-exclude-"));
    const worktree = path.join(tmp, ".worktrees", "story-a");
    try {
      fs.writeFileSync(path.join(tmp, "README.md"), "base\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "README.md"]);
      git(tmp, ["commit", "-m", "base"]);
      git(tmp, ["worktree", "add", "-b", "story-a", worktree, "HEAD"]);

      upsertSupervisorRunMetadata({
        workdir: worktree,
        runId: "run-worktree",
        status: "active",
        storyId: "US-001",
        storyWorkdir: worktree,
      });

      assert.match(fs.readFileSync(path.join(tmp, ".git/info/exclude"), "utf-8"), /^\.setfarm\/$/m);
      assert.doesNotMatch(git(worktree, ["status", "--porcelain=v1", "-uall"]), /\.setfarm\/supervisor/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("persists visual QA result and markdown evidence", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-visual-"));
    try {
      writeSupervisorVisualResult(tmp, {
        schema: "setfarm.supervisor-visual-result.v1",
        runId: "run-visual",
        storyId: "US-002",
        ok: false,
        baseUrl: "http://127.0.0.1:5555",
        routesChecked: ["/"],
        controlsChecked: 1,
        screenshots: [".setfarm/supervisor/run-visual/visual/desktop-root.png"],
        issues: [{
          id: "dead-control-desktop-root-test",
          type: "dead_control",
          severity: "blocker",
          route: "/",
          viewport: "desktop",
          detail: "Start button did not change route, DOM, or focus.",
          screenshot: ".setfarm/supervisor/run-visual/visual/desktop-root.png",
        }],
        artifactDir: path.join(tmp, ".setfarm/supervisor/run-visual/visual"),
        createdAt: "2026-05-16T00:00:00.000Z",
      });

      const result = readSupervisorVisualResult(tmp, "run-visual");
      assert.equal(result?.ok, false);
      assert.equal(result?.issues[0]?.type, "dead_control");
      assert.equal(fs.existsSync(supervisorVisualReportPath(tmp, "run-visual")), true);
      assert.match(fs.readFileSync(supervisorVisualReportPath(tmp, "run-visual"), "utf-8"), /dead_control/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("keeps skipped visual QA as warning and does not clear earlier visual blockers", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-visual-skip-"));
    try {
      const runId = "run-visual-skip";
      applyScanFindings({
        workdir: tmp,
        runId,
        storyId: "US-001",
        findings: [{
          itemId: "visual:dead-control-desktop-root-start",
          storyId: "US-001",
          status: "dead-control",
          severity: "blocker",
          observed: ["Start button produced no visible change."],
          lastScan: "visual-qa",
          files: [],
          message: "Visual QA dead_control on desktop /: Start button produced no visible change.",
          checkedAt: "2026-05-16T00:00:00.000Z",
        }],
      });

      writeSupervisorVisualResult(tmp, {
        schema: "setfarm.supervisor-visual-result.v1",
        runId,
        storyId: "US-001",
        ok: true,
        skipped: true,
        reason: "Playwright browser unavailable",
        routesChecked: [],
        controlsChecked: 0,
        screenshots: [],
        issues: [],
        artifactDir: path.join(tmp, ".setfarm/supervisor/run-visual-skip/visual"),
        createdAt: "2026-05-16T00:01:00.000Z",
      });

      const run = readSupervisorRunMetadata(tmp, runId);
      const state = readSupervisorState(tmp, runId);
      const summary = readSupervisorArtifactSummary({
        id: runId,
        task: `Visual skip sample --repo ${tmp}`,
        context: JSON.stringify({ repo: tmp }),
      });
      assert.equal(run?.status, "warning");
      assert.equal(state.stories["US-001"].status, "blocked");
      assert.equal(state.stories["US-001"].openBlockers.includes("visual:dead-control-desktop-root-start"), true);
      assert.equal(summary.status, "blocked");
      assert.equal(summary.visual.status, "skipped");
      assert.match(fs.readFileSync(supervisorVisualReportPath(tmp, runId), "utf-8"), /Status: skipped/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("clears stale visual blockers after a successful non-skipped visual pass", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-visual-clear-"));
    try {
      const runId = "run-visual-clear";
      applyScanFindings({
        workdir: tmp,
        runId,
        storyId: "US-001",
        findings: [{
          itemId: "visual:layout-overflow-mobile-root-panel",
          storyId: "US-001",
          status: "layout-overflow",
          severity: "blocker",
          observed: ["Panel overflowed the mobile viewport."],
          lastScan: "visual-qa",
          files: [],
          message: "Visual QA layout_overflow on mobile /: Panel overflowed the mobile viewport.",
          checkedAt: "2026-05-16T00:00:00.000Z",
        }],
      });
      assert.equal(readSupervisorState(tmp, runId).projectStatus, "blocked");

      writeSupervisorVisualResult(tmp, {
        schema: "setfarm.supervisor-visual-result.v1",
        runId,
        storyId: "US-001",
        ok: true,
        baseUrl: "http://127.0.0.1:5555",
        routesChecked: ["/"],
        controlsChecked: 3,
        screenshots: [".setfarm/supervisor/run-visual-clear/visual/desktop-root.png"],
        issues: [],
        artifactDir: path.join(tmp, ".setfarm/supervisor/run-visual-clear/visual"),
        createdAt: "2026-05-16T00:01:00.000Z",
      });

      const run = readSupervisorRunMetadata(tmp, runId);
      const state = readSupervisorState(tmp, runId);
      const story = state.stories["US-001"];
      assert.equal(run?.status, "passed");
      assert.equal(story.status, "passed");
      assert.equal(story.openBlockers.length, 0);
      assert.equal(story.resolved.includes("visual:layout-overflow-mobile-root-panel"), true);
      assert.equal(state.evidence["visual:layout-overflow-mobile-root-panel"].status, "passed");
      assert.equal(state.projectStatus, "implementing");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("suppresses browser infrastructure navigation errors before persisting visual QA", () => {
    const result = suppressBrowserInfraIssues({
      ok: false,
      baseUrl: "http://127.0.0.1:5555",
      routesChecked: ["/"],
      controlsChecked: 0,
      screenshots: [],
      issues: [{
        id: "navigation-error-mobile-root",
        type: "navigation_error",
        severity: "blocker",
        route: "/",
        viewport: "mobile",
        detail: "Error: page.goto: Target page, context or browser has been closed",
      }],
      artifactDir: "/tmp/visual",
    });

    assert.equal(result.ok, true);
    assert.equal(result.issues.length, 0);
    assert.match(String(result.reason), /Browser infrastructure navigation errors/);
  });

  it("suppresses browser infrastructure click errors misreported as dead controls", () => {
    const result = suppressBrowserInfraIssues({
      ok: false,
      baseUrl: "http://127.0.0.1:5555",
      routesChecked: ["/"],
      controlsChecked: 1,
      screenshots: [],
      issues: [{
        id: "dead-control-mobile-root-refresh",
        type: "dead_control",
        severity: "blocker",
        route: "/",
        viewport: "mobile",
        detail: "Refresh: page.locator.click: Target page, context or browser has been closed",
      }],
      artifactDir: "/tmp/visual",
    });

    assert.equal(result.ok, true);
    assert.equal(result.issues.length, 0);
    assert.match(String(result.reason), /Browser infrastructure navigation errors/);
  });

  it("summarizes supervisor artifacts for dashboard and Mission Control", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-supervisor-summary-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Console", file: "src/screens/Console.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            screenId: "SCR-001",
            title: "Console",
            buttons: [{ label: "Launch", action: "launch" }],
          },
        },
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/Console.tsx"), [
        "export function Console() {",
        "  return <button type=\"button\">Launch</button>;",
        "}",
      ].join("\n"));

      const runId = "run-summary";
      await runImplementSupervisorScan({
        runId,
        workdir: tmp,
        storyId: "US-001",
        scopeFiles: ["src/screens/Console.tsx"],
        repeatedBlockerCount: 1,
      });
      writeSupervisorVisualResult(tmp, {
        schema: "setfarm.supervisor-visual-result.v1",
        runId,
        ok: false,
        routesChecked: ["/"],
        controlsChecked: 1,
        screenshots: [path.join(tmp, ".setfarm/supervisor/run-summary/visual/desktop-root.png")],
        issues: [{
          id: "dead-control-desktop-root-launch",
          type: "dead_control",
          severity: "blocker",
          route: "/",
          viewport: "desktop",
          detail: "Launch button did not change route, DOM, or focus.",
        }],
        artifactDir: path.join(tmp, ".setfarm/supervisor/run-summary/visual"),
        createdAt: "2026-05-16T00:00:00.000Z",
      });

      const summary = readSupervisorArtifactSummary({
        id: runId,
        task: `Build sample --repo ${tmp}`,
        context: JSON.stringify({ repo: tmp }),
      });

      assert.equal(summary.available, true);
      assert.equal(summary.status, "fixing");
      assert.equal(summary.openBlockers, 1);
      assert.equal(summary.pendingInterventions, 1);
      assert.equal(summary.checklistItems, 1);
      assert.equal(summary.visual.status, "fail");
      assert.equal(summary.visual.issueCount, 1);
      assert.ok(summary.artifacts.fixerPlan);
      assert.match(summary.interventionText || "", /Launch/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
