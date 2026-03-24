import { execFileSync } from "node:child_process";
import { logger } from "../lib/logger.js";
import fs from "node:fs";
import path from "node:path";

export interface QualityIssue {
  rule: string;
  severity: "error" | "warning";
  detail: string;
  matches: string[];
}

/**
 * Run server-side quality checks on a project repo.
 * These checks do NOT trust the agent — step-ops.ts runs them directly.
 */
export function runQualityChecks(repoPath: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Only run on projects with src/ directory (frontend projects)
  try {
    execFileSync("test", ["-d", `${repoPath}/src`], { timeout: 5000 });
  } catch {
    return []; // No src/ — skip (backend-only or non-standard layout)
  }

  // --- DEAD LINK CHECKS ---
  const deadLinkPatterns = [
    { pattern: 'href="#"', rule: "dead_link_hash" },
    { pattern: 'href="javascript:', rule: "dead_link_javascript" },
  ];

  for (const { pattern, rule } of deadLinkPatterns) {
    try {
      const result = execFileSync("grep", [
        "-rn", pattern,
        "--include=*.tsx", "--include=*.ts", "--include=*.jsx", "--include=*.js",
        `${repoPath}/src/`
      ], { timeout: 10000, stdio: "pipe" }).toString().trim();

      if (result) {
        const matches = result.split("\n").filter(l =>
          !l.includes("__tests__") && !l.includes(".test.") && !l.includes(".spec.")
        );
        if (matches.length > 0) {
          issues.push({
            rule,
            severity: "warning", // Fix 4: downgraded from error — advisory only
            detail: `Found ${matches.length} dead link(s): ${pattern}`,
            matches: matches.slice(0, 10),
          });
        }
      }
    } catch { /* grep exit 1 = no match = OK */ }
  }

  // --- EMPTY HANDLER CHECKS ---
  const emptyHandlerPatterns = [
    { pattern: "onClick={() => {}}", rule: "empty_onclick" },
    { pattern: "onClick={() => null}", rule: "empty_onclick_null" },
    { pattern: "onChange={() => {}}", rule: "empty_onchange" },
  ];

  for (const { pattern, rule } of emptyHandlerPatterns) {
    try {
      const result = execFileSync("grep", [
        "-rn", pattern,
        "--include=*.tsx", "--include=*.ts",
        `${repoPath}/src/`
      ], { timeout: 10000, stdio: "pipe" }).toString().trim();

      if (result) {
        const matches = result.split("\n").filter(l =>
          !l.includes("__tests__") && !l.includes(".test.")
        );
        if (matches.length > 0) {
          issues.push({
            rule,
            severity: "warning", // Fix 4: downgraded from error — advisory only
            detail: `Found ${matches.length} empty handler(s): ${pattern}`,
            matches: matches.slice(0, 10),
          });
        }
      }
    } catch { /* grep exit 1 = no match = OK */ }
  }

  // --- PLACEHOLDER TEXT CHECKS ---
  try {
    const result = execFileSync("grep", [
      "-rniE", "coming soon|TODO.*implement|work in progress|lorem ipsum",
      "--include=*.tsx", "--include=*.ts",
      `${repoPath}/src/`
    ], { timeout: 10000, stdio: "pipe" }).toString().trim();

    if (result) {
      const matches = result.split("\n").filter(l =>
        !l.includes("__tests__") && !l.includes(".test.") && !l.includes("// ") && !l.includes("placeholder=")
      );
      if (matches.length > 0) {
        issues.push({
          rule: "placeholder_text",
          severity: "warning",
          detail: `Found ${matches.length} placeholder text(s) in UI`,
          matches: matches.slice(0, 10),
        });
      }
    }
  } catch { /* no match = OK */ }


  // --- DESIGN CONTRACT CHECKS (Faz 1) ---

  // Check: UI_CONTRACT.json requiresRouter but no react-router in package.json
  const contractPath = path.join(repoPath, "stitch", "UI_CONTRACT.json");
  const pkgPath = path.join(repoPath, "package.json");
  if (fs.existsSync(contractPath) && fs.existsSync(pkgPath)) {
    try {
      const contracts = JSON.parse(fs.readFileSync(contractPath, "utf-8"));
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      const needsRouter = contracts.some((c: any) => c.requiresRouter);
      if (needsRouter && !allDeps["react-router-dom"] && !allDeps["react-router"] && !allDeps["next"]) {
        issues.push({
          rule: "missing_router",
          severity: "warning", // Fix 4: downgraded — agent can install during implement
          detail: "UI contract requires routing but no router library found in package.json",
          matches: ["Install react-router-dom or next"],
        });
      }

      const needsDnD = contracts.some((c: any) => c.requiresDragDrop);
      if (needsDnD && !allDeps["@dnd-kit/core"] && !allDeps["react-beautiful-dnd"] && !allDeps["@hello-pangea/dnd"]) {
        issues.push({
          rule: "missing_dnd",
          severity: "warning", // Fix 4: downgraded — agent can install during implement
          detail: "UI contract requires drag-and-drop but no DnD library found in package.json",
          matches: ["Install @dnd-kit/core or react-beautiful-dnd"],
        });
      }
    } catch { /* contract/package.json parse failure — non-fatal */ }
  }

  // --- HARDCODED USER DATA CHECK ---
  const fakeNames = ["Alex Morgan", "John Doe", "Jane Doe", "Jane Smith", "John Smith", "Bob Smith", "Alice Johnson"];
  for (const name of fakeNames) {
    try {
      const result = execFileSync("grep", [
        "-rn", name,
        "--include=*.tsx", "--include=*.ts", "--include=*.jsx", "--include=*.js",
        `${repoPath}/src/`
      ], { timeout: 10000, stdio: "pipe" }).toString().trim();

      if (result) {
        const matches = result.split("\n").filter((l: string) =>
          !l.includes("__tests__") && !l.includes(".test.") && !l.includes(".spec.") && !l.includes("// ")
          && !l.includes("fixture") && !l.includes("mock") && !l.includes("__mocks__")
          && !l.includes("seed") && !l.includes(".stories.") && !l.includes("storybook")
        );
        if (matches.length > 0) {
          issues.push({
            rule: "hardcoded_user_data",
            severity: "warning",
            detail: `Found hardcoded fake name: ${name}`,
            matches: matches.slice(0, 5),
          });
          break; // One match is enough to flag
        }
      }
    } catch { /* no match = OK */ }
  }

  // --- BUTTON HANDLER MISMATCH CHECK ---
  try {
    let buttonCount = 0;
    let submitCount = 0;
    let onClickCount = 0;
    try {
      const btnResult = execFileSync("grep", [
        "-rc", "<button", "--include=*.tsx", "--include=*.jsx",
        `${repoPath}/src/`
      ], { timeout: 10000, stdio: "pipe" }).toString().trim();
      buttonCount = btnResult.split("\n").reduce((sum: number, line: string) => {
        const parts = line.split(":");
        return sum + (parseInt(parts[parts.length - 1], 10) || 0);
      }, 0);
    } catch { /* grep exit 1 = no match */ }
    // Subtract type="submit" buttons — they use form onSubmit, not onClick
    try {
      const submitResult = execFileSync("grep", [
        "-rc", "type=\"submit\"", "--include=*.tsx", "--include=*.jsx",
        `${repoPath}/src/`
      ], { timeout: 10000, stdio: "pipe" }).toString().trim();
      submitCount = submitResult.split("\n").reduce((sum: number, line: string) => {
        const parts = line.split(":");
        return sum + (parseInt(parts[parts.length - 1], 10) || 0);
      }, 0);
    } catch { /* grep exit 1 = no match */ }
    const actionButtonCount = Math.max(0, buttonCount - submitCount);
    try {
      const clickResult = execFileSync("grep", [
        "-rc", "onClick", "--include=*.tsx", "--include=*.jsx",
        `${repoPath}/src/`
      ], { timeout: 10000, stdio: "pipe" }).toString().trim();
      onClickCount = clickResult.split("\n").reduce((sum: number, line: string) => {
        const parts = line.split(":");
        return sum + (parseInt(parts[parts.length - 1], 10) || 0);
      }, 0);
    } catch { /* grep exit 1 = no match */ }
    if (actionButtonCount > 0 && onClickCount > 0) {
      const ratio = onClickCount / actionButtonCount;
      if (ratio < 0.7) {
        issues.push({
          rule: "button_handler_mismatch",
          severity: "warning",
          detail: `${actionButtonCount} action <button> elements (${submitCount} submit excluded) but only ${onClickCount} onClick handlers (${Math.round(ratio * 100)}% coverage)`,
          matches: [],
        });
      }
    }
  } catch { /* button handler check — non-fatal */ }
  return issues;
}

/**
 * Format quality issues into a human-readable report string.
 */
export function formatQualityReport(issues: QualityIssue[]): string {
  if (issues.length === 0) return "";

  const errors = issues.filter(i => i.severity === "error");
  const warnings = issues.filter(i => i.severity === "warning");

  let report = `QUALITY GATE: ${errors.length} error(s), ${warnings.length} warning(s)\n`;
  for (const issue of issues) {
    report += `  [${issue.severity.toUpperCase()}] ${issue.rule}: ${issue.detail}\n`;
    for (const m of issue.matches.slice(0, 3)) {
      report += `    → ${m}\n`;
    }
  }
  return report;
}
