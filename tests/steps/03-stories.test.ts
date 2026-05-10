import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { storiesModule } from "../../dist/installer/steps/03-stories/module.js";
import {
  collectUiBehaviorRequirements,
  computeUiBehaviorContract,
  computePredictedScreenFiles,
  extractExplicitMaxStories,
} from "../../dist/installer/steps/03-stories/context.js";
import {
  buildAcceptanceCriteria,
  buildAutoStoriesOutput,
  buildSingleStoryScopeFiles,
} from "../../dist/installer/steps/03-stories/preclaim.js";
import {
  detectStorySemanticDrift,
  detectUiBehaviorContractGaps,
  extractStoryDomainTerms,
  planUiBehaviorCriteriaInjections,
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
    assert.match(result.prompt, /setup-repo/);
    assert.match(result.prompt, /Do NOT read `.*\/PRD\.md`/);
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

  it("single-story auto scope stays project-neutral", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-dom-"));
    try {
      mkdirSync(path.join(repo, "stitch"));
      writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            title: "Ana",
            behaviorContract: [
              { kind: "button", label: "Başlat", icon: "play_arrow", action: "start", expectedBehavior: "start visible workflow" },
              { kind: "button", label: "Durdur", icon: "stop", action: "stop", expectedBehavior: "stop visible workflow" },
            ],
          },
        },
      }));

      const criteriaText = buildAcceptanceCriteria(repo).join("\n").toLowerCase();
      assert.equal(criteriaText.includes("counter"), false);
      assert.equal(criteriaText.includes("notes"), false);
      assert.equal(criteriaText.includes("settings"), false);

      const scope = buildSingleStoryScopeFiles(["src/screens/Ana.tsx"]);
      assert.deepEqual(scope, [
        "src/screens/Ana.tsx",
        "src/App.tsx",
        "src/App.css",
        "src/main.tsx",
        "src/index.css",
        "src/contexts/AppContext.tsx",
      ]);
      assert.equal(scope.some((file) => /CounterPanel|NotesPanel|SettingsPanel|usePersistentAppState/.test(file)), false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("auto-builds multi-story output from Stitch screens without planner bias", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-stories-"));
    try {
      mkdirSync(path.join(repo, "stitch"));
      writeFileSync(path.join(repo, "stitch", "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Leads" },
        { screenId: "SCR-002", title: "Pipeline" },
        { screenId: "SCR-003", title: "Profil Paneli" },
        { screenId: "SCR-004", title: "Storage Hata Durumu" },
      ]));
      writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            title: "Leads",
            behaviorContract: [
              { kind: "button", label: "Yeni Lead", icon: "plus", action: "create", expectedBehavior: "open add lead form" },
            ],
          },
          "SCR-003": {
            title: "Profil Paneli",
            behaviorContract: [
              { kind: "button", label: "Profil", icon: "user", action: "open", expectedBehavior: "open profile panel" },
            ],
          },
        },
      }));

      const predicted = computePredictedScreenFiles(repo);
      const output = buildAutoStoriesOutput({
        repo,
        task: "Freelancer lead triage CRM uygulaması",
        predicted,
      });

      const storiesJson = output.match(/STORIES_JSON:\n([\s\S]*?)\nSCREEN_MAP:/)?.[1] || "[]";
      const stories = JSON.parse(storiesJson);
      assert.equal(stories.length, 5);
      assert.match(stories[0].title, /^Freelancer lead triage CRM uygulaması -/);
      assert.equal(stories[0].scope_files.includes("src/App.tsx"), true);
      assert.equal(stories[0].scope_files.includes("src/contexts/AppContext.tsx"), true);
      assert.equal(stories[0].shared_files.includes("src/screens/Leads.tsx"), true);
      assert.equal(stories[0].shared_files.includes("src/screens/ProfilPaneli.tsx"), true);
      assert.equal(stories[1].scope_files.includes("src/screens/Leads.tsx"), true);
      assert.equal(stories.some((s: any) => s.scope_files.includes("src/screens/ProfilPaneli.tsx")), true);
      assert.equal(stories.slice(1).every((s: any) => s.shared_files.includes("src/App.tsx")), true);
      assert.match(output, /Yeni Lead/);
      assert.match(output, /Profil/);
      assert.equal(output.includes("CounterPanel"), false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("auto-builds game stories without product profile/account bias", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-game-stories-"));
    try {
      mkdirSync(path.join(repo, "stitch"));
      writeFileSync(path.join(repo, "stitch", "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Game Board" },
        { screenId: "SCR-002", title: "Next Piece Preview" },
        { screenId: "SCR-003", title: "Game Options" },
        { screenId: "SCR-004", title: "Game Over" },
      ]));
      writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            title: "Game Board",
            behaviorContract: [
              { kind: "button", label: "Start", icon: "play", action: "start", expectedBehavior: "start falling pieces" },
              { kind: "button", label: "Pause", icon: "pause", action: "pause", expectedBehavior: "freeze the game loop" },
            ],
          },
          "SCR-004": {
            title: "Game Over",
            behaviorContract: [
              { kind: "button", label: "Restart", icon: "rotate-cw", action: "restart", expectedBehavior: "reset board and score" },
            ],
          },
        },
      }));

      const predicted = computePredictedScreenFiles(repo);
      const output = buildAutoStoriesOutput({
        repo,
        task: "Project: tetris-game-0511 Build a browser Tetris game with next piece preview, score, level, lines, pause/resume, restart, and keyboard controls.",
        predicted,
      });

      const storiesJson = output.match(/STORIES_JSON:\n([\s\S]*?)\nSCREEN_MAP:/)?.[1] || "[]";
      const stories = JSON.parse(storiesJson);
      const allText = JSON.stringify(stories);

      assert.match(stories[0].title, /game engine, state and test bridge$/);
      assert.match(stories[0].description, /shared game shell/);
      assert.match(allText, /Next piece preview is derived from the same queue\/source of truth/);
      assert.match(allText, /Game options and controls screens/);
      assert.match(allText, /Pause, game-over and help states/);
      assert.doesNotMatch(allText, /profile\/account/i);
      assert.doesNotMatch(allText, /Settings, profile and account screens/);
      assert.equal(stories[0].scope_files.includes("src/hooks/useAppState.ts"), true);
      assert.equal(stories[0].shared_files.includes("src/screens/GameBoard.tsx"), true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
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

  it("plans UI behavior criteria injection for missing Stitch controls", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-dom-"));
    try {
      mkdirSync(path.join(repo, "stitch"));
      writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            title: "Ana",
            behaviorContract: [
              { kind: "button", label: "Ayarlar", icon: "settings", route: "/settings", expectedBehavior: "open settings panel" },
              { kind: "button", label: "Artır", icon: "add", action: "increment", expectedBehavior: "increase visible value" },
            ],
          },
        },
      }));
      writeFileSync(path.join(repo, "stitch", "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Ana" },
      ]));

      const updates = planUiBehaviorCriteriaInjections(repo, [{
        story_id: "US-001",
        story_index: 1,
        title: "Sayaç — ana ekran",
        description: "Sayaç değeri görüntülenir.",
        acceptance_criteria: JSON.stringify(["Artır butonu sayacı artırır"]),
        scope_description: "Ana sayaç akışı",
        scope_files: JSON.stringify(["src/screens/Ana.tsx"]),
      }]);

      const additions = updates.get("US-001") || [];
      assert.equal(additions.length, 1);
      assert.match(additions[0], /UI_BEHAVIOR_CONTRACT/);
      assert.match(additions[0], /Ayarlar/);
      assert.match(additions[0], /open settings panel/);
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
      "src/contexts/AppContext.tsx",
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
      "src/contexts/AppContext.tsx",
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
