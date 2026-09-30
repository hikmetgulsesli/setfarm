import ts from "typescript";

// Test setup only: parse actual source as data, never import ambient db-pg or
// evaluate interpolated SQL. No alternate hand-maintained table definitions.
export function extractTask6aOrdinaryBaseStatementsV2(source: string): readonly string[] {
  const refuse = (): never => { throw Error("TASK6A_ORDINARY_BASE_SOURCE_REFUSED"); };
  if (typeof source !== "string" || source.length > 2_000_000) refuse();
  const ast = ts.createSourceFile("db-pg.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const candidates = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === "pgMigrate");
  if (candidates.length !== 1) refuse();
  const statements: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === "s") {
      if (!ts.isNoSubstitutionTemplateLiteral(node.template)) return refuse();
      statements.push(node.template.text.trim());
    }
    ts.forEachChild(node, visit);
  };
  visit(candidates[0]!);
  const tables = statements.filter(query => /^CREATE TABLE/.test(query))
    .map(query => /^CREATE TABLE IF NOT EXISTS ([a-z_]+)\s*\(/.exec(query)?.[1]);
  if (statements.length !== 52 || statements[0] !== "CREATE SEQUENCE IF NOT EXISTS runs_run_number_seq"
    || tables.join(",") !== "runs,steps,stories,claim_log,rules,medic_checks,run_observations"
    || statements.filter(query => /^ALTER TABLE/.test(query)).length !== 30
    || statements.filter(query => /^CREATE (?:UNIQUE )?INDEX/.test(query)).length !== 12
    || statements.filter(query => /^SELECT/.test(query)).length !== 2
    || !statements[50]?.startsWith("CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_log_open_single_unique ")
    || !statements[51]?.startsWith("CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_log_open_story_unique ")
    || statements.some(query => !/^(?:CREATE (?:SEQUENCE|TABLE|(?:UNIQUE )?INDEX) IF NOT EXISTS |ALTER TABLE |SELECT )/.test(query))) refuse();
  return Object.freeze(statements);
}
