import fs from "node:fs";
import path from "node:path";
import type { SupervisorChecklist, SupervisorChecklistItem, SupervisorChecklistItemType } from "./types.js";

type ScreenIndexEntry = {
  screenId?: string;
  id?: string;
  title?: string;
  name?: string;
  componentName?: string;
  file?: string;
};

type DesignControl = Record<string, unknown>;

export function buildSupervisorChecklistFromProject(params: {
  runId: string;
  workdir: string;
  repoPath?: string;
  storyId?: string;
  scopeFiles?: string[];
  projectSlug?: string;
  sourceCommit?: string;
}): SupervisorChecklist {
  const { runId, workdir, repoPath = "", storyId, projectSlug, sourceCommit } = params;
  const scopeFiles = (params.scopeFiles || []).map(normalizePath).filter(Boolean);
  const screenIndex = loadScreenIndex(workdir, repoPath);
  const designScreens = loadDesignDomScreens(workdir, repoPath);
  const scoped = new Set(scopeFiles);
  const items: SupervisorChecklistItem[] = [];

  for (const entry of screenIndex) {
    const file = normalizePath(String(entry.file || ""));
    if (!file) continue;
    if (scoped.size > 0 && !scoped.has(file)) continue;
    const design = designScreenForIndexEntry(entry, designScreens);
    if (!design) continue;
    const screen = String(entry.componentName || entry.title || design.title || design.name || file).trim() || file;
    const screenId = String(entry.screenId || entry.id || design.screenId || design.id || "").trim() || undefined;

    addControlItems(items, {
      storyId,
      screen,
      screenId,
      file,
      scopeFiles: scopeFiles.length > 0 ? scopeFiles : [file],
      controls: Array.isArray(design.buttons) ? design.buttons : [],
      type: "button",
    });
    addControlItems(items, {
      storyId,
      screen,
      screenId,
      file,
      scopeFiles: scopeFiles.length > 0 ? scopeFiles : [file],
      controls: Array.isArray(design.navLinks) ? design.navLinks : [],
      type: "link",
    });
    addControlItems(items, {
      storyId,
      screen,
      screenId,
      file,
      scopeFiles: scopeFiles.length > 0 ? scopeFiles : [file],
      controls: Array.isArray(design.inputs) ? design.inputs : [],
      type: "input",
    });
    addControlItems(items, {
      storyId,
      screen,
      screenId,
      file,
      scopeFiles: scopeFiles.length > 0 ? scopeFiles : [file],
      controls: Array.isArray(design.selects) ? design.selects : [],
      type: "select",
    });
  }

  return {
    schema: "setfarm.supervisor-checklist.v1",
    runId,
    projectSlug,
    sourceCommit,
    generatedAt: new Date().toISOString(),
    items: dedupeItems(items),
  };
}

export function loadScreenIndex(workdir: string, repoPath = ""): ScreenIndexEntry[] {
  for (const candidate of candidateFiles(workdir, repoPath, path.join("src", "screens", "SCREEN_INDEX.json"))) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // keep looking
    }
  }
  return [];
}

export function loadDesignDomScreens(workdir: string, repoPath = ""): any[] {
  for (const candidate of candidateFiles(workdir, repoPath, path.join("stitch", "DESIGN_DOM.json"))) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.screens)) return parsed.screens;
      if (parsed?.screens && typeof parsed.screens === "object") return Object.values(parsed.screens);
      if (parsed && typeof parsed === "object") {
        return Object.values(parsed).filter((value: any) => value && typeof value === "object" && (value.buttons || value.navLinks || value.inputs));
      }
    } catch {
      // keep looking
    }
  }
  return [];
}

export function designScreenForIndexEntry(entry: ScreenIndexEntry, screens: any[]): any | undefined {
  const entryScreenId = String(entry.screenId || entry.id || "").trim();
  const entryTitle = normalizeControlText(entry.title || entry.name || entry.componentName || "");
  return screens.find((screen) => String(screen?.screenId || screen?.id || "").trim() === entryScreenId)
    || screens.find((screen) => normalizeControlText(screen?.title || screen?.name || screen?.screenName || "") === entryTitle);
}

export function normalizeControlText(value: unknown): string {
  return String(value || "")
    .replace(/[\u0130]/g, "I")
    .replace(/[\u0131]/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u015f\u015e]/g, "s")
    .replace(/[\u00e7\u00c7]/g, "c")
    .replace(/[\u011f\u011e]/g, "g")
    .replace(/[\u00fc\u00dc]/g, "u")
    .replace(/[\u00f6\u00d6]/g, "o")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addControlItems(items: SupervisorChecklistItem[], params: {
  storyId?: string;
  screen: string;
  screenId?: string;
  file: string;
  scopeFiles: string[];
  controls: DesignControl[];
  type: SupervisorChecklistItemType;
}): void {
  const { storyId, screen, screenId, file, scopeFiles, controls, type } = params;
  for (const control of controls) {
    const label = String(control.label || control.text || control.name || control.placeholder || "").trim();
    const icon = String(control.icon || "").trim();
    const href = String(control.href || "").trim();
    const action = String(control.action || control.actionId || control.onClick || "").trim();
    if (!label && !icon && !href) continue;

    const baseId = checklistId(type, screen, label || href || icon, file);
    items.push({
      id: baseId,
      storyId,
      screen,
      screenId,
      file,
      scopeFiles,
      type,
      label: label || undefined,
      icon: icon || undefined,
      href: href || undefined,
      action: action || undefined,
      severity: "blocker",
      evidenceRequired: evidenceForControl(type),
      source: "design-dom",
    });

    if (icon) {
      items.push({
        id: checklistId("icon", screen, `${label || "icon-only"}:${icon}`, file),
        storyId,
        screen,
        screenId,
        file,
        scopeFiles,
        type: "icon",
        label: label || undefined,
        icon,
        href: href || undefined,
        action: action || undefined,
        parentId: baseId,
        severity: label ? "warning" : "blocker",
        evidenceRequired: ["static-icon"],
        source: "design-dom",
      });
    }
  }
}

function evidenceForControl(type: SupervisorChecklistItemType): string[] {
  if (type === "button") return ["static-control", "handler-or-inert"];
  if (type === "link") return ["static-control", "href-or-inert"];
  if (type === "input" || type === "select") return ["static-control"];
  return ["static-control"];
}

function checklistId(type: SupervisorChecklistItemType, screen: string, label: string, file: string): string {
  return `dom:${safeId(screen || file)}:${safeId(file)}:${type}:${safeId(label || "control")}`;
}

function safeId(value: string): string {
  return normalizeControlText(value).replace(/\s+/g, "-").slice(0, 80) || "item";
}

function normalizePath(value: string): string {
  return String(value || "").replace(/\\/g, "/").replace(/^\.\/+/, "").trim();
}

function candidateFiles(workdir: string, repoPath: string, rel: string): string[] {
  return [path.join(workdir, rel), repoPath ? path.join(repoPath, rel) : ""].filter(Boolean);
}

function dedupeItems(items: SupervisorChecklistItem[]): SupervisorChecklistItem[] {
  const seen = new Set<string>();
  const out: SupervisorChecklistItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
