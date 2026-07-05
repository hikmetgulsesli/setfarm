# Implement Guard Hardening Design

## Context

Recent clean web probe runs show that `plan`, `design`, `stories`, `setup-repo`,
and `setup-build` can complete, while `implement` still fails on repeated
runtime guard signals. The recurring blockers are:

- `FULL_REFERENCE_CONTEXT_READ` from broad `references/*.md` reads.
- `GENERATED_SCREEN_SHARED_READ` from broad `src/screens/*.tsx` reads.
- `MASKED_CHECK_COMMAND` from deterministic checks piped through output filters.

The platform already hides the full `references/` corpus in implement worktrees
and replaces non-owner generated screen sources with compile-safe stubs. The
remaining issue is that the runtime guards still reason about some wildcard
paths too coarsely, so a command can be blocked even when the files visible to
the worker are only Setfarm policy files or generated screen stubs.

## Goal

Harden the implement loop without weakening Setfarm's invariants:

- Keep blocking real broad reference reads, real non-owner generated screen
  source reads, and masked build/test evidence.
- Stop blocking wildcard reads that only resolve to Setfarm-owned policy or
  stub files.
- Make guard diagnostics point to the exact matched file set when possible.
- Verify the behavior with focused regression tests and one clean web probe run.

## Non-Goals

- Do not increase retry budgets to hide bad model behavior.
- Do not disable `MASKED_CHECK_COMMAND`, `FULL_REFERENCE_CONTEXT_READ`, or
  `GENERATED_SCREEN_SHARED_READ`.
- Do not rescue polluted generated projects manually.
- Do not change setup-build behavior unless new evidence shows setup-build is
  the source.

## Scope Control

The initial implementation should stay centered on the implement
guard/worktree path because current live evidence points there. This is not a
hard refusal to touch other layers. It is a sequencing rule: follow the failure
owner shown by live Postgres rows, claim logs, transcripts, worktree state, and
GitHub/PR state.

Expand scope only when evidence shows one of these conditions:

- Claim summary or prompt input is missing the correct policy, scope, screen, or
  retry context. Then include `spawner-prompt` or implement context assembly.
- The story worktree contains real out-of-scope generated source or full
  references after hardening. Then include `step-ops` or `worktree-ops`.
- Setup-build emits an incomplete or wrong contract that later forces implement
  into broad reads. Then include setup-build contract generation.
- Verify or PR comment retry reintroduces stale or already-satisfied feedback.
  Then include verify retry lifecycle.
- Mission Control displays a state that conflicts with Postgres or canonical
  operational state. Then include Mission Control presentation.

Do not expand scope from model prose alone. Expand only from system-owned
evidence or reproducible local checks.

## Architecture

The fix has two cooperating layers.

First, implement worktree preparation remains the prevention layer. It should
continue to replace the full reference corpus with small Setfarm policy files
and replace non-owner generated screen source files with compile-safe stubs.
This keeps sensitive or distracting source out of model context before any
runtime guard has to react.

Second, runtime guards become path-aware for wildcard commands. Instead of
treating every path containing `*` as existing and unsafe, the guard should
expand the limited patterns it already understands:

- `references/*.md`
- `src/screens/*.tsx`

The guard then evaluates the resolved files using the same allow rules already
used for direct reads. If every resolved reference file is an implement policy
file, it is allowed. If every resolved generated screen file is either in
`.story-scope-files` or is a Setfarm generated screen stub, it is allowed. Any
real non-owner generated screen source or real full reference file remains a
blocking signal.

## Data Flow

1. `claimStep` creates or reuses the story worktree.
2. `step-ops` writes `.story-scope-files`, computes implicit scope files, and
   calls `hardenGeneratedScreenSourcesForScope`.
3. `worktree-ops` hides full implement-only assets and writes policy/stub
   replacements where appropriate.
4. The agent runs commands through OpenClaw or another configured runtime.
5. `spawner.ts` reads recent session events and extracts tool calls.
6. For relevant `exec` commands, the guard resolves supported globs to concrete
   worktree-relative paths before making a block/pass decision.
7. If blocked, the diagnostic includes the category, original command path, and
   the concrete unsafe match that caused the block.

## Guard Decisions

Reference reads:

- Allow direct or wildcard reads of `references/README.md` and
  `references/.setfarm-reference-policy.md` when they match the Setfarm policy
  marker.
- Block `references/backend-standards.md` in non-backend stories.
- Block full reads of any real reference manual.
- Treat unmatched globs as non-events instead of unsafe by default.

Generated screen reads:

- Allow direct reads of generated screen files listed in `.story-scope-files`.
- Allow reads of Setfarm generated screen source stubs.
- Allow `src/screens/*.tsx` only when all matched files are scoped or stubs.
- Block as soon as any matched file is a real non-owner generated screen source.

Masked checks:

- Keep blocking direct deterministic checks piped into `head`, `tail`, `grep`,
  `rg`, `tee`, `cat`, `awk`, or `sed` when the pipeline exit status is not
  preserved.
- Do not treat later log inspection as masking when the deterministic command
  itself wrote to a log, the command exit was preserved in a variable or printed
  explicitly, and the log read is not part of the check pipeline.
- Keep diagnostics instructive: run declared checks plainly, or save output only
  after preserving the command exit status.

## Error Handling

Glob expansion should be conservative but precise:

- If the directory does not exist, return no matches.
- If a supported glob cannot be expanded, do not invent a match.
- If expansion finds a mix of allowed and unsafe files, block on the first unsafe
  file and include that file in the diagnostic.
- If reading a candidate file fails, treat it like an unsafe real file only when
  the path exists and is not known to be a Setfarm policy or stub.

## Testing

Add focused regression tests around the guard behavior:

- `references/*.md` with only policy files does not trigger
  `FULL_REFERENCE_CONTEXT_READ`.
- `references/*.md` with a real reference manual still triggers the reference
  guard.
- `src/screens/*.tsx` with only scoped files and generated screen stubs does not
  trigger `GENERATED_SCREEN_SHARED_READ`.
- `src/screens/*.tsx` with one real non-owner generated screen still triggers
  the generated screen guard.
- Direct masked check pipelines remain blocked.
- A safe log-capture pattern with explicit exit preservation is not blocked.

Run focused tests first, then `npx tsc -p tsconfig.json --noEmit` or
`npm run build` depending on touched files. After the code fix is merged, start
a clean small `web:` run and inspect Postgres claim logs to confirm that the
implement stage no longer repeats these false-positive guard failures.

## Rollout

This should ship as a small Setfarm core change on `main` or a short PR branch.
No generated project should be repaired. Any run that already failed from old
guard behavior should be treated as polluted evidence; use a new clean run for
validation.
