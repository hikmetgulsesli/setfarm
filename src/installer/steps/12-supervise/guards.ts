import type { CompleteContext, ParsedOutput, ValidationResult } from "../types.js";
import { updateSupervisorMemory } from "../../product-supervisor.js";
import { readSupervisorState, writeSupervisorState } from "../../supervisor/state.js";
import { recordGateObservation, recordStackEvidencePlanObservation } from "../../operation-observability.js";

function firstWord(value: string | undefined): string {
  return String(value || "").trim().split(/\s+/)[0].toLowerCase();
}

function expectedAcceptanceCriteriaCount(currentStory: string | undefined): number {
  const text = String(currentStory || "");
  const marker = text.match(/Acceptance Criteria:\s*([\s\S]*)/i);
  if (!marker) return 0;
  const body = marker[1];
  const numbered = body.match(/^\s*\d+\.\s+\S.*$/gm) || [];
  if (numbered.length > 0) return numbered.length;
  return body.split(/\n+/).map((line) => line.trim()).filter(Boolean).length;
}

function parsedCoverageCount(acCoverage: string): { done: number; total: number; complete: boolean } | null {
  const match = acCoverage.match(/\bchecked\s+(\d+)\s*\/\s*(\d+)\b/i);
  if (!match) return null;
  const done = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(done) || !Number.isFinite(total)) return null;
  return { done, total, complete: done === total };
}

export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const status = firstWord(parsed.status);
  if (!status) return { ok: false, errors: ["STATUS is required"] };
  if (!["done", "retry", "skip"].includes(status)) {
    return { ok: false, errors: [`STATUS must be done, retry, or skip; got ${parsed.status}`] };
  }
  if (status === "done") {
    const decision = firstWord(parsed.supervisor_decision);
    if (!decision) return { ok: false, errors: ["SUPERVISOR_DECISION is required when STATUS is done"] };
    if (!["pass", "fixed", "block"].includes(decision)) {
      return { ok: false, errors: [`SUPERVISOR_DECISION must be pass, fixed, or block; got ${parsed.supervisor_decision}`] };
    }
    if ((decision === "pass" || decision === "fixed") && !String(parsed.ac_coverage || "").trim()) {
      return { ok: false, errors: ["AC_COVERAGE is required when supervisor passes or fixes a checkpoint"] };
    }
  }
  return { ok: true, errors: [] };
}

export function normalizeOutput(parsed: ParsedOutput): void {
  const status = firstWord(parsed.status);
  if (status === "done" && !firstWord(parsed.supervisor_decision)) {
    parsed.supervisor_decision = "pass";
  }
}

