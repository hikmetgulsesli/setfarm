# missing_icon_asset Failure Memory

## Diagnosis
- Generated designs may reference icon names that are unavailable in the chosen icon library.

## Preferred Repair
- Supervisor should route this as repairable UI fidelity work.
- Worker should choose a semantically close available icon or request dependency/setup repair when the library itself is missing.

## Do Not Do
- Do not create project-specific hard rules for icon names.
- Do not fail setup-build only because a generated UI used a missing icon name.

