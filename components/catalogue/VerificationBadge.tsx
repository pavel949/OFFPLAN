import Link from "next/link";
import { effectiveLevel, LEVEL_TEXT, levelLabel } from "@/lib/registry/levels";
import type { CatalogProject } from "@/lib/types";

/** Registry verification level of a project (expired verification counts as L0). */
export function VerificationBadge({
  ver,
  lang,
}: {
  ver: CatalogProject["ver"];
  lang: "ru" | "en";
}) {
  const level = effectiveLevel(ver);
  const t = LEVEL_TEXT[level];
  const date =
    level > 0 && ver?.verifiedAt
      ? new Date(ver.verifiedAt).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB")
      : null;
  const title = `${lang === "ru" ? t.ruHint : t.enHint}${date ? ` (${lang === "ru" ? "проверено" : "verified"} ${date})` : ""}`;
  return (
    <Link
      href="/registry"
      className={`ver-badge ver-l${level}`}
      title={title}
      aria-label={levelLabel(level, lang)}
    >
      {level > 0 ? "🛡 " : ""}
      {levelLabel(level, lang, true)}
    </Link>
  );
}
