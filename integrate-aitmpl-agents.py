#!/usr/bin/env python3
"""Integrate aitmpl.com agent knowledge into setfarm workflow AGENTS.md files.

Round 4: Agent-sourced knowledge (debugger, error-detective, code-reviewer,
database-optimization, test-engineer, security-auditor, devops-troubleshooter,
monitoring-specialist, deployment-engineer, postgres-pro, incident-responder,
api-security-audit, architect-review, backend-architect, task-decomposition-expert).

Only adds NEW knowledge not already present from rounds 2-3.
"""
import os

REPO = os.path.expanduser("~/.openclaw/setfarm-repo")

# === Condensed rules from aitmpl agents ===

FIXER_DEBUG = """

## Systematic Debugging Methodology (from debugger + error-detective agents)

### Debugging Loop
1. **Reproduce** — Create minimal reproduction case first
2. **Hypothesize** — Form 2-3 theories about root cause
3. **Experiment** — Design targeted tests to eliminate hypotheses
4. **Evidence** — Collect logs, stack traces, metrics as proof
5. **Fix & Verify** — Implement fix, verify no side effects
6. **Document** — Record root cause and prevention measures

### Debugging Techniques
- **Binary search**: Bisect code/commits to isolate change that broke it
- **Differential debugging**: Compare working vs broken state (env, config, data)
- **Five Whys**: Ask WHY 5 times to reach true root cause, not symptoms
- **Timeline reconstruction**: Map events chronologically to find trigger

### Common Bug Patterns
- Off-by-one errors in loops and array indexing
- Null/undefined access on optional fields
- Race conditions in concurrent operations (SQLite, async)
- Resource leaks (unclosed connections, file handles)
- State mutation in shared objects
- Integer overflow in counters/IDs

### Error Correlation
- Correlate errors by TIME (what changed just before failures started?)
- Correlate by SERVICE (which upstream/downstream services are affected?)
- Correlate by LOAD (does it happen under high concurrency only?)
- Check for cascade effects — one failure triggering downstream failures
"""

INVESTIGATOR_ROOT_CAUSE = """

## Root Cause Analysis Patterns (from error-detective agent)

### Investigation Framework
1. **Symptom inventory** — List ALL observed symptoms, not just the reported one
2. **Timeline construction** — When did it start? What changed? Any patterns?
3. **Dependency mapping** — What services/components are involved?
4. **Anomaly detection** — What's different from normal operation?
5. **Evidence synthesis** — Combine findings into causal chain

### Error Pattern Categories
- **Transient**: Network timeouts, temporary resource exhaustion → retry with backoff
- **Persistent**: Bug in code, misconfiguration → requires code/config fix
- **Intermittent**: Race conditions, resource contention → hardest to debug, needs load testing
- **Cascading**: One failure triggers chain reaction → find the FIRST failure in chain

### Cascade Analysis Checklist
- [ ] Identify the originating failure (first error in timeline)
- [ ] Map failure propagation path through services
- [ ] Check circuit breakers — did they fire? If not, why?
- [ ] Check timeouts — are they set too high, causing blocking?
- [ ] Check retry storms — are retries amplifying the problem?
- [ ] Check resource exhaustion — connection pools, memory, disk
"""

TRIAGER_CLASSIFICATION = """

## Bug Triage & Classification (from error-detective + incident-responder agents)

### Severity Classification
| Severity | Impact | Response Time | Examples |
|----------|--------|---------------|----------|
| P0/Critical | Service down, data loss | < 15 min | Pipeline stuck, DB corruption |
| P1/High | Major feature broken | < 1 hour | Workflow can't start, agent crash |
| P2/Medium | Degraded performance | < 4 hours | Slow queries, high memory |
| P3/Low | Minor issue, workaround exists | Next sprint | UI glitch, log noise |

### Triage Decision Tree
1. Is data being lost or corrupted? → P0
2. Is the pipeline/service completely down? → P0
3. Is a critical workflow blocked? → P1
4. Is it affecting performance but still working? → P2
5. Is there a workaround available? → P3

### First Response Actions
- P0: Containment first (stop the bleeding), investigate second
- P1: Gather evidence (logs, metrics), identify affected scope
- P2: Schedule investigation, monitor for escalation
- P3: Document and add to backlog
"""

REVIEWER_CODE_QUALITY = """

## Code Review Methodology (from code-reviewer + architect-review agents)

### Review Priorities (check in this order)
1. **Security** — injection, auth bypass, data exposure
2. **Correctness** — logic errors, edge cases, error handling
3. **Performance** — O(n^2) in loops, missing indexes, N+1 queries
4. **Maintainability** — naming, complexity, duplication
5. **Architecture** — SOLID compliance, dependency direction, abstraction levels

### Quality Metrics to Flag
- Cyclomatic complexity > 10 per function → needs refactoring
- Function > 50 lines → consider splitting
- File > 500 lines → consider modular decomposition
- Same logic in 3+ places → extract to shared function
- Nested callbacks > 3 levels deep → refactor to async/await

### Architecture Fit Check
- [ ] Changes follow existing patterns (don't introduce new paradigms without reason)
- [ ] Dependencies flow in one direction (no circular imports)
- [ ] New components have clear boundaries and single responsibility
- [ ] Configuration externalized (env vars, config files — not hardcoded)
- [ ] Error handling is consistent with project conventions
"""

