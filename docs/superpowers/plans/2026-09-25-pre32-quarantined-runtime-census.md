# Pre32 quarantined-runtime census V5 plan

Root is the sole writer and PR/delivery owner. Review agents are read-only.

- [x] RED: same-transaction fixture expects one additional exact quarantine count after the V4 active-row read, with canonical zero and nonzero results; malformed/extra/failed rows refuse. Independent review added an accessor-index RED fixture.
- [x] GREEN: add the versioned V5 read-only snapshot without changing V4, legacy predicates, migrations, services, guards, or other result shapes. The result container is normalized by descriptors before row access.
- [x] Focused RED/GREEN, cutover 384/384, pure 121/121, manifest 18/18, scripts 791/791, genuine 43/43, TypeScript and source/contract checks passed. Independent read-only review found no actionable issue after the accessor-index RED fix.
- [x] Staged diff check: exactly four scoped files; `git diff --cached --check` clean.
- [ ] Scoped PR and exact-head checks, SHA-bound merge, normal clean-main build, selected source fast-forward with historical dist/CLI proof, read-only host DB cross-check.
