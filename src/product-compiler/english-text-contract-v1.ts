export const ENGLISH_TEXT_MAX_CODE_UNITS_V1 = 200_000;
export const ENGLISH_TEXT_TREE_MAX_CODE_UNITS_V1 = 2_000_000;
export const ENGLISH_TEXT_TREE_MAX_VALUES_V1 = 250_000;
export const ENGLISH_TEXT_TREE_MAX_ISSUES_V1 = 100;
export const ENGLISH_TEXT_TREE_MAX_DEPTH_V1 = 256;

export type EnglishTextContractViolationCodeV1 =
  | "ENGLISH_TEXT_NON_ASCII"
  | "ENGLISH_TEXT_UNSUPPORTED_LEXEME"
  | "ENGLISH_TEXT_CONTROL_CHARACTER"
  | "ENGLISH_TEXT_OBJECT_PROPERTY_INVALID"
  | "ENGLISH_TEXT_OBJECT_PROTOTYPE_INVALID"
  | "ENGLISH_TEXT_OBJECT_REFERENCE_REUSED"
  | "ENGLISH_TEXT_TREE_DEPTH_EXCEEDED"
  | "ENGLISH_TEXT_VALUE_LIMIT_EXCEEDED"
  | "ENGLISH_TEXT_TREE_LIMIT_EXCEEDED";

export type EnglishTextContractViolationV1 = Readonly<{
  code: EnglishTextContractViolationCodeV1;
  path: readonly (string | number)[];
  codeUnitIndex?: number;
  codeUnit?: number;
}>;

export const ENGLISH_TEXT_ARRAY_INDEX_V1 = Symbol("english_text_array_index_v1");
export const ENGLISH_TEXT_DESCENDANT_V1 = Symbol("english_text_descendant_v1");

export type EnglishTextPathPatternSegmentV1 =
  | string
  | number
  | symbol;

export type EnglishTextPathPatternV1 = readonly EnglishTextPathPatternSegmentV1[];

export type EnglishTextTreeOptionsV1 = Readonly<{
  maxCodeUnitsPerValue?: number;
  maxTotalCodeUnits?: number;
  maxVisitedValues?: number;
  maxIssues?: number;
  maxDepth?: number;
  lexicalPathPatterns?: readonly EnglishTextPathPatternV1[];
  opaquePathPatterns?: readonly EnglishTextPathPatternV1[];
}>;

type EnglishTextPathNodeV1 = Readonly<{
  parent: EnglishTextPathNodeV1 | undefined;
  segment: string | number;
  depth: number;
}>;

type EnglishTextPendingValueV1 = Readonly<{
  value: unknown;
  path: EnglishTextPathNodeV1 | undefined;
  role: "key" | "value";
}>;

const ENGLISH_TEXT_TREE_MAX_PATH_PATTERNS_V1 = 1_024;
const ENGLISH_TEXT_TREE_MAX_PATTERN_SEGMENTS_V1 = 64;

function boundedLimitV1(requested: number | undefined, maximum: number): number {
  if (requested === undefined) return maximum;
  if (!Number.isSafeInteger(requested) || requested < 1) return 1;
  return Math.min(requested, maximum);
}

function decodeAsciiHexV1(value: string): string {
  let decoded = "";
  for (let index = 0; index < value.length; index += 2) {
    decoded += String.fromCharCode(Number.parseInt(value.slice(index, index + 2), 16));
  }
  return decoded;
}

