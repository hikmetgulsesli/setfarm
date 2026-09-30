# Task6A ordinary owned-child raw Mach census diagnostic v2

## Decision and causal scope

The existing vmmap formatter can alter current/max permissions and observe an
analysis copy. The delivered BSD proc_regioninfo decoder cannot descend submaps.
Task6A needs genuine original-task recursive permission measurements before any
native admission decision. Choose a separately reviewed ordinary, zero-argument
Python diagnostic owning one fixed Apple Perl child. No root execution, injected
PID, live-service target, credential/DB/filesystem mutation or bootstrap import.
The owner delegated this bounded design choice and inline implementation to root.
Retain every old branch/worktree/build and the frozen dirty19 files.

Alternatives: BSD proc_info is smaller but only top-level; vmmap/Symbolication
adds target-copy and formatter ambiguity; a compiled observer adds compiler
provenance. Existing Apple CLT Python ctypes permits a typed Mach bridge without
compilation. It adds Python/libffi to the diagnostic TCB, NOT to the admitted
privileged bootstrap. All protected-origin/native authority remains denied.

## Exact ordinary execution boundary

Use only the real CLT framework application executable:
/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/Resources/Python.app/Contents/MacOS/Python
with -I -S -E -B and PATH=/usr/bin:/bin, LANG=C, LC_ALL=C. Do not use the
bin/python3.9 launcher, PATH resolution, Python/user site, find_library, callbacks
or environment-selected tools. Executable SHA256 is
0b7aad9bf1adf74d3922cf351f7d2e908dae19edd5456299d162810ae083523d;
framework library SHA256 is
26422f0b21cb1e07236384afa4043c7401d39d09358c91df8bf3f5496f14712f.
These sampled pins are diagnostics, not protected startup/import closure proof.
CLT is root-owned but not SIP protected; complete startup/native closure and
the compiled writable-Xcode fallback exclusion remain unproved for privileged
admission. Ordinary execution must not claim to close those gaps.

The Python program takes no arguments and first rejects non-Darwin, root,
real/effective UID mismatch or nonisolated/site-enabled invocation. No native
library or child is loaded before this guard. It then pins /usr/bin/perl bytes
to abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0
and owns a direct subprocess with private stdin/stdout/stderr, cwd=/, scrubbed
environment and close_fds=true. The fixed Perl first BEGIN restricts @INC to the
two SIP Perl5.34 roots, emits READY, exits on stdin EOF, and has alarm20. No shell,
caller code, inherited authority or child-reported PID. Native target PID is
only the captured subprocess PID while poll() confirms it remains unreaped.

Readiness5s, overall nonrenewing native epoch10s, <=4096 native calls, depth<=64,
bounded output1MiB. Native calls can block; the diagnostic does not promise a
kernel RPC wall-clock bound. A parent guardian may terminate only its own
diagnostic process; uncertain target settlement forbids successful output.
The child's independent alarm remains a backstop, not a definite-reap witness.
Always close stdin then wait5s; TERM/wait2s, KILL/wait2s only for captured still
unreaped child. Drain bounded output, close all three streams, and require exact
READY, empty stderr, exit0 and definite wait before success. Failed forced exit
is refusal even when cleanup completed. Cancellation is irreversible refusal.

## Typed native boundary and pure census

Load only /usr/lib/libSystem.B.dylib through ctypes.CDLL; no dynamic library
search, arbitrary symbol, callback, memory reads/writes, suspension or task_for_pid.
Read mach_task_self_ as exported uint32, not a callable macro. BSD syscall539
task_read_for_pid takes uint32 self, int32 captured PID, uint32* output. Clear
and capture errno adjacent to syscall. Only return0, errno0 and nonzero/non-dead
port are usable. Any failure refuses; no fallback to a control task port.
Use typed mach_vm_region_recurse(uint32, uint64*, uint64*, uint32*, int32*,
uint32*) -> int32, and mach_port_deallocate(uint32,uint32) -> int32. Deallocate
the newly acquired right exactly once in finally, before claiming success.

Local MacOSX26.5 SDK mach/vm_region.h uses pack4. v2 is exactly76 bytes/count19:
protection/max/inheritance i32 at0/4/8, offset u64 at12, six u32 at20..40,
shadow u16 at44, external/share u8 at46/47, submap/behavior/object ID at48/52/56,
wired/flags u16 at60/62, reusable u32 at64, object_id_full u64 at68.
This is distinct from the delivered96-byte BSD struct. Preserve every field;
offset/object_id_full become exact padded hexadecimal strings. Reject short/
extra/count-mismatched bytes, unknown protection or flags, current outside max,
nonboolean submap/external, synthetic tag UINT32_MAX and unsupported sharing.
Address space diagnostic bound is exclusive2^48, not a universal kernel claim.

Pure walk starts address0/depth0. Each successful reply must have bounded,
positive, nonbacktracking range and depth<=requested. A submap causes retry at
its returned start with returned depth+1; a leaf advances to its exclusive end
with returned depth. Preserve submaps and every leaf including anonymous/JIT/
guard/shared-cache/potential-X; no label exemption. KERN_INVALID_ADDRESS1 after
at least one leaf ends the sampled enumeration; other errors, initial error,
loops, depth/call/output cap, target exit or timeout refuse. Enumeration is not
atomic, source/page origin or a complete loaded-image closure. Success always
reports completeNativeClosure:false, productionAuthority:false and sampled:true.

## File map and verification

- scripts/task6a-origin-mach-recon-v2.py: pure76-byte decoder/walk, lazy fixed
  native bridge and ordinary parent-owned child lifecycle; no effect on import.
- scripts/__tests__/task6a-origin-mach-recon-v2.test.js: fixed isolated CLT
  Python exercises real pure functions with independent byte vectors and exact
  native-boundary doubles. No default native calls or compiler. Unsupported/root
  hosts unavailable before spawning Python. Test cancellation/early loss/forced
  settlement/port errors and mutations in memory only.
- This spec and docs/superpowers/plans/2026-10-01-task6a-owned-mach-region-recon-v2.md.

Default npm script glob must select the pure suite. All-source independent
review of exact source/tests/argv/lifecycle is required BEFORE any actual native
query. Then at most one ordinary own-child invocation can supply new diagnostic
evidence, including an honest denied-port result. No native permission repair,
entitlement/signing, root retry or protected admission follows from that result.
Existing Perl/bootstrap suites, contracts/noemit, exact-head available cloud
review/security, SHA-bound PR merge and guarded clean-main verification apply.
No production cutover completion is claimed by this diagnostic slice.
