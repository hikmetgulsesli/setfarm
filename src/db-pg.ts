/**
 * PostgreSQL database layer for Setfarm.
 * Async API — PostgreSQL-only database layer.
 * Uses porsager/postgres (tagged template SQL).
 */
import postgres from 'postgres';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_PG_URL = 'postgresql://localhost:5432/setfarm';

let _sql: ReturnType<typeof postgres> | null = null;

function getSql() {
  if (!_sql) {
    // Sanitize URL: strip anything after the DB name (e.g. stray env vars appended by gateway)
    let url = (process.env.SETFARM_PG_URL || DEFAULT_PG_URL).split(/\s+/)[0];
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

// ── Query helpers ──

export async function pgQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
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
  const s = getSql();
  const result = params.length === 0 ? await s.unsafe(sql) : await s.unsafe(sql, params);
  return { changes: (result as any).count ?? 0 };
}

export async function pgExec(sql: string): Promise<void> {
  const s = getSql();
  await s.unsafe(sql);
}

// ── Transaction support ──

export async function pgBegin<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const s = getSql();
  return s.begin(fn as any) as any;
}

// ── Migration (schema creation) ──

export async function pgMigrate(): Promise<void> {
  // Schema already created by migrate-to-pg.py script
  // This is a no-op safety check
  const s = getSql();
  const tables = await s`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  const tableNames = new Set(tables.map((t: any) => t.tablename));
  if (!tableNames.has('runs')) {
    throw new Error('PostgreSQL setfarm schema not found. Run migration script first.');
  }

  // Wave 14 Bug Q: idempotent ALTER for story scope discipline
  // Each story now carries an explicit scope_files list (JSON array) + optional
  // shared_files list for cross-story collaboration. The post-implementation
  // bleed check rejects stories that modify files outside their declared scope.
  // IF NOT EXISTS keeps this safe across restarts — no-op when already applied.
  try {
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS scope_files TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS shared_files TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS scope_description TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS file_skeletons TEXT`;
    // Developer reservation: one developer per project, locked until run completes
    await s`ALTER TABLE runs ADD COLUMN IF NOT EXISTS assigned_developer TEXT`;
    // Performance indexes for claim queries (6 concurrent projects)
    await s`CREATE INDEX IF NOT EXISTS idx_steps_agent_status ON steps(agent_id, status) WHERE status IN ('pending', 'running')`;
    await s`CREATE INDEX IF NOT EXISTS idx_runs_status_dev ON runs(status, assigned_developer) WHERE status = 'running'`;
  } catch (e) {
    // Migration failures should not prevent gateway start — log but continue.
    // eslint-disable-next-line no-console
    console.warn('[pgMigrate] Wave 14 Bug Q ALTER failed (likely already applied):', String(e).slice(0, 200));
  }
}

// ── Utility functions ──

export async function pgNextRunNumber(): Promise<number> {
  const row = await pgGet<{ next: number }>(
    "SELECT nextval('runs_run_number_seq'::regclass) AS next"
  );
  return row?.next ?? 1;
}

export async function pgCleanupOrphans(): Promise<{ deletedSteps: number; deletedStories: number }> {
  const s = getSql();
  const r1 = await s`DELETE FROM steps WHERE run_id NOT IN (SELECT id FROM runs)`;
  const r2 = await s`DELETE FROM stories WHERE run_id NOT IN (SELECT id FROM runs)`;
  return { deletedSteps: r1.count, deletedStories: r2.count };
}

export async function pgCheckpoint(): Promise<void> {
  // PostgreSQL handles WAL internally, no manual checkpoint needed
}

export async function pgClose(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
  }
}

/** ISO timestamp — single source of truth for all modules */
export const now = (): string => new Date().toISOString();

// P4-05: Graceful shutdown
process.on("SIGTERM", () => { pgClose().catch(() => {}); });
process.on("SIGINT", () => { pgClose().catch(() => {}); });
