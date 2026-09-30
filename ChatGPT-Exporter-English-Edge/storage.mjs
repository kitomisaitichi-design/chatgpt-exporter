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
  const db = await ready;
  return new Promise((resolve, reject) => {const tx = db.transaction(store, 'readwrite');tx.objectStore(store).put(value, key);tx.oncomplete = () => resolve();tx.onabort = tx.onerror = () => reject(tx.error || new Error('Local save failed'));});
}
export async function cacheInventory(scopeKey) {
  const db=await ready,prefix=scopeKey+':';
  return new Promise((resolve,reject)=>{
    const result=[],tx=db.transaction('chats'),req=tx.objectStore('chats').openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));
    req.onsuccess=()=>{const cursor=req.result;if(!cursor)return resolve(result);const record=cursor.value,value=record?.data;if(value?.mapping)result.push({id:cursor.key.slice(prefix.length),title:value.title,update_time:value.update_time,create_time:value.create_time || conversationTime(value) || null,contentHash:record.hash || null,cacheBacked:true,origin:'local cache'});cursor.continue();};
    req.onerror=()=>reject(req.error);
  });
}
