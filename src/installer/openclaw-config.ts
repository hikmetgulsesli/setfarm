import fs from "node:fs/promises";
import JSON5 from "json5";
import { resolveOpenClawConfigPath } from "./paths.js";
import { validateConfig, logValidationErrors, atomicWriteSync } from "./config-schema.js";
import { logger } from "../lib/logger.js";

export type OpenClawConfig = {
  cron?: {
    sessionRetention?: string | false;
  };
  session?: {
    maintenance?: {
      mode?: "enforce" | "warn";
      pruneAfter?: string | number;
      pruneDays?: number;
      maxEntries?: number;
      rotateBytes?: number | string;
    };
  };
  agents?: {
    defaults?: {
      subagents?: {
        allowAgents?: string[];
      };
      sandbox?: {
        mode?: string;
      };
    };
    list?: Array<Record<string, unknown>>;
  };
  tools?: Record<string, unknown>;
  providers?: Record<string, unknown>;
};

export async function readOpenClawConfig(): Promise<{ path: string; config: OpenClawConfig }> {
  const path = resolveOpenClawConfigPath();
  try {
    const raw = await fs.readFile(path, "utf-8");
    const config = JSON5.parse(raw) as OpenClawConfig;

    // Validate config against known production rules
    const errors = validateConfig(config);
    if (errors.length > 0) {
      logValidationErrors(errors);
    }

    return { path, config };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read OpenClaw config at ${path}: ${message}`);
  }
}

export async function writeOpenClawConfig(
  filePath: string,
  config: OpenClawConfig,
): Promise<void> {
  // Validate before writing to prevent persisting bad config
  const errors = validateConfig(config);
  if (errors.length > 0) {
    const hasErrors = logValidationErrors(errors);
    if (hasErrors) {
      logger.warn(`[config] Writing config with ${errors.filter(e => e.severity === "error").length} validation error(s)`);
    }
  }

  const content = `${JSON.stringify(config, null, 2)}\n`;
  // Atomic write: temp file → rename (prevents corruption on crash)
  atomicWriteSync(filePath, content);
}
