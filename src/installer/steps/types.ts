// Step module contract — each pipeline step (plan, design, stories, etc.)
// exports a StepModule that owns its prompt, context injection, output
// validation and side effects. Core pipeline (step-ops.ts) delegates to
// these modules so a single 3800-line file doesn't own every step's logic.

export interface ClaimContext {
  runId: string;
  stepId: string;
  task: string;
  context: Record<string, string>;
}

export interface PromptContext {
  runId: string;
  task: string;
  context: Record<string, string>;
}

export interface ParsedOutput {
  status?: string;
  [key: string]: string | undefined;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface CompleteContext {
  runId: string;
  stepId: string;
  parsed: ParsedOutput;
  context: Record<string, string>;
}

export interface StepModule {
  id: string;
  type: "single" | "loop";
  agentRole: string;

  injectContext(ctx: ClaimContext): Promise<void>;
  buildPrompt(ctx: PromptContext): string;
  // Optional: mutate parsed in-place (e.g. auto-fix REPO path) before validation
  normalize?(parsed: ParsedOutput): void;
  validateOutput(parsed: ParsedOutput): ValidationResult;
  onComplete?(ctx: CompleteContext): Promise<void>;

  requiredOutputFields: string[];
  maxPromptSize: number;
}
