# Changelog

This repository now keeps agent-facing operational notes in English only.

## 2.3.73 - 2026-05-18

- Repaired the installer compatibility path so stale non-git legacy runtimes are backed up and replaced with a link to the active Setfarm install root.
- Added regression coverage for the legacy runtime link guard so local and server dashboards cannot silently keep executing old Setfarm code.
- Kept release metadata advancing with the runtime repair.

## 2.3.72 - 2026-05-18

- Normalized operator-facing dashboard statuses so `N/A` and skipped states never appear as visible pipeline outcomes.
- Hardened Stitch recovery tests around explicit MCP tool errors and empty cached project regeneration.
- Kept repeated Stitch progress heartbeats from flooding activity feeds while preserving live state updates.

## 2.3.71 - 2026-05-18

- Kept run-contract idle implementation checkpoints pending instead of emitting not-applicable status.
- Normalized skipped story evidence to failure in operator-facing contract data so skipped work is never counted as complete.
- Updated the built-in Setfarm dashboard to stop treating skipped stories or steps as completed progress.

## 2.3.70 - 2026-05-18

- Made the QA dev-server lifecycle authoritative over external browser-testing examples so agents do not reuse fixed sample ports or wrong-app URLs.
- Exported `DEV_SERVER_URL` and `QA_URL` in the QA lifecycle template so browser scripts use the currently allocated project server.
- Added regression coverage for QA prompt guidance that avoids invalid Playwright `expect` imports and broken temp-script patching loops.

## 2.3.69 - 2026-05-18

- Passed story scope files into story-scoped supervisor checkpoints so manager fixes use the same write boundary as implementation stories.
- Wrote `.story-scope-files` into supervisor story worktrees before claims so the bootstrap summary and platform commit guard agree on safe edits.
- Added regression coverage proving supervisor prompts carry `SCOPE_FILES`, shared context, and the scope reminder.

## 2.3.68 - 2026-05-18

- Replaced stale failure output when a story becomes verified so Mission Control does not show old blockers as current failures.
- Stored reviewer or auto-verify evidence in verified stories for clearer run-contract history.
- Added regression coverage for clearing stale PR/retry output after verification.

## 2.3.67 - 2026-05-18

- Added review thread IDs to PR feedback so retry context identifies the exact current GitHub inline thread.
- Added a retry-after-fix thread resolution gate: after a PR review retry produces a clean candidate, Setfarm resolves current inline review threads before normal verify and merge gates continue.
- Clarified PR review retry guidance so implementation fixes code while Setfarm owns thread cleanup and merge control.

## 2.3.66 - 2026-05-18

- Switched PR review comment gating to GitHub review thread metadata so resolved or outdated inline threads are not treated as fresh blockers.
- Stopped treating COMMENTED review summaries as blocking review feedback when no current inline thread or CHANGES_REQUESTED review remains.
- Added verify regression coverage for resolved, outdated, current inline, and changes-requested PR review states.

## 2.3.65 - 2026-05-18

- Classified unresolved PR review threads without an explicit `PR_REVIEW_COMMENTS_OPEN` prefix as deterministic PR review blockers instead of `UNKNOWN`.
- Added regression coverage for supervisor wording that points to a non-outdated review thread.

## 2.3.64 - 2026-05-18

- Kept run-contract checks pending until the owning pipeline step has terminal evidence.
- Prevented design, story, setup, and implementation artifacts from passing early just because files already exist.
- Added regression coverage for future-step contract state so Mission Control can report real progress.

## 2.3.63 - 2026-05-17

- Added a deterministic post-merge build gate before verify can accept or auto-verify a story.
- Routed merged-main build failures back through the quality-fix path instead of letting final supervision discover them late.
- Added regression coverage so smoke deferral cannot skip the main build check.

## 2.3.62 - 2026-05-17

