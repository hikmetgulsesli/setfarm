import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from
  "../../src/product-compiler/canonical-json.js";
import {
  IMPLEMENTATION_SLICE_CONTRACT_HASH_V2,
  IMPLEMENTATION_SLICE_CONTRACT_V2,
  IMPLEMENTATION_SLICE_V2_BLOCKER_CODES,
  IMPLEMENTATION_SLICE_V2_VALIDATION_IDS,
  hashImplementationSliceV2,
} from "../../src/product-compiler/schemas/implementation-slice-v2.js";

const IMPLEMENTATION_SLICE_CONTRACT_HASH_GOLDEN_V2 =
  "e707124affc1e85034e40d6dd0b474316ccff48590a5d8561a3bfaaaea8778f8";

describe("V4-native ImplementationSliceV2 contract", () => {
  it("pins compact CAS bindings and exact no-model-dispatch authority", () => {
    assert.equal(
      IMPLEMENTATION_SLICE_CONTRACT_V2.artifactGraph.packet,
      "exact_cas_envelope_binding_not_embedded",
    );
    assert.equal(
      IMPLEMENTATION_SLICE_CONTRACT_V2.implementation.mode,
      "generated_sources_complete_no_model_dispatch",
    );
    assert.equal(
      IMPLEMENTATION_SLICE_CONTRACT_V2.implementation.modelWritablePathRefs,
      "exact_empty",
    );
    assert.deepEqual(IMPLEMENTATION_SLICE_V2_BLOCKER_CODES, [
      "IMPLEMENTATION_SLICE_V2_ATOMIC_ARTIFACT_SET_ACTIVATION_UNVERIFIED",
      "IMPLEMENTATION_SLICE_V2_AUTHENTICATED_CANDIDATE_EVIDENCE_UNVERIFIED",
      "IMPLEMENTATION_SLICE_V2_EVIDENCE_ADAPTER_REGISTRY_V2_UNVERIFIED",
      "IMPLEMENTATION_SLICE_V2_EVIDENCE_PLAN_V2_UNVERIFIED",
      "IMPLEMENTATION_SLICE_V2_RELEASE_MANIFEST_UNVERIFIED",
    ]);
    assert.deepEqual(IMPLEMENTATION_SLICE_V2_VALIDATION_IDS, [
      "VALIDATE_SLICE_V2_GENERATOR_OWNERSHIP_EXACT",
      "VALIDATE_SLICE_V2_INDIVIDUAL_CAS_PREFLIGHT",
      "VALIDATE_SLICE_V2_LEGACY_WIRE_REJECTED",
      "VALIDATE_SLICE_V2_MODEL_WRITE_AUTHORITY_EMPTY",
      "VALIDATE_SLICE_V2_PACKET_V4_FRESH",
      "VALIDATE_SLICE_V2_SOURCE_MAP_PROOF_FRESH",
      "VALIDATE_SLICE_V2_STORY_PROJECTION_EXACT",
    ]);
    assert.equal(
      IMPLEMENTATION_SLICE_CONTRACT_HASH_V2,
      IMPLEMENTATION_SLICE_CONTRACT_HASH_GOLDEN_V2,
    );
  });

  it("uses a separate slice domain and ignores only the derived slice hash", () => {
    const identity = { schema: "example", value: 1 } as any;
    const sliceHash = hashImplementationSliceV2(identity);
    assert.equal(
      hashImplementationSliceV2({ ...identity, sliceHash } as any),
      sliceHash,
    );
    assert.notEqual(sliceHash, hashCanonicalJson(identity));
    assert.notEqual(
      sliceHash,
      hashCanonicalJson({
        schema: "setfarm.implementation-slice-hash.v1",
        slice: identity,
      }),
    );
  });
});
