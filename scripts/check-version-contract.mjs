import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf-8"));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf-8");

const errors = [];
const pkgVersion = pkg.version;
const lockRootVersion = lock.version;
const lockPackageVersion = lock.packages?.[""]?.version;

if (!pkgVersion) errors.push("package.json has no version");
if (lockRootVersion !== pkgVersion) {
  errors.push(`package-lock.json root version ${lockRootVersion} does not match package.json ${pkgVersion}`);
}
if (lockPackageVersion !== pkgVersion) {
  errors.push(`package-lock.json package version ${lockPackageVersion} does not match package.json ${pkgVersion}`);
}
if (!new RegExp(`^##\\s+${escapeRegExp(pkgVersion)}\\s+-\\s+\\d{4}-\\d{2}-\\d{2}\\s*$`, "m").test(changelog)) {
  errors.push(`CHANGELOG.md is missing a release heading for ${pkgVersion}`);
}

if (errors.length) {
  console.error("Setfarm version contract failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Setfarm version contract OK: ${pkgVersion}`);
