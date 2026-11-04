import { describe,it,expect } from "vitest";
import { completionLabel,floorLabel,projectPriceM,offerDetail } from "./buyer-display";
import { toPublicProject } from "./public-catalog";
import { EMPTY_FILTERS,filterProjects } from "./home-search";
import raw from "@/data/seed/projects.json";
import type { CatalogProject } from "./types";
const p=raw[0] as CatalogProject;
const publication={available:29,observedAt:"2026-11-04",expiresAt:"2099-11-05T13:00:00Z",coverage:"published-offers" as const,fromPrice:{amount:12139628,currency:"THB",ownership:"leasehold",priceDate:"2026-11-04"},pricing:[{currency:"THB",ownership:"leasehold",bedrooms:1,from:12139628},{currency:"THB",ownership:"freehold",bedrooms:1,from:14021270},{currency:"THB",ownership:"freehold",bedrooms:2,from:20000000}]};
describe("buyer display and trusted budget",()=>{
 it("keeps unknown dates and prices out of confirmed filters",()=>{const unknown={...p,compY:null,minBR:null,pN:0,compQ:"",stK:"unknown"};expect(completionLabel(null)).toBe("Срок не подтверждён");expect(completionLabel(null,"en")).toBe("Date not confirmed");expect(filterProjects([unknown],EMPTY_FILTERS)).toHaveLength(1);expect(filterProjects([unknown],{...EMPTY_FILTERS,year:"2027"})).toHaveLength(0);expect(filterProjects([unknown],{...EMPTY_FILTERS,stage:"offplan"})).toHaveLength(0);expect(filterProjects([unknown],{...EMPTY_FILTERS,budget:"100"})).toHaveLength(0);});
 it("translates only known offer wording and keeps optional amounts unchanged",()=>{expect(offerDetail("Optional furniture THB 702000.0; optional houseware THB 91000.0. Not assumed included","ru")).toContain("702");expect(offerDetail("Unreviewed source wording","ru")).toBe("Unreviewed source wording");});
 it("uses the same dated published price without confirming the whole project",()=>{const out=toPublicProject({...p,dataConfirmedAt:null,sales:{publication}});expect(out.pN).toBe(12.139628);expect(out.dataConfirmedAt).toBeNull();expect(projectPriceM(out)).toBe(12.139628);});
 it("combines budget, ownership and bedrooms on the same published option",()=>{const row=toPublicProject({...p,dataConfirmedAt:null,sales:{publication}});expect(filterProjects([row],{...EMPTY_FILTERS,budget:"13",ownership:"leasehold",bedrooms:"1"})).toHaveLength(1);expect(filterProjects([row],{...EMPTY_FILTERS,budget:"13",ownership:"freehold"})).toHaveLength(0);expect(filterProjects([row],{...EMPTY_FILTERS,budget:"15",bedrooms:"2"})).toHaveLength(0);});
 it("excludes expired publication even if a previously serialized price remains",()=>{const row={...p,pN:12,sales:{publication:{...publication,expiresAt:"2020-01-01T00:00:00Z"}}};expect(projectPriceM(row)).toBe(0);expect(filterProjects([row],{...EMPTY_FILTERS,budget:"100"})).toHaveLength(0);});
 it("keeps construction completion distinct from handover in Russian",()=>{expect(completionLabel("Construction Mar 2027; handover Q3 2027")).toBe("Завершение строительства: март 2027 · Передача: III кв. 2027");});
 it("retains conflicting source floor labels without silently correcting them",()=>{expect(floorLabel("FIFTH (4th Floor)","ru")).toBe("пятый (4-й этаж)");});
});
