import type { StackContract, StackPackId } from "../stack-contract/types.js";

export type LibraryPackId =
  | "ui-shadcn-radix"
  | "icons-lucide"
  | "motion-animation"
  | "creative-canvas"
  | "forms-validation"
  | "charts-data-viz";

export type LibraryPackEvidenceType = "stack" | "task-hint" | "design-hint" | "selection";

export interface LibraryPackEvidence {
  type: LibraryPackEvidenceType;
  value: string;
  weight: number;
}

export interface LibraryPack {
  id: LibraryPackId;
  label: string;
  appliesToStacks: StackPackId[];
  whenToUse: string;
  intentSignals: string[];
  designSignals: string[];
  installNotes: string[];
  constraints: string[];
  prompt: string;
}

export interface SelectedLibraryPack {
  id: LibraryPackId;
  label: string;
  evidence: LibraryPackEvidence[];
  prompt: string;
}

export interface SkippedLibraryPack {
  id: LibraryPackId;
  reason: string;
}

export interface LibraryPackSelection {
  schema: "setfarm.library-packs.v1";
  status: "selected" | "none";
  stackPackId?: StackPackId;
  selected: SelectedLibraryPack[];
  skipped: SkippedLibraryPack[];
  authority: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelectLibraryPacksInput {
  stackContract?: StackContract | null;
  taskText?: string;
  designText?: string;
  now?: string;
}

export interface LibraryPackCandidate {
  id: LibraryPackId;
  score: number;
  evidence: LibraryPackEvidence[];
}
