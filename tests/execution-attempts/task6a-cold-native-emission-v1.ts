import path from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { createHash } from "node:crypto";
import * as esbuild from "esbuild";
import ts from "typescript";

type Nomination = Readonly<{ outputDirectory: string; entrySource: string;
  probeSource: string; canonicalSource: string }>;
type Edge = { path: string; kind: "import-statement" | "dynamic-import" | "require-call"; external: boolean };
export type Task6aColdEmissionV1 = Readonly<{ entryPath: string; canonicalPath: string;
  outputs: readonly Readonly<{ path: string; contents: Uint8Array; sha256: string }>[];
  metafile: esbuild.Metafile }>;
const builtins = new Set(builtinModules.flatMap(name => [name, `node:${name}`]));
function requireFact(value: unknown, reason: string): asserts value {
  if (!value) throw Error(`TASK6A_COLD_EMISSION_REFUSED:${reason}`);
}
function absolute(value: string): void {
  requireFact(typeof value === "string" && path.isAbsolute(value) && path.normalize(value) === value
    && !/[\\\x00-\x20?#]/.test(value), "noncanonical-path");
}
function inside(root: string, member: string): void {
  absolute(member);
  const relative = path.relative(root, member);
  requireFact(relative.length > 0 && relative !== ".." && !relative.startsWith("../") && !path.isAbsolute(relative), "escaped-output");
}
function emittedEdges(member: string, contents: Uint8Array, root: string): Edge[] {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(contents);
  const ast = ts.createSourceFile(member, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  // TypeScript's runtime parser supplies this field; validate its shape rather
  // than casting it to public Diagnostic[] or silently accepting parse failure.
  const diagnostics: unknown = (ast as ts.SourceFile & { parseDiagnostics?: unknown }).parseDiagnostics;
  requireFact(Array.isArray(diagnostics) && diagnostics.length === 0, "invalid-javascript");
  const edges: Edge[] = [];
  function record(specifier: ts.Node | undefined, kind: Edge["kind"], passiveModuleHook = false): void {
    requireFact(specifier && ts.isStringLiteral(specifier), "computed-import");
    const name = specifier.text;
    requireFact(!["node:module", "module"].includes(name) || passiveModuleHook, "unnominated-module-loader");
    if (builtins.has(name)) edges.push({ path: name, kind, external: true });
    else {
      requireFact(name.startsWith("./") || name.startsWith("../"), "foreign-import");
      requireFact(!/[\\\x00-\x20?#]/.test(name) && name.endsWith(".js"), "noncanonical-import");
      const destination = path.resolve(path.dirname(member), name); inside(root, destination);
      requireFact(kind !== "require-call", "internal-require");
      requireFact(path.relative(path.dirname(member), destination) === name.replace(/^\.\//, ""), "aliased-import");
      edges.push({ path: destination, kind, external: false });
    }
  }
  function walk(node: ts.Node): void {
    if (ts.isIdentifier(node) && ["require", "__require"].includes(node.text))
      requireFact(ts.isCallExpression(node.parent) && node.parent.expression === node, "require-alias");
    if (ts.isImportDeclaration(node)) {
      requireFact(!node.attributes, "import-attributes");
      const clause = node.importClause, bindings = clause?.namedBindings;
      const passiveModuleHook = !!clause && !clause.name && !!bindings && ts.isNamedImports(bindings)
        && bindings.elements.length > 0 && bindings.elements.every(element => !element.isTypeOnly
          && (element.propertyName ?? element.name).text === "registerHooks");
      record(node.moduleSpecifier, "import-statement", passiveModuleHook);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      requireFact(!node.attributes, "export-attributes"); record(node.moduleSpecifier, "import-statement");
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        requireFact(node.arguments.length === 1, "import-options"); record(node.arguments[0], "dynamic-import");
      } else if (ts.isIdentifier(node.expression) && ["require", "__require"].includes(node.expression.text)) {
        requireFact(node.arguments.length === 1, "require-options"); record(node.arguments[0], "require-call");
      } else if (ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "require") {
        requireFact(false, "require-resolve");
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(ast); return edges;
}

// DATA-only test utility. It neither reads nominated files, evaluates the
// emitted module, writes output nor authenticates production namespace/timing.
export function validateTask6aColdEmissionV1(result: esbuild.BuildResult,
  nomination: Nomination): Task6aColdEmissionV1 {
  try {
    for (const value of Object.values(nomination)) absolute(value);
    const { outputDirectory: root, entrySource, probeSource, canonicalSource } = nomination;
    requireFact(Object.keys(nomination).sort().join(",") === "canonicalSource,entrySource,outputDirectory,probeSource", "nomination-shape");
    requireFact(new Set([entrySource, probeSource, canonicalSource]).size === 3, "nomination-alias");
    requireFact(result.errors.length === 0 && result.warnings.length === 0, "compiler-diagnostics");
    const metadata = result.metafile, outputFiles = result.outputFiles;
    requireFact(metadata && outputFiles && outputFiles.length > 0 && outputFiles.length <= 128, "missing-outputs");
    const inputPaths = Object.keys(metadata.inputs), outputPaths = Object.keys(metadata.outputs);
    requireFact(inputPaths.length > 0 && inputPaths.length <= 4096 && outputPaths.length === outputFiles.length, "graph-size");
    for (const input of inputPaths) absolute(input);
    requireFact([entrySource, probeSource, canonicalSource].every(member => Object.hasOwn(metadata.inputs, member)), "missing-input");
    const canonicalEdges = metadata.inputs[probeSource]!.imports.filter(edge => edge.path === canonicalSource);
    requireFact(canonicalEdges.length === 1 && canonicalEdges[0]!.kind === "dynamic-import"
      && !canonicalEdges[0]!.external && canonicalEdges[0]!.original === "../db/contract-spine-migrations.js", "canonical-input-edge");
    const byteFiles = new Map<string, Uint8Array>();
    let total = 0;
    for (const file of outputFiles) {
      inside(root, file.path);
      requireFact(file.path.endsWith(".js") && !byteFiles.has(file.path) && file.contents instanceof Uint8Array, "byte-output-shape");
      requireFact(Object.hasOwn(metadata.outputs, file.path), "extra-byte-output");
      const bytes = Uint8Array.from(file.contents); total += bytes.length;
      requireFact(bytes.length > 0 && total <= 64 * 1024 * 1024, "output-budget");
      byteFiles.set(file.path, bytes);
    }
    const graph = new Map<string, Edge[]>();
    const contributions = (input: string) => outputPaths.filter(member =>
      (metadata.outputs[member]!.inputs[input]?.bytesInOutput ?? 0) > 0);
    for (const member of outputPaths) {
      inside(root, member);
      const record = metadata.outputs[member]!, bytes = byteFiles.get(member);
      requireFact(bytes && Number.isSafeInteger(record.bytes) && record.bytes === bytes.length && !record.cssBundle, "output-byte-bijection");
      for (const [input, contribution] of Object.entries(record.inputs)) {
        absolute(input);
        requireFact(Object.hasOwn(metadata.inputs, input) && Number.isSafeInteger(contribution.bytesInOutput)
          && contribution.bytesInOutput >= 0, "output-input-contribution");
      }
      const expected: Edge[] = record.imports.map(edge => {
        requireFact(["import-statement", "dynamic-import", "require-call"].includes(edge.kind), "unsupported-edge");
        const external = edge.external === true;
        requireFact(external || edge.kind !== "require-call", "internal-require");
        if (external) requireFact(builtins.has(edge.path), "foreign-external");
        else { inside(root, edge.path); requireFact(byteFiles.has(edge.path), "missing-chunk"); }
        return { path: edge.path, kind: edge.kind as Edge["kind"], external };
      });
      const actual = emittedEdges(member, bytes, root);
      const signatures = (edges: Edge[]) => edges.map(edge => JSON.stringify(edge)).sort();
      requireFact(JSON.stringify(signatures(expected)) === JSON.stringify(signatures(actual)), "emitted-edge-mismatch");
      graph.set(member, actual);
    }
    const entries = outputPaths.filter(member => metadata.outputs[member]!.entryPoint === entrySource);
    const canonical = contributions(canonicalSource), probes = contributions(probeSource);
    requireFact(entries.length === 1 && canonical.length === 1 && probes.length === 1, "entry-owner-contribution");
    const entryPath = entries[0]!, canonicalPath = canonical[0]!;
    function closure(start: string, staticOnly: boolean): Set<string> {
      const seen = new Set<string>();
      function visit(member: string): void {
        if (seen.has(member)) return;
        requireFact(graph.has(member), "orphan-edge"); seen.add(member);
        for (const edge of graph.get(member)!)
          if (!edge.external && (!staticOnly || edge.kind === "import-statement")) visit(edge.path);
      }
      visit(start); return seen;
    }
    requireFact(closure(entryPath, false).size === outputPaths.length, "orphan-output");
    requireFact(!closure(entryPath, true).has(canonicalPath)
      && !closure(probes[0]!, true).has(canonicalPath), "canonical-static-reach");
    requireFact(graph.get(probes[0]!)!.some(edge => !edge.external
      && edge.kind === "dynamic-import" && edge.path === canonicalPath), "canonical-emitted-dynamic-edge");
    const outputs = outputPaths.sort().map(member => {
      const contents = byteFiles.get(member)!;
      return Object.freeze({ path: member, contents,
        sha256: createHash("sha256").update(contents).digest("hex") });
    });
    return Object.freeze({ entryPath, canonicalPath, outputs: Object.freeze(outputs),
      metafile: structuredClone(metadata) });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("TASK6A_COLD_EMISSION_REFUSED:")) throw error;
    throw Error("TASK6A_COLD_EMISSION_REFUSED:malformed-compiler-data");
  }
}

// Fixed trusted test compiler. Replace only the exact probe's diagnostic holder
// and three baseline edges. Bridge-to-real owners and canonical stay genuine.
export async function emitTask6aColdNativeV1(outputDirectory: string): Promise<Task6aColdEmissionV1> {
  absolute(outputDirectory);
  requireFact(esbuild.version === "0.28.1", "compiler-version");
  const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entrySource = path.join(sourceRoot, "tests/execution-attempts/task6a-native-closed-probe-entry.ts");
  const probeSource = path.join(sourceRoot, "src/internal-production/task6a-protected-postgres-backend-probe-v1.ts");
  const canonicalSource = path.join(sourceRoot, "src/db/contract-spine-migrations.ts");
  const bridgeSource = path.join(sourceRoot, "tests/execution-attempts/task6a-native-baseline-observer-bridge-v1.ts");
  const observerSource = path.join(sourceRoot, "tests/execution-attempts/task6a-native-baseline-observer-v1.ts");
  const owners = ["contract-spine-runtime-access-readonly-verifier-v1", "base-schema-readonly-verifier-v1",
    "public-object-owner-readonly-verifier-v1"] as const;
  const result = await esbuild.build({ entryPoints: [entrySource], absWorkingDir: sourceRoot,
    outdir: outputDirectory, bundle: true, platform: "node", format: "esm", splitting: true,
    write: false, metafile: true, absPaths: ["metafile"], logLevel: "silent",
    plugins: [{ name: "private-exact-probe-diagnostic-edges", setup(build) {
      build.onResolve({ filter: /^\.\/task6a-socket-physical-evidence-v1\.js$/ }, args =>
        args.importer === probeSource ? { path: entrySource } : undefined);
      build.onResolve({ filter: /^\.\.\/db\/(?:contract-spine-runtime-access-readonly-verifier-v1|base-schema-readonly-verifier-v1|public-object-owner-readonly-verifier-v1)\.js$/ }, args =>
        args.importer === probeSource ? { path: bridgeSource } : undefined);
    } }],
  });
  const validated = validateTask6aColdEmissionV1(result, { outputDirectory, entrySource, probeSource, canonicalSource });
  const metadata = validated.metafile;
  for (const input of [bridgeSource, observerSource, ...owners.map(owner => path.join(sourceRoot, "src/db", owner + ".ts"))]) {
    requireFact(Object.hasOwn(metadata.inputs, input), "baseline-physical-input");
    requireFact(Object.values(metadata.outputs).filter(output => (output.inputs[input]?.bytesInOutput ?? 0) > 0).length === 1,
      "baseline-positive-contribution");
  }
  for (const owner of owners) {
    const probeEdges = metadata.inputs[probeSource]!.imports.filter(edge => edge.original === `../db/${owner}.js`);
    requireFact(probeEdges.length === 1 && probeEdges[0]!.path === bridgeSource
      && probeEdges[0]!.kind === "import-statement" && !probeEdges[0]!.external, "baseline-probe-route");
    const bridgeEdges = metadata.inputs[bridgeSource]!.imports.filter(edge => edge.original === `../../src/db/${owner}.js`);
    requireFact(bridgeEdges.length === 1 && bridgeEdges[0]!.path === path.join(sourceRoot, "src/db", owner + ".ts")
      && bridgeEdges[0]!.kind === "import-statement" && !bridgeEdges[0]!.external, "baseline-genuine-owner-route");
  }
  return validated;
}
