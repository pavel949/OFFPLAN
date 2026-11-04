import Link from "next/link";

const TABS = [
  ["", "Карточка"],
  ["/inventory", "Лоты и цены"],
  ["/facts", "Фото"],
  ["/updates", "Новости"],
  ["/campaigns", "Акции"],
  ["/materials", "Материалы"],
  ["/verification", "Проверка"],
] as const;

export function ProjectTabs({ projectId, active, name }: { projectId: string; active: string; name?: string }) {
  return (
    <>
      <Link href="/partner/projects" className="adm-back">← Все проекты</Link>
      {name ? <h1 style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 30, fontWeight: 600, margin: "0 0 14px" }}>{name}</h1> : null}
      <nav className="adm-tabs" aria-label="Разделы проекта">
        {TABS.map(([suffix, label]) => (
          <Link key={suffix} href={`/partner/projects/${projectId}${suffix}`} className={`adm-tab${active === suffix ? " on" : ""}`}>{label}</Link>
        ))}
      </nav>
    </>
  );
}
