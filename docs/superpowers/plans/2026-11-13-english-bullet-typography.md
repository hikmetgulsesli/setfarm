# English Bullet Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Accept standard English bullet punctuation without weakening language or structural checks.

**Architecture:** Extend the existing exact English typography set by one numeric code point; keep every consumer and source byte unchanged.

**Tech Stack:** TypeScript ESM, node:test/tsx, existing pure English contract test file.

**Spec:** docs/superpowers/specs/2026-11-13-english-bullet-typography-design.md

## Global Constraints

One existing sole writer; no source/guard/schema/provider/runtime changes outside the one policy entry. No broad tests or PG fixture. Root alone commits/pushes/merges/builds. Preserve records/failedaf743; no generated artifact edits/replay, no blanket Unicode exception.

### Task 1: Admit one legitimate punctuation mark

**Files:** Modify `src/product-compiler/english-text-contract-v1.ts` and `tests/product-compiler/english-text-contract-v1.test.ts`.

**Interfaces:** Existing `inspectEnglishTextV1` and `inspectEnglishTextTreeV1` signatures unchanged; no new exports.

- [ ] Write focused regression in existing file using `const bullet = String.fromCodePoint(0x2022)`. Expect undefined for `Ready ${bullet} Score` and an ASCII English HTML body containing it; expect no tree violations for English prose fields with bullet. Keep source text ASCII by using the numeric point.

```ts
const bullet = String.fromCodePoint(0x2022);
assert.equal(inspectEnglishTextV1(`Ready ${bullet} Score`), undefined);
assert.equal(inspectEnglishTextV1(`<main><p>Ready ${bullet} Score</p></main>`), undefined);
assert.deepEqual(inspectEnglishTextTreeV1({ label: `Ready ${bullet} Score` }), []);
```

- [ ] Prove bullet does not mask foreign/control/zero-width values: inspect `Ready ${bullet} ${String.fromCodePoint(0x0416)}` -> NON_ASCII0x0416, similarly0x200b; preserve a control rejection and existing high-signal ASCII localized lexeme rejection with bullet. Assert bounded length still applies to a bullet-bearing string/tree.
- [ ] Run selected new regression on unchanged production code; retain original expected U+2022 RED/exit1. Do not call setup errors RED.
- [ ] Add exactly `0x2022,` alongside existing allowed typography, no other behavior change.
- [ ] Run selected test GREEN, then full existing English contract test file and source `tsc --noEmit`; diff check. Preserve exact command/exit/logs privately; no runtime/DB/model effects.
- [ ] Report to Root; no staging/commit/build/delivery. Root independently reviews, commits, pushes normal scoped PR, merges after required review, then stock clean-main build. All native workflow qualification remains pending actual fresh run.
