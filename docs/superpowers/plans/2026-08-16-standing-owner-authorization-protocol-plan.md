# Standing Owner Authorization Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install one permanent, versioned owner-authorization contract across the Setrox workspace, Setfarm, and Mission Control so in-goal delivery proceeds without repeated approval while exceptional actions still stop for fresh authority.

**Architecture:** One byte-identical marked Markdown block is installed in all three `AGENTS.md` instruction surfaces. Setfarm owns the explanatory spec and current-goal overlay; Setfarm and Mission Control deliver their tracked guide changes through separate reviewed PRs, while the non-Git workspace-root guide is synchronized only after both tracked contracts are stable.

**Tech Stack:** Markdown, Git worktrees and pull requests, POSIX shell verification, existing Setfarm English/path checks

**Spec:** `docs/superpowers/specs/2026-08-16-standing-owner-authorization-protocol-design.md`

## Global Constraints

- Protocol identifier is exactly `Standing Owner Authorization v1`.
- The marked contract block is byte-identical in workspace-root, Setfarm, and Mission Control `AGENTS.md`.
- User instructions to fix, complete, continue, proceed, or resume authorize ordinary reversible work required by the same bounded objective.
- Causally required systemic root fixes remain in scope after the task plan, File Map, tests, and delivery evidence are updated.
- Direct `main`, force/history rewrite, destructive data mutation, credentials, bypasses, unrelated scope, paid external activity, and external signed distribution always require fresh explicit approval.
- Authorization never weakens clean-worktree, single-writer, tests, review, runtime-guard, zero-owner, secret, or evidence requirements.
- Implementation and review agents remain non-delivery roles unless the user explicitly appoints one as the primary owner.
- A user `resume` starts a fresh blocked-condition audit; a stale stored `blocked` value alone does not stop safe in-scope work.
- No service restart, database mutation, runtime rollout, dependency change, generated-project edit, or build is required for this Markdown-only change.
- Setfarm and Mission Control changes use separate isolated worktrees, branches, commits, and PRs; neither repository receives a direct commit to `main`.

---

## File Map

### Setfarm tracked files

- Modify: `AGENTS.md` — install the permanent binding contract below `Git And Safety`.
- Modify: `docs/superpowers/plans/2026-08-16-design-source-semantic-retry-closure-plan.md` — retain the historical task authorization and record the standing-protocol overlay for causally necessary in-goal root fixes.
- Create: `docs/superpowers/specs/2026-08-16-standing-owner-authorization-protocol-design.md` — approved design and permanent explanatory authority.
- Create: `docs/superpowers/plans/2026-08-16-standing-owner-authorization-protocol-plan.md` — this execution plan.

### Mission Control tracked file

- Modify: `AGENTS.md` — install the identical permanent binding contract below `Git And PR Comments`.

### Workspace-local file

- Modify: `/Users/setrox/ai/setrox/AGENTS.md` — install the identical permanent binding contract below `Git Discipline` after both tracked contracts are merged.

## Canonical Contract Block

Every task below uses these exact bytes:

```markdown
<!-- standing-owner-authorization-v1:start -->
## Standing Owner Authorization v1

An explicit user instruction to fix, complete, continue, proceed, or resume a
bounded objective authorizes the active primary owner to perform the ordinary,
reversible work required to achieve that objective without repeatedly asking
for the same permission. This includes read-only investigation, isolated
worktrees and scoped branches, in-scope source/test/docs/config changes,
proportional verification, staging and conventional commits, pushing the scoped
branch, reviewed pull-request delivery, clean-main synchronization, and
code-owned fail-closed rollout or health verification required by the goal.

A systemic root fix discovered from current evidence remains in scope when it is
causally necessary for the same objective. Before delivery, record that relation
in the task plan, update the File Map and tests, and keep the change to the
smallest root fix. This is scope refinement, not authority for an unrelated
feature. Implementation and review agents remain non-delivery roles unless the
user explicitly appoints one as the primary owner.

Standing authority never permits a direct commit to `main`, force-push or
history rewrite, destructive data or filesystem mutation, credential/secret or
access-control changes, safety/test/runtime-guard bypasses, unrelated scope,
material paid third-party activity, or external signing, notarization,
distribution, or public release. Stop at that exact boundary and request only
the missing authority. All clean-worktree, single-writer, branch-protection,
test, review, zero-owner, secret, runtime, and evidence requirements remain in
force.

When the user says `resume`, `continue`, or an equivalent phrase, begin a fresh
blocked-condition audit and continue safe in-scope work. A stale stored
`blocked` status is historical evidence, not an irrevocable lock. Mark the goal
blocked again only under the current repeated-blocker rule, and mark it complete
only after every required outcome is proven.

When this protocol is sufficient, state once that it is being used and proceed.
Do not ask the user to reconfirm each commit, push, PR update, merge, clean-main
rollout, or causally required in-goal root fix. This protocol cannot override
higher-priority system instructions, tool restrictions, or explicit user
revocation.
<!-- standing-owner-authorization-v1:end -->
```

