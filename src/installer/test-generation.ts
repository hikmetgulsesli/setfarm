/**
 * Test Generation — Detect test framework and run project tests.
 * Supports Vitest, Jest, Playwright, and node:test.
 * Used by the self-fix loop in completeStep.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { logger } from "../lib/logger.js";

export interface TestFramework {
  runner: "vitest" | "jest" | "playwright" | "detox" | "node-test" | "none";
  command: string;
  configPath?: string;
}

export interface TestRunResult {
  passed: boolean;
  totalTests: number;
  failedTests: number;
  errorSummary: string;
  rawOutput: string;
}

export function detectTestFramework(repoPath: string): TestFramework {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoPath, "package.json"), "utf-8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const scripts = pkg.scripts || {};

    if (allDeps["vitest"]) return { runner: "vitest", command: "npx vitest run --reporter=verbose" };
    if (allDeps["jest"] || allDeps["@jest/core"]) return { runner: "jest", command: "npx jest --forceExit --detectOpenHandles" };
    if (allDeps["@playwright/test"]) return { runner: "playwright", command: "npx playwright test --reporter=list" };
    if (allDeps["detox"]) return { runner: "detox", command: "npx detox test" };
    if (scripts.test && scripts.test !== "echo \"Error: no test specified\" && exit 1") {
      return { runner: "vitest", command: "npm test" };
    }
    return { runner: "none", command: "" };
  } catch {
    return { runner: "none", command: "" };
  }
}

export function runTests(repoPath: string, framework: TestFramework): TestRunResult {
  if (framework.runner === "none") {
    return { passed: true, totalTests: 0, failedTests: 0, errorSummary: "", rawOutput: "No test framework detected" };
  }

  try {
    const output = execFileSync("sh", ["-c", framework.command], {
      cwd: repoPath,
      encoding: "utf-8",
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, CI: "true", NODE_ENV: "test" },
    });

    return {
      passed: true,
      totalTests: countTests(output, "pass"),
      failedTests: 0,
      errorSummary: "",
      rawOutput: output.slice(-2000),
    };
  } catch (err: any) {
    const output = (err.stdout || "") + "\n" + (err.stderr || "");
    const failedCount = countTests(output, "fail");

    return {
      passed: false,
      totalTests: countTests(output, "total"),
      failedTests: failedCount || 1,
      errorSummary: extractTestErrors(output),
      rawOutput: output.slice(-2000),
    };
  }
}

function countTests(output: string, type: "pass" | "fail" | "total"): number {
  if (type === "pass") {
    const m = output.match(/(\d+)\s+pass/i);
    return m ? parseInt(m[1]) : 0;
  }
  if (type === "fail") {
    const m = output.match(/(\d+)\s+fail/i);
    return m ? parseInt(m[1]) : 0;
  }
  const m = output.match(/Tests?:\s+(\d+)/i);
  return m ? parseInt(m[1]) : 0;
}

function extractTestErrors(output: string): string {
  // Extract the most relevant error lines
  const lines = output.split("\n");
  const errorLines = lines.filter(l =>
    l.includes("FAIL") || l.includes("Error") || l.includes("expect") ||
    l.includes("AssertionError") || l.includes("\u2717") || l.includes("\u00d7")
  );
  return errorLines.slice(0, 10).join("\n").slice(0, 1000);
}

export function buildTestGenerationPrompt(storyTitle: string, acceptanceCriteria: string, techStack: string): string {
  return `Generate test file for this story:

STORY: ${storyTitle}
ACCEPTANCE CRITERIA:
${acceptanceCriteria}

TECH STACK: ${techStack}

Requirements:
1. Test each acceptance criterion
2. Include edge cases (empty input, invalid data, boundary values)
3. Test error states
4. Use the project's existing test framework
5. Write complete, runnable test code

Output ONLY the test file content — no explanations.`;
}

export function buildTestFixPrompt(result: TestRunResult): string {
  return `TEST FAILURES DETECTED — FIX THESE BEFORE COMPLETING:

Failed Tests: ${result.failedTests}/${result.totalTests}

Error Summary:
${result.errorSummary}

Raw Output (last 1000 chars):
${result.rawOutput.slice(-1000)}

Instructions:
1. Read the error messages carefully
2. Fix the source code (not the tests) to make tests pass
3. If a test is testing wrong behavior, fix the test
4. Run the tests again to verify
`;
}
