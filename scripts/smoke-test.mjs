#!/usr/bin/env node
/**
 * Smoke Test v7 — Hybrid: static analysis + agent-browser interactive check.
 *
 * Phase 1 (fast): Component wiring, route discovery — pure filesystem
 * Phase 2 (browser): Homepage load, primary button click, placeholder detection
 * Phase 3 (browser): Link validation — navigate internal links, check for errors
 * Phase 4 (browser): Button functionality — click buttons, verify responses
 * Phase 5 (browser): Form testing — fill inputs, submit forms
 * Phase 6  (browser): Accessibility basics — alt text, aria labels, heading hierarchy
 * Phase 7  (browser): Visual & Asset Integrity — icons, images, fonts, contrast
 * Phase 8  (browser): Layout & UX Glitches — overflow, duplicate IDs, z-index overlap
 * Phase 9  (browser): Network Silent Failures — fetch/XHR error collection
 * Phase 10 (browser): Console error collection — JS error aggregation
 * Phase 11 (browser): Hydration & Interactivity
 * Phase 13 (browser): Content Sanity — hallucinated text, debug artifacts, raw vars
 * Phase 14 (browser): Interaction Dead-Ends — buttons with no DOM response — stalled UI, unresponsive buttons
 * Phase 15 (browser): Interactive State Verification — keyboard input→state change (canvas, SPA, dashboard)
 * Phase 16 (static):  Design Fidelity — DESIGN_DOM vs code element counts, CSS token usage
 *   Uses agent-browser CLI for real browser interaction
 *
 * Usage: node smoke-test.mjs <repo-path> [--port PORT] [--timeout MS]
 * Exit codes: 0 = pass, 1 = failures found, 2 = script error
 */

import { execFileSync, spawn } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, basename, relative } from 'path';
import { pathToFileURL } from 'url';

const args = process.argv.slice(2);
const repoPath = args[0];
const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

