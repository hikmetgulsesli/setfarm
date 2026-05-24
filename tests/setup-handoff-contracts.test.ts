import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getStackPack } from "../dist/installer/stack-contract/packs.js";
import { annotateResolvedTargetsForSetup, type ResolvedTarget } from "../dist/installer/setup-handoff.js";

function target(partial: Partial<ResolvedTarget>): ResolvedTarget {
  return {
    storyId: "US-001",
    role: "surface_component",
    domainSlug: "ticket",
    targetSlug: "ticket-editor",
    path: "src/screens/TicketEditor.tsx",
    resolvedPath: "src/screens/TicketEditor.tsx",
    ruleId: "test.surface",
    source: "scope_target",
    ...partial,
  };
}

describe("setup handoff contracts", () => {
  it("rejects unresolved physical path collisions unless they are shared grants", () => {
    const pack = getStackPack("vite-react-web-app");

    assert.throws(
      () => annotateResolvedTargetsForSetup([
        target({ storyId: "US-001", path: "src/screens/Duplicate.tsx" }),
        target({ storyId: "US-002", path: "src/screens/Duplicate.tsx" }),
      ], pack, "run-1"),
      /FILE_TREE_PATH_COLLISION/,
    );
  });

  it("creates explicit grants for shared edit targets", () => {
    const pack = getStackPack("vite-react-web-app");
    const result = annotateResolvedTargetsForSetup([
      target({
        storyId: "US-001",
        role: "route_registration",
        path: "src/App.tsx",
        resolvedPath: "src/App.tsx",
        ruleId: "vite.route_registration",
        source: "shared_edit_request",
        sharedEdit: true,
        editScope: "route_registration_only",
      }),
      target({
        storyId: "US-002",
        role: "route_registration",
        path: "src/App.tsx",
        resolvedPath: "src/App.tsx",
        ruleId: "vite.route_registration",
        source: "shared_edit_request",
        sharedEdit: true,
        editScope: "route_registration_only",
      }),
    ], pack, "run-1");

    assert.equal(result.grants.length, 2);
    assert.equal(result.grants[0].status, "granted");
    assert.equal(result.targets[0].collisionStatus, "pending_shared_grant");
    assert.ok(result.targets[0].sharedGrantRequestId);
  });

  it("allows a story-owned shared file plus later shared edit requests", () => {
    const pack = getStackPack("vite-react-web-app");
    const result = annotateResolvedTargetsForSetup([
      target({
        storyId: "US-001",
        role: "app_shell",
        path: "src/App.tsx",
        resolvedPath: "src/App.tsx",
        ruleId: "vite.app_shell",
        source: "scope_target",
      }),
      target({
        storyId: "US-002",
        role: "route_registration",
        path: "src/App.tsx",
        resolvedPath: "src/App.tsx",
        ruleId: "vite.route_registration",
        source: "shared_edit_request",
        sharedEdit: true,
        editScope: "route_registration_only",
      }),
    ], pack, "run-1");

    assert.equal(result.grants.length, 1);
    assert.equal(result.grants[0].storyId, "US-002");
    assert.equal(result.grants[0].status, "granted");
    assert.equal(result.targets[0].collisionStatus, "shared");
    assert.equal(result.targets[0].sharedGrantRequestId, undefined);
    assert.equal(result.targets[1].collisionStatus, "pending_shared_grant");
    assert.ok(result.targets[1].sharedGrantRequestId);
  });
});
