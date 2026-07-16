import { createHash, randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { canonicalJsonBytes, canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  NormalizedRelativeLocatorSchema,
  Sha256Schema,
} from "./schemas/common-v1.js";
import {
  ProductCompilationAttemptOutputRefsV1Schema,
  ProductCompilationAttemptV1Schema,
  type ProductCompilationAttemptV1,
} from "./schemas/product-compilation-attempt-v1.js";

export const ProductCompilationEvidenceAreaV1Schema = z.enum([
  "raw",
  "request",
  "download",
  "render",
  "selection",
]);

export type ProductCompilationEvidenceAreaV1 = z.infer<
  typeof ProductCompilationEvidenceAreaV1Schema
>;

const ProductCompilationOutputRefNameV1Schema = z.enum([
  "directResponseEvidenceHash",
  "renderedSemanticsHash",
  "candidateSelectionHash",
  "responseBindingsHash",
  "designSourceClosureHash",
]);

type ProductCompilationOutputRefNameV1 = z.infer<
  typeof ProductCompilationOutputRefNameV1Schema
>;

export const ProductCompilationAttemptArtifactRefV1Schema = z.object({
  area: ProductCompilationEvidenceAreaV1Schema,
  locator: NormalizedRelativeLocatorSchema,
  contentHash: Sha256Schema,
  byteLength: z.number().int().nonnegative(),
}).strict();

export type ProductCompilationAttemptArtifactRefV1 = z.infer<
  typeof ProductCompilationAttemptArtifactRefV1Schema
>;

const ProductCompilationAuthorityArtifactV1Schema = z.object({
  outputRef: ProductCompilationOutputRefNameV1Schema,
  source: ProductCompilationAttemptArtifactRefV1Schema,
}).strict();

const ProductCompilationProjectionArtifactV1Schema = z.object({
  source: ProductCompilationAttemptArtifactRefV1Schema,
  targetPath: NormalizedRelativeLocatorSchema,
}).strict().superRefine((value, context) => {
  if (value.targetPath === "PRODUCT_COMPILATION_PROJECTION_RECEIPT.json") {
    context.addIssue({
      code: "custom",
      path: ["targetPath"],
      message: "Projection artifacts cannot replace the compiler-owned receipt",
    });
  }
});

const ProductCompilationArtifactManifestPayloadV1Schema = z.object({
  schema: z.literal("setfarm.product-compilation-artifact-manifest.v1"),
  attemptId: z.string().regex(/^PCA_[a-f0-9]{64}$/),
  outputSealHash: Sha256Schema,
  outputRefs: ProductCompilationAttemptOutputRefsV1Schema,
  authorityArtifacts: z.array(ProductCompilationAuthorityArtifactV1Schema).min(1).max(20),
  projectionArtifacts: z.array(ProductCompilationProjectionArtifactV1Schema).min(1).max(10_000),
}).strict().superRefine((value, context) => {
  const outputRefNames = value.authorityArtifacts.map((artifact) => artifact.outputRef);
  if (new Set(outputRefNames).size !== outputRefNames.length) {
    context.addIssue({
      code: "custom",
      path: ["authorityArtifacts"],
      message: "Authority artifact output refs must be unique",
    });
  }
  const targetPaths = value.projectionArtifacts.map((artifact) => artifact.targetPath);
  if (new Set(targetPaths).size !== targetPaths.length) {
    context.addIssue({
      code: "custom",
      path: ["projectionArtifacts"],
      message: "Projection target paths must be unique",
    });
  }
});

type ProductCompilationArtifactManifestPayloadV1 = z.infer<
  typeof ProductCompilationArtifactManifestPayloadV1Schema
>;

const ProductCompilationArtifactManifestShapeV1Schema =
  ProductCompilationArtifactManifestPayloadV1Schema.extend({
    manifestHash: Sha256Schema,
  }).strict();

function manifestPayload(
  value: z.infer<typeof ProductCompilationArtifactManifestShapeV1Schema>,
): ProductCompilationArtifactManifestPayloadV1 {
  const { manifestHash: _manifestHash, ...payload } = value;
  return payload;
}

export const ProductCompilationArtifactManifestV1Schema =
  ProductCompilationArtifactManifestShapeV1Schema.superRefine((value, context) => {
    if (hashCanonicalJson(manifestPayload(value)) !== value.manifestHash) {
      context.addIssue({
        code: "custom",
        path: ["manifestHash"],
        message: "Artifact manifest hash must bind the exact canonical payload",
      });
    }
  });

export type ProductCompilationArtifactManifestV1 = z.infer<
  typeof ProductCompilationArtifactManifestV1Schema
>;

const ProductCompilationProjectionReceiptPayloadV1Schema = z.object({
  schema: z.literal("setfarm.product-compilation-projection-receipt.v1"),
  attemptId: z.string().regex(/^PCA_[a-f0-9]{64}$/),
  outputSealHash: Sha256Schema,
  manifestHash: Sha256Schema,
  projectionHash: Sha256Schema,
  artifacts: z.array(z.object({
    path: NormalizedRelativeLocatorSchema,
    contentHash: Sha256Schema,
    byteLength: z.number().int().nonnegative(),
  }).strict()).min(1).max(10_000),
}).strict();

type ProductCompilationProjectionReceiptPayloadV1 = z.infer<
  typeof ProductCompilationProjectionReceiptPayloadV1Schema
>;

const ProductCompilationProjectionReceiptShapeV1Schema =
  ProductCompilationProjectionReceiptPayloadV1Schema.extend({
    receiptHash: Sha256Schema,
  }).strict();

function receiptPayload(
  value: z.infer<typeof ProductCompilationProjectionReceiptShapeV1Schema>,
): ProductCompilationProjectionReceiptPayloadV1 {
  const { receiptHash: _receiptHash, ...payload } = value;
  return payload;
}

export const ProductCompilationProjectionReceiptV1Schema =
  ProductCompilationProjectionReceiptShapeV1Schema.superRefine((value, context) => {
    if (hashCanonicalJson(receiptPayload(value)) !== value.receiptHash) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Projection receipt hash must bind the exact canonical payload",
      });
    }
  });

