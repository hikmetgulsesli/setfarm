import { hashCanonicalJson } from "../canonical-json.js";

export const GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2 =
  "setfarm.generated-source-receipt.v2" as const;

export const STITCH_GENERATED_SOURCE_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.generated-source-contract.v2",
  contractRef: "GENERATOR_STITCH_GENERATED_SOURCE_V2",
  contractVersion: 2,
  receiptArtifactType: GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2,
  indexSchema: "setfarm.stitch-screen-index.v2",
  componentApiSchema: "setfarm.generated-screen-component-api.v1",
  receiptCardinality: "one_per_generated_source_entry",
  semanticIdentityFields: Object.freeze([
    "targetRef",
    "surfaceRefs",
    "physicalControlRefs",
    "actionRefs",
    "actionInputRefs",
    "observableRefs",
    "generatedElementBindings",
  ]),
  requiredAuthority: Object.freeze([
    "componentApiHash",
    "designSourceClosurePayloadHash",
    "generatorImplementationHash",
    "generatorPlatformBundleHash",
    "generatorExecution",
    "generatedSourceArtifactHash",
    "generatedSourceArtifactByteLength",
    "generatedSourceByteLength",
    "generatedSourceContentHash",
    "generatedSourceBundle",
    "semanticIdentityClosureHash",
    "stitchScreenIndexEntryHash",
    "stitchScreenIndexPayloadHash",
    "stitchScreenIndexSourceHash",
    "stitchScreenIndexSourceByteLength",
    "receiptSet.commitmentHash",
  ]),
  elementKeySource: "subject_ref",
} as const);

export const STITCH_GENERATED_SOURCE_CONTRACT_HASH_V2 = hashCanonicalJson(
  STITCH_GENERATED_SOURCE_CONTRACT_V2,
);
