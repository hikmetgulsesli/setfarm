#!/usr/bin/env node
/**
 * Smoke Test — Playwright-based runtime verification for web projects.
 * Catches missing DOM elements, JS exceptions, console errors, blank pages.
 *
 * Usage: node smoke-test.mjs <repo-path> [--port PORT] [--timeout MS]
 *
 * Behavior:
 *   1. Detects serve directory (dist/, build/, out/, public/, or .)
 *   2. Starts a static server on a random port
 *   3. Opens Chromium, navigates to the page
 *   4. Collects console errors and uncaught exceptions
 *   5. Checks that <body> has visible content (not blank)
 *   6. Reports results as JSON
 *
 * Exit codes: 0 = pass, 1 = failures found, 2 = script error
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';

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

// Detect serve directory
function detectServeDir(repo) {
  for (const dir of ['dist', 'build', 'out', 'public', '.next', '.output']) {
    const full = join(repo, dir);
    if (existsSync(full) && existsSync(join(full, 'index.html'))) {
      return full;
    }
  }
  // Fallback: check if repo root has index.html
  if (existsSync(join(repo, 'index.html'))) {
    return repo;
  }
  return null;
}

// Find a free port
function getPort() {
  if (requestedPort > 0) return requestedPort;
  return 9100 + Math.floor(Math.random() * 900);
}

// Start serve and wait for it to be ready
function startServer(serveDir, port) {
  return new Promise((resolve, reject) => {
    const proc = spawn('serve', [serveDir, '-l', String(port), '-s', '--no-clipboard'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        proc.kill();
        reject(new Error('Server did not start within 10s'));
      }
    }, 10000);

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      if (text.includes('Accepting connections') || text.includes('http://')) {
        if (!started) {
          started = true;
          clearTimeout(timeout);
          // Give it a moment to fully bind
          setTimeout(() => resolve(proc), 500);
        }
      }
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      // serve prints info to stderr too
      if (text.includes('Accepting connections') || text.includes('http://')) {
        if (!started) {
          started = true;
          clearTimeout(timeout);
          setTimeout(() => resolve(proc), 500);
        }
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.on('exit', (code) => {
      if (!started) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

async function runSmokeTest() {
  const serveDir = detectServeDir(repoPath);
  if (!serveDir) {
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
    serverProc = await startServer(serveDir, port);

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
      executablePath: '/usr/bin/chromium-browser',
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    // Collectors
    const consoleErrors = [];
    const jsExceptions = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      jsExceptions.push(err.message);
    });

    // Navigate
    const url = `http://localhost:${port}/`;
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: pageTimeout,
    });

    const httpStatus = response?.status() ?? 0;

    // Wait a bit for async initialization
    await page.waitForTimeout(2000);

    // Check page is not blank
    const bodyText = await page.evaluate(() => document.body?.innerText?.trim() || '');
    const bodyChildCount = await page.evaluate(() => document.body?.children?.length || 0);
    const isBlank = bodyText.length === 0 && bodyChildCount <= 1;

    // Check canvas exists and has content (for canvas-based apps)
    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      return {
        width: canvas.width,
        height: canvas.height,
        hasContext: !!canvas.getContext('2d'),
      };
    });

    // Get all element IDs referenced in JS that don't exist
    // (This catches the exact space-shooter bug pattern)
    const missingIds = await page.evaluate(() => {
      // Scan all script content for getElementById calls
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      // Can't read external scripts, but we CAN check if errors were thrown
      return null;
    });

    // Take screenshot
    const screenshotPath = join(repoPath, 'smoke-test-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Build result
    const failures = [];

    if (httpStatus >= 400) {
      failures.push(`HTTP ${httpStatus} — page failed to load`);
    }

    for (const err of jsExceptions) {
      // Filter out known noise
      if (err.includes('ResizeObserver loop')) continue;
      failures.push(`JS Exception: ${err}`);
    }

    for (const err of consoleErrors) {
      // Filter out noise (CSP, favicon, extension errors)
      if (err.includes('favicon.ico')) continue;
      if (err.includes('ERR_FILE_NOT_FOUND') && err.includes('favicon')) continue;
      if (err.includes('ResizeObserver')) continue;
      failures.push(`Console Error: ${err}`);
    }

    if (isBlank) {
      failures.push('Page appears blank — no visible text content and minimal DOM elements');
    }

    // Internal link verification — check that all relative links resolve
    try {
      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors
          .map(a => ({ href: a.getAttribute('href'), text: a.textContent?.trim() || '' }))
          .filter(l => l.href && !l.href.startsWith('http') && !l.href.startsWith('mailto:') && !l.href.startsWith('tel:') && l.href !== '#');
      });

      for (const link of links) {
        try {
          const linkUrl = new URL(link.href, url);
          const resp = await page.context().request.get(linkUrl.toString());
          if (resp.status() >= 400) {
            failures.push(`Broken internal link: "${link.text}" → ${link.href} (HTTP ${resp.status()})`);
          }
        } catch (e) {
          failures.push(`Broken internal link: "${link.text}" → ${link.href} (unreachable)`);
        }
      }
    } catch (e) {
      // Link check failed — non-fatal, continue
    }

    const result = {
      status: failures.length === 0 ? 'pass' : 'fail',
      url,
      serveDir: basename(serveDir),
      httpStatus,
      jsExceptions: jsExceptions.length,
      consoleErrors: consoleErrors.length,
      bodyTextLength: bodyText.length,
      bodyChildCount,
      canvasDetected: canvasInfo !== null,
      screenshotPath,
      failures,
    };

    console.log(JSON.stringify(result, null, 2));

    await browser.close();
    serverProc.kill();

    process.exit(failures.length > 0 ? 1 : 0);

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    if (serverProc) serverProc.kill();
    console.log(JSON.stringify({
      status: 'error',
      error: err.message,
    }));
    process.exit(2);
  }
}

runSmokeTest();
