/** Flatten JSON for moderation diff (paths → string values). */
export function flattenJson(
  obj: unknown,
  prefix = "",
): Record<string, string> {
  const out: Record<string, string> = {};
  if (obj === null || obj === undefined) {
    out[prefix || "."] = String(obj);
    return out;
  }
  if (typeof obj !== "object" || Array.isArray(obj)) {
    out[prefix || "."] =
      typeof obj === "string" ? obj : JSON.stringify(obj, null, 0);
    return out;
  }
  const o = obj as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length === 0) {
    out[prefix || "."] = "{}";
    return out;
  }
  for (const k of keys) {
    const path = prefix ? `${prefix}.${k}` : k;
    const v = o[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flattenJson(v, path));
    } else {
      out[path] =
        typeof v === "string" ? v : JSON.stringify(v, null, 0);
    }
  }
  return out;
}

export type JsonDiffRow = {
  path: string;
  before: string;
  after: string;
};

export function diffJsonObjects(
  before: unknown,
  after: unknown,
  maxRows = 200,
): JsonDiffRow[] {
  const a = flattenJson(before);
  const b = flattenJson(after);
  const paths = new Set([...Object.keys(a), ...Object.keys(b)]);
  const rows: JsonDiffRow[] = [];
  for (const path of paths) {
    const va = a[path] ?? "";
    const vb = b[path] ?? "";
    if (va !== vb) {
      rows.push({ path, before: va, after: vb });
      if (rows.length >= maxRows) break;
    }
  }
  return rows.sort((x, y) => x.path.localeCompare(y.path));
}
