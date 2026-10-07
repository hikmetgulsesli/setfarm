import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { resolveBundledWorkflowsDir } from "../installer/paths.js";

const REQUIRED_WORKFLOWS = ["bug-fix","daily-standup","feature-dev","security-audit","ui-refactor"];
const REQUIRED_FRAGMENTS = ["implement-design-enforcement.md","lint-build-test.md","story-branch-create.md","db-context.md","verify-pr-read.md","setup-repo-init.md","browser-verification.md","lint-setup.md","game-dev-rules.md","design-first.md","verify-output-format.md","final-test-merge-main.md","critical-preamble.md","story-loop-context.md","story-progress-write.md","implement-stitch-rules.md","final-pr-orphan-cleanup.md","implement-ui-contract.md","verify-rebase-merge.md","platform-design-rules.md"];
const REQUIRED_REFERENCES = ["lessons-learned.md","backend-standards.md","brainstorming-protocol.md","mc-server.md","web-guidelines.md","design-standards.md","debugging-protocol.md","openclaw-ops.md","react-best-practices.md","setfarm-debug.md","game-dev-guide.md","next-best-practices.md"];
function requireMembers(names:string[], required:readonly string[]):void {
  if(required.some(name=>!names.includes(name)))throw new Error("DASHBOARD_MATERIAL_UNAVAILABLE");
}
function readText(file:string, required:boolean):string {
  if(!required)return fs.readFileSync(file,"utf8");
  const bytes=fs.readFileSync(file), text=bytes.toString("utf8");
  if(!text.trim()||!Buffer.from(text,"utf8").equals(bytes))throw new Error("DASHBOARD_MATERIAL_UNAVAILABLE");
  return text;
}
interface WorkflowDef {
  id: string;
  name: string;
  steps: Array<{ id: string; agent: string }>;
}

function workflowCatalog(required:boolean): WorkflowDef[] {
  const dir = resolveBundledWorkflowsDir();
  const results: WorkflowDef[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if(required)requireMembers(entries.filter(entry=>entry.isDirectory()).map(entry=>entry.name),REQUIRED_WORKFLOWS);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const ymlPath = path.join(dir, entry.name, "workflow.yml");
      if (!fs.existsSync(ymlPath)) {
        if(required && REQUIRED_WORKFLOWS.includes(entry.name))throw new Error("DASHBOARD_MATERIAL_UNAVAILABLE");
        continue;
      }
      const parsed = YAML.parse(readText(ymlPath,required));
      if(required && (!parsed || typeof (parsed.id ?? entry.name)!=="string" || typeof (parsed.name ?? entry.name)!=="string" || !Array.isArray(parsed.steps) || parsed.steps.some((s:any)=>!s || typeof s.id!=="string" || typeof s.agent!=="string")))throw new Error("DASHBOARD_MATERIAL_UNAVAILABLE");
      results.push({
        id: parsed.id ?? entry.name,
        name: parsed.name ?? entry.name,
        steps: (parsed.steps ?? []).map((s: any) => ({ id: s.id, agent: s.agent })),
      });
    }
  } catch(error) { if(required)throw error; }
  return results;
}

export function loadDashboardWorkflowsV2():WorkflowDef[]{return workflowCatalog(false);}
export function loadRequiredDashboardWorkflowsV2():WorkflowDef[]{return workflowCatalog(true);}

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
  stack_pack_ids: string[];
  module_owner: string;
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

const RULE_STACK_SCOPE: Record<string, { stack_pack_ids: string[]; module_owner: string }> = {
  "game-dev-rules.md": { stack_pack_ids: ["browser-game-canvas"], module_owner: "stack.browser-game-canvas" },
  "game-dev-guide.md": { stack_pack_ids: ["browser-game-canvas"], module_owner: "stack.browser-game-canvas" },
  "react-best-practices.md": { stack_pack_ids: ["vite-react-web-app", "browser-game-canvas"], module_owner: "stack.web-react" },
  "next-best-practices.md": { stack_pack_ids: ["nextjs-web-app"], module_owner: "stack.nextjs-web-app" },
};

function ruleStackScope(sourceFile: string): { stack_pack_ids: string[]; module_owner: string } {
  const lower = sourceFile.toLowerCase();
  if (RULE_STACK_SCOPE[lower]) return RULE_STACK_SCOPE[lower];
  if (lower.includes("game")) return { stack_pack_ids: ["browser-game-canvas"], module_owner: "stack.browser-game-canvas" };
  if (lower.includes("next")) return { stack_pack_ids: ["nextjs-web-app"], module_owner: "stack.nextjs-web-app" };
  if (lower.includes("react")) return { stack_pack_ids: ["vite-react-web-app", "browser-game-canvas"], module_owner: "stack.web-react" };
  return { stack_pack_ids: [], module_owner: "global" };
}

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.md$/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function systemRules(required:boolean): ParsedRule[] {
  const rules: ParsedRule[] = [];
  const wfDir = resolveBundledWorkflowsDir();

  // Scan top-level _fragments directory
  const fragDir = path.join(wfDir, "_fragments");
  try {
    if(required && !fs.existsSync(fragDir))throw new Error("DASHBOARD_MATERIAL_UNAVAILABLE");
    if (fs.existsSync(fragDir)) {
      const names=fs.readdirSync(fragDir);
      if(required)requireMembers(names,REQUIRED_FRAGMENTS);
      for (const f of names) {
        if (!f.endsWith(".md")) continue;
        const content = readText(path.join(fragDir,f),required);
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
          ...ruleStackScope(f),
          enabled: true,
          readonly: true,
        });
      }
    }
  } catch(error) { if(required)throw error; }

  // References
  const refsDir = path.resolve(wfDir, "..", "references");
  try {
    const names=fs.readdirSync(refsDir);
    if(required)requireMembers(names,REQUIRED_REFERENCES);
    for (const f of names) {
      if (!f.endsWith(".md")) continue;
      const content = readText(path.join(refsDir,f),required);
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
        ...ruleStackScope(f),
        enabled: true,
        readonly: true,
      });
    }
  } catch(error) { if(required)throw error; }

  return rules;
}

export function parseDashboardSystemRulesV2():ParsedRule[]{return systemRules(false);}
export function parseRequiredDashboardSystemRulesV2():ParsedRule[]{return systemRules(true);}

export function mergeDashboardRulesV2(systemRules:readonly ParsedRule[], custom:readonly any[], query:URLSearchParams):any[] {
  const customRules = custom.map((r: any) => ({
    ...r,
    enabled: !!r.enabled,
    readonly: false,
  }));

  let all = [...systemRules, ...customRules];

  const category = query.get("category");
  const projectType = query.get("project_type");
  const source = query.get("source");
  const stackPackId = query.get("stack_pack_id");
  const search = query.get("search")?.toLowerCase();

  if (category) all = all.filter((r) => r.category === category);
  if (projectType) all = all.filter((r) => r.project_type === projectType);
  if (source === "system") all = all.filter((r) => r.readonly);
  else if (source === "custom") all = all.filter((r) => !r.readonly);
  if (stackPackId) all = all.filter((r) => !Array.isArray(r.stack_pack_ids) || r.stack_pack_ids.length === 0 || r.stack_pack_ids.includes(stackPackId));
  if (search) all = all.filter((r) => r.title.toLowerCase().includes(search) || r.content.toLowerCase().includes(search));

  return all;
}


