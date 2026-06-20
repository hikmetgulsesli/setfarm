import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildStackMemory } from "../src/installer/stack-memory.js";

const repoRoot = process.cwd();

test("stack memory resolves only global plus requested stack", () => {
  const result = buildStackMemory({
    repoRoot,
    stackPackId: "static-html-site",
    maxChars: 20000,
  });

  assert.deepEqual(result.files.sort(), [
    "memory/global.md",
    "memory/stacks/static-html-site.md",
  ].sort());
  assert.match(result.text, /# Setfarm Memory/);
  assert.match(result.text, /static-html-site Memory/);
  assert.doesNotMatch(result.text, /browser-game-canvas Memory/);
  assert.doesNotMatch(result.text, /nextjs-web-app Memory/);
});

test("stack memory maps semantic action id regression to recovery notes", () => {
  const result = buildStackMemory({
    repoRoot,
    stackPackId: "browser-game-canvas",
    failureCategory: "APP_INTEGRATION_SEMANTIC_REGRESSION",
    maxChars: 20000,
  });

  assert.equal(result.files.includes("memory/failures/semantic-action-id-equivalence.md"), true);
  assert.match(result.text, /semantic_action_id_equivalence|semantic/i);
  assert.match(result.text, /data-action-id/);
});

test("stack memory maps icon fallback failures to repairable UI fidelity memory", () => {
  for (const failureCategory of ["GENERATED_ICON_FALLBACK", "UNKNOWN_MATERIAL_ICONS", "DESIGN_ICON_FALLBACK_WARNING"]) {
    const result = buildStackMemory({
      repoRoot,
      stackPackId: "vite-react-web-app",
      failureCategory,
      maxChars: 20000,
    });
    assert.equal(result.files.includes("memory/failures/missing-icon-asset.md"), true, failureCategory);
    assert.match(result.text, /Supervisor should route this as repairable UI fidelity work/, failureCategory);
  }
});

test("every declared stack memory file is present", () => {
  const required = [
    "static-html-site",
    "vite-react-web-app",
    "nextjs-web-app",
    "browser-game-canvas",
    "node-express-api",
    "node-cli",
    "python-cli",
    "python-web",
    "react-native-expo",
    "android-app",
    "ios-app",
    "desktop-electron",
  ];

  for (const stack of required) {
    const result = buildStackMemory({ repoRoot, stackPackId: stack, maxChars: 20000 });
    assert.equal(result.files.includes(`memory/stacks/${stack}.md`), true, stack);
    assert.equal(fs.existsSync(path.join(repoRoot, "memory", "stacks", `${stack}.md`)), true, stack);
  }
});

test("stack memory truncates run notes without dropping selected files", () => {
  const result = buildStackMemory({
    repoRoot,
    stackPackId: "node-cli",
    runNotes: "x".repeat(5000),
    maxChars: 1200,
  });

  assert.equal(result.files.includes("memory/stacks/node-cli.md"), true);
  assert.match(result.text, /stack memory truncated/);
});
