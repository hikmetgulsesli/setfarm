---
name: antfarm-workflows
description: Plan and execute multi-agent workflows with Antfarm. Use when user requests a complex task that benefits from multiple specialized agents.
user-invocable: false
---

# Antfarm Workflows

Antfarm orchestrates multi-agent workflows. **Your job is to ensure tasks are well-specified before agents start working.**

## When to Use

Use antfarm workflows when:
- Task is complex enough to benefit from multiple agents
- Work involves implement → verify → test → review cycle
- User wants autonomous execution with quality gates

## The Planning Process (MANDATORY)

**Never start a workflow with a vague task description.** Always complete these steps:

### Step 1: Clarify Requirements

Ask the user:
- What specifically needs to be built?
- What are the key features/components?
- Any technical constraints or preferences?
- What does the output look like?

### Step 2: Draft the Plan

Write a concrete implementation plan:
```
1. [Specific step with details]
2. [Next step]
3. [etc.]
```

Share with user. Iterate until they approve.

### Step 3: Define Acceptance Criteria

Get explicit agreement on what "done" means:
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

The user must confirm these before proceeding.

### Step 4: Start the Workflow

Only after steps 1-3 are complete:

```bash
antfarm workflow run <workflow-id> "<full task description with plan>"
```

Include the plan and acceptance criteria in the task description so agents have full context.

## CLI Reference

```bash
# List available workflows
antfarm workflow list

# Start a run (after planning!)
antfarm workflow run <workflow-id> "<detailed task>"

# Check status
antfarm workflow status "<task>"

# Run orchestration check
antfarm check

# View logs
antfarm logs
```

## Example Planning Conversation

**User:** Build a landing page for the project

**You:** Before I kick off the workflow, let me make sure I understand what you need:
- What sections should the page have?
- Any specific messaging or copy?
- Design style - minimal, bold, technical?
- What assets do we have (logo, images)?

**User:** [provides details]

**You:** Here's my plan:
1. Create landing/ directory with index.html
2. Hero section with logo and tagline
3. "How it works" section with 3 steps
4. Installation/quickstart code block
5. Footer with links

Acceptance criteria:
- [ ] Page loads and displays correctly
- [ ] Logo renders properly
- [ ] All sections present
- [ ] Mobile responsive

Does this look right?

**User:** Yes, go ahead

**You:** [Now runs workflow with full context]

## Monitoring

The orchestrator cron runs every 30s and advances workflows automatically. Check status with:
```bash
antfarm workflow status "<task>"
antfarm check --verbose
```

If a workflow is blocked, report the error and help the user resolve it.
