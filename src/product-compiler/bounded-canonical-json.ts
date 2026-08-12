import { isProxy } from "node:util/types";

import { CanonicalJsonError } from "./canonical-json.js";

function unsupported(path: string, value: unknown): never {
  const kind = value === null ? "null" : typeof value;
  throw new CanonicalJsonError(
    "CANONICAL_JSON_UNSUPPORTED_TYPE",
    path,
    `Unsupported canonical JSON value (${kind})`,
  );
}

export type CanonicalJsonLimitErrorCode =
  | "CANONICAL_JSON_MAX_BYTES_EXCEEDED"
  | "CANONICAL_JSON_MAX_DEPTH_EXCEEDED"
  | "CANONICAL_JSON_MAX_NODES_EXCEEDED"
  | "CANONICAL_JSON_MAX_CONTAINER_ENTRIES_EXCEEDED"
  | "CANONICAL_JSON_MAX_WORK_EXCEEDED";

export class CanonicalJsonLimitError extends RangeError {
  readonly code: CanonicalJsonLimitErrorCode;
  readonly path: string;
  readonly limit: number;

  constructor(
    code: CanonicalJsonLimitErrorCode,
    path: string,
    limit: number,
    message: string,
  ) {
    super(`${message} at ${path}`);
    this.name = "CanonicalJsonLimitError";
    this.code = code;
    this.path = path;
    this.limit = limit;
  }
}

export type CanonicalJsonBoundedLimits = Readonly<{
  maxBytes: number;
  maxDepth: number;
  maxNodes: number;
  maxContainerEntries: number;
  maxWorkUnits: number;
}>;

export const DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: 128,
  maxNodes: 250_000,
  maxContainerEntries: 100_000,
  maxWorkUnits: 32 * 1024 * 1024,
});

function positiveSafeLimit(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
  return value;
}

class CanonicalJsonBoundedState {
  readonly limits: CanonicalJsonBoundedLimits;
  nodes = 0;
  workUnits = 0;

  constructor(limits: CanonicalJsonBoundedLimits) {
    this.limits = Object.freeze({
      maxBytes: positiveSafeLimit(limits.maxBytes, "maxBytes"),
      maxDepth: positiveSafeLimit(limits.maxDepth, "maxDepth"),
      maxNodes: positiveSafeLimit(limits.maxNodes, "maxNodes"),
      maxContainerEntries: positiveSafeLimit(
        limits.maxContainerEntries,
        "maxContainerEntries",
      ),
      maxWorkUnits: positiveSafeLimit(limits.maxWorkUnits, "maxWorkUnits"),
    });
  }

  enterNode(depth: number, path: string): void {
    if (depth > this.limits.maxDepth) {
      throw new CanonicalJsonLimitError(
        "CANONICAL_JSON_MAX_DEPTH_EXCEEDED",
        path,
        this.limits.maxDepth,
        `Canonical JSON exceeds maximum depth ${this.limits.maxDepth}`,
      );
    }
    this.nodes += 1;
    if (this.nodes > this.limits.maxNodes) {
      throw new CanonicalJsonLimitError(
        "CANONICAL_JSON_MAX_NODES_EXCEEDED",
        path,
        this.limits.maxNodes,
        `Canonical JSON exceeds maximum node count ${this.limits.maxNodes}`,
      );
    }
    this.consumeWork(1, path);
  }

  requireContainerEntries(entries: number, path: string): void {
    if (entries > this.limits.maxContainerEntries) {
      throw new CanonicalJsonLimitError(
        "CANONICAL_JSON_MAX_CONTAINER_ENTRIES_EXCEEDED",
        path,
        this.limits.maxContainerEntries,
        `Canonical JSON container exceeds ${this.limits.maxContainerEntries} entries`,
      );
    }
  }

  consumeWork(units: number, path: string): void {
    if (units < 0 || !Number.isSafeInteger(units)) {
      throw new RangeError("Canonical JSON work units must be a non-negative safe integer");
    }
    if (this.workUnits > this.limits.maxWorkUnits - units) {
      throw new CanonicalJsonLimitError(
        "CANONICAL_JSON_MAX_WORK_EXCEEDED",
        path,
        this.limits.maxWorkUnits,
        `Canonical JSON exceeds maximum work ${this.limits.maxWorkUnits}`,
      );
    }
    this.workUnits += units;
  }
}

const CANONICAL_OUTPUT_TEXT_CHUNK_UNITS = 8 * 1024;
const CANONICAL_STRING_RUN_UNITS = 4 * 1024;
const CANONICAL_DIAGNOSTIC_PATH_UNITS = 2 * 1024;

