#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoPath = process.argv[2];
if (!repoPath) {
  console.error("Usage: node generated-screen-validator.mjs <repo-path> [--fix] [--report <path>]");
  process.exit(1);
}

const reportArgIndex = process.argv.indexOf("--report");
const reportPath = reportArgIndex >= 0 && process.argv[reportArgIndex + 1]
  ? path.resolve(process.argv[reportArgIndex + 1])
  : path.join(repoPath, ".setfarm", "setup", "DESIGN_IMPORT_VALIDATE.json");
const shouldFix = process.argv.includes("--fix");

const screensDir = path.join(repoPath, "src", "screens");
const screenIndexPath = path.join(screensDir, "SCREEN_INDEX.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function normalizeRel(filePath) {
  return path.relative(repoPath, filePath).replace(/\\/g, "/");
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasQuotedOrExpressionLiteral(code, attrName, value) {
  const escaped = escapeRegExp(value);
  const literal = `(?:"${escaped}"|'${escaped}'|\\{\\s*(?:"${escaped}"|'${escaped}'|\\x60${escaped}\\x60)\\s*\\})`;
  return new RegExp(`(?:^|\\s)${escapeRegExp(attrName)}\\s*=\\s*${literal}`, "m").test(code);
}

function hasActionCallback(code, actionId) {
  const escaped = escapeRegExp(actionId);
  return new RegExp(`actions\\?\\.\\[\\s*(?:"${escaped}"|'${escaped}'|\\x60${escaped}\\x60)\\s*\\]`).test(code);
}

function hasJsxAttr(attrs, attrName) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(attrName)}(?:\\s*=|\\s|$)`, "i").test(attrs);
}

function isFormControlStateSafe(attrs, prop) {
  if (hasJsxAttr(attrs, "onChange") || hasJsxAttr(attrs, "onInput")) return true;
  if (hasJsxAttr(attrs, "readOnly") || hasJsxAttr(attrs, "disabled")) return true;
  if (prop === "value" && hasJsxAttr(attrs, "defaultValue")) return true;
  if (prop === "checked" && hasJsxAttr(attrs, "defaultChecked")) return true;
  return false;
}

function splitTailwindVariant(token) {
  let depth = 0;
  let splitAt = -1;
  for (let i = 0; i < token.length; i += 1) {
    const ch = token[i];
    if (ch === "[") depth += 1;
    if (ch === "]") depth = Math.max(0, depth - 1);
    if (ch === ":" && depth === 0) splitAt = i;
  }
  if (splitAt === -1) return { variant: "", base: token };
  return { variant: token.slice(0, splitAt), base: token.slice(splitAt + 1) };
}

function classTokens(classValue) {
  return String(classValue || "")
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);
}

function hasUnsafePositionedFullWidth(tokens) {
  const parsed = tokens.map(token => ({ token, ...splitTailwindVariant(token) }));
  const isPositioned = parsed.some(({ base }) => base === "fixed" || base === "absolute");
  if (!isPositioned) return false;

  const insetByVariant = new Map();
  for (const { variant, base } of parsed) {
    if (!insetByVariant.has(variant)) insetByVariant.set(variant, { left: false, right: false, insetX: false });
    const entry = insetByVariant.get(variant);
    if (/^-?left-(?:\[|[a-z0-9/.-])/.test(base)) entry.left = true;
    if (/^-?right-(?:\[|[a-z0-9/.-])/.test(base)) entry.right = true;
    if (/^-?inset-x-(?:\[|[a-z0-9/.-])/.test(base)) entry.insetX = true;
  }

  const hasHorizontalInset = (variant) => {
    const exact = insetByVariant.get(variant);
    const base = insetByVariant.get("");
    return Boolean(
      (exact && (exact.insetX || (exact.left && exact.right))) ||
      (variant && base && (base.insetX || (base.left && base.right))),
    );
  };

  return parsed.some(({ variant, base }) => {
    if (!["w-full", "w-screen", "min-w-full", "min-w-screen"].includes(base)) return false;
    return hasHorizontalInset(variant);
  });
}

function normalizeUnsafePositionedFullWidth(tokens) {
  if (!hasUnsafePositionedFullWidth(tokens)) return tokens;
  const blocked = new Set(["w-full", "w-screen", "min-w-full", "min-w-screen"]);
  return tokens.filter(token => !blocked.has(splitTailwindVariant(token).base));
}

function extractLucideImports(code) {
  const names = new Set();
  for (const match of code.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*["']lucide-react["']/g)) {
    String(match[1] || "")
      .split(",")
      .map(part => part.trim().split(/\s+as\s+/i)[0]?.trim())
      .filter(Boolean)
      .forEach(name => names.add(name));
  }
  return names;
}

function collectScreens() {
  const indexed = Array.isArray(readJson(screenIndexPath, null)) ? readJson(screenIndexPath, []) : [];
  if (indexed.length > 0) {
    return indexed
      .map(screen => ({
        title: screen.title || screen.componentName || screen.file,
        componentName: screen.componentName || "",
        actions: Array.isArray(screen.actions) ? screen.actions : [],
        filePath: path.join(repoPath, screen.file || ""),
      }))
      .filter(screen => screen.filePath && fs.existsSync(screen.filePath));
  }

  if (!fs.existsSync(screensDir)) return [];
  return fs.readdirSync(screensDir)
    .filter(file => file.endsWith(".tsx"))
    .map(file => ({
      title: file,
      componentName: path.basename(file, ".tsx"),
      actions: [],
      filePath: path.join(screensDir, file),
    }));
}

function failure(code, ruleId, filePath, message, detail = {}) {
  return {
    code,
    ruleId,
    file: normalizeRel(filePath),
    message,
    ...detail,
  };
}

function validateScreen(screen) {
  const failures = [];
  const code = fs.readFileSync(screen.filePath, "utf-8");

  if (/\sclass\s*=/.test(code) || /\sfor\s*=/.test(code)) {
    failures.push(failure(
      "DESIGN_IMPORT_INVALID_PROP",
      "DIV-001",
      screen.filePath,
      "Generated TSX still contains HTML-only class= or for= props.",
    ));
  }

  const invalidSvgAttrs = [
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-opacity",
    "fill-rule",
    "fill-opacity",
    "clip-rule",
    "stop-color",
    "stop-opacity",
    "font-family",
    "font-size",
    "font-weight",
    "patternunits",
    "patterncontentunits",
    "gradientunits",
    "gradienttransform",
    "maskunits",
    "maskcontentunits",
    "clippathunits",
    "xlink:href",
    "xmlns:xlink",
    "viewbox",
  ];
  for (const attr of invalidSvgAttrs) {
    if (new RegExp(`\\s${escapeRegExp(attr)}\\s*=`, "i").test(code)) {
      failures.push(failure(
        "DESIGN_IMPORT_INVALID_PROP",
        "DIV-001",
        screen.filePath,
        `Generated TSX still contains invalid React/SVG prop ${attr}.`,
        { prop: attr },
      ));
    }
  }

  const lucideNames = extractLucideImports(code);
  for (const iconName of lucideNames) {
    const iconPattern = new RegExp(`<${escapeRegExp(iconName)}\\b[^>]*\\stitle\\s*=`, "s");
    if (iconPattern.test(code)) {
      failures.push(failure(
        "DESIGN_IMPORT_ICON_PROP_INVALID",
        "DIV-002",
        screen.filePath,
        `Lucide icon ${iconName} has unsupported title prop.`,
        { component: iconName, prop: "title" },
      ));
    }
  }

  for (const match of code.matchAll(/\bclassName=(["'])([^"']*)\1/g)) {
    const tokens = classTokens(match[2]);
    if (hasUnsafePositionedFullWidth(tokens)) {
      failures.push(failure(
        "DESIGN_IMPORT_LAYOUT_UNSAFE",
        "DIV-003",
        screen.filePath,
        "Positioned element combines horizontal insets with full viewport/parent width utility.",
        { className: match[2] },
      ));
    }
  }

  for (const match of code.matchAll(/<(input|textarea|select)\b([^<>]*?)(\/?)>/gis)) {
    const element = String(match[1] || "").toLowerCase();
    const attrs = String(match[2] || "");
    for (const prop of ["value", "checked"]) {
      if (prop === "checked" && element !== "input") continue;
      if (!hasJsxAttr(attrs, prop)) continue;
      if (isFormControlStateSafe(attrs, prop)) continue;
      failures.push(failure(
        "DESIGN_IMPORT_CONTROLLED_INPUT_UNSAFE",
        "DIV-009",
        screen.filePath,
        `Generated ${element} uses ${prop}= without onChange, readOnly, disabled, or a default* prop.`,
        { element, prop },
      ));
    }
  }

  if (/\/\/\s*@ts-ignore|\/\/\s*@ts-expect-error/.test(code)) {
    failures.push(failure(
      "DESIGN_IMPORT_TS_SUPPRESSION",
      "DIV-006",
      screen.filePath,
      "Generated screen contains TypeScript suppression comments.",
    ));
  }

  if (screen.componentName) {
    const exportPattern = new RegExp(`export\\s+function\\s+${escapeRegExp(screen.componentName)}\\s*\\(`);
    if (!exportPattern.test(code)) {
      failures.push(failure(
        "DESIGN_IMPORT_EXPORT_MISSING",
        "DIV-005",
        screen.filePath,
        `Generated screen does not export ${screen.componentName}.`,
        { componentName: screen.componentName },
      ));
    }
  }

  for (const action of screen.actions) {
    const id = String(action?.id || "");
    if (!id) continue;
    if (!hasQuotedOrExpressionLiteral(code, "data-action-id", id)) {
      failures.push(failure(
        "DESIGN_IMPORT_ACTION_ID_LOST",
        "DIV-007",
        screen.filePath,
        `Generated screen lost data-action-id for ${id}.`,
        { actionId: id },
      ));
    }
    if (!hasActionCallback(code, id)) {
      failures.push(failure(
        "DESIGN_IMPORT_ACTION_WIRING_LOST",
        "DIV-007",
        screen.filePath,
        `Generated screen lost typed action callback wiring for ${id}.`,
        { actionId: id },
      ));
    }
  }

  return failures;
}

const reactAttrMap = {
  class: "className",
  for: "htmlFor",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-miterlimit": "strokeMiterlimit",
  "stroke-dasharray": "strokeDasharray",
  "stroke-dashoffset": "strokeDashoffset",
  "stroke-opacity": "strokeOpacity",
  "fill-rule": "fillRule",
  "fill-opacity": "fillOpacity",
  "clip-rule": "clipRule",
  "stop-color": "stopColor",
  "stop-opacity": "stopOpacity",
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  patternunits: "patternUnits",
  patterncontentunits: "patternContentUnits",
  gradientunits: "gradientUnits",
  gradienttransform: "gradientTransform",
  maskunits: "maskUnits",
  maskcontentunits: "maskContentUnits",
  clippathunits: "clipPathUnits",
  "xlink:href": "xlinkHref",
  "xmlns:xlink": "xmlnsXlink",
  viewbox: "viewBox",
};

function autoFixScreen(screen) {
  let code = fs.readFileSync(screen.filePath, "utf-8");
  const before = code;
  const applied = [];

  for (const [from, to] of Object.entries(reactAttrMap)) {
    const next = code.replace(new RegExp(`\\s${escapeRegExp(from)}\\s*=`, "gi"), ` ${to}=`);
    if (next !== code) applied.push({ ruleId: "CONV-001", file: normalizeRel(screen.filePath), from, to });
    code = next;
  }

  const lucideNames = extractLucideImports(code);
  for (const iconName of lucideNames) {
    const next = code.replace(new RegExp(`<${escapeRegExp(iconName)}\\b([^>]*)>`, "gs"), (tag) => {
      return tag.replace(/\s+title=(?:"[^"]*"|'[^']*'|\{[^}]*\})/g, "");
    });
    if (next !== code) applied.push({ ruleId: "CONV-002", file: normalizeRel(screen.filePath), component: iconName, droppedProp: "title" });
    code = next;
  }

  code = code.replace(/\bclassName=(["'])([^"']*)\1/g, (full, quote, classValue) => {
    const tokens = classTokens(classValue);
    const normalized = normalizeUnsafePositionedFullWidth(tokens);
    if (normalized.length === tokens.length) return full;
    applied.push({
      ruleId: "CONV-003",
      file: normalizeRel(screen.filePath),
      before: classValue,
      after: normalized.join(" "),
    });
    return `className=${quote}${normalized.join(" ")}${quote}`;
  });

  code = code.replace(/<(input|textarea|select)\b([^<>]*?)(\/?)>/gis, (full, tag, attrs, selfClose) => {
    let nextAttrs = String(attrs || "");
    const element = String(tag || "").toLowerCase();
    let changed = false;

    if (hasJsxAttr(nextAttrs, "value") && !isFormControlStateSafe(nextAttrs, "value")) {
      nextAttrs = nextAttrs.replace(/\svalue\s*=/i, " defaultValue=");
      changed = true;
      applied.push({ ruleId: "CONV-004", file: normalizeRel(screen.filePath), element, from: "value", to: "defaultValue" });
    }

    if (element === "input" && hasJsxAttr(nextAttrs, "checked") && !isFormControlStateSafe(nextAttrs, "checked")) {
      nextAttrs = nextAttrs.replace(/\schecked\s*=/i, " defaultChecked=");
      changed = true;
      applied.push({ ruleId: "CONV-004", file: normalizeRel(screen.filePath), element, from: "checked", to: "defaultChecked" });
    }

    if (!changed) return full;
    return `<${tag}${nextAttrs.replace(/\s+$/g, "")}${selfClose ? " />" : ">"}`;
  });

  if (code !== before) {
    fs.writeFileSync(screen.filePath, code);
  }
  return applied;
}

let screens = collectScreens();
let fixesApplied = [];
if (shouldFix && screens.length > 0) {
  fixesApplied = screens.flatMap(autoFixScreen);
  screens = collectScreens();
}
const failures = screens.flatMap(validateScreen);
const report = {
  schema: "setfarm.design-import-validate.v1",
  status: screens.length === 0 ? "skipped" : failures.length > 0 ? "fail" : "pass",
  rootCauseCategory: failures.length > 0 ? "design_import_failure" : "none",
  checkedAt: new Date().toISOString(),
  fixMode: shouldFix,
  fixesApplied,
  screensValidated: screens.map(screen => normalizeRel(screen.filePath)),
  failedRules: failures,
  repairTargets: [
    "scripts/stitch-to-jsx.mjs",
    "scripts/generated-screen-validator.mjs",
    "src/screens/*.tsx",
  ],
  suggestedCommands: [
    "node scripts/generated-screen-validator.mjs <repo-path> --fix",
    "npm run build",
  ],
  summary: {
    screenCount: screens.length,
    failureCount: failures.length,
  },
};

writeReport(report);

if (failures.length > 0) {
  console.error(`DESIGN_IMPORT_VALIDATE failed with ${failures.length} issue(s). Report: ${normalizeRel(reportPath)}`);
  for (const item of failures.slice(0, 12)) {
    console.error(`${item.code} ${item.ruleId} ${item.file}: ${item.message}`);
  }
  process.exit(1);
}

console.log(`DESIGN_IMPORT_VALIDATE ${report.status} (${screens.length} screen(s)); report: ${normalizeRel(reportPath)}`);
