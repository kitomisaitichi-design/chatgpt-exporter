import test from 'node:test';
import assert from 'node:assert/strict';
import {scanLocalFileCopies} from '../ChatGPT-Exporter-English-Edge/local-files.mjs';
import {scanTranscriptInventory,walkLocalFiles} from '../ChatGPT-Exporter-English-Edge/local-detection.mjs';
const fail=name=>Object.assign(Error('A requested file or directory could not be found at the time an operation was processed.'),{name});
class Dir {
 constructor(name,items={}){this.name=name;this.kind='directory';this.items=items;}
 async *entries(){yield* Object.entries(this.items);}
 async isSameEntry(h){return this===h;}
 async getFileHandle(n){if(this.items[n]?.kind==='file')return this.items[n];throw fail('NotFoundError');}
 async getDirectoryHandle(n){if(this.items[n]?.kind==='directory')return this.items[n];throw fail('NotFoundError');}
}
const file=(name,text)=>({kind:'file',name,async isSameEntry(h){return this===h;},async getFile(){return Object.assign(new Blob([text]),{name,lastModified:1});}});
const gone={kind:'file',name:'gone.txt',async getFile(){throw fail('NotFoundError');}};
test('a stale attachment candidate does not abort unrelated available files',async()=>{
 const inv=await scanLocalFileCopies([{source:'library',handle:new Dir('Files',{'gone.txt':gone,'good.txt':file('good.txt','hello')})}],'fixture');
 assert.equal(inv.records.size,1);assert.equal(inv.errors,1);assert.equal([...inv.records.values()][0].name,'good.txt');
});
test('a stale transcript candidate does not abort valid JSON recovery',async()=>{
 const id='69a12273-898c-8329-bf14-b900be5ce8e2',data={conversation_id:id,title:'Fixture',mapping:{n:{id:'n',message:{content:{parts:['Hello']}}}}};
 const inv=await scanTranscriptInventory(new Dir('Files',{'gone.json':gone,'good.json':file('good.json',JSON.stringify(data))}),'fixture');
 assert.equal(inv.files.size,1);assert.equal(inv.stats.errors,1);
});
test('directory scan propagates quota and unexpected faults instead of returning a partial success',async()=>{
 for(const name of ['QuotaExceededError','UnknownError','NotAllowedError']){
  const root=new Dir('Files');root.entries=async function*(){throw fail(name);};
  await assert.rejects(async()=>{for await(const item of walkLocalFiles(root)){}},{name});
 }
});
test('a stale nested directory during its metadata check does not abort its siblings',async()=>{
 const stale=new Dir('Gone'),good=new Dir('Good',{'good.txt':file('good.txt','hello')});
 const rows=[],stats={};for await(const item of walkLocalFiles(new Dir('Files',{stale,good}),{stats,acceptDirectory:async d=>{if(d===stale)throw fail('NotFoundError');return true;}}))rows.push(item);
 assert.equal(rows.length,1);assert.equal(stats.errors,1);
});
import {sameLocalEntry,localStorageError} from '../ChatGPT-Exporter-English-Edge/local-io.mjs';
import {newJob} from '../ChatGPT-Exporter-English-Edge/core.mjs';
import {processLibrary,libraryState,recoverLocalFileFailures} from '../ChatGPT-Exporter-English-Edge/library.mjs';
import {Engine} from '../ChatGPT-Exporter-English-Edge/engine.mjs';
test('stale fingerprint comparisons invalidate reuse, while permission faults still propagate',async()=>{
 assert.equal(await sameLocalEntry({async isSameEntry(){throw fail('NotFoundError');}},{}),false);
 await assert.rejects(sameLocalEntry({async isSameEntry(){throw fail('NotAllowedError');}},{}),{name:'NotAllowedError'});
});
test('local write failure pauses Library and attachment work without charging remote retries',async()=>{
 for(const name of ['NotFoundError','QuotaExceededError','UnknownError']){
  const error=localStorageError(fail(name),'backup write','attachments/example.txt');
  const job=newJob({key:'fixture',user:'fixture'}),f={id:'file_a',name:'example.txt',status:'pending',attempts:1};libraryState(job).entries[f.id]=f;
  const engine={job,now:()=>1000,save:async()=>{},event:()=>{},io:{libraryDownload:async()=>{throw error;},report:async()=>{}}};
  await assert.rejects(processLibrary(engine,{file:f}),{name,code:'LOCAL_STORAGE_FAILURE'});assert.equal(f.attempts,1);assert.ok(!f.parked);
  const entry={id:'chat_a',status:'saved',attachments:[]};job.entries[entry.id]=entry;
  const worker=new Engine(job,{save:async()=>{},cacheGet:async()=>({data:{mapping:{n:{message:{metadata:{attachments:[{id:'file_a',name:'example.txt',size:5}]},content:{parts:[]}}}}}}),attachments:async()=>{throw error;}});
  await assert.rejects(worker.processAttachments(entry),{name,code:'LOCAL_STORAGE_FAILURE'});assert.equal(entry.attachmentRetryAt,undefined);
 }
});
test('quota diagnostics identify the failing store and preserve the original cause',()=>{
 const cause=fail('QuotaExceededError'),error=localStorageError(cause,'browser database write','chats');
 assert.equal(error.cause,cause);assert.match(error.message,/browser database write.*chats/);assert.match(error.message,/Free disk space/);assert.equal(localStorageError(error,'again'),error);
});
test('false charges are removed from complete and partial histories; genuine remote-only parking survives',()=>{
 const job=newJob({key:'fixture',user:'fixture'}),message=fail('NotFoundError').message;
 const make=(id,history)=>({id,name:id,attempts:2,parked:true,status:'unavailable',lastFailureStatus:null,failureHistory:history});
 const local=make('file_local',[{status:null,error:message},{status:null,error:message}]),remote=make('file_remote',[{status:404,error:message},{status:null,error:message}]),ambiguous=make('file_unknown',[{status:null,error:message}]);
 Object.assign(libraryState(job).entries,{local,remote,ambiguous});
 assert.equal(recoverLocalFileFailures(job,1000),3);assert.equal(local.status,'pending');assert.equal(local.attempts,0);assert.equal(local.failureHistory.length,2);assert.equal(remote.attempts,1);assert.ok(!remote.parked);assert.equal(ambiguous.attempts,1);assert.ok(!ambiguous.parked);assert.equal(recoverLocalFileFailures(job,1001),0);
});
test('legacy records without history release the explicit local fault only; server-only history stays parked',()=>{
 const job=newJob({key:'fixture',user:'fixture'}),message=fail('NotFoundError').message,legacy={id:'file_legacy',attempts:2,parked:true,status:'unavailable',error:message},remote={id:'file_real_remote',attempts:2,parked:true,status:'unavailable',error:'HTTP 404',lastFailureStatus:404,failureHistory:[{status:404,error:'HTTP 404'},{status:404,error:'HTTP 404'}]};
 Object.assign(libraryState(job).entries,{legacy,remote});assert.equal(recoverLocalFileFailures(job,1000),1);assert.equal(legacy.attempts,1);assert.ok(!legacy.parked);assert.equal(remote.attempts,2);assert.ok(remote.parked);assert.equal(recoverLocalFileFailures(job,1001),0);
});
