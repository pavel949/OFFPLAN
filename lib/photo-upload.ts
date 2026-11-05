import { evidenceSchema, PHOTO_PATH_RE, projectPhotoUrl } from './project-evidence';

export type PhotoUploadItem = { path: string; caption: string; details?: Record<string, unknown> };
export type PhotoUploadBatch = { projectId: string; observedAt: string; items: PhotoUploadItem[] };

/** Validate the whole batch before any Storage write or evidence insertion. */
export function preparePhotoEvidence(input: PhotoUploadBatch, storageUrl: string) {
  if (!input.items.length || input.items.length > 40) throw new Error('Загрузите от 1 до 40 изображений за раз');
  const paths = new Set<string>();
  return input.items.map(it => {
    if (!PHOTO_PATH_RE.test(it.path) || !it.path.startsWith(`${input.projectId}/`) || paths.has(it.path))
      throw new Error('Некорректный или повторяющийся путь файла');
    paths.add(it.path);
    const caption = it.caption.trim().slice(0, 300) || 'Материал проекта';
    const url = projectPhotoUrl(storageUrl, it.path);
    const parsed = evidenceSchema.safeParse({ project_id: input.projectId, kind: 'photo',
      fact_key: `photo-${it.path.split('/')[1]}`.slice(0, 100), title: caption,
      source_url: url, observed_at: input.observedAt, details: { ...it.details, url, caption } });
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Проверьте метаданные изображения');
    return parsed.data;
  });
}

/** Fail closed after a write error: a transport failure is not evidence that nothing was saved. */
export function photoUploadFailure(uploaded: number, total: number, phase: 'upload' | 'register', reason: string) {
  return `${reason}. Подтверждённо загружено файлов: ${uploaded} из ${total}. ${phase === 'register' ? 'Регистрация могла завершиться частично.' : 'Последний файл также мог сохраниться.'} Файлы доступны по публичным ссылкам даже без публикации в галерее. Повторная отправка заблокирована: сначала проверьте список материалов и сохранённые пути файлов; не загружайте всю партию повторно.`;
}
