import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  GitObjectHashSchema,
  NormalizedRelativeLocatorSchema,
  Sha256Schema,
} from "../product-compiler/schemas/common-v1.js";
import {
  createGithubReviewResolutionEvidenceV1,
  GithubReviewResolutionObservationAuthorityV1Schema,
  type GithubReviewResolutionEvidenceV1,
  type GithubReviewResolutionObservationAuthorityV1,
} from "./github-review-resolution-evidence.js";

const execFileAsync = promisify(execFile);
const TimestampSchema = z.string().datetime({ offset: true });

const GithubReviewCommentEvidenceV1Schema = z.object({
  commentId: z.string().min(1).max(500),
  author: z.string().min(1).max(500),
  body: z.string().max(100_000),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema.optional(),
}).strict();

const GithubReviewThreadEvidenceCoreV1Schema = z.object({
  schema: z.literal("setfarm.github-review-thread-evidence.v1"),
  repository: z.object({
    nodeId: z.string().min(1).max(500),
    owner: z.string().min(1).max(500),
    name: z.string().min(1).max(500),
  }).strict(),
  prNumber: z.number().int().positive(),
  prState: z.enum(["OPEN", "CLOSED", "MERGED"]),
  headSha: GitObjectHashSchema,
  threadId: z.string().min(1).max(500),
  path: NormalizedRelativeLocatorSchema,
  line: z.number().int().positive().optional(),
  startLine: z.number().int().positive().optional(),
  comments: z.array(GithubReviewCommentEvidenceV1Schema).min(1).max(100),
  bodyRevisionHash: Sha256Schema,
  currentSource: z.object({
    contentHash: Sha256Schema,
    byteLength: z.number().int().nonnegative().max(16 * 1024 * 1024),
  }).strict(),
  evidenceHash: Sha256Schema,
}).strict();

export type GithubReviewThreadEvidenceV1 = z.infer<typeof GithubReviewThreadEvidenceCoreV1Schema>;

function withoutEvidenceHash(
  value: GithubReviewThreadEvidenceV1,
): Omit<GithubReviewThreadEvidenceV1, "evidenceHash"> {
  const { evidenceHash: _evidenceHash, ...identity } = value;
  return identity;
}

export const GithubReviewThreadEvidenceV1Schema = GithubReviewThreadEvidenceCoreV1Schema
  .superRefine((value, context) => {
    const bodyRevisionHash = hashCanonicalJson({
      schema: "setfarm.github-review-thread-body-revision.v1",
      threadId: value.threadId,
      comments: value.comments,
    });
    if (value.bodyRevisionHash !== bodyRevisionHash) {
      context.addIssue({
        code: "custom",
        path: ["bodyRevisionHash"],
        message: "Body revision hash must bind the exact thread conversation",
      });
    }
    if (value.evidenceHash !== hashCanonicalJson(withoutEvidenceHash(value))) {
      context.addIssue({
        code: "custom",
        path: ["evidenceHash"],
        message: "Evidence hash must bind exact GitHub and source metadata",
      });
    }
  });

const GraphqlCommentSchema = z.object({
  id: z.string().min(1).max(500),
  body: z.string(),
  author: z.object({ login: z.string().min(1).max(500) }).nullable(),
  createdAt: TimestampSchema,
  lastEditedAt: TimestampSchema.nullable().optional(),
}).passthrough();

const GraphqlThreadSchema = z.object({
  id: z.string().min(1).max(500),
  isResolved: z.boolean(),
  isOutdated: z.boolean(),
  path: z.string().min(1),
  line: z.number().int().positive().nullable(),
  startLine: z.number().int().positive().nullable(),
  comments: z.object({
    nodes: z.array(GraphqlCommentSchema),
    pageInfo: z.object({ hasNextPage: z.boolean() }).strict(),
  }).strict(),
}).strict();

const GraphqlPageSchema = z.object({
  data: z.object({
    repository: z.object({
      id: z.string().min(1).max(500),
      pullRequest: z.object({
        number: z.number().int().positive(),
        state: z.enum(["OPEN", "CLOSED", "MERGED"]),
        headRefOid: GitObjectHashSchema,
        reviewThreads: z.object({
          nodes: z.array(GraphqlThreadSchema),
          pageInfo: z.object({
            hasNextPage: z.boolean(),
            endCursor: z.string().nullable(),
          }).strict(),
        }).strict(),
      }).nullable(),
    }).nullable(),
  }).strict(),
  errors: z.array(z.unknown()).optional(),
}).strict();

