import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { pgQuery, pgGet, pgRun, now } from "../db-pg.js";
import { resolveBundledWorkflowsDir } from "../installer/paths.js";
import YAML from "yaml";

import type { RunInfo, StepInfo } from "../installer/status.js";
import { getRunEvents } from "../installer/events.js";
import { getMedicStatus, getRecentMedicChecks } from "../medic/medic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface WorkflowDef {
  id: string;
  name: string;
  steps: Array<{ id: string; agent: string }>;
}

function loadWorkflows(): WorkflowDef[] {
  const dir = resolveBundledWorkflowsDir();
  const results: WorkflowDef[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const ymlPath = path.join(dir, entry.name, "workflow.yml");
      if (!fs.existsSync(ymlPath)) continue;
      const parsed = YAML.parse(fs.readFileSync(ymlPath, "utf-8"));
      results.push({
        id: parsed.id ?? entry.name,
        name: parsed.name ?? entry.name,
        steps: (parsed.steps ?? []).map((s: any) => ({ id: s.id, agent: s.agent })),
      });
    }
  } catch { /* empty */ }
  return results;
}

async function getRuns(workflowId?: string): Promise<Array<RunInfo & { steps: StepInfo[] }>> {
  const runs = workflowId
    ? await pgQuery<RunInfo>("SELECT * FROM runs WHERE workflow_id = $1 ORDER BY created_at DESC", [workflowId])
    : await pgQuery<RunInfo>("SELECT * FROM runs ORDER BY created_at DESC");
  const results: Array<RunInfo & { steps: StepInfo[] }> = [];
  for (const r of runs) {
    const steps = await pgQuery<StepInfo>("SELECT * FROM steps WHERE run_id = $1 ORDER BY step_index ASC", [r.id]);
    results.push({ ...r, steps });
  }
  return results;
}

async function getRunById(id: string): Promise<(RunInfo & { steps: StepInfo[] }) | null> {
  const run = await pgGet<RunInfo>("SELECT * FROM runs WHERE id = $1", [id]);
  if (!run) return null;
  const steps = await pgQuery<StepInfo>("SELECT * FROM steps WHERE run_id = $1 ORDER BY step_index ASC", [run.id]);
  return { ...run, steps };
}

function json(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

function serveHTML(res: http.ServerResponse) {
  const htmlPath = path.join(__dirname, "index.html");
  const srcHtmlPath = path.resolve(__dirname, "..", "..", "src", "server", "index.html");
  const filePath = fs.existsSync(htmlPath) ? htmlPath : srcHtmlPath;
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(fs.readFileSync(filePath, "utf-8"));
}

// ── Scrape ──────────────────────────────────────────────────────
const SCRAPE_PYTHON = path.join(process.env.HOME ?? os.homedir(), "libs", "scrapling", ".venv", "bin", "python");
const SCRAPE_SCRIPT = path.join(process.env.HOME ?? os.homedir(), "libs", "scrapling", "scrape-api.py");
const SCRAPE_CWD = path.join(process.env.HOME ?? os.homedir(), "libs", "scrapling");

interface ScrapeHistoryEntry {
  url: string;
  adaptor: string;
  status: "success" | "error";
  elapsed: number;
  timestamp: string;
  preview?: string;
}

const scrapeHistory: ScrapeHistoryEntry[] = [];
const SCRAPE_HISTORY_MAX = 50;

const SCRAPE_ADAPTORS = [
  { id: "auto", name: "Auto Detect" },
  { id: "amazon", name: "Amazon" },
  { id: "linkedin", name: "LinkedIn" },
  { id: "twitter", name: "Twitter/X" },
  { id: "generic", name: "Generic" },
];

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function runScrape(input: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      SCRAPE_PYTHON,
      [SCRAPE_SCRIPT],
      {
        cwd: SCRAPE_CWD,
        env: { ...process.env, PYTHONPATH: SCRAPE_CWD },
        timeout: 30_000,
        maxBuffer: 5 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (err) {
          if (stdout) return resolve({ stdout, stderr });
          return reject(err);
        }
        resolve({ stdout, stderr });
      },
    );
    child.stdin?.write(input);
    child.stdin?.end();
  });
}

// ── Rules ───────────────────────────────────────────────────────

