import os from "node:os";
import path from "node:path";
import type { ParsedOutput, ValidationResult, CompleteContext } from "../types.js";
import { logger } from "../../../lib/logger.js";

const VALID_TECH_STACKS = new Set([
  "vite-react",
  "nextjs",
  "vanilla-ts",
  "node-express",
  "react-native",
]);

const VALID_DB_REQUIRED = new Set(["none", "postgres", "sqlite"]);

const MIN_PRD_LENGTH = 500;
const MIN_SCREEN_COUNT = 3;

// Normalize REPO path: if agent returns a path outside $HOME/projects, slug it
// under $HOME/projects/<slug>. Runs before validation so the fixed value passes.
export function normalize(parsed: ParsedOutput): void {
  const repo = (parsed.repo || "").trim();
  if (!repo) return;
  const projectsDir = path.join(os.homedir(), "projects");
  if (!repo.startsWith(projectsDir) && !/^[/$~]/.test(repo)) {
    const slug = repo.split("/").filter(Boolean).pop() || "project";
    parsed.repo = path.join(projectsDir, slug);
    logger.warn(`[module:plan] REPO normalized: ${repo} -> ${parsed.repo}`);
  }
}

export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const errors: string[] = [];

  if ((parsed.status || "").toLowerCase() !== "done") {
    errors.push(`STATUS must be 'done' (got: '${parsed.status || ""}')`);
  }

  const repo = parsed.repo || "";
  if (!repo || !/^[/$~]/.test(repo)) {
    errors.push(`REPO must be an absolute path (got: '${repo}')`);
  }

  const branch = parsed.branch || "";
  if (!branch || branch.length > 80 || /\s/.test(branch)) {
    errors.push(`BRANCH must be non-empty, <=80 chars, no spaces (got: '${branch}')`);
  }

  const techStack = (parsed.tech_stack || "").toLowerCase();
  if (!VALID_TECH_STACKS.has(techStack)) {
    errors.push(`TECH_STACK must be one of ${[...VALID_TECH_STACKS].join(", ")} (got: '${techStack}')`);
  }

  const prd = parsed.prd || "";
  if (prd.length < MIN_PRD_LENGTH) {
    errors.push(`PRD must be >=${MIN_PRD_LENGTH} chars (got: ${prd.length})`);
  }

  const screenCountStr = parsed.prd_screen_count || "";
  const screenCount = parseInt(screenCountStr, 10);
  if (!Number.isFinite(screenCount) || screenCount < MIN_SCREEN_COUNT) {
    errors.push(`PRD_SCREEN_COUNT must be integer >=${MIN_SCREEN_COUNT} (got: '${screenCountStr}')`);
  }

  const dbRequired = (parsed.db_required || "").toLowerCase();
  if (!VALID_DB_REQUIRED.has(dbRequired)) {
    errors.push(`DB_REQUIRED must be one of ${[...VALID_DB_REQUIRED].join(", ")} (got: '${dbRequired}')`);
  }

  return { ok: errors.length === 0, errors };
}

// Side effect: stamp parsed values into the shared run context so downstream
// steps (design, stories, setup) read them from context["repo"] etc.
export async function onComplete(ctx: CompleteContext): Promise<void> {
  const { parsed, context } = ctx;
  context["repo"] = parsed.repo || "";
  context["branch"] = parsed.branch || "";
  context["tech_stack"] = (parsed.tech_stack || "").toLowerCase();
  context["prd"] = parsed.prd || "";
  context["prd_screen_count"] = parsed.prd_screen_count || "";
  context["db_required"] = (parsed.db_required || "").toLowerCase();
}