export type ProductCompilationProjectionReceiptV1 = z.infer<
  typeof ProductCompilationProjectionReceiptV1Schema
>;

export type ProductCompilationAttemptWorkspaceV1 = Readonly<{
  repo: string;
  root: string;
  raw: string;
  request: string;
  download: string;
  render: string;
  selection: string;
  promptPath: string;
  requestPath: string;
  artifactManifestPath: string;
}>;

export type ProductCompilationAttemptWriteReceiptV1 = Readonly<{
  path: string;
  contentHash: string;
  byteLength: number;
  created: boolean;
}>;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function workspaceError(code: string, detail?: string): Error {
  return new Error(detail ? `${code}: ${detail}` : code);
}

async function statOrUndefined(target: string) {
  try {
    return await lstat(target);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return undefined;
    throw error;
  }
}

function isWithin(root: string, target: string): boolean {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

async function requireSafeRoot(rootInput: string): Promise<{ lexical: string; real: string }> {
  const lexical = path.resolve(rootInput);
  const stat = await statOrUndefined(lexical);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    throw workspaceError("PRODUCT_COMPILATION_REPO_ROOT_UNSAFE");
  }
  return { lexical, real: await realpath(lexical) };
}

async function ensureSafeDirectory(
  rootInput: string,
  segments: readonly string[],
): Promise<string> {
  const root = await requireSafeRoot(rootInput);
  let cursor = root.lexical;
  for (const segment of segments) {
    if (!segment || segment === "." || segment === ".." || segment.includes(path.sep)) {
      throw workspaceError("PRODUCT_COMPILATION_PATH_TRAVERSAL");
    }
    cursor = path.join(cursor, segment);
    let stat = await statOrUndefined(cursor);
    if (!stat) {
      try {
        await mkdir(cursor, { mode: 0o700 });
      } catch (error) {
        if (!isNodeError(error, "EEXIST")) throw error;
      }
      stat = await lstat(cursor);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw workspaceError("PRODUCT_COMPILATION_SYMLINK_ESCAPE", cursor);
    }
    const resolved = await realpath(cursor);
    if (!isWithin(root.real, resolved)) {
      throw workspaceError("PRODUCT_COMPILATION_PATH_ESCAPE", cursor);
    }
  }
  return cursor;
}

function validateAttemptLocator(attempt: ProductCompilationAttemptV1): void {
  const expected = `.setfarm/product-compilation-attempts/${attempt.attemptId}`;
  if (attempt.attemptLocator !== expected) {
    throw workspaceError("PRODUCT_COMPILATION_ATTEMPT_LOCATOR_MISMATCH");
  }
}

