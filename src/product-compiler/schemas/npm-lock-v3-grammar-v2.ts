export const NPM_LOCK_V3_PACKAGE_SEGMENT_MAX_CHARACTERS_V2 = 100;
export const NPM_LOCK_V3_EXACT_VERSION_MAX_CHARACTERS_V2 = 64;
export const NPM_LOCK_V3_DEPENDENCY_SPEC_MAX_CHARACTERS_V2 = 160;

const CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2 =
  "(?:0|[1-9][0-9]*)";
const NPM_PACKAGE_SEGMENT_SOURCE_V2 =
  "[a-z0-9][a-z0-9._-]{0,99}";
const NPM_PACKAGE_NAME_SOURCE_V2 =
  `(?:@${NPM_PACKAGE_SEGMENT_SOURCE_V2}/${NPM_PACKAGE_SEGMENT_SOURCE_V2}`
  + `|${NPM_PACKAGE_SEGMENT_SOURCE_V2})`;

const NPM_PACKAGE_NAME_PATTERN_V2 = new RegExp(
  `^${NPM_PACKAGE_NAME_SOURCE_V2}$`,
  "u",
);
const NPM_LOCK_PACKAGE_PATH_PATTERN_V2 = new RegExp(
  `^node_modules/${NPM_PACKAGE_NAME_SOURCE_V2}`
    + `(?:/node_modules/${NPM_PACKAGE_NAME_SOURCE_V2})*$`,
  "u",
);
const NPM_ROOT_PACKAGE_PATH_PATTERN_V2 = new RegExp(
  `^node_modules/${NPM_PACKAGE_NAME_SOURCE_V2}$`,
  "u",
);
const NPM_EXACT_VERSION_PATTERN_V2 = new RegExp(
  `^${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2}`
    + `\\.${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2}`
    + `\\.${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2}$`,
  "u",
);
const NPM_CARET_OR_TILDE_EXACT_SPEC_PATTERN_V2 =
  new RegExp(
    `^([~^])(${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2})`
      + `\\.(${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2})`
      + `\\.(${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2})$`,
    "u",
  );
const NPM_SHORT_CARET_SPEC_PATTERN_V2 = new RegExp(
  `^\\^(${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2})$`,
  "u",
);
const NPM_COMPARATOR_PAIR_SPEC_PATTERN_V2 = new RegExp(
  `^>= (${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2}`
    + `\\.${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2}`
    + `\\.${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2}) < `
    + `(${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2}`
    + `\\.${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2}`
    + `\\.${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2})$`,
  "u",
);
const NPM_CANONICAL_NUMERIC_IDENTIFIER_PATTERN_V2 =
  new RegExp(
    `^${CANONICAL_NUMERIC_IDENTIFIER_SOURCE_V2}$`,
    "u",
  );

type VersionTupleV2 =
  readonly [bigint, bigint, bigint];

function parseCanonicalNumericIdentifierV2(
  value: string,
): bigint | null {
  if (
    value.length < 1
    || value.length
      > NPM_LOCK_V3_EXACT_VERSION_MAX_CHARACTERS_V2
    || !NPM_CANONICAL_NUMERIC_IDENTIFIER_PATTERN_V2
      .test(value)
  ) {
    return null;
  }
  return BigInt(value);
}

function parseExactVersionV2(
  value: string,
): VersionTupleV2 | null {
  if (!isCanonicalNpmExactVersionV2(value)) return null;
  const [major, minor, patch] = value.split(".");
  return Object.freeze([
    BigInt(major!),
    BigInt(minor!),
    BigInt(patch!),
  ]);
}

function compareVersionV2(
  left: VersionTupleV2,
  right: VersionTupleV2,
): number {
  for (let index = 0; index < 3; index += 1) {
    if (left[index]! < right[index]!) return -1;
    if (left[index]! > right[index]!) return 1;
  }
  return 0;
}

export function isCanonicalNpmPackageNameV2(
  value: unknown,
): value is string {
  return typeof value === "string"
    && NPM_PACKAGE_NAME_PATTERN_V2.test(value);
}

export function isCanonicalNpmLockPackagePathV2(
  value: unknown,
): value is string {
  return typeof value === "string"
    && NPM_LOCK_PACKAGE_PATH_PATTERN_V2.test(value);
}

export function isCanonicalNpmRootPackagePathV2(
  value: unknown,
): value is string {
  return typeof value === "string"
    && NPM_ROOT_PACKAGE_PATH_PATTERN_V2.test(value);
}

export function isCanonicalNpmExactVersionV2(
  value: unknown,
): value is string {
  return typeof value === "string"
    && value.length
      <= NPM_LOCK_V3_EXACT_VERSION_MAX_CHARACTERS_V2
    && NPM_EXACT_VERSION_PATTERN_V2.test(value);
}

