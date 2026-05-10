# Final Test Rules

## Pass Criteria

- `npm run build` exits 0.
- smoke-test.mjs passes all phases or step-ops confirms equivalent pass.
- Design fidelity has no structural gap.
- Import consistency passes.
- SMOKE_TEST_RESULT contains the final summary.

## Retry Triggers

- Build failure.
- Smoke test phase failure.
- Design fidelity failure.
- Smoke output contains a clear FAIL.
- Runtime smoke finds broken route/link/button behavior.
- Smoke output reports `SEMANTIC_CLICK_ISSUES`, `WEAK_INTERACTION_ASSERTIONS`,
  `semanticClickIssues`, or `weakInteractionAssertions` greater than 0.

## Fail Criteria

Only unrecoverable infrastructure issues: corrupt node_modules, disk full, or
both project-local and platform smoke-test.mjs are missing. Normal product bugs
are retry, not fail.

Missing project-local `scripts/smoke-test.mjs` alone is not fail; use the
platform smoke script.

## Skip Criteria

- Documentation-only repo.
- Explicit manual skip with reason.

## TEST_FAILURES Format

```
TEST_FAILURES:
- Phase 3 (build): tsc error at src/App.tsx:42 "Property '<domainField>' does not exist on type"
- Phase 8 (a11y): primary interactive component lacks focus behavior
- Phase 16 (design fidelity): one SCREEN_MAP screen is not rendered
```

## SMOKE_TEST_RESULT

Use the smoke-test final line or a concise summary:
- `pass (16/16 phases, 0 warnings)`
- `fail: Phase 3 build — tsc 2 errors`
- `auto-derived: pass (step-ops ran smoke-test.mjs on agent's behalf)`
