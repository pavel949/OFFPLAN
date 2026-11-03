/** Translate database rule violations into Russian messages for the UI. */
export function registryError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("four-eyes")) return "Итоговое решение должно принять другой эксперт (правило «четырёх глаз»).";
  if (m.includes("conflict of interest")) return "Конфликт интересов: дело должен вести другой эксперт.";
  if (m.includes("all required checklist items need evidence")) return "Приложите документы ко всем обязательным пунктам чек-листа.";
  if (m.includes("public summary is required")) return "Нужно публичное обоснование решения (не менее 20 символов).";
  if (m.includes("reason is required")) return "Укажите причину (не менее 20 символов).";
  if (m.includes("all required items must be verified")) return "Не все обязательные пункты проверены.";
  if (m.includes("level 2 requires a valid level 1")) return "Для уровня L2 нужен действующий уровень L1.";
  if (m.includes("one open case") || m.includes("verification_cases_one_open") || m.includes("duplicate key")) return "По этому проекту уже есть открытая заявка этого уровня.";
  if (m.includes("not editable")) return "Заявка уже подана и недоступна для редактирования.";
  if (m.includes("only the assigned reviewer")) return "Дело ведёт другой эксперт.";
  if (m.includes("not allowed") || m.includes("reviewers only") || m.includes("permission")) return "Недостаточно прав для этого действия.";
  if (m.includes("no checklist template")) return "Для этой юрисдикции и уровня ещё нет чек-листа.";
  return msg;
}

