# Generated Vitest browser storage compatibility

The real b8bb implementation built but its required test command failed. Its
original command output was not retained. A separate frozen-source reproduction
at ac234632 (PID35225) fails the existing application-root test because
window.localStorage is undefined. The identical code/dependencies/environment,
with only Node webstorage disabled (PID37285), passes that test. These new
reproductions do not replace the original failed evidence or qualify the app.

Installed Vitest2.1.9 preserves Node globals when constructing its jsdom window.
New Node versions expose a storage global that can be undefined without a backing
file, preventing the jsdom Storage implementation from being installed. This is
a Vite/React test-scaffold compatibility defect, causally within the working
Setfarm objective and Universal Agent Inner Dev Loop.

Generate a fork-only Vitest execArgv option disabling Node webstorage when the
running Node reports support for --no-experimental-webstorage. Then jsdom owns
browser localStorage/sessionStorage. Use a narrow structural globalThis process
shape so generated config does not require a new @types/node dependency. An
unsupported flag produces an empty extra argument list. Preserve all existing
test inclusion, environment, one-worker, isolation and teardown settings.

Alternatives: changing global NODE_OPTIONS affects unrelated services; mocking
Storage would stop testing real jsdom behavior; upgrading dependencies broadens
the change. The fork-only configuration is the smallest supported correction.

Change the owned setup-repo.sh Vitest template and focused scaffold regression
tests only. No generated project edits, dependency changes, provider/SDK patches,
new repair authority, test skips or guard bypasses. No historical run replay.
Detailed diagnostic retention remains a separate documented gap.

Prove the extracted generated configuration selects the supported flag only when
available and retains all existing settings. Exercise the real child execution
boundary, then use the installed frozen dependency set to verify actual jsdom
local/session Storage persistence and the unchanged application-root smoke test
with the generated fork-only config and no global NODE_OPTIONS change. Capture
original RED/GREEN and process outcomes; do not run unrelated matrices.

Root alone delivers reviewed PR, clean merged build and a separately reviewed
normal source transition. A later clean production run is needed; this small
test result cannot establish complete workflow or gameplay success. Preserve all
new records and the blocked b8bb state; do not rescue its generated code.
