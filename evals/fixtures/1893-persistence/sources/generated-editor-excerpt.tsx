export interface ShortEditorProps {
  actions?: Partial<Record<"cancel-2" | "save-task-3", () => void>>;
}

export function ShortEditor({ actions }: ShortEditorProps) {
  return (
    <form>
      <input id="taskName" name="taskName" type="text" defaultValue="" />
      <textarea id="notes" name="notes"></textarea>
      <button type="button" data-action-id="save-task-3" onClick={actions?.["save-task-3"]}>
        Save Task
      </button>
    </form>
  );
}
