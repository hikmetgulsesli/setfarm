import postgres from "postgres";
import { Socket } from "node:net";
import { buildTask6aPostgresSocketOptionsV1, parseTask6aPostgresSocketTransportV1 }
  from "./task6a-postgres-socket-transport-v1.js";

// Transport/lifecycle evidence only, NOT descriptor/grant/readiness/admission.
export function createTask6aSingleBackendSocketClientV1(value: unknown,
  onNotification?: (channel: string, payload: string) => void) {
  const refused = () => new Error("TASK6A_SINGLE_BACKEND_SOCKET_REFUSED");
  if (arguments.length < 1 || arguments.length > 2
    || (onNotification !== undefined && typeof onNotification !== "function")) throw refused();
  let candidate: ReturnType<typeof parseTask6aPostgresSocketTransportV1>;
  let base: ReturnType<typeof buildTask6aPostgresSocketOptionsV1>;
  const checkRuntime = () => {
    try {
      if (process.getuid?.() !== candidate.osUid || process.geteuid?.() !== candidate.osUid) throw refused();
      buildTask6aPostgresSocketOptionsV1(candidate, "pool", process.env);
    } catch { throw refused(); }
  };
  try {
    candidate = parseTask6aPostgresSocketTransportV1(value);
    checkRuntime(); base = buildTask6aPostgresSocketOptionsV1(candidate, "pool", process.env);
  } catch { throw refused(); }
  const socketPath = base.path!;
  let revoked = false, attempted = false, nativeSocketCreations = 0;
  let native: Socket | undefined, resolvedOptions: unknown;
  let closing: Promise<void> | undefined;
  let driver: ReturnType<typeof postgres> | undefined;
  const revoke = () => {
    revoked = true; native?.destroy(); // Fence before the driver's asynchronous drain.
    if (driver && !closing) {
      closing = driver.end({ timeout: 0 });
      void closing.catch(() => {}); // Caller close() still receives the failure.
    }
  };
  const socket = (options: unknown): Promise<Socket> => {
    try {
      if (revoked || attempted || options !== resolvedOptions) throw refused();
      checkRuntime();
    } catch { revoke(); throw refused(); }
    attempted = true; // Burn before allocation/await; hidden or replacement clients cannot enter.
    let opened: Socket;
    try { opened = new Socket(); } catch { revoke(); throw refused(); }
    native = opened; nativeSocketCreations += 1;
    opened.on("error", revoke); // Permanent: driver query rejection alone does not revoke.
    opened.on("close", revoke);
    return new Promise<Socket>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(fail, 10000); // Driver timer starts only AFTER custom socket resolves.
      function fail() {
        if (settled) return;
        settled = true; clearTimeout(timer); revoke(); reject(refused());
      }
      opened.once("error", fail);
      opened.once("close", fail);
      opened.once("connect", () => {
        try { checkRuntime(); if (revoked) throw refused(); }
        catch { fail(); return; }
        if (settled) return;
        settled = true; clearTimeout(timer); opened.removeListener("error", fail); resolve(opened);
      });
      try { opened.connect(socketPath); } catch { fail(); }
    });
  };
  const options = { ...base, max: 1, max_pipeline: 1, idle_timeout: null, max_lifetime: null,
    socket, onclose: revoke,
    onnotify: (channel: string, payload: string) => {
      if (revoked) return;
      try {
        checkRuntime();
        const returned: unknown = onNotification?.(channel, payload);
        // Callback is synchronous/undefined-returning. Revoke before draining
        // accidental async rejection; do not leave an unhandled promise.
        if (returned !== undefined) { revoke(); void Promise.resolve(returned).catch(() => {}); }
      }
      catch { revoke(); }
    } };
  // postgres3.4.8 supports socket/onnotify and null timers at runtime; its
  // declarations omit these fields/nulls. This is a closed internal option set.
  const sql = postgres(options as unknown as postgres.Options<{}>);
  driver = sql;
  resolvedOptions = sql.options;
  if (sql.options.path !== socketPath || sql.options.user !== candidate.user
    || sql.options.database !== candidate.database || sql.options.pass !== ""
    || sql.options.max !== 1 || sql.options.ssl !== false) {
    revoke(); throw refused();
  }
  Object.freeze(sql.options);
  const close = (): Promise<void> => { revoke(); return closing!; };
  return Object.freeze({ sql, revoke, close,
    observe: () => Object.freeze({ nativeSocketCreations, revoked }) });
}
