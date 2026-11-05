/** Acknowledge each successful row immediately, including when a later row fails. */
export async function saveUnitRows<T>(
  rows: readonly T[],
  save: (row: T) => Promise<{ ok: boolean; id?: string; error?: string; priceUpdatedAt?: string | null }>,
  acknowledge: (row: T, result: { id: string; priceUpdatedAt?: string | null }) => void,
): Promise<{ ok: boolean; error?: string }> {
  for (const row of rows) {
    try {
      const result = await save(row);
      if (!result.ok) return { ok: false, error: result.error || "Не удалось сохранить лот" };
      if (!result.id) return { ok: false, error: "Сервер не вернул идентификатор лота. Обновите страницу перед повтором." };
      acknowledge(row, { id: result.id, priceUpdatedAt: result.priceUpdatedAt });
    } catch {
      return { ok: false, error: "Не удалось подтвердить сохранение. Обновите страницу перед повтором, чтобы не создать дубликат." };
    }
  }
  return { ok: true };
}
