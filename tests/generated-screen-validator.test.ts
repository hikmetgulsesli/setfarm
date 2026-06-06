import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function makeRepo(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-screen-validator-"));
  fs.mkdirSync(path.join(tmp, "src", "screens"), { recursive: true });
  return tmp;
}

function writeIndex(repo: string, entries: unknown[]): void {
  fs.writeFileSync(
    path.join(repo, "src", "screens", "SCREEN_INDEX.json"),
    `${JSON.stringify(entries, null, 2)}\n`,
  );
}

function writeScreen(repo: string, fileName: string, code: string): void {
  fs.writeFileSync(path.join(repo, "src", "screens", fileName), code);
}

function runValidator(repo: string, args: string[] = []): void {
  execFileSync("node", ["scripts/generated-screen-validator.mjs", repo, ...args], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
}

function readReport(repo: string): any {
  return JSON.parse(fs.readFileSync(path.join(repo, ".setfarm", "setup", "DESIGN_IMPORT_VALIDATE.json"), "utf-8"));
}

describe("generated-screen-validator", () => {
  it("passes a typed generated screen with preserved action id and callback wiring", () => {
    const repo = makeRepo();
    try {
      writeScreen(repo, "HomeScreen.tsx", `
import { Info } from "lucide-react";

export type HomeScreenActionId = "start-session-1";
export interface HomeScreenProps {
  actions?: Partial<Record<HomeScreenActionId, () => void>>;
}

export function HomeScreen({ actions }: HomeScreenProps) {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Info aria-hidden={true} focusable="false" />
      <button type="button" data-action-id="start-session-1" onClick={actions?.["start-session-1"]}>Start Session</button>
    </main>
  );
}
`);
      writeIndex(repo, [{
        title: "Home Screen",
        componentName: "HomeScreen",
        file: "src/screens/HomeScreen.tsx",
        actions: [{ id: "start-session-1", kind: "button", label: "Start Session", index: 0 }],
      }]);

      runValidator(repo);
      const report = readReport(repo);
      assert.equal(report.status, "pass");
      assert.deepEqual(report.failedRules, []);
      assert.deepEqual(report.screensValidated, ["src/screens/HomeScreen.tsx"]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("fails when DESIGN_DOM has no extracted controls for an interactive UI contract", () => {
    const repo = makeRepo();
    try {
      fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(repo, "stitch", "SCREEN_MAP.json"), JSON.stringify([
        { screenId: "settings-1", name: "Settings", surfaceIds: ["SURF_SETTINGS"] },
      ]));
      fs.writeFileSync(path.join(repo, "stitch", "UI_CONTRACT.json"), JSON.stringify([
        {
          screenId: "settings-1",
          screenTitle: "Settings",
          buttons: [{ label: "Save Preferences" }],
          inputs: [{ label: "range", inputType: "range" }],
          totalInteractive: 2,
        },
      ]));
      fs.writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        generatedAt: "2026-05-28T00:00:00.000Z",
        screenCount: 1,
        screens: {
          "settings-1": { screenId: "settings-1", components: [] },
        },
      }));
      writeScreen(repo, "Settings.tsx", `
export function Settings() {
  return <main><button type="button">Save Preferences</button></main>;
}
`);
      writeIndex(repo, [{ title: "Settings", componentName: "Settings", file: "src/screens/Settings.tsx", actions: [] }]);

      assert.throws(() => runValidator(repo));
      const report = readReport(repo);
      assert.equal(report.status, "fail");
      assert.ok(report.failedRules.some((rule: any) => rule.code === "DESIGN_DOM_EXTRACTION_EMPTY"));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("fails when generated screen source coverage is lower than SCREEN_MAP", () => {
    const repo = makeRepo();
    try {
      fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(repo, "stitch", "SCREEN_MAP.json"), JSON.stringify([
        { screenId: "gameplay-1", name: "Gameplay" },
        { screenId: "settings-1", name: "Settings" },
      ]));
      fs.writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "gameplay-1": { screenId: "gameplay-1", buttons: [{ label: "Start" }] },
          "settings-1": { screenId: "settings-1", buttons: [{ label: "Save Preferences" }] },
        },
      }));
      writeScreen(repo, "Gameplay.tsx", `
export function Gameplay() {
  return <main><button type="button">Start</button></main>;
}
`);
      writeIndex(repo, [{ title: "Gameplay", componentName: "Gameplay", file: "src/screens/Gameplay.tsx", actions: [] }]);

      assert.throws(() => runValidator(repo));
      const report = readReport(repo);
      assert.equal(report.status, "fail");
      assert.ok(report.failedRules.some((rule: any) => rule.code === "DESIGN_IMPORT_SCREEN_COVERAGE_MISSING"));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("fails when FILE_TREE_MANIFEST declares a generated screen file that is missing", () => {
    const repo = makeRepo();
    try {
      fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(repo, ".setfarm", "setup"), { recursive: true });
      fs.writeFileSync(path.join(repo, "stitch", "SCREEN_MAP.json"), JSON.stringify([
        { screenId: "gameplay-1", name: "Gameplay", surfaceIds: ["SURF_GAMEPLAY"] },
        { screenId: "settings-1", name: "Settings", surfaceIds: ["SURF_SETTINGS"] },
      ]));
      fs.writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "gameplay-1": { screenId: "gameplay-1", buttons: [{ label: "Start" }] },
          "settings-1": { screenId: "settings-1", buttons: [{ label: "Save Preferences" }] },
        },
      }));
      fs.writeFileSync(path.join(repo, ".setfarm", "setup", "FILE_TREE_MANIFEST.json"), JSON.stringify({
        schema: "setfarm.file-tree-manifest.v1",
        resolvedTargets: [
          {
            storyId: "US-001",
            role: "surface_component",
            surfaceId: "SURF_GAMEPLAY",
            screenId: "gameplay-1",
            path: "src/screens/Gameplay.tsx",
            resolvedPath: "src/screens/Gameplay.tsx",
          },
          {
            storyId: "US-002",
            role: "surface_component",
            surfaceId: "SURF_SETTINGS",
            screenId: "settings-1",
            path: "src/screens/Settings.tsx",
            resolvedPath: "src/screens/Settings.tsx",
          },
        ],
      }));
      writeScreen(repo, "Gameplay.tsx", `
export function Gameplay() {
  return <main><button type="button">Start</button></main>;
}
`);
      writeIndex(repo, [{
        screenId: "gameplay-1",
        title: "Gameplay",
        componentName: "Gameplay",
        file: "src/screens/Gameplay.tsx",
        actions: [],
      }]);

      assert.throws(() => runValidator(repo));
      const report = readReport(repo);
      assert.equal(report.status, "fail");
      assert.ok(report.failedRules.some((rule: any) => rule.code === "DESIGN_IMPORT_MANIFEST_FILE_MISSING"));
      assert.ok(report.failedRules.some((rule: any) => rule.code === "DESIGN_IMPORT_SCREEN_INDEX_MISMATCH"));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("fails gameplay screens that keep game objects as static placeholders", () => {
    const repo = makeRepo();
    try {
      fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(repo, "stitch", "SCREEN_MAP.json"), JSON.stringify([
        { screenId: "gameplay-1", name: "Gameplay", type: "game", surfaceIds: ["SURF_GAMEPLAY"] },
      ]));
      writeScreen(repo, "Gameplay.tsx", `
export type GameplayActionId = "start-1";
export interface GameplayProps {
  actions?: Partial<Record<GameplayActionId, () => void>>;
  runtime?: Pick<{ status: string; score: number }, "status" | "score">;
}
export function Gameplay({ actions, runtime }: GameplayProps) {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <button type="button" data-action-id="start-1" onClick={actions?.["start-1"]}>Start</button>
      <div className="absolute top-1/2 left-1/3 rounded-full">Ball</div>
      <div className="absolute bottom-8 left-1/2">Paddle</div>
    </main>
  );
}
`);
      writeIndex(repo, [{
        screenId: "gameplay-1",
        title: "Gameplay",
        componentName: "Gameplay",
        file: "src/screens/Gameplay.tsx",
        actions: [{ id: "start-1", kind: "button", label: "Start", index: 0 }],
      }]);

      assert.throws(() => runValidator(repo));
      const report = readReport(repo);
      assert.equal(report.status, "fail");
      assert.ok(report.failedRules.some((rule: any) => rule.code === "DESIGN_IMPORT_GAME_DYNAMIC_BINDING_MISSING"));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("accepts React-cased SVG viewBox while still rejecting lowercase viewbox", () => {
    const repo = makeRepo();
    try {
      writeScreen(repo, "Gameplay.tsx", `
export function Gameplay() {
  return <main><svg viewBox="0 0 24 24"><path strokeWidth={2} d="M1 1h2" /></svg></main>;
}
`);
      writeIndex(repo, [{ title: "Gameplay", componentName: "Gameplay", file: "src/screens/Gameplay.tsx", actions: [] }]);

      runValidator(repo);
      assert.equal(readReport(repo).status, "pass");

      writeScreen(repo, "Gameplay.tsx", `
export function Gameplay() {
  return <main><svg viewbox="0 0 24 24"><path d="M1 1h2" /></svg></main>;
}
`);

      assert.throws(() => runValidator(repo));
      const report = readReport(repo);
      assert.equal(report.status, "fail");
      assert.ok(report.failedRules.some((rule: any) => rule.code === "DESIGN_IMPORT_INVALID_PROP" && rule.prop === "viewbox"));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("fails Lucide icon props that React cannot typecheck", () => {
    const repo = makeRepo();
    try {
      writeScreen(repo, "IconScreen.tsx", `
import { Info } from "lucide-react";

export function IconScreen() {
  return <main><Info title="Details" aria-hidden={true} /></main>;
}
`);
      writeIndex(repo, [{ title: "Icon Screen", componentName: "IconScreen", file: "src/screens/IconScreen.tsx", actions: [] }]);

      assert.throws(() => runValidator(repo));
      const report = readReport(repo);
      assert.equal(report.status, "fail");
      assert.equal(report.failedRules[0].code, "DESIGN_IMPORT_ICON_PROP_INVALID");
      assert.equal(report.failedRules[0].prop, "title");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("fails positioned full-width utilities that are known to create mobile overflow", () => {
    const repo = makeRepo();
    try {
      writeScreen(repo, "LayoutScreen.tsx", `
export function LayoutScreen() {
  return <header className="fixed top-0 left-16 right-0 w-full z-50">Toolbar</header>;
}
`);
      writeIndex(repo, [{ title: "Layout Screen", componentName: "LayoutScreen", file: "src/screens/LayoutScreen.tsx", actions: [] }]);

      assert.throws(() => runValidator(repo));
      const report = readReport(repo);
      assert.equal(report.status, "fail");
      assert.equal(report.failedRules[0].code, "DESIGN_IMPORT_LAYOUT_UNSAFE");
      assert.match(report.failedRules[0].className, /w-full/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("auto-fixes generated horizontal boards that would overflow mobile viewports", () => {
    const repo = makeRepo();
    try {
      writeScreen(repo, "QueueScreen.tsx", `
export function QueueScreen() {
  return (
    <main>
      <div className="flex-1 overflow-x-auto p-lg bg-background flex gap-gutter items-start">
        <div className="kanban-column flex flex-col h-full bg-surface-container-lowest border border-outline-variant rounded flex-shrink-0">
          Lane
        </div>
      </div>
    </main>
  );
}
`);
      writeIndex(repo, [{ title: "Queue Screen", componentName: "QueueScreen", file: "src/screens/QueueScreen.tsx", actions: [] }]);

      assert.throws(() => runValidator(repo));
      let report = readReport(repo);
      assert.equal(report.status, "fail");
      assert.deepEqual(report.failedRules.map((rule: any) => rule.code), [
        "DESIGN_IMPORT_MOBILE_OVERFLOW_UNSAFE",
        "DESIGN_IMPORT_MOBILE_OVERFLOW_UNSAFE",
      ]);

      runValidator(repo, ["--fix"]);
      report = readReport(repo);
      const code = fs.readFileSync(path.join(repo, "src", "screens", "QueueScreen.tsx"), "utf-8");
      assert.equal(report.status, "pass");
      assert.ok(report.fixesApplied.some((fix: any) => fix.ruleId === "CONV-005"));
      assert.match(code, /overflow-x-visible/);
      assert.match(code, /md:overflow-x-auto/);
      assert.match(code, /flex-col/);
      assert.match(code, /md:flex-row/);
      assert.match(code, /items-stretch/);
      assert.match(code, /md:items-start/);
      assert.match(code, /w-full/);
      assert.match(code, /md:w-72/);
      assert.match(code, /md:flex-shrink-0/);
      assert.doesNotMatch(code, /className="[^"]*(?:^|\s)flex-shrink-0(?:\s|")/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("auto-fixes generated fixed square playfields that would overflow mobile viewports", () => {
    const repo = makeRepo();
    try {
      writeScreen(repo, "GameplayScreen.tsx", `
export function GameplayScreen() {
  return (
    <main className="relative min-h-screen overflow-hidden p-4">
      <div className="relative w-[384px] h-[384px] md:w-[512px] md:h-[512px] overflow-hidden border border-outline flex-shrink-0">
        Playfield
      </div>
    </main>
  );
}
`);
      writeIndex(repo, [{ title: "Gameplay Screen", componentName: "GameplayScreen", file: "src/screens/GameplayScreen.tsx", actions: [] }]);

      assert.throws(() => runValidator(repo));
      let report = readReport(repo);
      assert.equal(report.status, "fail");
      assert.deepEqual(report.failedRules.map((rule: any) => rule.code), [
        "DESIGN_IMPORT_MOBILE_OVERFLOW_UNSAFE",
      ]);

      runValidator(repo, ["--fix"]);
      report = readReport(repo);
      const code = fs.readFileSync(path.join(repo, "src", "screens", "GameplayScreen.tsx"), "utf-8");
      assert.equal(report.status, "pass");
      assert.ok(report.fixesApplied.some((fix: any) => fix.ruleId === "CONV-005"));
      assert.match(code, /w-\[calc\(100vw-48px\)\]/);
      assert.match(code, /max-w-\[360px\]/);
      assert.match(code, /aspect-square/);
      assert.match(code, /md:w-\[512px\]/);
      assert.match(code, /md:h-\[512px\]/);
      assert.match(code, /md:max-w-none/);
      assert.doesNotMatch(code, /className="[^"]*(?:^|\s)w-\[384px\](?:\s|")/);
      assert.doesNotMatch(code, /className="[^"]*(?:^|\s)h-\[384px\](?:\s|")/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("auto-fixes absolute centered playfield shapes missing translate centering", () => {
    const repo = makeRepo();
    try {
      writeScreen(repo, "DialScreen.tsx", `
export function DialScreen() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full border border-primary">Gate</div>
      <div className="absolute top-1/2 left-1/2 w-6 h-6 rounded-full bg-primary">Signal</div>
    </main>
  );
}
`);
      writeIndex(repo, [{ title: "Dial Screen", componentName: "DialScreen", file: "src/screens/DialScreen.tsx", actions: [] }]);

      assert.throws(() => runValidator(repo));
      let report = readReport(repo);
      assert.equal(report.status, "fail");
      assert.deepEqual(report.failedRules.map((rule: any) => rule.code), [
        "DESIGN_IMPORT_CENTERED_ABSOLUTE_UNSAFE",
        "DESIGN_IMPORT_CENTERED_ABSOLUTE_UNSAFE",
      ]);

      runValidator(repo, ["--fix"]);
      report = readReport(repo);
      const code = fs.readFileSync(path.join(repo, "src", "screens", "DialScreen.tsx"), "utf-8");
      assert.equal(report.status, "pass");
      assert.ok(report.fixesApplied.some((fix: any) => fix.ruleId === "CONV-006"));
      assert.match(code, /w-\[300px\] h-\[300px\] rounded-full[^"]*transform[^"]*-translate-x-1\/2[^"]*-translate-y-1\/2/);
      assert.match(code, /w-6 h-6 rounded-full[^"]*transform[^"]*-translate-x-1\/2[^"]*-translate-y-1\/2/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("fails when SCREEN_INDEX actions lose data-action-id or callback wiring", () => {
    const repo = makeRepo();
    try {
      writeScreen(repo, "ActionScreen.tsx", `
export type ActionScreenActionId = "save-record-1";
export interface ActionScreenProps {
  actions?: Partial<Record<ActionScreenActionId, () => void>>;
}
export function ActionScreen({ actions }: ActionScreenProps) {
  return <button type="button" onClick={actions?.["save-record-1"]}>Save</button>;
}
`);
      writeIndex(repo, [{
        title: "Action Screen",
        componentName: "ActionScreen",
        file: "src/screens/ActionScreen.tsx",
        actions: [{ id: "save-record-1", kind: "button", label: "Save", index: 0 }],
      }]);

      assert.throws(() => runValidator(repo));
      const report = readReport(repo);
      assert.equal(report.status, "fail");
      assert.deepEqual(report.failedRules.map((rule: any) => rule.code), ["DESIGN_IMPORT_ACTION_ID_LOST"]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("accepts action ids and callbacks written as JSX expression literals", () => {
    const repo = makeRepo();
    try {
      writeScreen(repo, "ExpressionActionScreen.tsx", `
export type ExpressionActionScreenActionId = "save-record-1";
export interface ExpressionActionScreenProps {
  actions?: Partial<Record<ExpressionActionScreenActionId, () => void>>;
}
export function ExpressionActionScreen({ actions }: ExpressionActionScreenProps) {
  return <button type="button" data-action-id={'save-record-1'} onClick={actions?.['save-record-1']}>Save</button>;
}
`);
      writeIndex(repo, [{
        title: "Expression Action Screen",
        componentName: "ExpressionActionScreen",
        file: "src/screens/ExpressionActionScreen.tsx",
        actions: [{ id: "save-record-1", kind: "button", label: "Save", index: 0 }],
      }]);

      runValidator(repo);
      const report = readReport(repo);
      assert.equal(report.status, "pass");
      assert.deepEqual(report.failedRules, []);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("fails controlled form controls that would lock generated inputs", () => {
    const repo = makeRepo();
    try {
      writeScreen(repo, "ControlledScreen.tsx", `
export function ControlledScreen() {
  return (
    <form>
      <input value="abc" />
      <input type="checkbox" checked={true} />
    </form>
  );
}
`);
      writeIndex(repo, [{ title: "Controlled Screen", componentName: "ControlledScreen", file: "src/screens/ControlledScreen.tsx", actions: [] }]);

      assert.throws(() => runValidator(repo));
      const report = readReport(repo);
      assert.equal(report.status, "fail");
      assert.equal(report.rootCauseCategory, "design_import_failure");
      assert.deepEqual(report.failedRules.map((rule: any) => rule.code), [
        "DESIGN_IMPORT_CONTROLLED_INPUT_UNSAFE",
        "DESIGN_IMPORT_CONTROLLED_INPUT_UNSAFE",
      ]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("auto-fixes deterministic converter issues before reporting pass", () => {
    const repo = makeRepo();
    try {
      writeScreen(repo, "FixableScreen.tsx", `
import { Info } from "lucide-react";

export function FixableScreen() {
  return (
    <header class="fixed top-0 left-16 right-0 w-full" for="bad">
      <Info title="Details" stroke-width="2" />
      <input value="Preset" checked={true} />
    </header>
  );
}
`);
      writeIndex(repo, [{ title: "Fixable Screen", componentName: "FixableScreen", file: "src/screens/FixableScreen.tsx", actions: [] }]);

      runValidator(repo, ["--fix"]);
      const report = readReport(repo);
      const code = fs.readFileSync(path.join(repo, "src", "screens", "FixableScreen.tsx"), "utf-8");
      assert.equal(report.status, "pass");
      assert.ok(report.fixesApplied.length >= 4, "fix mode should record deterministic fixes");
      assert.match(code, /className=/);
      assert.match(code, /htmlFor=/);
      assert.doesNotMatch(code, /\stitle=/);
      assert.doesNotMatch(code, /w-full/);
      assert.match(code, /strokeWidth=/);
      assert.match(code, /\sdefaultValue=/);
      assert.match(code, /\sdefaultChecked=/);
      assert.doesNotMatch(code, /\svalue=/);
      assert.doesNotMatch(code, /\schecked=/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
