# Standing Owner Authorization Protocol Design

Date: 2026-08-16
Status: Proposed for written review
Scope: Setrox workspace, Setfarm, Mission Control, and goal-driven owner delivery

## Executive Decision

The workspace will use one permanent `Standing Owner Authorization v1` protocol.
An explicit user instruction to fix, complete, continue, or resume a stated goal
authorizes the primary owner to perform the ordinary, reversible, in-scope work
needed to reach that goal without repeatedly asking for the same permission.

The authorization covers investigation, implementation, verification, Git
delivery through reviewed pull requests, clean-main synchronization, and
code-owned operational verification. It follows root causes discovered while
pursuing the same objective. It does not weaken repository, runtime, review,
security, or evidence gates and cannot override higher-priority system or tool
restrictions.

## Problem

The current instructions distinguish implementation/review agents from the
primary delivery owner, but they do not define one durable interpretation of a
user's broad delivery instruction. A narrow task authorization can therefore be
mistaken for expired authority as soon as a required root fix touches a new file
or a goal status still says `blocked` after the user has explicitly resumed it.
This causes unnecessary pauses even when the requested action is a normal,
reversible step toward the same goal.

The opposite failure is also unacceptable: broad wording must not be treated as
permission to bypass gates, rewrite history, delete data, expose credentials, or
perform unrelated external actions.

## Goals

- Make valid owner authority durable, explicit, and consistent across machines.
- Stop repeated approval requests for ordinary work inside an already authorized
  goal.
- Let necessary systemic root fixes remain in scope when live evidence discovers
  them during execution.
- Preserve role separation: implementation and review agents remain unable to
  self-deliver unless the user explicitly appoints them as the primary owner.
- Define a short, objective list of actions that always require fresh approval.
- Treat an explicit `resume` or `continue` as a fresh execution attempt even when
  a goal tool retains a historical `blocked` status.
- Keep completion evidence-based; authorization never implies success.

## Non-Goals

- Granting direct-`main`, force-push, history-rewrite, or gate-bypass authority.
- Granting permission for destructive database or filesystem mutation.
- Granting authority to expose, rotate, replace, or transmit credentials.
- Granting external signing, notarization, package distribution, publication, or
  paid third-party authority.
- Allowing an agent to expand into an unrelated product objective.
- Replacing branch protection, tests, independent review, zero-owner checks,
  runtime guards, or clean-worktree requirements.

## Authorization Model

### Trigger

The following user instructions create or renew standing authority for the
objective they name or clearly continue:

- fix or correct the problem;
- fix all remaining problems;
- complete or finish the project;
- continue, proceed, or do what remains;
- resume the goal.

Equivalent natural-language instructions have the same meaning. The authority
belongs to the active primary owner for the current thread and objective. It is
not transferred to implementation or review agents merely because they share a
workspace.

### Ordinary authorized actions

Within the stated objective, the primary owner may proceed without another
approval to:

1. inspect repositories, logs, databases, HTTP state, GitHub state, and current
   goal evidence;
2. create an isolated worktree and one scoped writing branch per repository;
3. edit in-scope source, tests, migrations, documentation, and configuration;
4. run focused and broad tests, builds, audits, and read-only diagnostics;
5. stage the reviewed scope, create conventional commits, and push the scoped
   branch;
6. open or update a pull request, address scoped CI or review findings, mark it
   ready, and merge it after required checks and actionable review are clear;
7. synchronize the canonical clean `main` worktree;
8. perform code-owned, fail-closed rollout, restart, canary, matrix, recovery,
   reconciliation, and health-verification operations required by the goal; and
9. apply the smallest additional systemic root fix revealed by current evidence,
   even when its exact file was not known when the goal began.

An added root fix remains in scope only when the owner records its causal link to
the current objective and updates the task plan, File Map, tests, and delivery
evidence before editing or delivery. This is scope refinement, not permission to
start an unrelated feature.

### Actions requiring fresh explicit approval

Standing authority never covers:

- a direct commit to `main`;
- force-push, history rewrite, branch protection changes, or destructive Git
  cleanup;
- irreversible deletion or mutation of material files, databases, production
  records, backups, or user data;
- credential, secret, signing-identity, access-control, or billing changes;
- disabling or bypassing tests, runtime guards, owner censuses, safety gates, or
  review requirements;
- manual service or database mutation when a code-owned authority is required;
- external signing, notarization, package distribution, public release, or other
  separately deferred external-production authority;
- material paid third-party activity not already part of the stated goal; or
- a new objective that is not causally required to complete the authorized goal.

