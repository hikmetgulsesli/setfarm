# Setfarm + Mission Control Architecture Reset Review Packet

This packet is intended for Gemini, Sonnet, or another senior platform architecture model. Its purpose is not to defend the current Setfarm + Mission Control structure, but to subject the system to an adversarial review and clarify the architectural reset needed to break the reactive patch cycle.

## Main Question

Setfarm currently operates with many guards, supervisors, QA-FIX flows, smoke checks, PR flows, runtime checks, and self-heal behaviors. Despite this, every new generated-project run reveals another behavioral defect and forces the system to keep adding patches.

Should this system:

- continue in a simplified form based on the current design?
- be redesigned as a compiler/evidence factory?
- repair itself through a self-healing supervisor?
- or reduce agent authority and make the Setfarm orchestrator more mechanical?

## Reading Order

1. `01_SYSTEM_ARCHITECTURE_MAP.md`
2. `02_FILE_INVENTORY_SETFARM_MC.md`
3. `03_RULES_GUARDS_LOOPS_INVENTORY.md`
4. `04_PIPELINE_BEHAVIOR_BY_STEP.md`
5. `05_COMPANY_MODEL_AND_AGENT_ROLES.md`
6. `06_PATCH_LOOP_FAILURE_ANALYSIS.md`
7. `07_SELF_HEAL_SUPERVISOR_DECISION.md`
8. `08_GEMINI_SONNET_QA_PROMPT.md`
9. `09_SOURCE_ATTACHMENT_MANIFEST.md`

## Usage

First provide Gemini/Sonnet with the Markdown files in this directory. If the model requests more evidence, also attach the source files listed under "attach first" in `09_SOURCE_ATTACHMENT_MANIFEST.md`.

## Security Note

Do not include `.env` files, API keys, local transcripts, generated-project `node_modules`, tokens, or credentials in this packet. Code paths and error names have been preserved; secret values have deliberately been omitted.

## Expected Output

The external model should provide:

- a root-cause diagnosis
- unnecessary or harmful layers
- layers that should be preserved
- a target architecture
- a self-heal decision
- a Mission Control visibility model
- an implementable refactoring plan
- risks and a testing strategy