class CanonicalJsonBoundedSink {
  private readonly chunks: Buffer[] = [];
  private readonly pending: string[] = [];
  private pendingUnits = 0;
  byteLength = 0;

  constructor(private readonly state: CanonicalJsonBoundedState) {}

  append(text: string, path: string): void {
    const byteLength = Buffer.byteLength(text, "utf8");
    if (this.byteLength > this.state.limits.maxBytes - byteLength) {
      throw new CanonicalJsonLimitError(
        "CANONICAL_JSON_MAX_BYTES_EXCEEDED",
        path,
        this.state.limits.maxBytes,
        `Canonical JSON exceeds ${this.state.limits.maxBytes} bytes`,
      );
    }
    this.state.consumeWork(byteLength, path);
    this.byteLength += byteLength;
    this.pending.push(text);
    this.pendingUnits += text.length;
    if (this.pendingUnits >= CANONICAL_OUTPUT_TEXT_CHUNK_UNITS) this.flush();
  }

  finish(): Buffer {
    this.flush();
    return Buffer.concat(this.chunks, this.byteLength);
  }

  private flush(): void {
    if (this.pending.length === 0) return;
    this.chunks.push(Buffer.from(this.pending.join(""), "utf8"));
    this.pending.length = 0;
    this.pendingUnits = 0;
  }
}

function boundedChildPath(parent: string, key: string | number): string {
  const raw = String(key);
  const maximumSegmentUnits = 256;
  const visible = raw.slice(0, maximumSegmentUnits)
    .replaceAll("~", "~0")
    .replaceAll("/", "~1");
  const segment = raw.length > maximumSegmentUnits ? `${visible}...` : visible;
  const combined = `${parent}/${segment}`;
  if (combined.length <= CANONICAL_DIAGNOSTIC_PATH_UNITS) return combined;
  return `...${combined.slice(-(CANONICAL_DIAGNOSTIC_PATH_UNITS - 3))}`;
}

function unicodeEscape(codeUnit: number): string {
  return `\\u${codeUnit.toString(16).padStart(4, "0")}`;
}

function writeBoundedJsonString(
  value: string,
  path: string,
  state: CanonicalJsonBoundedState,
  sink: CanonicalJsonBoundedSink,
): void {
  sink.append('"', path);
  let safeRunStart = 0;
  let index = 0;
  while (index < value.length) {
    state.consumeWork(1, path);
    const codeUnit = value.charCodeAt(index);
    let escaped: string | undefined;
    let width = 1;
    if (codeUnit === 0x22) escaped = '\\"';
    else if (codeUnit === 0x5c) escaped = "\\\\";
    else if (codeUnit === 0x08) escaped = "\\b";
    else if (codeUnit === 0x09) escaped = "\\t";
    else if (codeUnit === 0x0a) escaped = "\\n";
    else if (codeUnit === 0x0c) escaped = "\\f";
    else if (codeUnit === 0x0d) escaped = "\\r";
    else if (codeUnit < 0x20) escaped = unicodeEscape(codeUnit);
    else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const following = value.charCodeAt(index + 1);
      if (following >= 0xdc00 && following <= 0xdfff) {
        state.consumeWork(1, path);
        width = 2;
      } else {
        escaped = unicodeEscape(codeUnit);
      }
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      escaped = unicodeEscape(codeUnit);
    }

    if (escaped !== undefined) {
      if (safeRunStart < index) sink.append(value.slice(safeRunStart, index), path);
      sink.append(escaped, path);
      index += width;
      safeRunStart = index;
      continue;
    }

    index += width;
    if (index - safeRunStart >= CANONICAL_STRING_RUN_UNITS) {
      sink.append(value.slice(safeRunStart, index), path);
      safeRunStart = index;
    }
  }
  if (safeRunStart < value.length) sink.append(value.slice(safeRunStart), path);
  sink.append('"', path);
}

