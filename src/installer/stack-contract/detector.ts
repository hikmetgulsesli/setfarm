import fs from "node:fs";
import path from "node:path";
import type { StackCandidate, StackEvidence, StackPackId } from "./types.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

const TASK_HINTS: Array<{ packId: StackPackId; pattern: RegExp; value: string; weight: number }> = [
  { packId: "nextjs-web-app", pattern: /\b(next\.?js|nextjs)\b/i, value: "task mentions Next.js", weight: 70 },
  { packId: "vite-react-web-app", pattern: /\b(vite|react spa|single page app|single-page app)\b/i, value: "task mentions Vite or React SPA", weight: 55 },
  { packId: "static-html-site", pattern: /\b(static html|plain html|single html|landing page|marketing page)\b/i, value: "task mentions static HTML or landing page", weight: 55 },
  { packId: "browser-game-canvas", pattern: /\b(browser game|arcade|tetris|pong|breakout|canvas game|game loop|playable game|keyboard controls|touch controls)\b/i, value: "task mentions browser game behavior", weight: 85 },
  { packId: "python-cli", pattern: /\b(python cli|command line|terminal tool|automation script)\b/i, value: "task mentions Python CLI", weight: 65 },
  { packId: "python-web", pattern: /\b(fastapi|flask|django|python web|api server)\b/i, value: "task mentions Python web server", weight: 70 },
  { packId: "android-app", pattern: /\b(android|kotlin|jetpack compose|gradle)\b/i, value: "task mentions Android", weight: 85 },
  { packId: "ios-app", pattern: /\b(ios|iphone|swiftui|swift|xcode|uikit)\b/i, value: "task mentions iOS", weight: 85 },
];

export function detectStackCandidates(repoPath?: string, taskText = ""): StackCandidate[] {
  const candidates = new Map<StackPackId, StackCandidate>();

  function add(packId: StackPackId, evidence: StackEvidence): void {
    const existing = candidates.get(packId) ?? { packId, score: 0, evidence: [] };
    existing.score += evidence.weight;
    existing.evidence.push(evidence);
    candidates.set(packId, existing);
  }

  for (const hint of extractTaskHintEvidence(taskText)) {
    add(hint.packId, hint.evidence);
  }

  if (repoPath && fs.existsSync(repoPath)) {
    collectRepoEvidence(repoPath, add);
  }

  adjustBrowserGameSpecificity(candidates);
  return [...candidates.values()].sort((a, b) => b.score - a.score || a.packId.localeCompare(b.packId));
}

export function extractTaskHints(taskText = ""): string[] {
  const normalized = taskText.trim();
  if (!normalized) return [];
  return TASK_HINTS
    .filter((hint) => hint.pattern.test(normalized))
    .map((hint) => hint.value);
}

function extractTaskHintEvidence(taskText: string): Array<{ packId: StackPackId; evidence: StackEvidence }> {
  const normalized = taskText.trim();
  if (!normalized) return [];
  return TASK_HINTS
    .filter((hint) => hint.pattern.test(normalized))
    .map((hint) => ({
      packId: hint.packId,
      evidence: {
        type: "task-hint",
        value: hint.value,
        weight: hint.weight,
      },
    }));
}

function collectRepoEvidence(
  repoPath: string,
  add: (packId: StackPackId, evidence: StackEvidence) => void,
): void {
  const pkg = readPackageJson(path.join(repoPath, "package.json"));
  if (pkg) collectPackageEvidence(pkg, add);

  if (exists(repoPath, "next.config.js") || exists(repoPath, "next.config.mjs") || exists(repoPath, "next.config.ts")) {
    add("nextjs-web-app", fileEvidence("next.config.*", 80));
  }
  if (exists(repoPath, "app")) add("nextjs-web-app", dirEvidence("app/", 35));
  if (exists(repoPath, "pages")) add("nextjs-web-app", dirEvidence("pages/", 30));

  if (exists(repoPath, "vite.config.ts") || exists(repoPath, "vite.config.js") || exists(repoPath, "vite.config.mjs")) {
    add("vite-react-web-app", fileEvidence("vite.config.*", 70));
  }
  if (exists(repoPath, "src/main.tsx") || exists(repoPath, "src/main.jsx")) {
    add("vite-react-web-app", fileEvidence("src/main.tsx or src/main.jsx", 35));
  }

  if (exists(repoPath, "index.html")) {
    add("static-html-site", fileEvidence("index.html", 45));
    add("vite-react-web-app", fileEvidence("index.html", 10));
  }

  if (exists(repoPath, "pyproject.toml")) add("python-cli", fileEvidence("pyproject.toml", 45));
  if (exists(repoPath, "requirements.txt")) add("python-cli", fileEvidence("requirements.txt", 30));
  if (exists(repoPath, "main.py") || exists(repoPath, "cli.py")) add("python-cli", fileEvidence("main.py or cli.py", 35));
  collectPythonFrameworkEvidence(repoPath, add);

  if (
    exists(repoPath, "settings.gradle")
    || exists(repoPath, "settings.gradle.kts")
    || exists(repoPath, "build.gradle")
    || exists(repoPath, "build.gradle.kts")
    || exists(repoPath, "app/build.gradle")
    || exists(repoPath, "app/build.gradle.kts")
  ) {
    add("android-app", fileEvidence("Gradle Android project files", 75));
  }
  if (exists(repoPath, "app/src/main/AndroidManifest.xml")) {
    add("android-app", fileEvidence("AndroidManifest.xml", 80));
  }

  collectIosEvidence(repoPath, add);
}

