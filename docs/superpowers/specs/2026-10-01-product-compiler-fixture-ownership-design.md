# Product compiler fixture ownership

## Causal scope and evidence

The third clean-main private ALL run at `3e137989` closed with exit 1.
Its complete frozen journal has 1,110,254 bytes, 1,594 validated records and
SHA256 `276cd4806ed8dc4f0934317d17b3a2ddf83b67062beffd0ba28f670d20c0bdf1`.
The product compiler reported 1,263 passes, 70 failures and 50 cancellations.
Nine fixture families create temporary directories whose inherited Darwin group
is 0, but their unchanged consumer contracts require ordinary process GID 20.
Two before-hook failures account for all 50 cancellations. This causal test
preparation fix is required for the existing clean-main verification objective;
it does not implement protected startup or authorize live cutover.

The first scoped DB-free follow-up closed with 128 passes and 7 failures.
All seven are newly reached provisioning bundle cases. The shared esbuild
package is the exact pinned registry tree, including its 9,350-byte JS wrapper;
the arm64 platform package is the exact pinned official platform tree. The
fixture copied the wrapper as though npm's binary-replacement install step had
already run, while its unchanged authority guard requires the installed tree.
Prepare that install step only in the fresh private test copy. Recognize the
exact official wrapper SHA256 `fe9a7b65a540d8df1a0f59941d52e7c1260c36fed9a2af3dd966f15381b6eb76`,
or require an already-installed binary to equal the selected private platform
binary. Replace a recognized wrapper only with the selected private platform
copy. The existing complete tree hashes, binary pairing and admission checks
remain the authority. Reject other wrapper/binary bytes; never run install
scripts or mutate shared dependencies. This is another fixture-preparation
assumption unmasked by the same causal verification objective, not a new
production dependency admission policy.

## Decision and alternatives

Reuse the reviewed `createPrivateOutputParent` test helper in nine TS suites.
For the false-authority content-store runner's own fresh build root, establish
the same ownership through a held descriptor before its existing admission
checks. This avoids moving test utilities into production build dependencies.
Changing TMPDIR would conceal the portability defect. Relaxing the consumer's
GID checks would weaken the boundary. Both alternatives are rejected.
Standing owner authorization covers this bounded causal refinement; root is
the only writer and reviewers remain read-only.

## Fresh build-root contract

Only an alias returned by this invocation's `mkdtempSync` can be prepared.
Require equal real/effective UID and GID. Before any group change, require
the newly observed object, held FD, alias and canonical name to be the same
device/inode, UID-owned directory, mode 0700, with unchanged inherited GID.
Require canonical realpath agreement and a location outside the repository.
Perform one `fchownSync` on the held FD to current UID/GID. Recheck all four
observations and canonical identity. Close exactly once before returning.
A preparation error or close failure denies return; preserve primary then
close errors in an AggregateError. Retain every root on failure, do not retry,
repair an existing root, delete evidence or acquire production authority.
Keep existing root census, binary verification, builder containment, native
publication, ownership guards and retained-disposal contract unchanged.

## Verification

First reproduce semantic consumer failures in the new checkout with TMPDIR
absent and ordinary UID/GID. A standalone regression exercises the actual
content-store constructor through its bounded false-authority builder-fault
API, without the suite's failing before-hook. The regression must reach the
expected injected stream failure after ownership preparation. Test pre-change
FD drift, fchown denial, post-change drift, close denial and ordered combined
errors without starting a builder when root preparation fails. Every root
remains retained and foreign metadata remains unmodified.
Run only the confirmed DB-free affected suites and existing helper tests
before PR delivery, plus TypeScript no-emit checking, contracts, diff/secret
checks and independent review. The private-materializer suite creates a DB;
never dispatch it with an ambient/default connection. Defer it and any other
DB-backed suite to a newly reviewed private epoch with explicit owned binding.
The standalone stdout-stream fault contains its fixed `/bin/sleep` child,
not a Node child or compiler. Genuine guarded build requires `main == origin/main`
and therefore belongs in a NEW merged-main checkout after reviewed delivery.
A subsequent newly reviewed clean-main private ALL run
is separate evidence, not a stitched collection of focused results.

## Non-goals

No TMPDIR or package-command changes, no consumer-guard weakening, no native
or privileged startup changes, no live PostgreSQL schema/data mutation, no old
worktree synchronization or deletion, no new production ownership admission.