---

### Task 1: Install the Setfarm contract and current-goal overlay

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/plans/2026-08-16-design-source-semantic-retry-closure-plan.md`

**Interfaces:**
- Consumes: the exact canonical contract block in this plan and the historical `Scoped owner delivery authorization` section in the semantic-retry plan.
- Produces: one Setfarm instruction surface named `Standing Owner Authorization v1` and one explicit current-goal overlay that preserves all original exclusions.

- [ ] **Step 1: Prove the Setfarm guide does not already contain the protocol**

Run:

```bash
if rg -q '^<!-- standing-owner-authorization-v1:start -->$' AGENTS.md; then exit 1; fi
if rg -q '^<!-- standing-owner-authorization-v1:end -->$' AGENTS.md; then exit 1; fi
```

Expected: both tests exit `0`, proving there is no duplicate marker before the edit.

- [ ] **Step 2: Add the canonical contract to Setfarm `AGENTS.md`**

Use `apply_patch` to insert the exact `Canonical Contract Block` immediately after the `Git And Safety` section and before `Testing Expectations`. Do not alter any existing Setfarm rule.

- [ ] **Step 3: Add the current-goal authorization overlay**

Use `apply_patch` to append this paragraph after the two existing paragraphs in `## Scoped owner delivery authorization`:

```markdown
`Standing Owner Authorization v1` now governs causally necessary root fixes discovered while this internal-production objective remains active. Such a fix no longer expires merely because its exact path was absent from the original File Map; the primary owner must first record the causal evidence, update the File Map and tests, and preserve every exclusion above. The user's explicit `resume`, `continue`, `fix all remaining problems`, or equivalent instruction renews execution under a fresh blocked-condition audit without granting external signed-distribution authority.
```

- [ ] **Step 4: Verify Setfarm semantics and uniqueness**

Run:

```bash
test "$(rg -c '^<!-- standing-owner-authorization-v1:start -->$' AGENTS.md)" -eq 1
test "$(rg -c '^<!-- standing-owner-authorization-v1:end -->$' AGENTS.md)" -eq 1
rg -n 'A stale stored$' AGENTS.md
rg -n '^`blocked` status is historical evidence' AGENTS.md
rg -n 'Standing authority never permits a direct commit to `main`' AGENTS.md
rg -n 'governs causally necessary root fixes' \
  docs/superpowers/plans/2026-08-16-design-source-semantic-retry-closure-plan.md
if rg -n 'SETFARM_ALLOW_DIRTY_BUILD=1.*permit|SETFARM_SKIP_RUNTIME_GUARD=1.*permit|force-push.*permitted|external signed-distribution authority.*grant' AGENTS.md; then
  exit 1
fi
git diff --check
npm run --silent check:english
npm run --silent check:paths
```

Expected: one start/end marker, all required clauses found, no forbidden weakening, clean diff, and both Setfarm documentation checks pass.

- [ ] **Step 5: Commit the Setfarm instruction change**

Run:

```bash
git add -- \
  AGENTS.md \
  docs/superpowers/plans/2026-08-16-design-source-semantic-retry-closure-plan.md \
  docs/superpowers/plans/2026-08-16-standing-owner-authorization-protocol-plan.md
git diff --cached --check
git diff --cached --name-only
git commit -m "docs: adopt standing owner authorization"
```

Expected: the staged file list is exactly `AGENTS.md`, the semantic-retry plan, and this plan's verification correction. The already committed spec remains an earlier commit on the same branch. The new commit succeeds on `docs/standing-owner-authorization-v1`, and `git status --short` is empty.

---

### Task 2: Deliver the Setfarm protocol through a reviewed PR

**Files:**
- Verify only: the four Setfarm tracked files from Task 1

**Interfaces:**
- Consumes: clean branch `docs/standing-owner-authorization-v1` and the Setfarm verification evidence from Task 1.
- Produces: reviewed merged Setfarm PR and synchronized clean Setfarm `main` containing the canonical protocol.

- [ ] **Step 1: Reverify the clean branch**

Run:

```bash
test "$(git branch --show-current)" = 'docs/standing-owner-authorization-v1'
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git diff --check origin/main...HEAD
npm run --silent check:english
npm run --silent check:paths
```

Expected: clean scoped branch and both checks pass. No build is run because all changes are Markdown.

