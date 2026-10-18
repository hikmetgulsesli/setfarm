/** Test-only PostgreSQL connection loss after the server commits. */
import net, { type Socket } from "node:net";

export type CommitAckLossProxy = Readonly<{
  adminUrl: string;
  arm(): void;
  dropped(): number;
  close(): Promise<void>;
}>;

const MAX_FRAME_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_CONNECTIONS = 8;
const MAX_ACCEPTED_CONNECTIONS = 32;
const CONNECT_MS = 5_000;
const IDLE_MS = 15_000;
const CONNECTION_MS = 120_000;
const PROXY_MS = 180_000;
const CLOSE_MS = 2_000;
const COMMIT = Buffer.from("COMMIT\0", "ascii");

/**
 * Plain PostgreSQL framing only: callers must use SSL-off connections and no URL
 * options. The next exact backend CommandComplete(COMMIT) after arm() is lost.
 * No frontend statements or credentials are parsed, retained separately or logged.
 */
export async function createCommitAckLossProxy(adminUrl: string): Promise<CommitAckLossProxy> {
  let endpoint: URL;
  try { endpoint = new URL(adminUrl); }
  catch { throw new Error("COMMIT_ACK_PROXY_ENDPOINT_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(endpoint.protocol)
    || !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname)
    || endpoint.search || endpoint.hash || !endpoint.username
    || endpoint.pathname.length <= 1) throw new Error("COMMIT_ACK_PROXY_ENDPOINT_INVALID");
  const upstreamPort = Number(endpoint.port || "5432");
  if (!Number.isInteger(upstreamPort) || upstreamPort < 1 || upstreamPort > 65535) {
    throw new Error("COMMIT_ACK_PROXY_ENDPOINT_INVALID");
  }
  const upstreamHost = endpoint.hostname === "[::1]" ? "::1" : endpoint.hostname;
  const owned = new Set<{ client: Socket; upstream: Socket; destroy(): void }>();
  let accepted = 0;
  let bytes = 0;
  let armed = false;
  let everArmed = false;
  let losses = 0;
  let closed = false;
  let closing: Promise<void> | undefined;
  let lifetime: ReturnType<typeof setTimeout> | undefined;

  const server = net.createServer({ allowHalfOpen: false }, client => {
    if (closed || owned.size >= MAX_CONNECTIONS || ++accepted > MAX_ACCEPTED_CONNECTIONS) {
      client.destroy();
      return;
    }
    client.pause(); // Never forward startup/auth data until the upstream is loopback.
    client.setNoDelay(true);
    const upstream = new net.Socket({ allowHalfOpen: false });
    upstream.setNoDelay(true);
    let dead = false;
    let upstreamEnded = false;
    let blocked = false;
    let buffered = Buffer.alloc(0);
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    let connectionTimer: ReturnType<typeof setTimeout> | undefined;

    function clearTimers(): void {
      if (connectTimer) clearTimeout(connectTimer);
      if (connectionTimer) clearTimeout(connectionTimer);
      connectTimer = connectionTimer = undefined;
    }
    const pair = {
      client, upstream,
      destroy(): void {
        if (dead) return;
        dead = true;
        buffered = Buffer.alloc(0);
        clearTimers();
        client.destroy();
        upstream.destroy();
        owned.delete(pair);
      },
    };
    owned.add(pair);
    function account(length: number): boolean {
      bytes += length; // Lifetime budget counts both directions once on receipt.
      if (bytes <= MAX_TOTAL_BYTES) return true;
      void close();
      return false;
    }
    function parseBackend(): void {
      while (!dead && !blocked && buffered.length >= 5) {
        const length = buffered.readUInt32BE(1);
        const frameBytes = length + 1; // Length includes its four bytes, not type.
        if (length < 4 || frameBytes > MAX_FRAME_BYTES) { pair.destroy(); return; }
        if (buffered.length < frameBytes) return;
        const frame = buffered.subarray(0, frameBytes);
        buffered = buffered.subarray(frameBytes);
        if (armed && frame[0] === 0x43 && length === 4 + COMMIT.length
          && frame.subarray(5).equals(COMMIT)) {
          armed = false;
          losses += 1;
          pair.destroy(); // Server committed; neither this C nor following Z escapes.
          return;
        }
        if (!client.write(frame)) {
          blocked = true;
          upstream.pause();
          client.once("drain", () => {
            if (dead || closed) return;
            blocked = false;
            parseBackend();
            if (!dead && !blocked) upstream.resume();
          });
        }
      }
    }
    client.on("data", (chunk: Buffer) => {
      if (dead || !account(chunk.length)) return;
      if (!upstream.write(chunk)) {
        client.pause();
        upstream.once("drain", () => { if (!dead && !closed) client.resume(); });
      }
    });
    upstream.on("data", (chunk: Buffer) => {
      if (dead || !account(chunk.length)) return;
      if (buffered.length + chunk.length > MAX_FRAME_BYTES) { pair.destroy(); return; }
      buffered = buffered.length === 0 ? chunk : Buffer.concat([buffered, chunk]);
      parseBackend();
    });
    client.on("error", () => pair.destroy());
    upstream.on("error", () => pair.destroy());
    client.once("end", () => { if (!dead) upstream.end(); });
    upstream.once("end", () => {
      upstreamEnded = true;
      if (buffered.length !== 0) pair.destroy();
      else if (!dead) client.end();
    });
    client.once("close", () => pair.destroy());
    upstream.once("close", () => {
      if (!upstreamEnded) pair.destroy();
      else if (!dead) client.end(); // Allow already-forwarded bytes to drain.
    });
    client.setTimeout(IDLE_MS, () => pair.destroy());
    upstream.setTimeout(IDLE_MS, () => pair.destroy());
    connectTimer = setTimeout(() => pair.destroy(), CONNECT_MS);
    connectionTimer = setTimeout(() => pair.destroy(), CONNECTION_MS);
    upstream.once("connect", () => {
      if (connectTimer) clearTimeout(connectTimer);
      connectTimer = undefined;
      if (dead || closed || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(upstream.remoteAddress || "")) {
        pair.destroy();
        return;
      }
      client.resume();
    });
    upstream.connect({ host: upstreamHost, port: upstreamPort });
  });

  /** Idempotent, bounded shutdown; never touches sockets not accepted/created here. */
  function close(): Promise<void> {
    if (closing) return closing;
    closed = true;
    armed = false;
    if (lifetime) clearTimeout(lifetime);
    for (const pair of owned) pair.destroy();
    closing = new Promise<void>((resolve, reject) => {
      let finished = false;
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        reject(new Error("COMMIT_ACK_PROXY_CLOSE_UNCONFIRMED"));
      }, CLOSE_MS);
      function done(): void {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve();
      }
      try { server.close(done); } catch { done(); }
    });
    return closing;
  }
  server.on("error", () => { void close(); });
  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (): void => reject(new Error("COMMIT_ACK_PROXY_LISTEN_FAILED"));
      server.once("error", fail);
      server.listen({ host: "127.0.0.1", port: 0, backlog: MAX_CONNECTIONS }, () => {
        server.off("error", fail);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string" || address.port === 5432 || closed) {
      throw new Error("COMMIT_ACK_PROXY_LISTEN_FAILED");
    }
    const proxied = new URL(endpoint);
    proxied.hostname = "127.0.0.1";
    proxied.port = String(address.port);
    lifetime = setTimeout(() => { void close(); }, PROXY_MS);
    lifetime.unref();
    return Object.freeze({
      adminUrl: proxied.href,
      arm(): void {
        if (closed || everArmed) throw new Error("COMMIT_ACK_PROXY_NOT_ARMABLE");
        everArmed = true;
        armed = true;
      },
      dropped: () => losses,
      close,
    });
  } catch {
    await close();
    throw new Error("COMMIT_ACK_PROXY_LISTEN_FAILED");
  }
}
