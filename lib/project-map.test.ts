import { describe,it,expect } from "vitest";
import seed from "@/data/seed/projects.json";
import type { CatalogProject } from "./types";
import { clusterProjects,fitPoints,mercator,PHUKET_VIEW,projectPoint,toMapProject } from "./project-map";
import { EMPTY_FILTERS,filterProjects,filtersFromParams,filtersToParams,hasActiveFilters } from "./home-search";
import { mapSnapshotSchema } from "./project-map-schema";

const source={lat:8.01,lng:98.3,precision:"project" as const,sourceUrl:"https://example.com/test-project",sourceTitle:"Test-only source",reuseBasis:"developer_published" as const,licenseNote:"Test-only source; no Google data",observedOn:"2026-11-04",reviewStatus:"reviewed" as const,note:"Fixture; never published"};
const p={...seed[0],location:source} as CatalogProject;
describe("public project map",()=>{
  it("never invents a point for missing coordinates or a sales office",()=>{
    const unknown=toMapProject({...p,location:undefined});
    const office=toMapProject({...p,location:{...source,precision:"sales_office"}});
    expect(projectPoint(unknown)).toBeUndefined();expect(projectPoint(office)).toBeUndefined();
    expect(clusterProjects([unknown,office],PHUKET_VIEW,700)).toEqual([]);
    expect(fitPoints([unknown,office])).toEqual(PHUKET_VIEW);
  });
  it("groups coincident real points without offsetting or duplicating properties",()=>{
    const first=toMapProject(p),second=toMapProject({...p,id:999});
    const groups=clusterProjects([first,second],PHUKET_VIEW,700);
    expect(groups).toHaveLength(1);expect(groups[0].projects.map(x=>x.id)).toEqual([p.id,999]);
    expect([groups[0].x,groups[0].y]).toEqual(mercator(source.lat,source.lng));
  });
  it("keeps map/list filters in one shareable URL without treating view as a filter",()=>{
    const filters={...EMPTY_FILTERS,view:"map",zone:"Bang Tao",budget:"20",bedrooms:"2",ownership:"leasehold"};
    expect(filtersFromParams(filtersToParams(filters))).toEqual(filters);
    expect(hasActiveFilters({...EMPTY_FILTERS,view:"map"})).toBe(false);
    expect(filtersFromParams(new URLSearchParams("view=evil")).view).toBe("list");
  });
  it("stores a public whitelist and no unconfirmed legacy price or private editorial text",()=>{
    const publicRow=toMapProject({...p,recText:"private assessment",pN:99});
    expect(publicRow).not.toHaveProperty("recText");expect(publicRow).not.toHaveProperty("risk");expect(publicRow).not.toHaveProperty("yield");expect(publicRow.pN).toBe(0);
    expect(mapSnapshotSchema.safeParse({version:1,downloadedAt:"2026-11-04T00:00:00Z",projects:[publicRow]}).success).toBe(true);
  });
  it("does not keep expired availability in an offline snapshot or budget filter",()=>{
    const row=toMapProject({...p,sales:{publication:{available:29,observedAt:"2026-01-01",expiresAt:"2026-01-02T00:00:00Z",coverage:"published-offers",fromPrice:{amount:12000000,currency:"THB",ownership:"leasehold",priceDate:"2026-01-01"}}}});
    expect(row.sales).toBeUndefined();expect(row.pN).toBe(0);expect(filterProjects([row],{...EMPTY_FILTERS,budget:"100"})).toEqual([]);
  });
});
