# Task6A fixed GitHub source transport v2

## Cause and scope

PR251 verifies caller-supplied Git object protocol, not where JSON came from.
The next necessary publisher prerequisite is a real fixed HTTPS reader. This
slice joins fresh GitHub main, a signed Git merge object, the actual closed and
merged PR that introduced it, and two selected source blobs. It does not install,
execute or admit downloaded code. Root remains the sole writer. Existing dirty
worktrees, V1 stores and unconditional V2 admission refusal stay untouched.

## Decision

Use fixed Apple `/usr/bin/curl` via direct `spawnSync`, no shell, with fixed
system CA, scrubbed environment and public GitHub REST routes. This avoids the
Apple Git shim, helper selection and ambient Git configuration. Full Git tool
admission would enlarge the trusted closure; starting a root publisher before
its own source/vendor admission would be circular. This reader is ordinary
unprivileged transport diagnostics, not a solved protected bootstrap.

## Interface and selection

Export only `observeCurrentTask6aGithubMergedSourceTransportV2()`, exactly zero
arguments. It takes no caller URL, expected hash, credential, options, callback,
receipt, path or environment selector. No import-time requests. Fixed repository
is `hikmetgulsesli/setfarm`, branch `main`; API prefix is
`https://api.github.com/repos/hikmetgulsesli/setfarm`.
Selected source paths are exactly:

- `scripts/task6a-github-delivery-object-v2.mjs`
- `scripts/task6a-fixed-github-source-transport-v2.mjs`

Selection describes this tiny source pair, not the whole repository, compiled
controller or proof that this same pair is currently executing. A feature branch
cannot substitute itself for missing delivered main bytes. Before this slice
merges, real observation must refuse the missing new main blob.

## Transport contract

Every GET directly executes `/usr/bin/curl`, first argument `-q`, fixed cwd `/`,
fixed `PATH=/usr/bin:/bin`, `LANG=C`, `LC_ALL=C` and no other child environment.
Require HTTPS only, TLS1.2 minimum, CA `/private/etc/ssl/cert.pem`, empty proxy,
`--noproxy '*'`, zero redirects, no user config, credentials or API-returned URLs.
Pass fixed JSON Accept and API version `2022-11-28`. Use a 60-second monotonic
total deadline, at most ten seconds per GET, five-second connect bound, no retry,
and at most 4MiB response bytes plus a small status trailer. Capture exit/status,
UTF8 bytes, exact HTTP200, JSON content type and exact effective URL. Error,
signal, timeout, overflow, invalid UTF8/JSON, redirect or uncertain result refuses.
Recheck the same deadline after the subprocess and before returning.

## Joined observations

1. Read `/git/ref/heads/main`; require exact main ref, commit type and lowerhex
   40-character OID.
2. Read `/git/commits/<main>`; use the delivered PR251 verifier to recompute the
   signed merge Git identity, tree and ordered two-parent identities.
3. Read `/commits/<main>/pulls?per_page=100&page=1`; require fewer than100 rows
   (bounded complete list, otherwise refuse) and exactly one association whose
   merge commit equals main. Validate positive safe PR number and derive the
   fixed PR route from that number only.
4. Read `/pulls/<number>`; require same number, closed, mergedtrue, non-null
   merged timestamp, merge_commit_sha===main, base main/same repo, head same
   repo and exact second signed merge parent. Open PR synthetic merge SHAs and
   other repository/base/head substitutions refuse. No PR review clearance is
   claimed: reviewed delivery remains the separate owner gate. No bot comment
   prefix is promoted into full-SHA review authority.
5. Read root tree by recomputed tree OID, then `scripts` tree by the authenticated
   root entry. Verify both complete nonrecursive Git tree objects. The selected
   entries must be regular100644 blobs, exact names and bounded sizes.
6. Read the two blobs by authenticated OIDs, recompute framed Git SHA1 and
   independent SHA256, and join exact tree size. Ignore all returned URLs.
7. Re-read main ref and require unchanged main; no retry, partial result or
   success if main moves during observation.

## Result and refusal

Return frozen `schema: setfarm.task6a-fixed-github-source-transport.v2`,
`scope: merged-source-transport-diagnostic-only`, `productionAuthority:false`,
`reviewAuthority:false`, mainSha/treeSha/prNumber/headSha and a frozen source
array of frozen path/gitBlobSha/byteLength/contentSha256 records. Return no
downloaded executable bytes, serialized origin holder or positive admission.
All failures throw `TASK6A_GITHUB_SOURCE_TRANSPORT_REFUSED` without leaking
upstream bodies, environment or credentials. No filesystem writes, Git execution,
root/vendor/archive/native/DB/service/selector effects. Authentic initial root
publisher, official vendor Node admission and parent-owned real entry execution
are later separate obligations, as are compiler/fence/genesis/32/33/admission.

## Verification

TDD executes the real module graph in a VM, replacing only the external curl
subprocess boundary and monotonic clock. Fixtures coherently hash literal Git
commit/tree/blob bytes; object verification and the reader's route/argv/options,
selection, joining and refusal logic remain real. Test the exact request contract
and ambient environment denial, HTTP/TLS/redirect/error/overflow/deadline paths,
real merged PR joins, malicious returned URLs, coherent invalid source modes and
sizes, missing source and moving main. Doubles are protocol evidence only, not
TLS or protected provenance. The default npm graph must actually select this
suite and run a bounded real leaf. After reviewed normal merge, run the zero-input
reader against actual fixed public HTTPS and record digests, then clean-main
build/compiled observer and read-only host evidence. Never bypass guards.