// These hashes-as-bytes are high-signal localized UI lexemes, not a
// probabilistic language classifier. Keeping the catalog encoded prevents the
// English-only source tree from embedding the rejected content itself.
const UNSUPPORTED_LOCALIZED_LEXEMES_V1 = new Set([
  "67756172646172", "63616d62696f73", "6d6f7374726172", "6d656e73616a6573",
  "636f6e66696775726163696f6e", "656c696d696e6172", "7573756172696f73",
  "656469746172", "6372656172", "676f7265766c657269", "6b6179646574",
  "6b756c6c616e6963696c617269", "6c697374656c65", "676f73746572",
  "6d6573616a6c617269", "6f6c7573747572", "64757a656e6c65",
  "656e726567697374726572", "706172616d6574726573", "7375707072696d6572",
  "7574696c6973617465757273", "73706569636865726e",
  "65696e7374656c6c756e67656e", "61626272656368656e", "62656e75747a6572",
  "73616c76617265", "6d6f64696669636865", "696d706f7374617a696f6e69",
  "656c696d696e617265", "73616c766172", "616c74657261636f6573",
  "636f6e666967757261636f6573", "6578636c756972", "6f70736c61616e",
  "696e7374656c6c696e67656e", "76657277696a646572656e",
  "6765627275696b657273", "73696d70616e", "70657275626168616e",
  "70656e6761747572616e", "70656e6767756e61",
].map(decodeAsciiHexV1));

const ASCII_LEXEME_PATTERN_V1 = /[A-Z]+(?=[A-Z][a-z]|[^A-Za-z]|$)|[A-Z]?[a-z]+/g;
const ALLOWED_ENGLISH_TYPOGRAPHY_V1 = new Set([
  0x2013,
  0x2014,
  0x2018,
  0x2019,
  0x201c,
  0x201d,
  0x2026,
]);

function containsUnsupportedLocalizedLexemeV1(value: string): boolean {
  for (const match of value.matchAll(ASCII_LEXEME_PATTERN_V1)) {
    if (UNSUPPORTED_LOCALIZED_LEXEMES_V1.has(match[0].toLowerCase())) return true;
  }
  return false;
}

function pathMatchesPatternV1(
  path: EnglishTextPathNodeV1 | undefined,
  pattern: EnglishTextPathPatternV1,
): boolean {
  const descendant = pattern.at(-1) === ENGLISH_TEXT_DESCENDANT_V1;
  const exactLength = descendant ? pattern.length - 1 : pattern.length;
  if (!path || path.depth < exactLength || (!descendant && path.depth !== exactLength)) return false;
  let cursor: EnglishTextPathNodeV1 | undefined = path;
  for (let skipped = path.depth - exactLength; skipped > 0; skipped -= 1) {
    cursor = cursor?.parent;
  }
  for (let patternIndex = exactLength - 1; patternIndex >= 0; patternIndex -= 1) {
    if (!cursor) return false;
    const expected = pattern[patternIndex];
    const actual = cursor.segment;
    if (expected === ENGLISH_TEXT_ARRAY_INDEX_V1) {
      if (typeof actual !== "number") return false;
    } else if (actual !== expected) {
      return false;
    }
    cursor = cursor.parent;
  }
  return true;
}

function materializePathV1(
  path: EnglishTextPathNodeV1 | undefined,
): readonly (string | number)[] {
  if (!path) return Object.freeze([]);
  const segments = new Array<string | number>(path.depth);
  let cursor: EnglishTextPathNodeV1 | undefined = path;
  for (let index = path.depth - 1; index >= 0; index -= 1) {
    segments[index] = cursor!.segment;
    cursor = cursor!.parent;
  }
  return Object.freeze(segments);
}

function childPathV1(
  parent: EnglishTextPathNodeV1 | undefined,
  segment: string | number,
): EnglishTextPathNodeV1 {
  return Object.freeze({ parent, segment, depth: (parent?.depth ?? 0) + 1 });
}

function inspectString(
  value: string,
  path: readonly (string | number)[],
  maxCodeUnits: number,
  lexicalAdmission: boolean,
): EnglishTextContractViolationV1 | undefined {
  if (value.length > maxCodeUnits) {
    return Object.freeze({
      code: "ENGLISH_TEXT_VALUE_LIMIT_EXCEEDED",
      path: Object.freeze([...path]),
      codeUnitIndex: maxCodeUnits,
    });
  }
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0x09 || codeUnit === 0x0a || codeUnit === 0x0d) continue;
    if (codeUnit >= 0x20 && codeUnit <= 0x7e) continue;
    if (ALLOWED_ENGLISH_TYPOGRAPHY_V1.has(codeUnit)) continue;
    return Object.freeze({
      code: codeUnit < 0x20 || codeUnit === 0x7f
        ? "ENGLISH_TEXT_CONTROL_CHARACTER"
        : "ENGLISH_TEXT_NON_ASCII",
      path: Object.freeze([...path]),
      codeUnitIndex: index,
      codeUnit,
    });
  }
  if (lexicalAdmission && containsUnsupportedLocalizedLexemeV1(value)) {
    return Object.freeze({
      code: "ENGLISH_TEXT_UNSUPPORTED_LEXEME",
      path: Object.freeze([...path]),
    });
  }
  return undefined;
}

