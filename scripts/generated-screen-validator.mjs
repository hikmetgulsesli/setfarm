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
const fileTreeManifestPath = path.join(repoPath, ".setfarm", "setup", "FILE_TREE_MANIFEST.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function designDomScreens(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.screens)) return value.screens;
  if (value?.screens && typeof value.screens === "object") return Object.values(value.screens);
  return [];
}

function countDesignDomControls(screen) {
  if (!screen || typeof screen !== "object") return 0;
  const direct = [
    ...asArray(screen.components),
    ...asArray(screen.buttons),
    ...asArray(screen.inputs),
    ...asArray(screen.links),
    ...asArray(screen.navLinks),
    ...asArray(screen.navigation),
  ];
  let count = direct.filter((item) => item && typeof item === "object").length;
  for (const child of asArray(screen.children)) count += countDesignDomControls(child);
  return count;
}

function countUiContractControls(contracts) {
  return asArray(contracts).reduce((total, contract) => {
    if (!contract || typeof contract !== "object") return total;
    const explicit = Number(contract.totalInteractive);
    if (Number.isFinite(explicit) && explicit > 0) return total + explicit;
    return total
      + asArray(contract.elements).length
      + asArray(contract.buttons).length
      + asArray(contract.inputs).length
      + asArray(contract.navigation).length;
  }, 0);
}

function validateDesignDomExtraction() {
  const designDomPath = path.join(repoPath, "stitch", "DESIGN_DOM.json");
  const screenMapPath = path.join(repoPath, "stitch", "SCREEN_MAP.json");
  const uiContractPath = path.join(repoPath, "stitch", "UI_CONTRACT.json");
  if (!fs.existsSync(screenMapPath) && !fs.existsSync(uiContractPath) && !fs.existsSync(designDomPath)) return [];

  const screenMap = readJson(screenMapPath, []);
  const uiContract = readJson(uiContractPath, []);
  const expectedScreens = asArray(screenMap).length;
  const expectedControls = countUiContractControls(uiContract);
  if (expectedScreens === 0 && expectedControls === 0) return [];

  if (!fs.existsSync(designDomPath)) {
    return [failure(
      "DESIGN_DOM_EXTRACTION_MISSING",
      "DIV-010",
      designDomPath,
      "Stitch design has screen/control contracts but DESIGN_DOM.json is missing.",
      { expectedScreens, expectedControls },
    )];
  }

  const dom = readJson(designDomPath, null);
  const screens = designDomScreens(dom);
  const extractedControls = screens.reduce((total, screen) => total + countDesignDomControls(screen), 0);
  if (expectedScreens > 0 && screens.length === 0) {
    return [failure(
      "DESIGN_DOM_EXTRACTION_EMPTY",
      "DIV-010",
      designDomPath,
      "DESIGN_DOM.json contains no usable screens even though SCREEN_MAP.json declares screens.",
      { expectedScreens, expectedControls, extractedScreens: screens.length, extractedControls },
    )];
  }
  if (expectedControls > 0 && extractedControls === 0) {
    return [failure(
      "DESIGN_DOM_EXTRACTION_EMPTY",
      "DIV-010",
      designDomPath,
      "DESIGN_DOM.json contains no extracted controls even though UI_CONTRACT.json declares interactive controls.",
      { expectedScreens, expectedControls, extractedScreens: screens.length, extractedControls },
    )];
  }
  return [];
}

function validateGeneratedScreenCoverage(screens) {
  const screenMapPath = path.join(repoPath, "stitch", "SCREEN_MAP.json");
  if (!fs.existsSync(screenMapPath)) return [];
  const screenMap = asArray(readJson(screenMapPath, []));
  if (screenMap.length === 0) return [];
  if (screens.length >= screenMap.length) return [];
  return [failure(
    "DESIGN_IMPORT_SCREEN_COVERAGE_MISSING",
    "DIV-011",
    screenMapPath,
    `Generated screen coverage is incomplete: SCREEN_MAP declares ${screenMap.length} screen(s), but only ${screens.length} generated screen source file(s) were validated.`,
    {
      expectedScreens: screenMap.length,
      generatedScreens: screens.length,
      screenIds: screenMap.map((screen) => screen?.screenId || screen?.id || screen?.name).filter(Boolean),
      validatedFiles: screens.map((screen) => normalizeRel(screen.filePath)),
    },
  )];
}

