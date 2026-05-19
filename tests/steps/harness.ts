// Test harness for step modules. Mocks the minimal contract each module
// touches (context, parsed output) so unit tests don't need a real DB or
// running gateway. onComplete side effects that hit the DB are caught
// and returned as an "error" status — tests can opt in to verifying
// the call shape without actually writing.

import type { StepModule, ClaimContext, ParsedOutput, CompleteContext } from "../../dist/installer/steps/types.js";

export interface HarnessResult {
  prompt: string;
  promptBytes: number;
  validation: { ok: boolean; errors: string[] };
  contextAfterComplete: Record<string, string>;
  onCompleteCalled: boolean;
  onCompleteError?: string;
}

export async function runModule(
  m: StepModule,
  task: string,
  mockAgentOutput: ParsedOutput
): Promise<HarnessResult> {
  const context: Record<string, string> = {};
  const claimCtx: ClaimContext = {
    runId: "test-run-" + Math.random().toString(36).slice(2, 10),
    stepId: m.id,
    task,
    context,
  };

  await m.injectContext(claimCtx);
  const prompt = m.buildPrompt({ runId: claimCtx.runId, task, context });
  const validation = m.validateOutput(mockAgentOutput);

  let onCompleteCalled = false;
  let onCompleteError: string | undefined;
  if (validation.ok && m.onComplete) {
    onCompleteCalled = true;
    try {
      const completeCtx: CompleteContext = {
        runId: claimCtx.runId,
        stepId: m.id,
        parsed: mockAgentOutput,
        context,
      };
      await m.onComplete(completeCtx);
    } catch (e) {
      onCompleteError = String(e).slice(0, 300);
    }
  }

  return {
    prompt,
    promptBytes: Buffer.byteLength(prompt, "utf-8"),
    validation,
    contextAfterComplete: context,
    onCompleteCalled,
    onCompleteError,
  };
}

