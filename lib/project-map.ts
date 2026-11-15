import type { CatalogProject } from "./types";
import type { SearchProject } from "./home-search";
import type { ProjectLocation } from "./project-location";
import { projectSlug } from "./slug";
import { currentAvailability } from "./published-availability";

export type MapProject = SearchProject & {
  slug: string; description: string; completion: string; bedrooms: number | null;
  dataConfirmedAt: string | null;
  location?: ProjectLocation;
};
export type MapSnapshot = { version: 1; downloadedAt: string; projects: MapProject[] };

/** Public, explicit whitelist: no leads, drafts, private sources, scores or credentials. */
export function toMapProject(p: CatalogProject): MapProject {
  const availability = currentAvailability(p.sales?.publication);
  return { id: p.id, n: p.n, dev: p.dev, dt: p.dt, zone: p.zone, seg: p.seg, type: p.type,
    tags: p.i18n?.ru?.tags ?? p.tags, stK: p.stK, compY: p.compY,
    pN: availability?.fromPrice?.currency === "THB" ? availability.fromPrice.amount / 1e6 : 0,
    sales: availability ? { publication: availability } : undefined,
    slug: projectSlug(p), description: (p.i18n?.ru?.desc || p.desc).slice(0,4000), dataConfirmedAt:p.dataConfirmedAt??null,
    completion: p.i18n?.ru?.compQ || p.compQ, bedrooms: p.minBR, location: p.location };
}

export const projectPoint = (p: MapProject) => p.location && p.location.precision !== "sales_office" ? p.location : undefined;
export const mercator = (lat: number, lng: number): [number, number] => [lng, -Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI];
export type MapView = { x: number; y: number; width: number; height: number };
const [phuketX, phuketY] = mercator(8.08, 98.34);
/** Camera extent, never a project coordinate. */
export const PHUKET_VIEW: MapView = { x: phuketX - .39, y: phuketY - .48, width: .78, height: .96 };

export function fitPoints(ps: MapProject[], aspect = 1): MapView {
  const points = ps.flatMap(p => { const q = projectPoint(p); return q ? [mercator(q.lat, q.lng)] : []; });
  if (!points.length) return { ...PHUKET_VIEW };
  const xs = points.map(q=>q[0]), ys = points.map(q=>q[1]);
  // The offline basemap is an overview coastline, so a single point starts with geographic context.
  let width = Math.max(.22, Math.max(...xs) - Math.min(...xs)) * 1.35;
  let height = Math.max(.30, Math.max(...ys) - Math.min(...ys)) * 1.35;
  if (width / height < aspect) width = height * aspect; else height = width / aspect;
  return { x: (Math.min(...xs)+Math.max(...xs)-width)/2, y: (Math.min(...ys)+Math.max(...ys)-height)/2, width, height };
}

export function clusterProjects(ps: MapProject[], view: MapView, pixelWidth: number) {
  const cell = view.width / Math.max(240, pixelWidth) * 42;
  const groups = new Map<string, { projects: MapProject[]; x: number; y: number }>();
  for (const p of ps) {
    const q = projectPoint(p); if (!q) continue;
    const [x,y] = mercator(q.lat,q.lng), key = `${Math.floor(x/cell)},${Math.floor(y/cell)}`;
    const g = groups.get(key) ?? {projects:[],x:0,y:0}; g.projects.push(p); g.x+=x;g.y+=y;groups.set(key,g);
  }
  return [...groups.entries()].map(([key,g])=>({key,projects:g.projects,x:g.x/g.projects.length,y:g.y/g.projects.length}));
}
