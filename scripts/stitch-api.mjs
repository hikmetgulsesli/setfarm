#!/usr/bin/env node

/**
 * stitch-api.mjs — CLI wrapper for Google Stitch MCP (JSON-RPC over HTTPS)
 *
 * Usage:
 *   node stitch-api.mjs create-project "Project Name"
 *   node stitch-api.mjs ensure-project "Project Name" /path/to/repo    (find-or-create + persist .stitch)
 *   node stitch-api.mjs generate-screen <projectId> "<prompt>" [DESKTOP|MOBILE|TABLET] [GEMINI_3_PRO|GEMINI_3_FLASH]
 *   node stitch-api.mjs generate-screen-safe <projectId> "<prompt>" "<title>" [device] [model]  (dedup check)
 *   node stitch-api.mjs list-screens <projectId>
 *   node stitch-api.mjs get-screen <projectId> <screenId>
 *   node stitch-api.mjs download-screen <projectId> <screenId> <outputPath>
 *   node stitch-api.mjs create-manifest <projectId> <outputDir>
 *   node stitch-api.mjs extract-tokens <stitchDir> [outputCssFile]
 *   node stitch-api.mjs download <url> <outputFile>
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load API key from .env
function loadApiKey() {
  const envPath = resolve(__dirname, '.env');
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('STITCH_API_KEY=')) {
        return trimmed.slice('STITCH_API_KEY='.length).replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // fall through
  }
  if (process.env.STITCH_API_KEY) return process.env.STITCH_API_KEY;
  throw new Error('STITCH_API_KEY not found in .env or environment');
}

const API_KEY = loadApiKey();
const MCP_ENDPOINT = 'https://stitch.googleapis.com/mcp';
let requestId = 0;

// JSON-RPC call helper
async function rpc(method, params = {}) {
  requestId++;
  const body = {
    jsonrpc: '2.0',
    id: requestId,
    method,
    params,
  };

  const res = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000), // 5 min timeout
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.error) {
    throw new Error(`RPC error ${json.error.code}: ${json.error.message}`);
  }
  return json.result;
}

// Initialize MCP session
async function initialize() {
  return rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'stitch-cli', version: '1.0.0' },
  });
}

// Call an MCP tool
async function callTool(name, args) {
  const result = await rpc('tools/call', { name, arguments: args });
  return result;
}

// Download a file from a signed URL (User-Agent + 429 retry + size validation)
async function downloadFile(url, outputPath, attempt = 1) {
  const headers = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36' };
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000), headers });
  if (res.status === 429 && attempt < 5) { const delay = 10000 * Math.pow(2, attempt - 1) + Math.random() * 2000; process.stderr.write(`429 rate limited — retrying in ${Math.round(delay/1000)}s (attempt ${attempt}/5)\n`); await new Promise(r => setTimeout(r, delay)); return downloadFile(url, outputPath, attempt + 1); }
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buffer);
  if (buffer.length < 500 && outputPath.endsWith('.html')) throw new Error('Empty HTML (' + buffer.length + ' bytes) - design not generated');
  return { path: outputPath, size: buffer.length };
}

// Parse screens from generate response
function parseScreens(result) {
  const screens = [];
  const suggestions = [];

  if (!result || !result.content) return { screens, suggestions };

  for (const item of result.content) {
    if (item.type === 'text') {
      try {
        const parsed = JSON.parse(item.text);
        // Check for outputComponents structure (camelCase from API)
        const components = parsed.outputComponents || parsed.output_components;
        if (components) {
          for (const comp of components) {
            if (comp.design && comp.design.screens) {
              for (const screen of comp.design.screens) {
                screens.push({
                  screenId: screen.id || screen.screen_id || screen.screenId,
                  title: screen.title || 'Untitled',
                  htmlUrl: screen.htmlCode?.downloadUrl || screen.html_code?.download_url || null,
                  screenshotUrl: screen.screenshot?.downloadUrl || screen.screenshot?.download_url || null,
                  width: screen.width,
                  height: screen.height,
                });
              }
            }
            if (comp.suggestions) {
              suggestions.push(...comp.suggestions);
            }
          }
        }
        // Direct screens array
        if (parsed.screens) {
          for (const screen of parsed.screens) {
            screens.push({
              screenId: screen.id || screen.screen_id || screen.screenId,
              title: screen.title || 'Untitled',
              htmlUrl: screen.htmlCode?.downloadUrl || screen.html_code?.download_url || null,
              screenshotUrl: screen.screenshot?.downloadUrl || screen.screenshot?.download_url || null,
              width: screen.width,
              height: screen.height,
            });
          }
        }
      } catch (e) {
        process.stderr.write(`WARN: Could not parse screen data: ${e.message}\n`);
      }
    }
  }

  return { screens, suggestions };
}

// Parse screen list from list_screens result (shared helper)
function parseScreenList(result) {
  let screens = [];
  if (result && result.content) {
    for (const item of result.content) {
      if (item.type === 'text') {
        try {
          const parsed = JSON.parse(item.text);
          if (Array.isArray(parsed)) {
            screens = parsed;
          } else if (parsed.screens) {
            screens = parsed.screens;
          } else if (parsed.structuredContent?.screens) {
            screens = parsed.structuredContent.screens;
          } else if (parsed.outputComponents) {
            for (const comp of parsed.outputComponents) {
              if (comp.design?.screens) screens.push(...comp.design.screens);
            }
          } else if (parsed.output_components) {
            for (const comp of parsed.output_components) {
              if (comp.design?.screens) screens.push(...comp.design.screens);
            }
          }
        } catch {
          // skip unparseable text
        }
      }
    }
  }
  return screens;
}

// Safe JS object literal parser — converts JS object syntax to JSON then parses.
// Handles: unquoted keys, single-quoted strings, trailing commas, template literals.
// Does NOT execute arbitrary code (unlike new Function()).
function safeParseJsObject(src) {
  let s = src.trim();
  // Remove template literals (backtick strings) — replace with empty string
  s = s.replace(/`[^`]*`/g, '""');
  // Convert single-quoted strings to double-quoted
  s = s.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"');
  // Quote unquoted keys: word characters before a colon
  s = s.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  // Remove JS comments
  s = s.replace(/\/\/[^\n]*/g, '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  try {
    return JSON.parse(s);
  } catch (e) {
    process.stderr.write(`WARN: safeParseJsObject failed: ${e.message}\n`);
    return {};
  }
}

