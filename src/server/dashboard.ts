import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { getDb } from "../db.js";
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

function getRuns(workflowId?: string): Array<RunInfo & { steps: StepInfo[] }> {
  const db = getDb();
  const runs = workflowId
    ? db.prepare("SELECT * FROM runs WHERE workflow_id = ? ORDER BY created_at DESC").all(workflowId) as RunInfo[]
    : db.prepare("SELECT * FROM runs ORDER BY created_at DESC").all() as RunInfo[];
  return runs.map((r) => {
    const steps = db.prepare("SELECT * FROM steps WHERE run_id = ? ORDER BY step_index ASC").all(r.id) as StepInfo[];
    return { ...r, steps };
  });
}

function getRunById(id: string): (RunInfo & { steps: StepInfo[] }) | null {
  const db = getDb();
  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunInfo | undefined;
  if (!run) return null;
  const steps = db.prepare("SELECT * FROM steps WHERE run_id = ? ORDER BY step_index ASC").all(run.id) as StepInfo[];
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
const SCRAPE_PYTHON = path.join(process.env.HOME ?? "/home/setrox", "libs", "scrapling", ".venv", "bin", "python");
const SCRAPE_SCRIPT = path.join(process.env.HOME ?? "/home/setrox", "libs", "scrapling", "scrape-api.py");
const SCRAPE_CWD = path.join(process.env.HOME ?? "/home/setrox", "libs", "scrapling");

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

export function startDashboard(port = 3333): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const p = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
          timestamp: new Date().toISOString(),
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
      const db = getDb();
      const stories = db.prepare(
        "SELECT * FROM stories WHERE run_id = ? ORDER BY story_index ASC"
      ).all(storiesMatch[1]);
      return json(res, stories);
    }

    const runMatch = p.match(/^\/api\/runs\/(.+)$/);
    if (runMatch) {
      const run = getRunById(runMatch[1]);
      return run ? json(res, run) : json(res, { error: "not found" }, 404);
    }

    if (p === "/api/runs") {
      const wf = url.searchParams.get("workflow") ?? undefined;
      return json(res, getRuns(wf));
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
  });

  server.listen(port, () => {
    console.log(`Setfarm Dashboard: http://localhost:${port}`);
  });

  return server;
}
