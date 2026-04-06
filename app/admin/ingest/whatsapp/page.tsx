import Link from "next/link";
import { adminListWhatsAppIngests } from "@/app/actions/admin-brain";
import { hasSupabaseServiceConfig } from "@/lib/supabase/service";
import { WhatsAppIngestForm } from "./whatsapp-ingest-form";

export default async function AdminWhatsAppIngestPage() {
  if (!hasSupabaseServiceConfig()) {
    return (
      <div>
        <h1 className="serif text-2xl mb-1">Импорт WhatsApp</h1>
        <p className="text-[var(--red)] text-sm">Настройте Supabase.</p>
      </div>
    );
  }

  let list: Awaited<ReturnType<typeof adminListWhatsAppIngests>> = [];
  let err: string | null = null;
  try {
    list = await adminListWhatsAppIngests(30);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="serif text-2xl mb-1">Импорт из WhatsApp</h1>
      <p className="text-[var(--txt2)] text-sm mb-4 max-w-2xl">
        Официального API для чтения групповых чатов нет. Экспортируйте чат в
        WhatsApp (или скопируйте фрагмент) и вставьте сюда — разберём даты,
        авторов, ссылки и телефоны. Данные сохраняются в БД для дальнейшей
        обработки.
      </p>

      {err ? <p className="text-[var(--red)] text-sm mb-4">{err}</p> : null}

      <WhatsAppIngestForm />

      <h2 className="serif text-lg mt-10 mb-2">Последние импорты</h2>
      {list.length === 0 ? (
        <p className="text-[var(--txt2)] text-sm">Пока пусто.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {list.map((x) => (
            <li
              key={x.id}
              className="border border-[var(--bdr)] rounded-lg p-3 bg-[var(--sur)]"
            >
              <div className="text-xs text-[var(--txt2)]">
                {new Date(x.created_at).toLocaleString("ru-RU")} · {x.source_label}
              </div>
              <div className="mt-1 font-mono text-xs line-clamp-2">{x.preview}</div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8">
        <Link href="/admin/leads" className="underline font-semibold">
          Лиды / CRM →
        </Link>
      </p>
    </div>
  );
}
