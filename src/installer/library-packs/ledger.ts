import fs from "node:fs";
import path from "node:path";
import { ensureSupervisorArtifactsExcluded } from "../supervisor/state.js";
import type { LibraryPackSelection } from "./types.js";

export function libraryPackLedgerDir(workdir: string): string {
  return path.join(workdir, ".setfarm", "ledger");
}

export function libraryPackSelectionPath(workdir: string): string {
  return path.join(libraryPackLedgerDir(workdir), "library-packs.json");
}

export function writeLibraryPackSelection(workdir: string, selection: LibraryPackSelection): string {
  ensureSupervisorArtifactsExcluded(workdir);
  const file = libraryPackSelectionPath(workdir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...selection, updatedAt: new Date().toISOString() }, null, 2) + "\n");
  return file;
}

export function readLibraryPackSelection(workdir: string): LibraryPackSelection | null {
  const file = libraryPackSelectionPath(workdir);
  try {
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as LibraryPackSelection;
    return parsed?.schema === "setfarm.library-packs.v1" ? parsed : null;
  } catch {
    return null;
  }
}
