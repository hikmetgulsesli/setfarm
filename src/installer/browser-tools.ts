import os from "node:os";
/**
 * Browser-based DOM verification tools for Setfarm pipeline.
 * Uses agent-browser (headless Chromium) to inspect rendered pages.
 * All functions degrade gracefully — browser checks never block the pipeline.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";

// ── Types ───────────────────────────────────────────────────────────

export interface BrowserCheckIssue {
  rule: string;
  severity: "error" | "warning";
  detail: string;
}

export interface BrowserCheckResult {
  passed: boolean;
  issues: BrowserCheckIssue[];
  domSnapshot?: object;
  warnings: string[];
}

interface DomExtractResult {
  url: string;
  viewport: string;
  totalElements: number;
  navigation: Array<{ label: string; href: string; selector: string }>;
  buttons: Array<{ label: string; hasHandler: boolean; predictedAction: string; selector: string }>;
  inputs: Array<{ label: string; type: string; hasValue: boolean; required: boolean; selector: string }>;
  forms: Array<{ action: string; method: string; fields: number; hasHandler: boolean; selector: string }>;
  deadLinks: Array<{ label: string; href: string; selector: string }>;
  cssVars: Record<string, string>;
  hardcodedData: string[];
}

// ── Constants ───────────────────────────────────────────────────────

const DOM_EXTRACT_SCRIPT = path.join(
  process.env.HOME || os.homedir(),
  ".openclaw/workspace/scripts/headless-dom-extract.js"
);

const FRAMEWORK_PORTS: Record<string, number> = {
  vite: 5173,
  next: 3000,
  "react-scripts": 3000,
  nuxt: 3000,
  astro: 4321,
  remix: 3000,
  gatsby: 8000,
  angular: 4200,
  vue: 5173,
};

// ── Port Detection ──────────────────────────────────────────────────

/**
 * Detect the dev server port for a project by:
 * 1. Reading package.json to determine the framework
 * 2. Checking if a process is listening on the expected port
 */
export function detectDevServerPort(repoPath: string): number | null {
  try {
    const pkgPath = path.join(repoPath, "package.json");
    if (!fs.existsSync(pkgPath)) return null;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Determine expected port from framework
    let expectedPort: number | null = null;
    for (const [fw, port] of Object.entries(FRAMEWORK_PORTS)) {
      if (allDeps[fw]) {
        expectedPort = port;
        break;
      }
    }
    if (!expectedPort) return null;

    // Check if port is actually listening
    try {
      const lsofOutput = execFileSync("lsof", ["-P", "-n", `-iTCP:${expectedPort}`, "-sTCP:LISTEN"], {
        timeout: 5000,
        stdio: "pipe",
      }).toString().trim();

      if (lsofOutput) return expectedPort;
    } catch (e) {
      logger.debug(`[browser-tools] Port ${expectedPort} not listening`, {});
    }

    return null;
  } catch (e) {
    logger.debug(`[browser-tools] Failed to detect dev server port: ${e}`, {});
    return null;
  }
}

// ── Browser Check ───────────────────────────────────────────────────

function isAgentBrowserInstalled(): boolean {
  try {
    execFileSync("which", ["agent-browser"], { timeout: 3000, stdio: "pipe" });
    return true;
  } catch (e) {
    logger.debug(`[browser-tools] agent-browser not installed`, {});
    return false;
  }
}

/**
 * Run a full browser-based DOM check on a running dev server.
 * Gracefully skips if agent-browser is not installed or dev server is not running.
 */
