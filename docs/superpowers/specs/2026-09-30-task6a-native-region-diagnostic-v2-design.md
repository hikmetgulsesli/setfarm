# Task6A raw native region diagnostic v2

## Purpose and decision

Resolve a causally necessary measurement gap in the protected-origin bootstrap:
the exact vmmap formatter can change current/maximum protection fields after
native queries, and its analysis target can be an original task or a corpse.
PR253 delivers format diagnostics only, not native origin admission.

Choose an existing Apple Perl core syscall route, rather than admitting the
whole vmmap/Symbolication formatter or introducing a new compiled observer and
its compiler-origin dependency. Use only a separately reviewed ordinary process
and its own retained fork child. This choice does not solve recursive shared
cache coverage or page origin, and never grants privileged/production authority.
Root remains the only writer; all historical worktrees/branches/dirty19 remain.

## Static evidence and limits

Local MacOSX26.5 SDK sys/proc_info.h defines a 96-byte ARM64 LP64 little-endian
proc_regioninfo. Offsets: protection/max/inheritance/flags u32 at0/4/8/12;
offset u64 at16; fourteen u32 fields at24..76 (behavior, wired count, tag,
resident, shared-now-private, swapped, dirtied, reference count, shadow depth,
share mode, private resident, shared resident, object ID, depth); address/size
u64 at80/88. This is independently derived layout, not compiler/probe evidence.
Local syscall.h gives SYS_proc_info336; static libsystem_kernel proc_pidinfo
calls class2. Existing Apple libperl syscall passes 64-bit numeric arguments and
mutable string pointers; its signed32 result suffices for byte counts.

Published Apple upstream [bsd_vm.c](https://raw.githubusercontent.com/apple-oss-distributions/xnu/main/osfmk/vm/bsd_vm.c)
returns containing or next TOP-LEVEL entries, copies native current/max, marks
submaps without descending and sets depth0. Anonymous entries remain present.
Optional vnode lookup follows shadows and is not COW-page origin proof.
[proc_info.c](https://raw.githubusercontent.com/apple-oss-distributions/xnu/main/bsd/kern/proc_info.c)
maps missing task map and exhaustion alike to EINVAL; policy errors can differ.
Caller footprint mode may create a synthetic terminal ledger row.
The exact host xnu-12377.121.10 tag lookup returned404; upstream main is NOT
assumed identical to this host. Kernel queries are sampled, not map-ABA fences.

## Pure decoder contract

New package Task6aOriginProcRegionV2 exposes ONLY internal
decode_region_v2($raw_bytes,$query_address). Exact two arguments; raw byte scalar
96bytes, not a reference or UTF8-flagged string. Query is a canonical nonnegative
integer <=281474976710655. No filesystem, process, syscall, compiler or network.
Use explicit little-endian unsigned fields, retaining full u64 offset as padded
lowercase hexadecimal rather than losing precision through floating-point JSON.

Region address <=281474976710655, size positive <=281474976710656, exclusive
end <=281474976710656. These conservative diagnostic bounds deny unsupported
addresses, not assert a universal native address-space limit. Integer sums are
exact in admitted64-bit Perl; require Config ivsize8 before decoding.
The returned range must contain query or start after it, and end must progress
strictly past query. Reject unknown protection bits/current outside maximum,
unknown flag bits, nonzero depth and synthetic tag UINT32_MAX. Preserve numeric
fields, submap/shared flags and current/potential executable classification.
Sharing0 is preserved as unknown; known1..8 remain diagnostics, not exemptions.
All malformed input dies with only TASK6A_ORIGIN_PROC_REGION_REFUSED.
Successful output always has scope proc-region-abi-diagnostic-only,
completeNativeClosure:false, productionAuthority:false. No PID or origin claim.

## Separate owned-child collector boundary

A later exact reviewed zero-argument ordinary Apple Perl collector may fork its
own child/private READY and EOF pipes, retaining PID/waitpid ownership. Fixed
syscall336/class2/flavor7/buffer96 only; no caller PID/address/flags/module path.
Every native call must clear/capture errno immediately and validate full96 result
before decoding, bracket exact child liveness and a nonrenewing deadline.
Sequential next-address queries are TOP-LEVEL diagnostic only; submaps remain
visible. EINVAL may be labelled terminal candidate, never complete exhaustion.
Reject zero/short/unexpected error, synthetic row, child loss, timeout or >4096
records. No foreign/live service target, suspension API, root or credential drop.
All raw bytes stay in memory. End child through private EOF; only still-unreaped
exact PID can receive bounded TERM/KILL. Unknown reap/close burns output.
No actual native query before independent all-source/test/invocation review.
This collector is not implemented by the pure decoder task.

## File map and delivery

- Create scripts/task6a-origin-proc-region-v2.pm: pure ABI decoder only.
- Create scripts/__tests__/task6a-origin-proc-region-v2.test.js: actual fixed SIP
  system Perl consumes hand-built96-byte vectors; ordinary macOS only. Unsupported
  host/root explicitly unavailable before local helper execution. No syscall.
- This spec and docs/superpowers/plans/2026-09-30-task6a-native-region-diagnostic-v2.md.
- Later collector requires a mapped follow-up plan and exact pre-effect review;
  no file/caller-selection API or effect is silently included in this delivery.

Do not modify current bootstrap publisher pins/imports/main admission, runtime
flags, DB migrations, services or selector. Source policy is refined only when
the final reviewed decoder is genuinely needed by a reviewed composed holder.
Focused TDD and existing contracts, independent exact review, ordinary PR and
guarded clean-main build apply. Default npm scripts glob already selects suite.
The remaining compiler/fence/genesis/32/33/cutover gates stay mandatory.
