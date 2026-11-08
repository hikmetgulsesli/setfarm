# Recovery mapped screen current source implementation plan

**Goal:** Allow a legitimate generated repair to compile after implementation changes a mapped screen, preserving sealed design provenance.

**Architecture:** Keep the sealed implementation source map and story projection unchanged. The compiler and standalone slice schema may accept a different current owned-file hash only through the existing generated-repair delta, exact current source revision and finding locator. Ordinary compilation and exact-mode behavior retain the original hash check.

**Tech Stack:** TypeScript, Zod, Node test runner, existing pure compiler fixtures.

**Spec:** Inline Design below; one causal root fix adopted by Root under Standing Owner Authorization v1. Root owns test execution, review, delivery and live effects.

## Inline Design and causal evidence

Run `f45cf30d-8879-4dec-94f5-6dbb7afcdf97` recorded `V3_NATIVE_RECOVERY_COMPILATION_REJECTED / SLICE_V2_STORY_SOURCE_MAP_INVALID` before attempt reservation. The mapped path exists: its initial sealed hash differs from the authenticated failed implementation at the recovery HEAD. Existing ownership compilation already recognizes current recovery witnesses, but the mapped-screen compiler and schema separately require original design bytes. Preserve original map/witness identities; bind current bytes through the existing recovery authority rather than rewriting provenance.

## Global constraints

- No sealed map, packet, design witness, historical record or generated-project edits.
- Require the same owned, present, exact mapped path. A changed hash requires generated_repair, exact allowed path/change.before, current revision and matching open finding source locator.
- Keep missing/read-only paths, stale or forged witnesses, ordinary compilation, exact-mode semantics and all existing evidence/ownership checks strict.
- No owner/DB/lease/grant/provider changes, new API, schema wire format, framework or retry changes.
- Sole existing writer; no dirty stock build, commits, delivery or live effects by this author.

## File Map

- `src/product-compiler/slice-compiler-v2-legacy.ts`: mapped-screen current-file validation.
- `src/product-compiler/schemas/implementation-slice-v2-legacy.ts`: equivalent standalone mapped-screen refinement.
- `tests/product-compiler/implementation-slice-v2-legacy.test.ts`: real compiler/verifier/schema regression and authority refusals.
- This plan: causal scope and captured validation.

## Task 1: Bind recovery current bytes without changing sealed screen provenance

- [x] Add behavioral RED fixtures using existing Stitch compiler and recovery finding constructors. Change only current mapped-file bytes/revision; preserve the sealed screen. Independently rehash a standalone candidate so generic authority hashes cannot explain refusal.
- [x] Root captures genuine RED at the mapped-screen guard with production unchanged:
  `node --import tsx --test --test-name-pattern='mapped screen recovery' tests/product-compiler/implementation-slice-v2-legacy.test.ts`
- [x] After RED adoption, minimally update the two mapped-screen checks. Require existing exact generated-repair current-file authority; leave the sealed projection and all other checks unchanged.
- [x] Root runs the same focused command, then `node --import tsx --test tests/product-compiler/implementation-slice-v2-legacy.test.ts`, `node node_modules/typescript/bin/tsc --noEmit`, and `git diff --check`.
- [x] Freeze exact bytes for independent review. Root performs any later clean build and delivery.

**Validation:** Root captured genuine RED original Node PID `75686`, exit `1`, in private `root-recovery-mapped-screen-red-v1.*` captures. Both positive tests failed at the actual compiler/source-map and standalone mapped-screen guards; both negative-control tests passed. Phase B changes only the two mapped-screen checks; tests remain byte-identical. Focused GREEN, full existing suite, noEmit and diff verification are pending Root execution. No stock build or live-fix claim.

## Root verification checkpoint

Root captured focused GREEN original PID77257 exit0 (4/4), the existing complete compiler test file PID77937 exit0 (17/17, zero skips), noEmit PID77936 exit0, and clean diff check. Test bytes remain identical to genuine RED. Independent review matched all four frozen hashes and returned CLEAR for equivalent exact current-source authority, unchanged sealed provenance and strict ordinary/exact-mode behavior. These are unit/type/review results; clean stock build and live repair convergence remain unqualified and Root-owned.
