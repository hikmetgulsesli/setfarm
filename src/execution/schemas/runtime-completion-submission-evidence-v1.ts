import { z } from "zod";

/**
 * Immutable compiler receipt bound to one canonical native-v3 implementation
 * proposal. It is operational evidence, never a mutable completion result.
 */
export const RuntimeCompletionSubmissionEvidenceV1Schema = z.object({
  schema: z.literal("setfarm.runtime-completion-submission-evidence.v1"),
  compiler: z.literal("setfarm.v3-implementation-output-compilation.v1"),
  sourceSchema: z.enum([
    "setfarm.v3-implementation-agent-proposal.v1",
    "setfarm.v3-implementation-agent-output.v1",
  ]),
  sourceProposalHash: z.string().regex(/^[a-f0-9]{64}$/),
  canonicalOutputHash: z.string().regex(/^[a-f0-9]{64}$/),
  ignoredFieldPaths: z.array(z.string().min(1).max(2_000)).max(20_000),
}).strict().superRefine((value, context) => {
  const paths = value.ignoredFieldPaths;
  const canonical = [...new Set(paths)].sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")));
  if (
    paths.length !== canonical.length
    || paths.some((path, index) => path !== canonical[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["ignoredFieldPaths"],
      message: "Ignored field paths must be unique and canonically sorted",
    });
  }
  let totalBytes = 0;
  paths.forEach((path, index) => {
    totalBytes += Buffer.byteLength(path, "utf8");
    if (!/^\/(?:[^~/]|~[01])*(?:\/(?:[^~/]|~[01])*)*$/.test(path)) {
      context.addIssue({
        code: "custom",
        path: ["ignoredFieldPaths", index],
        message: "Ignored field path must be a valid non-root JSON Pointer",
      });
    }
  });
  if (totalBytes > 128 * 1024) {
    context.addIssue({
      code: "custom",
      path: ["ignoredFieldPaths"],
      message: "Ignored field paths exceed the aggregate byte capacity",
    });
  }
});

export type RuntimeCompletionSubmissionEvidenceV1 = z.infer<
  typeof RuntimeCompletionSubmissionEvidenceV1Schema
>;
