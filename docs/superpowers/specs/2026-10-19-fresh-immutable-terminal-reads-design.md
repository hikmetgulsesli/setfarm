# Fresh immutable terminal and finding publication reads

The actual full eight-case run on release `b35b4a4f` accepted its planner completion and released its runtime. Spawner outbox consumption and terminal cleanup then repeatedly failed with PostgreSQL `42501` on `operational_events`. Design eventually claimed and failed independently because Stitch configuration was absent. Preserve both originals; the event read defect does not explain the provider configuration failure.

The operational-delivery terminal resolver locks an immutable event before locking its mutable delivery and resolving the authenticated owner reservation. The fresh runtime intentionally has SELECT/INSERT but no UPDATE on this immutable table. PostgreSQL row locking consequently refuses before the owner checks. The adjacent finding terminal resolver and normal finding publication have the same mismatch on `finding_sets` and `findings`.

## Scoped design

For the actual captured selected-fresh mode, read these immutable rows without row locks. Use only the existing fixed selection leaf; add no caller flag, environment bypass, SQL substitution or authority callback. Preserve the legacy tagged-template queries and their row locks exactly. Preserve every mutable delivery, owner-reservation, run, head, claim and runtime lock; all exact identity, count, hash, terminal status, ownership, activation and reservation checks remain mandatory.

Do not grant immutable UPDATE, DELETE or TRUNCATE, change canonical migrations, fabricate owner sidecars, repair the failed installation, or accept an unauthenticated terminal close. The immutable tables retain their existing canonical triggers and runtime role denials.

## Evidence and test boundary

Record real restricted-role RED before production changes. The operational test calls the actual public resolver with a real owned PostgreSQL transaction and component event/delivery rows but deliberately no owner sidecar. The correct post-fix result is the unchanged `INTERNAL_PRODUCTION_OPERATIONAL_DELIVERY_OWNER_UNAVAILABLE`, after the immutable read and mutable delivery lock. This is an authority refusal, not a fabricated successful close. A separately extracted whole production projection exercises exact terminal identities, states and hashes on real rows. A held delivery row must still produce `55P03`; legacy mode must still produce `42501`; immutable DML and replication bypass must stay denied.

The finding regression exercises normal publication and its terminal projection with the same real restricted-role boundary. Source components and schema-only test fixtures do not establish compiled operational readiness or issued owner capability. Actual authentic public terminal close remains a post-merge release-bound runtime qualification.

## Alternatives

Giving the runtime an UPDATE column merely to obtain row locks would broaden immutable authority. Changing all modes would alter legacy behavior. Selected-only nonlocking immutable reads retain the intended fresh grants and existing authority validation with the smallest effect.
