import { NextResponse } from "next/server";
import { getProjects } from "@/lib/catalog";
import { toMapProject } from "@/lib/project-map";
import { mapSnapshotSchema } from "@/lib/project-map-schema";

export const dynamic = "force-dynamic";
/** Same public catalogue as the website; no cookie/session/service-role data. */
export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json(mapSnapshotSchema.parse({version:1,downloadedAt:new Date().toISOString(),projects:projects.map(toMapProject)}), {
      headers:{"Cache-Control":"public, max-age=60", "X-Content-Type-Options":"nosniff"},
    });
  } catch {
    // Never replace a saved package with demo rows or an unmarked empty catalogue.
    return NextResponse.json({error:"Не удалось обновить публичный каталог"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
