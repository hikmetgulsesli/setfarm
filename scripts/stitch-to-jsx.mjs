#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoPath = process.argv[2];
if (!repoPath) { console.error("Usage: node stitch-to-jsx.mjs <repo-path>"); process.exit(1); }

const stitchDir = path.join(repoPath, "stitch");
const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
if (!fs.existsSync(manifestPath)) { console.log("No DESIGN_MANIFEST.json — skipping"); process.exit(0); }

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
const screensDir = path.join(repoPath, "src", "screens");
fs.mkdirSync(screensDir, { recursive: true });

function htmlToJsx(html) {
  return html
    .replace(/<(img|br|hr|input|meta|link)([^>]*?)>/gi, "<$1$2 />")
    .replace(/\bclass="/g, "className=\"")
    .replace(/\bfor="/g, "htmlFor=\"")
    .replace(/\btabindex="/g, "tabIndex=\"")
    .replace(/<!--(.*?)-->/g, "{/* $1 */}")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]*\/?\s*>/gi, "")
    .replace(/<meta[^>]*\/?\s*>/gi, "")
    .replace(/style="([^"]+)"/g, (_, s) => {
      const pairs = s.split(";").filter(x => x.trim()).map(x => {
        const [k, ...v] = x.split(":");
        const key = k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        return key + ": \"" + v.join(":").trim() + "\"";
      });
      return "style={{" + pairs.join(", ") + "}}";
    });
}

function extractBody(html) {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1].trim() : html;
}

function toComponentName(title) {
  return title
    .replace(/[ıİ]/g,"i").replace(/[şŞ]/g,"s").replace(/[çÇ]/g,"c")
    .replace(/[ğĞ]/g,"g").replace(/[üÜ]/g,"u").replace(/[öÖ]/g,"o")
    .replace(/[^a-zA-Z0-9\s]/g,"")
    .split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
}

const screenIndex = [];
for (const screen of manifest) {
  const htmlFile = path.join(stitchDir, screen.screenId + ".html");
  if (!fs.existsSync(htmlFile)) { console.warn("  SKIP:", screen.title); continue; }
  const raw = fs.readFileSync(htmlFile, "utf-8");
  const body = extractBody(raw);
  const jsx = htmlToJsx(body);
  const name = toComponentName(screen.title);
  const buttons = [...body.matchAll(/<button[^>]*>/gi)].length;
  const inputs = [...body.matchAll(/<input[^>]*>/gi)].length;
  const links = [...body.matchAll(/<a\s[^>]*>/gi)].length;

  const code = `// AUTO-GENERATED from Stitch — DO NOT modify layout or CSS
// Screen: ${screen.title}
// 
// AGENT INSTRUCTIONS:
// 1. DO NOT change className values or layout structure
// 2. Add useState for dynamic values (replace hardcoded text)
// 3. Add onClick/onChange handlers to interactive elements
// 4. Replace placeholder data with props/state

import { useState } from "react";

interface ${name}Props {}

export function ${name}(props: ${name}Props) {
  return (
    <>
${jsx.split("\n").map(l => "      " + l).join("\n")}
    </>
  );
}
`;
  fs.writeFileSync(path.join(screensDir, name + ".tsx"), code);
  screenIndex.push({ screenId: screen.screenId, title: screen.title, componentName: name, file: "src/screens/" + name + ".tsx", buttons, inputs, links });
  console.log("  OK:", screen.title, "->", name + ".tsx", "(" + buttons + "btn," + inputs + "inp," + links + "lnk)");
}

fs.writeFileSync(path.join(screensDir, "SCREEN_INDEX.json"), JSON.stringify(screenIndex, null, 2));
console.log("Generated", screenIndex.length, "screen(s)");
