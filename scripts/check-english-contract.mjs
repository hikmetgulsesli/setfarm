import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoots = ["src", "scripts", "tests", "landing", "workflows", "docs"];
const rootFiles = ["README.md", "CHANGELOG.md", "package.json"];
const checkedExt = new Set([".ts", ".js", ".mjs", ".html", ".md"]);
const skippedFiles = new Set(["scripts/check-english-contract.mjs"]);

const blockedChars = new RegExp(`[${[0xe7, 0x11f, 0x131, 0xf6, 0x15f, 0xfc, 0xc7, 0x11e, 0x130, 0xd6, 0x15e, 0xdc].map((code) => String.fromCharCode(code)).join("")}]`);
const blockedWordParts = [
  ["S", "en"], ["K", "URALLAR"], ["S", "ayfa"], ["S", "ayfalar"],
  ["A", "ciklama"], ["T", "asarim"], ["B", "olum"], ["D", "ondur"],
  ["K", "ullanici"], ["A", "sistan"], ["P", "roje"], ["H", "enuz"],
  ["S", "adece"], ["O", "NEMLI"], ["t", "ahmin"], ["t", "asarimi"],
  ["d", "osya"], ["a", "di"], ["b", "olum"], ["o", "lasi"], ["o", "neriler"],
  ["I", "cerik"], ["C", "ikti"], ["G", "elistir"], ["E", "kran"],
  ["U", "run"], ["O", "zellik"], ["B", "aslat"], ["D", "urdur"],
  ["H", "ata"], ["G", "orev"], ["D", "urum"], ["S", "ervis"],
  ["O", "lusturan"], ["T", "arih"], ["Y", "eni"], ["S", "il"],
  ["K", "aydet"], ["I", "ptal"], ["Y", "ukle"], ["I", "ndir"],
  ["D", "uzenle"], ["A", "naliz"], ["A", "rastirma"], ["S", "ablon"],
  ["G", "ecmis"], ["k", "omponent"], ["r", "enk"], ["v", "eri"],
  ["b", "asari"], ["b", "asarisiz"], ["b", "ulunamadi"], ["o", "lustur"],
  ["c", "alistir"], ["m", "imarisi"], ["u", "zerine"],
];
const blockedWords = new RegExp(`\\b(${blockedWordParts.map((parts) => parts.join("")).join("|")})\\b`, "i");

function walk(dir) {
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

const checkedFiles = [
  ...sourceRoots.flatMap((dir) => walk(path.join(root, dir))),
  ...rootFiles.filter((file) => fs.existsSync(path.join(root, file))),
].sort();

const failures = [];
for (const file of checkedFiles) {
  const text = fs.readFileSync(path.join(root, file), "utf-8");
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (blockedChars.test(lines[index]) || blockedWords.test(lines[index])) {
      failures.push(`${file}:${index + 1}: ${lines[index].trim()}`);
    }
  }
}

if (failures.length) {
  console.error("Setfarm English source contract failed:");
  for (const failure of failures.slice(0, 50)) console.error(`- ${failure}`);
  if (failures.length > 50) console.error(`...and ${failures.length - 50} more`);
  process.exit(1);
}

console.log(`Setfarm English source contract OK: ${checkedFiles.length} files`);
