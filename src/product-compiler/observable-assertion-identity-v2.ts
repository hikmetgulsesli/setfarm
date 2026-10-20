export function canonicalizeObservableAssertionsV2<
  T extends { phase: string; property: string },
>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => {
    const a = `${left.phase}\0${left.property}`;
    const b = `${right.phase}\0${right.property}`;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
