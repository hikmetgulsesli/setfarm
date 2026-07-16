import ts from "typescript";

import type { CompilationDiagnosticV1 } from "./schemas/compilation-report-v1.js";
import type { StitchScreenIndexEntryV2 } from "./schemas/stitch-screen-index-v2.js";

export const STITCH_SCREEN_SOURCE_DIAGNOSTIC_CODES_V2 = [
  "STITCH_SCREEN_SOURCE_TSX_INVALID",
  "STITCH_SCREEN_IDENTITY_ATTRIBUTE_NON_LITERAL",
  "STITCH_SCREEN_ACTION_CONTROL_MISSING",
  "STITCH_SCREEN_ACTION_CONTROL_AMBIGUOUS",
  "STITCH_SCREEN_ACTION_BINDING_MISMATCH",
  "STITCH_SCREEN_CONTROL_SLOT_MISMATCH",
  "STITCH_SCREEN_ACTION_SOURCE_ELEMENT_REF_MISMATCH",
  "STITCH_SCREEN_CONTROL_TAG_MISMATCH",
  "STITCH_SCREEN_CONTROL_ACCESSIBILITY_MISMATCH",
  "STITCH_SCREEN_CONTROL_HREF_MISMATCH",
  "STITCH_SCREEN_ACTION_DISPATCH_MISMATCH",
  "STITCH_SCREEN_ACTION_PAYLOAD_MISMATCH",
  "STITCH_SCREEN_ACTION_DEFAULT_BEHAVIOR_MISMATCH",
  "STITCH_SCREEN_INPUT_CONTROL_MISSING",
  "STITCH_SCREEN_INPUT_CONTROL_AMBIGUOUS",
  "STITCH_SCREEN_INPUT_BINDINGS_MISMATCH",
  "STITCH_SCREEN_INPUT_SOURCE_ELEMENT_REF_MISMATCH",
  "STITCH_SCREEN_INPUT_TRANSPORT_MISMATCH",
  "STITCH_SCREEN_OBSERVABLE_MISSING",
  "STITCH_SCREEN_OBSERVABLE_AMBIGUOUS",
  "STITCH_SCREEN_OBSERVABLE_SOURCE_ELEMENT_REF_MISMATCH",
  "STITCH_SCREEN_OBSERVABLE_ACCESSIBILITY_MISMATCH",
  "STITCH_SCREEN_OBSERVABLE_CONTROL_SLOT_MISMATCH",
  "STITCH_SCREEN_OBSERVABLE_SURFACE_MISMATCH",
  "STITCH_SCREEN_EXTRA_ACTION_CONTROL_ID",
  "STITCH_SCREEN_EXTRA_INPUT_CONTROL_ID",
  "STITCH_SCREEN_INTERACTIVE_ELEMENT_UNINDEXED",
  "STITCH_SCREEN_CONTRACT_ELEMENT_SPREAD_FORBIDDEN",
  "STITCH_SCREEN_COMPONENT_EXPORT_MISSING",
  "STITCH_SCREEN_REJECTED_CONTROL_CONTRACT_INVALID",
  "STITCH_SCREEN_REJECTED_CONTROL_MISSING",
  "STITCH_SCREEN_REJECTED_CONTROL_AMBIGUOUS",
  "STITCH_SCREEN_REJECTED_CONTROL_ACTIVE",
  "STITCH_SCREEN_EXTRA_REJECTED_CONTROL_ID",
] as const;

export type StitchScreenSourceDiagnosticCodeV2 =
  (typeof STITCH_SCREEN_SOURCE_DIAGNOSTIC_CODES_V2)[number];

export type StitchScreenSourceDiagnosticV2 = Readonly<
  Omit<CompilationDiagnosticV1, "code"> & {
    code: StitchScreenSourceDiagnosticCodeV2;
  }
>;

export type StitchScreenSourceValidationResultV2 =
  | Readonly<{
      status: "valid";
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "invalid";
      rejectionCodes: readonly StitchScreenSourceDiagnosticCodeV2[];
      diagnostics: readonly StitchScreenSourceDiagnosticV2[];
    }>;

export type StitchScreenSourceValidationInputV2 = Readonly<{
  screen: StitchScreenIndexEntryV2;
  sourceText: string;
}>;

type AttributeOccurrence = Readonly<{
  value?: string;
  booleanTrue: boolean;
  handlerExpression: boolean;
  expression?: ts.Expression;
}>;

type JsxElementRecord = Readonly<{
  attributes: ReadonlyMap<string, readonly AttributeOccurrence[]>;
  hasSpreadAttribute: boolean;
  tagName: string;
  line: number;
  column: number;
}>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort(compareUtf16);
}

function diagnosticSortKey(value: StitchScreenSourceDiagnosticV2): string {
  return [value.code, value.reference ?? "", value.message].join("\0");
}

function sortDiagnostics(
  values: readonly StitchScreenSourceDiagnosticV2[],
): StitchScreenSourceDiagnosticV2[] {
  return [...values].sort((left, right) =>
    compareUtf16(diagnosticSortKey(left), diagnosticSortKey(right)));
}

