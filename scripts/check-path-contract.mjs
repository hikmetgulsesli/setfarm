import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoots = ["src", "scripts", "landing"];
const checkedExt = new Set([".ts", ".js", ".mjs", ".html", ".md"]);
const skippedFiles = new Set(["scripts/check-path-contract.mjs"]);

const blockedPatterns = [
  /\/home\/[A-Za-z0-9._-]+/,
  /\/Users\/[A-Za-z0-9._-]+/,
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(root, absolute);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
      files.push(...walk(absolute));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!checkedExt.has(path.extname(entry.name))) continue;
    if (skippedFiles.has(relative)) continue;
    files.push(relative);
  }
  return files;
}

const checkedFiles = sourceRoots.flatMap((dir) => walk(path.join(root, dir))).sort();
const failures = [];

for (const file of checkedFiles) {
  const text = fs.readFileSync(path.join(root, file), "utf-8");
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (blockedPatterns.some((pattern) => pattern.test(lines[index]))) {
      failures.push(`${file}:${index + 1}: ${lines[index].trim()}`);
    }
  }
}

if (failures.length) {
  console.error("Setfarm path contract failed: use $HOME, homedir(), or configured roots instead of host-specific paths.");
  for (const failure of failures.slice(0, 50)) console.error(`- ${failure}`);
  if (failures.length > 50) console.error(`...and ${failures.length - 50} more`);
  process.exit(1);
}

console.log(`Setfarm path contract OK: ${checkedFiles.length} files`);
