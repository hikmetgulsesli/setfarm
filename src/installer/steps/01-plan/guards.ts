import type { ParsedOutput, ValidationResult, CompleteContext } from "../types.js";
import { resolveRuntimeIdentity, slugifyIdentity } from "../../runtime-identity.js";

const VALID_TECH_STACKS = new Set([
  "vite-react",
  "nextjs",
  "vanilla-ts",
  "node-express",
  "react-native",
]);

const VALID_PLATFORMS = new Set(["web", "mobile", "desktop", "api", "cli", "game"]);
const VALID_DB_REQUIRED = new Set(["none", "postgres", "sqlite"]);
const VALID_UI_LANGUAGES = new Set(["english", "turkish"]);
const VALID_BOOLEAN = new Set(["true", "false"]);
const MIN_PRD_LENGTH = 2000;

const REQUIRED_PRD_SECTIONS = [
  "Context And Goals",
  "Data And State Contract",
  "Behavioral And Action Contract",
  "Product Surfaces",
  "Validation And Error Strategy",
  "System Contracts",
  "Platform Contract",
  "Testability Contract",
  "Out Of Scope",
];

function boolValue(value: string): boolean {
  return String(value || "").trim().toLowerCase() === "true";
}

function hasSection(prd: string, section: string): boolean {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##+\\s+(?:\\d+\\.\\s*)?${escaped}\\b`, "im").test(prd);
}

function countContractBlocks(prd: string, pattern: RegExp): number {
  return (prd.match(pattern) || []).length;
}