function diagnostic(input: Readonly<{
  code: StitchScreenSourceDiagnosticCodeV2;
  message: string;
  reference?: string;
}>): StitchScreenSourceDiagnosticV2 {
  return {
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: "source",
    severity: "error",
    message: input.message.slice(0, 2_000),
    ...(input.reference ? { reference: input.reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: [],
  };
}

function attributeOccurrence(
  initializer: ts.JsxAttribute["initializer"],
): AttributeOccurrence {
  if (!initializer) return { booleanTrue: true, handlerExpression: false };
  if (ts.isStringLiteral(initializer)) {
    return {
      value: initializer.text,
      booleanTrue: initializer.text === "true",
      handlerExpression: false,
    };
  }
  if (!ts.isJsxExpression(initializer) || !initializer.expression) {
    return { booleanTrue: false, handlerExpression: false };
  }
  if (
    ts.isStringLiteral(initializer.expression)
    || ts.isNoSubstitutionTemplateLiteral(initializer.expression)
  ) {
    return {
      value: initializer.expression.text,
      booleanTrue: initializer.expression.text === "true",
      handlerExpression: false,
      expression: initializer.expression,
    };
  }
  const expression = initializer.expression;
  const definitelyNotHandler = expression.kind === ts.SyntaxKind.NullKeyword
    || expression.kind === ts.SyntaxKind.TrueKeyword
    || expression.kind === ts.SyntaxKind.FalseKeyword
    || ts.isNumericLiteral(expression)
    || (ts.isIdentifier(expression) && expression.text === "undefined");
  return {
    booleanTrue: expression.kind === ts.SyntaxKind.TrueKeyword,
    handlerExpression: !definitelyNotHandler,
    expression,
  };
}

function collectJsxElements(root: ts.Node, sourceFile: ts.SourceFile): JsxElementRecord[] {
  const elements: JsxElementRecord[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attributes = new Map<string, AttributeOccurrence[]>();
      for (const property of node.attributes.properties) {
        if (!ts.isJsxAttribute(property)) continue;
        const name = property.name.getText(sourceFile);
        attributes.set(name, [
          ...(attributes.get(name) ?? []),
          attributeOccurrence(property.initializer),
        ]);
      }
      const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      elements.push({
        attributes,
        hasSpreadAttribute: node.attributes.properties.some(ts.isJsxSpreadAttribute),
        tagName: node.tagName.getText(sourceFile),
        line: location.line + 1,
        column: location.character + 1,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return elements;
}

function exactLiteralAttribute(
  element: JsxElementRecord,
  name: string,
): string | undefined {
  const occurrences = element.attributes.get(name) ?? [];
  if (occurrences.length !== 1) return undefined;
  return occurrences[0]!.value;
}

function exactHandlerExpression(
  element: JsxElementRecord,
  name: string,
): ts.Expression | undefined {
  const occurrences = element.attributes.get(name) ?? [];
  if (
    occurrences.length !== 1
    || !occurrences[0]!.handlerExpression
    || !occurrences[0]!.expression
  ) {
    return undefined;
  }
  return occurrences[0]!.expression;
}

function exactAttributeExpression(
  element: JsxElementRecord,
  name: string,
): ts.Expression | undefined {
  const occurrences = element.attributes.get(name) ?? [];
  return occurrences.length === 1 ? occurrences[0]!.expression : undefined;
}

function unwrapParentheses(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function exactActionDispatch(
  element: JsxElementRecord,
  handlerAttribute: string,
  generatedLocalId: string,
): boolean {
  const expression = exactHandlerExpression(element, handlerAttribute);
  if (!expression) return false;
  const directHandler = unwrapParentheses(expression);
  const dispatchKeys: string[] = [];
  let hasUnprovedAccess = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isElementAccessExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === "actions"
    ) {
      const argument = node.argumentExpression;
      const dispatches = node === directHandler
        || (ts.isCallExpression(node.parent) && node.parent.expression === node);
      if (
        argument
        && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
        && dispatches
      ) {
        dispatchKeys.push(argument.text);
      } else {
        hasUnprovedAccess = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return !hasUnprovedAccess
    && dispatchKeys.length === 1
    && dispatchKeys[0] === generatedLocalId;
}

function exactActionPayload(
  screen: StitchScreenIndexEntryV2,
  element: JsxElementRecord,
  handlerAttribute: string,
  generatedLocalId: string,
): boolean {
  const expression = exactHandlerExpression(element, handlerAttribute);
  if (!expression) return false;
  const binding = screen.componentApi.actionBindings.find((candidate) =>
    candidate.generatedLocalId === generatedLocalId);
  if (!binding) return false;
  const directHandler = unwrapParentheses(expression);
  if (
    ts.isElementAccessExpression(directHandler)
    && ts.isIdentifier(directHandler.expression)
    && directHandler.expression.text === "actions"
  ) {
    return binding.inputFields.length === 0;
  }

  const dispatchCalls: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = unwrapParentheses(node.expression);
      if (
        ts.isElementAccessExpression(callee)
        && ts.isIdentifier(callee.expression)
        && callee.expression.text === "actions"
        && callee.argumentExpression
        && (ts.isStringLiteral(callee.argumentExpression)
          || ts.isNoSubstitutionTemplateLiteral(callee.argumentExpression))
        && callee.argumentExpression.text === generatedLocalId
      ) {
        dispatchCalls.push(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  if (dispatchCalls.length !== 1) return false;
  const call = dispatchCalls[0]!;
  if (binding.inputFields.length === 0) return call.arguments.length === 0;
  if (call.arguments.length !== 1) return false;
  const payload = unwrapParentheses(call.arguments[0]!);
  if (!ts.isObjectLiteralExpression(payload)) return false;
  if (payload.properties.length !== binding.inputFields.length) return false;

  const currentValueRefs = new Set(screen.componentApi.inputTransports
    .filter((transport) => transport.generatedControlId === generatedLocalId)
    .map((transport) => transport.actionInputRef));
  return payload.properties.every((property, index) => {
    const field = binding.inputFields[index];
    if (
      !field
      || !ts.isPropertyAssignment(property)
      || !(ts.isStringLiteral(property.name)
        || ts.isNoSubstitutionTemplateLiteral(property.name))
      || property.name.text !== field
    ) {
      return false;
    }
    const actionInputRef = `${binding.actionRef}.${field}`;
    const value = unwrapParentheses(property.initializer);
    if (currentValueRefs.has(actionInputRef)) {
      return ts.isIdentifier(value) && value.text === "nextValue";
    }
    return exactStateValueExpression(value, actionInputRef);
  });
}

function exactDefaultBehavior(
  element: JsxElementRecord,
  handlerAttribute: string,
  preventsDefault: boolean,
): boolean {
  const expression = exactHandlerExpression(element, handlerAttribute);
  if (!expression) return false;
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = unwrapParentheses(node.expression);
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === "preventDefault") {
        calls.push(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  if (!preventsDefault) return calls.length === 0;
  if (
    (!ts.isArrowFunction(expression) && !ts.isFunctionExpression(expression))
    || expression.parameters.length !== 1
    || !ts.isIdentifier(expression.parameters[0]!.name)
    || calls.length !== 1
    || calls[0]!.arguments.length !== 0
  ) {
    return false;
  }
  const callee = unwrapParentheses(calls[0]!.expression);
  return ts.isPropertyAccessExpression(callee)
    && ts.isIdentifier(callee.expression)
    && callee.expression.text === expression.parameters[0]!.name.text;
}

function exactPropertyChain(expression: ts.Expression, names: readonly string[]): boolean {
  let current = unwrapParentheses(expression);
  for (let index = names.length - 1; index > 0; index -= 1) {
    if (!ts.isPropertyAccessExpression(current) || current.name.text !== names[index]) {
      return false;
    }
    current = unwrapParentheses(current.expression);
  }
  return ts.isIdentifier(current) && current.text === names[0];
}

function exactStateValueExpression(expression: ts.Expression, key: string): boolean {
  const current = unwrapParentheses(expression);
  return ts.isElementAccessExpression(current)
    && ts.isIdentifier(current.expression)
    && current.expression.text === "actionInputValues"
    && Boolean(current.argumentExpression)
    && (ts.isStringLiteral(current.argumentExpression!)
      || ts.isNoSubstitutionTemplateLiteral(current.argumentExpression!))
    && current.argumentExpression!.text === key;
}

function exactInputTransport(
  element: JsxElementRecord,
  expectedPairs: readonly string[],
): boolean {
  if (expectedPairs.length === 0) return false;
  const handler = exactHandlerExpression(element, "onChange");
  if (!handler || (!ts.isArrowFunction(handler) && !ts.isFunctionExpression(handler))) return false;
  if (!ts.isBlock(handler.body) || handler.parameters.length !== 1) return false;
  const eventParameter = handler.parameters[0]!.name;
  if (!ts.isIdentifier(eventParameter)) return false;

  const nextValueDeclarations = handler.body.statements.flatMap((statement) => {
    if (!ts.isVariableStatement(statement)) return [];
    return statement.declarationList.declarations.filter((declaration) =>
      ts.isIdentifier(declaration.name)
      && declaration.name.text === "nextValue"
      && declaration.initializer
      && exactPropertyChain(
        declaration.initializer,
        [eventParameter.text, "currentTarget", "value"],
      ));
  });
  if (nextValueDeclarations.length !== 1) return false;

  const setterCalls = handler.body.statements.flatMap((statement) => {
    if (!ts.isExpressionStatement(statement)) return [];
    const expression = unwrapParentheses(statement.expression);
    return ts.isCallExpression(expression)
      && ts.isIdentifier(expression.expression)
      && expression.expression.text === "setActionInputValues"
      ? [expression]
      : [];
  });
  if (setterCalls.length !== 1 || setterCalls[0]!.arguments.length !== 1) return false;
  const setter = unwrapParentheses(setterCalls[0]!.arguments[0]!);
  if (!ts.isArrowFunction(setter) && !ts.isFunctionExpression(setter)) return false;
  if (setter.parameters.length !== 1 || !ts.isIdentifier(setter.parameters[0]!.name)) return false;
  const currentName = setter.parameters[0]!.name.text;
  let returned = setter.body;
  if (ts.isBlock(returned)) {
    const returns = returned.statements.filter(ts.isReturnStatement);
    if (returns.length !== 1 || !returns[0]!.expression) return false;
    returned = returns[0]!.expression;
  }
  const returnedExpression = unwrapParentheses(returned);
  if (!ts.isObjectLiteralExpression(returnedExpression)) return false;
  const spreads = returnedExpression.properties.filter(ts.isSpreadAssignment);
  if (
    spreads.length !== 1
    || !ts.isIdentifier(spreads[0]!.expression)
    || spreads[0]!.expression.text !== currentName
  ) {
    return false;
  }
  const transportedKeys: string[] = [];
  for (const property of returnedExpression.properties) {
    if (ts.isSpreadAssignment(property)) continue;
    if (
      !ts.isPropertyAssignment(property)
      || !ts.isStringLiteral(property.name)
      || !ts.isIdentifier(property.initializer)
      || property.initializer.text !== "nextValue"
    ) {
      return false;
    }
    transportedKeys.push(property.name.text);
  }
  if (!sameSortedValues(transportedKeys, expectedPairs)) return false;

  if (element.tagName === "input" && exactLiteralAttribute(element, "type") === "file") {
    return true;
  }
  const firstKey = [...expectedPairs].sort(compareUtf16)[0]!;
  const valueExpression = exactAttributeExpression(element, "value");
  return Boolean(valueExpression && exactStateValueExpression(valueExpression, firstKey));
}

function hasTrueAttribute(element: JsxElementRecord, name: string): boolean {
  const occurrences = element.attributes.get(name) ?? [];
  return occurrences.length === 1 && occurrences[0]!.booleanTrue;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node)
    && Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === kind));
}

function exactDeclaredComponentNames(statement: ts.Statement): string[] {
  if (ts.isFunctionDeclaration(statement)) {
    return statement.name ? [statement.name.text] : [];
  }
  if (!ts.isVariableStatement(statement)) return [];
  return statement.declarationList.declarations.flatMap((declaration) =>
    ts.isIdentifier(declaration.name) ? [declaration.name.text] : []);
}

function exactNamedExports(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (
      hasModifier(statement, ts.SyntaxKind.ExportKeyword)
      && !hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
    ) {
      for (const name of exactDeclaredComponentNames(statement)) names.add(name);
    }
    if (
      ts.isExportDeclaration(statement)
      && !statement.moduleSpecifier
      && statement.exportClause
      && ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        if (!element.propertyName || element.propertyName.text === element.name.text) {
          names.add(element.name.text);
        }
      }
    }
  }
  return names;
}

function resolveExactNamedComponent(
  sourceFile: ts.SourceFile,
  componentName: string,
): ts.FunctionLikeDeclaration | undefined {
  if (!exactNamedExports(sourceFile).has(componentName)) return undefined;
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === componentName) {
      return statement;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== componentName) continue;
      if (
        declaration.initializer
        && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
      ) {
        return declaration.initializer;
      }
    }
  }
  return undefined;
}

function expectedTagForKind(kind: StitchScreenIndexEntryV2["controls"][number]["kind"]): string {
  if (kind === "link") return "a";
  return kind;
}

function validateControlTag(
  control: StitchScreenIndexEntryV2["controls"][number],
  element: JsxElementRecord,
  diagnostics: StitchScreenSourceDiagnosticV2[],
): void {
  if (control.semanticSource === "data-action") {
    const expectedNativeTag = control.nativeControlKind === null
      ? control.tagName
      : expectedTagForKind(control.nativeControlKind);
    const exactKind = control.nativeControlKind === null
      ? control.kind === (control.role === "link" ? "link" : "button")
      : control.kind === control.nativeControlKind;
    if (
      element.tagName !== control.tagName
      || control.tagName !== expectedNativeTag
      || !exactKind
    ) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_CONTROL_TAG_MISMATCH",
        message: `Physical control ${control.generatedLocalId} must preserve rendered tag ${control.tagName}; observed ${element.tagName}`,
        reference: control.generatedLocalId,
      }));
    }
    const expectedRole = control.role ?? undefined;
    const expectedAriaLabel = control.ariaLabel ?? undefined;
    if (
      exactLiteralAttribute(element, "role") !== expectedRole
      || exactLiteralAttribute(element, "aria-label") !== expectedAriaLabel
      || (control.nativeControlKind === null && !control.interactiveRole)
    ) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_CONTROL_ACCESSIBILITY_MISMATCH",
        message: `Physical control ${control.generatedLocalId} does not preserve exact literal role/aria-label interaction authority`,
        reference: control.generatedLocalId,
      }));
    }
    if (exactLiteralAttribute(element, "href") !== (control.href ?? undefined)) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_CONTROL_HREF_MISMATCH",
        message: `Physical control ${control.generatedLocalId} does not preserve exact rendered href authority`,
        reference: control.generatedLocalId,
      }));
    }
    return;
  }
  const expectedTag = expectedTagForKind(control.kind);
  if (element.tagName !== expectedTag) {
    diagnostics.push(diagnostic({
      code: "STITCH_SCREEN_CONTROL_TAG_MISMATCH",
      message: `Input control ${control.generatedLocalId} kind ${control.kind} requires exact JSX tag ${expectedTag}; observed ${element.tagName}`,
      reference: control.generatedLocalId,
    }));
  }
}

