export type RunRecoveryCoordinatorPorts = Readonly<{
  processTerminations: () => Promise<number>;
  processCompletions: () => Promise<number>;
  processOutbox?: () => Promise<number>;
}>;

export type RunRecoveryCoordinator = Readonly<{
  signal: (reason?: string) => Promise<void>;
  join: () => Promise<void>;
  close: () => Promise<void>;
  isRunning: () => boolean;
}>;

export function createRunRecoveryCoordinator(
  ports: RunRecoveryCoordinatorPorts,
  options: Readonly<{ maxDrainCycles?: number }> = {},
): RunRecoveryCoordinator {
  const maxDrainCycles = Math.max(1, Math.min(10_000, Math.trunc(options.maxDrainCycles ?? 1_000)));
  let signalGeneration = 0;
  let running: Promise<void> | undefined;
  let closed = false;

  const pump = async () => {
    let cycles = 0;
    for (;;) {
      cycles += 1;
      if (cycles > maxDrainCycles) throw new Error("RUN_RECOVERY_COORDINATOR_DRAIN_LIMIT_EXCEEDED");
      const observedGeneration = signalGeneration;

      // Cancellation/terminal intent always gets the first ownership attempt.
      // Completion then observes the same canonical run locks and either
      // continues or yields. This is the only lifecycle polling order.
      const terminationCount = await ports.processTerminations();
      const completionCount = await ports.processCompletions();
      const outboxCount = await ports.processOutbox?.() ?? 0;

      if (
        terminationCount === 0
        && completionCount === 0
        && outboxCount === 0
        && observedGeneration === signalGeneration
      ) return;
    }
  };

  const signal = (reason = "unspecified"): Promise<void> => {
    if (closed) return Promise.reject(new Error(`RUN_RECOVERY_COORDINATOR_CLOSED:${reason}`));
    signalGeneration += 1;
    if (!running) {
      running = pump().finally(() => {
        running = undefined;
      });
    }
    return running;
  };

  const join = async (): Promise<void> => {
    while (running) await running;
  };

  const close = async (): Promise<void> => {
    closed = true;
    await join();
  };

  return Object.freeze({
    signal,
    join,
    close,
    isRunning: () => Boolean(running),
  });
}
