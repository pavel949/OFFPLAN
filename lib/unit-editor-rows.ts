export type UnitEditorRow = {
  key: string; id?: string; label: string; bedrooms: string; floor: string;
  sqm: string; price: string; status: "unknown" | "available" | "reserved" | "sold";
  dirty: boolean; saved?: string; at: string | null;
  /** Snapshot last loaded for this row, excluding local edits. */
  baseline?: string;
  conflict?: "changed" | "deleted";
};

/** Refresh clean rows, retain local drafts, and never silently overwrite a
 * dirty row whose persisted version changed or disappeared during an import. */
export function reconcileUnitEditorRows(current: UnitEditorRow[], incoming: UnitEditorRow[]): UnitEditorRow[] {
  const old = new Map(current.filter(row => row.id).map(row => [row.id, row]));
  const ids = new Set(incoming.map(row => row.id));
  const refreshed = incoming.map(remote => {
    const local = old.get(remote.id);
    if (!local?.dirty) return remote;
    return { ...local, conflict: local.baseline === remote.baseline ? undefined : "changed" as const };
  });
  return [...refreshed, ...current.filter(row => !row.id || (!ids.has(row.id) && row.dirty))
    .map(row => row.id ? { ...row, conflict: "deleted" as const } : row)];
}
