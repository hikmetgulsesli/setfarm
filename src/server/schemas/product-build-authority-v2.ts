import { z } from "zod";

import { SemanticArtifactEnvelopeV1Schema } from "../../product-compiler/artifact-store.js";
import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import { StitchTargetCandidateSelectionFailureV1Schema } from "../../product-compiler/schemas/stitch-target-candidate-selection-failure-v1.js";
import {
  OperationalFailureIdentityV2Schema,
  STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2,
  STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2,
} from "../../execution/schemas/operational-failure-identity-v2.js";
import { ProductBuildAuthorityV1Schema } from "./product-build-authority-v1.js";

const CanonicalRefSchema = z.string()
  .regex(/^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/)
  .max(4_000);

export const StitchTargetCandidateSelectionFailureEnvelopeV1Schema =
  SemanticArtifactEnvelopeV1Schema.extend({
    artifactType: z.literal(STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2),
    payload: StitchTargetCandidateSelectionFailureV1Schema,
  }).strict();

export const ProductBuildRefusalFailureArtifactV2Schema = z.object({
  refKey: z.literal(STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2),
  artifactHash: Sha256Schema,
  envelope: StitchTargetCandidateSelectionFailureEnvelopeV1Schema,
}).strict();

export const ProductBuildRefusalV2Schema = z.object({
  terminationRequestRef: CanonicalRefSchema,
  failureIdentity: OperationalFailureIdentityV2Schema,
  failureArtifact: ProductBuildRefusalFailureArtifactV2Schema,
}).strict();

const SealedProductBuildAuthorityV2Schema = z.object({
  schema: z.literal("setfarm.product-build-authority.v2"),
  runId: z.string().min(1).max(200),
  disposition: z.literal("sealed_packet"),
  packetAuthority: ProductBuildAuthorityV1Schema,
  refusal: z.null(),
  authorityHash: Sha256Schema,
}).strict();

const RefusedProductBuildAuthorityV2Schema = z.object({
  schema: z.literal("setfarm.product-build-authority.v2"),
  runId: z.string().min(1).max(200),
  disposition: z.literal("refused_before_packet"),
  packetAuthority: z.null(),
  refusal: ProductBuildRefusalV2Schema,
  authorityHash: Sha256Schema,
}).strict();

export const ProductBuildAuthorityV2Schema = z.discriminatedUnion("disposition", [
  SealedProductBuildAuthorityV2Schema,
  RefusedProductBuildAuthorityV2Schema,
]).superRefine((value, context) => {
  if (value.disposition === "sealed_packet") {
    if (value.runId !== value.packetAuthority.runId) {
      context.addIssue({
        code: "custom",
        path: ["packetAuthority", "runId"],
        message: "Sealed v2 authority must wrap the exact run packet authority",
      });
    }
  } else {
    const exact = value.refusal.failureIdentity.exactFailure;
    const artifact = value.refusal.failureArtifact;
    const payload = artifact.envelope.payload;
    const expectedArtifactHash = hashCanonicalJson(artifact.envelope);
    if (!exact) {
      context.addIssue({
        code: "custom",
        path: ["refusal", "failureIdentity", "exactFailure"],
        message: "Pre-packet refusal requires an exact immutable design failure identity",
      });
    } else if (
      exact.refKey !== artifact.refKey
      || exact.artifactType !== artifact.envelope.artifactType
      || exact.failureArtifactHash !== artifact.artifactHash
      || exact.failureFingerprint !== payload.fingerprint
      || exact.candidateSelectionHash !== payload.candidateSelectionHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["refusal", "failureArtifact"],
        message: "Refusal artifact must bind the exact failure identity and candidate authority",
      });
    }
    if (artifact.artifactHash !== expectedArtifactHash) {
      context.addIssue({
        code: "custom",
        path: ["refusal", "failureArtifact", "artifactHash"],
        message: "Failure artifact hash must bind the complete canonical semantic envelope",
      });
    }
  }

  const { authorityHash: _authorityHash, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.authorityHash) {
    context.addIssue({
      code: "custom",
      path: ["authorityHash"],
      message: "Authority hash must bind the complete canonical v2 authority",
    });
  }
});

export type StitchTargetCandidateSelectionFailureEnvelopeV1 = z.infer<
  typeof StitchTargetCandidateSelectionFailureEnvelopeV1Schema
>;
export type ProductBuildRefusalFailureArtifactV2 = z.infer<
  typeof ProductBuildRefusalFailureArtifactV2Schema
>;
export type ProductBuildRefusalV2 = z.infer<typeof ProductBuildRefusalV2Schema>;
export type ProductBuildAuthorityV2 = z.infer<typeof ProductBuildAuthorityV2Schema>;
