import { describe,it,expect } from "vitest";
import seed from "@/data/seed/projects.json";
import { LOCATION_PRECISION, reviewedLocation } from "./project-location";
import { parseCatalogRows } from "./schema";

const evidence={lat:8.01,lng:98.3,precision:"project",sourceUrl:"https://example.com/test-project",observedOn:"2026-11-04",sourceTitle:"Test source",reuseBasis:"developer_published",licenseNote:"Test-only source; no Google data",note:"Test-only point",reviewStatus:"reviewed"};
describe("coordinate evidence",()=>{
  it("requires a source, reviewed date and matching native coordinate",()=>{
    expect(reviewedLocation(evidence,8.01,98.3,"2026-11-04")).toEqual(evidence);
    expect(reviewedLocation(undefined,8.01,98.3)).toBeUndefined();
    expect(reviewedLocation({...evidence,sourceUrl:"javascript:alert(1)"},8.01,98.3)).toBeUndefined();
    expect(reviewedLocation(evidence,8.02,98.3)).toBeUndefined();
    expect(reviewedLocation(evidence,null,null)).toBeUndefined();
    expect(reviewedLocation(evidence,NaN,98.3)).toBeUndefined();
  });
  it("does not accept future observations or impossible coordinates",()=>{
    expect(reviewedLocation(evidence,8.01,98.3,"2026-11-03")).toBeUndefined();
    expect(reviewedLocation({...evidence,lat:99},99,98.3)).toBeUndefined();
    expect(reviewedLocation({...evidence,reviewStatus:"pending"},8.01,98.3)).toBeUndefined();
  });
  it("rejects credential-bearing links and Google-only discovery on our separate map",()=>{
    expect(reviewedLocation({...evidence,sourceUrl:"https://maps.googleapis.com/maps/api/geocode/json?key=secret"},8.01,98.3)).toBeUndefined();
    expect(reviewedLocation({...evidence,sourceUrl:"https://user:password@example.com/"},8.01,98.3)).toBeUndefined();
    const google={...evidence,sourceUrl:"https://maps.app.goo.gl/test"};
    expect(reviewedLocation(google,8.01,98.3)).toBeUndefined();
    expect(reviewedLocation({...google,confirmationUrl:"https://example.com/developer-location"},8.01,98.3)).toBeDefined();
  });
  it("keeps a valid project visible when optional location evidence is malformed",()=>{
    const rows=parseCatalogRows([{...seed[0],locationEvidence:{sourceUrl:"bad"}}]);
    expect(rows).toHaveLength(1);expect(rows[0].locationEvidence).toBeUndefined();
  });
});

it("retains estate-level precision for licensed OSM site points",()=>{
 const site={...evidence,precision:"site",sourceUrl:"https://www.openstreetmap.org/way/611236208",reuseBasis:"open_data",licenseNote:"© OpenStreetMap contributors · ODbL-1.0"};
 expect(reviewedLocation(site,8.01,98.3)?.precision).toBe("site");
 expect(LOCATION_PRECISION.site).toContain("не отдельное здание");
 expect(reviewedLocation(site,8.02,98.3)).toBeUndefined();
});