function surfaceComponentTargetsFromManifest() {
  if (!fs.existsSync(fileTreeManifestPath)) return [];
  const manifest = readJson(fileTreeManifestPath, null);
  const targets = asArray(manifest?.resolvedTargets || manifest?.targets || manifest);
  return targets.filter((target) => {
    if (!target || typeof target !== "object") return false;
    return String(target.role || "") === "surface_component";
  });
}

function validateManifestScreenCoverage(screens) {
  const screenMapPath = path.join(repoPath, "stitch", "SCREEN_MAP.json");
  if (!fs.existsSync(screenMapPath) || !fs.existsSync(fileTreeManifestPath)) return [];
  const failures = [];
  const screenMap = asArray(readJson(screenMapPath, []));
  const targets = surfaceComponentTargetsFromManifest();
  if (screenMap.length === 0) return [];

  const targetsByScreenId = new Map();
  for (const target of targets) {
    const screenId = String(target.screenId || target.screen_id || "").trim();
    if (!screenId) continue;
    if (!targetsByScreenId.has(screenId)) targetsByScreenId.set(screenId, []);
    targetsByScreenId.get(screenId).push(target);
  }

  const validatedByFile = new Set(screens.map((screen) => normalizeRel(screen.filePath)));
  const indexedByScreenId = new Set(
    screens
      .map((screen) => String(screen.screenId || "").trim())
      .filter(Boolean),
  );

  for (const screen of screenMap) {
    const screenId = String(screen?.screenId || screen?.id || "").trim();
    if (!screenId) continue;
    const matchingTargets = targetsByScreenId.get(screenId) || [];
    if (matchingTargets.length === 0) {
      failures.push(failure(
        "DESIGN_IMPORT_MANIFEST_TARGET_MISSING",
        "DIV-012",
        fileTreeManifestPath,
        `FILE_TREE_MANIFEST has no surface_component target for SCREEN_MAP screen ${screenId}.`,
        { screenId, screenName: screen?.name || screen?.title || "" },
      ));
      continue;
    }

    for (const target of matchingTargets) {
      const rel = String(target.resolvedPath || target.path || "").replace(/\\/g, "/");
      if (!rel) {
        failures.push(failure(
          "DESIGN_IMPORT_MANIFEST_TARGET_INVALID",
          "DIV-012",
          fileTreeManifestPath,
          `FILE_TREE_MANIFEST surface_component target for ${screenId} has no path.`,
          { screenId, surfaceId: target.surfaceId || target.surface_id || "" },
        ));
        continue;
      }
      const abs = path.join(repoPath, rel);
      if (!fs.existsSync(abs)) {
        failures.push(failure(
          "DESIGN_IMPORT_MANIFEST_FILE_MISSING",
          "DIV-012",
          abs,
          `FILE_TREE_MANIFEST declares generated screen ${rel} for ${screenId}, but the file does not exist.`,
          { screenId, surfaceId: target.surfaceId || target.surface_id || "", expectedFile: rel },
        ));
        continue;
      }
      if (!validatedByFile.has(rel)) {
        failures.push(failure(
          "DESIGN_IMPORT_MANIFEST_FILE_UNVALIDATED",
          "DIV-012",
          abs,
          `FILE_TREE_MANIFEST declares generated screen ${rel} for ${screenId}, but validator did not validate that source file.`,
          { screenId, surfaceId: target.surfaceId || target.surface_id || "", expectedFile: rel },
        ));
      }
    }
  }

  if (indexedByScreenId.size > 0) {
    for (const target of targets) {
      const screenId = String(target.screenId || target.screen_id || "").trim();
      if (screenId && !indexedByScreenId.has(screenId)) {
        failures.push(failure(
          "DESIGN_IMPORT_SCREEN_INDEX_MISMATCH",
          "DIV-012",
          screenIndexPath,
          `SCREEN_INDEX.json does not include manifest screen ${screenId}.`,
          { screenId, expectedFile: target.resolvedPath || target.path || "" },
        ));
      }
    }
  }

  return failures;
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

function hasBaseClass(tokens, className) {
  return tokens.some(token => {
    const { variant, base } = splitTailwindVariant(token);
    return !variant && base === className;
  });
}

function hasAnyBaseClass(tokens, pattern) {
  return tokens.some(token => {
    const { variant, base } = splitTailwindVariant(token);
    return !variant && pattern.test(base);
  });
}

function hasVariantClass(tokens, variantName, className) {
  return tokens.some(token => {
    const { variant, base } = splitTailwindVariant(token);
    return variant === variantName && base === className;
  });
}

function getBaseArbitraryPx(tokens, prefix) {
  for (const token of tokens) {
    const { variant, base } = splitTailwindVariant(token);
    if (variant) continue;
    const match = base.match(new RegExp(`^${prefix}-\\[(\\d+)px\\]$`));
    if (match) return Number(match[1]);
  }
  return null;
}

function getBaseScaleNumber(tokens, prefix) {
  for (const token of tokens) {
    const { variant, base } = splitTailwindVariant(token);
    if (variant) continue;
    const match = base.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (match) return Number(match[1]);
  }
  return null;
}

function hasCenteredShape(tokens) {
  if (hasBaseClass(tokens, "rounded-full") || hasBaseClass(tokens, "aspect-square")) return true;
  const pxWidth = getBaseArbitraryPx(tokens, "w");
  const pxHeight = getBaseArbitraryPx(tokens, "h");
  if (pxWidth && pxHeight && pxWidth === pxHeight) return true;
  const scaleWidth = getBaseScaleNumber(tokens, "w");
  const scaleHeight = getBaseScaleNumber(tokens, "h");
  return Boolean(scaleWidth && scaleHeight && scaleWidth === scaleHeight);
}

function hasUnsafeCenteredAbsolute(tokens) {
  if (!hasBaseClass(tokens, "absolute")) return false;
  if (!hasBaseClass(tokens, "top-1/2") || !hasBaseClass(tokens, "left-1/2")) return false;
  if (!hasCenteredShape(tokens)) return false;
  return !hasBaseClass(tokens, "-translate-x-1/2") || !hasBaseClass(tokens, "-translate-y-1/2");
}

function normalizeCenteredAbsolute(tokens) {
  if (!hasUnsafeCenteredAbsolute(tokens)) return tokens;
  const next = [...tokens];
  if (!hasBaseClass(next, "transform")) next.push("transform");
  if (!hasBaseClass(next, "-translate-x-1/2")) next.push("-translate-x-1/2");
  if (!hasBaseClass(next, "-translate-y-1/2")) next.push("-translate-y-1/2");
  return next;
}

function hasBaseWidthGuard(tokens) {
  return tokens.some(token => {
    const { variant, base } = splitTailwindVariant(token);
    if (variant) return false;
    return base === "w-full" ||
      base === "max-w-full" ||
      base === "max-w-none" ||
      /^w-\[calc\(100vw[-+]/.test(base) ||
      /^max-w-\[/.test(base);
  });
}

function hasUnsafeMobileFixedSquarePlayfield(tokens) {
  const width = getBaseArbitraryPx(tokens, "w");
  const height = getBaseArbitraryPx(tokens, "h");
  if (!width || !height || width !== height || width < 360) return false;
  if (hasBaseWidthGuard(tokens)) return false;
  return true;
}

function hasUnsafeMobileHorizontalBoardContainer(tokens) {
  if (!hasBaseClass(tokens, "overflow-x-auto")) return false;
  if (!hasBaseClass(tokens, "flex")) return false;
  if (hasBaseClass(tokens, "flex-col")) return false;
  if (!hasAnyBaseClass(tokens, /^(gap|space-x)-/)) return false;
  return true;
}

function hasUnsafeMobileFixedLane(tokens) {
  if (!hasBaseClass(tokens, "flex-shrink-0")) return false;
  if (hasBaseClass(tokens, "w-full") || hasAnyBaseClass(tokens, /^w-\[/)) return false;
  const classSet = new Set(tokens.map(token => splitTailwindVariant(token).base));
  return classSet.has("kanban-column") || (classSet.has("flex-col") && classSet.has("h-full"));
}

function hasUnsafeMobileHorizontalBoard(tokens) {
  return hasUnsafeMobileHorizontalBoardContainer(tokens) || hasUnsafeMobileFixedLane(tokens);
}

function hasUnsafeMobileOverflow(tokens) {
  return hasUnsafeMobileHorizontalBoard(tokens) || hasUnsafeMobileFixedSquarePlayfield(tokens);
}

function normalizeMobileHorizontalBoard(tokens) {
  let next = [...tokens];
  let changed = false;

  if (hasUnsafeMobileHorizontalBoardContainer(next)) {
    next = next.filter(token => {
      const { variant, base } = splitTailwindVariant(token);
      return !(variant === "" && ["overflow-x-auto", "items-start"].includes(base));
    });
    if (!hasBaseClass(next, "overflow-x-visible")) next.push("overflow-x-visible");
    if (!hasVariantClass(next, "md", "overflow-x-auto")) next.push("md:overflow-x-auto");
    if (!hasBaseClass(next, "flex-col")) next.push("flex-col");
    if (!hasVariantClass(next, "md", "flex-row")) next.push("md:flex-row");
    if (!hasBaseClass(next, "items-stretch")) next.push("items-stretch");
    if (!hasVariantClass(next, "md", "items-start")) next.push("md:items-start");
    changed = true;
  }

  if (hasUnsafeMobileFixedLane(next)) {
    next = next.filter(token => {
      const { variant, base } = splitTailwindVariant(token);
      return !(variant === "" && base === "flex-shrink-0");
    });
    if (!hasBaseClass(next, "w-full")) next.push("w-full");
    if (!hasVariantClass(next, "md", "w-72")) next.push("md:w-72");
    if (!hasVariantClass(next, "md", "flex-shrink-0")) next.push("md:flex-shrink-0");
    changed = true;
  }

  return changed ? next : tokens;
}

function normalizeMobileFixedSquarePlayfield(tokens) {
  if (!hasUnsafeMobileFixedSquarePlayfield(tokens)) return tokens;

  const width = getBaseArbitraryPx(tokens, "w");
  const height = getBaseArbitraryPx(tokens, "h");
  let next = tokens.filter(token => {
    const { variant, base } = splitTailwindVariant(token);
    return !(variant === "" && (base === `w-[${width}px]` || base === `h-[${height}px]`));
  });

  if (!hasBaseClass(next, "w-[calc(100vw-48px)]")) next.push("w-[calc(100vw-48px)]");
  if (!hasBaseClass(next, "max-w-[360px]")) next.push("max-w-[360px]");
  if (!hasBaseClass(next, "aspect-square")) next.push("aspect-square");
  if (!hasVariantClass(next, "md", `w-[${width}px]`)) next.push(`md:w-[${width}px]`);
  if (!hasVariantClass(next, "md", `h-[${height}px]`)) next.push(`md:h-[${height}px]`);
  if (!hasVariantClass(next, "md", "max-w-none")) next.push("md:max-w-none");

  return next;
}

function normalizeMobileOverflow(tokens) {
  return normalizeMobileFixedSquarePlayfield(normalizeMobileHorizontalBoard(tokens));
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
        screenId: screen.screenId || screen.id || "",
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
      screenId: "",
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
  const screenMap = asArray(readJson(path.join(repoPath, "stitch", "SCREEN_MAP.json"), []));
  const screenMapEntry = screenMap.find((item) => {
    const id = String(item?.screenId || item?.id || "").trim();
    return id && id === String(screen.screenId || "").trim();
  }) || {};
  const screenKind = `${screen.title || ""} ${screen.componentName || ""} ${screenMapEntry?.type || ""} ${asArray(screenMapEntry?.surfaceIds).join(" ")}`;

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
    if (new RegExp(`\\s${escapeRegExp(attr)}\\s*=`).test(code)) {
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
    if (hasUnsafeMobileOverflow(tokens)) {
      failures.push(failure(
        "DESIGN_IMPORT_MOBILE_OVERFLOW_UNSAFE",
        "DIV-004",
        screen.filePath,
        "Generated mobile layout contains fixed-width board/playfield utilities that can overflow mobile viewports before implementation.",
        { className: match[2] },
      ));
    }
    if (hasUnsafeCenteredAbsolute(tokens)) {
      failures.push(failure(
        "DESIGN_IMPORT_CENTERED_ABSOLUTE_UNSAFE",
        "DIV-014",
        screen.filePath,
        "Absolute centered shape uses top-1/2 left-1/2 without matching translate centering utilities, which can push playfield elements off mobile viewports.",
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

  if (/\b(gameplay|playfield|browser[- ]?game|arcade|SURF_GAMEPLAY)\b/i.test(screenKind)) {
    const runtimeType = (code.match(/runtime\?\s*:\s*([^;]+);/s)?.[1] || "").replace(/\s+/g, " ");
    const hasGameRuntimeShape = /\b(ball|paddle|bricks|lives|player|obstacles|velocity|position)\b/.test(runtimeType);
    const hasStaticGameObjectMarkers =
      /{\s*\/\*\s*(Ball|Paddle|Player|Obstacle|Bricks?)/i.test(code) ||
      /\b(?:top-1\/2|left-1\/[23]|left-1\/2|bottom-8|translate-x-1\/2)\b/.test(code);
    if (hasStaticGameObjectMarkers && !hasGameRuntimeShape) {
      failures.push(failure(
        "DESIGN_IMPORT_GAME_DYNAMIC_BINDING_MISSING",
        "DIV-013",
        screen.filePath,
        "Gameplay generated screen renders static game-object placeholders but does not accept runtime position/state props.",
        { runtimeType: runtimeType || "(missing)" },
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
    let normalized = normalizeUnsafePositionedFullWidth(tokens);
    const afterPositionFix = normalized.join(" ");
    normalized = normalizeMobileOverflow(normalized);
    const afterMobileFix = normalized.join(" ");
    normalized = normalizeCenteredAbsolute(normalized);
    if (normalized.join(" ") === classValue) return full;
    if (afterPositionFix !== tokens.join(" ")) {
      applied.push({
        ruleId: "CONV-003",
        file: normalizeRel(screen.filePath),
        before: classValue,
        after: afterPositionFix,
      });
    }
    if (normalized.join(" ") !== afterPositionFix) {
      applied.push({
        ruleId: "CONV-005",
        file: normalizeRel(screen.filePath),
        before: afterPositionFix,
        after: normalized.join(" "),
      });
    }
    if (normalized.join(" ") !== afterMobileFix) {
      applied.push({
        ruleId: "CONV-006",
        file: normalizeRel(screen.filePath),
        before: afterMobileFix,
        after: normalized.join(" "),
      });
    }
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
failures.push(...validateGeneratedScreenCoverage(screens));
failures.push(...validateManifestScreenCoverage(screens));
failures.push(...validateDesignDomExtraction());
const report = {
  schema: "setfarm.design-import-validate.v1",
  status: failures.length > 0 ? "fail" : screens.length === 0 ? "skipped" : "pass",
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
