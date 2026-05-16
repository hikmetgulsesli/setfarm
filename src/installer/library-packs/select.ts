import { getLibraryPack, listLibraryPacks } from "./registry.js";
import type { LibraryPackCandidate, LibraryPackEvidence, LibraryPackId, LibraryPackSelection, SelectLibraryPacksInput } from "./types.js";

const SELECTION_THRESHOLD = 25;

export function selectLibraryPacks(input: SelectLibraryPacksInput): LibraryPackSelection {
  const now = input.now ?? new Date().toISOString();
  const stackPackId = input.stackContract?.packId;
  const taskText = normalizeText(input.taskText ?? "");
  const designText = normalizeText(input.designText ?? "");
  const candidates = listLibraryPacks()
    .map((pack): LibraryPackCandidate | null => {
      if (!stackPackId || !pack.appliesToStacks.includes(stackPackId)) {
        return null;
      }
      const evidence: LibraryPackEvidence[] = [];
      let score = 0;

      if (pack.id === "creative-canvas" && stackPackId === "browser-game-canvas") {
        score += 100;
        evidence.push({ type: "stack", value: stackPackId, weight: 100 });
      }

      for (const signal of pack.intentSignals) {
        if (containsSignal(taskText, signal)) {
          score += 20;
          evidence.push({ type: "task-hint", value: signal, weight: 20 });
        }
      }

      for (const signal of pack.designSignals) {
        if (containsSignal(designText, signal)) {
          score += 15;
          evidence.push({ type: "design-hint", value: signal, weight: 15 });
        }
      }

      return { id: pack.id, score, evidence };
    })
    .filter((candidate): candidate is LibraryPackCandidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const selected = candidates
    .filter((candidate) => candidate.score >= SELECTION_THRESHOLD)
    .map((candidate) => {
      const pack = getLibraryPack(candidate.id);
      return {
        id: pack.id,
        label: pack.label,
        evidence: candidate.evidence,
        prompt: formatPackPrompt(pack.id),
      };
    });

  const selectedIds = new Set(selected.map((pack) => pack.id));
  const skipped = listLibraryPacks()
    .filter((pack) => !selectedIds.has(pack.id))
    .map((pack) => ({
      id: pack.id,
      reason: !stackPackId || !pack.appliesToStacks.includes(stackPackId)
        ? `Not applicable to stack ${stackPackId || "unknown"}.`
        : "No matching task or design signal reached the selection threshold.",
    }));

  return {
    schema: "setfarm.library-packs.v1",
    status: selected.length > 0 ? "selected" : "none",
    stackPackId,
    selected,
    skipped,
    authority: "Stitch, PRD, design contract, DESIGN_DOM, and stack contract override library defaults.",
    createdAt: now,
    updatedAt: now,
  };
}

function formatPackPrompt(id: LibraryPackId): string {
  const pack = getLibraryPack(id);
  const constraints = pack.constraints.map((item) => `- ${item}`).join("\n");
  const installNotes = pack.installNotes.map((item) => `- ${item}`).join("\n");
  return [
    `Library Pack: ${pack.label}`,
    pack.prompt,
    "Constraints:",
    constraints,
    "Install Notes:",
    installNotes,
  ].join("\n");
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ");
}

function containsSignal(text: string, signal: string): boolean {
  if (!text) return false;
  const normalized = normalizeText(signal).trim();
  if (!normalized) return false;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}