export function runBrowserDomCheck(repoPath: string, sessionName: string): BrowserCheckResult {
  const result: BrowserCheckResult = {
    passed: true,
    issues: [],
    warnings: [],
  };

  // Guard: agent-browser installed?
  if (!isAgentBrowserInstalled()) {
    result.warnings.push("agent-browser not installed — skipping browser check");
    return result;
  }

  // Guard: DOM extract script exists?
  if (!fs.existsSync(DOM_EXTRACT_SCRIPT)) {
    result.warnings.push("headless-dom-extract.js not found — skipping browser check");
    return result;
  }

  // Detect dev server port
  const port = detectDevServerPort(repoPath);
  if (!port) {
    result.warnings.push("No dev server detected — skipping browser check");
    return result;
  }

  const url = `http://localhost:${port}`;

  try {
    // Open page in headless browser
    execFileSync("agent-browser", ["--session", sessionName, "open", url], {
      timeout: 30000,
      stdio: "pipe",
      env: { ...process.env, AGENT_BROWSER_CONTENT_BOUNDARIES: "1" },
    });

    // Wait for page load
    try {
      execFileSync("agent-browser", ["--session", sessionName, "wait", "--load", "networkidle"], {
        timeout: 20000,
        stdio: "pipe",
      });
    } catch (e) {
      logger.debug(`[browser-tools] networkidle timeout, continuing: ${e}`, {});
    }

    // Run DOM extraction
    let domData: DomExtractResult | null = null;
    try {
      const extractScript = fs.readFileSync(DOM_EXTRACT_SCRIPT, "utf-8");
      const evalOutput = execFileSync(
        "agent-browser",
        ["--session", sessionName, "eval", extractScript],
        { timeout: 15000, stdio: "pipe" }
      ).toString().trim();

      // agent-browser eval output may have wrapper text — extract JSON
      const jsonMatch = evalOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (
          typeof parsed === "object" && parsed !== null &&
          typeof parsed.totalElements === "number" &&
          Array.isArray(parsed.deadLinks) &&
          Array.isArray(parsed.buttons) &&
          Array.isArray(parsed.navigation)
        ) {
          domData = parsed as DomExtractResult;
          result.domSnapshot = domData as object;
        } else {
          result.warnings.push("DOM extraction returned unexpected shape");
        }
      }
    } catch (e) {
      result.warnings.push(`DOM extraction failed: ${String(e).slice(0, 200)}`);
    }

    // Run checks on DOM data
    if (domData) {
      analyzeDOM(domData, repoPath, result);
    }
  } catch (e) {
    result.warnings.push(`Browser open failed: ${String(e).slice(0, 200)}`);
  } finally {
    // Always close the browser session
    try {
      execFileSync("agent-browser", ["--session", sessionName, "close"], {
        timeout: 10000,
        stdio: "pipe",
      });
    } catch (e) {
      logger.debug(`[browser-tools] Failed to close browser session: ${e}`, {});
    }
  }

  result.passed = result.issues.filter((i) => i.severity === "error").length === 0;
  return result;
}

// ── DOM Analysis ────────────────────────────────────────────────────

