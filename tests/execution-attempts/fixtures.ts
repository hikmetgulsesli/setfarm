export const HASH_A = "a".repeat(64);
export const HASH_B = "b".repeat(64);
export const HASH_C = "c".repeat(64);
export const HASH_D = "d".repeat(64);
export const SHA_A = "1".repeat(40);
export const SHA_B = "2".repeat(40);
export const TREE_A = "3".repeat(40);
export const TREE_B = "4".repeat(40);

export function exactProductReservation(overrides: Record<string, unknown> = {}) {
  return {
    runId: "run-contract-1",
    stepId: "implement",
    storyId: "US-002",
    attemptClass: "product_implementation" as const,
    packetHash: HASH_A,
    compilationReportHash: HASH_B,
    sliceHash: HASH_C,
    sourceBefore: { sha: SHA_A, treeHash: TREE_A },
    findingSetHash: HASH_D,
    role: "developer",
    agentId: "feature-dev",
    branch: "story/us-002",
    worktree: ".worktrees/us-002",
    evidenceRefs: [],
    ...overrides,
  };
}
