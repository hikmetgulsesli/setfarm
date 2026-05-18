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

export const REOPENABLE_APP_INTEGRATION_FILES: string[] = [
  "src/App.tsx",
  "src/App.jsx",
  "src/App.css",
  "src/main.tsx",
  "src/main.jsx",
  "src/index.tsx",
  "src/index.jsx",
  "src/index.css",
  "src/contexts/AppContext.tsx",
  "src/contexts/AppContext.jsx",
  "src/types/domain.ts",
  "src/types/domain.tsx",
  "src/hooks/useAppState.ts",
  "src/hooks/useAppState.tsx",
  "src/utils/storage.ts",
  "src/utils/storage.tsx",
  "app/page.tsx",
  "app/layout.tsx",
  "app/globals.css",
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "src/app/globals.css",
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

export function isReopenableAppIntegrationFile(file: string): boolean {
  const normalized = normalizeStoryScopePath(file);
  return REOPENABLE_APP_INTEGRATION_FILES.includes(normalized);
}
