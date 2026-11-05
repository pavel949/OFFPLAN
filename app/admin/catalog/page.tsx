import { importProjectsJson } from "@/app/actions/admin";
import { AdminImportForm } from "../import-form";

export default function AdminCatalogPage() {
  return (
    <div>
      <h1 className="serif text-2xl mb-1">Импорт каталога</h1>
      <p className="text-[var(--txt2)] text-sm mb-6 max-w-xl">
        Инструмент для специалистов. JSON обновляет базу каталога, а не файл:
        существующие карточки заменяются по ID, новые проекты публикуются сразу.
        Если ошибка возникнет в середине импорта, часть записей уже может быть сохранена.
        Для обычных правок используйте раздел «Проекты». Перед импортом сохраните копию данных.
      </p>
      <AdminImportForm action={importProjectsJson} />
    </div>
  );
}

