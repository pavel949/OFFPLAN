"use client";
import {useEffect,useRef,useState} from 'react';
import {reconcilePhotoUploads} from '@/app/actions/photo-recovery';
import {photoRecoveryKey,readRecovery,recoveryRecord,type PhotoRecovery,type RecoveredPhoto} from '@/lib/photo-recovery';
import type {PhotoUploadBatch} from '@/lib/photo-upload';

export function usePhotoUploadRecovery(projectId:string,mode:'admin'|'partner') {
  const [recovery,setRecovery]=useState<PhotoRecovery|null>(null);
  const [ready,setReady]=useState(false);
  const [recoveryError,setError]=useState('');
  const key=photoRecoveryKey(projectId,mode);
  const storedRecord=useRef<string|null>(null);
  useEffect(()=>{
    function load() {
      setReady(false);setRecovery(null);setError('');
      try {const raw=localStorage.getItem(key);storedRecord.current=raw;if(raw)setRecovery(readRecovery(raw,projectId));}
      catch {setError('Не удалось прочитать сведения о предыдущей загрузке. Проверьте материалы до повторной отправки.');}
      setReady(true);
    }
    function changed(event:StorageEvent) {if(event.key===key)load();}
    load();window.addEventListener('storage',changed);
    return ()=>window.removeEventListener('storage',changed);
  },[key,projectId]);
  function saveRecovery(batch:PhotoUploadBatch) {
    // Persistence failure must stop the operation before the first Storage write.
    if(localStorage.getItem(key))throw new Error('В этом браузере уже есть незавершённая загрузка проекта. Проверьте журнал.');
    const record=recoveryRecord(batch);
    const serialized=JSON.stringify(record);
    localStorage.setItem(key,serialized);
    storedRecord.current=serialized;
    setRecovery(record);
  }
  function completeRecovery() {
    try {
      if(localStorage.getItem(key)!==storedRecord.current)throw new Error('Журнал изменился');
      localStorage.removeItem(key);storedRecord.current=null;setRecovery(null);setError('');
    }
    catch {setError('Материалы сохранены, но журнал загрузки не очищен. Проверьте его перед новой загрузкой.');}
  }
  return {recovery,ready,recoveryError,saveRecovery,completeRecovery};
}

export function PhotoUploadRecovery({recovery,mode,error,busy,onResolved}:{recovery:PhotoRecovery|null;mode:'admin'|'partner';error:string;busy:boolean;onResolved:()=>void}) {
  const [items,setItems]=useState<RecoveredPhoto[]|null>(null);
  const [message,setMessage]=useState('');
  const [checking,setChecking]=useState(false);
  const active=useRef(false);
  useEffect(()=>{setItems(null);setMessage('');},[recovery]);
  async function check() {
    if(!recovery || active.current || busy)return;
    active.current=true;setChecking(true);setMessage('');setItems(null);
    try {
      const result=await reconcilePhotoUploads(recovery.batch,mode);
      if(!result.ok)setMessage(result.error??'Не удалось проверить материалы');
      else setItems(result.items??[]);
    } catch {setMessage('Проверка прервана. Ничего не перезагружено и не удалено.');}
    finally {active.current=false;setChecking(false);}
  }
  if(!recovery && !error)return null;
  return <section className="adm-card" aria-label="Проверка незавершённой загрузки">
    <h3>Журнал загрузки</h3>
    {error?<p role="alert">{error}</p>:null}
    {recovery?<>
      <p>Пути и метаданные сохранены в этом браузере, без файлов и токенов. Если отправка прервалась, проверьте результат здесь. Эта проверка ничего не публикует, не загружает повторно и не удаляет.</p>
      <button type="button" className="adm-btn" disabled={busy||checking} onClick={check}>{checking?'Проверяем…':'Проверить сохранённые файлы и публикацию'}</button>
      {message?<p role="status">{message}</p>:null}
      {items?<ul>{items.map(item=><li key={item.path}>
        <span>{item.path}: {item.stored===null?'хранилище не удалось проверить':item.stored?'файл найден':'файл не найден'}. </span>
        <span>{item.evidence.length?`Записи: ${item.evidence.map(e=>`${e.status} (${e.id})`).join(', ')}`:'Запись материала не найдена'}.</span>
        {item.stored?<a href={item.url} target="_blank" rel="noopener noreferrer"> Открыть публичный файл</a>:null}
      </li>)}</ul>:null}
      {items?.length===recovery.batch.items.length && items.every(item=>item.stored===true && item.evidence.length>0)?<button type="button" className="adm-btn" disabled={busy||checking} onClick={onResolved}>Все файлы учтены — завершить журнал без повторной загрузки</button>:null}
      <details><summary>Сохранённые пути и метаданные для оператора</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(recovery,null,2)}</pre></details>
      <p>Файлы могут быть доступны по публичным ссылкам без записи в галерее. Перед новой отправкой оператор должен сверить записи и пути: автоматического восстановления и гарантии однократной регистрации пока нет. Журнал можно завершить после подтверждённой отправки либо после проверки, что все файлы уже имеют записи материалов.</p>
    </>:null}
  </section>;
}
