#!/usr/bin/env node

/**
 * stitch-api.mjs -- CLI wrapper for Google Stitch MCP (JSON-RPC over HTTPS)
 *
 * Usage:
 *   node stitch-api.mjs create-project "Project Name"
 *   node stitch-api.mjs ensure-project "Project Name" /path/to/repo    (find-or-create + persist .stitch)
 *   node stitch-api.mjs generate-screen <projectId> "<prompt>" [DESKTOP|MOBILE|TABLET] [GEMINI_3_1_PRO|GEMINI_3_FLASH]
 *   node stitch-api.mjs generate-screen-safe <projectId> "<prompt>" "<title>" [device] [model]  (dedup check)
 *   node stitch-api.mjs get-design-md <projectId> [repoPath]                                    (extract DESIGN.md)
 *   node stitch-api.mjs list-screens <projectId>
 *   node stitch-api.mjs get-screen <projectId> <screenId>
 *   node stitch-api.mjs download-screen <projectId> <screenId> <outputPath>
 *   node stitch-api.mjs create-manifest <projectId> <outputDir>
 *   node stitch-api.mjs extract-tokens <stitchDir> [outputCssFile]
 *   node stitch-api.mjs download <url> <outputFile>
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function cssStringValue(value) {
  return `"${String(value || "")
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
    .trim()}"`;
}

function sanitizeCssCustomPropertyValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^["'][^"']+["']$/.test(text)) return text;
  if (/[;{}<>]/.test(text)) return cssStringValue(text);
  if (/^[A-Za-z][A-Za-z0-9 -]*$/.test(text) && /\s/.test(text)) return cssStringValue(text);
  return text;
}

function normalizeGoogleFontFamily(raw) {
  const decoded = decodeURIComponent(String(raw || '').replace(/\+/g, ' '));
  return decoded.split(':')[0].trim();
}

function screenIdOf(screen) {
  return String(
    (screen?.name || '').replace(/^projects\/\d+\/screens\//, '') ||
    (screen?.sourceScreen || '').replace(/^projects\/\d+\/screens\//, '') ||
    screen?.id ||
    screen?.screenId ||
    screen?.screen_id ||
    ''
  ).trim();
}

function titleOf(screen) {
  return String(screen?.title || screen?.displayName || screen?.name || screen?.screenId || 'Untitled').trim() || 'Untitled';
}

function htmlUrlOf(screen) {
  return screen?.htmlUrl || screen?.htmlCode?.downloadUrl || screen?.html_code?.download_url || null;
}

function screenshotUrlOf(screen) {
  return screen?.screenshotUrl || screen?.screenshot?.downloadUrl || screen?.screenshot?.download_url || null;
}

function jsonPayloadsFromToolText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const candidates = [raw];
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());
  const objectStart = raw.indexOf('{');
  const objectEnd = raw.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) candidates.push(raw.slice(objectStart, objectEnd + 1));
  const arrayStart = raw.indexOf('[');
  const arrayEnd = raw.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) candidates.push(raw.slice(arrayStart, arrayEnd + 1));

  const parsed = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = candidate.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    try { parsed.push(JSON.parse(key)); } catch {}
  }
  return parsed;
}

function screenSourceArrays(value) {
  const arrays = [];
  const seen = new Set();
  const visit = (node, depth = 0) => {
    if (!node || depth > 8) return;
    if (typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }

    const directArrays = [
      node.screens,
      node.screenInstances,
      node.screen_instances,
      node.structuredContent?.screens,
      node.structuredContent?.screenInstances,
      node.structured_content?.screens,
      node.structured_content?.screen_instances,
      node.design?.screens,
    ];
    for (const maybeArray of directArrays) {
      if (Array.isArray(maybeArray)) arrays.push(maybeArray);
    }

    for (const comp of node.outputComponents || node.output_components || []) {
      if (Array.isArray(comp?.design?.screens)) arrays.push(comp.design.screens);
      visit(comp, depth + 1);
    }

    for (const child of Object.values(node)) visit(child, depth + 1);
  };
  visit(value);
  return arrays;
}

function normalizeScreenEntry(screen) {
  const screenId = screenIdOf(screen);
  if (!screenId) return null;
  return {
    ...screen,
    screenId,
    title: titleOf(screen),
    htmlUrl: htmlUrlOf(screen),
    screenshotUrl: screenshotUrlOf(screen),
    width: screen?.width,
    height: screen?.height,
  };
}

function collectScreensFromResult(result) {
  const byId = new Map();
  const add = (screen) => {
    const normalized = normalizeScreenEntry(screen);
    if (!normalized?.screenId) return;
    const existing = byId.get(normalized.screenId);
    byId.set(normalized.screenId, existing ? { ...normalized, ...existing } : normalized);
  };

  for (const arr of screenSourceArrays(result)) {
    for (const screen of arr) add(screen);
  }

  for (const item of result?.content || []) {
    if (item?.type !== 'text') continue;
    for (const parsed of jsonPayloadsFromToolText(item.text)) {
      if (Array.isArray(parsed)) {
        for (const screen of parsed) add(screen);
      }
      for (const arr of screenSourceArrays(parsed)) {
        for (const screen of arr) add(screen);
      }
      if (parsed?.screen) add(parsed.screen);
    }
  }

  return [...byId.values()];
}

function redactDiagnosticText(text) {
  return String(text || "")
    .replace(/AQ\.[A-Za-z0-9_-]+/g, "AQ.[REDACTED]")
    .replace(/(api[_-]?key|token|authorization|bearer)\s*[:=]\s*["']?[^"'\s,}]+/gi, "$1=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim();
}

function toolResultTextSample(result, maxLength = 700) {
  return redactDiagnosticText(toolResultText(result)).slice(0, maxLength);
}

function describeToolResultShape(result) {
  const content = Array.isArray(result?.content) ? result.content : [];
  const textKeys = [];
  for (const item of content.slice(0, 3)) {
    if (item?.type !== 'text') continue;
    const parsed = jsonPayloadsFromToolText(item.text)[0];
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) textKeys.push(Object.keys(parsed).slice(0, 12));
  }
  const textSample = toolResultTextSample(result);
  return {
    isError: Boolean(result?.isError),
    topLevelKeys: result && typeof result === 'object' ? Object.keys(result).slice(0, 16) : [],
    structuredContentKeys: result?.structuredContent && typeof result.structuredContent === 'object'
      ? Object.keys(result.structuredContent).slice(0, 16)
      : [],
    contentTypes: content.map((item) => item?.type || typeof item).slice(0, 12),
    textKeys,
    textSample: textSample || undefined,
  };
}

function toolResultText(result) {
  const content = Array.isArray(result?.content) ? result.content : [];
  return content
    .filter((item) => item?.type === 'text')
    .map((item) => String(item.text || '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function toolResultError(result) {
  const text = toolResultText(result);
  if (result?.isError) return text || 'Stitch MCP tool returned isError=true';
  for (const parsed of jsonPayloadsFromToolText(text)) {
    if (parsed?.error) return typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
    if (parsed?.isError) return parsed?.message || parsed?.detail || text || 'Stitch MCP tool returned an error payload';
  }
  return null;
}

function assertToolResultOk(result, toolName) {
  const error = toolResultError(result);
  if (!error) return;
  const diagnostic = describeToolResultShape(result);
  throw new Error(`${toolName} failed: ${String(error).replace(/\s+/g, ' ').slice(0, 900)} shape=${JSON.stringify(diagnostic)}`);
}

function readTrackedScreens(projectId) {
  try {
    const tracked = JSON.parse(readFileSync(resolve(process.cwd(), '.stitch-screens-' + projectId + '.json'), 'utf-8'));
    return Array.isArray(tracked) ? tracked : [];
  } catch {
    return [];
  }
}

function mergeTrackedScreens(projectId, screens) {
  const byId = new Map();
  const add = (screen) => {
    const screenId = screenIdOf(screen);
    if (!screenId) return;
    const normalized = {
      ...screen,
      screenId,
      title: titleOf(screen),
      htmlUrl: htmlUrlOf(screen),
      screenshotUrl: screenshotUrlOf(screen),
    };
    const existing = byId.get(screenId);
    if (!existing) {
      byId.set(screenId, normalized);
      return;
    }
    byId.set(screenId, {
      ...existing,
      ...normalized,
      title: existing.title || normalized.title,
      htmlUrl: existing.htmlUrl || normalized.htmlUrl,
      screenshotUrl: existing.screenshotUrl || normalized.screenshotUrl,
      localHtml: existing.localHtml || normalized.localHtml || null,
      localScreenshot: existing.localScreenshot || normalized.localScreenshot || null,
    });
  };
  for (const screen of Array.isArray(screens) ? screens : []) add(screen);
  for (const screen of readTrackedScreens(projectId)) add(screen);
  return [...byId.values()];
}

function readEnvKey(envPath, key) {
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim().replace(/^export\s+/, '');
      if (trimmed.startsWith(`${key}=`)) {
        return trimmed.slice(`${key}=`.length).replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // fall through
  }
  return '';
}

function readEnvKeys(envPath) {
  try {
    const content = readFileSync(envPath, 'utf-8');
    const values = [];
    for (const line of content.split('\n')) {
      const trimmed = line.trim().replace(/^export\s+/, '');
      if (trimmed.startsWith('STITCH_API_KEYS=')) {
        values.push(...splitApiKeyList(trimmed.slice('STITCH_API_KEYS='.length).replace(/^["']|["']$/g, '')));
      }
      const indexed = trimmed.match(/^STITCH_API_KEY_(\d+)=(.+)$/);
      if (indexed) values.push(indexed[2].replace(/^["']|["']$/g, ''));
    }
    return values;
  } catch {
    return [];
  }
}

function splitApiKeyList(raw) {
  return String(raw || '')
    .split(/[\n,; ]+/)
    .map((value) => value.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function uniqueApiKeys(values) {
  const seen = new Set();
  const keys = [];
  for (const value of values) {
    const key = String(value || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

function envFileCandidates() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const configured = process.env.SETFARM_ENV_DIR
    ? [resolve(process.env.SETFARM_ENV_DIR, '.env.local'), resolve(process.env.SETFARM_ENV_DIR, '.env')]
    : [];
  const homeCandidates = home
    ? [
        resolve(home, '.openclaw', 'setfarm', '.env.local'),
        resolve(home, '.openclaw', 'setfarm', '.env'),
        resolve(home, '.openclaw', '.env.local'),
        resolve(home, '.openclaw', '.env'),
      ]
    : [];
  return [
    ...configured,
    resolve(__dirname, '.env.local'),
    resolve(__dirname, '.env'),
    resolve(__dirname, '..', '.env.local'),
    resolve(__dirname, '..', '.env'),
    ...homeCandidates,
  ];
}

function processApiKeys() {
  return uniqueApiKeys([
    ...splitApiKeyList(process.env.STITCH_API_KEYS),
    ...Object.keys(process.env)
      .filter((key) => /^STITCH_API_KEY_\d+$/.test(key))
      .sort((a, b) => Number(a.replace(/\D+/g, '')) - Number(b.replace(/\D+/g, '')))
      .map((key) => process.env[key]),
    process.env.STITCH_API_KEY,
  ]);
}

// Load API keys from process env or Setfarm runtime env files.
// Process-level keys are authoritative. Mixing them with fallback env-file keys
// can create a project under one key and then rotate into another account that
// cannot see the project.
function loadApiKeys() {
  const fromProcess = processApiKeys();
  if (fromProcess.length > 0) return fromProcess;
  const keys = [];
  for (const envPath of envFileCandidates()) {
    keys.push(...readEnvKeys(envPath));
    keys.push(readEnvKey(envPath, 'STITCH_API_KEY'));
  }
  const unique = uniqueApiKeys(keys);
  if (unique.length > 0) return unique;
  throw new Error('STITCH_API_KEY not found in .env or environment');
}

const MCP_ENDPOINT = 'https://stitch.googleapis.com/mcp';
let requestId = 0;
let apiKeys = null;
let apiKeyIndex = 0;

function getApiKey() {
  if (!apiKeys) apiKeys = loadApiKeys();
  return apiKeys[apiKeyIndex];
}

function keyCount() {
  if (!apiKeys) apiKeys = loadApiKeys();
  return apiKeys.length;
}

function rotateKey(reason) {
  if (keyCount() <= 1 || apiKeyIndex >= apiKeys.length - 1) return false;
  apiKeyIndex += 1;
  process.stderr.write(`Stitch API key fallback ${apiKeyIndex + 1}/${apiKeys.length}: ${redactDiagnosticText(reason).slice(0, 220)}\n`);
  return true;
}

function isTransientStitchGenerateFailure(text) {
  const normalized = redactDiagnosticText(text).toLowerCase();
  return (
    shouldRotateForStitchFailure(text) ||
    /\bservice is currently unavailable\b/.test(normalized) ||
    /\bservice unavailable\b/.test(normalized) ||
    /\btemporarily unavailable\b/.test(normalized) ||
    /\bdeadline exceeded\b/.test(normalized) ||
    /\b503\b/.test(normalized)
  );
}

function shouldRotateForStitchFailure(text) {
  const normalized = redactDiagnosticText(text).toLowerCase();
  return (
    /\bresource exhausted\b/.test(normalized) ||
    /\brate limit(?:ed)?\b/.test(normalized) ||
    /\bquota\b/.test(normalized) ||
    /\bpermission denied\b/.test(normalized) ||
    /\bapi key not valid\b/.test(normalized) ||
    /\bapi key expired\b/.test(normalized) ||
    /\bunauthorized\b/.test(normalized) ||
    /\bforbidden\b/.test(normalized) ||
    /\b429\b/.test(normalized)
  );
}

function intEnv(name, fallback, min, max) {
  const raw = Number(process.env[name] || fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(raw)));
}

function rpcTimeoutMs() {
  const raw = Number(process.env.STITCH_RPC_TIMEOUT_MS || process.env.STITCH_TIMEOUT_MS || 600_000);
  if (!Number.isFinite(raw) || raw < 30_000) return 600_000;
  return Math.min(raw, 900_000);
}

// JSON-RPC call helper
async function rpc(method, params = {}) {
  requestId++;
  const body = {
    jsonrpc: '2.0',
    id: requestId,
    method,
    params,
  };

  for (;;) {
    const res = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': getApiKey(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(rpcTimeoutMs()),
    });

    if (!res.ok) {
      const text = await res.text();
      const message = `HTTP ${res.status}: ${text}`;
      if (shouldRotateForStitchFailure(message) && rotateKey(message)) continue;
      throw new Error(message);
    }

    const json = await res.json();
    if (json.error) {
      const message = `RPC error ${json.error.code}: ${json.error.message}`;
      if (shouldRotateForStitchFailure(message) && rotateKey(message)) continue;
      throw new Error(message);
    }
    return json.result;
  }
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
  for (;;) {
    const result = await rpc('tools/call', { name, arguments: args });
    const error = toolResultError(result);
    if (error && shouldRotateForStitchFailure(error) && rotateKey(`${name} failed: ${error}`)) {
      await initialize();
      continue;
    }
    return result;
  }
}

async function generateScreenFromText(args) {
  for (;;) {
    const result = await callTool('generate_screen_from_text', args);
    assertToolResultOk(result, 'generate_screen_from_text');
    const parsed = parseScreens(result);
    if (parsed.screens.length === 0) {
      const diagnostic = describeToolResultShape(result);
      const reason = diagnostic?.textSample || JSON.stringify(diagnostic) || 'no screens returned';
      const retryableEmptyResponse = shouldRotateForStitchFailure(reason) || /no screens returned|screens\.length === 0|generated 0/i.test(reason);
      if (retryableEmptyResponse && rotateKey(reason)) {
        await initialize();
        continue;
      }
    }
    return { result, ...parsed };
  }
}

// Download a file from a signed URL (User-Agent + 429 retry + size validation)
async function downloadFile(url, outputPath, attempt = 1) {
  const headers = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36' };
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000), headers });
  if (res.status === 429 && attempt < 5) { const delay = 10000 * Math.pow(2, attempt - 1) + Math.random() * 2000; process.stderr.write(`429 rate limited -- retrying in ${Math.round(delay/1000)}s (attempt ${attempt}/5)\n`); await new Promise(r => setTimeout(r, delay)); return downloadFile(url, outputPath, attempt + 1); }
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buffer);
  if (buffer.length < 500 && outputPath.endsWith('.html')) throw new Error('Empty HTML (' + buffer.length + ' bytes) - design not generated');
  return { path: outputPath, size: buffer.length };
}

// Parse screens from generate response
function parseScreens(result) {
  const suggestions = [];
  const screens = collectScreensFromResult(result);
  if (!result || !result.content) return { screens, suggestions };

  for (const item of result.content) {
    if (item.type === 'text') {
      for (const parsed of jsonPayloadsFromToolText(item.text)) {
        // Check for outputComponents structure (camelCase from API)
        const components = parsed.outputComponents || parsed.output_components;
        if (components) {
          for (const comp of components) {
            if (comp.suggestions) {
              suggestions.push(...comp.suggestions);
            }
          }
        }
      }
    }
  }

  return { screens, suggestions };
}

// Parse screen list from list_screens result (shared helper)
function parseScreenList(result) {
  return collectScreensFromResult(result);
}

// Safe JS object literal parser -- converts JS object syntax to JSON then parses.
// Handles: unquoted keys, single-quoted strings, trailing commas, template literals.
// Does NOT execute arbitrary code (unlike new Function()).
function safeParseJsObject(src) {
  let s = src.trim();
  // Remove template literals (backtick strings) -- replace with empty string
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

  async 'generate-screen'(projectId, prompt, deviceType = 'DESKTOP', modelId = 'GEMINI_3_1_PRO') {
    if (!projectId || !prompt) throw new Error('Usage: generate-screen <projectId> "<prompt>" [DESKTOP|MOBILE|TABLET] [GEMINI_3_1_PRO|GEMINI_3_FLASH]');
    await initialize();

    const args = {
      projectId,
      prompt,
      deviceType,
      modelId,
    };

    const { screens, suggestions } = await generateScreenFromText(args);
// Save generated screens to local tracking file for dedup
    if (screens.length > 0) {
      // Write tracking to project-scoped file
      const trackingFile = resolve(process.cwd(), '.stitch-screens-' + projectId + '.json');
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
      const trackingFile = resolve(process.cwd(), '.stitch-screens-' + projectId + '.json');
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
        try { trackedCount = JSON.parse(readFileSync(resolve(repoPath, '.stitch-screens-' + existing.projectId + '.json'), 'utf-8')).length; } catch {}
        if (htmlCount > 0 || trackedCount > 0) {
          console.log(JSON.stringify({ projectId: existing.projectId, source: 'stitch-file' }, null, 2));
          return;
        }
        process.stderr.write('Existing project ' + existing.projectId + ' has no screens -- creating new\n');
      }
    } catch { /* no .stitch file or invalid */ }

    await initialize();

    // 2. Find existing project by name unless recovery explicitly requires
    // a fresh Stitch project after an empty or errored generation.
    const forceNewProject = process.env.STITCH_FORCE_NEW_PROJECT === '1';
    const listResult = forceNewProject ? null : await callTool('list_projects', {});
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

  async 'generate-screen-safe'(projectId, prompt, screenTitle, deviceType = 'DESKTOP', modelId = 'GEMINI_3_1_PRO') {
    if (!projectId || !prompt) throw new Error('Usage: generate-screen-safe <projectId> "<prompt>" "<screenTitle>" [DESKTOP|MOBILE|TABLET] [model]');

    // E2BIG fix: if prompt starts with @, read from file
    if (prompt.startsWith('@')) {
      const fs = await import('fs');
      const filePath = prompt.slice(1);
      prompt = fs.readFileSync(filePath, 'utf8');
    }

    await initialize();

    // 1. Check for duplicate screens by title
    if (screenTitle) {
      // list_screens API returns empty for generated screens -- use local tracking instead
      let existingScreens = [];
      const trackingFile = resolve(process.cwd(), '.stitch-screens-' + projectId + '.json');
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
        // Fuzzy prefix match: "Home Page" matches "Home Page Modern Dark", "Home Page V2", etc.
        const normalize = (t) => t.replace(/[_\-\s]+/g, ' ').replace(/(v\d+|modern|dark|light|pwa|variant|\d+)$/gi, '').trim();
        const normNew = normalize(titleLower);
        const normExisting = normalize(sTitle);
        if (normNew && normExisting && (normNew === normExisting || normNew.startsWith(normExisting) || normExisting.startsWith(normNew))) return true;
        // Word overlap: if 2+ significant words match, likely duplicate
        const wordsNew = normNew.split(' ').filter(w => w.length > 2);
        const wordsExisting = normExisting.split(' ').filter(w => w.length > 2);
        const overlap = wordsNew.filter(w => wordsExisting.includes(w)).length;
        if (wordsNew.length > 0 && wordsExisting.length > 0 && overlap >= Math.min(2, Math.min(wordsNew.length, wordsExisting.length))) return true;
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
    const { screens, suggestions } = await generateScreenFromText(args);
// Save generated screens to local tracking file for dedup
// AND eagerly download HTML+screenshot (Stitch deletes them after ~hours)
    if (screens.length > 0) {
      const trackingFile = resolve(process.cwd(), '.stitch-screens-' + projectId + '.json');
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

      // Extract DESIGN.md from project if it doesn't exist yet
      const designMdPath = resolve(process.cwd(), 'DESIGN.md');
      if (!existsSync(designMdPath)) {
        try {
          const projResult = await callTool('get_project', { name: 'projects/' + projectId });
          let designMd = null;
          if (projResult && projResult.content) {
            for (const item of projResult.content) {
              if (item.type === 'text') {
                try {
                  const parsed = JSON.parse(item.text);
                  designMd = parsed.designTheme?.designMd
                    || parsed.theme?.designMd
                    || parsed.designMd
                    || parsed.design_theme?.design_md
                    || parsed.designSystem?.designMd
                    || null;
                  if (designMd) break;
                } catch { /* skip */ }
              }
            }
          }
          if (designMd) {
            writeFileSync(designMdPath, designMd);
            process.stderr.write('Saved DESIGN.md (' + designMd.length + ' chars)\n');
          }
        } catch (e) {
          process.stderr.write('WARN: Could not extract DESIGN.md: ' + e.message + '\n');
        }
      }
    }

    console.log(JSON.stringify({ skipped: false, screens, suggestions }, null, 2));
  },

  // ---- New commands (v1.5.28) ----------------------------------------------------------------------------


  async 'get-design-md'(projectId, repoPath) {
    if (!projectId) throw new Error('Usage: get-design-md <projectId> [repoPath]');
    await initialize();
    const result = await callTool('get_project', { name: 'projects/' + projectId });

    let designMd = null;
    let designTokens = null;
    let styleGuidelines = null;

    if (result && result.content) {
      for (const item of result.content) {
        if (item.type === 'text') {
          try {
            const parsed = JSON.parse(item.text);
            // Try multiple paths for designMd
            designMd = parsed.designTheme?.designMd
              || parsed.theme?.designMd
              || parsed.designMd
              || parsed.design_theme?.design_md
              || parsed.designSystem?.designMd
              || null;
            // Extract design tokens and style guidelines
            const ds = parsed.designTheme?.designSystem
              || parsed.theme?.designSystem
              || parsed.designSystem
              || parsed.design_theme?.design_system
              || {};
            designTokens = ds.designTokens || ds.design_tokens || null;
            styleGuidelines = ds.styleGuidelines || ds.style_guidelines || null;
            if (designMd) break;
          } catch {
            // skip unparseable
          }
        }
      }
    }

    // Write DESIGN.md if repoPath provided and designMd found
    if (designMd && repoPath) {
      const designMdPath = resolve(repoPath, 'DESIGN.md');
      mkdirSync(dirname(designMdPath), { recursive: true });
      writeFileSync(designMdPath, designMd);
      process.stderr.write('Saved DESIGN.md to ' + designMdPath + ' (' + designMd.length + ' chars)\n');
    }

    console.log(JSON.stringify({ designMd: designMd || '', designTokens: designTokens || '', styleGuidelines: styleGuidelines || '' }, null, 2));
  },

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
        const trackingFile = resolve(process.cwd(), '.stitch-screens-' + projectId + '.json');
        const tracked = JSON.parse(readFileSync(trackingFile, 'utf-8'));
        const local = tracked.find(t => t.screenId === screenId);
        if (local?.localHtml) {
          // Already downloaded locally -- just copy
          copyFileSync(local.localHtml, outputPath);
          console.log(JSON.stringify({ path: outputPath, size: readFileSync(outputPath).length, source: 'local-cache' }, null, 2));
          return;
        }
        htmlUrl = local?.htmlUrl || null;
      } catch { /* no tracking file */ }
    }

    if (!htmlUrl) throw new Error(`No HTML download URL found for screen ${screenId}`);
    const dlResult = await downloadFile(htmlUrl, outputPath);

    // Also download screenshot PNG if available
    let screenshotUrl = null;
    if (result && result.content) {
      for (const item of result.content) {
        if (item.type === 'text') {
          try {
            const parsed = JSON.parse(item.text);
            const screen = parsed.screen || parsed;
            screenshotUrl = screen.screenshotUrl || screen.screenshot?.downloadUrl || screen.screenshot?.download_url || null;
            if (screenshotUrl) break;
          } catch { /* skip */ }
        }
      }
    }
    if (screenshotUrl) {
      const pngPath = outputPath.replace(/\.html$/, '.png');
      try {
        await downloadFile(screenshotUrl, pngPath);
        process.stderr.write('Downloaded screenshot: ' + pngPath + '\n');
      } catch (e) { process.stderr.write('Screenshot download failed: ' + e.message + '\n'); }
    }

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

    // Fallback 2b: use local tracking file (most reliable -- has eager-downloaded HTML paths)
    const beforeTrackingMerge = screens.length;
    screens = mergeTrackedScreens(projectId, screens);
    if (screens.length > beforeTrackingMerge) {
      process.stderr.write('Merged ' + (screens.length - beforeTrackingMerge) + ' tracked screen(s) into manifest source\n');
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
    screens = mergeTrackedScreens(projectId, screens);

    const manifest = screens.map(s => {
      const screenId = screenIdOf(s);
      const title = titleOf(s);
      const localHtml = s.localHtml || null;
      return {
        screenId,
        title,
        htmlFile: `${screenId}.html`,
        deviceType: s.deviceType || s.device_type || 'DESKTOP',
        htmlUrl: htmlUrlOf(s),
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

            // Colors -> --color-{key}: {value}
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

            // Font families -> --font-{key}: {value}
            if (extend.fontFamily && typeof extend.fontFamily === 'object') {
              for (const [key, value] of Object.entries(extend.fontFamily)) {
                const fontValue = Array.isArray(value) ? value.join(', ') : String(value);
                properties.set(`--font-${key}`, fontValue);
              }
            }

            // Border radius -> --radius-{key}: {value}
            if (extend.borderRadius && typeof extend.borderRadius === 'object') {
              for (const [key, value] of Object.entries(extend.borderRadius)) {
                if (typeof value === 'string') {
                  properties.set(`--radius-${key}`, value);
                }
              }
            }

            // Spacing -> --spacing-{key}: {value}
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

      // Source 3: Google Fonts <link> tags -> --font-google-{family}: {family}
      for (const fontMatch of content.matchAll(/fonts\.googleapis\.com\/css2\?family=([^&"]+)/g)) {
        const family = normalizeGoogleFontFamily(fontMatch[1]);
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
      const fallbackCss = `/* design-tokens.css -- auto-generated */\n/* WARNING: No design tokens could be extracted from ${htmlFiles.length} Stitch HTML file(s). */\n/* Implement using colors/fonts visible in stitch/*.html directly. */\n:root {}\n`;
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, fallbackCss);
      console.log(JSON.stringify({ path: outFile, properties: 0, sources: htmlFiles.length, warning: 'No tokens extracted -- fallback written' }, null, 2));
      return;
    }

    let css = '/* design-tokens.css -- auto-generated from Stitch HTML */\n:root {\n';
    const jsonTokens = {};
    for (const [prop, value] of properties) {
      const safeValue = sanitizeCssCustomPropertyValue(value);
      if (!safeValue) continue;
      css += `  ${prop}: ${safeValue};\n`;
      jsonTokens[prop] = safeValue;
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

  'populate-cache': async function populateCache(sourceDir, destDir) {
    if (!sourceDir || !destDir) throw new Error('Usage: populate-cache <sourceDir> <destDir>');
    const { join: pathJoin } = await import('node:path');
    mkdirSync(destDir, { recursive: true });
    let copied = 0;

    // Copy all existing HTML/PNG files
    try {
      const files = readdirSync(sourceDir);
      for (const file of files) {
        if (file.endsWith('.png') || file.endsWith('.html')) {
          copyFileSync(pathJoin(sourceDir, file), pathJoin(destDir, file));
          copied++;
        }
      }
    } catch (e) {
      process.stderr.write('WARN: populate-cache copy error: ' + e.message + '\n');
    }

    // v1.5.53: Use DESIGN_MANIFEST.json to create screenId-based symlinks/copies
    // MC backend looks for <screenId>.html and <screenId>.png
    const manifestPath = pathJoin(sourceDir, 'DESIGN_MANIFEST.json');
    let manifest = [];
    try { manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')); } catch { /* no manifest */ }

    for (const screen of manifest) {
      if (!screen.screenId || !screen.htmlFile) continue;
      const srcHtml = pathJoin(sourceDir, screen.htmlFile);
      const dstHtml = pathJoin(destDir, screen.screenId + '.html');
      // Copy HTML with screenId name (MC expects this)
      if (existsSync(srcHtml) && !existsSync(dstHtml)) {
        try { copyFileSync(srcHtml, dstHtml); copied++; } catch {}
      }
      // Also copy original name for "View HTML" button
      const dstOriginal = pathJoin(destDir, screen.htmlFile);
      if (existsSync(srcHtml) && !existsSync(dstOriginal)) {
        try { copyFileSync(srcHtml, dstOriginal); copied++; } catch {}
      }
      // Download screenshot via get-screen API if PNG doesn't exist
      const dstPng = pathJoin(destDir, screen.screenId + '.png');
      if (!existsSync(dstPng)) {
        try {
          const { execFileSync } = await import('node:child_process');
          const gsOut = execFileSync('node', [process.argv[1], 'get-screen', destDir.split('/').pop(), screen.screenId], { timeout: 30000, stdio: 'pipe' }).toString().trim();
          const gsData = JSON.parse(gsOut);
          const screenshotUrl = gsData.screenshotUrl || gsData.screenshot?.downloadUrl || gsData.screenshot?.download_url || null;
          if (screenshotUrl) {
            execFileSync('node', [process.argv[1], 'download', screenshotUrl, dstPng], { timeout: 30000, stdio: 'pipe' });
            copied++;
          }
        } catch (e) {
          process.stderr.write('WARN: screenshot download failed for ' + screen.screenId + ': ' + e.message + '\n');
        }
      }
    }

    console.log(JSON.stringify({ success: true, copied }, null, 2));
  },
  /**
   * generate-all-screens: Generate ALL screens in a SINGLE Stitch API call
   * Usage: node stitch-api.mjs generate-all-screens <projectId> <promptFile> [device] [model]
   * promptFile: text file with full multi-screen prompt
   * Key insight: Stitch can generate multiple screens from one prompt (e.g. "Generate 8 screens: 1)... 2)... 3)...")
   */

  'download-all': async function downloadAll(projectId, outputDir) {
    if (!projectId || !outputDir) throw new Error('Usage: download-all <projectId> <outputDir>');
    const { mkdirSync, existsSync } = await import('fs');
    const { join } = await import('path');
    mkdirSync(outputDir, { recursive: true });
    await initialize();
    process.stderr.write('Listing screens for project ' + projectId + '...\n');
    // Use parseScreenList (same parser as list-screens command) + map to download format
    let screenList = [];
    try {
      const r = await callTool('list_screens', { projectId });
      const rawScreens = parseScreenList(r);
      screenList = rawScreens.map(s => ({
        screenId: screenIdOf(s),
        title: titleOf(s),
        htmlUrl: htmlUrlOf(s),
        screenshotUrl: screenshotUrlOf(s),
      }));
    } catch {}
    const initialCount = screenList.length;
    screenList = mergeTrackedScreens(projectId, screenList);
    if (screenList.length > initialCount) {
      process.stderr.write('Merged ' + (screenList.length - initialCount) + ' tracked screen(s) into download list\n');
    }
    if (screenList.length === 0) {
      try {
        const pr = await callTool('get_project', { name: 'projects/' + projectId });
        if (pr && pr.content) for (const item of pr.content) { if (item.type === 'text') { try { const p = JSON.parse(item.text);
          if (p.screenInstances) screenList = p.screenInstances.map(s => ({
            screenId: screenIdOf(s),
            title: titleOf(s),
            htmlUrl: htmlUrlOf(s),
            screenshotUrl: screenshotUrlOf(s),
          }));
        } catch {} } }
      } catch {}
      screenList = mergeTrackedScreens(projectId, screenList);
    }
    // Retry list-screens with delay (Stitch API can have delay after generation)
    for (let retry = 0; retry < 3 && screenList.length === 0; retry++) {
      process.stderr.write('No screens found, waiting 15s (retry ' + (retry + 1) + '/3)...\n');
      await new Promise(r => setTimeout(r, 15000));
      try {
        const r = await callTool('list_screens', { projectId });
        const rawRetry = parseScreenList(r);
        screenList = rawRetry.map(s => ({
          screenId: screenIdOf(s),
          title: titleOf(s),
          htmlUrl: htmlUrlOf(s),
          screenshotUrl: screenshotUrlOf(s),
        }));
        screenList = mergeTrackedScreens(projectId, screenList);
      } catch {}
    }
    if (screenList.length === 0) throw new Error('No screens found for project ' + projectId);
    process.stderr.write('Found ' + screenList.length + ' screens. Downloading...\n');
    let downloaded = 0, failed = 0;
    for (let i = 0; i < screenList.length; i += 5) {
      const batch = screenList.slice(i, i + 5);
      await Promise.allSettled(batch.map(async (screen) => {
        const sid = screenIdOf(screen);
        if (!sid) return;
        try {
          let htmlUrl = screen.htmlUrl, screenshotUrl = screen.screenshotUrl;
          if (!htmlUrl) { try { const sd = await callTool('get_screen', { projectId, screenId: sid, name: 'projects/' + projectId + '/screens/' + sid });
            if (sd && sd.content) for (const item of sd.content) { if (item.type === 'text') { try { const p = JSON.parse(item.text); htmlUrl = p.htmlCode?.downloadUrl || htmlUrl; screenshotUrl = p.screenshot?.downloadUrl || screenshotUrl; } catch {} } }
          } catch {} }
          const hp = join(outputDir, sid + '.html');
          if (htmlUrl) {
            if (!existsSync(hp)) { await downloadFile(htmlUrl, hp); process.stderr.write('  HTML: ' + sid + '\n'); }
          } else if (screen.localHtml && existsSync(screen.localHtml) && !existsSync(hp)) {
            copyFileSync(screen.localHtml, hp);
            process.stderr.write('  HTML-CACHE: ' + sid + '\n');
          }
          if (screenshotUrl) { const pp = join(outputDir, sid + '.png'); if (!existsSync(pp)) { await downloadFile(screenshotUrl, pp); } }
          const htmlPath = join(outputDir, sid + '.html');
          const gotHtml = existsSync(htmlPath) && (await import('fs')).statSync(htmlPath).size > 100;
          if (gotHtml) { downloaded++; } else { process.stderr.write('  NO-HTML: ' + sid + ' (htmlUrl=' + (htmlUrl ? 'yes' : 'null') + ')\n'); failed++; }
        } catch (e) { process.stderr.write('  FAIL: ' + sid + ' - ' + e.message + '\n'); failed++; }
      }));
    }
    process.stderr.write('Creating manifest + tokens...\n');
    try { await commands['create-manifest'](projectId, outputDir); } catch {}
    try { await commands['extract-tokens'](outputDir); } catch {}
    process.stderr.write('Done: ' + downloaded + '/' + screenList.length + ' downloaded\n');
    console.log(JSON.stringify({ projectId, total: screenList.length, downloaded, failed, outputDir }, null, 2));
  },

  'generate-all-screens': async function generateAllScreens(projectId, promptFile, deviceType = "DESKTOP", modelId = "GEMINI_3_1_PRO") {
    if (!projectId || !promptFile) throw new Error("Usage: generate-all-screens <projectId> <promptFile> [device] [model]");
    const { readFileSync } = await import("fs");
    let prompt;
    try { prompt = readFileSync(promptFile, "utf-8").trim(); } catch (e) { throw new Error("Cannot read prompt file: " + e.message); }
    if (!prompt) throw new Error("Prompt file is empty");

    await initialize();
    process.stderr.write("Generating all screens in single API call...\n");
    const startTime = Date.now();

    const retryAttempts = intEnv("STITCH_GENERATE_ALL_RETRY_ATTEMPTS", 3, 1, 5);
    const retryBaseDelayMs = intEnv("STITCH_GENERATE_ALL_RETRY_BASE_DELAY_MS", 45000, 5000, 180000);
    let result = null;
    let screens = [];
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const generated = await generateScreenFromText({ projectId, prompt, deviceType, modelId });
        result = generated.result;
        screens = generated.screens;
        break;
      } catch (e) {
        const message = e?.message || String(e);
        if (attempt < retryAttempts && isTransientStitchGenerateFailure(message)) {
          const delayMs = retryBaseDelayMs * attempt;
          process.stderr.write("Stitch generate transient failure on attempt " + attempt + "/" + retryAttempts + ": " + redactDiagnosticText(message).slice(0, 300) + "\n");
          process.stderr.write("Retrying generate-all-screens in " + Math.round(delayMs / 1000) + "s...\n");
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
        throw e;
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stderr.write("Generated " + screens.length + " screens in " + elapsed + "s\n");
    const zeroScreenDiagnostic = screens.length === 0 ? describeToolResultShape(result) : undefined;
    if (zeroScreenDiagnostic?.textSample) {
      process.stderr.write("0-screen Stitch response: " + zeroScreenDiagnostic.textSample.slice(0, 500) + "\n");
    }

    // Eager download all screens
    if (screens.length > 0) {
      const { mkdirSync, writeFileSync: wfs } = await import("fs");
      const { resolve } = await import("path");
      const stitchDir = resolve(process.cwd(), "stitch");
      mkdirSync(stitchDir, { recursive: true });

      let tracked = [];
      const trackingFile = resolve(process.cwd(), ".stitch-screens-" + projectId + ".json");
      try { tracked = JSON.parse(readFileSync(trackingFile, "utf-8")); } catch {}

      let dlOk = 0, dlFail = 0;
      // Download in parallel (all at once since they are already generated)
      await Promise.allSettled(screens.map(async (s) => {
        let localHtml = null;
        let localScreenshot = null;
        try {
          if (s.htmlUrl) {
            localHtml = resolve(stitchDir, s.screenId + ".html");
            await downloadFile(s.htmlUrl, localHtml);
            process.stderr.write("  HTML: " + (s.title || s.screenId) + "\n");
          }
          if (s.screenshotUrl) {
            localScreenshot = resolve(stitchDir, s.screenId + ".png");
            await downloadFile(s.screenshotUrl, localScreenshot);
          }
          if (localHtml) dlOk++;
          else dlFail++;
        } catch (e) {
          process.stderr.write("  FAIL: " + (s.title || s.screenId) + " - " + e.message + "\n");
          dlFail++;
        }
        const trackedIndex = tracked.findIndex(t => t.screenId === s.screenId);
        const trackedEntry = { screenId: s.screenId, title: s.title || "", htmlUrl: s.htmlUrl || null, screenshotUrl: s.screenshotUrl || null, localHtml, localScreenshot };
        if (trackedIndex === -1) {
          tracked.push(trackedEntry);
        } else {
          tracked[trackedIndex] = {
            ...tracked[trackedIndex],
            title: tracked[trackedIndex].title || trackedEntry.title,
            htmlUrl: tracked[trackedIndex].htmlUrl || trackedEntry.htmlUrl,
            screenshotUrl: tracked[trackedIndex].screenshotUrl || trackedEntry.screenshotUrl,
            localHtml: tracked[trackedIndex].localHtml || trackedEntry.localHtml,
            localScreenshot: tracked[trackedIndex].localScreenshot || trackedEntry.localScreenshot,
          };
        }
      }));

      wfs(trackingFile, JSON.stringify(tracked, null, 2));
      process.stderr.write("Downloaded " + dlOk + "/" + screens.length + " screens\n");
    }

    // Fallback: if parse returned 0 screens, Stitch may have generated them but response format was different
    // Try list-screens to get the actual generated screens
    if (screens.length === 0) {
      process.stderr.write("0 screens parsed — waiting for Stitch to finish generation...\n");
      for (let retry = 0; retry < 3 && screens.length === 0; retry++) {
        await new Promise(r => setTimeout(r, 30000)); // 30s wait for Stitch API delay
        process.stderr.write("Retry " + (retry + 1) + "/3: listing screens...\n");
        try {
          const listResult = await callTool("list_screens", { projectId });
          const listedScreens = parseScreenList(listResult).map(s => ({
            screenId: screenIdOf(s),
            title: titleOf(s),
            htmlUrl: htmlUrlOf(s),
            screenshotUrl: screenshotUrlOf(s),
          })).filter(s => s.screenId);
          if (listedScreens.length > 0) {
            process.stderr.write("Found " + listedScreens.length + " screens via list-screens (retry " + (retry + 1) + ")\n");
            // Download them
            const { mkdirSync } = await import("fs");
            const { resolve } = await import("path");
            const stitchDir = resolve(process.cwd(), "stitch");
            mkdirSync(stitchDir, { recursive: true });
            let dlOk = 0;
            await Promise.allSettled(listedScreens.map(async (s) => {
              try {
                if (s.htmlUrl) { await downloadFile(s.htmlUrl, resolve(stitchDir, s.screenId + ".html")); dlOk++; }
                if (s.screenshotUrl) { await downloadFile(s.screenshotUrl, resolve(stitchDir, s.screenId + ".png")); }
              } catch {}
            }));
            process.stderr.write("Fallback downloaded " + dlOk + " screens\n");
            screens.push(...listedScreens);
          }
        } catch (e) {
          process.stderr.write("list-screens retry " + (retry + 1) + " failed: " + e.message + "\n");
        }
      }
    }

    console.log(JSON.stringify({
      total: screens.length,
      screens: screens.map(s => ({ screenId: s.screenId, title: s.title })),
      elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
      diagnostic: screens.length === 0 ? zeroScreenDiagnostic : undefined
    }, null, 2));
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
  get-design-md <projectId> [repoPath]                                   Extract DESIGN.md from project
  list-screens <projectId>                                               List screens in project
  get-screen <projectId> <screenId>                                      Get screen details
  download-screen <projectId> <screenId> <outputPath>                    Download screen HTML
  create-manifest <projectId> <outputDir>                                Create DESIGN_MANIFEST.json
  extract-tokens <stitchDir> [outputCssFile]                             Merge CSS tokens from all HTMLs
  download <url> <outputFile>                                            Download file from URL
  populate-cache <sourceDir> <destDir>                                   Copy PNGs+HTMLs from sourceDir to destDir
  download-all <projectId> <outputDir>                                   Download all screens + manifest + tokens
  generate-all-screens <pId> <promptFile> [device] [model]                Single-call multi-screen generation`);
  process.exit(1);
}

try {
  await commands[cmd](...args);
} catch (err) {
  console.error(JSON.stringify({ error: err.message }, null, 2));
  process.exit(1);
}