function compareUtf16Bounded(
  left: string,
  right: string,
  state: CanonicalJsonBoundedState,
  path: string,
): number {
  const commonLength = Math.min(left.length, right.length);
  for (let index = 0; index < commonLength; index += 1) {
    state.consumeWork(1, path);
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  state.consumeWork(1, path);
  return left.length - right.length;
}

function sortUtf16Bounded(
  values: string[],
  state: CanonicalJsonBoundedState,
  path: string,
): string[] {
  if (values.length < 2) return values;
  let source = values;
  let target = new Array<string>(values.length);
  for (let width = 1; width < values.length; width *= 2) {
    for (let start = 0; start < values.length; start += width * 2) {
      const middle = Math.min(start + width, values.length);
      const finish = Math.min(start + (width * 2), values.length);
      let left = start;
      let right = middle;
      let output = start;
      while (left < middle || right < finish) {
        state.consumeWork(1, path);
        if (
          right >= finish
          || (
            left < middle
            && compareUtf16Bounded(source[left]!, source[right]!, state, path) <= 0
          )
        ) {
          target[output] = source[left]!;
          left += 1;
        } else {
          target[output] = source[right]!;
          right += 1;
        }
        output += 1;
      }
    }
    [source, target] = [target, source];
  }
  return source;
}

type CanonicalJsonBoundedFrame =
  | Readonly<{
      kind: "value";
      value: unknown;
      path: string;
      depth: number;
    }>
  | {
      kind: "array";
      value: unknown[];
      path: string;
      depth: number;
      length: number;
      index: number;
    }
  | {
      kind: "object";
      value: object;
      path: string;
      depth: number;
      keys: string[];
      index: number;
    };

/**
 * Emits byte-identical Setfarm Canonical JSON v1 without recursively building
 * a full string. Output, traversal, sorting, depth, and container work are all
 * bounded before the resulting Buffer can exceed the caller's authority.
 */
export function canonicalJsonBytesBounded(
  value: unknown,
  limits: CanonicalJsonBoundedLimits,
): Buffer {
  const state = new CanonicalJsonBoundedState(limits);
  const sink = new CanonicalJsonBoundedSink(state);
  const ancestors = new Set<object>();
  const stack: CanonicalJsonBoundedFrame[] = [{
    kind: "value",
    value,
    path: "$",
    depth: 0,
  }];

  while (stack.length > 0) {
    const frame = stack.at(-1)!;
    if (frame.kind === "array") {
      if (frame.index >= frame.length) {
        sink.append("]", frame.path);
        ancestors.delete(frame.value);
        stack.pop();
        continue;
      }
      const index = frame.index;
      if (index > 0) sink.append(",", frame.path);
      frame.index += 1;
      state.consumeWork(1, frame.path);
      const descriptor = Object.getOwnPropertyDescriptor(frame.value, String(index));
      if (!descriptor) {
        throw new CanonicalJsonError(
          "CANONICAL_JSON_SPARSE_ARRAY",
          boundedChildPath(frame.path, index),
          "Sparse arrays are not canonical JSON values",
        );
      }
      if (!("value" in descriptor)) {
        throw new CanonicalJsonError(
          "CANONICAL_JSON_ACCESSOR_PROPERTY",
          boundedChildPath(frame.path, index),
          "Accessor properties are not canonical JSON values",
        );
      }
      if (!descriptor.enumerable) {
        throw new CanonicalJsonError(
          "CANONICAL_JSON_NON_ENUMERABLE_PROPERTY",
          boundedChildPath(frame.path, index),
          "Non-enumerable properties are not canonical JSON values",
        );
      }
      stack.push({
        kind: "value",
        value: descriptor.value,
        path: boundedChildPath(frame.path, index),
        depth: frame.depth + 1,
      });
      continue;
    }

    if (frame.kind === "object") {
      if (frame.index >= frame.keys.length) {
        sink.append("}", frame.path);
        ancestors.delete(frame.value);
        stack.pop();
        continue;
      }
      const index = frame.index;
      const key = frame.keys[index]!;
      if (index > 0) sink.append(",", frame.path);
      frame.index += 1;
      const entryPath = boundedChildPath(frame.path, key);
      const descriptor = Object.getOwnPropertyDescriptor(frame.value, key);
      if (!descriptor || !("value" in descriptor)) {
        throw new CanonicalJsonError(
          "CANONICAL_JSON_ACCESSOR_PROPERTY",
          entryPath,
          "Accessor properties are not canonical JSON values",
        );
      }
      if (!descriptor.enumerable) {
        throw new CanonicalJsonError(
          "CANONICAL_JSON_NON_ENUMERABLE_PROPERTY",
          entryPath,
          "Non-enumerable properties are not canonical JSON values",
        );
      }
      writeBoundedJsonString(key, entryPath, state, sink);
      sink.append(":", entryPath);
      stack.push({
        kind: "value",
        value: descriptor.value,
        path: entryPath,
        depth: frame.depth + 1,
      });
      continue;
    }

    stack.pop();
    state.enterNode(frame.depth, frame.path);
    if (frame.value === null) {
      sink.append("null", frame.path);
      continue;
    }
    switch (typeof frame.value) {
      case "boolean":
        sink.append(frame.value ? "true" : "false", frame.path);
        continue;
      case "string":
        writeBoundedJsonString(frame.value, frame.path, state, sink);
        continue;
      case "number":
        if (!Number.isFinite(frame.value)) {
          throw new CanonicalJsonError(
            "CANONICAL_JSON_NON_FINITE_NUMBER",
            frame.path,
            "Non-finite numbers are not canonical JSON values",
          );
        }
        sink.append(Object.is(frame.value, -0) ? "0" : JSON.stringify(frame.value), frame.path);
        continue;
      case "object":
        break;
      default:
        return unsupported(frame.path, frame.value);
    }

    if (isProxy(frame.value)) {
      throw new CanonicalJsonError(
        "CANONICAL_JSON_UNSUPPORTED_PROTOTYPE",
        frame.path,
        "Proxy objects are not canonical JSON values",
      );
    }

    if (ancestors.has(frame.value)) {
      throw new CanonicalJsonError(
        "CANONICAL_JSON_CYCLE",
        frame.path,
        "Cyclic references are not canonical JSON values",
      );
    }
    ancestors.add(frame.value);

    if (Array.isArray(frame.value)) {
      if (Object.getPrototypeOf(frame.value) !== Array.prototype) {
        throw new CanonicalJsonError(
          "CANONICAL_JSON_UNSUPPORTED_PROTOTYPE",
          frame.path,
          "Array subclasses are not canonical JSON values",
        );
      }
      const lengthDescriptor = Object.getOwnPropertyDescriptor(frame.value, "length");
      const length = lengthDescriptor && "value" in lengthDescriptor
        ? lengthDescriptor.value
        : undefined;
      if (!Number.isSafeInteger(length) || length < 0 || length > 0xffff_ffff) {
        throw new CanonicalJsonError(
          "CANONICAL_JSON_ARRAY_PROPERTY",
          boundedChildPath(frame.path, "length"),
          "Array length must be a non-negative uint32 data property",
        );
      }
      state.requireContainerEntries(length, frame.path);
      const ownKeys = Reflect.ownKeys(frame.value);
      state.requireContainerEntries(Math.max(0, ownKeys.length - 1), frame.path);
      for (const key of ownKeys) {
        state.consumeWork(1, frame.path);
        if (typeof key === "symbol") {
          throw new CanonicalJsonError(
            "CANONICAL_JSON_SYMBOL_PROPERTY",
            frame.path,
            "Symbol properties are not canonical JSON values",
          );
        }
        if (key === "length") continue;
        if (key.length > 10) {
          throw new CanonicalJsonError(
            "CANONICAL_JSON_ARRAY_PROPERTY",
            boundedChildPath(frame.path, key),
            "Arrays may contain only indexed elements",
          );
        }
        const index = Number(key);
        if (
          !Number.isInteger(index)
          || index < 0
          || index >= length
          || String(index) !== key
        ) {
          throw new CanonicalJsonError(
            "CANONICAL_JSON_ARRAY_PROPERTY",
            boundedChildPath(frame.path, key),
            "Arrays may contain only indexed elements",
          );
        }
      }
      sink.append("[", frame.path);
      stack.push({
        kind: "array",
        value: frame.value,
        path: frame.path,
        depth: frame.depth,
        length,
        index: 0,
      });
      continue;
    }

    const prototype = Object.getPrototypeOf(frame.value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CanonicalJsonError(
        "CANONICAL_JSON_UNSUPPORTED_PROTOTYPE",
        frame.path,
        "Only plain objects are canonical JSON values",
      );
    }
    const ownKeys = Reflect.ownKeys(frame.value);
    state.requireContainerEntries(ownKeys.length, frame.path);
    const keys: string[] = [];
    for (const key of ownKeys) {
      state.consumeWork(1, frame.path);
      if (typeof key === "symbol") {
        throw new CanonicalJsonError(
          "CANONICAL_JSON_SYMBOL_PROPERTY",
          frame.path,
          "Symbol properties are not canonical JSON values",
        );
      }
      const entryPath = boundedChildPath(frame.path, key);
      const descriptor = Object.getOwnPropertyDescriptor(frame.value, key);
      if (!descriptor || !("value" in descriptor)) {
        throw new CanonicalJsonError(
          "CANONICAL_JSON_ACCESSOR_PROPERTY",
          entryPath,
          "Accessor properties are not canonical JSON values",
        );
      }
      if (!descriptor.enumerable) {
        throw new CanonicalJsonError(
          "CANONICAL_JSON_NON_ENUMERABLE_PROPERTY",
          entryPath,
          "Non-enumerable properties are not canonical JSON values",
        );
      }
      keys.push(key);
    }
    const sortedKeys = sortUtf16Bounded(keys, state, frame.path);
    sink.append("{", frame.path);
    stack.push({
      kind: "object",
      value: frame.value,
      path: frame.path,
      depth: frame.depth,
      keys: sortedKeys,
      index: 0,
    });
  }

  return sink.finish();
}
