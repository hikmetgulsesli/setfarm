import { parsePrdContract, contextPrdText } from "./prd-contract-parser.js";

export interface StoryContractCoverageInput {
  story_index?: number | null;
  story_id?: string;
  implementation_contract?: string | null;
}

export interface PrdActionOwnershipDedupe {
  storyId: string;
  implementationContract: string;
  removed: string[];
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

function contractSurfaceIds(contract: Record<string, any> | null): string[] {
  return Array.isArray(contract?.owned_surface_ids)
    ? contract.owned_surface_ids
      .filter((item: any): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item: string) => item.toUpperCase())
    : [];
}

function actionPair(surfaceId: string | undefined, actionId: string): string {
  return `${String(surfaceId || "").toUpperCase()}:${String(actionId || "").toUpperCase()}`;
}

function requiredActionPairs(context: Record<string, string>): Map<string, string> {
  const prd = parsePrdContract(contextPrdText(context));
  return new Map(prd.surfaceActions.map((action) => {
    const label = `${action.surfaceId || "SURF_UNKNOWN"}:${action.id}`;
    return [actionPair(action.surfaceId, action.id), label];
  }));
}

function matchingActionKeys(
  action: any,
  ownedSurfaceIds: string[],
  required: Map<string, string>,
): string[] {
  const id = typeof action?.id === "string" ? action.id.toUpperCase() : "";
  if (!id.startsWith("ACT_")) return [];
  const surfaceId = typeof action.surface_id === "string" ? action.surface_id.toUpperCase() : "";
  const matchingRequiredKeys = [...required.keys()].filter((key) => key.endsWith(`:${id}`));
  const fallbackKeys = surfaceId
    ? [actionPair(surfaceId, id)]
    : ownedSurfaceIds.length === 1
      ? [actionPair(ownedSurfaceIds[0], id)]
      : matchingRequiredKeys.length === 1
        ? matchingRequiredKeys
        : [];
  return fallbackKeys.filter((key) => required.has(key));
}

export function planPrdActionOwnershipDedupes(
  context: Record<string, string>,
  stories: StoryContractCoverageInput[],
): PrdActionOwnershipDedupe[] {
  const required = requiredActionPairs(context);
  if (required.size === 0 || stories.length === 0) return [];

  type OwnerRecord = {
    story: StoryContractCoverageInput;
    storyKey: string;
    storyId: string;
    contract: Record<string, any>;
    actionIndex: number;
  };

  const owners = new Map<string, OwnerRecord[]>();
  const parsedByStory = new Map<string, Record<string, any>>();

  stories.forEach((story, storyPosition) => {
    const contract = parseImplementationContract(story.implementation_contract);
    if (!contract) return;
    const storyId = story.story_id || `UNKNOWN-${storyPosition}`;
    const storyKey = storyId;
    parsedByStory.set(storyKey, contract);
    const ownedSurfaceIds = contractSurfaceIds(contract);
    contractActions(contract).forEach((action, actionIndex) => {
      for (const key of matchingActionKeys(action, ownedSurfaceIds, required)) {
        const current = owners.get(key) || [];
        current.push({ story, storyKey, storyId, contract, actionIndex });
        owners.set(key, current);
      }
    });
  });

  const removalsByStory = new Map<string, Set<number>>();
  const removedLabelsByStory = new Map<string, string[]>();
  for (const [key, records] of owners) {
    const uniqueStories = [...new Map(records.map((record) => [record.storyKey, record])).values()]
      .sort((a, b) => {
        const ai = Number.isInteger(a.story.story_index) ? Number(a.story.story_index) : Number.MAX_SAFE_INTEGER;
        const bi = Number.isInteger(b.story.story_index) ? Number(b.story.story_index) : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return a.storyId.localeCompare(b.storyId);
      });
    if (uniqueStories.length <= 1) continue;
    const [, ...duplicates] = uniqueStories;
    for (const duplicate of duplicates) {
      const indexes = removalsByStory.get(duplicate.storyKey) || new Set<number>();
      indexes.add(duplicate.actionIndex);
      removalsByStory.set(duplicate.storyKey, indexes);
      const labels = removedLabelsByStory.get(duplicate.storyKey) || [];
      labels.push(required.get(key) || key);
      removedLabelsByStory.set(duplicate.storyKey, labels);
    }
  }

  const updates: PrdActionOwnershipDedupe[] = [];
  for (const [storyKey, indexes] of removalsByStory) {
    const contract = parsedByStory.get(storyKey);
    if (!contract || !Array.isArray(contract.owned_actions)) continue;
    const nextActions = contract.owned_actions.filter((_: any, index: number) => !indexes.has(index));
    if (nextActions.length === contract.owned_actions.length) continue;
    const nextContract = { ...contract, owned_actions: nextActions };
    updates.push({
      storyId: storyKey,
      implementationContract: JSON.stringify(nextContract),
      removed: [...new Set(removedLabelsByStory.get(storyKey) || [])],
    });
  }

  return updates;
}

export function detectPrdActionCoverageGaps(
  context: Record<string, string>,
  stories: StoryContractCoverageInput[],
): string | null {
  const required = requiredActionPairs(context);
  if (required.size === 0 || stories.length === 0) return null;

  const owners = new Map<string, string[]>();

  for (const story of stories) {
    const contract = parseImplementationContract(story.implementation_contract);
    const ownedSurfaceIds = contractSurfaceIds(contract);
    for (const action of contractActions(contract)) {
      for (const key of matchingActionKeys(action, ownedSurfaceIds, required)) {
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
