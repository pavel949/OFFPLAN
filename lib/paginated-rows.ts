/** Stable ordering belongs to the query. Propagate failures instead of returning a partial catalogue. */
export async function readAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{data: T[] | null; error: {message:string} | null}>, size = 400): Promise<T[]> {
  if (!Number.isInteger(size) || size < 1) throw new Error('Invalid page size');
  const rows:T[] = [];
  for (let from=0;;from+=size) {
    const page = await fetchPage(from,from+size-1);
    if (page.error) throw new Error(page.error.message);
    const items=page.data ?? [];
    rows.push(...items);
    if (items.length < size) return rows;
  }
}
