import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { ClaimContext } from "../types.js";
import { pgGet } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import { resolveSetfarmCli } from "../../paths.js";
import {
  collectUiBehaviorRequirements,
  computePredictedScreenFiles,
  extractExplicitMaxStories,
} from "./context.js";

function compactText(text: string, fallback: string): string {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 180) : fallback;
}

function loadScreenMap(repo: string): any[] {
  const p = path.join(repo, "stitch", "SCREEN_MAP.json");
  if (!fs.existsSync(p)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function buildAcceptanceCriteria(repo: string): string[] {
  const reqs = collectUiBehaviorRequirements(repo);
  const criteria = reqs.slice(0, 30).map((req) => {
    const trigger = [req.label, req.icon ? `icon ${req.icon}` : ""].filter(Boolean).join(" / ");
    return `${req.screenTitle}: ${req.kind} \"${trigger}\" must produce visible behavior: ${req.expectedBehavior}.`;
  });
  criteria.push("All visible active buttons/icons from Stitch screens have non-empty handlers or an explicit disabled/hidden state.");
  criteria.push("All generated screens are wired into the app shell and remain responsive on desktop and mobile.");
  criteria.push("Stateful interactions persist only when the PRD or DESIGN_DOM explicitly requires persistence; no unrelated demo flows are added.");
  return unique(criteria).slice(0, 40);
}

export function buildSingleStoryScopeFiles(screenFiles: string[]): string[] {
  return unique([
    ...screenFiles,
    "src/App.tsx",
    "src/App.css",
    "src/main.tsx",
    "src/index.css",
  ]);
}

export async function preClaim(ctx: ClaimContext): Promise<void> {
  const maxStories = extractExplicitMaxStories(`${ctx.task || ""}\n${ctx.context["task"] || ""}\n${ctx.context["prd"] || ""}`);
  if (maxStories !== 1) return;

  const existing = await pgGet<{ cnt: string }>("SELECT COUNT(*)::text as cnt FROM stories WHERE run_id = $1", [ctx.runId]);
  if (Number(existing?.cnt || 0) > 0) return;

  const repo = ctx.context["repo"] || ctx.context["REPO"] || "";
  if (!repo) return;
  const predicted = computePredictedScreenFiles(repo);
  if (predicted.length === 0) return;

  const screenMap = loadScreenMap(repo);
  const screenIds = unique(predicted.map((s) => s.screenId));
  const screenFiles = unique(predicted.map((s) => s.filePath));
  const scopeFiles = buildSingleStoryScopeFiles(screenFiles);

  const product = compactText(ctx.context["project_name"] || ctx.context["task"] || ctx.task, "Uygulama");
  const story = {
    id: "US-001",
    title: `${product} - complete single-story implementation`,
    description: "Single explicit-cap story covering generated screens, app integration, visible controls, route/state behavior, and any persistence explicitly required by PRD/DESIGN_DOM.",
    acceptanceCriteria: buildAcceptanceCriteria(repo),
    depends_on: [],
    screens: screenIds,
    scope_files: scopeFiles,
    shared_files: [],
    scope_description: "One-story explicit user cap: implement all generated screens, visible button/icon behavior, app integration, and only the state/persistence behavior required by the project context.",
    file_skeletons: Object.fromEntries(scopeFiles.map((f) => [f, f.startsWith("src/screens/") ? "Generated Stitch screen wired to shared app state and behavior handlers." : "Shared single-story app implementation file."])),
  };

  const mappedScreens = (screenMap.length > 0 ? screenMap : predicted.map((s) => ({
    screenId: s.screenId,
    name: s.title,
    type: "screen",
    description: s.title,
  }))).map((s: any) => ({
    screenId: s.screenId || s.id,
    name: s.name || s.title || s.screenId || s.id,
    type: s.type || "screen",
    description: s.description || s.name || s.title || "Generated screen",
    stories: ["US-001"],
  })).filter((s: any) => s.screenId);

  const step = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
  if (!step?.id) return;

  const outPath = path.join(os.tmpdir(), `setfarm-auto-stories-${ctx.runId}.txt`);
  const output = [
    "STATUS: done",
    "STORIES_JSON:",
    JSON.stringify([story], null, 2),
    "SCREEN_MAP:",
    JSON.stringify(mappedScreens, null, 2),
    "",
  ].join("\n");
  fs.writeFileSync(outPath, output, "utf-8");

  logger.info(`[module:stories preclaim] Auto-completing explicit MAX_STORIES=1 with ${screenIds.length} screen(s)`, { runId: ctx.runId });
  execFileSync("/usr/bin/node", [resolveSetfarmCli(), "step", "complete", step.id, "--file", outPath], {
    cwd: repo,
    timeout: 120000,
    stdio: "pipe",
  });
}
