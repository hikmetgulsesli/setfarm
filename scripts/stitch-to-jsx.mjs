#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoPath = process.argv[2];
if (!repoPath) { console.error("Usage: node stitch-to-jsx.mjs <repo-path>"); process.exit(1); }

const stitchDir = path.join(repoPath, "stitch");
const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
if (!fs.existsSync(manifestPath)) { console.log("No DESIGN_MANIFEST.json — skipping"); process.exit(0); }

const rawManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
const screensDir = path.join(repoPath, "src", "screens");
fs.mkdirSync(screensDir, { recursive: true });
const MIN_STITCH_HTML_BYTES = 1000;

function manifestScreens(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.screens)) return value.screens;
  if (value?.screens && typeof value.screens === "object") return Object.values(value.screens);
  return [];
}

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

function fallbackManifestFromScreenMap() {
  const screenMapPath = path.join(stitchDir, "SCREEN_MAP.json");
  if (!fs.existsSync(screenMapPath)) return [];
  let screenMap = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(screenMapPath, "utf-8"));
    screenMap = Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
  return screenMap
    .map((screen) => {
      const screenId = String(screen?.screenId || screen?.id || "").trim();
      if (!screenId) return null;
      const htmlFile = `${screenId}.html`;
      if (!isValidStitchHtml(path.join(stitchDir, htmlFile))) return null;
      return {
        screenId,
        title: String(screen?.title || screen?.name || screenId).trim(),
        htmlFile,
        surfaceIds: Array.isArray(screen?.surfaceIds) ? screen.surfaceIds : [],
        type: screen?.type || "",
      };
    })
    .filter(Boolean);
}

let manifest = manifestScreens(rawManifest);
if (manifest.length === 0) {
  const fallbackManifest = fallbackManifestFromScreenMap();
  if (fallbackManifest.length > 0) {
    console.warn(`DESIGN_MANIFEST_EMPTY: falling back to SCREEN_MAP for ${fallbackManifest.length} screen(s)`);
    manifest = fallbackManifest;
  }
}

function loadV3ProjectionContract() {
  const targetsPath = path.join(stitchDir, "GENERATION_TARGETS.json");
  const bindingsPath = path.join(stitchDir, "STITCH_RESPONSE_BINDINGS.json");
  const hasTargets = fs.existsSync(targetsPath);
  const hasBindings = fs.existsSync(bindingsPath);
  if (!hasTargets && !hasBindings) return undefined;
  if (!hasTargets || !hasBindings) {
    throw new Error("V3_PROJECTION_CONTRACT_PARTIAL: GENERATION_TARGETS.json and STITCH_RESPONSE_BINDINGS.json must exist together");
  }

  let targets;
  let bindings;
  try {
    targets = JSON.parse(fs.readFileSync(targetsPath, "utf-8"));
    bindings = JSON.parse(fs.readFileSync(bindingsPath, "utf-8"));
  } catch (error) {
    throw new Error(`V3_PROJECTION_CONTRACT_JSON_INVALID: ${String(error)}`);
  }
  if (targets?.schema !== "setfarm.design-generation-targets.v1" || !Array.isArray(targets.targets)) {
    throw new Error("V3_PROJECTION_TARGETS_INVALID: exact generation targets are required for contract-only projection");
  }
  if (bindings?.schema !== "setfarm.stitch-target-response-bindings.v1" || !Array.isArray(bindings.bindings)) {
    throw new Error("V3_PROJECTION_BINDINGS_INVALID: exact Stitch response bindings are required for contract-only projection");
  }

  const targetById = new Map();
  for (const target of targets.targets) {
    if (!target?.targetId || targetById.has(target.targetId)) {
      throw new Error(`V3_PROJECTION_TARGET_ID_INVALID:${String(target?.targetId || "missing")}`);
    }
    targetById.set(target.targetId, target);
  }
  const byScreenId = new Map();
  for (const binding of bindings.bindings) {
    const target = targetById.get(binding?.targetRef);
    if (!target || !binding?.responseScreenId || byScreenId.has(binding.responseScreenId)) {
      throw new Error(`V3_PROJECTION_RESPONSE_BINDING_INVALID:${String(binding?.targetRef || "missing")}`);
    }
    byScreenId.set(binding.responseScreenId, {
      targetRef: target.targetId,
      expectedActionRefs: new Set(Array.isArray(target.requiredActionRefs) ? target.requiredActionRefs : []),
      expectedInputPairs: new Set((Array.isArray(target.requiredActionInputs) ? target.requiredActionInputs : [])
        .flatMap((entry) => (Array.isArray(entry?.inputFields) ? entry.inputFields : [])
          .map((field) => `${entry.actionRef}.${field}`))),
      requiredAccessibilityObservables: (Array.isArray(target.requiredObservableSelectors)
        ? target.requiredObservableSelectors
        : [])
        .filter((entry) => entry?.selector?.kind === "accessibility")
        .map((entry) => ({
          observableRef: String(entry.observableRef || ""),
          role: String(entry.selector.role || ""),
          name: String(entry.selector.name || ""),
        })),
    });
  }
  return { byScreenId };
}

const v3ProjectionContract = loadV3ProjectionContract();

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
  "spellcheck": "spellCheck",
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
  "basefrequency": "baseFrequency",
  "color-interpolation-filters": "colorInterpolationFilters",
  "diffuseconstant": "diffuseConstant",
  "edgemode": "edgeMode",
  "kernelmatrix": "kernelMatrix",
  "kernelunitlength": "kernelUnitLength",
  "limitingconeangle": "limitingConeAngle",
  "numoctaves": "numOctaves",
  "specularconstant": "specularConstant",
  "specularexponent": "specularExponent",
  "stddeviation": "stdDeviation",
  "surfacescale": "surfaceScale",
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
  "feblend": "feBlend",
  "fecolormatrix": "feColorMatrix",
  "fecomponenttransfer": "feComponentTransfer",
  "fecomposite": "feComposite",
  "feconvolvematrix": "feConvolveMatrix",
  "fediffuselighting": "feDiffuseLighting",
  "fedisplacementmap": "feDisplacementMap",
  "fedistantlight": "feDistantLight",
  "fedropshadow": "feDropShadow",
  "feflood": "feFlood",
  "fefunca": "feFuncA",
  "fefuncb": "feFuncB",
  "fefuncg": "feFuncG",
  "fefuncr": "feFuncR",
  "fegaussianblur": "feGaussianBlur",
  "feimage": "feImage",
  "femerge": "feMerge",
  "femergenode": "feMergeNode",
  "femorphology": "feMorphology",
  "feoffset": "feOffset",
  "fepointlight": "fePointLight",
  "fespecularlighting": "feSpecularLighting",
  "fespotlight": "feSpotLight",
  "fetile": "feTile",
  "feturbulence": "feTurbulence",
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

function escapeDiagnosticPseudoTags(input) {
  return String(input || "").replace(/<\/?\s*(anonymous|unknown|native)\s*>/gi, (match, tagName) => {
    const closing = /^<\s*\//.test(match) ? "/" : "";
    return `&lt;${closing}${String(tagName || "").toLowerCase()}&gt;`;
  });
}

function copyJsxExpression(input, start) {
  if (input.startsWith("{/*", start)) {
    const end = input.indexOf("*/}", start + 3);
    return end >= 0 ? { text: input.slice(start, end + 3), next: end + 3 } : null;
  }
  if (input.startsWith("{`", start)) {
    let i = start + 2;
    while (i < input.length) {
      if (input[i] === "\\") {
        i += 2;
        continue;
      }
      if (input[i] === "`" && input[i + 1] === "}") {
        return { text: input.slice(start, i + 2), next: i + 2 };
      }
      i++;
    }
  }
  return null;
}

