# scope_write_violation Failure Memory

## Diagnosis
- Runtime supervisor killed a claim because it attempted to edit outside the scoped write set.

## Preferred Repair
- If downstream evidence legitimately names the extra files, Setfarm should expand the retry scope before handing back to the worker.
- If the extra file is unrelated, the worker should repair inside current scope or fail with a precise blocker.

