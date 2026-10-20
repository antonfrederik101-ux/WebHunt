// Compatibility only: preserve existing local leads during the product rename.
export function migrateLocalData(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
) {
  for (const kind of ["leads", "statuses", "analyses"]) {
    const previous = `webradar-guest-${kind}`,
      current = `webhunt-guest-${kind}`;
    const value = storage.getItem(previous);
    if (value !== null && storage.getItem(current) === null) {
      storage.setItem(current, value);
      storage.removeItem(previous);
    }
  }
}
