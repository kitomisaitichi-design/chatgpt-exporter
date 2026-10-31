import {localStorageError} from './local-io.mjs';
import {conversationTime} from './core.mjs';
// Extension-owned database. Access tokens are never stored here.
let connection=null,opening=null;
function release(db){if(connection===db)connection=null;db.close();}
function database(){
  if(connection)return Promise.resolve(connection);
  if(opening)return opening;
  const pending=new Promise((resolve,reject)=>{
    const request=indexedDB.open('english-autopilot-v2',1); // retain existing state and schema
    request.onupgradeneeded=()=>{for(const name of ['meta','jobs','chats'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
    request.onsuccess=()=>{
      const db=request.result;connection=db;
      db.onclose=()=>{if(connection===db)connection=null;};
      db.onversionchange=()=>release(db);
      resolve(db);
    };
    request.onerror=()=>reject(request.error);
  });
  opening=pending;
  void pending.then(()=>{if(opening===pending)opening=null;},()=>{if(opening===pending)opening=null;});
  return pending;
}
async function transaction(store,mode){
  for(let attempt=0;attempt<2;attempt++){
    const db=await database();
    try{return db.transaction(store,mode);}
    catch(error){
      if(error?.name!=='InvalidStateError')throw error;
      release(db);
      if(attempt)throw error;
      // No transaction exists yet: reopening cannot replay a read or write.
    }
  }
}
async function run(store,mode,queue){
  const tx=await transaction(store,mode);
  return new Promise((resolve,reject)=>{
    let result,error;
    tx.oncomplete=()=>resolve(result);
    tx.onerror=event=>{error ||= event.target?.error || tx.error;};
    tx.onabort=()=>reject(error || tx.error || new DOMException('Local database transaction was aborted.','AbortError'));
    try{queue(tx.objectStore(store),value=>{result=value;});}
    catch(e){try{tx.abort();}catch{}reject(e);}
  });
}
export async function get(store, key) {
  return run(store,'readonly',(s,result)=>{const req=s.get(key);req.onsuccess=()=>result(req.result);});
}
export async function put(store, key, value) {
  if(store==='jobs'&&value)value.uiRevision=(value.uiRevision || 0)+1;
  try{await run(store,'readwrite',s=>s.put(value,key));}
  catch(e){throw localStorageError(e,'browser database write',store);}
}
// Internal index rows share the existing database; a batch commits atomically.
export async function putMany(store,rows){
  try{await run(store,'readwrite',s=>{for(const {key,value,deleted} of rows)deleted?s.delete(key):s.put(value,key);});}
  catch(e){throw localStorageError(e,'browser index checkpoint',store);}
}
export async function getPrefix(store,prefix){
  return run(store,'readonly',(s,result)=>{const rows=[],r=s.openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));r.onsuccess=()=>{const c=r.result;if(!c)return result(rows);rows.push(c.value);c.continue();};});
}
export async function cacheInventory(scopeKey) {
  const prefix=scopeKey+':';
  return run('chats','readonly',(s,result)=>{
    const rows=[],req=s.openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));
    req.onsuccess=()=>{const cursor=req.result;if(!cursor)return result(rows);const record=cursor.value,value=record?.data;if(value?.mapping)rows.push({id:cursor.key.slice(prefix.length),title:value.title,update_time:value.update_time,create_time:value.create_time || conversationTime(value) || null,contentHash:record.hash || null,cacheBacked:true,origin:'local cache'});cursor.continue();};
  });
}
