import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

const intentionalBuiltOutputSuites = new Set([
  "src/cli/cli.test.ts",
  "tests/ant.test.ts",
  "tests/steps/01-plan.test.ts",
]);

function collectTypeScriptTests(root: string, directory: string): string[] {
  const absoluteDirectory = path.join(root, directory);
  const files: string[] = [];

  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptTests(root, relativePath));
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(relativePath);
    }
  }

  return files;
}

function isBuiltOutputReference(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  return /(?:^|[\\/])dist[\\/]/.test(node.getText(sourceFile));
}

function findBuiltOutputModuleReferences(sourceFile: ts.SourceFile): string[] {
  const findings: string[] = [];

  function inspect(node: ts.Node): void {
    let target: ts.Node | undefined;

    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      target = node.moduleSpecifier;
    } else if (ts.isImportTypeNode(node)) {
      target = node.argument;
    } else if (
      ts.isCallExpression(node)
      && (
        node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require")
      )
    ) {
      target = node.arguments[0];
    } else if (
      ts.isNewExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === "URL"
    ) {
      target = node.arguments?.[0];
    }

    if (target && isBuiltOutputReference(target, sourceFile)) {
      const location = sourceFile.getLineAndCharacterOfPosition(target.getStart(sourceFile));
      findings.push(`${sourceFile.fileName}:${location.line + 1}:${location.character + 1}`);
    }

    ts.forEachChild(node, inspect);
  }

  inspect(sourceFile);
  return findings;
}

test("tsx source suites do not import packaged dist modules", () => {
  const root = process.cwd();
  const testFiles = [
    ...collectTypeScriptTests(root, "src"),
    ...collectTypeScriptTests(root, "tests"),
  ].sort();
  const findings: string[] = [];

  for (const relativePath of testFiles) {
    if (intentionalBuiltOutputSuites.has(relativePath)) continue;
    const absolutePath = path.join(root, relativePath);
    const sourceFile = ts.createSourceFile(
      relativePath,
      readFileSync(absolutePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    findings.push(...findBuiltOutputModuleReferences(sourceFile));
  }

  assert.deepEqual(
    findings,
    [],
    `source suites must import current TypeScript modules instead of packaged dist modules:\n${findings.join("\n")}`,
  );
});