export async function onComplete(ctx: CompleteContext): Promise<void> {
  const decision = firstWord(ctx.parsed.supervisor_decision) || "unknown";
  await recordStackEvidencePlanObservation({
    run_id: ctx.runId,
    step_id: ctx.stepId,
    agent_id: "supervisor",
  }, ctx.context, "running", "Supervisor resolved stack evidence contract.");
  const memoryAppend = (ctx.parsed.supervisor_memory_append || "").trim();
  const checks = (ctx.parsed.checks || "").trim();
  const changes = (ctx.parsed.changes || "").trim();
  const risks = (ctx.parsed.risks || "").trim();
  const issues = (ctx.parsed.issues || "").trim();
  const acCoverage = (ctx.parsed.ac_coverage || "").trim();
  if ((decision === "pass" || decision === "fixed") && String(ctx.context["supervisor_scope"] || "") === "story") {
    const expectedCount = expectedAcceptanceCriteriaCount(ctx.context["current_story"]);
    const coverageCount = parsedCoverageCount(acCoverage);
    if (expectedCount <= 0) {
      throw new Error("SUPERVISOR_AC_CONTEXT_MISSING: story-scoped supervisor pass/fixed requires CURRENT_STORY with acceptance criteria.");
    }
    if (/\btask requirements?\b/i.test(acCoverage)) {
      throw new Error("SUPERVISOR_AC_COVERAGE_GENERIC: story-scoped supervisor coverage must audit story acceptance criteria, not the task brief.");
    }
    if (!coverageCount) {
      throw new Error(`SUPERVISOR_AC_COVERAGE_FORMAT: story-scoped supervisor coverage must include "checked N/N acceptance criteria"; got ${acCoverage || "empty coverage"}.`);
    }
    if (!coverageCount.complete) {
      throw new Error(`SUPERVISOR_AC_COVERAGE_INCOMPLETE: supervisor reported ${acCoverage}, but current story has ${expectedCount} acceptance criteria.`);
    }
    if (coverageCount.total !== expectedCount) {
      ctx.context["supervisor_coverage_warning"] = `Supervisor reported ${coverageCount.done}/${coverageCount.total}, current story has ${expectedCount}; accepted because coverage was complete and story-specific.`;
    }
  }

  const lines = [
    `### ${new Date().toISOString()} llm-supervisor ${decision}`,
    `- Step: ${ctx.stepId}`,
    `- Decision: ${decision}`,
  ];
  if (memoryAppend) lines.push(`- Memory: ${memoryAppend.slice(0, 1200)}`);
  if (acCoverage) lines.push(`- AC Coverage: ${acCoverage.slice(0, 800)}`);
  if (changes) lines.push(`- Changes: ${changes.slice(0, 800)}`);
  if (checks) lines.push(`- Checks: ${checks.slice(0, 800)}`);
  if (risks) lines.push(`- Risks: ${risks.slice(0, 800)}`);
  if (issues) lines.push(`- Issues: ${issues.slice(0, 800)}`);

  updateSupervisorMemory(ctx.context, `${lines.join("\n")}\n`);
  ctx.context["supervisor_last_decision"] = decision;
  ctx.context["supervisor_last_summary"] = (memoryAppend || changes || checks || issues || ctx.rawOutput || "").slice(0, 1500);
  await recordGateObservation({
    runId: ctx.runId,
    stepId: ctx.stepId,
    agentId: "supervisor",
    storyId: ctx.currentStoryId || ctx.context["current_story_id"] || "",
    checkId: "supervisor-decision",
    label: "Supervisor decision",
    status: decision === "block" ? "blocked" : "pass",
    summary: `Supervisor ${decision}`,
    detail: (issues || memoryAppend || changes || checks || ctx.rawOutput || "").slice(0, 1500),
    metadata: {
      scope: ctx.context["supervisor_scope"] || "final-product",
      acCoverage,
    },
  });

  if ((decision === "pass" || decision === "fixed") && String(ctx.context["supervisor_scope"] || "") === "story") {
    markStorySupervisorStatePassed(ctx, decision);
  }

  if (decision === "block") {
    ctx.context["previous_failure"] = issues || memoryAppend || "Supervisor blocked the product checkpoint.";
    ctx.context["failure_category"] = "LLM_SUPERVISOR_BLOCKED";
    ctx.context["failure_suggestion"] = "Treat this as manager feedback. Fix the root product/code contract violation, then rerun supervisor.";
    throw new Error(`LLM_SUPERVISOR_BLOCKED: ${(issues || memoryAppend || "blocked").slice(0, 400)}`);
  }
}

function markStorySupervisorStatePassed(ctx: CompleteContext, decision: string): void {
  const storyId = String(ctx.context["current_story_id"] || "").trim();
  const workdir = String(ctx.context["story_workdir"] || ctx.context["repo"] || "").trim();
  if (!storyId || !workdir) return;

  const nowIso = new Date().toISOString();
  const state = readSupervisorState(workdir, ctx.runId);
  const story = state.stories[storyId] || {
    status: "passed",
    currentWorker: undefined,
    openBlockers: [],
    warnings: [],
    resolved: [],
    lastEvidenceAt: nowIso,
  };

  const previousOpen = [...new Set([...(story.openBlockers || []), ...(story.warnings || [])])];
  for (const itemId of previousOpen) {
    if (!story.resolved.includes(itemId)) story.resolved.push(itemId);
    const evidence = state.evidence[itemId];
    if (evidence) {
      state.evidence[itemId] = {
        ...evidence,
        status: "passed",
        severity: evidence.severity || "blocker",
        observed: [
          ...(Array.isArray(evidence.observed) ? evidence.observed : []),
          `Resolved by story-scoped LLM supervisor ${decision} decision.`,
        ].slice(-12),
        message: `Supervisor ${decision} decision cleared this previous finding.`,
        checkedAt: nowIso,
      };
    }
  }

  const syntheticId = `llm-supervisor:${storyId}:decision`;
  if (!story.resolved.includes(syntheticId)) story.resolved.push(syntheticId);
  story.openBlockers = [];
  story.warnings = [];
  story.status = "passed";
  story.lastEvidenceAt = nowIso;
  state.stories[storyId] = story;
  state.evidence[syntheticId] = {
    itemId: syntheticId,
    storyId,
    status: "passed",
    severity: "info",
    observed: [
      `SUPERVISOR_DECISION: ${decision}`,
      String(ctx.parsed.ac_coverage || "").slice(0, 500),
    ].filter(Boolean),
    lastScan: "llm-supervisor",
    files: [],
    message: `Story-scoped supervisor completed with ${decision}.`,
    checkedAt: nowIso,
  } as any;
  state.projectStatus = Object.values(state.stories).some((item) => item.openBlockers.length > 0)
    ? "blocked"
    : "implementing";
  writeSupervisorState(workdir, state);
}
