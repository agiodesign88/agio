let connection;
const failures=new WeakMap();
const guarded=(tx,fn)=>()=>{try{fn();}catch(e){failures.set(tx,e);tx.abort();}};
const storageError=e=>new Error(e?.name==='QuotaExceededError'?'기기 저장 공간이 부족합니다. 필요 없는 방문 사진을 삭제한 뒤 다시 시도해주세요.':'기록을 저장하거나 읽지 못했습니다. 브라우저 저장 공간 설정을 확인해주세요.');
export function openRecords(){
  if(connection)return connection;
  connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open('agio-personal-records',2);let blocked=false;
    request.onblocked=()=>{blocked=true;connection=null;reject(new Error('다른 앱 탭을 닫거나 새로고침한 뒤 이 화면도 새로고침해주세요. 기존 기록은 유지됩니다.'));};
    request.onupgradeneeded=e=>{
      const db=request.result;
      if(e.oldVersion<1){db.createObjectStore('records',{keyPath:'placeId'});db.createObjectStore('photos',{keyPath:'id'});}
      const meta=db.createObjectStore('photo_meta',{keyPath:'id'});
      meta.createIndex('ordered',['createdAt','id']);meta.createIndex('placeId','placeId');
      // Keep existing blobs in place; metadata migration shares the upgrade transaction.
      const cursor=request.transaction.objectStore('photos').openCursor();
      cursor.onsuccess=()=>{const c=cursor.result;if(!c)return;const {id,placeId,createdAt}=c.value;meta.put({id,placeId,createdAt});c.continue();};
    };
    request.onsuccess=()=>{const db=request.result;if(blocked){db.close();return;}db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
    request.onerror=()=>{connection=null;reject(storageError(request.error));};
  });return connection;
}
async function read(store,fn){const db=await openRecords();return new Promise((resolve,reject)=>{const r=fn(db.transaction(store).objectStore(store));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(storageError(r.error));});}
export const allRecords=()=>read('records',s=>s.getAll());
export const photoCount=()=>read('photo_meta',s=>s.count());
export const photoFile=id=>read('photos',s=>s.get(id));
export async function photoPage(before=null,limit=12){
  const db=await openRecords();return new Promise((resolve,reject)=>{
    const rows=[],r=db.transaction('photo_meta').objectStore('photo_meta').index('ordered').openCursor(before?IDBKeyRange.upperBound(before,true):null,'prev');
    r.onerror=()=>reject(storageError(r.error));r.onsuccess=()=>{const c=r.result;if(c&&rows.length<limit){rows.push(c.value);c.continue();}else resolve({rows,next:c&&rows.length?[rows.at(-1).createdAt,rows.at(-1).id]:null});};
  });
}
async function mutate(run){const db=await openRecords();return new Promise((resolve,reject)=>{
  const tx=db.transaction(['records','photos','photo_meta'],'readwrite');let result;
  tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(storageError(failures.get(tx)||tx.error));tx.onerror=()=>{};
  try{run(tx,value=>result=value);}catch(e){failures.set(tx,e);tx.abort();}
});}
export function setSaved(placeId,saved){return mutate((tx,done)=>{
  const s=tx.objectStore('records'),r=s.get(placeId);r.onsuccess=guarded(tx,()=>{const old=r.result;const next={placeId,saved,visited:saved&&old?.saved?!!old.visited:false,updatedAt:Date.now()};s.put(next);done(next);});
});}
export function addVisit(photo){return mutate((tx,done)=>{
  const photos=tx.objectStore('photos'),records=tx.objectStore('records'),r=photos.getKey(photo.id);
  r.onsuccess=guarded(tx,()=>{if(r.result){const existing=records.get(photo.placeId);existing.onsuccess=guarded(tx,()=>done(existing.result));return;}
    const {id,placeId,createdAt}=photo;photos.add(photo);tx.objectStore('photo_meta').add({id,placeId,createdAt});const next={placeId,saved:true,visited:true,updatedAt:Date.now()};records.put(next);done(next);
  });
});}
export function deleteVisit(id){return mutate((tx,done)=>{
  const meta=tx.objectStore('photo_meta'),r=meta.get(id);r.onsuccess=guarded(tx,()=>{
    if(!r.result){done(null);return;}const {placeId}=r.result;meta.delete(id);tx.objectStore('photos').delete(id);
    const remaining=meta.index('placeId').count(placeId);remaining.onsuccess=guarded(tx,()=>{
      const store=tx.objectStore('records'),get=store.get(placeId);get.onsuccess=guarded(tx,()=>{const old=get.result;const next={...old,placeId,saved:!!old?.saved,visited:!!old?.visited&&!!old?.saved&&remaining.result>0,updatedAt:Date.now()};store.put(next);done(next);});
    });
  });
});}
