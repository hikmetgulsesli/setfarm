import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import ts from "typescript";
import YAML from "yaml";
import { resolveWorkflowAgentModel } from "../src/installer/agent-model-policy.js";
import { STORY_FALLBACK_MODEL } from "../src/installer/constants.js";
import path from "node:path";

function installSource(): string {
  return readFileSync(path.resolve("src", "installer", "install.ts"), "utf-8");
}

describe("workflow agent model defaults", () => {
  it("gives fresh agents explicit subscription defaults with independent fallback arrays", () => {
    const first = resolveWorkflowAgentModel(undefined, undefined) as { primary: string; fallbacks: string[] };
    const second = resolveWorkflowAgentModel(undefined, undefined);
    assert.deepEqual(first, { primary: "minimax/MiniMax-M3.1-Flash", fallbacks: ["kimi/k3.1-pro"] });
    first.fallbacks.push("custom/model");
    assert.deepEqual(second, { primary: "minimax/MiniMax-M3.1-Flash", fallbacks: ["kimi/k3.1-pro"] });
  });

  it("migrates only the exact old scalar and two-key object platform presets", () => {
    for (const primary of ["minimax/MiniMax-M3", "minimax-openai/MiniMax-M3"]) {
      for (const existing of [primary, ...["kimi/kimi-for-coding", "kimi-coding/kimi-for-coding"]
        .map(fallback => ({ primary, fallbacks: [fallback] }))]) {
        assert.deepEqual(resolveWorkflowAgentModel(undefined, existing), {
          primary: "minimax/MiniMax-M3.1-Flash", fallbacks: ["kimi/k3.1-pro"],
        });
      }
    }
  });

  it("preserves custom values and near-presets without cloning or dropping metadata", () => {
    for (const existing of [
      "custom/model", "minimax/MiniMax-M3 ", "", null, false, 7, [],
      { primary: "custom/model", fallbacks: ["custom/fallback"] },
      { primary: "minimax/MiniMax-M3", fallbacks: ["kimi/kimi-for-coding"], metadata: true },
      { primary: "minimax/MiniMax-M3", fallbacks: ["custom/fallback", "kimi/kimi-for-coding"] },
      { primary: "minimax/MiniMax-M3", fallbacks: ["kimi/kimi-for-coding", "custom/fallback"] },
      { primary: "minimax/MiniMax-M3", fallbacks: [] },
      { primary: "minimax/MiniMax-M3", fallbacks: "kimi/kimi-for-coding" },
      { primary: "minimax/MiniMax-M3" },
      { primary: "minimax/MiniMax-M3.1-Flash", fallbacks: ["kimi/k3.1-pro"] },
    ]) assert.strictEqual(resolveWorkflowAgentModel(undefined, existing), existing);
  });

  it("honors explicit workflow models byte for byte, including an intentional old identity", () => {
    const parsed = YAML.parse('agents:\n  - model: "minimax-openai/MiniMax-M3"\n  - model: " custom/model "\n  - model: ""\n');
    for (const agent of parsed.agents) {
      for (const existing of [undefined, "minimax/MiniMax-M3", { primary: "custom/model" }]) {
        assert.strictEqual(resolveWorkflowAgentModel(agent.model, existing), agent.model);
      }
    }
  });

  it("actual installer upsert uses existing models and YAML precedence while leaving the main agent unchanged", () => {
    // Execute only the real bounded upsert declaration. Installer imports perform
    // workflow/config I/O; tools and skills are inert DATA ports for this test.
    const file = path.resolve("src/installer/install.ts");
    assert.ok(statSync(file).size <= 131_072);
    const source = installSource(), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const matches = tree.statements.filter((node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === "upsertAgent");
    assert.equal(matches.length, 1);
    const body = ts.transpileModule(matches[0]!.getText(tree), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    const upsert = new Function("resolveWorkflowAgentModel", "buildToolsConfig", "SUBAGENT_POLICY",
      "WORKFLOW_AGENT_BASE_SKILLS", "WORKFLOW_AGENT_SKILLS_LIMITS", body + ";return upsertAgent;")(
      resolveWorkflowAgentModel, () => ({}), {}, ["setfarm-workflows"], { maxSkillsPromptChars: 6000 },
    ) as (list: Record<string, unknown>[], agent: Record<string, unknown>) => void;
    const agent = { id: "workflow_dev", workspaceDir: "/DATA/workspace", agentDir: "/DATA/agent", role: "developer" };
    const custom = { primary: "custom/model", fallbacks: ["custom/fallback"], metadata: true };
    for (const existing of [undefined, "minimax/MiniMax-M3", custom]) {
      const list: Record<string, unknown>[] = existing === undefined ? [] : [{ id: agent.id, model: existing }];
      upsert(list, agent);
      assert.equal(list.length, 1);
      if (existing === custom) assert.strictEqual(list[0]!.model, custom);
      else assert.deepEqual(list[0]!.model, { primary: "minimax/MiniMax-M3.1-Flash", fallbacks: ["kimi/k3.1-pro"] });
      upsert(list, { ...agent, model: "minimax-openai/MiniMax-M3" });
      assert.equal(list[0]!.model, "minimax-openai/MiniMax-M3");
    }
    const main = { id: agent.id, default: true, model: custom, name: "Main", tools: { preserve: true } };
    const before = structuredClone(main), list = [main];
    upsert(list, { ...agent, model: "explicit/model" });
    assert.deepEqual(list, [before]);
    assert.strictEqual(list[0], main);
  });

  it("uses the configured Kimi provider for story fallback and subscription primary in current bundled YAML", () => {
    assert.equal(STORY_FALLBACK_MODEL, "kimi/k3.1-pro");
    const models = ["daily-standup", "ui-refactor"].flatMap(workflow => {
      const parsed = YAML.parse(readFileSync(path.resolve("workflows", workflow, "workflow.yml"), "utf8"));
      return [parsed.polling?.model, ...parsed.agents.map((agent: { model?: string }) => agent.model)]
        .filter((model: unknown) => model !== undefined);
    });
    assert.deepEqual(models, Array(4).fill("minimax/MiniMax-M3.1-Flash"));
  });

  it("disables workflow exec approvals that block unattended agents", () => {
    const source = installSource();
    const start = source.indexOf("function ensureExecConfig(");
    const end = source.indexOf("function ensureSessionMaintenance(", start);
    assert.notEqual(start, -1, "ensureExecConfig source not found");
    assert.notEqual(end, -1, "ensureExecConfig end marker not found");
    const fn = source.slice(start, end);

    assert.match(fn, /tools\.exec\.ask = "off"/);
    assert.match(fn, /tools\.exec\.strictInlineEval = false/);
    assert.doesNotMatch(fn, /if \(tools\.exec\.ask === undefined\)/);
  });

  it("keeps workflow skill injection step-scoped and excludes interactive skills", () => {
    const source = installSource();
    assert.match(source, /const WORKFLOW_AGENT_BASE_SKILLS = \["setfarm-workflows"\]/);
    assert.match(source, /maxSkillsPromptChars: 6000/);
    assert.match(source, /skills,\n    skillsLimits: WORKFLOW_AGENT_SKILLS_LIMITS/);
    assert.doesNotMatch(source, /brainstorming/);
    assert.doesNotMatch(source, /find-skills/);
  });
});
