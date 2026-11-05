import {describe,it,expect} from 'vitest';
import {preparePhotoEvidence,photoUploadFailure} from './photo-upload';
const pid='11111111-1111-4111-8111-111111111111';
const batch = {projectId:pid,observedAt:'2025-01-01',items:[{path:`${pid}/a.jpg`,caption:'Plan',details:{media_kind:'unit_plan',unit_id:'22222222-2222-4222-8222-222222222222'}}]};
describe('photo upload preflight',()=>{
 it('retains media metadata and derives trusted storage URLs',()=>{
  const [row]=preparePhotoEvidence(batch,'https://example.org');
  expect(row.details.media_kind).toBe('unit_plan');
  expect(row.details.unit_id).toBe(batch.items[0].details.unit_id);
  expect(row.details.url).toBe(`https://example.org/storage/v1/object/public/project-photos/${pid}/a.jpg`);
 });
 it('rejects the entire batch for invalid later metadata',()=>{
  expect(()=>preparePhotoEvidence({...batch,items:[...batch.items,{path:`${pid}/b.jpg`,caption:'Invalid',details:{media_kind:'unit_plan'}}]},'https://example.org')).toThrow();
 });
 it('rejects empty, excessive and duplicate batches',()=>{
  for(const items of [[],Array(41).fill(batch.items[0]),[batch.items[0],batch.items[0]]])
   expect(()=>preparePhotoEvidence({...batch,items},'https://example.org')).toThrow();
 });
 it('rejects foreign paths and future/invalid dates',()=>{
  expect(()=>preparePhotoEvidence({...batch,items:[{...batch.items[0],path:'22222222-2222-4222-8222-222222222222/a.jpg'}]},'https://example.org')).toThrow();
  for(const observedAt of ['2099-01-01','2025-02-30','']) expect(()=>preparePhotoEvidence({...batch,observedAt},'https://example.org')).toThrow();
 });
 it('explains public files and uncertain partial registration without claiming rollback',()=>{
  expect(photoUploadFailure(2,3,'register','Error')).toContain('2 из 3');
  expect(photoUploadFailure(2,3,'register','Error')).toContain('частично');
  expect(photoUploadFailure(2,3,'upload','Error')).toContain('мог сохраниться');
 });
});
