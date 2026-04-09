/**
 * Compat Engine (Wave 14)
 *
 * Evaluates declarative package-compatibility rules from compat-rules.json
 * against the project's package.json. Used by the setup-build handler in
 * step-ops.ts to replace Wave 13 Bug O's hard-coded React 19 + testing-library
 * check with a data-driven refactor. Adding a new rule is a JSON-only change.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger.js";

// ── Types ─────────────────────────────────────────────────────────────

export interface CompatConstraint {
  package: string;
  majorEq?: number;
  majorGte?: number;
  majorLte?: number;
}

export interface CompatRule {
  id: string;
  severity: "fail" | "warn";
  step: string;
  when: CompatConstraint;
  requires: CompatConstraint;
  message: string;
}

export interface CompatEvaluation {
  fails: Array<CompatRule & { resolvedMessage: string }>;
  warns: Array<CompatRule & { resolvedMessage: string }>;
}

// ── Rule Loading ──────────────────────────────────────────────────────

let _rulesCache: CompatRule[] | null = null;

function resolveRulesPath(): string {
  // Try multiple candidate paths:
  // - tsc-compiled dist: dist/installer/compat-rules.json
  // - source: src/installer/compat-rules.json
  // We read from the compiled location first, then fall back to src.
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const dir = path.dirname(thisFile);
    const candidates = [
      path.join(dir, "compat-rules.json"),
      path.join(dir, "..", "..", "src", "installer", "compat-rules.json"),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return candidates[0];
  } catch {
    return path.join(process.cwd(), "src", "installer", "compat-rules.json");
  }
}

export function loadCompatRules(): CompatRule[] {
  if (_rulesCache) return _rulesCache;
  try {
    const p = resolveRulesPath();
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);
    const rules = Array.isArray(parsed?.rules) ? (parsed.rules as CompatRule[]) : [];
    _rulesCache = rules;
    return rules;
  } catch (e) {
    logger.warn(`[compat-engine] Failed to load compat-rules.json: ${String(e).slice(0, 200)}`);
    _rulesCache = [];
    return [];
  }
}

// ── Version Parsing ───────────────────────────────────────────────────

/**
 * Extract the major version number from a version string like "^19.2.1",
 * "~18.0.0", "19.0.0", ">=16", "16.3.2-canary.0", etc.
 * Returns 0 if no number is found.
 */
export function majorOf(versionStr: string | undefined | null): number {
  if (!versionStr) return 0;
  const m = versionStr.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

// ── Constraint Evaluation ─────────────────────────────────────────────

function constraintSatisfied(constraint: CompatConstraint, actualVersion: string | undefined): boolean {
  if (!actualVersion) return false;
  const major = majorOf(actualVersion);
  if (constraint.majorEq !== undefined && major !== constraint.majorEq) return false;
  if (constraint.majorGte !== undefined && major < constraint.majorGte) return false;
  if (constraint.majorLte !== undefined && major > constraint.majorLte) return false;
  return true;
}

// ── Rule Evaluation ───────────────────────────────────────────────────

/**
 * Evaluate all compat rules for a given step against a project package.json.
 * Returns buckets of fails and warns with their resolved (interpolated)
 * messages ready to feed into logger.warn / failStep.
 *
 * For each rule:
 *   1. Filter by rule.step matching the supplied stepId
 *   2. If rule.when is satisfied by the project's actual version of when.package,
 *      then rule.requires MUST be satisfied by the actual version of requires.package
 *   3. If requires is NOT satisfied, the rule fires (fails or warns by severity)
 */
export function evaluateCompat(
  pkg: Record<string, any>,
  stepId: string,
): CompatEvaluation {
  const result: CompatEvaluation = { fails: [], warns: [] };
  const rules = loadCompatRules().filter(r => r.step === stepId);
  if (rules.length === 0) return result;

  const allDeps: Record<string, string> = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.peerDependencies || {}),
  };

  for (const rule of rules) {
    const whenVersion = allDeps[rule.when.package];
    if (!whenVersion) continue; // when.package not in project — rule does not apply
    if (!constraintSatisfied(rule.when, whenVersion)) continue;

    const requiresVersion = allDeps[rule.requires.package];
    if (constraintSatisfied(rule.requires, requiresVersion)) continue; // OK

    // Rule fires — interpolate placeholders in the message
    const resolvedMessage = rule.message
      .replace(/\{actual\.when\}/g, whenVersion || "(missing)")
      .replace(/\{actual\.requires\}/g, requiresVersion || "(missing)");
    const enrichedRule = { ...rule, resolvedMessage };
    if (rule.severity === "fail") {
      result.fails.push(enrichedRule);
    } else {
      result.warns.push(enrichedRule);
    }
  }
  return result;
}
