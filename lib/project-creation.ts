import type { createServiceRoleClient } from './supabase/service';

type Db = ReturnType<typeof createServiceRoleClient>;
type Result = { ok: boolean; error?: string; projectId?: string; published?: boolean };
type Input = { id: string; orgId: string | null; payload: Record<string, unknown> };

export function creationIdFromForm(form: FormData): string | null {
  const id = String(form.get('creation_id') ?? '');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

// PostgreSQL JSONB does not preserve object-key order; approval assigns payload.id.
function comparable(payload: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'id').sort(([a], [b]) => a.localeCompare(b))));
}

/** One atomic insert with a stable primary key. A lost response can be reconciled, never replayed as a new draft. */
export async function createOrRecoverProject(db: Db, input: Input): Promise<Result> {
  const read = async () => {
    const query = db.from('catalog_projects').select('id, org_id, payload, draft_payload, is_published, moderation_status').eq('id', input.id);
    return input.orgId ? query.eq('org_id', input.orgId).maybeSingle() : query.is('org_id', null).maybeSingle();
  };
  const recover = (row: { id: string; org_id: string | null; payload: unknown; draft_payload?: unknown; is_published: boolean; moderation_status: string }): Result => {
    if (!row.payload || comparable(row.payload as Record<string, unknown>) !== comparable(input.payload)
      || (row.draft_payload && comparable(row.draft_payload as Record<string, unknown>) !== comparable(input.payload)))
      return { ok: false, projectId: row.id, error: 'Проект уже создан, но его данные отличаются от формы. Продолжите редактирование в сохранённой карточке.' };
    return { ok: true, projectId: row.id, published: row.is_published && row.moderation_status === 'published' };
  };
  const prior = await read().catch(() => ({ data: null, error: { message: "transport" } }));
  if (prior.error) return { ok: false, error: 'Не удалось проверить предыдущую попытку. Повторите эту же форму, не открывайте новую.' };
  if (prior.data) return recover(prior.data);
  try {
    const result = await db.from('catalog_projects').insert({
      id: input.id, slug: `draft-${input.id}`, org_id: input.orgId,
      payload: input.payload, draft_payload: input.payload,
      is_published: false, moderation_status: 'draft',
    }).select('id').single();
    if (!result.error && result.data) return { ok: true, projectId: result.data.id, published: false };
  } catch { /* A transport exception does not prove the insert failed. */ }
  const after = await read().catch(() => ({ data: null, error: { message: "transport" } }));
  if (!after.error && after.data) return recover(after.data);
  return { ok: false, error: 'Создание не подтверждено. Повторите эту же форму: идентификатор сохранён и другой проект создан не будет.' };
}

/** Creation and publication are separate stages. Preserve the draft and reuse the same review record on retry. */
export async function publishCreatedProject(db: Db, input: Input): Promise<Result> {
  const failed = (error: string): Result => ({ ok: false, projectId: input.id, error: `Черновик сохранён. ${error}` });
  try {
    const current = await db.from('catalog_projects').select('is_published, moderation_status').eq('id', input.id).single();
    if (current.error) return failed('Не удалось проверить публикацию. Откройте карточку проекта перед повтором.');
    if (current.data.is_published && current.data.moderation_status === 'published')
      return { ok: true, projectId: input.id, published: true };
    let submission = await db.from('moderation_submissions').select('id, entity_id, entity_type, status').eq('id', input.id).maybeSingle();
    if (submission.error) return failed('Не удалось проверить заявку на публикацию.');
    if (!submission.data) {
      await db.from('moderation_submissions').insert({
        id: input.id, entity_type: 'project', entity_id: input.id,
        submitted_by: null, snapshot: input.payload, status: 'pending',
      });
      submission = await db.from('moderation_submissions').select('id, entity_id, entity_type, status').eq('id', input.id).maybeSingle();
    }
    if (submission.error || !submission.data) return failed('Заявка на публикацию не подтверждена. Повторите эту же форму.');
    if (submission.data.entity_id !== input.id || submission.data.entity_type !== 'project')
      return failed('Заявка недоступна. Проверьте её в разделе модерации.');
    if (submission.data.status === 'approved') {
      const verified = await db.from('catalog_projects').select('is_published, moderation_status').eq('id', input.id).single();
      if (!verified.error && verified.data.is_published && verified.data.moderation_status === 'published')
        return { ok: true, projectId: input.id, published: true };
    }
    if (submission.data.status !== 'pending')
      return failed('Заявка уже рассмотрена или недоступна. Проверьте её в разделе модерации.');
    const approval = await db.rpc('moderation_approve', { p_submission_id: submission.data.id });
    // Re-read even after an error: another request may have finished the same approval.
    const final = await db.from('catalog_projects').select('is_published, moderation_status').eq('id', input.id).single();
    if (!final.error && final.data.is_published && final.data.moderation_status === 'published')
      return { ok: true, projectId: input.id, published: true };
    return failed(approval.error ? 'Публикация не завершена. Проверьте заявку или повторите эту же форму.' : 'Публикация не подтверждена. Проверьте карточку проекта.');
  } catch {
    return failed('Ответ публикации потерян. Проверьте карточку проекта; повтор этой формы не создаст дубликат.');
  }
}
