import type { StackPack, StackPackId } from "./types.js";

export const STACK_PACKS: Record<StackPackId, StackPack> = {
  "nextjs-web-app": {
    id: "nextjs-web-app",
    label: "Next.js Web App",
    projectTypes: ["web-app", "dashboard", "saas", "site"],
    whenToUse: "Use for React web applications that need Next.js routing, app/pages directories, server components, or existing Next.js repository evidence.",
    repoSignals: ["next dependency", "next.config.*", "app/", "pages/"],
    setup: {
      install: "npm install",
      dev: "npm run dev",
      build: "npm run build",
      test: "npm test",
      smoke: "npm run build",
    },
    fileContract: {
      entrypoints: ["app/page.tsx", "pages/index.tsx"],
      routes: ["app/**/page.tsx", "pages/**/*.tsx"],
      assets: ["public/"],
      generated: [],
      notes: [
        "Use app router when an app directory exists.",
        "Use client components only when state, effects, or browser APIs are required.",
      ],
    },
    routeContract: {
      router: "next",
      routeFiles: ["app/**/page.tsx", "pages/**/*.tsx"],
      requiredRoutes: ["/"],
    },
    verification: {
      build: ["npm run build"],
      smoke: ["start Next preview or dev server and open required routes"],
      dom: ["extract buttons, links, forms, dialogs, and route navigation controls"],
      visual: ["capture desktop and mobile screenshots for required routes"],
      tests: ["npm test when present"],
    },
    prompt: [
      "Follow the resolved Next.js stack contract.",
      "Use Next.js routing conventions instead of inventing client-only routing.",
      "Do not add app/api handlers unless explicitly required by the story.",
      "Use 'use client' only for components that need state, effects, or browser APIs.",
    ].join("\n"),
  },
  "vite-react-web-app": {
    id: "vite-react-web-app",
    label: "Vite React Web App",
    projectTypes: ["web-app", "dashboard", "tool", "single-page-app"],
    whenToUse: "Use for browser React applications with Vite evidence or when a lightweight SPA is the best fit.",
    repoSignals: ["vite dependency", "react dependency", "vite.config.*", "src/main.tsx"],
    setup: {
      install: "npm install",
      dev: "npm run dev",
      build: "npm run build",
      test: "npm test",
      smoke: "npm run build",
    },
    fileContract: {
      entrypoints: ["src/main.tsx", "src/main.jsx", "src/App.tsx", "src/App.jsx"],
      routes: ["src/**/*.{tsx,jsx,ts,js}"],
      assets: ["public/", "src/assets/"],
      generated: [],
      notes: [
        "src/main.tsx or src/main.jsx owns the createRoot render entry.",
        "index.html is the Vite root document.",
      ],
    },
    routeContract: {
      router: "client",
      routeFiles: ["src/**/*.{tsx,jsx}"],
      requiredRoutes: ["/"],
    },
    verification: {
      build: ["npm run build"],
      smoke: ["serve preview/dev server and open root route"],
      dom: ["extract buttons, links, forms, dialogs, and client navigation controls"],
      visual: ["capture desktop and mobile screenshots for root and discovered routes"],
      tests: ["npm test when present"],
    },
    prompt: [
      "Follow the resolved Vite React stack contract.",
      "Use src/main.tsx or src/main.jsx as the browser entrypoint.",
      "Keep package scripts and Vite config stable unless they are explicitly in scope.",
      "Use client-side route/state patterns appropriate for a Vite SPA.",
    ].join("\n"),
  },
  "static-html-site": {
    id: "static-html-site",
    label: "Static HTML Site",
    projectTypes: ["landing-page", "simple-site", "static-site"],
    whenToUse: "Use for simple static pages that do not need a framework runtime.",
    repoSignals: ["index.html", "static assets", "no package framework evidence"],
    setup: {
      dev: "python3 -m http.server 4173",
      build: "true",
      smoke: "open index.html or serve the directory",
    },
    fileContract: {
      entrypoints: ["index.html"],
      routes: ["*.html"],
      assets: ["assets/", "public/"],
      generated: [],
      notes: ["Keep behavior in plain JavaScript when interaction is required."],
    },
    routeContract: {
      router: "static",
      routeFiles: ["*.html"],
      requiredRoutes: ["/", "/index.html"],
    },
    verification: {
      build: ["no framework build required unless package scripts exist"],
      smoke: ["serve directory and open index.html"],
      dom: ["extract static links, buttons, and forms"],
      visual: ["capture desktop and mobile screenshots"],
      tests: [],
    },
    prompt: [
      "Follow the resolved static HTML stack contract.",
      "Do not introduce a JavaScript framework unless the stack contract is reconciled first.",
      "Keep links, forms, and buttons functional with plain browser behavior.",
    ].join("\n"),
  },
  "browser-game-canvas": {
    id: "browser-game-canvas",
    label: "Browser Game Canvas",
    projectTypes: ["browser-game", "arcade", "canvas-game"],
    whenToUse: "Use for browser games where the primary experience is canvas, game loop, keyboard/touch input, animation, scoring, and restartable gameplay.",
    repoSignals: ["game PRD hints", "canvas usage", "Vite React or static browser runtime"],
    setup: {
      install: "npm install",
      dev: "npm run dev",
      build: "npm run build",
      test: "npm test",
      smoke: "npm run build",
    },
    fileContract: {
      entrypoints: ["src/main.tsx", "src/main.jsx", "src/App.tsx", "src/App.jsx", "index.html"],
      routes: ["src/**/*.{tsx,jsx,ts,js}", "*.html"],
      assets: ["public/", "src/assets/"],
      generated: [],
      notes: [
        "Expose a real runtime bridge for smoke tests when required by the project contract.",
        "Gameplay controls must affect state or be hidden/disabled when inactive.",
      ],
    },
    routeContract: {
      router: "browser-game",
      routeFiles: ["src/**/*.{tsx,jsx,ts,js}", "*.html"],
      requiredRoutes: ["/"],
    },
    verification: {
      build: ["npm run build when package scripts exist"],
      smoke: ["open the game route and verify a nonblank playable scene"],
      dom: ["extract menu, pause, restart, help, and gameplay controls"],
      visual: ["capture desktop and mobile screenshots for menu and gameplay states"],
      tests: ["game state and control tests when test runner exists"],
    },
    prompt: [
      "Follow the resolved browser game stack contract.",
      "Implement a real game loop, state transitions, input handling, scoring/progress, pause/restart, and terminal states as required by the PRD.",
      "Visible controls must either affect current game state or be hidden/disabled when inactive.",
      "Canvas or scene output must be nonblank and verifiable in Playwright screenshots.",
    ].join("\n"),
  },
  "python-cli": {
    id: "python-cli",
    label: "Python CLI",
    projectTypes: ["cli", "script", "automation"],
    whenToUse: "Use for command-line Python tools and automation scripts without a web server requirement.",
    repoSignals: ["pyproject.toml", "requirements.txt", "main.py", "cli.py"],
    setup: {
      install: "python3 -m pip install -r requirements.txt",
      test: "python3 -m pytest",
      smoke: "python3 -m compileall .",
    },
    fileContract: {
      entrypoints: ["main.py", "cli.py", "src/**/__main__.py"],
      routes: [],
      assets: [],
      generated: [],
      notes: ["Provide clear CLI arguments and deterministic stdout/stderr behavior."],
    },
    routeContract: {
      router: "none",
      routeFiles: [],
      requiredRoutes: [],
    },
    verification: {
      build: ["python3 -m compileall ."],
      smoke: ["run CLI help or a safe dry-run command"],
      dom: [],
      visual: [],
      tests: ["python3 -m pytest when present"],
    },
    prompt: [
      "Follow the resolved Python CLI stack contract.",
      "Keep the command-line entrypoint explicit and testable.",
      "Avoid starting servers unless the stack contract is reconciled to python-web.",
    ].join("\n"),
  },
  "python-web": {
    id: "python-web",
    label: "Python Web App",
    projectTypes: ["python-web", "api", "server"],
    whenToUse: "Use for Python web applications with FastAPI, Flask, Django, or similar server evidence.",
    repoSignals: ["fastapi dependency", "flask dependency", "django dependency", "app.py", "main.py"],
    setup: {
      install: "python3 -m pip install -r requirements.txt",
      dev: "python3 -m uvicorn main:app --reload",
      test: "python3 -m pytest",
      smoke: "python3 -m compileall .",
    },
    fileContract: {
      entrypoints: ["main.py", "app.py", "src/main.py"],
      routes: ["**/routes.py", "**/views.py", "**/api.py"],
      assets: ["static/", "templates/"],
      generated: [],
      notes: ["Keep server startup command aligned with the detected framework."],
    },
    routeContract: {
      router: "python-web",
      routeFiles: ["**/routes.py", "**/views.py", "**/api.py", "main.py", "app.py"],
      requiredRoutes: ["/"],
    },
    verification: {
      build: ["python3 -m compileall ."],
      smoke: ["start app and request health/root route when safe"],
      dom: ["for HTML apps, extract links, buttons, and forms"],
      visual: ["for HTML apps, capture primary route screenshots"],
      tests: ["python3 -m pytest when present"],
    },
    prompt: [
      "Follow the resolved Python web stack contract.",
      "Keep routes explicit and verify server startup with the configured command.",
      "Do not convert a CLI project into a web server unless reconcile selected python-web.",
    ].join("\n"),
  },
  "android-app": {
    id: "android-app",
    label: "Android App",
    projectTypes: ["android", "mobile-app"],
    whenToUse: "Use for native Android apps with Gradle, AndroidManifest, Kotlin, Java, or Android project evidence.",
    repoSignals: ["settings.gradle", "build.gradle", "AndroidManifest.xml", "MainActivity.kt"],
    setup: {
      build: "./gradlew build",
      test: "./gradlew test",
      smoke: "./gradlew assembleDebug",
    },
    fileContract: {
      entrypoints: ["app/src/main/AndroidManifest.xml", "app/src/main/java/**/MainActivity.kt", "app/src/main/kotlin/**/MainActivity.kt"],
      routes: [],
      assets: ["app/src/main/res/"],
      generated: [],
      notes: ["Prefer the existing UI system. Use Jetpack Compose for new UI only when the project already supports it or setup adds it intentionally."],
    },
    routeContract: {
      router: "android",
      routeFiles: ["app/src/main/AndroidManifest.xml"],
      requiredRoutes: [],
    },
    verification: {
      build: ["./gradlew build"],
      smoke: ["./gradlew assembleDebug"],
      dom: [],
      visual: ["capture emulator screenshots when mobile QA infrastructure is available"],
      tests: ["./gradlew test"],
    },
    prompt: [
      "Follow the resolved Android stack contract.",
      "Respect AndroidManifest, Gradle, resource, and package structure.",
      "Do not mix unrelated mobile stacks into a native Android project.",
    ].join("\n"),
  },
  "ios-app": {
    id: "ios-app",
    label: "iOS App",
    projectTypes: ["ios", "iphone", "mobile-app"],
    whenToUse: "Use for native iOS apps with Xcode, Swift, SwiftUI, UIKit, or iOS project evidence.",
    repoSignals: [".xcodeproj", ".xcworkspace", "Info.plist", "Swift files"],
    setup: {
      build: "xcodebuild build",
      test: "xcodebuild test",
      smoke: "xcodebuild build",
    },
    fileContract: {
      entrypoints: ["*App.swift", "AppDelegate.swift", "SceneDelegate.swift", "ContentView.swift"],
      routes: [],
      assets: ["Assets.xcassets/"],
      generated: [],
      notes: ["Respect safe areas, Dynamic Type, accessibility labels, and platform navigation conventions."],
    },
    routeContract: {
      router: "ios",
      routeFiles: ["*App.swift", "AppDelegate.swift", "SceneDelegate.swift"],
      requiredRoutes: [],
    },
    verification: {
      build: ["xcodebuild build"],
      smoke: ["xcodebuild build"],
      dom: [],
      visual: ["capture simulator screenshots when mobile QA infrastructure is available"],
      tests: ["xcodebuild test"],
    },
    prompt: [
      "Follow the resolved iOS stack contract.",
      "Respect Xcode project structure, SwiftUI/UIKit conventions, safe areas, and accessibility.",
      "Do not mix unrelated mobile stacks into a native iOS project.",
    ].join("\n"),
  },
};

export function getStackPack(packId: StackPackId): StackPack {
  return STACK_PACKS[packId];
}

export function listStackPacks(): StackPack[] {
  return Object.values(STACK_PACKS);
}
