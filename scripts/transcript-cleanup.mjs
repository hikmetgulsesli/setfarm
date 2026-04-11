#!/usr/bin/env node
/**
 * Transcript cleanup (cuddly-sleeping-quail plan).
 *
 * Agent session transcripts accumulate in ~/.openclaw/workspace/transcripts/.
 * Each story run produces 1-N .log files. This script deletes transcripts
 * older than TRANSCRIPT_RETENTION_DAYS (default: 30).
 *
 * Run from cron (user crontab) every 24h:
 *   0 4 * * * node ~/.openclaw/setfarm-repo/scripts/transcript-cleanup.mjs
 */
import { readdirSync, statSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.env.SETFARM_TRANSCRIPT_ROOT ||
  path.join(os.homedir(), ".openclaw", "workspace", "transcripts");
const RETENTION_DAYS = parseInt(process.env.TRANSCRIPT_RETENTION_DAYS || "30", 10);
const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return { deleted: 0, kept: 0 }; }
  let deleted = 0, kept = 0;
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const sub = walk(full);
      deleted += sub.deleted; kept += sub.kept;
      try {
        const remaining = readdirSync(full);
        if (remaining.length === 0) rmSync(full, { recursive: false });
      } catch {}
      continue;
    }
    try {
      const st = statSync(full);
      if (st.mtimeMs < cutoff) { rmSync(full); deleted++; }
      else kept++;
    } catch {}
  }
  return { deleted, kept };
}

const result = walk(ROOT);
console.log("[transcript-cleanup] deleted=" + result.deleted + " kept=" + result.kept + " retention=" + RETENTION_DAYS + "d root=" + ROOT);
