import test from 'node:test';import assert from 'node:assert/strict';
import {ContentStore} from '../ChatGPT-Exporter-English-Edge/file-intelligence.mjs';
import {newJob,safeName} from '../ChatGPT-Exporter-English-Edge/core.mjs';
import {localStorageError} from '../ChatGPT-Exporter-English-Edge/local-io.mjs';
const name='Exergy, Desire, and the Architecture of Closed Societies A Systems-Theoretic Model of Energy, Cognition, and Meaning.html',root='C:/Users/12266/Downloads/CHATGPT/chatgpt-backup-5a614c7e77e4/';
const missing=()=>localStorageError(Object.assign(Error('A requested file or directory could not be found at the time an operation was processed.'),{name:'NotFoundError'}),'backup write');
function fixture(write){const job=newJob({key:'fixture',user:'fixture'}),file={id:'file_test',name,attempts:1,status:'pending'};job.library={entries:{file},sources:[],directories:{}};const store=new ContentStore(()=>job,{read:async()=>{throw Object.assign(Error('missing'),{name:'NotFoundError'});},write,commit:async()=>{},remove:async()=>{}});return {job,file,store};}
test('reported long name saves under a bounded name without losing extension or display name',async()=>{
 const paths=[],h=fixture(async p=>{paths.push(p);if(root.length+p.length>240)throw missing();});
 const result=await h.store.save(new Blob(['<html>fixture</html>']),h.file);
 assert.equal(result.status,'saved');assert.match(result.path,/\.html$/);assert.ok(root.length+result.path.length<=240);assert.equal(h.file.name,name);assert.equal(h.file.attempts,1);
 console.log(JSON.stringify({oldPathLength:root.length+85+safeName(name,160).length,newPathLength:root.length+result.path.length}));
});
test('file-specific NotFound retries one compact path, then skips only this file without charging remote attempts',async()=>{
 let writes=0;const h=fixture(async()=>{writes++;throw missing();});const result=await h.store.save(new Blob(['fixture']),h.file);
 assert.equal(writes,2);assert.equal(result.status,'manual');assert.equal(result.localWriteSkipped,true);assert.equal(h.file.attempts,1);assert.ok(!h.file.parked);assert.equal(h.file.status,'manual');assert.equal(result.localWriteErrors.length,2);
 h.store.write=async()=>{};const next={id:'file_next',name:'next.txt',status:'pending'};h.job.library.entries[next.id]=next;assert.equal((await h.store.save(new Blob(['next']),next)).status,'saved');
});
test('compact retry can succeed and real permission loss still aborts globally',async()=>{
 let calls=0;const h=fixture(async()=>{if(++calls===1)throw missing();});const result=await h.store.save(new Blob(['fixture']),h.file);assert.equal(result.status,'saved');assert.equal(calls,2);assert.match(result.path,/\/file\.html$/);
 h.store.write=async()=>{throw Object.assign(Error('denied'),{name:'NotAllowedError'});};await assert.rejects(h.store.save(new Blob(['different']),{id:'file_denied',name:'denied.html'}),{name:'NotAllowedError'});
});
import {libraryIndex,processLibrary,retryLibraryFile} from '../ChatGPT-Exporter-English-Edge/library.mjs';
import {retryLinkedFile} from '../ChatGPT-Exporter-English-Edge/file-links.mjs';
test('two local failures continue the Library worker and explicit retry releases the skipped file',async()=>{
 const h=fixture(async()=>{throw missing();});let saves=0,reports=0;const engine={job:h.job,now:()=>1000,save:async()=>saves++,event:()=>{},io:{libraryDownload:async f=>h.store.save(new Blob(['fixture']),f),report:async()=>reports++}};
 await processLibrary(engine,{file:h.file});assert.equal(h.file.status,'manual');assert.equal(h.file.attempts,1);assert.equal(reports,1);assert.ok(saves>=2);
 const row=libraryIndex(h.job).entries.find(x=>x.name===name);assert.equal(new URL(row.manual_url).searchParams.get('search'),name);
 assert.equal(retryLinkedFile(h.job,h.file,2000),true);assert.equal(h.file.localWriteSkipped,false);assert.equal(h.file.status,'pending');
 assert.equal(retryLibraryFile({status:'manual',localWriteSkipped:true}),true);assert.equal(retryLibraryFile({status:'manual'}),false);
});
test('a missing backup directory still reports a global destination failure',async()=>{
 const h=fixture(async()=>{throw Object.assign(missing(),{stage:'directory'});});await assert.rejects(h.store.save(new Blob(['fixture']),h.file),{stage:'directory'});assert.notEqual(h.file.status,'manual');
});
