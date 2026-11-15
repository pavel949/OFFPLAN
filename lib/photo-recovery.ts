import type { PhotoUploadBatch } from './photo-upload';
export type PhotoRecovery = {version:1;createdAt:string;batch:PhotoUploadBatch};
export type RecoveredPhoto = {path:string;url:string;stored:boolean|null;evidence:{id:string;status:string}[]};
export function photoRecoveryKey(projectId:string,mode:'admin'|'partner') {
  return `offplan:photo-recovery:v1:${mode}:${projectId}`;
}
/** No File bytes, credentials or signed upload tokens are persisted. */
export function recoveryRecord(batch:PhotoUploadBatch):PhotoRecovery {
  return {version:1,createdAt:new Date().toISOString(),batch};
}
export function readRecovery(raw:string,projectId:string):PhotoRecovery {
  const value=JSON.parse(raw) as PhotoRecovery;
  if(value?.version!==1 || value.batch?.projectId!==projectId || typeof value.createdAt!=='string' || !Array.isArray(value.batch.items) || value.batch.items.length<1 || value.batch.items.length>40)
    throw new Error('Сохранённая партия не соответствует проекту');
  return value;
}