function matchingElements(
  elements: readonly JsxElementRecord[],
  attribute: string,
  value: string,
): JsxElementRecord[] {
  return elements.filter((element) => exactLiteralAttribute(element, attribute) === value);
}

function separatedTokens(value: string, punctuationSeparators: boolean): string[] {
  const tokens: string[] = [];
  let current = "";
  const flush = (): void => {
    if (current.length > 0) tokens.push(current);
    current = "";
  };
  for (const character of value) {
    const separator = (punctuationSeparators && (character === "," || character === ";"))
      || character === " "
      || character === "\t"
      || character === "\n"
      || character === "\r"
      || character === "\f";
    if (separator) flush();
    else current += character;
  }
  flush();
  return tokens;
}

function actionInputTokens(value: string): string[] {
  return separatedTokens(value, true);
}

function observableRefTokens(value: string): string[] {
  return separatedTokens(value, false);
}

function sameSortedValues(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const first = [...left].sort(compareUtf16);
  const second = [...right].sort(compareUtf16);
  return first.every((value, index) => value === second[index]);
}

function sourceLocation(element: JsxElementRecord): string {
  return `${element.line}:${element.column}`;
}

function validateLiteralIdentityAttributes(
  elements: readonly JsxElementRecord[],
  diagnostics: StitchScreenSourceDiagnosticV2[],
): void {
  for (const element of elements) {
    for (const attribute of ["data-action-id", "data-control-id"] as const) {
      const occurrences = element.attributes.get(attribute) ?? [];
      if (
        occurrences.length > 0
        && (occurrences.length !== 1 || occurrences[0]!.value === undefined)
      ) {
        diagnostics.push(diagnostic({
          code: "STITCH_SCREEN_IDENTITY_ATTRIBUTE_NON_LITERAL",
          message: `${attribute} at ${sourceLocation(element)} must occur once with one static string literal`,
          reference: `${attribute}@${sourceLocation(element)}`,
        }));
      }
    }
  }
}