- Blocked verify and auto-merge when a story PR still has actionable review comments.
- Classified PR review comments, missing PRs, and unmerged PRs as deterministic retry categories instead of generic unknown failures.
- Added regression coverage so actionable PR feedback is routed back to implementation before merge.

## 2.3.61 - 2026-05-17

- Reclassified stale `UNKNOWN` retry context when the previous failure text contains a concrete guard category.
- Prevented generic retry instructions from masking generated-screen regression feedback.
- Added lifecycle coverage so actionable retry categories replace generic fallback metadata.

## 2.3.60 - 2026-05-17

- Added a verify preflight generated-screen regression gate so reviewer and supervisor claims cannot pass a story that removed previously verified generated screen routes.
- Routed generated-screen regression failures back to implementation with targeted retry feedback before reviewer spawn.
- Added wiring coverage so future refactors keep the verify preflight guard in the pipeline.

## 2.3.59 - 2026-05-17

- Added an implement-time generated-screen regression gate so later stories cannot remove previously verified generated screen integrations while adding their own screens.
- Classified generated-screen regression failures as actionable retry feedback.
- Added regression coverage for preserving previous generated screen routes across later screen stories.

## 2.3.58 - 2026-05-17

- Added an implement-time generated-screen integration gate so stories that own Stitch screens must render those generated components through the app/router surface instead of keeping custom duplicate UI.
- Classified generated-screen integration failures as actionable retry feedback.
- Added regression coverage for missing and barrel-imported generated screen rendering.

## 2.3.57 - 2026-05-17

- Aligned product-supervisor anchor handling with the deterministic supervisor scanner: hash anchors are still blocked when dead, but accepted when explicitly wired through an interaction handler or marked inert.
- Added regression coverage for generated Stitch anchors that keep `href="#"` while routing behavior through typed action handlers.

## 2.3.56 - 2026-05-17

- Added claim-summary scope file state so agents can distinguish existing owned files from expected new owned files.
- Printed missing scope files and scope file policy during bootstrap to prevent update-only patch loops on files that must be created.
- Added regression coverage for mixed existing and missing story scope handoffs.

## 2.3.55 - 2026-05-17

- Narrowed retry error classification so reviewer findings stay bounded quality feedback even when they mention acceptance-criteria conflicts or include older supervisor memory.
- Restricted merge-conflict detection to real Git conflict markers and merge output instead of natural-language product review text.
- Kept generated screen ownership out of shared shell stories so future screen work is deferred to the owning stories rather than blocking the first implementation story.
- Added claim-summary output defaults and command aliases so reviewers, supervisors, and developers get stable handoffs even when role prompts omit an explicit output contract.

## 2.3.54 - 2026-05-17

- Classified verifier retry findings as bounded quality-fix feedback instead of `UNKNOWN`.
- Classified supervisor retry blocks as manager feedback so the next implement claim gets the right repair context.
- Added regression coverage for review and supervisor retry taxonomy.

## 2.3.53 - 2026-05-17

- Hardened Stitch MCP response parsing so generated screens are recovered from top-level `structuredContent`, nested output components, screen instances, and embedded JSON text.
- Added zero-screen response-shape diagnostics to design preclaim progress so Mission Control can show why Stitch recovery is waiting or failing.
- Added regression coverage for structured and embedded Stitch response parsing.

## 2.3.52 - 2026-05-17

- Promoted Stitch links to typed generated screen actions so DOM-extracted navigation controls are wired through the same contract as buttons.
- Expanded story planning and supervisor checklist inputs to include `navigation`/`links` arrays in addition to `navLinks`.
- Added regression coverage for generated link action IDs, supervisor navigation checklist fallback, and story behavior contracts.

## 2.3.51 - 2026-05-17

- Prevented orphan-story maintenance from requeueing a running story while the original agent process is still tracked by the spawner.
- Added regression coverage for active-process preservation before orphan-story retry mutation.

## 2.3.50 - 2026-05-17