- [ ] **Step 2: Push and open the Setfarm PR**

Run:

```bash
git push -u origin docs/standing-owner-authorization-v1
gh pr create \
  --base main \
  --head docs/standing-owner-authorization-v1 \
  --title 'docs: adopt standing owner authorization' \
  --body 'Defines Standing Owner Authorization v1, preserves all safety gates, records resume semantics, and supersedes only the current goal narrow File Map expiry for causally necessary root fixes. Verification: check:english, check:paths, git diff --check.'
```

Expected: one Setfarm PR URL.

- [ ] **Step 3: Require current checks and review state**

Run:

```bash
gh pr checks --watch
gh pr view --json state,isDraft,mergeStateStatus,reviewDecision,statusCheckRollup
```

Expected: required checks pass, the PR is not draft, merge state is mergeable/clean, and there is no actionable unresolved review finding.

- [ ] **Step 4: Merge and synchronize clean Setfarm main**

Run:

```bash
gh pr merge --squash --delete-branch
git -C /Users/setrox/ai/setrox/.worktrees/setfarm-internal-production-bootstrap pull --ff-only origin main
test -z "$(git -C /Users/setrox/ai/setrox/.worktrees/setfarm-internal-production-bootstrap status --porcelain=v1 --untracked-files=all)"
rg -n '^## Standing Owner Authorization v1$' \
  /Users/setrox/ai/setrox/.worktrees/setfarm-internal-production-bootstrap/AGENTS.md
```

Expected: PR merged, canonical Setfarm `main` clean and synchronized, protocol present.

---

### Task 3: Install and deliver the Mission Control contract

**Files:**
- Modify: `AGENTS.md` in isolated Mission Control worktree `/Users/setrox/ai/setrox/.worktrees/mission-control-standing-owner-authorization`

**Interfaces:**
- Consumes: the exact canonical block from the merged Setfarm protocol.
- Produces: reviewed merged Mission Control PR and clean synchronized Mission Control `main` with byte-identical contract bytes.

- [ ] **Step 1: Create a clean isolated Mission Control worktree**

Run:

```bash
test -z "$(git -C /Users/setrox/ai/setrox/mission-control status --porcelain=v1 --untracked-files=all)"
git -C /Users/setrox/ai/setrox/mission-control fetch origin main
git -C /Users/setrox/ai/setrox/mission-control worktree add \
  -b docs/standing-owner-authorization-v1 \
  /Users/setrox/ai/setrox/.worktrees/mission-control-standing-owner-authorization \
  origin/main
```

Expected: new clean worktree on `docs/standing-owner-authorization-v1`.

- [ ] **Step 2: Insert the identical canonical contract**

Use `apply_patch` to insert the exact `Canonical Contract Block` after `Git And PR Comments`. Do not change Mission Control's existing runtime or verification rules.

- [ ] **Step 3: Verify Mission Control and cross-repository byte parity**

Run from `/Users/setrox/ai/setrox/.worktrees/mission-control-standing-owner-authorization`:

```bash
test "$(rg -c '^<!-- standing-owner-authorization-v1:start -->$' AGENTS.md)" -eq 1
test "$(rg -c '^<!-- standing-owner-authorization-v1:end -->$' AGENTS.md)" -eq 1
git diff --check

extract_authorization_block() {
  sed -n \
    '/^<!-- standing-owner-authorization-v1:start -->$/,/^<!-- standing-owner-authorization-v1:end -->$/p' \
    "$1"
}

cmp \
  <(extract_authorization_block /Users/setrox/ai/setrox/.worktrees/setfarm-internal-production-bootstrap/AGENTS.md) \
  <(extract_authorization_block AGENTS.md)
```

Expected: one marker pair, clean diff, and byte-identical Setfarm/Mission Control blocks. No build is run because the only change is Markdown.

- [ ] **Step 4: Commit, push, and open the Mission Control PR**

Run:

```bash
git add -- AGENTS.md
git diff --cached --check
test "$(git diff --cached --name-only)" = 'AGENTS.md'
git commit -m "docs: adopt standing owner authorization"
git push -u origin docs/standing-owner-authorization-v1
gh pr create \
  --base main \
  --head docs/standing-owner-authorization-v1 \
  --title 'docs: adopt standing owner authorization' \
  --body 'Adds the byte-identical Standing Owner Authorization v1 contract shared with Setfarm. It authorizes ordinary in-goal delivery without weakening fresh-approval or safety boundaries. Verification: cross-repository block parity and git diff --check.'
```

Expected: clean one-file commit and one Mission Control PR URL.

- [ ] **Step 5: Review, merge, and synchronize Mission Control main**

Run:

