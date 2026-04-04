/**
 * Setfarm Constants — Single Source of Truth
 *
 * All magic numbers, threshold values, and duplicate lists extracted from
 * step-ops.ts and other modules. Import these instead of inline values.
 */

// ── Abandoned Step Detection ────────────────────────────────────────

/** Base threshold for detecting abandoned steps (first abandon) */
export const BASE_ABANDONED_THRESHOLD_MS = 600_000; // 20 min (aligned with agent timeout)

/** Faster threshold for repeat abandonments */
export const FAST_ABANDONED_THRESHOLD_MS = 300_000; // 10 min

/** Max abandon resets before failing the step/story permanently */
export const MAX_ABANDON_RESETS = 3;

/** Steps that need longer abandon thresholds (Stitch API, complex builds) */
export const SLOW_STEP_IDS = new Set(["design", "implement", "setup-repo", "setup-build"]);

/** Extended threshold for slow steps (first abandon) */
export const SLOW_ABANDONED_THRESHOLD_MS = 900_000; // 40 min (aligned with coding agent timeout)

/** Extended fast threshold for slow steps (repeat abandons) */
export const SLOW_FAST_ABANDONED_THRESHOLD_MS = 600_000; // 20 min

// ── Cleanup Throttle ────────────────────────────────────────────────

/** Throttle interval for cleanupAbandonedSteps (matches cron interval) */
export const CLEANUP_THROTTLE_MS = 30_000; // 30 sec

// ── Git Timeouts ────────────────────────────────────────────────────

export const GIT_SHORT_TIMEOUT = 5_000;
export const GIT_MEDIUM_TIMEOUT = 10_000;
export const GIT_LONG_TIMEOUT = 30_000;
export const GH_CLI_TIMEOUT = 15_000;
export const GH_MERGE_TIMEOUT = 30_000;

// ── Context Protection ──────────────────────────────────────────────

/**
 * Context keys that must never be overwritten by step output.
 * These are seed values set at run creation time.
 */
export const PROTECTED_CONTEXT_KEYS = new Set([
  "repo",
  "task",
  "branch",
  "run_id",
]);

// ── Optional Template Variables ─────────────────────────────────────

/**
 * Variables that may or may not exist depending on workflow configuration.
 * Defaulted to "" to prevent MISSING_INPUT_GUARD false positives.
 *
 * IMPORTANT: This is the SINGLE source of truth. Previously duplicated at:
 *   - step-ops.ts line 959 (STORY_OPTIONAL_VARS — story-each flow)
 *   - step-ops.ts line 1010 (OPTIONAL_VARS — single-step flow)
 */
export const OPTIONAL_TEMPLATE_VARS = [
  // Verify/progress
  "verify_feedback",
  "previous_failure",
  "progress",
  "project_memory",
  "security_notes",
  "changes",
  // Story context
  "story_branch",
  "pr_url",
  "completed_stories",
  "stories_remaining",
  "current_story",
  "current_story_id",
  "stories_json",
  "current_story_title",
  "final_pr",
  // PRD: removed from optional list in v1.5.53 — prd is now mandatory
  // PRD screen count
  "prd_screen_count",
  // Design system (Stitch)
  "design_system",
  "stitch_project_id",
  "design_manifest",
  "design_tokens",
  "screens_generated",
  "device_type",
  "design_notes",
  "ui_contract",
  "design_feedback",
  "layout_skeleton",
  "screen_map",
  "story_screens",
  "src_tree",
  "stitch_html",
  "design_fidelity_feedback",
  "design_warning",
  // Database
  "database_url",
  "db_host",
  "db_port",
  "db_name",
  "db_user",
  "db_password",
  "db_required",
  "db_type",
  // Tech stack
  "tech_stack",
  // Smart Context (injected at implement step)
  "project_tree",
  "installed_packages",
  "shared_code",
  "recent_stories_code",
  "component_registry",
  "api_routes",
  // Build/test/lint commands (may not exist for all project types)
  "build_cmd",
  "test_cmd",
  "lint_cmd",
  // Dev server
  "dev_server_port",
  // Browser
  "browser_dom_snapshot",
  "browser_check_result",
] as const;


// ── Story Retry / Model Fallback ────────────────────────────────────

/** Default max retries per story (was 3, raised to 5) */
export const DEFAULT_STORY_MAX_RETRIES = 5;

/** After this many retries, switch to fallback model */
export const STORY_FALLBACK_RETRY_THRESHOLD = 2;

/** Fallback model for story retries (minimax when primary is kimi, vice versa) */
export const STORY_FALLBACK_MODEL = "minimax/MiniMax-M2.7";
// ── Stories ──────────────────────────────────────────────────────────

/** Maximum number of stories a planner can produce */
export const MAX_STORIES = 50;

/** Max lines for PROJECT_MEMORY.md */
export const PROJECT_MEMORY_MAX_LINES = 150;

// ── Test Failure Patterns ───────────────────────────────────────────

/**
 * Regex patterns to detect test failures in agent output.
 * Used by the test guardrail in completeStep.
 */
export const TEST_FAIL_PATTERNS = [
  /Tests?:\s+(\d+)\s+failed/i,           // Jest: "Tests: 73 failed"
  /Test Suites?:\s+(\d+)\s+failed/i,      // Jest: "Test Suites: 5 failed"
  /(\d+)\s+tests?\s+failed/i,             // Generic: "73 tests failed"
  /(\d+)\s+failing\b/i,                   // Mocha: "73 failing"
] as const;

// ── Frontend Change Detection ───────────────────────────────────────

export const GIT_DIFF_TIMEOUT = 10_000;

// ── Status Constants ────────────────────────────────────────────────

export const RUN_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  DONE: "done",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export const STEP_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  DONE: "done",
  FAILED: "failed",
  SKIPPED: "skipped",
  WAITING: "waiting",
} as const;

export const STORY_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  DONE: "done",
  VERIFIED: "verified",
  FAILED: "failed",
  SKIPPED: "skipped",
  CANCELLED: "cancelled",
} as const;

// ── Developer Agent Pool ────────────────────────────────────────────

export const DEFAULT_DEVELOPER_AGENTS = ["koda", "flux", "cipher", "prism", "lux", "nexus"] as const;