- Reworked QA browser server instructions to allocate collision-free local ports instead of relying on a fixed development port.
- Required QA to verify that the tested URL belongs to the target project before treating browser evidence as product evidence.
- Added regression coverage that prevents the QA step prompt from reintroducing fixed local port behavior or wrong-app product failures.

## 2.3.49 - 2026-05-17

- Cleared stale story-scoped supervisor context when pr-each loops advance into final-product supervision.
- Added a final supervisor claim sanitizer so runs with all stories verified cannot fail the final product gate on missing story acceptance criteria.
- Added regression coverage for final-product supervisor context cleanup in supervise-each workflows.

## 2.3.48 - 2026-05-17

- Added a Setfarm version contract check so package metadata, lockfile metadata, and changelog headings must advance together.
- Wired the version contract into prebuild before English and path contracts, preventing silent releases with stale visible versions.
- Preserved the current supervisor, story scope, verify retry, and generated Stitch contract fixes under the new release metadata.

## 2.3.47 - 2026-05-17

- Fixed run contract story ownership normalization for object-based `story_screens` so screen assignment checks no longer serialize screens as `[object Object]`.
- Added automatic `stitch/DESIGN.md` briefing generation for real and fallback Stitch artifacts before design auto-completion.
- Normalized duplicate `SCREEN_MAP.stories` owners to the story that owns the generated screen file before adding design acceptance criteria.
- Added regression coverage for object screen ownership and design briefing generation.

## 2.3.46 - 2026-05-17

- Added layered Setfarm runtime configuration with `.env` plus `.env.local`, while preserving real process environment as the highest-priority source.
- Centralized Mission Control internal API URLs behind `MC_INTERNAL_URL` so deploy, preclaim, status cleanup, CLI quota checks, and main-agent guidance work on local and remote runtimes.
- Added runtime path roots for projects, Setfarm state, scripts, CLI binaries, and repository paths to reduce workstation-specific defaults.

## 2.3.45 - 2026-05-17

- Added a project-neutral run contract ledger with per-step checklist evidence, framework stack-pack evidence, story ownership, deferred future-story surfaces, and blockers.
- Persisted the run contract to `.setfarm/RUN_CONTRACT.json` and run context so supervisors and Mission Control can audit the same source of truth.
- Refreshed the contract on run, step, and story lifecycle transitions, with regression coverage for design artifacts, stack resolution, and deferred story ownership.

## 2.3.44 - 2026-05-17

- Made the story supervisor a critical quality gate so exhausted supervisor failures fail loudly instead of being marked as skipped.
- Fed invalid supervisor output back into the next supervisor attempt with explicit AC_COVERAGE correction context.
- Added regression coverage for supervisor critical-gate behavior and invalid supervisor-output feedback.

## 2.3.43 - 2026-05-17

- Restored Stitch design generation to the fast exact-count batch path so all planned screens are generated in one call before implementation can begin.
- Added active platform-root script resolution for Stitch, setup, and design DOM extraction so Setfarm no longer drifts back to legacy `~/.openclaw` script paths.
- Extended Stitch JSON-RPC timeouts, fixed zero-screen list recovery parsing, and stopped masking configured Stitch failures with local fallback assets.

## 2.3.42 - 2026-05-17

- Isolated auto-planned generated projects by run id so repeated tasks cannot reuse stale project workspaces, branches, or design assets.
- Invalidated stale local fallback design assets when a Stitch API key is available, forcing design preclaims to attempt real Stitch generation again.
- Turned implement no-delta stall detection into an active supervisor intervention that terminates and requeues stalled story work before hard timeouts.

## 2.3.41 - 2026-05-16

- Preserved story acceptance criteria as JSON arrays when design-contract criteria are appended, preventing malformed story rows from confusing implement agents.
- Added backward-compatible acceptance-criteria parsing for legacy rows that already contain appended design-contract text or nested JSON criteria strings.
- Normalized generated screen-enrichment criteria to ASCII text for cleaner agent prompts.