SETUP_MONITORING = """

## Monitoring & Observability Rules (from monitoring-specialist agent)

### Four Golden Signals (monitor ALL of these)
1. **Latency** — Time to serve a request (track p50, p90, p99)
2. **Traffic** — Requests per second, concurrent users
3. **Errors** — Error rate as percentage of total requests
4. **Saturation** — How full is each resource (CPU, memory, disk, connections)

### Alert Design Principles
- Alert on SYMPTOMS not causes (alert on "error rate > 5%", not "CPU > 90%")
- Every alert must have a clear ACTION the responder can take
- Avoid alert fatigue: group related alerts, suppress flapping
- Use severity levels: page (P0-P1), ticket (P2), log (P3)

### Monitoring Stack Integration
- Prometheus scrape interval: 15s for services, 60s for infrastructure
- Grafana dashboards: one per service, one overview
- Log format: structured JSON with timestamp, level, service, message, trace_id
- Uptime checks: HTTP health endpoints every 30s, alert after 2 failures
"""

SETUP_DEPLOYMENT_ADV = """

## Deployment Strategy Rules (from deployment-engineer agent)

### Deployment Safety Checklist
- [ ] Health check endpoint responds before routing traffic
- [ ] Rollback plan: previous version instantly deployable
- [ ] Database migrations are backward-compatible (additive only)
- [ ] Feature flags for risky changes (can disable without redeploy)
- [ ] Smoke tests run automatically after deployment

### DORA Metrics Targets
- Deployment Frequency: daily or more
- Lead Time for Changes: < 1 hour from commit to production
- Mean Time to Recovery (MTTR): < 30 minutes
- Change Failure Rate: < 5%

### Zero-Downtime Deployment Pattern
1. Deploy new version alongside old (blue-green or rolling)
2. Run health checks on new version
3. Gradually shift traffic to new version
4. Monitor error rates during transition
5. Rollback immediately if error rate spikes
6. Remove old version after bake period
"""

FIXER_INCIDENT = """

## Incident Response Patterns (from incident-responder agent)

### Incident Response Steps
1. **Detect** — Alert fires or user reports issue
2. **Assess** — Determine severity (P0-P3) and blast radius
3. **Contain** — Stop the bleeding (rollback, disable feature, scale up)
4. **Investigate** — Find root cause while service is stable
5. **Fix** — Implement permanent fix
6. **Verify** — Confirm fix resolves the issue, no side effects
7. **Document** — Postmortem with timeline, root cause, action items

### Containment Strategies (fastest first)
- **Rollback** — Revert to last known good state
- **Feature toggle** — Disable the broken feature
- **Scale up** — Add resources if it's a capacity issue
- **Circuit breaker** — Cut off failing dependency
- **Traffic shed** — Redirect traffic away from broken path

### Postmortem Template
- **Summary**: One sentence describing what happened
- **Impact**: Who was affected, for how long
- **Timeline**: Key events with timestamps
- **Root Cause**: The underlying issue (not the trigger)
- **Action Items**: Preventive measures with owners and deadlines
"""

DEVELOPER_DB_ADVANCED = """

## Advanced PostgreSQL Patterns (from postgres-pro + database-optimization agents)

### Index Selection Guide
| Access Pattern | Index Type | Example |
|---------------|-----------|---------|
| Equality lookup | B-tree | `WHERE status = 'active'` |
| Range queries | B-tree | `WHERE created_at > '2024-01-01'` |
| Text search | GIN + pg_trgm | `WHERE name ILIKE '%search%'` |
| JSONB queries | GIN | `WHERE data @> '{"type": "x"}'` |
| Array contains | GIN | `WHERE tags @> ARRAY['tag1']` |
| Large table, range | BRIN | `WHERE id BETWEEN 1000 AND 2000` |
| Filtered subset | Partial B-tree | `WHERE status = 'active'` (partial) |

### Vacuum & Maintenance
- autovacuum_vacuum_scale_factor: 0.05 for hot tables (default 0.2 is too lazy)
- Monitor dead tuple ratio: `SELECT relname, n_dead_tup FROM pg_stat_user_tables`
- `pg_repack` for zero-downtime table/index rebuilds
- Regular `ANALYZE` after bulk data loads

### Connection Pool Sizing
- Formula: `pool_size = (2 * CPU_cores) + effective_spindle_count`
- For SSD: `pool_size = (2 * CPU_cores) + 1`
- Set statement_timeout to prevent long-running queries (e.g., 30s)
- Monitor with: `SELECT count(*), state FROM pg_stat_activity GROUP BY state`
"""

