import { z } from "zod";

/**
 * Compiler-declared semantic identity for one physical action-control
 * placement. A control slot is intentionally distinct from a generated
 * `CTRL_*` identity: the slot exists before design generation, while the
 * physical control is bound later by the design graph.
 */
export const ControlSlotIdSchema = z
  .string()
  .min("CSLOT_A_B".length)
  .max(160)
  .regex(
    /^CSLOT_[A-Z0-9]+(?:_[A-Z0-9]+)+$/,
    "Expected a CSLOT_<ACTION>_<PLACEMENT> stable reference",
  );

export type ControlSlotId = z.infer<typeof ControlSlotIdSchema>;

export const ControlHintV2Schema = z.enum([
  "primary_button",
  "secondary_button",
  "icon_button",
  "context_menu",
  "context_menu_destructive",
  "form_submit",
  "inline_edit",
  "swipe_action",
  "fab",
  "search_input_persistent",
  "canvas_region",
]);

export type ControlHintV2 = z.infer<typeof ControlHintV2Schema>;

export const RequirementSemanticKindV2Schema = z.enum([
  "goal",
  "non_goal",
  "entity",
  "state",
  "persistence",
  "route",
  "surface",
  "action",
  "evidence",
  "observable",
  "control_placement",
]);

export type RequirementSemanticKindV2 = z.infer<typeof RequirementSemanticKindV2Schema>;
