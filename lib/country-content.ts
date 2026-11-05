/**
 * Country knowledge modules: rules and legal information per jurisdiction, with a verification lifecycle.
 *
 *   planned   - the topic is reserved, no content yet
 *   draft     - written by the editorial team from general knowledge; NOT checked by a local lawyer
 *   in_review - sent to a local qualified lawyer
 *   verified  - confirmed by a named local lawyer on a given date, valid until a given date
 *   outdated  - the validity date has passed or the law changed; hidden from "verified" counts
 *
 * Nothing below is verified yet; the model exists so that the platform shows honestly what is checked
 * and by whom as countries are added. Stored in `legal_topics` (see migration); this file seeds it and is
 * the offline fallback. Statements are general by design and are not legal advice.
 */
export type LegalStatus = "planned" | "draft" | "in_review" | "verified" | "outdated";

export type LegalTopic = {
  country: "TH" | "VN" | "KH";
  topic: string;
  title: string;
  summary: string;
  points: string[];
  status: LegalStatus;
  reviewedBy: string | null;
  reviewedAt: string | null; // ISO date
  validUntil: string | null;
  sources: { title: string; url: string }[];
  sort: number;
};

export const STATUS_LABEL: Record<LegalStatus, { ru: string; tone: "ok" | "warn" | "muted" }> = {
  verified: { ru: "Проверено юристом", tone: "ok" },
  in_review: { ru: "На проверке у юриста", tone: "warn" },
  draft: { ru: "Черновик, не проверено юристом", tone: "warn" },
  planned: { ru: "Готовится", tone: "muted" },
  outdated: { ru: "Требует обновления", tone: "warn" },
};

