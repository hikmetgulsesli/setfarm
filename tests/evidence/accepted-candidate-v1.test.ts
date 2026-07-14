import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AcceptedCandidateV1Schema,
  createAcceptedCandidateV1,
} from "../../src/evidence/accepted-candidate-v1.js";

function fixture() {
  return createAcceptedCandidateV1({
    runId: "accepted-candidate-test",
    packetHash: "a".repeat(64),
    storyPlanHash: "b".repeat(64),
    sourceRevision: { sha: "c".repeat(40), treeHash: "d".repeat(40) },
    storyEvidence: [
      {
        storyId: "US-002",
        attemptId: "ATT_00000000-0000-0000-0000-000000000002",
        sliceHash: "2".repeat(64),
        evidencePlanHash: "3".repeat(64),
        evidencePlanArtifactHash: "4".repeat(64),
        evidenceBundleHash: "5".repeat(64),
        evidenceId: `EVB_${"6".repeat(64)}`,
        predicateRefs: ["EVID_SECOND", "EVID_COMMAND_CMD_TEST"],
      },
      {
        storyId: "US-001",
        attemptId: "ATT_00000000-0000-0000-0000-000000000001",
        sliceHash: "7".repeat(64),
        evidencePlanHash: "8".repeat(64),
        evidencePlanArtifactHash: "9".repeat(64),
        evidenceBundleHash: "0".repeat(64),
        evidenceId: `EVB_${"1".repeat(64)}`,
        predicateRefs: ["EVID_FIRST", "EVID_COMMAND_CMD_BUILD"],
      },
    ],
    acceptor: {
      id: "setfarm-final-tree-acceptor",
      version: "1.0.0",
      codeSha: "e".repeat(40),
      environmentHash: "f".repeat(64),
    },
  });
}

describe("AcceptedCandidateV1", () => {
  it("canonically seals every story proof to one exact integrated source tree", () => {
    const first = fixture();
    const second = fixture();
    assert.deepEqual(first, second);
    assert.deepEqual(first.storyEvidence.map((entry) => entry.storyId), ["US-001", "US-002"]);
    assert.equal(first.candidateId, `ACPT_${first.candidateHash}`);
    assert.deepEqual(AcceptedCandidateV1Schema.parse(first), first);
  });

  it("rejects omitted, duplicated, reordered or mutated final-tree evidence", () => {
    const accepted = fixture();
    assert.equal(AcceptedCandidateV1Schema.safeParse({
      ...accepted,
      sourceRevision: { ...accepted.sourceRevision, treeHash: "a".repeat(40) },
    }).success, false);
    assert.equal(AcceptedCandidateV1Schema.safeParse({
      ...accepted,
      storyEvidence: accepted.storyEvidence.slice(1),
    }).success, false);
    assert.equal(AcceptedCandidateV1Schema.safeParse({
      ...accepted,
      storyEvidence: [...accepted.storyEvidence].reverse(),
    }).success, false);
    assert.equal(AcceptedCandidateV1Schema.safeParse({
      ...accepted,
      storyEvidence: [accepted.storyEvidence[0], accepted.storyEvidence[0]],
    }).success, false);
  });
});
