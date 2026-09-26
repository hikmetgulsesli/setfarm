import path from "node:path";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  observeCodeOwnedPositiveWorktreePre32AbsenceAnnotationV2,
  observePositiveWorktreePre32AbsenceAnnotationWithPortsV2,
} from "./baseline-positive-worktree-pre32-absence-annotation-v2.js";

// The V7 producer performs the two held passes. This projection never converts
// bounded absence into nonownership or subtracts an original physical blocker.
const SCHEMA = "setfarm.internal-production-pre32-residual-absence-annotation.v3";
const HOME = /^(\/(?:Users|home)\/[A-Za-z0-9._-]+)(\/.*)$/;
const NAME = "[A-Za-z0-9._-]+";
const RETAINED = new RegExp(`^/ai/setrox/(?:(?:\\.worktrees|setfarm/\\.worktrees|mission-control/\\.worktrees|deployments)/${NAME})$`);
const RUNTIME = new RegExp(`^(?:/projects/${NAME}/\\.worktrees/${NAME}|/\\.openclaw/workspace/agent-scratch/story-worktrees/${NAME}|/\\.openclaw/workspaces/workflows/${NAME}/(?:story-worktrees/${NAME}|agents/${NAME}/story-worktrees/${NAME}))$`);
const WORKFLOW_AGENTS = new RegExp(`^/\\.openclaw/workspaces/workflows/${NAME}/agents$`);
type Source = Awaited<ReturnType<typeof observePositiveWorktreePre32AbsenceAnnotationWithPortsV2>>;
type Blocker = Source["remainingBlockers"][number];

function fail(): never {
  throw new Error("INTERNAL_PRODUCTION_PRE32_RESIDUAL_ABSENCE_ANNOTATION_V3_INVALID");
}

function homeAndSuffix(root: string) {
  const match = HOME.exec(root);
  if (!match || path.posix.normalize(root) !== root || root.split("/").slice(1).some(
    (segment) => segment === "." || segment === "..")) fail();
  return Object.freeze({ home: match[1]!, suffix: match[2]! });
}

function strictOrder<T>(rows: readonly T[], root: (row: T) => string, duplicateAllowed = false) {
  let previous: string | null = null;
  for (const row of rows) {
    const current = root(row);
    if (previous !== null && (Buffer.compare(Buffer.from(previous), Buffer.from(current)) > 0
      || (!duplicateAllowed && previous === current))) fail();
    previous = current;
  }
}

