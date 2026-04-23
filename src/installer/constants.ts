/**
 * Setfarm Constants — Single Source of Truth
 *
 * All magic numbers, threshold values, and duplicate lists extracted from
 * step-ops.ts and other modules. Import these instead of inline values.
 */

// ── Abandoned Step Detection ────────────────────────────────────────

/** Base threshold for detecting abandoned steps (first abandon).
 *  20min (Wave 16 revert): 5min was too aggressive — coding agents on implement
 *  routinely need >5min per story, triggering retry storms (run #491 postmortem:
 *  US-001 entered a 3x retry loop). Keep base conservative; the implement step
 *  itself is in SLOW_STEP_IDS which uses SLOW_ABANDONED_THRESHOLD_MS (40min). */
export const BASE_ABANDONED_THRESHOLD_MS = 1_200_000; // 20 min

/** Faster threshold for repeat abandonments */
export const FAST_ABANDONED_THRESHOLD_MS = 600_000; // 10 min

/** Max abandon resets before failing the step/story permanently */
export const MAX_ABANDON_RESETS = 5;

/** Steps that need longer abandon thresholds (Stitch API, complex builds) */
export const SLOW_STEP_IDS = new Set(["design", "implement", "setup-repo", "setup-build"]);

/** Extended threshold for slow steps (first abandon).
 *  Was 900_000 (15min) but comment said 40min — same halving bug. */
export const SLOW_ABANDONED_THRESHOLD_MS = 2_400_000; // 40 min (aligned with coding agent timeout)

/** Extended fast threshold for slow steps (repeat abandons) */
export const SLOW_FAST_ABANDONED_THRESHOLD_MS = 1_200_000; // 20 min

/** Fast step abandon threshold — verify, qa-test, security-gate, deploy finish in 1-2 min */
export const FAST_STEP_ABANDONED_THRESHOLD_MS = 300_000; // 5 min

/** Fast step repeat abandon threshold */
export const FAST_STEP_FAST_ABANDONED_THRESHOLD_MS = 180_000; // 3 min


/** Delay before verify step claims — waits for external PR review comments (Gemini, Copilot) */
export const PR_REVIEW_DELAY_MS = 300_000; // 5 min
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
  "story_workdir",
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
  "design_dom",
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
  // Pre-flight static analysis (verify step speedup)
  "preflight_analysis",
  "preflight_diff",
  "preflight_errors",
  // Platform-specific design rules (injected at implement/verify)
  "design_rules",
  "detected_platform",
  // Phased development (opt-in)
  "implement_phase",
  // File skeletons (function signatures from stories step)
  "file_skeletons",
  // Test generation prompt
  "test_generation_prompt",
  // Design token mapping (injected when hardcoded colors detected)
  "design_token_mapping",
] as const;


// ── Per-Step Context Allowlist (Wave 14 Bug K) ──────────────────────

/**
 * Per-step context allowlist. Keys NOT in the allowlist are pruned from
 * the context object BEFORE input_template resolution. Pruning is claim-scope
 * only — DB storage is unaffected. Prevents bloat leak (stitch_html, design_dom,
 * recent_stories_code injected at implement time) from drowning verify /
 * security-gate / qa-test / deploy steps in ~29K useless tokens.
 *
 * Wave 14 Bug K: discovered in run #344 postmortem — verify step received 115KB
 * of context, template referenced ~1.5KB. Rest was dead weight + DB credentials.
 */
export const STEP_CONTEXT_ALLOWLIST: Record<string, string[]> = {
  // Keys every step gets regardless of step_id — covers fragment placeholders
  // (critical-preamble.md, db-context.md) and common workflow vars.
  // Audited against: workflow.yml, agents/*/AGENTS.md, _fragments/*.md
  _common: [
    "task", "repo", "branch", "build_cmd", "test_cmd", "lint_cmd",
    "progress", "previous_failure", "failure_category", "failure_suggestion",
    "project_memory", "tech_stack", "run_id",
    // Fragment vars (pr, story branch, workdir) — may be empty in non-story steps
    "pr_url", "story_branch", "story_workdir", "final_pr",
    // DB context fragment — always blank (PROTECTED_OUTBOUND_KEYS) but template
    // references them, so they must be in allowlist to avoid [missing:] guard.
    "database_url", "db_host", "db_port", "db_name", "db_user", "db_password",
    "db_type", "db_required", "db_url",
  ],
  plan: ["prd", "prd_path"],
  design: ["prd", "screen_map_seed", "design_notes_seed", "device_type", "stitch_project_id"],
  stories: ["prd", "screen_map", "design_tokens", "design_system", "design_manifest", "design_dom_preview", "predicted_screen_files", "stitch_project_id"],
  "setup-repo": ["prd", "design_tokens", "screen_map"],
  "setup-build": ["prd", "baseline", "design_tokens", "design_system"],
  implement: [
    "current_story_id", "current_story", "current_story_title",
    "stories_json", "stories_remaining", "completed_stories",
    "stitch_html", "design_dom", "design_tokens", "design_manifest",
    "design_token_mapping", "design_notes", "design_rules", "design_fidelity_feedback",
    "screen_map", "story_screens", "ui_contract", "layout_skeleton",
    "recent_stories_code", "src_tree", "project_tree", "component_registry",
    "api_routes", "installed_packages", "shared_code",
    "implement_phase", "scope_creep_warning", "test_generation_prompt",
    "file_skeletons",
    "detected_platform", "implement_base_commit",
    "story_scope_files", "story_scope_description", "story_shared_files",
    "verify_feedback", "claim_generation",
  ],
  verify: [
    "current_story_id", "current_story", "current_story_title",
    "preflight_analysis", "preflight_diff", "preflight_errors",
    "verify_feedback", "stories_json", "completed_stories",
    "screen_map", "design_tokens",
  ],
  "security-gate": ["security_notes"],
  "qa-test": ["dev_server_port", "project_name", "date"],
  "final-test": ["dev_server_port", "browser_check_result"],
  deploy: ["deploy_url"],
};

/**
 * PROTECTED outbound keys — NEVER injected into any agent prompt.
 * Wave 14 Bug K: discovered DB credentials leaking into verify context during
 * #344 analysis. These must be stripped unconditionally, regardless of allowlist.
 */
export const PROTECTED_OUTBOUND_KEYS = new Set<string>([
  // DB credentials
  "db_host", "db_port", "db_user", "db_password", "db_url",
  "database_url", "pg_url", "SETFARM_PG_URL",
  // API keys (defense-in-depth — these shouldn't be in context anyway)
  "api_key", "token", "secret",
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "MOONSHOT_API_KEY",
  "ZAI_API_KEY", "XAI_API_KEY", "GOOGLE_API_KEY",
  "MINIMAX_API_KEY", "KIMI_API_KEY", "OPENCODE_API_KEY", "BRAVE_API_KEY",
]);

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
