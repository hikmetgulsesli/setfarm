export const STITCH_SEMANTIC_DOM_POLICY_V1 =
  "rendered-exact-attributes-surface-scoped-native-controls.v1" as const;

export type StitchSemanticElementV1 = Readonly<{
  tagName: string;
  attributes: ReadonlyMap<string, string>;
  duplicateAttributes: readonly string[];
  rendered: boolean;
  disabled: boolean;
  activeSurfaceRef?: string;
}>;

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
  "meta", "param", "source", "track", "wbr",
]);
const NATIVE_ACTION_ELEMENTS = new Set(["button", "a", "input", "textarea", "select"]);
const RAW_TEXT_ELEMENTS = new Set(["script", "style", "noscript", "textarea", "title"]);

function isSpace(value: string): boolean {
  return /[\t\n\f\r ]/.test(value);
}

function parseAttributes(source: string): {
  attributes: Map<string, string>;
  duplicateAttributes: string[];
} {
  const attributes = new Map<string, string>();
  const duplicates = new Set<string>();
  let index = 0;
  while (index < source.length) {
    while (index < source.length && (isSpace(source[index]!) || source[index] === "/")) index += 1;
    if (index >= source.length) break;
    const nameStart = index;
    while (
      index < source.length
      && !isSpace(source[index]!)
      && !["=", ">", "/"].includes(source[index]!)
    ) index += 1;
    const name = source.slice(nameStart, index).toLowerCase();
    if (!name) {
      index += 1;
      continue;
    }
    while (index < source.length && isSpace(source[index]!)) index += 1;
    let value = "";
    if (source[index] === "=") {
      index += 1;
      while (index < source.length && isSpace(source[index]!)) index += 1;
      const quote = source[index] === "\"" || source[index] === "'" ? source[index]! : "";
      if (quote) {
        index += 1;
        const valueStart = index;
        while (index < source.length && source[index] !== quote) index += 1;
        value = source.slice(valueStart, index);
        if (source[index] === quote) index += 1;
      } else {
        const valueStart = index;
        while (index < source.length && !isSpace(source[index]!) && ![">", "/"].includes(source[index]!)) {
          index += 1;
        }
        value = source.slice(valueStart, index);
      }
    }
    if (attributes.has(name)) duplicates.add(name);
    else attributes.set(name, value);
  }
  return { attributes, duplicateAttributes: [...duplicates].sort() };
}

function findTagEnd(source: string, start: number): number {
  let quote = "";
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]!;
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'") quote = character;
    else if (character === ">") return index;
  }
  return -1;
}

type StackFrame = Readonly<{
  tagName: string;
  rendered: boolean;
  activeSurfaceRef?: string;
}>;

/** Exact, bounded semantic projection used before generated HTML conversion. */
export function parseStitchSemanticDomV1(html: string): StitchSemanticElementV1[] {
  const source = String(html || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const elements: StitchSemanticElementV1[] = [];
  const stack: StackFrame[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf("<", cursor);
    if (start < 0) break;
    const end = findTagEnd(source, start + 1);
    if (end < 0) break;
    const token = source.slice(start + 1, end);
    cursor = end + 1;
    if (/^\s*[!?]/.test(token)) continue;
    const closing = token.match(/^\s*\/\s*([A-Za-z][A-Za-z0-9:-]*)/);
    if (closing) {
      const tagName = closing[1]!.toLowerCase();
      const matchingIndex = stack.map((frame) => frame.tagName).lastIndexOf(tagName);
      if (matchingIndex >= 0) stack.splice(matchingIndex);
      continue;
    }
    const opening = token.match(/^\s*([A-Za-z][A-Za-z0-9:-]*)/);
    if (!opening) continue;
    const tagName = opening[1]!.toLowerCase();
    const attributeSource = token.slice(opening[0].length).replace(/\/\s*$/, "");
    const parsed = parseAttributes(attributeSource);
    const parent = stack[stack.length - 1];
    const style = parsed.attributes.get("style")?.toLowerCase() ?? "";
    const classTokens = new Set((parsed.attributes.get("class") ?? "").split(/\s+/).filter(Boolean));
    const selfHidden = parsed.attributes.has("hidden")
      || parsed.attributes.has("inert")
      || parsed.attributes.get("aria-hidden")?.trim().toLowerCase() === "true"
      || /(?:^|;)\s*display\s*:\s*none\b/.test(style)
      || /(?:^|;)\s*visibility\s*:\s*hidden\b/.test(style)
      || ["hidden", "invisible", "collapse", "opacity-0", "pointer-events-none"]
        .some((tokenName) => classTokens.has(tokenName))
      || tagName === "template"
      || tagName === "head";
    const rendered = (parent?.rendered ?? true) && !selfHidden;
    const ownSurfaceRef = parsed.attributes.get("data-surface-id")?.trim() || undefined;
    const activeSurfaceRef = ownSurfaceRef ?? parent?.activeSurfaceRef;
    const disabled = parsed.attributes.has("disabled")
      || parsed.attributes.get("aria-disabled")?.trim().toLowerCase() === "true"
      || (tagName === "input" && parsed.attributes.get("type")?.trim().toLowerCase() === "hidden");
    elements.push({
      tagName,
      attributes: parsed.attributes,
      duplicateAttributes: parsed.duplicateAttributes,
      rendered,
      disabled,
      ...(activeSurfaceRef ? { activeSurfaceRef } : {}),
    });
    if (RAW_TEXT_ELEMENTS.has(tagName)) {
      const closingStart = source.toLowerCase().indexOf(`</${tagName}`, cursor);
      if (closingStart < 0) {
        cursor = source.length;
      } else {
        const closingEnd = findTagEnd(source, closingStart + 2 + tagName.length);
        cursor = closingEnd < 0 ? source.length : closingEnd + 1;
      }
      continue;
    }
    if (!/\/\s*$/.test(token) && !VOID_ELEMENTS.has(tagName)) {
      stack.push({ tagName, rendered, ...(activeSurfaceRef ? { activeSurfaceRef } : {}) });
    }
  }
  return elements;
}

export function stitchSemanticAttribute(
  element: StitchSemanticElementV1,
  name: string,
): string | undefined {
  return element.attributes.get(name.toLowerCase());
}

export function isNativeStitchActionElementV1(element: StitchSemanticElementV1): boolean {
  return NATIVE_ACTION_ELEMENTS.has(element.tagName) && element.rendered && !element.disabled;
}
