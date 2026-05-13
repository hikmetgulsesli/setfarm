#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoPath = process.argv[2];
if (!repoPath) { console.error("Usage: node stitch-to-jsx.mjs <repo-path>"); process.exit(1); }

const stitchDir = path.join(repoPath, "stitch");
const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
if (!fs.existsSync(manifestPath)) { console.log("No DESIGN_MANIFEST.json — skipping"); process.exit(0); }

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
const screensDir = path.join(repoPath, "src", "screens");
fs.mkdirSync(screensDir, { recursive: true });
const MIN_STITCH_HTML_BYTES = 1000;

function isPrdPseudoScreen(screen) {
  const title = String(screen?.title || screen?.name || "").trim().toLowerCase();
  const htmlFile = String(screen?.htmlFile || "").trim().toLowerCase();
  const screenId = String(screen?.screenId || screen?.id || "").trim().toLowerCase();
  return /\b(?:prd|requirements?)\b/.test(`${screenId} ${title} ${htmlFile}`);
}

function isValidStitchHtml(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    if (fs.statSync(filePath).size < MIN_STITCH_HTML_BYTES) return false;
    const head = fs.readFileSync(filePath, "utf-8").slice(0, 4000).toLowerCase();
    if (!head.includes("<html") && !head.includes("<!doctype")) return false;
    if (head.includes("empty html") || head.includes("design not generated")) return false;
    return true;
  } catch {
    return false;
  }
}

function findScreenHtml(screen) {
  const candidates = [
    screen?.htmlFile,
    screen?.screenId ? `${screen.screenId}.html` : "",
  ].filter(Boolean);
  return candidates.map(file => path.join(stitchDir, file)).find(isValidStitchHtml);
}

const JSX_ATTRIBUTE_MAP = {
  "accept-charset": "acceptCharset",
  "allowfullscreen": "allowFullScreen",
  "autocomplete": "autoComplete",
  "autofocus": "autoFocus",
  "class": "className",
  "colspan": "colSpan",
  "contenteditable": "contentEditable",
  "crossorigin": "crossOrigin",
  "datetime": "dateTime",
  "enctype": "encType",
  "for": "htmlFor",
  "formaction": "formAction",
  "formenctype": "formEncType",
  "formmethod": "formMethod",
  "formnovalidate": "formNoValidate",
  "formtarget": "formTarget",
  "http-equiv": "httpEquiv",
  "maxlength": "maxLength",
  "minlength": "minLength",
  "novalidate": "noValidate",
  "playsinline": "playsInline",
  "readonly": "readOnly",
  "rowspan": "rowSpan",
  "srcset": "srcSet",
  "tabindex": "tabIndex",
  "usemap": "useMap",
  "viewbox": "viewBox",
  "preserveaspectratio": "preserveAspectRatio",
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
  "patternunits": "patternUnits",
  "patterncontentunits": "patternContentUnits",
  "gradientunits": "gradientUnits",
  "gradienttransform": "gradientTransform",
  "maskunits": "maskUnits",
  "maskcontentunits": "maskContentUnits",
  "clippathunits": "clipPathUnits",
  "xlink:href": "xlinkHref",
  "xmlns:xlink": "xmlnsXlink",
};

const JSX_TAG_MAP = {
  "lineargradient": "linearGradient",
  "radialgradient": "radialGradient",
  "clippath": "clipPath",
  "foreignobject": "foreignObject",
  "textpath": "textPath",
  "pattern": "pattern",
};

const NUMERIC_JSX_ATTRIBUTES = new Set([
  "aria-colcount",
  "aria-colindex",
  "aria-colspan",
  "aria-level",
  "aria-posinset",
  "aria-rowcount",
  "aria-rowindex",
  "aria-rowspan",
  "aria-setsize",
  "aria-valuemax",
  "aria-valuemin",
  "aria-valuenow",
  "colSpan",
  "cols",
  "maxLength",
  "minLength",
  "rowSpan",
  "rows",
  "size",
  "span",
  "start",
  "tabIndex",
]);