function escapeJsxTextBraces(input) {
  let out = "";
  let inTag = false;
  let quote = "";

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inTag) {
      out += ch;
      if (quote) {
        if (ch === quote) quote = "";
        continue;
      }
      if (ch === "\"" || ch === "'") {
        quote = ch;
      } else if (ch === ">") {
        inTag = false;
      }
      continue;
    }

    if (ch === "<") {
      inTag = true;
      out += ch;
      continue;
    }

    if (ch === "{") {
      const expression = copyJsxExpression(input, i);
      if (expression) {
        out += expression.text;
        i = expression.next - 1;
      } else {
        out += "&#123;";
      }
      continue;
    }

    if (ch === "}") {
      out += "&#125;";
      continue;
    }

    out += ch;
  }

  return out;
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

const RESPONSIVE_STYLE_PREFIXES = new Set(["sm", "md", "lg", "xl", "2xl"]);

function isResponsiveInlineStyleDeclaration(cssKey, rawValue) {
  return RESPONSIVE_STYLE_PREFIXES.has(cssKey)
    && /^[a-z-]+\s*:/i.test(String(rawValue || "").trim());
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
      const value = rawValue.join(":").trim();
      if (isResponsiveInlineStyleDeclaration(cssKey, value)) return "";
      const key = toReactStylePropertyKey(cssKey);
      if (!key) return "";
      if (cssKey.startsWith("--")) needsTypeEscape = true;
      return `${key}: ${JSON.stringify(value)}`;
    })
    .filter(Boolean);
  const suffix = needsTypeEscape ? " as any" : "";
  return `style={{${pairs.join(", ")}}${suffix}}`;
}

function stripJsxAttribute(attrs, attrName) {
  const pattern = new RegExp(
    `\\s+${escapeRegExp(attrName)}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|\\{[^}]*\\}|[^\\s"'=<>]+))?`,
    "gi",
  );
  return String(attrs || "").replace(pattern, "");
}

function dedupeJsxAttributes(input) {
  return String(input || "").replace(/<([A-Za-z][\w.:]*)\b([^<>]*?)(\/?)>/g, (match, tag, attrs, selfClose) => {
    if (!attrs || match.startsWith("</")) return match;
    const attrPattern = /\s+([A-Za-z_:$][\w:.-]*)(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\}|[^\s"'=<>]+))?/g;
    const seen = new Set();
    let out = "";
    let last = 0;
    for (const attr of attrs.matchAll(attrPattern)) {
      const index = attr.index ?? 0;
      const name = String(attr[1] || "").toLowerCase();
      out += attrs.slice(last, index);
      if (!seen.has(name)) {
        seen.add(name);
        out += attr[0];
      }
      last = index + attr[0].length;
    }
    out += attrs.slice(last);
    return `<${tag}${out}${selfClose}>`;
  });
}

function stripInlineEventHandlerAttributes(input) {
  return String(input || "").replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
}

const VOID_HTML_TAGS = new Set(["img", "br", "hr", "input", "meta", "link"]);

function findTagEndRespectingQuotes(input, start) {
  let quote = "";
  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === "\"" || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ">") return i;
  }
  return -1;
}

function mapOpeningTagsRespectingQuotes(input, transform) {
  const source = String(input || "");
  let out = "";
  let cursor = 0;
  const tagPattern = /<([A-Za-z][\w:-]*)\b/g;
  let match;
  while ((match = tagPattern.exec(source)) !== null) {
    const tagStart = match.index;
    const tagEnd = findTagEndRespectingQuotes(source, tagPattern.lastIndex);
    if (tagEnd < 0) break;
    const tagName = String(match[1] || "");
    const attrs = source.slice(tagPattern.lastIndex, tagEnd);
    const original = source.slice(tagStart, tagEnd + 1);
    out += source.slice(cursor, tagStart);
    out += transform({ tagName, attrs, original });
    cursor = tagEnd + 1;
    tagPattern.lastIndex = tagEnd + 1;
  }
  return out + source.slice(cursor);
}

function normalizeVoidElementStartTags(input) {
  const source = String(input || "");
  let out = "";
  let cursor = 0;
  const tagPattern = /<\/?\s*([A-Za-z][\w:-]*)\b/g;
  let match;
  while ((match = tagPattern.exec(source)) !== null) {
    const tagStart = match.index;
    const tagName = String(match[1] || "").toLowerCase();
    if (!VOID_HTML_TAGS.has(tagName) || source[tagStart + 1] === "/") continue;
    const tagEnd = findTagEndRespectingQuotes(source, tagPattern.lastIndex);
    if (tagEnd < 0) break;
    const attrs = source.slice(tagPattern.lastIndex, tagEnd);
    const cleanAttrs = attrs.replace(/\/\s*$/, "").trimEnd();
    out += source.slice(cursor, tagStart);
    out += `<${match[1]}${cleanAttrs} />`;
    cursor = tagEnd + 1;
    tagPattern.lastIndex = tagEnd + 1;
  }
  return out + source.slice(cursor);
}

function htmlToJsx(html) {
  let out = normalizeVoidElementStartTags(normalizeJsxAttributeValues(normalizeJsxAttributeNames(normalizeJsxTagNames(stripInlineEventHandlerAttributes(html)))))
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]*\/?\s*>/gi, "")
    .replace(/<meta[^>]*\/?\s*>/gi, "")
      .replace(/style="([^"]+)"/g, (_, s) => inlineStyleToJsx(s));
  out = normalizeStyleTagChildren(out);
  out = escapeDiagnosticPseudoTags(out);
  return dedupeJsxAttributes(escapeJsxTextBraces(normalizeHtmlComments(out)));
}

function extractBody(html) {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1].trim() : html;
}