export type GithubReviewSourcePort = Readonly<{
  fetchPage(input: Readonly<{
    owner: string;
    name: string;
    prNumber: number;
    after?: string;
  }>): Promise<unknown>;
  readSource(input: Readonly<{
    repositoryPath: string;
    headSha: string;
    path: string;
  }>): Promise<Buffer>;
}>;

export type GithubReviewSourceErrorCode =
  | "GITHUB_REVIEW_PR_URL_INVALID"
  | "GITHUB_REVIEW_PR_NOT_FOUND"
  | "GITHUB_REVIEW_GRAPHQL_INCOMPLETE"
  | "GITHUB_REVIEW_HEAD_CHANGED_DURING_FETCH"
  | "GITHUB_REVIEW_RESOLUTION_IDENTITY_MISMATCH"
  | "GITHUB_REVIEW_RESOLUTION_STALE_HEAD"
  | "GITHUB_REVIEW_RESOLUTION_THREAD_MISSING"
  | "GITHUB_REVIEW_RESOLUTION_THREAD_UNRESOLVED"
  | "GITHUB_REVIEW_SOURCE_TOO_LARGE";

export class GithubReviewSourceError extends Error {
  readonly code: GithubReviewSourceErrorCode;

  constructor(code: GithubReviewSourceErrorCode, message: string) {
    super(message);
    this.name = "GithubReviewSourceError";
    this.code = code;
  }
}

export function parseGithubPullRequestUrl(value: string): Readonly<{
  owner: string;
  name: string;
  prNumber: number;
}> {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/([1-9][0-9]*)\/?$/.exec(value.trim());
  if (!match) {
    throw new GithubReviewSourceError("GITHUB_REVIEW_PR_URL_INVALID", "A full canonical GitHub PR URL is required");
  }
  return { owner: match[1]!, name: match[2]!, prNumber: Number(match[3]!) };
}

function createEvidence(input: Omit<GithubReviewThreadEvidenceV1, "schema" | "bodyRevisionHash" | "evidenceHash">) {
  const bodyRevisionHash = hashCanonicalJson({
    schema: "setfarm.github-review-thread-body-revision.v1",
    threadId: input.threadId,
    comments: input.comments,
  });
  const withoutHash = {
    schema: "setfarm.github-review-thread-evidence.v1" as const,
    ...input,
    bodyRevisionHash,
  };
  return GithubReviewThreadEvidenceV1Schema.parse({
    ...withoutHash,
    evidenceHash: hashCanonicalJson(withoutHash),
  });
}

type GithubReviewSnapshot = Readonly<{
  repositoryNodeId: string;
  prNumber: number;
  prState: "OPEN" | "CLOSED" | "MERGED";
  headSha: string;
  threads: readonly z.infer<typeof GraphqlThreadSchema>[];
}>;

