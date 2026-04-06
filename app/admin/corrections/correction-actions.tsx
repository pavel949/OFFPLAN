"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  closeCorrectionRequest,
  grantCorrectionRequest,
} from "@/app/actions/moderation";

export function GrantCorrectionButton({
  requestId,
}: {
  requestId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className="admin-btn text-xs py-1.5 px-3"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const r = await grantCorrectionRequest(requestId, "");
          if (r.ok) {
            router.refresh();
          } else {
            alert(r.error ?? "Ошибка");
          }
        });
      }}
    >
      Выдать доступ к черновику
    </button>
  );
}

export function CloseCorrectionButton({
  requestId,
}: {
  requestId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className="admin-nav-out text-xs py-1.5 px-3"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const r = await closeCorrectionRequest(requestId);
          if (r.ok) {
            router.refresh();
          } else {
            alert(r.error ?? "Ошибка");
          }
        });
      }}
    >
      Закрыть
    </button>
  );
}
