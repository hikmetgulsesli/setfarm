# Task6A native bootstrap prefix policy v2 implementation plan

> **For agentic workers:** Root alone implements/delivers; parallel agents review
> read-only, never edit or replay recipes.

**Goal:** Compose existing actual C remap with one fail-closed private FD prefix.
**Architecture:** Three stdio slots plus authoritative old eight-slot object,
fixed recorded prerequisites and shared sticky rejection.
**Tech Stack:** C11, fixed clang/ld/nm/otool/Node/SDK26.5, finite actual C oracle.
**Spec:** ../specs/2026-10-07-task6a-native-bootstrap-prefix-policy-v2-design.md

## Constraints / File Map

Exactly5 new files: paired docs, header/C/test named in spec. PR275 aggregate19.
Freeze old source/docs/tests/drivers/recipes/S10e files/user dirty files/CLI/
selected dist/journal. No physical adapter, integrated physical source, terminal
relaxation, runtime flag, service/DB change or accepted recipe replay. Reuse
existing isolated clone/branch, root only writer; no dependency installation.

## Task: shared policy

**Consumes:** Exact sf_prefix_policy_v2/ports and byte-unchanged
sf_remap_policy_run_v2 with the embedded object as sole mutable storage.
**Produces:** sf_bootstrap_prefix_run_v2 private model outcomes, never authority.

- [ ] Independent written nomination/input/preservation/reentry review.
- [ ] Create exact declared header, independent C-driver/JS test; new C absent.
  Driver manually initializes all fields and checks literal callback trace:
  genesis1..9, DISABLE,MASK,ENTRY, close3/4/5/6, dup7→3/bind7, dup8→4/bind8,
  close7/8,POST. Driver-only missing implementation definition:

      enum sf_prefix_result_v2 sf_bootstrap_prefix_run_v2(
          struct sf_prefix_policy_v2 *p, const struct sf_prefix_ports_v2 *ports) {
          (void)p; (void)ports; return SF_P_UNAVAILABLE;
      }

  Under absence mode return71; ordinary unwrapped exit0 oracle must FAIL.
- [ ] ONE admitted missing-C RED; complete original compile/link/import/run
  returns and checked-once holder closes. Setup/import errors are not RED.
- [ ] Minimal declared implementation after RED. Same embedded object; no
  physical calls/second ledger. Required at enum-returning outer boundaries:

      if (p->burned || p->remap.burned) {
          p->burned = 1;
          p->remap.burned = 1;
          return SF_P_BURNED;
      }

  First seal its own returned receipt, including all pre-remap ports. Close/dup
  wrappers return the ORIGINAL raw struct unchanged after synchronizing BOTH
  burns; S10e then seals its sole action and known settlement/acquisition before
  stopping. Binding wrapper seals its own receipt, synchronizes BOTH burns and
  returns the ORIGINAL int. Never return SF_P_BURNED as an operation result.
- [ ] ONE new GREEN full matrix; preserve compile/link/import/dependency/run,
  EOFs and holders. Do not infer any physical guard/owner or full build.
- [ ] Separately nominate one omitted-cross-burn private derivative, expect
  ordinary oracle FAIL; preserve originals, no baseline/old recipe replay.
- [ ] Independent read-only behavior/diff/evidence reviews. Recheck original
  frozen pins, new source/driver pins, default SKIP and adjacent-flag refusal.
- [ ] Root scoped conventional commit/push and draft PR275 body after gates,
  File Map19 and exact limitations; never main commit/merge/activation.

## Self-review

Every returned port has a premarked receipt and failure stops later ports.
Ready/context are scheduling/confinement, not physical identity authority.
Unknown/pending suffix remains owned in model; no restoration/exit token.
Prefix excludes nonFD owners. Existing physical-source/effect gate and universal
terminal contract stand. No placeholder physical adapter belongs to this plan.
