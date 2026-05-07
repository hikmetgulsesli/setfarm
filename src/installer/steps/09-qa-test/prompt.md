# QA Test Step — Browser, Visual, and Functional Test Agent

Test the project after verify and security-gate. Open the live app in a browser,
prove that acceptance criteria work at runtime, traverse routes and controls,
capture screenshots, and write one batch QA report. Do not edit application
code. Do not stop on the first issue; finish the sweep, then report all issues
together so implement can fix them in one batch.

## Context

- `{{REPO}}`: project root
- `{{BRANCH}}`: feature branch
- `{{STORIES_JSON}}`: implemented stories
- `{{FINAL_PR}}`: PR URL
- `{{PROGRESS}}`: project status

## Test Scenarios

0. **Branch policy**: for `merge_strategy: pr-each` / `verify_each`, QA runs on
   merged `main`, not on the old run branch:
   - `cd {{REPO}}`
   - `git fetch origin main`
   - `git checkout main`
   - `git pull --ff-only origin main`
   - run build/test commands on this current `main`.
   - do not commit or push QA findings. Write `quality-reports/qa-test-1.md`
     and reference it in step output as `QA_REPORT`.
1. Build and dev server start cleanly.
2. Main happy path satisfies every story acceptance criterion.
3. Route/link traversal: every visible link, sidebar item, topbar tab, hash
   route, and back/return path works without losing the user.
4. Interaction matrix: every visible button, icon-button, toggle, checkbox,
   form submit, modal open/close, delete/cancel, and navigation action produces
   real URL/DOM/state/localStorage change or is intentionally disabled.
5. Edge cases: empty state, long text, rapid clicks, localStorage cleared.
6. Responsive: desktop 1440x900 and mobile 375x667.
7. Design/Stitch fit: if `stitch/` or another reference exists, compare the
   running app against the reference for layout, tokens/classes, spacing,
   modal/sidebar/header behavior, and major visual hierarchy.
8. Dark mode if supported.
9. Keyboard navigation: Tab reaches every interactive element.
10. Console: capture warnings/errors.
11. Icon-only controls: click them too. If click does not change visible state,
    dialog/panel, URL, localStorage/app state, or DOM, return `STATUS: retry`.

## Required Dev-Server Lifecycle

Do not start the dev server with uncontrolled `npm run dev & ...`. Use this
pattern. The `trap` must be in the same shell and the server process group must
shut down. `--strictPort` is required: if port 5173 is already occupied, fail
fast instead of letting Vite silently move to 5174/5175 and testing the wrong
server instance.

```bash
cd {{REPO}}
git fetch origin main
git checkout main
git pull --ff-only origin main
npm run build
PORT=5173
LOG=/tmp/setfarm-qa-devserver-{{BRANCH}}.log
setsid npm run dev -- --host 127.0.0.1 --port "$PORT" --strictPort >"$LOG" 2>&1 &
DEV_PID=$!
trap 'kill -- "-$DEV_PID" 2>/dev/null || kill "$DEV_PID" 2>/dev/null || true; wait "$DEV_PID" 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo "SERVER_FAIL: dev server exited before binding $PORT"
    tail -80 "$LOG"
    exit 1
  fi
  curl -sf "http://127.0.0.1:$PORT/" >/dev/null && break
  sleep 1
done
curl -sf "http://127.0.0.1:$PORT/" >/dev/null || { echo "SERVER_FAIL"; tail -80 "$LOG"; exit 1; }
grep -q "Local:.*127.0.0.1:$PORT" "$LOG" || { echo "SERVER_FAIL: dev server did not bind requested port $PORT"; tail -80 "$LOG"; exit 1; }
# Browser/DOM checks here. Finish within 10 minutes.
```

Do not leave `vite`, `serve`, or Chromium processes running after the test.

## Required QA Report

Create `quality-reports/qa-test-1.md`. Create the directory if needed. The
report must contain:

- `Summary`: decision and confidence.
- `Environment`: commit/branch, build command, test command, dev server port.
- `Routes Tested`: each route/link, expected result, observed result.
- `Interactions Tested`: selector or visible name, action, result for every
  button/link/form/toggle/modal.
- `Screenshots`: desktop and mobile screenshot paths.
- `Console`: warning/error summary.
- `Visual/Layout Findings`: overflow, overlap, raw CSS/token, modal/sidebar/header issues.
- `Functional Findings`: broken link, no-op button, wrong state, lost route,
  failing save/delete/back behavior.
- `Batch Fix Plan`: items for the implement agent to fix in one pass.

This report is a batch-fix input, not a reason to create one retry per issue.

## Output Format

```
STATUS: done|retry|skip|fail
QA_REPORT: quality-reports/qa-test-1.md
QA_SCREENS_TESTED: <number>
QA_ROUTES_TESTED: <number>
QA_INTERACTIONS_TESTED: <number>
QA_TOTAL_ISSUES: <number>
TEST_FAILURES: <batch issue list when STATUS is retry>
ISSUES: <optional extra observations>
```

Use `STATUS: done` only when the report exists and includes route, screen, and
interaction evidence. If using `STATUS: retry`, put all findings into
TEST_FAILURES or ISSUES as one batch.
