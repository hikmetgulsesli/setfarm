/** Fixed private asset DATA component. It grants no source/build/SQL readiness. */
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { readFreshInstallationSourceAssetsV1 } from "./fresh-installation-source-v1.js";
import type { ProvisionedAgent } from "../installer/agent-provision.js";
import type { WorkflowSpec } from "../installer/types.js";

const REPOSITORY = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));
const CODE = "FRESH_INSTALLATION_PRIVATE_ASSETS_REFUSED";
const ID = /^[a-z][a-z0-9-]{0,79}$/;
const SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const PRIVATE_DIRECTORIES = ["projects", "agent-scratch", "transcripts", "agents", "attempt-workspaces", "services", "logs", "runs",
  "workspaces/workflows", "sessions", "evals/results", "mobile", "mission-control/uploads", "mission-control/avatars"] as const;
function workflowIds(assets: SourceAssets): string[] {
  return [...assets.keys()].flatMap(name => /^workflows\/([^/]+)\/workflow\.yml$/.exec(name)?.slice(1) ?? []).sort();
}
function refuse(): never { throw new Error(CODE); }
function child(root: string, relative: string): string {
  if (!relative || relative.includes("\0") || path.isAbsolute(relative) || path.normalize(relative) !== relative) refuse();
  const result = path.resolve(root, relative), relation = path.relative(root, result);
  if (!relation || relation.startsWith("..") || path.isAbsolute(relation)) refuse();
  return result;
}
function directory(value: string): void {
  const stat = lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid!()
    || (stat.mode & 0o7777) !== 0o700 || realpathSync(value) !== value) refuse();
}
function regular(value: string, maxBytes = 1024 * 1024): Buffer {
  const fd = openSync(value, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let primary = false;
  try {
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.uid !== BigInt(process.getuid!())
      || (before.mode & 0o7777n) !== 0o600n || before.size > BigInt(maxBytes) || realpathSync(value) !== value) refuse();
    const bytes = Buffer.alloc(Number(before.size)); let amount = 0;
    while (amount < bytes.length) {
      const count = readSync(fd, bytes, amount, Math.min(65536, bytes.length - amount), null);
      if (!count) refuse();
      amount += count;
    }
    if (readSync(fd, Buffer.alloc(1), 0, 1, null) !== 0) refuse();
    const after = fstatSync(fd, { bigint: true }), named = lstatSync(value, { bigint: true });
    for (const key of ["dev", "ino", "mode", "nlink", "uid", "gid", "size", "mtimeNs", "ctimeNs"] as const) {
      if (before[key] !== after[key] || before[key] !== named[key]) refuse();
    }
    return bytes;
  } catch (error) { primary = true; throw error; }
  finally { try { closeSync(fd); } catch (error) { if (!primary) throw error; } }
}
type SourceAssets = ReadonlyMap<string, Buffer>;
function sourceFile(assets: SourceAssets, absolute: string): Buffer {
  const relative = path.relative(REPOSITORY, absolute);
  child(REPOSITORY, relative);
  const bytes = assets.get(relative);
  if (!bytes || bytes.length > 1024 * 1024) refuse();
  return bytes;
}
function sourceTree(assets: SourceAssets, absolute: string): ReadonlyMap<string, Buffer> {
  const relative = path.relative(REPOSITORY, absolute);
  child(REPOSITORY, relative);
  const prefix = relative + "/", entries = new Map<string, Buffer>();
  for (const [name, bytes] of assets) if (name.startsWith(prefix)) entries.set(name.slice(prefix.length), bytes);
  if (entries.size === 0) refuse();
  return entries;
}
function hasSourceTree(assets: SourceAssets, absolute: string): boolean {
  const prefix = path.relative(REPOSITORY, absolute) + "/";
  return [...assets.keys()].some(name => name.startsWith(prefix));
}
function sourceWorkflow(assets: SourceAssets, workflowId: string): WorkflowSpec {
  if (!ID.test(workflowId)) refuse();
  const value = YAML.parse(sourceFile(assets, path.join(REPOSITORY, "workflows", workflowId, "workflow.yml")).toString("utf8")) as WorkflowSpec;
  if (!value || value.id !== workflowId || !Array.isArray(value.agents) || value.agents.length < 1) refuse();
  const ids = new Set<string>();
  for (const agent of value.agents) {
    if (!agent || !ID.test(agent.id) || ids.has(agent.id) || !agent.workspace
      || typeof agent.workspace.baseDir !== "string" || !agent.workspace.files
      || typeof agent.workspace.files !== "object" || Array.isArray(agent.workspace.files)
      || (agent.workspace.skills !== undefined && (!Array.isArray(agent.workspace.skills)
        || agent.workspace.skills.some(skill => typeof skill !== "string" || !ID.test(skill))))) refuse();
    ids.add(agent.id);
    child("/workspace", agent.workspace.baseDir);
    for (const [name, relative] of Object.entries(agent.workspace.files)) {
      child("/workspace", name);
      if (typeof relative !== "string" || relative.includes("\0")) refuse();
      sourceFile(assets, path.resolve(REPOSITORY, "workflows", workflowId, relative));
    }
  }
  return value;
}
function workspace(root: string, workflow: WorkflowSpec, agent: WorkflowSpec["agents"][number]): string {
  return child(path.join(root, "workspaces", "workflows", workflow.id), agent.workspace.baseDir);
}
function verifyTree(assets: SourceAssets, source: string, target: string): void {
  const wanted = sourceTree(assets, source), actual: string[] = [], actualDirectories: string[] = [];
  const wantedDirectories = new Set<string>();
  for (const relative of wanted.keys()) {
    let parent = path.dirname(relative);
    while (parent !== ".") { wantedDirectories.add(parent); parent = path.dirname(parent); }
  }
  let count = 0;
  const walk = (directoryName: string, prefix: string, depth: number): void => {
    if (++count > 2048 || depth > 32) refuse();
    directory(directoryName);
    for (const name of readdirSync(directoryName).sort()) {
      const full = path.join(directoryName, name), relative = prefix ? prefix + "/" + name : name;
      const stat = lstatSync(full);
      if (stat.isDirectory() && !stat.isSymbolicLink()) { actualDirectories.push(relative); walk(full, relative, depth + 1); }
      else { actual.push(relative); if (++count > 2048 || !regular(full).equals(wanted.get(relative) ?? Buffer.alloc(0))) refuse(); }
    }
  };
  walk(target, "", 0);
  if (actual.sort().join("\0") !== [...wanted.keys()].sort().join("\0")
    || actualDirectories.sort().join("\0") !== [...wantedDirectories].sort().join("\0")) refuse();
}

