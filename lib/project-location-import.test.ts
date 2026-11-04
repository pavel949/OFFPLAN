import {describe,it,expect} from "vitest";
import {prepareLocationSql} from "../scripts/prepare-project-locations.mjs";

const evidence={lat:8.01,lng:98.3,precision:"project",sourceUrl:"https://example.com/project",sourceTitle:"Test source",observedOn:"2026-11-04",reviewStatus:"reviewed",reuseBasis:"developer_published",licenseNote:"Test-only fixture",note:"Synthetic; never published"};
const before={id:"1139b8fc-7350-4d55-87af-4b6129804785",is_published:true,moderation_status:"published",payload:{n:"Fixture project",zone:"Bang Tao"},lat:null,lng:null,jurisdiction_code:"TH",updated_at:"2026-11-04T00:00:00Z"};
const record={projectId:before.id,projectName:before.payload.n,identityStatus:"confirmed",evidence};
describe("guarded coordinate importer",()=>{
  it("only prepares a source-backed update with fresh-row and no-overwrite guards",()=>{
    const sql=prepareLocationSql({reviewed:[record]},{catalog:[before]},"2026-11-04");
    expect(sql).toContain("c.payload is distinct from n.expected_payload");expect(sql).toContain("c.lat is not null");expect(sql).not.toContain("data_confirmed_at=");expect(sql).not.toContain("verification_level=");
  });
  it("refuses wrong identities, conflicts, duplicates and existing values",()=>{
    for(const recordChange of [{projectName:"Different project"},{identityStatus:"candidate"},{conflict:true}])expect(()=>prepareLocationSql({reviewed:[{...record,...recordChange}]},{catalog:[before]},"2026-11-04")).toThrow();
    expect(()=>prepareLocationSql({reviewed:[record,record]},{catalog:[before]},"2026-11-04")).toThrow();
    expect(()=>prepareLocationSql({reviewed:[record]},{catalog:[{...before,lat:8.1,lng:98.2}]},"2026-11-04")).toThrow();
  });
  it("refuses offices, estimates and a Bangkok office for a Phuket project",()=>{
    for(const point of [{...evidence,precision:"sales_office"},{...evidence,precision:"approximate"},{...evidence,lat:13.7,lng:100.5}])expect(()=>prepareLocationSql({reviewed:[{...record,evidence:point}]},{catalog:[before]},"2026-11-04")).toThrow();
  });
});
