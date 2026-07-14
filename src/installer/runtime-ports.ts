import net from "node:net";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type RuntimePortBand = "frontend" | "backend" | "preview";

const PORT_BANDS: Record<RuntimePortBand, { base: number; size: number }> = {
  backend: { base: 4100, size: 900 },
  frontend: { base: 5100, size: 900 },
  preview: { base: 6100, size: 900 },
};

// Fetch and Chromium reject these ports before opening a socket. A port can
// therefore be free at the TCP layer while remaining unusable by every
// browser-backed evidence driver. Keep the full Fetch bad-port table here so
// all runtime bands share one allocation invariant.
const FETCH_BAD_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79,
  87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137,
  139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720,
  1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667,
  6668, 6669, 6697, 10080,
]);

export interface RuntimeAllocationInput {
  runId: string;
  runNumber?: number | null;
  band: RuntimePortBand;
  preferredPort?: number | null;
  host?: string;
}

export interface RuntimeAllocation {
  band: RuntimePortBand;
  host: string;
  port: number;
  url: string;
  preferred: boolean;
}

export interface RunRuntimeArtifactInput {
  repo: string;
  runId: string;
  runNumber?: number | null;
  stepId: string;
  runtime: RuntimeAllocation;
  status?: "allocated" | "running" | "passed" | "failed" | "stopped";
}

export function portBandRange(band: RuntimePortBand): { base: number; max: number; size: number } {
  const spec = PORT_BANDS[band];
  return { base: spec.base, max: spec.base + spec.size - 1, size: spec.size };
}

export function runtimeUrl(host: string, port: number, path = "/"): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `http://${host}:${port}${suffix === "/" ? "" : suffix}`;
}

export function isFetchSafeRuntimePort(port: number): boolean {
  return Number.isInteger(port)
    && port >= 1
    && port <= 65_535
    && !FETCH_BAD_PORTS.has(port);
}

function deterministicOffset(runId: string, runNumber: number | null | undefined, size: number): number {
  if (typeof runNumber === "number" && Number.isFinite(runNumber) && runNumber > 0) return runNumber % size;
  const digest = crypto.createHash("sha1").update(runId || "setfarm").digest();
  return digest.readUInt32BE(0) % size;
}

export function isPortFree(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

export async function allocateRuntimePort(input: RuntimeAllocationInput): Promise<RuntimeAllocation> {
  const host = input.host || "127.0.0.1";
  const { base, max, size } = portBandRange(input.band);
  const candidates: number[] = [];
  if (input.preferredPort && input.preferredPort >= base && input.preferredPort <= max) {
    candidates.push(input.preferredPort);
  }

  const offset = deterministicOffset(input.runId, input.runNumber, size);
  for (let i = 0; i < size; i += 1) {
    candidates.push(base + ((offset + i) % size));
  }

  const seen = new Set<number>();
  for (const port of candidates) {
    if (seen.has(port)) continue;
    seen.add(port);
    if (!isFetchSafeRuntimePort(port)) continue;
    if (await isPortFree(port, host)) {
      return {
        band: input.band,
        host,
        port,
        url: runtimeUrl(host, port),
        preferred: port === input.preferredPort,
      };
    }
  }

  throw new Error(`No free ${input.band} runtime port in ${base}-${max}`);
}

export function writeRunRuntimeArtifact(input: RunRuntimeArtifactInput): string {
  const setfarmDir = path.join(input.repo, ".setfarm");
  fs.mkdirSync(setfarmDir, { recursive: true });
  const relPath = ".setfarm/run-runtime.json";
  const artifact = {
    schema: "setfarm.run-runtime.v1",
    generatedAt: new Date().toISOString(),
    runId: input.runId,
    runNumber: input.runNumber ?? null,
    stepId: input.stepId,
    status: input.status || "allocated",
    runtime: input.runtime,
    localUrl: input.runtime.url,
    host: input.runtime.host,
    port: input.runtime.port,
    band: input.runtime.band,
  };
  fs.writeFileSync(path.join(input.repo, relPath), JSON.stringify(artifact, null, 2));
  return relPath;
}
