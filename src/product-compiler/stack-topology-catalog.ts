import { z } from "zod";

import type { StackPackId } from "../installer/stack-contract/types.js";
import { hashCanonicalJson } from "./canonical-json.js";
import {
  BuildCapabilityV1Schema,
  BuildCommandV1Schema,
  BuildEntrypointV1Schema,
  BuildTopologyV1Schema,
  TopologyPathBindingV1Schema,
} from "./schemas/build-topology-v1.js";
import { NormalizedRelativeLocatorSchema, StableReferenceSchema, hasUniqueStrings } from "./schemas/common-v1.js";

export const STACK_TOPOLOGY_CATALOG_VERSION = "1.4.0";

/**
 * Platform-owned, write-free runtime for sealed static and Vite build output.
 * It is an exact catalog artifact, not generated-project source. The final
 * argv value selects a sealed relative root (currently `.` or `dist`).
 */
export const V3_STATIC_SPA_PREVIEW_SOURCE = String.raw`
"use strict";
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const rootArg = process.argv[1];
if (rootArg !== "." && rootArg !== "dist") throw new Error("STATIC_ROOT_INVALID");
const root = fs.realpathSync(path.resolve(rootArg));
if (!fs.lstatSync(root).isDirectory()) throw new Error("STATIC_ROOT_INVALID");
const host = process.env.HOST;
const port = Number(process.env.PORT);
if (host !== "127.0.0.1" || !Number.isSafeInteger(port) || port < 1 || port > 65535) {
  throw new Error("LISTENER_IDENTITY_INVALID");
}
const mime = Object.freeze({
  ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".mjs":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8", ".wasm":"application/wasm",
  ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg", ".gif":"image/gif", ".webp":"image/webp",
  ".avif":"image/avif", ".ico":"image/x-icon", ".woff":"font/woff",
  ".woff2":"font/woff2", ".ttf":"font/ttf", ".otf":"font/otf",
  ".mp3":"audio/mpeg", ".ogg":"audio/ogg", ".wav":"audio/wav",
  ".mp4":"video/mp4", ".webm":"video/webm"
});
function fail(response, status, headers) {
  response.writeHead(status, Object.assign({"content-type":"text/plain; charset=utf-8","x-content-type-options":"nosniff"}, headers || {}));
  response.end(status === 405 ? "method not allowed" : status === 416 ? "range not satisfiable" : "not found");
}
function safeTarget(request) {
  const target = typeof request.url === "string" ? request.url : "/";
  if (target.length > 8192 || !target.startsWith("/") || target.startsWith("//")) throw new Error("URL_INVALID");
  const raw = target.split(/[?#]/, 1)[0];
  if (/%(?:2f|5c)/i.test(raw) || /%(?:25)(?:2e|2f|5c)/i.test(raw)) throw new Error("URL_SEPARATOR_ENCODED");
  const decoded = decodeURIComponent(raw);
  if (decoded.includes("\0") || decoded.includes("\\") || /%[0-9a-f]{2}/i.test(decoded)) throw new Error("URL_INVALID");
  const segments = decoded.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) throw new Error("URL_TRAVERSAL");
  const relative = segments.length === 0 ? "index.html" : segments.join("/");
  const absolute = path.resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) throw new Error("URL_ESCAPE");
  return { absolute, decoded };
}
function regularFile(candidate) {
  try {
    const stat = fs.lstatSync(candidate);
    if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(candidate) !== candidate) return null;
    return stat;
  } catch { return null; }
}
function rangeFor(header, size) {
  if (header === undefined) return null;
  if (typeof header !== "string" || header.length > 200 || header.includes(",")) throw new Error("RANGE_INVALID");
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw new Error("RANGE_INVALID");
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw new Error("RANGE_INVALID");
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) throw new Error("RANGE_INVALID");
  return { start, end: Math.min(end, size - 1) };
}
const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") return fail(response, 405, {allow:"GET, HEAD"});
  let resolved;
  try { resolved = safeTarget(request); } catch { return fail(response, 404); }
  let candidate = resolved.absolute;
  let stat = regularFile(candidate);
  if (!stat) {
    const acceptsHtml = String(request.headers.accept || "").toLowerCase().includes("text/html");
    const extensionless = path.posix.extname(resolved.decoded) === "";
    if (!acceptsHtml || !extensionless) return fail(response, 404);
    candidate = path.join(root, "index.html");
    stat = regularFile(candidate);
    if (!stat) return fail(response, 404);
  }
  let selected;
  try { selected = rangeFor(request.headers.range, stat.size); }
  catch { return fail(response, 416, {"content-range":"bytes */" + stat.size,"accept-ranges":"bytes"}); }
  const start = selected ? selected.start : 0;
  const end = selected ? selected.end : Math.max(0, stat.size - 1);
  const length = stat.size === 0 ? 0 : end - start + 1;
  const headers = {
    "content-type": mime[path.extname(candidate).toLowerCase()] || "application/octet-stream",
    "content-length": String(length), "accept-ranges":"bytes", "x-content-type-options":"nosniff"
  };
  if (selected) headers["content-range"] = "bytes " + start + "-" + end + "/" + stat.size;
  response.writeHead(selected ? 206 : 200, headers);
  if (request.method === "HEAD" || stat.size === 0) return response.end();
  const stream = fs.createReadStream(candidate, {start, end});
  stream.once("error", () => response.destroy());
  request.once("aborted", () => stream.destroy());
  stream.pipe(response);
});
server.on("clientError", (_error, socket) => socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"));
server.listen(port, host);
`;

