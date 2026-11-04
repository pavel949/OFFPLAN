/** Evidence dates are calendar dates, not instants in the viewer's timezone. */
export function displayDate(value: string | null | undefined, ru: boolean) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString(ru ? "ru-RU" : "en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}