function validatePhysicalControls(
  screen: StitchScreenIndexEntryV2,
  elements: readonly JsxElementRecord[],
  diagnostics: StitchScreenSourceDiagnosticV2[],
): void {
  for (const control of screen.controls) {
    if (control.semanticSource !== "data-action") continue;
    const matches = matchingElements(
      elements,
      "data-action-id",
      control.generatedLocalId,
    );
    if (matches.length === 0) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_ACTION_CONTROL_MISSING",
        message: `Indexed action control ${control.generatedLocalId} has no exact literal data-action-id element`,
        reference: control.generatedLocalId,
      }));
      continue;
    }
    if (matches.length > 1) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_ACTION_CONTROL_AMBIGUOUS",
        message: `Indexed action control ${control.generatedLocalId} resolves to ${matches.length} data-action-id elements`,
        reference: control.generatedLocalId,
      }));
      continue;
    }
    const element = matches[0]!;
    validateControlTag(control, element, diagnostics);
    if (exactLiteralAttribute(element, "data-action") !== control.actionRef) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_ACTION_BINDING_MISMATCH",
        message: `Action control ${control.generatedLocalId} does not preserve literal data-action=${control.actionRef} on the same element`,
        reference: control.generatedLocalId,
      }));
    }
    if (exactLiteralAttribute(element, "data-control-slot") !== control.controlSlotRef) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_CONTROL_SLOT_MISMATCH",
        message: `Action control ${control.generatedLocalId} does not preserve literal data-control-slot=${control.controlSlotRef} on the same element`,
        reference: control.generatedLocalId,
      }));
    }
    if (exactLiteralAttribute(element, "data-setfarm-element-ref") !== control.sourceElementRef) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_ACTION_SOURCE_ELEMENT_REF_MISMATCH",
        message: `Action control ${control.generatedLocalId} does not preserve source element ${control.sourceElementRef} on the same element`,
        reference: control.generatedLocalId,
      }));
    }
    const handler = control.kind === "button" || control.kind === "link"
      ? "onClick"
      : "onChange";
    const dispatchValid = exactActionDispatch(element, handler, control.generatedLocalId);
    if (!dispatchValid) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_ACTION_DISPATCH_MISMATCH",
        message: `Action control ${control.generatedLocalId} ${handler} must contain exactly one literal actions[${JSON.stringify(control.generatedLocalId)}] dispatch and no other action key`,
        reference: control.generatedLocalId,
      }));
    } else if (!exactActionPayload(
      screen,
      element,
      handler,
      control.generatedLocalId,
    )) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_ACTION_PAYLOAD_MISMATCH",
        message: `Action control ${control.generatedLocalId} must dispatch the exact generated component API payload`,
        reference: control.generatedLocalId,
      }));
    }
    if (!exactDefaultBehavior(element, handler, control.tagName === "a")) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_ACTION_DEFAULT_BEHAVIOR_MISMATCH",
        message: `Action control ${control.generatedLocalId} must preserve exact link default-prevention behavior`,
        reference: control.generatedLocalId,
      }));
    }
    const inputBindings = control.inputBindings ?? [];
    if (inputBindings.length > 0) {
      const expectedPairs = inputBindings.map((binding) =>
        `${binding.actionRef}.${binding.inputField}`);
      const actualPairs = actionInputTokens(
        exactLiteralAttribute(element, "data-action-input") ?? "",
      );
      if (!sameSortedValues(actualPairs, expectedPairs)) {
        diagnostics.push(diagnostic({
          code: "STITCH_SCREEN_INPUT_BINDINGS_MISMATCH",
          message: `Physical input action ${control.generatedLocalId} does not preserve its exact data-action-input pair set`,
          reference: control.generatedLocalId,
        }));
      }
      if (
        ["input", "textarea", "select"].includes(control.kind)
        && !exactInputTransport(element, expectedPairs)
      ) {
        diagnostics.push(diagnostic({
          code: "STITCH_SCREEN_INPUT_TRANSPORT_MISMATCH",
          message: `Physical input action ${control.generatedLocalId} does not transport its exact indexed input keys`,
          reference: control.generatedLocalId,
        }));
      }
    }
  }
}

