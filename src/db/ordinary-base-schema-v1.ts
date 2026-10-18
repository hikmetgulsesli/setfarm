import type postgres from "postgres";

export type OrdinaryBaseSchemaSqlV1 = {
  <T extends readonly (object | undefined)[] = postgres.Row[]>(
    template: TemplateStringsArray, ...parameters: readonly any[]
  ): postgres.PendingQuery<T>;
};

/** Caller owns transaction management and global readiness. */
export async function installOrdinaryBaseSchemaV1(s: OrdinaryBaseSchemaSqlV1): Promise<void> {
  await s`CREATE SEQUENCE IF NOT EXISTS runs_run_number_seq`;
  await s`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      run_number INTEGER NOT NULL DEFAULT nextval('runs_run_number_seq'::regclass),
      workflow_id TEXT NOT NULL,
      task TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      context TEXT NOT NULL DEFAULT '{}',
      meta TEXT,
      notify_url TEXT,
      assigned_developer TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await s`
    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      step_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      input_template TEXT NOT NULL,
      expects TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      output TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 2,
      abandoned_count INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ,
      type TEXT NOT NULL DEFAULT 'single',
      loop_config TEXT,
      current_story_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await s`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      story_index INTEGER NOT NULL,
      story_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      acceptance_criteria TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      output TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 2,
      abandoned_count INTEGER NOT NULL DEFAULT 0,
      claimed_by TEXT,
      claimed_at TIMESTAMPTZ,
      claim_generation INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ,
      depends_on TEXT,
      scope_files TEXT,
      shared_files TEXT,
      scope_targets TEXT,
      requested_dependencies TEXT,
      shared_edit_requests TEXT,
      resolved_scope_files TEXT,
      scope_description TEXT,
      file_skeletons TEXT,
      implementation_contract TEXT,
      story_screens TEXT,
      story_branch TEXT,
      pr_url TEXT,
      merge_status TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await s`
    CREATE TABLE IF NOT EXISTS claim_log (
      id BIGSERIAL PRIMARY KEY,
      run_id TEXT NOT NULL,
      step_id TEXT NOT NULL,
      story_id TEXT,
      agent_id TEXT NOT NULL,
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      outcome TEXT,
      abandoned_at TIMESTAMPTZ,
      duration_ms INTEGER,
      diagnostic TEXT
    )
  `;
  await s`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      project_type TEXT NOT NULL DEFAULT 'general',
      source TEXT,
      severity TEXT NOT NULL DEFAULT 'mandatory',
      applies_to TEXT NOT NULL DEFAULT 'implement',
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      readonly BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await s`
    CREATE TABLE IF NOT EXISTS medic_checks (
      id TEXT PRIMARY KEY,
      checked_at TIMESTAMPTZ NOT NULL,
      issues_found INTEGER NOT NULL DEFAULT 0,
      actions_taken INTEGER NOT NULL DEFAULT 0,
      summary TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '[]'
    )
  `;
  await s`
    CREATE TABLE IF NOT EXISTS run_observations (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      step_id TEXT NOT NULL,
      story_id TEXT NOT NULL DEFAULT '',
      agent_id TEXT,
      phase TEXT,
      check_id TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT,
      detail TEXT,
      evidence TEXT NOT NULL DEFAULT '{}',
      file_paths TEXT NOT NULL DEFAULT '[]',
      github TEXT NOT NULL DEFAULT '{}',
      metadata TEXT NOT NULL DEFAULT '{}',
      event_type TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await s`ALTER TABLE runs ADD COLUMN IF NOT EXISTS run_number INTEGER DEFAULT nextval('runs_run_number_seq'::regclass)`;
  await s`ALTER TABLE runs ADD COLUMN IF NOT EXISTS meta TEXT`;
  await s`ALTER TABLE runs ADD COLUMN IF NOT EXISTS assigned_developer TEXT`;
  await s`ALTER TABLE steps ADD COLUMN IF NOT EXISTS abandoned_count INTEGER NOT NULL DEFAULT 0`;
  await s`ALTER TABLE steps ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`;
  await s`ALTER TABLE steps ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'single'`;
  await s`ALTER TABLE steps ADD COLUMN IF NOT EXISTS loop_config TEXT`;
  await s`ALTER TABLE steps ADD COLUMN IF NOT EXISTS current_story_id TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS abandoned_count INTEGER NOT NULL DEFAULT 0`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS claimed_by TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS claim_generation INTEGER NOT NULL DEFAULT 0`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS depends_on TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS scope_files TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS shared_files TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS scope_targets TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS requested_dependencies TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS shared_edit_requests TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS resolved_scope_files TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS scope_description TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS file_skeletons TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS implementation_contract TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS story_screens TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS story_branch TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS pr_url TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS merge_status TEXT`;
  await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS quality_failure_fingerprint TEXT`;
  await s`ALTER TABLE run_observations ADD COLUMN IF NOT EXISTS event_type TEXT`;
  await s`ALTER TABLE run_observations ADD COLUMN IF NOT EXISTS detail TEXT`;

  await s`CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_run_number_unique ON runs(run_number)`;
  await s`CREATE INDEX IF NOT EXISTS idx_steps_run_status ON steps(run_id, status)`;
  await s`CREATE INDEX IF NOT EXISTS idx_stories_run_status ON stories(run_id, status)`;
  await s`CREATE UNIQUE INDEX IF NOT EXISTS idx_stories_active_story_id_unique ON stories(run_id, story_id) WHERE status IN ('pending', 'running')`;
  await s`CREATE INDEX IF NOT EXISTS idx_stories_quality_failure_fingerprint ON stories(run_id, quality_failure_fingerprint) WHERE quality_failure_fingerprint IS NOT NULL`;
  await s`CREATE INDEX IF NOT EXISTS idx_steps_agent_status ON steps(agent_id, status) WHERE status IN ('pending', 'running')`;
  await s`CREATE INDEX IF NOT EXISTS idx_runs_status_dev ON runs(status, assigned_developer) WHERE status = 'running'`;
  await s`CREATE INDEX IF NOT EXISTS idx_run_observations_run_created ON run_observations(run_id, created_at DESC)`;
  await s`CREATE INDEX IF NOT EXISTS idx_run_observations_step_story ON run_observations(run_id, step_id, story_id, created_at DESC)`;
  await s`CREATE INDEX IF NOT EXISTS idx_run_observations_status ON run_observations(run_id, status, created_at DESC)`;

  // Runtime schema bootstrap is intentionally read-only with respect to
  // lifecycle rows. Duplicate owners require an explicit, quiesced recovery
  // operation; a process that merely opens the database must never choose a
  // winner or close a claim behind the spawner's back.
  const duplicateOpenSingle = await s<Array<{ run_id: string; step_id: string }>>`
    SELECT run_id, step_id
      FROM claim_log
     WHERE outcome IS NULL AND story_id IS NULL
     GROUP BY run_id, step_id
    HAVING COUNT(*) > 1
     LIMIT 1
  `;
  if (duplicateOpenSingle.length > 0) {
    throw new Error("CLAIM_LOG_OPEN_SINGLE_DUPLICATE_REQUIRES_RECOVERY");
  }
  const duplicateOpenStory = await s<Array<{ run_id: string; step_id: string; story_id: string }>>`
    SELECT run_id, step_id, story_id
      FROM claim_log
     WHERE outcome IS NULL AND story_id IS NOT NULL
     GROUP BY run_id, step_id, story_id
    HAVING COUNT(*) > 1
     LIMIT 1
  `;
  if (duplicateOpenStory.length > 0) {
    throw new Error("CLAIM_LOG_OPEN_STORY_DUPLICATE_REQUIRES_RECOVERY");
  }
  await s`CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_log_open_single_unique ON claim_log(run_id, step_id) WHERE outcome IS NULL AND story_id IS NULL`;
  await s`CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_log_open_story_unique ON claim_log(run_id, step_id, story_id) WHERE outcome IS NULL AND story_id IS NOT NULL`;
}
