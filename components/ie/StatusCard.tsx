import Link from "next/link";
import { APPOINTMENT as A } from "@/lib/protection-content";

/** Compact link to the official-status page. Text follows the order; no official emblems are used. */
export function StatusCard() {
  return (
    <Link href="/protection/representative" className="ie-status">
      <span className="ie-status-mark" aria-hidden="true">ПИ</span>
      <div>
        <b>Павел Игнатьев · {A.title}</b>
        <small>
          Приказ {A.order} от {A.orderDate} · {A.appointedPost}. Статус можно проверить на официальном портале Уполномоченного.
        </small>
      </div>
      <span className="go">Подробнее →</span>
    </Link>
  );
}