## 2.3.40 - 2026-05-16

- Stabilized generated project scaffolds with ignored Setfarm metadata, a durable Vite baseline test, local fallback design assets, and cleaner natural-language project naming.
- Hardened smoke and visual QA so fallback design hashes, missing static-server binaries, preview servers, and Playwright child processes do not create false product failures or leaked processes.
- Moved supervisor memory under ignored `.setfarm` artifacts, added linked-worktree excludes, and added a deploy capability preclaim gate that skips unavailable infrastructure instead of failing healthy builds.

## 2.3.39 - 2026-05-16

- Added a spawner daemon control path and CLI autostart so local and cloud runs can use an event-driven execution backend without stale gateway cron assumptions.
- Added Codex/OpenClaw runtime resolution, claim-summary output contracts, and safer project-root workdir detection for spawned workers.
- Added PostgreSQL schema bootstrap and Mission Control supervisor artifact summaries so fresh Setfarm instances expose run health without manual migration gaps.

## 2.3.38 - 2026-05-16

- Split missing declared scope files into a dedicated implement retry category with clearer worker feedback.
- Hardened platform-owned git operations so worker git wrappers and supervisor runtime artifacts cannot block story commits.
- Required story-scoped supervisor passes to report acceptance-criteria coverage, preventing final-product checks from hijacking story supervisor loops.

## 2.3.37 - 2026-05-16

- Added the English source contract script required by the committed build and test scripts.
- Switched workflow agent defaults to Codex-first with Kimi and MiniMax fallbacks for provider flexibility.
- Added a project-neutral guard inventory that separates hard platform guards from supervisor-managed product-quality signals.

## 2.3.36 - 2026-05-16

- Added a unified supervisor ledger surface for stack contracts, library packs, design contracts, DOM inventory, repair history, final evidence, visual results, and supervisor state.
- Added repair-history and final-evidence writers so supervisor interventions can survive session restarts.
- Added regression coverage for supervisor ledger summaries, pending interventions, open findings, and ignored ledger artifacts.

## 2.3.35 - 2026-05-16

- Added a Setfarm-owned library pack registry and selector for UI primitives, icons, motion, creative canvas, forms, and charts.
- Persisted selected library packs to the project ledger and injected only selected pack guidance into implement prompts.
- Added regression coverage for browser game, dashboard, static-site, and library-pack ledger selection behavior.

## 2.3.34 - 2026-05-16

- Injected the Setfarm stack contract into setup-repo, setup-build, implement, and supervisor prompt contexts.
- Added compatibility aliases so existing stack-rule prompts keep working while the new stack-contract pipeline rolls out.
- Added regression coverage for stack context keys and implement prompt stack-contract sections.

## 2.3.33 - 2026-05-16

- Added a Setfarm-owned stack contract core with pack registry, repository evidence detection, preflight reconciliation, and portable ledger persistence.
- Added initial stack packs for Next.js, Vite React, static HTML, browser games, Python CLI/web, Android, and iOS projects.
- Added regression coverage for stack detection, prompt fragment selection, recoverable unknown stacks, and stack contract ledger round-trips.

## 2.3.32 - 2026-05-16

- Classified `SCOPE_FILE_MISSING` as a dedicated implement retry category instead of routing it through generic unknown feedback.
- Strengthened runtime bridge retry instructions to require a literal `window.app = ...` or `globalThis.app = ...` source assignment from live state.
- Tightened implement prompt language so type declarations, comments, `window.game`, and prose cannot satisfy the `window.app` bridge contract.

## 2.3.31 - 2026-05-16

- Passed the full current story, including acceptance criteria, into story-scoped supervisor prompts instead of only the story id and title.
- Rejected story supervisor pass/fixed outputs when `AC_COVERAGE` counts do not match the current story acceptance-criteria count.
- Extracted acceptance criteria from story-scoped supervisor claim summaries without leaking later prompt sections into the handoff.