// ── Phase 17 (static): Tailwind v4 compile sanity ─────────────────
// Fails fast if src CSS imports tailwindcss but dist CSS has no compiled
// utilities. Catches the "Vite plugin not wired" silent breakage that
// ships unstyled pages despite a successful build (run #342 precedent).
import { existsSync as _twExists, readFileSync as _twRead, readdirSync as _twReaddir, statSync as _twStat } from 'fs';
import { join as _twJoin } from 'path';
function checkTailwindCompiled(repo) {
  try {
    if (!repo || !_twExists(_twJoin(repo, 'src'))) return null;
    const srcDir = _twJoin(repo, 'src');
    let importsTailwind = false;
    const walk = (d) => {
      for (const e of _twReaddir(d)) {
        const f = _twJoin(d, e);
        try {
          const st = _twStat(f);
          if (st.isDirectory()) { walk(f); continue; }
          if (!/\.css$/.test(f)) continue;
          const c = _twRead(f, 'utf-8');
          if (/@import\s+["']tailwindcss["']/.test(c) || /@tailwind\s+/.test(c)) {
            importsTailwind = true;
          }
        } catch {}
      }
    };
    walk(srcDir);
    if (!importsTailwind) return null;
    const distCandidates = ['dist/assets', 'dist', 'build/assets', 'build', '.next/static/css'];
    let distCssFiles = [];
    for (const rel of distCandidates) {
      const d = _twJoin(repo, rel);
      if (!_twExists(d)) continue;
      try {
        for (const e of _twReaddir(d)) {
          if (e.endsWith('.css')) distCssFiles.push(_twJoin(d, e));
        }
      } catch {}
    }
    if (distCssFiles.length === 0) {
      return { ok: false, reason: 'src CSS imports tailwindcss but no built CSS found in dist/build/.next' };
    }
    let hasUtilities = false;
    for (const f of distCssFiles) {
      const c = _twRead(f, 'utf-8');
      if (/\.flex\s*\{|\.grid\s*\{|\.block\s*\{|\.hidden\s*\{|\.p-\d|\.m-\d|\.text-\w/.test(c)) {
        hasUtilities = true; break;
      }
    }
    if (!hasUtilities) {
      return {
        ok: false,
        reason: 'src CSS imports tailwindcss but dist CSS has ZERO compiled utilities (.flex, .grid, .p-*, etc.). ' +
                'Tailwind is being shipped raw — check @tailwindcss/vite plugin wiring in vite.config.*'
      };
    }
    return { ok: true };
  } catch (e) {
    return null;
  }
}
const _twCheck = checkTailwindCompiled(repoPath);
if (isCli && _twCheck && !_twCheck.ok) {
  console.log(JSON.stringify({
    status: 'fail',
    failures: ['[TAILWIND] ' + _twCheck.reason],
    phase: 'tailwind-compile-sanity'
  }));
  process.exit(1);
}

if (isCli && !repoPath) { console.error('Usage: node smoke-test.mjs <repo-path> [--port PORT]'); process.exit(2); }

const portArgIdx = args.indexOf('--port');
const requestedPort = portArgIdx !== -1 ? parseInt(args[portArgIdx + 1], 10) : 0;

// ── agent-browser wrapper ───────────────────────────────────────────
function ab(...cmdArgs) {
  try {
    return execFileSync('agent-browser', cmdArgs, {
      encoding: 'utf-8', timeout: 12000, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim().replace(/\x1b\[[0-9;]*m/g, ''); // strip ANSI
  } catch (err) {
    return `__ERR__: ${(err.stderr || err.message || '').trim().replace(/\x1b\[[0-9;]*m/g, '')}`;
  }
}
function abOk(...a) { const r = ab(...a); return r.startsWith('__ERR__') ? null : r; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseEvalJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'string') return parsed;
    try { return JSON.parse(parsed); } catch { return fallback; }
  } catch {
    return fallback;
  }
}

// ── Filesystem helpers ──────────────────────────────────────────────
function walkDir(dir, cb) {
  try {
    for (const e of readdirSync(dir)) {
      if (['node_modules','.next','.git','dist','build','.output'].includes(e)) continue;
      const f = join(dir, e);
      try { if (statSync(f).isDirectory()) walkDir(f, cb); else cb(f); } catch {}
    }
  } catch {}
}

function detectServeDir(repo) {
  for (const d of ['dist','build','out','public','.next','.output','src']) {
    const f = join(repo, d);
    if (existsSync(f) && existsSync(join(f, 'index.html'))) return f;
  }
  if (existsSync(join(repo, 'index.html'))) return repo;
  return null;
}

// ── Phase 1: Static Analysis ────────────────────────────────────────

function discoverRoutes(repo) {
  const routes = ['/'];
  for (const appDir of [join(repo,'src','app'), join(repo,'app')]) {
    if (!existsSync(appDir)) continue;
    walkDir(appDir, f => {
      if (/page\.(tsx?|jsx?)$/.test(f)) {
        const r = '/'+relative(appDir,f).replace(/\\/g,'/').replace(/\/page\.(tsx?|jsx?)$/,'');
        if (!r.includes('[') && r !== '/') routes.push(r);
      }
    });
  }
  for (const pd of [join(repo,'src','pages'), join(repo,'pages')]) {
    if (!existsSync(pd)) continue;
    walkDir(pd, f => {
      if (/\.(tsx?|jsx?)$/.test(f) && !f.includes('_app') && !f.includes('_document') && !f.includes('api/')) {
        const r = '/'+relative(pd,f).replace(/\\/g,'/').replace(/\.(tsx?|jsx?)$/,'').replace(/\/index$/,'');
        if (!r.includes('[') && r && r !== '/') routes.push(r);
      }
    });
  }
  return routes;
}

function normalizeRouteToken(value) {
  return String(value || "")
    .replace(/\.(tsx?|jsx?)$/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function discoverHashRoutes(repo) {
  const routes = new Set();
  const add = (route) => {
    const clean = String(route || "").trim().replace(/^#/, "").replace(/^\//, "");
    if (!clean || clean === "dashboard" || clean === "home") return;
    if (/^(javascript|mailto|tel):/i.test(clean)) return;
    routes.add("#" + clean);
  };

  const sourceRoots = ["src", "app", "pages", "components"]
    .map(d => join(repo, d))
    .filter(d => existsSync(d));
  let hasExplicitHashRouting = false;
  for (const root of sourceRoots) {
    walkDir(root, f => {
      if (!/\.(tsx?|jsx?)$/.test(f) || /\.(test|spec)\.(tsx?|jsx?)$/i.test(f)) return;
      let content = "";
      try { content = readFileSync(f, "utf-8"); } catch { return; }
      if (/\b(HashRouter|createHashRouter|hashchange|location\.hash)\b/.test(content) ||
          /\bnavigate\s*\(\s*["'][^"']+["']/.test(content) ||
          /\bhref\s*=\s*["']#[A-Za-z0-9_/.-]+["']/.test(content)) {
        hasExplicitHashRouting = true;
      }
      for (const m of content.matchAll(/\bnavigate\s*\(\s*["']([^"']+)["']/g)) add(m[1]);
      for (const m of content.matchAll(/\bhref\s*=\s*["']#([^"']+)["']/g)) add(m[1]);
      for (const m of content.matchAll(/\blocation\.hash\s*=\s*["']#?([^"']+)["']/g)) add(m[1]);
    });
  }

  const screenDir = join(repo, "src", "screens");
  if (hasExplicitHashRouting && existsSync(screenDir)) {
    const screenMap = new Map([
      ["create-edit-record", "create"],
      ["create-edit", "create"],
      ["service-detail", "service/1"],
      ["insights-analytics", "insights"],
      ["user-profile", "profile"],
      ["empty-state", "empty"],
      ["system-error-state", "error"],
    ]);
    walkDir(screenDir, f => {
      if (!/\.(tsx?|jsx?)$/.test(f) || /\.(test|spec)\.(tsx?|jsx?)$/i.test(f)) return;
      const token = normalizeRouteToken(basename(f));
      add(screenMap.get(token) || token.replace(/-screen$/, ""));
    });
  }

  return [...routes].slice(0, 20);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectSourceFiles(repo) {
  const files = [];
  const sourceRoots = ["src", "app", "pages", "components"]
    .map(d => join(repo, d))
    .filter(d => existsSync(d));
  for (const root of sourceRoots) {
    walkDir(root, f => {
      if (!/\.(tsx?|jsx?)$/.test(f) || /\.(test|spec)\.(tsx?|jsx?)$/i.test(f)) return;
      files.push(f);
    });
  }
  return files;
}

function nearestFunctionNameBefore(source, index) {
  const prefix = source.slice(Math.max(0, index - 1400), index);
  const patterns = [
    /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:useCallback\s*\()?[^;{}]*=>/g,
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /\b([A-Za-z_$][\w$]*)\s*:\s*\([^)]*\)\s*=>/g,
  ];
  let best = null;
  for (const re of patterns) {
    for (const m of prefix.matchAll(re)) {
      const name = m[1];
      if (name && m.index !== undefined && (!best || m.index > best.index)) best = { name, index: m.index };
    }
  }
  return best?.name || null;
}

function renderedStateTokens(source) {
  const tokens = new Set();
  const renderChecks = [
    /\b(?:phase|screen|currentScreen|activeScreen|view|route)\s*={2,3}\s*["']([A-Za-z0-9_-]+)["']/g,
    /\b(?:state\.)?(?:phase|screen|currentScreen|activeScreen|view|route)\s*===\s*["']([A-Za-z0-9_-]+)["']/g,
  ];
  for (const re of renderChecks) {
    for (const m of source.matchAll(re)) tokens.add(m[1]);
  }
  return [...tokens];
}

function transitionFunctionsForToken(source, token) {
  const names = new Set();
  const tokenRe = escapeRegExp(token);
  const assignment = new RegExp(
    `(?:\\b(?:phase|screen|currentScreen|activeScreen|view|route)\\s*:\\s*["']${tokenRe}["']|` +
    `\\bset(?:Phase|Screen|CurrentScreen|ActiveScreen|View|Route)\\s*\\(\\s*["']${tokenRe}["']\\s*\\))`,
    "g",
  );
  for (const m of source.matchAll(assignment)) {
    const idx = m.index || 0;
    const before = source.slice(Math.max(0, idx - 180), idx);
    if (/\b(?:const|let|var)\s+\w+\s*=/.test(before) && !/\b(?:setState|setPhase|setScreen|setView|useCallback|function)\b/.test(before)) {
      continue;
    }
    const name = nearestFunctionNameBefore(source, idx);
    if (name && !/^getInitial/i.test(name)) names.add(name);
  }
  return [...names];
}

function hasVisibleTransitionReference(source, token, functionNames) {
  const tokenRe = escapeRegExp(token);
  const directTokenRefs = [
    new RegExp(`\\b(?:href|to)\\s*=\\s*["']#?${tokenRe}["']`),
    new RegExp(`\\b(?:onClick|onKeyDown|onSubmit|onPointerDown|onTouchStart)\\s*=\\s*\\{[^}]{0,240}["']${tokenRe}["']`),
    new RegExp(`\\b(?:navigate|dispatch|setPhase|setScreen|setView|setRoute)\\s*\\([^)]{0,240}["']${tokenRe}["']`),
  ];
  if (directTokenRefs.some((re) => re.test(source))) {
    return true;
  }

  for (const name of functionNames) {
    const nameRe = escapeRegExp(name);
    const uiRefs = [
      new RegExp(`\\b(?:actions|appActions|props)\\.${nameRe}\\b`),
      new RegExp(`\\b(?:onClick|onKeyDown|onSubmit|onPointerDown|onTouchStart)\\s*=\\s*\\{[^}]*\\b${nameRe}\\b`),
      new RegExp(`\\baddEventListener\\s*\\(\\s*["'](?:keydown|keyup|click|pointerdown|touchstart)["'][\\s\\S]{0,400}\\b${nameRe}\\b`),
      new RegExp(`\\bwindow\\.app\\s*=\\s*\\{[\\s\\S]{0,1200}\\b${nameRe}\\b`),
    ];
    if (uiRefs.some((re) => re.test(source))) return true;
  }
  return false;
}

function checkUnreachableStateScreens(repo) {
  const files = collectSourceFiles(repo);
  if (files.length === 0) return [];
  const source = files.map((f) => {
    try { return `\n// FILE: ${relative(repo, f)}\n${readFileSync(f, "utf-8")}`; } catch { return ""; }
  }).join("\n");
  const appFiles = files.filter((f) => /(^|\/)(App|main|index)\.(tsx?|jsx?)$/.test(relative(repo, f)));
  const renderSource = (appFiles.length ? appFiles : files).map((f) => {
    try { return readFileSync(f, "utf-8"); } catch { return ""; }
  }).join("\n");

  const issues = [];
  for (const token of renderedStateTokens(renderSource)) {
    const functionNames = transitionFunctionsForToken(source, token);
    if (functionNames.length === 0) continue;
    if (hasVisibleTransitionReference(source, token, functionNames)) continue;
    issues.push(
      `state "${token}" is rendered but transition action ${functionNames.join(", ")} is not wired to a visible button/link/keyboard handler; wire a user path or remove/embed the orphan screen`,
    );
  }
  return issues;
}

function normalizeSnapshotText(text) {
  return String(text || "")
    .replace(/\[ref=\w+\]/g, "[ref]")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "TIME")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "DATE")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
}

function routeTokenFromLabel(label) {
  const text = String(label || "").toLowerCase();
  if (/\b(settings?|configuration|preferences?)\b/.test(text)) return "settings";
  if (/\b(insights?|analytics?|reports?|metrics?)\b/.test(text)) return "insights";
  if (/\b(dashboard|overview|home)\b/.test(text)) return "dashboard";
  if (/\b(profile|account|user)\b/.test(text)) return "profile";
  if (/\b(details?|view details?|open)\b/.test(text)) return "detail";
  if (/\b(create|new|add|log|report)\b/.test(text) && /\b(incident|record|ticket|case|task|item|project)\b/.test(text)) return "create";
  if (/\b(save|submit|send|create|add|report)\b/.test(text)) return "save";
  if (/\b(cancel|back|return|close)\b/.test(text)) return "cancel";
  if (/\b(clear|reset|delete|remove)\b/.test(text)) return "destructive";
  return "";
}

function expectedTextForIntent(intent) {
  if (intent === "settings") return /setting|configuration|preferences|workspace|notification|data management/i;
  if (intent === "insights") return /insight|analytics|metric|report|trend|allocation|response/i;
  if (intent === "dashboard") return /dashboard|overview|active|incident|status|summary/i;
  if (intent === "profile") return /profile|account|operator|user|session|accessibility/i;
  if (intent === "detail") return /detail|summary|incident|status|assign|export|location/i;
  if (intent === "create") return /new|create|add|log|report|record|title|description|save/i;
  return null;
}

function intentMatchesRoute(intent, routeText) {
  const route = String(routeText || "").toLowerCase();
  if (!intent || !route) return false;
  if (intent === "detail") return /detail|summary|view/.test(route);
  if (intent === "create") return /new|create|add|report|record/.test(route);
  return route.includes(intent);
}

const FLOW_AUDIT_EVAL =
  `((async function(limit) {
    function sleep(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }
    function labelFor(el, idx) {
      var explicit = el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        el.getAttribute("data-testid") ||
        el.getAttribute("name") ||
        "";
      var text = (el.textContent || "").replace(/\\s+/g, " ").trim();
      var icon = "";
      var iconEl = el.querySelector("[data-icon], svg[aria-label], svg title, .material-symbols-outlined, [class*=icon]");
      if (iconEl) {
        icon = iconEl.getAttribute("data-icon") ||
          iconEl.getAttribute("aria-label") ||
          iconEl.textContent ||
          iconEl.className ||
          "";
      }
      return String(explicit || text || icon || ("control#" + (idx + 1))).replace(/\\s+/g, " ").trim().substring(0, 100);
    }
    function intentFor(label) {
      var text = String(label || "").toLowerCase();
      if (/\\b(settings?|configuration|preferences?)\\b/.test(text)) return "settings";
      if (/\\b(insights?|analytics?|reports?|metrics?)\\b/.test(text)) return "insights";
      if (/\\b(dashboard|overview|home)\\b/.test(text)) return "dashboard";
      if (/\\b(profile|account|user)\\b/.test(text)) return "profile";
      if (/\\b(details?|view details?|open)\\b/.test(text)) return "detail";
      if (/\\b(create|new|add|log|report)\\b/.test(text) && /\\b(incident|record|ticket|case|task|item|project)\\b/.test(text)) return "create";
      if (/\\b(save|submit|send|create|add|report)\\b/.test(text)) return "save";
      if (/\\b(cancel|back|return|close)\\b/.test(text)) return "cancel";
      return "";
    }
    function appRoute() {
      try {
        var app = window.app || {};
        var st = app.state || {};
        return String(st.screen || st.route || st.currentRoute || app.screen || app.route || app.currentScreen || "");
      } catch(e) { return ""; }
    }
    function appCounts() {
      try {
        var st = (window.app && window.app.state) || {};
        return {
          incidents: Array.isArray(st.incidents) ? st.incidents.length : null,
          records: Array.isArray(st.records) ? st.records.length : null,
          items: Array.isArray(st.items) ? st.items.length : null,
          tasks: Array.isArray(st.tasks) ? st.tasks.length : null
        };
      } catch(e) {
        return { incidents:null, records:null, items:null, tasks:null };
      }
    }
    function countIncreased(before, after) {
      return ["incidents","records","items","tasks"].some(function(k) {
        return typeof before[k] === "number" && typeof after[k] === "number" && after[k] > before[k];
      });
    }
    function headings() {
      return Array.from(document.querySelectorAll("h1,h2,h3,[role=heading]"))
        .map(function(el) { return (el.textContent || "").replace(/\\s+/g, " ").trim(); })
        .filter(Boolean)
        .slice(0, 12);
    }
    function text() {
      return (document.body && document.body.innerText || "").replace(/\\s+/g, " ").trim().substring(0, 3000);
    }
    function controls() {
      return Array.from(document.querySelectorAll("button:not([disabled]), [role=button]:not([aria-disabled=true]), a[href]"))
        .map(function(el, idx) { return { el: el, label: labelFor(el, idx), idx: idx }; })
        .filter(function(item) {
          var r = item.el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          if (/^(close|dismiss|x|\\u00d7|\\u2715|\\u2716)$/i.test(item.label)) return false;
          return !!intentFor(item.label);
        });
    }
    function snapshot() {
      return {
        href: location.href,
        hash: location.hash,
        route: appRoute(),
        text: text(),
        headings: headings(),
        counts: appCounts(),
        inputs: document.querySelectorAll("input:not([type=hidden]), textarea, select").length,
        forms: document.querySelectorAll("form").length
      };
    }
    function routeMatches(intent, route) {
      route = String(route || "").toLowerCase();
      if (!intent || !route) return false;
      if (intent === "detail") return /detail|summary|view/.test(route);
      if (intent === "create") return /new|create|add|report|record/.test(route);
      return route.indexOf(intent) >= 0;
    }
    function textMatches(intent, bodyText) {
      if (intent === "settings") return /setting|configuration|preferences|workspace|notification|data management/i.test(bodyText);
      if (intent === "insights") return /insight|analytics|metric|report|trend|allocation|response/i.test(bodyText);
      if (intent === "dashboard") return /dashboard|overview|active|incident|status|summary/i.test(bodyText);
      if (intent === "profile") return /profile|account|operator|user|session|accessibility/i.test(bodyText);
      if (intent === "detail") return /detail|summary|incident|status|assign|export|location/i.test(bodyText);
      if (intent === "create") return /new|create|add|log|report|record|title|description|save/i.test(bodyText);
      return false;
    }
    function fillForm() {
      var inputs = Array.from(document.querySelectorAll("input:not([type=hidden]), textarea"));
      var filled = 0;
      inputs.forEach(function(input, idx) {
        if (input.disabled || input.readOnly) return;
        var label = ((input.getAttribute("aria-label") || input.getAttribute("placeholder") || input.name || input.id || "") + " " + idx).toLowerCase();
        var value = "Smoke Flow " + Date.now();
        if (/email/.test(label) || input.type === "email") value = "smoke@example.com";
        if (/phone|tel/.test(label) || input.type === "tel") value = "5551234567";
        if (/number|qty|count/.test(label) || input.type === "number") value = "3";
        if (/location|address|sector/.test(label)) value = "Smoke Sector 9";
        if (/description|note|detail|summary/.test(label)) value = "Smoke flow audit generated this record.";
        try {
          var proto = input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          var setter = Object.getOwnPropertyDescriptor(proto, "value") && Object.getOwnPropertyDescriptor(proto, "value").set;
          if (setter) setter.call(input, value); else input.value = value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          filled++;
        } catch(e) {}
      });
      return filled;
    }
    async function goHome(startHref) {
      try {
        if (window.app && typeof window.app.dispatch === "function") {
          window.app.dispatch({ type: "NAVIGATE", screen: "dashboard" });
        }
      } catch(e) {}
      try {
        history.pushState(null, "", startHref);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } catch(e) {}
      await sleep(350);
    }
    function findCurrentControl(plan) {
      var current = controls();
      var exact = current.find(function(item) { return item.label === plan.label; });
      if (exact) return exact;
      return current.find(function(item) { return intentFor(item.label) === plan.intent; }) || null;
    }
    async function completeCreateFlow(beforeCounts) {
      var filled = fillForm();
      await sleep(120);
      var saveBtn = Array.from(document.querySelectorAll("button,[role=button]")).find(function(el) {
        return /save|submit|send|create|add|report/i.test(labelFor(el, 0));
      });
      if (!saveBtn) return { ok: false, reason: "create form has no save/submit button" };
      var saveBefore = snapshot();
      try { saveBtn.scrollIntoView({ block: "center", inline: "center" }); } catch(e) {}
      try { saveBtn.click(); } catch(e) { return { ok: false, reason: "save threw " + e.message }; }
      await sleep(1000);
      var saveAfter = snapshot();
      var ok = filled > 0 && (
        countIncreased(beforeCounts, saveAfter.counts) ||
        countIncreased(saveBefore.counts, saveAfter.counts) ||
        saveAfter.route !== saveBefore.route ||
        /success|saved|created|reported|added/i.test(saveAfter.text)
      );
      return { ok: ok, reason: ok ? "" : "create form did not persist a record, navigate, or show success" };
    }
    var issues = [];
    var tested = [];
    var start = snapshot();
    var selected = [];
    var seen = {};
    controls().forEach(function(item) {
      var intent = intentFor(item.label);
      if (!intent || seen[intent]) return;
      if (intent === "destructive") return;
      seen[intent] = true;
      selected.push({ label: item.label, intent: intent });
    });
    selected = selected.slice(0, limit);
    for (var i = 0; i < selected.length; i++) {
      var plan = selected[i];
      await goHome(start.href);
      var item = findCurrentControl(plan);
      if (!item || !item.el || !item.el.isConnected) {
        issues.push({ type:"flow-control-missing", detail:plan.label + " (" + plan.intent + ") disappeared before it could be tested" });
        continue;
      }
      var intent = plan.intent;
      var before = snapshot();
      tested.push({ label: item.label, intent: intent });
      try { item.el.scrollIntoView({ block: "center", inline: "center" }); } catch(e) {}
      try { item.el.click(); } catch(e) {
        issues.push({ type:"flow-click-error", detail:item.label + " threw " + e.message });
        continue;
      }
      await sleep(700);
      var after = snapshot();
      var ok = false;
      if (["settings","insights","dashboard","profile","detail","create"].indexOf(intent) >= 0) {
        ok = routeMatches(intent, after.route) || routeMatches(intent, after.hash) || textMatches(intent, after.text);
        if (intent === "create") {
          ok = ok && (after.inputs > before.inputs || after.forms > before.forms || textMatches(intent, after.text));
          if (ok) {
            var createResult = await completeCreateFlow(before.counts);
            ok = createResult.ok;
            if (!ok) {
              issues.push({ type:"flow-create-save-failed", detail:item.label + " opened create flow but " + createResult.reason });
            }
          }
        }
      } else if (intent === "cancel") {
        ok = after.href !== before.href || after.route !== before.route || after.text !== before.text;
      } else if (intent === "save") {
        var filled = fillForm();
        await sleep(100);
        var saveBefore = snapshot();
        var saveBtn = item.el.isConnected ? item.el : Array.from(document.querySelectorAll("button,[role=button]")).find(function(el) {
          return /save|submit|send|create|add|report/i.test(labelFor(el, 0));
        });
        if (saveBtn) {
          try { saveBtn.click(); } catch(e) {}
          await sleep(900);
        }
        var saveAfter = snapshot();
        ok = filled === 0 || countIncreased(saveBefore.counts, saveAfter.counts) || saveAfter.route !== saveBefore.route || /success|saved|created|reported|added/i.test(saveAfter.text);
        after = saveAfter;
      }
      if (!ok) {
        issues.push({
          type: "flow-no-visible-result",
          detail: item.label + " expected " + intent + " flow; route/hash/text/form state did not confirm it"
        });
      }
    }
    return { issues: issues, tested: tested };
  })(8))`;

function checkComponentWiring(repo) {
  const issues = [];
  const componentFiles = [];
  for (const dir of [join(repo,'src','components'), join(repo,'components')]) {
    if (!existsSync(dir)) continue;
    walkDir(dir, f => {
      if (/\.(tsx?|jsx?)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.') && !/^index\.(tsx?|jsx?)$/.test(basename(f)))
        componentFiles.push(f);
    });
  }
  if (!componentFiles.length) return issues;

  let allContent = '';
  for (const dir of [join(repo,'src','app'),join(repo,'app'),join(repo,'src','pages'),join(repo,'pages')]) {
    if (!existsSync(dir)) continue;
    walkDir(dir, f => { if (/\.(tsx?|jsx?)$/.test(f)) try { allContent += readFileSync(f,'utf-8')+'\n'; } catch {} });
  }
  for (const e of ['src/App.tsx','src/App.jsx','src/main.tsx','src/index.tsx']) {
    const f = join(repo,e); if (existsSync(f)) try { allContent += readFileSync(f,'utf-8')+'\n'; } catch {}
  }
  // Also check component-to-component imports
  for (const cf of componentFiles) try { allContent += readFileSync(cf,'utf-8')+'\n'; } catch {}

  for (const cf of componentFiles) {
    const name = basename(cf).replace(/\.(tsx?|jsx?)$/,'');
    if (/^(types|utils|helpers|constants|styles)$/i.test(name)) continue;
    if (!allContent.includes(name)) issues.push(`${relative(repo,cf)} — never imported`);
  }
  return issues;
}

// ── Phase 1b: Entry Point Import Validation ─────────────────────────
// Checks that all static value imports in entry files resolve to actual value
// exports in target files. Type-only imports/exports are erased by the TS
// compiler, so they must not be treated as runtime wiring failures.
function checkEntryPointImports(repo) {
  const issues = [];
  const entries = [
    'src/index.js','src/index.ts','src/index.jsx','src/index.tsx',
    'src/main.js','src/main.ts','src/main.jsx','src/main.tsx',
    'index.js','index.ts','main.js','main.ts',
    'src/App.js','src/App.jsx','src/App.tsx',
  ];
  for (const e of entries) {
    const fp = join(repo, e);
    let content;
    try { content = readFileSync(fp, "utf-8"); } catch { continue; }

    // Match value imports only: import { X, Y } from "./target"
    const importRe = /import\s+(?!type\b)\{([^}]+)\}\s*from\s*['"](\.\/.+?)['"];?/g;
    let m;
    while ((m = importRe.exec(content)) !== null) {
      const names = m[1].split(",")
        .map(n => n.trim())
        .filter(n => n && !/^type\b/.test(n))
        .map(n => n.split(/\s+as\s+/)[0].trim())
        .filter(Boolean);
      const specifier = m[2];

      // Resolve target file
      const dir = join(repo, e, "..");
      let targetPath = null;
      let targetContent = null;
      for (const ext of ["", ".js", ".ts", ".jsx", ".tsx", ".mjs"]) {
        const candidate = join(dir, specifier + ext);
        try { targetContent = readFileSync(candidate, "utf-8"); targetPath = candidate; break; } catch {}
      }
      if (!targetPath) {
        for (const ext of [".js", ".ts", ".jsx", ".tsx", ".mjs"]) {
          const candidate = join(dir, specifier, "index" + ext);
          try { targetContent = readFileSync(candidate, "utf-8"); targetPath = candidate; break; } catch {}
        }
      }
      if (!targetPath) {
        issues.push(relative(repo, fp) + ': import from "' + specifier + '" — file not found');
        continue;
      }

      for (const name of names) {
        // JS identifiers are safe for regex (letters, digits, _, $)
        const pat1 = new RegExp('export\\s+(function|const|let|var|class)\\s+' + name + '\\b');
        const pat2 = new RegExp('export\\s*\\{(?![^}]*\\btype\\s+' + name + '\\b)[^}]*\\b' + name + '\\b[^}]*\\}');
        if (!pat1.test(targetContent) && !pat2.test(targetContent)) {
          issues.push(
            relative(repo, fp) + ': imports "' + name + '" from "' + specifier +
            '" but target does not export it'
          );
        }
      }
    }
  }
  return issues;
}

// ── Phase 1c: Native button wiring validation ─────────────────────────
// Catches visible controls that render as buttons but have no behavior.
// Decorative controls must not use <button>; intentional inert buttons must
// use disabled or aria-disabled. data-smoke-ignore is not accepted here because
// previous runs hid real product controls from smoke checks.
function checkNativeButtonWiring(repo) {
  const issues = [];
  const seen = new Set();
  const roots = ['src', 'app', 'pages', 'components']
    .map(d => join(repo, d))
    .filter(d => existsSync(d));

  function attrValue(tag, name) {
    const re = new RegExp("\\b" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i");
    const m = tag.match(re);
    return m ? m[2] : '';
  }

  function buttonLabel(tag, inner) {
    const explicit = attrValue(tag, 'aria-label') || attrValue(tag, 'title') || attrValue(tag, 'data-testid');
    if (explicit) return explicit.trim().replace(/\s+/g, ' ').slice(0, 60);
    const text = (inner || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, 60);
  }

  for (const root of roots) {
    walkDir(root, f => {
      if (!/\.(tsx?|jsx?)$/.test(f)) return;
      if (/\.(test|spec)\.(tsx?|jsx?)$/.test(f)) return;
      if (seen.has(f)) return;
      seen.add(f);

      let content = '';
      try { content = readFileSync(f, 'utf-8'); } catch { return; }

      const re = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
      let m;
      while ((m = re.exec(content)) !== null) {
        const tag = '<button' + m[1] + '>';
        const inner = m[2] || '';
        const line = content.slice(0, m.index).split('\n').length;

        const hasHandler = /\bonClick\s*=/.test(tag);
        const isSubmit = /\btype\s*=\s*(["'])submit\1/i.test(tag);
        const isDisabled = /\bdisabled(?:\s*=|\s|>)/i.test(tag) || /\baria-disabled\s*=\s*(["']true["']|\{true\})/i.test(tag);
        const hasSpreadProps = /\{\s*\.\.\./.test(tag);

        if (hasHandler || isSubmit || isDisabled || hasSpreadProps) continue;

        const label = buttonLabel(tag, inner);
        issues.push(
          relative(repo, f) + ':' + line +
          ' button' + (label ? ' "' + label + '"' : '') +
          ' has no onClick/type="submit"/disabled/aria-disabled'
        );
      }
    });
  }

  return issues;
}

// ── Phase 1d: Semantic interaction validation ───────────────────────
// A click target that is not a native control can pass visual smoke while
// remaining broken for keyboard users and shallow test suites. Treat those as
// product defects unless the element implements the full button contract.
function checkSemanticClickTargets(repo) {
  const issues = [];
  const seen = new Set();
  const roots = ['src', 'app', 'pages', 'components']
    .map(d => join(repo, d))
    .filter(d => existsSync(d));
  const nativeInteractive = new Set([
    'a', 'button', 'input', 'select', 'textarea', 'summary', 'option', 'label',
  ]);

  function hasButtonRole(tag) {
    return /\brole\s*=\s*(["'])button\1/i.test(tag) ||
      /\brole\s*=\s*\{\s*(["'])button\1\s*\}/i.test(tag);
  }

  function hasFocusableTabIndex(tag) {
    return /\btabIndex\s*=\s*(["'])0\1/i.test(tag) ||
      /\btabIndex\s*=\s*\{\s*0\s*\}/i.test(tag);
  }

  function openingTags(content) {
    const tags = [];
    for (let i = 0; i < content.length; i++) {
      if (content[i] !== '<') continue;
      const next = content[i + 1] || '';
      if (!/[a-z]/.test(next)) continue;

      let j = i + 1;
      while (j < content.length && /[a-z0-9:-]/i.test(content[j])) j++;
      const name = content.slice(i + 1, j).toLowerCase();
      let quote = null;
      let braceDepth = 0;
      for (; j < content.length; j++) {
        const ch = content[j];
        if (quote) {
          if (ch === quote && content[j - 1] !== '\\') quote = null;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
        if (ch === '{') { braceDepth++; continue; }
        if (ch === '}') { braceDepth = Math.max(0, braceDepth - 1); continue; }
        if (ch === '>' && braceDepth === 0) break;
      }
      if (j >= content.length) continue;
      tags.push({ name, text: content.slice(i, j + 1), index: i });
      i = j;
    }
    return tags;
  }

  for (const root of roots) {
    walkDir(root, f => {
      if (!/\.(tsx?|jsx?)$/.test(f)) return;
      if (/\.(test|spec)\.(tsx?|jsx?)$/.test(f)) return;
      if (seen.has(f)) return;
      seen.add(f);

      let content = '';
      try { content = readFileSync(f, 'utf-8'); } catch { return; }

      for (const tag of openingTags(content)) {
        if (!/\bonClick\s*=/.test(tag.text)) continue;
        if (nativeInteractive.has(tag.name)) continue;

        const keyboardAccessible = hasButtonRole(tag.text) &&
          hasFocusableTabIndex(tag.text) &&
          /\bonKey(?:Down|Up|Press)\s*=/.test(tag.text);
        if (keyboardAccessible) continue;

        const line = content.slice(0, tag.index).split('\n').length;
        issues.push(
          relative(repo, f) + ':' + line +
          ' <' + tag.name + '> has onClick but is not a native or keyboard-accessible control; ' +
          'use <button>/<a> or add role="button", tabIndex={0}, and Enter/Space handling'
        );
      }
    });
  }

  return issues;
}

// ── Phase 1e: Interaction test quality validation ───────────────────
// A click wrapped only in not.toThrow proves the handler did not crash, not
// that navigation, modal state, persistence, or visible content changed.
function checkWeakInteractionAssertions(repo) {
  const issues = [];
  const seen = new Set();
  const roots = ['src', 'app', 'pages', 'components', 'test', 'tests', '__tests__']
    .map(d => join(repo, d))
    .filter(d => existsSync(d));

  for (const root of roots) {
    walkDir(root, f => {
      if (!/\.(test|spec)\.(tsx?|jsx?)$/.test(f)) return;
      if (seen.has(f)) return;
      seen.add(f);

      let content = '';
      try { content = readFileSync(f, 'utf-8'); } catch { return; }
      if (!/\b(?:fireEvent|userEvent)\.click\b/.test(content)) return;

      const notToThrowRe = /\.not\.toThrow\s*\(/g;
      let m;
      while ((m = notToThrowRe.exec(content)) !== null) {
        const nearby = content.slice(Math.max(0, m.index - 700), Math.min(content.length, m.index + 120));
        if (!/\b(?:fireEvent|userEvent)\.click\b/.test(nearby)) continue;

        const line = content.slice(0, m.index).split('\n').length;
        issues.push(
          relative(repo, f) + ':' + line +
          ' click assertion uses not.toThrow only; assert the post-click UI state, route, callback, or saved data'
        );
      }
    });
  }

  return issues;
}

function minRequiredDesignControls(expected) {
  if (!expected || expected <= 0) return 0;
  if (expected <= 3) return expected;
  return Math.ceil(expected * 0.8);
}

function countSourceControls(srcContent) {
  return {
    buttons: (
      (srcContent.match(/<button\b/gi) || []).length +
      (srcContent.match(/<Button\b/g) || []).length +
      (srcContent.match(/\brole\s*=\s*["']button["']/gi) || []).length
    ),
    inputs: (
      (srcContent.match(/<input\b|<textarea\b|<select\b/gi) || []).length +
      (srcContent.match(/<Input\b|<Textarea\b|<Select\b/g) || []).length
    ),
  };
}

function countSourceControlUsages(srcContent) {
  const counts = countSourceControls(srcContent);
  const declarations = new Map();
  for (const m of srcContent.matchAll(/\b(?:function|const)\s+([A-Z][A-Za-z0-9_]*)\b[\s\S]*?(?=\n(?:export\s+)?(?:function|const)\s+[A-Z]|\n\/\/ ──|\n$)/g)) {
    declarations.set(m[1], countSourceControls(m[0]));
  }
  const componentUses = new Map();
  for (const m of srcContent.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)) {
    componentUses.set(m[1], (componentUses.get(m[1]) || 0) + 1);
  }
  for (const [name, controls] of declarations) {
    const uses = Math.max(0, (componentUses.get(name) || 0) - 1);
    counts.buttons += controls.buttons * uses;
    counts.inputs += controls.inputs * uses;
  }
  return counts;
}

// ── Phase 2: Browser Test ───────────────────────────────────────────

function parseSnapshot(text) {
  if (!text) return { headings:[], buttons:[], links:[], inputs:[], canvas:false, refs:{} };
  const refs = {};
  // Parse refs for links: link "text" [ref=X]
  for (const m of text.matchAll(/link "([^"]*)"[^\[]*\[ref=(\w+)\]/g)) {
    refs['link:' + m[1]] = m[2];
  }
  // Parse refs for buttons: button "text" [ref=X]
  for (const m of text.matchAll(/button "([^"]*)"[^\[]*\[ref=(\w+)\]/g)) {
    refs['button:' + m[1]] = m[2];
  }
  // Parse refs for inputs: textbox/input [ref=X]
  for (const m of text.matchAll(/(textbox|input)[^\[]*\[ref=(\w+)\]/g)) {
    refs['input:' + m[2]] = m[2];
  }
  return {
    headings: [...text.matchAll(/heading "([^"]+)"/g)].map(m=>m[1]),
    buttons: [...text.matchAll(/button "([^"]+)"/g)].map(m=>m[1]),
    links: [...text.matchAll(/link "([^"]+)"/g)].map(m=>m[1]),
    inputs: [...text.matchAll(/(textbox|input)[^\[]*\[ref=(\w+)\]/g)].map(m=>({ type: m[1], ref: m[2] })),
    canvas: text.includes('canvas'),
    refs,
  };
}

const PLACEHOLDER_RE = [
  /coming soon/i, /\btodo\b:?\s/i, /placeholder/i, /not yet implemented/i,
  /under construction/i, /lorem ipsum/i, /feature coming/i,
];
function isPlaceholder(t) { return PLACEHOLDER_RE.some(r=>r.test(t)); }

function startServer(dir, port) {
  return new Promise((resolve, reject) => {
    const p = spawn('serve',[dir,'-l',String(port),'-s','--no-clipboard'],{stdio:['ignore','pipe','pipe'],detached:false});
    let ok = false;
    const to = setTimeout(()=>{ if(!ok){p.kill();reject(new Error('timeout'));} },10000);
    const fn = d=>{ if(!ok&&(d.toString().includes('Accepting')||d.toString().includes('http://'))){ok=true;clearTimeout(to);setTimeout(()=>resolve(p),500);} };
    p.stdout.on('data',fn); p.stderr.on('data',fn);
    p.on('error',e=>{clearTimeout(to);reject(e);});
    p.on('exit',c=>{if(!ok){clearTimeout(to);reject(new Error(`exit ${c}`));}});
  });
}

let activeServerProc = null;

function waitForProcessExit(proc, ms) {
  return new Promise(resolve => {
    if (!proc || proc.exitCode !== null || proc.signalCode) return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    proc.once('exit', finish);
    setTimeout(finish, ms);
  });
}

async function stopServer(proc) {
  if (!proc || proc.exitCode !== null || proc.signalCode) return;
  try { proc.kill('SIGTERM'); } catch {}
  await waitForProcessExit(proc, 1500);
  if (proc.exitCode === null && !proc.signalCode) {
    try { proc.kill('SIGKILL'); } catch {}
    await waitForProcessExit(proc, 500);
  }
}

function stopServerAndExit(signal) {
  const code = signal === 'SIGINT' ? 130 : 143;
  stopServer(activeServerProc).finally(() => process.exit(code));
}

process.once('SIGINT', () => stopServerAndExit('SIGINT'));
process.once('SIGTERM', () => stopServerAndExit('SIGTERM'));

// ── Phase helpers ───────────────────────────────────────────────────

/** Check if page is non-blank (has content in accessibility tree) */
function isPageNonBlank(snap) {
  const p = parseSnapshot(snap);
  return p.headings.length > 0 || p.buttons.length > 0 || p.links.length > 0 || p.canvas;
}

/** Get JS error count from injected collector */
function getJsErrorCount() {
  const result = abOk('eval', 'window.__smoke_errors?.length || 0');
  return parseInt(result || '0', 10) || 0;
}

/** Inject error collector + network watcher into the current page */
function injectErrorCollector() {
  abOk('eval',
    'window.__smoke_errors=[];' +
    'window.addEventListener("error", e => window.__smoke_errors.push(e.message));' +
    'window.addEventListener("unhandledrejection", e => window.__smoke_errors.push(e.reason?.message || String(e.reason)));' +
    'if(!window.__smoke_net_patched){window.__smoke_net_patched=true;window.__smoke_network_errors=[];' +
    'var _f=window.fetch;window.fetch=function(){var a=arguments;' +
    'return _f.apply(this,a).then(function(r){' +
    'if(!r.ok)window.__smoke_network_errors.push("FETCH "+r.status+" "+String(a[0]).substring(0,120));' +
    'return r}).catch(function(e){window.__smoke_network_errors.push("FETCH_ERR "+e.message);throw e})};' +
    'var _x=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){' +
    'this.__su=String(u).substring(0,120);this.__sm=m;_x.apply(this,arguments)};' +
    'var _s=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.send=function(){' +
    'var x=this;x.addEventListener("loadend",function(){' +
    'if(x.status>=400)window.__smoke_network_errors.push("XHR "+x.status+" "+x.__sm+" "+x.__su)});' +
    '_s.apply(this,arguments)}}'
  );
}

/** Elapsed time helper */
function elapsed(start) { return Date.now() - start; }

/** Smart retry — retries fn up to maxRetries with exponential backoff */
async function smartRetry(fn, maxRetries = 2, baseMs = 1500) {
  for (let i = 0; i <= maxRetries; i++) {
    const result = fn();
    if (result && !String(result).startsWith("__ERR__")) return result;
    if (i < maxRetries) await sleep(baseMs * Math.pow(2, i));
  }
  return null;
}

const SKIP_BUTTON_RE = /^(close|dismiss|cancel|x|\u00d7|\u2715|\u2716)$/i;

const BUTTON_AUDIT_EVAL =
  `((function(limit) {
    function labelFor(btn, idx) {
      var explicit = btn.getAttribute("aria-label") ||
        btn.getAttribute("title") ||
        btn.getAttribute("data-testid") ||
        btn.getAttribute("name") ||
        "";
      var text = (btn.textContent || "").replace(/\\s+/g, " ").trim();
      var icon = "";
      var iconEl = btn.querySelector("[data-icon], svg[aria-label], svg title, .material-symbols-outlined, [class*=icon]");
      if (iconEl) {
        icon = iconEl.getAttribute("data-icon") ||
          iconEl.getAttribute("aria-label") ||
          iconEl.textContent ||
          iconEl.className ||
          "";
      }
      return String(explicit || text || icon || ("button#" + (idx + 1))).replace(/\\s+/g, " ").trim().substring(0, 80);
    }
    function skipButton(btn, label) {
      if (btn.disabled || btn.getAttribute("aria-disabled") === "true") return true;
      if (/^(close|dismiss|cancel|x|\\u00d7|\\u2715|\\u2716)$/i.test(label)) return true;
      var r = btn.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return true;
      return false;
    }
    function safeState() {
      var s = {};
      ["app", "store", "state", "__APP_STATE__", "game", "gameState"].forEach(function(k) {
        try {
          if (window[k] !== undefined) {
            if (typeof window[k] === "function") return;
            s[k] = JSON.stringify(window[k]).substring(0, 1000);
          }
        } catch(e) { s[k] = "exists"; }
      });
      return JSON.stringify(s);
    }
    function controlsState() {
      return Array.from(document.querySelectorAll("button, [role=button]")).map(function(el, idx) {
        var label = labelFor(el, idx);
        return [
          label,
          el.getAttribute("aria-expanded") || "",
          el.getAttribute("aria-pressed") || "",
          el.getAttribute("aria-selected") || "",
          el.className || "",
          el.disabled ? "disabled" : "",
          (el.textContent || "").trim()
        ].join(":");
      }).join("|");
    }
    function snap() {
      var active = document.activeElement;
      return {
        htmlLen: document.body.innerHTML.length,
        text: document.body.innerText.substring(0, 5000),
        url: location.href,
        state: safeState(),
        controls: controlsState(),
        active: active ? (active.tagName + ":" + (active.getAttribute("aria-label") || active.textContent || "").trim()) : ""
      };
    }
    function changed(a, b, mutated) {
      return mutated ||
        a.htmlLen !== b.htmlLen ||
        a.text !== b.text ||
        a.url !== b.url ||
        a.state !== b.state ||
        a.controls !== b.controls ||
        a.active !== b.active;
    }
    var all = Array.from(document.querySelectorAll("button:not([disabled]), [role=button]:not([disabled])"));
    var candidates = all.map(function(btn, idx) {
      return { btn: btn, label: labelFor(btn, idx), idx: idx };
    }).filter(function(item) {
      return !skipButton(item.btn, item.label);
    }).slice(0, limit);
    var issues = [];
    var tested = [];
    var i = 0;
    function next() {
      if (i >= candidates.length) return Promise.resolve({ issues: issues, tested: tested });
      var item = candidates[i++];
      if (!item.btn.isConnected || skipButton(item.btn, item.label)) {
        return next();
      }
      var before = snap();
      var mutated = false;
      var obs = new MutationObserver(function() { mutated = true; });
      try { obs.observe(document.body, { childList:true, subtree:true, attributes:true, characterData:true }); } catch(e) {}
      tested.push(item.label);
      try {
        try { item.btn.scrollIntoView({ block: "center", inline: "center" }); } catch(_) {}
        item.btn.click();
      } catch(e) {
        try { obs.disconnect(); } catch(_) {}
        issues.push({ type: "button-click-error", detail: item.label + " threw " + e.message });
        return next();
      }
      return new Promise(function(resolve) {
        setTimeout(function() {
          try { obs.disconnect(); } catch(_) {}
          var after = snap();
          if (!changed(before, after, mutated)) {
            issues.push({ type: "dead-button", detail: item.label + " (no DOM/state/url change)" });
          }
          resolve(next());
        }, 450);
      });
    }
    return next();
  })(12))`;

// Try to authenticate if app requires login
async function tryAuth(baseUrl, repoPath) {
  // Check if there's a login page
  const snap = abOk('snapshot') || '';
  const hasLoginForm = /password|login|sign in/i.test(snap);
  if (!hasLoginForm) return null;

  // Look for test credentials in .env or .env.test or .env.local
  for (const envFile of ['.env.test', '.env.local', '.env']) {
    const envPath = join(repoPath, envFile);
    if (!existsSync(envPath)) continue;
    const content = readFileSync(envPath, 'utf-8');
    const emailMatch = content.match(/(?:TEST_EMAIL|ADMIN_EMAIL|SEED_EMAIL)=(.+)/);
    const passMatch = content.match(/(?:TEST_PASSWORD|ADMIN_PASSWORD|SEED_PASSWORD)=(.+)/);
    if (emailMatch && passMatch) {
      const email = emailMatch[1].trim().replace(/^["']|["']$/g, '');
      const pass = passMatch[1].trim().replace(/^["']|["']$/g, '');
      // Try to fill and submit login form
      try {
        // Find email/username input
        abOk('eval', `
          var inputs = document.querySelectorAll('input[type="email"], input[name="email"], input[type="text"][name*="user"], input[type="text"][name*="email"]');
          if (inputs.length > 0) {
            var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(inputs[0], '${email.replace(/'/g, "\\'")}');
            inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
          }
        `);
        await sleep(500);
        abOk('eval', `
          var inputs = document.querySelectorAll('input[type="password"]');
          if (inputs.length > 0) {
            var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(inputs[0], '${pass.replace(/'/g, "\\'")}');
            inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
          }
        `);
        await sleep(500);
        // Click submit button
        abOk('eval', `
          var btn = document.querySelector('button[type="submit"], form button, button:not([type="button"])');
          if (btn) btn.click();
        `);
        await sleep(3000);
        // Check if we're still on login page
        const afterSnap = abOk('snapshot') || '';
        if (/password|login|sign in/i.test(afterSnap)) {
          return 'login-failed';
        }
        return 'logged-in';
      } catch (e) {
        return 'login-error: ' + e.message;
      }
    }
  }

  // No credentials found — try NextAuth/session-based test bypass
  // Check if there's a seed script
  const pkgPath = join(repoPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.prisma?.seed || pkg.scripts?.['prisma:seed'] || pkg.scripts?.seed) {
        return 'no-credentials-found (hint: add TEST_EMAIL/TEST_PASSWORD to .env.test)';
      }
    } catch {}
  }

  return 'login-required-but-no-credentials';
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const serveDir = detectServeDir(repoPath);
  if (!serveDir) { console.log(JSON.stringify({status:'skip',reason:'No serveable directory'})); process.exit(0); }

  const failures = [];
  let linksChecked = 0, linksBroken = 0;
  let buttonsChecked = 0;
  let formsChecked = 0;
  let consoleErrors = [];
  let flowsChecked = 0;
  let flowIssues = [];

  // ── Phase 1: Static ──
  const routes = discoverRoutes(repoPath);
  const hashRoutes = discoverHashRoutes(repoPath);
  const wiringIssues = checkComponentWiring(repoPath);
  for (const w of wiringIssues) failures.push('WIRING: ' + w);
  const importIssues = checkEntryPointImports(repoPath);
  for (const i of importIssues) failures.push('IMPORT: ' + i);
  const buttonWiringIssues = checkNativeButtonWiring(repoPath);
  for (const b of buttonWiringIssues) failures.push('UNWIRED_BUTTON: ' + b);
  const semanticClickIssues = checkSemanticClickTargets(repoPath);
  for (const s of semanticClickIssues) failures.push('NON_SEMANTIC_CLICK_TARGET: ' + s);
  const unreachableStateScreenIssues = checkUnreachableStateScreens(repoPath);
  for (const s of unreachableStateScreenIssues) failures.push('UNREACHABLE_SCREEN: ' + s);
  const weakInteractionIssues = checkWeakInteractionAssertions(repoPath);
  for (const t of weakInteractionIssues) failures.push('[TEST] WEAK_INTERACTION_ASSERTION: ' + t);

  // ── Phase 2: Browser (homepage + primary action) ──
  const port = requestedPort > 0 ? requestedPort : 9100 + Math.floor(Math.random()*900);
  let serverProc = null;

  try {
    // Start server only if we need to
    if (requestedPort <= 0) {
      serverProc = await startServer(serveDir, port);
      activeServerProc = serverProc;
    }
    const baseUrl = 'http://localhost:' + port;

    ab('close');
    await sleep(300);

    // Open homepage
    const nav = ab('open', baseUrl);

    // Auth detection — try to login if app has login page
    const authResult = await tryAuth(baseUrl, repoPath);
    if (authResult) {
      process.stderr.write('Auth: ' + authResult + '\n');
    }
    if (nav.startsWith('__ERR__')) {
      failures.push('[/] Homepage failed to load: ' + nav);
    } else {
      await sleep(2000);

      // ── Phase 6 (setup): Inject error collector right after open ──
      injectErrorCollector();

      const snap = abOk('snapshot') || '';
      const p = parseSnapshot(snap);
      const homeSnapshotText = normalizeSnapshotText(snap);

      // Blank check
      if (!p.headings.length && !p.buttons.length && !p.links.length && !p.canvas) {
        failures.push('[/] Homepage blank — nothing in accessibility tree');
      }

      // Placeholder check
      for (const h of p.headings) { if (isPlaceholder(h)) failures.push('[/] Placeholder heading: "' + h + '"'); }

      // Screenshot
      ab('screenshot', join(repoPath, 'smoke-home.png'), '--annotate');

      // Find and click primary action button (Start/Play/Begin etc.)
      const primaryBtn = p.buttons.find(b => /start|play|begin|basla|baslat|launch/i.test(b));
      if (primaryBtn) {
        ab('find', 'text', primaryBtn, 'click');
        await sleep(2000);

        const afterSnap = abOk('snapshot') || '';
        const after = parseSnapshot(afterSnap);

        // Placeholder game detection
        const gameStartedHeading = after.headings.some(h => /game started|started!/i.test(h));
        const onlyBackBtn = after.buttons.length <= 1 && after.buttons.every(b => /back|menu|return|geri/i.test(b));

        if (gameStartedHeading && onlyBackBtn && !after.canvas) {
          failures.push(
            '[/] PLACEHOLDER GAME: "' + primaryBtn + '" -> "' + (after.headings[0] || '') + '" with only ' +
            '"' + (after.buttons[0] || 'no') + '" button. No canvas/game UI. Components exist in ' +
            'src/components/ but are NOT wired into the page.'
          );
        }

        // Generic placeholder after click
        for (const h of after.headings) {
          if (isPlaceholder(h) && !p.headings.includes(h)) {
            failures.push('[/] Placeholder after clicking "' + primaryBtn + '": "' + h + '"');
          }
        }

        // Blank after click
        if (!after.headings.length && !after.buttons.length && !after.canvas) {
          failures.push('[/] Page went blank after clicking "' + primaryBtn + '"');
        }

        ab('screenshot', join(repoPath, 'smoke-after-click.png'), '--annotate');
      }

      // Check other routes exist (navigate to first 20 non-root routes)
      for (const route of routes.slice(1, 20)) {
        const rNav = ab('open', baseUrl + route);
        if (rNav.startsWith('__ERR__')) {
          failures.push('[' + route + '] Route failed to load');
          continue;
        }
        await sleep(1500);
        const rSnap = abOk('snapshot') || '';
        const rp = parseSnapshot(rSnap);
        if (!rp.headings.length && !rp.buttons.length && !rp.links.length && !rp.canvas) {
          failures.push('[' + route + '] Route appears blank');
        }
        for (const h of rp.headings) { if (isPlaceholder(h)) failures.push('[' + route + '] Placeholder: "' + h + '"'); }

        // Per-route button dead-end check (mini Phase 14)
        if (rp.buttons.length > 0) {
          injectErrorCollector();
          const routeBtnJson = abOk('eval',
            BUTTON_AUDIT_EVAL
          );
          const routeBtnAudit = parseEvalJson(routeBtnJson, {issues: []});
          for (const i of routeBtnAudit.issues || []) {
            failures.push('[' + route + '] dead-button: "' + i.detail + '"');
          }
          // Check for JS errors after clicking
          const errCount = getJsErrorCount();
          if (errCount > 0) {
            failures.push('[' + route + '] ' + errCount + ' JS error(s) after button clicks');
          }
        }
      }

      // Vite/React SPAs commonly route generated screens through URL hashes.
      // A broken hash router changes location.hash while leaving DOM and
      // window.app state on the dashboard; catch that before QA-FIX can pass
      // with only unit-test cleanup.
      for (const hashRoute of hashRoutes) {
        const rNav = ab('open', baseUrl + '/' + hashRoute);
        if (rNav.startsWith('__ERR__')) {
          failures.push('[' + hashRoute + '] Hash route failed to load');
          continue;
        }
        await sleep(1200);
        const hashSnap = abOk('snapshot') || '';
        const hp = parseSnapshot(hashSnap);
        if (!hp.headings.length && !hp.buttons.length && !hp.links.length && !hp.canvas) {
          failures.push('[' + hashRoute + '] Hash route appears blank');
          continue;
        }

        const routeSnapshotText = normalizeSnapshotText(hashSnap);
        if (homeSnapshotText && routeSnapshotText === homeSnapshotText) {
          failures.push('[' + hashRoute + '] Hash route did not change rendered content from homepage/dashboard');
        }

        const routeInfoRaw = abOk('eval',
          'JSON.stringify({' +
          'hash: location.hash,' +
          'screen: (window.app && window.app.state && window.app.state.screen) || (window.app && window.app.screen) || null,' +
          'selectedRecordId: (window.app && window.app.state && window.app.state.selectedRecordId) || (window.app && window.app.selectedRecordId) || null' +
          '})'
        );
        try {
          const routeInfo = parseEvalJson(routeInfoRaw, {});
          const expectedHash = hashRoute.toLowerCase();
          const actualHash = String(routeInfo.hash || '').toLowerCase();
          const screen = String(routeInfo.screen || '').toLowerCase();
          if (actualHash !== expectedHash) {
            failures.push('[' + hashRoute + '] Hash route did not persist in location.hash (actual: ' + (routeInfo.hash || 'empty') + ')');
          }
          if (screen === 'dashboard' && !/^#?(dashboard|records?|service-records?)$/i.test(hashRoute)) {
            failures.push('[' + hashRoute + '] window.app state stayed on dashboard after hash navigation');
          }
        } catch {}
      }

      // ── Phase 3: Link Validation ──────────────────────────────────
      const phase3Start = Date.now();
      const PHASE3_MAX_MS = 20000; // 20s max

      try {
        // Navigate back to homepage to collect links
        ab('open', baseUrl);
        await sleep(1500);
        // Re-inject error collector after navigation
        injectErrorCollector();

        // Get all links via eval (hrefs)
        const linksJson = abOk('eval',
            'Array.from(document.querySelectorAll("a[href]"))' +
            '.map(a => ({text: a.textContent?.trim() || "", href: a.getAttribute("href")}))' +
            '.filter(l => l.href && !l.href.startsWith("mailto:") && !l.href.startsWith("tel:") && !l.href.startsWith("javascript:"))'
        );

        let allLinks = parseEvalJson(linksJson, []);

        // Filter to internal links only
        const internalLinks = allLinks.filter(l => {
          const h = l.href;
          if (h.startsWith('/') || h.startsWith('#') || h.startsWith('./') || h.startsWith('../')) return true;
          try { const u = new URL(h); return u.hostname === 'localhost'; } catch { return true; }
        });

        // Deduplicate by href
        const seen = new Set();
        const uniqueLinks = internalLinks.filter(l => {
          if (seen.has(l.href)) return false;
          seen.add(l.href);
          return true;
        });

        // Test up to 10 internal links (skip # and /)
        const linksToTest = uniqueLinks.filter(l => l.href !== '/' && l.href !== '#').slice(0, 10);
        for (const link of linksToTest) {
          if (elapsed(phase3Start) > PHASE3_MAX_MS) break;

          const href = link.href;
          const url = href.startsWith('http') ? href : baseUrl + (href.startsWith('/') ? href : '/' + href);
          const lNav = await smartRetry(() => ab('open', url));
          linksChecked++;

          if (lNav.startsWith('__ERR__')) {
            linksBroken++;
            failures.push('[LINK] "' + link.text + '" (' + href + ') — failed to load');
            continue;
          }
          await sleep(1500);

          const lSnap = abOk('snapshot') || '';
          if (!isPageNonBlank(lSnap)) {
            linksBroken++;
            failures.push('[LINK] "' + link.text + '" (' + href + ') — page is blank');
            continue;
          }

          const errCount = getJsErrorCount();
          if (errCount > 0) {
            linksBroken++;
            failures.push('[LINK] "' + link.text + '" (' + href + ') — ' + errCount + ' JS error(s)');
          }
        }
      } catch (e) {
        failures.push('[LINK] Phase 3 error: ' + e.message);
      }

      // ── Phase 4: Button Functionality ─────────────────────────────
      const phase4Start = Date.now();
      const PHASE4_MAX_MS = 20000; // 20s max

      try {
        // Navigate back to homepage
        ab('open', baseUrl);
        await sleep(1500);
        // Re-inject error collector
        injectErrorCollector();

        const btnSnap = abOk('snapshot') || '';
        const btnParsed = parseSnapshot(btnSnap);

        // Filter buttons: skip close/dismiss/cancel/x, skip already-tested primary
        const buttonsToTest = btnParsed.buttons
          .filter(b => !SKIP_BUTTON_RE.test(b.trim()))
          .filter(b => !(primaryBtn && b === primaryBtn))
          .slice(0, 5);

        for (const btn of buttonsToTest) {
          if (elapsed(phase4Start) > PHASE4_MAX_MS) break;

          // Click the button
          const ref = btnParsed.refs['button:' + btn];
          if (ref) {
            await smartRetry(() => ab('click', '@ref_' + ref));
          } else {
            await smartRetry(() => ab('click', btn));
          }
          await sleep(1500);
          buttonsChecked++;

          // Check page didn't go blank
          const postSnap = abOk('snapshot') || '';
          if (!isPageNonBlank(postSnap)) {
            failures.push('[BTN] Page went blank after clicking "' + btn + '"');
          }

          // JS error check after click
          const errCount = getJsErrorCount();
          if (errCount > 0) {
            failures.push('[BTN] "' + btn + '" — ' + errCount + ' JS error(s) after click');
          }

          // Check for network errors after button click
          const netErrors = abOk('eval', 'window.__smoke_network_errors || []');
          try {
            const netArr = parseEvalJson(netErrors, []);
            if (netArr.length > 0) {
              for (const ne of netArr) {
                failures.push('[BTN] "' + btn + '" triggered network error: ' + ne);
              }
            }
          } catch {}
          // Reset network errors for next button
          abOk('eval', 'window.__smoke_network_errors = []');

          // Navigate back to homepage for next test
          ab('open', baseUrl);
          await sleep(1500);
          // Re-inject error collector
          injectErrorCollector();
        }
      } catch (e) {
        failures.push('[BTN] Phase 4 error: ' + e.message);
      }

      // ── Phase 5: Form Testing ─────────────────────────────────────
      const phase5Start = Date.now();
      const PHASE5_MAX_MS = 15000; // 15s max

      try {
        // Navigate back to homepage
        ab('open', baseUrl);
        await sleep(1500);
        // Re-inject error collector
        injectErrorCollector();

        const formSnap = abOk('snapshot') || '';
        const formParsed = parseSnapshot(formSnap);

        if (formParsed.inputs.length > 0) {
          formsChecked++;

          // Test data for different input types
          const testValues = ['Test', 'test@test.com', '12345'];
          let valueIdx = 0;

          // Fill up to 3 inputs
          for (const input of formParsed.inputs.slice(0, 3)) {
            if (elapsed(phase5Start) > PHASE5_MAX_MS) break;
            const val = testValues[valueIdx % testValues.length];
            abOk('fill', '@ref_' + input.ref, val);
            await sleep(500);
            valueIdx++;
          }

          // Find submit/send button and click it
          const submitBtn = formParsed.buttons.find(b =>
            /submit|send|go|search|login|sign|save|ok/i.test(b)
          );
          if (submitBtn) {
            const submitRef = formParsed.refs['button:' + submitBtn];
            if (submitRef) {
              ab('click', '@ref_' + submitRef);
            } else {
              ab('click', submitBtn);
            }
            await sleep(1500);

            // Verify page did not crash after submit
            const afterSubmitSnap = abOk('snapshot') || '';
            if (!isPageNonBlank(afterSubmitSnap)) {
              failures.push('[FORM] Page went blank after form submission');
            }

            const errCount = getJsErrorCount();
            if (errCount > 0) {
              failures.push('[FORM] ' + errCount + ' JS error(s) after form submission');
            }
          }
        }
        // If no forms found, skip silently (best-effort)
      } catch (e) {
        failures.push('[FORM] Phase 5 error: ' + e.message);
      }


      // ── Phase 6: Accessibility Basics ─────────────────────────
      try {
        const a11yJson = abOk('eval',
          '(function() {' +
          '  var issues = [];' +
          '  document.querySelectorAll("img").forEach(function(img) {' +
          '    if (!img.getAttribute("alt") && !img.getAttribute("role")) {' +
          '      issues.push({type:"img-no-alt", detail: (img.src||"").split("/").pop().substring(0,60)});' +
          '    }' +
          '  });' +
          '  document.querySelectorAll("button, [role=button]").forEach(function(btn) {' +
          '    var text = (btn.textContent||"").trim();' +
          '    var aria = btn.getAttribute("aria-label") || btn.getAttribute("title") || "";' +
          '    if (!text && !aria) {' +
          '      var inner = btn.innerHTML.substring(0,40);' +
          '      issues.push({type:"btn-no-label", detail: inner});' +
          '    }' +
          '  });' +
          '  var headings = [];' +
          '  document.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach(function(h) {' +
          '    headings.push(parseInt(h.tagName[1]));' +
          '  });' +
          '  for (var i = 1; i < headings.length; i++) {' +
          '    if (headings[i] > headings[i-1] + 1) {' +
          '      issues.push({type:"heading-skip", detail: "h" + headings[i-1] + " -> h" + headings[i]});' +
          '    }' +
          '  }' +
          '  if (headings.length > 0 && headings[0] !== 1) {' +
          '    issues.push({type:"no-h1", detail: "first heading is h" + headings[0]});' +
          '  }' +
          '  document.querySelectorAll("a[href]").forEach(function(a) {' +
          '    var text = (a.textContent||"").trim();' +
          '    if (/^(click here|here|link|read more)$/i.test(text)) {' +
          '      issues.push({type:"vague-link", detail: text + " -> " + (a.getAttribute("href")||"").substring(0,40)});' +
          '    }' +
          '  });' +
          '  return issues;' +
          '})()'
        );

        let a11yIssues = parseEvalJson(a11yJson, []);

        if (Array.isArray(a11yIssues) && a11yIssues.length > 0) {
          const byType = {};
          for (const i of a11yIssues) { byType[i.type] = (byType[i.type] || 0) + 1; }
          const summary = Object.entries(byType).map(([t,c]) => c + ' ' + t).join(', ');
          failures.push('[A11Y] ' + a11yIssues.length + ' accessibility issue(s): ' + summary);
          for (const i of a11yIssues.slice(0, 5)) {
            failures.push('[A11Y]   ' + i.type + ': ' + i.detail);
          }
        }
      } catch (e) {
        failures.push('[A11Y] Phase 6 error: ' + e.message);
      }

      // ── Phase 7: Visual & Asset Integrity ─────────────────────
      try {
        ab('open', baseUrl);
        await sleep(1500);
        injectErrorCollector();

        const visualJson = abOk('eval',
          '(function() {' +
          '  var issues = [];' +
          '  function hiddenByAncestor(el) {' +
          '    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {' +
          '      var cs = window.getComputedStyle(n);' +
          '      if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") return true;' +
          '    }' +
          '    return false;' +
          '  }' +
          '  document.querySelectorAll("svg").forEach(function(svg) {' +
          '    if (hiddenByAncestor(svg)) return;' +
          '    var r = svg.getBoundingClientRect();' +
          '    if (r.width === 0 || r.height === 0) {' +
          '      var cls = svg.getAttribute("class") || "";' +
          '      var id = svg.getAttribute("id") || "";' +
          '      issues.push({type:"svg-zero", detail: cls || id || "unnamed SVG"});' +
          '    }' +
          '  });' +
          '  var iconSel = "i[class*=icon], i[class*=fa-], i[class*=material], " +' +
          '    "span[class*=icon], span[class*=fa-], span[class*=material]";' +
          '  document.querySelectorAll(iconSel).forEach(function(el) {' +
          '    var r = el.getBoundingClientRect();' +
          '    var cs = window.getComputedStyle(el);' +
          '    if (cs.display === "none" || cs.visibility === "hidden") return;' +
          '    var txt = (el.textContent||"").trim();' +
          '    if (r.width === 0 && r.height === 0 && !txt) {' +
          '      issues.push({type:"font-icon-zero", detail: el.className});' +
          '    } else if (!txt && (cs.content === "none" || cs.content === "normal" || cs.content === "")) {' +
          '      var ff = cs.fontFamily || "";' +
          '      if (/awesome|material|icon/i.test(ff)) {' +
          '        issues.push({type:"font-icon-empty", detail: el.className + " (" + ff.split(",")[0] + ")"});' +
          '      }' +
          '    }' +
          '  });' +
          '  document.querySelectorAll("img").forEach(function(img) {' +
          '    if (img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith("data:")) {' +
          '      issues.push({type:"broken-img", detail: img.src.split("/").pop()});' +
          '    }' +
          '  });' +
          '  var failed = Array.from(document.fonts).filter(function(f){return f.status==="error"}).map(function(f){return f.family});' +
          '  failed.forEach(function(f){ issues.push({type:"font-load-fail", detail: f}); });' +
          '  var textEls = document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,span,a,button,label,li,td,th");' +
          '  var checked = 0;' +
          '  textEls.forEach(function(el) {' +
          '    if (checked >= 20) return;' +
          '    var cs = window.getComputedStyle(el);' +
          '    var fg = cs.color; var bg = cs.backgroundColor;' +
          '    if (!fg || !bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") return;' +
          '    checked++;' +
          '    function lum(c) {' +
          '      var m = c.match(/\\d+/g); if(!m||m.length<3) return 0;' +
          '      var rgb = m.slice(0,3).map(function(v){v=parseInt(v)/255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});' +
          '      return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];' +
          '    }' +
          '    var l1 = lum(fg); var l2 = lum(bg);' +
          '    var ratio = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);' +
          '    if (ratio < 3) {' +
          '      var txt = (el.textContent||"").trim().substring(0,25);' +
          '      if (txt) issues.push({type:"low-contrast", detail: txt + " (" + ratio.toFixed(1) + ":1, fg=" + fg + " bg=" + bg + ")"});' +
          '    }' +
          '  });' +
          '  return issues;' +
          '})()'
        );

        let visualIssues = parseEvalJson(visualJson, []);

        if (Array.isArray(visualIssues) && visualIssues.length > 0) {
          const byType = {};
          for (const i of visualIssues) { byType[i.type] = (byType[i.type] || 0) + 1; }
          const summary = Object.entries(byType).map(([t,c]) => c + ' ' + t).join(', ');
          failures.push('[VISUAL] ' + visualIssues.length + ' visual issue(s): ' + summary);
          for (const i of visualIssues.slice(0, 5)) {
            failures.push('[VISUAL]   ' + i.type + ': ' + i.detail);
          }
        }
      } catch (e) {
        failures.push('[VISUAL] Phase 7 error: ' + e.message);
      }

      // ── Phase 8: Layout & UX Glitches ─────────────────────────
      try {
        const layoutJson = abOk('eval',
          '(function() {' +
          '  var issues = [];' +
          '  if (document.documentElement.scrollWidth > window.innerWidth + 5) {' +
          '    issues.push({type:"h-overflow", detail: "scrollW=" + document.documentElement.scrollWidth + " vp=" + window.innerWidth});' +
          '  }' +
          '  var ids = []; document.querySelectorAll("[id]").forEach(function(el){ ids.push(el.id); });' +
          '  var seen = {}; var dupes = [];' +
          '  ids.forEach(function(id){ if(seen[id] && dupes.indexOf(id)===-1) dupes.push(id); seen[id]=true; });' +
          '  if (dupes.length > 0) {' +
          '    issues.push({type:"duplicate-id", detail: dupes.slice(0,10).join(", ")});' +
          '  }' +
          '  document.querySelectorAll("button, a[href], [role=button]").forEach(function(el) {' +
          '    var r = el.getBoundingClientRect();' +
          '    if (r.width === 0 || r.height === 0 || r.top < 0 || r.left < 0) return;' +
          '    var cx = r.left + r.width/2; var cy = r.top + r.height/2;' +
          '    var top = document.elementFromPoint(cx, cy);' +
          '    if (top && top !== el && !el.contains(top) && !top.contains(el)) {' +
          '      var tn = (el.textContent || "").trim().substring(0,30) || el.tagName;' +
          '      var bn = top.tagName + (top.className ? "." + String(top.className).split(" ")[0] : "");' +
          '      issues.push({type:"z-overlap", detail: tn + " blocked by " + bn});' +
          '    }' +
          '  });' +
          '  return issues;' +
          '})()'
        );

        let layoutIssues = parseEvalJson(layoutJson, []);

        if (Array.isArray(layoutIssues) && layoutIssues.length > 0) {
          for (const i of layoutIssues) {
            failures.push('[LAYOUT] ' + i.type + ': ' + i.detail);
          }
        }
      } catch (e) {
        failures.push('[LAYOUT] Phase 8 error: ' + e.message);
      }

      // ── Phase 9: Network Silent Failures ──────────────────────
      let networkErrors = [];
      try {
        const netJson = abOk('eval', 'window.__smoke_network_errors || []');
        networkErrors = parseEvalJson(netJson, []);
        if (Array.isArray(networkErrors) && networkErrors.length > 0) {
          networkErrors = networkErrors.slice(0, 20);
          failures.push('[NETWORK] ' + networkErrors.length + ' silent API failure(s): ' + networkErrors.slice(0, 3).join('; '));
        }
      } catch (e) {
        failures.push('[NETWORK] Phase 9 error: ' + e.message);
      }

      // ── Phase 10 (collect): Gather console errors ─────────────
      try {
        const errJson = abOk('eval', 'window.__smoke_errors || []');
        try {
          const errors = parseEvalJson(errJson, []);
          if (Array.isArray(errors) && errors.length > 0) {
            consoleErrors = errors.slice(0, 20);
            failures.push('[CONSOLE] ' + errors.length + ' JS error(s) collected: ' + errors.slice(0, 3).join('; '));
          }
        } catch {}
      } catch {}

      // ── Phase 11: Hydration & Interactivity ───────────────────
      try {
        ab('open', baseUrl);
        await sleep(1000);

        const hydroJson = abOk('eval',
          '(function() {' +
          '  var issues = [];' +
          '  var start = performance.now();' +
          '  var btns = document.querySelectorAll("button, [role=button]");' +
          '  var unresponsive = 0;' +
          '  btns.forEach(function(btn) {' +
          '    try {' +
          '      var clicked = false;' +
          '      var handler = function() { clicked = true; };' +
          '      btn.addEventListener("click", handler, {once:true});' +
          '      btn.click();' +
          '      btn.removeEventListener("click", handler);' +
          '      if (!clicked && !btn.disabled) unresponsive++;' +
          '    } catch(e) {}' +
          '  });' +
          '  if (unresponsive > 0 && btns.length > 0) {' +
          '    issues.push({type:"unresponsive-btn", detail: unresponsive + "/" + btns.length + " buttons did not fire click"});' +
          '  }' +
          '  var tti = performance.now() - performance.timing.domContentLoadedEventEnd;' +
          '  if (tti > 3000) {' +
          '    issues.push({type:"slow-interactive", detail: "TTI ~" + Math.round(tti) + "ms (>3s)"});' +
          '  }' +
          '  var scripts = document.querySelectorAll("script[src]");' +
          '  var blocking = 0;' +
          '  scripts.forEach(function(s) {' +
          '    if (!s.defer && !s.async && !s.type) blocking++;' +
          '  });' +
          '  if (blocking > 2) {' +
          '    issues.push({type:"blocking-scripts", detail: blocking + " render-blocking scripts"});' +
          '  }' +
          '  return issues;' +
          '})()'
        );

        let hydroIssues = parseEvalJson(hydroJson, []);

        if (Array.isArray(hydroIssues) && hydroIssues.length > 0) {
          for (const i of hydroIssues) {
            failures.push('[HYDRATION] ' + i.type + ': ' + i.detail);
          }
        }
      } catch (e) {
        failures.push('[HYDRATION] Phase 11 error: ' + e.message);
      }

      // ── Phase 13: Content Sanity (Hallucination Checker) ──────
      try {
        const contentJson = abOk('eval',
          '(function() {' +
          '  var issues = [];' +
          '  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);' +
          '  var hallucinationRe = /\\b(undefined|null|NaN|\\[object Object\\]|lorem ipsum|TODO:|FIXME:|HACK:|XXX:)\\b/i;' +
          '  var debugRe = /\\{\\{\\s*\\w+\\s*\\}\\}|\\$\\{[^}]+\\}/;' +
          '  var rawVarRe = /^(props\\.|state\\.|data\\.|item\\.)/;' +
          '  var checked = 0;' +
          '  while (walker.nextNode() && checked < 500) {' +
          '    checked++;' +
          '    var t = walker.currentNode.textContent.trim();' +
          '    if (!t || t.length < 3 || t.length > 200) continue;' +
          '    var parent = walker.currentNode.parentElement;' +
          '    if (parent && (parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.tagName === "NOSCRIPT")) continue;' +
          '    if (hallucinationRe.test(t)) {' +
          '      issues.push({type:"hallucination", detail: t.substring(0,60)});' +
          '    }' +
          '    if (debugRe.test(t)) {' +
          '      issues.push({type:"raw-template", detail: t.substring(0,60)});' +
          '    }' +
          '    if (rawVarRe.test(t)) {' +
          '      issues.push({type:"raw-var", detail: t.substring(0,60)});' +
          '    }' +
          '  }' +
          '  var imgs = document.querySelectorAll("img[alt]");' +
          '  imgs.forEach(function(img) {' +
          '    var alt = img.getAttribute("alt") || "";' +
          '    if (/placeholder|lorem|sample|test image|untitled/i.test(alt)) {' +
          '      issues.push({type:"placeholder-alt", detail: alt.substring(0,40)});' +
          '    }' +
          '  });' +
          '  return issues;' +
          '})()'
        );

        let contentIssues = parseEvalJson(contentJson, []);

        if (Array.isArray(contentIssues) && contentIssues.length > 0) {
          const byType = {};
          for (const i of contentIssues) { byType[i.type] = (byType[i.type] || 0) + 1; }
          const summary = Object.entries(byType).map(([t,c]) => c + ' ' + t).join(', ');
          failures.push('[CONTENT] ' + contentIssues.length + ' content issue(s): ' + summary);
          for (const i of contentIssues.slice(0, 5)) {
            failures.push('[CONTENT]   ' + i.type + ': ' + i.detail);
          }
        }
      } catch (e) {
        failures.push('[CONTENT] Phase 13 error: ' + e.message);
      }

      // ── Phase 14: Interaction Dead-Ends (UX Feedback) ─────────
      try {
        ab('open', baseUrl);
        await sleep(1500);
        injectErrorCollector();

        const uxJson = abOk('eval',
          BUTTON_AUDIT_EVAL
        );

        let uxIssues = [];
        const uxAudit = parseEvalJson(uxJson, {issues: [], tested: []});
        uxIssues = uxAudit.issues || [];
        buttonsChecked += (uxAudit.tested || []).length;

        if (Array.isArray(uxIssues) && uxIssues.length > 0) {
          for (const i of uxIssues) {
            failures.push('[UX] ' + i.type + ': ' + i.detail);
          }
        }
      } catch (e) {
        failures.push('[UX] Phase 14 error: ' + e.message);
      }

      // ── Phase 14b: Intentional Flow Verification ───────────────
      // Dead-button checks prove a click changed something. This phase verifies
      // that project controls with recognizable intent changed the expected
      // route, visible screen, form, or record state.
      try {
        ab('open', baseUrl);
        await sleep(1500);
        injectErrorCollector();

        const flowJson = abOk('eval', FLOW_AUDIT_EVAL);
        const flowAudit = parseEvalJson(flowJson, { issues: [], tested: [] });
        flowIssues = Array.isArray(flowAudit.issues) ? flowAudit.issues : [];
        flowsChecked += Array.isArray(flowAudit.tested) ? flowAudit.tested.length : 0;

        for (const i of flowIssues) {
          failures.push('[FLOW] ' + i.type + ': ' + i.detail);
        }
      } catch (e) {
        failures.push('[FLOW] Phase 14b error: ' + e.message);
      }


      // ── Phase 15: Interactive State Verification ─────────────────
      // v3: Control-group approach — detects ambient animation (e.g. bouncing sprites)
      // and discounts pixel/state signals that change without input.
      // Prevents false positives on animated scenes.
      try {
        ab('open', baseUrl);
        await sleep(2000);
        injectErrorCollector();

        // Inject reusable helpers on window (avoids repeating in each eval)
        abOk('eval',
          '(function() {' +
          '  window.__p15h = {' +
          '    domText: function() {' +
          '      var el = document.querySelector("[class*=score],[id*=score],.hud,#hud,[class*=status],[class*=counter],[class*=timer],[class*=level],main,[role=main]");' +
          '      return el ? el.textContent.trim().substring(0,200) : document.body.innerText.substring(0,500);' +
          '    },' +
          '    pixels: function() {' +
          '      var canvas = document.querySelector("canvas");' +
          '      if (!canvas) return null;' +
          '      try { var ctx = canvas.getContext("2d"); var w = canvas.width, h = canvas.height;' +
          '        return [[w*0.25,h*0.75],[w*0.5,h*0.5],[w*0.75,h*0.5],[w*0.5,h*0.25],[w*0.1,h*0.9]].map(function(p){' +
          '          var d = ctx.getImageData(Math.floor(p[0]),Math.floor(p[1]),1,1).data; return [d[0],d[1],d[2],d[3]]; });' +
          '      } catch(e) { return null; }' +
          '    },' +
          '    state: function() {' +
          '      if (typeof window.render_game_to_text === "function") { try { return window.render_game_to_text(); } catch(e) {} }' +
          '      var s = {};' +
          '      ["game","player","character","gameState","state","app","engine","store","__APP_STATE__"].forEach(function(n) {' +
          '        if (window[n] != null && typeof window[n] === "object") { try { s[n] = JSON.stringify(window[n]).substring(0,500); } catch(e) { s[n] = "exists"; } }' +
          '        else if (typeof window[n] === "string") { s[n] = window[n]; }' +
          '      }); return JSON.stringify(s);' +
          '    },' +
          '    pixelsDiffer: function(a, b) {' +
          '      if (!a || !b) return false;' +
          '      for (var i = 0; i < a.length; i++) {' +
          '        for (var j = 0; j < 4; j++) { if (a[i][j] !== b[i][j]) return true; }' +
          '      } return false;' +
          '    },' +
          '    snap: function() { return { text: this.domText(), pixels: this.pixels(), state: this.state(), url: location.href + location.hash }; }' +
          '  };' +
          '})(); "ok"'
        );

        // Step 1: Detect interactivity + capture T0
        const detectJson = abOk('eval',
          '(function() {' +
          '  var canvas = document.querySelector("canvas");' +
          '  var hasKeyHint = document.body.innerText.match(/press (space|enter|any key|start)|arrow keys|wasd|jump|duck|space to/i);' +
          '  if (!canvas && !hasKeyHint) return {skip: true, reason: "no canvas or keyboard hints"};' +
          '  window.__p15_t0 = window.__p15h.snap();' +
          '  return {skip: false, hasCanvas: !!canvas, hasKeyHint: !!hasKeyHint, hasAdvanceTime: typeof window.advanceTime === "function"};' +
          '})()'
        );

        let detectResult = parseEvalJson(detectJson, null);

        if (detectResult && !detectResult.skip) {
          // Step 2: Control wait — NO input, same duration as input test
          await sleep(800);

          // Step 3: Capture T1 (control) — detect ambient changes
          const controlJson = abOk('eval',
            '(function() {' +
            '  var h = window.__p15h, t0 = window.__p15_t0;' +
            '  if (!t0) return {skip: true};' +
            '  window.__p15_t1 = h.snap();' +
            '  var t1 = window.__p15_t1;' +
            '  return {' +
            '    ambientPixels: h.pixelsDiffer(t0.pixels, t1.pixels),' +
            '    ambientText: (t0.text !== t1.text),' +
            '    ambientState: (t0.state !== t1.state),' +
            '    ambientUrl: (t0.url !== t1.url)' +
            '  };' +
            '})()'
          );

          let controlResult = parseEvalJson(controlJson, null);
          if (!controlResult || controlResult.skip) controlResult = { ambientPixels: false, ambientText: false, ambientState: false, ambientUrl: false };

          // Step 4: Dispatch keyboard inputs (from T1 baseline)
          abOk('eval',
            '(function() {' +
            '  var canvas = document.querySelector("canvas");' +
            '  var keys = [{key:" ",code:"Space",keyCode:32},{key:"Enter",code:"Enter",keyCode:13},{key:"ArrowUp",code:"ArrowUp",keyCode:38},{key:"ArrowRight",code:"ArrowRight",keyCode:39}];' +
            '  keys.forEach(function(k) {' +
            '    var opts = {key:k.key, code:k.code, keyCode:k.keyCode, bubbles:true};' +
            '    window.dispatchEvent(new KeyboardEvent("keydown", opts));' +
            '    document.dispatchEvent(new KeyboardEvent("keydown", opts));' +
            '    if (canvas) canvas.dispatchEvent(new KeyboardEvent("keydown", opts));' +
            '  });' +
            '  if (typeof window.advanceTime === "function") { try { window.advanceTime(500); } catch(e) {} }' +
            '  setTimeout(function() {' +
            '    keys.forEach(function(k) {' +
            '      var opts = {key:k.key, code:k.code, keyCode:k.keyCode, bubbles:true};' +
            '      window.dispatchEvent(new KeyboardEvent("keyup", opts));' +
            '      document.dispatchEvent(new KeyboardEvent("keyup", opts));' +
            '    });' +
            '  }, 100);' +
            '})(); "ok"'
          );

          // Step 5: Wait for game loop to process inputs
          await sleep(800);

          // Step 6: Capture T2, compare with T1, apply ambient discount
          const afterJson = abOk('eval',
            '(function() {' +
            '  var h = window.__p15h, t1 = window.__p15_t1;' +
            '  if (!t1) return {skip: true};' +
            '  var t2 = h.snap();' +
            '  var textChanged = (t1.text !== t2.text);' +
            '  var pixelChanged = h.pixelsDiffer(t1.pixels, t2.pixels);' +
            '  var stateChanged = (t1.state !== t2.state);' +
            '  var urlChanged = (t1.url !== t2.url);' +
            '  delete window.__p15_t0; delete window.__p15_t1; delete window.__p15h;' +
            '  return {skip:false, signals:{textChanged:textChanged, pixelChanged:pixelChanged, stateChanged:stateChanged, urlChanged:urlChanged}};' +
            '})()'
          );

          let interactResult = parseEvalJson(afterJson, null);

          if (interactResult && !interactResult.skip) {
            const s = interactResult.signals;
            const amb = controlResult;

            // A signal is "input-confirmed" only if it changed AND was NOT ambient
            const inputConfirmed = (
              (s.textChanged && !amb.ambientText) ||
              (s.stateChanged && !amb.ambientState) ||
              (s.pixelChanged && !amb.ambientPixels) ||
              (s.urlChanged && !amb.ambientUrl)
            );

            const anyAmbient = amb.ambientPixels || amb.ambientText || amb.ambientState || amb.ambientUrl;
            const anyChanged = s.textChanged || s.pixelChanged || s.stateChanged || s.urlChanged;

            if (!anyChanged && !anyAmbient) {
              // Nothing changed at all — static page, input ignored
              failures.push('[INTERACT] interactive-no-response: Keyboard input (Space/Enter/ArrowUp/ArrowRight) caused zero state change across 4 signals: DOM text, canvas pixels, app state, URL');
            } else if (!inputConfirmed && anyAmbient) {
              // Only ambient signals changed — cannot confirm input caused it
              const ambList = [];
              if (amb.ambientPixels) ambList.push('canvas pixels');
              if (amb.ambientText) ambList.push('DOM text');
              if (amb.ambientState) ambList.push('app state');
              if (amb.ambientUrl) ambList.push('URL');
              failures.push('[INTERACT] interactive-ambiguous: Ambient animation detected on ' + ambList.join(', ') + ' — these signals change without input. No non-ambient signal confirmed keyboard response');
            }
            // else: inputConfirmed = true → at least one non-ambient signal changed → PASS
          }
        }
      } catch (e) {
        failures.push('[INTERACT] Phase 15 error: ' + e.message);
      }
    }

    ab('close');
  } catch (err) {
    failures.push('Browser test error: ' + err.message);
    ab('close');
  }

  await stopServer(serverProc);
  activeServerProc = null;


  // ── Phase 16: Design Fidelity (Stitch DESIGN_DOM vs actual) ──────
  try {
    const designDomPath = join(repoPath, 'stitch', 'DESIGN_DOM.json');
    const designTokensPath = join(repoPath, 'stitch', 'design-tokens.css');

    if (existsSync(designDomPath)) {
      try {
        const dom = JSON.parse(readFileSync(designDomPath, 'utf-8'));
        const totalButtons = Object.values(dom.screens || {}).reduce((sum, s) => {
          const direct = s.buttons?.length || 0;
          const contract = Array.isArray(s.behaviorContract)
            ? s.behaviorContract.filter(i => (i?.kind || 'button') === 'button').length
            : 0;
          return sum + Math.max(direct, contract);
        }, 0);
        const totalInputs = Object.values(dom.screens || {}).reduce((sum, s) => {
          const direct = s.inputs?.length || 0;
          const contract = Array.isArray(s.behaviorContract)
            ? s.behaviorContract.filter(i => i?.kind === 'input').length
            : 0;
          return sum + Math.max(direct, contract);
        }, 0);
        const totalSections = Object.values(dom.screens || {}).reduce((sum, s) => sum + (s.sections?.length || 0), 0);

        // Check source for element implementation
        const srcDir = join(repoPath, 'src');
        if (existsSync(srcDir)) {
          const srcContent = readdirSync(srcDir, { recursive: true })
            .filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'))
            .map(f => readFileSync(join(srcDir, f), 'utf-8'))
            .join('\n');

          const actual = countSourceControlUsages(srcContent);
          const minButtons = minRequiredDesignControls(totalButtons);
          const minInputs = minRequiredDesignControls(totalInputs);

          if (totalButtons > 0 && actual.buttons < minButtons) {
            failures.push('[FIDELITY] Buttons: design has ' + totalButtons + ', code has ' + actual.buttons + ' (minimum required ' + minButtons + ')');
          }
          if (totalInputs > 0 && actual.inputs < minInputs) {
            failures.push('[FIDELITY] Inputs: design has ' + totalInputs + ', code has ' + actual.inputs + ' (minimum required ' + minInputs + ')');
          }
        }
      } catch (e) {
        failures.push('[FIDELITY] DESIGN_DOM parse error: ' + e.message);
      }
    }

    // CSS Token usage check
    if (existsSync(designTokensPath)) {
      try {
        const tokenContent = readFileSync(designTokensPath, 'utf-8');
        const tokenVars = [...tokenContent.matchAll(/--([\/\w-]+)/g)].map(m => m[1]);
        const keyTokens = tokenVars.filter(v => v.includes('color') || v.includes('font') || v.includes('primary') || v.includes('background') || v.includes('surface'));

        if (keyTokens.length > 0) {
          const srcDir = join(repoPath, 'src');
          if (existsSync(srcDir)) {
            let allCss = readdirSync(srcDir, { recursive: true })
              .filter(f => f.endsWith('.css') || f.endsWith('.tsx') || f.endsWith('.jsx'))
              .map(f => readFileSync(join(srcDir, f), 'utf-8'))
              .join('\n');
            if (/@import\s+["'][^"']*stitch\/design-tokens\.css["']/.test(allCss)) {
              allCss += '\n' + tokenContent;
            }

            const usedCount = keyTokens.filter(v => allCss.includes('--' + v)).length;
            const ratio = usedCount / keyTokens.length;
            if (ratio < 0.3) {
              failures.push('[FIDELITY] CSS tokens: only ' + usedCount + '/' + keyTokens.length + ' (' + Math.round(ratio * 100) + '%) design tokens used');
            }
          }
        }
      } catch (e) { /* ignore token parse errors */ }
    }
  } catch (e) {
    failures.push('[FIDELITY] Phase 16 error: ' + e.message);
  }

  // ── Output ──
  // ── Confidence Score ──
  let confidence = 100;
  const consoleCount = failures.filter(f => f.startsWith('[CONSOLE]')).length;
  const networkCount = failures.filter(f => f.startsWith('[NETWORK]')).length;
  const visualCount = failures.filter(f => f.startsWith('[VISUAL]')).length;
  const layoutCount = failures.filter(f => f.startsWith('[LAYOUT]')).length;
  const a11yCount = failures.filter(f => f.startsWith('[A11Y]')).length;
  const hydrationCount = failures.filter(f => f.startsWith('[HYDRATION]')).length;
  const contentCount = failures.filter(f => f.startsWith('[CONTENT]')).length;
  const uxCount = failures.filter(f => f.startsWith('[UX]')).length;
  const flowCount = failures.filter(f => f.startsWith('[FLOW]')).length;
  const interactCount = failures.filter(f => f.startsWith('[INTERACT]')).length;
  const testCount = failures.filter(f => f.startsWith('[TEST]')).length;
  if (consoleCount > 0) confidence -= 40;
  if (networkCount > 0) confidence -= 30;
  if (layoutCount > 0) confidence -= 20;
  if (visualCount > 0) confidence -= 10;
  if (a11yCount > 0) confidence -= 5;
  if (hydrationCount > 0) confidence -= 15;
  if (contentCount > 0) confidence -= 15;
  if (uxCount > 0) confidence -= 10;
  if (flowCount > 0) confidence -= 40;
  if (interactCount > 0) confidence -= 40;
  const fidelityCount = failures.filter(f => f.startsWith('[FIDELITY]')).length;
  if (fidelityCount > 0) confidence -= 35;
  if (wiringIssues.length > 0) confidence -= 20;
  if (buttonWiringIssues.length > 0) confidence -= 35;
  if (semanticClickIssues.length > 0) confidence -= 35;
  if (unreachableStateScreenIssues.length > 0) confidence -= 40;
  if (testCount > 0) confidence -= 20;
  if (linksBroken > 0) confidence -= 10;
  confidence = Math.max(0, confidence);

  const result = {
    status: failures.length === 0 ? 'pass' : (confidence >= 70 ? 'warn' : 'fail'),
    confidence,
    routesDiscovered: routes.length,
    routes,
    hashRoutesDiscovered: hashRoutes.length,
    hashRoutes,
    componentWiringIssues: wiringIssues.length,
    wiringDetails: wiringIssues,
    buttonWiringIssues: buttonWiringIssues.length,
    buttonWiringDetails: buttonWiringIssues,
    semanticClickIssues: semanticClickIssues.length,
    semanticClickDetails: semanticClickIssues,
    unreachableStateScreens: unreachableStateScreenIssues.length,
    unreachableStateScreenDetails: unreachableStateScreenIssues,
    weakInteractionAssertions: weakInteractionIssues.length,
    weakInteractionDetails: weakInteractionIssues,
    linksChecked,
    linksBroken,
    buttonsChecked,
    formsChecked,
    flowsChecked,
    flowIssues: flowCount,
    flowDetails: flowIssues,
    a11yIssues: a11yCount,
    visualIssues: visualCount,
    layoutIssues: layoutCount,
    networkErrors: networkCount,
    hydrationIssues: hydrationCount,
    contentIssues: contentCount,
    uxDeadEnds: uxCount,
    interactIssues: interactCount,
    testIssues: testCount,
    consoleErrors,
    failures,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'fail' ? 1 : 0);
}

export {
  discoverHashRoutes,
  checkEntryPointImports,
  checkNativeButtonWiring,
  checkSemanticClickTargets,
  checkUnreachableStateScreens,
  checkWeakInteractionAssertions,
};

if (isCli) {
  main();
}