const BOOLEAN_JSX_ATTRIBUTES = new Set([
  "allowFullScreen",
  "async",
  "autoFocus",
  "autoPlay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "formNoValidate",
  "hidden",
  "loop",
  "multiple",
  "muted",
  "noValidate",
  "open",
  "playsInline",
  "readOnly",
  "required",
  "reversed",
  "selected",
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeJsxAttributeNames(input) {
  let out = input;
  for (const [htmlAttr, jsxAttr] of Object.entries(JSX_ATTRIBUTE_MAP)) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(htmlAttr)}=`, "gi"), `${jsxAttr}=`);
  }
  return out;
}

function normalizeJsxTagNames(input) {
  let out = input;
  for (const [htmlTag, jsxTag] of Object.entries(JSX_TAG_MAP)) {
    out = out.replace(new RegExp(`<\\s*${escapeRegExp(htmlTag)}\\b`, "gi"), `<${jsxTag}`);
    out = out.replace(new RegExp(`<\\/\\s*${escapeRegExp(htmlTag)}\\s*>`, "gi"), `</${jsxTag}>`);
  }
  return out;
}

function normalizeJsxAttributeValues(input) {
  let out = input;
  for (const attr of NUMERIC_JSX_ATTRIBUTES) {
    out = out.replace(
      new RegExp(`\\b${escapeRegExp(attr)}=["'](-?\\d+(?:\\.\\d+)?)["']`, "g"),
      `${attr}={$1}`,
    );
  }
  for (const attr of BOOLEAN_JSX_ATTRIBUTES) {
    out = out.replace(
      new RegExp(`\\b${escapeRegExp(attr)}=["']\\s*["']`, "gi"),
      `${attr}={true}`,
    );
    out = out.replace(
      new RegExp(`\\b${escapeRegExp(attr)}=["'](?:true|${escapeRegExp(attr)})["']`, "gi"),
      `${attr}={true}`,
    );
    out = out.replace(
      new RegExp(`\\b${escapeRegExp(attr)}=["']false["']`, "gi"),
      `${attr}={false}`,
    );
  }
  return out;
}

function normalizeHtmlComments(input) {
  return input.replace(/<!--([\s\S]*?)-->/g, (_, body) => {
    const cleaned = String(body || "")
      .replace(/\*\//g, "* /")
      .trim();
    return cleaned ? `{/* ${cleaned} */}` : "{/* */}";
  });
}


function escapeTemplateLiteralContent(input) {
  return String(input || "")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

function normalizeStyleTagChildren(input) {
  return input.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_, attrs, css) => {
    const cleanAttrs = String(attrs || "").trimEnd();
    return `<style${cleanAttrs}>{\`${escapeTemplateLiteralContent(css)}\`}</style>`;
  });
}

function toReactStylePropertyKey(rawKey) {
  const cssKey = String(rawKey || "").trim();
  if (!cssKey) return "";
  if (cssKey.startsWith("--")) return JSON.stringify(cssKey);
  const jsKey = cssKey
    .replace(/^-ms-/, "ms-")
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return /^[A-Za-z_$][\w$]*$/.test(jsKey) ? jsKey : JSON.stringify(cssKey);
}

function inlineStyleToJsx(styleText) {
  let needsTypeEscape = false;
  const pairs = String(styleText || "")
    .split(";")
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => {
      const [rawKey, ...rawValue] = x.split(":");
      const cssKey = String(rawKey || "").trim();
      const key = toReactStylePropertyKey(cssKey);
      if (!key) return "";
      if (cssKey.startsWith("--")) needsTypeEscape = true;
      return `${key}: ${JSON.stringify(rawValue.join(":").trim())}`;
    })
    .filter(Boolean);
  const suffix = needsTypeEscape ? " as any" : "";
  return `style={{${pairs.join(", ")}}${suffix}}`;
}

function htmlToJsx(html) {
  let out = normalizeJsxAttributeValues(normalizeJsxAttributeNames(normalizeJsxTagNames(html)))
    .replace(/<(img|br|hr|input|meta|link)([^>]*?)>/gi, (_, tag, attrs) => {
      const cleanAttrs = String(attrs || "").replace(/\/\s*$/, "").trimEnd();
      return `<${tag}${cleanAttrs} />`;
    })
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]*\/?\s*>/gi, "")
    .replace(/<meta[^>]*\/?\s*>/gi, "")
    .replace(/style="([^"]+)"/g, (_, s) => inlineStyleToJsx(s));
  out = normalizeStyleTagChildren(out);
  return normalizeHtmlComments(out);
}

function extractBody(html) {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1].trim() : html;
}

function toComponentName(title) {
  return title
    .replace(/[ıİ]/g,"i").replace(/[şŞ]/g,"s").replace(/[çÇ]/g,"c")
    .replace(/[ğĞ]/g,"g").replace(/[üÜ]/g,"u").replace(/[öÖ]/g,"o")
    .replace(/[^a-zA-Z0-9\s]/g,"")
    .split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
}

