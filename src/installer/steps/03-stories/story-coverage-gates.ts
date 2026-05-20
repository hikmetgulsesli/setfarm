import { parsePrdContract, contextPrdText } from "./prd-contract-parser.js";

export interface StoryContractCoverageInput {
  story_id?: string;
  implementation_contract?: string | null;
}

function parseImplementationContract(raw: string | null | undefined): Record<string, any> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function contractActions(contract: Record<string, any> | null): any[] {
  return Array.isArray(contract?.owned_actions)
    ? contract.owned_actions.filter((item: any) => item && typeof item === "object")
    : [];
}

function actionPair(surfaceId: string | undefined, actionId: string): string {
  return `${String(surfaceId || "").toUpperCase()}:${String(actionId || "").toUpperCase()}`;
}

export function detectPrdActionCoverageGaps(
  context: Record<string, string>,
  stories: StoryContractCoverageInput[],
): string | null {
  const prd = parsePrdContract(contextPrdText(context));
  if (prd.surfaceActions.length === 0 || stories.length === 0) return null;

  const requiredPairs = prd.surfaceActions.map((action) => ({
    key: actionPair(action.surfaceId, action.id),
    label: `${action.surfaceId || "SURF_UNKNOWN"}:${action.id}`,
  }));
  const required = new Map(requiredPairs.map((pair) => [pair.key, pair.label]));
  const owners = new Map<string, string[]>();

  for (const story of stories) {
    const contract = parseImplementationContract(story.implementation_contract);
    for (const action of contractActions(contract)) {
      const id = typeof action.id === "string" ? action.id.toUpperCase() : "";
      if (!id.startsWith("ACT_")) continue;
      const surfaceId = typeof action.surface_id === "string" ? action.surface_id.toUpperCase() : "";
      const exactKey = actionPair(surfaceId, id);
      const fallbackKeys = surfaceId
        ? [exactKey]
        : [...required.keys()].filter((key) => key.endsWith(`:${id}`));
      for (const key of fallbackKeys) {
        if (!required.has(key)) continue;
        const current = owners.get(key) || [];
        current.push(story.story_id || "UNKNOWN");
        owners.set(key, current);
      }
    }
  }

  const missing = [...required.entries()]
    .filter(([key]) => !owners.has(key))
    .map(([, label]) => label);
  if (missing.length > 0) {
    return `GUARDRAIL: PRD action coverage missing for ${missing.length} surface action(s): ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? `, +${missing.length - 12} more` : ""}. Re-output STORIES_JSON so every Product Surface permitted ACT_* action appears in exactly one story implementation_contract.`;
  }

  const duplicated = [...owners.entries()]
    .filter(([, storyIds]) => new Set(storyIds).size > 1)
    .map(([key, storyIds]) => `${required.get(key) || key} -> ${[...new Set(storyIds)].join("+")}`);
  if (duplicated.length > 0) {
    return `GUARDRAIL: PRD action ownership duplicated for ${duplicated.length} surface action(s): ${duplicated.slice(0, 8).join("; ")}${duplicated.length > 8 ? `; +${duplicated.length - 8} more` : ""}. Re-output STORIES_JSON with one owner story per surface action.`;
  }

  return null;
}
