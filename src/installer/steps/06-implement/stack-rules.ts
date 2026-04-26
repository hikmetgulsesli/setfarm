/**
 * Stack auto-detection + stack-specific rule bodies injected into the
 * developer agent prompt. Complements design-rules.ts (platform-level)
 * with finer framework-level distinctions (vite vs next, etc).
 *
 * Why: a story owning one Vite entry file often needs guidance about the
 * adjacent app-shell files. The same rule is irrelevant for a Next.js
 * project where app/layout.tsx is the sibling, and has no analogue in
 * SwiftUI (App struct + ContentView). Hard-coding Vite assumptions into
 * stories/guards.ts VITE_SIBLINGS created SCOPE_BLEED amplification when
 * the planner was right but the hint was missing. This module fixes
 * that by offering a stack-typed lookup.
 *
 * Detection is heuristic + conservative — returns 'unknown' (no rules)
 * rather than guessing.
 */
import fs from "node:fs";
import path from "node:path";

export type Stack =
  | "react-vite"
  | "nextjs"
  | "react-native"
  | "ios-swift"
  | "android-kotlin"
  | "flutter"
  | "node-generic"
  | "unknown";

export interface StackRuleSet {
  /** Pairs where owning the first file implies shared access to the second */
  siblings: [string, string][];
  /** Prose rules injected into the agent prompt via {{stack_rules}} */
  pitfalls: string;
}

function tryJSON(p: string): any | null {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

export function detectStack(repoPath: string): Stack {
  if (!repoPath || !fs.existsSync(repoPath)) return "unknown";

  // package.json-based JS/TS stacks
  const pkg = tryJSON(path.join(repoPath, "package.json"));
  if (pkg) {
    const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps["react-native"]) return "react-native";
    if (deps["next"]) return "nextjs";
    if (deps["vite"] && deps["react"]) return "react-vite";
    return "node-generic";
  }

  // iOS / Swift
  if (fs.existsSync(path.join(repoPath, "Info.plist"))) return "ios-swift";
  try {
    const entries = fs.readdirSync(repoPath);
    if (entries.some((e) => e.endsWith(".xcodeproj") || e.endsWith(".xcworkspace"))) return "ios-swift";
    if (entries.some((e) => e.endsWith(".swift"))) return "ios-swift";
  } catch { /* unreadable dir */ }

  // Flutter
  if (fs.existsSync(path.join(repoPath, "pubspec.yaml"))) return "flutter";

  // Android-Kotlin
  if (fs.existsSync(path.join(repoPath, "build.gradle")) || fs.existsSync(path.join(repoPath, "build.gradle.kts"))) {
    return "android-kotlin";
  }

  return "unknown";
}

