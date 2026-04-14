import path from "node:path";
import fs from "node:fs";
import type { ParsedOutput, ValidationResult, CompleteContext } from "../types.js";
import { logger } from "../../../lib/logger.js";
import { processDesignCompletion } from "../../step-guardrails.js";

const VALID_DEVICE_TYPES = new Set(["DESKTOP", "TABLET", "MOBILE"]);

export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const errors: string[] = [];

  if ((parsed.status || "").toLowerCase() !== "done") {
    errors.push(`STATUS must be 'done' (got: '${parsed.status || ""}')`);
  }

  const deviceType = (parsed.device_type || "").toUpperCase();
  if (deviceType && !VALID_DEVICE_TYPES.has(deviceType)) {
    errors.push(`DEVICE_TYPE must be one of ${[...VALID_DEVICE_TYPES].join(", ")} (got: '${parsed.device_type}')`);
  }

  // SCREEN_MAP is optional at module level — pipeline has stronger fallbacks
  // (processDesignCompletion auto-recovers from Stitch API). We only fail
  // here on glaring agent-side errors.
  const screenMapRaw = parsed.screen_map || "";
  if (screenMapRaw) {
    try {
      const sm = JSON.parse(screenMapRaw);
      if (!Array.isArray(sm)) {
        errors.push("SCREEN_MAP must be a JSON array");
      } else if (sm.length > 0) {
        for (const [i, entry] of sm.entries()) {
          if (!entry || typeof entry !== "object" || !entry.screenId || !entry.name) {
            errors.push(`SCREEN_MAP[${i}] missing required screenId or name`);
            break;
          }
        }
      }
    } catch {
      errors.push("SCREEN_MAP is not valid JSON");
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function onComplete(ctx: CompleteContext): Promise<void> {
  const { runId, parsed, context } = ctx;

  // Stamp parsed values into context for downstream steps
  if (parsed.device_type) context["device_type"] = parsed.device_type.toUpperCase();
  if (parsed.design_system) context["design_system"] = parsed.design_system;
  if (parsed.screen_map) context["screen_map"] = parsed.screen_map;

  // Delegate to legacy guardrail for design contracts + design-tokens extraction
  // + screenshot persistence + SCREEN_MAP auto-recovery from Stitch API.
  // Treated as warning, not fatal — module validateOutput already passed.
  // (Fidelity check belongs to verify/final-test steps, not design — kept in step-ops.ts.)
  try {
    const designErr = await processDesignCompletion(runId, context);
    if (designErr) {
      logger.warn(`[module:design] processDesignCompletion warning (non-fatal): ${designErr.slice(0, 200)}`, { runId });
    }
  } catch (e) {
    logger.warn(`[module:design] processDesignCompletion error: ${String(e).slice(0, 200)}`, { runId });
  }
}
