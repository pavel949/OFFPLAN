/**
 * Geography seed: the single source for countries (jurisdictions), regions (cities/provinces) and
 * locations (districts / areas). It is loaded into the `regions` table by a migration generated from this
 * file (scripts/gen-geo-migration.mjs) and used as an offline fallback in development.
 *
 * Taxonomy (see docs/LOCATION_TAXONOMY.md):
 *   country (jurisdiction, ISO-3166 alpha-2)  ->  region (city or province destination)  ->  district (area / neighbourhood)
 * slug: lower-case latin, unique within a country AND, in practice, globally (used in /locations/[slug]).
 * Projects store the English location name in `zone`; its slug (slugify) must equal the district slug.
 */
export type GeoLocation = { slug: string; en: string; ru: string; local?: string };
export type GeoRegion = { slug: string; en: string; ru: string; local?: string; kind: "city" | "province"; locations: GeoLocation[] };
export type GeoCountry = {
  code: "TH" | "VN" | "KH";
  slug: string;
  ru: string;
  en: string;
  local: string;
  flag: string;
  status: "active" | "launching" | "planned";
  blurb: string;
  regions: GeoRegion[];
};

export const GEO: GeoCountry[] = [
  {
    code: "TH",
    slug: "thailand",
    ru: "Таиланд",
    en: "Thailand",
    local: "ประเทศไทย",
    flag: "🇹🇭",
    status: "active",
    blurb: "Основной рынок платформы: Пхукет, а также Бангкок, Паттайя и Хуахин. Проекты, цены и этапы строительства обновляются застройщиками.",
    regions: [
      {
        slug: "phuket", en: "Phuket", ru: "Пхукет", local: "ภูเก็ต", kind: "province",
        locations: [
          { slug: "bang-tao", en: "Bang Tao", ru: "Банг-Тао" }, { slug: "cape-panwa", en: "Cape Panwa", ru: "Мыс Панва" },
          { slug: "cape-yamu", en: "Cape Yamu", ru: "Мыс Яму" }, { slug: "chalong", en: "Chalong", ru: "Чалонг" },
          { slug: "cherngtalay", en: "Cherngtalay", ru: "Чернгталай" }, { slug: "kamala", en: "Kamala", ru: "Камала" },
          { slug: "karon", en: "Karon", ru: "Карон" }, { slug: "kata", en: "Kata", ru: "Ката" },
          { slug: "kathu", en: "Kathu", ru: "Кату" }, { slug: "koh-kaew", en: "Koh Kaew", ru: "Ко-Кэо" },
          { slug: "laguna", en: "Laguna", ru: "Лагуна" }, { slug: "layan", en: "Layan", ru: "Лаян" },
          { slug: "mai-khao", en: "Mai Khao", ru: "Май-Кхао" }, { slug: "nw-coast", en: "NW Coast", ru: "Северо-западное побережье" },
          { slug: "nai-harn", en: "Nai Harn", ru: "Най-Харн" }, { slug: "nai-yang", en: "Nai Yang", ru: "Най-Янг" },
          { slug: "patong", en: "Patong", ru: "Патонг" }, { slug: "phuket-town", en: "Phuket Town", ru: "Пхукет-Таун" },
          { slug: "rawai", en: "Rawai", ru: "Равай" }, { slug: "si-sunthon", en: "Si Sunthon", ru: "Си-Сунтхон" },
          { slug: "surin", en: "Surin", ru: "Сурин" }, { slug: "thalang", en: "Thalang", ru: "Тхаланг" },
        ],
      },
      {
        slug: "phang-nga", en: "Phang Nga", ru: "Пхангнга", local: "พังงา", kind: "province",
        locations: [{ slug: "natai", en: "Natai", ru: "Натай" }],
      },
      {
        slug: "bangkok", en: "Bangkok", ru: "Бангкок", local: "กรุงเทพมหานคร", kind: "city",
        locations: [
          { slug: "sukhumvit", en: "Sukhumvit", ru: "Сукхумвит" },
          { slug: "silom-sathorn", en: "Silom & Sathorn", ru: "Силом и Сатхорн" },
          { slug: "riverside", en: "Riverside", ru: "Набережная Чао Прайя" },
          { slug: "ratchada-rama-9", en: "Ratchada & Rama 9", ru: "Ратчада и Рама 9" },
          { slug: "ari-phaya-thai", en: "Ari & Phaya Thai", ru: "Ари и Пхая Тхай" },
          { slug: "bang-na-on-nut", en: "Bang Na & On Nut", ru: "Банг На и Он Нут" },
        ],
      },
      {
        slug: "pattaya", en: "Pattaya", ru: "Паттайя", local: "พัทยา", kind: "city",
        locations: [
          { slug: "pratumnak", en: "Pratumnak", ru: "Пратамнак" },
          { slug: "jomtien", en: "Jomtien", ru: "Джомтьен" },
          { slug: "wongamat-naklua", en: "Wongamat & Naklua", ru: "Вонгамат и Наклуа" },
          { slug: "central-pattaya", en: "Central Pattaya", ru: "Центральная Паттайя" },
          { slug: "east-pattaya", en: "East Pattaya", ru: "Восточная Паттайя" },
        ],
      },
      {
        slug: "hua-hin", en: "Hua Hin", ru: "Хуахин", local: "หัวหิน", kind: "city",
        locations: [
          { slug: "hua-hin-town", en: "Hua Hin Town", ru: "Центр Хуахина" },
          { slug: "khao-takiab", en: "Khao Takiab", ru: "Као Тхакиаб" },
          { slug: "khao-tao", en: "Khao Tao", ru: "Као Тао" },
          { slug: "hin-lek-fai", en: "Hin Lek Fai", ru: "Хин Лек Фай" },
          { slug: "pranburi-sam-roi-yot", en: "Pranburi & Sam Roi Yot", ru: "Пранбури и Сам Рой Йот" },
        ],
      },
    ],
  },
  {
    code: "VN",
    slug: "vietnam",
    ru: "Вьетнам",
    en: "Vietnam",
    local: "Việt Nam",
    flag: "🇻🇳",
    status: "launching",
    blurb: "Готовим запуск: города и локации добавлены в справочник. Юридический обзор и проверка застройщиков с участием местных специалистов запланированы.",
    regions: [
      {
        slug: "ho-chi-minh-city", en: "Ho Chi Minh City", ru: "Хошимин", local: "Thành phố Hồ Chí Minh", kind: "city",
        locations: [
          { slug: "thu-duc-thao-dien", en: "Thu Duc & Thao Dien", ru: "Тхюдык и Тхаодьен" },
          { slug: "hcmc-district-1", en: "District 1", ru: "Район 1" },
          { slug: "hcmc-district-7", en: "District 7 & Phu My Hung", ru: "Район 7 и Фу Ми Хунг" },
          { slug: "binh-thanh", en: "Binh Thanh", ru: "Бинь Тхань" },
        ],
      },
      {
        slug: "da-nang", en: "Da Nang", ru: "Дананг", local: "Đà Nẵng", kind: "city",
        locations: [
          { slug: "my-khe", en: "My Khe", ru: "Ми Кхе" },
          { slug: "son-tra", en: "Son Tra", ru: "Шон Тра" },
          { slug: "ngu-hanh-son", en: "Ngu Hanh Son", ru: "Нгу Хань Шон" },
        ],
      },
      {
        slug: "nha-trang", en: "Nha Trang", ru: "Нячанг", local: "Nha Trang", kind: "city",
        locations: [
          { slug: "nha-trang-center", en: "Nha Trang Center", ru: "Центр Нячанга" },
          { slug: "cam-ranh", en: "Cam Ranh", ru: "Камрань" },
        ],
      },
      {
        slug: "phu-quoc", en: "Phu Quoc", ru: "Фукуок", local: "Phú Quốc", kind: "province",
        locations: [{ slug: "duong-dong", en: "Duong Dong", ru: "Зыонг Донг" }, { slug: "ganh-dau", en: "Ganh Dau", ru: "Занх Зау" }],
      },
      {
        slug: "hanoi", en: "Hanoi", ru: "Ханой", local: "Hà Nội", kind: "city",
        locations: [{ slug: "tay-ho", en: "Tay Ho", ru: "Тэй Хо" }, { slug: "cau-giay", en: "Cau Giay", ru: "Кау Зай" }],
      },
    ],
  },
  {
    code: "KH",
    slug: "cambodia",
    ru: "Камбоджа",
    en: "Cambodia",
    local: "កម្ពុជា",
    flag: "🇰🇭",
    status: "planned",
    blurb: "В планах. Таксономия и юридический модуль уже готовы принять страну.",
    regions: [],
  },
];

export const countryByCode = (code: string) => GEO.find((c) => c.code.toLowerCase() === code.toLowerCase() || c.slug === code.toLowerCase()) ?? null;