export function validPlanOutput(overrides: Partial<ParsedOutput> = {}): ParsedOutput {
  return {
    status: "done",
    project_name: "Test App",
    project_slug: "test-app",
    platform: "web",
    tech_stack: "vite-react",
    ui_language: "English",
    db_required: "none",
    design_required: "true",
    prd: "# Test App Product Contract\n\n" +
      "## 1. Context And Goals\n" +
      "Overview: Test App is a local note-taking product for users who need to create, filter, edit, and recover notes without a backend. Target users need fast capture, search, validation feedback, responsive layout, accessibility, and deterministic test state. Core objectives include useful first-load workflow, clear empty/error/loading states, WCAG 2.1 AA, and visible state changes for every primary action.\n\n" +
      "## 2. Data And State Contract\n" +
      "### Entities\n- Note: id:string required, title:string required, description:string optional, priority:enum required, completed:boolean required, createdAt:timestamp required, updatedAt:timestamp required.\n- Preference: key:string required, value:json required, updatedAt:timestamp required.\n### State Architecture\n- Server State: none.\n- Client/Local State: notes, selected note, filters, search, draft, loading, lastError, storageStatus.\n- URL / Router State: selected note or active filter may be reflected in query state.\n- Persisted State: localStorage notes and preferences.\n- Transient UI State: editor open state, validation messages, optimistic flags, focus.\n### Data Flow\n- Read Path: load localStorage, validate schema, seed empty state if needed.\n- Write Path: validate draft, write one note collection, refresh derived results.\n- Error Path: preserve last good state, expose retry and clear actions.\n- Side Effects: localStorage only.\n\n" +
      "## 3. Behavioral And Action Contract\n" +
      "### ACTION: ACT_SEARCH_NOTES\n- Surface Bound: SURF_WORKSPACE\n- Trigger: User types search or changes filters.\n- Preconditions: notes are loaded or recoverable.\n- Async Behavior: debounced local filter, no network wait.\n- Success Effect: visible results and result count update.\n- Failure Effect: previous results remain and retry is shown.\n- Navigation After Success: target same, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: query, filter, visibleNotes.\n- Persistence Effects: optional last filter preference.\n- User Feedback: active filter badges and count update.\n- Required Role: any.\n- Unauthorized Effect: not applicable.\n\n" +
      "### ACTION: ACT_OPEN_EDITOR\n- Surface Bound: SURF_WORKSPACE\n- Trigger: User clicks create or edit from the workspace.\n- Preconditions: notes are loaded or an empty state allows first-note creation.\n- Async Behavior: immediate local transition, no network wait.\n- Success Effect: editor opens with a blank or selected note draft.\n- Failure Effect: workspace remains visible and explains why editing is unavailable.\n- Navigation After Success: target SURF_NOTE_EDITOR, method modal.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: editorOpen, selectedNote, draft.\n- Persistence Effects: none until save.\n- User Feedback: editor appears with focus on the title field.\n- Required Role: any.\n- Unauthorized Effect: not applicable.\n\n" +
      "### ACTION: ACT_SAVE_NOTE\n- Surface Bound: SURF_NOTE_EDITOR\n- Trigger: User submits note form.\n- Preconditions: title is present and fields pass validation.\n- Async Behavior: disable submit while writing, timeout after 10000ms with retry.\n- Success Effect: note persists and workspace shows updated item.\n- Failure Effect: inline field errors or storage error banner, draft preserved.\n- Navigation After Success: target SURF_WORKSPACE, method replace.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: notes, selectedNote, draft, lastError.\n- Persistence Effects: localStorage write.\n- User Feedback: saved confirmation and updated timestamp.\n- Required Role: any.\n- Unauthorized Effect: not applicable.\n\n" +
      "### ACTION: ACT_CANCEL_EDIT\n- Surface Bound: SURF_NOTE_EDITOR\n- Trigger: User clicks cancel or closes the editor.\n- Preconditions: editor is open.\n- Async Behavior: immediate local transition, no network wait.\n- Success Effect: editor closes and workspace state remains stable.\n- Failure Effect: if unsaved changes require confirmation, keep the editor open and show choices.\n- Navigation After Success: target SURF_WORKSPACE, method back.\n- Navigation After Failure: target same, preserve_form_data true.\n- State Changes: editorOpen and draft confirmation state.\n- Persistence Effects: none.\n- User Feedback: editor closes or unsaved-change prompt appears.\n- Required Role: any.\n- Unauthorized Effect: not applicable.\n\n" +
      "## 4. Product Surfaces\n" +
      "### SURFACE: SURF_WORKSPACE\n- Name: Workspace\n- Purpose: Inspect, search, filter, select, complete, and recover note data from the main product workflow.\n- Data Entities Bound: Note, Preference\n- Core Content: note list, filters, search, summary count, selected preview, empty/loading/error states.\n- Permitted Actions: ACT_SEARCH_NOTES (control_hint: search_input_persistent), ACT_OPEN_EDITOR (control_hint: primary_button)\n- Entry Points: direct_url\n- Exit & Guard Rules: storage errors remain on the same surface with retry and clear actions.\n- Auth Required: false\n- Design Guidance: Compact product UI, no marketing hero, no unrelated admin/reporting modules.\n\n" +
      "### SURFACE: SURF_NOTE_EDITOR\n- Name: Note Editor\n- Purpose: Create or edit a note with validation, save, cancel, and preserved draft behavior.\n- Data Entities Bound: Note\n- Core Content: title, description, priority, completed toggle, validation messages, save/cancel controls.\n- Permitted Actions: ACT_SAVE_NOTE (control_hint: form_submit), ACT_CANCEL_EDIT (control_hint: secondary_button)\n- Entry Points: SURF_WORKSPACE\n- Exit & Guard Rules: save returns to workspace, cancel preserves existing note collection.\n- Auth Required: false\n- Design Guidance: Clear form layout with task-specific labels and inline validation.\n\n" +
      "## 5. Validation And Error Strategy\n- Validation Rules: title required max 100, description max 1000, priority in low/medium/high.\n- Business Logic Errors: inline form messages.\n- System/Network Errors: storage failure banner with retry/clear.\n- Error Display Policy: inline for fields, compact banner for storage.\n\n" +
      "## 6. System Contracts\n- Environment Needs: none.\n- External Integrations: none.\n- Permission Model: anonymous local user.\n- Security: no secrets in client state.\n\n" +
      "## 7. Platform Contract\n- Type: Web\n- Rendering Strategy: CSR for Vite React.\n- Auth Storage: none.\n- Route Guards: surface-level local state.\n- Test Surface: window.app is allowed for deterministic smoke/final-test inspection.\n\n" +
      "## 8. Testability Contract\n- Critical Path TC_LOAD_READY: app loads workspace with notes or empty state.\n- Critical Path TC_PRIMARY_ACTION: create note and observe list update.\n- Critical Path TC_ERROR_RECOVERY: corrupt storage and verify retry/clear path.\n- Test Handle Policy: data-testid on interactive controls and window.app state.\n- API Mock Hints: none.\n\n" +
      "## 9. Out Of Scope\n- No repo paths, branch names, GitHub URLs, run slugs, package names, or hardcoded directories.\n- No physical screen table or screen-count field.\n- No ecommerce, admin panel, account profile, or reporting module.",
    ...overrides,
  };
}
