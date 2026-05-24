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