function validateInputControls(
  screen: StitchScreenIndexEntryV2,
  elements: readonly JsxElementRecord[],
  diagnostics: StitchScreenSourceDiagnosticV2[],
): void {
  for (const control of screen.controls) {
    if (control.semanticSource !== "data-action-input") continue;
    const matches = matchingElements(
      elements,
      "data-control-id",
      control.generatedLocalId,
    );
    if (matches.length === 0) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_INPUT_CONTROL_MISSING",
        message: `Indexed input control ${control.generatedLocalId} has no exact literal data-control-id element`,
        reference: control.generatedLocalId,
      }));
      continue;
    }
    if (matches.length > 1) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_INPUT_CONTROL_AMBIGUOUS",
        message: `Indexed input control ${control.generatedLocalId} resolves to ${matches.length} data-control-id elements`,
        reference: control.generatedLocalId,
      }));
      continue;
    }
    const element = matches[0]!;
    validateControlTag(control, element, diagnostics);
    const expectedPairs = control.inputBindings.map((binding) =>
      `${binding.actionRef}.${binding.inputField}`);
    const actualPairs = actionInputTokens(
      exactLiteralAttribute(element, "data-action-input") ?? "",
    );
    if (!sameSortedValues(actualPairs, expectedPairs)) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_INPUT_BINDINGS_MISMATCH",
        message: `Input control ${control.generatedLocalId} does not preserve its exact literal data-action-input pair set`,
        reference: control.generatedLocalId,
      }));
    }
    if (exactLiteralAttribute(element, "data-setfarm-element-ref") !== control.sourceElementRef) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_INPUT_SOURCE_ELEMENT_REF_MISMATCH",
        message: `Input control ${control.generatedLocalId} does not preserve source element ${control.sourceElementRef} on the same element`,
        reference: control.generatedLocalId,
      }));
    }
    if (!exactInputTransport(element, expectedPairs)) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_INPUT_TRANSPORT_MISMATCH",
        message: `Input control ${control.generatedLocalId} must transport exactly its indexed action-input keys through compiler-owned value/onChange state wiring`,
        reference: control.generatedLocalId,
      }));
    }
  }
}

