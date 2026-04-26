import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// We test provisionAgents indirectly by calling the exported function
// But since installExternalSkills is not exported, we test via provisionAgents
// Instead, let's test the behavior end-to-end through the module

describe("External skill installation", () => {
  let tmpDir: string;
  let fakeHome: string;
  let origHome: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "setfarm-skill-test-"));
    fakeHome = path.join(tmpDir, "home");
    await fs.mkdir(path.join(fakeHome, ".openclaw", "workspace", "skills", "agent-browser"), { recursive: true });
    await fs.writeFile(
      path.join(fakeHome, ".openclaw", "workspace", "skills", "agent-browser", "SKILL.md"),
      "# Agent Browser Skill\nTest content"
    );
    // Also create a skill in the alternate location
    await fs.mkdir(path.join(fakeHome, ".openclaw", "skills", "alt-skill"), { recursive: true });
    await fs.writeFile(
      path.join(fakeHome, ".openclaw", "skills", "alt-skill", "SKILL.md"),
      "# Alt Skill\nTest content"
    );
    origHome = process.env.HOME || "";
    process.env.HOME = fakeHome;
  });

  afterEach(async () => {
    process.env.HOME = origHome;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("resolves skill from ~/.openclaw/workspace/skills/", async () => {
    // Import after setting HOME
    const mod = await import("../dist/installer/agent-provision.js");
    // We can't directly test resolveExternalSkillSource since it's not exported,
    // but we can test provisionAgents with a minimal workflow
    const workflowDir = path.join(tmpDir, "workflow");
    await fs.mkdir(workflowDir, { recursive: true });

    const workflow = {
      id: "test-wf",
      name: "Test",
      steps: [],
      agents: [
        {
          id: "verifier",
          role: "verify",
          workspace: {
            baseDir: "agents/verifier",
            skills: ["agent-browser"],
            files: {},
          },
        },
      ],
    };

    const results = await mod.provisionAgents({
      workflow: workflow as any,
      workflowDir,
      installSkill: true,
    });

    // Check that agent-browser was copied to the agent workspace
    const skillDest = path.join(results[0].workspaceDir, "skills", "agent-browser", "SKILL.md");
    const content = await fs.readFile(skillDest, "utf-8");
    assert.ok(content.includes("Agent Browser Skill"), "Skill SKILL.md should be copied");
  });

  it("resolves skill from ~/.openclaw/skills/ (fallback)", async () => {
    const mod = await import("../dist/installer/agent-provision.js");
    const workflowDir = path.join(tmpDir, "workflow");
    await fs.mkdir(workflowDir, { recursive: true });

    const workflow = {
      id: "test-wf2",
      name: "Test",
      steps: [],
      agents: [
        {
          id: "reviewer",
          role: "analysis",
          workspace: {
            baseDir: "agents/reviewer",
            skills: ["alt-skill"],
            files: {},
          },
        },
      ],
    };

    const results = await mod.provisionAgents({
      workflow: workflow as any,
      workflowDir,
      installSkill: true,
    });

    const skillDest = path.join(results[0].workspaceDir, "skills", "alt-skill", "SKILL.md");
    const content = await fs.readFile(skillDest, "utf-8");
    assert.ok(content.includes("Alt Skill"), "Skill should be found in fallback directory");
  });

  it("skips missing external skills with warning (does not throw)", async () => {
    const mod = await import("../dist/installer/agent-provision.js");
    const workflowDir = path.join(tmpDir, "workflow");
    await fs.mkdir(workflowDir, { recursive: true });

    const workflow = {
      id: "test-wf3",
      name: "Test",
      steps: [],
      agents: [
        {
          id: "verifier",
          role: "verify",
          workspace: {
            baseDir: "agents/verifier",
            skills: ["nonexistent-skill"],
            files: {},
          },
        },
      ],
    };

    // Should not throw
    await mod.provisionAgents({
      workflow: workflow as any,
      workflowDir,
      installSkill: true,
    });
  });

  it("resolves shared bundled bootstrap files and links references", async () => {
    const mod = await import("../dist/installer/agent-provision.js");
    const workflowDir = path.join(tmpDir, "installed", "workflows", "feature-dev");
    const bundledRoot = path.join(tmpDir, "package");
    const bundledSourceDir = path.join(bundledRoot, "workflows", "feature-dev");
    const sharedDir = path.join(bundledRoot, "agents", "shared", "setup");
    const referencesDir = path.join(bundledRoot, "references");
    await fs.mkdir(workflowDir, { recursive: true });
    await fs.mkdir(bundledSourceDir, { recursive: true });
    await fs.mkdir(sharedDir, { recursive: true });
    await fs.mkdir(referencesDir, { recursive: true });
    await fs.writeFile(path.join(sharedDir, "AGENTS.md"), "# Shared setup agent");
    await fs.writeFile(path.join(referencesDir, "design-standards.md"), "# Design standards");

    const workflow = {
      id: "test-wf-shared",
      name: "Test",
      steps: [],
      agents: [
        {
          id: "setup",
          role: "setup",
          workspace: {
            baseDir: "agents/setup",
            skills: [],
            files: {
              "AGENTS.md": "../../agents/shared/setup/AGENTS.md",
            },
          },
        },
      ],
    };

    const results = await mod.provisionAgents({
      workflow: workflow as any,
      workflowDir,
      bundledSourceDir,
      installSkill: false,
    });

    const agentsMd = await fs.readFile(path.join(results[0].workspaceDir, "AGENTS.md"), "utf-8");
    assert.equal(agentsMd, "# Shared setup agent");

    const referencesLink = path.join(results[0].workspaceDir, "references");
    const linkStat = await fs.lstat(referencesLink);
    assert.equal(linkStat.isSymbolicLink(), true);
    const linkTarget = await fs.readlink(referencesLink);
    assert.equal(path.resolve(results[0].workspaceDir, linkTarget), referencesDir);
  });

  it("does not interfere with setfarm-workflows skill (bundled)", async () => {
    const mod = await import("../dist/installer/agent-provision.js");
    const workflowDir = path.join(tmpDir, "workflow");
    // Create bundled setfarm-workflows skill in workflow dir
    const bundledSkillDir = path.join(workflowDir, "skills", "setfarm-workflows");
    await fs.mkdir(bundledSkillDir, { recursive: true });
    await fs.writeFile(path.join(bundledSkillDir, "SKILL.md"), "# Setfarm Workflows");

    const workflow = {
      id: "test-wf4",
      name: "Test",
      steps: [],
      agents: [
        {
          id: "planner",
          role: "planning",
          workspace: {
            baseDir: "agents/planner",
            skills: ["setfarm-workflows", "agent-browser"],
            files: {},
          },
        },
      ],
    };

    const results = await mod.provisionAgents({
      workflow: workflow as any,
      workflowDir,
      installSkill: true,
    });

    // setfarm-workflows should be installed from bundled source
    const bundledDest = path.join(results[0].workspaceDir, "skills", "setfarm-workflows", "SKILL.md");
    const bundledContent = await fs.readFile(bundledDest, "utf-8");
    assert.ok(bundledContent.includes("Setfarm Workflows"));

    // agent-browser should be installed from external source
    const externalDest = path.join(results[0].workspaceDir, "skills", "agent-browser", "SKILL.md");
    const externalContent = await fs.readFile(externalDest, "utf-8");
    assert.ok(externalContent.includes("Agent Browser Skill"));
  });

  it("installs skills for multiple agents independently", async () => {
    const mod = await import("../dist/installer/agent-provision.js");
    const workflowDir = path.join(tmpDir, "workflow");
    await fs.mkdir(workflowDir, { recursive: true });

    const workflow = {
      id: "test-wf5",
      name: "Test",
      steps: [],
      agents: [
        {
          id: "verifier",
          role: "verify",
          workspace: {
            baseDir: "agents/verifier",
            skills: ["agent-browser"],
            files: {},
          },
        },
        {
          id: "reviewer",
          role: "analysis",
          workspace: {
            baseDir: "agents/reviewer",
            skills: ["agent-browser"],
            files: {},
          },
        },
        {
          id: "planner",
          role: "planning",
          workspace: {
            baseDir: "agents/planner",
            skills: [],
            files: {},
          },
        },
      ],
    };

    const results = await mod.provisionAgents({
      workflow: workflow as any,
      workflowDir,
      installSkill: true,
    });

    // Verifier and reviewer should have agent-browser
    for (const r of results.filter(r => r.id.includes("verifier") || r.id.includes("reviewer"))) {
      const dest = path.join(r.workspaceDir, "skills", "agent-browser", "SKILL.md");
      const content = await fs.readFile(dest, "utf-8");
      assert.ok(content.includes("Agent Browser Skill"));
    }

    // Planner should NOT have agent-browser
    const plannerResult = results.find(r => r.id.includes("planner"))!;
    const plannerSkillPath = path.join(plannerResult.workspaceDir, "skills", "agent-browser");
    await assert.rejects(fs.access(plannerSkillPath), "Planner should not have agent-browser skill");
  });
});
