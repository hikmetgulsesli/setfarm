#!/usr/bin/env node
/**
 * Smoke Test v2 — Playwright-based runtime verification for web projects.
 * v1: Catches missing DOM elements, JS exceptions, console errors, blank pages.
 * v2: + Interactive testing, multi-route coverage, placeholder detection, component wiring.
 *
 * Usage: node smoke-test.mjs <repo-path> [--port PORT] [--timeout MS]
 *
 * Exit codes: 0 = pass, 1 = failures found, 2 = script error
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, basename, relative } from 'path';

const args = process.argv.slice(2);
const repoPath = args[0];
if (!repoPath) {
  console.error('Usage: node smoke-test.mjs <repo-path> [--port PORT] [--timeout MS]');
  process.exit(2);
}

const portArgIdx = args.indexOf('--port');
const requestedPort = portArgIdx !== -1 ? parseInt(args[portArgIdx + 1], 10) : 0;
const timeoutArgIdx = args.indexOf('--timeout');
const pageTimeout = timeoutArgIdx !== -1 ? parseInt(args[timeoutArgIdx + 1], 10) : 15000;

// ── Detect serve directory ──────────────────────────────────────────
function detectServeDir(repo) {
  for (const dir of ['dist', 'build', 'out', 'public', '.next', '.output']) {
    const full = join(repo, dir);
    if (existsSync(full) && existsSync(join(full, 'index.html'))) {
      return full;
    }
  }
  if (existsSync(join(repo, 'index.html'))) {
    return repo;
  }
  return null;
}

// ── Detect if project is Next.js (has dev server) ───────────────────
function isNextJs(repo) {
  try {
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf-8'));
    return !!(pkg.dependencies?.next || pkg.devDependencies?.next);
  } catch { return false; }
}

// ── Find app routes from filesystem (Next.js App Router or pages) ───
function discoverRoutes(repo) {
  const routes = new Set(['/']);

  // Next.js App Router: src/app/**/page.tsx
  const appDirs = [join(repo, 'src', 'app'), join(repo, 'app')];
  for (const appDir of appDirs) {
    if (!existsSync(appDir)) continue;
    walkDir(appDir, (filePath) => {
      if (/page\.(tsx?|jsx?)$/.test(filePath)) {
        let route = '/' + relative(appDir, filePath)
          .replace(/\\/g, '/')
          .replace(/\/page\.(tsx?|jsx?)$/, '')
          .replace(/^\/$/, '');
        if (route === '/') return; // already added
        // Skip dynamic routes like /[id]
        if (route.includes('[')) return;
        routes.add(route);
      }
    });
  }

  // Next.js Pages Router: src/pages/*.tsx or pages/*.tsx
  const pagesDirs = [join(repo, 'src', 'pages'), join(repo, 'pages')];
  for (const pagesDir of pagesDirs) {
    if (!existsSync(pagesDir)) continue;
    walkDir(pagesDir, (filePath) => {
      if (/\.(tsx?|jsx?)$/.test(filePath) && !filePath.includes('_app') && !filePath.includes('_document') && !filePath.includes('api/')) {
        let route = '/' + relative(pagesDir, filePath)
          .replace(/\\/g, '/')
          .replace(/\.(tsx?|jsx?)$/, '')
          .replace(/\/index$/, '');
        if (route.includes('[')) return;
        if (route === '' || route === '/') return;
        routes.add(route);
      }
    });
  }

  // Static HTML pages in serve dir
  const serveDir = detectServeDir(repo);
  if (serveDir) {
    walkDir(serveDir, (filePath) => {
      if (filePath.endsWith('.html') && !filePath.includes('node_modules')) {
        let route = '/' + relative(serveDir, filePath)
          .replace(/\\/g, '/')
          .replace(/\/index\.html$/, '')
          .replace(/\.html$/, '');
        if (route === '/') return;
        routes.add(route);
      }
    });
  }

  return [...routes];
}