function validateObservables(
  screen: StitchScreenIndexEntryV2,
  elements: readonly JsxElementRecord[],
  diagnostics: StitchScreenSourceDiagnosticV2[],
): void {
  for (const observable of screen.observables) {
    const matches = elements.filter((element) => {
      const refs = exactLiteralAttribute(element, "data-observable-refs");
      return refs !== undefined && observableRefTokens(refs).includes(observable.observableRef);
    });
    if (matches.length === 0) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_OBSERVABLE_MISSING",
        message: `Indexed observable ${observable.observableRef} has no exact literal data-observable-refs element`,
        reference: observable.observableRef,
      }));
      continue;
    }
    if (matches.length > 1) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_OBSERVABLE_AMBIGUOUS",
        message: `Indexed observable ${observable.observableRef} resolves to ${matches.length} data-observable-refs elements`,
        reference: observable.observableRef,
      }));
      continue;
    }
    if (
      exactLiteralAttribute(matches[0]!, "data-setfarm-element-ref")
      !== observable.sourceElementRef
    ) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_OBSERVABLE_SOURCE_ELEMENT_REF_MISMATCH",
        message: `Observable ${observable.observableRef} does not preserve source element ${observable.sourceElementRef} on the same element`,
        reference: observable.observableRef,
      }));
    }
    const element = matches[0]!;
    if (
      observable.selectorKind === "accessibility"
      && (
        exactLiteralAttribute(element, "role") !== observable.role
        || exactLiteralAttribute(element, "aria-label") !== observable.name
      )
    ) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_OBSERVABLE_ACCESSIBILITY_MISMATCH",
        message: `Accessibility observable ${observable.observableRef} does not preserve exact literal role/name authority`,
        reference: observable.observableRef,
      }));
    }
    if (
      observable.selectorKind === "control"
      && exactLiteralAttribute(element, "data-control-slot") !== observable.controlSlotRef
    ) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_OBSERVABLE_CONTROL_SLOT_MISMATCH",
        message: `Control observable ${observable.observableRef} does not preserve data-control-slot=${observable.controlSlotRef}`,
        reference: observable.observableRef,
      }));
    }
    if (
      observable.selectorKind === "surface"
      && exactLiteralAttribute(element, "data-surface-id") !== observable.surfaceRef
    ) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_OBSERVABLE_SURFACE_MISMATCH",
        message: `Surface observable ${observable.observableRef} does not preserve data-surface-id=${observable.surfaceRef}`,
        reference: observable.observableRef,
      }));
    }
  }
}

function validateNoExtraLocalIds(
  screen: StitchScreenIndexEntryV2,
  elements: readonly JsxElementRecord[],
  diagnostics: StitchScreenSourceDiagnosticV2[],
): void {
  const expectedActionIds = new Set(screen.controls
    .filter((control) => control.semanticSource === "data-action")
    .map((control) => control.generatedLocalId));
  const expectedInputIds = new Set(screen.controls
    .filter((control) => control.semanticSource === "data-action-input")
    .map((control) => control.generatedLocalId));
  const actionIds = uniqueSorted(elements.flatMap((element) => {
    const value = exactLiteralAttribute(element, "data-action-id");
    return value === undefined ? [] : [value];
  }));
  const inputIds = uniqueSorted(elements.flatMap((element) => {
    const value = exactLiteralAttribute(element, "data-control-id");
    return value === undefined ? [] : [value];
  }));
  for (const actionId of actionIds) {
    if (expectedActionIds.has(actionId)) continue;
    diagnostics.push(diagnostic({
      code: "STITCH_SCREEN_EXTRA_ACTION_CONTROL_ID",
      message: `Generated source contains unindexed local action control ID ${actionId}`,
      reference: actionId,
    }));
  }
  for (const inputId of inputIds) {
    if (expectedInputIds.has(inputId)) continue;
    diagnostics.push(diagnostic({
      code: "STITCH_SCREEN_EXTRA_INPUT_CONTROL_ID",
      message: `Generated source contains unindexed local input control ID ${inputId}`,
      reference: inputId,
    }));
  }
}

type RejectedControlContractV2 = Readonly<{
  rejectionId: string;
  kind: StitchScreenIndexEntryV2["controls"][number]["kind"];
  sourceElementRef: string;
}>;

const CONTROL_KINDS = new Set(["button", "link", "input", "textarea", "select"]);

