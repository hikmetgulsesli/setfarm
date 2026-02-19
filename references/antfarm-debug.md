# Antfarm Pipeline Debug Skill

Debugging and fixing Antfarm CI/CD pipeline issues.

## CRITICAL: node:sqlite API (NOT better-sqlite3!)

Antfarm uses Node.js 22 built-in `node:sqlite` (DatabaseSync), NOT `better-sqlite3`.

### API Differences

| Operation | better-sqlite3 (WRONG) | node:sqlite (CORRECT) |
|---|---|---|
| PRAGMA | `db.pragma("busy_timeout = 5000")` | `db.exec_stmt("PRAGMA busy_timeout = 5000")` |
| Begin transaction | `const txn = db.transaction(fn)` | `db.exec_stmt("BEGIN IMMEDIATE")` |
| Commit | (auto on return) | `db.exec_stmt("COMMIT")` |
| Rollback | (auto on throw) | `db.exec_stmt("ROLLBACK")` |

Note: `exec_stmt` above refers to the `db.exec()` method of DatabaseSync.

### Transaction Pattern (node:sqlite)

```javascript
// Set busy timeout
db.exec("PRAGMA busy_timeout = 5000");
// Begin immediate transaction
db.exec("BEGIN IMMEDIATE");
try {
    // ... queries using db.prepare(...).get/all/run() ...
    db.exec("COMMIT");
} catch (e) {
    try { db.exec("ROLLBACK"); } catch (_) {}
    throw e;
}
```

## Pipeline Architecture

```
plan -> setup -> implement (story loop) -> verify -> test -> pr -> review -> external-review -> merge
```

- `implement` step is a **loop** over stories with `verify_each: true`
- Each story gets: implement then verify cycle
- Fresh Claude Code session per story (`fresh_session: true`)

## Common Issues and Fixes

### 1. db.pragma is not a function
**Cause:** Code uses better-sqlite3 API but runtime is node:sqlite
**Fix:** Run `~/.openclaw/scripts/fix-pipeline-v2.py`
**Location:** `dist/installer/step-ops.js` (both workspace and antfarm-repo)

### 2. Pipeline step stuck at "waiting"
**Cause:** advancePipeline crashed before setting next step to "pending"
**Fix:** Manually set the stuck step to pending:
```javascript
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.HOME + '/.openclaw/antfarm/antfarm.db');
db.prepare("UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE run_id = ? AND step_id = ? AND status = 'waiting'").run(runId, stepId);
```

### 3. TOCTOU Race Condition
**Cause:** Multiple cron processes call advancePipeline simultaneously
**Fix:** `BEGIN IMMEDIATE` transaction (already in fix-pipeline-v2.py)

### 4. Stories not created (0 stories despite plan)
**Cause:** Planner creates story plan in output but stories not inserted into DB
**Symptom:** Implement step runs without story loop, completes immediately
**Debug:** Check stories table for the run ID

### 5. SQL quoting error
**Cause:** node:sqlite treats double-quoted strings as column names
**Fix:** Always use single quotes for string literals in SQL

## Database Schema

### runs table
- id (TEXT), workflow_id (TEXT), task (TEXT), status (TEXT), context (TEXT)
- created_at (TEXT), updated_at (TEXT), notify_url (TEXT), run_number (INTEGER)

### steps table
- id (TEXT), run_id (TEXT), step_id (TEXT), agent_id (TEXT), step_index (INTEGER)
- input_template (TEXT), expects (TEXT), status (TEXT), output (TEXT)
- retry_count (INTEGER), max_retries (INTEGER), type (TEXT), loop_config (TEXT)
- current_story_id (TEXT), abandoned_count (INTEGER)

### stories table
- id (TEXT), run_id (TEXT), title (TEXT), status (TEXT), story_index (INTEGER)

## Monitoring

```javascript
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.HOME + '/.openclaw/antfarm/antfarm.db');

// Check all runs
db.prepare("SELECT id, status, task FROM runs ORDER BY created_at DESC").all();

// Check step progress for a run
db.prepare("SELECT step_id, status FROM steps WHERE run_id = ? ORDER BY step_index").all(runId);

// Check story progress
db.prepare("SELECT id, title, status FROM stories WHERE run_id = ? ORDER BY story_index").all(runId);
```

## Fix Script Locations

- `~/.openclaw/scripts/fix-pipeline-v2.py` - Fix advancePipeline node:sqlite API
- `~/.openclaw/scripts/antfarm-update.sh` - Apply all patches (9 patches + build)

## Three Deployment Locations

1. `~/.openclaw/antfarm-repo/dist/` - Build output (source of truth after build)
2. `~/.openclaw/workspace/antfarm/dist/` - RUNTIME (what actually runs)
3. `~/.openclaw/antfarm/` - Installed workflows, DB, dashboard

Fix must be applied to BOTH location 1 and 2 for persistence.
