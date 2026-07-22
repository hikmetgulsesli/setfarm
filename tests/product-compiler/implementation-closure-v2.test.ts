import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { hashCanonicalJson } from
  "../../src/product-compiler/canonical-json.js";
import {
  IMPLEMENTATION_CLOSURE_ARTIFACT_TYPE_V2,
  IMPLEMENTATION_CLOSURE_CONTRACT_HASH_V2,
  IMPLEMENTATION_CLOSURE_STORY_ENTRY_V2_SCHEMA,
  IMPLEMENTATION_CLOSURE_V2_BLOCKER_CODES,
  IMPLEMENTATION_CLOSURE_V2_SCHEMA,
  IMPLEMENTATION_CLOSURE_V2_VALIDATION_IDS,
  IMPLEMENTATION_CLOSURE_V2_VERSION,
  ImplementationClosureEnvelopeV2Schema,
  ImplementationClosureV2Schema,
  hashImplementationClosureProductDispositionV2,
  hashImplementationClosureStoryEntryV2,
  hashImplementationClosureStoryMembershipV2,
  hashImplementationClosureV2,
  recursivelyFreezeImplementationClosureV2,
  type ImplementationClosureEnvelopeV2,
  type ImplementationClosureHashPayloadV2,
  type ImplementationClosureStoryEntryHashPayloadV2,
  type ImplementationClosureStoryEntryV2,
  type ImplementationClosureV2,
} from "../../src/product-compiler/schemas/implementation-closure-v2.js";
import {
  hashImplementationSlicePacketBindingV2,
  type ImplementationSlicePacketBindingHashPayloadV2,
} from "../../src/product-compiler/schemas/implementation-slice-v2.js";
import { hashImplementationSourceMapStoryIdSetV2 } from
  "../../src/product-compiler/schemas/implementation-source-map-v2.js";
import { PRODUCT_BUILD_PACKET_CONTRACT_HASH_V4 } from
  "../../src/product-compiler/schemas/product-build-packet-v4.js";

const CONTRACT_HASH_GOLDEN =
  "fd1f42f47931580ef9186be701eaee542641f6394f9310a9ccd7f13cc6c75042";

function sha(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function packetBinding(storyIds: readonly string[]) {
  const packetProducer = {
    pass: "product-compiler-product-build-packet-v4" as const,
    codeSha: "abcdef0123456789",
    toolVersions: {
      implementationSourceMap: "2.0.0" as const,
      productBuildPacket: "4.0.0" as const,
    },
  };
  const identity: ImplementationSlicePacketBindingHashPayloadV2 = {
    artifactType: "setfarm.product-build-packet.v4",
    schema: "setfarm.product-build-packet.v4",
    version: "4.0.0",
    contractHash: PRODUCT_BUILD_PACKET_CONTRACT_HASH_V4,
    producer: packetProducer,
    packetHash: sha("packet"),
    envelopeHash: sha("packet-envelope"),
    envelopeByteLength: 2_048,
    sourceMapRoot: {
      artifactType: "setfarm.implementation-source-map.v2",
      envelopeHash: sha("source-map-envelope"),
      manifestHash: sha("source-map-manifest"),
      authorityHash: sha("source-map-authority"),
      merkleRoot: sha("source-map-merkle"),
      leafCount: storyIds.length,
      storyIdSetHash: hashImplementationSourceMapStoryIdSetV2(storyIds),
    },
  };
  return {
    ...identity,
    bindingHash: hashImplementationSlicePacketBindingV2(identity),
  };
}

function storyEntry(
  storyId: string,
  index: number,
): ImplementationClosureStoryEntryV2 {
  const storyHash = sha(`story:${storyId}`);
  const identity: ImplementationClosureStoryEntryHashPayloadV2 = {
    schema: IMPLEMENTATION_CLOSURE_STORY_ENTRY_V2_SCHEMA,
    story: { storyId, storyHash, order: index + 1 },
    sourceMap: {
      reference: {
        index,
        storyId,
        storyHash,
        leafEnvelopeHash: sha(`leaf-envelope:${storyId}`),
        byteLength: 1_024 + index,
      },
      proofHash: sha(`proof:${storyId}`),
      proofBindingHash: sha(`proof-binding:${storyId}`),
    },
    slice: {
      artifactType: "setfarm.implementation-slice.v2",
      schema: "setfarm.implementation-slice.v2",
      version: "2.0.0",
      envelopeHash: sha(`slice-envelope:${storyId}`),
      sliceHash: sha(`slice:${storyId}`),
      dispositionHash: sha(`disposition:${storyId}`),
    },
  };
  return { ...identity, entryHash: hashImplementationClosureStoryEntryV2(identity) };
}

function createClosure(): ImplementationClosureV2 {
  const storyIds = ["STORY-A", "STORY-B"];
  const entries = storyIds.map(storyEntry);
  const membershipHash = hashImplementationClosureStoryMembershipV2(entries);
  const dispositionIdentity = {
    mode: "generated_sources_complete_no_model_dispatch" as const,
    modelDispatch: "forbidden" as const,
    modelWritablePathRefs: [] as [],
    storyCount: entries.length,
    storyMembershipHash: membershipHash,
  };
  const identity: ImplementationClosureHashPayloadV2 = {
    schema: IMPLEMENTATION_CLOSURE_V2_SCHEMA,
    closureVersion: IMPLEMENTATION_CLOSURE_V2_VERSION,
    contractHash: IMPLEMENTATION_CLOSURE_CONTRACT_HASH_V2,
    stage: "every_story_slice_verified_before_candidate_source_v1",
    readiness: {
      status: "shadow_closed",
      productionUse: "forbidden",
      blockerCodes: [...IMPLEMENTATION_CLOSURE_V2_BLOCKER_CODES],
    },
    packet: packetBinding(storyIds),
    storySet: {
      storyCount: entries.length,
      storyIdSetHash: hashImplementationSourceMapStoryIdSetV2(storyIds),
      entries,
      membershipHash,
    },
    implementation: {
      ...dispositionIdentity,
      dispositionHash: hashImplementationClosureProductDispositionV2(
        dispositionIdentity,
      ),
    },
    validationIds: [...IMPLEMENTATION_CLOSURE_V2_VALIDATION_IDS],
  };
  return ImplementationClosureV2Schema.parse({
    ...identity,
    closureHash: hashImplementationClosureV2(identity),
  });
}

function createEnvelope(
  closure = createClosure(),
): ImplementationClosureEnvelopeV2 {
  return ImplementationClosureEnvelopeV2Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: IMPLEMENTATION_CLOSURE_ARTIFACT_TYPE_V2,
    producer: {
      pass: "product-compiler-implementation-closure-v2",
      codeSha: closure.packet.producer.codeSha,
      toolVersions: {
        implementationClosure: "2.0.0",
        implementationSlice: "2.0.0",
        implementationSourceMap: "2.0.0",
        productBuildPacket: "4.0.0",
      },
    },
    payload: closure,
  });
}

