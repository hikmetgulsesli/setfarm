// Test-only diagnostic ledger. Its ports do not confer native or DB authority.
export type Task6aBaselineRoleV1 = "ACCESS" | "BASE" | "OWNER";
type Ports = Readonly<{
  contextIsCurrent(): boolean;
  checkpoint(): void;
  event(name: string): void;
}>;
type RecordV1 = { role: Task6aBaselineRoleV1; state: "pending" | "fulfilled" | "rejected" };

export function createTask6aNativeBaselineObserverV1(ports: Ports) {
  // Capture this occurrence's ports; later context replacement is a failure,
  // not permission to borrow the replacement context for old originals.
  const { contextIsCurrent, checkpoint, event } = ports;
  const records: RecordV1[] = [];
  const originals: Promise<void>[] = [];
  const observations: Promise<void>[] = [];
  const failures: { stage: string; error: unknown }[] = [];
  const roles: readonly Task6aBaselineRoleV1[] = ["ACCESS", "BASE", "OWNER"];
  let transaction: unknown;

  function fail(stage: string, error: unknown) { failures.push({ stage, error }); }
  function diagnostic(stage: string, action: () => void) {
    try { action(); } catch (error) { fail(stage, error); }
  }
  function checkOccurrence(stage: string) {
    diagnostic(`${stage}:context`, () => {
      if (!contextIsCurrent()) throw Error("BASELINE_CONTEXT_NOT_CURRENT");
    });
    diagnostic(`${stage}:checkpoint`, checkpoint);
  }
  function observedEvent(name: string) { diagnostic(`${name}:event`, () => event(name)); }

  function observe(role: Task6aBaselineRoleV1, original: Promise<void>, tx: unknown, owner?: string) {
    // Custody comes FIRST, even when any subsequent diagnostic refuses.
    const position = records.length;
    const record: RecordV1 = { role, state: "pending" };
    originals.push(original); records.push(record);
    diagnostic(`${role}:reaction-install`, () => {
      const observation = original.then(() => {
        record.state = "fulfilled";
        checkOccurrence(`${role}:fulfilled`); observedEvent(`baseline-fulfilled:${role}`);
      }, () => {
        // A genuine producer rejection is not itself a sensor malfunction.
        record.state = "rejected";
        checkOccurrence(`${role}:rejected`); observedEvent(`baseline-rejected:${role}`);
      });
      observations.push(observation.catch(error => { fail(`${role}:reaction`, error); }));
    });
    checkOccurrence(`${role}:call`);
    diagnostic(`${role}:sequence`, () => {
      if (roles[position] !== role) throw Error("BASELINE_ROLE_ORDER_REFUSED");
      if (records.slice(0, position).some(previous => previous.state !== "fulfilled")) {
        throw Error("BASELINE_PREDECESSOR_NOT_FULFILLED");
      }
      if (position === 0) transaction = tx;
      else if (transaction !== tx) throw Error("BASELINE_TRANSACTION_REPLACED");
      if (role === "OWNER" && owner !== "setfarm_owner") throw Error("BASELINE_OWNER_REFUSED");
    });
    observedEvent(`baseline-call:${role}`);
  }

  function canonicalRequested() {
    checkOccurrence("canonical-request");
    diagnostic("canonical-request:sequence", () => {
      if (records.length !== roles.length || records.some((record, i) =>
        record.role !== roles[i] || record.state !== "fulfilled")) {
        throw Error("CANONICAL_BEFORE_COMPLETE_BASELINE");
      }
    });
    observedEvent("canonical-request");
  }

  async function joinOriginals() {
    // Drain originals AND their reactions. Enrollment during a drain is also
    // retained; no timeout or diagnostic failure releases a pending original.
    let count: number;
    do {
      count = originals.length;
      await Promise.all([...originals.map(original => original.then(() => {}, () => {})), ...observations]);
    } while (originals.length !== count);
  }

  function snapshot() {
    return {
      failed: failures.length !== 0,
      records: records.map(record => ({ ...record })),
      failures: failures.map(failure => ({ ...failure })),
      fulfilled: records.filter(record => record.state === "fulfilled").map(record => record.role),
    };
  }
  return Object.freeze({ observe, canonicalRequested, joinOriginals, snapshot });
}
