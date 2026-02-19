# Debugging Protocol Reference

> Systematic debugging methodology for all agents.
> Use this protocol when a bug is encountered or a fix fails.

---

## Core Principle

**After 3 failed fix attempts, STOP fixing and START questioning the architecture.**

Most persistent bugs are not surface-level issues. They are symptoms of deeper structural problems. Applying more patches to a flawed design only makes things worse.

---

## Phase 1: Root Cause Investigation

Before writing any fix, understand the problem completely.

### Step 1: Reproduce the Bug
- Write down the exact steps to reproduce
- Note the expected behavior vs actual behavior
- Check if the bug is consistent or intermittent
- Check if it happens in all environments (dev, prod, different browsers)

### Step 2: Read the Error
- Read the FULL error message and stack trace
- Identify the exact file, line, and function where the error occurs
- Read the code at that location - understand what it is trying to do
- Do NOT assume you know the cause before reading the code

### Step 3: Trace the Data Flow
- Follow the data from input to the point of failure
- Log intermediate values at each step
- Identify where the data becomes unexpected
- Check all transformations, mappings, and conversions

### Step 4: Check Recent Changes
- What changed since it last worked? (git diff, git log)
- Was a dependency updated?
- Was a configuration changed?
- Was a related feature modified?

### Step 5: Isolate the Component
- Can you reproduce with the simplest possible input?
- Does the bug happen in isolation (outside the full system)?
- Remove layers until you find the minimal reproduction

---

## Phase 2: Pattern Analysis

After understanding the root cause, look for patterns.

### Step 1: Is This a Known Pattern?
Common bug patterns and their real causes:
- **"It works locally but not in prod"** - Environment variable, CORS, or path issue
- **"It works sometimes"** - Race condition, timing dependency, or caching
- **"It broke after update"** - Breaking API change or peer dependency conflict
- **"Data is wrong/missing"** - Schema mismatch, migration not run, or stale cache
- **"UI looks wrong"** - CSS specificity, z-index stacking, or missing styles
- **"Works in Chrome but not Firefox"** - Non-standard API usage

### Step 2: Check the Boundaries
Most bugs occur at boundaries between components:
- API request/response boundaries (serialization, type mismatches)
- Database query boundaries (SQL types vs JS types, null handling)
- Component boundaries (props, state synchronization)
- System boundaries (file paths, OS differences, encoding)

### Step 3: Check Assumptions
List every assumption the code makes and verify each one:
- "This value is never null" - Is it?
- "This array is sorted" - Is it?
- "This API returns X" - Does it?
- "This runs before that" - Does it?

### Step 4: Identify the Category
- **Logic error** - Code does the wrong thing (fixable with code change)
- **Data error** - Input data is unexpected (fixable with validation)
- **Timing error** - Operations happen in wrong order (needs architectural fix)
- **Configuration error** - Settings are wrong (fixable with config change)
- **Design error** - The approach is fundamentally flawed (needs redesign)

---

## Phase 3: Hypothesis and Testing

Use the scientific method. Do not guess-and-check.

### Step 1: Form a Hypothesis
- State clearly: "I believe the bug is caused by X because Y"
- Your hypothesis must explain ALL observed symptoms
- If it only explains some symptoms, the hypothesis is incomplete

### Step 2: Predict the Outcome
- "If my hypothesis is correct, then changing Z should result in W"
- Write down the prediction BEFORE making the change

### Step 3: Test the Hypothesis
- Make ONE change at a time
- Run the reproduction steps
- Compare the result to your prediction

### Step 4: Evaluate
- If the prediction was correct: proceed to implementation
- If wrong: revise the hypothesis and repeat
- NEVER stack multiple untested changes

---

## Phase 4: Implementation

### Step 1: Single Fix
- Make the minimal change that fixes the root cause
- Do NOT fix adjacent issues at the same time
- Do NOT refactor while fixing a bug

### Step 2: Verify the Fix
- Run the reproduction steps - bug should be gone
- Run the full test suite - no regressions
- Test edge cases around the fix
- Test in the environment where the bug was reported

### Step 3: Add a Regression Test
- Write a test that would have caught this bug
- The test should fail WITHOUT the fix and pass WITH it
- Include the test in the commit with the fix

### Step 4: Document
- Commit message explains the root cause, not just the symptom
- Good: "Fix race condition in user session initialization - session was being read before write completed"
- Bad: "Fix login bug"

---

## The 3-Strike Rule

After 3 failed fix attempts:

### STOP and ask these questions:
1. **Am I fixing the right thing?** Maybe the bug is elsewhere and I am seeing a symptom.
2. **Is the architecture sound?** Maybe the design makes this bug inevitable.
3. **Am I missing context?** Maybe there is a dependency, configuration, or interaction I do not know about.
4. **Should I rewrite this section?** Sometimes 10 lines of fresh code is better than 10 patches.

### Escalation Path
1. Attempt 1-3: Try targeted fixes based on hypothesis
2. After attempt 3: Step back, re-read ALL related code, form new hypothesis
3. After attempt 5: Consider if the feature needs architectural redesign
4. After attempt 7: Escalate to human with full analysis report

---

## Red Flags (Signs You Are Debugging Wrong)

- **Adding more try/catch blocks** - You are hiding the bug, not fixing it
- **Adding more null checks** - The root cause is upstream
- **The fix is longer than 20 lines** - You might be patching around a design issue
- **You cannot explain why the fix works** - You do not understand the problem
- **The same area breaks again** - Structural issue needs redesign
- **Adding setTimeout/delay to fix timing** - Race condition needs proper synchronization
- **Disabling a feature to fix another** - Coupling issue needs decoupling

---

## Debugging Tools and Techniques

### Console/Logging
- Log at boundaries: function entry/exit, API calls, state changes
- Include context: what operation, what input data, what user/session
- Use structured logging (JSON) for parseable output
- Remove debug logs before committing

### Binary Search for Bugs
When you do not know where the bug is:
1. Find a known-good state (commit, version, or input)
2. Find the current broken state
3. Test the midpoint
4. Narrow down by halves until you find the exact change

### Rubber Duck Debugging
Before asking for help, explain the problem out loud:
1. What is the expected behavior?
2. What is the actual behavior?
3. What have I tried so far?
4. What are my current hypotheses?

If you cannot clearly explain these 4 points, you have not understood the problem well enough to fix it.
