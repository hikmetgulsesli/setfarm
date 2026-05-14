export const IMPLICIT_STORY_SCOPE_PATTERNS: RegExp[] = [
  /\.(test|spec)\.[cm]?[jt]sx?$/i,
  /^src\/test\/(?:setup|utils)\.[cm]?[jt]sx?$/i,
  /^src\/setupTests\.[cm]?[jt]sx?$/i,
  /^(?:vitest|jest)\.config\.[cm]?[jt]s$/i,
];

export const IMPLICIT_STORY_SCOPE_FILES: string[] = [
  "vitest.config.ts",
  "vitest.config.js",
  "vitest.config.mts",
  "vitest.config.mjs",
  "vitest.config.cts",
  "vitest.config.cjs",
  "jest.config.ts",
  "jest.config.js",
  "jest.config.mts",
  "jest.config.mjs",
  "jest.config.cts",
  "jest.config.cjs",
  "src/test/setup.ts",
  "src/test/setup.tsx",
  "src/test/setup.js",
  "src/test/setup.jsx",
  "src/test/setup.mts",
  "src/test/setup.mjs",
  "src/test/setup.cts",
  "src/test/setup.cjs",
  "src/test/utils.ts",
  "src/test/utils.tsx",
  "src/test/utils.js",
  "src/test/utils.jsx",
  "src/test/utils.mts",
  "src/test/utils.mjs",
  "src/test/utils.cts",
  "src/test/utils.cjs",
  "src/setupTests.ts",
  "src/setupTests.tsx",
  "src/setupTests.js",
  "src/setupTests.jsx",
  "src/setupTests.mts",
  "src/setupTests.mjs",
  "src/setupTests.cts",
  "src/setupTests.cjs",
];

export function normalizeStoryScopePath(file: string): string {
  return String(file || "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .trim();
}

export function isImplicitStoryScopeFile(file: string): boolean {
  const normalized = normalizeStoryScopePath(file);
  return IMPLICIT_STORY_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized));
}
