import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { summarizeTerms, fmtMoney } from "@/lib/commission/format";
import { commissionTermsSchema, platformFeeSchema, type CommissionTerms } from "@/lib/commission/terms";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";
import {
  AgreementForm,
  AgreementStatusButtons,
  BrokerTermsForm,
  CreateOrgForm,
  LeadRoutingForm,
  PreviewForm,
  type AgreementInit,
  type OrgOpt,
  type ProjectOpt,
} from "./forms";

export const dynamic = "force-dynamic";

const STATUS_RU: Record<string, string> = { draft: "черновик", active: "действует", archived: "архив" };

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  if (!(await getAdminSessionOk()) || !hasSupabaseServiceConfig()) {
    return <p className="text-[var(--red)] text-sm">Нужен вход в панель и настроенный Supabase.</p>;
  }
  const { edit } = await searchParams;
  const db = createServiceRoleClient();
  const [o, p, a, b, r] = await Promise.all([
    db.from("orgs").select("id, name_ru, kind").order("name_ru"),
    db.from("catalog_projects").select("id, org_id, slug, payload").not("org_id", "is", null).order("slug"),
    db.from("commission_agreements").select("*").order("created_at", { ascending: false }),
    db.from("broker_terms").select("*").order("created_at", { ascending: false }),
    db.from("platform_settings").select("value").eq("key", "lead_routing").maybeSingle(),
  ]);
  const orgs: OrgOpt[] = (o.data ?? []).map((x) => ({ id: x.id as string, name: x.name_ru as string, kind: x.kind as string }));
  const orgName = new Map(orgs.map((x) => [x.id, x.name]));
  const projects: ProjectOpt[] = (p.data ?? []).map((x) => ({
    id: x.id as string,
    org_id: x.org_id as string,
    name: ((x.payload as { n?: string } | null)?.n ?? (x.slug as string)).slice(0, 60),
  }));
  const projName = new Map(projects.map((x) => [x.id, x.name]));
  const agreements = a.data ?? [];
  const routing = (r.data?.value as { default_broker_org_id?: string | null } | null)?.default_broker_org_id ?? null;

  let editInit: AgreementInit | undefined;
  const ed = edit ? agreements.find((x) => x.id === edit) : undefined;
  if (ed) {
    const t = commissionTermsSchema.safeParse(ed.terms);
    const tt = (t.success ? t.data : (ed.terms as Partial<CommissionTerms>)) as Partial<CommissionTerms>;
    const sch: AgreementInit["sch"] = {};
    for (const s of tt.schedule ?? []) sch[s.event] = { percent: s.percent, delayDays: s.delayDays ?? 0 };
    editInit = {
      id: ed.id as string, name: ed.name as string, developer_org_id: ed.developer_org_id as string,
      broker_org_id: ed.broker_org_id as string | null, project_id: ed.project_id as string | null,
      model: tt.model, percent: tt.percent, fixed: tt.fixed, tiers: tt.tiers, tierMode: tt.tierMode, min: tt.min, max: tt.max,
      basis: tt.basis, currency: tt.currency, payoutMode: tt.payoutMode, vatPercent: tt.vatPercent, clawbackDays: tt.clawbackDays,
      sch, exclusive: !!ed.exclusive, visibility: ed.visibility as string, status: ed.status as string,
      valid_from: ed.valid_from as string, valid_to: ed.valid_to as string | null, note: ed.note as string,
    };
  }

  return (
    <div className="max-w-5xl space-y-10">
      <div>
        <h1 className="serif text-2xl mb-1">Комиссии и условия</h1>
        <p className="text-sm text-[var(--txt2)] max-w-3xl">
          Условия настраиваются отдельно для каждой пары «застройщик — брокер» и для проекта. Действует наиболее
          конкретное соглашение: проект + брокер → проект → брокер → общее по застройщику. В сделку копируется снимок
          условий на дату создания, поэтому позднейшие изменения прошлые сделки не затрагивают.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Организации</h2>
        <p className="text-sm mb-2 text-[var(--txt2)]">{orgs.map((x) => `${x.name} (${x.kind === "developer" ? "застройщик" : x.kind === "broker" ? "брокер" : "реестр"})`).join(" · ") || "Пока нет организаций."}</p>
        <CreateOrgForm />
        <p className="text-xs text-[var(--txt2)] mt-2">
          Привязка пользователя к организации: <code>update public.profiles set role = &apos;partner&apos;, org_id = &apos;&lt;uuid&gt;&apos; where id = &apos;&lt;user&gt;&apos;</code>.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Маршрутизация новых заявок</h2>
        <p className="text-sm mb-2 text-[var(--txt2)]">Сначала применяется эксклюзивное соглашение по проекту/застройщику, затем брокер по умолчанию.</p>
        <LeadRoutingForm orgs={orgs} current={routing} />
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Соглашения «застройщик → брокер»</h2>
        <div className="overflow-x-auto mb-4">
          <table className="admin-table text-xs">
            <thead><tr><th>Название</th><th>Застройщик</th><th>Брокер</th><th>Проект</th><th>Условия</th><th>Период</th><th>Статус</th><th /></tr></thead>
            <tbody>
              {agreements.map((x) => {
                const t = commissionTermsSchema.safeParse(x.terms);
                return (
                  <tr key={x.id as string}>
                    <td>{(x.name as string) || "—"}{x.exclusive ? " · эксклюзив" : ""}</td>
                    <td>{orgName.get(x.developer_org_id as string)}</td>
                    <td>{x.broker_org_id ? orgName.get(x.broker_org_id as string) : "любой"}</td>
                    <td>{x.project_id ? projName.get(x.project_id as string) ?? "…" : "все"}</td>
                    <td>{t.success ? summarizeTerms(t.data) : <span className="text-[var(--red)]">условия некорректны</span>}</td>
                    <td>{x.valid_from as string}{x.valid_to ? ` — ${x.valid_to}` : " —"}</td>
                    <td>{STATUS_RU[x.status as string]}</td>
                    <td className="space-y-1">
                      <a className="underline" href={`/admin/commissions?edit=${x.id}#agreement-form`}>изменить</a>
                      <AgreementStatusButtons id={x.id as string} status={x.status as string} />
                    </td>
                  </tr>
                );
              })}
              {agreements.length === 0 ? <tr><td colSpan={8}>Соглашений пока нет.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div id="agreement-form">
          <h3 className="text-sm font-bold mb-2">{editInit ? "Редактирование соглашения" : "Новое соглашение"}</h3>
          <AgreementForm key={editInit?.id ?? "new"} orgs={orgs} projects={projects} init={editInit} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Условия брокеров с платформой</h2>
        <div className="overflow-x-auto mb-4">
          <table className="admin-table text-xs">
            <thead><tr><th>Брокер</th><th>Застройщик</th><th>Комиссия платформы</th><th>Реферал</th><th>Период</th><th>Статус</th></tr></thead>
            <tbody>
              {(b.data ?? []).map((x) => {
                const f = platformFeeSchema.safeParse(x.platform_fee);
                const fee = f.success ? (f.data.type === "none" ? "нет" : f.data.type === "percent" ? `${f.data.percent}% от комиссии` : `фикс. ${fmtMoney(f.data.fixed)}`) : "некорректно";
                return (
                  <tr key={x.id as string}>
                    <td>{orgName.get(x.broker_org_id as string)}</td>
                    <td>{x.developer_org_id ? orgName.get(x.developer_org_id as string) : "все"}</td>
                    <td>{fee}</td>
                    <td>{f.success ? `${f.data.referralDefaultPercent}%` : "—"}</td>
                    <td>{x.valid_from as string}{x.valid_to ? ` — ${x.valid_to}` : " —"}</td>
                    <td>{STATUS_RU[x.status as string]}</td>
                  </tr>
                );
              })}
              {(b.data ?? []).length === 0 ? <tr><td colSpan={6}>Условий пока нет: платформа ничего не удерживает.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <BrokerTermsForm orgs={orgs} />
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Калькулятор: проверить условия на примере</h2>
        <PreviewForm orgs={orgs} projects={projects} />
      </section>
    </div>
  );
}
