/** Offline-only review helper: generates guarded SQL, never connects to a database. */
import fs from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { locationEvidenceSchema, reviewedLocation } from "../lib/project-location.ts";
import { GEO } from "../lib/geo-seed.ts";

const quoteJson = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const phuketZones = new Set(["Phuket",...GEO.find(c=>c.code==="TH").regions.filter(r=>["phuket","phang-nga"].includes(r.slug)).flatMap(r=>r.locations.map(l=>l.en))]);

export function prepareLocationSql(review, snapshot, today = new Date().toISOString().slice(0,10)) {
  const rows = Array.isArray(snapshot) ? snapshot : snapshot.catalog;
  if(!Array.isArray(rows)||!Array.isArray(review.reviewed)||!review.reviewed.length) throw Error("Expected a complete catalogue snapshot and nonempty explicitly reviewed records.");
  const byId=new Map(rows.map(r=>[r.id,r])), seen=new Set(), updates=[];
  for(const item of review.reviewed) {
    const before=byId.get(item.projectId);
    if(!before||before.payload?.n!==item.projectName||!before.is_published||before.moderation_status!=="published") throw Error(`Identity/publication mismatch: ${item.projectName}`);
    if(item.identityStatus!=="confirmed"||item.conflict===true||seen.has(item.projectId)) throw Error(`Unresolved or duplicate identity: ${item.projectName}`);
    seen.add(item.projectId);
    if(!Object.hasOwn(before,"lat")||!Object.hasOwn(before,"lng")||!Number.isFinite(Date.parse(before.updated_at)))throw Error(`Incomplete native-coordinate snapshot: ${item.projectName}`);
    const evidence=locationEvidenceSchema.parse(item.evidence);
    if(!["project","entrance"].includes(evidence.precision)) throw Error(`Office/estimate is not an identified project point: ${item.projectName}`);
    if(!reviewedLocation(evidence,evidence.lat,evidence.lng,today)) throw Error(`Coordinate provenance or reuse is not confirmed: ${item.projectName}`);
    if(before.lat!=null||before.lng!=null||before.payload.locationEvidence!=null) throw Error(`Existing coordinates/evidence require a separate comparison: ${item.projectName}`);
    if(before.jurisdiction_code==="TH" && !(evidence.lat>=5&&evidence.lat<=21&&evidence.lng>=97&&evidence.lng<=106.5)) throw Error(`Outside Thailand sanity envelope: ${item.projectName}`);
    if(phuketZones.has(before.payload.zone) && !(evidence.lat>=7.3&&evidence.lat<=8.8&&evidence.lng>=97.9&&evidence.lng<=99.1)) throw Error(`Outside Phuket/Phang Nga sanity envelope: ${item.projectName}`);
    updates.push({id:item.projectId,project_name:item.projectName,evidence,expected_payload:before.payload,expected_updated_at:before.updated_at});
  }
  return `begin;
select pg_advisory_xact_lock(hashtext('offplan-reviewed-coordinate-import-v1'));
create temporary table reviewed_locations on commit drop as select * from jsonb_to_recordset(${quoteJson(updates)}) r(id uuid,project_name text,evidence jsonb,expected_payload jsonb,expected_updated_at timestamptz);
do $guard$ begin
 perform c.id from public.catalog_projects c join reviewed_locations n on c.id=n.id for update of c;
 if exists(select 1 from reviewed_locations n left join public.catalog_projects c on c.id=n.id where c.id is null or c.lat is not null or c.lng is not null or c.payload is distinct from n.expected_payload or c.updated_at is distinct from n.expected_updated_at or c.is_published is not true or c.moderation_status<>'published') then raise exception 'Catalogue or coordinates changed; review again, never overwrite'; end if;
end $guard$;
update public.catalog_projects c set lat=(n.evidence->>'lat')::double precision,lng=(n.evidence->>'lng')::double precision,payload=jsonb_set(c.payload,'{locationEvidence}',n.evidence,true),updated_at=now() from reviewed_locations n where c.id=n.id;
do $guard$ begin if (select count(*) from public.catalog_projects c join reviewed_locations n on c.id=n.id where c.lat=(n.evidence->>'lat')::double precision and c.lng=(n.evidence->>'lng')::double precision and c.payload->'locationEvidence'=n.evidence)<>${updates.length} then raise exception 'Incomplete coordinate update; rollback'; end if; end $guard$;
commit;
`;
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    const args=new Map();for(let i=2;i<process.argv.length;i+=2)args.set(process.argv[i],process.argv[i+1]);
    if(!args.get("--input")||!args.get("--snapshot")||!args.get("--output"))throw Error("Usage: node --experimental-strip-types scripts/prepare-project-locations.mjs --input reviewed.json --snapshot fresh-private-snapshot.json --output new-private.sql");
    const sql=prepareLocationSql(JSON.parse(fs.readFileSync(args.get("--input"),"utf8")),JSON.parse(fs.readFileSync(args.get("--snapshot"),"utf8")));
    fs.writeFileSync(args.get("--output"),sql,{flag:"wx",mode:0o600});
    process.stdout.write("Prepared guarded coordinate SQL only. No database connection or write performed.\n");
  } catch(error) { process.stderr.write((error instanceof Error?error.message:"Coordinate preparation failed")+"\n");process.exitCode=1; }
}
