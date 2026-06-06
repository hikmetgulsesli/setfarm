import fs from "node:fs";
import path from "node:path";
import { normalizeControlText } from "./checklist.js";
import type {
  SupervisorChecklist,
  SupervisorChecklistItem,
  SupervisorEvidenceStatus,
  SupervisorFinding,
  SupervisorScanResult,
} from "./types.js";

type JsxBlock = {
  tag: string;
  attrs: string;
  inner: string;
  block: string;
  index: number;
};

export function scanSupervisorChecklist(workdir: string, checklist: SupervisorChecklist, scopeFiles: string[] = []): SupervisorScanResult {
  const scoped = new Set(scopeFiles.map(normalizePath).filter(Boolean));
  const findings: SupervisorFinding[] = [];
  for (const item of checklist.items) {
    if (scoped.size > 0 && !item.scopeFiles.some((file) => scoped.has(normalizePath(file)))) continue;
    findings.push(scanItem(workdir, item));
  }
  return {
    checklist,
    findings,
    blockers: findings.filter((finding) => finding.status !== "passed" && finding.severity === "blocker"),
    warnings: findings.filter((finding) => finding.status !== "passed" && finding.severity === "warning"),
    passed: findings.filter((finding) => finding.status === "passed"),
  };
}

export function formatSupervisorFindings(findings: SupervisorFinding[]): string[] {
  return findings.map((finding) => {
    const location = finding.line ? `${finding.files[0] || "unknown"}:${finding.line}` : (finding.files[0] || "unknown");
    return `${location} ${finding.message}`;
  });
}

function scanItem(workdir: string, item: SupervisorChecklistItem): SupervisorFinding {
  const now = new Date().toISOString();
  const abs = path.join(workdir, item.file);
  let source = "";
  try {
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) source = fs.readFileSync(abs, "utf-8");
  } catch {
    source = "";
  }
  if (!source) {
    return finding(item, "missing", [], `SUPERVISOR_CHECKLIST ${describeItem(item)} file is missing`, now);
  }

  const tags = blocksForItem(source, item);
  const match = tags.find((block) => blockMatchesItem(block, item, source));
  if (!match) {
    if (item.type === "button" && isDisplayOnlyItem(item, source)) {
      return finding(item, "passed", [item.label || ""], `SUPERVISOR_CHECKLIST display-only ${describeItem(item)} passed visible text evidence`, now);
    }
    return finding(item, "missing", [], `SUPERVISOR_CHECKLIST missing ${describeItem(item)} on ${item.screen}`, now);
  }

  if (item.type === "button" && !buttonIsActionable(match) && !isDisplayOnlyItem(item, source)) {
    return finding(item, "static", [visibleText(match)], `SUPERVISOR_CHECKLIST ${describeItem(item)} is static or lacks handler/disabled/submit state`, now, source, match.index);
  }

  if (item.type === "link") {
    const actualHref = attrValue(match.attrs, "href");
    if (item.href && actualHref === null) {
      return finding(item, "dead-href", [visibleText(match)], `SUPERVISOR_CHECKLIST ${describeItem(item)} lacks href="${item.href}"`, now, source, match.index);
    }
    if (isDeadHrefValue(actualHref) && !isExplicitlyInertAnchor(match.attrs) && !/\bonClick\s*=/.test(match.attrs)) {
      return finding(item, "dead-href", [visibleText(match)], `SUPERVISOR_CHECKLIST ${describeItem(item)} uses a dead href without aria-current/aria-disabled or handler`, now, source, match.index);
    }
    if (actualHref && /https?:\/\/https?\/\//i.test(actualHref)) {
      return finding(item, "malformed-url", [actualHref], `SUPERVISOR_CHECKLIST ${describeItem(item)} has malformed href "${actualHref}"`, now, source, match.index);
    }
  }

  if (item.type === "icon" && item.icon && !blockHasIcon(match, item.icon)) {
    return finding(item, "icon-missing", [visibleText(match)], `SUPERVISOR_CHECKLIST ${describeItem(item)} is missing expected icon "${item.icon}"`, now, source, match.index);
  }

  if ((item.type === "input" || item.type === "select") && !inputLooksLikeItem(match, item)) {
    return finding(item, "missing", [visibleText(match)], `SUPERVISOR_CHECKLIST missing ${describeItem(item)} on ${item.screen}`, now, source, match.index);
  }

  return finding(item, "passed", [visibleText(match)], `SUPERVISOR_CHECKLIST ${describeItem(item)} passed scanner evidence`, now, source, match.index);
}

