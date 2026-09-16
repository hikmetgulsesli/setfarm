# Cutover Partial Read Closure Implementation Plan

> **Execution:** Primary-owner TDD; parallel read-only review. One writing branch.

**Goal:** Close the same legal-partial-read refusal across the cutover boundary.

**Architecture:** Accumulate positioned reads into each existing bounded buffer
until EOF or capacity, retaining every subsequent length, content, metadata and
physical-path check. No shared helper import is introduced into trusted closures.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Causal scope and File Map

PR125 comment4021983545 exposed a single-read assumption in the retention reader.
The same assumption exists in these approved cutover files and would block the
same transition. Fixing those sites is the same root repair, not a new feature.

- `baseline-deployment-cutover-v1.ts`: intent observation.
- `baseline-deployment-cutover-publication-v1.ts`: staged intent verification.
- `baseline-deployment-cutover-owner-store-v1.ts`: history snapshot and staged claim.
- `baseline-deployment-cutover-cli-observation-v1.ts`: selected CLI bytes.
- `baseline-deployment-cutover-launcher-observation-v1.ts`: fixed plist bytes.
  These files are under `src/internal-production/`; their corresponding tests
  under `tests/internal-production/` verify actual physical fixtures and replay.
- `scripts/deployment-cutover-owner.mjs` and its script test: source snapshot.
- `scripts/deployment-cutover.mjs`, dependency helper and corresponding tests:
  authenticated output/package snapshots; covered by the dependency-loading plan.

## Steps

- [x] Reproduce the seven remaining sites with bounded real read calls, not fake
  byte counts. CLI/launcher/source tests fail3/3; intent observation/publication
  and fresh/seeded owner-store cases fail4/4 before implementation.
- [x] Replace each single read with the same bounded accumulation shape:

```js
let length = 0;
while (length < buffer.length) {
  const size = fs.readSync(fd, buffer, length, buffer.length - length, length);
  if (size === 0) break;
  length += size;
}
```

- [x] Preserve byte caps, no-follow opens, descriptor ownership, durable sync/link
  order, existing content/size comparisons and sticky close-uncertainty refusal.
- [x] Require unchanged committed bytes/inodes on replay and independent seeded
  snapshot coverage. Seven focused cases passed, zero skips,394.563166ms.
- [x] Independent review confirmed all guards remain and existing mutation hooks
  still exercise the intended changes despite the extra EOF call.
- [x] Run the full cutover and affected script/integration suites, noemit and
  source contracts before delivery. Never substitute a source-only smoke for
  live ownership, cold handoff or complete-zero evidence.

Final qualification: cutover218/218, zero skips,7007.490583ms; affected scripts
and genuine package integration105/105, zero skips,76050.964625ms. Noemit and
English/path/whitespace contracts passed. Independent review found no material
issue in caps, positioned reads, metadata/path checks, cleanup or fault witnesses.

## Delivery grouping

The now-qualified dependency loader remains a prerequisite of the same approved
transition. Deliver its separate commit in PR125 alongside these root repairs,
updating the PR scope explicitly. It authenticates packages without opening a DB
connection; no service, CLI link, archive or runtime authority effect is included.
