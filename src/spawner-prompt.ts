import os from "node:os";
import path from "node:path";
import { resolveSetfarmCli } from "./installer/paths.js";

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function buildClaimBootstrapScript(claimFile: string, outputFile: string): string {
  return buildResolvedClaimBootstrapScript({
    claimFile,
    outputFile,
    stepId: "",
    workdir: defaultAgentScratch,
    taskPreview: "",
  });
}

export function claimTaskPreview(input: unknown): string {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const record = input as Record<string, unknown>;
    return String(record["task"] || record["current_story_title"] || record["story_title"] || "").slice(0, 1200);
  }
  return String(input || "").slice(0, 1200);
}

export function buildResolvedClaimBootstrapScript(params: {
  claimFile: string;
  outputFile: string;
  stepId: string;
  workdir: string;
  taskPreview?: string;
}): string {
  return `#!/usr/bin/env bash
set -euo pipefail

CLAIM_FILE=${shellQuote(params.claimFile)}
OUTPUT_FILE=${shellQuote(params.outputFile)}
STEP_ID=${shellQuote(params.stepId)}
WORKDIR=${shellQuote(params.workdir || defaultAgentScratch)}
TASK_PREVIEW=${shellQuote(String(params.taskPreview || "").slice(0, 1200))}
export CLAIM_FILE OUTPUT_FILE STEP_ID WORKDIR

mkdir -p "$WORKDIR"
cd "$WORKDIR"
case "$(pwd)" in
  "$HOME"/.openclaw/setfarm-repo|"$HOME"/.openclaw/setfarm-repo/*)
    echo FATAL_PLATFORM_CWD
    exit 1
    ;;
esac

printf 'STEP_ID=%s\\nWORKDIR=%s\\n' "$STEP_ID" "$(pwd)"
printf '%s' "$TASK_PREVIEW" | head -c 1200
echo
`;
}

export function buildPreclaimedPrompt(params: {
  wfId: string;
  role: string;
  outputFile: string;
  claimFile: string;
  bootstrapFile: string;
}): string {
  const cli = resolveSetfarmCli();
  const cliCommand = "/usr/bin/node " + cli;
  const stepIdCommand = `STEP_ID=$(node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1],"utf8")).stepId||"")' ${shellQuote(params.claimFile)})`;
  return `Setfarm claim ready. First action MUST be exec. No prose or HEARTBEAT before exec.

CLAIM_FILE=${params.claimFile}
OUTPUT_FILE=${params.outputFile}
BOOTSTRAP_FILE=${params.bootstrapFile}

First exec command:
bash ${shellQuote(params.bootstrapFile)}

Do ${params.wfId}/${params.role} work in WORKDIR only. Read the claim at ${params.claimFile} for exact requirements.
Important: OpenClaw read/edit/write tools resolve relative paths against the configured agent workspace, not the shell cwd. When using read/edit/write tools for project files, use absolute paths under WORKDIR, for example "$WORKDIR/src/App.tsx". For exec commands, rerun the bootstrap command above or pass workdir="$WORKDIR" after resolving it.
Do not rely on CLAIM_FILE, OUTPUT_FILE, STEP_ID, or WORKDIR shell variables persisting across separate exec calls; each exec starts a fresh shell. If you need the claim again, use the literal path ${params.claimFile}. Write final output to the literal path ${params.outputFile}. Do NOT run step peek/claim. No subagents/background delegation. No PR actions unless claim explicitly owns PR work.
For normal quality findings in verify/review/QA/final-test, do NOT use step fail. Write STATUS: retry with concise findings and call step complete so the platform can route the batched fix back to implement. Use step fail only for infrastructure/unrecoverable execution failures.

Complete with:
cat > ${shellQuote(params.outputFile)} <<'SETFARM_EOF'
STATUS: done
<required claim output keys>
SETFARM_EOF
${stepIdCommand}; ${cliCommand} step complete "$STEP_ID" --file ${shellQuote(params.outputFile)}

Fail with: ${stepIdCommand}; ${cliCommand} step fail "$STEP_ID" "specific reason"
After complete/fail, reply HEARTBEAT_OK and stop.`;
}

export const defaultAgentScratch = path.join(os.homedir(), ".openclaw", "workspace", "agent-scratch");
