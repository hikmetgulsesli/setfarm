import os from "node:os";
import path from "node:path";

export type RuntimeIdentityInput = {
  runId: string;
  projectName?: string;
  projectSlug?: string;
  explicitRepo?: string;
  explicitBranch?: string;
  explicitGithubRepo?: string;
};

export type RuntimeIdentity = {
  projectName: string;
  projectSlug: string;
  runSlug: string;
  repo: string;
  branch: string;
  githubRepo: string;
  appTitle: string;
  packageName: string;
};

const DEFAULT_GITHUB_OWNER = "hikmetgulsesli";

export function transliterateIdentity(input: string): string {
  return String(input || "")
    .replace(/[\u011e\u011f]/g, "g")
    .replace(/[\u00dc\u00fc]/g, "u")
    .replace(/[\u015e\u015f]/g, "s")
    .replace(/[\u0130I\u0131]/g, "i")
    .replace(/[\u00d6\u00f6]/g, "o")
    .replace(/[\u00c7\u00e7]/g, "c");
}

export function slugifyIdentity(input: string, fallback = "setfarm-project", maxLength = 64): string {
  const slug = transliterateIdentity(input)
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || fallback;
}

function displayNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (["api", "crm", "erp", "hr", "ui", "ux", "ai", "qa"].includes(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ") || "Setfarm Project";
}

function runSuffix(runId: string): string {
  const clean = String(runId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean.slice(0, 8) || Math.random().toString(36).slice(2, 10);
}

export function buildRunSlug(projectSlug: string, runId: string): string {
  const base = slugifyIdentity(projectSlug, "setfarm-project", 72);
  const suffix = runSuffix(runId);
  if (base.endsWith(`-${suffix}`)) return base;
  const maxBase = Math.max(1, 80 - suffix.length - 1);
  return `${base.slice(0, maxBase).replace(/-+$/g, "") || "project"}-${suffix}`;
}

export function resolveProjectsRoot(env: NodeJS.ProcessEnv = process.env): string {
  const configured =
    env.SETFARM_PROJECTS_ROOT?.trim() ||
    env.SETFARM_WORKSPACE_PROJECTS_ROOT?.trim() ||
    env.OPENCLAW_PROJECTS_ROOT?.trim();
  if (configured) return configured.replace(/^~(?=\/|$)/, os.homedir());
  return path.join(os.homedir(), "projects");
}

export function resolveRuntimeIdentity(input: RuntimeIdentityInput): RuntimeIdentity {
  const productSlug = slugifyIdentity(input.projectSlug || input.projectName || "setfarm-project");
  const projectName = String(input.projectName || "").trim() || displayNameFromSlug(productSlug);
  const runSlug = buildRunSlug(productSlug, input.runId);
  const repo = String(input.explicitRepo || "").trim() || path.join(resolveProjectsRoot(), runSlug);
  const branch = String(input.explicitBranch || "").trim() || `feature-${runSlug}`.slice(0, 80).replace(/-+$/g, "");
  const owner = process.env.SETFARM_GITHUB_OWNER?.trim() || DEFAULT_GITHUB_OWNER;
  const githubRepo = String(input.explicitGithubRepo || "").trim() || `${owner}/${runSlug}`;
  const packageName = slugifyIdentity(runSlug, "setfarm-app", 214);

  return {
    projectName,
    projectSlug: productSlug,
    runSlug,
    repo,
    branch,
    githubRepo,
    appTitle: projectName,
    packageName,
  };
}
