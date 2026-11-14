# MiniMax playable game holdout

## Objective and evidence

Run the same reviewed playable game task through the existing annual MiniMax
primary profile after the current Kimi case repeatedly fails in transport.
Run `cd7728be-59bf-48c6-9d5e-28d447148405` has four infrastructure retries;
their original broker records identify `REQUEST_TIMEOUT`. The local 120-second
per-exchange deadline is proven; the underlying provider/network/request phase
is unknown. This change does not claim to repair that transport failure.

Existing selected profiles already support MiniMax primary with Kimi fallback.
PLAN continues to use its selected primary profile. The fixed recipe selects
the MiniMax suite for that profile, but its game holdout still requests the old
generic arena. Kimi's suite already contains the reviewed playable-v2 task.

## Decision

Copy exactly the Kimi `game-playable-compositional-v2` entry into the MiniMax
suite's existing game holdout slot, assigning the existing MiniMax execution
profile. Preserve the other seven cases, suite identity, configuration and
budgets. The task and oracle must match across the two suites.

Continuing Kimi remains possible, but repeated transport failures have not
produced a product plan. Changing a captured live profile or making PLAN use a
fallback would change runtime policy. A clean selected MiniMax primary run uses
the current supported contracts and tests the same product requirement.

## File map

- `evals/suites/product-convergence-minimax-m31-flash-v1.json`: replace only the
  game holdout entry, using the exact reviewed task/oracle and MiniMax profile.
- `tests/evals/subscription-model-suite.test.ts`: exercise both parsed suites,
  their seven preserved cases, identical playable contract, exact profiles,
  oracle/task binding and rejection of a mismatched task.
- This design and its implementation plan record scope and delivery checks.

## Verification and operational boundary

First demonstrate that the MiniMax parsed suite lacks the playable contract.
Then run the focused suite-contract and existing manual-control round-trip
tests, TypeScript and a clean build. Use independent task and whole-diff review,
normal PR delivery, and the existing guarded clean release/profile transition.

The current Kimi case may be normally cancelled only through a fresh canonical
snapshot fence while it remains PLAN-only with infrastructure retries. An
accepted plan or later workflow progress refuses that proposed cancellation.
Preserve its history and let native termination drain all owners. This source
change neither cancels that run nor changes its captured profile.

A new MiniMax case requires its own actual preflight and one-case admission.
Passing contract tests or service health does not qualify software, animation,
the current prompt clarification, the full workflow or the full suite.
