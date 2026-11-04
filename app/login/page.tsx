import "../admin/admin.css";
import "./login.css";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { EmailLoginForm, TeamLoginForm } from "./login-forms";

export const metadata: Metadata = {
  title: "Вход — Ignatev Estate",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdminSessionOk()) redirect("/admin");
  return (
    <main className="login-page">
      <div className="login-wrap">
        <Link href="/" className="login-back">
          ← К каталогу
        </Link>
        <h1 className="serif login-title">Вход</h1>
        <p className="login-sub">Выберите, как вы работаете с платформой.</p>
        <div className="login-grid">
          <section className="login-card">
            <h2 className="serif">Команда IE</h2>
            <p>Админ-панель: каталог, лиды, модерация, сделки.</p>
            <TeamLoginForm />
          </section>
          <section className="login-card">
            <h2 className="serif">Застройщик / брокер</h2>
            <p>
              Кабинет проектов, прайс-листа, материалов и сделок. Войти можно только по приглашению
              команды IE: ссылку для входа мы пришлём на вашу почту.
            </p>
            <EmailLoginForm target="/partner" label="Получить ссылку для входа" invitedOnly />
          </section>
          <section className="login-card">
            <h2 className="serif">Инвестор</h2>
            <p>Избранное и подписки на обновления проектов.</p>
            <EmailLoginForm target="/account" label="Получить ссылку для входа" />
          </section>
        </div>
      </div>
    </main>
  );
}
