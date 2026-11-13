import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { verifyModule } from "../../src/installer/steps/07-verify/module.js";

// Restoring agent-owned merge/exec or accepting absent evidence breaks this handoff.
const prompt = verifyModule.buildPrompt({runId: "review-run", task: "Review story", context: {
  repo: "/product", story_workdir: "/product-story", branch: "run-branch",
  current_story: JSON.stringify({id: "US-001", scope_files: ["src/Counter.tsx"], acceptanceCriteria: ["Keyboard increments counter"]}),
  pr_url: "https://example.invalid/product/pull/1", pr_check_state: "passing",
  pr_mergeable: "MERGEABLE", pr_merge_state_status: "CLEAN",
  pr_comments: "PR state OPEN; no actionable review threads",
  preflight_analysis: "Platform build/test/lint PASS at reviewed head",
  playwright_report: "Platform runtime smoke PASS; keyboard increments counter",
  supervisor_memory: "SUPERVISOR_EVIDENCE: canonical 8/8 PASS at reviewed head",
  build_cmd: "npm run build", test_cmd: "npm test", lint_cmd: "npm run lint",
}});
const [instruction, rules] = prompt.split("# Rules\n\n");
const role = readFileSync(new URL("../../workflows/feature-dev/agents/reviewer/AGENTS.md", import.meta.url), "utf8");
const verifyRole = role.split("### VERIFY Step")[1]!.split("### SECURITY-GATE Step")[0]!;

for (const [name, text] of [["rendered instruction", instruction], ["appended rules", rules], ["verify role", verifyRole]] as const) {
  test(`${name} hands a clean OPEN review to the platform without claiming merge`, () => {
    assert.match(text, /read-only/i);
    assert.ok(text.includes("STATUS: done means review passed and hands control to Setfarm; it does not mean the PR is merged or the story is verified."));
    assert.ok(text.includes("Setfarm owns PR metadata refresh, exact-head premerge checks, merge confirmation, and post-merge build/smoke verification."));
    assert.match(text, /clean OPEN PR is reviewable/i);
    assert.doesNotMatch(text, /git (?:fetch|checkout)|gh pr (?:edit|comment|merge)|gh api -X|must (?:return|be) `MERGED`|allowed only after.*merged/i);
    assert.match(text, /missing.*mandatory.*evidence/is);
    assert.match(text, /(?:never|do not).*fabricate/is);
    assert.match(text, /acceptance.*STATUS: retry/is);
  });
}
test("rendered handoff retains story, evidence, configured platform checks and size bound", () => {
  for (const value of ["/product-story", "US-001", "src/Counter.tsx", "Keyboard increments counter", "canonical 8/8 PASS", "npm run build", "npm test", "npm run lint"]) assert.ok(prompt.includes(value), value);
  assert.ok(Buffer.byteLength(prompt) < verifyModule.maxPromptSize);
});
test("verify precedence overrides generic tools and claim summaries without changing other roles", () => {
  const note = role.slice(0, role.indexOf("## Tools Available"));
  assert.match(note, /verify.*precedence/is);
  assert.match(verifyRole, /canonical stage handoff\/instruction/i);
  assert.match(verifyRole, /claim.summary.*(?:not|never).*override/is);
});

test("read-only handoff preserves only canonical claim transport exceptions", () => {
  for (const text of [instruction, rules, verifyRole]) {
    assert.match(text, /exact bootstrap and claim-bound artifact submission/i);
    assert.match(text, /canonical stage handoff.*tool policy/is);
    assert.match(text, /completion\/failure transport/i);
    assert.match(text, /no ordinary shell, product commands, Git\/PR mutations, or services/i);
  }
  assert.match(role.slice(0, role.indexOf("## Tools Available")), /except.*canonical.*transport/is);
});
