import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runQualityChecks } from "../dist/installer/quality-gates.js";

describe("quality gates", () => {
  it("blocks generated sibling sidebar/content screens mounted in non-flex app roots", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-quality-generated-layout-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        {
          screenId: "board",
          title: "Board",
          componentName: "BoardScreen",
          file: "src/screens/BoardScreen.tsx",
        },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/BoardScreen.tsx"), [
        "export function BoardScreen() {",
        "  return (<>",
        "    <aside className=\"h-screen w-[260px] shrink-0 hidden md:flex\">Nav</aside>",
        "    <main className=\"flex-1 h-screen\">Board</main>",
        "  </>);",
        "}",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { BoardScreen } from './screens/BoardScreen';",
        "export default function App() {",
        "  return <div data-setfarm-root=\"app\" className=\"min-h-screen bg-white\"><BoardScreen /></div>;",
        "}",
        "",
      ].join("\n"));

      const issues = runQualityChecks(tmp);
      assert.equal(issues.some((issue) => issue.severity === "error" && issue.rule === "generated_screen_shell_layout"), true);
      assert.match(issues.map((issue) => issue.detail).join("\n"), /GENERATED_SCREEN_LAYOUT_MOUNT_UNSAFE/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks generated runtime semantic shortcuts", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-quality-runtime-semantics-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "triage", title: "Triage", componentName: "TriageScreen", file: "src/screens/TriageScreen.tsx" },
        { screenId: "reports", title: "Reports", componentName: "ReportsScreen", file: "src/screens/ReportsScreen.tsx" },
        { screenId: "settings", title: "Settings", componentName: "SettingsScreen", file: "src/screens/SettingsScreen.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "src/screens/TriageScreen.tsx"), [
        "import { BadgeHelp } from 'lucide-react';",
        "export function TriageScreen() { return <a href=\"#\"><BadgeHelp />Reports</a>; }",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/screens/ReportsScreen.tsx"), "export function ReportsScreen() { return <main>Reports</main>; }\n");
      fs.writeFileSync(path.join(tmp, "src/screens/SettingsScreen.tsx"), "export function SettingsScreen() { return <main>Settings</main>; }\n");
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), [
        "import { TriageScreen } from './screens/TriageScreen';",
        "import { ReportsScreen } from './screens/ReportsScreen';",
        "export default function App({ activeRoute }: any) {",
        "  if (activeRoute !== 'triage') return <ReportsScreen />;",
        "  return <TriageScreen />;",
        "}",
        "",
      ].join("\n"));

      const issues = runQualityChecks(tmp);
      assert.equal(issues.some((issue) => issue.severity === "error" && issue.rule === "generated_runtime_semantics"), true);
      assert.equal(issues.some((issue) => issue.severity === "warning" && issue.rule === "generated_supervisor_quality"), true);
      assert.match(issues.filter((issue) => issue.severity === "error").map((issue) => issue.detail).join("\n"), /GENERATED_ROUTE_COLLAPSE/);
      assert.match(issues.filter((issue) => issue.severity === "warning").map((issue) => issue.detail).join("\n"), /GENERATED_ICON_FALLBACK/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
