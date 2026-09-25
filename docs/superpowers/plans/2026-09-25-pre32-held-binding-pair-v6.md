# Pre-32 held binding pair V6

Status: implemented; PR delivery pending. Read-only diagnostic only.

## Causal scope

PR #165 added detailed binding rows to one pre-32 PostgreSQL snapshot, but the
snapshot is not yet inside the held two-pass physical worktree observation. The
approved preserved cutover requires a paired epoch. Add a separately versioned
V6 pair and authenticated read-only inspect verb without changing V4/V5 output,
the old selected dist, migration history, runtime admission or cutover guards.
Pre-32 still requires zero active attempts/sessions, so this is not positive
live-owner or nonowner authority.

## File map / RED-GREEN

1. Extend host-pair tests with V6 pair and code-owned holder RED cases, including
   a self-consistent forged nested binding snapshot that must refuse. Extend
   bootstrap tests for the V6-only verb and output; run RED.
2. `baseline-positive-worktree-host-pair-v2.ts`: strict V6 nested validator
   rechecks frozen exact shape, canonical inner/outer hashes, counts and
   overlapping row identities. Compose the V6 DB callback inside the held
   physical bracket and preserve every catalog blocker.
3. `baseline-deployment-cutover-launcher-observation-v1.ts`: private V6
   qualified DB port, same URL/launcher rechecks and close behavior.
4. `scripts/deployment-cutover.mjs`: authenticate the V6 inspect verb through
   the existing pinned source/build closure; expose only diagnostic V6 output
   and sanitized refusal stage. V4/V5 command schemas remain unchanged.
5. Focused and broader tests, TypeScript/contracts, independent read-only
   review, scoped PR, clean-main build and actual host diagnostic. No service
   switch or worktree deletion.

## Verification evidence

RED: missing V6 pair export and unsupported bootstrap verb. GREEN: V6 focused
pair/launcher/bootstrap tests, pure suite 132/132, cutover suite 390/390,
full authenticated bootstrap file 117/117, TypeScript no-emit, English/path
contracts and diff check passed. Independent read-only review found no
blocking issue. Real clean-main V6 host execution remains the delivery gate.
