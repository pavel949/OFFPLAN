"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="admin-login-card">
      <h2>Не удалось загрузить данные</h2>
      <p>Это ошибка загрузки, а не отсутствие записей. Повторите попытку. Если вы сохраняли изменения, проверьте результат после обновления.</p>
      <button type="button" className="admin-btn" onClick={reset}>Повторить</button>
    </div>
  );
}