function rejectedControlContracts(
  screen: StitchScreenIndexEntryV2,
  diagnostics: StitchScreenSourceDiagnosticV2[],
): RejectedControlContractV2[] {
  const contracts: RejectedControlContractV2[] = [];
  const seenIds = new Set<string>();
  screen.rejectedControls.forEach((candidate, index) => {
    const record = candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? candidate as Record<string, unknown>
      : undefined;
    const rejectionId = record?.rejectionId;
    const kind = record?.kind;
    const sourceElementRef = record?.sourceElementRef;
    const valid = typeof rejectionId === "string"
      && rejectionId.length > 0
      && typeof kind === "string"
      && CONTROL_KINDS.has(kind)
      && typeof sourceElementRef === "string"
      && sourceElementRef.length > 0
      && !seenIds.has(rejectionId);
    if (!valid) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_REJECTED_CONTROL_CONTRACT_INVALID",
        message: `SCREEN_INDEX rejectedControls[${index}] lacks one unique rejectionId, supported kind, or exact sourceElementRef`,
        reference: `rejectedControls[${index}]`,
      }));
      return;
    }
    const exactRejectionId = rejectionId as string;
    seenIds.add(exactRejectionId);
    contracts.push({
      rejectionId: exactRejectionId,
      kind: kind as RejectedControlContractV2["kind"],
      sourceElementRef: sourceElementRef as string,
    });
  });
  return contracts;
}

function validateRejectedControls(
  contracts: readonly RejectedControlContractV2[],
  elements: readonly JsxElementRecord[],
  diagnostics: StitchScreenSourceDiagnosticV2[],
): void {
  const expectedIds = new Set(contracts.map((item) => item.rejectionId));
  for (const contract of contracts) {
    const matches = matchingElements(
      elements,
      "data-setfarm-rejected-control",
      contract.rejectionId,
    );
    if (matches.length === 0) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_REJECTED_CONTROL_MISSING",
        message: `Rejected control ${contract.rejectionId} has no exact source marker`,
        reference: contract.rejectionId,
      }));
      continue;
    }
    if (matches.length > 1) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_REJECTED_CONTROL_AMBIGUOUS",
        message: `Rejected control ${contract.rejectionId} resolves to ${matches.length} source markers`,
        reference: contract.rejectionId,
      }));
      continue;
    }
    const element = matches[0]!;
    const forbiddenSemanticAttribute = [
      "data-action-id",
      "data-control-id",
      "data-action",
      "data-action-input",
      "onClick",
      "onChange",
      "onInput",
      "onSubmit",
    ].some((attribute) => element.attributes.has(attribute));
    const expectedTag = expectedTagForKind(contract.kind);
    const exactSourceElement =
      exactLiteralAttribute(element, "data-setfarm-element-ref") === contract.sourceElementRef;
    const neutralized = hasTrueAttribute(element, "hidden")
      && hasTrueAttribute(element, "aria-hidden")
      && !forbiddenSemanticAttribute
      && exactSourceElement
      && element.tagName === expectedTag
      && (contract.kind === "link"
        ? !element.attributes.has("href")
        : hasTrueAttribute(element, "disabled"));
    if (!neutralized) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_REJECTED_CONTROL_ACTIVE",
        message: `Rejected control ${contract.rejectionId} is not exact-tagged, hidden, aria-hidden, source-bound, and disabled or link-neutralized`,
        reference: contract.rejectionId,
      }));
    }
  }
  const sourceMarkerIds = uniqueSorted(elements.flatMap((element) => {
    const marker = exactLiteralAttribute(element, "data-setfarm-rejected-control");
    return marker === undefined ? [] : [marker];
  }));
  for (const marker of sourceMarkerIds) {
    if (expectedIds.has(marker)) continue;
    diagnostics.push(diagnostic({
      code: "STITCH_SCREEN_EXTRA_REJECTED_CONTROL_ID",
      message: `Generated source contains unindexed rejected-control marker ${marker}`,
      reference: marker,
    }));
  }
  for (const element of elements) {
    const occurrences = element.attributes.get("data-setfarm-rejected-control") ?? [];
    if (occurrences.length === 0 || (occurrences.length === 1 && occurrences[0]!.value !== undefined)) {
      continue;
    }
    diagnostics.push(diagnostic({
      code: "STITCH_SCREEN_REJECTED_CONTROL_ACTIVE",
      message: `Rejected-control marker at ${sourceLocation(element)} must be one exact literal identity`,
      reference: `data-setfarm-rejected-control@${sourceLocation(element)}`,
    }));
  }
}

const STATIC_INTERACTIVE_TAGS = new Set(["a", "button", "input", "select", "textarea"]);
const STATIC_INTERACTIVE_ROLES = new Set([
  "button",
  "checkbox",
  "combobox",
  "link",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
  "treeitem",
]);

function isStaticallyInteractive(element: JsxElementRecord): boolean {
  if (STATIC_INTERACTIVE_TAGS.has(element.tagName)) return true;
  const role = exactLiteralAttribute(element, "role");
  if (role !== undefined && STATIC_INTERACTIVE_ROLES.has(role)) return true;
  return ["onClick", "onChange", "onInput", "onSubmit"]
    .some((attribute) => element.attributes.has(attribute));
}

