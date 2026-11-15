/** Parse operator-entered quantities without silently changing decimal commas.
 * Spaces may group thousands; a single comma with three trailing digits is
 * ambiguous (1,234), so ask the editor to use a dot or spaces instead.
 * Invalid input stays NaN for the existing server numeric validation to reject.
 */
export function parseUnitNumber(input: string): number | null {
  const text = input.trim();
  if (!text) return null;
  const normalized = text.replace(/[\u00a0\u202f]/g, " ");
  if (!/^[+-]?(?:\d+|\d{1,3}(?: \d{3})+)(?:[.,]\d+)?$/.test(normalized)) return Number.NaN;
  if (/,[0-9]{3}$/.test(normalized)) return Number.NaN;
  const number = Number(normalized.replaceAll(" ", "").replace(",", "."));
  return Number.isFinite(number) ? number : Number.NaN;
}
