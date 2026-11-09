# Native GitHub review implementation authority

Actual Source250 run1b8ac923 produced a first-generation implementation with owned8/8 PASS and an accepted supervisor pass. VERIFY10 then failed before worker binding: its persisted observation records PRODUCT_BUILD_PACKET type setfarm.product-build-packet.v3 versus the historical reader expected v1 or v2. This occurs only when an open PR has actionable review threads and default GitHub review routing loads implementation authority. Read-only proof c4b62997be1e5473c3179fb9a025ae33aa619c628545a54a1d88a4194f2f714e additionally authenticates the same producer/index/CAS and valid legacy native SliceV2; the next hardcoded SliceV1 guard would refuse it too.

## Design

Change only the existing default authority loader in src/findings/v3-github-review-router.ts. Use existing readExactSealedPacket, whose closed dispatch validates legacy packets and native PacketV3. Select exactly one slice family from the authenticated packet family: native PacketV3 requires setfarm.implementation-slice.v2 parsed by LegacyImplementationSliceV2Schema from implementation-slice-v2-legacy.js; legacy packets require existing SliceV1/schema. Do not import the newer canonical PacketV4 SliceV2 schema, enable model dispatch there, catch/refallback from reader refusal, or weaken artifact readers.

Keep all existing index/CAS envelope type/bytes/producer checks; require one terminal implementation attempt, done story, completed claim, exact packet/story/slice/current PR head and source-after tree. Keep ownership limited to owned/shared_writable sealed file paths. Native schema preserves its source-map/owned-reference/shared-grant closure. Project evidence IDs from native slice.contract.product.evidencePredicates; legacy retains requiredEvidence IDs. Inspect actual field names, sort the existing IDs, and never invent materialized check IDs. Native slice sourceRevision is its initial base; it must not be incorrectly required to equal accepted source-after/PR head.

This is the smallest causal platform fix for routing actual GitHub feedback to the existing repair mechanism. No generated-project rescue, thread resolution, permission/role/provider/retry/gate change, publisher/dispatcher redesign, future PacketV4 feature or live action is part of implementation.

## Acceptance

- Real default loader/body accepts a valid native PacketV3/legacy SliceV2 terminal authority and returns exact owned paths, accepted head/tree and native evidence IDs.
- Legacy packet/SliceV1 behavior remains intact.
- Crossed packet/slice families, producer/CAS/index/identity/current-head drift, duplicate/missing terminal authority, unknown/shared_readonly review paths remain refused.
- Existing real schemas/fixture producers are used. A router test that stubs loadImplementationAuthority does not cover this defect.
- Genuine regression RED before production, focused GREEN and production no-emit; Root reviewed normal PR delivery and clean merged-main stock build precede any separate guarded rollout/clean run. Existing main-only build guard remains unchanged.
