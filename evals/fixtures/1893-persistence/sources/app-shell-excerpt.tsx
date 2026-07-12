function ActiveSurface({ surface }: { surface: string }) {
  switch (surface) {
    case "editor":
      return <ShortEditorCompactOnePageTaskChipUtility />;
    case "operations":
    default:
      return <ShortOperationsCompactOnePageTaskChipUtility />;
  }
}