function toComponentName(title) {
  return title
    .replace(/[\u0131\u0130]/g,"i").replace(/[\u015f\u015e]/g,"s").replace(/[\u00e7\u00c7]/g,"c")
    .replace(/[\u011f\u011e]/g,"g").replace(/[\u00fc\u00dc]/g,"u").replace(/[\u00f6\u00d6]/g,"o")
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

function materialIconNamesFromHtml(input) {
  const names = [];
  String(input || "").replace(
    /<span\b([^>]*)\b(class|className)=(["'])([^"']*\b(?:material-symbols(?:-outlined)?|material-icons)\b[^"']*)\3([^>]*)>([\s\S]*?)<\/span>/gi,
    (_match, beforeClass, _classAttr, _quote, _classValue, afterClass, inner) => {
      const attrs = `${beforeClass || ""}${afterClass || ""}`;
      const name = attrValue(attrs, "data-icon") || materialIconKey(inner);
      if (name) names.push(name);
      return "";
    },
  );
  return names;
}

function stripMaterialIconSpans(input) {
  return String(input || "").replace(
    /<span\b([^>]*)\b(class|className)=(["'])([^"']*\b(?:material-symbols(?:-outlined)?|material-icons)\b[^"']*)\3([^>]*)>[\s\S]*?<\/span>/gi,
    " ",
  );
}

function humanizeActionLabel(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function labelFromInteractive(attrs, inner, fallback) {
  const explicit = attrValue(attrs, "aria-label") || attrValue(attrs, "title");
  if (explicit) return explicit;

  const visible = textFromHtml(stripMaterialIconSpans(inner));
  if (visible) return visible;

  const iconName = materialIconNamesFromHtml(inner)[0];
  if (iconName) return humanizeActionLabel(iconName);

  return fallback;
}

const MATERIAL_TO_LUCIDE = {
  account_circle: "CircleUserRound",
  account_tree: "GitBranch",
  add: "Plus",
  add_box: "PlusSquare",
  add_circle: "CirclePlus",
  ads_click: "MousePointerClick",
  airline_seat_recline_normal: "Armchair",
  analytics: "BarChart3",
  api: "Braces",
  arrow_back: "ArrowLeft",
  arrow_drop_down: "ChevronDown",
  arrow_drop_up: "ChevronUp",
  arrow_downward: "ArrowDown",
  arrow_forward: "ArrowRight",
  arrow_left: "ArrowLeft",
  arrow_right: "ArrowRight",
  arrow_right_alt: "ArrowRight",
  arrow_upward: "ArrowUp",
  article: "FileText",
  assignment: "ClipboardList",
  assignment_ind: "ClipboardCheck",
  assignment_return: "PackageCheck",
  auto_awesome: "Sparkles",
  badge: "Badge",
  bed: "Bed",
  blur_off: "EyeOff",
  blur_on: "Sparkles",
  bolt: "Bolt",
  bug_report: "Bug",
  build: "Wrench",
  calendar_month: "CalendarDays",
  calendar_today: "CalendarDays",
  cancel: "Ban",
  check: "Check",
  check_circle: "CheckCircle2",
  change_history: "Triangle",
  checklist: "ListChecks",
  chevron_left: "ChevronLeft",
  chevron_right: "ChevronRight",
  cleaning_services: "Sparkles",
  clear_all: "ListX",
  circle: "Circle",
  clinical_notes: "ClipboardPlus",
  close: "X",
  cloud: "Cloud",
  cloud_off: "CloudOff",
  code: "Code",
  contact_phone: "PhoneCall",
  contact_support: "CircleHelp",
  dashboard: "LayoutDashboard",
  data_object: "Braces",
  data_usage: "Database",
  database: "Database",
  dataset: "Database",
  dataset_linked: "DatabaseZap",
  date_range: "CalendarDays",
  delete: "Trash2",
  delete_sweep: "Trash2",
  density_medium: "Rows3",
  density_small: "Rows2",
  deployed_code: "Package",
  description: "FileText",
  desktop_windows: "Monitor",
  device_reset: "RotateCcw",
  directions_car: "Car",
  display_settings: "Monitor",
  dns: "Server",
  done_all: "CheckCheck",
  donut_small: "PieChart",
  download: "Download",
  drag_indicator: "GripVertical",
  dynamic_feed: "Rows3",
  edit: "Pencil",
  edit_document: "FilePenLine",
  edit_note: "Pencil",
  edit_square: "Pencil",
  ecg_heart: "HeartPulse",
  electric_bolt: "Zap",
  emoji_events: "Trophy",
  engineering: "HardHat",
  error: "CircleAlert",
  error_outline: "CircleAlert",
  exercise: "Dumbbell",
  exit_to_app: "LogOut",
  fact_check: "BadgeCheck",
  fast_forward: "FastForward",
  face: "Smile",
  filter_alt: "Filter",
  filter_list: "ListFilter",
  filter_list_off: "FilterX",
  flag: "Flag",
  flash_on: "Zap",
  flight: "Plane",
  flight_land: "PlaneLanding",
  flight_takeoff: "PlaneTakeoff",
  folder_off: "FolderX",
  folder_open: "FolderOpen",
  favorite: "Heart",
  gavel: "Gavel",
  equalizer: "AudioWaveform",
  graphic_eq: "AudioWaveform",
  grid_view: "Grid3X3",
  gpp_bad: "ShieldAlert",
  gpp_maybe: "ShieldAlert",
  group: "Users",
  group_remove: "UserMinus",
  groups: "UsersRound",
  help: "CircleHelp",
  help_center: "CircleHelp",
  help_outline: "CircleHelp",
  history: "History",
  horizontal_rule: "Minus",
  home: "Home",
  how_to_reg: "UserCheck",
  hub: "Network",
  inbox: "Inbox",
  info: "Info",
  insights: "Lightbulb",
  interests: "Shapes",
  inventory: "Archive",
  inventory_2: "PackageSearch",
  key: "Key",
  keyboard: "Keyboard",
  keyboard_alt: "Keyboard",
  keyboard_arrow_down: "ChevronDown",
  keyboard_arrow_left: "ChevronLeft",
  keyboard_arrow_right: "ChevronRight",
  keyboard_voice: "Mic",
  keyboard_return: "CornerDownLeft",
  label: "Tag",
  language: "Languages",
  lan: "Network",
  leaderboard: "Trophy",
  layers: "Layers",
  lens: "Circle",
  lightbulb: "Lightbulb",
  list: "List",
  list_alt: "ListTodo",
  format_list_numbered: "ListOrdered",
  local_fire_department: "Flame",
  local_gas_station: "Fuel",
  local_shipping: "Truck",
  local_hospital: "Hospital",
  location_on: "MapPin",
  login: "LogIn",
  logout: "LogOut",
  mail: "Mail",
  map: "Map",
  medical_services: "BriefcaseMedical",
  meeting_room: "DoorOpen",
  memory: "Cpu",
  menu: "Menu",
  menu_book: "BookOpen",
  monitor: "Monitor",
  mouse: "MousePointerClick",
  near_me: "Navigation",
  notifications: "Bell",
  notifications_active: "BellRing",
  notification_important: "BellRing",
  notes: "StickyNote",
  more_horiz: "Ellipsis",
  more_vert: "EllipsisVertical",
  monitoring: "Activity",
  monitor_heart: "HeartPulse",
  music_note: "Music",
  open_in_full: "Expand",
  open_in_new: "ExternalLink",
  pause: "Pause",
  pause_circle: "CirclePause",
  person: "User",
  person_add: "UserPlus",
  person_search: "UserSearch",
  pending_actions: "ClipboardList",
  pie_chart: "PieChart",
  policy: "ShieldAlert",
  play_arrow: "Play",
  play_circle: "CirclePlay",
  power: "Power",
  power_settings_new: "Power",
  precision_manufacturing: "Factory",
  priority_high: "BadgeAlert",
  progress_activity: "LoaderCircle",
  queue: "ListOrdered",
  query_stats: "BarChart3",
  rebase_edit: "GitCompareArrows",
  refresh: "RefreshCw",
  reorder: "GripHorizontal",
  restart_alt: "RotateCcw",
  replay: "RefreshCcw",
  restore: "RotateCcw",
  rotate_right: "RotateCw",
  route: "Route",
  router: "Router",
  rocket_launch: "Rocket",
  rule: "Ruler",
  save: "Save",
  schedule: "Clock",
  science: "FlaskConical",
  scoreboard: "Trophy",
  search: "Search",
  search_off: "SearchX",
  sensors: "RadioTower",
  settings: "Settings",
  settings_applications: "Settings2",
  settings_input_component: "SlidersHorizontal",
  settings_suggest: "Settings2",
  shield: "Shield",
  show_chart: "TrendingUp",
  sort: "ArrowUpDown",
  south_east: "MoveDownRight",
  speed: "Gauge",
  sports_esports: "Gamepad2",
  smartphone: "Smartphone",
  space_bar: "Space",
  stacked_line_chart: "TrendingUp",
  style: "Palette",
  swords: "Swords",
  swap_horiz: "ArrowLeftRight",
  sync: "RefreshCw",
  sync_alt: "RefreshCcw",
  sync_problem: "RefreshCwOff",
  sync_saved_locally: "Save",
  support_agent: "Headphones",
  table_rows: "Rows3",
  task_alt: "BadgeCheck",
  terrain: "Mountain",
  terminal: "Terminal",
  timer: "Timer",
  title: "Type",
  tips_and_updates: "Lightbulb",
  toggle_on: "ToggleRight",
  token: "Coins",
  touch_app: "MousePointerClick",
  train: "Train",
  trending_up: "TrendingUp",
  trip_origin: "CircleDot",
  trophy: "Trophy",
  tune: "SlidersHorizontal",
  unfold_more: "ChevronsUpDown",
  videogame_asset: "Gamepad2",
  vibration: "Vibrate",
  vital_signs: "HeartPulse",
  volume_down: "Volume1",
  volume_mute: "VolumeX",
  volume_up: "Volume2",
  view_agenda: "Rows3",
  view_column: "Columns3",
  view_week: "Columns3",
  view_kanban: "Kanban",
  view_list: "List",
  view_module: "LayoutGrid",
  visibility: "Eye",
  view_timeline: "Activity",
  warning: "TriangleAlert",
  widgets: "Boxes",
  warehouse: "Warehouse",
  wifi: "Wifi",
  wifi_off: "WifiOff",
  wifi_tether: "RadioTower",
  wifi_tethering: "RadioTower",
  expand_more: "ChevronDown",
  tv_options_parental: "MonitorCog",
  update: "RefreshCw",
  call: "Phone",
  block: "Ban",
  report: "FileWarning",
  star: "Star",
  stars: "Sparkles",
  straighten: "Ruler",
  storage: "Database",
  work: "Briefcase",
};

function materialIconKey(inner) {
  return textFromHtml(inner).toLowerCase().replace(/\s+/g, "_");
}

function normalizeClassTokens(classValue) {
  const tokens = String(classValue || "")
    .split(/\s+/)
    .map(cls => (cls === "transition-all" ? "transition-colors" : cls))
    .filter(Boolean);

  return normalizeSceneBackgroundRepeat(normalizePositionedFullWidth(tokens)).join(" ");
}

function normalizeSceneBackgroundRepeat(tokens) {
  const normalized = [...tokens];
  const parsed = normalized.map((token) => ({ token, ...splitTailwindVariant(token) }));
  const hasSceneImage = parsed.some(({ base }) => /^bg-\[url\(.+\)\]$/.test(base));
  const hasSceneSizing = parsed.some(({ base }) => ["bg-cover", "bg-contain"].includes(base));
  const hasRepeatPolicy = parsed.some(({ base }) => /^bg-(?:no-repeat|repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/.test(base));
  if (hasSceneImage && hasSceneSizing && !hasRepeatPolicy) normalized.push("bg-no-repeat");
  return normalized;
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

function splitVariantParts(variant) {
  if (!variant) return [];
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < variant.length; i += 1) {
    const ch = variant[i];
    if (ch === "[") depth += 1;
    if (ch === "]") depth = Math.max(0, depth - 1);
    if (ch === ":" && depth === 0) {
      parts.push(variant.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(variant.slice(start));
  return parts.filter(Boolean);
}

function wrapResponsiveVariant(rule, variantParts) {
  const screens = {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  };
  const responsive = variantParts.find(part => screens[part]);
  return responsive ? `@media (min-width: ${screens[responsive]}) { ${rule} }` : rule;
}

function selectorForClassVariant(cls, variant) {
  const parts = splitVariantParts(variant);
  let prefix = "";
  let pseudo = "";
  for (const part of parts) {
    if (part === "dark") prefix += ".dark ";
    if (part === "group-hover") prefix += ".group:hover ";
    if (part === "hover") pseudo += ":hover";
    if (part === "focus") pseudo += ":focus";
    if (part === "focus-visible") pseudo += ":focus-visible";
    if (part === "focus-within") pseudo += ":focus-within";
    if (part === "active") pseudo += ":active";
    if (part === "disabled") pseudo += ":disabled";
    if (part === "visited") pseudo += ":visited";
  }
  return {
    selector: `${prefix}.${cssEscapeSelector(cls)}${pseudo}`,
    variantParts: parts,
  };
}

function normalizePositionedFullWidth(tokens) {
  const parsed = tokens.map((token) => ({ token, ...splitTailwindVariant(token) }));
  const isPositioned = parsed.some(({ base }) => base === "fixed" || base === "absolute");
  if (!isPositioned) return tokens;

  const insetByVariant = new Map();
  for (const { variant, base } of parsed) {
    if (!insetByVariant.has(variant)) insetByVariant.set(variant, { left: false, right: false });
    const entry = insetByVariant.get(variant);
    if (/^-?left-(?:\[|[a-z0-9/.-])/.test(base)) entry.left = true;
    if (/^-?right-(?:\[|[a-z0-9/.-])/.test(base)) entry.right = true;
  }

  const hasInsetPair = (variant) => {
    const exact = insetByVariant.get(variant);
    const base = insetByVariant.get("");
    return Boolean((exact && exact.left && exact.right) || (variant && base && base.left && base.right));
  };

  return parsed
    .filter(({ variant, base }) => {
      if (!["w-full", "w-screen", "min-w-full", "min-w-screen"].includes(base)) return true;
      return !hasInsetPair(variant);
    })
    .map(({ token }) => token);
}

function normalizeDesignClassAttributes(html) {
  return String(html || "").replace(
    /\b(class|className)=("([^"]*)"|'([^']*)')/gi,
    (_match, attr, quoted, doubleValue, singleValue) => {
      const quote = quoted.startsWith('"') ? '"' : "'";
      const value = doubleValue ?? singleValue ?? "";
      return `${attr}=${quote}${normalizeClassTokens(value)}${quote}`;
    },
  );
}

function collectClassTokens(html, out) {
  String(html || "").replace(/\b(?:class|className)=("([^"]*)"|'([^']*)')/gi, (_match, _quoted, doubleValue, singleValue) => {
    const value = doubleValue ?? singleValue ?? "";
    normalizeClassTokens(value).split(/\s+/).forEach(cls => {
      if (cls) out.add(cls);
    });
    return "";
  });
}

const STITCH_RUNTIME_CSS_START = "/* SETFARM_STITCH_RUNTIME_UTILITIES_START */";
const STITCH_RUNTIME_CSS_END = "/* SETFARM_STITCH_RUNTIME_UTILITIES_END */";
const STITCH_CUSTOM_CSS_START = "/* SETFARM_STITCH_CUSTOM_CSS_START */";
const STITCH_CUSTOM_CSS_END = "/* SETFARM_STITCH_CUSTOM_CSS_END */";

function cssEscapeSelector(cls) {
  return cls.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

function parseDesignTokensCss(css) {
  const tokens = { colors: new Set(), fonts: new Set(), radii: new Set(), spacing: new Set() };
  String(css || "").replace(/--(color|font|radius|spacing)-([a-zA-Z0-9_-]+)\s*:/g, (_match, kind, key) => {
    if (kind === "color") tokens.colors.add(key);
    if (kind === "font") tokens.fonts.add(key);
    if (kind === "radius") tokens.radii.add(key);
    if (kind === "spacing") tokens.spacing.add(key);
    return "";
  });
  return tokens;
}

function designTokensForRepo(repoPath) {
  const stitchTokensPath = path.join(repoPath, "stitch", "design-tokens.css");
  if (!fs.existsSync(stitchTokensPath)) return parseDesignTokensCss("");
  return parseDesignTokensCss(fs.readFileSync(stitchTokensPath, "utf-8"));
}

function tokenColorValue(key, opacity) {
  const value = `var(--color-${key})`;
  if (!opacity) return value;
  const pct = Math.max(0, Math.min(100, Number(opacity)));
  if (!Number.isFinite(pct)) return value;
  return `color-mix(in srgb, ${value} ${pct}%, transparent)`;
}

function splitOpacityToken(value) {
  const match = String(value || "").match(/^([a-zA-Z0-9_-]+)(?:\/(\d{1,3}))?$/);
  return match ? { key: match[1], opacity: match[2] || "" } : null;
}

function buildDesignTokenUtilityRule(baseClass, selector, tokens) {
  const colorPrefixes = [
    ["bg-", "background-color"],
    ["text-", "color"],
    ["border-", "border-color"],
    ["outline-", "outline-color"],
    ["divide-", "border-color"],
    ["accent-", "accent-color"],
    ["caret-", "caret-color"],
  ];
  for (const [prefix, prop] of colorPrefixes) {
    if (!baseClass.startsWith(prefix)) continue;
    const parsed = splitOpacityToken(baseClass.slice(prefix.length));
    if (parsed && tokens.colors.has(parsed.key)) {
      return `${selector} { ${prop}: ${tokenColorValue(parsed.key, parsed.opacity)}; }`;
    }
  }

  if (baseClass.startsWith("ring-")) {
    const parsed = splitOpacityToken(baseClass.slice("ring-".length));
    if (parsed && tokens.colors.has(parsed.key)) {
      return `${selector} { --tw-ring-color: ${tokenColorValue(parsed.key, parsed.opacity)}; }`;
    }
  }

  if (baseClass.startsWith("font-")) {
    const key = baseClass.slice("font-".length);
    if (tokens.fonts.has(key)) {
      return `${selector} { font-family: var(--font-${key}), sans-serif; }`;
    }
  }

  if (baseClass === "rounded" && tokens.radii.has("DEFAULT")) {
    return `${selector} { border-radius: var(--radius-DEFAULT); }`;
  }
  if (baseClass.startsWith("rounded-")) {
    const key = baseClass.slice("rounded-".length);
    if (tokens.radii.has(key)) {
      return `${selector} { border-radius: var(--radius-${key}); }`;
    }
  }

  const spacingMatch = baseClass.match(/^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left)-([a-zA-Z0-9_-]+)$/);
  if (spacingMatch && tokens.spacing.has(spacingMatch[2])) {
    const value = `var(--spacing-${spacingMatch[2]})`;
    const propMap = {
      p: `padding: ${value}`,
      px: `padding-left: ${value}; padding-right: ${value}`,
      py: `padding-top: ${value}; padding-bottom: ${value}`,
      pt: `padding-top: ${value}`,
      pr: `padding-right: ${value}`,
      pb: `padding-bottom: ${value}`,
      pl: `padding-left: ${value}`,
      m: `margin: ${value}`,
      mx: `margin-left: ${value}; margin-right: ${value}`,
      my: `margin-top: ${value}; margin-bottom: ${value}`,
      mt: `margin-top: ${value}`,
      mr: `margin-right: ${value}`,
      mb: `margin-bottom: ${value}`,
      ml: `margin-left: ${value}`,
      gap: `gap: ${value}`,
      "gap-x": `column-gap: ${value}`,
      "gap-y": `row-gap: ${value}`,
      "space-x": `--tw-space-x-reverse: 0; margin-right: calc(${value} * var(--tw-space-x-reverse)); margin-left: calc(${value} * calc(1 - var(--tw-space-x-reverse)))`,
      "space-y": `--tw-space-y-reverse: 0; margin-top: calc(${value} * calc(1 - var(--tw-space-y-reverse))); margin-bottom: calc(${value} * var(--tw-space-y-reverse))`,
      inset: `inset: ${value}`,
      "inset-x": `left: ${value}; right: ${value}`,
      "inset-y": `top: ${value}; bottom: ${value}`,
      top: `top: ${value}`,
      right: `right: ${value}`,
      bottom: `bottom: ${value}`,
      left: `left: ${value}`,
    };
    return `${selector} { ${propMap[spacingMatch[1]]}; }`;
  }

  return "";
}

function ruleForClass(cls, tokens = parseDesignTokensCss("")) {
  const { variant, base } = splitTailwindVariant(cls);
  const { selector, variantParts } = selectorForClassVariant(cls, variant);
  const tokenRule = buildDesignTokenUtilityRule(base, selector, tokens);
  if (tokenRule) return wrapResponsiveVariant(tokenRule, variantParts);

  const textScale = {
    "text-label-sm": "font-size: 0.75rem; line-height: 1rem;",
    "text-label-md": "font-size: 0.875rem; line-height: 1.25rem;",
    "text-body-md": "font-size: 1rem; line-height: 1.5rem;",
    "text-body-lg": "font-size: 1.125rem; line-height: 1.75rem;",
    "text-headline-md": "font-size: 1.5rem; line-height: 2rem;",
    "text-headline-lg": "font-size: 2rem; line-height: 2.4rem;",
    "text-display-md": "font-size: 2.25rem; line-height: 1.1;",
    "text-display-lg": "font-size: clamp(2.5rem, 7vw, 4.5rem); line-height: 1;",
    "text-display-xl": "font-size: 4.5rem; line-height: 1;",
  };
  if (textScale[base]) return wrapResponsiveVariant(`${selector} { ${textScale[base]} }`, variantParts);

  const fontScale = {
    "font-label-sm": "font-weight: 600; letter-spacing: 0.02em;",
    "font-label-md": "font-weight: 600; letter-spacing: 0.01em;",
    "font-body-md": "font-weight: 400;",
    "font-body-lg": "font-weight: 400;",
    "font-headline-md": "font-weight: 700;",
    "font-headline-lg": "font-weight: 800;",
    "font-display-md": "font-weight: 800;",
    "font-display-lg": "font-weight: 900;",
    "font-display-xl": "font-weight: 900;",
  };
  if (fontScale[base]) return wrapResponsiveVariant(`${selector} { ${fontScale[base]} }`, variantParts);

  const tetromino = base.match(/^tetromino-([iotszjl])$/i);
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
    return `${selector} { background: var(--tetromino-${key}, ${colors[key]}); border: 1px solid color-mix(in srgb, var(--tetromino-${key}, ${colors[key]}) 72%, white); box-shadow: inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -2px 0 rgba(0,0,0,0.24); }`;
  }

  if (base === "ghost-piece") return `${selector} { background: transparent; border: 1px dashed rgba(248,250,252,0.45); opacity: 0.55; }`;
  if (base === "bg-grid") return `${selector} { background-image: linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px); background-size: 24px 24px; }`;
  if (base === "bg-no-repeat") return `${selector} { background-repeat: no-repeat; }`;
  if (base === "machined-border") return `${selector} { border: 1px solid rgba(148,163,184,0.35); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 30px rgba(2,6,23,0.35); }`;
  if (base === "neon-glow-red") return `${selector} { box-shadow: 0 0 0 1px rgba(244,63,94,0.5), 0 0 24px rgba(244,63,94,0.28); }`;
  if (base === "min-touch") return `${selector} { min-width: 44px; min-height: 44px; }`;
  if (base === "h-touch-target") return `${selector} { height: 44px; }`;
  if (base === "w-grid-block") return `${selector} { width: clamp(1.1rem, 5vw, 1.85rem); }`;
  if (base === "h-grid-block") return `${selector} { height: clamp(1.1rem, 5vw, 1.85rem); }`;
  if (base === "px-gutter") return `${selector} { padding-left: clamp(1rem, 4vw, 2rem); padding-right: clamp(1rem, 4vw, 2rem); }`;
  return "";
}

function buildRuntimeUtilityCss(classTokens, tokens = parseDesignTokensCss("")) {
  const rules = [...classTokens].map(cls => ruleForClass(cls, tokens)).filter(Boolean);
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

function collectStyleBlocks(html, out) {
  String(html || "").replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, css) => {
    const cleaned = sanitizeStitchCustomCss(css);
    if (cleaned) out.add(cleaned);
    return "";
  });
}

function sanitizeStitchCustomCss(css) {
  return String(css || "")
    .replace(/\.material-symbols(?:-[a-z0-9_-]+)?\s*\{[\s\S]*?\}\s*/gi, "")
    .replace(/font-family\s*:\s*['"]?(?:Material Symbols|Material Icons)[^;]*;?/gi, "")
    .replace(/font-family\s*:\s*(["']?)(?:Inter|Roboto|Arial|Helvetica|system-ui)\1(?:\s*,[^;{}]+)?;?/gi, "font-family: var(--font-body-md, \"Hanken Grotesk\"), \"Segoe UI\", sans-serif;")
    .replace(/theme\(\s*['"]colors\.([a-z0-9_.-]+)['"]\s*\)/gi, (_match, token) => {
      const cssVar = String(token || "").replace(/[_.]+/g, "-").replace(/[^a-z0-9-]/gi, "").toLowerCase();
      return cssVar ? `var(--color-${cssVar})` : "currentColor";
    })
    .replace(/\btransition\s*:\s*all\b/gi, "transition: color, background-color, border-color, box-shadow, opacity, transform")
    .trim();
}

function buildStitchCustomCss(styleBlocks) {
  const blocks = [...styleBlocks].map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) return "";
  return [
    STITCH_CUSTOM_CSS_START,
    "/* Auto-generated by stitch-to-jsx.mjs from Stitch <style> blocks. */",
    ...blocks,
    STITCH_CUSTOM_CSS_END,
  ].join("\n");
}

function ensureStitchRuntimeCss(repoPath, classTokens, styleBlocks = new Set()) {
  const designTokens = designTokensForRepo(repoPath);
  const utilityBlock = buildRuntimeUtilityCss(classTokens, designTokens);
  const customBlock = buildStitchCustomCss(styleBlocks);
  const stitchTokensPath = path.join(repoPath, "stitch", "design-tokens.css");
  if (!utilityBlock && !customBlock && !fs.existsSync(stitchTokensPath)) return;

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

  const utilityBlockPattern = new RegExp(`${escapeRegExp(STITCH_RUNTIME_CSS_START)}[\\s\\S]*?${escapeRegExp(STITCH_RUNTIME_CSS_END)}\\n?`, "m");
  const customBlockPattern = new RegExp(`${escapeRegExp(STITCH_CUSTOM_CSS_START)}[\\s\\S]*?${escapeRegExp(STITCH_CUSTOM_CSS_END)}\\n?`, "m");
  css = css.replace(utilityBlockPattern, "").replace(customBlockPattern, "").trimEnd();
  if (utilityBlock) css = `${css}\n\n${utilityBlock}\n`;
  if (customBlock) css = `${css}\n\n${customBlock}\n`;
  fs.writeFileSync(cssPath, css.endsWith("\n") ? css : `${css}\n`);
}

function materialIconComponentForName(iconName, lucideImports, unknownMaterialIcons) {
  const mappedComponent = MATERIAL_TO_LUCIDE[iconName];
  if (!mappedComponent) {
    const key = iconName || "(empty)";
    unknownMaterialIcons.set(key, (unknownMaterialIcons.get(key) || 0) + 1);
  }
  const component = mappedComponent || "BadgeHelp";
  lucideImports.add(component);
  return component;
}

function cleanMaterialIconClass(classValue) {
  return normalizeClassTokens(classValue)
    .split(/\s+/)
    .filter(cls => cls && cls !== "material-icons" && !cls.startsWith("material-symbols"))
    .join(" ");
}

function replaceMaterialSymbolSpans(html, lucideImports, unknownMaterialIcons) {
  let out = String(html || "").replace(
    /<span\b([^>]*)\b(class|className)=(["'])([^"']*\b(?:material-symbols(?:-outlined)?|material-icons)\b[^"']*)\3([^>]*)>([\s\S]*?)<\/span>/gi,
    (_match, beforeClass, _classAttr, _quote, classValue, afterClass, inner) => {
      const iconName = materialIconKey(inner);
      const component = materialIconComponentForName(iconName, lucideImports, unknownMaterialIcons);
      const cleanedClass = cleanMaterialIconClass(classValue);
      const attrs = ["aria-hidden", "focusable", "data-icon", "title"]
        .reduce((next, attr) => stripJsxAttribute(next, attr), `${beforeClass || ""}${afterClass || ""}`)
        .trimEnd();
      const classAttr = cleanedClass ? ` class="${cleanedClass}"` : "";
      return `<${component}${attrs}${classAttr} aria-hidden="true" focusable="false" />`;
    },
  );
  out = out.replace(
    /<(button|a|i)\b([^>]*)\b(class|className)=(["'])([^"']*\b(?:material-symbols(?:-outlined)?|material-icons)\b[^"']*)\4([^>]*)>([\s\S]*?)<\/\1>/gi,
    (_match, tag, beforeClass, _classAttr, _quote, classValue, afterClass, inner) => {
      const iconName = attrValue(`${beforeClass || ""}${afterClass || ""}`, "data-icon") || materialIconKey(inner);
      const component = materialIconComponentForName(iconName, lucideImports, unknownMaterialIcons);
      const cleanedClass = cleanMaterialIconClass(classValue);
      let attrs = ["data-icon"]
        .reduce((next, attr) => stripJsxAttribute(next, attr), `${beforeClass || ""}${afterClass || ""}`)
        .trimEnd();
      if (cleanedClass) attrs += ` class="${cleanedClass}"`;
      if ((tag.toLowerCase() === "button" || tag.toLowerCase() === "a") && !/\baria-label\s*=|\btitle\s*=/.test(attrs)) {
        attrs += ` aria-label="${escapeHtmlAttr(humanizeActionLabel(iconName))}"`;
      }
      return `<${tag}${attrs}><${component} aria-hidden="true" focusable="false" /></${tag}>`;
    },
  );
  return out;
}

function writeUnknownMaterialIconsReport(repoPath, unknownMaterialIcons) {
  const setupDir = path.join(repoPath, ".setfarm", "setup");
  fs.mkdirSync(setupDir, { recursive: true });
  const icons = [...unknownMaterialIcons.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iconName, count]) => ({ iconName, count }));
  fs.writeFileSync(path.join(setupDir, "UNKNOWN_MATERIAL_ICONS.json"), JSON.stringify({
    status: icons.length > 0 ? "warning" : "pass",
    generatedAt: new Date().toISOString(),
    count: icons.length,
    icons,
    severity: icons.length > 0 ? "supervisor_fixable" : "none",
    guidance: icons.length > 0
      ? "Generated code used build-safe fallback icons for unmapped Material Symbols. Treat this as supervisor-fixable UI fidelity work, not a setup-build failure."
      : "All Material Symbols used by Stitch HTML were mapped to lucide-react components.",
  }, null, 2));
}

function slugifyActionId(label, fallback) {
  const normalized = String(label || "")
    .replace(/[\u0131\u0130]/g, "i").replace(/[\u015f\u015e]/g, "s").replace(/[\u00e7\u00c7]/g, "c")
    .replace(/[\u011f\u011e]/g, "g").replace(/[\u00fc\u00dc]/g, "u").replace(/[\u00f6\u00d6]/g, "o")
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

function attrValue(attrs, attrName) {
  const match = new RegExp(
    `\\b${escapeRegExp(attrName)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    "i",
  ).exec(String(attrs || ""));
  return match ? String(match[1] ?? match[2] ?? match[3] ?? "").trim() : "";
}

function semanticActionRef(attrs) {
  const value = attrValue(attrs, "data-action");
  return /^ACT_[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(value) ? value : "";
}

function semanticActionInputs(attrs) {
  const value = attrValue(attrs, "data-action-input");
  if (!value) return [];
  const seen = new Set();
  return value
    .split(/[;,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => {
      const match = item.match(/^(ACT_[A-Z0-9]+(?:_[A-Z0-9]+)*)\.([A-Za-z][A-Za-z0-9_]*)$/);
      if (!match) return [];
      const key = `${match[1]}\0${match[2]}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ actionRef: match[1], inputField: match[2] }];
    });
}

function escapeHtmlAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function annotateInteractiveElements(html, projection) {
  const actions = [];
  const valueControls = [];
  const rejectedControls = [];
  const identities = [];
  let buttonIndex = 0;
  let linkIndex = 0;
  let inputIndex = 0;
  let textareaIndex = 0;
  let selectIndex = 0;
  const nextId = (label, fallback, index) => {
    const id = uniqueActionId(identities, slugifyActionId(label, fallback), index);
    identities.push({ id });
    return id;
  };
  const expectedInput = (binding) => projection?.expectedInputPairs.has(`${binding.actionRef}.${binding.inputField}`) ?? false;
  const rejectControl = ({ id, kind, label, index, actionRef, inputBindings, href }) => {
    rejectedControls.push({
      rejectionId: id,
      kind,
      label,
      index,
      reasonCode: "undeclared_by_generation_target",
      ...(actionRef ? { rawActionRef: actionRef } : {}),
      ...(inputBindings.length > 0 ? { rawInputBindings: inputBindings } : {}),
      ...(href ? { href } : {}),
    });
  };
  const neutralizedAttrs = (attrs, id, kind) => {
    let cleanAttrs = String(attrs || "");
    for (const attribute of [
      "data-action", "data-action-input", "data-action-id", "data-control-id",
      "data-setfarm-link-action", "onclick", "onClick", "onchange", "onChange",
      "oninput", "onInput", "onsubmit", "onSubmit", "tabindex", "tabIndex",
      "role", "hidden", "aria-hidden",
    ]) {
      cleanAttrs = stripJsxAttribute(cleanAttrs, attribute);
    }
    if (kind === "link") {
      for (const attribute of ["href", "target", "rel", "download"]) {
        cleanAttrs = stripJsxAttribute(cleanAttrs, attribute);
      }
    }
    if (["button", "input", "textarea", "select"].includes(kind)) {
      cleanAttrs = stripJsxAttribute(cleanAttrs, "disabled");
      cleanAttrs += " disabled";
    }
    return `${cleanAttrs} hidden="true" aria-hidden="true" data-setfarm-rejected-control="${id}"`;
  };
  const withButtons = String(html || "").replace(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi, (match, attrs, inner) => {
    const index = buttonIndex++;
    const label = labelFromInteractive(attrs, inner, `Button ${index + 1}`);
    const id = nextId(label, "button", index);
    const actionRef = semanticActionRef(attrs);
    const inputBindings = semanticActionInputs(attrs);
    const accepted = !projection || Boolean(actionRef && projection.expectedActionRefs.has(actionRef));
    if (!accepted) {
      rejectControl({ id, kind: "button", label, index, actionRef, inputBindings });
      return `<button${neutralizedAttrs(attrs, id, "button")}>${inner}</button>`;
    }
    actions.push({ id, kind: "button", label, index, ...(actionRef ? { actionRef } : {}), ...(inputBindings.length ? { inputBindings } : {}) });

    let cleanAttrs = String(attrs || "")
      .replace(/\sdata-action-id=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonclick=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonClick=\{[^}]*\}/g, "");
    if (!/\btype\s*=/.test(cleanAttrs)) cleanAttrs += ' type="button"';
    if (!/\baria-label\s*=/.test(cleanAttrs) && !/\btitle\s*=/.test(cleanAttrs) && !textFromHtml(stripMaterialIconSpans(inner))) {
      cleanAttrs += ` aria-label="${escapeHtmlAttr(label)}"`;
    }

    return `<button${cleanAttrs} data-action-id="${id}" onClick={actions?.["${id}"]}>${inner}</button>`;
  });
  const annotated = withButtons.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, inner) => {
    const index = linkIndex++;
    const href = attrValue(attrs, "href");
    const label = labelFromInteractive(attrs, inner, href || `Link ${index + 1}`);
    const id = nextId(label, "link", index);
    const actionRef = semanticActionRef(attrs);
    const inputBindings = semanticActionInputs(attrs);
    const accepted = !projection || Boolean(actionRef && projection.expectedActionRefs.has(actionRef));
    if (!accepted) {
      rejectControl({ id, kind: "link", label, index, actionRef, inputBindings, href });
      return `<a${neutralizedAttrs(attrs, id, "link")}>${inner}</a>`;
    }
    actions.push({ id, kind: "link", label, href, index, ...(actionRef ? { actionRef } : {}), ...(inputBindings.length ? { inputBindings } : {}) });

    const cleanAttrs = String(attrs || "")
      .replace(/\sdata-action-id=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonclick=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonClick=\{[^}]*\}/g, "");
    const accessibleAttrs = !/\baria-label\s*=/.test(cleanAttrs) && !/\btitle\s*=/.test(cleanAttrs) && !textFromHtml(stripMaterialIconSpans(inner))
      ? `${cleanAttrs} aria-label="${escapeHtmlAttr(label)}"`
      : cleanAttrs;

    return `<a${accessibleAttrs} data-action-id="${id}" data-setfarm-link-action="${id}">${inner}</a>`;
  });
  const annotateValueTag = (tagName, attrs, fallback, index) => {
    const label = attrValue(attrs, "aria-label")
      || attrValue(attrs, "name")
      || attrValue(attrs, "placeholder")
      || attrValue(attrs, "id")
      || fallback;
    const actionRef = semanticActionRef(attrs);
    const inputBindings = semanticActionInputs(attrs);
    const cleanAttrs = String(attrs || "")
      .replace(/\sdata-action-id=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sdata-control-id=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonchange=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sonChange=\{[^}]*\}/g, "");
    if (actionRef) {
      const id = nextId(label, tagName, actions.length);
      if (projection && !projection.expectedActionRefs.has(actionRef)) {
        rejectControl({ id, kind: tagName, label, index, actionRef, inputBindings });
        return neutralizedAttrs(attrs, id, tagName);
      }
      actions.push({ id, kind: tagName, label, index, actionRef, ...(inputBindings.length ? { inputBindings } : {}) });
      return `${cleanAttrs} data-action-id="${id}" onChange={() => actions?.["${id}"]?.()}`;
    }
    if (inputBindings.length === 0 && !projection) return String(attrs || "");
    const id = nextId(label, tagName, valueControls.length);
    if (projection && !inputBindings.some(expectedInput)) {
      rejectControl({ id, kind: tagName, label, index, actionRef, inputBindings });
      return neutralizedAttrs(attrs, id, tagName);
    }
    valueControls.push({ id, kind: tagName, label, index, inputBindings });
    return `${cleanAttrs} data-control-id="${id}"`;
  };
  const withInputs = annotated.replace(/<input\b([^>]*)>/gi, (_match, attrs) => {
    const index = inputIndex++;
    return `<input${annotateValueTag("input", attrs, `Input ${index + 1}`, index)}>`;
  });
  const withTextareas = withInputs.replace(/<textarea\b([^>]*)>/gi, (_match, attrs) => {
    const index = textareaIndex++;
    return `<textarea${annotateValueTag("textarea", attrs, `Textarea ${index + 1}`, index)}>`;
  });
  const withSelects = withTextareas.replace(/<select\b([^>]*)>/gi, (_match, attrs) => {
    const index = selectIndex++;
    return `<select${annotateValueTag("select", attrs, `Select ${index + 1}`, index)}>`;
  });
  return { html: withSelects, actions, valueControls, rejectedControls };
}