export async function prepareProductCompilationAttemptWorkspaceV1(input: Readonly<{
  repo: string;
  attempt: ProductCompilationAttemptV1;
}>): Promise<ProductCompilationAttemptWorkspaceV1> {
  const attempt = ProductCompilationAttemptV1Schema.parse(input.attempt);
  validateAttemptLocator(attempt);
  const repo = (await requireSafeRoot(input.repo)).lexical;
  const rootSegments = [".setfarm", "product-compilation-attempts", attempt.attemptId];
  const root = await ensureSafeDirectory(repo, rootSegments);
  const areas = Object.fromEntries(await Promise.all(
    ProductCompilationEvidenceAreaV1Schema.options.map(async (area) => [
      area,
      await ensureSafeDirectory(repo, [...rootSegments, area]),
    ]),
  )) as Record<ProductCompilationEvidenceAreaV1, string>;
  return {
    repo,
    root,
    raw: areas.raw,
    request: areas.request,
    download: areas.download,
    render: areas.render,
    selection: areas.selection,
    promptPath: path.join(areas.request, "prompt.md"),
    requestPath: path.join(areas.request, "request.json"),
    artifactManifestPath: path.join(areas.selection, "artifact-manifest.json"),
  };
}

async function syncDirectory(directory: string): Promise<void> {
  let handle;
  try {
    handle = await open(directory, "r");
    await handle.sync();
  } catch (error) {
    if (
      !isNodeError(error, "EINVAL")
      && !isNodeError(error, "ENOTSUP")
      && !isNodeError(error, "EPERM")
      && !isNodeError(error, "EISDIR")
    ) {
      throw error;
    }
  } finally {
    await handle?.close();
  }
}

async function verifyImmutableTarget(target: string, expected: Buffer): Promise<boolean> {
  const stat = await statOrUndefined(target);
  if (!stat) return false;
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw workspaceError("PRODUCT_COMPILATION_SYMLINK_ESCAPE", target);
  }
  const observed = await readFile(target);
  if (!observed.equals(expected)) {
    throw workspaceError("PRODUCT_COMPILATION_ATTEMPT_ARTIFACT_IMMUTABLE", target);
  }
  return true;
}

async function publishImmutable(target: string, bytes: Buffer): Promise<boolean> {
  if (await verifyImmutableTarget(target, bytes)) return false;
  const directory = path.dirname(target);
  const temp = path.join(directory, `.${path.basename(target)}.${process.pid}.${randomUUID()}.tmp`);
  let handle;
  let created = false;
  try {
    handle = await open(temp, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    try {
      await link(temp, target);
      created = true;
    } catch (error) {
      if (!isNodeError(error, "EEXIST")) throw error;
      await verifyImmutableTarget(target, bytes);
    }
    await syncDirectory(directory);
    return created;
  } finally {
    await handle?.close();
    try {
      await unlink(temp);
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) throw error;
    }
  }
}

function locatorSegments(locator: string): string[] {
  return NormalizedRelativeLocatorSchema.parse(locator).split("/");
}

async function artifactTarget(input: Readonly<{
  repo: string;
  attempt: ProductCompilationAttemptV1;
  area: ProductCompilationEvidenceAreaV1;
  locator: string;
}>): Promise<string> {
  const workspace = await prepareProductCompilationAttemptWorkspaceV1(input);
  const segments = locatorSegments(input.locator);
  const directorySegments = segments.slice(0, -1);
  const areaRoot = workspace[input.area];
  const directory = directorySegments.length > 0
    ? await ensureSafeDirectory(areaRoot, directorySegments)
    : areaRoot;
  const target = path.join(directory, segments.at(-1)!);
  if (!isWithin(areaRoot, target)) {
    throw workspaceError("PRODUCT_COMPILATION_PATH_ESCAPE");
  }
  return target;
}

