#!/usr/bin/env node
/**
 * design-dom-extract.mjs — Stitch HTML'den DOM yapısı extract eder
 * Kullanım: node design-dom-extract.mjs <stitch-dir> [output-path]
 * Çıktı: DESIGN_DOM.json
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const stitchDir = process.argv[2];
const outputPath = process.argv[3] || join(stitchDir, 'DESIGN_DOM.json');

if (!stitchDir || !existsSync(stitchDir)) {
  console.error('Usage: design-dom-extract.mjs <stitch-dir> [output-path]');
  process.exit(1);
}

// Simple HTML parser (regex-based, works for Stitch HTML which is well-structured)
function extractElements(html, screenId) {
  const result = { screenId, materialSymbolsRequired: false, sections: [], buttons: [], inputs: [], navLinks: [], cards: [], icons: [], images: [], cssVars: {}, fonts: [], layoutHints: {} };

  // Extract CSS custom properties from <style> and Tailwind config
  const styleMatches = html.matchAll(/--([a-zA-Z0-9_-]+)\s*:\s*([^;]+)/g);
  for (const m of styleMatches) {
    result.cssVars[`--${m[1]}`] = m[2].trim();
  }

  // Extract fonts from Google Fonts links
  const fontMatches = html.matchAll(/family=([A-Za-z+]+(?::[^&"']+)?)/g);
  const fontSet = new Set();
  for (const m of fontMatches) {
    fontSet.add(m[1].replace(/\+/g, ' ').split(':')[0]);
  }
  result.fonts = [...fontSet];

  // Extract buttons
  const btnRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi;
  let match;
  while ((match = btnRegex.exec(html)) !== null) {
    const inner = match[1];
    const classMatch = match[0].match(/class="([^"]*)"/);
    const label = inner.replace(/<[^>]*>/g, '').trim().slice(0, 100);
    const iconMatch = inner.match(/>([a-z_]+)</); // Material icon
    if (label || iconMatch) {
      result.buttons.push({
        label: label || '(icon-only)',
        classes: classMatch ? classMatch[1].split(/\s+/).filter(Boolean) : [],
        icon: iconMatch ? iconMatch[1] : null,
        action: predictAction(label),
      });
    }
  }

  // Extract links (navigation)
  const linkRegex = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const inner = match[2];
    const label = inner.replace(/<[^>]*>/g, '').trim().slice(0, 100);
    const classMatch = match[0].match(/class="([^"]*)"/);
    const iconMatch = inner.match(/>([a-z_]+)</);
    if (label || href) {
      result.navLinks.push({
        label: label || href,
        href,
        classes: classMatch ? classMatch[1].split(/\s+/).filter(Boolean) : [],
        icon: iconMatch ? iconMatch[1] : null,
      });
    }
  }

  // Extract inputs
  const inputRegex = /<(input|textarea|select)\s[^>]*>/gi;
  while ((match = inputRegex.exec(html)) !== null) {
    const el = match[0];
    const type = el.match(/type="([^"]*)"/)?.[1] || match[1];
    const placeholder = el.match(/placeholder="([^"]*)"/)?.[1] || '';
    const classMatch = el.match(/class="([^"]*)"/);
    const name = el.match(/name="([^"]*)"/)?.[1] || '';
    if (type !== 'hidden') {
      result.inputs.push({
        type,
        placeholder,
        name,
        classes: classMatch ? classMatch[1].split(/\s+/).filter(Boolean) : [],
      });
    }
  }

  // Extract sections/structural elements
  const sectionRegex = /<(section|header|footer|nav|main|aside|article)\s*[^>]*>([\s\S]*?)<\/\1>/gi;
  while ((match = sectionRegex.exec(html)) !== null) {
    const tag = match[1];
    const classMatch = match[0].match(/class="([^"]*)"/);
    const inner = match[2];
    const childCount = (inner.match(/<(div|section|article|li|tr)/gi) || []).length;
    result.sections.push({
      tag,
      classes: classMatch ? classMatch[1].split(/\s+/).filter(Boolean).slice(0, 10) : [],
      childCount,
    });
  }

  // Extract Material Symbols icons
  const iconRegex = /<span[^>]*class="[^"]*material[^"]*"[^>]*>([a-z_]+)<\/span>/gi;
  while ((match = iconRegex.exec(html)) !== null) {
    result.icons.push(match[1]);
  }
  result.icons = [...new Set(result.icons)];
  if (result.icons.length > 0) {
    result.materialSymbolsRequired = true;
  }
  // Also add clickable icons as buttons — settings, share, menu etc are interactive
  const clickableIcons = ["settings", "share", "menu", "more_vert", "more_horiz", "close", "arrow_back", "arrow_forward", "search", "filter_list", "edit", "delete", "add", "remove", "refresh", "visibility", "notifications", "person", "home", "info", "help", "logout", "login", "favorite", "bookmark", "download", "upload", "palette", "dark_mode", "light_mode", "language", "tune"];
  for (const icon of result.icons) {
    if (clickableIcons.includes(icon) || icon.includes("arrow") || icon.includes("chevron")) {
      result.buttons.push({ label: icon, classes: [], icon: icon, action: "click-action" });
    }
  }

  // Extract button routes from <a href> tags containing icons
  const navLinkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<span[^>]*material[^>]*>([a-z_]+)<\/span>[\s\S]*?<\/a>/gi;
  let routeMatch;
  while ((routeMatch = navLinkRegex.exec(html)) !== null) {
    const href = routeMatch[1];
    const iconName = routeMatch[2];
    // Find the button entry and add expectedRoute
    const btn = result.buttons.find(b => b.label === iconName || b.icon === iconName);
    if (btn) btn.expectedRoute = href;
  }

  // Infer routes from icon names if no explicit href found
  const routeInference = {
    settings: "/settings", home: "/", profile: "/profile", person: "/profile",
    notifications: "/notifications", search: "/search", help: "/help",
    info: "/about", history: "/history", favorite: "/favorites",
    bookmark: "/bookmarks", logout: "/logout", login: "/login",
  };
  for (const btn of result.buttons) {
    if (!btn.expectedRoute && routeInference[btn.icon || btn.label]) {
      btn.expectedRoute = routeInference[btn.icon || btn.label];
      btn.routeInferred = true;
    }
  }

  // Extract images
  const imgRegex = /<img\s[^>]*src="([^"]*)"[^>]*>/gi;
  while ((match = imgRegex.exec(html)) !== null) {
    const alt = match[0].match(/alt="([^"]*)"/)?.[1] || '';
    result.images.push({ src: match[1].slice(0, 200), alt });
  }

  // Layout hints from Tailwind classes
  const gridMatch = html.match(/grid-cols-(\d+)/);
  if (gridMatch) result.layoutHints.gridCols = parseInt(gridMatch[1]);
  const flexMatch = html.match(/flex-(row|col)/);
  if (flexMatch) result.layoutHints.flexDirection = flexMatch[1];
  if (html.includes('gap-')) {
    const gapMatch = html.match(/gap-(\d+)/);
    if (gapMatch) result.layoutHints.gap = gapMatch[1];
  }

  result.tabBar = extractTabBar(html);
  return result;
}

function predictAction(label) {
  if (!label) return 'unknown';
  const l = label.toLowerCase();
  if (l.includes('kaydet') || l.includes('save') || l.includes('g\u00f6nder') || l.includes('submit')) return 'form-submit';
  if (l.includes('sil') || l.includes('delete') || l.includes('kald\u0131r')) return 'destructive';
  if (l.includes('iptal') || l.includes('cancel') || l.includes('kapat') || l.includes('close')) return 'dismiss';
  if (l.includes('ekle') || l.includes('add') || l.includes('olu\u015ftur') || l.includes('create') || l.includes('yeni')) return 'create';
  if (l.includes('d\u00fczenle') || l.includes('edit') || l.includes('g\u00fcncelle')) return 'edit';
  if (l.includes('ara') || l.includes('search') || l.includes('filtre')) return 'search';
  return 'click-action';
}

// Extract tab bar / bottom navigation
function extractTabBar(html) {
  const tabBar = [];
  // Pattern 1: bottom nav with links/buttons containing icons + labels
  const navRegex = /<nav[^>]*>([\s\S]*?)<\/nav>/gi;
  const footerRegex = /<footer[^>]*>([\s\S]*?)<\/footer>/gi;
  
  for (const regex of [navRegex, footerRegex]) {
    let m;
    while ((m = regex.exec(html)) !== null) {
      const inner = m[1];
      // Check if this looks like a tab bar (3+ items with icons)
      const items = inner.match(/<(a|button|div)[^>]*>[\s\S]*?<\/(a|button|div)>/gi) || [];
      if (items.length >= 2) {
        for (const item of items) {
          const label = item.replace(/<[^>]*>/g, '').trim();
          const iconMatch = item.match(/>([a-z_]+)</);
          const activeMatch = item.match(/text-primary|bg-primary|active|selected/i);
          // Clean label: remove material icon name prefix (e.g. "settings\nAYARLAR" → "AYARLAR")
          const cleanLabel = label.includes('\n') ? label.split('\n').pop().trim() : label;
          if (cleanLabel && cleanLabel.length < 30) {
            tabBar.push({
              label: cleanLabel,
              icon: iconMatch ? iconMatch[1] : null,
              active: !!activeMatch,
            });
          }
        }
      }
    }
  }
  return tabBar.length >= 2 ? tabBar : [];
}

// Main
const htmlFiles = readdirSync(stitchDir).filter(f => f.endsWith('.html'));
if (htmlFiles.length === 0) {
  console.error('No HTML files in', stitchDir);
  process.exit(1);
}

// Load manifest for screen titles
let manifest = [];
const manifestPath = join(stitchDir, 'DESIGN_MANIFEST.json');
if (existsSync(manifestPath)) {
  try {
    const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    manifest = Array.isArray(raw) ? raw : (raw.screens || []);
  } catch {}
}

const screens = {};
for (const file of htmlFiles) {
  const html = readFileSync(join(stitchDir, file), 'utf-8');
  const screenId = file.replace('.html', '');
  
  // Find title from manifest or HTML <title>
  const manifestEntry = manifest.find(m => m.htmlFile === file || m.screenId === screenId);
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const title = manifestEntry?.title || titleMatch?.[1] || screenId;
  
  const elements = extractElements(html, screenId);
  elements.title = title;
  screens[screenId] = elements;
}

const output = { generatedAt: new Date().toISOString(), screenCount: Object.keys(screens).length, screens };
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`DESIGN_DOM: ${Object.keys(screens).length} screens, ${outputPath}`);
for (const [id, s] of Object.entries(screens)) {
  console.log(`  ${s.title}: ${s.buttons.length} buttons, ${s.inputs.length} inputs, ${s.navLinks.length} links, ${s.sections.length} sections, ${s.icons.length} icons, ${(s.tabBar||[]).length} tabs`);
}