async function fetchReviewSnapshot(
  port: GithubReviewSourcePort,
  parsed: Readonly<{ owner: string; name: string; prNumber: number }>,
): Promise<GithubReviewSnapshot> {
  let after: string | undefined;
  let repositoryNodeId: string | undefined;
  let headSha: string | undefined;
  let prState: "OPEN" | "CLOSED" | "MERGED" | undefined;
  const threads = new Map<string, z.infer<typeof GraphqlThreadSchema>>();
  const cursors = new Set<string>();
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const page = GraphqlPageSchema.parse(await port.fetchPage({ ...parsed, ...(after ? { after } : {}) }));
    if (page.errors?.length) {
      throw new GithubReviewSourceError("GITHUB_REVIEW_GRAPHQL_INCOMPLETE", "GitHub returned GraphQL errors");
    }
    const repository = page.data.repository;
    const pullRequest = repository?.pullRequest;
    if (!repository || !pullRequest || pullRequest.number !== parsed.prNumber) {
      throw new GithubReviewSourceError("GITHUB_REVIEW_PR_NOT_FOUND", "GitHub PR identity was not found");
    }
    if (
      (repositoryNodeId && repositoryNodeId !== repository.id)
      || (headSha && headSha !== pullRequest.headRefOid)
      || (prState && prState !== pullRequest.state)
    ) {
      throw new GithubReviewSourceError(
        "GITHUB_REVIEW_HEAD_CHANGED_DURING_FETCH",
        "GitHub PR identity changed while review pages were read",
      );
    }
    repositoryNodeId = repository.id;
    headSha = pullRequest.headRefOid;
    prState = pullRequest.state;
    for (const thread of pullRequest.reviewThreads.nodes) {
      if (thread.comments.pageInfo.hasNextPage || threads.has(thread.id)) {
        throw new GithubReviewSourceError(
          "GITHUB_REVIEW_GRAPHQL_INCOMPLETE",
          `Thread ${thread.id} is incomplete or duplicated across review pages`,
        );
      }
      threads.set(thread.id, thread);
    }
    const pageInfo = pullRequest.reviewThreads.pageInfo;
    if (!pageInfo.hasNextPage) {
      return {
        repositoryNodeId: repositoryNodeId!,
        prNumber: parsed.prNumber,
        prState: prState!,
        headSha: headSha!,
        threads: [...threads.values()].sort((left, right) => left.id.localeCompare(right.id)),
      };
    }
    if (!pageInfo.endCursor || cursors.has(pageInfo.endCursor)) {
      throw new GithubReviewSourceError(
        "GITHUB_REVIEW_GRAPHQL_INCOMPLETE",
        "GitHub review pagination omitted or repeated its continuation cursor",
      );
    }
    cursors.add(pageInfo.endCursor);
    after = pageInfo.endCursor;
  }
  throw new GithubReviewSourceError(
    "GITHUB_REVIEW_GRAPHQL_INCOMPLETE",
    "GitHub review pagination exceeded the bounded page count",
  );
}

export function createGithubReviewSource(port: GithubReviewSourcePort) {
  return Object.freeze({
    async read(input: Readonly<{
      prUrl: string;
      repositoryPath: string;
    }>): Promise<Readonly<{
      repositoryNodeId: string;
      prNumber: number;
      prState: "OPEN" | "CLOSED" | "MERGED";
      headSha: string;
      actionableThreads: readonly GithubReviewThreadEvidenceV1[];
    }>> {
      const parsed = parseGithubPullRequestUrl(input.prUrl);
      const snapshot = await fetchReviewSnapshot(port, parsed);
      const currentThreads = snapshot.threads.filter((thread) => !thread.isResolved && !thread.isOutdated);

      const sourceCache = new Map<string, Buffer>();
      const actionableThreads: GithubReviewThreadEvidenceV1[] = [];
      for (const thread of currentThreads.sort((left, right) => left.id.localeCompare(right.id))) {
        const normalizedPath = NormalizedRelativeLocatorSchema.parse(thread.path);
        let bytes = sourceCache.get(normalizedPath);
        if (!bytes) {
          bytes = await port.readSource({
            repositoryPath: input.repositoryPath,
            headSha: snapshot.headSha,
            path: normalizedPath,
          });
          if (bytes.byteLength > 16 * 1024 * 1024) {
            throw new GithubReviewSourceError(
              "GITHUB_REVIEW_SOURCE_TOO_LARGE",
              `Review source ${normalizedPath} exceeds 16 MiB`,
            );
          }
          sourceCache.set(normalizedPath, bytes);
        }
        const comments = thread.comments.nodes.map((comment) => ({
          commentId: comment.id,
          author: comment.author?.login ?? "ghost",
          body: comment.body,
          createdAt: comment.createdAt,
          ...(comment.lastEditedAt ? { updatedAt: comment.lastEditedAt } : {}),
        }));
        if (comments.length === 0) {
          throw new GithubReviewSourceError(
            "GITHUB_REVIEW_GRAPHQL_INCOMPLETE",
            `Current thread ${thread.id} has no comment evidence`,
          );
        }
        actionableThreads.push(createEvidence({
          repository: {
            nodeId: snapshot.repositoryNodeId,
            owner: parsed.owner,
            name: parsed.name,
          },
          prNumber: parsed.prNumber,
          prState: snapshot.prState,
          headSha: snapshot.headSha,
          threadId: thread.id,
          path: normalizedPath,
          ...(thread.line ? { line: thread.line } : {}),
          ...(thread.startLine ? { startLine: thread.startLine } : {}),
          comments,
          currentSource: {
            contentHash: createHash("sha256").update(bytes).digest("hex"),
            byteLength: bytes.byteLength,
          },
        }));
      }
      return {
        repositoryNodeId: snapshot.repositoryNodeId,
        prNumber: parsed.prNumber,
        prState: snapshot.prState,
        headSha: snapshot.headSha,
        actionableThreads,
      };
    },

    async readResolution(input: Readonly<{
      authority: GithubReviewResolutionObservationAuthorityV1;
    }>): Promise<GithubReviewResolutionEvidenceV1> {
      const authority = GithubReviewResolutionObservationAuthorityV1Schema.parse(input.authority);
      const snapshot = await fetchReviewSnapshot(port, {
        owner: authority.repository.owner,
        name: authority.repository.name,
        prNumber: authority.prNumber,
      });
      if (
        snapshot.repositoryNodeId !== authority.repository.nodeId
        || snapshot.prNumber !== authority.prNumber
      ) {
        throw new GithubReviewSourceError(
          "GITHUB_REVIEW_RESOLUTION_IDENTITY_MISMATCH",
          "Observed GitHub repository or pull request differs from resolution authority",
        );
      }
      if (snapshot.headSha !== authority.observedHeadSha) {
        throw new GithubReviewSourceError(
          "GITHUB_REVIEW_RESOLUTION_STALE_HEAD",
          "Observed GitHub head differs from the terminal recovery attempt source",
        );
      }
      const observedByThread = new Map(snapshot.threads.map((thread) => [thread.id, thread]));
      const threads = authority.threads.map((expected) => {
        const observed = observedByThread.get(expected.threadId);
        if (!observed) {
          throw new GithubReviewSourceError(
            "GITHUB_REVIEW_RESOLUTION_THREAD_MISSING",
            `Originally actionable thread ${expected.threadId} is missing from complete GitHub evidence`,
          );
        }
        if (!observed.isResolved && !observed.isOutdated) {
          throw new GithubReviewSourceError(
            "GITHUB_REVIEW_RESOLUTION_THREAD_UNRESOLVED",
            `Originally actionable thread ${expected.threadId} remains unresolved and current`,
          );
        }
        return {
          ...expected,
          status: observed.isResolved ? "RESOLVED" as const : "OUTDATED" as const,
        };
      });
      const { schema: _schema, ...identity } = authority;
      return createGithubReviewResolutionEvidenceV1({
        ...identity,
        prState: snapshot.prState,
        threads,
      });
    },
  });
}

