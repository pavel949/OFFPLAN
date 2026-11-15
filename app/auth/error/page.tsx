import Link from "next/link";
import { isAuthDestination, loginPageFor } from "@/lib/supabase/auth-destinations";

export const metadata = { title: "Ссылка для входа — Ignatev Estate", robots: { index: false, follow: false } };

export default async function AuthErrorPage({ searchParams }: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = (await searchParams).next ?? null;
  const retry = isAuthDestination(next) ? loginPageFor(next) : "/login";
  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="serif text-2xl mb-3">Не удалось войти по ссылке</h1>
      <p className="mb-3">Запросите новую ссылку и откройте её в том же браузере, из которого отправили запрос.</p>
      <Link className="underline" href={retry}>Запросить новую ссылку</Link>
    </main>
  );
}
