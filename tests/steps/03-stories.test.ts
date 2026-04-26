import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { storiesModule } from "../../dist/installer/steps/03-stories/module.js";
import {
  collectUiBehaviorRequirements,
  computeUiBehaviorContract,
  extractExplicitMaxStories,
} from "../../dist/installer/steps/03-stories/context.js";
import {
  detectStorySemanticDrift,
  detectUiBehaviorContractGaps,
  extractStoryDomainTerms,
} from "../../dist/installer/steps/03-stories/guards.js";
import { normalizeScopeFilesForStory } from "../../dist/installer/story-ops.js";
import { runModule } from "./harness.js";

describe("03-stories step module", () => {
  it("happy path: STATUS=done passes validation + prompt under budget", async () => {
    const result = await runModule(storiesModule, "Test", { status: "done" });
    assert.ok(result.validation.ok);
    assert.ok(result.promptBytes < storiesModule.maxPromptSize,
      `prompt ${result.promptBytes} >= budget ${storiesModule.maxPromptSize}`);
  });

  it("STATUS missing rejected", async () => {
    const result = await runModule(storiesModule, "Test", { status: "" });
    assert.equal(result.validation.ok, false);
  });

  it("module metadata correct", () => {
    assert.equal(storiesModule.id, "stories");
    assert.equal(storiesModule.type, "single");
    assert.equal(storiesModule.agentRole, "planner");
    assert.equal(storiesModule.maxPromptSize, 32768);
  });

  it("prompt includes scope_files and predicted_screen_files mentions", async () => {
    const result = await runModule(storiesModule, "Test", { status: "done" });
    assert.ok(result.prompt.includes("scope_files"), "prompt should mention scope_files");
    assert.ok(result.prompt.includes("PREDICTED_SCREEN_FILES"), "prompt should mention predicted screens");
    assert.ok(result.prompt.includes("DESIGN_DOM_PREVIEW"), "prompt should mention design DOM preview section");
    assert.equal(result.prompt.includes("{{DESIGN_DOM_PREVIEW}}"), false, "prompt should resolve design DOM placeholder");
    assert.ok(result.prompt.includes("STORIES_JSON"), "prompt should mention STORIES_JSON");
    assert.equal(result.prompt.includes("src/hooks/useCounter.ts"), false, "prompt should not bias output toward a counter scaffold path");
    assert.equal(result.prompt.includes("CounterDisplay"), false, "prompt should not bias output toward a counter component");
  });

  it("extracts explicit Turkish and English story caps", () => {
    assert.equal(extractExplicitMaxStories("Maksimum 1 story üret."), 1);
    assert.equal(extractExplicitMaxStories("maks 2 adet story olsun"), 2);
    assert.equal(extractExplicitMaxStories("En çok 3 story yaz"), 3);
    assert.equal(extractExplicitMaxStories("4 stories maximum"), 4);
    assert.equal(extractExplicitMaxStories("story listesi üret"), null);
  });

  it("extracts stable domain terms from task and PRD", () => {
    const terms = extractStoryDomainTerms(
      "Basit sayaç uygulaması: arttır, azalt, sıfırla, değer localStorage içinde saklansın.",
      "Sayaç değeri görüntülenir. Kullanıcı Arttır, Azalt ve Sıfırla butonlarını kullanır."
    );
    assert.ok(terms.includes("sayac"));
    assert.ok(terms.includes("arttir"));
    assert.ok(terms.includes("azalt"));
    assert.ok(terms.includes("sifirla"));
  });

  it("rejects stories that drift into another project concept", () => {
    const err = detectStorySemanticDrift(
      {
        task: "Basit sayaç uygulaması: arttır, azalt, sıfırla, değer localStorage içinde saklansın.",
        prd: "Sayaç değeri gösterilir. Arttır, azalt ve sıfırla aksiyonları desteklenir.",
      },
      [{
        story_id: "US-001",
        title: "Renk Koru — Kurulum ve Tüm Oyun Akışı",
        description: "Renk körlüğü testi uygulaması: seviye seçimi ve Ishihara oyun döngüsü.",
        acceptance_criteria: JSON.stringify(["Başla butonu seviye seçimine geçer", "10 soru sonunda skor gösterilir"]),
        scope_description: "Tek story oyun akışı",
        scope_files: JSON.stringify(["src/hooks/useGame.ts", "src/components/IshiharaCircle.tsx"]),
      }]
    );
    assert.match(err || "", /semantic drift/i);
  });

  it("accepts stories that preserve the original project concept", () => {
    const err = detectStorySemanticDrift(
      {
        task: "Basit sayaç uygulaması: arttır, azalt, sıfırla, değer localStorage içinde saklansın.",
        prd: "Sayaç değeri gösterilir. Arttır, azalt ve sıfırla aksiyonları desteklenir.",
      },
      [{
        story_id: "US-001",
        title: "Sayaç — kurulum, UI ve localStorage akışı",
        description: "Sayaç değeri, arttır, azalt ve sıfırla aksiyonları tek story içinde uygulanır.",
        acceptance_criteria: JSON.stringify(["Arttır butonu sayacı artırır", "Azalt butonu sayacı azaltır", "Sıfırla butonu sayacı sıfırlar"]),
        scope_description: "Tek story sayaç akışı",
        scope_files: JSON.stringify(["src/hooks/useCounter.ts", "src/screens/AnaSayfa.tsx"]),
      }]
    );
    assert.equal(err, null);
  });

  it("builds a UI behavior contract from DESIGN_DOM", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-dom-"));
    try {
      mkdirSync(path.join(repo, "stitch"));
      writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            title: "Ana",
            behaviorContract: [
              { kind: "button", label: "Ayarlar", icon: "settings", route: "/settings", expectedBehavior: "navigate:/settings" },
              { kind: "button", label: "Artır", icon: "add", action: "increment", expectedBehavior: "increase visible value" },
            ],
          },
        },
      }));

      const reqs = collectUiBehaviorRequirements(repo);
      assert.equal(reqs.length, 2);
      const contract = computeUiBehaviorContract(repo);
      assert.match(contract, /Ayarlar/);
      assert.match(contract, /Artır/);
      assert.match(contract, /navigate:\/settings/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("rejects stories that do not cover Stitch behavior controls", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-dom-"));
    try {
      mkdirSync(path.join(repo, "stitch"));
      writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            title: "Ana",
            behaviorContract: [
              { kind: "button", label: "Ayarlar", icon: "settings", route: "/settings", expectedBehavior: "navigate:/settings" },
              { kind: "button", label: "Artır", icon: "add", action: "increment", expectedBehavior: "increase visible value" },
            ],
          },
        },
      }));

      const missing = detectUiBehaviorContractGaps(repo, [{
        story_id: "US-001",
        title: "Sayaç — ana ekran",
        description: "Sayaç değeri görüntülenir.",
        acceptance_criteria: JSON.stringify(["Artır butonu sayacı artırır"]),
        scope_description: "Ana sayaç akışı",
        scope_files: JSON.stringify(["src/screens/Ana.tsx"]),
      }]);
      assert.match(missing || "", /Ayarlar/);

      const ok = detectUiBehaviorContractGaps(repo, [{
        story_id: "US-001",
        title: "Sayaç — ana ekran ve ayarlar",
        description: "Ayarlar paneli ve sayaç artırma akışı uygulanır.",
        acceptance_criteria: JSON.stringify([
          "Ayarlar/settings ikon butonu /settings paneline gider.",
          "Artır butonu sayaç değerini artırır.",
        ]),
        scope_description: "Ana sayaç ve ayarlar akışı",
        scope_files: JSON.stringify(["src/screens/Ana.tsx"]),
      }]);
      assert.equal(ok, null);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("adds frontend integration files to a single-story frontend scope", () => {
    const scope = normalizeScopeFilesForStory([
      "src/hooks/useCounter.ts",
      "src/components/CounterControls/CounterControls.tsx",
      "src/screens/AnaSayfaSayacEkrani.tsx",
      "package.json",
      "tsconfig.json",
      "vite.config.ts",
    ], 1);

    assert.deepEqual(scope, [
      "src/hooks/useCounter.ts",
      "src/components/CounterControls/CounterControls.tsx",
      "src/screens/AnaSayfaSayacEkrani.tsx",
      "src/App.tsx",
      "src/App.css",
      "src/main.tsx",
      "src/index.css",
    ]);
  });

  it("removes setup-owned toolchain files from frontend story scopes", () => {
    const scope = normalizeScopeFilesForStory([
      "src/App.tsx",
      "src/screens/AnaSayfa.tsx",
      "package.json",
      "package-lock.json",
      "tsconfig.app.json",
      "vite.config.ts",
      "tailwind.config.js",
      "postcss.config.js",
      "index.html",
    ], 1);

    assert.deepEqual(scope, [
      "src/App.tsx",
      "src/screens/AnaSayfa.tsx",
      "src/App.css",
      "src/main.tsx",
      "src/index.css",
    ]);
  });

  it("does not add integration files to multi-story scopes", () => {
    const scope = normalizeScopeFilesForStory([
      "src/components/CounterControls/CounterControls.tsx",
    ], 3);

    assert.deepEqual(scope, [
      "src/components/CounterControls/CounterControls.tsx",
    ]);
  });

  it("does not add frontend integration files to non-frontend scopes", () => {
    const scope = normalizeScopeFilesForStory([
      "src/server/routes/counter.ts",
      "src/services/counter.ts",
    ], 1);

    assert.deepEqual(scope, [
      "src/server/routes/counter.ts",
      "src/services/counter.ts",
    ]);
  });
});
