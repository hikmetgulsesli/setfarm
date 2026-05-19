import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  detectImplementationContractGaps,
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
    assert.ok(result.prompt.includes("implementation_contract"), "prompt should mention implementation_contract");
    assert.ok(result.prompt.includes("PREDICTED_SCREEN_FILES"), "prompt should mention predicted screens");
    assert.ok(result.prompt.includes("DESIGN_DOM_PREVIEW"), "prompt should mention design DOM preview section");
    assert.match(result.prompt, /setup-repo/);
    assert.match(result.prompt, /Do NOT read `.*\/PRD\.md`/);
    assert.equal(result.prompt.includes("{{DESIGN_DOM_PREVIEW}}"), false, "prompt should resolve design DOM placeholder");
    assert.ok(result.prompt.includes("STORIES_JSON"), "prompt should mention STORIES_JSON");
    assert.equal(result.prompt.includes("src/hooks/useCounter.ts"), false, "prompt should not bias output toward a counter scaffold path");
    assert.equal(result.prompt.includes("CounterDisplay"), false, "prompt should not bias output toward a counter component");
  });

  it("stores implementation contracts as story DB fields", () => {
    const dbSource = readFileSync(path.join(process.cwd(), "dist/db-pg.js"), "utf-8");
    const storyOpsSource = readFileSync(path.join(process.cwd(), "dist/installer/story-ops.js"), "utf-8");

    assert.match(dbSource, /implementation_contract TEXT/);
    assert.match(storyOpsSource, /normalizeImplementationContract/);
    assert.match(storyOpsSource, /implementation_contract, created_at, updated_at/);
  });

  it("extracts explicit English story caps", () => {
    assert.equal(extractExplicitMaxStories("Maximum 1 story."), 1);
    assert.equal(extractExplicitMaxStories("Use up to 2 stories"), 2);
    assert.equal(extractExplicitMaxStories("No more than 3 stories"), 3);
    assert.equal(extractExplicitMaxStories("4 stories maximum"), 4);
    assert.equal(extractExplicitMaxStories("Generate the story list"), null);
  });

  it("extracts stable domain terms from task and PRD", () => {
    const terms = extractStoryDomainTerms(
      "Simple counter app: increment, decrement, reset, and persist the value in localStorage.",
      "The counter value is visible. The user can use Increment, Decrement, and Reset buttons."
    );
    assert.ok(terms.includes("counter"));
    assert.ok(terms.includes("increment"));
    assert.ok(terms.includes("decrement"));
    assert.ok(terms.includes("reset"));
  });

  it("single-story auto scope stays project-neutral", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-dom-"));
    try {
      mkdirSync(path.join(repo, "stitch"));
      writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            title: "Home",
            behaviorContract: [
              { kind: "button", label: "Start", icon: "play_arrow", action: "start", expectedBehavior: "start visible workflow" },
              { kind: "button", label: "Stop", icon: "stop", action: "stop", expectedBehavior: "stop visible workflow" },
            ],
          },
        },
      }));

      const criteriaText = buildAcceptanceCriteria(repo).join("\n").toLowerCase();
      assert.equal(criteriaText.includes("counter"), false);
      assert.equal(criteriaText.includes("notes"), false);
      assert.equal(criteriaText.includes("settings"), false);

      const scope = buildSingleStoryScopeFiles(["src/screens/Home.tsx"]);
      assert.deepEqual(scope, [
        "src/screens/Home.tsx",
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
        { screenId: "SCR-003", title: "Profile Panel" },
        { screenId: "SCR-004", title: "Storage Error State" },
      ]));
      writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
	          "SCR-001": {
	            title: "Leads",
	            behaviorContract: [
	              { kind: "button", label: "New Lead", icon: "plus", action: "create", expectedBehavior: "open add lead form" },
	            ],
	          },
          "SCR-003": {
            title: "Profile Panel",
            behaviorContract: [
              { kind: "button", label: "Profile", icon: "user", action: "open", expectedBehavior: "open profile panel" },
            ],
          },
        },
      }));

      const predicted = computePredictedScreenFiles(repo);
      const output = buildAutoStoriesOutput({
        repo,
        task: "Freelancer lead triage CRM application",
        predicted,
      });

      const storiesJson = output.match(/STORIES_JSON:\n([\s\S]*?)\nSCREEN_MAP:/)?.[1] || "[]";
      const stories = JSON.parse(storiesJson);
	      assert.equal(stories.length, 4);
      assert.match(stories[0].title, /^Freelancer lead triage CRM application -/);
      assert.equal(stories[0].scope_files.includes("src/App.tsx"), true);
      assert.equal(stories[0].scope_files.includes("src/contexts/AppContext.tsx"), true);
      assert.equal(stories[0].shared_files.includes("src/screens/Leads.tsx"), true);
      assert.equal(stories[0].shared_files.includes("src/screens/ProfilePanel.tsx"), true);
      assert.equal(stories[1].scope_files.includes("src/screens/Leads.tsx"), true);
      assert.deepEqual(stories[1].implementation_contract.owned_screen_ids, ["SCR-001"]);
      assert.ok(stories[1].implementation_contract.owned_screen_files.includes("src/screens/Leads.tsx"));
      assert.ok(stories[1].implementation_contract.state_contract.length > 0);
      assert.ok(stories[1].implementation_contract.test_contract.length > 0);
      assert.equal(stories.some((s: any) => s.scope_files.includes("src/screens/ProfilePanel.tsx")), true);
      assert.equal(stories.slice(1).every((s: any) => s.scope_files.includes("src/App.tsx")), true);
      assert.equal(stories.slice(1).every((s: any) => s.scope_files.includes("src/hooks/useAppState.ts")), true);
	      assert.match(output, /New Lead/);
      assert.match(output, /Profile/);
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
        { screenId: "SCR-002", title: "Score Panel" },
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
        task: "Project: arcade-game-0511 Build a browser arcade game with score, level progress, pause/resume, restart, and keyboard controls.",
        predicted,
      });

      const storiesJson = output.match(/STORIES_JSON:\n([\s\S]*?)\nSCREEN_MAP:/)?.[1] || "[]";
      const stories = JSON.parse(storiesJson);
      const allText = JSON.stringify(stories);
      const appStoryText = JSON.stringify(stories[0]);

      assert.match(stories[0].title, /game engine, state and test bridge$/);
      assert.match(stories[0].description, /shared game shell/);
      assert.match(stories[0].description, /without editing read-only screen components/);
      assert.deepEqual(stories[0].screens, []);
      assert.match(appStoryText, /screen-owner stories/);
      assert.doesNotMatch(appStoryText, /Every generated game screen is reachable/);
      assert.doesNotMatch(appStoryText, /HUD\/status screens are embedded in gameplay/);
      assert.match(allText, /owned generated screen is reachable/);
      assert.match(allText, /no owned screen remains orphaned/);
      assert.match(allText, /HUD and status displays are derived from the same state source/);
      assert.match(allText, /does not pass invented props to generated shared screen components/);
      assert.match(allText, /declared actions props\/action IDs from SCREEN_INDEX/);
      assert.match(allText, /never through textContent\/DOM-label matching/);
      assert.match(allText, /Reducer\/state transitions are pure and immutable/);
      assert.match(allText, /generated screen button wiring is owned by the screen stories/);
      assert.match(allText, /Touch\/gameplay controls are visible and active only in states where they can affect gameplay/);
      assert.match(allText, /hidden or explicitly disabled\/aria-disabled/);
      assert.match(allText, /Score Panel screen/);
      assert.match(allText, /Game Options screen/);
      assert.match(allText, /Game Over screen/);
      assert.doesNotMatch(allText, /touch\/click controls produce visible gameplay state changes/);
      assert.doesNotMatch(allText, /profile\/account/i);
      assert.doesNotMatch(allText, /Settings, profile and account screens/);
      assert.doesNotMatch(allText, /next piece|tetromino|activePiece|nextPiece/i);
      const scorePanelStory = stories.find((s: any) => s.scope_files.includes("src/screens/ScorePanel.tsx"));
      assert.ok(scorePanelStory, "expected a dedicated ScorePanel story");
      assert.equal(scorePanelStory.scope_files.includes("src/screens/ScorePanel.tsx"), true);
      assert.equal(scorePanelStory.scope_files.includes("src/App.tsx"), true);
      assert.equal(scorePanelStory.scope_files.includes("src/hooks/useAppState.ts"), true);
      assert.equal(scorePanelStory.scope_files.includes("src/types/domain.ts"), true);
      assert.match(scorePanelStory.title, /Score Panel screen$/);
      assert.doesNotMatch([
        scorePanelStory.title,
        scorePanelStory.description,
        scorePanelStory.scope_description,
      ].join("\n"), /\b(game engine|keyboard|timer|persistence)\b/i);
      assert.doesNotMatch(scorePanelStory.description, /those screen/i);
      assert.match(scorePanelStory.description, /that screen/);
      assert.equal(stories[0].scope_files.includes("src/hooks/useAppState.ts"), true);
      assert.ok(stories[0].implementation_contract.state_contract.some((item: string) => /gameplay/i.test(item)));
      assert.equal(stories[0].shared_files.includes("src/screens/GameBoard.tsx"), true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("does not classify web products as games just because generic PRD prose mentions game as another platform", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-web-product-stories-"));
    try {
      mkdirSync(path.join(repo, "stitch"));
      writeFileSync(path.join(repo, "stitch", "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Ticket Operations" },
        { screenId: "SCR-002", title: "Queue and Status Management" },
        { screenId: "SCR-003", title: "Insights" },
      ]));
      writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({ screens: {} }));

      const predicted = computePredictedScreenFiles(repo);
      const output = buildAutoStoriesOutput({
        repo,
        task: "Build a compact browser service desk app with tickets, queues, agents, SLA status and insights.",
        context: {
          platform: "web",
          project_name: "SurfaceGate Desk",
          prd: "The product should implement actual tool/game/API/CLI behavior language from a generic template but this run is platform web.",
        },
        predicted,
      });

      const storiesJson = output.match(/STORIES_JSON:\n([\s\S]*?)\nSCREEN_MAP:/)?.[1] || "[]";
      const stories = JSON.parse(storiesJson);

      assert.doesNotMatch(stories[0].title, /game engine/);
      assert.match(stories[0].title, /app shell, state and persistence/);
      assert.doesNotMatch(JSON.stringify(stories[0]), /Profile\/account icon/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("story prompt requires generated screens to be reachable or embedded", async () => {
    const result = await runModule(storiesModule, "Test", { status: "done" });

    assert.match(result.prompt, /Every generated screen also needs a real user path/);
    assert.match(result.prompt, /Do not leave orphan route\/phase-only screens/);
  });

  it("rejects stories that drift into another project concept", () => {
    const err = detectStorySemanticDrift(
      {
        task: "Simple counter app: increment, decrement, reset, and persist the value in localStorage.",
        prd: "Counter value is shown. Increment, decrement, and reset actions are supported.",
      },
      [{
        story_id: "US-001",
        title: "Color Guard - Setup and Full Game Flow",
        description: "Color vision test application with level selection and Ishihara game loop.",
        acceptance_criteria: JSON.stringify(["Start button opens level selection", "Score appears after 10 questions"]),
        scope_description: "Single story game flow",
        scope_files: JSON.stringify(["src/hooks/useGame.ts", "src/components/IshiharaCircle.tsx"]),
      }]
    );
    assert.match(err || "", /semantic drift/i);
  });

  it("accepts stories that preserve the original project concept", () => {
    const err = detectStorySemanticDrift(
      {
        task: "Simple counter app: increment, decrement, reset, and persist the value in localStorage.",
        prd: "Counter value is shown. Increment, decrement, and reset actions are supported.",
      },
      [{
        story_id: "US-001",
        title: "Counter - setup, UI, and localStorage flow",
        description: "Counter value, increment, decrement, and reset actions are implemented in one story.",
        acceptance_criteria: JSON.stringify(["Increment button increases the counter", "Decrement button decreases the counter", "Reset button resets the counter"]),
        scope_description: "Single story counter flow",
        scope_files: JSON.stringify(["src/hooks/useCounter.ts", "src/screens/Home.tsx"]),
      }]
    );
    assert.equal(err, null);
  });

  it("rejects feature stories without implementation contracts", () => {
    const err = detectImplementationContractGaps([{
      story_id: "US-002",
      title: "Ticket editor",
      description: "Implements ticket editing.",
      acceptance_criteria: JSON.stringify(["Save button persists a ticket"]),
      scope_description: "Ticket editor screen",
      scope_files: JSON.stringify(["src/screens/TicketEditor.tsx"]),
      implementation_contract: null,
    }]);

    assert.match(err || "", /implementation_contract/i);

    const ok = detectImplementationContractGaps([{
      story_id: "US-002",
      title: "Ticket editor",
      description: "Implements ticket editing.",
      acceptance_criteria: JSON.stringify(["Save button persists a ticket"]),
      scope_description: "Ticket editor screen",
      scope_files: JSON.stringify(["src/screens/TicketEditor.tsx"]),
      implementation_contract: JSON.stringify({
        owned_screen_ids: ["SCR-002"],
        owned_screen_files: ["src/screens/TicketEditor.tsx"],
        owned_actions: [{ id: "ACT_SAVE_RECORD", trigger: "Save", state_change: "Persist ticket", ui_feedback: "Saved confirmation" }],
        state_contract: ["activeDraft and validationErrors"],
        persistence_contract: ["write Ticket changes to localStorage"],
        navigation_contract: ["save returns to operations"],
        test_contract: ["empty title shows validation"],
      }),
    }]);

    assert.equal(ok, null);
  });

  it("builds a UI behavior contract from DESIGN_DOM", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-dom-"));
    try {
      mkdirSync(path.join(repo, "stitch"));
      writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            title: "Home",
            behaviorContract: [
              { kind: "button", label: "Settings", icon: "settings", route: "/settings", expectedBehavior: "navigate:/settings" },
              { kind: "button", label: "Increment", icon: "add", action: "increment", expectedBehavior: "increase visible value" },
            ],
          },
        },
      }));

      const reqs = collectUiBehaviorRequirements(repo);
      assert.equal(reqs.length, 2);
      const contract = computeUiBehaviorContract(repo);
	      assert.match(contract, /settings/);
      assert.match(contract, /Increment/);
      assert.match(contract, /navigate:\/settings/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("treats Stitch href hash links as placeholder anchors, not routes to replace with spans", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-dom-hash-"));
    try {
      mkdirSync(path.join(repo, "stitch"));
      writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            title: "Main Menu",
            behaviorContract: [
              { kind: "link", label: "GAME", href: "#" },
            ],
          },
        },
      }));

      const [req] = collectUiBehaviorRequirements(repo);
      assert.equal(req.kind, "link");
      assert.equal(req.route, undefined);
      assert.match(req.expectedBehavior, /preserve anchor semantics/);
      assert.match(req.expectedBehavior, /do not replace with span/);

      const contract = computeUiBehaviorContract(repo);
      assert.doesNotMatch(contract, /navigate:#|route=#/);
      assert.match(contract, /preserve anchor semantics/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("collects link requirements from DESIGN_DOM navigation arrays", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "setfarm-dom-navigation-"));
    try {
      mkdirSync(path.join(repo, "stitch"));
      writeFileSync(path.join(repo, "stitch", "DESIGN_DOM.json"), JSON.stringify({
        screens: {
          "SCR-001": {
            title: "Main Menu",
            navigation: [
              { kind: "link", label: "Help", href: "#" },
              { kind: "link", label: "Settings", href: "/settings" },
            ],
          },
        },
      }));

      const reqs = collectUiBehaviorRequirements(repo);
      assert.deepEqual(reqs.map((req) => `${req.kind}:${req.label}:${req.route || ""}`), [
        "link:Help:",
        "link:Settings:/settings",
      ]);

      const criteriaText = buildAcceptanceCriteria(repo).join("\n");
      assert.match(criteriaText, /buttons, links, icons, inputs, and selects/);
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
            title: "Home",
            behaviorContract: [
              { kind: "button", label: "Settings", icon: "settings", route: "/settings", expectedBehavior: "navigate:/settings" },
              { kind: "button", label: "Increment", icon: "add", action: "increment", expectedBehavior: "increase visible value" },
            ],
          },
        },
      }));

      const missing = detectUiBehaviorContractGaps(repo, [{
        story_id: "US-001",
        title: "Counter - main screen",
        description: "Counter value is displayed.",
        acceptance_criteria: JSON.stringify(["Increment button increases the counter"]),
        scope_description: "Main counter flow",
        scope_files: JSON.stringify(["src/screens/Home.tsx"]),
      }]);
	      assert.match(missing || "", /settings/);

      const ok = detectUiBehaviorContractGaps(repo, [{
        story_id: "US-001",
        title: "Counter - main screen and settings",
        description: "Settings panel and counter increment flow are implemented.",
        acceptance_criteria: JSON.stringify([
          "Settings icon button opens the /settings panel.",
          "Increment button increases the counter value.",
        ]),
        scope_description: "Main counter and settings flow",
        scope_files: JSON.stringify(["src/screens/Home.tsx"]),
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
            title: "Home",
            behaviorContract: [
              { kind: "button", label: "Settings", icon: "settings", route: "/settings", expectedBehavior: "open settings panel" },
              { kind: "button", label: "Increment", icon: "add", action: "increment", expectedBehavior: "increase visible value" },
            ],
          },
        },
      }));
      writeFileSync(path.join(repo, "stitch", "DESIGN_MANIFEST.json"), JSON.stringify([
        { screenId: "SCR-001", title: "Home" },
      ]));

      const updates = planUiBehaviorCriteriaInjections(repo, [{
        story_id: "US-001",
        story_index: 1,
        title: "Counter - main screen",
        description: "Counter value is displayed.",
        acceptance_criteria: JSON.stringify(["Increment button increases the counter"]),
        scope_description: "Main counter flow",
        scope_files: JSON.stringify(["src/screens/Home.tsx"]),
      }]);

      const additions = updates.get("US-001") || [];
      assert.equal(additions.length, 1);
      assert.match(additions[0], /UI_BEHAVIOR_CONTRACT/);
	      assert.match(additions[0], /settings/);
      assert.match(additions[0], /open settings panel/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("adds frontend integration files to a single-story frontend scope", () => {
    const scope = normalizeScopeFilesForStory([
      "src/hooks/useCounter.ts",
      "src/components/CounterControls/CounterControls.tsx",
	      "src/screens/HomeCounterScreen.tsx",
      "package.json",
      "tsconfig.json",
      "vite.config.ts",
    ], 1);

    assert.deepEqual(scope, [
      "src/hooks/useCounter.ts",
      "src/components/CounterControls/CounterControls.tsx",
	      "src/screens/HomeCounterScreen.tsx",
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
	      "src/screens/Home.tsx",
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
	      "src/screens/Home.tsx",
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