function validateInteractiveCompletenessAndSpreads(
  screen: StitchScreenIndexEntryV2,
  rejectedControls: readonly RejectedControlContractV2[],
  elements: readonly JsxElementRecord[],
  diagnostics: StitchScreenSourceDiagnosticV2[],
): void {
  const expectedActionIds = new Set(screen.controls
    .filter((control) => control.semanticSource === "data-action")
    .map((control) => control.generatedLocalId));
  const expectedInputIds = new Set(screen.controls
    .filter((control) => control.semanticSource === "data-action-input")
    .map((control) => control.generatedLocalId));
  const expectedObservableRefs = new Set(screen.observables.map((item) => item.observableRef));
  const expectedRejectedIds = new Set(rejectedControls.map((item) => item.rejectionId));
  for (const element of elements) {
    const actionId = exactLiteralAttribute(element, "data-action-id");
    const inputId = exactLiteralAttribute(element, "data-control-id");
    const observableRefs = observableRefTokens(
      exactLiteralAttribute(element, "data-observable-refs") ?? "",
    );
    const indexed = (actionId !== undefined && expectedActionIds.has(actionId))
      || (inputId !== undefined && expectedInputIds.has(inputId));
    const rejectedId = exactLiteralAttribute(element, "data-setfarm-rejected-control");
    const indexedRejected = rejectedId !== undefined && expectedRejectedIds.has(rejectedId);
    const contractMarked = indexed
      || indexedRejected
      || observableRefs.some((item) => expectedObservableRefs.has(item))
      || [
        "data-action",
        "data-action-input",
        "data-control-slot",
        "data-setfarm-element-ref",
      ].some((attribute) => element.attributes.has(attribute));
    if (
      isStaticallyInteractive(element)
      && actionId === undefined
      && inputId === undefined
      && !indexedRejected
    ) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_INTERACTIVE_ELEMENT_UNINDEXED",
        message: `Interactive JSX element ${element.tagName} at ${sourceLocation(element)} lacks an exact indexed local action/control ID`,
        reference: `${element.tagName}@${sourceLocation(element)}`,
      }));
    }
    if (element.hasSpreadAttribute && (contractMarked || isStaticallyInteractive(element))) {
      diagnostics.push(diagnostic({
        code: "STITCH_SCREEN_CONTRACT_ELEMENT_SPREAD_FORBIDDEN",
        message: `Contract JSX element ${element.tagName} at ${sourceLocation(element)} contains an unprovable spread attribute`,
        reference: `${element.tagName}@${sourceLocation(element)}`,
      }));
    }
  }
}

function validateComponentExport(
  screen: StitchScreenIndexEntryV2,
  sourceFile: ts.SourceFile,
  diagnostics: StitchScreenSourceDiagnosticV2[],
): ts.FunctionLikeDeclaration | undefined {
  const component = resolveExactNamedComponent(sourceFile, screen.componentName);
  if (component) return component;
  diagnostics.push(diagnostic({
    code: "STITCH_SCREEN_COMPONENT_EXPORT_MISSING",
    message: `Generated source must declare and named-export component ${screen.componentName}`,
    reference: screen.componentName,
  }));
  return undefined;
}

function syntaxDiagnostics(input: StitchScreenSourceValidationInputV2): StitchScreenSourceDiagnosticV2[] {
  const sourceFile = ts.createSourceFile(
    input.screen.file,
    input.sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const transpiled = ts.transpileModule(input.sourceText, {
    fileName: input.screen.file,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });
  return (transpiled.diagnostics ?? [])
    .filter((item) => item.category === ts.DiagnosticCategory.Error)
    .map((item) => {
      const location = item.start === undefined
        ? undefined
        : sourceFile.getLineAndCharacterOfPosition(item.start);
      return diagnostic({
        code: "STITCH_SCREEN_SOURCE_TSX_INVALID",
        message: `Generated TSX is invalid: ${ts.flattenDiagnosticMessageText(item.messageText, " ")}`,
        reference: location
          ? `${input.screen.file}:${location.line + 1}:${location.character + 1}`
          : input.screen.file,
      });
    });
}

/**
 * Proves that one native v2 SCREEN_INDEX entry and its exact generated TSX
 * preserve the same physical identities. This validator performs no I/O and
 * never infers semantic bindings from labels, handlers, or source text regexes.
 */
export function validateStitchScreenSourceV2(
  input: StitchScreenSourceValidationInputV2,
): StitchScreenSourceValidationResultV2 {
  const parseDiagnostics = syntaxDiagnostics(input);
  if (parseDiagnostics.length > 0) {
    const diagnostics = sortDiagnostics(parseDiagnostics);
    return {
      status: "invalid",
      rejectionCodes: uniqueSorted(diagnostics.map((item) => item.code)),
      diagnostics,
    };
  }

  const sourceFile = ts.createSourceFile(
    input.screen.file,
    input.sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const diagnostics: StitchScreenSourceDiagnosticV2[] = [];
  const component = validateComponentExport(input.screen, sourceFile, diagnostics);
  const elements = collectJsxElements(component ?? sourceFile, sourceFile);
  const rejectedControls = rejectedControlContracts(input.screen, diagnostics);
  validateLiteralIdentityAttributes(elements, diagnostics);
  validatePhysicalControls(input.screen, elements, diagnostics);
  validateInputControls(input.screen, elements, diagnostics);
  validateObservables(input.screen, elements, diagnostics);
  validateNoExtraLocalIds(input.screen, elements, diagnostics);
  validateRejectedControls(rejectedControls, elements, diagnostics);
  validateInteractiveCompletenessAndSpreads(
    input.screen,
    rejectedControls,
    elements,
    diagnostics,
  );
  if (diagnostics.length === 0) return { status: "valid", diagnostics: [] };
  const sorted = sortDiagnostics(diagnostics);
  return {
    status: "invalid",
    rejectionCodes: uniqueSorted(sorted.map((item) => item.code)),
    diagnostics: sorted,
  };
}
