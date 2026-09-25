# Pre32 refusal-classification plan

> Root is sole writer/PR owner; other agents may review read-only.

**Goal:** identify the next fail-closed host-pair execution phase without exposing nested errors or changing cutover authority.

**Spec:** `docs/superpowers/specs/2026-09-25-pre32-refusal-classification.md`

## TDD and delivery

- [x] RED: a DB callback error wrapped by the physical observer retains `database-callback` phase; first/second physical pass, pair validation, postcheck, and cleanup have their own finite phases with no original error/cause.
- [x] RED: authenticated pre32 fixture publishes only an exact trusted phase or `unknown`; malformed envelope, secret, accessor, proxy and spoofed phase remain unknown.
- [x] GREEN: tag phase in zero-input V4 and accept it in the pre32 bootstrap catch only, preserving existing success and refusal shapes for every other verb. The earlier message-classifier draft was rejected after independent review showed DB/physical ambiguity.
- [x] Focused host-pair/bootstrap and full scripts (785/785 plus genuine 43/43), pure (120/120), cutover (384/384), manifest (18/18), TypeScript, English/path checks, independent read-only review (no critical/important findings), staged diff check. Clean-main build follows merge.
- [ ] Scoped PR, exact-head checks, SHA-bound merge, clean-main build, selected source fast-forward with historic dist/CLI proof, one sanitized host diagnostic.
