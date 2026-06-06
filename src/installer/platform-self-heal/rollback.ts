import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface PrePatchFileSnapshot {
  file: string;
  sha256: string;
  existed: boolean;
  contentBase64?: string;
}

export function capturePrePatchHashes(files: string[]): PrePatchFileSnapshot[] {
  return files.map((file) => {
    if (!fs.existsSync(file)) return { file, sha256: "", existed: false };
    const content = fs.readFileSync(file);
    return {
      file,
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
      existed: true,
      contentBase64: content.toString("base64"),
    };
  });
}

export function restorePrePatchHashes(snapshots: PrePatchFileSnapshot[]): void {
  for (const snapshot of snapshots) {
    if (!snapshot.existed) {
      fs.rmSync(snapshot.file, { force: true });
      continue;
    }
    fs.mkdirSync(path.dirname(snapshot.file), { recursive: true });
    fs.writeFileSync(snapshot.file, Buffer.from(snapshot.contentBase64 || "", "base64"));
  }
}