/** Called once immediately after the controller exclusively owns a NEW planned directory. */
export function initializeFreshInstallationPrivateAssetsV1(directoryName: string, sourceSha: string): void {
  try {
    const assets = readFreshInstallationSourceAssetsV1(sourceSha); // Fixed Git-verified bytes/set; DATA only.
    const installation = realpathSync(directoryName);
    directory(installation);
    if (!SHA.test(sourceSha) || readdirSync(installation).join(",") !== "planned.json") refuse();
    const planned = JSON.parse(regular(path.join(installation, "planned.json")).toString("utf8")) as { sourceSha?: unknown };
    if (planned.sourceSha !== sourceSha) refuse();
    const root = path.join(installation, "runtime");
    mkdirSync(root, { mode: 0o700 }); // Exclusive: never adopt or repair an existing runtime.
    const make = (target: string): void => {
      if (target !== root) child(root, path.relative(root, target));
      try { lstatSync(target); }
      catch (error) {
        if ((error as { code?: string }).code !== "ENOENT") throw error;
        make(path.dirname(target)); mkdirSync(target, { mode: 0o700 });
      }
      directory(target);
    };
    let files = 0, bytes = 0;
    const copy = (source: string, target: string): void => {
      const content = sourceFile(assets, source);
      let present = true;
      try { lstatSync(target); } catch (error) { if ((error as { code?: string }).code !== "ENOENT") throw error; present = false; }
      if (present) { if (!regular(target).equals(content)) refuse(); return; }
      if (++files > 2048 || (bytes += content.length) > 8 * 1024 * 1024) refuse();
      make(path.dirname(target));
      writeFileSync(target, content, { flag: "wx", mode: 0o600 });
      if (!regular(target).equals(content)) refuse();
    };
    const tree = (source: string, target: string): void => {
      make(target);
      for (const relative of [...sourceTree(assets, source).keys()].sort()) {
        copy(path.join(source, relative), child(target, relative));
      }
    };
    for (const name of PRIVATE_DIRECTORIES) make(child(root, name));
    for (const name of ["projects.json", "deleted-projects.json"]) writeFileSync(path.join(root, "mission-control", name), "[]\n", { flag: "wx", mode: 0o600 });
    tree(path.join(REPOSITORY, "workflows"), path.join(root, "workflows"));
    const optionalSkillGaps: string[] = [];
    for (const workflowId of workflowIds(assets)) {
      const workflow = sourceWorkflow(assets, workflowId);
      for (const agent of workflow.agents) {
        const workspaceDir = workspace(root, workflow, agent), agentId = `${workflow.id}_${agent.id}`;
        make(workspaceDir);
        for (const [name, relative] of Object.entries(agent.workspace.files)) {
          copy(path.resolve(REPOSITORY, "workflows", workflow.id, relative), child(workspaceDir, name));
        }
        tree(path.join(REPOSITORY, "references"), path.join(workspaceDir, "references"));
        for (const skill of agent.workspace.skills ?? []) {
          const local = path.join(REPOSITORY, "workflows", workflow.id, "skills", skill), shared = path.join(REPOSITORY, "skills", skill);
          const source = hasSourceTree(assets, local) ? local : hasSourceTree(assets, shared) ? shared : undefined;
          if (source) tree(source, path.join(workspaceDir, "skills", skill));
          else optionalSkillGaps.push(`${agentId}:${skill}`); // Optional legacy skill gaps stay explicit; no HOME lookup.
        }
        const agentDir = path.join(root, "agents", agentId, "agent");
        make(agentDir); make(path.join(root, "agents", agentId, "sessions"));
        writeFileSync(path.join(agentDir, "workspace.json"), JSON.stringify({ schema: "setfarm.private-agent-workspace.v1",
          sourceSha, agentId, relative: path.relative(root, workspaceDir) }) + "\n", { flag: "wx", mode: 0o600 });
      }
    }
    writeFileSync(path.join(root, "asset-summary.json"), JSON.stringify({ schema: "setfarm.private-assets-data.v1", sourceSha,
      optionalSkillGaps }) + "\n", { flag: "wx", mode: 0o600 });
    directory(installation); directory(root);
  } catch { return refuse(); }
}

