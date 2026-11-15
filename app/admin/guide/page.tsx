import Link from "next/link";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { PROJECT_EDITING } from "@/lib/admin-workspace";

export default async function AdminGuidePage() {
  if (!(await getAdminSessionOk())) return null;
  return <div className="adm-wrap">
    <div className="adm-head"><div><h1>Что и где редактировать</h1><p className="adm-sub">Один проект — одна карточка управления. Начните с проекта, затем откройте нужную вкладку.</p></div><Link href="/admin/projects" className="adm-btn">Открыть проекты</Link></div>
    <section className="adm-card"><h2>Как изменения попадают на сайт</h2>
      <ol className="admin-guide-steps"><li>Выберите проект и внесите изменения в нужной вкладке.</li><li>Нажмите «Сохранить» и дождитесь результата. Ошибка означает, что результат нужно проверить, а не повторять действие вслепую.</li><li>Проверьте статус проекта. Черновик не появляется на сайте только от сохранения. Предложения и условия продажи публикуются отдельно.</li><li>Для опубликованного проекта используйте «Открыть на сайте». Проверьте цену, фото, описание и предложения глазами покупателя.</li></ol>
      <p className="adm-hint">Карточка, лоты, условия и материалы — связанные, но разные данные. «Сохранено» не означает, что все связанные разделы заполнены или опубликованы.</p>
    </section>
    <div className="admin-guide-grid">{PROJECT_EDITING.map(item => <section className="adm-card" key={item.key}><h2>{item.label}</h2><p>{item.edit}</p><p><strong>После изменения:</strong> {item.effect}</p><p className="adm-hint">{item.caution}</p></section>)}</div>
    <section className="adm-card"><h2>Справочники и доступ</h2>
      <p><strong>Застройщик и локация проекта:</strong> выбираются в «Основное». Застройщиков также можно создать и изменить в отдельном справочнике. Новые локации создаются из карточки проекта; отдельного полного редактора локаций пока нет.</p>
      <p><Link href="/admin/developers">Застройщики</Link> — справочник и отдельный блок приглашений в кабинет партнёра. Пригласить пользователя и выбрать застройщика в карточке — разные операции.</p>
      <p><strong>Типы, стадии и другие классификаторы:</strong> выбираются из фиксированных списков. Новые варианты пока добавляются через изменение приложения.</p>
      <p><Link href="/admin/settings">Тексты и показатели рынка</Link> не заменяют <Link href="/admin/methodology">методологию ClearView</Link> и не пересчитывают автоматически оценки проектов.</p>
    </section>
    <section className="adm-card"><h2>Заявки и технические инструменты</h2><p><Link href="/admin/leads">Заявки клиентов</Link> содержат контакты, статус обработки и заметки. Они не являются публичным содержимым каталога.</p><p><Link href="/admin/readiness">Готовность сервисов</Link> помогает проверить подключённые сервисы. <Link href="/admin/catalog">Массовый импорт JSON</Link> предназначен для специалистов: он может заменить карточки и опубликовать новые проекты.</p></section>
  </div>;
}
