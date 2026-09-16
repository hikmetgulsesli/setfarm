# Passive retry HOME qualification implementation plan

> **For agentic workers:** Root is sole writer. Independent agents review
> bounded design and implementation read-only; no delivery or live effects.

**Goal:** Qualify the actual default launcher HOME from existing scheduled
retries, without launching processes or exposing environment secrets.

**Architecture:** An authenticated fixed Python source is supplied as a data-only
module by the existing bootstrap hook. A fixed isolated transport obtains a
bounded native measurement. A zero-input owner binds the launcher-derived PID,
held selected build, Node, env absence and module resolution before private DB
census; strict existing wrappers remain strict. Samples are operation-local.

**Tech Stack:** Node builtin bootstrap, TypeScript held contexts, trusted Xcode
Python3 ctypes and Darwin sysctl/libproc. No new installed dependency.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`

## Constraints and acceptance

- Preserve old installation/eight archives, all ports and ordinary-start guards.
- No start/suspend/extend of a retry. Timeout or missed sampling is unavailable.
- Python is an explicit trusted host prerequisite: fixed `/usr/bin/python3`,
  `-I -S -B -c`, fresh sanitized environment, fixed cwd, bounded I/O/time.
- KERN_PROCARGS2 is mutable stack evidence, not immutable exec history. Require
  reviewed cooperative startup without argv/environment rewriting and no empty
  launcher environment entries; never infer these premises from matching reads.
- Parse exactly argc argv strings, including empty arguments. Require complete
  private expected environment equality, unique HOME=account, explicit extra
  NUL boundary and a nonempty structurally valid possibly erased Apple suffix.
  Trusted system startup may erase Apple strings: consume surviving strings
  across zero runs within the fixed buffer bound. Reject suffix HOME,
  zero-padding ambiguity, malformed strings, duplicate keys and truncation.
- Native buffers remain mutable and are zeroed in finally; no raw environment,
  secret-derived hashes or Apple entropy in output/errors.
- Exact136byte proc_bsdinfo, documented Darwin64 offsets/widths, exact return
  lengths, two full procargs reads and identity/path bracketing are required.
- A sampled running retry is not idle/zero-owner. Fresh idle qualification must
  follow both samples. Controller/filesystem-phase ownership remains separate.

## File map

- `scripts/deployment-cutover-passive-home.py`: pure private parser and bounded
  native bridge; no CLI path to service operations or filesystem writes.
- `scripts/__tests__/deployment-cutover-passive-home.test.js`: synthetic binary
  parser tests, owned-child native measurement and sanitized-refusal checks.
- `scripts/deployment-cutover-passive-home.mjs`: fixed private transport importing
  authenticated data-only Python source; PID is a locator, never authority.
- `scripts/__tests__/deployment-cutover-passive-transport.test.js`: fixed launch
  contract and strict sanitized measurement refusal tests.
- `scripts/deployment-cutover.mjs`: source closure/data hook and owning invocation.
- `scripts/deployment-cutover-default-context.mjs`: zero-input held composition.
- `src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts`:
  shared private config checks and separate held defaults mode, private URL/DB.
- Existing launcher/bootstrap fixtures and tests: source authentication,
  running/sample/idle lifecycle, wrong identity, no DB before full qualification.

## Task1: Binary parser and read-only native bridge

- [x] Write synthetic success test using exact executable/argv/environment;
  run `node --test scripts/__tests__/deployment-cutover-passive-home.test.js`
  and observe missing-helper RED.
- [x] Implement `qualify_buffer(buffer, length, expected)` returning no raw data;
  consume all bytes under the acceptance rules above. Test empty argv, wrong or
  duplicate HOME, suffix HOME, absent padding/suffix, redaction and truncation.
- [x] Add native bridge tests before implementation: private synthetic child,
  exact PID/credentials/path and two reads; wrong identity and vanished child
  refuse. Assert fixed error text and no sentinel leakage.
- [x] Implement explicit ctypes ABI/signatures and bounded sysctl/libproc calls,
  zero native buffers on every exit, compare before/after identity and reads.

Initial15tests pass. Native child exposed Darwin ARG_MAX=1048576 plus4byte argc
and107erased Apple bytes after the exact environment. Both discoveries were
fixed with failing tests; independent review qualified the latter refinement.
No actual launcher environment has been read; owning provenance remains pending.

## Task2: Authenticate transport and compose existing held lifetimes

- [x] Add bootstrap tampered/missing Python source RED tests. Extend closure and
  hook with exact file URL data-only source, not Python pathname evaluation.
- [x] Add fixed transport flags/environment/I/O schema tests; implement private
  transport with generic refusal and no caller-supplied source/proof callbacks.
- [ ] Add launcher lifecycle tests: privately derived fixed-label PID, account,
  plist, loaded env, executable/argv/start drift; complete samples then fresh idle.
  Factor shared checks while preserving strict public APIs and schemas.
- [ ] Add owner tests: retain profile/resolution/env/launcher contexts through
  DB await; fail before DB on incomplete qualification; drain every failure path.
  Implement one zero-input owner. Remove only actually discharged blockers.

## Task3: Verify and deliver

- [x] Independent source/test review, focused regressions, affected bootstrap
  group, TypeScript noemit and source/manifest contracts.
- [ ] Scoped reviewed PR, independent clean-main normal build; then bounded
  passive real-host sampling only if all parser/provenance requirements hold.
- [ ] Record actual evidence and remaining controller/phase/journal work. Do not
  claim successful HOME or full project closure from synthetic tests.

## Supporting-slice delivery evidence

The native bridge, fixed transport and authenticated source hook are delivered
first without a new inspection endpoint. Launcher/default-owner wiring above
remains unchecked; no blocker is removed by this supporting slice.

- Focused native/parser/transport:37/37passed, including actual owned-child
  entry, vanished-child refusal and all sensitive-buffer cleanup fault paths.
- Affected bootstrap/profile group:92/92passed, including the standard genuine
  integration command. Source manifest18/18passed.
- TypeScript noemit, English1557files, path888files and diff checks passed.
- Two independent read-only reviews cleared the helper/authentication seam;
  an outside-bootstrap import regression was added from review feedback.
- No target launcher environment, raw secret, service/link/archive or DB effect.

Pre-merge physical regression: launching the owned child through a real symlink
failed the original single-path comparison. Darwin saves the invoked path while
proc_pidpath reports the physical executable. The private request now requires
both `launchExecutable` and physical `executable`; the owner must bind both to
held Node/PATH evidence. Physical and symlink child tests pass and crossed
launch/physical paths refuse. The92test broad group preceded this narrow fix;
focused native/transport and Python-source bootstrap tests cover the final fix.

Cloud review identified native tests incorrectly running on non-Darwin hosts.
Only the10Darwin API cases now have an explicit platform skip; pure parser and
transport tests remain enabled. A subprocess emulating Node's platform selector
proved RED0/10skips then GREEN10/10skips with the positive parser still running.
This is test-selection evidence, not a claim of a physical Linux suite run.
