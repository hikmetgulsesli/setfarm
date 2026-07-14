import fs from "node:fs";
import path from "node:path";

const RUNTIME_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

export function runtimeWorkspacePath(root: string, runtimeId: string): string {
  if (!RUNTIME_ID_PATTERN.test(runtimeId)) {
    throw new Error("RUNTIME_WORKSPACE_ID_INVALID");
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, runtimeId);
  if (resolved === resolvedRoot || !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("RUNTIME_WORKSPACE_PATH_ESCAPE");
  }
  return resolved;
}

export function prepareAttemptRuntimeWorkspace(input: Readonly<{
  root: string;
  runtimeId: string;
  projectWorktree: string;
}>): Readonly<{ path: string; markerPath: string }> {
  const workspace = runtimeWorkspacePath(input.root, input.runtimeId);
  const markerPath = path.join(workspace, ".setfarm-attempt-workspace.json");
  fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });
  fs.writeFileSync(markerPath, JSON.stringify({
    schema: "setfarm.attempt-runtime-workspace.v1",
    runtimeId: input.runtimeId,
    projectWorktree: path.resolve(input.projectWorktree),
  }, null, 2) + "\n", { mode: 0o600 });
  return Object.freeze({ path: workspace, markerPath });
}

export function removeAttemptRuntimeWorkspace(input: Readonly<{
  root: string;
  runtimeId: string;
}>): boolean {
  const workspace = runtimeWorkspacePath(input.root, input.runtimeId);
  const markerPath = path.join(workspace, ".setfarm-attempt-workspace.json");
  if (!fs.existsSync(workspace)) return false;
  let marker: unknown;
  try {
    marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
  } catch {
    throw new Error("RUNTIME_WORKSPACE_MARKER_MISSING");
  }
  if (
    typeof marker !== "object"
    || marker === null
    || (marker as Record<string, unknown>)["schema"] !== "setfarm.attempt-runtime-workspace.v1"
    || (marker as Record<string, unknown>)["runtimeId"] !== input.runtimeId
  ) {
    throw new Error("RUNTIME_WORKSPACE_MARKER_MISMATCH");
  }
  fs.rmSync(workspace, { recursive: true, force: true });
  return true;
}