export async function writeProductCompilationAttemptEvidenceV1(input: Readonly<{
  repo: string;
  attempt: ProductCompilationAttemptV1;
  area: ProductCompilationEvidenceAreaV1;
  locator: string;
  content: string | Uint8Array;
  expectedHash?: string;
}>): Promise<ProductCompilationAttemptWriteReceiptV1> {
  const attempt = ProductCompilationAttemptV1Schema.parse(input.attempt);
  const area = ProductCompilationEvidenceAreaV1Schema.parse(input.area);
  const bytes = typeof input.content === "string"
    ? Buffer.from(input.content, "utf8")
    : Buffer.from(input.content);
  const contentHash = sha256(bytes);
  if (input.expectedHash && Sha256Schema.parse(input.expectedHash) !== contentHash) {
    throw workspaceError("PRODUCT_COMPILATION_ARTIFACT_HASH_MISMATCH");
  }
  const target = await artifactTarget({
    repo: input.repo,
    attempt,
    area,
    locator: input.locator,
  });
  const created = await publishImmutable(target, bytes);
  return { path: target, contentHash, byteLength: bytes.length, created };
}

export async function writeProductCompilationPromptV1(input: Readonly<{
  repo: string;
  attempt: ProductCompilationAttemptV1;
  prompt: string;
}>): Promise<ProductCompilationAttemptWriteReceiptV1> {
  const prompt = String(input.prompt).replace(/\r\n?/g, "\n").trimEnd();
  if (!prompt) throw workspaceError("PRODUCT_COMPILATION_PROMPT_EMPTY");
  return writeProductCompilationAttemptEvidenceV1({
    repo: input.repo,
    attempt: input.attempt,
    area: "request",
    locator: "prompt.md",
    content: `${prompt}\n`,
  });
}

export async function writeProductCompilationRequestV1(input: Readonly<{
  repo: string;
  attempt: ProductCompilationAttemptV1;
  request: unknown;
}>): Promise<ProductCompilationAttemptWriteReceiptV1> {
  const attempt = ProductCompilationAttemptV1Schema.parse(input.attempt);
  const bytes = canonicalJsonBytes(input.request);
  const requestHash = sha256(bytes);
  if (requestHash !== attempt.requestHash) {
    throw workspaceError("PRODUCT_COMPILATION_REQUEST_HASH_MISMATCH");
  }
  return writeProductCompilationAttemptEvidenceV1({
    repo: input.repo,
    attempt,
    area: "request",
    locator: "request.json",
    content: bytes,
    expectedHash: requestHash,
  });
}

function expectedAcceptedOutputSealHash(attempt: ProductCompilationAttemptV1): string {
  return hashCanonicalJson({
    schema: "setfarm.product-compilation-output-seal.v1",
    attemptRef: attempt.attemptId,
    disposition: "accepted",
    outputRefs: attempt.outputRefs,
  });
}

function requireProjectableAttempt(attemptInput: ProductCompilationAttemptV1): ProductCompilationAttemptV1 {
  const attempt = ProductCompilationAttemptV1Schema.parse(attemptInput);
  if (
    attempt.state !== "sealed"
    || attempt.disposition !== "accepted"
    || !attempt.outputRefs
    || !attempt.outputSealHash
  ) {
    throw workspaceError("PRODUCT_COMPILATION_ATTEMPT_NOT_PROJECTABLE");
  }
  if (attempt.outputSealHash !== expectedAcceptedOutputSealHash(attempt)) {
    throw workspaceError("PRODUCT_COMPILATION_OUTPUT_SEAL_HASH_MISMATCH");
  }
  return attempt;
}

function validateManifestAgainstAttempt(
  attempt: ProductCompilationAttemptV1,
  manifestInput: ProductCompilationArtifactManifestV1,
): ProductCompilationArtifactManifestV1 {
  const manifest = ProductCompilationArtifactManifestV1Schema.parse(manifestInput);
  if (
    manifest.attemptId !== attempt.attemptId
    || manifest.outputSealHash !== attempt.outputSealHash
    || canonicalJsonStringify(manifest.outputRefs) !== canonicalJsonStringify(attempt.outputRefs)
  ) {
    throw workspaceError("PRODUCT_COMPILATION_ARTIFACT_MANIFEST_AUTHORITY_MISMATCH");
  }
  const expectedNames = Object.keys(attempt.outputRefs!).sort();
  const declaredNames = manifest.authorityArtifacts.map((artifact) => artifact.outputRef).sort();
  if (canonicalJsonStringify(expectedNames) !== canonicalJsonStringify(declaredNames)) {
    throw workspaceError("PRODUCT_COMPILATION_ARTIFACT_MANIFEST_OUTPUT_REFS_INCOMPLETE");
  }
  for (const artifact of manifest.authorityArtifacts) {
    const expectedHash = attempt.outputRefs![artifact.outputRef];
    if (!expectedHash || artifact.source.contentHash !== expectedHash) {
      throw workspaceError("PRODUCT_COMPILATION_ARTIFACT_MANIFEST_OUTPUT_HASH_MISMATCH");
    }
  }
  return manifest;
}