export function isPlatformOwnedV3PreviewCommand(
  command: Pick<z.infer<typeof BuildCommandV1Schema>, "kind" | "argv" | "cwd">,
): boolean {
  return command.kind === "preview"
    && command.cwd === "."
    && command.argv.length === 4
    && command.argv[0] === "node"
    && command.argv[1] === "-e"
    && command.argv[2] === V3_STATIC_SPA_PREVIEW_SOURCE
    && (command.argv[3] === "." || command.argv[3] === "dist");
}

export const STACK_TOPOLOGY_PACK_IDS = [
  "nextjs-web-app",
  "vite-react-web-app",
  "static-html-site",
  "browser-game-canvas",
  "node-express-api",
  "node-cli",
  "python-cli",
  "python-web",
  "react-native-expo",
  "android-app",
  "ios-app",
  "desktop-electron",
] as const satisfies readonly StackPackId[];

const StackTopologyPackIdSchema = z.enum(STACK_TOPOLOGY_PACK_IDS);
const EntrypointKindSchema = BuildEntrypointV1Schema.shape.kind;
const CommandKindSchema = BuildCommandV1Schema.shape.kind;
const CapabilityKindSchema = BuildCapabilityV1Schema.shape.kind;
const PathRoleSchema = TopologyPathBindingV1Schema.shape.role;
const PackageManagerSchema = BuildTopologyV1Schema.shape.policies.shape.packageManager;

const StackDeploymentActivationV1Schema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("active"),
    adapterId: z.literal("setfarm-local-process-v3"),
  }).strict(),
  z.object({
    status: z.literal("not_deployable"),
    reasonCode: z.enum([
      "V3_DEPLOY_PROFILE_NO_PREVIEW_CONTRACT",
      "V3_DEPLOY_RUNTIME_COMMAND_UNRESOLVED",
      "V3_DEPLOY_RUNTIME_NETWORK_POLICY_UNSUPPORTED",
    ]),
  }).strict(),
]);

const ExactEntrypointMatcherV1Schema = z
  .object({
    kind: z.literal("exact"),
    path: NormalizedRelativeLocatorSchema,
  })
  .strict();

const BasenameEntrypointMatcherV1Schema = z
  .object({
    kind: z.literal("basename"),
    basename: z.string().min(1).max(255).refine((value) => !value.includes("/") && !value.includes("\\"), {
      message: "Entrypoint basename must be one path segment",
    }),
    underRoot: NormalizedRelativeLocatorSchema.optional(),
  })
  .strict();

const BasenameSuffixEntrypointMatcherV1Schema = z
  .object({
    kind: z.literal("basename_suffix"),
    suffix: z.string().min(1).max(255).refine((value) => !value.includes("/") && !value.includes("\\"), {
      message: "Entrypoint basename suffix must be one path segment",
    }),
    underRoot: NormalizedRelativeLocatorSchema.optional(),
  })
  .strict();

export const StackEntrypointMatcherV1Schema = z.discriminatedUnion("kind", [
  ExactEntrypointMatcherV1Schema,
  BasenameEntrypointMatcherV1Schema,
  BasenameSuffixEntrypointMatcherV1Schema,
]);

export type StackEntrypointMatcherV1 = z.infer<typeof StackEntrypointMatcherV1Schema>;

const StackEntrypointRuleV1Schema = z
  .object({
    id: StableReferenceSchema,
    entrypointKind: EntrypointKindSchema,
    mountPoint: z.string().min(1).max(500),
    matcher: StackEntrypointMatcherV1Schema,
  })
  .strict();