function annotateObservableElements(html, projection) {
  const required = projection?.requiredAccessibilityObservables || [];
  if (required.length === 0) return { html: String(html || ""), observables: [] };

  const bySelector = new Map();
  for (const observable of required) {
    if (!/^OBS_[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(observable.observableRef)) {
      throw new Error(`V3_OBSERVABLE_REF_INVALID:${observable.observableRef || "missing"}`);
    }
    if (!observable.role || !observable.name) {
      throw new Error(`V3_OBSERVABLE_SELECTOR_INVALID:${observable.observableRef}`);
    }
    const key = `${observable.role}\0${observable.name}`;
    const entries = bySelector.get(key) || [];
    entries.push(observable);
    bySelector.set(key, entries);
  }

  const counts = new Map([...bySelector.keys()].map((key) => [key, 0]));
  const annotated = mapOpeningTagsRespectingQuotes(
    html,
    ({ original, tagName, attrs }) => {
      const role = attrValue(attrs, "role");
      const name = attrValue(attrs, "aria-label");
      const key = `${role}\0${name}`;
      const matches = bySelector.get(key);
      if (!matches) return original;
      counts.set(key, (counts.get(key) || 0) + 1);
      const refs = matches.map((entry) => entry.observableRef).sort().join(" ");
      const selfClosing = /\/\s*$/.test(attrs);
      const attributeBody = selfClosing ? attrs.replace(/\/\s*$/, "") : attrs;
      const cleanAttrs = stripJsxAttribute(String(attributeBody || ""), "data-observable-refs");
      return `<${tagName}${cleanAttrs} data-observable-refs="${escapeHtmlAttr(refs)}"${selfClosing ? " />" : ">"}`;
    },
  );

  for (const [key, matches] of bySelector) {
    const count = counts.get(key) || 0;
    if (count !== 1) {
      const code = count === 0 ? "V3_OBSERVABLE_SELECTOR_MISSING" : "V3_OBSERVABLE_SELECTOR_AMBIGUOUS";
      throw new Error(`${code}:${matches.map((entry) => entry.observableRef).sort().join(",")}:${count}`);
    }
  }
  return {
    html: annotated,
    observables: required.map((observable) => ({ ...observable })),
  };
}

function restoreGeneratedLinkActionHandlers(jsx) {
  return String(jsx || "").replace(
    /\sdata-setfarm-link-action="([^"]+)"/g,
    (_match, id) => ` onClick={(event) => { event.preventDefault(); actions?.["${id}"]?.(); }}`,
  );
}

