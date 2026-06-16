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
  web: { packId: "vite-react-web-app", platform: "web", techStack: "vite-react" },
  vite: { packId: "vite-react-web-app", platform: "web", techStack: "vite-react" },
  next: { packId: "nextjs-web-app", platform: "web", techStack: "nextjs" },
  nextjs: { packId: "nextjs-web-app", platform: "web", techStack: "nextjs" },
  android: { packId: "android-app", platform: "mobile", techStack: "android-native" },
  ios: { packId: "ios-app", platform: "mobile", techStack: "ios-native" },
  api: { packId: "node-express-api", platform: "api", techStack: "node-express" },
  cli: { packId: "node-cli", platform: "cli", techStack: "node-cli" },
  rn: { packId: "react-native-expo", platform: "mobile", techStack: "react-native-expo" },
  "react-native": { packId: "react-native-expo", platform: "mobile", techStack: "react-native-expo" },
  expo: { packId: "react-native-expo", platform: "mobile", techStack: "react-native-expo" },
  electron: { packId: "desktop-electron", platform: "desktop", techStack: "desktop-electron" },
  desktop: { packId: "desktop-electron", platform: "desktop", techStack: "desktop-electron" },
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

  return null;
}

export function stripStackPrefix(taskText: string | undefined | null): string {
  return parseStackPrefix(taskText)?.taskText || String(taskText || "");
}
