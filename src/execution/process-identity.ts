import { execFileSync } from "node:child_process";

import {
  ProcessIdentityV1Schema,
  sameProcessIdentity,
  type ProcessIdentityV1,
} from "./schemas/process-identity-v1.js";

type ProcessIdentityObserver = (pid: number) => ProcessIdentityV1 | undefined;
type ProcessSignaler = (pid: number, signal: NodeJS.Signals) => void;

export function parseObservedProcessIdentityRow(
  expectedPid: number,
  raw: string,
): ProcessIdentityV1 | undefined {
  if (!Number.isInteger(expectedPid) || expectedPid <= 0) return undefined;
  const match = raw.trim().match(/^(\d+)\s+(.+?\d{4})\s+(\d+)$/);
  if (!match) return undefined;
  const pid = Number(match[1]);
  const processGroupId = Number(match[3]);
  const processStartedAt = new Date(match[2]!);
  if (
    pid !== expectedPid
    || !Number.isInteger(processGroupId)
    || processGroupId <= 0
    || !Number.isFinite(processStartedAt.getTime())
  ) {
    return undefined;
  }
  return ProcessIdentityV1Schema.parse({
    schema: "setfarm.process-identity.v1",
    pid,
    processStartedAt: processStartedAt.toISOString(),
    processGroupId,
    source: "observed_os",
  });
}

export function observeProcessIdentity(pid: number): ProcessIdentityV1 | undefined {
  if (!Number.isInteger(pid) || pid <= 0) return undefined;
  try {
    const output = execFileSync(
      "ps",
      ["-o", "pid=,lstart=,pgid=", "-p", String(pid)],
      {
        encoding: "utf8",
        timeout: 2_000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return parseObservedProcessIdentityRow(pid, output);
  } catch {
    return undefined;
  }
}

export function processIdentityAllowsSignal(identity: ProcessIdentityV1): boolean {
  return identity.source !== "legacy-backfill";
}

export function signalProcessIfIdentityMatches(
  expected: ProcessIdentityV1,
  signal: NodeJS.Signals,
  options: Readonly<{
    observe?: ProcessIdentityObserver;
    signalProcess?: ProcessSignaler;
  }> = {},
): boolean {
  if (!processIdentityAllowsSignal(expected)) return false;
  const observed = (options.observe ?? observeProcessIdentity)(expected.pid);
  if (!observed || !sameProcessIdentity(expected, observed)) return false;
  try {
    (options.signalProcess ?? ((pid, requestedSignal) => process.kill(pid, requestedSignal)))(
      expected.pid,
      signal,
    );
    return true;
  } catch {
    return false;
  }
}