## 2.3.30 - 2026-05-16

- Required supervisor pass/fixed outputs to include `AC_COVERAGE`, forcing story supervisors to audit acceptance criteria instead of only rechecking the previous blocker.
- Updated the supervisor prompt to treat previous failure context as one input, not the whole review scope.
- Told agents not to dump full claim-summary JSON into transcripts, keeping handoff reads focused and reducing context waste.

## 2.3.29 - 2026-05-16

- Added a root guard inventory that separates hard platform guards from supervisor-managed product-quality signals.
- Wired script-level version tests into the default `npm test` command so release badge, install URL, and build-info version contracts cannot silently fall out of coverage.
- Extended the English source contract to include `docs/`, keeping operational documentation under the same language gate as prompts and code.

## 2.3.28 - 2026-05-16

- Strengthened game PRDs and story contracts so gameplay-only touch, movement, pickup/drop, pause, and similar controls are active only when they can affect the current state.
- Updated implement instructions to hide or explicitly disable gameplay-only controls on menu, help, paused, game-over, loading, empty, and other inactive screens, preventing visible no-op control pads.

## 2.3.27 - 2026-05-16

- Fixed local fallback game-over design generation so `Game Over` screens use result actions before the generic game-board fallback can match the word `game`.
- Removed non-terminal pause/share controls from fallback game-over contracts, preventing no-op terminal controls in future generated game projects.

## 2.3.26 - 2026-05-16

- Derived clean project slugs and display names from natural-language `called`/`named`/`titled` product phrases when no explicit `Project:` slug is provided.
- Filled claim summaries with a synthetic current-story line when the handoff only contains compact story metadata.
- Added a durable Vite baseline render test so fresh projects start with a passing test suite instead of teaching implement agents to patch test config.
- Parsed both `## Output Format` and `## Output Contract` sections so supervisor agents receive exact required output fields in bootstrap handoffs.

## 2.3.25 - 2026-05-16

- Added a deploy capability preclaim so unavailable deployment infrastructure auto-completes as `STATUS: skip` instead of burning retries with deployer agents.
- Kept production deploys active when local Mission Control/systemd or a configured remote deploy host is reachable.
- Documented that deploy agents must skip cleanly when deployment infrastructure is unreachable and no required-deploy override is set.

## 2.3.24 - 2026-05-16

- Added a structured `outputContract` handoff so guard-backed roles see their exact required output fields in claim summaries and bootstrap output.
- Strengthened the preclaimed prompt to require outputContract fields before `step complete`, preventing prose-only success payloads after real QA work passes.
- Added regression coverage for QA output-format extraction and bootstrap output-contract printing.

## 2.3.23 - 2026-05-16

- Fixed single-step handoff for security, QA, final-test, and deploy claims so project-root context paths resolve on macOS and Linux instead of falling back to agent scratch.
- Made claim summaries and bootstrap scripts recover from stale scratch workdirs by preferring the structured project workdir/mainRepo when available.
- Kept task summaries compact so QA/security agents read the authoritative handoff instead of dumping large raw story payloads.
- Added regression coverage for project-root extraction, scratch fallback prevention, and compact claim-summary task text.

## 2.3.22 - 2026-05-16

- Fixed final-product supervisor completion after verify-each loops so it no longer re-enters story-level `superviseEach` handling when no `done` story awaits supervision.
- Prevented completed runs from repeatedly spawning supervisor agents after all stories are verified.
- Added regression coverage for the final supervisor versus story supervisor dispatch split.

## 2.3.21 - 2026-05-16

- Fixed QA-FIX platform-metadata dirty parsing for real `git status --porcelain` output such as ` M SUPERVISOR_MEMORY.md`.
- Preserved porcelain status columns before extracting changed paths, so platform metadata no longer consumes QA-FIX retries or fails runs.
- Tightened regression coverage around the parser shape so future dirty-state fixes cannot reintroduce trim-based false blockers.

