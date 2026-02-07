import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { resolveWorkflowDir, resolveWorkflowRoot } from "./paths.js";

type WorkflowSource =
  | { kind: "local"; workflowId: string; workflowDir: string }
  | { kind: "raw"; workflowId: string; url: string; workflowDir: string }
  | {
      kind: "git";
      workflowId: string;
      repoUrl: string;
      subdir?: string;
      workflowDir: string;
    };

function isHttpUrl(input: string): boolean {
  return /^https?:\/\//.test(input);
}

async function runGit(args: string[], cwd?: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("git", args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`git ${args.join(" ")} failed with code ${code}`));
      }
    });
  });
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeWorkflowId(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  return trimmed.replace(/\.git$/, "").replace(/\.(ya?ml)$/i, "");
}

function parseGitHubSubdir(url: URL): { repoUrl: string; subdir?: string } | null {
  if (url.hostname !== "github.com") {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const [owner, repo, marker, ref, ...rest] = parts;
  if (marker !== "tree" || !ref) {
    return null;
  }
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const subdir = rest.length > 0 ? rest.join("/") : undefined;
  return { repoUrl, subdir };
}

function deriveWorkflowIdFromSource(source: string, subdir?: string): string {
  if (subdir) {
    const parts = subdir.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "workflow";
    return normalizeWorkflowId(last);
  }
  const cleaned = source.replace(/\/$/, "");
  const parts = cleaned.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "workflow";
  return normalizeWorkflowId(last);
}

function resolveWorkflowSource(source: string): WorkflowSource {
  if (!isHttpUrl(source)) {
    const workflowId = normalizeWorkflowId(path.basename(source));
    return {
      kind: "local",
      workflowId,
      workflowDir: path.resolve(source),
    };
  }

  const url = new URL(source);
  if (url.hostname === "raw.githubusercontent.com" || url.pathname.endsWith(".yml") || url.pathname.endsWith(".yaml")) {
    const workflowId = deriveWorkflowIdFromSource(source);
    return {
      kind: "raw",
      workflowId,
      url: source,
      workflowDir: resolveWorkflowDir(workflowId),
    };
  }

  const subdirInfo = parseGitHubSubdir(url);
  if (subdirInfo) {
    const workflowId = deriveWorkflowIdFromSource(source, subdirInfo.subdir);
    return {
      kind: "git",
      workflowId,
      repoUrl: subdirInfo.repoUrl,
      subdir: subdirInfo.subdir,
      workflowDir: resolveWorkflowDir(workflowId),
    };
  }

  const workflowId = deriveWorkflowIdFromSource(source);
  return {
    kind: "git",
    workflowId,
    repoUrl: source,
    workflowDir: resolveWorkflowDir(workflowId),
  };
}

async function fetchRawWorkflow(source: { url: string; workflowDir: string }): Promise<void> {
  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Failed to download workflow: ${response.status} ${response.statusText}`);
  }
  const content = await response.text();
  await ensureDir(source.workflowDir);
  await fs.writeFile(path.join(source.workflowDir, "workflow.yml"), content, "utf-8");
}

async function copyDirectory(sourceDir: string, destinationDir: string) {
  await fs.rm(destinationDir, { recursive: true, force: true });
  await ensureDir(path.dirname(destinationDir));
  await fs.cp(sourceDir, destinationDir, { recursive: true });
}

async function fetchGitWorkflow(source: {
  repoUrl: string;
  workflowDir: string;
  subdir?: string;
}) {
  const repoDir = path.join(resolveWorkflowRoot(), ".repos", source.repoUrl.replace(/[^a-zA-Z0-9_-]/g, "__"));
  await ensureDir(path.dirname(repoDir));
  if (await pathExists(path.join(repoDir, ".git"))) {
    await runGit(["-C", repoDir, "pull", "--ff-only"]);
  } else {
    await runGit(["clone", source.repoUrl, repoDir]);
  }
  const sourceDir = source.subdir ? path.join(repoDir, source.subdir) : repoDir;
  if (!(await pathExists(path.join(sourceDir, "workflow.yml")))) {
    throw new Error(`workflow.yml not found in ${sourceDir}`);
  }
  await copyDirectory(sourceDir, source.workflowDir);
}

async function copyLocalWorkflow(sourceDir: string, workflowDir: string) {
  if (!(await pathExists(path.join(sourceDir, "workflow.yml")))) {
    throw new Error(`workflow.yml not found in ${sourceDir}`);
  }
  await copyDirectory(sourceDir, workflowDir);
}

export async function fetchWorkflow(source: string): Promise<{ workflowDir: string }> {
  const resolved = resolveWorkflowSource(source);
  await ensureDir(resolveWorkflowRoot());

  if (resolved.kind === "raw") {
    await fetchRawWorkflow(resolved);
    return { workflowDir: resolved.workflowDir };
  }

  if (resolved.kind === "git") {
    await fetchGitWorkflow(resolved);
    return { workflowDir: resolved.workflowDir };
  }

  const destination = resolveWorkflowDir(resolved.workflowId);
  await copyLocalWorkflow(resolved.workflowDir, destination);
  return { workflowDir: destination };
}
