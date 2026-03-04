import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";
import { getDb } from "../db.js";

// --- Types ---

export interface InteractiveElement {
  type: "link" | "button" | "input" | "form";
  label: string;
  href?: string;
  inputType?: string;
  placeholder?: string;
  line: number;
}

export interface DesignContract {
  screenId: string;
  screenTitle: string;
  deviceType: "DESKTOP" | "MOBILE" | "TABLET";
  elements: InteractiveElement[];
  navigation: InteractiveElement[];
  buttons: InteractiveElement[];
  inputs: InteractiveElement[];
  hardcodedData: string[];
  totalInteractive: number;
  requiresRouter: boolean;
  requiresDragDrop: boolean;
}

// --- Hardcoded data patterns ---

const FAKE_NAMES = [
  "Alex Morgan", "John Doe", "Jane Doe", "Jane Smith", "John Smith",
  "Bob Smith", "Alice Johnson", "David Lee", "Sarah Connor", "Mike Johnson",
  "Emily Davis", "Chris Wilson", "Amanda Brown", "James Taylor",
  "Lorem Ipsum", "Dolor Sit", "Amet Consectetur",
];

const FAKE_NAME_RE = new RegExp(FAKE_NAMES.map(n => n.replace(/\s+/g, "\\s+")).join("|"), "gi");

// --- HTML Parsing (regex-based, line-by-line) ---

