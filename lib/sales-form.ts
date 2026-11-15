import { z } from "zod";
import { salesModelBase } from "./sales-model";

export type FormSchema = {
  type?: string | string[]; default?: unknown; enum?: string[]; const?: unknown; format?: string;
  properties?: Record<string,FormSchema>; items?: FormSchema; anyOf?: FormSchema[];
};
export const salesFormSchema = z.toJSONSchema(salesModelBase) as FormSchema;
export const fieldLabels: Record<string,string> = {
  projectType:"Тип проекта",countryCode:"Страна (код ISO: TH, AE, …)",jurisdiction:"Регион / применимая юрисдикция",defaultCurrency:"Основная валюта (THB, USD, EUR, …)",areaUnit:"Единица площади",
  developerLegalName:"Юридическое лицо застройщика",corporateGroup:"Группа компаний",brand:"Бренд",
  phases:"Очереди",buildings:"Корпуса",units:"Расположение юнитов",licenses:"Лицензии и разрешения",fees:"Обслуживание и дополнительные расходы",paymentPlans:"Оплата, депозит и финансирование",offers:"Предложения по юнитам",
  name:"Название",id:"Юнит",kind:"Тип",phaseId:"Очередь",buildingId:"Корпус",floorLabel:"Этаж (обозначение из плана)",additionalFloors:"Дополнительные этажи двухуровневого юнита",plotNumber:"Номер участка",
  internalArea:"Внутренняя площадь",totalArea:"Общая площадь",landArea:"Площадь участка",availability:"Наличие",
  scope:"К чему относится",scopeId:"Объект применения",status:"Статус",authority:"Выдавший орган",holder:"Держатель лицензии",licenseNumber:"Номер лицензии",permittedUse:"Разрешённое использование и границы действия",
  source:"Источник: документ / ссылка",sourceDate:"Дата сведений в источнике",checkedOn:"Дата проверки",verification:"Уровень проверки",validFrom:"Действует с",validUntil:"Действует по",
  code:"Код сбора (одинаковый код заменяет общее условие)",category:"Категория",treatment:"Условие начисления",mandatory:"Обязательность",basis:"База расчёта",amount:"Ставка / сумма",currency:"Валюта (ISO)",period:"Периодичность",taxTreatment:"Налог в сборе",taxRate:"Налог, %",payer:"Кто платит",buyerSharePercent:"Доля покупателя, %",payableWhen:"Когда уплачивается",advanceMonths:"Предоплата обслуживания, месяцев",notes:"Примечания",
  financing:"Инструмент оплаты",lender:"Кредитор / поставщик рассрочки",eligibility:"Критерии покупателя и ограничения",approval:"Нужно одобрение",durationMonths:"Срок, месяцев",annualRate:"Годовая ставка, %",rateMethod:"Метод начисления процентов",interestIncluded:"Проценты в графике",financingFees:"Комиссии финансирования и формула расчёта",
  depositAmount:"Депозит: сумма в валюте плана",depositTreatment:"Как учитывается депозит",depositRefund:"Возвратность",depositRefundTerms:"Условия возврата / удержания",depositDue:"Срок внесения депозита",depositPayee:"Получатель депозита",depositCreditStepId:"Этап зачёта депозита",reservationDays:"Срок удержания брони, дней",paymentMethod:"Способ оплаты",escrow:"Эскроу",escrowTerms:"Условия эскроу",completeness:"Полнота графика",steps:"Этапы — в порядке оплаты",trigger:"Событие платежа",triggerDetail:"Событие / строительный этап подробно",dueDate:"Дата платежа",daysAfter:"Дней после события",value:"Сумма / процент (для остатка оставить пустым)",
  unitId:"Юнит",seller:"Продавец",ownership:"Форма владения",ownershipDetail:"Форма владения: условия страны",tenureYears:"Срок права, лет",fitout:"Отделка",furniture:"Мебель / оснащение",price:"Цена юнита",priceTaxTreatment:"Налоги в цене",paymentPlanId:"План оплаты",
};
export const optionLabels: Record<string,string> = {
  unknown:"Неизвестно / требует уточнения",condominium:"Кондоминиум",villa:"Виллы",mixed:"Смешанный проект",sqm:"м²",sqft:"фут²",apartment:"Квартира",plot:"Участок",commercial:"Коммерческое помещение",project:"Весь проект",phase:"Очередь",building:"Корпус",unit:"Юнит",offer:"Предложение",
  available:"Доступен по источнику",hold:"Временно удерживается",reserved:"Забронирован",sold:"Продан",withdrawn:"Снят",documented:"Есть документ, проверка не завершена",verified:"Проверено",
  hotel:"Отельная лицензия",short_stay:"Разрешение краткосрочного размещения",construction:"Строительство / этап строительства",other:"Другое — пояснить",not_issued:"Не выдана — подтверждено",applied:"Подана заявка",issued:"Выдана",expired:"Истекла",revoked:"Отозвана",not_required:"Не требуется — есть основание",
  maintenance:"Обслуживание / CAM",sinking_fund:"Резервный фонд",transfer:"Переход права",tax:"Налог",registration:"Регистрация",utilities:"Подключение / коммунальные услуги",insurance:"Страхование",management:"Управление",furniture:"Мебель",
  payable:"Оплачивается отдельно",included:"Включено",waived:"Освобождение от оплаты",not_applicable:"Не применяется",required:"Обязательно",optional:"По выбору",fixed:"Фиксированная сумма",per_internal_area:"За единицу внутренней площади",per_total_area:"За единицу общей площади",per_land_area:"За единицу площади участка",percent_price:"Процент цены юнита",balance:"Остаток цены",once:"Разово",month:"Ежемесячно",quarter:"Ежеквартально",year:"Ежегодно",excluded:"Сверх суммы",buyer:"Покупатель",seller:"Продавец",shared:"Распределяется",
  cash:"Оплата собственными средствами",construction_installments:"Рассрочка до сдачи",post_handover_installments:"Рассрочка после сдачи",developer_loan:"Финансирование застройщика",bank_mortgage:"Банковская ипотека",interest_free:"Без процентов — подтверждено",flat:"Процент от исходной суммы",reducing_balance:"Процент на остаток",variable:"Переменная ставка",extra:"Проценты дополнительно",credited_to_price:"Зачитывается в цену",additional_fee:"Дополнительный невозвратный сбор",refundable_security:"Возвратное обеспечение вне цены",refundable:"Возвратный",non_refundable:"Невозвратный",conditional:"Возврат при условиях",yes:"Да",no:"Нет",partial:"Неполный / фрагмент",complete:"Полный график",booking:"Бронирование",contract:"Договор",handover:"Передача объекта",date:"Конкретная дата",after_event:"Через N дней после события",freehold:"Freehold",leasehold:"Leasehold",draft:"Черновик",offered:"Предлагается по источнику",
};

export function schemaType(s:FormSchema): string {
  const t=s.type;
  return typeof t === "string" ? t : Array.isArray(t) ? t.find(x=>x!=="null") ?? "string" : s.anyOf ? schemaType(s.anyOf.find(x=>x.type!=="null") ?? {}) : "string";
}

export function formDefault(s:FormSchema, currency:string): unknown {
  if(s.default !== undefined) return structuredClone(s.default);
  if(s.const !== undefined) return s.const;
  if(s.enum) return s.enum.includes("unknown") ? "unknown" : s.enum[0];
  if(schemaType(s) === "object") return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k,v])=>[k,k === "id" ? crypto.randomUUID() : k === "currency" ? currency : formDefault(v,currency)]));
  if(schemaType(s) === "array") return [];
  if(schemaType(s) === "number" || schemaType(s) === "integer") return null;
  return "";
}
