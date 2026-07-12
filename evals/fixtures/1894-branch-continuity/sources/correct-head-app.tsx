function ShortEditorSurface(): JSX.Element {
  const shell = useAppShell();
  const actions = {
    "cancel-6": () => actCancelEdit(shell),
    "save-task-7": () => actSaveRecord(shell),
  };
  return <ShortEditorCompactOnePageTaskChipUtility actions={actions} />;
}

const SURFACE_COMPONENTS = {
  "short-operations": ShortOperationsSurface,
  "short-editor": ShortEditorSurface,
};
