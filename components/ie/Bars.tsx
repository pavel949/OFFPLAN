/** Accessible horizontal bars without a chart library: one row per item, value printed, scaled to the max. */
export function Bars({
  items,
  unit = "",
  href,
  color = "var(--ie-gold)",
}: {
  items: { key: string; label: string; value: number; sub?: string; href?: string }[];
  unit?: string;
  href?: (key: string) => string | undefined;
  color?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="ie-bars">
      {items.map((i) => {
        const link = i.href ?? href?.(i.key);
        const row = (
          <>
            <span className="ie-bars-l">{i.label}</span>
            <span className="ie-bars-t" aria-hidden="true">
              <i style={{ width: `${(i.value / max) * 100}%`, background: color }} />
            </span>
            <b>
              {i.value}
              {unit}
            </b>
          </>
        );
        return (
          <li key={i.key} title={i.sub}>
            {link ? <a href={link}>{row}</a> : <div>{row}</div>}
          </li>
        );
      })}
    </ul>
  );
}
