export interface PrdSurfaceAction {
  id: string;
  surfaceId?: string;
  surfaceName?: string;
  controlHint?: string;
}

export interface PrdSurface {
  surfaceId: string;
  name: string;
  permittedActions: PrdSurfaceAction[];
}

export interface PrdActionContract {
  actionId: string;
  surfaceId?: string;
  trigger?: string;
  successEffect?: string;
  failureEffect?: string;
  stateChanges: string[];
  userFeedback?: string;
}

export interface ParsedPrdContract {
  projectName?: string;
  platform?: string;
  techStack?: string;
  surfaces: PrdSurface[];
  surfaceActions: PrdSurfaceAction[];
  actionContracts: PrdActionContract[];
}

export function contextPrdText(context?: Record<string, string>): string {
  return [
    context?.["prd"],
    context?.["PRD"],
    context?.["product_contract"],
    context?.["plan_output"],
  ].filter(Boolean).join("\n");
}

function cleanValue(value: string | undefined): string {
  return String(value || "").replace(/\*\*/g, "").trim();
}

function splitActionItems(text: string): string[] {
  return String(text || "")
    .split(/,\s*(?=ACT_[A-Z0-9_]+\b)/gi)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractControlHint(item: string): string {
  return item.match(/\bcontrol_hint\s*:\s*([a-z0-9_/-]+)/i)?.[1]?.trim()
    || item.match(/\((?:hint\s*:\s*)?([a-z0-9_/-]+)\)/i)?.[1]?.trim()
    || "";
}

function parseMetaValue(prdText: string, key: string): string | undefined {
  const m = prdText.match(new RegExp(`(?:^|\\n)\\s*${key}\\s*:\\s*([^\\n]+)`, "i"));
  return m ? cleanValue(m[1]) : undefined;
}

function parseSurfaceActions(lineValue: string, surfaceId: string, surfaceName: string): PrdSurfaceAction[] {
  const actions: PrdSurfaceAction[] = [];
  for (const item of splitActionItems(lineValue)) {
    const id = item.match(/\b(ACT_[A-Z0-9_]+)\b/i)?.[1]?.toUpperCase();
    if (!id) continue;
    actions.push({
      id,
      surfaceId,
      surfaceName,
      controlHint: extractControlHint(item),
    });
  }
  return actions;
}

function setActionField(action: PrdActionContract, line: string): void {
  const m = line.match(/^\s*-\s*(?:\*\*)?([^:*]+)(?:\*\*)?\s*:\s*(.+)$/);
  if (!m) return;
  const key = cleanValue(m[1]).toLowerCase();
  const value = cleanValue(m[2]);
  if (/surface bound/.test(key)) action.surfaceId = value.match(/\bSURF_[A-Z0-9_]+\b/i)?.[0]?.toUpperCase() || value;
  else if (/trigger/.test(key)) action.trigger = value;
  else if (/success/.test(key)) action.successEffect = value;
  else if (/failure/.test(key)) action.failureEffect = value;
  else if (/state changes?/.test(key)) action.stateChanges.push(value);
  else if (/user feedback/.test(key)) action.userFeedback = value;
}

export function parsePrdContract(prdText: string): ParsedPrdContract {
  const text = String(prdText || "");
  const surfaces: PrdSurface[] = [];
  const actionContracts: PrdActionContract[] = [];
  let currentSurface: PrdSurface | null = null;
  let currentAction: PrdActionContract | null = null;

  for (const line of text.split(/\r?\n/)) {
    const surface = line.match(/^\s*(?:#{1,6}\s*)?(?:SURFACE|Surface)\s*:?\s*(SURF_[A-Z0-9_]+)(?:\s*[-\u2013:]\s*(.+))?/i);
    if (surface) {
      currentSurface = {
        surfaceId: surface[1].toUpperCase(),
        name: cleanValue(surface[2]),
        permittedActions: [],
      };
      surfaces.push(currentSurface);
      currentAction = null;
      continue;
    }

    const action = line.match(/^\s*(?:#{1,6}\s*)?ACTION\s*:?\s*(ACT_[A-Z0-9_]+)/i);
    if (action) {
      currentAction = {
        actionId: action[1].toUpperCase(),
        stateChanges: [],
      };
      actionContracts.push(currentAction);
      currentSurface = null;
      continue;
    }

    if (currentSurface) {
      const name = line.match(/^\s*-\s*(?:\*\*)?Name(?:\*\*)?\s*:\s*(.+)$/i);
      if (name) {
        currentSurface.name = cleanValue(name[1]);
        continue;
      }

      const permitted = line.match(/^\s*-\s*(?:\*\*)?(?:Permitted Actions|Actions)(?:\*\*)?\s*:\s*(.+)$/i);
      if (permitted) {
        currentSurface.permittedActions = parseSurfaceActions(
          permitted[1],
          currentSurface.surfaceId,
          currentSurface.name,
        );
        continue;
      }
    }

    if (currentAction) setActionField(currentAction, line);
  }

  const seen = new Set<string>();
  const surfaceActions = surfaces.flatMap((surface) =>
    surface.permittedActions.map((action) => ({
      ...action,
      surfaceName: action.surfaceName || surface.name,
      surfaceId: action.surfaceId || surface.surfaceId,
    })),
  ).filter((action) => {
    const key = `${action.surfaceId || ""}:${action.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    projectName: parseMetaValue(text, "PROJECT_NAME"),
    platform: parseMetaValue(text, "PLATFORM"),
    techStack: parseMetaValue(text, "TECH_STACK"),
    surfaces,
    surfaceActions,
    actionContracts,
  };
}
