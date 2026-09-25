# Preserved cutover service-effect store design

The merged service-effect codec records only historical commitments. Before any real LaunchAgent bootout, those bytes need an immutable durable publication boundary. This slice adds only a separate filesystem store for the two fixed pre-link records; no caller in this slice invokes it on the live host, and it has no `launchctl`, signaling, link, database, owner-capability or cutover gate.

## Choice and ordering

Use a dedicated `0700` root under the existing baseline data parent, with fixed names `intent-0001.json`, `completion-0001.json`, `intent-0002.json`, and `completion-0002.json`. The sequence is enforced on every physical snapshot through the pure history parser. Publication of the second intent requires the first completion; completion requires its matching committed intent. Exact-byte replay of a committed file is allowed after re-flushing file and directories; different bytes at the same name cannot replace it. A caller supplies an expected full store-observation hash to fence stale publication, but neither that hash nor caller-fed owner-claim/observation hashes prove live ownership or a physical effect.

Every new record uses a `0600` exclusive stage, file fsync, no-replace hardlink to its fixed name, and root/parent fsync. Stage aliases remain visible; no cleanup or deletion happens. A partial unlinked stage, unknown name, foreign link, unsafe mode, changed directory identity, crossed alias, failed close, or uncertain fsync is preserved and refuses new publication. Observation reports `needs-reconciliation` when an unlinked stage exists, even if the committed record prefix is otherwise valid. This refuses automatic replay of an unsettled effect: only a future owner-held controller may physically reconcile before deciding how to continue.

The existing owner-store grammar is not reused: owner claims and service dispatch have different crash semantics, and changing that store would expand a proven boundary. The new store follows its reviewed physical pin/no-replace pattern in a separate root. No file here is an effect completion proof: completion records bind caller-fed post-observation hashes, not authenticated launcher/process state. A later controller must hold and recheck the current owner capability and physical source/plist/CLI pins across publication and effects, and must never dispatch again from an unsettled intent merely because its stored bytes are well formed.

The pinned absolute-path checks detect stable drift but do not make path creation race-proof against a same-UID actor swapping an ancestor between checks. This store therefore cannot establish adversarial filesystem confinement or exclusive cutover ownership on its own; the future effect controller and host exclusion proof must retain that uncertainty.

## File map

- `src/internal-production/baseline-deployment-cutover-service-effect-store-v1.ts`: fixed-root physical inventory, immutable publication and history-only observation.
- `tests/internal-production/baseline-deployment-cutover-service-effect-store-v1.test.ts`: local temporary-root no-effect, canonical publication/replay, order, crash/response-loss, tamper and concurrent no-replace cases.
- This spec and its paired implementation plan state the non-authority boundary and verification.