If one of these actions becomes necessary, the owner stops at that exact
boundary, preserves evidence, and requests only the missing authority. Safe
read-only investigation continues while waiting.

## Goal Resume and Blocked-State Semantics

A goal's stored `blocked` value is historical evidence, not an irrevocable lock.
When the user says `resume`, `continue`, or an equivalent phrase, the owner starts
a fresh blocked-condition audit and resumes all safe in-scope work under the
standing authorization.

The owner must not report the goal as blocked merely because the status field was
not automatically rewritten. It may mark the goal blocked again only under the
current blocked-threshold rules after the same blocking condition recurs in the
fresh resumed audit. It may mark the goal complete only after every required
outcome and verification is actually satisfied.

## Persistence and Propagation

The protocol has three synchronized instruction surfaces:

1. workspace-root `AGENTS.md` contains the full operating summary for the Mac
   mini workspace;
2. Setfarm `AGENTS.md` contains the same binding core for Setfarm source,
   delivery, and runtime work;
3. Mission Control `AGENTS.md` contains the same binding core for Mission Control
   source, delivery, and runtime work.

The Git-tracked Setfarm design is the canonical explanatory document. The two
repository guides carry a concise, self-contained contract so either repository
remains safe and understandable when cloned independently. Each contract names
the same protocol version and must not silently narrow or broaden the action and
fresh-approval sets.

Every implementation plan or PR that relies on the protocol includes a compact
authorization record:

```text
Authorization protocol: Standing Owner Authorization v1
User directive: exact wording or a faithful short paraphrase
Objective: bounded goal named by the user
Primary owner: active delivery owner identity
Scope refinement: causal root fix added during execution, or none
Excluded authority: direct main, force/history rewrite, destructive data,
  credentials, bypasses, unrelated scope, external signed distribution
Expiry: objective complete, user revocation, or fresh-approval boundary
```

The record is evidence and routing metadata; it is not a bearer token and cannot
be used by another agent to acquire owner authority.

## Owner Behavior

When standing authority is sufficient, the owner states once that it is using
the protocol and proceeds. It does not ask the user to reconfirm each commit,
push, PR update, merge, clean-main rollout, or newly discovered in-goal root fix.

When a fresh-approval boundary is reached, the owner reports:

- the exact proposed action;
- why it is necessary;
- the exact target and blast radius;
- the recoverability or rollback property; and
- the smallest alternative that avoids the action, if one exists.

Uncertainty does not broaden authority. The owner prefers read-only evidence and
the smallest reversible implementation until the boundary is known.

## Failure Handling

- Dirty or ambiguous worktree: preserve user changes, stop writes in that
  worktree, and use a clean isolated worktree when possible.
- Conflicting active writer: pause source changes until the writer is identified
  or stopped; read-only observation may continue.
- Failed review or CI: fix only evidence-backed issues inside the objective and
  rerun proportional verification.
- Runtime guard refusal: fix or document the guard cause; never bypass it.
- Three repeated instances of the same post-fix failure: stop the campaign and
  report the systemic blocker according to repository rules.
- Stale goal status: use current user direction and live evidence; never invent a
  status transition or completion claim.

## Verification

Implementation is accepted only when:

- all three `AGENTS.md` surfaces contain `Standing Owner Authorization v1` and
  equivalent action/fresh-approval semantics;
- Setfarm and Mission Control Git diffs contain only their planned documentation
  changes;
- the root workspace guide is updated locally without disturbing repository
  state;
- Markdown/path checks applicable to each repository pass;
- no instruction authorizes `SETFARM_ALLOW_DIRTY_BUILD=1`,
  `SETFARM_SKIP_RUNTIME_GUARD=1`, direct-`main`, force-push, secret changes, or
  external signed distribution;
- examples prove that a same-goal systemic root fix and a user `resume` proceed
  without a redundant approval request; and
- examples prove that destructive deletion, credential work, bypasses, unrelated
  scope, and external distribution still stop for fresh approval.

## Rollout

The protocol is introduced as documentation-only changes. Setfarm receives this
design and its guide update through one reviewed PR. Mission Control receives its
guide update through a separate reviewed PR. The workspace-root guide is updated
locally after both repository contracts are stable. No service restart, database
mutation, runtime rollout, or generated-project edit is required.

The current internal-production goal's existing narrow owner authorization is
retained as historical evidence. Its scope-expansion expiry is superseded for
causally necessary root fixes by `Standing Owner Authorization v1`; all explicit
security, review, clean-main, zero-owner, and external-distribution exclusions
remain unchanged.
