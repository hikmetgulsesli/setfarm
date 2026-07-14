import { createHash } from "node:crypto";

import { z } from "zod";

import {
  RequirementIdSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "../schemas/common-v1.js";

export const TASK_REQUIREMENT_SOURCE_LOCATOR = "task/input.txt";

export const RequirementSourceSpanV1Schema = z.object({
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  startLine: z.number().int().positive(),
  startColumn: z.number().int().nonnegative(),
  endLine: z.number().int().positive(),
  endColumn: z.number().int().nonnegative(),
}).strict().superRefine((value, context) => {
  if (value.endOffset <= value.startOffset) {
    context.addIssue({
      code: "custom",
      path: ["endOffset"],
      message: "Requirement source spans must be non-empty and forward-only",
    });
  }
});

export const RequirementClauseSourceV1Schema = z.object({
  sourceHash: Sha256Schema,
  locator: z.literal(TASK_REQUIREMENT_SOURCE_LOCATOR),
  sourceRef: z.string().regex(/^task\/input\.txt#chars=\d+-\d+$/),
  span: RequirementSourceSpanV1Schema,
}).strict();

export const TaskRequirementClauseV1Schema = z.object({
  id: RequirementIdSchema,
  normalizedClause: z.string().min(1).max(20_000),
  clauseHash: Sha256Schema,
  sources: z.array(RequirementClauseSourceV1Schema).min(1).max(1_000),
}).strict().superRefine((value, context) => {
  const expectedHash = sha256(value.normalizedClause);
  if (value.clauseHash !== expectedHash) {
    context.addIssue({
      code: "custom",
      path: ["clauseHash"],
      message: "Requirement clause hash must bind the normalized clause",
    });
  }
  if (value.id !== requirementId(expectedHash)) {
    context.addIssue({
      code: "custom",
      path: ["id"],
      message: "Requirement ID must be derived from the normalized clause hash",
    });
  }
  if (!hasUniqueStrings(value.sources.map((source) => source.sourceRef))) {
    context.addIssue({
      code: "custom",
      path: ["sources"],
      message: "Requirement source refs must be unique",
    });
  }
  value.sources.forEach((source, index) => {
    const expectedRef = `${source.locator}#chars=${source.span.startOffset}-${source.span.endOffset}`;
    if (source.sourceRef !== expectedRef) {
      context.addIssue({
        code: "custom",
        path: ["sources", index, "sourceRef"],
        message: "Requirement source ref must bind the exact source span",
      });
    }
  });
});

export const TaskRequirementLedgerV1Schema = z.object({
  schema: z.literal("setfarm.task-requirement-ledger.v1"),
  sourceHash: Sha256Schema,
  sourceLocator: z.literal(TASK_REQUIREMENT_SOURCE_LOCATOR),
  requirements: z.array(TaskRequirementClauseV1Schema).min(1).max(1_000),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.requirements.map((requirement) => requirement.id))) {
    context.addIssue({
      code: "custom",
      path: ["requirements"],
      message: "Task requirement IDs must be unique",
    });
  }
  value.requirements.forEach((requirement, requirementIndex) => {
    requirement.sources.forEach((source, sourceIndex) => {
      if (source.sourceHash !== value.sourceHash) {
        context.addIssue({
          code: "custom",
          path: ["requirements", requirementIndex, "sources", sourceIndex, "sourceHash"],
          message: "Requirement source hash must match the task ledger",
        });
      }
    });
  });
});

export type TaskRequirementClauseV1 = z.infer<typeof TaskRequirementClauseV1Schema>;
export type TaskRequirementLedgerV1 = z.infer<typeof TaskRequirementLedgerV1Schema>;

function sha256(value: string): string {
  return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

function requirementId(clauseHash: string): string {
  return `REQ_${clauseHash.slice(0, 16).toUpperCase()}`;
}

function lineColumn(source: string, offset: number): { line: number; column: number } {
  const prior = source.slice(0, offset);
  const lines = prior.split(/\r\n|\r|\n/);
  return { line: lines.length, column: lines.at(-1)?.length ?? 0 };
}

function trimClause(source: string, start: number, end: number): { start: number; end: number; text: string } | undefined {
  let raw = source.slice(start, end);
  const leading = raw.match(/^\s*(?:(?:[-*+\u2022\u2023\u25e6]|\d+[.)])\s+)?/)?.[0].length ?? 0;
  start += leading;
  raw = source.slice(start, end);
  const trailing = raw.match(/\s*$/)?.[0].length ?? 0;
  end -= trailing;
  if (end <= start) return undefined;
  const text = source.slice(start, end).normalize("NFKC").replace(/\s+/gu, " ").trim();
  return text ? { start, end, text } : undefined;
}

/**
 * Inventories source clauses only. It deliberately does not infer product
 * classes, actions, persistence, or other semantics from words in the task.
 */
export function extractTaskRequirementLedgerV1(taskInput: string): TaskRequirementLedgerV1 {
  const task = String(taskInput ?? "");
  const sourceHash = sha256(task);
  const boundaries = /(?:\r\n|\r|\n)+|[.!?;\u3002\uff01\uff1f\uff1b]+/gu;
  const candidates: Array<{ start: number; end: number; text: string }> = [];
  let start = 0;
  for (const match of task.matchAll(boundaries)) {
    const boundaryStart = match.index ?? start;
    const candidate = trimClause(task, start, boundaryStart);
    if (candidate) candidates.push(candidate);
    start = boundaryStart + match[0].length;
  }
  const terminal = trimClause(task, start, task.length);
  if (terminal) candidates.push(terminal);
  if (candidates.length === 0) {
    throw new Error("TASK_REQUIREMENT_SOURCE_EMPTY");
  }

  const byHash = new Map<string, TaskRequirementClauseV1>();
  for (const candidate of candidates) {
    const clauseHash = sha256(candidate.text);
    const startPosition = lineColumn(task, candidate.start);
    const endPosition = lineColumn(task, candidate.end);
    const source = {
      sourceHash,
      locator: TASK_REQUIREMENT_SOURCE_LOCATOR,
      sourceRef: `${TASK_REQUIREMENT_SOURCE_LOCATOR}#chars=${candidate.start}-${candidate.end}`,
      span: {
        startOffset: candidate.start,
        endOffset: candidate.end,
        startLine: startPosition.line,
        startColumn: startPosition.column,
        endLine: endPosition.line,
        endColumn: endPosition.column,
      },
    } as const;
    const existing = byHash.get(clauseHash);
    if (existing) {
      byHash.set(clauseHash, {
        ...existing,
        sources: [...existing.sources, source].sort((left, right) =>
          left.span.startOffset - right.span.startOffset),
      });
    } else {
      byHash.set(clauseHash, {
        id: requirementId(clauseHash),
        normalizedClause: candidate.text,
        clauseHash,
        sources: [source],
      });
    }
  }

  return TaskRequirementLedgerV1Schema.parse({
    schema: "setfarm.task-requirement-ledger.v1",
    sourceHash,
    sourceLocator: TASK_REQUIREMENT_SOURCE_LOCATOR,
    requirements: [...byHash.values()].sort((left, right) =>
      left.sources[0]!.span.startOffset - right.sources[0]!.span.startOffset),
  });
}