const StackCatalogCapabilityV1Schema = z
  .object({
    id: BuildCapabilityV1Schema.shape.id,
    kind: CapabilityKindSchema,
    enabled: z.boolean(),
    required: z.boolean(),
    provider: z.string().min(1).max(200).optional(),
    providers: z.array(z.string().min(1).max(200)).max(100).refine(hasUniqueStrings, {
      message: "Catalog capability providers must be unique",
    }),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.required && !value.enabled) {
      context.addIssue({ code: "custom", path: ["enabled"], message: "Required capabilities must be enabled" });
    }
    if (value.provider && !value.providers.includes(value.provider)) {
      context.addIssue({
        code: "custom",
        path: ["provider"],
        message: "Selected capability provider must be catalog-authorized",
      });
    }
  });

export const StackTopologyCatalogDescriptorV1Schema = z
  .object({
    schema: z.literal("setfarm.stack-topology-catalog.v1"),
    version: z.literal(STACK_TOPOLOGY_CATALOG_VERSION),
    stackPackId: StackTopologyPackIdSchema,
    packageManager: PackageManagerSchema,
    entrypointKinds: z.array(EntrypointKindSchema).min(1).max(10).refine(hasUniqueStrings, {
      message: "Catalog entrypoint kinds must be unique",
    }),
    requiredEntrypointKinds: z.array(EntrypointKindSchema).min(1).max(10).refine(hasUniqueStrings, {
      message: "Required entrypoint kinds must be unique",
    }),
    entrypointRules: z.array(StackEntrypointRuleV1Schema).min(1).max(100),
    commands: z.array(BuildCommandV1Schema).min(1).max(100),
    requiredCommandKinds: z.array(CommandKindSchema).min(1).max(10).refine(hasUniqueStrings, {
      message: "Required command kinds must be unique",
    }),
    capabilities: z.array(StackCatalogCapabilityV1Schema).max(100),
    requiredPathRoles: z.array(PathRoleSchema).min(1).max(20).refine(hasUniqueStrings, {
      message: "Required path roles must be unique",
    }),
    deniedGlobs: z.array(z.string().min(1).max(500)).max(100).refine(hasUniqueStrings, {
      message: "Denied globs must be unique",
    }),
    buildOutputPaths: z.array(NormalizedRelativeLocatorSchema).max(100).refine(hasUniqueStrings, {
      message: "Build output paths must be unique",
    }),
    deploymentActivation: StackDeploymentActivationV1Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const entrypointKinds = new Set(value.entrypointKinds);
    value.requiredEntrypointKinds.forEach((kind, index) => {
      if (!entrypointKinds.has(kind)) {
        context.addIssue({
          code: "custom",
          path: ["requiredEntrypointKinds", index],
          message: `Required entrypoint kind is unsupported: ${kind}`,
        });
      }
      if (!value.entrypointRules.some((rule) => rule.entrypointKind === kind)) {
        context.addIssue({
          code: "custom",
          path: ["requiredEntrypointKinds", index],
          message: `Required entrypoint kind has no machine-readable path rule: ${kind}`,
        });
      }
    });
    value.entrypointRules.forEach((rule, index) => {
      if (!entrypointKinds.has(rule.entrypointKind)) {
        context.addIssue({
          code: "custom",
          path: ["entrypointRules", index, "entrypointKind"],
          message: `Entrypoint rule uses unsupported kind: ${rule.entrypointKind}`,
        });
      }
    });
    if (!hasUniqueStrings(value.entrypointRules.map((rule) => rule.id))) {
      context.addIssue({ code: "custom", path: ["entrypointRules"], message: "Entrypoint rule IDs must be unique" });
    }
    if (!hasUniqueStrings(value.commands.map((command) => command.id))) {
      context.addIssue({ code: "custom", path: ["commands"], message: "Catalog command IDs must be unique" });
    }
    if (!hasUniqueStrings(value.capabilities.map((capability) => capability.id))) {
      context.addIssue({ code: "custom", path: ["capabilities"], message: "Catalog capability IDs must be unique" });
    }

    const observedCommandKinds = new Set(value.commands.map((command) => command.kind));
    value.requiredCommandKinds.forEach((kind, index) => {
      if (!observedCommandKinds.has(kind)) {
        context.addIssue({
          code: "custom",
          path: ["requiredCommandKinds", index],
          message: `Required command kind has no explicit argv: ${kind}`,
        });
      }
    });
    if (!value.requiredCommandKinds.includes("build")) {
      context.addIssue({ code: "custom", path: ["requiredCommandKinds"], message: "Every stack must require build" });
    }
    if (
      value.deploymentActivation.status === "active"
      && (!observedCommandKinds.has("preview") || !value.requiredCommandKinds.includes("preview"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["deploymentActivation"],
        message: "An active deployment profile must require one exact preview command",
      });
    }
    if (
      value.deploymentActivation.status === "not_deployable"
      && value.deploymentActivation.reasonCode === "V3_DEPLOY_PROFILE_NO_PREVIEW_CONTRACT"
      && observedCommandKinds.has("preview")
    ) {
      context.addIssue({
        code: "custom",
        path: ["deploymentActivation"],
        message: "A profile with an exact preview command cannot be marked not deployable",
      });
    }

    const capabilities = new Map(value.capabilities.map((capability) => [capability.id, capability]));
    value.commands.forEach((command, commandIndex) => {
      const platformPreview = isPlatformOwnedV3PreviewCommand(command);
      if (
        /\s/.test(command.argv[0] ?? "")
        || (!platformPreview && command.argv.some((argument) => /[\n\r\0]|\$\(|`|[|;&<>]/.test(argument)))
      ) {
        context.addIssue({
          code: "custom",
          path: ["commands", commandIndex, "argv"],
          message: "Catalog commands must be direct argv, never shell prose or shell expressions",
        });
      }
      command.capabilityRefs.forEach((capabilityRef, capabilityIndex) => {
        const capability = capabilities.get(capabilityRef);
        if (!capability?.enabled) {
          context.addIssue({
            code: "custom",
            path: ["commands", commandIndex, "capabilityRefs", capabilityIndex],
            message: `Command references absent or disabled capability: ${capabilityRef}`,
          });
        }
      });
    });
    if (
      value.deploymentActivation.status === "active"
      && !value.commands.some(isPlatformOwnedV3PreviewCommand)
    ) {
      context.addIssue({
        code: "custom",
        path: ["deploymentActivation"],
        message: "Active v3 deployment requires the exact platform-owned static runtime",
      });
    }
  });

export type StackTopologyCatalogDescriptorV1 = z.infer<typeof StackTopologyCatalogDescriptorV1Schema>;

type CatalogCommand = z.input<typeof BuildCommandV1Schema>;
type CatalogCapability = z.input<typeof StackCatalogCapabilityV1Schema>;
type CatalogEntrypointRule = z.input<typeof StackEntrypointRuleV1Schema>;

function command(
  id: string,
  kind: CatalogCommand["kind"],
  argv: string[],
  capabilityRefs: string[] = [],
  timeoutMs = 120_000,
): CatalogCommand {
  return { id, kind, argv, cwd: ".", timeoutMs, capabilityRefs };
}

function capability(
  id: string,
  kind: CatalogCapability["kind"],
  required = true,
): CatalogCapability {
  return { id, kind, enabled: true, required, providers: [] };
}

function exactRule(
  id: string,
  entrypointKind: CatalogEntrypointRule["entrypointKind"],
  mountPoint: string,
  path: string,
): CatalogEntrypointRule {
  return { id, entrypointKind, mountPoint, matcher: { kind: "exact", path } };
}

function basenameRule(
  id: string,
  entrypointKind: CatalogEntrypointRule["entrypointKind"],
  mountPoint: string,
  basename: string,
  underRoot?: string,
): CatalogEntrypointRule {
  return {
    id,
    entrypointKind,
    mountPoint,
    matcher: { kind: "basename", basename, ...(underRoot ? { underRoot } : {}) },
  };
}

function basenameSuffixRule(
  id: string,
  entrypointKind: CatalogEntrypointRule["entrypointKind"],
  mountPoint: string,
  suffix: string,
): CatalogEntrypointRule {
  return { id, entrypointKind, mountPoint, matcher: { kind: "basename_suffix", suffix } };
}

function browserCapabilities(withTests = true): CatalogCapability[] {
  return [
    capability("CAP_BROWSER_INTERACTION", "browser_interaction"),
    capability("CAP_RUNTIME_STATE", "other"),
    capability("CAP_LOCAL_PERSISTENCE", "local_persistence", false),
    capability("CAP_VISUAL_CAPTURE", "visual_capture"),
    ...(withTests ? [capability("CAP_TEST_RUNNER", "test_runner")] : []),
  ];
}

function serviceCapabilities(): CatalogCapability[] {
  return [
    capability("CAP_RUNTIME_STATE", "other"),
    capability("CAP_NETWORK_ACCESS", "network"),
    capability("CAP_FILESYSTEM_ACCESS", "filesystem", false),
    capability("CAP_TEST_RUNNER", "test_runner"),
  ];
}

function cliCapabilities(): CatalogCapability[] {
  return [
    capability("CAP_RUNTIME_STATE", "other"),
    capability("CAP_CLI_INTERACTION", "cli_interaction"),
    capability("CAP_FILESYSTEM_ACCESS", "filesystem", false),
    capability("CAP_TEST_RUNNER", "test_runner"),
  ];
}

function nativeCapabilities(): CatalogCapability[] {
  return [
    capability("CAP_RUNTIME_STATE", "other"),
    capability("CAP_NATIVE_RUNTIME", "native_runtime"),
    capability("CAP_LOCAL_PERSISTENCE", "local_persistence", false),
    capability("CAP_VISUAL_CAPTURE", "visual_capture"),
    capability("CAP_TEST_RUNNER", "test_runner"),
  ];
}

function descriptor(
  input: Omit<
    z.input<typeof StackTopologyCatalogDescriptorV1Schema>,
    "schema" | "version" | "deploymentActivation"
  > & Readonly<{
    deploymentActivation?: z.input<typeof StackDeploymentActivationV1Schema>;
  }>,
) {
  const { deploymentActivation, ...contract } = input;
  const hasPreview = input.commands.some((entry) => entry.kind === "preview");
  return {
    schema: "setfarm.stack-topology-catalog.v1" as const,
    version: STACK_TOPOLOGY_CATALOG_VERSION,
    ...contract,
    deploymentActivation: deploymentActivation ?? (hasPreview
      ? { status: "active" as const, adapterId: "setfarm-local-process-v3" as const }
      : {
        status: "not_deployable" as const,
        reasonCode: "V3_DEPLOY_PROFILE_NO_PREVIEW_CONTRACT" as const,
      }),
  };
}

const DENIED_GLOBS = [".env*", ".git/**", ".setfarm/**"];

const RAW_STACK_TOPOLOGY_CATALOG = {
  "nextjs-web-app": descriptor({
    stackPackId: "nextjs-web-app",
    packageManager: "npm",
    entrypointKinds: ["web"],
    requiredEntrypointKinds: ["web"],
    entrypointRules: [
      exactRule("ENTRY_RULE_NEXT_APP", "web", "/", "app/page.tsx"),
      exactRule("ENTRY_RULE_NEXT_PAGES", "web", "/", "pages/index.tsx"),
    ],
    commands: [
      command("CMD_INSTALL", "install", ["npm", "install"]),
      command("CMD_BUILD", "build", ["npm", "run", "build"]),
      command("CMD_TEST", "test", ["npm", "test"], ["CAP_TEST_RUNNER"]),
      command("CMD_PREVIEW", "preview", ["npm", "run", "start", "--", "--hostname", "{{HOST}}", "--port", "{{PORT}}"]),
    ],
    requiredCommandKinds: ["build", "test", "preview"],
    deploymentActivation: {
      status: "not_deployable",
      reasonCode: "V3_DEPLOY_RUNTIME_COMMAND_UNRESOLVED",
    },
    capabilities: browserCapabilities(),
    requiredPathRoles: ["entrypoint", "source"],
    deniedGlobs: DENIED_GLOBS,
    buildOutputPaths: [".next"],
  }),
  "vite-react-web-app": descriptor({
    stackPackId: "vite-react-web-app",
    packageManager: "npm",
    entrypointKinds: ["web"],
    requiredEntrypointKinds: ["web"],
    entrypointRules: [
      exactRule("ENTRY_RULE_VITE_MAIN_TSX", "web", "/", "src/main.tsx"),
      exactRule("ENTRY_RULE_VITE_MAIN_JSX", "web", "/", "src/main.jsx"),
      exactRule("ENTRY_RULE_VITE_APP_TSX", "web", "/", "src/App.tsx"),
      exactRule("ENTRY_RULE_VITE_APP_JSX", "web", "/", "src/App.jsx"),
    ],
    commands: [
      command("CMD_INSTALL", "install", ["npm", "install"]),
      command("CMD_BUILD", "build", ["npm", "run", "build"]),
      command("CMD_TEST", "test", ["npm", "test"], ["CAP_TEST_RUNNER"]),
      command("CMD_PREVIEW", "preview", ["node", "-e", V3_STATIC_SPA_PREVIEW_SOURCE, "dist"]),
    ],
    requiredCommandKinds: ["build", "test", "preview"],
    capabilities: browserCapabilities(),
    requiredPathRoles: ["entrypoint", "source"],
    deniedGlobs: DENIED_GLOBS,
    buildOutputPaths: ["dist"],
  }),
  "static-html-site": descriptor({
    stackPackId: "static-html-site",
    packageManager: "none",
    entrypointKinds: ["web"],
    requiredEntrypointKinds: ["web"],
    entrypointRules: [exactRule("ENTRY_RULE_STATIC_INDEX", "web", "/", "index.html")],
    commands: [
      command("CMD_BUILD", "build", ["true"], [], 10_000),
      command("CMD_PREVIEW", "preview", ["node", "-e", V3_STATIC_SPA_PREVIEW_SOURCE, "."]),
    ],
    requiredCommandKinds: ["build", "preview"],
    capabilities: browserCapabilities(false),
    requiredPathRoles: ["entrypoint", "source"],
    deniedGlobs: DENIED_GLOBS,
    buildOutputPaths: ["index.html"],
  }),
  "browser-game-canvas": descriptor({
    stackPackId: "browser-game-canvas",
    packageManager: "npm",
    entrypointKinds: ["game"],
    requiredEntrypointKinds: ["game"],
    entrypointRules: [
      exactRule("ENTRY_RULE_GAME_MAIN_TSX", "game", "/", "src/main.tsx"),
      exactRule("ENTRY_RULE_GAME_MAIN_JSX", "game", "/", "src/main.jsx"),
      exactRule("ENTRY_RULE_GAME_APP_TSX", "game", "/", "src/App.tsx"),
      exactRule("ENTRY_RULE_GAME_APP_JSX", "game", "/", "src/App.jsx"),
      exactRule("ENTRY_RULE_GAME_INDEX", "game", "/", "index.html"),
    ],
    commands: [
      command("CMD_INSTALL", "install", ["npm", "install"]),
      command("CMD_BUILD", "build", ["npm", "run", "build"]),
      command("CMD_TEST", "test", ["npm", "test"], ["CAP_TEST_RUNNER"]),
      command("CMD_PREVIEW", "preview", ["node", "-e", V3_STATIC_SPA_PREVIEW_SOURCE, "dist"]),
    ],
    requiredCommandKinds: ["build", "test", "preview"],
    capabilities: [
      ...browserCapabilities(),
      capability("CAP_GAME_TIMING", "other"),
    ],
    requiredPathRoles: ["entrypoint", "source"],
    deniedGlobs: DENIED_GLOBS,
    buildOutputPaths: ["dist"],
  }),
  "node-express-api": descriptor({
    stackPackId: "node-express-api",
    packageManager: "npm",
    entrypointKinds: ["api"],
    requiredEntrypointKinds: ["api"],
    entrypointRules: [
      exactRule("ENTRY_RULE_NODE_SERVER", "api", "/", "src/server.ts"),
      exactRule("ENTRY_RULE_NODE_APP", "api", "/", "src/app.ts"),
      exactRule("ENTRY_RULE_NODE_ROOT_SERVER", "api", "/", "server.ts"),
    ],
    commands: [
      command("CMD_INSTALL", "install", ["npm", "install"]),
      command("CMD_BUILD", "build", ["npm", "run", "build"]),
      command("CMD_TEST", "test", ["npm", "test"], ["CAP_TEST_RUNNER"]),
      command("CMD_PREVIEW", "preview", ["npm", "run", "start"]),
    ],
    requiredCommandKinds: ["build", "test", "preview"],
    deploymentActivation: {
      status: "not_deployable",
      reasonCode: "V3_DEPLOY_RUNTIME_NETWORK_POLICY_UNSUPPORTED",
    },
    capabilities: serviceCapabilities(),
    requiredPathRoles: ["entrypoint", "source"],
    deniedGlobs: DENIED_GLOBS,
    buildOutputPaths: ["dist"],
  }),
  "node-cli": descriptor({
    stackPackId: "node-cli",
    packageManager: "npm",
    entrypointKinds: ["cli"],
    requiredEntrypointKinds: ["cli"],
    entrypointRules: [
      exactRule("ENTRY_RULE_NODE_CLI", "cli", "command", "src/cli.ts"),
      exactRule("ENTRY_RULE_NODE_INDEX", "cli", "command", "src/index.ts"),
    ],
    commands: [
      command("CMD_INSTALL", "install", ["npm", "install"]),
      command("CMD_BUILD", "build", ["npm", "run", "build"]),
      command("CMD_TEST", "test", ["npm", "test"], ["CAP_TEST_RUNNER"]),
    ],
    requiredCommandKinds: ["build", "test"],
    capabilities: cliCapabilities(),
    requiredPathRoles: ["entrypoint", "source"],
    deniedGlobs: DENIED_GLOBS,
    buildOutputPaths: [],
  }),
  "python-cli": descriptor({
    stackPackId: "python-cli",
    packageManager: "pip",
    entrypointKinds: ["cli"],
    requiredEntrypointKinds: ["cli"],
    entrypointRules: [
      exactRule("ENTRY_RULE_PYTHON_MAIN", "cli", "command", "main.py"),
      exactRule("ENTRY_RULE_PYTHON_CLI", "cli", "command", "cli.py"),
      basenameRule("ENTRY_RULE_PYTHON_MODULE_MAIN", "cli", "command", "__main__.py", "src"),
    ],
    commands: [
      command("CMD_INSTALL", "install", ["python3", "-m", "pip", "install", "-r", "requirements.txt"]),
      command("CMD_BUILD", "build", ["python3", "-m", "compileall", "."], ["CAP_FILESYSTEM_ACCESS"]),
      command("CMD_TEST", "test", ["python3", "-m", "pytest"], ["CAP_TEST_RUNNER"]),
    ],
    requiredCommandKinds: ["build", "test"],
    capabilities: cliCapabilities(),
    requiredPathRoles: ["entrypoint", "source"],
    deniedGlobs: DENIED_GLOBS,
    buildOutputPaths: [],
  }),
  "python-web": descriptor({
    stackPackId: "python-web",
    packageManager: "pip",
    entrypointKinds: ["web"],
    requiredEntrypointKinds: ["web"],
    entrypointRules: [
      exactRule("ENTRY_RULE_PYTHON_WEB_MAIN", "web", "/", "main.py"),
      exactRule("ENTRY_RULE_PYTHON_WEB_APP", "web", "/", "app.py"),
      exactRule("ENTRY_RULE_PYTHON_WEB_SRC_MAIN", "web", "/", "src/main.py"),
    ],
    commands: [
      command("CMD_INSTALL", "install", ["python3", "-m", "pip", "install", "-r", "requirements.txt"]),
      command("CMD_BUILD", "build", ["python3", "-m", "compileall", "."], ["CAP_FILESYSTEM_ACCESS"]),
      command("CMD_TEST", "test", ["python3", "-m", "pytest"], ["CAP_TEST_RUNNER"]),
    ],
    requiredCommandKinds: ["build", "test"],
    deploymentActivation: {
      status: "not_deployable",
      reasonCode: "V3_DEPLOY_RUNTIME_COMMAND_UNRESOLVED",
    },
    capabilities: serviceCapabilities(),
    requiredPathRoles: ["entrypoint", "source"],
    deniedGlobs: DENIED_GLOBS,
    buildOutputPaths: [],
  }),
  "react-native-expo": descriptor({
    stackPackId: "react-native-expo",
    packageManager: "npm",
    entrypointKinds: ["native"],
    requiredEntrypointKinds: ["native"],
    entrypointRules: [
      exactRule("ENTRY_RULE_EXPO_APP", "native", "application", "App.tsx"),
      exactRule("ENTRY_RULE_EXPO_SRC_APP", "native", "application", "src/App.tsx"),
      exactRule("ENTRY_RULE_EXPO_LAYOUT", "native", "application", "app/_layout.tsx"),
    ],
    commands: [
      command("CMD_INSTALL", "install", ["npm", "install"]),
      command("CMD_BUILD", "build", ["npx", "expo", "export", "--platform", "web", "--dev"], ["CAP_NATIVE_RUNTIME"], 300_000),
      command("CMD_TEST", "test", ["npm", "test"], ["CAP_TEST_RUNNER"]),
    ],
    requiredCommandKinds: ["build", "test"],
    capabilities: nativeCapabilities(),
    requiredPathRoles: ["entrypoint", "source"],
    deniedGlobs: DENIED_GLOBS,
    buildOutputPaths: ["dist"],
  }),
  "android-app": descriptor({
    stackPackId: "android-app",
    packageManager: "gradle",
    entrypointKinds: ["native"],
    requiredEntrypointKinds: ["native"],
    entrypointRules: [
      exactRule("ENTRY_RULE_ANDROID_MANIFEST", "native", "application", "app/src/main/AndroidManifest.xml"),
      basenameRule("ENTRY_RULE_ANDROID_ACTIVITY", "native", "application", "MainActivity.kt", "app/src/main"),
    ],
    commands: [
      command("CMD_BUILD", "build", ["./gradlew", "build"], ["CAP_NATIVE_RUNTIME"], 600_000),
      command("CMD_TEST", "test", ["./gradlew", "test"], ["CAP_TEST_RUNNER"], 600_000),
    ],
    requiredCommandKinds: ["build", "test"],
    capabilities: nativeCapabilities(),
    requiredPathRoles: ["entrypoint", "source"],
    deniedGlobs: DENIED_GLOBS,
    buildOutputPaths: ["app/build"],
  }),
  "ios-app": descriptor({
    stackPackId: "ios-app",
    packageManager: "xcode",
    entrypointKinds: ["native"],
    requiredEntrypointKinds: ["native"],
    entrypointRules: [
      basenameSuffixRule("ENTRY_RULE_IOS_APP", "native", "application", "App.swift"),
      basenameRule("ENTRY_RULE_IOS_APP_DELEGATE", "native", "application", "AppDelegate.swift"),
      basenameRule("ENTRY_RULE_IOS_SCENE_DELEGATE", "native", "application", "SceneDelegate.swift"),
      basenameRule("ENTRY_RULE_IOS_CONTENT_VIEW", "native", "application", "ContentView.swift"),
    ],
    commands: [
      command("CMD_BUILD", "build", ["xcodebuild", "build"], ["CAP_NATIVE_RUNTIME"], 600_000),
      command("CMD_TEST", "test", ["xcodebuild", "test"], ["CAP_TEST_RUNNER"], 600_000),
    ],
    requiredCommandKinds: ["build", "test"],
    capabilities: nativeCapabilities(),
    requiredPathRoles: ["entrypoint", "source"],
    deniedGlobs: DENIED_GLOBS,
    buildOutputPaths: [],
  }),
  "desktop-electron": descriptor({
    stackPackId: "desktop-electron",
    packageManager: "npm",
    entrypointKinds: ["native", "web"],
    requiredEntrypointKinds: ["native", "web"],
    entrypointRules: [
      exactRule("ENTRY_RULE_ELECTRON_MAIN", "native", "application", "src/main.ts"),
      exactRule("ENTRY_RULE_ELECTRON_RENDERER", "web", "/", "src/renderer/main.tsx"),
      exactRule("ENTRY_RULE_ELECTRON_APP", "web", "/", "src/App.tsx"),
    ],
    commands: [
      command("CMD_INSTALL", "install", ["npm", "install"]),
      command("CMD_BUILD", "build", ["npm", "run", "build"], ["CAP_NATIVE_RUNTIME"]),
      command("CMD_TEST", "test", ["npm", "test"], ["CAP_TEST_RUNNER"]),
    ],
    requiredCommandKinds: ["build", "test"],
    capabilities: [
      ...nativeCapabilities(),
      capability("CAP_BROWSER_INTERACTION", "browser_interaction"),
      capability("CAP_FILESYSTEM_ACCESS", "filesystem", false),
    ],
    requiredPathRoles: ["entrypoint", "source"],
    deniedGlobs: DENIED_GLOBS,
    buildOutputPaths: ["dist"],
  }),
} satisfies Record<StackPackId, unknown>;

const STACK_TOPOLOGY_CATALOG = Object.fromEntries(
  STACK_TOPOLOGY_PACK_IDS.map((packId) => [
    packId,
    StackTopologyCatalogDescriptorV1Schema.parse(RAW_STACK_TOPOLOGY_CATALOG[packId]),
  ]),
) as Record<StackPackId, StackTopologyCatalogDescriptorV1>;

export type StackTopologyCatalogContractV1 = Readonly<{
  descriptor: StackTopologyCatalogDescriptorV1;
  identity: {
    id: StackPackId;
    version: string;
    contentHash: string;
  };
}>;

export function computeStackTopologyCatalogContentHash(input: unknown): string {
  return hashCanonicalJson(StackTopologyCatalogDescriptorV1Schema.parse(input));
}

export function getStackTopologyCatalogContract(packId: string): StackTopologyCatalogContractV1 | null {
  if (!(STACK_TOPOLOGY_PACK_IDS as readonly string[]).includes(packId)) return null;
  const descriptor = structuredClone(STACK_TOPOLOGY_CATALOG[packId as StackPackId]);
  return {
    descriptor,
    identity: {
      id: descriptor.stackPackId,
      version: descriptor.version,
      contentHash: computeStackTopologyCatalogContentHash(descriptor),
    },
  };
}

export function listStackTopologyCatalogContracts(): StackTopologyCatalogContractV1[] {
  return STACK_TOPOLOGY_PACK_IDS.map((packId) => getStackTopologyCatalogContract(packId)!);
}

function underRoot(path: string, root: string | undefined): boolean {
  return !root || path === root || path.startsWith(`${root}/`);
}

export function matchesStackEntrypointRule(
  path: string,
  matcher: StackEntrypointMatcherV1,
): boolean {
  if (matcher.kind === "exact") return path === matcher.path;
  if (!underRoot(path, matcher.underRoot)) return false;
  const basename = path.split("/").at(-1) ?? "";
  if (matcher.kind === "basename") return basename === matcher.basename;
  return basename.endsWith(matcher.suffix);
}
