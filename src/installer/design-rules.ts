/**
 * Platform-Specific Design Rules Enforcement
 *
 * Detects project platform (react-native, ios, android, web) and returns
 * platform-specific design rules + violation checks for the pipeline.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { logger } from "../lib/logger.js";

// ── Types ──────────────────────────────────────────────────────────────

export type Platform = "ios" | "android" | "web" | "react-native" | "unknown";

export interface DesignViolation {
  file: string;
  line: number;
  rule: string;
  severity: "error" | "warning";
  message: string;
}

// ── Platform Detection ─────────────────────────────────────────────────

/**
 * Detect the project platform from repo contents.
 *
 * Priority:
 *   1. package.json → react-native / expo → "react-native"
 *   2. package.json → next / vite / react-dom → "web"
 *   3. .swift files → "ios"
 *   4. build.gradle → "android"
 *   5. fallback → "unknown"
 */
export function detectPlatform(repoPath: string): Platform {
  if (!repoPath || !fs.existsSync(repoPath)) return "unknown";

  // Check package.json for JS/TS projects
  const pkgPath = path.join(repoPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const raw = fs.readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(raw);
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      // React Native / Expo → react-native
      if (allDeps["react-native"] || allDeps["expo"]) {
        return "react-native";
      }

      // Web frameworks → web
      if (allDeps["next"] || allDeps["vite"] || allDeps["react-dom"]) {
        return "web";
      }
    } catch {
      // Malformed package.json — continue to file-based detection
    }
  }

  // Swift files → iOS
  try {
    const files = execFileSync("find", [repoPath, "-maxdepth", "3", "-name", "*.swift", "-type", "f"], {
      timeout: 5000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (files.length > 0) return "ios";
  } catch {
    // find not available or timed out — try fs fallback
    try {
      const entries = fs.readdirSync(repoPath, { recursive: true }) as string[];
      if (entries.some(e => String(e).endsWith(".swift"))) return "ios";
    } catch {}
  }

  // build.gradle → Android
  const gradlePath = path.join(repoPath, "build.gradle");
  const gradleKtsPath = path.join(repoPath, "build.gradle.kts");
  const appGradlePath = path.join(repoPath, "app", "build.gradle");
  const appGradleKtsPath = path.join(repoPath, "app", "build.gradle.kts");
  if (
    fs.existsSync(gradlePath) ||
    fs.existsSync(gradleKtsPath) ||
    fs.existsSync(appGradlePath) ||
    fs.existsSync(appGradleKtsPath)
  ) {
    return "android";
  }

  return "unknown";
}

// ── Design Rules ───────────────────────────────────────────────────────

/**
 * Return platform-specific design rules as a text block for agent context.
 */
export function getDesignRules(platform: Platform): string {
  switch (platform) {
    case "react-native":
      return `=== PLATFORM DESIGN RULES (React Native) ===
- FORBIDDEN HTML elements: <div>, <span>, <button>, <input>, <textarea>, <img>, <a>
  Use React Native equivalents: View, Text, Pressable/TouchableOpacity, TextInput, Image, Link
- Minimum touch target size: 44x44pt (hitSlop or minHeight/minWidth)
- MUST wrap top-level screens with SafeAreaView (from react-native-safe-area-context)
- NO web CSS — use StyleSheet.create() for all styles, no className props
- Use SF Symbols (via @expo/vector-icons or react-native-sf-symbols) for icons on iOS
- No position: fixed — use absolute positioning within containers
- No hover states — design for touch-only interaction
- Use FlatList/SectionList for scrollable lists (never map + ScrollView for large lists)
- Platform-specific shadows: iOS=shadowOffset/shadowRadius, Android=elevation
=== END PLATFORM DESIGN RULES ===`;

    case "ios":
      return `=== PLATFORM DESIGN RULES (iOS / Swift) ===
- FORBIDDEN HTML elements: <div>, <span>, <button> — use SwiftUI/UIKit views
- Minimum touch target size: 44x44pt (Apple HIG requirement)
- Use SafeAreaView / .ignoresSafeArea() appropriately
- NO web CSS — use SwiftUI modifiers or UIKit constraints
- Use SF Symbols for icons (systemName: "icon.name")
- Support Dynamic Type for text scaling
- Support Dark Mode via asset catalogs or Color sets
- Use NavigationStack (not deprecated NavigationView) for navigation
- Follow Apple HIG spacing: 16pt margins, 8pt element spacing
=== END PLATFORM DESIGN RULES ===`;

    case "android":
      return `=== PLATFORM DESIGN RULES (Android) ===
- Follow Material Design 3 (Material You) design tokens and components
- Use MaterialTheme color scheme (primary, secondary, tertiary, surface, etc.)
- Ripple touch feedback on all interactive elements (indication = rememberRipple())
- Minimum touch target size: 48dp (Material Design requirement)
- Support Dynamic Color (DynamicColors.applyToActivitiesIfAvailable)
- Use TopAppBar, NavigationBar, FloatingActionButton from Material 3
- Follow 8dp grid spacing system
- Support edge-to-edge display (WindowCompat.setDecorFitsSystemWindows = false)
- Use Modifier.semantics {} for accessibility
- Support both light and dark themes via MaterialTheme
=== END PLATFORM DESIGN RULES ===`;

    case "web":
      return `=== PLATFORM DESIGN RULES (Web) ===
- WCAG 2.1 AA compliance required
- All <img> tags MUST have meaningful alt text (alt="" only for decorative images with role="presentation")
- All icon-only buttons MUST have aria-label attribute
- Responsive breakpoints: 375px (mobile), 768px (tablet), 1024px (laptop), 1440px (desktop)
- Color contrast ratio: minimum 4.5:1 for normal text, 3:1 for large text
- Full keyboard navigation support — all interactive elements must be focusable
- :focus-visible styles on all interactive elements (never outline: none without replacement)
- Use semantic HTML: <nav>, <main>, <header>, <footer>, <section>, <article>
- Form inputs MUST have associated <label> elements (or aria-label)
- No autoplaying media without user consent
- Prefer rem/em units over px for font sizes
- Touch targets: minimum 44x44px on mobile viewports
=== END PLATFORM DESIGN RULES ===`;

    default:
      return "";
  }
}

// ── Violation Checking ─────────────────────────────────────────────────

/**
 * Grep-based design rule violation checks.
 * Returns an array of violations found in the repo.
 */
export function checkDesignViolations(repoPath: string, platform: Platform): DesignViolation[] {
  if (!repoPath || !fs.existsSync(repoPath) || platform === "unknown") return [];

  const violations: DesignViolation[] = [];

  try {
    switch (platform) {
      case "react-native":
        violations.push(...checkReactNativeViolations(repoPath));
        break;
      case "ios":
        violations.push(...checkIOSViolations(repoPath));
        break;
      case "android":
        violations.push(...checkAndroidViolations(repoPath));
        break;
      case "web":
        violations.push(...checkWebViolations(repoPath));
        break;
    }
  } catch (e) {
    logger.warn(`[design-rules] Violation check failed: ${String(e)}`);
  }

  return violations;
}

// ── Internal: Platform-Specific Checks ─────────────────────────────────

function grepFiles(repoPath: string, pattern: string, globs: string[]): Array<{ file: string; line: number; content: string }> {
  const results: Array<{ file: string; line: number; content: string }> = [];

  for (const glob of globs) {
    try {
      const output = execFileSync("grep", ["-rnE", pattern, "--include", glob, repoPath], {
        timeout: 10000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();

      if (!output) continue;

      for (const line of output.split("\n")) {
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (match) {
          results.push({
            file: path.relative(repoPath, match[1]),
            line: parseInt(match[2], 10),
            content: match[3].trim(),
          });
        }
      }
    } catch {
      // grep returns exit code 1 when no matches — not an error
    }
  }

  return results;
}

function checkReactNativeViolations(repoPath: string): DesignViolation[] {
  const violations: DesignViolation[] = [];

  // Check for forbidden HTML elements in .tsx/.jsx files
  const htmlTagPatterns = [
    { pattern: "<div[\\s>/]", rule: "rn-no-div", message: "Forbidden <div> in React Native — use <View> instead" },
    { pattern: "<span[\\s>/]", rule: "rn-no-span", message: "Forbidden <span> in React Native — use <Text> instead" },
    { pattern: "<button[\\s>/]", rule: "rn-no-button", message: "Forbidden <button> in React Native — use <Pressable> or <TouchableOpacity> instead" },
  ];

  for (const { pattern, rule, message } of htmlTagPatterns) {
    const matches = grepFiles(repoPath, pattern, ["*.tsx", "*.jsx"]);
    for (const m of matches) {
      // Skip node_modules, test files, and .web.tsx files
      if (m.file.includes("node_modules") || m.file.includes("stitch/") || m.file.includes(".test.") || m.file.includes(".web.")) continue;
      violations.push({ file: m.file, line: m.line, rule, severity: "error", message });
    }
  }

  // Check for web CSS className usage
  const classNameMatches = grepFiles(repoPath, 'className=', ["*.tsx", "*.jsx"]);
  for (const m of classNameMatches) {
    if (m.file.includes("node_modules") || m.file.includes("stitch/") || m.file.includes(".web.")) continue;
    violations.push({
      file: m.file,
      line: m.line,
      rule: "rn-no-classname",
      severity: "error",
      message: "className prop forbidden in React Native — use StyleSheet.create() and style prop",
    });
  }

  return violations;
}

function checkIOSViolations(repoPath: string): DesignViolation[] {
  const violations: DesignViolation[] = [];

  // Check for HTML elements in Swift files (shouldn't exist but catch WKWebView inline HTML)
  const htmlPatterns = [
    { pattern: "<div[\\s>/]", rule: "ios-no-html-div", message: "HTML <div> found in iOS project — use native UIKit/SwiftUI views" },
    { pattern: "<span[\\s>/]", rule: "ios-no-html-span", message: "HTML <span> found in iOS project — use native UIKit/SwiftUI views" },
  ];

  for (const { pattern, rule, message } of htmlPatterns) {
    const matches = grepFiles(repoPath, pattern, ["*.swift"]);
    for (const m of matches) {
      if (m.file.includes("Pods/") || m.file.includes(".build/")) continue;
      violations.push({ file: m.file, line: m.line, rule, severity: "warning", message });
    }
  }

  return violations;
}

function checkAndroidViolations(repoPath: string): DesignViolation[] {
  const violations: DesignViolation[] = [];

  // Check for hardcoded dp values below minimum touch target in XML layouts
  const smallTouchMatches = grepFiles(repoPath, 'android:minHeight="[0-3][0-9]dp"', ["*.xml"]);
  for (const m of smallTouchMatches) {
    if (m.file.includes("build/") || m.file.includes(".gradle/")) continue;
    violations.push({
      file: m.file,
      line: m.line,
      rule: "android-min-touch-48dp",
      severity: "warning",
      message: "Touch target below 48dp minimum — increase minHeight to at least 48dp",
    });
  }

  return violations;
}

function checkWebViolations(repoPath: string): DesignViolation[] {
  const violations: DesignViolation[] = [];

  // Check for images without alt text
  const imgMatches = grepFiles(repoPath, "<img[^>]*>", ["*.tsx", "*.jsx", "*.html"]);
  for (const m of imgMatches) {
    if (m.file.includes("node_modules") || m.file.includes("stitch/")) continue;
    // Check if this img tag has an alt attribute
    if (!m.content.includes("alt=") && !m.content.includes("alt =")) {
      violations.push({
        file: m.file,
        line: m.line,
        rule: "web-img-alt",
        severity: "error",
        message: "Image missing alt text — add alt attribute for WCAG 2.1 AA compliance",
      });
    }
  }

  // Check for icon buttons without aria-label
  // Look for buttons that contain only an icon (svg, Icon component) without aria-label
  const buttonMatches = grepFiles(repoPath, "<button[^>]*>", ["*.tsx", "*.jsx", "*.html"]);
  for (const m of buttonMatches) {
    if (m.file.includes("node_modules") || m.file.includes("stitch/")) continue;
    // Flag buttons without aria-label that look like icon-only buttons
    if (
      !m.content.includes("aria-label") &&
      !m.content.includes("aria-label") &&
      (m.content.includes("Icon") || m.content.includes("<svg") || m.content.includes("icon"))
    ) {
      violations.push({
        file: m.file,
        line: m.line,
        rule: "web-button-aria-label",
        severity: "error",
        message: "Icon button missing aria-label — add aria-label for screen reader accessibility",
      });
    }
  }

  // Check for outline:none without replacement focus styles
  const outlineNoneMatches = grepFiles(repoPath, "outline:\\s*none", ["*.css", "*.scss", "*.tsx", "*.jsx"]);
  for (const m of outlineNoneMatches) {
    if (m.file.includes("node_modules") || m.file.includes("stitch/")) continue;
    if (!m.content.includes("focus-visible") && !m.content.includes("box-shadow")) {
      violations.push({
        file: m.file,
        line: m.line,
        rule: "web-focus-visible",
        severity: "warning",
        message: "outline:none without replacement focus style — add :focus-visible styles for keyboard navigation",
      });
    }
  }

  return violations;
}
