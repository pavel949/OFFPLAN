"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import {
  BEACH_KEYS,
  FOCUS_KEYS,
  MANAGEMENT_KEYS,
  OWNERSHIP_KEYS,
  PROPERTY_TYPES,
  SEGMENTS,
  STATUS_KEYS,
  ZONES,
  taxLabel,
  zoneLabel,
  type TaxonomyKind,
} from "@/lib/taxonomy";

export type WizardState = { ok: boolean; error?: string; projectId?: string };
type Org = { id: string; name: string };

function Select({
  name,
  kind,
  keys,
  value,
  onChange,
}: {
  name: string;
  kind: TaxonomyKind;
  keys: readonly string[];
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <select className="admin-inp" name={name} value={value} onChange={onChange} required>
      {keys.map((k) => (
        <option key={k} value={k}>
          {taxLabel(kind, k, "ru")}
        </option>
      ))}
    </select>
  );
}

export function ProjectWizardForm({
  action,
  creationId,
  developerName,
  orgs,
  adminMode = false,
  zones = [...ZONES],
}: {
  action: (prev: WizardState, f: FormData) => Promise<WizardState>;
  creationId: string;
  developerName?: string;
  orgs?: Org[];
  adminMode?: boolean;
  /** Known location names (from the regions table); any other location can be typed in. */
  zones?: string[];
}) {
  const [state, run, pending] = useActionState(action, { ok: false } as WizardState);
  const [zoneSel, setZoneSel] = useState("");
  const [requestId] = useState(creationId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [publish, setPublish] = useState(false);
  const bind = (name: string, initial = "") => ({
    value: values[name] ?? initial,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setValues(current => ({ ...current, [name]: value }));
    },
  });
  return (
    <form action={run} className="space-y-6 max-w-2xl">
      <input type="hidden" name="creation_id" value={requestId} />
      <p className="text-sm">Если сведения пока неизвестны, оставьте числовое поле пустым или выберите «Не подтверждено». Не нужно подставлять примерные значения.</p>
      <fieldset className="space-y-3">
        <legend className="font-semibold">1. Проект</legend>
        {adminMode ? (
          <label className="block text-sm">
            Организация застройщика
            <select className="admin-inp" name="org_id" {...bind("org_id")}>
              <option value="">— без организации (проект ведёт IE) —</option>
              {orgs?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block text-sm">
          Название проекта
          <input className="admin-inp" name="n" {...bind("n")} required maxLength={200} />
        </label>
        <label className="block text-sm">
          Застройщик
          <input className="admin-inp" name="dev" required maxLength={200} {...bind("dev", developerName)} />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold">2. Расположение и тип</legend>
        <label className="block text-sm">
          Локация (район, город)
          <select className="admin-inp" name="zone" value={zoneSel} onChange={(e) => setZoneSel(e.target.value)} required>
            <option value="">Выберите локацию…</option>
            <option value="__unknown">Локация уточняется</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {zoneLabel(z, "ru")}
              </option>
            ))}
            <option value="__other">Другая локация (ввести название)</option>
          </select>
        </label>
        {zoneSel === "__other" ? (
          <label className="block text-sm">
            Название локации
            <input className="admin-inp" name="zoneOther" {...bind("zoneOther")} required maxLength={80} placeholder="Например: Da Nang, My Khe" />
          </label>
        ) : null}
        <label className="block text-sm">
          Тип объекта
          <Select {...bind("type", "unknown")} name="type" kind="type" keys={PROPERTY_TYPES} />
        </label>
        <label className="block text-sm">
          Сегмент
          <Select {...bind("seg", "unknown")} name="seg" kind="seg" keys={SEGMENTS} />
        </label>
        <label className="block text-sm">
          До пляжа
          <Select {...bind("beach", "unknown")} name="beach" kind="beach" keys={BEACH_KEYS} />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold">3. Цена, сроки, лоты</legend>
        <label className="block text-sm">
          Цена от, млн THB (например 7.5)
          <input className="admin-inp" name="priceFromM" {...bind("priceFromM")} type="number" step="any" min="0.000001" />
        </label>
        <label className="block text-sm">
          Всего лотов в проекте
          <input className="admin-inp" name="unitsTotal" {...bind("unitsTotal")} type="number" min="1" max="100000" />
        </label>
        <label className="block text-sm">
          Минимум спален в линейке
          <input className="admin-inp" name="minBR" {...bind("minBR")} type="number" min="0" max="20" />
        </label>
        <label className="block text-sm">
          Стадия строительства
          <Select {...bind("stK", "unknown")} name="stK" kind="stK" keys={STATUS_KEYS} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Год сдачи
            <input className="admin-inp" name="compY" {...bind("compY")} type="number" min={1990} max={2100} />
          </label>
          <label className="block text-sm">
            Срок сдачи (необязательно)
            <input className="admin-inp" name="compQ" {...bind("compQ")} maxLength={60} placeholder="Q4 2028" />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold">4. Владение и управление</legend>
        <label className="block text-sm">
          Форма владения
          <Select {...bind("own", "unknown")} name="own" kind="own" keys={OWNERSHIP_KEYS} />
        </label>
        <label className="block text-sm">
          Управление
          <Select {...bind("mgmt", "unknown")} name="mgmt" kind="mgmt" keys={MANAGEMENT_KEYS} />
        </label>
        <label className="block text-sm">
          Инвестиционный фокус
          <Select {...bind("focus", "unknown")} name="focus" kind="focus" keys={FOCUS_KEYS} />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold">5. Описание и источник</legend>
        <label className="block text-sm">
          Описание (факты, без оценок «лучший», «гарантированная доходность»)
          <textarea className="admin-inp" name="desc" {...bind("desc")} rows={5} required minLength={20} maxLength={4000} />
        </label>
        <label className="block text-sm">
          Страница проекта на сайте застройщика (https://…, необязательно)
          <input className="admin-inp" name="src" {...bind("src")} type="url" placeholder="https://" />
        </label>
        <p className="text-xs text-[var(--muted,#666)]">
          Рейтинг, уровень риска и рекомендации проставляет команда IE после проверки: вы их не заполняете.
          Брошюры, рендеры и прайс-лист добавьте ссылками на следующем шаге («Материалы и ссылки»).
        </p>
      </fieldset>

      {adminMode ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="publish" value="yes" checked={publish} onChange={event => setPublish(event.target.checked)} /> Сразу опубликовать в каталоге (иначе останется черновиком)
        </label>
      ) : null}

      {state.projectId ? <p className="text-sm">Черновик уже создан. <a className="underline" href={`${adminMode ? "/admin" : "/partner"}/projects/${state.projectId}`}>Открыть сохранённый проект</a>. Повторная отправка этой формы не создаст другой проект.</p> : null}

      <button className="admin-btn" disabled={pending}>
        {pending ? "Создание…" : "Создать проект"}
      </button>
      <p role="status" className="text-sm">
        {state.error}
      </p>
    </form>
  );
}