export function inspectEnglishTextV1(
  value: string,
  maxCodeUnits = ENGLISH_TEXT_MAX_CODE_UNITS_V1,
): EnglishTextContractViolationV1 | undefined {
  return inspectString(
    value,
    [],
    boundedLimitV1(maxCodeUnits, ENGLISH_TEXT_MAX_CODE_UNITS_V1),
    true,
  );
}

export function inspectEnglishTextTreeV1(
  root: unknown,
  options: EnglishTextTreeOptionsV1 = {},
): readonly EnglishTextContractViolationV1[] {
  const maxCodeUnitsPerValue = boundedLimitV1(
    options.maxCodeUnitsPerValue,
    ENGLISH_TEXT_MAX_CODE_UNITS_V1,
  );
  const maxTotalCodeUnits = boundedLimitV1(
    options.maxTotalCodeUnits,
    ENGLISH_TEXT_TREE_MAX_CODE_UNITS_V1,
  );
  const maxVisitedValues = boundedLimitV1(
    options.maxVisitedValues,
    ENGLISH_TEXT_TREE_MAX_VALUES_V1,
  );
  const maxIssues = boundedLimitV1(options.maxIssues, ENGLISH_TEXT_TREE_MAX_ISSUES_V1);
  const maxDepth = boundedLimitV1(options.maxDepth, ENGLISH_TEXT_TREE_MAX_DEPTH_V1);
  const lexicalPathPatterns = options.lexicalPathPatterns ?? [];
  const opaquePathPatterns = options.opaquePathPatterns ?? [];
  const issues: EnglishTextContractViolationV1[] = [];
  const pending: EnglishTextPendingValueV1[] = [{ value: root, path: undefined, role: "value" }];
  const visitedObjects = new WeakSet<object>();
  let visitedValues = 0;
  let totalCodeUnits = 0;

  if (lexicalPathPatterns.length + opaquePathPatterns.length
      > ENGLISH_TEXT_TREE_MAX_PATH_PATTERNS_V1
    || [...lexicalPathPatterns, ...opaquePathPatterns].some((pattern) =>
      pattern.length > ENGLISH_TEXT_TREE_MAX_PATTERN_SEGMENTS_V1)) {
    return Object.freeze([Object.freeze({
      code: "ENGLISH_TEXT_TREE_LIMIT_EXCEEDED" as const,
      path: Object.freeze([]),
    })]);
  }

  const addTreeLimitIssue = (path: EnglishTextPathNodeV1 | undefined): void => {
    if (issues.some((issue) => issue.code === "ENGLISH_TEXT_TREE_LIMIT_EXCEEDED")) return;
    issues.push(Object.freeze({
      code: "ENGLISH_TEXT_TREE_LIMIT_EXCEEDED",
      path: materializePathV1(path),
    }));
  };

  while (pending.length > 0 && issues.length < maxIssues) {
    const current = pending.pop()!;
    visitedValues += 1;
    if (visitedValues > maxVisitedValues) {
      addTreeLimitIssue(current.path);
      break;
    }
    if ((current.path?.depth ?? 0) > maxDepth) {
      issues.push(Object.freeze({
        code: "ENGLISH_TEXT_TREE_DEPTH_EXCEEDED",
        path: materializePathV1(current.path),
      }));
      continue;
    }
    if (typeof current.value === "string") {
      if (current.value.length > maxCodeUnitsPerValue) {
        issues.push(inspectString(
          current.value,
          materializePathV1(current.path),
          maxCodeUnitsPerValue,
          false,
        )!);
        continue;
      }
      totalCodeUnits += current.value.length;
      if (totalCodeUnits > maxTotalCodeUnits) {
        addTreeLimitIssue(current.path);
        break;
      }
      if (current.role === "value"
        && opaquePathPatterns.some((pattern) => pathMatchesPatternV1(current.path, pattern))) {
        continue;
      }
      const materializedPath = materializePathV1(current.path);
      const lexicalAdmission = current.role === "value"
        && lexicalPathPatterns.some((pattern) => pathMatchesPatternV1(current.path, pattern));
      const issue = inspectString(
        current.value,
        materializedPath,
        maxCodeUnitsPerValue,
        lexicalAdmission,
      );
      if (issue) issues.push(issue);
      continue;
    }
    if (current.value === null || typeof current.value !== "object") continue;
    if (visitedObjects.has(current.value)) {
      issues.push(Object.freeze({
        code: "ENGLISH_TEXT_OBJECT_REFERENCE_REUSED",
        path: materializePathV1(current.path),
      }));
      continue;
    }
    visitedObjects.add(current.value);
    if (Array.isArray(current.value)) {
      if (current.value.length > maxVisitedValues - visitedValues - pending.length) {
        addTreeLimitIssue(current.path);
        break;
      }
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        pending.push({ value: current.value[index], path: childPathV1(current.path, index), role: "value" });
      }
      continue;
    }
    const objectValue = current.value as Record<string, unknown>;
    let objectPrototype: object | null;
    try {
      objectPrototype = Object.getPrototypeOf(objectValue) as object | null;
    } catch {
      issues.push(Object.freeze({
        code: "ENGLISH_TEXT_OBJECT_PROTOTYPE_INVALID",
        path: materializePathV1(current.path),
      }));
      continue;
    }
    if (objectPrototype !== Object.prototype && objectPrototype !== null) {
      issues.push(Object.freeze({
        code: "ENGLISH_TEXT_OBJECT_PROTOTYPE_INVALID",
        path: materializePathV1(current.path),
      }));
      continue;
    }
    const retainedEntries: Array<readonly [string, unknown]> = [];
    const remainingValues = maxVisitedValues - visitedValues - pending.length;
    let objectLimitExceeded = false;
    let enumeratedKeys = 0;
    try {
      for (const key in objectValue) {
        enumeratedKeys += 1;
        if (enumeratedKeys * 2 > remainingValues) {
          addTreeLimitIssue(current.path);
          objectLimitExceeded = true;
          break;
        }
        if (!Object.prototype.hasOwnProperty.call(objectValue, key)) continue;
        const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
        if (!descriptor || !("value" in descriptor)) {
          issues.push(Object.freeze({
            code: "ENGLISH_TEXT_OBJECT_PROPERTY_INVALID",
            path: materializePathV1(childPathV1(current.path, key)),
          }));
          objectLimitExceeded = true;
          break;
        }
        retainedEntries.push(Object.freeze([key, descriptor.value]));
      }
    } catch {
      issues.push(Object.freeze({
        code: "ENGLISH_TEXT_OBJECT_PROPERTY_INVALID",
        path: materializePathV1(current.path),
      }));
      objectLimitExceeded = true;
    }
    if (objectLimitExceeded) break;
    for (let index = retainedEntries.length - 1; index >= 0; index -= 1) {
      const [key, value] = retainedEntries[index]!;
      const path = childPathV1(current.path, key);
      pending.push({ value, path, role: "value" });
      pending.push({ value: key, path, role: "key" });
    }
  }

  return Object.freeze(issues);
}

export function englishTextViolationMessageV1(
  issue: EnglishTextContractViolationV1,
): string {
  const path = issue.path.length > 0 ? `/${issue.path.join("/")}` : "/";
  const codeUnit = issue.codeUnit === undefined
    ? ""
    : ` code unit 0x${issue.codeUnit.toString(16).toUpperCase().padStart(4, "0")}`;
  return `${issue.code} at ${path}${codeUnit}`;
}