function stripNonRenderedHtmlBlocks(html) {
  return String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<template\b[\s\S]*?<\/template>/gi, "");
}

function isGameplayScreen(screen) {
  return /\b(gameplay|playfield|browser[- ]?game|arcade|SURF_GAMEPLAY)\b/i.test(
    [screen?.title, screen?.screenId, screen?.surfaceId, screen?.kind].filter(Boolean).join(" "),
  );
}

function gameRuntimeType() {
  return "{ player?: { lane?: number; position?: number }; obstacles?: Array<{ lane?: number; position?: number }>; shards?: Array<{ lane?: number; position?: number }>; score?: number; energy?: number; lives?: number; paused?: boolean }";
}

const screenIndex = [];
const usedClassTokens = new Set();
const stitchStyleBlocks = new Set();
const unknownMaterialIcons = new Map();
for (const screen of manifest) {
  if (isPrdPseudoScreen(screen)) { console.warn("  SKIP PRD:", screen.title); continue; }
  const htmlFile = findScreenHtml(screen);
  if (!htmlFile) { console.warn("  SKIP invalid/missing HTML:", screen.title); continue; }
  const raw = fs.readFileSync(htmlFile, "utf-8");
  collectStyleBlocks(raw, stitchStyleBlocks);
  const body = extractBody(raw);
  const lucideImports = new Set();
  const renderableBody = stripNonRenderedHtmlBlocks(body);
  const classNormalizedBody = normalizeDesignClassAttributes(renderableBody);
  const projection = v3ProjectionContract?.byScreenId.get(String(screen.screenId || ""));
  if (v3ProjectionContract && !projection) {
    throw new Error(`V3_PROJECTION_SCREEN_UNBOUND:${String(screen.screenId || screen.title || "missing")}`);
  }
  const observableProjection = annotateObservableElements(classNormalizedBody, projection);
  const {
    html: interactiveBody,
    actions,
    valueControls,
    rejectedControls,
  } = annotateInteractiveElements(observableProjection.html, projection);
  const sourceLocator = path.relative(repoPath, htmlFile).split(path.sep).join("/");
  const indexedActions = actions.map((action) => action.actionRef ? {
    ...action,
    generatedLocalId: action.id,
    semanticSource: "data-action",
    sourceLocator,
    selector: `[data-action-id="${action.id}"]`,
  } : action);
  const indexedValueControls = valueControls.map((control) => ({
    ...control,
    generatedLocalId: control.id,
    semanticSource: "data-action-input",
    sourceLocator,
    selector: `[data-control-id="${control.id}"]`,
  }));
  const indexedObservables = observableProjection.observables.map((observable) => ({
    observableRef: observable.observableRef,
    role: observable.role,
    name: observable.name,
    sourceLocator,
    selector: `[data-observable-refs~="${observable.observableRef}"]`,
  }));
  const normalizedBody = replaceMaterialSymbolSpans(interactiveBody, lucideImports, unknownMaterialIcons);
  collectClassTokens(normalizedBody, usedClassTokens);
  const jsx = restoreGeneratedLinkActionHandlers(htmlToJsx(normalizedBody));
  const name = toComponentName(screen.title);
  if (!name) { console.warn("  SKIP empty component name:", screen.title); continue; }
  const buttons = [...renderableBody.matchAll(/<button[^>]*>/gi)].length;
  const inputs = [...renderableBody.matchAll(/<input[^>]*>/gi)].length;
  const textareas = [...renderableBody.matchAll(/<textarea[^>]*>/gi)].length;
  const selects = [...renderableBody.matchAll(/<select[^>]*>/gi)].length;
  const links = [...renderableBody.matchAll(/<a\s[^>]*>/gi)].length;
  const actionType = actions.length > 0 ? actions.map((action) => JSON.stringify(action.id)).join(" | ") : "never";
  const needsRuntime = isGameplayScreen(screen);
  const functionSignature = actions.length > 0 || needsRuntime
    ? `export function ${name}({ ${[
      actions.length > 0 ? "actions" : "",
      needsRuntime ? "runtime" : "",
    ].filter(Boolean).join(", ")} }: ${name}Props) {`
    : `export function ${name}(_props: ${name}Props) {`;
  const importBlock = lucideImports.size > 0
    ? `import { ${[...lucideImports].sort().join(", ")} } from "lucide-react";\n\n`
    : "";
  const runtimeProp = needsRuntime ? `  runtime?: ${gameRuntimeType()};\n` : "";

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
${runtimeProp}
}

