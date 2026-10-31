import test from 'node:test';
import assert from 'node:assert/strict';

let sequence=0;
async function fixture(run){
  const previous=globalThis.indexedDB,connections=[],records=new Map(),metrics={opens:0,transactions:0};
  const faults={open:null,creation:null,abort:null,abortRead:false};
  globalThis.indexedDB={open(name,version){
    assert.equal(name,'english-autopilot-v2');assert.equal(version,1);metrics.opens++;
    const request={};queueMicrotask(()=>{
      if(faults.open){request.error=faults.open;faults.open=null;request.onerror();return;}
      const db={closed:false,close(){this.closed=true;},transaction(store,mode){
        metrics.transactions++;
        if(this.closed)throw new DOMException('The database connection is closing.','InvalidStateError');
        if(faults.creation)throw faults.creation;
        const writes=[],reads=[];let aborted=false;
        const tx={error:null,abort(){if(aborted)return;aborted=true;queueMicrotask(()=>this.onabort?.());},objectStore(){return {
          get(key){const req={};reads.push(()=>{req.result=records.get(store+':'+key);req.onsuccess?.();if(faults.abortRead)tx.abort();});return req;},
          put(value,key){writes.push([store+':'+key,structuredClone(value)]);},
          delete(key){writes.push([store+':'+key,undefined]);}
        };}};
        setImmediate(()=>{
          if(aborted)return;
          if(faults.abort){tx.error=faults.abort;faults.abort=null;tx.onerror?.({target:tx});tx.abort();return;}
          for(const read of reads)read();
          if(aborted)return;
          for(const [key,value] of writes)value===undefined?records.delete(key):records.set(key,value);
          setImmediate(()=>{if(!aborted)tx.oncomplete?.();});
        });
        return tx;
      }};
      connections.push(db);request.result=db;request.onsuccess();
    });return request;
  }};
  try{const storage=await import(`../ChatGPT-Exporter-English-Edge/storage.mjs?fixture=${++sequence}`);await run({storage,connections,records,metrics,faults});}
  finally{if(previous===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=previous;}
}

test('closed database recovers through one shared open for concurrent operations',()=>fixture(async({storage,connections,metrics})=>{
  await storage.put('meta','saved',{keep:true});connections[0].close();
  const rows=await Promise.all(Array.from({length:100},()=>storage.get('meta','saved')));
  assert.ok(rows.every(row=>row.keep));assert.equal(metrics.opens,2);
}));

test('close and versionchange events invalidate only their own connection',()=>fixture(async({storage,connections,metrics})=>{
  await storage.get('meta','saved');connections[0].onversionchange();assert.equal(connections[0].closed,true);
  await storage.get('meta','saved');connections[0].onclose();await storage.get('meta','saved');assert.equal(metrics.opens,2);
  connections[1].close();connections[1].onclose();await storage.get('meta','saved');assert.equal(metrics.opens,3);
}));

test('failed opening is observable and does not poison later attempts',()=>fixture(async({storage,faults,metrics})=>{
  faults.open=new DOMException('Storage access denied','SecurityError');
  await assert.rejects(storage.get('meta','saved'),{name:'SecurityError'});
  assert.equal(await storage.get('meta','saved'),undefined);assert.equal(metrics.opens,2);
}));

test('transaction creation retries once, then surfaces the error',()=>fixture(async({storage,faults,metrics})=>{
  faults.creation=new DOMException('The database connection is closing.','InvalidStateError');
  await assert.rejects(storage.get('meta','saved'),{name:'InvalidStateError'});
  assert.equal(metrics.opens,2);assert.equal(metrics.transactions,2);
  faults.creation=null;await storage.get('meta','saved');assert.equal(metrics.opens,3);
}));

test('permissions and missing-store errors are not reopened or hidden',()=>fixture(async({storage,faults,metrics})=>{
  faults.creation=new DOMException('Denied','SecurityError');await assert.rejects(storage.get('meta','saved'),{name:'SecurityError'});
  faults.creation=new DOMException('Missing store','NotFoundError');await assert.rejects(storage.get('absent','saved'),{name:'NotFoundError'});
  assert.equal(metrics.opens,1);assert.equal(metrics.transactions,2);
}));

test('started writes are never replayed and quota failures retain prior data',()=>fixture(async({storage,faults,metrics})=>{
  await storage.put('meta','saved',{keep:true});const before=metrics.transactions;
  faults.abort=new DOMException('Storage full','QuotaExceededError');
  await assert.rejects(storage.put('meta','saved',{keep:false}),e=>e.name==='QuotaExceededError'&&e.code==='LOCAL_STORAGE_FAILURE');
  assert.equal(metrics.transactions,before+1);assert.equal((await storage.get('meta','saved')).keep,true);
}));

test('read results wait for transaction completion and reject an abort',()=>fixture(async({storage,faults})=>{
  await storage.put('meta','saved',{keep:true});faults.abortRead=true;
  await assert.rejects(storage.get('meta','saved'),{name:'AbortError'});
  faults.abortRead=false;assert.equal((await storage.get('meta','saved')).keep,true);
}));

test('job revision increments once on recovery and malformed batches stay atomic',()=>fixture(async({storage,connections,records})=>{
  await storage.get('meta','saved');connections[0].close();const job={status:'paused'};
  await storage.put('jobs','scope',job);assert.equal(job.uiRevision,1);assert.equal((await storage.get('jobs','scope')).uiRevision,1);
  await assert.rejects(storage.putMany('meta',[{key:'first',value:{ok:true}},{key:'bad',value:()=>{}}]),e=>e.code==='LOCAL_STORAGE_FAILURE'&&e.name==='DataCloneError');
  assert.equal(records.has('meta:first'),false);assert.equal(records.has('meta:bad'),false);
}));
