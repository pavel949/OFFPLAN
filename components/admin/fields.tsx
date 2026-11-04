import { taxLabel } from "@/lib/taxonomy";

export function Field({ label, hint, cls = "c4", required, children }: { label: string; hint?: string; cls?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className={`adm-field ${cls}`}>
      <label>{label}{required ? <em>*</em> : null}</label>
      {children}
      {hint ? <span className="adm-hint">{hint}</span> : null}
    </div>
  );
}

export function Opts({ kind, keys }: { kind: "seg" | "type" | "stK" | "beach" | "own" | "mgmt" | "focus"; keys: readonly string[] }) {
  return <>{keys.map((k) => <option key={k} value={k}>{taxLabel(kind, k, "ru")}</option>)}</>;
}

