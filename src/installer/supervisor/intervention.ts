import crypto from "node:crypto";
import type { SupervisorChecklist, SupervisorFinding, SupervisorIntervention } from "./types.js";

export function buildSupervisorIntervention(params: {
  checklist: SupervisorChecklist;
  finding: SupervisorFinding;
  storyId?: string;
  targetWorker?: string;
  targetSessionId?: string;
}): SupervisorIntervention {
  const { checklist, finding, storyId, targetWorker, targetSessionId } = params;
  const item = checklist.items.find((candidate) => candidate.id === finding.itemId);
  const scopeFiles = item?.scopeFiles?.length ? item.scopeFiles : finding.files;
  const message = [
    "SUPERVISOR_INTERVENTION:",
    `${storyId || finding.storyId || "story"} is not complete.`,
    `Open ${finding.severity}: ${finding.itemId}`,
    finding.message,
    "Only edit scoped files:",
    ...scopeFiles.map((file) => `- ${file}`),
    "Do not report STATUS: done until scanner evidence passes this item.",
  ].join("\n");

  return {
    id: interventionId(storyId || finding.storyId || "story", finding.itemId, message),
    storyId: storyId || finding.storyId,
    itemId: finding.itemId,
    targetWorker,
    targetSessionId,
    type: "live-instruction",
    message,
    result: "pending",
    createdAt: new Date().toISOString(),
  };
}

export function formatSupervisorBlockerFeedback(findings: SupervisorFinding[]): string {
  if (findings.length === 0) return "";
  return [
    "SUPERVISOR_BLOCKERS_OPEN: Story cannot advance until deterministic supervisor scanner blockers pass.",
    ...findings.slice(0, 12).map((finding) => `- ${finding.itemId}: ${finding.message}`),
  ].join("\n");
}

function interventionId(storyId: string, itemId: string, message: string): string {
  const hash = crypto.createHash("sha1").update(`${storyId}\n${itemId}\n${message}`).digest("hex").slice(0, 12);
  return `intervention:${safeSegment(storyId)}:${safeSegment(itemId)}:${hash}`;
}

function safeSegment(value: string): string {
  return String(value || "unknown").replace(/[^A-Za-z0-9._:-]+/g, "-").slice(0, 120) || "unknown";
}