SCANNER_SECURITY_ADV = """

## Advanced API Security Audit (from api-security-audit + security-auditor agents)

### OWASP API Top 10 Checklist
- [ ] **Broken Object Level Authorization** — Can user A access user B's data by changing ID?
- [ ] **Broken Authentication** — Are tokens properly validated? Expiry set?
- [ ] **Excessive Data Exposure** — Does API return more fields than needed?
- [ ] **Lack of Resource Limiting** — Rate limiting on all endpoints?
- [ ] **Broken Function Level Authorization** — Can regular user call admin endpoints?
- [ ] **Mass Assignment** — Can user set admin=true by adding field to request?
- [ ] **Security Misconfiguration** — Debug mode off? Default credentials changed?
- [ ] **Injection** — All inputs parameterized? No string concatenation in queries?

### JWT Security Checklist
- [ ] Secret key is strong (256+ bits) and rotated periodically
- [ ] Token expiry is short (15 min access, 7 day refresh)
- [ ] Algorithm is explicit (RS256 or HS256, never `none`)
- [ ] Issuer and audience claims are validated
- [ ] Refresh tokens are stored securely and revocable
- [ ] Token payload doesn't contain sensitive data (passwords, PII)

### Security Headers (must-have)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: default-src 'self'`
- `X-XSS-Protection: 0` (CSP is the modern replacement)
"""

PLANNER_DECOMPOSITION = """

## Task Decomposition Framework (from task-decomposition-expert agent)

### Goal Analysis Steps
1. **Clarify objective** — What does "done" look like? What are the acceptance criteria?
2. **Identify constraints** — Timeline, resources, dependencies, technical limitations
3. **Break into phases** — Group related tasks into sequential phases
4. **Identify parallelism** — Which tasks can run concurrently?
5. **Define milestones** — Checkpoints where progress can be validated

### Decomposition Hierarchy
- **Epic** → Top-level goal (e.g., "Add user authentication")
- **Story** → User-facing feature (e.g., "Login with email/password")
- **Task** → Technical work item (e.g., "Create JWT middleware")
- **Subtask** → Atomic action (e.g., "Add token validation function")

### Estimation Heuristics
- If you can't estimate it, break it down further
- If it takes > 2 days, it's too big — split it
- Include time for testing, review, and deployment
- Add 30% buffer for unknowns on new codebases
"""

# === Mapping ===

rules_map = {
    # feature-dev
    f"{REPO}/workflows/feature-dev/agents/developer/AGENTS.md": [
        ("Advanced PostgreSQL Patterns", DEVELOPER_DB_ADVANCED),
    ],
    f"{REPO}/workflows/feature-dev/agents/planner/AGENTS.md": [
        ("Task Decomposition Framework", PLANNER_DECOMPOSITION),
    ],
    f"{REPO}/workflows/feature-dev/agents/reviewer/AGENTS.md": [
        ("Code Review Methodology", REVIEWER_CODE_QUALITY),
    ],
    # bug-fix
    f"{REPO}/workflows/bug-fix/agents/fixer/AGENTS.md": [
        ("Systematic Debugging Methodology", FIXER_DEBUG),
        ("Incident Response Patterns", FIXER_INCIDENT),
    ],
    f"{REPO}/workflows/bug-fix/agents/triager/AGENTS.md": [
        ("Bug Triage & Classification", TRIAGER_CLASSIFICATION),
    ],
    f"{REPO}/workflows/bug-fix/agents/investigator/AGENTS.md": [
        ("Root Cause Analysis Patterns", INVESTIGATOR_ROOT_CAUSE),
    ],
    # security-audit
    f"{REPO}/workflows/security-audit/agents/fixer/AGENTS.md": [
        ("Systematic Debugging Methodology", FIXER_DEBUG),
        ("Incident Response Patterns", FIXER_INCIDENT),
    ],
    f"{REPO}/workflows/security-audit/agents/scanner/AGENTS.md": [
        ("Advanced API Security Audit", SCANNER_SECURITY_ADV),
    ],
    # shared
    f"{REPO}/agents/shared/verifier/AGENTS.md": [
        ("Code Review Methodology", REVIEWER_CODE_QUALITY),
    ],
    f"{REPO}/agents/shared/setup/AGENTS.md": [
        ("Monitoring & Observability Rules", SETUP_MONITORING),
        ("Deployment Strategy Rules", SETUP_DEPLOYMENT_ADV),
    ],
}

# === Apply ===

total_added = 0

for filepath, rule_list in rules_map.items():
    if not os.path.exists(filepath):
        print(f"[SKIP] Not found: {filepath}")
        continue

    with open(filepath, "r") as f:
        content = f.read()

    added = []
    for check_text, rule_block in rule_list:
        if check_text in content:
            print(f"[SKIP] {os.path.basename(os.path.dirname(filepath))}: already has '{check_text}'")
            continue
        with open(filepath, "a") as f:
            f.write(rule_block)
        added.append(check_text)
        total_added += 1

    if added:
        agent = os.path.basename(os.path.dirname(filepath))
        wf = filepath.split("/workflows/")[1].split("/")[0] if "/workflows/" in filepath else "shared"
        print(f"[OK] {wf}/{agent}: Added {', '.join(added)}")

print(f"\n=== aitmpl agent integration complete: {total_added} rule blocks added ===")
