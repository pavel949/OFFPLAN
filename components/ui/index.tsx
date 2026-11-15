import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

/** Shared visual primitives. Domain logic and evidence decisions stay with callers. */
export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" }) {
  return <button type="button" {...props} className={`ui-button ui-button--${variant} ${className}`} />;
}
export function ActionLink({ href, variant = "primary", className = "", ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: "primary" | "secondary" | "quiet" }) {
  return <Link href={href} {...props} className={`ui-button ui-button--${variant} ${className}`} />;
}
export function Surface({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  return <section className={`ui-surface ${className}`} aria-label={label}>{children}</section>;
}
export function PageIntro({ eyebrow, title, description, breadcrumbs, children }: { eyebrow?: string; title: string; description?: string; breadcrumbs?: ReactNode; children?: ReactNode }) {
  return <header className="ui-page-intro"><div className="ui-container">{breadcrumbs ? <nav className="ui-breadcrumbs" aria-label="Хлебные крошки">{breadcrumbs}</nav> : null}<div className="ui-page-intro-row"><div>{eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}<h1>{title}</h1>{description ? <p className="ui-description">{description}</p> : null}</div>{children}</div></div></header>;
}
export function SectionHeading({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: ReactNode }) {
  return <div className="ui-section-heading"><div>{eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}<h2>{title}</h2>{description ? <p className="ui-description">{description}</p> : null}</div>{children}</div>;
}
export type Fact = { label: string; value: ReactNode; note?: ReactNode };
export function FactList({ items, columns = false }: { items: Fact[]; columns?: boolean }) {
  return <dl className={`ui-facts${columns ? " ui-facts--columns" : ""}`}>{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}{item.note ? <small>{item.note}</small> : null}</dd></div>)}</dl>;
}
export function StatusLabel({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "info" | "warning" | "success" }) {
  return <span className={`ui-status ui-status--${tone}`}>{children}</span>;
}
export function PriceBlock({ label, value, note, unavailable = false }: { label: string; value: ReactNode; note?: ReactNode; unavailable?: boolean }) {
  return <div className={`ui-price${unavailable ? " ui-price--unavailable" : ""}`}><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</div>;
}
export function MetricCard({ label, value, note }: { label: string; value: ReactNode; note: ReactNode }) {
  return <div className="ui-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
export function Disclosure({ title, count, children, open = false }: { title: ReactNode; count?: number; children: ReactNode; open?: boolean }) {
  return <details className="ui-disclosure" open={open || undefined}><summary><span>{title}</span>{count != null ? <small>{count}</small> : null}</summary><div className="ui-disclosure-body">{children}</div></details>;
}
