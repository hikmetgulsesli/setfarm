# Task6A V2 claim-maintenance refusal plan

1. Confirm isolated clean main `ebc21778`; preserve all historical,
   development and deployment trees.
2. Add failing AST/extracted tests for guard-before-catch/effects, rejection
   propagation, post-await lifecycle recheck and detached timer rejection
   handling. Observe RED.
3. Add the existing V2 assertion at maintenance entry, a post-await lifecycle
   recheck, and a bounded detached-timer catch. Update the pinned source test
   to require the guarded timer shape. Observe GREEN.
4. Run focused/pure/cutover/relevant spawner tests, TypeScript and source
   contracts, and independent read-only review. Isolated PostgreSQL tests
   without private admin credentials remain unrun.
5. Commit/push scoped PR, SHA-condition merge, clean-main build and sanitized
   no-write host check. Retain separate LISTEN/OpenClaw/in-flight and
   continuous-writer-fence gaps explicitly.
