import {describe,it,expect} from "vitest";
import {evidenceSchema,type ProjectEvidence} from "./project-evidence";
import {publishedProjectMedia,mediaForUnit,mediaKind,mediaLabel} from "./project-media";
const pid="11111111-1111-4111-8111-111111111111",uid="22222222-2222-4222-8222-222222222222";
function fact(id:string,details:Record<string,unknown>={},status="published"):ProjectEvidence {return {id,project_id:pid,kind:"photo",fact_key:id,title:"Source image",source_url:"https://example.com/source",observed_at:"2026-01-01",details:{url:"https://example.com/image.jpg",caption:"Source image",...details},status,reviewed_at:"2026-01-02"};}
describe("project media",()=>{
 it("excludes pending, archived and unsafe images",()=>expect(publishedProjectMedia([fact("pending",{},"pending"),fact("archived",{},"archived"),fact("unsafe",{url:"javascript:alert(1)"}),fact("ok")]).map(f=>f.id)).toEqual(["ok"]));
 it("orders cover then explicit order without mutating input",()=>{const xs=[fact("z",{sort_order:2}),fact("a",{sort_order:1}),fact("cover",{cover:true,sort_order:5})];expect(publishedProjectMedia(xs).map(f=>f.id)).toEqual(["cover","a","z"]);expect(xs[0].id).toBe("z");});
 it("never guesses an exact unit from labels, type or a masterplan",()=>{const xs=[fact("exact",{unit_id:uid,media_kind:"unit_plan"}),fact("type",{type_label:"A",media_kind:"type_plan"}),fact("other",{unit_id:pid,media_kind:"photo"}),fact("master",{unit_id:uid,media_kind:"masterplan"})];expect(mediaForUnit(xs,uid).map(f=>f.id)).toEqual(["exact"]);});
 it("does not imply unclassified historic images are photographs",()=>{expect(mediaKind({})).toBe("unknown");expect(mediaKind({render:true})).toBe("render");expect(mediaLabel({media_kind:"unit_plan"},"ru")).toBe("Планировка лота");});
 it("validates order, type and plan identity",()=>{const input=fact("plan",{media_kind:"unit_plan"});expect(evidenceSchema.safeParse(input).success).toBe(false);expect(evidenceSchema.safeParse({...input,details:{...input.details,unit_id:uid}}).success).toBe(true);for(const details of [{sort_order:-1},{sort_order:1.5},{sort_order:10000},{media_kind:"made-up"},{media_kind:"type_plan"}])expect(evidenceSchema.safeParse(fact("bad",details)).success).toBe(false);});
});