export function createProductCompilationArtifactManifestV1(input: Readonly<{
  attempt: ProductCompilationAttemptV1;
  authorityArtifacts: readonly z.input<typeof ProductCompilationAuthorityArtifactV1Schema>[];
  projectionArtifacts: readonly z.input<typeof ProductCompilationProjectionArtifactV1Schema>[];
}>): ProductCompilationArtifactManifestV1 {
  const attempt = requireProjectableAttempt(input.attempt);
  const payload = ProductCompilationArtifactManifestPayloadV1Schema.parse({
    schema: "setfarm.product-compilation-artifact-manifest.v1",
    attemptId: attempt.attemptId,
    outputSealHash: attempt.outputSealHash,
    outputRefs: attempt.outputRefs,
    authorityArtifacts: input.authorityArtifacts,
    projectionArtifacts: input.projectionArtifacts,
  });
  return validateManifestAgainstAttempt(attempt, ProductCompilationArtifactManifestV1Schema.parse({
    ...payload,
    manifestHash: hashCanonicalJson(payload),
  }));
}

export async function writeProductCompilationArtifactManifestV1(input: Readonly<{
  repo: string;
  attempt: ProductCompilationAttemptV1;
  manifest: ProductCompilationArtifactManifestV1;
}>): Promise<ProductCompilationAttemptWriteReceiptV1> {
  const attempt = requireProjectableAttempt(input.attempt);
  const manifest = validateManifestAgainstAttempt(attempt, input.manifest);
  return writeProductCompilationAttemptEvidenceV1({
    repo: input.repo,
    attempt,
    area: "selection",
    locator: "artifact-manifest.json",
    content: canonicalJsonBytes(manifest),
  });
}

async function readDeclaredArtifact(input: Readonly<{
  repo: string;
  attempt: ProductCompilationAttemptV1;
  artifact: ProductCompilationAttemptArtifactRefV1;
}>): Promise<Buffer> {
  const artifact = ProductCompilationAttemptArtifactRefV1Schema.parse(input.artifact);
  const target = await artifactTarget({
    repo: input.repo,
    attempt: input.attempt,
    area: artifact.area,
    locator: artifact.locator,
  });
  const stat = await statOrUndefined(target);
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw workspaceError("PRODUCT_COMPILATION_ARTIFACT_SOURCE_UNSAFE", target);
  }
  const bytes = await readFile(target);
  if (bytes.length !== artifact.byteLength || sha256(bytes) !== artifact.contentHash) {
    throw workspaceError("PRODUCT_COMPILATION_ARTIFACT_SOURCE_TAMPERED", target);
  }
  return bytes;
}

async function readCanonicalManifest(
  repo: string,
  attempt: ProductCompilationAttemptV1,
): Promise<ProductCompilationArtifactManifestV1> {
  const workspace = await prepareProductCompilationAttemptWorkspaceV1({ repo, attempt });
  const stat = await statOrUndefined(workspace.artifactManifestPath);
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw workspaceError("PRODUCT_COMPILATION_ARTIFACT_MANIFEST_UNAVAILABLE");
  }
  const bytes = await readFile(workspace.artifactManifestPath);
  let decoded: unknown;
  try {
    decoded = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw workspaceError("PRODUCT_COMPILATION_ARTIFACT_MANIFEST_INVALID");
  }
  const manifest = ProductCompilationArtifactManifestV1Schema.parse(decoded);
  if (!bytes.equals(canonicalJsonBytes(manifest))) {
    throw workspaceError("PRODUCT_COMPILATION_ARTIFACT_MANIFEST_NON_CANONICAL");
  }
  return validateManifestAgainstAttempt(attempt, manifest);
}

async function writeProjectionFile(
  projectionRoot: string,
  targetPath: string,
  bytes: Buffer,
): Promise<void> {
  const segments = locatorSegments(targetPath);
  const directory = segments.length > 1
    ? await ensureSafeDirectory(projectionRoot, segments.slice(0, -1))
    : projectionRoot;
  await publishImmutable(path.join(directory, segments.at(-1)!), bytes);
}

