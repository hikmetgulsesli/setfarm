# Task6A V2 OpenClaw stale-sweep refusal plan

1. Confirm isolated clean main `b381350e`; preserve all other worktrees and
   selected historical service/build/link.
2. Add failing AST/extracted tests for the interval check before cleanup and
   for the restart helper's check after awaited restart but before resweep,
   including shutdown interleavings. Observe RED.
3. Add the two existing V2 assertion calls, shutdown rechecks and detached
   rejection catch. Observe GREEN; preserve existing cleanup/restart gates.
4. Run focused/pure/cutover/relevant spawner tests, TypeScript and source
   contracts; get independent read-only review. Isolated PostgreSQL tests
   lacking private admin credentials remain unrun.
5. Commit/push scoped PR, SHA-condition merge, clean-main build and sanitized
   no-write host check. Record in-flight/direct/continuous-fence gaps.
