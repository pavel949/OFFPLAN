/** Shared navigation and editing guidance. No database or credentials in this module. */
export const ADMIN_GROUPS = [
  { label: "Каждый день", items: [
    { href: "/admin", label: "Обзор" },
    { href: "/admin/projects", label: "Проекты" },
    { href: "/admin/leads", label: "Заявки клиентов" },
    { href: "/admin/guide", label: "Что и где редактировать" },
  ] },
  { label: "Данные и проверка", items: [
    { href: "/admin/imports", label: "Материалы застройщиков" },
    { href: "/admin/developers", label: "Застройщики" },
    { href: "/admin/evidence", label: "Проверка сведений" },
    { href: "/admin/moderation", label: "Очередь публикации" },
    { href: "/admin/corrections", label: "Запросы правок" },
  ] },
  { label: "Сделки", items: [
    { href: "/admin/deals", label: "Сделки" },
    { href: "/admin/commissions", label: "Комиссии" },
  ] },
  { label: "Система и инструменты", items: [
    { href: "/admin/methodology", label: "Методология ClearView" },
    { href: "/admin/settings", label: "Тексты и показатели рынка" },
    { href: "/admin/readiness", label: "Готовность сервисов" },
    { href: "/admin/ingest/whatsapp", label: "Разбор WhatsApp" },
    { href: "/admin/catalog", label: "Массовый импорт JSON" },
  ] },
] as const;

export function adminRouteActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}

export const PROJECT_EDITING = [
  { key: "info", label: "Основное", edit: "Название, застройщик, локация, сроки, описание и параметры карточки.", effect: "Сохранение меняет карточку проекта. Для опубликованного проекта изменения доступны на сайте; сохранение черновика само по себе его не публикует.", caution: "Цена «от» здесь не заменяет цены отдельных лотов. Заполненность не является проверкой достоверности." },
  { key: "units", label: "Лоты и цены", edit: "Номера лотов, площади, цены и наличие; загрузка прайс-листа.", effect: "Лоты служат основой для предложений. Для показа предложения покупателю также нужны действующие опубликованные условия во вкладке «Структура и условия».", caution: "Цена и площадь опубликованного предложения берутся из версии условий. Изменение лота не переписывает эту версию: обновите и опубликуйте условия во вкладке «Структура и условия»." },
  { key: "sales", label: "Структура и условия", edit: "Корпуса, типы, предложения, условия оплаты, источники и сроки действия.", effect: "Сохранить версию и опубликовать её — разные действия. На сайте используются опубликованные условия с действующим сроком.", caution: "Черновая версия не заменяет действующие условия автоматически." },
  { key: "photos", label: "Фото", edit: "Фотографии проекта и лотов, подписи и дата съёмки.", effect: "Опубликованные фотографии используются на публичной карточке и в подборе обложки.", caution: "Проверяйте статус и ошибки загрузки: выбранный файл ещё не означает сохранённое фото." },
  { key: "news", label: "Новости и акции", edit: "Новости стройки и акции проекта.", effect: "Публикация новости и условия акции управляются отдельно от основного описания.", caution: "Указывайте реальные даты и сроки. Текст акции не меняет цену лота." },
  { key: "materials", label: "Материалы", edit: "Ссылки на источники, документы и материалы импорта.", effect: "Материалы помогают заполнить и проверить проект. Добавленная ссылка или файл не заменяют поля карточки автоматически.", caution: "Импорт сначала проверьте; конфиденциальные документы не следует считать публичной брошюрой." },
  { key: "advanced", label: "Дополнительно", edit: "Коммерческие интересы и технический JSON карточки.", effect: "JSON напрямую заменяет данные карточки; это инструмент специалиста, а не обычный способ редактирования.", caution: "Для ежедневной работы используйте «Основное». Поля JSON и связи справочников должны оставаться согласованными." },
] as const;

export function projectEditingHelp(tab: string) {
  return PROJECT_EDITING.find(item => item.key === tab) ?? PROJECT_EDITING[0];
}

/** A failed query must never masquerade as an empty catalogue/reference list. */
export function requireAdminQuery(result: { error?: unknown }, message: string): void {
  if (result.error) throw new Error(message);
}

export function projectIsPublished(row: { is_published: boolean; moderation_status: string }): boolean {
  return row.is_published && row.moderation_status === "published";
}