interface ParsedRule {
  id: string;
  title: string;
  content: string;
  category: string;
  project_type: string;
  source: "fragment" | "reference";
  source_file: string;
  severity: string;
  applies_to: string;
  enabled: boolean;
  readonly: true;
}

const FRAGMENT_CATEGORY_MAP: Record<string, { category: string; applies_to: string }> = {
  "implement": { category: "implementation", applies_to: "implement" },
  "verify": { category: "verification", applies_to: "verify" },
  "setup": { category: "setup", applies_to: "setup" },
  "lint": { category: "lint", applies_to: "implement" },
  "browser": { category: "verification", applies_to: "verify" },
  "story": { category: "pipeline", applies_to: "implement" },
  "critical": { category: "general", applies_to: "all" },
  "final": { category: "pipeline", applies_to: "verify" },
  "db": { category: "setup", applies_to: "setup" },
};

const REFERENCE_MAP: Record<string, { category: string; project_type: string }> = {
  "design-standards.md": { category: "design", project_type: "general" },
  "design-checklist.md": { category: "design", project_type: "general" },
  "react-best-practices.md": { category: "implementation", project_type: "react" },
  "next-best-practices.md": { category: "implementation", project_type: "nextjs" },
  "backend-standards.md": { category: "implementation", project_type: "general" },
  "web-design-guidelines.md": { category: "design", project_type: "general" },
  "web-guidelines.md": { category: "design", project_type: "general" },
};

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.md$/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseSystemRules(): ParsedRule[] {
  const rules: ParsedRule[] = [];
  const wfDir = resolveBundledWorkflowsDir();

  // Scan top-level _fragments directory
  const fragDir = path.join(wfDir, "_fragments");
  try {
    if (fs.existsSync(fragDir)) {
      for (const f of fs.readdirSync(fragDir)) {
        if (!f.endsWith(".md")) continue;
        const content = fs.readFileSync(path.join(fragDir, f), "utf-8");
        const prefix = f.split("-")[0];
        const mapping = FRAGMENT_CATEGORY_MAP[prefix] ?? { category: "general", applies_to: "all" };
        rules.push({
          id: `frag-${f.replace(/\.md$/, "")}`,
          title: titleFromFilename(f),
          content,
          category: mapping.category,
          project_type: "general",
          source: "fragment",
          source_file: f,
          severity: "mandatory",
          applies_to: mapping.applies_to,
          enabled: true,
          readonly: true,
        });
      }
    }
  } catch { /* empty */ }

  // References
  const refsDir = path.resolve(wfDir, "..", "references");
  try {
    for (const f of fs.readdirSync(refsDir)) {
      if (!f.endsWith(".md")) continue;
      const content = fs.readFileSync(path.join(refsDir, f), "utf-8");
      const mapping = REFERENCE_MAP[f] ?? { category: "general", project_type: "general" };
      rules.push({
        id: `ref-${f.replace(/\.md$/, "")}`,
        title: titleFromFilename(f),
        content,
        category: mapping.category,
        project_type: mapping.project_type,
        source: "reference",
        source_file: f,
        severity: "advisory",
        applies_to: "all",
        enabled: true,
        readonly: true,
      });
    }
  } catch { /* empty */ }

  return rules;
}

async function getCustomRules(): Promise<any[]> {
  return await pgQuery("SELECT * FROM rules ORDER BY sort_order ASC, created_at ASC");
}

async function getAllRules(query: URLSearchParams): Promise<any[]> {
  const systemRules = parseSystemRules();
  const customRules = (await getCustomRules()).map((r: any) => ({
    ...r,
    enabled: !!r.enabled,
    readonly: false,
  }));

  let all = [...systemRules, ...customRules];

  const category = query.get("category");
  const projectType = query.get("project_type");
  const source = query.get("source");
  const search = query.get("search")?.toLowerCase();

  if (category) all = all.filter((r) => r.category === category);
  if (projectType) all = all.filter((r) => r.project_type === projectType);
  if (source === "system") all = all.filter((r) => r.readonly);
  else if (source === "custom") all = all.filter((r) => !r.readonly);
  if (search) all = all.filter((r) => r.title.toLowerCase().includes(search) || r.content.toLowerCase().includes(search));

  return all;
}