## 2.3.20 - 2026-05-16

- Allowed QA-FIX direct merges to continue when the canonical main repo is dirty only because of Setfarm platform metadata.
- Kept real product source dirt blocking QA-FIX merges while ignoring `SUPERVISOR_MEMORY.md`, `.setfarm`, and related platform-only files.
- Added regression coverage for QA-FIX merge blocking with platform metadata-only dirty status.

## 2.3.19 - 2026-05-16

- Prevented smoke tests from inventing short hash routes from generated fallback screen filenames when `SCREEN_INDEX.json` declares fallback screen IDs.
- Kept explicit non-fallback hash routes discoverable while avoiding false QA-FIX loops against non-authoritative generated design routes.
- Added regression coverage for fallback screen-index hash discovery.

## 2.3.18 - 2026-05-16

- Ignored platform metadata-only dirty git status reports during verify-each when the story PR is already merged.
- Prevented `SUPERVISOR_MEMORY.md` or `.setfarm` workspace noise from routing a merged, passing story back to implement.
- Added regression coverage for merged PR verification with platform metadata-only dirty status.

## 2.3.17 - 2026-05-16

- Reclassified transient agent/runtime exits for single-step agents as `infra_retry` instead of product retries.
- Prevented supervisor/reviewer process infrastructure failures from consuming step retry budgets or skipping non-critical gates.
- Added regression coverage for single-step infra retry handling.

## 2.3.16 - 2026-05-16

- Made agent runtime resolution validate candidate CLIs with `--version` before selecting them.
- Skipped broken PATH entries such as stale Codex shims whose vendor binary is missing.
- Added regression coverage for usable-runtime selection and explicit fallback behavior.

## 2.3.15 - 2026-05-16

- Added a spawner self-heal for `superviseEach` runs where a completed story is waiting for supervisor audit while reviewer polling is already pending.
- Moved reviewer polling back to waiting until the matching supervisor story audit is queued.
- Added regression coverage for the supervisor-before-reviewer scheduler invariant.

## 2.3.14 - 2026-05-16

- Prevented the implement placeholder guard from rejecting completion reports that say placeholder wording was fixed or removed.
- Kept unresolved placeholder, TODO, coming soon, unfinished, and not implemented reports blocking.
- Added regression coverage for resolved versus unresolved implement placeholder output.

## 2.3.13 - 2026-05-16

- Requeued orphaned running claims after spawner restart as infrastructure retries instead of product step failures.
- Closed matching `claim_log` rows with `infra_retry` during startup recovery.
- Added regression coverage for restart recovery that preserves pipeline progress.

## 2.3.12 - 2026-05-16

- Treated skipped visual QA as a warning instead of a pass in supervisor metadata and verify logs.
- Preserved existing visual blockers when browser automation is unavailable instead of clearing them with skipped evidence.
- Cleared stale `visual:*` blockers only after a later successful non-skipped visual QA pass.
- Added regression coverage for skipped visual QA state and stale visual blocker resolution.

## 2.3.11 - 2026-05-16

- Added a periodic spawner sweep for detached preview and Playwright children that survive agent exit cleanup.
- Kept macOS process cleanup independent of Linux-only cwd and cgroup metadata.
- Added regression coverage for poll-cycle detached tool cleanup.

## 2.3.10 - 2026-05-16

- Recovered agent claims after clean process exit even when the active process map was already cleared.
- Reaped detached dev-server and Playwright browser children that are reparented to the spawner on macOS.
- Added regression coverage for stale exit recovery and detached preview/browser cleanup.

## 2.3.9 - 2026-05-16