export function isSupportedNpmDependencySpecV2(
  value: unknown,
): value is string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length
      > NPM_LOCK_V3_DEPENDENCY_SPEC_MAX_CHARACTERS_V2
  ) {
    return false;
  }
  if (
    value === "*"
    || isCanonicalNpmExactVersionV2(value)
    || parseCanonicalNumericIdentifierV2(value) !== null
    || NPM_SHORT_CARET_SPEC_PATTERN_V2.test(value)
    || NPM_CARET_OR_TILDE_EXACT_SPEC_PATTERN_V2
      .test(value)
  ) {
    return true;
  }
  const comparator =
    NPM_COMPARATOR_PAIR_SPEC_PATTERN_V2.exec(value);
  if (!comparator) return false;
  const minimum = parseExactVersionV2(comparator[1]!);
  const maximum = parseExactVersionV2(comparator[2]!);
  return minimum !== null
    && maximum !== null
    && compareVersionV2(minimum, maximum) < 0;
}

export function npmVersionSatisfiesDependencySpecV2(
  versionText: string,
  spec: string,
): boolean {
  const version = parseExactVersionV2(versionText);
  if (
    version === null
    || !isSupportedNpmDependencySpecV2(spec)
  ) {
    return false;
  }
  if (spec === "*") return true;
  const exact = parseExactVersionV2(spec);
  if (exact) return compareVersionV2(version, exact) === 0;
  const major = parseCanonicalNumericIdentifierV2(spec);
  if (major !== null) return version[0] === major;
  const shortCaret =
    NPM_SHORT_CARET_SPEC_PATTERN_V2.exec(spec);
  if (shortCaret) {
    const shortMajor =
      parseCanonicalNumericIdentifierV2(shortCaret[1]!);
    return shortMajor !== null
      && version[0] === shortMajor;
  }
  const prefix =
    NPM_CARET_OR_TILDE_EXACT_SPEC_PATTERN_V2.exec(
      spec,
    );
  if (prefix) {
    const baseIdentifiers = [
      prefix[2]!,
      prefix[3]!,
      prefix[4]!,
    ].map(parseCanonicalNumericIdentifierV2);
    if (
      baseIdentifiers.some(
        (identifier) => identifier === null,
      )
    ) {
      return false;
    }
    const base: VersionTupleV2 = [
      baseIdentifiers[0]!,
      baseIdentifiers[1]!,
      baseIdentifiers[2]!,
    ];
    if (compareVersionV2(version, base) < 0) return false;
    if (prefix[1] === "~") {
      return version[0] === base[0]
        && version[1] === base[1];
    }
    if (base[0] > 0n) return version[0] === base[0];
    if (base[1] > 0n) {
      return version[0] === 0n
        && version[1] === base[1];
    }
    return version[0] === 0n
      && version[1] === 0n
      && version[2] === base[2];
  }
  const comparator =
    NPM_COMPARATOR_PAIR_SPEC_PATTERN_V2.exec(spec);
  if (!comparator) return false;
  const minimum = parseExactVersionV2(comparator[1]!);
  const maximum = parseExactVersionV2(comparator[2]!);
  return minimum !== null
    && maximum !== null
    && compareVersionV2(version, minimum) >= 0
    && compareVersionV2(version, maximum) < 0;
}

export function npmPackageNameFromLockPathV2(
  packagePath: string,
): string | null {
  if (!isCanonicalNpmLockPackagePathV2(packagePath)) {
    return null;
  }
  const marker = "/node_modules/";
  const lastMarker = packagePath.lastIndexOf(marker);
  return lastMarker < 0
    ? packagePath.slice("node_modules/".length)
    : packagePath.slice(lastMarker + marker.length);
}

export function resolveNpmDependencyPathV2(
  packagePaths: ReadonlySet<string>,
  ownerPackagePath: string,
  dependencyName: string,
): string | null {
  if (
    !isCanonicalNpmPackageNameV2(dependencyName)
    || (
      ownerPackagePath !== ""
      && !isCanonicalNpmLockPackagePathV2(
        ownerPackagePath,
      )
    )
  ) {
    return null;
  }
  let base = ownerPackagePath;
  for (;;) {
    const candidate = base.length > 0
      ? `${base}/node_modules/${dependencyName}`
      : `node_modules/${dependencyName}`;
    if (packagePaths.has(candidate)) return candidate;
    const nestedMarker =
      base.lastIndexOf("/node_modules/");
    if (nestedMarker >= 0) {
      base = base.slice(0, nestedMarker);
      continue;
    }
    if (base.startsWith("node_modules/")) {
      base = "";
      continue;
    }
    return null;
  }
}
