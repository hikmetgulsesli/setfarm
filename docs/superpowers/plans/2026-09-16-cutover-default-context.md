# Default-context qualification implementation plan

> **For agentic workers:** Main is the sole implementation/delivery writer;
> parallel agents perform independent read-only investigation and review.

**Goal:** Bind the retained default startup to the launchers' actual runtime and
database target without changing launcher configuration or weakening strict mode.

**Architecture:** A zero-input owning composition must hold selected build,
package inventories, default env absence, launcher configuration, Node/PATH and
resolution evidence throughout the private read-only database census. Qualifiers
are read-only evidence, never admission or permission to operate services.

**Tech Stack:** Node builtins, TypeScript, existing authenticated ESM bootstrap.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`

## Global constraints and current qualification boundary

- Preserve old deployment, eight archives, CLI link and ports3333/3080/18789.
- No old shared-Git fetch, source/output overwrite, guard bypass or live effect.
- Existing strict launcher observers remain strict. No public acceptance flag.
- Node/macOS/Homebrew dynamic libraries remain trusted platform prerequisites;
  hashing the Node executable does not authenticate its dynamic loader closure.
- Launcher HOME is currently unresolved: printed environment blocks alone are
  not proof of effective HOME. Do not discharge effective-environment or DB-target
  blockers until supported by authenticated evidence. Continue independent work.
- No new standalone diagnostic success endpoint for the Node helper.

## File map

- New `src/internal-production/baseline-deployment-cutover-node-path-v1.ts`:
  read-only held first-PATH candidate identity, restricted to the running trusted
  Node physical executable; no package evaluation or process execution.
- New `tests/internal-production/baseline-deployment-cutover-node-path-v1.test.ts`:
  real private path/symlink fixtures, drift/absence/cleanup tests in fresh children.
- Existing launcher observer remains the intended private owning seam; do not
  modify acceptance until the default context has actually been qualified.
- This plan records HOME and resolution as open proof obligations, not placeholders
  granting implementation or live authority. Subsequent tasks require evidence
  and a concrete file map before implementation.

## Task 1: Hold actual first-PATH Node identity

Interface: `holdDeploymentCutoverNodePathV1(launcherPath: string)` returns frozen
`{ observation, recheck(): void, close(): void }`. Input is evidence for a leaf
only, not an admission capability; owning composition must supply its privately
verified launcher PATH. Resolve directory symlinks as well as file symlinks.

- [x] Write physical tests asserting a private directory symlink to the trusted
  Node directory resolves; observation binds candidate and physical executable.
  `assert.equal(held.observation.executablePath, fs.realpathSync(process.execPath))`.
- [x] Run the focused test and witness the missing export failure.
- [x] Implement bounded path walking: <=32 PATH entries, <=128 components,
  <=32 symlink traversals, <=256 held descriptors, <=256MiB executable. Reject
  relative/empty/noncanonical PATH entries and unsafe writable/foreign ancestry.
  Only Darwin Node ancestry may use existing admin-group80 directory policy.
  Pin preceding candidate absences with nearest parent directory timestamps.
  Match resolved executable to trusted `process.execPath` before hashing.
- [x] Add and run first-candidate shadow, directory/file-link replacement,
  preceding absence appearance/removal, invalid PATH, executable metadata
  drift, descriptor drain and close-response-loss tests. Do not mutate the live
  trusted Node binary to simulate replacement. Tests must assert
  the held recheck itself refuses, not a subsequent fresh observation.
- [x] Recheck original descriptors/metadata and raw links after an await; reject
  closed contexts. Close consumes each fd once, drains on loss, sticky refusal.
- [x] Run focused tests, `npx tsc --noEmit`, relevant cutover/manifest contracts;
  independently review before scoped commit. Normal build only on clean source.

Review-driven regressions: native symlink interior-dotdot semantics, actual OS
execute permission (not any execute bit), stable real/effective UID and GID,
legal97-byte reads with independent digest, original descriptor drainage and
proven descriptor-number reuse after close response loss. Node/PATH leaf passed
a read-only smoke against the actual plist PATH without printing credentials;
candidate `/opt/homebrew/opt/node/bin/node` resolves to the trusted running Node.
This smoke is not loaded-launcher or effective-environment qualification.
Final local evidence: focused20/20, cutover292/292, manifest18/18, noemit,
English1551/path884 and diff whitespace checks passed. Entire project and owning
default-context composition remain incomplete; no live effects performed.

## Remaining integration obligations

1. Establish effective HOME and FD3/import-time semantics, without assuming the
   sanitized inspector environment equals the launchers' environment.
2. Review finite ESM/CJS edge completeness; hold nearer shadows and all optional
   global search boundaries; resolve with trusted builtins-only child, never
   evaluate retained JS/native targets.
3. Compose inside private launcher owner, keeping raw URL lexical and all holders
   alive through census and cleanup. Preserve existing strict APIs and blockers
   not actually discharged. Tests must prove no DB call occurs on failed proof.
4. Filesystem phase, controller exclusion, journaled effects and ready authority
   remain separate required stages of the approved transition.