export function startDashboard(port = 3333): http.Server {
  const server = http.createServer(async (req, res) => {
   try {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const p = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      return res.end();
    }

    // ── Scrape API ──
    if (p === "/api/scrape" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const parsed = JSON.parse(body);
        if (!parsed.url || typeof parsed.url !== "string") {
          return json(res, { success: false, error: "URL is required" }, 400);
        }
        const input = JSON.stringify({
          url: parsed.url,
          adaptor: parsed.adaptor ?? "auto",
          selector: parsed.selector ?? "",
          format: parsed.format ?? "json",
        });
        const { stdout } = await runScrape(input);
        const result = JSON.parse(stdout);

        const entry: ScrapeHistoryEntry = {
          url: parsed.url,
          adaptor: parsed.adaptor ?? "auto",
          status: result.success ? "success" : "error",
          elapsed: result.metadata?.elapsed_seconds ?? 0,
          timestamp: now(),
          preview: result.success
            ? (result.data?.title || result.data?.product?.title || parsed.url).slice(0, 80)
            : (result.error || "Unknown error").slice(0, 80),
        };
        scrapeHistory.unshift(entry);
        if (scrapeHistory.length > SCRAPE_HISTORY_MAX) scrapeHistory.length = SCRAPE_HISTORY_MAX;

        return json(res, result);
      } catch (e: any) {
        return json(res, { success: false, error: e.message ?? "Scrape failed" }, 500);
      }
    }

    if (p === "/api/scrape/adaptors") {
      return json(res, SCRAPE_ADAPTORS);
    }

    if (p === "/api/scrape/history") {
      return json(res, scrapeHistory);
    }

    // ── Rules API ──
    if (p === "/api/rules" && req.method === "GET") {
      return json(res, await getAllRules(url.searchParams));
    }

    if (p === "/api/rules" && req.method === "POST") {
      try {
        const body = JSON.parse(await readBody(req));
        const ts = now();
        const id = crypto.randomUUID();
        await pgRun(
          "INSERT INTO rules (id, title, content, category, project_type, severity, applies_to, enabled, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 0, $8, $9)",
          [id, body.title, body.content, body.category ?? "general", body.project_type ?? "general", body.severity ?? "mandatory", body.applies_to ?? "implement", ts, ts]
        );
        return json(res, { id }, 201);
      } catch (e: any) {
        return json(res, { error: e.message }, 400);
      }
    }

    if (p === "/api/rules/export" && req.method === "GET") {
      const rules = await getAllRules(new URLSearchParams());
      const payload = JSON.stringify({ version: 1, exportedAt: now(), rules }, null, 2);
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="setfarm-rules.json"',
        "Access-Control-Allow-Origin": "*",
      });
      return res.end(payload);
    }

    if (p === "/api/rules/import" && req.method === "POST") {
      try {
        const body = JSON.parse(await readBody(req));
        const items = body.rules ?? [];
        const ts = now();
        let imported = 0, updated = 0, skipped = 0;
        for (const r of items) {
          if (r.readonly || r.source === "fragment" || r.source === "reference") { skipped++; continue; }
          const existing = await pgGet<any>("SELECT id FROM rules WHERE title = $1", [r.title]);
          if (existing) {
            await pgRun(
              "UPDATE rules SET content = $1, category = $2, project_type = $3, severity = $4, applies_to = $5, enabled = $6, updated_at = $7 WHERE id = $8",
              [r.content, r.category ?? "general", r.project_type ?? "general", r.severity ?? "mandatory", r.applies_to ?? "implement", r.enabled === false ? 0 : 1, ts, existing.id]
            );
            updated++;
          } else {
            const id = crypto.randomUUID();
            await pgRun(
              "INSERT INTO rules (id, title, content, category, project_type, severity, applies_to, enabled, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10)",
              [id, r.title, r.content, r.category ?? "general", r.project_type ?? "general", r.severity ?? "mandatory", r.applies_to ?? "implement", r.enabled === false ? 0 : 1, ts, ts]
            );
            imported++;
          }
        }
        return json(res, { imported, updated, skipped });
      } catch (e: any) {
        return json(res, { error: e.message }, 400);
      }
    }

    const ruleToggleMatch = p.match(/^\/api\/rules\/([^/]+)\/toggle$/);
    if (ruleToggleMatch && req.method === "PUT") {
      const id = ruleToggleMatch[1];
      if (id.startsWith("frag-") || id.startsWith("ref-")) return json(res, { error: "Cannot toggle system rules" }, 403);
      const ts = now();
      await pgRun("UPDATE rules SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END, updated_at = $1 WHERE id = $2", [ts, id]);
      return json(res, { ok: true });
    }

    const ruleMatch = p.match(/^\/api\/rules\/([^/]+)$/);
    if (ruleMatch && req.method === "PUT") {
      const id = ruleMatch[1];
      if (id.startsWith("frag-") || id.startsWith("ref-")) return json(res, { error: "Cannot edit system rules" }, 403);
      try {
        const body = JSON.parse(await readBody(req));
        const ts = now();
        await pgRun(
          "UPDATE rules SET title = $1, content = $2, category = $3, project_type = $4, severity = $5, applies_to = $6, enabled = $7, updated_at = $8 WHERE id = $9",
          [body.title, body.content, body.category ?? "general", body.project_type ?? "general", body.severity ?? "mandatory", body.applies_to ?? "implement", body.enabled === false ? 0 : 1, ts, id]
        );
        return json(res, { ok: true });
      } catch (e: any) {
        return json(res, { error: e.message }, 400);
      }
    }

    if (ruleMatch && req.method === "DELETE") {
      const id = ruleMatch[1];
      if (id.startsWith("frag-") || id.startsWith("ref-")) return json(res, { error: "Cannot delete system rules" }, 403);
      await pgRun("DELETE FROM rules WHERE id = $1", [id]);
      return json(res, { ok: true });
    }

    // ── Existing API routes ──
    if (p === "/api/workflows") {
      return json(res, loadWorkflows());
    }

    const eventsMatch = p.match(/^\/api\/runs\/([^/]+)\/events$/);
    if (eventsMatch) {
      return json(res, getRunEvents(eventsMatch[1]));
    }

    const storiesMatch = p.match(/^\/api\/runs\/([^/]+)\/stories$/);
    if (storiesMatch) {
      const stories = await pgQuery(
        "SELECT * FROM stories WHERE run_id = $1 ORDER BY story_index ASC",
        [storiesMatch[1]]
      );
      return json(res, stories);
    }

    const runMatch = p.match(/^\/api\/runs\/(.+)$/);
    if (runMatch) {
      const run = await getRunById(runMatch[1]);
      return run ? json(res, run) : json(res, { error: "not found" }, 404);
    }

    if (p === "/api/runs") {
      const wf = url.searchParams.get("workflow") ?? undefined;
      return json(res, await getRuns(wf));
    }

    // Medic API
    if (p === "/api/medic/status") {
      return json(res, getMedicStatus());
    }

    if (p === "/api/medic/checks") {
      const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
      return json(res, getRecentMedicChecks(limit));
    }

    // Serve fonts
    if (p.startsWith("/fonts/")) {
      const fontName = path.basename(p);
      const fontPath = path.resolve(__dirname, "..", "..", "assets", "fonts", fontName);
      const srcFontPath = path.resolve(__dirname, "..", "..", "src", "..", "assets", "fonts", fontName);
      const resolvedFont = fs.existsSync(fontPath) ? fontPath : srcFontPath;
      if (fs.existsSync(resolvedFont)) {
        res.writeHead(200, { "Content-Type": "font/woff2", "Cache-Control": "public, max-age=31536000", "Access-Control-Allow-Origin": "*" });
        return res.end(fs.readFileSync(resolvedFont));
      }
    }

    // Serve logo
    if (p === "/logo.jpeg") {
      const logoPath = path.resolve(__dirname, "..", "..", "assets", "logo.jpeg");
      const srcLogoPath = path.resolve(__dirname, "..", "..", "src", "..", "assets", "logo.jpeg");
      const resolvedLogo = fs.existsSync(logoPath) ? logoPath : srcLogoPath;
      if (fs.existsSync(resolvedLogo)) {
        res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" });
        return res.end(fs.readFileSync(resolvedLogo));
      }
    }

    // Serve frontend
    serveHTML(res);
   } catch (e: any) {
    console.error("Request error:", e.message);
    if (!res.headersSent) json(res, { error: "Internal server error" }, 500);
   }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Setfarm Dashboard: http://localhost:${port}`);
  });

  return server;
}
