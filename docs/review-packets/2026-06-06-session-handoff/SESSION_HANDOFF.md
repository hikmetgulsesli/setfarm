# Setfarm + Mission Control Session Handoff

Date: 2026-06-06 18:14 Europe/Istanbul

## Purpose

This handoff is for continuing Setfarm + Mission Control work in a fresh session. The current session is very large and may bias reasoning. Treat this file as the operational starting point, then verify all live state from the local repo and database before acting.

## Ground Rules

- Work in `/Users/setrox/ai/openclaw/setfarm-repo`.
- Local repo and live PostgreSQL DB are authoritative. Do not rely only on this document.
- Think systemically. Do not hardcode project-specific fixes.
- Always perform live DB analysis before judging run state.
- Generated projects are separate repos/runs. Do not confuse one run with another.
- If a running generated project exposes a platform bug, fix Setfarm/MC first, then recover or replay the run.
- Avoid adding more reactive guards unless the layer is correct. Prefer mechanical evidence, state machine correctness, and stack-pack-owned rules.

## Current Architecture Direction

Setfarm should behave as a contract-driven software factory:

- LLM agents produce bounded artifacts and code.
- Setfarm owns filesystem scope, build/test execution, PR state, runtime evidence, and completion decisions.
- Mission Control should display derived state from observations/events, not agent claims.
- Supervisor should be a bounded coherence/evidence gate, not an unbounded code fixer.
- Platform self-heal should remain controlled by env/mode; plan-only and tightly bounded patching only. Never let it weaken invariant tests.

## Important Recent Changes

Recent work touched many files. The repo is intentionally dirty. Do not revert unrelated changes.

Relevant changes from the latest PR lifecycle work:

- `src/installer/steps/07-verify/pr-comments.ts`
  - `COMMENTED` review summaries from Gemini Code Assist can now block if actionable.
  - Stale `COMMENTED` summaries are ignored when they belong to an older commit than the PR head.
  - GraphQL review threads are fetched to read `isResolved` / `isOutdated`.
  - Mechanically satisfied inline review threads can be resolved by Setfarm.
  - New reducer pattern recognition: `INITIATE_SEQUENCE` + `gameOver` + reset comments are satisfied when code has a `state.gameOver` branch using `createInitialState()` and resetting to gameplay.
- `src/installer/step-ops.ts`
  - Verify path fetches PR comments before merge/verification.
  - It attempts to resolve mechanically satisfied inline review threads before re-routing the story.
  - PR review settle delay was added earlier so auto-merge does not race Gemini review arrival.
- `tests/steps/07-verify.test.ts`
  - Tests cover actionable COMMENTED summaries, stale summary suppression, current inline comments, and mechanically satisfied reducer reset comments.

Verification already run:

```bash
SETFARM_SKIP_RUNTIME_GUARD=1 SETFARM_ALLOW_DIRTY_BUILD=1 npm run build
SETFARM_SKIP_RUNTIME_GUARD=1 SETFARM_ALLOW_DIRTY_BUILD=1 node --import tsx --test tests/steps/07-verify.test.ts tests/claim-log-lifecycle.test.ts tests/error-taxonomy.test.ts
```

Result: build passed; targeted tests passed `98/98`.

## Live Run To Inspect First

Latest run:

- Run number: `#862`
- Run id: `76a0b663-9d3c-4ecd-8169-47e5222a923c`
- Project: `FluxRail Lite`
- Local project dir: `/Users/setrox/projects/fluxrail-lite-76a0b663`
- GitHub repo: `hikmetgulsesli/fluxrail-lite-76a0b663`
- US-001 PR: `https://github.com/hikmetgulsesli/fluxrail-lite-76a0b663/pull/1`
- Story branch: `76a0b663-us-001`

Current DB snapshot before handoff:

- Run #862 status: `running`
- US-001 status: `failed`
- US-001 retry count: `6/5`
- US-002 / US-003: `pending`

Why US-001 failed:

- Old PR parser logic repeatedly treated a Gemini inline review thread as still open.
- The code on the PR branch already contains the requested reducer fix.
- New dist can identify the thread as mechanically satisfied:

```bash
node --input-type=module -e "import { fetchPrState, getMechanicallySatisfiedInlineReviewThreadIds } from './dist/installer/steps/07-verify/pr-comments.js'; const st = await fetchPrState('https://github.com/hikmetgulsesli/fluxrail-lite-76a0b663/pull/1'); console.log(getMechanicallySatisfiedInlineReviewThreadIds(st, '/Users/setrox/projects/fluxrail-lite-76a0b663'));"
```

Expected output:

```text
[ 'PRRT_kwDOSy2ovs6Hkbpe' ]
```

This means the platform fix is in place, but #862 needs operational recovery because retry exhaustion happened before the fix was active.

## First Commands In New Session

Run these before making decisions:

