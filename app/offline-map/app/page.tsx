import { OfflineProjectMap } from "@/components/ie/OfflineProjectMap";

export const dynamic = "force-static";
export const metadata = {title:"Карта проектов офлайн — OFFPLAN"};
export default function OfflineMapPage() {
  return <div className="ie-page"><OfflineProjectMap /></div>;
}
