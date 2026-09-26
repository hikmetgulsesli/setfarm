import path from "node:path";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  observeCodeOwnedPositiveWorktreePre32ResidualAbsenceAnnotationV3,
  observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3,
} from "./baseline-positive-worktree-pre32-residual-absence-annotation-v3.js";

// V7 is a cold-zero diagnostic. These names classify visibility, never ownership.
const SCHEMA = "setfarm.internal-production-pre32-physical-inventory-coverage.v1";
const NAME = "[A-Za-z0-9._-]+";
const RETAINED = new RegExp(`^/ai/setrox/(?:(?:\\.worktrees|setfarm/\\.worktrees|mission-control/\\.worktrees|deployments)/${NAME})$`);
const RUNTIME = new RegExp(`^(?:/projects/${NAME}/\\.worktrees/${NAME}|/\\.openclaw/workspace/agent-scratch/story-worktrees/${NAME}|/\\.openclaw/workspaces/workflows/${NAME}/(?:story-worktrees/${NAME}|agents/${NAME}/story-worktrees/${NAME}))$`);
type Source = Awaited<ReturnType<typeof observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3>>;

function fail(): never {
  throw new Error("INTERNAL_PRODUCTION_PRE32_PHYSICAL_INVENTORY_COVERAGE_V1_INVALID");
}

function strictlyOrdered(roots: readonly string[]): void {
  for (let index = 1; index < roots.length; index++) {
    if (Buffer.compare(Buffer.from(roots[index - 1]!), Buffer.from(roots[index]!)) >= 0) fail();
  }
}

function canonicalAbsoluteRoot(root: unknown): root is string {
  return typeof root === "string" && root.startsWith("/")
    && path.posix.normalize(root) === root
    && !root.split("/").slice(1).some(part => part === "." || part === "..");
}

function validPhysicalEntry(entry: Source["sourceAnnotation"]["sourcePair"]["heldPair"]["physicalCatalog"]["entries"][number]): boolean {
  const keys = ["root", "zone", "kind", "dev", "ino", "birthtimeNs",
    "gitPrimaryRoot", "dirty", "sourceBuildProvenance", "referencingPids"];
  const actual = Reflect.ownKeys(entry);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key))) return false;
  if (!canonicalAbsoluteRoot(entry.root)
    || (entry.gitPrimaryRoot !== null && !canonicalAbsoluteRoot(entry.gitPrimaryRoot))) return false;
  const home = /^(\/(?:Users|home)\/[A-Za-z0-9._-]+)(\/.*)$/.exec(entry.root);
  if (!home || !(entry.zone === "retained-zone" ? RETAINED : entry.zone === "runtime-zone" ? RUNTIME : null)?.test(home[2]!)) return false;
  if (![entry.dev, entry.ino, entry.birthtimeNs].every(value => typeof value === "string" && /^[1-9][0-9]*$/.test(value))) return false;
  if (entry.kind === "unresolved") return entry.dirty === null;
  if (entry.kind !== "linked-git" && entry.kind !== "primary-git") return false;
  const workspace = `${home[1]}/ai/setrox`;
  if (entry.zone === "retained-zone" && entry.gitPrimaryRoot !== null
    && !([`${workspace}/setfarm`, `${workspace}/mission-control`].includes(entry.gitPrimaryRoot)
      || [`${workspace}/.worktrees/`, `${workspace}/deployments/`]
        .some(prefix => entry.gitPrimaryRoot!.startsWith(prefix)))) return false;
  return entry.gitPrimaryRoot !== null && typeof entry.dirty === "boolean"
    && (entry.kind === "primary-git" ? entry.gitPrimaryRoot === entry.root : entry.gitPrimaryRoot !== entry.root);
}

