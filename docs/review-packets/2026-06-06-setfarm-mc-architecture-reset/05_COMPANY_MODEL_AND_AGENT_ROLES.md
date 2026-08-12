# Company Model And Agent Roles

## Desired Product Metaphor

The user wants to observe Setfarm + Mission Control as if it were a company:

- The executive/CEO sees the overall situation from the top.
- The product manager knows what must be done and understands the acceptance criteria.
- The designer produces the design.
- The developer writes the code.
- The reviewer examines PRs and comments.
- QA tests the product as a user would.
- Security checks security risks.
- The deployer publishes the product.
- The supervisor tracks quality and product integrity.
- Mission Control displays all of this work live.

This UI should not merely show "pipeline step done." It should show which agent is working on which story, file, PR comment, gate, and runtime evidence.

## Existing Agents

Roles in `workflows/feature-dev/workflow.yml`:

- planner
- designer
- setup-repo
- setup-build
- developer
- reviewer
- supervisor
- security-gate
- qa-tester
- tester/final-test
- deployer

This set of roles is sufficient on paper. The problem is not just the number of agents; their authority boundaries are unclear.

## Core Role Boundary Question

What should an agent do?

- understand intent
- make scoped code changes
- report anything it finds missing
- propose a verification request

What should Setfarm do?

- scope enforcement
- build/test/smoke/evidence execution
- PR creation/merge state verification
- runtime port lifecycle
- completion decision
- MC observations

What should the supervisor do?

- check product coherence and policy
- classify repeated failure patterns
- propose safe, bounded interventions

What should the supervisor not do?

- patch arbitrary platform code
- approve its own fix
- relax the smoke test
- absorb the developer, QA, and PM roles by itself

## Do We Need More Agents?

The likely answer is not more agents, but a clearer authority model.

Potential new logical roles:

- Evidence Runner: not an agent, but a Setfarm-owned runtime executor.
- Platform Architect Reviewer: a role that analyzes a self-heal patch plan before human review/approval.
- MC Projection Owner: a system role that checks event/read-model correctness.

Adding a new LLM agent is not a solution by itself. More agents can produce more commentary and more conflicting claims.

## Recommended Question For Gemini/Sonnet

Should the existing roles be preserved? Or should we rebuild the system around:

- fewer LLM agents
- stronger deterministic orchestrator
- explicit evidence runner
- explicit review FSM
- MC as event-sourced operations board

Which tasks should never be delegated to an LLM?
