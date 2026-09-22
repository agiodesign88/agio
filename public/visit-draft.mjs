let connection;
function db(){return connection??=new Promise((resolve,reject)=>{const r=indexedDB.open('agio-visit-drafts',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>{connection=null;reject(r.error);};});}
async function transaction(action){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('drafts','readwrite');let value;action(tx.objectStore('drafts'),v=>value=v);tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error||new Error('사진 초안을 보관하지 못했습니다.'));tx.onerror=()=>{};});}
export const storeDraft=draft=>transaction((s,done)=>{s.clear();s.put(draft);done(draft);});
export const removeDraft=id=>transaction(s=>s.delete(id));
export const loadDraft=()=>transaction((s,done)=>{const r=s.getAll();r.onsuccess=()=>done(r.result.sort((a,b)=>b.createdAt-a.createdAt)[0]||null);});
export async function keepScreenAwake(){try{const lock=await navigator.wakeLock?.request('screen');return ()=>lock?.release().catch(()=>{});}catch{return ()=>{};}}
