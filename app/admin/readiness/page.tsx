import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { productionReadiness } from "@/lib/production-readiness";

export default async function ReadinessPage() {
  if (!(await getAdminSessionOk())) return null;
  const checks = productionReadiness();
  return <div>
    <h1 className="serif text-2xl mb-4">Готовность к работе</h1>
    <p className="mb-4">Проверка наличия настроек. Она не заменяет проверку входа, сохранения данных, доставки писем и восстановления из резервной копии.</p>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Сервис</th><th>Настройки</th><th>Что проверить</th></tr></thead>
      <tbody>{checks.map(c => <tr key={c.id}><td>{c.label}{c.required ? " *" : ""}</td><td>{c.ready ? "Заданы" : "Не завершены"}</td><td>{c.detail}</td></tr>)}</tbody>
    </table></div>
    <p className="mt-4">* Требуется для полноценной работы. До подключения почты проверяйте новые заявки в разделе «Лиды» вручную.</p>
  </div>;
}
