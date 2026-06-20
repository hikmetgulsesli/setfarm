# python-cli Memory

## Behavior
- Treat Python CLI projects as command contracts: args, config, stdout/stderr, exit codes, and deterministic tests.
- Setup-build owns virtualenv/dependency/tooling repair; implement owns product command behavior.

## Recovery Recipes
- If imports or packaging fail, repair pyproject/requirements only in setup-owned scope.
- If command behavior fails, add focused parser/action fixes and test the command path.

## Do Not Do
- Do not inject web/browser checks into CLI projects.
- Do not mix Node package fixes into Python stack recovery unless the project explicitly contains both stacks.
