import fs from "node:fs";
import path from "node:path";
import { ensureSupervisorArtifactsExcluded } from "../supervisor/state.js";
import type { StackContract } from "./types.js";

export function stackLedgerDir(workdir: string): string {
  return path.join(workdir, ".setfarm", "ledger");
}

export function stackContractPath(workdir: string): string {
  return path.join(stackLedgerDir(workdir), "stack-contract.json");
}

export function writeStackContract(workdir: string, contract: StackContract): string {
  ensureSupervisorArtifactsExcluded(workdir);
  const file = stackContractPath(workdir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...contract, updatedAt: new Date().toISOString() }, null, 2) + "\n");
  return file;
}

export function readStackContract(workdir: string): StackContract | null {
  const file = stackContractPath(workdir);
  try {
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as StackContract;
    return parsed?.schema === "setfarm.stack-contract.v1" ? parsed : null;
  } catch {
    return null;
  }
}

export function resolveAndWriteStackContract(
  workdir: string,
  resolver: () => StackContract,
): StackContract {
  const contract = resolver();
  writeStackContract(workdir, contract);
  return contract;
}
