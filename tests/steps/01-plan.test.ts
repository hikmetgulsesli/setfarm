import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planModule } from "../../dist/installer/steps/01-plan/module.js";
import { buildAutoPlanOutput, slugify } from "../../dist/installer/steps/01-plan/preclaim.js";
import { runModule, validPlanOutput } from "./harness.js";

function parsePlanOutput(output: string) {
  const field = (key: string) => output.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1]?.trim() || "";
  return {
    contract_schema_version: field("CONTRACT_SCHEMA_VERSION"),
    status: field("STATUS"),
    project_name: field("PROJECT_NAME"),
    project_slug: field("PROJECT_SLUG"),
    platform: field("PLATFORM"),
    tech_stack: field("TECH_STACK"),
    ui_language: field("UI_LANGUAGE"),
    db_required: field("DB_REQUIRED"),
    design_required: field("DESIGN_REQUIRED"),
    ui_vision_summary: field("UI_VISION_SUMMARY"),
    prd: output.match(/^PRD:\n([\s\S]*)$/m)?.[1] || "",
  };
}

function actionIdsFromContract(prd: string): Set<string> {
  return new Set([...prd.matchAll(/^#{3,6}\s+ACTION:\s*(ACT_[A-Z0-9_]+)\b/gim)].map(match => match[1]));
}

function permittedActionIds(prd: string): Set<string> {
  const ids = new Set<string>();
  for (const match of prd.matchAll(/^\s*[-*]\s*Permitted Actions:\s*(.+)$/gim)) {
    for (const action of match[1].matchAll(/\bACT_[A-Z0-9_]+\b/g)) ids.add(action[0]);
  }
  return ids;
}

describe("01-plan step module", () => {
  it("happy path: v2.2 product contract validates and runtime context is resolved", async () => {
    const result = await runModule(planModule, "Simple note-taking application", validPlanOutput());
    assert.ok(result.validation.ok, `validation failed: ${result.validation.errors.join("; ")}`);
    assert.ok(result.promptBytes < planModule.maxPromptSize);
    assert.equal(result.contextAfterComplete["project_name"], "Test App");
    assert.equal(result.contextAfterComplete["project_slug"], "test-app");
    assert.match(result.contextAfterComplete["repo"], /\/projects\/test-app-/);
    assert.match(result.contextAfterComplete["branch"], /^feature-test-app-/);
    assert.equal(result.contextAfterComplete["tech_stack"], "vite-react");
    assert.equal(result.contextAfterComplete["design_required"], "true");
    assert.equal(result.contextAfterComplete["contract_schema_version"], "setfarm.plan.v2.2");
    assert.match(result.contextAfterComplete["ui_vision_summary"], /focused note operations product/);
    assert.ok(result.onCompleteCalled);
  });

  it("rejects runtime-owned fields and screen tables", async () => {
    const result = await runModule(
      planModule,
      "Test",
      validPlanOutput({
        repo: "/tmp/test",
        branch: "feature-test",
        prd_screen_count: "3",
        prd: `${validPlanOutput().prd}\n\n## Screens\n| # | Screen | Type | Description |\n|---|---|---|---|\n| 1 | Bad | page | Bad |`,
      })
    );
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("runtime-owned")));
    assert.ok(result.validation.errors.some(e => e.includes("Screens table")));
  });

  it("short PRD is rejected", async () => {
    const result = await runModule(planModule, "Test", validPlanOutput({ prd: "Too short PRD." }));
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("PRD must be")));
  });

  it("invalid TECH_STACK is rejected", async () => {
    const result = await runModule(planModule, "Test", validPlanOutput({ tech_stack: "angular" }));
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("TECH_STACK")));
  });

  it("rejects Product Surfaces that reference actions missing from the action contract", async () => {
    const base = validPlanOutput();
    const result = await runModule(
      planModule,
      "Test",
      validPlanOutput({
        prd: base.prd.replace("ACT_OPEN_EDITOR (control_hint: primary_button)", "ACT_UNKNOWN_THING (control_hint: primary_button)"),
      }),
    );

    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.errors.some(e => e.includes("Every permitted action")));
  });

  it("module metadata uses the v2.2 output schema", () => {
    assert.equal(planModule.id, "plan");
    assert.equal(planModule.agentRole, "planner");
    assert.deepEqual(planModule.requiredOutputFields, [
      "CONTRACT_SCHEMA_VERSION", "STATUS", "PROJECT_NAME", "PROJECT_SLUG", "PLATFORM", "TECH_STACK", "UI_LANGUAGE", "DB_REQUIRED", "DESIGN_REQUIRED", "UI_VISION_SUMMARY", "PRD"
    ]);
  });

  it("auto-plan output is valid and emits Product Surfaces instead of screens", () => {
    const output = buildAutoPlanOutput(
      "Build a compact browser service desk app called Ticket Loom with queue, agents, SLA status, create/edit, detail, triage board, requester context, insights, settings, empty and error states.",
      { runId: "2478c347-e300-43bc-9963-fd3ed1e20798" },
    );
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);
    const definedActions = actionIdsFromContract(parsed.prd);
    const permittedActions = permittedActionIds(parsed.prd);
    const missingActions = [...permittedActions].filter(action => !definedActions.has(action));

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(parsed.contract_schema_version, "setfarm.plan.v2.2");
    assert.match(parsed.ui_vision_summary, /Surface|Ticket|operations|product/i);
    assert.equal(parsed.project_name, "Ticket Loom");
    assert.equal(parsed.project_slug, "ticket-loom");
    assert.equal(parsed.platform, "web");
    assert.match(parsed.prd, /## 4\. Product Surfaces/);
    assert.match(parsed.prd, /mock_data_contract/);
    assert.match(parsed.prd, /data_access_contract/);
    assert.match(parsed.prd, /environment_contract/);
    assert.match(parsed.prd, /route_guard_policy/);
    assert.match(parsed.prd, /Representation: standalone/);
    assert.match(parsed.prd, /Domain Hint:/);
    assert.match(parsed.prd, /Display Fields:/);
    assert.match(parsed.prd, /SURF_TICKET_OPERATIONS/);
    assert.match(parsed.prd, /SURF_QUEUE_AND_STATUS_MANAGEMENT/);
    assert.match(parsed.prd, /SURF_AGENT_WORKLOAD/);
    assert.match(parsed.prd, /ACT_SAVE_RECORD/);
    assert.match(parsed.prd, /ACT_SELECT_RECORD/);
    assert.match(parsed.prd, /ACT_CANCEL_EDIT/);
    assert.match(parsed.prd, /ACT_UPDATE_RECORD_STATUS/);
    assert.match(parsed.prd, /ACT_ASSIGN_RECORD/);
    assert.match(parsed.prd, /ACT_SAVE_PREFERENCES/);
    assert.match(parsed.prd, /ACT_EXPORT_SUMMARY/);
    assert.deepEqual(missingActions, []);
    assert.doesNotMatch(output, /^REPO:/m);
    assert.doesNotMatch(output, /^BRANCH:/m);
    assert.doesNotMatch(output, /PRD_SCREEN_COUNT/);
    assert.doesNotMatch(output, /FULL_PRD_APPENDIX/);
    assert.doesNotMatch(output, /^## Screens/m);
    assert.doesNotMatch(output, /tool\/game\/API\/CLI/);
  });

  it("auto-plan does not convert non-ticket queue domains into service desk surfaces", () => {
    const output = buildAutoPlanOutput(
      "Build a compact browser maintenance scheduling app called MaintiGrid Q9L7. It should manage assets, preventive maintenance plans, technician queues, overdue work orders, settings, empty and error recovery, and every visible action should update real app state.",
      { runId: "6a450d5c-0a91-48ee-bfac-1c4f18c6ce54" },
    );
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(parsed.project_name, "MaintiGrid Q9L7");
    assert.equal(parsed.project_slug, "maintigrid-q9l7");
    assert.match(parsed.ui_vision_summary, /Asset|maintenance|operations|product/i);
    assert.match(parsed.prd, /SURF_ASSET_OPERATIONS/);
    assert.match(parsed.prd, /SURF_QUEUE_AND_STATUS_MANAGEMENT/);
    assert.match(parsed.prd, /SURF_SETTINGS_AND_PREFERENCES/);
    assert.doesNotMatch(parsed.prd, /\bTicket\b/);
    assert.doesNotMatch(parsed.prd, /SURF_TICKET/);
  });

  it("preserves explicitly named product casing from the request", () => {
    const output = buildAutoPlanOutput("Build a compact browser service desk app called SurfaceGate Desk with tickets and queues.");
    const parsed = parsePlanOutput(output);

    assert.equal(parsed.project_name, "SurfaceGate Desk");
    assert.equal(parsed.project_slug, "surfacegate-desk");
  });

  it("API plans bypass design and skip Product Surfaces", () => {
    const output = buildAutoPlanOutput("Build a REST API only service called Ledger Pipe for posting and listing ledger entries.");
    const parsed = parsePlanOutput(output);
    planModule.normalize?.(parsed);
    const validation = planModule.validateOutput(parsed);

    assert.equal(validation.ok, true, validation.errors.join("; "));
    assert.equal(parsed.platform, "api");
    assert.equal(parsed.design_required, "false");
    assert.match(parsed.prd, /DESIGN_REQUIRED=false/);
  });

  it("auto-plan emits platform-specific contracts and design routing", () => {
    const cases = [
      {
        task: "Build a Next.js CRM app called DealFlow Web with customer insights and settings.",
        platform: "web",
        stack: "nextjs",
        designRequired: "true",
        mustHave: [/Type: Web/, /Rendering Strategy: hybrid/, /SURF_CUSTOMER_OPERATIONS/],
        mustNotHave: [/DESIGN_REQUIRED=false/],
      },
      {
        task: "Build a React Native mobile app called FieldPocket for tracking field visits, offline preferences, and retry states.",
        platform: "mobile",
        stack: "react-native-expo",
        designRequired: "true",
        mustHave: [/Type: Mobile/, /Offline Policy/, /testID/, /## 4\. Product Surfaces/],
        mustNotHave: [/window\.app is allowed/],
      },
      {
        task: "Build a browser puzzle game called GridPulse with score, levels, pause, restart, and settings.",
        platform: "game",
        stack: "browser-game",
        designRequired: "true",
        mustHave: [/Type: Game/, /SURF_GAMEPLAY/, /SURF_GAME_SETTINGS/, /ACT_START_GAME/, /Design Conversion Policy/],
        mustNotHave: [/SURF_RECORD_OPERATIONS/],
      },
      {
        task: "Build a REST API only service called Ledger Pipe for posting and listing ledger entries.",
        platform: "api",
        stack: "node-express",
        designRequired: "false",
        mustHave: [/Type: API/, /Endpoint Contract/, /DESIGN_REQUIRED=false/],
        mustNotHave: [/### SURFACE:/, /Stitch/],
      },
      {
        task: "Build a CLI command line tool called LogSweep for scanning log files and returning JSON summaries.",
        platform: "cli",
        stack: "node-cli",
        designRequired: "false",
        mustHave: [/Type: CLI/, /STDOUT\/STDERR/, /Exit Codes/, /DESIGN_REQUIRED=false/],
        mustNotHave: [/### SURFACE:/, /Stitch/],
      },
    ];

    for (const item of cases) {
      const output = buildAutoPlanOutput(item.task);
      const parsed = parsePlanOutput(output);
      planModule.normalize?.(parsed);
      const validation = planModule.validateOutput(parsed);
      const missingActions = [...permittedActionIds(parsed.prd)].filter(action => !actionIdsFromContract(parsed.prd).has(action));

      assert.equal(validation.ok, true, `${item.platform}: ${validation.errors.join("; ")}`);
      assert.equal(parsed.contract_schema_version, "setfarm.plan.v2.2");
      assert.equal(parsed.platform, item.platform);
      assert.equal(parsed.tech_stack, item.stack);
      assert.equal(parsed.design_required, item.designRequired);
      assert.match(parsed.prd, /mock_data_contract/, `${item.platform} should include mock data contract`);
      assert.match(parsed.prd, /data_access_contract/, `${item.platform} should include data access contract`);
      assert.match(parsed.prd, /environment_contract/, `${item.platform} should include environment contract`);
      assert.match(parsed.prd, /route_guard_policy/, `${item.platform} should include route guard policy`);
      assert.deepEqual(missingActions, [], `${item.platform}: permitted actions must be defined`);
      for (const pattern of item.mustHave) assert.match(parsed.prd, pattern, `${item.platform} should include ${pattern}`);
      for (const pattern of item.mustNotHave) assert.doesNotMatch(parsed.prd, pattern, `${item.platform} should not include ${pattern}`);
    }
  });

  it("slugify normalizes project names", () => {
    assert.equal(slugify("Call Center Product Schema"), "call-center-product-schema");
  });
});