const REVIEW_THREADS_QUERY = `query($owner:String!,$name:String!,$number:Int!,$after:String){
  repository(owner:$owner,name:$name){
    id
    pullRequest(number:$number){
      number state headRefOid
      reviewThreads(first:100,after:$after){
        pageInfo{hasNextPage endCursor}
        nodes{
          id isResolved isOutdated path line startLine
          comments(first:100){
            pageInfo{hasNextPage}
            nodes{id body author{login} createdAt lastEditedAt}
          }
        }
      }
    }
  }
}`;

export function createDefaultGithubReviewSourcePort(): GithubReviewSourcePort {
  return {
    async fetchPage(input) {
      const args = [
        "api",
        "graphql",
        "-f", `owner=${input.owner}`,
        "-f", `name=${input.name}`,
        "-F", `number=${input.prNumber}`,
        "-f", `query=${REVIEW_THREADS_QUERY}`,
      ];
      if (input.after) args.push("-f", `after=${input.after}`);
      const { stdout } = await execFileAsync("gh", args, {
        timeout: 30_000,
        maxBuffer: 16 * 1024 * 1024,
      });
      return JSON.parse(stdout);
    },
    async readSource(input) {
      const { stdout } = await execFileAsync(
        "git",
        ["show", `${input.headSha}:${input.path}`],
        {
          cwd: input.repositoryPath,
          encoding: "buffer",
          timeout: 30_000,
          maxBuffer: 16 * 1024 * 1024 + 1,
        },
      );
      return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
    },
  };
}

let defaultGithubReviewSource: ReturnType<typeof createGithubReviewSource> | undefined;

/**
 * Read the exact current GitHub review-thread state without interpreting prose
 * or mutating GitHub. This is safe for late verify checks after the worker's
 * claim has already been terminalized; actionable evidence is routed on the
 * next exact verify claim.
 */
export function readDefaultGithubReview(input: Readonly<{
  prUrl: string;
  repositoryPath: string;
}>) {
  defaultGithubReviewSource ??= createGithubReviewSource(createDefaultGithubReviewSourcePort());
  return defaultGithubReviewSource.read(input);
}