type PrivateWorkflowAssets = Readonly<{ workflowId: string; workflowDir: string; agents: readonly ProvisionedAgent[] }>;
function readWorkflowFromSource(root: string, sourceSha: string, workflowId: string, assets: SourceAssets): PrivateWorkflowAssets {
  directory(root);
  const workflow = sourceWorkflow(assets, workflowId), workflowDir = path.join(root, "workflows", workflowId);
  verifyTree(assets, path.join(REPOSITORY, "workflows", workflowId), workflowDir);
  verifyTree(assets, path.join(REPOSITORY, "workflows", "_fragments"), path.join(root, "workflows", "_fragments"));
  const agents = workflow.agents.map(agent => {
    const id = `${workflow.id}_${agent.id}`, workspaceDir = workspace(root, workflow, agent), agentDir = path.join(root, "agents", id, "agent");
    directory(workspaceDir); directory(agentDir);
    const record = JSON.parse(regular(path.join(agentDir, "workspace.json")).toString("utf8")) as Record<string, unknown>;
    if (Object.keys(record).sort().join(",") !== "agentId,relative,schema,sourceSha" || record.schema !== "setfarm.private-agent-workspace.v1"
      || record.sourceSha !== sourceSha || record.agentId !== id || record.relative !== path.relative(root, workspaceDir)) refuse();
    for (const [name, relative] of Object.entries(agent.workspace.files)) {
      if (!regular(child(workspaceDir, name)).equals(sourceFile(assets, path.resolve(REPOSITORY, "workflows", workflow.id, relative)))) refuse();
    }
    verifyTree(assets, path.join(REPOSITORY, "references"), path.join(workspaceDir, "references"));
    for (const skill of agent.workspace.skills ?? []) {
      const local = path.join(REPOSITORY, "workflows", workflow.id, "skills", skill), shared = path.join(REPOSITORY, "skills", skill);
      const source = hasSourceTree(assets, local) ? local : hasSourceTree(assets, shared) ? shared : undefined;
      if (source) verifyTree(assets, source, path.join(workspaceDir, "skills", skill));
      else {
        try { lstatSync(path.join(workspaceDir, "skills", skill)); refuse(); }
        catch (error) { if ((error as { code?: string }).code !== "ENOENT") throw error; }
      }
    }
    return Object.freeze({ id, name: agent.name, model: agent.model, skills: agent.workspace.skills,
      timeoutSeconds: agent.timeoutSeconds, workspaceDir, agentDir });
  });
  return Object.freeze({ workflowId, workflowDir, agents: Object.freeze(agents) });
}