```bash
gh pr checks --watch
gh pr view --json state,isDraft,mergeStateStatus,reviewDecision,statusCheckRollup
gh pr merge --squash --delete-branch
git -C /Users/setrox/ai/setrox/mission-control pull --ff-only origin main
test -z "$(git -C /Users/setrox/ai/setrox/mission-control status --porcelain=v1 --untracked-files=all)"
rg -n '^## Standing Owner Authorization v1$' /Users/setrox/ai/setrox/mission-control/AGENTS.md
```

Expected: PR merged and canonical Mission Control `main` clean with the protocol present.

---

### Task 4: Synchronize the workspace-root guide and prove final parity

**Files:**
- Modify: `/Users/setrox/ai/setrox/AGENTS.md`

**Interfaces:**
- Consumes: merged Setfarm and Mission Control canonical contract bytes.
- Produces: one locally persistent workspace instruction surface and three-way byte-parity evidence.

- [ ] **Step 1: Insert the canonical contract in the root guide**

Use `apply_patch` to insert the merged canonical block after `Git Discipline`. Preserve every existing workspace instruction byte outside the insertion.

- [ ] **Step 2: Prove exact three-way parity**

Run:

```bash
extract_authorization_block() {
  sed -n \
    '/^<!-- standing-owner-authorization-v1:start -->$/,/^<!-- standing-owner-authorization-v1:end -->$/p' \
    "$1"
}

ROOT_AGENTS=/Users/setrox/ai/setrox/AGENTS.md
SETFARM_AGENTS=/Users/setrox/ai/setrox/.worktrees/setfarm-internal-production-bootstrap/AGENTS.md
MC_AGENTS=/Users/setrox/ai/setrox/mission-control/AGENTS.md

test "$(rg -c '^<!-- standing-owner-authorization-v1:start -->$' "$ROOT_AGENTS")" -eq 1
test "$(rg -c '^<!-- standing-owner-authorization-v1:end -->$' "$ROOT_AGENTS")" -eq 1
cmp <(extract_authorization_block "$ROOT_AGENTS") <(extract_authorization_block "$SETFARM_AGENTS")
cmp <(extract_authorization_block "$ROOT_AGENTS") <(extract_authorization_block "$MC_AGENTS")
extract_authorization_block "$ROOT_AGENTS" | shasum -a 256
```

Expected: one root marker pair, both comparisons exit `0`, and one stable SHA-256 is recorded.

- [ ] **Step 3: Prove required and forbidden behavior examples**

Run:

```bash
BLOCK_TEXT="$(extract_authorization_block "$ROOT_AGENTS")"

rg -n 'systemic root fix discovered from current evidence remains in scope' <<< "$BLOCK_TEXT"
rg -n 'A stale stored$' <<< "$BLOCK_TEXT"
rg -n '^`blocked` status is historical evidence' <<< "$BLOCK_TEXT"
rg -n 'Do not ask the user to reconfirm each commit, push, PR update, merge' <<< "$BLOCK_TEXT"
rg -n 'direct commit to `main`' <<< "$BLOCK_TEXT"
rg -n 'destructive data or filesystem mutation' <<< "$BLOCK_TEXT"
rg -n 'credential/secret or$' <<< "$BLOCK_TEXT"
rg -n '^access-control changes' <<< "$BLOCK_TEXT"
rg -n 'external signing, notarization,$' <<< "$BLOCK_TEXT"
rg -n '^distribution, or public release' <<< "$BLOCK_TEXT"
```

Expected: every required ordinary-action and fresh-approval boundary is present in the exact shared block.

- [ ] **Step 4: Record final repository state**

Run:

```bash
git -C /Users/setrox/ai/setrox/.worktrees/setfarm-internal-production-bootstrap status --short --branch
git -C /Users/setrox/ai/setrox/mission-control status --short --branch
git -C /Users/setrox/ai/setrox/.worktrees/setfarm-internal-production-bootstrap rev-parse HEAD
git -C /Users/setrox/ai/setrox/mission-control rev-parse HEAD
```

Expected: both canonical repositories are clean on synchronized `main`; record both exact merged SHAs. The workspace root is not a Git repository, so its local `AGENTS.md` update is reported separately rather than represented as a commit.

---

## Post-Implementation Handoff

After Task 4, reopen the existing internal-production goal and its active plans.
The user's current `continue` instruction starts the fresh blocked-condition audit
defined by this protocol. Any newly observed systemic root fix receives its own
evidence-backed scope refinement and implementation plan before source edits;
the owner does not request another authorization unless the exact action crosses
one of the fresh-approval boundaries in the installed contract. External signed
distribution remains deferred and cannot be inferred from goal completion.
