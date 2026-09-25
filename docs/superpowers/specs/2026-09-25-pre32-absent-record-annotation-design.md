# Pre-32 absent Git-record annotation design

Status: a narrow continuation of the owner-approved preserved-deployment cutover. This is diagnostic evidence, not cutover authority.

## Problem and decision

The held V6 physical/DB pair preserves 269 physical catalog blockers. On the current host, 263 are `prunable-git-worktree` records whose direct discovery base is absent in both physical passes. The V3 absence witness already recognizes that exact relationship, but it is tied to a separate V2 database observation. A V6 consumer cannot infer that the V3 result was observed in its own database interval.

Add a separately versioned, code-owned V6 annotation that derives the existing V3 witness from the **same** V6 held pair. Keep every original blocker and candidate visible. Identify only direct-child prunable records under a V6-bracketed absent base as `witnessed-absent-record`; report all other blockers unchanged. The annotation does not claim those paths are permanently absent or that their Git records can be pruned.

## Trust and alternatives

The V6 database census has zero active rows on this host, but this is point-in-time diagnostic evidence, not an owner-exclusion lease. A witness for a missing discovery base is not a producer-authenticated receipt for a present execution worktree. A self-hashed caller receipt is also not such a receipt. Therefore the annotation cannot emit `zeroOwner`, `cutoverReady`, `physicalIdentityProvenance: verified`, or a V1-compatible guard.

Reusing a prior V3 observation would cross temporal intervals and is rejected. Deleting stale Git worktree records would violate the preservation requirement and is rejected. Treating all path strings with no active DB row as nonowners is rejected: running writers, process references, and physical identity remain unproven.

The future positive-owner producer needs a separate durable receipt: a code-owned post-attempt/session-bind physical/source capture, PostgreSQL-pinned claim/attempt generation/fence/session, and a pre-spawn recheck. Current migrations 32 and 33 are behind the guarded pre-32 transition. An eventual migration 34 cannot be applied to bypass the pre-32 census, and historical worktrees cannot be retroactively blessed. This annotation does not implement that producer.

## Qualification

Tests must prove one held V6 pair supplies both the database and absence witness; direct-child-only classification; exact counts and preservation of the original blockers; malformed/crossed V6 evidence and observer failure refuse. The inherited physical-catalog test for optional-base appearance/replacement across its callback remains the absent-base drift gate. V3 canonicalizes duplicate source records to unique witness roots; the annotation rejects a duplicate witness if that producer contract changes. An authenticated host run must report original 269 blockers, any witnessed subset and remaining blockers without a cutover/zero-owner success label. No migration, service change, cleanup, receipt publication, guard modification, or historical dist replacement is in scope.
