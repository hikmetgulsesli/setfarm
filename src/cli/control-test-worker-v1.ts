#!/usr/bin/env node
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { acceptSelectedManualWorkerChannelV1 } from "../execution/manual-test-worker-channel-v1.js";
import { ControlWorkerFatalErrorV1, isControlWorkerFatalErrorV1 } from "../execution/schemas/manual-control-worker-channel-v1.js";
async function main(): Promise<void> {
    const self = fileURLToPath(import.meta.url);
    if (!self.endsWith(".js") || process.argv[1] !== self || fs.realpathSync(self) !== self)
        throw new ControlWorkerFatalErrorV1("CONTROL_CHANNEL_INVALID");
    const { intent, custody } = await acceptSelectedManualWorkerChannelV1();
    const entry = await import("../installation/fresh-installation-entry-v1.js");
    const db = await import("../db-pg.js");
    try {
        await entry.prepareFreshInstallationOperationalEntryV1();
        entry.assertFreshInstallationOperationalEntryV1();
        const { runSelectedManualControlJobV1 } = await import("../execution/manual-test-worker-v1.js");
        await runSelectedManualControlJobV1(intent, custody);
    }
    finally {
        await db.pgClose();
    }
}
void main().catch(error => {
    process.stderr.write(`${isControlWorkerFatalErrorV1(error) ? error.code : "CONTROL_CUSTODY_UNCERTAIN"}\n`);
    process.exitCode = 1;
}).finally(() => {
    // Closure is already acknowledged, or this process failed without a terminal
    // claim. The broker observes this original channel's end in both cases.
    if (process.connected)
        process.disconnect?.();
});
