import { createHash } from "node:crypto";

export type CanonicalJsonErrorCode =
  | "CANONICAL_JSON_UNSUPPORTED_TYPE"
  | "CANONICAL_JSON_NON_FINITE_NUMBER"
  | "CANONICAL_JSON_SPARSE_ARRAY"
  | "CANONICAL_JSON_ARRAY_PROPERTY"
  | "CANONICAL_JSON_CYCLE"
  | "CANONICAL_JSON_ACCESSOR_PROPERTY"
  | "CANONICAL_JSON_SYMBOL_PROPERTY"
  | "CANONICAL_JSON_NON_ENUMERABLE_PROPERTY"
  | "CANONICAL_JSON_UNSUPPORTED_PROTOTYPE";

export class CanonicalJsonError extends TypeError {
  readonly code: CanonicalJsonErrorCode;
  readonly path: string;

  constructor(code: CanonicalJsonErrorCode, path: string, message: string) {
    super(`${message} at ${path}`);
    this.name = "CanonicalJsonError";
    this.code = code;
    this.path = path;
  }
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function pointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function childPath(parent: string, key: string | number): string {
  return `${parent}/${pointerSegment(String(key))}`;
}

function unsupported(path: string, value: unknown): never {
  const kind = value === null ? "null" : typeof value;
  throw new CanonicalJsonError(
    "CANONICAL_JSON_UNSUPPORTED_TYPE",
    path,
    `Unsupported canonical JSON value (${kind})`,
  );
}

function serializeArray(
  value: unknown[],
  path: string,
  ancestors: Set<object>,
): string {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new CanonicalJsonError(
      "CANONICAL_JSON_UNSUPPORTED_PROTOTYPE",
      path,
      "Array subclasses are not canonical JSON values",
    );
  }

  const ownKeys = Reflect.ownKeys(value);
  for (const key of ownKeys) {
    if (typeof key === "symbol") {
      throw new CanonicalJsonError(
        "CANONICAL_JSON_SYMBOL_PROPERTY",
        path,
        "Symbol properties are not canonical JSON values",
      );
    }
    if (key === "length") continue;
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= value.length || String(index) !== key) {
      throw new CanonicalJsonError(
        "CANONICAL_JSON_ARRAY_PROPERTY",
        childPath(path, key),
        "Arrays may contain only indexed elements",
      );
    }
  }

  const parts: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      throw new CanonicalJsonError(
        "CANONICAL_JSON_SPARSE_ARRAY",
        childPath(path, index),
        "Sparse arrays are not canonical JSON values",
      );
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor)) {
      throw new CanonicalJsonError(
        "CANONICAL_JSON_ACCESSOR_PROPERTY",
        childPath(path, index),
        "Accessor properties are not canonical JSON values",
      );
    }
    if (!descriptor.enumerable) {
      throw new CanonicalJsonError(
        "CANONICAL_JSON_NON_ENUMERABLE_PROPERTY",
        childPath(path, index),
        "Non-enumerable properties are not canonical JSON values",
      );
    }
    parts.push(serializeCanonical(descriptor.value, childPath(path, index), ancestors));
  }
  return `[${parts.join(",")}]`;
}

function serializeObject(
  value: object,
  path: string,
  ancestors: Set<object>,
): string {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new CanonicalJsonError(
      "CANONICAL_JSON_UNSUPPORTED_PROTOTYPE",
      path,
      "Only plain objects are canonical JSON values",
    );
  }

  const keys: string[] = [];
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      throw new CanonicalJsonError(
        "CANONICAL_JSON_SYMBOL_PROPERTY",
        path,
        "Symbol properties are not canonical JSON values",
      );
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) {
      throw new CanonicalJsonError(
        "CANONICAL_JSON_ACCESSOR_PROPERTY",
        childPath(path, key),
        "Accessor properties are not canonical JSON values",
      );
    }
    if (!descriptor.enumerable) {
      throw new CanonicalJsonError(
        "CANONICAL_JSON_NON_ENUMERABLE_PROPERTY",
        childPath(path, key),
        "Non-enumerable properties are not canonical JSON values",
      );
    }
    keys.push(key);
  }

  keys.sort(compareUtf16);
  const parts = keys.map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) {
      throw new CanonicalJsonError(
        "CANONICAL_JSON_ACCESSOR_PROPERTY",
        childPath(path, key),
        "Accessor properties are not canonical JSON values",
      );
    }
    return `${JSON.stringify(key)}:${serializeCanonical(
      descriptor.value,
      childPath(path, key),
      ancestors,
    )}`;
  });
  return `{${parts.join(",")}}`;
}

function serializeCanonical(value: unknown, path: string, ancestors: Set<object>): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "string":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new CanonicalJsonError(
          "CANONICAL_JSON_NON_FINITE_NUMBER",
          path,
          "Non-finite numbers are not canonical JSON values",
        );
      }
      return Object.is(value, -0) ? "0" : JSON.stringify(value);
    case "object":
      break;
    default:
      return unsupported(path, value);
  }

  if (ancestors.has(value)) {
    throw new CanonicalJsonError(
      "CANONICAL_JSON_CYCLE",
      path,
      "Cyclic references are not canonical JSON values",
    );
  }

  ancestors.add(value);
  try {
    return Array.isArray(value)
      ? serializeArray(value, path, ancestors)
      : serializeObject(value, path, ancestors);
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalJsonStringify(value: unknown): string {
  return serializeCanonical(value, "$", new Set<object>());
}

export function canonicalJsonBytes(value: unknown): Buffer {
  return Buffer.from(canonicalJsonStringify(value), "utf8");
}

export function hashCanonicalJson(value: unknown): string {
  return createHash("sha256").update(canonicalJsonBytes(value)).digest("hex");
}
