import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function collectSourceFiles(root, out = []) {
  let entries = [];
  try {
    entries = readdirSync(root);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = join(root, entry);
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (/^(node_modules|dist|build|coverage|\.git|\.next|stitch|references)$/.test(entry)) continue;
      collectSourceFiles(abs, out);
      continue;
    }
    if (/\.(tsx?|jsx?)$/i.test(entry)) out.push(abs);
  }
  return out;
}

function stackPackFromRepo(repo) {
  for (const file of [
    join(repo, ".setfarm", "ledger", "stack-contract.json"),
    join(repo, ".setfarm", "RUN_CONTRACT.json"),
  ]) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf-8"));
      const packId = parsed.packId || parsed.stack_pack_id || parsed.detected_stack || parsed.setup_stack_pack_id || "";
      if (packId) return String(packId);
    } catch {}
  }
  return "";
}

export function isBrowserGameRepo(repo) {
  return stackPackFromRepo(repo) === "browser-game-canvas";
}

export function browserGameZeroInteractionIssues(repo, interactionCount) {
  if (!isBrowserGameRepo(repo) || interactionCount > 0) return [];
  return ['[INTERACT] browser-game-zero-interactions: browser-game smoke cannot pass without exercising at least one gameplay/settings control'];
}

export function checkBrowserGameStaticContracts(repo) {
  if (!isBrowserGameRepo(repo)) return [];
  const issues = [];
  const sourceFiles = collectSourceFiles(repo);
  const allSource = sourceFiles.map((f) => {
    try { return `\n// FILE: ${relative(repo, f).replace(/\\/g, "/")}\n${readFileSync(f, "utf-8")}`; } catch { return ""; }
  }).join("\n");

  const hasScheduledLoop = /\b(setInterval|requestAnimationFrame)\b/.test(allSource);
  const hasImperativeTickCall = /\b(actions?\.)?(tick|advance|step|update)\s*\(/.test(allSource);
  const hasDispatchedTickAction = /\bdispatch\s*\(\s*\{[^}]*\btype\s*:\s*['"`](?:TICK|ADVANCE|STEP|UPDATE)['"`]/.test(allSource);
  if (!hasScheduledLoop || (!hasImperativeTickCall && !hasDispatchedTickAction)) {
    issues.push("browser game has no visible runtime loop wired through setInterval/requestAnimationFrame and a tick/advance/update action");
  }

  const appPath = join(repo, "src", "App.tsx");
  let app = "";
  if (existsSync(appPath)) {
    app = readFileSync(appPath, "utf-8");
    const rootMatch = app.match(/data-setfarm-root(?:=["'][^"']+["'])?[^>]*className=["']([^"']*)["']/s);
    const rootClass = rootMatch?.[1] || "";
    const hasRootMarker = /\bdata-setfarm-root\b/.test(app);
    const hasViewportHeight = /\b(?:h-screen|min-h-screen|h-dvh|min-h-dvh|h-\[(?:100d?vh|100%)\]|min-h-\[(?:100d?vh|100%)\])\b/.test(rootClass);
    const hasViewportWidth = /\b(?:w-full|w-screen|min-w-full|min-w-screen)\b/.test(rootClass);
    const hasOverflowControl = /\b(?:overflow-hidden|overflow-x-hidden)\b/.test(rootClass);
    const hasViewportFrame = /\b(?:relative|flex|fixed|absolute)\b/.test(rootClass);
    if (!hasRootMarker || !rootClass || !hasViewportHeight || !hasViewportWidth || !hasOverflowControl || !hasViewportFrame) {
      issues.push(`browser game app root must declare a full viewport frame with position/flex, height, width, and overflow control: ${rootClass || "<missing className>"}`);
    }
    if (!/\b(?:Escape|KeyP|settings|openSettings)\b/.test(app)) {
      issues.push("browser game does not expose a visible or keyboard settings path from gameplay");
    }
  }

  const screenIndex = readJsonFile(join(repo, "src", "screens", "SCREEN_INDEX.json"), []);
  const gameplayScreens = Array.isArray(screenIndex)
    ? screenIndex.filter((screen) => {
      const label = `${screen.title || ""} ${screen.componentName || ""} ${screen.file || ""}`;
      return /\b(gameplay|playfield)\b/i.test(label) || (/\bgame\b/i.test(label) && !/\b(settings?|config|preferences?|pause|menu)\b/i.test(label));
    })
    : [];
  for (const screen of gameplayScreens) {
    const rel = String(screen.file || "");
    if (!rel) continue;
    const abs = join(repo, rel);
    if (!existsSync(abs)) continue;
    const code = readFileSync(abs, "utf-8");
    const classValues = [...code.matchAll(/\bclassName=["']([^"']*)["']/g)].map((m) => m[1]);
    const primaryClass = classValues.find((value) => /\b(?:aspect-video|max-w-\[|m-playfield-margin|border|overflow-hidden)\b/.test(value)) || "";
    if (primaryClass && /\bmax-w-\[/.test(primaryClass) && !/\b(?:h-screen|min-h-screen|w-screen)\b/.test(primaryClass)) {
      issues.push(`${rel}: gameplay surface is boxed (${primaryClass}) instead of owning a stable viewport game scene`);
    }
    const runtimeType = (code.match(/runtime\?\s*:\s*([^;]+);/s)?.[1] || "").replace(/\s+/g, " ");
    const hasGameRuntimeShape = /\b(ball|paddle|bricks|lives|player|obstacles|velocity)\b/.test(runtimeType);
    const hasStaticGameObjects =
      /{\s*\/\*\s*(Ball|Paddle|Player|Obstacle|Bricks?)/i.test(code) ||
      /\b(?:top-1\/2|left-1\/[23]|left-1\/2|bottom-8|translate-x-1\/2)\b/.test(code);
    if (hasStaticGameObjects && !hasGameRuntimeShape) {
      issues.push(`${rel}: visible game objects are static CSS placeholders; runtime prop does not include ball/paddle/bricks/lives/player position state`);
    }
    const hasPositionRuntimeShape = /\b(?:player|ball|paddle|obstacles?|shards?|items?|enemies?)\??\s*:\s*(?:Array<)?[^{;]*\{[^}]*\b(?:lane|x|y|position|top|left|row|col)\b/i.test(runtimeType) ||
      /\b(?:player|ball|paddle|obstacles?|shards?|items?|enemies?)\b[\s\S]{0,140}\b(?:lane|x|y|position|top|left|row|col)\b/i.test(runtimeType);
    const usesRuntimePosition = /\bruntime\??\.(?:player|ball|paddle|obstacles?|shards?|items?|enemies?)[\s\S]{0,220}\b(?:lane|x|y|position|top|left|row|col)\b/i.test(code) ||
      /\b(?:style|className)\s*=\s*\{[\s\S]{0,300}\bruntime\??\./i.test(code) ||
      /\.map\(\s*\(?\s*(?:obstacle|shard|item|enemy|brick|entity|o|s|i)\b[\s\S]{0,320}\b(?:style|className)\s*=/i.test(code);
    if (hasPositionRuntimeShape && hasStaticGameObjects && !usesRuntimePosition) {
      issues.push(`${rel}: gameplay runtime exposes moving position state, but visible game objects are not positioned from runtime data`);
    }
  }

  if (app) {
    const overlayScreens = gameplayScreens
      .map((screen) => String(screen.file || ""))
      .filter(Boolean);
    const screenIndexAll = Array.isArray(screenIndex) ? screenIndex : [];
    const modalScreens = screenIndexAll.filter((screen) => {
      const rel = String(screen.file || "");
      if (!rel || overlayScreens.includes(rel)) return false;
      const title = `${screen.title || ""} ${screen.componentName || ""} ${rel}`;
      if (!/\b(settings?|config|preferences?|pause|menu)\b/i.test(title)) return false;
      const abs = join(repo, rel);
      if (!existsSync(abs)) return false;
      const code = readFileSync(abs, "utf-8");
      return /\b(?:modal|overlay|backdrop|absolute inset-0|fixed inset-0|z-\d+|backdrop-blur)\b/i.test(code);
    });
    const exclusiveSettingsRender = /\?\s*\(?\s*<[^>]*(?:Settings|Config|Preferences|Pause|Menu)[\s\S]{0,260}\)?\s*:\s*\(?\s*<[^>]*(?:Gameplay|Game|Playfield)/i.test(app) ||
      /\bactiveScreen\s*===\s*["'](?:settings|config|preferences|pause|menu)["'][\s\S]{0,260}\?\s*\(?\s*</i.test(app);
    if (modalScreens.length > 0 && gameplayScreens.length > 0 && exclusiveSettingsRender) {
      issues.push(`browser game modal/settings overlay replaces gameplay instead of rendering above it; keep the gameplay scene mounted behind overlay screens (${modalScreens.map(s => s.file).join(", ")})`);
    }
  }

  return issues;
}
