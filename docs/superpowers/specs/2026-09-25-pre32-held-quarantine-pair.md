# Pre32 held quarantine pair V5

Status: diagnostic-only continuation of the positive physical-plus-PostgreSQL ownership work. V1 cutover guards and the V4 host-pair contract remain unchanged.

## Decision

The V5 database census added on main `b678b969` includes quarantined runtime sessions in the same read-only transaction as the legacy census and active rows. The separate host query showing zero quarantined sessions is not held with the physical interval, so it cannot close that evidence gap.

Add a versioned V5 held host pair. Invoke the V5 database observer exactly once between the physical catalog's first and second passes, through the existing passive-qualified launcher. Validate the entire V5 database snapshot, including its hash, strict schema, legacy-zero census, active-row hash/count equality, and a canonical nonnegative safe-integer quarantine count. Preserve every physical entry and blocker. Bind the complete physical catalog and V5 database snapshot into a frozen diagnostic-only pair/hash. A positive quarantine count remains visible and cannot be interpreted as zero owner.

Expose this only through a new authenticated bootstrap command, retaining the V4 command and response unchanged. The new response and refusal phase use the same finite, redacted bootstrap boundary. It must not publish raw database errors, credentials, paths, or PIDs in a refusal. No owner classification, admission, controller, journal, or runtime state changes are authorized by this observation.

## File map

- `src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts`: held, private-URL V5 census method beside V4.
- `src/internal-production/baseline-positive-worktree-host-pair-v2.ts`: V5 validation, held pairing, zero-input code-owned diagnostic observer.
- `scripts/deployment-cutover.mjs`: new authenticated V5 inspect mode with exact response validation and finite refusal.
- Corresponding internal-production and bootstrap tests: RED/GREEN for ordering, count tampering, nonzero count, repeated callback, cleanup, and publication boundary.
