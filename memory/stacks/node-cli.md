# node-cli Memory

## Behavior
- Treat CLI projects as command/input/output contracts first: arguments, stdin/stdout/stderr, exit codes, config files, and filesystem side effects.
- Build can be `npm run build`, a focused test command, or `true` when the stack contract says no compile step exists.

## Recovery Recipes
- If command parsing fails, repair parser/action dispatch in owned CLI files and prove the exit code plus output.
- If output format is wrong, preserve machine-readable fields and only adjust user-facing text inside the command scope.

## Do Not Do
- Do not require a browser runtime, DOM smoke, or visual checks for a CLI-only stack.
- Do not hardcode one command name as a platform policy.