export const LEGAL_TOPICS: LegalTopic[] = [
  {
    country: "TH", topic: "ownership", sort: 10, title: "Что может купить иностранец",
    summary: "Квартиру (кондо) можно оформить в собственность в пределах иностранной квоты здания; для вилл и земли обычно используют долгосрочную аренду земли или компанию, и каждая схема требует независимой юридической проверки.",
    points: [
      "Кондо: доля иностранцев в здании ограничена (как правило, 49% площади).",
      "Земля в собственность иностранцу, как правило, недоступна; распространена регистрируемая аренда земли на длительный срок.",
      "Схемы «через компанию» несут юридические риски и должны быть проверены юристом.",
    ],
    status: "draft", reviewedBy: null, reviewedAt: null, validUntil: null,
    sources: [{ title: "Department of Lands (Таиланд)", url: "https://www.dol.go.th/" }], 
  },
  {
    country: "TH", topic: "process", sort: 20, title: "Порядок покупки новостройки",
    summary: "Бронирование, договор купли-продажи (SPA) с графиком платежей по этапам стройки, приёмка объекта и регистрация прав в земельном департаменте.",
    points: [
      "Платежи должны быть привязаны к подтверждённым этапам стройки.",
      "Платите только на счёт юридического лица, указанного в договоре.",
      "Для кондо подтверждение поступления средств из-за границы нужно при регистрации (форма FET).",
    ],
    status: "draft", reviewedBy: null, reviewedAt: null, validUntil: null,
    sources: [{ title: "Department of Lands (Таиланд)", url: "https://www.dol.go.th/" }],
  },
  {
    country: "TH", topic: "taxes", sort: 30, title: "Налоги и сборы",
    summary: "При передаче права и при владении возникают сборы и налоги; их размер зависит от срока владения, оценочной стоимости и статуса владельца.",
    points: [
      "При регистрации: сбор за передачу права, специальный бизнес-налог или гербовый сбор, подоходный налог продавца.",
      "При владении: налог на землю и строения, взносы на содержание общих зон для кондо.",
      "Доход от аренды облагается налогом: резидентство и международные соглашения нужно разбирать с консультантом.",
    ],
    status: "draft", reviewedBy: null, reviewedAt: null, validUntil: null,
    sources: [{ title: "Revenue Department (Таиланд)", url: "https://www.rd.go.th/" }],
  },
  {
    country: "TH", topic: "disputes", sort: 40, title: "Просрочки и споры с застройщиком",
    summary: "Порядок действий определяется договором: уведомление в установленной форме, переговоры, затем судебные или арбитражные процедуры с независимым тайским юристом.",
    points: [
      "Сохраните договор, график платежей, платёжки и переписку.",
      "Уведомляйте застройщика письменно и подтверждайте получение.",
      "Следите за сроками давности: не откладывайте обращение.",
    ],
    status: "draft", reviewedBy: null, reviewedAt: null, validUntil: null, sources: [],
  },
  {
    country: "TH", topic: "visa", sort: 50, title: "Виза и проживание",
    summary: "Покупка недвижимости сама по себе не даёт вида на жительство; для длительного проживания рассматривают отдельные визовые программы, условия которых меняются.",
    points: ["Проверяйте актуальные требования на официальных сайтах миграционных органов."],
    status: "draft", reviewedBy: null, reviewedAt: null, validUntil: null, sources: [],
  },
  {
    country: "VN", topic: "ownership", sort: 10, title: "Что может купить иностранец",
    summary: "Иностранцы, как правило, могут приобретать жильё в проектах коммерческого жилья на ограниченный срок с возможностью продления и в пределах квот на здание и район; земля принадлежит государству, частные лица получают права пользования.",
    points: [
      "Срок права для иностранца ограничен законом (как правило, до 50 лет с продлением).",
      "Действуют квоты на долю квартир в здании и количество домов в районе.",
      "Точные условия определяются действующим Законом о жилье и должны быть проверены вьетнамским юристом.",
    ],
    status: "draft", reviewedBy: null, reviewedAt: null, validUntil: null,
    sources: [{ title: "Министерство строительства Вьетнама", url: "https://moc.gov.vn/" }],
  },
  {
    country: "VN", topic: "process", sort: 20, title: "Покупка новостройки",
    summary: "Покупка квартир в строящемся доме допускается у застройщиков, чей проект соответствует установленным условиям продажи жилья в будущем (включая банковскую гарантию), по договору с застройщиком.",
    points: [
      "Проверяйте у юриста, что проект вправе продавать жильё на этапе строительства.",
      "Уточните график платежей, условия гарантии и порядок передачи сертификата прав.",
    ],
    status: "draft", reviewedBy: null, reviewedAt: null, validUntil: null, sources: [],
  },
  {
    country: "VN", topic: "taxes", sort: 30, title: "Налоги и сборы",
    summary: "В планах: подготовить обзор налогов и сборов и передать его местному налоговому консультанту на проверку.",
    points: [], status: "planned", reviewedBy: null, reviewedAt: null, validUntil: null, sources: [],
  },
  {
    country: "VN", topic: "disputes", sort: 40, title: "Споры с застройщиком",
    summary: "В планах: подготовить обзор порядка претензий, переговоров, суда и арбитража и передать его местному юристу на проверку.",
    points: [], status: "planned", reviewedBy: null, reviewedAt: null, validUntil: null, sources: [],
  },
];

export const LEGAL_LIFECYCLE = [
  { s: "planned", t: "Тема зарезервирована" },
  { s: "draft", t: "Редакция написала по общим сведениям" },
  { s: "in_review", t: "Передано местному юристу" },
  { s: "verified", t: "Юрист подтвердил: имя, дата, срок действия" },
] as const;

/** Rollout checklist shown on the page of a country that is not active yet. */
export const COUNTRY_ROLLOUT = [
  { t: "Таксономия локаций", d: "Города, районы и их названия заведены в справочник." },
  { t: "Юридический обзор", d: "Предстоит подготовить материалы и передать их местному юристу на проверку. Статус каждой темы показан выше." },
  { t: "Чек-лист проверки", d: "Реестр получает страновой чек-лист документов застройщика и проекта." },
  { t: "Первые застройщики", d: "Застройщики вносят проекты, цены и наличие через кабинет." },
  { t: "Открытие страны", d: "Страна получает статус «работает», проекты попадают в каталог и аналитику." },
] as const;
