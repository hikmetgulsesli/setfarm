import {assertOwnerRecoveryAccessV1,enterOwnerRecoveryTransactionV1,assertOwnerRecoveryTransactionBeforeCommitV1,assertOwnerRecoveryMutationLiveIfOwnedV1,type OwnerRecoveryAccessV1} from "./v3-owner-recovery-authority-v1.js";
import type postgres from "postgres";
import {execFileSync} from "node:child_process";
import {resolveV3GitRevision} from "../execution/v3-git-revision.js";
import {captureNativeOriginalFileSignatures,ensureNativeEvidenceOnlyWorktree,cleanupNativeEvidenceOnlyWorktree,
  type NativeEvidenceWorktreeCustody} from "../execution/v3-preparation-authority-v2-repository.js";
import {captureV3ImplementationSourceSnapshotsV2} from "../execution/v3-source-snapshot-v2.js";
import {canonicalJsonStringify} from "../product-compiler/canonical-json.js";
import type {NativeImplementationContextV3} from "../execution/v3-native-implementation-attempt.js";

import { getSql } from "../db-pg.js";
import { runImplementEvidenceIfRequested } from "../installer/implement-evidence-runner.js";
import { captureShadowSourceRevision } from "../execution/shadow-attempt-recorder.js";
import {
  loadV3ImplementationAttemptContext,
  reserveV3EvidenceOnlyImplementationAttempt,
} from "../execution/v3-implementation-attempt.js";
import {
  createV3EvidenceOnlyPublication,
  type V3EvidenceOnlyPublicationLeaseV1,
} from "./v3-evidence-only-publication.js";
import type {
  V3EvidenceOnlyLeaseV1,
  V3EvidenceOnlyWorkerDependencies,
} from "./v3-evidence-only-worker.js";

type Sql = postgres.Sql;

type SourceOwnerRow = Readonly<{
  attempt_id: string;
  revision_number: number;
  branch: string | null;
  worktree: string | null;
}>;

export class V3EvidenceOnlyRuntimeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}:${message}`);
    this.name = "V3EvidenceOnlyRuntimeError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new V3EvidenceOnlyRuntimeError(code, message);
}

function publicationLease(lease: V3EvidenceOnlyLeaseV1): V3EvidenceOnlyPublicationLeaseV1 {
  return {
    mode: "fresh_execution",
    runId: lease.runId,
    stepDbId: lease.stepDbId,
    storyDbId: lease.storyDbId,
    storyId: lease.storyId,
    recoveryCaseId: lease.recoveryCaseId,
    revisionId: lease.revisionId,
    dispatchId: lease.dispatchId,
    packetHash: lease.packetHash,
    contractSliceHash: lease.contractSliceHash,
    findingSetHash: lease.findingSetHash,
    sourceRevision: lease.sourceRevision,
    evidencePlan: lease.evidencePlan,
    ...(lease.priorEvidencePlanArtifactHash
      ? { priorEvidencePlanArtifactHash: lease.priorEvidencePlanArtifactHash }
      : {}),
    ownerInstanceId: lease.ownerInstanceId,
    leaseToken: lease.leaseToken,
    leaseExpiresAt: lease.leaseExpiresAt,
  };
}

export async function resolveExactPriorSourceOwner(
  sql: Sql,
  lease: Pick<V3EvidenceOnlyLeaseV1,
    "recoveryCaseId" | "revisionId" | "runId" | "storyId" | "packetHash"
    | "contractSliceHash" | "findingSetHash" | "sourceRevision">,
): Promise<Readonly<{ worktree: string; branch: string }>> {
  const rows = await sql.unsafe<SourceOwnerRow[]>(
    `SELECT attempt.attempt_id, revision.revision_number,
            attempt.branch, attempt.worktree
       FROM recovery_cases recovery_case
       JOIN recovery_case_revisions revision
         ON revision.revision_id = recovery_case.current_revision_id
        AND revision.recovery_case_id = recovery_case.recovery_case_id
       JOIN execution_attempts attempt
         ON attempt.run_id = recovery_case.run_id
        AND attempt.story_id = recovery_case.story_id
      WHERE recovery_case.recovery_case_id = $1
        AND recovery_case.current_revision_id = $2
        AND recovery_case.run_id = $3
        AND recovery_case.story_id = $4
        AND recovery_case.packet_hash = $5
        AND EXISTS (
          SELECT 1 FROM recovery_case_revisions opening_revision
           WHERE opening_revision.recovery_case_id = recovery_case.recovery_case_id
             AND opening_revision.revision_number = 1
             AND opening_revision.parent_revision_id IS NULL
             AND opening_revision.run_id = recovery_case.run_id
             AND opening_revision.story_id = recovery_case.story_id
             AND opening_revision.packet_hash = recovery_case.packet_hash
             AND opening_revision.finding_set_hash = recovery_case.finding_set_hash
             AND opening_revision.finding_ids = recovery_case.finding_ids
             AND opening_revision.contract_slice_hash = recovery_case.slice_hash
             AND opening_revision.source_sha = recovery_case.source_sha
             AND opening_revision.source_tree_hash = recovery_case.source_tree_hash
        )
        AND revision.run_id = recovery_case.run_id
        AND revision.story_id = recovery_case.story_id
        AND revision.packet_hash = recovery_case.packet_hash
        AND revision.contract_slice_hash = $6
        AND revision.finding_set_hash = $7
        AND revision.source_sha = $8
        AND revision.source_tree_hash = $9
        AND attempt.run_id = recovery_case.run_id
        AND attempt.step_id = 'implement'
        AND attempt.story_id = recovery_case.story_id
        AND attempt.packet_hash = recovery_case.packet_hash
        AND attempt.source_after_sha = revision.source_sha
        AND attempt.source_after_tree_hash = revision.source_tree_hash
        AND attempt.disposition NOT IN ('claimed', 'running', 'superseded')
        AND attempt.worktree IS NOT NULL
        AND attempt.branch IS NOT NULL
        AND (
          (revision.revision_number = 1
            AND recovery_case.prior_attempt_refs::jsonb ? attempt.attempt_id)
          OR (revision.revision_number > 1 AND EXISTS (
            SELECT 1
              FROM recovery_case_revisions parent_revision
              JOIN recovery_revision_dispatches prior_dispatch
                ON prior_dispatch.recovery_case_id = parent_revision.recovery_case_id
               AND prior_dispatch.revision_id = parent_revision.revision_id
               AND prior_dispatch.packet_hash = parent_revision.packet_hash
               AND prior_dispatch.contract_slice_hash = parent_revision.contract_slice_hash
               AND prior_dispatch.finding_set_hash = parent_revision.finding_set_hash
               AND prior_dispatch.source_sha = parent_revision.source_sha
               AND prior_dispatch.source_tree_hash = parent_revision.source_tree_hash
              JOIN recovery_dispatch_deliveries prior_delivery
                ON prior_delivery.dispatch_id = prior_dispatch.dispatch_id
               AND prior_delivery.recovery_case_id = recovery_case.recovery_case_id
               AND prior_delivery.revision_id = parent_revision.revision_id
               AND prior_delivery.run_id = recovery_case.run_id
               AND prior_delivery.story_id = recovery_case.story_id
               AND prior_delivery.attempt_id = attempt.attempt_id
               AND prior_delivery.claim_id = attempt.claim_id
             WHERE parent_revision.revision_id = revision.parent_revision_id
               AND parent_revision.recovery_case_id = recovery_case.recovery_case_id
               AND parent_revision.revision_number + 1 = revision.revision_number
               AND parent_revision.run_id = recovery_case.run_id
               AND parent_revision.story_id = recovery_case.story_id
               AND parent_revision.packet_hash = recovery_case.packet_hash
               AND prior_delivery.state = 'failed'
               AND prior_delivery.attempt_count = 1
               AND prior_delivery.terminal_result->>'attemptId' = attempt.attempt_id
               AND attempt.recovery_dispatch_id = prior_dispatch.dispatch_id
               AND attempt.recovery_case_revision_id = parent_revision.revision_id
               AND attempt.source_before_sha = parent_revision.source_sha
               AND attempt.source_before_tree_hash = parent_revision.source_tree_hash
          ))
        )
      ORDER BY attempt.attempt_id
      LIMIT 5001`,
    [
      lease.recoveryCaseId,
      lease.revisionId,
      lease.runId,
      lease.storyId,
      lease.packetHash,
      lease.contractSliceHash,
      lease.findingSetHash,
      lease.sourceRevision.sha,
      lease.sourceRevision.treeHash,
    ],
  );
  if (rows.length === 0) {
    fail(
      "V3_EVIDENCE_ONLY_SOURCE_OWNER_MISSING",
      "current recovery revision has no exact terminal source-owning attempt and worktree",
    );
  }
  if (rows[0]!.revision_number > 1 && rows.length !== 1) {
    fail(
      "V3_EVIDENCE_ONLY_SOURCE_OWNER_AMBIGUOUS",
      "revised evidence-only source has more than one parent dispatch attempt owner",
    );
  }
  const identities = new Map<string, { worktree: string; branch: string }>();
  for (const row of rows) {
    if (!row.worktree || !row.branch) continue;
    identities.set(`${row.worktree}\u0000${row.branch}`, {
      worktree: row.worktree,
      branch: row.branch,
    });
  }
  if (identities.size !== 1) {
    fail(
      "V3_EVIDENCE_ONLY_SOURCE_OWNER_AMBIGUOUS",
      "current recovery case prior attempts disagree on the exact source worktree or branch",
    );
  }
  return [...identities.values()][0]!;
}

/**
 * Production dependency owner for the non-model evidence-only worker.
 * It deliberately exposes no prompt, model session, story mutation, or legacy
 * claim path: the sealed compiler, operational publication transaction, typed
 * evidence runner, and coordinator are the complete execution boundary.
 */
export function createV3EvidenceOnlyRuntimeDependencies(
  sql: Sql = getSql(),
  owner?: OwnerRecoveryAccessV1,
): V3EvidenceOnlyWorkerDependencies {
  if(owner)assertOwnerRecoveryAccessV1(owner);
  const ownerAccess=owner;
  const publication = createV3EvidenceOnlyPublication(sql,ownerAccess);
  const nativeSources=new Map<string,NativeImplementationContextV3>();
  const nativeWorktrees=new Map<string,NativeEvidenceWorktreeCustody>();
  return Object.freeze({
    async loadOrReserveAttempt({ lease }) {
      const packets=await sql.unsafe<Array<{artifact_type:string}>>(
        "SELECT artifact_type FROM semantic_artifacts WHERE artifact_hash=$1",[lease.packetHash]);
      if(packets[0]?.artifact_type==="setfarm.product-build-packet.v3") {
        const custody=await ensureNativeEvidenceOnlyWorktree(sql,publicationLease(lease));
        nativeWorktrees.set(lease.dispatchId,custody);
      }
      if (lease.mode === "fresh_execution") {
        const owner = await resolveExactPriorSourceOwner(sql, lease);
        const compiled = await reserveV3EvidenceOnlyImplementationAttempt({
          lease: publicationLease(lease),
          worktree: owner.worktree,
          branch: owner.branch,
        }, ownerAccess);
        if(compiled.kind==="native-dispatch-ready") nativeSources.set(owner.worktree,compiled);
        return {
          attempt: compiled.attempt,
          workdir: owner.worktree,
          slice: compiled.slice,
          sliceHash: compiled.sliceHash,
          evidencePlan: compiled.evidencePlan,
          evidencePlanArtifactHash: compiled.evidencePlanArtifactHash,
        };
      }

      if (!lease.attemptId) {
        fail("V3_EVIDENCE_ONLY_REPLAY_ATTEMPT_MISSING", "coordinator replay has no terminal attempt identity");
      }
      const compiled = await loadV3ImplementationAttemptContext({
        runId: lease.runId,
        storyId: lease.storyId,
        attemptId: lease.attemptId,
      });
      if (!compiled.attempt.worktree) {
        fail("V3_EVIDENCE_ONLY_REPLAY_WORKTREE_MISSING", "terminal evidence-only attempt has no exact source worktree");
      }
      if(compiled.kind==="native-dispatch-ready") nativeSources.set(compiled.attempt.worktree,compiled);
      return {
        attempt: compiled.attempt,
        workdir: compiled.attempt.worktree,
        slice: compiled.slice,
        sliceHash: compiled.sliceHash,
        evidencePlan: compiled.evidencePlan,
        evidencePlanArtifactHash: compiled.evidencePlanArtifactHash,
      };
    },

    async captureSource(workdir) {
      const compiled=nativeSources.get(workdir);
      if(!compiled) return captureShadowSourceRevision(workdir);
      // The closure map contains only real reserve/reload results. Reproduce
      // that exact native authority before using any semantic readonly input.
      const authenticated=await loadV3ImplementationAttemptContext({runId:compiled.attempt.runId,
        storyId:compiled.attempt.storyId,attemptId:compiled.attempt.attemptId});
      if(authenticated.kind!=="native-dispatch-ready"||!authenticated.evidenceOnly||!compiled.evidenceOnly
        ||authenticated.attempt.worktree!==workdir||authenticated.attempt.branch!==compiled.attempt.branch
        ||authenticated.attempt.generation!==compiled.attempt.generation
        ||authenticated.attempt.fenceToken!==compiled.attempt.fenceToken
        ||authenticated.attempt.claimId!==compiled.attempt.claimId
        ||authenticated.sliceHash!==compiled.sliceHash
        ||authenticated.evidencePlanArtifactHash!==compiled.evidencePlanArtifactHash
        ||canonicalJsonStringify(authenticated.slice)!==canonicalJsonStringify(compiled.slice)
        ||canonicalJsonStringify(authenticated.evidencePlan)!==canonicalJsonStringify(compiled.evidencePlan)
        ||canonicalJsonStringify(authenticated.nativeAuthority)!==canonicalJsonStringify(compiled.nativeAuthority)
        ||canonicalJsonStringify(authenticated.evidenceOnly)!==canonicalJsonStringify(compiled.evidenceOnly)
        ||canonicalJsonStringify(authenticated.sourceBefore)!==canonicalJsonStringify(compiled.sourceBefore))
        fail("V3_EVIDENCE_ONLY_SOURCE_MUTATED","native source context no longer reproduces its owned authority");
      const env:NodeJS.ProcessEnv={...process.env,GIT_NO_REPLACE_OBJECTS:"1",GIT_OPTIONAL_LOCKS:"0",GIT_TERMINAL_PROMPT:"0"};
      for(const key of ["GIT_DIR","GIT_WORK_TREE","GIT_COMMON_DIR","GIT_INDEX_FILE","GIT_OBJECT_DIRECTORY","GIT_ALTERNATE_OBJECT_DIRECTORIES","GIT_NAMESPACE"]) delete env[key];
      const git=(args:string[])=>execFileSync("git",["--no-replace-objects","--literal-pathspecs",...args],
        {cwd:workdir,env,encoding:"utf8",timeout:10_000,maxBuffer:16*1024*1024,stdio:["ignore","pipe","pipe"]});
      const assertCandidate=()=>{
        const actual=resolveV3GitRevision({repo:workdir,requestedRef:"HEAD",expectedSha:authenticated.sourceBefore.sha});
        if(canonicalJsonStringify(actual)!==canonicalJsonStringify(authenticated.sourceBefore))
          fail("V3_EVIDENCE_ONLY_SOURCE_MUTATED","native candidate HEAD/tree changed");
        git(["diff","--cached","--quiet","HEAD","--"]);
        git(["diff","--quiet","HEAD","--"]);
        return actual;
      };
      const source=assertCandidate();
      const index=git(["ls-files","--stage","-z"]);
      // Enumerate the complete immutable tracked tree, independently of index
      // flags. Semantic files include declared absences; all other paths receive
      // local snapshot-check refs only, never a grant or execution input.
      const tree=new Map<string,{mode:string;blob:string}>();
      for(const entry of git(["ls-tree","-r","-z","--full-tree",source.sha,"--"]).split("\0").filter(Boolean)) {
        const match=/^(100644|100755) blob ([a-f0-9]{40}|[a-f0-9]{64})\t([^\0]+)$/.exec(entry);
        if(!match||tree.has(match[3]!))
          fail("V3_EVIDENCE_ONLY_SOURCE_MUTATED","native tracked source requires unique regular blobs");
        tree.set(match[3]!,{mode:match[1]!,blob:match[2]!});
      }
      const indexed=index.split("\0").filter(Boolean);
      const indexedPaths=new Set<string>();
      if(indexed.length!==tree.size||indexed.some(entry=>{
        const match=/^(100644|100755) ([a-f0-9]{40}|[a-f0-9]{64}) 0\t([^\0]+)$/.exec(entry);
        if(!match||indexedPaths.has(match[3]!)) return true;
        indexedPaths.add(match[3]!);
        const pinned=tree.get(match[3]!);
        return !pinned||pinned.mode!==match[1]||pinned.blob!==match[2];
      })) fail("V3_EVIDENCE_ONLY_SOURCE_MUTATED","native index differs from exact pinned tracked tree");
      const files=authenticated.slice.files.map(file=>({pathRef:file.pathRef,path:file.path}));
      const paths=new Set(files.map(file=>file.path));
      const checkRefs=new Set(files.map(file=>file.pathRef));
      let checkId=0;
      for(const trackedPath of tree.keys()) {
        if(paths.has(trackedPath)) continue;
        let pathRef:string;
        do { pathRef=`PATH_NATIVE_CAPTURE_${checkId++}`; } while(checkRefs.has(pathRef));
        checkRefs.add(pathRef);
        paths.add(trackedPath);
        files.push({pathRef,path:trackedPath});
      }
      const pinned=captureNativeOriginalFileSignatures({worktree:workdir,source,files});
      const expected=pinned.map(snapshot=>{
        const {path:_path,...candidate}=snapshot;
        const file=authenticated.slice.files.find(file=>file.pathRef===snapshot.pathRef&&file.path===snapshot.path);
        if(!file) return candidate; // Full-tree check path, never semantic authority.
        const semantic={pathRef:file.pathRef,presence:file.presence,contentHash:file.contentHash};
        if(file.role!=="shared_readonly"||canonicalJsonStringify(candidate)===canonicalJsonStringify(semantic)) return candidate;
        // The native loader already reproduces sealed grant/owner semantics and
        // authentic accepted dependency attempts. Only their exact readonly DATA
        // may differ from the pinned candidate; every other byte stays pinned.
        const dependencies=authenticated.nativeAuthority.dependencyAttempts.filter(dependency=>
          dependency.fileSignatures.some(signature=>signature.pathRef===file.pathRef&&signature.path===file.path));
        const dependency=dependencies[0];
        const signature=dependency?.fileSignatures.find(signature=>signature.pathRef===file.pathRef&&signature.path===file.path);
        const contract=authenticated.slice.dependencyOutputs.find(output=>output.storyId===dependency?.storyId);
        const grants=authenticated.slice.sharedGrants.filter(grant=>grant.toOwnerRef===authenticated.slice.story.ownerRef
          &&grant.pathRefs.includes(file.pathRef)&&grant.permissions.includes("read")&&!grant.permissions.includes("write"));
        if(dependencies.length!==1||!dependency||!signature||!contract||grants.length!==1
          ||signature.presence!=="present"||snapshot.presence!=="present"
          ||canonicalJsonStringify(signature)!==canonicalJsonStringify({path:file.path,...semantic})
          ||canonicalJsonStringify(contract)!==canonicalJsonStringify({storyId:dependency.storyId,
            sliceHash:dependency.sliceHash,outputHash:dependency.outputHash,sourceAfter:dependency.sourceAfter,
            fileSignatures:dependency.fileSignatures})
          ||authenticated.slice.recovery?.expectedSourceDelta.changes.some(change=>change.path===file.path)
          ||git(["ls-files","-z","--",file.path])!==file.path+"\0")
          fail("V3_EVIDENCE_ONLY_SOURCE_MUTATED","native readonly input lacks exact accepted dependency authority");
        return semantic;
      });
      const current=captureV3ImplementationSourceSnapshotsV2({worktree:workdir,files}).snapshots;
      if(canonicalJsonStringify(expected)!==canonicalJsonStringify(current))
        fail("V3_EVIDENCE_ONLY_SOURCE_MUTATED","native candidate or authenticated readonly input regular bytes changed");
      assertCandidate();
      if(git(["ls-files","--stage","-z"])!==index)
        fail("V3_EVIDENCE_ONLY_SOURCE_MUTATED","native candidate index changed during capture");
      return source;
    },

    async executeEvidence({ lease, context }) {
      const result = await runImplementEvidenceIfRequested({
        runId: lease.runId,
        storyId: lease.storyId,
        workdir: context.workdir,
        stackPackId: context.slice.schema === "setfarm.implementation-slice.v2"
          ? context.slice.build.runtimeEvidenceContract?.stackPackId : context.slice.runtimeEvidence?.stackPackId,
        v3: {
          slice: context.slice,
          sliceHash: context.sliceHash,
          attemptId: context.attempt.attemptId,
          sourceRevision: lease.sourceRevision,
        },
      });
      if (!result.canonicalEvidence) {
        fail(
          "V3_EVIDENCE_ONLY_CANONICAL_RESULT_MISSING",
          "typed evidence execution completed without one canonical evidence bundle",
        );
      }
      return result.canonicalEvidence;
    },

    async cleanupNativeTerminalWorktree({lease}) {
      const custody=nativeWorktrees.get(lease.dispatchId);
      if(!custody) return false;
      const removed=await cleanupNativeEvidenceOnlyWorktree(sql,publicationLease(lease),custody);
      nativeWorktrees.delete(lease.dispatchId);
      return removed;
    },

    completeClaim: ({ lease, attempt, diagnostic }) => publication.completeClaim({
      lease: publicationLease(lease),
      attempt,
      diagnostic,
    }),
  });
}
