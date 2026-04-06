"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  approveModerationSubmission,
  rejectModerationSubmission,
} from "@/app/actions/moderation";

export function ModerationReviewActions({
  submissionId,
}: {
  submissionId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="mt-8 space-y-4 max-w-lg">
      <button
        type="button"
        className="admin-btn"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const r = await approveModerationSubmission(submissionId);
            if (r.ok) {
              router.push("/admin/moderation");
              router.refresh();
            } else {
              alert(r.error ?? "Ошибка");
            }
          });
        }}
      >
        Одобрить и опубликовать
      </button>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const note = String(fd.get("note") ?? "");
          start(async () => {
            const r = await rejectModerationSubmission(submissionId, note);
            if (r.ok) {
              router.push("/admin/moderation");
              router.refresh();
            } else {
              alert(r.error ?? "Ошибка");
            }
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Отклонить с комментарием</span>
          <textarea
            name="note"
            rows={3}
            className="admin-inp mb-0 min-h-[80px]"
            placeholder="Что исправить в черновике…"
          />
        </label>
        <button type="submit" className="admin-nav-out w-fit" disabled={pending}>
          Отклонить
        </button>
      </form>
    </div>
  );
}