describe("ImplementationClosureV2 schema authority", () => {
  it("pins one compact every-and-only product closure contract", () => {
    assert.equal(IMPLEMENTATION_CLOSURE_CONTRACT_HASH_V2, CONTRACT_HASH_GOLDEN);
    const closure = createClosure();
    assert.equal(closure.storySet.storyCount, 2);
    assert.equal(
      closure.storySet.storyIdSetHash,
      closure.packet.sourceMapRoot.storyIdSetHash,
    );
    assert.equal(ImplementationClosureEnvelopeV2Schema.safeParse(
      createEnvelope(closure),
    ).success, true);
    assert.equal(
      JSON.stringify(closure).includes("/private/")
        || JSON.stringify(closure).includes("sourceRevision"),
      false,
    );
  });

  it("rejects missing, duplicate, extra and reordered story closure", () => {
    const closure = createClosure();
    for (const mutate of [
      (value: ImplementationClosureV2) => value.storySet.entries.pop(),
      (value: ImplementationClosureV2) => {
        value.storySet.entries[1] = clone(value.storySet.entries[0]!);
      },
      (value: ImplementationClosureV2) => {
        value.storySet.entries.push(storyEntry("STORY-C", 2));
      },
      (value: ImplementationClosureV2) => value.storySet.entries.reverse(),
    ]) {
      const changed = clone(closure);
      mutate(changed);
      assert.equal(ImplementationClosureV2Schema.safeParse(changed).success, false);
    }
  });

  it("allows internally rehashed candidates but exposes that parsing is not authority", () => {
    const closure = clone(createClosure());
    closure.storySet.entries[0]!.slice.envelopeHash = sha("forged-envelope");
    closure.storySet.entries[0]!.entryHash =
      hashImplementationClosureStoryEntryV2(closure.storySet.entries[0]!);
    closure.storySet.membershipHash =
      hashImplementationClosureStoryMembershipV2(closure.storySet.entries);
    closure.implementation.storyMembershipHash = closure.storySet.membershipHash;
    closure.implementation.dispositionHash =
      hashImplementationClosureProductDispositionV2(closure.implementation);
    closure.closureHash = hashImplementationClosureV2(closure);
    assert.equal(ImplementationClosureV2Schema.safeParse(closure).success, true);
    assert.notEqual(
      hashCanonicalJson(createEnvelope(closure)),
      hashCanonicalJson(createEnvelope()),
    );
  });

  it("rejects extra fields, producer drift and hostile depth", () => {
    assert.equal(ImplementationClosureV2Schema.safeParse({
      ...clone(createClosure()),
      retryInstruction: "try again",
    }).success, false);
    const envelope = clone(createEnvelope());
    envelope.producer.codeSha = "fedcba9876543210";
    assert.equal(ImplementationClosureEnvelopeV2Schema.safeParse(envelope).success,
      false);
    let hostile: unknown = { value: true };
    for (let index = 0; index < 220; index += 1) hostile = { nested: hostile };
    assert.equal(ImplementationClosureV2Schema.safeParse(hostile).success, false);
  });

  it("returns recursively immutable schema output when sealed", () => {
    const closure = recursivelyFreezeImplementationClosureV2(createClosure());
    const pending: unknown[] = [closure];
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === null || typeof current !== "object") continue;
      assert.equal(Object.isFrozen(current), true);
      pending.push(...Object.values(current));
    }
  });
});
