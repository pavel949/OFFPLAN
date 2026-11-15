"use client";

import Link from "next/link";
import { useActionState } from "react";
import { adminRegisterPriceList } from "@/app/actions/price-monitor";

export function PriceListUpload({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<
    { error?: string; id?: string; duplicate?: boolean }, FormData
  >(adminRegisterPriceList.bind(null, projectId), {});

  return (
    <form action={action} className="adm-card">
      <h2>Загрузить прайс на проверку</h2>
      <p className="adm-lead">
        CSV или TSV в UTF-8, до 256 КБ и 500 лотов. Столбцы: building, unit, price, status, currency.
        Без валюты и символа цены используется THB. Для одного и того же набора корпусов указывайте одинаковую область.
      </p>
      <fieldset disabled={pending} className="adm-grid border-0 p-0">
        <label className="adm-field c6">Файл<input name="file" type="file" accept=".csv,.tsv" required /></label>
        <label className="adm-field c6">HTTPS-ссылка на источник<input name="url" type="url" maxLength={1000} required /></label>
        <label className="adm-field c6">Дата и время публикации (Пхукет)<input name="published_at" type="datetime-local" step={1} required /></label>
        <label className="adm-field c6">Версия прайса<input name="version" maxLength={100} required /></label>
        <label className="adm-field c6">Область сравнения<input name="scope" maxLength={100} placeholder="Например, корпус G" required /></label>
        <label className="adm-field c6">Охват
          <select name="coverage" defaultValue="partial">
            <option value="partial">Частичный</option>
            <option value="unknown">Неизвестный</option>
            <option value="full">Полный для указанной области</option>
          </select>
        </label>
        <p className="c12"><button className="adm-btn" type="submit">{pending ? "Регистрация…" : "Зарегистрировать"}</button></p>
      </fieldset>
      {state.error && <p role="alert" className="adm-msg err">{state.error}</p>}
      {state.id && (
        <p role="status">
          {state.duplicate ? "Этот файл уже зарегистрирован. Сохранены исходные данные источника. " : "Файл зарегистрирован. "}
          <Link className="underline" href={`?file=${state.id}`}>Открыть проверку</Link>
        </p>
      )}
    </form>
  );
}
