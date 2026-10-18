import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import * as owner from "../../src/internal-production/owner-admission-v1.js";
import { validateOwnerAdmissionMigrationApplicationV1 } from "../../src/internal-production/owner-admission-head-v1.js";
import { createFreshInstallationApplicationV1, parseFreshInstallationOriginV1 } from "../../src/installation/fresh-installation-origin-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { freshOwnerAuthorityDataV1 } from "./fresh-installation-owner-authority-data.js";

// Exact private Source bodies + genuine pure validators + SQL/selection DATA.
// This never imports step-ops, prepares a client, activates a release or supplies
// an operational authority. Real restricted public reissue is a later QA gate.
type Row = Record<string, any>;
const ZERO = "0".repeat(64);
const intent = { schema: "setfarm.runtime-claim-intent.v1" as const, sessionId: "RTS_component-session-0001", ownerInstanceId: "component-owner",
  runtimeAgentId: "component-agent", runtimeKind: "local_process" as const };
const step = { id: "component-step-db", run_id: "component-run", step_id: "component-step" };
function fixture() {
  const application = createFreshInstallationApplicationV1(parseFreshInstallationOriginV1(freshOwnerAuthorityDataV1().origin));
  const expected = [
    { ownerKey: "11", category: "claim", implementation: "a-claim-single-runtime-v1",
      identity: owner.createInternalProductionClaimCanonicalOwnerIdentityV1({ claimIdText: "11" }) },
    { ownerKey: intent.sessionId, category: "runtime-session", implementation: "a-runtime-session-v1",
      identity: owner.createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1({ sessionId: intent.sessionId }) },
  ];
  const rows: Row[] = [], authorities: Row[] = [];
  let head: Row = {}, predecessor = ZERO;
  for (const [ordinal, input] of expected.entries()) {
    const producer = owner.INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.rows.find(row => row.implementationId === input.implementation)!;
    assert.ok(producer);
    const reservation = owner.createInternalProductionOwnerReservationV1({ producer, ownerKey: input.ownerKey,
      ownerAdmissionHeadPredecessorHash: predecessor });
    const bound = owner.createInternalProductionBoundOwnerReservationV1({ reservation, canonicalOwnerIdentity: input.identity });
    const payload = { schema: "setfarm.internal-production-owner-admission-head.v1", version: ordinal + 1,
      predecessorHeadHash: predecessor, transitionKind: "reservation", transitionRef: reservation.reservationRef,
      transitionHash: reservation.reservationHash, migrationApplication: application };
    const hash = hashCanonicalJson(payload);
    const reservationAuthority = { authority_ref: reservation.reservationRef, authority_hash: reservation.reservationHash,
      authority_kind: "reservation", phase_key: reservation.reservationRef, predecessor_head_hash: predecessor,
      successor_head_hash: hash, authority_body: reservation };
    authorities.push(reservationAuthority, { authority_ref: `setfarm://internal-production/bound-owner-reservations/${bound.bindingHash}`,
      authority_hash: bound.bindingHash, authority_kind: "binding", phase_key: reservation.reservationRef,
      predecessor_head_hash: hash, successor_head_hash: hash, authority_body: bound });
    rows.push({ reservation_ref: reservation.reservationRef, reservation_hash: reservation.reservationHash,
      category: input.category, owner_key: input.ownerKey, owner_key_hash: reservation.ownerKeyHash,
      producer_purpose_hash: reservation.producerPurposeHash, producer_implementation_id: input.implementation,
      producer_implementation_hash: reservation.producerImplementationHash, reservation_payload: reservation,
      reservation_head_predecessor_hash: predecessor, state: "bound", canonical_owner_identity: input.identity,
      binding_hash: bound.bindingHash, binding_payload: bound, head_version: String(ordinal + 1),
      close_kind: null, terminal_owner_ref: null, terminal_owner_hash: null, close_head_predecessor_hash: null,
      close_head_successor_hash: null, preserved_fence_ref: null, preserved_fence_hash: null,
      close_ref: null, close_hash: null, close_payload: null });
    head = { head_version: String(ordinal + 1), head_hash: hash, active_fence_ref: null, active_fence_hash: null,
      active_target_family_hash: null, migration_application_evidence_hash: application.evidenceHash, head_payload: payload };
    predecessor = hash;
  }
  const claim: Row = { claim_id: "11", open_claim_count: "1", claim_run_id: step.run_id,
    claim_step_id: step.step_id, claim_story_id: null, claim_agent_id: intent.runtimeAgentId,
    session_id: intent.sessionId, runtime_claim_id: "11", runtime_run_id: step.run_id,
    runtime_step_db_id: step.id, runtime_workflow_step_id: step.step_id, runtime_story_db_id: null,
    runtime_story_id: null, runtime_attempt_id: null, runtime_claim_agent_id: intent.runtimeAgentId,
    owner_instance_id: intent.ownerInstanceId, runtime_agent_id: intent.runtimeAgentId, runtime_kind: intent.runtimeKind,
    session_key: null, worktree: null, runtime_path: null, transcript_path: null, runtime_state: "reserved" };
  return { expected, rows, authorities, head, claimRows: [claim] };
}
function component(data = fixture(), selected = true, refuseSelection = false) {
  const text = readFileSync(new URL("../../src/installer/step-ops.ts", import.meta.url), "utf8");
  const tree = ts.createSourceFile("step-ops.ts", text, ts.ScriptTarget.Latest, true);
  const names = ["validateRunningSingleStepOwnerMigrationApplicationV1", "runningSingleStepOwnerAdmissionSuccessorV1",
    "validateRunningSingleStepOwnerAncestryV1", "observeRunningSingleStepOwnerAncestryV1",
    "authenticateRunningSingleStepOwnerSidecarsV1", "authenticateRunningSingleStepClaimReissueV1"];
  const functions = names.map(name => {
    const matches = tree.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.equal(matches.length, 1, `exact Source function ${name}`); return matches[0]!.getText(tree);
  });
  const constants = ["RUNNING_SINGLE_STEP_OWNER_SHA256_V1", "RUNNING_SINGLE_STEP_OWNER_REF_V1"].map(name => {
    const matches = tree.statements.filter(ts.isVariableStatement).filter(node => node.declarationList.declarations
      .some(item => ts.isIdentifier(item.name) && item.name.text === name));
    assert.equal(matches.length, 1); return matches[0]!.getText(tree);
  });
  const queries: string[] = [];
  const sql = { async unsafe(query: string, parameters: readonly any[] = []) {
    queries.push(query); assert.match(query, /^\s*SELECT\b/, "components must remain read-only");
    if (query.includes("FROM claim_log claim")) { assert.match(query, /FOR UPDATE OF claim/); assert.match(query, /LIMIT 2\s+FOR UPDATE/); return data.claimRows; }
    if (query.includes("FROM internal_production_owner_admission_head_v1")) { assert.match(query, /FOR UPDATE/); return [data.head]; }
    if (query.includes("FROM internal_production_owner_reservations_v1")) {
      assert.match(query, /FOR UPDATE/); return data.rows.filter(row => parameters[0].includes(row.owner_key));
    }
    if (query.includes("FROM internal_production_owner_admission_authorities_v1")) {
      if (query.includes("WHERE authority_ref=$1 AND authority_hash=$2")) {
        if (selected && /\bFOR SHARE\b/.test(query)) throw Object.assign(Error("immutable row lock denied DATA"), { code: "42501" });
        return data.authorities.filter(row => row.authority_ref === parameters[0] && row.authority_hash === parameters[1]);
      }
      return data.authorities.filter(row => row.successor_head_hash === parameters[0] && row.predecessor_head_hash !== row.successor_head_hash);
    }
    throw Error("unexpected exact Source SQL");
  } };
  const used = ["INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1", "createInternalProductionGlobalOwnerAdmissionFenceTransitionV1",
    "createInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1", "validateInternalProductionGlobalOwnerAdmissionFenceV1",
    "validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1", "validateInternalProductionOwnerReservationV1",
    "validateInternalProductionOwnerReservationCloseV1", "validateInternalProductionCanonicalOwnerIdentityV1",
    "validateInternalProductionBoundOwnerReservationV1", "createInternalProductionClaimCanonicalOwnerIdentityV1",
    "createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1"] as const;
  const bindings: Record<string, unknown> = Object.fromEntries(used.map(name => [name, owner[name]]));
  Object.assign(bindings, { canonicalJsonStringify, hashCanonicalJson, validateOwnerAdmissionMigrationApplicationV1,
    selectedFreshInstallationRootV1: () => { if (refuseSelection) throw Error("selection refused DATA"); return selected ? "/component/installation/runtime" : null; },
    pgBegin: async (operation: (input: typeof sql) => Promise<unknown>) => operation(sql) });
  const js = ts.transpileModule([...constants, ...functions].join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const api = new Function(...Object.keys(bindings), js + ";return {sidecars:authenticateRunningSingleStepOwnerSidecarsV1,reauth:authenticateRunningSingleStepClaimReissueV1};")(...Object.values(bindings)) as {
    sidecars(transaction: typeof sql, expected: unknown): Promise<boolean>;
    reauth(step: unknown, agentId: string, intent?: unknown): Promise<any>;
  };
  return { ...api, sql, queries, data };
}

test("selected Source component authenticates both immutable sidecars without UPDATE-demanding row locks", async () => {
  const c = component(), before = structuredClone(c.data);
  assert.equal(await c.sidecars(c.sql, c.data.expected), true);
  const exact = c.queries.filter(query => query.includes("WHERE authority_ref=$1 AND authority_hash=$2"));
  assert.equal(exact.length, 4, "reservation and binding for both genuine claim/runtime DATA identities");
  for (const query of exact) assert.doesNotMatch(query, /\bFOR\s+(?:UPDATE|SHARE|KEY SHARE)\b/);
  assert.deepEqual(c.data, before, "all authentication reads preserve row DATA");
});

test("unselected Source component retains both original FOR SHARE lookups and mutable owner locks", async () => {
  const c = component(fixture(), false);
  assert.equal(await c.sidecars(c.sql, c.data.expected), true);
  const exact = c.queries.filter(query => query.includes("WHERE authority_ref=$1 AND authority_hash=$2"));
  assert.equal(exact.length, 4); for (const query of exact) assert.match(query, /FOR SHARE/);
  assert.ok(c.queries.some(query => /owner_admission_head_v1/.test(query) && /FOR UPDATE/.test(query)));
  assert.ok(c.queries.some(query => /owner_reservations_v1/.test(query) && /FOR UPDATE/.test(query)));
});

test("same-intent Source reissue returns the original claim and exact runtime identity only", async () => {
  const c = component(), before = structuredClone(c.data);
  assert.deepEqual(await c.reauth(step, intent.runtimeAgentId, intent), { status: "authenticated", claimId: 11,
    runtime: { sessionId: intent.sessionId, ownerInstanceId: intent.ownerInstanceId, state: "reserved" } });
  assert.deepEqual(c.data, before);
});

test("wrong runtime identity remains typed refused before any owner-sidecar lookup", async () => {
  for (const changed of [{ sessionId: "RTS_foreign-session-0001" }, { ownerInstanceId: "foreign-owner" },
    { runtimeAgentId: "foreign-agent" }, { runtimeKind: "openclaw_session" }, { sessionKey: "foreign-key" },
    { worktree: "/foreign" }, { runtimePath: "/foreign" }, { transcriptPath: "/foreign" }]) {
    const c = component();
    assert.deepEqual(await c.reauth(step, intent.runtimeAgentId, { ...intent, ...changed }), { status: "refused" });
    assert.equal(c.queries.some(query => query.includes("FROM internal_production_owner_reservations_v1")), false);
  }
});

test("missing or ambiguous claim remains typed absent/refused and malformed claim ID keeps its error", async () => {
  const absent = fixture(); absent.claimRows = [];
  assert.deepEqual(await component(absent).reauth(step, intent.runtimeAgentId, intent), { status: "absent" });
  const duplicate = fixture(); duplicate.claimRows.push({ ...duplicate.claimRows[0]! });
  assert.deepEqual(await component(duplicate).reauth(step, intent.runtimeAgentId, intent), { status: "refused" });
  const malformed = fixture(); malformed.claimRows[0]!.claim_id = "01";
  await assert.rejects(component(malformed).reauth(step, intent.runtimeAgentId, intent), { message: "SINGLE_STEP_CLAIM_ID_INVALID" });
});

test("fresh binding, ancestry, fence and selected-mode corruption never authenticate", async () => {
  const mutations = [
    (f: ReturnType<typeof fixture>) => { f.rows[0]!.binding_hash = "f".repeat(64); },
    (f: ReturnType<typeof fixture>) => { f.authorities.pop(); },
    (f: ReturnType<typeof fixture>) => { f.head.active_fence_ref = "setfarm://component/foreign-fence"; },
    (f: ReturnType<typeof fixture>) => { f.rows[0]!.canonical_owner_identity = owner.createInternalProductionClaimCanonicalOwnerIdentityV1({ claimIdText: "12" }); },
    (f: ReturnType<typeof fixture>) => { f.rows[0]!.close_kind = "terminal"; },
  ];
  for (const mutate of mutations) { const data = fixture(); mutate(data); const c = component(data);
    assert.deepEqual(await c.reauth(step, intent.runtimeAgentId, intent), { status: "refused" }); }
  const c = component(fixture(), true, true);
  assert.deepEqual(await c.reauth(step, intent.runtimeAgentId, intent), { status: "refused" });
  assert.equal(c.queries.some(query => query.includes("WHERE authority_ref=$1 AND authority_hash=$2")), false);
});