function definedActionIds(prd: string): Set<string> {
  const ids = new Set<string>();
  for (const match of prd.matchAll(/^#{3,6}\s+ACTION:\s*(ACT_[A-Z0-9_]+)\b/gim)) {
    ids.add(match[1]);
  }
  for (const match of prd.matchAll(/^\s*(?:[-*]\s*)?`?ACTION_ID`?\s*:\s*`?(ACT_[A-Z0-9_]+)\b/gim)) {
    ids.add(match[1]);
  }
  return ids;
}

function permittedActionIds(prd: string): Set<string> {
  const ids = new Set<string>();
  for (const match of prd.matchAll(/^\s*[-*]\s*Permitted Actions:\s*(.+)$/gim)) {
    for (const action of match[1].matchAll(/\bACT_[A-Z0-9_]+\b/g)) {
      ids.add(action[0]);
    }
  }
  return ids;
}

function hasRuntimeLeak(parsed: ParsedOutput, prd: string): string[] {
  const errors: string[] = [];
  const forbiddenKeys = ["repo", "branch", "github_repo", "run_slug", "package_name", "app_title", "prd_screen_count"];
  for (const key of forbiddenKeys) {
    if (String(parsed[key] || "").trim()) {
      errors.push(`${key.toUpperCase()} is runtime-owned and must not be emitted by PLAN`);
    }
  }
  if (/^##+\s+(?:\d+\.\s*)?Screens\b/im.test(prd) || /\|\s*#\s*\|\s*Screen/i.test(prd)) {
    errors.push("PRD must not include a physical Screens table; use Product Surfaces only");
  }
  if (/\b(?:\/Users\/|\/home\/|\\Users\\|\$HOME\/|~\/|github\.com\/|feature-[-a-z0-9]+)/i.test(prd)) {
    errors.push("PRD must not include repo paths, local directories, GitHub URLs, or branch names");
  }
  return errors;
}

export function normalize(parsed: ParsedOutput): void {
  if (parsed.project_slug) parsed.project_slug = slugifyIdentity(parsed.project_slug);
  if (parsed.tech_stack) parsed.tech_stack = parsed.tech_stack.toLowerCase().trim();
  if (parsed.platform) parsed.platform = parsed.platform.toLowerCase().trim();
  if (parsed.db_required) parsed.db_required = parsed.db_required.toLowerCase().trim();
  if (parsed.design_required) parsed.design_required = parsed.design_required.toLowerCase().trim();
}

export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const errors: string[] = [];

  if ((parsed.status || "").toLowerCase() !== "done") {
    errors.push(`STATUS must be 'done' (got: '${parsed.status || ""}')`);
  }

  const projectName = String(parsed.project_name || "").trim();
  if (!projectName || projectName.length > 80) {
    errors.push(`PROJECT_NAME must be non-empty and <=80 chars (got: '${projectName}')`);
  }

  const projectSlug = String(parsed.project_slug || "").trim();
  if (!projectSlug || projectSlug !== slugifyIdentity(projectSlug) || projectSlug.length > 64) {
    errors.push(`PROJECT_SLUG must be kebab-case ASCII and <=64 chars (got: '${projectSlug}')`);
  }

  const platform = (parsed.platform || "").toLowerCase();
  if (!VALID_PLATFORMS.has(platform)) {
    errors.push(`PLATFORM must be one of ${[...VALID_PLATFORMS].join(", ")} (got: '${platform}')`);
  }

  const techStack = (parsed.tech_stack || "").toLowerCase();
  if (!VALID_TECH_STACKS.has(techStack)) {
    errors.push(`TECH_STACK must be one of ${[...VALID_TECH_STACKS].join(", ")} (got: '${techStack}')`);
  }

  const dbRequired = (parsed.db_required || "").toLowerCase();
  if (!VALID_DB_REQUIRED.has(dbRequired)) {
    errors.push(`DB_REQUIRED must be one of ${[...VALID_DB_REQUIRED].join(", ")} (got: '${dbRequired}')`);
  }

  const designRequired = (parsed.design_required || "").toLowerCase();
  if (!VALID_BOOLEAN.has(designRequired)) {
    errors.push(`DESIGN_REQUIRED must be true or false (got: '${designRequired}')`);
  }

  const uiLanguage = (parsed.ui_language || "").toLowerCase();
  if (!VALID_UI_LANGUAGES.has(uiLanguage)) {
    errors.push(`UI_LANGUAGE must be one of ${[...VALID_UI_LANGUAGES].join(", ")} (got: '${parsed.ui_language || ""}')`);
  }

  const prd = parsed.prd || "";
  if (prd.length < MIN_PRD_LENGTH) {
    errors.push(`PRD must be >=${MIN_PRD_LENGTH} chars (got: ${prd.length})`);
  }

  for (const section of REQUIRED_PRD_SECTIONS) {
    if (!hasSection(prd, section)) errors.push(`PRD missing section: ${section}`);
  }

  if (boolValue(designRequired)) {
    if (countContractBlocks(prd, /\bSURF_[A-Z0-9_]+\b/g) === 0 && !/\bSURFACE_ID\s*:/i.test(prd)) {
      errors.push("DESIGN_REQUIRED=true requires Product Surfaces with SURF_* identifiers");
    }
    if (!/\bcontrol_hint\b|\bControl Hint\b|\bPermitted Actions\b/i.test(prd)) {
      errors.push("Product Surfaces must include permitted action/control hints for Stitch");
    }
  }

  const definedActions = definedActionIds(prd);
  if (definedActions.size === 0 && countContractBlocks(prd, /\bACT_[A-Z0-9_]+\b/g) === 0 && !/\bACTION_ID\s*:/i.test(prd)) {
    errors.push("PRD must include Behavioral And Action Contract entries with ACT_* identifiers");
  }

  if (boolValue(designRequired)) {
    const missing = [...permittedActionIds(prd)].filter(actionId => !definedActions.has(actionId));
    if (missing.length > 0) {
      errors.push(`Every permitted action must have a Behavioral And Action Contract entry. Missing: ${missing.slice(0, 8).join(", ")}`);
    }
  }

  if (!/##+\s+(?:\d+\.\s*)?Out Of Scope\b[\s\S]*?(?:\n[-*]\s+\S|\nNo\s+)/i.test(prd)) {
    errors.push("Out Of Scope must include at least one explicit deny item");
  }

  errors.push(...hasRuntimeLeak(parsed, prd));

  return { ok: errors.length === 0, errors };
}

export async function onComplete(ctx: CompleteContext): Promise<void> {
  const { parsed, context, runId } = ctx;
  normalize(parsed);

  const identity = resolveRuntimeIdentity({
    runId,
    projectName: parsed.project_name,
    projectSlug: parsed.project_slug,
    explicitRepo: context["repo"] || context["REPO"] || "",
    explicitBranch: context["branch"] || context["BRANCH"] || "",
    explicitGithubRepo: context["github_repo"] || context["GITHUB_REPO"] || "",
  });

  context["project_name"] = identity.projectName;
  context["project_display_name"] = identity.projectName;
  context["project_slug"] = identity.projectSlug;
  context["run_slug"] = identity.runSlug;
  context["repo"] = identity.repo;
  context["branch"] = identity.branch;
  context["github_repo"] = identity.githubRepo;
  context["app_title"] = identity.appTitle;
  context["package_name"] = identity.packageName;
  context["platform"] = (parsed.platform || "").toLowerCase();
  context["tech_stack"] = (parsed.tech_stack || "").toLowerCase();
  context["prd"] = parsed.prd || "";
  context["db_required"] = (parsed.db_required || "").toLowerCase();
  context["design_required"] = (parsed.design_required || "").toLowerCase();
  context["ui_language"] = parsed.ui_language || "English";
}
