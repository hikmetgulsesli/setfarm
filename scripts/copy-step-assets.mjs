#!/usr/bin/env node
// Copy .md assets (rules, prompt, README) from src/installer/steps/
// into dist/installer/steps/ so StepModule runtime can fs.readFileSync
// the prompt templates it needs. tsc only emits .js files.
import fs from "node:fs";
import path from "node:path";

const srcRoot = "src/installer/steps";
const distRoot = "dist/installer/steps";

if (!fs.existsSync(srcRoot)) {
  console.log("[copy-step-assets] no src/installer/steps/ yet — skipping");
  process.exit(0);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

const mdFiles = walk(srcRoot);
let copied = 0;
for (const src of mdFiles) {
  const rel = path.relative(srcRoot, src);
  const dest = path.join(distRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  copied++;
}
console.log(`[copy-step-assets] copied ${copied} .md file(s) to ${distRoot}/`);