async function existingProjectionReceipt(
  stitchPath: string,
): Promise<ProductCompilationProjectionReceiptV1 | undefined> {
  const target = path.join(stitchPath, "PRODUCT_COMPILATION_PROJECTION_RECEIPT.json");
  const stat = await statOrUndefined(target);
  if (!stat) return undefined;
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw workspaceError("PRODUCT_COMPILATION_CANONICAL_PROJECTION_UNSAFE");
  }
  try {
    return ProductCompilationProjectionReceiptV1Schema.parse(
      JSON.parse((await readFile(target)).toString("utf8")),
    );
  } catch {
    throw workspaceError("PRODUCT_COMPILATION_CANONICAL_PROJECTION_RECEIPT_INVALID");
  }
}

export async function projectAcceptedProductCompilationAttemptV1(input: Readonly<{
  repo: string;
  attempt: ProductCompilationAttemptV1;
}>): Promise<ProductCompilationProjectionReceiptV1> {
  const attempt = requireProjectableAttempt(input.attempt);
  const repo = (await requireSafeRoot(input.repo)).lexical;
  const manifest = await readCanonicalManifest(repo, attempt);

  for (const artifact of manifest.authorityArtifacts) {
    await readDeclaredArtifact({ repo, attempt, artifact: artifact.source });
  }
  const projectionSources = await Promise.all(manifest.projectionArtifacts.map(async (artifact) => ({
    declaration: artifact,
    bytes: await readDeclaredArtifact({ repo, attempt, artifact: artifact.source }),
  })));
  const receiptArtifacts = projectionSources
    .map(({ declaration, bytes }) => ({
      path: declaration.targetPath,
      contentHash: sha256(bytes),
      byteLength: bytes.length,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const projectionHash = hashCanonicalJson({
    schema: "setfarm.product-compilation-projection-content.v1",
    attemptId: attempt.attemptId,
    artifacts: receiptArtifacts,
  });
  const receiptPayloadValue = ProductCompilationProjectionReceiptPayloadV1Schema.parse({
    schema: "setfarm.product-compilation-projection-receipt.v1",
    attemptId: attempt.attemptId,
    outputSealHash: attempt.outputSealHash,
    manifestHash: manifest.manifestHash,
    projectionHash,
    artifacts: receiptArtifacts,
  });
  const receipt = ProductCompilationProjectionReceiptV1Schema.parse({
    ...receiptPayloadValue,
    receiptHash: hashCanonicalJson(receiptPayloadValue),
  });

  const stagingRoot = await ensureSafeDirectory(repo, [
    ".setfarm",
    "product-compilation-projection-staging",
  ]);
  const temporaryProjection = path.join(
    stagingRoot,
    `.next-${attempt.attemptId}-${randomUUID()}`,
  );
  await mkdir(temporaryProjection, { mode: 0o700 });
  try {
    for (const source of projectionSources) {
      await writeProjectionFile(
        temporaryProjection,
        source.declaration.targetPath,
        source.bytes,
      );
    }
    await writeProjectionFile(
      temporaryProjection,
      "PRODUCT_COMPILATION_PROJECTION_RECEIPT.json",
      canonicalJsonBytes(receipt),
    );

    const stitchPath = path.join(repo, "stitch");
    const existing = await statOrUndefined(stitchPath);
    if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) {
      throw workspaceError("PRODUCT_COMPILATION_CANONICAL_PROJECTION_UNSAFE");
    }
    if (existing) {
      const currentReceipt = await existingProjectionReceipt(stitchPath);
      if (currentReceipt?.receiptHash === receipt.receiptHash) {
        return receipt;
      }
    }

    const backupPath = path.join(
      stagingRoot,
      `.previous-${attempt.attemptId}-${randomUUID()}`,
    );
    let previousMoved = false;
    try {
      if (existing) {
        await rename(stitchPath, backupPath);
        previousMoved = true;
      }
      await rename(temporaryProjection, stitchPath);
    } catch (error) {
      if (previousMoved && !(await statOrUndefined(stitchPath))) {
        await rename(backupPath, stitchPath);
      }
      throw error;
    }
    return receipt;
  } finally {
    await rm(temporaryProjection, { recursive: true, force: true });
  }
}