```bash
cd /Users/setrox/ai/openclaw/setfarm-repo

psql postgresql://postgres@localhost:5432/setfarm -x -c "
select run_number,id,status,left(task,240) task,updated_at
from runs order by run_number desc limit 8;"

psql postgresql://postgres@localhost:5432/setfarm -x -c "
select step_id,status,current_story_id,left(coalesce(output,''),1200) output,updated_at
from steps
where run_id='76a0b663-9d3c-4ecd-8169-47e5222a923c'
order by step_index;"

psql postgresql://postgres@localhost:5432/setfarm -x -c "
select story_id,status,retry_count,max_retries,story_branch,pr_url,left(coalesce(output,''),1200) output,updated_at
from stories
where run_id='76a0b663-9d3c-4ecd-8169-47e5222a923c'
order by story_index;"

psql postgresql://postgres@localhost:5432/setfarm -x -c "
select id,step_id,story_id,agent_id,outcome,abandoned_at,duration_ms,left(coalesce(diagnostic,''),900) diagnostic,claimed_at
from claim_log
where run_id='76a0b663-9d3c-4ecd-8169-47e5222a923c'
order by claimed_at desc limit 20;"

gh pr view 1 --repo hikmetgulsesli/fluxrail-lite-76a0b663 \
  --json state,createdAt,comments,reviews,commits,statusCheckRollup,mergeStateStatus,mergeable,url

node --input-type=module -e "
import { fetchPrState, formatPrCommentsForAgent, getMechanicallySatisfiedInlineReviewThreadIds } from './dist/installer/steps/07-verify/pr-comments.js';
const st = await fetchPrState('https://github.com/hikmetgulsesli/fluxrail-lite-76a0b663/pull/1');
console.log(formatPrCommentsForAgent(st));
console.log('mechanically satisfied:', getMechanicallySatisfiedInlineReviewThreadIds(st, '/Users/setrox/projects/fluxrail-lite-76a0b663'));
"
```

## Suggested Recovery For #862

Do not immediately start a new run until #862 is understood.

If the mechanically satisfied thread id is still detected:

1. Let Setfarm resolve it through the normal verify path if possible.
2. If the story is already terminally failed due to old parser retry exhaustion, perform a documented operational recovery:
   - reset only US-001 from `failed` to a retryable state,
   - keep the existing PR/branch,
   - do not delete evidence,
   - add an observation explaining the recovery was caused by a deployed platform parser fix.
3. Re-run/continue verify so the new code resolves the thread and merges the PR.

Avoid manual GitHub thread resolution unless you first verify Setfarm cannot recover it mechanically.

## Project Design/File Checks Already Known

For #862 setup:

- Generated screen validator passed after setup-build.
- Expected generated screens exist:
  - `src/screens/GameSettingsFluxrailLite.tsx`
  - `src/screens/GameplayFluxrailLite.tsx`
  - `src/screens/SCREEN_INDEX.json`
  - `src/screens/index.ts`
- `SCREEN_INDEX.json` includes gameplay/settings actions.

Still inspect these in the new session:

```bash
node scripts/generated-screen-validator.mjs /Users/setrox/projects/fluxrail-lite-76a0b663 --json
find /Users/setrox/projects/fluxrail-lite-76a0b663/src -maxdepth 3 -type f | sort
git -C /Users/setrox/projects/fluxrail-lite-76a0b663 log --oneline --decorate --graph --all -12
git -C /Users/setrox/projects/fluxrail-lite-76a0b663 diff main..76a0b663-us-001 --stat
```

## Known Open System Risks

- Implement evidence is still too advisory in some paths. US-001 initially passed code/build while implement evidence reported missing/insufficient flows. This is directly related to generated games looking visually present but behaviorally weak.
- Supervisor can still hit bounded audit violations. Current run has a `SUPERVISOR_BOUNDED_AUDIT_VIOLATION` observation from broad source review without timely STATUS/output.
- Mission Control can show noisy failed/cancelled projects; user expects failed/cancelled cards hidden or clearly filtered.
- PR lifecycle must keep using live GitHub/DB state. Do not trust stale `stories.output`.

## New Session Prompt

Use this exact prompt in the next session:

```text
This session is Setfarm + Mission Control only. Ignore old OpenClaw/server legacy topics unless local repo state requires them.

Work in /Users/setrox/ai/openclaw/setfarm-repo. Start by reading docs/review-packets/2026-06-06-session-handoff/SESSION_HANDOFF.md, then verify live repo/DB state yourself.

Priority:
1. Live DB analysis first: runs, steps, stories, claim_log, run_observations for latest run #862 (id 76a0b663-9d3c-4ecd-8169-47e5222a923c).
2. Inspect PR #1 in hikmetgulsesli/fluxrail-lite-76a0b663. Confirm whether the remaining Gemini review thread PRRT_kwDOSy2ovs6Hkbpe is mechanically satisfied by the current branch code.
3. If satisfied, recover #862 without project-specific hardcoding: use Setfarm’s PR comment resolution path or a clearly logged operational recovery if retry exhaustion happened before the parser fix.
4. Re-run build/targeted tests before restarting spawner.
5. Inspect FluxRail Lite design/file generation: PRD, DESIGN artifacts, SCREEN_INDEX, generated screens, App.tsx wiring, implement evidence, runtime bridge, and whether gameplay/settings design is actually used.
6. Only after #862 is stable or clearly documented as blocked, decide whether to start a new project run.

Rules:
- Do not revert dirty user/repo changes.
- Do not add project-specific hardcode.
- Think systemically: PR lifecycle, evidence gates, runtime behavior, Mission Control visibility.
- Always report what was verified from live DB/GitHub, not just code assumptions.
- If you edit files, use apply_patch and run focused tests.
- Keep self-heal/auto-fix bounded; do not enable unsafe patch_and_resume behavior.
```