/** Filesystem DATA lookup only. Caller retains actual entry/claim/SQL admission. */
export function readFreshInstallationPrivateWorkflowAssetsV1(root: string, sourceSha: string, workflowId: string): PrivateWorkflowAssets {
  try { return readWorkflowFromSource(root, sourceSha, workflowId, readFreshInstallationSourceAssetsV1(sourceSha)); }
  catch { return refuse(); }
}

/** Fixed complete pre-poll asset prerequisite; never a service/claim admission. */
export function assertFreshInstallationPrivateAssetsV1(root: string, sourceSha: string): void {
  try {
    const assets = readFreshInstallationSourceAssetsV1(sourceSha);
    directory(root);
    for (const name of PRIVATE_DIRECTORIES) directory(child(root, name));
    for (const name of ["projects.json", "deleted-projects.json"]) {
      if (!Array.isArray(JSON.parse(regular(path.join(root, "mission-control", name), 4 * 1024 * 1024).toString("utf8")))) refuse();
    }
    verifyTree(assets, path.join(REPOSITORY, "workflows"), path.join(root, "workflows"));
    const gaps: string[] = [];
    for (const workflowId of workflowIds(assets)) {
      readWorkflowFromSource(root, sourceSha, workflowId, assets);
      const workflow = sourceWorkflow(assets, workflowId);
      for (const agent of workflow.agents) for (const skill of agent.workspace.skills ?? []) {
        if (!hasSourceTree(assets, path.join(REPOSITORY, "workflows", workflow.id, "skills", skill))
          && !hasSourceTree(assets, path.join(REPOSITORY, "skills", skill))) gaps.push(`${workflow.id}_${agent.id}:${skill}`);
      }
    }
    const summary = JSON.parse(regular(path.join(root, "asset-summary.json")).toString("utf8")) as Record<string, unknown>;
    if (Object.keys(summary).sort().join(",") !== "optionalSkillGaps,schema,sourceSha"
      || summary.schema !== "setfarm.private-assets-data.v1" || summary.sourceSha !== sourceSha
      || JSON.stringify(summary.optionalSkillGaps) !== JSON.stringify(gaps)) refuse();
  } catch { return refuse(); }
}

/** Never returns a shared OpenClaw/default fallback for an unknown selected agent. */
export function readFreshInstallationPrivateAgentWorkspaceV1(root: string, sourceSha: string, agentId: string): string {
  const parts = agentId.split("_");
  if (parts.length !== 2 || !ID.test(parts[0]!) || !ID.test(parts[1]!)) refuse();
  const assets = readFreshInstallationPrivateWorkflowAssetsV1(root, sourceSha, parts[0]!);
  const agent = assets.agents.find(value => value.id === agentId);
  if (!agent) refuse();
  return agent.workspaceDir;
}
