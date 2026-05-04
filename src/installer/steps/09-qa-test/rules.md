# QA Test Rules

## Retry Triggers

- Build fails or the dev server crashes.
- Main happy path is broken.
- Acceptance criteria are not satisfied at runtime.
- Runtime `console.error` spam.
- Critical button/form/link/navigation action is broken.
- localStorage persistence is broken after reload.
- Responsive layout is broken at 1440x900 or 375x667.
- A visible active control is a no-op.

## Pass Criteria

- Every story acceptance criterion has runtime evidence.
- Build and dev server are clean.
- Happy path and at least 1-2 edge cases work.
- Route/link/back navigation works.
- Interaction matrix has no critical no-op controls.
- Console is clean or only has harmless dev warnings.

## Skip Criteria

- Pure library/no UI project.
- Documentation/config-only change.

## TEST_FAILURES Format

Every item must include screen/component + action + expected vs actual:

```
TEST_FAILURES:
- Dashboard: clicking "Add note" expected a note modal, actual no DOM or URL change.
- Sidebar: "Trash" expected trash route, actual URL changed but content stayed on dashboard.
- Mobile 375x667: settings panel overflows horizontally by ~150px.
```
