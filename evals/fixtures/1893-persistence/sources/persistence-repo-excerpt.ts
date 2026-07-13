const safeSet = (key: string, value: string): boolean => {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const saveTasks = (tasks: ReadonlyArray<Task>): boolean => {
  const clone = tasks.map((task) => ({ ...task }));
  return safeSet(TASKS_STORAGE_KEY, JSON.stringify(clone));
};
