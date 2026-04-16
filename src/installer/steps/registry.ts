import type { StepModule } from "./types.js";
import { planModule } from "./01-plan/module.js";
import { designModule } from "./02-design/module.js";
import { storiesModule } from "./03-stories/module.js";
import { setupRepoModule } from "./04-setup-repo/module.js";
import { setupBuildModule } from "./05-setup-build/module.js";
import { implementModule } from "./06-implement/module.js";
import { verifyModule } from "./07-verify/module.js";

const modules = new Map<string, StepModule>();

function register(m: StepModule): void {
  if (modules.has(m.id)) throw new Error(`duplicate step module: ${m.id}`);
  modules.set(m.id, m);
}

register(planModule);
register(designModule);
register(storiesModule);
register(setupRepoModule);
register(setupBuildModule);
register(implementModule);
register(verifyModule);

export function get(id: string): StepModule | undefined {
  return modules.get(id);
}

export function has(id: string): boolean {
  return modules.has(id);
}

export function list(): string[] {
  return [...modules.keys()];
}