- Deferred active-agent reaping across transient non-running DB states until the normal watchdog window.
- Added cleanup for detached Playwright browser children spawned outside the harness process group.
- Added regression coverage for non-running active-agent grace and detached browser cleanup.

## 2.3.8 - 2026-05-16

- Cleaned up Playwright preview and browser process groups after visual verification runs.
- Prevented newly spawned agents from being reaped during the brief preclaim/running state transition.
- Added regression coverage for visual process cleanup and active-agent reap grace behavior.

## 2.3.7 - 2026-05-16

- Added a dependency-free Node static server fallback for platform smoke tests when `serve` is not installed.
- Prevented browser smoke verification from reporting `spawn serve ENOENT` as a product failure.
- Added regression coverage for smoke-test server fallback behavior.

## 2.3.6 - 2026-05-16

- Moved durable supervisor memory under ignored `.setfarm/` platform metadata instead of the product repo root.
- Prevented setup baseline commits from tracking Setfarm internal memory/artifact files.
- Prevented dirty-main isolation from auto-stashing changes that only affect platform-owned internal files.
- Added regression coverage for ignored supervisor memory and dirty-main stash behavior.

## 2.3.5 - 2026-05-16

- Normalized successful supervisor audit outputs that omit `SUPERVISOR_DECISION` to `pass`.
- Prevented a missing supervisor decision label from causing repeated supervisor retries after clean audit evidence.
- Added regression coverage for supervisor output normalization.

## 2.3.4 - 2026-05-16

- Released stale managed supervisor/reviewer worktrees before retrying a story branch.
- Prevented Git branch occupancy from blocking developer retries after supervisor failures.
- Added regression coverage for stale managed worktree branch locks.

## 2.3.3 - 2026-05-16

- Prevented supervisor runtime artifacts under `.setfarm/` from blocking scoped story commits.
- Wrote supervisor artifact excludes to linked worktree common git metadata as well as the worktree gitdir.
- Added regression coverage for supervisor ledger artifacts in story worktrees.

## 2.3.2 - 2026-05-16

- Added cross-platform workflow spawner resume behavior so macOS installs do not depend on `systemctl`.
- Removed Linux-only `/usr/bin/node` assumptions from agent completion prompts and deploy guidance.
- Kept Codex runtime logs and timeout messages runtime-neutral.

## 2.3.1 - 2026-05-16

- Added a Setfarm supervisor summary API for dashboards and Mission Control.
- Exposed persisted supervisor blockers, interventions, visual QA status, fixer plans, and artifact paths through a stable run-level endpoint.
- Added an English-source build contract so accidental non-English UI, script, and prompt text blocks release.
- Kept release surfaces synchronized through the version contract.

## 2.3.0 - 2026-05-16

- Added persistent supervisor run metadata, intervention reports, visual QA artifacts, and fixer plans under `.setfarm/supervisor/<runId>/`.
- Wired supervisor interventions into story-scoped manager checkpoints so retries carry explicit manager feedback instead of ad hoc project rules.
- Added Playwright-backed visual QA evidence for web verification, including route screenshots, console/network issues, layout overflow checks, and clicked-control checks.
- Kept supervisor artifacts out of product git history with automatic `.setfarm/` git excludes.

## 2.2.0 - 2026-05-16

- Added the supervisor-first execution architecture for persistent project oversight.
- Added an automated version contract so release surfaces must match package semver.
- Kept all repository instructions, fixtures, and agent-facing prompts in English.

## 2026-05-16

- Added the supervisor-first refactor design and implementation plan.
- Started replacing fatal project-specific guard behavior with persistent supervisor state, checklist scanning, and targeted intervention messages.
- Added supervisor modules for checklist construction, DOM implementation scanning, state persistence, intervention text, model policy, coordination, and fixer ownership.
- Converted prompt, workflow, test fixture, and documentation text to English so coding agents receive a single technical instruction language.

Older operational notes were archived before this cleanup. Use git history for pre-2026-05-16 details.
