function screenIdOf(screen) {
  return String(
    (screen?.name || '').replace(/^projects\/\d+\/screens\//, '') ||
    (screen?.sourceScreen || '').replace(/^projects\/\d+\/screens\//, '') ||
    screen?.id ||
    screen?.screenId ||
    screen?.screen_id ||
    ''
  ).trim();
}

function titleOf(screen) {
  return String(screen?.title || screen?.displayName || screen?.name || screen?.screenId || 'Untitled').trim() || 'Untitled';
}

function htmlUrlOf(screen) {
  return screen?.htmlUrl || screen?.htmlCode?.downloadUrl || screen?.html_code?.download_url || null;
}

function screenshotUrlOf(screen) {
  return screen?.screenshotUrl || screen?.screenshot?.downloadUrl || screen?.screenshot?.download_url || null;
}

function jsonPayloadsFromToolText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const candidates = [raw];
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());
  const objectStart = raw.indexOf('{');
  const objectEnd = raw.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) candidates.push(raw.slice(objectStart, objectEnd + 1));
  const arrayStart = raw.indexOf('[');
  const arrayEnd = raw.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) candidates.push(raw.slice(arrayStart, arrayEnd + 1));

  const parsed = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = candidate.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    try { parsed.push(JSON.parse(key)); } catch {}
  }
  return parsed;
}

function normalizedResponsePaths(value) {
  return [...new Set((value || []).map((item) => String(item || '').trim()).filter(Boolean))].sort();
}

function normalizeScreenEntry(screen, responsePath) {
  const screenId = screenIdOf(screen);
  if (!screenId) return null;
  const resourceName = String(screen?.name || '').trim();
  const explicitScreenIdentity = Boolean(
    screen?.id || screen?.screenId || screen?.screen_id || screen?.sourceScreen ||
    /\/screens\//.test(resourceName)
  );
  if (!explicitScreenIdentity) return null;
  return {
    ...screen,
    screenId,
    title: titleOf(screen),
    htmlUrl: htmlUrlOf(screen),
    screenshotUrl: screenshotUrlOf(screen),
    width: screen?.width,
    height: screen?.height,
    responsePaths: normalizedResponsePaths([responsePath]),
  };
}

function mergeScreenEntries(existing, candidate) {
  if (!existing) return candidate;
  if (!candidate) return existing;
  return {
    ...existing,
    ...candidate,
    screenId: candidate.screenId || existing.screenId,
    title: candidate.title && candidate.title !== 'Untitled' ? candidate.title : existing.title,
    htmlUrl: candidate.htmlUrl || existing.htmlUrl || null,
    screenshotUrl: candidate.screenshotUrl || existing.screenshotUrl || null,
    width: candidate.width || existing.width,
    height: candidate.height || existing.height,
    responsePaths: normalizedResponsePaths([
      ...(existing.responsePaths || []),
      ...(candidate.responsePaths || []),
    ]),
  };
}

/**
 * Reads only response-schema boundaries documented by Stitch MCP. It does not
 * recursively scan arbitrary descendants for a property named `screens`.
 * That distinction matters because generated code/animation canvas nodes can
 * themselves contain deprecated Design containers.
 */
function screenEntriesAtResponseBoundary(payload, basePath = '$') {
  const entries = [];
  const seenArrays = new Set();
  const addArray = (value, path) => {
    if (!Array.isArray(value) || seenArrays.has(value)) return;
    seenArrays.add(value);
    value.forEach((screen, index) => {
      const normalized = normalizeScreenEntry(screen, `${path}[${index}]`);
      if (normalized) entries.push(normalized);
    });
  };
  const visitKnownEnvelope = (value, path, allowRootArray = false) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      if (allowRootArray) addArray(value, path);
      return;
    }

    const self = normalizeScreenEntry(value, path);
    if (self) entries.push(self);
    addArray(value.screens, `${path}.screens`);
    addArray(value.screenInstances, `${path}.screenInstances`);
    addArray(value.screen_instances, `${path}.screen_instances`);
    addArray(value.design?.screens, `${path}.design.screens`);

    const outputComponentKey = Array.isArray(value.outputComponents)
      ? 'outputComponents'
      : 'output_components';
    const outputComponents = value[outputComponentKey];
    if (Array.isArray(outputComponents)) {
      outputComponents.forEach((component, index) => {
        addArray(component?.design?.screens, `${path}.${outputComponentKey}[${index}].design.screens`);
      });
    }
    if (value.screen) {
      const normalized = normalizeScreenEntry(value.screen, `${path}.screen`);
      if (normalized) entries.push(normalized);
    }
    if (value.structuredContent) visitKnownEnvelope(value.structuredContent, `${path}.structuredContent`);
    if (value.structured_content) visitKnownEnvelope(value.structured_content, `${path}.structured_content`);
  };

  visitKnownEnvelope(payload, basePath, true);
  return entries;
}

