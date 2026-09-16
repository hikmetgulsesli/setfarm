# Fixed-stage cutover refusal diagnostics

Root sole writer; agents review read-only. Approved preserved-installation
cutover remains the objective. This slice diagnoses refusals, not admission.

## Evidence

PR136 clean-main normal build passed. Authenticated base inspect succeeded in
10.70s. The fresh composed host inspect refused after75.61s with only the generic
BOOTSTRAP_REFUSED code. Neither elapsed time nor a rejected observation identifies
the failing stage. Do not guess, retry blindly, weaken guards or publish intent.

## Design

Keep exit1 and generic refusal prefix. Only inspect-default-context may append
one fixed-schema diagnostic containing allowlisted bootstrap/owner stages and
an optional fixed launcher substage. No caught message, stack, cause, path, env,
credential-derived hash or unbounded data. Success schemas and all other CLI
mode output contracts remain unchanged. Diagnostic data never grants authority.

Set the local stage immediately before each operation. Preserve the original
failed stage across complete reverse cleanup; separately report cleanup failure.
The authenticated owner attaches a frozen finite diagnostic to its generic Error;
bootstrap validates exact own-data fields against fixed allowlists, never invokes
accessors or serializes an arbitrary error. Launcher diagnostics follow the same
rule and disclose only local control-flow stage, not underlying native errors.

## File map and sequence

- scripts/deployment-cutover-default-context.mjs: owner local phase tracking and
  sanitized diagnostic attachment after resource draining.
- scripts/deployment-cutover.mjs: bootstrap stage tracking, exact owner diagnostic
  validation, mode-specific finite stderr record.
- src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts:
  default-only passive qualification stage; strict legacy APIs unchanged.
- Existing owner/bootstrap/launcher tests and composed integration: failing
  stage attribution, malicious/accessor diagnostic inputs, secrecy sentinels,
  cleanup loss, unchanged success and unchanged no-DB-before-proof behavior.

- [x] RED diagnostic tests before implementation (owner11, bootstrap6, launcher4).
- [x] GREEN focused/composed gates and independent review.
- [ ] Reviewed scoped PR delivery.
- [ ] Normal clean-main build; one fresh host epoch, act on exact evidence.

No service/link/archive/DB effects. Controller, filesystem/helper/phase and
journaled-transition blockers remain unchanged. No whole-goal completion claim.

## Verification ledger

Owner41/41; launcher76/76; composed4/4 passed on final implementation. Broader
cutover320/320 and serial genuine28/28 passed; bootstrap73/73 plus final targeted
accessor/cleanup3/3; source manifest18/18, noemit, English1564/path892 and diffcheck
passed. Independent review found no blockers; suggested second-label stage reset
applied, then final launcher/composed gates rerun. Getter side-effect sentinels
prove non-invocation, not merely suppression of their thrown errors. Dual-failure
tests preserve the first failure and drain resources while marking cleanup loss.
