import { TIER_ORDER, TIER_RU, type Tier } from "@/lib/clearview/engine";

export const TIER_COLOR: Record<Tier, string> = {
  PLATINUM: "#2a4a8a", GOLD: "#b8872a", SILVER: "#6b7385", BRONZE: "#9a5a2c", CAUTION: "#c46a14", REJECT: "#a52a2a",
};

/** Six-step ladder with the reached tier (or a range) highlighted. No numbers: the position is the message. */
export function TierLadder({ low, high, compact }: { low: Tier; high: Tier; compact?: boolean }) {
  const lo = TIER_ORDER.indexOf(low), hi = TIER_ORDER.indexOf(high);
  const steps = [...TIER_ORDER].reverse();
  return (
    <div className="cv-ladder" role="img" aria-label={low === high ? `Уровень: ${TIER_RU[low].label}` : `Уровень от ${TIER_RU[low].label} до ${TIER_RU[high].label}`}>
      {steps.map((t) => {
        const i = TIER_ORDER.indexOf(t);
        const on = i >= lo && i <= hi;
        return (
          <div key={t} className={`cv-step${on ? " on" : ""}`} style={on ? { background: TIER_COLOR[t], color: "#fff" } : undefined}>
            {compact ? null : <span>{TIER_RU[t].label}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Radar of the nine domains on a five-level scale. */
export function Radar({ data, size = 300 }: { data: { code: string; label: string; level: number }[]; size?: number }) {
  const n = data.length, c = size / 2, R = size / 2 - 52;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r] as const;
  };
  const poly = data.map((d, i) => pt(i, (R * d.level) / 5).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }} role="img" aria-label="Радар по девяти областям">
      {[1, 2, 3, 4, 5].map((l) => (
        <polygon key={l} points={data.map((_, i) => pt(i, (R * l) / 5).join(",")).join(" ")} fill="none" stroke="rgba(11,27,52,.14)" strokeWidth="1" />
      ))}
      {data.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgba(11,27,52,.1)" />; })}
      <polygon points={poly} fill="rgba(212,173,90,.32)" stroke="#b8872a" strokeWidth="2" />
      {data.map((d, i) => {
        const [x, y] = pt(i, (R * d.level) / 5);
        const [lx, ly] = pt(i, R + 24);
        return (
          <g key={d.code}>
            <circle cx={x} cy={y} r="4" fill="#b8872a" />
            <text x={lx} y={ly} fontSize="11" fontWeight="700" textAnchor={lx < c - 4 ? "end" : lx > c + 4 ? "start" : "middle"} dominantBaseline="middle" fill="#0b1b34">{d.code}</text>
          </g>
        );
      })}
    </svg>
  );
}

const LEVEL_LABEL = ["", "Критично", "Слабо", "Средне", "Хорошо", "Сильно"];
const LEVEL_COLOR = ["", "#a52a2a", "#c46a14", "#c9a227", "#5a9a5a", "#1f7a45"];

/** Five-segment bar per domain. */
export function LevelBar({ level }: { level: number }) {
  return (
    <div className="cv-level" aria-label={LEVEL_LABEL[level]}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} style={{ background: i <= level ? LEVEL_COLOR[level] : undefined }} />)}
      <b style={{ color: LEVEL_COLOR[level] }}>{LEVEL_LABEL[level]}</b>
    </div>
  );
}

/** Two bars per row: baseline (grey) and the draft (gold), for the studio simulator. */
export function DualBars({ rows }: { rows: { label: string; before: number; after: number }[] }) {
  return (
    <div style={{ display: "grid", gap: 7 }}>
      {rows.map((r) => (
        <div key={r.label} className="cv-dual">
          <span>{r.label}</span>
          <div>
            <div className="cv-bar"><b style={{ width: `${Math.max(2, r.before)}%`, background: "#8a93a6" }} /></div>
            <div className="cv-bar"><b style={{ width: `${Math.max(2, r.after)}%`, background: "#b8872a" }} /></div>
          </div>
          <em className={r.after - r.before > 0.4 ? "up" : r.after - r.before < -0.4 ? "down" : ""}>{r.after - r.before > 0 ? "+" : ""}{(r.after - r.before).toFixed(1)}</em>
        </div>
      ))}
    </div>
  );
}
