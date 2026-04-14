import type { ParsedOutput, ValidationResult, CompleteContext } from "../types.js";
import { pgRun, now } from "../../../db-pg.js";
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

export async function onComplete(ctx: CompleteContext): Promise<void> {
  const { runId, parsed, context } = ctx;

  // Persist context keys used by downstream steps
  context["repo"] = parsed.repo || "";
  context["branch"] = parsed.branch || "";
  context["tech_stack"] = (parsed.tech_stack || "").toLowerCase();
  context["prd"] = parsed.prd || "";
  context["prd_screen_count"] = parsed.prd_screen_count || "";
  context["db_required"] = (parsed.db_required || "").toLowerCase();

  // Best-effort PRD persistence. Missing prds table is not fatal — the
  // pipeline continues via context. The MC dashboard reads from prds when
  // the row exists. Non-blocking: a DB hiccup shouldn't fail the step.
  try {
    await pgRun(
      `INSERT INTO prds (run_id, content, screen_count, tech_stack, db_required, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (run_id) DO UPDATE SET
         content = EXCLUDED.content,
         screen_count = EXCLUDED.screen_count,
         tech_stack = EXCLUDED.tech_stack,
         db_required = EXCLUDED.db_required,
         updated_at = EXCLUDED.updated_at`,
      [
        runId,
        parsed.prd || "",
        parseInt(parsed.prd_screen_count || "0", 10),
        (parsed.tech_stack || "").toLowerCase(),
        (parsed.db_required || "").toLowerCase(),
        now(),
      ]
    );
    logger.info(`[module:plan] PRD persisted for run ${runId}`, { runId });
  } catch (e) {
    logger.warn(`[module:plan] PRD persist skipped: ${String(e).slice(0, 200)}`, { runId });
  }
}