// Commands
const commands = {
  async 'list-projects'() {
    await initialize();
    const result = await callTool('list_projects', {});
    let projects = [];
    if (result && result.content) {
      for (const item of result.content) {
        if (item.type === 'text') {
          try {
            const parsed = JSON.parse(item.text);
            projects = parsed.projects || parsed || [];
          } catch { /* skip */ }
        }
      }
    }
    console.log(JSON.stringify(projects, null, 2));
  },

  async 'find-project'(name) {
    if (!name) throw new Error('Usage: find-project "Project Name"');
    await initialize();
    const result = await callTool('list_projects', {});
    let projects = [];
    if (result && result.content) {
      for (const item of result.content) {
        if (item.type === 'text') {
          try {
            const parsed = JSON.parse(item.text);
            projects = parsed.projects || parsed || [];
          } catch { /* skip */ }
        }
      }
    }
    const match = projects.find(p => {
      const pName = (p.title || p.displayName || p.name || '').toLowerCase();
      return pName === name.toLowerCase() || pName.includes(name.toLowerCase());
    });
    if (match) {
      const id = (match.name || '').replace('projects/', '') || match.projectId || match.id;
      console.log(JSON.stringify({ found: true, projectId: id, title: match.title || match.displayName }, null, 2));
    } else {
      console.log(JSON.stringify({ found: false }, null, 2));
    }
  },

  async 'create-project'(title) {
    if (!title) throw new Error('Usage: create-project "Project Name"');
    await initialize();
    const result = await callTool('create_project', { title });

    // Parse project ID from result
    let projectId = null;
    if (result && result.content) {
      for (const item of result.content) {
        if (item.type === 'text') {
          try {
            const parsed = JSON.parse(item.text);
            // Handle "projects/123456" format
            const name = parsed.name || parsed.project?.name || '';
            projectId = name.replace('projects/', '') || parsed.projectId || parsed.project_id;
            if (projectId) break;
          } catch {
            // Try regex extraction
            const match = item.text.match(/projects\/(\d+)/);
            if (match) { projectId = match[1]; break; }
          }
        }
      }
    }

    console.log(JSON.stringify({ projectId, title }, null, 2));
  },

  async 'generate-screen'(projectId, prompt, deviceType = 'DESKTOP', modelId = 'GEMINI_3_PRO') {
    if (!projectId || !prompt) throw new Error('Usage: generate-screen <projectId> "<prompt>" [DESKTOP|MOBILE|TABLET] [GEMINI_3_PRO|GEMINI_3_FLASH]');
    await initialize();

    const args = {
      projectId,
      prompt,
      deviceType,
      modelId,
    };

    const result = await callTool('generate_screen_from_text', args);
    const { screens, suggestions } = parseScreens(result);
// Save generated screens to local tracking file for dedup
    if (screens.length > 0) {
      const trackingFile = resolve(process.cwd(), '.stitch-screens.json');
      let tracked = [];
      try { tracked = JSON.parse(readFileSync(trackingFile, 'utf-8')); } catch {}
      for (const s of screens) {
        if (!tracked.some(t => t.screenId === s.screenId)) {
          tracked.push({ screenId: s.screenId, title: s.title || '', category: null, htmlUrl: s.htmlUrl || null });
        }
      }
      writeFileSync(trackingFile, JSON.stringify(tracked, null, 2));
    }

    console.log(JSON.stringify({ screens, suggestions }, null, 2));
  },

  async 'list-screens'(projectId) {
    if (!projectId) throw new Error('Usage: list-screens <projectId>');
    await initialize();
    const result = await callTool('list_screens', { projectId });
    let screens = parseScreenList(result);
    // Fallback: if API returns empty, try local tracking file
    if (screens.length === 0) {
      const trackingFile = resolve(process.cwd(), '.stitch-screens.json');
      try { screens = JSON.parse(readFileSync(trackingFile, 'utf-8')); } catch {}
    }
    console.log(JSON.stringify(screens, null, 2));
  },

  async 'get-screen'(projectId, screenId) {
    if (!projectId || !screenId) throw new Error('Usage: get-screen <projectId> <screenId>');
    await initialize();
    const name = `projects/${projectId}/screens/${screenId}`;
    const result = await callTool('get_screen', { name, projectId, screenId });

    let screen = null;
    if (result && result.content) {
      for (const item of result.content) {
        if (item.type === 'text') {
          try {
            screen = JSON.parse(item.text);
            break;
          } catch {
            // skip
          }
        }
      }
    }

    console.log(JSON.stringify(screen, null, 2));
  },

  async 'ensure-project'(name, repoPath) {
    if (!name || !repoPath) throw new Error('Usage: ensure-project "Project Name" /path/to/repo');

    const stitchFile = resolve(repoPath, '.stitch');

    // 1. Check existing .stitch file
    try {
      const existing = JSON.parse(readFileSync(stitchFile, 'utf-8'));
      if (existing.projectId) {
        // v1.5.60: Validate project has screens before reusing
        const stitchDir = resolve(repoPath, 'stitch');
        let htmlCount = 0;
        try { htmlCount = readdirSync(stitchDir).filter(f => f.endsWith('.html')).length; } catch {}
        let trackedCount = 0;
        try { trackedCount = JSON.parse(readFileSync(resolve(repoPath, '.stitch-screens.json'), 'utf-8')).length; } catch {}
        if (htmlCount > 0 || trackedCount > 0) {
          console.log(JSON.stringify({ projectId: existing.projectId, source: 'stitch-file' }, null, 2));
          return;
        }
        process.stderr.write('Existing project ' + existing.projectId + ' has no screens — creating new
');
      }
    } catch { /* no .stitch file or invalid */ }

    await initialize();

    // 2. Find existing project by name
    const listResult = await callTool('list_projects', {});
    let projects = [];
    if (listResult && listResult.content) {
      for (const item of listResult.content) {
        if (item.type === 'text') {
          try {
            const parsed = JSON.parse(item.text);
            projects = parsed.projects || parsed || [];
          } catch { /* skip */ }
        }
      }
    }

    const match = projects.find(p => {
      const pName = (p.title || p.displayName || p.name || '').toLowerCase();
      return pName === name.toLowerCase() || pName.includes(name.toLowerCase());
    });

    let projectId;
    if (match) {
      projectId = (match.name || '').replace('projects/', '') || match.projectId || match.id;
      process.stderr.write(`Found existing Stitch project: ${projectId}\n`);
    } else {
      // 3. Create new project
      const createResult = await callTool('create_project', { title: name });
      if (createResult && createResult.content) {
        for (const item of createResult.content) {
          if (item.type === 'text') {
            try {
              const parsed = JSON.parse(item.text);
              const pname = parsed.name || parsed.project?.name || '';
              projectId = pname.replace('projects/', '') || parsed.projectId || parsed.project_id;
              if (projectId) break;
            } catch {
              const m2 = item.text.match(/projects\/(\d+)/);
              if (m2) { projectId = m2[1]; break; }
            }
          }
        }
      }
      process.stderr.write(`Created new Stitch project: ${projectId}\n`);
    }

    if (!projectId) throw new Error('Failed to get or create project ID');

    // 4. Persist .stitch file
    const stitchData = { projectId, name, updatedAt: new Date().toISOString() };
    mkdirSync(dirname(stitchFile), { recursive: true });
    writeFileSync(stitchFile, JSON.stringify(stitchData, null, 2));

    console.log(JSON.stringify({ projectId, source: 'created-or-found' }, null, 2));
  },

  async 'generate-screen-safe'(projectId, prompt, screenTitle, deviceType = 'DESKTOP', modelId = 'GEMINI_3_PRO') {
    if (!projectId || !prompt) throw new Error('Usage: generate-screen-safe <projectId> "<prompt>" "<screenTitle>" [DESKTOP|MOBILE|TABLET] [model]');

    await initialize();

    // 1. Check for duplicate screens by title
    if (screenTitle) {
      // list_screens API returns empty for generated screens — use local tracking instead
      let existingScreens = [];
      const trackingFile = resolve(process.cwd(), '.stitch-screens.json');
      try { existingScreens = JSON.parse(readFileSync(trackingFile, 'utf-8')); } catch {}

      const titleLower = screenTitle.toLowerCase();

      // Category-based dedup: detect screen type by keywords, skip if same type exists
      const SCREEN_CATEGORIES = [
        { name: 'main-menu', keywords: ['main menu', 'start menu', 'home screen', 'title screen', 'landing'] },
        { name: 'game-over', keywords: ['game over', 'game-over', 'death screen', 'defeat', 'mission failed'] },
        { name: 'pause', keywords: ['pause', 'paused'] },
        { name: 'hud', keywords: ['hud', 'gameplay', 'heads-up', 'overlay', 'active game'] },
        { name: 'high-scores', keywords: ['high score', 'leaderboard', 'scoreboard', 'rankings'] },
        { name: 'settings', keywords: ['settings', 'options', 'config', 'preferences'] },
        { name: 'victory', keywords: ['victory', 'level complete', 'mission complete', 'win screen'] },
        { name: 'loading', keywords: ['loading', 'splash'] },
        { name: 'login', keywords: ['login', 'sign in', 'register', 'sign up', 'auth'] },
        { name: 'dashboard', keywords: ['dashboard', 'overview', 'summary'] },
        { name: 'profile', keywords: ['profile', 'account', 'user page'] },
        { name: 'list', keywords: ['list view', 'table view', 'browse', 'catalog'] },
        { name: 'detail', keywords: ['detail', 'single view', 'item page'] },
        { name: 'form', keywords: ['form', 'editor', 'create new', 'add new', 'edit'] },
      ];
      const detectCategory = (title) => {
        const t = title.toLowerCase();
        for (const cat of SCREEN_CATEGORIES) {
          if (cat.keywords.some(kw => t.includes(kw))) return cat.name;
        }
        return null;
      };
      const newCategory = detectCategory(screenTitle);
      const duplicate = existingScreens.find(s => {
        const sTitle = (s.title || '').toLowerCase();
        // Exact or substring match (original logic)
        if (sTitle === titleLower || sTitle.includes(titleLower) || titleLower.includes(sTitle)) return true;
        // Category-based: if both belong to same category, it is a duplicate
        if (newCategory) {
          const existingCat = detectCategory(s.title || '');
          if (existingCat === newCategory) return true;
        }
        return false;
      });

      if (duplicate) {
        const dupId = (duplicate.name || '').replace(/^projects\/\d+\/screens\//, '') || duplicate.id;
        process.stderr.write(`SKIP: Screen "${screenTitle}" already exists as "${duplicate.title}" (${dupId})\n`);
        console.log(JSON.stringify({ skipped: true, reason: 'duplicate', existingTitle: duplicate.title, existingId: dupId }, null, 2));
        return;
      }
    }

    // 2. Generate screen
    const args = { projectId, prompt, deviceType, modelId };
    const result = await callTool('generate_screen_from_text', args);
    const { screens, suggestions } = parseScreens(result);
// Save generated screens to local tracking file for dedup
// AND eagerly download HTML+screenshot (Stitch deletes them after ~hours)
    if (screens.length > 0) {
      const trackingFile = resolve(process.cwd(), '.stitch-screens.json');
      const stitchDir = resolve(process.cwd(), 'stitch');
      mkdirSync(stitchDir, { recursive: true });
      let tracked = [];
      try { tracked = JSON.parse(readFileSync(trackingFile, 'utf-8')); } catch {}
      for (const s of screens) {
        let localHtml = null, localScreenshot = null;
        // Eager download HTML
        if (s.htmlUrl) {
          try {
            const htmlPath = resolve(stitchDir, s.screenId + '.html');
            await downloadFile(s.htmlUrl, htmlPath);
            localHtml = htmlPath;
            process.stderr.write('Downloaded HTML: ' + s.screenId + '.html\n');
          } catch (e) { process.stderr.write('WARN: HTML download failed for ' + s.screenId + ': ' + e.message + '\n'); }
        }
        // Eager download screenshot
        if (s.screenshotUrl) {
          try {
            const pngPath = resolve(stitchDir, s.screenId + '.png');
            await downloadFile(s.screenshotUrl, pngPath);
            localScreenshot = pngPath;
            process.stderr.write('Downloaded screenshot: ' + s.screenId + '.png\n');
          } catch (e) { process.stderr.write('WARN: Screenshot download failed for ' + s.screenId + ': ' + e.message + '\n'); }
        }
        if (!tracked.some(t => t.screenId === s.screenId)) {
          tracked.push({ screenId: s.screenId, title: s.title || '', category: null, htmlUrl: s.htmlUrl || null, screenshotUrl: s.screenshotUrl || null, localHtml, localScreenshot });
        }
      }
      writeFileSync(trackingFile, JSON.stringify(tracked, null, 2));
    }

    console.log(JSON.stringify({ skipped: false, screens, suggestions }, null, 2));
  },

  // ── New commands (v1.5.28) ──────────────────────────────────────

  async 'download-screen'(projectId, screenId, outputPath) {
    if (!projectId || !screenId || !outputPath) throw new Error('Usage: download-screen <projectId> <screenId> <outputPath>');
    await initialize();
    const name = `projects/${projectId}/screens/${screenId}`;
    const result = await callTool('get_screen', { name, projectId, screenId });

    let htmlUrl = null;
    if (result && result.content) {
      for (const item of result.content) {
        if (item.type === 'text') {
          try {
            const parsed = JSON.parse(item.text);
            const screen = parsed.screen || parsed;
            htmlUrl = screen.htmlUrl || screen.htmlCode?.downloadUrl || screen.html_code?.download_url || null;
            if (htmlUrl) break;
          } catch { /* skip */ }
        }
      }
    }

    // Fallback: list-screens to find htmlUrl
    if (!htmlUrl) {
      const screens = parseScreenList(await callTool('list_screens', { projectId }));
      const target = screens.find(s => {
        const sid = (s.name || '').replace(/^projects\/\d+\/screens\//, '') || s.id || s.screenId;
        return sid === screenId;
      });
      htmlUrl = target?.htmlUrl || target?.htmlCode?.downloadUrl || target?.html_code?.download_url || null;
    }

    // Fallback: local tracking file
    if (!htmlUrl) {
      try {
        const trackingFile = resolve(process.cwd(), '.stitch-screens.json');
        const tracked = JSON.parse(readFileSync(trackingFile, 'utf-8'));
        const local = tracked.find(t => t.screenId === screenId);
        if (local?.localHtml) {
          // Already downloaded locally — just copy
          const { copyFileSync } = await import('node:fs');
          copyFileSync(local.localHtml, outputPath);
          console.log(JSON.stringify({ path: outputPath, size: readFileSync(outputPath).length, source: 'local-cache' }, null, 2));
          return;
        }
        htmlUrl = local?.htmlUrl || null;
      } catch { /* no tracking file */ }
    }

    if (!htmlUrl) throw new Error(`No HTML download URL found for screen ${screenId}`);
    const dlResult = await downloadFile(htmlUrl, outputPath);
    console.log(JSON.stringify(dlResult, null, 2));
  },

  async 'create-manifest'(projectId, outputDir, ...screenIdArgs) {
    if (!projectId || !outputDir) throw new Error('Usage: create-manifest <projectId> <outputDir> [screenId1,screenId2,...]');
    await initialize();
    const result = await callTool('list_screens', { projectId });
    let screens = parseScreenList(result);

    // Fallback 1: if list_screens returns empty, try get_project for screenInstances
    if (screens.length === 0) {
      try {
        const projResult = await callTool('get_project', { name: 'projects/' + projectId });
        if (projResult && projResult.structuredContent && projResult.structuredContent.screenInstances) {
          const instances = projResult.structuredContent.screenInstances;
          for (const inst of instances) {
            const sid = inst.id || (inst.sourceScreen || '').replace(/^projects\/\d+\/screens\//, '');
            if (sid) {
              try {
                const sr = await callTool('get_screen', { name: 'projects/' + projectId + '/screens/' + sid, projectId, screenId: sid });
                if (sr && sr.structuredContent) {
                  screens.push(sr.structuredContent);
                } else if (sr && sr.content) {
                  for (const item of sr.content) {
                    if (item.type === 'text') { try { screens.push(JSON.parse(item.text)); break; } catch {} }
                  }
                }
              } catch (e) { console.error('Warning: get_screen ' + sid + ' failed: ' + e.message); }
            }
          }
          if (screens.length > 0) console.error('Recovered ' + screens.length + ' screens via get_project fallback');
        }
      } catch (e) { console.error('Warning: get_project fallback failed: ' + e.message); }
    }

    // Fallback 2b: use local tracking file (most reliable — has eager-downloaded HTML paths)
    if (screens.length === 0) {
      const trackingFile = resolve(process.cwd(), '.stitch-screens.json');
      try {
        const tracked = JSON.parse(readFileSync(trackingFile, 'utf-8'));
        if (Array.isArray(tracked) && tracked.length > 0) {
          screens = tracked;
          process.stderr.write('Recovered ' + screens.length + ' screens from .stitch-screens.json fallback
');
        }
      } catch {}
    }

    // Fallback 3: if still empty, use provided screen IDs with get_screen
    if (screens.length === 0 && screenIdArgs.length > 0) {
      const ids = screenIdArgs.join(',').split(',').filter(Boolean);
      for (const sid of ids) {
        try {
          const name = `projects/${projectId}/screens/${sid}`;
          const sr = await callTool('get_screen', { name, projectId, screenId: sid });
          // Prefer structuredContent (cleaner), fall back to text content
          if (sr && sr.structuredContent && sr.structuredContent.name) {
            screens.push(sr.structuredContent);
          } else if (sr && sr.content) {
            for (const item of sr.content) {
              if (item.type === 'text') { try { screens.push(JSON.parse(item.text)); break; } catch {} }
            }
          }
        } catch (e) { console.error('Warning: get_screen ' + sid + ' failed: ' + e.message); }
      }
    }

    const manifest = screens.map(s => {
      const screenId = (s.name || '').replace(/^projects\/\d+\/screens\//, '') || s.id || s.screenId;
      const title = s.title || s.displayName || 'Untitled';
      const localHtml = s.localHtml || null;
      return {
        screenId,
        title,
        htmlFile: `${title.replace(/[^a-zA-Z0-9_-]/g, '-')}.html`,
        deviceType: s.deviceType || s.device_type || 'DESKTOP',
        htmlUrl: s.htmlUrl || s.htmlCode?.downloadUrl || s.html_code?.download_url || null,
        localHtml,
      };
    });

    mkdirSync(outputDir, { recursive: true });
    const manifestPath = resolve(outputDir, 'DESIGN_MANIFEST.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ path: manifestPath, screens: manifest.length }, null, 2));
  },

  async 'extract-tokens'(stitchDir, outputCssFile) {
    if (!stitchDir) throw new Error('Usage: extract-tokens <stitchDir> [outputCssFile]');
    const outFile = outputCssFile || resolve(stitchDir, 'design-tokens.css');
    const outJson = outFile.replace(/\.css$/, '.json');

    const htmlFiles = readdirSync(stitchDir)
      .filter(f => f.endsWith('.html'))
      .map(f => resolve(stitchDir, f));

    if (htmlFiles.length === 0) {
      console.log(JSON.stringify({ error: 'No HTML files found', dir: stitchDir }, null, 2));
      return;
    }

    // Parse tokens from all HTML files, merge (last-wins for dupes)
    const properties = new Map();
    const googleFonts = new Set();

    for (const file of htmlFiles) {
      const content = readFileSync(file, 'utf-8');

      // Source 1: :root {} blocks (backward compat)
      for (const match of content.matchAll(/:root\s*\{([^}]+)\}/gs)) {
        for (const line of match[1].split('\n')) {
          const propMatch = line.match(/^\s*(--[\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
          if (propMatch) {
            properties.set(propMatch[1], propMatch[2].replace(/;$/, '').trim());
          }
        }
      }

      // Source 2: <script id="tailwind-config"> blocks (Stitch's actual format)
      const twMatch = content.match(/<script\s+id=["']tailwind-config["'][^>]*>([\s\S]*?)<\/script>/i);
      if (twMatch) {
        try {
          // Extract the config object from "tailwind.config = { ... }"
          const configMatch = twMatch[1].match(/tailwind\.config\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
          if (configMatch) {
            // Parse JS object literal safely (handles unquoted keys, trailing commas)
            const configObj = safeParseJsObject(configMatch[1]);
            const extend = configObj?.theme?.extend || {};

            // Colors → --color-{key}: {value}
            if (extend.colors && typeof extend.colors === 'object') {
              for (const [key, value] of Object.entries(extend.colors)) {
                if (typeof value === 'string') {
                  properties.set(`--color-${key}`, value);
                } else if (typeof value === 'object' && value !== null) {
                  for (const [shade, val] of Object.entries(value)) {
                    if (typeof val === 'string') {
                      properties.set(`--color-${key}-${shade}`, val);
                    }
                  }
                }
              }
            }

            // Font families → --font-{key}: {value}
            if (extend.fontFamily && typeof extend.fontFamily === 'object') {
              for (const [key, value] of Object.entries(extend.fontFamily)) {
                const fontValue = Array.isArray(value) ? value.join(', ') : String(value);
                properties.set(`--font-${key}`, fontValue);
              }
            }

            // Border radius → --radius-{key}: {value}
            if (extend.borderRadius && typeof extend.borderRadius === 'object') {
              for (const [key, value] of Object.entries(extend.borderRadius)) {
                if (typeof value === 'string') {
                  properties.set(`--radius-${key}`, value);
                }
              }
            }

            // Spacing → --spacing-{key}: {value}
            if (extend.spacing && typeof extend.spacing === 'object') {
              for (const [key, value] of Object.entries(extend.spacing)) {
                if (typeof value === 'string') {
                  properties.set(`--spacing-${key}`, value);
                }
              }
            }
          }
        } catch (e) {
          process.stderr.write(`WARN: Could not parse tailwind config in ${file}: ${e.message}\n`);
        }
      }

      // Source 3: Google Fonts <link> tags → --font-google-{family}: {family}
      for (const fontMatch of content.matchAll(/fonts\.googleapis\.com\/css2\?family=([^&"]+)/g)) {
        const family = decodeURIComponent(fontMatch[1].replace(/\+/g, ' ').replace(/:wght.*/, ''));
        if (!family.includes('Material') && !family.includes('Icon')) {
          googleFonts.add(family);
        }
      }
    }

    // Add Google Fonts as tokens
    let fontIndex = 0;
    for (const family of googleFonts) {
      properties.set(`--font-google-${fontIndex}`, family);
      fontIndex++;
    }

    // Build output
    if (properties.size === 0) {
      // Fallback: write a placeholder so downstream steps know design-tokens.css exists
      const fallbackCss = `/* design-tokens.css — auto-generated */\n/* WARNING: No design tokens could be extracted from ${htmlFiles.length} Stitch HTML file(s). */\n/* Implement using colors/fonts visible in stitch/*.html directly. */\n:root {}\n`;
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, fallbackCss);
      console.log(JSON.stringify({ path: outFile, properties: 0, sources: htmlFiles.length, warning: 'No tokens extracted — fallback written' }, null, 2));
      return;
    }

    let css = '/* design-tokens.css — auto-generated from Stitch HTML */\n:root {\n';
    const jsonTokens = {};
    for (const [prop, value] of properties) {
      css += `  ${prop}: ${value};\n`;
      jsonTokens[prop] = value;
    }
    css += '}\n';

    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, css);
    writeFileSync(outJson, JSON.stringify(jsonTokens, null, 2));
    console.log(JSON.stringify({ path: outFile, jsonPath: outJson, properties: properties.size, sources: htmlFiles.length }, null, 2));
  },

  async download(url, outputFile) {
    if (!url || !outputFile) throw new Error('Usage: download <url> <outputFile>');
    const result = await downloadFile(url, outputFile);
    console.log(JSON.stringify(result, null, 2));
  },
};

// Main
const [cmd, ...args] = process.argv.slice(2);

if (!cmd || !commands[cmd]) {
  console.error(`Usage: node stitch-api.mjs <command> [args...]

Commands:
  list-projects                                                          List all Stitch projects
  find-project "Name"                                                    Find project by name
  create-project "Title"                                                 Create a Stitch project
  ensure-project "Name" /path/to/repo                                    Find-or-create + persist .stitch
  generate-screen <projectId> "<prompt>" [device] [model]                Generate a screen
  generate-screen-safe <projectId> "<prompt>" "<title>" [device] [model] Generate with dedup check
  list-screens <projectId>                                               List screens in project
  get-screen <projectId> <screenId>                                      Get screen details
  download-screen <projectId> <screenId> <outputPath>                    Download screen HTML
  create-manifest <projectId> <outputDir>                                Create DESIGN_MANIFEST.json
  extract-tokens <stitchDir> [outputCssFile]                             Merge CSS tokens from all HTMLs
  download <url> <outputFile>                                            Download file from URL`);
  process.exit(1);
}

try {
  await commands[cmd](...args);
} catch (err) {
  console.error(JSON.stringify({ error: err.message }, null, 2));
  process.exit(1);
}
