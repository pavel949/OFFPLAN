import { importProjectsJson } from "@/app/actions/admin";
import { AdminImportForm } from "../import-form";

export default function AdminCatalogPage() {
  return (
    <div>
      <h1 className="serif text-2xl mb-1">Импорт каталога</h1>
      <p className="text-[var(--txt2)] text-sm mb-6 max-w-xl">
        Вставьте JSON-массив в том же формате, что и{" "}
        <code>data/seed/projects.json</code>. После проверки Zod файл будет
        перезаписан на диске сервера — перезапуск приложения не нужен.
      </p>
      <AdminImportForm action={importProjectsJson} />
    </div>
  );
}
