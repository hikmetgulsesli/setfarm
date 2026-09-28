# Build-generation device-drift diagnostic design

## Boundary and evidence

The selected Setfarm clean-main build is stopped by eight retained generation
slots and a strict physical-identity mismatch. The immutable rotation records
for active ordinals 6–13 name device `16777230`; the current archive trees
name device `16777231`. A separate read-only census found the same recorded
inode, mode, link count, type and size for all 6,700 entries, and the recorded
SHA-256 for all 6,332 regular files. This supports device-number drift but
does not prove old and new numbers identify the same historical volume. The
ledger lacks a historical volume UUID. The existing writer, retention and
runtime guards must remain unchanged and fail closed.

The first implementation slice is a pure, read-only classifier of a recorded
inventory and a freshly observed inventory. It reports uniform device-only
drift or refuses with a fixed non-secret reason; unchanged device values also
refuse. It never
returns build, retention, rebind or deletion authority. A caller must still
authenticate the original ledger and obtain two stable, bounded no-follow
current observations; this slice does not do so and must not be used to accept
the live archives.

## Contract

`classifyBuildGenerationDeviceDriftV1(recorded, observed)` accepts two strict
`setfarm.platform-build-generation-inventory.v1`-shaped objects. It checks the
exact root physical identity, entry count,
regular-file byte count, sorted canonical entry list, kind, inode, mode,
link count, byte length, SHA-256, and content-inventory hash. Every device
field, including the root, must be one old value in the recorded inventory
and one different new value in the observed inventory. Any non-device
difference, missing/extra/reordered entry, mixed device, malformed value or
unchanged device refuses classification. The output is immutable and always
contains `authority:false`; it includes only the classification, device
numbers and counts, never paths, bytes or credentials.

The comparator recomputes both canonical inventory hashes and checks their
cross-inventory relationships, but does not authenticate the historical ledger
or prove that current files match the supplied digests.
Its two arguments are data, not authority. Tests use literal inventories to
prove both the one permitted relationship and all important rejection axes.

## Later recovery boundary

No live rebind is part of this slice. A later, separately reviewed procedure
would need an append-only epoch receipt binding the complete immutable ledger
tip, all active completion pairs, old and current inventories, two stable
host observations, and independent owner/volume provenance. All scan,
prepare, resume and erase paths would have to consume that new effective
epoch without rewriting old records. Current matching hashes alone cannot
establish historical volume continuity, so a live trust transition needs
new explicit authority and provenance; neither a one-line comparator exception
nor manual archive disposal is allowed.