${functionSignature}
${needsRuntime ? "  void runtime;\n" : ""}  return (
    <>
${jsx.split("\n").map(l => "      " + l).join("\n")}
    </>
  );
}
`;
  const generatedSourceLocator = "src/screens/" + name + ".tsx";
  fs.writeFileSync(path.join(screensDir, name + ".tsx"), code);
  const indexedRejectedControls = rejectedControls.map((control) => ({
    ...control,
    sourceLocator,
    generatedSourceLocator,
    selector: `[data-setfarm-rejected-control="${control.rejectionId}"]`,
  }));
  screenIndex.push({
    screenId: screen.screenId,
    title: screen.title,
    componentName: name,
    file: generatedSourceLocator,
    buttons,
    inputs,
    textareas,
    selects,
    links,
    actions: indexedActions,
    controls: [...indexedActions, ...indexedValueControls].map((control) => ({
      ...control,
      generatedSourceLocator,
    })),
    observables: indexedObservables.map((observable) => ({
      ...observable,
      generatedSourceLocator,
    })),
    ...(projection ? {
      projection: {
        schema: "setfarm.stitch-screen-projection.v2",
        mode: "contract_only",
        targetRef: projection.targetRef,
        rawInteractiveCounts: { buttons, links, inputs, textareas, selects },
        requiredObservableRefs: indexedObservables.map((observable) => observable.observableRef).sort(),
      },
      rejectedControls: indexedRejectedControls,
    } : {}),
  });
  console.log(
    "  OK:",
    screen.title,
    "->",
    name + ".tsx",
    "(" + buttons + "btn," + inputs + "inp," + links + "lnk," + indexedRejectedControls.length + " rejected)",
  );
}

fs.writeFileSync(path.join(screensDir, "SCREEN_INDEX.json"), JSON.stringify(screenIndex, null, 2));
const uniqueBarrelScreens = [];
const seenBarrelComponents = new Set();
for (const screen of screenIndex) {
  if (!screen?.componentName || seenBarrelComponents.has(screen.componentName)) continue;
  seenBarrelComponents.add(screen.componentName);
  uniqueBarrelScreens.push(screen);
}
const barrel = uniqueBarrelScreens
  .map((screen) => [
    `export { ${screen.componentName} } from "./${screen.componentName}";`,
    `export type { ${screen.componentName}Props, ${screen.componentName}ActionId } from "./${screen.componentName}";`,
  ].join("\n"))
  .join("\n");
fs.writeFileSync(path.join(screensDir, "index.ts"), barrel ? `${barrel}\n` : "");
ensureStitchRuntimeCss(repoPath, usedClassTokens, stitchStyleBlocks);
writeUnknownMaterialIconsReport(repoPath, unknownMaterialIcons);
if (unknownMaterialIcons.size > 0) {
  console.warn("UNKNOWN_MATERIAL_ICONS: stitch-to-jsx used build-safe fallback icons.");
  for (const [iconName, count] of [...unknownMaterialIcons.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.warn(`  - ${iconName} (${count})`);
  }
  console.warn("Supervisor should repair icon fidelity if the generated fallback harms the UI.");
}
console.log("Generated", screenIndex.length, "screen(s)");
