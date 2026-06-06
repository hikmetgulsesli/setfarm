import fs from "node:fs";
import path from "node:path";
import { implementEvidenceArtifactPaths, readImplementEvidenceConfig, type EvidenceGateMode, type VisualEvidenceProvider } from "./implement-evidence.js";
import type { CapturedRuntimeState, InteractionResult, RuntimeSession } from "./runtime-driver.js";

export interface VisualEvidenceResult {
  status: "disabled" | "skipped" | "pass" | "fail" | "error";
  mode: EvidenceGateMode;
  provider: VisualEvidenceProvider;
  summary: string;
  detail?: string;
}

export interface ImplementEvidenceArtifactInput {
  workdir: string;
  storyId: string;
  runtime: RuntimeSession | Record<string, unknown>;
  commands: Array<{ cmd: string; exitCode: number; summary?: string }>;
  flows: Array<{
    flowId: string;
    description?: string;
    interactions?: InteractionResult[];
    captures?: CapturedRuntimeState[];
  }>;
  visualEvidence?: VisualEvidenceResult;
  verdict: "pass" | "fail";
  issues?: Array<{ code: string; message: string }>;
}

export function currentVisualEvidenceResult(): VisualEvidenceResult {
  const config = readImplementEvidenceConfig();
  if (config.visualGate === "off") {
    return {
      status: "disabled",
      mode: config.visualGate,
      provider: config.visualProvider,
      summary: "Visual evidence gate is disabled by SETFARM_VISUAL_EVIDENCE_GATE=off.",
    };
  }
  if (config.visualProvider === "none") {
    return {
      status: "skipped",
      mode: config.visualGate,
      provider: config.visualProvider,
      summary: "Visual evidence provider is none; no VLM judgement was run.",
    };
  }
  return {
    status: "skipped",
    mode: config.visualGate,
    provider: config.visualProvider,
    summary: "Visual evidence provider configured but no visual judgement runner is attached yet.",
  };
}

export function writeImplementEvidenceArtifact(input: ImplementEvidenceArtifactInput): string {
  const paths = implementEvidenceArtifactPaths(input.workdir, input.storyId);
  fs.mkdirSync(path.dirname(paths.evidence), { recursive: true });
  const artifact = {
    schema: "setfarm.implement-evidence.v1",
    generatedAt: new Date().toISOString(),
    storyId: input.storyId,
    runtime: input.runtime,
    commands: input.commands,
    flows: input.flows,
    visualEvidence: input.visualEvidence || currentVisualEvidenceResult(),
    verdict: input.verdict,
    issues: input.issues || [],
  };
  fs.writeFileSync(paths.evidence, JSON.stringify(artifact, null, 2));
  return paths.evidence;
}
