#!/usr/bin/env node
import { installWorkflow } from "../installer/install.js";
import { uninstallAllWorkflows, uninstallWorkflow } from "../installer/uninstall.js";
import { updateWorkflow } from "../installer/update.js";
import { getWorkflowStatus } from "../installer/status.js";
import { runWorkflow } from "../installer/run.js";
import { getNextStep, completeStep } from "../installer/step-runner.js";
import { runOrchestrator, orchestrateOnce, listSpawnQueue, removeFromSpawnQueue } from "../daemon/orchestrator.js";

function printUsage() {
  process.stdout.write(
    [
      "antfarm workflow install <url>",
      "antfarm workflow update <workflow-id> [<url>]",
      "antfarm workflow uninstall <workflow-id>",
      "antfarm workflow uninstall --all",
      "antfarm workflow status <task-title>",
      "antfarm workflow run <workflow-id> <task-title>",
      "antfarm workflow next <task-title>",
      "antfarm workflow complete <task-title> <success|fail> [output]",
      "",
      "antfarm daemon start [--verbose]     Start the orchestrator daemon",
      "antfarm daemon once [--verbose]      Run a single orchestration pass",
      "antfarm daemon queue                 List pending spawn requests",
      "antfarm daemon dequeue <file>        Remove a spawn request",
    ].join("\n") + "\n",
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }
  const [group, action, target] = args;
  
  if (group === "daemon") {
    await handleDaemon(args.slice(1));
    return;
  }
  
  if (group !== "workflow") {
    printUsage();
    process.exit(1);
  }
  if (!target && action !== "next" && action !== "complete") {
    printUsage();
    process.exit(1);
  }

  if (action === "install") {
    await installWorkflow({ source: target });
    return;
  }

  if (action === "update") {
    const source = args[3];
    await updateWorkflow({ workflowId: target, source });
    return;
  }

  if (action === "uninstall") {
    if (target === "--all" || target === "all") {
      await uninstallAllWorkflows();
      return;
    }
    await uninstallWorkflow({ workflowId: target });
    return;
  }

  if (action === "status") {
    const result = await getWorkflowStatus(target);
    if (result.status === "not_found") {
      process.stdout.write(`${result.message}\n`);
      return;
    }
    const run = result.run;
    process.stdout.write(
      [
        `Workflow: ${run.workflowName ?? run.workflowId}`,
        `Task: ${run.taskTitle}`,
        `Status: ${run.status}`,
        `Lead: ${run.leadAgentId}`,
        `Lead Session: ${run.leadSessionLabel}`,
        `Updated: ${run.updatedAt}`,
      ].join("\n") + "\n",
    );
    return;
  }

  if (action === "run") {
    const taskTitle = args.slice(3).join(" ").trim();
    if (!taskTitle) {
      process.stderr.write("Missing task title.\n");
      printUsage();
      process.exit(1);
    }
    const run = await runWorkflow({ workflowId: target, taskTitle });
    process.stdout.write(
      [
        `Run: ${run.id}`,
        `Workflow: ${run.workflowName ?? run.workflowId}`,
        `Task: ${run.taskTitle}`,
        `Lead: ${run.leadAgentId}`,
        `Lead Session: ${run.leadSessionLabel}`,
      ].join("\n") + "\n",
    );
    return;
  }

  if (action === "next") {
    const result = await getNextStep(target);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }

  if (action === "complete") {
    const success = args[3] === "success";
    const output = args.slice(4).join(" ").trim() || "";
    const result = await completeStep({ taskTitle: target, output, success });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }

  process.stderr.write(`Unknown action: ${action}\n`);
  printUsage();
  process.exit(1);
}

async function handleDaemon(args: string[]): Promise<void> {
  const action = args[0];
  const verbose = args.includes("--verbose") || args.includes("-v");
  const pollInterval = parseInt(process.env.ANTFARM_POLL_INTERVAL ?? "15000", 10);
  
  const config = { pollIntervalMs: pollInterval, verbose };
  
  if (action === "start") {
    await runOrchestrator(config);
    return;
  }
  
  if (action === "once") {
    await orchestrateOnce(config);
    return;
  }
  
  if (action === "queue") {
    const queue = await listSpawnQueue(config);
    if (queue.length === 0) {
      process.stdout.write("No pending spawn requests.\n");
    } else {
      for (const req of queue) {
        process.stdout.write(`${req.file}: ${req.agentId} - ${req.task.slice(0, 50)}...\n`);
      }
    }
    return;
  }
  
  if (action === "dequeue") {
    const file = args[1];
    if (!file) {
      process.stderr.write("Missing file name.\n");
      process.exit(1);
    }
    await removeFromSpawnQueue(file, config);
    process.stdout.write(`Removed: ${file}\n`);
    return;
  }
  
  process.stderr.write(`Unknown daemon action: ${action}\n`);
  printUsage();
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