function collectPackageEvidence(pkg: PackageJson, add: (packId: StackPackId, evidence: StackEvidence) => void): void {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  if (deps.next) add("nextjs-web-app", dependencyEvidence("next", 95));
  if (deps.vite) add("vite-react-web-app", dependencyEvidence("vite", 65));
  if (deps.react) add("vite-react-web-app", dependencyEvidence("react", 25));
  if (deps["@vitejs/plugin-react"]) add("vite-react-web-app", dependencyEvidence("@vitejs/plugin-react", 35));
  if (deps.fastapi) add("python-web", dependencyEvidence("fastapi", 80));
  if (deps.flask) add("python-web", dependencyEvidence("flask", 80));
  if (deps.django) add("python-web", dependencyEvidence("django", 80));

  const scripts = pkg.scripts ?? {};
  if (/\bnext\b/.test(Object.values(scripts).join("\n"))) add("nextjs-web-app", scriptEvidence("next script", 25));
  if (/\bvite\b/.test(Object.values(scripts).join("\n"))) add("vite-react-web-app", scriptEvidence("vite script", 25));
}

function collectPythonFrameworkEvidence(repoPath: string, add: (packId: StackPackId, evidence: StackEvidence) => void): void {
  const requirementFiles = ["requirements.txt", "pyproject.toml"];
  for (const relative of requirementFiles) {
    const file = path.join(repoPath, relative);
    if (!fs.existsSync(file)) continue;
    const text = safeRead(file);
    if (/\b(fastapi|flask|django|starlette)\b/i.test(text)) {
      add("python-web", fileEvidence(`${relative} web framework dependency`, 75));
    }
  }
  for (const relative of ["app.py", "main.py", "src/main.py"]) {
    const file = path.join(repoPath, relative);
    if (!fs.existsSync(file)) continue;
    const text = safeRead(file);
    if (/\b(FastAPI|Flask|Django|uvicorn|app\.route|@app\.)\b/.test(text)) {
      add("python-web", fileEvidence(`${relative} web framework code`, 80));
    }
  }
}

function collectIosEvidence(repoPath: string, add: (packId: StackPackId, evidence: StackEvidence) => void): void {
  if (exists(repoPath, "Info.plist")) add("ios-app", fileEvidence("Info.plist", 45));
  for (const entry of safeReadDir(repoPath)) {
    if (entry.endsWith(".xcodeproj") || entry.endsWith(".xcworkspace")) {
      add("ios-app", fileEvidence(entry, 90));
    }
    if (entry.endsWith(".swift")) {
      add("ios-app", fileEvidence(entry, 45));
    }
  }
  if (exists(repoPath, "Package.swift")) {
    const text = safeRead(path.join(repoPath, "Package.swift"));
    if (/\b(iOS|UIKit|SwiftUI)\b/.test(text)) add("ios-app", fileEvidence("Package.swift iOS target", 60));
  }
}

function adjustBrowserGameSpecificity(candidates: Map<StackPackId, StackCandidate>): void {
  const game = candidates.get("browser-game-canvas");
  if (!game) return;
  if (candidates.has("nextjs-web-app") || candidates.has("android-app") || candidates.has("ios-app") || candidates.has("python-web") || candidates.has("python-cli")) {
    return;
  }
  if (candidates.has("vite-react-web-app") || candidates.has("static-html-site")) {
    game.score += 40;
    game.evidence.push({
      type: "task-hint",
      value: "browser game hint is more specific than generic browser runtime evidence",
      weight: 40,
    });
  }
}

function readPackageJson(file: string): PackageJson | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as PackageJson;
  } catch {
    return null;
  }
}

function safeRead(file: string): string {
  try {
    return fs.readFileSync(file, "utf-8").slice(0, 20000);
  } catch {
    return "";
  }
}

function safeReadDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function exists(root: string, relative: string): boolean {
  return fs.existsSync(path.join(root, relative));
}

function dependencyEvidence(value: string, weight: number): StackEvidence {
  return { type: "dependency", value, weight };
}

function scriptEvidence(value: string, weight: number): StackEvidence {
  return { type: "script", value, weight };
}

function fileEvidence(value: string, weight: number): StackEvidence {
  return { type: "file", path: value, value, weight };
}

function dirEvidence(value: string, weight: number): StackEvidence {
  return { type: "directory", path: value, value, weight };
}
