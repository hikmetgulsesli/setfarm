import { createHash } from "node:crypto";
import { constants, closeSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSql } from "../db-pg.js";
import { assertFreshInstallationOperationalEntryV1 } from "../installation/fresh-installation-entry-v1.js";
import { assertFreshInstallationSelectionUnchangedV1, freshInstallationSelectionV1 } from "../installation/fresh-installation-selection-v1.js";
import { readSelectedFreshExecutionProfileV1 } from "../installation/fresh-installation-v3-profile-v1.js";
import { withSelectedSubscriptionCredentialV1 } from "./subscription-parent-credential-v1.js";
import { startSubscriptionAttemptBrokerV1, type SubscriptionAttemptBrokerV1 } from "./subscription-attempt-broker-v1.js";
import { acquireSubscriptionCodingRuntimeV1, SubscriptionCodingRuntimeStartupErrorV1,
  type SubscriptionCodingRuntimeV1, type SubscriptionCodingRuntimeOwnershipV1 } from "./subscription-coding-runtime-v1.js";
import { launchSubscriptionCodingWorkerV1 } from "./subscription-coding-worker-v1.js";
import { SUBSCRIPTION_CODING_WORKER_PRELOAD_V1 } from "./subscription-coding-worker-preload-v1.js";
import type { SubscriptionCodingWriteGrantV1 } from "./subscription-coding-worker-policy-v1.js";
import { observeProcessIdentity } from "./process-identity.js";
import { createRuntimeSessionRepository, type RecoveryRuntimeLeaseFence } from "./runtime-session-repository.js";
import { ClaimEnvelopeV1Schema, type ClaimEnvelopeV1 } from "./schemas/claim-envelope-v1.js";
import { V3ImplementationContextV1Schema } from "./v3-implementation-handoff.js";
import { V3StageClaimHandoffV1Schema } from "./v3-stage-execution-context.js";
import { deriveSubscriptionCodingRuntimePathsV1, projectSubscriptionCodingRuntimeBindingV1,
  sameSubscriptionRuntimeDataV1, subscriptionRuntimeRefusedV1, type SubscriptionCodingCanonicalAuthorityV1 } from "./subscription-coding-runtime-binding-v1.js";
import { parseSubscriptionRuntimeClosureV1, subscriptionRuntimePreparationHashV1,
  assertSubscriptionRuntimePublishedWorkerV1 } from "./subscription-coding-runtime-binding-v1.js";
import { readSubscriptionRuntimeAttachmentV1, type SubscriptionRuntimeAuthorityV1,
  type SubscriptionRuntimeBindingV1, type SubscriptionRuntimeClosureV1,
  type SubscriptionRuntimeWorkerBindingV1 } from "./subscription-runtime-attachment-v1.js";

export type SelectedSubscriptionCodingRuntimeV1 = Omit<SubscriptionCodingRuntimeV1, "openGate"> & Readonly<{ openGate(): Promise<void> }>;
type ClosedOriginal = Readonly<{ binding: SubscriptionRuntimeBindingV1; authority: SubscriptionRuntimeAuthorityV1;
  worker: SubscriptionRuntimeWorkerBindingV1; closure: SubscriptionRuntimeClosureV1 }>;