function analyzeDOM(
  dom: DomExtractResult,
  repoPath: string,
  result: BrowserCheckResult
): void {
  // Rule: empty_page — page rendered nothing
  if (dom.totalElements === 0) {
    result.issues.push({
      rule: "empty_page",
      severity: "error",
      detail: "Page rendered 0 elements — likely blank or crash",
    });
    return; // No point checking further
  }

  // Rule: dead_link_in_dom — rendered page has dead links
  if (dom.deadLinks.length > 0) {
    const examples = dom.deadLinks.slice(0, 5).map((l) => `${l.label} (${l.href})`).join(", ");
    result.issues.push({
      rule: "dead_link_in_dom",
      severity: "error",
      detail: `${dom.deadLinks.length} dead link(s) in rendered DOM: ${examples}`,
    });
  }

  // Rule: button_no_handler — buttons without click handlers (ERROR: every button must do something)
  const noHandlerButtons = dom.buttons.filter((b) => !b.hasHandler);
  if (noHandlerButtons.length > 0) {
    const examples = noHandlerButtons.slice(0, 5).map((b) => b.label).join(", ");
    result.issues.push({
      rule: "button_no_handler",
      severity: "error",
      detail: `${noHandlerButtons.length} button(s) without onClick handlers: ${examples}. Every button MUST have an onClick handler — either implement the feature or show a toast/feedback and log it in INCOMPLETE.md.`,
    });
  }

  // Rule: missing_css_var — design tokens not present in DOM
  const designTokensPath = path.join(repoPath, "stitch", "design-tokens.css");
  if (fs.existsSync(designTokensPath)) {
    try {
      const tokenContent = fs.readFileSync(designTokensPath, "utf-8");
      const tokenVars = tokenContent.match(/--[\w-]+/g) || [];
      const keyVars = tokenVars.filter(
        (v) =>
          v.includes("primary") ||
          v.includes("font") ||
          v.includes("accent") ||
          v.includes("background") ||
          v.includes("foreground")
      );

      const missingVars = keyVars.filter((v) => !dom.cssVars[v]);
      if (missingVars.length > 0) {
        result.issues.push({
          rule: "missing_css_var",
          severity: "warning",
          detail: `${missingVars.length} design token(s) not found in rendered CSS: ${missingVars.slice(0, 5).join(", ")}`,
        });
      }
    } catch (e) {
      logger.debug(`[browser-tools] Could not read design tokens: ${e}`, {});
    }
  }

  // Rule: missing_navigation — UI contract has nav links not in DOM
  const contractPath = path.join(repoPath, "stitch", "UI_CONTRACT.json");
  if (fs.existsSync(contractPath)) {
    try {
      const contracts = JSON.parse(fs.readFileSync(contractPath, "utf-8"));
      if (!Array.isArray(contracts)) throw new Error("UI_CONTRACT.json is not an array");
      const contractNavLabels: string[] = [];
      for (const screen of contracts) {
        if (screen.navigation) {
          for (const nav of screen.navigation) {
            contractNavLabels.push(nav.label.toLowerCase());
          }
        }
      }

      if (contractNavLabels.length > 0) {
        const domNavLabels = dom.navigation.map((n) => n.label.toLowerCase());
        const missing = contractNavLabels.filter(
          (label) => !domNavLabels.some((d) => d.includes(label) || label.includes(d))
        );
        if (missing.length > 0) {
          result.issues.push({
            rule: "missing_navigation",
            severity: "warning",
            detail: `${missing.length} nav link(s) from UI contract not found in DOM: ${missing.slice(0, 5).join(", ")}`,
          });
        }
      }
    } catch (e) {
      logger.debug(`[browser-tools] Could not read UI contract: ${e}`, {});
    }
  }

  // Rule: hardcoded_data — placeholder data in rendered page
  if (dom.hardcodedData.length > 0) {
    result.issues.push({
      rule: "hardcoded_data",
      severity: "warning",
      detail: `Hardcoded placeholder data in rendered page: ${dom.hardcodedData.join(", ")}`,
    });
  }
}

// ── Orphaned Browser Cleanup ────────────────────────────────────────

/**
 * Kill orphaned Chromium processes left behind by crashed agent-browser sessions.
 * Returns the number of processes killed.
 */
export function killOrphanedBrowserSessions(): number {
  try {
    // Count matching processes
    let count = 0;
    try {
      const countOutput = execFileSync("pgrep", ["-cf", "chromium.*--remote-debugging"], {
        timeout: 5000,
        stdio: "pipe",
      }).toString().trim();
      count = parseInt(countOutput, 10) || 0;
    } catch (e) {
      logger.debug(`[browser-tools] No orphaned Chromium processes found`, {});
      return 0;
    }

    if (count === 0) return 0;

    // Kill them
    try {
      execFileSync("pkill", ["-f", "chromium.*--remote-debugging"], {
        timeout: 10000,
        stdio: "pipe",
      });
    } catch (e) {
      logger.debug(`[browser-tools] pkill race condition or processes already gone: ${e}`, {});
    }

    logger.info(`[browser-cleanup] Killed ${count} orphaned Chromium process(es)`);
    return count;
  } catch (e) {
    logger.debug(`[browser-tools] killOrphanedBrowserSessions error: ${e}`, {});
    return 0;
  }
}