function textFromHtml(input) {
  return String(input || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "and")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const MATERIAL_TO_LUCIDE = {
  account_circle: "CircleUserRound",
  add: "Plus",
  arrow_back: "ArrowLeft",
  arrow_downward: "ArrowDown",
  arrow_forward: "ArrowRight",
  arrow_left: "ArrowLeft",
  arrow_right: "ArrowRight",
  arrow_upward: "ArrowUp",
  auto_awesome: "Sparkles",
  calendar_month: "CalendarDays",
  check: "Check",
  chevron_left: "ChevronLeft",
  chevron_right: "ChevronRight",
  close: "X",
  delete: "Trash2",
  download: "Download",
  edit: "Pencil",
  exercise: "Dumbbell",
  filter_list: "ListFilter",
  gavel: "Gavel",
  home: "Home",
  info: "Info",
  menu: "Menu",
  more_horiz: "Ellipsis",
  more_vert: "EllipsisVertical",
  pause: "Pause",
  person: "User",
  play_arrow: "Play",
  refresh: "RefreshCw",
  rotate_right: "RotateCw",
  save: "Save",
  search: "Search",
  settings: "Settings",
  swords: "Swords",
  touch_app: "MousePointerClick",
  videogame_asset: "Gamepad2",
  view_timeline: "Activity",
  warning: "TriangleAlert",
};

function materialIconKey(inner) {
  return textFromHtml(inner).toLowerCase().replace(/\s+/g, "_");
}

function normalizeClassTokens(classValue) {
  return String(classValue || "")
    .split(/\s+/)
    .map(cls => (cls === "transition-all" ? "transition-colors" : cls))
    .filter(Boolean)
    .join(" ");
}

function normalizeDesignClassAttributes(html) {
  return String(html || "").replace(
    /\b(class|className)=(["'])([^"']*)\2/gi,
    (_match, attr, quote, value) => `${attr}=${quote}${normalizeClassTokens(value)}${quote}`,
  );
}

function collectClassTokens(html, out) {
  String(html || "").replace(/\b(?:class|className)=(["'])([^"']*)\1/gi, (_match, _quote, value) => {
    normalizeClassTokens(value).split(/\s+/).forEach(cls => {
      if (cls) out.add(cls);
    });
    return "";
  });
}

const STITCH_RUNTIME_CSS_START = "/* SETFARM_STITCH_RUNTIME_UTILITIES_START */";
const STITCH_RUNTIME_CSS_END = "/* SETFARM_STITCH_RUNTIME_UTILITIES_END */";

function cssEscapeSelector(cls) {
  return cls.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

function ruleForClass(cls) {
  const textScale = {
    "text-label-sm": "font-size: 0.75rem; line-height: 1rem;",
    "text-label-md": "font-size: 0.875rem; line-height: 1.25rem;",
    "text-body-md": "font-size: 1rem; line-height: 1.5rem;",
    "text-body-lg": "font-size: 1.125rem; line-height: 1.75rem;",
    "text-headline-md": "font-size: 1.5rem; line-height: 2rem;",
    "text-headline-lg": "font-size: 2rem; line-height: 2.4rem;",
    "text-display-lg": "font-size: clamp(2.5rem, 7vw, 4.5rem); line-height: 1;",
  };
  if (textScale[cls]) return `.${cssEscapeSelector(cls)} { ${textScale[cls]} }`;

  const fontScale = {
    "font-label-sm": "font-weight: 600; letter-spacing: 0.02em;",
    "font-label-md": "font-weight: 600; letter-spacing: 0.01em;",
    "font-body-md": "font-weight: 400;",
    "font-body-lg": "font-weight: 400;",
    "font-headline-md": "font-weight: 700;",
    "font-headline-lg": "font-weight: 800;",
    "font-display-lg": "font-weight: 900;",
  };
  if (fontScale[cls]) return `.${cssEscapeSelector(cls)} { ${fontScale[cls]} }`;

  const tetromino = cls.match(/^tetromino-([iotszjl])$/i);
  if (tetromino) {
    const key = tetromino[1].toLowerCase();
    const colors = {
      i: "#38bdf8",
      o: "#facc15",
      t: "#a855f7",
      s: "#22c55e",
      z: "#f97316",
      j: "#3b82f6",
      l: "#ef4444",
    };
    return `.${cssEscapeSelector(cls)} { background: var(--tetromino-${key}, ${colors[key]}); border: 1px solid color-mix(in srgb, var(--tetromino-${key}, ${colors[key]}) 72%, white); box-shadow: inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -2px 0 rgba(0,0,0,0.24); }`;
  }

  if (cls === "ghost-piece") return ".ghost-piece { background: transparent; border: 1px dashed rgba(248,250,252,0.45); opacity: 0.55; }";
  if (cls === "bg-grid") return ".bg-grid { background-image: linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px); background-size: 24px 24px; }";
  if (cls === "machined-border") return ".machined-border { border: 1px solid rgba(148,163,184,0.35); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 30px rgba(2,6,23,0.35); }";
  if (cls === "neon-glow-red") return ".neon-glow-red { box-shadow: 0 0 0 1px rgba(244,63,94,0.5), 0 0 24px rgba(244,63,94,0.28); }";
  if (cls === "min-touch") return ".min-touch { min-width: 44px; min-height: 44px; }";
  if (cls === "h-touch-target") return ".h-touch-target { height: 44px; }";
  if (cls === "w-grid-block") return ".w-grid-block { width: clamp(1.1rem, 5vw, 1.85rem); }";
  if (cls === "h-grid-block") return ".h-grid-block { height: clamp(1.1rem, 5vw, 1.85rem); }";
  if (cls === "px-gutter") return ".px-gutter { padding-left: clamp(1rem, 4vw, 2rem); padding-right: clamp(1rem, 4vw, 2rem); }";
  return "";
}

function buildRuntimeUtilityCss(classTokens) {
  const rules = [...classTokens].map(ruleForClass).filter(Boolean);
  const hasTetromino = [...classTokens].some(cls => /^tetromino-/i.test(cls));
  if (hasTetromino) {
    rules.unshift(
      ":root { --tetromino-i: #38bdf8; --tetromino-o: #facc15; --tetromino-t: #a855f7; --tetromino-s: #22c55e; --tetromino-z: #f97316; --tetromino-j: #3b82f6; --tetromino-l: #ef4444; }",
    );
  }
  if (rules.length === 0) return "";
  return [
    STITCH_RUNTIME_CSS_START,
    "/* Auto-generated by stitch-to-jsx.mjs for Stitch utility classes absent from the Tailwind baseline. */",
    "@layer utilities {",
    ...rules.map(rule => `  ${rule}`),
    "}",
    STITCH_RUNTIME_CSS_END,
  ].join("\n");
}

function ensureStitchRuntimeCss(repoPath, classTokens) {
  const block = buildRuntimeUtilityCss(classTokens);
  const stitchTokensPath = path.join(repoPath, "stitch", "design-tokens.css");
  if (!block && !fs.existsSync(stitchTokensPath)) return;

  const candidates = ["src/index.css", "src/main.css", "src/App.css", "app/globals.css"];
  let cssRel = candidates.find(rel => fs.existsSync(path.join(repoPath, rel)));
  if (!cssRel && fs.existsSync(path.join(repoPath, "src"))) cssRel = "src/index.css";
  if (!cssRel) return;

  const cssPath = path.join(repoPath, cssRel);
  if (!fs.existsSync(cssPath)) fs.writeFileSync(cssPath, "");
  let css = fs.readFileSync(cssPath, "utf-8");

  if (fs.existsSync(stitchTokensPath) && !css.includes("design-tokens.css")) {
    const relImport = path.relative(path.dirname(cssPath), stitchTokensPath).replace(/\\/g, "/");
    css = `@import '${relImport}';\n${css}`;
  }

  const blockPattern = new RegExp(`${escapeRegExp(STITCH_RUNTIME_CSS_START)}[\\s\\S]*?${escapeRegExp(STITCH_RUNTIME_CSS_END)}\\n?`, "m");
  css = css.replace(blockPattern, "").trimEnd();
  if (block) css = `${css}\n\n${block}\n`;
  fs.writeFileSync(cssPath, css.endsWith("\n") ? css : `${css}\n`);
}

function replaceMaterialSymbolSpans(html, lucideImports) {
  return String(html || "").replace(
    /<span\b([^>]*)\b(class|className)=(["'])([^"']*\b(?:material-symbols(?:-outlined)?|material-icons)\b[^"']*)\3([^>]*)>([\s\S]*?)<\/span>/gi,
    (_match, beforeClass, _classAttr, _quote, classValue, afterClass, inner) => {
      const iconName = materialIconKey(inner);
      const component = MATERIAL_TO_LUCIDE[iconName] || "Circle";
      lucideImports.add(component);
      const cleanedClass = normalizeClassTokens(classValue)
        .split(/\s+/)
        .filter(cls => cls && cls !== "material-icons" && !cls.startsWith("material-symbols"))
        .join(" ");
      const attrs = `${beforeClass || ""}${afterClass || ""}`.trimEnd();
      const classAttr = cleanedClass ? ` class="${cleanedClass}"` : "";
      return `<${component}${attrs}${classAttr} aria-hidden="true" focusable="false" />`;
    },
  );
}

function slugifyActionId(label, fallback) {
  const normalized = String(label || "")
    .replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g").replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return normalized || fallback;
}

function uniqueActionId(actions, base, index) {
  let id = `${base}-${index + 1}`;
  let n = 2;
  const used = new Set(actions.map((action) => action.id));
  while (used.has(id)) {
    id = `${base}-${index + 1}-${n++}`;
  }
  return id;
}

function annotateInteractiveElements(html) {
  const actions = [];
  let buttonIndex = 0;
  const annotated = String(html || "").replace(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi, (match, attrs, inner) => {
    const index = buttonIndex++;
    const label = textFromHtml(inner) || `Button ${index + 1}`;
    const base = slugifyActionId(label, "button");
    const id = uniqueActionId(actions, base, index);
    actions.push({ id, kind: "button", label, index });

    let cleanAttrs = String(attrs || "")
      .replace(/\sdata-action-id=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonclick=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonClick=\{[^}]*\}/g, "");
    if (!/\btype\s*=/.test(cleanAttrs)) cleanAttrs += ' type="button"';

    return `<button${cleanAttrs} data-action-id="${id}" onClick={actions?.["${id}"]}>${inner}</button>`;
  });
  return { html: annotated, actions };
}

const screenIndex = [];
const usedClassTokens = new Set();
for (const screen of manifest) {
  if (isPrdPseudoScreen(screen)) { console.warn("  SKIP PRD:", screen.title); continue; }
  const htmlFile = findScreenHtml(screen);
  if (!htmlFile) { console.warn("  SKIP invalid/missing HTML:", screen.title); continue; }
  const raw = fs.readFileSync(htmlFile, "utf-8");
  const body = extractBody(raw);
  const lucideImports = new Set();
  const normalizedBody = replaceMaterialSymbolSpans(normalizeDesignClassAttributes(body), lucideImports);
  collectClassTokens(normalizedBody, usedClassTokens);
  const { html: interactiveBody, actions } = annotateInteractiveElements(normalizedBody);
  const jsx = htmlToJsx(interactiveBody);
  const name = toComponentName(screen.title);
  if (!name) { console.warn("  SKIP empty component name:", screen.title); continue; }
  const buttons = [...body.matchAll(/<button[^>]*>/gi)].length;
  const inputs = [...body.matchAll(/<input[^>]*>/gi)].length;
  const links = [...body.matchAll(/<a\s[^>]*>/gi)].length;
  const actionType = actions.length > 0 ? actions.map((action) => JSON.stringify(action.id)).join(" | ") : "never";
  const functionSignature = actions.length > 0
    ? `export function ${name}({ actions }: ${name}Props) {`
    : `export function ${name}(_props: ${name}Props) {`;
  const importBlock = lucideImports.size > 0
    ? `import { ${[...lucideImports].sort().join(", ")} } from "lucide-react";\n\n`
    : "";

  const code = `// AUTO-GENERATED from Stitch — DO NOT modify layout or CSS
// Screen: ${screen.title}
// 
// AGENT INSTRUCTIONS:
// 1. DO NOT change className values or layout structure
// 2. Add useState for dynamic values (replace hardcoded text)
// 3. Wire interactive controls through the typed actions prop
// 4. Replace placeholder data with props/state

${importBlock}
export type ${name}ActionId = ${actionType};

export interface ${name}Props {
  actions?: Partial<Record<${name}ActionId, () => void>>;
}

${functionSignature}
  return (
    <>
${jsx.split("\n").map(l => "      " + l).join("\n")}
    </>
  );
}
`;
  fs.writeFileSync(path.join(screensDir, name + ".tsx"), code);
  screenIndex.push({ screenId: screen.screenId, title: screen.title, componentName: name, file: "src/screens/" + name + ".tsx", buttons, inputs, links, actions });
  console.log("  OK:", screen.title, "->", name + ".tsx", "(" + buttons + "btn," + inputs + "inp," + links + "lnk)");
}

fs.writeFileSync(path.join(screensDir, "SCREEN_INDEX.json"), JSON.stringify(screenIndex, null, 2));
const barrel = screenIndex
  .map((screen) => [
    `export { ${screen.componentName} } from "./${screen.componentName}";`,
    `export type { ${screen.componentName}Props, ${screen.componentName}ActionId } from "./${screen.componentName}";`,
  ].join("\n"))
  .join("\n");
fs.writeFileSync(path.join(screensDir, "index.ts"), barrel ? `${barrel}\n` : "");
ensureStitchRuntimeCss(repoPath, usedClassTokens);
console.log("Generated", screenIndex.length, "screen(s)");
