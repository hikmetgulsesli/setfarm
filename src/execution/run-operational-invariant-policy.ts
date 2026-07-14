/**
 * Invariants that an explicit, snapshot-fenced stop may recover by proving
 * runtime absence again under the termination owner.
 *
 * These states must still block resume and every success transition.  Stop is
 * the bounded escape hatch: it may only proceed when the complete operational
 * projection contains no other invariant class.
 */
const STOP_RECOVERABLE_INVARIANTS = new Set([
  "COMPLETION_REQUEST_QUARANTINED",
  "RUNTIME_SESSION_QUARANTINED",
]);

export function isStopRecoverableInvariantCode(code: string): boolean {
  return STOP_RECOVERABLE_INVARIANTS.has(code);
}

export function hasStopBlockingInvariant(
  invariants: readonly Readonly<{ code: string }>[],
): boolean {
  return invariants.some((invariant) => !isStopRecoverableInvariantCode(invariant.code));
}
