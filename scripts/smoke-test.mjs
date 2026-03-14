#!/usr/bin/env node
/**
 * Smoke Test v5 — Hybrid: static analysis + agent-browser interactive check.
 *
 * Phase 1 (fast): Component wiring, route discovery — pure filesystem
 * Phase 2 (browser): Homepage load, primary button click, placeholder detection
 * Phase 3 (browser): Link validation — navigate internal links, check for errors
 * Phase 4 (browser): Button functionality — click buttons, verify responses
 * Phase 5 (browser): Form testing — fill inputs, submit forms
 * Phase 7  (browser): Visual & Asset Integrity — icons, images, font loading
 * Phase 8  (browser): Layout & UX Glitches — overflow, duplicate IDs, z-index overlap
 * Phase 9  (browser): Network Silent Failures — fetch/XHR error collection
 * Phase 10 (browser): Console error collection — JS error aggregation
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

// ── Phase helpers ───────────────────────────────────────────────────

/** Check if page is non-blank (has content in accessibility tree) */
function isPageNonBlank(snap) {
  const p = parseSnapshot(snap);
  return p.headings.length > 0 || p.buttons.length > 0 || p.links.length > 0 || p.canvas;
}

/** Get JS error count from injected collector */
function getJsErrorCount() {
  const result = abOk('eval', 'return window.__smoke_errors?.length || 0');
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

const SKIP_BUTTON_RE = /^(close|dismiss|cancel|x|\u00d7|\u2715|\u2716)$/i;

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const serveDir = detectServeDir(repoPath);
  if (!serveDir) { console.log(JSON.stringify({status:'skip',reason:'No serveable directory'})); process.exit(0); }

  const failures = [];
  let linksChecked = 0, linksBroken = 0;
  let buttonsChecked = 0;
  let formsChecked = 0;
  let consoleErrors = [];

  // ── Phase 1: Static ──
  const routes = discoverRoutes(repoPath);
  const wiringIssues = checkComponentWiring(repoPath);
  for (const w of wiringIssues) failures.push('WIRING: ' + w);

  // ── Phase 2: Browser (homepage + primary action) ──
  const port = requestedPort > 0 ? requestedPort : 9100 + Math.floor(Math.random()*900);
  let serverProc = null;

  try {
    // Start server only if we need to
    if (requestedPort <= 0) {
      serverProc = await startServer(serveDir, port);
    }
    const baseUrl = 'http://localhost:' + port;

    ab('close');
    await sleep(300);

    // Open homepage
    const nav = ab('open', baseUrl);
    if (nav.startsWith('__ERR__')) {
      failures.push('[/] Homepage failed to load: ' + nav);
    } else {
      await sleep(2000);

      // ── Phase 6 (setup): Inject error collector right after open ──
      injectErrorCollector();

      const snap = abOk('snapshot') || '';
      const p = parseSnapshot(snap);

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

      // Check other routes exist (navigate to first 3 non-root routes)
      for (const route of routes.slice(1, 4)) {
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
          'return JSON.stringify(' +
            'Array.from(document.querySelectorAll("a[href]"))' +
            '.map(a => ({text: a.textContent?.trim() || "", href: a.getAttribute("href")}))' +
            '.filter(l => l.href && !l.href.startsWith("mailto:") && !l.href.startsWith("tel:") && !l.href.startsWith("javascript:"))' +
          ')'
        );

        let allLinks = [];
        try { allLinks = JSON.parse(linksJson || '[]'); } catch {}

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
          const lNav = ab('open', url);
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
            ab('click', '@ref_' + ref);
          } else {
            ab('click', btn);
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
            /submit|send|go|search|login|sign|save|ok|gonder|kaydet|ara/i.test(b)
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


      // ── Phase 7: Visual & Asset Integrity ─────────────────────
      try {
        ab('open', baseUrl);
        await sleep(1500);
        injectErrorCollector();

        const visualJson = abOk('eval',
          'return JSON.stringify((function() {' +
          '  var issues = [];' +
          '  document.querySelectorAll("svg").forEach(function(svg) {' +
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
          '    if (r.width === 0 && r.height === 0) {' +
          '      issues.push({type:"font-icon-zero", detail: el.className});' +
          '    } else if (cs.content === "none" || cs.content === "normal" || cs.content === "") {' +
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
          '  return issues;' +
          '})()'
        );

        let visualIssues = [];
        try { visualIssues = JSON.parse(visualJson || '[]'); } catch {}

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
          'return JSON.stringify((function() {' +
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

        let layoutIssues = [];
        try { layoutIssues = JSON.parse(layoutJson || '[]'); } catch {}

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
        const netJson = abOk('eval', 'return JSON.stringify(window.__smoke_network_errors || [])');
        try { networkErrors = JSON.parse(netJson || '[]'); } catch {}
        if (Array.isArray(networkErrors) && networkErrors.length > 0) {
          networkErrors = networkErrors.slice(0, 20);
          failures.push('[NETWORK] ' + networkErrors.length + ' silent API failure(s): ' + networkErrors.slice(0, 3).join('; '));
        }
      } catch (e) {
        failures.push('[NETWORK] Phase 9 error: ' + e.message);
      }

      // ── Phase 10 (collect): Gather console errors ─────────────
      try {
        const errJson = abOk('eval', 'return JSON.stringify(window.__smoke_errors || [])');
        try {
          const errors = JSON.parse(errJson || '[]');
          if (Array.isArray(errors) && errors.length > 0) {
            consoleErrors = errors.slice(0, 20);
            failures.push('[CONSOLE] ' + errors.length + ' JS error(s) collected: ' + errors.slice(0, 3).join('; '));
          }
        } catch {}
      } catch {}
    }

    ab('close');
  } catch (err) {
    failures.push('Browser test error: ' + err.message);
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
    linksChecked,
    linksBroken,
    buttonsChecked,
    formsChecked,
    visualIssues: failures.filter(f => f.startsWith('[VISUAL]')).length,
    layoutIssues: failures.filter(f => f.startsWith('[LAYOUT]')).length,
    networkErrors: failures.filter(f => f.startsWith('[NETWORK]')).length,
    consoleErrors,
    failures,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(failures.length > 0 ? 1 : 0);
}

main();
