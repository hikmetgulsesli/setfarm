# Contract-Spine Semantic Migration Identity

Contract-spine migrations whose `apply` function performs a data-dependent
backfill must bind that implementation to the migration journal checksum. SQL
statements alone are not a complete identity for those migrations.

Versions 8, 11, and 12 use checked-in SHA-256 implementation digests generated
from exact marked regions in `src/db/contract-spine-migrations.ts` and explicit
versioned helper dependency files. Source-mode migration commands verify the
generated values before touching PostgreSQL. `npm run build` performs the same
check before compilation.

Use this command after intentionally authoring a semantic migration and before
its first application in any environment:

```bash
node --import tsx scripts/check-contract-spine-migration-digests.ts --write
```

After a migration has been journaled, its marked source regions and declared
helper files are immutable migration inputs. Do not refresh an old digest to
silence a checksum mismatch. Preserve the old implementation and introduce a
new migration version for changed behavior.

The introduction of source binding intentionally changes the not-yet-applied
checksums for versions 8, 11, and 12 from their former hand-written label based
identity. It does not update a database journal. Any environment that already
journaled one of the former checksums must be treated as a compatibility case
and investigated; its journal must not be edited or silently adopted.