function blocksForItem(source: string, item: SupervisorChecklistItem): JsxBlock[] {
  if (item.type === "button" || item.type === "icon") {
    return [...extractJsxBlocks(source, "button"), ...extractJsxBlocks(source, "a")];
  }
  if (item.type === "link" || item.type === "nav") return extractJsxBlocks(source, "a");
  if (item.type === "select") return extractJsxBlocks(source, "select");
  if (item.type === "input") {
    return [
      ...extractJsxBlocks(source, "input"),
      ...extractJsxBlocks(source, "textarea"),
      ...extractJsxBlocks(source, "select"),
    ];
  }
  return [
    ...extractJsxBlocks(source, "button"),
    ...extractJsxBlocks(source, "a"),
    ...extractJsxBlocks(source, "input"),
    ...extractJsxBlocks(source, "select"),
  ];
}

function extractJsxBlocks(source: string, tag: string): JsxBlock[] {
  const blocks: JsxBlock[] = [];
  const openClose = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = openClose.exec(source)) !== null) {
    if (isInsideJsxBlockComment(source, match.index)) continue;
    blocks.push({ tag, attrs: match[1] || "", inner: match[2] || "", block: match[0], index: match.index });
  }
  const selfClosing = new RegExp(`<${tag}\\b([^>]*)\\/?>`, "gi");
  while ((match = selfClosing.exec(source)) !== null) {
    if (match[0].includes(`</${tag}>`)) continue;
    if (isInsideJsxBlockComment(source, match.index)) continue;
    blocks.push({ tag, attrs: match[1] || "", inner: "", block: match[0], index: match.index });
  }
  return blocks.sort((a, b) => a.index - b.index);
}

function isInsideJsxBlockComment(source: string, index: number): boolean {
  const before = source.slice(0, Math.max(0, index));
  return before.lastIndexOf("{/*") > before.lastIndexOf("*/}");
}

function blockMatchesItem(block: JsxBlock, item: SupervisorChecklistItem, source: string): boolean {
  if (item.label && blockHasVisibleText(block, item.label)) return true;
  if (item.label && blockHasAccessibleLabel(block, item.label)) return true;
  if (item.href && attrValue(block.attrs, "href") === item.href) return true;
  if (item.icon && blockHasIcon(block, item.icon)) return true;
  if ((item.type === "button" || item.type === "link" || item.type === "icon") && blockMatchesClassSignature(block, item)) return true;
  if (item.type === "input" || item.type === "select") return inputLooksLikeItem(block, item);
  if (item.label && sourceHasVisibleControlText(source, item.label)) return block.block.includes(item.label);
  return false;
}

function inputLooksLikeItem(block: JsxBlock, item: SupervisorChecklistItem): boolean {
  const expected = normalizeControlText(item.label || item.action || item.href || "");
  if (!expected) return true;
  const haystack = normalizeControlText([
    block.tag,
    block.attrs,
    attrValue(block.attrs, "type") || "",
    attrValue(block.attrs, "placeholder") || "",
    attrValue(block.attrs, "aria-label") || "",
    attrValue(block.attrs, "name") || "",
    attrValue(block.attrs, "id") || "",
  ].join(" "));
  return haystack.includes(expected) || expected.includes(haystack);
}

