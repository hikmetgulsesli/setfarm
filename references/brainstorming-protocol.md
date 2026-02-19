# Brainstorming Protocol Reference

> Design exploration methodology before implementation.
> Applicable to planner agent for architectural decisions.

---

## Core Principle

**Explore before committing.** Never jump to the first solution that comes to mind. Consider at least 2-3 approaches, evaluate trade-offs, and choose deliberately.

---

## When to Use This Protocol

Use this protocol for any decision that:
- Affects the project architecture
- Determines the technology stack
- Establishes patterns that other stories will follow
- Cannot be easily changed later (database schema, API contracts)

Do NOT use for trivial decisions (variable naming, file location within conventions).

---

## Step 1: Define the Problem Clearly

Before exploring solutions, write down:
- **What** needs to be accomplished (the goal, not the method)
- **Constraints** (time, resources, existing tech stack, team skill)
- **Non-negotiables** (must-haves vs nice-to-haves)
- **Success criteria** (how will you know the solution works?)

---

## Step 2: Generate 2-3 Approaches

For each decision point, propose at least 2 distinct approaches:

### Approach Template
```
### Approach A: [Name]
**Description:** One paragraph explaining the approach
**Pros:**
- Pro 1
- Pro 2
**Cons:**
- Con 1
- Con 2
**Complexity:** Low / Medium / High
**Reversibility:** Easy / Hard / Irreversible
**Best for:** When/why this approach shines
```

### Rules
- Approaches must be genuinely different (not minor variations)
- Include at least one simple/boring approach (it is often the right one)
- Include at least one innovative approach (explore the design space)
- Be honest about cons - no approach is perfect

---

## Step 3: Evaluate Trade-offs

For each approach, consider:

### Technical
- How much code/complexity does this add?
- How does this affect performance?
- How does this interact with existing systems?
- What are the maintenance implications?

### Product
- Does this serve the user well?
- Is this the simplest thing that works?
- Will this scale to the next order of magnitude?

### Risk
- What could go wrong?
- How hard is it to change course later?
- What is the blast radius if this approach fails?

---

## Step 4: Make a Recommendation

After evaluating:
1. State your recommended approach clearly
2. Explain WHY (not just WHAT)
3. Acknowledge what you are trading away
4. Define a "pivot point" - when would you reconsider this choice?

---

## Step 5: Document the Decision

Include in the plan output:
```
DECISION: [What was decided]
ALTERNATIVES_CONSIDERED: [Brief list of other approaches]
RATIONALE: [Why this approach was chosen]
TRADE_OFFS: [What we are accepting/sacrificing]
```

This documentation helps future agents (and humans) understand why things were built a certain way.

---

## Anti-Patterns

- **Analysis paralysis** - 2-3 approaches is enough. Do not enumerate every possible option.
- **Bike-shedding** - Spend decision energy proportional to the impact of the decision.
- **Sunk cost** - If an approach is not working, pivot. Prior effort is not a reason to continue.
- **Premature optimization** - The simplest approach that meets requirements is usually best.
- **Design by committee** - A clear, opinionated choice beats a compromise that pleases nobody.
