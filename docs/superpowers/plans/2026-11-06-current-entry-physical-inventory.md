# Current entry physical inventory correction

**Goal:** Continue the existing canonical installation without a new isolated installation, retaining the poisoned predecessor and every runtime guard.

**Evidence:** The real `prepare-current-entry` process 97055 exited 1 at `exact-poison quarantined inventory hash is crossed`. All ten directory inodes, owners, modes and topology and all five original file identities, hashes, sizes, modes and link counts still match. Only the mounted device changed from 16777230 to 16777233. The actual current inventory hash is `cc0c4e2548653752a8abf20ade992140b740cd2b8941cc022082a0cb72cb4842`. This proves an exact second physical snapshot, not persistent volume identity.

**Design:** Preserve the historical inventory hash and identities. Add one closed, reviewed current physical profile, binding the observed hash to the same five file inodes/owners on device 16777233. Accept a profile only as its complete matching hash and identity tuple. The full directory/file inventory hash, authenticated workspace, live descriptor stability, source/build/PBA, zero-owner bracket, successor publication and migration gates remain mandatory. New proofs carry the actual selected hash and device; old proofs retain their original values. Unknown devices, mixed profiles, altered inodes/bytes/owners/modes/topology and changed live descriptors refuse. No caller-selected mapping, normalization, deletion or permission grant is introduced.

The alternative of normalizing the live device to the historical value would produce false physical evidence. A general reboot/volume identity protocol would exceed this causal fix. This correction intentionally admits only the two exact snapshots and makes no promise about an unknown future mount.

**File Map:**

- `src/internal-production/baseline-post-handoff-receipt-v1.ts`: closed profile selection in proof/disposition parsing, original inventory admission, retained original reopening and evidence production.
- `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`: old/new profile compatibility, mixed and unknown tuple refusal, actual descriptor inventory and retained evidence coverage.
- This plan: causal scope, verification and operational limits.

- [x] Record a failing regression before implementation: original 98397 exited 1 before the profile selector existed; actual canonical prepare 97055 independently reproduced the inventory refusal.
- [x] Apply the smallest coherent profile change at all consumers.
- [x] Run focused profile/inventory/publisher checks and TypeScript verification: 99621 exited 0, six checks, no skips; 98685 TypeScript noEmit exited 0. The second-profile publisher test reopens real original descriptors, checks the actual retained evidence and rejects a fully rehashed crossed disposition/proof.
- [ ] Review the exact diff, deliver through a normal PR and build clean source.
- [ ] Resume the existing canonical current-entry controller; classify its actual next result before any service replacement. No additional isolated installation or model canary.
