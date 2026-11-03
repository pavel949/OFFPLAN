"use client";
export default function CatalogueError({ reset }: { reset: () => void }) {
  return (
    <main className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl mb-4">Каталог временно недоступен</h1>
      <p>
        Не удалось получить актуальные данные. Попробуйте обновить страницу
        позже.
      </p>
      <p className="mt-3">
        The catalogue is temporarily unavailable. Please try again later.
      </p>
      <button className="admin-btn mt-4" type="button" onClick={reset}>
        Попробовать снова / Retry
      </button>
    </main>
  );
}