function project(sourceAnnotation: Source) {
  const pair = sourceAnnotation.sourcePair;
  const catalog = pair.heldPair.physicalCatalog;
  if (sourceAnnotation.schema !== "setfarm.internal-production-pre32-absent-git-record-annotation.v2"
    || sourceAnnotation.authority !== "diagnostic-only"
    || sourceAnnotation.physicalIdentityProvenance !== "unverified"
    || pair.schema !== "setfarm.internal-production-pre32-physical-database-pair.v7"
    || pair.authority !== "diagnostic-only"
    || pair.pre32Database.journalIdentity !== "source-ordinal-name-checksum-state-1-through-31"
    || pair.pre32Database.lockState !== "released-at-return"
    || sourceAnnotation.witnessedBlockers.length + sourceAnnotation.remainingBlockers.length
      !== catalog.blockers.length) fail();
  const sourceBody = { schema: sourceAnnotation.schema, authority: sourceAnnotation.authority,
    physicalIdentityProvenance: sourceAnnotation.physicalIdentityProvenance,
    sourcePair: pair, witness: sourceAnnotation.witness,
    witnessedBlockers: sourceAnnotation.witnessedBlockers,
    remainingBlockers: sourceAnnotation.remainingBlockers };
  if (hashCanonicalJson(sourceBody) !== sourceAnnotation.annotationHash) fail();

  strictOrder(catalog.entries, (entry) => entry.root);
  strictOrder(catalog.blockers, (blocker) => blocker.root, true);
  strictOrder(catalog.absentBases, (base) => base);
  strictOrder(catalog.incidentalFiles, (file) => file);

  const entries = new Map<string, typeof catalog.entries[number]>();
  for (const entry of catalog.entries) {
    if (entries.has(entry.root)) fail();
    entries.set(entry.root, entry);
  }
  const candidates = new Set<string>();
  for (const blocker of sourceAnnotation.remainingBlockers) {
    if (blocker.reason !== "non-git-child"
      && blocker.reason !== "absent-workflow-agents-discovery-parent") continue;
    if (candidates.has(blocker.root)) fail();
    candidates.add(blocker.root);
  }
  const boundedAbsenceBlockers: Blocker[] = [];
  const otherResidualBlockers: Blocker[] = [];
  let ownerHome: string | null = null;
  for (const blocker of sourceAnnotation.remainingBlockers) {
    if (blocker.reason === "non-git-child") {
      const entry = entries.get(blocker.root);
      const physical = homeAndSuffix(blocker.root);
      if (ownerHome !== null && ownerHome !== physical.home) fail();
      ownerHome = physical.home;
      const zone = RETAINED.test(physical.suffix) ? "retained-zone"
        : RUNTIME.test(physical.suffix) ? "runtime-zone" : null;
      if (!entry || entry.kind !== "unresolved" || entry.gitPrimaryRoot !== null
        || entry.dirty !== null || entry.sourceBuildProvenance !== "unverified"
        || !Array.isArray(entry.referencingPids) || zone === null || entry.zone !== zone
        || catalog.absentBases.some((base) => blocker.root === base
          || blocker.root.startsWith(`${base}/`))
        || catalog.incidentalFiles.some((file) => file === blocker.root
          || file.startsWith(`${blocker.root}/`))) fail();
      let previousPid = 0;
      for (const pid of entry.referencingPids) {
        if (!Number.isSafeInteger(pid) || pid <= previousPid) fail();
        previousPid = pid;
      }
      if (entry.referencingPids.length === 0) boundedAbsenceBlockers.push(blocker);
      else otherResidualBlockers.push(blocker);
    } else if (blocker.reason === "absent-workflow-agents-discovery-parent") {
      const absent = homeAndSuffix(blocker.root);
      if (ownerHome !== null && ownerHome !== absent.home) fail();
      ownerHome = absent.home;
      if (!WORKFLOW_AGENTS.test(absent.suffix)
        || [...catalog.entries.map((entry) => entry.root), ...catalog.absentBases,
          ...catalog.incidentalFiles, ...catalog.blockers.filter((row) => row !== blocker).map((row) => row.root)]
          .some((root) => root === blocker.root || root.startsWith(`${blocker.root}/`))) fail();
      boundedAbsenceBlockers.push(blocker);
    } else otherResidualBlockers.push(blocker);
  }
  if (boundedAbsenceBlockers.length + otherResidualBlockers.length
    !== sourceAnnotation.remainingBlockers.length) fail();
  const body = Object.freeze({ schema: SCHEMA, authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const,
    temporalScope: "v7-held-two-pass" as const, sourceAnnotation,
    boundedAbsenceBlockers: Object.freeze(boundedAbsenceBlockers),
    otherResidualBlockers: Object.freeze(otherResidualBlockers) });
  return Object.freeze({ ...body, annotationHash: hashCanonicalJson(body) });
}

export async function observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(
  physical: Parameters<typeof observePositiveWorktreePre32AbsenceAnnotationWithPortsV2>[0],
  database: Parameters<typeof observePositiveWorktreePre32AbsenceAnnotationWithPortsV2>[1],
) {
  return project(await observePositiveWorktreePre32AbsenceAnnotationWithPortsV2(physical, database));
}

export async function observeCodeOwnedPositiveWorktreePre32ResidualAbsenceAnnotationV3() {
  if (arguments.length !== 0) fail();
  return project(await observeCodeOwnedPositiveWorktreePre32AbsenceAnnotationV2());
}