export function parseDesignHTML(html: string, screenId?: string): DesignContract {
  const elements: InteractiveElement[] = [];
  const navigation: InteractiveElement[] = [];
  const buttons: InteractiveElement[] = [];
  const inputs: InteractiveElement[] = [];
  const hardcodedData: string[] = [];

  // Helper: compute line number from char offset
  const lineOf = (offset: number): number => {
    let line = 1;
    for (let i = 0; i < offset && i < html.length; i++) {
      if (html[i] === "\n") line++;
    }
    return line;
  };

  // Parse full HTML string (supports multiline elements via 's' dotAll flag)
  let m: RegExpExecArray | null;

  // Links: <a href="...">text</a>
  const linkRe = /<a\s[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gis;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1];
    const label = stripTags(m[2]).trim();
    if (!label) continue;
    const el: InteractiveElement = { type: "link", label, href, line: lineOf(m.index) };
    elements.push(el);
    navigation.push(el);
  }

  // Buttons: <button ...>text</button>
  const btnRe = /<button[^>]*>(.*?)<\/button>/gis;
  while ((m = btnRe.exec(html)) !== null) {
    const label = stripTags(m[1]).trim();
    if (!label) continue;
    const el: InteractiveElement = { type: "button", label, line: lineOf(m.index) };
    elements.push(el);
    buttons.push(el);
  }

  // Material Symbols icon buttons: <span class="material-symbols...">icon_name</span>
  const iconBtnRe = /<span\s+class=["'][^"']*material-symbols[^"']*["'][^>]*>([^<]+)<\/span>/gis;
  while ((m = iconBtnRe.exec(html)) !== null) {
    const label = m[1].trim();
    if (!label) continue;
    const el: InteractiveElement = { type: "button", label: `[icon: ${label}]`, line: lineOf(m.index) };
    elements.push(el);
    buttons.push(el);
  }

  // Inputs: <input .../>, <textarea>, <select>
  const inputRe = /<(input|textarea|select)\s([^>]*)(?:\/?>)/gis;
  while ((m = inputRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const typeMatch = attrs.match(/type=["']([^"']+)["']/i);
    const placeholderMatch = attrs.match(/placeholder=["']([^"']+)["']/i);
    const inputType = typeMatch ? typeMatch[1] : (tag === "textarea" ? "textarea" : tag === "select" ? "select" : "text");
    const el: InteractiveElement = {
      type: "input",
      label: placeholderMatch ? placeholderMatch[1] : inputType,
      inputType,
      placeholder: placeholderMatch ? placeholderMatch[1] : undefined,
      line: lineOf(m.index),
    };
    elements.push(el);
    inputs.push(el);
  }

  // Forms: <form ...>
  const formRe = /<form\s/gi;
  while ((m = formRe.exec(html)) !== null) {
    const el: InteractiveElement = { type: "form", label: "form", line: lineOf(m.index) };
    elements.push(el);
  }

  // Hardcoded data detection: known fake names
  const fakeMatches = html.match(FAKE_NAME_RE);
  if (fakeMatches) {
    for (const fm of fakeMatches) {
      if (!hardcodedData.includes(fm)) hardcodedData.push(fm);
    }
  }

  // Detect DnD keywords
  const lowerHtml = html.toLowerCase();
  const requiresDragDrop = /\b(drag|sortable|reorder|draggable|drop-zone|dropzone)\b/.test(lowerHtml);

  // Detect router need: 2+ navigation links with distinct hrefs
  const uniqueHrefs = new Set(navigation.map(n => n.href).filter(h => h && h !== "#" && !h.startsWith("javascript:")));
  const requiresRouter = uniqueHrefs.size >= 2;

  return {
    screenId: screenId || "unknown",
    screenTitle: extractTitle(html) || screenId || "Untitled",
    deviceType: detectDeviceType(html),
    elements,
    navigation,
    buttons,
    inputs,
    hardcodedData,
    totalInteractive: elements.length,
    requiresRouter,
    requiresDragDrop,
  };
}

// --- Build contracts from DESIGN_MANIFEST.json ---

export function buildDesignContracts(repoPath: string): DesignContract[] {
  const stitchDir = path.join(repoPath, "stitch");
  const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");

  if (!fs.existsSync(manifestPath)) {
    // Fallback: parse all HTML files in stitch/
    return parseAllHTMLFiles(stitchDir);
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const contracts: DesignContract[] = [];

    const screens = manifest.screens || manifest.pages || [];
    for (const screen of screens) {
      const htmlFile = screen.html || screen.file || `${screen.id || screen.name}.html`;
      const htmlPath = path.join(stitchDir, htmlFile);
      if (!fs.existsSync(htmlPath)) continue;

      const html = fs.readFileSync(htmlPath, "utf-8");
      if (!html.trim()) continue; // Skip 0-byte files

      const contract = parseDesignHTML(html, screen.id || screen.name);
      contract.screenTitle = screen.title || screen.name || contract.screenTitle;
      if (screen.device) contract.deviceType = screen.device.toUpperCase() as any;
      contracts.push(contract);
    }

    if (contracts.length === 0) {
      logger.warn("[design-contract] No design contracts generated — all HTML files empty or missing");
    }
    return contracts;
  } catch (e) {
    logger.warn(`[design-contract] Failed to read manifest: ${String(e)}`);
    return parseAllHTMLFiles(stitchDir);
  }
}

function parseAllHTMLFiles(stitchDir: string): DesignContract[] {
  if (!fs.existsSync(stitchDir)) return [];

  const contracts: DesignContract[] = [];
  try {
    const files = fs.readdirSync(stitchDir).filter(f => f.endsWith(".html"));
    for (const file of files) {
      const html = fs.readFileSync(path.join(stitchDir, file), "utf-8");
      if (!html.trim()) continue;
      const screenId = path.basename(file, ".html");
      contracts.push(parseDesignHTML(html, screenId));
    }
  } catch {}
  return contracts;
}

// --- Generate human-readable UI Contract ---

export function generateUIContract(contracts: DesignContract[]): string {
  if (contracts.length === 0) return "";

  const lines: string[] = [];
  let totalNav = 0, totalBtn = 0, totalInput = 0;
  let needsRouter = false, needsDnD = false;

  for (const c of contracts) {
    lines.push(`\n[${c.screenTitle}] (${c.deviceType})`);

    if (c.navigation.length > 0) {
      lines.push(`  Navigation (${c.navigation.length}):`);
      for (const n of c.navigation) {
        lines.push(`    - "${n.label}" → ${n.href || "?"}`);
      }
      totalNav += c.navigation.length;
    }

    if (c.buttons.length > 0) {
      lines.push(`  Buttons (${c.buttons.length}):`);
      for (const b of c.buttons) {
        lines.push(`    - "${b.label}"`);
      }
      totalBtn += c.buttons.length;
    }

    if (c.inputs.length > 0) {
      lines.push(`  Inputs (${c.inputs.length}):`);
      for (const inp of c.inputs) {
        lines.push(`    - ${inp.inputType}: "${inp.placeholder || inp.label}"`);
      }
      totalInput += c.inputs.length;
    }

    if (c.hardcodedData.length > 0) {
      lines.push(`  ⚠ Hardcoded data: ${c.hardcodedData.join(", ")}`);
    }

    if (c.requiresRouter) needsRouter = true;
    if (c.requiresDragDrop) needsDnD = true;
  }

  const header = `UI CONTRACT: ${totalNav} nav links, ${totalBtn} buttons, ${totalInput} inputs across ${contracts.length} screen(s)`;
  const reqs: string[] = [];
  if (needsRouter) reqs.push("REQUIRES: react-router-dom");
  if (needsDnD) reqs.push("REQUIRES: DnD library (dnd-kit or react-beautiful-dnd)");

  return [header, ...reqs, ...lines].join("\n");
}

// --- Format for workflow template injection ---

export function formatUIContractForTemplate(contracts: DesignContract[]): string {
  return generateUIContract(contracts);
}

// --- Enrich stories with design-driven acceptance criteria ---

export function enrichStoriesWithDesignContract(
  db: ReturnType<typeof getDb>,
  runId: string,
  contracts: DesignContract[]
): void {
  const stories = db.prepare(
    "SELECT id, story_id, title, acceptance_criteria FROM stories WHERE run_id = ? AND status = 'pending'"
  ).all(runId) as Array<{ id: string; story_id: string; title: string; acceptance_criteria: string }>;

  if (stories.length === 0 || contracts.length === 0) return;

  // Build a flat list of all design requirements
  const allNav = contracts.flatMap(c => c.navigation);
  const allBtns = contracts.flatMap(c => c.buttons);
  const allInputs = contracts.flatMap(c => c.inputs);
  const needsRouter = contracts.some(c => c.requiresRouter);
  const needsDnD = contracts.some(c => c.requiresDragDrop);
  const allHardcoded = [...new Set(contracts.flatMap(c => c.hardcodedData))];

  for (const story of stories) {
    const titleLower = story.title.toLowerCase();
    const extraCriteria: string[] = [];

    // Match story to relevant design elements by keyword overlap
    for (const nav of allNav) {
      if (titleLower.includes(nav.label.toLowerCase().split(" ")[0]) || (nav.href && titleLower.includes(nav.href.replace(/\//g, "")))) {
        extraCriteria.push(`Navigation link "${nav.label}" → ${nav.href} MUST route to a real page/component`);
      }
    }

    for (const btn of allBtns) {
      const btnWord = btn.label.replace(/\[icon: |\]/g, "").toLowerCase().split(" ")[0];
      if (btnWord && titleLower.includes(btnWord)) {
        extraCriteria.push(`Button "${btn.label}" MUST have a functional onClick handler`);
      }
    }

    for (const inp of allInputs) {
      const inpWord = (inp.placeholder || inp.label).toLowerCase().split(" ")[0];
      if (inpWord && titleLower.includes(inpWord)) {
        extraCriteria.push(`Input "${inp.placeholder || inp.label}" MUST have controlled state (onChange + value)`);
      }
    }

    if (needsRouter && (titleLower.includes("nav") || titleLower.includes("route") || titleLower.includes("page"))) {
      extraCriteria.push("Install react-router-dom and configure routes for all navigation links");
    }

    if (needsDnD && (titleLower.includes("drag") || titleLower.includes("board") || titleLower.includes("kanban") || titleLower.includes("sort"))) {
      extraCriteria.push("Install and configure a DnD library (dnd-kit recommended) for drag-and-drop");
    }

    if (allHardcoded.length > 0) {
      extraCriteria.push(`Replace hardcoded names (${allHardcoded.slice(0, 3).join(", ")}) with dynamic props/state`);
    }

    // Limit to max 8 extra criteria per story
    const toAdd = extraCriteria.slice(0, 8);
    if (toAdd.length === 0) continue;

    const existingAC = story.acceptance_criteria || "";
    const separator = existingAC.endsWith("\n") ? "" : "\n";
    const designAC = toAdd.map(c => `- [DESIGN] ${c}`).join("\n");
    const updatedAC = existingAC + separator + "\n--- Design Contract Requirements ---\n" + designAC;

    db.prepare(
      "UPDATE stories SET acceptance_criteria = ?, updated_at = ? WHERE id = ?"
    ).run(updatedAC, new Date().toISOString(), story.id);
  }

  logger.info(`[design-contract] Enriched ${stories.length} stories with design criteria`, { runId });
}

// --- Design compliance validation (Faz 3) ---

export function validateDesignCompliance(repoPath: string): string[] {
  const issues: string[] = [];
  const stitchDir = path.join(repoPath, "stitch");

  if (!fs.existsSync(stitchDir)) return [];

  let htmlFiles: string[];
  try {
    htmlFiles = fs.readdirSync(stitchDir).filter(f => f.endsWith(".html"));
  } catch {
    return [];
  }

  for (const htmlFile of htmlFiles) {
    const htmlPath = path.join(stitchDir, htmlFile);
    let html: string;
    try {
      html = fs.readFileSync(htmlPath, "utf-8");
    } catch {
      continue;
    }
    if (!html.trim()) continue;

    // CRITICAL: Banned fonts
    if (/font-family:[^;]*\b(Inter|Roboto|Arial|system-ui|Helvetica)\b/i.test(html)) {
      issues.push(`CRITICAL: Banned font in ${htmlFile}`);
    }

    // CRITICAL: Emoji icons
    if (/[\u{1F300}-\u{1F9FF}]/u.test(html)) {
      issues.push(`CRITICAL: Emoji icon in ${htmlFile}`);
    }

    // WARNING: Purple gradient
    if (/linear-gradient[^;]*purple/i.test(html)) {
      issues.push(`WARNING: Purple gradient in ${htmlFile}`);
    }

    // WARNING: transition: all
    if (/transition:\s*all/i.test(html)) {
      issues.push(`WARNING: transition:all in ${htmlFile}`);
    }
  }

  return issues;
}

// --- Helpers ---

function stripTags(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return m ? m[1].trim() : "";
}

function detectDeviceType(html: string): "DESKTOP" | "MOBILE" | "TABLET" {
  // Check viewport meta for mobile hints
  const viewportMatch = html.match(/content=["'][^"']*width=(\d+)/i);
  if (viewportMatch) {
    const w = parseInt(viewportMatch[1], 10);
    if (w <= 480) return "MOBILE";
    if (w <= 1024) return "TABLET";
  }
  // Check max-width in style
  if (/max-width:\s*(320|375|390|414)px/i.test(html)) return "MOBILE";
  if (/max-width:\s*(768|834|1024)px/i.test(html)) return "TABLET";
  return "DESKTOP";
}
