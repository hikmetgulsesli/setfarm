#!/usr/bin/env node
/**
 * design-dom-extract.mjs — Stitch HTML'den DOM yapısı extract eder
 * Kullanım: node design-dom-extract.mjs <stitch-dir> [output-path]
 * Çıktı: DESIGN_DOM.json
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { join, basename } from 'path';

const stitchDir = process.argv[2];
const outputPath = process.argv[3] || join(stitchDir, 'DESIGN_DOM.json');

if (!stitchDir || !existsSync(stitchDir)) {
  console.error('Usage: design-dom-extract.mjs <stitch-dir> [output-path]');
  process.exit(1);
}

const MATERIAL_ICON_RE = /<span[^>]*class=["'][^"']*material[^"']*["'][^>]*>([^<]+)<\/span>/gi;
function attrsOf(tag) {
  const attrs = {};
  const attrRe = /([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = attrRe.exec(tag)) !== null) {
    attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? true;
  }
  return attrs;
}

function classesFrom(attrs) {
  return String(attrs.class || '').split(/\s+/).filter(Boolean);
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function materialIcons(inner) {
  const icons = [];
  let m;
  MATERIAL_ICON_RE.lastIndex = 0;
  while ((m = MATERIAL_ICON_RE.exec(inner || '')) !== null) {
    const icon = String(m[1] || '').trim();
    if (icon) icons.push(icon);
  }
  return [...new Set(icons)];
}

function cleanVisibleLabel(inner, attrs = {}) {
  const icons = materialIcons(inner);
  let text = stripTags(inner);
  for (const icon of icons) {
    text = text.replace(new RegExp('(^|\\s)' + icon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)', 'gi'), ' ');
  }
  text = text.replace(/\s+/g, ' ').trim();
  const explicit = attrs['aria-label'] || attrs.title || attrs.name || attrs.id || '';
  return (text || explicit || icons[0] || '').trim().slice(0, 100);
}

function controlKey(item) {
  return [
    item.kind || item.type || 'control',
    normalizeLabel(item.label || ''),
    item.icon || '',
    item.expectedRoute || '',
    item.action || '',
  ].join('|');
}

function dedupeControls(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = controlKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function normalizeLabel(label) {
  return String(label || '')
    .replace(/[İ]/g, 'I').replace(/[ı]/g, 'i')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g').replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function expectedBehavior(control) {
  if (control.expectedRoute) return `navigate:${control.expectedRoute}`;
  switch (control.action) {
    case 'increment': return 'increase visible value/state and persist if PRD requires';
    case 'decrement': return 'decrease visible value/state and persist if PRD requires';
    case 'reset': return 'reset visible value/state, with confirmation if destructive';
    case 'form-submit': return 'validate inputs and submit/apply changes';
    case 'destructive': return 'perform destructive action with visible feedback or confirmation';
    case 'dismiss': return 'close dialog/panel or return to previous state';
    case 'retry': return 'retry the failed action and show loading/error feedback';
    case 'create': return 'open create flow or add a new item/state';
    case 'edit': return 'open edit flow or update selected item/state';
    case 'search': return 'filter/search visible results from input/query';
    default: return 'produce visible DOM/state/URL feedback; never empty onClick';
  }
}

// Simple HTML parser (regex-based, works for Stitch HTML which is well-structured)
function extractElements(html, screenId, htmlPath) {
  const result = { screenId, materialSymbolsRequired: false, sections: [], buttons: [], inputs: [], navLinks: [], cards: [], icons: [], images: [], cssVars: {}, colorPalette: {}, fonts: [], layoutHints: {}, behaviorContract: [] };

  // Extract CSS custom properties from <style> and Tailwind config
  const styleMatches = html.matchAll(/--([a-zA-Z0-9_-]+)\s*:\s*([^;]+)/g);
  for (const m of styleMatches) {
    result.cssVars[`--${m[1]}`] = m[2].trim();
  }

  // Extract color palette from CSS custom properties
  const colorVarRegex = /--color-([a-z-]+)\s*:\s*([^;]+);/gi;
  let colorMatch;
  while ((colorMatch = colorVarRegex.exec(html)) !== null) {
    result.colorPalette[colorMatch[1]] = colorMatch[2].trim();
  }

  // Also extract from design-tokens.css if available in same directory
  try {
    const tokensPath = path.join(path.dirname(htmlPath), 'design-tokens.css');
    if (existsSync(tokensPath)) {
      const tokens = readFileSync(tokensPath, 'utf-8');
      while ((colorMatch = colorVarRegex.exec(tokens)) !== null) {
        result.colorPalette[colorMatch[1]] = colorMatch[2].trim();
      }
    }
  } catch {}

  // Extract fonts from Google Fonts links
  const fontMatches = html.matchAll(/family=([A-Za-z+]+(?::[^&"']+)?)/g);
  const fontSet = new Set();
  for (const m of fontMatches) {
    fontSet.add(m[1].replace(/\+/g, ' ').split(':')[0]);
  }
  result.fonts = [...fontSet];

  const routeInference = {
    settings: "/settings", ayarlar: "/settings", tune: "/settings",
    home: "/", "ana sayfa": "/", profile: "/profile", person: "/profile", profil: "/profile",
    notifications: "/notifications", bildirimler: "/notifications",
    search: "/search", arama: "/search", ara: "/search",
    help: "/help", yardim: "/help", info: "/about", history: "/history",
    gecmis: "/history", kayitlar: "/history", favorite: "/favorites",
    bookmark: "/bookmarks", logout: "/logout", login: "/login",
  };

  // Extract buttons
  const btnRegex = /<button([^>]*)>([\s\S]*?)<\/button>/gi;
  let match;
  while ((match = btnRegex.exec(html)) !== null) {
    const attrs = attrsOf(match[1]);
    const inner = match[2];
    const icons = materialIcons(inner);
    const icon = icons[0] || null;
    const label = cleanVisibleLabel(inner, attrs);
    if (label || icon) {
      const action = predictAction(label, icon);
      const button = {
        kind: 'button',
        label: label || icon || '(icon-only)',
        classes: classesFrom(attrs),
        icon,
        action,
      };
      button.expectedBehavior = expectedBehavior(button);
      result.buttons.push(button);
    }
  }

  // Extract links (navigation)
  const linkRegex = /<a\s[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const inner = match[2];
    const attrs = attrsOf(match[0]);
    const icons = materialIcons(inner);
    const icon = icons[0] || null;
    const label = cleanVisibleLabel(inner, attrs);
    if (label || href) {
      result.navLinks.push({
        kind: 'link',
        label: label || href,
        href,
        classes: classesFrom(attrs),
        icon,
        action: 'navigate',
        expectedBehavior: `navigate:${href}`,
      });
    }
  }

  // Extract inputs
  const inputRegex = /<(input|textarea|select)\s[^>]*>/gi;
  while ((match = inputRegex.exec(html)) !== null) {
    const el = match[0];
    const attrs = attrsOf(el);
    const type = attrs.type || match[1];
    const placeholder = attrs.placeholder || '';
    const name = attrs.name || attrs.id || '';
    const label = attrs['aria-label'] || placeholder || name || type;
    if (type !== 'hidden') {
      result.inputs.push({
        kind: 'input',
        type,
        label,
        placeholder,
        name,
        classes: classesFrom(attrs),
        expectedBehavior: 'controlled value with onChange; validation if required by PRD',
      });
    }
  }

  // Tab bars are often rendered as div/button/icon groups in Stitch. Treat
  // visible tab controls as behavior requirements even when the HTML is not
  // semantic yet, so implement cannot leave them inert.
  result.tabBar = extractTabBar(html);
  for (const tab of result.tabBar) {
    const label = tab.label || tab.icon || '';
    if (!label) continue;
    if (tab.route) {
      result.navLinks.push({
        kind: 'link',
        label,
        href: tab.route,
        classes: [],
        icon: tab.icon || null,
        action: 'navigate',
        expectedBehavior: `navigate:${tab.route}`,
      });
      continue;
    }
    const action = predictAction(label, tab.icon);
    const button = {
      kind: 'button',
      label,
      classes: [],
      icon: tab.icon || null,
      action,
    };
    addExpectedRoute(button);
    button.expectedBehavior = expectedBehavior(button);
    result.buttons.push(button);
  }

  // Determine layout type from classes
  function detectLayoutType(classes) {
    if (classes.some(c => c.startsWith('grid-cols') || c === 'grid')) return 'grid';
    if (classes.some(c => c === 'flex' || c.startsWith('flex-'))) {
      const dir = classes.find(c => c === 'flex-col' || c === 'flex-column');
      return dir ? 'flex-col' : 'flex-row';
    }
    if (classes.some(c => c === 'absolute' || c === 'fixed')) return 'absolute';
    if (classes.some(c => c === 'relative')) return 'relative';
    return 'block';
  }

  // Extract sections/structural elements
  const sectionRegex = /<(section|header|footer|nav|main|aside|article)\s*[^>]*>([\s\S]*?)<\/\1>/gi;
  while ((match = sectionRegex.exec(html)) !== null) {
    const tag = match[1];
    const classMatch = match[0].match(/class="([^"]*)"/);
    const inner = match[2];
    const childCount = (inner.match(/<(div|section|article|li|tr)/gi) || []).length;
    const classes = classMatch ? classMatch[1].split(/\s+/).filter(Boolean).slice(0, 10) : [];
    result.sections.push({
      tag,
      layout: detectLayoutType(classes),
      classes,
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
  // Extract button routes from <a href> tags containing icons
  const navLinkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<span[^>]*material[^>]*>([a-z_]+)<\/span>[\s\S]*?<\/a>/gi;
  let routeMatch;
  while ((routeMatch = navLinkRegex.exec(html)) !== null) {
    const href = routeMatch[1];
    const iconName = routeMatch[2];
    // Find the button entry and add expectedRoute
    const btn = result.buttons.find(b => b.label === iconName || b.icon === iconName);
    if (btn) {
      btn.expectedRoute = href;
      btn.action = 'navigate';
      btn.expectedBehavior = expectedBehavior(btn);
    }
  }

  // Infer routes from icon names if no explicit href found
  for (const btn of result.buttons) {
    addExpectedRoute(btn);
  }

  result.buttons = dedupeControls(result.buttons);
  result.navLinks = dedupeControls(result.navLinks);
  result.inputs = dedupeControls(result.inputs);
  result.behaviorContract = [
    ...result.navLinks.map(n => ({ kind: 'link', label: n.label, icon: n.icon, route: n.href, expectedBehavior: n.expectedBehavior })),
    ...result.buttons.map(b => ({ kind: 'button', label: b.label, icon: b.icon, action: b.action, route: b.expectedRoute, expectedBehavior: b.expectedBehavior })),
    ...result.inputs.map(i => ({ kind: 'input', label: i.label, type: i.type, placeholder: i.placeholder, expectedBehavior: i.expectedBehavior })),
  ];

  function addExpectedRoute(btn) {
    const key = btn.icon || normalizeLabel(btn.label);
    if (!btn.expectedRoute && routeInference[key]) {
      btn.expectedRoute = routeInference[key];
      btn.action = 'navigate';
      btn.routeInferred = true;
      btn.expectedBehavior = expectedBehavior(btn);
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

  return result;
}

function predictAction(label, icon) {
  const l = normalizeLabel(`${label || ''} ${icon || ''}`);
  if (l.includes('kaydet') || l.includes('save') || l.includes('gonder') || l.includes('submit')) return 'form-submit';
  if (l.includes('sil') || l.includes('delete') || l.includes('kaldir')) return 'destructive';
  if (l.includes('iptal') || l.includes('cancel') || l.includes('kapat') || l.includes('close')) return 'dismiss';
  if (l.includes('yeniden dene') || l.includes('tekrar dene') || l.includes('retry')) return 'retry';
  if (l.includes('artir') || l.includes('increase') || l.includes('increment') || l.includes('plus')) return 'increment';
  if (l.includes('azalt') || l.includes('decrease') || l.includes('decrement') || l.includes('minus') || l.includes('remove')) return 'decrement';
  if (l.includes('sifirla') || l.includes('reset') || l.includes('restart')) return 'reset';
  if (l.includes('ekle') || l.includes('add') || l.includes('olustur') || l.includes('create') || l.includes('yeni')) return 'create';
  if (l.includes('duzenle') || l.includes('edit') || l.includes('guncelle')) return 'edit';
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
          const openTag = item.match(/^<([a-z]+)([^>]*)>/i);
          const attrs = attrsOf(openTag?.[2] || '');
          const icons = materialIcons(item);
          const icon = icons[0] || null;
          const label = cleanVisibleLabel(item, attrs);
          const href = attrs.href || item.match(/\shref=["']([^"']+)["']/i)?.[1] || '';
          const activeMatch = item.match(/text-primary|bg-primary|active|selected/i);
          if (label && label.length < 60) {
            tabBar.push({
              kind: href ? 'link' : 'button',
              label,
              icon,
              route: href || undefined,
              active: !!activeMatch,
            });
          }
        }
      }
    }
  }
  return tabBar.length >= 2 ? tabBar : [];
}

function isPrdPseudoScreen(screenId, title, file) {
  return /\bprd\b/i.test(`${screenId || ''} ${title || ''} ${file || ''}`);
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
  if (isPrdPseudoScreen(screenId, title, file)) continue;
  
  const elements = extractElements(html, screenId, join(stitchDir, file));
  elements.title = title;
  screens[screenId] = elements;
}

const output = { generatedAt: new Date().toISOString(), screenCount: Object.keys(screens).length, screens };
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`DESIGN_DOM: ${Object.keys(screens).length} screens, ${outputPath}`);
for (const [id, s] of Object.entries(screens)) {
  console.log(`  ${s.title}: ${s.buttons.length} buttons, ${s.inputs.length} inputs, ${s.navLinks.length} links, ${s.sections.length} sections, ${s.icons.length} icons, ${(s.tabBar||[]).length} tabs, ${Object.keys(s.colorPalette||{}).length} colors`);
}