function walkDir(dir, cb) {
  try {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue;
      const full = join(dir, entry);
      try {
        const st = statSync(full);
        if (st.isDirectory()) walkDir(full, cb);
        else cb(full);
      } catch { /* skip unreadable */ }
    }
  } catch { /* dir not readable */ }
}

// ── Scan exported components vs imported components ─────────────────
function checkComponentWiring(repo) {
  const issues = [];
  const componentDirs = [
    join(repo, 'src', 'components'),
    join(repo, 'components'),
  ];

  const componentFiles = [];
  for (const dir of componentDirs) {
    if (!existsSync(dir)) continue;
    walkDir(dir, (f) => {
      if (/\.(tsx?|jsx?)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.') && !f.endsWith('index.ts') && !f.endsWith('index.tsx')) {
        componentFiles.push(f);
      }
    });
  }

  if (componentFiles.length === 0) return issues;

  // Read all page/layout files to see what's imported
  const pageFiles = [];
  const pageDirs = [
    join(repo, 'src', 'app'),
    join(repo, 'app'),
    join(repo, 'src', 'pages'),
    join(repo, 'pages'),
  ];
  for (const dir of pageDirs) {
    if (!existsSync(dir)) continue;
    walkDir(dir, (f) => {
      if (/\.(tsx?|jsx?)$/.test(f)) pageFiles.push(f);
    });
  }

  // Also check the main page/app entry
  for (const entry of ['src/App.tsx', 'src/App.jsx', 'src/main.tsx', 'src/index.tsx']) {
    const full = join(repo, entry);
    if (existsSync(full)) pageFiles.push(full);
  }

  if (pageFiles.length === 0) return issues;

  // Collect all import text from page files
  let allPageImports = '';
  for (const pf of pageFiles) {
    try { allPageImports += readFileSync(pf, 'utf-8') + '\n'; } catch {}
  }

  // Check each component — is its name referenced in any page file?
  for (const cf of componentFiles) {
    const name = basename(cf).replace(/\.(tsx?|jsx?)$/, '');
    // Skip utility/helper names
    if (/^(index|types|utils|helpers|constants|styles)$/i.test(name)) continue;
    // Check if component name appears in page imports (import or JSX usage)
    if (!allPageImports.includes(name)) {
      issues.push(`Unused component: ${relative(repo, cf)} — never imported in any page/layout`);
    }
  }

  return issues;
}

// ── Port utilities ──────────────────────────────────────────────────
function getPort() {
  if (requestedPort > 0) return requestedPort;
  return 9100 + Math.floor(Math.random() * 900);
}

