import { AsyncLocalStorage } from "node:async_hooks";

export type RuntimeCompletionOwnerCapability = Readonly<{
  requestId: string;
  ownerInstanceId: string;
  leaseExpiresAt: string;
  ownerAttemptCount: number;
}>;

const runtimeCompletionOwner = new AsyncLocalStorage<RuntimeCompletionOwnerCapability>();

/**
 * Bind the exact durable completion request to work performed on its behalf.
 * This is an in-process capability only: callers still have to pass every
 * durable row/claim check before a failure transition may consume it.
 */
export function runWithRuntimeCompletionOwner<T>(
  capability: RuntimeCompletionOwnerCapability,
  action: () => Promise<T>,
): Promise<T> {
  if (
    !capability.requestId.trim()
    || !capability.ownerInstanceId.trim()
    || !Number.isInteger(capability.ownerAttemptCount)
    || capability.ownerAttemptCount < 1
    || !Number.isFinite(Date.parse(capability.leaseExpiresAt))
  ) throw new Error("RUNTIME_COMPLETION_OWNER_CAPABILITY_INVALID");
  return runtimeCompletionOwner.run(Object.freeze({ ...capability }), action);
}

export function currentRuntimeCompletionOwnerCapability(): RuntimeCompletionOwnerCapability | undefined {
  return runtimeCompletionOwner.getStore();
}
