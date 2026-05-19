/**
 * PostgreSQL database layer for Setfarm.
 * Async API, PostgreSQL-only database layer.
 * Uses porsager/postgres (tagged template SQL).
 */
import postgres from "postgres";
import { runtimeConfig } from "./runtime-config.js";

let _sql: ReturnType<typeof postgres> | null = null;
let _schemaReady = false;
let _schemaReadyPromise: Promise<void> | null = null;
let _isMigrating = false;

function resolvePgUrl(): string {
  return runtimeConfig.setfarmPgUrl;
}

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function maintenanceUrlFor(rawUrl: string): { url: string; database: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) || "postgres";
  if (!database || database === "postgres") return null;
  parsed.pathname = "/postgres";
  return { url: parsed.toString(), database };
}

async function ensureDatabaseExists(rawUrl: string): Promise<void> {
  const target = maintenanceUrlFor(rawUrl);
  if (!target) return;
  const admin = postgres(target.url, {
    max: 1,
    idle_timeout: 1,
    onnotice: () => {},
    connect_timeout: 5,
  });
  try {
    const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${target.database} LIMIT 1`;
    if (rows.length === 0) {
      await admin.unsafe(`CREATE DATABASE ${quoteIdent(target.database)}`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}

function getSql() {
  if (!_sql) {
    const url = resolvePgUrl();
    _sql = postgres(url, {
      max: 50,
      idle_timeout: 5,
      onnotice: () => {},
      connect_timeout: 10,
    });
  }
  return _sql;
}

export { getSql };

async function ensureSchemaReady(): Promise<void> {
  if (_schemaReady || _isMigrating) return;
  if (!_schemaReadyPromise) {
    _schemaReadyPromise = pgMigrate()
      .then(() => {
        _schemaReady = true;
      })
      .finally(() => {
        _schemaReadyPromise = null;
      });
  }
  await _schemaReadyPromise;
}

export async function pgQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  await ensureSchemaReady();
  const s = getSql();
  if (params.length === 0) {
    return s.unsafe(sql) as any;
  }
  return s.unsafe(sql, params) as any;
}

export async function pgGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  const rows = await pgQuery<T>(sql, params);
  return rows[0];
}

export async function pgRun(sql: string, params: any[] = []): Promise<{ changes: number }> {
  await ensureSchemaReady();
  const s = getSql();
  const result = params.length === 0 ? await s.unsafe(sql) : await s.unsafe(sql, params);
  return { changes: (result as any).count ?? 0 };
}

export async function pgExec(sql: string): Promise<void> {
  await ensureSchemaReady();
  const s = getSql();
  await s.unsafe(sql);
}

export async function pgBegin<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  await ensureSchemaReady();
  const s = getSql();
  return s.begin(fn as any) as any;
}

export async function pgMigrate(): Promise<void> {
  if (_isMigrating) return;
  _isMigrating = true;
  const url = resolvePgUrl();
  try {
    await ensureDatabaseExists(url);
    const s = getSql();

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
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS scope_description TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS file_skeletons TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS implementation_contract TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS story_screens TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS story_branch TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS pr_url TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS merge_status TEXT`;

    await s`CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_run_number_unique ON runs(run_number)`;
    await s`CREATE INDEX IF NOT EXISTS idx_steps_run_status ON steps(run_id, status)`;
    await s`CREATE INDEX IF NOT EXISTS idx_stories_run_status ON stories(run_id, status)`;
    await s`CREATE INDEX IF NOT EXISTS idx_steps_agent_status ON steps(agent_id, status) WHERE status IN ('pending', 'running')`;
    await s`CREATE INDEX IF NOT EXISTS idx_runs_status_dev ON runs(status, assigned_developer) WHERE status = 'running'`;

    await s`
      UPDATE claim_log cl
      SET outcome = 'abandoned',
          abandoned_at = NOW(),
          duration_ms = LEAST(CAST(EXTRACT(EPOCH FROM (NOW() - cl.claimed_at::timestamptz)) * 1000 AS BIGINT), 2147483647)::INTEGER,
          diagnostic = 'pgMigrate closed orphan open claim without parent run'
      WHERE cl.outcome IS NULL
        AND NOT EXISTS (SELECT 1 FROM runs r WHERE r.id = cl.run_id)
    `;
    await s`
      UPDATE claim_log cl
      SET outcome = CASE WHEN r.status = 'cancelled' THEN 'cancelled' ELSE 'abandoned' END,
          abandoned_at = NOW(),
          duration_ms = LEAST(CAST(EXTRACT(EPOCH FROM (NOW() - cl.claimed_at::timestamptz)) * 1000 AS BIGINT), 2147483647)::INTEGER,
          diagnostic = 'pgMigrate closed open claim for terminal run ' || r.status
      FROM runs r
      WHERE cl.run_id = r.id
        AND cl.outcome IS NULL
        AND r.status NOT IN ('running', 'resuming')
    `;
    await s`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY run_id, step_id, agent_id
                 ORDER BY claimed_at DESC, id DESC
               ) AS rn
        FROM claim_log
        WHERE outcome IS NULL AND story_id IS NULL
      )
      UPDATE claim_log cl
      SET outcome = 'infra_retry',
          abandoned_at = NOW(),
          duration_ms = LEAST(CAST(EXTRACT(EPOCH FROM (NOW() - cl.claimed_at::timestamptz)) * 1000 AS BIGINT), 2147483647)::INTEGER,
          diagnostic = 'pgMigrate deduped duplicate open single-step claim'
      FROM ranked r
      WHERE cl.id = r.id AND r.rn > 1
    `;
    await s`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY run_id, step_id, story_id, agent_id
                 ORDER BY claimed_at DESC, id DESC
               ) AS rn
        FROM claim_log
        WHERE outcome IS NULL AND story_id IS NOT NULL
      )
      UPDATE claim_log cl
      SET outcome = 'infra_retry',
          abandoned_at = NOW(),
          duration_ms = LEAST(CAST(EXTRACT(EPOCH FROM (NOW() - cl.claimed_at::timestamptz)) * 1000 AS BIGINT), 2147483647)::INTEGER,
          diagnostic = 'pgMigrate deduped duplicate open story claim'
      FROM ranked r
      WHERE cl.id = r.id AND r.rn > 1
    `;
    await s`CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_log_open_single_unique ON claim_log(run_id, step_id, agent_id) WHERE outcome IS NULL AND story_id IS NULL`;
    await s`CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_log_open_story_unique ON claim_log(run_id, step_id, story_id, agent_id) WHERE outcome IS NULL AND story_id IS NOT NULL`;
    _schemaReady = true;
  } finally {
    _isMigrating = false;
  }
}

export async function pgNextRunNumber(): Promise<number> {
  const row = await pgGet<{ next: number }>(
    "SELECT nextval('runs_run_number_seq'::regclass) AS next",
  );
  return row?.next ?? 1;
}

export async function pgCleanupOrphans(): Promise<{ deletedSteps: number; deletedStories: number }> {
  await ensureSchemaReady();
  const s = getSql();
  const r1 = await s`DELETE FROM steps WHERE run_id NOT IN (SELECT id FROM runs)`;
  const r2 = await s`DELETE FROM stories WHERE run_id NOT IN (SELECT id FROM runs)`;
  return { deletedSteps: r1.count, deletedStories: r2.count };
}

export async function pgCheckpoint(): Promise<void> {
  // PostgreSQL handles WAL internally; no manual checkpoint is needed.
}

export async function pgClose(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
    _schemaReady = false;
    _schemaReadyPromise = null;
  }
}

export const now = (): string => new Date().toISOString();

export function installPgSignalHandlers(): void {
  process.on("SIGTERM", () => { pgClose().catch(() => {}); });
  process.on("SIGINT", () => { pgClose().catch(() => {}); });
}
