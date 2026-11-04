export type ReadinessCheck = { id: string; label: string; ready: boolean; required: boolean; detail: string };

/** Presence checks only. Never expose values or claim that delivery/access was tested. */
export function productionReadiness(env: Record<string, string | undefined> = process.env): ReadinessCheck[] {
  return [
    { id: "database", label: "Подключение приложения к базе", required: true,
      ready: !!(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY),
      detail: "Наличие параметров подключения; доступность базы проверяется отдельно." },
    { id: "admin", label: "Вход администратора", required: true, ready: (env.ADMIN_SECRET?.length ?? 0) >= 16,
      detail: "Общий пароль задан. Персональные роли и MFA требуют отдельной настройки." },
    { id: "site", label: "Адрес сайта", required: true, ready: /^https:\/\/[^\s/]+/.test(env.NEXT_PUBLIC_SITE_URL ?? ""),
      detail: "Публичный HTTPS-адрес для ссылок и приглашений." },
    { id: "email", label: "Уведомления о заявках", required: true,
      ready: !!(env.RESEND_API_KEY && env.NOTIFY_FROM && env.LEAD_NOTIFY_EMAIL),
      detail: "Нужны ключ Resend, подтверждённый отправитель и получатель. Даже при наличии настроек доставку нужно проверить." },
    { id: "captcha", label: "Проверка CAPTCHA", required: false,
      ready: !!(env.TURNSTILE_SECRET_KEY && env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
      detail: "Дополнительная защита формы. Общий лимит запросов работает через базу независимо от CAPTCHA." },
    { id: "drive", label: "Импорт из Google Drive", required: false, ready: !!env.GOOGLE_SERVICE_ACCOUNT_JSON,
      detail: "Нужны сервисный аккаунт и доступ на чтение к папкам застройщиков." },
  ];
}