export const STACK_RULES: Record<Stack, StackRuleSet> = {
  "react-vite": {
    siblings: [
      ["src/App.tsx", "src/main.tsx"],
      ["src/App.tsx", "index.html"],
      ["src/App.jsx", "src/main.jsx"],
    ],
    pitfalls: `## REACT + VITE STACK RULES

- \`src/main.tsx\` (or \`src/main.jsx\`) is Vite's entry point. It calls \`createRoot().render(<App />)\`. If it is listed in SCOPE_FILES, it is yours to wire. If it is not listed in SCOPE_FILES, treat it as read-only context.
- \`index.html\` is the Vite root HTML. Same rule: edit only when it is listed in SCOPE_FILES.
- \`vite.config.ts\` and \`tailwind.config.js\` are baselined by setup-build. Do not modify unless in your SCOPE_FILES — cross-story drift here causes merge conflicts.
- Prefer ESM imports (\`import ...\`), not \`require()\`.
- Tailwind class names must reference design tokens (\`bg-primary\`, \`text-on-surface\`, etc) — see design-tokens.css. No raw hex.
`,
  },
  nextjs: {
    siblings: [
      ["app/page.tsx", "app/layout.tsx"],
      ["app/page.tsx", "app/globals.css"],
      ["pages/index.tsx", "pages/_app.tsx"],
    ],
    pitfalls: `## NEXT.JS STACK RULES

- \`app/layout.tsx\` is the root layout wrapping every page. If \`app/page.tsx\` is scoped to you, layout is a SHARED sibling.
- \`app/globals.css\` is the global stylesheet — shared across all pages.
- Do NOT create \`app/api/*\` route handlers unless explicitly in your scope; routing is implicit and misplaced files ship unintended endpoints.
- Server Components default; mark \`'use client'\` only when state/effects are required.
- Images go through \`next/image\` — no raw \`<img>\` tags.
`,
  },
  "react-native": {
    siblings: [
      ["App.tsx", "index.js"],
      ["App.tsx", "index.ts"],
    ],
    pitfalls: `## REACT NATIVE STACK RULES

- \`index.js\` (or \`index.ts\`) registers the root component with \`AppRegistry\`. If App.tsx is scoped, index is a SHARED sibling.
- Do NOT touch \`ios/\` or \`android/\` native code unless explicitly scoped.
- Use \`StyleSheet.create()\` — inline styles are discouraged.
- Platform-specific files use \`.ios.tsx\` / \`.android.tsx\` suffix, not runtime \`Platform.OS\` branching in general layout.
`,
  },
  "ios-swift": {
    siblings: [
      // The @main App struct pairs with ContentView; exact filenames vary per project
      ["ContentView.swift", "App.swift"],
    ],
    pitfalls: `## iOS / SwiftUI STACK RULES

- The \`@main\` App struct (typically \`<ProjectName>App.swift\`) is the app entry. If ContentView.swift is scoped, the App struct is a SHARED sibling.
- Do NOT modify \`Info.plist\` without explicit scope — it controls capabilities, usage descriptions, URL schemes.
- SwiftUI \`#Preview\` code lives in the same view file, NOT a separate file.
- Follow Apple HIG: minimum tap target 44pt, support Dynamic Type, respect safe areas, dark mode.
- Use \`@State\`, \`@Binding\`, \`@StateObject\`, \`@ObservedObject\` correctly — wrong choice causes silent re-render bugs.
`,
  },
  "android-kotlin": {
    siblings: [
      ["MainActivity.kt", "AndroidManifest.xml"],
    ],
    pitfalls: `## ANDROID / KOTLIN STACK RULES

- \`AndroidManifest.xml\` declares activities, permissions, intents. If you create a new Activity, manifest is a SHARED sibling (planner should include it).
- Use Jetpack Compose (\`@Composable\`) for new UI, not legacy XML layouts — unless existing code is XML-based.
- Material 3 components (\`androidx.compose.material3.*\`), not Material 2.
- State management: \`remember {}\` + \`mutableStateOf()\` for local, \`ViewModel\` for screen-level.
`,
  },
  flutter: {
    siblings: [
      ["lib/main.dart", "lib/app.dart"],
    ],
    pitfalls: `## FLUTTER STACK RULES

- \`lib/main.dart\` contains \`runApp()\` — the app entry. If you own \`lib/app.dart\`, main.dart is a SHARED sibling.
- \`pubspec.yaml\` dependencies are managed at setup-build. Do NOT add packages ad-hoc in implement.
- Prefer stateless widgets; promote to \`StatefulWidget\` only when state is needed.
- Material 3 (\`useMaterial3: true\`) is the default theme.
`,
  },
  "node-generic": {
    siblings: [],
    pitfalls: `## NODE GENERIC STACK RULES

- \`package.json\` scripts are owned by setup-build. Do NOT redefine \`build\`, \`test\`, \`start\` unless scoped.
- Entry point (\`index.js\`, \`src/index.ts\`, \`bin/cli.js\`) forms an implicit sibling with its main modules — treat as shared.
- Prefer async/await over .then() chains for readability.
`,
  },
  unknown: {
    siblings: [],
    pitfalls: "",
  },
};