function buttonIsActionable(block: JsxBlock): boolean {
  const attrs = block.attrs;
  const isDisabled = booleanAttrIsTruthy(attrs, "disabled") || booleanAttrIsTruthy(attrs, "aria-disabled");
  const isSubmit = /\btype\s*=\s*(?:"submit"|'submit'|\{\s*["']submit["']\s*\})/i.test(attrs);
  const hasHandler = /\bon(?:Click|PointerDown|PointerUp|MouseDown|MouseUp|TouchStart|TouchEnd|KeyDown|Submit)\s*=/.test(attrs);
  return isDisabled || isSubmit || hasHandler;
}

function booleanAttrIsTruthy(attrs: string, name: string): boolean {
  const match = new RegExp(`\\b${name}\\b(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*([^}]+?)\\s*\\}))?`, "i").exec(attrs);
  if (!match) return false;
  const value = (match[1] ?? match[2] ?? match[3] ?? "").trim().toLowerCase();
  if (!value) return true;
  return !["false", "0", "null", "undefined"].includes(value);
}

function isDisplayOnlyItem(item: SupervisorChecklistItem, source: string): boolean {
  if (!item.label) return false;
  if (item.href) return false;
  if (item.action && (!isGenericDesignClickAction(item.action) || !isLikelyDisplayOnlyLabel(item.label))) return false;
  const normalized = normalizeControlText(item.label);
  if (!normalized) return false;
  const titleLike = normalized.split(/\s+/).length <= 4 && !/\b(start|save|cancel|delete|open|close|next|back|play|pause|submit|create)\b/.test(normalized);
  return titleLike && sourceHasDisplayOnlyEvidence(source, item.label);
}

function isGenericDesignClickAction(action: string): boolean {
  return /^click(?:[-_\s]?action)?$/i.test(String(action || "").trim());
}

function isLikelyDisplayOnlyLabel(label: string): boolean {
  const normalized = normalizeControlText(label);
  if (!normalized) return false;
  if (/^(?:[a-z]{1,3}|[a-z](?:\s+[a-z]){1,3})$/i.test(normalized)) return true;
  return /\b(brand|logo|avatar|profile|person|user|account|manager|command|matrix)\b/.test(normalized);
}

function blockHasVisibleText(block: JsxBlock, label: string): boolean {
  const expected = normalizeControlText(label);
  if (!expected) return false;
  const visible = normalizeControlText(visibleText(block));
  if (!visible) return false;
  return visible === expected || visible.includes(expected) || expected.includes(visible);
}

function blockHasAccessibleLabel(block: JsxBlock, label: string): boolean {
  const expected = normalizeControlText(label);
  if (!expected) return false;
  const value = normalizeControlText([
    attrValue(block.attrs, "aria-label") || "",
    attrValue(block.attrs, "title") || "",
    attrValue(block.attrs, "name") || "",
    attrValue(block.attrs, "id") || "",
  ].join(" "));
  if (!value) return false;
  return value === expected || value.includes(expected) || expected.includes(value);
}

function sourceHasVisibleControlText(source: string, label: string): boolean {
  const expected = normalizeControlText(label);
  if (!expected) return false;
  const visible = normalizeControlText(stripJsxBlockComments(source).replace(/<[^>]+>/g, " "));
  return visible.includes(expected);
}

function stripJsxBlockComments(source: string): string {
  return source.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
}

function sourceHasDisplayOnlyEvidence(source: string, label: string): boolean {
  if (sourceHasVisibleControlText(source, label)) return true;
  const expected = normalizeIcon(label);
  if (!expected) return false;
  if (!/\b(person|profile|avatar|user|account)\b/i.test(label)) return false;
  const normalizedSource = normalizeIcon(source);
  return iconCandidates(expected).some((candidate) => normalizedSource.includes(candidate));
}

function visibleText(block: JsxBlock): string {
  return block.inner
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function blockHasIcon(block: JsxBlock, icon: string): boolean {
  const expected = normalizeIcon(icon);
  if (!expected) return false;
  const candidates = iconCandidates(icon);
  const raw = `${block.attrs}\n${block.inner}`;
  const normalized = normalizeIcon(raw);
  if (candidates.some((candidate) => normalized.includes(candidate))) return true;
  return candidates.some((candidate) => new RegExp(`\\b${escapeRegex(candidate)}\\b`, "i").test(raw));
}

function blockMatchesClassSignature(block: JsxBlock, item: SupervisorChecklistItem): boolean {
  const expected = (item.classes || []).map(normalizeClassToken).filter(Boolean);
  if (expected.length === 0) return false;
  const actual = new Set(extractClassTokens(block.attrs).map(normalizeClassToken).filter(Boolean));
  if (actual.size === 0) return false;
  const strong = expected.filter((token) => !isWeakClassToken(token));
  const candidates = strong.length >= 3 ? strong : expected;
  const hits = candidates.filter((token) => actual.has(token)).length;
  if (hits < Math.min(3, candidates.length)) return false;
  return hits / Math.max(1, candidates.length) >= 0.45;
}

function extractClassTokens(attrs: string): string[] {
  const tokens: string[] = [];
  const rx = /\bclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let match: RegExpExecArray | null;
  while ((match = rx.exec(attrs)) !== null) {
    tokens.push(...String(match[1] ?? match[2] ?? "").split(/\s+/).filter(Boolean));
  }
  return tokens;
}

function normalizeClassToken(value: string): string {
  return String(value || "").trim();
}

function isWeakClassToken(value: string): boolean {
  return /^(flex|grid|block|hidden|relative|absolute|fixed|items-|justify-|text-|bg-|border$|border-|rounded-|p[trblxy]?-\d|m[trblxy]?-\d|w-|h-|gap-|transition|transition-|duration-)/.test(value);
}

function iconCandidates(icon: string): string[] {
  const normalized = normalizeIcon(icon);
  const aliases: Record<string, string[]> = {
    analytics: ["barchart3", "chartbar", "linechart"],
    assignmentreturn: ["packagecheck", "undo2", "clipboardcheck"],
    calendartoday: ["calendardays", "calendar"],
    dashboard: ["layoutdashboard", "gauge", "home"],
    description: ["filetext", "scrolltext"],
    filterlist: ["listfilter", "filter"],
    inventory2: ["packagesearch", "archive", "package", "boxes"],
    notifications: ["bell", "bellring"],
    policy: ["shieldalert", "shieldcheck"],
    searchoff: ["searchx", "search"],
    sort: ["arrowupdown", "arrowdownup", "listfilter"],
    tune: ["slidershorizontal", "settings2", "listfilter"],
    widgets: ["boxes", "layoutgrid", "grid3x3"],
    sportsesports: ["gamepad2", "gamepad", "joystick"],
    playcircle: ["circleplay", "playcircle", "play"],
    menubook: ["bookopen", "book", "library"],
    arrowdropup: ["chevronup", "arrowup"],
    arrowdropdown: ["chevrondown", "arrowdown"],
    restartalt: ["rotateccw", "refreshcw", "refreshccw", "redo", "replay"],
    logout: ["logouted", "log-out", "logout", "dooropen"],
    terminal: ["terminal"],
    emojievents: ["trophy", "award"],
    arrowback: ["arrowleft", "chevronleft"],
    close: ["x", "circlex", "xicon"],
    person: ["user", "circleuserround", "accountcircle", "person"],
    user: ["user", "circleuserround", "accountcircle", "person"],
    accountcircle: ["accountcircle", "circleuserround", "user", "person"],
  };
  return [...new Set([normalized, ...(aliases[normalized] || []).map(normalizeIcon)])].filter(Boolean);
}

function normalizeIcon(value: string): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function attrValue(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*["']([^"']*)["']\\s*\\})`, "i").exec(attrs);
  if (!match) return null;
  return (match[1] ?? match[2] ?? match[3] ?? "").trim();
}

function isDeadHrefValue(value: string | null): boolean {
  if (value === null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "#" || normalized.startsWith("javascript:void(0)");
}

function isExplicitlyInertAnchor(attrs: string): boolean {
  return booleanAttrIsTruthy(attrs, "aria-current")
    || booleanAttrIsTruthy(attrs, "aria-disabled")
    || booleanAttrIsTruthy(attrs, "disabled");
}

function finding(
  item: SupervisorChecklistItem,
  status: SupervisorEvidenceStatus,
  observed: string[],
  message: string,
  checkedAt: string,
  source = "",
  index = -1,
): SupervisorFinding {
  return {
    itemId: item.id,
    storyId: item.storyId,
    status,
    severity: item.severity,
    observed: observed.filter(Boolean),
    lastScan: "static-control-scan",
    files: [item.file],
    line: source && index >= 0 ? lineForIndex(source, index) : undefined,
    message,
    checkedAt,
  };
}

function describeItem(item: SupervisorChecklistItem): string {
  const label = item.label || item.href || item.icon || item.id;
  return `${item.type} "${label}"`;
}

function lineForIndex(source: string, index: number): number {
  return source.slice(0, Math.max(0, index)).split(/\r?\n/).length;
}

function normalizePath(value: string): string {
  return String(value || "").replace(/\\/g, "/").replace(/^\.\/+/, "").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