function project(sourceAnnotation: Source) {
  const annotation = sourceAnnotation.sourceAnnotation;
  const pair = annotation.sourcePair;
  const held = pair.heldPair;
  const catalog = held.physicalCatalog;
  const database = pair.pre32Database;
  if (sourceAnnotation.schema !== "setfarm.internal-production-pre32-residual-absence-annotation.v3"
    || sourceAnnotation.authority !== "diagnostic-only"
    || sourceAnnotation.physicalIdentityProvenance !== "unverified"
    || sourceAnnotation.temporalScope !== "v7-held-two-pass"
    || annotation.schema !== "setfarm.internal-production-pre32-absent-git-record-annotation.v2"
    || annotation.authority !== "diagnostic-only"
    || annotation.physicalIdentityProvenance !== "unverified"
    || pair.schema !== "setfarm.internal-production-pre32-physical-database-pair.v7"
    || pair.authority !== "diagnostic-only" || pair.physicalIdentityProvenance !== "unverified"
    || database.schema !== "setfarm.internal-production-pre32-active-binding-snapshot.v7"
    || database.authority !== "diagnostic-only"
    || database.journalIdentity !== "source-ordinal-name-checksum-state-1-through-31"
    || database.lockState !== "released-at-return"
    || held.schema !== "setfarm.internal-production-positive-worktree-host-pair.v2"
    || held.authority !== "diagnostic-only" || held.physicalIdentityProvenance !== "unverified"
    || catalog.schema !== "setfarm.internal-production-positive-worktree-physical-catalog.v2"
    || !Object.isFrozen(sourceAnnotation) || !Object.isFrozen(annotation)
    || !Object.isFrozen(pair) || !Object.isFrozen(held) || !Object.isFrozen(catalog)
    || !Object.isFrozen(catalog.entries) || !Object.isFrozen(catalog.blockers)) fail();
  const { annotationHash: sourceHash, ...sourceBody } = sourceAnnotation;
  const { annotationHash, ...annotationBody } = annotation;
  const { pairHash, ...pairBody } = pair;
  const { pairHash: heldHash, ...heldBody } = held;
  const { catalogHash, ...catalogBody } = catalog;
  if (hashCanonicalJson(sourceBody) !== sourceHash
    || hashCanonicalJson(annotationBody) !== annotationHash
    || hashCanonicalJson(pairBody) !== pairHash
    || hashCanonicalJson(heldBody) !== heldHash
    || hashCanonicalJson(catalogBody) !== catalogHash) fail();
  const census = database.legacyCensus;
  const censusCounts = ["activeRunCount", "openClaimCount", "executionAttemptCount",
    "activeRuntimeSessionCount", "activeCompletionOwnerCount", "unsettledMandatoryEffectCount",
    "artifactReservationCount", "publicationBatchCount", "artifactPublicationCount",
    "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount"] as const;
  if (censusCounts.some(key => census[key] !== 0)
    || Object.values(database.activeRows.counts).some(count => count !== 0)
    || database.bindingRows.counts.attemptCount !== 0
    || database.bindingRows.counts.sessionCount !== 0
    || database.bindingRows.activeAttempts.length !== 0
    || database.bindingRows.activeSessions.length !== 0) fail();

  const roots = catalog.entries.map(entry => entry.root);
  strictlyOrdered(roots);
  const blockedRoots = new Set(catalog.blockers.map(blocker => blocker.root));
  const retainedGitTopologyRoots: string[] = [];
  const unresolvedPresentRoots: string[] = [];
  for (const entry of catalog.entries) {
    if (!validPhysicalEntry(entry) || entry.sourceBuildProvenance !== "unverified" || !Object.isFrozen(entry)
      || !Object.isFrozen(entry.referencingPids)) fail();
    let previousPid = 0;
    for (const pid of entry.referencingPids) {
      if (!Number.isSafeInteger(pid) || pid <= previousPid) fail();
      previousPid = pid;
    }
    const topologyOnly = entry.zone === "retained-zone"
      && (entry.kind === "linked-git" || entry.kind === "primary-git")
      && entry.gitPrimaryRoot !== null && entry.referencingPids.length === 0
      && !blockedRoots.has(entry.root);
    (topologyOnly ? retainedGitTopologyRoots : unresolvedPresentRoots).push(entry.root);
  }
  strictlyOrdered(retainedGitTopologyRoots);
  strictlyOrdered(unresolvedPresentRoots);
  if (retainedGitTopologyRoots.length + unresolvedPresentRoots.length !== roots.length) fail();
  const body = Object.freeze({ schema: SCHEMA, authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const,
    temporalScope: "v7-held-two-pass" as const, sourceAnnotation,
    retainedGitTopologyRoots: Object.freeze(retainedGitTopologyRoots),
    unresolvedPresentRoots: Object.freeze(unresolvedPresentRoots) });
  return Object.freeze({ ...body, coverageHash: hashCanonicalJson(body) });
}

export async function observePositiveWorktreePre32PhysicalInventoryCoverageWithPortsV1(
  physical: Parameters<typeof observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3>[0],
  database: Parameters<typeof observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3>[1],
) {
  return project(await observePositiveWorktreePre32ResidualAbsenceAnnotationWithPortsV3(physical, database));
}

export async function observeCodeOwnedPositiveWorktreePre32PhysicalInventoryCoverageV1() {
  if (arguments.length !== 0) fail();
  return project(await observeCodeOwnedPositiveWorktreePre32ResidualAbsenceAnnotationV3());
}