function startServer(serveDir, port) {
  return new Promise((resolve, reject) => {
    const proc = spawn('serve', [serveDir, '-l', String(port), '-s', '--no-clipboard'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });
    let started = false;
    const timeout = setTimeout(() => {
      if (!started) { proc.kill(); reject(new Error('Server did not start within 10s')); }
    }, 10000);

    const onData = (data) => {
      const text = data.toString();
      if (text.includes('Accepting connections') || text.includes('http://')) {
        if (!started) { started = true; clearTimeout(timeout); setTimeout(() => resolve(proc), 500); }
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', (err) => { clearTimeout(timeout); reject(err); });
    proc.on('exit', (code) => { if (!started) { clearTimeout(timeout); reject(new Error(`Server exited with code ${code}`)); } });
  });
}

// ── Placeholder detection patterns ─────────────────────────────────
const PLACEHOLDER_PATTERNS = [
  /coming soon/i,
  /todo:?\s/i,
  /placeholder/i,
  /not yet implemented/i,
  /under construction/i,
  /lorem ipsum/i,
  /game started!\s*$/i,
  /feature coming/i,
];

// ── Main smoke test ─────────────────────────────────────────────────
async function runSmokeTest() {
  const serveDir = detectServeDir(repoPath);
  const isNext = isNextJs(repoPath);

  if (!serveDir && !isNext) {
    console.log(JSON.stringify({
      status: 'skip',
      reason: 'No serveable directory found (no dist/build/out with index.html)',
    }));
    process.exit(0);
  }

  const port = getPort();
  let serverProc = null;
  let browser = null;

  try {
    // Start server
    if (serveDir) {
      serverProc = await startServer(serveDir, port);
    }

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
      executablePath: '/usr/bin/chromium-browser',
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

    // Discover routes
    const routes = discoverRoutes(repoPath);
    const baseUrl = `http://localhost:${port}`;

    // Global collectors
    const allFailures = [];
    const consoleErrors = [];
    const jsExceptions = [];
    const routeResults = [];

    // ── Test each route ──────────────────────────────────────────
    for (const route of routes) {
      const page = await context.newPage();
      const routeErrors = [];
      const routeExceptions = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon.ico') && !text.includes('ResizeObserver')) {
            routeErrors.push(text);
            consoleErrors.push(`[${route}] ${text}`);
          }
        }
      });
      page.on('pageerror', (err) => {
        if (!err.message.includes('ResizeObserver')) {
          routeExceptions.push(err.message);
          jsExceptions.push(`[${route}] ${err.message}`);
        }
      });

      try {
        const response = await page.goto(`${baseUrl}${route}`, {
          waitUntil: 'networkidle',
          timeout: pageTimeout,
        });
        const httpStatus = response?.status() ?? 0;
        await page.waitForTimeout(1500);

        if (httpStatus >= 400) {
          allFailures.push(`[${route}] HTTP ${httpStatus} — page failed to load`);
        }

        // Check blank
        const bodyText = await page.evaluate(() => document.body?.innerText?.trim() || '');
        const bodyChildCount = await page.evaluate(() => document.body?.children?.length || 0);
        if (bodyText.length === 0 && bodyChildCount <= 1) {
          allFailures.push(`[${route}] Page appears blank — no visible text or DOM`);
        }

        // Check for placeholder content
        for (const pat of PLACEHOLDER_PATTERNS) {
          if (pat.test(bodyText)) {
            allFailures.push(`[${route}] Placeholder content detected: "${bodyText.match(pat)?.[0]}"`);
            break;
          }
        }

        // Check canvas for game/canvas projects
        const canvasInfo = await page.evaluate(() => {
          const canvas = document.querySelector('canvas');
          if (!canvas) return null;
          return { width: canvas.width, height: canvas.height };
        });

        // ── Interactive test: click all primary buttons ──────────
        const buttons = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, [role="button"], a.btn, a.button'));
          return btns.map(b => ({
            text: b.textContent?.trim() || '',
            tag: b.tagName,
            visible: b.offsetParent !== null,
            disabled: b.disabled || false,
          })).filter(b => b.visible && !b.disabled && b.text.length > 0 && b.text.length < 50);
        });

        for (const btn of buttons) {
          // Skip destructive/navigation buttons
          if (/delete|remove|logout|sign out|back/i.test(btn.text)) continue;

          try {
            const beforeHTML = await page.evaluate(() => document.body.innerHTML.length);

            // Click the button
            await page.click(`text="${btn.text}"`, { timeout: 3000 });
            await page.waitForTimeout(1500);

            // Check for JS exceptions after click
            if (routeExceptions.length > 0) {
              const lastErr = routeExceptions[routeExceptions.length - 1];
              allFailures.push(`[${route}] JS error after clicking "${btn.text}": ${lastErr}`);
            }

            // Check page didn't go blank after click
            const afterText = await page.evaluate(() => document.body?.innerText?.trim() || '');
            const afterChildCount = await page.evaluate(() => document.body?.children?.length || 0);
            if (afterText.length === 0 && afterChildCount <= 1) {
              allFailures.push(`[${route}] Page went blank after clicking "${btn.text}"`);
            }

            // Check for placeholder after click
            for (const pat of PLACEHOLDER_PATTERNS) {
              if (pat.test(afterText) && !pat.test(bodyText)) {
                allFailures.push(`[${route}] Placeholder appeared after clicking "${btn.text}": "${afterText.match(pat)?.[0]}"`);
                break;
              }
            }

            // If project expects canvas (game), check it appeared after "Start" click
            if (/start|play|begin|basla/i.test(btn.text)) {
              const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));
              const hasGameContent = await page.evaluate(() => {
                const body = document.body.innerText;
                // If we see just a simple "started" message with a back button, that's a placeholder
                const el = document.querySelectorAll('button, [role="button"]');
                const btnTexts = Array.from(el).map(b => b.textContent?.trim().toLowerCase() || '');
                const hasBackOnly = btnTexts.length === 1 && /back|menu|return/i.test(btnTexts[0]);
                const isPlaceholder = /game started|started!/i.test(body) && hasBackOnly;
                return { hasCanvas, isPlaceholder, btnCount: btnTexts.length };
              });
              if (hasGameContent.isPlaceholder) {
                allFailures.push(`[${route}] PLACEHOLDER: Clicking "${btn.text}" shows static "Game Started!" instead of actual game content (canvas/interactive elements missing)`);
              }
            }

            // Navigate back for next button test
            await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: pageTimeout });
            await page.waitForTimeout(500);
          } catch {
            // Button click failed — non-fatal, continue
          }
        }

        routeResults.push({
          route,
          httpStatus,
          bodyTextLength: bodyText.length,
          canvasDetected: canvasInfo !== null,
          buttonsFound: buttons.length,
          errors: routeErrors.length,
          exceptions: routeExceptions.length,
        });

      } catch (err) {
        allFailures.push(`[${route}] Navigation failed: ${err.message}`);
        routeResults.push({ route, error: err.message });
      }

      await page.close();
    }

    // ── Internal link check (from homepage) ─────────────────────
    try {
      const linkPage = await context.newPage();
      await linkPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: pageTimeout });
      const links = await linkPage.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => ({ href: a.getAttribute('href'), text: a.textContent?.trim() || '' }))
          .filter(l => l.href && !l.href.startsWith('http') && !l.href.startsWith('mailto:') && !l.href.startsWith('tel:') && l.href !== '#');
      });
      for (const link of links) {
        try {
          const linkUrl = new URL(link.href, baseUrl);
          const resp = await linkPage.context().request.get(linkUrl.toString());
          if (resp.status() >= 400) {
            allFailures.push(`Broken internal link: "${link.text}" -> ${link.href} (HTTP ${resp.status()})`);
          }
        } catch {
          allFailures.push(`Broken internal link: "${link.text}" -> ${link.href} (unreachable)`);
        }
      }
      await linkPage.close();
    } catch { /* link check non-fatal */ }

    // ── Component wiring check ──────────────────────────────────
    const wiringIssues = checkComponentWiring(repoPath);
    for (const issue of wiringIssues) {
      allFailures.push(`WIRING: ${issue}`);
    }

    // ── Screenshot (homepage) ───────────────────────────────────
    try {
      const ssPage = await context.newPage();
      await ssPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: pageTimeout });
      await ssPage.screenshot({ path: join(repoPath, 'smoke-test-screenshot.png'), fullPage: false });
      await ssPage.close();
    } catch { /* screenshot non-fatal */ }

    // ── JS exception failures ───────────────────────────────────
    for (const err of jsExceptions) {
      allFailures.push(`JS Exception: ${err}`);
    }

    // ── Build result ────────────────────────────────────────────
    const result = {
      status: allFailures.length === 0 ? 'pass' : 'fail',
      routesTested: routes.length,
      routes: routeResults,
      jsExceptions: jsExceptions.length,
      consoleErrors: consoleErrors.length,
      componentWiringIssues: wiringIssues.length,
      screenshotPath: join(repoPath, 'smoke-test-screenshot.png'),
      failures: allFailures,
    };

    console.log(JSON.stringify(result, null, 2));

    await browser.close();
    if (serverProc) serverProc.kill();

    process.exit(allFailures.length > 0 ? 1 : 0);

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    if (serverProc) serverProc.kill();
    console.log(JSON.stringify({ status: 'error', error: err.message }));
    process.exit(2);
  }
}

runSmokeTest();
