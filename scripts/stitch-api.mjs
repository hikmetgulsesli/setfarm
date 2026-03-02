#!/usr/bin/env node

/**
 * stitch-api.mjs — CLI wrapper for Google Stitch MCP (JSON-RPC over HTTPS)
 *
 * Usage:
 *   node stitch-api.mjs create-project "Project Name"
 *   node stitch-api.mjs generate-screen <projectId> "<prompt>" [DESKTOP|MOBILE|TABLET] [GEMINI_3_PRO|GEMINI_3_FLASH]
 *   node stitch-api.mjs list-screens <projectId>
 *   node stitch-api.mjs get-screen <projectId> <screenId>
 *   node stitch-api.mjs download <url> <outputFile>
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
  if (res.status === 429 && attempt < 3) { await new Promise(r => setTimeout(r, 10_000)); return downloadFile(url, outputPath, attempt + 1); }
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

    console.log(JSON.stringify({ screens, suggestions }, null, 2));
  },

  async 'list-screens'(projectId) {
    if (!projectId) throw new Error('Usage: list-screens <projectId>');
    await initialize();
    const result = await callTool('list_screens', { projectId });

    let screens = [];
    if (result && result.content) {
      for (const item of result.content) {
        if (item.type === 'text') {
          try {
            const parsed = JSON.parse(item.text);
            // Handle multiple response formats:
            // 1. { screens: [...] }
            // 2. Direct array [...]
            // 3. { structuredContent: { screens: [...] } }
            // 4. { outputComponents: [{ design: { screens: [...] } }] }
            if (Array.isArray(parsed)) {
              screens = parsed;
            } else if (parsed.screens) {
              screens = parsed.screens;
            } else if (parsed.structuredContent?.screens) {
              screens = parsed.structuredContent.screens;
            } else if (parsed.outputComponents) {
              for (const comp of parsed.outputComponents) {
                if (comp.design?.screens) {
                  screens.push(...comp.design.screens);
                }
              }
            } else if (parsed.output_components) {
              for (const comp of parsed.output_components) {
                if (comp.design?.screens) {
                  screens.push(...comp.design.screens);
                }
              }
            }
          } catch {
            // skip unparseable text
          }
        }
      }
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
  list-projects                                             List all Stitch projects
  find-project "Name"                                       Find project by name
  create-project "Title"                                    Create a Stitch project
  generate-screen <projectId> "<prompt>" [device] [model]   Generate a screen
  list-screens <projectId>                                  List screens in project
  get-screen <projectId> <screenId>                         Get screen details
  download <url> <outputFile>                               Download file from URL`);
  process.exit(1);
}

try {
  await commands[cmd](...args);
} catch (err) {
  console.error(JSON.stringify({ error: err.message }, null, 2));
  process.exit(1);
}