function collectScreenCandidatesFromResult(result) {
  const byId = new Map();
  const add = (candidate) => {
    if (!candidate?.screenId) return;
    byId.set(candidate.screenId, mergeScreenEntries(byId.get(candidate.screenId), candidate));
  };

  for (const candidate of screenEntriesAtResponseBoundary(result, '$result')) add(candidate);
  for (const [contentIndex, item] of (result?.content || []).entries()) {
    if (item?.type !== 'text') continue;
    const payloads = jsonPayloadsFromToolText(item.text);
    payloads.forEach((payload, payloadIndex) => {
      for (const candidate of screenEntriesAtResponseBoundary(
        payload,
        `$result.content[${contentIndex}].json[${payloadIndex}]`,
      )) add(candidate);
    });
  }
  return [...byId.values()];
}

function directScreenEvidence(screen) {
  const htmlAvailable = Boolean(htmlUrlOf(screen));
  const screenshotAvailable = Boolean(screenshotUrlOf(screen));
  const missingEvidence = [
    ...(!htmlAvailable ? ['html'] : []),
    ...(!screenshotAvailable ? ['screenshot'] : []),
  ];
  const screenType = String(screen?.screenType || screen?.screen_type || '').trim();
  const displayMode = String(
    screen?.screenMetadata?.displayMode ||
    screen?.screen_metadata?.display_mode ||
    ''
  ).trim();
  return {
    screenId: screenIdOf(screen),
    title: titleOf(screen),
    responsePaths: normalizedResponsePaths(screen?.responsePaths || []),
    ...(screenType ? { screenType } : {}),
    ...(displayMode ? { displayMode } : {}),
    ...(screen?.width != null ? { width: String(screen.width) } : {}),
    ...(screen?.height != null ? { height: String(screen.height) } : {}),
    htmlAvailable,
    screenshotAvailable,
    disposition: missingEvidence.length === 0
      ? 'admitted_renderable_screen'
      : 'excluded_missing_render_evidence',
    missingEvidence,
  };
}

function partitionDirectScreenCandidates(candidates) {
  const byId = new Map();
  for (const candidate of candidates || []) {
    if (!candidate?.screenId) continue;
    byId.set(candidate.screenId, mergeScreenEntries(byId.get(candidate.screenId), candidate));
  }
  const all = [...byId.values()];
  const evidence = all.map(directScreenEvidence).sort((left, right) => {
    if (left.screenId < right.screenId) return -1;
    if (left.screenId > right.screenId) return 1;
    return 0;
  });
  const admittedIds = new Set(evidence
    .filter((item) => item.disposition === 'admitted_renderable_screen')
    .map((item) => item.screenId));
  return {
    candidates: all,
    screens: all.filter((screen) => admittedIds.has(screen.screenId)),
    excluded: all.filter((screen) => !admittedIds.has(screen.screenId)),
    evidence,
  };
}

export {
  collectScreenCandidatesFromResult,
  directScreenEvidence,
  htmlUrlOf,
  jsonPayloadsFromToolText,
  mergeScreenEntries,
  normalizeScreenEntry,
  partitionDirectScreenCandidates,
  screenEntriesAtResponseBoundary,
  screenIdOf,
  screenshotUrlOf,
  titleOf,
};
