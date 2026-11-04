import {
  SOURCE_KIND_LABEL_EN,
  SOURCE_KIND_LABEL_RU,
  sourceFreshness,
  sourceHost,
  type PublicSource,
} from "@/lib/sources";

/** Links the developer has explicitly marked as public: brochure, renders, master plan, etc. */
export function ProjectMaterials({
  sources,
  lang,
}: {
  sources: PublicSource[];
  lang: "ru" | "en";
}) {
  if (sources.length === 0) return null;
  const ru = lang === "ru";
  return (
    <section className="py-5" aria-labelledby="pd-materials">
      <h2 id="pd-materials" className="text-xl">
        {ru ? "Материалы застройщика" : "Developer materials"}
      </h2>
      <p className="text-sm text-[var(--muted)]">
        {ru
          ? "Ссылки предоставлены застройщиком; содержимое хранится у него и не проверяется IE."
          : "Links supplied by the developer; content is hosted by them and is not verified by IE."}
      </p>
      <ul className="mt-2 space-y-1">
        {sources.map((s) => {
          const f = sourceFreshness(s.cadence, s.confirmed_at);
          return (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                {(ru ? SOURCE_KIND_LABEL_RU : SOURCE_KIND_LABEL_EN)[s.kind]}: {s.title}
              </a>{" "}
              <small className="text-[var(--muted)]">
                · {sourceHost(s.url)}
                {s.confirmed_at
                  ? ` · ${ru ? "подтверждено" : "confirmed"} ${new Date(s.confirmed_at).toLocaleDateString(ru ? "ru-RU" : "en-GB")}${f === "stale" ? (ru ? " (давно)" : " (stale)") : ""}`
                  : ""}
              </small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
