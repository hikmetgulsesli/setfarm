# Authenticated pre-32 residual absence host diagnostic

The V3 residual absence projector exists on clean main, but the authenticated
deployment-cutover bootstrap exposes only its V2 source. A local invocation of
the V3 module alone is not a host attestation: it lacks the bootstrap's pinned
source/output authentication, clean-main check, and sanitized refusal surface.

Add `inspect-pre32-residual-absence-annotation-v3 --json` as a separate no-write
diagnostic verb. It invokes the code-owned V3 observer with no caller input,
authenticates source and output with the existing bootstrap, validates the nested
V2 exact-journal annotation using the existing V2 checks, then validates the V3
wrapper, canonical hash, literal nonauthority fields, and exact identity/order
partition of remaining blockers. Reject extra fields, malformed or crossed
source, forged bounded classifications, and extra arguments. Refuse without
private error text. Do not change the V2 verb's output or authority.

The result retains all original physical blockers and says only that bounded
absence was observed during the held V7 interval. It is not a continuous
post-return exclusion, zero-owner proof, migration/admission authority, or
permission to switch selected CLI or services. No migration, live runtime,
database, symlink, or service write belongs to this slice.

## File Map

- `scripts/deployment-cutover.mjs`: new explicit verb, V3 invocation, strict
  wrapper/partition validation, sanitized refusal and distinct output field.
- `scripts/__tests__/deployment-cutover.test.js`: RED/GREEN success, authority,
  source/output tamper, argument, crossed source, and forged partition tests.
- `docs/superpowers/plans/2026-09-26-pre32-residual-absence-host.md`: execution
  and delivery checks.
