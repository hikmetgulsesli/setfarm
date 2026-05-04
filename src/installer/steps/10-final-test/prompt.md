# Final Test Step — End-to-End Smoke Agent

Final validation after QA-test. Run and evaluate `npm run build` and
`scripts/smoke-test.mjs`, then decide whether the project is merge-ready. This
is the merge gate; if it fails, deploy must not run.

## Context

- `{{REPO}}`: project root
- `{{BRANCH}}`: feature branch before merge
- `{{FINAL_PR}}`: final PR URL when present
- `{{STORIES_JSON}}`: all stories
- `{{PROGRESS}}`: project status

## Checks

0. **Main sync**: for `merge_strategy: pr-each` / `verify_each`, final-test
   tests merged `main`, not the old run branch:
   - `cd {{REPO}}`
   - `git fetch origin main`
   - `git checkout main`
   - `git pull --ff-only origin main`
   - do not commit/push final-test output.
1. **Build pass**: `npm run build` exits 0. Errors are not acceptable; small
   warnings are acceptable only when clearly harmless.
2. **Smoke test**:
   ```bash
   SMOKE_SCRIPT="$HOME/.openclaw/setfarm-repo/scripts/smoke-test.mjs"
   [ -f scripts/smoke-test.mjs ] && SMOKE_SCRIPT="$PWD/scripts/smoke-test.mjs"
   node "$SMOKE_SCRIPT" "$PWD"
   ```
3. **Design fidelity**: structural/wiring gaps are blocking.
4. **Import consistency**: no duplicate import dirs or broken imports.
5. **Main branch clean**: merged main is not broken.

## Output Format

```
STATUS: done|retry|skip|fail
SMOKE_TEST_RESULT: <summary line, e.g. "pass (16/16 phases)" or "fail: Phase 3 build">
TEST_FAILURES: <list when retry/fail>
```

`STATUS: done` requires SMOKE_TEST_RESULT. Copy the final smoke summary or write
a concise equivalent.
