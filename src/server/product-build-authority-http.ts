import { RuntimeArtifactReaderError } from "../product-compiler/runtime-artifact-reader.js";
import {
  ProductBuildAuthorityV2Error,
  readVersionedProductBuildAuthority,
  type ProductBuildAuthorityReader,
  type VerifiedDesignCandidateRefusalReadOptions,
} from "./product-build-authority.js";
import type { ExactProductBuildAuthorityReader } from "./product-build-authority-v3.js";

export type ProductBuildAuthorityRequestSchema = "v1" | "v2" | "v3";
export type ProductBuildAuthorityHttpResult = Readonly<{ statusCode: number; body: unknown }>;

export class ProductBuildAuthoritySchemaUnsupportedError extends Error {
  readonly code = "PRODUCT_BUILD_AUTHORITY_SCHEMA_UNSUPPORTED";

  constructor() {
    super("Unsupported product build authority schema");
    this.name = "ProductBuildAuthoritySchemaUnsupportedError";
  }
}

/** Negotiate before creating a reader, including for repeated equal values. */
export function resolveProductBuildAuthoritySchema(params: URLSearchParams): ProductBuildAuthorityRequestSchema {
  const values = params.getAll("schema");
  if (values.length === 0) return "v2";
  const value = values[0];
  if (values.length !== 1 || (value !== "v1" && value !== "v2" && value !== "v3")) {
    throw new ProductBuildAuthoritySchemaUnsupportedError();
  }
  return value;
}

/** Unknown failures, including schema validation failures, remain failed requests. */
export function mapProductBuildAuthorityHttpError(
  error: unknown,
  schema: ProductBuildAuthorityRequestSchema,
  runId: string,
): ProductBuildAuthorityHttpResult {
  const errorSchema = `setfarm.product-build-authority-error.${schema}`;
  if (error instanceof ProductBuildAuthoritySchemaUnsupportedError) {
    return { statusCode: 400, body: { schema: errorSchema, runId, code: error.code } };
  }
  if (error instanceof ProductBuildAuthorityV2Error) {
    return { statusCode: 503, body: { schema: errorSchema, runId, code: error.code } };
  }
  if (error instanceof RuntimeArtifactReaderError) {
    const statusCode = error.code === "RUNTIME_PACKET_RUN_NOT_FOUND"
      ? 404
      : ["RUNTIME_PACKET_RUN_NOT_V3", "RUNTIME_PACKET_NOT_ACTIVE", "RUNTIME_PACKET_NOT_TERMINAL", "RUNTIME_PACKET_NOT_SEALED"].includes(error.code)
        ? 409
        : 503;
    return { statusCode, body: { schema: errorSchema, runId, code: error.code } };
  }
  throw error;
}

export async function readProductBuildAuthorityHttp(input: Readonly<{
  query: URLSearchParams;
  runId: string;
  createReadContext: () => Readonly<{
    reader: ProductBuildAuthorityReader & ExactProductBuildAuthorityReader;
    refusalOptions: VerifiedDesignCandidateRefusalReadOptions;
  }>;
}>): Promise<ProductBuildAuthorityHttpResult> {
  // Invalid negotiation has no selected version; retain the default error namespace.
  let schema: ProductBuildAuthorityRequestSchema = "v2";
  try {
    schema = resolveProductBuildAuthoritySchema(input.query);
    const { reader, refusalOptions } = input.createReadContext();
    const context = { reader, refusalOptions, runId: input.runId };
    const body = schema === "v3"
      ? await readVersionedProductBuildAuthority({ ...context, schema: "v3" })
      : await readVersionedProductBuildAuthority({ ...context, schema });
    return { statusCode: 200, body };
  } catch (error) {
    return mapProductBuildAuthorityHttpError(error, schema, input.runId);
  }
}
