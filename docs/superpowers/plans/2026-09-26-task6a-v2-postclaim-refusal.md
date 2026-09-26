# Task6A V2 post-claim refusal plan

1. Start isolated clean main `ee8a4301`; preserve all existing worktrees.
2. Add failing test proving a found claim rechecks after `claimStep` and
   refuses before post-claim effects without calling the release path.
3. Insert the existing no-write V2 assertion and shutdown recheck outside
   post-claim `try/finally`. Review found shutdown quarantine and legacy
   no-runtime exceptions; add RED tests, exact reserved-session shutdown
   retention, and explicit diagnostic-only treatment of unbound legacy claims.
   Observe GREEN; retain no-work and permitted flows.
4. Run focused, pure/cutover, relevant spawner, TypeScript and source-contract
   checks; obtain independent read-only review.
5. Deliver scoped PR, review exact head, SHA-condition merge, build a fresh
   preserved clean-main deployment if retention capacity requires it, and run
   sanitized no-write host diagnostic. Record in-flight and continuous-fence
   gaps.
