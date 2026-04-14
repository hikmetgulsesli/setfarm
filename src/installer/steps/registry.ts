import type { StepModule } from "./types.js";
import { planModule } from "./01-plan/module.js";
import { designModule } from "./02-design/module.js";
import { storiesModule } from "./03-stories/module.js";

const modules = new Map<string, StepModule>();

function register(m: StepModule): void {
  if (modules.has(m.id)) throw new Error(`duplicate step module: ${m.id}`);
  modules.set(m.id, m);
}

register(planModule);
register(designModule);
register(storiesModule);

export function get(id: string): StepModule | undefined {
  return modules.get(id);
}

export function has(id: string): boolean {
  return modules.has(id);
}

export function list(): string[] {
  return [...modules.keys()];
}
