export const IMPORT_SECTIONS: Record<string, string> = {
  'N02 Projects': 'Паспорт проекта', 'N03 Buildings': 'Корпуса',
  'N04 Physical Units': 'Физические лоты', 'N05 Offers': 'Цены и предложения',
  'N06 Sources': 'Источники и версии', 'N09 Unit Types': 'Типовые планировки',
  'N11 Amenity Links': 'Инфраструктура', 'N12 Payment Plans': 'Планы оплаты',
  'N13 Payment Steps': 'Этапы оплаты', 'N14 Media Assets': 'Фото и документы',
  'N15 Translations': 'Описания и переводы', 'N19 Legal Ops': 'Условия и расходы',
  'N20 Data Evidence': 'Подтверждения данных', 'N16 Market Signals': 'Рыночные сведения',
  'N17 Target Audiences': 'Аудитории', 'N18 POI and Location': 'Локация',
  'N21 Lifecycle': 'Жизненный цикл', 'N22 Audit': 'Аудит', 'N08 Data QA': 'Качество данных',
};
export const DEVELOPER_LABELS: Record<string,string> = {
  'DEV-BANYAN':'Banyan Group', 'DEV-SANSIRI':'Sansiri', 'DEV-ASSETWISE':'Rhom Bho / AssetWise / The Title',
};
export function importPage(value?: string) {
  const n=Number(value || 1);
  return Number.isSafeInteger(n) && n>0 ? Math.min(n,10000) : 1;
}
export function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export const IMPORT_FIELDS: Record<string,string> = {
  project_id:'ID проекта', developer_id:'ID застройщика', project_name:'Проект', district:'Район',asset_type:'Тип объекта',
  planned_completion:'Плановая сдача',price_from_thb_snapshot:'Цена от, THB (снимок)',project_materials_url:'Материалы',termsheet_url:'Прайс',as_of:'Дата данных',description_ru:'Описание',source_state:'Статус источника',
  building_id:'ID корпуса',building_label:'Корпус / очередь',floor_count:'Этажей',total_units_verified:'Подтверждённое число лотов',completion_date:'Дата сдачи',verification_status:'Статус проверки',
  unit_id:'ID физического лота',source_phase:'Очередь / корпус',unit_number:'Номер лота',bedrooms:'Спальни',area_total_sqm:'Общая площадь, м²',land_area_sqm:'Участок, м²',unit_kind:'Тип лота',features:'Особенности',quality_flag:'Ограничения данных',floor_number:'Этаж',floor_evidence:'Основание определения этажа',enclosed_covered_sqm:'Закрытая площадь, м²',garden_uncovered_sqm:'Открытая площадь, м²',bathroom_source:'Санузлы по источнику',
  offer_id:'ID предложения',ownership_type:'Форма владения',fitout:'Отделка / комплектация',price_thb:'Цена, THB',source_status:'Статус в источнике',normalized_status:'Статус снимка',price_as_of:'Дата цены',offer_category:'Тип предложения',online_booking_status:'Онлайн-бронирование',note:'Примечание',price_per_sqm_source:'Цена за м² по источнику',unit_type_source:'Тип по источнику',source_file_version:'Версия документа',optional_furniture_thb_source:'Мебель отдельно, THB',optional_houseware_thb_source:'Оснащение отдельно, THB',package_inclusion_status:'Что включено',
  source_url:'Источник',url:'Ссылка',source_id:'ID источника',source_type:'Тип источника',published_at:'Дата публикации',retrieved_at:'Дата получения',observed_at:'Дата наблюдения',is_complete_inventory:'Полнота наличия',trust_level:'Уровень доверия',notes:'Примечания',
  media_id:'ID материала',media_type:'Тип материала',language:'Язык',rights:'Права использования',is_public:'Разрешена публикация',verified:'Проверка',
  translation_id:'ID перевода',entity_type:'Тип записи',entity_id:'ID записи',locale:'Язык',field_name:'Поле',text:'Текст',review_status:'Редактура',
  plan_id:'ID плана оплаты',plan_name:'План оплаты',currency:'Валюта',booking_deposit_thb:'Бронь, THB',interest_rate_pct:'Процентная ставка, %',duration_months:'Срок, месяцев',effective_at:'Дата условий',step_id:'ID этапа',sort_order:'Порядок',trigger_code:'Событие платежа',percent:'Доля платежа, %',fixed_thb:'Фиксированный платёж, THB',due_days:'Срок, дней',
  unit_type_id:'ID планировки',type_code:'Тип',bathrooms:'Санузлы',internal_sqm:'Внутренняя площадь, м²',total_sqm:'Общая площадь, м²',private_pool:'Частный бассейн',plan_url:'Планировка',
  amenity_id:'Объект инфраструктуры',scope_type:'Уровень',scope_id:'ID связи',access_type:'Доступ',fee_type:'Оплата',link_id:'ID связи',
  term_id:'ID условия',term_type:'Условие',value:'Значение',legal_verified:'Юридическая проверка',evidence_id:'ID подтверждения',attribute:'Поле',raw_value:'Исходное значение',normalized_value:'Значение',confidence:'Достоверность',validation_status:'Результат проверки',
};
