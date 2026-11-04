"use client";

import { usePublicationExpired } from "./usePublicationExpired";
import { availabilityLabel, currentAvailability, type PublishedAvailability } from "@/lib/published-availability";

export function AvailabilityBadge({ value, type }: { value?: PublishedAvailability; type: string }) {
  const expired = usePublicationExpired(value?.expiresAt);
  const active = !expired && currentAvailability(value);
  return <div className="ie-availability">
    <strong>{active ? availabilityLabel(active.available, type) : "Доступность уточняется"}</strong>
    {active ? <>
      <small>По данным на <time dateTime={active.observedAt}>{active.observedAt.split("-").reverse().join(".")}</time></small>
      <small>Только лоты опубликованного прайса; остаток может быть неполным.</small>
    </> : <small>Наличие по опубликованным данным не подтверждено.</small>}
  </div>;
}