// Only this genuine production facade populates this instance after acquisition.
// There is no exported register, constructor override or injected verifier.
const originals = new Map<string, { resolved?: ClosedOriginal; fault: boolean }>();
/** Already-resolved original closure only. Never waits on pending owners or infers restart absence. */
export function readClosedSelectedSubscriptionCodingRuntimeV1(sessionId: string): ClosedOriginal {
  const original = originals.get(sessionId);
  if (!original?.resolved || original.fault) subscriptionRuntimeRefusedV1();
  return original.resolved;
}
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
function canonicalDirectory(directory: string, privateMode: boolean): void {
  if (realpathSync(directory) !== directory) subscriptionRuntimeRefusedV1();
  let current = directory;
  while (current !== "/") {
    const stat = lstatSync(current, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.uid !== BigInt(process.getuid!()) && stat.uid !== 0n)
      || ((stat.mode & 0o022n) !== 0n && !(stat.uid === 0n && (stat.mode & 0o1000n) !== 0n))) subscriptionRuntimeRefusedV1();
    current = dirname(current);
  }
  const stat = lstatSync(directory, { bigint: true });
  if (privateMode && (stat.uid !== BigInt(process.getuid!()) || (stat.mode & 0o7777n) !== 0o700n)) subscriptionRuntimeRefusedV1();
}
function ownedBytes(file: string): Buffer {
  const before = lstatSync(file, { bigint: true });
  if (realpathSync(file) !== file || !before.isFile() || before.nlink !== 1n
    || (before.uid !== BigInt(process.getuid!()) && before.uid !== 0n) || (before.mode & 0o022n) !== 0n
    || before.size <= 0n || before.size > 16777216n) subscriptionRuntimeRefusedV1();
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const bytes = readFileSync(fd), opened = fstatSync(fd, { bigint: true }), after = lstatSync(file, { bigint: true });
    for (const key of ["dev", "ino", "mode", "uid", "gid", "nlink", "size", "mtimeNs", "ctimeNs", "birthtimeNs"] as const) {
      if (before[key] !== opened[key] || before[key] !== after[key]) subscriptionRuntimeRefusedV1();
    }
    if (BigInt(bytes.length) !== before.size || realpathSync(file) !== file) subscriptionRuntimeRefusedV1();
    return bytes;
  } finally { closeSync(fd); }
}
function optionalControl(file: string, verify: (bytes: Buffer) => boolean, controls: string[]): void {
  try { lstatSync(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  if (!verify(ownedBytes(file))) subscriptionRuntimeRefusedV1();
  controls.push(file);
}
function workerScope(authority: SubscriptionCodingCanonicalAuthorityV1, worktree: string) {
  const controls: string[] = [], writeGrants: SubscriptionCodingWriteGrantV1[] = [];
  if (authority.schema === "setfarm.implementation-context.v3") {
    optionalControl(join(worktree, ".setfarm", "implement-context.json"), bytes =>
      sameSubscriptionRuntimeDataV1(JSON.parse(bytes.toString("utf8")), authority), controls);
    for (const relative of authority.writeAuthority.allowedPaths) {
      const path = join(worktree, relative);
      if (relative.startsWith("/") || relative.includes("\\") || relative.split("/").some(x => !x || x === "." || x === "..")
        || !path.startsWith(worktree + "/")) subscriptionRuntimeRefusedV1();
      writeGrants.push({ path, kind: "file" });
    }
  } else {
    const c = authority.context;
    optionalControl(c.instruction.path, bytes => bytes.length === c.instruction.byteLength && hash(bytes) === c.instruction.artifactHash, controls);
    if (c.retry) optionalControl(c.retry.previousOutput.path,
      bytes => bytes.length === c.retry!.previousOutput.byteLength && hash(bytes) === c.retry!.previousOutput.artifactHash, controls);
    const scope = c.toolPolicy.toolAuthority.filesystemMutation.scope;
    if (scope === "workspace-bootstrap") writeGrants.push({ path: worktree, kind: "directory" });
    else if (scope !== "none") subscriptionRuntimeRefusedV1(); // No inferred whole-worktree source authority.
  }
  return { writeGrants: Object.freeze(writeGrants), readOnlyControlPaths: Object.freeze(controls) };
}
function prepareContainer(runtimeRoot: string, container: string): void {
  canonicalDirectory(runtimeRoot, true);
  for (const directory of [join(runtimeRoot, "attempt-workspaces"), join(runtimeRoot, "attempt-workspaces", "subscription")]) {
    try { mkdirSync(directory, { mode: 0o700 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    canonicalDirectory(directory, true);
  }
  // C is exclusive. The journal owner creates C/owner. Task4 exclusively creates
  // C/worker and C/worker-output.log; neither is precreated here.
  mkdirSync(container, { mode: 0o700 }); canonicalDirectory(container, true);
}

export async function startSelectedSubscriptionCodingRuntimeV1(input: Readonly<{
  envelope: ClaimEnvelopeV1; authority: SubscriptionCodingCanonicalAuthorityV1;
  runtimeSessionId: string; ownerInstanceId: string; recoveryFence?: RecoveryRuntimeLeaseFence; signal: AbortSignal;
}>): Promise<SelectedSubscriptionCodingRuntimeV1> {
  assertFreshInstallationSelectionUnchangedV1(); assertFreshInstallationOperationalEntryV1();
  const selected = freshInstallationSelectionV1;
  if (!selected || !process.getuid) subscriptionRuntimeRefusedV1();
  const envelope = ClaimEnvelopeV1Schema.parse(input.envelope);
  const authority: SubscriptionCodingCanonicalAuthorityV1 = input.authority.schema === "setfarm.implementation-context.v3"
    ? V3ImplementationContextV1Schema.parse(input.authority) : V3StageClaimHandoffV1Schema.parse(input.authority);
  const prompt = JSON.stringify(authority);
  // B2 owns complete protected context transport. B1 neither truncates nor
  // widens the mechanical cap or invents a context file to cross that boundary.
  if (Buffer.byteLength(prompt) > 65536) throw new Error("SUBSCRIPTION_RUNTIME_AUTHORITY_CAPACITY_REFUSED");
  const profile = readSelectedFreshExecutionProfileV1(authority.schema === "setfarm.implementation-context.v3"
    ? authority.handoff.executionProfile.selection : "primary");
  if (!profile) subscriptionRuntimeRefusedV1();
  const binding = projectSubscriptionCodingRuntimeBindingV1({ envelope, authority,
    runtimeSessionId: input.runtimeSessionId, ownerInstanceId: input.ownerInstanceId,
    selectedProfile: profile, platformSourceSha: selected.state.origin.sourceSha });
  const paths = deriveSubscriptionCodingRuntimePathsV1({ runtimeRoot: selected.paths.root, runtimeSessionId: input.runtimeSessionId });
  const sessions = createRuntimeSessionRepository(getSql());
  const auth = { sessionId: input.runtimeSessionId, ownerInstanceId: input.ownerInstanceId, envelope,
    runtimePath: paths.runtimePath, transcriptPath: paths.transcriptPath, worktree: binding.worktree,
    recoveryFence: input.recoveryFence, canonicalAuthority: authority };
  const guard = () => {
    assertFreshInstallationSelectionUnchangedV1(); assertFreshInstallationOperationalEntryV1(); selected.assertUnchanged();
    const current = readSelectedFreshExecutionProfileV1(profile.selection);
    if (input.signal.aborted || !sameSubscriptionRuntimeDataV1(current, profile)
      || selected.state.origin.sourceSha !== binding.sourceSha) subscriptionRuntimeRefusedV1();
  };
  guard(); await sessions.readAuthenticatedStartingClaim(auth); guard();
  const parentIdentity = observeProcessIdentity(process.pid), activation = selected.activation;
  if (!parentIdentity || parentIdentity.source !== "observed_os" || !activation?.acknowledged || !activation.activatedPin) subscriptionRuntimeRefusedV1();
  const runtimeAuthority: SubscriptionRuntimeAuthorityV1 = Object.freeze({ sourceSha: binding.sourceSha,
    activationPreparedHash: activation.preparedPin.sha256, activationAcknowledgedHash: activation.activatedPin.sha256,
    policySourceHash: hash(ownedBytes(fileURLToPath(new URL("./subscription-coding-worker-policy-v1.js", import.meta.url)))),
    preloadHash: hash(SUBSCRIPTION_CODING_WORKER_PRELOAD_V1), parentIdentity });
  const scope = workerScope(authority, binding.worktree);
  const authorityRoots = [join(selected.directory, "credentials", "coding-subscriptions"), join(selected.paths.root, "services")];
  authorityRoots.forEach(directory => canonicalDirectory(directory, true));
  const seededAuth = { ...auth, subscriptionBinding: binding, subscriptionAuthority: runtimeAuthority };
  await sessions.readAuthenticatedStartingClaim(seededAuth); guard();
  prepareContainer(selected.paths.root, paths.container);
  let runtime: SubscriptionCodingRuntimeV1 | undefined, broker: SubscriptionAttemptBrokerV1 | undefined;
  let retained: SubscriptionCodingRuntimeOwnershipV1 | undefined;
  let entry: { resolved?: ClosedOriginal; fault: boolean } | undefined;
  const refuseOwned = async (error: unknown): Promise<never> => {
    // A refused launch/gate still owns its actual originals. Their eventual
    // honest joint closure may feed the existing drain handoff (including when
    // termination won). Only uncertain/mismatched original outcomes fault the
    // registry; a startup error itself never invents closure or absence.
    const original = error instanceof SubscriptionCodingRuntimeStartupErrorV1 ? error.ownership : retained;
    if (original) {
      try { void original.close("refused").then(async closure => {
        if (closure.status !== "closed") {
          const row = await sessions.findById(input.runtimeSessionId);
          if (row) await sessions.quarantine({ sessionId: row.sessionId, expectedOwnerInstanceId: row.ownerInstanceId,
            expectedStateVersion: row.stateVersion, diagnostic: "subscription original custody uncertain" });
        }
      }).catch(() => {}); } catch { /* Ownership remains on the error. */ }
      throw new SubscriptionCodingRuntimeStartupErrorV1(original);
    }
    if (broker) { try { void broker.stop("refused"); } catch {} }
    throw error;
  };
  try {
    runtime = await acquireSubscriptionCodingRuntimeV1({ binding, root: paths.root, runtimePath: paths.runtimePath,
      transcriptPath: paths.transcriptPath, prompt, signal: input.signal, authorityRoots, ...scope }, {
      async deriveAuthority() { guard(); return runtimeAuthority; },
      async acquireBroker(request) {
        guard();
        const prepared = readSubscriptionRuntimeAttachmentV1({ runtimePath: paths.runtimePath, binding });
        if (prepared.phase !== "prepared" || prepared.attachmentHash !== subscriptionRuntimePreparationHashV1(binding, runtimeAuthority)
          || !sameSubscriptionRuntimeDataV1(prepared.authority, runtimeAuthority)) subscriptionRuntimeRefusedV1();
        return withSelectedSubscriptionCredentialV1(binding.modelRef, async credential => {
          guard(); const acquired = await startSubscriptionAttemptBrokerV1({ ...request.identity,
            credential, limits: request.limits, signal: request.signal });
          broker = acquired; // Before any fallible guard or await can discard this owner.
          return acquired;
        });
      },
      async launchWorker(request) {
        guard(); await sessions.readAuthenticatedStartingClaim(seededAuth); guard();
        return launchSubscriptionCodingWorkerV1(request);
      },
    });
    const owned = runtime;
    retained = Object.freeze({ get broker() { return broker; }, worker: owned.worker,
      closed: owned.closed, close: owned.close });
    entry = { fault: false }; originals.set(binding.runtimeSessionId, entry);
    const originalEntry = entry;
    const worker: SubscriptionRuntimeWorkerBindingV1 = Object.freeze({ processIdentity: owned.worker.processIdentity,
      brokerPort: broker ? new URL(broker.worker.baseUrl).port ? Number(new URL(broker.worker.baseUrl).port) : 0 : 0,
      isolation: owned.worker.isolation });
    void owned.closed.then(value => {
      const closure = parseSubscriptionRuntimeClosureV1(value);
      if (closure.status !== "closed" || closure.attachmentHash !== owned.attachmentHash
        || !sameSubscriptionRuntimeDataV1(closure.binding, binding)) { originalEntry.fault = true; return; }
      originalEntry.resolved = Object.freeze({ binding, authority: runtimeAuthority, worker, closure });
    }).catch(() => { originalEntry.fault = true; });
    guard();
    const journal = readSubscriptionRuntimeAttachmentV1({ runtimePath: paths.runtimePath, binding });
    if (journal.phase !== "worker-bound" || journal.attachmentHash !== owned.attachmentHash
      || journal.attachmentHash !== subscriptionRuntimePreparationHashV1(binding, runtimeAuthority)
      || !sameSubscriptionRuntimeDataV1(journal.authority, runtimeAuthority)
      || !sameSubscriptionRuntimeDataV1(journal.worker, worker)) subscriptionRuntimeRefusedV1();
    await sessions.readAuthenticatedStartingClaim(seededAuth); guard();
    return Object.freeze({ worker: owned.worker, attachmentHash: owned.attachmentHash, close: owned.close, closed: owned.closed,
      async openGate() {
        try {
          guard();
          const published = await sessions.readAuthenticatedRunningClaim(seededAuth);
          assertSubscriptionRuntimePublishedWorkerV1(published, worker);
          guard();
          const current = readSubscriptionRuntimeAttachmentV1({ runtimePath: paths.runtimePath, binding });
          if (current.phase !== "worker-bound" || current.attachmentHash !== owned.attachmentHash
            || !sameSubscriptionRuntimeDataV1(current.authority, runtimeAuthority)
            || !sameSubscriptionRuntimeDataV1(current.worker, worker)) subscriptionRuntimeRefusedV1();
          owned.openGate();
        } catch (error) { return refuseOwned(error); }
      },
    });
  } catch (error) { return refuseOwned(error); }
}
