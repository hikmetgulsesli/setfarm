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
    repo: "$HOME/projects/test-app-12345",
    branch: "feature-test-app",
    tech_stack: "vite-react",
    ui_language: "English",
    prd: "# Test App PRD - Note Taking Application\n\n" +
      "## 1. Overview\n" +
      "A simple note-taking application for individual users. Notes can be created, edited, deleted, marked complete, filtered, and searched. All data is stored persistently in localStorage.\n\n" +
      "## 2. Goals\n- Fast note create/edit flow\n- Effective filtering and search\n- Mobile responsive design\n- WCAG 2.1 AA accessibility\n- Light and dark theme support\n- Local-first persistent storage\n\n" +
      "## 3. Tech Stack\n- Framework: React 18 + TypeScript\n- Build: Vite\n- Styling: Tailwind CSS\n- State: useState/useReducer + Context API\n- Storage: localStorage\n- Routing: React Router v6\n\n" +
      "## 4. Functional Requirements\n### 4.1 Add Note\n- Title (required, max 100 chars), Description (optional, max 1000 chars)\n- Priority: low/medium/high (default: medium)\n- Due date (optional, datepicker)\n- Errors: 'Enter a title.', 'Description cannot exceed 1000 characters.'\n### 4.2 Edit Note\n- Existing note can be selected, form pre-filled, then saved or canceled\n### 4.3 Delete Note\n- Confirmation dialog before deletion\n- Toast: 'Note deleted.'\n### 4.4 Filtering\n- All / Active / Completed tabs\n- Active filter count is visible in the tab\n### 4.5 Search\n- Case-insensitive search across title and description\n- Minimum 2 characters, debounced 300ms\n\n" +
      "## 5. Data Model\n```\nNote {\n  id: string (uuid),\n  title: string,\n  description?: string,\n  priority: 'low' | 'medium' | 'high',\n  dueDate?: string (ISO),\n  completed: boolean,\n  createdAt: string (ISO),\n  updatedAt: string (ISO)\n}\n```\n\n" +
      "## 6. UI/UX\n### 6.1 Design System\n- Aesthetic: minimal\n- Palette: Primary #3B82F6, Secondary #1E40AF, Background #F8FAFC, Surface #FFFFFF, Text #1E293B, Border #E2E8F0, Success #22C55E, Error #EF4444, Warning #F59E0B\n- Typography: Space Grotesk (heading) + Inter (body)\n- Icon: Lucide React\n### 6.2 Spacing & Components\n- Spacing scale: 4/8/16/24/32/48/64 px\n- Border radius: 4/8/12/16 px\n- Shadow: sm/md/lg defined\n\n" +
      "## 7. Non-Functional\n### 7.1 Performance\n- Initial load < 2s\n- Page transition < 100ms\n### 7.2 Accessibility (WCAG 2.1 AA)\n- Full keyboard navigation, ARIA labels, focus state\n- Contrast >= 4.5:1 for text\n### 7.3 Browser Support\n- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+\n- Mobile: iOS Safari 14+, Android Chrome 90+\n\n" +
      "## 8. Project Structure\nsrc/components, src/screens, src/hooks, src/utils, src/types, App.tsx, main.tsx\n\n" +
      "## 9. Window State\nwindow.app = { state, notes: [], filter: 'all', searchTerm: '' }\n\n" +
      "## 10. Screens\n| # | Screen | Type | Description |\n|---|---|---|---|\n| 1 | Home | list | Notes list, filter tabs, search, and new note button |\n| 2 | Create Edit Note | form | Title, description, priority, due date, save, and cancel |\n| 3 | Settings | settings | Theme selection, language, and reset data |",
    prd_screen_count: "3",
    db_required: "none",
    ...overrides,
  };
}
