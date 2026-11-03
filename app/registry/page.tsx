import type { Metadata } from "next";
import Link from "next/link";
import { createAnonClient, hasSupabasePublicConfig } from "@/lib/supabase/anon";
import { LEVEL_TEXT } from "@/lib/registry/levels";
import { projectSlug } from "@/lib/slug";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Реестр верификации проектов — Ignatev Estate",
  description:
    "Как проверяются проекты застройщиков: уровни L0–L2, чек-лист, правила независимости и публичный журнал решений.",
  alternates: { canonical: "/registry" },
};

type Item = { key: string; required: boolean; title: { ru: string; en: string }; hint: { ru: string; en: string } };
type Template = { level: number; items: Item[] };
type EventRow = {
  id: string;
  created_at: string;
  event: string;
  level_from: number | null;
  level_to: number | null;
  summary: string;
  catalog_projects: { legacy_id: number | null; payload: { n?: string } | null } | null;
};

const EVENT_RU: Record<string, string> = {
  submitted: "Подана заявка на верификацию",
  changes_requested: "Запрошены уточнения",
  approved: "Уровень подтверждён",
  rejected: "В верификации отказано",
  revoked: "Верификация отозвана",
  expired: "Срок верификации истёк",
  withdrawn: "Заявка отозвана",
};

async function load(): Promise<{ templates: Template[]; events: EventRow[] }> {
  if (!hasSupabasePublicConfig()) return { templates: [], events: [] };
  try {
    const db = createAnonClient();
    const [t, e] = await Promise.all([
      db.from("verification_checklist_templates").select("level, items").eq("jurisdiction_code", "TH").eq("is_active", true).order("level"),
      db
        .from("verification_events")
        .select("id, created_at, event, level_from, level_to, summary, catalog_projects(legacy_id, payload)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return {
      templates: (t.data ?? []) as unknown as Template[],
      events: (e.data ?? []) as unknown as EventRow[],
    };
  } catch {
    return { templates: [], events: [] };
  }
}

export default async function RegistryPage() {
  const { templates, events } = await load();
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 16px", lineHeight: 1.65 }}>
      <p>
        <Link href="/">← Каталог</Link>
      </p>
      <h1 className="serif" style={{ fontSize: "2rem", margin: "16px 0" }}>
        Реестр верификации проектов
      </h1>
      <p>
        Реестр проверяет документы застройщиков и проектов по единому публичному чек-листу и присваивает
        проекту уровень верификации. Решения принимают эксперты реестра, которые не участвуют в продажах
        и не зависят от брокеров.
      </p>

      <h2 style={{ marginTop: 28 }}>Уровни</h2>
      <ul>
        {([0, 1, 2] as const).map((l) => (
          <li key={l}>
            <b>{LEVEL_TEXT[l].ruShort}</b> — {LEVEL_TEXT[l].ru}. {LEVEL_TEXT[l].ruHint}
          </li>
        ))}
      </ul>
      <p style={{ opacity: 0.8 }}>
        Уровень действует 12 месяцев; по истечении срока проект возвращается на L0 до повторной проверки.
        Уровень может быть отозван в любой момент при выявлении несоответствий; об этом публикуется запись.
      </p>

      <h2 style={{ marginTop: 28 }}>Чек-лист</h2>
      {templates.length === 0 ? (
        <p style={{ opacity: 0.7 }}>Чек-лист будет опубликован после запуска реестра.</p>
      ) : (
        templates.map((t) => (
          <div key={t.level}>
            <h3>Уровень L{t.level}</h3>
            <ul>
              {t.items.map((i) => (
                <li key={i.key}>
                  <b>{i.title.ru}</b>
                  {i.required ? "" : " (желательно)"} — {i.hint.ru}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <h2 style={{ marginTop: 28 }}>Правила независимости</h2>
      <ul>
        <li><b>Разделение ролей.</b> Верификацию проводят эксперты реестра; сотрудники брокера и администраторы каталога решений не принимают.</li>
        <li><b>Принцип «четырёх глаз».</b> Итоговое решение принимает эксперт, который не проверял документы дела.</li>
        <li><b>Отвод при конфликте интересов.</b> Эксперт, чья организация имеет коммерческий интерес в проекте (в том числе как брокер), не может участвовать в деле. Эксперт вправе заявить самоотвод.</li>
        <li><b>Сбор не зависит от результата.</b> Застройщик оплачивает проверку по себестоимости; размер сбора одинаков при положительном и отрицательном решении.</li>
        <li><b>Право ответа.</b> Застройщик видит замечания и может ответить на них и предоставить дополнительные документы до решения.</li>
        <li><b>Прозрачность.</b> Методика и журнал решений публичны.</li>
      </ul>

      <h2 style={{ marginTop: 28 }}>Раскрытие информации</h2>
      <p>
        Ignatev Estate, оператор каталога, как брокер может получать вознаграждение от застройщиков при
        продаже объектов. Это не влияет на решения реестра: коммерческие интересы декларируются, а эксперт
        с таким интересом отводится от проверки соответствующего проекта. Сортировка каталога по умолчанию
        не зависит от вознаграждения.
      </p>

      <h2 style={{ marginTop: 28 }}>Журнал решений</h2>
      {events.length === 0 ? (
        <p style={{ opacity: 0.7 }}>Записей пока нет.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {events.map((e) => {
            const cp = e.catalog_projects;
            const name = cp?.payload?.n ?? "Проект";
            const href = cp?.legacy_id != null ? `/project/${projectSlug({ id: cp.legacy_id, n: name })}` : null;
            return (
              <li key={e.id} style={{ borderTop: "1px solid var(--line, #ddd)", padding: "10px 0" }}>
                <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                  {new Date(e.created_at).toLocaleDateString("ru-RU")} · {EVENT_RU[e.event] ?? e.event}
                  {e.event === "approved" && e.level_to ? ` · L${e.level_to}` : ""}
                </div>
                <div>
                  {href ? <Link href={href}>{name}</Link> : name}
                </div>
                {e.summary ? <div style={{ opacity: 0.85 }}>{e.summary}</div> : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
