import {localStorageError} from './local-io.mjs';
import {conversationTime} from './core.mjs';
// Extension-owned database. Access tokens are never stored here.
const ready = new Promise((resolve, reject) => {
  const request = indexedDB.open('english-autopilot-v2', 1); // keep the v2 DB name so 2.2 state migrates in place
  request.onupgradeneeded = () => {for (const name of ['meta', 'jobs', 'chats']) if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function get(store, key) {
  const db = await ready;
  return new Promise((resolve, reject) => {const tx = db.transaction(store);const req = tx.objectStore(store).get(key);req.onsuccess = () => resolve(req.result);req.onerror = () => reject(req.error);});
}
export async function put(store, key, value) {
  if(store==='jobs'&&value)value.uiRevision=(value.uiRevision || 0)+1;
  const db = await ready;
  return new Promise((resolve, reject) => {const tx = db.transaction(store, 'readwrite');tx.objectStore(store).put(value, key);tx.oncomplete = () => resolve();tx.onabort = tx.onerror = () => reject(localStorageError(tx.error || new Error('Local save failed'),'browser database write',store));});
}
// Internal index rows share the existing database; a batch commits atomically.
export async function putMany(store,rows){const db=await ready;return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite'),s=tx.objectStore(store);for(const {key,value,deleted} of rows)deleted?s.delete(key):s.put(value,key);tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(localStorageError(tx.error || Error('Local index checkpoint failed.'),'browser index checkpoint',store));});}
export async function getPrefix(store,prefix){const db=await ready;return new Promise((resolve,reject)=>{const rows=[],tx=db.transaction(store),r=tx.objectStore(store).openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));r.onsuccess=()=>{const c=r.result;if(!c)return resolve(rows);rows.push(c.value);c.continue();};r.onerror=()=>reject(r.error);});}
export async function cacheInventory(scopeKey) {
  const db=await ready,prefix=scopeKey+':';
  return new Promise((resolve,reject)=>{
    const result=[],tx=db.transaction('chats'),req=tx.objectStore('chats').openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));
    req.onsuccess=()=>{const cursor=req.result;if(!cursor)return resolve(result);const record=cursor.value,value=record?.data;if(value?.mapping)result.push({id:cursor.key.slice(prefix.length),title:value.title,update_time:value.update_time,create_time:value.create_time || conversationTime(value) || null,contentHash:record.hash || null,cacheBacked:true,origin:'local cache'});cursor.continue();};
    req.onerror=()=>reject(req.error);
  });
}
