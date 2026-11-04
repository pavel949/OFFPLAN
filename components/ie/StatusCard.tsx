import Link from "next/link";
import { APPOINTMENT as A } from "@/lib/protection-content";
import { OmbudsmanLogo } from "./OmbudsmanLogo";

/** Compact link to the official-status page. Text follows the order; the logo marks the representative's affiliation only. */
export function StatusCard() {
  return (
    <Link href="/protection/representative" className="ie-status">
      <OmbudsmanLogo height={52} />
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
