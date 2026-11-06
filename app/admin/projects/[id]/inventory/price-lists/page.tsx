import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { adminGetProjectPayload } from "@/app/actions/admin-brain";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { listPriceLists, loadPriceListReview, PRICE_LIST_PAGE_SIZE } from "@/lib/monitor/archive";
import type { PriceChange } from "@/lib/monitor/compare";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";
import { PriceListUpload } from "./upload";

const date = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Bangkok",
});
const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const coverage = { full: "полный", partial: "частичный", unknown: "неизвестен" };
const status: Record<string, string> = {
  available: "Свободен", hold: "Hold", reserved: "Reserved", sold: "Продан", unknown: "Уточняется",
};
const price = (value: number | null, currency: string) => value === null ? "—" : `${number.format(value)} ${currency}`;

function changeDetail(change: PriceChange) {
  switch (change.kind) {
    case "new":
      return `Впервые в сравнении · ${price(change.next.price, change.next.currency)} · ${status[change.next.status]}`;
    case "price":
      return `Цена: ${price(change.previous, change.currency)} → ${price(change.next, change.currency)}`;
    case "currency":
      return `Валюта: ${price(change.previousPrice, change.previous)} → ${price(change.nextPrice, change.next)}`;
    case "status":
      return `Статус: ${status[change.previous]} → ${status[change.next]}`;
    case "absent_unconfirmed":
      return "Отсутствие в прайсе требует проверки";
  }
}

export default async function PriceListsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string; page?: string }>;
}) {
  if (!(await getAdminSessionOk())) notFound();
  if (!hasSupabaseServiceConfig()) return <p>Настройте Supabase (service role).</p>;
  const route = await params;
  if (!z.uuid().safeParse(route.id).success) notFound();
  const id = route.id.toLowerCase();
  const { file, page: pageParam } = await searchParams;
  if (file && !z.uuid().safeParse(file).success) notFound();
  const page = Number(pageParam ?? "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) notFound();
  const project = await adminGetProjectPayload(id).catch(() => null);
  if (!project) notFound();

  const db = createServiceRoleClient();
  const [{ entries, hasMore }, review] = await Promise.all([
    listPriceLists(db, id, (page - 1) * PRICE_LIST_PAGE_SIZE),
    file ? loadPriceListReview(db, id, file.toLowerCase()) : null,
  ]);
  if (file && !review) notFound();
  const source = review?.archive.snapshot.source;

  return (
    <div className="max-w-4xl">
      <Link className="underline text-sm" href={`/admin/projects/${id}/inventory`}>← Прайс-лист и инвентарь</Link>
      <h1 className="serif text-2xl my-4">Проверка прайсов застройщика</h1>
      <p className="mb-4">Здесь сохраняются оригиналы и показываются расхождения между версиями. Рабочий инвентарь и опубликованные предложения здесь недоступны для изменения.</p>
      <PriceListUpload projectId={id} />

      <section className="adm-card">
        <h2>Последние загрузки</h2>
        {entries.length === 0 && <p>Прайсы ещё не зарегистрированы.</p>}
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}><Link className="underline" href={`?page=${page}&file=${entry.id}`}>{entry.title}</Link> · {date.format(new Date(entry.created_at))}</li>
          ))}
        </ul>
        {(page > 1 || hasMore) && (
          <nav aria-label="Страницы архива" className="flex gap-4">
            {page > 1 && <Link className="underline" href={`?page=${page - 1}`}>Новые загрузки</Link>}
            {hasMore && <Link className="underline" href={`?page=${page + 1}`}>Более ранние загрузки</Link>}
          </nav>
        )}
      </section>

      {review && source && (
        <section className="adm-card">
          <h2>{review.row.title}</h2>
          <p>Версия {source.version} · {date.format(new Date(source.publishedAt))} · {source.scope} · охват {coverage[source.coverage]}</p>
          <p>
            <a className="underline" href={source.url} target="_blank" rel="noreferrer">Источник</a>
            {" · "}
            {review.original ? <a className="underline" href={review.original}>Скачать оригинал</a> : "Оригинал временно недоступен"}
          </p>
          {review.previous ? (
            <p>Предыдущая версия {review.previous.version} · {date.format(new Date(review.previous.publishedAt))} · <a className="underline" href={review.previous.url} target="_blank" rel="noreferrer">источник</a></p>
          ) : <p>Первый снимок для этой области.</p>}
          {review.historical && <p>В архиве есть более поздний прайс для этой области.</p>}
          {review.ambiguousDate && <p role="alert">У нескольких прайсов совпадает время публикации. Сравнение приостановлено, пока порядок источников неоднозначен.</p>}
          {review.comparison?.changes.length === 0 && <p>Расхождений по цене, валюте и статусу не найдено.</p>}
          {review.comparison && review.comparison.changes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead><tr><th>Корпус</th><th>Лот</th><th>На проверку</th></tr></thead>
                <tbody>{review.comparison.changes.map((change) => {
                  const [, building, unit] = change.key.split("::").map(decodeURIComponent);
                  return <tr key={`${change.key}:${change.kind}`}><td>{building}</td><td>{unit}</td><td>{changeDetail(change)}</td></tr>;
                })}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
