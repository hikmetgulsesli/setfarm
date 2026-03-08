#!/usr/bin/env node
/**
 * Smoke Test v3 — Hybrid: static analysis + agent-browser interactive check.
 *
 * Phase 1 (fast): Component wiring, route discovery — pure filesystem
 * Phase 2 (browser): Homepage load, primary button click, placeholder detection
 *   Uses agent-browser CLI for real browser interaction
 *
 * Usage: node smoke-test.mjs <repo-path> [--port PORT] [--timeout MS]
 * Exit codes: 0 = pass, 1 = failures found, 2 = script error
 */

import { execFileSync, spawn } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, basename, relative } from 'path';

const args = process.argv.slice(2);
const repoPath = args[0];
if (!repoPath) { console.error('Usage: node smoke-test.mjs <repo-path> [--port PORT]'); process.exit(2); }

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
  for (const d of ['dist','build','out','public','.next','.output']) {
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

// ── Phase 2: Browser Test ───────────────────────────────────────────

function parseSnapshot(text) {
  if (!text) return { headings:[], buttons:[], links:[], canvas:false };
  return {
    headings: [...text.matchAll(/heading "([^"]+)"/g)].map(m=>m[1]),
    buttons: [...text.matchAll(/button "([^"]+)"/g)].map(m=>m[1]),
    links: [...text.matchAll(/link "([^"]+)"/g)].map(m=>m[1]),
    canvas: text.includes('canvas'),
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

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const serveDir = detectServeDir(repoPath);
  if (!serveDir) { console.log(JSON.stringify({status:'skip',reason:'No serveable directory'})); process.exit(0); }

  const failures = [];

  // ── Phase 1: Static ──
  const routes = discoverRoutes(repoPath);
  const wiringIssues = checkComponentWiring(repoPath);
  for (const w of wiringIssues) failures.push(`WIRING: ${w}`);

  // ── Phase 2: Browser (homepage + primary action) ──
  const port = requestedPort > 0 ? requestedPort : 9100 + Math.floor(Math.random()*900);
  let serverProc = null;

  try {
    // Start server only if we need to
    if (requestedPort <= 0) {
      serverProc = await startServer(serveDir, port);
    }
    const baseUrl = `http://localhost:${port}`;

    ab('close');
    await sleep(300);

    // Open homepage
    const nav = ab('open', baseUrl);
    if (nav.startsWith('__ERR__')) {
      failures.push(`[/] Homepage failed to load: ${nav}`);
    } else {
      await sleep(2000);
      const snap = abOk('snapshot') || '';
      const p = parseSnapshot(snap);

      // Blank check
      if (!p.headings.length && !p.buttons.length && !p.links.length && !p.canvas) {
        failures.push('[/] Homepage blank — nothing in accessibility tree');
      }

      // Placeholder check
      for (const h of p.headings) { if (isPlaceholder(h)) failures.push(`[/] Placeholder heading: "${h}"`); }

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
            `[/] PLACEHOLDER GAME: "${primaryBtn}" -> "${after.headings[0]}" with only ` +
            `"${after.buttons[0] || 'no'}" button. No canvas/game UI. Components exist in ` +
            `src/components/ but are NOT wired into the page.`
          );
        }

        // Generic placeholder after click
        for (const h of after.headings) {
          if (isPlaceholder(h) && !p.headings.includes(h)) {
            failures.push(`[/] Placeholder after clicking "${primaryBtn}": "${h}"`);
          }
        }

        // Blank after click
        if (!after.headings.length && !after.buttons.length && !after.canvas) {
          failures.push(`[/] Page went blank after clicking "${primaryBtn}"`);
        }

        ab('screenshot', join(repoPath, 'smoke-after-click.png'), '--annotate');
      }

      // Check other routes exist (navigate to first 3 non-root routes)
      for (const route of routes.slice(1, 4)) {
        const rNav = ab('open', `${baseUrl}${route}`);
        if (rNav.startsWith('__ERR__')) {
          failures.push(`[${route}] Route failed to load`);
          continue;
        }
        await sleep(1500);
        const rSnap = abOk('snapshot') || '';
        const rp = parseSnapshot(rSnap);
        if (!rp.headings.length && !rp.buttons.length && !rp.links.length && !rp.canvas) {
          failures.push(`[${route}] Route appears blank`);
        }
        for (const h of rp.headings) { if (isPlaceholder(h)) failures.push(`[${route}] Placeholder: "${h}"`); }
      }
    }

    ab('close');
  } catch (err) {
    failures.push(`Browser test error: ${err.message}`);
    ab('close');
  }

  if (serverProc) serverProc.kill();

  // ── Output ──
  const result = {
    status: failures.length === 0 ? 'pass' : 'fail',
    routesDiscovered: routes.length,
    routes,
    componentWiringIssues: wiringIssues.length,
    wiringDetails: wiringIssues,
    failures,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(failures.length > 0 ? 1 : 0);
}

main();
