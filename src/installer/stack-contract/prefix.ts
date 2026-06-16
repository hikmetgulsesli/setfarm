import type { StackPackId } from "./types.js";

export interface StackPrefixMatch {
  prefix: string;
  packId: StackPackId;
  platform: string;
  techStack: string;
  taskText: string;
}

const PREFIX_PATTERN = /^\s*([a-z][a-z0-9_-]{1,24})\s*:\s*([\s\S]*)$/i;

const DIRECT_PREFIXES: Record<string, Omit<StackPrefixMatch, "prefix" | "taskText">> = {
  game: { packId: "browser-game-canvas", platform: "game", techStack: "browser-game" },
  "browser-game": { packId: "browser-game-canvas", platform: "game", techStack: "browser-game" },
  "canvas-game": { packId: "browser-game-canvas", platform: "game", techStack: "browser-game" },
  canvas: { packId: "browser-game-canvas", platform: "game", techStack: "browser-game" },
  phaser: { packId: "browser-game-canvas", platform: "game", techStack: "browser-game" },
  arcade: { packId: "browser-game-canvas", platform: "game", techStack: "browser-game" },
  web: { packId: "vite-react-web-app", platform: "web", techStack: "vite-react" },
  frontend: { packId: "vite-react-web-app", platform: "web", techStack: "vite-react" },
  spa: { packId: "vite-react-web-app", platform: "web", techStack: "vite-react" },
  react: { packId: "vite-react-web-app", platform: "web", techStack: "vite-react" },
  reactjs: { packId: "vite-react-web-app", platform: "web", techStack: "vite-react" },
  "react-spa": { packId: "vite-react-web-app", platform: "web", techStack: "vite-react" },
  vite: { packId: "vite-react-web-app", platform: "web", techStack: "vite-react" },
  "vite-react": { packId: "vite-react-web-app", platform: "web", techStack: "vite-react" },
  dashboard: { packId: "vite-react-web-app", platform: "web", techStack: "vite-react" },
  static: { packId: "static-html-site", platform: "web", techStack: "static-html" },
  html: { packId: "static-html-site", platform: "web", techStack: "static-html" },
  "static-html": { packId: "static-html-site", platform: "web", techStack: "static-html" },
  landing: { packId: "static-html-site", platform: "web", techStack: "static-html" },
  site: { packId: "static-html-site", platform: "web", techStack: "static-html" },
  next: { packId: "nextjs-web-app", platform: "web", techStack: "nextjs" },
  nextjs: { packId: "nextjs-web-app", platform: "web", techStack: "nextjs" },
  "next-js": { packId: "nextjs-web-app", platform: "web", techStack: "nextjs" },
  "next-web": { packId: "nextjs-web-app", platform: "web", techStack: "nextjs" },
  ssr: { packId: "nextjs-web-app", platform: "web", techStack: "nextjs" },
  android: { packId: "android-app", platform: "mobile", techStack: "android-native" },
  kotlin: { packId: "android-app", platform: "mobile", techStack: "android-native" },
  compose: { packId: "android-app", platform: "mobile", techStack: "android-native" },
  "jetpack-compose": { packId: "android-app", platform: "mobile", techStack: "android-native" },
  ios: { packId: "ios-app", platform: "mobile", techStack: "ios-native" },
  iphone: { packId: "ios-app", platform: "mobile", techStack: "ios-native" },
  ipad: { packId: "ios-app", platform: "mobile", techStack: "ios-native" },
  swift: { packId: "ios-app", platform: "mobile", techStack: "ios-native" },
  swiftui: { packId: "ios-app", platform: "mobile", techStack: "ios-native" },
  api: { packId: "node-express-api", platform: "api", techStack: "node-express" },
  backend: { packId: "node-express-api", platform: "api", techStack: "node-express" },
  server: { packId: "node-express-api", platform: "api", techStack: "node-express" },
  express: { packId: "node-express-api", platform: "api", techStack: "node-express" },
  "node-api": { packId: "node-express-api", platform: "api", techStack: "node-express" },
  "express-api": { packId: "node-express-api", platform: "api", techStack: "node-express" },
  rest: { packId: "node-express-api", platform: "api", techStack: "node-express" },
  cli: { packId: "node-cli", platform: "cli", techStack: "node-cli" },
  "node-cli": { packId: "node-cli", platform: "cli", techStack: "node-cli" },
  "typescript-cli": { packId: "node-cli", platform: "cli", techStack: "node-cli" },
  "ts-cli": { packId: "node-cli", platform: "cli", techStack: "node-cli" },
  "npm-cli": { packId: "node-cli", platform: "cli", techStack: "node-cli" },
  script: { packId: "node-cli", platform: "cli", techStack: "node-cli" },
  rn: { packId: "react-native-expo", platform: "mobile", techStack: "react-native-expo" },
  "react-native": { packId: "react-native-expo", platform: "mobile", techStack: "react-native-expo" },
  expo: { packId: "react-native-expo", platform: "mobile", techStack: "react-native-expo" },
  mobile: { packId: "react-native-expo", platform: "mobile", techStack: "react-native-expo" },
  electron: { packId: "desktop-electron", platform: "desktop", techStack: "desktop-electron" },
  desktop: { packId: "desktop-electron", platform: "desktop", techStack: "desktop-electron" },
  mac: { packId: "desktop-electron", platform: "desktop", techStack: "desktop-electron" },
  macos: { packId: "desktop-electron", platform: "desktop", techStack: "desktop-electron" },
  windows: { packId: "desktop-electron", platform: "desktop", techStack: "desktop-electron" },
};

export function parseStackPrefix(taskText: string | undefined | null): StackPrefixMatch | null {
  const raw = String(taskText || "");
  const match = raw.match(PREFIX_PATTERN);
  if (!match) return null;

  const prefix = match[1].toLowerCase();
  const strippedTaskText = match[2].trim();
  const direct = DIRECT_PREFIXES[prefix];
  if (direct) return { prefix, taskText: strippedTaskText, ...direct };

  if (prefix === "python") {
    const lower = strippedTaskText.toLowerCase();
    if (/\b(api|server|web|fastapi|flask|django)\b/.test(lower)) {
      return { prefix, taskText: strippedTaskText, packId: "python-web", platform: "api", techStack: "python-web" };
    }
    return { prefix, taskText: strippedTaskText, packId: "python-cli", platform: "cli", techStack: "python-cli" };
  }

  if (prefix === "node" || prefix === "javascript" || prefix === "js" || prefix === "typescript" || prefix === "ts") {
    const lower = strippedTaskText.toLowerCase();
    if (/\b(cli|command line|terminal|script|commander|yargs)\b/.test(lower)) {
      return { prefix, taskText: strippedTaskText, packId: "node-cli", platform: "cli", techStack: "node-cli" };
    }
    if (/\b(api|server|backend|express|rest|graphql)\b/.test(lower)) {
      return { prefix, taskText: strippedTaskText, packId: "node-express-api", platform: "api", techStack: "node-express" };
    }
    return { prefix, taskText: strippedTaskText, packId: "vite-react-web-app", platform: "web", techStack: "vite-react" };
  }

  return null;
}

export function stripStackPrefix(taskText: string | undefined | null): string {
  return parseStackPrefix(taskText)?.taskText || String(taskText || "");
}
