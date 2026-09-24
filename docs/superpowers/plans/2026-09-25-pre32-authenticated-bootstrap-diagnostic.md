# Pre32 authenticated diagnostic bootstrap plan

> Root is the only writer and PR delivery owner; other agents are read-only reviewers.

**Goal:** Run the existing V4 held physical/database observer through the already authenticated cutover loader, then obtain one honest host result.

**Spec:** `docs/superpowers/specs/2026-09-25-pre32-authenticated-bootstrap-diagnostic.md`

## Constraints

- Preserve source/build/dependency/loader checks, Python data-only import, existing verb output, no-argument guard, no secret in refusal, and normal runtime guards.
- New command is diagnostic-only and invokes the built fixed zero-input V4 export; no caller-provided paths, rows, URL, owner count or callback.
- Do not mutate DB, services, selected CLI/dist, retained worktrees, or guard behavior. No direct commit to main.

## TDD

- [x] RED: authenticated fixture dispatches `inspect-pre32-host-pair --json` exactly once and returns only the new property; missing/wrong args and ambient preload refuse before module invocation.
- [x] RED: authenticated fake V4 module output must have fixed diagnostic labels/frozen hash envelope; malformed result and secret-bearing error refuse generically. Source or built output tamper refuses before invocation.
- [x] GREEN: add the verb to bootstrap's exact allowlist, load the built module after current auth checks, invoke once, validate fixed labels, add the result property and finite stage. Do not modify the loader or other verbs.
- [x] Run focused bootstrap tests (98/98), full scripts (779/779 plus genuine 43/43), internal-production cutover (384/384), pure (117/117), manifest (18/18), TypeScript, English/path checks, `git diff --check`, and independent read-only review (no important findings).
- [ ] Commit, scoped PR, exact-head checks and review, SHA-bound merge, clean-main build. Preserve selected historical dist/CLI across source ff-only. Run exactly one sanitized authenticated host diagnostic; classify any refusal without bypass.
